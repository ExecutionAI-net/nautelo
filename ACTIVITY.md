# NAUTA (nautelo) — Activity Log

This file tracks project state so any developer (or a fresh AI session) can
get oriented without re-reading everything from scratch. Append new entries
at the top of the "Log" section; keep "Current State" up to date.

---

## Project Summary

**NAUTA** is a yacht/boat marketplace for Spain and Italy: private sellers,
brokers and nautical service professionals list boats and services; buyers
search, message and (for broker listings) see an illustrative finance
estimate. NAUTA is explicitly **not** a bank, escrow provider, registry or
payment processor for the boat sale itself — Stripe is used only to sell
NAUTA's own listing/media entitlements.

**Stack decision:** Django (backend/API) + Next.js (frontend). Repo:
[github.com/executionainet/nautelo](https://github.com/executionainet/nautelo)
— `dev` branch only for now, with the Phase 0/1 infrastructure skeleton
already merged (see "Current State" below). `main` will be opened by
cloning `dev` once the project is in a shippable state.

---

## Source Documents (in repo root)

| File | What it is |
|---|---|
| `NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md` | 2,651-line production-ready implementation spec, v1.0, dated 2026-09-17. Supersedes an earlier "51-screen static prototype" spec where they conflict. |
| `stitch_nauta_nautical_marketplace (3).zip` | Google Stitch export: 51 static HTML/Tailwind screens (`code.html` + `screen.png` per screen), no backend, no shared components — a visual/UX reference only. |

### Spec summary (key decisions)

- **Domain apps (suggested):** `accounts, brokers, professionals, services_catalog, listings, taxonomy, messaging, financing, entitlements, payments, moderation, notifications, analytics, audit, platform_settings`.
- **Recommended backend stack:** Python 3.12+, Django 5.2 LTS, DRF, PostgreSQL 16+, Redis (cache/Celery broker/Channels layer), Celery (async/media/email), Django Channels (WebSocket notifications), Stripe Checkout (one-time entitlement purchases only), S3-compatible object storage + CDN.
- **Roles:** guest, authenticated buyer, private seller, broker member/admin, service provider, staff moderator/admin — enforced server-side, never trusted from the client.
- **Listing lifecycle:** `DRAFT → PENDING_APPROVAL → PUBLISHED → EXPIRED/ARCHIVED`, with an immutable `ListingSnapshot` per approved version and a `ListingRevision` workflow for edits. Brand/model/year lock after first approval for private sellers.
- **Entitlements/payments:** private sellers get 1 free listing / rolling 365 days (30-day publish window); additional listings require a one-time Stripe-purchased entitlement. Brokers are unlimited but per-broker auto-approval is staff-controlled. Stripe fulfillment happens **only** via verified, idempotent webhook — never the browser success redirect.
- **Finance estimator:** standard fixed-rate amortization, global defaults 5% / 48 months / 20% down, staff-editable, broker-listings-only, versioned so old quotes stay reproducible. Explicitly labeled "illustrative estimate only."
- **Contact privacy:** broker/professional contact info is blurred until the current user has sent a valid inquiry to that specific entity; grant is scoped per (viewer, entity), audited, never exposed in DOM/HTML source when locked.
- **Unique views:** one counted view per listing per viewer identity (user ID or HMAC-hashed IP) for the listing's lifetime; owner/staff/bot excluded.
- **IA change vs. the old 51-screen prototype:** Services and Professionals directories merge into one canonical `/services/professionals/` (old URLs 301 redirect); broker dashboard's "Services & Surveyors" is removed and replaced with "Messages." The 51-screen count is explicitly **not** a requirement to preserve.
- **Delivery plan:** the spec defines 24 dependency-ordered phases (Phase 0 repo audit/scope freeze → Phase 24 deployment/rollback), each with its own migrations, backend rules, frontend states, permissions, and tests before being considered done. Section 39 has a strict "developer execution protocol" (no partial/visual-only implementations, no faked data, no TODO placeholders for backend enforcement).
- Full API inventory, data model, and a UI→backend traceability matrix (section 31) are included — every dynamic UI value must map to a real backend source; hard-coded/demo values are prohibited in production.

### Design reference summary

- 51 static screens covering: public site (home, boat search/detail/compare, brokers, services/professionals, financing, guides, contact, auth), private-seller/broker/service-provider dashboards, and a full staff back office (users, brokers, boats, taxonomy, products/subscriptions, leads, ads, CMS, platform settings, verification desk).
- Built with Tailwind (via CDN in the prototype) + Material Symbols icons; custom Material-3-style color tokens (dark navy primary `#001520`, warm cream surface `#fbf9f4`, teal secondary `#00696e`); typography is Playfair Display (headlines) + Plus Jakarta Sans (body/UI).
- These are throwaway static mockups (inline Tailwind config per file, no component reuse, no real data) — useful for visual direction and layout, not for direct reuse as code. Several screens will be merged/removed per the spec (see IA change above).

---

## Current State

- Repo is live: [github.com/executionainet/nautelo](https://github.com/executionainet/nautelo), `dev` branch, CI green.
- `docs/superpowers/plans/2026-09-17-phase-0-1-infrastructure.md` (Phase 0/1: infrastructure only) is **fully implemented and merged into `dev`** — all 10 tasks complete. The infrastructure skeleton now exists: `backend/` (Django 5.2 + DRF + JWT config + Celery + Channels + S3/MinIO storage + Stripe webhook signature verification) and `frontend/` (Next.js 16 + Tailwind v4 with NAUTA design tokens), plus `docker-compose.yml` for Postgres/Redis/MinIO. Full-stack smoke test passing: `uv run pytest` (7/7 backend tests), `/api/v1/health/` reports all-ok, `/health` on the frontend renders the same via SSR, Django admin login page loads.
- `docs/superpowers/plans/2026-09-17-phase-4-brand-model-taxonomy.md` (Phase 4: brand/model taxonomy) is **fully implemented and merged into `dev`** — all 8 tasks complete, verified end to end in Task 8's final integration pass. `taxonomy` is the first domain app to land (`accounts`, `listings`, etc. are still spec Phase 2+/3+, not started): `BoatBrand`/`BoatModel` models (accent/case-insensitive normalized-name uniqueness, brand-scoped model uniqueness, one database-enforced Other placeholder per brand), a custom-model-name normalization rule for the future Other workflow, and public `GET /api/v1/boat-brands/?q=` / `GET /api/v1/boat-models/?brand_id=&q=` search endpoints.
- `docs/superpowers/plans/2026-09-17-phase-8-finance-calculation-engine.md` (Phase 8: finance configuration and calculation engine) is **fully implemented**, alongside `common` (Phase 0/1). The `finance` app adds `FinanceConfigurationVersion`, `FinanceConfigurationService`, a `Decimal`-exact amortization engine, and `POST /api/v1/finance/quotes/` for manual finance estimates. Listing-linked quotes, `FinanceQuoteLog`, and broker-override precedence are deferred to a later phase (needs `listings`/`User`).
- Architecture fully decided — see table below.

## Architecture Decisions (confirmed 2026-09-17)

| Decision | Choice | Notes |
|---|---|---|
| Django/Next.js boundary | **Django is a pure headless API** (DRF + admin only, no server-rendered HTML/templates for end users) | Next.js owns all public/private UI, including SSR/SSG for SEO-critical public pages (boat search, boat detail, brokers, professionals, services, guides). Spec wording like "view, template, serializer" is read as "API view/service/serializer," not Django templates. |
| Staff back office | **Django admin, customized**, for v1 | Moderation queue, taxonomy mapping, product/entitlement management, broker approval policy, etc. built as customized Django admin (actions, list filters, inline diffs) rather than bespoke Next.js screens. Revisit per-workflow if admin genuinely can't express a flow (e.g., real-time moderation queue with WebSocket updates). |
| V1 scope | **Follow the spec's 24 phases in full, in order** | No separate MVP carve-out — Phase 0 through Phase 24 as documented in the spec, each with its own migrations/tests/definition-of-done before moving on. |
| Local dev infra | **Docker Compose from day one**: Postgres, Redis, Celery worker(s), MinIO (S3-compatible storage) | Mirrors production topology early so `select_for_update`, Celery queues, and signed media uploads can be tested locally from the start. |
| Repo layout | **Monorepo**: `backend/` (Django project + apps) and `frontend/` (Next.js app) in one `nautelo` repo | Matches the already-created single GitHub repo. |
| Auth mechanism | **JWT** via `djangorestframework-simplejwt` | Next.js stores access/refresh tokens in an httpOnly cookie and forwards them as a Bearer token to Django. Fully decoupled from Django sessions; WebSocket auth will use the same JWT once the `accounts` app (Phase 3) exists. |
| Dev environment shape | **Infra-only in Docker** | Postgres, Redis, MinIO (and later Celery workers as a native process) run via Docker Compose; Django (`runserver`) and Next.js (`next dev`) run natively on the host for fast hot-reload/debugging. |
| Python tooling | **uv** | Single tool for venv + lockfile + install/run (`uv add`, `uv run`). |
| Node tooling | **pnpm** | Package manager for the `frontend/` app. |
| CI / merge gating | **GitHub Actions** (`.github/workflows/ci.yml`: backend pytest, frontend build+lint) + **per-task PR model** | Every task (from Task 2 of the Phase 0/1 plan onward) is implemented on its own branch off `dev` via `subagent-driven-development`, opened as a PR, and merged by the controller only when CI is green and there are no conflicts. Tasks run strictly sequentially (one branch in flight at a time), which is also how conflicts are avoided — not detected-and-resolved after the fact. Branch protection on `dev` (require the CI check before merge) is a separate, explicit decision pending confirmation once `dev` has its first real commits. |

## Next Steps

1. Write the Phase 2 plan (shared domain types, `platform_settings` app, audit foundation) per spec §10, via `writing-plans`.
2. Before starting Phase 2, fix the small residual gaps the Phase 0/1 final review found (tracked in `.superpowers/sdd/2026-09-17-phase-0-1-infrastructure/progress.md`): a dead `wsgi.py` settings-module fallback, a shadowed leftover `common/tests.py`, the frontend's port-3020 ruling not applied to `backend/.env.example`/CI's CSRF/PUBLIC_BASE_URL values, and the `notifications`/`media`/`maintenance` Celery queues (required by the plan's Global Constraints) not yet declared anywhere in committed code.

---

## Log

### 2026-09-17 — Phase 4 brand/model taxonomy complete

- Implemented `docs/superpowers/plans/2026-09-17-phase-4-brand-model-taxonomy.md` in full.
- New `taxonomy` app: `BoatBrand`/`BoatModel` models (accent/case-insensitive normalized-name uniqueness, brand-scoped model uniqueness, one database-enforced Other placeholder per brand, auto-created via a `post_save` signal), and a custom-model-name normalization rule for the future Other workflow.
- Public endpoints: `GET /api/v1/boat-brands/?q=` and `GET /api/v1/boat-models/?brand_id=&q=`, both database-backed, paginated, rate-limited (DRF `ScopedRateThrottle`, `taxonomy_search` scope), and open to unauthenticated requests.
- Task 8 final integration pass: full backend regression (`uv run pytest -v`) is 83/83 green in one run against real Postgres/Redis — `taxonomy` migrations included, no missing/out-of-order dependency. Manual end-to-end check against `runserver` confirmed `GET /api/v1/boat-brands/?q=beneteau` returns the accent/case-insensitive match for a brand created as "Bénéteau", and `GET /api/v1/boat-models/?brand_id=...` returns its model plus a populated `other` object and `show_other_prompt: false`.
- Execution note for future sessions: the Task 8 worktree was branched off a local `dev` that predated the Tasks 5-7 PR (#23, custom name normalization + the two search endpoints) — `git fetch` + `git merge origin/dev --ff-only` was needed before the regression pass so Tasks 5-7's code was actually present to verify; branching worktrees for a plan's final task should fetch first. Also hit a real Windows-only encoding trap while manually exercising the accent-insensitive search: piping a UTF-8 Python script into `manage.py shell` via `<` without forcing UTF-8 I/O let the console's active code page mangle the accented `name` on save (e.g. slug came out `banateau` instead of `beneteau`) — this is a manual-testing artifact of the OS/console, not a `taxonomy` bug (the automated accent-insensitivity tests, which go through the Django test client/ORM directly, passed throughout); setting `PYTHONUTF8=1`/`PYTHONIOENCODING=utf-8` before the `manage.py shell` call fixed it. Any future manual verification on this machine involving non-ASCII input should set those env vars first.
- Known limitations: no staff CRUD/mapping-to-listing endpoints yet (`/api/v1/staff/taxonomy/...` — spec Phase 17); `Listing.custom_model_name` doesn't exist yet (needs the Listings phase) so the Other workflow's display/filter behavior (spec §13.2 items 7-8) isn't wired up end to end yet; no production seed command yet (spec §38); taxonomy mutations will use Phase 2's shared `audit.services.record_audit_event()` when a future phase (17, staff taxonomy mapping) adds mutation endpoints — no taxonomy-specific audit model needed, and no audit call exists in this plan today since this phase has no mutation endpoints yet (only read/search).
- Next: write the Phase 2 plan (shared domain types, `platform_settings` app, audit foundation) per spec §10 — still outstanding from the Phase 0/1 handoff — or the Phase 3 plan (identity/organizations/permissions) if it hasn't merged yet, whichever the project owner prioritizes.

### 2026-09-17 — Phase 8 finance configuration and calculation engine complete

- Implemented `docs/superpowers/plans/2026-09-17-phase-8-finance-calculation-engine.md` in full.
- New `finance` Django app: `FinanceConfigurationVersion` (versioned, immutable, exactly-one-active-row DB constraint, seeded with the spec default of 5% / 48 months / 20% down), `FinanceConfigurationService` (cached active-config lookup, versioned activation), a `Decimal`-exact amortization calculation engine matching spec §17.1's worked examples exactly, and `POST /api/v1/finance/quotes/` for manual (non-listing) finance estimates.
- Staff manage finance defaults via Django admin by adding a new configuration version (existing versions are permanently read-only, never editable in place).
- Known limitations: no `listing_id` quote context (needs spec Phase 4's `listings` app); no `FinanceQuoteLog` persistence (needs `listings`/`User`); no broker-override/configuration-precedence mechanism at all yet (needs listings; deliberately not speculatively added to `FinanceConfigurationVersion` per YAGNI, since its shape isn't known until Phase 9 is planned); no rate limiting on the quote endpoint; `created_by_user_id` is a loose UUID, not yet a real foreign key (needs spec Phase 3's `User` model). All of these are deferred to the phase that integrates finance with listings (spec Phase 9 or later), by design — this phase was scoped to run concurrently with Phase 3/4.
- Next: spec Phase 9 (finance card UI and broker listing toggle) once this plan and the Phase 4 taxonomy/listings plan have both landed.

### 2026-09-17 — Phase 0/1 infrastructure complete

- Implemented `docs/superpowers/plans/2026-09-17-phase-0-1-infrastructure.md` in full.
- Repo scaffolded: `backend/` (Django 5.2 + DRF + JWT config + Celery + Channels + S3 storage + Stripe webhook stub) and `frontend/` (Next.js 16 + Tailwind v4 with NAUTA design tokens), `docker-compose.yml` for Postgres/Redis/MinIO.
- `/api/v1/health/` reports database, Redis and Celery worker status; `/api/v1/stripe/webhook/` verifies signatures (no fulfillment logic yet); `/ws/health/` proves the Redis-backed Channels layer; `/health` on the frontend proves Next.js → Django connectivity.
- Known limitations: no domain apps yet (`accounts`, `listings`, etc. — spec Phase 2+); no real login/JWT-issuing endpoint (needs `User` model, Phase 3); `prod.py` settings are a placeholder, full hardening is Phase 22; frontend has no automated test tooling yet (deferred until real UI logic exists).
- Execution notes for future sessions: Tasks 1-8 ran mostly sequentially (one branch/PR at a time), then Tasks 6/7/8 plus a `localhost`→`127.0.0.1` hotfix ran in **parallel git worktrees** once the backlog was independent enough — each on its own branch/PR, merged in sequence once reviewed and green, no conflicts. Several genuine environment bugs were found and fixed along the way rather than assumed away: MinIO images must come from `quay.io` (`docker.io` no longer serves them); GitHub Actions `run:` blocks abort on a command's non-zero exit (`bash -e`), so conditional handling needs an `if cmd; then...else...fi`, not a post-hoc `$?` capture; `pytest`'s "no tests collected" (exit 5) needed a `find`-based gate excluding `.venv` (vendored packages ship their own `test_*.py`); this Windows machine resolves `localhost` to IPv6 `::1` while Docker's port mappings only listen on IPv4, hanging backend↔Docker connections indefinitely (fixed by using `127.0.0.1` for backend-internal service URLs) — a bare `manage.py runserver` process doesn't have this problem (confirmed empirically in Task 9), so the fix is scoped to Docker-proxied services, not a blanket rule; `create-next-app@latest` today installs Next.js 16/Tailwind v4, which needs an explicit `@config` directive in `globals.css` to load `tailwind.config.ts` at all; and CI's `pnpm/action-setup` needed bumping from v9 to v12 to parse the `pnpm-workspace.yaml` schema pnpm 12 generates.
- Next: write the Phase 2 plan (shared domain types, `platform_settings` app, audit foundation) per spec §10.

### 2026-09-17 — Repo live, CI green (Task 1 of Phase 0/1 plan)

- Created the GitHub repo's initial commit: `.gitignore`, `.github/workflows/ci.yml`, `ACTIVITY.md`, the spec, and the implementation plan. Pushed to `dev`.
- Hit and fixed a real access issue: the authenticated GitHub account (`hakantimur`) had read-only access to `executionainet/nautelo`; push failed with 403 until the project owner granted Write access. Documented here in case it recurs for another contributor.
- Hit and fixed a real CI bug on the first run: a job-level `defaults.run.working-directory: backend`/`frontend` failed immediately because those directories don't exist yet (git doesn't track empty dirs), so even the "does this project exist yet" check step couldn't start. Fixed by removing the job-level default and setting `working-directory` per step, only on steps gated behind the existence check.
- CI is now green on `dev` (both `backend` and `frontend` jobs correctly no-op since neither project exists yet).
- Agreed execution model with the project owner: `subagent-driven-development` per task, but adapted to open a PR per task into `dev` (not one long-lived plan branch), merged by the controller only when CI is green and there's no conflict. Tasks run strictly sequentially, so only one branch is ever in flight. Branch protection on `dev` (require the CI check before merge) is intentionally not yet enabled — pending a separate explicit decision now that `dev` has real commits and a working CI check to require.

### 2026-09-17 — Initial review

- Read `NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md` in full (2,651 lines) and inspected all 51 screens in the Stitch design export (structure, tokens, and a representative sample of markup).
- Created this `ACTIVITY.md` file as the project's running handoff log.
- Raised the open questions above with the project owner before starting any scaffolding.
