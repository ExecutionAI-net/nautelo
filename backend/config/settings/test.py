import hashlib
import os

from .base import *  # noqa: F401,F403

DEBUG = False
# Existing pipeline tests upload header-only synthetic images Pillow cannot decode;
# the sanitizer has its own tests that enable it explicitly.
MEDIA_IMAGE_SANITIZER = None
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

# Local dev runs several git worktrees against one shared Postgres instance (every
# worktree's backend/.env points at the same DATABASE_URL). Django's test runner
# names the test database "test_<db name>" by default, so concurrent `pytest` runs
# from different worktrees race to create/drop the identical "test_nautelo" database,
# surfacing as psycopg DuplicateDatabase/ObjectInUse errors. Giving each worktree its
# own test database name, derived from its own checkout path, removes the collision
# with no manual per-worktree setup. Skipped in CI: GitHub Actions sets
# GITHUB_ACTIONS=true on every job, and CI already runs one job at a time against its
# own fresh, ephemeral Postgres service, so it keeps Django's default name unchanged.
_worktree_suffix = hashlib.sha1(str(BASE_DIR).encode()).hexdigest()[:10]

# The same worktrees also share one Redis DB. Django's RedisCache.clear() is a FLUSHDB,
# so one worktree's per-test cache clear used to wipe throttle buckets and feature-flag
# entries out from under another worktree's concurrently running suite (order-dependent
# flakes). A per-checkout KEY_PREFIX namespaces every key; conftest.py then clears only
# keys under that prefix instead of flushing the DB.
CACHES["default"]["KEY_PREFIX"] = f"test_{_worktree_suffix}"  # noqa: F405

if os.environ.get("GITHUB_ACTIONS") != "true":
    DATABASES["default"]["TEST"] = {"NAME": f"test_nautelo_{_worktree_suffix}"}
