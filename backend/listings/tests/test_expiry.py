"""Spec §22.5's daily expiry task."""

from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from audit.models import AuditEvent
from entitlements.tests.factories import make_private_seller
from listings.enums import ListingStatus
from listings.expiry import (
    EXPIRY_REMINDER_DAYS,
    expire_due_listings,
    send_expiry_reminders,
)
from listings.models import BoatListing
from listings.signals import listing_expired, listing_expiring
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


@pytest.fixture
def expiring_receiver():
    received = []

    def _receiver(sender, listing, threshold_days, **kwargs):
        received.append((listing.pk, threshold_days))

    listing_expiring.connect(_receiver)
    yield received
    listing_expiring.disconnect(_receiver)


def test_the_default_thresholds_are_the_spec_22_5_defaults():
    assert EXPIRY_REMINDER_DAYS == (7, 1)


@pytest.mark.django_db
def test_a_listing_seven_days_out_gets_one_reminder(expiring_receiver):
    now = timezone.now()
    soon = make_private_listing(
        owner=make_private_seller(),
        status=ListingStatus.PUBLISHED,
        expires_at=now + timedelta(days=6, hours=12),
    )

    assert send_expiry_reminders(now=now) == {7: 1, 1: 0}
    assert expiring_receiver == [(soon.pk, 7)]


@pytest.mark.django_db
def test_a_listing_one_day_out_gets_the_one_day_reminder(expiring_receiver):
    now = timezone.now()
    soon = make_private_listing(
        owner=make_private_seller(),
        status=ListingStatus.PUBLISHED,
        expires_at=now + timedelta(hours=10),
    )

    assert send_expiry_reminders(now=now) == {7: 0, 1: 1}
    assert expiring_receiver == [(soon.pk, 1)]


@pytest.mark.django_db
def test_a_daily_cadence_fires_each_threshold_at_most_once(expiring_receiver):
    """Spec §27.1's deduplication key is "listing + threshold". With no
    Notification table yet (Phase 18), the window arithmetic is what keeps a
    daily run from re-firing the same reminder: each threshold's window is
    exactly one day wide, half-open, and the two do not overlap."""
    now = timezone.now()
    listing = make_private_listing(
        owner=make_private_seller(),
        status=ListingStatus.PUBLISHED,
        expires_at=now + timedelta(days=9, hours=1),
    )

    for day in range(10):
        send_expiry_reminders(now=now + timedelta(days=day))

    fired = [threshold for pk, threshold in expiring_receiver if pk == listing.pk]
    assert sorted(fired) == [1, 7]


@pytest.mark.django_db
def test_a_listing_that_is_not_published_is_never_reminded(expiring_receiver):
    owner = make_private_seller()
    now = timezone.now()
    make_private_listing(
        owner=owner,
        status=ListingStatus.SUSPENDED,
        expires_at=now + timedelta(days=6, hours=12),
    )
    make_private_listing(
        owner=owner,
        brand=make_brand("Other Brand"),
        status=ListingStatus.PUBLISHED,
        expires_at=None,
    )

    assert send_expiry_reminders(now=now) == {7: 0, 1: 0}
    assert expiring_receiver == []


@pytest.mark.django_db
def test_an_already_due_listing_is_expired_not_reminded(expiring_receiver):
    now = timezone.now()
    make_private_listing(
        owner=make_private_seller(),
        status=ListingStatus.PUBLISHED,
        expires_at=now - timedelta(hours=1),
    )

    assert send_expiry_reminders(now=now) == {7: 0, 1: 0}
    assert expiring_receiver == []
