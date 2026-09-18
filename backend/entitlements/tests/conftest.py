import pytest
from django.core.cache import cache

from platform_settings.services import SETTINGS_CACHE_KEY, feature_flag_cache_key

# This project's cache is a real, shared Redis instance, not an in-memory
# backend that resets between runs, so every test in this package starts from
# and leaves behind a clean cache (same pattern as listings/tests).
ENTITLEMENT_FEATURE_FLAG_KEYS = ["individual_entitlements", "listing_revisions"]


@pytest.fixture(autouse=True)
def _clear_entitlement_caches():
    def _clear():
        cache.delete(SETTINGS_CACHE_KEY)
        for key in ENTITLEMENT_FEATURE_FLAG_KEYS:
            cache.delete(feature_flag_cache_key(key))

    _clear()
    yield
    _clear()


@pytest.fixture
def entitlements_enforced(db):
    """Turn spec §35.1's `individual_entitlements` flag on for one test."""
    from platform_settings.services import set_feature_flag

    set_feature_flag(key="individual_entitlements", is_enabled=True, actor=None)
