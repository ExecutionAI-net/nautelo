"""Spec §22.5's daily expiry task."""

from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from audit.models import AuditEvent
from entitlements.tests.factories import make_private_seller
from listings.enums import ListingStatus
from listings.expiry import expire_due_listings
from listings.models import BoatListing
from listings.signals import listing_expired
from listings.tests.factories import make_brand, make_private_listing


def _published(owner, *, expires_in_days):
    now = timezone.now()
    return make_private_listing(
        owner=owner,
        status=ListingStatus.PUBLISHED,
        published_at=now - timedelta(days=1),
        expires_at=now + timedelta(days=expires_in_days),
    )


@pytest.mark.django_db
def test_a_due_listing_becomes_expired():
    due = _published(make_private_seller(), expires_in_days=-1)

    assert expire_due_listings() == 1

    due.refresh_from_db()
    assert due.status == ListingStatus.EXPIRED


@pytest.mark.django_db
def test_a_listing_that_is_not_due_yet_is_untouched():
    future = _published(make_private_seller(), expires_in_days=5)
    version_before = future.version

    assert expire_due_listings() == 0

    future.refresh_from_db()
    assert future.status == ListingStatus.PUBLISHED
    assert future.version == version_before


@pytest.mark.django_db
def test_a_listing_with_no_expiry_is_never_expired():
    """Broker listings have no configured window in this release (spec §21), so
    `expires_at` is NULL and must not be read as "already due"."""
    forever = make_private_listing(
        owner=make_private_seller(), status=ListingStatus.PUBLISHED, expires_at=None
    )

    assert expire_due_listings() == 0

    forever.refresh_from_db()
    assert forever.status == ListingStatus.PUBLISHED


@pytest.mark.django_db
def test_only_published_listings_expire():
    """Spec §6.1 has no SUSPENDED -> EXPIRED edge, and an EXPIRED listing must
    not be expired twice."""
    owner = make_private_seller()
    now = timezone.now()
    suspended = make_private_listing(
        owner=owner, status=ListingStatus.SUSPENDED, expires_at=now - timedelta(days=2)
    )
    already = make_private_listing(
        owner=owner,
        brand=make_brand("Second Brand"),
        status=ListingStatus.EXPIRED,
        expires_at=now - timedelta(days=2),
    )

    assert expire_due_listings() == 0

    suspended.refresh_from_db()
    already.refresh_from_db()
    assert suspended.status == ListingStatus.SUSPENDED
    assert already.status == ListingStatus.EXPIRED


@pytest.mark.django_db
def test_expiry_is_idempotent_across_two_runs():
    _published(make_private_seller(), expires_in_days=-1)

    assert expire_due_listings() == 1
    assert expire_due_listings() == 0
    assert AuditEvent.objects.filter(action="listing.expired").count() == 1


@pytest.mark.django_db
def test_expiry_writes_a_system_audit_event():
    due = _published(make_private_seller(), expires_in_days=-1)

    expire_due_listings()

    event = AuditEvent.objects.get(action="listing.expired")
    assert event.target_id == str(due.pk)
    assert event.actor_user is None
    assert event.actor_type == AuditEvent.ActorType.SYSTEM
    assert event.source == AuditEvent.Source.TASK
    assert event.before["listing_status"] == ListingStatus.PUBLISHED
    assert event.after["listing_status"] == ListingStatus.EXPIRED


@pytest.mark.django_db(transaction=True)
def test_the_expired_signal_fires_after_commit():
    due = _published(make_private_seller(), expires_in_days=-1)
    received = []

    def _receiver(sender, listing, **kwargs):
        received.append(listing.pk)

    listing_expired.connect(_receiver)
    try:
        expire_due_listings()
    finally:
        listing_expired.disconnect(_receiver)

    assert received == [due.pk]


@pytest.mark.django_db
def test_an_expired_listing_disappears_from_the_public_api(
    published_listing_with_snapshot,
):
    """Spec §22.5: expired listings are "removed from public search/sitemap" —
    which listings.views.published_listings_queryset already implements, because
    it filters on status=PUBLISHED. This proves it end to end rather than
    re-deriving the filter (Phase 11 contract rule 1)."""
    listing = published_listing_with_snapshot
    api = APIClient()
    detail = reverse("listing-detail", kwargs={"listing_id": listing.pk})
    assert api.get(detail).status_code == 200
    assert api.get(reverse("listing-list")).data["count"] == 1

    BoatListing.objects.filter(pk=listing.pk).update(
        expires_at=timezone.now() - timedelta(minutes=1)
    )
    expire_due_listings()

    assert api.get(detail).status_code == 404
    assert api.get(reverse("listing-list")).data["count"] == 0
