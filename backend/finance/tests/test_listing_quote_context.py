"""Spec §17.4 context 1: a quote for a listing (added by Phase 9).

Spec §18.3: "The finance page treats `listing` as the authority and ignores
tampered price parameters."
"""

import itertools
from decimal import Decimal

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from brokers.tests.factories import make_broker
from listings.enums import ListingStatus
from listings.tests.factories import (
    make_broker_listing,
    make_private_listing,
    make_snapshot,
)
from platform_settings.services import set_feature_flag, update_setting

_names = itertools.count()
QUOTE_URL = reverse("finance-quote")


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def estimates_on(db):
    set_feature_flag(key="finance_estimates", is_enabled=True, actor=None)


def _staff():
    return make_user(
        email=f"moderator-{next(_names)}@example.com",
        role=UserRole.STAFF,
        verified=True,
    )


def _publish(listing, **snapshot_kwargs):
    snapshot = make_snapshot(listing, approved_by=_staff(), **snapshot_kwargs)
    listing.status = ListingStatus.PUBLISHED
    listing.current_public_snapshot = snapshot
    listing.published_at = timezone.now()
    listing.save(
        update_fields=["status", "current_public_snapshot", "published_at"]
    )
    return listing


def _broker_listing(**kwargs):
    index = next(_names)
    agent = make_user(
        email=f"agent-{index}@example.com", role=UserRole.BROKER, verified=True
    )
    return make_broker_listing(
        broker=make_broker(name=f"Broker {index}", slug=f"broker-{index}"),
        actor=agent,
        price=Decimal("459000.00"),
        **kwargs,
    )


@pytest.fixture
def eligible(estimates_on):
    return _publish(_broker_listing(show_finance_estimate=True))


@pytest.mark.django_db
def test_a_listing_quote_needs_nothing_but_the_listing_id(api, eligible):
    """Spec §40 Scenario C, through the endpoint the finance page calls."""
    response = api.post(QUOTE_URL, {"listing_id": str(eligible.pk)}, format="json")

    assert response.status_code == 200
    assert response.data["price"] == "459000.00"
    assert response.data["currency"] == "EUR"
    assert response.data["down_payment_amount"] == "91800.00"
    assert response.data["principal"] == "367200.00"
    assert response.data["monthly_payment"] == "8456.36"
    assert response.data["term_months"] == 48
    assert response.data["annual_rate_percent"] == "5.0000"
    assert response.data["configuration_version"] == 1
    assert response.data["disclaimer_key"] == "finance.illustrative_disclaimer"
    assert response.data["assumption_sources"] == {
        "annual_rate_percent": "GLOBAL",
        "term_months": "GLOBAL",
        "down_payment_percent": "GLOBAL",
    }


@pytest.mark.django_db
def test_a_matching_client_price_is_accepted_and_the_server_value_is_returned(
    api, eligible
):
    response = api.post(
        QUOTE_URL,
        {"listing_id": str(eligible.pk), "price": "459000.00"},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["price"] == "459000.00"


@pytest.mark.django_db
def test_a_tampered_price_is_refused_rather_than_silently_replaced(api, eligible):
    """Spec §17.4: "a client-supplied price must either be omitted or match"."""
    response = api.post(
        QUOTE_URL,
        {"listing_id": str(eligible.pk), "price": "1.00"},
        format="json",
    )

    assert response.status_code == 400
    assert response.data["error"]["code"] == "price_mismatch"
    assert "1.00" not in str(response.data["error"].get("fields", {}).get("price", ""))


@pytest.mark.django_db
def test_an_unpublished_listing_is_not_found(api, estimates_on):
    listing = _broker_listing(show_finance_estimate=True)

    response = api.post(QUOTE_URL, {"listing_id": str(listing.pk)}, format="json")

    assert response.status_code == 404
    assert response.data["error"]["code"] == "listing_not_found"


@pytest.mark.django_db
def test_an_unknown_listing_is_not_found(api, estimates_on):
    response = api.post(
        QUOTE_URL,
        {"listing_id": "00000000-0000-4000-8000-000000000000"},
        format="json",
    )

    assert response.status_code == 404
    assert response.data["error"]["code"] == "listing_not_found"


@pytest.mark.django_db
def test_a_private_listing_is_refused(api, estimates_on):
    """Spec §40 Scenario D: public finance is not visible for a private seller,
    on every surface, including this one."""
    owner = make_user(
        email=f"seller-{next(_names)}@example.com",
        role=UserRole.PRIVATE_SELLER,
        verified=True,
    )
    listing = _publish(make_private_listing(owner=owner, price=Decimal("459000.00")))

    response = api.post(QUOTE_URL, {"listing_id": str(listing.pk)}, format="json")

    assert response.status_code == 400
    assert response.data["error"]["code"] == "finance_not_available_for_listing"


@pytest.mark.django_db
def test_a_broker_listing_with_the_toggle_off_is_refused(api, estimates_on):
    listing = _publish(_broker_listing(show_finance_estimate=False))

    response = api.post(QUOTE_URL, {"listing_id": str(listing.pk)}, format="json")

    assert response.status_code == 400
    assert response.data["error"]["code"] == "finance_not_available_for_listing"


@pytest.mark.django_db
def test_exploring_a_different_term_keeps_the_server_price_and_marks_the_source(
    api, eligible
):
    """Spec §36.1: the finance page may explore alternative values."""
    response = api.post(
        QUOTE_URL,
        {"listing_id": str(eligible.pk), "term_months": 60},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["term_months"] == 60
    assert response.data["price"] == "459000.00"
    assert response.data["assumption_sources"] == {
        "annual_rate_percent": "GLOBAL",
        "term_months": "REQUESTED",
        "down_payment_percent": "GLOBAL",
    }


@pytest.mark.django_db
def test_a_listing_override_is_reported_as_such(api, estimates_on):
    listing = _publish(
        _broker_listing(
            show_finance_estimate=True,
            finance_rate_override_percent=Decimal("3.5000"),
        )
    )

    response = api.post(QUOTE_URL, {"listing_id": str(listing.pk)}, format="json")

    assert response.data["annual_rate_percent"] == "3.5000"
    assert response.data["assumption_sources"]["annual_rate_percent"] == (
        "LISTING_OVERRIDE"
    )


@pytest.mark.django_db
def test_a_manual_quote_is_unchanged_by_this_phase(api):
    """Phase 8's context 2 keeps its exact behaviour: every field required, the
    same numbers, no configuration version and no platform assumption source.

    Note the shape: `assumption_sources` is *present and null*, not absent —
    both contexts share one response shape (see Task 5's ruling). This is the
    assertion that pins it, and it is why finance/tests/test_views.py's
    exact-dict test gains the same key in this commit.
    """
    response = api.post(
        QUOTE_URL,
        {
            "price": "248000.00",
            "down_payment_percent": "20.0000",
            "annual_rate_percent": "5.0000",
            "term_months": 48,
            "currency": "EUR",
        },
        format="json",
    )

    assert response.status_code == 200
    assert response.data["monthly_payment"] == "4569.01"
    assert response.data["configuration_version"] is None
    assert response.data["assumption_sources"] is None


@pytest.mark.django_db
def test_a_manual_quote_still_requires_every_field(api):
    response = api.post(QUOTE_URL, {"price": "248000.00"}, format="json")

    assert response.status_code == 400
    assert response.data["error"]["code"] == "validation_error"
    assert response.data["error"]["fields"]["term_months"][0].code == "required"


# --- adversarial additions (public, unauthenticated endpoint) ---------------


def _unknown_body(api):
    response = api.post(
        QUOTE_URL,
        {"listing_id": "00000000-0000-4000-8000-000000000000"},
        format="json",
    )
    return response.status_code, response.data


@pytest.mark.django_db
@pytest.mark.parametrize(
    "status",
    [
        ListingStatus.DRAFT,
        ListingStatus.PENDING_APPROVAL,
        ListingStatus.REJECTED,
        ListingStatus.SUSPENDED,
        ListingStatus.EXPIRED,
        ListingStatus.ARCHIVED,
    ],
)
def test_every_non_public_status_is_indistinguishable_from_a_missing_listing(
    api, estimates_on, status
):
    listing = _publish(_broker_listing(show_finance_estimate=True))
    type(listing).objects.filter(pk=listing.pk).update(status=status)

    response = api.post(QUOTE_URL, {"listing_id": str(listing.pk)}, format="json")

    assert (response.status_code, response.data) == _unknown_body(api)


@pytest.mark.django_db
def test_a_published_row_without_a_snapshot_is_indistinguishable_from_missing(
    api, estimates_on
):
    listing = _publish(_broker_listing(show_finance_estimate=True))
    type(listing).objects.filter(pk=listing.pk).update(current_public_snapshot=None)

    response = api.post(QUOTE_URL, {"listing_id": str(listing.pk)}, format="json")

    assert (response.status_code, response.data) == _unknown_body(api)


@pytest.mark.django_db
def test_a_wrong_price_on_a_non_public_listing_is_still_just_not_found(
    api, estimates_on
):
    """No price_mismatch oracle for listings the viewer may not know exist."""
    listing = _broker_listing(show_finance_estimate=True)

    response = api.post(
        QUOTE_URL,
        {"listing_id": str(listing.pk), "price": "1.00"},
        format="json",
    )

    assert response.status_code == 404
    assert response.data["error"]["code"] == "listing_not_found"


@pytest.mark.django_db
def test_price_mismatch_does_not_reveal_the_server_price(api, eligible):
    response = api.post(
        QUOTE_URL,
        {"listing_id": str(eligible.pk), "price": "1.00"},
        format="json",
    )

    assert response.status_code == 400
    assert "459000" not in str(response.data)


@pytest.mark.django_db
def test_the_quote_uses_the_published_snapshot_never_live_draft_columns(
    api, estimates_on
):
    """Mutate every draft-writable input after publication; the quote must not
    move (spec §18.3: the published snapshot is the authority)."""
    listing = _publish(
        _broker_listing(
            show_finance_estimate=True,
            finance_rate_override_percent=Decimal("3.5000"),
            finance_term_override_months=36,
            finance_down_payment_override_percent=Decimal("10.0000"),
        )
    )
    before = api.post(QUOTE_URL, {"listing_id": str(listing.pk)}, format="json")
    assert before.status_code == 200
    assert before.data["price"] == "459000.00"
    assert before.data["assumption_sources"] == {
        "annual_rate_percent": "LISTING_OVERRIDE",
        "term_months": "LISTING_OVERRIDE",
        "down_payment_percent": "LISTING_OVERRIDE",
    }

    type(listing).objects.filter(pk=listing.pk).update(
        price=Decimal("1.00"),
        currency="USD",
        show_finance_estimate=False,
        finance_rate_override_percent=Decimal("99.0000"),
        finance_term_override_months=360,
        finance_down_payment_override_percent=Decimal("50.0000"),
    )

    after = api.post(QUOTE_URL, {"listing_id": str(listing.pk)}, format="json")

    assert after.status_code == 200
    assert after.data == before.data
    # A matching price is judged against the snapshot too, not the live column.
    matching = api.post(
        QUOTE_URL,
        {"listing_id": str(listing.pk), "price": "459000.00"},
        format="json",
    )
    assert matching.status_code == 200
    stale = api.post(
        QUOTE_URL,
        {"listing_id": str(listing.pk), "price": "1.00"},
        format="json",
    )
    assert stale.data["error"]["code"] == "price_mismatch"


@pytest.mark.django_db
def test_the_snapshot_flag_not_the_live_toggle_decides_eligibility(api, estimates_on):
    listing = _publish(_broker_listing(show_finance_estimate=False))
    type(listing).objects.filter(pk=listing.pk).update(show_finance_estimate=True)

    response = api.post(QUOTE_URL, {"listing_id": str(listing.pk)}, format="json")

    assert response.status_code == 400
    assert response.data["error"]["code"] == "finance_not_available_for_listing"


@pytest.mark.django_db
def test_the_estimates_flag_off_refuses_a_listing_quote(api):
    listing = _publish(_broker_listing(show_finance_estimate=True))

    response = api.post(QUOTE_URL, {"listing_id": str(listing.pk)}, format="json")

    assert response.status_code == 400
    assert response.data["error"]["code"] == "finance_not_available_for_listing"


@pytest.mark.django_db
def test_finance_disabled_globally_refuses_a_listing_quote(api, eligible):
    update_setting(key="finance.enabled", value=False, actor=None)

    response = api.post(QUOTE_URL, {"listing_id": str(eligible.pk)}, format="json")

    assert response.status_code == 400
    assert response.data["error"]["code"] == "finance_not_available_for_listing"


@pytest.mark.django_db
def test_an_unsupported_snapshot_currency_is_not_financeable(api, estimates_on):
    listing = _publish(_broker_listing(show_finance_estimate=True), currency="USD")

    response = api.post(QUOTE_URL, {"listing_id": str(listing.pk)}, format="json")

    assert response.status_code == 400
    assert response.data["error"]["code"] == "finance_not_available_for_listing"


@pytest.mark.django_db
def test_overrides_are_ignored_when_broker_overrides_are_disabled(api, estimates_on):
    update_setting(key="finance.broker_overrides_enabled", value=False, actor=None)
    listing = _publish(
        _broker_listing(
            show_finance_estimate=True,
            finance_rate_override_percent=Decimal("3.5000"),
        )
    )

    response = api.post(QUOTE_URL, {"listing_id": str(listing.pk)}, format="json")

    assert response.data["annual_rate_percent"] == "5.0000"
    assert response.data["assumption_sources"]["annual_rate_percent"] == "GLOBAL"


@pytest.mark.django_db
def test_a_requested_value_wins_over_an_override_and_is_marked_requested(
    api, estimates_on
):
    listing = _publish(
        _broker_listing(
            show_finance_estimate=True,
            finance_rate_override_percent=Decimal("3.5000"),
        )
    )

    response = api.post(
        QUOTE_URL,
        {
            "listing_id": str(listing.pk),
            "annual_rate_percent": "7.2500",
            "down_payment_percent": "30.0000",
        },
        format="json",
    )

    assert response.status_code == 200
    assert response.data["annual_rate_percent"] == "7.2500"
    assert response.data["down_payment_amount"] == "137700.00"
    assert response.data["assumption_sources"] == {
        "annual_rate_percent": "REQUESTED",
        "term_months": "GLOBAL",
        "down_payment_percent": "REQUESTED",
    }


@pytest.mark.django_db
def test_a_client_currency_cannot_change_the_listing_currency(api, eligible):
    response = api.post(
        QUOTE_URL,
        {"listing_id": str(eligible.pk), "currency": "eur"},
        format="json",
    )
    assert response.status_code == 200
    assert response.data["currency"] == "EUR"

    bad = api.post(
        QUOTE_URL,
        {"listing_id": str(eligible.pk), "currency": "USD"},
        format="json",
    )
    assert bad.status_code == 400
    assert bad.data["error"]["code"] == "unsupported_currency"


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("field", "accepted", "rejected"),
    [
        ("term_months", 360, 361),
        ("term_months", 1, 0),
        ("down_payment_percent", "99.9900", "100.0000"),
        ("down_payment_percent", "0.0000", "-0.0001"),
        ("annual_rate_percent", "100.0000", "100.0001"),
        ("annual_rate_percent", "0.0000", "-0.0001"),
    ],
)
def test_input_bounds_accept_the_boundary_and_reject_just_beyond(
    api, eligible, field, accepted, rejected
):
    ok = api.post(
        QUOTE_URL, {"listing_id": str(eligible.pk), field: accepted}, format="json"
    )
    assert ok.status_code == 200

    bad = api.post(
        QUOTE_URL, {"listing_id": str(eligible.pk), field: rejected}, format="json"
    )
    assert bad.status_code == 400
    assert bad.data["error"]["code"] == "validation_error"
    assert field in bad.data["error"]["fields"]


@pytest.mark.django_db
def test_a_client_price_beyond_the_maximum_is_a_validation_error(api, eligible):
    ok = api.post(
        QUOTE_URL,
        {"listing_id": str(eligible.pk), "price": "459000.00"},
        format="json",
    )
    assert ok.status_code == 200

    bad = api.post(
        QUOTE_URL,
        {"listing_id": str(eligible.pk), "price": "1000000000.00"},
        format="json",
    )
    assert bad.status_code == 400
    assert bad.data["error"]["code"] == "validation_error"


@pytest.mark.django_db
def test_price_upper_bound_is_accepted_on_a_manual_quote(api):
    response = api.post(
        QUOTE_URL,
        {
            "price": "999999999.99",
            "down_payment_percent": "20.0000",
            "annual_rate_percent": "5.0000",
            "term_months": 360,
            "currency": "EUR",
        },
        format="json",
    )
    assert response.status_code == 200


@pytest.mark.django_db
def test_a_malformed_listing_id_is_a_validation_error(api, estimates_on):
    response = api.post(QUOTE_URL, {"listing_id": "not-a-uuid"}, format="json")

    assert response.status_code == 400
    assert response.data["error"]["code"] == "validation_error"


def test_the_quote_view_uses_the_hashed_ip_throttle_with_the_finance_scope():
    from django.conf import settings
    from rest_framework.throttling import ScopedRateThrottle

    from common.throttling import HashedIPScopedRateThrottle
    from finance.views import FinanceQuoteView

    view = FinanceQuoteView()
    assert view.throttle_scope == "finance_quote"
    assert [type(t) for t in view.get_throttles()] == [HashedIPScopedRateThrottle]
    assert settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["finance_quote"] == (
        "120/min"
    )
    assert ScopedRateThrottle.THROTTLE_RATES["finance_quote"] == "120/min"


@pytest.mark.django_db
def test_the_quote_endpoint_is_rate_limited_and_keys_hold_no_raw_ip(
    api, eligible, monkeypatch
):
    from django.core.cache import cache
    from rest_framework.throttling import ScopedRateThrottle

    from conftest import clear_own_cache_keys

    clear_own_cache_keys()
    monkeypatch.setitem(ScopedRateThrottle.THROTTLE_RATES, "finance_quote", "2/min")
    body = {"listing_id": str(eligible.pk)}

    assert api.post(QUOTE_URL, body, format="json").status_code == 200
    assert api.post(QUOTE_URL, body, format="json").status_code == 200
    assert api.post(QUOTE_URL, body, format="json").status_code == 429

    client = cache._cache.get_client(write=True)
    keys = [k.decode() for k in client.scan_iter(match="*throttle_finance_quote*")]
    assert keys, "expected a throttle cache key for the finance_quote scope"
    assert not any("127.0.0.1" in key for key in keys)
