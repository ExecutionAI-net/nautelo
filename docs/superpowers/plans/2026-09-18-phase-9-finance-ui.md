# NAUTA Phase 9 — Finance Card UI and Broker Listing Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Phase 8's finance engine visible exactly where spec §18 says it may be — publish the broker's finance settings into the immutable listing snapshot, add the `finance` block to the one public listing representation, teach `POST /api/v1/finance/quotes/` the `listing_id` context, and build the Next.js boat card, `/boats/` list, `/financing/` calculator page and broker-only "Financing estimate" field group that render them.

**Architecture:** Three layers, each with one owner. (1) `listings` publishes the four broker finance columns into `ListingSnapshot`, so what the public sees is the *approved* setting, never a pending draft. (2) A new module `backend/finance/listing_quotes.py` owns every listing↔finance rule — spec §18.2's eligibility conjunction, spec §17.2's GLOBAL/LISTING_OVERRIDE precedence, and the exact spec §18.5 block — and is the `FinanceQuoteService` spec §31's traceability matrix names. `listings.serializers.PublicListingSerializer` gains one call into it and no second public representation is created (spec §29.1, Phase 11 contract rule 9). (3) The frontend renders one `BoatCard` component from that one representation, and the calculator CTA opens `/financing/` in a new tab where the listing — never the query string — is the authority.

**Tech Stack:** Python 3.13 + `uv`, Django 5.2 LTS, Django REST Framework, PostgreSQL 16, Redis (cache + DRF throttle counters); **Next.js 16.3.5** (App Router, TypeScript), **Tailwind CSS v4**, `pnpm`, Vitest + Testing Library. No new third-party dependencies in either project.

**Version-drift check (do this before writing any App Router code):** the frontend is Next.js **16.3.5** with Tailwind **v4**, not the 15.x a model's training data assumes — `frontend/AGENTS.md` flags this. Before using any App Router API in Tasks 6–11 (`searchParams`/`params` shapes, `generateMetadata`, `"use client"`, `notFound()`), verify the signature against `frontend/node_modules/next/dist/docs/` rather than from memory. `params` and `searchParams` are **Promises** in Next 15/16 and every page in this plan awaits them.

**Spec:** [`NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md`](../../../NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md) — primarily **§18 (Phase 9)**, plus §1 (fixed finance decisions), §2.5 (no misleading finance language), §4.1 (`/boats/`, `/financing/` routes), §10.1 (`PlatformSetting` table), §11.4 (`BoatListing` / `ListingSnapshot`), §11.6 (finance data model), §17 (Phase 8's formula, precedence, validation, quote API, cache), §29.1/§29.5/§29.6 (boat card, responsive, accessibility), §30.1/§30.2/§30.4 (API inventory, response conventions, rate limits), §31 (UI-to-backend traceability), §35.1 (feature flags), §36.1 (finance edge cases), §37 (localization keys), §39 (developer execution protocol), §40 Scenarios C and D.

**Predecessor plans (read before starting):**
- [`2026-09-17-phase-8-finance-calculation-engine.md`](./2026-09-17-phase-8-finance-calculation-engine.md) — **hard dependency.** It ships `finance.calculations.calculate_finance_quote`, `finance.models.FinanceConfigurationVersion`, `finance.services.FinanceConfigurationService` and `POST /api/v1/finance/quotes/` (manual context only). Its Known Limitations list is this plan's inbox: "No `listing_id` quote context" and "No configuration-precedence / broker-override mechanism at all" are closed here (Tasks 3 and 5); `FinanceQuoteLog` is not (see Known Limitations).
- [`2026-09-18-phase-11-listing-workflow.md`](./2026-09-18-phase-11-listing-workflow.md) — **hard dependency.** Its "Contract summary for later phases" is binding: rule 1 (never read a listing's draft columns on a public path), rule 2 (never write workflow columns directly), rule 3 (never mutate a `ListingSnapshot` row), rule 9 (Phase 9 extends `PublicListingSerializer`, does not add a second representation), rule 10 (new error codes must be stable and documented) and rule 11 (never write payload-backed columns by hand). Its Known Limitation 4 ("No `finance` block on listing responses → Phase 9") is this plan's mandate, and its Known Limitation 6 (no listing slug, no public detail page) is why this plan builds `/boats/` but not `/boats/<slug>/`.
- [`2026-09-18-phase-5-directory-consolidation.md`](./2026-09-18-phase-5-directory-consolidation.md) — structural template for this project's frontend work: the typed EN/IT/ES dictionary instead of an i18n framework, the server-component page + `force-dynamic` + `null`-means-flag-off fetch contract, and the component/test layout under `src/components/<area>/`.
- [`2026-09-17-phase-2-shared-types-platform-settings.md`](./2026-09-17-phase-2-shared-types-platform-settings.md) — `platform_settings.services.get_setting_value()` / `is_feature_enabled()` / `set_feature_flag()` / `update_setting()` and the `SETTINGS_REGISTRY`.

## Execution Model

Per the standing project convention recorded in `ACTIVITY.md`: each task is implemented on its own branch off the current tip of `dev` (`git checkout -b phase9-task-N-<slug> dev`), run through `subagent-driven-development`'s implementer → task-reviewer → fix-loop cycle, opened as a PR (`gh pr create`), and merged by the controller only when CI is green and the branch is cleanly mergeable. Tasks run strictly sequentially — never two branches in flight at once — and each new task branches from the just-merged `dev` tip.

---

## Global Constraints

Exact values copied from the spec. Every task's requirements implicitly include this section.

- **Phase dependency (ruling of record — cite this, do not re-derive it).** `docs/superpowers/PHASE-TRACKER.md`'s Phase 9 row states: *"the spec's own dependency table lists only 4,8, but §18's actual content (`listing.seller_type`, `listing.show_finance_estimate`, `listing.price`, `listing.status`) requires the `BoatListing` model that Phase 11 defines. Real dependency is 4, 8, **and 11**. … Extend `listings.serializers.PublicListingSerializer` with the `finance` block per Phase 11's own Contract Rule 9; do not create a second public listing representation."* Spec §7's table (Phase 9 depends on 4, 8) is therefore incomplete and the tracker's correction governs. Phases 4, 8 and 11 are all merged into `dev`.
- **Global finance defaults are fixed by spec §1:** annual nominal interest rate **5.00%**, term **48 months**, down payment **20.00%**. They live in `FinanceConfigurationVersion` (seeded by Phase 8's migration `0002`), are staff-editable only by activating a new version, and are read at request time (spec §17.5).
- **Finance card eligibility is fixed by spec §1 and §18.2:** only broker-owned listings may show finance, and only when the broker enables the listing-level toggle. Private-seller finance is **never** displayed and no finance toggle is shown or accepted for private-seller listings.
- **Spec §18.2's conjunction is the whole rule.** Finance UI shows only when `seller_type == BROKER` **and** `show_finance_estimate == true` **and** `finance.enabled == true` **and** the price is valid **and** the currency is supported **and** `status == PUBLISHED`. "If any condition fails, remove the entire estimated-payment column, calculator CTA and disclosure. Do not show zeros or disabled finance placeholders."
- **Spec §18.5 fixes the API block exactly.** Eligible: `{"visible": true, "monthly_payment", "annual_rate_percent", "term_months", "down_payment_percent", "configuration_version"}`. Ineligible: `{"visible": false}` **and no assumptions** — six keys or one, never anything in between.
- **Spec §18.3 fixes the CTA target exactly:** `/financing/?listing=<uuid>&price=<server-formatted-price>&currency=EUR`, opened with `target="_blank" rel="noopener noreferrer"`. The finance page treats `listing` as the authority and ignores tampered price parameters; the query price exists only as an immediate display fallback while loading.
- **Spec §18.4 fixes the form copy:** field group title **`Financing estimate`**; toggle label **`Show an estimated monthly payment on this listing`**; default **off** for a new broker listing; when off, override fields are hidden and cleared from the submitted UI state (stored overrides may remain but are ignored); when on, show global defaults and an optional **"Use custom assumptions for this listing"**; saving needs no separate staff finance approval; copy states clearly that the estimate is illustrative.
- **Spec §17.3 validation ranges:** price `0.01–999,999,999.99`; annual rate `0–100%`; term `1–360` whole months; down payment `0–99.99%`; principal must remain positive; unsupported currency returns `unsupported_currency`.
- **Spec §17.2 precedence:** start from the active global configuration; apply a listing override only when staff permit broker overrides **and** the stored override is valid; return the effective source of each value as `GLOBAL` or `LISTING_OVERRIDE`. A globally disabled override capability means overrides are **ignored, not deleted**.
- **Spec §17.1/§11 preamble: `Decimal`, never binary floating point,** at ≥28 digits of internal precision, rounded to two decimals with `ROUND_HALF_UP` only at the API boundary. Every calculation in this plan goes through `finance.calculations.calculate_finance_quote`; no task re-implements the formula, and no Python `float` appears in any calculation path. On the frontend, decimal strings from the API are converted to `Number` **only for `Intl` display formatting**, never for arithmetic that produces a displayed money value.
- **Spec §2.5 — no misleading finance language.** No response, page, label, copy key, admin string or code comment introduced by this plan may use "approved", "pre-approved", "guaranteed", "offer", "your rate" or a named lender. The estimate is illustrative, and the disclaimer (`finance.illustrative_disclaimer`) is visible wherever a number is.
- **Spec §36.1 edge cases are requirements, not notes:** zero interest uses straight division and must not divide by zero (already covered by Phase 8's engine); a price change alters the estimate only when the new version is public; a pending private revision price does not alter the public card calculation; **draft broker finance settings do not leak before publication**; a globally disabled `finance.enabled` leaves listing flags stored but makes all public finance visibility false; the currency symbol/format is localized while the calculation uses the numeric amount and currency code; the finance page may explore alternative values while card defaults stay server-defined and the disclaimer stays visible.
- **Feature flag key for this phase:** `finance_estimates` (spec §35.1), seeded **disabled** (spec §35.2 step 4 — code ships ahead of the feature). It gates the listing finance surface (card block and listing-context quotes). It does **not** gate Phase 8's manual calculator, which shipped ungated.
- **Error codes introduced by this plan** (stable, per spec §30.2 and Phase 11 contract rule 10): `listing_not_found`, `finance_not_available_for_listing`, `price_mismatch`. Reused unchanged: `unsupported_currency`, `validation_error`, `finance_not_allowed_for_private_seller`, `invalid_percent`, `invalid_term`, `invalid_boolean`.
- **Import direction is load-bearing.** `backend/finance/listing_quotes.py` may import `listings.models`, `listings.enums` and `accounts.enums` — and **nothing else from `listings`**. `listings.serializers` imports `finance.listing_quotes`, so importing `listings.serializers` or `listings.views` from `listing_quotes` would close an import cycle. The one module that needs `listings.views.published_listings_queryset` is `finance/views.py`, which nothing in `listings` imports.
- Backend: Python 3.13 + `uv`, Django 5.2 LTS, DRF for all JSON APIs, PostgreSQL 16 and Redis via the existing `docker-compose.yml` (Postgres `127.0.0.1:5433`, Redis `127.0.0.1:6380`).
- Backend dev server port is **8020**; frontend dev server port is **3020** (Phase 0/1 Task 4 "Ruling A").
- **Tests run against PostgreSQL, never SQLite.** `backend/config/settings/test.py` MUST NOT be modified to override `DATABASES` or `CACHES` to SQLite / `LocMemCache`. This rule was violated and reverted once already in this project — if a test is slow or awkward against real Postgres/Redis, fix the test, never the settings.
- Rate limiting uses `common.throttling.HashedIPScopedRateThrottle` (installed as `DEFAULT_THROTTLE_CLASSES` by Phase 3). Views declare **only** `throttle_scope`, never `throttle_classes` (Phase 3 contract rule 9). New scope added by this plan: `finance_quote` = **`120/min`**.
- Every error response uses the spec §30.2 envelope (stable machine `code`, user-safe `message`, `fields` map, `request_id`). Money and rates are decimal strings. Times are ISO 8601 UTC.
- **Every visible state maps to a real backend source** (spec §2.1, §29.1). No hard-coded view counts, no fixed sample finance copy, no "120 months / 6.5%" prototype leftovers, no client-side inference of seller type from display text.
- All new UI text has EN/IT/ES keys in a typed dictionary (spec §37); no English literal appears inside a component.
- No partial or visual-only implementations, no faked data, no TODO placeholders for backend enforcement (spec §39).
- TDD per task: write the failing test, run it and see it fail, write the minimal implementation, run it and see it pass, commit.
- **Every settings and urls edit in this plan is additive.** `backend/config/settings/base.py` and `backend/config/urls.py` already carry merged entries from Phases 0/1, 2, 3, 4, 5, 8 and 11. Read the real file, add to it, never paste over it.

---

## Scope rulings

Spec §18 is the approved design, but four of its sentences meet merged code that does not yet have a shape for them. Each boundary is ruled here so no task has to guess.

**Note (ruling — the published finance settings are snapshotted, not read live off the draft columns).**
Spec §18.2 names `listing.show_finance_estimate`, and spec §11.4's `ListingSnapshot` field list does not mention finance. Read literally, that would mean the public card reads `BoatListing.show_finance_estimate` and the three override columns directly. **It must not**, for three reasons that all point the same way:
1. Those four columns are **draft state**. `listings.drafts._apply_payload_to_listing` writes them onto the `BoatListing` row the moment a broker PATCHes a draft — before any moderator sees the revision. Reading them publicly would put unapproved, seller-chosen finance assumptions (a 0.01% rate, a 360-month term) on a live public card with no moderation step.
2. Spec §36.1 forbids exactly that: *"Draft broker finance settings do not leak before publication."* Its neighbouring bullet — *"Pending private revision price does not alter public card calculation until approved"* — establishes the same principle for the number the estimate is computed from.
3. Phase 11 contract rule 1 is unambiguous: *"Never read a listing's draft columns on a public path. Public content comes from `listing.current_public_snapshot` only."*
**Decision:** Task 1 adds `show_finance_estimate`, `finance_down_payment_override_percent`, `finance_rate_override_percent` and `finance_term_override_months` to `ListingSnapshot`, and `listings.snapshots.create_snapshot_from_revision` copies them off the listing row at approval — the same "two sources" pattern it already uses for the four taxonomy columns. Spec §18.2's `listing.show_finance_estimate` is then satisfied as *the published value of that listing field*, which is what a public reader of §18.2 means. §11.4's snapshot list is a minimum, not a closed set: Phase 11 already expanded `title_*`, `description_*` and "location fields" from it by ruling, and this is the same kind of expansion with a §36.1 requirement behind it. **What this does not change:** the *global configuration* is still read live at request time, so spec §17.5 and §18's acceptance test 5 ("staff changing defaults updates all non-overridden eligible cards") still hold — only the per-listing settings are frozen at approval, exactly like the price they apply to.

**Note (ruling — `/boats/` is built here; `/boats/<listing-slug>/` is not).**
§18.1 describes a card and §18's acceptance tests say "in list or detail", but no boat card and no boat page exist anywhere in the frontend yet, and a component with no page cannot be demonstrated. Spec §29.1 ("Every boat card uses one component and one API representation") makes *this* the phase that creates that one component, because it is the phase that introduces the conditional content §29.1 lists last ("Finance estimate and calculator link only when eligible"). Task 9 therefore builds `/boats/` (spec §4.1: "Search/list results", backed by the already-shipped `GET /api/v1/listings/`) as a real, server-rendered, paginated page with a true empty state — not filters, facets, visual-regression snapshots or responsive QA, which are Phase 20's (spec §29.4–§29.6). The **detail** page is deliberately absent: spec §4.1 fixes its URL as `/boats/<listing-slug>/`, and Phase 11's Known Limitation 6 records that no listing slug exists and public detail is addressed by UUID until Phase 20/21. Building it at an off-spec URL now would create a page Phase 21 has to redirect away from. The "or detail" half of acceptance test 1 is therefore proven at the API level against `GET /api/v1/listings/<id>/` — the same serializer, so the same `finance` block, by construction.

**Note (ruling — the broker form field group is a component, the form is Phase 16's).**
Spec §18.4 specifies a field group inside the listing create/edit form. That form is spec §25 (Phase 16), which does not exist and which §25.1 requires to be *one* policy-driven form rather than two. Task 11 therefore delivers `FinancingEstimateFieldset` — the complete, tested field group with its own payload builder — plus the rule that it renders nothing at all for a private seller, and Phase 16 mounts it at step 8 of §25.2. This is the same seam pattern Phase 5 used for the inquiry form and contact panel. The backend half of §18.4 ("Private-seller forms must … [not] accept them through API payloads") is already enforced by Phase 11's `listings.payloads._reject_disallowed_fields` (`finance_not_allowed_for_private_seller`); Task 12 proves it with a §40 Scenario D acceptance test rather than rebuilding it.

**Note (ruling — `finance.broker_overrides_enabled` is a new `PlatformSetting` key).**
Spec §17.2 requires that "staff permits broker overrides" be a real, globally switchable capability ("Staff can disable override capability globally without altering existing stored values"). Spec §10.1's settings table has no such key and spec §11.6's `FinanceConfigurationVersion` has no such column — Phase 8 recorded this gap verbatim in its Known Limitations and deliberately did not invent a field. The capability needs a home and there are only three candidates: a new column on the immutable configuration model (wrong — the switch is policy, not a calculation input, and versioning it would make disabling overrides rewrite finance history), a §35.1 feature flag (wrong — flags are rollout switches, and §35.1's list is closed), or the typed, audited, staff-editable settings registry §10.1 exists to hold. **Decision:** Task 2 adds `finance.broker_overrides_enabled` (boolean, default `true`, **`is_public=False`**) to `SETTINGS_REGISTRY`, seeded by its own migration, and updates `platform_settings/tests/test_registry.py` — whose `test_registry_defines_exactly_the_twelve_spec_keys` is a deliberate contract test — in the same commit, with the reason written into the test file.

**Sub-ruling — the key is not public.** `SettingDefinition.is_public` defaults to `True` and all twelve merged keys take that default, so this one has to say `is_public=False` explicitly. It is a staff-only policy switch: Task 3 reads it server-side inside `FinancePolicy.load()`, and no frontend consumer reads it at all (Task 11's `overridesEnabled` prop is fed by Phase 16's own staff-aware form context, not by the public settings endpoint). Publishing it would tell every anonymous visitor how the platform's override policy is configured, for no gain. Because it is non-public it never enters `get_public_settings()`'s `settings` dict, so `platform_settings/tests/test_views.py::test_public_settings_endpoint_returns_all_seeded_keys` — an exact-dict assertion over that payload — **needs no edit and stays genuinely untouched**. This is narrower than the alternative and is deliberately *not* the same thing as the ruling below, which publishes the finance *configuration values*, not this policy flag.

**Note (ruling — the card's optional details disclosure fetches an authoritative quote).**
Spec §18.1 permits a disclosure showing "down payment, financed principal, term, rate, total installments and total interest" and requires it to "use live calculation results, never fixed sample copy". Spec §18.5's card block carries none of those four derived amounts, and widening it would break the exact shape §18.5 fixes and add five decimal strings to every row of a 24-card page for a panel almost nobody opens. Computing them in JavaScript instead would put money arithmetic in the browser, which spec §17's definition of done forbids as authoritative ("frontend may preview but server response is authoritative"). **Decision:** the disclosure is a client component that POSTs `{"listing_id": ...}` to `/api/v1/finance/quotes/` on first expand and renders the server's numbers. This is also the only card interaction spec §11.6 would ever let a `FinanceQuoteLog` record ("Do not store a quote log for every card rendered. Log only an explicit calculator interaction or detail request") — the hook is in the right place for whichever phase builds that log.

**Note (ruling — an invalid stored override is ignored, not an error).**
Spec §17.2 step 2 says to use listing overrides when "valid listing override fields are present". A stored override can be out of range in exactly one way today — Phase 11's shared `_clean_percent` validator bounds both override percentages at 0–100 while spec §17.3 caps the down payment at 99.99%, so a stored 100% down payment (a zero principal, which §17.3 also forbids) is reachable on merged `dev`. **That write-path bug is not fixed by this plan.** It is a live, unflagged API-correctness defect unrelated to this phase's feature-flag-guarded UI work, so it is being fixed as its own standalone PR on branch **`fix-finance-percent-ceiling`**, which gives each percent field its own ceiling in `listings.payloads` and merges to `dev` before this plan executes. Every task here may therefore assume `finance_down_payment_override_percent` is already correctly bounded at 0–99.99% by the validation layer.

The read-time check stays anyway, and is not redundant with it: a validator can change, a row written before the prerequisite fix does not change, and Task 3's precedence code is where the value is *used*. Defence in depth belongs with the reader. A public card must never 500 and must never divide by zero. **Decision:** `finance.listing_quotes` range-checks each stored override at read time against §17.3's bounds and silently falls back to the global value, reporting that field's source as `GLOBAL`. The card stays correct and the listing stays publishable; nothing is deleted (§17.2).

**Note (ruling — the active finance configuration is published on the existing public settings endpoint).**
Spec §4.1 makes `/financing/` a standalone route, reachable with no `?listing=`. Spec §2.1 is explicit that "Production UI must not display invented, hard-coded … operational data", naming `FinanceQuoteService` among its examples, and spec §17.5 requires that a staff change to the defaults "changes automatically affect boat cards and the finance page". Those three sentences together leave exactly one honest way to open that page: the browser must be told the platform's *real current* assumptions by the server. Hard-coding `5 / 48 / 20` in the bundle violates §2.1 and silently goes stale the first time staff activate a new version, violating §17.5; leaving the form empty is not invented data but it is a worse page and it makes §17.5's "and the finance page" vacuous for the no-listing case. **Decision:** Task 2 adds one read-only key, `finance_configuration`, to `GET /api/v1/platform/public-settings/`, carrying the **active** `FinanceConfigurationVersion`'s `version`, `annual_rate_percent`, `term_months` and `down_payment_percent`, and `null` when there is no active row. This publishes nothing new in kind: the identical four values already ride on every eligible boat card in spec §18.5's `finance` block, on the same unauthenticated endpoint family. Task 10's calculator starts pre-filled from it and Task 11's `defaults` prop is the same shape.

**Sub-ruling — it is composed in the view, not folded into `get_public_settings()`.** That function caches its payload under `platform_settings:public` with `timeout=None` and is invalidated only by `update_setting`. Activating a new `FinanceConfigurationVersion` does not go through `update_setting`, so folding the configuration into that dict would freeze it forever and break spec §17.5 in the least visible way possible. The view composes the two instead: the settings half keeps its own forever-cache, and the finance half is read through `FinanceConfigurationService.get_active_configuration()`, which owns a 300-second TTL that `activate()` invalidates on commit — exactly the cache contract the card path already relies on. This also keeps the finance import out of `platform_settings.services`, where everything else in the project imports *from*.

---

## File Structure

```
nautelo/
├── ACTIVITY.md                                                    (modify: Task 12)
├── docs/superpowers/plans/2026-09-18-phase-9-finance-ui.md        (this file)
├── backend/
│   ├── config/settings/base.py                                    (modify: Task 5 — finance_quote throttle rate)
│   ├── platform_settings/
│   │   ├── registry.py                                            (modify: Task 2 — finance.broker_overrides_enabled)
│   │   ├── views.py                                               (modify: Task 2 — publish the active finance configuration)
│   │   ├── migrations/0005_seed_finance_broker_overrides_setting.py (new: Task 2)
│   │   └── tests/
│   │       ├── test_registry.py                                   (modify: Task 2)
│   │       └── test_views.py                                      (modify: Task 2 — add two cases, change none)
│   ├── listings/
│   │   ├── models.py                                              (modify: Task 1 — 4 snapshot columns)
│   │   ├── snapshots.py                                           (modify: Task 1 — copy finance settings)
│   │   ├── serializers.py                                         (modify: Task 4 — the finance block)
│   │   ├── migrations/0005_listingsnapshot_finance_settings.py    (generated: Task 1)
│   │   ├── migrations/0006_backfill_snapshot_finance_settings.py  (hand-written: Task 1)
│   │   └── tests/
│   │       ├── factories.py                                       (modify: Task 1)
│   │       ├── test_snapshot_finance_settings.py                  (new: Task 1)
│   │       ├── test_public_read_api.py                            (modify: Task 4 — replace the Phase 11 absence test)
│   │       ├── test_public_finance_block.py                       (new: Task 4)
│   │       └── test_phase_9_acceptance.py                         (new: Task 12)
│   └── finance/
│       ├── listing_quotes.py                                      (new: Task 3)
│       ├── serializers.py                                         (modify: Task 5 — listing_id context)
│       ├── views.py                                               (modify: Task 5)
│       ├── migrations/0003_seed_finance_estimates_flag.py         (hand-written: Task 2)
│       └── tests/
│           ├── test_listing_quotes.py                             (new: Task 3)
│           └── test_listing_quote_context.py                      (new: Task 5)
└── frontend/src/
    ├── lib/
    │   ├── api/listings.ts                                        (new: Task 6)
    │   ├── api/listings.test.ts                                   (new: Task 6)
    │   ├── i18n/finance.ts                                        (new: Task 7)
    │   └── i18n/finance.test.ts                                   (new: Task 7)
    ├── components/
    │   ├── listings/BoatCard.tsx                                  (new: Task 8)
    │   ├── listings/BoatCard.test.tsx                             (new: Task 8)
    │   ├── listings/FinanceDetailsDisclosure.tsx                  (new: Task 8)
    │   ├── listings/FinanceDetailsDisclosure.test.tsx             (new: Task 8)
    │   ├── listings/FinancingEstimateFieldset.tsx                 (new: Task 11)
    │   ├── listings/FinancingEstimateFieldset.test.tsx            (new: Task 11)
    │   ├── finance/FinanceCalculator.tsx                          (new: Task 10)
    │   └── finance/FinanceCalculator.test.tsx                     (new: Task 10)
    └── app/
        ├── boats/page.tsx                                         (new: Task 9)
        ├── boats/page.test.tsx                                    (new: Task 9)
        └── financing/page.tsx                                     (new: Task 10)
```

Generated migration filenames are whatever `makemigrations` produces; each task passes `--name` so the name above is the one that lands. The two hand-written migrations' filenames are exact.

---

### Task 1: Publish the broker finance settings into `ListingSnapshot`

**Files:**
- Modify: `backend/listings/models.py` (`ListingSnapshot`, after the `currency`/`price` pair)
- Modify: `backend/listings/snapshots.py` (`create_snapshot_from_revision`)
- Modify: `backend/listings/tests/factories.py` (`make_snapshot` defaults)
- Create: `backend/listings/tests/test_snapshot_finance_settings.py`
- Create (generated): `backend/listings/migrations/0005_listingsnapshot_finance_settings.py`
- Create (hand-written): `backend/listings/migrations/0006_backfill_snapshot_finance_settings.py`

**Interfaces:**
- Consumes: Phase 11's `listings.snapshots.create_snapshot_from_revision(*, listing, revision, cleaned_payload, approved_by, approved_at)`, `listings.models.ListingSnapshot`.
- Produces: `ListingSnapshot.show_finance_estimate: bool` (default `False`), `ListingSnapshot.finance_down_payment_override_percent: Decimal | None` (7,4), `ListingSnapshot.finance_rate_override_percent: Decimal | None` (7,4), `ListingSnapshot.finance_term_override_months: int | None` — all written only by `create_snapshot_from_revision`, all immutable once the row exists. Task 3 reads exactly these four names off `listing.current_public_snapshot`.
- **Assumed already merged, not built here:** `finance_down_payment_override_percent` is bounded at 0–99.99% and `finance_rate_override_percent` at 0–100% by `listings.payloads`. That per-field ceiling is the standalone prerequisite PR on branch **`fix-finance-percent-ceiling`** (see the scope ruling "an invalid stored override is ignored, not an error"), which lands on `dev` before this plan starts. This task touches neither `listings/payloads.py` nor `listings/tests/test_payloads.py`; it builds on the corrected write path and copies whatever the listing row holds. Task 3's read-time range check is the defence-in-depth half and stays, because it belongs with the code that *reads* the value, not with the write-path fix.

**Note (ruling — no database constraint ties the snapshot flag to `seller_type`).** `BoatListing` carries `listings_finance_flag_requires_broker` because both columns are on that row. The snapshot's `seller_type` lives on the listing, so the equivalent rule is cross-table and cannot be a `CheckConstraint`. It does not need to be: the snapshot copies a column the listing-level constraint already guarantees, and Task 3 re-checks `seller_type == BROKER` independently on every read (spec §18.2 lists it as its own condition, so the eligibility rule cannot rely on any single field carrying two meanings). Task 3's `test_a_private_listing_is_never_eligible_even_if_its_snapshot_says_otherwise` pins that independence.

- [ ] **Step 1: Write the failing tests**

Create `backend/listings/tests/test_snapshot_finance_settings.py`:

```python
"""The published finance settings live on the snapshot (spec §36.1, §11.4).

Spec §36.1: "Draft broker finance settings do not leak before publication."
Phase 11 contract rule 1: "Never read a listing's draft columns on a public
path. Public content comes from listing.current_public_snapshot only."

listings.drafts._apply_payload_to_listing writes show_finance_estimate and the
three override columns onto the BoatListing row the moment a broker saves a
draft, so those columns are draft state. These tests pin the copy that turns
them into published state.
"""

import itertools
from decimal import Decimal

import pytest
from django.utils import timezone

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from brokers.tests.factories import make_broker
from listings.enums import RevisionOrigin, RevisionStatus
from listings.snapshots import create_snapshot_from_revision
from listings.tests.factories import (
    make_broker_listing,
    make_private_listing,
    make_revision,
    make_snapshot,
)

_emails = itertools.count()


def _email(prefix):
    return f"{prefix}-{next(_emails)}@example.com"


def _agent():
    return make_user(email=_email("agent"), role=UserRole.BROKER_AGENT, verified=True)


def _moderator():
    return make_user(email=_email("moderator"), role=UserRole.STAFF, verified=True)


def _payload(listing):
    return {
        "title_en": "Motor yacht in excellent order",
        "description_en": "Twin engines, full service history.",
        "location_country": "ES",
        "location_city": "Palma",
        "currency": listing.currency,
        "price": f"{listing.price:f}",
        "media_ids": [],
    }


def _approve(listing, *, moderator):
    revision = make_revision(
        listing,
        state=RevisionStatus.DRAFT,
        origin=RevisionOrigin.OWNER,
        payload=_payload(listing),
    )
    return create_snapshot_from_revision(
        listing=listing,
        revision=revision,
        cleaned_payload=_payload(listing),
        approved_by=moderator,
        approved_at=timezone.now(),
    )


@pytest.mark.django_db
def test_the_snapshot_copies_the_listing_finance_settings_at_approval():
    agent = _agent()
    listing = make_broker_listing(
        broker=make_broker(name="Palma Yachts", slug="palma-yachts"),
        actor=agent,
        show_finance_estimate=True,
        finance_rate_override_percent=Decimal("4.2500"),
        finance_term_override_months=60,
        finance_down_payment_override_percent=Decimal("15.0000"),
    )

    snapshot = _approve(listing, moderator=_moderator())

    assert snapshot.show_finance_estimate is True
    assert snapshot.finance_rate_override_percent == Decimal("4.2500")
    assert snapshot.finance_term_override_months == 60
    assert snapshot.finance_down_payment_override_percent == Decimal("15.0000")


@pytest.mark.django_db
def test_a_later_draft_change_does_not_alter_the_published_snapshot():
    """Spec §36.1: draft broker finance settings do not leak before publication."""
    agent = _agent()
    listing = make_broker_listing(
        broker=make_broker(name="Ibiza Marine", slug="ibiza-marine"),
        actor=agent,
        show_finance_estimate=False,
    )
    snapshot = _approve(listing, moderator=_moderator())

    listing.show_finance_estimate = True
    listing.finance_rate_override_percent = Decimal("0.0100")
    listing.save(
        update_fields=["show_finance_estimate", "finance_rate_override_percent"]
    )
    snapshot.refresh_from_db()

    assert snapshot.show_finance_estimate is False
    assert snapshot.finance_rate_override_percent is None


@pytest.mark.django_db
def test_a_private_listing_publishes_with_finance_disabled():
    owner = make_user(
        email=_email("seller"), role=UserRole.PRIVATE_SELLER, verified=True
    )
    listing = make_private_listing(owner=owner)

    snapshot = _approve(listing, moderator=_moderator())

    assert snapshot.show_finance_estimate is False
    assert snapshot.finance_rate_override_percent is None
    assert snapshot.finance_term_override_months is None
    assert snapshot.finance_down_payment_override_percent is None


@pytest.mark.django_db
def test_the_finance_columns_are_immutable_like_the_rest_of_the_snapshot():
    """Phase 11 contract rule 3: never mutate a ListingSnapshot row."""
    owner = make_user(
        email=_email("seller"), role=UserRole.PRIVATE_SELLER, verified=True
    )
    listing = make_private_listing(owner=owner)
    snapshot = make_snapshot(listing, approved_by=_moderator())

    snapshot.show_finance_estimate = True

    with pytest.raises(ValueError):
        snapshot.save(update_fields=["show_finance_estimate"])
```

That is the whole of this task's new test surface. **`backend/listings/tests/test_payloads.py` is not touched.** The per-field percent ceiling it would have covered is the standalone `fix-finance-percent-ceiling` PR's, and that PR carries its own write-path unit tests; duplicating them here would test merged code this task does not change. (Note for anyone diffing against an earlier draft of this plan: that draft's two additions took a `broker_listing` fixture parameter. No such fixture exists — `listings/tests/test_payloads.py` defines no `@pytest.fixture` at all and its existing tests, including `test_a_broker_may_send_finance_fields`, build a listing inline with `make_broker_listing(broker=make_broker(), actor=make_user(email=OWNER_EMAIL))`. If the prerequisite PR adds tests there, that is the pattern to follow.)

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd backend
uv run pytest listings/tests/test_snapshot_finance_settings.py -v
```

Expected: all four new snapshot tests fail with `TypeError: ListingSnapshot() got unexpected keyword arguments: 'show_finance_estimate'` (or `AttributeError` on the assertion).

- [ ] **Step 3a: Add the four columns to `ListingSnapshot`**

In `backend/listings/models.py`, inside `class ListingSnapshot`, immediately after the existing `price` field and before `media_manifest`:

```python
    # Spec §18.2 reads these four as "listing.show_finance_estimate" etc. They
    # are snapshotted rather than read off the BoatListing row because those
    # columns are draft state (listings.drafts._apply_payload_to_listing writes
    # them on every draft save) and spec §36.1 requires that "draft broker
    # finance settings do not leak before publication". Written only by
    # listings.snapshots.create_snapshot_from_revision; read only by
    # finance.listing_quotes.
    show_finance_estimate = models.BooleanField(default=False)
    finance_down_payment_override_percent = models.DecimalField(
        max_digits=7, decimal_places=4, null=True, blank=True
    )
    finance_rate_override_percent = models.DecimalField(
        max_digits=7, decimal_places=4, null=True, blank=True
    )
    finance_term_override_months = models.PositiveIntegerField(null=True, blank=True)
```

- [ ] **Step 3b: Copy them in the snapshot builder**

In `backend/listings/snapshots.py`, add four keyword arguments to the `ListingSnapshot.objects.create(...)` call inside `create_snapshot_from_revision`, directly after `price=Decimal(cleaned_payload["price"]),`:

```python
        show_finance_estimate=listing.show_finance_estimate,
        finance_down_payment_override_percent=(
            listing.finance_down_payment_override_percent
        ),
        finance_rate_override_percent=listing.finance_rate_override_percent,
        finance_term_override_months=listing.finance_term_override_months,
```

Replace that function's docstring so its "two sources" note stays true:

```python
    """Freeze the approved content into the next immutable snapshot version.

    Two sources, deliberately: free-text content comes from `cleaned_payload`
    (the revision's own re-validated document), while the four taxonomy fields
    and the four broker finance settings come from the **listing columns**,
    which are where spec §11.4 puts them. Those columns are kept in step with
    every accepted payload by `listings.drafts._apply_payload_to_listing`,
    which every service that accepts a payload calls — including a §20.3 staff
    correction of a locked field, so such a correction really does reach this
    snapshot. Copying the finance settings here is what makes spec §36.1's
    "draft broker finance settings do not leak before publication" true: the
    public card reads this snapshot, never the draft column.
    """
```

- [ ] **Step 3c: Give the snapshot factory the same defaults**

In `backend/listings/tests/factories.py`, inside `make_snapshot`'s `defaults` dict, after `"price": listing.price,`:

```python
        "show_finance_estimate": listing.show_finance_estimate,
        "finance_down_payment_override_percent": (
            listing.finance_down_payment_override_percent
        ),
        "finance_rate_override_percent": listing.finance_rate_override_percent,
        "finance_term_override_months": listing.finance_term_override_months,
```

- [ ] **Step 3d: Generate the schema migration**

```bash
cd backend
uv run python manage.py makemigrations listings --name listingsnapshot_finance_settings
```

Expected: `backend/listings/migrations/0005_listingsnapshot_finance_settings.py` adding four fields to `listingsnapshot`. All four are nullable or defaulted, so Django asks no interactive question.

- [ ] **Step 3e: Write the backfill migration**

> **Controller verification required before merging this task.** The migration's docstring below asserts that it "runs against zero rows in every environment that exists today". That is a claim about live data, not about code, and nothing in this plan can prove it. **Before merging this task** (and, since the same claim underwrites the prerequisite ceiling fix's safety, ideally before `fix-finance-percent-ceiling` merges too, whichever comes first), the controller must run this against each real database — production, staging, and any long-lived shared dev database — and confirm every one returns `0`:
>
> ```bash
> cd backend
> uv run python manage.py shell -c "
> from listings.models import BoatListing
> from decimal import Decimal
> print(BoatListing.objects.filter(
>     finance_down_payment_override_percent__gt=Decimal('99.99')
> ).count())
> "
> ```
>
> A non-zero count means a stored override already exceeds spec §17.3's ceiling and would be carried onto a public snapshot by this migration. In that case: stop, decide explicitly what those listings should publish (Task 3's read-time range check would silently fall them back to the global down payment, which is the safe behaviour but a *silent* change to a live listing's stated terms), and record the decision before proceeding. Do not treat the docstring as evidence.

Create `backend/listings/migrations/0006_backfill_snapshot_finance_settings.py`:

```python
"""Carry each broker listing's stored finance settings onto its snapshots.

Migration 0005 defaults every existing snapshot to finance-off. For a broker
listing that already has the toggle on, that would silently remove a live
public estimate on deploy, so the values are copied forward here.

There is no per-version history to recover — the columns did not exist before
now — so every snapshot of a listing receives that listing's current values.
This is expected to run against zero rows in every environment that exists
today (no broker listing has been published with the toggle on) and is written
anyway so the migration is correct wherever it is applied. That expectation is
verified against each real database by the controller before this migration
merges, not assumed — see the Phase 9 plan's Task 1, Step 3e.

`apps.get_model` returns the historical model, which carries Django's plain
default manager rather than listings.models.ListingSnapshotQuerySet — so the
.update() below is not blocked by that queryset's refusal. Phase 11 contract
rule 3 ("never mutate a ListingSnapshot") governs application code; a schema
backfill inside the migration that adds the columns is the one sanctioned place.
"""

from django.db import migrations

BROKER = "BROKER"


def copy_finance_settings_onto_snapshots(apps, schema_editor):
    BoatListing = apps.get_model("listings", "BoatListing")
    ListingSnapshot = apps.get_model("listings", "ListingSnapshot")

    configured = BoatListing.objects.filter(seller_type=BROKER).exclude(
        show_finance_estimate=False,
        finance_down_payment_override_percent__isnull=True,
        finance_rate_override_percent__isnull=True,
        finance_term_override_months__isnull=True,
    )
    for listing in configured.iterator():
        ListingSnapshot.objects.filter(listing_id=listing.pk).update(
            show_finance_estimate=listing.show_finance_estimate,
            finance_down_payment_override_percent=(
                listing.finance_down_payment_override_percent
            ),
            finance_rate_override_percent=listing.finance_rate_override_percent,
            finance_term_override_months=listing.finance_term_override_months,
        )


def noop_reverse(apps, schema_editor):
    """Reversing 0005 drops the columns outright; there is nothing to undo."""


class Migration(migrations.Migration):
    dependencies = [("listings", "0005_listingsnapshot_finance_settings")]
    operations = [
        migrations.RunPython(copy_finance_settings_onto_snapshots, noop_reverse)
    ]
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd backend
uv run python manage.py migrate
uv run pytest listings/ -v
```

Expected: the four new snapshot tests PASS, and Phase 11's whole `listings` suite still passes untouched — the factory change keeps every existing `make_snapshot` call working and the new columns are additive. `listings/tests/test_payloads.py` is not modified by this task and must pass exactly as it stands on `dev` (including whatever the prerequisite `fix-finance-percent-ceiling` PR added to it).

- [ ] **Step 5: Commit**

```bash
git add backend/listings
git commit -m "feat(listings): publish broker finance settings into the immutable snapshot"
```

---

### Task 2: `finance.broker_overrides_enabled` setting, the `finance_estimates` rollout flag, and the public finance configuration

**Files:**
- Modify: `backend/platform_settings/registry.py`
- Modify: `backend/platform_settings/views.py`
- Modify: `backend/platform_settings/tests/test_registry.py` (add one key, add one case, rename one test)
- Modify: `backend/platform_settings/tests/test_views.py` (**add** two cases; change none)
- Create: `backend/platform_settings/migrations/0005_seed_finance_broker_overrides_setting.py`
- Create: `backend/finance/migrations/0003_seed_finance_estimates_flag.py`
- Create: `backend/finance/tests/test_finance_policy_rows.py`

**Interfaces:**
- Consumes: `platform_settings.registry.SETTINGS_REGISTRY`, `SettingDefinition`, `SettingValueType`, `_no_extra_validation`; `platform_settings.services.get_setting_value`, `is_feature_enabled`, `get_public_settings`; Phase 8's `finance.services.FinanceConfigurationService.get_active_configuration()` and `finance.models.FinanceConfigurationVersion`.
- Produces:
  - the setting key `"finance.broker_overrides_enabled"` (boolean, default `True`, **`is_public=False`**) and the feature-flag key `"finance_estimates"` (seeded `is_enabled=False`). Task 3 reads both through `get_setting_value` / `is_feature_enabled`; no other module hard-codes either string except the two migrations, which repeat the literal on purpose.
  - one new top-level key on `GET /api/v1/platform/public-settings/`: `finance_configuration: {"version": int, "annual_rate_percent": str, "term_months": int, "down_payment_percent": str} | None`. Task 10 pre-fills the standalone `/financing/` calculator from it and Task 11's `defaults` prop takes the same three assumption values. Nothing inside the existing `settings` sub-dict changes.

**Note (ruling — `is_public=False`, and what that buys).** `SettingDefinition.is_public` defaults to `True`, so this is the first key in the registry that has to say otherwise. It is staff-only policy: `FinancePolicy.load()` reads it server-side (Task 3) and no browser needs it — Task 11's `overridesEnabled` prop comes from Phase 16's form context, not from this endpoint. The consequence that matters for this task: `get_public_settings()` filters on `definition.is_public`, so the key never enters the `settings` dict, and **`platform_settings/tests/test_views.py::test_public_settings_endpoint_returns_all_seeded_keys` — which asserts exact dict equality over that payload — needs no edit at all.** It stays untouched. Step 3d below *adds* new tests to that file; it changes none. (The registry test is a different matter: `test_registry_defines_exactly_the_twelve_spec_keys` compares the whole key set regardless of visibility, so it does change, with its reason written into the file.)

**Note (ruling — the flag seeds disabled, the setting seeds enabled).** Spec §35.2 step 4 ships code ahead of the feature, and Phase 11's `listing_revisions` flag set the precedent (`is_enabled=False`, "seeded disabled so code can ship ahead of the feature"). `finance_estimates` follows it. `finance.broker_overrides_enabled` is different in kind: it is not a rollout switch but spec §17.2's standing capability, whose described default is that overrides *are* supported ("For release 1.0, broker overrides are supported but optional"), so it seeds `true` and staff turn it off if they ever want to.

- [ ] **Step 1: Write the failing tests**

Create `backend/finance/tests/test_finance_policy_rows.py`:

```python
"""The two staff-controlled switches this phase adds (spec §17.2, §35.1)."""

import pytest

from platform_settings.models import FeatureFlag, PlatformSetting
from platform_settings.services import get_setting_value, is_feature_enabled


@pytest.mark.django_db
def test_the_broker_override_switch_is_seeded_and_defaults_to_enabled():
    """Spec §17.2: "For release 1.0, broker overrides are supported but
    optional" and "Staff can disable override capability globally without
    altering existing stored values"."""
    assert PlatformSetting.objects.filter(
        key="finance.broker_overrides_enabled"
    ).exists()
    assert get_setting_value("finance.broker_overrides_enabled") is True


@pytest.mark.django_db
def test_the_finance_estimates_flag_is_seeded_disabled():
    """Spec §35.1 rollout flag, §35.2 step 4: code ships ahead of the feature."""
    flag = FeatureFlag.objects.get(key="finance_estimates")

    assert flag.is_enabled is False
    assert is_feature_enabled("finance_estimates", default=False) is False
```

In `backend/platform_settings/tests/test_registry.py`, add the new key to `EXPECTED_KEYS_AND_DEFAULTS` directly after `"finance.enabled"`, rename the set-comparison test, and add the visibility case. Keep the other eleven entries exactly as they are in the real file:

```python
    "finance.enabled": (SettingValueType.BOOLEAN, True),
    # Spec §17.2 requires a global switch for broker finance overrides ("Staff
    # can disable override capability globally without altering existing stored
    # values") and gives it no home: §10.1's table has no such key and §11.6's
    # FinanceConfigurationVersion has no such column. The Phase 9 plan's scope
    # ruling puts it here, in the typed audited registry §10.1 exists to hold,
    # rather than inventing a column on the immutable configuration model or
    # stretching §35.1's closed flag list. This test is the contract for §10.1's
    # table, so the deviation is recorded here rather than silently absorbed.
    # It is the registry's only non-public key (see the test below).
    "finance.broker_overrides_enabled": (SettingValueType.BOOLEAN, True),
```

```python
def test_registry_defines_the_spec_keys_plus_the_phase_9_override_switch():
    assert set(SETTINGS_REGISTRY) == set(EXPECTED_KEYS_AND_DEFAULTS)


def test_the_broker_override_switch_is_not_a_public_setting():
    """Staff-only policy, so `is_public=False` — the registry's only such key.

    FinancePolicy.load() reads it server-side and no browser consumer exists:
    the listing form's "use custom assumptions" control is gated by Phase 16's
    own staff-aware form context, not by the public settings payload. Keeping it
    non-public also means GET /api/v1/platform/public-settings/ is unchanged, so
    test_views.py::test_public_settings_endpoint_returns_all_seeded_keys — an
    exact-dict assertion over that payload — stays untouched by Phase 9.
    """
    assert SETTINGS_REGISTRY["finance.broker_overrides_enabled"].is_public is False
```

**Append** to `backend/platform_settings/tests/test_views.py`. Do not edit anything already in that file — in particular `test_public_settings_endpoint_returns_all_seeded_keys` keeps its exact twelve-key `body["settings"]` dict, because the new registry key is non-public and the new finance block is a *sibling* of `settings`, not a member of it:

```python
@pytest.mark.django_db
def test_public_settings_endpoint_publishes_the_active_finance_configuration(client):
    """Spec §2.1 and §17.5 (added by Phase 9).

    Spec §2.1: "Production UI must not display invented, hard-coded ...
    operational data", naming FinanceQuoteService among its examples. Spec
    §17.5: a staff change to the defaults "changes automatically affect boat
    cards and the finance page". /financing/ is a standalone route (§4.1) that a
    visitor can open with no listing, so the only honest way for it to show the
    platform's assumptions is for the server to send the real current ones.

    This publishes nothing new in kind: the same four values already ride on
    every eligible boat card in spec §18.5's finance block, on the same
    unauthenticated endpoint family. The three assumption values are decimal
    strings per spec §30.2; term_months and version are integers.
    """
    response = client.get("/api/v1/platform/public-settings/")

    assert response.status_code == 200
    assert response.json()["finance_configuration"] == {
        "version": 1,
        "annual_rate_percent": "5.0000",
        "term_months": 48,
        "down_payment_percent": "20.0000",
    }


@pytest.mark.django_db
def test_public_settings_endpoint_reports_no_finance_configuration_when_none_is_active(
    client,
):
    """The endpoint degrades, it never 500s. Phase 8's migration 0002 always
    seeds an active version, but a staff deletion in Django admin is reachable —
    the same degradation FinancePolicy.load() makes on the card path (Task 3).
    Task 10 renders an un-prefilled form on null rather than inventing numbers.
    """
    FinanceConfigurationVersion.objects.all().delete()
    FinanceConfigurationService._invalidate_cache()

    response = client.get("/api/v1/platform/public-settings/")

    assert response.status_code == 200
    assert response.json()["finance_configuration"] is None
```

with the imports these two need added to that file's import block:

```python
from finance.models import FinanceConfigurationVersion
from finance.services import FinanceConfigurationService
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd backend
uv run pytest finance/tests/test_finance_policy_rows.py platform_settings/ -v
```

Expected: `test_the_broker_override_switch_is_seeded_and_defaults_to_enabled` fails with `KeyError: 'Unknown platform setting key: finance.broker_overrides_enabled'`; `test_the_finance_estimates_flag_is_seeded_disabled` fails with `FeatureFlag.DoesNotExist`; the renamed registry test fails on the set comparison; `test_the_broker_override_switch_is_not_a_public_setting` fails with `KeyError`; both new view tests fail with `KeyError: 'finance_configuration'`. **`test_public_settings_endpoint_returns_all_seeded_keys` passes throughout** — if it does not, something has been made public that should not be.

- [ ] **Step 3a: Register the setting**

In `backend/platform_settings/registry.py`, add one entry to `SETTINGS_REGISTRY`, immediately after `"finance.enabled"`:

```python
    # Spec §17.2's global override capability. Not in §10.1's table — see the
    # scope ruling in docs/superpowers/plans/2026-09-18-phase-9-finance-ui.md.
    # Disabling it makes stored listing overrides ignored, never deleted.
    #
    # is_public=False (the only key in this registry that overrides the default):
    # this is a staff-only policy switch with no browser consumer. finance
    # .listing_quotes.FinancePolicy.load() reads it server-side; the listing
    # form's override controls are gated by Phase 16's staff-aware form context,
    # not by GET /api/v1/platform/public-settings/. Keeping it out of the public
    # payload avoids telling anonymous visitors how override policy is
    # configured, and leaves that endpoint's contract test unchanged.
    "finance.broker_overrides_enabled": SettingDefinition(
        "finance.broker_overrides_enabled",
        SettingValueType.BOOLEAN,
        True,
        _no_extra_validation,
        is_public=False,
    ),
```

- [ ] **Step 3b: Seed the setting row**

Migration `0002_seed_default_settings` has already run everywhere, so a new key needs its own seed. Create `backend/platform_settings/migrations/0005_seed_finance_broker_overrides_setting.py`:

```python
"""Seed spec §17.2's global broker-override switch (added by Phase 9).

Mirrors 0002_seed_default_settings' get_or_create shape so re-running is safe
(spec §38: every environment receives commands that *safely* create seed data).
"""

from django.db import migrations

SETTING_KEY = "finance.broker_overrides_enabled"
SETTING_DEFAULT = True


def seed_setting(apps, schema_editor):
    PlatformSetting = apps.get_model("platform_settings", "PlatformSetting")
    PlatformSetting.objects.get_or_create(
        key=SETTING_KEY, defaults={"value": SETTING_DEFAULT}
    )


def delete_setting(apps, schema_editor):
    PlatformSetting = apps.get_model("platform_settings", "PlatformSetting")
    PlatformSetting.objects.filter(key=SETTING_KEY).delete()


class Migration(migrations.Migration):
    dependencies = [("platform_settings", "0004_featureflag")]
    operations = [migrations.RunPython(seed_setting, delete_setting)]
```

- [ ] **Step 3c: Seed the rollout flag**

Create `backend/finance/migrations/0003_seed_finance_estimates_flag.py`:

```python
"""Seed spec §35.1's `finance_estimates` rollout flag.

The literal is repeated here rather than imported from finance.listing_quotes:
a data migration must keep working when application code moves, and this file
mirrors listings/migrations/0004_seed_listing_revisions_flag.py exactly.
"""

from django.db import migrations

FLAG_KEY = "finance_estimates"
FLAG_DESCRIPTION = (
    "Spec §35.1 rollout flag. Gates the listing finance surface: the `finance` "
    "block on public listing responses and the listing_id context of "
    "POST /api/v1/finance/quotes/. Does not gate the manual calculator, which "
    "Phase 8 shipped ungated. Seeded disabled so code can ship ahead of the "
    "feature (spec §35.2 step 4)."
)


def create_flag(apps, schema_editor):
    FeatureFlag = apps.get_model("platform_settings", "FeatureFlag")
    FeatureFlag.objects.get_or_create(
        key=FLAG_KEY,
        defaults={"is_enabled": False, "description": FLAG_DESCRIPTION},
    )


def delete_flag(apps, schema_editor):
    FeatureFlag = apps.get_model("platform_settings", "FeatureFlag")
    FeatureFlag.objects.filter(key=FLAG_KEY).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("finance", "0002_seed_default_configuration"),
        ("platform_settings", "0004_featureflag"),
    ]

    operations = [migrations.RunPython(create_flag, delete_flag)]
```

- [ ] **Step 3d: Publish the active finance configuration on the public settings endpoint**

Replace `backend/platform_settings/views.py` in full (it is fourteen lines today):

```python
from decimal import Decimal

from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from finance.models import FinanceConfigurationVersion
from finance.services import FinanceConfigurationService

from .services import get_public_settings


def _active_finance_configuration() -> dict | None:
    """Spec §1's global finance defaults as the platform currently holds them.

    Published because spec §2.1 forbids a production surface from showing
    invented or hard-coded operational data and spec §17.5 requires a staff
    change to reach "boat cards and the finance page" automatically. The
    standalone /financing/ calculator (spec §4.1) has no listing to read
    assumptions from, so without this it would have to either hard-code a stale
    copy of these numbers or show an empty form. Nothing new is disclosed: the
    same four values already appear on every eligible boat card in spec §18.5's
    finance block, on the same unauthenticated endpoint family.

    Read-only. Staff still change the defaults the one supported way, by
    activating a new FinanceConfigurationVersion.
    """
    try:
        configuration = FinanceConfigurationService.get_active_configuration()
    except FinanceConfigurationVersion.DoesNotExist:
        # Degrade, never 500 — same choice FinancePolicy.load() makes on the
        # card path. The caller renders an un-prefilled form rather than
        # inventing numbers.
        return None
    return {
        "version": configuration.version,
        # Spec §30.2: rates are decimal strings; §11.6 stores them at four
        # places. Matches finance.listing_quotes.format_percent exactly, so the
        # finance page and a boat card can never render one rate two ways.
        "annual_rate_percent": f"{configuration.annual_rate_percent.quantize(Decimal('0.0001')):f}",
        "term_months": configuration.term_months,
        "down_payment_percent": f"{configuration.down_payment_percent.quantize(Decimal('0.0001')):f}",
    }


class PublicPlatformSettingsView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        # Composed here rather than inside get_public_settings() on purpose.
        # That function caches its whole payload under "platform_settings:public"
        # with timeout=None and is invalidated only by update_setting(), which
        # activating a FinanceConfigurationVersion does not call — folding the
        # configuration in there would freeze it forever and quietly break spec
        # §17.5. Read through FinanceConfigurationService instead, which owns a
        # 300-second TTL that activate() invalidates on commit.
        return Response(
            {
                **get_public_settings(),
                "finance_configuration": _active_finance_configuration(),
            }
        )
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd backend
uv run python manage.py migrate
uv run python manage.py check
uv run pytest finance/ platform_settings/ -v
```

Expected: the two new policy-row tests, the renamed registry test, the new `is_public` test and the two new view tests all PASS, and **`test_public_settings_endpoint_returns_all_seeded_keys` passes unmodified** — the new registry key is `is_public=False` so it never reaches that payload's `settings` dict, and `finance_configuration` sits beside `settings`, not inside it. That test is the reason the key is non-public; if it fails, the `is_public=False` was dropped. `manage.py check` proves `platform_settings.views` importing `finance.services` closes no cycle (`finance.services` imports only `finance.models`, and nothing in `finance` imports `platform_settings.views`).

- [ ] **Step 5: Commit**

```bash
git add backend/platform_settings backend/finance
git commit -m "feat(finance): add the broker-override switch, the finance_estimates flag and the public finance configuration"
```

---

### Task 3: `finance.listing_quotes` — eligibility, configuration precedence and the §18.5 block

**Files:**
- Create: `backend/finance/listing_quotes.py`
- Create: `backend/finance/tests/test_listing_quotes.py`

**Interfaces:**
- Consumes: `finance.calculations.calculate_finance_quote(*, price, down_payment_percent, annual_rate_percent, term_months) -> FinanceQuoteCalculation`; `finance.services.FinanceConfigurationService.get_active_configuration()`; `finance.models.FinanceConfigurationVersion`; `finance.serializers.SUPPORTED_CURRENCIES`; `platform_settings.services.get_setting_value`, `is_feature_enabled`; `listings.models.BoatListing`; `listings.enums.ListingStatus`; `accounts.enums.SellerType`; the four snapshot columns from Task 1.
- Produces, all imported by Tasks 4, 5 and 12:
  - `FINANCE_ESTIMATES_FLAG: str`, `FINANCE_ENABLED_SETTING: str`, `BROKER_OVERRIDES_SETTING: str`
  - `GLOBAL: str`, `LISTING_OVERRIDE: str`, `REQUESTED: str`
  - `FinanceConfigurationUnavailable(RuntimeError)`
  - `FinancePolicy` (frozen dataclass: `estimates_enabled: bool`, `finance_enabled: bool`, `broker_overrides_enabled: bool`, `configuration: FinanceConfigurationVersion | None`; property `active: bool`; classmethod `load() -> FinancePolicy`)
  - `EffectiveAssumptions` (frozen dataclass: `annual_rate_percent: Decimal`, `term_months: int`, `down_payment_percent: Decimal`, `configuration_version: int`, `sources: dict[str, str]`)
  - `resolve_effective_assumptions(*, snapshot, policy) -> EffectiveAssumptions` — **precondition: `policy.configuration is not None`** (equivalently `policy.active`), enforced by an explicit `FinanceConfigurationUnavailable` raise rather than left implicit; see the ruling below
  - `FinanceQuoteService.is_visible(listing, *, policy) -> bool`
  - `FinanceQuoteService.card_block(listing, *, policy) -> dict`

**Note (ruling — this module is the `FinanceQuoteService` spec §31 names).** The traceability matrix's "Estimated installment" row names `FinanceQuoteService` as the backend source and "Finance assumptions" names "config version + listing overrides". Phase 8 shipped neither, because neither is meaningful without a listing. Both live here, in one module, because they change together: every rule that decides *whether* a listing may show finance also decides *which* numbers it shows.

**Note (ruling — `resolve_effective_assumptions` enforces its precondition instead of assuming it).** The function reads the global assumptions off `policy.configuration`, which is `FinanceConfigurationVersion | None`. Both of this phase's call sites — `card_block` (Task 3) and `_listing_quote` (Task 5) — reach it only after `FinanceQuoteService.is_visible()` returned `True`, which implies `policy.active`, which implies `configuration is not None`. So it cannot crash today. But this plan **exports the function to later phases** (see the Contract summary), and that precondition is invisible at the call site: a Phase 20 caller with a policy in hand and no listing to check visibility on would get `AttributeError: 'NoneType' object has no attribute 'annual_rate_percent'` from inside a module it did not write. **Decision:** guard explicitly and raise `FinanceConfigurationUnavailable` with a sentence naming the precondition and how to satisfy it. The signature is deliberately *not* narrowed to take a bare `configuration` — `policy` is also what carries `broker_overrides_enabled`, which the override half of this function needs, so splitting it would mean two parameters that must agree and a change rippling through Tasks 3, 5 and 12. A guard plus a test is the smaller, equally enforced change. The exception never reaches a public response: every public path checks `is_visible()` first and `card_block` returns `{"visible": False}` instead.

**Note (ruling — `FinancePolicy` is loaded once per request, not once per card).** `get_setting_value` queries Postgres on every call (no cache), so reading `finance.enabled` and `finance.broker_overrides_enabled` inside `card_block` would cost two queries per card — 48 on a 24-card page. `FinancePolicy.load()` gathers all four inputs once and is passed down as a keyword argument, which also makes every test able to state the policy it is testing instead of mutating global state. Task 4 caches one instance per serializer instance and proves it with a query-count test.

- [ ] **Step 1: Write the failing tests**

Create `backend/finance/tests/test_listing_quotes.py`:

```python
"""Listing eligibility and configuration precedence (spec §17.2, §18.2, §18.5).

The worked numbers come from spec §17.1's test-vector table and spec §40
Scenario C: a €459,000 broker listing with the global 20% / 5% / 48 months
must produce a €8,456.36 monthly payment.
"""

import itertools
from decimal import Decimal

import pytest

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from brokers.tests.factories import make_broker
from finance.listing_quotes import (
    GLOBAL,
    LISTING_OVERRIDE,
    FinanceConfigurationUnavailable,
    FinancePolicy,
    FinanceQuoteService,
    resolve_effective_assumptions,
)
from finance.models import FinanceConfigurationVersion
from finance.services import FinanceConfigurationService
from listings.enums import ListingStatus
from listings.tests.factories import (
    make_broker_listing,
    make_private_listing,
    make_snapshot,
)
from platform_settings.services import set_feature_flag, update_setting

_names = itertools.count()


def _moderator():
    return make_user(
        email=f"moderator-{next(_names)}@example.com",
        role=UserRole.STAFF,
        verified=True,
    )


def _agent():
    return make_user(
        email=f"agent-{next(_names)}@example.com",
        role=UserRole.BROKER_AGENT,
        verified=True,
    )


def _enable_estimates():
    set_feature_flag(key="finance_estimates", is_enabled=True, actor=None)


def _publish(listing, **snapshot_kwargs):
    snapshot = make_snapshot(listing, approved_by=_moderator(), **snapshot_kwargs)
    listing.status = ListingStatus.PUBLISHED
    listing.current_public_snapshot = snapshot
    listing.save(update_fields=["status", "current_public_snapshot"])
    return listing


def _broker_listing(**kwargs):
    index = next(_names)
    return make_broker_listing(
        broker=make_broker(name=f"Broker {index}", slug=f"broker-{index}"),
        actor=_agent(),
        price=Decimal("459000.00"),
        **kwargs,
    )


@pytest.fixture
def eligible_listing(db):
    _enable_estimates()
    return _publish(_broker_listing(show_finance_estimate=True))


@pytest.mark.django_db
def test_scenario_c_numbers(eligible_listing):
    """Spec §40 Scenario C: €459,000, 20% down, 5%, 48 months -> €8,456.36."""
    block = FinanceQuoteService.card_block(
        eligible_listing, policy=FinancePolicy.load()
    )

    assert block == {
        "visible": True,
        "monthly_payment": "8456.36",
        "annual_rate_percent": "5.0000",
        "term_months": 48,
        "down_payment_percent": "20.0000",
        "configuration_version": 1,
    }


@pytest.mark.django_db
def test_an_ineligible_listing_returns_exactly_one_key(eligible_listing):
    """Spec §18.5: "For ineligible listings return {"visible": false} and no
    assumptions"."""
    listing = _publish(_broker_listing(show_finance_estimate=False))

    block = FinanceQuoteService.card_block(listing, policy=FinancePolicy.load())

    assert block == {"visible": False}


@pytest.mark.django_db
def test_a_private_listing_is_never_eligible_even_if_its_snapshot_says_otherwise():
    """Spec §18.2 lists seller_type as its own condition, so the check may not
    lean on the database constraint that keeps the flag off broker-only rows."""
    _enable_estimates()
    owner = make_user(
        email=f"seller-{next(_names)}@example.com",
        role=UserRole.PRIVATE_SELLER,
        verified=True,
    )
    listing = _publish(
        make_private_listing(owner=owner, price=Decimal("459000.00")),
        show_finance_estimate=True,
    )

    assert FinanceQuoteService.is_visible(listing, policy=FinancePolicy.load()) is False


@pytest.mark.django_db
def test_a_listing_that_is_not_published_is_never_eligible(eligible_listing):
    eligible_listing.status = ListingStatus.SUSPENDED
    eligible_listing.save(update_fields=["status"])

    assert FinanceQuoteService.is_visible(
        eligible_listing, policy=FinancePolicy.load()
    ) is False


@pytest.mark.django_db
def test_the_global_kill_switch_hides_finance(eligible_listing):
    """Spec §36.1: "If global finance is disabled, listing flags remain stored
    but all public finance UI/API visibility is false"."""
    update_setting(key="finance.enabled", value=False, actor=None)

    assert FinanceQuoteService.is_visible(
        eligible_listing, policy=FinancePolicy.load()
    ) is False
    assert eligible_listing.current_public_snapshot.show_finance_estimate is True


@pytest.mark.django_db
def test_the_rollout_flag_hides_finance(eligible_listing):
    """Spec §35.1: flags gate frontend exposure and backend behaviour alike."""
    set_feature_flag(key="finance_estimates", is_enabled=False, actor=None)

    assert FinanceQuoteService.is_visible(
        eligible_listing, policy=FinancePolicy.load()
    ) is False


@pytest.mark.django_db
def test_an_unsupported_currency_hides_finance():
    _enable_estimates()
    listing = _publish(
        _broker_listing(show_finance_estimate=True), currency="USD"
    )

    assert FinanceQuoteService.is_visible(listing, policy=FinancePolicy.load()) is False


@pytest.mark.django_db
def test_a_price_above_the_spec_ceiling_hides_finance():
    """Spec §17.3: price 0.01-999,999,999.99. ListingSnapshot.price is
    decimal(14,2), so a larger published price is storable and must not reach
    the calculator."""
    _enable_estimates()
    listing = _publish(
        _broker_listing(show_finance_estimate=True), price=Decimal("1000000000.00")
    )

    assert FinanceQuoteService.is_visible(listing, policy=FinancePolicy.load()) is False


@pytest.mark.django_db
def test_a_valid_override_wins_and_reports_its_source():
    """Spec §17.2 step 2 and "Store/return the effective source of each value"."""
    _enable_estimates()
    listing = _publish(
        _broker_listing(
            show_finance_estimate=True,
            finance_rate_override_percent=Decimal("3.5000"),
        )
    )

    assumptions = resolve_effective_assumptions(
        snapshot=listing.current_public_snapshot, policy=FinancePolicy.load()
    )

    assert assumptions.annual_rate_percent == Decimal("3.5000")
    assert assumptions.sources == {
        "annual_rate_percent": LISTING_OVERRIDE,
        "term_months": GLOBAL,
        "down_payment_percent": GLOBAL,
    }


@pytest.mark.django_db
def test_a_globally_disabled_override_is_ignored_not_deleted():
    """Spec §17.2: "Staff can disable override capability globally without
    altering existing stored values; disabled overrides are ignored, not
    deleted"."""
    _enable_estimates()
    listing = _publish(
        _broker_listing(
            show_finance_estimate=True,
            finance_rate_override_percent=Decimal("3.5000"),
        )
    )
    update_setting(key="finance.broker_overrides_enabled", value=False, actor=None)

    assumptions = resolve_effective_assumptions(
        snapshot=listing.current_public_snapshot, policy=FinancePolicy.load()
    )

    assert assumptions.annual_rate_percent == Decimal("5.0000")
    assert assumptions.sources["annual_rate_percent"] == GLOBAL
    assert listing.current_public_snapshot.finance_rate_override_percent == Decimal(
        "3.5000"
    )


@pytest.mark.django_db
def test_an_out_of_range_stored_override_falls_back_to_the_global_value():
    """Spec §17.2 step 2 says to use "valid listing override fields"; §17.3
    bounds the term at 1-360. An out-of-range stored value must not reach the
    calculator and must not break the card."""
    _enable_estimates()
    listing = _publish(
        _broker_listing(show_finance_estimate=True, finance_term_override_months=400)
    )

    assumptions = resolve_effective_assumptions(
        snapshot=listing.current_public_snapshot, policy=FinancePolicy.load()
    )

    assert assumptions.term_months == 48
    assert assumptions.sources["term_months"] == GLOBAL


@pytest.mark.django_db
def test_a_new_active_configuration_changes_a_non_overridden_card(
    eligible_listing, django_capture_on_commit_callbacks
):
    """Spec §17.5: "Card APIs calculate with current effective configuration at
    request time". Spec §18 acceptance test 5.

    `django_capture_on_commit_callbacks(execute=True)` is load-bearing, not
    decoration: FinanceConfigurationService.activate() defers its cache
    invalidation to transaction.on_commit, which never fires inside a
    django_db test's wrapping transaction — without it, the 300-second cache
    entry the first card_block warmed would still answer with version 1 and
    this test would pass or fail for the wrong reason. Same pattern as Phase
    8's test_activate_deactivates_previous_version_and_invalidates_cache.
    """
    before = FinanceQuoteService.card_block(
        eligible_listing, policy=FinancePolicy.load()
    )

    with django_capture_on_commit_callbacks(execute=True):
        FinanceConfigurationService.activate(
            FinanceConfigurationVersion(
                annual_rate_percent=Decimal("6.0000"),
                term_months=48,
                down_payment_percent=Decimal("20.0000"),
            )
        )

    after = FinanceQuoteService.card_block(
        eligible_listing, policy=FinancePolicy.load()
    )
    assert before["monthly_payment"] == "8456.36"
    assert after["annual_rate_percent"] == "6.0000"
    assert after["configuration_version"] == 2
    assert after["monthly_payment"] != before["monthly_payment"]


@pytest.mark.django_db
def test_a_missing_active_configuration_hides_finance_instead_of_raising(
    eligible_listing,
):
    """A public card must degrade, never 500. Phase 8's migration always seeds
    a version, but a staff deletion in Django admin is reachable."""
    FinanceConfigurationVersion.objects.all().delete()
    FinanceConfigurationService._invalidate_cache()

    assert FinanceQuoteService.card_block(
        eligible_listing, policy=FinancePolicy.load()
    ) == {"visible": False}


@pytest.mark.django_db
def test_resolving_assumptions_without_a_configuration_raises_a_named_error():
    """resolve_effective_assumptions is exported to later phases (see the plan's
    Contract summary), and its precondition — an active configuration — is
    implied by is_visible() at both of this phase's call sites rather than stated
    at them. It is enforced here so a future caller that does not know the rule
    gets a sentence naming it instead of an AttributeError on None.
    """
    _enable_estimates()
    FinanceConfigurationVersion.objects.all().delete()
    FinanceConfigurationService._invalidate_cache()
    policy = FinancePolicy.load()
    assert policy.configuration is None

    with pytest.raises(FinanceConfigurationUnavailable):
        resolve_effective_assumptions(snapshot=None, policy=policy)
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd backend
uv run pytest finance/tests/test_listing_quotes.py -v
```

Expected: collection fails with `ModuleNotFoundError: No module named 'finance.listing_quotes'`.

- [ ] **Step 3: Write the module**

Create `backend/finance/listing_quotes.py`:

```python
"""Listing-aware finance rules (spec §17.2, §18.2, §18.5).

This module is the `FinanceQuoteService` spec §31's traceability matrix names
for the "Estimated installment" and "Finance assumptions" rows. Phase 8 owns
the arithmetic (finance.calculations) and the stored global defaults
(finance.models / finance.services); everything that depends on *a listing*
lives here.

Import direction (load-bearing): this module may import listings.models,
listings.enums and accounts.enums, and NOTHING else from the listings app.
listings.serializers imports this module, so importing listings.serializers or
listings.views from here would close an import cycle. The single consumer that
needs listings.views.published_listings_queryset is finance.views, which
nothing in listings imports.
"""

from dataclasses import dataclass
from decimal import Decimal

from accounts.enums import SellerType
from listings.enums import ListingStatus
from listings.models import BoatListing, ListingSnapshot
from platform_settings.services import get_setting_value, is_feature_enabled

from .calculations import calculate_finance_quote
from .models import FinanceConfigurationVersion
from .serializers import SUPPORTED_CURRENCIES
from .services import FinanceConfigurationService

FINANCE_ESTIMATES_FLAG = "finance_estimates"
FINANCE_ENABLED_SETTING = "finance.enabled"
BROKER_OVERRIDES_SETTING = "finance.broker_overrides_enabled"

#: Spec §17.2: "Store/return the effective source of each value: GLOBAL or
#: LISTING_OVERRIDE." REQUESTED is this plan's third value, used only by the
#: finance page's exploration mode (spec §36.1's "the finance page may let user
#: explore alternative rate/term/down payment values"), so a response can never
#: present a viewer's own input as a platform assumption.
GLOBAL = "GLOBAL"
LISTING_OVERRIDE = "LISTING_OVERRIDE"
REQUESTED = "REQUESTED"

ASSUMPTION_FIELDS = ("annual_rate_percent", "term_months", "down_payment_percent")

# Spec §17.3's validation ranges, restated here because this module applies them
# to values that were validated when they were *stored* and must be re-checked
# when they are *read* (a validator can change; a stored row does not).
MIN_PRICE = Decimal("0.01")
MAX_PRICE = Decimal("999999999.99")
MIN_RATE_PERCENT = Decimal("0")
MAX_RATE_PERCENT = Decimal("100")
MIN_DOWN_PAYMENT_PERCENT = Decimal("0")
MAX_DOWN_PAYMENT_PERCENT = Decimal("99.99")
MIN_TERM_MONTHS = 1
MAX_TERM_MONTHS = 360


class FinanceConfigurationUnavailable(RuntimeError):
    """Raised when effective assumptions are asked for with no active
    configuration to resolve them against.

    This never reaches a public response. Every public path checks
    FinanceQuoteService.is_visible() first (which implies FinancePolicy.active,
    which implies a configuration), and card_block() answers {"visible": False}
    instead of raising. It exists so that a later phase calling the exported
    resolve_effective_assumptions() without that precondition fails loudly at
    its own call site, with a sentence naming what is missing, rather than
    dereferencing None deep inside this module.
    """


@dataclass(frozen=True)
class FinancePolicy:
    """The request-scoped answer to "is finance on, and may brokers override?".

    Loaded once per request and passed down, because get_setting_value() hits
    Postgres on every call: resolving it per card would cost two queries per
    row of a 24-card page.
    """

    estimates_enabled: bool
    finance_enabled: bool
    broker_overrides_enabled: bool
    configuration: FinanceConfigurationVersion | None

    @property
    def active(self) -> bool:
        return (
            self.estimates_enabled
            and self.finance_enabled
            and self.configuration is not None
        )

    @classmethod
    def load(cls) -> "FinancePolicy":
        estimates_enabled = is_feature_enabled(FINANCE_ESTIMATES_FLAG, default=False)
        finance_enabled = bool(get_setting_value(FINANCE_ENABLED_SETTING))
        configuration = None
        if estimates_enabled and finance_enabled:
            try:
                configuration = FinanceConfigurationService.get_active_configuration()
            except FinanceConfigurationVersion.DoesNotExist:
                # Phase 8's migration 0002 always seeds a version, but staff can
                # delete rows in Django admin. A public card degrades to "no
                # finance"; it never 500s.
                configuration = None
        return cls(
            estimates_enabled=estimates_enabled,
            finance_enabled=finance_enabled,
            broker_overrides_enabled=bool(get_setting_value(BROKER_OVERRIDES_SETTING)),
            configuration=configuration,
        )


@dataclass(frozen=True)
class EffectiveAssumptions:
    """The three numbers a quote is calculated from, plus where each came from."""

    annual_rate_percent: Decimal
    term_months: int
    down_payment_percent: Decimal
    configuration_version: int
    sources: dict[str, str]


def _in_range(value, *, minimum, maximum):
    """Spec §17.2 step 2: only *valid* stored overrides are applied."""
    if value is None:
        return None
    return value if minimum <= value <= maximum else None


def resolve_effective_assumptions(
    *, snapshot: ListingSnapshot | None, policy: FinancePolicy
) -> EffectiveAssumptions:
    """Spec §17.2's precedence: global configuration, then valid listing
    overrides when staff permit them.

    Precondition: `policy.configuration is not None` — equivalently,
    `policy.active` is True. Both call sites in this phase reach here only after
    FinanceQuoteService.is_visible() returned True, which implies it. The
    precondition is *enforced* rather than documented because this function is
    exported to later phases (see the Phase 9 plan's Contract summary), and a
    caller who does not know the implicit rule would otherwise get an
    AttributeError on None from inside a module it did not write.
    """
    configuration = policy.configuration
    if configuration is None:
        raise FinanceConfigurationUnavailable(
            "resolve_effective_assumptions() requires an active finance "
            "configuration to resolve against. Check FinancePolicy.active — or "
            "call FinanceQuoteService.is_visible() first, which implies it — "
            "before calling this. policy.configuration is None whenever finance "
            "is globally disabled, the finance_estimates flag is off, or no "
            "active FinanceConfigurationVersion row exists."
        )
    values = {
        "annual_rate_percent": configuration.annual_rate_percent,
        "term_months": configuration.term_months,
        "down_payment_percent": configuration.down_payment_percent,
    }
    sources = {field: GLOBAL for field in ASSUMPTION_FIELDS}

    if policy.broker_overrides_enabled and snapshot is not None:
        overrides = {
            "annual_rate_percent": _in_range(
                snapshot.finance_rate_override_percent,
                minimum=MIN_RATE_PERCENT,
                maximum=MAX_RATE_PERCENT,
            ),
            "term_months": _in_range(
                snapshot.finance_term_override_months,
                minimum=MIN_TERM_MONTHS,
                maximum=MAX_TERM_MONTHS,
            ),
            "down_payment_percent": _in_range(
                snapshot.finance_down_payment_override_percent,
                minimum=MIN_DOWN_PAYMENT_PERCENT,
                maximum=MAX_DOWN_PAYMENT_PERCENT,
            ),
        }
        for field, override in overrides.items():
            if override is not None:
                values[field] = override
                sources[field] = LISTING_OVERRIDE

    return EffectiveAssumptions(
        annual_rate_percent=values["annual_rate_percent"],
        term_months=values["term_months"],
        down_payment_percent=values["down_payment_percent"],
        configuration_version=configuration.version,
        sources=sources,
    )


def is_financeable_price(price, currency) -> bool:
    """Spec §18.2's "listing.price is valid AND listing.currency is supported"."""
    return (
        price is not None
        and MIN_PRICE <= price <= MAX_PRICE
        and currency in SUPPORTED_CURRENCIES
    )


def format_percent(value: Decimal) -> str:
    """Spec §30.2: rates are decimal strings; §11.6 stores them at 4 places."""
    return f"{value.quantize(Decimal('0.0001')):f}"


class FinanceQuoteService:
    """Spec §31's named backend source for the estimated installment."""

    @staticmethod
    def is_visible(listing: BoatListing, *, policy: FinancePolicy) -> bool:
        """Spec §18.2's conjunction, in the order the spec writes it.

        Every condition is checked independently — in particular seller_type is
        not inferred from the snapshot's flag, even though a database constraint
        keeps that flag off private listings today.
        """
        snapshot = listing.current_public_snapshot
        return (
            listing.seller_type == SellerType.BROKER
            and snapshot is not None
            and snapshot.show_finance_estimate
            and policy.active
            and is_financeable_price(snapshot.price, snapshot.currency)
            and listing.status == ListingStatus.PUBLISHED
        )

    @staticmethod
    def card_block(listing: BoatListing, *, policy: FinancePolicy) -> dict:
        """Spec §18.5's `finance` block: six keys when eligible, one when not.

        Nothing between those two shapes is ever returned — spec §18.2: "Do not
        show zeros or disabled finance placeholders."
        """
        if not FinanceQuoteService.is_visible(listing, policy=policy):
            return {"visible": False}

        snapshot = listing.current_public_snapshot
        assumptions = resolve_effective_assumptions(snapshot=snapshot, policy=policy)
        result = calculate_finance_quote(
            price=snapshot.price,
            down_payment_percent=assumptions.down_payment_percent,
            annual_rate_percent=assumptions.annual_rate_percent,
            term_months=assumptions.term_months,
        )
        return {
            "visible": True,
            "monthly_payment": f"{result.monthly_payment:f}",
            "annual_rate_percent": format_percent(assumptions.annual_rate_percent),
            "term_months": assumptions.term_months,
            "down_payment_percent": format_percent(assumptions.down_payment_percent),
            "configuration_version": assumptions.configuration_version,
        }
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd backend
uv run python manage.py check
uv run pytest finance/ -v
```

Expected: all 14 new tests PASS and Phase 8's existing `finance` suite still passes. `manage.py check` proves the new cross-app import does not create a cycle.

- [ ] **Step 5: Commit**

```bash
git add backend/finance
git commit -m "feat(finance): add listing eligibility, override precedence and the card block"
```

---

### Task 4: The `finance` block on `PublicListingSerializer`

**Files:**
- Modify: `backend/listings/serializers.py` (`PublicListingSerializer`)
- Modify: `backend/listings/tests/test_public_read_api.py` (replace one Phase 11 test)
- Create: `backend/listings/tests/test_public_finance_block.py`

**Interfaces:**
- Consumes: `finance.listing_quotes.FinancePolicy`, `finance.listing_quotes.FinanceQuoteService` (Task 3).
- Produces: `finance` as a top-level key of every `GET /api/v1/listings/` result and every `GET /api/v1/listings/<id>/` response, carrying the spec §18.5 block. No other key of the representation changes. `PublicListingSerializer.finance_policy()` is the per-instance cache; nothing outside the serializer calls it.

**Note (ruling — one policy per serializer instance, not per row).** DRF builds one serializer per request and, under `many=True`, reuses a single `child` instance for every row, so caching the policy on the instance in `__init__` makes it load exactly once per request for both endpoints. This is why the policy is not resolved inside `FinanceQuoteService.card_block` itself.

**Note — this task deletes a Phase 11 test on purpose.** `listings/tests/test_public_read_api.py::test_the_response_never_exposes_a_finance_block_in_this_phase` asserts `"finance" not in response.data`. It was correct for Phase 11 and is the thing this task exists to change. It is replaced in place, in the same commit, with a test asserting the block is present and closed to draft values — the "delete a contract test deliberately, with a written reason" pattern Phase 5's contract rule 1 sets out. The `forbidden` key set in the test above it stays exactly as it is: `show_finance_estimate` and the three override columns must still never appear as *top-level* keys.

- [ ] **Step 1: Write the failing tests**

Create `backend/listings/tests/test_public_finance_block.py`:

```python
"""Spec §18.5's finance block on the one public listing representation.

Spec §29.1: "Every boat card uses one component and one API representation."
Phase 11 contract rule 9: Phase 9 extends PublicListingSerializer rather than
adding a second representation — so these tests hit the real endpoints.
"""

import itertools
from decimal import Decimal

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from brokers.tests.factories import make_broker
from listings.enums import ListingStatus
from listings.tests.factories import (
    make_broker_listing,
    make_private_listing,
    make_snapshot,
)
from platform_settings.services import set_feature_flag

_names = itertools.count()


@pytest.fixture
def api():
    return APIClient()


def _staff():
    return make_user(
        email=f"moderator-{next(_names)}@example.com",
        role=UserRole.STAFF,
        verified=True,
    )


def _publish(listing, **snapshot_kwargs):
    snapshot = make_snapshot(listing, approved_by=_staff(), **snapshot_kwargs)
    listing.status = ListingStatus.PUBLISHED
    listing.current_public_snapshot = snapshot
    listing.published_at = timezone.now()
    listing.save(
        update_fields=["status", "current_public_snapshot", "published_at"]
    )
    return listing


def _broker_listing(**kwargs):
    index = next(_names)
    agent = make_user(
        email=f"agent-{index}@example.com", role=UserRole.BROKER_AGENT, verified=True
    )
    return make_broker_listing(
        broker=make_broker(name=f"Broker {index}", slug=f"broker-{index}"),
        actor=agent,
        price=Decimal("459000.00"),
        **kwargs,
    )


def _private_listing():
    owner = make_user(
        email=f"seller-{next(_names)}@example.com",
        role=UserRole.PRIVATE_SELLER,
        verified=True,
    )
    return make_private_listing(owner=owner, price=Decimal("459000.00"))


@pytest.fixture
def estimates_on(db):
    set_feature_flag(key="finance_estimates", is_enabled=True, actor=None)


@pytest.mark.django_db
def test_the_detail_response_carries_the_spec_18_5_block(api, estimates_on):
    listing = _publish(_broker_listing(show_finance_estimate=True))

    response = api.get(reverse("listing-detail", kwargs={"listing_id": listing.pk}))

    assert response.status_code == 200
    assert response.data["finance"] == {
        "visible": True,
        "monthly_payment": "8456.36",
        "annual_rate_percent": "5.0000",
        "term_months": 48,
        "down_payment_percent": "20.0000",
        "configuration_version": 1,
    }


@pytest.mark.django_db
def test_the_list_response_carries_the_same_block(api, estimates_on):
    listing = _publish(_broker_listing(show_finance_estimate=True))

    response = api.get(reverse("listing-list"))

    card = next(
        row for row in response.data["results"] if row["id"] == str(listing.pk)
    )
    assert card["finance"]["monthly_payment"] == "8456.36"


@pytest.mark.django_db
def test_a_private_listing_carries_only_visible_false(api, estimates_on):
    """Spec §1: private-seller finance is never displayed. Spec §40 Scenario D."""
    listing = _publish(_private_listing())

    response = api.get(reverse("listing-detail", kwargs={"listing_id": listing.pk}))

    assert response.data["finance"] == {"visible": False}


@pytest.mark.django_db
def test_a_broker_listing_with_the_toggle_off_carries_only_visible_false(
    api, estimates_on
):
    listing = _publish(_broker_listing(show_finance_estimate=False))

    response = api.get(reverse("listing-detail", kwargs={"listing_id": listing.pk}))

    assert response.data["finance"] == {"visible": False}


@pytest.mark.django_db
def test_the_block_never_leaks_the_draft_toggle_or_the_override_columns(
    api, estimates_on
):
    """Spec §36.1: draft broker finance settings do not leak before publication."""
    listing = _publish(_broker_listing(show_finance_estimate=True))
    listing.show_finance_estimate = False
    listing.finance_rate_override_percent = Decimal("0.0100")
    listing.save(
        update_fields=["show_finance_estimate", "finance_rate_override_percent"]
    )

    response = api.get(reverse("listing-detail", kwargs={"listing_id": listing.pk}))

    assert response.data["finance"]["visible"] is True
    assert response.data["finance"]["annual_rate_percent"] == "5.0000"


@pytest.mark.django_db
def test_serializing_three_cards_costs_the_same_queries_as_one(api, estimates_on):
    """The finance policy is loaded once per request, not once per card.

    An exact query count would be brittle across unrelated changes; equality
    between a one-row and a three-row page is the property that matters.
    """
    _publish(_broker_listing(show_finance_estimate=True))
    url = reverse("listing-list")

    with CaptureQueriesContext(connection) as one_card:
        api.get(url)

    _publish(_broker_listing(show_finance_estimate=True))
    _publish(_broker_listing(show_finance_estimate=True))

    with CaptureQueriesContext(connection) as three_cards:
        api.get(url)

    assert len(three_cards) == len(one_card)
```

In `backend/listings/tests/test_public_read_api.py`, replace `test_the_response_never_exposes_a_finance_block_in_this_phase` with:

```python
@pytest.mark.django_db
def test_the_response_carries_a_finance_block_that_is_closed_for_a_private_seller(api):
    """Replaces Phase 11's test_the_response_never_exposes_a_finance_block_in_
    this_phase, which asserted the block's absence. Phase 9 (spec §18.5) adds
    it, so the contract this file pins changes here deliberately: the block
    exists on every public response and says exactly "not visible" for a
    private seller. The `forbidden` key set in the test above is unchanged —
    the four finance columns must still never appear as top-level keys.
    """
    listing, _ = _published()

    response = api.get(reverse("listing-detail", kwargs={"listing_id": listing.pk}))

    assert response.data["finance"] == {"visible": False}
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd backend
uv run pytest listings/tests/test_public_finance_block.py listings/tests/test_public_read_api.py -v
```

Expected: every new assertion fails with `KeyError: 'finance'`.

- [ ] **Step 3: Extend the serializer**

In `backend/listings/serializers.py`, add the import at the top of the module's import block:

```python
from finance.listing_quotes import FinancePolicy, FinanceQuoteService
```

Replace `PublicListingSerializer`'s docstring paragraph about the absent block, add the per-instance policy cache, and add the one new key:

```python
class PublicListingSerializer(serializers.Serializer):
    """Public representation, built ENTIRELY from the approved snapshot.

    Spec §11.4: "Public pages read from `current_public_snapshot`, not mutable
    draft fields." The only two values read off the listing row itself are
    facts *about the publication*, not about the content: `seller_type` (spec
    §29.1's private/broker badge, immutable for the owner per §20.3) and the
    publication timestamps. Everything a seller can edit comes from the
    snapshot, so a pending edit cannot reach this response — including the
    broker finance settings, which Phase 9 snapshots for exactly that reason
    (spec §36.1: "Draft broker finance settings do not leak before
    publication").

    The `finance` block is spec §18.5's, computed by finance.listing_quotes
    from the snapshot plus the live global configuration (spec §17.5). Still
    deliberately absent: CDN media URLs (spec §24 — Phase 15). That phase
    extends this serializer; it does not add a second public representation
    (spec §29.1).

    This serializer must only ever be fed rows from
    listings.views.published_listings_queryset(): it reads
    `current_public_snapshot` unconditionally and has no status gate of its own.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # One policy per serializer instance, not per row: DRF builds one
        # serializer per request and reuses a single `child` for every row of a
        # list, and FinancePolicy.load() costs two Postgres reads.
        self._finance_policy = None

    def finance_policy(self) -> FinancePolicy:
        if self._finance_policy is None:
            self._finance_policy = FinancePolicy.load()
        return self._finance_policy
```

and, inside `to_representation`'s returned dict, after `"view_count": listing.view_count_cached,`:

```python
            # Spec §18.5. Six keys when eligible, exactly {"visible": False}
            # when not — never zeros or a disabled placeholder (spec §18.2).
            "finance": FinanceQuoteService.card_block(
                listing, policy=self.finance_policy()
            ),
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd backend
uv run pytest listings/ finance/ -v
```

Expected: the six new tests and the replaced test PASS; the rest of Phase 11's public-read suite is unchanged and still passes.

- [ ] **Step 5: Commit**

```bash
git add backend/listings
git commit -m "feat(listings): add the spec 18.5 finance block to the public listing representation"
```

---

### Task 5: `POST /api/v1/finance/quotes/` learns the `listing_id` context

**Files:**
- Modify: `backend/finance/serializers.py`
- Modify: `backend/finance/views.py`
- Modify: `backend/config/settings/base.py` (one throttle rate)
- Modify: `backend/finance/tests/test_views.py` (**one line added to one expected dict, with its reason** — see the ruling below)
- Create: `backend/finance/tests/test_listing_quote_context.py`

**Interfaces:**
- Consumes: Task 3's `FinancePolicy`, `FinanceQuoteService`, `resolve_effective_assumptions`, `format_percent`, `GLOBAL`/`LISTING_OVERRIDE`/`REQUESTED`; `listings.views.published_listings_queryset()` (Phase 11 contract rule 1: the single definition of "publicly visible"); Phase 8's `calculate_finance_quote` and `FinanceQuoteRequestSerializer`.
- Produces: the spec §17.4 "context 1" request shape (`listing_id` plus optional assumption overrides, no required price) and two new response keys used by the frontend in Task 10 — `assumption_sources: {field: "GLOBAL"|"LISTING_OVERRIDE"|"REQUESTED"} | None` and a populated `configuration_version` for listing quotes. **`assumption_sources` is on both response paths** (`None` on a manual quote), which is what makes the two contexts one shape; the manual context's exact-dict contract test is widened accordingly, in this commit — see the ruling below. New error codes: `listing_not_found`, `finance_not_available_for_listing`, `price_mismatch`. New throttle scope `finance_quote` = `120/min`.

**Note (ruling — what a listing-context quote refuses).** Spec §17.4 says only that the server "loads price and permitted effective settings". Three refusals make that concrete and are chosen so the page always has a sensible next state: a `listing_id` that is not publicly published (including one that exists but is `DRAFT`, `SUSPENDED` or `EXPIRED`) is `404 listing_not_found`, because publication status is exactly what `published_listings_queryset` decides and a non-public listing must look absent (Phase 11's rule); a published listing that is not finance-eligible is `400 finance_not_available_for_listing`, which lets the page fall back to the plain calculator instead of pretending; and a client-supplied `price` that disagrees with the server's is `400 price_mismatch`, because §17.4 says the client price "must either be omitted or match" and silently overwriting it would hide a tampered link rather than refuse it.

**Note (ruling — exploration values are reported as `REQUESTED`).** Spec §36.1 permits the finance page to "let user explore alternative rate/term/down payment values, but the card defaults remain server-defined". So a listing-context request may carry assumption values, and each one the client supplied is reported in `assumption_sources` as `REQUESTED` — never as `GLOBAL` or `LISTING_OVERRIDE`, which are spec §17.2's two *platform* sources. The price is never client-controllable in this context. This is additive to §17.4's response example; §17.2's "Store/return the effective source of each value" is what requires the field to exist at all, and Phase 8 could not implement it because no listing existed.

**Note (ruling — the manual context's *behaviour* is unchanged, and its one locked-down contract test is widened by one key in this same commit).** With no `listing_id`, all five fields stay required, every computed value is bit-for-bit what Phase 8 returned, and `configuration_version` stays `null` (Phase 8's Task 7 ruling: a manual quote reads no stored configuration, so naming one would imply a relationship that does not exist). `assumption_sources` is `null` there for the same reason — a manual quote has no platform source to report.

But the key **is present on both paths**, because `_quote_response` below builds one response shape for both of spec §17.4's contexts. That is the deliberate choice, not an accident of the helper: a uniform shape is what lets Task 6's single `FinanceQuote` type carry `assumption_sources: Record<AssumptionField, AssumptionSource> | null` and cover both paths without a second type or a presence check, and it is why this plan's own `test_a_manual_quote_is_unchanged_by_this_phase` can assert `response.data["assumption_sources"] is None` — an assertion that requires the key to exist.

The consequence must be stated plainly rather than hedged: **`backend/finance/tests/test_views.py::test_finance_quote_endpoint_matches_spec_worked_example` asserts exact dict equality on a manual quote's eleven keys and therefore DOES break.** It is edited in this same commit — one `"assumption_sources": None` entry added to its expected dict, with the reason written into the test file — exactly the way Task 2 widens `test_registry_defines_exactly_the_twelve_spec_keys` and Task 4 replaces `test_the_response_never_exposes_a_finance_block_in_this_phase`. A locked-down contract test is changed deliberately, in the commit that changes the contract, with the argument recorded next to it. `finance/tests/test_serializers.py` genuinely is untouched: the request serializer's manual-context behaviour and error codes are unchanged.

- [ ] **Step 1: Write the failing tests**

Create `backend/finance/tests/test_listing_quote_context.py`:

```python
"""Spec §17.4 context 1: a quote for a listing (added by Phase 9).

Spec §18.3: "The finance page treats `listing` as the authority and ignores
tampered price parameters."
"""

import itertools
from decimal import Decimal

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from brokers.tests.factories import make_broker
from listings.enums import ListingStatus
from listings.tests.factories import (
    make_broker_listing,
    make_private_listing,
    make_snapshot,
)
from platform_settings.services import set_feature_flag

_names = itertools.count()
QUOTE_URL = reverse("finance-quote")


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def estimates_on(db):
    set_feature_flag(key="finance_estimates", is_enabled=True, actor=None)


def _staff():
    return make_user(
        email=f"moderator-{next(_names)}@example.com",
        role=UserRole.STAFF,
        verified=True,
    )


def _publish(listing, **snapshot_kwargs):
    snapshot = make_snapshot(listing, approved_by=_staff(), **snapshot_kwargs)
    listing.status = ListingStatus.PUBLISHED
    listing.current_public_snapshot = snapshot
    listing.published_at = timezone.now()
    listing.save(
        update_fields=["status", "current_public_snapshot", "published_at"]
    )
    return listing


def _broker_listing(**kwargs):
    index = next(_names)
    agent = make_user(
        email=f"agent-{index}@example.com", role=UserRole.BROKER_AGENT, verified=True
    )
    return make_broker_listing(
        broker=make_broker(name=f"Broker {index}", slug=f"broker-{index}"),
        actor=agent,
        price=Decimal("459000.00"),
        **kwargs,
    )


@pytest.fixture
def eligible(estimates_on):
    return _publish(_broker_listing(show_finance_estimate=True))


@pytest.mark.django_db
def test_a_listing_quote_needs_nothing_but_the_listing_id(api, eligible):
    """Spec §40 Scenario C, through the endpoint the finance page calls."""
    response = api.post(QUOTE_URL, {"listing_id": str(eligible.pk)}, format="json")

    assert response.status_code == 200
    assert response.data["price"] == "459000.00"
    assert response.data["currency"] == "EUR"
    assert response.data["down_payment_amount"] == "91800.00"
    assert response.data["principal"] == "367200.00"
    assert response.data["monthly_payment"] == "8456.36"
    assert response.data["term_months"] == 48
    assert response.data["annual_rate_percent"] == "5.0000"
    assert response.data["configuration_version"] == 1
    assert response.data["disclaimer_key"] == "finance.illustrative_disclaimer"
    assert response.data["assumption_sources"] == {
        "annual_rate_percent": "GLOBAL",
        "term_months": "GLOBAL",
        "down_payment_percent": "GLOBAL",
    }


@pytest.mark.django_db
def test_a_matching_client_price_is_accepted_and_the_server_value_is_returned(
    api, eligible
):
    response = api.post(
        QUOTE_URL,
        {"listing_id": str(eligible.pk), "price": "459000.00"},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["price"] == "459000.00"


@pytest.mark.django_db
def test_a_tampered_price_is_refused_rather_than_silently_replaced(api, eligible):
    """Spec §17.4: "a client-supplied price must either be omitted or match"."""
    response = api.post(
        QUOTE_URL,
        {"listing_id": str(eligible.pk), "price": "1.00"},
        format="json",
    )

    assert response.status_code == 400
    assert response.data["error"]["code"] == "price_mismatch"
    assert "1.00" not in str(response.data["error"].get("fields", {}).get("price", ""))


@pytest.mark.django_db
def test_an_unpublished_listing_is_not_found(api, estimates_on):
    listing = _broker_listing(show_finance_estimate=True)

    response = api.post(QUOTE_URL, {"listing_id": str(listing.pk)}, format="json")

    assert response.status_code == 404
    assert response.data["error"]["code"] == "listing_not_found"


@pytest.mark.django_db
def test_an_unknown_listing_is_not_found(api, estimates_on):
    response = api.post(
        QUOTE_URL,
        {"listing_id": "00000000-0000-4000-8000-000000000000"},
        format="json",
    )

    assert response.status_code == 404
    assert response.data["error"]["code"] == "listing_not_found"


@pytest.mark.django_db
def test_a_private_listing_is_refused(api, estimates_on):
    """Spec §40 Scenario D: public finance is not visible for a private seller,
    on every surface, including this one."""
    owner = make_user(
        email=f"seller-{next(_names)}@example.com",
        role=UserRole.PRIVATE_SELLER,
        verified=True,
    )
    listing = _publish(make_private_listing(owner=owner, price=Decimal("459000.00")))

    response = api.post(QUOTE_URL, {"listing_id": str(listing.pk)}, format="json")

    assert response.status_code == 400
    assert response.data["error"]["code"] == "finance_not_available_for_listing"


@pytest.mark.django_db
def test_a_broker_listing_with_the_toggle_off_is_refused(api, estimates_on):
    listing = _publish(_broker_listing(show_finance_estimate=False))

    response = api.post(QUOTE_URL, {"listing_id": str(listing.pk)}, format="json")

    assert response.status_code == 400
    assert response.data["error"]["code"] == "finance_not_available_for_listing"


@pytest.mark.django_db
def test_exploring_a_different_term_keeps_the_server_price_and_marks_the_source(
    api, eligible
):
    """Spec §36.1: the finance page may explore alternative values."""
    response = api.post(
        QUOTE_URL,
        {"listing_id": str(eligible.pk), "term_months": 60},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["term_months"] == 60
    assert response.data["price"] == "459000.00"
    assert response.data["assumption_sources"] == {
        "annual_rate_percent": "GLOBAL",
        "term_months": "REQUESTED",
        "down_payment_percent": "GLOBAL",
    }


@pytest.mark.django_db
def test_a_listing_override_is_reported_as_such(api, estimates_on):
    listing = _publish(
        _broker_listing(
            show_finance_estimate=True,
            finance_rate_override_percent=Decimal("3.5000"),
        )
    )

    response = api.post(QUOTE_URL, {"listing_id": str(listing.pk)}, format="json")

    assert response.data["annual_rate_percent"] == "3.5000"
    assert response.data["assumption_sources"]["annual_rate_percent"] == (
        "LISTING_OVERRIDE"
    )


@pytest.mark.django_db
def test_a_manual_quote_is_unchanged_by_this_phase(api):
    """Phase 8's context 2 keeps its exact behaviour: every field required, the
    same numbers, no configuration version and no platform assumption source.

    Note the shape: `assumption_sources` is *present and null*, not absent —
    both contexts share one response shape (see Task 5's ruling). This is the
    assertion that pins it, and it is why finance/tests/test_views.py's
    exact-dict test gains the same key in this commit.
    """
    response = api.post(
        QUOTE_URL,
        {
            "price": "248000.00",
            "down_payment_percent": "20.0000",
            "annual_rate_percent": "5.0000",
            "term_months": 48,
            "currency": "EUR",
        },
        format="json",
    )

    assert response.status_code == 200
    assert response.data["monthly_payment"] == "4569.01"
    assert response.data["configuration_version"] is None
    assert response.data["assumption_sources"] is None


@pytest.mark.django_db
def test_a_manual_quote_still_requires_every_field(api):
    response = api.post(QUOTE_URL, {"price": "248000.00"}, format="json")

    assert response.status_code == 400
    assert response.data["error"]["code"] == "validation_error"
    assert response.data["error"]["fields"]["term_months"][0].code == "required"
```

In `backend/finance/tests/test_views.py`, add **one entry plus its reason** to `test_finance_quote_endpoint_matches_spec_worked_example`'s expected dict, directly after the existing `"disclaimer_key"` line. Change nothing else in that file — every other key, value and comment stays byte-identical, which is the point: the numbers prove the manual calculation did not move.

```python
        "configuration_version": None,
        "disclaimer_key": "finance.illustrative_disclaimer",
        # Added by Phase 9 (docs/superpowers/plans/2026-09-18-phase-9-finance-ui
        # .md, Task 5). FinanceQuoteView._quote_response now builds ONE response
        # shape for both of spec §17.4's contexts, so `assumption_sources` is
        # present on a manual quote too — and is None here, because a manual
        # quote reads no stored configuration and no listing override, so there
        # is no platform source (§17.2's GLOBAL / LISTING_OVERRIDE) to report.
        #
        # This exact-dict assertion is Phase 8's locked contract for the manual
        # context and it is widened deliberately, in the same commit as the
        # change that widens the response. The alternative — omitting the key on
        # the manual path — would leave two response shapes behind one endpoint
        # and force the frontend's FinanceQuote type into an optional field or a
        # second type, for no gain. Every other key above is unchanged, and the
        # money values are the proof that the calculation itself did not move.
        "assumption_sources": None,
    }
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd backend
uv run pytest finance/tests/test_listing_quote_context.py finance/tests/test_views.py -v
```

Expected: the listing-context tests fail with `400` and `{"code": "validation_error", "fields": {"price": ["This field is required."], ...}}` — today's serializer rejects a body that carries only `listing_id`; `test_a_manual_quote_is_unchanged_by_this_phase` fails on `KeyError: 'assumption_sources'`; and the widened `test_finance_quote_endpoint_matches_spec_worked_example` fails on the dict comparison, because the response does not carry the key yet. All three go green together in Step 4.

- [ ] **Step 3a: Teach the request serializer the two contexts**

Replace `backend/finance/serializers.py` in full:

```python
from decimal import Decimal

from rest_framework import serializers
from rest_framework.exceptions import ErrorDetail

SUPPORTED_CURRENCIES = ("EUR",)

#: Spec §17.4 context 2 ("manual finance-page values"): with no listing to load
#: a price and settings from, the client must supply everything.
MANUAL_REQUIRED_FIELDS = (
    "price",
    "down_payment_percent",
    "annual_rate_percent",
    "term_months",
    "currency",
)


class FinanceQuoteRequestSerializer(serializers.Serializer):
    """Both spec §17.4 contexts in one body.

    Context 1 — `listing_id` present: the server loads price and currency from
    the listing's public snapshot and its effective assumptions (Phase 9). Every
    other field is optional; a supplied assumption is an exploration value
    (spec §36.1) and a supplied price must match the server's (§17.4).

    Context 2 — no `listing_id`: Phase 8's manual calculator, unchanged. All
    five fields are required, and they are required *here* rather than by
    `required=True` so that context 1 can legitimately omit them while the
    error codes context 2 produces stay exactly what they were (`required`).
    """

    listing_id = serializers.UUIDField(required=False)
    price = serializers.DecimalField(
        max_digits=11,
        decimal_places=2,
        min_value=Decimal("0.01"),
        max_value=Decimal("999999999.99"),
        required=False,
    )
    down_payment_percent = serializers.DecimalField(
        max_digits=7,
        decimal_places=4,
        min_value=Decimal("0"),
        max_value=Decimal("99.99"),
        required=False,
    )
    annual_rate_percent = serializers.DecimalField(
        max_digits=7,
        decimal_places=4,
        min_value=Decimal("0"),
        max_value=Decimal("100"),
        required=False,
    )
    term_months = serializers.IntegerField(min_value=1, max_value=360, required=False)
    currency = serializers.CharField(max_length=3, required=False)

    def validate_currency(self, value):
        normalized = value.upper()
        if normalized not in SUPPORTED_CURRENCIES:
            raise serializers.ValidationError(
                "Currency is not supported.", code="unsupported_currency"
            )
        return normalized

    def validate(self, attrs):
        if attrs.get("listing_id") is not None:
            return attrs
        missing = {
            field: [ErrorDetail("This field is required.", code="required")]
            for field in MANUAL_REQUIRED_FIELDS
            if field not in attrs
        }
        if missing:
            raise serializers.ValidationError(missing)
        return attrs
```

- [ ] **Step 3b: Resolve the listing in the view**

Replace `backend/finance/views.py` in full:

```python
from decimal import Decimal

from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from listings.views import published_listings_queryset

from .calculations import calculate_finance_quote
from .listing_quotes import (
    REQUESTED,
    FinancePolicy,
    FinanceQuoteService,
    format_percent,
    resolve_effective_assumptions,
)
from .serializers import FinanceQuoteRequestSerializer

DISCLAIMER_KEY = "finance.illustrative_disclaimer"


def _error_code_from_serializer_errors(errors):
    currency_errors = errors.get("currency")
    if currency_errors:
        for detail in currency_errors:
            if getattr(detail, "code", None) == "unsupported_currency":
                return "unsupported_currency"
    return "validation_error"


def _envelope(request, *, code, message, fields=None):
    return {
        "error": {
            "code": code,
            "message": message,
            "fields": fields or {},
            "request_id": request.headers.get("X-Request-ID", ""),
        }
    }


class FinanceQuoteView(APIView):
    """Spec §17.4's quote endpoint, both contexts.

    Context 1 (`listing_id`) is Phase 9's: the listing is the authority for
    price and currency, and spec §18.3 requires that a tampered query price
    cannot change the answer. Context 2 (explicit values) is Phase 8's manual
    calculator and is deliberately unchanged, including its null
    `configuration_version`.
    """

    permission_classes = [AllowAny]
    # Spec §30.4 asks for a user/IP-aware limit here while keeping "the
    # calculation itself reasonably accessible". The scope alone is enough:
    # Phase 3 installs common.throttling.HashedIPScopedRateThrottle as the
    # default class, which hashes the client IP before building the cache key.
    throttle_scope = "finance_quote"

    def post(self, request):
        serializer = FinanceQuoteRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                _envelope(
                    request,
                    code=_error_code_from_serializer_errors(serializer.errors),
                    message="One or more finance quote fields are invalid.",
                    fields=serializer.errors,
                ),
                status=400,
            )

        data = serializer.validated_data
        if data.get("listing_id") is not None:
            return self._listing_quote(request, data)
        return self._manual_quote(request, data)

    def _listing_quote(self, request, data):
        listing = (
            published_listings_queryset().filter(pk=data["listing_id"]).first()
        )
        if listing is None:
            return Response(
                _envelope(
                    request,
                    code="listing_not_found",
                    message="This listing is not available.",
                ),
                status=404,
            )

        policy = FinancePolicy.load()
        if not FinanceQuoteService.is_visible(listing, policy=policy):
            return Response(
                _envelope(
                    request,
                    code="finance_not_available_for_listing",
                    message="This listing does not show a financing estimate.",
                ),
                status=400,
            )

        snapshot = listing.current_public_snapshot
        if (
            data.get("price") is not None
            and data["price"] != snapshot.price
        ):
            return Response(
                _envelope(
                    request,
                    code="price_mismatch",
                    message="The price does not match this listing.",
                    fields={"price": ["The price does not match this listing."]},
                ),
                status=400,
            )

        assumptions = resolve_effective_assumptions(snapshot=snapshot, policy=policy)
        values = {
            "annual_rate_percent": assumptions.annual_rate_percent,
            "term_months": assumptions.term_months,
            "down_payment_percent": assumptions.down_payment_percent,
        }
        sources = dict(assumptions.sources)
        # Spec §36.1: the finance page may explore alternative values. Anything
        # the viewer supplied is reported as REQUESTED so a response can never
        # present a viewer's own input as a platform assumption (spec §17.2's
        # two sources are GLOBAL and LISTING_OVERRIDE).
        for field in values:
            if data.get(field) is not None:
                values[field] = data[field]
                sources[field] = REQUESTED

        return Response(
            self._quote_response(
                currency=snapshot.currency,
                price=snapshot.price,
                values=values,
                configuration_version=assumptions.configuration_version,
                sources=sources,
            ),
            status=200,
        )

    def _manual_quote(self, request, data):
        return Response(
            self._quote_response(
                currency=data["currency"],
                price=data["price"],
                values={
                    "annual_rate_percent": data["annual_rate_percent"],
                    "term_months": data["term_months"],
                    "down_payment_percent": data["down_payment_percent"],
                },
                # A manual quote reads no stored configuration, so naming one
                # would imply a relationship that does not exist (Phase 8's
                # Task 7 ruling, unchanged).
                configuration_version=None,
                sources=None,
            ),
            status=200,
        )

    @staticmethod
    def _quote_response(*, currency, price, values, configuration_version, sources):
        """One response shape for both of spec §17.4's contexts.

        `configuration_version` and `assumption_sources` are always present and
        are None on a manual quote, rather than being omitted there: two shapes
        behind one endpoint would force every client into a presence check and
        would need a second frontend type. Phase 8's
        test_finance_quote_endpoint_matches_spec_worked_example is widened by
        one key in this same commit because of this (see Task 5's ruling).
        """
        result = calculate_finance_quote(
            price=price,
            down_payment_percent=values["down_payment_percent"],
            annual_rate_percent=values["annual_rate_percent"],
            term_months=values["term_months"],
        )
        return {
            "currency": currency,
            "price": str(price.quantize(Decimal("0.01"))),
            "down_payment_amount": str(result.down_payment_amount),
            "principal": str(result.principal),
            "annual_rate_percent": format_percent(values["annual_rate_percent"]),
            "term_months": values["term_months"],
            "monthly_payment": str(result.monthly_payment),
            "total_payment": str(result.total_payment),
            "total_interest": str(result.total_interest),
            "configuration_version": configuration_version,
            "disclaimer_key": DISCLAIMER_KEY,
            "assumption_sources": sources,
        }
```

- [ ] **Step 3c: Add the throttle rate**

In `backend/config/settings/base.py`, add one key to the existing `REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]` dict, leaving every other key and its comments untouched:

```python
        # Spec §30.4 lists finance quote logging among the rate-limited
        # surfaces while allowing "the calculation itself [to] remain
        # reasonably accessible". The finance page recalculates on every
        # assumption change and each boat card's details disclosure fires one
        # request when it is opened, so the bucket is well above a browsing
        # session and well below scripted enumeration of the catalogue.
        "finance_quote": "120/min",
```

Do **not** add or change `DEFAULT_THROTTLE_CLASSES` (Phase 3 contract rule 9).

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd backend
uv run pytest finance/ listings/ -v
```

Expected: all 12 new tests PASS. The manual context's proof is two-part and neither part is "untouched":

- `finance/tests/test_serializers.py` passes **untouched** — the request serializer's manual-context behaviour, required-field set and error codes are genuinely unchanged.
- `finance/tests/test_views.py::test_finance_quote_endpoint_matches_spec_worked_example` passes with **exactly the one-line widening made in Step 1** (`"assumption_sources": None` plus its written reason) and no other edit. Every money value and `configuration_version: None` in that dict is unchanged, and that is what proves the manual calculation did not regress. If making it pass requires touching any other line, stop: the manual path has changed and it should not have.

- [ ] **Step 5: Commit**

```bash
git add backend/finance backend/config/settings/base.py
git commit -m "feat(finance): add the listing_id quote context and rate-limit the quote endpoint"
```

---

### Task 6: Frontend — the public listings API client

**Files:**
- Create: `frontend/src/lib/api/listings.ts`
- Create: `frontend/src/lib/api/listings.test.ts`

**Interfaces:**
- Consumes: `DIRECTORY_API_BASE_URL` and `type Paginated<T>` from `@/lib/api/directory` (Phase 5); `apiFetch` and `ApiError` from `@/lib/api/client` (Phase 3).
- Produces, imported by Tasks 8, 9 and 10:
  - `type ListingFinance = { visible: false } | { visible: true; monthly_payment: string; annual_rate_percent: string; term_months: number; down_payment_percent: string; configuration_version: number }`
  - `type PublicListing` (the full spec §18.5 / Phase 11 representation)
  - `type FinanceQuote` (the spec §17.4 response)
  - `type AssumptionSource = "GLOBAL" | "LISTING_OVERRIDE" | "REQUESTED"` and `type AssumptionField = "annual_rate_percent" | "term_months" | "down_payment_percent"` — the backend's two closed sets, mirrored, so `FinanceQuote.assumption_sources` is `Record<AssumptionField, AssumptionSource> | null` rather than an open `Record<string, …>`
  - `type FinanceConfigurationDefaults = { version: number; annual_rate_percent: string; term_months: number; down_payment_percent: string }`
  - `fetchPublishedListings(params: ListingSearch): Promise<Paginated<PublicListing> | null>`
  - `fetchPublishedListing(id: string): Promise<PublicListing | null>`
  - `fetchFinanceDefaults(): Promise<FinanceConfigurationDefaults | null>` — reads Task 2's `finance_configuration` key off `GET /api/v1/platform/public-settings/`; Task 10 pre-fills the calculator from it
  - `requestFinanceQuote(input: FinanceQuoteInput): Promise<FinanceQuote>` (throws `ApiError`)
  - `financingHref(listing: PublicListing): string`

**Note (ruling — `ListingFinance` is a discriminated union, not an object with optional fields).** Spec §18.5 defines two shapes, not one shape with holes. Typing it as a union means TypeScript refuses to read `monthly_payment` until the component has narrowed on `visible === true`, so "do not show zeros or disabled finance placeholders" (§18.2) is enforced by the compiler rather than by review.

**Note (ruling — `financingHref` lives here, next to the types).** Spec §18.3 fixes the CTA URL exactly. Building it in the card component would put a spec-literal string in a presentation file and make it untestable without rendering; building it here makes it one pure function with its own test, which Tasks 8 and 12 both assert against.

**Note — the base URL is imported, not redeclared.** Phase 5 named the constant `DIRECTORY_API_BASE_URL` when the directory was the only consumer. Redeclaring `process.env.NEXT_PUBLIC_API_BASE_URL` here would create a second source of truth for the same value (Phase 5 contract rule 12's principle). It is imported and aliased instead, and renaming it to `PUBLIC_API_BASE_URL` in a shared module is recorded in Known Limitations for whichever phase next touches both files.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/api/listings.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { financingHref, listingQuery, type PublicListing } from "@/lib/api/listings";

function listing(overrides: Partial<PublicListing> = {}): PublicListing {
  return {
    id: "3f1d2c4e-0000-4000-8000-000000000001",
    seller_type: "BROKER",
    snapshot_version: 1,
    published_at: "2026-09-18T08:00:00Z",
    expires_at: null,
    brand_name: "Beneteau",
    model_name: "Oceanis 46.1",
    custom_model_name: "",
    manufacture_year: 2021,
    title: { en: "Oceanis 46.1", it: "", es: "" },
    description: { en: "", it: "", es: "" },
    specifications: {},
    specifications_schema_version: 1,
    location: { country: "ES", region: "Illes Balears", city: "Palma" },
    price: { amount: "459000.00", currency: "EUR" },
    media: [],
    view_count: 149,
    finance: { visible: false },
    ...overrides,
  };
}

describe("financingHref", () => {
  it("builds the exact spec 18.3 target", () => {
    expect(financingHref(listing())).toBe(
      "/financing/?listing=3f1d2c4e-0000-4000-8000-000000000001&price=459000.00&currency=EUR",
    );
  });

  it("uses the server-formatted price verbatim", () => {
    expect(financingHref(listing({ price: { amount: "1250.50", currency: "EUR" } }))).toContain(
      "price=1250.50",
    );
  });
});

describe("listingQuery", () => {
  it("omits empty values so a bare page has a clean URL", () => {
    expect(listingQuery({ page: undefined, page_size: "" })).toBe("");
  });

  it("serializes the values it is given", () => {
    expect(listingQuery({ page: "2" })).toBe("?page=2");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd frontend
pnpm test src/lib/api/listings.test.ts
```

Expected: `Failed to resolve import "@/lib/api/listings"`.

- [ ] **Step 3: Write the client**

Create `frontend/src/lib/api/listings.ts`:

```ts
// Unauthenticated reads of the public listing API (spec §30.1:
// GET /api/v1/listings/ and GET /api/v1/listings/<id>/), plus the one POST the
// finance surfaces make. Server-rendered pages call the fetch helpers; client
// components call requestFinanceQuote through the browser client.
import { apiFetch } from "@/lib/api/client";
import { DIRECTORY_API_BASE_URL as PUBLIC_API_BASE_URL, type Paginated } from "@/lib/api/directory";

export type { Paginated };

export type SellerType = "PRIVATE" | "BROKER";

// Spec §18.5 defines two shapes, not one shape with optional fields: six keys
// when eligible, exactly one when not. Typing it as a union means a component
// cannot read monthly_payment without narrowing on visible === true, so spec
// §18.2's "do not show zeros or disabled finance placeholders" is a compile
// error rather than a review note.
export type ListingFinance =
  | { visible: false }
  | {
      visible: true;
      monthly_payment: string;
      annual_rate_percent: string;
      term_months: number;
      down_payment_percent: string;
      configuration_version: number;
    };

export interface ListingMedia {
  media_id: string;
  media_type: "IMAGE" | "VIDEO";
  storage_key: string;
  mime_type: string;
  sort_order: number;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  checksum_sha256: string;
}

export interface PublicListing {
  id: string;
  seller_type: SellerType;
  snapshot_version: number;
  published_at: string | null;
  expires_at: string | null;
  brand_name: string;
  model_name: string;
  custom_model_name: string;
  manufacture_year: number;
  title: { en: string; it: string; es: string };
  description: { en: string; it: string; es: string };
  specifications: Record<string, string | number | boolean | null>;
  specifications_schema_version: number;
  location: { country: string; region: string; city: string };
  // Spec §30.2: money as decimal strings. Never parsed for arithmetic — only
  // handed to Intl for display.
  price: { amount: string; currency: string };
  media: ListingMedia[];
  view_count: number;
  finance: ListingFinance;
}

// The backend's two closed sets, mirrored. AssumptionField is
// finance.listing_quotes.ASSUMPTION_FIELDS and AssumptionSource is §17.2's two
// platform sources plus this plan's REQUESTED. Typing the map as
// Record<AssumptionField, AssumptionSource> rather than Record<string, …> means
// a typo in a field name is a compile error and a consumer can index it without
// a possibly-undefined result.
export type AssumptionField =
  | "annual_rate_percent"
  | "term_months"
  | "down_payment_percent";

export type AssumptionSource = "GLOBAL" | "LISTING_OVERRIDE" | "REQUESTED";

/**
 * The active FinanceConfigurationVersion, as GET
 * /api/v1/platform/public-settings/ publishes it (Task 2). `null` when no
 * version is active. Structurally identical to FinancingEstimateFieldset's
 * `defaults` prop minus `version`, which is why Task 11 takes the same object.
 */
export interface FinanceConfigurationDefaults {
  version: number;
  annual_rate_percent: string;
  term_months: number;
  down_payment_percent: string;
}

export interface FinanceQuote {
  currency: string;
  price: string;
  down_payment_amount: string;
  principal: string;
  annual_rate_percent: string;
  term_months: number;
  monthly_payment: string;
  total_payment: string;
  total_interest: string;
  configuration_version: number | null;
  disclaimer_key: string;
  // Present on both of spec §17.4's contexts; null on a manual quote, which has
  // no platform source to report (Task 5).
  assumption_sources: Record<AssumptionField, AssumptionSource> | null;
}

export interface ListingSearch {
  page?: string;
  page_size?: string;
}

export function listingQuery(params: ListingSearch): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      search.set(key, value);
    }
  }
  const serialized = search.toString();
  return serialized ? `?${serialized}` : "";
}

// null means "the API answered 404". For the detail endpoint that is a real
// answer (not published, or never existed) and the page notFound()s on it.
async function publicFetch<T>(path: string): Promise<T | null> {
  const response = await fetch(`${PUBLIC_API_BASE_URL}${path}`, {
    headers: { Accept: "application/json" },
    // Listing content changes on every staff approval; never serve a stale
    // card from the build cache.
    cache: "no-store",
  });

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Listing API ${path} failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function fetchPublishedListings(
  params: ListingSearch = {},
): Promise<Paginated<PublicListing> | null> {
  return publicFetch<Paginated<PublicListing>>(`/api/v1/listings/${listingQuery(params)}`);
}

export async function fetchPublishedListing(id: string): Promise<PublicListing | null> {
  return publicFetch<PublicListing>(`/api/v1/listings/${encodeURIComponent(id)}/`);
}

/**
 * The platform's current finance assumptions, from the public settings endpoint
 * (Task 2). Returns null when the endpoint reports no active configuration, and
 * null rather than throwing when the endpoint is unreachable: a calculator that
 * starts un-prefilled is a worse page, not a broken one, and spec §2.1 forbids
 * substituting invented numbers for the real ones. Server components only —
 * `cache: "no-store"` so a staff activation (spec §17.5) is never served stale
 * from the build cache.
 */
export async function fetchFinanceDefaults(): Promise<FinanceConfigurationDefaults | null> {
  try {
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/v1/platform/public-settings/`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as {
      finance_configuration: FinanceConfigurationDefaults | null;
    };
    return body.finance_configuration ?? null;
  } catch {
    return null;
  }
}

export interface FinanceQuoteInput {
  listing_id?: string;
  price?: string;
  currency?: string;
  annual_rate_percent?: string;
  term_months?: number;
  down_payment_percent?: string;
}

/**
 * Spec §17.4. Throws ApiError (from lib/api/client) on any non-2xx, so a caller
 * can branch on `error.code` — `finance_not_available_for_listing` and
 * `listing_not_found` are both ordinary answers for the finance page.
 */
export async function requestFinanceQuote(input: FinanceQuoteInput): Promise<FinanceQuote> {
  return apiFetch<FinanceQuote>("/api/v1/finance/quotes/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/**
 * Spec §18.3's calculator target, exactly:
 * /financing/?listing=<uuid>&price=<server-formatted-price>&currency=EUR
 * The price is the server's own string and exists only as the finance page's
 * immediate display fallback while its authoritative quote loads.
 */
export function financingHref(listing: PublicListing): string {
  const search = new URLSearchParams({
    listing: listing.id,
    price: listing.price.amount,
    currency: listing.price.currency,
  });
  return `/financing/?${search.toString()}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd frontend
pnpm test src/lib/api/listings.test.ts
pnpm lint
```

Expected: four tests PASS; lint clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/api/listings.ts frontend/src/lib/api/listings.test.ts
git commit -m "feat(frontend): add the public listings API client and the spec 18.3 CTA builder"
```

---

### Task 7: Frontend — the EN/IT/ES finance dictionary and money formatting

**Files:**
- Create: `frontend/src/lib/i18n/finance.ts`
- Create: `frontend/src/lib/i18n/finance.test.ts`

**Interfaces:**
- Consumes: `type Locale`, `DEFAULT_LOCALE`, `SUPPORTED_LOCALES` from `@/lib/i18n/directory` (Phase 5 — `Locale` is declared once, in `lib/api/directory.ts`, and re-exported there; do not redeclare the union).
- Produces, imported by Tasks 8–11:
  - `FINANCE_MESSAGES: Record<string, Record<Locale, string>>`
  - `tf(locale: Locale, key: string, params?: Record<string, string | number>): string`
  - `formatMoney(locale: Locale, amount: string, currency: string): string`
  - `formatCount(locale: Locale, value: number): string`

**Note (ruling — a second dictionary, not an addition to Phase 5's).** `DIRECTORY_MESSAGES` is the directory's dictionary and its `t()` has no interpolation. Finance copy needs `{count}` substitution (`"{count} months"`), so `tf` adds it. Splitting by area also keeps Phase 5's dictionary test meaningful and follows "files that change together live together". Both remain plain typed objects — no i18n framework, per Phase 5's Task 13 ruling.

**Note (ruling — the locale→BCP-47 map).** `Intl` needs a locale tag, not the two-letter interface language. The platform operates in Spain and Italy and its money is euro, so `it → it-IT` and `es → es-ES` are exact and `en → en-IE` is chosen over `en-GB`/`en-US` because it is the euro-native English locale — a British or American tag would format a euro amount with foreign grouping conventions for a reader who is looking at a Spanish or Italian boat.

**Note (ruling — `Number()` for display only).** The API sends decimal strings and the server value is authoritative (spec §17 definition of done). `formatMoney` converts to `Number` solely to hand `Intl.NumberFormat` a numeric value. This is exact: spec §17.3 caps a price at 999,999,999.99 and IEEE-754 doubles represent every cent value far below that boundary exactly. No arithmetic is performed on the converted value anywhere in this plan — never a sum, never a rounding, never a derived figure.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/i18n/finance.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { SUPPORTED_LOCALES } from "@/lib/i18n/directory";
import { FINANCE_MESSAGES, formatCount, formatMoney, tf } from "@/lib/i18n/finance";

describe("FINANCE_MESSAGES", () => {
  it("has every locale for every key", () => {
    for (const [key, translations] of Object.entries(FINANCE_MESSAGES)) {
      for (const locale of SUPPORTED_LOCALES) {
        expect(translations[locale], `${key}.${locale}`).toBeTruthy();
      }
    }
  });

  it("carries the spec 37 keys this phase is responsible for", () => {
    for (const key of [
      "finance.estimated_payment",
      "finance.calculate",
      "finance.illustrative_disclaimer",
      "listing.views",
      "listing.finance_toggle",
    ]) {
      expect(FINANCE_MESSAGES[key], key).toBeDefined();
    }
  });

  it("never presents the estimate as a lender decision (spec 2.5)", () => {
    const forbidden = /\b(approved|pre-approved|guaranteed|offer|your rate)\b/i;
    for (const [key, translations] of Object.entries(FINANCE_MESSAGES)) {
      expect(forbidden.test(translations.en), `${key}.en`).toBe(false);
    }
  });
});

describe("tf", () => {
  it("throws on an unknown key rather than rendering it", () => {
    expect(() => tf("en", "finance.nope")).toThrow(/finance.nope/);
  });

  it("substitutes named parameters", () => {
    expect(tf("en", "finance.months", { count: 48 })).toBe("48 months");
  });
});

describe("formatMoney", () => {
  it("formats a decimal string as euro for the interface language", () => {
    expect(formatMoney("en", "8456.36", "EUR")).toBe("€8,456.36");
  });

  it("keeps both decimals on a round amount", () => {
    expect(formatMoney("en", "459000.00", "EUR")).toBe("€459,000.00");
  });
});

describe("formatCount", () => {
  it("groups thousands for the interface language", () => {
    expect(formatCount("en", 12345)).toBe("12,345");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd frontend
pnpm test src/lib/i18n/finance.test.ts
```

Expected: `Failed to resolve import "@/lib/i18n/finance"`.

- [ ] **Step 3: Write the dictionary**

Create `frontend/src/lib/i18n/finance.ts`:

```ts
// Spec §37: all new UI text has EN/IT/ES translation keys and no English is
// hard-coded inside components. A typed dictionary, not an i18n framework —
// the same ruling as Phase 5's Task 13. Separate from DIRECTORY_MESSAGES
// because this one interpolates and because finance copy changes for finance
// reasons.
//
// Spec §2.5: no string here may present the estimate as a lender decision.
// finance.test.ts fails the build if "approved", "pre-approved", "guaranteed",
// "offer" or "your rate" ever appears in the English copy.
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/directory";

type Translations = Record<Locale, string>;

export const FINANCE_MESSAGES: Record<string, Translations> = {
  // Spec §18.1 fixes the English label.
  "finance.estimated_payment": {
    en: "Estimated payment",
    it: "Rata stimata",
    es: "Cuota estimada",
  },
  "finance.per_month": { en: "/month", it: "/mese", es: "/mes" },
  // Spec §18.1 fixes the English CTA.
  "finance.calculate": {
    en: "Calculate your financing",
    it: "Calcola il tuo finanziamento",
    es: "Calcula tu financiación",
  },
  "finance.illustrative_disclaimer": {
    en: "Illustrative estimate only, calculated from platform settings. It is not a credit application, a lending decision or a commitment from any bank.",
    it: "Stima puramente indicativa, calcolata in base alle impostazioni della piattaforma. Non è una richiesta di credito, una decisione di finanziamento né un impegno da parte di alcuna banca.",
    es: "Estimación meramente ilustrativa, calculada a partir de la configuración de la plataforma. No es una solicitud de crédito, una decisión de financiación ni un compromiso de ningún banco.",
  },
  "finance.months": { en: "{count} months", it: "{count} mesi", es: "{count} meses" },
  "finance.details.show": {
    en: "Show assumptions",
    it: "Mostra le ipotesi",
    es: "Ver los supuestos",
  },
  "finance.details.hide": {
    en: "Hide assumptions",
    it: "Nascondi le ipotesi",
    es: "Ocultar los supuestos",
  },
  "finance.details.loading": {
    en: "Calculating…",
    it: "Calcolo in corso…",
    es: "Calculando…",
  },
  "finance.details.error": {
    en: "The estimate could not be calculated right now.",
    it: "Al momento non è stato possibile calcolare la stima.",
    es: "Ahora mismo no se ha podido calcular la estimación.",
  },
  "finance.down_payment": { en: "Down payment", it: "Anticipo", es: "Entrada" },
  "finance.amount_financed": {
    en: "Amount financed",
    it: "Importo finanziato",
    es: "Importe financiado",
  },
  "finance.term": { en: "Term", it: "Durata", es: "Plazo" },
  "finance.annual_rate": { en: "Annual rate", it: "Tasso annuo", es: "Tasa anual" },
  "finance.total_installments": {
    en: "Total installments",
    it: "Totale delle rate",
    es: "Total de las cuotas",
  },
  "finance.total_interest": {
    en: "Total interest",
    it: "Interessi totali",
    es: "Intereses totales",
  },
  // Spec §17.4: "The UI may separately show overall_cash_outlay =
  // total_payment + down_payment_amount but must label it clearly."
  "finance.overall_outlay": {
    en: "Down payment plus all installments",
    it: "Anticipo più tutte le rate",
    es: "Entrada más todas las cuotas",
  },
  "finance.page.title": {
    en: "Financing estimator",
    it: "Calcolatore di finanziamento",
    es: "Calculadora de financiación",
  },
  "finance.page.intro": {
    en: "Estimate a monthly payment from a price, a rate, a term and a down payment.",
    it: "Stima una rata mensile a partire da prezzo, tasso, durata e anticipo.",
    es: "Estima una cuota mensual a partir del precio, la tasa, el plazo y la entrada.",
  },
  "finance.page.listing_context": {
    en: "Values are taken from this listing. Change them below to explore other assumptions.",
    it: "I valori provengono da questo annuncio. Modificali qui sotto per esplorare altre ipotesi.",
    es: "Los valores proceden de este anuncio. Cámbialos abajo para explorar otros supuestos.",
  },
  "finance.page.price": { en: "Price", it: "Prezzo", es: "Precio" },
  "finance.page.recalculate": {
    en: "Recalculate",
    it: "Ricalcola",
    es: "Volver a calcular",
  },
  "finance.page.listing_unavailable": {
    en: "This listing has no financing estimate, so the values below start from the platform defaults.",
    it: "Questo annuncio non prevede una stima di finanziamento: i valori qui sotto partono dalle impostazioni predefinite della piattaforma.",
    es: "Este anuncio no incluye una estimación de financiación, así que los valores de abajo parten de los ajustes predeterminados de la plataforma.",
  },
  "finance.page.generic_error": {
    en: "The estimate could not be calculated. Check the values and try again.",
    it: "Non è stato possibile calcolare la stima. Controlla i valori e riprova.",
    es: "No se ha podido calcular la estimación. Revisa los valores e inténtalo de nuevo.",
  },
  // Spec §37 names `listing.views` in its minimum key list. The card renders a
  // bare number beside the eye icon (spec §18.1) and labels it with
  // listing.views_label, so the standalone noun is the one a labelled count
  // uses — Phase 10's owner dashboards and any "N views" column (spec §19.5).
  // It is kept here, in all three languages, so that phase does not re-coin it.
  "listing.views": { en: "views", it: "visualizzazioni", es: "visitas" },
  "listing.views_label": {
    en: "{count} views",
    it: "{count} visualizzazioni",
    es: "{count} visitas",
  },
  // Spec §18.4 fixes the English field-group title and toggle label.
  "listing.finance_group_title": {
    en: "Financing estimate",
    it: "Stima di finanziamento",
    es: "Estimación de financiación",
  },
  "listing.finance_toggle": {
    en: "Show an estimated monthly payment on this listing",
    it: "Mostra una rata mensile stimata su questo annuncio",
    es: "Mostrar una cuota mensual estimada en este anuncio",
  },
  "listing.finance_group_help": {
    en: "Buyers see an illustrative monthly payment calculated from these assumptions. It is not a credit application and no bank is involved.",
    it: "Gli acquirenti vedono una rata mensile indicativa calcolata da queste ipotesi. Non è una richiesta di credito e nessuna banca è coinvolta.",
    es: "Los compradores ven una cuota mensual ilustrativa calculada con estos supuestos. No es una solicitud de crédito y no interviene ningún banco.",
  },
  // Spec §18.4's optional custom-assumptions control.
  "listing.finance_custom_assumptions": {
    en: "Use custom assumptions for this listing",
    it: "Usa ipotesi personalizzate per questo annuncio",
    es: "Usar supuestos personalizados para este anuncio",
  },
  "listing.finance_platform_defaults": {
    en: "Platform defaults",
    it: "Impostazioni predefinite della piattaforma",
    es: "Ajustes predeterminados de la plataforma",
  },
  "boats.title": { en: "Boats for sale", it: "Barche in vendita", es: "Barcos en venta" },
  "boats.intro": {
    en: "Published listings from private sellers and brokers in Spain and Italy.",
    it: "Annunci pubblicati da privati e broker in Spagna e in Italia.",
    es: "Anuncios publicados por particulares y brókeres en España e Italia.",
  },
  "boats.empty": {
    en: "No boats are published yet.",
    it: "Non ci sono ancora barche pubblicate.",
    es: "Todavía no hay barcos publicados.",
  },
  "boats.previous": { en: "Previous", it: "Precedenti", es: "Anteriores" },
  "boats.next": { en: "Next", it: "Successivi", es: "Siguientes" },
};

export function tf(
  locale: Locale,
  key: string,
  params: Record<string, string | number> = {},
): string {
  const translations = FINANCE_MESSAGES[key];
  if (!translations) {
    throw new Error(`Unknown finance message key: ${key}`);
  }
  const template = translations[locale] || translations[DEFAULT_LOCALE];
  return Object.entries(params).reduce(
    (text, [name, value]) => text.split(`{${name}}`).join(String(value)),
    template,
  );
}

// Spec §36.1: "Currency symbol/format is localized; calculation uses numeric
// amount/currency code." The interface language is a two-letter code; Intl
// needs a tag. Spain and Italy are exact; en-IE is the euro-native English
// locale, so an English reader of a Spanish or Italian listing does not get
// British or American grouping over a euro amount.
const INTL_LOCALES: Record<Locale, string> = {
  en: "en-IE",
  it: "it-IT",
  es: "es-ES",
};

/**
 * Format a decimal string from the API for display.
 *
 * The string is converted with Number() only to hand Intl a numeric value, and
 * no arithmetic is ever performed on the result: the server response is
 * authoritative (spec §17 definition of done). The conversion is exact —
 * spec §17.3 caps a price at 999,999,999.99, far inside the range where a
 * double represents every cent value exactly.
 */
export function formatMoney(locale: Locale, amount: string, currency: string): string {
  return new Intl.NumberFormat(INTL_LOCALES[locale], {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount));
}

export function formatCount(locale: Locale, value: number): string {
  return new Intl.NumberFormat(INTL_LOCALES[locale]).format(value);
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd frontend
pnpm test src/lib/i18n/finance.test.ts
pnpm lint
```

Expected: nine tests PASS; lint clean. If `formatMoney("en", "8456.36", "EUR")` returns a non-breaking space before or after the symbol on this Node build, assert with the exact string the runtime produces and leave a comment saying so — do not "fix" it by post-processing `Intl` output, and do not assert IT/ES formatting at all (their separators and symbol position are ICU's business, not this project's).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/i18n/finance.ts frontend/src/lib/i18n/finance.test.ts
git commit -m "feat(frontend): add the EN/IT/ES finance dictionary and localized money formatting"
```

---

### Task 8: Frontend — the one boat card and its finance details disclosure

**Files:**
- Create: `frontend/src/components/listings/BoatCard.tsx`
- Create: `frontend/src/components/listings/BoatCard.test.tsx`
- Create: `frontend/src/components/listings/FinanceDetailsDisclosure.tsx`
- Create: `frontend/src/components/listings/FinanceDetailsDisclosure.test.tsx`

**Interfaces:**
- Consumes: `type PublicListing`, `financingHref`, `requestFinanceQuote`, `type FinanceQuote` from `@/lib/api/listings` (Task 6); `tf`, `formatMoney`, `formatCount` from `@/lib/i18n/finance` (Task 7); `type Locale` from `@/lib/i18n/directory`.
- Produces:
  - `BoatCard` — default export of `BoatCard.tsx`, props `{ locale: Locale; listing: PublicListing; disclaimerId: string }`. A server component.
  - `FinanceDetailsDisclosure` — default export, props `{ locale: Locale; listingId: string }`. A client component (`"use client"`).
  Task 9 mounts `BoatCard`; Task 12's acceptance pass asserts against both.

**Note (ruling — the card is a server component, the disclosure is not).** Everything spec §18.1 requires above the disclosure is static output of one API row, so the card renders on the server with no JavaScript cost and the CTA is a real `<a>` before hydration (spec §29.5: "Finance CTA remains a real link and keyboard focusable"). Only the disclosure needs state and a fetch, so only it carries `"use client"`.

**Note (ruling — the asterisk is a link to one footnote per region).** Spec §18.1: "The disclaimer asterisk resolves within the card/list region." Repeating the full disclaimer inside all 24 cards would be noise, and an asterisk with nothing behind it would be a dead mark. The card renders `*` as an anchor to `disclaimerId`, and the region that renders the cards renders exactly one paragraph with that id (Task 9). The prop is required, so a card cannot be mounted into a region that has no footnote.

**Note (ruling — the title and the primary image).** Spec §29.1 requires "Boat type, year, brand/model title" and "Primary approved image or defined placeholder". The title is `year brand model`, with `custom_model_name` replacing the model name when the snapshot carries one (the taxonomy "Other" flow, spec §13). The image slot renders the first `IMAGE` entry of `media` when one exists and a neutral, CSS-drawn placeholder otherwise — `storage_key` is an object-storage key, and turning it into a CDN URL is Phase 15's (spec §24), so this phase must not invent a URL shape. The placeholder is a real defined state, not fixture data.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/listings/BoatCard.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import BoatCard from "@/components/listings/BoatCard";
import type { PublicListing } from "@/lib/api/listings";

vi.mock("@/components/listings/FinanceDetailsDisclosure", () => ({
  default: () => <div data-testid="finance-details" />,
}));

function listing(overrides: Partial<PublicListing> = {}): PublicListing {
  return {
    id: "3f1d2c4e-0000-4000-8000-000000000001",
    seller_type: "BROKER",
    snapshot_version: 1,
    published_at: "2026-09-18T08:00:00Z",
    expires_at: null,
    brand_name: "Beneteau",
    model_name: "Oceanis 46.1",
    custom_model_name: "",
    manufacture_year: 2021,
    title: { en: "Oceanis 46.1", it: "", es: "" },
    description: { en: "", it: "", es: "" },
    specifications: {},
    specifications_schema_version: 1,
    location: { country: "ES", region: "Illes Balears", city: "Palma" },
    price: { amount: "459000.00", currency: "EUR" },
    media: [],
    view_count: 149,
    finance: { visible: false },
    ...overrides,
  };
}

const ELIGIBLE = {
  visible: true as const,
  monthly_payment: "8456.36",
  annual_rate_percent: "5.0000",
  term_months: 48,
  down_payment_percent: "20.0000",
  configuration_version: 1,
};

describe("BoatCard", () => {
  it("shows the price and the view count for every card", () => {
    render(<BoatCard locale="en" listing={listing()} disclaimerId="d" />);

    expect(screen.getByText("€459,000.00")).toBeInTheDocument();
    expect(screen.getByText("149")).toBeInTheDocument();
    expect(screen.getByLabelText("149 views")).toBeInTheDocument();
  });

  it("titles the card with year, brand and model", () => {
    render(<BoatCard locale="en" listing={listing()} disclaimerId="d" />);

    expect(
      screen.getByRole("heading", { name: "2021 Beneteau Oceanis 46.1" }),
    ).toBeInTheDocument();
  });

  it("uses the custom model text when the Other model was selected", () => {
    render(
      <BoatCard
        locale="en"
        listing={listing({ model_name: "Other", custom_model_name: "Yard One-Off 52" })}
        disclaimerId="d"
      />,
    );

    expect(
      screen.getByRole("heading", { name: "2021 Beneteau Yard One-Off 52" }),
    ).toBeInTheDocument();
  });

  it("removes the whole finance column when the listing is not eligible", () => {
    render(<BoatCard locale="en" listing={listing()} disclaimerId="d" />);

    expect(screen.queryByText("Estimated payment")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Calculate your financing/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("finance-details")).not.toBeInTheDocument();
    expect(screen.queryByText(/month/)).not.toBeInTheDocument();
  });

  it("shows the estimated payment when the listing is eligible", () => {
    render(
      <BoatCard locale="en" listing={listing({ finance: ELIGIBLE })} disclaimerId="d" />,
    );

    expect(screen.getByText("Estimated payment")).toBeInTheDocument();
    expect(screen.getByText("€8,456.36/month")).toBeInTheDocument();
  });

  it("opens the calculator in a new tab without granting opener access", () => {
    render(
      <BoatCard locale="en" listing={listing({ finance: ELIGIBLE })} disclaimerId="d" />,
    );

    const cta = screen.getByRole("link", { name: /Calculate your financing/ });
    expect(cta).toHaveAttribute(
      "href",
      "/financing/?listing=3f1d2c4e-0000-4000-8000-000000000001&price=459000.00&currency=EUR",
    );
    expect(cta).toHaveAttribute("target", "_blank");
    expect(cta).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("resolves its disclaimer asterisk inside the region that renders it", () => {
    render(
      <BoatCard
        locale="en"
        listing={listing({ finance: ELIGIBLE })}
        disclaimerId="finance-disclaimer"
      />,
    );

    expect(screen.getByRole("link", { name: "*" })).toHaveAttribute(
      "href",
      "#finance-disclaimer",
    );
  });
});
```

Create `frontend/src/components/listings/FinanceDetailsDisclosure.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import FinanceDetailsDisclosure from "@/components/listings/FinanceDetailsDisclosure";

const requestFinanceQuote = vi.fn();

vi.mock("@/lib/api/listings", () => ({
  requestFinanceQuote: (...args: unknown[]) => requestFinanceQuote(...args),
}));

const QUOTE = {
  currency: "EUR",
  price: "459000.00",
  down_payment_amount: "91800.00",
  principal: "367200.00",
  annual_rate_percent: "5.0000",
  term_months: 48,
  monthly_payment: "8456.36",
  total_payment: "405905.12",
  total_interest: "38705.12",
  configuration_version: 1,
  disclaimer_key: "finance.illustrative_disclaimer",
  assumption_sources: {
    annual_rate_percent: "GLOBAL" as const,
    term_months: "GLOBAL" as const,
    down_payment_percent: "GLOBAL" as const,
  },
};

beforeEach(() => {
  requestFinanceQuote.mockReset();
});

describe("FinanceDetailsDisclosure", () => {
  it("asks for nothing until it is opened", () => {
    render(<FinanceDetailsDisclosure locale="en" listingId="abc" />);

    expect(requestFinanceQuote).not.toHaveBeenCalled();
  });

  it("renders server-calculated figures, never client arithmetic", async () => {
    requestFinanceQuote.mockResolvedValue(QUOTE);
    render(<FinanceDetailsDisclosure locale="en" listingId="abc" />);

    await userEvent.click(screen.getByRole("button", { name: "Show assumptions" }));

    await waitFor(() => expect(screen.getByText("€91,800.00")).toBeInTheDocument());
    expect(requestFinanceQuote).toHaveBeenCalledWith({ listing_id: "abc" });
    expect(screen.getByText("€367,200.00")).toBeInTheDocument();
    expect(screen.getByText("€405,905.12")).toBeInTheDocument();
    expect(screen.getByText("€38,705.12")).toBeInTheDocument();
    expect(screen.getByText("48 months")).toBeInTheDocument();
    expect(screen.getByText("5.0000%")).toBeInTheDocument();
  });

  it("fetches once even when it is opened and closed repeatedly", async () => {
    requestFinanceQuote.mockResolvedValue(QUOTE);
    render(<FinanceDetailsDisclosure locale="en" listingId="abc" />);

    await userEvent.click(screen.getByRole("button", { name: "Show assumptions" }));
    await waitFor(() => expect(screen.getByText("€91,800.00")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Hide assumptions" }));
    await userEvent.click(screen.getByRole("button", { name: "Show assumptions" }));

    expect(requestFinanceQuote).toHaveBeenCalledTimes(1);
  });

  it("says so when the estimate cannot be calculated", async () => {
    requestFinanceQuote.mockRejectedValue(new Error("boom"));
    render(<FinanceDetailsDisclosure locale="en" listingId="abc" />);

    await userEvent.click(screen.getByRole("button", { name: "Show assumptions" }));

    await waitFor(() =>
      expect(
        screen.getByText("The estimate could not be calculated right now."),
      ).toBeInTheDocument(),
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd frontend
pnpm test src/components/listings
```

Expected: both files fail to resolve their imports (`@/components/listings/BoatCard`, `@/components/listings/FinanceDetailsDisclosure`).

- [ ] **Step 3a: Write the disclosure**

Create `frontend/src/components/listings/FinanceDetailsDisclosure.tsx`:

```tsx
"use client";

import { useState } from "react";

import { requestFinanceQuote, type FinanceQuote } from "@/lib/api/listings";
import { formatMoney, tf } from "@/lib/i18n/finance";
import type { Locale } from "@/lib/i18n/directory";

/**
 * Spec §18.1's optional details disclosure. "It must use live calculation
 * results, never fixed sample copy" — so the figures come from the server's own
 * quote (spec §17.4 context 1), not from arithmetic in the browser. The request
 * is made on first open and kept: this is the "explicit calculator interaction"
 * spec §11.6 says is the only card event worth logging, which is why it is a
 * real request rather than five more fields on every card of a 24-card page.
 */
export default function FinanceDetailsDisclosure({
  locale,
  listingId,
}: {
  locale: Locale;
  listingId: string;
}) {
  const [open, setOpen] = useState(false);
  const [quote, setQuote] = useState<FinanceQuote | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next || quote || loading) {
      return;
    }
    setLoading(true);
    setFailed(false);
    try {
      setQuote(await requestFinanceQuote({ listing_id: listingId }));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  const rows = quote
    ? [
        ["finance.down_payment", formatMoney(locale, quote.down_payment_amount, quote.currency)],
        ["finance.amount_financed", formatMoney(locale, quote.principal, quote.currency)],
        ["finance.term", tf(locale, "finance.months", { count: quote.term_months })],
        ["finance.annual_rate", `${quote.annual_rate_percent}%`],
        ["finance.total_installments", formatMoney(locale, quote.total_payment, quote.currency)],
        ["finance.total_interest", formatMoney(locale, quote.total_interest, quote.currency)],
      ]
    : [];

  return (
    <div className="mt-space-xs">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="font-body-sm text-on-surface-variant underline"
      >
        {tf(locale, open ? "finance.details.hide" : "finance.details.show")}
      </button>
      {open ? (
        <div className="mt-space-xs font-body-sm text-on-surface-variant">
          {loading ? <p>{tf(locale, "finance.details.loading")}</p> : null}
          {failed ? <p role="alert">{tf(locale, "finance.details.error")}</p> : null}
          {rows.length > 0 ? (
            <dl className="grid grid-cols-2 gap-x-space-sm gap-y-space-xs">
              {rows.map(([key, value]) => (
                <div key={key} className="contents">
                  <dt>{tf(locale, key)}</dt>
                  <dd className="text-right">{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 3b: Write the card**

Create `frontend/src/components/listings/BoatCard.tsx`:

```tsx
import FinanceDetailsDisclosure from "@/components/listings/FinanceDetailsDisclosure";
import { financingHref, type PublicListing } from "@/lib/api/listings";
import type { Locale } from "@/lib/i18n/directory";
import { formatCount, formatMoney, tf } from "@/lib/i18n/finance";

/**
 * Spec §29.1: "Every boat card uses one component and one API representation."
 * This is that component, and `listing` is that representation — nothing here
 * is computed from anything but the API row (spec §2.1).
 *
 * Spec §18.1's layout: the view count sits in the upper metadata row next to an
 * eye icon; the price stays left in the lower pricing row; the estimated
 * payment, when eligible, sits right in the same row; the calculator CTA sits
 * below it; the disclosure sits below that. When the listing is not eligible,
 * every one of those finance elements is absent — not disabled, not zeroed
 * (spec §18.2).
 */
export default function BoatCard({
  locale,
  listing,
  disclaimerId,
}: {
  locale: Locale;
  listing: PublicListing;
  disclaimerId: string;
}) {
  const modelName = listing.custom_model_name || listing.model_name;
  const heading = `${listing.manufacture_year} ${listing.brand_name} ${modelName}`;
  const location = [listing.location.city, listing.location.region]
    .filter(Boolean)
    .join(", ");
  const primaryImage = listing.media.find((item) => item.media_type === "IMAGE");
  const finance = listing.finance;

  return (
    <article className="flex h-full flex-col rounded-xl border border-outline-variant bg-surface-container-lowest p-space-md">
      {/* Spec §29.1: primary approved image or a defined placeholder. Turning a
          storage_key into a CDN URL is Phase 15 (spec §24), so until then the
          placeholder is the defined state — not a fixture image. */}
      <div
        aria-hidden="true"
        data-testid={primaryImage ? "boat-image-slot" : "boat-image-placeholder"}
        className="mb-space-sm aspect-[4/3] w-full rounded-lg bg-surface-container-high"
      />

      <div className="flex items-center justify-between font-body-sm text-on-surface-variant">
        <span>{location}</span>
        {/* Spec §18.1: view count in the upper metadata row next to an eye icon.
            Spec §29.6: the icon is not the only means of conveying state, so the
            number carries an accessible label and the icon is hidden from it. */}
        <span
          className="inline-flex items-center gap-space-xs"
          aria-label={tf(locale, "listing.views_label", {
            count: formatCount(locale, listing.view_count),
          })}
        >
          <svg
            aria-hidden="true"
            focusable="false"
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span>{formatCount(locale, listing.view_count)}</span>
        </span>
      </div>

      <h3 className="mt-space-xs font-title-lg text-title-lg text-primary">{heading}</h3>

      {/* Spec §29.5: this row stacks cleanly below a breakpoint and neither
          value truncates ambiguously. */}
      <div className="mt-space-sm flex flex-col gap-space-xs sm:flex-row sm:items-end sm:justify-between">
        <p className="font-title-md text-title-md text-on-surface">
          {formatMoney(locale, listing.price.amount, listing.price.currency)}
        </p>
        {finance.visible ? (
          <p className="text-right font-body-sm text-on-surface-variant">
            <span className="block">{tf(locale, "finance.estimated_payment")}</span>
            <span className="font-title-sm text-title-sm text-on-surface">
              {`${formatMoney(locale, finance.monthly_payment, listing.price.currency)}${tf(
                locale,
                "finance.per_month",
              )}`}
              <sup>
                <a href={`#${disclaimerId}`}>*</a>
              </sup>
            </span>
          </p>
        ) : null}
      </div>

      {finance.visible ? (
        <>
          <a
            className="mt-space-sm inline-flex items-center gap-space-xs font-body-md text-primary underline"
            href={financingHref(listing)}
            target="_blank"
            rel="noopener noreferrer"
          >
            {tf(locale, "finance.calculate")}
            <span aria-hidden="true">→</span>
          </a>
          <FinanceDetailsDisclosure locale={locale} listingId={listing.id} />
        </>
      ) : null}
    </article>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd frontend
pnpm test src/components/listings
pnpm lint
```

Expected: eleven tests PASS; lint clean. If `€8,456.36/month` fails because `Intl` emits a non-breaking space on this runtime, assert the exact runtime string with a comment — do not post-process `Intl` output.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/listings
git commit -m "feat(frontend): add the shared boat card with its eligible-only finance column"
```

---

### Task 9: Frontend — the `/boats/` list page

**Files:**
- Create: `frontend/src/app/boats/page.tsx`
- Create: `frontend/src/app/boats/page.test.tsx`

**Interfaces:**
- Consumes: `fetchPublishedListings`, `type PublicListing` (Task 6); `BoatCard` (Task 8); `tf` and the `boats.*` keys (Task 7); `DEFAULT_LOCALE` from `@/lib/i18n/directory`.
- Produces: the route `/boats/` (spec §4.1), and the single `id="finance-disclaimer"` footnote every card on the page points its asterisk at.

**Note (ruling — what this page is and is not).** It is the smallest real page that makes spec §18.1's card observable: server-rendered from `GET /api/v1/listings/`, paginated by the API's own `next`/`previous`, with a true empty state. It is deliberately not spec §29.4's filtered search (category/location/text/sort are the *professional* directory's filters; the boat search facets are Phase 20's), and it carries no visual-regression snapshots. Phase 20 owns both.

**Note (ruling — a null result is a hard failure here, not a flag-off 404).** Phase 5's directory endpoints return `null` for "the rollout flag is off". The listing endpoints have no such gate — Phase 11 made them `AllowAny` with no feature flag, and `finance_estimates` gates the finance *block*, not the listings. So `fetchPublishedListings` can only return `null` if the API 404s the collection URL itself, which is a deployment fault, not a product state. The page renders the empty state for an empty `results` array and lets a genuine `null` fall through to the error boundary rather than pretending the catalogue is empty.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/app/boats/page.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import BoatsPage from "@/app/boats/page";
import type { PublicListing } from "@/lib/api/listings";

const fetchPublishedListings = vi.fn();

vi.mock("@/lib/api/listings", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/listings")>(
    "@/lib/api/listings",
  );
  return {
    ...actual,
    fetchPublishedListings: (...args: unknown[]) => fetchPublishedListings(...args),
  };
});

vi.mock("@/components/listings/FinanceDetailsDisclosure", () => ({
  default: () => <div />,
}));

function listing(overrides: Partial<PublicListing> = {}): PublicListing {
  return {
    id: "3f1d2c4e-0000-4000-8000-000000000001",
    seller_type: "BROKER",
    snapshot_version: 1,
    published_at: "2026-09-18T08:00:00Z",
    expires_at: null,
    brand_name: "Beneteau",
    model_name: "Oceanis 46.1",
    custom_model_name: "",
    manufacture_year: 2021,
    title: { en: "Oceanis 46.1", it: "", es: "" },
    description: { en: "", it: "", es: "" },
    specifications: {},
    specifications_schema_version: 1,
    location: { country: "ES", region: "Illes Balears", city: "Palma" },
    price: { amount: "459000.00", currency: "EUR" },
    media: [],
    view_count: 149,
    finance: {
      visible: true,
      monthly_payment: "8456.36",
      annual_rate_percent: "5.0000",
      term_months: 48,
      down_payment_percent: "20.0000",
      configuration_version: 1,
    },
    ...overrides,
  };
}

function page(results: PublicListing[], extra: Record<string, unknown> = {}) {
  fetchPublishedListings.mockResolvedValue({
    count: results.length,
    next: null,
    previous: null,
    results,
    ...extra,
  });
  return BoatsPage({ searchParams: Promise.resolve({}) });
}

beforeEach(() => {
  fetchPublishedListings.mockReset();
});

describe("/boats/", () => {
  it("renders one card per published listing", async () => {
    render(await page([listing()]));

    expect(
      screen.getByRole("heading", { name: "2021 Beneteau Oceanis 46.1" }),
    ).toBeInTheDocument();
  });

  it("resolves the disclaimer asterisk inside the list region", async () => {
    const { container } = render(await page([listing()]));

    expect(screen.getByRole("link", { name: "*" })).toHaveAttribute(
      "href",
      "#finance-disclaimer",
    );
    expect(container.querySelector("#finance-disclaimer")).toHaveTextContent(
      /Illustrative estimate only/,
    );
  });

  it("shows a true empty message rather than placeholder cards", async () => {
    render(await page([]));

    expect(screen.getByText("No boats are published yet.")).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("renders no disclaimer when no card on the page shows finance", async () => {
    const { container } = render(await page([listing({ finance: { visible: false } })]));

    expect(container.querySelector("#finance-disclaimer")).toBeNull();
  });

  it("links to the next page when the API says there is one", async () => {
    render(
      await page([listing()], { next: "http://api/api/v1/listings/?page=2", count: 40 }),
    );

    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/boats/?page=2",
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd frontend
pnpm test src/app/boats
```

Expected: `Failed to resolve import "@/app/boats/page"`.

- [ ] **Step 3: Write the page**

Create `frontend/src/app/boats/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";

import BoatCard from "@/components/listings/BoatCard";
import { fetchPublishedListings } from "@/lib/api/listings";
import { DEFAULT_LOCALE } from "@/lib/i18n/directory";
import { tf } from "@/lib/i18n/finance";

export const dynamic = "force-dynamic";

const CANONICAL_PATH = "/boats/";
// One footnote per list region, which every eligible card's asterisk points at
// (spec §18.1: "The disclaimer asterisk resolves within the card/list region").
const DISCLAIMER_ID = "finance-disclaimer";

export function generateMetadata(): Metadata {
  return {
    title: tf(DEFAULT_LOCALE, "boats.title"),
    description: tf(DEFAULT_LOCALE, "boats.intro"),
    alternates: { canonical: CANONICAL_PATH },
  };
}

// Next 16: searchParams is a Promise. Verify against
// node_modules/next/dist/docs/ before changing this signature.
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// The API returns absolute next/previous URLs; the page's own links stay
// relative so a shared URL always points at this site (spec §29.4's shareable,
// back-button-safe filter state, applied to the one control this page has).
function pageLink(apiUrl: string | null): string | null {
  if (!apiUrl) {
    return null;
  }
  const page = new URL(apiUrl).searchParams.get("page");
  return page ? `/boats/?page=${page}` : "/boats/";
}

export default async function BoatsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const locale = DEFAULT_LOCALE;
  // A null here would mean the collection endpoint itself 404'd, which is a
  // deployment fault rather than a product state — unlike Phase 5's directory,
  // these endpoints have no rollout flag. Let it throw to the error boundary
  // instead of rendering "no boats", which would be a lie.
  const results = await fetchPublishedListings({ page: first(params.page) });
  if (results === null) {
    throw new Error("GET /api/v1/listings/ is unavailable");
  }

  const showsFinance = results.results.some((listing) => listing.finance.visible);
  const previousHref = pageLink(results.previous);
  const nextHref = pageLink(results.next);

  return (
    <main className="mx-auto max-w-[1440px] px-margin-mobile py-space-xl md:px-margin-desktop">
      <h1 className="font-headline-md text-headline-md text-primary">
        {tf(locale, "boats.title")}
      </h1>
      <p className="mt-space-sm font-body-md text-on-surface-variant">
        {tf(locale, "boats.intro")}
      </p>

      {results.results.length === 0 ? (
        <p className="mt-space-xl font-body-md text-on-surface-variant">
          {tf(locale, "boats.empty")}
        </p>
      ) : (
        <ul className="mt-space-lg grid grid-cols-1 gap-space-md sm:grid-cols-2 lg:grid-cols-3">
          {results.results.map((listing) => (
            <li key={listing.id}>
              <BoatCard locale={locale} listing={listing} disclaimerId={DISCLAIMER_ID} />
            </li>
          ))}
        </ul>
      )}

      {/* Rendered only when a card on this page actually shows an estimate: an
          asterisk with nothing behind it and a footnote with no asterisk are
          both wrong. */}
      {showsFinance ? (
        <p
          id={DISCLAIMER_ID}
          className="mt-space-lg font-body-sm text-on-surface-variant"
        >
          * {tf(locale, "finance.illustrative_disclaimer")}
        </p>
      ) : null}

      {previousHref || nextHref ? (
        <nav className="mt-space-lg flex gap-space-md" aria-label={tf(locale, "boats.title")}>
          {previousHref ? <Link href={previousHref}>{tf(locale, "boats.previous")}</Link> : null}
          {nextHref ? <Link href={nextHref}>{tf(locale, "boats.next")}</Link> : null}
        </nav>
      ) : null}
    </main>
  );
}
```

- [ ] **Step 4a: Run the test to verify it passes**

```bash
cd frontend
pnpm test src/app/boats
pnpm lint
```

Expected: five tests PASS; lint clean.

- [ ] **Step 4b: Prove it end to end over HTTP**

With Postgres and Redis up and a broker listing published with the toggle on (use the Django shell or the acceptance fixtures from Task 12), and `finance_estimates` enabled:

```bash
cd backend && uv run python manage.py runserver 8020 &
cd frontend && pnpm dev --port 3020 &
curl -s http://127.0.0.1:3020/boats/ | grep -c "Estimated payment"
curl -s http://127.0.0.1:3020/boats/ | grep -o 'href="/financing/?listing=[^"]*"'
```

Expected: a non-zero count, and a CTA href in the exact spec §18.3 shape. Then disable the flag (`set_feature_flag(key="finance_estimates", is_enabled=False, actor=None)`), reload, and expect `0` and no CTA — the same page, driven entirely by the API.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/boats
git commit -m "feat(frontend): add the /boats/ list page and its single finance disclaimer"
```

---

### Task 10: Frontend — the `/financing/` calculator page

**Files:**
- Create: `frontend/src/components/finance/FinanceCalculator.tsx`
- Create: `frontend/src/components/finance/FinanceCalculator.test.tsx`
- Create: `frontend/src/app/financing/page.tsx`

**Interfaces:**
- Consumes: `requestFinanceQuote`, `fetchFinanceDefaults`, `type FinanceQuote`, `type FinanceConfigurationDefaults` (Task 6); `ApiError` from `@/lib/api/client`; `tf`, `formatMoney` (Task 7).
- Produces: the route `/financing/` (spec §4.1), and `FinanceCalculator` with props `{ locale: Locale; listingId: string | null; fallbackPrice: string | null; currency: string; defaults: FinanceConfigurationDefaults | null }`.

**Note (ruling — the listing is the authority and the query price is never sent).** Spec §18.3: "The finance page treats `listing` as the authority and ignores tampered price parameters. Query price exists only for immediate display fallback while loading." So when `listingId` is present the component sends `{listing_id}` and never a price — a tampered `?price=` can therefore only ever appear as the greyed placeholder that the server's own price replaces a moment later, and it can never reach a calculation. Task 5's `price_mismatch` refusal covers the other direction (a caller that does send one).

**Note (ruling — an ineligible listing falls back to the plain calculator).** A `finance_not_available_for_listing` answer means the link is stale or the broker turned the toggle off. The page says so in one line and continues as the manual calculator seeded with platform defaults, because `/financing/` is a standalone route in spec §4.1 and refusing the whole page would be worse for the visitor than answering the question they came with.

**Note (ruling — the defaults the manual mode starts from are the platform's real ones, fetched from the server).** Spec §2.1 is the governing sentence: *"Production UI must not display invented, hard-coded … operational data"*, and it names `FinanceQuoteService` among its examples — so the rate, term and down payment this page starts from must be the platform's actual current values, not a copy of them compiled into the bundle. Spec §17.5 is the second: a staff change to the defaults *"changes automatically affect boat cards and the finance page"* — the finance page is named there explicitly, so a value that only updates on the next frontend deploy does not satisfy it. (Spec §29.1's prohibition on *"stale hard-coded 120 months/6.5% copy from the prototype"* points the same way and is the concrete historical instance of the rule, but it is about that specific prototype leftover — it is the secondary citation here, not the lead.)

That left three candidates and only one honest one. Hard-coding `5 / 48 / 20` fails §2.1 and goes stale on the first activation, failing §17.5. An empty form invents nothing, but it makes §17.5's "and the finance page" vacuous for the standalone case and is a visibly worse page. **Decision:** Task 2 publishes the active `FinanceConfigurationVersion` as `finance_configuration` on `GET /api/v1/platform/public-settings/`, the page fetches it server-side with `fetchFinanceDefaults()` (Task 6) and passes it as the `defaults` prop, and the manual form opens **pre-filled with real current values** — rate, term and down payment ready, price the one field the visitor supplies, submit disabled until they do. When `defaults` is `null` (no active configuration, or the endpoint is unreachable) the three fields open empty and submit waits for all four: degraded, never invented. When a listing *is* present the server's own effective assumptions still arrive with the first quote and overwrite whatever was pre-filled, so the listing remains the authority (spec §18.3) in every case.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/finance/FinanceCalculator.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import FinanceCalculator from "@/components/finance/FinanceCalculator";
import { ApiError } from "@/lib/api/client";

const requestFinanceQuote = vi.fn();

vi.mock("@/lib/api/listings", () => ({
  requestFinanceQuote: (...args: unknown[]) => requestFinanceQuote(...args),
}));

const QUOTE = {
  currency: "EUR",
  price: "459000.00",
  down_payment_amount: "91800.00",
  principal: "367200.00",
  annual_rate_percent: "5.0000",
  term_months: 48,
  monthly_payment: "8456.36",
  total_payment: "405905.12",
  total_interest: "38705.12",
  configuration_version: 1,
  disclaimer_key: "finance.illustrative_disclaimer",
  assumption_sources: {
    annual_rate_percent: "GLOBAL" as const,
    term_months: "GLOBAL" as const,
    down_payment_percent: "GLOBAL" as const,
  },
};

// Exactly the shape GET /api/v1/platform/public-settings/ publishes under
// `finance_configuration` (Task 2). These are the seeded spec §1 values; the
// point of the prop is that they arrive from the server, not that they are
// these particular numbers.
const DEFAULTS = {
  version: 1,
  annual_rate_percent: "5.0000",
  term_months: 48,
  down_payment_percent: "20.0000",
};

beforeEach(() => {
  requestFinanceQuote.mockReset();
});

describe("FinanceCalculator with a listing", () => {
  it("never sends the query price and uses the server's", async () => {
    requestFinanceQuote.mockResolvedValue(QUOTE);
    render(
      <FinanceCalculator
        locale="en"
        listingId="abc"
        fallbackPrice="1.00"
        currency="EUR"
        defaults={DEFAULTS}
      />,
    );

    await waitFor(() => expect(requestFinanceQuote).toHaveBeenCalled());
    expect(requestFinanceQuote).toHaveBeenCalledWith({ listing_id: "abc" });
    await waitFor(() => expect(screen.getByText("€8,456.36")).toBeInTheDocument());
    expect(screen.getByTestId("finance-price")).toHaveTextContent("€459,000.00");
  });

  it("shows the query price only as the loading placeholder", () => {
    requestFinanceQuote.mockReturnValue(new Promise(() => {}));
    render(
      <FinanceCalculator
        locale="en"
        listingId="abc"
        fallbackPrice="1.00"
        currency="EUR"
        defaults={DEFAULTS}
      />,
    );

    expect(screen.getByTestId("finance-price")).toHaveTextContent("€1.00");
    expect(screen.queryByText("€8,456.36")).not.toBeInTheDocument();
  });

  it("sends an explored term with the listing and still never a price", async () => {
    requestFinanceQuote.mockResolvedValue(QUOTE);
    render(
      <FinanceCalculator
        locale="en"
        listingId="abc"
        fallbackPrice={null}
        currency="EUR"
        defaults={DEFAULTS}
      />,
    );
    await waitFor(() => expect(screen.getByText("€8,456.36")).toBeInTheDocument());

    const term = screen.getByLabelText("Term");
    await userEvent.clear(term);
    await userEvent.type(term, "60");
    await userEvent.click(screen.getByRole("button", { name: "Recalculate" }));

    await waitFor(() =>
      expect(requestFinanceQuote).toHaveBeenLastCalledWith({
        listing_id: "abc",
        annual_rate_percent: "5.0000",
        term_months: 60,
        down_payment_percent: "20.0000",
      }),
    );
  });

  it("falls back to the plain calculator when the listing shows no estimate", async () => {
    requestFinanceQuote.mockRejectedValue(
      new ApiError(400, "finance_not_available_for_listing", "nope"),
    );
    render(
      <FinanceCalculator
        locale="en"
        listingId="abc"
        fallbackPrice={null}
        currency="EUR"
        defaults={DEFAULTS}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByText(/This listing has no financing estimate/),
      ).toBeInTheDocument(),
    );
    expect(screen.getByLabelText("Price")).toBeEnabled();
    // The stale-link fallback is still a usable calculator, not an empty one:
    // the platform defaults the page arrived with are still in the fields.
    expect(screen.getByLabelText("Annual rate")).toHaveValue("5.0000");
  });

  it("always shows the disclaimer", async () => {
    requestFinanceQuote.mockResolvedValue(QUOTE);
    render(
      <FinanceCalculator
        locale="en"
        listingId="abc"
        fallbackPrice={null}
        currency="EUR"
        defaults={DEFAULTS}
      />,
    );

    expect(screen.getByText(/Illustrative estimate only/)).toBeInTheDocument();
  });
});

describe("FinanceCalculator without a listing", () => {
  it("opens pre-filled with the platform's real assumptions and asks for the price", () => {
    render(
      <FinanceCalculator
        locale="en"
        listingId={null}
        fallbackPrice={null}
        currency="EUR"
        defaults={DEFAULTS}
      />,
    );

    // Spec §2.1: real current configuration, handed down by the server — not a
    // hard-coded copy, and not an empty form.
    expect(screen.getByLabelText("Annual rate")).toHaveValue("5.0000");
    expect(screen.getByLabelText("Term")).toHaveValue("48");
    expect(screen.getByLabelText("Down payment")).toHaveValue("20.0000");
    // Price is the visitor's to supply, and nothing is requested until they do.
    expect(screen.getByLabelText("Price")).toHaveValue("");
    expect(requestFinanceQuote).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Recalculate" })).toBeDisabled();
  });

  it("opens empty rather than inventing numbers when no configuration is active", () => {
    render(
      <FinanceCalculator
        locale="en"
        listingId={null}
        fallbackPrice={null}
        currency="EUR"
        defaults={null}
      />,
    );

    expect(screen.getByLabelText("Annual rate")).toHaveValue("");
    expect(screen.getByLabelText("Term")).toHaveValue("");
    expect(screen.getByLabelText("Down payment")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Recalculate" })).toBeDisabled();
  });

  it("sends every value itself in manual mode", async () => {
    requestFinanceQuote.mockResolvedValue({ ...QUOTE, configuration_version: null });
    render(
      <FinanceCalculator
        locale="en"
        listingId={null}
        fallbackPrice={null}
        currency="EUR"
        defaults={DEFAULTS}
      />,
    );

    await userEvent.type(screen.getByLabelText("Price"), "459000.00");
    await userEvent.click(screen.getByRole("button", { name: "Recalculate" }));

    await waitFor(() =>
      expect(requestFinanceQuote).toHaveBeenCalledWith({
        price: "459000.00",
        currency: "EUR",
        annual_rate_percent: "5.0000",
        term_months: 48,
        down_payment_percent: "20.0000",
      }),
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd frontend
pnpm test src/components/finance
```

Expected: `Failed to resolve import "@/components/finance/FinanceCalculator"`.

- [ ] **Step 3a: Write the calculator**

Create `frontend/src/components/finance/FinanceCalculator.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

import { ApiError } from "@/lib/api/client";
import {
  requestFinanceQuote,
  type FinanceConfigurationDefaults,
  type FinanceQuote,
} from "@/lib/api/listings";
import type { Locale } from "@/lib/i18n/directory";
import { formatMoney, tf } from "@/lib/i18n/finance";

interface Assumptions {
  annual_rate_percent: string;
  term_months: string;
  down_payment_percent: string;
  price: string;
}

const EMPTY: Assumptions = {
  annual_rate_percent: "",
  term_months: "",
  down_payment_percent: "",
  price: "",
};

// The platform's real current assumptions, or empty when the server reports no
// active configuration. Never a hard-coded 5 / 48 / 20 fallback: spec §2.1
// forbids displaying invented operational data, and an un-prefilled field is
// the honest degraded state.
function initialValues(defaults: FinanceConfigurationDefaults | null): Assumptions {
  if (defaults === null) {
    return EMPTY;
  }
  return {
    annual_rate_percent: defaults.annual_rate_percent,
    term_months: String(defaults.term_months),
    down_payment_percent: defaults.down_payment_percent,
    price: "",
  };
}

/**
 * Spec §4.1's /financing/ estimator, in both of spec §17.4's contexts.
 *
 * With a listing (spec §18.3), the listing is the authority: the request
 * carries `listing_id` and never a price, so a tampered `?price=` can only ever
 * appear as the greyed placeholder below and never reaches a calculation, and
 * the server's own effective assumptions overwrite the pre-filled defaults as
 * soon as the first quote lands. The visitor may still explore other
 * assumptions (spec §36.1) — those are sent and reported back as REQUESTED.
 *
 * Without a listing, the form opens pre-filled from `defaults`, which the page
 * fetched server-side from GET /api/v1/platform/public-settings/ (Task 2's
 * `finance_configuration`). Those are the platform's real current values, so
 * spec §2.1's ban on invented or hard-coded operational data is satisfied by
 * using the live configuration rather than by showing nothing, and spec §17.5's
 * "changes automatically affect boat cards and the finance page" holds without
 * a frontend deploy. `defaults === null` means no active configuration (or an
 * unreachable endpoint): the three fields open empty rather than guessing.
 *
 * Price is never pre-filled in manual mode — the platform has no opinion about
 * which boat a visitor with no listing has in mind.
 */
export default function FinanceCalculator({
  locale,
  listingId,
  fallbackPrice,
  currency,
  defaults,
}: {
  locale: Locale;
  listingId: string | null;
  fallbackPrice: string | null;
  currency: string;
  defaults: FinanceConfigurationDefaults | null;
}) {
  const [values, setValues] = useState<Assumptions>(() => initialValues(defaults));
  const [quote, setQuote] = useState<FinanceQuote | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [listingUsable, setListingUsable] = useState(listingId !== null);

  async function load(payload: Parameters<typeof requestFinanceQuote>[0]) {
    setNotice(null);
    try {
      const result = await requestFinanceQuote(payload);
      setQuote(result);
      setValues({
        annual_rate_percent: result.annual_rate_percent,
        term_months: String(result.term_months),
        down_payment_percent: result.down_payment_percent,
        price: result.price,
      });
    } catch (error) {
      const code = error instanceof ApiError ? error.code : "";
      if (code === "finance_not_available_for_listing" || code === "listing_not_found") {
        setListingUsable(false);
        setNotice(tf(locale, "finance.page.listing_unavailable"));
        return;
      }
      setNotice(tf(locale, "finance.page.generic_error"));
    }
  }

  useEffect(() => {
    if (listingId !== null) {
      void load({ listing_id: listingId });
    }
    // The listing is the only input to the first request; explorations go
    // through the form's submit handler.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId]);

  const complete =
    values.price !== "" &&
    values.annual_rate_percent !== "" &&
    values.term_months !== "" &&
    values.down_payment_percent !== "";
  const usingListing = listingId !== null && listingUsable;
  const canSubmit = usingListing
    ? values.annual_rate_percent !== "" &&
      values.term_months !== "" &&
      values.down_payment_percent !== ""
    : complete;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    const assumptions = {
      annual_rate_percent: values.annual_rate_percent,
      term_months: Number(values.term_months),
      down_payment_percent: values.down_payment_percent,
    };
    void load(
      usingListing
        ? { listing_id: listingId as string, ...assumptions }
        : { price: values.price, currency, ...assumptions },
    );
  }

  function field(name: keyof Assumptions, labelKey: string, disabled = false) {
    return (
      <label className="flex flex-col gap-space-xs font-body-sm">
        <span>{tf(locale, labelKey)}</span>
        <input
          name={name}
          value={values[name]}
          disabled={disabled}
          inputMode="decimal"
          onChange={(event) =>
            setValues((current) => ({ ...current, [name]: event.target.value }))
          }
          className="rounded-lg border border-outline-variant px-space-sm py-space-xs"
        />
      </label>
    );
  }

  // Spec §18.3: the query price is an immediate display fallback while the
  // authoritative quote loads, and nothing more.
  const displayedPrice = quote?.price ?? fallbackPrice;

  return (
    <div className="mt-space-lg grid gap-space-lg md:grid-cols-2">
      <form onSubmit={submit} className="flex flex-col gap-space-sm">
        {usingListing ? (
          <p className="font-body-sm text-on-surface-variant">
            {tf(locale, "finance.page.listing_context")}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="font-body-sm text-on-surface-variant">
            {notice}
          </p>
        ) : null}
        {field("price", "finance.page.price", usingListing)}
        {field("annual_rate_percent", "finance.annual_rate")}
        {field("term_months", "finance.term")}
        {field("down_payment_percent", "finance.down_payment")}
        <button
          type="submit"
          disabled={!canSubmit}
          className="mt-space-sm rounded-lg bg-primary px-space-md py-space-sm text-on-primary disabled:opacity-50"
        >
          {tf(locale, "finance.page.recalculate")}
        </button>
      </form>

      <section aria-live="polite" className="flex flex-col gap-space-xs">
        <p data-testid="finance-price" className="font-body-md text-on-surface-variant">
          {displayedPrice ? formatMoney(locale, displayedPrice, currency) : null}
        </p>
        {quote ? (
          <>
            <p className="font-headline-sm text-headline-sm text-primary">
              {formatMoney(locale, quote.monthly_payment, quote.currency)}
            </p>
            <dl className="grid grid-cols-2 gap-x-space-sm gap-y-space-xs font-body-sm">
              <dt>{tf(locale, "finance.down_payment")}</dt>
              <dd className="text-right">
                {formatMoney(locale, quote.down_payment_amount, quote.currency)}
              </dd>
              <dt>{tf(locale, "finance.amount_financed")}</dt>
              <dd className="text-right">
                {formatMoney(locale, quote.principal, quote.currency)}
              </dd>
              <dt>{tf(locale, "finance.total_installments")}</dt>
              <dd className="text-right">
                {formatMoney(locale, quote.total_payment, quote.currency)}
              </dd>
              <dt>{tf(locale, "finance.total_interest")}</dt>
              <dd className="text-right">
                {formatMoney(locale, quote.total_interest, quote.currency)}
              </dd>
            </dl>
          </>
        ) : null}
        {/* Spec §36.1: the disclaimer stays visible while the visitor explores. */}
        <p className="mt-space-sm font-body-sm text-on-surface-variant">
          {tf(locale, "finance.illustrative_disclaimer")}
        </p>
      </section>
    </div>
  );
}
```

- [ ] **Step 3b: Write the page**

Create `frontend/src/app/financing/page.tsx`:

```tsx
import type { Metadata } from "next";

import FinanceCalculator from "@/components/finance/FinanceCalculator";
import { fetchFinanceDefaults } from "@/lib/api/listings";
import { DEFAULT_LOCALE } from "@/lib/i18n/directory";
import { tf } from "@/lib/i18n/finance";

export const dynamic = "force-dynamic";

const CANONICAL_PATH = "/financing/";
const DEFAULT_CURRENCY = "EUR";

export function generateMetadata(): Metadata {
  return {
    title: tf(DEFAULT_LOCALE, "finance.page.title"),
    description: tf(DEFAULT_LOCALE, "finance.page.intro"),
    alternates: { canonical: CANONICAL_PATH },
  };
}

// Next 16: searchParams is a Promise.
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function FinancingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const locale = DEFAULT_LOCALE;

  // Spec §18.3's three parameters. `listing` is the authority; `price` is an
  // untrusted display fallback the calculator shows only while the real quote
  // loads, and never sends anywhere; `currency` only selects a display format,
  // and anything unsupported falls back to EUR rather than reaching Intl.
  const listingId = first(params.listing) ?? null;
  const fallbackPrice = first(params.price) ?? null;
  const requested = (first(params.currency) ?? "").toUpperCase();
  const currency = requested === DEFAULT_CURRENCY ? requested : DEFAULT_CURRENCY;

  // Spec §2.1 / §17.5: the calculator opens on the platform's REAL current
  // assumptions, read at request time (`force-dynamic` above, `no-store`
  // inside), never on a copy compiled into this bundle. `null` when no
  // configuration is active — the form then opens un-prefilled rather than
  // inventing numbers.
  const defaults = await fetchFinanceDefaults();

  return (
    <main className="mx-auto max-w-[1440px] px-margin-mobile py-space-xl md:px-margin-desktop">
      <h1 className="font-headline-md text-headline-md text-primary">
        {tf(locale, "finance.page.title")}
      </h1>
      <p className="mt-space-sm font-body-md text-on-surface-variant">
        {tf(locale, "finance.page.intro")}
      </p>
      <FinanceCalculator
        locale={locale}
        listingId={listingId}
        fallbackPrice={fallbackPrice}
        currency={currency}
        defaults={defaults}
      />
    </main>
  );
}
```

- [ ] **Step 4a: Run the tests to verify they pass**

```bash
cd frontend
pnpm test src/components/finance
pnpm lint
```

Expected: eight tests PASS; lint clean.

- [ ] **Step 4b: Prove the tamper defence over HTTP**

With both servers running and an eligible listing published (as in Task 9 Step 4b):

```bash
curl -s "http://127.0.0.1:3020/financing/?listing=<uuid>&price=1.00&currency=EUR" | grep -c "8,456.36"
```

Expected: the page hydrates and shows the server's €8,456.36 — the `1.00` never becomes a result. Confirm in the browser's network tab that the outgoing `POST /api/v1/finance/quotes/` body is `{"listing_id":"<uuid>"}` with no `price` key.

- [ ] **Step 4c: Prove the standalone page opens on real server values**

```bash
curl -s "http://127.0.0.1:8020/api/v1/platform/public-settings/" | grep -o '"finance_configuration":[^}]*}'
curl -s "http://127.0.0.1:3020/financing/" | grep -c 'value="5.0000"'
```

Expected: the endpoint reports the active version's four values, and the bare `/financing/` page's rate field is server-rendered with that same `5.0000` — not a literal in the bundle. Then activate a new configuration with a different rate (Django admin or `FinanceConfigurationService.activate`), reload `/financing/` **without rebuilding the frontend**, and confirm the field shows the new rate: that is spec §17.5's "changes automatically affect … the finance page", demonstrated.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/financing frontend/src/components/finance
git commit -m "feat(frontend): add the /financing/ estimator with the listing as its authority"
```

---

### Task 11: Frontend — the broker-only "Financing estimate" field group

**Files:**
- Create: `frontend/src/components/listings/FinancingEstimateFieldset.tsx`
- Create: `frontend/src/components/listings/FinancingEstimateFieldset.test.tsx`

**Interfaces:**
- Consumes: `tf` and the `listing.finance_*` keys (Task 7); `type Locale`; `type SellerType` from `@/lib/api/listings`.
- Produces:
  - `type FinanceFieldsetState = { show_finance_estimate: boolean; use_custom_assumptions: boolean; finance_rate_override_percent: string; finance_term_override_months: string; finance_down_payment_override_percent: string }`
  - `EMPTY_FINANCE_FIELDSET_STATE: FinanceFieldsetState`
  - `financeFieldsetPayload(state: FinanceFieldsetState): Record<string, string | number | boolean>` — the draft-payload fragment Phase 16 merges into its `PATCH /api/v1/listings/<id>/draft/` body
  - `type FinanceDefaults = { annual_rate_percent: string; term_months: number; down_payment_percent: string }` — the three platform assumption values shown when the toggle is on (spec §18.4: "show global defaults"). Structurally `FinanceConfigurationDefaults` (Task 6) minus `version`, so Phase 16 feeds this prop straight from `fetchFinanceDefaults()` — the same server source the `/financing/` page uses, so the form and the calculator can never disagree about the platform's defaults. Never a literal.
  - `FinancingEstimateFieldset` — default export, props `{ locale; sellerType; overridesEnabled; defaults; value; onChange }`

**Note (ruling — the component returns `null` for a private seller, and its payload builder omits the keys).** Spec §18.4: "Private-seller forms must neither render the fields nor accept them through API payloads." Rendering the group hidden with CSS is exactly what spec §39 forbids ("Hide prohibited fields only with CSS"), so the component renders nothing at all, and `financeFieldsetPayload` is never called for a private seller because Phase 16 will not mount the group. The backend refusal (`finance_not_allowed_for_private_seller`) stands independently and is proven in Task 12.

**Note (ruling — "cleared from the submitted effective UI state" means the payload, not the database).** Spec §18.4: "When off, override fields are hidden and cleared from the submitted effective UI state; stored overrides may remain but are ignored." So with the toggle off the payload carries `show_finance_estimate: false` and **no override keys at all** — it does not send `null`s, which would ask the backend to erase stored values the spec says may remain. Task 3's precedence logic is what makes stored-but-ignored safe.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/listings/FinancingEstimateFieldset.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import FinancingEstimateFieldset, {
  EMPTY_FINANCE_FIELDSET_STATE,
  financeFieldsetPayload,
  type FinanceFieldsetState,
} from "@/components/listings/FinancingEstimateFieldset";

const DEFAULTS = {
  annual_rate_percent: "5.0000",
  term_months: 48,
  down_payment_percent: "20.0000",
};

function renderGroup(
  state: FinanceFieldsetState = EMPTY_FINANCE_FIELDSET_STATE,
  props: Partial<React.ComponentProps<typeof FinancingEstimateFieldset>> = {},
) {
  const onChange = vi.fn();
  render(
    <FinancingEstimateFieldset
      locale="en"
      sellerType="BROKER"
      overridesEnabled
      defaults={DEFAULTS}
      value={state}
      onChange={onChange}
      {...props}
    />,
  );
  return onChange;
}

describe("FinancingEstimateFieldset", () => {
  it("renders nothing at all for a private seller", () => {
    const { container } = render(
      <FinancingEstimateFieldset
        locale="en"
        sellerType="PRIVATE"
        overridesEnabled
        defaults={DEFAULTS}
        value={EMPTY_FINANCE_FIELDSET_STATE}
        onChange={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("is titled and labelled exactly as spec 18.4 fixes it", () => {
    renderGroup();

    expect(screen.getByRole("group", { name: "Financing estimate" })).toBeInTheDocument();
    expect(
      screen.getByLabelText("Show an estimated monthly payment on this listing"),
    ).not.toBeChecked();
  });

  it("says the estimate is illustrative", () => {
    renderGroup();

    expect(screen.getByText(/illustrative monthly payment/)).toBeInTheDocument();
  });

  it("hides the assumption controls while the toggle is off", () => {
    renderGroup();

    expect(
      screen.queryByLabelText("Use custom assumptions for this listing"),
    ).not.toBeInTheDocument();
  });

  it("shows the platform defaults and the custom option when the toggle is on", () => {
    renderGroup({ ...EMPTY_FINANCE_FIELDSET_STATE, show_finance_estimate: true });

    expect(screen.getByText("5.0000%")).toBeInTheDocument();
    expect(screen.getByText("48 months")).toBeInTheDocument();
    expect(screen.getByText("20.0000%")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Use custom assumptions for this listing"),
    ).toBeInTheDocument();
  });

  it("offers no custom assumptions when staff disabled overrides globally", () => {
    renderGroup(
      { ...EMPTY_FINANCE_FIELDSET_STATE, show_finance_estimate: true },
      { overridesEnabled: false },
    );

    expect(
      screen.queryByLabelText("Use custom assumptions for this listing"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("5.0000%")).toBeInTheDocument();
  });

  it("reports the toggle upward rather than holding its own truth", async () => {
    const onChange = renderGroup();

    await userEvent.click(
      screen.getByLabelText("Show an estimated monthly payment on this listing"),
    );

    expect(onChange).toHaveBeenCalledWith({
      ...EMPTY_FINANCE_FIELDSET_STATE,
      show_finance_estimate: true,
    });
  });
});

describe("financeFieldsetPayload", () => {
  it("sends only the flag when the toggle is off", () => {
    expect(
      financeFieldsetPayload({
        show_finance_estimate: false,
        use_custom_assumptions: true,
        finance_rate_override_percent: "3.5000",
        finance_term_override_months: "60",
        finance_down_payment_override_percent: "10.0000",
      }),
    ).toEqual({ show_finance_estimate: false });
  });

  it("sends only the flag when custom assumptions are not used", () => {
    expect(
      financeFieldsetPayload({
        ...EMPTY_FINANCE_FIELDSET_STATE,
        show_finance_estimate: true,
      }),
    ).toEqual({ show_finance_estimate: true });
  });

  it("sends the overrides the broker actually filled in", () => {
    expect(
      financeFieldsetPayload({
        show_finance_estimate: true,
        use_custom_assumptions: true,
        finance_rate_override_percent: "3.5000",
        finance_term_override_months: "60",
        finance_down_payment_override_percent: "",
      }),
    ).toEqual({
      show_finance_estimate: true,
      finance_rate_override_percent: "3.5000",
      finance_term_override_months: 60,
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd frontend
pnpm test src/components/listings/FinancingEstimateFieldset.test.tsx
```

Expected: `Failed to resolve import "@/components/listings/FinancingEstimateFieldset"`.

- [ ] **Step 3: Write the field group**

Create `frontend/src/components/listings/FinancingEstimateFieldset.tsx`:

```tsx
"use client";

import type { SellerType } from "@/lib/api/listings";
import type { Locale } from "@/lib/i18n/directory";
import { tf } from "@/lib/i18n/finance";

export interface FinanceFieldsetState {
  show_finance_estimate: boolean;
  use_custom_assumptions: boolean;
  finance_rate_override_percent: string;
  finance_term_override_months: string;
  finance_down_payment_override_percent: string;
}

export const EMPTY_FINANCE_FIELDSET_STATE: FinanceFieldsetState = {
  // Spec §18.4: "Default for new broker listing: off."
  show_finance_estimate: false,
  use_custom_assumptions: false,
  finance_rate_override_percent: "",
  finance_term_override_months: "",
  finance_down_payment_override_percent: "",
};

export interface FinanceDefaults {
  annual_rate_percent: string;
  term_months: number;
  down_payment_percent: string;
}

/**
 * The fragment Phase 16 merges into its draft PATCH body.
 *
 * Spec §18.4: "When off, override fields are hidden and cleared from the
 * submitted effective UI state; stored overrides may remain but are ignored."
 * So the overrides are *omitted*, never sent as nulls: sending nulls would ask
 * the backend to erase values the spec says may remain, and
 * finance.listing_quotes already ignores them while the flag is off.
 */
export function financeFieldsetPayload(
  state: FinanceFieldsetState,
): Record<string, string | number | boolean> {
  const payload: Record<string, string | number | boolean> = {
    show_finance_estimate: state.show_finance_estimate,
  };
  if (!state.show_finance_estimate || !state.use_custom_assumptions) {
    return payload;
  }
  if (state.finance_rate_override_percent !== "") {
    payload.finance_rate_override_percent = state.finance_rate_override_percent;
  }
  if (state.finance_term_override_months !== "") {
    payload.finance_term_override_months = Number(state.finance_term_override_months);
  }
  if (state.finance_down_payment_override_percent !== "") {
    payload.finance_down_payment_override_percent =
      state.finance_down_payment_override_percent;
  }
  return payload;
}

/**
 * Spec §18.4's "Financing estimate" field group, for step 8 of spec §25.2's
 * listing form. Phase 16 owns that form and mounts this group; this phase owns
 * the group's rules.
 *
 * Spec §18.4: "Private-seller forms must neither render the fields nor accept
 * them through API payloads." This component returns null for a private seller
 * — not a hidden container, because spec §39 forbids hiding prohibited fields
 * with CSS — and the backend refuses the fields independently with
 * `finance_not_allowed_for_private_seller`.
 */
export default function FinancingEstimateFieldset({
  locale,
  sellerType,
  overridesEnabled,
  defaults,
  value,
  onChange,
}: {
  locale: Locale;
  sellerType: SellerType;
  overridesEnabled: boolean;
  defaults: FinanceDefaults;
  value: FinanceFieldsetState;
  onChange: (next: FinanceFieldsetState) => void;
}) {
  if (sellerType !== "BROKER") {
    return null;
  }

  function set<K extends keyof FinanceFieldsetState>(
    key: K,
    next: FinanceFieldsetState[K],
  ) {
    onChange({ ...value, [key]: next });
  }

  function overrideField(
    key:
      | "finance_rate_override_percent"
      | "finance_term_override_months"
      | "finance_down_payment_override_percent",
    labelKey: string,
  ) {
    return (
      <label className="flex flex-col gap-space-xs font-body-sm">
        <span>{tf(locale, labelKey)}</span>
        <input
          name={key}
          value={value[key]}
          inputMode="decimal"
          onChange={(event) => set(key, event.target.value)}
          className="rounded-lg border border-outline-variant px-space-sm py-space-xs"
        />
      </label>
    );
  }

  return (
    <fieldset className="flex flex-col gap-space-sm">
      <legend className="font-title-md text-title-md">
        {tf(locale, "listing.finance_group_title")}
      </legend>
      <p className="font-body-sm text-on-surface-variant">
        {tf(locale, "listing.finance_group_help")}
      </p>

      <label className="flex items-center gap-space-sm font-body-md">
        <input
          type="checkbox"
          checked={value.show_finance_estimate}
          onChange={(event) => set("show_finance_estimate", event.target.checked)}
        />
        <span>{tf(locale, "listing.finance_toggle")}</span>
      </label>

      {value.show_finance_estimate ? (
        <div className="flex flex-col gap-space-sm">
          <div className="font-body-sm text-on-surface-variant">
            <p>{tf(locale, "listing.finance_platform_defaults")}</p>
            <dl className="mt-space-xs grid grid-cols-2 gap-x-space-sm gap-y-space-xs">
              <dt>{tf(locale, "finance.annual_rate")}</dt>
              <dd className="text-right">{`${defaults.annual_rate_percent}%`}</dd>
              <dt>{tf(locale, "finance.term")}</dt>
              <dd className="text-right">
                {tf(locale, "finance.months", { count: defaults.term_months })}
              </dd>
              <dt>{tf(locale, "finance.down_payment")}</dt>
              <dd className="text-right">{`${defaults.down_payment_percent}%`}</dd>
            </dl>
          </div>

          {/* Spec §17.2: staff can disable the override capability globally. */}
          {overridesEnabled ? (
            <label className="flex items-center gap-space-sm font-body-md">
              <input
                type="checkbox"
                checked={value.use_custom_assumptions}
                onChange={(event) => set("use_custom_assumptions", event.target.checked)}
              />
              <span>{tf(locale, "listing.finance_custom_assumptions")}</span>
            </label>
          ) : null}

          {overridesEnabled && value.use_custom_assumptions ? (
            <div className="grid gap-space-sm sm:grid-cols-3">
              {overrideField("finance_rate_override_percent", "finance.annual_rate")}
              {overrideField("finance_term_override_months", "finance.term")}
              {overrideField(
                "finance_down_payment_override_percent",
                "finance.down_payment",
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </fieldset>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd frontend
pnpm test
pnpm lint
```

Expected: the ten new tests PASS and the whole frontend suite (Phase 3's and Phase 5's included) is green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/listings/FinancingEstimateFieldset.tsx frontend/src/components/listings/FinancingEstimateFieldset.test.tsx
git commit -m "feat(frontend): add the broker-only financing estimate field group"
```

---

### Task 12: Phase acceptance pass, definition-of-done evidence and handoff note

**Files:**
- Create: `backend/listings/tests/test_phase_9_acceptance.py`
- Modify: `ACTIVITY.md`

**Interfaces:**
- Consumes: everything Tasks 1–11 produced.
- Produces: no new application code. This task proves spec §18's five acceptance tests and spec §40 Scenarios C and D, then records the §39 handoff note.

- [ ] **Step 1: Write the acceptance tests**

Create `backend/listings/tests/test_phase_9_acceptance.py`:

```python
"""Spec §18's five acceptance tests and spec §40 Scenarios C and D.

One test per bullet, named after it. Acceptance test 4 ("CTA opens a separate
tab without granting opener access") is a DOM property and has no backend
surface: it is proven by
frontend/src/components/listings/BoatCard.test.tsx::"opens the calculator in a
new tab without granting opener access", which asserts target="_blank" and
rel="noopener noreferrer" on the href this file's Scenario C test produces.
"""

import itertools
from decimal import Decimal

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from brokers.tests.factories import make_broker
from finance.models import FinanceConfigurationVersion
from finance.services import FinanceConfigurationService
from listings.enums import ListingStatus, RevisionStatus
from listings.tests.factories import (
    make_broker_listing,
    make_private_listing,
    make_revision,
    make_snapshot,
)
from platform_settings.services import set_feature_flag

_names = itertools.count()


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture(autouse=True)
def flags_on(db):
    set_feature_flag(key="finance_estimates", is_enabled=True, actor=None)
    set_feature_flag(key="listing_revisions", is_enabled=True, actor=None)


def _staff():
    return make_user(
        email=f"moderator-{next(_names)}@example.com",
        role=UserRole.STAFF,
        verified=True,
    )


def _publish(listing, **snapshot_kwargs):
    snapshot = make_snapshot(listing, approved_by=_staff(), **snapshot_kwargs)
    listing.status = ListingStatus.PUBLISHED
    listing.current_public_snapshot = snapshot
    listing.published_at = timezone.now()
    listing.save(
        update_fields=["status", "current_public_snapshot", "published_at"]
    )
    return listing


def _broker_listing(**kwargs):
    index = next(_names)
    agent = make_user(
        email=f"agent-{index}@example.com", role=UserRole.BROKER_AGENT, verified=True
    )
    return make_broker_listing(
        broker=make_broker(name=f"Broker {index}", slug=f"broker-{index}"),
        actor=agent,
        price=Decimal("459000.00"),
        **kwargs,
    )


def _card(api, listing):
    response = api.get(reverse("listing-list"))
    return next(row for row in response.data["results"] if row["id"] == str(listing.pk))


@pytest.mark.django_db
def test_acceptance_1_broker_toggle_off_shows_no_installment_or_cta(api):
    listing = _publish(_broker_listing(show_finance_estimate=False))

    card = _card(api, listing)
    detail = api.get(reverse("listing-detail", kwargs={"listing_id": listing.pk}))

    assert card["finance"] == {"visible": False}
    assert detail.data["finance"] == {"visible": False}


@pytest.mark.django_db
def test_acceptance_2_list_and_finance_page_use_equal_assumptions_and_results(api):
    """The finance page's numbers come from POST /api/v1/finance/quotes/ with
    the listing id — the same request the card's CTA leads to."""
    listing = _publish(_broker_listing(show_finance_estimate=True))

    card = _card(api, listing)
    quote = api.post(
        reverse("finance-quote"), {"listing_id": str(listing.pk)}, format="json"
    )

    assert card["finance"]["monthly_payment"] == quote.data["monthly_payment"]
    assert card["finance"]["annual_rate_percent"] == quote.data["annual_rate_percent"]
    assert card["finance"]["term_months"] == quote.data["term_months"]
    assert card["finance"]["configuration_version"] == quote.data[
        "configuration_version"
    ]


@pytest.mark.django_db
def test_acceptance_3_a_private_sellers_crafted_finance_payload_is_rejected(api):
    """Spec §40 Scenario D. The payload refusal is Phase 11's
    `finance_not_allowed_for_private_seller`; this test proves it still holds
    now that finance has a public surface, and that the surface stays absent."""
    owner = make_user(
        email=f"seller-{next(_names)}@example.com",
        role=UserRole.PRIVATE_SELLER,
        verified=True,
    )
    listing = make_private_listing(owner=owner, price=Decimal("459000.00"))
    make_revision(listing, state=RevisionStatus.DRAFT)
    api.force_authenticate(user=owner)

    response = api.patch(
        reverse("listing-draft-update", kwargs={"listing_id": listing.pk}),
        {"version": listing.version, "show_finance_estimate": True},
        format="json",
    )

    assert response.status_code == 400
    assert response.data["error"]["fields"]["show_finance_estimate"][0] == (
        "Finance options are available to broker listings only."
    )
    listing.refresh_from_db()
    assert listing.show_finance_estimate is False

    api.force_authenticate(user=None)
    _publish(listing)
    detail = api.get(reverse("listing-detail", kwargs={"listing_id": listing.pk}))
    assert detail.data["finance"] == {"visible": False}


@pytest.mark.django_db
def test_acceptance_5_new_staff_defaults_update_non_overridden_cards_only(
    api, django_capture_on_commit_callbacks
):
    """Spec §18 acceptance test 5, spec §17.5.

    The on-commit capture is required: activate() invalidates the finance
    configuration cache inside transaction.on_commit, which does not fire in a
    django_db test, and the two `before` card reads have already warmed that
    cache with version 1.
    """
    plain = _publish(_broker_listing(show_finance_estimate=True))
    overridden = _publish(
        _broker_listing(
            show_finance_estimate=True,
            finance_rate_override_percent=Decimal("3.5000"),
        )
    )
    before_plain = _card(api, plain)["finance"]["monthly_payment"]
    before_overridden = _card(api, overridden)["finance"]["monthly_payment"]

    with django_capture_on_commit_callbacks(execute=True):
        FinanceConfigurationService.activate(
            FinanceConfigurationVersion(
                annual_rate_percent=Decimal("7.0000"),
                term_months=48,
                down_payment_percent=Decimal("20.0000"),
            )
        )

    after_plain = _card(api, plain)
    after_overridden = _card(api, overridden)
    assert after_plain["finance"]["annual_rate_percent"] == "7.0000"
    assert after_plain["finance"]["monthly_payment"] != before_plain
    assert after_overridden["finance"]["annual_rate_percent"] == "3.5000"
    assert after_overridden["finance"]["monthly_payment"] == before_overridden


@pytest.mark.django_db
def test_scenario_c_a_published_broker_card_returns_the_spec_numbers(api):
    """Spec §40 Scenario C: €459,000, finance enabled, global 20%/5%/48 and no
    overrides -> €8,456.36/month, a view count and a calculator CTA target."""
    listing = _publish(_broker_listing(show_finance_estimate=True))

    card = _card(api, listing)

    assert card["price"] == {"amount": "459000.00", "currency": "EUR"}
    assert card["finance"] == {
        "visible": True,
        "monthly_payment": "8456.36",
        "annual_rate_percent": "5.0000",
        "term_months": 48,
        "down_payment_percent": "20.0000",
        "configuration_version": 1,
    }
    assert card["view_count"] == 0
    # The CTA target the frontend builds from exactly these two values
    # (spec §18.3); frontend/src/lib/api/listings.test.ts pins the string.
    assert card["id"] and card["price"]["currency"] == "EUR"
```

- [ ] **Step 2: Run them and confirm they pass**

```bash
cd backend
uv run pytest listings/tests/test_phase_9_acceptance.py -v
```

Expected: five tests PASS with no production-code change. If any fails, fix the production code — not the test — and record what was wrong in the handoff note.

- [ ] **Step 3: Full regression across both projects**

```bash
cd backend
uv run python manage.py check
uv run python manage.py makemigrations --check --dry-run
uv run pytest -v
cd ../frontend
pnpm lint
pnpm test
pnpm build
```

Expected: `check` reports no issues; `makemigrations --check` reports no missing migrations (proving the four snapshot columns are fully captured by `0005`); the whole backend suite passes against real Postgres and Redis; the frontend lints, tests and builds.

- [ ] **Step 4: Walk the spec §18 definition of done and §39's handoff checklist**

Confirm each, with the command output from Steps 2 and 3 in hand:

- §18.1 card placement — `BoatCard.tsx` (Task 8), rendered by `/boats/` (Task 9); view count in the upper metadata row, price left and estimate right in the pricing row, CTA below, disclosure below that, asterisk resolving to the region's single footnote.
- §18.2 eligibility — `FinanceQuoteService.is_visible` (Task 3), eight tests; ineligible returns exactly `{"visible": false}` and the card renders no finance element at all.
- §18.3 new-tab behaviour — `financingHref` (Task 6), `target`/`rel` (Task 8), tamper defence (Tasks 5 and 10).
- §18.4 broker form — `FinancingEstimateFieldset` (Task 11) plus the backend refusal proven in Step 2.
- §18.5 API representation — `PublicListingSerializer` (Task 4), exact-shape tests.
- §2.5 — the dictionary test in Task 7 fails the build on lender language; grep the backend for the same words as a second check:

```bash
cd backend
grep -rniE "\b(approved|pre-approved|guaranteed|offer|your rate)\b" finance/ listings/serializers.py | grep -viE "approved_by|approved_at|approved_revision|approve_revision|requires_staff_approval|approved snapshot|approved public|current_public_snapshot"
```

Expected: no line that would reach a user. (`approve`/`approved_*` in the listing workflow are moderation vocabulary, not finance vocabulary, which is why they are filtered out.)

- [ ] **Step 5: Record the handoff note and commit**

Append a new entry at the top of `ACTIVITY.md`'s `## Log` section, substituting the real counts from Step 3's output where `<N>` appears:

```markdown
### 2026-09-18 — Phase 9 finance card UI and broker listing toggle complete

- Implemented `docs/superpowers/plans/2026-09-18-phase-9-finance-ui.md` in full (12 tasks).
- **Migrations:** `listings.0005_listingsnapshot_finance_settings` (four additive columns on `ListingSnapshot`, all nullable or defaulted — reversible, drops the columns), `listings.0006_backfill_snapshot_finance_settings` (copies configured broker listings' finance settings onto their snapshots; ran against 0 rows; reverse is a no-op because 0005's reverse drops the columns), `platform_settings.0005_seed_finance_broker_overrides_setting` (reversible), `finance.0003_seed_finance_estimates_flag` (reversible). No column was altered or dropped; rollback is safe in any order that respects the dependency chain.
- **Models/services/endpoints/components:** `ListingSnapshot` publishes the four broker finance settings; `finance.listing_quotes` is new and owns spec §18.2 eligibility, spec §17.2 GLOBAL/LISTING_OVERRIDE precedence and the spec §18.5 block (the `FinanceQuoteService` spec §31 names); `listings.serializers.PublicListingSerializer` gained the `finance` key and nothing else; `POST /api/v1/finance/quotes/` accepts `listing_id` and returns `assumption_sources` on both contexts; `GET /api/v1/platform/public-settings/` gained a read-only `finance_configuration` key carrying the active version's four values. Frontend: `lib/api/listings.ts`, `lib/i18n/finance.ts`, `components/listings/BoatCard`, `FinanceDetailsDisclosure`, `FinancingEstimateFieldset`, `components/finance/FinanceCalculator`, and the `/boats/` and `/financing/` pages.
- **Prerequisite merged separately:** the down-payment override's 99.99% ceiling (spec §17.3) was a live validation defect in merged `listings.payloads` unrelated to this phase's flag-guarded UI work. It shipped as its own PR on `fix-finance-percent-ceiling` before this plan started; Phase 9 builds on the corrected write path and adds the read-time range check in `finance.listing_quotes` as defence in depth.
- **Contract tests changed deliberately, each with its reason in the file:** `platform_settings/tests/test_registry.py` (renamed, one key added), `listings/tests/test_public_read_api.py` (the finance-block-absence test replaced), `finance/tests/test_views.py` (one `"assumption_sources": None` entry added to the worked-example dict, no other line touched). `platform_settings/tests/test_views.py` gained two cases and had none changed — `finance.broker_overrides_enabled` is `is_public=False`, so the public settings payload's `settings` dict is byte-identical to Phase 2's.
- **Permissions and audit:** no new permission class. The quote endpoint stays `AllowAny` and gained the `finance_quote` throttle scope (120/min) on Phase 3's IP-hashing throttle. `GET /api/v1/platform/public-settings/` stays `AllowAny`, unauthenticated and read-only; its new `finance_configuration` key publishes only values already visible on every eligible boat card's spec §18.5 block, and `finance.broker_overrides_enabled` is `is_public=False` so no staff policy switch is published. Changing `finance.broker_overrides_enabled` writes `platform_setting.updated`; toggling `finance_estimates` writes `feature_flag.updated` — both through Phase 2's audited services, no new audit action introduced.
- **Tests:** `<N>` backend tests pass against real PostgreSQL and Redis; `<N>` frontend tests pass; `pnpm build` and `manage.py makemigrations --check` are clean. Spec §18's acceptance tests 1, 2, 3 and 5 and spec §40 Scenarios C and D are `backend/listings/tests/test_phase_9_acceptance.py`; acceptance test 4 (new tab, no opener access) is `BoatCard.test.tsx`.
- **Feature flag state:** `finance_estimates` is seeded **disabled**. Every finance surface is invisible until staff enable it; `listing_revisions` is unchanged.
- **Known limitations:** see the plan's "Known Limitations" section — no `FinanceQuoteLog`, no boat detail page (no listing slug until Phase 20/21), the listing form itself is Phase 16, spec §10.1's three finance setting *keys* still do not exist in `SETTINGS_REGISTRY` (Phase 8's `FinanceConfigurationVersion` remains the source of truth; only its values are now published), and two `SUPPORTED_CURRENCIES` constants still exist.
- **Screenshots:** `/boats/` with an eligible and an ineligible card side by side, the card's open details disclosure, `/financing/` reached from the CTA with a tampered `?price=` in the URL and the server's own price on the page, and bare `/financing/` pre-filled from the active configuration (with the same page after a staff activation, unchanged frontend build, showing the new rate).
- Next: Phase 10 (listing view analytics) writes the `view_count` this phase's card already renders; Phase 16 mounts `FinancingEstimateFieldset`; Phase 20 owns the boat detail page and the responsive/visual-regression pass.
```

Update the "Current State" section to mention `/boats/` and `/financing/` alongside the directory pages.

```bash
git add ACTIVITY.md backend/listings/tests/test_phase_9_acceptance.py
git commit -m "test(listings): add Phase 9 acceptance tests and record the phase handoff note"
```

---

## Known Limitations (carried forward, not fixed by this plan)

Each item names the phase that closes it. None breaks a MUST requirement *of this phase* (spec §39: "Any known limitation that breaks a MUST requirement prevents completion").

1. **No `FinanceQuoteLog`.** Spec §11.6 calls it "optional but recommended" and §30.4 mentions rate-limiting "finance quote logging". Nothing is logged. The two places where §11.6's rule ("Log only an explicit calculator interaction or detail request", never a rendered card) would attach already exist and are the only two quote requests the product makes: the card's details disclosure and the finance page. Adding the model is a small, self-contained follow-up for whichever phase wants the analytics; the `source CARD | FINANCE_PAGE` discriminator §11.6 specifies maps one-to-one onto those two callers.
2. **Spec §10.1's three finance setting *keys* still do not exist in `SETTINGS_REGISTRY`.** Spec §10.1 lists `finance.annual_rate_percent`, `finance.term_months` and `finance.down_payment_percent` as settings, but Phase 8 implemented the live values as `FinanceConfigurationVersion` rows instead (a deliberate, recorded deviation — versioned and immutable so historical quotes stay reproducible). That deviation stands; this plan does not undo it. What Task 2 *does* close is its only visible consequence: `GET /api/v1/platform/public-settings/` now publishes the active version's four values under a `finance_configuration` key, so `/financing/` opened with no `?listing=` starts pre-filled from real platform state (spec §2.1, §17.5) instead of an empty form. **Remaining gap:** the values are published read-only, under a different key shape than §10.1's table describes, and staff still change them only by activating a new configuration version — there is no `update_setting` path for them and this plan deliberately does not add one, because a §10.1-shaped mutable setting would contradict Phase 8's immutability guarantee. A future phase that wants §10.1's literal shape has to reconcile the two models first, not just rename a key.
3. **No public boat detail page.** Spec §4.1 fixes it at `/boats/<listing-slug>/` and Phase 11's Known Limitation 6 records that no slug field exists, so the URL cannot be built correctly yet. `GET /api/v1/listings/<id>/` serves the same representation, including the `finance` block, and acceptance test 1's "or detail" half is proven against it. → **Phase 20/21**.
4. **`/boats/` has no filters, facets, sort or saved search.** Spec §29.4's filter requirements are written for the professionals directory; the boat search surface is Phase 20's, together with the responsive QA (§29.5) and the visual regression snapshots (§29.6's definition of done). This page is the smallest real host for the card.
5. **The listing create/edit form does not exist.** `FinancingEstimateFieldset` is complete and tested but is mounted nowhere until **Phase 16** (spec §25.2 step 8) builds the form. Its `defaults` prop expects the active configuration's three values, which Phase 16 gets from Task 6's `fetchFinanceDefaults()` — the same source the `/financing/` page uses, so the form and the calculator can never show different platform defaults.
6. **Two `SUPPORTED_CURRENCIES` constants.** `finance.serializers.SUPPORTED_CURRENCIES` (a tuple) and `listings.models.SUPPORTED_CURRENCIES` (a frozenset) both hold `EUR`. This plan reads the finance one for eligibility, because the question it answers is "can the calculation engine handle this currency". Collapsing them into one shared constant means touching two merged apps for no behavioural gain today; the moment a second currency is added, that is the trigger.
7. **`DIRECTORY_API_BASE_URL` is imported by a non-directory module.** `lib/api/listings.ts` aliases it to `PUBLIC_API_BASE_URL` rather than redeclaring `process.env.NEXT_PUBLIC_API_BASE_URL`, because two constants for one value drift. Renaming it in a shared module is a mechanical cleanup for whichever phase next touches both files.
8. **The card's image slot is a placeholder for every listing.** `media_manifest` carries `storage_key`, not a URL, and building CDN URLs is **Phase 15** (spec §24). The slot renders a neutral CSS block for both cases today and the component already branches on whether a primary image exists, so Phase 15 replaces one element.
9. **No compact view-count formatting.** Spec §19.5 asks for compact formatting above 9,999 with the exact value in the accessible label. The card renders the exact localized integer with an accessible label already; compact formatting belongs with **Phase 10**, which owns `ListingView` and §19.5.
10. **The finance page renders English only, like every other page in this project.** There is no locale routing, cookie or segment yet (Phase 5's Known Limitation, unchanged). Every page passes `locale=en`; the dictionary is complete in all three languages and nothing needs re-translating when routing lands.
11. **No `Idempotency-Key` on the quote endpoint.** A quote is a pure read with no side effect, so spec §30.3's replay store does not apply. Noted only because §30.3's list is sometimes read as universal.
12. **A broker's finance edit waits for moderation like any other edit.** Because the settings are snapshotted (see the scope ruling), turning the toggle on takes effect when the revision is approved, not when it is saved. That is what spec §36.1's "draft broker finance settings do not leak before publication" asks for and what spec §18.4's "no staff finance approval **separate from** the normal listing workflow" permits — but it does mean a broker cannot flip the estimate on instantly. If the business ever wants an instant toggle, the honest way to build it is a dedicated, audited endpoint that writes the *snapshot-visible* value under its own authorization rule, not a public read of the draft column.
13. **`FinancePolicy` is loaded once per request, and the active configuration is cached for 300 seconds.** Phase 8's cache TTL means a newly activated configuration can take up to five minutes to reach a card unless the activation path invalidates it — which `FinanceConfigurationService.activate` does, on commit. Two application processes therefore converge immediately; a stale value can only survive a cache write that loses a race with an activation. Spec §17.5's "invalidates cache after commit" is satisfied; sub-second global consistency is not promised and is not asked for.

---

## Contract summary for later phases

Everything a downstream phase imports from Phase 9, in one place.

```python
from finance.listing_quotes import (
    BROKER_OVERRIDES_SETTING,
    FINANCE_ENABLED_SETTING,
    FINANCE_ESTIMATES_FLAG,
    GLOBAL,
    LISTING_OVERRIDE,
    REQUESTED,
    EffectiveAssumptions,
    FinanceConfigurationUnavailable,
    FinancePolicy,
    FinanceQuoteService,
    format_percent,
    is_financeable_price,
    resolve_effective_assumptions,
)
from finance.serializers import MANUAL_REQUIRED_FIELDS, FinanceQuoteRequestSerializer
```

Plus one HTTP addition, consumed rather than imported: `GET /api/v1/platform/public-settings/` gains a top-level `finance_configuration` key — `{"version": int, "annual_rate_percent": str, "term_months": int, "down_payment_percent": str}`, or `null` when no version is active.

(`listings.payloads.MAX_DOWN_PAYMENT_OVERRIDE_PERCENT` / `MAX_RATE_OVERRIDE_PERCENT` are **not** Phase 9's. They come from the standalone `fix-finance-percent-ceiling` PR that lands on `dev` before this plan runs; import them from that, not from here.)

```ts
// frontend
import {
  fetchFinanceDefaults,
  fetchPublishedListing,
  fetchPublishedListings,
  financingHref,
  listingQuery,
  requestFinanceQuote,
  type AssumptionField,
  type AssumptionSource,
  type FinanceConfigurationDefaults,
  type FinanceQuote,
  type FinanceQuoteInput,
  type ListingFinance,
  type ListingMedia,
  type PublicListing,
  type SellerType,
} from "@/lib/api/listings";
import {
  FINANCE_MESSAGES,
  formatCount,
  formatMoney,
  tf,
} from "@/lib/i18n/finance";
import BoatCard from "@/components/listings/BoatCard";
import FinanceDetailsDisclosure from "@/components/listings/FinanceDetailsDisclosure";
import FinancingEstimateFieldset, {
  EMPTY_FINANCE_FIELDSET_STATE,
  financeFieldsetPayload,
  type FinanceDefaults,
  type FinanceFieldsetState,
} from "@/components/listings/FinancingEstimateFieldset";
```

Rules a later phase must follow:

1. **Never read `BoatListing.show_finance_estimate` or the three override columns on a public path.** They are draft state. The published values are `listing.current_public_snapshot.show_finance_estimate` and its three siblings, and `finance.listing_quotes` is the only module that reads them. This is spec §36.1 and Phase 11 contract rule 1.
2. **Never compute a payment anywhere but `finance.calculations.calculate_finance_quote`.** Not in a serializer, not in a template, and never in the browser. The frontend converts decimal strings to `Number` only to hand them to `Intl` for display.
3. **Never widen or narrow the `finance` block's two shapes.** Spec §18.5 fixes six keys when eligible and exactly `{"visible": false}` when not. A phase that needs another derived figure on the card requests it from `POST /api/v1/finance/quotes/` with `listing_id`, the way the details disclosure does.
4. **`FinancePolicy.load()` once per request, never per row.** It costs two Postgres reads. `PublicListingSerializer` caches one per instance; any new listing-facing serializer must do the same, and `listings/tests/test_public_finance_block.py::test_serializing_three_cards_costs_the_same_queries_as_one` is the test that catches a regression.
5. **Phase 10 writes `BoatListing.view_count_cached`; the card already renders it.** No card change is needed. If §19.5's compact formatting above 9,999 is added, add it inside `formatCount` in `lib/i18n/finance.ts` so every surface changes at once, and keep the exact value in the accessible label.
6. **Phase 15 replaces the card's image placeholder**, in `BoatCard.tsx`'s one `data-testid="boat-image-placeholder"` element, by turning `media_manifest[].storage_key` into a real URL. Do not invent a URL shape anywhere else.
7. **Phase 16 mounts `FinancingEstimateFieldset` at step 8 of spec §25.2** and merges `financeFieldsetPayload(state)` into its draft `PATCH` body. Do not build a second finance field group, do not render it for a private seller, and do not send `null` overrides to "clear" stored values — spec §18.4 says stored overrides may remain and are ignored. Feed its `defaults` prop from `fetchFinanceDefaults()`, never from a literal.

7a. **`resolve_effective_assumptions(*, snapshot, policy)` requires `policy.configuration is not None`,** which `FinancePolicy.active` reports and `FinanceQuoteService.is_visible()` implies. Check one of them first; calling it otherwise raises `FinanceConfigurationUnavailable` by design. `card_block()` already does this and answers `{"visible": False}` instead, so a public path never sees the exception.

7b. **The platform's current finance assumptions come from `finance_configuration` on `GET /api/v1/platform/public-settings/`.** Never hard-code `5 / 48 / 20` in a frontend bundle, a fixture that ships to production, or a second endpoint (spec §2.1, §17.5). The key is read-only: staff change the values by activating a new `FinanceConfigurationVersion`, never by writing a setting. When it is `null`, render an un-prefilled control — do not substitute a fallback constant. Note that it is composed in `PublicPlatformSettingsView`, deliberately outside `get_public_settings()`'s forever-cache; anything else added there must make the same choice or it will serve stale finance data.
8. **Phase 16's `can_show_finance` policy flag (spec §25.1) is `listing.seller_type == BROKER`,** and the server-side truth that backs it is `listings.payloads.allowed_payload_fields`, which already admits `BROKER_FINANCE_FIELDS` only for a broker listing. Report the policy; do not re-derive the rule.
9. **Phase 20 owns the boat detail page, the `/boats/` search facets and the responsive/visual-regression pass.** It must reuse `BoatCard` rather than introducing a second card (spec §29.1), and the detail page must use the same `finance` block from the same representation.
10. **A new UI string goes in `FINANCE_MESSAGES` with all three languages**, never as a literal in a component (spec §37), and never using "approved", "pre-approved", "guaranteed", "offer" or "your rate" (spec §2.5) — `finance.test.ts` fails on all five.
11. **`finance_estimates` gates the listing finance surface only.** Phase 8's manual calculator is deliberately ungated, so do not add the flag to `FinanceQuoteView` wholesale; it is consulted inside `FinancePolicy.load()`, which the listing context path uses.
12. **New quote error codes stay stable:** `listing_not_found`, `finance_not_available_for_listing`, `price_mismatch`. A client branches on them (Task 10 does), so renaming one is a breaking change.

---

## Self-Review

**1. Spec coverage — §18 (Phase 9), line by line:**

| Spec §18 requirement | Where implemented |
|---|---|
| §18.1 View count in the card's upper metadata row next to an eye icon | Task 8 (`BoatCard`, `formatCount` + accessible label; icon `aria-hidden`) |
| §18.1 Price in the lower pricing row, left aligned | Task 8 |
| §18.1 Estimated payment in the same row, right aligned, label `Estimated payment`, value `€X,XXX/month*` | Task 8 (`finance.estimated_payment` + `formatMoney` + `finance.per_month` + the asterisk anchor) |
| §18.1 `Calculate your financing` link/button with a directional arrow | Task 8 (`finance.calculate` + `→`, `aria-hidden`) |
| §18.1 Optional details disclosure using live calculation results, never fixed sample copy | Task 8 (`FinanceDetailsDisclosure` fetches the server quote on first open — ruling recorded) |
| §18.1 The disclaimer asterisk resolves within the card/list region | Tasks 8 and 9 (`disclaimerId` prop, one `#finance-disclaimer` footnote per list region, rendered only when a card on the page shows an estimate) |
| §18.1 …and on the finance page | Task 10 (the disclaimer is always rendered, with or without a quote) |
| §2.1 / §17.5 The standalone `/financing/` page shows real platform assumptions, not invented ones, and follows a staff change without a redeploy | Task 2 (`finance_configuration` on the public settings endpoint), Task 6 (`fetchFinanceDefaults`), Task 10 (`defaults` prop, pre-filled form, `null` → un-prefilled; Step 4c demonstrates the no-redeploy update) |
| §18.2 The six-condition eligibility conjunction | Task 3 (`FinanceQuoteService.is_visible`, one test per condition) |
| §18.2 If any condition fails, remove the whole estimated-payment column, CTA and disclosure; no zeros, no disabled placeholders | Tasks 3 (`{"visible": False}`), 4, 8 (the union type makes reading a figure without narrowing a compile error; the "removes the whole finance column" test asserts absence of all four elements) |
| §18.3 CTA target `/financing/?listing=…&price=…&currency=EUR` | Task 6 (`financingHref`, exact-string test), Task 8 (test), Task 12 |
| §18.3 `target="_blank" rel="noopener noreferrer"` | Task 8 (acceptance test 4's proof) |
| §18.3 The finance page treats `listing` as the authority and ignores tampered price parameters | Task 10 (the request carries `listing_id` only) + Task 5 (`price_mismatch` refuses the other direction) |
| §18.3 Query price is a display fallback while loading | Task 10 (`fallbackPrice`, replaced by `quote.price`; test asserts both states) |
| §18.4 Field group title `Financing estimate` | Task 11 (`listing.finance_group_title`, `<legend>`, test) |
| §18.4 Toggle `Show an estimated monthly payment on this listing` | Task 11 (`listing.finance_toggle`, test) |
| §18.4 Default off for a new broker listing | Task 11 (`EMPTY_FINANCE_FIELDSET_STATE`) + Task 1 (the model default, unchanged from Phase 11) |
| §18.4 When off, override fields hidden and cleared from the submitted UI state; stored overrides remain but are ignored | Task 11 (`financeFieldsetPayload` omits them — ruling recorded) + Task 3 (`resolve_effective_assumptions` ignores them) |
| §18.4 When on, show global defaults and an optional "Use custom assumptions for this listing" | Task 11 (`defaults` block + the checkbox, hidden entirely when staff disabled overrides) |
| §18.4 Save requires no staff finance approval separate from the normal listing workflow | Nothing added: the toggle rides Phase 11's existing draft → revision → decision path, and no finance-specific approval exists anywhere in this plan |
| §18.4 Copy states clearly that the estimate is illustrative | Task 7 (`listing.finance_group_help`), Task 11 (test) |
| §18.4 Private-seller forms neither render the fields nor accept them through API payloads | Task 11 (returns `null`, not a hidden container — spec §39) + Phase 11's `finance_not_allowed_for_private_seller`, re-proven in Task 12 |
| §18.5 The card response's `finance` block, six keys | Tasks 3 and 4 (exact-dict tests on both endpoints) |
| §18.5 Ineligible returns `{"visible": false}` and no assumptions | Tasks 3, 4, 12 |
| Acceptance 1 — broker toggle off: no installment/CTA in list or detail | Task 12 `test_acceptance_1…` (list and detail), Task 8 (the card renders nothing) |
| Acceptance 2 — toggle on: list and finance page use equal assumptions/results | Task 12 `test_acceptance_2…` (card block vs. the listing quote the page requests) |
| Acceptance 3 — private-seller crafted payload rejected and UI absent | Task 12 `test_acceptance_3…` |
| Acceptance 4 — CTA opens a separate tab without granting opener access | `BoatCard.test.tsx` (Task 8); named explicitly in Task 12's module docstring because it has no backend surface |
| Acceptance 5 — staff changing defaults updates all non-overridden eligible cards | Task 12 `test_acceptance_5…` (one plain card changes, one overridden card does not) + Task 3's unit-level equivalent |

**2. Spec coverage — cross-referenced sections.** §1's fixed decisions (global defaults 5/48/20, broker-only finance, never for private sellers) → Global Constraints, Tasks 3, 11, 12. §2.1 (every visible state has a backend source; "Production UI must not display invented, hard-coded … operational data", naming `FinanceQuoteService`) → the image-placeholder ruling, and the absence of any hard-coded rate/term anywhere in the frontend: Task 2 publishes the active configuration, Task 6 fetches it, Task 10's calculator and Task 11's fieldset both take it as a prop, and a `null` configuration degrades to an un-prefilled control rather than a fallback constant. §2.5 (no misleading finance language) → Task 7's forbidden-word test over the EN dictionary and Task 12 Step 4's backend grep. §4.1's `/boats/` and `/financing/` routes → Tasks 9 and 10; `/boats/<listing-slug>/` is ruled out with Phase 11's Known Limitation 6 as the reason. §10.1's settings table → Task 2, with the one addition recorded in the registry test itself and deliberately `is_public=False` (staff-only policy, no browser consumer), which is why the public settings endpoint's exact-dict contract test needs no edit; §10.1's three finance *value* keys remain Phase 8's `FinanceConfigurationVersion` (Known Limitation 2), whose active values Task 2 now publishes read-only. §11.4's `ListingSnapshot` → Task 1's four columns, with the §11.4-vs-§36.1 tension resolved in a written scope ruling. §11.6's `FinanceConfigurationVersion` → read, never written, by this phase; `FinanceQuoteLog` is a Known Limitation with its two natural call sites named. §17.1's formula → never re-implemented; every path calls Phase 8's `calculate_finance_quote`, and §17.1's two worked vectors (€8,456.36 and €4,569.01) both appear as assertions. §17.2's precedence and effective-source reporting → Task 3 (`GLOBAL`/`LISTING_OVERRIDE`) and Task 5 (`assumption_sources` in the response), closing Phase 8's "no configuration-precedence mechanism at all" limitation. §17.3's ranges → the standalone `fix-finance-percent-ceiling` prerequisite PR (the write-path down-payment ceiling, merged to `dev` before this plan runs — not built here), Task 3 (re-checked at read time as defence in depth, with the fallback-to-global ruling), Task 5 (serializer bounds, unchanged). §17.4's two contexts → Task 5, closing Phase 8's "no `listing_id` quote context" limitation; §17.4's `overall_cash_outlay` note → the `finance.overall_outlay` key exists with clear labelling for whichever surface wants it. §17.5's request-time calculation and post-commit invalidation, and its "changes automatically affect boat cards **and the finance page**" → Tasks 3 and 12 for the card half (with the on-commit capture that makes the test honest), and Task 2 + Task 10 for the finance-page half (the page reads the active configuration at request time through the public settings endpoint, which is composed outside that endpoint's forever-cache precisely so an activation is not frozen out; Task 10 Step 4c demonstrates it end to end without a frontend rebuild). §25.1's `can_show_finance` → contract rule 8. §29.1's boat-card field list and its four prohibitions → Task 8 (one component, one representation; no hard-coded counts, no private-seller finance, no prototype 120/6.5 copy, no client-side seller-type inference — `seller_type` comes from the API). §29.5's stacking price/payment row and keyboard-focusable CTA → Task 8's `sm:` breakpoint and a real `<a>` rendered on the server. §29.6's accessible icon text and non-colour state → Task 8's `aria-label` + `aria-hidden` icon, Task 11's labelled controls. §30.1's `POST /api/v1/finance/quotes/` → extended, not replaced; `GET /api/v1/platform/public-settings/` likewise gains one top-level key and no new route, so this plan adds no URL at all. §30.2's envelope, decimal strings and stable codes → Task 5. §30.4's finance rate limit → Task 5's `finance_quote` scope on Phase 3's IP-hashing throttle. §31's traceability rows (Estimated installment / Finance assumptions / Broker finance toggle / Card view count) → Tasks 3, 4, 8, 11, each with the named failure state ("entire block hidden if ineligible", "global fallback", "absent for private seller"). §35.1's `finance_estimates` → Task 2, gating both the API block and, through it, every frontend surface. §36.1's seven finance edge cases → zero-interest (Phase 8's engine, untouched), price changes only when public and pending revisions not leaking (Task 1's snapshot + the snapshot price), draft settings not leaking (Task 1), the global kill switch (Task 3), localized currency with numeric calculation (Task 7), and exploration with the disclaimer visible and the card defaults still server-defined (Task 10 — the explored values are the server's own, pre-filled from the active configuration, and come back marked `REQUESTED`). §37's five keys for this feature → Task 7, asserted by name. §39's protocol → the per-task TDD structure, the two HTTP-level red-to-green checks in Tasks 9 and 10, and Task 12's handoff note covering all seven required items. §40 Scenarios C and D → Task 12.

**Gaps deliberately left, with the owning phase named:** `FinanceQuoteLog` (§11.6, optional — any later analytics phase), the boat detail page (§4.1 — Phase 20/21), the listing form that mounts the field group (§25 — Phase 16), compact view-count formatting (§19.5 — Phase 10), CDN media URLs (§24 — Phase 15), locale routing (§37 — unchanged from Phase 5), and the reconciliation of §10.1's three finance setting *keys* with Phase 8's `FinanceConfigurationVersion` model (their active values are now published read-only, but they are still not registry settings). All are in Known Limitations; none is a §18 requirement.

**Work this plan explicitly does not do, with its owner named:** the down-payment override's 99.99% write-path ceiling (spec §17.3). It is a live defect in merged `listings.payloads`, unrelated to this phase's flag-guarded UI, and is being fixed as the standalone `fix-finance-percent-ceiling` PR that merges to `dev` first. This plan assumes it and layers a read-time re-check on top (Task 3). Task 1 touches neither `listings/payloads.py` nor `listings/tests/test_payloads.py`.

**3. Placeholder scan:** no "TBD", "TODO", "implement later", "add appropriate error handling", "handle edge cases", "write tests for the above" or "similar to Task N" appears in any task. (The single "TODO" in the document is Global Constraints quoting spec §39's prohibition.) Every code step carries the real code; every test step carries the real test. Three places instruct the executor to read the real file rather than repeat it — the eleven untouched `EXPECTED_KEYS_AND_DEFAULTS` entries in Task 2, the existing throttle-rate dict in Task 5, and the `<N>` counts in Task 12's handoff note — and each is explicit about what to substitute and why. The **conditional** instruction that used to sit in Task 2's Step 4 ("if any `platform_settings` test asserts a closed set of public keys, add the new key to it") is gone: the key is `is_public=False`, so the answer is decided, not delegated, and Step 4 now states plainly that `test_public_settings_endpoint_returns_all_seeded_keys` requires no change. Every contract test this plan does change is named by file and test, with the exact edit and its justification comment written out.

**3a. Locked-down contract tests touched by this plan — all four accounted for, none left as a guess:**

| Test | This plan | How |
|---|---|---|
| `platform_settings/tests/test_registry.py::test_registry_defines_exactly_the_twelve_spec_keys` | **changes** (Task 2) | renamed, one key added to `EXPECTED_KEYS_AND_DEFAULTS`, reason written in the file; a new `test_the_broker_override_switch_is_not_a_public_setting` pins the visibility decision |
| `platform_settings/tests/test_views.py::test_public_settings_endpoint_returns_all_seeded_keys` | **does not change** (Task 2) | the new key is `is_public=False` so it never enters `settings`, and `finance_configuration` is a sibling of `settings`, not a member — two cases are *added* to that file, none edited |
| `listings/tests/test_public_read_api.py::test_the_response_never_exposes_a_finance_block_in_this_phase` | **replaced** (Task 4) | it asserts the absence of the thing this phase adds; replaced in place, same commit, reason in the docstring; the `forbidden` top-level-key set above it is untouched |
| `finance/tests/test_views.py::test_finance_quote_endpoint_matches_spec_worked_example` | **changes** (Task 5) | exact-dict equality on a manual quote; `"assumption_sources": None` added with its reason, every other line byte-identical so the money values still prove no regression |

`finance/tests/test_serializers.py` and `listings/tests/test_payloads.py` are the two suites this plan claims run genuinely untouched, and neither claim is load-bearing on a file this plan edits.

**4. Type and name consistency (checked across every task's Interfaces block):**
- `FinancePolicy.load()`, `FinancePolicy.active`, `FinanceQuoteService.is_visible(listing, *, policy)`, `FinanceQuoteService.card_block(listing, *, policy)` and `resolve_effective_assumptions(*, snapshot, policy)` keep identical signatures in Tasks 3, 4, 5 and 12. The `policy` keyword is never positional anywhere. `resolve_effective_assumptions`'s precondition (`policy.configuration is not None`) is stated in its Interfaces entry, enforced by a `FinanceConfigurationUnavailable` raise in its body, pinned by its own test in Task 3, and repeated as contract rule 7a — so the one implicit rule an exported function carried is now explicit in four places.
- `format_percent(value)` is defined once in Task 3 and used by both `card_block` (Task 3) and `_quote_response` (Task 5), so a card and a quote can never format the same rate two ways.
- The four snapshot column names (`show_finance_estimate`, `finance_down_payment_override_percent`, `finance_rate_override_percent`, `finance_term_override_months`) are byte-identical to `BoatListing`'s, in the model (Task 1), the builder (Task 1), the factory (Task 1), the backfill migration (Task 1) and the reader (Task 3).
- The assumption-source vocabulary is one closed set — `GLOBAL`, `LISTING_OVERRIDE`, `REQUESTED` — defined once in Task 3, used in Tasks 3 and 5, asserted as literal strings in both test files and typed as `AssumptionSource` on the frontend (Task 6). The *field* vocabulary is closed too: `finance.listing_quotes.ASSUMPTION_FIELDS` and the frontend's `AssumptionField` union hold the same three names, so `assumption_sources` is `Record<AssumptionField, AssumptionSource> | null` rather than an open `Record<string, …>` and a mistyped field name is a compile error.
- The active configuration's four published names (`version`, `annual_rate_percent`, `term_months`, `down_payment_percent`) are byte-identical to `FinanceConfigurationVersion`'s own columns in Task 2's view helper, Task 2's two endpoint tests, Task 6's `FinanceConfigurationDefaults`, Task 10's `DEFAULTS` test fixture and Task 11's `defaults` prop — and the three assumption values are the same three names `EffectiveAssumptions` and the `finance` card block use, so one rate never travels under two names. Both percent values are formatted the same way as `finance.listing_quotes.format_percent` (quantize to four places), so a card and the calculator cannot render one rate two ways.
- The `finance` block's six keys appear identically in Task 3's implementation, Task 3's exact-dict test, Task 4's endpoint tests, Task 6's `ListingFinance` union, Task 8's component and Task 12's Scenario C assertion.
- Error codes are a closed set — `listing_not_found`, `finance_not_available_for_listing`, `price_mismatch` — listed in Global Constraints, produced in Task 5, branched on in Task 10, and named again in contract rule 12.
- Frontend: `tf(locale, key, params?)` (never `t`, which is Phase 5's directory function) and `formatMoney(locale, amount, currency)` / `formatCount(locale, value)` keep identical signatures in Tasks 7, 8, 9, 10 and 11. Every message key used in a component exists in `FINANCE_MESSAGES`, and Task 7's first test fails on any key missing a locale. `Locale` is imported, never redeclared (Phase 5 contract rule 12).
- `PublicListing`, `ListingFinance`, `FinanceQuote`, `AssumptionField`, `AssumptionSource` and `FinanceConfigurationDefaults` match the backend responses field for field, including `finance` being a union rather than an optional-field object and `FinanceQuote.assumption_sources` being present-and-nullable on **both** contexts rather than optional on one — which is exactly what Task 5's widening of `finance/tests/test_views.py` makes true on the wire.
- `BoatCard`'s props (`locale`, `listing`, `disclaimerId`) are the same three in its definition (Task 8), its test (Task 8) and its only call site (Task 9), and `disclaimerId` is required so a card cannot be mounted into a region with no footnote.
- `FinanceFieldsetState`, `EMPTY_FINANCE_FIELDSET_STATE` and `financeFieldsetPayload` are named identically in Task 11's definition, its test and the contract summary; the payload keys it emits (`show_finance_estimate`, `finance_rate_override_percent`, `finance_term_override_months`, `finance_down_payment_override_percent`) are exactly Phase 11's `BROKER_FINANCE_FIELDS`, so a payload this builder produces is one `listings.payloads.validate_revision_payload` accepts.
- Route names used in `reverse()` (`listing-list`, `listing-detail`, `listing-draft-update`, `finance-quote`) are Phase 8's and Phase 11's existing names; this plan adds no URL.

**Gaps found and closed during this review:**

1. **Two tests would have passed for the wrong reason.** `test_a_new_active_configuration_changes_a_non_overridden_card` (Task 3) and `test_acceptance_5…` (Task 12) both warm Phase 8's 300-second configuration cache before activating a new version, and `FinanceConfigurationService.activate` defers its invalidation to `transaction.on_commit`, which never fires inside a `django_db` test. Both now take `django_capture_on_commit_callbacks` and wrap the activation, matching Phase 8's own `test_activate_deactivates_previous_version_and_invalidates_cache`. Without this, spec §18's acceptance test 5 would have been "proved" by a stale cache.
2. **A real validation gap in merged code, reachable from this phase's feature — and split out of this plan.** Phase 11's `_clean_percent` bounds both override percentages at 0–100, but spec §17.3 caps the down payment at 99.99%, and a stored 100% down payment means a zero principal, which the same section forbids. It was harmless while nothing read the field; it stops being harmless the moment a card calculates from it. The review that found it also found it did not belong here: it is a live, unflagged API-correctness defect on a write path this phase does not otherwise touch, while everything else in Phase 9 is gated behind a `finance_estimates` flag seeded disabled. Bundling the two would have made a one-line correctness fix wait on a twelve-task UI phase and would have mixed an unflagged behaviour change into a flagged release. It is therefore the standalone **`fix-finance-percent-ceiling`** PR, merged to `dev` before this plan starts; Task 1 assumes it and touches neither `listings/payloads.py` nor `listings/tests/test_payloads.py`. What stays here is Task 3's read-time re-check, which is not a duplicate: it belongs with the code that *reads* a stored value, it covers rows written before the fix, and it survives any future validator change. An out-of-range stored override falls back to the global assumption instead of reaching the calculator.

2a. **Two regression tests in an earlier draft referenced a fixture that does not exist.** They took a `broker_listing` parameter and the draft claimed `listings/tests/test_payloads.py` "already builds a broker listing … so reuse that fixture/helper by its existing name". That file defines **no** `@pytest.fixture` at all — the only fixtures reaching it are the two autouse cache-clearing ones in `listings/tests/conftest.py` and `backend/conftest.py` — and its existing tests build listings inline (`make_broker_listing(broker=make_broker(), actor=make_user(email=OWNER_EMAIL))`). Both tests exercised the write path, which finding 2 moved out of this plan, so they went with it rather than being repaired here; Task 1's Step 1 records the pattern so the prerequisite PR does not repeat the mistake.

2b. **An exported function could crash on a valid input.** `resolve_effective_assumptions(*, snapshot, policy)` dereferenced `policy.configuration` unconditionally. Neither of this phase's two call sites can reach it with `None` — both go through `is_visible()` first, which implies `policy.active`, which implies a configuration — so it never crashes today. But the Contract summary *exports* it, and the precondition was invisible at the call site, so a later phase would have met an `AttributeError` on `None` inside a module it did not write. It now raises `FinanceConfigurationUnavailable` with a sentence naming the precondition and how to check it, with a test. The signature was deliberately not narrowed to take a bare `configuration`: `policy` also carries `broker_overrides_enabled`, which the override half of the function needs, so splitting it would create two parameters that must agree and a ripple through Tasks 3, 5 and 12 for no extra safety.
3. **The plan originally read the finance flags off the `BoatListing` row**, which spec §18.2's literal wording invites. Spec §36.1's "draft broker finance settings do not leak before publication" and Phase 11 contract rule 1 both forbid it, and `listings.drafts._apply_payload_to_listing` proves those columns are draft state. Task 1 (snapshot the settings) exists because of this review, and the scope ruling records the whole argument.
4. **`listing.views` was going to be an unused key.** The card labels its count with `listing.views_label`, so the standalone noun spec §37 names had no call site. It is kept with a comment naming Phase 10's labelled-count surfaces as its consumer, rather than deleted (which would drop a §37 key) or forced into the card (which would duplicate the label).
5. **`FinancePolicy` was originally resolved inside `card_block`.** That is two Postgres reads per card, 48 on a full page, because `get_setting_value` is uncached. It is now a request-scoped object passed as a keyword, with `test_serializing_three_cards_costs_the_same_queries_as_one` as the regression guard and contract rule 4 as the instruction for the next serializer.
6. **The manual `/financing/` form was going to be pre-filled with a hard-coded 5% / 48 / 20%, then was going to be empty, and is now pre-filled from the server.** Hard-coding is what spec §2.1 forbids outright ("Production UI must not display invented, hard-coded … operational data", naming `FinanceQuoteService`) and what spec §17.5 breaks on the first staff activation. An empty form invents nothing but makes §17.5's "and the finance page" vacuous for the standalone case and is a visibly worse page. The third option was the right one and is small: Task 2 publishes the active `FinanceConfigurationVersion`'s four values read-only under `finance_configuration` on the endpoint that already exists, Task 6 fetches it, Task 10 pre-fills from it, and `null` degrades to an un-prefilled control rather than a fallback constant. Nothing new is disclosed — the same four values already ride on every eligible boat card's §18.5 block on the same unauthenticated endpoint family. The one trap this had to avoid is recorded in the sub-ruling: `get_public_settings()` caches its payload forever and is invalidated only by `update_setting`, which activating a configuration does not call, so the finance half is composed in the view and read through `FinanceConfigurationService`'s own activation-invalidated cache instead. Folding it into that dict would have satisfied §2.1 and silently broken §17.5.

7. **A staff-only policy switch was going to be published to every anonymous visitor.** `SettingDefinition.is_public` defaults to `True` and all twelve merged keys take the default, so `finance.broker_overrides_enabled` would have joined the public payload by omission — breaking `test_public_settings_endpoint_returns_all_seeded_keys`, which an earlier draft handled with a conditional instruction ("if any test asserts a closed set, add the key to it") rather than a decision. It is now `is_public=False`, which is both correct (Task 3 reads it server-side; no browser consumer exists) and narrower: that contract test needs no edit at all. Not to be confused with finding 6 — that publishes the finance *configuration values*; this withholds a *policy flag*.

8. **Task 5 broke a Phase 8 exact-dict test while claiming, twice, that it would not.** `_quote_response` adds `assumption_sources` to both response paths, so a manual quote gains a key — and `finance/tests/test_views.py::test_finance_quote_endpoint_matches_spec_worked_example` asserts exact dict equality. The draft's Interfaces note and its Step 4 both said that file "must pass untouched", while the plan's *own* new `test_a_manual_quote_is_unchanged_by_this_phase` asserted `response.data["assumption_sources"] is None`, which requires the key to exist. The two claims could not both be true. Resolved in favour of the uniform shape — one response shape for both of §17.4's contexts is what lets Task 6's single `FinanceQuote` type cover both, and the alternative would have needed an optional field or a second type — with the exact-dict test widened by exactly one entry in the same commit, its justification written into the test file the way Tasks 2 and 4 do for the other contract tests they change. Every "pass untouched" claim about that file is removed; the honest claim, that `test_serializers.py` is untouched and that every *other* line of the worked-example dict is byte-identical, is what Step 4 now asserts.

9. **A migration docstring made a claim about live data that nothing in this plan can check.** `0006_backfill_snapshot_finance_settings` says it "runs against zero rows in every environment that exists today". That is probably true and is load-bearing — a non-zero count means the migration would carry a broker's stored finance settings onto a live public snapshot, and any row above the 99.99% ceiling would then be silently re-based to the global down payment by Task 3's read-time check, changing a live listing's stated terms without anyone deciding to. Task 1's Step 3e now carries an explicit, blocking controller instruction to run the counting query against every real database and confirm zero before merging, with the docstring reworded from an assertion to an expectation that names where it is verified.
