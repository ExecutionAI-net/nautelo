from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from audit.models import AuditEvent
from listings.decisions import approve_revision, reject_revision, request_revision_changes
from listings.drafts import InvalidWorkflowState
from listings.enums import ListingStatus, MediaStatus, MediaType, RevisionStatus
from listings.locking import StaleVersionConflict
from listings.models import ListingSnapshot
from listings.snapshots import build_media_manifest
from listings.tests.factories import (
    make_media,
    make_private_listing,
    make_revision,
    make_snapshot,
)


# accounts.tests.factories.make_user() defaults to a single fixed email, so every
# helper here takes one explicitly: a test that needs two people must not collide
# on User.email's uniqueness.
def _staff(email="staff@example.com"):
    return make_user(email)


def _seller(email="private-seller@example.com"):
    return make_user(email, role=UserRole.PRIVATE_SELLER, verified=True)


def _payload(media_id, **overrides):
    payload = {
        "title_en": "Oceanis 46.1, one owner",
        "description_en": "Full service history.",
        "specifications": {"length_m": "14.6"},
        "location_country": "IT",
        "location_city": "Genoa",
        "price": "125000.00",
        "currency": "EUR",
        "media_ids": [str(media_id)],
    }
    payload.update(overrides)
    return payload


def _submitted_listing(owner=None, **listing_kwargs):
    owner = owner or _seller()
    listing = make_private_listing(
        owner=owner, status=ListingStatus.PENDING_APPROVAL, **listing_kwargs
    )
    image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY)
    revision = make_revision(
        listing,
        payload=_payload(image.pk),
        state=RevisionStatus.SUBMITTED,
        submitted_by=owner,
        submitted_at=timezone.now(),
    )
    return listing, revision, image


@pytest.mark.django_db
def test_build_media_manifest_copies_the_media_facts_in_order():
    listing = make_private_listing(owner=_seller())
    second = make_media(
        listing, media_type=MediaType.IMAGE, status=MediaStatus.READY, sort_order=1
    )
    first = make_media(
        listing, media_type=MediaType.IMAGE, status=MediaStatus.READY, sort_order=0
    )

    manifest = build_media_manifest(listing, [str(second.pk), str(first.pk)])

    assert [entry["media_id"] for entry in manifest] == [str(first.pk), str(second.pk)]
    assert manifest[0]["media_type"] == MediaType.IMAGE
    assert manifest[0]["storage_key"] == first.storage_key
    assert manifest[0]["checksum_sha256"] == first.checksum_sha256


@pytest.mark.django_db
def test_build_media_manifest_puts_every_image_before_every_video():
    listing = make_private_listing(owner=_seller())
    video = make_media(
        listing, media_type=MediaType.VIDEO, status=MediaStatus.READY, sort_order=0
    )
    image = make_media(
        listing, media_type=MediaType.IMAGE, status=MediaStatus.READY, sort_order=3
    )

    manifest = build_media_manifest(listing, [str(video.pk), str(image.pk)])

    assert [entry["media_id"] for entry in manifest] == [str(image.pk), str(video.pk)]
    assert manifest[1]["duration_seconds"] == video.duration_seconds
    assert manifest[0]["width"] == image.width


@pytest.mark.django_db
def test_approving_an_initial_submission_publishes_snapshot_version_one():
    listing, revision, _ = _submitted_listing()
    staff = _staff()

    approve_revision(revision_id=revision.pk, actor=staff, expected_version=revision.version)

    listing.refresh_from_db()
    revision.refresh_from_db()
    snapshot = ListingSnapshot.objects.get(listing=listing)
    assert snapshot.version == 1
    assert snapshot.approved_revision_id == revision.pk
    assert snapshot.approved_by_id == staff.pk
    assert snapshot.title_en == "Oceanis 46.1, one owner"
    assert str(snapshot.price) == "125000.00"
    assert snapshot.specifications_schema_version == 1
    assert listing.status == ListingStatus.PUBLISHED
    assert listing.current_public_snapshot_id == snapshot.pk
    assert listing.published_at is not None
    assert revision.state == RevisionStatus.APPROVED
    assert revision.decided_by_id == staff.pk


@pytest.mark.django_db
def test_the_published_snapshot_carries_the_media_manifest():
    listing, revision, image = _submitted_listing()

    approve_revision(revision_id=revision.pk, actor=_staff(), expected_version=revision.version)

    snapshot = ListingSnapshot.objects.get(listing=listing)
    assert [entry["media_id"] for entry in snapshot.media_manifest] == [str(image.pk)]
    assert snapshot.media_manifest[0]["storage_key"] == image.storage_key


@pytest.mark.django_db
def test_the_snapshot_copies_the_taxonomy_names_off_the_listing_columns():
    listing, revision, _ = _submitted_listing()

    approve_revision(revision_id=revision.pk, actor=_staff(), expected_version=revision.version)

    snapshot = ListingSnapshot.objects.get(listing=listing)
    assert snapshot.brand_name_snapshot == listing.brand.name
    assert snapshot.model_name_snapshot == listing.model.name
    assert snapshot.manufacture_year_snapshot == listing.manufacture_year


@pytest.mark.django_db
def test_approval_sets_the_expiry_from_the_publication_policy():
    listing, revision, _ = _submitted_listing()

    approve_revision(revision_id=revision.pk, actor=_staff(), expected_version=revision.version)

    listing.refresh_from_db()
    expected = listing.published_at + timedelta(days=30)
    assert abs((listing.expires_at - expected).total_seconds()) < 5


@pytest.mark.django_db
def test_approval_records_an_audit_event_with_actor_note_and_timestamps():
    listing, revision, _ = _submitted_listing()
    staff = _staff()

    approve_revision(
        revision_id=revision.pk,
        actor=staff,
        expected_version=revision.version,
        note="Looks good.",
    )

    event = AuditEvent.objects.get(action="listing.revision_approved")
    assert event.actor_user_id == staff.pk
    assert event.target_id == str(revision.pk)
    assert event.metadata["note"] == "Looks good."
    assert event.after["snapshot_version"] == 1
    assert event.created_at is not None


@pytest.mark.django_db
def test_approval_emits_the_approved_and_published_signals_on_commit(django_capture_on_commit_callbacks):
    from listings.signals import listing_published, listing_revision_approved

    listing, revision, _ = _submitted_listing()
    seen = []
    listing_revision_approved.connect(
        lambda **kwargs: seen.append("approved"), weak=False, dispatch_uid="t11-approved"
    )
    listing_published.connect(
        lambda **kwargs: seen.append("published"), weak=False, dispatch_uid="t11-published"
    )
    try:
        with django_capture_on_commit_callbacks(execute=True):
            approve_revision(
                revision_id=revision.pk, actor=_staff(), expected_version=revision.version
            )
    finally:
        listing_revision_approved.disconnect(dispatch_uid="t11-approved")
        listing_published.disconnect(dispatch_uid="t11-published")

    assert seen == ["approved", "published"]


@pytest.mark.django_db
def test_approving_a_post_publication_revision_creates_version_two_and_keeps_published_at():
    owner = _seller()
    staff = _staff()
    listing = make_private_listing(owner=owner, status=ListingStatus.PUBLISHED)
    first_snapshot = make_snapshot(listing, approved_by=staff, version=1)
    listing.current_public_snapshot = first_snapshot
    listing.published_at = timezone.now() - timedelta(days=3)
    listing.save(update_fields=["current_public_snapshot", "published_at"])
    original_published_at = listing.published_at
    image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY)
    revision = make_revision(
        listing,
        base_snapshot=first_snapshot,
        payload=_payload(image.pk, price="115000.00"),
        state=RevisionStatus.SUBMITTED,
        submitted_by=owner,
        submitted_at=timezone.now(),
    )

    approve_revision(revision_id=revision.pk, actor=staff, expected_version=revision.version)

    listing.refresh_from_db()
    assert listing.current_public_snapshot.version == 2
    assert str(listing.current_public_snapshot.price) == "115000.00"
    assert listing.published_at == original_published_at
    assert ListingSnapshot.objects.filter(listing=listing).count() == 2
    assert str(ListingSnapshot.objects.get(listing=listing, version=1).price) == "125000.00"


@pytest.mark.django_db
def test_a_post_publication_approval_leaves_a_suspended_listing_suspended():
    owner = _seller()
    staff = _staff()
    listing = make_private_listing(owner=owner, status=ListingStatus.PUBLISHED)
    snapshot = make_snapshot(listing, approved_by=staff, version=1)
    listing.current_public_snapshot = snapshot
    listing.published_at = timezone.now() - timedelta(days=3)
    listing.expires_at = listing.published_at + timedelta(days=30)
    listing.status = ListingStatus.SUSPENDED
    listing.save(
        update_fields=["current_public_snapshot", "published_at", "expires_at", "status"]
    )
    original_expires_at = listing.expires_at
    image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY)
    revision = make_revision(
        listing,
        base_snapshot=snapshot,
        payload=_payload(image.pk),
        state=RevisionStatus.SUBMITTED,
        submitted_by=owner,
        submitted_at=timezone.now(),
    )

    approve_revision(revision_id=revision.pk, actor=staff, expected_version=revision.version)

    listing.refresh_from_db()
    assert listing.status == ListingStatus.SUSPENDED
    assert listing.expires_at == original_expires_at
    assert listing.current_public_snapshot.version == 2


@pytest.mark.django_db
def test_a_revision_based_on_a_superseded_snapshot_is_refused():
    owner = _seller()
    staff = _staff()
    listing = make_private_listing(owner=owner, status=ListingStatus.PUBLISHED)
    stale_base = make_snapshot(listing, approved_by=staff, version=1)
    current = make_snapshot(listing, approved_by=staff, version=2)
    listing.current_public_snapshot = current
    listing.save(update_fields=["current_public_snapshot"])
    image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY)
    revision = make_revision(
        listing,
        base_snapshot=stale_base,
        payload=_payload(image.pk),
        state=RevisionStatus.SUBMITTED,
        submitted_by=owner,
        submitted_at=timezone.now(),
    )

    with pytest.raises(InvalidWorkflowState) as exc_info:
        approve_revision(
            revision_id=revision.pk, actor=staff, expected_version=revision.version
        )

    assert exc_info.value.get_codes() == "stale_base_snapshot"
    assert exc_info.value.meta == {"resource": "snapshot", "current_version": 2}
    assert ListingSnapshot.objects.filter(listing=listing).count() == 2


@pytest.mark.django_db
def test_approval_revalidates_and_refuses_media_rejected_after_submission():
    listing, revision, image = _submitted_listing()
    image.status = MediaStatus.REJECTED
    image.save(update_fields=["status"])

    with pytest.raises(ValidationError):
        approve_revision(
            revision_id=revision.pk, actor=_staff(), expected_version=revision.version
        )

    listing.refresh_from_db()
    revision.refresh_from_db()
    assert listing.status == ListingStatus.PENDING_APPROVAL
    assert revision.state == RevisionStatus.SUBMITTED
    assert ListingSnapshot.objects.count() == 0


@pytest.mark.django_db
def test_approval_revalidates_the_payload_itself():
    listing, revision, _ = _submitted_listing()
    revision.payload = {key: value for key, value in revision.payload.items() if key != "title_en"}
    revision.save(update_fields=["payload"])

    with pytest.raises(ValidationError) as exc_info:
        approve_revision(
            revision_id=revision.pk, actor=_staff(), expected_version=revision.version
        )

    assert exc_info.value.detail["title_en"][0].code == "required_for_submission"
    assert ListingSnapshot.objects.count() == 0


@pytest.mark.django_db
def test_a_second_moderator_decision_conflicts_and_creates_no_second_snapshot():
    """The state guard fires before the version compare-and-swap: after the first
    approval the revision is APPROVED, so `_locked_submitted_revision` refuses it
    with `invalid_revision_state` and `bump_version` is never reached."""
    listing, revision, _ = _submitted_listing()
    first_version = revision.version
    approve_revision(
        revision_id=revision.pk,
        actor=_staff("first-moderator@example.com"),
        expected_version=first_version,
    )

    with pytest.raises(InvalidWorkflowState) as exc_info:
        approve_revision(
            revision_id=revision.pk,
            actor=_staff("second-moderator@example.com"),
            expected_version=first_version,
        )

    assert exc_info.value.get_codes() == "invalid_revision_state"
    assert ListingSnapshot.objects.filter(listing=listing).count() == 1


@pytest.mark.django_db
def test_a_stale_version_on_a_still_submitted_revision_raises_a_version_conflict():
    """The other half of the pair: the revision is still SUBMITTED, so the state
    guard passes and the compare-and-swap is what refuses the decision."""
    listing, revision, _ = _submitted_listing()

    with pytest.raises(StaleVersionConflict) as exc_info:
        approve_revision(
            revision_id=revision.pk, actor=_staff(), expected_version=revision.version + 7
        )

    assert exc_info.value.meta == {
        "resource": "revision",
        "current_version": revision.version,
    }
    assert ListingSnapshot.objects.filter(listing=listing).count() == 0


@pytest.mark.django_db
def test_requesting_changes_returns_an_initial_submission_to_draft():
    listing, revision, _ = _submitted_listing()

    request_revision_changes(
        revision_id=revision.pk,
        actor=_staff(),
        expected_version=revision.version,
        note="Please add an interior photo.",
    )

    listing.refresh_from_db()
    revision.refresh_from_db()
    assert listing.status == ListingStatus.DRAFT
    assert revision.state == RevisionStatus.CHANGES_REQUESTED
    assert revision.decision_note == "Please add an interior photo."
    assert AuditEvent.objects.filter(action="listing.revision_changes_requested").exists()


@pytest.mark.django_db
def test_rejecting_an_initial_submission_sets_the_listing_to_rejected():
    listing, revision, _ = _submitted_listing()

    reject_revision(
        revision_id=revision.pk,
        actor=_staff(),
        expected_version=revision.version,
        note="Duplicate of an existing listing.",
    )

    listing.refresh_from_db()
    revision.refresh_from_db()
    assert listing.status == ListingStatus.REJECTED
    assert revision.state == RevisionStatus.REJECTED
    assert AuditEvent.objects.filter(action="listing.revision_rejected").exists()


@pytest.mark.django_db
def test_rejecting_a_post_publication_revision_leaves_the_public_snapshot_live():
    owner = _seller()
    staff = _staff()
    listing = make_private_listing(owner=owner, status=ListingStatus.PUBLISHED)
    snapshot = make_snapshot(listing, approved_by=staff, version=1)
    listing.current_public_snapshot = snapshot
    listing.save(update_fields=["current_public_snapshot"])
    image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY)
    revision = make_revision(
        listing,
        base_snapshot=snapshot,
        payload=_payload(image.pk, price="1000.00"),
        state=RevisionStatus.SUBMITTED,
        submitted_by=owner,
        submitted_at=timezone.now(),
    )

    reject_revision(
        revision_id=revision.pk,
        actor=staff,
        expected_version=revision.version,
        note="Price is not credible.",
    )

    listing.refresh_from_db()
    assert listing.status == ListingStatus.PUBLISHED
    assert listing.current_public_snapshot_id == snapshot.pk
    assert str(listing.current_public_snapshot.price) == "125000.00"


@pytest.mark.django_db
def test_requesting_changes_on_a_post_publication_revision_leaves_the_listing_published():
    owner = _seller()
    staff = _staff()
    listing = make_private_listing(owner=owner, status=ListingStatus.PUBLISHED)
    snapshot = make_snapshot(listing, approved_by=staff, version=1)
    listing.current_public_snapshot = snapshot
    listing.save(update_fields=["current_public_snapshot"])
    image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY)
    revision = make_revision(
        listing,
        base_snapshot=snapshot,
        payload=_payload(image.pk),
        state=RevisionStatus.SUBMITTED,
        submitted_by=owner,
        submitted_at=timezone.now(),
    )

    request_revision_changes(
        revision_id=revision.pk,
        actor=staff,
        expected_version=revision.version,
        note="Please sharpen the description.",
    )

    listing.refresh_from_db()
    revision.refresh_from_db()
    assert listing.status == ListingStatus.PUBLISHED
    assert listing.current_public_snapshot_id == snapshot.pk
    assert revision.state == RevisionStatus.CHANGES_REQUESTED


@pytest.mark.django_db
def test_a_refusal_without_a_note_is_rejected():
    listing, revision, _ = _submitted_listing()

    with pytest.raises(ValidationError) as exc_info:
        reject_revision(
            revision_id=revision.pk,
            actor=_staff(),
            expected_version=revision.version,
            note="   ",
        )

    assert exc_info.value.detail["note"][0].code == "decision_note_required"
    revision.refresh_from_db()
    assert revision.state == RevisionStatus.SUBMITTED


@pytest.mark.django_db
def test_requesting_changes_without_a_note_is_rejected():
    listing, revision, _ = _submitted_listing()

    with pytest.raises(ValidationError) as exc_info:
        request_revision_changes(
            revision_id=revision.pk,
            actor=_staff(),
            expected_version=revision.version,
            note="",
        )

    assert exc_info.value.detail["note"][0].code == "decision_note_required"


@pytest.mark.django_db
def test_a_draft_revision_cannot_be_decided():
    listing = make_private_listing(owner=_seller())
    revision = make_revision(listing)

    with pytest.raises(InvalidWorkflowState):
        approve_revision(
            revision_id=revision.pk, actor=_staff(), expected_version=revision.version
        )
