# NAUTA Phase 4 — Brand/Model Taxonomy and Other Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `taxonomy` Django app — `BoatBrand` and `BoatModel` database-backed models with a self-maintaining per-brand "Other" placeholder, the two public search endpoints (`GET /api/v1/boat-brands/`, `GET /api/v1/boat-models/`) the boat-listing form will depend on, and the custom-model-name normalization rule the Other workflow needs — so later phases (Listings, Staff taxonomy operations) have real, tested taxonomy data to build against instead of a hard-coded list.

**Architecture:** `taxonomy` is a new Django app under `backend/`, following the `common` app's file layout (models/services/admin/views/urls/tests package) established in Phase 0/1. It exposes two public, unauthenticated, rate-limited, database-backed search endpoints under the existing `api/v1/` prefix and nothing else — the staff CRUD/mapping-to-listing transaction endpoints (`/api/v1/staff/taxonomy/...`) belong to spec Phase 17, and the `Listing.custom_model_name` field itself belongs to the Listings phase, since neither the staff app nor the `Listing` model exist yet.

**Tech Stack:** Python 3.13 (matches the pinned version already in `backend/pyproject.toml`, per the Phase 0/1 plan's Task 3 ruling) + `uv`, Django 5.2, Django REST Framework, PostgreSQL 16 (via the existing `docker-compose.yml`), Redis (existing cache backend, used here only for DRF's throttle counters). No new third-party dependencies are required.

**Spec:** [`NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md`](../../../NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md) §11.3 (Taxonomy data model), §13 (Phase 4 — Brand/model taxonomy and Other workflow), §26.5 and §30.1 (API inventory), §30.4 (rate limits), §2 and §39 (binding implementation principles). Structural template and "what already exists" reference: [`2026-09-17-phase-0-1-infrastructure.md`](2026-09-17-phase-0-1-infrastructure.md).

**Note on the Phase 3 dependency:** Spec §12 (Phase 3 — Identity, organizations and permissions) is being planned in parallel by someone else and is not merged yet. This plan never imports a hardcoded `accounts.models.User`-style path. Every reference to the user model uses `django.conf.settings.AUTH_USER_MODEL` (for FK declarations) or `django.contrib.auth.get_user_model()` (in code/tests), so this plan is correct regardless of which app name Phase 3 lands as, as long as it registers `AUTH_USER_MODEL` and provides the fields spec §11.1 lists (`id`, `email`, `email_verified_at`, `primary_role`, `is_active`, `locale`, `created_at`, `updated_at`). No task below reads `primary_role` or any other Phase-3-specific field — only the generic FK relationship is used — so this plan has no hidden dependency on Phase 3's exact manager/field behavior.

**Note on the Phase 2 dependency:** Spec §10.2 defines a shared `AuditEvent` model as part of Phase 2 ("Shared types, settings and audit foundation"). Spec §26.5 requires the future Phase 17 staff taxonomy workflow to produce a "mapping audit" trail. Taxonomy mutations will use Phase 2's shared `audit.services.record_audit_event()` when a future phase (17, staff taxonomy mapping) adds mutation endpoints — no taxonomy-specific audit model needed. No audit call exists in this plan today since this phase has no mutation endpoints yet (only read/search).

## Global Constraints

- Backend: Python 3.13 + `uv`, Django 5.2, DRF for all JSON APIs, PostgreSQL 16 via the existing `docker-compose.yml` (Postgres on `127.0.0.1:5433`, Redis on `127.0.0.1:6380`).
- Backend dev server runs on port **8020** (project-wide ruling from Phase 0/1 — port 8000 is occupied by an unrelated project on this machine).
- **Use PostgreSQL in tests, never SQLite.** `backend/config/settings/test.py` MUST NOT be modified to override `DATABASES` or `CACHES` to SQLite/LocMem — this is a hard, previously-violated-and-reverted project rule. All tests in this plan run against the real Postgres/Redis from `docker-compose.yml` via `config.settings.test`, which inherits `DATABASES`/`CACHES` unchanged from `base.py`.
- No partial/visual-only implementations, no faked/hardcoded demo data, no TODO placeholders for backend enforcement (spec §39). There is no frontend work in this plan — Django is a headless API (see Phase 0/1's architecture note) — so "visual" concerns don't apply, but "no faked data" does: taxonomy search MUST be a real, database-backed `icontains` query, never a static/hardcoded brand or model list.
- TDD per task: failing test first (against real Postgres/Redis), then minimal implementation, then passing test, then commit — matching the granularity used in the Phase 0/1 plan.
- All primary keys are UUIDs (`models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)`) unless stated otherwise; all timestamps are timezone-aware UTC (`auto_now_add=True`/`auto_now=True`, with `USE_TZ = True` already set in `base.py`).
- User references use `settings.AUTH_USER_MODEL` (model fields) / `django.contrib.auth.get_user_model()` (Python code and tests) — never a hardcoded app import path — per the Phase 3 note above.
- **Out of scope for this plan** (explicitly deferred to later phases, do not build them here): the staff CRUD/mapping-to-listing endpoints under `/api/v1/staff/taxonomy/...` (spec §13.3, §26.5 — spec Phase 17); the `Listing.custom_model_name` field and its display/filter behavior (spec §13.2 items 7–8 — needs the `Listing` model, which doesn't exist until the Listings phase); the production seed command that creates real brand/model rows (spec §38 — needs a management-command phase). This plan builds the data model, the auto-placeholder mechanism and the normalization rule those later phases will consume, plus the two public search endpoints spec §13.1 defines now.
- **Also out of scope, for a different reason:** spec §13.2's frontend form behavior (items 1–4 and 6: the searchable dropdown itself, disabling the model field until a brand is picked, clearing on brand change, duplicate-model hints) is Next.js UI work with no backend deliverable of its own — this plan is backend-only, matching the Django-headless architecture decision recorded in `ACTIVITY.md`. It gets built in whichever phase implements the actual create-listing form (the Listings phase), consuming the two endpoints this plan produces. Spec §13.4's `listing.other_model_submitted` notification event is also out of scope here: it requires both the `Listing` model (submission is what triggers it) and the notification/WebSocket/email infrastructure from spec Phase 18 — neither exists yet.

## Execution Model

Per the standing project convention confirmed in `ACTIVITY.md` (established during Phase 0/1 and unchanged since): each task from Task 2 onward is implemented on its own branch off the current tip of `dev` (`git checkout -b task-N-<slug> dev`), run through `subagent-driven-development`'s implementer → task-reviewer → fix-loop cycle, opened as a PR (`gh pr create`), and merged by the controller only when the CI workflow is green and the branch is cleanly mergeable. Tasks run strictly sequentially (never two branches in flight at once), and each new task branches from the just-merged `dev` tip. Task 1 (pure scaffolding, nothing to review in isolation) may be done directly by the controller and pushed straight to `dev`, matching how the Phase 0/1 plan handled its own Task 1.

---

## File Structure

```
nautelo/
├── ACTIVITY.md                                    (updated in Task 8)
├── docs/superpowers/plans/2026-09-17-phase-4-brand-model-taxonomy.md   (this file)
└── backend/
    ├── config/
    │   ├── settings/base.py                       (modified: Task 1)
    │   └── urls.py                                (modified: Task 6)
    └── taxonomy/
        ├── __init__.py                            (Task 1)
        ├── apps.py                                (Task 1, modified: Task 4)
        ├── signals.py                              (Task 4)
        ├── models.py                               (Task 2, modified: Task 3)
        ├── services.py                             (Task 2, modified: Task 4, Task 5)
        ├── pagination.py                           (Task 6)
        ├── serializers.py                          (Task 6, modified: Task 7)
        ├── views.py                                (Task 6, modified: Task 7)
        ├── urls.py                                 (Task 6, modified: Task 7)
        ├── admin.py                                (Task 2, modified: Task 3)
        ├── migrations/
        │   ├── __init__.py                         (Task 1)
        │   ├── 0001_initial.py                     (generated: Task 2 — BoatBrand)
        │   └── 0002_boatmodel.py                   (generated: Task 3 — BoatModel)
        └── tests/
            ├── __init__.py                         (Task 1)
            ├── test_boat_brand_model.py             (Task 2)
            ├── test_boat_model_model.py             (Task 3, modified: Task 4)
            ├── test_other_placeholder.py            (Task 4)
            ├── test_custom_model_name.py            (Task 5)
            ├── test_boat_brand_search_api.py        (Task 6)
            └── test_boat_model_search_api.py        (Task 7)
```

Migration filenames above are Django's default auto-numbering for a fresh app; the actual generated names are whatever `makemigrations` produces (each task's steps say to run it and commit the result, not to hand-author it).

---

### Task 1: Scaffold the `taxonomy` app

**Files:**
- Create: `backend/taxonomy/__init__.py`, `backend/taxonomy/apps.py`, `backend/taxonomy/migrations/__init__.py`, `backend/taxonomy/tests/__init__.py`
- Modify: `backend/config/settings/base.py`
- Delete: `backend/taxonomy/tests.py`, `backend/taxonomy/views.py`, `backend/taxonomy/admin.py`, `backend/taxonomy/models.py` (Django's `startapp` boilerplate; recreated properly in later tasks — see the note below)

**Interfaces:**
- Produces: `taxonomy` registered in `INSTALLED_APPS`; `REST_FRAMEWORK["DEFAULT_THROTTLE_CLASSES"]` and `REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["taxonomy_search"]` available for Task 6/7's views to opt into via `throttle_scope`.

**Note:** the Phase 0/1 plan's own retrospective (`ACTIVITY.md`) records a real bug from `django-admin startapp`: it generates a flat `tests.py` file that silently shadows a `tests/` package if both exist, or has to be deleted before creating the package. This task deletes `taxonomy/tests.py` immediately after `startapp` runs, before ever creating the `tests/` package, to avoid repeating that. `startapp` also generates a placeholder `admin.py`/`models.py`/`views.py` with no real content — those are deleted here and recreated with real content in the tasks that actually need them (Task 2 for `models.py`/`admin.py`, Task 6 for `views.py`), rather than committing empty placeholder files now.

- [ ] **Step 1: Generate the app skeleton and remove the placeholder files**

```bash
cd backend
uv run python manage.py startapp taxonomy
rm taxonomy/tests.py taxonomy/views.py taxonomy/admin.py taxonomy/models.py
mkdir taxonomy/tests
touch taxonomy/tests/__init__.py
```

- [ ] **Step 2: Register the app and configure the shared throttle scope**

In `backend/config/settings/base.py`, change `INSTALLED_APPS` to add `"taxonomy"` after `"common"`:

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
    "taxonomy",
]
```

And extend the existing `REST_FRAMEWORK` dict (do not remove the existing keys):

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

**Note:** `ScopedRateThrottle` only throttles a view that explicitly sets a `throttle_scope` attribute (its `get_cache_key` returns `None` — meaning "always allow" — for any view without one), so adding `DEFAULT_THROTTLE_CLASSES` globally here is safe and has no effect on the existing `HealthCheckView`/`StripeWebhookView` from Phase 0/1, which declare no `throttle_scope`. This satisfies spec §30.4's requirement to rate-limit brand/model search without adding a new dependency (`django-ratelimit` etc.) — DRF's built-in throttling is sufficient and reuses the same Redis cache backend already configured in `base.py`.

- [ ] **Step 3: Verify the app loads**

```bash
uv run python manage.py check
```

Expected: `System check identified no issues (0 silenced).` — `taxonomy` has no models/migrations yet, so this only proves the app is registered and importable.

- [ ] **Step 4: Commit**

```bash
git add backend/taxonomy/__init__.py backend/taxonomy/apps.py backend/taxonomy/migrations backend/taxonomy/tests/__init__.py backend/config/settings/base.py
git commit -m "chore(backend): scaffold taxonomy app and configure its search throttle scope"
```

---

### Task 2: `BoatBrand` model with case/accent-insensitive normalization

**Files:**
- Create: `backend/taxonomy/models.py`, `backend/taxonomy/services.py`, `backend/taxonomy/admin.py`
- Test: `backend/taxonomy/tests/test_boat_brand_model.py`

**Interfaces:**
- Produces: `taxonomy.services.normalize_taxonomy_name(value: str) -> str`; `taxonomy.services.generate_unique_slug(queryset, name: str, *, exclude_pk=None) -> str`; `taxonomy.models.BoatBrand` with fields `id, name, slug, normalized_name, is_active, created_by, updated_by, created_at, updated_at` per spec §11.3.

- [ ] **Step 1: Write the failing tests**

`backend/taxonomy/tests/test_boat_brand_model.py`:

```python
import pytest
from django.db import IntegrityError, transaction

from taxonomy.models import BoatBrand


@pytest.mark.django_db
def test_creating_brand_computes_normalized_name_and_slug():
    brand = BoatBrand.objects.create(name="Beneteau")

    assert brand.normalized_name == "beneteau"
    assert brand.slug == "beneteau"


@pytest.mark.django_db
def test_duplicate_normalized_name_is_rejected_case_and_accent_insensitively():
    BoatBrand.objects.create(name="Bénéteau")

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            BoatBrand.objects.create(name="BENETEAU")


@pytest.mark.django_db
def test_slug_collision_gets_a_unique_suffix():
    first = BoatBrand.objects.create(name="Jeanneau!!")
    second = BoatBrand.objects.create(name="Jeanneau??")

    assert first.slug == "jeanneau"
    assert second.slug != "jeanneau"
    assert second.slug.startswith("jeanneau-")


@pytest.mark.django_db
def test_brand_string_representation_is_its_name():
    brand = BoatBrand.objects.create(name="Lagoon")

    assert str(brand) == "Lagoon"
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd backend
uv run pytest taxonomy/tests/test_boat_brand_model.py -v
```

Expected: `ERROR`/`FAIL` — `taxonomy.models` has no `BoatBrand` (module doesn't exist yet).

- [ ] **Step 3: Implement the normalization/slug services**

`backend/taxonomy/services.py`:

```python
import unicodedata
import uuid

from django.utils.text import slugify


def normalize_taxonomy_name(value: str) -> str:
    """Case/accent-insensitive key used for uniqueness and search matching."""
    collapsed = " ".join(value.split())
    decomposed = unicodedata.normalize("NFKD", collapsed)
    without_accents = "".join(
        char for char in decomposed if not unicodedata.combining(char)
    )
    return without_accents.casefold()


def generate_unique_slug(queryset, name, *, exclude_pk=None):
    """Return a slug unique within `queryset`, appending a short suffix on collision."""
    base_slug = slugify(name) or "item"
    slug = base_slug
    attempt = 0
    while True:
        conflict = queryset.filter(slug=slug)
        if exclude_pk is not None:
            conflict = conflict.exclude(pk=exclude_pk)
        if not conflict.exists():
            return slug
        attempt += 1
        if attempt > 20:
            raise ValueError(
                f"Could not generate a unique slug for '{name}' after 20 attempts"
            )
        slug = f"{base_slug}-{uuid.uuid4().hex[:6]}"
```

`backend/taxonomy/models.py`:

```python
import uuid

from django.conf import settings
from django.db import models

from .services import generate_unique_slug, normalize_taxonomy_name


class BoatBrand(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150)
    slug = models.SlugField(max_length=170, unique=True, blank=True)
    normalized_name = models.CharField(max_length=150, unique=True, editable=False)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        self.normalized_name = normalize_taxonomy_name(self.name)
        if not self.slug:
            self.slug = generate_unique_slug(
                BoatBrand.objects.all(), self.name, exclude_pk=self.pk
            )
        super().save(*args, **kwargs)
```

`backend/taxonomy/admin.py`:

```python
from django.contrib import admin

from .models import BoatBrand


@admin.register(BoatBrand)
class BoatBrandAdmin(admin.ModelAdmin):
    list_display = ["name", "slug", "is_active", "created_at"]
    list_filter = ["is_active"]
    search_fields = ["name", "normalized_name", "slug"]
    readonly_fields = ["normalized_name", "created_at", "updated_at"]
```

**Note:** the normalization strategy (Unicode NFKD decomposition + strip combining marks + `casefold()`) is a deliberate ruling to satisfy spec §13.1's "case/accent-insensitive search" requirement without depending on PostgreSQL's `unaccent` extension (which would need its own migration to `CREATE EXTENSION` and isn't otherwise used anywhere in this project). It is pure Python, works identically in tests and production, and the resulting `normalized_name` column is a real indexed database field — `icontains` filtering against it in Task 6/7 is genuinely database-backed, not a hardcoded/static list.

- [ ] **Step 4: Generate the migration**

```bash
uv run python manage.py makemigrations taxonomy
```

Expected: creates `backend/taxonomy/migrations/0001_initial.py` defining the `BoatBrand` table.

- [ ] **Step 5: Run the tests to verify they pass**

```bash
uv run pytest taxonomy/tests/test_boat_brand_model.py -v
```

Expected: all four tests `PASS`.

- [ ] **Step 6: Commit**

```bash
git add backend/taxonomy/models.py backend/taxonomy/services.py backend/taxonomy/admin.py backend/taxonomy/migrations backend/taxonomy/tests/test_boat_brand_model.py
git commit -m "feat(backend): add BoatBrand model with normalized-name uniqueness and slug generation"
```

---

### Task 3: `BoatModel` model with brand-scoped uniqueness and the Other-placeholder constraint

**Files:**
- Modify: `backend/taxonomy/models.py`, `backend/taxonomy/admin.py`
- Test: `backend/taxonomy/tests/test_boat_model_model.py`

**Interfaces:**
- Consumes: `taxonomy.services.normalize_taxonomy_name`, `taxonomy.services.generate_unique_slug`, `taxonomy.models.BoatBrand` (Task 2).
- Produces: `taxonomy.models.BoatModel` with fields `id, brand, name, slug, normalized_name, is_other_placeholder, is_active, created_by, updated_by, created_at, updated_at` per spec §11.3, enforcing `unique(brand, normalized_name)` and `unique(brand) where is_other_placeholder=true` at the database level.

- [ ] **Step 1: Write the failing tests**

`backend/taxonomy/tests/test_boat_model_model.py`:

```python
import threading

import pytest
from django.db import IntegrityError, connection, transaction

from taxonomy.models import BoatBrand, BoatModel


@pytest.mark.django_db
def test_creating_model_computes_normalized_name_scoped_to_its_brand():
    brand = BoatBrand.objects.create(name="Beneteau")

    model = BoatModel.objects.create(brand=brand, name="Oceanis 40")

    assert model.normalized_name == "oceanis 40"
    assert model.slug == "oceanis-40"


@pytest.mark.django_db
def test_same_model_name_is_allowed_across_different_brands():
    brand_a = BoatBrand.objects.create(name="Beneteau")
    brand_b = BoatBrand.objects.create(name="Jeanneau")

    BoatModel.objects.create(brand=brand_a, name="Flagship 40")
    BoatModel.objects.create(brand=brand_b, name="Flagship 40")

    assert BoatModel.objects.filter(normalized_name="flagship 40").count() == 2


@pytest.mark.django_db
def test_duplicate_normalized_name_within_the_same_brand_is_rejected():
    brand = BoatBrand.objects.create(name="Beneteau")
    BoatModel.objects.create(brand=brand, name="Oceanis 40")

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            BoatModel.objects.create(brand=brand, name="OCEANIS 40")


@pytest.mark.django_db
def test_only_one_other_placeholder_per_brand_is_allowed_at_the_database_level():
    brand = BoatBrand.objects.create(name="Beneteau")
    BoatModel.objects.create(brand=brand, name="Other", is_other_placeholder=True)

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            BoatModel.objects.create(
                brand=brand, name="Other (duplicate)", is_other_placeholder=True
            )


@pytest.mark.django_db(transaction=True)
def test_concurrent_creation_of_the_same_normalized_model_name_yields_one_winner():
    brand = BoatBrand.objects.create(name="Concurrent Yachts")
    results = []

    def attempt_create():
        try:
            BoatModel.objects.create(brand=brand, name="Flagship 40")
            results.append("ok")
        except IntegrityError:
            results.append("conflict")
        finally:
            connection.close()

    threads = [threading.Thread(target=attempt_create) for _ in range(2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert sorted(results) == ["conflict", "ok"]
    assert (
        BoatModel.objects.filter(brand=brand, normalized_name="flagship 40").count()
        == 1
    )


@pytest.mark.django_db(transaction=True)
def test_concurrent_creation_of_the_other_placeholder_for_the_same_brand_yields_one_winner():
    brand = BoatBrand.objects.create(name="Concurrent Yachts II")
    # Task 4 (once it lands) auto-creates an Other placeholder via a post_save
    # signal on BoatBrand — clear it first so the race below is genuine. This
    # is a no-op today, before Task 4 exists, since no placeholder exists yet.
    BoatModel.objects.filter(brand=brand, is_other_placeholder=True).delete()
    results = []

    def attempt_create(name):
        try:
            BoatModel.objects.create(
                brand=brand, name=name, is_other_placeholder=True
            )
            results.append("ok")
        except IntegrityError:
            results.append("conflict")
        finally:
            connection.close()

    threads = [
        threading.Thread(target=attempt_create, args=(name,))
        for name in ("Other", "Other (alt)")
    ]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert sorted(results) == ["conflict", "ok"]
    assert (
        BoatModel.objects.filter(brand=brand, is_other_placeholder=True).count() == 1
    )
```

(The two threads use different `name` values so only the `uniq_boatmodel_other_placeholder_per_brand` constraint can be the one stopping the loser — the `uniq_boatmodel_brand_normalized_name` constraint the sibling test above already covers stays out of it, since "Other" and "Other (alt)" normalize to different values.)

- [ ] **Step 2: Run the tests to verify they fail**

```bash
uv run pytest taxonomy/tests/test_boat_model_model.py -v
```

Expected: `ERROR` — `taxonomy.models` has no `BoatModel` yet.

- [ ] **Step 3: Implement `BoatModel`**

First, change the top of `backend/taxonomy/models.py` so its imports read:

```python
import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q

from .services import generate_unique_slug, normalize_taxonomy_name
```

(this adds `from django.db.models import Q` to the existing import block from Task 2 — everything else in that block is unchanged). Then append below the existing `BoatBrand` class:

```python
class BoatModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    brand = models.ForeignKey(
        BoatBrand, on_delete=models.PROTECT, related_name="models"
    )
    name = models.CharField(max_length=150)
    slug = models.SlugField(max_length=170, blank=True)
    normalized_name = models.CharField(max_length=150, editable=False)
    is_other_placeholder = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["brand", "normalized_name"],
                name="uniq_boatmodel_brand_normalized_name",
            ),
            models.UniqueConstraint(
                fields=["brand", "slug"],
                name="uniq_boatmodel_brand_slug",
            ),
            models.UniqueConstraint(
                fields=["brand"],
                condition=Q(is_other_placeholder=True),
                name="uniq_boatmodel_other_placeholder_per_brand",
            ),
        ]

    def __str__(self):
        return f"{self.brand.name} — {self.name}"

    def save(self, *args, **kwargs):
        self.normalized_name = normalize_taxonomy_name(self.name)
        if not self.slug:
            self.slug = generate_unique_slug(
                BoatModel.objects.filter(brand_id=self.brand_id), self.name,
                exclude_pk=self.pk,
            )
        super().save(*args, **kwargs)
```

(Move the `from django.db.models import Q` import to the top of the file alongside the existing `from django.db import models` import rather than leaving it inline — shown inline above only to mark where it's newly needed.)

Add to `backend/taxonomy/admin.py`:

```python
from .models import BoatModel


@admin.register(BoatModel)
class BoatModelAdmin(admin.ModelAdmin):
    list_display = ["name", "brand", "is_other_placeholder", "is_active", "created_at"]
    list_filter = ["is_active", "is_other_placeholder", "brand"]
    search_fields = ["name", "normalized_name", "slug"]
    readonly_fields = ["normalized_name", "is_other_placeholder", "created_at", "updated_at"]
    autocomplete_fields = ["brand"]
```

**Note:** `BoatModel.brand` uses `on_delete=models.PROTECT`. Spec §13.3 says "Never delete a model referenced by listings; deactivate or merge it" about `BoatModel` specifically, but since Task 4 guarantees every active `BoatBrand` immediately owns an `Other` `BoatModel`, `PROTECT` on this FK has the side effect of also making a `BoatBrand` with any models (which, after Task 4, means "any brand that was ever active") impossible to hard-delete — consistent with the same "deactivate, don't delete" philosophy the spec applies to models, extended here to brands for free. `is_other_placeholder` and `normalized_name` are admin-read-only because both are derived/invariant-managed fields (Task 4's signal owns the placeholder invariant; `save()` owns normalization) — hand-editing them in the admin would let staff silently violate the per-brand invariant Task 4 exists to enforce.

- [ ] **Step 4: Generate the migration**

```bash
uv run python manage.py makemigrations taxonomy
```

Expected: creates a new migration (e.g. `0002_boatmodel.py`) defining the `BoatModel` table and its three constraints.

- [ ] **Step 5: Run the tests to verify they pass**

```bash
uv run pytest taxonomy/tests/test_boat_model_model.py -v
```

Expected: all six tests `PASS`, including the two two-thread concurrency tests — one proving the database constraint (not application code) prevents a duplicate ordinary model name, the other proving it separately prevents a second Other placeholder for the same brand — matching spec §34.2's concurrency-test philosophy.

- [ ] **Step 6: Commit**

```bash
git add backend/taxonomy/models.py backend/taxonomy/admin.py backend/taxonomy/migrations backend/taxonomy/tests/test_boat_model_model.py
git commit -m "feat(backend): add BoatModel with brand-scoped uniqueness and other-placeholder constraint"
```

---

### Task 4: Automatic per-brand "Other" placeholder

**Files:**
- Modify: `backend/taxonomy/apps.py`, `backend/taxonomy/services.py`
- Create: `backend/taxonomy/signals.py`
- Test: `backend/taxonomy/tests/test_other_placeholder.py`
- Modify (test): `backend/taxonomy/tests/test_boat_model_model.py` — this task's signal changes the precondition of Task 3's `test_only_one_other_placeholder_per_brand_is_allowed_at_the_database_level` test, so this task updates that test file too, not just `test_other_placeholder.py` (see Step 4 below).

**Interfaces:**
- Consumes: `taxonomy.models.BoatBrand`, `taxonomy.models.BoatModel` (Tasks 2–3).
- Produces: `taxonomy.services.ensure_other_placeholder(brand: BoatBrand) -> BoatModel` — idempotent, called automatically via a `post_save` signal on `BoatBrand` whenever a brand is saved with `is_active=True`. Later phases (Phase 17 staff brand creation, a future seed command) get this invariant for free from any code path that saves an active `BoatBrand` — no phase after this one needs to remember to create the Other placeholder itself.

- [ ] **Step 1: Write the failing tests**

`backend/taxonomy/tests/test_other_placeholder.py`:

```python
import pytest

from taxonomy.models import BoatBrand, BoatModel


@pytest.mark.django_db
def test_creating_an_active_brand_auto_creates_its_other_placeholder():
    brand = BoatBrand.objects.create(name="Beneteau")

    other = BoatModel.objects.get(brand=brand, is_other_placeholder=True)
    assert other.name == "Other"


@pytest.mark.django_db
def test_saving_an_already_active_brand_again_does_not_create_a_second_placeholder():
    brand = BoatBrand.objects.create(name="Jeanneau")
    assert BoatModel.objects.filter(brand=brand, is_other_placeholder=True).count() == 1

    brand.save()

    assert BoatModel.objects.filter(brand=brand, is_other_placeholder=True).count() == 1


@pytest.mark.django_db
def test_reactivating_a_brand_does_not_create_a_second_other_placeholder():
    brand = BoatBrand.objects.create(name="Lagoon")
    assert BoatModel.objects.filter(brand=brand, is_other_placeholder=True).count() == 1

    brand.is_active = False
    brand.save()
    brand.is_active = True
    brand.save()

    assert BoatModel.objects.filter(brand=brand, is_other_placeholder=True).count() == 1


@pytest.mark.django_db
def test_an_inactive_brand_does_not_get_an_other_placeholder():
    brand = BoatBrand.objects.create(name="Draft Brand", is_active=False)

    assert not BoatModel.objects.filter(brand=brand, is_other_placeholder=True).exists()
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
uv run pytest taxonomy/tests/test_other_placeholder.py -v
```

Expected: `FAIL` on every test with `BoatModel.DoesNotExist` (or `count() == 0`) — no auto-creation mechanism exists yet.

- [ ] **Step 3: Implement the service function and the signal**

Append to `backend/taxonomy/services.py`:

```python
from django.db import transaction


def ensure_other_placeholder(brand):
    """Idempotently guarantee `brand` has exactly one Other BoatModel."""
    from .models import BoatModel  # local import: avoids a models<->services circular import

    with transaction.atomic():
        other, _ = BoatModel.objects.get_or_create(
            brand=brand,
            is_other_placeholder=True,
            defaults={"name": "Other"},
        )
        return other
```

`backend/taxonomy/signals.py`:

```python
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import BoatBrand
from .services import ensure_other_placeholder


@receiver(post_save, sender=BoatBrand)
def ensure_other_placeholder_on_brand_save(sender, instance, **kwargs):
    if instance.is_active:
        ensure_other_placeholder(instance)
```

`backend/taxonomy/apps.py`:

```python
from django.apps import AppConfig


class TaxonomyConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "taxonomy"

    def ready(self):
        from . import signals  # noqa: F401
```

**Note:** `ensure_other_placeholder` is signal-driven (not called explicitly from `BoatBrand.save()`) so that it fires for every current and future creation path — Django admin (Task 2/3), a Django shell session, a future Phase 17 staff-create-brand endpoint, or a future seed command — without any of those callers needing to remember to invoke it themselves. It is safe to call repeatedly: `get_or_create` on the `is_other_placeholder=True` filter combined with the database-level `uniq_boatmodel_other_placeholder_per_brand` constraint from Task 3 means even a race between two processes saving the same brand concurrently can produce at most one placeholder. One known, accepted edge case: if a brand happens to already have a genuine (non-placeholder) model literally named `"Other"` with the same `normalized_name`, the signal's `get_or_create` would hit the Task 3 `uniq_boatmodel_brand_normalized_name` constraint and raise `IntegrityError`. This is not handled specially here — it is flagged as a known limitation for Phase 17 (or the seed command) to actively avoid when naming real models.

- [ ] **Step 4: Update Task 3's now-stale placeholder-uniqueness test**

This task's `post_save` signal means every `BoatBrand.objects.create(...)` call now auto-creates that brand's "Other" `BoatModel` before any test code runs. Task 3's `test_only_one_other_placeholder_per_brand_is_allowed_at_the_database_level` test (in `backend/taxonomy/tests/test_boat_model_model.py`) currently creates the brand's first "Other" placeholder itself, unguarded (no `pytest.raises`) — after this task lands, that line collides with the signal-created placeholder and raises an unexpected `IntegrityError` outside of `pytest.raises`, failing the test for the wrong reason. Update it to assert against the signal's placeholder instead of creating the first one itself:

```python
@pytest.mark.django_db
def test_only_one_other_placeholder_per_brand_is_allowed_at_the_database_level():
    brand = BoatBrand.objects.create(name="Beneteau")
    # This task's post_save signal already created the brand's Other placeholder here.
    existing_other = BoatModel.objects.get(brand=brand, is_other_placeholder=True)
    assert existing_other.name == "Other"

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            BoatModel.objects.create(
                brand=brand, name="Other (duplicate)", is_other_placeholder=True
            )
```

- [ ] **Step 5: Run both test files to verify they pass**

```bash
uv run pytest taxonomy/tests/test_other_placeholder.py taxonomy/tests/test_boat_model_model.py -v
```

Expected: all four `test_other_placeholder.py` tests `PASS`, and all six `test_boat_model_model.py` tests (including the just-updated placeholder-uniqueness test) `PASS`.

- [ ] **Step 6: Commit**

```bash
git add backend/taxonomy/apps.py backend/taxonomy/signals.py backend/taxonomy/services.py backend/taxonomy/tests/test_other_placeholder.py backend/taxonomy/tests/test_boat_model_model.py
git commit -m "feat(backend): auto-create exactly one Other placeholder per active brand"
```

---

### Task 5: Custom model name normalization for the Other workflow

**Files:**
- Modify: `backend/taxonomy/services.py`
- Test: `backend/taxonomy/tests/test_custom_model_name.py`

**Interfaces:**
- Produces: `taxonomy.services.normalize_custom_model_name(value: str) -> str`, raising `django.core.exceptions.ValidationError` for a punctuation/whitespace-only value. This is a standalone, model-independent utility — the future Listings phase (spec §13.2 items 5–6) will call it when validating `Listing.custom_model_name` before save; this plan defines the rule now so both phases agree on its exact behavior without re-deriving it later.

- [ ] **Step 1: Write the failing tests**

`backend/taxonomy/tests/test_custom_model_name.py`:

```python
import unicodedata

import pytest
from django.core.exceptions import ValidationError

from taxonomy.services import normalize_custom_model_name


def test_collapses_internal_whitespace_and_trims_ends():
    assert (
        normalize_custom_model_name("  McKenzie   40   Flybridge  ")
        == "McKenzie 40 Flybridge"
    )


def test_unicode_normalizes_to_nfc():
    decomposed = unicodedata.normalize("NFD", "Catamarán")
    assert normalize_custom_model_name(decomposed) == unicodedata.normalize(
        "NFC", "Catamarán"
    )


def test_rejects_a_punctuation_only_value():
    with pytest.raises(ValidationError):
        normalize_custom_model_name("---")


def test_rejects_a_whitespace_only_value():
    with pytest.raises(ValidationError):
        normalize_custom_model_name("   ")


def test_accepts_a_value_with_at_least_one_alphanumeric_character():
    assert normalize_custom_model_name("40-XR") == "40-XR"
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
uv run pytest taxonomy/tests/test_custom_model_name.py -v
```

Expected: `ERROR` — `normalize_custom_model_name` doesn't exist yet.

- [ ] **Step 3: Implement it**

Append to `backend/taxonomy/services.py`:

```python
import re

from django.core.exceptions import ValidationError

_HAS_ALPHANUMERIC_RE = re.compile(r"[^\W_]", re.UNICODE)


def normalize_custom_model_name(value: str) -> str:
    """Whitespace-collapse and Unicode-normalize a free-text 'Other' model name.

    Raises ValidationError if the cleaned value contains no letters or digits
    (spec §13.2 item 5: "rejected if it contains only punctuation").
    """
    collapsed = " ".join(value.split())
    normalized = unicodedata.normalize("NFC", collapsed)
    if not _HAS_ALPHANUMERIC_RE.search(normalized):
        raise ValidationError(
            "Enter the model name.", code="custom_model_name_punctuation_only"
        )
    return normalized
```

(`unicodedata` and `re` join the existing imports at the top of `backend/taxonomy/services.py`; `unicodedata` is already imported there from Task 2.)

- [ ] **Step 4: Run the tests to verify they pass**

```bash
uv run pytest taxonomy/tests/test_custom_model_name.py -v
```

Expected: all five tests `PASS`.

- [ ] **Step 5: Commit**

```bash
git add backend/taxonomy/services.py backend/taxonomy/tests/test_custom_model_name.py
git commit -m "feat(backend): add custom Other-model name normalization rule"
```

---

### Task 6: `GET /api/v1/boat-brands/` search endpoint

**Files:**
- Create: `backend/taxonomy/pagination.py`, `backend/taxonomy/serializers.py`, `backend/taxonomy/views.py`, `backend/taxonomy/urls.py`
- Modify: `backend/config/urls.py`
- Test: `backend/taxonomy/tests/test_boat_brand_search_api.py`

**Interfaces:**
- Consumes: `taxonomy.models.BoatBrand`, `taxonomy.services.normalize_taxonomy_name` (Task 2).
- Produces: `GET /api/v1/boat-brands/?q=<text>` → `{"count", "next", "previous", "results": [{"id", "name", "slug"}, ...]}`, HTTP 200, publicly accessible (no authentication required), throttled under the `taxonomy_search` scope from Task 1. `taxonomy.pagination.TaxonomySearchPagination` and `taxonomy.serializers.BoatBrandSerializer` are reused by Task 7.

- [ ] **Step 1: Write the failing tests**

`backend/taxonomy/tests/test_boat_brand_search_api.py`:

```python
import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from taxonomy.models import BoatBrand


@pytest.mark.django_db
def test_boat_brand_search_returns_only_active_brands_alphabetically():
    BoatBrand.objects.create(name="Jeanneau")
    BoatBrand.objects.create(name="Beneteau")
    BoatBrand.objects.create(name="Retired Brand", is_active=False)

    response = APIClient().get("/api/v1/boat-brands/")

    assert response.status_code == 200
    names = [item["name"] for item in response.data["results"]]
    assert names == ["Beneteau", "Jeanneau"]


@pytest.mark.django_db
def test_boat_brand_search_is_case_and_accent_insensitive():
    BoatBrand.objects.create(name="Bénéteau")

    response = APIClient().get("/api/v1/boat-brands/", {"q": "beneteau"})

    assert response.status_code == 200
    assert [item["name"] for item in response.data["results"]] == ["Bénéteau"]


@pytest.mark.django_db
def test_boat_brand_search_is_publicly_accessible_without_authentication():
    response = APIClient().get("/api/v1/boat-brands/")

    assert response.status_code == 200


@pytest.mark.django_db
def test_boat_brand_search_is_rate_limited(settings):
    cache.clear()
    settings.REST_FRAMEWORK = {
        **settings.REST_FRAMEWORK,
        "DEFAULT_THROTTLE_RATES": {"taxonomy_search": "2/min"},
    }
    client = APIClient()
    client.get("/api/v1/boat-brands/")
    client.get("/api/v1/boat-brands/")
    response = client.get("/api/v1/boat-brands/")

    assert response.status_code == 429
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
uv run pytest taxonomy/tests/test_boat_brand_search_api.py -v
```

Expected: `FAIL` — `/api/v1/boat-brands/` returns 404 (not routed yet).

- [ ] **Step 3: Implement the pagination class, serializer, view and URL**

`backend/taxonomy/pagination.py`:

```python
from rest_framework.pagination import PageNumberPagination


class TaxonomySearchPagination(PageNumberPagination):
    page_size = 20
    max_page_size = 100
```

`backend/taxonomy/serializers.py`:

```python
from rest_framework import serializers

from .models import BoatBrand


class BoatBrandSerializer(serializers.ModelSerializer):
    class Meta:
        model = BoatBrand
        fields = ["id", "name", "slug"]
```

`backend/taxonomy/views.py`:

```python
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny
from rest_framework.throttling import ScopedRateThrottle

from .models import BoatBrand
from .pagination import TaxonomySearchPagination
from .serializers import BoatBrandSerializer
from .services import normalize_taxonomy_name


class BoatBrandListView(ListAPIView):
    serializer_class = BoatBrandSerializer
    permission_classes = [AllowAny]
    pagination_class = TaxonomySearchPagination
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "taxonomy_search"

    def get_queryset(self):
        queryset = BoatBrand.objects.filter(is_active=True).order_by("name")
        query = self.request.query_params.get("q", "").strip()
        if query:
            queryset = queryset.filter(
                normalized_name__icontains=normalize_taxonomy_name(query)
            )
        return queryset
```

`backend/taxonomy/urls.py`:

```python
from django.urls import path

from .views import BoatBrandListView

urlpatterns = [
    path("boat-brands/", BoatBrandListView.as_view(), name="boat-brand-list"),
]
```

Modify `backend/config/urls.py`:

```python
from django.contrib import admin
from django.urls import include, path

from common.views import HealthCheckView, StripeWebhookView

urlpatterns = [
    path('admin/', admin.site.urls),
    path("api/v1/health/", HealthCheckView.as_view(), name="health-check"),
    path("api/v1/stripe/webhook/", StripeWebhookView.as_view(), name="stripe-webhook"),
    path("api/v1/", include("taxonomy.urls")),
]
```

**Note:** `permission_classes = [AllowAny]` is required here even though the project-wide DRF default (set in Task 1/Phase 0/1) is `IsAuthenticated` — brand/model search must work for guests filling in a listing form before they've authenticated (spec §1's "Guests can fill the form" decision), and for the public boat-search filters. `authentication_classes` is deliberately left at its project default (JWT) rather than emptied like `HealthCheckView`/`StripeWebhookView` did, so an authenticated request is still recognized if a valid token is sent — this endpoint just doesn't require one.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
uv run pytest taxonomy/tests/test_boat_brand_search_api.py -v
```

Expected: all four tests `PASS`.

- [ ] **Step 5: Commit**

```bash
git add backend/taxonomy/pagination.py backend/taxonomy/serializers.py backend/taxonomy/views.py backend/taxonomy/urls.py backend/config/urls.py backend/taxonomy/tests/test_boat_brand_search_api.py
git commit -m "feat(backend): add public GET /api/v1/boat-brands/ search endpoint"
```

---

### Task 7: `GET /api/v1/boat-models/` search endpoint with Other metadata

**Files:**
- Modify: `backend/taxonomy/serializers.py`, `backend/taxonomy/views.py`, `backend/taxonomy/urls.py`
- Test: `backend/taxonomy/tests/test_boat_model_search_api.py`

**Interfaces:**
- Consumes: `taxonomy.models.BoatModel` (Task 3), `taxonomy.services.normalize_taxonomy_name` (Task 2), `taxonomy.pagination.TaxonomySearchPagination` (Task 6).
- Produces: `GET /api/v1/boat-models/?brand_id=<uuid>&q=<text>` → `{"count", "next", "previous", "results": [{"id", "name", "slug"}, ...], "other": {"id", "label": "Other"} | null, "show_other_prompt": bool}`, HTTP 200; HTTP 400 when `brand_id` is missing or not a valid UUID.

- [ ] **Step 1: Write the failing tests**

`backend/taxonomy/tests/test_boat_model_search_api.py`:

```python
import pytest
from rest_framework.test import APIClient

from taxonomy.models import BoatBrand, BoatModel


@pytest.mark.django_db
def test_boat_model_search_requires_brand_id():
    response = APIClient().get("/api/v1/boat-models/")

    assert response.status_code == 400


@pytest.mark.django_db
def test_boat_model_search_rejects_a_malformed_brand_id():
    response = APIClient().get("/api/v1/boat-models/", {"brand_id": "not-a-uuid"})

    assert response.status_code == 400


@pytest.mark.django_db
def test_boat_model_search_returns_ordinary_models_and_other_metadata():
    brand = BoatBrand.objects.create(name="Beneteau")
    BoatModel.objects.create(brand=brand, name="Oceanis 40")

    response = APIClient().get("/api/v1/boat-models/", {"brand_id": str(brand.id)})

    assert response.status_code == 200
    names = [item["name"] for item in response.data["results"]]
    assert names == ["Oceanis 40"]
    assert response.data["other"]["label"] == "Other"
    assert response.data["show_other_prompt"] is False


@pytest.mark.django_db
def test_boat_model_search_with_no_match_signals_show_other_prompt():
    brand = BoatBrand.objects.create(name="Beneteau")
    BoatModel.objects.create(brand=brand, name="Oceanis 40")

    response = APIClient().get(
        "/api/v1/boat-models/", {"brand_id": str(brand.id), "q": "Nonexistent Model"}
    )

    assert response.status_code == 200
    assert response.data["results"] == []
    assert response.data["show_other_prompt"] is True


@pytest.mark.django_db
def test_boat_model_search_only_returns_models_for_the_requested_brand():
    brand_a = BoatBrand.objects.create(name="Beneteau")
    brand_b = BoatBrand.objects.create(name="Jeanneau")
    BoatModel.objects.create(brand=brand_a, name="Oceanis 40")
    BoatModel.objects.create(brand=brand_b, name="Sun Odyssey 410")

    response = APIClient().get("/api/v1/boat-models/", {"brand_id": str(brand_a.id)})

    names = [item["name"] for item in response.data["results"]]
    assert names == ["Oceanis 40"]


@pytest.mark.django_db
def test_boat_model_search_never_includes_the_other_placeholder_in_results():
    brand = BoatBrand.objects.create(name="Beneteau")  # auto-creates its Other placeholder

    response = APIClient().get("/api/v1/boat-models/", {"brand_id": str(brand.id)})

    assert response.data["results"] == []
    assert response.data["other"]["label"] == "Other"


@pytest.mark.django_db
def test_boat_model_search_returns_empty_for_an_inactive_brand():
    brand = BoatBrand.objects.create(name="Beneteau")
    BoatModel.objects.create(brand=brand, name="Oceanis 40")
    brand.is_active = False
    brand.save()

    response = APIClient().get("/api/v1/boat-models/", {"brand_id": str(brand.id)})

    assert response.status_code == 200
    assert response.data["results"] == []
    assert response.data["other"] is None
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
uv run pytest taxonomy/tests/test_boat_model_search_api.py -v
```

Expected: `FAIL` — `/api/v1/boat-models/` returns 404 (not routed yet).

- [ ] **Step 3: Implement the endpoint**

Append to `backend/taxonomy/serializers.py`:

```python
from .models import BoatModel


class BoatModelSerializer(serializers.ModelSerializer):
    class Meta:
        model = BoatModel
        fields = ["id", "name", "slug"]
```

Append to `backend/taxonomy/views.py`:

```python
import uuid

from rest_framework.exceptions import ValidationError as DRFValidationError

from .models import BoatModel
from .serializers import BoatModelSerializer


class BoatModelListView(ListAPIView):
    serializer_class = BoatModelSerializer
    permission_classes = [AllowAny]
    pagination_class = TaxonomySearchPagination
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "taxonomy_search"

    def get_queryset(self):
        brand_id = self.request.query_params.get("brand_id")
        if not brand_id:
            raise DRFValidationError({"brand_id": "This query parameter is required."})
        try:
            uuid.UUID(brand_id)
        except ValueError as exc:
            raise DRFValidationError({"brand_id": "Must be a valid UUID."}) from exc

        queryset = BoatModel.objects.filter(
            brand_id=brand_id,
            brand__is_active=True,
            is_active=True,
            is_other_placeholder=False,
        ).order_by("name")
        query = self.request.query_params.get("q", "").strip()
        if query:
            queryset = queryset.filter(
                normalized_name__icontains=normalize_taxonomy_name(query)
            )
        return queryset

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        query = request.query_params.get("q", "").strip()

        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page, many=True)
        response = self.get_paginated_response(serializer.data)
        total_count = self.paginator.page.paginator.count

        brand_id = request.query_params.get("brand_id")
        other = (
            BoatModel.objects.filter(
                brand_id=brand_id, brand__is_active=True, is_other_placeholder=True
            )
            .values("id")
            .first()
        )
        response.data["other"] = (
            {"id": str(other["id"]), "label": "Other"} if other else None
        )
        response.data["show_other_prompt"] = bool(query) and total_count == 0
        return response
```

Modify `backend/taxonomy/urls.py`:

```python
from django.urls import path

from .views import BoatBrandListView, BoatModelListView

urlpatterns = [
    path("boat-brands/", BoatBrandListView.as_view(), name="boat-brand-list"),
    path("boat-models/", BoatModelListView.as_view(), name="boat-model-list"),
]
```

**Note (response envelope ruling):** spec §13.1's example JSON (`{"results": [], "other": {...}, "show_other_prompt": true}`) shows only the taxonomy-specific fields, not a full pagination envelope. This plan adds `other`/`show_other_prompt` as extra top-level keys alongside the standard `count`/`next`/`previous`/`results` shape DRF's `PageNumberPagination` already produces (and which Task 6's brand endpoint also uses), rather than inventing a second, inconsistent pagination convention just for this one endpoint — keeping "paginated results use one consistent shape" (spec §30.2) true project-wide.

**Note (`show_other_prompt` ruling):** computed as `bool(query) and total_count == 0` — true only when the caller supplied a non-empty `q` and zero ordinary (non-Other) models matched it anywhere in the brand (using the pre-pagination total count, not just the current page), which matches spec §13.1's "When search has no ordinary match" wording. With no `q` at all, it is always `False` — the frontend is expected to always append the `other` entry at the bottom of the full dropdown per spec §13.2 item 1's "Other option is included last," independent of this prompt flag.

**Note (`brand_id` ruling):** a missing or malformed `brand_id` is a client error (HTTP 400, matching spec §30.2's error-response convention), but a syntactically valid `brand_id` for a brand that doesn't exist (or is inactive) is treated leniently — it returns an empty `results` list with `other: null` rather than a 404, since a stale/deactivated brand reference from a client shouldn't be an exceptional error case for a read-only search endpoint.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
uv run pytest taxonomy/tests/test_boat_model_search_api.py -v
```

Expected: all seven tests `PASS`.

- [ ] **Step 5: Commit**

```bash
git add backend/taxonomy/serializers.py backend/taxonomy/views.py backend/taxonomy/urls.py backend/taxonomy/tests/test_boat_model_search_api.py
git commit -m "feat(backend): add public GET /api/v1/boat-models/ search endpoint with other metadata"
```

---

### Task 8: Final integration pass and activity log update

**Files:**
- Modify: `ACTIVITY.md`

**Interfaces:** none — this task only verifies the prior 7 tasks work together and records that fact.

- [ ] **Step 1: Full backend regression run against real Postgres/Redis**

```bash
docker compose up -d
cd backend
uv run python manage.py migrate
uv run pytest -v
```

Expected: every test from Tasks 2–7 passes alongside the full pre-existing Phase 0/1 suite (`common/tests/`) in one run — this is the first time the `taxonomy` app's migrations run against a fresh `migrate`, proving there is no missing/out-of-order migration dependency.

- [ ] **Step 2: Manual end-to-end verification against the real endpoints**

```bash
uv run python manage.py runserver 8020
```

In a second terminal:

```bash
uv run python manage.py shell -c "
from taxonomy.models import BoatBrand, BoatModel
brand = BoatBrand.objects.create(name='Bénéteau')
BoatModel.objects.create(brand=brand, name='Oceanis 40')
print(brand.id)
"
curl -s "http://localhost:8020/api/v1/boat-brands/?q=beneteau" | python -m json.tool
curl -s "http://localhost:8020/api/v1/boat-models/?brand_id=<paste-the-printed-brand-id>" | python -m json.tool
```

Expected: the brands call returns the `Bénéteau` brand for the accent/case-insensitive query `beneteau`; the models call returns `Oceanis 40` in `results` plus a populated `other` object and `"show_other_prompt": false`.

- [ ] **Step 3: Update `ACTIVITY.md`**

Append a new entry at the top of the `## Log` section:

```markdown
### 2026-09-17 — Phase 4 brand/model taxonomy complete

- Implemented `docs/superpowers/plans/2026-09-17-phase-4-brand-model-taxonomy.md` in full.
- New `taxonomy` app: `BoatBrand`/`BoatModel` models (accent/case-insensitive normalized-name uniqueness, brand-scoped model uniqueness, one database-enforced Other placeholder per brand, auto-created via a `post_save` signal), and a custom-model-name normalization rule for the future Other workflow.
- Public endpoints: `GET /api/v1/boat-brands/?q=` and `GET /api/v1/boat-models/?brand_id=&q=`, both database-backed, paginated, rate-limited (DRF `ScopedRateThrottle`, `taxonomy_search` scope), and open to unauthenticated requests.
- Known limitations: no staff CRUD/mapping-to-listing endpoints yet (`/api/v1/staff/taxonomy/...` — spec Phase 17); `Listing.custom_model_name` doesn't exist yet (needs the Listings phase) so the Other workflow's display/filter behavior (spec §13.2 items 7-8) isn't wired up end to end yet; no production seed command yet (spec §38); taxonomy mutations will use Phase 2's shared `audit.services.record_audit_event()` when a future phase (17, staff taxonomy mapping) adds mutation endpoints — no taxonomy-specific audit model needed, and no audit call exists in this plan today since this phase has no mutation endpoints yet (only read/search).
- Next: write the Phase 2 plan (shared domain types, `platform_settings` app, audit foundation) per spec §10 — still outstanding from the Phase 0/1 handoff — or the Phase 3 plan (identity/organizations/permissions) if it hasn't merged yet, whichever the project owner prioritizes.
```

Update the "Current State" section's bullet listing domain apps to note `taxonomy` now exists (no longer "no domain apps yet").

- [ ] **Step 4: Commit and push**

```bash
git add ACTIVITY.md
git commit -m "docs: record phase 4 brand/model taxonomy completion in activity log"
git push origin dev
```

---

## Known Limitations (carried forward, not fixed by this plan)

- No staff-facing mutation endpoints exist for brands/models yet — Django admin (Tasks 2/3) is the only way to create/edit/deactivate taxonomy rows until spec Phase 17 builds the dedicated `/api/v1/staff/taxonomy/...` transactions (spec §13.3: "Create model and map listing," "Map to existing model," merge preview).
- `BoatBrand`/`BoatModel`'s `created_by`/`updated_by` fields are real nullable FK columns per spec §11.3 but nothing populates them automatically yet (Django admin's default `save_model` doesn't set them) — wiring that up needs an authenticated actor context, which arrives with Phase 17's staff endpoints.
- `Listing.custom_model_name` does not exist yet — the Other workflow's listing-facing behavior (spec §13.2 items 7-8: card/detail display of "Model: Other — McKenzie," the boat-search filter matching every Other listing regardless of custom text) cannot be built until the Listings phase creates the `Listing` model and imports `taxonomy.services.normalize_custom_model_name`.
- Taxonomy mutations will use Phase 2's shared `audit.services.record_audit_event()` when a future phase (17, staff taxonomy mapping) adds mutation endpoints — no taxonomy-specific audit model needed. No audit call exists in this plan today since this phase has no mutation endpoints yet (only read/search).
- No production seed command creates real brand/model rows yet (spec §38's "Exactly one Other model per seeded brand" requirement is already structurally guaranteed by Task 4's signal for whatever brands a future seed command creates — that command itself is not part of this plan).
- The rare edge case of a brand having a genuine (non-placeholder) model already named exactly `"Other"` before the signal from Task 4 runs is not specially handled — see the Note under Task 4.
- The `post_save` signal that auto-creates each brand's "Other" placeholder does NOT fire for `bulk_create()` — any future seed/import command that bulk-creates `BoatBrand` rows must call `ensure_other_placeholder()` (Task 4's function) explicitly per brand.
