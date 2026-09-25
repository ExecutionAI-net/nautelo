"""Owner-initiated pause/resume (customer feedback, 2026-09-25).

Distinct from delete: a paused listing stays visible on the owner's own
dashboard, drops out of every public read path, and can be resumed back to
PUBLISHED. Distinct from staff suspend: never touches the staff moderation
queue.
"""

import itertools

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from listings.drafts import InvalidWorkflowState
from listings.enums import ListingStatus, MediaStatus, MediaType
from listings.pausing import pause_listing, resume_listing
from listings.staff_queue import queue_rows
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


def test_pause_listing_moves_a_published_listing_to_paused():
    owner = _owner()
    listing = _published(owner)

    pause_listing(listing=listing, actor=owner, expected_version=listing.version)

    listing.refresh_from_db()
    assert listing.status == ListingStatus.PAUSED


def test_resume_listing_moves_a_paused_listing_back_to_published():
    owner = _owner()
    listing = _published(owner)
    pause_listing(listing=listing, actor=owner, expected_version=listing.version)
    listing.refresh_from_db()

    resume_listing(listing=listing, actor=owner, expected_version=listing.version)

    listing.refresh_from_db()
    assert listing.status == ListingStatus.PUBLISHED


def test_pausing_a_draft_listing_is_refused():
    owner = _owner()
    listing = make_private_listing(owner=owner)

    with pytest.raises(InvalidWorkflowState):
        pause_listing(listing=listing, actor=owner, expected_version=listing.version)


def test_a_paused_listing_stays_on_the_owners_dashboard():
    owner = _owner()
    listing = _published(owner)
    pause_listing(listing=listing, actor=owner, expected_version=listing.version)

    rows = _client(owner).get(reverse("my-listings")).data

    assert len(rows) == 1
    assert rows[0]["status"] == ListingStatus.PAUSED


def test_a_paused_listing_disappears_from_every_public_path():
    owner = _owner()
    listing = _published(owner)
    api = APIClient()
    assert api.get(reverse("listing-detail", kwargs={"listing_id": listing.pk})).status_code == 200

    pause_listing(listing=listing, actor=owner, expected_version=listing.version)

    detail = api.get(reverse("listing-detail", kwargs={"listing_id": listing.pk}))
    assert detail.status_code == 404
    listed_ids = [row["id"] for row in api.get(reverse("listing-list")).data["results"]]
    assert str(listing.pk) not in listed_ids


def test_a_paused_listing_never_appears_in_the_staff_suspended_queue():
    owner = _owner()
    listing = _published(owner)
    pause_listing(listing=listing, actor=owner, expected_version=listing.version)

    _, counts = queue_rows(tab="suspended")

    assert counts["suspended"] == 0


def test_pause_endpoint_requires_the_owner():
    owner = _owner()
    other = _owner()
    listing = _published(owner)
    url = reverse("listing-pause", kwargs={"listing_id": listing.pk})

    response = _client(other).post(url, {"version": listing.version}, format="json")

    assert response.status_code in (403, 404)
    listing.refresh_from_db()
    assert listing.status == ListingStatus.PUBLISHED


def test_pause_and_resume_endpoints_round_trip():
    owner = _owner()
    listing = _published(owner)
    pause_url = reverse("listing-pause", kwargs={"listing_id": listing.pk})

    pause_response = _client(owner).post(pause_url, {"version": listing.version}, format="json")
    assert pause_response.status_code == 200
    assert pause_response.data["status"] == ListingStatus.PAUSED

    listing.refresh_from_db()
    resume_url = reverse("listing-resume", kwargs={"listing_id": listing.pk})
    resume_response = _client(owner).post(resume_url, {"version": listing.version}, format="json")
    assert resume_response.status_code == 200
    assert resume_response.data["status"] == ListingStatus.PUBLISHED
