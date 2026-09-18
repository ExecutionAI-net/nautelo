"""Named-key cache isolation for this package.

The project's cache is a real, shared Redis instance. NEVER call cache.clear()
here: Django's RedisCache.clear() is a FLUSHDB and would wipe keys owned by
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
