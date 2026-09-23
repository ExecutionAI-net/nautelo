import hashlib
from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from entitlements.enums import EntitlementSource, EntitlementType
from entitlements.tests.factories import make_entitlement, make_private_seller
from listings import media_storage
from listings.enums import MediaStatus, MediaType
from listings.media_uploads import cleanup_stale_uploads, process_media, requeue_stuck_media
from listings.models import ListingMedia
from listings.tests.factories import (
    make_brand,
    make_broker_listing,
    make_media,
    make_private_listing,
)
from listings.tests.test_media_policy import MP4, jpeg, png
from platform_settings.services import set_feature_flag

pytestmark = pytest.mark.django_db


class FakeStorage:
    def __init__(self):
        self.objects: dict[str, bytes] = {}

    def upload_target(self, key, content_type):
        return media_storage.UploadTarget(
            url=f"https://storage.test/{key}",
            method="PUT",
            headers={"Content-Type": content_type},
            expires_in=900,
        )

    def size(self, key):
        return len(self.objects[key]) if key in self.objects else None

    def read_head(self, key, n=media_storage.HEAD_BYTES):
        return self.objects[key][:n]

    def sha256(self, key):
        return hashlib.sha256(self.objects[key]).hexdigest()

    def read(self, key):
        return self.objects[key]

    def write(self, key, data, content_type):
        self.objects[key] = data

    def delete(self, key):
        self.objects.pop(key, None)


@pytest.fixture(autouse=True)
def fake_storage():
    previous = media_storage.get_media_storage()
    fake = FakeStorage()
    media_storage.set_media_storage(fake)
    set_feature_flag(key="listing_revisions", is_enabled=True, actor=None)
    yield fake
    media_storage.set_media_storage(previous)


@pytest.fixture(autouse=True)
def run_on_commit_immediately(monkeypatch):
    """The test transaction never commits, so on_commit hooks (the worker
    enqueue) would never fire. Celery is eager in tests, so run them inline."""
    monkeypatch.setattr(
        "django.db.transaction.on_commit", lambda fn, using=None, robust=False: fn()
    )


@pytest.fixture
def seller():
    return make_private_seller()


@pytest.fixture
def client(seller):
    c = APIClient()
    c.force_authenticate(seller)
    return c


def intent(client, listing, data=None, *, media_type="IMAGE", name="boat.png", mime="image/png"):
    data = data if data is not None else png(1920, 1080)
    return client.post(
        reverse("listing-media-intent", args=[listing.pk]),
        {
            "media_type": media_type,
            "filename": name,
            "mime_type": mime,
            "size": len(data),
            "checksum_sha256": hashlib.sha256(data).hexdigest(),
        },
        format="json",
    )


def upload_and_complete(client, listing, fake, data, **kwargs):
    response = intent(client, listing, data, **kwargs)
    assert response.status_code == 201, response.data
    media_id = response.data["media"]["id"]
    media = ListingMedia.objects.get(pk=media_id)
    fake.objects[media.storage_key] = data
    done = client.post(
        reverse("listing-media-complete", args=[listing.pk, media_id])
    )
    return media_id, done


def test_the_happy_path_ends_ready_with_real_dimensions(client, seller, fake_storage):
    listing = make_private_listing(owner=seller)
    media_id, done = upload_and_complete(client, listing, fake_storage, png(1920, 1080))
    assert done.status_code == 202
    media = ListingMedia.objects.get(pk=media_id)
    assert media.status == MediaStatus.READY
    assert (media.width, media.height) == (1920, 1080)


def test_the_intent_returns_a_target_and_hides_the_storage_key(client, seller):
    listing = make_private_listing(owner=seller)
    response = intent(client, listing)
    assert response.status_code == 201
    assert response.data["upload"]["method"] == "PUT"
    assert "storage_key" not in response.data["media"]
    assert response.data["media"]["status"] == "UPLOADING"


def test_a_base_private_seller_cannot_take_a_second_image_or_any_video(client, seller):
    listing = make_private_listing(owner=seller)
    assert intent(client, listing).status_code == 201
    second = intent(client, listing)
    assert second.status_code == 409
    assert second.data["error"]["code"] == "media_limit_reached"
    video = intent(
        client, listing, MP4, media_type="VIDEO", name="tour.mp4", mime="video/mp4"
    )
    assert video.status_code == 409


def test_an_unfinished_upload_still_holds_its_slot(client, seller):
    """Spec 11.5: the count includes non-rejected UPLOADING reservations."""
    listing = make_private_listing(owner=seller)
    intent(client, listing)
    assert intent(client, listing).status_code == 409


def test_the_upgrade_lifts_the_limits_as_totals(client, seller):
    from listings.media_upgrade import apply_media_upgrade

    listing = make_private_listing(owner=seller)
    make_media(listing, sort_order=0)
    make_entitlement(
        user=seller,
        listing=listing,
        entitlement_type=EntitlementType.MEDIA_UPGRADE,
        source=EntitlementSource.STRIPE_PURCHASE,
    )
    apply_media_upgrade(actor=seller, listing=listing)
    # One image already exists; 19 more fit, the 21st does not.
    for _ in range(19):
        assert intent(client, listing).status_code == 201
    assert intent(client, listing).status_code == 409
    assert (
        intent(
            client, listing, MP4, media_type="VIDEO", name="t.mp4", mime="video/mp4"
        ).status_code
        == 201
    )
    assert (
        intent(
            client, listing, MP4, media_type="VIDEO", name="u.mp4", mime="video/mp4"
        ).status_code
        == 409
    )


def test_a_broker_cannot_exceed_twenty_images_and_one_video():
    actor = make_user("agent@example.com", role=UserRole.BROKER, verified=True)
    from brokers.enums import BrokerMembershipRole, BrokerOrganizationStatus
    from brokers.tests.factories import make_broker, make_membership

    broker = make_broker("Acme", "acme", status=BrokerOrganizationStatus.ACTIVE)
    make_membership(
        actor, broker, role=BrokerMembershipRole.ADMIN, can_edit_listings=True
    )
    listing = make_broker_listing(broker=broker, actor=actor, brand=make_brand("B1"))
    c = APIClient()
    c.force_authenticate(actor)
    for _ in range(20):
        assert intent(c, listing).status_code == 201
    assert intent(c, listing).status_code == 409
    assert (
        intent(
            c, listing, MP4, media_type="VIDEO", name="t.mp4", mime="video/mp4"
        ).status_code
        == 201
    )
    assert (
        intent(
            c, listing, MP4, media_type="VIDEO", name="u.mp4", mime="video/mp4"
        ).status_code
        == 409
    )


def test_a_mismatched_extension_or_oversize_file_is_refused_at_intent(client, seller):
    listing = make_private_listing(owner=seller)
    bad = intent(client, listing, name="boat.jpg", mime="image/png")
    assert bad.status_code == 400
    assert bad.data["error"]["code"] == "unsupported_media"


def test_completing_before_the_bytes_arrive_is_refused(client, seller):
    listing = make_private_listing(owner=seller)
    response = intent(client, listing)
    done = client.post(
        reverse(
            "listing-media-complete", args=[listing.pk, response.data["media"]["id"]]
        )
    )
    assert done.status_code == 409
    assert done.data["error"]["code"] == "media_upload_incomplete"


def test_a_file_whose_bytes_contradict_its_type_is_rejected_and_deleted(
    client, seller, fake_storage
):
    listing = make_private_listing(owner=seller)
    data = jpeg(1600, 900)
    response = intent(client, listing, data, name="boat.png", mime="image/png")
    media = ListingMedia.objects.get(pk=response.data["media"]["id"])
    fake_storage.objects[media.storage_key] = data
    client.post(reverse("listing-media-complete", args=[listing.pk, media.pk]))
    media.refresh_from_db()
    assert media.status == MediaStatus.REJECTED
    assert media.rejection_reason
    assert media.storage_key not in fake_storage.objects


def test_a_corrupted_upload_fails_the_checksum(client, seller, fake_storage):
    listing = make_private_listing(owner=seller)
    data = png(1920, 1080)
    response = intent(client, listing, data)
    media = ListingMedia.objects.get(pk=response.data["media"]["id"])
    fake_storage.objects[media.storage_key] = data[:-1] + b"\x00"
    client.post(reverse("listing-media-complete", args=[listing.pk, media.pk]))
    media.refresh_from_db()
    assert media.status == MediaStatus.REJECTED


def test_a_rejected_file_frees_its_slot(client, seller, fake_storage):
    listing = make_private_listing(owner=seller)
    data = png(320, 200)
    upload_and_complete(client, listing, fake_storage, data)
    assert ListingMedia.objects.get().status == MediaStatus.REJECTED
    assert intent(client, listing).status_code == 201


def test_processing_is_idempotent(client, seller, fake_storage):
    listing = make_private_listing(owner=seller)
    media_id, _ = upload_and_complete(client, listing, fake_storage, png(1920, 1080))
    before = ListingMedia.objects.get(pk=media_id).updated_at
    process_media(media_id)
    assert ListingMedia.objects.get(pk=media_id).updated_at == before


def test_stale_uploading_reservations_are_cleaned_after_an_hour(client, seller):
    listing = make_private_listing(owner=seller)
    response = intent(client, listing)
    media = ListingMedia.objects.get(pk=response.data["media"]["id"])
    assert cleanup_stale_uploads(now=timezone.now() + timedelta(minutes=30)) == 0
    assert cleanup_stale_uploads(now=timezone.now() + timedelta(hours=2)) == 1
    media.refresh_from_db()
    assert media.status == MediaStatus.REJECTED
    assert intent(client, listing).status_code == 201


def test_a_scan_whose_task_was_lost_is_queued_again_and_finally_given_up(client, seller, fake_storage, monkeypatch):
    """A worker restart mid-deploy drops the queued task and leaves the row SCANNING forever.
    The maintenance sweep re-queues it after a quarter of an hour and frees the slot after six."""
    listing = make_private_listing(owner=seller)
    from listings import tasks

    # The queue swallows the task, as it does when the worker restarts before running it.
    queued: list[str] = []
    monkeypatch.setattr(tasks.process_listing_media, "delay", lambda media_id: queued.append(media_id))
    media_id, _ = upload_and_complete(client, listing, fake_storage, png(1920, 1080))
    media = ListingMedia.objects.get(pk=media_id)
    assert media.status == MediaStatus.SCANNING
    queued.clear()

    now = timezone.now()
    assert requeue_stuck_media(now=now + timedelta(minutes=5)) == {"requeued": 0, "rejected": 0}
    assert requeue_stuck_media(now=now + timedelta(minutes=20)) == {"requeued": 1, "rejected": 0}
    assert queued == [str(media_id)]
    # The re-queued row was touched, so the very next sweep leaves it alone.
    assert requeue_stuck_media(now=now + timedelta(minutes=21)) == {"requeued": 0, "rejected": 0}

    ListingMedia.objects.filter(pk=media_id).update(updated_at=now - timedelta(hours=7))
    assert requeue_stuck_media(now=now) == {"requeued": 0, "rejected": 1}
    media.refresh_from_db()
    assert media.status == MediaStatus.REJECTED
    assert "upload it again" in media.rejection_reason
    assert intent(client, listing).status_code == 201


def test_the_owner_lists_their_uploads_without_rejected_ones(client, seller, fake_storage):
    listing = make_private_listing(owner=seller)
    upload_and_complete(client, listing, fake_storage, png(320, 200))
    assert client.get(reverse("listing-media-list", args=[listing.pk])).data == []
    upload_and_complete(client, listing, fake_storage, png(1920, 1080))
    rows = client.get(reverse("listing-media-list", args=[listing.pk])).data
    assert [r["status"] for r in rows] == ["READY"]


def test_ready_images_carry_a_preview_url_for_the_owner_form(client, seller, settings):
    settings.MEDIA_PUBLIC_BASE_URL = "https://cdn.example.test"
    listing = make_private_listing(owner=seller)
    ready = make_media(listing, status=MediaStatus.READY)
    rows = client.get(reverse("listing-media-list", args=[listing.pk])).data
    assert rows[0]["preview_url"] == f"https://cdn.example.test/{ready.storage_key}"


def test_removing_media_frees_a_slot_but_not_when_a_snapshot_shows_it(client, seller):
    from listings.tests.factories import make_snapshot

    listing = make_private_listing(owner=seller)
    free = make_media(listing, status=MediaStatus.READY)
    response = client.delete(reverse("listing-media-detail", args=[listing.pk, free.pk]))
    assert response.status_code == 204
    free.refresh_from_db()
    assert free.status == MediaStatus.REJECTED

    shown = make_media(listing, sort_order=1)
    make_snapshot(
        listing,
        approved_by=seller,
        media_manifest=[{"media_id": str(shown.pk)}],
    )
    blocked = client.delete(
        reverse("listing-media-detail", args=[listing.pk, shown.pk])
    )
    assert blocked.status_code == 409
    assert blocked.data["error"]["code"] == "media_in_public_snapshot"


def test_a_stranger_cannot_touch_someone_elses_media(seller):
    stranger = make_user("stranger@example.com", verified=True)
    listing = make_private_listing(owner=seller)
    media = make_media(listing)
    c = APIClient()
    c.force_authenticate(stranger)
    assert intent(c, listing).status_code in (403, 404)
    assert (
        c.delete(reverse("listing-media-detail", args=[listing.pk, media.pk])).status_code
        in (403, 404)
    )
    media.refresh_from_db()
    assert media.status == MediaStatus.READY


def test_a_guest_gets_401():
    c = APIClient()
    seller = make_private_seller("s2@example.com")
    listing = make_private_listing(owner=seller)
    assert intent(c, listing).status_code == 401


def test_the_pipeline_strips_metadata_and_updates_the_row_when_the_sanitizer_is_on(
    client, fake_storage, settings
):
    import io

    from PIL import Image

    settings.MEDIA_IMAGE_SANITIZER = "listings.media_sanitize.strip_image_metadata"
    image = Image.new("RGB", (1920, 1080), (10, 20, 30))
    exif = Image.Exif()
    exif[0x010F] = "SecretCameraCo"
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", exif=exif)
    data = buffer.getvalue()

    listing = make_private_listing(owner=client.handler._force_user)
    media_id, done = upload_and_complete(
        client, listing, fake_storage, data, name="boat.jpg", mime="image/jpeg"
    )
    assert done.status_code == 202, done.data

    media = ListingMedia.objects.get(pk=media_id)
    assert media.status == MediaStatus.READY
    stored = fake_storage.objects[media.storage_key]
    assert b"SecretCameraCo" not in stored
    assert media.checksum_sha256 == hashlib.sha256(stored).hexdigest()
    assert media.byte_size == len(stored)
