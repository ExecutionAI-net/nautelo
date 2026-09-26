"""Spec §18.5's finance block on the one public listing representation.

Spec §29.1: "Every boat card uses one component and one API representation."
Phase 11 contract rule 9: Phase 9 extends PublicListingSerializer rather than
adding a second representation — so these tests hit the real endpoints.
"""

import itertools
from decimal import Decimal

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
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
from platform_settings.services import set_feature_flag

_names = itertools.count()


@pytest.fixture
def api():
    return APIClient()


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


def _private_listing():
    owner = make_user(
        email=f"seller-{next(_names)}@example.com",
        role=UserRole.PRIVATE_SELLER,
        verified=True,
    )
    return make_private_listing(owner=owner, price=Decimal("459000.00"))


@pytest.fixture
def estimates_on(db):
    set_feature_flag(key="finance_estimates", is_enabled=True, actor=None)


@pytest.mark.django_db
def test_the_detail_response_carries_the_spec_18_5_block(api, estimates_on):
    listing = _publish(_broker_listing(show_finance_estimate=True))

    response = api.get(reverse("listing-detail", kwargs={"listing_id": listing.pk}))

    assert response.status_code == 200
    assert response.data["finance"] == {
        "visible": True,
        "monthly_payment": "8456.36",
        "annual_rate_percent": "5.0000",
        "term_months": 48,
        "down_payment_percent": "20.0000",
        "configuration_version": 1,
    }


@pytest.mark.django_db
def test_the_list_response_carries_the_same_block(api, estimates_on):
    listing = _publish(_broker_listing(show_finance_estimate=True))

    response = api.get(reverse("listing-list"))

    card = next(
        row for row in response.data["results"] if row["id"] == str(listing.pk)
    )
    assert card["finance"]["monthly_payment"] == "8456.36"


@pytest.mark.django_db
def test_a_private_listing_always_shows_the_estimate(api, estimates_on):
    """Product decision 2026-09-26: a private listing shows the estimated monthly
    payment at the platform's standard terms, even with no per-listing switch."""
    listing = _publish(_private_listing())

    response = api.get(reverse("listing-detail", kwargs={"listing_id": listing.pk}))

    assert response.data["finance"]["visible"] is True


@pytest.mark.django_db
def test_a_broker_listing_with_the_toggle_off_carries_only_visible_false(
    api, estimates_on
):
    listing = _publish(_broker_listing(show_finance_estimate=False))

    response = api.get(reverse("listing-detail", kwargs={"listing_id": listing.pk}))

    assert response.data["finance"] == {"visible": False}


@pytest.mark.django_db
def test_the_block_never_leaks_any_draft_column(api, estimates_on):
    """Spec §36.1: draft broker finance settings do not leak before publication.

    listings.drafts writes every one of these straight onto the listing row
    before approval, so each must be mutated here: the toggle, the price, the
    currency and all three overrides (with broker overrides enabled, so a leak
    of an override column would actually change the quote).
    """
    from platform_settings.services import update_setting

    update_setting(key="finance.broker_overrides_enabled", value=True, actor=None)
    listing = _publish(_broker_listing(show_finance_estimate=True))
    listing.show_finance_estimate = False
    listing.price = Decimal("1.00")
    listing.currency = "ZZZ"
    listing.finance_rate_override_percent = Decimal("0.0100")
    listing.finance_term_override_months = 7
    listing.finance_down_payment_override_percent = Decimal("90.0000")
    listing.save(
        update_fields=[
            "show_finance_estimate",
            "price",
            "currency",
            "finance_rate_override_percent",
            "finance_term_override_months",
            "finance_down_payment_override_percent",
        ]
    )

    response = api.get(reverse("listing-detail", kwargs={"listing_id": listing.pk}))

    assert response.data["finance"] == {
        "visible": True,
        "monthly_payment": "8456.36",
        "annual_rate_percent": "5.0000",
        "term_months": 48,
        "down_payment_percent": "20.0000",
        "configuration_version": 1,
    }


@pytest.mark.django_db
def test_serializing_three_cards_costs_the_same_queries_as_one(api, estimates_on):
    """The finance policy is loaded once per request, not once per card.

    An exact query count would be brittle across unrelated changes; equality
    between a one-row and a three-row page is the property that matters.
    """
    _publish(_broker_listing(show_finance_estimate=True))
    url = reverse("listing-list")
    # The first request warms the flag/setting/configuration caches, so it
    # costs more queries than any later one regardless of card count.
    api.get(url)

    with CaptureQueriesContext(connection) as one_card:
        api.get(url)

    _publish(_broker_listing(show_finance_estimate=True))
    _publish(_broker_listing(show_finance_estimate=True))

    with CaptureQueriesContext(connection) as three_cards:
        api.get(url)

    assert len(three_cards) == len(one_card)


@pytest.mark.django_db
def test_the_block_is_closed_when_finance_is_globally_disabled(api, estimates_on):
    from platform_settings.services import update_setting

    update_setting(key="finance.enabled", value=False, actor=None)
    listing = _publish(_broker_listing(show_finance_estimate=True))

    detail = api.get(reverse("listing-detail", kwargs={"listing_id": listing.pk}))

    assert detail.data["finance"] == {"visible": False}


@pytest.mark.django_db
def test_the_block_is_closed_when_the_estimates_flag_is_off(api, db):
    listing = _publish(_broker_listing(show_finance_estimate=True))

    detail = api.get(reverse("listing-detail", kwargs={"listing_id": listing.pk}))

    assert detail.data["finance"] == {"visible": False}


@pytest.mark.django_db
def test_override_internals_never_appear_only_the_six_spec_keys(api, estimates_on):
    from platform_settings.services import update_setting

    update_setting(key="finance.broker_overrides_enabled", value=True, actor=None)
    listing = _publish(
        _broker_listing(
            show_finance_estimate=True,
            finance_rate_override_percent=Decimal("3.5000"),
            finance_term_override_months=60,
            finance_down_payment_override_percent=Decimal("10.0000"),
        )
    )

    detail = api.get(reverse("listing-detail", kwargs={"listing_id": listing.pk}))
    listed = api.get(reverse("listing-list"))
    card = next(r for r in listed.data["results"] if r["id"] == str(listing.pk))

    expected_keys = {
        "visible",
        "monthly_payment",
        "annual_rate_percent",
        "term_months",
        "down_payment_percent",
        "configuration_version",
    }
    assert set(detail.data["finance"]) == expected_keys
    assert detail.data["finance"] == card["finance"]
    assert detail.data["finance"]["annual_rate_percent"] == "3.5000"
    assert detail.data["finance"]["term_months"] == 60
    assert detail.data["finance"]["down_payment_percent"] == "10.0000"
    forbidden = {
        "show_finance_estimate",
        "finance_rate_override_percent",
        "finance_term_override_months",
        "finance_down_payment_override_percent",
        "sources",
    }
    assert forbidden.isdisjoint(detail.data.keys())
    assert forbidden.isdisjoint(detail.data["finance"].keys())


@pytest.mark.django_db
def test_a_draft_broker_listing_is_not_readable_so_no_block_leaks(api, estimates_on):
    listing = _broker_listing(show_finance_estimate=True)

    response = api.get(reverse("listing-detail", kwargs={"listing_id": listing.pk}))

    assert response.status_code == 404
    assert "finance" not in response.data


@pytest.mark.django_db
def test_the_smallest_valid_price_is_quoted(api, estimates_on):
    listing = _publish(
        _broker_listing(show_finance_estimate=True), price=Decimal("0.01")
    )

    response = api.get(reverse("listing-detail", kwargs={"listing_id": listing.pk}))

    assert response.data["finance"]["visible"] is True


@pytest.mark.django_db
def test_the_largest_valid_price_is_quoted(api, estimates_on):
    listing = _publish(
        _broker_listing(show_finance_estimate=True), price=Decimal("999999999.99")
    )

    response = api.get(reverse("listing-detail", kwargs={"listing_id": listing.pk}))

    assert response.data["finance"]["visible"] is True
