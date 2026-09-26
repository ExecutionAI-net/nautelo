"""Listing eligibility and configuration precedence (spec §17.2, §18.2, §18.5).

The worked numbers come from spec §17.1's test-vector table and spec §40
Scenario C: a €459,000 broker listing with the global 20% / 5% / 48 months
must produce a €8,456.36 monthly payment.
"""

import itertools
from decimal import Decimal

import pytest

from accounts.enums import SellerType, UserRole
from accounts.tests.factories import make_user
from brokers.tests.factories import make_broker
from finance.listing_quotes import (
    GLOBAL,
    LISTING_OVERRIDE,
    FinanceConfigurationUnavailable,
    FinancePolicy,
    FinanceQuoteService,
    resolve_effective_assumptions,
)
from finance.models import FinanceConfigurationVersion
from finance.services import FinanceConfigurationService
from listings.enums import ListingStatus
from listings.tests.factories import (
    make_broker_listing,
    make_private_listing,
    make_snapshot,
)
from platform_settings.services import set_feature_flag, update_setting

_names = itertools.count()


def _moderator():
    return make_user(
        email=f"moderator-{next(_names)}@example.com",
        role=UserRole.STAFF,
        verified=True,
    )


def _agent():
    return make_user(
        email=f"agent-{next(_names)}@example.com",
        role=UserRole.BROKER,
        verified=True,
    )


def _enable_estimates():
    set_feature_flag(key="finance_estimates", is_enabled=True, actor=None)


def _publish(listing, **snapshot_kwargs):
    snapshot = make_snapshot(listing, approved_by=_moderator(), **snapshot_kwargs)
    listing.status = ListingStatus.PUBLISHED
    listing.current_public_snapshot = snapshot
    listing.save(update_fields=["status", "current_public_snapshot"])
    return listing


def _broker_listing(**kwargs):
    index = next(_names)
    return make_broker_listing(
        broker=make_broker(name=f"Broker {index}", slug=f"broker-{index}"),
        actor=_agent(),
        price=Decimal("459000.00"),
        **kwargs,
    )


@pytest.fixture
def eligible_listing(db):
    _enable_estimates()
    return _publish(_broker_listing(show_finance_estimate=True))


@pytest.mark.django_db
def test_scenario_c_numbers(eligible_listing):
    """Spec §40 Scenario C: €459,000, 20% down, 5%, 48 months -> €8,456.36."""
    block = FinanceQuoteService.card_block(
        eligible_listing, policy=FinancePolicy.load()
    )

    assert block == {
        "visible": True,
        "monthly_payment": "8456.36",
        "annual_rate_percent": "5.0000",
        "term_months": 48,
        "down_payment_percent": "20.0000",
        "configuration_version": 1,
    }


@pytest.mark.django_db
def test_an_ineligible_listing_returns_exactly_one_key(eligible_listing):
    """Spec §18.5: "For ineligible listings return {"visible": false} and no
    assumptions"."""
    listing = _publish(_broker_listing(show_finance_estimate=False))

    block = FinanceQuoteService.card_block(listing, policy=FinancePolicy.load())

    assert block == {"visible": False}


@pytest.mark.django_db
def test_a_private_listing_is_eligible():
    """Product decision 2026-09-26: private listings show the estimate."""
    _enable_estimates()
    owner = make_user(
        email=f"seller-{next(_names)}@example.com",
        role=UserRole.PRIVATE_SELLER,
        verified=True,
    )
    listing = _publish(
        make_private_listing(owner=owner, price=Decimal("459000.00")),
        show_finance_estimate=True,
    )

    assert FinanceQuoteService.is_visible(listing, policy=FinancePolicy.load()) is True


@pytest.mark.django_db
def test_a_listing_that_is_not_published_is_never_eligible(eligible_listing):
    eligible_listing.status = ListingStatus.SUSPENDED
    eligible_listing.save(update_fields=["status"])

    assert FinanceQuoteService.is_visible(
        eligible_listing, policy=FinancePolicy.load()
    ) is False


@pytest.mark.django_db
def test_the_global_kill_switch_hides_finance(eligible_listing):
    """Spec §36.1: "If global finance is disabled, listing flags remain stored
    but all public finance UI/API visibility is false"."""
    update_setting(key="finance.enabled", value=False, actor=None)

    assert FinanceQuoteService.is_visible(
        eligible_listing, policy=FinancePolicy.load()
    ) is False
    assert eligible_listing.current_public_snapshot.show_finance_estimate is True


@pytest.mark.django_db
def test_the_rollout_flag_hides_finance(eligible_listing):
    """Spec §35.1: flags gate frontend exposure and backend behaviour alike."""
    set_feature_flag(key="finance_estimates", is_enabled=False, actor=None)

    assert FinanceQuoteService.is_visible(
        eligible_listing, policy=FinancePolicy.load()
    ) is False


@pytest.mark.django_db
def test_an_unsupported_currency_hides_finance():
    _enable_estimates()
    listing = _publish(
        _broker_listing(show_finance_estimate=True), currency="USD"
    )

    assert FinanceQuoteService.is_visible(listing, policy=FinancePolicy.load()) is False


@pytest.mark.django_db
def test_a_price_above_the_spec_ceiling_hides_finance():
    """Spec §17.3: price 0.01-999,999,999.99. ListingSnapshot.price is
    decimal(14,2), so a larger published price is storable and must not reach
    the calculator."""
    _enable_estimates()
    listing = _publish(
        _broker_listing(show_finance_estimate=True), price=Decimal("1000000000.00")
    )

    assert FinanceQuoteService.is_visible(listing, policy=FinancePolicy.load()) is False


@pytest.mark.django_db
def test_a_valid_override_wins_and_reports_its_source():
    """Spec §17.2 step 2 and "Store/return the effective source of each value"."""
    _enable_estimates()
    listing = _publish(
        _broker_listing(
            show_finance_estimate=True,
            finance_rate_override_percent=Decimal("3.5000"),
        )
    )

    assumptions = resolve_effective_assumptions(
        snapshot=listing.current_public_snapshot, policy=FinancePolicy.load()
    )

    assert assumptions.annual_rate_percent == Decimal("3.5000")
    assert assumptions.sources == {
        "annual_rate_percent": LISTING_OVERRIDE,
        "term_months": GLOBAL,
        "down_payment_percent": GLOBAL,
    }


@pytest.mark.django_db
def test_a_globally_disabled_override_is_ignored_not_deleted():
    """Spec §17.2: "Staff can disable override capability globally without
    altering existing stored values; disabled overrides are ignored, not
    deleted"."""
    _enable_estimates()
    listing = _publish(
        _broker_listing(
            show_finance_estimate=True,
            finance_rate_override_percent=Decimal("3.5000"),
        )
    )
    update_setting(key="finance.broker_overrides_enabled", value=False, actor=None)

    assumptions = resolve_effective_assumptions(
        snapshot=listing.current_public_snapshot, policy=FinancePolicy.load()
    )

    assert assumptions.annual_rate_percent == Decimal("5.0000")
    assert assumptions.sources["annual_rate_percent"] == GLOBAL
    assert listing.current_public_snapshot.finance_rate_override_percent == Decimal(
        "3.5000"
    )


@pytest.mark.django_db
def test_an_out_of_range_stored_override_falls_back_to_the_global_value():
    """Spec §17.2 step 2 says to use "valid listing override fields"; §17.3
    bounds the term at 1-360. An out-of-range stored value must not reach the
    calculator and must not break the card."""
    _enable_estimates()
    listing = _publish(
        _broker_listing(show_finance_estimate=True, finance_term_override_months=400)
    )

    assumptions = resolve_effective_assumptions(
        snapshot=listing.current_public_snapshot, policy=FinancePolicy.load()
    )

    assert assumptions.term_months == 48
    assert assumptions.sources["term_months"] == GLOBAL


@pytest.mark.django_db
def test_a_new_active_configuration_changes_a_non_overridden_card(
    eligible_listing, django_capture_on_commit_callbacks
):
    """Spec §17.5: "Card APIs calculate with current effective configuration at
    request time". Spec §18 acceptance test 5.

    `django_capture_on_commit_callbacks(execute=True)` is load-bearing, not
    decoration: FinanceConfigurationService.activate() defers its cache
    invalidation to transaction.on_commit, which never fires inside a
    django_db test's wrapping transaction — without it, the 300-second cache
    entry the first card_block warmed would still answer with version 1 and
    this test would pass or fail for the wrong reason. Same pattern as Phase
    8's test_activate_deactivates_previous_version_and_invalidates_cache.
    """
    before = FinanceQuoteService.card_block(
        eligible_listing, policy=FinancePolicy.load()
    )

    with django_capture_on_commit_callbacks(execute=True):
        FinanceConfigurationService.activate(
            FinanceConfigurationVersion(
                annual_rate_percent=Decimal("6.0000"),
                term_months=48,
                down_payment_percent=Decimal("20.0000"),
            )
        )

    after = FinanceQuoteService.card_block(
        eligible_listing, policy=FinancePolicy.load()
    )
    assert before["monthly_payment"] == "8456.36"
    assert after["annual_rate_percent"] == "6.0000"
    assert after["configuration_version"] == 2
    assert after["monthly_payment"] != before["monthly_payment"]


@pytest.mark.django_db
def test_a_missing_active_configuration_hides_finance_instead_of_raising(
    eligible_listing,
):
    """A public card must degrade, never 500. Phase 8's migration always seeds
    a version, but a staff deletion in Django admin is reachable."""
    FinanceConfigurationVersion.objects.all().delete()
    FinanceConfigurationService._invalidate_cache()

    assert FinanceQuoteService.card_block(
        eligible_listing, policy=FinancePolicy.load()
    ) == {"visible": False}


@pytest.mark.django_db
def test_resolving_assumptions_without_a_configuration_raises_a_named_error():
    """resolve_effective_assumptions is exported to later phases (see the plan's
    Contract summary), and its precondition — an active configuration — is
    implied by is_visible() at both of this phase's call sites rather than stated
    at them. It is enforced here so a future caller that does not know the rule
    gets a sentence naming it instead of an AttributeError on None.
    """
    _enable_estimates()
    FinanceConfigurationVersion.objects.all().delete()
    FinanceConfigurationService._invalidate_cache()
    policy = FinancePolicy.load()
    assert policy.configuration is None

    with pytest.raises(FinanceConfigurationUnavailable):
        resolve_effective_assumptions(snapshot=None, policy=policy)


def _assumptions_for(listing):
    return resolve_effective_assumptions(
        snapshot=listing.current_public_snapshot, policy=FinancePolicy.load()
    )


@pytest.mark.django_db
def test_rate_override_boundary_is_accepted_and_just_above_is_ignored(
    eligible_listing,
):
    """Spec §17.3: rate 0-100. The snapshot is mutated in memory only because
    the database constraint would refuse to store an out-of-range value."""
    snapshot = eligible_listing.current_public_snapshot

    snapshot.finance_rate_override_percent = Decimal("100.0000")
    at_limit = _assumptions_for(eligible_listing)
    assert at_limit.annual_rate_percent == Decimal("100.0000")
    assert at_limit.sources["annual_rate_percent"] == LISTING_OVERRIDE

    snapshot.finance_rate_override_percent = Decimal("100.0001")
    above = _assumptions_for(eligible_listing)
    assert above.annual_rate_percent == Decimal("5.0000")
    assert above.sources["annual_rate_percent"] == GLOBAL

    snapshot.finance_rate_override_percent = Decimal("-0.0001")
    below = _assumptions_for(eligible_listing)
    assert below.sources["annual_rate_percent"] == GLOBAL


@pytest.mark.django_db
def test_down_payment_override_boundary_is_accepted_and_just_above_is_ignored(
    eligible_listing,
):
    """Spec §17.3: down payment 0-99.99."""
    snapshot = eligible_listing.current_public_snapshot

    snapshot.finance_down_payment_override_percent = Decimal("99.99")
    at_limit = _assumptions_for(eligible_listing)
    assert at_limit.down_payment_percent == Decimal("99.99")
    assert at_limit.sources["down_payment_percent"] == LISTING_OVERRIDE

    snapshot.finance_down_payment_override_percent = Decimal("99.9901")
    above = _assumptions_for(eligible_listing)
    assert above.down_payment_percent == Decimal("20.0000")
    assert above.sources["down_payment_percent"] == GLOBAL

    snapshot.finance_down_payment_override_percent = Decimal(100)
    assert _assumptions_for(eligible_listing).sources["down_payment_percent"] == GLOBAL


@pytest.mark.django_db
def test_price_boundaries(eligible_listing):
    """Spec §17.3: price 0.01-999,999,999.99. Mutated in memory because the
    database refuses a non-positive stored price."""
    snapshot = eligible_listing.current_public_snapshot
    policy = FinancePolicy.load()

    for price in (Decimal("0.01"), Decimal("999999999.99")):
        snapshot.price = price
        assert FinanceQuoteService.is_visible(eligible_listing, policy=policy) is True

    for price in (Decimal(0), Decimal("0.00"), Decimal("0.009"), Decimal(-1)):
        snapshot.price = price
        assert FinanceQuoteService.is_visible(eligible_listing, policy=policy) is False
        assert FinanceQuoteService.card_block(
            eligible_listing, policy=policy
        ) == {"visible": False}


@pytest.mark.django_db
def test_a_null_price_yields_the_not_visible_block(eligible_listing):
    eligible_listing.current_public_snapshot.price = None

    assert FinanceQuoteService.card_block(
        eligible_listing, policy=FinancePolicy.load()
    ) == {"visible": False}


@pytest.mark.django_db
def test_partial_overrides_fall_back_to_global_per_field(eligible_listing):
    """Only the fields actually set are overridden; the None ones stay GLOBAL."""
    snapshot = eligible_listing.current_public_snapshot
    snapshot.finance_rate_override_percent = None
    snapshot.finance_term_override_months = 60
    snapshot.finance_down_payment_override_percent = None

    assumptions = _assumptions_for(eligible_listing)

    assert assumptions.term_months == 60
    assert assumptions.annual_rate_percent == Decimal("5.0000")
    assert assumptions.down_payment_percent == Decimal("20.0000")
    assert assumptions.sources == {
        "annual_rate_percent": GLOBAL,
        "term_months": LISTING_OVERRIDE,
        "down_payment_percent": GLOBAL,
    }


@pytest.mark.django_db
def test_only_a_broker_can_switch_the_estimate_off(
    eligible_listing,
):
    """A broker's per-listing switch hides the estimate; a private listing has
    no switch and keeps showing it."""
    policy = FinancePolicy.load()
    assert FinanceQuoteService.is_visible(eligible_listing, policy=policy) is True

    eligible_listing.current_public_snapshot.show_finance_estimate = False
    assert FinanceQuoteService.is_visible(eligible_listing, policy=policy) is False
    assert FinanceQuoteService.card_block(
        eligible_listing, policy=policy
    ) == {"visible": False}

    eligible_listing.seller_type = SellerType.PRIVATE
    assert FinanceQuoteService.is_visible(eligible_listing, policy=policy) is True
