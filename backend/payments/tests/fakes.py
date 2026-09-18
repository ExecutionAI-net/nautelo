"""An in-memory Stripe gateway.

Records every call so a test can assert on the params the service built, and
returns whatever the test told it to return. It implements the StripeGateway
protocol structurally; test_gateway.py pins that it stays in sync with the real
implementation, so a signature change on one is a failure on the other.
"""

from dataclasses import dataclass, field

from payments.gateway import CheckoutSessionResult, PriceSnapshot, StripeUnavailable


@dataclass
class FakeStripeGateway:
    session_id: str = "cs_test_fake"
    url: str = "https://checkout.stripe.com/c/pay/cs_test_fake"
    price: PriceSnapshot | None = None
    raise_on_create: Exception | None = None
    raise_on_retrieve: Exception | None = None
    created: list[dict] = field(default_factory=list)
    retrieved: list[str] = field(default_factory=list)

    def create_checkout_session(self, *, params, idempotency_key):
        self.created.append({"params": params, "idempotency_key": idempotency_key})
        if self.raise_on_create is not None:
            raise self.raise_on_create
        return CheckoutSessionResult(session_id=self.session_id, url=self.url)

    def retrieve_price(self, price_id):
        self.retrieved.append(price_id)
        if self.raise_on_retrieve is not None:
            raise self.raise_on_retrieve
        if self.price is not None:
            return self.price
        return PriceSnapshot(
            price_id=price_id,
            product_id="prod_test_listing_right",
            unit_amount=4900,
            currency="eur",
            active=True,
            recurring=False,
        )


def unavailable():
    return StripeUnavailable("Stripe is unreachable in this test.")
