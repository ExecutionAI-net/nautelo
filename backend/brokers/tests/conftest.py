import pytest
from django.core.cache import cache

from messaging.enums import UNIFIED_INQUIRIES_FLAG
from platform_settings.services import SETTINGS_CACHE_KEY, feature_flag_cache_key

#: Flags this package's tests toggle. Listed so the fixture below clears exactly
#: these entries and nothing else.
BROKER_FEATURE_FLAG_KEYS = [UNIFIED_INQUIRIES_FLAG]


@pytest.fixture(autouse=True)
def _clear_broker_caches():
    """Delete this package's OWN cache keys around every test.

    NEVER `cache.clear()`. Django's RedisCache.clear() is a FLUSHDB, and this
    project's test Redis DB is shared by concurrently running worktrees — which
    is why backend/conftest.py was rewritten to scan and delete only its own
    KEY_PREFIX. The same narrow shape as messaging/tests/conftest.py and
    listings/tests/conftest.py: named keys, by name.
    """

    def _clear():
        cache.delete(SETTINGS_CACHE_KEY)
        for key in BROKER_FEATURE_FLAG_KEYS:
            cache.delete(feature_flag_cache_key(key))

    _clear()
    yield
    _clear()
