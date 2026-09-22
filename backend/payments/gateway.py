"""The single seam between this codebase and Stripe's API.

Everything that would open a socket lives here and nowhere else, so every
service can be tested by passing a fake. Two rules this module exists to keep:

  * The secret key is held on the instance, never on the module and never in a
    repr — a gateway object in a traceback or an error report must not leak it.
  * The stripe library's exceptions never escape. Callers see StripeUnavailable
    and translate it once, at the API boundary, into the
    `payment_gateway_unavailable` envelope. That keeps a Stripe error message
    (which can quote request parameters) out of our response bodies.

Signature verification is deliberately NOT here: it needs no API key, performs
no I/O, and lives in payments.webhooks beside the code that consumes it.
"""

from dataclasses import dataclass
from typing import Protocol, runtime_checkable

import stripe
from django.conf import settings


class StripeUnavailable(Exception):
    """A transport or API-level failure talking to Stripe."""


@dataclass(frozen=True)
class CheckoutSessionResult:
    session_id: str
    url: str


@dataclass(frozen=True)
class ProductWithPrice:
    """One active Stripe Product together with its default Price, as returned
    by `list_active_products_with_prices`. Used to reconcile the plans/packages
    configured in Django admin against what Staff actually created in Stripe
    (payments.management.commands.link_stripe_products) — never during a live
    checkout, which always re-reads the specific price via `retrieve_price`."""

    product_id: str
    product_name: str
    price_id: str
    unit_amount: int | None
    currency: str


@dataclass(frozen=True)
class PriceSnapshot:
    """The parts of a Stripe Price this system reconciles against.

    `unit_amount` is in MINOR UNITS (integer cents) and may be None for a Price
    with tiered or custom pricing — which this product catalogue must never use,
    and which payments.products treats as a mismatch rather than guessing.
    `currency` is whatever Stripe returned, lower-cased; normalizing is the
    caller's job, so the raw value stays inspectable.
    """

    price_id: str
    product_id: str
    unit_amount: int | None
    currency: str
    active: bool
    recurring: bool


@runtime_checkable
class StripeGateway(Protocol):
    def create_checkout_session(
        self, *, params: dict, idempotency_key: str
    ) -> CheckoutSessionResult: ...

    def retrieve_price(self, price_id: str) -> PriceSnapshot: ...

    def create_portal_session(self, *, customer_id: str, return_url: str) -> str: ...

    def list_active_products_with_prices(self) -> list[ProductWithPrice]: ...


class StripeApiGateway:
    """The real gateway. Uses stripe.StripeClient rather than the module-level
    `stripe.api_key`, so no global mutable state is involved and two settings
    (or two tests) can never race each other."""

    __slots__ = ("_client",)

    def __init__(self, *, api_key: str):
        # stripe-python 15.x: the v1 namespace is the non-deprecated one.
        self._client = stripe.StripeClient(api_key)

    def __repr__(self) -> str:  # pragma: no cover - trivial, but load-bearing
        return "<StripeApiGateway>"

    def create_checkout_session(
        self, *, params: dict, idempotency_key: str
    ) -> CheckoutSessionResult:
        try:
            session = self._client.v1.checkout.sessions.create(
                params=params, options={"idempotency_key": idempotency_key}
            )
        except stripe.StripeError as exc:
            # Deliberately not `from exc` in the message: str(exc) can quote the
            # parameters we sent. The chained traceback keeps it for the logs;
            # the message this raises carries nothing.
            raise StripeUnavailable("Stripe rejected the session creation.") from exc
        return CheckoutSessionResult(session_id=session.id, url=session.url)

    def create_portal_session(self, *, customer_id: str, return_url: str) -> str:
        """Stripe-hosted page for cards, tax details and invoices."""
        try:
            session = self._client.v1.billing_portal.sessions.create(
                params={"customer": customer_id, "return_url": return_url}
            )
        except stripe.StripeError as exc:
            raise StripeUnavailable("Stripe rejected the portal session.") from exc
        return session.url

    def retrieve_price(self, price_id: str) -> PriceSnapshot:
        try:
            price = self._client.v1.prices.retrieve(price_id)
        except stripe.StripeError as exc:
            raise StripeUnavailable("Stripe rejected the price lookup.") from exc
        product = price.product
        return PriceSnapshot(
            price_id=price.id,
            # Stripe returns `product` either expanded or as a bare id string.
            product_id=product if isinstance(product, str) else product.id,
            unit_amount=price.unit_amount,
            currency=price.currency,
            active=bool(price.active),
            recurring=price.recurring is not None,
        )

    def list_active_products_with_prices(self) -> list[ProductWithPrice]:
        """Every active Product that has a default Price, for admin-time
        reconciliation (see `link_stripe_products`). Never called from a
        request path — Stripe's own pagination is walked to completion, which
        a checkout endpoint must not wait on."""
        try:
            products = list(
                self._client.v1.products.list(
                    params={"active": True, "expand": ["data.default_price"], "limit": 100}
                ).auto_paging_iter()
            )
        except stripe.StripeError as exc:
            raise StripeUnavailable("Stripe rejected the product listing.") from exc
        result = []
        for product in products:
            price = product.default_price
            if price is None or isinstance(price, str):
                # No default price, or Stripe did not expand it — either way
                # there is nothing to reconcile against for this product.
                continue
            result.append(
                ProductWithPrice(
                    product_id=product.id,
                    product_name=product.name,
                    price_id=price.id,
                    unit_amount=price.unit_amount,
                    currency=price.currency,
                )
            )
        return result


def default_gateway() -> StripeGateway:
    """Read the secret at CALL time, never at import time.

    Import-time reads would make every management command and every test module
    require a configured Stripe account, and would freeze a settings override
    that pytest's `settings` fixture is supposed to be able to change.
    """
    return StripeApiGateway(api_key=settings.STRIPE_SECRET_KEY)
