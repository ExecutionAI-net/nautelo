"""Named-key cache isolation for this package.

The project's cache is a real, shared Redis instance. NEVER clear the whole cache
here: Django's RedisCache whole-cache clear wipes the entire Redis DB and would wipe keys owned by
other worktrees' concurrently running suites. Delete named keys only — the same
pattern as entitlements/tests/conftest.py and listings/tests/conftest.py.
"""

import pytest
from django.core.cache import cache

from platform_settings.services import SETTINGS_CACHE_KEY, feature_flag_cache_key

PAYMENTS_FEATURE_FLAG_KEYS = ["stripe_entitlement_checkout", "individual_entitlements"]


@pytest.fixture(autouse=True)
def _clear_payment_caches():
    def _clear():
        cache.delete(SETTINGS_CACHE_KEY)
        for key in PAYMENTS_FEATURE_FLAG_KEYS:
            cache.delete(feature_flag_cache_key(key))

    _clear()
    yield
    _clear()


@pytest.fixture
def checkout_enabled(db):
    """Turn spec §35.1's `stripe_entitlement_checkout` flag on for one test."""
    from platform_settings.services import set_feature_flag

    set_feature_flag(key="stripe_entitlement_checkout", is_enabled=True, actor=None)


@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    """Make ANY real Stripe HTTP call fail loudly, by any route.

    Tests must never open a socket. Every service in this app takes a `gateway`
    argument, so a test that forgets to pass one would otherwise fall through to
    `default_gateway()` and hang CI on a connection timeout.

    Patching `stripe.StripeClient` alone is NOT enough: the library keeps its
    legacy module-level surface (`stripe.checkout.Session.create`,
    `stripe.Price.retrieve`, `stripe.Refund.create`, ...) which builds its own
    requestor from `stripe.api_key` and never touches `StripeClient`. So the
    real guard is the one chokepoint every HTTP call funnels through,
    `stripe._api_requestor._APIRequestor.request_raw`, patched here for both the
    sync and async paths. `StripeClient` is patched as well, purely so the more
    common mistake gets the clearer message.

    `stripe._api_requestor` is a private module. That is accepted for a test
    guard; `test_an_unmocked_legacy_stripe_call_is_blocked` fails loudly if a
    library upgrade moves it, which is exactly when this fixture needs revising.

    `stripe.Webhook.construct_event` is deliberately NOT patched: it performs no
    I/O, and verifying Stripe's real HMAC scheme is the entire point of
    test_webhook_security.py.
    """
    import stripe
    from stripe import _api_requestor

    def _forbidden_http(*args, **kwargs):
        raise AssertionError(
            "A test tried to make a real Stripe HTTP request. Pass a "
            "FakeStripeGateway via the service's `gateway=` argument instead."
        )

    def _forbidden_client(*args, **kwargs):
        raise AssertionError(
            "A test constructed a real Stripe API client. Pass a FakeStripeGateway "
            "via the service's `gateway=` argument instead."
        )

    monkeypatch.setattr(stripe, "StripeClient", _forbidden_client)
    monkeypatch.setattr(
        _api_requestor._APIRequestor, "request_raw", _forbidden_http, raising=True
    )
    monkeypatch.setattr(
        _api_requestor._APIRequestor, "request_raw_async", _forbidden_http, raising=True
    )


@pytest.fixture
def fake_gateway():
    from payments.tests.fakes import FakeStripeGateway

    return FakeStripeGateway()
