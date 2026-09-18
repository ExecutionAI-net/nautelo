import pytest
from django.core.cache import cache


@pytest.fixture(autouse=True)
def _clear_services_catalog_cache():
    """Start and end every test in this package with an empty cache.

    Redis is real here (config/settings/test.py must never downgrade CACHES to
    LocMemCache), so both the feature-flag value cached by is_feature_enabled
    and the DRF throttle counters for the shared `services_directory` scope
    survive from one test to the next. A blanket clear is what
    platform_settings/tests/conftest.py does for its own package; this is the
    same fixture widened to the whole cache, because throttle keys are HMACs of
    the client IP and cannot be enumerated to delete individually.
    """
    cache.clear()
    yield
    cache.clear()
