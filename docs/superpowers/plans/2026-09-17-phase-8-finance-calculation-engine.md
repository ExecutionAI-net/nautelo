# NAUTA Phase 8 — Finance Configuration and Calculation Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `finance` Django app: a versioned, staff-editable global finance configuration (rate/term/down-payment defaults), a `Decimal`-exact fixed-rate amortization calculation engine, and the `POST /api/v1/finance/quotes/` endpoint for manual (non-listing) finance estimates — the self-contained backend foundation spec Phase 9 later builds a broker listing toggle and card UI on top of.

**Architecture:** A new `finance` Django app under `backend/`, following the same layout as the existing `common` app (models/admin/services/serializers/views/tests). `FinanceConfigurationVersion` rows are immutable snapshots — never edited in place, only ever superseded by a new active version — so historical quotes stay reproducible after staff change the defaults. The calculation engine is a pure function operating entirely in `Decimal`. The quote endpoint accepts only explicit/manual input values (spec §17.4 "context 2"); it does not accept a `listing_id` (spec §17.4 "context 1"), because the `listings` app does not exist yet (spec Phase 4, running concurrently with this plan) — see the ruling in Task 7.

**Tech Stack:** Python 3.13 + `uv` (already the project standard from Phase 0/1), Django 5.2, Django REST Framework, PostgreSQL 16, Redis-backed Django cache (`django.core.cache.backends.redis.RedisCache`, already configured in `config/settings/base.py`). No new third-party dependencies are required — everything this plan needs (`rest_framework`, `django.contrib.admin`, the standard library `decimal` module) is already installed and configured by the Phase 0/1 plan.

**Spec:** [`NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md`](../../../NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md) §1 (fixed global finance defaults), §2 (non-negotiable implementation principles), §11.6 (`FinanceConfigurationVersion` / `FinanceQuoteLog` data model), §17 (Phase 8 — finance configuration and calculation engine, the primary source for this plan), §30.1 (API inventory — `POST /api/v1/finance/quotes/`), §34.2 (Postgres-only test rule), §39 (developer execution protocol). This plan implements spec Phase 8 only. It does **not** implement spec Phase 9 (§18 — finance card UI and broker listing toggle), which depends on this plan plus spec Phase 4 (taxonomy/listings) and is planned separately.

## Execution Model

This plan is being implemented **concurrently** with the Phase 3 (identity) and Phase 4 (taxonomy) plans, all branching from the same `dev` tip. To avoid cross-phase collisions on `dev` while those other phases are also mid-flight, use a per-task branch+PR flow identical in spirit to the one established in `docs/superpowers/plans/2026-09-17-phase-0-1-infrastructure.md`:

1. For every task in this plan: branch off the current tip of `dev` (`git checkout -b finance-task-N-<slug> dev`), implement the task (TDD steps below), then open a PR into `dev` (`gh pr create`).
2. Merge a task's PR only when the existing CI workflow (`.github/workflows/ci.yml`, already in place since Phase 0/1 — no changes needed, it already runs `uv run pytest` for any test files under `backend/`) is green, and the branch is a fast-forward or cleanly auto-mergeable onto `dev`.
3. After merging, delete the task branch and branch the next task from the new `dev` tip. Tasks in this plan are strictly sequential (each depends only on earlier tasks in this same plan), so there is never a second in-flight branch *within this plan* to conflict with — but `dev` may have moved because Phase 3/4 merged something in the meantime; re-branching from the latest tip each time absorbs that safely, since this plan never touches `accounts`/`listings`/taxonomy files.
4. This plan touches exactly two files outside the new `finance/` directory: `backend/config/settings/base.py` (one line: register the app) and `backend/config/urls.py` (one import + one route). Both are called out explicitly per-task below with their exact current content, so a conflict with a concurrent Phase 3/4 change to those same files is easy to spot and resolve by re-adding this plan's one line/route on top of whatever Phase 3/4 added.

## Global Constraints

- Backend: Python 3.13, `uv` for all dependency/command management, Django 5.2, DRF for the JSON API, PostgreSQL 16 (spec §3; already provisioned by Phase 0/1's `docker-compose.yml` at `127.0.0.1:5433`).
- Backend dev server runs on port **8020** on this machine, not Django's default 8000 (Phase 0/1 ruling — an unrelated project already occupies 8000).
- **Use PostgreSQL in tests, never SQLite** (spec §34.2: "Use PostgreSQL in CI for tests that depend on production constraints/locking; SQLite is insufficient."). `backend/config/settings/test.py` must **not** be modified to override `DATABASES` or `CACHES` to SQLite/LocMem — it already correctly inherits Postgres and Redis from `base.py`; leave that inheritance untouched. This project has had this rule violated and reverted before — do not reintroduce a SQLite/LocMem override under any circumstance, including "just for speed."
- No partial/visual-only implementations, no faked/hardcoded demo data, no TODO placeholders for backend enforcement (spec §39). Every validation rule in this plan (price/rate/term/down-payment ranges, unsupported-currency handling, the single-active-configuration constraint) must be enforced by real backend code and covered by a real, passing test against a real Postgres database — never mocked away.
- TDD per task: write the failing test first, run it and confirm the failure mode, then write the minimal implementation, then confirm the test passes.
- **Monetary and rate fields use `Decimal`, never binary floating point** (spec §11 preamble: "Monetary fields use `Decimal`, never binary floating point.") — every arithmetic step in the amortization calculation (Task 5) uses `decimal.Decimal`, with at least 28 significant digits of precision, and rounds to two decimals with `ROUND_HALF_UP` only once, at the very end, per field. Never round an intermediate value and never introduce a Python `float` anywhere in the calculation path.
- All primary keys are UUIDs unless stated otherwise; all timestamps are timezone-aware UTC (`USE_TZ = True`, already set in `config/settings/base.py`).
- Finance quotes are an "illustrative estimate only," never a credit offer — no response, log message, admin label or code comment in this plan may use "approved," "pre-approved," "guaranteed," "offer," "your rate" or a named lender (spec §2.5).
- Global finance defaults are fixed by spec §1: annual nominal interest rate **5.00%**, term **48 months**, down payment **20.00%**. These are staff-editable via Django admin (Task 4), but the *default seeded* configuration (Task 2) must use exactly these three values.
- **This plan must not import from, depend on, or reference the `accounts`/`listings`/taxonomy apps or a `User`/`Listing` model in any way** — Phase 8 depends only on spec Phase 2 (shared types/platform settings/audit foundation), not on Phase 3 (identity) or Phase 4 (taxonomy), which are being planned and implemented concurrently by other people. Every ruling in this plan that touches a spec field normally tied to `User`/`Listing` (e.g. `FinanceConfigurationVersion.created_by`, the `listing_id` quote context, `FinanceQuoteLog`) resolves this by deferring the cross-app part to a later phase — see the inline **Note:**s in Tasks 1 and 7, and "Known Limitations" at the end of this document.
- Finance configuration rows are versioned and immutable at the database level (see Task 1's model docstring and the "only one active version" constraint) precisely so that a snapshot of the rate/term/down-payment used for any calculation stays reproducible even after staff change the global defaults later — this is why `FinanceConfigurationVersion` is append-only (a "new version," never an in-place edit) rather than a single mutable settings row with a live foreign key.

---

## File Structure

```
backend/
├── config/
│   ├── settings/
│   │   └── base.py                          (Modify: register "finance" app)
│   └── urls.py                              (Modify: add finance quote route)
└── finance/
    ├── __init__.py
    ├── apps.py
    ├── admin.py
    ├── calculations.py
    ├── models.py
    ├── serializers.py
    ├── services.py
    ├── views.py
    ├── migrations/
    │   ├── __init__.py
    │   ├── 0001_initial.py                  (generated by makemigrations)
    │   └── 0002_seed_default_configuration.py
    └── tests/
        ├── __init__.py
        ├── test_models.py
        ├── test_services.py
        ├── test_admin.py
        ├── test_calculations.py
        ├── test_serializers.py
        └── test_views.py
```

---

### Task 1: `finance` app scaffolding, `FinanceConfigurationVersion` model, and the single-active-version DB constraint

**Files:**
- Create: `backend/finance/__init__.py`, `backend/finance/apps.py`, `backend/finance/models.py`
- Create: `backend/finance/tests/__init__.py`, `backend/finance/tests/test_models.py`
- Modify: `backend/config/settings/base.py`

**Interfaces:**
- Produces: `finance.models.FinanceConfigurationVersion` with fields `id` (UUID PK), `version` (unique positive int, immutable), `annual_rate_percent` (`Decimal`, 7,4), `term_months` (positive int, 1–360), `down_payment_percent` (`Decimal`, 7,4, 0–99.99), `is_active` (bool, default `False`), `created_by_user_id` (nullable UUID, **not** a foreign key — see Note below), `created_at` (auto UTC timestamp). A DB-level `UniqueConstraint` named `finance_only_one_active_configuration_version` enforces that at most one row has `is_active=True`.

**Note (ruling):** spec §11.6 lists `created_by` on `FinanceConfigurationVersion` as a field pointing at the acting staff user. Per this plan's Global Constraints, `finance` must not depend on a `User` model that may not exist yet (Phase 3 is running concurrently). `created_by_user_id` is therefore stored as a plain nullable `UUIDField` — a loose reference, not a `ForeignKey` — capturing the value for later use. Once Phase 3's `User` model lands, a follow-up migration in whichever phase wires finance into the rest of the system can convert this into a real `ForeignKey` with a data migration to backfill the constraint; that conversion is out of scope here.

**Note (ruling):** finance rate/term/down-payment are owned entirely by this model, not by Phase 2's generic `PlatformSetting` registry — versioned historical reproducibility requires immutable rows, which a mutable-in-place generic setting can't provide. A review flagged that this plan's `FinanceConfigurationVersion` duplicates three settings (`finance.annual_rate_percent`, `finance.term_months`, `finance.down_payment_percent`) that the sibling plan `docs/superpowers/plans/2026-09-17-phase-2-shared-types-platform-settings.md` also defined as generic `PlatformSetting` entries. Ruling: this plan's `FinanceConfigurationVersion` approach is correct and stays exactly as designed here; Phase 2's plan is being corrected instead, to remove those three keys from its own registry and keep only `finance.enabled` (a simple kill-switch toggle for Phase 9's UI), nothing else finance-related.

- [ ] **Step 1: Write the failing tests**

`backend/finance/tests/__init__.py` — empty file.

`backend/finance/tests/test_models.py`:

```python
from decimal import Decimal

import pytest
from django.db import IntegrityError, transaction

from finance.models import FinanceConfigurationVersion


@pytest.mark.django_db
def test_only_one_active_configuration_version_allowed():
    # Defensive cleanup: makes this test correct both now (no rows exist yet)
    # and later once Task 2 seeds a default active row via migration.
    FinanceConfigurationVersion.objects.all().delete()

    FinanceConfigurationVersion.objects.create(
        version=1,
        annual_rate_percent=Decimal("5.00"),
        term_months=48,
        down_payment_percent=Decimal("20.00"),
        is_active=True,
    )

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            FinanceConfigurationVersion.objects.create(
                version=2,
                annual_rate_percent=Decimal("6.00"),
                term_months=36,
                down_payment_percent=Decimal("15.00"),
                is_active=True,
            )


@pytest.mark.django_db
def test_multiple_inactive_configuration_versions_are_allowed():
    FinanceConfigurationVersion.objects.all().delete()

    FinanceConfigurationVersion.objects.create(
        version=1,
        annual_rate_percent=Decimal("5.00"),
        term_months=48,
        down_payment_percent=Decimal("20.00"),
        is_active=False,
    )
    FinanceConfigurationVersion.objects.create(
        version=2,
        annual_rate_percent=Decimal("6.00"),
        term_months=36,
        down_payment_percent=Decimal("15.00"),
        is_active=False,
    )

    assert FinanceConfigurationVersion.objects.filter(is_active=False).count() == 2
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd backend
uv run pytest finance/tests/test_models.py -v
```

Expected: `ERROR` — `ModuleNotFoundError: No module named 'finance'` (the app doesn't exist yet).

- [ ] **Step 3: Scaffold the app and write the model**

```bash
uv run python manage.py startapp finance
```

Replace the generated `backend/finance/apps.py` with:

```python
from django.apps import AppConfig


class FinanceConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "finance"
```

Delete the generated `backend/finance/models.py` placeholder and replace it with:

```python
import uuid
from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class FinanceConfigurationVersion(models.Model):
    """A single, immutable snapshot of the global finance calculation defaults
    (annual rate, term, down payment) used by the amortization engine.

    Rows are never updated in place after creation — `is_active` is the only
    field ever mutated post-creation, and only ever flips True -> False when a
    newer version is activated (see `finance.services.FinanceConfigurationService
    .activate`, the sole supported way to change the effective configuration).
    This immutability is what lets a quote response's `configuration_version`
    (an integer, not a live foreign key) remain a permanent, reproducible
    snapshot even after staff change the defaults later.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    version = models.PositiveIntegerField(unique=True, editable=False)
    annual_rate_percent = models.DecimalField(
        max_digits=7,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0")), MaxValueValidator(Decimal("100"))],
    )
    term_months = models.PositiveIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(360)],
    )
    down_payment_percent = models.DecimalField(
        max_digits=7,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0")), MaxValueValidator(Decimal("99.99"))],
    )
    is_active = models.BooleanField(default=False)
    created_by_user_id = models.UUIDField(null=True, blank=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-version"]
        constraints = [
            models.UniqueConstraint(
                fields=["is_active"],
                condition=models.Q(is_active=True),
                name="finance_only_one_active_configuration_version",
            ),
        ]

    def __str__(self):
        return f"FinanceConfigurationVersion(v{self.version}, active={self.is_active})"
```

Delete the generated `backend/finance/tests.py` file (this plan uses the `finance/tests/` package created in Step 1 instead).

Register the app in `backend/config/settings/base.py`. Current content of the `INSTALLED_APPS` list:

```python
INSTALLED_APPS = [
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "channels",
    "storages",
    "common",
]
```

Add `"finance"` after `"common"`:

```python
INSTALLED_APPS = [
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "channels",
    "storages",
    "common",
    "finance",
]
```

- [ ] **Step 4: Generate and apply the migration**

```bash
uv run python manage.py makemigrations finance
uv run python manage.py migrate
```

Expected: a new `finance/migrations/0001_initial.py` is generated containing the `CreateModel` for `FinanceConfigurationVersion` and an `AddConstraint` for `finance_only_one_active_configuration_version`; `migrate` applies it against the Dockerized Postgres with no errors.

- [ ] **Step 5: Run the tests to verify they pass**

```bash
uv run pytest finance/tests/test_models.py -v
```

Expected: both tests `PASS`.

- [ ] **Step 6: Commit**

```bash
git add backend/finance/__init__.py backend/finance/apps.py backend/finance/models.py backend/finance/migrations backend/finance/tests/__init__.py backend/finance/tests/test_models.py backend/config/settings/base.py
git commit -m "feat(finance): add finance app with versioned configuration model"
```

---

### Task 2: Seed the default global finance configuration (5% / 48 months / 20% down)

**Files:**
- Create: `backend/finance/migrations/0002_seed_default_configuration.py`
- Modify: `backend/finance/tests/test_models.py`

**Interfaces:**
- Consumes: `finance.models.FinanceConfigurationVersion` (Task 1).
- Produces: a permanently seeded `version=1` row with `annual_rate_percent=5.0000`, `term_months=48`, `down_payment_percent=20.0000`, `is_active=True` — the spec §1 global default, present in every environment (dev, CI, prod) from the moment migrations are applied.

- [ ] **Step 1: Write the failing test**

Append to `backend/finance/tests/test_models.py`:

```python
def test_default_configuration_is_seeded_and_active(db):
    config = FinanceConfigurationVersion.objects.get(is_active=True)

    assert config.version == 1
    assert config.annual_rate_percent == Decimal("5.0000")
    assert config.term_months == 48
    assert config.down_payment_percent == Decimal("20.0000")
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
uv run pytest finance/tests/test_models.py::test_default_configuration_is_seeded_and_active -v
```

Expected: `FAIL` — `FinanceConfigurationVersion.DoesNotExist` (no active row exists yet; only the two tests from Task 1 create/delete their own rows within each test body).

- [ ] **Step 3: Write the data migration**

`backend/finance/migrations/0002_seed_default_configuration.py`:

```python
from decimal import Decimal

from django.db import migrations


def create_default_configuration(apps, schema_editor):
    FinanceConfigurationVersion = apps.get_model("finance", "FinanceConfigurationVersion")
    FinanceConfigurationVersion.objects.create(
        version=1,
        annual_rate_percent=Decimal("5.00"),
        term_months=48,
        down_payment_percent=Decimal("20.00"),
        is_active=True,
        created_by_user_id=None,
    )


def remove_default_configuration(apps, schema_editor):
    FinanceConfigurationVersion = apps.get_model("finance", "FinanceConfigurationVersion")
    FinanceConfigurationVersion.objects.filter(version=1).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("finance", "0001_initial"),
    ]
    operations = [
        migrations.RunPython(create_default_configuration, remove_default_configuration),
    ]
```

- [ ] **Step 4: Apply the migration**

```bash
uv run python manage.py migrate
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
uv run pytest finance/tests/test_models.py -v
```

Expected: all three tests in this file (the two from Task 1 plus this one) `PASS`.

- [ ] **Step 6: Commit**

```bash
git add backend/finance/migrations/0002_seed_default_configuration.py backend/finance/tests/test_models.py
git commit -m "feat(finance): seed default global finance configuration (5%, 48mo, 20% down)"
```

---

### Task 3: `FinanceConfigurationService` — cached active-configuration lookup and versioned activation

**Files:**
- Create: `backend/finance/services.py`, `backend/finance/tests/test_services.py`

**Interfaces:**
- Consumes: `finance.models.FinanceConfigurationVersion` (Task 1), the seeded default (Task 2).
- Produces: `finance.services.FinanceConfigurationService.get_active_configuration() -> FinanceConfigurationVersion` (cached by a module-level key), `FinanceConfigurationService.activate(new_config: FinanceConfigurationVersion) -> FinanceConfigurationVersion` (persists `new_config` as the new active version, assigning `version`/`is_active` itself, deactivating whichever version was previously active, and invalidating the cache after the transaction commits), and the constant `finance.services.ACTIVE_CONFIGURATION_CACHE_KEY`.

- [ ] **Step 1: Write the failing tests**

`backend/finance/tests/test_services.py`:

```python
from decimal import Decimal

import pytest
from django.core.cache import cache

from finance.models import FinanceConfigurationVersion
from finance.services import ACTIVE_CONFIGURATION_CACHE_KEY, FinanceConfigurationService


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.delete(ACTIVE_CONFIGURATION_CACHE_KEY)
    yield
    cache.delete(ACTIVE_CONFIGURATION_CACHE_KEY)


@pytest.mark.django_db
def test_get_active_configuration_returns_seeded_default():
    config = FinanceConfigurationService.get_active_configuration()

    assert config.version == 1
    assert config.annual_rate_percent == Decimal("5.0000")
    assert config.term_months == 48
    assert config.down_payment_percent == Decimal("20.0000")


@pytest.mark.django_db
def test_get_active_configuration_is_cached_after_first_call(django_assert_num_queries):
    FinanceConfigurationService.get_active_configuration()

    with django_assert_num_queries(0):
        FinanceConfigurationService.get_active_configuration()


@pytest.mark.django_db
def test_activate_deactivates_previous_version_and_invalidates_cache(
    django_capture_on_commit_callbacks,
):
    FinanceConfigurationService.get_active_configuration()  # warms the cache with v1

    new_config = FinanceConfigurationVersion(
        annual_rate_percent=Decimal("6.00"),
        term_months=60,
        down_payment_percent=Decimal("25.00"),
    )

    with django_capture_on_commit_callbacks(execute=True):
        activated = FinanceConfigurationService.activate(new_config)

    assert activated.version == 2
    assert activated.is_active is True

    previous = FinanceConfigurationVersion.objects.get(version=1)
    assert previous.is_active is False

    assert cache.get(ACTIVE_CONFIGURATION_CACHE_KEY) is None
    refreshed = FinanceConfigurationService.get_active_configuration()
    assert refreshed.version == 2
    assert refreshed.annual_rate_percent == Decimal("6.0000")
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
uv run pytest finance/tests/test_services.py -v
```

Expected: `ERROR` — `ModuleNotFoundError: No module named 'finance.services'`.

- [ ] **Step 3: Implement the service**

`backend/finance/services.py`:

```python
from django.core.cache import cache
from django.db import transaction
from django.db.models import Max

from .models import FinanceConfigurationVersion

ACTIVE_CONFIGURATION_CACHE_KEY = "finance:active_configuration_version"
ACTIVE_CONFIGURATION_CACHE_TTL_SECONDS = 300


class FinanceConfigurationService:
    """Reads and mutates the single active `FinanceConfigurationVersion`."""

    @staticmethod
    def get_active_configuration() -> FinanceConfigurationVersion:
        cached = cache.get(ACTIVE_CONFIGURATION_CACHE_KEY)
        if cached is not None:
            return cached

        config = FinanceConfigurationVersion.objects.get(is_active=True)
        cache.set(
            ACTIVE_CONFIGURATION_CACHE_KEY,
            config,
            ACTIVE_CONFIGURATION_CACHE_TTL_SECONDS,
        )
        return config

    @staticmethod
    def activate(new_config: FinanceConfigurationVersion) -> FinanceConfigurationVersion:
        """Persists `new_config` as the new active version.

        `new_config` must be an unsaved `FinanceConfigurationVersion` instance
        with `annual_rate_percent`, `term_months`, `down_payment_percent`
        and (optionally) `created_by_user_id` already set — this method
        assigns `version` and `is_active` itself,
        deactivates whichever version was previously active, and invalidates
        the cache once the transaction actually commits.
        """
        with transaction.atomic():
            previous_active = (
                FinanceConfigurationVersion.objects.select_for_update()
                .filter(is_active=True)
                .first()
            )
            next_version = (
                FinanceConfigurationVersion.objects.aggregate(Max("version"))["version__max"]
                or 0
            ) + 1

            if previous_active is not None:
                previous_active.is_active = False
                previous_active.save(update_fields=["is_active"])

            new_config.version = next_version
            new_config.is_active = True
            new_config.save()

            transaction.on_commit(FinanceConfigurationService._invalidate_cache)

        return new_config

    @staticmethod
    def _invalidate_cache():
        cache.delete(ACTIVE_CONFIGURATION_CACHE_KEY)
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
uv run pytest finance/tests/test_services.py -v
```

Expected: all three tests `PASS`. (These tests hit the real Redis-backed cache configured in `config/settings/base.py` — make sure `docker compose up -d` from Phase 0/1 is running.)

- [ ] **Step 5: Commit**

```bash
git add backend/finance/services.py backend/finance/tests/test_services.py
git commit -m "feat(finance): add cached configuration service with versioned activation"
```

---

### Task 4: Django admin — staff can add a new configuration version, never edit an existing one

**Files:**
- Create: `backend/finance/admin.py`, `backend/finance/tests/test_admin.py`

**Interfaces:**
- Consumes: `finance.services.FinanceConfigurationService.activate` (Task 3).
- Produces: `finance.admin.FinanceConfigurationVersionAdmin` registered for `FinanceConfigurationVersion`, and `finance.admin.FinanceConfigurationVersionAddForm`.

**Note (ruling):** spec §1/§17.5 say the defaults are "editable by authorized staff in Django" but §11.6 says "Updating settings creates a new version; it does not rewrite previous quotes." These two statements only fit together if "editing" in the admin actually means *adding* a new version rather than mutating an existing row. This admin class therefore disables `has_change_permission` unconditionally (no object, new or existing, can ever be opened in Django's "change" form) while leaving `has_add_permission` and `has_view_permission` following the normal staff flag — so staff use the standard "Add" button to create a new version (which immediately becomes the active one and deactivates the previous one), and can still view every historical version read-only in the changelist and Django's native view-only detail page, but can never mutate one after the fact.

- [ ] **Step 1: Write the failing tests**

`backend/finance/tests/test_admin.py`:

```python
from decimal import Decimal
from unittest.mock import Mock

import pytest
from django.contrib.admin.sites import AdminSite

from finance.admin import FinanceConfigurationVersionAdmin
from finance.models import FinanceConfigurationVersion


@pytest.fixture
def admin_instance():
    return FinanceConfigurationVersionAdmin(FinanceConfigurationVersion, AdminSite())


def test_has_change_permission_is_always_false(admin_instance):
    assert admin_instance.has_change_permission(Mock(), obj=None) is False
    assert admin_instance.has_change_permission(Mock(), obj=Mock()) is False


def test_has_add_and_view_permission_follow_the_staff_flag(admin_instance):
    staff_request = Mock(user=Mock(is_staff=True))
    non_staff_request = Mock(user=Mock(is_staff=False))

    assert admin_instance.has_add_permission(staff_request) is True
    assert admin_instance.has_add_permission(non_staff_request) is False
    assert admin_instance.has_view_permission(staff_request) is True
    assert admin_instance.has_view_permission(non_staff_request) is False


def test_has_delete_permission_is_always_false(admin_instance):
    assert admin_instance.has_delete_permission(Mock(), obj=None) is False


@pytest.mark.django_db
def test_save_model_activates_new_version_and_deactivates_previous(admin_instance):
    previous_active = FinanceConfigurationVersion.objects.get(is_active=True)  # seeded v1

    request = Mock()
    request.user.id = "11111111-1111-1111-1111-111111111111"
    new_obj = FinanceConfigurationVersion(
        annual_rate_percent=Decimal("6.00"),
        term_months=60,
        down_payment_percent=Decimal("25.00"),
    )

    admin_instance.save_model(request, new_obj, form=Mock(), change=False)

    assert new_obj.version == previous_active.version + 1
    assert new_obj.is_active is True
    assert str(new_obj.created_by_user_id) == request.user.id

    previous_active.refresh_from_db()
    assert previous_active.is_active is False
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
uv run pytest finance/tests/test_admin.py -v
```

Expected: `ERROR` — `ModuleNotFoundError: No module named 'finance.admin'`.

- [ ] **Step 3: Implement the admin**

`backend/finance/admin.py`:

```python
from django import forms
from django.contrib import admin

from .models import FinanceConfigurationVersion
from .services import FinanceConfigurationService


class FinanceConfigurationVersionAddForm(forms.ModelForm):
    class Meta:
        model = FinanceConfigurationVersion
        fields = [
            "annual_rate_percent",
            "term_months",
            "down_payment_percent",
        ]


@admin.register(FinanceConfigurationVersion)
class FinanceConfigurationVersionAdmin(admin.ModelAdmin):
    list_display = (
        "version",
        "annual_rate_percent",
        "term_months",
        "down_payment_percent",
        "is_active",
        "created_at",
    )
    ordering = ("-version",)
    form = FinanceConfigurationVersionAddForm

    def has_view_permission(self, request, obj=None):
        return bool(request.user and request.user.is_staff)

    def has_add_permission(self, request):
        return bool(request.user and request.user.is_staff)

    def has_change_permission(self, request, obj=None):
        # Configuration versions are immutable once created. Staff use "Add"
        # to create (and thereby activate) a new version instead.
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def save_model(self, request, obj, form, change):
        obj.created_by_user_id = getattr(request.user, "id", None)
        FinanceConfigurationService.activate(obj)
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
uv run pytest finance/tests/test_admin.py -v
```

Expected: all four tests `PASS`.

- [ ] **Step 5: Commit**

```bash
git add backend/finance/admin.py backend/finance/tests/test_admin.py
git commit -m "feat(finance): add add-only django admin for finance configuration versions"
```

---

### Task 5: Amortization calculation engine (`Decimal`-exact, spec §17.1 formula)

**Files:**
- Create: `backend/finance/calculations.py`, `backend/finance/tests/test_calculations.py`

**Interfaces:**
- Produces: `finance.calculations.calculate_finance_quote(*, price: Decimal, down_payment_percent: Decimal, annual_rate_percent: Decimal, term_months: int) -> FinanceQuoteCalculation`, where `FinanceQuoteCalculation` is a frozen dataclass with `Decimal` fields `down_payment_amount`, `principal`, `monthly_payment`, `total_payment`, `total_interest`, each already rounded to 2 decimal places with `ROUND_HALF_UP`.

This is the exact formula from spec §17.1:

```text
price = listing price
down_payment = price × (down_payment_percent / 100)
P = price − down_payment
r = (annual_rate_percent / 100) / 12
n = term_months

if r = 0:
    monthly_payment = P / n
else:
    monthly_payment = P × [r × (1 + r)^n] / [(1 + r)^n − 1]

total_payment = monthly_payment × n
total_interest = total_payment − P
```

"Use `Decimal` with at least 28 digits of internal precision. Round currency results to two decimals with `ROUND_HALF_UP` only at API/presentation boundaries. Do not round intermediate values." `total_payment` and `total_interest` must be computed from the *unrounded* `monthly_payment`, not from the rounded, displayed value — verified below against spec §17.1's own worked examples.

- [ ] **Step 1: Write the failing tests**

`backend/finance/tests/test_calculations.py`:

```python
from decimal import Decimal

import pytest

from finance.calculations import calculate_finance_quote


def test_matches_spec_worked_example_one():
    # Spec §17.1: price 459,000 / 20% down / 5% / 48 months.
    result = calculate_finance_quote(
        price=Decimal("459000.00"),
        down_payment_percent=Decimal("20.00"),
        annual_rate_percent=Decimal("5.00"),
        term_months=48,
    )

    assert result.down_payment_amount == Decimal("91800.00")
    assert result.principal == Decimal("367200.00")
    assert result.monthly_payment == Decimal("8456.36")
    assert result.total_payment == Decimal("405905.12")
    assert result.total_interest == Decimal("38705.12")


def test_matches_spec_worked_example_two():
    # Spec §17.1: price 248,000 / 20% down / 5% / 48 months.
    result = calculate_finance_quote(
        price=Decimal("248000.00"),
        down_payment_percent=Decimal("20.00"),
        annual_rate_percent=Decimal("5.00"),
        term_months=48,
    )

    assert result.down_payment_amount == Decimal("49600.00")
    assert result.principal == Decimal("198400.00")
    assert result.monthly_payment == Decimal("4569.01")
    assert result.total_payment == Decimal("219312.57")
    assert result.total_interest == Decimal("20912.57")


def test_zero_interest_splits_principal_evenly_across_the_term():
    result = calculate_finance_quote(
        price=Decimal("120000.00"),
        down_payment_percent=Decimal("0.00"),
        annual_rate_percent=Decimal("0.00"),
        term_months=12,
    )

    assert result.principal == Decimal("120000.00")
    assert result.monthly_payment == Decimal("10000.00")
    assert result.total_payment == Decimal("120000.00")
    assert result.total_interest == Decimal("0.00")


def test_minimum_term_boundary_of_one_month():
    result = calculate_finance_quote(
        price=Decimal("10000.00"),
        down_payment_percent=Decimal("0.00"),
        annual_rate_percent=Decimal("5.00"),
        term_months=1,
    )

    assert result.principal == Decimal("10000.00")
    assert result.monthly_payment == Decimal("10041.67")
    assert result.total_payment == Decimal("10041.67")
    assert result.total_interest == Decimal("41.67")


def test_maximum_term_rate_and_down_payment_boundaries_together():
    # term_months=360 (max), annual_rate_percent=100 (max), down_payment_percent=99.99 (max).
    result = calculate_finance_quote(
        price=Decimal("500000.00"),
        down_payment_percent=Decimal("99.99"),
        annual_rate_percent=Decimal("100.00"),
        term_months=360,
    )

    assert result.down_payment_amount == Decimal("499950.00")
    assert result.principal == Decimal("50.00")
    assert result.monthly_payment == Decimal("4.17")
    assert result.total_payment == Decimal("1500.00")
    assert result.total_interest == Decimal("1450.00")


@pytest.mark.parametrize("term_months", [1, 48, 360])
def test_total_payment_always_equals_monthly_payment_times_term_within_rounding(term_months):
    result = calculate_finance_quote(
        price=Decimal("300000.00"),
        down_payment_percent=Decimal("10.00"),
        annual_rate_percent=Decimal("7.50"),
        term_months=term_months,
    )

    # total_payment is derived from the *unrounded* monthly payment, so it can
    # differ from monthly_payment * term_months by at most a few cents once
    # each side has been independently rounded.
    naive_total = result.monthly_payment * term_months
    assert abs(result.total_payment - naive_total) < Decimal("1.00")
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
uv run pytest finance/tests/test_calculations.py -v
```

Expected: `ERROR` — `ModuleNotFoundError: No module named 'finance.calculations'`.

- [ ] **Step 3: Implement the calculation engine**

`backend/finance/calculations.py`:

```python
import decimal
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

TWO_PLACES = Decimal("0.01")
CALCULATION_PRECISION = 28


@dataclass(frozen=True)
class FinanceQuoteCalculation:
    down_payment_amount: Decimal
    principal: Decimal
    monthly_payment: Decimal
    total_payment: Decimal
    total_interest: Decimal


def _round_currency(value: Decimal) -> Decimal:
    return value.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def calculate_finance_quote(
    *,
    price: Decimal,
    down_payment_percent: Decimal,
    annual_rate_percent: Decimal,
    term_months: int,
) -> FinanceQuoteCalculation:
    """Standard fixed-rate, fully amortizing monthly payment calculation
    (spec §17.1). All intermediate arithmetic stays in `Decimal` at 28
    significant digits of precision; rounding to two decimals with
    ROUND_HALF_UP happens only once, per output field, at the very end.
    `total_payment` and `total_interest` are derived from the unrounded
    `monthly_payment`, not the rounded, displayed value.
    """
    with decimal.localcontext() as ctx:
        ctx.prec = CALCULATION_PRECISION

        down_payment_amount_exact = price * down_payment_percent / Decimal("100")
        principal_exact = price - down_payment_amount_exact
        monthly_rate = (annual_rate_percent / Decimal("100")) / Decimal("12")

        if monthly_rate == 0:
            monthly_payment_exact = principal_exact / Decimal(term_months)
        else:
            growth_factor = (Decimal("1") + monthly_rate) ** term_months
            monthly_payment_exact = (
                principal_exact
                * (monthly_rate * growth_factor)
                / (growth_factor - Decimal("1"))
            )

        total_payment_exact = monthly_payment_exact * Decimal(term_months)
        total_interest_exact = total_payment_exact - principal_exact

        return FinanceQuoteCalculation(
            down_payment_amount=_round_currency(down_payment_amount_exact),
            principal=_round_currency(principal_exact),
            monthly_payment=_round_currency(monthly_payment_exact),
            total_payment=_round_currency(total_payment_exact),
            total_interest=_round_currency(total_interest_exact),
        )
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
uv run pytest finance/tests/test_calculations.py -v
```

Expected: all seven tests `PASS`. (The first five assert exact figures verified in advance by running this exact algorithm — see the plan's own working notes; none of these numbers are guessed.)

- [ ] **Step 5: Commit**

```bash
git add backend/finance/calculations.py backend/finance/tests/test_calculations.py
git commit -m "feat(finance): add decimal-exact amortization calculation engine"
```

---

### Task 6: Finance quote request serializer and validation

**Files:**
- Create: `backend/finance/serializers.py`, `backend/finance/tests/test_serializers.py`

**Interfaces:**
- Produces: `finance.serializers.FinanceQuoteRequestSerializer` (fields: `price`, `down_payment_percent`, `annual_rate_percent`, `term_months`, `currency`) and `finance.serializers.SUPPORTED_CURRENCIES`.

**Note (ruling):** spec §17.3 separately lists "Principal must remain positive" as a validation rule. Given `down_payment_percent`'s upper bound of 99.99% and `price`'s lower bound of 0.01, `principal = price × (1 − down_payment_percent/100)` is always strictly positive (minimum ≈ `0.01 × 0.0001 = 0.000001`) purely as a consequence of those two field-level bounds — there is no reachable input that passes both field validators yet produces a non-positive principal. No separate "principal must remain positive" check is added, since it would be unreachable dead code; the two field-level validators already fully enforce it.

**Note (ruling):** spec §11.4 says listing currency is "ISO-4217, initially EUR." Since the `listings` app doesn't exist in this phase, `SUPPORTED_CURRENCIES` is a plain module-level tuple, `("EUR",)`, checked directly in this serializer rather than looked up from any listing/platform-settings table.

- [ ] **Step 1: Write the failing tests**

`backend/finance/tests/test_serializers.py`:

```python
import pytest

from finance.serializers import FinanceQuoteRequestSerializer


def _valid_payload(**overrides):
    payload = {
        "price": "459000.00",
        "down_payment_percent": "20.00",
        "annual_rate_percent": "5.00",
        "term_months": 48,
        "currency": "EUR",
    }
    payload.update(overrides)
    return payload


def test_accepts_a_fully_valid_payload():
    from decimal import Decimal

    serializer = FinanceQuoteRequestSerializer(data=_valid_payload())

    assert serializer.is_valid(), serializer.errors
    assert serializer.validated_data["price"] == Decimal("459000.00")
    assert serializer.validated_data["currency"] == "EUR"


def test_lowercase_currency_is_normalized_to_uppercase():
    serializer = FinanceQuoteRequestSerializer(data=_valid_payload(currency="eur"))

    assert serializer.is_valid(), serializer.errors
    assert serializer.validated_data["currency"] == "EUR"


@pytest.mark.parametrize("bad_price", ["0.00", "-1.00", "1000000000.00"])
def test_rejects_price_outside_allowed_range(bad_price):
    serializer = FinanceQuoteRequestSerializer(data=_valid_payload(price=bad_price))

    assert not serializer.is_valid()
    assert "price" in serializer.errors


@pytest.mark.parametrize("bad_rate", ["-0.01", "100.01"])
def test_rejects_annual_rate_outside_allowed_range(bad_rate):
    serializer = FinanceQuoteRequestSerializer(data=_valid_payload(annual_rate_percent=bad_rate))

    assert not serializer.is_valid()
    assert "annual_rate_percent" in serializer.errors


@pytest.mark.parametrize("bad_term", [0, 361])
def test_rejects_term_outside_allowed_range(bad_term):
    serializer = FinanceQuoteRequestSerializer(data=_valid_payload(term_months=bad_term))

    assert not serializer.is_valid()
    assert "term_months" in serializer.errors


@pytest.mark.parametrize("bad_down_payment", ["-0.01", "100.00"])
def test_rejects_down_payment_outside_allowed_range(bad_down_payment):
    serializer = FinanceQuoteRequestSerializer(
        data=_valid_payload(down_payment_percent=bad_down_payment)
    )

    assert not serializer.is_valid()
    assert "down_payment_percent" in serializer.errors


def test_rejects_unsupported_currency_with_a_stable_error_code():
    serializer = FinanceQuoteRequestSerializer(data=_valid_payload(currency="USD"))

    assert not serializer.is_valid()
    assert serializer.errors["currency"][0].code == "unsupported_currency"
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
uv run pytest finance/tests/test_serializers.py -v
```

Expected: `ERROR` — `ModuleNotFoundError: No module named 'finance.serializers'`.

- [ ] **Step 3: Implement the serializer**

`backend/finance/serializers.py`:

```python
from decimal import Decimal

from rest_framework import serializers

SUPPORTED_CURRENCIES = ("EUR",)


class FinanceQuoteRequestSerializer(serializers.Serializer):
    price = serializers.DecimalField(
        max_digits=11,
        decimal_places=2,
        min_value=Decimal("0.01"),
        max_value=Decimal("999999999.99"),
    )
    down_payment_percent = serializers.DecimalField(
        max_digits=7,
        decimal_places=4,
        min_value=Decimal("0"),
        max_value=Decimal("99.99"),
    )
    annual_rate_percent = serializers.DecimalField(
        max_digits=7,
        decimal_places=4,
        min_value=Decimal("0"),
        max_value=Decimal("100"),
    )
    term_months = serializers.IntegerField(min_value=1, max_value=360)
    currency = serializers.CharField(max_length=3)

    def validate_currency(self, value):
        normalized = value.upper()
        if normalized not in SUPPORTED_CURRENCIES:
            raise serializers.ValidationError(
                "Currency is not supported.", code="unsupported_currency"
            )
        return normalized
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
uv run pytest finance/tests/test_serializers.py -v
```

Expected: all tests `PASS`.

- [ ] **Step 5: Commit**

```bash
git add backend/finance/serializers.py backend/finance/tests/test_serializers.py
git commit -m "feat(finance): add finance quote request serializer with validation"
```

---

### Task 7: `POST /api/v1/finance/quotes/` endpoint

**Files:**
- Create: `backend/finance/views.py`, `backend/finance/tests/test_views.py`
- Modify: `backend/config/urls.py`

**Interfaces:**
- Consumes: `finance.serializers.FinanceQuoteRequestSerializer` (Task 6), `finance.calculations.calculate_finance_quote` (Task 5).
- Produces: `finance.views.FinanceQuoteView`, wired to `POST /api/v1/finance/quotes/` (URL name `finance-quote`).

**Note (ruling):** spec §17.4 describes two request contexts: (1) `listing_id` — server loads price/settings from a listing, and (2) manual finance-page values. Because the `listings` app doesn't exist in this concurrently-planned phase, this endpoint implements **context 2 only**. The request serializer intentionally has no `listing_id` field. A later phase that integrates finance with listings (after spec Phase 4 lands) should extend `FinanceQuoteRequestSerializer` to accept an optional `listing_id`, look up the listing's price and effective settings (applying the §17.2 configuration-precedence rules this plan does not implement), and report an effective `source: "GLOBAL" | "LISTING_OVERRIDE"` — none of that exists yet.

**Note (ruling):** the response shape matches spec §17.4's example exactly, including that it does **not** echo back `down_payment_percent` (only the derived `down_payment_amount` currency value) — that is the spec's own example response shape, not an omission introduced by this plan.

**Note (ruling):** this endpoint's response always sets `configuration_version` to `null`. Every quote this plan computes is a manual/explicit-values quote (context 2 above) — the client supplies its own `price`/`annual_rate_percent`/`term_months`/`down_payment_percent` and the calculation never reads `FinanceConfigurationService.get_active_configuration()` at all, so there is no active configuration version that actually produced these numbers. Reporting the currently-active version here would misleadingly imply a relationship between this quote and the stored global defaults that doesn't exist. A later phase's listing-linked ("card") context (§17.4 context 1), which genuinely does calculate from the active configuration's stored values, should populate `configuration_version` with the real version number it used.

- [ ] **Step 1: Write the failing tests**

`backend/finance/tests/test_views.py`:

```python
import pytest
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_finance_quote_endpoint_matches_spec_worked_example():
    client = APIClient()

    response = client.post(
        "/api/v1/finance/quotes/",
        data={
            "price": "459000.00",
            "down_payment_percent": "20.00",
            "annual_rate_percent": "5.00",
            "term_months": 48,
            "currency": "EUR",
        },
        format="json",
    )

    assert response.status_code == 200
    assert response.data == {
        "currency": "EUR",
        "price": "459000.00",
        "down_payment_amount": "91800.00",
        "principal": "367200.00",
        "annual_rate_percent": "5.0000",
        "term_months": 48,
        "monthly_payment": "8456.36",
        "total_payment": "405905.12",
        "total_interest": "38705.12",
        # Manual quotes ignore the stored active configuration entirely (the
        # client supplied every input), so a version number here would
        # misleadingly imply a relationship that doesn't exist — see Task 7's
        # ruling note.
        "configuration_version": None,
        "disclaimer_key": "finance.illustrative_disclaimer",
    }


@pytest.mark.django_db
def test_finance_quote_endpoint_works_for_anonymous_guests():
    client = APIClient()

    response = client.post(
        "/api/v1/finance/quotes/",
        data={
            "price": "248000.00",
            "down_payment_percent": "20.00",
            "annual_rate_percent": "5.00",
            "term_months": 48,
            "currency": "EUR",
        },
        format="json",
    )

    assert response.status_code == 200
    assert response.data["monthly_payment"] == "4569.01"


@pytest.mark.django_db
def test_finance_quote_endpoint_rejects_unsupported_currency():
    client = APIClient()

    response = client.post(
        "/api/v1/finance/quotes/",
        data={
            "price": "100000.00",
            "down_payment_percent": "20.00",
            "annual_rate_percent": "5.00",
            "term_months": 48,
            "currency": "USD",
        },
        format="json",
    )

    assert response.status_code == 400
    assert response.data["error"]["code"] == "unsupported_currency"


@pytest.mark.django_db
def test_finance_quote_endpoint_rejects_invalid_term_with_field_errors():
    client = APIClient()

    response = client.post(
        "/api/v1/finance/quotes/",
        data={
            "price": "100000.00",
            "down_payment_percent": "20.00",
            "annual_rate_percent": "5.00",
            "term_months": 400,
            "currency": "EUR",
        },
        format="json",
    )

    assert response.status_code == 400
    assert response.data["error"]["code"] == "validation_error"
    assert "term_months" in response.data["error"]["fields"]


@pytest.mark.django_db
def test_finance_quote_endpoint_echoes_request_id_header_on_error():
    client = APIClient()

    response = client.post(
        "/api/v1/finance/quotes/",
        data={
            "price": "100000.00",
            "down_payment_percent": "20.00",
            "annual_rate_percent": "5.00",
            "term_months": 400,
            "currency": "EUR",
        },
        format="json",
        HTTP_X_REQUEST_ID="req-test-123",
    )

    assert response.data["error"]["request_id"] == "req-test-123"
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
uv run pytest finance/tests/test_views.py -v
```

Expected: `FAIL` — `/api/v1/finance/quotes/` returns 404 (the route doesn't exist yet).

- [ ] **Step 3: Implement the view and wire the URL**

`backend/finance/views.py`:

```python
from decimal import Decimal

from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .calculations import calculate_finance_quote
from .serializers import FinanceQuoteRequestSerializer

DISCLAIMER_KEY = "finance.illustrative_disclaimer"


def _error_code_from_serializer_errors(errors):
    currency_errors = errors.get("currency")
    if currency_errors:
        for detail in currency_errors:
            if getattr(detail, "code", None) == "unsupported_currency":
                return "unsupported_currency"
    return "validation_error"


class FinanceQuoteView(APIView):
    """Manual finance-quote calculation (spec §17.4, context 2 only).

    Listing-linked quotes (context 1: `listing_id`) are out of scope for this
    phase — see this plan's Task 7 ruling note.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = FinanceQuoteRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    "error": {
                        "code": _error_code_from_serializer_errors(serializer.errors),
                        "message": "One or more finance quote fields are invalid.",
                        "fields": serializer.errors,
                        "request_id": request.headers.get("X-Request-ID", ""),
                    }
                },
                status=400,
            )

        data = serializer.validated_data
        result = calculate_finance_quote(
            price=data["price"],
            down_payment_percent=data["down_payment_percent"],
            annual_rate_percent=data["annual_rate_percent"],
            term_months=data["term_months"],
        )

        return Response(
            {
                "currency": data["currency"],
                "price": str(data["price"].quantize(Decimal("0.01"))),
                "down_payment_amount": str(result.down_payment_amount),
                "principal": str(result.principal),
                "annual_rate_percent": str(data["annual_rate_percent"].quantize(Decimal("0.0001"))),
                "term_months": data["term_months"],
                "monthly_payment": str(result.monthly_payment),
                "total_payment": str(result.total_payment),
                "total_interest": str(result.total_interest),
                # This is a manual quote (client-supplied inputs only) — it
                # never reads the stored active configuration, so there is no
                # configuration version that actually produced these numbers.
                # Reporting the currently-active version here would misleadingly
                # imply a relationship that doesn't exist (see Task 7's ruling
                # note above).
                "configuration_version": None,
                "disclaimer_key": DISCLAIMER_KEY,
            },
            status=200,
        )
```

Modify `backend/config/urls.py`. Current content:

```python
"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path

from common.views import HealthCheckView, StripeWebhookView

urlpatterns = [
    path('admin/', admin.site.urls),
    path("api/v1/health/", HealthCheckView.as_view(), name="health-check"),
    path("api/v1/stripe/webhook/", StripeWebhookView.as_view(), name="stripe-webhook"),
]
```

Add the `finance` import and route:

```python
"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path

from common.views import HealthCheckView, StripeWebhookView
from finance.views import FinanceQuoteView

urlpatterns = [
    path('admin/', admin.site.urls),
    path("api/v1/health/", HealthCheckView.as_view(), name="health-check"),
    path("api/v1/stripe/webhook/", StripeWebhookView.as_view(), name="stripe-webhook"),
    path("api/v1/finance/quotes/", FinanceQuoteView.as_view(), name="finance-quote"),
]
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
uv run pytest finance/tests/test_views.py -v
```

Expected: all five tests `PASS`.

- [ ] **Step 5: Manual end-to-end verification against real infrastructure**

With `docker compose up -d` running (Phase 0/1) and migrations applied:

```bash
uv run python manage.py runserver 8020
```

In a second terminal:

```bash
curl -s -X POST http://localhost:8020/api/v1/finance/quotes/ \
  -H "Content-Type: application/json" \
  -d '{"price": "459000.00", "down_payment_percent": "20.00", "annual_rate_percent": "5.00", "term_months": 48, "currency": "EUR"}' \
  | python -m json.tool
```

Expected: HTTP 200 with the exact JSON body from Task 7's first test above (`monthly_payment` `"8456.36"`, etc.).

- [ ] **Step 6: Commit**

```bash
git add backend/finance/views.py backend/finance/tests/test_views.py backend/config/urls.py
git commit -m "feat(finance): add POST /api/v1/finance/quotes/ endpoint"
```

---

### Task 8: Final integration pass and activity log update

**Files:**
- Modify: `ACTIVITY.md`

**Interfaces:** none — this task verifies the prior 7 tasks work together and records that fact.

- [ ] **Step 1: Full-suite regression run**

```bash
cd backend
uv run python manage.py check
uv run python manage.py migrate
uv run pytest -v
```

Expected: `manage.py check` reports no issues; all tests across `common/` (Phase 0/1) and `finance/` (this plan) pass in one run.

- [ ] **Step 2: Confirm the spec §17 "Definition of done" checklist**

Walk through spec §17's Definition of Done against what this plan built, and confirm each item:

- "Python unit tests cover zero interest, defaults, boundary values and rounding." → `finance/tests/test_calculations.py` (Task 5) covers all four.
- "Frontend and backend results match exactly; frontend may preview but server response is authoritative." → not applicable yet; no frontend exists for finance until spec Phase 9.
- "Changing the Django setting changes card and finance-page results after cache invalidation." → demonstrated by `finance/tests/test_services.py::test_activate_deactivates_previous_version_and_invalidates_cache` (Task 3); no card/finance-page UI exists yet to visually confirm (Phase 9).
- "No page presents the estimate as a lender offer." → the API response only ever returns `disclaimer_key`, never rendered lender language; no frontend page exists yet to check.

- [ ] **Step 3: Update `ACTIVITY.md`**

Append a new entry at the top of the `## Log` section:

```markdown
### 2026-09-17 — Phase 8 finance configuration and calculation engine complete

- Implemented `docs/superpowers/plans/2026-09-17-phase-8-finance-calculation-engine.md` in full.
- New `finance` Django app: `FinanceConfigurationVersion` (versioned, immutable, exactly-one-active-row DB constraint, seeded with the spec default of 5% / 48 months / 20% down), `FinanceConfigurationService` (cached active-config lookup, versioned activation), a `Decimal`-exact amortization calculation engine matching spec §17.1's worked examples exactly, and `POST /api/v1/finance/quotes/` for manual (non-listing) finance estimates.
- Staff manage finance defaults via Django admin by adding a new configuration version (existing versions are permanently read-only, never editable in place).
- Known limitations: no `listing_id` quote context (needs spec Phase 4's `listings` app); no `FinanceQuoteLog` persistence (needs `listings`/`User`); no broker-override/configuration-precedence mechanism at all yet (needs listings; deliberately not speculatively added to `FinanceConfigurationVersion` per YAGNI, since its shape isn't known until Phase 9 is planned); no rate limiting on the quote endpoint; `created_by_user_id` is a loose UUID, not yet a real foreign key (needs spec Phase 3's `User` model). All of these are deferred to the phase that integrates finance with listings (spec Phase 9 or later), by design — this phase was scoped to run concurrently with Phase 3/4.
- Next: spec Phase 9 (finance card UI and broker listing toggle) once this plan and the Phase 4 taxonomy/listings plan have both landed.
```

Update the "Current State" section to mention the `finance` app alongside `common`.

- [ ] **Step 4: Commit**

```bash
git add ACTIVITY.md
git commit -m "docs: record phase 8 finance calculation engine completion in activity log"
```

---

## Known Limitations (carried forward, not fixed by this plan)

- **No `listing_id` quote context** (spec §17.4, context 1) — only the manual/explicit-values context (context 2) is implemented. Adding it requires the `listings` app (spec Phase 4), which this plan deliberately does not depend on.
- **No `FinanceQuoteLog` model** (spec §11.6, explicitly "optional but recommended," not part of §17's Definition of Done) — it requires nullable `listing`/`viewer_user` foreign keys that don't exist until Phase 4/Phase 3 land. A later phase should add it once those models exist.
- **No configuration-precedence / broker-override mechanism at all** (spec §17.2) — spec §11.6's `FinanceConfigurationVersion` field list has no broker-override field, no listing exists yet to actually override anything, and this field isn't consumed anywhere in this plan. Per YAGNI, no speculative `broker_overrides_enabled`-style field was added to `FinanceConfigurationVersion` — its shape depends on requirements Phase 9 hasn't defined yet. No `GLOBAL`/`LISTING_OVERRIDE` effective-source reporting is implemented either. A later phase should design and add whatever override mechanism it actually needs once listings exist.
- **No rate limiting** on `POST /api/v1/finance/quotes/` (spec §30.4) — the spec explicitly allows the calculation itself to "remain reasonably accessible," and no other endpoint in this codebase has rate-limiting infrastructure yet either.
- **No `GET /api/v1/platform/public-settings/` endpoint** — that belongs to spec Phase 2's `platform_settings` app (safe public display of finance defaults), not this plan.
- **`created_by_user_id` is a loose nullable UUID, not a foreign key** — convert it to a real `ForeignKey` to `User` in a follow-up migration once spec Phase 3 (identity) lands.
- **No WebSocket/email notification on finance configuration changes** — the spec does not request one for this specific admin action (unlike, e.g., the "Other model" taxonomy-mapping notification), so none was added.
- **No frontend work at all** — spec Phase 9 builds the finance card UI, calculator page and broker listing toggle on top of this phase's API; this plan is backend-only by explicit scope.
- **Auditability (spec §2.4)** for staff configuration changes currently relies on Django's built-in `django.contrib.admin.models.LogEntry` (created automatically for any admin "Add" action — already available for free since `django.contrib.admin` was installed in Phase 0/1, no new code needed here) plus `FinanceConfigurationVersion`'s own immutable, append-only version history (querying all versions ordered by `created_at`/`version` reconstructs the full before/after timeline exactly, since nothing is ever overwritten). A dedicated structured audit-event record (actor/action/target/before-after/request-id/source, shared uniformly across every staff-editable model per spec §2.4) should be wired in once Phase 2's audit foundation exists; this plan deliberately does not invent its own one-off audit-event schema for just this model, since Phase 2 owns that shared foundation and its interface was not yet finalized at the time this plan was written.
- **If SEO/page caching is introduced later** (spec §17.5: "If SEO/page caching exists, include finance configuration version in the cache key or purge affected caches"), it does not exist yet anywhere in this codebase, so there is nothing to purge yet — revisit when page caching is introduced.
