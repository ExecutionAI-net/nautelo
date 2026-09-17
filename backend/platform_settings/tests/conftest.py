import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache

from platform_settings.services import SETTINGS_CACHE_KEY, feature_flag_cache_key

# Feature flag keys used across this test package — kept in one place so
# every test starts from (and leaves behind) a clean cache, since this
# project's Redis cache is real and shared across test runs, not an
# in-memory backend that resets itself (see the ADR note in Task 3).
TEST_FEATURE_FLAG_KEYS = ["finance_estimates"]


@pytest.fixture(autouse=True)
def _clear_platform_settings_cache():
    def _clear():
        cache.delete(SETTINGS_CACHE_KEY)
        for key in TEST_FEATURE_FLAG_KEYS:
            cache.delete(feature_flag_cache_key(key))

    _clear()
    yield
    _clear()


@pytest.fixture
def staff_user(db):
    User = get_user_model()
    return User.objects.create_user(
        username="staff-settings",
        email="staff-settings@nautelo.local",
        password="pw",
        is_staff=True,
    )
