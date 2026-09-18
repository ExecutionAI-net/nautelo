import redis
from django.conf import settings
from django.core.cache import cache

from conftest import clear_own_cache_keys


def test_cache_keys_are_namespaced_per_checkout():
    assert settings.CACHES["default"]["KEY_PREFIX"].startswith("test_")


def test_clearing_own_cache_leaves_other_checkouts_keys_alone():
    """Concurrent pytest runs from other worktrees share one Redis DB; flushing the
    whole DB (Django's RedisCache.clear()) would delete their throttle/flag keys."""
    foreign = redis.Redis.from_url(settings.CACHES["default"]["LOCATION"])
    foreign.set("test_someotherworktree:1:probe", "x", ex=60)
    cache.set("mine", 1, timeout=60)
    try:
        clear_own_cache_keys()
        assert cache.get("mine") is None
        assert foreign.get("test_someotherworktree:1:probe") == b"x"
    finally:
        foreign.delete("test_someotherworktree:1:probe")
