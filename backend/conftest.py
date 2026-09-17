import pytest
from django.core.cache import cache


@pytest.fixture(autouse=True)
def clear_redis_cache():
    """Isolate cache-backed state (DRF throttles) between tests.

    NOTE: this flushes the Redis logical DB pointed at by REDIS_URL. That DB is a
    pure cache and nothing durable may ever be stored in it. This fixture - not a
    settings override - is how cache isolation is achieved, because
    config/settings/test.py must keep the real Redis CACHES backend (spec 34.2).
    """
    cache.clear()
    yield
    cache.clear()
