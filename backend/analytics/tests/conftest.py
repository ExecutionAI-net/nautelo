"""Package-local fixtures for analytics tests.

There is deliberately NO cache-clearing fixture here. `backend/conftest.py`
already carries a root autouse `clear_redis_cache` fixture that deletes every key
under this checkout's `KEY_PREFIX` before and after EVERY test in the project —
including `platform_settings`' feature-flag cache keys, which is the only cached
state this package touches. (It deletes the checkout's own keys by name rather
than clearing the whole cache, because Django's RedisCache whole-cache clear wipes the entire Redis DB and would
wipe a parallel worktree's suite.) A second, narrower fixture doing the same job
here would be redundant and would imply the root one cannot be relied on. (Phase
5's Task 6 made the same consolidation for `services_catalog/tests/`: one fixture,
at the outermost level that owns the problem, and no per-file duplicates.)
"""

import pytest


@pytest.fixture
def view_counting_enabled(db):
    """Spec §35.2 step 9. The flag ships disabled, so every test that expects a
    row to be written must turn it on explicitly.

    Both imports are function-local on purpose: this conftest is collected for
    the whole `analytics/tests/` package, and `analytics.recording` does not
    exist until Step 4 of this task. A module-level import would fail collection
    for every test file in the package — including the Task 2 and Task 3 suites
    that are already green — rather than only for the file under construction.
    """
    from analytics.recording import UNIQUE_LISTING_VIEWS_FLAG
    from platform_settings.services import set_feature_flag

    set_feature_flag(key=UNIQUE_LISTING_VIEWS_FLAG, is_enabled=True, actor=None)
