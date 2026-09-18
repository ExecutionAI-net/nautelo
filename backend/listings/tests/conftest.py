import pytest
from django.core.cache import cache

from platform_settings.services import SETTINGS_CACHE_KEY, feature_flag_cache_key

# This project's cache is a real, shared Redis instance, not an in-memory
# backend that resets between runs, so every test in this package starts from
# and leaves behind a clean cache (same pattern as platform_settings/tests).
LISTINGS_FEATURE_FLAG_KEYS = ["listing_revisions"]


@pytest.fixture(autouse=True)
def _clear_listings_caches():
    def _clear():
        cache.delete(SETTINGS_CACHE_KEY)
        for key in LISTINGS_FEATURE_FLAG_KEYS:
            cache.delete(feature_flag_cache_key(key))

    _clear()
    yield
    _clear()
