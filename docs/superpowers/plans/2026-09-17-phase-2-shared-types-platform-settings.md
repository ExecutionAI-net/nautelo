# NAUTA Phase 2 — Shared Domain Types, Platform Settings & Audit Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the three shared/foundational pieces every later domain phase depends on: (1) reusable abstract base model mixins (UUID primary key, timestamps) other apps' models will extend, (2) an append-only `audit` app with an `AuditEvent` model and a `record_audit_event()` service every mutation-heavy phase will call, and (3) a `platform_settings` app implementing the spec's typed, staff-editable `PlatformSetting` key/value store (with schema validation, versioning and audit logging) plus a generic `FeatureFlag` mechanism — including the public `GET /api/v1/platform/public-settings/` endpoint the frontend needs for finance/quota display values.

**Architecture:** Three new/modified Django pieces, layered with no cycles: `common` (already exists — gains two abstract model mixins, no new DB tables) ← `audit` (new app, depends only on `common`) ← `platform_settings` (new app, depends on `common` and `audit`). Both new apps are pure DRF/Django-admin backed; `platform_settings` exposes exactly one public, unauthenticated read endpoint per the spec's API inventory. No domain models (User, BoatListing, etc.) are created here — this phase is infrastructure/foundation only, consumed by Phase 3 (identity) and Phase 8 (finance calculation), which are being planned in parallel against this same plan's interfaces.

**Tech Stack:** Python 3.13, `uv`, Django 5.2, Django REST Framework, PostgreSQL 16 (via the existing `django.core.cache.backends.redis.RedisCache` Redis cache backend — no new dependencies needed), `pytest` + `pytest-django`. No new third-party packages are required for this phase.

**Spec:** [`NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md`](../../../NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md) §7 (phase order, row 2), §10 (Phase 2 — the section this plan implements in full), §2 (non-negotiable implementation principles), §30 (API conventions), §39 (developer execution protocol). Structural template and existing-infrastructure reference: [`2026-09-17-phase-0-1-infrastructure.md`](2026-09-17-phase-0-1-infrastructure.md) (already merged to `dev` — read it before touching any file this plan modifies).

## Execution Model

Same per-task branch/PR model established by the Phase 0/1 plan (see that plan's "Execution Model" section): branch each task off the current tip of `dev` (`git checkout -b phase2-task-N-<slug> dev`), run the implementer → reviewer → fix-loop cycle, open a PR into `dev`, merge only when CI is green and the branch is conflict-free, delete the branch, branch the next task from the new `dev` tip.

**Known cross-phase collision risk (recorded in `docs/superpowers/PHASE-TRACKER.md`):** `backend/config/settings/base.py`'s `INSTALLED_APPS` and `backend/config/urls.py` are shared files that Phase 3, Phase 4 and Phase 8's plans (being written/executed in parallel) will also append to. This plan only *appends* one `INSTALLED_APPS` entry per new app (Task 1: `"audit"`; Task 2: `"platform_settings"`) and one `path(...)` entry to `urlpatterns` (Task 4) — never reorders or reformats existing lines — so a concurrent merge from another phase should rebase cleanly rather than conflict.

## Global Constraints

- Python 3.13 + `uv` (backend); Django 5.2, DRF, PostgreSQL 16, Redis 7 — all already configured by Phase 0/1 in `backend/config/settings/{base,dev,test,prod}.py`. This plan does not touch Celery, Channels, S3/MinIO or Stripe configuration — nothing in Phase 2's scope needs them.
- Backend dev server runs on port **8020**, frontend on **3020** (non-default on this dev machine) — irrelevant to this plan's backend-only work beyond manual `curl` verification steps, which use `8020`.
- **PostgreSQL only in tests, never SQLite** (spec §34.2, previously violated and reverted in this project) — `backend/config/settings/test.py` is never modified by this plan, and no task overrides `DATABASES`/`CACHES` to SQLite/LocMem. This matters concretely here: Task 3's `update_setting()` uses `select_for_update()`, which SQLite cannot properly honor — real Postgres is required for that test to mean anything.
- All primary keys are UUIDs unless stated otherwise (spec §11 preamble); all timestamps are timezone-aware UTC (`USE_TZ = True`, already set); monetary/rate fields use `Decimal`, never binary floating point.
- Every visible/served value must map to a real backend source — no hard-coded or invented settings values; the 12 `PlatformSetting` keys this plan owns and their defaults come verbatim from spec §10.1's table (see Task 2) — the three finance rate/term/down-payment keys from that table are owned instead by Phase 8's `FinanceConfigurationVersion` model (see the Note (ruling) in Task 2, Step 4).
- Server authority: nothing in this plan trusts client input without backend validation — `PlatformSetting.value` is validated against a fixed Python registry (type + range) before it can be saved, matching spec §2.1–§2.2.
- Atomicity and auditability (spec §2.3–§2.4): every settings/flag mutation runs inside one `transaction.atomic()` block that (a) locks the row with `select_for_update()`, (b) validates, (c) saves, (d) bumps the settings version, (e) records an `AuditEvent` — all-or-nothing — and defers only the **cache** invalidation to `transaction.on_commit()`. The audit event itself is written inside the same transaction as the change it describes (a ruling — see the note after Task 1), not deferred, so a rolled-back mutation never leaves behind an orphaned audit row.
- No partial/visual-only implementations, no faked/hardcoded demo data, no TODO placeholders for backend enforcement (spec §39). TDD throughout: failing test first, minimal implementation, passing test, commit.
- **Scope ruling (from the task brief, recorded here so it isn't re-litigated per task):** this plan builds only what spec §10 and the phase-table's "Enums, settings, feature flags, audit base" row actually require *with a real consumer inside this phase*. It does **not** define `ListingStatus`, `RevisionStatus`, `EntitlementState`, `PaymentOrderStatus`, broker/professional status or role enums, or a `Locale` choice type — those belong to the phase that owns the model carrying that state machine (Phase 3, 11, 13, 14 respectively) and defining them here without the owning model risks drifting from that model's real transition logic. The only enums this plan produces are `AuditEvent.ActorType` / `AuditEvent.Source` (spec §10.2, consumed by every future audited mutation) and `platform_settings.registry.SettingValueType` (consumed by the registry itself). It does not define `User`, org, listing, entitlement or payment models (Phase 3 / Phase 8+ territory).

---

## File Structure

```
backend/
├── common/
│   └── models.py                                  (MODIFY — add UUIDModel, TimeStampedModel, UUIDTimeStampedModel)
├── audit/
│   ├── __init__.py
│   ├── apps.py
│   ├── admin.py
│   ├── models.py
│   ├── services.py
│   ├── migrations/
│   │   ├── __init__.py
│   │   └── 0001_initial.py                        (auto-generated)
│   └── tests/
│       ├── __init__.py
│       ├── conftest.py
│       ├── test_models.py
│       ├── test_services.py
│       └── test_admin.py
├── platform_settings/
│   ├── __init__.py
│   ├── apps.py
│   ├── admin.py
│   ├── models.py
│   ├── registry.py
│   ├── services.py
│   ├── views.py
│   ├── migrations/
│   │   ├── __init__.py
│   │   ├── 0001_initial.py                        (auto-generated)
│   │   ├── 0002_seed_default_settings.py          (hand-written data migration)
│   │   ├── 0003_platformsettingsversion.py        (auto-generated)
│   │   └── 0004_featureflag.py                    (auto-generated)
│   └── tests/
│       ├── __init__.py
│       ├── conftest.py
│       ├── test_registry.py
│       ├── test_models.py
│       ├── test_services.py
│       ├── test_admin.py
│       ├── test_views.py
│       └── test_feature_flags.py
└── config/
    ├── settings/base.py                            (MODIFY — INSTALLED_APPS += "audit", "platform_settings")
    └── urls.py                                     (MODIFY — add public-settings route)
```

**Note on cross-phase design decisions (read before Task 1):**

1. **`AuditEvent.actor_user` and `AUTH_USER_MODEL` timing risk.** No custom `User` model exists yet — `AUTH_USER_MODEL` still resolves to Django's built-in `django.contrib.auth.models.User`, and Phase 0/1 already ran `manage.py migrate` against it, so that table already exists in the dev database. This plan's `AuditEvent.actor_user` (and `PlatformSetting.updated_by` / `FeatureFlag.updated_by`) are Foreign Keys to `settings.AUTH_USER_MODEL` — the idiomatic, swap-safe Django pattern (`migrations.swappable_dependency` tracks the *setting*, not a hard-coded table name). This is *not* a problem for this plan's own migrations. It **is** a real open risk for whichever session implements Phase 3: introducing a custom `accounts.User` and pointing `AUTH_USER_MODEL` at it, in a database that has already migrated against the stock `auth.User`, is Django's classic "changed `AUTH_USER_MODEL` after the initial migrate" trap and will need either a full dev-database reset (drop + recreate + re-run all migrations from zero, safe since this is pre-launch/no production data) or a hand-written data migration. Flagging inline per the task brief rather than solving it here — it is Phase 3's decision to make, not this plan's.
2. **`PlatformSettingsVersion` vs. spec §11.6's `FinanceConfigurationVersion` are two different things, not duplicates.** Spec §10.1 says "Settings responses include a monotonically increasing `settings_version`" and §11.6 separately defines a fully historized `FinanceConfigurationVersion` table ("Updating settings creates a new version; it does not rewrite previous quotes"). These read similarly but serve different needs: this plan's `PlatformSettingsVersion` is a coarse global "has anything changed" counter across all 12 keys, used for cache-busting and freshness — it does **not** retain historical values. `FinanceConfigurationVersion` is Phase 8's own append-only, fully-valued snapshot table specifically so a past `FinanceQuoteLog` row stays reproducible after the global settings change again later. Phase 8 owns finance rate/term/down-payment entirely via its own `FinanceConfigurationVersion` model (stronger versioning than a generic setting affords) — this plan does not provide those three keys; only `finance.enabled` is shared. It should not try to reuse `PlatformSettingsVersion` for that purpose. Flagging this inline for whoever is planning/reviewing Phase 8 in parallel.
3. **Feature flag keys are not seeded by this plan.** Spec §35.1 lists nine concrete flag keys (`combined_services_professionals`, `unified_inquiries`, `contact_unlock`, `finance_estimates`, `unique_listing_views`, `individual_entitlements`, `stripe_entitlement_checkout`, `listing_revisions`, `realtime_staff_notifications`), but each gates a feature that doesn't exist yet. This plan builds only the generic `FeatureFlag` mechanism (model + `is_feature_enabled()`/`set_feature_flag()` services + admin + audit). The phase that implements each gated feature is expected to `get_or_create` its own flag row (typically via a data migration in its own plan) when it lands.

---

### Task 1: Shared base model mixins + `audit` app foundation

**Files:**
- Modify: `backend/common/models.py`
- Create: `backend/audit/__init__.py`, `backend/audit/apps.py`, `backend/audit/models.py`, `backend/audit/admin.py`, `backend/audit/services.py`
- Create: `backend/audit/migrations/__init__.py`, `backend/audit/migrations/0001_initial.py` (auto-generated)
- Create: `backend/audit/tests/__init__.py`, `backend/audit/tests/conftest.py`, `backend/audit/tests/test_models.py`, `backend/audit/tests/test_services.py`, `backend/audit/tests/test_admin.py`
- Modify: `backend/config/settings/base.py` (`INSTALLED_APPS += ["audit"]`)

**Interfaces:**
- Produces: `common.models.UUIDModel` (abstract; `id = UUIDField(primary_key=True, default=uuid4, editable=False)`), `common.models.TimeStampedModel` (abstract; `created_at`/`updated_at` auto-managed), and `common.models.UUIDTimeStampedModel` (abstract; combines both — the common case for most domain models, including Phase 3's `User`) — all importable by any later app's models. `audit.models.AuditEvent` (fields exactly per spec §10.2) with nested `AuditEvent.ActorType` (`USER`/`SYSTEM`/`STRIPE`) and `AuditEvent.Source` (`WEB`/`API`/`ADMIN`/`TASK`/`WEBHOOK`) choice enums. `audit.services.record_audit_event(*, actor_user, actor_type, action, target_type, target_id, source, before=None, after=None, request_id=None, metadata=None, ip_hash=None) -> AuditEvent`.
- Consumes: nothing from other apps (this is the foundation layer).

- [ ] **Step 1: Add the shared abstract base models to `common`**

`backend/common/models.py` (replace the placeholder file):

```python
import uuid

from django.db import models


class UUIDModel(models.Model):
    """Abstract base giving a model a UUID primary key instead of Django's
    default auto-incrementing integer, per the spec's "all primary keys are
    UUIDs unless stated otherwise" rule (NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md §11).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True


class TimeStampedModel(models.Model):
    """Abstract base adding auto-managed created_at/updated_at timestamps.

    Not suitable for append-only/immutable models (e.g. audit.AuditEvent),
    which should declare only `created_at` themselves — an `updated_at`
    field would imply the row can legitimately change after creation.
    """

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class UUIDTimeStampedModel(UUIDModel, TimeStampedModel):
    """Convenience base combining a UUID primary key with created_at/updated_at
    timestamps — the common case for most domain models (per the spec's "all
    primary keys are UUIDs, all timestamps are timezone-aware UTC" rule).
    Models that need only one of the two (e.g. append-only audit rows that
    should not have `updated_at`) should inherit from `UUIDModel` or
    `TimeStampedModel` directly instead.
    """

    class Meta:
        abstract = True
```

This third class exists specifically so Phase 3's `User` model (and other future domain models that need both a UUID primary key and timestamps) has a single base to inherit from for the common case, instead of every consumer app repeating `(UUIDModel, TimeStampedModel)`.

Note: abstract models generate no migration on their own — Django only creates migrations for concrete models. This step alone produces `manage.py makemigrations common` output of "No changes detected" (verified in Step 6 below), and is proven for real by `AuditEvent` (this task) and `PlatformSetting`/`FeatureFlag` (Task 2/5) actually inheriting from it.

- [ ] **Step 2: Scaffold the `audit` app and write the failing model tests**

```bash
cd backend
uv run python manage.py startapp audit
```

Delete the generated placeholder `audit/tests.py` (this project uses a `tests/` package, not a single `tests.py` — matches the existing `common` app's layout; leaving the stray file would shadow the package, a mistake already hit and fixed once in Phase 0/1).

Add `"audit"` to `INSTALLED_APPS` in `backend/config/settings/base.py`, directly after `"common"`:

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
    "audit",
]
```

`backend/audit/tests/__init__.py` — empty file.

`backend/audit/tests/conftest.py`:

```python
import pytest
from django.contrib.auth import get_user_model


@pytest.fixture
def staff_user(db):
    User = get_user_model()
    return User.objects.create_user(
        username="staff-audit",
        email="staff-audit@nautelo.local",
        password="pw",
        is_staff=True,
    )
```

`backend/audit/tests/test_models.py`:

```python
import pytest

from audit.models import AuditEvent


@pytest.mark.django_db
def test_audit_event_can_be_created_with_required_fields():
    event = AuditEvent.objects.create(
        actor_user=None,
        actor_type=AuditEvent.ActorType.SYSTEM,
        action="platform_setting.updated",
        target_type="platform_settings.PlatformSetting",
        target_id="finance.enabled",
        source=AuditEvent.Source.TASK,
        before={"value": True},
        after={"value": False},
        request_id="req-1",
    )

    assert event.id is not None
    assert event.created_at is not None
    assert event.metadata == {}
    assert event.ip_hash is None


@pytest.mark.django_db
def test_audit_event_survives_actor_user_deletion(staff_user):
    event = AuditEvent.objects.create(
        actor_user=staff_user,
        actor_type=AuditEvent.ActorType.USER,
        action="platform_setting.updated",
        target_type="platform_settings.PlatformSetting",
        target_id="finance.enabled",
        source=AuditEvent.Source.ADMIN,
        request_id="req-2",
    )

    staff_user.delete()
    event.refresh_from_db()

    assert event.actor_user_id is None
    assert event.action == "platform_setting.updated"


@pytest.mark.django_db
def test_audit_event_cannot_be_updated_once_created():
    event = AuditEvent.objects.create(
        actor_user=None,
        actor_type=AuditEvent.ActorType.SYSTEM,
        action="platform_setting.updated",
        target_type="platform_settings.PlatformSetting",
        target_id="finance.enabled",
        source=AuditEvent.Source.TASK,
        request_id="req-3",
    )

    event.action = "tampered"
    with pytest.raises(ValueError, match="immutable"):
        event.save()


@pytest.mark.django_db
def test_audit_event_cannot_be_deleted():
    event = AuditEvent.objects.create(
        actor_user=None,
        actor_type=AuditEvent.ActorType.SYSTEM,
        action="platform_setting.updated",
        target_type="platform_settings.PlatformSetting",
        target_id="finance.enabled",
        source=AuditEvent.Source.TASK,
        request_id="req-4",
    )

    with pytest.raises(ValueError, match="append-only"):
        event.delete()
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
uv run pytest audit/tests/test_models.py -v
```

Expected: `ERROR` / collection failure — `audit.models` has no `AuditEvent` attribute yet (the app currently only has Django's default empty `models.py`).

- [ ] **Step 4: Implement `AuditEvent`**

`backend/audit/models.py`:

```python
from django.conf import settings
from django.core.serializers.json import DjangoJSONEncoder
from django.db import models

from common.models import UUIDModel


class AuditEvent(UUIDModel):
    """Append-only audit trail entry (NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md §10.2).

    Rows are created only through audit.services.record_audit_event() —
    never edited or deleted once written, enforced in save()/delete() below
    and again at the Django Admin layer (see admin.py).
    """

    class ActorType(models.TextChoices):
        USER = "USER", "User"
        SYSTEM = "SYSTEM", "System"
        STRIPE = "STRIPE", "Stripe"

    class Source(models.TextChoices):
        WEB = "WEB", "Web"
        API = "API", "API"
        ADMIN = "ADMIN", "Admin"
        TASK = "TASK", "Task"
        WEBHOOK = "WEBHOOK", "Webhook"

    actor_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="audit_events",
    )
    actor_type = models.CharField(max_length=16, choices=ActorType.choices)
    action = models.CharField(max_length=255)
    target_type = models.CharField(max_length=255)
    target_id = models.CharField(max_length=255)
    request_id = models.CharField(max_length=64)
    source = models.CharField(max_length=16, choices=Source.choices)
    before = models.JSONField(null=True, blank=True, encoder=DjangoJSONEncoder)
    after = models.JSONField(null=True, blank=True, encoder=DjangoJSONEncoder)
    metadata = models.JSONField(default=dict, blank=True, encoder=DjangoJSONEncoder)
    ip_hash = models.CharField(max_length=64, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["target_type", "target_id"]),
            models.Index(fields=["actor_user", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.created_at:%Y-%m-%d %H:%M} {self.action} {self.target_type}:{self.target_id}"

    def save(self, *args, **kwargs):
        # `self._state.adding` (not `self.pk is None`) is the correct check
        # here: UUIDModel assigns a UUID at instantiation time (default=uuid4),
        # so a brand-new unsaved instance already has a non-None pk.
        if not self._state.adding:
            raise ValueError("AuditEvent records are immutable once created.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValueError("AuditEvent records are append-only and cannot be deleted.")
```

- [ ] **Step 5: Run the tests to verify they still fail (no migration yet), then generate and apply the migration**

```bash
uv run pytest audit/tests/test_models.py -v
```

Expected: `django.db.utils.ProgrammingError` (or similar) — the `audit_auditevent` table doesn't exist yet.

```bash
uv run python manage.py makemigrations audit
uv run python manage.py makemigrations common
```

Expected: `audit/migrations/0001_initial.py` is created (one `CreateModel` for `AuditEvent`, two `AddIndex` operations). The `common` command must print `No changes detected in app 'common'` — `UUIDModel`/`TimeStampedModel` are abstract and produce no schema (this confirms Step 1's note).

```bash
uv run python manage.py migrate
uv run pytest audit/tests/test_models.py -v
```

Expected: all four tests `PASS`.

- [ ] **Step 6: Write and implement `record_audit_event()`**

`backend/audit/tests/test_services.py`:

```python
import pytest

from audit.models import AuditEvent
from audit.services import record_audit_event


@pytest.mark.django_db
def test_record_audit_event_creates_a_row_with_defaults():
    event = record_audit_event(
        actor_user=None,
        actor_type=AuditEvent.ActorType.SYSTEM,
        action="platform_setting.updated",
        target_type="platform_settings.PlatformSetting",
        target_id="finance.enabled",
        source=AuditEvent.Source.TASK,
        before={"value": True},
        after={"value": False},
    )

    assert AuditEvent.objects.count() == 1
    assert event.metadata == {}
    assert event.request_id  # auto-generated when not provided


@pytest.mark.django_db
def test_record_audit_event_accepts_an_explicit_request_id_and_metadata():
    event = record_audit_event(
        actor_user=None,
        actor_type=AuditEvent.ActorType.SYSTEM,
        action="platform_setting.updated",
        target_type="platform_settings.PlatformSetting",
        target_id="finance.enabled",
        source=AuditEvent.Source.TASK,
        request_id="req-explicit",
        metadata={"reason": "scheduled_reset"},
    )

    assert event.request_id == "req-explicit"
    assert event.metadata == {"reason": "scheduled_reset"}
```

Run to verify failure first:

```bash
uv run pytest audit/tests/test_services.py -v
```

Expected: `ModuleNotFoundError` — `audit.services` doesn't exist yet.

`backend/audit/services.py`:

```python
import uuid

from .models import AuditEvent


def record_audit_event(
    *,
    actor_user,
    actor_type: str,
    action: str,
    target_type: str,
    target_id: str,
    source: str,
    before: dict | None = None,
    after: dict | None = None,
    request_id: str | None = None,
    metadata: dict | None = None,
    ip_hash: str | None = None,
) -> AuditEvent:
    """Create one immutable AuditEvent row.

    Callers are expected to invoke this from *inside* the same
    transaction.atomic() block as the change being described, so that a
    rolled-back mutation never leaves behind an orphaned audit row.
    """
    return AuditEvent.objects.create(
        actor_user=actor_user,
        actor_type=actor_type,
        action=action,
        target_type=target_type,
        target_id=str(target_id),
        source=source,
        before=before,
        after=after,
        request_id=request_id or str(uuid.uuid4()),
        metadata=metadata or {},
        ip_hash=ip_hash,
    )
```

Run to verify pass:

```bash
uv run pytest audit/tests/test_services.py -v
```

Expected: both tests `PASS`.

- [ ] **Step 7: Register a read-only Django Admin for `AuditEvent` and test its permissions**

`backend/audit/tests/test_admin.py`:

```python
from django.contrib import admin as django_admin

from audit.admin import AuditEventAdmin
from audit.models import AuditEvent


def test_audit_event_admin_denies_add_change_and_delete():
    admin_instance = AuditEventAdmin(AuditEvent, django_admin.site)

    assert admin_instance.has_add_permission(None) is False
    assert admin_instance.has_change_permission(None) is False
    assert admin_instance.has_delete_permission(None) is False
```

Run to verify it fails (`audit.admin` doesn't exist yet):

```bash
uv run pytest audit/tests/test_admin.py -v
```

`backend/audit/admin.py`:

```python
from django.contrib import admin

from .models import AuditEvent


@admin.register(AuditEvent)
class AuditEventAdmin(admin.ModelAdmin):
    list_display = (
        "created_at",
        "actor_type",
        "actor_user",
        "action",
        "target_type",
        "target_id",
        "source",
    )
    list_filter = ("actor_type", "source", "target_type")
    search_fields = ("target_id", "action", "request_id")
    date_hierarchy = "created_at"
    readonly_fields = [f.name for f in AuditEvent._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
```

Run to verify pass:

```bash
uv run pytest audit/tests/test_admin.py -v
uv run pytest audit/ -v
```

Expected: all `audit/` tests `PASS` (7 total across the three files).

- [ ] **Step 8: Commit**

```bash
git add backend/common/models.py backend/audit backend/config/settings/base.py
git commit -m "feat(backend): add uuid/timestamp base mixins and the audit app foundation"
```

---

### Task 2: `platform_settings` app — registry, model, and seeded defaults (read path)

**Files:**
- Create: `backend/platform_settings/__init__.py`, `apps.py`, `registry.py`, `models.py`, `services.py`
- Create: `backend/platform_settings/migrations/__init__.py`, `0001_initial.py` (auto-generated), `0002_seed_default_settings.py` (hand-written)
- Create: `backend/platform_settings/tests/__init__.py`, `test_registry.py`, `test_models.py`, `test_services.py`
- Modify: `backend/config/settings/base.py` (`INSTALLED_APPS += ["platform_settings"]`)

**Interfaces:**
- Consumes: `common.models.UUIDTimeStampedModel` (Task 1).
- Produces: `platform_settings.registry.SETTINGS_REGISTRY` (dict of 12 of spec §10.1's keys → `SettingDefinition` — the boolean `finance.enabled` only; the three finance rate/term/down-payment keys are owned by Phase 8's `FinanceConfigurationVersion` model instead, per the Note (ruling) in Step 4 below), `platform_settings.registry.coerce_value(value_type, raw_value)`, `platform_settings.models.PlatformSetting`, `platform_settings.services.get_setting_value(key: str) -> bool | int | Decimal`.

- [ ] **Step 1: Scaffold the app**

```bash
uv run python manage.py startapp platform_settings
```

Delete the generated placeholder `platform_settings/tests.py` (same reasoning as Task 1, Step 2).

Add `"platform_settings"` to `INSTALLED_APPS` in `backend/config/settings/base.py`, directly after `"audit"`:

```python
    "common",
    "audit",
    "platform_settings",
]
```

- [ ] **Step 2: Write the failing registry tests**

`backend/platform_settings/tests/__init__.py` — empty file.

`backend/platform_settings/tests/test_registry.py`:

```python
from decimal import Decimal

import pytest

from platform_settings.registry import SETTINGS_REGISTRY, SettingValueType, coerce_value

EXPECTED_KEYS_AND_DEFAULTS = {
    "finance.enabled": (SettingValueType.BOOLEAN, True),
    "individual.free_listing_count": (SettingValueType.INTEGER, 1),
    "individual.free_period_days": (SettingValueType.INTEGER, 365),
    "individual.free_publish_days": (SettingValueType.INTEGER, 30),
    "individual.paid_publish_days": (SettingValueType.INTEGER, 30),
    "individual.paid_entitlement_valid_days": (SettingValueType.INTEGER, 365),
    "media.private_base_image_limit": (SettingValueType.INTEGER, 1),
    "media.private_base_video_limit": (SettingValueType.INTEGER, 0),
    "media.upgraded_image_limit": (SettingValueType.INTEGER, 20),
    "media.upgraded_video_limit": (SettingValueType.INTEGER, 1),
    "media.broker_image_limit": (SettingValueType.INTEGER, 20),
    "media.broker_video_limit": (SettingValueType.INTEGER, 1),
}


def test_registry_defines_exactly_the_twelve_spec_keys():
    assert set(SETTINGS_REGISTRY) == set(EXPECTED_KEYS_AND_DEFAULTS)


@pytest.mark.parametrize("key, expected", EXPECTED_KEYS_AND_DEFAULTS.items())
def test_registry_default_and_type_match_spec_table(key, expected):
    expected_type, expected_default = expected
    definition = SETTINGS_REGISTRY[key]

    assert definition.value_type is expected_type
    assert definition.default == expected_default


def test_coerce_value_rejects_non_boolean_for_boolean_type():
    with pytest.raises(ValueError):
        coerce_value(SettingValueType.BOOLEAN, "true")


def test_coerce_value_rejects_non_integer_for_integer_type():
    with pytest.raises(ValueError):
        coerce_value(SettingValueType.INTEGER, "48")
    with pytest.raises(ValueError):
        coerce_value(SettingValueType.INTEGER, True)  # bool is an int subclass in Python


def test_coerce_value_parses_decimal_from_string_or_number():
    assert coerce_value(SettingValueType.DECIMAL, "5.0000") == Decimal("5.0000")
    assert coerce_value(SettingValueType.DECIMAL, 5) == Decimal("5")


def test_media_private_base_limits_require_exact_values():
    image_definition = SETTINGS_REGISTRY["media.private_base_image_limit"]
    video_definition = SETTINGS_REGISTRY["media.private_base_video_limit"]

    image_definition.validator(1)
    video_definition.validator(0)
    with pytest.raises(ValueError):
        image_definition.validator(2)
    with pytest.raises(ValueError):
        video_definition.validator(1)
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
uv run pytest platform_settings/tests/test_registry.py -v
```

Expected: `ModuleNotFoundError` — `platform_settings.registry` doesn't exist yet.

- [ ] **Step 4: Implement the registry**

**Note (ruling):** spec §11.6 independently defines a dedicated `FinanceConfigurationVersion` model (its own `version` integer, `is_active` flag, and a full snapshot of rate/term/down-payment per row) specifically so historical finance quotes stay reproducible even after defaults change — a stronger guarantee than this plan's generic `PlatformSetting` + single global `settings_version` counter can offer (a generic setting is mutated in place; `FinanceConfigurationVersion` keeps every historical value as its own immutable row). Phase 8 (`2026-09-17-phase-8-finance-calculation-engine.md`) already implements this dedicated model, with its calculation engine already verified correct against the spec's worked examples. Having both plans independently manage the same three values would create two sources of truth that can silently drift. Ruling: Phase 8 owns `finance.annual_rate_percent`, `finance.term_months`, and `finance.down_payment_percent` entirely via its own `FinanceConfigurationVersion` model; this plan (Phase 2) only owns `finance.enabled` — the boolean kill switch, which has no natural home in a versioned finance-config model and which Phase 9 (finance UI) needs as a simple display toggle. This is why the registry below has 12 keys, not 14.

`backend/platform_settings/registry.py`:

```python
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from enum import Enum
from typing import Any, Callable


class SettingValueType(str, Enum):
    BOOLEAN = "boolean"
    INTEGER = "integer"
    DECIMAL = "decimal"


@dataclass(frozen=True)
class SettingDefinition:
    key: str
    value_type: SettingValueType
    default: Any
    validator: Callable[[Any], None]
    is_public: bool = True


def coerce_value(value_type: SettingValueType, raw_value: Any) -> Any:
    """Convert a raw value (as read back from JSONField storage, or as
    submitted by a caller) into the real Python type the registry expects,
    raising ValueError on any type mismatch."""
    if value_type is SettingValueType.BOOLEAN:
        if not isinstance(raw_value, bool):
            raise ValueError(f"expected a boolean, got {raw_value!r}")
        return raw_value
    if value_type is SettingValueType.INTEGER:
        if isinstance(raw_value, bool) or not isinstance(raw_value, int):
            raise ValueError(f"expected an integer, got {raw_value!r}")
        return raw_value
    if value_type is SettingValueType.DECIMAL:
        try:
            return Decimal(str(raw_value))
        except InvalidOperation as exc:
            raise ValueError(f"expected a decimal, got {raw_value!r}") from exc
    raise ValueError(f"Unsupported setting value type: {value_type}")


def _range_validator(minimum, maximum) -> Callable[[Any], None]:
    def _validate(value):
        if not (minimum <= value <= maximum):
            raise ValueError(f"must be between {minimum} and {maximum}, got {value}")

    return _validate


def _exact_validator(expected) -> Callable[[Any], None]:
    def _validate(value):
        if value != expected:
            raise ValueError(f"must be exactly {expected}, got {value}")

    return _validate


def _no_extra_validation(value) -> None:
    return None


# Keys, types, defaults and validation ranges are copied verbatim from
# NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md §10.1.
SETTINGS_REGISTRY: dict[str, SettingDefinition] = {
    "finance.enabled": SettingDefinition(
        "finance.enabled", SettingValueType.BOOLEAN, True, _no_extra_validation
    ),
    "individual.free_listing_count": SettingDefinition(
        "individual.free_listing_count", SettingValueType.INTEGER, 1, _range_validator(0, 100)
    ),
    "individual.free_period_days": SettingDefinition(
        "individual.free_period_days", SettingValueType.INTEGER, 365, _range_validator(1, 3650)
    ),
    "individual.free_publish_days": SettingDefinition(
        "individual.free_publish_days", SettingValueType.INTEGER, 30, _range_validator(1, 3650)
    ),
    "individual.paid_publish_days": SettingDefinition(
        "individual.paid_publish_days", SettingValueType.INTEGER, 30, _range_validator(1, 3650)
    ),
    "individual.paid_entitlement_valid_days": SettingDefinition(
        "individual.paid_entitlement_valid_days",
        SettingValueType.INTEGER,
        365,
        _range_validator(1, 3650),
    ),
    "media.private_base_image_limit": SettingDefinition(
        "media.private_base_image_limit", SettingValueType.INTEGER, 1, _exact_validator(1)
    ),
    "media.private_base_video_limit": SettingDefinition(
        "media.private_base_video_limit", SettingValueType.INTEGER, 0, _exact_validator(0)
    ),
    "media.upgraded_image_limit": SettingDefinition(
        "media.upgraded_image_limit", SettingValueType.INTEGER, 20, _range_validator(1, 50)
    ),
    "media.upgraded_video_limit": SettingDefinition(
        "media.upgraded_video_limit", SettingValueType.INTEGER, 1, _range_validator(0, 3)
    ),
    "media.broker_image_limit": SettingDefinition(
        "media.broker_image_limit", SettingValueType.INTEGER, 20, _range_validator(1, 50)
    ),
    "media.broker_video_limit": SettingDefinition(
        "media.broker_video_limit", SettingValueType.INTEGER, 1, _range_validator(0, 3)
    ),
}
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
uv run pytest platform_settings/tests/test_registry.py -v
```

Expected: all tests `PASS` (15 total, including the 12 parametrized cases).

- [ ] **Step 6: Write the failing `PlatformSetting` model test**

`backend/platform_settings/tests/test_models.py`:

```python
import pytest
from django.core.exceptions import ValidationError

from platform_settings.models import PlatformSetting


@pytest.mark.django_db
def test_platform_setting_clean_rejects_an_unknown_key():
    setting = PlatformSetting(key="not.a.real.key", value=True)

    with pytest.raises(ValidationError):
        setting.clean()


@pytest.mark.django_db
def test_platform_setting_clean_rejects_an_out_of_range_value():
    setting = PlatformSetting(key="individual.free_listing_count", value=500)

    with pytest.raises(ValidationError):
        setting.clean()


@pytest.mark.django_db
def test_platform_setting_clean_accepts_a_valid_value():
    setting = PlatformSetting(key="individual.free_listing_count", value=60)

    setting.clean()  # does not raise
```

Run to verify it fails:

```bash
uv run pytest platform_settings/tests/test_models.py -v
```

Expected: `ModuleNotFoundError` — `platform_settings.models` has no `PlatformSetting` yet.

- [ ] **Step 7: Implement `PlatformSetting`**

`backend/platform_settings/models.py`:

```python
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.serializers.json import DjangoJSONEncoder
from django.db import models

from common.models import UUIDTimeStampedModel

from .registry import SETTINGS_REGISTRY, coerce_value


class PlatformSetting(UUIDTimeStampedModel):
    """A single staff-editable typed setting (NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md §10.1).

    Rows are seeded once for all SETTINGS_REGISTRY keys by migration 0002
    and are never created ad hoc — see services.update_setting() for the
    only sanctioned mutation path (also used by admin.PlatformSettingAdmin).
    """

    key = models.CharField(max_length=100, unique=True)
    value = models.JSONField(encoder=DjangoJSONEncoder)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="platform_setting_updates",
    )

    class Meta:
        ordering = ["key"]

    def __str__(self):
        return self.key

    def clean(self):
        definition = SETTINGS_REGISTRY.get(self.key)
        if definition is None:
            raise ValidationError({"key": f"Unknown platform setting key: {self.key}"})
        try:
            coerced = coerce_value(definition.value_type, self.value)
            definition.validator(coerced)
        except ValueError as exc:
            raise ValidationError({"value": str(exc)}) from exc
```

- [ ] **Step 8: Generate and apply the migration, then run the tests to verify they pass**

```bash
uv run python manage.py makemigrations platform_settings
uv run python manage.py migrate
uv run pytest platform_settings/tests/test_models.py -v
```

Expected: `platform_settings/migrations/0001_initial.py` is created (one `CreateModel` for `PlatformSetting`); all three tests `PASS`.

- [ ] **Step 9: Write the failing seed-migration/service test**

`backend/platform_settings/tests/test_services.py`:

```python
import pytest

from platform_settings.services import get_setting_value


@pytest.mark.django_db
def test_get_setting_value_returns_the_seeded_default_after_migration():
    assert get_setting_value("finance.enabled") is True
    assert get_setting_value("individual.free_listing_count") == 1
    assert get_setting_value("media.broker_video_limit") == 1


@pytest.mark.django_db
def test_get_setting_value_falls_back_to_the_registry_default_if_the_row_is_missing():
    from platform_settings.models import PlatformSetting

    PlatformSetting.objects.filter(key="individual.free_listing_count").delete()

    assert get_setting_value("individual.free_listing_count") == 1


def test_get_setting_value_raises_for_an_unknown_key():
    with pytest.raises(KeyError):
        get_setting_value("not.a.real.key")
```

Run to verify it fails:

```bash
uv run pytest platform_settings/tests/test_services.py -v
```

Expected: `ModuleNotFoundError` (`platform_settings.services` doesn't exist) for the first two tests; the third fails too since the module can't be imported at collection time.

- [ ] **Step 10: Write the seed data migration and `get_setting_value()`**

```bash
uv run python manage.py makemigrations platform_settings --empty -n seed_default_settings
```

Replace the generated `backend/platform_settings/migrations/0002_seed_default_settings.py` body:

```python
from django.db import migrations

from platform_settings.registry import SETTINGS_REGISTRY


def seed_default_settings(apps, schema_editor):
    PlatformSetting = apps.get_model("platform_settings", "PlatformSetting")
    for key, definition in SETTINGS_REGISTRY.items():
        PlatformSetting.objects.get_or_create(key=key, defaults={"value": definition.default})


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [("platform_settings", "0001_initial")]
    operations = [migrations.RunPython(seed_default_settings, noop_reverse)]
```

Note: `JSONField(encoder=DjangoJSONEncoder)` handles the `Decimal` → JSON-string conversion transparently on write, so `definition.default` (a `Decimal` for the two rate/percent keys) can be assigned directly without manual `str()` conversion.

`backend/platform_settings/services.py`:

```python
from .models import PlatformSetting
from .registry import SETTINGS_REGISTRY, coerce_value


def get_setting_value(key: str):
    """Return the current value of a platform setting, coerced to its real
    Python type (bool / int / Decimal). Falls back to the registry default
    if the row hasn't been seeded yet (it always should be, via migration
    0002, but this keeps the function safe to call defensively)."""
    definition = SETTINGS_REGISTRY.get(key)
    if definition is None:
        raise KeyError(f"Unknown platform setting key: {key}")
    try:
        row = PlatformSetting.objects.get(key=key)
    except PlatformSetting.DoesNotExist:
        return definition.default
    return coerce_value(definition.value_type, row.value)
```

- [ ] **Step 11: Apply the migration and run the tests to verify they pass**

```bash
uv run python manage.py migrate
uv run pytest platform_settings/ -v
```

Expected: all `platform_settings/` tests `PASS` (this is also the first automated proof of spec §10's "Definition of done" bullet "Tests prove global defaults are applied when listing overrides are absent," in the sense scoped to this plan — see the Note above Task 1, item 2, for what that DoD line does *not* cover).

- [ ] **Step 12: Commit**

```bash
git add backend/platform_settings backend/config/settings/base.py
git commit -m "feat(backend): add platform_settings app with typed registry and seeded defaults"
```

---

### Task 3: `update_setting()` — validated, versioned, audited writes

**Files:**
- Modify: `backend/platform_settings/models.py` (add `PlatformSettingsVersion`)
- Modify: `backend/platform_settings/services.py` (add `update_setting()`, `SETTINGS_CACHE_KEY`)
- Create: `backend/platform_settings/admin.py`
- Create: `backend/platform_settings/migrations/0003_platformsettingsversion.py` (auto-generated)
- Create: `backend/platform_settings/tests/conftest.py`
- Modify: `backend/platform_settings/tests/test_services.py`, create `backend/platform_settings/tests/test_admin.py`

**Interfaces:**
- Consumes: `audit.services.record_audit_event`, `audit.models.AuditEvent.ActorType`/`Source` (Task 1).
- Produces: `platform_settings.models.PlatformSettingsVersion` (singleton; `.load()` / `.bump()` classmethods), `platform_settings.services.update_setting(*, key, value, actor, source=AuditEvent.Source.ADMIN, request_id=None) -> PlatformSetting` (raises `django.core.exceptions.ValidationError` on invalid input, before any DB write), `platform_settings.services.SETTINGS_CACHE_KEY` (consumed by Task 4's read path), `platform_settings.admin.PlatformSettingAdmin`.

- [ ] **Step 1: Add the test fixtures this and later tasks need**

`backend/platform_settings/tests/conftest.py`:

```python
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
```

Note: this conftest imports `SETTINGS_CACHE_KEY` and `feature_flag_cache_key`, neither of which exists in `services.py` yet at this point (Task 2 only added `get_setting_value`) — both are defined together in Step 5 below. That's expected, not a mistake: this conftest is test scaffolding, so it fails to import along with the tests themselves in Step 3 (red), and starts working once Step 5 lands the implementation (green). Defining `feature_flag_cache_key` in Step 5 — a full task ahead of Task 5's `FeatureFlag` model — is deliberate: it's a pure string-formatting helper with no dependency on that model, and defining it now means this conftest (needed as-is from Task 3 onward for `SETTINGS_CACHE_KEY` clearing) never has to be revisited when Task 5 adds its own cache-key clearing to `TEST_FEATURE_FLAG_KEYS`.

- [ ] **Step 2: Write the failing tests for `update_setting()`**

Append to `backend/platform_settings/tests/test_services.py`:

```python
from django.core.exceptions import ValidationError

from audit.models import AuditEvent
from platform_settings.models import PlatformSettingsVersion
from platform_settings.services import update_setting


@pytest.mark.django_db
def test_update_setting_persists_the_new_value(staff_user):
    update_setting(key="individual.free_listing_count", value=36, actor=staff_user)

    assert get_setting_value("individual.free_listing_count") == 36


@pytest.mark.django_db
def test_update_setting_bumps_the_global_version(staff_user):
    version_before = PlatformSettingsVersion.load().version

    update_setting(key="individual.free_listing_count", value=36, actor=staff_user)

    assert PlatformSettingsVersion.load().version == version_before + 1


@pytest.mark.django_db
def test_update_setting_records_an_audit_event_with_before_and_after(staff_user):
    update_setting(key="individual.free_listing_count", value=36, actor=staff_user)

    event = AuditEvent.objects.get(target_id="individual.free_listing_count")
    assert event.actor_user_id == staff_user.id
    assert event.actor_type == AuditEvent.ActorType.USER
    assert event.before == {"value": 1}
    assert event.after == {"value": 36}
    assert event.action == "platform_setting.updated"


@pytest.mark.django_db
def test_update_setting_rejects_an_out_of_range_value_with_no_side_effects(staff_user):
    version_before = PlatformSettingsVersion.load().version

    with pytest.raises(ValidationError):
        update_setting(key="individual.free_listing_count", value=500, actor=staff_user)

    assert get_setting_value("individual.free_listing_count") == 1
    assert PlatformSettingsVersion.load().version == version_before
    assert not AuditEvent.objects.filter(target_id="individual.free_listing_count").exists()


@pytest.mark.django_db
def test_update_setting_invalidates_the_cache_only_after_commit(
    django_capture_on_commit_callbacks, staff_user
):
    from django.core.cache import cache

    from platform_settings.services import SETTINGS_CACHE_KEY

    cache.set(SETTINGS_CACHE_KEY, {"stale": True}, timeout=None)

    with django_capture_on_commit_callbacks(execute=False) as callbacks:
        update_setting(key="individual.free_listing_count", value=36, actor=staff_user)
        # Not yet invalidated — the on_commit hook has only been registered,
        # not run, since `execute=False`.
        assert cache.get(SETTINGS_CACHE_KEY) == {"stale": True}

    assert len(callbacks) == 1
    for callback in callbacks:
        callback()

    assert cache.get(SETTINGS_CACHE_KEY) is None
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
uv run pytest platform_settings/tests/test_services.py -v
```

Expected: collection error — `platform_settings/tests/conftest.py` itself fails to import first (`ImportError: cannot import name 'SETTINGS_CACHE_KEY' from 'platform_settings.services'`), since Step 1 wrote it ahead of Step 5's implementation. This is still the expected "red" state for this step; once Step 5 lands, the same command will fail instead (or pass) for the real reasons below rather than the conftest import.

- [ ] **Step 4: Implement `PlatformSettingsVersion`**

Append to `backend/platform_settings/models.py`:

```python
class PlatformSettingsVersion(models.Model):
    """Global, monotonically increasing settings version + last-updated
    timestamp (NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md §10.1: "Settings responses
    include a monotonically increasing settings_version and updated_at").

    Ruling: this is a genuine process-wide singleton counter, not a domain
    entity with its own identity — it deliberately uses a fixed small-integer
    primary key rather than a UUID, matching the Global Constraints' own
    "unless stated otherwise" carve-out from the UUID-PK default.
    """

    SINGLETON_ID = 1

    id = models.PositiveSmallIntegerField(primary_key=True, default=SINGLETON_ID, editable=False)
    version = models.PositiveIntegerField(default=1)
    updated_at = models.DateTimeField(auto_now=True)

    @classmethod
    def load(cls) -> "PlatformSettingsVersion":
        obj, _ = cls.objects.get_or_create(id=cls.SINGLETON_ID)
        return obj

    @classmethod
    def bump(cls) -> int:
        obj, _ = cls.objects.select_for_update().get_or_create(id=cls.SINGLETON_ID)
        obj.version += 1
        obj.save(update_fields=["version", "updated_at"])
        return obj.version
```

- [ ] **Step 5: Implement `update_setting()` and the shared settings cache key**

`backend/platform_settings/services.py` (full file — extends the Task 2 version):

```python
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.db import transaction

from audit.models import AuditEvent
from audit.services import record_audit_event

from .models import PlatformSetting, PlatformSettingsVersion
from .registry import SETTINGS_REGISTRY, coerce_value

SETTINGS_CACHE_KEY = "platform_settings:public"


def feature_flag_cache_key(key: str) -> str:
    return f"platform_settings:feature_flag:{key}"


def get_setting_value(key: str):
    """Return the current value of a platform setting, coerced to its real
    Python type (bool / int / Decimal). Falls back to the registry default
    if the row hasn't been seeded yet (it always should be, via migration
    0002, but this keeps the function safe to call defensively)."""
    definition = SETTINGS_REGISTRY.get(key)
    if definition is None:
        raise KeyError(f"Unknown platform setting key: {key}")
    try:
        row = PlatformSetting.objects.get(key=key)
    except PlatformSetting.DoesNotExist:
        return definition.default
    return coerce_value(definition.value_type, row.value)


@transaction.atomic
def update_setting(
    *,
    key: str,
    value,
    actor,
    source: str = AuditEvent.Source.ADMIN,
    request_id: str | None = None,
) -> PlatformSetting:
    """The only sanctioned way to change a PlatformSetting's value.

    Validates against the registry, persists, bumps the global version and
    records an audit event, all inside one transaction — then defers only
    the cache invalidation to transaction.on_commit() so a rolled-back
    change never busts the cache for a value that never actually changed.
    """
    definition = SETTINGS_REGISTRY.get(key)
    if definition is None:
        raise ValidationError({"key": [f"Unknown platform setting key: {key}"]})

    setting = PlatformSetting.objects.select_for_update().get(key=key)
    before_value = setting.value

    setting.value = value
    actor_user = actor if getattr(actor, "is_authenticated", False) else None
    setting.updated_by = actor_user
    setting.full_clean()
    setting.save()

    PlatformSettingsVersion.bump()

    record_audit_event(
        actor_user=actor_user,
        actor_type=AuditEvent.ActorType.USER,
        action="platform_setting.updated",
        target_type="platform_settings.PlatformSetting",
        target_id=key,
        source=source,
        before={"value": before_value},
        after={"value": value},
        request_id=request_id,
    )

    transaction.on_commit(lambda: cache.delete(SETTINGS_CACHE_KEY))

    return setting
```

- [ ] **Step 6: Generate and apply the migration, then run the tests to verify they pass**

```bash
uv run python manage.py makemigrations platform_settings
uv run python manage.py migrate
uv run pytest platform_settings/tests/test_services.py -v
```

Expected: `platform_settings/migrations/0003_platformsettingsversion.py` is created; all `update_setting` tests `PASS`.

- [ ] **Step 7: Write the failing admin tests**

`backend/platform_settings/tests/test_admin.py`:

```python
import pytest
from django.contrib import admin as django_admin
from django.test import RequestFactory

from audit.models import AuditEvent
from platform_settings.admin import PlatformSettingAdmin
from platform_settings.models import PlatformSetting
from platform_settings.services import get_setting_value


def test_platform_setting_admin_denies_add_and_delete():
    admin_instance = PlatformSettingAdmin(PlatformSetting, django_admin.site)

    assert admin_instance.has_add_permission(None) is False
    assert admin_instance.has_delete_permission(None) is False


@pytest.mark.django_db
def test_platform_setting_admin_save_model_goes_through_update_setting(staff_user):
    admin_instance = PlatformSettingAdmin(PlatformSetting, django_admin.site)
    request = RequestFactory().post("/admin/platform_settings/platformsetting/")
    request.user = staff_user

    obj = PlatformSetting.objects.get(key="individual.free_listing_count")
    obj.value = 36

    admin_instance.save_model(request, obj, form=None, change=True)

    assert get_setting_value("individual.free_listing_count") == 36
    assert AuditEvent.objects.filter(
        target_id="individual.free_listing_count", source=AuditEvent.Source.ADMIN
    ).exists()
```

Run to verify it fails:

```bash
uv run pytest platform_settings/tests/test_admin.py -v
```

Expected: `ModuleNotFoundError` — `platform_settings.admin` doesn't exist yet.

- [ ] **Step 8: Implement `PlatformSettingAdmin`**

`backend/platform_settings/admin.py`:

```python
from django.contrib import admin

from audit.models import AuditEvent

from .models import PlatformSetting
from .services import update_setting


@admin.register(PlatformSetting)
class PlatformSettingAdmin(admin.ModelAdmin):
    list_display = ("key", "value", "updated_at", "updated_by")
    fields = ("key", "value", "updated_at", "updated_by")
    # `key` is shown but never editable — it's the registry lookup identity;
    # letting staff rename it would orphan the row from its validation rules.
    readonly_fields = ("key", "updated_at", "updated_by")

    def has_add_permission(self, request):
        # All 12 keys are seeded once by migration 0002; staff only ever
        # edit an existing row's value, never create new arbitrary keys.
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def save_model(self, request, obj, form, change):
        # Delegate entirely to update_setting() so validation, versioning
        # and the audit trail are guaranteed regardless of entry point
        # (admin vs. any future API). `obj` is already the pre-existing
        # row (has_add_permission is False), so its pk already matches the
        # row update_setting() will fetch by `key` — no pk sync needed here
        # (contrast with FeatureFlagAdmin in Task 5, which does need it).
        update_setting(
            key=obj.key,
            value=obj.value,
            actor=request.user,
            source=AuditEvent.Source.ADMIN,
        )
```

- [ ] **Step 9: Run the tests to verify they pass**

```bash
uv run pytest platform_settings/ -v
```

Expected: all `platform_settings/` tests `PASS`.

- [ ] **Step 10: Commit**

```bash
git add backend/platform_settings
git commit -m "feat(backend): add validated/versioned/audited platform setting writes"
```

---

### Task 4: Public settings endpoint — `GET /api/v1/platform/public-settings/`

**Files:**
- Modify: `backend/platform_settings/services.py` (add `get_public_settings()`)
- Create: `backend/platform_settings/views.py`
- Create: `backend/platform_settings/tests/test_views.py`
- Modify: `backend/config/urls.py`

**Interfaces:**
- Consumes: `platform_settings.services.get_setting_value`, `SETTINGS_REGISTRY`, `SETTINGS_CACHE_KEY`, `PlatformSettingsVersion.load()`.
- Produces: `GET /api/v1/platform/public-settings/` → `{"settings_version": int, "updated_at": "<ISO-8601 UTC>", "settings": {<12 keys>: bool | int}}`, HTTP 200, unauthenticated (spec §30.1: "safe public finance/policy display settings").

- [ ] **Step 1: Write the failing endpoint tests**

`backend/platform_settings/tests/test_views.py`:

```python
import pytest


@pytest.mark.django_db
def test_public_settings_endpoint_returns_all_seeded_keys(client):
    response = client.get("/api/v1/platform/public-settings/")

    assert response.status_code == 200
    body = response.json()

    assert body["settings_version"] == 1
    assert "updated_at" in body
    assert body["settings"] == {
        "finance.enabled": True,
        "individual.free_listing_count": 1,
        "individual.free_period_days": 365,
        "individual.free_publish_days": 30,
        "individual.paid_publish_days": 30,
        "individual.paid_entitlement_valid_days": 365,
        "media.private_base_image_limit": 1,
        "media.private_base_video_limit": 0,
        "media.upgraded_image_limit": 20,
        "media.upgraded_video_limit": 1,
        "media.broker_image_limit": 20,
        "media.broker_video_limit": 1,
    }


@pytest.mark.django_db
def test_public_settings_endpoint_does_not_require_authentication(client):
    response = client.get("/api/v1/platform/public-settings/")

    assert response.status_code == 200


@pytest.mark.django_db
def test_public_settings_endpoint_reflects_updates_after_commit(
    client, django_capture_on_commit_callbacks, staff_user
):
    from platform_settings.services import update_setting

    with django_capture_on_commit_callbacks(execute=True):
        update_setting(key="individual.free_listing_count", value=36, actor=staff_user)

    response = client.get("/api/v1/platform/public-settings/")

    assert response.json()["settings"]["individual.free_listing_count"] == 36
    assert response.json()["settings_version"] == 2


@pytest.mark.django_db
def test_get_public_settings_only_queries_the_database_once_per_cache_fill(
    django_assert_num_queries,
):
    from platform_settings.services import get_public_settings

    get_public_settings()  # first call warms the cache

    with django_assert_num_queries(0):
        get_public_settings()
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
uv run pytest platform_settings/tests/test_views.py -v
```

Expected: `404` for the HTTP tests (route doesn't exist), `ImportError` for the caching test (`get_public_settings` doesn't exist).

- [ ] **Step 3: Implement `get_public_settings()` and the view**

Append to `backend/platform_settings/services.py`:

```python
def get_public_settings() -> dict:
    """Return the cached, publicly-safe settings payload
    (spec §30.1: GET /api/v1/platform/public-settings/)."""
    cached = cache.get(SETTINGS_CACHE_KEY)
    if cached is not None:
        return cached

    rows = {row.key: row.value for row in PlatformSetting.objects.all()}
    version = PlatformSettingsVersion.load()
    result = {
        "settings_version": version.version,
        "updated_at": version.updated_at.isoformat().replace("+00:00", "Z"),
        "settings": {
            key: coerce_value(definition.value_type, rows[key])
            for key, definition in SETTINGS_REGISTRY.items()
            if definition.is_public and key in rows
        },
    }
    cache.set(SETTINGS_CACHE_KEY, result, timeout=None)
    return result
```

`backend/platform_settings/views.py`:

```python
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .services import get_public_settings


class PublicPlatformSettingsView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response(get_public_settings())
```

Wire the route into `backend/config/urls.py`:

```python
from django.contrib import admin
from django.urls import path

from common.views import HealthCheckView, StripeWebhookView
from platform_settings.views import PublicPlatformSettingsView

urlpatterns = [
    path('admin/', admin.site.urls),
    path("api/v1/health/", HealthCheckView.as_view(), name="health-check"),
    path("api/v1/stripe/webhook/", StripeWebhookView.as_view(), name="stripe-webhook"),
    path(
        "api/v1/platform/public-settings/",
        PublicPlatformSettingsView.as_view(),
        name="platform-public-settings",
    ),
]
```

Note: every value returned inside `"settings"` is a real Python `bool`/`int` (never a pre-stringified value from this code). None of the 12 keys this plan owns are decimal-typed — `finance.annual_rate_percent`/`finance.term_months`/`finance.down_payment_percent` are owned by Phase 8's `FinanceConfigurationVersion` model instead (see the Note (ruling) in Task 2, Step 4) — but `coerce_value()`/`SettingValueType.DECIMAL` still support the type generically, and DRF's `rest_framework.utils.encoders.JSONEncoder` would stringify a `Decimal` automatically per spec §30.2 ("JSON uses decimal strings for money/rates") if a future key needed it, without any extra serializer code.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
uv run pytest platform_settings/tests/test_views.py -v
```

Expected: all four tests `PASS`.

- [ ] **Step 5: Manual verification against the real dev server**

```bash
uv run python manage.py runserver 8020
curl -s http://localhost:8020/api/v1/platform/public-settings/ | python -m json.tool
```

Expected: JSON body with `settings_version: 1`, an ISO-8601 `updated_at` ending in `Z`, and all 12 keys present (`finance.enabled` as a JSON boolean, the rest as JSON integers — none of these 12 keys are decimal-typed).

- [ ] **Step 6: Commit**

```bash
git add backend/platform_settings backend/config/urls.py
git commit -m "feat(backend): add public platform settings read endpoint with cache-busting"
```

---

### Task 5: `FeatureFlag` — generic staff-toggleable flags

**Files:**
- Modify: `backend/platform_settings/models.py` (add `FeatureFlag`)
- Modify: `backend/platform_settings/services.py` (add `is_feature_enabled()`, `set_feature_flag()`)
- Modify: `backend/platform_settings/admin.py` (add `FeatureFlagAdmin`)
- Modify: `backend/platform_settings/tests/conftest.py` (register `finance_estimates` as a test flag key — already listed there since Task 3, see Step 1 below)
- Create: `backend/platform_settings/migrations/0004_featureflag.py` (auto-generated)
- Create: `backend/platform_settings/tests/test_feature_flags.py`

**Interfaces:**
- Consumes: `audit.services.record_audit_event`, `common.models.UUIDTimeStampedModel`.
- Produces: `platform_settings.models.FeatureFlag`, `platform_settings.services.is_feature_enabled(key: str, default: bool = False) -> bool` (consumed by every later phase's backend gating code — e.g. Phase 9's finance card, Phase 24's rollback), `platform_settings.services.set_feature_flag(*, key, is_enabled, actor, description="", source=AuditEvent.Source.ADMIN, request_id=None) -> FeatureFlag`.

- [ ] **Step 1: Confirm the test fixture from Task 3 already covers this task**

`backend/platform_settings/tests/conftest.py`'s `TEST_FEATURE_FLAG_KEYS = ["finance_estimates"]` (written in Task 3, Step 1) was added in anticipation of this task and needs no further edit — `"finance_estimates"` is the flag key this task's tests exercise (chosen because it's the first concrete key spec §35.1 lists, even though the feature it gates, Phase 9, doesn't exist yet).

- [ ] **Step 2: Write the failing tests**

`backend/platform_settings/tests/test_feature_flags.py`:

```python
import pytest

from audit.models import AuditEvent
from platform_settings.services import is_feature_enabled, set_feature_flag


@pytest.mark.django_db
def test_is_feature_enabled_returns_the_given_default_when_flag_does_not_exist():
    assert is_feature_enabled("finance_estimates") is False
    assert is_feature_enabled("finance_estimates", default=True) is True


@pytest.mark.django_db
def test_set_feature_flag_creates_a_new_flag_and_records_an_audit_event(staff_user):
    flag = set_feature_flag(
        key="finance_estimates",
        is_enabled=True,
        actor=staff_user,
        description="Gates the finance card estimate (Phase 9).",
    )

    assert flag.is_enabled is True
    assert is_feature_enabled("finance_estimates") is True

    event = AuditEvent.objects.get(target_id="finance_estimates")
    assert event.action == "feature_flag.created"
    assert event.before == {"is_enabled": None}
    assert event.after == {"is_enabled": True}


@pytest.mark.django_db
def test_set_feature_flag_toggles_an_existing_flag_and_records_before_after(staff_user):
    set_feature_flag(key="finance_estimates", is_enabled=True, actor=staff_user)

    set_feature_flag(key="finance_estimates", is_enabled=False, actor=staff_user)

    event = AuditEvent.objects.filter(target_id="finance_estimates").latest("created_at")
    assert event.action == "feature_flag.updated"
    assert event.before == {"is_enabled": True}
    assert event.after == {"is_enabled": False}


@pytest.mark.django_db
def test_is_feature_enabled_is_served_from_cache_after_first_lookup(
    staff_user, django_assert_num_queries
):
    set_feature_flag(key="finance_estimates", is_enabled=True, actor=staff_user)
    is_feature_enabled("finance_estimates")  # warms the cache

    with django_assert_num_queries(0):
        assert is_feature_enabled("finance_estimates") is True
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
uv run pytest platform_settings/tests/test_feature_flags.py -v
```

Expected: `ImportError` — `is_feature_enabled`/`set_feature_flag` don't exist yet.

- [ ] **Step 4: Implement `FeatureFlag`**

Append to `backend/platform_settings/models.py`:

```python
class FeatureFlag(UUIDTimeStampedModel):
    """A generic staff-toggleable on/off switch (NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md §7
    row 2 / §35.1). Unlike PlatformSetting, flag keys are not fixed by a
    registry — each phase that needs one creates its own row (typically via
    a data migration) when the feature it gates is actually built."""

    key = models.CharField(max_length=100, unique=True)
    description = models.CharField(max_length=255, blank=True)
    is_enabled = models.BooleanField(default=False)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="feature_flag_updates",
    )

    class Meta:
        ordering = ["key"]

    def __str__(self):
        return self.key
```

- [ ] **Step 5: Implement `is_feature_enabled()` and `set_feature_flag()`**

Append to `backend/platform_settings/services.py`:

```python
from .models import FeatureFlag  # add to the existing "from .models import ..." line


def is_feature_enabled(key: str, default: bool = False) -> bool:
    cache_key = feature_flag_cache_key(key)
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        value = FeatureFlag.objects.get(key=key).is_enabled
    except FeatureFlag.DoesNotExist:
        value = default

    cache.set(cache_key, value, timeout=None)
    return value


@transaction.atomic
def set_feature_flag(
    *,
    key: str,
    is_enabled: bool,
    actor,
    description: str = "",
    source: str = AuditEvent.Source.ADMIN,
    request_id: str | None = None,
) -> FeatureFlag:
    flag, created = FeatureFlag.objects.select_for_update().get_or_create(
        key=key, defaults={"is_enabled": is_enabled, "description": description}
    )
    before_value = None if created else flag.is_enabled

    flag.is_enabled = is_enabled
    if description:
        flag.description = description
    actor_user = actor if getattr(actor, "is_authenticated", False) else None
    flag.updated_by = actor_user
    flag.full_clean()
    flag.save()

    record_audit_event(
        actor_user=actor_user,
        actor_type=AuditEvent.ActorType.USER,
        action="feature_flag.created" if created else "feature_flag.updated",
        target_type="platform_settings.FeatureFlag",
        target_id=key,
        source=source,
        before={"is_enabled": before_value},
        after={"is_enabled": is_enabled},
        request_id=request_id,
    )

    cache_key = feature_flag_cache_key(key)
    transaction.on_commit(lambda: cache.delete(cache_key))

    return flag
```

(Note: add the `from .models import FeatureFlag` name to the existing `from .models import PlatformSetting, PlatformSettingsVersion` import line at the top of the file rather than as a second import statement — shown separately above only for readability in this plan.)

- [ ] **Step 6: Generate and apply the migration, then run the tests to verify they pass**

```bash
uv run python manage.py makemigrations platform_settings
uv run python manage.py migrate
uv run pytest platform_settings/tests/test_feature_flags.py -v
```

Expected: `platform_settings/migrations/0004_featureflag.py` is created; all four tests `PASS`.

- [ ] **Step 7: Register `FeatureFlagAdmin`**

Append to `backend/platform_settings/admin.py`:

```python
from .models import FeatureFlag  # add to the existing "from .models import PlatformSetting" line
from .services import set_feature_flag  # add to the existing "from .services import update_setting" line


@admin.register(FeatureFlag)
class FeatureFlagAdmin(admin.ModelAdmin):
    list_display = ("key", "is_enabled", "updated_at", "updated_by")
    fields = ("key", "description", "is_enabled", "updated_at", "updated_by")
    readonly_fields = ("updated_at", "updated_by")

    def has_delete_permission(self, request, obj=None):
        # Prefer disabling a flag over deleting it, so its audit history
        # stays attached to a real row. Unlike PlatformSetting, `add` is
        # allowed here — staff may create a new flag key ahead of the
        # feature that will check it.
        return False

    def save_model(self, request, obj, form, change):
        flag = set_feature_flag(
            key=obj.key,
            is_enabled=obj.is_enabled,
            actor=request.user,
            description=obj.description,
            source=AuditEvent.Source.ADMIN,
        )
        # On "Add", `obj` is a fresh instance with its own client-generated
        # UUID (UUIDModel's default=uuid4 fires at instantiation, before any
        # save) — sync `obj` onto the row set_feature_flag() actually
        # created/updated so Django Admin's post-save redirect resolves to
        # the real object instead of a pk that was never written to the DB.
        obj.pk = flag.pk
        obj.updated_at = flag.updated_at
        obj.updated_by = flag.updated_by
```

- [ ] **Step 8: Write and run the admin permission test**

Append to `backend/platform_settings/tests/test_admin.py`:

```python
from platform_settings.admin import FeatureFlagAdmin
from platform_settings.models import FeatureFlag


def test_feature_flag_admin_allows_add_but_denies_delete():
    admin_instance = FeatureFlagAdmin(FeatureFlag, django_admin.site)

    assert admin_instance.has_add_permission(None) is True
    assert admin_instance.has_delete_permission(None) is False
```

```bash
uv run pytest platform_settings/ -v
```

Expected: every test in `platform_settings/` `PASS` (registry, models, services, admin, views, feature flags).

- [ ] **Step 9: Commit**

```bash
git add backend/platform_settings
git commit -m "feat(backend): add generic feature flag mechanism with audit logging"
```

---

### Task 6: Full-suite verification and activity log update

**Files:**
- Modify: `ACTIVITY.md`
- Modify: `docs/superpowers/PHASE-TRACKER.md`

**Interfaces:** none — this task verifies Tasks 1–5 together and records completion, mirroring spec §39's "required phase handoff note."

- [ ] **Step 1: Full backend regression run**

```bash
cd backend
uv run python manage.py check
uv run python manage.py makemigrations --check --dry-run
uv run pytest -v
```

Expected: `check` reports no issues; `makemigrations --check` reports no missing migrations (proves every model change across Tasks 1–5 was captured); the full suite passes — this project's Phase 0/1 tests (health/celery/storage/stripe/websocket, unaffected by this plan) plus every `audit/` and `platform_settings/` test added here, all green.

- [ ] **Step 2: Manual smoke test of the public endpoint and Django admin**

```bash
uv run python manage.py createsuperuser --username admin --email admin@nautelo.local
uv run python manage.py runserver 8020
```

In a browser: log into `http://localhost:8020/admin/`, confirm **Platform settings** shows all 12 seeded rows (editable value, key/updated_at/updated_by read-only, no "Add" button), **Feature flags** shows an empty list with a working "Add" button, and **Audit events** shows rows created by any edits just made, with `Save`/`Delete` actions unavailable set from admin buttons.

```bash
curl -s http://localhost:8020/api/v1/platform/public-settings/ | python -m json.tool
```

Expected: same shape verified in Task 4, Step 5, now reflecting any manual edits just made through the admin (after a page refresh, since the cache invalidates on commit).

- [ ] **Step 3: Update `ACTIVITY.md`**

Append a new entry at the top of the `## Log` section:

```markdown
### 2026-09-17 — Phase 2 (shared types, platform settings, audit foundation) complete

- Implemented `docs/superpowers/plans/2026-09-17-phase-2-shared-types-platform-settings.md` in full.
- Added `common.models.UUIDModel`/`TimeStampedModel`/`UUIDTimeStampedModel` (abstract mixins for every future domain model), the `audit` app (`AuditEvent`, append-only, `record_audit_event()`), and the `platform_settings` app (`PlatformSetting` — 12 typed/validated/versioned keys per spec §10.1 (finance rate/term/down-payment excluded — owned by Phase 8's `FinanceConfigurationVersion` instead), seeded by migration; `FeatureFlag` — generic staff-toggleable flags; both fully audited on every write).
- New endpoint: `GET /api/v1/platform/public-settings/` (unauthenticated, cached, spec §30.1).
- Migrations added: `audit/migrations/0001_initial.py`; `platform_settings/migrations/0001_initial.py`, `0002_seed_default_settings.py` (data), `0003_platformsettingsversion.py`, `0004_featureflag.py`. All additive — no destructive rollback concerns.
- Permissions: Django Admin's stock `is_staff` + per-model permissions gate all writes (no custom role system yet — Phase 3's concern). Audit events are append-only at the application layer (`save()`/`delete()` raise) and read-only in Django Admin.
- Feature flag state: mechanism only, no flags seeded — spec §35.1's nine keys are created by the phases that implement the features they gate.
- Known limitations / open items carried to later phases: (1) `AUTH_USER_MODEL` still resolves to Django's stock `auth.User`; Phase 3 introducing a custom `accounts.User` will need a full dev-database reset or a hand-written migration, since Phase 0/1 already migrated against the stock model — see the Note above Task 1 in this plan. (2) `PlatformSettingsVersion` (this phase) and spec §11.6's `FinanceConfigurationVersion` (Phase 8) are intentionally separate mechanisms — see the same Note, item 2. (3) No public API for feature flags (server-side only, by design — nothing in spec §30.1 calls for one yet).
- Next: Phase 3 (identity/organizations/permissions) and Phase 8 (finance calculation engine) both depend only on this phase and can now proceed; Phase 4 depends on Phase 3.
```

Update the "Current State" section: append a sentence noting Phase 2 is merged, and update "No domain apps yet" to reflect that `audit`/`platform_settings` (foundation apps, not domain apps) now exist.

- [ ] **Step 4: Update `docs/superpowers/PHASE-TRACKER.md`**

Change Phase 2's row `Status` from `planning` to `done` (or `implementing`/`final-review` if this plan is being executed incrementally rather than all at once — use whatever the tracker's status legend calls the state reached at the end of this task) and add a one-line note in the `Notes` column: `Merged 2026-09-17 — audit + platform_settings apps, public-settings endpoint.`

- [ ] **Step 5: Commit and push**

```bash
git add ACTIVITY.md docs/superpowers/PHASE-TRACKER.md
git commit -m "docs: record phase 2 shared types/platform settings/audit completion"
git push origin dev
```

---

## Known Limitations (carried forward, not fixed by this plan)

- `AUTH_USER_MODEL` is still Django's stock `auth.User`. Every FK this plan adds (`AuditEvent.actor_user`, `PlatformSetting.updated_by`, `FeatureFlag.updated_by`) points at `settings.AUTH_USER_MODEL` (the swap-safe idiom), but the dev database has already been migrated against the stock model since Phase 0/1 — see the Note above Task 1 for the concrete risk this creates for Phase 3.
- `PlatformSettingsVersion` is a coarse, non-historized freshness counter across all 12 keys — it is not a substitute for Phase 8's fully historized `FinanceConfigurationVersion` (spec §11.6). See the Note above Task 1, item 2.
- No `ListingStatus`/`RevisionStatus`/`EntitlementState`/`PaymentOrderStatus`/broker-role/`Locale` enums are defined here — deliberately deferred to the phase that owns the model carrying that state machine (see the Global Constraints scope ruling).
- Feature flag keys from spec §35.1 are not seeded — only the mechanism exists. Each gated feature's owning phase must create its own flag row when built.
- No public API for feature flags — `is_feature_enabled()` is a server-side-only primitive for now; add an endpoint later only if a real frontend consumer needs one.
- Django's stock `is_staff` + per-model `auth.Permission` grants are the only access control on `/admin/`'s new models — Phase 3's role system may later warrant a more granular permission class, but nothing in spec §10 requires that now.
