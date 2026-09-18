"""Product resolution and Stripe price reconciliation (spec §11.9, §23.2, §23.5).

Spec §11.9: "Stripe is the payment amount authority at Checkout creation time.
`display_amount` is for UI and must be synchronized/validated; mismatch blocks
checkout and alerts staff." That sentence is this module.
"""

from dataclasses import dataclass
from decimal import Decimal

from .errors import PaymentGatewayUnavailable, ProductNotAvailable, ProductPriceMismatch
from .gateway import StripeUnavailable, default_gateway
from .models import MarketplaceProduct

# Currencies whose minor unit is 1/100 of the major unit. This release is
# EUR-only (spec §1 fixes one marketplace currency and the seeds are EUR).
# Stripe has zero-decimal currencies (JPY, KRW, …) where an amount in "cents"
# would be a 100x overcharge, so an unlisted currency RAISES rather than
# guessing. Widening this set is a deliberate, tested change.
TWO_DECIMAL_CURRENCIES: frozenset[str] = frozenset({"EUR", "USD", "GBP", "CHF"})
_MINOR_UNIT_FACTOR = 100


def minor_units(amount: Decimal, currency: str) -> int:
    """Convert a stored decimal amount to Stripe's integer minor units.

    Decimal arithmetic throughout: `float(Decimal("0.29")) * 100` is
    28.999999999999996, and int() of that is 28 — a one-cent undercharge that
    a casual test would not catch.
    """
    code = currency.upper()
    if code not in TWO_DECIMAL_CURRENCIES:
        raise ValueError(f"{code} is not a supported two-decimal currency.")
    scaled = amount * _MINOR_UNIT_FACTOR
    if scaled != scaled.to_integral_value():
        raise ValueError(f"{amount} has sub-minor-unit precision in {code}.")
    return int(scaled)


def from_minor_units(value: int, currency: str) -> Decimal:
    code = currency.upper()
    if code not in TWO_DECIMAL_CURRENCIES:
        raise ValueError(f"{code} is not a supported two-decimal currency.")
    return (Decimal(value) / _MINOR_UNIT_FACTOR).quantize(Decimal("0.01"))


@dataclass(frozen=True)
class PriceCheck:
    """Spec §23.5's "Stripe Price ID validation state", in a form the staff
    screen can render and the Checkout path can refuse on."""

    ok: bool
    reason: str
    stripe_unit_amount: int | None
    stripe_currency: str
    stored_unit_amount: int
    stored_currency: str


def get_purchasable_product(code: str) -> MarketplaceProduct:
    """The product a customer may open a Checkout against, or nothing.

    One query, one refusal code. An unknown code and a deactivated product are
    deliberately indistinguishable from outside: spec §26.4 says deactivating
    "stops new Checkout creation", and telling a caller which of the two it was
    only helps someone enumerate the catalogue.
    """
    product = MarketplaceProduct.objects.active().filter(code=code).first()
    if product is None:
        raise ProductNotAvailable(product_code=code)
    return product


def check_stripe_price(product: MarketplaceProduct, *, gateway=None) -> PriceCheck:
    """Compare the stored display price with Stripe's live Price.

    Returns a result rather than raising, because spec §23.5's staff screen has
    to RENDER the mismatch. `require_reconciled_price` is the raising wrapper
    the Checkout path uses.

    A transport failure is NOT a mismatch and must not be reported as one —
    telling staff to reconcile a price that is in fact correct wastes the one
    action that actually fixes the real case.
    """
    stored_currency = product.currency.upper()
    if not product.stripe_price_id or not product.stripe_product_id:
        return PriceCheck(
            ok=False,
            reason="Stripe product/price is not configured for this product.",
            stripe_unit_amount=None,
            stripe_currency="",
            stored_unit_amount=0,
            stored_currency=stored_currency,
        )

    gateway = gateway or default_gateway()
    try:
        snapshot = gateway.retrieve_price(product.stripe_price_id)
    except StripeUnavailable as exc:
        # Deliberately drops str(exc): a Stripe message can quote the request.
        raise PaymentGatewayUnavailable() from exc

    stored_minor = minor_units(product.display_amount, stored_currency)
    stripe_currency = snapshot.currency.upper()
    base = {
        "stripe_unit_amount": snapshot.unit_amount,
        "stripe_currency": stripe_currency,
        "stored_unit_amount": stored_minor,
        "stored_currency": stored_currency,
    }

    if snapshot.product_id != product.stripe_product_id:
        return PriceCheck(
            ok=False, reason="Stripe price belongs to a different product.", **base
        )
    if not snapshot.active:
        return PriceCheck(ok=False, reason="Stripe price is inactive.", **base)
    if snapshot.recurring:
        # Spec §23.1: both products are "One-time payment".
        return PriceCheck(
            ok=False, reason="Stripe price is recurring, not one-time.", **base
        )
    if snapshot.unit_amount is None:
        return PriceCheck(
            ok=False,
            reason="Stripe price has no fixed unit amount.",
            **base,
        )
    if stripe_currency != stored_currency:
        return PriceCheck(ok=False, reason="Stripe currency differs.", **base)
    if snapshot.unit_amount != stored_minor:
        return PriceCheck(ok=False, reason="Stripe amount differs.", **base)

    return PriceCheck(ok=True, reason="", **base)


def require_reconciled_price(product: MarketplaceProduct, *, gateway=None) -> PriceCheck:
    """Spec §23.5: "Checkout is blocked until reconciled"."""
    result = check_stripe_price(product, gateway=gateway)
    if not result.ok:
        raise ProductPriceMismatch(
            product_code=product.code,
            reason=result.reason,
            stored_amount=str(product.display_amount),
            stored_currency=result.stored_currency,
        )
    return result
