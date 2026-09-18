# NAUTA Phase 5 — Directory Consolidation (Services / Professionals) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two duplicate public directories with one database-backed combined directory at `/services/professionals/` — building the `ServiceCategory` and `ProfessionalService` catalog models, the public read APIs behind them, the Next.js directory/detail/SEO pages, the single-hop 301 redirects from the retired URLs, and the legacy-mapping mechanism spec §14.3 mandates.

**Architecture:** One new Django app, `services_catalog`, owns the service catalog (`ServiceCategory`, `ProfessionalService`) and the legacy mapping table; it depends one-directionally on Phase 3's `professionals` app for `ProfessionalProfile` and never modifies it. The backend stays a headless API (four public read endpoints plus a legacy-id resolver); Next.js owns every public page and server-renders them from those endpoints. Staff catalog CRUD is Django admin, routed through audited service functions so the `AuditEvent` trail is guaranteed regardless of entry point.

**Tech Stack:** Python 3.13 + `uv`, Django 5.2 LTS, Django REST Framework, PostgreSQL 16, Redis (cache + DRF throttle counters); **Next.js 16.3.5** (App Router, TypeScript), **Tailwind CSS v4**, `pnpm`, Vitest + Testing Library (introduced by Phase 3's Task 10). No new third-party dependencies in either project.

**Version-drift check (do this before writing any App Router code):** the scaffolded frontend is Next.js **16.3.5** with Tailwind **v4**, not the 15.x a model's training data is likely to assume — `frontend/AGENTS.md` flags this explicitly. Before using any App Router API in Tasks 11–16 (`redirects()` in `next.config.ts`, `trailingSlash`, Route Handlers, `NextResponse.redirect`, the `params`/`searchParams` shapes, `generateMetadata`, `MetadataRoute.Sitemap`, `notFound()`), verify the signature against the installed version in `frontend/node_modules/next/dist/docs/` or `frontend/node_modules/next/package.json` rather than from memory. `params` and `searchParams` became **Promises** in Next 15/16 and every page in this plan awaits them.

**Spec:** [`NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md`](../../../NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md) — primarily §14 (Phase 5), §11.2 (service catalog data model), §1 and §4.1/§4.3 (fixed URLs and redirects), §29.3/§29.4 (professional profile and combined directory requirements), §30.1/§30.2/§30.4 (API inventory, response conventions, rate limits), §31 (UI-to-backend traceability), §32.2 (SEO), §35.1 (feature flags), §37 (localization keys), §38 (seed data), §39 (developer execution protocol).

**Predecessor plans (read before starting):**
- [`2026-09-17-phase-3-identity-organizations-permissions.md`](./2026-09-17-phase-3-identity-organizations-permissions.md) — **hard dependency**. Its **Task 6** defines `ProfessionalProfile`; this plan uses those exact field names and never re-derives them from spec §11.1's shorthand table. Its "Contract summary for later phases" lists everything importable from Phase 3, and its rules 1, 2, 9 and 11 are binding here.
- [`2026-09-17-phase-4-brand-model-taxonomy.md`](./2026-09-17-phase-4-brand-model-taxonomy.md) — structural template for a new domain app with public, paginated, rate-limited, unauthenticated search endpoints. Mirrored here with one deliberate deviation (throttle class — see Global Constraints).
- [`2026-09-17-phase-2-shared-types-platform-settings.md`](./2026-09-17-phase-2-shared-types-platform-settings.md) — `common.models.UUIDTimeStampedModel`, `audit.services.record_audit_event()`, `platform_settings.services.is_feature_enabled()`/`set_feature_flag()`.

**Phase dependencies:** spec §7 — Phase 5 depends on Phase 3 (identity/professionals) and Phase 4 (taxonomy, already merged). It does **not** depend on Phase 11 (listings): professionals and services are a wholly separate directory from boat listings, and nothing in this plan imports, joins to or assumes a `Listing` model. Phase 6 (shared inquiry form) and Phase 7 (contact privacy) depend on *this* phase, not the other way round — their surfaces appear here only as documented seams (see "Scope rulings").

## Execution Model

Per the standing project convention recorded in `ACTIVITY.md`: each task is implemented on its own branch off the current tip of `dev` (`git checkout -b task-N-<slug> dev`), run through `subagent-driven-development`'s implementer → task-reviewer → fix-loop cycle, opened as a PR (`gh pr create`), and merged by the controller only when CI is green and the branch is cleanly mergeable. Tasks run strictly sequentially — never two branches in flight at once — and each new task branches from the just-merged `dev` tip. **This includes Task 1**: `ACTIVITY.md`'s Log shows one PR per task for every prior phase, with no exception for scaffolding, so Task 1 gets its own branch and its own PR like every other task. It is simply the smallest one.

## Global Constraints

Exact values copied from the spec. Every task's requirements implicitly include this section.

- **Combined directory name:** visible navigation label **`Services / Professionals`**; page H1 **`Nautical Services & Professionals`** (spec §1).
- **Canonical combined URL:** `/services/professionals/` (spec §1, §4.1).
- **Professional profile URL:** `/services/professionals/<professional-slug>/` (spec §1, §4.1) — identical to Phase 3's `ProfessionalProfile.get_absolute_url()`.
- **Retired directory URLs:** `/services/` and `/professionals/` return **permanent 301** redirects to `/services/professionals/` (spec §1, §4.3). `/professionals/profile/?id=<legacy>` → resolved professional slug URL, **301 when resolvable, otherwise 404** (spec §4.3). Redirects must be **single-hop** — "never create redirect chains" (spec §4.3).
- **The six approved SEO service pages keep their own canonical URLs** and stay indexable (spec §1): `/services/full-brokerage/`, `/services/legal/`, `/services/insurance/`, `/services/engines-maintenance/`, `/services/transport-delivery/`, `/services/nautical-marketing/` (spec §4.1). They are `ServiceCategory` records flagged `has_seo_page=true`, "not separate hard-coded templates with divergent data models" (spec §11.2).
- **Supported interface languages are exactly English (`en`), Italian (`it`) and Spanish (`es`)** (spec §0). All new UI text has EN/IT/ES translation keys; backend responses never hard-code English UI strings (spec §37).
- **Feature flag key for this phase:** `combined_services_professionals` (spec §35.1). Flags gate both frontend exposure and backend mutation; "do not leave an enabled API behind a disabled UI unintentionally."
- Backend: Python 3.13 + `uv`, Django 5.2 LTS, DRF for all JSON APIs, PostgreSQL 16 and Redis via the existing `docker-compose.yml` (Postgres `127.0.0.1:5433`, Redis `127.0.0.1:6380`, MinIO `127.0.0.1:9010`).
- Backend dev server port is **8020**; frontend dev server port is **3020** (Phase 0/1 Task 4 "Ruling A" — the 8000/3000 defaults are occupied on this machine).
- **Tests run against PostgreSQL, never SQLite.** `backend/config/settings/test.py` MUST NOT be modified to override `DATABASES` or `CACHES` to SQLite / `LocMemCache`. This rule was violated and reverted once already in this project — if a test is slow or awkward against real Postgres/Redis, fix the test, never the settings.
- All primary keys are UUIDs; all timestamps are timezone-aware UTC (spec §11 preamble). Every new model inherits `common.models.UUIDTimeStampedModel` (Phase 3 contract rule 2).
- User references use `settings.AUTH_USER_MODEL` in model fields and `django.contrib.auth.get_user_model()` in code/tests — never a hardcoded `"accounts.User"` string (Phase 3 contract rule 1).
- **Rate limiting uses `common.throttling.HashedIPScopedRateThrottle`**, which Phase 3's Task 3 installs as `DEFAULT_THROTTLE_CLASSES` because spec §30.4 forbids storing raw client IPs in throttle cache keys. This plan's views therefore declare **only** `throttle_scope`, never `throttle_classes` (Phase 3 contract rule 9). This is a deliberate deviation from the already-merged `taxonomy` views, which pin DRF's stock `ScopedRateThrottle` at view level and are a known, unfixed §30.4 violation — do not copy that line. New scope added by this plan: `services_directory` = **`60/min`** (same rate as `taxonomy_search`).
- Every error response uses the spec §30.2 envelope (stable machine `code`, user-safe `message`, `fields` map, `request_id`) — produced automatically by `common.exceptions.nauta_exception_handler` from Phase 3's Task 2. Times are ISO 8601 UTC. Paginated results use one consistent shape.
- **Every visible state maps to a real backend source** (spec §2.1). No invented counts, no decorative certifications, no hard-coded category or provider lists. Skeleton loaders are permitted only during loading.
- Staff catalog CRUD writes an immutable audit event containing actor, action, target, before/after summary, timestamp, request ID and source (spec §2.4) via `audit.services.record_audit_event()`.
- No partial or visual-only implementations, no faked/hardcoded demo data, no TODO placeholders for backend enforcement (spec §39).
- TDD per task: write the failing test, run it and see it fail, write the minimal implementation, run it and see it pass, commit.
- **Where a task says "append to" an existing module, its code block repeats the imports that block needs.** Consolidate them into the module's single import section at the top rather than leaving mid-file `import` statements — `services_catalog/models.py`, `serializers.py`, `views.py`, `urls.py` and `services.py` each grow across four or five tasks.
- **Every settings and urls edit in this plan is additive.** `backend/config/settings/base.py` and `backend/config/urls.py` already carry merged entries from Phases 0/1, 2, 3, 4 and 8. Read the real file, add to it, never paste over it.

---

## Scope rulings

This phase sits between three unbuilt neighbours and one unwritable migration. Each boundary is ruled explicitly here so no task has to guess.

**Note (ruling): `ServiceCategory` and `ProfessionalService` live in a new `services_catalog` app, not in `professionals`.**
Spec §3's suggested app list names `professionals` and `services_catalog` as two separate apps, and spec §11.2 groups **both** models under one heading, "Service catalog" — so the spec's own decomposition puts the catalog beside, not inside, the profile app. Three further reasons make this the right call here:
1. **Different owners, different lifecycles.** `professionals` (Phase 3) owns *who* a provider is: identity, ownership, account status. The catalog owns *what services exist* and *which provider offers which* — a staff-curated taxonomy with its own audited CRUD, SEO flags and translations. Those change for unrelated reasons and by different actors.
2. **One-directional dependency, no cycle.** `services_catalog` imports `professionals` (FK to `ProfessionalProfile`, and `validate_service_area`); `professionals` imports nothing from `services_catalog`. Putting `ProfessionalService` in `professionals` instead would reverse one of those arrows and give `professionals` a dependency on the catalog, for no gain.
3. **Phase 3's plan is final but unmerged.** Adding models and migrations to `professionals` from this phase would collide with an in-flight Phase 3 branch and mutate an app whose plan is already signed off. This plan therefore touches `backend/professionals/` **zero** times — it only imports from it.
`ProfessionalService` is the join between the two and could defensibly sit on either side; it goes in `services_catalog` because spec §11.2 puts it there and because the directory queries that read it (Tasks 7 and 8) live there too — files that change together live together.

**Note (ruling): the §14.3 legacy migration is a mechanism, not a run.**
Spec §14.3 prescribes a six-step migration from "old service/provider records." **There are no such records.** Per `ACTIVITY.md`'s `## Architecture Decisions` section and its `### Design reference summary` subsection, the prior artefact is a Google Stitch export of 51 **static HTML/Tailwind mockups** — "no backend, no shared components", "throwaway static mockups (inline Tailwind config per file, no component reuse, no real data)". There is no legacy database, no legacy service or provider table, no legacy slug that ever resolved for a real user. Tasks 9 and 10 therefore build the *mechanism* the spec mandates — the mapping table, the dedup rules, the slug/redirect preservation, the reconciliation report — and run it against **zero** input rows. This is recorded as a Known Limitation, not hidden: the mechanism becomes load-bearing only if real legacy data ever materialises, which for a project this new it will not. It is built anyway because spec §14.3 and §32.1 step 7 mandate that it exist, and because `/professionals/profile/?id=<legacy>` (spec §4.3) needs a real resolver behind it either way. What this explicitly does **not** mean: inventing sample legacy rows, seeding demo mappings, or importing "prototype sample numbers as real analytics" (spec §32 definition of done).

**Note (ruling): the contact panel is a seam, not a deliverable.**
Spec §14.2 lists a "Blurred contact panel governed by `ContactAccessService`" among the professional detail sections. `ContactAccessService` is **Phase 7** ("Contact privacy and reveal access", spec §7/§16) and does not exist. This plan does not build it, does not fake it, and does not ship a CSS-blurred panel over real contact data — spec §39 explicitly forbids "hide prohibited fields only with CSS", and spec §1 requires that reveal "never makes contact data public." Consequently **`public_email`, `public_phone` and `website_url` are excluded from every public API payload in this phase** (Tasks 7 and 8), so locked contact data is never in the JSON, never in the SSR HTML and never in the DOM. The detail page carries a single commented insertion point naming the component Phase 7 will mount there. `website_url` is excluded alongside phone and email deliberately: a provider's own site is a contact channel, and deciding whether it is gated belongs to the phase that owns the gate.

**Note (ruling): the shared inquiry form is a seam, not a deliverable.**
Spec §14.2 also lists "Shared inquiry form." That is **Phase 6** (spec §15): one `InquiryForm` component and one backend `InquiryService`, explicitly forbidden from being copied per context ("do not create broker-, professional- and listing-specific copies", spec §15.1; "Do not … Add a separate inquiry form for a new context", spec §39). Building any professional-specific form here would violate that rule the moment Phase 6 lands. The detail page therefore renders no inquiry form and no non-functional stand-in, and carries a commented insertion point naming the Phase 6 component.

**Note (ruling): the six SEO service pages are built here, because the combined page must link to them.**
Spec §14.1 item 5 requires "SEO links to the six individual service pages" on the combined directory, and spec §32.2 requires they be "preserved" and linked. No phase in the spec builds them, because spec §11.2 says they are not pages to build — they are `ServiceCategory` rows with `has_seo_page=true` rendered by one shared template. Linking to six 404s would break spec §2.1 and Phase 3's rule 11 ("only add a nav link in the same commit that creates the page it points at"). Task 16 therefore adds **one** dynamic route, `/services/<category-slug>/`, that renders any `has_seo_page` category and 404s otherwise, and Task 4 seeds the six rows with factual category names in EN/IT/ES and **empty** descriptions/SEO text for staff to fill in — no invented marketing copy.

**Note (ruling): the advertisement interstitial is out of scope.**
Spec §14.1 item 4 permits an "Optional approved advertisement interstitial only in its established public placement." No advertisement model, table or placement exists anywhere in this codebase, and the item is optional. Rendering a placeholder ad slot would be exactly the invented UI spec §2.1 forbids. Not built; recorded in Known Limitations for the advertising phase.

**Note (ruling): portfolio/gallery is out of scope.**
Spec §14.2 permits a portfolio/gallery "only when real backend records exist." `ProfessionalProfile` (Phase 3 Task 6) has no media field and the media pipeline is Phase 15 (spec §24). The section is omitted entirely rather than stubbed. The identity header's "logo/photo" slot renders a deterministic initials monogram derived from `display_name` — a CSS-drawn element computed from a real field, not a fabricated asset.

**Note (ruling): two legacy redirects in spec §4.3 belong to other phases.**
`/brokers/profile/?id=<legacy>` needs the broker directory (not this phase's subject) and `/dashboard/broker/services/` → `/dashboard/broker/messages/` needs the broker messages page, which **Phase 19** creates (spec §28). Redirecting to a page that does not exist yet would replace one broken URL with another. Both are recorded in Known Limitations and assigned to those phases. This phase implements exactly the three §4.3 rows that concern the services/professionals directory.

**Note (ruling): navigation already points here.**
Phase 3's `PrimaryNav` already ships `{ href: "/services/professionals/", label: "Services / Professionals" }`. This phase does not add a nav entry — it makes the existing one resolve. No `PrimaryNav` edit appears in any task below.

---

## File Structure

```
nautelo/
├── ACTIVITY.md                                             (modify: Task 17)
├── docs/superpowers/plans/2026-09-18-phase-5-directory-consolidation.md   (this file)
├── backend/
│   ├── config/
│   │   ├── settings/base.py                                (modify: Task 1 — INSTALLED_APPS, throttle rate)
│   │   └── urls.py                                         (modify: Task 6 — include services_catalog.urls)
│   ├── common/
│   │   ├── text.py                                         (new: Task 10 — normalize_comparison_text)
│   │   └── tests/test_text.py                              (new: Task 10)
│   └── services_catalog/
│       ├── __init__.py, apps.py                            (Task 1)
│       ├── models.py                                       (Task 2; modified Tasks 5, 9)
│       ├── services.py                                     (Task 2; modified Tasks 3, 10)
│       ├── admin.py                                        (Task 3; modified Tasks 5, 9)
│       ├── permissions.py                                  (Task 6)
│       ├── pagination.py                                   (Task 7)
│       ├── serializers.py                                  (Task 6; modified Tasks 7, 8)
│       ├── views.py                                        (Task 6; modified Tasks 7, 8, 9)
│       ├── urls.py                                         (Task 6; modified Tasks 7, 8, 9)
│       ├── management/commands/import_legacy_directory.py  (Task 10)
│       ├── migrations/
│       │   ├── 0001_initial.py                             (generated: Task 2 — ServiceCategory)
│       │   ├── 0002_seed_seo_service_categories.py         (hand-written data: Task 4)
│       │   ├── 0003_professionalservice.py                 (generated: Task 5)
│       │   ├── 0004_seed_combined_directory_flag.py        (hand-written data: Task 6)
│       │   └── 0005_legacydirectorymapping.py              (generated: Task 9)
│       └── tests/
│           ├── __init__.py, factories.py                   (Task 2; factories extended Tasks 5, 9)
│           ├── conftest.py                                 (new: Task 6 — autouse cache isolation)
│           ├── test_service_category_model.py              (Task 2)
│           ├── test_service_category_audit.py              (Task 3)
│           ├── test_seed_seo_categories.py                 (Task 4)
│           ├── test_professional_service_model.py          (Task 5)
│           ├── test_service_category_api.py                (Task 6)
│           ├── test_professional_directory_api.py          (Task 7)
│           ├── test_professional_detail_api.py             (Task 8)
│           ├── test_legacy_redirect_api.py                 (Task 9)
│           └── test_import_legacy_directory.py             (Task 10)
└── frontend/
    ├── next.config.ts                                      (modify: Task 11)
    ├── next.config.test.ts                                 (new: Task 11)
    ├── vitest.config.ts                                     (modify: Task 11 — include glob)
    ├── .env.local.example                                  (modify: Task 16 — NEXT_PUBLIC_BASE_URL)
    └── src/
        ├── lib/api/directory.ts                            (new: Task 12; extended Task 16 — page_size)
        ├── lib/i18n/directory.ts                           (new: Task 13)
        ├── lib/i18n/directory.test.ts                      (new: Task 13)
        ├── app/professionals/profile/route.ts              (new: Task 12)
        ├── app/professionals/profile/route.test.ts         (new: Task 12)
        ├── app/services/professionals/page.tsx             (new: Task 14)
        ├── app/services/professionals/[slug]/page.tsx      (new: Task 15)
        ├── app/services/[categorySlug]/page.tsx            (new: Task 16)
        ├── app/sitemap.ts                                  (new: Task 16)
        └── components/directory/
            ├── DirectorySearchForm.tsx                     (Task 14)
            ├── DirectorySearchForm.test.tsx                (Task 14)
            ├── CategoryGrid.tsx                            (Task 14)
            ├── CategoryGrid.test.tsx                       (Task 14)
            ├── ProfessionalCard.tsx                        (Task 14)
            ├── ProfessionalCard.test.tsx                   (Task 14)
            ├── ProfileMonogram.tsx                         (Task 15)
            └── ProfileMonogram.test.tsx                    (Task 15)
```

Migration filenames are Django's default auto-numbering for a fresh app; the actual generated names are whatever `makemigrations` produces for the auto-generated ones (each task says to run it and commit the result). The two data migrations are hand-written and their filenames are exact.

---

### Task 1: Scaffold the `services_catalog` app

**Files:**
- Create: `backend/services_catalog/__init__.py`, `backend/services_catalog/apps.py`, `backend/services_catalog/migrations/__init__.py`, `backend/services_catalog/tests/__init__.py`
- Modify: `backend/config/settings/base.py`
- Delete: `backend/services_catalog/tests.py`, `backend/services_catalog/views.py`, `backend/services_catalog/admin.py`, `backend/services_catalog/models.py` (Django `startapp` boilerplate — see the note below)

**Interfaces:**
- Consumes: nothing.
- Produces: `services_catalog` registered in `INSTALLED_APPS`; `REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["services_directory"] = "60/min"` available for Tasks 6–9's views to opt into via `throttle_scope`.

**Note:** Phase 0/1's retrospective in `ACTIVITY.md` records a real bug from `django-admin startapp` — it generates a flat `tests.py` that silently shadows a `tests/` package if both exist. This task deletes it immediately, before the `tests/` package is created. The placeholder `models.py`/`admin.py`/`views.py` are deleted too and recreated with real content by the tasks that need them (Task 2, Task 3, Task 6), rather than committing empty files now. This mirrors Phase 4's Task 1 exactly.

- [ ] **Step 1: Generate the app skeleton and remove the placeholder files**

```bash
cd backend
uv run python manage.py startapp services_catalog
rm services_catalog/tests.py services_catalog/views.py services_catalog/admin.py services_catalog/models.py
mkdir services_catalog/tests
touch services_catalog/tests/__init__.py
```

- [ ] **Step 2: Register the app**

In `backend/config/settings/base.py`, add `"services_catalog",` to the existing `INSTALLED_APPS` list, immediately after `"professionals",` (which Phase 3's Task 6 added). **Read the real file and append to it** — by the time this runs, the list also contains `accounts`, `brokers`, `token_blacklist` and the Phase 2/4/8 apps:

```python
    "professionals",
    "services_catalog",
```

- [ ] **Step 3: Add the throttle scope**

In the same file, add one key to the existing `REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]` dict, leaving every other key untouched:

```python
    "DEFAULT_THROTTLE_RATES": {
        "taxonomy_search": "60/min",
        "auth": "10/min",
        "auth-refresh": "30/min",
        "services_directory": "60/min",
    },
```

**Note:** do **not** add or change `DEFAULT_THROTTLE_CLASSES`. Phase 3's Task 3 already set it to `common.throttling.HashedIPScopedRateThrottle`, which HMAC-hashes the client IP before building the cache key (spec §30.4 forbids storing raw IPs). Every view in this plan inherits that default by declaring only `throttle_scope`. If the merged `DEFAULT_THROTTLE_RATES` dict does not contain the `auth`/`auth-refresh` keys shown above, that is fine — only the `services_directory` line is this task's change; keep whatever is actually there.

- [ ] **Step 4: Verify the app loads**

```bash
uv run python manage.py check
```

Expected: `System check identified no issues (0 silenced).` — `services_catalog` has no models yet, so this only proves the app is registered and importable.

- [ ] **Step 5: Commit**

```bash
git add backend/services_catalog backend/config/settings/base.py
git commit -m "chore(backend): scaffold services_catalog app and its directory throttle scope"
```

---

### Task 2: `ServiceCategory` model, locale resolution and the reserved-slug guard

**Files:**
- Create: `backend/services_catalog/models.py`, `backend/services_catalog/services.py`
- Create (generated): `backend/services_catalog/migrations/0001_initial.py`
- Test: `backend/services_catalog/tests/factories.py`, `backend/services_catalog/tests/test_service_category_model.py`

**Interfaces:**
- Consumes: `common.models.UUIDTimeStampedModel` (Phase 2).
- Produces:
  - `services_catalog.services.SUPPORTED_LOCALES` — `("en", "it", "es")`; `DEFAULT_LOCALE` — `"en"`; `RESERVED_CATEGORY_SLUGS` — `("professionals",)`.
  - `services_catalog.services.resolve_locale(raw: str | None) -> str` — normalises any input to one of `SUPPORTED_LOCALES`, defaulting to `"en"`.
  - `services_catalog.services.localized(instance, field_base: str, locale: str) -> str` — returns `<field_base>_<locale>` or falls back to `<field_base>_en` when blank.
  - `services_catalog.services.validate_category_slug(value: str) -> None` — raises `ValidationError` for a reserved slug.
  - `services_catalog.models.ServiceCategory` with the full spec §11.2 field set plus `has_seo_page`, `Meta.ordering = ("display_order", "name_en")`, a `service_category_slug_not_reserved` check constraint and `get_absolute_url() -> "/services/<slug>/"`.
  - `services_catalog.tests.factories.make_service_category(**kwargs) -> ServiceCategory`.

**Note (ruling — why `professionals` is a reserved category slug):** the six SEO service pages live at `/services/<category-slug>/` while the combined directory lives at `/services/professionals/`. In the Next.js App Router a static segment wins over a sibling dynamic segment, so a category slugged `professionals` would simply never render — a silent, staff-creatable trap. It is forbidden at three layers: a field validator (so Django admin shows a clean error), a database `CheckConstraint` (so no code path can bypass it), and the frontend route precedence itself. The constraint is serialized into the migration with the tuple's literal value at `makemigrations` time — extending `RESERVED_CATEGORY_SLUGS` later therefore requires a new migration, not just an edit.

**Note (ruling — flat localized fields rather than a translations table):** spec §11.2 spells the columns out as `name_en, name_it, name_es` / `description_en, description_it, description_es` / `seo_title_*` / `seo_description_*`, and spec §0 fixes the language set at exactly three, permanently. Three fixed columns are the spec's own model; a generic translations relation would be a larger schema serving a variability the spec explicitly rules out. `name_en` is the only required name — `_it`/`_es` are blank-allowed and fall back to English at read time, so a staff member can create a category before its translations are ready without it vanishing from two of the three locales.

**Note (`CheckConstraint` API):** Django 5.1 renamed `CheckConstraint(check=…)` to `CheckConstraint(condition=…)` and deprecated the old kwarg. This project is on Django 5.2 — use `condition=`.

- [ ] **Step 1: Write the failing tests**

`backend/services_catalog/tests/factories.py`:

```python
from services_catalog.models import ServiceCategory


def make_service_category(
    *,
    slug="legal",
    name_en="Legal",
    display_order=0,
    is_active=True,
    has_seo_page=False,
    **extra,
):
    return ServiceCategory.objects.create(
        slug=slug,
        name_en=name_en,
        display_order=display_order,
        is_active=is_active,
        has_seo_page=has_seo_page,
        **extra,
    )
```

`backend/services_catalog/tests/test_service_category_model.py`:

```python
import uuid

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction

from services_catalog.models import ServiceCategory
from services_catalog.services import DEFAULT_LOCALE, localized, resolve_locale
from services_catalog.tests.factories import make_service_category


@pytest.mark.django_db
def test_category_has_a_uuid_pk_and_sane_defaults():
    category = make_service_category()

    assert isinstance(category.pk, uuid.UUID)
    assert category.is_active is True
    assert category.has_seo_page is False
    assert category.display_order == 0
    assert category.name_it == ""
    assert category.description_en == ""


@pytest.mark.django_db
def test_slug_is_unique():
    make_service_category(slug="legal")

    with pytest.raises(IntegrityError), transaction.atomic():
        make_service_category(slug="legal", name_en="Legal again")


@pytest.mark.django_db
def test_reserved_slug_is_rejected_by_validation():
    category = ServiceCategory(slug="professionals", name_en="Professionals")

    with pytest.raises(ValidationError):
        category.full_clean()


@pytest.mark.django_db
def test_reserved_slug_is_rejected_by_the_database_even_without_full_clean():
    with pytest.raises(IntegrityError), transaction.atomic():
        ServiceCategory.objects.create(slug="professionals", name_en="Professionals")


@pytest.mark.django_db
def test_default_ordering_is_display_order_then_english_name():
    make_service_category(slug="zeta", name_en="Zeta", display_order=1)
    make_service_category(slug="beta", name_en="Beta", display_order=2)
    make_service_category(slug="alpha", name_en="Alpha", display_order=1)

    assert [c.slug for c in ServiceCategory.objects.all()] == ["alpha", "zeta", "beta"]


@pytest.mark.django_db
def test_absolute_url_is_the_seo_service_route():
    assert make_service_category(slug="insurance").get_absolute_url() == "/services/insurance/"


@pytest.mark.django_db
def test_localized_returns_the_requested_language():
    category = make_service_category(name_en="Legal", name_it="Legale", name_es="Legal ES")

    assert localized(category, "name", "it") == "Legale"
    assert localized(category, "name", "es") == "Legal ES"


@pytest.mark.django_db
def test_localized_falls_back_to_english_when_the_translation_is_blank():
    category = make_service_category(name_en="Legal", name_it="")

    assert localized(category, "name", "it") == "Legal"


@pytest.mark.parametrize(
    "raw,expected",
    [("en", "en"), ("IT", "it"), ("es", "es"), ("ES", "es"), ("de", "en"), ("", "en"), (None, "en")],
)
def test_resolve_locale_normalizes_and_defaults_to_english(raw, expected):
    assert resolve_locale(raw) == expected
    assert DEFAULT_LOCALE == "en"
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd backend
uv run pytest services_catalog -v
```

Expected: `ModuleNotFoundError: No module named 'services_catalog.models'`.

- [ ] **Step 3: Write the locale helpers and the slug validator**

`backend/services_catalog/services.py`:

```python
from django.core.exceptions import ValidationError

# Spec §0: supported interface languages are exactly English, Italian and Spanish.
SUPPORTED_LOCALES = ("en", "it", "es")
DEFAULT_LOCALE = "en"

# A category slugged "professionals" would be permanently shadowed by the static
# /services/professionals/ directory route in the Next.js App Router.
RESERVED_CATEGORY_SLUGS = ("professionals",)


def resolve_locale(raw):
    """Normalize a client-supplied locale to one of SUPPORTED_LOCALES."""
    if not raw:
        return DEFAULT_LOCALE
    candidate = str(raw).strip().lower()
    return candidate if candidate in SUPPORTED_LOCALES else DEFAULT_LOCALE


def localized(instance, field_base, locale):
    """Read `<field_base>_<locale>`, falling back to English when it is blank."""
    value = getattr(instance, f"{field_base}_{resolve_locale(locale)}", "") or ""
    if value.strip():
        return value
    return getattr(instance, f"{field_base}_{DEFAULT_LOCALE}", "") or ""


def validate_category_slug(value):
    """Reject slugs that would collide with a reserved public route."""
    if value in RESERVED_CATEGORY_SLUGS:
        raise ValidationError(
            "This slug is reserved by the combined directory route.",
            code="service_category_slug_reserved",
        )
```

- [ ] **Step 4: Write the model**

`backend/services_catalog/models.py`:

```python
from django.db import models
from django.db.models import Q

from common.models import UUIDTimeStampedModel
from services_catalog.services import RESERVED_CATEGORY_SLUGS, validate_category_slug


class ServiceCategory(UUIDTimeStampedModel):
    """A nautical service category (spec §11.2).

    The six approved SEO service pages are ordinary rows of this table flagged
    has_seo_page=True — spec §11.2: "they are not separate hard-coded templates
    with divergent data models".
    """

    name_en = models.CharField(max_length=120)
    name_it = models.CharField(max_length=120, blank=True)
    name_es = models.CharField(max_length=120, blank=True)
    slug = models.SlugField(max_length=140, unique=True, validators=[validate_category_slug])
    description_en = models.TextField(blank=True)
    description_it = models.TextField(blank=True)
    description_es = models.TextField(blank=True)
    icon_key = models.CharField(max_length=64, blank=True)
    display_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    has_seo_page = models.BooleanField(default=False)
    seo_title_en = models.CharField(max_length=180, blank=True)
    seo_title_it = models.CharField(max_length=180, blank=True)
    seo_title_es = models.CharField(max_length=180, blank=True)
    seo_description_en = models.CharField(max_length=320, blank=True)
    seo_description_it = models.CharField(max_length=320, blank=True)
    seo_description_es = models.CharField(max_length=320, blank=True)

    class Meta:
        ordering = ("display_order", "name_en")
        verbose_name = "service category"
        verbose_name_plural = "service categories"
        constraints = [
            models.CheckConstraint(
                condition=~Q(slug__in=RESERVED_CATEGORY_SLUGS),
                name="service_category_slug_not_reserved",
            )
        ]
        indexes = [models.Index(fields=["is_active", "display_order"])]

    def __str__(self):
        return self.name_en

    def get_absolute_url(self) -> str:
        return f"/services/{self.slug}/"
```

- [ ] **Step 5: Generate the migration and run the tests**

```bash
uv run python manage.py makemigrations services_catalog
uv run python manage.py migrate
uv run pytest services_catalog -v
```

Expected: `services_catalog/migrations/0001_initial.py` created and applied; all 9 model tests plus the 7-case `resolve_locale` parametrize `PASS`.

- [ ] **Step 6: Commit**

```bash
git add backend/services_catalog
git commit -m "feat(services_catalog): add ServiceCategory model with locale fallback and reserved-slug guard"
```

---

### Task 3: Audited staff CRUD for `ServiceCategory` in Django admin

**Files:**
- Modify: `backend/services_catalog/services.py`
- Create: `backend/services_catalog/admin.py`
- Test: `backend/services_catalog/tests/test_service_category_audit.py`

**Interfaces:**
- Consumes: `services_catalog.models.ServiceCategory` (Task 2); `audit.services.record_audit_event`, `audit.models.AuditEvent` (Phase 2).
- Produces:
  - `services_catalog.services.CATEGORY_AUDIT_FIELDS` — the tuple of audited column names.
  - `services_catalog.services.category_audit_snapshot(category) -> dict`.
  - `services_catalog.services.save_service_category(*, category, actor, actor_type=AuditEvent.ActorType.USER, source=AuditEvent.Source.ADMIN, request_id=None) -> ServiceCategory` — the only sanctioned write path.
  - `services_catalog.services.delete_service_category(*, category, actor, actor_type=AuditEvent.ActorType.USER, source=AuditEvent.Source.ADMIN, request_id=None) -> None`.
  - `services_catalog.admin.ServiceCategoryAdmin`.
  - Audit actions: `service_category.created`, `service_category.updated`, `service_category.deleted`; `target_type="services_catalog.ServiceCategory"`.

**Note (why the service, not the admin, owns the audit):** spec §2.4 requires staff catalog CRUD to produce an immutable audit event with actor, action, target, before/after summary, timestamp, request ID and source. Putting that in `ServiceCategoryAdmin.save_model` alone would leave any future `/api/v1/staff/service-categories/` endpoint free to write unaudited rows. `platform_settings` already solved this exact problem the same way (`update_setting` / `set_feature_flag` called *from* the admin), so this follows the established project shape: the admin is a thin caller.

**Note (`record_audit_event` signature — use the real one):** it is keyword-only and takes `actor_user`, `actor_type`, `action`, `target_type`, `target_id`, `source`, and optionally `before`, `after`, `request_id`, `metadata`, `ip_hash`. It stringifies `target_id` itself and generates a `request_id` when none is given. It must be called inside the same `transaction.atomic()` block as the change it describes, so a rolled-back mutation never leaves an orphaned audit row. `audit.models.AuditEvent` supplies both enums: `ActorType` is `USER`/`SYSTEM`/`STRIPE` and `Source` is `WEB`/`API`/`ADMIN`/`TASK`/`WEBHOOK`.

**Note (why `actor_type` and `source` are parameters, not constants):** Django admin is not the only sanctioned caller. Task 10's `import_legacy_directory` management command also writes `ServiceCategory` rows, and it has no logged-in user — it passes `actor=None`, `actor_type=AuditEvent.ActorType.SYSTEM`, `source=AuditEvent.Source.TASK`, which are exactly the members `audit.models` already defines for a non-interactive actor. Keeping both as defaulted keyword arguments is what lets rule 5 of the Contract summary stay absolute: **every** write to `ServiceCategory` in this codebase, from any entry point, goes through these two functions and is audited. `actor_user` is `null=True` on `AuditEvent`, so a system actor records a real row with no user attached.

**Note (detecting create without importing the model):** `save_service_category` decides create-vs-update from `category._state.adding`, captured **before** `save()` flips it. `audit.models.AuditEvent.save()` already uses `self._state.adding` for the same reason (a `UUIDModel` instance has a non-`None` pk before it is ever written, so `pk is None` is the wrong check). Reading the previous row via `type(category).objects.get(...)` avoids importing `ServiceCategory` into `services.py`, which would create a cycle with `models.py`'s import of `validate_category_slug`.

- [ ] **Step 1: Write the failing tests**

`backend/services_catalog/tests/test_service_category_audit.py`:

```python
import pytest
from django.contrib.admin.sites import AdminSite
from django.test import RequestFactory

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from audit.models import AuditEvent
from services_catalog.admin import ServiceCategoryAdmin
from services_catalog.models import ServiceCategory
from services_catalog.services import (
    category_audit_snapshot,
    delete_service_category,
    save_service_category,
)
from services_catalog.tests.factories import make_service_category


@pytest.fixture
def staff_user(db):
    return make_user("catalog-admin@example.com", role=UserRole.STAFF, is_staff=True)


@pytest.mark.django_db
def test_saving_a_new_category_records_a_created_event(staff_user):
    category = ServiceCategory(slug="insurance", name_en="Insurance")

    save_service_category(category=category, actor=staff_user)

    event = AuditEvent.objects.get(action="service_category.created")
    assert event.target_type == "services_catalog.ServiceCategory"
    assert event.target_id == str(category.pk)
    assert event.actor_user == staff_user
    assert event.source == AuditEvent.Source.ADMIN
    assert event.before is None
    assert event.after["slug"] == "insurance"


@pytest.mark.django_db
def test_updating_a_category_records_before_and_after(staff_user):
    category = make_service_category(slug="legal", name_en="Legal")
    category.name_en = "Legal services"
    category.is_active = False

    save_service_category(category=category, actor=staff_user)

    event = AuditEvent.objects.get(action="service_category.updated")
    assert event.before["name_en"] == "Legal"
    assert event.before["is_active"] is True
    assert event.after["name_en"] == "Legal services"
    assert event.after["is_active"] is False


@pytest.mark.django_db
def test_deleting_a_category_records_a_deleted_event(staff_user):
    category = make_service_category(slug="transport-delivery", name_en="Transport")
    pk = str(category.pk)

    delete_service_category(category=category, actor=staff_user)

    event = AuditEvent.objects.get(action="service_category.deleted")
    assert event.target_id == pk
    assert event.before["slug"] == "transport-delivery"
    assert event.after is None
    assert not ServiceCategory.objects.filter(pk=pk).exists()


@pytest.mark.django_db
def test_an_invalid_category_is_rejected_before_anything_is_written(staff_user):
    category = ServiceCategory(slug="professionals", name_en="Professionals")

    with pytest.raises(Exception):
        save_service_category(category=category, actor=staff_user)

    assert not ServiceCategory.objects.filter(slug="professionals").exists()
    assert not AuditEvent.objects.filter(action="service_category.created").exists()


@pytest.mark.django_db
def test_admin_save_model_delegates_to_the_audited_service(staff_user):
    admin = ServiceCategoryAdmin(ServiceCategory, AdminSite())
    request = RequestFactory().post("/admin/services_catalog/servicecategory/add/")
    request.user = staff_user
    category = ServiceCategory(slug="nautical-marketing", name_en="Nautical marketing")

    admin.save_model(request, category, form=None, change=False)

    assert ServiceCategory.objects.filter(slug="nautical-marketing").exists()
    assert AuditEvent.objects.filter(action="service_category.created").count() == 1


@pytest.mark.django_db
def test_admin_delete_model_delegates_to_the_audited_service(staff_user):
    admin = ServiceCategoryAdmin(ServiceCategory, AdminSite())
    request = RequestFactory().post("/admin/services_catalog/servicecategory/1/delete/")
    request.user = staff_user
    category = make_service_category(slug="engines-maintenance", name_en="Engines")

    admin.delete_model(request, category)

    assert not ServiceCategory.objects.filter(slug="engines-maintenance").exists()
    assert AuditEvent.objects.filter(action="service_category.deleted").count() == 1


@pytest.mark.django_db
def test_audit_snapshot_covers_every_staff_editable_column():
    snapshot = category_audit_snapshot(make_service_category())

    for field in (
        "name_en", "name_it", "name_es", "slug",
        "description_en", "description_it", "description_es",
        "icon_key", "display_order", "is_active", "has_seo_page",
        "seo_title_en", "seo_title_it", "seo_title_es",
        "seo_description_en", "seo_description_it", "seo_description_es",
    ):
        assert field in snapshot
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
uv run pytest services_catalog/tests/test_service_category_audit.py -v
```

Expected: `ImportError: cannot import name 'save_service_category' from 'services_catalog.services'`.

- [ ] **Step 3: Append the audited write path to `services.py`**

Add these imports to the existing import block at the top of `backend/services_catalog/services.py`:

```python
from django.db import transaction

from audit.models import AuditEvent
from audit.services import record_audit_event
```

Then append:

```python
CATEGORY_AUDIT_FIELDS = (
    "name_en",
    "name_it",
    "name_es",
    "slug",
    "description_en",
    "description_it",
    "description_es",
    "icon_key",
    "display_order",
    "is_active",
    "has_seo_page",
    "seo_title_en",
    "seo_title_it",
    "seo_title_es",
    "seo_description_en",
    "seo_description_it",
    "seo_description_es",
)


def category_audit_snapshot(category) -> dict:
    """Before/after summary of a ServiceCategory for the audit trail (spec §2.4)."""
    return {field: getattr(category, field) for field in CATEGORY_AUDIT_FIELDS}


@transaction.atomic
def save_service_category(
    *,
    category,
    actor,
    actor_type: str = AuditEvent.ActorType.USER,
    source: str = AuditEvent.Source.ADMIN,
    request_id: str | None = None,
):
    """The only sanctioned way to create or change a ServiceCategory.

    Validates, persists and records one immutable audit event in a single
    transaction, so no entry point (admin today, the legacy-import management
    command in Task 10, a staff API later) can write an unaudited catalog
    change. A non-interactive caller passes actor=None with
    actor_type=AuditEvent.ActorType.SYSTEM and source=AuditEvent.Source.TASK.
    """
    # Capture before save() clears it: UUIDModel assigns a pk at instantiation,
    # so `pk is None` is not a usable "is this new?" test (same reasoning as
    # audit.models.AuditEvent.save).
    is_create = category._state.adding
    before = (
        None
        if is_create
        else category_audit_snapshot(type(category).objects.get(pk=category.pk))
    )

    category.full_clean()
    category.save()

    actor_user = actor if getattr(actor, "is_authenticated", False) else None
    record_audit_event(
        actor_user=actor_user,
        actor_type=actor_type,
        action="service_category.created" if is_create else "service_category.updated",
        target_type="services_catalog.ServiceCategory",
        target_id=str(category.pk),
        source=source,
        before=before,
        after=category_audit_snapshot(category),
        request_id=request_id,
    )
    return category


@transaction.atomic
def delete_service_category(
    *,
    category,
    actor,
    actor_type: str = AuditEvent.ActorType.USER,
    source: str = AuditEvent.Source.ADMIN,
    request_id: str | None = None,
) -> None:
    """Delete a ServiceCategory, recording what was removed.

    A category referenced by any ProfessionalService raises ProtectedError
    (Task 5 sets on_delete=PROTECT) — deactivate it instead, per the same
    "never delete a row referenced elsewhere; deactivate or merge it" rule
    the spec applies to taxonomy in §13.3.
    """
    before = category_audit_snapshot(category)
    target_id = str(category.pk)

    category.delete()

    actor_user = actor if getattr(actor, "is_authenticated", False) else None
    record_audit_event(
        actor_user=actor_user,
        actor_type=actor_type,
        action="service_category.deleted",
        target_type="services_catalog.ServiceCategory",
        target_id=target_id,
        source=source,
        before=before,
        after=None,
        request_id=request_id,
    )
```

- [ ] **Step 4: Write the admin**

`backend/services_catalog/admin.py`:

```python
from django.contrib import admin

from audit.models import AuditEvent

from .models import ServiceCategory
from .services import delete_service_category, save_service_category


@admin.register(ServiceCategory)
class ServiceCategoryAdmin(admin.ModelAdmin):
    list_display = ("name_en", "slug", "display_order", "is_active", "has_seo_page")
    list_filter = ("is_active", "has_seo_page")
    search_fields = ("name_en", "name_it", "name_es", "slug")
    prepopulated_fields = {"slug": ("name_en",)}
    ordering = ("display_order", "name_en")
    readonly_fields = ("id", "created_at", "updated_at")

    def save_model(self, request, obj, form, change):
        # Delegate entirely so validation and the audit trail are guaranteed
        # regardless of entry point (admin now, staff API later) — same shape
        # as PlatformSettingAdmin/FeatureFlagAdmin from Phase 2.
        save_service_category(
            category=obj, actor=request.user, source=AuditEvent.Source.ADMIN
        )

    def delete_model(self, request, obj):
        delete_service_category(
            category=obj, actor=request.user, source=AuditEvent.Source.ADMIN
        )

    def delete_queryset(self, request, queryset):
        # Django's default bulk delete issues one SQL DELETE and would skip
        # delete_model() entirely, losing the audit rows.
        for obj in queryset:
            delete_service_category(
                category=obj, actor=request.user, source=AuditEvent.Source.ADMIN
            )
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
uv run pytest services_catalog/tests/test_service_category_audit.py -v
```

Expected: all 7 tests `PASS`.

- [ ] **Step 6: Commit**

```bash
git add backend/services_catalog
git commit -m "feat(services_catalog): audit every staff ServiceCategory create, update and delete"
```

---

### Task 4: Seed the six approved SEO service categories

**Files:**
- Create: `backend/services_catalog/migrations/0002_seed_seo_service_categories.py`
- Test: `backend/services_catalog/tests/test_seed_seo_categories.py`

**Interfaces:**
- Consumes: `services_catalog.models.ServiceCategory` (Task 2).
- Produces: six `ServiceCategory` rows with `has_seo_page=True`, `is_active=True` and slugs `full-brokerage`, `legal`, `insurance`, `engines-maintenance`, `transport-delivery`, `nautical-marketing`, in `display_order` 10–60.

**Note (ruling — names are seeded, copy is not):** the six slugs are fixed by spec §4.1's route table and spec §1's "the six approved individual service pages remain indexable." Their *names* are factual category labels, so they are seeded in all three languages. Their `description_*`, `seo_title_*` and `seo_description_*` are seeded **empty** and left for staff to write in Django admin — inventing marketing copy for an approved public SEO page would be exactly the fabricated content spec §2.1 prohibits, and spec §38 forbids production setup from carrying decorative values. Every page and tile in Tasks 14 and 16 renders a description block only when it is non-empty, so an unwritten description is a missing paragraph, never a placeholder string.

**Note (`icon_key`):** the prototype uses Material Symbols (`ACTIVITY.md`, design reference). The seeded keys are Material Symbols names: `handshake`, `gavel`, `shield`, `build`, `local_shipping`, `campaign`. `icon_key` is a plain string the frontend maps to an icon; an unknown or blank key renders no icon rather than a broken one.

**Note (idempotency and reverse):** `get_or_create(slug=…)` makes the migration safe to re-run and satisfies spec §38's "Commands are idempotent." The reverse operation is `migrations.RunPython.noop`: these rows are staff-editable editorial content, and deleting them on a rollback would silently destroy staff work and cascade-protect against nothing. Spec §32.3 requires rollbacks to "keep additive schema/data intact."

- [ ] **Step 1: Write the failing test**

`backend/services_catalog/tests/test_seed_seo_categories.py`:

```python
import pytest

from services_catalog.models import ServiceCategory

EXPECTED_SLUGS = [
    "full-brokerage",
    "legal",
    "insurance",
    "engines-maintenance",
    "transport-delivery",
    "nautical-marketing",
]


@pytest.mark.django_db
def test_the_six_approved_seo_categories_are_seeded():
    seeded = ServiceCategory.objects.filter(has_seo_page=True).order_by("display_order")

    assert [c.slug for c in seeded] == EXPECTED_SLUGS


@pytest.mark.django_db
def test_seeded_categories_are_active_and_named_in_all_three_languages():
    for category in ServiceCategory.objects.filter(has_seo_page=True):
        assert category.is_active is True
        assert category.name_en.strip()
        assert category.name_it.strip()
        assert category.name_es.strip()


@pytest.mark.django_db
def test_seeded_categories_carry_no_invented_copy():
    for category in ServiceCategory.objects.filter(has_seo_page=True):
        assert category.description_en == ""
        assert category.description_it == ""
        assert category.description_es == ""
        assert category.seo_title_en == ""
        assert category.seo_description_en == ""


@pytest.mark.django_db
def test_every_seeded_slug_matches_a_spec_4_1_public_route():
    for slug in EXPECTED_SLUGS:
        category = ServiceCategory.objects.get(slug=slug)
        assert category.get_absolute_url() == f"/services/{slug}/"
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
uv run pytest services_catalog/tests/test_seed_seo_categories.py -v
```

Expected: `FAIL` — `assert [] == ['full-brokerage', …]`; nothing is seeded yet.

- [ ] **Step 3: Write the data migration**

`backend/services_catalog/migrations/0002_seed_seo_service_categories.py`:

```python
from django.db import migrations

# Spec §1: "The six approved individual service pages remain indexable and keep
# their own canonical URLs." Spec §4.1 fixes the six routes; spec §11.2 makes
# them ServiceCategory rows flagged has_seo_page, not bespoke templates.
SEO_CATEGORIES = [
    {
        "slug": "full-brokerage",
        "name_en": "Full brokerage",
        "name_it": "Intermediazione completa",
        "name_es": "Intermediación completa",
        "icon_key": "handshake",
        "display_order": 10,
    },
    {
        "slug": "legal",
        "name_en": "Legal",
        "name_it": "Legale",
        "name_es": "Legal",
        "icon_key": "gavel",
        "display_order": 20,
    },
    {
        "slug": "insurance",
        "name_en": "Insurance",
        "name_it": "Assicurazioni",
        "name_es": "Seguros",
        "icon_key": "shield",
        "display_order": 30,
    },
    {
        "slug": "engines-maintenance",
        "name_en": "Engines and maintenance",
        "name_it": "Motori e manutenzione",
        "name_es": "Motores y mantenimiento",
        "icon_key": "build",
        "display_order": 40,
    },
    {
        "slug": "transport-delivery",
        "name_en": "Transport and delivery",
        "name_it": "Trasporto e consegna",
        "name_es": "Transporte y entrega",
        "icon_key": "local_shipping",
        "display_order": 50,
    },
    {
        "slug": "nautical-marketing",
        "name_en": "Nautical marketing",
        "name_it": "Marketing nautico",
        "name_es": "Marketing náutico",
        "icon_key": "campaign",
        "display_order": 60,
    },
]


def seed_seo_categories(apps, schema_editor):
    ServiceCategory = apps.get_model("services_catalog", "ServiceCategory")
    for entry in SEO_CATEGORIES:
        ServiceCategory.objects.get_or_create(
            slug=entry["slug"],
            defaults={
                "name_en": entry["name_en"],
                "name_it": entry["name_it"],
                "name_es": entry["name_es"],
                "icon_key": entry["icon_key"],
                "display_order": entry["display_order"],
                "is_active": True,
                "has_seo_page": True,
            },
        )


class Migration(migrations.Migration):
    dependencies = [("services_catalog", "0001_initial")]

    operations = [
        # Reverse is a deliberate no-op: these rows are staff-editable editorial
        # content and spec §32.3 requires a rollback to keep additive data intact.
        migrations.RunPython(seed_seo_categories, migrations.RunPython.noop),
    ]
```

- [ ] **Step 4: Apply and run the tests**

```bash
uv run python manage.py migrate services_catalog
uv run pytest services_catalog/tests/test_seed_seo_categories.py -v
```

Expected: the migration applies; all 4 tests `PASS`.

- [ ] **Step 5: Commit**

```bash
git add backend/services_catalog
git commit -m "feat(services_catalog): seed the six approved SEO service categories"
```

---

### Task 5: `ProfessionalService` model and its admin

**Files:**
- Modify: `backend/services_catalog/models.py`, `backend/services_catalog/admin.py`, `backend/services_catalog/tests/factories.py`
- Create (generated): `backend/services_catalog/migrations/0003_professionalservice.py`
- Test: `backend/services_catalog/tests/test_professional_service_model.py`

**Interfaces:**
- Consumes: `services_catalog.models.ServiceCategory` (Task 2); `professionals.models.ProfessionalProfile` and `professionals.models.validate_service_area` (Phase 3 Task 6); `professionals.tests.factories.make_professional`, `accounts.tests.factories.make_user`, `accounts.enums.UserRole` (Phase 3).
- Produces:
  - `services_catalog.models.ProfessionalService` — `id`, `professional` (FK, `related_name="services"`, CASCADE), `category` (FK, `related_name="professional_services"`, PROTECT), `title_en`/`title_it`/`title_es`, `description_en`/`description_it`/`description_es`, `service_area` (JSON list), `is_active`, `created_at`, `updated_at`; unique constraint `(professional, category, title_en)`; ordering `("category__display_order", "title_en")`.
  - `services_catalog.admin.ProfessionalServiceAdmin`.
  - `services_catalog.tests.factories.make_professional_service(professional, category, **kwargs)`.

**Note (ruling — `on_delete` asymmetry):** `professional` cascades because a service offering has no meaning without the provider that offers it, and Phase 3 already cascades `ProfessionalProfile` from its owning user. `category` is `PROTECT` because a category in use is public IA that other rows and URLs depend on — the same rule spec §13.3 states for taxonomy ("Never delete a model referenced by listings; deactivate or merge it"). Staff deactivate a category (`is_active=False`, which hides it everywhere per spec §31) rather than deleting it; Task 3's `delete_service_category` surfaces the resulting `ProtectedError` in admin.

**Note (ruling — reusing Phase 3's `service_area` validator):** spec §11.2 gives `ProfessionalService` a `service_area` and spec §11.1 gives `ProfessionalProfile` one too. Phase 3's Task 6 already fixed the shape — a JSON list of non-empty region-identifier strings — and shipped `professionals.models.validate_service_area`. This model imports and reuses that exact validator rather than defining a second, drifting copy: a service-level area that validated differently from a profile-level area would be a silent data bug the first time the directory filtered across both.

**Heads-up (`validate_service_area` is present but unlisted in Phase 3's contract):** Phase 3's "Contract summary for later phases" export block names only `ProfessionalProfile` and `ProfessionalProfileStatus` from the `professionals` app. `validate_service_area` genuinely exists — it is a module-level function in Phase 3's `professionals/models.py` — but it was never added to that list of intentional exports, so nothing in Phase 3's own plan protects it from being renamed, made private or inlined by a later edit. This plan depends on it at import time in `services_catalog/models.py`. If Phase 3's plan is revised before it merges, add `validate_service_area` to its contract summary in the same edit; if the symbol has already moved by the time this task runs, **stop and reconcile the two plans** rather than quietly defining a local copy here, because two validators for one JSON shape is precisely the drift this ruling exists to prevent.

**Note (ruling — `title_en` in the unique constraint):** spec §11.2 says `unique(professional, category, title_en) or an equivalent normalized constraint`. This plan takes the spec's literal first option. A normalized variant would need a stored normalized column and a rule for what "same title" means across three languages — complexity with no requirement behind it yet (YAGNI). `title_en` is the only required title, so the constraint is always fully populated.

- [ ] **Step 1: Write the failing tests**

Append to `backend/services_catalog/tests/factories.py` (the `ServiceCategory` import already exists at the top; add the new one beside it):

```python
from services_catalog.models import ProfessionalService, ServiceCategory


def make_professional_service(
    professional,
    category,
    *,
    title_en="Vessel registration support",
    is_active=True,
    service_area=None,
    **extra,
):
    return ProfessionalService.objects.create(
        professional=professional,
        category=category,
        title_en=title_en,
        is_active=is_active,
        service_area=["IT-52"] if service_area is None else service_area,
        **extra,
    )
```

`backend/services_catalog/tests/test_professional_service_model.py`:

```python
import uuid

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import ProtectedError

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from professionals.tests.factories import make_professional
from services_catalog.models import ProfessionalService, ServiceCategory
from services_catalog.tests.factories import make_professional_service, make_service_category


@pytest.fixture
def professional(db):
    return make_professional(make_user("svc@example.com", role=UserRole.SERVICE_PROVIDER))


@pytest.fixture
def category(db):
    return make_service_category(slug="legal", name_en="Legal")


@pytest.mark.django_db
def test_service_has_a_uuid_pk_and_sane_defaults(professional, category):
    service = make_professional_service(professional, category)

    assert isinstance(service.pk, uuid.UUID)
    assert service.is_active is True
    assert service.title_it == ""
    assert service.description_en == ""
    assert service.created_at is not None


@pytest.mark.django_db
def test_services_are_reachable_from_the_professional(professional, category):
    service = make_professional_service(professional, category)

    assert list(professional.services.all()) == [service]


@pytest.mark.django_db
def test_the_same_title_cannot_repeat_in_the_same_category_for_one_professional(
    professional, category
):
    make_professional_service(professional, category, title_en="Flag registration")

    with pytest.raises(IntegrityError), transaction.atomic():
        make_professional_service(professional, category, title_en="Flag registration")


@pytest.mark.django_db
def test_the_same_title_is_allowed_in_a_different_category(professional, category):
    other = make_service_category(slug="insurance", name_en="Insurance")
    make_professional_service(professional, category, title_en="Flag registration")

    make_professional_service(professional, other, title_en="Flag registration")

    assert professional.services.count() == 2


@pytest.mark.django_db
def test_service_area_must_be_a_list_of_non_empty_strings(professional, category):
    service = ProfessionalService(
        professional=professional,
        category=category,
        title_en="Bad area",
        service_area="IT-52",
    )

    with pytest.raises(ValidationError):
        service.full_clean()


@pytest.mark.django_db
def test_deleting_the_professional_deletes_its_services(professional, category):
    make_professional_service(professional, category)

    professional.delete()

    assert ProfessionalService.objects.count() == 0


@pytest.mark.django_db
def test_a_category_in_use_cannot_be_deleted(professional, category):
    make_professional_service(professional, category)

    with pytest.raises(ProtectedError):
        category.delete()

    assert ServiceCategory.objects.filter(pk=category.pk).exists()


@pytest.mark.django_db
def test_default_ordering_follows_category_display_order_then_title(professional):
    second = make_service_category(slug="insurance", name_en="Insurance", display_order=2)
    first = make_service_category(slug="legal", name_en="Legal", display_order=1)
    make_professional_service(professional, second, title_en="Hull cover")
    make_professional_service(professional, first, title_en="Sale contracts")

    assert [s.title_en for s in ProfessionalService.objects.all()] == [
        "Sale contracts",
        "Hull cover",
    ]
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
uv run pytest services_catalog/tests/test_professional_service_model.py -v
```

Expected: `ImportError: cannot import name 'ProfessionalService' from 'services_catalog.models'`.

- [ ] **Step 3: Append the model**

Add these imports to the top of `backend/services_catalog/models.py`, beside the existing ones:

```python
from django.conf import settings  # noqa: F401  (documents the AUTH_USER_MODEL rule; not used directly here)
from professionals.models import validate_service_area
```

Then append:

```python
class ProfessionalService(UUIDTimeStampedModel):
    """One service a professional offers inside one category (spec §11.2)."""

    professional = models.ForeignKey(
        "professionals.ProfessionalProfile",
        related_name="services",
        on_delete=models.CASCADE,
    )
    category = models.ForeignKey(
        ServiceCategory,
        related_name="professional_services",
        on_delete=models.PROTECT,
    )
    title_en = models.CharField(max_length=160)
    title_it = models.CharField(max_length=160, blank=True)
    title_es = models.CharField(max_length=160, blank=True)
    description_en = models.TextField(blank=True)
    description_it = models.TextField(blank=True)
    description_es = models.TextField(blank=True)
    service_area = models.JSONField(
        default=list, blank=True, validators=[validate_service_area]
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("category__display_order", "title_en")
        constraints = [
            models.UniqueConstraint(
                fields=["professional", "category", "title_en"],
                name="unique_professional_category_title",
            )
        ]
        indexes = [models.Index(fields=["is_active"])]

    def __str__(self):
        return f"{self.professional.display_name} — {self.title_en}"
```

Delete the `from django.conf import settings` line if your linter objects — it documents Phase 3 contract rule 1 but this model holds no user FK. (The `professional` FK is declared as the string `"professionals.ProfessionalProfile"` rather than the imported class so the app-registry resolution order never matters; `validate_service_area` is a plain function and is imported directly.)

- [ ] **Step 4: Append the admin**

Add to `backend/services_catalog/admin.py` (extend the existing `from .models import …` line):

```python
from .models import ProfessionalService, ServiceCategory


@admin.register(ProfessionalService)
class ProfessionalServiceAdmin(admin.ModelAdmin):
    list_display = ("title_en", "professional", "category", "is_active")
    list_filter = ("is_active", "category")
    search_fields = ("title_en", "title_it", "title_es", "professional__display_name")
    autocomplete_fields = ("professional", "category")
    readonly_fields = ("id", "created_at", "updated_at")
```

**Note:** `autocomplete_fields` requires the referenced admins to define `search_fields`. `ProfessionalProfileAdmin` (Phase 3 Task 6) declares them, and `ServiceCategoryAdmin` (Task 3) declares them. No audit hook is added here: spec §2.4 requires audit for *staff* catalog CRUD and permission-sensitive transitions, and spec §31 lists the provider's own services under "provider/staff profile workflow", not the audited staff catalog. The audited surface in this phase is `ServiceCategory` (Task 3). When Phase 17 builds the provider-facing service editor, it owns whatever audit that workflow needs.

- [ ] **Step 5: Generate the migration and run the tests**

```bash
uv run python manage.py makemigrations services_catalog
uv run python manage.py migrate
uv run pytest services_catalog -v
```

Expected: `0003_professionalservice.py` created and applied; all 8 new tests plus every earlier `services_catalog` test `PASS`.

- [ ] **Step 6: Commit**

```bash
git add backend/services_catalog
git commit -m "feat(services_catalog): add ProfessionalService model linking providers to categories"
```

---

### Task 6: `GET /api/v1/service-categories/` (list + detail) behind the rollout flag

**Files:**
- Create: `backend/services_catalog/permissions.py`, `backend/services_catalog/serializers.py`, `backend/services_catalog/views.py`, `backend/services_catalog/urls.py`
- Create: `backend/services_catalog/migrations/0004_seed_combined_directory_flag.py`
- Modify: `backend/config/urls.py`
- Test: `backend/services_catalog/tests/conftest.py`, `backend/services_catalog/tests/test_service_category_api.py`

**Interfaces:**
- Consumes: `services_catalog.models.ServiceCategory` (Task 2); `services_catalog.services.localized`, `resolve_locale` (Task 2); `platform_settings.services.is_feature_enabled`, `feature_flag_cache_key` (Phase 2).
- Produces:
  - `services_catalog.permissions.COMBINED_DIRECTORY_FLAG` — `"combined_services_professionals"`.
  - `services_catalog.permissions.CombinedDirectoryEnabled` — DRF permission raising `NotFound` when the flag is off; reused by Tasks 7, 8, 9.
  - `services_catalog.serializers.ServiceCategorySerializer` — fields `id`, `slug`, `name`, `description`, `icon_key`, `display_order`, `has_seo_page`, `url`; requires `context["locale"]`.
  - `services_catalog.serializers.ServiceCategoryDetailSerializer` — the same plus `seo_title`, `seo_description`.
  - `services_catalog.views.LocalizedContextMixin` — supplies `context["locale"]` from `?locale=`; reused by Tasks 7, 8.
  - `GET /api/v1/service-categories/?locale=<en|it|es>` → HTTP 200, **unpaginated JSON array** of active categories in `(display_order, name_en)` order.
  - `GET /api/v1/service-categories/<slug>/?locale=<en|it|es>` → HTTP 200; HTTP 404 for an unknown or inactive slug.
  - `services_catalog.urls` included at `api/v1/`.

**Note (ruling — this endpoint is deliberately unpaginated):** spec §30.2 requires that *paginated* results use one consistent shape; it does not require every collection to paginate. The category grid (spec §14.1 item 2) is one bounded, staff-curated set — six seeded rows plus whatever staff add — rendered as a single grid. Paginating it would force the directory page to walk pages to draw one component, for no benefit. This endpoint therefore declares `pagination_class = None` and returns a plain array. Task 7's professional search, which *is* unbounded, uses the standard paginated envelope.

**Note (ruling — an explicit `?locale=` parameter, not `Accept-Language`):** the three name/description columns have to collapse to one value per response, and the frontend already knows which locale it is rendering. An explicit query parameter keeps the choice visible in logs and cache keys and makes a shareable URL reproduce the same page — spec §29.4 requires filter URL state to be shareable and back-button safe, and the locale is part of that state. Unknown or missing values fall back to `en` (spec §0 fixes the language set at exactly three). Spec §37's rule that backend responses must not hard-code English concerns UI strings, which this endpoint never emits — every string it returns is staff-authored database content.

**Note (ruling — the feature flag is enforced as 404, not 403):** spec §35.1 names `combined_services_professionals` and requires flags to "gate both frontend exposure and backend mutation … Do not leave an enabled API behind a disabled UI unintentionally." This phase exposes only public reads, so the gate goes on the read surface: with the flag off, all four directory endpoints behave exactly as if the feature did not exist (404), which is what spec §35.3's "if combined directory must be temporarily disabled" scenario needs and what the Next.js pages already handle, since they must `notFound()` on an unknown slug regardless. `is_feature_enabled` is called with `default=False` so a missing flag row fails closed; migration `0004` seeds the row enabled.

**Note (flag caching in tests):** `is_feature_enabled` caches a persisted value in Redis indefinitely, and `set_feature_flag` busts that cache from `transaction.on_commit()` — which does **not** run inside pytest-django's per-test transaction. Any test that toggles the flag **mid-test** must delete the cache key itself with `cache.delete(feature_flag_cache_key(COMBINED_DIRECTORY_FLAG))` right after changing it. Getting each test *started* from a clean cache is the package-wide conftest's job (Step 1 below), not each file's.

**Note (ruling — one autouse `cache.clear()` for the whole `services_catalog/tests/` package):** Redis is real in this project's test settings and is never swapped for `LocMemCache` (see Global Constraints), so cache state survives between tests and between runs. Two things leak. The first is the flag value above. The second is the DRF throttle counter: **every** endpoint in Tasks 6–9 shares one `services_directory` bucket rated `60/min`, keyed on one HMAC-hashed client IP, and the four API test files in this package together issue well over 60 requests. Clearing only inside the one dedicated rate-limit test — the shape the first draft of this plan had — leaves the suite order-dependent: each file passes alone, and an unrelated test 429s once the whole run shares the bucket. There is **no** `backend/conftest.py` in this repo to inherit from; `backend/platform_settings/tests/conftest.py` solves exactly this problem with its own package-local autouse fixture, so this app mirrors that established shape rather than adding a root conftest that would change every other app's test isolation.

- [ ] **Step 1: Add the package-wide cache-isolation fixture**

`backend/services_catalog/tests/conftest.py`:

```python
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
```

- [ ] **Step 2: Write the failing tests**

`backend/services_catalog/tests/test_service_category_api.py`:

```python
import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from common.throttling import HashedIPScopedRateThrottle
from platform_settings.models import FeatureFlag
from platform_settings.services import feature_flag_cache_key
from services_catalog.permissions import COMBINED_DIRECTORY_FLAG
from services_catalog.tests.factories import make_service_category

# No autouse cache fixture here: tests/conftest.py clears the cache around
# every test in this package (flag values and throttle counters alike).


@pytest.mark.django_db
def test_the_rollout_flag_is_seeded_enabled():
    assert FeatureFlag.objects.get(key=COMBINED_DIRECTORY_FLAG).is_enabled is True


@pytest.mark.django_db
def test_category_list_returns_only_active_categories_in_display_order():
    make_service_category(slug="zeta", name_en="Zeta", display_order=900)
    make_service_category(slug="hidden", name_en="Hidden", display_order=1, is_active=False)

    response = APIClient().get("/api/v1/service-categories/")

    assert response.status_code == 200
    slugs = [item["slug"] for item in response.data]
    assert "hidden" not in slugs
    assert slugs[0] == "full-brokerage"   # seeded, display_order 10
    assert slugs[-1] == "zeta"


@pytest.mark.django_db
def test_category_list_is_unpaginated_and_publicly_accessible():
    response = APIClient().get("/api/v1/service-categories/")

    assert response.status_code == 200
    assert isinstance(response.data, list)


@pytest.mark.django_db
def test_category_list_returns_the_requested_locale():
    response = APIClient().get("/api/v1/service-categories/", {"locale": "it"})

    legal = next(item for item in response.data if item["slug"] == "legal")
    assert legal["name"] == "Legale"


@pytest.mark.django_db
def test_category_list_falls_back_to_english_for_a_blank_translation():
    make_service_category(slug="surveying", name_en="Surveying", name_it="")

    response = APIClient().get("/api/v1/service-categories/", {"locale": "it"})

    surveying = next(item for item in response.data if item["slug"] == "surveying")
    assert surveying["name"] == "Surveying"


@pytest.mark.django_db
def test_category_list_exposes_the_seo_page_url_only_for_seo_categories():
    make_service_category(slug="surveying", name_en="Surveying")

    response = APIClient().get("/api/v1/service-categories/")
    by_slug = {item["slug"]: item for item in response.data}

    assert by_slug["legal"]["has_seo_page"] is True
    assert by_slug["legal"]["url"] == "/services/legal/"
    assert by_slug["surveying"]["has_seo_page"] is False
    assert by_slug["surveying"]["url"] is None


@pytest.mark.django_db
def test_category_detail_returns_seo_metadata():
    response = APIClient().get("/api/v1/service-categories/insurance/")

    assert response.status_code == 200
    assert response.data["slug"] == "insurance"
    assert response.data["name"] == "Insurance"
    assert response.data["seo_title"] == ""
    assert response.data["seo_description"] == ""


@pytest.mark.django_db
def test_category_detail_404s_for_unknown_and_inactive_slugs():
    make_service_category(slug="retired", name_en="Retired", is_active=False)
    client = APIClient()

    assert client.get("/api/v1/service-categories/retired/").status_code == 404
    assert client.get("/api/v1/service-categories/nope/").status_code == 404


@pytest.mark.django_db
def test_both_category_endpoints_404_when_the_rollout_flag_is_off():
    FeatureFlag.objects.filter(key=COMBINED_DIRECTORY_FLAG).update(is_enabled=False)
    cache.delete(feature_flag_cache_key(COMBINED_DIRECTORY_FLAG))
    client = APIClient()

    assert client.get("/api/v1/service-categories/").status_code == 404
    assert client.get("/api/v1/service-categories/legal/").status_code == 404


@pytest.mark.django_db
def test_category_list_is_rate_limited(monkeypatch):
    # Overriding settings.REST_FRAMEWORK would NOT work: DRF binds
    # SimpleRateThrottle.THROTTLE_RATES once from api_settings at import time,
    # and Django's setting_changed signal does not retroactively update that
    # already-bound dict. Monkeypatching the scope entry is the reliable way,
    # and is the pattern taxonomy/tests/test_boat_brand_search_api.py already
    # established in this repo. conftest.py has already emptied the bucket.
    monkeypatch.setitem(
        HashedIPScopedRateThrottle.THROTTLE_RATES, "services_directory", "2/min"
    )
    client = APIClient()
    client.get("/api/v1/service-categories/")
    client.get("/api/v1/service-categories/")

    assert client.get("/api/v1/service-categories/").status_code == 429
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
uv run pytest services_catalog/tests/test_service_category_api.py -v
```

Expected: `ModuleNotFoundError: No module named 'services_catalog.permissions'`.

- [ ] **Step 4: Seed the rollout feature flag**

`backend/services_catalog/migrations/0004_seed_combined_directory_flag.py`:

```python
from django.db import migrations

FLAG_KEY = "combined_services_professionals"
FLAG_DESCRIPTION = (
    "Spec 35.1 rollout flag. When off, the combined Services / Professionals "
    "directory read endpoints return 404, and every public page built on them "
    "returns 404 too: /services/professionals/, the professional detail pages "
    "and the six /services/<slug>/ SEO pages. /sitemap.xml goes empty. The two "
    "301 redirects in next.config.ts are static and are NOT affected."
)


def seed_flag(apps, schema_editor):
    FeatureFlag = apps.get_model("platform_settings", "FeatureFlag")
    FeatureFlag.objects.get_or_create(
        key=FLAG_KEY,
        defaults={"is_enabled": True, "description": FLAG_DESCRIPTION},
    )


class Migration(migrations.Migration):
    dependencies = [
        ("services_catalog", "0003_professionalservice"),
        ("platform_settings", "0004_featureflag"),
    ]

    operations = [
        # Reverse is a no-op for the same reason as 0002: a rollback must not
        # delete an operator-toggleable row (spec 32.3).
        migrations.RunPython(seed_flag, migrations.RunPython.noop),
    ]
```

**Note:** confirm the real name of `platform_settings`' feature-flag migration before committing — `ACTIVITY.md` records it as `0004_featureflag.py`, but list `backend/platform_settings/migrations/` and depend on whatever is actually there. A wrong dependency name fails loudly at `migrate` time, so Step 6's run is the check.

- [ ] **Step 5: Write the permission gate**

`backend/services_catalog/permissions.py`:

```python
from rest_framework.exceptions import NotFound
from rest_framework.permissions import BasePermission

from platform_settings.services import is_feature_enabled

# Spec §35.1 rollout flag for this phase.
COMBINED_DIRECTORY_FLAG = "combined_services_professionals"


class CombinedDirectoryEnabled(BasePermission):
    """Make the whole combined-directory read surface vanish when the flag is off.

    404 rather than 403: with the feature disabled the resource genuinely does
    not exist publicly, and the Next.js pages already handle 404 (spec §35.3).
    default=False fails closed if the seeded flag row is ever removed.
    """

    def has_permission(self, request, view):
        if not is_feature_enabled(COMBINED_DIRECTORY_FLAG, default=False):
            raise NotFound()
        return True
```

- [ ] **Step 6: Write the serializer, view and routes**

`backend/services_catalog/serializers.py`:

```python
from rest_framework import serializers

from .models import ServiceCategory
from .services import localized


class ServiceCategorySerializer(serializers.ModelSerializer):
    """Collapses the three name/description columns to the requested locale.

    Requires context["locale"] — supplied by LocalizedContextMixin.
    """

    name = serializers.SerializerMethodField()
    description = serializers.SerializerMethodField()
    url = serializers.SerializerMethodField()

    class Meta:
        model = ServiceCategory
        fields = [
            "id",
            "slug",
            "name",
            "description",
            "icon_key",
            "display_order",
            "has_seo_page",
            "url",
        ]

    def get_name(self, obj) -> str:
        return localized(obj, "name", self.context["locale"])

    def get_description(self, obj) -> str:
        return localized(obj, "description", self.context["locale"])

    def get_url(self, obj):
        # Only the approved SEO categories have a public detail page.
        return obj.get_absolute_url() if obj.has_seo_page else None


class ServiceCategoryDetailSerializer(ServiceCategorySerializer):
    seo_title = serializers.SerializerMethodField()
    seo_description = serializers.SerializerMethodField()

    class Meta(ServiceCategorySerializer.Meta):
        fields = ServiceCategorySerializer.Meta.fields + ["seo_title", "seo_description"]

    def get_seo_title(self, obj) -> str:
        return localized(obj, "seo_title", self.context["locale"])

    def get_seo_description(self, obj) -> str:
        return localized(obj, "seo_description", self.context["locale"])
```

`backend/services_catalog/views.py`:

```python
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.permissions import AllowAny

from .models import ServiceCategory
from .permissions import CombinedDirectoryEnabled
from .serializers import ServiceCategoryDetailSerializer, ServiceCategorySerializer
from .services import resolve_locale


class LocalizedContextMixin:
    """Put the resolved ?locale= value in the serializer context."""

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["locale"] = resolve_locale(self.request.query_params.get("locale"))
        return context


class ServiceCategoryListView(LocalizedContextMixin, ListAPIView):
    serializer_class = ServiceCategorySerializer
    permission_classes = [AllowAny, CombinedDirectoryEnabled]
    pagination_class = None
    throttle_scope = "services_directory"

    def get_queryset(self):
        return ServiceCategory.objects.filter(is_active=True)


class ServiceCategoryDetailView(LocalizedContextMixin, RetrieveAPIView):
    serializer_class = ServiceCategoryDetailSerializer
    permission_classes = [AllowAny, CombinedDirectoryEnabled]
    lookup_field = "slug"
    throttle_scope = "services_directory"

    def get_queryset(self):
        return ServiceCategory.objects.filter(is_active=True)
```

`backend/services_catalog/urls.py`:

```python
from django.urls import path

from .views import ServiceCategoryDetailView, ServiceCategoryListView

urlpatterns = [
    path(
        "service-categories/",
        ServiceCategoryListView.as_view(),
        name="service-category-list",
    ),
    path(
        "service-categories/<slug:slug>/",
        ServiceCategoryDetailView.as_view(),
        name="service-category-detail",
    ),
]
```

Add one line to the existing `urlpatterns` in `backend/config/urls.py`, keeping every merged entry intact:

```python
    path("api/v1/", include("services_catalog.urls")),
```

**Note:** `permission_classes = [AllowAny, CombinedDirectoryEnabled]` is required because the project-wide DRF default is `IsAuthenticated`. The combined directory is public (spec §4.1; spec §5 grants guests "Browse public content"). `authentication_classes` is left at the project default so an authenticated request is still recognised — the endpoint just does not require one. DRF ANDs permission classes, so `AllowAny` short-circuits nothing: `CombinedDirectoryEnabled` still runs.

- [ ] **Step 7: Migrate and run the tests**

```bash
uv run python manage.py migrate
uv run pytest services_catalog/tests/test_service_category_api.py -v
```

Expected: all 10 tests `PASS`.

- [ ] **Step 8: Commit**

```bash
git add backend/services_catalog backend/config/urls.py
git commit -m "feat(services_catalog): add public service-category endpoints behind the rollout flag"
```

---

### Task 7: `GET /api/v1/professionals/` — the directory search endpoint

**Files:**
- Create: `backend/services_catalog/pagination.py`
- Modify: `backend/services_catalog/serializers.py`, `backend/services_catalog/views.py`, `backend/services_catalog/urls.py`
- Test: `backend/services_catalog/tests/test_professional_directory_api.py`

**Interfaces:**
- Consumes: `professionals.models.ProfessionalProfile`, `professionals.enums.ProfessionalProfileStatus` (Phase 3 Task 6); `services_catalog.models.ProfessionalService` (Task 5); `LocalizedContextMixin`, `CombinedDirectoryEnabled`, `localized` (Tasks 2, 6).
- Produces:
  - `services_catalog.pagination.ProfessionalDirectoryPagination` — `PageNumberPagination`, `page_size = 12`, `page_size_query_param = "page_size"`, `max_page_size = 48`.
  - `services_catalog.serializers.ProfessionalCardSerializer` — `id`, `slug`, `display_name`, `short_description`, `city`, `region`, `country_code`, `service_area`, `categories` (list of `{slug, name}`), `active_service_count`, `url`.
  - `GET /api/v1/professionals/?q=&category=&location=&sort=&locale=&page=&page_size=` → HTTP 200, `{"count", "next", "previous", "results": [...]}`; only `ProfessionalProfileStatus.ACTIVE` profiles; 404 when the rollout flag is off.

**Note (ruling — no contact data in this payload, ever):** `public_email`, `public_phone` and `website_url` exist on `ProfessionalProfile` but are **absent from the serializer's field list**, not merely hidden by the frontend. Spec §1 requires contact reveal to be "scoped to that user and entity" and to "never make contact data public"; spec §39 forbids hiding prohibited fields with CSS. Because the payload never contains them, they cannot leak through SSR HTML, the DOM, a cached CDN response or a curl against the API. Phase 7 serves them from its own `GET /api/v1/contacts/<target-type>/<id>/` (spec §30.1) once a grant exists. A test below asserts their absence so a future field addition fails loudly.

**Note (ruling — what `sort=recommended` means today):** spec §29.4 asks for "Sort (recommended/default, alphabetical where approved)". There is no ranking signal in this codebase — no reviews, no engagement, no paid placement — and spec §2.1 forbids inventing one. `recommended` is therefore defined as **active service count descending, then display name ascending**: a real, database-computed signal (how much of the catalog a provider actually covers) with a deterministic tiebreak, so pagination stays stable. `alphabetical` is display name ascending. When a genuine ranking signal arrives, only this ordering changes; the parameter contract does not.

**Note (ruling — what `location` matches):** one free-text `location` box has to satisfy spec §14.1's "category/location search" and spec §29.4's "Location/service area" filter against two differently shaped sources: the profile's own `city`/`region` free text and its `service_area` JSON list of region identifiers. It matches a case-insensitive substring of `city` or `region`, **or** an exact member of `service_area` (Postgres JSON containment). Exact for `service_area` because those entries are identifiers (`"IT-52"`), not prose.

**Note (`q` matching is case-insensitive but not accent-insensitive):** `icontains` against `display_name`, `short_description` and active service titles. Accent folding would need either a stored normalized column on `ProfessionalProfile` (Phase 3's model, which this phase does not modify) or the Postgres `unaccent` extension (an infrastructure change spec §33.3's performance phase owns). Recorded in Known Limitations.

**Note (the annotate/filter double-count trap):** in `Count("services", filter=Q(services__is_active=True), distinct=True)` both the `filter=` and `distinct=True` are load-bearing. Without `filter=` the count includes deactivated services; without `distinct=True` it multiplies as soon as the `category`/`q` filters add a second join to the same relation. The queryset also ends in `.distinct()`, because those filters can otherwise return a profile once per matching service row.

- [ ] **Step 1: Write the failing tests**

`backend/services_catalog/tests/test_professional_directory_api.py`:

```python
import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from platform_settings.models import FeatureFlag
from platform_settings.services import feature_flag_cache_key
from professionals.enums import ProfessionalProfileStatus
from professionals.tests.factories import make_professional
from services_catalog.permissions import COMBINED_DIRECTORY_FLAG
from services_catalog.tests.factories import make_professional_service, make_service_category

# tests/conftest.py (Task 6) clears the whole cache around every test in this
# package — both the feature-flag value and the shared `services_directory`
# throttle bucket, which these API files would otherwise exhaust between them.

def build_professional(
    email, *, slug, display_name, status=ProfessionalProfileStatus.ACTIVE, **extra
):
    return make_professional(
        make_user(email, role=UserRole.SERVICE_PROVIDER),
        slug=slug,
        display_name=display_name,
        status=status,
        **extra,
    )


@pytest.mark.django_db
def test_only_active_professionals_are_listed():
    # `active-pro` deliberately has NO ProfessionalService rows. Listing is
    # keyed on status == ACTIVE and nothing else, so a zero-service profile is
    # public with active_service_count: 0 and no categories. This is the tested
    # counterpart of the deferred publication gate (see Known Limitations):
    # Phase 17 may change the rule, but it must update this test in the same
    # commit rather than quietly filtering such profiles out of the queryset.
    build_professional("a@example.com", slug="active-pro", display_name="Active Pro")
    build_professional(
        "d@example.com",
        slug="draft-pro",
        display_name="Draft Pro",
        status=ProfessionalProfileStatus.DRAFT,
    )
    build_professional(
        "s@example.com",
        slug="susp-pro",
        display_name="Suspended Pro",
        status=ProfessionalProfileStatus.SUSPENDED,
    )

    response = APIClient().get("/api/v1/professionals/")

    assert response.status_code == 200
    assert [r["slug"] for r in response.data["results"]] == ["active-pro"]


@pytest.mark.django_db
def test_results_never_contain_contact_details():
    build_professional("c@example.com", slug="contact-pro", display_name="Contact Pro")

    result = APIClient().get("/api/v1/professionals/").data["results"][0]

    assert "public_email" not in result
    assert "public_phone" not in result
    assert "website_url" not in result


@pytest.mark.django_db
def test_category_filter_returns_only_providers_offering_that_category():
    legal = make_service_category(slug="legal", name_en="Legal")
    insurance = make_service_category(slug="insurance", name_en="Insurance")
    lawyer = build_professional("l@example.com", slug="lawyer", display_name="Lawyer")
    insurer = build_professional("i@example.com", slug="insurer", display_name="Insurer")
    make_professional_service(lawyer, legal, title_en="Sale contracts")
    make_professional_service(insurer, insurance, title_en="Hull cover")

    response = APIClient().get("/api/v1/professionals/", {"category": "legal"})

    assert [r["slug"] for r in response.data["results"]] == ["lawyer"]


@pytest.mark.django_db
def test_an_inactive_service_does_not_place_a_provider_in_a_category():
    legal = make_service_category(slug="legal", name_en="Legal")
    pro = build_professional("x@example.com", slug="retired-legal", display_name="Retired Legal")
    make_professional_service(pro, legal, title_en="Old service", is_active=False)

    response = APIClient().get("/api/v1/professionals/", {"category": "legal"})

    assert response.data["results"] == []


@pytest.mark.django_db
def test_text_search_matches_display_name_and_service_titles():
    legal = make_service_category(slug="legal", name_en="Legal")
    build_professional("n@example.com", slug="ocean-legal", display_name="Ocean Legal")
    other = build_professional("o@example.com", slug="port-agency", display_name="Port Agency")
    make_professional_service(other, legal, title_en="Ocean survey coordination")
    build_professional("z@example.com", slug="unrelated", display_name="Unrelated")

    slugs = {
        r["slug"]
        for r in APIClient().get("/api/v1/professionals/", {"q": "ocean"}).data["results"]
    }

    assert slugs == {"ocean-legal", "port-agency"}


@pytest.mark.django_db
def test_location_matches_city_region_or_an_exact_service_area_entry():
    # Phase 3's make_professional defaults service_area to ["IT-52"]. Three of
    # these four fixtures must therefore pass service_area=[] explicitly, or
    # every one of them matches slugs_for("IT-52") and the last assertion below
    # silently tests nothing.
    build_professional(
        "c1@example.com",
        slug="in-city",
        display_name="In City",
        city="Livorno",
        service_area=[],
    )
    build_professional(
        "r1@example.com",
        slug="in-region",
        display_name="In Region",
        region="Toscana",
        service_area=[],
    )
    build_professional(
        "a1@example.com", slug="in-area", display_name="In Area", service_area=["IT-52"]
    )
    build_professional(
        "n1@example.com",
        slug="elsewhere",
        display_name="Elsewhere",
        city="Palma",
        service_area=[],
    )
    client = APIClient()

    def slugs_for(location):
        return [
            r["slug"]
            for r in client.get("/api/v1/professionals/", {"location": location}).data["results"]
        ]

    assert slugs_for("livorno") == ["in-city"]
    assert slugs_for("Toscana") == ["in-region"]
    assert slugs_for("IT-52") == ["in-area"]


@pytest.mark.django_db
def test_recommended_sort_puts_broader_catalogues_first_then_alphabetical():
    legal = make_service_category(slug="legal", name_en="Legal")
    insurance = make_service_category(slug="insurance", name_en="Insurance")
    broad = build_professional("b@example.com", slug="zeta-broad", display_name="Zeta Broad")
    narrow = build_professional("s@example.com", slug="alpha-narrow", display_name="Alpha Narrow")
    make_professional_service(broad, legal, title_en="Contracts")
    make_professional_service(broad, insurance, title_en="Cover")
    make_professional_service(narrow, legal, title_en="Advice")
    client = APIClient()

    recommended = [r["slug"] for r in client.get("/api/v1/professionals/").data["results"]]
    alphabetical = [
        r["slug"]
        for r in client.get("/api/v1/professionals/", {"sort": "alphabetical"}).data["results"]
    ]

    assert recommended == ["zeta-broad", "alpha-narrow"]
    assert alphabetical == ["alpha-narrow", "zeta-broad"]


@pytest.mark.django_db
def test_a_card_reports_its_categories_in_the_requested_locale():
    legal = make_service_category(slug="legal", name_en="Legal", name_it="Legale")
    pro = build_professional("k@example.com", slug="cat-pro", display_name="Cat Pro")
    make_professional_service(pro, legal, title_en="Contracts")

    result = APIClient().get("/api/v1/professionals/", {"locale": "it"}).data["results"][0]

    assert result["categories"] == [{"slug": "legal", "name": "Legale"}]
    assert result["active_service_count"] == 1
    assert result["url"] == "/services/professionals/cat-pro/"


@pytest.mark.django_db
def test_results_are_paginated_with_the_standard_envelope():
    for index in range(14):
        build_professional(
            f"p{index}@example.com", slug=f"pro-{index:02d}", display_name=f"Pro {index:02d}"
        )

    response = APIClient().get("/api/v1/professionals/")

    assert response.data["count"] == 14
    assert len(response.data["results"]) == 12
    assert response.data["next"] is not None
    assert response.data["previous"] is None


@pytest.mark.django_db
def test_an_empty_directory_returns_an_empty_result_set_not_an_error():
    response = APIClient().get("/api/v1/professionals/")

    assert response.status_code == 200
    assert response.data["count"] == 0
    assert response.data["results"] == []


@pytest.mark.django_db
def test_the_directory_404s_when_the_rollout_flag_is_off():
    FeatureFlag.objects.filter(key=COMBINED_DIRECTORY_FLAG).update(is_enabled=False)
    cache.delete(feature_flag_cache_key(COMBINED_DIRECTORY_FLAG))

    assert APIClient().get("/api/v1/professionals/").status_code == 404
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
uv run pytest services_catalog/tests/test_professional_directory_api.py -v
```

Expected: `FAIL` — `/api/v1/professionals/` returns 404 (not routed yet).

- [ ] **Step 3: Write the pagination class**

`backend/services_catalog/pagination.py`:

```python
from rest_framework.pagination import PageNumberPagination


class ProfessionalDirectoryPagination(PageNumberPagination):
    """12 per page — three rows of a four-column card grid at desktop width."""

    page_size = 12
    page_size_query_param = "page_size"
    max_page_size = 48
```

- [ ] **Step 4: Append the card serializer**

Add to the import block at the top of `backend/services_catalog/serializers.py`:

```python
from professionals.models import ProfessionalProfile
```

Then append:

```python
class ProfessionalCardSerializer(serializers.ModelSerializer):
    """One result card in the combined directory (spec §31: "Professional
    result cards | ProfessionalProfile + ProfessionalService").

    Deliberately omits public_email, public_phone and website_url: contact
    data is never public (spec §1) and is served by Phase 7's
    ContactAccessService once a grant exists.
    """

    categories = serializers.SerializerMethodField()
    url = serializers.SerializerMethodField()
    active_service_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = ProfessionalProfile
        fields = [
            "id",
            "slug",
            "display_name",
            "short_description",
            "city",
            "region",
            "country_code",
            "service_area",
            "categories",
            "active_service_count",
            "url",
        ]

    def get_url(self, obj) -> str:
        return obj.get_absolute_url()

    def get_categories(self, obj):
        # Iterate the prefetched relation in Python (never re-filter with the
        # ORM here) so the view's prefetch_related actually saves the queries.
        locale = self.context["locale"]
        seen = set()
        categories = []
        for service in obj.services.all():
            category = service.category
            if not service.is_active or not category.is_active:
                continue
            if category.slug in seen:
                continue
            seen.add(category.slug)
            categories.append(
                {"slug": category.slug, "name": localized(category, "name", locale)}
            )
        return sorted(categories, key=lambda item: item["name"])
```

- [ ] **Step 5: Append the view and the route**

Add to the import block at the top of `backend/services_catalog/views.py`:

```python
from django.db.models import Count, Q

from professionals.enums import ProfessionalProfileStatus
from professionals.models import ProfessionalProfile

from .pagination import ProfessionalDirectoryPagination
from .serializers import ProfessionalCardSerializer
```

Then append:

```python
class ProfessionalDirectoryListView(LocalizedContextMixin, ListAPIView):
    """Combined-directory results (spec §14.1 item 3; spec §29.4 filters)."""

    serializer_class = ProfessionalCardSerializer
    permission_classes = [AllowAny, CombinedDirectoryEnabled]
    pagination_class = ProfessionalDirectoryPagination
    throttle_scope = "services_directory"

    def get_queryset(self):
        params = self.request.query_params
        queryset = (
            ProfessionalProfile.objects.filter(status=ProfessionalProfileStatus.ACTIVE)
            .prefetch_related("services__category")
            .annotate(
                active_service_count=Count(
                    "services", filter=Q(services__is_active=True), distinct=True
                )
            )
        )

        category = params.get("category", "").strip()
        if category:
            queryset = queryset.filter(
                services__is_active=True,
                services__category__slug=category,
                services__category__is_active=True,
            )

        query = params.get("q", "").strip()
        if query:
            queryset = queryset.filter(
                Q(display_name__icontains=query)
                | Q(short_description__icontains=query)
                | Q(services__title_en__icontains=query, services__is_active=True)
            )

        location = params.get("location", "").strip()
        if location:
            queryset = queryset.filter(
                Q(city__icontains=location)
                | Q(region__icontains=location)
                | Q(service_area__contains=[location])
            )

        if params.get("sort", "recommended").strip() == "alphabetical":
            ordering = ("display_name",)
        else:
            # "Recommended" = breadth of real catalogue coverage, with a
            # deterministic tiebreak so pagination stays stable. No invented
            # ranking signal (spec §2.1).
            ordering = ("-active_service_count", "display_name")

        return queryset.order_by(*ordering).distinct()
```

Add one entry to `backend/services_catalog/urls.py` (and extend its `from .views import …` line to include `ProfessionalDirectoryListView`):

```python
    path(
        "professionals/",
        ProfessionalDirectoryListView.as_view(),
        name="professional-directory",
    ),
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
uv run pytest services_catalog/tests/test_professional_directory_api.py -v
```

Expected: all 11 tests `PASS`.

- [ ] **Step 7: Commit**

```bash
git add backend/services_catalog
git commit -m "feat(services_catalog): add public professional directory search endpoint"
```

---

### Task 8: `GET /api/v1/professionals/<slug>/` — the professional detail endpoint

**Files:**
- Modify: `backend/services_catalog/serializers.py`, `backend/services_catalog/views.py`, `backend/services_catalog/urls.py`
- Test: `backend/services_catalog/tests/test_professional_detail_api.py`

**Interfaces:**
- Consumes: everything Task 7 consumes, plus `services_catalog.serializers.ProfessionalCardSerializer` (Task 7).
- Produces:
  - `services_catalog.serializers.RELATED_PROFESSIONAL_LIMIT` — `4`.
  - `services_catalog.serializers.ProfessionalServiceSerializer` — `id`, `title`, `description`, `service_area`, `category` (`{slug, name}`).
  - `services_catalog.serializers.ProfessionalDetailSerializer` — every `ProfessionalCardSerializer` field plus `description`, `services` (active only), `related` (list of `{slug, display_name, city, url}`).
  - `GET /api/v1/professionals/<slug>/?locale=` → HTTP 200 for an ACTIVE profile; HTTP 404 for unknown, DRAFT, PENDING or SUSPENDED; 404 when the rollout flag is off.

**Note (`RELATED_PROFESSIONAL_LIMIT = 4`):** spec §14.2 requires "Related professionals from the same category, excluding the current profile" without fixing a count. Four fills one card row at desktop width and two at tablet. Ordering is `display_name`, so the set is deterministic and the response is cacheable.

**Note (route ordering):** `professionals/<slug:slug>/` is registered **after** `professionals/` in `urls.py`. The two patterns cannot collide (one has an extra segment), but list-before-detail is the existing convention in `taxonomy/urls.py`.

- [ ] **Step 1: Write the failing tests**

`backend/services_catalog/tests/test_professional_detail_api.py`:

```python
import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from platform_settings.models import FeatureFlag
from platform_settings.services import feature_flag_cache_key
from professionals.enums import ProfessionalProfileStatus
from professionals.tests.factories import make_professional
from services_catalog.permissions import COMBINED_DIRECTORY_FLAG
from services_catalog.tests.factories import make_professional_service, make_service_category

# tests/conftest.py (Task 6) clears the whole cache around every test in this
# package — both the feature-flag value and the shared `services_directory`
# throttle bucket, which these API files would otherwise exhaust between them.

def build_professional(
    email, *, slug, display_name, status=ProfessionalProfileStatus.ACTIVE, **extra
):
    return make_professional(
        make_user(email, role=UserRole.SERVICE_PROVIDER),
        slug=slug,
        display_name=display_name,
        status=status,
        **extra,
    )


@pytest.mark.django_db
def test_detail_returns_the_profile_and_its_active_services():
    legal = make_service_category(slug="legal", name_en="Legal", name_it="Legale")
    pro = build_professional(
        "d@example.com",
        slug="ocean-legal",
        display_name="Ocean Legal",
        short_description="Maritime contracts",
        description="Twenty years of maritime contract work.",
    )
    make_professional_service(
        pro, legal, title_en="Sale contracts", title_it="Contratti di vendita"
    )
    make_professional_service(pro, legal, title_en="Retired service", is_active=False)

    response = APIClient().get("/api/v1/professionals/ocean-legal/", {"locale": "it"})

    assert response.status_code == 200
    assert response.data["slug"] == "ocean-legal"
    assert response.data["description"] == "Twenty years of maritime contract work."
    assert [s["title"] for s in response.data["services"]] == ["Contratti di vendita"]
    assert response.data["services"][0]["category"] == {"slug": "legal", "name": "Legale"}


@pytest.mark.django_db
def test_detail_never_contains_contact_details():
    build_professional("c@example.com", slug="contact-pro", display_name="Contact Pro")

    data = APIClient().get("/api/v1/professionals/contact-pro/").data

    assert "public_email" not in data
    assert "public_phone" not in data
    assert "website_url" not in data


@pytest.mark.django_db
@pytest.mark.parametrize(
    "status",
    [
        ProfessionalProfileStatus.DRAFT,
        ProfessionalProfileStatus.PENDING,
        ProfessionalProfileStatus.SUSPENDED,
    ],
)
def test_detail_404s_for_every_non_active_status(status):
    build_professional("h@example.com", slug="hidden-pro", display_name="Hidden Pro", status=status)

    assert APIClient().get("/api/v1/professionals/hidden-pro/").status_code == 404


@pytest.mark.django_db
def test_detail_404s_for_an_unknown_slug():
    assert APIClient().get("/api/v1/professionals/nobody/").status_code == 404


@pytest.mark.django_db
def test_related_professionals_share_a_category_and_exclude_the_current_profile():
    legal = make_service_category(slug="legal", name_en="Legal")
    insurance = make_service_category(slug="insurance", name_en="Insurance")
    subject = build_professional("s@example.com", slug="subject", display_name="Subject")
    peer = build_professional("p@example.com", slug="peer", display_name="Peer")
    stranger = build_professional("t@example.com", slug="stranger", display_name="Stranger")
    make_professional_service(subject, legal, title_en="A")
    make_professional_service(peer, legal, title_en="B")
    make_professional_service(stranger, insurance, title_en="C")

    related = APIClient().get("/api/v1/professionals/subject/").data["related"]

    assert [item["slug"] for item in related] == ["peer"]
    assert related[0]["url"] == "/services/professionals/peer/"


@pytest.mark.django_db
def test_related_professionals_are_capped_at_four():
    legal = make_service_category(slug="legal", name_en="Legal")
    subject = build_professional("s@example.com", slug="subject", display_name="Subject")
    make_professional_service(subject, legal, title_en="A")
    for index in range(6):
        peer = build_professional(
            f"r{index}@example.com", slug=f"peer-{index}", display_name=f"Peer {index}"
        )
        make_professional_service(peer, legal, title_en=f"Service {index}")

    related = APIClient().get("/api/v1/professionals/subject/").data["related"]

    assert len(related) == 4
    assert [item["slug"] for item in related] == ["peer-0", "peer-1", "peer-2", "peer-3"]


@pytest.mark.django_db
def test_a_professional_with_no_services_has_no_related_professionals():
    build_professional("l@example.com", slug="lonely", display_name="Lonely")

    assert APIClient().get("/api/v1/professionals/lonely/").data["related"] == []


@pytest.mark.django_db
def test_detail_404s_when_the_rollout_flag_is_off():
    build_professional("f@example.com", slug="flagged", display_name="Flagged")
    FeatureFlag.objects.filter(key=COMBINED_DIRECTORY_FLAG).update(is_enabled=False)
    cache.delete(feature_flag_cache_key(COMBINED_DIRECTORY_FLAG))

    assert APIClient().get("/api/v1/professionals/flagged/").status_code == 404
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
uv run pytest services_catalog/tests/test_professional_detail_api.py -v
```

Expected: `FAIL` — the detail route is not registered, so every request 404s, including the cases expecting 200.

- [ ] **Step 3: Append the detail serializers**

Extend the existing imports at the top of `backend/services_catalog/serializers.py` — add `ProfessionalService` to the `from .models import …` line and add:

```python
from professionals.enums import ProfessionalProfileStatus
```

Then append:

```python
RELATED_PROFESSIONAL_LIMIT = 4


class ProfessionalServiceSerializer(serializers.ModelSerializer):
    title = serializers.SerializerMethodField()
    description = serializers.SerializerMethodField()
    category = serializers.SerializerMethodField()

    class Meta:
        model = ProfessionalService
        fields = ["id", "title", "description", "service_area", "category"]

    def get_title(self, obj) -> str:
        return localized(obj, "title", self.context["locale"])

    def get_description(self, obj) -> str:
        return localized(obj, "description", self.context["locale"])

    def get_category(self, obj) -> dict:
        return {
            "slug": obj.category.slug,
            "name": localized(obj.category, "name", self.context["locale"]),
        }


class ProfessionalDetailSerializer(ProfessionalCardSerializer):
    """Spec §14.2's professional detail template, minus the two sections other
    phases own: the shared inquiry form (Phase 6) and the contact panel
    governed by ContactAccessService (Phase 7). Portfolio/gallery is absent
    because no media records exist — spec §14.2 permits it "only when real
    backend records exist".
    """

    services = serializers.SerializerMethodField()
    related = serializers.SerializerMethodField()

    class Meta(ProfessionalCardSerializer.Meta):
        fields = ProfessionalCardSerializer.Meta.fields + [
            "description",
            "services",
            "related",
        ]

    def get_services(self, obj):
        active = [
            service
            for service in obj.services.all()
            if service.is_active and service.category.is_active
        ]
        active.sort(key=lambda service: (service.category.display_order, service.title_en))
        return ProfessionalServiceSerializer(active, many=True, context=self.context).data

    def get_related(self, obj):
        category_ids = {
            service.category_id for service in obj.services.all() if service.is_active
        }
        if not category_ids:
            return []
        peers = (
            type(obj)
            .objects.filter(
                status=ProfessionalProfileStatus.ACTIVE,
                services__is_active=True,
                services__category_id__in=category_ids,
            )
            .exclude(pk=obj.pk)
            .order_by("display_name")
            .distinct()[:RELATED_PROFESSIONAL_LIMIT]
        )
        return [
            {
                "slug": peer.slug,
                "display_name": peer.display_name,
                "city": peer.city,
                "url": peer.get_absolute_url(),
            }
            for peer in peers
        ]
```

- [ ] **Step 4: Append the view and the route**

Add `ProfessionalDetailSerializer` to the existing `from .serializers import …` line in `backend/services_catalog/views.py`, then append:

```python
class ProfessionalDetailView(LocalizedContextMixin, RetrieveAPIView):
    serializer_class = ProfessionalDetailSerializer
    permission_classes = [AllowAny, CombinedDirectoryEnabled]
    lookup_field = "slug"
    throttle_scope = "services_directory"

    def get_queryset(self):
        # Only ACTIVE profiles are public: DRAFT/PENDING/SUSPENDED 404 rather
        # than 403, so a hidden profile's existence is never disclosed.
        return (
            ProfessionalProfile.objects.filter(status=ProfessionalProfileStatus.ACTIVE)
            .prefetch_related("services__category")
            .annotate(
                active_service_count=Count(
                    "services", filter=Q(services__is_active=True), distinct=True
                )
            )
        )
```

Add to `backend/services_catalog/urls.py`, after the directory route:

```python
    path(
        "professionals/<slug:slug>/",
        ProfessionalDetailView.as_view(),
        name="professional-detail",
    ),
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
uv run pytest services_catalog/tests/test_professional_detail_api.py -v
```

Expected: all 10 tests (7 plus the 3-case status parametrize) `PASS`.

- [ ] **Step 6: Commit**

```bash
git add backend/services_catalog
git commit -m "feat(services_catalog): add public professional detail endpoint with related providers"
```

---

### Task 9: `LegacyDirectoryMapping` and the legacy professional-id resolver

**Files:**
- Modify: `backend/services_catalog/models.py`, `backend/services_catalog/admin.py`, `backend/services_catalog/views.py`, `backend/services_catalog/urls.py`, `backend/services_catalog/tests/factories.py`
- Create (generated): `backend/services_catalog/migrations/0005_legacydirectorymapping.py`
- Test: `backend/services_catalog/tests/test_legacy_redirect_api.py`

**Interfaces:**
- Consumes: `common.models.UUIDTimeStampedModel`; `professionals.models.ProfessionalProfile`, `professionals.enums.ProfessionalProfileStatus`; `services_catalog.permissions.CombinedDirectoryEnabled` (Task 6).
- Produces:
  - `services_catalog.models.LegacyDirectoryMapping` with nested `TextChoices` `LegacyKind` (`SERVICE`, `PROVIDER`), `TargetType` (`SERVICE_CATEGORY`, `PROFESSIONAL_PROFILE`) and `Resolution` (`PENDING`, `MAPPED`, `DUPLICATE_REVIEW`, `UNRESOLVED`); fields `legacy_kind`, `legacy_identifier`, `legacy_slug`, `normalized_name`, `normalized_address`, `target_type`, `target_id`, `resolution`, `notes`; unique `(legacy_kind, legacy_identifier)`.
  - `services_catalog.views.LegacyProfessionalRedirectView`.
  - `GET /api/v1/legacy/professional-redirect/?id=<legacy>` → `200 {"url": "/services/professionals/<slug>/"}` when resolvable, `400` when `id` is missing/blank, `404` otherwise.
  - `services_catalog.tests.factories.make_legacy_mapping(**kwargs)`.

**Note (ruling — this is the §14.3 step-1 "mapping table", built now and empty):** spec §14.3 step 1 requires "a mapping table from old service/provider records to canonical professional/category records" and spec §32.1 step 7 repeats it as a migration-order item. The table exists as a real model so the mechanism is complete and testable; **it holds zero rows in every environment**, because the prior artefact was static HTML mockups with no database (see "Scope rulings"). Its second job is live from day one regardless: spec §4.3 requires `/professionals/profile/?id=<legacy>` to 301 "when resolvable, otherwise 404", and this table is what "resolvable" means.

**Note (ruling — the slug fallback):** the resolver first looks for a `MAPPED` row, then falls back to treating the supplied `id` as a current professional slug. That fallback implements spec §14.3 step 4's "Preserve professional slugs where unique" from the read side: when a legacy URL already carries a slug that survived the migration unchanged, no mapping row is needed for it to resolve, and the redirect still lands in one hop on the canonical URL. A suspended, draft or pending target resolves to nothing (404), matching Task 8's rule that non-ACTIVE profiles are not public.

**Note (ruling — 400 vs 404):** a missing or blank `id` is a malformed request (400, spec §30.2's error envelope); a well-formed `id` that resolves to nothing is 404, exactly as spec §4.3's table states. The distinction matters because the Next.js route handler in Task 12 maps anything that is not a 200 to a 404 page — the 400 exists for API clients and logs, not for the redirect flow.

- [ ] **Step 1: Write the failing tests**

Append to `backend/services_catalog/tests/factories.py` (extend the existing `from services_catalog.models import …` line with `LegacyDirectoryMapping`):

```python
def make_legacy_mapping(
    *,
    legacy_identifier,
    target,
    legacy_kind=None,
    legacy_slug="",
    resolution=None,
    **extra,
):
    return LegacyDirectoryMapping.objects.create(
        legacy_kind=legacy_kind or LegacyDirectoryMapping.LegacyKind.PROVIDER,
        legacy_identifier=legacy_identifier,
        legacy_slug=legacy_slug,
        target_type=LegacyDirectoryMapping.TargetType.PROFESSIONAL_PROFILE,
        target_id=target.pk,
        resolution=resolution or LegacyDirectoryMapping.Resolution.MAPPED,
        **extra,
    )
```

`backend/services_catalog/tests/test_legacy_redirect_api.py`:

```python
import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from platform_settings.models import FeatureFlag
from platform_settings.services import feature_flag_cache_key
from professionals.enums import ProfessionalProfileStatus
from professionals.tests.factories import make_professional
from services_catalog.models import LegacyDirectoryMapping
from services_catalog.permissions import COMBINED_DIRECTORY_FLAG
from services_catalog.tests.factories import make_legacy_mapping

ENDPOINT = "/api/v1/legacy/professional-redirect/"

# tests/conftest.py (Task 6) clears the whole cache around every test in this
# package — both the feature-flag value and the shared `services_directory`
# throttle bucket, which these API files would otherwise exhaust between them.

def build_professional(email, *, slug, status=ProfessionalProfileStatus.ACTIVE):
    return make_professional(
        make_user(email, role=UserRole.SERVICE_PROVIDER),
        slug=slug,
        display_name=slug.replace("-", " ").title(),
        status=status,
    )


@pytest.mark.django_db
def test_the_mapping_table_starts_empty():
    assert LegacyDirectoryMapping.objects.count() == 0


@pytest.mark.django_db
def test_a_mapped_legacy_id_resolves_to_the_canonical_url():
    pro = build_professional("m@example.com", slug="ocean-legal")
    make_legacy_mapping(legacy_identifier="4821", target=pro)

    response = APIClient().get(ENDPOINT, {"id": "4821"})

    assert response.status_code == 200
    assert response.data["url"] == "/services/professionals/ocean-legal/"


@pytest.mark.django_db
def test_an_unmapped_row_does_not_resolve():
    pro = build_professional("p@example.com", slug="pending-map")
    make_legacy_mapping(
        legacy_identifier="9001",
        target=pro,
        resolution=LegacyDirectoryMapping.Resolution.DUPLICATE_REVIEW,
    )

    assert APIClient().get(ENDPOINT, {"id": "9001"}).status_code == 404


@pytest.mark.django_db
def test_a_surviving_slug_resolves_without_a_mapping_row():
    build_professional("s@example.com", slug="port-agency")

    response = APIClient().get(ENDPOINT, {"id": "port-agency"})

    assert response.status_code == 200
    assert response.data["url"] == "/services/professionals/port-agency/"


@pytest.mark.django_db
def test_a_mapping_to_a_non_active_profile_does_not_resolve():
    pro = build_professional(
        "x@example.com", slug="suspended-pro", status=ProfessionalProfileStatus.SUSPENDED
    )
    make_legacy_mapping(legacy_identifier="7", target=pro)

    assert APIClient().get(ENDPOINT, {"id": "7"}).status_code == 404


@pytest.mark.django_db
def test_an_unknown_id_is_404():
    assert APIClient().get(ENDPOINT, {"id": "does-not-exist"}).status_code == 404


@pytest.mark.django_db
def test_a_missing_or_blank_id_is_400():
    client = APIClient()

    assert client.get(ENDPOINT).status_code == 400
    assert client.get(ENDPOINT, {"id": "   "}).status_code == 400


@pytest.mark.django_db
def test_a_legacy_identifier_is_unique_within_its_kind():
    from django.db import IntegrityError, transaction

    pro = build_professional("u@example.com", slug="unique-pro")
    make_legacy_mapping(legacy_identifier="55", target=pro)

    with pytest.raises(IntegrityError), transaction.atomic():
        make_legacy_mapping(legacy_identifier="55", target=pro)


@pytest.mark.django_db
def test_the_resolver_404s_when_the_rollout_flag_is_off():
    build_professional("f@example.com", slug="flagged-pro")
    FeatureFlag.objects.filter(key=COMBINED_DIRECTORY_FLAG).update(is_enabled=False)
    cache.delete(feature_flag_cache_key(COMBINED_DIRECTORY_FLAG))

    assert APIClient().get(ENDPOINT, {"id": "flagged-pro"}).status_code == 404
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
uv run pytest services_catalog/tests/test_legacy_redirect_api.py -v
```

Expected: `ImportError: cannot import name 'LegacyDirectoryMapping' from 'services_catalog.models'`.

- [ ] **Step 3: Append the model**

Append to `backend/services_catalog/models.py`:

```python
class LegacyDirectoryMapping(UUIDTimeStampedModel):
    """Spec §14.3 step 1: the mapping table from old service/provider records to
    canonical professional/category records.

    It is deliberately empty in every environment today — the prior NAUTA
    artefact was a set of static HTML mockups with no database, so there are no
    legacy records to map (see the plan's Scope rulings). The table exists
    because spec §14.3 and §32.1 step 7 require the mechanism, and because
    spec §4.3's /professionals/profile/?id=<legacy> redirect needs a place to
    look up what "resolvable" means.
    """

    class LegacyKind(models.TextChoices):
        SERVICE = "SERVICE", "Legacy service record"
        PROVIDER = "PROVIDER", "Legacy provider record"

    class TargetType(models.TextChoices):
        SERVICE_CATEGORY = "SERVICE_CATEGORY", "Service category"
        PROFESSIONAL_PROFILE = "PROFESSIONAL_PROFILE", "Professional profile"

    class Resolution(models.TextChoices):
        PENDING = "PENDING", "Pending"
        MAPPED = "MAPPED", "Mapped"
        DUPLICATE_REVIEW = "DUPLICATE_REVIEW", "Duplicate — needs human review"
        UNRESOLVED = "UNRESOLVED", "Unresolved"

    legacy_kind = models.CharField(max_length=16, choices=LegacyKind.choices)
    legacy_identifier = models.CharField(max_length=190)
    legacy_slug = models.CharField(max_length=190, blank=True)
    normalized_name = models.CharField(max_length=190, blank=True)
    normalized_address = models.CharField(max_length=255, blank=True)
    target_type = models.CharField(max_length=32, choices=TargetType.choices, blank=True)
    target_id = models.UUIDField(null=True, blank=True)
    resolution = models.CharField(
        max_length=20, choices=Resolution.choices, default=Resolution.PENDING
    )
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ("legacy_kind", "legacy_identifier")
        constraints = [
            models.UniqueConstraint(
                fields=["legacy_kind", "legacy_identifier"],
                name="unique_legacy_kind_identifier",
            )
        ]
        indexes = [
            models.Index(fields=["legacy_kind", "legacy_slug"]),
            models.Index(fields=["resolution"]),
        ]

    def __str__(self):
        return f"{self.legacy_kind}:{self.legacy_identifier} -> {self.resolution}"
```

- [ ] **Step 4: Append the admin registration**

Extend the `from .models import …` line in `backend/services_catalog/admin.py` with `LegacyDirectoryMapping` and append:

```python
@admin.register(LegacyDirectoryMapping)
class LegacyDirectoryMappingAdmin(admin.ModelAdmin):
    list_display = (
        "legacy_kind",
        "legacy_identifier",
        "legacy_slug",
        "resolution",
        "target_type",
        "target_id",
    )
    list_filter = ("legacy_kind", "resolution", "target_type")
    search_fields = ("legacy_identifier", "legacy_slug", "normalized_name")
    readonly_fields = ("id", "created_at", "updated_at")
```

**Note:** `resolution` and `notes` stay editable so a staff reviewer can resolve a `DUPLICATE_REVIEW` row by hand — spec §14.3 step 2 requires exactly that human step ("never merge solely on display name without review").

- [ ] **Step 5: Append the resolver view and route**

Add to the import block at the top of `backend/services_catalog/views.py`:

```python
from rest_framework.exceptions import NotFound
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import LegacyDirectoryMapping
```

Then append:

```python
class LegacyProfessionalRedirectView(APIView):
    """Resolve spec §4.3's /professionals/profile/?id=<legacy> to a canonical URL.

    200 with the destination when resolvable, 404 otherwise; the Next.js route
    handler turns a 200 into a single-hop 301 and anything else into a 404.
    """

    permission_classes = [AllowAny, CombinedDirectoryEnabled]
    throttle_scope = "services_directory"

    def get(self, request):
        legacy_id = request.query_params.get("id", "").strip()
        if not legacy_id:
            raise DRFValidationError({"id": "This query parameter is required."})

        mapping = (
            LegacyDirectoryMapping.objects.filter(
                legacy_kind=LegacyDirectoryMapping.LegacyKind.PROVIDER,
                legacy_identifier=legacy_id,
                resolution=LegacyDirectoryMapping.Resolution.MAPPED,
                target_type=LegacyDirectoryMapping.TargetType.PROFESSIONAL_PROFILE,
            )
            .exclude(target_id=None)
            .first()
        )

        active = ProfessionalProfile.objects.filter(status=ProfessionalProfileStatus.ACTIVE)
        profile = (
            active.filter(pk=mapping.target_id).first()
            if mapping
            # Spec §14.3 step 4: a slug that survived the migration unchanged
            # resolves without needing a mapping row.
            else active.filter(slug=legacy_id).first()
        )
        if profile is None:
            raise NotFound()

        return Response({"url": profile.get_absolute_url()})
```

Add to `backend/services_catalog/urls.py` (extend the `from .views import …` line):

```python
    path(
        "legacy/professional-redirect/",
        LegacyProfessionalRedirectView.as_view(),
        name="legacy-professional-redirect",
    ),
```

- [ ] **Step 6: Generate the migration and run the tests**

```bash
uv run python manage.py makemigrations services_catalog
uv run python manage.py migrate
uv run pytest services_catalog/tests/test_legacy_redirect_api.py -v
```

Expected: `0005_legacydirectorymapping.py` created and applied; all 9 tests `PASS`.

- [ ] **Step 7: Commit**

```bash
git add backend/services_catalog
git commit -m "feat(services_catalog): add legacy directory mapping table and professional-id resolver"
```

---

### Task 10: `import_legacy_directory` — the §14.3 six-step migration mechanism

**Files:**
- Create: `backend/common/text.py`, `backend/common/tests/test_text.py`
- Create: `backend/services_catalog/management/__init__.py`, `backend/services_catalog/management/commands/__init__.py`, `backend/services_catalog/management/commands/import_legacy_directory.py`
- Modify: `backend/services_catalog/services.py`
- Test: `backend/services_catalog/tests/test_import_legacy_directory.py`

**Interfaces:**
- Consumes: `services_catalog.models.LegacyDirectoryMapping`, `ServiceCategory`, `ProfessionalService` (Tasks 2, 5, 9); `services_catalog.services.save_service_category` (Task 3); `audit.models.AuditEvent` (Phase 2); `professionals.models.ProfessionalProfile`.
- Produces:
  - `common.text.normalize_comparison_text(value: str) -> str` — casefolded, accent-stripped, whitespace-collapsed comparison key.
  - `services_catalog.services.legacy_dedup_key(name: str, address: str) -> tuple[str, str]`.
  - Management command `import_legacy_directory --source <path.json> [--dry-run]`, printing a reconciliation report and exiting non-zero on a malformed source file.

**Note (ruling — the command exists, the data does not):** this is the mechanism half of the "Scope rulings" decision. Every step of spec §14.3 is implemented and tested against synthetic fixtures in `tmp_path`; **no legacy fixture is committed, no sample rows are seeded, and the command is never run in any environment.** Spec §32's definition of done — "Prototype sample numbers are not imported as real analytics" — is satisfied trivially, because nothing is imported. If real legacy data ever appears, this command is the sanctioned path for it and its reconciliation report is the evidence spec §32's "Migration reconciliation report matches record counts" asks for.

**Note (ruling — step 5 "generate canonical tags and update sitemap" is a structural no-op):** there is no static sitemap file to regenerate. Task 16 generates `/sitemap.xml` from the live database on every request via Next.js's `MetadataRoute.Sitemap`, and every page emits its own canonical tag from its own record. A mapping import therefore updates both the moment it commits, with no second step to run and nothing to forget. The command prints this as an explicit report line rather than silently skipping a numbered spec step.

**Note (ruling — dedup never merges on a display name alone):** spec §14.3 step 2 is emphatic: "Deduplicate by explicit IDs and normalized name/address; never merge solely on display name without review." The command therefore resolves in three tiers — exact `legacy_identifier` match; then normalized **name *and* address** match; then, when only the name matches, it writes `resolution=DUPLICATE_REVIEW` with a note naming the conflicting row and touches nothing. A human resolves those in Django admin (Task 9's admin keeps `resolution`/`notes` editable).

**Note (ruling — `common.text` rather than importing from `taxonomy`):** `taxonomy.services.normalize_taxonomy_name` already does exactly this casefold/accent-strip. Importing it here would give `services_catalog` a dependency on the boat-brand app for a pure string utility, which is the wrong shape. The function moves to `common.text.normalize_comparison_text`, which `services_catalog` uses. The already-merged `taxonomy` copy is deliberately left alone — this plan does not modify merged apps — and collapsing the duplicate belongs to the same cleanup pass Phase 3 already queued for `taxonomy`'s throttle classes. Recorded in Known Limitations.

**Note (ruling — the command's `ServiceCategory` write is audited like any other):** step 3 copies a legacy description onto a `ServiceCategory`, which is a catalog write, and Task 3 made `save_service_category` the **only** sanctioned write path for that model (Contract summary rule 5). A management command is not a carve-out from that rule: a plain `category.save(update_fields=...)` here would be the one unaudited `ServiceCategory` mutation in the codebase, and it would be the one that runs unattended with no human to ask afterwards what changed. The command therefore calls `save_service_category(category=..., actor=None, actor_type=AuditEvent.ActorType.SYSTEM, source=AuditEvent.Source.TASK)`. `AuditEvent.ActorType.SYSTEM` and `AuditEvent.Source.TASK` are existing members of Phase 2's enums, and `AuditEvent.actor_user` is nullable, so a system actor needs no synthetic user row. Writes to `ProfessionalProfile` and `ProfessionalService` in `_import_provider` stay plain `save()`/`get_or_create()` calls: neither model has an audited service layer in this phase (spec §2.4 scopes the requirement to staff *catalog* CRUD), and `LegacyDirectoryMapping` is itself the audit trail for the import.

**Note (idempotency):** spec §38 requires commands to be idempotent. Every write is an `update_or_create`/`get_or_create` keyed on `(legacy_kind, legacy_identifier)`, and step 3 copies a description or category **only when the target's field is empty** — a second run never overwrites staff edits made after the first. A test runs the command twice and asserts identical counts.

- [ ] **Step 1: Write the failing text-helper test**

`backend/common/tests/test_text.py`:

```python
import pytest

from common.text import normalize_comparison_text


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("Bénéteau", "beneteau"),
        ("  Ocean   Legal  ", "ocean legal"),
        ("OCEAN LEGAL", "ocean legal"),
        ("Málaga", "malaga"),
        ("", ""),
        (None, ""),
    ],
)
def test_normalize_comparison_text(raw, expected):
    assert normalize_comparison_text(raw) == expected
```

- [ ] **Step 2: Write the failing command tests**

`backend/services_catalog/tests/test_import_legacy_directory.py`:

```python
import json

import pytest
from django.core.management import call_command

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from professionals.enums import ProfessionalProfileStatus
from professionals.tests.factories import make_professional
from services_catalog.models import LegacyDirectoryMapping, ProfessionalService
from services_catalog.tests.factories import make_service_category


def write_source(tmp_path, payload):
    path = tmp_path / "legacy.json"
    path.write_text(json.dumps(payload), encoding="utf-8")
    return str(path)


def build_professional(email, *, slug, display_name, **extra):
    return make_professional(
        make_user(email, role=UserRole.SERVICE_PROVIDER),
        slug=slug,
        display_name=display_name,
        status=ProfessionalProfileStatus.ACTIVE,
        **extra,
    )


@pytest.mark.django_db
def test_an_empty_source_imports_nothing_and_reports_zeroes(tmp_path, capsys):
    source = write_source(tmp_path, {"services": [], "providers": []})

    call_command("import_legacy_directory", f"--source={source}")

    output = capsys.readouterr().out
    assert "providers read: 0" in output
    assert "services read: 0" in output
    assert LegacyDirectoryMapping.objects.count() == 0


@pytest.mark.django_db
def test_a_provider_matching_by_slug_is_mapped(tmp_path):
    pro = build_professional("a@example.com", slug="ocean-legal", display_name="Ocean Legal")
    source = write_source(
        tmp_path,
        {
            "services": [],
            "providers": [
                {
                    "legacy_id": "4821",
                    "slug": "ocean-legal",
                    "display_name": "Ocean Legal",
                    "address": "Via del Porto 1, Livorno",
                }
            ],
        },
    )

    call_command("import_legacy_directory", f"--source={source}")

    mapping = LegacyDirectoryMapping.objects.get(legacy_identifier="4821")
    assert mapping.resolution == LegacyDirectoryMapping.Resolution.MAPPED
    assert mapping.target_id == pro.pk
    assert mapping.target_type == LegacyDirectoryMapping.TargetType.PROFESSIONAL_PROFILE


@pytest.mark.django_db
def test_a_provider_matching_on_normalized_name_and_address_is_mapped(tmp_path):
    pro = build_professional(
        "b@example.com",
        slug="ocean-legal",
        display_name="Océan Legal",
        address_line1="Via del Porto 1",
        city="Livorno",
    )
    source = write_source(
        tmp_path,
        {
            "services": [],
            "providers": [
                {
                    "legacy_id": "700",
                    "slug": "ocean-legal-old",
                    "display_name": "OCEAN  LEGAL",
                    "address": "via del porto 1 livorno",
                }
            ],
        },
    )

    call_command("import_legacy_directory", f"--source={source}")

    mapping = LegacyDirectoryMapping.objects.get(legacy_identifier="700")
    assert mapping.resolution == LegacyDirectoryMapping.Resolution.MAPPED
    assert mapping.target_id == pro.pk
    assert mapping.legacy_slug == "ocean-legal-old"


@pytest.mark.django_db
def test_a_name_only_match_is_flagged_for_review_and_never_merged(tmp_path):
    build_professional(
        "c@example.com", slug="ocean-legal", display_name="Ocean Legal", city="Livorno"
    )
    source = write_source(
        tmp_path,
        {
            "services": [],
            "providers": [
                {
                    "legacy_id": "900",
                    "slug": "ocean-legal-palma",
                    "display_name": "Ocean Legal",
                    "address": "Passeig Maritim 9, Palma",
                }
            ],
        },
    )

    call_command("import_legacy_directory", f"--source={source}")

    mapping = LegacyDirectoryMapping.objects.get(legacy_identifier="900")
    assert mapping.resolution == LegacyDirectoryMapping.Resolution.DUPLICATE_REVIEW
    assert mapping.target_id is None
    assert "ocean-legal" in mapping.notes


@pytest.mark.django_db
def test_an_unmatched_provider_is_recorded_as_unresolved(tmp_path):
    source = write_source(
        tmp_path,
        {
            "services": [],
            "providers": [
                {"legacy_id": "404", "slug": "gone", "display_name": "Gone", "address": ""}
            ],
        },
    )

    call_command("import_legacy_directory", f"--source={source}")

    mapping = LegacyDirectoryMapping.objects.get(legacy_identifier="404")
    assert mapping.resolution == LegacyDirectoryMapping.Resolution.UNRESOLVED


@pytest.mark.django_db
def test_missing_descriptions_are_copied_but_existing_ones_are_never_overwritten(tmp_path):
    blank = build_professional("d@example.com", slug="blank-pro", display_name="Blank Pro")
    filled = build_professional(
        "e@example.com",
        slug="filled-pro",
        display_name="Filled Pro",
        description="Written by staff.",
    )
    source = write_source(
        tmp_path,
        {
            "services": [],
            "providers": [
                {
                    "legacy_id": "1",
                    "slug": "blank-pro",
                    "display_name": "Blank Pro",
                    "address": "",
                    "description": "Legacy copy.",
                },
                {
                    "legacy_id": "2",
                    "slug": "filled-pro",
                    "display_name": "Filled Pro",
                    "address": "",
                    "description": "Legacy copy.",
                },
            ],
        },
    )

    call_command("import_legacy_directory", f"--source={source}")

    blank.refresh_from_db()
    filled.refresh_from_db()
    assert blank.description == "Legacy copy."
    assert filled.description == "Written by staff."


@pytest.mark.django_db
def test_legacy_categories_become_professional_services_only_when_missing(tmp_path):
    legal = make_service_category(slug="legal", name_en="Legal")
    pro = build_professional("f@example.com", slug="cat-pro", display_name="Cat Pro")
    source = write_source(
        tmp_path,
        {
            "services": [],
            "providers": [
                {
                    "legacy_id": "3",
                    "slug": "cat-pro",
                    "display_name": "Cat Pro",
                    "address": "",
                    "categories": ["legal", "unknown-category"],
                }
            ],
        },
    )

    call_command("import_legacy_directory", f"--source={source}")
    call_command("import_legacy_directory", f"--source={source}")

    services = ProfessionalService.objects.filter(professional=pro)
    assert services.count() == 1
    assert services.first().category == legal


@pytest.mark.django_db
def test_a_legacy_service_record_maps_to_a_category_and_never_deactivates_an_seo_row(tmp_path):
    source = write_source(
        tmp_path,
        {
            "services": [
                {"legacy_id": "s1", "slug": "legal", "name": "Legal", "description": "Legacy."}
            ],
            "providers": [],
        },
    )

    call_command("import_legacy_directory", f"--source={source}")

    mapping = LegacyDirectoryMapping.objects.get(legacy_identifier="s1")
    assert mapping.resolution == LegacyDirectoryMapping.Resolution.MAPPED
    assert mapping.target_type == LegacyDirectoryMapping.TargetType.SERVICE_CATEGORY

    from audit.models import AuditEvent
    from services_catalog.models import ServiceCategory

    legal = ServiceCategory.objects.get(slug="legal")
    assert legal.is_active is True
    assert legal.has_seo_page is True
    assert legal.description_en == "Legacy."

    # The copied description is a ServiceCategory write, so it went through
    # save_service_category and left an audit row with a system actor.
    event = AuditEvent.objects.get(
        action="service_category.updated", target_id=str(legal.pk)
    )
    assert event.actor_user is None
    assert event.actor_type == AuditEvent.ActorType.SYSTEM
    assert event.source == AuditEvent.Source.TASK
    assert event.before["description_en"] == ""
    assert event.after["description_en"] == "Legacy."


@pytest.mark.django_db
def test_the_command_is_idempotent(tmp_path):
    build_professional("g@example.com", slug="idem-pro", display_name="Idem Pro")
    source = write_source(
        tmp_path,
        {
            "services": [],
            "providers": [
                {"legacy_id": "10", "slug": "idem-pro", "display_name": "Idem Pro", "address": ""}
            ],
        },
    )

    call_command("import_legacy_directory", f"--source={source}")
    call_command("import_legacy_directory", f"--source={source}")

    assert LegacyDirectoryMapping.objects.filter(legacy_identifier="10").count() == 1


@pytest.mark.django_db
def test_dry_run_writes_nothing(tmp_path, capsys):
    build_professional("h@example.com", slug="dry-pro", display_name="Dry Pro")
    source = write_source(
        tmp_path,
        {
            "services": [],
            "providers": [
                {"legacy_id": "11", "slug": "dry-pro", "display_name": "Dry Pro", "address": ""}
            ],
        },
    )

    call_command("import_legacy_directory", f"--source={source}", "--dry-run")

    assert LegacyDirectoryMapping.objects.count() == 0
    assert "DRY RUN" in capsys.readouterr().out


@pytest.mark.django_db
def test_a_malformed_source_fails_loudly(tmp_path):
    from django.core.management.base import CommandError

    path = tmp_path / "broken.json"
    path.write_text("{not json", encoding="utf-8")

    with pytest.raises(CommandError):
        call_command("import_legacy_directory", f"--source={path}")


@pytest.mark.django_db
def test_the_report_states_that_canonical_tags_and_the_sitemap_regenerate_themselves(
    tmp_path, capsys
):
    source = write_source(tmp_path, {"services": [], "providers": []})

    call_command("import_legacy_directory", f"--source={source}")

    assert "sitemap and canonical tags regenerate from the database" in capsys.readouterr().out
```

- [ ] **Step 3: Run both test files to verify they fail**

```bash
uv run pytest common/tests/test_text.py services_catalog/tests/test_import_legacy_directory.py -v
```

Expected: `ModuleNotFoundError: No module named 'common.text'` and `Unknown command: 'import_legacy_directory'`.

- [ ] **Step 4: Write the shared text helper**

`backend/common/text.py`:

```python
import unicodedata


def normalize_comparison_text(value) -> str:
    """Casefolded, accent-stripped, whitespace-collapsed key for comparing
    human-entered names and addresses.

    Used by the legacy directory import to decide whether two records describe
    the same organization. taxonomy.services.normalize_taxonomy_name does the
    same job for boat brands; collapsing that duplicate into this function is
    queued for a cleanup pass, not done here (this plan does not modify
    already-merged apps).
    """
    if not value:
        return ""
    collapsed = " ".join(str(value).split())
    decomposed = unicodedata.normalize("NFKD", collapsed)
    without_accents = "".join(
        char for char in decomposed if not unicodedata.combining(char)
    )
    return without_accents.casefold()
```

- [ ] **Step 5: Add the dedup key helper**

Append to `backend/services_catalog/services.py` (add `from common.text import normalize_comparison_text` to the import block at the top):

```python
def legacy_dedup_key(name, address) -> tuple:
    """Spec §14.3 step 2's "normalized name/address" pair.

    Returned as a tuple so callers can compare the two halves independently: a
    match on both is a merge, a match on the name alone is a review item, never
    an automatic merge.
    """
    return (normalize_comparison_text(name), normalize_comparison_text(address))
```

- [ ] **Step 6: Write the management command**

`backend/services_catalog/management/__init__.py` and `backend/services_catalog/management/commands/__init__.py` are empty files.

`backend/services_catalog/management/commands/import_legacy_directory.py`:

```python
import json

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from audit.models import AuditEvent
from professionals.enums import ProfessionalProfileStatus
from professionals.models import ProfessionalProfile
from services_catalog.models import (
    LegacyDirectoryMapping,
    ProfessionalService,
    ServiceCategory,
)
from services_catalog.services import legacy_dedup_key, save_service_category


class Command(BaseCommand):
    help = (
        "Import legacy service/provider records into the canonical directory, "
        "following spec §14.3's six-step recipe. There is no legacy data in "
        "this project (the prior artefact was static HTML mockups), so this "
        "command exists as the sanctioned mechanism and is not run in any "
        "environment."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--source",
            required=True,
            help='JSON file: {"services": [...], "providers": [...]}',
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would change without writing anything.",
        )

    def handle(self, *args, **options):
        payload = self._load(options["source"])
        services = payload.get("services", [])
        providers = payload.get("providers", [])
        dry_run = options["dry_run"]

        counts = {
            "services_read": len(services),
            "providers_read": len(providers),
            "mapped": 0,
            "duplicate_review": 0,
            "unresolved": 0,
            "descriptions_copied": 0,
            "categories_attached": 0,
            "slugs_preserved": 0,
            "slugs_changed": 0,
        }

        try:
            with transaction.atomic():
                for record in services:
                    self._import_service(record, counts)
                for record in providers:
                    self._import_provider(record, counts)
                if dry_run:
                    self.stdout.write(self.style.WARNING("DRY RUN — rolling back."))
                    transaction.set_rollback(True)
        except KeyError as exc:
            raise CommandError(f"Legacy record is missing a required key: {exc}") from exc

        self._report(counts, dry_run)

    # -- step 0 ---------------------------------------------------------------

    def _load(self, path):
        try:
            with open(path, encoding="utf-8") as handle:
                payload = json.load(handle)
        except OSError as exc:
            raise CommandError(f"Cannot read {path}: {exc}") from exc
        except json.JSONDecodeError as exc:
            raise CommandError(f"{path} is not valid JSON: {exc}") from exc
        if not isinstance(payload, dict):
            raise CommandError(f"{path} must contain a JSON object.")
        return payload

    # -- steps 1-3 for legacy service records ---------------------------------

    def _import_service(self, record, counts):
        legacy_id = str(record["legacy_id"])
        slug = (record.get("slug") or "").strip()
        name = record.get("name") or ""
        normalized_name, normalized_address = legacy_dedup_key(name, "")

        category = ServiceCategory.objects.filter(slug=slug).first()
        if category is None:
            category = self._match_category_by_name(normalized_name)

        if category is None:
            self._write_mapping(
                LegacyDirectoryMapping.LegacyKind.SERVICE,
                legacy_id,
                slug,
                normalized_name,
                normalized_address,
                resolution=LegacyDirectoryMapping.Resolution.UNRESOLVED,
                notes="No active ServiceCategory matched this legacy service record.",
                counts=counts,
            )
            return

        # Step 3: copy a missing description, never overwrite one. The write
        # goes through save_service_category, not category.save(): rule 5 of
        # this plan's contract makes that the only sanctioned write path for
        # ServiceCategory, and a management command is not an exception to it.
        # actor=None + ActorType.SYSTEM + Source.TASK is how audit.models
        # already models a non-interactive actor.
        description = (record.get("description") or "").strip()
        if description and not category.description_en:
            category.description_en = description
            save_service_category(
                category=category,
                actor=None,
                actor_type=AuditEvent.ActorType.SYSTEM,
                source=AuditEvent.Source.TASK,
            )
            counts["descriptions_copied"] += 1

        # Step 6: the six SEO records stay independent — never deactivated,
        # never reparented, never merged into another category.
        self._write_mapping(
            LegacyDirectoryMapping.LegacyKind.SERVICE,
            legacy_id,
            slug,
            normalized_name,
            normalized_address,
            resolution=LegacyDirectoryMapping.Resolution.MAPPED,
            target_type=LegacyDirectoryMapping.TargetType.SERVICE_CATEGORY,
            target_id=category.pk,
            counts=counts,
        )

    def _match_category_by_name(self, normalized_name):
        if not normalized_name:
            return None
        for candidate in ServiceCategory.objects.filter(is_active=True):
            if legacy_dedup_key(candidate.name_en, "")[0] == normalized_name:
                return candidate
        return None

    # -- steps 1-4 for legacy provider records --------------------------------

    def _import_provider(self, record, counts):
        legacy_id = str(record["legacy_id"])
        legacy_slug = (record.get("slug") or "").strip()
        display_name = record.get("display_name") or ""
        address = record.get("address") or ""
        normalized_name, normalized_address = legacy_dedup_key(display_name, address)

        profile, resolution, notes = self._resolve_provider(
            legacy_slug, normalized_name, normalized_address
        )

        if profile is None:
            self._write_mapping(
                LegacyDirectoryMapping.LegacyKind.PROVIDER,
                legacy_id,
                legacy_slug,
                normalized_name,
                normalized_address,
                resolution=resolution,
                notes=notes,
                counts=counts,
            )
            return

        # Step 4: preserve the slug where it is unique; otherwise the mapping
        # row is what makes the old URL redirect deterministically.
        if legacy_slug and legacy_slug == profile.slug:
            counts["slugs_preserved"] += 1
        elif legacy_slug:
            counts["slugs_changed"] += 1

        # Step 3: copy missing descriptions and categories, never overwrite.
        description = (record.get("description") or "").strip()
        if description and not profile.description:
            profile.description = description
            profile.save(update_fields=["description", "updated_at"])
            counts["descriptions_copied"] += 1

        for category_slug in record.get("categories", []) or []:
            category = ServiceCategory.objects.filter(
                slug=str(category_slug).strip(), is_active=True
            ).first()
            if category is None:
                continue
            _, created = ProfessionalService.objects.get_or_create(
                professional=profile,
                category=category,
                title_en=category.name_en,
                defaults={"service_area": list(profile.service_area or [])},
            )
            if created:
                counts["categories_attached"] += 1

        self._write_mapping(
            LegacyDirectoryMapping.LegacyKind.PROVIDER,
            legacy_id,
            legacy_slug,
            normalized_name,
            normalized_address,
            resolution=LegacyDirectoryMapping.Resolution.MAPPED,
            target_type=LegacyDirectoryMapping.TargetType.PROFESSIONAL_PROFILE,
            target_id=profile.pk,
            counts=counts,
        )

    def _resolve_provider(self, legacy_slug, normalized_name, normalized_address):
        """Spec §14.3 step 2, in strict precedence order."""
        active = ProfessionalProfile.objects.filter(status=ProfessionalProfileStatus.ACTIVE)

        if legacy_slug:
            exact = active.filter(slug=legacy_slug).first()
            if exact is not None:
                return exact, LegacyDirectoryMapping.Resolution.MAPPED, ""

        name_only_matches = []
        for candidate in active:
            candidate_address = " ".join(
                part
                for part in (
                    candidate.address_line1,
                    candidate.address_line2,
                    candidate.city,
                    candidate.postal_code,
                    candidate.region,
                )
                if part
            )
            candidate_name, candidate_addr = legacy_dedup_key(
                candidate.display_name, candidate_address
            )
            if candidate_name != normalized_name or not normalized_name:
                continue
            if normalized_address and candidate_addr == normalized_address:
                return candidate, LegacyDirectoryMapping.Resolution.MAPPED, ""
            name_only_matches.append(candidate)

        if name_only_matches:
            # Never merge solely on display name (spec §14.3 step 2).
            slugs = ", ".join(sorted(profile.slug for profile in name_only_matches))
            return (
                None,
                LegacyDirectoryMapping.Resolution.DUPLICATE_REVIEW,
                f"Display name matches {slugs} but the address does not. "
                "A human must confirm or reject the merge.",
            )

        return (
            None,
            LegacyDirectoryMapping.Resolution.UNRESOLVED,
            "No active ProfessionalProfile matched this legacy provider record.",
        )

    # -- step 1: the mapping table -------------------------------------------

    def _write_mapping(
        self,
        legacy_kind,
        legacy_identifier,
        legacy_slug,
        normalized_name,
        normalized_address,
        *,
        resolution,
        counts,
        target_type="",
        target_id=None,
        notes="",
    ):
        LegacyDirectoryMapping.objects.update_or_create(
            legacy_kind=legacy_kind,
            legacy_identifier=legacy_identifier,
            defaults={
                "legacy_slug": legacy_slug,
                "normalized_name": normalized_name,
                "normalized_address": normalized_address,
                "target_type": target_type,
                "target_id": target_id,
                "resolution": resolution,
                "notes": notes,
            },
        )
        if resolution == LegacyDirectoryMapping.Resolution.MAPPED:
            counts["mapped"] += 1
        elif resolution == LegacyDirectoryMapping.Resolution.DUPLICATE_REVIEW:
            counts["duplicate_review"] += 1
        else:
            counts["unresolved"] += 1

    # -- steps 5-6: reconciliation report ------------------------------------

    def _report(self, counts, dry_run):
        self.stdout.write("Legacy directory import reconciliation report")
        self.stdout.write(f"  services read: {counts['services_read']}")
        self.stdout.write(f"  providers read: {counts['providers_read']}")
        self.stdout.write(f"  mapped: {counts['mapped']}")
        self.stdout.write(f"  needs review (duplicate): {counts['duplicate_review']}")
        self.stdout.write(f"  unresolved: {counts['unresolved']}")
        self.stdout.write(f"  descriptions copied: {counts['descriptions_copied']}")
        self.stdout.write(f"  categories attached: {counts['categories_attached']}")
        self.stdout.write(f"  slugs preserved: {counts['slugs_preserved']}")
        self.stdout.write(f"  slugs changed (redirect via mapping): {counts['slugs_changed']}")
        # Spec §14.3 step 5.
        self.stdout.write(
            "  sitemap and canonical tags regenerate from the database on the "
            "next request; there is no static file to rebuild."
        )
        # Spec §14.3 step 6.
        self.stdout.write(
            "  the six SEO service categories were left independent and active."
        )
        if dry_run:
            self.stdout.write(self.style.WARNING("Nothing was written (dry run)."))
        else:
            self.stdout.write(self.style.SUCCESS("Import complete."))
```

- [ ] **Step 7: Run the tests to verify they pass**

```bash
uv run pytest common/tests/test_text.py services_catalog/tests/test_import_legacy_directory.py -v
```

Expected: the 6-case `normalize_comparison_text` parametrize and all 12 command tests `PASS`.

- [ ] **Step 8: Commit**

```bash
git add backend/common backend/services_catalog
git commit -m "feat(services_catalog): add the spec 14.3 legacy directory import mechanism"
```

---

### Task 11: Frontend — trailing-slash canonicalization and the two 301 redirects

**Files:**
- Modify: `frontend/next.config.ts`, `frontend/vitest.config.ts`
- Create: `frontend/next.config.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `frontend/next.config.ts` — `trailingSlash: true` and a `redirects()` returning **exactly two** entries, both `statusCode: 301`: `/services/` → `/services/professionals/` and `/professionals/` → `/services/professionals/`.
  - `frontend/vitest.config.ts` — an `include` glob that also collects root-level `*.test.ts`.

**Note (ruling — `trailingSlash: true` is load-bearing, not cosmetic):** every canonical URL in spec §1, §4.1 and §4.3 ends in a slash (`/services/professionals/`, `/services/professionals/<slug>/`, `/services/legal/`). Next.js defaults to `trailingSlash: false`, which **308-redirects** `/services/professionals/` to `/services/professionals`. Left at the default, `/services/` → 301 → `/services/professionals/` → 308 → `/services/professionals` — a two-hop chain ending on a non-canonical URL, breaking spec §4.3's "never create redirect chains" and this phase's definition of done ("Both retired directory URLs return a single-hop 301"). Setting `trailingSlash: true` makes the slashed form canonical everywhere, so the 301 lands on its final destination in one hop.

**Note (ruling — `statusCode: 301`, never `permanent: true`):** in Next.js, `permanent: true` emits **308**, not 301. Spec §1 and §4.3 say 301 explicitly, and a 308 is a different status that some crawlers and proxies treat differently. The redirect entries therefore use `statusCode: 301`, which is mutually exclusive with `permanent` in Next's `Redirect` type — do not pass both. Step 6's `curl -sI` check is the authority: if the build emits anything other than `301`, the config is wrong.

**Note (`next.config.test.ts` sits outside Vitest's current glob):** Phase 3's `frontend/vitest.config.ts` sets `include: ["src/**/*.{test,spec}.{ts,tsx}"]`, so a test file at the frontend root is silently **never collected** — it would pass by not running. Step 3 widens the glob to cover the root config test explicitly. Verify by deliberately breaking an assertion once and confirming the suite goes red before fixing it back.

- [ ] **Step 1: Verify the Next.js 16.3.5 APIs before writing any config**

```bash
cd frontend
pnpm install
cat node_modules/next/package.json | head -5
ls node_modules/next/dist/docs/
```

Read the `redirects` and `trailingSlash` pages under `node_modules/next/dist/docs/` and confirm: (a) `redirects()` entries accept `statusCode`, and (b) `trailingSlash: true` is a top-level `NextConfig` key. If either signature differs from what this task writes, follow the installed docs and note the difference in the commit message.

- [ ] **Step 2: Write the failing config test**

`frontend/next.config.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import nextConfig from "./next.config";

describe("next.config", () => {
  it("makes the trailing-slash form canonical, as every spec 4.1 route does", () => {
    expect(nextConfig.trailingSlash).toBe(true);
  });

  it("301-redirects both retired directory URLs to the combined directory", async () => {
    const redirects = await nextConfig.redirects!();

    expect(redirects).toHaveLength(2);
    expect(redirects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "/services/",
          destination: "/services/professionals/",
          statusCode: 301,
        }),
        expect.objectContaining({
          source: "/professionals/",
          destination: "/services/professionals/",
          statusCode: 301,
        }),
      ]),
    );
  });

  it("never emits 308 by using permanent instead of an explicit 301", async () => {
    const redirects = await nextConfig.redirects!();

    for (const redirect of redirects) {
      expect(redirect).not.toHaveProperty("permanent");
      expect((redirect as { statusCode?: number }).statusCode).toBe(301);
    }
  });

  it("never redirects to a destination that is itself a redirect source", async () => {
    const redirects = await nextConfig.redirects!();
    const sources = new Set(redirects.map((redirect) => redirect.source));

    for (const redirect of redirects) {
      expect(sources.has(redirect.destination)).toBe(false);
    }
  });
});
```

- [ ] **Step 3: Widen Vitest's include glob, then run the test to verify it fails**

In `frontend/vitest.config.ts`, replace the `include` line with:

```typescript
    // src/** covers lib, components and page/route tests; the second entry
    // picks up the root-level next.config.test.ts, which would otherwise be
    // silently skipped.
    include: ["src/**/*.{test,spec}.{ts,tsx}", "*.test.{ts,tsx}"],
```

```bash
pnpm test
```

Expected: `next.config.test.ts` is collected and fails on `trailingSlash` being `undefined`. If it does not appear in Vitest's file list at all, the glob change did not take — fix it before continuing, because a test that never runs is worse than no test.

- [ ] **Step 4: Write the config**

`frontend/next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every canonical URL in spec 4.1/4.3 ends in a slash. Without this, Next
  // 308-redirects the slashed form to the unslashed one and turns each 301
  // below into a two-hop chain ending on a non-canonical URL.
  trailingSlash: true,

  async redirects() {
    // Spec 4.3: both retired directory URLs return a permanent 301 to the
    // combined directory. statusCode: 301 is deliberate — `permanent: true`
    // would emit 308. /professionals/profile/?id= is NOT listed here: it needs
    // a database lookup and is handled by src/app/professionals/profile/route.ts.
    return [
      {
        source: "/services/",
        destination: "/services/professionals/",
        statusCode: 301,
      },
      {
        source: "/professionals/",
        destination: "/services/professionals/",
        statusCode: 301,
      },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 5: Run the test, lint and build, then verify the real status codes**

```bash
pnpm test
pnpm lint
pnpm build
pnpm start --port 3020
```

In a second terminal:

```bash
curl -sI http://127.0.0.1:3020/services/ | head -3
curl -sI http://127.0.0.1:3020/professionals/ | head -3
```

Expected for both: `HTTP/1.1 301` and `location: /services/professionals/`. **A `308` means `statusCode: 301` was not applied; a second redirect hop on the destination means `trailingSlash: true` was not applied.** Both are hard failures — fix the config, do not accept either. (The destination itself 404s until Task 14 builds the page; only the status and `location` of the *first* hop are under test here.)

- [ ] **Step 6: Commit**

```bash
cd ..
git add frontend
git commit -m "feat(frontend): 301 the retired directory URLs to the combined directory"
```

---

### Task 12: Frontend — the directory API client and the legacy profile resolver

**Files:**
- Create: `frontend/src/lib/api/directory.ts`
- Create: `frontend/src/app/professionals/profile/route.ts`, `frontend/src/app/professionals/profile/route.test.ts`

**Interfaces:**
- Consumes: `GET /api/v1/legacy/professional-redirect/` (Task 9), and the four read endpoints from Tasks 6–8.
- Produces:
  - `frontend/src/lib/api/directory.ts` — `DIRECTORY_API_BASE_URL`, `EMPTY_PROFESSIONAL_PAGE`; types `Locale`, `ServiceCategory`, `ServiceCategoryDetail`, `CategoryRef`, `ProfessionalCard`, `ProfessionalService`, `RelatedProfessional`, `ProfessionalDetail`, `Paginated<T>`, `ProfessionalSearch`; `directoryFetch<T>(path): Promise<T | null>` (null on 404, throws on other failures); `fetchServiceCategories`, `fetchServiceCategory`, `fetchProfessionals`, `fetchProfessional`, `resolveLegacyProfessional`.
  - Route `GET /professionals/profile/?id=<legacy>` — 301 to the resolved canonical URL, or a 404 response.

**Note (ruling — a separate `directoryFetch`, not Phase 3's `apiFetch`):** Phase 3's Task 10 turns `src/lib/api/client.ts` into a browser-oriented client that attaches an in-memory access token, sends `credentials: "include"` and retries once through the refresh cookie. Every call in this phase is an **unauthenticated server-side read** during SSR, where there is no cookie jar, no token and nothing to refresh — and where a 404 is an expected, meaningful outcome rather than an error to throw. `directoryFetch` is therefore its own small function that returns `null` on 404 and throws on anything else. It shares the same `NEXT_PUBLIC_API_BASE_URL` environment variable as the browser client, so there is one API origin, not two.

**Note (ruling — `null` is propagated, never flattened to an empty collection):** `fetchServiceCategories` and `fetchProfessionals` return `T | null`, not `T` with an empty fallback. For a collection endpoint a 404 can only come from Task 6's `CombinedDirectoryEnabled` — i.e. the rollout flag is off — and that is a categorically different fact from "the query matched nothing". Flattening the two here would make it impossible for a page to honour spec §35.1's "gate frontend exposure" (see the ruling in Task 14). `EMPTY_PROFESSIONAL_PAGE` is exported for the one caller that has already established the flag is on and legitimately wants to degrade.

**Note (`Locale` is declared here, once):** `lib/i18n/directory.ts` (Task 13) imports and re-exports this module's `Locale` rather than declaring its own union. Two structurally identical unions compile fine and are still two sources of truth; the API contract's `?locale=` parameter is the thing being modelled, so the API module owns it.

**Note (`127.0.0.1`, not `localhost`, in the server-side default):** Phase 0/1's retrospective records that this machine resolves `localhost` to IPv6 `::1`. The existing `client.ts` default (`http://localhost:8020`) runs in the browser, where that is fine; `directoryFetch` runs in Node during SSR, so its fallback is `http://127.0.0.1:8020`. In every real environment `NEXT_PUBLIC_API_BASE_URL` is set and neither default is used.

**Note (`/professionals/profile/` is a Route Handler, not a page):** it must emit a real 301, and `redirect()` inside a server component emits 307/303. A `route.ts` returning `NextResponse.redirect(url, 301)` gives the exact status spec §4.3 requires. A folder cannot contain both `page.tsx` and `route.ts`; this one contains only `route.ts`. It also does **not** collide with Task 11's `/professionals/` → `/services/professionals/` redirect, whose `source` matches only that exact path — so the legacy profile URL still reaches its resolver in one hop, exactly as spec §4.3's separate row requires.

- [ ] **Step 1: Verify the Route Handler API against the installed Next.js**

```bash
cd frontend
```

Read the Route Handler and `NextResponse` pages under `node_modules/next/dist/docs/` and confirm that `NextResponse.redirect(url, status)` accepts a numeric status. If it does not, follow the installed docs and note the difference in the commit message.

- [ ] **Step 2: Write the failing route-handler test**

`frontend/src/app/professionals/profile/route.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

afterEach(() => fetchMock.mockReset());

function request(url: string) {
  return new Request(url);
}

describe("GET /professionals/profile/", () => {
  it("301s to the resolved canonical URL", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ url: "/services/professionals/ocean-legal/" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const response = await GET(request("http://localhost:3020/professionals/profile/?id=4821"));

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3020/services/professionals/ocean-legal/",
    );
  });

  it("404s when the legacy id does not resolve", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }));

    const response = await GET(request("http://localhost:3020/professionals/profile/?id=nope"));

    expect(response.status).toBe(404);
  });

  it("404s when no id is supplied, without calling the API", async () => {
    const response = await GET(request("http://localhost:3020/professionals/profile/"));

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("404s when the API is unreachable rather than throwing", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

    const response = await GET(request("http://localhost:3020/professionals/profile/?id=4821"));

    expect(response.status).toBe(404);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

```bash
pnpm test
```

Expected: `route.test.ts` is collected (it is under `src/**`, so Task 11's glob change is not needed for it) and fails to resolve `./route`.

- [ ] **Step 4: Write the directory API client and the route handler**

`frontend/src/lib/api/directory.ts`:

```ts
// Unauthenticated, server-side reads of the combined-directory API.
// Deliberately separate from src/lib/api/client.ts, which is the browser
// client (access token, credentials, refresh retry) and throws on every
// non-2xx. Here a 404 is a meaningful answer, not an error.
export const DIRECTORY_API_BASE_URL =
  // 127.0.0.1, not localhost: this runs in Node during SSR and this machine
  // resolves localhost to IPv6 ::1 (Phase 0/1 retrospective).
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8020";

// The single source of truth for the locale union in the whole frontend: it is
// the API contract's ?locale= parameter. lib/i18n/directory.ts imports and
// re-exports this type rather than declaring a second, drifting copy.
export type Locale = "en" | "it" | "es";

export interface ServiceCategory {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon_key: string;
  display_order: number;
  has_seo_page: boolean;
  url: string | null;
}

export interface ServiceCategoryDetail extends ServiceCategory {
  seo_title: string;
  seo_description: string;
}

export interface CategoryRef {
  slug: string;
  name: string;
}

export interface ProfessionalCard {
  id: string;
  slug: string;
  display_name: string;
  short_description: string;
  city: string;
  region: string;
  country_code: string;
  service_area: string[];
  categories: CategoryRef[];
  active_service_count: number;
  url: string;
}

export interface ProfessionalService {
  id: string;
  title: string;
  description: string;
  service_area: string[];
  category: CategoryRef;
}

export interface RelatedProfessional {
  slug: string;
  display_name: string;
  city: string;
  url: string;
}

export interface ProfessionalDetail extends ProfessionalCard {
  description: string;
  services: ProfessionalService[];
  related: RelatedProfessional[];
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export async function directoryFetch<T>(path: string): Promise<T | null> {
  const response = await fetch(`${DIRECTORY_API_BASE_URL}${path}`, {
    headers: { Accept: "application/json" },
    // Directory content is staff-edited and provider-edited; never serve a
    // stale grid from the build cache.
    cache: "no-store",
  });

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Directory API ${path} failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

function query(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      search.set(key, value);
    }
  }
  const serialized = search.toString();
  return serialized ? `?${serialized}` : "";
}

// null means "the API answered 404", which for a collection endpoint can only
// mean the combined_services_professionals rollout flag is off (Task 6's
// CombinedDirectoryEnabled). It is NOT the same as an empty list, and the two
// must not be collapsed here: an empty list is a real directory with nothing
// in it and gets the spec 31 empty-state copy, while null means the feature
// does not exist publicly and the page must notFound(). Callers decide.
export async function fetchServiceCategories(
  locale: Locale,
): Promise<ServiceCategory[] | null> {
  return directoryFetch<ServiceCategory[]>(
    `/api/v1/service-categories/${query({ locale })}`,
  );
}

export async function fetchServiceCategory(
  slug: string,
  locale: Locale,
): Promise<ServiceCategoryDetail | null> {
  return directoryFetch<ServiceCategoryDetail>(
    `/api/v1/service-categories/${encodeURIComponent(slug)}/${query({ locale })}`,
  );
}

export interface ProfessionalSearch {
  q?: string;
  category?: string;
  location?: string;
  sort?: string;
  page?: string;
}

// Same contract as fetchServiceCategories: null = flag off, an empty `results`
// array = no matching professionals.
export async function fetchProfessionals(
  search: ProfessionalSearch,
  locale: Locale,
): Promise<Paginated<ProfessionalCard> | null> {
  return directoryFetch<Paginated<ProfessionalCard>>(
    `/api/v1/professionals/${query({ ...search, locale })}`,
  );
}

/** The shape a caller substitutes when it has already decided a 404 is not fatal. */
export const EMPTY_PROFESSIONAL_PAGE: Paginated<ProfessionalCard> = {
  count: 0,
  next: null,
  previous: null,
  results: [],
};

export async function fetchProfessional(
  slug: string,
  locale: Locale,
): Promise<ProfessionalDetail | null> {
  return directoryFetch<ProfessionalDetail>(
    `/api/v1/professionals/${encodeURIComponent(slug)}/${query({ locale })}`,
  );
}

export async function resolveLegacyProfessional(legacyId: string): Promise<string | null> {
  const resolved = await directoryFetch<{ url: string }>(
    `/api/v1/legacy/professional-redirect/${query({ id: legacyId })}`,
  );
  return resolved?.url ?? null;
}
```

`frontend/src/app/professionals/profile/route.ts`:

```ts
import { NextResponse } from "next/server";

import { resolveLegacyProfessional } from "@/lib/api/directory";

// Spec 4.3: /professionals/profile/?id=<legacy> -> resolved professional slug
// URL, 301 when resolvable, otherwise 404. A Route Handler (not a page) because
// redirect() from a server component emits 307/303, not the 301 the spec fixes.
export async function GET(request: Request): Promise<NextResponse> {
  const legacyId = new URL(request.url).searchParams.get("id")?.trim();
  if (!legacyId) {
    return new NextResponse(null, { status: 404 });
  }

  let destination: string | null = null;
  try {
    destination = await resolveLegacyProfessional(legacyId);
  } catch {
    // An unreachable API is not a redirect: fall through to 404 rather than
    // throwing a 500 at a crawler following an old link.
    destination = null;
  }

  if (!destination) {
    return new NextResponse(null, { status: 404 });
  }
  return NextResponse.redirect(new URL(destination, request.url), 301);
}
```

- [ ] **Step 5: Run the tests, lint and build**

```bash
pnpm test
pnpm lint
pnpm build
```

Expected: the 4 route-handler tests `PASS` alongside Task 11's 4 config tests; lint clean; build succeeds.

- [ ] **Step 6: Verify the legacy resolver end to end**

With the backend running on 8020 and at least one ACTIVE professional plus a `LegacyDirectoryMapping` row for it:

```bash
pnpm start --port 3020
curl -sI "http://127.0.0.1:3020/professionals/profile/?id=<legacy-id>" | grep -i "^HTTP\|^location"
curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:3020/professionals/profile/?id=no-such-provider"
```

Expected: `301` with a `location` ending in `/services/professionals/<slug>/`, then `404`. A `307` means `redirect()` was used somewhere instead of `NextResponse.redirect(url, 301)`.

- [ ] **Step 7: Commit**

```bash
cd ..
git add frontend
git commit -m "feat(frontend): add the directory API client and the legacy professional id resolver"
```

---

### Task 13: Frontend — the EN/IT/ES directory message dictionary

**Files:**
- Create: `frontend/src/lib/i18n/directory.ts`, `frontend/src/lib/i18n/directory.test.ts`

**Interfaces:**
- Consumes: `type Locale` (Task 12).
- Produces:
  - `frontend/src/lib/i18n/directory.ts` — the re-exported `type Locale`, `DEFAULT_LOCALE`, `SUPPORTED_LOCALES`, `resolveLocale(raw)`, `t(locale, key)`, and the `DIRECTORY_MESSAGES` dictionary keyed by spec §37's key names. Consumed by Tasks 14, 15 and 16.

**Note (ruling — a typed dictionary module, not an i18n framework):** spec §37 binds every new UI string to an EN/IT/ES key and forbids hard-coded English inside component bodies. No i18n library is installed and no phase in the spec installs one; adding `next-intl` here would be an architecture decision this phase has no mandate to make. A typed dictionary with a `t(locale, key)` lookup satisfies §37 exactly — keys exist, all three languages exist, no component contains a literal string — and whichever phase introduces locale routing can back `t()` with a framework without touching a single call site. The two key names spec §37 lists by name for this feature, `nav.services_professionals` and `directory.services_professionals.title`, appear verbatim.

**Note (ruling — the locale is English until locale routing exists):** there is no `/it/` or `/es/` route prefix and no locale cookie yet, so the pages in Tasks 14–16 render `en` and pass `locale=en` to the API. The dictionary, the `resolveLocale` helper and the API's `?locale=` parameter are all in place, so the phase that adds locale routing changes the source of one variable, not the pages.

**Note (the dictionary is written whole, once):** every key any page or component in Tasks 14–16 needs is defined here, including the `professional.*` keys the detail page uses and `category.browse_professionals` for the SEO pages. Splitting the dictionary across the tasks that consume it would make the "every key exists in all three languages" test meaningful only at the end of the phase instead of at the end of this task.

- [ ] **Step 1: Write the failing dictionary test**

`frontend/src/lib/i18n/directory.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  DIRECTORY_MESSAGES,
  SUPPORTED_LOCALES,
  resolveLocale,
  t,
} from "@/lib/i18n/directory";

describe("directory messages", () => {
  it("defines every key in all three supported languages", () => {
    for (const [key, translations] of Object.entries(DIRECTORY_MESSAGES)) {
      for (const locale of SUPPORTED_LOCALES) {
        expect(translations[locale], `${key}.${locale}`).toBeTruthy();
      }
    }
  });

  it("includes the two keys spec 37 names for this feature", () => {
    expect(DIRECTORY_MESSAGES["nav.services_professionals"]).toBeDefined();
    expect(DIRECTORY_MESSAGES["directory.services_professionals.title"]).toBeDefined();
  });

  it("uses the exact H1 fixed by spec 1", () => {
    expect(t("en", "directory.services_professionals.title")).toBe(
      "Nautical Services & Professionals",
    );
  });

  it("resolves and defaults locales the same way the API does", () => {
    expect(resolveLocale("it")).toBe("it");
    expect(resolveLocale("IT")).toBe("it");
    expect(resolveLocale("de")).toBe("en");
    expect(resolveLocale(undefined)).toBe("en");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd frontend
pnpm test
```

Expected: `directory.test.ts` is collected and fails with `Failed to resolve import "@/lib/i18n/directory"`.

- [ ] **Step 3: Write the dictionary**

`frontend/src/lib/i18n/directory.ts`:

```ts
// Spec 37: all new UI text has EN/IT/ES translation keys and no English is
// hard-coded inside components. A typed dictionary, not an i18n framework —
// see the ruling in Task 13 of the Phase 5 plan.
import type { Locale } from "@/lib/api/directory";

// Locale is declared once, in lib/api/directory.ts (it is the API contract's
// ?locale= parameter), and re-exported here so a component can import the type
// from the same module as t(). Do NOT redeclare the union in this file: two
// structurally identical unions compile but are two sources of truth.
export type { Locale };

export const SUPPORTED_LOCALES: readonly Locale[] = ["en", "it", "es"];
export const DEFAULT_LOCALE: Locale = "en";

export function resolveLocale(raw: string | undefined | null): Locale {
  const candidate = raw?.trim().toLowerCase();
  return (SUPPORTED_LOCALES as readonly string[]).includes(candidate ?? "")
    ? (candidate as Locale)
    : DEFAULT_LOCALE;
}

type Translations = Record<Locale, string>;

export const DIRECTORY_MESSAGES: Record<string, Translations> = {
  "nav.services_professionals": {
    en: "Services / Professionals",
    it: "Servizi / Professionisti",
    es: "Servicios / Profesionales",
  },
  "directory.services_professionals.title": {
    // Spec 1 fixes this H1 exactly.
    en: "Nautical Services & Professionals",
    it: "Servizi e professionisti nautici",
    es: "Servicios y profesionales náuticos",
  },
  "directory.intro": {
    en: "Find nautical service providers across Spain and Italy.",
    it: "Trova fornitori di servizi nautici in Spagna e in Italia.",
    es: "Encuentra proveedores de servicios náuticos en España e Italia.",
  },
  "directory.search.text": { en: "Search", it: "Cerca", es: "Buscar" },
  "directory.search.category": { en: "Category", it: "Categoria", es: "Categoría" },
  "directory.search.category.all": {
    en: "All categories",
    it: "Tutte le categorie",
    es: "Todas las categorías",
  },
  "directory.search.location": { en: "Location", it: "Località", es: "Ubicación" },
  "directory.search.sort": { en: "Sort", it: "Ordina", es: "Ordenar" },
  "directory.search.submit": { en: "Search", it: "Cerca", es: "Buscar" },
  "directory.sort.recommended": {
    en: "Recommended",
    it: "Consigliati",
    es: "Recomendados",
  },
  "directory.sort.alphabetical": { en: "A–Z", it: "A–Z", es: "A–Z" },
  "directory.categories.heading": {
    en: "Service categories",
    it: "Categorie di servizi",
    es: "Categorías de servicios",
  },
  "directory.categories.empty": {
    en: "No service categories are published yet.",
    it: "Nessuna categoria di servizi è ancora pubblicata.",
    es: "Todavía no hay categorías de servicios publicadas.",
  },
  "directory.results.heading": {
    en: "Professionals",
    it: "Professionisti",
    es: "Profesionales",
  },
  "directory.results.empty": {
    en: "No matching professionals.",
    it: "Nessun professionista corrispondente.",
    es: "No hay profesionales que coincidan.",
  },
  "directory.results.count": {
    en: "results",
    it: "risultati",
    es: "resultados",
  },
  "directory.seo.heading": {
    en: "Service pages",
    it: "Pagine dei servizi",
    es: "Páginas de servicios",
  },
  "directory.pagination.next": { en: "Next", it: "Successivi", es: "Siguientes" },
  "directory.pagination.previous": {
    en: "Previous",
    it: "Precedenti",
    es: "Anteriores",
  },
  "professional.about.heading": { en: "About", it: "Chi siamo", es: "Acerca de" },
  "professional.services.heading": {
    en: "Services offered",
    it: "Servizi offerti",
    es: "Servicios ofrecidos",
  },
  "professional.service_area.heading": {
    en: "Service area",
    it: "Area di servizio",
    es: "Zona de servicio",
  },
  "professional.related.heading": {
    en: "Related professionals",
    it: "Professionisti correlati",
    es: "Profesionales relacionados",
  },
  "professional.status.active": {
    // Spec 14.2: short verified/profile status language that does not imply a
    // government certification. Backed by a real field (status === ACTIVE).
    en: "Listed NAUTA profile, reviewed by NAUTA staff. NAUTA is not a licensing body and does not certify qualifications.",
    it: "Profilo NAUTA pubblicato, verificato dallo staff NAUTA. NAUTA non è un ente di rilascio di licenze e non certifica qualifiche.",
    es: "Perfil NAUTA publicado, revisado por el equipo de NAUTA. NAUTA no es un organismo de licencias y no certifica cualificaciones.",
  },
  "category.browse_professionals": {
    en: "Browse professionals in this category",
    it: "Sfoglia i professionisti di questa categoria",
    es: "Ver profesionales de esta categoría",
  },
};

export function t(locale: Locale, key: string): string {
  const translations = DIRECTORY_MESSAGES[key];
  if (!translations) {
    throw new Error(`Unknown directory message key: ${key}`);
  }
  return translations[locale] || translations[DEFAULT_LOCALE];
}
```

- [ ] **Step 4: Run the test, lint and build**

```bash
pnpm test
pnpm lint
pnpm build
```

Expected: the 4 dictionary tests `PASS` alongside Tasks 11 and 12's suites; lint clean; build succeeds. If the "defines every key in all three supported languages" test passes trivially, check that `DIRECTORY_MESSAGES` is non-empty — an empty object satisfies that loop.

- [ ] **Step 5: Commit**

```bash
cd ..
git add frontend
git commit -m "feat(frontend): add the EN/IT/ES directory message dictionary"
```

---

### Task 14: Frontend — the combined directory page and its components

**Files:**
- Create: `frontend/src/components/directory/DirectorySearchForm.tsx` + `.test.tsx`
- Create: `frontend/src/components/directory/CategoryGrid.tsx` + `.test.tsx`
- Create: `frontend/src/components/directory/ProfessionalCard.tsx` + `.test.tsx`
- Create: `frontend/src/app/services/professionals/page.tsx`

**Interfaces:**
- Consumes: `fetchServiceCategories`, `fetchProfessionals`, and the `ServiceCategory`/`ProfessionalCard`/`CategoryRef` types (Task 12); `t`, `DEFAULT_LOCALE`, `type Locale` (Task 13).
- Produces:
  - `<DirectorySearchForm locale categories current />`, `<CategoryGrid locale categories />`, `<ProfessionalResultCard locale professional />`.
  - Page `/services/professionals/` with `generateMetadata` emitting the canonical URL; 404 when the rollout flag is off.

**Note (ruling — a plain GET form, no client-side state):** spec §29.4 requires filter URL state to be shareable and back-button safe. A native `<form method="get" action="/services/professionals/">` puts every filter in the query string, works without JavaScript, restores correctly on Back, and needs no client component. The page is a pure server component and every result is server-rendered, which is also what the SEO requirement in spec §32.2 needs.

**Note (empty states are real, per spec §31):** "Combined category tiles | hide inactive; **true empty message**" and "Professional result cards | **no matching professionals**". Both render a real sentence from the dictionary — never a skeleton, never fabricated sample cards.

**Note (ruling — "flag off" is a 404, not an empty state):** spec §35.1 says the flag gates **frontend exposure**, not merely the API, and warns against leaving the two out of step. The two conditions look similar from inside a component and are completely different facts: *no rows match* is a live feature with nothing to show, and *the flag is off* is a feature that does not exist publicly. This page distinguishes them at the data layer — `fetchServiceCategories` and `fetchProfessionals` return `null` for a 404 and an array/envelope for a 200 — and `notFound()`s on `null`. That makes all three public surfaces behave identically (this page, the detail page, the six SEO pages all 404 with the flag off), makes the seeded flag row's own description literally true, and matches the reason Task 6's `CombinedDirectoryEnabled` chose 404 over 403 in the first place. The empty-state copy stays exactly where spec §31 wants it: an **enabled** directory with no active categories, or a filter that matches nobody, still returns 200 and renders a real sentence.

**Note (ruling — how the page itself is test-driven):** `page.tsx` is an async server component. Vitest with jsdom (Phase 3's Task 10) renders client components; it gives no harness for awaiting a server component's JSX, and mocking `fetch` to assert on the returned tree would test the mock rather than the page. The three components below therefore carry the unit tests, and the **page** is driven by an HTTP check against a real running stack — Step 2 records it failing before the page exists, Step 7 records it passing afterwards. That is the same write-fail/implement/see-pass loop every other task in this plan follows, at the only level at which this artefact can honestly be observed, and it is the shape Task 16 uses for its two routes as well.

- [ ] **Step 1: Write the failing component tests**

`frontend/src/components/directory/CategoryGrid.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import CategoryGrid from "@/components/directory/CategoryGrid";
import type { ServiceCategory } from "@/lib/api/directory";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

function category(overrides: Partial<ServiceCategory> = {}): ServiceCategory {
  return {
    id: "1",
    slug: "legal",
    name: "Legal",
    description: "",
    icon_key: "gavel",
    display_order: 20,
    has_seo_page: true,
    url: "/services/legal/",
    ...overrides,
  };
}

describe("CategoryGrid", () => {
  it("links each tile to the filtered directory", () => {
    render(<CategoryGrid locale="en" categories={[category()]} />);

    expect(screen.getByRole("link", { name: /legal/i })).toHaveAttribute(
      "href",
      "/services/professionals/?category=legal",
    );
  });

  it("renders a description only when the record has one", () => {
    const { rerender } = render(<CategoryGrid locale="en" categories={[category()]} />);
    expect(screen.queryByText("Contract work.")).not.toBeInTheDocument();

    rerender(
      <CategoryGrid
        locale="en"
        categories={[category({ description: "Contract work." })]}
      />,
    );
    expect(screen.getByText("Contract work.")).toBeInTheDocument();
  });

  it("shows a true empty message rather than placeholder tiles", () => {
    render(<CategoryGrid locale="en" categories={[]} />);

    expect(
      screen.getByText("No service categories are published yet."),
    ).toBeInTheDocument();
  });
});
```

`frontend/src/components/directory/ProfessionalCard.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ProfessionalResultCard from "@/components/directory/ProfessionalCard";
import type { ProfessionalCard } from "@/lib/api/directory";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

function professional(overrides: Partial<ProfessionalCard> = {}): ProfessionalCard {
  return {
    id: "1",
    slug: "ocean-legal",
    display_name: "Ocean Legal",
    short_description: "Maritime contracts",
    city: "Livorno",
    region: "Toscana",
    country_code: "IT",
    service_area: ["IT-52"],
    categories: [{ slug: "legal", name: "Legal" }],
    active_service_count: 2,
    url: "/services/professionals/ocean-legal/",
    ...overrides,
  };
}

describe("ProfessionalResultCard", () => {
  it("links to the canonical professional URL", () => {
    render(<ProfessionalResultCard locale="en" professional={professional()} />);

    expect(screen.getByRole("link", { name: "Ocean Legal" })).toHaveAttribute(
      "href",
      "/services/professionals/ocean-legal/",
    );
  });

  it("shows the categories the provider actually offers", () => {
    render(<ProfessionalResultCard locale="en" professional={professional()} />);

    expect(screen.getByText("Legal")).toBeInTheDocument();
  });

  it("omits the location line entirely when no location is recorded", () => {
    render(
      <ProfessionalResultCard
        locale="en"
        professional={professional({ city: "", region: "" })}
      />,
    );

    expect(screen.queryByTestId("professional-location")).not.toBeInTheDocument();
  });

  it("renders no contact details", () => {
    const { container } = render(
      <ProfessionalResultCard locale="en" professional={professional()} />,
    );

    expect(container.textContent).not.toMatch(/@/);
    expect(container.querySelector('a[href^="tel:"]')).toBeNull();
    expect(container.querySelector('a[href^="mailto:"]')).toBeNull();
  });
});
```

`frontend/src/components/directory/DirectorySearchForm.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DirectorySearchForm from "@/components/directory/DirectorySearchForm";

const categories = [
  { slug: "legal", name: "Legal" },
  { slug: "insurance", name: "Insurance" },
];

describe("DirectorySearchForm", () => {
  it("submits as a GET to the canonical directory URL so filters stay shareable", () => {
    const { container } = render(
      <DirectorySearchForm locale="en" categories={categories} current={{}} />,
    );
    const form = container.querySelector("form")!;

    expect(form.getAttribute("method")).toBe("get");
    expect(form.getAttribute("action")).toBe("/services/professionals/");
  });

  it("reflects the current filter values back into the controls", () => {
    render(
      <DirectorySearchForm
        locale="en"
        categories={categories}
        current={{ q: "survey", category: "legal", location: "Livorno", sort: "alphabetical" }}
      />,
    );

    expect(screen.getByLabelText("Search")).toHaveValue("survey");
    expect(screen.getByLabelText("Location")).toHaveValue("Livorno");
    expect(screen.getByLabelText("Category")).toHaveValue("legal");
    expect(screen.getByLabelText("Sort")).toHaveValue("alphabetical");
  });

  it("offers an all-categories option built from real records", () => {
    render(<DirectorySearchForm locale="en" categories={categories} current={{}} />);

    expect(screen.getByRole("option", { name: "All categories" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Insurance" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Record the page's failing HTTP state**

The page is an async server component, so this is its failing test — see the ruling above. Build and serve what exists so far (Tasks 11–13 only), with the backend running on 8020 and the rollout flag enabled:

```bash
pnpm build
pnpm start --port 3020
```

In a second terminal:

```bash
curl -s -o /dev/null -w "directory %{http_code}
" http://127.0.0.1:3020/services/professionals/
```

Expected now: `404` — the route does not exist yet. Record it. Step 7 runs the identical command and expects `200`. If this prints anything other than `404`, something already serves that path and must be found before continuing (spec §39 forbids a second directory page).

- [ ] **Step 3: Run the component tests to verify they fail**

```bash
pnpm test
```

Expected: all three new test files fail to resolve the component they import. Together with Step 2's `404`, every deliverable in this task is now observed failing before any of it is written.

- [ ] **Step 4: Write the three components**

`frontend/src/components/directory/CategoryGrid.tsx`:

```tsx
import Link from "next/link";

import type { ServiceCategory } from "@/lib/api/directory";
import { type Locale, t } from "@/lib/i18n/directory";

export default function CategoryGrid({
  locale,
  categories,
}: {
  locale: Locale;
  categories: ServiceCategory[];
}) {
  if (categories.length === 0) {
    return (
      <p className="font-body-md text-on-surface-variant">
        {t(locale, "directory.categories.empty")}
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-space-md sm:grid-cols-2 lg:grid-cols-3">
      {categories.map((category) => (
        <li key={category.id}>
          <Link
            href={`/services/professionals/?category=${encodeURIComponent(category.slug)}`}
            className="block h-full rounded-xl border border-outline-variant bg-surface-container-lowest p-space-md hover:border-secondary"
          >
            <span className="font-title-lg text-title-lg text-primary">{category.name}</span>
            {category.description ? (
              <span className="mt-space-xs block font-body-sm text-on-surface-variant">
                {category.description}
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

`frontend/src/components/directory/ProfessionalCard.tsx`:

```tsx
import Link from "next/link";

import type { ProfessionalCard } from "@/lib/api/directory";
import type { Locale } from "@/lib/i18n/directory";

export default function ProfessionalResultCard({
  professional,
}: {
  locale: Locale;
  professional: ProfessionalCard;
}) {
  // No contact details are rendered because none are in the payload: contact
  // data is Phase 7's ContactAccessService (spec 1, spec 14.2).
  const location = [professional.city, professional.region].filter(Boolean).join(", ");

  return (
    <article className="flex h-full flex-col rounded-xl border border-outline-variant bg-surface-container-lowest p-space-md">
      <h3 className="font-title-lg text-title-lg text-primary">
        <Link href={professional.url}>{professional.display_name}</Link>
      </h3>
      {location ? (
        <p
          data-testid="professional-location"
          className="mt-space-xs font-body-sm text-on-surface-variant"
        >
          {location}
        </p>
      ) : null}
      {professional.short_description ? (
        <p className="mt-space-sm font-body-md text-on-surface">
          {professional.short_description}
        </p>
      ) : null}
      {professional.categories.length > 0 ? (
        <ul className="mt-space-sm flex flex-wrap gap-space-xs">
          {professional.categories.map((category) => (
            <li
              key={category.slug}
              className="rounded-lg bg-secondary-container px-space-sm py-space-xs font-body-sm text-on-secondary-container"
            >
              {category.name}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
```

`frontend/src/components/directory/DirectorySearchForm.tsx`:

```tsx
import type { CategoryRef } from "@/lib/api/directory";
import { type Locale, t } from "@/lib/i18n/directory";

export interface DirectoryFilters {
  q?: string;
  category?: string;
  location?: string;
  sort?: string;
}

export default function DirectorySearchForm({
  locale,
  categories,
  current,
}: {
  locale: Locale;
  categories: CategoryRef[];
  current: DirectoryFilters;
}) {
  // A native GET form: every filter lands in the query string, so the URL is
  // shareable and the Back button restores the previous result set without
  // any client-side state (spec 29.4).
  return (
    <form
      method="get"
      action="/services/professionals/"
      className="grid grid-cols-1 gap-space-sm md:grid-cols-5"
    >
      <label className="flex flex-col gap-space-xs font-body-sm text-on-surface-variant md:col-span-2">
        {t(locale, "directory.search.text")}
        <input
          type="search"
          name="q"
          defaultValue={current.q ?? ""}
          className="rounded-lg border border-outline-variant bg-surface px-space-sm py-space-xs font-body-md text-on-surface"
        />
      </label>
      <label className="flex flex-col gap-space-xs font-body-sm text-on-surface-variant">
        {t(locale, "directory.search.category")}
        <select
          name="category"
          defaultValue={current.category ?? ""}
          className="rounded-lg border border-outline-variant bg-surface px-space-sm py-space-xs font-body-md text-on-surface"
        >
          <option value="">{t(locale, "directory.search.category.all")}</option>
          {categories.map((category) => (
            <option key={category.slug} value={category.slug}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-space-xs font-body-sm text-on-surface-variant">
        {t(locale, "directory.search.location")}
        <input
          type="text"
          name="location"
          defaultValue={current.location ?? ""}
          className="rounded-lg border border-outline-variant bg-surface px-space-sm py-space-xs font-body-md text-on-surface"
        />
      </label>
      <label className="flex flex-col gap-space-xs font-body-sm text-on-surface-variant">
        {t(locale, "directory.search.sort")}
        <select
          name="sort"
          defaultValue={current.sort ?? "recommended"}
          className="rounded-lg border border-outline-variant bg-surface px-space-sm py-space-xs font-body-md text-on-surface"
        >
          <option value="recommended">{t(locale, "directory.sort.recommended")}</option>
          <option value="alphabetical">{t(locale, "directory.sort.alphabetical")}</option>
        </select>
      </label>
      <button
        type="submit"
        className="rounded-lg bg-primary px-space-md py-space-sm font-label-md text-label-md text-on-primary md:col-span-5 md:justify-self-start"
      >
        {t(locale, "directory.search.submit")}
      </button>
    </form>
  );
}
```

- [ ] **Step 5: Write the page**

`frontend/src/app/services/professionals/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import CategoryGrid from "@/components/directory/CategoryGrid";
import DirectorySearchForm from "@/components/directory/DirectorySearchForm";
import ProfessionalResultCard from "@/components/directory/ProfessionalCard";
import { fetchProfessionals, fetchServiceCategories } from "@/lib/api/directory";
import { DEFAULT_LOCALE, t } from "@/lib/i18n/directory";

export const dynamic = "force-dynamic";

// Spec 1: canonical combined URL.
const CANONICAL_PATH = "/services/professionals/";

export function generateMetadata(): Metadata {
  return {
    title: t(DEFAULT_LOCALE, "directory.services_professionals.title"),
    description: t(DEFAULT_LOCALE, "directory.intro"),
    alternates: { canonical: CANONICAL_PATH },
  };
}

// Next 16: searchParams is a Promise. Verify against
// node_modules/next/dist/docs/ before changing this signature.
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CombinedDirectoryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const locale = DEFAULT_LOCALE;
  const filters = {
    q: first(params.q),
    category: first(params.category),
    location: first(params.location),
    sort: first(params.sort),
    page: first(params.page),
  };

  const [categories, results] = await Promise.all([
    fetchServiceCategories(locale),
    fetchProfessionals(filters, locale),
  ]);

  // Spec 35.1: the flag gates frontend exposure, not just the API. Either
  // endpoint answering 404 means combined_services_professionals is off, so
  // the whole page stops existing — exactly what the detail page and the six
  // SEO pages already do, and what Task 6's CombinedDirectoryEnabled docstring
  // assumes ("the Next.js pages already handle 404"). An empty array here is a
  // different thing entirely and still renders the real empty state below.
  if (categories === null || results === null) {
    notFound();
  }

  const seoCategories = categories.filter((category) => category.has_seo_page);

  return (
    <main className="mx-auto max-w-[1440px] px-margin-mobile py-space-xl md:px-margin-desktop">
      <section aria-labelledby="directory-title">
        <h1
          id="directory-title"
          className="font-headline-md text-headline-md text-primary"
        >
          {t(locale, "directory.services_professionals.title")}
        </h1>
        <p className="mt-space-sm max-w-2xl font-body-md text-on-surface-variant">
          {t(locale, "directory.intro")}
        </p>
        <div className="mt-space-lg">
          <DirectorySearchForm
            locale={locale}
            categories={categories.map((category) => ({
              slug: category.slug,
              name: category.name,
            }))}
            current={filters}
          />
        </div>
      </section>

      {/* Spec 14.1 item 4's optional advertisement interstitial is deliberately
          absent: no advertisement model exists, and spec 2.1 forbids inventing
          one. The advertising phase owns it. */}

      <section aria-labelledby="categories-heading" className="mt-space-2xl">
        <h2
          id="categories-heading"
          className="font-title-lg text-title-lg text-primary"
        >
          {t(locale, "directory.categories.heading")}
        </h2>
        <div className="mt-space-md">
          <CategoryGrid locale={locale} categories={categories} />
        </div>
      </section>

      <section aria-labelledby="results-heading" className="mt-space-2xl">
        <h2 id="results-heading" className="font-title-lg text-title-lg text-primary">
          {t(locale, "directory.results.heading")}{" "}
          <span className="font-body-md text-on-surface-variant">
            ({results.count} {t(locale, "directory.results.count")})
          </span>
        </h2>
        {results.results.length === 0 ? (
          <p className="mt-space-md font-body-md text-on-surface-variant">
            {t(locale, "directory.results.empty")}
          </p>
        ) : (
          <ul className="mt-space-md grid grid-cols-1 gap-space-md sm:grid-cols-2 lg:grid-cols-4">
            {results.results.map((professional) => (
              <li key={professional.id}>
                <ProfessionalResultCard locale={locale} professional={professional} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {seoCategories.length > 0 ? (
        <section aria-labelledby="seo-heading" className="mt-space-2xl">
          <h2 id="seo-heading" className="font-title-lg text-title-lg text-primary">
            {t(locale, "directory.seo.heading")}
          </h2>
          <ul className="mt-space-md flex flex-wrap gap-space-md">
            {seoCategories.map((category) => (
              <li key={category.id}>
                <Link
                  href={category.url ?? `/services/${category.slug}/`}
                  className="font-body-md text-secondary underline"
                >
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
```

**Note (`export const dynamic = "force-dynamic"`):** the page reads live filter parameters and staff-editable content, and `directoryFetch` already sends `cache: "no-store"`. Declaring the route dynamic makes that explicit rather than relying on Next inferring it from the fetch options, and keeps a filtered result set from being statically cached at build time.

- [ ] **Step 6: Run the tests, lint and build**

```bash
pnpm test
pnpm lint
pnpm build
```

Expected: the 3 `CategoryGrid` tests, 4 `ProfessionalResultCard` tests and 3 `DirectorySearchForm` tests `PASS` alongside every earlier suite; lint clean; build succeeds.

- [ ] **Step 7: Verify the page now answers 200 and renders real records**

Re-run the exact command from Step 2, with the backend on 8020 and at least one ACTIVE professional and one active category in the database:

```bash
pnpm build
pnpm start --port 3020
```

```bash
curl -s -o /dev/null -w "directory %{http_code}
" http://127.0.0.1:3020/services/professionals/
curl -s http://127.0.0.1:3020/services/professionals/ | grep -c "Nautical Services &amp; Professionals"
curl -s -o /dev/null -w "filtered  %{http_code}
" "http://127.0.0.1:3020/services/professionals/?category=legal&sort=alphabetical"
```

Expected: `200` (was `404` in Step 2 — that is the red-to-green transition for this deliverable), at least `1` for the spec §1 H1, and `200` for the filtered URL. Then disable the `combined_services_professionals` flag in Django admin and confirm the first command prints `404`, and re-enable it.

- [ ] **Step 8: Commit**

```bash
cd ..
git add frontend
git commit -m "feat(frontend): add the combined Services / Professionals directory page"
```

---

### Task 15: Frontend — the professional detail page

**Files:**
- Create: `frontend/src/components/directory/ProfileMonogram.tsx` + `.test.tsx`
- Create: `frontend/src/app/services/professionals/[slug]/page.tsx`

**Interfaces:**
- Consumes: `fetchProfessional`, the `ProfessionalDetail` type (Task 12); `t`, `DEFAULT_LOCALE` (Task 13).
- Produces:
  - `<ProfileMonogram name />` — a deterministic initials monogram.
  - Route `/services/professionals/<slug>/` with `generateMetadata` emitting the canonical URL, and `notFound()` for any slug the API does not serve.
  - Two named seam comments marking where Phase 6 and Phase 7 mount their components.

**Note (ruling — what is on this page and what is not):** spec §14.2 lists nine sections. Seven are built here from real records: identity header (logo/photo slot, name, primary categories, location/service area), the short profile-status line, About, Services offered, Service area, and Related professionals. Two are **not** built and are marked with a named comment instead of a stand-in: the shared inquiry form (Phase 6 — spec §39 forbids a context-specific copy) and the blurred contact panel (Phase 7 — spec §39 forbids hiding prohibited fields with CSS, and the API payload does not contain contact data to blur). Portfolio/gallery is omitted entirely, since spec §14.2 permits it "only when real backend records exist" and no media model does. Spec §14.2's closing prohibition is honoured by omission: there is no revenue figure, response guarantee, bank/registry affiliation, personal biography, transaction volume or certification claim anywhere on this page, because no such field exists in the payload to render.

**Note (ruling — the monogram is derived, not fabricated):** `ProfessionalProfile` has no logo or photo field (Phase 3 Task 6), so the identity header's image slot renders initials computed from `display_name` in a CSS-styled circle. It displays a real field in a different visual form, which is categorically different from shipping a stock photo or a fake badge. When the media phase adds a real logo field, this component is what it replaces.

**Note (ruling — the status line says only what the data supports):** the page is only ever rendered for a profile the API served, and the API serves only `status=ACTIVE`. The `professional.status.active` string therefore states that the profile is listed and staff-reviewed, and explicitly says NAUTA is not a licensing body — satisfying spec §14.2's "short verified/profile status language without implying government certification" while remaining a true statement about a real field.

**Note (`notFound()` covers four cases at once):** unknown slug, DRAFT, PENDING and SUSPENDED all come back as a 404 from Task 8's endpoint, which `directoryFetch` turns into `null`. One `if (!professional) notFound()` therefore implements all four without the page ever needing to know a profile's status.

**Note (ruling — how the page itself is test-driven):** same as Task 14's, for the same reason: `page.tsx` is an async server component and Vitest/jsdom cannot render one honestly. `ProfileMonogram` carries unit tests; the page is driven by an HTTP check against a real running stack, recorded failing in Step 2 and passing in Step 6. Do not skip Step 2 on the grounds that the answer is obvious — the point is the recorded transition, and it is also what catches a route accidentally shadowed by the static `/services/professionals/` segment.

- [ ] **Step 1: Write the failing monogram test**

`frontend/src/components/directory/ProfileMonogram.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ProfileMonogram from "@/components/directory/ProfileMonogram";

describe("ProfileMonogram", () => {
  it("uses the first letters of the first two words", () => {
    render(<ProfileMonogram name="Ocean Legal" />);

    expect(screen.getByText("OL")).toBeInTheDocument();
  });

  it("falls back to a single letter for a one-word name", () => {
    render(<ProfileMonogram name="Nauticare" />);

    expect(screen.getByText("N")).toBeInTheDocument();
  });

  it("is decorative and hidden from assistive technology", () => {
    const { container } = render(<ProfileMonogram name="Ocean Legal" />);

    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("renders nothing meaningful for an empty name rather than crashing", () => {
    render(<ProfileMonogram name="   " />);

    expect(screen.getByTestId("profile-monogram").textContent).toBe("");
  });
});
```

- [ ] **Step 2: Run the monogram test and record the page's failing HTTP state**

```bash
cd frontend
pnpm test ProfileMonogram
```

Expected: `Failed to resolve import "@/components/directory/ProfileMonogram"`.

Then the page's own failing test — see the ruling above. With the Task 14 build still serving (`pnpm build && pnpm start --port 3020`), the backend on 8020, the rollout flag enabled and one ACTIVE professional seeded by hand:

```bash
curl -s -o /dev/null -w "detail   %{http_code}\n" http://127.0.0.1:3020/services/professionals/ocean-legal/
curl -s -o /dev/null -w "unknown  %{http_code}\n" http://127.0.0.1:3020/services/professionals/no-such-provider/
```

Expected now: `404` and `404` — the dynamic route does not exist yet, so even the real slug misses. Record both. Step 6 runs the identical commands and expects `200` and `404`: the second one must stay `404` for a different reason afterwards, which is exactly what makes the pair worth recording rather than just the first.

- [ ] **Step 3: Write the monogram**

`frontend/src/components/directory/ProfileMonogram.tsx`:

```tsx
export default function ProfileMonogram({ name }: { name: string }) {
  // ProfessionalProfile has no logo/photo field yet (Phase 3, Task 6) and
  // spec 2.1 forbids inventing one, so the identity header's image slot shows
  // initials derived from a real field.
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <span
      aria-hidden="true"
      data-testid="profile-monogram"
      className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary-container font-title-lg text-title-lg text-on-primary-container"
    >
      {initials}
    </span>
  );
}
```

- [ ] **Step 4: Write the detail page**

`frontend/src/app/services/professionals/[slug]/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import ProfileMonogram from "@/components/directory/ProfileMonogram";
import { fetchProfessional } from "@/lib/api/directory";
import { DEFAULT_LOCALE, t } from "@/lib/i18n/directory";

export const dynamic = "force-dynamic";

// Next 16: params is a Promise. Verify against node_modules/next/dist/docs/
// before changing this signature.
type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const professional = await fetchProfessional(slug, DEFAULT_LOCALE);
  if (!professional) {
    return { title: t(DEFAULT_LOCALE, "directory.services_professionals.title") };
  }
  return {
    title: professional.display_name,
    description: professional.short_description || undefined,
    // Spec 1: /services/professionals/<professional-slug>/ is the canonical URL.
    alternates: { canonical: professional.url },
  };
}

export default async function ProfessionalDetailPage({ params }: { params: Params }) {
  const { slug } = await params;
  const locale = DEFAULT_LOCALE;
  const professional = await fetchProfessional(slug, locale);

  // Unknown slug, DRAFT, PENDING and SUSPENDED all arrive here as null.
  if (!professional) {
    notFound();
  }

  const location = [professional.city, professional.region].filter(Boolean).join(", ");

  return (
    <main className="mx-auto max-w-[1440px] px-margin-mobile py-space-xl md:px-margin-desktop">
      <div className="grid grid-cols-1 gap-space-xl lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div>
          <header className="flex items-start gap-space-md">
            <ProfileMonogram name={professional.display_name} />
            <div>
              <h1 className="font-headline-md text-headline-md text-primary">
                {professional.display_name}
              </h1>
              {professional.categories.length > 0 ? (
                <ul className="mt-space-xs flex flex-wrap gap-space-xs">
                  {professional.categories.map((category) => (
                    <li
                      key={category.slug}
                      className="rounded-lg bg-secondary-container px-space-sm py-space-xs font-body-sm text-on-secondary-container"
                    >
                      <Link
                        href={`/services/professionals/?category=${encodeURIComponent(category.slug)}`}
                      >
                        {category.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
              {location ? (
                <p className="mt-space-xs font-body-md text-on-surface-variant">{location}</p>
              ) : null}
              {/* The one-line summary is rendered, not metadata-only: it is in
                  the payload and spec 2.1 wants every real field a visitor
                  would expect to see on the page, not just in <head>. */}
              {professional.short_description ? (
                <p className="mt-space-sm max-w-xl font-body-md text-on-surface">
                  {professional.short_description}
                </p>
              ) : null}
              <p className="mt-space-sm max-w-xl font-body-sm text-on-surface-variant">
                {t(locale, "professional.status.active")}
              </p>
            </div>
          </header>

          {professional.description ? (
            <section aria-labelledby="about-heading" className="mt-space-xl">
              <h2 id="about-heading" className="font-title-lg text-title-lg text-primary">
                {t(locale, "professional.about.heading")}
              </h2>
              <p className="mt-space-sm whitespace-pre-line font-body-md text-on-surface">
                {professional.description}
              </p>
            </section>
          ) : null}

          {professional.services.length > 0 ? (
            <section aria-labelledby="services-heading" className="mt-space-xl">
              <h2 id="services-heading" className="font-title-lg text-title-lg text-primary">
                {t(locale, "professional.services.heading")}
              </h2>
              <ul className="mt-space-md space-y-space-md">
                {professional.services.map((service) => (
                  <li
                    key={service.id}
                    className="rounded-xl border border-outline-variant p-space-md"
                  >
                    <h3 className="font-title-lg text-title-lg text-on-surface">
                      {service.title}
                    </h3>
                    <p className="mt-space-xs font-body-sm text-on-surface-variant">
                      {service.category.name}
                    </p>
                    {service.description ? (
                      <p className="mt-space-sm font-body-md text-on-surface">
                        {service.description}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {professional.service_area.length > 0 ? (
            <section aria-labelledby="area-heading" className="mt-space-xl">
              <h2 id="area-heading" className="font-title-lg text-title-lg text-primary">
                {t(locale, "professional.service_area.heading")}
              </h2>
              <ul className="mt-space-sm flex flex-wrap gap-space-xs">
                {professional.service_area.map((area) => (
                  <li
                    key={area}
                    className="rounded-lg border border-outline-variant px-space-sm py-space-xs font-body-sm text-on-surface-variant"
                  >
                    {area}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* PHASE 6 SEAM — the shared InquiryForm mounts here.
              Spec 14.2 requires a shared inquiry form on this page and spec
              15.1/39 forbid a professional-specific copy, so Phase 6 renders
              <InquiryForm context={{ type: "PROFESSIONAL", id: professional.id }} />
              at this position. Nothing is rendered in the meantime: a
              non-functional form would be the visual-only implementation
              spec 39 prohibits. */}
        </div>

        <aside>
          {/* PHASE 7 SEAM — the contact panel governed by ContactAccessService
              mounts here, as <ContactPanel targetType="PROFESSIONAL"
              targetId={professional.id} />. It is not rendered now and no
              contact data reaches this page: public_email, public_phone and
              website_url are absent from the API payload by design, so there is
              nothing to blur and nothing to leak (spec 1, spec 39). */}

          {/* Portfolio/gallery is absent: spec 14.2 permits it "only when real
              backend records exist" and no media model exists yet (Phase 15). */}

          {professional.related.length > 0 ? (
            <section aria-labelledby="related-heading">
              <h2 id="related-heading" className="font-title-lg text-title-lg text-primary">
                {t(locale, "professional.related.heading")}
              </h2>
              <ul className="mt-space-md space-y-space-sm">
                {professional.related.map((peer) => (
                  <li
                    key={peer.slug}
                    className="rounded-xl border border-outline-variant p-space-md"
                  >
                    <Link
                      href={peer.url}
                      className="font-body-md text-secondary underline"
                    >
                      {peer.display_name}
                    </Link>
                    {peer.city ? (
                      <p className="mt-space-xs font-body-sm text-on-surface-variant">
                        {peer.city}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Run the tests, lint and build**

```bash
pnpm test
pnpm lint
pnpm build
```

Expected: the 4 `ProfileMonogram` tests `PASS` alongside every earlier suite; lint clean; build succeeds.

- [ ] **Step 6: Verify the page now answers 200, and check the two seams and the no-contact-data rule**

Re-run the exact pair from Step 2, with both servers running and the same ACTIVE professional in the database:

```bash
pnpm build
pnpm start --port 3020
```

```bash
curl -s -o /dev/null -w "detail   %{http_code}\n" http://127.0.0.1:3020/services/professionals/ocean-legal/
curl -s -o /dev/null -w "unknown  %{http_code}\n" http://127.0.0.1:3020/services/professionals/no-such-provider/
curl -s "http://127.0.0.1:3020/services/professionals/ocean-legal/" | grep -ci "mailto:\|tel:\|@example"
```

Expected: `200` (was `404` in Step 2 — the red-to-green transition for this deliverable), then `404` for the unknown slug, then `0` for the contact grep. Also confirm a DRAFT or SUSPENDED profile's slug returns `404`. Then open the page in a browser and confirm: the identity header, the one-line summary, status line, About, Services offered, Service area and Related professionals render; there is **no** inquiry form, **no** contact panel and **no** gallery.

- [ ] **Step 7: Commit**

```bash
cd ..
git add frontend
git commit -m "feat(frontend): add the professional detail page with Phase 6/7 seams"
```

---

### Task 16: Frontend — the six SEO service pages and the canonical sitemap

**Files:**
- Create: `frontend/src/app/services/[categorySlug]/page.tsx`
- Create: `frontend/src/app/sitemap.ts`
- Modify: `frontend/src/lib/api/directory.ts` (add `page_size` to `ProfessionalSearch`), `frontend/.env.local.example` (add `NEXT_PUBLIC_BASE_URL`)

**Interfaces:**
- Consumes: `fetchServiceCategory`, `fetchServiceCategories`, `fetchProfessionals`, `EMPTY_PROFESSIONAL_PAGE` (Task 12); `t`, `DEFAULT_LOCALE` (Task 13).
- Produces:
  - Route `/services/<category-slug>/` — renders any category with `has_seo_page === true`, `notFound()` otherwise; `generateMetadata` emits the canonical URL and the record's SEO title/description when set.
  - Route `/sitemap.xml` via `frontend/src/app/sitemap.ts`, listing the combined directory, every `has_seo_page` category and every ACTIVE professional.

**Note (ruling — one template for six pages, and why `professionals` cannot be a category):** spec §11.2 is explicit that the six SEO pages "are not separate hard-coded templates with divergent data models". One dynamic route renders all six from their `ServiceCategory` rows. The static `/services/professionals/` segment takes precedence over this dynamic sibling in the App Router, which is why Task 2 forbids `professionals` as a category slug at the validator, the database constraint and the route layer — without that guard a staff member could create a category that silently never renders.

**Note (ruling — `has_seo_page` gates the page, not the API):** the category detail endpoint (Task 6) serves any active category, because a future staff screen may need one that has no public page. The **page** 404s when `has_seo_page` is false, so exactly the six approved SEO URLs are public, per spec §1 ("the six approved individual service pages"). Adding a seventh is a staff action on a real record, not a code change.

**Note (ruling — the sitemap is generated, never a file):** spec §32.2 requires canonical URLs for the directory and professional detail, hreflang for EN/IT/ES, and that retired URLs be removed from the sitemap. A generated sitemap satisfies the last requirement structurally: `/services/` and `/professionals/` are never emitted because nothing in the database produces them, so there is no stale file to prune and no §14.3 step-5 "regenerate" chore to forget. `hreflang` alternates are **not** emitted yet — there are no per-locale URLs to point at until locale routing exists, and emitting three `hreflang` values that all resolve to the same URL would be a worse SEO signal than emitting none. Recorded in Known Limitations for the phase that adds locale routing.

**Note (sitemap size):** the sitemap requests `page_size=48` (Task 7's `max_page_size`) and walks pages until `next` is null. With the directory's realistic size this is a handful of requests; if the professional count ever reaches the 50,000-URL sitemap limit, the performance phase splits it into a sitemap index.

- [ ] **Step 1: Record the failing state**

Both deliverables here are async server components that fetch from the API on every request. Phase 3 introduced Vitest for client components with jsdom; it gives no harness for rendering an async server component, and mocking `fetch` to assert on JSX would test the mock rather than the page. These two routes are therefore driven by an HTTP check against a real running stack — the same shape Phase 4's Task 8 used for its endpoints, and the same one Tasks 14 and 15 use for their pages — run **before** the implementation to confirm it fails and again in Step 5 to confirm it passes.

With the previous build still serving (`pnpm build && pnpm start --port 3020` from Task 15):

```bash
curl -s -o /dev/null -w "legal %{http_code}\n" http://127.0.0.1:3020/services/legal/
curl -s -o /dev/null -w "not-a-category %{http_code}\n" http://127.0.0.1:3020/services/not-a-category/
curl -s -o /dev/null -w "sitemap %{http_code}\n" http://127.0.0.1:3020/sitemap.xml
```

Expected now: `404`, `404`, `404` — none of the three routes exists yet. Step 5 expects `200`, `404`, `200`.

- [ ] **Step 2: Write the SEO category page**

`frontend/src/app/services/[categorySlug]/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import ProfessionalResultCard from "@/components/directory/ProfessionalCard";
import {
  EMPTY_PROFESSIONAL_PAGE,
  fetchProfessionals,
  fetchServiceCategory,
} from "@/lib/api/directory";
import { DEFAULT_LOCALE, t } from "@/lib/i18n/directory";

export const dynamic = "force-dynamic";

// Next 16: params is a Promise. Verify against node_modules/next/dist/docs/.
type Params = Promise<{ categorySlug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { categorySlug } = await params;
  const category = await fetchServiceCategory(categorySlug, DEFAULT_LOCALE);
  if (!category || !category.has_seo_page) {
    return {};
  }
  return {
    title: category.seo_title || category.name,
    description: category.seo_description || undefined,
    // Spec 1: the six approved service pages keep their own canonical URLs.
    alternates: { canonical: `/services/${category.slug}/` },
  };
}

export default async function ServiceCategoryPage({ params }: { params: Params }) {
  const { categorySlug } = await params;
  const locale = DEFAULT_LOCALE;
  const category = await fetchServiceCategory(categorySlug, locale);

  // Only the approved SEO categories are public pages (spec 1). An active
  // category without has_seo_page is a filter value, not a URL.
  if (!category || !category.has_seo_page) {
    notFound();
  }

  // The flag-off case already 404ed above (fetchServiceCategory returned null),
  // so a null here can only be a race with a flag flip mid-render: degrade to
  // the empty state rather than throwing.
  const results =
    (await fetchProfessionals({ category: category.slug }, locale)) ??
    EMPTY_PROFESSIONAL_PAGE;

  return (
    <main className="mx-auto max-w-[1440px] px-margin-mobile py-space-xl md:px-margin-desktop">
      <h1 className="font-headline-md text-headline-md text-primary">{category.name}</h1>
      {category.description ? (
        <p className="mt-space-sm max-w-2xl whitespace-pre-line font-body-md text-on-surface">
          {category.description}
        </p>
      ) : null}

      <p className="mt-space-lg">
        <Link
          href={`/services/professionals/?category=${encodeURIComponent(category.slug)}`}
          className="font-body-md text-secondary underline"
        >
          {t(locale, "category.browse_professionals")}
        </Link>
      </p>

      <section aria-labelledby="category-results-heading" className="mt-space-2xl">
        <h2
          id="category-results-heading"
          className="font-title-lg text-title-lg text-primary"
        >
          {t(locale, "directory.results.heading")}
        </h2>
        {results.results.length === 0 ? (
          <p className="mt-space-md font-body-md text-on-surface-variant">
            {t(locale, "directory.results.empty")}
          </p>
        ) : (
          <ul className="mt-space-md grid grid-cols-1 gap-space-md sm:grid-cols-2 lg:grid-cols-4">
            {results.results.map((professional) => (
              <li key={professional.id}>
                <ProfessionalResultCard locale={locale} professional={professional} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Write the sitemap**

`frontend/src/app/sitemap.ts`:

```ts
import type { MetadataRoute } from "next";

import {
  fetchProfessionals,
  fetchServiceCategories,
  type ProfessionalCard,
} from "@/lib/api/directory";
import { DEFAULT_LOCALE } from "@/lib/i18n/directory";

export const dynamic = "force-dynamic";

const PUBLIC_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "http://127.0.0.1:3020";

async function allProfessionals(): Promise<ProfessionalCard[]> {
  const collected: ProfessionalCard[] = [];
  let page = 1;
  // Task 7's max_page_size is 48.
  for (;;) {
    const batch = await fetchProfessionals(
      { page: String(page), page_size: "48" },
      DEFAULT_LOCALE,
    );
    // null = the rollout flag is off; there is nothing public to list.
    if (batch === null) {
      return collected;
    }
    collected.push(...batch.results);
    if (!batch.next) {
      return collected;
    }
    page += 1;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, professionals] = await Promise.all([
    fetchServiceCategories(DEFAULT_LOCALE),
    allProfessionals(),
  ]);

  // With the flag off the directory has no public URLs at all, so the sitemap
  // is empty rather than advertising a page that now 404s.
  if (categories === null) {
    return [];
  }

  // /services/ and /professionals/ are never emitted: nothing in the database
  // produces them, so the retired URLs are absent by construction (spec 32.2).
  return [
    {
      url: `${PUBLIC_BASE_URL}/services/professionals/`,
      changeFrequency: "daily",
      priority: 1,
    },
    ...categories
      .filter((category) => category.has_seo_page)
      .map((category) => ({
        url: `${PUBLIC_BASE_URL}/services/${category.slug}/`,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
    ...professionals.map((professional) => ({
      url: `${PUBLIC_BASE_URL}${professional.url}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
```

**Note (`page_size`):** `ProfessionalSearch` (Task 12) does not declare `page_size`, because no page needed it — only the sitemap does. Step 4 adds the one-line `page_size?: string;` to that interface. Do **not** paper over the type error with a cast: `as never`/`as any` in this position would hide a real contract change from the next reader.

**Note (`NEXT_PUBLIC_BASE_URL`):** a sitemap needs absolute URLs. Add `NEXT_PUBLIC_BASE_URL=http://127.0.0.1:3020` to `frontend/.env.local.example` (and the CI environment if the build reads it) in this task, alongside the existing `NEXT_PUBLIC_API_BASE_URL`. Phase 0/1 already established that pattern for the API base URL.

- [ ] **Step 4: Extend `ProfessionalSearch` with `page_size`**

In `frontend/src/lib/api/directory.ts`, replace the `ProfessionalSearch` interface with:

```ts
export interface ProfessionalSearch {
  q?: string;
  category?: string;
  location?: string;
  sort?: string;
  page?: string;
  page_size?: string;
}
```

`query()` already forwards any key it is given, so no other change is needed for the sitemap's paging loop to typecheck.

- [ ] **Step 5: Verify the six pages, the 404 and the sitemap**

```bash
cd frontend
pnpm lint
pnpm build
pnpm start --port 3020
```

In a second terminal, with the backend running and at least one ACTIVE professional seeded by hand:

```bash
for slug in full-brokerage legal insurance engines-maintenance transport-delivery nautical-marketing; do
  printf "%s " "$slug"
  curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:3020/services/$slug/"
done
curl -s -o /dev/null -w "not-a-category %{http_code}\n" http://127.0.0.1:3020/services/not-a-category/
curl -s http://127.0.0.1:3020/sitemap.xml | grep -c "services/professionals"
curl -s http://127.0.0.1:3020/sitemap.xml | grep -c "<loc>.*/professionals/</loc>"
```

Expected: `200` for all six slugs; `404` for `not-a-category`; at least `1` sitemap entry containing `services/professionals`; exactly `0` entries for the retired `/professionals/` URL.

- [ ] **Step 6: Commit**

```bash
cd ..
git add frontend
git commit -m "feat(frontend): add the six SEO service pages and the generated canonical sitemap"
```

---

### Task 17: Phase 5 acceptance pass, definition-of-done evidence and handoff note

**Files:**
- Modify: `ACTIVITY.md`

**Interfaces:** none — this task verifies that Tasks 1–16 work together and records that fact. Spec §39 step 9 requires demonstrating the phase definition of done "with verifiable test output", and §39's "Required phase handoff note" fixes what the record must contain.

- [ ] **Step 1: Full backend regression against real Postgres/Redis**

```bash
docker compose up -d
cd backend
uv run python manage.py migrate
uv run python manage.py makemigrations --check --dry-run
uv run pytest -v
```

Expected: `migrate` applies `services_catalog` `0001`–`0005` cleanly on a database that already carries every earlier app's migrations; `makemigrations --check` reports no missing migrations; the whole suite passes in one run — the `services_catalog` tests from Tasks 2–10 plus every pre-existing `accounts`, `brokers`, `professionals`, `audit`, `platform_settings`, `finance`, `taxonomy` and `common` test. Record the exact final count for the handoff note.

- [ ] **Step 2: Full frontend suite**

```bash
cd ../frontend
pnpm test
pnpm lint
pnpm build
```

Expected: every Vitest suite passes (Phase 3's plus this phase's `next.config`, route handler, dictionary, `CategoryGrid`, `ProfessionalResultCard`, `DirectorySearchForm` and `ProfileMonogram` tests); lint clean; production build succeeds.

- [ ] **Step 3: Create the acceptance fixtures by hand**

With both servers running (`uv run python manage.py runserver 8020` and `pnpm start --port 3020`):

```bash
cd ../backend
PYTHONUTF8=1 PYTHONIOENCODING=utf-8 uv run python manage.py shell -c "
from django.contrib.auth import get_user_model
from professionals.enums import ProfessionalProfileStatus
from professionals.models import ProfessionalProfile
from services_catalog.models import ProfessionalService, ServiceCategory

User = get_user_model()
owner, _ = User.objects.get_or_create(email='acceptance-pro@example.com')
profile, _ = ProfessionalProfile.objects.update_or_create(
    owner_user=owner,
    defaults=dict(
        display_name='Ocean Legal',
        slug='ocean-legal',
        short_description='Maritime contracts and flag registration.',
        description='Twenty years of maritime contract work in Livorno and Palma.',
        public_email='hidden@example.com',
        public_phone='+39055000000',
        city='Livorno',
        region='Toscana',
        country_code='IT',
        service_area=['IT-52'],
        status=ProfessionalProfileStatus.ACTIVE,
    ),
)
legal = ServiceCategory.objects.get(slug='legal')
ProfessionalService.objects.get_or_create(
    professional=profile, category=legal, title_en='Sale contracts'
)
print(profile.get_absolute_url())
"
```

**Note:** the `PYTHONUTF8=1 PYTHONIOENCODING=utf-8` prefix is not optional on this machine — Phase 4's retrospective records that the console code page mangles non-ASCII input to `manage.py shell` without it.

- [ ] **Step 4: Demonstrate the four definition-of-done conditions**

Spec §14's definition of done, one command or observation each:

1. **"One combined directory exists; no duplicate index content remains."**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3020/services/professionals/
```

Expected `200`. Then confirm by inspection that no second directory page exists anywhere under `frontend/src/app/` — there is no `services/page.tsx` and no `professionals/page.tsx`, only the redirects from Task 11 and the `professionals/profile/route.ts` resolver.

2. **"Both retired directory URLs return a single-hop 301."**

```bash
curl -sI http://127.0.0.1:3020/services/ | grep -i "^HTTP\|^location"
curl -sI http://127.0.0.1:3020/professionals/ | grep -i "^HTTP\|^location"
curl -sIL http://127.0.0.1:3020/services/ | grep -ci "^HTTP"
```

Expected: `301` plus `location: /services/professionals/` for both; the third command prints `2` (one redirect, one final 200) — **any higher number is a redirect chain and a failure.** Then the legacy id form:

```bash
curl -sI "http://127.0.0.1:3020/professionals/profile/?id=ocean-legal" | grep -i "^HTTP\|^location"
curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:3020/professionals/profile/?id=no-such-provider"
```

Expected: `301` with `location: .../services/professionals/ocean-legal/`, then `404`.

3. **"Every displayed category/provider is database-backed."**

```bash
grep -rn "Ocean Legal\|Full brokerage\|Nautical marketing" frontend/src --include=*.tsx --include=*.ts | grep -v "\.test\."
```

Expected: **no matches.** Every category and provider name on every page comes from an API response; the only literal strings in the frontend are the `DIRECTORY_MESSAGES` dictionary keys' UI labels. Then deactivate a category in Django admin, reload `/services/professionals/`, and confirm its tile disappears — proving the grid reads `is_active` rather than a hard-coded list (spec §31: "hide inactive").

4. **"Professional detail is visually aligned with broker detail and contains no unsupported fields."**

The broker profile page does not exist yet (spec §29.2 is Phase 20's), so "visually aligned" is verified against the shared system both will use: the detail page's two-column grid, header rhythm, card system and Tailwind design tokens are the same ones every other page in this repo uses. **Record this explicitly in the handoff note as a partial** — the side-by-side comparison happens in Phase 20, which owns both profiles. The second half is verified now:

```bash
curl -s "http://127.0.0.1:3020/services/professionals/ocean-legal/" > /tmp/pro.html
grep -ci "mailto:\|tel:\|hidden@example.com\|+39055000000" /tmp/pro.html
grep -ci "revenue\|response guarantee\|transaction volume\|certified by" /tmp/pro.html
```

Expected: `0` for both. The first proves no contact data reaches the DOM (spec §1, §39); the second proves none of spec §14.2's prohibited invented fields are present.

- [ ] **Step 5: Verify the rollout flag actually gates the public surface**

In Django admin, set `combined_services_professionals` to disabled, then:

```bash
curl -s -o /dev/null -w "api        %{http_code}\n" http://127.0.0.1:8020/api/v1/professionals/
curl -s -o /dev/null -w "directory  %{http_code}\n" http://127.0.0.1:3020/services/professionals/
curl -s -o /dev/null -w "detail     %{http_code}\n" http://127.0.0.1:3020/services/professionals/ocean-legal/
curl -s -o /dev/null -w "seo page   %{http_code}\n" http://127.0.0.1:3020/services/legal/
curl -sI http://127.0.0.1:3020/services/ | grep -i "^HTTP"
```

Expected: `404` for all four, matching the flag row's own description. The whole public directory surface disappears when the flag is off — that is what spec §35.1's "gate frontend exposure" means, and it is what Task 6's `CombinedDirectoryEnabled` docstring already assumes when it chooses 404 over 403 ("the Next.js pages already handle 404"). The `/services/` redirect still returns `301`: it is a static `next.config.ts` rule with no database behind it, and a retired URL must keep pointing at its successor whether or not the successor is currently switched on.

Then re-enable the flag and confirm all four recover. **Do not** confuse this with the empty state: an *enabled* directory with no active categories or no matching professionals renders the spec §31 empty-state sentences and returns `200`. Only a disabled flag 404s. Test both, in that order.

- [ ] **Step 6: Update `ACTIVITY.md`**

Append a new entry at the top of the `## Log` section:

```markdown
### 2026-09-18 — Phase 5 directory consolidation complete

- Implemented `docs/superpowers/plans/2026-09-18-phase-5-directory-consolidation.md` in full (Tasks 1-17).
- New `services_catalog` Django app (ruling: spec §3 lists `professionals` and `services_catalog` as separate apps and spec §11.2 groups both catalog models under one "Service catalog" heading, so `ServiceCategory` **and** `ProfessionalService` live here, giving a single one-directional `services_catalog → professionals` dependency and leaving Phase 3's `professionals` app untouched): `ServiceCategory` (EN/IT/ES names/descriptions/SEO fields, `has_seo_page`, `display_order`, reserved-slug guard at validator + DB constraint + route level), `ProfessionalService` (FK to `ProfessionalProfile` CASCADE / `ServiceCategory` PROTECT, unique `(professional, category, title_en)`, reusing Phase 3's `validate_service_area`), and `LegacyDirectoryMapping`.
- Migrations added: `services_catalog/0001_initial` (ServiceCategory), `0002_seed_seo_service_categories` (data — the six approved SEO categories, names in three languages, **no invented copy**), `0003_professionalservice`, `0004_seed_combined_directory_flag` (data — spec §35.1's `combined_services_professionals` flag, enabled), `0005_legacydirectorymapping`. All additive; both data migrations are `get_or_create`-idempotent with `RunPython.noop` reverses so a rollback keeps staff-editable rows (spec §32.3).
- New public endpoints, all unauthenticated, rate-limited under the new `services_directory` scope (60/min) via Phase 3's `HashedIPScopedRateThrottle`, and all 404 when the rollout flag is off: `GET /api/v1/service-categories/` (unpaginated by ruling), `GET /api/v1/service-categories/<slug>/`, `GET /api/v1/professionals/` (q/category/location/sort/locale, paginated 12 per page), `GET /api/v1/professionals/<slug>/` (services + up to 4 related), `GET /api/v1/legacy/professional-redirect/?id=`.
- **No contact data is public.** `public_email`, `public_phone` and `website_url` are absent from every serializer field list in this phase, not merely hidden — so nothing to blur, nothing to leak in SSR HTML or the DOM. Phase 7's `ContactAccessService` owns all three.
- Permissions and audit: `services_catalog.permissions.CombinedDirectoryEnabled` (feature-flag gate, fails closed). **Every** `ServiceCategory` write goes through `save_service_category`/`delete_service_category`, which write `service_category.created` / `.updated` / `.deleted` `AuditEvent` rows (actor, before/after snapshot of all 17 staff-editable columns) inside the same transaction as the change — Django admin as `USER`/`ADMIN`, the legacy-import command as `SYSTEM`/`TASK`. No entry point writes the model unaudited. `ProfessionalService` admin is not audited by design — spec §31 puts it under the provider/staff profile workflow, not the audited staff catalog.
- New frontend routes: `/services/professionals/` (hero + category grid + filtered results + SEO links), `/services/professionals/<slug>/` (identity header, status line, About, Services offered, Service area, Related professionals), `/services/<category-slug>/` (one template for all six approved SEO pages, 404 unless `has_seo_page`), `/professionals/profile/` (301 resolver), `/sitemap.xml` (generated from the database). `trailingSlash: true` plus two `statusCode: 301` entries in `next.config.ts` give single-hop 301s for `/services/` and `/professionals/` — `permanent: true` was **not** used because it emits 308, not the 301 spec §4.3 fixes.
- Localization: `frontend/src/lib/i18n/directory.ts` holds every new UI string in EN/IT/ES behind spec §37 keys (including `nav.services_professionals` and `directory.services_professionals.title` verbatim). No i18n framework was introduced; pages render `en` until a phase adds locale routing.
- Feature flag state: `combined_services_professionals` created and **enabled**. It gates all four directory read endpoints (404 via `CombinedDirectoryEnabled`) **and** the public pages: `fetchServiceCategories`/`fetchProfessionals` return `null` on a 404 and every page built on them calls `notFound()`, so with the flag off `/services/professionals/`, the professional detail pages and the six `/services/<slug>/` SEO pages all return 404 and `/sitemap.xml` is empty. The two static 301 redirects are unaffected by design — a retired URL keeps pointing at its successor whether or not the successor is switched on.
- Legacy migration (spec §14.3): the mechanism exists and is fully tested — `LegacyDirectoryMapping` plus `manage.py import_legacy_directory --source <json> [--dry-run]` implementing all six steps with a reconciliation report. **It has never been run and there is no legacy data to run it on**: the prior artefact was 51 static HTML mockups with no database (see this file's design-reference notes). No sample rows were seeded and no prototype numbers were imported.
- Tests added and results: <N> backend tests across `services_catalog` and `common`, plus <M> frontend Vitest tests; full backend suite <TOTAL>/<TOTAL> green against real Postgres/Redis with `makemigrations --check` clean; `pnpm test`, `pnpm lint` and `pnpm build` green.
- Known limitations: see the plan's "Known Limitations" section — chiefly no inquiry form (Phase 6) and no contact panel (Phase 7) on the professional detail page, both marked as named seams; no advertisement interstitial (no ad model); no portfolio/gallery (no media model, Phase 15); no `hreflang` alternates in the sitemap until locale routing exists; `q` search is case- but not accent-insensitive; the `/brokers/profile/?id=` and `/dashboard/broker/services/` redirects from spec §4.3 belong to the broker and Phase 19 work.
- Screenshots for the changed UI states (directory with results, directory empty state, professional detail, an SEO service page) are attached to the phase PR per spec §39's handoff-note requirement.
- Next: Phase 6 (shared inquiry form and messaging core) — it depends on Phase 3 and this phase, and fills the first of the two seams left on the professional detail page.
```

Replace `<N>`, `<M>` and `<TOTAL>` with the real counts from Steps 1 and 2. Also update the "Current State" section to list `services_catalog` among the implemented apps and to record that `/services/professionals/` is now live.

- [ ] **Step 7: Commit**

```bash
git add ACTIVITY.md
git commit -m "docs: record phase 5 directory consolidation completion in activity log"
```

---

## Known Limitations (carried forward, not fixed by this plan)

- **No shared inquiry form on the professional detail page.** Spec §14.2 requires one; Phase 6 (spec §15) owns the single `InquiryForm` component and `InquiryService`, and spec §15.1/§39 forbid a professional-specific copy. The page carries a named seam comment at the exact mount point. Until Phase 6 lands, a visitor cannot contact a professional through the platform — which is the spec's own dependency order (§7: Phase 6 depends on Phase 5).
- **No service-request CTA on the combined directory page.** Spec §14.1's "existing approved service-request CTA" is the same service-request flow as §14.2's inquiry form: one shared `InquiryForm` / `InquiryService` that Phase 6 (spec §15) owns, and spec §15.1/§39 forbid a second, directory-specific copy. A CTA button that opened nothing, or that linked to a form that does not exist, would be exactly the visual-only implementation spec §39 prohibits, so nothing is rendered. `frontend/src/app/services/professionals/page.tsx` carries a named `PHASE 6 SEAM` comment at the hero/search section marking the mount point, matching the two seams already on the professional detail page. Until Phase 6 lands, a visitor browsing the directory has no in-platform way to request a service.
- **No contact panel, and no contact data anywhere in the payload.** Spec §14.2's blurred panel is governed by Phase 7's `ContactAccessService`. `public_email`, `public_phone` and `website_url` are excluded from every serializer here, so Phase 7 must add them to its own contact endpoint rather than un-hiding a field. `website_url` was grouped with phone and email deliberately; if Phase 7 rules a provider's own website is ungated public data, it can surface it without touching this phase's models.
- **No advertisement interstitial.** Spec §14.1 item 4 is optional and no advertisement model, table or placement exists. The advertising phase owns it; the directory page has a comment where it would go.
- **No portfolio/gallery on the professional detail page.** Spec §14.2 permits it "only when real backend records exist"; `ProfessionalProfile` has no media field and the media pipeline is Phase 15 (spec §24).
- **No logo or photo for a professional.** The identity header renders a derived initials monogram. Whichever phase adds provider media replaces `ProfileMonogram` with a real image and keeps the monogram as its fallback.
- **"Visually aligned with broker detail" is only half-verified.** Spec §14's definition of done and §29.3 require the professional profile to match the broker profile's grid, header rhythm, contact-card position, inquiry-form style and related-content card system. The broker profile page does not exist yet — spec §29.2/§29.3 are Phase 20's — so alignment is currently only "uses the same design tokens and layout primitives". Phase 20 owns the side-by-side comparison and the visual regression snapshots.
- **The §14.3 legacy import has never been run and has no data.** See the Scope ruling. If real legacy records ever appear, `manage.py import_legacy_directory` is the sanctioned path and its reconciliation report is the evidence spec §32's definition of done asks for. Until then `LegacyDirectoryMapping` is empty in every environment.
- **Two spec §4.3 redirects are not implemented here.** `/brokers/profile/?id=<legacy>` needs the broker directory, and `/dashboard/broker/services/` → `/dashboard/broker/messages/` needs the broker messages page that Phase 19 (spec §28) creates. Redirecting to a page that does not exist would replace one broken URL with another.
- **Directory text search is case-insensitive but not accent-insensitive.** `icontains` on `display_name`, `short_description` and active service titles. Accent folding needs either a stored normalized column on `ProfessionalProfile` (Phase 3's model, deliberately untouched here) or the Postgres `unaccent` extension (spec §33.3's performance phase). A search for "beneteau" will not match a provider named "Bénéteau Service".
- **No `hreflang` alternates in the sitemap or page metadata.** Spec §32.2 requires hreflang for EN/IT/ES; there are no per-locale URLs to point at until a phase introduces locale routing, and three alternates resolving to one URL would be a worse signal than none. The `?locale=` API parameter, the `resolveLocale` helper and the EN/IT/ES dictionary are all in place for that phase.
- **The directory pages render English only.** Same cause as above: no locale routing, no locale cookie, no locale segment. Every page passes `locale=en`.
- **Every visitor currently shares one `services_directory` rate-limit bucket, because SSR hides the real client IP.** All four Phase 5 pages are async server components that fetch from Django during server-side rendering, so the request Django throttles originates from the Next.js server, not from the browser: `HashedIPScopedRateThrottle` hashes the Next.js process's own address and every visitor in production lands in the same 60/min bucket. In practice that means a single busy moment on the directory can rate-limit everybody at once, while a genuinely abusive client is never isolated — the throttle is effectively a global concurrency cap rather than the per-client limit spec §30.4 intends. A fix has been identified — forward the real client IP from the Next.js layer over a trusted, spoofing-resistant channel and have the throttle read it — but it is **deliberately not done here**, because the naive version of it is worse than the bug: an unconditionally trusted forwarded-IP header lets any caller spoof an arbitrary address, which is simultaneously a throttle bypass and a way to exhaust another visitor's bucket on purpose. It is spun off as its own follow-up task so the trust boundary (which hop is authoritative, which header, how it is rejected when the request did not come through the expected proxy) gets a designed answer rather than a quick patch, and so the fix lands with adversarial tests instead of alongside unrelated work.
- **`common.text.normalize_comparison_text` duplicates `taxonomy.services.normalize_taxonomy_name`.** The new shared home is `common.text`; the merged `taxonomy` copy is deliberately untouched, because this plan does not modify already-merged apps. Collapsing the two belongs to the same cleanup pass Phase 3 queued for `taxonomy`'s view-level stock throttle classes.
- **No staff or provider API for `ProfessionalService`.** Providers cannot yet add or edit their own services except through Django admin. Spec §26 (Phase 17) owns the staff back office and the provider-facing service editor, including whatever audit that workflow needs.
- **No `ProfessionalProfile` publication gate — deferred to Phase 17, for a structural reason.** Phase 3 assigned this to Phase 5 in two places: its Task 6 note on blank-allowed descriptive fields ("The publication gate — what a profile must contain before it may reach `ACTIVE` and appear in the directory — is Phase 5's `/services/professionals/` deliverable") and its Known Limitations entry ("the rules for reaching `ACTIVE` and appearing in the directory belong to Phase 5"). This plan does **not** close it, and the reason is not a missing UI. **A publication gate is a status-transition validator on `ProfessionalProfile`, and `ProfessionalProfile` lives in `backend/professionals/` — the app this plan's own Scope ruling (point 3 under "`ServiceCategory` and `ProfessionalService` live in a new `services_catalog` app") commits to touching zero times, because Phase 3 is signed off but not yet merged and adding model logic or a migration to it from here would collide with an in-flight Phase 3 branch and mutate an already-approved app.** Every other boundary in this phase is honoured that way; the gate is not an exception carved out for convenience. Phase 17 (spec §26) owns the staff back office and the provider-facing service/profile editor, which is where the validator belongs anyway: it will already be modifying `professionals`, it can write the transition rule and the screen that explains the failure in one commit, and by then Phase 3 will be merged. Until then the directory renders whatever an ACTIVE profile actually has — omitting empty sections entirely rather than printing placeholders — and nothing prevents staff from activating a profile with no description and no services.
- **A zero-service ACTIVE profile IS listed in the directory, deliberately and by test.** This is the flip side of the deferred gate, and it is a decision, not an oversight: `test_only_active_professionals_are_listed` (Task 7) creates `active-pro` with **no** `ProfessionalService` rows and asserts it appears in `GET /api/v1/professionals/`, with `active_service_count: 0` and an empty `categories` list. Listing is keyed on `status == ACTIVE` and nothing else, so staff decide who is public and the API does not second-guess them. **Phase 17 must not silently change this.** If its publication gate makes "at least one active service" a precondition for `ACTIVE`, that is a fine rule — but it changes the contract this test pins, so Phase 17 updates the test in the same commit with a written reason, exactly as Contract rule 1 requires for the contact-field tests. Quietly filtering zero-service profiles out of the queryset instead would leave a profile that is ACTIVE in the database and invisible on the site, with no error anywhere to explain it.
- **`ProfessionalProfile.service_area` is still a JSON list, not a normalized relation.** Phase 3's Task 6 deferred the choice to this phase. This plan keeps the JSON list: the directory's location filter needs exact membership matching, which Postgres JSON containment does directly, and normalizing it would mean a migration on Phase 3's model plus a region taxonomy that nothing else in the spec asks for (YAGNI). If a future phase needs region facets or hierarchical areas, that is the trigger to normalize.

---

## Contract summary for later phases

Everything a downstream phase imports from Phase 5, in one place.

```python
from common.text import normalize_comparison_text
from services_catalog.models import (
    LegacyDirectoryMapping,
    ProfessionalService,
    ServiceCategory,
)
from services_catalog.pagination import ProfessionalDirectoryPagination
from services_catalog.permissions import COMBINED_DIRECTORY_FLAG, CombinedDirectoryEnabled
from services_catalog.serializers import (
    ProfessionalCardSerializer,
    ProfessionalDetailSerializer,
    ProfessionalServiceSerializer,
    ServiceCategoryDetailSerializer,
    ServiceCategorySerializer,
)
from services_catalog.services import (
    CATEGORY_AUDIT_FIELDS,
    DEFAULT_LOCALE,
    RESERVED_CATEGORY_SLUGS,
    SUPPORTED_LOCALES,
    category_audit_snapshot,
    delete_service_category,
    legacy_dedup_key,
    localized,
    resolve_locale,
    save_service_category,
    validate_category_slug,
)
from services_catalog.views import LocalizedContextMixin
```

```ts
// frontend
import {
  DIRECTORY_API_BASE_URL,
  EMPTY_PROFESSIONAL_PAGE,
  directoryFetch,
  fetchProfessional,
  fetchProfessionals,
  fetchServiceCategories,
  fetchServiceCategory,
  formatProfessionalLocation,
  resolveLegacyProfessional,
  type CategoryRef,
  type Locale, // declared here; lib/i18n/directory.ts re-exports this same type
  type Paginated,
  type ProfessionalCard,
  type ProfessionalDetail,
  type ProfessionalSearch,
  type ProfessionalService,
  type RelatedProfessional,
  type ServiceCategory,
  type ServiceCategoryDetail,
} from "@/lib/api/directory";
import {
  DEFAULT_LOCALE,
  DIRECTORY_MESSAGES,
  SUPPORTED_LOCALES,
  resolveLocale,
  t,
} from "@/lib/i18n/directory";
```

Rules a later phase must follow:

1. **Never add `public_email`, `public_phone` or `website_url` to `ProfessionalCardSerializer` or `ProfessionalDetailSerializer`.** Contact data is served only by Phase 7's contact endpoint, after a grant. Two tests assert their absence; if you need one of them publicly, change the rule deliberately and delete the test with a written reason, do not widen the serializer quietly.
2. **Phase 6 mounts its shared `InquiryForm` at the `PHASE 6 SEAM` comment** in `frontend/src/app/services/professionals/[slug]/page.tsx`, using the same component it mounts on broker and listing pages. Do not create a professional-specific form (spec §15.1, §39).
3. **Phase 7 mounts its contact panel at the `PHASE 7 SEAM` comment** in the same file and serves the data from its own endpoint. Blur is a server-side authorization outcome, never a CSS filter over a delivered value (spec §39).
4. **Every new directory-facing read endpoint declares `permission_classes = [AllowAny, CombinedDirectoryEnabled]` and `throttle_scope = "services_directory"`**, and never sets `throttle_classes` (Phase 3 contract rule 9).
5. **Every write to `ServiceCategory` goes through `save_service_category` / `delete_service_category` — there is no exception, including for management commands.** A future `/api/v1/staff/service-categories/` endpoint calls those functions rather than `serializer.save()`, so the audit trail stays guaranteed. A non-interactive caller is not a reason to bypass them: pass `actor=None`, `actor_type=AuditEvent.ActorType.SYSTEM` and `source=AuditEvent.Source.TASK`, which is exactly what Task 10's `import_legacy_directory` does. Adding a staff-editable column means adding it to `CATEGORY_AUDIT_FIELDS` in the same commit — Task 3's snapshot test fails otherwise.
6. **`professionals` is a permanently reserved `ServiceCategory` slug** and is enforced by a database constraint. Adding another reserved public route under `/services/` means adding its slug to `RESERVED_CATEGORY_SLUGS` **and** generating a new migration for the changed constraint.
7. **Never introduce a second directory page.** Spec §39: "Do not … Keep both Services and Professionals directories live with duplicate content." `/services/` and `/professionals/` are 301 sources in `next.config.ts` and must stay that way. **Never add a `page.tsx` at either path.** Not because it would override the redirect — it would not: Next's routing pipeline resolves `redirects()` before it reaches the filesystem router (`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/redirects.md`, verified against the installed Next 16.3.5: "Redirects are checked before the filesystem which includes pages and `/public` files"), so the existing 301 always wins and the page would simply never be reached. That is the actual hazard: such a file would be silent dead code — unreachable, wasted, and actively confusing to the next reader, who would reasonably assume a `page.tsx` renders at its own route. If a directory page is ever genuinely wanted at one of these paths, the redirect entry has to be removed deliberately in the same commit, which is the conversation spec §39 wants had out loud.
8. **`trailingSlash: true` and `statusCode: 301` in `next.config.ts` are load-bearing.** Changing either re-introduces a redirect chain or downgrades the 301 to a 308. `next.config.test.ts` guards both.
9. **New UI strings go in `DIRECTORY_MESSAGES` (or a sibling dictionary) with all three languages**, never as literals inside a component (spec §37). The dictionary test fails on a key missing any locale.
10. **The category grid and result cards read `is_active`/`status` from the API, never a client-side list.** Spec §31's failure states — "hide inactive; true empty message" and "no matching professionals" — are rendered from real empty collections.
11. **A 404 from a directory *collection* endpoint means the rollout flag is off, and the page must `notFound()`.** `fetchServiceCategories` and `fetchProfessionals` return `T | null` for exactly this reason. Do not "simplify" them to return an empty collection: that silently downgrades spec §35.1's frontend gate to an empty page, makes the seeded flag row's description false, and makes "feature off" indistinguishable from "no results" at every call site. Use `EMPTY_PROFESSIONAL_PAGE` only where the flag state has already been established by an earlier fetch.
12. **`Locale` is declared once, in `frontend/src/lib/api/directory.ts`.** `lib/i18n/directory.ts` re-exports it. A new module imports it from either, and never redeclares the union.

---

## Self-Review

**Spec coverage — §14 (Phase 5), line by line:**

| Spec §14 requirement | Where implemented |
|---|---|
| §14.1 — Professionals directory is the structural base | Task 14 (one page at the canonical URL; no `/services/` or `/professionals/` page exists) |
| §14.1 — approved service-category introductions carried over | Tasks 2, 4 (`description_*` on `ServiceCategory`, rendered by Tasks 14 and 16 when non-empty) |
| §14.1 — links to the six SEO service pages | Task 14 (SEO links section) + Task 16 (the pages themselves) |
| §14.1 — category discovery/filter controls | Tasks 7, 14 (`?category=` filter, category grid links, select control) |
| §14.1 — existing approved service-request CTA | **Not carried over** — the service-request flow is the shared inquiry form, Phase 6. Recorded as a named `PHASE 6 SEAM` comment in `frontend/src/app/services/professionals/page.tsx` and as a Known Limitation, not silently dropped |
| §14.1 — no duplicated category across separate sections | Task 14 (one grid, one result list; `get_categories` dedupes per provider) |
| §14.1 item 1 — hero with title, explanation, category/location search | Task 14 |
| §14.1 item 2 — category grid sourced from `ServiceCategory` | Tasks 2, 6, 14 |
| §14.1 item 3 — results from active `ProfessionalProfile` and services | Tasks 5, 7, 14 |
| §14.1 item 4 — optional advertisement interstitial | Ruled out of scope (no ad model); comment at the placement, Known Limitation |
| §14.1 item 5 — SEO links to six service pages | Tasks 14, 16 |
| §14.2 — identity header (logo/photo, name, categories, location/area) | Task 15 (+ `ProfileMonogram` for the image slot) |
| §14.2 — short verified/profile status language, no certification implication | Task 13's `professional.status.active` string, rendered by Task 15 |
| §14.2 — About | Task 15 |
| §14.2 — Services offered | Tasks 5, 8, 15 |
| §14.2 — Service area | Tasks 8, 15 |
| §14.2 — Portfolio/gallery only when real records exist | Omitted (no media model); ruling + Known Limitation |
| §14.2 — Shared inquiry form | Phase 6 seam (ruling + named comment + Known Limitation) |
| §14.2 — Blurred contact panel via `ContactAccessService` | Phase 7 seam; contact fields excluded from every payload |
| §14.2 — Related professionals, same category, excluding self | Task 8 (`get_related`, capped at 4), Task 15 |
| §14.2 — remove invented revenue/guarantees/affiliations/etc. | Absent by construction — no such field exists in any serializer; Task 17 Step 4 greps the rendered HTML to prove it |
| §14.3 step 1 — mapping table | Task 9 (`LegacyDirectoryMapping`) |
| §14.3 step 2 — dedup by explicit id and normalized name/address, never name alone | Task 10 (`_resolve_provider`'s three tiers; `DUPLICATE_REVIEW`) |
| §14.3 step 3 — copy missing descriptions/categories | Task 10 (copy-only-when-empty, tested both ways) |
| §14.3 step 4 — preserve unique slugs, deterministic redirects for changed ones | Tasks 9 (resolver + slug fallback), 10 (`slugs_preserved`/`slugs_changed` counts) |
| §14.3 step 5 — canonical tags and sitemap | Task 16 (generated sitemap + per-page canonicals); Task 10 reports it as a structural no-op |
| §14.3 step 6 — six SEO records stay independent but linked | Tasks 4, 10 (never deactivated/reparented), 14 (linked from the directory) |
| DoD — one combined directory, no duplicate index content | Task 17 Step 4.1 |
| DoD — both retired URLs return a single-hop 301 | Tasks 11, 17 Step 4.2 (`curl -sIL` hop count) |
| DoD — every displayed category/provider is database-backed | Task 17 Step 4.3 (grep for literals + deactivate-and-reload) |
| DoD — professional detail aligned with broker, no unsupported fields | Task 17 Step 4.4 — second half proven now, alignment explicitly partial until Phase 20 |

**Spec coverage — §11.2 (data model):** `ServiceCategory` — every listed field (`name_*`, `slug`, `description_*`, `icon_key`, `display_order`, `is_active`, `seo_title_*`, `seo_description_*`) plus the `has_seo_page` flag §11.2's prose requires (Task 2). `ProfessionalService` — every listed field (`professional`, `category`, `title_*`, `description_*`, `service_area`, `is_active`, `created_at`, `updated_at`) and the spec's literal first option for the constraint, `unique(professional, category, title_en)` (Task 5). `ProfessionalProfile` is **not** defined here: it is Phase 3's Task 6, and every field name, enum value and `get_absolute_url()` result used in Tasks 5, 7, 8, 9, 10 and 13 is copied from that plan, not from §11.1's shorthand table.

**Spec coverage — other sections touched:** §1's fixed decisions (navigation label, H1, canonical URL, retired URLs, profile URL, six SEO pages) are all in Global Constraints and each has a task. §4.1's three directory routes and six SEO routes exist (Tasks 14, 15, 16); §4.3's three directory redirect rows are implemented (Tasks 11 and 12) and the two non-directory rows are assigned to other phases with a written reason. §29.3 (professional profile) → Task 15; §29.4's four filters and shareable URL state → Tasks 7 and 14; §29.5/§29.6's responsive and accessibility targets are partially served here (responsive grids, labelled form controls, `aria-labelledby` on every section, no colour-only state) and fully owned by Phase 20, which the Known Limitations record. §30.1 lists no endpoint for this feature, so the five new routes are named under its "Exact URL naming may follow an established API convention" latitude, mirroring `taxonomy`'s existing shape. §30.2's envelope and pagination shape come from Phase 3's exception handler and DRF's `PageNumberPagination`. §30.4's rate limiting → the `services_directory` scope on all five endpoints, using Phase 3's IP-hashing throttle. §31's two directory rows (`Combined category tiles`, `Professional result cards`) map to Tasks 6/14 and 7/14 including both named failure states. §32.2's canonical tags, sitemap and retired-URL removal → Tasks 11, 15, 16; its hreflang requirement is an explicit Known Limitation. §35.1's `combined_services_professionals` flag → Task 6 on the API side and Tasks 14/15/16 on the page side, all four surfaces 404ing together. §37's key requirement, including the two keys it names for this feature → Task 13. §38's idempotency rule → both data migrations and the import command. §39's protocol → the per-task TDD structure (including the HTTP-level red-to-green checks that drive the three server-component routes in Tasks 14, 15 and 16), the "no partial implementations" rulings, and Task 17's handoff note.

**Placeholder scan:** no "TBD", "TODO", "implement later", "add appropriate error handling", "handle edge cases", "write tests for the above" or "similar to Task N" appears anywhere in this plan. Every code step carries the actual code; every test step carries the actual test. The two `SEAM` comments in Task 15 are deliberate, their exact text is written out, and they mark work assigned to a named phase — they are not stand-ins for work this plan skipped. The `<N>`/`<M>`/`<TOTAL>` tokens in Task 17's `ACTIVITY.md` entry are counts the executor reads off their own test output in Steps 1 and 2, with an explicit instruction to substitute them; they are not unresolved decisions.

**Type consistency:** `ServiceCategory`, `ProfessionalService` and `LegacyDirectoryMapping` are each defined once and referenced by the same name everywhere, including in the File Structure and the contract summary. `localized(instance, field_base, locale)` and `resolve_locale(raw)` keep identical signatures in Tasks 2, 6, 7 and 8. `LocalizedContextMixin` supplies `context["locale"]`, which every `SerializerMethodField` in Tasks 6, 7 and 8 reads by that exact key. `active_service_count` is the annotation name in Tasks 7 and 8's querysets and the serializer field name in `ProfessionalCardSerializer`, which `ProfessionalDetailSerializer` inherits — one name, three places. `COMBINED_DIRECTORY_FLAG` is defined once in `permissions.py` and used by Tasks 6–9's tests, the permission class and migration `0004`'s `FLAG_KEY` (which repeats the literal because a migration must not import application code). `CATEGORY_AUDIT_FIELDS` is the single source of the audited column list, consumed by `category_audit_snapshot` and asserted by Task 3's last test. `legacy_dedup_key` returns a `(name, address)` tuple in both its definition and both call sites in Task 10. On the frontend, `Locale` is **declared exactly once**, as `export type Locale = "en" | "it" | "es"` in `lib/api/directory.ts` (Task 12), because the thing being modelled is the API contract's `?locale=` parameter; `lib/i18n/directory.ts` (Task 13) does `import type { Locale } from "@/lib/api/directory"` and `export type { Locale }`, so a component may import it from either module and still get one type. An earlier draft of this plan declared a second, structurally identical union in the i18n module — it compiled, which is exactly why it was worth removing: two sources of truth that agree today and would diverge silently the first time a fourth locale is added on one side only. `SUPPORTED_LOCALES` is typed `readonly Locale[]`, so adding a member without widening the union is a type error. `ProfessionalCard`, `ProfessionalDetail`, `ProfessionalService`, `ServiceCategory`, `ServiceCategoryDetail`, `CategoryRef` and `Paginated<T>` match the backend serializers' field lists one for one. The component is `ProfessionalResultCard` (the default export of `ProfessionalCard.tsx`) in Tasks 14, 15 and 16 — deliberately *not* named `ProfessionalCard`, which is the type. `DIRECTORY_MESSAGES` keys used in components (`directory.*`, `professional.*`, `category.browse_professionals`) all exist in the dictionary, and the dictionary test fails on any key missing a locale. `directoryFetch` returns `T | null` at its definition and every caller handles the `null`; `fetchServiceCategories` and `fetchProfessionals` deliberately propagate that `null` rather than flattening it to an empty collection, and all three of their callers (Tasks 14, 16's page and 16's sitemap) handle it explicitly.

**Gaps found and closed during review:**

1. The first draft linked the directory's SEO section to six URLs with no pages behind them, which would have shipped six 404s and broken spec §2.1 and Phase 3's rule 11. Task 16 was added, along with the ruling that records why the six pages belong to this phase despite §14 not naming them.
2. `test_location_matches_city_region_or_an_exact_service_area_entry` (Task 7) relied on Phase 3's `make_professional` leaving three fixtures without a `service_area`, but that factory defaults it to `["IT-52"]` — so all four fixtures matched the `IT-52` query and the assertion proved nothing. The three non-area fixtures now pass `service_area=[]` explicitly.
3. Task 10's import command mutated `ServiceCategory.description_en` with a plain `save()`, the one write in the codebase that bypassed Task 3's audited service. It now calls `save_service_category` with `ActorType.SYSTEM`/`Source.TASK`, and a test asserts the resulting audit row — so Contract rule 5 has no exceptions.
4. The rollout flag's own description said the public pages "disappear" while the directory page rendered an empty state instead. The pages now `notFound()` on a flag-off 404, uniformly with the detail and SEO pages, which is what spec §35.1's "gate frontend exposure" asks for.
5. All four API test files shared one 60/min throttle bucket with no cache isolation, so the suite was order-dependent. `services_catalog/tests/conftest.py` now carries one autouse `cache.clear()`, mirroring `platform_settings/tests/conftest.py` (there is no root `backend/conftest.py`), and the four duplicated flag-cache fixtures were folded into it. The rate-limit test also stopped overriding `settings.REST_FRAMEWORK`, which DRF ignores, in favour of the `monkeypatch.setitem(...THROTTLE_RATES...)` pattern `taxonomy`'s equivalent test already uses.
6. Tasks 11 and 12 (originally one task) and Tasks 13 and 14 (likewise) were each split at their natural seam, and the two `page.tsx` deliverables gained the HTTP-level red-to-green checks they were missing.
