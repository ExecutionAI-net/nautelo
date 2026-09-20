"""Spec §30.1: `GET /api/v1/listings/<id>/` — "public detail and counted-view
integration". Spec §19.1: "Search-result card impressions do not count."

These go through real HTTP against the real routes, because the integration is a
statement about what the endpoint does, not about what the service can be made to
do.
"""

import pytest
from django.contrib.auth.models import Group
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from analytics.models import ListingView
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


@pytest.fixture
def api():
    client = APIClient(HTTP_USER_AGENT=CHROME, REMOTE_ADDR="198.51.100.9")
    return client


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


def _detail_url(listing):
    return reverse("listing-detail", kwargs={"listing_id": listing.pk})


def _count(listing):
    return BoatListing.objects.values_list("view_count_cached", flat=True).get(
        pk=listing.pk
    )


def _as(client, user):
    """A real Authorization header, not force_authenticate: the point of these
    tests is that the endpoint parses credentials again at all."""
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {AccessToken.for_user(user)}")
    return client


def test_a_guest_detail_read_counts_once_and_the_body_shows_it(
    api, listing, view_counting_enabled, settings
):
    settings.TRUSTED_PROXY_COUNT = 0

    response = api.get(_detail_url(listing))

    assert response.status_code == 200
    assert response.data["view_count"] == 1
    assert _count(listing) == 1


def test_repeated_reads_from_one_client_stay_at_one(
    api, listing, view_counting_enabled, settings
):
    settings.TRUSTED_PROXY_COUNT = 0
    api.get(_detail_url(listing))

    response = api.get(_detail_url(listing))

    assert response.data["view_count"] == 1
    assert ListingView.objects.count() == 1


def test_the_list_endpoint_never_counts(api, listing, view_counting_enabled, settings):
    """Spec §19.1: "Search-result card impressions do not count.\""""
    settings.TRUSTED_PROXY_COUNT = 0

    response = api.get(reverse("listing-list"))

    assert response.status_code == 200
    assert ListingView.objects.count() == 0
    assert _count(listing) == 0


def test_a_head_request_does_not_count(api, listing, view_counting_enabled, settings):
    """Spec §19.1 excludes HEAD explicitly."""
    settings.TRUSTED_PROXY_COUNT = 0

    response = api.head(_detail_url(listing))

    assert response.status_code == 200
    assert ListingView.objects.count() == 0


def test_the_signed_in_owner_does_not_count(api, listing, view_counting_enabled, settings):
    settings.TRUSTED_PROXY_COUNT = 0

    response = _as(api, listing.owner_user).get(_detail_url(listing))

    assert response.status_code == 200
    assert response.data["view_count"] == 0
    assert ListingView.objects.count() == 0


def test_a_signed_in_broker_colleague_does_not_count(api, view_counting_enabled, settings):
    settings.TRUSTED_PROXY_COUNT = 0
    agent = make_user("agent@example.com", role=UserRole.BROKER)
    broker = make_broker()
    make_membership(agent, broker)
    listing = _publish(make_broker_listing(broker=broker, actor=agent), agent)

    _as(api, agent).get(_detail_url(listing))

    assert ListingView.objects.count() == 0


def test_signed_in_staff_does_not_count(api, listing, view_counting_enabled, settings):
    settings.TRUSTED_PROXY_COUNT = 0
    staff = make_user("mod@example.com", role=UserRole.STAFF)
    staff.groups.add(Group.objects.get(name=StaffGroup.MODERATOR))

    _as(api, staff).get(_detail_url(listing))

    assert ListingView.objects.count() == 0


def test_a_signed_in_buyer_counts_as_themselves_not_as_their_ip(
    api, listing, view_counting_enabled, settings
):
    settings.TRUSTED_PROXY_COUNT = 0
    buyer = make_user("buyer@example.com", role=UserRole.PRIVATE_SELLER)

    _as(api, buyer).get(_detail_url(listing))

    view = ListingView.objects.get()
    assert view.viewer_user_id == buyer.pk
    assert view.viewer_hash is None


def test_a_bot_user_agent_does_not_count(listing, view_counting_enabled, settings):
    settings.TRUSTED_PROXY_COUNT = 0
    client = APIClient(HTTP_USER_AGENT="Googlebot/2.1", REMOTE_ADDR="198.51.100.9")

    response = client.get(_detail_url(listing))

    assert response.status_code == 200
    assert ListingView.objects.count() == 0


def test_a_prefetch_does_not_count(api, listing, view_counting_enabled, settings):
    settings.TRUSTED_PROXY_COUNT = 0

    api.get(_detail_url(listing), HTTP_SEC_PURPOSE="prefetch;prerender")

    assert ListingView.objects.count() == 0


def test_a_broken_authorization_header_still_serves_the_page_as_a_guest(
    api, listing, view_counting_enabled, settings
):
    """Phase 11's reason for dropping authentication here, preserved."""
    settings.TRUSTED_PROXY_COUNT = 0
    api.credentials(HTTP_AUTHORIZATION="Bearer not-a-token")

    response = api.get(_detail_url(listing))

    assert response.status_code == 200
    assert response.data["view_count"] == 1


def test_an_unpublished_listing_is_still_404_and_records_nothing(
    api, owner, view_counting_enabled
):
    draft = make_private_listing(owner=owner)

    response = api.get(_detail_url(draft))

    assert response.status_code == 404
    assert ListingView.objects.count() == 0


def test_nothing_is_recorded_while_the_flag_is_off(api, listing, settings):
    settings.TRUSTED_PROXY_COUNT = 0

    response = api.get(_detail_url(listing))

    assert response.status_code == 200
    assert response.data["view_count"] == 0
    assert ListingView.objects.count() == 0


def test_the_detail_response_is_never_cacheable_by_a_shared_cache(
    api, listing, view_counting_enabled, settings
):
    """Spec §36.2 anticipates CDN/page caching in front of this endpoint.

    Since Task 5 the body varies by Authorization and by client IP, so a shared
    cache storing one visitor's copy would serve that visitor's personalised
    `view_count` to everyone behind it. The header must be present on every
    response, counted or not — a response that is only sometimes uncacheable is
    a response whose cacheable copy gets stored and replayed.
    """
    settings.TRUSTED_PROXY_COUNT = 0

    counted = api.get(_detail_url(listing))  # first view: increments
    repeat = api.get(_detail_url(listing))  # second view: does not

    for response in (counted, repeat):
        assert response["Cache-Control"] == "private, no-store"
        assert "Authorization" in response["Vary"]


def test_no_viewer_identity_appears_anywhere_in_the_public_payload(
    api, listing, view_counting_enabled, settings
):
    """Spec §19.4: "Never expose viewer identities to sellers; only aggregate
    count." The assertion is over the serialized bytes, not over known keys, so a
    field added later by another phase cannot smuggle one in unnoticed."""
    settings.TRUSTED_PROXY_COUNT = 0
    buyer = make_user("buyer@example.com", role=UserRole.PRIVATE_SELLER)
    _as(api, buyer).get(_detail_url(listing))
    api.credentials()

    body = api.get(_detail_url(listing)).content.decode()
    stored = ListingView.objects.exclude(viewer_hash=None).get()

    assert str(buyer.pk) not in body
    assert buyer.email not in body
    assert stored.viewer_hash not in body
    assert "viewer" not in body


def test_a_recorder_fault_never_breaks_the_public_page_and_logs_no_pii(
    api, listing, view_counting_enabled, settings, monkeypatch, caplog
):
    """The recorder propagates faults by design; containment lives in the view."""
    settings.TRUSTED_PROXY_COUNT = 0

    def boom(**kwargs):
        raise RuntimeError("boom 198.51.100.9 " + CHROME)

    monkeypatch.setattr("listings.views.record_listing_view", boom)

    with caplog.at_level("ERROR"):
        response = api.get(_detail_url(listing))

    assert response.status_code == 200
    assert response["Cache-Control"] == "private, no-store"
    logged = " ".join(r.getMessage() for r in caplog.records)
    assert str(listing.pk) in logged
    assert "RuntimeError" in logged
    assert "198.51.100.9" not in logged
    assert "Chrome" not in logged
    assert "boom" not in logged
