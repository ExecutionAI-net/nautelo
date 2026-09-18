import pytest
from django.conf import settings
from django.core.cache import cache


def clear_own_cache_keys():
    """Delete only the cache keys under this checkout's KEY_PREFIX.

    Django's RedisCache.clear() is a FLUSHDB, which would also delete keys owned by
    other worktrees' concurrently running test suites sharing the same Redis DB.
    """
    prefix = settings.CACHES["default"]["KEY_PREFIX"]
    client = cache._cache.get_client(write=True)
    keys = list(client.scan_iter(match=f"{prefix}:*", count=500))
    if keys:
        client.delete(*keys)


@pytest.fixture(autouse=True)
def clear_redis_cache():
    """Isolate cache-backed state (DRF throttles) between tests.

    This clears only keys under the per-checkout KEY_PREFIX set in
    config/settings/test.py (never a whole-DB flush). This fixture - not a settings
    override - is how cache isolation is achieved, because config/settings/test.py
    must keep the real Redis CACHES backend (spec 34.2).
    """
    clear_own_cache_keys()
    yield
    clear_own_cache_keys()
