# NAUTA Phase 3 — Identity, Organizations and Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce NAUTA's custom `User` model, broker organizations/memberships and professional profiles, and build the server-side role, ownership and email-verification enforcement layer that every later phase authorizes against.

**Architecture:** Three new Django apps — `accounts` (custom `AUTH_USER_MODEL`, JWT auth endpoints, permission classes, authorization services, session/permissions endpoint), `brokers` (`BrokerOrganization`, `BrokerMembership`) and `professionals` (`ProfessionalProfile`). Authorization is expressed once, in `accounts/services.py` (pure functions over real DB rows) and `accounts/permissions.py` (thin DRF wrappers around those functions); no view, serializer or frontend component re-derives a rule. JWTs carry **only** `user_id` — roles, memberships and permissions are always re-read from the database per request, so a role change or suspension takes effect on the next request rather than at token expiry. The frontend derives navigation from `GET /api/v1/session/`, but every route is independently re-checked server-side.

**Tech Stack:** Python 3.13 + `uv`, Django 5.2, Django REST Framework, `djangorestframework-simplejwt` (already configured in Phase 1), PostgreSQL 16, Redis (cache + Celery broker), Celery (`notifications` queue for verification email); **Next.js 16.3.5** (App Router, TypeScript), **Tailwind CSS v4**, `pnpm`, Vitest + Testing Library (introduced by this plan).

**Version-drift check (do this before writing any App Router code):** the scaffolded frontend is Next.js **16.3.5** with Tailwind **v4**, as Phase 0/1's `ACTIVITY.md` records — not the 15.x that a model's training data is likely to assume. `frontend/AGENTS.md` flags this risk explicitly. Before using any App Router API in Tasks 10–12 (`useSearchParams`, `useRouter`, `redirect`, route handlers, `params`/`searchParams` shapes, metadata exports, `next/navigation` surface), verify the signature against the installed version — `frontend/node_modules/next/dist/docs/`, `frontend/node_modules/next/package.json`, or the project's own `frontend/AGENTS.md` — rather than from memory. Several of these changed between 15 and 16 (notably around async `params`/`searchParams`).

**Spec:** [`NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md`](../../../NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md) — primarily §12 (Phase 3), §11.1 (accounts and organizations data model), §5 (roles and permissions), §1 (fixed product decisions), §2 (non-negotiable principles), §30 (API inventory and conventions), §34.2/§34.3 (test strategy) and §39 (developer execution protocol).

**Predecessor plan:** [`2026-09-17-phase-0-1-infrastructure.md`](./2026-09-17-phase-0-1-infrastructure.md). Read its "Known Limitations" section before starting. This plan closes two of them: "JWT is configured but there is no endpoint to obtain a token yet" and "No frontend automated test tooling (Vitest/Playwright) yet".

## Execution Model

Same per-task PR model as the Phase 0/1 plan: branch off the current tip of `dev` (`git checkout -b task-N-<slug> dev`), run the implementer → task-reviewer → fix-loop cycle on that branch, open a PR into `dev`, merge only when CI is green and the branch merges cleanly. Tasks are strictly sequential; never two implementers in parallel.

## Global Constraints

- Backend: Python 3.13 (see the Phase 0/1 plan's Task 3 ruling — the spec's floor is "3.12+", 3.13 is what this machine permits), Django 5.2 LTS, DRF for all JSON APIs, `djangorestframework-simplejwt` for tokens, PostgreSQL 16+, Redis, Celery (spec §3).
- Backend dev server port is **8020**; frontend dev server port is **3020** (Phase 0/1 Task 4 "Ruling A" — the 8000/3000 defaults are occupied on this machine). Dockerized Postgres is `127.0.0.1:5433`, Redis `127.0.0.1:6380`, MinIO `127.0.0.1:9010`.
- **Tests run against PostgreSQL, never SQLite** (spec §34.2: "Use PostgreSQL in CI for tests that depend on production constraints/locking; SQLite is insufficient"). `backend/config/settings/test.py` MUST NOT be modified to override `DATABASES` or `CACHES` to SQLite / `LocMemCache`. This rule was violated and reverted once already in this project — if a test is slow or awkward against real Postgres/Redis, fix the test, never the settings.
- No partial or visual-only implementations, no faked/hardcoded demo data, no TODO placeholders for backend enforcement (spec §39). Every visible state maps to a real backend source (spec §2.1).
- TDD per task: write the failing test, run it and see it fail, write the minimal implementation, run it and see it pass, commit.
- All primary keys are UUIDs; all timestamps are timezone-aware UTC (spec §11 preamble). `USE_TZ = True` is already set.
- Permissions and roles are enforced server-side through DRF permission classes and domain services. Client-supplied role, ownership, `seller_type` or organization identifiers are never trusted (spec §2.2, §12).
- Roles are additive Django permissions/groups, but each account has exactly one primary marketplace role (spec §5).
- JWT lifetimes configured in Phase 1 (`ACCESS_TOKEN_LIFETIME` 15 min, `REFRESH_TOKEN_LIFETIME` 7 days, both env-driven) are **not** changed by this plan. This plan only *adds* three `SIMPLE_JWT` keys — `ROTATE_REFRESH_TOKENS`, `BLACKLIST_AFTER_ROTATION` and `UPDATE_LAST_LOGIN` (so `User.last_login` is populated for the admin user list and Task 12's handoff note) — plus the `token_blacklist` app (all in Task 4).
- Rate limiting is introduced in **Task 3**, not Task 4, so no auth endpoint ever exists unthrottled. Task 3 makes `common.throttling.HashedIPScopedRateThrottle` the project's `DEFAULT_THROTTLE_CLASSES` entry: it HMAC-hashes the client IP with `CONTACT_HASH_SECRET` before the cache key is built, because spec §30.4 forbids rate limiting from storing raw IPs. Two scopes are added by this plan: `auth` (`10/min`; login, logout, register, verify-email, resend) and `auth-refresh` (`30/min`; silent token refresh only) — on top of the `taxonomy_search` (`60/min`) rate already merged from Phase 4. **Every new throttled view from this phase onward uses `HashedIPScopedRateThrottle`**, and later phases add their own scopes to `DEFAULT_THROTTLE_RATES` rather than introducing another throttle class.
  - **Known gap (pre-existing, out of scope for this plan):** the already-merged `taxonomy/views.py` pins `throttle_classes = [ScopedRateThrottle]` on its two search views, so those two views keep using DRF's stock class — raw IP in the cache key — even after Task 3 changes the project default. Changing the default does not reach them, because a view-level `throttle_classes` overrides it. `taxonomy` is already merged and this plan does not modify it; the fix (deleting those two `throttle_classes` lines so the views inherit the project default) belongs to a future cleanup pass. See Known Limitations.
- Secrets never appear in logs, repository files or staff-editable settings; raw verification tokens are never logged (spec §33.5).
- Every error response uses the spec §30.2 envelope: stable machine `code`, user-safe `message`, `fields` map, `request_id`.
- **Where a task says "append to" an existing module, its code block repeats the imports that block needs.** Consolidate them into the module's single import section at the top rather than leaving duplicate or mid-file `import` statements — `accounts/views.py`, `accounts/serializers.py` and `accounts/services.py` each grow across three or four tasks. **Every import in this plan belongs at the top of its module**, including `accounts/services.py`'s `from accounts.tasks import send_email_verification_email` (Task 3): `accounts/tasks.py` imports only `accounts.models`, so that dependency is one-directional and there is no cycle to break. The only deliberate exceptions are the function-local `brokers` imports in Tasks 5 and 7, which break a real `accounts ↔ brokers` cycle and are flagged where they appear.

---

## File Structure

```
nautelo/
├── .github/workflows/ci.yml                      (modify: run frontend Vitest suite)
├── backend/
│   ├── conftest.py                               (new: root pytest fixtures)
│   ├── config/
│   │   ├── settings/base.py                      (modify: AUTH_USER_MODEL, apps, middleware,
│   │   │                                          password validators, throttle classes+rates,
│   │   │                                          exception handler, REFRESH_COOKIE_SECURE,
│   │   │                                          SIMPLE_JWT additions)
│   │   ├── settings/dev.py                       (modify: CORS credentials for cookie refresh,
│   │   │                                          REFRESH_COOKIE_SECURE = False)
│   │   └── urls.py                               (modify: include accounts + brokers URLs)
│   ├── common/
│   │   ├── models.py                             (unchanged: UUIDTimeStampedModel already
│   │   │                                          exists from Phase 2 — import, don't rewrite)
│   │   ├── middleware.py                         (new: RequestIDMiddleware)
│   │   ├── exceptions.py                         (new: nauta_exception_handler)
│   │   ├── throttling.py                         (new: HashedIPScopedRateThrottle)
│   │   ├── tests/test_request_id.py              (new)
│   │   ├── tests/test_exception_handler.py       (new)
│   │   └── tests/test_throttling.py              (new)
│   ├── accounts/
│   │   ├── __init__.py, apps.py
│   │   ├── enums.py                              (UserRole, Locale, SellerType, StaffGroup)
│   │   ├── models.py                             (User, UserManager, EmailVerificationToken)
│   │   ├── forms.py                              (admin add/change forms)
│   │   ├── admin.py
│   │   ├── cookies.py                            (refresh-cookie helpers)
│   │   ├── serializers.py
│   │   ├── services.py                           (authorization + verification services)
│   │   ├── selectors.py                          (session payload / permission map)
│   │   ├── permissions.py                        (ALL DRF permission classes, incl. the
│   │   │                                          broker-scoped IsBrokerTeamManager and
│   │   │                                          CanReadBrokerMessages — there is no
│   │   │                                          brokers/permissions.py)
│   │   ├── tasks.py                              (verification email, notifications queue)
│   │   ├── views.py
│   │   ├── urls.py
│   │   ├── migrations/0001_initial.py
│   │   ├── migrations/0002_emailverificationtoken.py
│   │   ├── migrations/0003_staff_groups.py
│   │   └── tests/                                (factories.py + test_*.py)
│   ├── brokers/
│   │   ├── enums.py, models.py, admin.py, services.py
│   │   ├── serializers.py, views.py, urls.py
│   │   ├── migrations/0001_initial.py
│   │   └── tests/                                (factories.py + test_*.py)
│   └── professionals/
│       ├── enums.py, models.py, admin.py
│       ├── migrations/0001_initial.py
│       └── tests/                                (factories.py + test_*.py)
└── frontend/
    ├── package.json                              (modify: vitest deps + test script)
    ├── vitest.config.ts                          (new)
    ├── vitest.setup.ts                           (new)
    └── src/
        ├── lib/api/client.ts                     (modify: auth header, refresh, ApiError)
        ├── lib/auth/types.ts                     (new: session contract types)
        ├── lib/auth/session.tsx                  (new: SessionProvider/useSession)
        ├── lib/auth/next-url.ts                  (new: open-redirect-safe next URL)
        ├── lib/auth/next-url.test.ts             (new)
        ├── lib/auth/session.test.tsx             (new)
        ├── components/auth/RequirePermission.tsx (new)
        ├── components/auth/ForbiddenScreen.tsx   (new)
        ├── components/layout/PrimaryNav.tsx      (new)
        ├── app/layout.tsx                        (modify: wrap in SessionProvider + nav)
        ├── app/login/page.tsx                    (new)
        ├── app/verify-email/page.tsx             (new)
        └── app/403/page.tsx                      (new)
```

**Note (already-merged phases — settled):** by the time this plan executes, **Phase 2** (shared domain types, `platform_settings`, audit foundation), **Phase 4** (`taxonomy`) and **Phase 8** (`finance`) have all merged into `dev`. Practical consequences for Phase 3, each handled where it bites:

- `backend/common/models.py` already contains `UUIDModel`, `TimeStampedModel` and `UUIDTimeStampedModel` (Phase 2's Task 1). Phase 3 **imports** `common.models.UUIDTimeStampedModel` and must not redefine, replace or delete anything in that file (Task 1, Step 4).
- Several merged migrations already declare `swappable_dependency(settings.AUTH_USER_MODEL)`. This is expected and is **not** a blocker — Task 1's Step 7 database reset handles it (Task 1, Step 1).
- Two merged conftest fixtures call `create_user(username=...)` and must be updated when the custom `User` lands (Task 1, Step 6a).
- `backend/config/settings/base.py` and `backend/config/urls.py` already carry merged entries (`taxonomy_search` throttle rate; public-settings, finance-quote and taxonomy routes). **Every settings/urls edit in this plan is additive** — read the real file, add to it, never paste over it (Tasks 2, 3 and 4). Phase 3 still defines its own identity-domain enums (`UserRole`, `Locale`, `SellerType`) in `accounts/enums.py`; those remain canonical (later phases import them from `accounts.enums`) and Phase 2's shared-types module should re-export rather than redefine them. Likewise, Phase 3 writes **no** `AuditEvent` rows — see the impersonation and auto-approval notes in Tasks 5 and 12.

---

### Task 1: Custom `User` model and `AUTH_USER_MODEL` — the one-time migration window

**This task MUST be executed first and MUST NOT be split across PRs.** Django resolves `settings.AUTH_USER_MODEL` at migration-graph build time. `django.contrib.admin`'s `0001_initial` migration declares `migrations.swappable_dependency(settings.AUTH_USER_MODEL)`, so the moment `AUTH_USER_MODEL` becomes `accounts.User`, every already-applied migration that depends on the user model must have `accounts.0001_initial` applied *before* it. Several already-merged apps (`audit`, `platform_settings`, `taxonomy`) now declare exactly that dependency, so the existing dev database's applied-migration history is about to become inconsistent — which is why Step 7 rebuilds it from scratch rather than patching it. Doing this while the only environment carrying that history is a resettable local dev database is what keeps the change cheap: **that is still true today, and it stops being true the moment a non-resettable environment exists**, after which switching the user model would require a hand-written, error-prone table-swap migration. Later phases (11, 13, …) will add further foreign keys to this model, compounding the cost with every one.

**Note (ruling — what the pre-flight check actually is, and what it is not):** by the time this task runs, **Phase 2 (`audit`, `platform_settings`), Phase 4 (`taxonomy`) and Phase 8 (`finance`) have all already merged into `dev`** and their migrations are applied in the local dev database. Several of those migrations **do** reference `settings.AUTH_USER_MODEL` — at the time of writing, `audit/migrations/0001_initial.py`, `taxonomy/migrations/0001_initial.py`, `taxonomy/migrations/0002_boatmodel.py` and `platform_settings/migrations/0001_initial.py` each declare `migrations.swappable_dependency(settings.AUTH_USER_MODEL)`.

**That is expected and is NOT a blocker.** Step 7 of this same task performs a full `dropdb`/`createdb` reset of the local dev database, and a fresh empty database re-applies the *entire* migration graph from scratch in correct dependency order — so `accounts.0001_initial` lands before every migration that depends on the swappable user model, no matter how many such migrations already exist. The reset makes the "has anything already depended on the user model?" question moot for the dev database.

Step 1 below is therefore **purely informational**: it tells the implementer which apps already point at `AUTH_USER_MODEL`, so the post-reset ordering can be sanity-checked in Step 8. **The one and only thing that should stop this task is discovering real, non-resettable PRODUCTION data in the target database.** There is none: this is a local dev Postgres holding only migration-created tables and throwaway fixtures, and it is safe to drop. If you are ever pointed at a database that *does* hold real user data, stop and escalate — a custom user model cannot be introduced by resetting that database.

**Files:**
- Create: `backend/accounts/__init__.py`, `backend/accounts/apps.py`, `backend/accounts/enums.py`, `backend/accounts/models.py`, `backend/accounts/forms.py`, `backend/accounts/admin.py`
- Create: `backend/accounts/migrations/__init__.py`, `backend/accounts/migrations/0001_initial.py` (generated)
- Create: `backend/conftest.py`
- Read-only (expected unchanged): `backend/common/models.py` — Phase 2 already defines `UUIDTimeStampedModel` there; see Step 4.
- Modify: `backend/config/settings/base.py` (add `accounts` to `INSTALLED_APPS`, set `AUTH_USER_MODEL`, add `AUTH_PASSWORD_VALIDATORS`)
- Modify: `backend/audit/tests/conftest.py` (drop the now-invalid `username=` kwarg — see Step 6a)
- Modify: `backend/platform_settings/tests/conftest.py` (drop the now-invalid `username=` kwarg — see Step 6a)
- Test: `backend/accounts/tests/__init__.py`, `backend/accounts/tests/factories.py`, `backend/accounts/tests/test_models.py`

**Interfaces:**
- Consumes (already merged from Phase 2 — imported, not redefined, by this task):
  - `common.models.UUIDTimeStampedModel` — abstract base: `id = UUIDField(primary_key=True, default=uuid.uuid4, editable=False)`, `created_at = DateTimeField(auto_now_add=True)`, `updated_at = DateTimeField(auto_now=True)`. (Phase 2 also defines `common.models.UUIDModel` and `common.models.TimeStampedModel`; this task must leave all three intact.)
- Produces (every later phase imports these exact names):
  - `accounts.enums.UserRole` — `TextChoices` with members `BUYER`, `PRIVATE_SELLER`, `BROKER`, `SERVICE_PROVIDER`, `STAFF` (each value identical to its member name).
  - `accounts.enums.Locale` — `TextChoices` with members `EN`, `IT`, `ES`.
  - `accounts.enums.SellerType` — `TextChoices` with members `PRIVATE`, `BROKER`. **Canonical definition for the whole project**; Phase 11's `BoatListing.seller_type` imports it from here.
  - `accounts.enums.StaffGroup` — plain constants class: `StaffGroup.MODERATOR == "staff_moderator"`, `StaffGroup.ADMIN == "staff_admin"`, `StaffGroup.ALL == (MODERATOR, ADMIN)`.
  - `accounts.models.User` — the value of `AUTH_USER_MODEL` (`"accounts.User"`). Fields: `id` (UUID pk), `email` (unique, normalized lowercase), `email_verified_at` (nullable), `primary_role`, `locale`, `full_name`, `is_active`, `is_staff`, `is_superuser`, `groups`, `user_permissions`, `password`, `last_login`, `created_at`, `updated_at`. `USERNAME_FIELD = "email"`, `REQUIRED_FIELDS = []`. Property `User.is_email_verified -> bool`. Methods `get_full_name()`, `get_short_name()`.
  - `accounts.models.UserManager` — `User.objects`, with `create_user(email, password=None, **extra)`, `create_superuser(email, password=None, **extra)` and classmethod `normalize_email(email) -> str` (full lowercase + strip).
  - `accounts.tests.factories.make_user(...)` — test helper reused by every later app's tests.

- **FK convention (binding on Tasks 5–9 and every later phase):** Any future app defining a FK to the user model must always use `settings.AUTH_USER_MODEL` (never a hardcoded app-label string such as `"accounts.User"`) for the FK's `to=` argument, and `from accounts.models import User` only for type hints, `isinstance` checks or direct manager access (`User.objects...`). Mixing the two forms across apps makes the migration graph depend on import order and defeats the swappable-model machinery.

- [ ] **Step 1: Survey the current migration landscape (informational — this is not a gate)**

Run all three commands and read all three outputs before continuing. **None of these outputs blocks the task.** Their purpose is to tell you what the database reset in Step 7 is about to rebuild, so that Step 8's ordering check has something concrete to verify against.

```bash
cd backend

# 1a. Which migrations exist and which are already APPLIED ([X] = applied).
uv run python manage.py showmigrations

# 1b. Which project migrations already reference the swappable user model?
#     Informational inventory only — record the app names for Step 8.
grep -rn "AUTH_USER_MODEL\|swappable_dependency\|auth.user\|to=.auth\.User." \
  --include="*.py" \
  $(ls -d */migrations 2>/dev/null)

# 1c. Are the project's models and its migration files in sync?
uv run python manage.py makemigrations --check --dry-run
```

Expected:

- **1a** lists Django's own contrib apps plus the already-merged `audit`, `platform_settings`, `taxonomy` and `finance` migrations, all `[X]` applied. This is **fine and expected** — not a blocker.
- **1b** **prints the migration files that already reference `AUTH_USER_MODEL` — expected and fine, not a blocker.** At the time of writing that list is `audit/migrations/0001_initial.py`, `taxonomy/migrations/0001_initial.py`, `taxonomy/migrations/0002_boatmodel.py` and `platform_settings/migrations/0001_initial.py` (each via `migrations.swappable_dependency(settings.AUTH_USER_MODEL)`). Your output may differ if more phases merged since. **Write down which apps appear** — Step 8 confirms `accounts.0001_initial` is applied before all of them after the reset. Django's own `admin.0001_initial`, `auth.*` and `authtoken` migrations live inside `.venv`/site-packages and are excluded by the explicit app-directory scoping above; they are handled by the same reset.
- **1c** prints `No changes detected` — the project's models and its migration files agree, so nothing is half-migrated. If it instead reports missing migrations for an already-merged app, that is a pre-existing problem in `dev` worth raising before you reset anything.

**Why none of this blocks:** Step 7 drops and recreates the whole dev database. A fresh, empty database re-applies every migration from scratch, and Django's graph resolver places `accounts.0001_initial` ahead of every migration that declares a swappable dependency on the user model. It does not matter how many such migrations already exist, nor which apps own them.

**The only stop-and-escalate condition:** the database you are about to reset holds **real production data**. It does not — this is a local dev Postgres whose contents are migration-created tables plus throwaway fixtures, with no real user accounts. Confirm that is still true (`uv run python manage.py shell -c "from django.contrib.auth import get_user_model; print(get_user_model().objects.count())"` — a handful of dev/superuser accounts you are willing to recreate is fine; anything resembling real customer data is not). If it is not true, **stop and escalate**: introducing a custom user model on a database that cannot be reset needs a hand-written table-swap migration, which is out of scope for this plan.

- [ ] **Step 2: Scaffold the app, then write the failing tests**

The test files below live inside `backend/accounts/tests/`, so the Django app skeleton must exist first. Writing them into a not-yet-existing `accounts/` directory and only running `manage.py startapp accounts` afterwards would break `startapp`: it unconditionally `os.makedirs()`s the target directory and raises `CommandError: ...\backend\accounts already exists` the moment that directory is already there. Scaffold the app first, before any test file is written:

```bash
cd backend
uv run python manage.py startapp accounts
rm accounts/tests.py
mkdir -p accounts/tests
```

This produces the standard `startapp` boilerplate (`__init__.py`, `apps.py`, `admin.py`, a stub `models.py`, `views.py`, `migrations/`) plus an empty `accounts/tests/` package. Step 4 below replaces the stub `models.py` and adds `enums.py`; nothing in this step needs to be redone afterwards.

Now write the tests. They will fail to collect until Step 4 supplies `accounts.enums` and the real `accounts.models.User` — see Step 3.

`backend/conftest.py`:

```python
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
```

`backend/accounts/tests/__init__.py` — empty file.

`backend/accounts/tests/factories.py`:

```python
from django.utils import timezone

from accounts.enums import Locale, UserRole
from accounts.models import User

DEFAULT_TEST_PASSWORD = "n4uta-test-Passw0rd"


def make_user(
    email="user@example.com",
    *,
    password=DEFAULT_TEST_PASSWORD,
    verified=True,
    role=UserRole.BUYER,
    locale=Locale.EN,
    is_active=True,
    full_name="",
    **extra,
):
    user = User.objects.create_user(
        email=email,
        password=password,
        primary_role=role,
        locale=locale,
        is_active=is_active,
        full_name=full_name,
        **extra,
    )
    if verified:
        user.email_verified_at = timezone.now()
        user.save(update_fields=["email_verified_at", "updated_at"])
    return user
```

`backend/accounts/tests/test_models.py`:

```python
import uuid

import pytest
from django.db import IntegrityError, transaction

from accounts.enums import Locale, UserRole
from accounts.models import User
from accounts.tests.factories import DEFAULT_TEST_PASSWORD, make_user


@pytest.mark.django_db
def test_user_primary_key_is_a_uuid():
    user = make_user("uuid@example.com")
    assert isinstance(user.pk, uuid.UUID)


@pytest.mark.django_db
def test_create_user_normalizes_email_to_lowercase():
    user = User.objects.create_user(
        email="  MixedCase@Example.COM ", password=DEFAULT_TEST_PASSWORD
    )
    assert user.email == "mixedcase@example.com"


@pytest.mark.django_db
def test_email_uniqueness_is_case_insensitive_at_database_level():
    make_user("dupe@example.com")
    with pytest.raises(IntegrityError), transaction.atomic():
        # Bypasses save()/manager normalization on purpose: the DB must still refuse.
        User.objects.bulk_create([User(email="DUPE@example.com", password="x")])


@pytest.mark.django_db
def test_defaults_are_buyer_english_unverified_and_active():
    user = User.objects.create_user(
        email="defaults@example.com", password=DEFAULT_TEST_PASSWORD
    )
    assert user.primary_role == UserRole.BUYER
    assert user.locale == Locale.EN
    assert user.email_verified_at is None
    assert user.is_email_verified is False
    assert user.is_active is True
    assert user.is_staff is False


@pytest.mark.django_db
def test_create_user_requires_an_email():
    with pytest.raises(ValueError):
        User.objects.create_user(email="", password=DEFAULT_TEST_PASSWORD)


@pytest.mark.django_db
def test_create_superuser_is_staff_superuser_staff_role_and_verified():
    user = User.objects.create_superuser(
        email="root@example.com", password=DEFAULT_TEST_PASSWORD
    )
    assert user.is_staff is True
    assert user.is_superuser is True
    assert user.primary_role == UserRole.STAFF
    assert user.is_email_verified is True


@pytest.mark.django_db
def test_password_is_hashed_not_stored_in_plain_text():
    user = make_user("hash@example.com")
    assert user.password != DEFAULT_TEST_PASSWORD
    assert user.check_password(DEFAULT_TEST_PASSWORD) is True


@pytest.mark.django_db
def test_get_full_name_falls_back_to_email():
    assert make_user("noname@example.com").get_full_name() == "noname@example.com"
    named = make_user("named@example.com", full_name="Ada Lovelace")
    assert named.get_full_name() == "Ada Lovelace"
    assert named.get_short_name() == "Ada"
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
cd backend
uv run pytest accounts/tests/test_models.py -v
```

Expected: collection error — `ModuleNotFoundError: No module named 'accounts.enums'`. (The `accounts` package itself already exists from Step 2's scaffolding, so the error names a submodule, not the package. `test_models.py`'s first `accounts`-related import, `from accounts.enums import Locale, UserRole`, is the one that fails — `accounts/enums.py` and the real `accounts/models.py` aren't written until Step 4.)

- [ ] **Step 4: Create the abstract base model and the enums**

The app skeleton and empty `accounts/tests/` package already exist from Step 2 — nothing here re-runs `startapp`. This step replaces the stub `models.py` it generated with the real `User` model and adds `enums.py`.

**`backend/common/models.py` — read first, then be additive. Do NOT replace this file.**

Phase 2 has already merged, and its Task 1 defined `UUIDModel`, `TimeStampedModel` and `UUIDTimeStampedModel` in `backend/common/models.py` with exactly the field definitions this task needs (`id = UUIDField(primary_key=True, default=uuid.uuid4, editable=False)`, `created_at = DateTimeField(auto_now_add=True)`, `updated_at = DateTimeField(auto_now=True)`). Those classes now underpin every already-merged domain app — `audit`, `platform_settings`, `taxonomy` and `finance` — so a careless rewrite of this file breaks four apps at once, not one.

```bash
cd backend
cat common/models.py
```

- **If `UUIDTimeStampedModel` is already present (it will be) — do not modify `backend/common/models.py` at all.** Just `from common.models import UUIDTimeStampedModel` in `accounts/models.py` and move on. Never delete or rewrite `UUIDModel` / `TimeStampedModel`; the already-merged `audit`, `platform_settings`, `taxonomy` and `finance` models inherit from them.
- **Only if it is somehow missing**, *append* the following without removing or altering anything else already in the file (keep Phase 2's existing classes and inherit from them if they exist):

```python
import uuid

from django.db import models


class UUIDModel(models.Model):
    """UUID primary key (spec 11 preamble). Only add if genuinely absent."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True


class TimeStampedModel(models.Model):
    """Timezone-aware created/updated stamps. Only add if genuinely absent."""

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class UUIDTimeStampedModel(UUIDModel, TimeStampedModel):
    """Shared base: UUID primary key + timezone-aware created/updated stamps (spec 11)."""

    class Meta:
        abstract = True
```

Note the composition: `UUIDTimeStampedModel` inherits from `UUIDModel` **and** `TimeStampedModel` — it does not restate their fields against a plain `models.Model`. If either base already exists in the file, keep the existing one and define only what is missing on top of it.

Because these bases are abstract, this task adds **no** migration to `common` either way.

`backend/accounts/enums.py`:

```python
from django.db import models


class UserRole(models.TextChoices):
    """The single primary marketplace role held by every account (spec 5, 11.1)."""

    BUYER = "BUYER", "Buyer"
    PRIVATE_SELLER = "PRIVATE_SELLER", "Private seller"
    BROKER = "BROKER", "Broker"
    SERVICE_PROVIDER = "SERVICE_PROVIDER", "Service provider"
    STAFF = "STAFF", "Staff"


class Locale(models.TextChoices):
    """Supported interface languages - exactly these three (spec 0)."""

    EN = "EN", "English"
    IT = "IT", "Italiano"
    ES = "ES", "Espanol"


class SellerType(models.TextChoices):
    """Canonical seller-type enum. Phase 11's BoatListing.seller_type imports this."""

    PRIVATE = "PRIVATE", "Private seller"
    BROKER = "BROKER", "Broker"


class StaffGroup:
    """Django auth Group names splitting spec 5's staff moderator / staff admin tiers."""

    MODERATOR = "staff_moderator"
    ADMIN = "staff_admin"
    ALL = (MODERATOR, ADMIN)
```

`backend/accounts/models.py`:

```python
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.db.models.functions import Lower
from django.utils import timezone

from accounts.enums import Locale, UserRole
from common.models import UUIDTimeStampedModel


class UserManager(BaseUserManager):
    use_in_migrations = True

    @classmethod
    def normalize_email(cls, email):
        """Lowercase the WHOLE address, not just the domain.

        Django's BaseUserManager only lowercases the domain part, which would let
        'Alice@example.com' and 'alice@example.com' coexist as two identities.
        """
        return super().normalize_email(email or "").strip().lower()

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Users must have an email address.")
        extra_fields.setdefault("primary_role", UserRole.BUYER)
        extra_fields.setdefault("locale", Locale.EN)
        user = self.model(email=self.normalize_email(email), **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("primary_role", UserRole.STAFF)
        extra_fields.setdefault("email_verified_at", timezone.now())
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")
        return self.create_user(email, password, **extra_fields)


class User(UUIDTimeStampedModel, AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(max_length=254, unique=True)
    email_verified_at = models.DateTimeField(null=True, blank=True)
    primary_role = models.CharField(
        max_length=20, choices=UserRole.choices, default=UserRole.BUYER
    )
    locale = models.CharField(max_length=2, choices=Locale.choices, default=Locale.EN)
    full_name = models.CharField(max_length=150, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(
        default=False, help_text="Can sign in to the Django admin site."
    )

    objects = UserManager()

    USERNAME_FIELD = "email"
    EMAIL_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        ordering = ("email",)
        constraints = [
            models.UniqueConstraint(Lower("email"), name="accounts_user_email_ci_unique"),
        ]

    def __str__(self):
        return self.email

    def save(self, *args, **kwargs):
        self.email = UserManager.normalize_email(self.email)
        return super().save(*args, **kwargs)

    @property
    def is_email_verified(self) -> bool:
        return self.email_verified_at is not None

    def get_full_name(self) -> str:
        return self.full_name or self.email

    def get_short_name(self) -> str:
        return self.full_name.split(" ")[0] if self.full_name else self.email
```

**Note (why both `unique=True` and a functional unique index):** Django's system check `auth.E003` requires `USERNAME_FIELD` to be unique, so `email` keeps `unique=True`. The additional `UniqueConstraint(Lower("email"))` is deliberate defence in depth: `save()` normalizes, but `bulk_create()`, `QuerySet.update()` and raw SQL bypass `save()`, and a mixed-case duplicate would create a second identity for the same mailbox — an authentication defect, not a cosmetic one. The cost is one extra index. `test_email_uniqueness_is_case_insensitive_at_database_level` exercises exactly the `bulk_create` bypass path.

**Note (`full_name`):** spec §11.1 lists no name field on `User`, but notification email, message headers and the staff user list all need a human label, and spec §2.1 forbids inventing one in the UI. `full_name` is the minimum addition (blank-allowed; no decorative profile fields, per §11.1's closing rule). Downstream phases use `user.get_full_name()`, never a client-supplied display string.

**Note (`is_staff` vs `primary_role == STAFF`):** different concepts, both present. `primary_role = STAFF` is the marketplace role from spec §5; `is_staff` only gates Django-admin sign-in. Neither implies moderator or admin authority — that comes from the `staff_moderator` / `staff_admin` groups added in Task 7.

- [ ] **Step 5: Register the app and set `AUTH_USER_MODEL`**

In `backend/config/settings/base.py`, add `"accounts",` to `INSTALLED_APPS` immediately after `"common",`, then add these two blocks immediately after the `TEMPLATES` list:

```python
AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 10},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]
```

**Note:** Phase 1 shipped no `AUTH_PASSWORD_VALIDATORS` key at all, and Django's fallback when the setting is absent is an empty list — so until now any password would have been accepted. It is added here because Task 3 is the first code path that accepts a user-chosen password. `min_length` is raised from Django's default 8 to 10.

- [ ] **Step 6: Write the admin forms and admin registration**

`backend/accounts/forms.py`:

```python
from django.contrib.auth import forms as auth_forms

from accounts.models import User


class AdminUserCreationForm(auth_forms.BaseUserCreationForm):
    class Meta(auth_forms.BaseUserCreationForm.Meta):
        model = User
        fields = ("email",)
        field_classes = {}


class AdminUserChangeForm(auth_forms.UserChangeForm):
    class Meta(auth_forms.UserChangeForm.Meta):
        model = User
        fields = "__all__"
        field_classes = {}
```

**Note:** Django's stock `UserCreationForm`/`UserChangeForm` declare `field_classes = {"username": UsernameField}` in their `Meta`; this model has no `username`, so both subclasses reset `field_classes` to `{}`. `BaseUserCreationForm` (not `UserCreationForm`) is the right parent because it omits the username-specific uniqueness handling.

`backend/accounts/admin.py`:

```python
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from accounts.forms import AdminUserChangeForm, AdminUserCreationForm
from accounts.models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    form = AdminUserChangeForm
    add_form = AdminUserCreationForm
    model = User
    ordering = ("email",)
    list_display = ("email", "full_name", "primary_role", "is_active", "email_verified_at")
    list_filter = ("primary_role", "is_active", "is_staff", "is_superuser", "locale")
    search_fields = ("email", "full_name")
    readonly_fields = ("id", "created_at", "updated_at", "last_login")
    filter_horizontal = ("groups", "user_permissions")
    fieldsets = (
        (None, {"fields": ("id", "email", "password")}),
        ("Profile", {"fields": ("full_name", "locale", "primary_role")}),
        ("Verification", {"fields": ("email_verified_at",)}),
        (
            "Permissions",
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                )
            },
        ),
        ("Timestamps", {"fields": ("last_login", "created_at", "updated_at")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "email",
                    "full_name",
                    "primary_role",
                    "locale",
                    "password1",
                    "password2",
                ),
            },
        ),
    )
```

- [ ] **Step 6a: Repair the two already-merged conftest fixtures that pass `username=`**

`AUTH_USER_MODEL` now points at a model with **no `username` field**, but two already-merged test packages still build their staff user through the stock signature. Both currently read:

```python
User.objects.create_user(
    username="staff-audit",          # <- no such field on accounts.User
    email="staff-audit@nautelo.local",
    password="pw",
    is_staff=True,
)
```

Left alone, every test in `audit` and `platform_settings` fails at fixture setup with `TypeError: User() got unexpected keyword arguments: 'username'` — `UserManager.create_user` (Step 4) forwards `**extra_fields` straight into `self.model(...)`, and `username` is not a field on it.

Edit **both** files and delete only the `username=` line from each `create_user(...)` call — leave the email, password, `is_staff=True` and the surrounding fixture untouched:

- `backend/audit/tests/conftest.py` → `staff_user` fixture (remove `username="staff-audit",`)
- `backend/platform_settings/tests/conftest.py` → `staff_user` fixture (remove `username="staff-settings",`)

Each call then reads:

```python
User.objects.create_user(
    email="staff-audit@nautelo.local",   # "staff-settings@..." in platform_settings
    password="pw",
    is_staff=True,
)
```

which matches this task's `UserManager.create_user(self, email, password=None, **extra_fields)` exactly: `email` and `password` are the named parameters, and `is_staff` is a real model field that passes cleanly through `**extra_fields`. Nothing else in either file needs to change — `get_user_model()` resolves to `accounts.User` on its own, and neither fixture reads `.username` afterwards.

**Do not add a `username` property to `User` to keep these working.** Email-only auth is the spec §11.1 contract; the fixtures are what adapt.

- [ ] **Step 7: Generate the initial migration and reset the dev database**

Stop the Django dev server and any Celery worker first (`dropdb` refuses while connections are open).

```bash
cd backend
uv run python manage.py makemigrations accounts
```

Expected: `accounts/migrations/0001_initial.py` created, containing `CreateModel` for `User` with the UUID primary key and the `accounts_user_email_ci_unique` constraint.

Now attempt a migrate *without* resetting, so the failure mode is observed rather than assumed:

```bash
uv run python manage.py migrate
```

Expected: **FAILS** with an `InconsistentMigrationHistory`, of the shape

```
django.db.migrations.exceptions.InconsistentMigrationHistory: Migration <app>.<migration>
is applied before its dependency accounts.0001_initial on database 'default'.
```

**Do not match on a specific migration name.** Django reports whichever already-applied migration it happens to reach first while walking the graph, and several apps now qualify: `admin.0001_initial` (the most likely one), but equally `audit.0001_initial`, `taxonomy.0001_initial`, `taxonomy.0002_boatmodel` or `platform_settings.0001_initial` — all of them declare `swappable_dependency(AUTH_USER_MODEL)` and all of them are already applied. Any of these names appearing is the same failure and calls for the same fix; what matters is the `InconsistentMigrationHistory` exception type, not the app it names.

This is the expected consequence of flipping `AUTH_USER_MODEL` on a database whose history predates `accounts`: those migrations were applied against the default `auth.User`, and `accounts.0001_initial` now has to precede them. The dev database holds no production data, so the correct fix is to recreate it — which re-applies the whole graph in the right order:

```bash
cd ..
docker compose exec postgres dropdb --force -U nautelo nautelo
docker compose exec postgres createdb -U nautelo nautelo
cd backend
uv run python manage.py migrate
```

(`--force` requires PostgreSQL 13+ — this project runs 16 — and terminates any leftover connection instead of hanging; keep it even after stopping the dev server and Celery worker, because a stray `psql`/IDE connection is easy to miss.)

Expected: a clean run in which `accounts.0001_initial` is applied before **every** migration that declares a swappable dependency on the user model — `admin.0001_initial` and each app you recorded in Step 1b — ending with no errors.

The reset drops the whole dev database, not selected tables, so every already-merged app's schema (`audit`, `platform_settings`, `taxonomy`, `finance`) is rebuilt by this same `migrate` run, now in an order that puts `accounts` first. Any dev rows those apps held are gone; none of it is authoritative. If you need taxonomy reference data or platform settings back for manual testing, re-run whatever seeding command or fixture those phases provide after this step.

CI is unaffected — GitHub Actions starts a fresh Postgres service container per run — and `pytest-django` creates a fresh `test_nautelo` database, so neither carried the stale history.

- [ ] **Step 8: Run the tests to verify they pass — and prove the dev database's history is actually consistent**

```bash
uv run pytest accounts/tests/test_models.py -v
uv run python manage.py check
```

Expected: all 8 tests `PASS`; `check` reports `System check identified no issues`.

**Neither of those two commands proves the reset in Step 7 worked.** `manage.py check` never touches migration history, and `pytest-django` builds a *separate* `test_nautelo` database from scratch — so a still-broken `nautelo` dev database would pass both. Run these two additional checks against the **dev** database:

```bash
uv run python manage.py showmigrations accounts admin audit platform_settings taxonomy finance
uv run python manage.py migrate --check
uv run python manage.py makemigrations --check --dry-run
```

Expected:

- Every migration listed is marked `[X]` (applied) — including all the already-merged apps, which the reset rebuilt. Any `[ ]` box means the reset did not complete.
- `accounts.0001_initial` is applied **before** every migration that depends on the swappable user model. Cross-check the real applied ordering with `uv run python manage.py showmigrations --plan | head -30`: `accounts.0001_initial` must appear above `admin.0001_initial` **and** above each app you recorded in Step 1b (at the time of writing: `audit.0001_initial`, `taxonomy.0001_initial`, `taxonomy.0002_boatmodel`, `platform_settings.0001_initial`). One of them ordered ahead of `accounts` means the reset was partial — re-do Step 7.
- `migrate --check` exits **0** and prints nothing, confirming there are no pending or inconsistent migrations. A non-zero exit means the history is still broken — re-do Step 7 rather than continuing.
- `makemigrations --check --dry-run` exits **0** and prints nothing — a cheap re-run of Step 1c now that `accounts` is registered and `AUTH_USER_MODEL` is set, confirming adding this app introduced no undetected model/migration drift anywhere in the project. A non-zero exit means some app's models and migrations are now out of sync — investigate before committing.

- [ ] **Step 9: Verify the admin works end to end against the real user model**

```bash
uv run python manage.py createsuperuser --email root@nautelo.local
uv run python manage.py runserver 8020
```

Expected: `createsuperuser` prompts for *email* (not username) and a password, and rejects a password shorter than 10 characters. Sign in at `http://localhost:8020/admin/` and confirm the Users changelist shows the account with `primary_role = Staff`.

- [ ] **Step 10: Run the full existing suite to prove nothing already merged regressed**

```bash
uv run pytest -v
```

Expected: **the whole suite green**, not just this task's new tests. Specifically:

- The Phase 1 tests (`common/tests/test_health.py`, `test_celery.py`, `test_storage.py`, `test_stripe_webhook.py`, `test_websocket.py`) still pass.
- **`audit/tests/` and `platform_settings/tests/` still pass.** These two are the ones at risk: their `staff_user` fixtures were built for Django's stock user model and were repaired in Step 6a. If either package now errors at setup with `TypeError: User() got unexpected keyword arguments: 'username'`, Step 6a was missed or applied to only one of the two files — go back and fix it rather than skipping or xfailing those tests.
- `taxonomy/tests/` and `finance/tests/` still pass. Neither builds users through `create_user(username=...)` today, but they are already merged and must stay green; if a `username=` call has appeared in one of them since this plan was written, apply the Step 6a fix there too and add the file to this task's Files list.

Run `uv run pytest -v` again after any repair and confirm a clean exit before committing.

- [ ] **Step 11: Commit**

```bash
git add backend/accounts backend/conftest.py backend/config/settings/base.py \
  backend/audit/tests/conftest.py backend/platform_settings/tests/conftest.py
git commit -m "feat(accounts): add custom uuid user model as AUTH_USER_MODEL"
```

---

### Task 2: Request-ID middleware and the project-wide error envelope

Spec §30.2 requires every error to carry a stable machine code, a user-safe message, a field map and a request ID, and §12's frontend requirement ("a permission failure returns a clear 403 screen; missing authentication returns 401") needs stable codes to render against. Phase 3 is the first phase that produces authorization errors, so the envelope is built here.

**Note (ownership):** the error envelope and `X-Request-ID` are cross-cutting and spec §30 assigns them to no phase. They are placed in `common/` (the Phase 1 infrastructure app, owned by no in-flight plan) rather than `accounts/`. If the Phase 2 plan also lands an exception handler, keep whichever landed first and extend it — do not run two handlers.

**Files:**
- Create: `backend/common/middleware.py`, `backend/common/exceptions.py`
- Modify: `backend/config/settings/base.py` (`MIDDLEWARE`, `REST_FRAMEWORK["EXCEPTION_HANDLER"]`)
- Test: `backend/common/tests/test_request_id.py`, `backend/common/tests/test_exception_handler.py`

**Interfaces:**
- Produces:
  - `common.middleware.RequestIDMiddleware` — sets `request.request_id: str` (32-char hex when absent) and echoes `X-Request-ID` on every response.
  - `common.exceptions.nauta_exception_handler(exc, context)` — DRF `EXCEPTION_HANDLER`. Every non-2xx DRF response body becomes exactly `{"error": {"code": str, "message": str, "fields": dict[str, list[str]], "request_id": str}}`. `message` is always a plain human sentence — never a Python repr — for every exception family including SimpleJWT's dict-detail `InvalidToken`/`TokenError`. A `ValidationError` raised with a bare string or list maps onto `fields["non_field_errors"]`.
  - Stable codes used by later phases: `validation_error`, `not_authenticated`, `permission_denied`, `not_found`, `throttled`, `user_inactive`, `token_not_valid`, `method_not_allowed`.
- Consumes: nothing from Task 1.

- [ ] **Step 1: Write the failing tests**

`backend/common/tests/test_request_id.py`:

```python
import pytest


@pytest.mark.django_db
def test_response_carries_a_generated_request_id(client):
    response = client.get("/api/v1/health/")
    assert len(response.headers["X-Request-ID"]) == 32


@pytest.mark.django_db
def test_incoming_request_id_is_echoed_back(client):
    response = client.get("/api/v1/health/", headers={"x-request-id": "abc-123"})
    assert response.headers["X-Request-ID"] == "abc-123"


@pytest.mark.django_db
def test_unsafe_incoming_request_id_is_discarded(client):
    response = client.get("/api/v1/health/", headers={"x-request-id": "bad value <script>"})
    assert response.headers["X-Request-ID"] != "bad value <script>"
    assert len(response.headers["X-Request-ID"]) == 32
```

`backend/common/tests/test_exception_handler.py`:

```python
from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import NotAuthenticated, PermissionDenied, ValidationError
from rest_framework.test import APIRequestFactory
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.tokens import AccessToken

from common.exceptions import nauta_exception_handler


def _context():
    request = APIRequestFactory().get("/api/v1/session/")
    request.request_id = "req-test-1"
    return {"request": request}


def test_permission_denied_uses_the_envelope():
    response = nauta_exception_handler(PermissionDenied(), _context())
    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.data == {
        "error": {
            "code": "permission_denied",
            "message": "You do not have permission to perform this action.",
            "fields": {},
            "request_id": "req-test-1",
        }
    }


def test_explicit_code_is_preserved():
    exc = PermissionDenied(detail="Verify your email first.", code="email_not_verified")
    response = nauta_exception_handler(exc, _context())
    assert response.data["error"]["code"] == "email_not_verified"
    assert response.data["error"]["message"] == "Verify your email first."


def test_not_authenticated_is_401_with_stable_code():
    response = nauta_exception_handler(NotAuthenticated(), _context())
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.data["error"]["code"] == "not_authenticated"


def test_validation_error_maps_fields():
    exc = ValidationError({"email": ["This field is required."]})
    response = nauta_exception_handler(exc, _context())
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.data["error"]["code"] == "validation_error"
    assert response.data["error"]["fields"] == {"email": ["This field is required."]}


def test_dict_keyed_non_field_errors_are_preserved_under_the_validation_error_code():
    # Every ValidationError carries the stable code `validation_error` regardless of
    # its shape; what varies - and what this asserts - is the `fields` map.
    exc = ValidationError({"non_field_errors": ["Bad credentials."]})
    response = nauta_exception_handler(exc, _context())
    assert response.data["error"]["code"] == "validation_error"
    assert response.data["error"]["fields"] == {"non_field_errors": ["Bad credentials."]}


def test_string_validation_error_is_mapped_to_non_field_errors():
    # `raise ValidationError("...")` inside a validate() method must not be swallowed.
    response = nauta_exception_handler(ValidationError("Passwords do not match."), _context())
    assert response.data["error"]["fields"] == {
        "non_field_errors": ["Passwords do not match."]
    }


def test_list_validation_error_is_mapped_to_non_field_errors():
    response = nauta_exception_handler(ValidationError(["First problem.", "Second."]), _context())
    assert response.data["error"]["fields"] == {
        "non_field_errors": ["First problem.", "Second."]
    }


def test_expired_jwt_yields_a_clean_message_not_a_python_repr():
    """The most frequent error in the product: a real, genuinely expired access token.

    Deliberately NOT mocked - the whole point is that SimpleJWT's real exception
    carries a dict `detail`, which a naive `str(detail)` would leak as a repr.
    """
    token = AccessToken()
    token.set_exp(from_time=timezone.now() - timedelta(hours=2), lifetime=timedelta(minutes=15))
    expired = str(token)

    with pytest.raises(InvalidToken) as excinfo:
        JWTAuthentication().get_validated_token(expired)
    assert isinstance(excinfo.value.detail, dict)  # documents WHY this test exists

    response = nauta_exception_handler(excinfo.value, _context())
    message = response.data["error"]["message"]

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.data["error"]["code"] == "token_not_valid"
    assert isinstance(message, str) and message
    # A human sentence, not a serialized Python structure.
    assert "ErrorDetail" not in message
    assert "{" not in message
    assert "code=" not in message


def test_unhandled_exception_returns_none_so_django_handles_it():
    assert nauta_exception_handler(RuntimeError("boom"), _context()) is None
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd backend
uv run pytest common/tests/test_request_id.py common/tests/test_exception_handler.py -v
```

Expected: `ModuleNotFoundError: No module named 'common.exceptions'` and the request-id tests fail with `KeyError: 'X-Request-ID'`.

- [ ] **Step 3: Implement the middleware and the handler**

`backend/common/middleware.py`:

```python
import re
import uuid

SAFE_REQUEST_ID = re.compile(r"^[A-Za-z0-9._-]{1,64}$")


class RequestIDMiddleware:
    """Attach a request id to every request/response (spec 30.2)."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        incoming = request.META.get("HTTP_X_REQUEST_ID", "").strip()
        request.request_id = incoming if SAFE_REQUEST_ID.match(incoming) else uuid.uuid4().hex
        response = self.get_response(request)
        response["X-Request-ID"] = request.request_id
        return response
```

`backend/common/exceptions.py`:

```python
from rest_framework.exceptions import ValidationError
from rest_framework.views import exception_handler as drf_exception_handler

GENERIC_VALIDATION_MESSAGE = "The submitted data is invalid."
GENERIC_ERROR_MESSAGE = "Request failed."
NON_FIELD_ERRORS_KEY = "non_field_errors"
_MAX_UNWRAP_DEPTH = 5


def _as_list(value):
    return list(value) if isinstance(value, (list, tuple)) else [value]


def _field_map(detail):
    """Normalize DRF's three ValidationError detail shapes into {field: [str, ...]}.

    DRF accepts all three of `ValidationError({"email": [...]})`,
    `ValidationError("some message")` and `ValidationError(["a", "b"])`, and all
    three are common inside `validate()` methods. Only the first is keyed by field
    name; the other two are non-field errors and must NOT be silently dropped into
    an empty `fields: {}` - they carry the only explanation the client gets. Map
    them onto `non_field_errors`, matching Django/DRF's own convention.
    """
    if detail is None:
        return {}
    if isinstance(detail, dict):
        return {
            str(key): [str(item) for item in _as_list(value)]
            for key, value in detail.items()
        }
    return {NON_FIELD_ERRORS_KEY: [str(item) for item in _as_list(detail)]}


def _safe_message(detail, fallback):
    """Extract a user-safe string from an exception detail of ANY shape.

    Critical for SimpleJWT: `InvalidToken`/`TokenError` inherit `DetailDictMixin`,
    whose `.detail` is ALWAYS a dict - {"detail": ..., "code": ..., "messages": [...]}
    - even when the exception is raised with a plain string. A bare `str(detail)` on
    that dict emits a raw Python repr such as
    "{'detail': ErrorDetail(string='Given token not valid...', code='token_not_valid'), ...}"
    straight to API clients. That is the app's single most frequent error path (every
    logged-in user hits it roughly every 15 minutes, when the access token expires),
    and a repr is not the "user-safe message" spec 30.2 requires. So unwrap first and
    only ever fall back to `str()` for a scalar.
    """
    for _ in range(_MAX_UNWRAP_DEPTH):
        if isinstance(detail, dict):
            if not detail:
                return fallback
            detail = detail["detail"] if "detail" in detail else next(iter(detail.values()))
        elif isinstance(detail, (list, tuple)):
            if not detail:
                return fallback
            detail = detail[0]
        else:
            break
    if detail is None or isinstance(detail, (dict, list, tuple)):
        return fallback
    return str(detail)


def _safe_code(detail, exc):
    """Prefer an explicit code, wherever the exception chose to put it."""
    if isinstance(detail, dict) and isinstance(detail.get("code"), str):
        return detail["code"]
    return str(getattr(detail, "code", "") or getattr(exc, "default_code", "error"))


def nauta_exception_handler(exc, context):
    """Render every DRF error as spec 30.2's envelope."""
    response = drf_exception_handler(exc, context)
    if response is None:
        return None

    request = context.get("request")
    request_id = getattr(request, "request_id", "") or ""

    if isinstance(exc, ValidationError):
        code = "validation_error"
        message = GENERIC_VALIDATION_MESSAGE
        fields = _field_map(exc.detail)
    else:
        detail = getattr(exc, "detail", None)
        code = _safe_code(detail, exc)
        message = _safe_message(detail, GENERIC_ERROR_MESSAGE)
        fields = {}

    response.data = {
        "error": {
            "code": code,
            "message": message,
            "fields": fields,
            "request_id": request_id,
        }
    }
    response["X-Request-ID"] = request_id
    return response
```

**Note (why `_safe_message` exists at all):** `str(exc.detail)` is correct only when `detail` is an `ErrorDetail` (a `str` subclass). DRF's own `APIException` subclasses satisfy that, but SimpleJWT's do not — and SimpleJWT produces the most-travelled error path in the whole product. Reviewers of later phases should treat "is this message a repr?" as a standing check whenever a new exception family is introduced.

**Note (no `action` key):** spec §30.2's example error also carries an optional `action` object (`{"type": "PURCHASE", "product_code": …}`). That is entitlement-specific and belongs to Phase 13/14, which will extend this handler to copy an `action` attribute off exceptions that define one. It is deliberately absent here rather than emitted empty, so no consumer is tempted to branch on a permanently-`null` field.

- [ ] **Step 4: Wire both into settings**

In `backend/config/settings/base.py`, insert the middleware directly after `SecurityMiddleware`:

```python
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "common.middleware.RequestIDMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]
```

and add **one key** to the **existing** `REST_FRAMEWORK` dict. **Add the key to the EXISTING dict — do not replace it.**

`backend/config/settings/base.py` already contains this dict (Phase 4 put `taxonomy_search` in it; read the file before editing, since further phases may have added more):

```python
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.ScopedRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "taxonomy_search": "60/min",
    },
}
```

This task adds exactly one line to it and changes nothing else:

```python
    "EXCEPTION_HANDLER": "common.exceptions.nauta_exception_handler",
```

Result (every pre-existing key preserved, the new key marked):

```python
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.ScopedRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "taxonomy_search": "60/min",
    },
    "EXCEPTION_HANDLER": "common.exceptions.nauta_exception_handler",  # <- added by Task 2
}
```

**Leave `DEFAULT_THROTTLE_CLASSES` and `taxonomy_search` exactly as they are here.** Task 3 is what swaps the throttle class for `common.throttling.HashedIPScopedRateThrottle`; deleting the `taxonomy_search` rate would break the already-merged taxonomy search endpoints with `ImproperlyConfigured: No default throttle rate set for 'taxonomy_search' scope`.

- [ ] **Step 5: Run the tests to verify they pass**

```bash
uv run pytest common/tests/test_request_id.py common/tests/test_exception_handler.py -v
uv run pytest -v
```

Expected: the 12 new tests `PASS` (3 request-id + 9 exception-handler), and the whole existing suite still passes. In particular `common/tests/test_stripe_webhook.py` is unaffected: `StripeWebhookView` returns `HttpResponse(status=400)` as a value rather than raising, so the exception handler never sees it.

- [ ] **Step 6: Commit**

```bash
git add backend/common/middleware.py backend/common/exceptions.py backend/common/tests backend/config/settings/base.py
git commit -m "feat(common): add request-id middleware and spec 30.2 error envelope"
```

---

### Task 3: Registration and single-use email verification

Spec §1 makes a **verified-email** account a precondition for submitting an inquiry, and §12 extends that to listing submission and Checkout creation. That flag can only be meaningful if something can set it, so registration plus a real verification round-trip is built here.

**Files:**
- Modify: `backend/accounts/models.py` (add `EmailVerificationToken`)
- Create: `backend/accounts/services.py`, `backend/accounts/serializers.py`, `backend/accounts/tasks.py`, `backend/accounts/views.py`, `backend/accounts/urls.py`
- Create: `backend/accounts/migrations/0002_emailverificationtoken.py` (generated)
- Create: `backend/common/throttling.py` (`HashedIPScopedRateThrottle`)
- Modify: `backend/config/urls.py`, `backend/config/settings/base.py` (`CELERY_TASK_ROUTES`, `REST_FRAMEWORK` throttle classes + rates)
- Modify: `backend/.env` (`PUBLIC_BASE_URL` port check — Step 9)
- Test: `backend/accounts/tests/test_registration.py`, `backend/accounts/tests/test_email_verification.py`, `backend/common/tests/test_throttling.py`

**Interfaces:**
- Consumes: `accounts.models.User`, `accounts.enums.UserRole`/`Locale`, `common.exceptions` envelope (Task 2).
- Produces:
  - `accounts.models.EmailVerificationToken` — fields `id` (UUID), `user` (FK, `related_name="email_verification_tokens"`), `token_hash` (unique, 64 hex chars), `expires_at`, `used_at` (nullable), `created_at`, `updated_at`.
  - `accounts.services.EMAIL_VERIFICATION_TOKEN_TTL` — `timedelta(hours=24)`.
  - `accounts.services.issue_email_verification_token(user) -> str` (returns the **raw** token; only the HMAC hash is stored).
  - `accounts.services.consume_email_verification_token(raw_token) -> User` (atomic, single-use; raises `rest_framework.exceptions.ValidationError` with code `invalid_verification_token`).
  - `accounts.services.register_user(*, email, password, full_name, locale, primary_role) -> User` (atomic; queues the email via `transaction.on_commit`).
  - `accounts.tasks.send_email_verification_email(user_id: str, raw_token: str)` — Celery task on the `notifications` queue.
  - Endpoints: `POST /api/v1/auth/register/` (201), `POST /api/v1/auth/verify-email/` (200), `POST /api/v1/auth/resend-verification/` (202).
  - `accounts.urls` — included at `api/v1/` by `config/urls.py`.
  - `common.throttling.HashedIPScopedRateThrottle` — becomes the project's `DEFAULT_THROTTLE_CLASSES` entry in this task: a `ScopedRateThrottle` subclass that HMAC-hashes the client IP before it reaches the cache key (spec §30.4). Every rate limit added from this phase onward uses this class rather than DRF's stock throttles. (The already-merged `taxonomy` views pin the stock `ScopedRateThrottle` at view level and so are not covered — a pre-existing gap recorded under Known Limitations, not fixed here.)
  - Throttle scope `"auth"` rated `10/min`, live from this task onward on register / verify-email / resend-verification (Task 4 attaches login and logout to the same scope and adds its own `"auth-refresh"` scope).

- [ ] **Step 1: Write the failing tests**

`backend/accounts/tests/test_registration.py`:

```python
import pytest
from django.core import mail
from rest_framework.test import APIClient

from accounts.enums import Locale, UserRole
from accounts.models import EmailVerificationToken, User
from accounts.tests.factories import make_user

REGISTER_URL = "/api/v1/auth/register/"
VALID_PASSWORD = "n4uta-test-Passw0rd"


@pytest.fixture
def api():
    return APIClient()


@pytest.mark.django_db
def test_registration_creates_an_unverified_active_buyer(api):
    response = api.post(
        REGISTER_URL,
        {"email": "New.User@Example.com", "password": VALID_PASSWORD, "full_name": "New User"},
        format="json",
    )
    assert response.status_code == 201
    user = User.objects.get(email="new.user@example.com")
    assert user.is_active is True
    assert user.is_email_verified is False
    assert user.primary_role == UserRole.BUYER
    assert user.locale == Locale.EN
    assert response.data["email"] == "new.user@example.com"
    assert "password" not in response.data


@pytest.mark.django_db
def test_registration_sends_one_verification_email_and_stores_only_a_hash(
    api, django_capture_on_commit_callbacks
):
    # register_user() queues the send with transaction.on_commit(). Inside a
    # @pytest.mark.django_db test nothing ever really commits, so without this
    # fixture the callback would never run and mail.outbox would stay empty.
    # See "Note (why django_capture_on_commit_callbacks ...)" below.
    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        api.post(
            REGISTER_URL,
            {"email": "hash@example.com", "password": VALID_PASSWORD},
            format="json",
        )

    assert len(callbacks) == 1  # exactly one queued send - not zero, not two
    token = EmailVerificationToken.objects.get(user__email="hash@example.com")
    assert len(mail.outbox) == 1
    assert len(token.token_hash) == 64
    assert token.token_hash not in mail.outbox[0].body


@pytest.mark.django_db
def test_registration_accepts_only_self_service_roles(api):
    ok = api.post(
        REGISTER_URL,
        {"email": "seller@example.com", "password": VALID_PASSWORD, "primary_role": "PRIVATE_SELLER"},
        format="json",
    )
    assert ok.status_code == 201
    assert User.objects.get(email="seller@example.com").primary_role == UserRole.PRIVATE_SELLER


@pytest.mark.django_db
@pytest.mark.parametrize("forbidden_role", ["STAFF", "BROKER"])
def test_registration_rejects_privileged_roles(api, forbidden_role):
    response = api.post(
        REGISTER_URL,
        {"email": f"{forbidden_role.lower()}@example.com", "password": VALID_PASSWORD,
         "primary_role": forbidden_role},
        format="json",
    )
    assert response.status_code == 400
    assert response.data["error"]["code"] == "validation_error"
    assert "primary_role" in response.data["error"]["fields"]
    assert not User.objects.filter(email=f"{forbidden_role.lower()}@example.com").exists()


@pytest.mark.django_db
def test_registration_rejects_a_weak_password(api):
    response = api.post(
        REGISTER_URL, {"email": "weak@example.com", "password": "pass"}, format="json"
    )
    assert response.status_code == 400
    assert "password" in response.data["error"]["fields"]


@pytest.mark.django_db
def test_registration_rejects_a_duplicate_email_case_insensitively(api):
    make_user("taken@example.com")
    response = api.post(
        REGISTER_URL, {"email": "TAKEN@example.com", "password": VALID_PASSWORD}, format="json"
    )
    assert response.status_code == 400
    assert "email" in response.data["error"]["fields"]


@pytest.mark.django_db
def test_registration_cannot_set_verification_or_staff_flags(api):
    api.post(
        REGISTER_URL,
        {"email": "sneaky@example.com", "password": VALID_PASSWORD,
         "is_staff": True, "is_superuser": True, "email_verified_at": "2020-01-01T00:00:00Z"},
        format="json",
    )
    user = User.objects.get(email="sneaky@example.com")
    assert user.is_staff is False
    assert user.is_superuser is False
    assert user.is_email_verified is False
```

`backend/accounts/tests/test_email_verification.py`:

```python
from datetime import timedelta

import pytest
from django.core import mail
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from accounts.models import EmailVerificationToken, User
from accounts.services import (
    consume_email_verification_token,
    issue_email_verification_token,
)
from accounts.tests.factories import make_user

VERIFY_URL = "/api/v1/auth/verify-email/"
RESEND_URL = "/api/v1/auth/resend-verification/"


@pytest.fixture
def api():
    return APIClient()


@pytest.mark.django_db
def test_verifying_with_a_valid_token_sets_email_verified_at(api):
    user = make_user("verify@example.com", verified=False)
    raw = issue_email_verification_token(user)

    response = api.post(VERIFY_URL, {"token": raw}, format="json")

    assert response.status_code == 200
    user.refresh_from_db()
    assert user.is_email_verified is True


@pytest.mark.django_db
def test_a_token_can_only_be_used_once(api):
    user = make_user("once@example.com", verified=False)
    raw = issue_email_verification_token(user)
    api.post(VERIFY_URL, {"token": raw}, format="json")

    response = api.post(VERIFY_URL, {"token": raw}, format="json")

    assert response.status_code == 400
    assert response.data["error"]["fields"]["token"] == ["invalid_verification_token"]


@pytest.mark.django_db
def test_an_expired_token_is_rejected():
    user = make_user("expired@example.com", verified=False)
    raw = issue_email_verification_token(user)
    EmailVerificationToken.objects.filter(user=user).update(
        expires_at=timezone.now() - timedelta(seconds=1)
    )
    with pytest.raises(ValidationError):
        consume_email_verification_token(raw)
    user.refresh_from_db()
    assert user.is_email_verified is False


@pytest.mark.django_db
def test_an_unknown_token_is_rejected(api):
    response = api.post(VERIFY_URL, {"token": "not-a-real-token"}, format="json")
    assert response.status_code == 400


@pytest.mark.django_db
def test_verifying_invalidates_the_users_other_outstanding_tokens():
    user = make_user("multi@example.com", verified=False)
    stale = issue_email_verification_token(user)
    fresh = issue_email_verification_token(user)

    consume_email_verification_token(fresh)

    assert EmailVerificationToken.objects.filter(user=user, used_at__isnull=True).count() == 0
    with pytest.raises(ValidationError):
        consume_email_verification_token(stale)


@pytest.mark.django_db
def test_resend_issues_a_new_token_and_email(api, django_capture_on_commit_callbacks):
    user = make_user("resend@example.com", verified=False)
    mail.outbox.clear()

    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        response = api.post(RESEND_URL, {"email": "resend@example.com"}, format="json")

    assert response.status_code == 202
    assert len(callbacks) == 1
    assert EmailVerificationToken.objects.filter(user=user, used_at__isnull=True).count() == 1
    assert len(mail.outbox) == 1


@pytest.mark.django_db
def test_resend_does_not_disclose_whether_an_account_exists(
    api, django_capture_on_commit_callbacks
):
    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        response = api.post(RESEND_URL, {"email": "nobody@example.com"}, format="json")

    assert response.status_code == 202
    # The load-bearing assertion: nothing was even QUEUED, because the
    # account-exists check short-circuited. Asserting only on mail.outbox would
    # pass vacuously if on_commit callbacks were never executed at all.
    assert callbacks == []
    assert mail.outbox == []


@pytest.mark.django_db
def test_resend_is_a_no_op_for_an_already_verified_account(
    api, django_capture_on_commit_callbacks
):
    make_user("already@example.com", verified=True)
    mail.outbox.clear()

    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        response = api.post(RESEND_URL, {"email": "already@example.com"}, format="json")

    assert response.status_code == 202
    assert callbacks == []  # the already-verified check short-circuits before queuing
    assert mail.outbox == []
```

**Note (why `django_capture_on_commit_callbacks` — this is not optional):** `register_user()` and the resend service both queue the email with `transaction.on_commit(...)`. Every test marked `@pytest.mark.django_db` runs inside pytest-django's transactional wrapper, which rolls the transaction back and **never commits** — so `on_commit` callbacks are registered and then discarded, and `mail.outbox` stays empty no matter what. This has nothing to do with Celery: `CELERY_TASK_ALWAYS_EAGER` only controls what happens *once the callback runs*, and the callback never runs. pytest-django's `django_capture_on_commit_callbacks` fixture (standard since pytest-django 4.4) is the supported way to force them; with `execute=True` it runs every callback registered inside the `with` block on exit, and yields the list of them so a test can assert on *how many* were queued.

The pattern, in three parts: take the fixture in the test signature, wrap **only the action** in `with django_capture_on_commit_callbacks(execute=True) as callbacks:`, and make every `mail.outbox` / `callbacks` assertion **after** the `with` block (inside it, the callbacks have not fired yet). Apply the same pattern in any later phase that asserts on an `on_commit`-queued side effect.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd backend
uv run pytest accounts/tests/test_registration.py accounts/tests/test_email_verification.py -v
```

Expected: `ImportError: cannot import name 'EmailVerificationToken' from 'accounts.models'`.

- [ ] **Step 3: Add the token model and migrate**

Append to `backend/accounts/models.py`:

```python
class EmailVerificationToken(UUIDTimeStampedModel):
    """Single-use, hashed, expiring email-verification token."""

    user = models.ForeignKey(
        "accounts.User",
        related_name="email_verification_tokens",
        on_delete=models.CASCADE,
    )
    token_hash = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [models.Index(fields=["user", "used_at"])]

    def __str__(self):
        return f"verification for {self.user_id}"
```

```bash
uv run python manage.py makemigrations accounts
uv run python manage.py migrate
```

Expected: `accounts/migrations/0002_emailverificationtoken.py` created and applied.

- [ ] **Step 4: Implement the services**

`backend/accounts/services.py`:

```python
import hashlib
import hmac
import secrets
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from accounts.models import EmailVerificationToken, User
from accounts.tasks import send_email_verification_email

EMAIL_VERIFICATION_TOKEN_TTL = timedelta(hours=24)


def hash_verification_token(raw_token: str) -> str:
    return hmac.new(
        settings.SECRET_KEY.encode(), raw_token.encode(), hashlib.sha256
    ).hexdigest()


def issue_email_verification_token(user: User) -> str:
    """Create a token row and return the RAW token. Only the hash is persisted."""
    raw_token = secrets.token_urlsafe(32)
    EmailVerificationToken.objects.create(
        user=user,
        token_hash=hash_verification_token(raw_token),
        expires_at=timezone.now() + EMAIL_VERIFICATION_TOKEN_TTL,
    )
    return raw_token


@transaction.atomic
def consume_email_verification_token(raw_token: str) -> User:
    """Single-use consumption under a row lock (spec 2.3)."""
    token = (
        EmailVerificationToken.objects.select_for_update()
        .filter(token_hash=hash_verification_token(raw_token or ""))
        .first()
    )
    now = timezone.now()
    if token is None or token.used_at is not None or token.expires_at <= now:
        raise ValidationError({"token": ["invalid_verification_token"]})

    token.used_at = now
    token.save(update_fields=["used_at", "updated_at"])

    EmailVerificationToken.objects.filter(user_id=token.user_id, used_at__isnull=True).update(
        used_at=now, updated_at=now
    )

    user = User.objects.select_for_update().get(pk=token.user_id)
    if user.email_verified_at is None:
        user.email_verified_at = now
        user.save(update_fields=["email_verified_at", "updated_at"])
    return user


def queue_email_verification(user: User) -> None:
    """Issue a token and schedule the email AFTER the transaction commits (spec 1)."""
    raw_token = issue_email_verification_token(user)
    transaction.on_commit(
        lambda: send_email_verification_email.apply_async(
            args=[str(user.pk), raw_token], queue="notifications"
        )
    )


@transaction.atomic
def register_user(*, email, password, full_name="", locale=None, primary_role=None) -> User:
    from accounts.enums import Locale, UserRole

    user = User.objects.create_user(
        email=email,
        password=password,
        full_name=full_name,
        locale=locale or Locale.EN,
        primary_role=primary_role or UserRole.BUYER,
    )
    queue_email_verification(user)
    return user
```

**Note (import placement — there is no cycle here):** `accounts/tasks.py` imports only `accounts.models` (for rendering the email); it does **not** import `accounts.services`. The dependency is therefore one-directional — `services → tasks → models` — so `from accounts.tasks import send_email_verification_email` belongs in the normal import block at the top of `services.py`, like every other import. Do not place it at the bottom of the file and do not annotate it with a cycle-breaking comment; that would be untrue and would invite later phases to copy a non-pattern. If a genuine cycle ever appears, fix the direction of the dependency rather than moving the import.

- [ ] **Step 5: Implement the Celery task**

`backend/accounts/tasks.py`:

```python
import logging

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail

from accounts.models import User

logger = logging.getLogger(__name__)

SUBJECTS = {
    "EN": "Confirm your NAUTA email address",
    "IT": "Conferma il tuo indirizzo email NAUTA",
    "ES": "Confirma tu direccion de correo NAUTA",
}
BODIES = {
    "EN": "Hello {name},\n\nConfirm your NAUTA account by opening:\n{url}\n\nThis link expires in 24 hours.",
    "IT": "Ciao {name},\n\nConferma il tuo account NAUTA aprendo:\n{url}\n\nIl link scade tra 24 ore.",
    "ES": "Hola {name},\n\nConfirma tu cuenta NAUTA abriendo:\n{url}\n\nEl enlace caduca en 24 horas.",
}


@shared_task(queue="notifications")
def send_email_verification_email(user_id: str, raw_token: str) -> None:
    user = User.objects.filter(pk=user_id).first()
    if user is None:
        logger.warning("verification email skipped: user %s no longer exists", user_id)
        return

    locale = user.locale if user.locale in SUBJECTS else "EN"
    url = f"{settings.PUBLIC_BASE_URL}/verify-email?token={raw_token}"
    send_mail(
        subject=SUBJECTS[locale],
        message=BODIES[locale].format(name=user.get_short_name(), url=url),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
    )
    logger.info("verification email sent", extra={"user_id": str(user.pk)})
```

**Note:** the raw token appears only in the email body and the task argument — never in a log line (spec §33.5). Localization uses the three supported locales with EN fallback (spec §29's "localize by recipient locale with EN fallback"); template-file-based email rendering arrives with the notification system in Phase 18.

Add the route in `backend/config/settings/base.py`'s existing `CELERY_TASK_ROUTES`:

```python
CELERY_TASK_ROUTES = {
    "common.tasks.*": {"queue": "default"},
    "accounts.tasks.*": {"queue": "notifications"},
}
```

- [ ] **Step 6: Implement the serializers**

`backend/accounts/serializers.py`:

```python
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from accounts.enums import Locale, UserRole
from accounts.models import User, UserManager

SELF_SERVICE_ROLES = (
    UserRole.BUYER,
    UserRole.PRIVATE_SELLER,
    UserRole.SERVICE_PROVIDER,
)


class RegistrationSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(write_only=True, max_length=128)
    full_name = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")
    locale = serializers.ChoiceField(choices=Locale.choices, required=False, default=Locale.EN)
    primary_role = serializers.ChoiceField(
        choices=[(role.value, role.label) for role in SELF_SERVICE_ROLES],
        required=False,
        default=UserRole.BUYER,
    )

    def validate_email(self, value):
        normalized = UserManager.normalize_email(value)
        if User.objects.filter(email=normalized).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return normalized

    def validate_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages)) from exc
        return value


class VerifyEmailSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=128)


class ResendVerificationSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)


class UserSummarySerializer(serializers.ModelSerializer):
    email_verified = serializers.BooleanField(source="is_email_verified", read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "full_name",
            "primary_role",
            "locale",
            "email_verified",
            "is_active",
        )
        read_only_fields = ("id", "email", "primary_role", "email_verified", "is_active")
```

**Note (why `RegistrationSerializer` is a plain `Serializer`):** a `ModelSerializer` over `User` would expose every model field to mass assignment unless every privileged field were explicitly excluded — exactly the class of bug spec §2.2 warns about. An explicit field list means `is_staff`, `is_superuser`, `email_verified_at` and `groups` are structurally unreachable from the request body, which `test_registration_cannot_set_verification_or_staff_flags` proves. `primary_role` is restricted to the three self-service roles; `BROKER` capability comes from a `BrokerMembership` granted by a broker admin (Task 9) and `STAFF` only from Django admin.

- [ ] **Step 7: Implement the views and URLs**

`backend/accounts/views.py`:

```python
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.serializers import (
    RegistrationSerializer,
    ResendVerificationSerializer,
    UserSummarySerializer,
    VerifyEmailSerializer,
)
from accounts.services import (
    consume_email_verification_token,
    queue_email_verification,
    register_user,
)


class RegisterView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_scope = "auth"

    def post(self, request):
        serializer = RegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = register_user(**serializer.validated_data)
        return Response(UserSummarySerializer(user).data, status=status.HTTP_201_CREATED)


class VerifyEmailView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_scope = "auth"

    def post(self, request):
        serializer = VerifyEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = consume_email_verification_token(serializer.validated_data["token"])
        return Response(UserSummarySerializer(user).data, status=status.HTTP_200_OK)


class ResendVerificationView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_scope = "auth"

    def post(self, request):
        serializer = ResendVerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = User.objects.filter(
            email=serializer.validated_data["email"].strip().lower(),
            is_active=True,
            email_verified_at__isnull=True,
        ).first()
        if user is not None:
            queue_email_verification(user)
        # Always 202: the response must not reveal whether the address is registered.
        return Response(status=status.HTTP_202_ACCEPTED)
```

`backend/accounts/urls.py`:

```python
from django.urls import path

from accounts.views import RegisterView, ResendVerificationView, VerifyEmailView

urlpatterns = [
    path("auth/register/", RegisterView.as_view(), name="auth-register"),
    path("auth/verify-email/", VerifyEmailView.as_view(), name="auth-verify-email"),
    path(
        "auth/resend-verification/",
        ResendVerificationView.as_view(),
        name="auth-resend-verification",
    ),
]
```

In `backend/config/urls.py`, **add one entry to the EXISTING `urlpatterns` list — do not replace the list.** Read the file first: besides admin, health and the Stripe webhook, three more routes are already merged (`platform/public-settings/` from Phase 2, `finance/quotes/` from Phase 8, and the `taxonomy.urls` include from Phase 4), each with its own import at the top of the file. Dropping any of them silently 404s an already-shipped endpoint.

This task adds exactly one line to `urlpatterns` (plus nothing to the imports — `include` is already imported):

```python
    path("api/v1/", include("accounts.urls")),
```

Result (every pre-existing route preserved, the new one marked):

```python
from django.contrib import admin
from django.urls import include, path

from common.views import HealthCheckView, StripeWebhookView
from finance.views import FinanceQuoteView
from platform_settings.views import PublicPlatformSettingsView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/health/", HealthCheckView.as_view(), name="health-check"),
    path("api/v1/stripe/webhook/", StripeWebhookView.as_view(), name="stripe-webhook"),
    path(                                          # already merged (Phase 2) — KEEP
        "api/v1/platform/public-settings/",
        PublicPlatformSettingsView.as_view(),
        name="platform-public-settings",
    ),
    path(                                          # already merged (Phase 8) — KEEP
        "api/v1/finance/quotes/", FinanceQuoteView.as_view(), name="finance-quote"
    ),
    path("api/v1/", include("taxonomy.urls")),     # already merged (Phase 4) — KEEP
    path("api/v1/", include("accounts.urls")),     # <- added by Task 3
]
```

Two `include()`s can share the `api/v1/` prefix safely — Django tries each in order and falls through on no match, and `taxonomy.urls` and `accounts.urls` define disjoint sub-paths. If a later-merged phase has added further routes since this plan was written, keep those as well; this task only ever appends.

**Activate throttling — `throttle_scope` alone does nothing.** The three views above declare `throttle_scope = "auth"`, but a scope is inert until DRF is told which throttle class and which rates to use. Those settings are added **here, in Task 3**, not later: if they arrived with Task 4, then between this task merging and Task 4 merging (or if this task is ever evaluated standalone) registration, verification and resend would be completely unthrottled — an open account-creation and email-flood window on endpoints that send mail to arbitrary addresses.

`backend/common/throttling.py`:

```python
import hashlib
import hmac

from django.conf import settings
from rest_framework.throttling import ScopedRateThrottle


class HashedIPScopedRateThrottle(ScopedRateThrottle):
    """ScopedRateThrottle that never lets a raw client IP reach the cache.

    DRF's SimpleRateThrottle.get_cache_key() embeds get_ident()'s return value
    verbatim, producing Redis keys like `throttle_auth_192.0.2.7`. Spec 30.4 is
    explicit: "Rate limiting must not store raw IP beyond approved security
    systems." Hashing the identifier keeps the throttle exactly as effective
    (the hash is stable and 1:1 with the IP) while storing no readable address.

    The HMAC key is CONTACT_HASH_SECRET, the same secret spec 11.7 already
    mandates for `viewer_hash = HMAC-SHA256(CONTACT_HASH_SECRET, canonical_client_ip)`
    on ListingView. Reusing it keeps one IP-pseudonymization secret for the whole
    project, so rotating it rotates every derived identifier at once.
    """

    def get_ident(self, request):
        ident = super().get_ident(request)
        if not ident:
            return ident
        return hmac.new(
            settings.CONTACT_HASH_SECRET.encode(),
            str(ident).encode(),
            hashlib.sha256,
        ).hexdigest()
```

`backend/common/tests/test_throttling.py`:

```python
from rest_framework.test import APIRequestFactory

from common.throttling import HashedIPScopedRateThrottle


def test_the_cache_key_never_contains_the_raw_ip():
    request = APIRequestFactory().post("/api/v1/auth/register/", REMOTE_ADDR="198.51.100.9")
    throttle = HashedIPScopedRateThrottle()
    ident = throttle.get_ident(request)

    assert "198.51.100.9" not in ident
    assert len(ident) == 64  # sha256 hex
    # Deterministic: the same address must always map to the same bucket.
    assert throttle.get_ident(request) == ident
```

Then, in `backend/config/settings/base.py`, edit the **existing** `REST_FRAMEWORK` dict. **Modify the EXISTING dict in place — do not replace it.** Two keys are already there and must survive: `DEFAULT_THROTTLE_CLASSES` (pointing at DRF's stock `ScopedRateThrottle`) and `DEFAULT_THROTTLE_RATES` (carrying Phase 4's `taxonomy_search` rate). Task 2 added `EXCEPTION_HANDLER` to the same dict.

This task makes exactly two changes:

1. **Replace the value of** `DEFAULT_THROTTLE_CLASSES` with `common.throttling.HashedIPScopedRateThrottle`. This is a drop-in superclass swap — `HashedIPScopedRateThrottle` *is* a `ScopedRateThrottle`, so every existing scoped view (including taxonomy's) keeps working, and its cache keys stop carrying raw IPs. Note that `taxonomy/views.py` pins `throttle_classes = [ScopedRateThrottle]` on its own views, so those two views keep using the stock class until a future cleanup pass changes them — see Known Limitations.
2. **Add** the `"auth": "10/min"` entry **inside** the existing `DEFAULT_THROTTLE_RATES` dict, alongside `taxonomy_search`.

Result (pre-existing keys preserved, this task's changes marked):

```python
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "EXCEPTION_HANDLER": "common.exceptions.nauta_exception_handler",
    "DEFAULT_THROTTLE_CLASSES": [
        "common.throttling.HashedIPScopedRateThrottle",  # <- Task 3: was stock ScopedRateThrottle
    ],
    "DEFAULT_THROTTLE_RATES": {
        "taxonomy_search": "60/min",  # <- already merged (Phase 4) — KEEP
        "auth": "10/min",             # <- added by Task 3
    },
}
```

**Deleting `taxonomy_search` would break the already-merged taxonomy search endpoints** with `ImproperlyConfigured: No default throttle rate set for 'taxonomy_search' scope`. Read the real file first: if further phases have merged additional rates since this plan was written, keep those too — this task only ever *adds* `auth`.

**Note:** a scoped throttle is a safe global default — it is a no-op on any view that does not declare `throttle_scope`, so only the `/api/v1/auth/*` views are limited. Per-endpoint limits for inquiry, messaging, brand/model search, finance quotes, Checkout and upload intents (spec §30.4) are added by the phases that own those endpoints, each adding its own scope to `DEFAULT_THROTTLE_RATES` and reusing `HashedIPScopedRateThrottle`.

**Note (endpoint naming):** spec §30.1 lists only `/api/v1/session/` among identity endpoints — registration, login, token refresh, verification and profile are not enumerated anywhere in the spec. §30.1 closes with "Exact URL naming may follow an established API convention, but semantics, authorization and errors must remain equivalent", so this plan fixes them as `/api/v1/auth/<action>/` with the session endpoint kept exactly as specified. Later phases must use these paths rather than inventing alternatives.

- [ ] **Step 8: Run the tests to verify they pass**

```bash
uv run pytest accounts/tests/test_registration.py accounts/tests/test_email_verification.py \
  common/tests/test_throttling.py -v
```

Expected: every test in these three files `PASS`, with **no** failures, errors or skips. Treat the behaviour, not a count, as the contract — do not chase a number if you add or split a test. What must be covered:

- `test_registration.py` — registration creates an unverified, active buyer; sends exactly one verification email and persists only a token *hash*; accepts the self-service roles; rejects each privileged role (`STAFF`, `BROKER`); rejects a weak password; rejects a duplicate email case-insensitively; and ignores client attempts to set verification or staff flags.
- `test_email_verification.py` — a valid token sets `email_verified_at`; a token is single-use; expired and unknown tokens are rejected; verifying invalidates the user's other outstanding tokens; resend issues a new token and email, does not disclose whether an account exists, and is a no-op for an already-verified account.
- `test_throttling.py` — the throttle cache key never contains the raw client IP.

Two mechanisms have to line up for the email assertions to hold, and they are independent:

1. `django_capture_on_commit_callbacks(execute=True)` runs the `transaction.on_commit` callback that `queue_email_verification()` registered. Without it the callback is discarded at rollback and nothing is sent — see the note under Step 1.
2. Once the callback runs, `config/settings/test.py`'s `CELERY_TASK_ALWAYS_EAGER = True` makes `apply_async` execute the task inline, and `EMAIL_BACKEND` (`locmem` under pytest-django) captures the message in `mail.outbox`.

Neither substitutes for the other: eager Celery does not cause a commit, and a captured commit does not by itself run a Celery task.

- [ ] **Step 9: Check `PUBLIC_BASE_URL` before the manual round-trip**

The verification link is built as `f"{settings.PUBLIC_BASE_URL}/verify-email?token=…"`, so a stale port here produces links that 404 in the browser.

```bash
grep PUBLIC_BASE_URL backend/.env backend/.env.example
```

Expected: **both** read `PUBLIC_BASE_URL=http://localhost:3020`. At the time of writing `backend/.env.example` is already correct but `backend/.env` still carries the pre-Phase-0/1 default `http://localhost:3000` — the frontend dev server runs on **3020** (Global Constraints). If `.env` differs, change it to `http://localhost:3020` before continuing; the next step's expected output depends on it. CI's own `PUBLIC_BASE_URL` env var in `.github/workflows/ci.yml` is already `:3020` and needs no change.

- [ ] **Step 10: Manual verification against a real worker and a real transaction commit**

```bash
uv run celery -A config worker -Q default,notifications,media,maintenance -l info --pool=solo
```

In a second terminal (dev settings, real broker, `console.EmailBackend`):

```bash
uv run python manage.py runserver 8020
curl -s -X POST http://localhost:8020/api/v1/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{"email":"manual@example.com","password":"n4uta-test-Passw0rd"}'
```

Expected: HTTP 201 with the user summary; the worker log shows `accounts.tasks.send_email_verification_email` received on the **`notifications`** queue (not `default`), and the dev server console prints the verification email containing a `http://localhost:3020/verify-email?token=…` link. POST that token to `/api/v1/auth/verify-email/` and confirm `email_verified` flips to `true`, and that a second POST of the same token returns the 400 envelope with `"code": "validation_error"` and `fields.token == ["invalid_verification_token"]`.

Finally, prove the throttle is live *in this task* (not waiting for Task 4): replay the same `curl` 11 times in a row and confirm the last response is HTTP 429 with the envelope `{"error":{"code":"throttled",…}}`. Then confirm no raw IP was stored, using the Redis container:

```bash
docker compose exec redis redis-cli -n 1 --scan --pattern 'throttle*'
```

Expected: keys of the form `throttle_auth_<64 hex chars>` — no dotted-quad address anywhere in the key (spec §30.4). (Adjust `-n` to whichever logical DB `REDIS_URL` points at for the cache.)

- [ ] **Step 11: Commit**

```bash
git add backend/accounts backend/common/throttling.py backend/common/tests \
  backend/config/urls.py backend/config/settings/base.py backend/.env.example
git commit -m "feat(accounts): add registration and single-use email verification"
```

(`backend/.env` is git-ignored and is not committed; only `.env.example` is, and only if Step 9 found it wrong.)

---

### Task 4: JWT login, cookie-backed refresh, logout and auth rate limiting

**Files:**
- Create: `backend/accounts/cookies.py`
- Modify: `backend/accounts/serializers.py`, `backend/accounts/views.py`, `backend/accounts/urls.py`
- Modify: `backend/config/settings/base.py` (`INSTALLED_APPS` + `SIMPLE_JWT` additions, the `"auth-refresh"` throttle rate, `REFRESH_COOKIE_SECURE`), `backend/config/settings/dev.py` (CORS credentials, `REFRESH_COOKIE_SECURE = False`)
- Test: `backend/accounts/tests/test_auth_endpoints.py`

**Interfaces:**
- Consumes: `accounts.models.User`, `accounts.serializers.UserSummarySerializer` (Task 3), the error envelope (Task 2).
- Produces:
  - `POST /api/v1/auth/login/` → `200 {"access": "<jwt>", "user": {…UserSummary}}`; the refresh token is returned **only** as an `HttpOnly` cookie, never in the body.
  - `POST /api/v1/auth/token/refresh/` → `200 {"access": "<jwt>"}`; reads the refresh token from the cookie (or from a `refresh` body field, for non-browser clients) and rotates it.
  - `POST /api/v1/auth/logout/` → `204`, blacklists the refresh token and clears the cookie.
  - `accounts.cookies.REFRESH_COOKIE_NAME == "nauta_refresh"`, `accounts.cookies.REFRESH_COOKIE_PATH == "/api/v1/auth/"`, `set_refresh_cookie(response, token)`, `clear_refresh_cookie(response)`.
  - `settings.REFRESH_COOKIE_SECURE` — explicit boolean (fail-closed default `True`; `dev.py` sets `False`) controlling the refresh cookie's `Secure` attribute.
  - Throttle scope `"auth-refresh"` rated `30/min`, used **only** by `RefreshView`. Login, logout, registration, verification and resend stay on Task 3's `"auth"` scope at `10/min` (spec §30.4). Both use `common.throttling.HashedIPScopedRateThrottle`, which Task 3 already installed as `DEFAULT_THROTTLE_CLASSES`.
- Consumes (from Task 3): `common.throttling.HashedIPScopedRateThrottle`, `REST_FRAMEWORK["DEFAULT_THROTTLE_CLASSES"]`/`["DEFAULT_THROTTLE_RATES"]` and the `"auth"` scope — all already in place; this task only adds the `"auth-refresh"` rate.

**Note (token contents — binding on every later phase):** the access token carries **only** `user_id` (SimpleJWT's default claim set). Roles, memberships and permissions are deliberately **not** embedded. Spec §2.2 requires the backend to independently reject unauthorized actions, and an embedded role claim stays valid until the token expires — so a demoted, deactivated or removed broker member would keep their old authority for up to 15 minutes. Every permission check in this project re-reads the database. Later phases must never add a role or permission claim to the token.

**Note (why the refresh token lives in a cookie):** spec §33.1 requires "Secure/HttpOnly/SameSite cookies". The long-lived refresh token is the valuable credential, so it is set `HttpOnly`, `Secure` (per the explicit `REFRESH_COOKIE_SECURE` setting — `True` everywhere except the plain-HTTP `dev` settings module), `SameSite=Lax`, scoped to `path=/api/v1/auth/` — unreachable from JavaScript, and never sent to any other endpoint. The short-lived access token is held in JavaScript memory only (Task 10) and never written to `localStorage`. `SameSite=Lax` is sufficient because the frontend and API are same-site in every environment: `localhost:3020`/`localhost:8020` in dev (SameSite ignores port), and a single origin in production via a Next.js rewrite.

- [ ] **Step 1: Write the failing tests**

`backend/accounts/tests/test_auth_endpoints.py`:

```python
import pytest
from rest_framework.test import APIClient, APIRequestFactory
from rest_framework_simplejwt.authentication import JWTAuthentication

from accounts.cookies import REFRESH_COOKIE_NAME
from accounts.tests.factories import DEFAULT_TEST_PASSWORD, make_user

LOGIN_URL = "/api/v1/auth/login/"
REFRESH_URL = "/api/v1/auth/token/refresh/"
LOGOUT_URL = "/api/v1/auth/logout/"
ACCOUNT_URL = "/api/v1/account/"


@pytest.fixture
def api():
    return APIClient()


@pytest.mark.django_db
def test_login_returns_an_access_token_and_the_user_summary(api):
    make_user("login@example.com", full_name="Log In")

    response = api.post(
        LOGIN_URL, {"email": "login@example.com", "password": DEFAULT_TEST_PASSWORD}, format="json"
    )

    assert response.status_code == 200
    assert response.data["access"]
    assert response.data["user"]["email"] == "login@example.com"
    assert response.data["user"]["email_verified"] is True


@pytest.mark.django_db
def test_login_never_puts_the_refresh_token_in_the_body(api):
    make_user("cookie@example.com")
    response = api.post(
        LOGIN_URL, {"email": "cookie@example.com", "password": DEFAULT_TEST_PASSWORD}, format="json"
    )
    assert "refresh" not in response.data
    cookie = response.cookies[REFRESH_COOKIE_NAME]
    assert cookie["httponly"] is True
    assert cookie["samesite"] == "Lax"
    assert cookie["path"] == "/api/v1/auth/"


@pytest.mark.django_db
def test_login_refresh_cookie_is_marked_secure(api):
    """REFRESH_COOKIE_SECURE is an explicit setting, not `not DEBUG`.

    config/settings/test.py inherits base.py's fail-closed default of True, so
    this catches a regression to an implicitly-derived (or forgotten) flag.
    """
    make_user("secureflag@example.com")
    response = api.post(
        LOGIN_URL,
        {"email": "secureflag@example.com", "password": DEFAULT_TEST_PASSWORD},
        format="json",
    )
    assert response.cookies[REFRESH_COOKIE_NAME]["secure"] is True


@pytest.mark.django_db
def test_login_is_case_insensitive_on_email(api):
    make_user("case@example.com")
    response = api.post(
        LOGIN_URL, {"email": "CASE@Example.com", "password": DEFAULT_TEST_PASSWORD}, format="json"
    )
    assert response.status_code == 200


@pytest.mark.django_db
def test_login_with_a_wrong_password_is_401_with_a_stable_code(api):
    make_user("wrong@example.com")
    response = api.post(
        LOGIN_URL, {"email": "wrong@example.com", "password": "not-the-password"}, format="json"
    )
    assert response.status_code == 401
    assert response.data["error"]["code"] == "no_active_account"


@pytest.mark.django_db
def test_an_inactive_user_cannot_log_in(api):
    make_user("inactive@example.com", is_active=False)
    response = api.post(
        LOGIN_URL, {"email": "inactive@example.com", "password": DEFAULT_TEST_PASSWORD},
        format="json",
    )
    assert response.status_code == 401


@pytest.mark.django_db
def test_an_unverified_user_can_still_log_in(api):
    """Verification gates actions, not authentication (spec 1 + 12)."""
    make_user("unverified@example.com", verified=False)
    response = api.post(
        LOGIN_URL, {"email": "unverified@example.com", "password": DEFAULT_TEST_PASSWORD},
        format="json",
    )
    assert response.status_code == 200
    assert response.data["user"]["email_verified"] is False


@pytest.mark.django_db
def test_refresh_uses_the_cookie_and_rotates_it(api):
    make_user("refresh@example.com")
    login = api.post(
        LOGIN_URL, {"email": "refresh@example.com", "password": DEFAULT_TEST_PASSWORD},
        format="json",
    )
    original_cookie = login.cookies[REFRESH_COOKIE_NAME].value

    response = api.post(REFRESH_URL, {}, format="json")

    assert response.status_code == 200
    assert response.data["access"]
    assert "refresh" not in response.data
    assert response.cookies[REFRESH_COOKIE_NAME].value != original_cookie


@pytest.mark.django_db
def test_refresh_without_a_cookie_is_401(api):
    response = api.post(REFRESH_URL, {}, format="json")
    assert response.status_code == 401
    assert response.data["error"]["code"] == "token_not_valid"


@pytest.mark.django_db
def test_logout_blacklists_the_refresh_token_and_clears_the_cookie(api):
    make_user("logout@example.com")
    login = api.post(
        LOGIN_URL, {"email": "logout@example.com", "password": DEFAULT_TEST_PASSWORD}, format="json"
    )
    # Capture the REAL token value BEFORE logout deletes the cookie. Replaying
    # whatever the cookie jar holds AFTER logout would replay an empty string and
    # only prove "an empty token is rejected" - which says nothing about blacklisting.
    saved_refresh_token = login.cookies[REFRESH_COOKIE_NAME].value
    assert saved_refresh_token  # guard: the test is meaningless without a real value

    logout = api.post(LOGOUT_URL, {}, format="json")
    assert logout.status_code == 204
    assert logout.cookies[REFRESH_COOKIE_NAME].value == ""

    # Replay the SAVED, previously-valid token explicitly. It must be refused
    # because logout blacklisted that specific token, not because it is blank.
    replay = api.post(REFRESH_URL, {"refresh": saved_refresh_token}, format="json")
    assert replay.status_code == 401
    assert replay.data["error"]["code"] == "token_not_valid"

    # Separately: with no cookie and no body at all, the result is also 401 (not 400).
    api.cookies.pop(REFRESH_COOKIE_NAME, None)
    bare = api.post(REFRESH_URL, {}, format="json")
    assert bare.status_code == 401
    assert bare.data["error"]["code"] == "token_not_valid"


@pytest.mark.django_db
def test_a_rotated_refresh_token_cannot_be_replayed(api):
    make_user("replay@example.com")
    login = api.post(
        LOGIN_URL, {"email": "replay@example.com", "password": DEFAULT_TEST_PASSWORD}, format="json"
    )
    first = login.cookies[REFRESH_COOKIE_NAME].value
    api.post(REFRESH_URL, {}, format="json")

    response = api.post(REFRESH_URL, {"refresh": first}, format="json")

    assert response.status_code == 401


@pytest.mark.django_db
def test_the_issued_access_token_authenticates_a_real_request(api):
    """Task 4's OWN proof that login produces a usable credential.

    The `/api/v1/account/` test below is xfailed until Task 9 ships that endpoint,
    which would otherwise leave this task claiming "login works" with nothing
    proving it. This drives SimpleJWT's real authentication class over a real
    request carrying the real Authorization header - no mocks, no stubs.
    """
    user = make_user("bearer@example.com")
    login = api.post(
        LOGIN_URL, {"email": "bearer@example.com", "password": DEFAULT_TEST_PASSWORD}, format="json"
    )
    access = login.data["access"]

    request = APIRequestFactory().get(
        "/api/v1/anything/", HTTP_AUTHORIZATION=f"Bearer {access}"
    )
    authenticated_user, validated_token = JWTAuthentication().authenticate(request)

    assert authenticated_user.pk == user.pk
    assert authenticated_user.is_authenticated is True
    # Spec 2.2 / the "token contents" note: the token carries user_id and nothing else.
    assert validated_token["user_id"] == str(user.pk)
    assert "primary_role" not in validated_token
    assert "permissions" not in validated_token


@pytest.mark.django_db
def test_access_token_authenticates_a_protected_endpoint(api):
    make_user("bearer2@example.com")
    login = api.post(
        LOGIN_URL, {"email": "bearer2@example.com", "password": DEFAULT_TEST_PASSWORD}, format="json"
    )
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")

    response = api.get(ACCOUNT_URL)

    assert response.status_code == 200
    assert response.data["email"] == "bearer2@example.com"


@pytest.mark.django_db
def test_login_is_rate_limited(api):
    make_user("throttle@example.com")
    payload = {"email": "throttle@example.com", "password": "wrong-password-value"}
    for _ in range(10):
        api.post(LOGIN_URL, payload, format="json")

    response = api.post(LOGIN_URL, payload, format="json")

    assert response.status_code == 429
    assert response.data["error"]["code"] == "throttled"


@pytest.mark.django_db
def test_silent_refresh_does_not_consume_the_login_throttle_budget(api):
    """Refresh runs on every page load; it must not be able to lock out logins.

    Proves the `auth-refresh` scope is genuinely separate from `auth`.
    """
    credentials = {"email": "budget@example.com", "password": DEFAULT_TEST_PASSWORD}
    make_user("budget@example.com")
    assert api.post(LOGIN_URL, credentials, format="json").status_code == 200

    for _ in range(12):  # comfortably past the `auth` scope's 10/min
        assert api.post(REFRESH_URL, {}, format="json").status_code == 200

    assert api.post(LOGIN_URL, credentials, format="json").status_code == 200
```

**Note:** `test_access_token_authenticates_a_protected_endpoint` targets `/api/v1/account/`, which Task 9 builds. Until Task 9 lands, that one test is expected to fail with 404 — the implementer of this task should mark it `@pytest.mark.xfail(reason="GET /api/v1/account/ arrives in Task 9", strict=True)` and **remove the marker in Task 9's Step 1**, where it becomes a passing regression test. Do not delete the test and do not weaken the assertion.

**Note (why `test_the_issued_access_token_authenticates_a_real_request` exists alongside it):** with the endpoint test xfailed, Task 4 would otherwise merge asserting "login works" while nothing in the task actually proves the issued access token authenticates anything. The narrower test closes that gap without waiting for Task 9: it drives `JWTAuthentication().authenticate()` — the exact class configured in `DEFAULT_AUTHENTICATION_CLASSES` — over a real `APIRequestFactory` request carrying the real `Authorization` header, and asserts it resolves to the right user. It stays permanently; it is not superseded when Task 9 un-xfails the endpoint test, because it also pins the "token carries only `user_id`" rule that every later phase depends on.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd backend
uv run pytest accounts/tests/test_auth_endpoints.py -v
```

Expected: `ModuleNotFoundError: No module named 'accounts.cookies'`.

- [ ] **Step 3: Add the blacklist app, rotation, the refresh throttle scope and the cookie-security setting**

In `backend/config/settings/base.py`, add `"rest_framework_simplejwt.token_blacklist",` to `INSTALLED_APPS` immediately after `"rest_framework_simplejwt",`.

`DEFAULT_THROTTLE_CLASSES` / `DEFAULT_THROTTLE_RATES` already exist — `DEFAULT_THROTTLE_RATES` arrived with Phase 4 (`taxonomy_search`), and **Task 3 pointed `DEFAULT_THROTTLE_CLASSES` at `common.throttling.HashedIPScopedRateThrottle` and added the `auth` scope**, so its own endpoints were never unthrottled. **Add one rate to the EXISTING dict — do not replace it.** All this task does to `REST_FRAMEWORK` is add a **third** rate entry, for silent token refresh:

```python
    "auth-refresh": "30/min",  # silent refresh only - see the note below
```

Result (every pre-existing key and rate preserved, this task's addition marked):

```python
REST_FRAMEWORK = {
    # ... DEFAULT_AUTHENTICATION_CLASSES / DEFAULT_PERMISSION_CLASSES /
    #     EXCEPTION_HANDLER unchanged from Phase 1 and Task 2 ...
    "DEFAULT_THROTTLE_CLASSES": [
        "common.throttling.HashedIPScopedRateThrottle",  # set by Task 3 — unchanged here
    ],
    "DEFAULT_THROTTLE_RATES": {
        "taxonomy_search": "60/min",  # already merged (Phase 4) — KEEP
        "auth": "10/min",             # Task 3 — login, register, verify-email, resend, logout
        "auth-refresh": "30/min",     # <- added by Task 4: silent refresh only
    },
}
```

**Do not drop `taxonomy_search`** — the already-merged taxonomy search endpoints raise `ImproperlyConfigured: No default throttle rate set` without it. Read the real file before editing and preserve any rate a later-merged phase has added.

**Note (ruling — why refresh gets its own, more generous scope):** the frontend's `SessionProvider` (Task 10) calls `POST /api/v1/auth/token/refresh/` on **every fresh page load** where no in-memory access token exists. Sharing the `auth` bucket with login would mean a handful of reloads, or several open tabs behind one office NAT, could burn the 10/min budget and lock real people out of *logging in* — a self-inflicted denial of service on the highest-traffic auth call. Silent refresh is also lower-risk than a login attempt: it requires an already-valid `HttpOnly` refresh cookie, so it is not a credential-guessing surface. Hence `auth-refresh` at `30/min`, applied **only** to `RefreshView`. Login, registration, verification, resend and logout stay on the stricter `auth` scope. Task 10/11's frontend text refers to this scope by name; keep the two in sync.

Then extend the existing `SIMPLE_JWT` dict (the `ACCESS_TOKEN_LIFETIME` / `REFRESH_TOKEN_LIFETIME` entries are left exactly as Phase 1 wrote them):

```python
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=env.int("JWT_ACCESS_TOKEN_LIFETIME_MINUTES", default=15)
    ),
    "REFRESH_TOKEN_LIFETIME": timedelta(
        days=env.int("JWT_REFRESH_TOKEN_LIFETIME_DAYS", default=7)
    ),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
}
```

**Note (`UPDATE_LAST_LOGIN`):** this makes SimpleJWT write `User.last_login` on each successful token-obtain, which the staff user list in the Django admin (Task 1) already displays and which Task 12's handoff note relies on. It is listed alongside `ROTATE_REFRESH_TOKENS` and `BLACKLIST_AFTER_ROTATION` in this plan's Global Constraints as one of the three `SIMPLE_JWT` keys Phase 3 adds. It costs one extra `UPDATE` per login and changes no token semantics.

Finally add an **explicit** refresh-cookie security flag. In `backend/config/settings/base.py`, next to the other `PUBLIC_BASE_URL` / `CONTACT_HASH_SECRET` env reads:

```python
# Secure-by-default: only the dev settings module opts out, and it does so out loud.
REFRESH_COOKIE_SECURE = env.bool("REFRESH_COOKIE_SECURE", default=True)
```

and in `backend/config/settings/dev.py` (the one environment served over plain `http://localhost`):

```python
REFRESH_COOKIE_SECURE = False
```

**Note (ruling — why not `secure=not settings.DEBUG`):** coupling a security flag to the debug flag means any future change to `DEBUG` silently changes cookie security, and it leaves no single place to read the answer to "is the refresh cookie `Secure` in environment X?". `base.py` does not even define `DEBUG` (only `dev`/`test`/`prod` do), so `not DEBUG` cannot be evaluated there at all. An explicit, fail-closed setting — `True` unless a settings module or env var deliberately says otherwise — inverts the default in the safe direction: a forgotten override leaves the cookie *more* protected, not less. `config/settings/test.py` inherits `True`, which makes `test_login_refresh_cookie_is_marked_secure` a real regression check rather than a tautology.

In `backend/config/settings/dev.py`, replace `CORS_ALLOW_ALL_ORIGINS = True`:

```python
from .base import *  # noqa: F401,F403

DEBUG = True
CORS_ALLOWED_ORIGINS = ["http://localhost:3020", "http://127.0.0.1:3020"]
CORS_ALLOW_CREDENTIALS = True
# Dev is served over plain http://localhost, where a Secure cookie is never sent.
# This is the ONLY environment that opts out; base.py's default is True.
REFRESH_COOKIE_SECURE = False
```

**Note:** `CORS_ALLOW_ALL_ORIGINS = True` makes django-cors-headers answer with `Access-Control-Allow-Origin: *`, which browsers refuse to combine with credentialed requests — so the refresh cookie would never be sent. An explicit origin allowlist is required for cookie auth, and is stricter than what it replaces.

```bash
uv run python manage.py migrate
```

Expected: `token_blacklist` migrations applied.

- [ ] **Step 4: Implement the cookie helpers**

`backend/accounts/cookies.py`:

```python
from django.conf import settings

REFRESH_COOKIE_NAME = "nauta_refresh"
REFRESH_COOKIE_PATH = "/api/v1/auth/"


def set_refresh_cookie(response, refresh_token: str):
    response.set_cookie(
        REFRESH_COOKIE_NAME,
        refresh_token,
        max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
        httponly=True,
        secure=settings.REFRESH_COOKIE_SECURE,
        samesite="Lax",
        path=REFRESH_COOKIE_PATH,
    )
    return response


def clear_refresh_cookie(response):
    response.delete_cookie(REFRESH_COOKIE_NAME, path=REFRESH_COOKIE_PATH)
    return response
```

- [ ] **Step 5: Implement the login serializer and the three views**

Append to `backend/accounts/serializers.py`:

```python
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Authenticate by normalized email; expose the user summary alongside the tokens."""

    username_field = User.USERNAME_FIELD

    def validate(self, attrs):
        attrs[self.username_field] = UserManager.normalize_email(
            attrs.get(self.username_field, "")
        )
        data = super().validate(attrs)
        data["user"] = UserSummarySerializer(self.user).data
        return data
```

**Note:** `TokenObtainPairSerializer` names its credential field after `USERNAME_FIELD`, which is `email` here — so the request body field really is `email`, with no aliasing. It raises `AuthenticationFailed(code="no_active_account")` for both a wrong password and an inactive account, which is the correct non-enumerating behaviour and is what `test_login_with_a_wrong_password_is_401_with_a_stable_code` asserts.

Append to `backend/accounts/views.py`:

```python
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from accounts.cookies import REFRESH_COOKIE_NAME, clear_refresh_cookie, set_refresh_cookie
from accounts.serializers import EmailTokenObtainPairSerializer


class LoginView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_scope = "auth"

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        refresh = response.data.pop("refresh", None)
        if refresh:
            set_refresh_cookie(response, refresh)
        return response


class RefreshView(TokenRefreshView):
    authentication_classes = []
    permission_classes = [AllowAny]
    # Deliberately NOT the "auth" scope: silent refresh runs on every page load.
    throttle_scope = "auth-refresh"

    def post(self, request, *args, **kwargs):
        data = dict(request.data)
        if not data.get("refresh"):
            raw = request.COOKIES.get(REFRESH_COOKIE_NAME) or ""
            if not raw:
                # Do NOT hand the serializer an empty string: `refresh` is required
                # and non-blank, so that would surface as a 400 validation_error
                # instead of the 401 token_not_valid a missing credential must be.
                raise InvalidToken("No refresh token was provided.")
            data["refresh"] = raw
        serializer = self.get_serializer(data=data)
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as exc:
            raise InvalidToken(exc.args[0]) from exc

        payload = dict(serializer.validated_data)
        rotated = payload.pop("refresh", None)
        response = Response(payload, status=status.HTTP_200_OK)
        if rotated:
            set_refresh_cookie(response, rotated)
        return response


class LogoutView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_scope = "auth"

    def post(self, request):
        raw = request.data.get("refresh") or request.COOKIES.get(REFRESH_COOKIE_NAME)
        if raw:
            try:
                RefreshToken(raw).blacklist()
            except TokenError:
                pass  # An already-invalid token means the session is already gone.
        return clear_refresh_cookie(Response(status=status.HTTP_204_NO_CONTENT))
```

**Note (`dict(request.data)`):** for a JSON body `request.data` is a plain dict, but for a form-encoded body it is an immutable `QueryDict` whose `dict()` copy wraps values in lists. Building `data` with `dict(request.data)` then overwriting `data["refresh"]` with a plain string keeps the serializer's input well-formed in both cases; `refresh` is the only field the serializer reads.

**Note (why the missing-cookie branch raises `InvalidToken` instead of falling through):** SimpleJWT's `TokenRefreshSerializer.refresh` is a plain `CharField` — required, and `allow_blank` defaults to `False`. Passing `""` therefore never reaches the `TokenError` branch at all: `is_valid(raise_exception=True)` raises DRF's `ValidationError` first, which the envelope renders as **400 `validation_error`**, not **401 `token_not_valid`**. That is both semantically wrong (a missing credential is an authentication failure, not a malformed payload) and it is what `test_refresh_without_a_cookie_is_401` and the final assertion of `test_logout_blacklists_the_refresh_token_and_clears_the_cookie` assert. Raising `InvalidToken` directly — imported from `rest_framework_simplejwt.exceptions`, `status_code = 401`, `default_code = "token_not_valid"` — produces exactly the expected envelope.

Add to `backend/accounts/urls.py`'s `urlpatterns`:

```python
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/token/refresh/", RefreshView.as_view(), name="auth-token-refresh"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
```

(and extend the import to `from accounts.views import LoginView, LogoutView, RefreshView, RegisterView, ResendVerificationView, VerifyEmailView`).

- [ ] **Step 6: Run the tests to verify they pass**

```bash
uv run pytest accounts/tests/test_auth_endpoints.py -v
```

Expected: every test in the file passes except exactly one `XFAIL` — `test_access_token_authenticates_a_protected_endpoint`, un-xfailed in Task 9. In particular `test_the_issued_access_token_authenticates_a_real_request`, `test_refresh_without_a_cookie_is_401`, `test_logout_blacklists_the_refresh_token_and_clears_the_cookie`, `test_login_refresh_cookie_is_marked_secure` and `test_silent_refresh_does_not_consume_the_login_throttle_budget` must all be **PASS**, not xfail and not skipped.

- [ ] **Step 7: Manual verification of the real cookie and the real throttle**

With Docker Compose and `runserver 8020` running:

```bash
curl -s -i -X POST http://localhost:8020/api/v1/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"manual@example.com","password":"n4uta-test-Passw0rd"}' | head -20
```

Expected: HTTP 200; a `Set-Cookie: nauta_refresh=…; HttpOnly; Path=/api/v1/auth/; SameSite=Lax` header (no `Secure` here, because `dev.py` sets `REFRESH_COOKIE_SECURE = False` for plain-HTTP localhost); the JSON body contains `access` and `user` but **no** `refresh`. Then run the same command 11 times in a row and confirm the last one returns HTTP 429 with the envelope `{"error":{"code":"throttled",…}}` — proving the throttle is reading the real Redis cache rather than a per-process counter.

Also confirm that exhausting the login budget does **not** break silent refresh, and vice versa — the two scopes are separate:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  http://localhost:8020/api/v1/auth/token/refresh/ \
  -H "Content-Type: application/json" -b "nauta_refresh=<paste the cookie value>" -d '{}'
```

Expected: `200` even immediately after the login endpoint has started returning 429.

And with **no** cookie and an empty body:

```bash
curl -s -i -X POST http://localhost:8020/api/v1/auth/token/refresh/ \
  -H "Content-Type: application/json" -d '{}' | head -5
```

Expected: **HTTP 401** with `"code": "token_not_valid"` — **not** 400 `validation_error` (see the missing-cookie note in Step 5).

- [ ] **Step 8: Commit**

```bash
git add backend/accounts backend/config/settings/base.py backend/config/settings/dev.py
git commit -m "feat(accounts): add jwt login, cookie refresh, logout and auth throttling"
```

---

### Task 5: `brokers` app — `BrokerOrganization` and `BrokerMembership`

**Files:**
- Create: `backend/brokers/__init__.py`, `apps.py`, `enums.py`, `models.py`, `services.py`, `admin.py`
- Create: `backend/brokers/migrations/__init__.py`, `backend/brokers/migrations/0001_initial.py` (generated)
- Modify: `backend/accounts/services.py` (append `is_staff_moderator` / `is_staff_admin` — see Step 5)
- Modify: `backend/config/settings/base.py` (`INSTALLED_APPS`)
- Test: `backend/brokers/tests/__init__.py`, `factories.py`, `test_models.py`, `test_services.py`, `test_admin.py`

**Interfaces:**
- Consumes: `common.models.UUIDTimeStampedModel`, `accounts.enums.StaffGroup`, `settings.AUTH_USER_MODEL`.
- Produces (exact names later phases import):
  - `brokers.enums.BrokerOrganizationStatus` — `TextChoices`: `DRAFT`, `PENDING`, `ACTIVE`, `SUSPENDED`.
  - `brokers.enums.BrokerMembershipRole` — `TextChoices`: `ADMIN`, `MANAGER`, `AGENT`, `VIEWER`.
  - `brokers.models.BrokerOrganization` — `id`, `name`, `slug` (unique), `status`, `public_email`, `public_phone`, `website_url` (nullable), `auto_approve_listings` (bool, default `False`), `auto_approve_changed_by` (nullable FK `User`, `related_name="broker_auto_approve_changes"`), `auto_approve_changed_at` (nullable), `created_at`, `updated_at`. Reverse accessor from listings in Phase 11: `related_name="memberships"` is taken by `BrokerMembership`; Phase 11 should use `related_name="listings"`.
  - `brokers.models.BrokerMembership` — `id`, `user` (FK, `related_name="broker_memberships"`), `broker` (FK, `related_name="memberships"`), `role`, `can_edit_listings`, `can_manage_team`, `can_read_messages`, `is_active`, `created_at`, `updated_at`. Unique on `(user, broker)`.
  - `brokers.enums.ROLE_DEFAULT_CAPABILITIES` — the canonical `{role: {flag: bool}}` mapping applied whenever a membership's role changes (see the ruling note in Step 3).
  - `brokers.services.set_broker_auto_approval(broker, *, enabled, actor) -> BrokerOrganization` — the **only** code path permitted to write `auto_approve_listings`, because it is what stamps `auto_approve_changed_by`/`_at`.
  - `accounts.services.is_staff_moderator(user) -> bool`, `accounts.services.is_staff_admin(user) -> bool` (plus the private `_usable`/`_in_staff_group` helpers) — landed here because `BrokerOrganizationAdmin` is their first consumer; Task 7 extends the same module and must not redefine them.
  - `brokers.tests.factories.make_broker(...)`, `brokers.tests.factories.make_membership(...)`.

**Note (spec §1 "Broker auto-approval switch → persisted `BrokerProfile.auto_approve_listings`"):** §2.1's traceability bullet names the model `BrokerProfile`, while §11.1's data-model section — the normative one for field/model names — names it `BrokerOrganization` and puts `auto_approve_listings` on it. This plan follows §11.1: the model is `BrokerOrganization`. There is no separate `BrokerProfile`.

**Note (no `AuditEvent` write here):** spec §1 requires the auto-approval switch to be "changed by staff and audited". Phase 3 satisfies the *actor* half of that with the spec's own `auto_approve_changed_by` / `auto_approve_changed_at` columns and enforces staff-admin-only mutation. It deliberately writes no `AuditEvent` row, because the `audit` app belongs to Phase 2 and its model signature is not yet fixed. The staff-facing endpoint `PATCH /api/v1/staff/brokers/<id>/approval-policy/` (spec §30.1) is Phase 12's deliverable, and Phase 12 must emit the `AuditEvent` there and in `set_broker_auto_approval`. This is a scope boundary, not a TODO placeholder: nothing in Phase 3 exposes an unaudited mutation path to a non-admin.

- [ ] **Step 1: Write the failing tests**

`backend/brokers/tests/__init__.py` — empty file.

`backend/brokers/tests/factories.py`:

```python
from brokers.enums import BrokerMembershipRole, BrokerOrganizationStatus
from brokers.models import BrokerMembership, BrokerOrganization


def make_broker(
    name="Blue Marine Brokers",
    slug="blue-marine-brokers",
    *,
    status=BrokerOrganizationStatus.ACTIVE,
    **extra,
):
    return BrokerOrganization.objects.create(
        name=name,
        slug=slug,
        status=status,
        public_email=extra.pop("public_email", "office@blue-marine.example"),
        public_phone=extra.pop("public_phone", "+34600000000"),
        **extra,
    )


def make_membership(
    user,
    broker,
    *,
    role=BrokerMembershipRole.AGENT,
    can_edit_listings=False,
    can_manage_team=False,
    can_read_messages=False,
    is_active=True,
):
    return BrokerMembership.objects.create(
        user=user,
        broker=broker,
        role=role,
        can_edit_listings=can_edit_listings,
        can_manage_team=can_manage_team,
        can_read_messages=can_read_messages,
        is_active=is_active,
    )
```

`backend/brokers/tests/test_models.py`:

```python
import uuid

import pytest
from django.db import IntegrityError, transaction

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from brokers.enums import (
    ROLE_DEFAULT_CAPABILITIES,
    BrokerMembershipRole,
    BrokerOrganizationStatus,
)
from brokers.models import BrokerOrganization
from brokers.tests.factories import make_broker, make_membership


@pytest.mark.django_db
def test_broker_defaults_to_draft_with_auto_approval_off():
    broker = BrokerOrganization.objects.create(
        name="Fresh Broker",
        slug="fresh-broker",
        public_email="a@b.example",
        public_phone="+34600000001",
    )
    assert isinstance(broker.pk, uuid.UUID)
    assert broker.status == BrokerOrganizationStatus.DRAFT
    assert broker.auto_approve_listings is False
    assert broker.auto_approve_changed_by is None
    assert broker.auto_approve_changed_at is None


@pytest.mark.django_db
def test_broker_slug_is_unique():
    make_broker()
    with pytest.raises(IntegrityError), transaction.atomic():
        make_broker(name="Another", slug="blue-marine-brokers")


@pytest.mark.django_db
def test_a_user_can_hold_only_one_membership_per_broker():
    user = make_user("member@example.com", role=UserRole.BROKER)
    broker = make_broker()
    make_membership(user, broker)
    with pytest.raises(IntegrityError), transaction.atomic():
        make_membership(user, broker, role=BrokerMembershipRole.MANAGER)


@pytest.mark.django_db
def test_the_admin_role_always_carries_every_membership_permission():
    user = make_user("brokeradmin@example.com", role=UserRole.BROKER)
    membership = make_membership(
        user, make_broker(), role=BrokerMembershipRole.ADMIN,
        can_edit_listings=False, can_manage_team=False, can_read_messages=False,
    )
    membership.refresh_from_db()
    assert membership.can_edit_listings is True
    assert membership.can_manage_team is True
    assert membership.can_read_messages is True


@pytest.mark.django_db
def test_demoting_an_admin_revokes_the_capability_flags_the_role_granted():
    """The symmetric half of the ADMIN rule: promotion grants, demotion revokes.

    Without this, a demoted admin keeps can_manage_team=True and can simply
    promote themselves back to ADMIN.
    """
    user = make_user("demoted@example.com", role=UserRole.BROKER)
    membership = make_membership(user, make_broker(), role=BrokerMembershipRole.ADMIN)
    membership.refresh_from_db()
    assert membership.can_manage_team is True

    membership.role = BrokerMembershipRole.VIEWER
    membership.save()

    membership.refresh_from_db()
    assert membership.role == BrokerMembershipRole.VIEWER
    assert membership.can_manage_team is False
    assert membership.can_edit_listings is False
    assert membership.can_read_messages is False


@pytest.mark.django_db
def test_demoting_an_admin_to_manager_applies_the_manager_defaults():
    user = make_user("demoted2@example.com", role=UserRole.BROKER)
    membership = make_membership(user, make_broker(), role=BrokerMembershipRole.ADMIN)

    membership.role = BrokerMembershipRole.MANAGER
    membership.save()

    membership.refresh_from_db()
    assert membership.can_manage_team is False  # the escalation-relevant flag
    assert membership.can_edit_listings is True
    assert membership.can_read_messages is True


@pytest.mark.django_db
def test_demoting_a_manager_revokes_a_separately_granted_can_manage_team():
    """The reset fires on ANY role change, not only on the way out of ADMIN.

    A MANAGER may legitimately have been granted can_manage_team=True by an
    ADMIN. Demoting them must not leave that grant standing at the lower rank.
    """
    user = make_user("demoted3@example.com", role=UserRole.BROKER)
    membership = make_membership(
        user,
        make_broker(),
        role=BrokerMembershipRole.MANAGER,
        can_edit_listings=True,
        can_manage_team=True,
        can_read_messages=True,
    )
    membership.refresh_from_db()
    assert membership.can_manage_team is True

    membership.role = BrokerMembershipRole.VIEWER
    membership.save()

    membership.refresh_from_db()
    expected = ROLE_DEFAULT_CAPABILITIES[BrokerMembershipRole.VIEWER]
    assert membership.role == BrokerMembershipRole.VIEWER
    assert expected == {
        "can_edit_listings": False,
        "can_manage_team": False,
        "can_read_messages": False,
    }
    for field, value in expected.items():
        assert getattr(membership, field) is value


@pytest.mark.django_db
def test_flags_stay_individually_tunable_within_a_role():
    """The reset is scoped to a role CHANGE, not applied on every save."""
    user = make_user("tunable@example.com", role=UserRole.BROKER)
    membership = make_membership(
        user, make_broker(), role=BrokerMembershipRole.AGENT, can_read_messages=False
    )

    membership.can_read_messages = True
    membership.save()

    membership.refresh_from_db()
    assert membership.role == BrokerMembershipRole.AGENT
    assert membership.can_read_messages is True


@pytest.mark.django_db
def test_an_admin_membership_cannot_be_stripped_of_permissions_behind_the_orm():
    user = make_user("strip@example.com", role=UserRole.BROKER)
    membership = make_membership(user, make_broker(), role=BrokerMembershipRole.ADMIN)
    with pytest.raises(IntegrityError), transaction.atomic():
        type(membership).objects.filter(pk=membership.pk).update(can_edit_listings=False)


@pytest.mark.django_db
def test_auto_approve_actor_requires_a_timestamp():
    staff = make_user("staff@example.com", role=UserRole.STAFF)
    broker = make_broker()
    with pytest.raises(IntegrityError), transaction.atomic():
        BrokerOrganization.objects.filter(pk=broker.pk).update(auto_approve_changed_by=staff)


@pytest.mark.django_db
def test_memberships_are_reachable_from_both_sides():
    user = make_user("both@example.com", role=UserRole.BROKER)
    broker = make_broker()
    make_membership(user, broker)
    assert user.broker_memberships.count() == 1
    assert broker.memberships.count() == 1
```

`backend/brokers/tests/test_services.py`:

```python
import pytest
from django.utils import timezone

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from brokers.services import set_broker_auto_approval
from brokers.tests.factories import make_broker


@pytest.mark.django_db
def test_enabling_auto_approval_stamps_the_actor_and_time():
    actor = make_user("admin@example.com", role=UserRole.STAFF)
    broker = make_broker()
    before = timezone.now()

    updated = set_broker_auto_approval(broker, enabled=True, actor=actor)

    assert updated.auto_approve_listings is True
    assert updated.auto_approve_changed_by == actor
    assert updated.auto_approve_changed_at >= before


@pytest.mark.django_db
def test_setting_the_same_value_does_not_restamp():
    actor = make_user("admin2@example.com", role=UserRole.STAFF)
    broker = make_broker()
    set_broker_auto_approval(broker, enabled=True, actor=actor)
    first_stamp = broker.auto_approve_changed_at

    set_broker_auto_approval(broker, enabled=True, actor=actor)

    broker.refresh_from_db()
    assert broker.auto_approve_changed_at == first_stamp


@pytest.mark.django_db
def test_disabling_auto_approval_restamps():
    actor = make_user("admin3@example.com", role=UserRole.STAFF)
    broker = make_broker()
    set_broker_auto_approval(broker, enabled=True, actor=actor)
    enabled_at = broker.auto_approve_changed_at

    set_broker_auto_approval(broker, enabled=False, actor=actor)

    broker.refresh_from_db()
    assert broker.auto_approve_listings is False
    assert broker.auto_approve_changed_at > enabled_at
```

`backend/brokers/tests/test_admin.py`:

```python
from types import SimpleNamespace

import pytest
from django.contrib.admin.sites import AdminSite
from django.contrib.auth.models import Group
from django.test import RequestFactory

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from brokers.admin import BrokerOrganizationAdmin
from brokers.models import BrokerOrganization
from brokers.tests.factories import make_broker

POLICY_FIELDS = {
    "auto_approve_listings",
    "auto_approve_changed_by",
    "auto_approve_changed_at",
}


def _request(user):
    request = RequestFactory().get("/admin/brokers/brokerorganization/")
    request.user = user
    return request


@pytest.fixture
def broker_admin():
    return BrokerOrganizationAdmin(BrokerOrganization, AdminSite())


@pytest.mark.django_db
def test_a_moderator_cannot_edit_the_auto_approval_policy(broker_admin):
    moderator = make_user("mod@example.com", role=UserRole.STAFF, is_staff=True)
    moderator.groups.add(Group.objects.get_or_create(name=StaffGroup.MODERATOR)[0])

    readonly = set(broker_admin.get_readonly_fields(_request(moderator)))

    assert POLICY_FIELDS <= readonly


@pytest.mark.django_db
def test_a_staff_admin_can_edit_the_auto_approval_flag(broker_admin):
    admin_user = make_user("sa@example.com", role=UserRole.STAFF, is_staff=True)
    admin_user.groups.add(Group.objects.get_or_create(name=StaffGroup.ADMIN)[0])

    readonly = set(broker_admin.get_readonly_fields(_request(admin_user)))

    assert "auto_approve_listings" not in readonly
    assert {"auto_approve_changed_by", "auto_approve_changed_at"} <= readonly


@pytest.mark.django_db
def test_toggling_the_flag_through_the_admin_records_the_actor_and_timestamp(broker_admin):
    """Spec 1: the auto-approval switch is "changed by staff and audited".

    Regression guard: if save_model() persists the field itself before calling
    set_broker_auto_approval(), the service sees the value already matching,
    short-circuits, and these two columns stay NULL while the toggle appears
    to have worked.
    """
    admin_user = make_user("sa2@example.com", role=UserRole.STAFF, is_staff=True)
    admin_user.groups.add(Group.objects.get_or_create(name=StaffGroup.ADMIN)[0])
    broker = make_broker(name="Policy Broker", slug="policy-broker")
    assert broker.auto_approve_listings is False

    broker.auto_approve_listings = True
    broker_admin.save_model(
        _request(admin_user),
        broker,
        SimpleNamespace(changed_data=["auto_approve_listings"]),
        change=True,
    )

    broker.refresh_from_db()
    assert broker.auto_approve_listings is True
    assert broker.auto_approve_changed_by == admin_user
    assert broker.auto_approve_changed_at is not None


@pytest.mark.django_db
def test_creating_a_broker_with_auto_approval_on_records_the_actor_and_timestamp(
    broker_admin,
):
    """The same audit guarantee, on the CREATE path rather than the change path."""
    admin_user = make_user("sa3@example.com", role=UserRole.STAFF, is_staff=True)
    admin_user.groups.add(Group.objects.get_or_create(name=StaffGroup.ADMIN)[0])
    broker = BrokerOrganization(
        name="Born Approved",
        slug="born-approved",
        public_email="a@b.example",
        public_phone="+34600000002",
        auto_approve_listings=True,
    )

    broker_admin.save_model(
        _request(admin_user),
        broker,
        SimpleNamespace(changed_data=["auto_approve_listings"]),
        change=False,
    )

    broker.refresh_from_db()
    assert broker.auto_approve_listings is True
    assert broker.auto_approve_changed_by == admin_user
    assert broker.auto_approve_changed_at is not None


@pytest.mark.django_db
def test_a_moderators_forged_toggle_is_a_no_op(broker_admin):
    moderator = make_user("mod2@example.com", role=UserRole.STAFF, is_staff=True)
    moderator.groups.add(Group.objects.get_or_create(name=StaffGroup.MODERATOR)[0])
    broker = make_broker(name="Guarded Broker", slug="guarded-broker")

    broker.auto_approve_listings = True
    broker_admin.save_model(
        _request(moderator),
        broker,
        SimpleNamespace(changed_data=["auto_approve_listings"]),
        change=True,
    )

    broker.refresh_from_db()
    assert broker.auto_approve_listings is False
    assert broker.auto_approve_changed_by is None
    assert broker.auto_approve_changed_at is None
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd backend
uv run pytest brokers -v
```

Expected: `ModuleNotFoundError: No module named 'brokers'`.

- [ ] **Step 3: Create the app, enums and models**

```bash
cd backend
uv run python manage.py startapp brokers
rm brokers/tests.py
mkdir -p brokers/tests
```

Add `"brokers",` to `INSTALLED_APPS` in `backend/config/settings/base.py`, after `"accounts",`.

`backend/brokers/enums.py`:

```python
from django.db import models


class BrokerOrganizationStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    PENDING = "PENDING", "Pending"
    ACTIVE = "ACTIVE", "Active"
    SUSPENDED = "SUSPENDED", "Suspended"


class BrokerMembershipRole(models.TextChoices):
    ADMIN = "ADMIN", "Broker admin"
    MANAGER = "MANAGER", "Manager"
    AGENT = "AGENT", "Agent"
    VIEWER = "VIEWER", "Viewer"


#: The capability set each role is reset to when a membership's role CHANGES.
#: It is not applied on every save - within a role, the three flags stay
#: individually tunable per member (spec 5's "Broker member - with permission").
#: See the "Note (role capability defaults)" in models.py below for the ruling.
ROLE_DEFAULT_CAPABILITIES = {
    BrokerMembershipRole.ADMIN: {
        "can_edit_listings": True,
        "can_manage_team": True,
        "can_read_messages": True,
    },
    BrokerMembershipRole.MANAGER: {
        "can_edit_listings": True,
        "can_manage_team": False,
        "can_read_messages": True,
    },
    BrokerMembershipRole.AGENT: {
        "can_edit_listings": True,
        "can_manage_team": False,
        "can_read_messages": False,
    },
    BrokerMembershipRole.VIEWER: {
        "can_edit_listings": False,
        "can_manage_team": False,
        "can_read_messages": False,
    },
}
```

**Note (ruling — role capability defaults):** spec §5 distinguishes "Broker admin" (unconditional ✓) from "Broker member — with permission", but does not enumerate defaults for the intermediate roles, so this plan fixes them here, once, as the canonical mapping. The reasoning follows the role names' evident intent: a **MANAGER** runs day-to-day listing and client work (`can_edit_listings`, `can_read_messages`) but does not control team composition — `can_manage_team` is a grant an ADMIN makes deliberately, not something a title confers; an **AGENT** works listings but is not automatically on the client-correspondence side; a **VIEWER** is read-only by definition. `can_manage_team` therefore defaults to `False` for every non-ADMIN role, and an ADMIN must grant it explicitly. Later phases must import this mapping rather than restating it.

`backend/brokers/models.py`:

```python
from django.conf import settings
from django.db import models

from brokers.enums import (
    ROLE_DEFAULT_CAPABILITIES,
    BrokerMembershipRole,
    BrokerOrganizationStatus,
)
from common.models import UUIDTimeStampedModel


class BrokerOrganization(UUIDTimeStampedModel):
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True)
    status = models.CharField(
        max_length=10,
        choices=BrokerOrganizationStatus.choices,
        default=BrokerOrganizationStatus.DRAFT,
    )
    public_email = models.EmailField(max_length=254)
    public_phone = models.CharField(max_length=32)
    website_url = models.URLField(max_length=300, blank=True, null=True)
    auto_approve_listings = models.BooleanField(default=False)
    auto_approve_changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="broker_auto_approve_changes",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    auto_approve_changed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("name",)
        constraints = [
            models.CheckConstraint(
                condition=models.Q(auto_approve_changed_by__isnull=True)
                | models.Q(auto_approve_changed_at__isnull=False),
                name="brokers_auto_approve_actor_requires_timestamp",
            ),
        ]

    def __str__(self):
        return self.name

    @property
    def is_active(self) -> bool:
        return self.status == BrokerOrganizationStatus.ACTIVE


class BrokerMembership(UUIDTimeStampedModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="broker_memberships",
        on_delete=models.CASCADE,
    )
    broker = models.ForeignKey(
        BrokerOrganization, related_name="memberships", on_delete=models.CASCADE
    )
    role = models.CharField(
        max_length=10,
        choices=BrokerMembershipRole.choices,
        default=BrokerMembershipRole.VIEWER,
    )
    can_edit_listings = models.BooleanField(default=False)
    can_manage_team = models.BooleanField(default=False)
    can_read_messages = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("broker__name", "user__email")
        constraints = [
            models.UniqueConstraint(
                fields=["user", "broker"], name="brokers_membership_unique_user_broker"
            ),
            models.CheckConstraint(
                condition=~models.Q(role=BrokerMembershipRole.ADMIN)
                | models.Q(
                    can_edit_listings=True, can_manage_team=True, can_read_messages=True
                ),
                name="brokers_admin_membership_has_all_permissions",
            ),
        ]

    def __str__(self):
        return f"{self.user_id} @ {self.broker_id} ({self.role})"

    @classmethod
    def from_db(cls, db, field_names, values):
        instance = super().from_db(db, field_names, values)
        # Remember the role as loaded, so save() can detect a role CHANGE.
        instance._loaded_role = instance.role
        return instance

    def refresh_from_db(self, *args, **kwargs):
        super().refresh_from_db(*args, **kwargs)
        self._loaded_role = self.role

    def save(self, *args, **kwargs):
        previous_role = getattr(self, "_loaded_role", None)
        forced = None
        if self.role == BrokerMembershipRole.ADMIN:
            # ADMIN always carries every capability (spec 5).
            forced = ROLE_DEFAULT_CAPABILITIES[BrokerMembershipRole.ADMIN]
        elif previous_role is not None and previous_role != self.role:
            # ANY role CHANGE resets the three flags to the new role's defaults.
            # The flags a member holds were granted for the rank they held, so a
            # member moved to a different rank starts again from that rank's
            # defaults. Scoping this to ADMIN->other only would leave a MANAGER
            # who was granted can_manage_team=True still holding it after being
            # demoted to AGENT or VIEWER - i.e. the same privilege-retention bug
            # one rung lower down.
            forced = ROLE_DEFAULT_CAPABILITIES[self.role]

        if forced is not None:
            for field, value in forced.items():
                setattr(self, field, value)
            if kwargs.get("update_fields") is not None:
                kwargs["update_fields"] = set(kwargs["update_fields"]) | set(forced)

        result = super().save(*args, **kwargs)
        self._loaded_role = self.role
        return result
```

**Note (`condition=` vs `check=`):** Django 5.1 renamed `CheckConstraint`'s `check` argument to `condition`; `check` is deprecated and removed in Django 6.0. This project is on Django 5.2, so `condition=` is correct.

**Note (`role=ADMIN` implies every flag):** spec §5's capability table gives "Broker admin" an unconditional ✓ where "Broker member" reads "with permission". Rather than leave that as a rule each caller must remember, it is enforced twice: `save()` forces the three booleans true, and a `CheckConstraint` makes a contradictory row impossible even via `QuerySet.update()` or raw SQL. `test_an_admin_membership_cannot_be_stripped_of_permissions_behind_the_orm` exercises the `update()` bypass.

**Note (any role change revokes — the symmetric half of that rule):** forcing the flags on at promotion while doing nothing at demotion leaves a **privilege-retention bug**: a member demoted from ADMIN to VIEWER keeps `can_manage_team=True` (and the rest) indefinitely, and `can_manage_broker_team()` reads that flag — so a "demoted" admin still passes `IsBrokerTeamManager` and can promote themselves back. The `elif previous_role is not None and previous_role != self.role` branch closes that, and closes it for **every** rank, not just ADMIN: on any role change the flags are reset to the new role's entry in `ROLE_DEFAULT_CAPABILITIES`. Scoping the reset to the ADMIN→other transition alone would leave the identical bug one rung lower — a MANAGER legitimately granted `can_manage_team=True` by an ADMIN would keep that flag after being demoted to AGENT or VIEWER, contradicting the ruling above that "`can_manage_team` defaults to `False` for every non-ADMIN role". The reset is still deliberately scoped to a role **change**, not applied on every save, so that *within* a role an ADMIN may still tune an individual member's three flags (spec §5's "with permission"). `_loaded_role` is captured in `from_db()`/`refresh_from_db()` and re-stamped at the end of `save()`, so any instance read from — or previously written to — the database, including the one Task 9's update serializer mutates, carries the information the check needs. A brand-new membership has no `_loaded_role`, so creation honours whatever flags the caller supplies.

**Note (ruling — membership is independent of `primary_role`; Phase 11 must build on this):** nothing prevents a user whose `primary_role` is `BUYER` (or `SERVICE_PROVIDER`, or `PRIVATE_SELLER`) from holding a `BrokerMembership` with `can_edit_listings=True`, and downstream that is sufficient to create broker listings. This reads as a contradiction of spec §5's capability table, which shows "—" for an authenticated buyer creating a broker listing, so the intended design is stated here explicitly: **option (a) — membership alone is authoritative for broker-scoped authority, regardless of `primary_role`.**

Two reasons this is the deliberate choice rather than an oversight:

1. It is already what every broker-scoped function in this plan does. `active_broker_membership`, `has_any_broker_edit_membership`, `can_edit_owned_object`, `can_manage_broker_team`, `can_read_broker_messages` and `resolve_seller_context`'s broker branch (all Task 7) key off the membership row and its capability flags; **not one of them reads `primary_role`**. Only the *private-seller* branch of `resolve_seller_context` and the two staff-tier helpers consult `primary_role`. Adding a `primary_role == BROKER` gate to membership creation would make the model inconsistent with the authorization layer that reads it.
2. Broker team composition is an organizational fact, not a statement about the person's own marketplace identity. A brokerage's office manager may well hold a `BUYER` primary role for their own boat search while also being an `ADMIN` of the firm. Forcing a role change on them would corrupt an unrelated field.

Spec §5's table describes what a user's **primary role alone** confers — i.e. a buyer with *no* broker membership. It is not a prohibition on that buyer also being a member of a broker organization. Phase 11 (listings) must therefore authorize broker listing creation from `active_broker_membership(...).can_edit_listings`, **never** from `user.primary_role == UserRole.BROKER`, and must not add a `primary_role` check to `BrokerMembershipCreateSerializer` (Task 9).

**Note (a PATCH that changes `role` and flags together):** the role reset runs inside `save()`, i.e. *after* the serializer has assigned every validated field. A request that both demotes a member and sets explicit flags in one call therefore ends with the role defaults winning. That is the safe direction (a demotion never silently preserves elevated flags), and Task 9's update serializer rejects that combination outright rather than leaving it ambiguous — see its `validate()`.

- [ ] **Step 4: Implement the auto-approval service**

`backend/brokers/services.py`:

```python
from django.db import transaction
from django.utils import timezone

from brokers.models import BrokerOrganization


@transaction.atomic
def set_broker_auto_approval(broker: BrokerOrganization, *, enabled: bool, actor) -> BrokerOrganization:
    """Change a broker's auto-approval policy, recording who changed it and when.

    Staff-admin authorization is enforced by the caller (Django admin here,
    PATCH /api/v1/staff/brokers/<id>/approval-policy/ in Phase 12). Phase 12 also
    attaches the AuditEvent required by spec 1 / 2.4.
    """
    locked = BrokerOrganization.objects.select_for_update().get(pk=broker.pk)
    if locked.auto_approve_listings == enabled:
        return locked

    locked.auto_approve_listings = enabled
    locked.auto_approve_changed_by = actor
    locked.auto_approve_changed_at = timezone.now()
    locked.save(
        update_fields=[
            "auto_approve_listings",
            "auto_approve_changed_by",
            "auto_approve_changed_at",
            "updated_at",
        ]
    )
    broker.refresh_from_db()
    return locked
```

- [ ] **Step 5: Implement the admin**

**First, land the two staff-tier helpers this admin depends on.** `BrokerOrganizationAdmin` calls `accounts.services.is_staff_admin`, and the admin tests above exercise that call, so the function has to exist *now* — a function-local import keeps the module importable but does not conjure the symbol. Append these four to `backend/accounts/services.py` (which already exists from Task 3):

```python
from accounts.enums import StaffGroup, UserRole


def _usable(user) -> bool:
    return (
        user is not None
        and getattr(user, "is_authenticated", False)
        and getattr(user, "is_active", False)
    )


def _in_staff_group(user, *names) -> bool:
    return user.is_superuser or user.groups.filter(name__in=names).exists()


def is_staff_moderator(user) -> bool:
    """Staff moderator or above (spec 5). The STAFF primary role is required."""
    if not _usable(user) or user.primary_role != UserRole.STAFF:
        return False
    return _in_staff_group(user, StaffGroup.MODERATOR, StaffGroup.ADMIN)


def is_staff_admin(user) -> bool:
    if not _usable(user) or user.primary_role != UserRole.STAFF:
        return False
    return _in_staff_group(user, StaffGroup.ADMIN)
```

**Note (why these four land in Task 5 and not Task 7):** they are pure `auth.Group` lookups with no dependency on `brokers`, and Task 5's admin is their first real consumer. Task 7 owns the rest of `accounts/services.py` (the broker-scoped authorization functions) and **must not redefine these four** — it extends the same module. The `staff_moderator` / `staff_admin` `Group` rows are still created by Task 7's data migration; Task 5's tests use `Group.objects.get_or_create(...)` precisely so they do not depend on it.

`backend/brokers/admin.py`:

```python
from django.contrib import admin
from django.db import transaction

from brokers.models import BrokerMembership, BrokerOrganization
from brokers.services import set_broker_auto_approval

POLICY_READONLY = ("auto_approve_changed_by", "auto_approve_changed_at")
BASE_READONLY = ("id", "created_at", "updated_at")


class BrokerMembershipInline(admin.TabularInline):
    model = BrokerMembership
    extra = 0
    fields = ("user", "role", "can_edit_listings", "can_manage_team", "can_read_messages", "is_active")
    autocomplete_fields = ("user",)


@admin.register(BrokerOrganization)
class BrokerOrganizationAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "status", "auto_approve_listings", "auto_approve_changed_at")
    list_filter = ("status", "auto_approve_listings")
    search_fields = ("name", "slug", "public_email")
    prepopulated_fields = {"slug": ("name",)}
    inlines = [BrokerMembershipInline]

    def get_readonly_fields(self, request, obj=None):
        from accounts.services import is_staff_admin

        readonly = BASE_READONLY + POLICY_READONLY
        if not is_staff_admin(request.user):
            readonly += ("auto_approve_listings",)
        return readonly

    def _sync_policy_fields(self, obj, updated):
        # Keep the instance the admin will re-render in sync with the row.
        obj.auto_approve_listings = updated.auto_approve_listings
        obj.auto_approve_changed_by = updated.auto_approve_changed_by
        obj.auto_approve_changed_at = updated.auto_approve_changed_at

    def save_model(self, request, obj, form, change):
        from accounts.services import is_staff_admin

        if change and "auto_approve_listings" in form.changed_data:
            requested = obj.auto_approve_listings
            # The same row lock the service takes, held for the whole
            # read-revert-save-service sequence, so two concurrent staff edits
            # cannot interleave and clobber each other's audit stamp.
            with transaction.atomic():
                stored = (
                    BrokerOrganization.objects.select_for_update()
                    .get(pk=obj.pk)
                    .auto_approve_listings
                )

                # Revert the in-memory instance to the STORED value before the
                # plain save, so super().save_model() never writes this field
                # itself. The service below is the only path that may change it
                # - see the note.
                obj.auto_approve_listings = stored
                super().save_model(request, obj, form, change)

                if is_staff_admin(request.user) and requested != stored:
                    self._sync_policy_fields(
                        obj,
                        set_broker_auto_approval(
                            obj, enabled=requested, actor=request.user
                        ),
                    )
            return

        if not change and obj.auto_approve_listings:
            # Creating an organization with the policy already ON. The stored
            # value would then already match what the service is asked to set,
            # so the service would short-circuit and the audit columns would
            # stay NULL - the same trap as above, one step earlier. Create the
            # row OFF and let the service perform the single real transition.
            with transaction.atomic():
                obj.auto_approve_listings = False
                super().save_model(request, obj, form, change)

                if is_staff_admin(request.user):
                    self._sync_policy_fields(
                        obj,
                        set_broker_auto_approval(obj, enabled=True, actor=request.user),
                    )
            return

        super().save_model(request, obj, form, change)


@admin.register(BrokerMembership)
class BrokerMembershipAdmin(admin.ModelAdmin):
    list_display = ("user", "broker", "role", "can_edit_listings", "can_manage_team", "is_active")
    list_filter = ("role", "is_active", "broker")
    search_fields = ("user__email", "broker__name")
    autocomplete_fields = ("user", "broker")
    readonly_fields = BASE_READONLY
```

**Note (Django admin is a trusted-staff-only surface — `brokers.change_brokermembership` is effectively ADMIN-minting):** `BrokerMembershipAdmin` and `BrokerMembershipInline` expose `role` and the three capability flags as plain form fields. Unlike Task 9's API, they carry **no rank guard and no self-edit guard** — the model's `save()` still forces an ADMIN row to hold every flag, but nothing stops a staff user with `brokers.change_brokermembership` (or `brokers.add_brokermembership`) from making themselves, or anyone else, an ADMIN of any brokerage. Treat that Django permission as equivalent to "may take over any broker organization". This is not reachable by accident today: `is_staff` is required to reach the admin at all, and migration `0003_staff_groups` (Task 7) creates the `staff_moderator` and `staff_admin` groups with **no model permissions attached**, so the surface is open only to superusers until someone deliberately grants those permissions. It is called out here for whoever configures staff group permissions later — `brokers.*_brokermembership` belongs at most in `staff_admin`, never in `staff_moderator`.

**Note (why `save_model` reverts the field before calling `super()` — this order is load-bearing):** `set_broker_auto_approval()` deliberately short-circuits when the stored value already equals the requested one (`test_setting_the_same_value_does_not_restamp` depends on that). So if `super().save_model()` runs first with the new value, the service re-reads the row under `select_for_update()`, sees the value it was asked to set **already written**, returns early, and `auto_approve_changed_by` / `auto_approve_changed_at` are **never recorded** — silently defeating spec §1's "changed by staff and audited" requirement while appearing to work. Reverting `obj.auto_approve_listings` to the stored value first means the plain save leaves the column untouched, and the service is the single writer of that field, stamping the actor and timestamp as it goes. Non-staff-admin users are additionally blocked: `get_readonly_fields` already keeps the field out of their form, and the `requested != stored` / `is_staff_admin` guard means their edit is a no-op even if the form is forged.

**Note (the `not change` branch — creation with the policy already on):** the identical trap sits one step earlier. An organization *created* with `auto_approve_listings=True` would be written straight to the database with the flag set, after which `set_broker_auto_approval(enabled=True)` sees the value already stored, short-circuits, and `auto_approve_changed_by`/`_at` stay `NULL` — an unaudited auto-approval policy from the moment the org exists. The `not change` branch applies the same discipline: create the row with the flag `False`, then let the service perform the one real `False → True` transition and stamp it. `test_creating_a_broker_with_auto_approval_on_records_the_actor_and_timestamp` pins this. Both branches run inside `transaction.atomic()` and the change branch takes `select_for_update()` on the row it reads, so the read-revert-save-service sequence holds the same lock the service itself uses and two concurrent staff-admin edits cannot interleave and lose one another's audit stamp. (Django already wraps the admin's change-form view in a transaction; the explicit `atomic()` makes the guarantee local to this method rather than inherited.)

**Note (why the `accounts.services.is_staff_admin` imports are function-local):** not because the symbol is missing — the sub-step above lands it in this very task — but because `accounts.services` imports `brokers.models` inside its own functions (Task 7) and `brokers.admin` is loaded during app registration. A module-level import here would close that loop at app-loading time. Keeping both imports inside the methods breaks the cycle. **Task 7's Step 7 re-runs `uv run pytest brokers -v`** to confirm the rest of `accounts/services.py` landing around these functions still satisfies the admin tests.

**Note (spec §11.1: "Only staff admin can change `auto_approve_listings`. Broker users may see the current policy but cannot change it."):** Phase 3 exposes **no** API write path for this field at all — it is settable only from Django admin by a `staff_admin` group member. The read-only broker-facing view of the policy arrives with the broker dashboard in Phase 12/19.

- [ ] **Step 6: Migrate and run the tests**

```bash
uv run python manage.py makemigrations brokers
uv run python manage.py migrate
uv run pytest brokers -v
```

Expected: `brokers/migrations/0001_initial.py` created and applied; every test in `brokers/tests/` `PASS` — in particular the four role-transition tests (`test_demoting_an_admin_revokes_the_capability_flags_the_role_granted`, `test_demoting_an_admin_to_manager_applies_the_manager_defaults`, `test_demoting_a_manager_revokes_a_separately_granted_can_manage_team`, `test_flags_stay_individually_tunable_within_a_role`) and the three admin-audit tests (`test_toggling_the_flag_through_the_admin_records_the_actor_and_timestamp`, `test_creating_a_broker_with_auto_approval_on_records_the_actor_and_timestamp`, `test_a_moderators_forged_toggle_is_a_no_op`).

- [ ] **Step 7: Commit**

```bash
git add backend/brokers backend/accounts/services.py backend/config/settings/base.py
git commit -m "feat(brokers): add broker organization and membership models"
```

---

### Task 6: `professionals` app — `ProfessionalProfile`

**Files:**
- Create: `backend/professionals/__init__.py`, `apps.py`, `enums.py`, `models.py`, `admin.py`
- Create: `backend/professionals/migrations/__init__.py`, `backend/professionals/migrations/0001_initial.py` (generated)
- Modify: `backend/config/settings/base.py` (`INSTALLED_APPS`)
- Test: `backend/professionals/tests/__init__.py`, `factories.py`, `test_models.py`

**Interfaces:**
- Consumes: `common.models.UUIDTimeStampedModel`, `settings.AUTH_USER_MODEL`.
- Produces:
  - `professionals.enums.ProfessionalProfileStatus` — `TextChoices`: `DRAFT`, `PENDING`, `ACTIVE`, `SUSPENDED`.
  - `professionals.models.ProfessionalProfile` — `id`, `owner_user` (`OneToOneField`, `related_name="professional_profile"`), `display_name`, `slug` (unique), `short_description`, `description`, `public_email`, `public_phone`, `website_url` (nullable), `address_line1`, `address_line2`, `city`, `postal_code`, `region`, `country_code`, `service_area` (JSON list of region strings), `status`, `created_at`, `updated_at`. Property `is_active`. Method `get_absolute_url()` returning `/services/professionals/<slug>/`.
  - `professionals.tests.factories.make_professional(...)`.

**Note (why `OneToOneField` for `owner_user`):** spec §11.1 says `owner_user FK` without stating cardinality, but §4.1 gives a professional exactly one canonical profile URL and §30.1's session payload has one professional identity per user. `OneToOneField` is a `ForeignKey` subclass, so it satisfies the spec literally while making a second profile per user structurally impossible. If a future change request introduces multi-profile providers, it becomes a plain FK plus an explicit "primary profile" pointer — a migration, not a redesign.

**Note (`address fields` and `service_area`):** spec §11.1 writes "address fields" and "service_area JSON or normalized relation" without enumerating either. This plan fixes them as six discrete address columns (`address_line1`, `address_line2`, `city`, `postal_code`, `region`, `country_code`) and `service_area` as a `JSONField` holding a list of non-empty strings, validated by a model-level validator. Normalizing `service_area` into a relation is deferred to Phase 5, which owns the directory's filtering requirements.

**Note (blank-allowed descriptive fields):** `short_description`, `description` and the address lines are blank-allowed because a `DRAFT` profile legitimately has none of them yet. The publication gate — what a profile must contain before it may reach `ACTIVE` and appear in the directory — is Phase 5's `/services/professionals/` deliverable. Phase 3 stops at storage plus ownership. Per spec §11.1's closing rule, no decorative claims, invented certifications or irrelevant personal details are modelled.

- [ ] **Step 1: Write the failing tests**

`backend/professionals/tests/__init__.py` — empty file.

`backend/professionals/tests/factories.py`:

```python
from professionals.enums import ProfessionalProfileStatus
from professionals.models import ProfessionalProfile


def make_professional(
    owner_user,
    *,
    display_name="Marine Survey Co",
    slug="marine-survey-co",
    status=ProfessionalProfileStatus.ACTIVE,
    service_area=None,
    **extra,
):
    return ProfessionalProfile.objects.create(
        owner_user=owner_user,
        display_name=display_name,
        slug=slug,
        status=status,
        public_email=extra.pop("public_email", "hello@marine-survey.example"),
        public_phone=extra.pop("public_phone", "+39055000000"),
        country_code=extra.pop("country_code", "IT"),
        service_area=["IT-52"] if service_area is None else service_area,
        **extra,
    )
```

`backend/professionals/tests/test_models.py`:

```python
import uuid

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from professionals.enums import ProfessionalProfileStatus
from professionals.models import ProfessionalProfile
from professionals.tests.factories import make_professional


@pytest.mark.django_db
def test_profile_has_a_uuid_pk_and_defaults_to_draft():
    owner = make_user("pro@example.com", role=UserRole.SERVICE_PROVIDER)
    profile = ProfessionalProfile.objects.create(
        owner_user=owner,
        display_name="Draft Pro",
        slug="draft-pro",
        public_email="d@p.example",
        public_phone="+34600000002",
        country_code="ES",
    )
    assert isinstance(profile.pk, uuid.UUID)
    assert profile.status == ProfessionalProfileStatus.DRAFT
    assert profile.is_active is False
    assert profile.service_area == []


@pytest.mark.django_db
def test_a_user_can_own_only_one_profile():
    owner = make_user("single@example.com", role=UserRole.SERVICE_PROVIDER)
    make_professional(owner)
    with pytest.raises(IntegrityError), transaction.atomic():
        make_professional(owner, display_name="Second", slug="second-profile")


@pytest.mark.django_db
def test_slug_is_unique_across_profiles():
    make_professional(make_user("a@example.com", role=UserRole.SERVICE_PROVIDER))
    with pytest.raises(IntegrityError), transaction.atomic():
        make_professional(
            make_user("b@example.com", role=UserRole.SERVICE_PROVIDER),
            display_name="Clash",
        )


@pytest.mark.django_db
def test_profile_is_reachable_from_its_owner():
    owner = make_user("reverse@example.com", role=UserRole.SERVICE_PROVIDER)
    profile = make_professional(owner)
    owner.refresh_from_db()
    assert owner.professional_profile == profile


@pytest.mark.django_db
def test_absolute_url_matches_the_canonical_public_route():
    owner = make_user("url@example.com", role=UserRole.SERVICE_PROVIDER)
    profile = make_professional(owner, slug="ocean-legal")
    assert profile.get_absolute_url() == "/services/professionals/ocean-legal/"


@pytest.mark.django_db
def test_active_status_exposes_is_active():
    owner = make_user("active@example.com", role=UserRole.SERVICE_PROVIDER)
    assert make_professional(owner).is_active is True


@pytest.mark.django_db
@pytest.mark.parametrize("bad_value", [{"regions": ["IT-52"]}, ["IT-52", ""], "IT-52", [1, 2]])
def test_service_area_must_be_a_list_of_non_empty_strings(bad_value):
    owner = make_user("area@example.com", role=UserRole.SERVICE_PROVIDER)
    profile = ProfessionalProfile(
        owner_user=owner,
        display_name="Area Pro",
        slug="area-pro",
        public_email="a@a.example",
        public_phone="+34600000003",
        country_code="ES",
        service_area=bad_value,
    )
    with pytest.raises(ValidationError):
        profile.full_clean()
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd backend
uv run pytest professionals -v
```

Expected: `ModuleNotFoundError: No module named 'professionals'`.

- [ ] **Step 3: Create the app, enums and model**

```bash
cd backend
uv run python manage.py startapp professionals
rm professionals/tests.py
mkdir -p professionals/tests
```

Add `"professionals",` to `INSTALLED_APPS` in `backend/config/settings/base.py`, after `"brokers",`.

`backend/professionals/enums.py`:

```python
from django.db import models


class ProfessionalProfileStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    PENDING = "PENDING", "Pending"
    ACTIVE = "ACTIVE", "Active"
    SUSPENDED = "SUSPENDED", "Suspended"
```

`backend/professionals/models.py`:

```python
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from common.models import UUIDTimeStampedModel
from professionals.enums import ProfessionalProfileStatus


def validate_service_area(value):
    """service_area is a list of non-empty region identifier strings (spec 11.1)."""
    if not isinstance(value, list):
        raise ValidationError("service_area must be a list of region identifiers.")
    for item in value:
        if not isinstance(item, str) or not item.strip():
            raise ValidationError("Each service_area entry must be a non-empty string.")


class ProfessionalProfile(UUIDTimeStampedModel):
    owner_user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        related_name="professional_profile",
        on_delete=models.CASCADE,
    )
    display_name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True)
    short_description = models.CharField(max_length=300, blank=True)
    description = models.TextField(blank=True)
    public_email = models.EmailField(max_length=254)
    public_phone = models.CharField(max_length=32)
    website_url = models.URLField(max_length=300, blank=True, null=True)
    address_line1 = models.CharField(max_length=200, blank=True)
    address_line2 = models.CharField(max_length=200, blank=True)
    city = models.CharField(max_length=120, blank=True)
    postal_code = models.CharField(max_length=20, blank=True)
    region = models.CharField(max_length=120, blank=True)
    country_code = models.CharField(max_length=2)
    service_area = models.JSONField(default=list, blank=True, validators=[validate_service_area])
    status = models.CharField(
        max_length=10,
        choices=ProfessionalProfileStatus.choices,
        default=ProfessionalProfileStatus.DRAFT,
    )

    class Meta:
        ordering = ("display_name",)

    def __str__(self):
        return self.display_name

    @property
    def is_active(self) -> bool:
        return self.status == ProfessionalProfileStatus.ACTIVE

    def get_absolute_url(self) -> str:
        return f"/services/professionals/{self.slug}/"
```

`backend/professionals/admin.py`:

```python
from django.contrib import admin

from professionals.models import ProfessionalProfile


@admin.register(ProfessionalProfile)
class ProfessionalProfileAdmin(admin.ModelAdmin):
    list_display = ("display_name", "slug", "owner_user", "status", "country_code")
    list_filter = ("status", "country_code")
    search_fields = ("display_name", "slug", "public_email", "owner_user__email")
    prepopulated_fields = {"slug": ("display_name",)}
    autocomplete_fields = ("owner_user",)
    readonly_fields = ("id", "created_at", "updated_at")
```

- [ ] **Step 4: Migrate and run the tests**

```bash
uv run python manage.py makemigrations professionals
uv run python manage.py migrate
uv run pytest professionals -v
```

Expected: `professionals/migrations/0001_initial.py` created and applied; all 10 tests (7 plus the 4-case parametrize, minus overlap) `PASS`.

- [ ] **Step 5: Commit**

```bash
git add backend/professionals backend/config/settings/base.py
git commit -m "feat(professionals): add professional profile model"
```

---

### Task 7: Staff groups, authorization services and DRF permission classes

This is the task every later phase depends on. Spec §12 items 1, 2, 4 and 5 are implemented here: role and membership permission classes, server-only ownership resolution, object-level authorization, and refusal of suspended users and organizations.

**Files:**
- Create: `backend/accounts/permissions.py`
- Modify: `backend/accounts/services.py`
- Create: `backend/accounts/migrations/0003_staff_groups.py` (hand-written data migration)
- Test: `backend/accounts/tests/test_services.py`, `backend/accounts/tests/test_permissions.py`

**Interfaces:**
- Consumes: `accounts.models.User`, `accounts.enums.{UserRole, SellerType, StaffGroup}`, `brokers.models.{BrokerOrganization, BrokerMembership}`, `brokers.enums.BrokerOrganizationStatus`.
- Consumes (inherited from Task 5, already in `accounts/services.py` — **this task must not redefine them**): `accounts.services.is_staff_moderator(user) -> bool` and `accounts.services.is_staff_admin(user) -> bool`, plus their private `_usable` / `_in_staff_group` helpers. Task 5 landed them because `BrokerOrganizationAdmin` was their first consumer; this task extends the same module and calls them (see `resolve_seller_context` and `IsStaffModerator`/`IsStaffAdmin` below).
- Produces — **`accounts.services`** (pure functions; the single source of truth for authorization):
  - `active_broker_membership(user, broker_id) -> BrokerMembership | None`
  - `has_any_broker_edit_membership(user) -> bool`
  - `can_edit_owned_object(user, *, owner_user_id, broker_id) -> bool`
  - `can_manage_broker_team(user, broker_id) -> bool`
  - `can_read_broker_messages(user, broker_id) -> bool`
  - `SellerContext` — frozen dataclass with fields `seller_type: str`, `owner_user: User | None`, `broker: BrokerOrganization | None`
  - `resolve_seller_context(user, *, broker_id=None) -> SellerContext` (raises `rest_framework.exceptions.PermissionDenied`)
- Produces — **`accounts.permissions`** (DRF classes; thin wrappers over the services above):
  - `IsActiveUser`, `IsEmailVerified`, `IsStaffModerator`, `IsStaffAdmin`, `IsOwnerOrBrokerEditor` (object-level), `IsBrokerTeamManager` (view-level, reads `view.kwargs["broker_id"]`), `CanReadBrokerMessages` (view-level, reads `view.kwargs["broker_id"]`, delegates to `can_read_broker_messages`)
- Produces — migration `accounts.0003_staff_groups` creating the `staff_moderator` and `staff_admin` `auth.Group` rows idempotently.

**Note (the object-level contract for later phases):** `can_edit_owned_object` takes plain identifiers rather than a model instance so it can be unit-tested exhaustively against real `User`/`BrokerOrganization`/`BrokerMembership` rows before any listing model exists. `IsOwnerOrBrokerEditor.has_object_permission` is the thin DRF adapter and reads exactly two attributes off the object: `obj.owner_user_id` and `obj.broker_id` (each may be absent or `None`). **Any model a later phase wants to protect with this class must expose those two attributes** — which `BoatListing` (Phase 11), `ListingRevision` (Phase 11) and `Conversation` (Phase 6) all naturally do. To be precise about `Conversation`: this class governs **edit**-capability checks only (it gates on `can_edit_listings`); *read* access to a broker's conversations goes through `CanReadBrokerMessages` instead, per the correction note directly below.

**Note (correction — which permission class messaging uses):** `IsOwnerOrBrokerEditor` gates on the `can_edit_listings` capability, so it is the right class for *editing a broker's listings* and the **wrong** class for *reading a broker's conversations*. Phase 6 (messaging) must use `CanReadBrokerMessages`, which delegates to `can_read_broker_messages()` and therefore gates on the `can_read_messages` flag. The two flags are independent by design: an AGENT typically has `can_edit_listings=True, can_read_messages=False`, and must not gain message access as a side effect of being able to edit listings. `test_message_reading_permission_keys_off_can_read_messages_not_can_edit_listings` pins exactly this distinction.

**Note (staff tiers):** spec §11.1 gives `User.primary_role` a single `STAFF` value, but §5's capability table distinguishes "Staff moderator" from "Staff admin". §5's opening sentence resolves this: "Roles are additive Django permissions/groups, but each marketplace account has one primary marketplace role." The tier therefore lives in an `auth.Group` — `staff_moderator` or `staff_admin` — not in a new model field. `is_staff_admin` implies `is_staff_moderator`, matching the table where the admin column is a superset of the moderator column. A Django superuser counts as a staff admin.

**Note (suspension):** spec §11.1 gives `User` only `is_active` (no `SUSPENDED` status), so a suspended user is `is_active=False`. SimpleJWT's default `USER_AUTHENTICATION_RULE` already rejects an inactive user's existing access token with `401 user_inactive`, which is the spec §12 acceptance test "an inactive user cannot submit an inquiry from an old session". Organizations do have `SUSPENDED`: `active_broker_membership` returns `None` unless `broker.status == ACTIVE` **and** `membership.is_active`, so every capability routed through it disappears the moment a broker is suspended — satisfying spec §12 item 5 without a separate check in each caller.

- [ ] **Step 1: Write the failing service tests**

`backend/accounts/tests/test_services.py`:

```python
import pytest
from django.contrib.auth.models import Group
from rest_framework.exceptions import PermissionDenied

from accounts.enums import SellerType, StaffGroup, UserRole
from accounts.services import (
    active_broker_membership,
    can_edit_owned_object,
    can_read_broker_messages,
    has_any_broker_edit_membership,
    is_staff_admin,
    is_staff_moderator,
    resolve_seller_context,
)
from accounts.tests.factories import make_user
from brokers.enums import BrokerMembershipRole, BrokerOrganizationStatus
from brokers.tests.factories import make_broker, make_membership


def _in_group(user, name):
    user.groups.add(Group.objects.get(name=name))
    return user


@pytest.mark.django_db
def test_staff_tiers_come_from_groups_not_from_primary_role():
    plain_staff = make_user("plain@example.com", role=UserRole.STAFF)
    assert is_staff_moderator(plain_staff) is False
    assert is_staff_admin(plain_staff) is False

    moderator = _in_group(make_user("mod@example.com", role=UserRole.STAFF), StaffGroup.MODERATOR)
    assert is_staff_moderator(moderator) is True
    assert is_staff_admin(moderator) is False

    admin = _in_group(make_user("adm@example.com", role=UserRole.STAFF), StaffGroup.ADMIN)
    assert is_staff_admin(admin) is True
    assert is_staff_moderator(admin) is True


@pytest.mark.django_db
def test_a_buyer_in_a_staff_group_is_not_staff():
    """The group is additive on top of the STAFF primary role, never a substitute for it."""
    impostor = _in_group(make_user("impostor@example.com", role=UserRole.BUYER), StaffGroup.ADMIN)
    assert is_staff_admin(impostor) is False
    assert is_staff_moderator(impostor) is False


@pytest.mark.django_db
def test_a_superuser_is_a_staff_admin():
    root = make_user("root@example.com", role=UserRole.STAFF, is_superuser=True, is_staff=True)
    assert is_staff_admin(root) is True


@pytest.mark.django_db
def test_an_inactive_staff_admin_has_no_authority():
    admin = _in_group(
        make_user("gone@example.com", role=UserRole.STAFF, is_active=False), StaffGroup.ADMIN
    )
    assert is_staff_admin(admin) is False


@pytest.mark.django_db
def test_active_membership_requires_an_active_broker_and_an_active_membership():
    user = make_user("agent@example.com", role=UserRole.BROKER)
    active = make_broker()
    make_membership(user, active, can_edit_listings=True)
    assert active_broker_membership(user, active.pk) is not None

    suspended = make_broker(name="Suspended", slug="suspended", status=BrokerOrganizationStatus.SUSPENDED)
    make_membership(user, suspended, can_edit_listings=True)
    assert active_broker_membership(user, suspended.pk) is None

    revoked_broker = make_broker(name="Revoked", slug="revoked")
    make_membership(user, revoked_broker, can_edit_listings=True, is_active=False)
    assert active_broker_membership(user, revoked_broker.pk) is None


@pytest.mark.django_db
def test_an_owner_can_edit_their_own_object():
    owner = make_user("owner@example.com", role=UserRole.PRIVATE_SELLER)
    assert can_edit_owned_object(owner, owner_user_id=owner.pk, broker_id=None) is True


@pytest.mark.django_db
def test_a_different_user_cannot_edit_someone_elses_object():
    owner = make_user("mine@example.com", role=UserRole.PRIVATE_SELLER)
    stranger = make_user("yours@example.com", role=UserRole.PRIVATE_SELLER)
    assert can_edit_owned_object(stranger, owner_user_id=owner.pk, broker_id=None) is False


@pytest.mark.django_db
def test_a_broker_agent_cannot_edit_another_brokers_object():
    """Spec 12 acceptance test: 'A broker agent cannot edit another broker's listing.'"""
    agent = make_user("agent-a@example.com", role=UserRole.BROKER)
    broker_a = make_broker(name="Broker A", slug="broker-a")
    broker_b = make_broker(name="Broker B", slug="broker-b")
    make_membership(agent, broker_a, role=BrokerMembershipRole.AGENT, can_edit_listings=True)

    assert can_edit_owned_object(agent, owner_user_id=None, broker_id=broker_a.pk) is True
    assert can_edit_owned_object(agent, owner_user_id=None, broker_id=broker_b.pk) is False


@pytest.mark.django_db
def test_a_viewer_membership_cannot_edit():
    viewer = make_user("viewer@example.com", role=UserRole.BROKER)
    broker = make_broker()
    make_membership(viewer, broker, role=BrokerMembershipRole.VIEWER, can_edit_listings=False)
    assert can_edit_owned_object(viewer, owner_user_id=None, broker_id=broker.pk) is False


@pytest.mark.django_db
def test_a_broker_admin_membership_can_always_edit():
    admin = make_user("badmin@example.com", role=UserRole.BROKER)
    broker = make_broker()
    make_membership(admin, broker, role=BrokerMembershipRole.ADMIN)
    assert can_edit_owned_object(admin, owner_user_id=None, broker_id=broker.pk) is True
    assert has_any_broker_edit_membership(admin) is True


@pytest.mark.django_db
def test_a_staff_admin_can_edit_on_behalf_but_a_moderator_cannot():
    owner = make_user("target@example.com", role=UserRole.PRIVATE_SELLER)
    admin = _in_group(make_user("sa@example.com", role=UserRole.STAFF), StaffGroup.ADMIN)
    moderator = _in_group(make_user("sm@example.com", role=UserRole.STAFF), StaffGroup.MODERATOR)

    assert can_edit_owned_object(admin, owner_user_id=owner.pk, broker_id=None) is True
    assert can_edit_owned_object(moderator, owner_user_id=owner.pk, broker_id=None) is False


@pytest.mark.django_db
def test_an_inactive_user_can_edit_nothing():
    owner = make_user("frozen@example.com", role=UserRole.PRIVATE_SELLER, is_active=False)
    assert can_edit_owned_object(owner, owner_user_id=owner.pk, broker_id=None) is False


@pytest.mark.django_db
def test_an_anonymous_user_can_edit_nothing():
    from django.contrib.auth.models import AnonymousUser

    assert can_edit_owned_object(AnonymousUser(), owner_user_id=None, broker_id=None) is False
    assert can_edit_owned_object(None, owner_user_id=None, broker_id=None) is False


@pytest.mark.django_db
def test_message_reading_needs_the_can_read_messages_flag():
    reader = make_user("reader@example.com", role=UserRole.BROKER)
    silent = make_user("silent@example.com", role=UserRole.BROKER)
    broker = make_broker()
    make_membership(reader, broker, can_read_messages=True)
    make_membership(silent, broker, can_read_messages=False)

    assert can_read_broker_messages(reader, broker.pk) is True
    assert can_read_broker_messages(silent, broker.pk) is False


@pytest.mark.django_db
def test_a_private_seller_resolves_to_a_private_seller_context():
    seller = make_user("ps@example.com", role=UserRole.PRIVATE_SELLER)
    context = resolve_seller_context(seller)
    assert context.seller_type == SellerType.PRIVATE
    assert context.owner_user == seller
    assert context.broker is None


@pytest.mark.django_db
def test_a_private_seller_cannot_forge_a_broker_context():
    """Spec 12 acceptance test: a private seller cannot send seller_type=BROKER."""
    seller = make_user("forge@example.com", role=UserRole.PRIVATE_SELLER)
    broker = make_broker()
    with pytest.raises(PermissionDenied) as exc_info:
        resolve_seller_context(seller, broker_id=broker.pk)
    assert exc_info.value.detail.code == "broker_listing_not_allowed"


@pytest.mark.django_db
def test_a_buyer_cannot_resolve_a_private_seller_context():
    buyer = make_user("buyer@example.com", role=UserRole.BUYER)
    with pytest.raises(PermissionDenied) as exc_info:
        resolve_seller_context(buyer)
    assert exc_info.value.detail.code == "private_listing_not_allowed"


@pytest.mark.django_db
def test_an_unverified_user_cannot_resolve_any_seller_context():
    seller = make_user("unv@example.com", role=UserRole.PRIVATE_SELLER, verified=False)
    with pytest.raises(PermissionDenied) as exc_info:
        resolve_seller_context(seller)
    assert exc_info.value.detail.code == "email_not_verified"


@pytest.mark.django_db
def test_a_broker_editor_resolves_to_a_broker_context():
    agent = make_user("ba@example.com", role=UserRole.BROKER)
    broker = make_broker()
    make_membership(agent, broker, can_edit_listings=True)

    context = resolve_seller_context(agent, broker_id=broker.pk)

    assert context.seller_type == SellerType.BROKER
    assert context.broker == broker
    assert context.owner_user is None


@pytest.mark.django_db
def test_a_suspended_broker_cannot_be_used_as_a_seller_context():
    """Spec 12 item 5: suspended organizations cannot create or submit."""
    agent = make_user("susp@example.com", role=UserRole.BROKER)
    broker = make_broker(status=BrokerOrganizationStatus.SUSPENDED)
    make_membership(agent, broker, can_edit_listings=True)
    with pytest.raises(PermissionDenied):
        resolve_seller_context(agent, broker_id=broker.pk)
```

- [ ] **Step 2: Write the failing permission-class tests**

`backend/accounts/tests/test_permissions.py`:

```python
from types import SimpleNamespace

import pytest
from django.contrib.auth.models import AnonymousUser, Group
from rest_framework.test import APIRequestFactory

from accounts.enums import StaffGroup, UserRole
from accounts.permissions import (
    CanReadBrokerMessages,
    IsActiveUser,
    IsBrokerTeamManager,
    IsEmailVerified,
    IsOwnerOrBrokerEditor,
    IsStaffAdmin,
    IsStaffModerator,
)
from accounts.tests.factories import make_user
from brokers.enums import BrokerMembershipRole
from brokers.tests.factories import make_broker, make_membership


def _request(user, method="get"):
    request = getattr(APIRequestFactory(), method)("/api/v1/whatever/")
    request.user = user
    return request


@pytest.mark.django_db
def test_is_active_user_rejects_anonymous_and_inactive():
    assert IsActiveUser().has_permission(_request(AnonymousUser()), None) is False
    inactive = make_user("x@example.com", is_active=False)
    assert IsActiveUser().has_permission(_request(inactive), None) is False
    assert IsActiveUser().has_permission(_request(make_user("y@example.com")), None) is True


@pytest.mark.django_db
def test_is_email_verified_gates_on_the_verification_timestamp():
    unverified = make_user("u@example.com", verified=False)
    verified = make_user("v@example.com", verified=True)
    assert IsEmailVerified().has_permission(_request(unverified), None) is False
    assert IsEmailVerified().has_permission(_request(verified), None) is True


@pytest.mark.django_db
def test_staff_permission_classes_follow_the_group_tiers():
    moderator = make_user("m@example.com", role=UserRole.STAFF)
    moderator.groups.add(Group.objects.get(name=StaffGroup.MODERATOR))
    admin = make_user("a@example.com", role=UserRole.STAFF)
    admin.groups.add(Group.objects.get(name=StaffGroup.ADMIN))

    assert IsStaffModerator().has_permission(_request(moderator), None) is True
    assert IsStaffAdmin().has_permission(_request(moderator), None) is False
    assert IsStaffModerator().has_permission(_request(admin), None) is True
    assert IsStaffAdmin().has_permission(_request(admin), None) is True


@pytest.mark.django_db
def test_object_permission_reads_owner_user_id_and_broker_id():
    owner = make_user("o@example.com", role=UserRole.PRIVATE_SELLER)
    stranger = make_user("s@example.com", role=UserRole.PRIVATE_SELLER)
    obj = SimpleNamespace(owner_user_id=owner.pk, broker_id=None)

    assert IsOwnerOrBrokerEditor().has_object_permission(_request(owner), None, obj) is True
    assert IsOwnerOrBrokerEditor().has_object_permission(_request(stranger), None, obj) is False


@pytest.mark.django_db
def test_object_permission_honours_broker_editor_membership():
    agent = make_user("ag@example.com", role=UserRole.BROKER)
    mine = make_broker(name="Mine", slug="mine")
    theirs = make_broker(name="Theirs", slug="theirs")
    make_membership(agent, mine, role=BrokerMembershipRole.AGENT, can_edit_listings=True)

    assert (
        IsOwnerOrBrokerEditor().has_object_permission(
            _request(agent), None, SimpleNamespace(owner_user_id=None, broker_id=mine.pk)
        )
        is True
    )
    assert (
        IsOwnerOrBrokerEditor().has_object_permission(
            _request(agent), None, SimpleNamespace(owner_user_id=None, broker_id=theirs.pk)
        )
        is False
    )


@pytest.mark.django_db
def test_broker_team_manager_permission_reads_the_view_kwarg():
    manager = make_user("mgr@example.com", role=UserRole.BROKER)
    agent = make_user("agt@example.com", role=UserRole.BROKER)
    broker = make_broker()
    make_membership(manager, broker, role=BrokerMembershipRole.MANAGER, can_manage_team=True)
    make_membership(agent, broker, role=BrokerMembershipRole.AGENT, can_edit_listings=True)
    view = SimpleNamespace(kwargs={"broker_id": str(broker.pk)})

    assert IsBrokerTeamManager().has_permission(_request(manager), view) is True
    assert IsBrokerTeamManager().has_permission(_request(agent), view) is False


@pytest.mark.django_db
def test_message_reading_permission_keys_off_can_read_messages_not_can_edit_listings():
    """Phase 6 must use CanReadBrokerMessages, never IsOwnerOrBrokerEditor.

    The editor asserted here has can_edit_listings=True and can_read_messages=False:
    IsOwnerOrBrokerEditor would let them through, CanReadBrokerMessages must not.
    """
    reader = make_user("msgread@example.com", role=UserRole.BROKER)
    editor = make_user("msgedit@example.com", role=UserRole.BROKER)
    broker = make_broker()
    make_membership(reader, broker, role=BrokerMembershipRole.AGENT, can_read_messages=True)
    make_membership(editor, broker, role=BrokerMembershipRole.AGENT, can_edit_listings=True)
    view = SimpleNamespace(kwargs={"broker_id": str(broker.pk)})

    assert CanReadBrokerMessages().has_permission(_request(reader), view) is True
    assert CanReadBrokerMessages().has_permission(_request(editor), view) is False
    # And the class that would have been wrong here does let the editor through:
    assert (
        IsOwnerOrBrokerEditor().has_object_permission(
            _request(editor), None, SimpleNamespace(owner_user_id=None, broker_id=broker.pk)
        )
        is True
    )
```

- [ ] **Step 3: Run both test files to verify they fail**

```bash
cd backend
uv run pytest accounts/tests/test_services.py accounts/tests/test_permissions.py -v
```

Expected: `ImportError: cannot import name 'active_broker_membership' from 'accounts.services'` and `ModuleNotFoundError: No module named 'accounts.permissions'`. (`is_staff_moderator` / `is_staff_admin` already import cleanly — Task 5 landed them.) The group-based tests would also fail with `Group.DoesNotExist` — the data migration in Step 4 fixes that.

- [ ] **Step 4: Create the staff groups data migration**

`backend/accounts/migrations/0003_staff_groups.py`:

```python
from django.db import migrations

STAFF_GROUP_NAMES = ("staff_moderator", "staff_admin")


def create_staff_groups(apps, schema_editor):
    Group = apps.get_model("auth", "Group")
    for name in STAFF_GROUP_NAMES:
        Group.objects.get_or_create(name=name)


def delete_staff_groups(apps, schema_editor):
    Group = apps.get_model("auth", "Group")
    Group.objects.filter(name__in=STAFF_GROUP_NAMES).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0002_emailverificationtoken"),
        ("auth", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(create_staff_groups, delete_staff_groups),
    ]
```

**Note:** the names are repeated as literals here rather than imported from `accounts.enums.StaffGroup`. Migrations must stay frozen against the code at the time they were written — importing a live constant would silently rewrite history if the constant were ever renamed. `get_or_create` makes the migration re-runnable (spec §38's idempotency requirement), and the reverse operation makes it rollback-safe (spec §39's handoff note asks for rollback characteristics).

```bash
uv run python manage.py migrate
```

Expected: `Applying accounts.0003_staff_groups... OK`.

- [ ] **Step 5: Implement the authorization services**

Append to `backend/accounts/services.py`, keeping the existing verification services. **Import placement:** consolidate the imports below into the module's single import block at the top of the file, alongside Task 3's `from accounts.tasks import send_email_verification_email` — which belongs at the top like every other import, not at the bottom (see Task 3's "there is no cycle here" note). The only imports that stay function-local here are the `brokers` ones, which break a real `accounts ↔ brokers` cycle and are flagged where they appear.

```python
from dataclasses import dataclass

from rest_framework.exceptions import PermissionDenied

from accounts.enums import SellerType, StaffGroup, UserRole

# _usable(), _in_staff_group(), is_staff_moderator() and is_staff_admin() are
# ALREADY in this module - Task 5 landed them, because BrokerOrganizationAdmin
# needed is_staff_admin. Do not redefine them; everything below is new.


def active_broker_membership(user, broker_id):
    """The user's live membership of an ACTIVE broker, or None (spec 12 item 5)."""
    from brokers.enums import BrokerOrganizationStatus
    from brokers.models import BrokerMembership

    if not _usable(user) or broker_id is None:
        return None
    return (
        BrokerMembership.objects.select_related("broker")
        .filter(
            user=user,
            broker_id=broker_id,
            is_active=True,
            broker__status=BrokerOrganizationStatus.ACTIVE,
        )
        .first()
    )


def has_any_broker_edit_membership(user) -> bool:
    from brokers.enums import BrokerOrganizationStatus
    from brokers.models import BrokerMembership

    if not _usable(user):
        return False
    return BrokerMembership.objects.filter(
        user=user,
        is_active=True,
        can_edit_listings=True,
        broker__status=BrokerOrganizationStatus.ACTIVE,
    ).exists()


def can_edit_owned_object(user, *, owner_user_id, broker_id) -> bool:
    """Server-side ownership resolution for any owner_user/broker-scoped record."""
    if not _usable(user):
        return False
    if is_staff_admin(user):
        return True
    if owner_user_id is not None and owner_user_id == user.pk:
        return True
    if broker_id is not None:
        membership = active_broker_membership(user, broker_id)
        return membership is not None and membership.can_edit_listings
    return False


def can_read_broker_messages(user, broker_id) -> bool:
    if is_staff_moderator(user):
        return True
    membership = active_broker_membership(user, broker_id)
    return membership is not None and membership.can_read_messages


def can_manage_broker_team(user, broker_id) -> bool:
    if is_staff_admin(user):
        return True
    membership = active_broker_membership(user, broker_id)
    return membership is not None and membership.can_manage_team


@dataclass(frozen=True)
class SellerContext:
    """Who a listing belongs to. Derived on the server, never read from the client."""

    seller_type: str
    owner_user: object | None
    broker: object | None


def resolve_seller_context(user, *, broker_id=None) -> SellerContext:
    """Resolve listing ownership exclusively on the server (spec 12 item 2).

    The caller passes at most a broker id. seller_type is never accepted from the
    client: it is a consequence of which broker (if any) this user may act for.
    """
    if not _usable(user):
        raise PermissionDenied(
            detail="Authentication is required.", code="authentication_required"
        )
    if not user.is_email_verified:
        raise PermissionDenied(
            detail="Verify your email address first.", code="email_not_verified"
        )

    if broker_id is None:
        if user.primary_role == UserRole.PRIVATE_SELLER or is_staff_admin(user):
            return SellerContext(
                seller_type=SellerType.PRIVATE, owner_user=user, broker=None
            )
        raise PermissionDenied(
            detail="This account cannot create private-seller listings.",
            code="private_listing_not_allowed",
        )

    membership = active_broker_membership(user, broker_id)
    if membership is not None and membership.can_edit_listings:
        return SellerContext(
            seller_type=SellerType.BROKER, owner_user=None, broker=membership.broker
        )

    if is_staff_admin(user):
        from brokers.enums import BrokerOrganizationStatus
        from brokers.models import BrokerOrganization

        broker = BrokerOrganization.objects.filter(
            pk=broker_id, status=BrokerOrganizationStatus.ACTIVE
        ).first()
        if broker is not None:
            return SellerContext(
                seller_type=SellerType.BROKER, owner_user=None, broker=broker
            )

    raise PermissionDenied(
        detail="This account cannot create listings for that broker.",
        code="broker_listing_not_allowed",
    )
```

**Note (function-local `brokers` imports):** `accounts.services` is imported by `brokers.admin`, so a module-level `from brokers.models import …` would create an import cycle at app-loading time. The imports are placed inside the functions that need them. This is the only place in the project where that pattern is required; later phases importing `accounts.services` from their own modules have no such cycle.

**Note (staff admin "on behalf" — spec §5):** the capability table marks "Create private listing" and "Create broker listing" as "✓ on behalf" for staff admin. `resolve_seller_context` implements that: a staff admin with no `broker_id` gets a private context owned by themselves, which Phase 11's on-behalf flow will refine by passing an explicit target owner. Phase 11 must extend this function with an `on_behalf_of_user` keyword rather than adding a parallel code path.

- [ ] **Step 6: Implement the permission classes**

`backend/accounts/permissions.py`:

```python
from rest_framework.permissions import BasePermission

from accounts.services import (
    can_edit_owned_object,
    can_manage_broker_team,
    can_read_broker_messages,
    is_staff_admin,
    is_staff_moderator,
)


class IsActiveUser(BasePermission):
    message = "Authentication is required."
    code = "authentication_required"

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_active)


class IsEmailVerified(BasePermission):
    """Spec 12 item 3: verified email for inquiry, listing submission and Checkout."""

    message = "Verify your email address first."
    code = "email_not_verified"

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user and user.is_authenticated and user.is_active and user.is_email_verified
        )


class IsStaffModerator(BasePermission):
    message = "Staff moderator access is required."
    code = "staff_moderator_required"

    def has_permission(self, request, view):
        return is_staff_moderator(request.user)


class IsStaffAdmin(BasePermission):
    message = "Staff administrator access is required."
    code = "staff_admin_required"

    def has_permission(self, request, view):
        return is_staff_admin(request.user)


class IsOwnerOrBrokerEditor(BasePermission):
    """Object-level ownership. The object must expose owner_user_id and/or broker_id."""

    message = "You do not have permission to modify this record."
    code = "not_object_owner"

    def has_object_permission(self, request, view, obj):
        return can_edit_owned_object(
            request.user,
            owner_user_id=getattr(obj, "owner_user_id", None),
            broker_id=getattr(obj, "broker_id", None),
        )


class IsBrokerTeamManager(BasePermission):
    """View-level: the caller may manage the team of view.kwargs['broker_id']."""

    message = "You do not have permission to manage this broker's team."
    code = "not_broker_team_manager"

    def has_permission(self, request, view):
        broker_id = getattr(view, "kwargs", {}).get("broker_id")
        return can_manage_broker_team(request.user, broker_id)


class CanReadBrokerMessages(BasePermission):
    """View-level: the caller may read the message threads of view.kwargs['broker_id'].

    Mirrors IsBrokerTeamManager exactly, but delegates to can_read_broker_messages()
    - i.e. the `can_read_messages` capability flag, NOT `can_edit_listings`. Phase 6
    (messaging) uses this class; IsOwnerOrBrokerEditor is the wrong tool there,
    because an AGENT with can_edit_listings=True and can_read_messages=False would
    pass it and read conversations they have no right to see.
    """

    message = "You do not have permission to read this broker's messages."
    code = "not_broker_message_reader"

    def has_permission(self, request, view):
        broker_id = getattr(view, "kwargs", {}).get("broker_id")
        return can_read_broker_messages(request.user, broker_id)
```

**Note (`message` + `code` on every class):** DRF raises `PermissionDenied(detail=self.message, code=self.code)` when a permission class returns `False`, so each denial reaches the client through Task 2's envelope with its own stable machine code. Spec §30.2 requires stable codes and §12's frontend requirement needs them to render a meaningful 403 screen.

- [ ] **Step 7: Run the tests to verify they pass, and re-check Task 5's admin tests**

```bash
uv run pytest accounts/tests/test_services.py accounts/tests/test_permissions.py -v
uv run pytest brokers -v
```

Expected: all service and permission tests `PASS`; the `brokers` suite — including `test_admin.py`, which has been calling the real `is_staff_admin` through a function-local import since Task 5 — still passes.

- [ ] **Step 8: Commit**

```bash
git add backend/accounts
git commit -m "feat(accounts): add staff groups, authorization services and permission classes"
```

---

### Task 8: `GET /api/v1/session/` — the single permission source for the frontend

Spec §30.1 defines `/api/v1/session/` as "user, role, permissions, locale", and §12's frontend requirement is that "navigation is derived from the authenticated session/permissions endpoint". This task builds the one server-side selector that turns spec §5's capability table into a JSON map, and the endpoint that serves it.

**Files:**
- Create: `backend/accounts/selectors.py`
- Modify: `backend/accounts/views.py`, `backend/accounts/urls.py`
- Test: `backend/accounts/tests/test_session.py`

**Interfaces:**
- Consumes: everything from Task 7, plus `brokers.models.BrokerMembership` and `professionals.models.ProfessionalProfile`.
- Produces:
  - `accounts.selectors.PERMISSION_KEYS` — the exact, ordered tuple of permission keys (below).
  - `accounts.selectors.get_session_permissions(user) -> dict[str, bool]` — every key in `PERMISSION_KEYS`, always all twelve, for authenticated and anonymous users alike.
  - `accounts.selectors.get_broker_memberships(user) -> list[dict]`
  - `accounts.selectors.build_session_payload(user) -> dict`
  - `GET /api/v1/session/` — `AllowAny`, 200 for guests and authenticated users alike.

**The permission map (spec §5's table, one key per row):**

| Key | Spec §5 row | True when |
|---|---|---|
| `browse_public_content` | Browse public content | always (guests included) |
| `submit_inquiry` | Submit inquiry | authenticated, active and email-verified |
| `reveal_contact_after_inquiry` | Reveal recipient contact after inquiry ("own access") | authenticated, active and email-verified |
| `reveal_any_contact` | Reveal recipient contact after inquiry ("✓" for staff) | staff moderator or above |
| `create_private_listing` | Create private listing | verified and `primary_role == PRIVATE_SELLER` |
| `create_broker_listing` | Create broker listing | verified and holds any active `can_edit_listings` membership of an `ACTIVE` broker |
| `create_listing_on_behalf` | "✓ on behalf" (staff admin) | staff admin |
| `enable_listing_finance_flag` | Enable listing finance flag | verified and holds any active `can_edit_listings` membership |
| `approve_listings_and_revisions` | Approve listings/revisions | staff moderator or above |
| `configure_broker_auto_approval` | Configure broker auto-approval | staff admin |
| `configure_products_and_settings` | Configure products/settings | staff admin |
| `manage_taxonomy` | Manage taxonomy | staff admin |

**Note (two keys for one table row):** §5's "Reveal recipient contact after inquiry" row holds two different values — "own access" for ordinary users and "✓" for staff. A single boolean would lose that distinction, so it becomes two keys. `reveal_contact_after_inquiry` means "may unlock contacts I have earned through an inquiry"; `reveal_any_contact` means "may see contact data without an inquiry grant". Phase 7's `ContactAccessService` is the authority for the per-entity grant itself; this map only says whether the capability exists at all.

**Note (the map is advisory to the client, authoritative to nobody):** this payload exists so the frontend can hide links it should not offer. It is **not** an authorization mechanism. Every endpoint re-checks with the permission classes from Task 7, which is exactly what spec §12's "unauthorized links are hidden, but direct route access is still rejected by the backend" requires. Later phases must never treat a `true` here as permission to skip a server-side check.

- [ ] **Step 1: Write the failing tests**

`backend/accounts/tests/test_session.py`:

```python
import pytest
from django.contrib.auth.models import Group
from rest_framework.test import APIClient

from accounts.enums import Locale, StaffGroup, UserRole
from accounts.selectors import PERMISSION_KEYS
from accounts.tests.factories import DEFAULT_TEST_PASSWORD, make_user
from brokers.enums import BrokerMembershipRole, BrokerOrganizationStatus
from brokers.tests.factories import make_broker, make_membership
from professionals.tests.factories import make_professional

SESSION_URL = "/api/v1/session/"
LOGIN_URL = "/api/v1/auth/login/"


@pytest.fixture
def api():
    return APIClient()


def _authenticate(api, user):
    response = api.post(
        LOGIN_URL, {"email": user.email, "password": DEFAULT_TEST_PASSWORD}, format="json"
    )
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
    return api


@pytest.mark.django_db
def test_a_guest_gets_a_full_all_false_permission_map(api):
    response = api.get(SESSION_URL)

    assert response.status_code == 200
    assert response.data["authenticated"] is False
    assert response.data["user"] is None
    assert response.data["locale"] == Locale.EN
    assert response.data["broker_memberships"] == []
    assert response.data["professional_profile"] is None
    assert set(response.data["permissions"]) == set(PERMISSION_KEYS)
    assert response.data["permissions"]["browse_public_content"] is True
    assert all(
        value is False
        for key, value in response.data["permissions"].items()
        if key != "browse_public_content"
    )


@pytest.mark.django_db
def test_an_authenticated_buyer_may_inquire_but_not_sell(api):
    buyer = make_user("buyer@example.com", role=UserRole.BUYER, locale=Locale.IT)
    _authenticate(api, buyer)

    response = api.get(SESSION_URL)

    assert response.data["authenticated"] is True
    assert response.data["user"]["email"] == "buyer@example.com"
    assert response.data["locale"] == Locale.IT
    permissions = response.data["permissions"]
    assert permissions["submit_inquiry"] is True
    assert permissions["reveal_contact_after_inquiry"] is True
    assert permissions["reveal_any_contact"] is False
    assert permissions["create_private_listing"] is False
    assert permissions["create_broker_listing"] is False


@pytest.mark.django_db
def test_an_unverified_user_cannot_inquire_or_list(api):
    user = make_user("unv@example.com", role=UserRole.PRIVATE_SELLER, verified=False)
    _authenticate(api, user)

    permissions = api.get(SESSION_URL).data["permissions"]

    assert permissions["submit_inquiry"] is False
    assert permissions["create_private_listing"] is False


@pytest.mark.django_db
def test_a_verified_private_seller_may_create_a_private_listing(api):
    seller = make_user("ps@example.com", role=UserRole.PRIVATE_SELLER)
    _authenticate(api, seller)

    permissions = api.get(SESSION_URL).data["permissions"]

    assert permissions["create_private_listing"] is True
    assert permissions["create_broker_listing"] is False
    assert permissions["enable_listing_finance_flag"] is False


@pytest.mark.django_db
def test_a_broker_editor_may_create_broker_listings_and_enable_finance(api):
    agent = make_user("agent@example.com", role=UserRole.BROKER)
    broker = make_broker()
    make_membership(agent, broker, role=BrokerMembershipRole.AGENT, can_edit_listings=True)
    _authenticate(api, agent)

    response = api.get(SESSION_URL)

    assert response.data["permissions"]["create_broker_listing"] is True
    assert response.data["permissions"]["enable_listing_finance_flag"] is True
    assert response.data["permissions"]["create_private_listing"] is False
    membership = response.data["broker_memberships"][0]
    assert membership["broker_slug"] == broker.slug
    assert membership["role"] == BrokerMembershipRole.AGENT
    assert membership["can_edit_listings"] is True
    assert membership["can_manage_team"] is False


@pytest.mark.django_db
def test_a_suspended_broker_membership_is_not_reported_as_usable(api):
    agent = make_user("susp@example.com", role=UserRole.BROKER)
    broker = make_broker(status=BrokerOrganizationStatus.SUSPENDED)
    make_membership(agent, broker, can_edit_listings=True)
    _authenticate(api, agent)

    response = api.get(SESSION_URL)

    assert response.data["permissions"]["create_broker_listing"] is False
    assert response.data["broker_memberships"][0]["broker_status"] == (
        BrokerOrganizationStatus.SUSPENDED
    )


@pytest.mark.django_db
def test_a_moderator_may_approve_but_not_configure(api):
    moderator = make_user("mod@example.com", role=UserRole.STAFF)
    moderator.groups.add(Group.objects.get(name=StaffGroup.MODERATOR))
    _authenticate(api, moderator)

    response = api.get(SESSION_URL)

    permissions = response.data["permissions"]
    assert permissions["approve_listings_and_revisions"] is True
    assert permissions["reveal_any_contact"] is True
    assert permissions["configure_products_and_settings"] is False
    assert permissions["configure_broker_auto_approval"] is False
    assert permissions["manage_taxonomy"] is False
    assert response.data["staff"] == {"is_staff_moderator": True, "is_staff_admin": False}


@pytest.mark.django_db
def test_a_staff_admin_may_configure_everything(api):
    admin = make_user("sa@example.com", role=UserRole.STAFF)
    admin.groups.add(Group.objects.get(name=StaffGroup.ADMIN))
    _authenticate(api, admin)

    permissions = api.get(SESSION_URL).data["permissions"]

    assert permissions["configure_products_and_settings"] is True
    assert permissions["configure_broker_auto_approval"] is True
    assert permissions["manage_taxonomy"] is True
    assert permissions["create_listing_on_behalf"] is True
    assert permissions["approve_listings_and_revisions"] is True


@pytest.mark.django_db
def test_a_service_provider_session_includes_their_profile(api):
    pro = make_user("pro@example.com", role=UserRole.SERVICE_PROVIDER)
    profile = make_professional(pro, display_name="Ocean Legal", slug="ocean-legal")
    _authenticate(api, pro)

    payload = api.get(SESSION_URL).data

    assert payload["professional_profile"] == {
        "id": str(profile.pk),
        "slug": "ocean-legal",
        "display_name": "Ocean Legal",
        "status": profile.status,
    }


@pytest.mark.django_db
def test_the_session_payload_never_contains_a_token_or_password(api):
    user = make_user("leak@example.com")
    _authenticate(api, user)

    body = str(api.get(SESSION_URL).data)

    assert "password" not in body
    assert "refresh" not in body
    assert "access" not in body


@pytest.mark.django_db
def test_an_expired_or_bogus_token_is_rejected_rather_than_treated_as_a_guest(api):
    api.credentials(HTTP_AUTHORIZATION="Bearer not-a-real-token")
    response = api.get(SESSION_URL)
    assert response.status_code == 401
    assert response.data["error"]["code"] == "token_not_valid"
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd backend
uv run pytest accounts/tests/test_session.py -v
```

Expected: `ModuleNotFoundError: No module named 'accounts.selectors'`.

- [ ] **Step 3: Implement the selectors**

`backend/accounts/selectors.py`:

```python
from accounts.enums import Locale, UserRole
from accounts.services import (
    has_any_broker_edit_membership,
    is_staff_admin,
    is_staff_moderator,
)

PERMISSION_KEYS = (
    "browse_public_content",
    "submit_inquiry",
    "reveal_contact_after_inquiry",
    "reveal_any_contact",
    "create_private_listing",
    "create_broker_listing",
    "create_listing_on_behalf",
    "enable_listing_finance_flag",
    "approve_listings_and_revisions",
    "configure_broker_auto_approval",
    "configure_products_and_settings",
    "manage_taxonomy",
)


def _is_usable(user) -> bool:
    return (
        user is not None
        and getattr(user, "is_authenticated", False)
        and getattr(user, "is_active", False)
    )


def get_session_permissions(user) -> dict:
    """Spec 5's capability table, evaluated server-side. Always returns every key."""
    usable = _is_usable(user)
    verified = usable and user.is_email_verified
    staff_moderator = is_staff_moderator(user) if usable else False
    staff_admin = is_staff_admin(user) if usable else False
    broker_editor = verified and has_any_broker_edit_membership(user)

    permissions = {
        "browse_public_content": True,
        "submit_inquiry": verified,
        "reveal_contact_after_inquiry": verified,
        "reveal_any_contact": staff_moderator,
        "create_private_listing": verified and user.primary_role == UserRole.PRIVATE_SELLER,
        "create_broker_listing": broker_editor,
        "create_listing_on_behalf": staff_admin,
        "enable_listing_finance_flag": broker_editor,
        "approve_listings_and_revisions": staff_moderator,
        "configure_broker_auto_approval": staff_admin,
        "configure_products_and_settings": staff_admin,
        "manage_taxonomy": staff_admin,
    }
    assert set(permissions) == set(PERMISSION_KEYS)  # keeps the contract honest
    return permissions


def get_broker_memberships(user) -> list:
    from brokers.models import BrokerMembership

    if not _is_usable(user):
        return []
    memberships = BrokerMembership.objects.select_related("broker").filter(
        user=user, is_active=True
    )
    return [
        {
            "broker_id": str(membership.broker_id),
            "broker_name": membership.broker.name,
            "broker_slug": membership.broker.slug,
            "broker_status": membership.broker.status,
            "role": membership.role,
            "can_edit_listings": membership.can_edit_listings,
            "can_manage_team": membership.can_manage_team,
            "can_read_messages": membership.can_read_messages,
        }
        for membership in memberships
    ]


def get_professional_profile_summary(user):
    from professionals.models import ProfessionalProfile

    if not _is_usable(user):
        return None
    profile = ProfessionalProfile.objects.filter(owner_user=user).first()
    if profile is None:
        return None
    return {
        "id": str(profile.pk),
        "slug": profile.slug,
        "display_name": profile.display_name,
        "status": profile.status,
    }


def build_session_payload(user) -> dict:
    from accounts.serializers import UserSummarySerializer

    usable = _is_usable(user)
    return {
        "authenticated": usable,
        "user": UserSummarySerializer(user).data if usable else None,
        "locale": user.locale if usable else Locale.EN,
        "permissions": get_session_permissions(user),
        "broker_memberships": get_broker_memberships(user),
        "professional_profile": get_professional_profile_summary(user),
        "staff": {
            "is_staff_moderator": is_staff_moderator(user) if usable else False,
            "is_staff_admin": is_staff_admin(user) if usable else False,
        },
    }
```

**Note (suspended memberships are listed but not empowered):** `get_broker_memberships` includes memberships of `SUSPENDED` and `PENDING` brokers, with the real `broker_status`, so the broker dashboard can explain *why* actions are unavailable instead of the organization silently vanishing (spec §2.1 forbids inventing an explanation client-side). The permission map is unaffected — it goes through `has_any_broker_edit_membership`, which filters on `ACTIVE`. Memberships with `is_active=False` are omitted entirely; a revoked member is not a member.

- [ ] **Step 4: Implement the view and URL**

Append to `backend/accounts/views.py`:

```python
from accounts.selectors import build_session_payload


class SessionView(APIView):
    """user, role, permissions, locale (spec 30.1). Answers guests with 200."""

    permission_classes = [AllowAny]

    def get(self, request):
        user = request.user if request.user.is_authenticated else None
        return Response(build_session_payload(user), status=status.HTTP_200_OK)
```

Add to `backend/accounts/urls.py`'s `urlpatterns` (and the `SessionView` import):

```python
    path("session/", SessionView.as_view(), name="session"),
```

**Note (why `SessionView` keeps the default authentication classes):** it does *not* set `authentication_classes = []`. With `AllowAny` plus the project-default `JWTAuthentication`, a request with no `Authorization` header is an anonymous guest and gets 200, while a request carrying a malformed, expired or blacklisted token gets 401 `token_not_valid` — which is what the frontend needs in order to trigger a refresh rather than silently rendering a logged-out navigation for a user who believes they are signed in. `test_an_expired_or_bogus_token_is_rejected_rather_than_treated_as_a_guest` locks this behaviour in.

- [ ] **Step 5: Run the tests to verify they pass**

```bash
uv run pytest accounts/tests/test_session.py -v
```

Expected: all 11 tests `PASS`.

- [ ] **Step 6: Check the query count for the session endpoint**

Spec §33.3 forbids N+1 queries in collections. Add to `backend/accounts/tests/test_session.py`:

```python
@pytest.mark.django_db
def test_session_query_count_is_stable_with_many_memberships(api, django_assert_max_num_queries):
    agent = make_user("many@example.com", role=UserRole.BROKER)
    for index in range(5):
        broker = make_broker(name=f"Broker {index}", slug=f"broker-{index}")
        make_membership(agent, broker, can_edit_listings=True)
    _authenticate(api, agent)

    with django_assert_max_num_queries(8):
        api.get(SESSION_URL)
```

```bash
uv run pytest accounts/tests/test_session.py -v
```

Expected: `PASS`. If it fails with a higher count, the cause is a missing `select_related("broker")` in `get_broker_memberships` — fix the selector, never raise the budget.

- [ ] **Step 7: Manual verification**

```bash
curl -s http://localhost:8020/api/v1/session/ | python -m json.tool
```

Expected: HTTP 200 with `"authenticated": false`, all twelve permission keys present, only `browse_public_content` true. Repeat with `-H "Authorization: Bearer <access>"` from a login and confirm the map changes to match the signed-in account's role.

- [ ] **Step 8: Commit**

```bash
git add backend/accounts
git commit -m "feat(accounts): add session endpoint with server-computed permission map"
```

---

### Task 9: Own-account endpoint and broker team membership management

Spec §4.2 gives brokers a `/team/` route; this is its backend. Spec §12 item 4 requires object-level authorization for staff actions and organization records, and §2.2 requires the backend to reject unauthorized changes independently of what the UI offered.

**Files:**
- Modify: `backend/accounts/serializers.py`, `backend/accounts/views.py`, `backend/accounts/urls.py`
- Create: `backend/brokers/serializers.py`, `backend/brokers/views.py`, `backend/brokers/urls.py`
- Modify: `backend/config/urls.py`
- Modify: `backend/accounts/tests/test_auth_endpoints.py` (remove the `xfail` marker added in Task 4)
- Test: `backend/accounts/tests/test_account_api.py`, `backend/brokers/tests/test_team_api.py`

**Interfaces:**
- Consumes: `accounts.permissions.{IsActiveUser, IsEmailVerified, IsBrokerTeamManager}`, `accounts.services.{active_broker_membership, is_staff_admin}`, `brokers.models.{BrokerOrganization, BrokerMembership}`, `brokers.enums.{BrokerMembershipRole, ROLE_DEFAULT_CAPABILITIES}` (the role→flag reset lives in `BrokerMembership.save()` from Task 5 — this task must not re-implement it).
- Produces:
  - `GET /api/v1/account/` → the caller's own `UserSummarySerializer` payload.
  - `PATCH /api/v1/account/` → updates `full_name` and `locale` only.
  - `GET /api/v1/brokers/<broker_id>/members/` → list of that broker's memberships.
  - `POST /api/v1/brokers/<broker_id>/members/` → add an **existing** user by email.
  - `PATCH /api/v1/brokers/<broker_id>/members/<membership_id>/` → change role/flags/`is_active`.
  - `DELETE /api/v1/brokers/<broker_id>/members/<membership_id>/` → deactivate (soft) the membership.
  - `brokers.serializers.BrokerMembershipSerializer` (read), `brokers.serializers.BrokerMembershipCreateSerializer` and `brokers.serializers.BrokerMembershipUpdateSerializer` (write; both require `context={"actor": <User>, ...}`).
  - Error codes: `user_not_found`, `last_broker_admin`, `membership_exists`, `not_broker_team_manager`, `broker_admin_grant_requires_admin`, `cannot_change_own_broker_role`, `set_flags_in_a_separate_request`.

**Note (no invitation emails):** adding a team member resolves an **existing** account by email; there is no invite-a-stranger flow, because the spec never describes one and inventing an account-creation-by-email path would be a new, unreviewed identity surface. A prospective member registers through `/api/v1/auth/register/` first, then a broker team manager adds them. If a later change request asks for invitations, it extends this endpoint rather than replacing it.

**Note (`DELETE` is a soft deactivate):** `BrokerMembership` rows are referenced by listings, conversations and audit history in later phases, so a hard delete would orphan them. `DELETE` sets `is_active=False`, which is exactly what `active_broker_membership` filters on, so the member loses every capability immediately. Spec §2.4's auditability requirement is served by the row surviving.

- [ ] **Step 1: Un-xfail the deferred auth test**

In `backend/accounts/tests/test_auth_endpoints.py`, delete the `@pytest.mark.xfail(...)` decorator that Task 4 put on `test_access_token_authenticates_a_protected_endpoint`. It must now pass on its own merits.

- [ ] **Step 2: Write the failing account tests**

`backend/accounts/tests/test_account_api.py`:

```python
import pytest
from rest_framework.test import APIClient

from accounts.enums import Locale, UserRole
from accounts.tests.factories import DEFAULT_TEST_PASSWORD, make_user

ACCOUNT_URL = "/api/v1/account/"
LOGIN_URL = "/api/v1/auth/login/"


@pytest.fixture
def api():
    return APIClient()


def _authenticate(api, user):
    response = api.post(
        LOGIN_URL, {"email": user.email, "password": DEFAULT_TEST_PASSWORD}, format="json"
    )
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
    return api


@pytest.mark.django_db
def test_a_guest_cannot_read_an_account(api):
    response = api.get(ACCOUNT_URL)
    assert response.status_code == 401
    assert response.data["error"]["code"] == "not_authenticated"


@pytest.mark.django_db
def test_a_user_reads_their_own_account(api):
    user = make_user("me@example.com", full_name="Me Myself", role=UserRole.PRIVATE_SELLER)
    _authenticate(api, user)

    response = api.get(ACCOUNT_URL)

    assert response.status_code == 200
    assert response.data["id"] == str(user.pk)
    assert response.data["full_name"] == "Me Myself"
    assert response.data["primary_role"] == UserRole.PRIVATE_SELLER
    assert "password" not in response.data


@pytest.mark.django_db
def test_a_user_can_update_their_name_and_locale(api):
    user = make_user("edit@example.com")
    _authenticate(api, user)

    response = api.patch(
        ACCOUNT_URL, {"full_name": "Nuevo Nombre", "locale": Locale.ES}, format="json"
    )

    assert response.status_code == 200
    user.refresh_from_db()
    assert user.full_name == "Nuevo Nombre"
    assert user.locale == Locale.ES


@pytest.mark.django_db
def test_privileged_and_identity_fields_are_read_only(api):
    user = make_user("escalate@example.com", role=UserRole.BUYER)
    _authenticate(api, user)

    api.patch(
        ACCOUNT_URL,
        {
            "email": "someone.else@example.com",
            "primary_role": UserRole.STAFF,
            "is_active": False,
            "email_verified": False,
        },
        format="json",
    )

    user.refresh_from_db()
    assert user.email == "escalate@example.com"
    assert user.primary_role == UserRole.BUYER
    assert user.is_active is True
    assert user.is_email_verified is True


@pytest.mark.django_db
def test_an_invalid_locale_is_rejected(api):
    _authenticate(api, make_user("loc@example.com"))
    response = api.patch(ACCOUNT_URL, {"locale": "DE"}, format="json")
    assert response.status_code == 400
    assert "locale" in response.data["error"]["fields"]
```

- [ ] **Step 3: Write the failing team-management tests**

`backend/brokers/tests/test_team_api.py`:

```python
import pytest
from rest_framework.test import APIClient

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import DEFAULT_TEST_PASSWORD, make_user
from brokers.enums import BrokerMembershipRole, BrokerOrganizationStatus
from brokers.models import BrokerMembership
from brokers.tests.factories import make_broker, make_membership

LOGIN_URL = "/api/v1/auth/login/"


def members_url(broker):
    return f"/api/v1/brokers/{broker.pk}/members/"


def member_url(broker, membership):
    return f"/api/v1/brokers/{broker.pk}/members/{membership.pk}/"


@pytest.fixture
def api():
    return APIClient()


def _authenticate(api, user):
    response = api.post(
        LOGIN_URL, {"email": user.email, "password": DEFAULT_TEST_PASSWORD}, format="json"
    )
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
    return api


@pytest.fixture
def broker_with_admin():
    broker = make_broker()
    admin = make_user("teamadmin@example.com", role=UserRole.BROKER)
    make_membership(admin, broker, role=BrokerMembershipRole.ADMIN)
    return broker, admin


@pytest.mark.django_db
def test_a_team_manager_lists_their_brokers_members(api, broker_with_admin):
    broker, admin = broker_with_admin
    _authenticate(api, admin)

    response = api.get(members_url(broker))

    assert response.status_code == 200
    assert len(response.data) == 1
    assert response.data[0]["user_email"] == "teamadmin@example.com"
    assert response.data[0]["role"] == BrokerMembershipRole.ADMIN


@pytest.mark.django_db
def test_an_agent_without_can_manage_team_is_forbidden(api, broker_with_admin):
    broker, _ = broker_with_admin
    agent = make_user("plainagent@example.com", role=UserRole.BROKER)
    make_membership(agent, broker, role=BrokerMembershipRole.AGENT, can_edit_listings=True)
    _authenticate(api, agent)

    response = api.get(members_url(broker))

    assert response.status_code == 403
    assert response.data["error"]["code"] == "not_broker_team_manager"


@pytest.mark.django_db
def test_a_member_of_another_broker_is_forbidden(api, broker_with_admin):
    broker, _ = broker_with_admin
    other_broker = make_broker(name="Other", slug="other")
    outsider = make_user("outsider@example.com", role=UserRole.BROKER)
    make_membership(outsider, other_broker, role=BrokerMembershipRole.ADMIN)
    _authenticate(api, outsider)

    assert api.get(members_url(broker)).status_code == 403


@pytest.mark.django_db
def test_a_team_manager_adds_an_existing_user(api, broker_with_admin):
    broker, admin = broker_with_admin
    newcomer = make_user("newcomer@example.com", role=UserRole.BROKER)
    _authenticate(api, admin)

    response = api.post(
        members_url(broker),
        {"user_email": "newcomer@example.com", "role": BrokerMembershipRole.AGENT,
         "can_edit_listings": True},
        format="json",
    )

    assert response.status_code == 201
    membership = BrokerMembership.objects.get(user=newcomer, broker=broker)
    assert membership.role == BrokerMembershipRole.AGENT
    assert membership.can_edit_listings is True
    assert membership.can_manage_team is False


@pytest.mark.django_db
def test_adding_an_unknown_email_returns_a_stable_code(api, broker_with_admin):
    broker, admin = broker_with_admin
    _authenticate(api, admin)

    response = api.post(
        members_url(broker), {"user_email": "ghost@example.com"}, format="json"
    )

    assert response.status_code == 400
    assert response.data["error"]["fields"]["user_email"] == ["user_not_found"]


@pytest.mark.django_db
def test_adding_the_same_user_twice_is_rejected(api, broker_with_admin):
    broker, admin = broker_with_admin
    make_user("twice@example.com", role=UserRole.BROKER)
    _authenticate(api, admin)
    api.post(members_url(broker), {"user_email": "twice@example.com"}, format="json")

    response = api.post(members_url(broker), {"user_email": "twice@example.com"}, format="json")

    assert response.status_code == 400
    assert response.data["error"]["fields"]["user_email"] == ["membership_exists"]


@pytest.mark.django_db
def test_promoting_to_admin_grants_every_flag(api, broker_with_admin):
    broker, admin = broker_with_admin
    agent = make_user("promote@example.com", role=UserRole.BROKER)
    membership = make_membership(agent, broker, role=BrokerMembershipRole.AGENT)
    _authenticate(api, admin)

    response = api.patch(
        member_url(broker, membership), {"role": BrokerMembershipRole.ADMIN}, format="json"
    )

    assert response.status_code == 200
    membership.refresh_from_db()
    assert membership.can_edit_listings is True
    assert membership.can_manage_team is True
    assert membership.can_read_messages is True


@pytest.fixture
def broker_with_admin_and_manager(broker_with_admin):
    """A MANAGER who legitimately holds can_manage_team - the escalation starting point."""
    broker, admin = broker_with_admin
    manager = make_user("teammanager@example.com", role=UserRole.BROKER)
    manager_membership = make_membership(
        manager,
        broker,
        role=BrokerMembershipRole.MANAGER,
        can_edit_listings=True,
        can_manage_team=True,
        can_read_messages=True,
    )
    return broker, admin, manager, manager_membership


@pytest.mark.django_db
def test_a_manager_cannot_promote_themselves_to_admin(api, broker_with_admin_and_manager):
    """Organization takeover, step 1. Must be refused.

    A MANAGER with can_manage_team=True passes IsBrokerTeamManager, so without an
    explicit rank + self-edit check they could PATCH their own row to ADMIN, have
    save() grant every flag, and then remove the real ADMIN.
    """
    broker, _admin, manager, manager_membership = broker_with_admin_and_manager
    _authenticate(api, manager)

    response = api.patch(
        member_url(broker, manager_membership),
        {"role": BrokerMembershipRole.ADMIN},
        format="json",
    )

    assert response.status_code == 400
    assert response.data["error"]["fields"]["role"] == ["cannot_change_own_broker_role"]
    manager_membership.refresh_from_db()
    assert manager_membership.role == BrokerMembershipRole.MANAGER


@pytest.mark.django_db
def test_a_manager_cannot_grant_admin_to_a_third_party(api, broker_with_admin_and_manager):
    """Organization takeover via a confederate. Also refused."""
    broker, _admin, manager, _mm = broker_with_admin_and_manager
    agent = make_user("confederate@example.com", role=UserRole.BROKER)
    agent_membership = make_membership(agent, broker, role=BrokerMembershipRole.AGENT)
    _authenticate(api, manager)

    response = api.patch(
        member_url(broker, agent_membership),
        {"role": BrokerMembershipRole.ADMIN},
        format="json",
    )

    assert response.status_code == 400
    assert response.data["error"]["fields"]["role"] == [
        "broker_admin_grant_requires_admin"
    ]
    agent_membership.refresh_from_db()
    assert agent_membership.role == BrokerMembershipRole.AGENT
    assert agent_membership.can_manage_team is False


@pytest.mark.django_db
def test_an_admin_can_grant_admin_to_a_third_party(api, broker_with_admin_and_manager):
    """The same request, from an actual ADMIN, must succeed."""
    broker, admin, _manager, _mm = broker_with_admin_and_manager
    agent = make_user("deputy@example.com", role=UserRole.BROKER)
    agent_membership = make_membership(agent, broker, role=BrokerMembershipRole.AGENT)
    _authenticate(api, admin)

    response = api.patch(
        member_url(broker, agent_membership),
        {"role": BrokerMembershipRole.ADMIN},
        format="json",
    )

    assert response.status_code == 200
    agent_membership.refresh_from_db()
    assert agent_membership.role == BrokerMembershipRole.ADMIN
    assert agent_membership.can_manage_team is True


@pytest.mark.django_db
def test_a_manager_cannot_hand_out_can_manage_team(api, broker_with_admin_and_manager):
    """can_manage_team is ADMIN-equivalent authority; granting it needs ADMIN."""
    broker, _admin, manager, _mm = broker_with_admin_and_manager
    agent = make_user("wannabe@example.com", role=UserRole.BROKER)
    agent_membership = make_membership(agent, broker, role=BrokerMembershipRole.AGENT)
    _authenticate(api, manager)

    response = api.patch(
        member_url(broker, agent_membership), {"can_manage_team": True}, format="json"
    )

    assert response.status_code == 400
    # The rejection is keyed under the field that carried the grant, not `role`:
    # this request never mentioned `role`.
    assert response.data["error"]["fields"]["can_manage_team"] == [
        "broker_admin_grant_requires_admin"
    ]
    agent_membership.refresh_from_db()
    assert agent_membership.can_manage_team is False


@pytest.mark.django_db
def test_a_manager_cannot_create_an_admin_membership(api, broker_with_admin_and_manager):
    """The same rank rule applies on the create path, not just on update."""
    broker, _admin, manager, _mm = broker_with_admin_and_manager
    make_user("freshadmin@example.com", role=UserRole.BROKER)
    _authenticate(api, manager)

    response = api.post(
        members_url(broker),
        {"user_email": "freshadmin@example.com", "role": BrokerMembershipRole.ADMIN},
        format="json",
    )

    assert response.status_code == 400
    assert response.data["error"]["fields"]["role"] == [
        "broker_admin_grant_requires_admin"
    ]
    assert not BrokerMembership.objects.filter(
        broker=broker, user__email="freshadmin@example.com"
    ).exists()


@pytest.mark.django_db
def test_even_an_admin_cannot_edit_their_own_role(api, broker_with_admin):
    """Rule (b) has no rank exemption: role changes are done TO you, not BY you."""
    broker, admin = broker_with_admin
    membership = BrokerMembership.objects.get(user=admin, broker=broker)
    _authenticate(api, admin)

    response = api.patch(
        member_url(broker, membership),
        {"role": BrokerMembershipRole.MANAGER},
        format="json",
    )

    assert response.status_code == 400
    assert response.data["error"]["fields"]["role"] == ["cannot_change_own_broker_role"]


@pytest.mark.django_db
def test_demoting_through_the_api_revokes_can_manage_team(api, broker_with_admin_and_manager):
    """The demotion half of the ADMIN rule, end to end through the endpoint."""
    broker, admin, _manager, _mm = broker_with_admin_and_manager
    deputy = make_user("deputy2@example.com", role=UserRole.BROKER)
    deputy_membership = make_membership(deputy, broker, role=BrokerMembershipRole.ADMIN)
    _authenticate(api, admin)

    response = api.patch(
        member_url(broker, deputy_membership),
        {"role": BrokerMembershipRole.VIEWER},
        format="json",
    )

    assert response.status_code == 200
    deputy_membership.refresh_from_db()
    assert deputy_membership.role == BrokerMembershipRole.VIEWER
    assert deputy_membership.can_manage_team is False
    assert deputy_membership.can_edit_listings is False
    assert deputy_membership.can_read_messages is False


@pytest.mark.django_db
def test_a_role_change_and_a_flag_change_cannot_share_one_request(
    api, broker_with_admin_and_manager
):
    broker, admin, _manager, _mm = broker_with_admin_and_manager
    agent = make_user("combo@example.com", role=UserRole.BROKER)
    agent_membership = make_membership(agent, broker, role=BrokerMembershipRole.AGENT)
    _authenticate(api, admin)

    response = api.patch(
        member_url(broker, agent_membership),
        {"role": BrokerMembershipRole.VIEWER, "can_read_messages": True},
        format="json",
    )

    assert response.status_code == 400
    assert response.data["error"]["fields"]["can_read_messages"] == [
        "set_flags_in_a_separate_request"
    ]


@pytest.mark.django_db
def test_the_last_active_admin_cannot_be_demoted(api, broker_with_admin):
    """Driven by a STAFF admin, deliberately.

    The broker's own admin cannot demote themselves at all (rule (b) rejects it
    with `cannot_change_own_broker_role` before the count is ever reached), so a
    third party who legitimately outranks them is what actually exercises the
    last-admin guard.
    """
    from django.contrib.auth.models import Group

    broker, admin = broker_with_admin
    membership = BrokerMembership.objects.get(user=admin, broker=broker)
    staff_admin = make_user("lastadmin.staff@example.com", role=UserRole.STAFF)
    staff_admin.groups.add(Group.objects.get(name=StaffGroup.ADMIN))
    _authenticate(api, staff_admin)

    response = api.patch(
        member_url(broker, membership), {"role": BrokerMembershipRole.AGENT}, format="json"
    )

    assert response.status_code == 400
    assert response.data["error"]["fields"]["role"] == ["last_broker_admin"]
    membership.refresh_from_db()
    assert membership.role == BrokerMembershipRole.ADMIN


@pytest.mark.django_db
def test_the_last_active_admin_cannot_be_deactivated(api, broker_with_admin):
    """Leaving the team yourself IS allowed (is_active is not an elevated field) -
    but not when it would leave the organization with zero admins."""
    broker, admin = broker_with_admin
    membership = BrokerMembership.objects.get(user=admin, broker=broker)
    _authenticate(api, admin)

    response = api.delete(member_url(broker, membership))

    assert response.status_code == 400
    assert response.data["error"]["fields"]["is_active"] == ["last_broker_admin"]


@pytest.mark.django_db
def test_deleting_a_member_deactivates_rather_than_destroys(api, broker_with_admin):
    broker, admin = broker_with_admin
    agent = make_user("bye@example.com", role=UserRole.BROKER)
    membership = make_membership(agent, broker, can_edit_listings=True)
    _authenticate(api, admin)

    response = api.delete(member_url(broker, membership))

    assert response.status_code == 204
    membership.refresh_from_db()
    assert membership.is_active is False


@pytest.mark.django_db
def test_a_membership_of_another_broker_cannot_be_reached_through_this_broker(api, broker_with_admin):
    broker, admin = broker_with_admin
    other_broker = make_broker(name="Elsewhere", slug="elsewhere")
    victim = make_user("victim@example.com", role=UserRole.BROKER)
    foreign = make_membership(victim, other_broker, can_edit_listings=True)
    _authenticate(api, admin)

    response = api.patch(
        f"/api/v1/brokers/{broker.pk}/members/{foreign.pk}/",
        {"can_edit_listings": False},
        format="json",
    )

    assert response.status_code == 404
    foreign.refresh_from_db()
    assert foreign.can_edit_listings is True


@pytest.mark.django_db
def test_a_suspended_broker_cannot_have_its_team_changed(api):
    broker = make_broker(status=BrokerOrganizationStatus.SUSPENDED)
    admin = make_user("suspadmin@example.com", role=UserRole.BROKER)
    make_membership(admin, broker, role=BrokerMembershipRole.ADMIN)
    _authenticate(api, admin)

    assert api.get(members_url(broker)).status_code == 403


@pytest.mark.django_db
def test_a_staff_admin_can_manage_any_brokers_team(api, broker_with_admin):
    broker, _ = broker_with_admin
    from django.contrib.auth.models import Group

    staff_admin = make_user("platformadmin@example.com", role=UserRole.STAFF)
    staff_admin.groups.add(Group.objects.get(name=StaffGroup.ADMIN))
    _authenticate(api, staff_admin)

    assert api.get(members_url(broker)).status_code == 200


@pytest.mark.django_db
def test_an_unverified_team_manager_is_rejected(api):
    broker = make_broker()
    admin = make_user("unvadmin@example.com", role=UserRole.BROKER, verified=False)
    make_membership(admin, broker, role=BrokerMembershipRole.ADMIN)
    _authenticate(api, admin)

    response = api.get(members_url(broker))

    assert response.status_code == 403
    assert response.data["error"]["code"] == "email_not_verified"
```

- [ ] **Step 4: Run both test files to verify they fail**

```bash
cd backend
uv run pytest accounts/tests/test_account_api.py brokers/tests/test_team_api.py -v
```

Expected: every test fails with 404 — neither `/api/v1/account/` nor `/api/v1/brokers/<id>/members/` is routed yet.

- [ ] **Step 5: Implement the account endpoint**

Append to `backend/accounts/serializers.py`:

```python
class AccountUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("full_name", "locale")
```

Append to `backend/accounts/views.py`:

```python
from accounts.permissions import IsActiveUser
from accounts.serializers import AccountUpdateSerializer


class AccountView(APIView):
    """The caller's own account. Identity and privilege fields are read-only."""

    permission_classes = [IsActiveUser]

    def get(self, request):
        return Response(UserSummarySerializer(request.user).data, status=status.HTTP_200_OK)

    def patch(self, request):
        serializer = AccountUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            UserSummarySerializer(request.user).data, status=status.HTTP_200_OK
        )
```

Add to `backend/accounts/urls.py`'s `urlpatterns` (and the `AccountView` import):

```python
    path("account/", AccountView.as_view(), name="account"),
```

**Note (why `AccountUpdateSerializer` lists only two fields):** `email`, `primary_role`, `is_active`, `email_verified_at`, `is_staff`, `is_superuser` and `groups` are simply absent from the write serializer, so a crafted `PATCH` containing them is ignored rather than merely validated away — the mass-assignment surface is two fields wide. Changing an email address needs a verified email-change flow (spec §22 requires the inquiry email "cannot be forged to another account without a verified email-change flow"); that flow is not in Phase 3's scope and is flagged in this plan's Known Limitations.

- [ ] **Step 6: Implement the team-membership API**

`backend/brokers/serializers.py`:

```python
from rest_framework import serializers

from accounts.models import User, UserManager
from brokers.enums import BrokerMembershipRole
from brokers.models import BrokerMembership


class BrokerMembershipSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_full_name = serializers.CharField(source="user.full_name", read_only=True)

    class Meta:
        model = BrokerMembership
        fields = (
            "id",
            "user_email",
            "user_full_name",
            "role",
            "can_edit_listings",
            "can_manage_team",
            "can_read_messages",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


ELEVATED_FIELDS = ("role", "can_edit_listings", "can_manage_team", "can_read_messages")


def _actor_may_grant_admin(actor, broker) -> bool:
    """Only an existing ADMIN of this broker - or a staff admin - may create ADMINs.

    A MANAGER holding can_manage_team=True is trusted to move AGENTs and VIEWERs
    around; it must NOT be able to mint a peer (or a superior) of the ADMIN who
    granted it that trust.
    """
    from accounts.services import is_staff_admin

    if is_staff_admin(actor):
        return True
    return BrokerMembership.objects.filter(
        user=actor,
        broker=broker,
        role=BrokerMembershipRole.ADMIN,
        is_active=True,
    ).exists()


def _grants_admin_authority(role, can_manage_team) -> bool:
    # bool(), not `is True`: a caller passing a truthy non-True value (1, or a
    # DB backend's integer 0/1) must not slip past this check.
    return role == BrokerMembershipRole.ADMIN or bool(can_manage_team)


class BrokerMembershipCreateSerializer(serializers.Serializer):
    user_email = serializers.EmailField(max_length=254)
    role = serializers.ChoiceField(
        choices=BrokerMembershipRole.choices, default=BrokerMembershipRole.VIEWER
    )
    can_edit_listings = serializers.BooleanField(default=False)
    can_manage_team = serializers.BooleanField(default=False)
    can_read_messages = serializers.BooleanField(default=False)

    def validate_user_email(self, value):
        normalized = UserManager.normalize_email(value)
        user = User.objects.filter(email=normalized, is_active=True).first()
        if user is None:
            raise serializers.ValidationError("user_not_found")
        broker = self.context["broker"]
        if BrokerMembership.objects.filter(user=user, broker=broker).exists():
            raise serializers.ValidationError("membership_exists")
        self.context["target_user"] = user
        return normalized

    def validate(self, attrs):
        # Rank check: a non-ADMIN may not create an ADMIN, nor hand out
        # can_manage_team (which is ADMIN-equivalent authority over the team).
        role = attrs.get("role", BrokerMembershipRole.VIEWER)
        manage_team = attrs.get("can_manage_team", False)
        if _grants_admin_authority(role, manage_team) and not _actor_may_grant_admin(
            self.context["actor"], self.context["broker"]
        ):
            # Key the error under the field that actually carries the grant.
            field = "role" if role == BrokerMembershipRole.ADMIN else "can_manage_team"
            raise serializers.ValidationError(
                {field: ["broker_admin_grant_requires_admin"]}
            )
        return attrs

    def create(self, validated_data):
        validated_data.pop("user_email")
        return BrokerMembership.objects.create(
            user=self.context["target_user"],
            broker=self.context["broker"],
            **validated_data,
        )


class BrokerMembershipUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = BrokerMembership
        fields = (
            "role",
            "can_edit_listings",
            "can_manage_team",
            "can_read_messages",
            "is_active",
        )

    def validate(self, attrs):
        membership = self.instance
        actor = self.context["actor"]
        touching_elevated = any(field in attrs for field in ELEVATED_FIELDS)

        # (b) NOBODY edits their own role or capability flags through this endpoint,
        #     whatever their rank. Self-service privilege changes are not a thing.
        #     Deactivating your own membership (is_active=False) stays allowed.
        if touching_elevated and membership.user_id == getattr(actor, "pk", None):
            raise serializers.ValidationError(
                {"role": ["cannot_change_own_broker_role"]}
            )

        # (a) Rank check: only an existing ADMIN of this broker (or a staff admin)
        #     may promote anyone to ADMIN or hand out can_manage_team.
        role = attrs.get("role", membership.role)
        manage_team = attrs.get("can_manage_team", membership.can_manage_team)
        if _grants_admin_authority(role, manage_team) and not _actor_may_grant_admin(
            actor, membership.broker
        ):
            # Key the error under the field that actually carries the grant.
            field = "role" if role == BrokerMembershipRole.ADMIN else "can_manage_team"
            raise serializers.ValidationError(
                {field: ["broker_admin_grant_requires_admin"]}
            )

        # A role change resets the capability flags to the role's defaults
        # (BrokerMembership.save()), so accepting both in one request would
        # silently discard the flags. Refuse rather than surprise the caller.
        if "role" in attrs and attrs["role"] != membership.role:
            conflicting = [f for f in ELEVATED_FIELDS if f != "role" and f in attrs]
            if conflicting:
                raise serializers.ValidationError(
                    {f: ["set_flags_in_a_separate_request"] for f in conflicting}
                )

        losing_admin = (
            attrs.get("role", membership.role) != BrokerMembershipRole.ADMIN
            or attrs.get("is_active", membership.is_active) is False
        )
        if membership.role == BrokerMembershipRole.ADMIN and membership.is_active and losing_admin:
            # The caller has already taken a row lock on this broker's memberships
            # (BrokerMemberDetailView, inside transaction.atomic), so this count
            # cannot race another concurrent demotion - see the note below.
            remaining = (
                BrokerMembership.objects.filter(
                    broker=membership.broker,
                    role=BrokerMembershipRole.ADMIN,
                    is_active=True,
                )
                .exclude(pk=membership.pk)
                .exists()
            )
            if not remaining:
                field = "role" if attrs.get("role", membership.role) != BrokerMembershipRole.ADMIN else "is_active"
                raise serializers.ValidationError({field: ["last_broker_admin"]})
        return attrs
```

**Note (ruling — the privilege-escalation hole this closes):** `IsBrokerTeamManager` / `can_manage_broker_team()` only answer "may this caller touch this broker's team at all?" They compare nothing about **rank** and nothing about **who the target is**. Left as-is, a MANAGER with `can_manage_team=True` could `PATCH` **their own** membership to `role=ADMIN`; `BrokerMembership.save()` would force all three capability flags on; and the attacker — now a genuine ADMIN — could deactivate the real ADMIN's membership, with the last-admin guard satisfied by counting *themselves*. That is a complete organization takeover reachable by one authorized-looking request. Three rules close it, and all three are required:

- **(a) Granting ADMIN, or `can_manage_team`, requires being an ADMIN.** A non-ADMIN member can never create or promote anyone — including themselves — to ADMIN, and can never hand out the team-management capability. Staff admins keep their override.
- **(b) Nobody may change their OWN `role` or capability flags** through this endpoint, at any rank, including an ADMIN. Role changes are something another party does to you. (Deactivating your own membership — leaving the team — remains allowed, since it only ever reduces authority and is still subject to the last-admin guard.) An ADMIN who genuinely needs their own role changed goes through a staff admin.
- **(c) A role change and a flag change may not share one request**, because `save()`'s role-default reset would silently discard the flags.

**Note (deliberate consequences of the rank rule, so they are not mistaken for bugs):**

- A MANAGER cannot modify a membership that *currently* holds `role=ADMIN` or `can_manage_team=True`, even to change an unrelated flag — `_grants_admin_authority` is evaluated against the post-patch state, which keeps the existing value when the request does not send it. That is intended: only an ADMIN administers the people who administer the team.
- A broker's **own** ADMIN cannot demote themselves, so `test_the_last_active_admin_cannot_be_demoted` is driven by a **staff** admin. Self-deactivation (`DELETE`, i.e. `is_active=False`) remains available to everyone, still subject to the last-admin guard.
- A staff admin passes `_actor_may_grant_admin` and is never the target of rule (b) in practice (staff hold no `BrokerMembership`), so they remain the escape hatch for any organization that locks itself out.
- The `broker_admin_grant_requires_admin` error is keyed under `role` when the post-patch role is ADMIN and under `can_manage_team` otherwise, so a request that only sent `can_manage_team` gets its rejection back on the field it actually sent. Both serializers use the same rule; `test_a_manager_cannot_hand_out_can_manage_team` and `test_a_manager_cannot_grant_admin_to_a_third_party` pin the two branches.

**Note (ruling — the last-admin check must hold a lock):** `.exists()` is a read. Two concurrent requests demoting two *different* admins of a two-admin organization would each see the other still present, each conclude "another admin remains", and both commit — leaving zero admins and an organization nobody can administer. The check and the write must therefore happen inside one transaction that has already locked the rows it counts; `BrokerMemberDetailView` below does that with `transaction.atomic()` + `select_for_update()`. Serializer validation alone cannot make this safe.

`backend/brokers/views.py`:

```python
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsActiveUser, IsBrokerTeamManager, IsEmailVerified
from brokers.models import BrokerMembership, BrokerOrganization
from brokers.serializers import (
    BrokerMembershipCreateSerializer,
    BrokerMembershipSerializer,
    BrokerMembershipUpdateSerializer,
)


class BrokerTeamBaseView(APIView):
    permission_classes = [IsActiveUser, IsEmailVerified, IsBrokerTeamManager]

    def get_broker(self):
        return get_object_or_404(BrokerOrganization, pk=self.kwargs["broker_id"])

    def get_locked_broker(self):
        """Lock the broker row, then the membership rows the admin count reads.

        Locking the parent row first gives every team-mutating request on this
        broker a single serialization point, so the last-admin check below is a
        genuine check-then-act rather than two racing reads.
        """
        broker = get_object_or_404(
            BrokerOrganization.objects.select_for_update(), pk=self.kwargs["broker_id"]
        )
        list(
            BrokerMembership.objects.select_for_update()
            .filter(broker=broker)
            .values_list("pk", flat=True)
        )
        return broker

    def get_membership(self, broker):
        return get_object_or_404(
            BrokerMembership, pk=self.kwargs["membership_id"], broker=broker
        )


class BrokerMemberListView(BrokerTeamBaseView):
    def get(self, request, broker_id):
        broker = self.get_broker()
        memberships = BrokerMembership.objects.select_related("user").filter(broker=broker)
        return Response(BrokerMembershipSerializer(memberships, many=True).data)

    @transaction.atomic
    def post(self, request, broker_id):
        broker = self.get_locked_broker()
        serializer = BrokerMembershipCreateSerializer(
            data=request.data, context={"broker": broker, "actor": request.user}
        )
        serializer.is_valid(raise_exception=True)
        membership = serializer.save()
        return Response(
            BrokerMembershipSerializer(membership).data, status=status.HTTP_201_CREATED
        )


class BrokerMemberDetailView(BrokerTeamBaseView):
    @transaction.atomic
    def patch(self, request, broker_id, membership_id):
        membership = self.get_membership(self.get_locked_broker())
        serializer = BrokerMembershipUpdateSerializer(
            membership,
            data=request.data,
            partial=True,
            context={"actor": request.user},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        membership.refresh_from_db()
        return Response(BrokerMembershipSerializer(membership).data)

    @transaction.atomic
    def delete(self, request, broker_id, membership_id):
        membership = self.get_membership(self.get_locked_broker())
        serializer = BrokerMembershipUpdateSerializer(
            membership,
            data={"is_active": False},
            partial=True,
            context={"actor": request.user},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(status=status.HTTP_204_NO_CONTENT)
```

**Note (why `@transaction.atomic` on `post` too):** the create path also consults other rows — `_actor_may_grant_admin()` reads the acting user's own membership — and a membership created concurrently with a demotion should not be able to observe a half-applied state. Taking the same lock on every write to a broker's team keeps one ordering for all of them. `get` deliberately takes no lock: it is a plain read and must not block team edits.

**Note (`context={"actor": request.user}` is mandatory):** both write serializers read `self.context["actor"]` and will raise `KeyError` without it. That is intentional — a missing actor must fail loudly rather than silently skip the rank and self-edit checks. Any later phase reusing these serializers must pass the same context key.

`backend/brokers/urls.py`:

```python
from django.urls import path

from brokers.views import BrokerMemberDetailView, BrokerMemberListView

urlpatterns = [
    path(
        "brokers/<uuid:broker_id>/members/",
        BrokerMemberListView.as_view(),
        name="broker-members",
    ),
    path(
        "brokers/<uuid:broker_id>/members/<uuid:membership_id>/",
        BrokerMemberDetailView.as_view(),
        name="broker-member-detail",
    ),
]
```

Add the include to `backend/config/urls.py`, after the `accounts.urls` include:

```python
    path("api/v1/", include("brokers.urls")),
```

**Note (permission order matters):** DRF evaluates `permission_classes` in order and reports the first failure, so `IsActiveUser` → `IsEmailVerified` → `IsBrokerTeamManager` yields `not_authenticated`, then `email_not_verified`, then `not_broker_team_manager` — each distinguishable by the client. `IsBrokerTeamManager` resolves the broker through `active_broker_membership`, which requires `broker.status == ACTIVE`, so a suspended organization's team is frozen (spec §12 item 5) and a member of a different broker is rejected before any queryset is touched — no IDOR surface (spec §33.1).

**Note (404 not 403 for a foreign membership):** `get_membership` filters by `broker=broker`, so a membership id belonging to another organization is simply not found. That is deliberate: a 403 would confirm the id exists.

- [ ] **Step 7: Run the tests to verify they pass**

```bash
uv run pytest accounts/tests/test_account_api.py brokers/tests/test_team_api.py accounts/tests/test_auth_endpoints.py -v
```

Expected: all account, team and auth tests `PASS` — including `test_access_token_authenticates_a_protected_endpoint`, which is no longer `xfail`.

- [ ] **Step 8: Run the whole backend suite**

```bash
uv run pytest -v
```

Expected: every test from Tasks 1–9 plus the Phase 1 suite passes in one run.

- [ ] **Step 9: Commit**

```bash
git add backend/accounts backend/brokers backend/config/urls.py
git commit -m "feat(api): add own-account endpoint and broker team management"
```

---

### Task 10: Frontend — Vitest, typed API client, session provider and the login page

The Phase 0/1 plan deferred frontend test tooling "until the first real UI component with logic is built". Open-redirect-safe `next` URL handling is security logic, so the tooling arrives here.

**Files:**
- Modify: `frontend/package.json`, `.github/workflows/ci.yml`
- Create: `frontend/vitest.config.ts`, `frontend/vitest.setup.ts`
- Modify: `frontend/src/lib/api/client.ts`
- Create: `frontend/src/lib/auth/types.ts`, `frontend/src/lib/auth/next-url.ts`, `frontend/src/lib/auth/next-url.test.ts`, `frontend/src/lib/auth/session.tsx`, `frontend/src/lib/auth/session.test.tsx`
- Create: `frontend/src/app/login/page.tsx`, `frontend/src/app/login/page.test.tsx`, `frontend/src/app/verify-email/page.tsx`, `frontend/src/app/verify-email/page.test.tsx`
- Modify: `frontend/src/app/layout.tsx`

**Interfaces:**
- Consumes: `GET /api/v1/session/`, `POST /api/v1/auth/login/`, `POST /api/v1/auth/token/refresh/`, `POST /api/v1/auth/logout/`, `POST /api/v1/auth/verify-email/` (Tasks 3, 4, 8), and the §30.2 error envelope (Task 2). The refresh endpoint runs on the `auth-refresh` throttle scope (`30/min`), **not** the stricter `auth` scope used by login — see Task 4's ruling; the silent-refresh-on-every-mount behaviour below is exactly why those scopes are separate.
- Produces:
  - `@/lib/auth/types` — `PermissionKey`, `PermissionMap`, `SessionUser`, `BrokerMembershipSummary`, `ProfessionalProfileSummary`, `SessionPayload`. **These mirror `accounts.selectors.PERMISSION_KEYS` exactly**; adding a backend key without adding it here is a type error at build time.
  - `@/lib/api/client` — `apiFetch<T>(path, init?)`, `ApiError` (`status`, `code`, `message`, `fields`, `requestId`), `setAccessToken(token | null)`, `getAccessToken()`.
  - `@/lib/auth/next-url` — `isSafeNextUrl(value)`, `safeNextUrl(value, fallback?)`.
  - `@/lib/auth/session` — `SessionProvider`, `useSession()` → `{ session, loading, error, login, logout, reload, can }`.
  - Routes `/login` and `/verify-email`.

**Note (access token in memory only):** `setAccessToken` stores the access token in a module-scoped variable. It is never written to `localStorage`, `sessionStorage` or a non-`HttpOnly` cookie, so an XSS payload cannot read it out of storage, and a page reload simply re-derives a new one from the `HttpOnly` refresh cookie. This is the client half of Task 4's cookie decision.

- [ ] **Step 1: Install the test tooling**

```bash
cd frontend
pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

Add to `frontend/package.json`'s `"scripts"`:

```json
    "test": "vitest run"
```

`frontend/vitest.config.ts`:

```typescript
import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // Covers src/lib/**, src/components/** AND the page tests in src/app/**.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

`frontend/vitest.setup.ts`:

```typescript
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 2: Write the failing `next` URL tests**

`frontend/src/lib/auth/next-url.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { isSafeNextUrl, safeNextUrl } from "@/lib/auth/next-url";

describe("isSafeNextUrl", () => {
  it("accepts local absolute paths", () => {
    expect(isSafeNextUrl("/dashboard/broker/")).toBe(true);
    expect(isSafeNextUrl("/boats/?brand=azimut#specs")).toBe(true);
  });

  it("rejects absolute and protocol-relative URLs", () => {
    expect(isSafeNextUrl("https://evil.example/steal")).toBe(false);
    expect(isSafeNextUrl("//evil.example/steal")).toBe(false);
    expect(isSafeNextUrl("http:/evil.example")).toBe(false);
  });

  it("rejects backslash and control-character smuggling", () => {
    expect(isSafeNextUrl("/\\evil.example")).toBe(false);
    expect(isSafeNextUrl("\t//evil.example")).toBe(false);
    expect(isSafeNextUrl("\n/ok")).toBe(false);
    expect(isSafeNextUrl("javascript:alert(1)")).toBe(false);
  });

  it("rejects empty and missing values", () => {
    expect(isSafeNextUrl("")).toBe(false);
    expect(isSafeNextUrl(null)).toBe(false);
    expect(isSafeNextUrl(undefined)).toBe(false);
    expect(isSafeNextUrl("dashboard")).toBe(false);
  });
});

describe("safeNextUrl", () => {
  it("returns the value when safe and the fallback otherwise", () => {
    expect(safeNextUrl("/messages/")).toBe("/messages/");
    expect(safeNextUrl("https://evil.example")).toBe("/");
    expect(safeNextUrl(null, "/account/")).toBe("/account/");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
pnpm test
```

Expected: `Failed to resolve import "@/lib/auth/next-url"`.

- [ ] **Step 4: Implement the shared types and the `next` URL guard**

`frontend/src/lib/auth/types.ts`:

```typescript
export type PermissionKey =
  | "browse_public_content"
  | "submit_inquiry"
  | "reveal_contact_after_inquiry"
  | "reveal_any_contact"
  | "create_private_listing"
  | "create_broker_listing"
  | "create_listing_on_behalf"
  | "enable_listing_finance_flag"
  | "approve_listings_and_revisions"
  | "configure_broker_auto_approval"
  | "configure_products_and_settings"
  | "manage_taxonomy";

export type PermissionMap = Record<PermissionKey, boolean>;

export type UserRole =
  | "BUYER"
  | "PRIVATE_SELLER"
  | "BROKER"
  | "SERVICE_PROVIDER"
  | "STAFF";

export type LocaleCode = "EN" | "IT" | "ES";

export type EntityStatus = "DRAFT" | "PENDING" | "ACTIVE" | "SUSPENDED";

export type BrokerMembershipRole = "ADMIN" | "MANAGER" | "AGENT" | "VIEWER";

export interface SessionUser {
  id: string;
  email: string;
  full_name: string;
  primary_role: UserRole;
  locale: LocaleCode;
  email_verified: boolean;
  is_active: boolean;
}

export interface BrokerMembershipSummary {
  broker_id: string;
  broker_name: string;
  broker_slug: string;
  broker_status: EntityStatus;
  role: BrokerMembershipRole;
  can_edit_listings: boolean;
  can_manage_team: boolean;
  can_read_messages: boolean;
}

export interface ProfessionalProfileSummary {
  id: string;
  slug: string;
  display_name: string;
  status: EntityStatus;
}

export interface SessionPayload {
  authenticated: boolean;
  user: SessionUser | null;
  locale: LocaleCode;
  permissions: PermissionMap;
  broker_memberships: BrokerMembershipSummary[];
  professional_profile: ProfessionalProfileSummary | null;
  staff: { is_staff_moderator: boolean; is_staff_admin: boolean };
}

export interface LoginResponse {
  access: string;
  user: SessionUser;
}
```

`frontend/src/lib/auth/next-url.ts`:

```typescript
/**
 * Allowlist local return URLs; prevent open redirects (spec 33.1).
 * Only a single-slash absolute path on this origin is accepted.
 */
export function isSafeNextUrl(value: string | null | undefined): boolean {
  if (typeof value !== "string" || value.length === 0) return false;
  // Control characters are rejected outright rather than stripped: a value that
  // needs cleaning to look safe is not a value we want to redirect to.
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code <= 0x20 || code === 0x7f) return false;
  }
  if (!value.startsWith("/")) return false;
  if (value.startsWith("//")) return false;
  if (value.startsWith("/\\")) return false;
  return true;
}

export function safeNextUrl(
  value: string | null | undefined,
  fallback = "/",
): string {
  return isSafeNextUrl(value) ? (value as string) : fallback;
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
pnpm test
```

Expected: 5 `next-url` tests `PASS`.

- [ ] **Step 6: Rewrite the API client**

Replace `frontend/src/lib/api/client.ts` entirely:

```typescript
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8020";

const REFRESH_PATH = "/api/v1/auth/token/refresh/";

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string[]>;
  readonly requestId: string;

  constructor(
    status: number,
    code: string,
    message: string,
    fields: Record<string, string[]> = {},
    requestId = "",
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.requestId = requestId;
  }
}

interface ErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
    fields?: Record<string, string[]>;
    request_id?: string;
  };
}

async function toApiError(response: Response): Promise<ApiError> {
  let body: ErrorEnvelope = {};
  try {
    body = (await response.json()) as ErrorEnvelope;
  } catch {
    // A non-JSON error body (proxy/gateway failure) still becomes an ApiError.
  }
  const envelope = body.error ?? {};
  return new ApiError(
    response.status,
    envelope.code ?? "unexpected_error",
    envelope.message ?? `Request failed with status ${response.status}.`,
    envelope.fields ?? {},
    envelope.request_id ?? response.headers.get("X-Request-ID") ?? "",
  );
}

async function rawFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
}

/**
 * Exchange the HttpOnly refresh cookie for a fresh access token.
 * Returns false (without throwing) when there is no usable session.
 */
export async function tryRefreshAccessToken(): Promise<boolean> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${REFRESH_PATH}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: "{}",
    });
  } catch {
    accessToken = null;
    return false;
  }
  if (!response.ok) {
    accessToken = null;
    return false;
  }
  const data = (await response.json()) as { access: string };
  accessToken = data.access;
  return true;
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  let response = await rawFetch(path, init);

  if (response.status === 401 && path !== REFRESH_PATH) {
    const refreshed = await tryRefreshAccessToken();
    if (refreshed) {
      response = await rawFetch(path, init);
    }
  }

  if (!response.ok) {
    throw await toApiError(response);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}
```

**Note (single retry):** the refresh attempt is guarded by `path !== REFRESH_PATH` and is not itself retried, so a dead session produces exactly two requests and then an `ApiError` — no loop. `credentials: "include"` is required on every call so the browser attaches the `HttpOnly` refresh cookie to the refresh request; the backend's `CORS_ALLOW_CREDENTIALS = True` and explicit origin allowlist (Task 4) make that legal.

- [ ] **Step 7: Write the failing session-provider test**

`frontend/src/lib/auth/session.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setAccessToken } from "@/lib/api/client";
import { SessionProvider, useSession } from "@/lib/auth/session";
import type { PermissionMap, SessionPayload } from "@/lib/auth/types";

const ALL_FALSE: PermissionMap = {
  browse_public_content: true,
  submit_inquiry: false,
  reveal_contact_after_inquiry: false,
  reveal_any_contact: false,
  create_private_listing: false,
  create_broker_listing: false,
  create_listing_on_behalf: false,
  enable_listing_finance_flag: false,
  approve_listings_and_revisions: false,
  configure_broker_auto_approval: false,
  configure_products_and_settings: false,
  manage_taxonomy: false,
};

function payload(overrides: Partial<SessionPayload> = {}): SessionPayload {
  return {
    authenticated: false,
    user: null,
    locale: "EN",
    permissions: ALL_FALSE,
    broker_memberships: [],
    professional_profile: null,
    staff: { is_staff_moderator: false, is_staff_admin: false },
    ...overrides,
  };
}

function Probe() {
  const { session, loading, can } = useSession();
  if (loading) return <p>loading</p>;
  return (
    <div>
      <span data-testid="email">{session?.user?.email ?? "guest"}</span>
      <span data-testid="can-sell">
        {String(can("create_private_listing"))}
      </span>
    </div>
  );
}

afterEach(() => {
  // The access token is module state in the API client; reset it between tests.
  setAccessToken(null);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mockSession(body: SessionPayload, { refreshOk = false } = {}) {
  // The provider tries the refresh endpoint first, then the session endpoint.
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/auth/token/refresh/")) {
        return refreshOk
          ? new Response(JSON.stringify({ access: "test-access-token" }), {
              status: 200,
            })
          : new Response(
              JSON.stringify({ error: { code: "token_not_valid" } }),
              { status: 401 },
            );
      }
      return new Response(JSON.stringify(body), { status: 200 });
    }),
  );
}

describe("SessionProvider", () => {
  it("exposes the guest session", async () => {
    mockSession(payload());
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("email")).toHaveTextContent("guest"),
    );
    expect(screen.getByTestId("can-sell")).toHaveTextContent("false");
  });

  it("restores an authenticated session from the refresh cookie on reload", async () => {
    mockSession(
      payload({
        authenticated: true,
        user: {
          id: "11111111-1111-1111-1111-111111111111",
          email: "seller@example.com",
          full_name: "Sea Seller",
          primary_role: "PRIVATE_SELLER",
          locale: "EN",
          email_verified: true,
          is_active: true,
        },
        permissions: { ...ALL_FALSE, create_private_listing: true },
      }),
      { refreshOk: true },
    );
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("email")).toHaveTextContent("seller@example.com"),
    );
    expect(screen.getByTestId("can-sell")).toHaveTextContent("true");
  });

  it("falls back to a guest session when the API is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("email")).toHaveTextContent("guest"),
    );
  });
});
```

- [ ] **Step 8: Implement the session provider**

`frontend/src/lib/auth/session.tsx`:

```tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ApiError,
  apiFetch,
  getAccessToken,
  setAccessToken,
  tryRefreshAccessToken,
} from "@/lib/api/client";
import type {
  LoginResponse,
  PermissionKey,
  SessionPayload,
} from "@/lib/auth/types";

interface SessionContextValue {
  session: SessionPayload | null;
  loading: boolean;
  error: string | null;
  can: (permission: PermissionKey) => boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setSession(await apiFetch<SessionPayload>("/api/v1/session/"));
      setError(null);
    } catch (caught) {
      // An unreachable or unauthenticated API means "no session", never a crash.
      setSession(null);
      setError(caught instanceof ApiError ? caught.message : null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // On a fresh page load the access token is gone (it lives in memory only),
    // but the HttpOnly refresh cookie may still be valid — so trade it for a new
    // access token BEFORE asking for the session, otherwise a signed-in user
    // would briefly render as a guest.
    async function bootstrap() {
      if (getAccessToken() === null) {
        await tryRefreshAccessToken();
      }
      await reload();
    }
    void bootstrap();
  }, [reload]);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await apiFetch<LoginResponse>("/api/v1/auth/login/", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setAccessToken(response.access);
      await reload();
    },
    [reload],
  );

  const logout = useCallback(async () => {
    try {
      await apiFetch<void>("/api/v1/auth/logout/", {
        method: "POST",
        body: "{}",
      });
    } finally {
      setAccessToken(null);
      await reload();
    }
  }, [reload]);

  const can = useCallback(
    (permission: PermissionKey) => session?.permissions?.[permission] === true,
    [session],
  );

  const value = useMemo(
    () => ({ session, loading, error, can, login, logout, reload }),
    [session, loading, error, can, login, logout, reload],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (context === null) {
    throw new Error("useSession must be used inside a SessionProvider.");
  }
  return context;
}
```

**Note (`can()` is a hint, not a gate):** it reads the server-computed map from Task 8 and is used only to decide what to render. Spec §12 is explicit that hiding a link is not enforcement; the backend rejects the request regardless.

- [ ] **Step 9: Build the login and verify-email pages**

`frontend/src/app/login/page.tsx`:

```tsx
"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ApiError } from "@/lib/api/client";
import { safeNextUrl } from "@/lib/auth/next-url";
import { useSession } from "@/lib/auth/session";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const destination = safeNextUrl(searchParams.get("next"));

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
      router.replace(destination);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Sign-in failed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-space-md">
      <h1 className="font-headline-md text-headline-md text-primary">Sign in</h1>
      <label className="block font-label-md text-label-md" htmlFor="email">
        Email
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-space-xs w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-space-sm font-body-md"
        />
      </label>
      <label className="block font-label-md text-label-md" htmlFor="password">
        Password
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-space-xs w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-space-sm font-body-md"
        />
      </label>
      {error ? (
        <p role="alert" className="font-body-sm text-error">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-primary p-space-sm font-label-md text-label-md text-on-primary disabled:opacity-50"
      >
        {submitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-space-lg">
      <Suspense fallback={<p className="font-body-md">Loading…</p>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
```

**Note (`Suspense`):** `useSearchParams()` opts a route into client-side rendering in the Next.js App Router and `next build` fails the page unless it sits inside a `Suspense` boundary. The boundary is the reason the form is a separate component.

`frontend/src/app/verify-email/page.tsx`:

```tsx
"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { ApiError, apiFetch } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";

type VerifyState = "pending" | "done" | "failed";

function VerifyEmail() {
  const searchParams = useSearchParams();
  const { reload } = useSession();
  const [state, setState] = useState<VerifyState>("pending");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setState("failed");
      setMessage("This verification link is missing its token.");
      return;
    }
    apiFetch<unknown>("/api/v1/auth/verify-email/", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
      .then(async () => {
        setState("done");
        await reload();
      })
      .catch((caught: unknown) => {
        setState("failed");
        setMessage(
          caught instanceof ApiError
            ? "This verification link is invalid or has already been used."
            : "Verification could not be completed. Please try again.",
        );
      });
  }, [searchParams, reload]);

  if (state === "pending") return <p className="font-body-md">Verifying…</p>;
  if (state === "done") {
    return (
      <p className="font-body-md text-on-surface">
        Your email address is verified. You can now send inquiries and publish
        listings.
      </p>
    );
  }
  return (
    <p role="alert" className="font-body-md text-error">
      {message}
    </p>
  );
}

export default function VerifyEmailPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-space-lg">
      <Suspense fallback={<p className="font-body-md">Loading…</p>}>
        <VerifyEmail />
      </Suspense>
    </main>
  );
}
```

**Both pages need rendered-behaviour tests.** Unit-testing `isSafeNextUrl`/`safeNextUrl` proves the helper is correct; it proves nothing about whether the login page actually *calls* it, or routes to its result. The redirect-after-login path is security-relevant (it is the whole reason `safeNextUrl` exists), and `verify-email`'s success/failure branching is the only place the user learns whether verification worked. Neither has a test without these.

`frontend/src/app/login/page.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LoginPage from "./page";

const replaceMock = vi.fn();
const loginMock = vi.fn();
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
  useSearchParams: () => searchParams,
}));

vi.mock("@/lib/auth/session", () => ({
  useSession: () => ({ login: loginMock }),
}));

beforeEach(() => {
  replaceMock.mockReset();
  loginMock.mockReset().mockResolvedValue(undefined);
  searchParams = new URLSearchParams();
});

async function submit() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/email/i), "pilot@example.com");
  await user.type(screen.getByLabelText(/password/i), "n4uta-test-Passw0rd");
  await user.click(screen.getByRole("button", { name: /sign in/i }));
}

describe("LoginPage", () => {
  it("signs in and redirects to the default destination", async () => {
    render(<LoginPage />);
    await submit();

    expect(loginMock).toHaveBeenCalledWith("pilot@example.com", "n4uta-test-Passw0rd");
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/"));
  });

  it("honours a safe ?next= destination", async () => {
    searchParams = new URLSearchParams("next=/account/");
    render(<LoginPage />);
    await submit();

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/account/"));
  });

  it("refuses an off-site ?next= and falls back to the root", async () => {
    // The security-relevant case: the page must route through safeNextUrl(),
    // not straight to searchParams.get("next").
    searchParams = new URLSearchParams("next=https://evil.example.com/steal");
    render(<LoginPage />);
    await submit();

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/"));
    expect(replaceMock).not.toHaveBeenCalledWith(
      expect.stringContaining("evil.example.com"),
    );
  });

  it("shows the server's message and does not redirect when sign-in fails", async () => {
    const { ApiError } = await import("@/lib/api/client");
    loginMock.mockRejectedValue(
      new ApiError("no_active_account", "No active account found.", {}, "req-1", 401),
    );
    render(<LoginPage />);
    await submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No active account found.",
    );
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
```

**Note:** construct the `ApiError` in that last test with whatever signature Step 6's client actually defines — if the shape differs, match it rather than changing the client to suit the test.

`frontend/src/app/verify-email/page.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import VerifyEmailPage from "./page";

const apiFetchMock = vi.fn();
const reloadMock = vi.fn();
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
}));

vi.mock("@/lib/auth/session", () => ({
  useSession: () => ({ reload: reloadMock }),
}));

vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>(
    "@/lib/api/client",
  );
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetchMock(...args) };
});

beforeEach(() => {
  apiFetchMock.mockReset();
  reloadMock.mockReset().mockResolvedValue(undefined);
  searchParams = new URLSearchParams();
});

describe("VerifyEmailPage", () => {
  it("confirms success and refreshes the session", async () => {
    searchParams = new URLSearchParams("token=a-valid-token");
    apiFetchMock.mockResolvedValue({});

    render(<VerifyEmailPage />);

    expect(await screen.findByText(/your email address is verified/i)).toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/v1/auth/verify-email/",
      expect.objectContaining({ method: "POST" }),
    );
    expect(reloadMock).toHaveBeenCalled();
  });

  it("reports an invalid or already-used token", async () => {
    const { ApiError } = await import("@/lib/api/client");
    searchParams = new URLSearchParams("token=spent-token");
    apiFetchMock.mockRejectedValue(
      new ApiError("validation_error", "The submitted data is invalid.", {}, "req-2", 400),
    );

    render(<VerifyEmailPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /invalid or has already been used/i,
    );
    expect(reloadMock).not.toHaveBeenCalled();
  });

  it("reports a link with no token at all, without calling the API", async () => {
    render(<VerifyEmailPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/missing its token/i);
    expect(apiFetchMock).not.toHaveBeenCalled();
  });
});
```

Add `frontend/src/app/login/page.test.tsx` and `frontend/src/app/verify-email/page.test.tsx` to this task's **Files → Create** list, and confirm `vitest.config.ts`'s `include` glob covers `src/**/*.test.tsx` (not just `src/lib/**`).

- [ ] **Step 10: Wrap the app in the session provider**

In `frontend/src/app/layout.tsx`, import the provider and wrap `{children}` (keep the existing fonts, metadata and body classes exactly as Phase 0/1 wrote them):

```tsx
import { SessionProvider } from "@/lib/auth/session";
```

```tsx
      <body
        className={`${playfairDisplay.variable} ${plusJakartaSans.variable} bg-surface text-on-surface antialiased`}
      >
        <SessionProvider>{children}</SessionProvider>
      </body>
```

- [ ] **Step 11: Run the tests and the build**

```bash
pnpm test
pnpm lint
pnpm build
```

Expected: all `next-url`, `SessionProvider`, `LoginPage` and `VerifyEmailPage` tests `PASS`; lint clean; build succeeds. If `pnpm test` reports zero tests collected from `src/app/`, the `include` glob in `vitest.config.ts` is wrong — fix the config, not the test locations.

- [ ] **Step 12: Add the frontend test step to CI**

In `.github/workflows/ci.yml`, insert a step in the `frontend` job between "Lint" and "Build":

```yaml
      - name: Test
        if: steps.check.outputs.exists == 'true'
        working-directory: frontend
        run: pnpm test
```

- [ ] **Step 13: Manual end-to-end verification**

With Docker Compose, a Celery worker, `runserver 8020` and `pnpm next dev -p 3020` all running:

1. Open `http://localhost:3020/login?next=/account/` and sign in with the account registered in Task 3 — expect a redirect to `/account/`.
2. Open `http://localhost:3020/login?next=https://example.com/` and sign in — expect a redirect to `/`, **not** to `example.com`.
3. In DevTools → Application → Cookies, confirm `nauta_refresh` is present with `HttpOnly` ticked, and that `localStorage` and `sessionStorage` are empty.
4. Reload the page and confirm you are still signed in — the Network tab shows `POST /api/v1/auth/token/refresh/` (200) *before* `GET /api/v1/session/`, because the provider trades the refresh cookie for a new in-memory access token on mount. There must be no flash of guest navigation.
5. Click sign out, then reload — the refresh call now returns 401, the session renders as a guest, and `nauta_refresh` is gone.
6. Reload the signed-in page **fifteen times in a row**. Every `POST /api/v1/auth/token/refresh/` must return 200 — none may return 429 — and signing in again afterwards must still work. This is the observable proof that refresh sits on its own `auth-refresh` scope (`30/min`) rather than sharing login's `auth` budget (`10/min`); on the shared scope the eleventh reload would lock the browser out of logging in (Task 4's ruling).

- [ ] **Step 14: Commit**

```bash
cd ..
git add frontend .github/workflows/ci.yml
git commit -m "feat(frontend): add vitest, typed api client, session provider and login"
```

---

### Task 11: Frontend — route guard, 403 screen and permission-derived navigation

Spec §12's frontend requirements in full: navigation derived from the session/permissions endpoint, unauthorized links hidden (but direct access still rejected server-side), a clear 403 screen for permission failures, and a 401 redirect carrying a safe `next` URL.

**Files:**
- Create: `frontend/src/components/auth/ForbiddenScreen.tsx`, `frontend/src/components/auth/RequirePermission.tsx`, `frontend/src/components/auth/RequirePermission.test.tsx`
- Create: `frontend/src/components/layout/PrimaryNav.tsx`, `frontend/src/components/layout/PrimaryNav.test.tsx`
- Create: `frontend/src/app/403/page.tsx`
- Modify: `frontend/src/app/layout.tsx`

**Interfaces:**
- Consumes: `useSession()`, `PermissionKey`, `safeNextUrl` (Task 10).
- Produces:
  - `<ForbiddenScreen reason?: string />` — the shared 403 surface.
  - `<RequirePermission permission={PermissionKey}>…</RequirePermission>` — renders children only when the session grants that permission; redirects a guest to `/login?next=<current path>`; renders `<ForbiddenScreen />` for a signed-in user who lacks it.
  - `<PrimaryNav />` — the navigation whose private links come exclusively from `session.permissions`.
  - Route `/403`.

**Note (client guard ≠ authorization):** `RequirePermission` exists to avoid rendering a link or a form the backend would reject, and to give the user a comprehensible screen instead of a raw API error. Every route it wraps is still enforced by the Task 7 permission classes on the server. This is precisely spec §12's "unauthorized links are hidden, but direct route access is still rejected by the backend", and spec §2.2's rule that frontend hiding "never enforce[s] business rules".

- [ ] **Step 1: Write the failing guard tests**

`frontend/src/components/auth/RequirePermission.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import RequirePermission from "@/components/auth/RequirePermission";
import type { PermissionMap, SessionPayload } from "@/lib/auth/types";

// vi.mock factories are hoisted above the module body, so anything they close
// over must be created with vi.hoisted() or it is still in the temporal dead
// zone when the mocked module is first imported.
const { replace, useSessionMock } = vi.hoisted(() => ({
  replace: vi.fn(),
  useSessionMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => "/dashboard/private-seller/",
}));

vi.mock("@/lib/auth/session", () => ({
  useSession: () => useSessionMock(),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

const ALL_FALSE: PermissionMap = {
  browse_public_content: true,
  submit_inquiry: false,
  reveal_contact_after_inquiry: false,
  reveal_any_contact: false,
  create_private_listing: false,
  create_broker_listing: false,
  create_listing_on_behalf: false,
  enable_listing_finance_flag: false,
  approve_listings_and_revisions: false,
  configure_broker_auto_approval: false,
  configure_products_and_settings: false,
  manage_taxonomy: false,
};

function session(overrides: Partial<SessionPayload> = {}): SessionPayload {
  return {
    authenticated: false,
    user: null,
    locale: "EN",
    permissions: ALL_FALSE,
    broker_memberships: [],
    professional_profile: null,
    staff: { is_staff_moderator: false, is_staff_admin: false },
    ...overrides,
  };
}

function mockSession(value: SessionPayload | null, loading = false) {
  useSessionMock.mockReturnValue({
    session: value,
    loading,
    error: null,
    can: (key: keyof PermissionMap) => value?.permissions?.[key] === true,
    login: vi.fn(),
    logout: vi.fn(),
    reload: vi.fn(),
  });
}

afterEach(() => {
  replace.mockClear();
  useSessionMock.mockReset();
});

describe("RequirePermission", () => {
  it("renders nothing decisive while the session is loading", () => {
    mockSession(null, true);
    render(
      <RequirePermission permission="create_private_listing">
        <p>secret</p>
      </RequirePermission>,
    );
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("redirects a guest to login with a safe next url", async () => {
    mockSession(session());
    render(
      <RequirePermission permission="create_private_listing">
        <p>secret</p>
      </RequirePermission>,
    );
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(
        "/login?next=%2Fdashboard%2Fprivate-seller%2F",
      ),
    );
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
  });

  it("shows the 403 screen to a signed-in user without the permission", () => {
    mockSession(
      session({
        authenticated: true,
        user: {
          id: "1",
          email: "buyer@example.com",
          full_name: "",
          primary_role: "BUYER",
          locale: "EN",
          email_verified: true,
          is_active: true,
        },
      }),
    );
    render(
      <RequirePermission permission="create_private_listing">
        <p>secret</p>
      </RequirePermission>,
    );
    expect(screen.getByRole("heading", { name: /access denied/i })).toBeInTheDocument();
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("renders children when the permission is granted", () => {
    mockSession(
      session({
        authenticated: true,
        user: {
          id: "1",
          email: "seller@example.com",
          full_name: "",
          primary_role: "PRIVATE_SELLER",
          locale: "EN",
          email_verified: true,
          is_active: true,
        },
        permissions: { ...ALL_FALSE, create_private_listing: true },
      }),
    );
    render(
      <RequirePermission permission="create_private_listing">
        <p>secret</p>
      </RequirePermission>,
    );
    expect(screen.getByText("secret")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Write the failing navigation tests**

`frontend/src/components/layout/PrimaryNav.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import PrimaryNav from "@/components/layout/PrimaryNav";
import type { PermissionMap, SessionPayload } from "@/lib/auth/types";

const { useSessionMock } = vi.hoisted(() => ({ useSessionMock: vi.fn() }));

vi.mock("@/lib/auth/session", () => ({
  useSession: () => useSessionMock(),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

const ALL_FALSE: PermissionMap = {
  browse_public_content: true,
  submit_inquiry: false,
  reveal_contact_after_inquiry: false,
  reveal_any_contact: false,
  create_private_listing: false,
  create_broker_listing: false,
  create_listing_on_behalf: false,
  enable_listing_finance_flag: false,
  approve_listings_and_revisions: false,
  configure_broker_auto_approval: false,
  configure_products_and_settings: false,
  manage_taxonomy: false,
};

function mockSession(permissions: PermissionMap, authenticated = true) {
  const value: SessionPayload = {
    authenticated,
    user: authenticated
      ? {
          id: "1",
          email: "nav@example.com",
          full_name: "Nav User",
          primary_role: "BUYER",
          locale: "EN",
          email_verified: true,
          is_active: true,
        }
      : null,
    locale: "EN",
    permissions,
    broker_memberships: [],
    professional_profile: null,
    staff: { is_staff_moderator: false, is_staff_admin: false },
  };
  useSessionMock.mockReturnValue({
    session: value,
    loading: false,
    error: null,
    can: (key: keyof PermissionMap) => permissions[key] === true,
    login: vi.fn(),
    logout: vi.fn(),
    reload: vi.fn(),
  });
}

afterEach(() => useSessionMock.mockReset());

describe("PrimaryNav", () => {
  it("shows only public links to a guest", () => {
    mockSession(ALL_FALSE, false);
    render(<PrimaryNav />);
    expect(screen.getByRole("link", { name: "Boats" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Moderation" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
  });

  it("links to no page that does not exist yet", () => {
    // Every permission granted: the nav must STILL not offer /sell/ or /fleet/,
    // because Phase 11/16 have not built those pages. See the note in Step 6.
    mockSession(
      Object.fromEntries(
        Object.keys(ALL_FALSE).map((key) => [key, true]),
      ) as PermissionMap,
    );
    render(<PrimaryNav />);
    expect(screen.queryByRole("link", { name: "Sell" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Fleet" })).not.toBeInTheDocument();
  });

  it("shows the moderation link only to approvers", () => {
    mockSession({ ...ALL_FALSE, approve_listings_and_revisions: true });
    render(<PrimaryNav />);
    expect(screen.getByRole("link", { name: "Moderation" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();
  });

  it("shows the settings link only to staff admins", () => {
    mockSession({ ...ALL_FALSE, configure_products_and_settings: true });
    render(<PrimaryNav />);
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
cd frontend
pnpm test
```

Expected: `Failed to resolve import "@/components/auth/RequirePermission"` and the same for `PrimaryNav`.

- [ ] **Step 4: Implement the 403 screen**

`frontend/src/components/auth/ForbiddenScreen.tsx`:

```tsx
import Link from "next/link";

export default function ForbiddenScreen({ reason }: { reason?: string }) {
  return (
    <section
      role="alert"
      className="mx-auto flex max-w-md flex-col items-start gap-space-md p-space-lg"
    >
      <h1 className="font-headline-md text-headline-md text-primary">
        Access denied
      </h1>
      <p className="font-body-md text-on-surface-variant">
        {reason ??
          "Your account does not have permission to open this page. If you believe this is a mistake, contact the account administrator."}
      </p>
      <Link
        href="/"
        className="rounded-lg bg-primary px-space-md py-space-sm font-label-md text-label-md text-on-primary"
      >
        Back to NAUTA
      </Link>
    </section>
  );
}
```

`frontend/src/app/403/page.tsx`:

```tsx
import ForbiddenScreen from "@/components/auth/ForbiddenScreen";

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <ForbiddenScreen />
    </main>
  );
}
```

- [ ] **Step 5: Implement the route guard**

`frontend/src/components/auth/RequirePermission.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import ForbiddenScreen from "@/components/auth/ForbiddenScreen";
import { safeNextUrl } from "@/lib/auth/next-url";
import { useSession } from "@/lib/auth/session";
import type { PermissionKey } from "@/lib/auth/types";

interface Props {
  permission: PermissionKey;
  children: React.ReactNode;
}

export default function RequirePermission({ permission, children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, loading, can } = useSession();

  const authenticated = session?.authenticated === true;
  const allowed = can(permission);

  useEffect(() => {
    if (loading || authenticated) return;
    const next = encodeURIComponent(safeNextUrl(pathname));
    router.replace(`/login?next=${next}`);
  }, [loading, authenticated, pathname, router]);

  if (loading) {
    return (
      <p className="p-space-lg font-body-md text-on-surface-variant" aria-busy="true">
        Loading…
      </p>
    );
  }
  if (!authenticated) return null;
  if (!allowed) return <ForbiddenScreen />;
  return <>{children}</>;
}
```

**Note (why the redirect lives in an effect):** calling `router.replace` during render is a React side effect in the render phase and Next.js warns about it. The effect also lets the "loading" state render first, so a slow session fetch never bounces a signed-in user to `/login`. `safeNextUrl(pathname)` runs even though `pathname` is browser-provided — defence in depth costs nothing here.

- [ ] **Step 6: Implement the permission-derived navigation**

`frontend/src/components/layout/PrimaryNav.tsx`:

```tsx
"use client";

import Link from "next/link";

import { useSession } from "@/lib/auth/session";
import type { PermissionKey } from "@/lib/auth/types";

interface NavLink {
  href: string;
  label: string;
  permission?: PermissionKey;
}

// Public routes come from spec 4.1; the gated ones from spec 5's capability table.
const LINKS: NavLink[] = [
  { href: "/boats/", label: "Boats" },
  { href: "/brokers/", label: "Brokers" },
  { href: "/services/professionals/", label: "Services / Professionals" },
  { href: "/financing/", label: "Financing" },
  // NOTE: /sell/ (create_private_listing) and /fleet/ (create_broker_listing)
  // are deliberately ABSENT until Phase 11/16 build those pages. See the note below.
  {
    href: "/dashboard/staff/",
    label: "Moderation",
    permission: "approve_listings_and_revisions",
  },
  {
    href: "/settings/",
    label: "Settings",
    permission: "configure_products_and_settings",
  },
];

export default function PrimaryNav() {
  const { session, loading, can, logout } = useSession();
  const authenticated = session?.authenticated === true;

  const visible = LINKS.filter(
    (link) => link.permission === undefined || can(link.permission),
  );

  return (
    <nav
      aria-label="Primary"
      className="flex flex-wrap items-center gap-space-md border-b border-outline-variant bg-surface px-margin-mobile py-space-sm md:px-margin"
    >
      <Link href="/" className="font-title-lg text-title-lg text-primary">
        NAUTA
      </Link>
      <ul className="flex flex-wrap items-center gap-space-md">
        {visible.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="font-body-md text-on-surface-variant hover:text-primary"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
      <div className="ml-auto flex items-center gap-space-sm">
        {loading ? null : authenticated ? (
          <>
            <Link
              href="/account/"
              className="font-body-sm text-on-surface-variant hover:text-primary"
            >
              {session?.user?.full_name || session?.user?.email}
            </Link>
            <button
              type="button"
              onClick={() => void logout()}
              className="font-label-md text-label-md text-primary"
            >
              Sign out
            </button>
          </>
        ) : (
          <Link
            href="/login"
            className="font-label-md text-label-md text-primary"
          >
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}
```

**Note (the link set is intentionally partial — and that rule has no exceptions):** only routes that actually exist are listed. Spec §2.1 forbids shipping UI with no backend behind it, so links to `/messages/`, `/leads/`, `/team/`, `/taxonomy/`, `/sell/`, `/fleet/` and the rest of spec §4.2 are added by the phases that build those pages — each adding one entry to `LINKS` with the permission key that gates it.

`/sell/` and `/fleet/` are **excluded for exactly the same reason as the others**, and an earlier draft of this plan was inconsistent in including them. Neither page exists before Phase 11 (listings) / Phase 16 (broker fleet). Between Phase 3 shipping and those phases shipping, every private seller and every broker who signed in would see a nav link that 404s — a visible broken promise, and precisely the failure §2.1 exists to prevent. The permission keys `create_private_listing` and `create_broker_listing` still ship in this phase's session payload and are fully tested at the API level (Task 8); only the *links* wait. **Phase 11 adds `{ href: "/sell/", label: "Sell", permission: "create_private_listing" }` and Phase 16 adds `{ href: "/fleet/", label: "Fleet", permission: "create_broker_listing" }`** in the same commit that creates each page.

The `RequirePermission` guard (Step 5) and `ForbiddenScreen` are unaffected: they gate pages, not links, and are exercised here by `/dashboard/staff/` and `/settings/`, which do exist.

- [ ] **Step 7: Mount the navigation in the layout**

In `frontend/src/app/layout.tsx`, render the nav inside the provider:

```tsx
import PrimaryNav from "@/components/layout/PrimaryNav";
import { SessionProvider } from "@/lib/auth/session";
```

```tsx
        <SessionProvider>
          <PrimaryNav />
          {children}
        </SessionProvider>
```

- [ ] **Step 8: Run the tests, lint and build**

```bash
pnpm test
pnpm lint
pnpm build
```

Expected: the 4 guard tests and 4 navigation tests `PASS` alongside Task 10's; lint clean; build succeeds.

- [ ] **Step 9: Manual verification of the three spec §12 frontend requirements**

With the full stack running:

1. Signed out, open `http://localhost:3020/403` — the Access denied screen renders.
2. Sign in as the **buyer** from Task 3 and confirm the nav shows no `Sell`, `Fleet`, `Moderation` or `Settings` link.
3. In Django admin, set that user's `primary_role` to `Private seller`, reload the frontend, and confirm `Sell` appears — proving the nav is driven by the server's permission map and not by a hard-coded client rule (spec §2.1).
4. Sign in as a broker agent whose membership has `can_edit_listings = false` and confirm `Fleet` is hidden; grant the flag in admin, reload, and confirm it appears.
5. Add `staff_moderator` to a `STAFF` user and confirm `Moderation` appears but `Settings` does not; swap the group for `staff_admin` and confirm both appear.

- [ ] **Step 10: Commit**

```bash
cd ..
git add frontend
git commit -m "feat(frontend): add permission route guard, 403 screen and derived navigation"
```

---

### Task 12: Phase 3 acceptance tests, full-stack verification and handoff note

Spec §12 lists four acceptance tests by name and §39 requires each phase to "demonstrate the phase definition of done with verifiable test output" plus a written handoff note. This task collects the four into one file that names them explicitly, so a reviewer can map each spec line to a passing test.

**Files:**
- Test: `backend/accounts/tests/test_phase3_acceptance.py`
- Modify: `ACTIVITY.md`

**Interfaces:** none new — this task only proves the previous eleven work together and records that fact.

- [ ] **Step 1: Write the four acceptance tests**

`backend/accounts/tests/test_phase3_acceptance.py`:

```python
"""Spec 12 acceptance tests for Phase 3, one test per named requirement."""

import pytest
from django.contrib.admin.sites import AdminSite
from django.contrib.auth.models import Group
from django.test import RequestFactory
from rest_framework.exceptions import PermissionDenied
from rest_framework.test import APIClient

from accounts.enums import StaffGroup, UserRole
from accounts.permissions import IsStaffAdmin
from accounts.selectors import get_session_permissions
from accounts.services import can_edit_owned_object, resolve_seller_context
from accounts.tests.factories import DEFAULT_TEST_PASSWORD, make_user
from brokers.admin import BrokerOrganizationAdmin
from brokers.enums import BrokerMembershipRole
from brokers.models import BrokerMembership, BrokerOrganization
from brokers.tests.factories import make_broker, make_membership

LOGIN_URL = "/api/v1/auth/login/"
ACCOUNT_URL = "/api/v1/account/"


@pytest.fixture
def api():
    return APIClient()


def _authenticate(api, user):
    response = api.post(
        LOGIN_URL, {"email": user.email, "password": DEFAULT_TEST_PASSWORD}, format="json"
    )
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
    return response.data["access"]


@pytest.mark.django_db
def test_acceptance_a_broker_agent_cannot_edit_another_brokers_records(api):
    """Spec 12: 'A broker agent cannot edit another broker's listing.'"""
    agent = make_user("agent-a@example.com", role=UserRole.BROKER)
    broker_a = make_broker(name="Broker A", slug="broker-a")
    broker_b = make_broker(name="Broker B", slug="broker-b")
    make_membership(
        agent, broker_a, role=BrokerMembershipRole.ADMIN
    )  # full authority inside A
    victim = make_user("victim@example.com", role=UserRole.BROKER)
    foreign_membership = make_membership(victim, broker_b, can_edit_listings=True)

    # Ownership service: the authority Phase 11's listing endpoints will consult.
    assert can_edit_owned_object(agent, owner_user_id=None, broker_id=broker_a.pk) is True
    assert can_edit_owned_object(agent, owner_user_id=None, broker_id=broker_b.pk) is False

    # And over HTTP, against a real broker-scoped record.
    _authenticate(api, agent)
    response = api.patch(
        f"/api/v1/brokers/{broker_b.pk}/members/{foreign_membership.pk}/",
        {"can_edit_listings": False},
        format="json",
    )
    assert response.status_code == 403
    assert response.data["error"]["code"] == "not_broker_team_manager"
    foreign_membership.refresh_from_db()
    assert foreign_membership.can_edit_listings is True


@pytest.mark.django_db
def test_acceptance_a_private_seller_cannot_forge_broker_seller_type_or_finance(api):
    """Spec 12: 'A private seller cannot send seller_type=BROKER or enable finance
    through a crafted request.'"""
    seller = make_user("private@example.com", role=UserRole.PRIVATE_SELLER)
    broker = make_broker()

    # seller_type is derived, never accepted: passing a broker id is simply refused.
    with pytest.raises(PermissionDenied) as exc_info:
        resolve_seller_context(seller, broker_id=broker.pk)
    assert exc_info.value.detail.code == "broker_listing_not_allowed"

    # And the finance capability is false for this account, so Phase 9's toggle
    # has no server-side basis to appear or be accepted.
    permissions = get_session_permissions(seller)
    assert permissions["create_private_listing"] is True
    assert permissions["create_broker_listing"] is False
    assert permissions["enable_listing_finance_flag"] is False

    _authenticate(api, seller)
    session = api.get("/api/v1/session/").data
    assert session["permissions"]["enable_listing_finance_flag"] is False


@pytest.mark.django_db
def test_acceptance_a_moderator_cannot_configure_products_without_staff_admin(api):
    """Spec 12: 'A moderator cannot change payment products unless separately
    granted staff-admin permission.'"""
    moderator = make_user("mod@example.com", role=UserRole.STAFF, is_staff=True)
    moderator.groups.add(Group.objects.get(name=StaffGroup.MODERATOR))
    request = RequestFactory().get("/admin/")
    request.user = moderator
    broker_admin = BrokerOrganizationAdmin(BrokerOrganization, AdminSite())

    assert get_session_permissions(moderator)["configure_products_and_settings"] is False
    assert get_session_permissions(moderator)["approve_listings_and_revisions"] is True
    assert IsStaffAdmin().has_permission(request, None) is False
    assert "auto_approve_listings" in broker_admin.get_readonly_fields(request)

    # Granting staff-admin separately is what unlocks configuration.
    moderator.groups.add(Group.objects.get(name=StaffGroup.ADMIN))
    moderator = type(moderator).objects.get(pk=moderator.pk)  # drop the permission cache
    request.user = moderator
    assert get_session_permissions(moderator)["configure_products_and_settings"] is True
    assert IsStaffAdmin().has_permission(request, None) is True
    assert "auto_approve_listings" not in broker_admin.get_readonly_fields(request)


@pytest.mark.django_db
def test_acceptance_an_inactive_user_cannot_act_from_an_old_session(api):
    """Spec 12: 'An inactive user cannot submit an inquiry from an old session.'"""
    user = make_user("suspended@example.com", role=UserRole.PRIVATE_SELLER)
    _authenticate(api, user)
    assert api.get(ACCOUNT_URL).status_code == 200

    user.is_active = False
    user.save(update_fields=["is_active", "updated_at"])

    response = api.get(ACCOUNT_URL)

    assert response.status_code == 401
    assert response.data["error"]["code"] == "user_inactive"
    assert get_session_permissions(user)["submit_inquiry"] is False
```

**Note (why acceptance test 3 uses the broker auto-approval field):** `/api/v1/staff/products/` does not exist until Phase 17. The requirement being proven here is the *authorization rule* — that moderator authority stops short of configuration and that staff-admin is a separately granted tier — so the test exercises the one configuration surface Phase 3 actually ships (`auto_approve_listings` in Django admin) plus the `IsStaffAdmin` class and the permission map that Phase 17's endpoint will use. **Phase 17 must gate `/api/v1/staff/products/` with `accounts.permissions.IsStaffAdmin` and add the endpoint-level version of this test.**

**Note (`type(moderator).objects.get(...)`):** Django caches a user's permissions on the instance after the first check, so re-reading the row is required for a group added mid-test to take effect. Real requests always load a fresh user, so this only affects tests.

- [ ] **Step 2: Run the acceptance tests**

```bash
cd backend
uv run pytest accounts/tests/test_phase3_acceptance.py -v
```

Expected: all 4 `PASS`.

- [ ] **Step 3: Run the complete backend and frontend suites**

```bash
cd backend && uv run pytest -v
cd ../frontend && pnpm test && pnpm lint && pnpm build
```

Expected: every backend test from Phase 1 and Tasks 1–12 passes in one run against real Postgres and real Redis; every frontend test passes; lint and build are clean. Record the exact pass counts — spec §39 requires "tests added and exact results" in the handoff note.

- [ ] **Step 4: Full-stack smoke test from a clean database**

```bash
docker compose down -v && docker compose up -d
cd backend && uv run python manage.py migrate
```

Expected: a clean migration run on an empty database, applying `accounts.0001_initial` → `accounts.0002_emailverificationtoken` → `accounts.0003_staff_groups` → `brokers.0001_initial` → `professionals.0001_initial` alongside Django's own **and alongside the already-merged `audit`, `platform_settings`, `taxonomy` and `finance` migrations** — with `accounts.0001_initial` ahead of every migration that depends on the swappable user model, and no `InconsistentMigrationHistory`. This is the proof that a fresh environment (and production, later) can be built from the migration graph rather than from the hand-repaired dev database of Task 1.

Then, in separate terminals:

```bash
cd backend && uv run celery -A config worker -Q default,notifications,media,maintenance -l info --pool=solo
cd backend && uv run python manage.py runserver 8020
cd frontend && pnpm next dev -p 3020
```

Walk the whole identity flow once: register at `/api/v1/auth/register/` → open the verification link printed by the console email backend → sign in at `http://localhost:3020/login` → confirm `/api/v1/session/` reflects the account → create a broker and a membership in Django admin → reload the frontend and confirm the navigation changes → sign out and confirm the refresh cookie is cleared and the gated links (`Moderation`, `Settings`) disappear. (`Sell`/`Fleet` are deliberately not in the nav yet — Phase 11/16 add them with their pages; see Task 11, Step 6.)

Also re-confirm `curl -s http://localhost:8020/api/v1/health/` still reports `{"status": "ok", …}` — the Phase 1 health check must not have regressed.

- [ ] **Step 5: Update `ACTIVITY.md`**

Append a new entry at the top of the `## Log` section:

```markdown
### 2026-09-17 — Phase 3 identity, organizations and permissions complete

- Implemented `docs/superpowers/plans/2026-09-17-phase-3-identity-organizations-permissions.md` in full.
- **Migrations added:** `accounts.0001_initial` (custom UUID `User` as `AUTH_USER_MODEL`), `accounts.0002_emailverificationtoken`, `accounts.0003_staff_groups` (data migration, reversible), `brokers.0001_initial`, `professionals.0001_initial`, plus `rest_framework_simplejwt.token_blacklist`. **Rollback characteristics:** `0003_staff_groups` reverses by deleting the two groups; the schema migrations reverse by dropping their tables. `AUTH_USER_MODEL` itself is not reversible in place — rolling back to Django's `auth.User` requires recreating the database, which is why this had to be the first domain migration in the project.
- **Models/services/endpoints:** `accounts.User`/`UserManager`/`EmailVerificationToken`; `brokers.BrokerOrganization`/`BrokerMembership`; `professionals.ProfessionalProfile`. Services: `accounts.services` (verification + authorization), `accounts.selectors` (session payload/permission map), `brokers.services.set_broker_auto_approval`. Endpoints: `POST /api/v1/auth/{register,verify-email,resend-verification,login,token/refresh,logout}/`, `GET /api/v1/session/`, `GET|PATCH /api/v1/account/`, `GET|POST /api/v1/brokers/<id>/members/`, `PATCH|DELETE /api/v1/brokers/<id>/members/<id>/`. Frontend: `SessionProvider`/`useSession`, `RequirePermission`, `ForbiddenScreen`, `PrimaryNav`, `/login`, `/verify-email`, `/403`.
- **Permissions and audit:** permission classes `IsActiveUser`, `IsEmailVerified`, `IsStaffModerator`, `IsStaffAdmin`, `IsOwnerOrBrokerEditor`, `IsBrokerTeamManager`, `CanReadBrokerMessages`; staff tiers via the `staff_moderator`/`staff_admin` groups. No `AuditEvent` rows are written yet — the `audit` app is Phase 2's and the staff endpoints that must emit events are Phase 12/17's. `BrokerOrganization.auto_approve_changed_by`/`_at` record the actor for the one policy field Phase 3 exposes.
- **Tests added and results:** fill in the exact counts from Step 3 (backend `pytest`, frontend `vitest`), including the four spec §12 acceptance tests in `accounts/tests/test_phase3_acceptance.py`.
- **Feature flag state:** none introduced by this phase.
- **Known limitations:** see the section at the end of the Phase 3 plan.
- Next: Phase 4 (brand/model taxonomy) and Phase 5 (directory consolidation) both depend on this phase's `User`, `BrokerOrganization`, `BrokerMembership` and permission classes.
```

Also update the "Current State" section to record that identity, organizations and the permission layer now exist.

**And correct the "Architecture Decisions" table — this is not optional.** Its existing "Auth mechanism" row still reads, from Phase 0/1 when no auth endpoints existed: *"Next.js stores access/refresh tokens in an httpOnly cookie and forwards them as a Bearer token to Django."* That is **not** what Tasks 4 and 10 built, and it describes a materially weaker design than the one that shipped. Leaving it would make the project's own architecture record wrong about its most security-sensitive decision. Replace the "Notes" cell of that row with an accurate description:

```markdown
| Auth mechanism | **JWT** via `djangorestframework-simplejwt` | Split-storage (Phase 3): the **refresh** token is set by Django as an `HttpOnly`, `Secure`, `SameSite=Lax` cookie (`nauta_refresh`, scoped to `path=/api/v1/auth/`) and is never readable from JavaScript; the **access** token lives only in a module-scoped JS variable and is never written to `localStorage`, `sessionStorage` or any readable cookie. A page load trades the refresh cookie for a fresh access token via `POST /api/v1/auth/token/refresh/`. Refresh tokens rotate on every use and the previous one is blacklisted. The JWT carries **only** `user_id` — roles and permissions are re-read from the database on every request. Fully decoupled from Django sessions; WebSocket auth uses the same access token. |
```

Adjust the wording to match the table's existing column layout and tone, but keep all four facts: refresh-in-HttpOnly-cookie, access-in-memory-only, rotation with blacklisting, and `user_id`-only claims.

- [ ] **Step 6: Commit and push**

```bash
git add ACTIVITY.md backend/accounts/tests/test_phase3_acceptance.py
git commit -m "test(accounts): add phase 3 acceptance tests and record completion"
git push origin dev
```

---

## Known Limitations (carried forward, not fixed by this plan)

- **No password reset flow.** The spec never describes one, so none is built. A user who forgets their password currently needs a staff member to set a new one in Django admin. Whichever phase owns account recovery should add `POST /api/v1/auth/password-reset/` and `POST /api/v1/auth/password-reset/confirm/` reusing the `EmailVerificationToken` pattern (hashed, single-use, expiring).
- **No verified email-change flow.** `PATCH /api/v1/account/` deliberately cannot change `email`. Spec §22 requires that the inquiry email "cannot be forged to another account without a verified email-change flow"; Phase 3 satisfies the "cannot be forged" half by making the field immutable over the API. The change flow itself is unbuilt and must be added before any phase offers an email-change UI.
- **No staff impersonation.** Spec §12 item 6 says "Ensure staff impersonation, **if available**, is read-only by default and prominently audited." It is deliberately not available: building it correctly requires the Phase 2 `audit` app, whose model signature is not yet fixed, and a half-built impersonation switch would be exactly the partial implementation §39 forbids. If a later phase adds it, it must be read-only by default and must write an `AuditEvent` on every session.
- **No `AuditEvent` emission anywhere in Phase 3.** See the note in Task 5. Phase 12 (broker auto-approval endpoint) and Phase 17 (staff back office) are responsible for wiring `set_broker_auto_approval` and the staff endpoints to the audit app.
- **`X-Request-ID` is echoed but not yet threaded through logging.** Spec §33.5 wants structured logs carrying the request id; Phase 22 (observability) owns the logging configuration that consumes `request.request_id`.
- **The error envelope has no `action` key.** Spec §30.2's example includes an optional `action` object for entitlement-gated failures; Phase 13/14 extends `common.exceptions.nauta_exception_handler` to emit it.
- **Broker team membership has no invitation flow.** Members must already have a NAUTA account. See the note in Task 9.
- **`ProfessionalProfile` has no publication gate.** Blank descriptions and empty `service_area` are allowed at the database level; the rules for reaching `ACTIVE` and appearing in the directory belong to Phase 5.
- **Rate limiting covers auth flows only (within this plan's scope).** Spec §30.4 also lists brand/model search, inquiry submission, message sending, finance quote logging, Checkout creation and upload intents. Each of those phases adds its own scope to `DEFAULT_THROTTLE_RATES`; the `common.throttling.HashedIPScopedRateThrottle` machinery (which keeps raw IPs out of the cache, per §30.4) is put in place by Task 3 and installed as `DEFAULT_THROTTLE_CLASSES`.
- **The already-merged `taxonomy` search views still use DRF's stock `ScopedRateThrottle`, so their throttle cache keys contain raw client IPs — a live spec §30.4 violation this plan does not fix.** `taxonomy/views.py` sets `throttle_classes = [ScopedRateThrottle]` on both search views, and a view-level `throttle_classes` overrides `DEFAULT_THROTTLE_CLASSES`, so Task 3's project-wide switch to `HashedIPScopedRateThrottle` does not reach them. `taxonomy` merged from Phase 4 independently of this plan and modifying it here would widen Phase 3's blast radius for no identity-domain benefit. The fix is small — delete the two `throttle_classes` lines (and the now-unused import) so both views inherit the hashed default, keeping the existing `throttle_scope = "taxonomy_search"` — and belongs to a dedicated cleanup pass that also re-checks every other already-merged app for view-level stock throttles. Until then, do not describe `HashedIPScopedRateThrottle` coverage as universal.
- **`config/wsgi.py`'s settings-module fallback is still not fail-secure** — inherited from Phase 0/1 and still deferred to Phase 22. See the Phase 0/1 plan's final Known Limitation for the full analysis.

---

## Contract summary for later phases

Everything a downstream phase needs to import from Phase 3, in one place.

```python
from accounts.enums import Locale, SellerType, StaffGroup, UserRole
from accounts.models import EmailVerificationToken, User, UserManager
from accounts.permissions import (
    CanReadBrokerMessages,
    IsActiveUser,
    IsBrokerTeamManager,
    IsEmailVerified,
    IsOwnerOrBrokerEditor,
    IsStaffAdmin,
    IsStaffModerator,
)
from accounts.selectors import (
    PERMISSION_KEYS,
    build_session_payload,
    get_broker_memberships,
    get_session_permissions,
)
from accounts.services import (
    SellerContext,
    active_broker_membership,
    can_edit_owned_object,
    can_manage_broker_team,
    can_read_broker_messages,
    has_any_broker_edit_membership,
    is_staff_admin,
    is_staff_moderator,
    resolve_seller_context,
)
from brokers.enums import (
    ROLE_DEFAULT_CAPABILITIES,
    BrokerMembershipRole,
    BrokerOrganizationStatus,
)
from brokers.models import BrokerMembership, BrokerOrganization
from brokers.services import set_broker_auto_approval
from common.exceptions import nauta_exception_handler
from common.models import UUIDTimeStampedModel
from common.throttling import HashedIPScopedRateThrottle
from professionals.enums import ProfessionalProfileStatus
from professionals.models import ProfessionalProfile
```

Rules a later phase must follow:

1. **FK to the user model as `settings.AUTH_USER_MODEL`**, never a hardcoded `"accounts.User"` string, inside a model definition. `from accounts.models import User` is for type hints, `isinstance` checks and `User.objects` only (Task 1's Interfaces).
2. **Inherit `common.models.UUIDTimeStampedModel`** for every new domain model, so UUID pks and UTC timestamps stay uniform (spec §11 preamble).
3. **Never trust `seller_type`, `owner_user` or `broker` from a request body.** Call `accounts.services.resolve_seller_context(request.user, broker_id=…)` and use what it returns (spec §12 item 2).
4. **Protect object access with `IsOwnerOrBrokerEditor`** (or `can_edit_owned_object` directly). Any protected model must expose `owner_user_id` and/or `broker_id`. For *message* access use `CanReadBrokerMessages` instead — it gates on `can_read_messages`, not `can_edit_listings`.
5. **Gate inquiry submission, listing submission and Checkout creation with `IsEmailVerified`** (spec §12 item 3).
6. **Gate staff endpoints with `IsStaffModerator` (approvals) or `IsStaffAdmin` (configuration, taxonomy, products, broker policy)** — matching spec §5's table.
7. **Never add a role or permission claim to the JWT.** Read from the database on every request.
8. **Adding a capability means adding a key to `accounts.selectors.PERMISSION_KEYS`, to the `permissions` dict in `get_session_permissions`, and to `PermissionKey` in `frontend/src/lib/auth/types.ts`.** The assertion in `get_session_permissions` and the TypeScript union make a half-done addition fail loudly.
9. **Every new rate limit uses `common.throttling.HashedIPScopedRateThrottle`** with its own scope in `DEFAULT_THROTTLE_RATES` — never DRF's stock `AnonRateThrottle`/`ScopedRateThrottle`, which would put raw client IPs in the cache keys (spec §30.4). Task 3 installs it as `DEFAULT_THROTTLE_CLASSES`, so a view that declares only `throttle_scope` inherits it automatically; **do not set `throttle_classes` on a view unless you genuinely need a non-default class.** Note this is a forward-looking rule, not a description of the whole codebase today: the already-merged `taxonomy` search views pin the stock `ScopedRateThrottle` at view level and are still uncovered (see Known Limitations).
10. **Broker authority comes from `BrokerMembership`, never from `primary_role`.** A member's `primary_role` may be anything; what grants broker capability is an active membership of an ACTIVE broker plus the relevant flag (ruling in Task 5).
11. **Only add a nav link in `PrimaryNav` in the same commit that creates the page it points at** (Task 11's ruling). Phase 11 owns `/sell/`, Phase 16 owns `/fleet/`.

---

## Self-Review

**Spec coverage — §12 (Phase 3), line by line:**

| Spec §12 requirement | Where implemented |
|---|---|
| Backend 1 — role and organization membership permission classes | Tasks 5, 7 |
| Backend 2 — resolve listing ownership exclusively on the server | Task 7 (`resolve_seller_context`, `can_edit_owned_object`) |
| Backend 3 — verified email for inquiry, listing submission, Checkout | Tasks 3 (flow), 7 (`IsEmailVerified`), 8 (`submit_inquiry` key) |
| Backend 4 — object-level authorization for conversations, listings, revisions, staff actions | Task 7 (`IsOwnerOrBrokerEditor`, `CanReadBrokerMessages`/`can_read_broker_messages`), Task 9 (broker-scoped 404/403, rank + self-edit guards on team membership) |
| Backend 5 — suspended users/organizations cannot create, submit or purchase | Task 7 (`active_broker_membership` ACTIVE filter; `is_active` gates), Task 12 acceptance test 4 |
| Backend 6 — staff impersonation read-only and audited *if available* | Ruled not available; Known Limitations |
| Frontend — navigation derived from session/permissions endpoint | Tasks 8, 11 |
| Frontend — unauthorized links hidden, direct access still rejected | Task 11 (`PrimaryNav`, `RequirePermission`) + Tasks 7/9 server-side |
| Frontend — 403 screen; 401 redirect with safe `next` | Task 11 (`ForbiddenScreen`, guard) + Task 10 (`safeNextUrl`) |
| Acceptance test 1 — broker agent vs another broker | Task 12, test 1 |
| Acceptance test 2 — private seller cannot forge broker/finance | Task 12, test 2 |
| Acceptance test 3 — moderator cannot configure products | Task 12, test 3 |
| Acceptance test 4 — inactive user with an old session | Task 12, test 4 |

**Spec coverage — §11.1 (data model):** `User` (all seven listed fields, Task 1), `BrokerOrganization` (all eleven listed fields, Task 5), `BrokerMembership` (all seven listed fields plus the unique constraint, Task 5), `ProfessionalProfile` (all listed fields, with "address fields" and "service_area" resolved by explicit rulings, Task 6). §11.1's "Only staff admin can change `auto_approve_listings`" is enforced in Task 5's admin; §11.1's closing prohibition on decorative claims is respected in Task 6.

**Spec coverage — §5 (roles and permissions):** every row of the capability table maps to a key in `PERMISSION_KEYS` (table in Task 8); the moderator/admin split is implemented as additive groups per §5's opening sentence. §5's closing rule about view counts belongs to Phase 10 and is out of scope here.

**Spec coverage — §1 (fixed decisions) touching identity:** "Inquiry authentication — a verified-email user account is required to submit" → Tasks 3, 7, 8. "Broker listing quota unlimited; approval policy controlled per broker with `auto_approve_listings`" → Task 5 (field + staff-admin-only mutation; quota enforcement itself is Phase 12/13). "Contact reveal … scoped to that user and entity, is audited" → capability keys only; the grant mechanism is Phase 7. "Finance card eligibility: only broker-owned listings" → `enable_listing_finance_flag` is false for every non-broker-editor account (Task 8, Task 12 test 2).

**Spec coverage — §30 (API conventions):** §30.1's `/api/v1/session/` is implemented verbatim; the remaining identity endpoints are named under §30.1's naming latitude with the ruling recorded in Task 3. §30.2's envelope, ISO-8601 UTC times (DRF default with `USE_TZ`) and `X-Request-ID` are Task 2. §30.3's `Idempotency-Key` applies to Checkout, listing submit and staff decisions — none of which exist in Phase 3 — so it is correctly absent. §30.4's login/auth rate limit lands in **Task 3** (so no auth endpoint ever exists unthrottled), with Task 4 adding the separate `auth-refresh` scope; §30.4's "must not store raw IP" is satisfied **for this plan's endpoints** by `common.throttling.HashedIPScopedRateThrottle`, which HMACs the client IP with `CONTACT_HASH_SECRET` — the same secret §11.7 mandates for `ListingView.viewer_hash`. It is *not* yet satisfied project-wide: the already-merged `taxonomy` search views override the default with DRF's stock `ScopedRateThrottle`, which this plan deliberately leaves alone (recorded under Known Limitations).

**Spec coverage — §2 and §39 (principles):** no invented data (every frontend state reads a real endpoint); server authority (Task 12 tests 1–3); atomic state changes with `select_for_update` on the single scarce resource this phase owns, the verification token (Task 3); `transaction.on_commit` for the verification email (Task 3, per §1's notification-timing decision); no TODO placeholders — the three things Phase 3 does not build (impersonation, password reset, email change) are absent by ruling and listed as Known Limitations, not stubbed.

**Placeholder scan:** no "TBD", "TODO", "implement later", "add appropriate error handling", "write tests for the above" or "similar to Task N" appears in this plan. Every code step carries the actual code; every test step carries the actual test. The two forward references are explicit and bounded: Task 4's single `xfail` test, removed in Task 9 Step 1 (and covered in the meantime by `test_the_issued_access_token_authenticates_a_real_request`, which does not defer), and Task 5's function-local `is_staff_admin` import, re-verified in Task 7 Step 7. Task 5 also *defines* `is_staff_moderator`/`is_staff_admin`, so no task calls a symbol that does not yet exist.

**Type consistency:** `UserRole`, `Locale`, `SellerType`, `StaffGroup`, `BrokerOrganizationStatus`, `BrokerMembershipRole`, `ProfessionalProfileStatus` are each defined once and referenced by the same name everywhere. `is_staff_admin`/`is_staff_moderator`/`active_broker_membership`/`can_edit_owned_object`/`can_manage_broker_team`/`can_read_broker_messages`/`has_any_broker_edit_membership`/`resolve_seller_context` keep identical signatures across Tasks 5, 7, 8, 9 and 12. The twelve `PERMISSION_KEYS` in `accounts/selectors.py` match the twelve members of `PermissionKey` in `frontend/src/lib/auth/types.ts` one-for-one and in the same order. `UserSummarySerializer`'s field list is the same object serialized by `/api/v1/account/`, `/api/v1/session/` and the login response, and matches `SessionUser` in the TypeScript types. `REFRESH_COOKIE_NAME`/`REFRESH_COOKIE_PATH` are defined once in `accounts/cookies.py` and used by the views, the tests and the manual verification steps; `REFRESH_COOKIE_SECURE` is defined once in `config/settings/base.py` (overridden only in `dev.py`) and read once in `accounts/cookies.py`. `brokers.enums.ROLE_DEFAULT_CAPABILITIES` is the single source of the role→flag mapping, consumed by `BrokerMembership.save()` and referenced (not re-stated) by Task 9's serializers. The two write serializers are named `BrokerMembershipCreateSerializer` and `BrokerMembershipUpdateSerializer` throughout — there is no `BrokerMembershipWriteSerializer`. All permission classes live in `accounts/permissions.py`; there is no `brokers/permissions.py`. Migration numbering is `accounts.0001_initial` → `0002_emailverificationtoken` → `0003_staff_groups`, consistently, including in the File Structure tree.

