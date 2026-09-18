"""Spec §18's five acceptance tests and spec §40 Scenarios C and D.

One test per bullet, named after it. Acceptance test 4 ("CTA opens a separate
tab without granting opener access") is a DOM property and has no backend
surface: it is proven by
frontend/src/components/listings/BoatCard.test.tsx::"opens the calculator in a
new tab without granting opener access", which asserts target="_blank" and
rel="noopener noreferrer" on the href this file's Scenario C test produces.
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
from finance.models import FinanceConfigurationVersion
from finance.services import FinanceConfigurationService
from listings.enums import ListingStatus, RevisionStatus
from listings.tests.factories import (
    make_broker_listing,
    make_private_listing,
    make_revision,
    make_snapshot,
)
from platform_settings.services import set_feature_flag

_names = itertools.count()


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture(autouse=True)
def flags_on(db):
    set_feature_flag(key="finance_estimates", is_enabled=True, actor=None)
    set_feature_flag(key="listing_revisions", is_enabled=True, actor=None)


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


def _card(api, listing):
    response = api.get(reverse("listing-list"))
    return next(row for row in response.data["results"] if row["id"] == str(listing.pk))


@pytest.mark.django_db
def test_acceptance_1_broker_toggle_off_shows_no_installment_or_cta(api):
    listing = _publish(_broker_listing(show_finance_estimate=False))

    card = _card(api, listing)
    detail = api.get(reverse("listing-detail", kwargs={"listing_id": listing.pk}))

    assert card["finance"] == {"visible": False}
    assert detail.data["finance"] == {"visible": False}


@pytest.mark.django_db
def test_acceptance_2_list_and_finance_page_use_equal_assumptions_and_results(api):
    """The finance page's numbers come from POST /api/v1/finance/quotes/ with
    the listing id — the same request the card's CTA leads to."""
    listing = _publish(_broker_listing(show_finance_estimate=True))

    card = _card(api, listing)
    quote = api.post(
        reverse("finance-quote"), {"listing_id": str(listing.pk)}, format="json"
    )

    assert card["finance"]["monthly_payment"] == quote.data["monthly_payment"]
    assert card["finance"]["annual_rate_percent"] == quote.data["annual_rate_percent"]
    assert card["finance"]["term_months"] == quote.data["term_months"]
    assert card["finance"]["configuration_version"] == quote.data[
        "configuration_version"
    ]


@pytest.mark.django_db
def test_acceptance_3_a_private_sellers_crafted_finance_payload_is_rejected(api):
    """Spec §40 Scenario D. The payload refusal is Phase 11's
    `finance_not_allowed_for_private_seller`; this test proves it still holds
    now that finance has a public surface, and that the surface stays absent."""
    owner = make_user(
        email=f"seller-{next(_names)}@example.com",
        role=UserRole.PRIVATE_SELLER,
        verified=True,
    )
    listing = make_private_listing(owner=owner, price=Decimal("459000.00"))
    make_revision(listing, state=RevisionStatus.DRAFT)
    api.force_authenticate(user=owner)

    response = api.patch(
        reverse("listing-draft-update", kwargs={"listing_id": listing.pk}),
        {"version": listing.version, "show_finance_estimate": True},
        format="json",
    )

    assert response.status_code == 400
    assert response.data["error"]["fields"]["show_finance_estimate"][0] == (
        "Finance options are available to broker listings only."
    )
    listing.refresh_from_db()
    assert listing.show_finance_estimate is False

    api.force_authenticate(user=None)
    _publish(listing)
    detail = api.get(reverse("listing-detail", kwargs={"listing_id": listing.pk}))
    assert detail.data["finance"] == {"visible": False}


@pytest.mark.django_db
def test_acceptance_5_new_staff_defaults_update_non_overridden_cards_only(
    api, django_capture_on_commit_callbacks
):
    """Spec §18 acceptance test 5, spec §17.5.

    The on-commit capture is required: activate() invalidates the finance
    configuration cache inside transaction.on_commit, which does not fire in a
    django_db test, and the two `before` card reads have already warmed that
    cache with version 1.
    """
    plain = _publish(_broker_listing(show_finance_estimate=True))
    overridden = _publish(
        _broker_listing(
            show_finance_estimate=True,
            finance_rate_override_percent=Decimal("3.5000"),
        )
    )
    before_plain = _card(api, plain)["finance"]["monthly_payment"]
    before_overridden = _card(api, overridden)["finance"]["monthly_payment"]

    with django_capture_on_commit_callbacks(execute=True):
        FinanceConfigurationService.activate(
            FinanceConfigurationVersion(
                annual_rate_percent=Decimal("7.0000"),
                term_months=48,
                down_payment_percent=Decimal("20.0000"),
            )
        )

    after_plain = _card(api, plain)
    after_overridden = _card(api, overridden)
    assert after_plain["finance"]["annual_rate_percent"] == "7.0000"
    assert after_plain["finance"]["monthly_payment"] != before_plain
    assert after_overridden["finance"]["annual_rate_percent"] == "3.5000"
    assert after_overridden["finance"]["monthly_payment"] == before_overridden


@pytest.mark.django_db
def test_scenario_c_a_published_broker_card_returns_the_spec_numbers(api):
    """Spec §40 Scenario C: €459,000, finance enabled, global 20%/5%/48 and no
    overrides -> €8,456.36/month, a view count and a calculator CTA target."""
    listing = _publish(_broker_listing(show_finance_estimate=True))

    card = _card(api, listing)

    assert card["price"] == {"amount": "459000.00", "currency": "EUR"}
    assert card["finance"] == {
        "visible": True,
        "monthly_payment": "8456.36",
        "annual_rate_percent": "5.0000",
        "term_months": 48,
        "down_payment_percent": "20.0000",
        "configuration_version": 1,
    }
    assert card["view_count"] == 0
    # The CTA target the frontend builds from exactly these two values
    # (spec §18.3); frontend/src/lib/api/listings.test.ts pins the string.
    assert card["id"] and card["price"]["currency"] == "EUR"
