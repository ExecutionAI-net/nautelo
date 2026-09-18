"""Spec §23.5's reconciliation rule: "Stripe is the payment amount authority at
Checkout creation time" (§11.9) and "Checkout is blocked until reconciled"."""

from decimal import Decimal

import pytest

from payments.enums import ProductCode
from payments.errors import (
    PaymentGatewayUnavailable,
    ProductNotAvailable,
    ProductPriceMismatch,
)
from payments.gateway import PriceSnapshot, StripeUnavailable
from payments.models import MarketplaceProduct
from payments.products import (
    PriceCheck,
    check_stripe_price,
    from_minor_units,
    get_purchasable_product,
    minor_units,
    require_reconciled_price,
)
from payments.tests.factories import listing_right_product
from payments.tests.fakes import FakeStripeGateway


def snapshot(**overrides):
    defaults = {
        "price_id": "price_test_listing_right",
        "product_id": "prod_test_listing_right",
        "unit_amount": 4900,
        "currency": "eur",
        "active": True,
        "recurring": False,
    }
    defaults.update(overrides)
    return PriceSnapshot(**defaults)


@pytest.mark.parametrize(
    ("amount", "expected"),
    [("49.00", 4900), ("0.01", 1), ("1234.56", 123456), ("1000000.00", 100000000)],
)
def test_minor_units_converts_exactly(amount, expected):
    assert minor_units(Decimal(amount), "EUR") == expected


def test_minor_units_never_uses_float_arithmetic():
    """0.29 * 100 is 28.999999999999996 in binary floating point. A float-based
    implementation would undercharge by a cent and pass a casual test."""
    assert minor_units(Decimal("0.29"), "EUR") == 29
    assert minor_units(Decimal("8.70"), "EUR") == 870


def test_a_sub_cent_amount_is_refused_rather_than_rounded():
    with pytest.raises(ValueError):
        minor_units(Decimal("1.005"), "EUR")


def test_from_minor_units_round_trips():
    assert from_minor_units(4900, "EUR") == Decimal("49.00")
    assert minor_units(from_minor_units(123456, "EUR"), "EUR") == 123456


def test_an_unsupported_currency_raises_rather_than_mis_charging():
    """JPY is zero-decimal: charging 4900 "minor units" for ¥49 would be a
    100x overcharge. Refuse loudly instead."""
    with pytest.raises(ValueError, match="JPY"):
        minor_units(Decimal("49.00"), "JPY")


@pytest.mark.django_db
def test_an_unknown_product_code_is_not_purchasable():
    with pytest.raises(ProductNotAvailable) as excinfo:
        get_purchasable_product("SUBSCRIPTION")

    assert excinfo.value.get_codes() == "product_not_available"


@pytest.mark.django_db
def test_an_inactive_product_is_not_purchasable():
    """Spec §26.4: "Deactivating a product stops new Checkout creation"."""
    with pytest.raises(ProductNotAvailable):
        get_purchasable_product(ProductCode.INDIVIDUAL_LISTING_RIGHT)


@pytest.mark.django_db
def test_an_active_configured_product_is_purchasable():
    """The positive half — without it, a resolver that refused everything would
    still pass both negatives."""
    product = listing_right_product()

    assert get_purchasable_product(ProductCode.INDIVIDUAL_LISTING_RIGHT) == product


@pytest.mark.django_db
def test_a_matching_stripe_price_reconciles():
    product = listing_right_product(display_amount=Decimal("49.00"), currency="EUR")
    gateway = FakeStripeGateway(price=snapshot())

    result = check_stripe_price(product, gateway=gateway)

    assert result.ok is True
    assert result.reason == ""
    assert result.stored_unit_amount == 4900
    assert gateway.retrieved == ["price_test_listing_right"]


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("overrides", "reason"),
    [
        ({"unit_amount": 5900}, "amount"),
        ({"currency": "usd"}, "currency"),
        ({"active": False}, "inactive"),
        ({"recurring": True}, "recurring"),
        ({"unit_amount": None}, "amount"),
        ({"product_id": "prod_someone_elses"}, "product"),
    ],
)
def test_every_kind_of_drift_blocks_checkout(overrides, reason):
    """Spec §23.5: "A warning is shown if stored display amount differs from
    Stripe's current Price; Checkout is blocked until reconciled." Each of these
    is a way the two can differ, and each must block."""
    product = listing_right_product(display_amount=Decimal("49.00"), currency="EUR")
    gateway = FakeStripeGateway(price=snapshot(**overrides))

    result = check_stripe_price(product, gateway=gateway)

    assert result.ok is False
    assert reason in result.reason

    with pytest.raises(ProductPriceMismatch) as excinfo:
        require_reconciled_price(product, gateway=gateway)
    assert excinfo.value.get_codes() == "product_price_mismatch"


@pytest.mark.django_db
def test_stripes_lowercase_currency_still_matches_an_uppercase_stored_one():
    """Stripe returns `"eur"`; the database stores `"EUR"`. A naive == would
    report a permanent mismatch and block every Checkout in production."""
    product = listing_right_product(display_amount=Decimal("49.00"), currency="EUR")

    result = check_stripe_price(product, gateway=FakeStripeGateway(price=snapshot()))

    assert result.ok is True


@pytest.mark.django_db
def test_a_product_with_no_stripe_price_id_never_calls_stripe():
    product = listing_right_product(is_active=False, stripe_price_id="")
    gateway = FakeStripeGateway()

    result = check_stripe_price(product, gateway=gateway)

    assert result.ok is False
    assert "not configured" in result.reason
    assert gateway.retrieved == []


@pytest.mark.django_db
def test_a_stripe_transport_failure_is_not_reported_as_a_price_mismatch():
    """Telling staff "your price is wrong" when Stripe was merely unreachable
    would send them to reconcile a price that is in fact correct."""
    product = listing_right_product()
    gateway = FakeStripeGateway(raise_on_retrieve=StripeUnavailable("down"))

    with pytest.raises(PaymentGatewayUnavailable) as excinfo:
        check_stripe_price(product, gateway=gateway)

    assert excinfo.value.get_codes() == "payment_gateway_unavailable"


@pytest.mark.django_db
def test_no_stripe_error_text_reaches_the_envelope():
    """str(StripeError) can quote the parameters we sent, including metadata."""
    product = listing_right_product()
    gateway = FakeStripeGateway(
        raise_on_retrieve=StripeUnavailable("secret sk_live_abc in the message")
    )

    with pytest.raises(PaymentGatewayUnavailable) as excinfo:
        check_stripe_price(product, gateway=gateway)

    assert "sk_live_abc" not in str(excinfo.value.detail)
    assert "sk_live_abc" not in str(getattr(excinfo.value, "meta", {}))


@pytest.mark.django_db
def test_the_price_check_reports_both_sides_so_staff_can_act():
    product = listing_right_product(display_amount=Decimal("49.00"))
    gateway = FakeStripeGateway(price=snapshot(unit_amount=5900))

    result = check_stripe_price(product, gateway=gateway)

    assert isinstance(result, PriceCheck)
    assert (result.stored_unit_amount, result.stripe_unit_amount) == (4900, 5900)
    assert (result.stored_currency, result.stripe_currency) == ("EUR", "EUR")
