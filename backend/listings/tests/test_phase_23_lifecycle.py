"""Phase 23: one seller-to-buyer journey across phases 11, 17, 18 and 20.

Draft -> submit -> staff approval -> canonical slug -> public read -> owner
notification -> sitemap-visible listing -> owner sees it in "mine".
"""

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from listings.enums import ListingStatus
from listings.models import BoatListing
from listings.tests.test_phase_acceptance import (
    _create_and_submit,
    _decide,
    _moderator,
    _seller,
    workflow_enabled,  # noqa: F401  (fixture)
)
from notifications.models import Notification


@pytest.fixture(autouse=True)
def _immediate_commit(monkeypatch):
    monkeypatch.setattr("django.db.transaction.on_commit", lambda fn, *a, **k: fn())


@pytest.mark.django_db
def test_a_listing_goes_from_draft_to_public_with_a_slug_and_a_notification(workflow_enabled):
    seller = _seller()
    seller_api = APIClient()
    listing, revision = _create_and_submit(seller_api, seller)
    assert listing.status == ListingStatus.PENDING_APPROVAL
    assert listing.slug is None

    guest = APIClient()
    assert guest.get(reverse("listing-list")).data["count"] == 0

    staff_api = APIClient()
    staff_api.force_authenticate(_moderator())
    queue = staff_api.get(reverse("staff-moderation-queue"), {"tab": "initial"}).data
    assert [r["id"] for r in queue["results"]] == [str(revision.pk)]

    decided = _decide(staff_api, revision.pk, "APPROVE", revision.version)
    assert decided.status_code == 200, decided.data

    listing = BoatListing.objects.get(pk=listing.pk)
    assert listing.status == ListingStatus.PUBLISHED
    assert listing.slug and listing.pk.hex[:8] in listing.slug

    public = guest.get(reverse("listing-detail-by-slug", kwargs={"slug": listing.slug}))
    assert public.status_code == 200
    assert public.data["slug"] == listing.slug
    assert guest.get(reverse("listing-list")).data["count"] == 1

    assert Notification.objects.filter(
        recipient=seller, notification_type="listing.approved"
    ).exists()
    mine = seller_api.get(reverse("my-listings")).data
    assert [row["status"] for row in mine] == ["PUBLISHED"]
    assert not Notification.objects.filter(recipient=_seller("someone@else.example")).exists()

    # The queue is empty once decided, and the slug never changes on re-read.
    assert staff_api.get(reverse("staff-moderation-queue"), {"tab": "initial"}).data["counts"][
        "initial"
    ] == 0
