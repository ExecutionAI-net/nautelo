"""Owner-initiated soft delete (customer feedback, 2026-09-25).

Deleting a listing must: hide it from the owner's dashboard and counters,
hide a published listing from every public read path, but leave the
FREE_LISTING entitlement ledger untouched so the quota is unaffected.
"""

import itertools

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from entitlements.enums import EntitlementState, EntitlementType
from entitlements.policy import free_quota_state
from entitlements.tests.factories import make_entitlement
from listings.deletion import ListingAlreadyDeleted, delete_listing
from listings.enums import ListingStatus, MediaStatus, MediaType
from listings.locking import StaleVersionConflict
from listings.tests.factories import make_media, make_private_listing, make_snapshot
from platform_settings.services import set_feature_flag

pytestmark = pytest.mark.django_db

_emails = itertools.count()


def _email(prefix):
    return f"{prefix}-{next(_emails)}@example.com"


@pytest.fixture(autouse=True)
def _flag(db):
    set_feature_flag(key="listing_revisions", is_enabled=True, actor=None)


def _client(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


def _owner():
    return make_user(email=_email("seller"), role=UserRole.PRIVATE_SELLER, verified=True)


def _moderator():
    return make_user(email=_email("moderator"), role=UserRole.STAFF, verified=True)


def _published(owner):
    listing = make_private_listing(owner=owner, status=ListingStatus.PUBLISHED)
    make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY)
    snapshot = make_snapshot(listing, approved_by=_moderator())
    listing.current_public_snapshot = snapshot
    listing.published_at = timezone.now()
    listing.save(update_fields=["current_public_snapshot", "published_at"])
    return listing


def test_delete_listing_sets_deleted_at_and_bumps_version():
    owner = _owner()
    listing = make_private_listing(owner=owner)

    delete_listing(listing=listing, actor=owner, expected_version=listing.version)

    listing.refresh_from_db()
    assert listing.deleted_at is not None
    assert listing.version == 2


def test_delete_listing_rejects_a_stale_version():
    owner = _owner()
    listing = make_private_listing(owner=owner)

    with pytest.raises(StaleVersionConflict):
        delete_listing(listing=listing, actor=owner, expected_version=listing.version + 1)


def test_delete_listing_twice_conflicts():
    owner = _owner()
    listing = make_private_listing(owner=owner)
    delete_listing(listing=listing, actor=owner, expected_version=listing.version)
    listing.refresh_from_db()

    with pytest.raises(ListingAlreadyDeleted):
        delete_listing(listing=listing, actor=owner, expected_version=listing.version)


def test_deleted_listing_disappears_from_mine_and_its_counters():
    owner = _owner()
    listing = make_private_listing(owner=owner)
    delete_listing(listing=listing, actor=owner, expected_version=listing.version)

    rows = _client(owner).get(reverse("my-listings")).data
    assert rows == []
    summary = _client(owner).get(reverse("my-listings-summary")).data
    assert summary["published"] == 0 and summary["drafts"] == 0


def test_deleting_a_published_listing_hides_it_from_every_public_path():
    owner = _owner()
    listing = _published(owner)
    api = APIClient()
    assert api.get(reverse("listing-detail", kwargs={"listing_id": listing.pk})).status_code == 200

    delete_listing(listing=listing, actor=owner, expected_version=listing.version)

    detail = api.get(reverse("listing-detail", kwargs={"listing_id": listing.pk}))
    assert detail.status_code == 404
    by_slug = api.get(reverse("listing-by-slug", kwargs={"slug": listing.slug}))
    assert by_slug.status_code == 404
    listed_ids = [row["id"] for row in api.get(reverse("listing-list")).data["results"]]
    assert str(listing.pk) not in listed_ids


def test_a_deleted_listings_free_entitlement_still_counts_against_the_quota():
    """The whole point of soft (not hard) delete: the ledger doesn't move."""
    owner = _owner()
    listing = make_private_listing(owner=owner)
    make_entitlement(
        user=owner,
        entitlement_type=EntitlementType.FREE_LISTING,
        state=EntitlementState.CONSUMED,
        listing=listing,
    )
    before = free_quota_state(owner)
    assert before.available is False

    delete_listing(listing=listing, actor=owner, expected_version=listing.version)

    after = free_quota_state(owner)
    assert after.available is False
    assert after.used_in_period == before.used_in_period


def test_delete_endpoint_requires_the_owner():
    owner = _owner()
    other = _owner()
    listing = make_private_listing(owner=owner)
    url = reverse("listing-delete", kwargs={"listing_id": listing.pk})

    response = _client(other).post(url, {"version": listing.version}, format="json")

    assert response.status_code in (403, 404)
    listing.refresh_from_db()
    assert listing.deleted_at is None


def test_delete_endpoint_soft_deletes_and_returns_the_workflow_view():
    owner = _owner()
    listing = make_private_listing(owner=owner)
    url = reverse("listing-delete", kwargs={"listing_id": listing.pk})

    response = _client(owner).post(url, {"version": listing.version}, format="json")

    assert response.status_code == 200
    listing.refresh_from_db()
    assert listing.deleted_at is not None
