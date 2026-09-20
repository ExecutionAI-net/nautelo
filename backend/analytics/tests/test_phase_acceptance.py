"""Spec §19's Acceptance tests, spec §40 Scenario E and spec §36.2's view rules.

Each test below names the requirement it proves. Nothing here calls a service
directly: the definition of done for this phase is a statement about the API and
the database, so every view goes through GET /api/v1/listings/<id>/.
"""

import pytest
from django.contrib.auth.models import Group
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from analytics.models import ListingView
from analytics.tasks import reconcile_listing_view_counts
from brokers.tests.factories import make_broker, make_membership
from listings.enums import ListingStatus
from listings.models import BoatListing
from listings.tests.factories import (
    make_broker_listing,
    make_private_listing,
    make_snapshot,
)

pytestmark = pytest.mark.django_db

CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/141.0.0.0 Safari/537.36"


def _client(remote_addr="198.51.100.9", user_agent=CHROME):
    """A distinct client per simulated viewer: same address unless stated."""
    return APIClient(HTTP_USER_AGENT=user_agent, REMOTE_ADDR=remote_addr)


def _publish(listing, approver):
    listing.status = ListingStatus.PUBLISHED
    listing.current_public_snapshot = make_snapshot(listing, approved_by=approver)
    listing.save(update_fields=["status", "current_public_snapshot", "updated_at"])
    return listing


@pytest.fixture
def owner():
    return make_user("owner@example.com", role=UserRole.PRIVATE_SELLER)


@pytest.fixture
def listing(owner):
    return _publish(make_private_listing(owner=owner), owner)


def _url(listing):
    return reverse("listing-detail", kwargs={"listing_id": listing.pk})


def _count(listing):
    return BoatListing.objects.values_list("view_count_cached", flat=True).get(
        pk=listing.pk
    )


def _signed_in(user, remote_addr="198.51.100.9"):
    client = _client(remote_addr=remote_addr)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {AccessToken.for_user(user)}")
    return client


@pytest.fixture(autouse=True)
def _no_proxies(settings):
    settings.TRUSTED_PROXY_COUNT = 0


# --- spec §19 Acceptance tests -----------------------------------------------


def test_acceptance_1_first_eligible_view_increments_from_zero_to_one(
    listing, view_counting_enabled
):
    assert _count(listing) == 0

    response = _client().get(_url(listing))

    assert response.status_code == 200
    assert _count(listing) == 1
    assert response.data["view_count"] == 1


def test_acceptance_2_repeat_views_from_the_same_identity_remain_one(
    listing, view_counting_enabled
):
    client = _client()

    for _ in range(5):
        client.get(_url(listing))

    assert _count(listing) == 1
    assert ListingView.objects.count() == 1


def test_acceptance_3_two_authenticated_users_count_as_two(
    listing, view_counting_enabled
):
    first = make_user("buyer-one@example.com", role=UserRole.PRIVATE_SELLER)
    second = make_user("buyer-two@example.com", role=UserRole.PRIVATE_SELLER)

    _signed_in(first).get(_url(listing))
    _signed_in(second).get(_url(listing))
    _signed_in(first).get(_url(listing))

    assert _count(listing) == 2


def test_acceptance_4_owner_staff_and_bot_do_not_count(listing, view_counting_enabled):
    moderator = make_user("mod@example.com", role=UserRole.STAFF)
    moderator.groups.add(Group.objects.get(name=StaffGroup.MODERATOR))
    staff_admin = make_user("admin@example.com", role=UserRole.STAFF)
    staff_admin.groups.add(Group.objects.get(name=StaffGroup.ADMIN))

    _signed_in(listing.owner_user).get(_url(listing))
    _signed_in(moderator).get(_url(listing))
    _signed_in(staff_admin).get(_url(listing))
    _client(user_agent="Googlebot/2.1").get(_url(listing))
    _client(user_agent="facebookexternalhit/1.1").get(_url(listing))
    _client().head(_url(listing))
    _client().get(_url(listing), HTTP_SEC_PURPOSE="prefetch")

    assert _count(listing) == 0
    assert ListingView.objects.count() == 0


def test_acceptance_4b_a_broker_colleague_does_not_count_either(view_counting_enabled):
    """Spec §19.1's second exclusion, which the five-line acceptance list folds
    into "owner" but §19.1 states separately."""
    agent = make_user("agent@example.com", role=UserRole.BROKER)
    colleague = make_user("colleague@example.com", role=UserRole.BROKER)
    broker = make_broker()
    make_membership(agent, broker, can_edit_listings=True)
    make_membership(colleague, broker, can_edit_listings=False)
    listing = _publish(make_broker_listing(broker=broker, actor=agent), agent)

    _signed_in(agent).get(_url(listing))
    _signed_in(colleague).get(_url(listing))

    assert _count(listing) == 0


def test_acceptance_5_concurrent_identical_requests_produce_one_row_and_one_increment(
    listing, view_counting_enabled
):
    """Spec §19's acceptance test 5, realised deterministically.

    Two real DB connections racing inside pytest-django is fragile and would end
    up proving Postgres' unique index rather than the application's handling of
    it — the same reasoning Phase 11's Task 15 recorded for spec §34.2. The
    equivalent that exercises the exact branch: a second identical request
    arrives when the first has already committed its row, which is precisely what
    the loser of a race observes. The unique index is the serialisation in both
    cases; only the interleaving is simulated.
    """
    first = _client()
    second = _client()  # same address, same user agent: one identity

    first.get(_url(listing))
    response = second.get(_url(listing))

    assert response.status_code == 200
    assert ListingView.objects.count() == 1
    assert _count(listing) == 1
    assert response.data["view_count"] == 1


# --- spec §40 Scenario E -----------------------------------------------------


def test_scenario_e_one_view_is_stored_and_insiders_add_none(
    listing, view_counting_enabled
):
    """Spec §40 Scenario E: "Given a published listing with zero views, when an
    eligible anonymous IP loads it repeatedly, then one view is stored/count
    shown; owner, staff and bot loads add none.\""""
    anonymous = _client()
    staff = make_user("staff@example.com", role=UserRole.STAFF)

    for _ in range(4):
        anonymous.get(_url(listing))
    _signed_in(listing.owner_user).get(_url(listing))
    _signed_in(staff).get(_url(listing))
    _client(user_agent="AhrefsBot/7.0").get(_url(listing))

    assert ListingView.objects.count() == 1
    assert _count(listing) == 1
    assert anonymous.get(_url(listing)).data["view_count"] == 1


# --- spec §36.2 operational rules --------------------------------------------


def test_36_2_republishing_after_expiry_does_not_reset_the_lifetime_count(
    listing, view_counting_enabled
):
    """Spec §36.2: "Republishing the same listing after expiration does not reset
    lifetime unique count." """
    _client().get(_url(listing))
    _client(remote_addr="203.0.113.5").get(_url(listing))
    assert _count(listing) == 2

    # Expire, then republish. (Phase 13 owns the real expiry task; the state
    # change is what matters here, and this test drives it directly rather than
    # inventing a service Phase 10 does not own.)
    BoatListing.objects.filter(pk=listing.pk).update(status=ListingStatus.EXPIRED)
    assert _client(remote_addr="203.0.113.6").get(_url(listing)).status_code == 404
    BoatListing.objects.filter(pk=listing.pk).update(
        status=ListingStatus.PUBLISHED, published_at=timezone.now()
    )

    assert _count(listing) == 2
    assert ListingView.objects.count() == 2
    # The original viewers are still remembered: returning does not re-count them.
    _client().get(_url(listing))
    assert _count(listing) == 2


def test_36_2_identity_is_by_listing_id_so_nothing_a_seller_edits_can_reset_it(
    listing, owner, view_counting_enabled
):
    """Spec §36.2: "Changing a listing slug does not reset views because identity
    uses listing ID." No slug field exists yet (Phase 20/21 — Phase 11's Known
    Limitation 6), so the property is proved at its root: a new approved snapshot
    replaces every piece of public content and the count is untouched."""
    _client().get(_url(listing))
    assert _count(listing) == 1

    next_snapshot = make_snapshot(
        listing, approved_by=owner, version=2, title_en="Renamed entirely"
    )
    listing.current_public_snapshot = next_snapshot
    listing.save(update_fields=["current_public_snapshot", "updated_at"])

    response = _client().get(_url(listing))
    assert response.data["snapshot_version"] == 2
    assert response.data["view_count"] == 1
    assert _count(listing) == 1


def test_a_suspended_listing_is_absent_publicly_and_records_nothing(
    listing, view_counting_enabled
):
    BoatListing.objects.filter(pk=listing.pk).update(status=ListingStatus.SUSPENDED)

    assert _client().get(_url(listing)).status_code == 404
    assert ListingView.objects.count() == 0


# --- spec §19.3 step 5 end to end --------------------------------------------


def test_reconciliation_restores_a_count_that_was_tampered_with(
    listing, view_counting_enabled
):
    _client().get(_url(listing))
    _client(remote_addr="203.0.113.5").get(_url(listing))
    BoatListing.objects.filter(pk=listing.pk).update(view_count_cached=999)

    report = reconcile_listing_view_counts()

    assert _count(listing) == 2
    assert report["corrected"] == 1


# --- spec §34.7 release-checklist line ---------------------------------------


def test_the_public_payload_carries_the_aggregate_and_nothing_else_about_viewers(
    listing, view_counting_enabled
):
    """Spec §29.1 requires "Unique view count" on the card and forbids
    "Hard-coded view counts"; spec §19.4 forbids exposing viewer identities.

    The list and detail endpoints must agree, because spec §29.1 also says
    "Every boat card uses one component and one API representation.\""""
    buyer = make_user("buyer@example.com", role=UserRole.PRIVATE_SELLER)
    _signed_in(buyer).get(_url(listing))
    _client().get(_url(listing))

    detail = _client().get(_url(listing))
    listing_page = _client().get(reverse("listing-list"))
    card = listing_page.data["results"][0]

    assert detail.data["view_count"] == 2
    assert card["view_count"] == 2
    assert set(detail.data) == set(card)
    body = listing_page.content.decode()
    assert str(buyer.pk) not in body
    assert buyer.email not in body
