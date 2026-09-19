import pytest
from django.contrib.auth.models import Group
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from audit.models import AuditEvent
from listings.enums import ListingStatus, MediaStatus, MediaType
from listings.models import ListingSnapshot
from listings.tests.factories import (
    make_brand,
    make_media,
    make_model,
    make_private_listing,
    make_snapshot,
    other_model_for,
)
from platform_settings.services import set_feature_flag
from taxonomy.models import BoatBrand, BoatModel

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _flag(db):
    set_feature_flag(key="listing_revisions", is_enabled=True, actor=None)


@pytest.fixture
def client():
    user = make_user("tax@console.example", role=UserRole.STAFF)
    user.groups.add(Group.objects.get_or_create(name=StaffGroup.MODERATOR)[0])
    c = APIClient()
    c.force_authenticate(user)
    return c


def published_other(brand, custom="McKenzie"):
    owner = make_user("owner@tax.example", role=UserRole.PRIVATE_SELLER)
    listing = make_private_listing(
        owner=owner,
        brand=brand,
        model=other_model_for(brand),
        custom_model_name=custom,
        status=ListingStatus.PUBLISHED,
    )
    image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY)
    snapshot = make_snapshot(
        listing,
        approved_by=make_user("appr@tax.example", role=UserRole.STAFF),
        media_manifest=[
            {
                "media_id": str(image.pk),
                "media_type": "IMAGE",
                "storage_key": image.storage_key,
                "mime_type": image.mime_type,
                "sort_order": 0,
                "width": 1920,
                "height": 1080,
                "duration_seconds": None,
                "checksum_sha256": image.checksum_sha256,
            }
        ],
    )
    listing.current_public_snapshot = snapshot
    listing.published_at = timezone.now()
    listing.save(update_fields=["current_public_snapshot", "published_at"])
    return listing


def test_brand_create_rejects_a_normalized_duplicate_and_deactivates(client):
    r = client.post(reverse("staff-brand-list"), {"name": "  Sunseeker "}, format="json")
    assert r.status_code == 201
    dup = client.post(reverse("staff-brand-list"), {"name": "sunseeker"}, format="json")
    assert dup.status_code == 409
    off = client.patch(
        reverse("staff-brand-detail", args=[r.data["id"]]),
        {"is_active": False},
        format="json",
    )
    assert off.data["is_active"] is False
    assert AuditEvent.objects.filter(action="taxonomy.brand_updated").exists()


def test_models_are_listed_per_brand_with_other_last_and_other_is_not_editable(client):
    brand = make_brand("Azimut")
    make_model(brand, "Atlantis")
    rows = client.get(reverse("staff-model-list"), {"brand_id": str(brand.pk)}).data
    assert rows[-1]["is_other_placeholder"] is True
    other = other_model_for(brand)
    r = client.patch(reverse("staff-model-detail", args=[other.pk]), {"name": "x"}, format="json")
    assert r.status_code == 400
    assert client.get(reverse("staff-model-list")).status_code == 400


def test_the_other_queue_lists_listings_with_their_custom_names(client):
    brand = make_brand("Jeanneau")
    published_other(brand)
    rows = client.get(reverse("staff-other-queue")).data
    assert rows[0]["custom_model_name"] == "McKenzie"


def test_mapping_a_published_listing_creates_a_new_snapshot_and_keeps_history(client):
    brand = make_brand("Bavaria")
    target = make_model(brand, "Cruiser 46")
    listing = published_other(brand)
    r = client.post(
        reverse("staff-listing-map", args=[listing.pk]),
        {"model_id": str(target.pk), "note": "Mapped"},
        format="json",
    )
    assert r.status_code == 200, r.data
    listing.refresh_from_db()
    assert listing.model_id == target.pk
    assert listing.custom_model_name == ""
    assert listing.current_public_snapshot.version == 2
    assert listing.current_public_snapshot.model_name_snapshot == "Cruiser 46"
    old = ListingSnapshot.objects.get(listing=listing, version=1)
    assert old.custom_model_name_snapshot == "McKenzie"
    audit = AuditEvent.objects.get(action="taxonomy.listing_mapped")
    assert audit.metadata["custom_model_name"] == "McKenzie"


def test_create_model_and_map_and_duplicate_refusal(client):
    brand = make_brand("Prestige")
    listing = published_other(brand)
    r = client.post(
        reverse("staff-listing-map", args=[listing.pk]),
        {"new_model_name": "M48"},
        format="json",
    )
    assert r.status_code == 200
    assert BoatModel.objects.filter(brand=brand, name="M48").count() == 1
    second = make_private_listing(
        owner=make_user("o2@tax.example", role=UserRole.PRIVATE_SELLER),
        brand=brand,
        model=other_model_for(brand),
        custom_model_name="M48",
    )
    dup = client.post(
        reverse("staff-listing-map", args=[second.pk]),
        {"new_model_name": "m48"},
        format="json",
    )
    assert dup.status_code == 409


def test_an_unpublished_listing_is_mapped_in_place(client):
    brand = make_brand("Fairline")
    target = make_model(brand, "Targa 43")
    owner = make_user("o3@tax.example", role=UserRole.PRIVATE_SELLER)
    listing = make_private_listing(
        owner=owner, brand=brand, model=other_model_for(brand), custom_model_name="Xtra"
    )
    r = client.post(
        reverse("staff-listing-map", args=[listing.pk]),
        {"model_id": str(target.pk)},
        format="json",
    )
    assert r.status_code == 200
    listing.refresh_from_db()
    assert listing.model_id == target.pk and listing.custom_model_name == ""


def test_a_listing_not_on_other_cannot_be_mapped_and_wrong_brand_is_refused(client):
    brand = make_brand("Sealine")
    model = make_model(brand, "C330")
    listing = make_private_listing(
        owner=make_user("o4@tax.example", role=UserRole.PRIVATE_SELLER),
        brand=brand,
        model=model,
    )
    r = client.post(
        reverse("staff-listing-map", args=[listing.pk]),
        {"model_id": str(model.pk)},
        format="json",
    )
    assert r.status_code == 409
    foreign = make_model(make_brand("Other Co"), "Z")
    listing2 = make_private_listing(
        owner=make_user("o5@tax.example", role=UserRole.PRIVATE_SELLER),
        brand=make_brand("Sealine2"),
        model=other_model_for(BoatBrand.objects.get(name="Sealine2")),
        custom_model_name="Qx",
    )
    bad = client.post(
        reverse("staff-listing-map", args=[listing2.pk]),
        {"model_id": str(foreign.pk)},
        format="json",
    )
    assert bad.status_code == 400


def test_merge_previews_then_remaps_every_listing_and_deactivates_the_source(client):
    brand = make_brand("Ferretti")
    source = make_model(brand, "Dup 500")
    target = make_model(brand, "Ferretti 500")
    listing = make_private_listing(
        owner=make_user("o6@tax.example", role=UserRole.PRIVATE_SELLER),
        brand=brand,
        model=source,
    )
    url = reverse("staff-model-merge", args=[source.pk])
    preview = client.get(url, {"into": str(target.pk)}).data
    assert preview["affected_count"] == 1
    done = client.post(url, {"into": str(target.pk), "note": "dup"}, format="json")
    assert done.data == {"merged_listings": 1, "source_deactivated": True}
    listing.refresh_from_db()
    source.refresh_from_db()
    assert listing.model_id == target.pk and source.is_active is False


def test_a_buyer_cannot_use_the_taxonomy_console():
    c = APIClient()
    c.force_authenticate(make_user("b@tax.example"))
    assert c.get(reverse("staff-other-queue")).status_code == 403
