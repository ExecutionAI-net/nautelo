"""Spec §19.3 step 5: "Provide a reconciliation task that recomputes cached
counts from rows." Spec §35.2 step 3: "Run bounded backfills and reconciliation."
"""

import itertools

import pytest
from django.core.management import call_command

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from analytics.tasks import reconcile_listing_view_counts
from analytics.tests.factories import fake_hash, make_anonymous_view, make_user_view
from audit.models import AuditEvent
from listings.models import BoatListing
from listings.tests.factories import make_brand, make_private_listing

pytestmark = pytest.mark.django_db


@pytest.fixture
def owner():
    return make_user("owner@example.com", role=UserRole.PRIVATE_SELLER)


_brands = itertools.count()


def _listing(owner, cached=0):
    # make_private_listing derives its brand from the owner, so several listings
    # of one owner would collide on the unique brand name.
    listing = make_private_listing(owner=owner, brand=make_brand(f"Brand {next(_brands)}"))
    BoatListing.objects.filter(pk=listing.pk).update(view_count_cached=cached)
    listing.refresh_from_db(fields=["view_count_cached"])
    return listing


def _count(listing):
    return BoatListing.objects.values_list("view_count_cached", flat=True).get(
        pk=listing.pk
    )


def test_a_cached_count_that_is_too_low_is_raised_to_the_row_count(owner):
    listing = _listing(owner, cached=0)
    make_anonymous_view(listing, viewer_hash=fake_hash("a"))
    make_anonymous_view(listing, viewer_hash=fake_hash("b"))
    make_user_view(listing, user=make_user("buyer@example.com", role=UserRole.BUYER))

    report = reconcile_listing_view_counts()

    assert _count(listing) == 3
    assert report["corrected"] == 1
    assert report["drift"] == 3


def test_a_cached_count_that_is_too_high_is_lowered(owner):
    """This is the account-erasure case: CASCADE removed a viewer's rows and the
    cached number is now an overcount. See the plan's ruling."""
    listing = _listing(owner, cached=9)
    make_anonymous_view(listing, viewer_hash=fake_hash("a"))

    reconcile_listing_view_counts()

    assert _count(listing) == 1


def test_a_listing_with_no_views_is_reconciled_to_zero(owner):
    listing = _listing(owner, cached=4)

    reconcile_listing_view_counts()

    assert _count(listing) == 0


def test_a_correct_count_is_left_alone_and_writes_no_audit_event(owner):
    listing = _listing(owner, cached=1)
    make_anonymous_view(listing, viewer_hash=fake_hash("a"))
    before = AuditEvent.objects.count()

    report = reconcile_listing_view_counts()

    assert _count(listing) == 1
    assert report["checked"] == 1
    assert report["corrected"] == 0
    assert AuditEvent.objects.count() == before


def test_running_it_twice_changes_nothing_the_second_time(owner):
    listing = _listing(owner, cached=0)
    make_anonymous_view(listing, viewer_hash=fake_hash("a"))

    reconcile_listing_view_counts()
    second = reconcile_listing_view_counts()

    assert second["corrected"] == 0
    assert _count(listing) == 1


def test_every_correction_is_audited_with_the_before_and_after(owner):
    listing = _listing(owner, cached=7)
    make_anonymous_view(listing, viewer_hash=fake_hash("a"))

    reconcile_listing_view_counts()

    event = AuditEvent.objects.get(action="listing.view_count_reconciled")
    assert event.target_type == "listings.BoatListing"
    assert event.target_id == str(listing.pk)
    assert event.actor_user is None
    assert event.actor_type == AuditEvent.ActorType.SYSTEM
    assert event.source == AuditEvent.Source.TASK
    assert event.before == {"view_count_cached": 7}
    assert event.after == {"view_count_cached": 1}


def test_it_can_be_limited_to_named_listings(owner):
    target = _listing(owner, cached=5)
    untouched = _listing(owner, cached=5)

    report = reconcile_listing_view_counts(listing_ids=[target.pk])

    assert report["checked"] == 1
    assert _count(target) == 0
    assert _count(untouched) == 5


def test_it_processes_every_listing_across_batch_boundaries(owner):
    listings = [_listing(owner, cached=3) for _ in range(5)]

    report = reconcile_listing_view_counts(batch_size=2)

    assert report["checked"] == 5
    assert report["corrected"] == 5
    assert all(_count(listing) == 0 for listing in listings)


def test_the_management_command_runs_the_same_task(owner, capsys):
    listing = _listing(owner, cached=6)
    make_anonymous_view(listing, viewer_hash=fake_hash("a"))

    call_command("reconcile_listing_views", "--batch-size", "2")

    assert _count(listing) == 1
    assert "corrected=1" in capsys.readouterr().out


def test_the_management_command_accepts_specific_listing_ids(owner):
    target = _listing(owner, cached=5)
    untouched = _listing(owner, cached=5)

    call_command("reconcile_listing_views", "--listing-id", str(target.pk))

    assert _count(target) == 0
    assert _count(untouched) == 5
