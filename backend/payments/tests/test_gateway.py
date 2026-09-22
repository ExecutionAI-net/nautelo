"""The one place this codebase talks to Stripe, and the guard that keeps tests
off the network."""

import inspect

import pytest
import stripe

from payments.errors import PaymentGatewayUnavailable, ProductNotAvailable
from payments.gateway import (
    CheckoutSessionResult,
    PriceSnapshot,
    ProductWithPrice,
    StripeApiGateway,
    StripeGateway,
    StripeUnavailable,
    default_gateway,
)
from payments.tests.fakes import FakeStripeGateway


def test_the_fake_and_the_real_gateway_have_identical_signatures():
    """A drifted fake is a test suite that proves nothing about production."""
    for name in ("create_checkout_session", "retrieve_price", "list_active_products_with_prices"):
        real = inspect.signature(getattr(StripeApiGateway, name))
        fake = inspect.signature(getattr(FakeStripeGateway, name))
        # Names and kinds only: the fake carries no annotations.
        assert [(p.name, p.kind) for p in real.parameters.values()] == [
            (p.name, p.kind) for p in fake.parameters.values()
        ], name


def test_both_gateways_satisfy_the_protocol(monkeypatch):
    monkeypatch.setattr(stripe, "StripeClient", lambda api_key, **kw: object())
    assert isinstance(FakeStripeGateway(), StripeGateway)
    assert isinstance(StripeApiGateway(api_key="sk_test_unit"), StripeGateway)


def test_the_real_gateway_never_reads_the_secret_at_import_time():
    """Constructing the module must not require a configured Stripe account, and
    the key must not be captured into module state where a traceback could
    print it."""
    source = inspect.getsource(StripeApiGateway)
    assert "STRIPE_SECRET_KEY" not in source


def test_the_secret_is_never_in_the_gateways_repr(monkeypatch):
    """A gateway landing in a traceback, a Sentry frame or a log line must not
    carry the live secret key with it."""
    monkeypatch.setattr(stripe, "StripeClient", lambda api_key, **kw: object())
    gateway = StripeApiGateway(api_key="sk_live_REDACT_ME")

    assert "sk_live_REDACT_ME" not in repr(gateway)


def test_default_gateway_builds_a_real_client_from_settings(settings, monkeypatch):
    settings.STRIPE_SECRET_KEY = "sk_test_from_settings"
    seen = {}

    def _client(api_key, **kwargs):
        seen["api_key"] = api_key
        return object()

    monkeypatch.setattr(stripe, "StripeClient", _client)

    gateway = default_gateway()

    assert isinstance(gateway, StripeApiGateway)
    assert seen["api_key"] == "sk_test_from_settings"


def test_the_no_network_fixture_blocks_a_real_client(db):
    """Proves the guard in conftest.py is armed — without this, a later test
    that forgot its `gateway=` argument would hang CI instead of failing."""
    with pytest.raises(AssertionError, match="real Stripe API client"):
        stripe.StripeClient("sk_test_anything")


def test_an_unmocked_legacy_stripe_call_is_blocked(db, monkeypatch):
    """The half `StripeClient` patching misses.

    `stripe.Price.retrieve` is the legacy module-level surface: it builds its
    own requestor from `stripe.api_key` and never touches `StripeClient`, so a
    service written against it would have opened a real socket under the old
    guard. If this test starts failing with something other than the
    AssertionError below, a library upgrade has moved the chokepoint and
    conftest's `no_network` needs revising before anything else in this app is
    trusted.
    """
    # monkeypatch, not a bare assignment: `stripe.api_key` is module-global and
    # a leaked value would follow every later test in the session.
    monkeypatch.setattr(stripe, "api_key", "sk_test_anything")
    with pytest.raises(AssertionError, match="real Stripe HTTP request"):
        stripe.Price.retrieve("price_anything")


def test_the_fake_records_what_the_caller_asked_for():
    gateway = FakeStripeGateway()

    result = gateway.create_checkout_session(
        params={"mode": "payment"}, idempotency_key="checkout:abc"
    )

    assert result == CheckoutSessionResult(
        session_id="cs_test_fake",
        url="https://checkout.stripe.com/c/pay/cs_test_fake",
    )
    assert gateway.created == [
        {"params": {"mode": "payment"}, "idempotency_key": "checkout:abc"}
    ]


def test_the_fake_can_raise_the_transport_error_the_real_one_raises():
    gateway = FakeStripeGateway(raise_on_create=StripeUnavailable("boom"))

    with pytest.raises(StripeUnavailable):
        gateway.create_checkout_session(params={}, idempotency_key="k")


def test_a_price_snapshot_carries_everything_reconciliation_needs():
    snapshot = PriceSnapshot(
        price_id="price_x",
        product_id="prod_x",
        unit_amount=4900,
        currency="eur",
        active=True,
        recurring=False,
    )

    assert snapshot.unit_amount == 4900
    # Stripe returns currency lower-cased; normalization is the caller's job and
    # is tested in test_products.py.
    assert snapshot.currency == "eur"


@pytest.mark.parametrize(
    ("exception", "code", "status"),
    [
        (ProductNotAvailable(), "product_not_available", 409),
        (PaymentGatewayUnavailable(), "payment_gateway_unavailable", 502),
    ],
)
def test_error_codes_are_api_exception_codes_not_validation_errors(
    exception, code, status
):
    """`common.exceptions` flattens every ValidationError to `validation_error`,
    so a code a client must branch on cannot be one. Read that handler before
    changing any error class in this app."""
    from rest_framework.exceptions import ValidationError

    assert not isinstance(exception, ValidationError)
    assert exception.default_code == code
    assert exception.status_code == status


def test_an_error_may_carry_meta_but_never_a_secret():
    error = ProductNotAvailable(product_code="INDIVIDUAL_LISTING_RIGHT")

    assert error.meta == {"product_code": "INDIVIDUAL_LISTING_RIGHT"}


class _FakePrice:
    def __init__(self, id, unit_amount, currency):
        self.id = id
        self.unit_amount = unit_amount
        self.currency = currency


class _FakeProduct:
    def __init__(self, id, name, default_price):
        self.id = id
        self.name = name
        self.default_price = default_price


class _FakePage:
    def __init__(self, items):
        self._items = items

    def auto_paging_iter(self):
        return iter(self._items)


def test_list_active_products_with_prices_reads_the_expanded_default_price(monkeypatch):
    products = _FakePage(
        [
            _FakeProduct("prod_a", "Boutique Broker", _FakePrice("price_a", 29900, "eur")),
            # No default price configured on the product: skipped, not guessed.
            _FakeProduct("prod_b", "No Price Yet", None),
            # Stripe did not expand it (a bare id string): also skipped.
            _FakeProduct("prod_c", "Not Expanded", "price_c"),
        ]
    )

    class _FakeClient:
        def __init__(self, api_key, **kwargs):
            self.v1 = self

        @property
        def products(self):
            return self

        def list(self, params):
            assert params == {"active": True, "expand": ["data.default_price"], "limit": 100}
            return products

    monkeypatch.setattr(stripe, "StripeClient", _FakeClient)
    gateway = StripeApiGateway(api_key="sk_test_unit")

    result = gateway.list_active_products_with_prices()

    assert result == [
        ProductWithPrice(
            product_id="prod_a",
            product_name="Boutique Broker",
            price_id="price_a",
            unit_amount=29900,
            currency="eur",
        )
    ]


def test_list_active_products_with_prices_translates_a_stripe_error(monkeypatch):
    class _FakeClient:
        def __init__(self, api_key, **kwargs):
            self.v1 = self

        @property
        def products(self):
            return self

        def list(self, params):
            raise stripe.StripeError("boom")

    monkeypatch.setattr(stripe, "StripeClient", _FakeClient)
    gateway = StripeApiGateway(api_key="sk_test_unit")

    with pytest.raises(StripeUnavailable):
        gateway.list_active_products_with_prices()
