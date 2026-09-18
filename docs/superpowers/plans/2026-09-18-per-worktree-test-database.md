# Per-Worktree Test Database Names Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop concurrent `pytest` runs from different local git worktrees from colliding on Django's default test-database name, by giving each worktree checkout its own, automatically-derived test database name — with zero manual per-worktree setup and no change to CI's already-working behavior.

**Architecture:** `backend/config/settings/test.py` derives a short stable hash from `BASE_DIR` (the settings package's own absolute path — already computed in `base.py`, and unique per worktree because each worktree lives in its own directory) and uses it to set `DATABASES["default"]["TEST"]["NAME"]`. The override is skipped whenever `GITHUB_ACTIONS=true` (the signal GitHub Actions itself sets on every job, already used by this repo's `.github/workflows/ci.yml`), so CI keeps Django's default `test_<db name>` naming untouched.

**Tech Stack:** Django 5.2 test settings module (`config.settings.test`), Python stdlib `hashlib`/`os`, pytest-django, PostgreSQL 16 (shared local dev instance at `127.0.0.1:5433`, per `docker-compose.yml`).

**Spec:** No entry in `NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md` — this is a local dev-tooling fix, not a product feature. Prior art: [`docs/superpowers/plans/2026-09-17-phase-0-1-infrastructure.md`](2026-09-17-phase-0-1-infrastructure.md) (Task 3, where `config/settings/test.py` was first created) and [`ACTIVITY.md`](../../../ACTIVITY.md) (the project's running log/conventions file).

## Global Constraints

- Every worktree's `backend/.env` has an identical `DATABASE_URL`, pointing at the one shared local Postgres instance (`postgres://nautelo:nautelo@127.0.0.1:5433/nautelo`) — this is intentional (one Postgres container for all worktrees) and out of scope to change.
- The fix must require no new environment variable and no manual step when a new worktree is created — it must work from the existing, already-copied `backend/.env` alone.
- CI's test-database naming must be byte-for-byte unaffected — CI already runs one job at a time against its own fresh, ephemeral Postgres service container, so it has no collision problem to fix.

---

## File Structure

```
backend/
└── config/
    └── settings/
        └── test.py       # modified: per-worktree TEST NAME override
ACTIVITY.md                # modified: new log entry documenting the convention
```

---

### Task 1: Reproduce the collision, add the per-worktree test database name, verify, document

**Files:**
- Modify: `backend/config/settings/test.py`
- Modify: `ACTIVITY.md`

**Interfaces:**
- Consumes: `BASE_DIR` (a `pathlib.Path`, already defined in `backend/config/settings/base.py:7` and available in `test.py` via `from .base import *`).
- Produces: `DATABASES["default"]["TEST"]["NAME"]` set to `f"test_nautelo_{sha1(BASE_DIR)[:10]}"` for any local run; left at Django's default (`test_nautelo`) whenever `GITHUB_ACTIONS=true`.

- [x] **Step 1: Reproduce the collision (before the fix)**

From two different local git worktrees of this repo that both already have a `backend/.env` pointing at the shared Postgres (`127.0.0.1:5433`), start `pytest` in both at (approximately) the same moment:

```bash
# terminal / process A, in worktree A's backend/
uv run python -m pytest -q

# terminal / process B, in worktree B's backend/ — started within ~1s of A
uv run python -m pytest -q
```

Expected (current, unfixed behavior): at least one of the two runs fails during test-database setup. The failure surfaces as a `pytest` internal error rather than a clear database error — look for `assert not self._finalizers` from `_pytest/fixtures.py` in the traceback, and scroll up from there to the real cause: `django.db.utils.OperationalError` / `psycopg.errors.DuplicateDatabase` (`database "test_nautelo" already exists`) or `psycopg.errors.ObjectInUse` (`database "test_nautelo" is being accessed by other users`). This confirms both worktrees computed the identical test database name (`test_nautelo`) and raced to create/drop it against the one shared Postgres instance.

- [x] **Step 2: Implement the per-worktree test database name**

Modify `backend/config/settings/test.py`:

```python
import hashlib
import os

from .base import *  # noqa: F401,F403

DEBUG = False
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
if os.environ.get("GITHUB_ACTIONS") != "true":
    _worktree_suffix = hashlib.sha1(str(BASE_DIR).encode()).hexdigest()[:10]
    DATABASES["default"]["TEST"] = {"NAME": f"test_nautelo_{_worktree_suffix}"}
```

- [x] **Step 3: Verify the fix resolves the collision**

Repeat Step 1's exact two-worktree concurrent run, now with the fix applied in both worktrees (in a real multi-worktree setup this lands once `dev` is updated and each worktree's branch is rebased/merged past this commit; for this verification, apply the same `test.py` change temporarily to both worktrees under test).

```bash
# terminal / process A, in worktree A's backend/
uv run python -m pytest -q

# terminal / process B, in worktree B's backend/ — started within ~1s of A
uv run python -m pytest -q
```

Expected: both runs complete cleanly with no `DuplicateDatabase`/`ObjectInUse`/`assert not self._finalizers` failures. Confirm the two worktrees actually used different database names, e.g. via Postgres:

```bash
docker compose exec postgres psql -U nautelo -d nautelo -c "SELECT datname FROM pg_database WHERE datname LIKE 'test_nautelo%';"
```

Expected: while both runs are in flight, two distinct `test_nautelo_<hash>` rows appear (not a single shared `test_nautelo`).

- [x] **Step 4: Run the full backend suite once, alone, to confirm no regressions**

```bash
cd backend
uv run python -m pytest -q
```

(Using `python -m pytest` rather than bare `pytest` — bare `pytest` is sometimes blocked by this machine's Windows Application Control policy.)

Expected: the same pass count as before this change (no test newly fails or is newly skipped because of the `TEST` override).

- [x] **Step 5: Document the convention**

Add a new entry at the top of the `## Log` section in `ACTIVITY.md` (after the `## Log` heading, before the existing `### 2026-09-18 — Phase 11 …` entry):

```markdown
### 2026-09-18 — Local dev: per-worktree test database names

- Problem: this project's local dev workflow runs many concurrent git worktrees against one shared Postgres instance (identical `DATABASE_URL` in every worktree's `backend/.env`). Django's test runner names the test database `test_<db name>` by default, so simultaneous `pytest` runs from two or more worktrees raced to create/drop the identical `test_nautelo` database — surfacing as a confusing `assert not self._finalizers` failure in `_pytest/fixtures.py`, with the real cause (`psycopg.errors.DuplicateDatabase` / `ObjectInUse`) further up the traceback. Independently observed and confirmed environmental (not a code defect) by two reviewers on 2026-09-18 while reviewing Phase 3 Task 9 and Phase 11 Task 6.
- Fix: `backend/config/settings/test.py` now derives `DATABASES["default"]["TEST"]["NAME"]` from a hash of the settings module's own `BASE_DIR` (unique per worktree checkout, since each worktree is its own directory) whenever `GITHUB_ACTIONS` is not `"true"`. This needs no new env var and no manual step — a freshly created worktree gets a distinct test database name automatically, the moment its `backend/.env` (copied from `.env.example`, unchanged) is in place. CI is unaffected: GitHub Actions sets `GITHUB_ACTIONS=true` on every job, so CI keeps Django's default `test_nautelo` name, which is fine there since CI already runs one job at a time against its own fresh, ephemeral Postgres service.
- Verified: reproduced the collision with two concurrent `pytest` runs from two worktrees against the shared Postgres before the fix (`DuplicateDatabase`/`ObjectInUse`), confirmed it no longer occurs after, and ran the full backend suite once more to confirm no regressions.
```

- [x] **Step 6: Commit**

```bash
git add backend/config/settings/test.py ACTIVITY.md docs/superpowers/plans/2026-09-18-per-worktree-test-database.md
git commit -m "fix(backend): give each local worktree its own test database name"
```

---

## Self-Review Notes

- **Spec coverage:** no product spec section applies (dev-tooling only); every item in the user's request is covered — root cause (Step 1), env-derived per-worktree name (Step 2, option (a) from the request), CI left untouched (Step 2's `GITHUB_ACTIONS` gate), documented convention that's automatic for new worktrees (Step 5), full suite run (Step 4), and actual before/after reproduction (Steps 1 and 3).
- **Why path-hash over an env var:** an env var (e.g. `WORKTREE_ID` in `.env`) would need every new worktree's `.env` to be created with that var set correctly and uniquely — a manual step that's easy to forget or copy-paste wrong (two worktrees with the same ID silently re-collide). Hashing `BASE_DIR` needs nothing beyond what already exists (the worktree's own checkout path), so it is the zero-config option.
- **Why not `--reuse-db` / `-n auto`:** these change *when* the database is recreated or *how many* workers share one run — they don't give concurrent, independent `pytest` invocations (the actual failure mode here) distinct database names, so they mask symptoms at best (per the user's own framing) rather than fixing the root cause.
- **pytest-django + xdist note:** pytest-django already appends a per-worker suffix (`_gwN`) to the test database name when a *single* `pytest` invocation uses `-n auto`. That mechanism is unrelated to and unaffected by this fix — this fix addresses collisions *between separate* `pytest` invocations (different worktrees), not workers within one invocation.
