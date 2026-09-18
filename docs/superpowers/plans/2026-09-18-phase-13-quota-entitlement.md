# NAUTA Phase 13 — Individual Free Quota and Entitlement Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Phase 11's `ListingEntitlementGate` stub into a real, audited entitlement ledger — a new `entitlements` app owning `UserEntitlement`, the `ListingEligibilityService` of spec §22.2, the `GET /api/v1/listing-eligibility/` endpoint, `403 listing_entitlement_required` enforcement on draft creation and submission, atomic single-consumption under a per-user lock, and the daily expiry/reminder tasks of spec §22.5.

**Architecture:** One new Django app, `entitlements`, owns the ledger (`UserEntitlement`), the free-quota arithmetic, the eligibility payload and the consumption transaction. It has **zero Python imports from `listings`** (the FK to `BoatListing` is a string reference resolved by Django), so the dependency arrow is one-directional: `listings` → `entitlements`. Five existing `listings` modules change by a handful of lines each — `policies.py` (the whole `ListingEntitlementGate` class body, which Phase 11's contract rule 6 reserves for this phase), `models.py` (one field: loose `UUIDField` → real FK), `admin.py` (that field's name), `submissions.py` (three lines inside the existing entitlement block), `drafts.py` (a two-line gate) and `signals.py` (two appended signals). Listing publication expiry is a listing state change, so it lives in two **new** `listings` modules (`expiry.py`, `tasks.py`) beside the other services that hold the transaction, the lock and the audit event together.

**Tech Stack:** Python 3.13 + `uv`, Django 5.2 LTS, Django REST Framework, PostgreSQL 16, Redis (cache, Celery broker), Celery (+ Celery beat schedule declarations). No new third-party dependencies. Backend-only — no frontend files are touched (see the scope ruling on §22.3).

**Spec:** [`NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md`](../../../NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md) — primarily §22 (Phase 13), §11.9 (`UserEntitlement`), §6.3 (entitlement state machine), §36.3 (free and paid rights edge cases), §26.3 (staff entitlement operations), §10.1 (the five `individual.*` platform settings this phase reads), §30.1/§30.2 (endpoint inventory, error envelope with `action`), §27.1 (`listing.expiring` / `listing.expired` events), §35.1 (`individual_entitlements` flag), §38 (seed data), §39 (execution protocol).

**Predecessor plans (read before starting):**
- [`2026-09-18-phase-11-listing-workflow.md`](./2026-09-18-phase-11-listing-workflow.md) — **hard dependency, fully merged into `dev`.** Its "Contract summary for later phases" is binding. Rule 6 names this phase's exact mandate: *"Phase 13 changes exactly one class body: `listings.policies.ListingEntitlementGate`. It must also convert `BoatListing.consumed_entitlement_id` (a loose `UUIDField`) into a real FK to `UserEntitlement`, and set it inside `submit_listing_revision`'s existing transaction."* Its Known Limitations 1, 10 and 12 are the three this phase closes.
- [`2026-09-17-phase-3-identity-organizations-permissions.md`](./2026-09-17-phase-3-identity-organizations-permissions.md) — the `User` model, `UserRole.PRIVATE_SELLER`, `SellerType`, `IsActiveUser`/`IsEmailVerified`, `resolve_seller_context`, `HashedIPScopedRateThrottle`. Rules 1, 2, 5, 6, 9 are binding here.
- [`2026-09-18-phase-5-directory-consolidation.md`](./2026-09-18-phase-5-directory-consolidation.md) — **structural template** for this document, and the precedent for creating a brand-new app rather than growing an existing one when spec §3's app list already names the new app.
- [`2026-09-17-phase-2-shared-types-platform-settings.md`](./2026-09-17-phase-2-shared-types-platform-settings.md) — `platform_settings.services.get_setting_value()`/`is_feature_enabled()`/`set_feature_flag()`, `audit.services.record_audit_event()`, `common.models.UUIDTimeStampedModel`.

**Phase dependencies:** spec §7 and `docs/superpowers/PHASE-TRACKER.md` — Phase 13 depends on Phase 11 only, which is `done`. Phase 14 (Stripe) depends on *this* phase; its surfaces appear here only as documented seams.

## Execution Model

Per the standing project convention recorded in `ACTIVITY.md`: each task is implemented on its own branch off the current tip of `dev` (`git checkout -b task-N-<slug> dev`), run through `subagent-driven-development`'s implementer → task-reviewer → fix-loop cycle, opened as a PR (`gh pr create`), and merged by the controller only when CI is green and the branch is cleanly mergeable. Tasks run strictly sequentially — never two branches in flight at once — and each new task branches from the just-merged `dev` tip. This includes Task 1, the scaffolding task.

---

## Global Constraints

Exact values copied from the spec. Every task's requirements implicitly include this section.

- **Individual free allowance:** **one** free listing per rolling **365-day** entitlement period; approved publication lasts **30 days**. Both numbers are staff-configurable (spec §1, §22.1). They are read from `platform_settings`, never hard-coded: `individual.free_listing_count` (int, default `1`, range `0–100`), `individual.free_period_days` (int, default `365`, range `1–3650`), `individual.free_publish_days` (int, default `30`, range `1–3650`). **All three keys already exist** in `backend/platform_settings/registry.py` — this plan adds no registry keys and does not modify that file.
- **Paid listing right:** default publication duration **30 days** (`individual.paid_publish_days`), unused entitlement expires after **365 days** (`individual.paid_entitlement_valid_days`). Both keys already exist in the registry.
- **Broker listing quota is unlimited** (spec §1, §21). No broker path in this plan ever consults, reserves or consumes an entitlement.
- **Entitlement state machine (spec §6.3), verbatim:**
  ```text
  AVAILABLE -> RESERVED -> CONSUMED
  AVAILABLE -> EXPIRED
  RESERVED  -> AVAILABLE (creation cancelled or timed out)
  CONSUMED  -> REVOKED (refund/chargeback or staff remedy)
  ```
  Reservations expire after **30 minutes** unless attached to a saved draft. **Consumption happens when the listing is submitted for initial approval, not when the create form first opens.**
- **Enum values are copied verbatim from spec §11.9 and must never be renamed** (they are persisted, returned in API responses and written into audit events): `entitlement_type` ∈ `FREE_LISTING | PAID_LISTING | MEDIA_UPGRADE`; `source` ∈ `FREE_POLICY | STRIPE_PURCHASE | STAFF_GRANT`; `state` ∈ `AVAILABLE | RESERVED | CONSUMED | EXPIRED | REVOKED`.
- **Product code:** `INDIVIDUAL_LISTING_RIGHT` (spec §22.2's `purchase_product_code`, §23.1's product list).
- **Blocking reason vocabulary:** `FREE_ALLOWANCE_USED` is spec-literal (§22.2). This plan adds exactly one more, `NOT_AN_INDIVIDUAL_SELLER` (ruling below). `null` means nothing is blocking.
- **Feature flag key for this phase:** `individual_entitlements` (spec §35.1), seeded **disabled** — matching the `listing_revisions` precedent and spec §35.2 step 4 ("Deploy code with features off/read-compatible"). The flag gates **refusal only**, never bookkeeping: ledger rows are written whether or not the flag is on (ruling below).
- **Error codes added by this phase (closed set):** `listing_entitlement_required` (403, on `POST /api/v1/listings/drafts/` and `POST /api/v1/listings/<id>/submit/`), `invalid_entitlement_state` (409, a staff action against a row in the wrong state), and one **field-level** code, `entitlement_reason_required` (staff grant/revoke/restore without a reason). No other new codes. Phase 11's rule 10 applies: any new listing-related error code must be stable and documented here.
- **`entitlement_reason_required` is a field-level code, not a top-level envelope code.** `EntitlementReasonRequired` subclasses DRF's `ValidationError` (see the ruling in Task 13), and `common.exceptions.nauta_exception_handler` maps **every** `ValidationError` — subclass or not — to `code: "validation_error"` plus a `fields` map built by `_field_map(exc.detail)`. So the wire shape is a **400 `validation_error` envelope carrying `fields: {"reason": ["entitlement_reason_required"]}`**, and `entitlement_reason_required` never appears as `error.code`:
  ```json
  {"error": {"code": "validation_error",
             "message": "The submitted data is invalid.",
             "fields": {"reason": ["Explain why this entitlement is being changed."]},
             "request_id": "..."}}
  ```
  That is deliberate — the reason is a *field* the staff user failed to fill in, and the `fields` map is the only thing that can say which field. Consequence for tests: DRF's `ValidationError.get_codes()` on a **dict** detail returns a **dict**, so an assertion must be `exc.get_codes() == {"reason": ["entitlement_reason_required"]}` (or `exc.detail["reason"][0].code == "entitlement_reason_required"`), never a bare string.
- **Error envelope:** spec §30.2, produced by `common.exceptions.nauta_exception_handler`. This phase adds the `action` passthrough the spec's own worked example requires:
  ```json
  {"error": {"code": "listing_entitlement_required",
             "message": "You have used your free listing allowance.",
             "fields": {},
             "action": {"type": "PURCHASE", "product_code": "INDIVIDUAL_LISTING_RIGHT"},
             "request_id": "..."}}
  ```
  The message string is copied verbatim from spec §30.2.
- **Expiry reminders:** **7 days and 1 day** before expiration (spec §22.5 "Default reminders"). Module constant, not a platform setting — see the ruling.
- Backend: Python 3.13 + `uv`, Django 5.2 LTS, DRF for all JSON APIs, PostgreSQL 16 and Redis via the existing `docker-compose.yml` (Postgres `127.0.0.1:5433`, Redis `127.0.0.1:6380`). Backend dev server port is **8020**.
- **Tests run against PostgreSQL, never SQLite.** `backend/config/settings/test.py` MUST NOT be modified to override `DATABASES` or `CACHES` to SQLite / `LocMemCache`. This rule was violated and reverted once already in this project — if a test is slow or awkward against real Postgres/Redis, fix the test, never the settings.
- All primary keys are UUIDs; all timestamps are timezone-aware UTC (spec §11 preamble). Every new model inherits `common.models.UUIDTimeStampedModel` (Phase 3 contract rule 2).
- User references use `settings.AUTH_USER_MODEL` in model fields and `django.contrib.auth.get_user_model()` in code/tests — never a hardcoded `"accounts.User"` string (Phase 3 contract rule 1).
- **Rate limiting uses `common.throttling.HashedIPScopedRateThrottle`**, installed as `DEFAULT_THROTTLE_CLASSES` in Phase 3. Views declare **only** `throttle_scope`, never `throttle_classes` (Phase 3 contract rule 9). New scope added by this plan: `listing_eligibility` = **`120/min`**.
- **Money and time in JSON:** decimal strings for money, ISO 8601 UTC for times (spec §30.2). This phase returns no money; the product's price is Phase 14's.
- **Every state change writes an immutable audit event** containing actor, action, target, before/after and source (spec §2.4) via `audit.services.record_audit_event()`, called from *inside* the same `transaction.atomic()` block as the change. System-driven changes use `actor_type=AuditEvent.ActorType.SYSTEM` and `source=AuditEvent.Source.TASK`; staff actions use `ActorType.USER` / `Source.ADMIN`.
- **No business rule lives only in a view** (spec §3 closing paragraph). Every rule in this plan is a service function called by the view, the admin action and the task alike.
- No partial or visual-only implementations, no faked/hardcoded demo data, no TODO placeholders for backend enforcement (spec §39).
- TDD per task: write the failing test, run it and see it fail, write the minimal implementation, run it and see it pass, commit.
- **Where a task says "append to" an existing module, its code block repeats the imports that block needs.** Consolidate them into the module's single import section at the top rather than leaving mid-file `import` statements.
- **Every settings and urls edit in this plan is additive.** `backend/config/settings/base.py` and `backend/config/urls.py` already carry merged entries from Phases 0/1, 2, 3, 4, 5, 8 and 11. Read the real file, add to it, never paste over it.

---

## Cross-phase collision notice (read this first)

Phases 9, 10 and 12 are being planned in parallel with this one. Phase 12 (broker auto-approval) also touches `backend/listings/`. This plan therefore states its `listings/` footprint exactly:

| `backend/listings/` file | This plan's change | Task | Phase 12 overlap risk |
|---|---|---|---|
| `policies.py` | Replaces the **whole `ListingEntitlementGate` class body** and adds a `ConsumedRight` dataclass. Does **not** touch `requires_staff_approval`, `effective_media_allowance`, `media_counts` or `MediaAllowance`. | 8 | **Same file, different symbol.** Phase 12 owns `requires_staff_approval`; Phase 15 owns `effective_media_allowance`. Line-level conflict only, resolved by keeping both edits. |
| `models.py` | `consumed_entitlement_id = UUIDField(...)` → `consumed_entitlement = ForeignKey("entitlements.UserEntitlement", ...)`. One field. No constraint, index or `clean()` change. | 7 | Low. |
| `admin.py` | `BoatListingAdmin.readonly_fields`: `"consumed_entitlement_id"` → `"consumed_entitlement"`. One string. | 7 | Low. |
| `submissions.py` | Inside `submit_listing_revision`, **only**: (a) the existing 7-line entitlement block (the `can_submit` guard + the `consume` call) is replaced, (b) the existing one-line `is_initial = listing.current_public_snapshot_id is None` assignment moves **three lines up**, above that block, because the guard now needs it, and (c) one added keyword argument on the `is_initial` branch's `bump_version(listing, ...)`. Does **not** touch `validate_submission_media`, `withdraw_listing_revision`, the `requires_staff_approval(listing)` branch structure, the audit call or the signal block. | 8 | **HIGH — same function.** Phase 12 adds the `else:` auto-approval branch to `if requires_staff_approval(listing):`. This plan does not add, remove or reindent that `if`, and the moved `is_initial` line lands *above* it, not inside it. The two diffs touch adjacent but disjoint line ranges; merge order does not matter, but whoever merges second must re-read the function. |
| `drafts.py` | Inside `create_listing_draft`, two lines added immediately after `resolve_seller_context(...)`, plus two imports. Nothing else in the module. | 9 | Low — Phase 12 has no reason to touch draft creation. |
| `signals.py` | Appends two `Signal()` objects (`listing_expiring`, `listing_expired`) and extends the module docstring. Nothing existing is renamed. | 10 | Low. |
| `expiry.py`, `tasks.py` | **New files.** | 10, 11 | None. |
| `tests/test_entitlement_enforcement.py`, `tests/test_expiry.py` | **New files.** | 8, 9, 10, 11 | None. |
| `tests/conftest.py` | Extends `LISTINGS_FEATURE_FLAG_KEYS` with `"individual_entitlements"`; adds a `broker_seller` fixture (Task 8). The existing autouse cache fixture is untouched. | 8 | Low, but a parallel phase adding its own fixture here will conflict on the same file. |
| `tests/test_policies.py`, `tests/test_boat_listing_model.py` | Existing Phase 11 tests updated in place: the three `ListingEntitlementGate` stub assertions (Task 8) and two appended FK tests (Task 7). No Phase 11 test is deleted. | 7, 8 | Low. |
| `enums.py`, `views.py`, `urls.py`, `serializers.py`, `decisions.py`, `payloads.py`, `locking.py`, `permissions.py`, `snapshots.py` | **Untouched.** | — | None. |

Shared files outside `listings/`: `backend/config/settings/base.py` (append to `INSTALLED_APPS`, `CELERY_TASK_ROUTES`, `DEFAULT_THROTTLE_RATES`; add `CELERY_BEAT_SCHEDULE`), `backend/config/urls.py` (one `include`), `backend/common/exceptions.py` (one `action` passthrough block mirroring the existing `meta` one), `backend/conftest.py` (one appended `published_listing_with_snapshot` fixture, Task 10 — it must live at the repo-test root because it is consumed from **two different app test packages**, `listings/tests/` and `entitlements/tests/`, and a `conftest.py` fixture is only visible inside its own directory subtree). Expect trivial rebases, not real conflicts.

---

## Scope rulings

Where spec §22 is ambiguous or under-specified, the ruling is made here once so no task has to guess.

**Note (ruling — `UserEntitlement` lives in a new `entitlements` app, not in `listings` or `accounts`).**
Spec §3's suggested app list names `entitlements` and `payments` as apps in their own right, exactly as it named `services_catalog` — which Phase 5 created rather than growing `professionals`. Four further reasons make this the right call:
1. **Spec §11.9 groups the four models under one heading** ("Entitlements and products"): `MarketplaceProduct`, `UserEntitlement`, `PaymentOrder`, `ProcessedWebhookEvent`. Three of the four are Phase 14's. Putting `UserEntitlement` anywhere else would split that group across apps on a phase boundary rather than a domain boundary, and Phase 14 would then have to choose between following it or splitting the group again.
2. **One-directional dependency, no cycle.** `entitlements` imports `accounts`, `audit`, `platform_settings` and `common`, and **never** imports `listings`. `UserEntitlement.listing` is declared as the string `"listings.BoatListing"`, which Django resolves lazily, so no Python import exists in that direction. `listings` imports `entitlements`. Putting the ledger inside `listings` would make spec §11.9's explicit warning — *"Do not infer historical quota solely from current listings"* — an architectural temptation rather than an enforced boundary.
3. **Different lifecycle, different actors.** A listing is edited by its seller and moderated by staff; an entitlement is created by policy, Stripe or a staff grant, and is never edited by the seller at all. Files that change together live together.
4. **`accounts` is the wrong home** for the same reason: quota is a marketplace commercial concept, not an identity one, and `accounts` is already the most-imported app in the project.

**Note (ruling — this phase does *not* build `MarketplaceProduct`).**
Spec §22.2's payload carries `purchase_product_code`, a **code string**, and this plan emits the constant `INDIVIDUAL_LISTING_RIGHT` (spec §23.1's first product code). It does not build the `MarketplaceProduct` row, because the product's name, price, currency, Stripe ids and `display_amount`/Stripe-price reconciliation are spec §23.1 and §23.5 — Phase 14 — and a product record with no verified Stripe price is exactly the "decorative financial value" spec §38 forbids in production seed data. §22.3's purchase modal (product name, price, currency, refund/help link) therefore has no backend source until Phase 14, which is recorded in Known Limitations and is why the CTA cannot be built here either.

**Note (ruling — §22.3's UI is a documented seam, not a deliverable; this phase is backend-only).**
`frontend/src/app/` today contains `login`, `verify-email`, `403`, `health`, `services`, `professionals` and `sitemap.ts` — there is **no `/sell/` route, no `/sell/create/` route and no private dashboard**. Phase 11, which owns the listing workflow, was backend-only by controller ruling and assigned all of it to Phases 16/17/20. §22.3's four bullets are: a disabled "Start a listing" control, an adjacent purchase CTA, a purchase modal, and "Confirming creates a Stripe Checkout Session and redirects to Stripe." The last is literally Phase 14 (spec §23.2); the first three have no page to attach to. Building them here would mean inventing the Sell landing page, the private dashboard and the create route that Phase 16 owns (spec §25), then rebuilding them when Phase 16 lands.
What this phase delivers instead is the complete backend contract §22.3 renders from, so Phase 16 has to invent nothing: `GET /api/v1/listing-eligibility/` returns `can_start_listing` (drives the disabled control), `blocking_reason` (drives which copy to show), `free.next_available_at` (drives spec §31's "exact next eligibility date"), `free.publication_days`, `paid_listing_rights_available` (drives §22.3's "Use an available listing right" branch) and `purchase_product_code`. The §37 copy keys `listing.free_allowance_used` and `listing.buy_right` are reserved in this plan's Contract summary and are Phase 16's to translate. Recorded in Known Limitations.

**Note (ruling — the `individual_entitlements` flag gates refusal, never bookkeeping).**
Spec §35.1 requires flags to gate backend mutation, and spec §35.2 step 4 deploys code "with features off". If the flag also suppressed ledger writes, then every free listing published before the flag flips on would leave **no** `UserEntitlement` row, and on the day the flag is enabled every one of those users would be handed a second free listing — the precise failure spec §11.9 warns about ("Do not infer historical quota solely from current listings"). So:
- Flag **off**: `consume_listing_right()` still writes the `CONSUMED` ledger row, with `metadata["enforced"] = False`; nothing is ever refused; `ListingEligibilityService.for_user()` reports `can_start_listing: true` and `blocking_reason: null` (which is the truth about what the backend will do), while the `free` block still reports the real quota arithmetic.
- Flag **on**: identical bookkeeping, plus `403 listing_entitlement_required` at the two enforcement points.
This keeps spec §22's definition of done item 2 — "UI and API agree on eligibility" — true under **both** flag states, which is what a rollout flag is for. A consumption recorded while the flag was off and beyond the configured allowance also carries `metadata["over_allowance"] = True`, so the ledger never lies about what happened.

**Note (ruling — draft creation validates but does not reserve).**
Spec §22.4 says draft creation *"may* reserve an available paid right or mark intended free eligibility without consuming until submit" — permission, not obligation. This plan does **not** reserve, for a concrete reason: a reservation attached to a saved draft is explicitly exempt from §6.3's 30-minute timeout, and this codebase has **no** listing deletion, archival or abandonment mechanism (Phase 11 shipped none; `ListingStatus.ARCHIVED` is unreachable). A paid right reserved at draft creation would therefore have no release path at all and would leak permanently — strictly worse than not reserving. The §6.3 sweep this phase *does* build makes the same point mechanically: `release_stale_reservations()` filters on `listing__isnull=True`, because §6.3 exempts a reservation "attached to a saved draft" from the 30-minute clock and assumes some *other* mechanism releases it when the draft is abandoned. **No such abandonment mechanism exists in this codebase** — so a draft-attached reservation would match neither the clock-driven sweep nor any manual release, and §36.3's "a draft abandoned before submission releases reservation" rule has no implementable home here. That is the second, independent reason draft-time reservation is not implemented in Task 4. Draft creation instead performs the same eligibility check and returns `403 listing_entitlement_required` when nothing is available (spec §22.4's literal requirement), and consumption happens once, atomically, at submit (spec §6.3: *"Consumption happens when the listing is submitted for initial approval, not when the create form first opens"*). The `RESERVED` state, its transitions and `release_stale_reservations()` (the §6.3 30-minute rule) are all implemented and tested; what this phase does not ship is a *producer* of reserved rows. Phase 14 (a Stripe fulfilment reserved against a pending order) and Phase 15 (the listing-bound media upgrade) are the natural first producers. Recorded in Known Limitations.
Consequence, stated so no reviewer mistakes it for a bug: a free-eligible seller may hold several DRAFT listings at once. Only one can ever be submitted on that right, because the authoritative check is the locked one at submit (spec §22.2: *"The last check is authoritative and prevents multiple-tab races"*).

**Note (ruling — consumption is serialised by a lock on the `User` row).**
Spec §22.4 requires "locks entitlement/quota rows" and "Concurrent requests cannot consume one entitlement twice". Locking a *paid* right is straightforward (`SELECT … FOR UPDATE` on the row). The **free** right has no row to lock until the moment it is consumed, so two concurrent submits could both observe "free available" and both insert. The serialisation point is therefore `SELECT … FOR UPDATE` on the consuming user's own `accounts_user` row, taken before the quota is recomputed. It is per-user, short-lived, and held inside the transaction `submit_listing_revision` already opened.
**Lock ordering is `BoatListing` → `User`, always.** `submit_listing_revision` locks the listing first (Phase 11) and this phase's consumption locks the user second. No other code path in the repository locks **both** a `BoatListing` and a `User` row together, so no inversion exists today. To be precise about what *does* exist: `accounts.services.consume_email_verification_token()` (`backend/accounts/services.py`) already takes a `User` row lock — `User.objects.select_for_update().get(pk=token.user_id)` — but it reaches it through an entirely different entry path (`EmailVerificationToken` row lock → `User`) and never touches a `BoatListing`, so the two orderings can never cross. Do **not** read this rule as "nothing else locks `User`"; read it as "nothing else holds a `BoatListing` lock while taking one". Any future path that needs both must take them in `BoatListing` → `User` order or risk a deadlock.

**Note (ruling — publication duration is frozen onto the entitlement at consumption).**
Spec §36.3: *"Configuration changes are prospective. Existing consumed entitlements preserve their recorded publication duration."* `ListingEntitlementGate.publication_days()` is called by `listings.decisions.approve_revision` at **approval** time, which can be days after submission — and staff may have changed `individual.free_publish_days` in between. So consumption writes `metadata["publication_days"]` onto the `UserEntitlement`, and `publication_days()` reads it back from `listing.consumed_entitlement` rather than re-reading the setting. `metadata` is spec §11.9's own field; no column is invented. The setting is consulted only as a fallback for a listing with no consumed entitlement (a broker listing returns `None` as before; a legacy pre-flag listing falls back to the current `individual.free_publish_days`). **`listings/decisions.py` is not modified** — the call signature is unchanged.

**Note (ruling — one column beyond spec §11.9's field list: `granted_by`).**
Spec §36.3 requires that a *"Staff-granted right must include who, why and expiry."* §11.9's field list supplies "expiry" (`valid_until`) and a `metadata` JSON that can hold "why", but nothing for "who". This plan adds `granted_by` (nullable FK to `AUTH_USER_MODEL`, `on_delete=SET_NULL`) and keeps the reason in `metadata["reason"]`. This mirrors Phase 11's precedent of adding `origin` and `version` to `ListingRevision` beyond spec §11.4's list, and is recorded here rather than presented as spec-literal. `source_payment` is shipped as a **nullable `UUIDField` named `source_payment_id`**, not a FK, because `PaymentOrder` is Phase 14 — exactly the loose-reference pattern Phase 11 used for `consumed_entitlement_id`, and Phase 14 converts it the same way this phase converts Phase 11's.

**Note (ruling — "restore a right after documented staff error" means revoke-and-replace).**
Spec §26.3 lists "Restore a right after documented staff error"; spec §6.3's only outbound edge from `CONSUMED` is `CONSUMED -> REVOKED`; spec §22.1 says a consumed free right "remains consumed unless staff explicitly restores it with an audited remedy". For a **free** right, revoking the consumed row is sufficient and complete: free eligibility is computed from consumption history, so a `REVOKED` row is no longer counted and the window re-opens. For a **paid** right, revoking alone would leave the user with nothing usable, so `restore_consumed_right()` additionally creates a replacement `AVAILABLE` / `STAFF_GRANT` row with fresh validity. It returns both rows in a `RestoreResult`. Revoking a consumed right never touches the listing it published — spec §36.4 keeps moderation and entitlement remedies separate.

**Note (ruling — expiry reminder thresholds are a module constant, not a platform setting).**
Spec §22.5 says "Default reminders: 7 days and 1 day before expiration" but spec §10.1's registry table — which this project treats as the closed, authoritative list of typed settings — contains no reminder key. Adding one would invent configuration the spec does not define and would put an unvalidated key in a registry whose whole purpose is schema validation. The thresholds are `listings.expiry.EXPIRY_REMINDER_DAYS = (7, 1)`, a named constant with its own test. Spec §22's definition of done requires that *free limits* be adjustable without a deployment; those are the five `individual.*` settings, and they are.

**Note (ruling — reactivation after expiry is not implementable in this phase).**
Spec §22.5's closing sentence — "Reactivation requires a new available paid listing right unless the expiry resulted from a staff error" — states a **precondition on a transition spec §6.1 does not define.** `LISTING_TRANSITIONS[EXPIRED]` is `{ARCHIVED}` and nothing else; there is no `EXPIRED -> PUBLISHED` or `EXPIRED -> DRAFT` edge anywhere in the spec, and Phase 11 owns that map. Building a reactivation path would mean adding an edge to another phase's state machine on this plan's own authority. What this phase ships is the precondition itself as reusable, tested services (`entitlements.policy.available_paid_rights`, `entitlements.consumption.consume_listing_right`) plus the staff-error escape hatch (§26.3's restore, implemented in Task 13). The transition is recorded in Known Limitations for the phase that specifies it. `listings.drafts.update_listing_draft` already refuses to open an edit cycle on an `EXPIRED` listing, so nothing silently half-works.

**Note (ruling — staff entitlement operations are Django admin, gated to staff admin).**
Spec §26.3 lists four staff capabilities and spec §26 is **Phase 17**'s section; only the *ledger* is this phase's. But §22.1 depends on staff restore existing ("unless staff explicitly restores it with an audited remedy"), so a right this phase makes consumable must be remediable in this phase too. Following the Phase 5 and Phase 11 precedent, staff CRUD is Django admin routed through audited service functions, not a REST endpoint — `/api/v1/staff/...` entitlement routes belong to Phase 17's staff UI. Per Phase 3 contract rule 6, grant/revoke/restore are **staff-admin** operations (configuration and compensation), while the ledger list/detail view is visible to any Django-admin staff user. Every one of the four requires a non-empty reason, enforced in the service (`entitlement_reason_required`), not only in the admin form.

---

## File Structure

```
nautelo/
├── ACTIVITY.md                                                (modify: Task 14)
├── docs/superpowers/plans/2026-09-18-phase-13-quota-entitlement.md   (this file)
└── backend/
    ├── conftest.py                 (modify: Task 10 — append the
    │                                published_listing_with_snapshot fixture, which is
    │                                used from BOTH listings/tests/ and entitlements/tests/)
    ├── config/
    │   ├── settings/base.py         (modify: Task 1 INSTALLED_APPS; Task 5 throttle rate;
    │   │                             Task 10 CELERY_BEAT_SCHEDULE + task routes;
    │   │                             Tasks 11, 12 beat entries)
    │   └── urls.py                  (modify: Task 5 — include entitlements.urls)
    ├── common/
    │   └── exceptions.py            (modify: Task 6 — `action` passthrough)
    ├── entitlements/
    │   ├── __init__.py, apps.py     (new: Task 1)
    │   ├── enums.py                 (new: Task 1)
    │   ├── models.py                (new: Task 2)
    │   ├── admin.py                 (new: Task 2; extended Task 13)
    │   ├── policy.py                (new: Task 3)
    │   ├── eligibility.py           (new: Task 4)
    │   ├── views.py                 (new: Task 5)
    │   ├── urls.py                  (new: Task 5)
    │   ├── consumption.py           (new: Task 6)
    │   ├── services.py              (new: Task 12; extended Task 13)
    │   ├── tasks.py                 (new: Task 12)
    │   ├── templates/admin/entitlements/reason_action.html   (new: Task 13)
    │   ├── migrations/
    │   │   ├── __init__.py                              (Task 1)
    │   │   ├── 0001_userentitlement.py                  (generated: Task 2)
    │   │   └── 0002_seed_individual_entitlements_flag.py (hand-written: Task 2)
    │   └── tests/
    │       ├── __init__.py, conftest.py, factories.py   (Task 2)
    │       ├── test_enums.py                            (Task 1)
    │       ├── test_user_entitlement_model.py           (Task 2)
    │       ├── test_policy.py                           (Task 3)
    │       ├── test_eligibility.py                      (Task 4)
    │       ├── test_eligibility_api.py                  (Task 5)
    │       ├── test_consumption.py                      (Task 6)
    │       ├── test_ledger_maintenance.py               (Task 12)
    │       ├── test_staff_operations.py                 (Task 13)
    │       └── test_phase_acceptance.py                 (Task 14)
    └── listings/
        ├── models.py                (modify: Task 7 — one field)
        ├── admin.py                 (modify: Task 7 — one readonly_fields entry)
        ├── policies.py              (modify: Task 8 — ListingEntitlementGate body)
        ├── submissions.py           (modify: Task 8 — the existing entitlement block)
        ├── drafts.py                (modify: Task 9 — the draft-creation gate)
        ├── signals.py               (modify: Task 10 — two appended signals)
        ├── expiry.py                (new: Task 10; extended Task 11)
        ├── tasks.py                 (new: Task 10; extended Task 11)
        ├── migrations/0005_boatlisting_consumed_entitlement.py  (generated: Task 7)
        └── tests/
            ├── conftest.py                              (modify: Task 8 — flag list + broker_seller fixture)
            ├── test_policies.py                         (modify: Task 8 — stub assertions)
            ├── test_boat_listing_model.py               (modify: Task 7 — two appended tests)
            ├── test_entitlement_enforcement.py          (new: Tasks 8, 9)
            └── test_expiry.py                           (new: Tasks 10, 11)
```

Auto-generated migration filenames are whatever `makemigrations` produces; each task says to run it and commit the result. The two hand-written migrations' filenames are exact.

---

### Task 1: Scaffold the `entitlements` app and its state vocabulary

**Files:**
- Create: `backend/entitlements/__init__.py`, `backend/entitlements/apps.py`, `backend/entitlements/enums.py`, `backend/entitlements/migrations/__init__.py`, `backend/entitlements/tests/__init__.py`
- Modify: `backend/config/settings/base.py`
- Test: `backend/entitlements/tests/test_enums.py`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `entitlements.enums.EntitlementType` — `TextChoices`: `FREE_LISTING`, `PAID_LISTING`, `MEDIA_UPGRADE`
  - `entitlements.enums.EntitlementSource` — `TextChoices`: `FREE_POLICY`, `STRIPE_PURCHASE`, `STAFF_GRANT`
  - `entitlements.enums.EntitlementState` — `TextChoices`: `AVAILABLE`, `RESERVED`, `CONSUMED`, `EXPIRED`, `REVOKED`
  - `entitlements.enums.LISTING_RIGHT_TYPES: frozenset[str]`
  - `entitlements.enums.ENTITLEMENT_TRANSITIONS: dict[str, frozenset[str]]`
  - `entitlements.enums.can_transition_entitlement(current: str, target: str) -> bool`
  - `entitlements.enums.BlockingReason` — plain class with `FREE_ALLOWANCE_USED`, `NOT_AN_INDIVIDUAL_SELLER`, `ALL: frozenset[str]`
  - `entitlements.enums.PURCHASE_PRODUCT_CODE: str = "INDIVIDUAL_LISTING_RIGHT"`
  - `entitlements.enums.INDIVIDUAL_ENTITLEMENTS_FLAG: str = "individual_entitlements"`
  - `entitlements.enums.RESERVATION_TIMEOUT_MINUTES: int = 30`

- [ ] **Step 1: Create the app package by hand (not `startapp`)**

`django-admin startapp` writes five boilerplate modules this app does not want in this shape (`models.py`, `views.py`, `admin.py`, `tests.py`, `apps.py` with the wrong config name), and Phase 5 had to delete them. Create the four files directly:

```bash
mkdir -p backend/entitlements/migrations backend/entitlements/tests
touch backend/entitlements/__init__.py
touch backend/entitlements/migrations/__init__.py
touch backend/entitlements/tests/__init__.py
```

`backend/entitlements/apps.py`:

```python
from django.apps import AppConfig


class EntitlementsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "entitlements"
```

- [ ] **Step 2: Write the failing test**

`backend/entitlements/tests/test_enums.py`:

```python
"""Spec §11.9 and §6.3 vocabulary. These values are persisted and returned in
API responses, so the assertions below pin the literal strings, not just the
member names."""

import pytest

from entitlements.enums import (
    ENTITLEMENT_TRANSITIONS,
    LISTING_RIGHT_TYPES,
    PURCHASE_PRODUCT_CODE,
    RESERVATION_TIMEOUT_MINUTES,
    BlockingReason,
    EntitlementSource,
    EntitlementState,
    EntitlementType,
    can_transition_entitlement,
)


def test_entitlement_type_values_match_spec_11_9():
    assert [choice.value for choice in EntitlementType] == [
        "FREE_LISTING",
        "PAID_LISTING",
        "MEDIA_UPGRADE",
    ]


def test_entitlement_source_values_match_spec_11_9():
    assert [choice.value for choice in EntitlementSource] == [
        "FREE_POLICY",
        "STRIPE_PURCHASE",
        "STAFF_GRANT",
    ]


def test_entitlement_state_values_match_spec_11_9():
    assert [choice.value for choice in EntitlementState] == [
        "AVAILABLE",
        "RESERVED",
        "CONSUMED",
        "EXPIRED",
        "REVOKED",
    ]


def test_listing_right_types_excludes_media_upgrade():
    assert LISTING_RIGHT_TYPES == frozenset(
        {EntitlementType.FREE_LISTING, EntitlementType.PAID_LISTING}
    )


@pytest.mark.parametrize(
    ("current", "target"),
    [
        (EntitlementState.AVAILABLE, EntitlementState.RESERVED),
        (EntitlementState.AVAILABLE, EntitlementState.CONSUMED),
        (EntitlementState.AVAILABLE, EntitlementState.EXPIRED),
        (EntitlementState.RESERVED, EntitlementState.CONSUMED),
        (EntitlementState.RESERVED, EntitlementState.AVAILABLE),
        (EntitlementState.CONSUMED, EntitlementState.REVOKED),
    ],
)
def test_spec_6_3_edges_are_allowed(current, target):
    assert can_transition_entitlement(current, target) is True


@pytest.mark.parametrize(
    ("current", "target"),
    [
        (EntitlementState.CONSUMED, EntitlementState.AVAILABLE),
        (EntitlementState.CONSUMED, EntitlementState.EXPIRED),
        (EntitlementState.EXPIRED, EntitlementState.AVAILABLE),
        (EntitlementState.REVOKED, EntitlementState.AVAILABLE),
        (EntitlementState.REVOKED, EntitlementState.CONSUMED),
    ],
)
def test_edges_outside_spec_6_3_are_refused(current, target):
    assert can_transition_entitlement(current, target) is False


def test_terminal_states_have_no_outbound_edges():
    assert ENTITLEMENT_TRANSITIONS[EntitlementState.EXPIRED] == frozenset()
    assert ENTITLEMENT_TRANSITIONS[EntitlementState.REVOKED] == frozenset()


def test_every_state_has_a_transition_entry():
    assert set(ENTITLEMENT_TRANSITIONS) == {state.value for state in EntitlementState}


def test_blocking_reasons_are_the_closed_set():
    assert BlockingReason.ALL == frozenset(
        {"FREE_ALLOWANCE_USED", "NOT_AN_INDIVIDUAL_SELLER"}
    )
    assert BlockingReason.FREE_ALLOWANCE_USED == "FREE_ALLOWANCE_USED"


def test_purchase_product_code_and_reservation_timeout_match_the_spec():
    assert PURCHASE_PRODUCT_CODE == "INDIVIDUAL_LISTING_RIGHT"
    assert RESERVATION_TIMEOUT_MINUTES == 30
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd backend && uv run pytest entitlements/tests/test_enums.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'entitlements'`.

- [ ] **Step 4: Write `backend/entitlements/enums.py`**

```python
"""Entitlement vocabulary (NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md §11.9, §6.3, §22.2).

Values are copied verbatim from the spec and must never be renamed: they are
persisted in the database, returned in API responses and written into audit
events.
"""

from django.db import models


class EntitlementType(models.TextChoices):
    FREE_LISTING = "FREE_LISTING", "Free listing"
    PAID_LISTING = "PAID_LISTING", "Paid listing"
    MEDIA_UPGRADE = "MEDIA_UPGRADE", "Media upgrade"


class EntitlementSource(models.TextChoices):
    FREE_POLICY = "FREE_POLICY", "Free policy"
    STRIPE_PURCHASE = "STRIPE_PURCHASE", "Stripe purchase"
    STAFF_GRANT = "STAFF_GRANT", "Staff grant"


class EntitlementState(models.TextChoices):
    AVAILABLE = "AVAILABLE", "Available"
    RESERVED = "RESERVED", "Reserved"
    CONSUMED = "CONSUMED", "Consumed"
    EXPIRED = "EXPIRED", "Expired"
    REVOKED = "REVOKED", "Revoked"


# The two types that let a listing be published. MEDIA_UPGRADE is spec §24.4's
# listing-bound media tier (Phase 15) and never satisfies a publication right.
LISTING_RIGHT_TYPES: frozenset[str] = frozenset(
    {EntitlementType.FREE_LISTING, EntitlementType.PAID_LISTING}
)

# Spec §6.3, verbatim:
#   AVAILABLE -> RESERVED -> CONSUMED
#   AVAILABLE -> EXPIRED
#   RESERVED  -> AVAILABLE (creation cancelled or timed out)
#   CONSUMED  -> REVOKED (refund/chargeback or staff remedy)
#
# AVAILABLE -> CONSUMED is included as a direct edge because spec §6.3's first
# line is a chain, not an obligation to pass through RESERVED, and because this
# phase deliberately does not reserve at draft creation (see the plan's scope
# ruling): a free or paid right goes straight from AVAILABLE to CONSUMED inside
# the single locked transaction spec §22.4 requires. Reading it any other way
# would make the spec's own "consumes once at submit" rule unreachable.
ENTITLEMENT_TRANSITIONS: dict[str, frozenset[str]] = {
    EntitlementState.AVAILABLE: frozenset(
        {
            EntitlementState.RESERVED,
            EntitlementState.CONSUMED,
            EntitlementState.EXPIRED,
        }
    ),
    EntitlementState.RESERVED: frozenset(
        {EntitlementState.CONSUMED, EntitlementState.AVAILABLE}
    ),
    EntitlementState.CONSUMED: frozenset({EntitlementState.REVOKED}),
    EntitlementState.EXPIRED: frozenset(),
    EntitlementState.REVOKED: frozenset(),
}


def can_transition_entitlement(current: str, target: str) -> bool:
    return target in ENTITLEMENT_TRANSITIONS.get(current, frozenset())


class BlockingReason:
    """Why `can_start_listing` is False (spec §22.2's `blocking_reason`).

    FREE_ALLOWANCE_USED is the spec's own literal. NOT_AN_INDIVIDUAL_SELLER is
    added by this phase for the account that cannot create a private-seller
    listing at all — the same rule accounts.services.resolve_seller_context()
    enforces — because spec §22.2's payload has no other way to say it and a
    bare `false` with a null reason would leave the UI nothing to render.
    """

    FREE_ALLOWANCE_USED = "FREE_ALLOWANCE_USED"
    NOT_AN_INDIVIDUAL_SELLER = "NOT_AN_INDIVIDUAL_SELLER"
    ALL: frozenset[str] = frozenset({FREE_ALLOWANCE_USED, NOT_AN_INDIVIDUAL_SELLER})


# Spec §22.2's `purchase_product_code` and §23.1's first product code.
PURCHASE_PRODUCT_CODE = "INDIVIDUAL_LISTING_RIGHT"

# Spec §35.1's rollout flag for this phase.
INDIVIDUAL_ENTITLEMENTS_FLAG = "individual_entitlements"

# Spec §6.3: "Reservations expire after 30 minutes unless attached to a saved
# draft."
RESERVATION_TIMEOUT_MINUTES = 30
```

- [ ] **Step 5: Register the app in `INSTALLED_APPS`**

In `backend/config/settings/base.py`, append `"entitlements",` to the `INSTALLED_APPS` list, immediately after `"listings",`. This is an **append only** — read the real file and add one line. Do not reorder or reformat the existing entries (the tracker's "Known cross-phase risk" section names this exact file).

```python
    "taxonomy",
    "listings",
    "entitlements",
    "platform_settings",
]
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd backend && uv run pytest entitlements/tests/test_enums.py -v`
Expected: PASS — **19 collected test items** (8 plain tests, plus `test_spec_6_3_edges_are_allowed` × 6 and `test_edges_outside_spec_6_3_are_refused` × 5 parametrisations).

Then confirm Django still boots with the new app:

Run: `cd backend && uv run python manage.py check`
Expected: `System check identified no issues`.

- [ ] **Step 7: Commit**

```bash
git add backend/entitlements backend/config/settings/base.py
git commit -m "feat(entitlements): scaffold app and spec 11.9/6.3 state vocabulary"
```

---

### Task 2: `UserEntitlement` model, database constraints, read-only admin ledger and the rollout flag

**Files:**
- Create: `backend/entitlements/models.py`, `backend/entitlements/admin.py`, `backend/entitlements/migrations/0002_seed_individual_entitlements_flag.py`, `backend/entitlements/tests/conftest.py`, `backend/entitlements/tests/factories.py`
- Generated: `backend/entitlements/migrations/0001_userentitlement.py`
- Test: `backend/entitlements/tests/test_user_entitlement_model.py`

**Interfaces:**
- Consumes: `entitlements.enums.{EntitlementType, EntitlementSource, EntitlementState, INDIVIDUAL_ENTITLEMENTS_FLAG}` (Task 1); `common.models.UUIDTimeStampedModel`.
- Produces:
  - `entitlements.models.UserEntitlement` — fields `user`, `entitlement_type`, `source`, `source_payment_id`, `listing`, `state`, `valid_from`, `valid_until`, `reserved_at`, `consumed_at`, `revoked_at`, `granted_by`, `metadata`, plus `created_at`/`updated_at`/`id` from the base class.
  - `entitlements.models.UserEntitlementQuerySet` with `.listing_rights()`, `.free()`, `.paid()`, `.available(now=None)`, `.consumed()`, `.for_user(user)`.
  - `entitlements.tests.factories.make_entitlement(...) -> UserEntitlement`
  - `entitlements.tests.factories.make_private_seller(email=...) -> User`
- Migration dependency note: `0001_userentitlement` depends on `("listings", "0004_seed_listing_revisions_flag")` because of the `listing` FK.

- [ ] **Step 1: Write the failing test**

`backend/entitlements/tests/test_user_entitlement_model.py`:

```python
"""Spec §11.9's UserEntitlement, and the database-level guarantees this phase
relies on rather than re-checking in every service."""

from datetime import timedelta

import pytest
from django.db import IntegrityError, transaction
from django.utils import timezone

from entitlements.enums import EntitlementSource, EntitlementState, EntitlementType
from entitlements.models import UserEntitlement
from entitlements.tests.factories import make_entitlement, make_private_seller
from listings.tests.factories import make_private_listing
from platform_settings.models import FeatureFlag


@pytest.mark.django_db
def test_every_spec_11_9_field_exists_with_the_spec_name():
    names = {field.name for field in UserEntitlement._meta.get_fields()}
    assert {
        "id",
        "user",
        "entitlement_type",
        "source",
        "source_payment_id",
        "listing",
        "state",
        "valid_from",
        "valid_until",
        "reserved_at",
        "consumed_at",
        "revoked_at",
        "metadata",
        "created_at",
        "updated_at",
        # Beyond spec §11.9's list, justified by §36.3's "who, why and expiry".
        "granted_by",
    } <= names


@pytest.mark.django_db
def test_a_consumed_row_without_consumed_at_is_refused_by_the_database():
    user = make_private_seller()
    with pytest.raises(IntegrityError), transaction.atomic():
        make_entitlement(user=user, state=EntitlementState.CONSUMED, consumed_at=None)


@pytest.mark.django_db
def test_a_revoked_row_without_revoked_at_is_refused_by_the_database():
    user = make_private_seller()
    with pytest.raises(IntegrityError), transaction.atomic():
        make_entitlement(user=user, state=EntitlementState.REVOKED, revoked_at=None)


@pytest.mark.django_db
def test_validity_window_must_not_be_inverted():
    user = make_private_seller()
    now = timezone.now()
    with pytest.raises(IntegrityError), transaction.atomic():
        make_entitlement(
            user=user, valid_from=now, valid_until=now - timedelta(days=1)
        )


@pytest.mark.django_db
def test_one_live_right_of_a_type_per_listing():
    """A listing cannot be published by two listing rights at once (spec §36.3:
    "One paid listing right covers one listing publication cycle")."""
    user = make_private_seller()
    listing = make_private_listing(owner=user)
    make_entitlement(
        user=user,
        listing=listing,
        entitlement_type=EntitlementType.FREE_LISTING,
        state=EntitlementState.CONSUMED,
        consumed_at=timezone.now(),
    )
    with pytest.raises(IntegrityError), transaction.atomic():
        make_entitlement(
            user=user,
            listing=listing,
            entitlement_type=EntitlementType.FREE_LISTING,
            state=EntitlementState.CONSUMED,
            consumed_at=timezone.now(),
        )


@pytest.mark.django_db
def test_a_revoked_row_does_not_block_a_replacement_for_the_same_listing():
    """Spec §26.3's staff restore must be able to re-issue against the same
    listing, so the uniqueness rule excludes REVOKED rows."""
    user = make_private_seller()
    listing = make_private_listing(owner=user)
    make_entitlement(
        user=user,
        listing=listing,
        entitlement_type=EntitlementType.FREE_LISTING,
        state=EntitlementState.REVOKED,
        consumed_at=timezone.now(),
        revoked_at=timezone.now(),
    )
    replacement = make_entitlement(
        user=user,
        listing=listing,
        entitlement_type=EntitlementType.FREE_LISTING,
        state=EntitlementState.CONSUMED,
        consumed_at=timezone.now(),
    )
    assert replacement.pk is not None


@pytest.mark.django_db
def test_queryset_helpers_partition_the_ledger():
    user = make_private_seller()
    now = timezone.now()
    live_paid = make_entitlement(
        user=user,
        entitlement_type=EntitlementType.PAID_LISTING,
        source=EntitlementSource.STRIPE_PURCHASE,
        state=EntitlementState.AVAILABLE,
        valid_until=now + timedelta(days=10),
    )
    make_entitlement(
        user=user,
        entitlement_type=EntitlementType.PAID_LISTING,
        state=EntitlementState.AVAILABLE,
        valid_from=now - timedelta(days=20),
        valid_until=now - timedelta(days=1),
    )
    consumed_free = make_entitlement(
        user=user,
        entitlement_type=EntitlementType.FREE_LISTING,
        state=EntitlementState.CONSUMED,
        consumed_at=now,
    )
    make_entitlement(
        user=user,
        entitlement_type=EntitlementType.MEDIA_UPGRADE,
        state=EntitlementState.AVAILABLE,
        valid_until=now + timedelta(days=10),
    )

    rights = UserEntitlement.objects.for_user(user).listing_rights()
    assert list(rights.available(now=now)) == [live_paid]
    assert list(rights.free().consumed()) == [consumed_free]
    assert rights.paid().count() == 2


@pytest.mark.django_db
def test_the_rollout_flag_is_seeded_disabled():
    flag = FeatureFlag.objects.get(key="individual_entitlements")
    assert flag.is_enabled is False
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && uv run pytest entitlements/tests/test_user_entitlement_model.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'entitlements.models'`.

- [ ] **Step 3: Write `backend/entitlements/models.py`**

```python
"""The entitlement ledger (NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md §11.9).

Spec §11.9: "Free use is also recorded as an entitlement/ledger entry. Do not
infer historical quota solely from current listings, because listings may be
deleted, archived or moderated." Every rule in this app therefore reads this
table and never counts BoatListing rows.

This module deliberately imports nothing from `listings`: the `listing` FK is
declared as a lazy string reference so the dependency arrow stays
listings -> entitlements and never the other way round.
"""

from django.conf import settings
from django.core.serializers.json import DjangoJSONEncoder
from django.db import models
from django.db.models import Q
from django.utils import timezone

from common.models import UUIDTimeStampedModel

from .enums import (
    LISTING_RIGHT_TYPES,
    EntitlementSource,
    EntitlementState,
    EntitlementType,
)


class UserEntitlementQuerySet(models.QuerySet):
    def for_user(self, user):
        return self.filter(user=user)

    def listing_rights(self):
        """FREE_LISTING and PAID_LISTING only — never MEDIA_UPGRADE."""
        return self.filter(entitlement_type__in=sorted(LISTING_RIGHT_TYPES))

    def free(self):
        return self.filter(entitlement_type=EntitlementType.FREE_LISTING)

    def paid(self):
        return self.filter(entitlement_type=EntitlementType.PAID_LISTING)

    def consumed(self):
        return self.filter(state=EntitlementState.CONSUMED)

    def available(self, now=None):
        """AVAILABLE *and* inside its validity window.

        A row whose `valid_until` has passed is only moved to EXPIRED by the
        daily sweep (entitlements.services.expire_due_entitlements), so a
        caller that trusted `state` alone would hand out an expired right in
        the window between the two.
        """
        now = now or timezone.now()
        return self.filter(
            state=EntitlementState.AVAILABLE,
            valid_from__lte=now,
            valid_until__gt=now,
        )


class UserEntitlement(UUIDTimeStampedModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="entitlements",
    )
    entitlement_type = models.CharField(
        max_length=16, choices=EntitlementType.choices
    )
    source = models.CharField(max_length=16, choices=EntitlementSource.choices)
    # Loose reference to Phase 14's payments.PaymentOrder (spec §11.9), which
    # does not exist yet. Phase 14 converts it to a real ForeignKey, exactly as
    # this phase converts Phase 11's BoatListing.consumed_entitlement_id.
    source_payment_id = models.UUIDField(null=True, blank=True)
    listing = models.ForeignKey(
        "listings.BoatListing",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="entitlements",
    )
    state = models.CharField(
        max_length=16,
        choices=EntitlementState.choices,
        default=EntitlementState.AVAILABLE,
    )
    valid_from = models.DateTimeField()
    valid_until = models.DateTimeField()
    reserved_at = models.DateTimeField(null=True, blank=True)
    consumed_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    # Spec §36.3: "Staff-granted right must include who, why and expiry."
    # `who` is this column, `why` is metadata["reason"], `expiry` is valid_until.
    granted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    metadata = models.JSONField(default=dict, blank=True, encoder=DjangoJSONEncoder)

    objects = UserEntitlementQuerySet.as_manager()

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "entitlement_type", "state"]),
            models.Index(fields=["state", "valid_until"]),
            # The rolling-window query in entitlements.policy.
            models.Index(fields=["user", "entitlement_type", "-consumed_at"]),
            models.Index(fields=["state", "reserved_at"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=Q(valid_until__gt=models.F("valid_from")),
                name="entitlements_validity_window_is_forward",
            ),
            models.CheckConstraint(
                condition=~Q(state=EntitlementState.CONSUMED)
                | Q(consumed_at__isnull=False),
                name="entitlements_consumed_requires_consumed_at",
            ),
            models.CheckConstraint(
                condition=~Q(state=EntitlementState.RESERVED)
                | Q(reserved_at__isnull=False),
                name="entitlements_reserved_requires_reserved_at",
            ),
            models.CheckConstraint(
                condition=~Q(state=EntitlementState.REVOKED)
                | Q(revoked_at__isnull=False),
                name="entitlements_revoked_requires_revoked_at",
            ),
            # A listing is published by at most one live right of a given type.
            # REVOKED is excluded so spec §26.3's staff restore can re-issue
            # against the same listing without tripping the index.
            models.UniqueConstraint(
                fields=["listing", "entitlement_type"],
                condition=Q(listing__isnull=False) & ~Q(state=EntitlementState.REVOKED),
                name="entitlements_one_live_right_per_listing_and_type",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.user_id} {self.entitlement_type} {self.state}"
```

Note on `UserEntitlement.user`'s `on_delete=CASCADE` (every other user FK in this
project is `PROTECT` or `SET_NULL`): a ledger row is meaningless without its user,
and `BoatListing.owner_user` is already `PROTECT`, so a private seller who has ever
published cannot be deleted anyway — the cascade only ever reaches rows belonging
to an account with no listings. `listing` is `PROTECT` for the opposite reason: a
listing that consumed a right must not disappear out from under the ledger entry
that records it (spec §11.9: "listings may be deleted, archived or moderated").

- [ ] **Step 4: Write the test factories and cache fixture**

`backend/entitlements/tests/factories.py`:

```python
from datetime import timedelta

from django.utils import timezone

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from entitlements.enums import EntitlementSource, EntitlementState, EntitlementType
from entitlements.models import UserEntitlement

_UNSET = object()


def make_private_seller(email="private-seller@example.com", **extra):
    return make_user(email, role=UserRole.PRIVATE_SELLER, verified=True, **extra)


def make_entitlement(
    *,
    user,
    entitlement_type=EntitlementType.FREE_LISTING,
    source=EntitlementSource.FREE_POLICY,
    state=EntitlementState.AVAILABLE,
    listing=None,
    valid_from=None,
    valid_until=None,
    consumed_at=_UNSET,
    reserved_at=_UNSET,
    revoked_at=_UNSET,
    metadata=None,
    granted_by=None,
    source_payment_id=None,
):
    """Build one ledger row.

    `consumed_at`/`reserved_at`/`revoked_at` default to a value consistent with
    `state` so an ordinary caller does not have to think about the database
    constraints — but pass an explicit `None` to build the inconsistent row a
    constraint test needs.
    """
    now = timezone.now()
    valid_from = valid_from or now
    valid_until = valid_until or (valid_from + timedelta(days=365))
    if consumed_at is _UNSET:
        consumed_at = now if state == EntitlementState.CONSUMED else None
    if reserved_at is _UNSET:
        reserved_at = now if state == EntitlementState.RESERVED else None
    if revoked_at is _UNSET:
        revoked_at = now if state == EntitlementState.REVOKED else None
    return UserEntitlement.objects.create(
        user=user,
        entitlement_type=entitlement_type,
        source=source,
        state=state,
        listing=listing,
        valid_from=valid_from,
        valid_until=valid_until,
        consumed_at=consumed_at,
        reserved_at=reserved_at,
        revoked_at=revoked_at,
        metadata=metadata or {},
        granted_by=granted_by,
        source_payment_id=source_payment_id,
    )
```

`backend/entitlements/tests/conftest.py`:

```python
import pytest
from django.core.cache import cache

from platform_settings.services import SETTINGS_CACHE_KEY, feature_flag_cache_key

# This project's cache is a real, shared Redis instance, not an in-memory
# backend that resets between runs, so every test in this package starts from
# and leaves behind a clean cache (same pattern as listings/tests).
ENTITLEMENT_FEATURE_FLAG_KEYS = ["individual_entitlements", "listing_revisions"]


@pytest.fixture(autouse=True)
def _clear_entitlement_caches():
    def _clear():
        cache.delete(SETTINGS_CACHE_KEY)
        for key in ENTITLEMENT_FEATURE_FLAG_KEYS:
            cache.delete(feature_flag_cache_key(key))

    _clear()
    yield
    _clear()


@pytest.fixture
def entitlements_enforced(db):
    """Turn spec §35.1's `individual_entitlements` flag on for one test."""
    from platform_settings.services import set_feature_flag

    set_feature_flag(key="individual_entitlements", is_enabled=True, actor=None)
```

- [ ] **Step 5: Generate the schema migration**

Run: `cd backend && uv run python manage.py makemigrations entitlements --name userentitlement`
Expected: creates `backend/entitlements/migrations/0001_userentitlement.py`.

Open the generated file and confirm its `dependencies` list contains an entry for `listings` (Django adds it because of the `listing` FK). If Django pinned an older listings migration than `0004_seed_listing_revisions_flag`, leave it as generated — Django's own dependency is correct; do not hand-edit it.

- [ ] **Step 6: Write the feature-flag seed migration**

`backend/entitlements/migrations/0002_seed_individual_entitlements_flag.py`:

```python
from django.db import migrations

FLAG_KEY = "individual_entitlements"
# platform_settings.FeatureFlag.description is CharField(max_length=255) —
# keep this string under that limit.
FLAG_DESCRIPTION = (
    "Spec 35.1 rollout flag. On = 403 listing_entitlement_required when an "
    "individual seller has no listing right, at draft creation and at submit. "
    "Off = nothing is refused, but the ledger is still written."
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
        ("entitlements", "0001_userentitlement"),
        ("platform_settings", "0004_featureflag"),
    ]

    operations = [migrations.RunPython(create_flag, delete_flag)]
```

- [ ] **Step 7: Write the read-only admin ledger**

`backend/entitlements/admin.py`:

```python
from django.contrib import admin

from .models import UserEntitlement


@admin.register(UserEntitlement)
class UserEntitlementAdmin(admin.ModelAdmin):
    """Spec §26.3 item 1: "View entitlement ledger."

    Every field is read-only and there is no add form. The ledger is written
    only by entitlements.consumption and entitlements.services, which hold the
    transaction, the row locks and the audit event together; Django admin has
    none of that, so a hand-edited `state` would be an unaudited grant. Task 13
    adds the three *audited* staff operations as admin actions, which is how a
    staff admin changes a row.
    """

    list_display = (
        "id",
        "user",
        "entitlement_type",
        "source",
        "state",
        "listing",
        "valid_from",
        "valid_until",
        "consumed_at",
        "revoked_at",
    )
    list_filter = ("entitlement_type", "source", "state")
    search_fields = ("id", "user__email", "listing__id")
    raw_id_fields = ("user", "listing", "granted_by")
    date_hierarchy = "created_at"
    readonly_fields = tuple(
        field.name for field in UserEntitlement._meta.fields
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `cd backend && uv run pytest entitlements/tests/test_user_entitlement_model.py -v`
Expected: PASS (8 tests).

Then prove no migration drifted and the whole suite still runs:

Run: `cd backend && uv run python manage.py makemigrations --check --dry-run`
Expected: `No changes detected`.

Run: `cd backend && uv run pytest -q`
Expected: the full suite green (Phase 11's 200+ tests plus this task's).

- [ ] **Step 9: Commit**

```bash
git add backend/entitlements
git commit -m "feat(entitlements): UserEntitlement ledger, constraints, admin and rollout flag"
```

---

### Task 3: Free-quota arithmetic and the paid-rights selector

**Files:**
- Create: `backend/entitlements/policy.py`
- Test: `backend/entitlements/tests/test_policy.py`

**Interfaces:**
- Consumes: `entitlements.models.UserEntitlement` (Task 2); `entitlements.enums.{EntitlementState, EntitlementType, INDIVIDUAL_ENTITLEMENTS_FLAG}` (Task 1); `platform_settings.services.{get_setting_value, is_feature_enabled}`.
- Produces:
  - `entitlements.policy.FreeQuotaState` — frozen dataclass: `available: bool`, `used_at: datetime | None`, `next_available_at: datetime | None`, `publication_days: int`, `allowance: int`, `used_in_period: int`; method `as_dict() -> dict`
  - `entitlements.policy.free_quota_state(user, *, now=None) -> FreeQuotaState`
  - `entitlements.policy.available_paid_rights(user, *, now=None) -> QuerySet[UserEntitlement]` (ordered soonest-expiring first)
  - `entitlements.policy.free_publication_days() -> int`
  - `entitlements.policy.free_period_days() -> int`
  - `entitlements.policy.free_listing_count() -> int`
  - `entitlements.policy.paid_publication_days() -> int`
  - `entitlements.policy.paid_validity_days() -> int`
  - `entitlements.policy.enforcement_enabled() -> bool`

- [ ] **Step 1: Write the failing test**

`backend/entitlements/tests/test_policy.py`:

```python
"""Spec §22.1's rolling free-allowance window and §36.3's edge cases."""

from datetime import timedelta

import pytest
from django.utils import timezone

from entitlements.enums import EntitlementSource, EntitlementState, EntitlementType
from entitlements.policy import (
    available_paid_rights,
    enforcement_enabled,
    free_quota_state,
    paid_publication_days,
    paid_validity_days,
)
from entitlements.tests.factories import make_entitlement, make_private_seller
from platform_settings.services import update_setting


def _consumed_free(user, *, when, **extra):
    return make_entitlement(
        user=user,
        entitlement_type=EntitlementType.FREE_LISTING,
        source=EntitlementSource.FREE_POLICY,
        state=EntitlementState.CONSUMED,
        valid_from=when,
        valid_until=when + timedelta(days=365),
        consumed_at=when,
        **extra,
    )


@pytest.mark.django_db
def test_a_brand_new_user_has_the_free_right_available():
    state = free_quota_state(make_private_seller())
    assert state.available is True
    assert state.used_at is None
    assert state.next_available_at is None
    assert state.allowance == 1
    assert state.used_in_period == 0
    assert state.publication_days == 30


@pytest.mark.django_db
def test_one_consumption_inside_the_window_exhausts_the_allowance():
    user = make_private_seller()
    now = timezone.now()
    used = now - timedelta(days=100)
    _consumed_free(user, when=used)

    state = free_quota_state(user, now=now)

    assert state.available is False
    assert state.used_at == used
    assert state.next_available_at == used + timedelta(days=365)
    assert state.used_in_period == 1


@pytest.mark.django_db
def test_a_consumption_older_than_the_period_no_longer_blocks():
    """Spec §22.1: "When 365 days have elapsed since the last free consumption,
    the user becomes eligible for a new free entitlement"."""
    user = make_private_seller()
    now = timezone.now()
    _consumed_free(user, when=now - timedelta(days=366))

    state = free_quota_state(user, now=now)

    assert state.available is True
    assert state.next_available_at is None
    assert state.used_in_period == 0
    # The historical use is still reported, because spec §22.2's `used_at`
    # is the ledger fact, not the window calculation.
    assert state.used_at is not None


@pytest.mark.django_db
def test_a_revoked_consumption_frees_the_window_again():
    """Spec §22.1: the right "remains consumed unless staff explicitly restores
    it with an audited remedy" — a restore revokes the row (spec §6.3)."""
    user = make_private_seller()
    now = timezone.now()
    row = _consumed_free(user, when=now - timedelta(days=10))
    row.state = EntitlementState.REVOKED
    row.revoked_at = now
    row.save(update_fields=["state", "revoked_at", "updated_at"])

    state = free_quota_state(user, now=now)

    assert state.available is True
    assert state.used_in_period == 0


@pytest.mark.django_db
def test_a_raised_allowance_grants_another_use_inside_the_same_window():
    """Spec §36.3: "Increasing free count allows additional uses within current
    rolling window"."""
    user = make_private_seller()
    now = timezone.now()
    _consumed_free(user, when=now - timedelta(days=10))
    update_setting(key="individual.free_listing_count", value=2, actor=None)

    state = free_quota_state(user, now=now)

    assert state.allowance == 2
    assert state.available is True
    assert state.next_available_at is None


@pytest.mark.django_db
def test_with_an_allowance_of_two_the_window_reopens_on_the_older_use():
    user = make_private_seller()
    now = timezone.now()
    update_setting(key="individual.free_listing_count", value=2, actor=None)
    older = now - timedelta(days=300)
    newer = now - timedelta(days=10)
    _consumed_free(user, when=older)
    _consumed_free(user, when=newer)

    state = free_quota_state(user, now=now)

    assert state.available is False
    assert state.used_in_period == 2
    assert state.used_at == newer
    # Eligibility returns when the OLDEST of the two in-window uses ages out.
    assert state.next_available_at == older + timedelta(days=365)


@pytest.mark.django_db
def test_an_allowance_of_zero_is_never_available():
    user = make_private_seller()
    update_setting(key="individual.free_listing_count", value=0, actor=None)

    state = free_quota_state(user)

    assert state.allowance == 0
    assert state.available is False
    assert state.next_available_at is None


@pytest.mark.django_db
def test_a_shortened_period_reopens_eligibility_prospectively():
    """Spec §36.3: configuration changes are prospective — a shorter period
    means an older consumption drops out of the window sooner."""
    user = make_private_seller()
    now = timezone.now()
    _consumed_free(user, when=now - timedelta(days=100))
    update_setting(key="individual.free_period_days", value=30, actor=None)

    assert free_quota_state(user, now=now).available is True


@pytest.mark.django_db
def test_publication_days_follows_the_setting():
    user = make_private_seller()
    update_setting(key="individual.free_publish_days", value=45, actor=None)
    assert free_quota_state(user).publication_days == 45


@pytest.mark.django_db
def test_available_paid_rights_orders_soonest_expiring_first_and_skips_the_rest():
    user = make_private_seller()
    now = timezone.now()
    later = make_entitlement(
        user=user,
        entitlement_type=EntitlementType.PAID_LISTING,
        source=EntitlementSource.STRIPE_PURCHASE,
        state=EntitlementState.AVAILABLE,
        valid_until=now + timedelta(days=200),
    )
    sooner = make_entitlement(
        user=user,
        entitlement_type=EntitlementType.PAID_LISTING,
        source=EntitlementSource.STRIPE_PURCHASE,
        state=EntitlementState.AVAILABLE,
        valid_until=now + timedelta(days=5),
    )
    # Not available: expired window, consumed, reserved, wrong type.
    make_entitlement(
        user=user,
        entitlement_type=EntitlementType.PAID_LISTING,
        state=EntitlementState.AVAILABLE,
        valid_from=now - timedelta(days=400),
        valid_until=now - timedelta(days=1),
    )
    make_entitlement(
        user=user,
        entitlement_type=EntitlementType.PAID_LISTING,
        state=EntitlementState.CONSUMED,
        consumed_at=now,
    )
    make_entitlement(
        user=user,
        entitlement_type=EntitlementType.MEDIA_UPGRADE,
        state=EntitlementState.AVAILABLE,
        valid_until=now + timedelta(days=5),
    )

    assert list(available_paid_rights(user, now=now)) == [sooner, later]


@pytest.mark.django_db
def test_another_users_rights_are_never_counted():
    mine = make_private_seller("mine@example.com")
    theirs = make_private_seller("theirs@example.com")
    _consumed_free(theirs, when=timezone.now())
    make_entitlement(
        user=theirs,
        entitlement_type=EntitlementType.PAID_LISTING,
        state=EntitlementState.AVAILABLE,
    )

    assert free_quota_state(mine).available is True
    assert available_paid_rights(mine).count() == 0


@pytest.mark.django_db
def test_paid_defaults_come_from_platform_settings():
    assert paid_publication_days() == 30
    assert paid_validity_days() == 365


@pytest.mark.django_db
def test_enforcement_is_on_once_the_flag_is_enabled(entitlements_enforced):
    assert enforcement_enabled() is True


@pytest.mark.django_db
def test_enforcement_defaults_to_off():
    assert enforcement_enabled() is False
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && uv run pytest entitlements/tests/test_policy.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'entitlements.policy'`.

- [ ] **Step 3: Write `backend/entitlements/policy.py`**

```python
"""Free/paid quota arithmetic (spec §22.1, §36.3, §10.1).

Nothing here writes. Every number comes from platform_settings, so spec §22's
definition of done — "Free limits are adjustable without code deployment" — is
a property of this module, and spec §36.3's "Configuration changes are
prospective" follows from the fact that the window is recomputed on read.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta

from django.db.models import QuerySet
from django.utils import timezone

from platform_settings.services import get_setting_value, is_feature_enabled

from .enums import INDIVIDUAL_ENTITLEMENTS_FLAG, EntitlementState, EntitlementType
from .models import UserEntitlement


def free_listing_count() -> int:
    return int(get_setting_value("individual.free_listing_count"))


def free_period_days() -> int:
    return int(get_setting_value("individual.free_period_days"))


def free_publication_days() -> int:
    return int(get_setting_value("individual.free_publish_days"))


def paid_publication_days() -> int:
    return int(get_setting_value("individual.paid_publish_days"))


def paid_validity_days() -> int:
    return int(get_setting_value("individual.paid_entitlement_valid_days"))


def enforcement_enabled() -> bool:
    """Spec §35.1's rollout flag, defaulting to OFF.

    This gates *refusal only*. The ledger is written either way — see the
    plan's ruling: suppressing bookkeeping while the flag is off would hand
    every pre-rollout user a second free listing on the day it is enabled.
    """
    return is_feature_enabled(INDIVIDUAL_ENTITLEMENTS_FLAG, default=False)


@dataclass(frozen=True)
class FreeQuotaState:
    """Spec §22.2's `free` block, plus the two numbers it is derived from."""

    available: bool
    used_at: datetime | None
    next_available_at: datetime | None
    publication_days: int
    allowance: int
    used_in_period: int

    def as_dict(self) -> dict:
        # Exactly spec §22.2's four keys. `allowance`/`used_in_period` are
        # internal arithmetic and are deliberately not part of the wire format.
        return {
            "available": self.available,
            "used_at": self.used_at,
            "next_available_at": self.next_available_at,
            "publication_days": self.publication_days,
        }


def free_quota_state(user, *, now: datetime | None = None) -> FreeQuotaState:
    """Spec §22.1's rolling window, computed from the ledger alone.

    "The rolling period starts when the free entitlement is consumed on
    submission." So the window is keyed on `consumed_at`, not on `created_at`
    and not on any listing's `published_at` — a deleted, archived or moderated
    listing must not change the answer (spec §11.9).

    A REVOKED row is not counted: spec §22.1 says the right "remains consumed
    unless staff explicitly restores it with an audited remedy", and spec §6.3
    makes CONSUMED -> REVOKED the transition that remedy performs.
    """
    now = now or timezone.now()
    allowance = free_listing_count()
    period = timedelta(days=free_period_days())
    cutoff = now - period

    # Newest first: [0] is spec §22.2's `used_at`, and [allowance - 1] is the
    # oldest use still inside the window, which is the one that has to age out
    # before a new right appears.
    consumed_at_values = list(
        UserEntitlement.objects.for_user(user)
        .free()
        .consumed()
        .filter(consumed_at__isnull=False)
        .order_by("-consumed_at")
        .values_list("consumed_at", flat=True)[: max(allowance, 1) + 1]
    )
    used_at = consumed_at_values[0] if consumed_at_values else None
    in_period = [value for value in consumed_at_values if value > cutoff]
    used_in_period = len(in_period)

    available = allowance > 0 and used_in_period < allowance
    next_available_at = None
    if not available and allowance > 0 and len(in_period) >= allowance:
        # `in_period` is newest-first, so the element at `allowance - 1` is the
        # oldest of the `allowance` most recent uses. With the default
        # allowance of 1 this is simply "last use + 365 days" (spec §22.1).
        next_available_at = in_period[allowance - 1] + period

    return FreeQuotaState(
        available=available,
        used_at=used_at,
        next_available_at=next_available_at,
        publication_days=free_publication_days(),
        allowance=allowance,
        used_in_period=used_in_period,
    )


def available_paid_rights(
    user, *, now: datetime | None = None
) -> QuerySet[UserEntitlement]:
    """AVAILABLE, in-window PAID_LISTING rights, soonest-expiring first.

    Soonest-expiring first is deliberate: consuming the right that would lapse
    next is the only ordering that never destroys value the buyer paid for.
    """
    now = now or timezone.now()
    return (
        UserEntitlement.objects.for_user(user)
        .paid()
        .available(now=now)
        .order_by("valid_until", "created_at")
    )
```

Note the slice `[: max(allowance, 1) + 1]`: it fetches one row more than the
allowance so `used_at` is still reported when every in-window slot is taken,
and it keeps the query bounded when a user has a long history. `max(allowance, 1)`
guards the configured value of `0`, where the slice would otherwise be empty
and `used_at` would wrongly come back `None`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && uv run pytest entitlements/tests/test_policy.py -v`
Expected: PASS (14 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/entitlements/policy.py backend/entitlements/tests/test_policy.py
git commit -m "feat(entitlements): rolling free-quota window and paid-rights selector"
```

---

### Task 4: `ListingEligibilityService.for_user()` — spec §22.2's payload

**Files:**
- Create: `backend/entitlements/eligibility.py`
- Test: `backend/entitlements/tests/test_eligibility.py`

**Interfaces:**
- Consumes: `entitlements.policy.{FreeQuotaState, free_quota_state, available_paid_rights, free_publication_days, paid_publication_days, enforcement_enabled}` (Task 3); `entitlements.enums.{BlockingReason, EntitlementType, EntitlementSource, PURCHASE_PRODUCT_CODE}` (Task 1); `accounts.enums.UserRole`; `accounts.services.is_staff_admin`.
- Produces:
  - `entitlements.eligibility.RecommendedEntitlement` — frozen dataclass: `entitlement_id: str | None`, `entitlement_type: str`, `source: str`, `valid_until: datetime | None`, `publication_days: int`; method `as_dict() -> dict`
  - `entitlements.eligibility.Eligibility` — frozen dataclass: `can_start_listing: bool`, `recommended_entitlement: RecommendedEntitlement | None`, `free: FreeQuotaState`, `paid_listing_rights_available: int`, `blocking_reason: str | None`, `purchase_product_code: str`; method `as_dict() -> dict`
  - `entitlements.eligibility.ListingEligibilityService.for_user(user, *, now=None) -> Eligibility`

- [ ] **Step 1: Write the failing test**

`backend/entitlements/tests/test_eligibility.py`:

```python
"""Spec §22.2's ListingEligibilityService payload, key by key."""

from datetime import timedelta

import pytest
from django.utils import timezone

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from django.contrib.auth.models import Group
from entitlements.eligibility import ListingEligibilityService
from entitlements.enums import (
    BlockingReason,
    EntitlementSource,
    EntitlementState,
    EntitlementType,
)
from entitlements.tests.factories import make_entitlement, make_private_seller


@pytest.mark.django_db
def test_payload_has_exactly_the_spec_22_2_keys(entitlements_enforced):
    payload = ListingEligibilityService.for_user(make_private_seller()).as_dict()
    assert set(payload) == {
        "can_start_listing",
        "recommended_entitlement",
        "free",
        "paid_listing_rights_available",
        "blocking_reason",
        "purchase_product_code",
    }
    assert set(payload["free"]) == {
        "available",
        "used_at",
        "next_available_at",
        "publication_days",
    }
    assert payload["purchase_product_code"] == "INDIVIDUAL_LISTING_RIGHT"


@pytest.mark.django_db
def test_a_fresh_seller_is_recommended_the_free_right(entitlements_enforced):
    result = ListingEligibilityService.for_user(make_private_seller())

    assert result.can_start_listing is True
    assert result.blocking_reason is None
    assert result.recommended_entitlement.entitlement_type == (
        EntitlementType.FREE_LISTING
    )
    assert result.recommended_entitlement.source == EntitlementSource.FREE_POLICY
    # The free right has no ledger row until it is consumed at submit.
    assert result.recommended_entitlement.entitlement_id is None
    assert result.recommended_entitlement.publication_days == 30


@pytest.mark.django_db
def test_an_exhausted_seller_with_no_paid_right_is_blocked(entitlements_enforced):
    user = make_private_seller()
    now = timezone.now()
    make_entitlement(
        user=user,
        entitlement_type=EntitlementType.FREE_LISTING,
        state=EntitlementState.CONSUMED,
        consumed_at=now - timedelta(days=5),
    )

    result = ListingEligibilityService.for_user(user, now=now)

    assert result.can_start_listing is False
    assert result.blocking_reason == BlockingReason.FREE_ALLOWANCE_USED
    assert result.recommended_entitlement is None
    assert result.paid_listing_rights_available == 0
    assert result.free.available is False
    assert result.free.next_available_at is not None


@pytest.mark.django_db
def test_an_exhausted_seller_with_a_paid_right_may_start(entitlements_enforced):
    """Spec §22.3: "If a paid right already exists, show 'Use an available
    listing right' instead of purchase"."""
    user = make_private_seller()
    now = timezone.now()
    make_entitlement(
        user=user,
        entitlement_type=EntitlementType.FREE_LISTING,
        state=EntitlementState.CONSUMED,
        consumed_at=now - timedelta(days=5),
    )
    paid = make_entitlement(
        user=user,
        entitlement_type=EntitlementType.PAID_LISTING,
        source=EntitlementSource.STRIPE_PURCHASE,
        state=EntitlementState.AVAILABLE,
        valid_until=now + timedelta(days=100),
    )

    result = ListingEligibilityService.for_user(user, now=now)

    assert result.can_start_listing is True
    assert result.blocking_reason is None
    assert result.paid_listing_rights_available == 1
    assert result.recommended_entitlement.entitlement_id == str(paid.pk)
    assert result.recommended_entitlement.entitlement_type == (
        EntitlementType.PAID_LISTING
    )
    assert result.recommended_entitlement.publication_days == 30


@pytest.mark.django_db
def test_free_is_preferred_over_a_paid_right(entitlements_enforced):
    user = make_private_seller()
    make_entitlement(
        user=user,
        entitlement_type=EntitlementType.PAID_LISTING,
        source=EntitlementSource.STRIPE_PURCHASE,
        state=EntitlementState.AVAILABLE,
    )

    result = ListingEligibilityService.for_user(user)

    assert result.recommended_entitlement.entitlement_type == (
        EntitlementType.FREE_LISTING
    )
    assert result.paid_listing_rights_available == 1


@pytest.mark.django_db
def test_a_buyer_account_cannot_start_a_private_listing(entitlements_enforced):
    buyer = make_user("buyer@example.com", role=UserRole.BUYER, verified=True)

    result = ListingEligibilityService.for_user(buyer)

    assert result.can_start_listing is False
    assert result.blocking_reason == BlockingReason.NOT_AN_INDIVIDUAL_SELLER
    assert result.recommended_entitlement is None


@pytest.mark.django_db
def test_a_staff_admin_is_treated_as_an_individual_seller(entitlements_enforced):
    """accounts.services.resolve_seller_context() lets a staff admin create a
    private-seller listing; eligibility must agree or the two would disagree
    about the same request."""
    admin = make_user("staff-admin@example.com", role=UserRole.STAFF, verified=True)
    admin.groups.add(Group.objects.get_or_create(name=StaffGroup.ADMIN)[0])

    result = ListingEligibilityService.for_user(admin)

    assert result.can_start_listing is True
    assert result.blocking_reason is None


@pytest.mark.django_db
def test_with_the_flag_off_nothing_blocks_but_the_free_block_stays_truthful():
    """The plan's flag ruling: refusal is gated, bookkeeping is not."""
    user = make_private_seller()
    now = timezone.now()
    make_entitlement(
        user=user,
        entitlement_type=EntitlementType.FREE_LISTING,
        state=EntitlementState.CONSUMED,
        consumed_at=now - timedelta(days=5),
    )

    result = ListingEligibilityService.for_user(user, now=now)

    assert result.can_start_listing is True
    assert result.blocking_reason is None
    assert result.free.available is False
    assert result.free.next_available_at is not None


@pytest.mark.django_db
def test_a_buyer_is_still_refused_with_the_flag_off():
    """The role rule is not part of the entitlement rollout — it is Phase 3's
    ownership rule, which resolve_seller_context enforces regardless."""
    buyer = make_user("buyer2@example.com", role=UserRole.BUYER, verified=True)

    result = ListingEligibilityService.for_user(buyer)

    assert result.can_start_listing is False
    assert result.blocking_reason == BlockingReason.NOT_AN_INDIVIDUAL_SELLER
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && uv run pytest entitlements/tests/test_eligibility.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'entitlements.eligibility'`.

- [ ] **Step 3: Write `backend/entitlements/eligibility.py`**

```python
"""Spec §22.2's ListingEligibilityService.

Spec §22.2 names the five places this is evaluated: the Sell landing CTA, the
private dashboard CTA, the create route, the draft-creation API and the final
submission inside the locked transaction. All five call THIS function; the
last one calls it again while holding the lock, which is what makes it
authoritative ("The last check is authoritative and prevents multiple-tab
races").
"""

from dataclasses import dataclass
from datetime import datetime

from accounts.enums import UserRole
from accounts.services import is_staff_admin

from .enums import (
    PURCHASE_PRODUCT_CODE,
    BlockingReason,
    EntitlementSource,
    EntitlementType,
)
from .policy import (
    FreeQuotaState,
    available_paid_rights,
    enforcement_enabled,
    free_quota_state,
    paid_publication_days,
)


@dataclass(frozen=True)
class RecommendedEntitlement:
    """Which right a submission would actually burn.

    Spec §22.2 shows this key as `null` and never shows a populated shape, so
    the shape is this plan's ruling: the fields the UI needs to say "you are
    about to use X, which publishes for N days and itself expires on D".
    `entitlement_id` is null for the free right, which has no ledger row until
    it is consumed at submit (spec §6.3).
    """

    entitlement_id: str | None
    entitlement_type: str
    source: str
    valid_until: datetime | None
    publication_days: int

    def as_dict(self) -> dict:
        return {
            "entitlement_id": self.entitlement_id,
            "entitlement_type": self.entitlement_type,
            "source": self.source,
            "valid_until": self.valid_until,
            "publication_days": self.publication_days,
        }


@dataclass(frozen=True)
class Eligibility:
    can_start_listing: bool
    recommended_entitlement: RecommendedEntitlement | None
    free: FreeQuotaState
    paid_listing_rights_available: int
    blocking_reason: str | None
    purchase_product_code: str

    def as_dict(self) -> dict:
        """Spec §22.2's payload, key for key and in its order.

        There is no DRF Serializer here on purpose: the dataclass is the single
        representation, so the API, the services and the tests cannot drift
        apart the way two parallel definitions would.
        """
        return {
            "can_start_listing": self.can_start_listing,
            "recommended_entitlement": (
                self.recommended_entitlement.as_dict()
                if self.recommended_entitlement is not None
                else None
            ),
            "free": self.free.as_dict(),
            "paid_listing_rights_available": self.paid_listing_rights_available,
            "blocking_reason": self.blocking_reason,
            "purchase_product_code": self.purchase_product_code,
        }


def _may_sell_privately(user) -> bool:
    """The same rule accounts.services.resolve_seller_context() applies when
    `broker_id` is None. Kept in lockstep deliberately: if these two ever
    disagree, the UI would offer a CTA the create endpoint then refuses."""
    return user.primary_role == UserRole.PRIVATE_SELLER or is_staff_admin(user)


class ListingEligibilityService:
    @staticmethod
    def for_user(user, *, now: datetime | None = None) -> Eligibility:
        free = free_quota_state(user, now=now)
        paid = list(available_paid_rights(user, now=now))
        paid_count = len(paid)

        if not _may_sell_privately(user):
            # Not an entitlement problem and not gated by the rollout flag:
            # this account could never create a private-seller listing.
            return Eligibility(
                can_start_listing=False,
                recommended_entitlement=None,
                free=free,
                paid_listing_rights_available=paid_count,
                blocking_reason=BlockingReason.NOT_AN_INDIVIDUAL_SELLER,
                purchase_product_code=PURCHASE_PRODUCT_CODE,
            )

        recommended = None
        if free.available:
            # Free first: never burn a purchased right while a free one is
            # available.
            recommended = RecommendedEntitlement(
                entitlement_id=None,
                entitlement_type=EntitlementType.FREE_LISTING,
                source=EntitlementSource.FREE_POLICY,
                valid_until=None,
                publication_days=free.publication_days,
            )
        elif paid:
            right = paid[0]
            recommended = RecommendedEntitlement(
                entitlement_id=str(right.pk),
                entitlement_type=EntitlementType.PAID_LISTING,
                source=right.source,
                valid_until=right.valid_until,
                publication_days=paid_publication_days(),
            )

        has_right = recommended is not None
        if has_right:
            can_start, blocking_reason = True, None
        elif enforcement_enabled():
            can_start, blocking_reason = False, BlockingReason.FREE_ALLOWANCE_USED
        else:
            # Flag off: nothing is refused, so the honest answer is "yes", and
            # the `free` block still reports the real quota state.
            can_start, blocking_reason = True, None

        return Eligibility(
            can_start_listing=can_start,
            recommended_entitlement=recommended,
            free=free,
            paid_listing_rights_available=paid_count,
            blocking_reason=blocking_reason,
            purchase_product_code=PURCHASE_PRODUCT_CODE,
        )
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && uv run pytest entitlements/tests/test_eligibility.py -v`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/entitlements/eligibility.py backend/entitlements/tests/test_eligibility.py
git commit -m "feat(entitlements): ListingEligibilityService per spec 22.2"
```

---

### Task 5: `GET /api/v1/listing-eligibility/`

**Files:**
- Create: `backend/entitlements/views.py`, `backend/entitlements/urls.py`
- Modify: `backend/config/urls.py`, `backend/config/settings/base.py`
- Test: `backend/entitlements/tests/test_eligibility_api.py`

**Interfaces:**
- Consumes: `entitlements.eligibility.ListingEligibilityService` (Task 4); `accounts.permissions.{IsActiveUser, IsEmailVerified}`.
- Produces:
  - `entitlements.views.ListingEligibilityView` (DRF `APIView`, `throttle_scope = "listing_eligibility"`)
  - URL name `listing-eligibility` at `/api/v1/listing-eligibility/`

- [ ] **Step 1: Write the failing test**

`backend/entitlements/tests/test_eligibility_api.py`:

```python
"""Spec §30.1's `GET /api/v1/listing-eligibility/`."""

from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from entitlements.enums import EntitlementState, EntitlementType
from entitlements.tests.factories import make_entitlement, make_private_seller


@pytest.fixture
def api():
    return APIClient()


@pytest.mark.django_db
def test_anonymous_callers_get_401(api):
    assert api.get(reverse("listing-eligibility")).status_code == 401


@pytest.mark.django_db
def test_an_unverified_account_is_refused_with_a_stable_code(api):
    user = make_user(
        "unverified@example.com", role=UserRole.PRIVATE_SELLER, verified=False
    )
    api.force_authenticate(user)

    response = api.get(reverse("listing-eligibility"))

    assert response.status_code == 403
    assert response.data["error"]["code"] == "email_not_verified"


@pytest.mark.django_db
def test_a_fresh_seller_sees_the_full_spec_22_2_payload(api, entitlements_enforced):
    api.force_authenticate(make_private_seller())

    response = api.get(reverse("listing-eligibility"))

    assert response.status_code == 200
    assert response.data["can_start_listing"] is True
    assert response.data["blocking_reason"] is None
    assert response.data["free"]["available"] is True
    assert response.data["free"]["publication_days"] == 30
    assert response.data["paid_listing_rights_available"] == 0
    assert response.data["purchase_product_code"] == "INDIVIDUAL_LISTING_RIGHT"
    assert response.data["recommended_entitlement"]["entitlement_type"] == (
        "FREE_LISTING"
    )


@pytest.mark.django_db
def test_an_exhausted_seller_sees_the_blocking_reason_and_a_date(
    api, entitlements_enforced
):
    user = make_private_seller()
    used = timezone.now() - timedelta(days=30)
    make_entitlement(
        user=user,
        entitlement_type=EntitlementType.FREE_LISTING,
        state=EntitlementState.CONSUMED,
        consumed_at=used,
    )
    api.force_authenticate(user)

    response = api.get(reverse("listing-eligibility"))

    assert response.status_code == 200
    assert response.data["can_start_listing"] is False
    assert response.data["blocking_reason"] == "FREE_ALLOWANCE_USED"
    assert response.data["recommended_entitlement"] is None
    # Spec §31: "Free-right copy/countdown ... exact next eligibility date".
    assert response.data["free"]["next_available_at"] is not None


@pytest.mark.django_db
def test_one_seller_never_sees_another_sellers_quota(api, entitlements_enforced):
    mine = make_private_seller("mine@example.com")
    theirs = make_private_seller("theirs@example.com")
    make_entitlement(
        user=theirs,
        entitlement_type=EntitlementType.FREE_LISTING,
        state=EntitlementState.CONSUMED,
        consumed_at=timezone.now(),
    )
    api.force_authenticate(mine)

    response = api.get(reverse("listing-eligibility"))

    assert response.data["can_start_listing"] is True
    assert response.data["free"]["used_at"] is None


@pytest.mark.django_db
def test_the_endpoint_is_read_only(api, entitlements_enforced):
    api.force_authenticate(make_private_seller())
    assert api.post(reverse("listing-eligibility"), {}, format="json").status_code == 405
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && uv run pytest entitlements/tests/test_eligibility_api.py -v`
Expected: FAIL — `NoReverseMatch: Reverse for 'listing-eligibility' not found`.

- [ ] **Step 3: Write `backend/entitlements/views.py`**

```python
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsActiveUser, IsEmailVerified

from .eligibility import ListingEligibilityService


class ListingEligibilityView(APIView):
    """GET /api/v1/listing-eligibility/ — spec §30.1, §22.2.

    Deliberately *not* gated by the `individual_entitlements` flag: with the
    flag off the service already reports `can_start_listing: true` and a null
    `blocking_reason`, which is the truth about what the backend will do, so
    the endpoint keeps agreeing with the API under both flag states (spec §22
    definition of done item 2). A 404 behind the flag would instead force the
    UI to invent a fallback.

    `IsEmailVerified` is here because spec §12 item 3 and Phase 3 contract rule
    5 gate listing submission on a verified email: an account that cannot
    submit must not be told it can start a listing.
    """

    permission_classes = [IsAuthenticated, IsActiveUser, IsEmailVerified]
    throttle_scope = "listing_eligibility"
    http_method_names = ["get", "options"]

    def get(self, request):
        return Response(ListingEligibilityService.for_user(request.user).as_dict())
```

- [ ] **Step 4: Write `backend/entitlements/urls.py` and wire it up**

`backend/entitlements/urls.py`:

```python
from django.urls import path

from .views import ListingEligibilityView

urlpatterns = [
    path(
        "listing-eligibility/",
        ListingEligibilityView.as_view(),
        name="listing-eligibility",
    ),
]
```

In `backend/config/urls.py`, append one line to the existing `urlpatterns` list (read the real file; do not paste over it):

```python
    path("api/v1/", include("services_catalog.urls")),
    path("api/v1/", include("entitlements.urls")),
]
```

In `backend/config/settings/base.py`, add one entry to the existing
`REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]` dict, next to `public_listing_read`:

```python
        # Eligibility is polled on every Sell/dashboard/create render (spec
        # §22.2 names five evaluation points), so it is sized like a page-load
        # endpoint rather than like the `auth` bucket. It is authenticated and
        # returns only the caller's own quota, so it is not a scraping surface.
        "listing_eligibility": "120/min",
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd backend && uv run pytest entitlements/tests/test_eligibility_api.py -v`
Expected: PASS (6 tests).

Then confirm the new route does not shadow anything:

Run: `cd backend && uv run pytest listings/tests/test_public_read_api.py -q`
Expected: PASS, unchanged.

- [ ] **Step 6: Commit**

```bash
git add backend/entitlements backend/config/urls.py backend/config/settings/base.py
git commit -m "feat(entitlements): GET /api/v1/listing-eligibility/ endpoint"
```

---

### Task 6: Consumption under lock, and the `403 listing_entitlement_required` exception

**Files:**
- Create: `backend/entitlements/consumption.py`
- Modify: `backend/common/exceptions.py`
- Test: `backend/entitlements/tests/test_consumption.py`

**Interfaces:**
- Consumes: `entitlements.policy.*` (Task 3); `entitlements.eligibility.ListingEligibilityService` (Task 4); `entitlements.models.UserEntitlement` (Task 2); `audit.services.record_audit_event`.
- Produces:
  - `entitlements.consumption.ListingEntitlementRequired(APIException)` — `status_code = 403`, `default_code = "listing_entitlement_required"`, sets `.action` and (when a reason is supplied) `.meta`
  - `entitlements.consumption.lock_user_quota(user) -> None`
  - `entitlements.consumption.ensure_can_start_listing(user) -> None`
  - `entitlements.consumption.consume_listing_right(*, user, listing, actor, now=None) -> UserEntitlement`
  - `common.exceptions.nauta_exception_handler` now copies a non-empty dict attribute `action` into `response.data["error"]["action"]`

- [ ] **Step 1: Write the failing test**

`backend/entitlements/tests/test_consumption.py`:

```python
"""Spec §22.4's locked, once-only consumption and its 403."""

from datetime import timedelta

import pytest
from django.db import transaction
from django.test.utils import CaptureQueriesContext
from django.db import connection
from django.utils import timezone

from audit.models import AuditEvent
from entitlements.consumption import (
    ListingEntitlementRequired,
    consume_listing_right,
    ensure_can_start_listing,
)
from entitlements.enums import EntitlementSource, EntitlementState, EntitlementType
from entitlements.models import UserEntitlement
from entitlements.tests.factories import make_entitlement, make_private_seller
from listings.tests.factories import make_private_listing
from platform_settings.services import update_setting


@pytest.mark.django_db
def test_a_fresh_seller_consumes_the_free_right_and_gets_a_ledger_row(
    entitlements_enforced,
):
    user = make_private_seller()
    listing = make_private_listing(owner=user)

    right = consume_listing_right(user=user, listing=listing, actor=user)

    assert right.entitlement_type == EntitlementType.FREE_LISTING
    assert right.source == EntitlementSource.FREE_POLICY
    assert right.state == EntitlementState.CONSUMED
    assert right.consumed_at is not None
    assert right.listing_id == listing.pk
    assert right.metadata["publication_days"] == 30
    assert right.metadata["enforced"] is True
    assert UserEntitlement.objects.count() == 1


@pytest.mark.django_db
def test_consumption_writes_an_audit_event(entitlements_enforced):
    user = make_private_seller()
    listing = make_private_listing(owner=user)

    right = consume_listing_right(user=user, listing=listing, actor=user)

    event = AuditEvent.objects.get(action="entitlement.consumed")
    assert event.target_id == str(right.pk)
    assert event.metadata["listing_id"] == str(listing.pk)
    assert event.before["state"] is None
    assert event.after["state"] == EntitlementState.CONSUMED


@pytest.mark.django_db
def test_a_second_listing_is_refused_once_the_free_right_is_gone(
    entitlements_enforced,
):
    user = make_private_seller()
    consume_listing_right(
        user=user, listing=make_private_listing(owner=user), actor=user
    )
    second = make_private_listing(owner=user)

    with pytest.raises(ListingEntitlementRequired) as excinfo:
        consume_listing_right(user=user, listing=second, actor=user)

    assert excinfo.value.status_code == 403
    assert excinfo.value.get_codes() == "listing_entitlement_required"
    assert excinfo.value.action == {
        "type": "PURCHASE",
        "product_code": "INDIVIDUAL_LISTING_RIGHT",
    }
    assert UserEntitlement.objects.count() == 1


@pytest.mark.django_db
def test_resubmitting_the_same_listing_reuses_its_right(entitlements_enforced):
    """Spec §22.1: "A rejected submission can be corrected without consuming a
    second right." Spec §36.3: "a submitted right stays associated through
    changes-requested/rejected correction loop"."""
    user = make_private_seller()
    listing = make_private_listing(owner=user)
    first = consume_listing_right(user=user, listing=listing, actor=user)

    # `consumed_entitlement_id` is the column name both before Task 7 (a loose
    # UUIDField) and after it (the FK's attname), so this line survives the
    # conversion unchanged.
    listing.consumed_entitlement_id = first.pk
    listing.save(update_fields=["consumed_entitlement_id", "updated_at"])

    again = consume_listing_right(user=user, listing=listing, actor=user)

    assert again.pk == first.pk
    assert UserEntitlement.objects.count() == 1


@pytest.mark.django_db
def test_a_paid_right_is_consumed_when_the_free_one_is_gone(entitlements_enforced):
    user = make_private_seller()
    consume_listing_right(
        user=user, listing=make_private_listing(owner=user), actor=user
    )
    paid = make_entitlement(
        user=user,
        entitlement_type=EntitlementType.PAID_LISTING,
        source=EntitlementSource.STRIPE_PURCHASE,
        state=EntitlementState.AVAILABLE,
        valid_until=timezone.now() + timedelta(days=90),
    )
    update_setting(key="individual.paid_publish_days", value=60, actor=None)
    second = make_private_listing(owner=user)

    right = consume_listing_right(user=user, listing=second, actor=user)

    paid.refresh_from_db()
    assert right.pk == paid.pk
    assert paid.state == EntitlementState.CONSUMED
    assert paid.listing_id == second.pk
    assert paid.metadata["publication_days"] == 60


@pytest.mark.django_db
def test_with_the_flag_off_an_over_allowance_use_is_still_recorded():
    """The plan's flag ruling: refusal is gated, bookkeeping is not."""
    user = make_private_seller()
    consume_listing_right(
        user=user, listing=make_private_listing(owner=user), actor=user
    )
    second = make_private_listing(owner=user)

    right = consume_listing_right(user=user, listing=second, actor=user)

    assert right.state == EntitlementState.CONSUMED
    assert right.metadata["enforced"] is False
    assert right.metadata["over_allowance"] is True
    assert UserEntitlement.objects.count() == 2


@pytest.mark.django_db(transaction=True)
def test_consumption_takes_a_row_lock_on_the_consuming_user(entitlements_enforced):
    """Spec §22.4: "locks entitlement/quota rows ... Concurrent requests cannot
    consume one entitlement twice."

    The free right has no row to lock until it exists, so the serialisation
    point is the user's own row. This asserts the lock is actually taken rather
    than racing two real connections, which this project deliberately avoids
    (see listings/tests/test_phase_acceptance.py).
    """
    user = make_private_seller()
    listing = make_private_listing(owner=user)

    with CaptureQueriesContext(connection) as captured:
        with transaction.atomic():
            consume_listing_right(user=user, listing=listing, actor=user)

    locking = [
        query["sql"]
        for query in captured.captured_queries
        if "FOR UPDATE" in query["sql"] and "accounts_user" in query["sql"]
    ]
    assert locking, [query["sql"] for query in captured.captured_queries]


@pytest.mark.django_db
def test_ensure_can_start_listing_raises_only_when_enforced():
    user = make_private_seller()
    consume_listing_right(
        user=user, listing=make_private_listing(owner=user), actor=user
    )

    # Flag off: no refusal.
    ensure_can_start_listing(user)


@pytest.mark.django_db
def test_ensure_can_start_listing_raises_with_a_blocking_reason(
    entitlements_enforced,
):
    user = make_private_seller()
    consume_listing_right(
        user=user, listing=make_private_listing(owner=user), actor=user
    )

    with pytest.raises(ListingEntitlementRequired) as excinfo:
        ensure_can_start_listing(user)

    assert excinfo.value.meta == {"blocking_reason": "FREE_ALLOWANCE_USED"}
    assert str(excinfo.value.detail) == "You have used your free listing allowance."


@pytest.mark.django_db
def test_the_refusal_message_follows_the_blocking_reason():
    """The 403's code and status are one value for every reason (spec §30.2),
    but the human-readable message must not claim a free allowance was used when
    the real problem is that the account is not an individual seller."""
    not_a_seller = ListingEntitlementRequired(
        blocking_reason="NOT_AN_INDIVIDUAL_SELLER"
    )

    assert not_a_seller.get_codes() == "listing_entitlement_required"
    assert str(not_a_seller.detail) == (
        "This account cannot create a private-seller listing."
    )
```

And, in the same file, the envelope passthrough:

```python
@pytest.mark.django_db
def test_the_error_envelope_carries_the_spec_30_2_action_block(
    entitlements_enforced,
):
    """Spec §30.2's worked example for this exact code includes an `action`
    block; the envelope had no slot for it before this phase."""
    from rest_framework.test import APIClient

    from listings.tests.factories import make_brand, make_model
    from platform_settings.services import set_feature_flag

    set_feature_flag(key="listing_revisions", is_enabled=True, actor=None)
    user = make_private_seller()
    consume_listing_right(
        user=user, listing=make_private_listing(owner=user), actor=user
    )

    api = APIClient()
    api.force_authenticate(user)
    brand = make_brand("Azimut")
    response = api.post(
        "/api/v1/listings/drafts/",
        {
            "brand_id": str(brand.pk),
            "model_id": str(make_model(brand).pk),
            "manufacture_year": 2021,
        },
        format="json",
    )

    assert response.status_code == 403
    assert response.data["error"]["code"] == "listing_entitlement_required"
    assert response.data["error"]["message"] == (
        "You have used your free listing allowance."
    )
    assert response.data["error"]["action"] == {
        "type": "PURCHASE",
        "product_code": "INDIVIDUAL_LISTING_RIGHT",
    }
```

**Note:** that last test exercises the draft endpoint, which is only wired in
Task 9. Mark it `@pytest.mark.xfail(reason="draft gate lands in Task 9", strict=True)`
when writing Task 6, and delete the marker in Task 9 Step 5. Everything else in
this file passes at the end of this task.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && uv run pytest entitlements/tests/test_consumption.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'entitlements.consumption'`.

- [ ] **Step 3: Write `backend/entitlements/consumption.py`**

```python
"""Reserving, refusing and consuming a listing right (spec §22.4, §6.3, §36.3).

This module holds the single authoritative check. Spec §22.2 lists five
evaluation points and says of the last one — submission, inside the locked
transaction — "The last check is authoritative and prevents multiple-tab
races." That is `consume_listing_right()`; everything before it is advisory.
"""

from datetime import datetime, timedelta

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import APIException

from audit.models import AuditEvent
from audit.services import record_audit_event

from .eligibility import ListingEligibilityService
from .enums import (
    PURCHASE_PRODUCT_CODE,
    EntitlementSource,
    EntitlementState,
    EntitlementType,
)
from .models import UserEntitlement
from .policy import (
    available_paid_rights,
    enforcement_enabled,
    free_period_days,
    free_publication_days,
    free_quota_state,
    paid_publication_days,
)


class ListingEntitlementRequired(APIException):
    """Spec §22.4's refusal, with spec §30.2's worked `action` block.

    403, not 409: this is "you are not allowed to do this", not "the record
    moved under you". The same code and status are returned by draft creation
    and by submit so a client branches on one value.
    """

    status_code = status.HTTP_403_FORBIDDEN
    # Copied verbatim from spec §30.2's example error body.
    default_detail = "You have used your free listing allowance."
    default_code = "listing_entitlement_required"
    # One message per blocking reason. Without this, an account that is not an
    # individual seller at all would be told it had "used its free listing
    # allowance" — false, and unhelpful. The code and status stay the same for
    # every reason so a client still branches on one value (spec §30.2); only
    # the human-readable message differs.
    DETAIL_BY_REASON = {
        "FREE_ALLOWANCE_USED": default_detail,
        "NOT_AN_INDIVIDUAL_SELLER": (
            "This account cannot create a private-seller listing."
        ),
    }

    def __init__(self, *, blocking_reason: str | None = None, detail=None):
        detail = detail or self.DETAIL_BY_REASON.get(
            blocking_reason, self.default_detail
        )
        super().__init__(detail=detail, code=self.default_code)
        # Both are copied into the envelope by common.exceptions.
        self.action = {"type": "PURCHASE", "product_code": PURCHASE_PRODUCT_CODE}
        if blocking_reason:
            self.meta = {"blocking_reason": blocking_reason}


def lock_user_quota(user) -> None:
    """`SELECT … FOR UPDATE` on the consuming user's own row.

    The serialisation point for free-right consumption, which has no row of its
    own to lock until the instant it is created. Cheap (one row, one user) and
    released with the surrounding transaction.

    LOCK ORDER: BoatListing first, User second. listings.submissions locks the
    listing before calling into here; any future path that needs both must take
    them in that order.
    """
    get_user_model().objects.select_for_update().filter(pk=user.pk).values_list(
        "pk", flat=True
    ).first()


def ensure_can_start_listing(user) -> None:
    """Spec §22.4's draft-creation gate. Raises or returns None.

    No lock: this is one of spec §22.2's advisory evaluation points, not the
    authoritative one. Taking a lock here would serialise draft creation for no
    benefit, since nothing is consumed.

    The raised message is chosen from the blocking reason, so calling this in
    isolation on an account that is not an individual seller produces the
    NOT_AN_INDIVIDUAL_SELLER wording rather than a false "you used your free
    allowance". In the normal flow that reason is unreachable here, because
    listings.drafts calls accounts.services.resolve_seller_context() first and
    that rejects a non-individual seller with its own error.
    """
    if not enforcement_enabled():
        return
    eligibility = ListingEligibilityService.for_user(user)
    if not eligibility.can_start_listing:
        raise ListingEntitlementRequired(blocking_reason=eligibility.blocking_reason)


def _publication_source_days(entitlement_type: str) -> int:
    if entitlement_type == EntitlementType.PAID_LISTING:
        return paid_publication_days()
    return free_publication_days()


@transaction.atomic
def consume_listing_right(
    *, user, listing, actor, now: datetime | None = None
) -> UserEntitlement:
    """Burn exactly one listing right for `listing`, or raise.

    Returns the ledger row. Idempotent per listing: a listing that already
    carries a consumed right returns that same row without burning another
    (spec §22.1's "A rejected submission can be corrected without consuming a
    second right", spec §36.3's "a submitted right stays associated through
    changes-requested/rejected correction loop").
    """
    now = now or timezone.now()

    existing_id = listing.consumed_entitlement_id
    if existing_id is not None:
        return UserEntitlement.objects.get(pk=existing_id)

    lock_user_quota(user)

    # Recomputed INSIDE the lock. Everything read before this point is stale by
    # definition (spec §22.2: "The last check is authoritative").
    free = free_quota_state(user, now=now)
    enforced = enforcement_enabled()

    if free.available:
        return _consume_free(
            user=user, listing=listing, actor=actor, now=now, enforced=enforced,
            over_allowance=False,
        )

    paid = (
        available_paid_rights(user, now=now)
        .select_for_update()
        .first()
    )
    if paid is not None:
        return _consume_paid(entitlement=paid, listing=listing, actor=actor, now=now,
                             enforced=enforced)

    if enforced:
        raise ListingEntitlementRequired(blocking_reason="FREE_ALLOWANCE_USED")

    # Flag off: nothing may be refused, but the ledger must still record that a
    # free listing was activated — otherwise enabling the flag later would hand
    # this user a fresh allowance (spec §11.9's warning). The row is marked so
    # the ledger never claims the use was within policy.
    return _consume_free(
        user=user, listing=listing, actor=actor, now=now, enforced=False,
        over_allowance=True,
    )


def _audit(*, entitlement, actor, listing, before_state):
    # actor_type MUST agree with actor_user. The plan's Global Constraints rule
    # is "system actions use SYSTEM/TASK", and an unauthenticated or absent
    # actor here is exactly a system action — writing actor_type=USER with
    # actor_user=None would put a self-contradicting pair in an immutable audit
    # row (spec §2.4). Same conditional shape as services.release_reservation.
    actor_user = actor if getattr(actor, "is_authenticated", False) else None
    record_audit_event(
        actor_user=actor_user,
        actor_type=(
            AuditEvent.ActorType.USER
            if actor_user is not None
            else AuditEvent.ActorType.SYSTEM
        ),
        action="entitlement.consumed",
        target_type="entitlements.UserEntitlement",
        target_id=str(entitlement.pk),
        source=AuditEvent.Source.API,
        before={"state": before_state},
        after={
            "state": entitlement.state,
            "consumed_at": entitlement.consumed_at,
        },
        metadata={
            "listing_id": str(listing.pk),
            "entitlement_type": entitlement.entitlement_type,
            "source": entitlement.source,
            "publication_days": entitlement.metadata.get("publication_days"),
        },
    )


def _consume_free(*, user, listing, actor, now, enforced, over_allowance):
    entitlement = UserEntitlement.objects.create(
        user=user,
        entitlement_type=EntitlementType.FREE_LISTING,
        source=EntitlementSource.FREE_POLICY,
        state=EntitlementState.CONSUMED,
        listing=listing,
        valid_from=now,
        # A free right is created already consumed, so its window exists only
        # so the row satisfies the model's validity constraint and so the
        # ledger records the policy period that applied (spec §36.3).
        valid_until=now + timedelta(days=free_period_days()),
        consumed_at=now,
        metadata={
            # Frozen here, read back by listings.policies.publication_days at
            # approval time (spec §36.3: "Existing consumed entitlements
            # preserve their recorded publication duration").
            "publication_days": free_publication_days(),
            "free_period_days": free_period_days(),
            "enforced": enforced,
            "over_allowance": over_allowance,
        },
    )
    _audit(entitlement=entitlement, actor=actor, listing=listing, before_state=None)
    return entitlement


def _consume_paid(*, entitlement, listing, actor, now, enforced):
    before_state = entitlement.state
    entitlement.state = EntitlementState.CONSUMED
    entitlement.consumed_at = now
    entitlement.listing = listing
    entitlement.metadata = {
        **entitlement.metadata,
        "publication_days": paid_publication_days(),
        "enforced": enforced,
        "over_allowance": False,
    }
    entitlement.save(
        update_fields=["state", "consumed_at", "listing", "metadata", "updated_at"]
    )
    _audit(
        entitlement=entitlement,
        actor=actor,
        listing=listing,
        before_state=before_state,
    )
    return entitlement
```

- [ ] **Step 4: Add the `action` passthrough to `backend/common/exceptions.py`**

Immediately below the existing `meta` block at the end of `nauta_exception_handler`, add:

```python
    # Optional, exception-supplied next step. Spec 30.2's worked example for
    # `listing_entitlement_required` carries
    # {"type": "PURCHASE", "product_code": "INDIVIDUAL_LISTING_RIGHT"} at the
    # error level, and the envelope had no slot for it. Same contract as `meta`
    # above: only an exception that defines a non-empty dict `action`
    # contributes one, so the key is absent otherwise.
    action = getattr(exc, "action", None)
    if isinstance(action, dict) and action:
        response.data["error"]["action"] = action
```

This must go **before** the `response["X-Request-ID"] = request_id` line and the
`return response`. Read the real file and insert; do not paste over it.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd backend && uv run pytest entitlements/tests/test_consumption.py -v`
Expected: PASS, with the one `xfail` (the draft-endpoint envelope test) reported as `xfailed`.

Then prove the envelope change broke nothing:

Run: `cd backend && uv run pytest common/tests listings/tests -q`
Expected: PASS, unchanged.

- [ ] **Step 6: Commit**

```bash
git add backend/entitlements/consumption.py backend/entitlements/tests/test_consumption.py backend/common/exceptions.py
git commit -m "feat(entitlements): locked once-only consumption and the 403 action envelope"
```

---

### Task 7: Convert `BoatListing.consumed_entitlement_id` into a real foreign key

**Files:**
- Modify: `backend/listings/models.py` (one field), `backend/listings/admin.py` (one string)
- Generated: `backend/listings/migrations/0005_boatlisting_consumed_entitlement.py`
- Test: `backend/listings/tests/test_boat_listing_model.py` (append two tests)

**Interfaces:**
- Consumes: `entitlements.models.UserEntitlement` (Task 2).
- Produces: `BoatListing.consumed_entitlement` — `ForeignKey("entitlements.UserEntitlement", null=True, blank=True, on_delete=PROTECT, related_name="+")`. Its attribute name for the raw id is unchanged: **`listing.consumed_entitlement_id`** still works, because Django names an FK's column and attname `<field>_id`. No existing read of `consumed_entitlement_id` anywhere in the repository has to change.

This task is schema-only. No behaviour changes; nothing writes the column yet.

- [ ] **Step 1: Write the failing test**

Append to `backend/listings/tests/test_boat_listing_model.py`:

```python
def test_consumed_entitlement_is_a_real_foreign_key_to_the_ledger():
    """Phase 11 contract rule 6: Phase 13 converts this loose UUIDField."""
    from django.db import models as django_models

    from entitlements.models import UserEntitlement

    field = BoatListing._meta.get_field("consumed_entitlement")
    assert isinstance(field, django_models.ForeignKey)
    assert field.related_model is UserEntitlement
    assert field.null is True
    assert field.remote_field.on_delete is django_models.PROTECT
    # The raw-id attribute name is unchanged, so every existing reader keeps
    # working.
    assert field.attname == "consumed_entitlement_id"


@pytest.mark.django_db
def test_a_consumed_entitlement_cannot_be_deleted_out_from_under_its_listing():
    from django.db.models import ProtectedError

    from entitlements.tests.factories import make_entitlement, make_private_seller

    owner = make_private_seller("fk-owner@example.com")
    listing = make_private_listing(owner=owner)
    right = make_entitlement(user=owner, listing=listing)
    listing.consumed_entitlement = right
    listing.save(update_fields=["consumed_entitlement_id", "updated_at"])

    with pytest.raises(ProtectedError):
        right.delete()
```

If `test_boat_listing_model.py` does not already import `make_private_listing` or `pytest`, add them to its existing import block rather than importing mid-file.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && uv run pytest listings/tests/test_boat_listing_model.py -k consumed_entitlement -v`
Expected: FAIL — `FieldDoesNotExist: BoatListing has no field named 'consumed_entitlement'`.

- [ ] **Step 3: Change the field in `backend/listings/models.py`**

Replace these three lines:

```python
    # Loose reference to Phase 13's UserEntitlement (spec §11.9), which does not
    # exist yet. Converted to a real ForeignKey by Phase 13.
    consumed_entitlement_id = models.UUIDField(null=True, blank=True)
```

with:

```python
    # Spec §11.9's ledger row this listing's publication was paid for with.
    # PROTECT, not SET_NULL: the ledger is the only record of *why* this listing
    # was allowed to publish, and spec §2.4 makes that auditable forever. Set
    # exactly once, inside listings.submissions.submit_listing_revision's
    # transaction (spec §22.4).
    consumed_entitlement = models.ForeignKey(
        "entitlements.UserEntitlement",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="+",
    )
```

Nothing else in `models.py` changes — no constraint, no index, no `clean()`.

- [ ] **Step 4: Change the one string in `backend/listings/admin.py`**

In `BoatListingAdmin.readonly_fields`, replace `"consumed_entitlement_id",` with `"consumed_entitlement",`. The surrounding comment (which explains why the whole publication-lifecycle group is read-only) stays as it is.

- [ ] **Step 5: Generate and verify the migration**

Run: `cd backend && uv run python manage.py makemigrations listings --name boatlisting_consumed_entitlement --no-input`

**`--no-input` is not optional.** One field disappears (`consumed_entitlement_id`) and another appears (`consumed_entitlement`) against the *same* database column, which is precisely the shape that can make Django's autodetector ask the interactive question *"Did you rename boatlisting.consumed_entitlement_id to boatlisting.consumed_entitlement (a ForeignKey)? [y/N]"*. In CI that prompt reads EOF and either hangs or aborts the job. `--no-input` installs `NonInteractiveMigrationQuestioner`, whose `ask_rename` answers **no** — which is the answer this plan wants, because a rename would keep the column as a `UUIDField` and never create the FK constraint. If you are ever forced to answer it interactively, answer **N**.

Open the generated file and verify it contains **exactly two operations**: a `RemoveField` for `consumed_entitlement_id` and an `AddField` for `consumed_entitlement` — and no `RenameField`. Both act on the same database column, so **`RemoveField` must come first**; if the autodetector emitted them in the other order, swap them by hand and leave a one-line comment saying why. If a `RenameField` appears instead, delete it and hand-write the two operations.

Then confirm the dependency list contains both of these (Django adds the second automatically for the FK; add it if it is missing):

```python
    dependencies = [
        ("listings", "0004_seed_listing_revisions_flag"),
        ("entitlements", "0001_userentitlement"),
    ]
```

**No data migration is needed and none is written.** Phase 11's Known Limitation 1 records that `ListingEntitlementGate.consume()` "never touches an entitlement ledger, so `BoatListing.consumed_entitlement_id` is always `NULL`" — the column has never been written by any code path, in any environment. Prove it rather than assume it before merging:

Run: `cd backend && uv run python manage.py shell -c "from listings.models import BoatListing; print(BoatListing.objects.exclude(consumed_entitlement_id=None).count())"`
Expected: `0`. Run this **before** applying the migration on any environment that has data. If it is ever non-zero, stop: the column would need a backfill, not a drop, and this plan would need revising.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd backend && uv run pytest listings/tests/test_boat_listing_model.py -v`
Expected: PASS.

Run: `cd backend && uv run python manage.py makemigrations --check --dry-run`
Expected: `No changes detected`.

Run: `cd backend && uv run pytest -q`
Expected: full suite green — in particular `listings/tests/test_phase_acceptance.py`, which is the regression net for Phase 11's whole workflow.

- [ ] **Step 7: Commit**

```bash
git add backend/listings/models.py backend/listings/admin.py backend/listings/migrations backend/listings/tests/test_boat_listing_model.py
git commit -m "feat(listings): consumed_entitlement is a real FK to the ledger"
```

---

### Task 8: Real `ListingEntitlementGate`, and consumption inside the submit transaction

**Files:**
- Modify: `backend/listings/policies.py` (the `ListingEntitlementGate` class body only), `backend/listings/submissions.py` (the existing entitlement block inside `submit_listing_revision`, plus one keyword on one `bump_version` call)
- Create: `backend/listings/tests/test_entitlement_enforcement.py`
- Modify: `backend/listings/tests/conftest.py` (add a broker fixture, extend the flag list), `backend/listings/tests/test_policies.py` (update the stub assertions)

**Interfaces:**
- Consumes: `entitlements.consumption.{ListingEntitlementRequired, consume_listing_right}` (Task 6); `entitlements.eligibility.ListingEligibilityService` (Task 4); `entitlements.policy.{enforcement_enabled, free_publication_days}` (Task 3); `entitlements.enums.EntitlementType` (Task 1).
- Produces:
  - `listings.policies.ConsumedRight` — frozen dataclass: `entitlement: object | None`, `publication_source: str`
  - `listings.policies.ListingEntitlementGate.can_submit(*, user, broker=None) -> bool` (signature unchanged from Phase 11 — deliberately, see Step 4: it knows nothing about *which* listing is being submitted, so the **call site** decides when it applies)
  - `listings.policies.ListingEntitlementGate.consume(*, listing, user) -> ConsumedRight` (**return type changed** from `str` to `ConsumedRight`; the keyword arguments are unchanged)
  - `listings.policies.ListingEntitlementGate.publication_days(*, listing) -> int | None` (signature unchanged; now reads the consumed entitlement first)
  - `listings.policies.ListingEntitlementRequired` — re-exported from `entitlements.consumption` so `listings.submissions` has one import source for the whole gate

**Cross-phase note:** `requires_staff_approval`, `effective_media_allowance`, `media_counts` and `MediaAllowance` in the same module are **not touched** — they belong to Phases 12 and 15.

- [ ] **Step 1: Write the failing test**

`backend/listings/tests/test_entitlement_enforcement.py`:

```python
"""Spec §22.4 enforcement at submit, and spec §36.3's publication-duration freeze.

These tests drive the real HTTP endpoints, because spec §22's definition of
done is a statement about what the API does.
"""

from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from entitlements.enums import EntitlementSource, EntitlementState, EntitlementType
from entitlements.models import UserEntitlement
from entitlements.tests.factories import make_entitlement, make_private_seller
from listings.enums import ListingStatus, PublicationSource
from listings.models import BoatListing
from listings.policies import ListingEntitlementGate
from listings.tests.factories import make_brand, make_media, make_model, make_private_listing
from platform_settings.services import set_feature_flag, update_setting


@pytest.fixture
def workflow_enabled(db):
    set_feature_flag(key="listing_revisions", is_enabled=True, actor=None)


@pytest.fixture
def entitlements_on(db):
    set_feature_flag(key="individual_entitlements", is_enabled=True, actor=None)


@pytest.fixture
def api():
    return APIClient()


def _draft(api, *, brand):
    response = api.post(
        reverse("listing-draft-create"),
        {
            "brand_id": str(brand.pk),
            "model_id": str(make_model(brand).pk),
            "manufacture_year": 2020,
        },
        format="json",
    )
    assert response.status_code == 201, response.data
    return response.data


def _fill_and_submit(api, created):
    listing = BoatListing.objects.get(pk=created["id"])
    image = make_media(listing)
    patched = api.patch(
        reverse("listing-draft-update", kwargs={"listing_id": listing.pk}),
        {
            "version": created["revision"]["version"],
            "title_en": "Well kept cruiser",
            "description_en": "A well kept cruiser with a recent service.",
            "location_country": "ES",
            "location_region": "Balearic Islands",
            "location_city": "Palma",
            "price": "125000.00",
            "currency": "EUR",
            "media_ids": [str(image.pk)],
        },
        format="json",
    )
    assert patched.status_code == 200, patched.data
    return api.post(
        reverse("listing-submit", kwargs={"listing_id": listing.pk}),
        {"version": patched.data["revision"]["version"]},
        format="json",
    )


@pytest.mark.django_db
def test_the_first_submission_consumes_the_free_right(
    api, workflow_enabled, entitlements_on
):
    seller = make_private_seller()
    api.force_authenticate(seller)

    response = _fill_and_submit(api, _draft(api, brand=make_brand("Beneteau")))

    assert response.status_code == 200, response.data
    listing = BoatListing.objects.get(pk=response.data["id"])
    assert listing.status == ListingStatus.PENDING_APPROVAL
    assert listing.publication_source == PublicationSource.FREE_ENTITLEMENT
    right = listing.consumed_entitlement
    assert right is not None
    assert right.entitlement_type == EntitlementType.FREE_LISTING
    assert right.state == EntitlementState.CONSUMED
    assert right.listing_id == listing.pk


@pytest.mark.django_db
def test_a_second_submission_is_refused_with_403_and_the_action_block(
    api, workflow_enabled, entitlements_on
):
    """Spec §22 definition of done: "Multiple tabs cannot create multiple free
    listings." Two drafts exist; only one can ever be submitted."""
    seller = make_private_seller()
    api.force_authenticate(seller)
    first = _draft(api, brand=make_brand("Beneteau"))
    second = _draft(api, brand=make_brand("Jeanneau"))

    assert _fill_and_submit(api, first).status_code == 200
    refused = _fill_and_submit(api, second)

    assert refused.status_code == 403
    assert refused.data["error"]["code"] == "listing_entitlement_required"
    assert refused.data["error"]["action"]["product_code"] == (
        "INDIVIDUAL_LISTING_RIGHT"
    )
    assert UserEntitlement.objects.filter(user=seller).count() == 1
    assert BoatListing.objects.get(pk=second["id"]).status == ListingStatus.DRAFT


@pytest.mark.django_db
def test_resubmitting_a_withdrawn_listing_does_not_burn_a_second_right(
    api, workflow_enabled, entitlements_on
):
    """Spec §22.1: "A rejected submission can be corrected without consuming a
    second right." Spec §36.3: "a submitted right stays associated through
    changes-requested/rejected correction loop".

    This is the test that forces `submit_listing_revision`'s pre-check to be
    guarded by `listing.consumed_entitlement_id is None` (Step 4). By the second
    submit the seller's free right is gone, so a bare
    `can_submit(user=actor, broker=...)` returns False and would 403 — even
    though `consume()` would correctly hand back the very same right.
    """
    seller = make_private_seller()
    api.force_authenticate(seller)
    created = _draft(api, brand=make_brand("Bavaria"))
    submitted = _fill_and_submit(api, created)
    assert submitted.status_code == 200
    listing = BoatListing.objects.get(pk=created["id"])
    first_right_id = listing.consumed_entitlement_id
    assert first_right_id is not None

    withdrawn = api.post(
        reverse("listing-withdraw", kwargs={"listing_id": listing.pk}),
        {"version": submitted.data["revision"]["version"]},
        format="json",
    )
    assert withdrawn.status_code == 200, withdrawn.data

    listing.refresh_from_db()
    reopened = api.patch(
        reverse("listing-draft-update", kwargs={"listing_id": listing.pk}),
        {"version": listing.version, "title_en": "Well kept cruiser, reduced"},
        format="json",
    )
    assert reopened.status_code == 200, reopened.data
    again = api.post(
        reverse("listing-submit", kwargs={"listing_id": listing.pk}),
        {"version": reopened.data["revision"]["version"]},
        format="json",
    )

    assert again.status_code == 200, again.data
    listing.refresh_from_db()
    assert listing.consumed_entitlement_id == first_right_id
    assert UserEntitlement.objects.filter(user=seller).count() == 1


@pytest.mark.django_db
def test_a_legacy_published_listing_is_revisable_without_burning_a_right(
    api, workflow_enabled, entitlements_on, published_listing_with_snapshot
):
    """Phase 11 Known Limitation 1: EVERY listing published before this phase
    has `consumed_entitlement_id = NULL`, because no code path ever wrote that
    column — that is real data in dev and staging today.

    Spec §6.3 charges a right only on submission "for initial approval", and
    spec §20.2's post-publication edit runs through this same submit path. So
    the first revision of such a listing must be neither charged nor refused,
    even when its owner has no right left. Gating on `consumed_entitlement_id`
    alone would do both.
    """
    listing = published_listing_with_snapshot
    seller = listing.owner_user
    assert listing.consumed_entitlement_id is None
    assert listing.current_public_snapshot_id is not None

    # This owner has nothing available: one spent free right, no paid right.
    make_entitlement(
        user=seller,
        listing=make_private_listing(owner=seller),
        entitlement_type=EntitlementType.FREE_LISTING,
        source=EntitlementSource.FREE_POLICY,
        state=EntitlementState.CONSUMED,
        consumed_at=timezone.now(),
    )
    assert ListingEntitlementGate.can_submit(user=seller, broker=None) is False

    api.force_authenticate(seller)
    reopened = api.patch(
        reverse("listing-draft-update", kwargs={"listing_id": listing.pk}),
        {"version": listing.version, "title_en": "Now with a new tender"},
        format="json",
    )
    assert reopened.status_code == 200, reopened.data
    again = api.post(
        reverse("listing-submit", kwargs={"listing_id": listing.pk}),
        {"version": reopened.data["revision"]["version"]},
        format="json",
    )

    assert again.status_code == 200, again.data
    listing.refresh_from_db()
    # Spec §20.2: the approved snapshot stays live while the edit is reviewed.
    assert listing.status == ListingStatus.PUBLISHED
    assert listing.consumed_entitlement_id is None
    # Exactly the one row created above — nothing new was burned.
    assert UserEntitlement.objects.filter(user=seller).count() == 1


@pytest.mark.django_db
def test_with_the_flag_off_a_second_submission_still_succeeds(api, workflow_enabled):
    seller = make_private_seller()
    api.force_authenticate(seller)
    first = _fill_and_submit(api, _draft(api, brand=make_brand("Bavaria")))
    assert first.status_code == 200, first.data

    second = _fill_and_submit(api, _draft(api, brand=make_brand("Hanse")))

    assert second.status_code == 200, second.data
    # ...but the ledger recorded both, so enabling the flag later blocks a third.
    assert UserEntitlement.objects.filter(user=seller).count() == 2


@pytest.mark.django_db
def test_a_broker_submission_never_touches_the_ledger(
    api, workflow_enabled, entitlements_on, broker_seller
):
    """Spec §1: "Broker listing quota: Unlimited"."""
    actor, broker, brand = broker_seller
    api.force_authenticate(actor)
    created = api.post(
        reverse("listing-draft-create"),
        {
            "broker_id": str(broker.pk),
            "brand_id": str(brand.pk),
            "model_id": str(make_model(brand).pk),
            "manufacture_year": 2022,
        },
        format="json",
    )
    assert created.status_code == 201, created.data

    response = _fill_and_submit(api, created.data)

    assert response.status_code == 200, response.data
    listing = BoatListing.objects.get(pk=created.data["id"])
    assert listing.publication_source == PublicationSource.BROKER_POLICY
    assert listing.consumed_entitlement_id is None
    assert UserEntitlement.objects.count() == 0


@pytest.mark.django_db
def test_publication_days_is_frozen_at_consumption(entitlements_on):
    """Spec §36.3: "Existing consumed entitlements preserve their recorded
    publication duration"."""
    seller = make_private_seller()
    listing = make_private_listing(owner=seller)
    right = make_entitlement(
        user=seller,
        listing=listing,
        entitlement_type=EntitlementType.FREE_LISTING,
        state=EntitlementState.CONSUMED,
        consumed_at=timezone.now(),
        metadata={"publication_days": 30},
    )
    listing.consumed_entitlement = right
    listing.save(update_fields=["consumed_entitlement_id", "updated_at"])

    update_setting(key="individual.free_publish_days", value=90, actor=None)

    assert ListingEntitlementGate.publication_days(listing=listing) == 30


@pytest.mark.django_db
def test_publication_days_falls_back_to_the_setting_without_an_entitlement():
    listing = make_private_listing(owner=make_private_seller())
    update_setting(key="individual.free_publish_days", value=45, actor=None)

    assert ListingEntitlementGate.publication_days(listing=listing) == 45


@pytest.mark.django_db
def test_a_paid_right_publishes_for_the_paid_duration(
    api, workflow_enabled, entitlements_on
):
    seller = make_private_seller()
    api.force_authenticate(seller)
    first = _fill_and_submit(api, _draft(api, brand=make_brand("Dufour")))
    assert first.status_code == 200, first.data
    make_entitlement(
        user=seller,
        entitlement_type=EntitlementType.PAID_LISTING,
        source=EntitlementSource.STRIPE_PURCHASE,
        state=EntitlementState.AVAILABLE,
        valid_until=timezone.now() + timedelta(days=200),
    )
    update_setting(key="individual.paid_publish_days", value=60, actor=None)

    second = _fill_and_submit(api, _draft(api, brand=make_brand("Elan")))

    assert second.status_code == 200, second.data
    listing = BoatListing.objects.get(pk=second.data["id"])
    assert listing.publication_source == PublicationSource.PAID_ENTITLEMENT
    assert ListingEntitlementGate.publication_days(listing=listing) == 60
```

Then extend `backend/listings/tests/conftest.py`. Change its `LISTINGS_FEATURE_FLAG_KEYS` list to `["listing_revisions", "individual_entitlements"]` (so a flag set in one test cannot leak into the next through Redis), and append a broker fixture:

```python
@pytest.fixture
def broker_seller(db):
    """An ACTIVE broker, a member who may edit its listings, and a brand."""
    from accounts.enums import UserRole
    from accounts.tests.factories import make_user
    from brokers.enums import BrokerMembershipRole, BrokerOrganizationStatus
    from brokers.tests.factories import make_broker, make_membership
    from listings.tests.factories import make_brand

    actor = make_user("broker-agent@example.com", role=UserRole.BROKER, verified=True)
    broker = make_broker(
        "Palma Yachts", "palma-yachts", status=BrokerOrganizationStatus.ACTIVE
    )
    make_membership(
        actor,
        broker,
        role=BrokerMembershipRole.OWNER,
        can_edit_listings=True,
    )
    return actor, broker, make_brand("Azimut")
```

**Use `backend/brokers/tests/factories.py`, never a raw `.create()`.** `make_broker(name, slug, *, status, **extra)` also fills `public_email` and `public_phone`, and `make_membership(user, broker, *, role, can_edit_listings, can_manage_team, can_read_messages, is_active)` fills the whole capability set — a bare `BrokerOrganization.objects.create(name=..., status=...)` would leave `slug`, `public_email` and `public_phone` unset and is likely to fail outright. This is the plan's own reuse rule (Contract summary, and the Phase 11 precedent): reuse an existing factory rather than duplicating construction logic. Note the argument order — `make_broker` takes `name` and `slug` positionally, `make_membership` takes `user` then `broker` positionally. If Phase 3 ever changes those signatures, read the real file; do not re-derive the model's fields from memory.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && uv run pytest listings/tests/test_entitlement_enforcement.py -v`
Expected: FAIL (9 tests collected) — the first test fails on `assert right is not None`, because the gate is still Phase 11's stub and nothing writes `consumed_entitlement`.

- [ ] **Step 3: Replace the `ListingEntitlementGate` class body in `backend/listings/policies.py`**

Everything else in the file — `MediaAllowance`, `requires_staff_approval`, `effective_media_allowance`, `media_counts` — is untouched.

The module's import block becomes (consolidate; do not leave mid-file imports):

```python
from dataclasses import dataclass

from accounts.enums import SellerType
from entitlements.consumption import ListingEntitlementRequired, consume_listing_right
from entitlements.eligibility import ListingEligibilityService
from entitlements.enums import EntitlementType
from entitlements.policy import enforcement_enabled, free_publication_days
from platform_settings.services import get_setting_value

from .enums import MediaType, PublicationSource
from .models import BoatListing, ListingMedia

__all__ = [
    "ConsumedRight",
    "ListingEntitlementGate",
    # Re-exported so listings.submissions has one import source for the gate.
    "ListingEntitlementRequired",
    "MediaAllowance",
    "effective_media_allowance",
    "media_counts",
    "requires_staff_approval",
]
```

(`get_setting_value` stays — `effective_media_allowance` still uses it.)

The docstring header becomes:

```python
"""Policy seams, and the entitlement gate.

  * ListingEntitlementGate    -> spec §22 (Phase 13) — IMPLEMENTED
  * requires_staff_approval   -> spec Phase 12 (§21, broker auto-approval) — stub
  * effective_media_allowance -> spec Phase 15 (§24, media upgrade tier) — stub
"""
```

Replace the whole `class ListingEntitlementGate:` block with:

```python
@dataclass(frozen=True)
class ConsumedRight:
    """What a submission actually burned.

    `entitlement` is None for a broker listing, whose quota is unlimited
    (spec §1) and which therefore has no ledger row at all.
    """

    entitlement: object | None
    publication_source: str


# The only mapping between the ledger's vocabulary (spec §11.9) and the
# listing's (spec §11.4). It lives here rather than in `entitlements` so that
# app never has to import `listings`.
_PUBLICATION_SOURCE_BY_TYPE = {
    EntitlementType.FREE_LISTING: PublicationSource.FREE_ENTITLEMENT,
    EntitlementType.PAID_LISTING: PublicationSource.PAID_ENTITLEMENT,
}


class ListingEntitlementGate:
    """Spec §22.2's ListingEligibilityService, seen from the listing side.

    Phase 11 shipped this class as a stub with its call sites already in place;
    this is the promised replacement (Phase 11 contract rule 6).

    `listings.decisions` is untouched: it calls `publication_days(*, listing)`,
    whose signature and return type are unchanged. `listings.submissions` DOES
    change, because `consume()`'s return type goes from `str` to `ConsumedRight`
    — a deliberate, documented deviation from Phase 11's "the call sites do not
    change" wording. See the Contract summary.
    """

    @staticmethod
    def can_submit(*, user, broker=None) -> bool:
        """A cheap, UNLOCKED pre-check: "could this user start a NEW listing?"

        Not authoritative — `consume()` re-checks while holding the lock, which
        is what spec §22.2 means by "The last check is authoritative and
        prevents multiple-tab races". This exists so an obviously-blocked
        submission fails before any row is written.

        It deliberately keeps Phase 11's signature and therefore knows nothing
        about *which* listing is being submitted. That means it answers the
        wrong question for a resubmission or a post-publication edit, both of
        which must never be charged or refused. The CALL SITE is responsible for
        only consulting it when a right would actually be charged — see
        listings.submissions.submit_listing_revision.
        """
        if broker is not None:
            # Spec §1: "Broker listing quota: Unlimited."
            return True
        if not enforcement_enabled():
            return True
        return ListingEligibilityService.for_user(user).can_start_listing

    @staticmethod
    def consume(*, listing: BoatListing, user) -> ConsumedRight:
        """Burn one right for this listing, or raise ListingEntitlementRequired.

        MUST be called inside the caller's transaction with the listing row
        already locked — listings.submissions.submit_listing_revision does both.

        Note the two different people: `user` is the ACTOR performing the
        submission (a staff admin may submit on a seller's behalf), while the
        quota that is charged belongs to `listing.owner_user`. Charging the
        actor would let a staff admin burn their own allowance on someone
        else's boat.

        Three cases never reach the ledger at all:
          * a broker listing (spec §1, unlimited quota);
          * an already-published listing (spec §6.3 charges "initial approval"
            only, and spec §20.2's post-publication edit goes through this same
            function);
          * a listing that already carries a consumed right — handled one layer
            down by `consume_listing_right`'s own idempotent short-circuit
            (spec §22.1's correction loop).
        """
        if listing.seller_type == SellerType.BROKER:
            return ConsumedRight(
                entitlement=None, publication_source=PublicationSource.BROKER_POLICY
            )
        if listing.current_public_snapshot_id is not None:
            # Spec §6.3: "Consumption happens when the listing is submitted for
            # initial approval." A listing with a live public snapshot is past
            # that point, so every later submission is a revision of something
            # already paid for.
            #
            # This check — not `consumed_entitlement_id` — is what protects
            # legacy data. Phase 11's Known Limitation 1 records that
            # `consumed_entitlement_id` is ALWAYS NULL on every listing
            # published before this phase, so gating on that column alone would
            # charge a brand-new free right for the first edit of any
            # pre-Phase-13 listing in dev, staging or production.
            #
            # `publication_source` is whatever the listing already carries and is
            # not rewritten; on the non-initial path `submit_listing_revision`
            # does not pass it to `bump_version` at all.
            return ConsumedRight(
                entitlement=listing.consumed_entitlement,
                publication_source=listing.publication_source,
            )
        entitlement = consume_listing_right(
            user=listing.owner_user, listing=listing, actor=user
        )
        return ConsumedRight(
            entitlement=entitlement,
            publication_source=_PUBLICATION_SOURCE_BY_TYPE[
                entitlement.entitlement_type
            ],
        )

    @staticmethod
    def publication_days(*, listing: BoatListing) -> int | None:
        """How long an approved publication stays live.

        Read from the CONSUMED entitlement, not from the live setting: this is
        called by listings.decisions.approve_revision, which can run days after
        submission, and spec §36.3 requires that "Existing consumed entitlements
        preserve their recorded publication duration."

        A broker listing has no configured window in this release (spec §21), so
        this returns None and `expires_at` stays NULL. A private listing with no
        consumed entitlement (one published before the ledger existed) falls
        back to the current free setting rather than to no expiry at all.
        """
        if listing.seller_type == SellerType.BROKER:
            return None
        entitlement = listing.consumed_entitlement
        if entitlement is not None:
            recorded = entitlement.metadata.get("publication_days")
            if isinstance(recorded, int) and recorded > 0:
                return recorded
        return free_publication_days()
```

- [ ] **Step 4: Wire consumption into `backend/listings/submissions.py`**

**Read this ruling before touching the code.** Phase 11's pre-check sits *above* `consume()`, so it runs before `consume()`'s own correct short-circuits and, unguarded, would become the real gate. `can_submit(*, user, broker=None)` is not told *which* listing is being submitted, so on its own it can only answer "could this user start a **new** listing?" — and once a seller's one free right is consumed that answer is `False` **forever**. Left as-is, this plan would break two flows that must never be charged and must never be refused:

1. **Resubmitting a withdrawn or rejected listing** (spec §22.1: *"A rejected submission can be corrected without consuming a second right"*) — the listing already carries `consumed_entitlement_id`, so `consume()` would correctly return the same row, but the pre-check above it would already have raised.
2. **Any post-publication edit of an already-PUBLISHED listing** (spec §20.2; `listings.drafts` opens the revision at `backend/listings/drafts.py` around lines 239-243) — it comes through this *same* `submit_listing_revision` path. That is a live Phase 11 flow, and breaking it would be a silent regression, not a new refusal.

**The ruling is to fix the call site, not the gate's signature.** `can_submit` keeps Phase 11's exact signature (which matters: Phase 12's plan edits an adjacent part of this same function), and `consume()` remains the ultimate authority. The pre-check becomes what its own docstring already claims it is — a cheap early exit for the common case.

Inside `submit_listing_revision`, replace this exact block:

```python
    if not ListingEntitlementGate.can_submit(user=actor, broker=listing.broker):
        # Unreachable in Phase 11 (the gate always allows); Phase 13 makes this
        # the `403 listing_entitlement_required` path of spec §22.4.
        raise InvalidWorkflowState(
            "You do not have a listing right available.",
            code="listing_entitlement_required",
        )
    publication_source = ListingEntitlementGate.consume(listing=listing, user=actor)

    is_initial = listing.current_public_snapshot_id is None
```

with:

```python
    # Moved up from below: the entitlement guard needs it. Same expression, same
    # meaning, and it is still the value the `if requires_staff_approval(...)`
    # block below reads.
    is_initial = listing.current_public_snapshot_id is None
    # Spec §6.3 charges a right when a listing is "submitted for initial
    # approval" — so only an initial submission that has not already been
    # charged can possibly need one. A post-publication revision (spec §20.2)
    # and a correction of a withdrawn/rejected submission (spec §22.1) are both
    # already paid for, and `can_submit()` — which is not told which listing
    # this is — would refuse both once the seller's free right is gone.
    charges_a_right = is_initial and listing.consumed_entitlement_id is None

    if charges_a_right and not ListingEntitlementGate.can_submit(
        user=actor, broker=listing.broker
    ):
        # Spec §22.4. 403, not the 409 Phase 11's placeholder used: this is an
        # authorization answer, not a stale-state answer, and it must match the
        # code and status the draft-creation gate returns.
        #
        # This is only an early exit. `consume()` re-checks the same thing under
        # a lock and is the authoritative answer (spec §22.2's "last check"), so
        # a `charges_a_right` that is wrongly True still cannot burn a second
        # right, and one that is wrongly False still cannot publish for free.
        raise ListingEntitlementRequired()
    # Authoritative: re-checks and consumes under a lock on the seller's own
    # row, inside this transaction (spec §22.4, and §22.2's "last check").
    consumed = ListingEntitlementGate.consume(listing=listing, user=actor)
    publication_source = consumed.publication_source
```

and add `ListingEntitlementRequired` to the existing `from .policies import (...)` block:

```python
from .policies import (
    ListingEntitlementGate,
    ListingEntitlementRequired,
    effective_media_allowance,
    media_counts,
    requires_staff_approval,
)
```

Then, in the **`is_initial` branch only** of the `if requires_staff_approval(listing):` block, add one keyword to the existing `bump_version` call:

```python
        if is_initial:
            bump_version(
                listing,
                expected_version=listing.version,
                resource="listing",
                status=ListingStatus.PENDING_APPROVAL,
                publication_source=publication_source,
                consumed_entitlement=consumed.entitlement,
                updated_by=actor,
            )
```

**Do not touch anything else in this function** — not the `else:` branch, not the `if requires_staff_approval(listing):` line, not the `uses_other_model` / `before` / `submitted_at` lines, not the audit call, not the signal block. The complete, commit-worthy diff to `submissions.py` is exactly four things: one import name added to the existing `from .policies import (...)` block; the 7-line entitlement block replaced; the existing `is_initial = ...` line moved three lines up (above that block, never into it); and one `consumed_entitlement=` keyword added to the `is_initial` branch's `bump_version`. Phase 12 adds an `else:` branch to that same `if`; these two diffs are disjoint by construction.

- [ ] **Step 5: Update the stub assertions in `backend/listings/tests/test_policies.py`**

Phase 11's `test_policies.py` asserts the stub behaviour (`can_submit` always True, `consume` returns a bare string). Open it and change exactly those assertions:
- the `can_submit` test keeps passing unchanged while the `individual_entitlements` flag is off, which is the default — add a one-line comment saying so rather than deleting the test.
- the `consume` test must now expect a `ConsumedRight`: for a broker listing assert `result.publication_source == PublicationSource.BROKER_POLICY` and `result.entitlement is None`; for a private listing assert `result.publication_source == PublicationSource.FREE_ENTITLEMENT` and `result.entitlement is not None`.
- the `publication_days` tests keep passing: a listing with no consumed entitlement still falls back to `individual.free_publish_days`, and a broker listing still returns `None`.

Do not delete any Phase 11 test. If one genuinely no longer describes the system, rewrite its body and keep its name and docstring so the intent stays traceable.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd backend && uv run pytest listings/tests/test_entitlement_enforcement.py listings/tests/test_policies.py -v`
Expected: PASS.

Run: `cd backend && uv run pytest -q`
Expected: full suite green, including `listings/tests/test_submit_withdraw.py` and `listings/tests/test_phase_acceptance.py` — with the flag off, Phase 11's behaviour is unchanged by construction, which is exactly what those suites prove.

- [ ] **Step 7: Commit**

```bash
git add backend/listings/policies.py backend/listings/submissions.py backend/listings/tests
git commit -m "feat(listings): consume a real entitlement inside the submit transaction"
```

---

### Task 9: `403 listing_entitlement_required` on draft creation

**Files:**
- Modify: `backend/listings/drafts.py` (two lines inside `create_listing_draft` plus two imports)
- Test: `backend/listings/tests/test_entitlement_enforcement.py` (append), `backend/entitlements/tests/test_consumption.py` (remove the `xfail` marker)

**Interfaces:**
- Consumes: `entitlements.consumption.ensure_can_start_listing` (Task 6); `accounts.enums.SellerType`.
- Produces: no new symbol. `POST /api/v1/listings/drafts/` now returns `403 listing_entitlement_required` when an individual seller has no right and the flag is on (spec §22.4).

- [ ] **Step 1: Write the failing test**

Append to `backend/listings/tests/test_entitlement_enforcement.py`:

```python
@pytest.mark.django_db
def test_draft_creation_is_refused_once_the_allowance_is_gone(
    api, workflow_enabled, entitlements_on
):
    """Spec §22.4: "POST /api/v1/listings/drafts/ returns
    403 listing_entitlement_required when no right exists"."""
    seller = make_private_seller()
    api.force_authenticate(seller)
    first = _fill_and_submit(api, _draft(api, brand=make_brand("Sealine")))
    assert first.status_code == 200, first.data

    brand = make_brand("Fairline")
    refused = api.post(
        reverse("listing-draft-create"),
        {
            "brand_id": str(brand.pk),
            "model_id": str(make_model(brand).pk),
            "manufacture_year": 2019,
        },
        format="json",
    )

    assert refused.status_code == 403
    assert refused.data["error"]["code"] == "listing_entitlement_required"
    assert refused.data["error"]["action"] == {
        "type": "PURCHASE",
        "product_code": "INDIVIDUAL_LISTING_RIGHT",
    }
    assert refused.data["error"]["meta"]["blocking_reason"] == "FREE_ALLOWANCE_USED"
    # Nothing was written: the refusal happens before the listing row.
    assert BoatListing.objects.filter(owner_user=seller).count() == 1


@pytest.mark.django_db
def test_draft_creation_is_allowed_again_once_a_paid_right_arrives(
    api, workflow_enabled, entitlements_on
):
    seller = make_private_seller()
    api.force_authenticate(seller)
    first = _fill_and_submit(api, _draft(api, brand=make_brand("Nimbus")))
    assert first.status_code == 200, first.data
    make_entitlement(
        user=seller,
        entitlement_type=EntitlementType.PAID_LISTING,
        source=EntitlementSource.STRIPE_PURCHASE,
        state=EntitlementState.AVAILABLE,
        valid_until=timezone.now() + timedelta(days=30),
    )

    created = _draft(api, brand=make_brand("Grand Banks"))

    assert created["status"] == ListingStatus.DRAFT


@pytest.mark.django_db
def test_a_broker_draft_is_never_gated(
    api, workflow_enabled, entitlements_on, broker_seller
):
    actor, broker, brand = broker_seller
    api.force_authenticate(actor)

    for year in (2019, 2020, 2021):
        response = api.post(
            reverse("listing-draft-create"),
            {
                "broker_id": str(broker.pk),
                "brand_id": str(brand.pk),
                "model_id": str(make_model(brand, f"Model {year}").pk),
                "manufacture_year": year,
            },
            format="json",
        )
        assert response.status_code == 201, response.data
    assert UserEntitlement.objects.count() == 0


@pytest.mark.django_db
def test_draft_creation_is_not_gated_while_the_flag_is_off(api, workflow_enabled):
    seller = make_private_seller()
    api.force_authenticate(seller)
    first = _fill_and_submit(api, _draft(api, brand=make_brand("Linssen")))
    assert first.status_code == 200, first.data

    created = _draft(api, brand=make_brand("Sirius"))

    assert created["status"] == ListingStatus.DRAFT
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && uv run pytest listings/tests/test_entitlement_enforcement.py -k draft_creation_is_refused -v`
Expected: FAIL — the draft is created (201) instead of refused (403).

- [ ] **Step 3: Add the gate to `backend/listings/drafts.py`**

Add two names to the module's existing import block, beside the `resolve_seller_context` import that is already there:

```python
from accounts.enums import SellerType
from accounts.services import resolve_seller_context
from entitlements.consumption import ensure_can_start_listing
```

Then, inside `create_listing_draft`, insert the gate immediately after the `resolve_seller_context` call and before the `BoatListing(...)` construction:

```python
@transaction.atomic
def create_listing_draft(*, actor, broker_id=None, payload: dict) -> BoatListing:
    context = resolve_seller_context(actor, broker_id=broker_id)

    # Spec §22.4: an individual seller with no listing right cannot even open a
    # draft. Broker quota is unlimited (spec §1), so brokers skip this. The
    # check is advisory — nothing is reserved or consumed here (spec §6.3:
    # "Consumption happens when the listing is submitted for initial approval,
    # not when the create form first opens") — and the authoritative one runs
    # under a lock inside submit_listing_revision.
    if context.seller_type == SellerType.PRIVATE:
        ensure_can_start_listing(context.owner_user)

    listing = BoatListing(
```

Nothing else in `drafts.py` changes — not `update_listing_draft`, not `_apply_payload_to_listing`, not `_resolve_taxonomy`, not `open_revision_for`, not `payload_from_snapshot`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && uv run pytest listings/tests/test_entitlement_enforcement.py -v`
Expected: PASS (13 tests — Task 8's nine plus the four appended here).

- [ ] **Step 5: Un-`xfail` the envelope test**

Delete the `@pytest.mark.xfail(...)` marker added in Task 6 Step 1 from `test_the_error_envelope_carries_the_spec_30_2_action_block` in `backend/entitlements/tests/test_consumption.py`.

Run: `cd backend && uv run pytest entitlements/tests/test_consumption.py -v`
Expected: PASS with no xfail and no xpass.

Run: `cd backend && uv run pytest -q`
Expected: full suite green.

- [ ] **Step 6: Commit**

```bash
git add backend/listings/drafts.py backend/listings/tests/test_entitlement_enforcement.py backend/entitlements/tests/test_consumption.py
git commit -m "feat(listings): gate draft creation on an available listing right"
```

---

### Task 10: The daily expiry sweep

**Files:**
- Create: `backend/listings/expiry.py`, `backend/listings/tasks.py`, `backend/listings/tests/test_expiry.py`
- Modify: `backend/listings/signals.py` (append two signals), `backend/conftest.py` (append the `published_listing_with_snapshot` fixture — the **repo test root**, because Task 14 uses it from `entitlements/tests/`), `backend/config/settings/base.py` (task routes + beat schedule)

**Interfaces:**
- Consumes: `listings.models.BoatListing`; `listings.enums.{ListingStatus, can_transition_listing}`; `listings.locking.bump_version`; `audit.services.record_audit_event`.
- Produces:
  - `listings.signals.listing_expired` — `Signal`, sent with `sender=BoatListing, listing=<BoatListing>`
  - `listings.signals.listing_expiring` — `Signal`, sent with `sender=BoatListing, listing=<BoatListing>, threshold_days=<int>` (used by Task 11)
  - `listings.expiry.EXPIRY_REMINDER_DAYS: tuple[int, ...] = (7, 1)`
  - `listings.expiry.due_listings_queryset(now: datetime) -> QuerySet[BoatListing]`
  - `listings.expiry.expire_listing(*, listing_id, now: datetime) -> bool`
  - `listings.expiry.expire_due_listings(*, now=None) -> int`
  - `listings.tasks.expire_due_listings()` — Celery `shared_task(queue="maintenance")`, returns the count

- [ ] **Step 1: Write the failing test**

`backend/listings/tests/test_expiry.py`:

```python
"""Spec §22.5's daily expiry task."""

from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from audit.models import AuditEvent
from entitlements.tests.factories import make_private_seller
from listings.enums import ListingStatus
from listings.expiry import expire_due_listings
from listings.models import BoatListing
from listings.signals import listing_expired
from listings.tests.factories import make_private_listing


def _published(owner, *, expires_in_days):
    now = timezone.now()
    return make_private_listing(
        owner=owner,
        status=ListingStatus.PUBLISHED,
        published_at=now - timedelta(days=1),
        expires_at=now + timedelta(days=expires_in_days),
    )


@pytest.mark.django_db
def test_a_due_listing_becomes_expired():
    due = _published(make_private_seller(), expires_in_days=-1)

    assert expire_due_listings() == 1

    due.refresh_from_db()
    assert due.status == ListingStatus.EXPIRED


@pytest.mark.django_db
def test_a_listing_that_is_not_due_yet_is_untouched():
    future = _published(make_private_seller(), expires_in_days=5)
    version_before = future.version

    assert expire_due_listings() == 0

    future.refresh_from_db()
    assert future.status == ListingStatus.PUBLISHED
    assert future.version == version_before


@pytest.mark.django_db
def test_a_listing_with_no_expiry_is_never_expired():
    """Broker listings have no configured window in this release (spec §21), so
    `expires_at` is NULL and must not be read as "already due"."""
    forever = make_private_listing(
        owner=make_private_seller(), status=ListingStatus.PUBLISHED, expires_at=None
    )

    assert expire_due_listings() == 0

    forever.refresh_from_db()
    assert forever.status == ListingStatus.PUBLISHED


@pytest.mark.django_db
def test_only_published_listings_expire():
    """Spec §6.1 has no SUSPENDED -> EXPIRED edge, and an EXPIRED listing must
    not be expired twice."""
    owner = make_private_seller()
    now = timezone.now()
    suspended = make_private_listing(
        owner=owner, status=ListingStatus.SUSPENDED, expires_at=now - timedelta(days=2)
    )
    already = make_private_listing(
        owner=owner, status=ListingStatus.EXPIRED, expires_at=now - timedelta(days=2)
    )

    assert expire_due_listings() == 0

    suspended.refresh_from_db()
    already.refresh_from_db()
    assert suspended.status == ListingStatus.SUSPENDED
    assert already.status == ListingStatus.EXPIRED


@pytest.mark.django_db
def test_expiry_is_idempotent_across_two_runs():
    _published(make_private_seller(), expires_in_days=-1)

    assert expire_due_listings() == 1
    assert expire_due_listings() == 0
    assert AuditEvent.objects.filter(action="listing.expired").count() == 1


@pytest.mark.django_db
def test_expiry_writes_a_system_audit_event():
    due = _published(make_private_seller(), expires_in_days=-1)

    expire_due_listings()

    event = AuditEvent.objects.get(action="listing.expired")
    assert event.target_id == str(due.pk)
    assert event.actor_user is None
    assert event.actor_type == AuditEvent.ActorType.SYSTEM
    assert event.source == AuditEvent.Source.TASK
    assert event.before["listing_status"] == ListingStatus.PUBLISHED
    assert event.after["listing_status"] == ListingStatus.EXPIRED


@pytest.mark.django_db(transaction=True)
def test_the_expired_signal_fires_after_commit():
    due = _published(make_private_seller(), expires_in_days=-1)
    received = []

    def _receiver(sender, listing, **kwargs):
        received.append(listing.pk)

    listing_expired.connect(_receiver)
    try:
        expire_due_listings()
    finally:
        listing_expired.disconnect(_receiver)

    assert received == [due.pk]


@pytest.mark.django_db
def test_an_expired_listing_disappears_from_the_public_api(
    published_listing_with_snapshot,
):
    """Spec §22.5: expired listings are "removed from public search/sitemap" —
    which listings.views.published_listings_queryset already implements, because
    it filters on status=PUBLISHED. This proves it end to end rather than
    re-deriving the filter (Phase 11 contract rule 1)."""
    listing = published_listing_with_snapshot
    api = APIClient()
    detail = reverse("listing-detail", kwargs={"listing_id": listing.pk})
    assert api.get(detail).status_code == 200
    assert api.get(reverse("listing-list")).data["count"] == 1

    BoatListing.objects.filter(pk=listing.pk).update(
        expires_at=timezone.now() - timedelta(minutes=1)
    )
    expire_due_listings()

    assert api.get(detail).status_code == 404
    assert api.get(reverse("listing-list")).data["count"] == 0
```

Add a `published_listing_with_snapshot` fixture to **`backend/conftest.py`** — the repo-wide test root, *not* `backend/listings/tests/conftest.py`.

**Why the root conftest:** pytest only makes a `conftest.py` fixture visible inside its own directory subtree. This fixture is consumed from two different Django apps' test packages — `backend/listings/tests/test_expiry.py` (this task) and `backend/entitlements/tests/test_phase_acceptance.py` (Task 14's `test_done_4_...`) — so a `listings/tests/`-local definition would simply not resolve for the second one and Task 14 would error at collection with `fixture 'published_listing_with_snapshot' not found`. `backend/conftest.py` today holds only the autouse `clear_redis_cache` fixture; this is an **append**, and that fixture is untouched.

**What the body does — and two corrections to earlier drafts of this plan, both verified against the real code:**
- `ListingSnapshot.save()` (`backend/listings/models.py`, around line 361) does **not** refuse hand-construction. It refuses only a **re-save of an existing row**: `if not self._state.adding: raise ValueError("ListingSnapshot rows are immutable once created.")`. A fresh insert is perfectly legal, and `listings.tests.factories.make_snapshot` does exactly that.
- `listings/tests/test_public_read_api.py`'s `_published()` helper does **not** drive the real workflow. It hand-constructs the snapshot via `make_snapshot(...)` and assigns `listing.current_public_snapshot` directly. It also takes `**snapshot_kwargs` and returns a `(listing, snapshot)` **tuple**, which its ~30 call sites in that module depend on.

So: **mirror `_published()`'s construction, but return the listing alone**, and leave `test_public_read_api.py` completely untouched (it is not in this plan's footprint). Every consumer of this fixture treats it as a single `BoatListing`; the snapshot is reachable as `listing.current_public_snapshot`. Hand-construction is also the right choice on its own merits here: driving draft → submit → approve would make every consumer of this fixture depend on the `listing_revisions` feature flag being enabled, which Task 14's `both_flags_on` supplies but Task 10's expiry tests do not.

Append to `backend/conftest.py`:

```python
@pytest.fixture
def published_listing_with_snapshot(db):
    """A PUBLISHED listing with one READY photo and a live public snapshot.

    Defined here, at the repo test root, because it is used from BOTH
    listings/tests/ and entitlements/tests/ — a conftest fixture is only visible
    inside its own directory subtree.

    Mirrors listings/tests/test_public_read_api.py's `_published()` helper, which
    stays where it is (it returns a tuple and takes snapshot kwargs that its own
    module needs). Returns the listing alone; the snapshot is
    `listing.current_public_snapshot`.
    """
    from uuid import uuid4

    from django.utils import timezone

    from accounts.enums import UserRole
    from accounts.tests.factories import make_user
    from listings.enums import ListingStatus, MediaStatus, MediaType
    from listings.tests.factories import make_media, make_private_listing, make_snapshot

    suffix = uuid4().hex[:8]
    owner = make_user(
        f"published-owner-{suffix}@example.com",
        role=UserRole.PRIVATE_SELLER,
        verified=True,
    )
    moderator = make_user(
        f"published-moderator-{suffix}@example.com",
        role=UserRole.STAFF,
        verified=True,
    )
    listing = make_private_listing(owner=owner, status=ListingStatus.PUBLISHED)
    image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY)
    snapshot = make_snapshot(
        listing,
        approved_by=moderator,
        media_manifest=[
            {
                "media_id": str(image.pk),
                "media_type": image.media_type,
                "storage_key": image.storage_key,
                "mime_type": image.mime_type,
                "sort_order": image.sort_order,
                "width": image.width,
                "height": image.height,
                "duration_seconds": image.duration_seconds,
                "checksum_sha256": image.checksum_sha256,
            }
        ],
    )
    listing.current_public_snapshot = snapshot
    listing.published_at = timezone.now()
    listing.save(update_fields=["current_public_snapshot", "published_at"])
    return listing
```

The imports live inside the function body deliberately: `backend/conftest.py` is loaded before Django's app registry is populated, so a module-level `from listings.models import ...` there would raise `AppRegistryNotReady`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && uv run pytest listings/tests/test_expiry.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'listings.expiry'`.

- [ ] **Step 3: Append the two signals to `backend/listings/signals.py`**

At the end of the file, append:

```python
# Spec §27.1's `listing.expiring` and `listing.expired`, fired by
# listings.expiry. `listing_expiring` carries `threshold_days` so Phase 18 can
# build §27.1's "listing + threshold" deduplication key; `listing_expired`
# carries only the listing, whose `expires_at` is §27.1's "listing + expiry"
# key. Both are sent with sender=listings.models.BoatListing and the keyword
# argument `listing`.
listing_expiring = django.dispatch.Signal()
listing_expired = django.dispatch.Signal()
```

and extend the module docstring's closing paragraph to name these two alongside `listing_published` as the signals sent with `sender=BoatListing`. Nothing existing is renamed or removed.

- [ ] **Step 4: Write `backend/listings/expiry.py`**

```python
"""Publication expiry (spec §22.5).

This lives in `listings`, not in `entitlements`, because expiry is a listing
state change: Phase 11 contract rule 2 says `BoatListing.status` is written only
by a service that holds the transaction, the row lock, the optimistic-locking
compare-and-swap and the audit event together, and this is such a service.
"""

from datetime import datetime

from django.db import transaction
from django.db.models import QuerySet
from django.utils import timezone

from audit.models import AuditEvent
from audit.services import record_audit_event

from .enums import ListingStatus, can_transition_listing
from .locking import bump_version
from .models import BoatListing
from .signals import listing_expired

# Spec §22.5: "Default reminders: 7 days and 1 day before expiration."
# A module constant rather than a platform setting: spec §10.1's registry — the
# closed list of typed settings — defines no reminder key, and inventing one
# would put an unvalidated value in a registry whose purpose is validation.
EXPIRY_REMINDER_DAYS: tuple[int, ...] = (7, 1)


def due_listings_queryset(now: datetime) -> QuerySet[BoatListing]:
    """Published listings whose window has closed.

    `expires_at__isnull=False` is not redundant with the `__lte` filter for a
    reader's benefit: it states the rule. A broker listing has no configured
    window in this release (spec §21) and carries NULL, which must never be
    read as "already due".
    """
    return BoatListing.objects.filter(
        status=ListingStatus.PUBLISHED,
        expires_at__isnull=False,
        expires_at__lte=now,
    ).order_by("expires_at")


@transaction.atomic
def expire_listing(*, listing_id, now: datetime) -> bool:
    """Move one listing to EXPIRED. Returns True if it moved.

    Every precondition is re-checked under the lock, so two overlapping runs of
    the daily task cannot both expire the same row and write two audit events.
    """
    listing = BoatListing.objects.select_for_update().get(pk=listing_id)
    if (
        listing.status != ListingStatus.PUBLISHED
        or listing.expires_at is None
        or listing.expires_at > now
    ):
        return False
    if not can_transition_listing(listing.status, ListingStatus.EXPIRED):
        return False

    before = {"listing_status": listing.status}
    bump_version(
        listing,
        expected_version=listing.version,
        resource="listing",
        status=ListingStatus.EXPIRED,
    )
    record_audit_event(
        actor_user=None,
        actor_type=AuditEvent.ActorType.SYSTEM,
        action="listing.expired",
        target_type="listings.BoatListing",
        target_id=str(listing.pk),
        source=AuditEvent.Source.TASK,
        before=before,
        after={"listing_status": ListingStatus.EXPIRED},
        metadata={
            "expires_at": listing.expires_at,
            "published_at": listing.published_at,
            "owner_user_id": (
                str(listing.owner_user_id) if listing.owner_user_id else None
            ),
        },
    )
    transaction.on_commit(
        lambda: listing_expired.send(sender=BoatListing, listing=listing)
    )
    return True


def expire_due_listings(*, now: datetime | None = None) -> int:
    """Spec §22.5's daily sweep. Returns how many listings moved.

    One transaction per listing, not one for the whole sweep: a single failing
    row must not roll back every other expiry, and one long transaction would
    hold locks across the entire published catalogue.
    """
    now = now or timezone.now()
    listing_ids = list(due_listings_queryset(now).values_list("pk", flat=True))
    return sum(
        1
        for listing_id in listing_ids
        if expire_listing(listing_id=listing_id, now=now)
    )
```

Note what is deliberately **not** here: nothing removes the listing from public search or the sitemap, because nothing has to. `listings.views.published_listings_queryset()` filters on `status=PUBLISHED`, so an EXPIRED listing falls out of both public endpoints the moment its status changes — and Phase 11 contract rule 1 forbids re-deriving that filter anywhere else. The last test above proves it end to end.

Equally deliberately absent: any change to owner access. Spec §22.5 requires expiry to "preserve dashboard access", and it does — `listings.drafts.update_listing_draft` already refuses to open a *new edit cycle* on an EXPIRED listing (Phase 11's own rule, so that the moderation queue never holds work it cannot approve), while every read path an owner uses is untouched.

- [ ] **Step 5: Write `backend/listings/tasks.py`**

```python
"""Celery entry points for the listing lifecycle (spec §22.5).

Thin wrappers only: every rule lives in listings.expiry so the same code runs
from a task, a management shell and a test (spec §3: "No business rule should
live only in a view, template, serializer or JavaScript handler").
"""

import logging

from celery import shared_task

from .expiry import expire_due_listings as _expire_due_listings

logger = logging.getLogger(__name__)


@shared_task(queue="maintenance")
def expire_due_listings() -> int:
    count = _expire_due_listings()
    logger.info("listing expiry sweep complete", extra={"expired_count": count})
    return count
```

- [ ] **Step 6: Declare the schedule in `backend/config/settings/base.py`**

Append two entries to the existing `CELERY_TASK_ROUTES` dict (do not rewrite it):

```python
CELERY_TASK_ROUTES = {
    "common.tasks.*": {"queue": "default"},
    "accounts.tasks.*": {"queue": "notifications"},
    "listings.tasks.*": {"queue": "maintenance"},
    "entitlements.tasks.*": {"queue": "maintenance"},
}
```

Add `from celery.schedules import crontab` to the module's import section beside the existing `from kombu import Queue`, and add a new block immediately below `CELERY_TASK_ROUTES`:

```python
# Spec §22.5's "daily task". Times are UTC and staggered so the expiry sweep
# finishes before the reminder pass reads `expires_at`.
CELERY_BEAT_SCHEDULE = {
    "expire-due-listings": {
        "task": "listings.tasks.expire_due_listings",
        "schedule": crontab(hour=3, minute=0),
    },
    "send-listing-expiry-reminders": {
        "task": "listings.tasks.send_listing_expiry_reminders",
        "schedule": crontab(hour=3, minute=15),
    },
    "sweep-entitlement-ledger": {
        "task": "entitlements.tasks.sweep_entitlement_ledger",
        "schedule": crontab(hour=3, minute=30),
    },
}
```

The two tasks named here that do not exist yet land in Tasks 11 and 12. Declaring all three now keeps the schedule in one reviewable block; a `celery beat` process started before those tasks exist would log an unregistered-task error, which is why the deployment note in Task 14 says beat is enabled only after the whole phase merges.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `cd backend && uv run pytest listings/tests/test_expiry.py -v`
Expected: PASS (8 tests).

Run: `cd backend && uv run python manage.py check`
Expected: `System check identified no issues`.

Run: `cd backend && uv run pytest listings/tests/test_public_read_api.py -q`
Expected: PASS, unchanged (the conftest helper move must not alter its behaviour).

- [ ] **Step 8: Commit**

```bash
git add backend/listings/expiry.py backend/listings/tasks.py backend/listings/signals.py backend/listings/tests backend/conftest.py backend/config/settings/base.py
git commit -m "feat(listings): daily expiry sweep per spec 22.5"
```

---

### Task 11: Expiry reminders at 7 days and 1 day

**Files:**
- Modify: `backend/listings/expiry.py` (append), `backend/listings/tasks.py` (append), `backend/listings/tests/test_expiry.py` (append)

**Interfaces:**
- Consumes: `listings.expiry.EXPIRY_REMINDER_DAYS`, `listings.signals.listing_expiring` (Task 10).
- Produces:
  - `listings.expiry.REMINDER_WINDOW: timedelta`
  - `listings.expiry.listings_reaching_threshold(*, threshold_days: int, now: datetime) -> QuerySet[BoatListing]`
  - `listings.expiry.send_expiry_reminders(*, now=None) -> dict[int, int]` — `{threshold_days: count}`
  - `listings.tasks.send_listing_expiry_reminders()` — Celery `shared_task(queue="maintenance")`

- [ ] **Step 1: Write the failing test**

Append to `backend/listings/tests/test_expiry.py` (and add `EXPIRY_REMINDER_DAYS`, `send_expiry_reminders` to its existing `from listings.expiry import ...` line, and `listing_expiring` to its `from listings.signals import ...` line):

```python
@pytest.fixture
def expiring_receiver():
    received = []

    def _receiver(sender, listing, threshold_days, **kwargs):
        received.append((listing.pk, threshold_days))

    listing_expiring.connect(_receiver)
    yield received
    listing_expiring.disconnect(_receiver)


def test_the_default_thresholds_are_the_spec_22_5_defaults():
    assert EXPIRY_REMINDER_DAYS == (7, 1)


@pytest.mark.django_db
def test_a_listing_seven_days_out_gets_one_reminder(expiring_receiver):
    now = timezone.now()
    soon = make_private_listing(
        owner=make_private_seller(),
        status=ListingStatus.PUBLISHED,
        expires_at=now + timedelta(days=6, hours=12),
    )

    assert send_expiry_reminders(now=now) == {7: 1, 1: 0}
    assert expiring_receiver == [(soon.pk, 7)]


@pytest.mark.django_db
def test_a_listing_one_day_out_gets_the_one_day_reminder(expiring_receiver):
    now = timezone.now()
    soon = make_private_listing(
        owner=make_private_seller(),
        status=ListingStatus.PUBLISHED,
        expires_at=now + timedelta(hours=10),
    )

    assert send_expiry_reminders(now=now) == {7: 0, 1: 1}
    assert expiring_receiver == [(soon.pk, 1)]


@pytest.mark.django_db
def test_a_daily_cadence_fires_each_threshold_at_most_once(expiring_receiver):
    """Spec §27.1's deduplication key is "listing + threshold". With no
    Notification table yet (Phase 18), the window arithmetic is what keeps a
    daily run from re-firing the same reminder: each threshold's window is
    exactly one day wide, half-open, and the two do not overlap."""
    now = timezone.now()
    listing = make_private_listing(
        owner=make_private_seller(),
        status=ListingStatus.PUBLISHED,
        expires_at=now + timedelta(days=9, hours=1),
    )

    for day in range(10):
        send_expiry_reminders(now=now + timedelta(days=day))

    fired = [threshold for pk, threshold in expiring_receiver if pk == listing.pk]
    assert sorted(fired) == [1, 7]


@pytest.mark.django_db
def test_a_listing_that_is_not_published_is_never_reminded(expiring_receiver):
    owner = make_private_seller()
    now = timezone.now()
    make_private_listing(
        owner=owner,
        status=ListingStatus.SUSPENDED,
        expires_at=now + timedelta(days=6, hours=12),
    )
    make_private_listing(owner=owner, status=ListingStatus.PUBLISHED, expires_at=None)

    assert send_expiry_reminders(now=now) == {7: 0, 1: 0}
    assert expiring_receiver == []


@pytest.mark.django_db
def test_an_already_due_listing_is_expired_not_reminded(expiring_receiver):
    now = timezone.now()
    make_private_listing(
        owner=make_private_seller(),
        status=ListingStatus.PUBLISHED,
        expires_at=now - timedelta(hours=1),
    )

    assert send_expiry_reminders(now=now) == {7: 0, 1: 0}
    assert expiring_receiver == []
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && uv run pytest listings/tests/test_expiry.py -k reminder -v`
Expected: FAIL — `ImportError: cannot import name 'send_expiry_reminders' from 'listings.expiry'`.

- [ ] **Step 3: Append to `backend/listings/expiry.py`**

Extend the existing imports at the top of the module — `from datetime import datetime, timedelta` and `from .signals import listing_expired, listing_expiring` — then append:

```python
# One day wide, matching the task's daily cadence. A listing is reminded at
# threshold D on the single run whose `now` falls inside
# [expires_at - D days, expires_at - (D - 1) days).
REMINDER_WINDOW = timedelta(days=1)


def listings_reaching_threshold(
    *, threshold_days: int, now: datetime
) -> QuerySet[BoatListing]:
    """Published listings that cross `threshold_days` remaining on this run.

    The window is half-open — `[lower, upper)` — so two adjacent thresholds can
    never both match the same listing on the same run, a listing is never
    reminded twice for one threshold by a daily schedule, and a listing whose
    window has already closed is not caught up retroactively.
    """
    upper = now + timedelta(days=threshold_days)
    lower = upper - REMINDER_WINDOW
    return BoatListing.objects.filter(
        status=ListingStatus.PUBLISHED,
        expires_at__isnull=False,
        expires_at__gte=lower,
        expires_at__lt=upper,
    ).order_by("expires_at")


def send_expiry_reminders(*, now: datetime | None = None) -> dict[int, int]:
    """Spec §22.5: "notifies owner before ... expiry".

    Fires `listings.signals.listing_expiring` once per listing per threshold.
    Phase 18 (spec §27) attaches the receivers that turn that into an in-app row
    and an email; this phase owns the *when*, not the *how* — exactly as Phase
    11 left its eight workflow signals without receivers.

    No transaction and no database write: a reminder changes nothing. That is
    also why the signal is sent directly rather than through
    `transaction.on_commit()` — there is no commit for it to wait on.
    """
    now = now or timezone.now()
    counts: dict[int, int] = {}
    for threshold_days in EXPIRY_REMINDER_DAYS:
        listings = list(
            listings_reaching_threshold(threshold_days=threshold_days, now=now)
        )
        for listing in listings:
            listing_expiring.send(
                sender=BoatListing, listing=listing, threshold_days=threshold_days
            )
        counts[threshold_days] = len(listings)
    return counts
```

- [ ] **Step 4: Append to `backend/listings/tasks.py`**

Extend the existing import to `from .expiry import expire_due_listings as _expire_due_listings, send_expiry_reminders as _send_expiry_reminders`, then append:

```python
@shared_task(queue="maintenance")
def send_listing_expiry_reminders() -> dict:
    counts = _send_expiry_reminders()
    logger.info("listing expiry reminders sent", extra={"counts": counts})
    # Celery serialises the result as JSON, which would turn the int keys into
    # strings anyway; doing it here makes the stored result shape explicit.
    return {str(threshold): count for threshold, count in counts.items()}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd backend && uv run pytest listings/tests/test_expiry.py -v`
Expected: PASS (14 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/listings/expiry.py backend/listings/tasks.py backend/listings/tests/test_expiry.py
git commit -m "feat(listings): 7-day and 1-day expiry reminders per spec 22.5"
```

---

### Task 12: Ledger maintenance — expiring unused rights and releasing stale reservations

**Files:**
- Create: `backend/entitlements/services.py`, `backend/entitlements/tasks.py`, `backend/entitlements/tests/test_ledger_maintenance.py`

**Interfaces:**
- Consumes: `entitlements.models.UserEntitlement` (Task 2); `entitlements.enums.{EntitlementState, RESERVATION_TIMEOUT_MINUTES, can_transition_entitlement}` (Task 1); `audit.services.record_audit_event`.
- Produces:
  - `entitlements.services.expire_due_entitlements(*, now=None) -> int`
  - `entitlements.services.release_stale_reservations(*, now=None) -> int`
  - `entitlements.services.release_reservation(*, entitlement, actor, reason) -> UserEntitlement`
  - `entitlements.services.InvalidEntitlementState(APIException)` — 409, `default_code = "invalid_entitlement_state"`
  - `entitlements.tasks.sweep_entitlement_ledger()` — Celery `shared_task(queue="maintenance")`, returns `{"expired": int, "released": int}`

- [ ] **Step 1: Write the failing test**

`backend/entitlements/tests/test_ledger_maintenance.py`:

```python
"""Spec §6.3's two time-driven transitions:
  AVAILABLE -> EXPIRED
  RESERVED  -> AVAILABLE (creation cancelled or timed out)
"""

from datetime import timedelta

import pytest
from django.utils import timezone

from audit.models import AuditEvent
from entitlements.enums import EntitlementSource, EntitlementState, EntitlementType
from entitlements.services import (
    InvalidEntitlementState,
    expire_due_entitlements,
    release_reservation,
    release_stale_reservations,
)
from entitlements.tasks import sweep_entitlement_ledger
from entitlements.tests.factories import make_entitlement, make_private_seller
from listings.tests.factories import make_private_listing


@pytest.mark.django_db
def test_an_unused_right_past_its_validity_expires():
    user = make_private_seller()
    now = timezone.now()
    stale = make_entitlement(
        user=user,
        entitlement_type=EntitlementType.PAID_LISTING,
        source=EntitlementSource.STRIPE_PURCHASE,
        state=EntitlementState.AVAILABLE,
        valid_from=now - timedelta(days=400),
        valid_until=now - timedelta(days=1),
    )

    assert expire_due_entitlements(now=now) == 1

    stale.refresh_from_db()
    assert stale.state == EntitlementState.EXPIRED


@pytest.mark.django_db
def test_a_right_still_inside_its_window_is_untouched():
    user = make_private_seller()
    now = timezone.now()
    live = make_entitlement(
        user=user,
        entitlement_type=EntitlementType.PAID_LISTING,
        state=EntitlementState.AVAILABLE,
        valid_until=now + timedelta(days=1),
    )

    assert expire_due_entitlements(now=now) == 0

    live.refresh_from_db()
    assert live.state == EntitlementState.AVAILABLE


@pytest.mark.django_db
def test_consumed_reserved_and_revoked_rows_are_never_expired():
    """Spec §6.3 has exactly one inbound edge to EXPIRED, from AVAILABLE."""
    user = make_private_seller()
    now = timezone.now()
    past = {"valid_from": now - timedelta(days=400), "valid_until": now - timedelta(days=1)}
    consumed = make_entitlement(
        user=user, state=EntitlementState.CONSUMED, consumed_at=now, **past
    )
    reserved = make_entitlement(
        user=user, state=EntitlementState.RESERVED, reserved_at=now, **past
    )
    revoked = make_entitlement(
        user=user, state=EntitlementState.REVOKED, revoked_at=now, **past
    )

    assert expire_due_entitlements(now=now) == 0

    for row in (consumed, reserved, revoked):
        row.refresh_from_db()
    assert consumed.state == EntitlementState.CONSUMED
    assert reserved.state == EntitlementState.RESERVED
    assert revoked.state == EntitlementState.REVOKED


@pytest.mark.django_db
def test_expiry_writes_a_system_audit_event_and_is_idempotent():
    user = make_private_seller()
    now = timezone.now()
    make_entitlement(
        user=user,
        state=EntitlementState.AVAILABLE,
        valid_from=now - timedelta(days=400),
        valid_until=now - timedelta(days=1),
    )

    assert expire_due_entitlements(now=now) == 1
    assert expire_due_entitlements(now=now) == 0

    event = AuditEvent.objects.get(action="entitlement.expired")
    assert event.actor_user is None
    assert event.actor_type == AuditEvent.ActorType.SYSTEM
    assert event.source == AuditEvent.Source.TASK
    assert event.before["state"] == EntitlementState.AVAILABLE
    assert event.after["state"] == EntitlementState.EXPIRED


@pytest.mark.django_db
def test_an_unattached_reservation_older_than_thirty_minutes_is_released():
    """Spec §6.3: "Reservations expire after 30 minutes unless attached to a
    saved draft"."""
    user = make_private_seller()
    now = timezone.now()
    stale = make_entitlement(
        user=user,
        entitlement_type=EntitlementType.PAID_LISTING,
        state=EntitlementState.RESERVED,
        reserved_at=now - timedelta(minutes=31),
        valid_until=now + timedelta(days=100),
    )

    assert release_stale_reservations(now=now) == 1

    stale.refresh_from_db()
    assert stale.state == EntitlementState.AVAILABLE
    assert stale.reserved_at is None


@pytest.mark.django_db
def test_a_fresh_reservation_is_left_alone():
    user = make_private_seller()
    now = timezone.now()
    fresh = make_entitlement(
        user=user,
        state=EntitlementState.RESERVED,
        reserved_at=now - timedelta(minutes=5),
        valid_until=now + timedelta(days=100),
    )

    assert release_stale_reservations(now=now) == 0

    fresh.refresh_from_db()
    assert fresh.state == EntitlementState.RESERVED


@pytest.mark.django_db
def test_a_reservation_attached_to_a_listing_is_never_timed_out():
    """Spec §6.3's "unless attached to a saved draft"."""
    user = make_private_seller()
    now = timezone.now()
    attached = make_entitlement(
        user=user,
        listing=make_private_listing(owner=user),
        state=EntitlementState.RESERVED,
        reserved_at=now - timedelta(days=3),
        valid_until=now + timedelta(days=100),
    )

    assert release_stale_reservations(now=now) == 0

    attached.refresh_from_db()
    assert attached.state == EntitlementState.RESERVED


@pytest.mark.django_db
def test_releasing_a_row_that_is_not_reserved_is_refused():
    user = make_private_seller()
    consumed = make_entitlement(
        user=user, state=EntitlementState.CONSUMED, consumed_at=timezone.now()
    )

    with pytest.raises(InvalidEntitlementState) as excinfo:
        release_reservation(entitlement=consumed, actor=None, reason="mistake")

    assert excinfo.value.status_code == 409
    assert excinfo.value.get_codes() == "invalid_entitlement_state"


@pytest.mark.django_db
def test_the_sweep_task_runs_both_passes():
    user = make_private_seller()
    now = timezone.now()
    make_entitlement(
        user=user,
        state=EntitlementState.AVAILABLE,
        valid_from=now - timedelta(days=400),
        valid_until=now - timedelta(days=1),
    )
    make_entitlement(
        user=user,
        state=EntitlementState.RESERVED,
        reserved_at=now - timedelta(hours=2),
        valid_until=now + timedelta(days=100),
    )

    assert sweep_entitlement_ledger() == {"expired": 1, "released": 1}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && uv run pytest entitlements/tests/test_ledger_maintenance.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'entitlements.services'`.

- [ ] **Step 3: Write `backend/entitlements/services.py`**

```python
"""Ledger lifecycle services (spec §6.3, §26.3, §36.3).

Every function here is the single sanctioned writer of the transition it
performs: it holds the transaction, locks the row, checks the spec §6.3 edge
and records the audit event. Django admin, Celery tasks and (from Phase 17) the
staff API all call these rather than touching `state` directly.
"""

from datetime import datetime, timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import APIException

from audit.models import AuditEvent
from audit.services import record_audit_event

from .enums import (
    RESERVATION_TIMEOUT_MINUTES,
    EntitlementState,
    can_transition_entitlement,
)
from .models import UserEntitlement


class InvalidEntitlementState(APIException):
    """A well-formed request against a ledger row in the wrong state.

    409, mirroring listings.drafts.InvalidWorkflowState: the caller is not
    unauthorized, the record simply moved (or never was where they thought).
    """

    status_code = status.HTTP_409_CONFLICT
    default_detail = "This entitlement is not in a state that allows that change."
    default_code = "invalid_entitlement_state"

    def __init__(self, detail=None, *, current_state: str | None = None):
        super().__init__(detail=detail or self.default_detail, code=self.default_code)
        if current_state:
            # Copied into the envelope by common.exceptions.nauta_exception_handler.
            self.meta = {"resource": "entitlement", "current_state": current_state}


def _audit(*, entitlement, action, before_state, actor, actor_type, source, extra=None):
    record_audit_event(
        actor_user=actor if getattr(actor, "is_authenticated", False) else None,
        actor_type=actor_type,
        action=action,
        target_type="entitlements.UserEntitlement",
        target_id=str(entitlement.pk),
        source=source,
        before={"state": before_state},
        after={"state": entitlement.state},
        metadata={
            "user_id": str(entitlement.user_id),
            "entitlement_type": entitlement.entitlement_type,
            "source": entitlement.source,
            **(extra or {}),
        },
    )


@transaction.atomic
def _transition(
    *,
    entitlement_id,
    target_state: str,
    actor,
    actor_type: str,
    source: str,
    action: str,
    updates: dict,
    extra_metadata: dict | None = None,
) -> UserEntitlement | None:
    """Lock one row, check the spec §6.3 edge, apply `updates`, audit.

    Returns the updated row, or None when the edge is not legal — callers that
    sweep in bulk treat None as "someone else got there first", while callers
    acting on a user's instruction raise InvalidEntitlementState themselves.
    """
    entitlement = UserEntitlement.objects.select_for_update().get(pk=entitlement_id)
    before_state = entitlement.state
    if not can_transition_entitlement(before_state, target_state):
        return None

    entitlement.state = target_state
    for field, value in updates.items():
        setattr(entitlement, field, value)
    entitlement.save(
        update_fields=["state", *updates.keys(), "updated_at"]
    )
    _audit(
        entitlement=entitlement,
        action=action,
        before_state=before_state,
        actor=actor,
        actor_type=actor_type,
        source=source,
        extra=extra_metadata,
    )
    return entitlement


def expire_due_entitlements(*, now: datetime | None = None) -> int:
    """Spec §6.3's `AVAILABLE -> EXPIRED`. Returns how many rows moved.

    Only AVAILABLE rows are candidates. A CONSUMED right that has published a
    listing is finished, not expired; a RESERVED one is released by the other
    pass; spec §6.3 gives EXPIRED exactly one inbound edge.
    """
    now = now or timezone.now()
    ids = list(
        UserEntitlement.objects.filter(
            state=EntitlementState.AVAILABLE, valid_until__lte=now
        ).values_list("pk", flat=True)
    )
    moved = 0
    for entitlement_id in ids:
        if (
            _transition(
                entitlement_id=entitlement_id,
                target_state=EntitlementState.EXPIRED,
                actor=None,
                actor_type=AuditEvent.ActorType.SYSTEM,
                source=AuditEvent.Source.TASK,
                action="entitlement.expired",
                updates={},
                extra_metadata={"reason": "validity_window_closed"},
            )
            is not None
        ):
            moved += 1
    return moved


def release_reservation(*, entitlement, actor, reason: str) -> UserEntitlement:
    """Spec §6.3's `RESERVED -> AVAILABLE`, on someone's instruction.

    Raises InvalidEntitlementState when the row is not RESERVED, because the
    caller asked for a specific row and deserves to be told it moved.
    """
    released = _transition(
        entitlement_id=entitlement.pk,
        target_state=EntitlementState.AVAILABLE,
        actor=actor,
        actor_type=(
            AuditEvent.ActorType.USER
            if getattr(actor, "is_authenticated", False)
            else AuditEvent.ActorType.SYSTEM
        ),
        source=AuditEvent.Source.ADMIN,
        action="entitlement.reservation_released",
        updates={"reserved_at": None, "listing": None},
        extra_metadata={"reason": reason},
    )
    if released is None:
        entitlement.refresh_from_db()
        raise InvalidEntitlementState(current_state=entitlement.state)
    return released


def release_stale_reservations(*, now: datetime | None = None) -> int:
    """Spec §6.3: "Reservations expire after 30 minutes unless attached to a
    saved draft."

    `listing__isnull=True` is the "unless": a reservation bound to a listing is
    attached by definition, so the clock must not reclaim it.

    Spec §36.3 assumes something else releases it — "a draft abandoned before
    submission releases reservation" — but NO draft-abandonment flow exists in
    this codebase (there is no listing deletion or archival path; ARCHIVED is
    unreachable). That gap is harmless only because this phase creates no
    RESERVED rows at all (see the plan's ruling on draft creation), so on
    today's data this pass is a no-op and no draft-attached reservation can
    exist to be stranded. The first phase that produces a RESERVED row must
    either leave `listing` NULL, so this sweep can time it out, or ship the
    abandonment-release flow §36.3 presumes. It is built anyway
    because spec §6.3 mandates the rule and because Phase 14's Stripe
    fulfilment and Phase 15's media upgrade are its first producers.
    """
    now = now or timezone.now()
    cutoff = now - timedelta(minutes=RESERVATION_TIMEOUT_MINUTES)
    ids = list(
        UserEntitlement.objects.filter(
            state=EntitlementState.RESERVED,
            listing__isnull=True,
            reserved_at__isnull=False,
            reserved_at__lt=cutoff,
        ).values_list("pk", flat=True)
    )
    moved = 0
    for entitlement_id in ids:
        if (
            _transition(
                entitlement_id=entitlement_id,
                target_state=EntitlementState.AVAILABLE,
                actor=None,
                actor_type=AuditEvent.ActorType.SYSTEM,
                source=AuditEvent.Source.TASK,
                action="entitlement.reservation_released",
                updates={"reserved_at": None},
                extra_metadata={"reason": "reservation_timed_out"},
            )
            is not None
        ):
            moved += 1
    return moved
```

- [ ] **Step 4: Write `backend/entitlements/tasks.py`**

```python
"""Celery entry points for the ledger (spec §6.3).

Thin wrappers only — every rule lives in entitlements.services.
"""

import logging

from celery import shared_task

from .services import expire_due_entitlements, release_stale_reservations

logger = logging.getLogger(__name__)


@shared_task(queue="maintenance")
def sweep_entitlement_ledger() -> dict:
    """Both time-driven spec §6.3 transitions, in one nightly pass.

    Expiry runs first: a reservation released into an already-closed validity
    window would otherwise sit AVAILABLE-but-unusable until the next night.
    """
    expired = expire_due_entitlements()
    released = release_stale_reservations()
    logger.info(
        "entitlement ledger sweep complete",
        extra={"expired": expired, "released": released},
    )
    return {"expired": expired, "released": released}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd backend && uv run pytest entitlements/tests/test_ledger_maintenance.py -v`
Expected: PASS (9 tests).

Run: `cd backend && uv run python manage.py check`
Expected: `System check identified no issues` — and the beat schedule declared in Task 10 now names a task that exists.

- [ ] **Step 6: Commit**

```bash
git add backend/entitlements/services.py backend/entitlements/tasks.py backend/entitlements/tests/test_ledger_maintenance.py
git commit -m "feat(entitlements): nightly ledger sweep for expiry and stale reservations"
```

---

### Task 13: Staff entitlement operations — grant, revoke, restore

**Files:**
- Modify: `backend/entitlements/services.py` (append), `backend/entitlements/admin.py` (add three actions)
- Test: `backend/entitlements/tests/test_staff_operations.py`

**Interfaces:**
- Consumes: `entitlements.services._transition`, `entitlements.services.InvalidEntitlementState` (Task 12); `entitlements.policy.paid_validity_days` (Task 3); `accounts.services.is_staff_admin`.
- Produces:
  - `entitlements.services.EntitlementReasonRequired(ValidationError)` — a DRF `ValidationError` subclass whose detail is `{"reason": [ErrorDetail(..., code="entitlement_reason_required")]}`. It renders as **400 `validation_error`** with `fields: {"reason": [...]}`, because `common.exceptions.nauta_exception_handler` routes every `ValidationError` — subclass or not — through `_field_map(exc.detail)`. `entitlement_reason_required` is therefore a **field-level** code, never the envelope's top-level `code`. See Global Constraints; that is deliberate, since the whole point is to name the field the staff user left blank.
  - `entitlements.services.grant_listing_right(*, user, actor, reason, entitlement_type=EntitlementType.PAID_LISTING, valid_days=None, now=None) -> UserEntitlement`
  - `entitlements.services.revoke_entitlement(*, entitlement, actor, reason, now=None) -> UserEntitlement`
  - `entitlements.services.RestoreResult` — frozen dataclass: `revoked: UserEntitlement`, `replacement: UserEntitlement | None`
  - `entitlements.services.restore_consumed_right(*, entitlement, actor, reason, now=None) -> RestoreResult`
  - Three Django admin actions on `UserEntitlementAdmin`, all staff-admin-only

- [ ] **Step 1: Write the failing test**

`backend/entitlements/tests/test_staff_operations.py`:

```python
"""Spec §26.3's four staff capabilities, and §36.3's "who, why and expiry"."""

from datetime import timedelta

import pytest
from django.contrib.auth.models import Group
from django.utils import timezone

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from audit.models import AuditEvent
from entitlements.enums import EntitlementSource, EntitlementState, EntitlementType
from entitlements.policy import free_quota_state
from entitlements.services import (
    EntitlementReasonRequired,
    InvalidEntitlementState,
    grant_listing_right,
    restore_consumed_right,
    revoke_entitlement,
)
from entitlements.tests.factories import make_entitlement, make_private_seller


@pytest.fixture
def staff_admin(db):
    admin = make_user("entitlement-admin@example.com", role=UserRole.STAFF, verified=True)
    admin.groups.add(Group.objects.get_or_create(name=StaffGroup.ADMIN)[0])
    return admin


@pytest.mark.django_db
def test_a_granted_right_records_who_why_and_expiry(staff_admin):
    """Spec §36.3: "Staff-granted right must include who, why and expiry"."""
    seller = make_private_seller()

    right = grant_listing_right(
        user=seller, actor=staff_admin, reason="Goodwill after a support incident."
    )

    assert right.entitlement_type == EntitlementType.PAID_LISTING
    assert right.source == EntitlementSource.STAFF_GRANT
    assert right.state == EntitlementState.AVAILABLE
    assert right.granted_by_id == staff_admin.pk
    assert right.metadata["reason"] == "Goodwill after a support incident."
    assert right.valid_until > timezone.now() + timedelta(days=364)


@pytest.mark.django_db
def test_a_grant_without_a_reason_is_refused(staff_admin):
    with pytest.raises(EntitlementReasonRequired) as excinfo:
        grant_listing_right(user=make_private_seller(), actor=staff_admin, reason="  ")

    assert excinfo.value.status_code == 400
    # A dict-detail ValidationError's get_codes() returns a DICT, not a string:
    # this is a FIELD-level code inside a `validation_error` envelope, not a
    # top-level envelope code. See the Global Constraints note.
    assert excinfo.value.get_codes() == {"reason": ["entitlement_reason_required"]}
    assert excinfo.value.detail["reason"][0].code == "entitlement_reason_required"


@pytest.mark.django_db
def test_a_grant_writes_an_audit_event(staff_admin):
    seller = make_private_seller()

    right = grant_listing_right(user=seller, actor=staff_admin, reason="Compensation.")

    event = AuditEvent.objects.get(action="entitlement.granted")
    assert event.target_id == str(right.pk)
    assert event.actor_user_id == staff_admin.pk
    assert event.source == AuditEvent.Source.ADMIN
    assert event.metadata["reason"] == "Compensation."


@pytest.mark.django_db
def test_an_unused_staff_grant_can_be_revoked(staff_admin):
    """Spec §26.3 item 3: "Revoke unused staff-granted right"."""
    seller = make_private_seller()
    right = grant_listing_right(user=seller, actor=staff_admin, reason="Granted in error.")

    revoked = revoke_entitlement(
        entitlement=right, actor=staff_admin, reason="Granted in error."
    )

    assert revoked.state == EntitlementState.REVOKED
    assert revoked.revoked_at is not None
    assert revoked.metadata["revocation_reason"] == "Granted in error."
    assert AuditEvent.objects.filter(action="entitlement.revoked").count() == 1


@pytest.mark.django_db
def test_revoking_an_already_revoked_right_is_refused(staff_admin):
    seller = make_private_seller()
    right = grant_listing_right(user=seller, actor=staff_admin, reason="Oops.")
    revoke_entitlement(entitlement=right, actor=staff_admin, reason="Oops.")

    with pytest.raises(InvalidEntitlementState):
        revoke_entitlement(entitlement=right, actor=staff_admin, reason="Again.")


@pytest.mark.django_db
def test_restoring_a_consumed_free_right_reopens_the_window(staff_admin):
    """Spec §22.1: the right "remains consumed unless staff explicitly restores
    it with an audited remedy"."""
    seller = make_private_seller()
    consumed = make_entitlement(
        user=seller,
        entitlement_type=EntitlementType.FREE_LISTING,
        state=EntitlementState.CONSUMED,
        consumed_at=timezone.now() - timedelta(days=3),
    )
    assert free_quota_state(seller).available is False

    result = restore_consumed_right(
        entitlement=consumed, actor=staff_admin, reason="Expired by staff error."
    )

    assert result.revoked.state == EntitlementState.REVOKED
    # A free right needs no replacement row: eligibility is recomputed from
    # consumption history, and the revoked row no longer counts.
    assert result.replacement is None
    assert free_quota_state(seller).available is True


@pytest.mark.django_db
def test_restoring_a_consumed_paid_right_issues_a_replacement(staff_admin):
    seller = make_private_seller()
    consumed = make_entitlement(
        user=seller,
        entitlement_type=EntitlementType.PAID_LISTING,
        source=EntitlementSource.STRIPE_PURCHASE,
        state=EntitlementState.CONSUMED,
        consumed_at=timezone.now() - timedelta(days=3),
    )

    result = restore_consumed_right(
        entitlement=consumed, actor=staff_admin, reason="Published in error by staff."
    )

    assert result.revoked.state == EntitlementState.REVOKED
    assert result.replacement is not None
    assert result.replacement.entitlement_type == EntitlementType.PAID_LISTING
    assert result.replacement.source == EntitlementSource.STAFF_GRANT
    assert result.replacement.state == EntitlementState.AVAILABLE
    assert result.replacement.metadata["restored_from"] == str(consumed.pk)


@pytest.mark.django_db
def test_restoring_a_right_that_was_never_consumed_is_refused(staff_admin):
    seller = make_private_seller()
    available = grant_listing_right(user=seller, actor=staff_admin, reason="Goodwill.")

    with pytest.raises(InvalidEntitlementState):
        restore_consumed_right(
            entitlement=available, actor=staff_admin, reason="Not consumed."
        )


@pytest.mark.django_db
def test_restoring_does_not_touch_the_listing_it_published(staff_admin):
    """Spec §36.4 keeps moderation and entitlement remedies separate."""
    from listings.enums import ListingStatus
    from listings.tests.factories import make_private_listing

    seller = make_private_seller()
    listing = make_private_listing(owner=seller, status=ListingStatus.PUBLISHED)
    consumed = make_entitlement(
        user=seller,
        listing=listing,
        entitlement_type=EntitlementType.FREE_LISTING,
        state=EntitlementState.CONSUMED,
        consumed_at=timezone.now(),
    )

    restore_consumed_right(
        entitlement=consumed, actor=staff_admin, reason="Staff error."
    )

    listing.refresh_from_db()
    assert listing.status == ListingStatus.PUBLISHED


@pytest.mark.django_db
def test_the_admin_actions_are_staff_admin_only(staff_admin):
    """Spec §5 and Phase 3 contract rule 6: grant/revoke/restore are
    configuration and compensation, so staff-admin, not staff-moderator."""
    from django.contrib.admin.sites import site

    from entitlements.models import UserEntitlement

    admin_class = site._registry[UserEntitlement]
    moderator = make_user("mod@example.com", role=UserRole.STAFF, verified=True)
    moderator.groups.add(Group.objects.get_or_create(name=StaffGroup.MODERATOR)[0])

    class _Request:
        def __init__(self, user):
            self.user = user
            # Django 5.2's ModelAdmin.get_actions() reads `IS_POPUP_VAR in
            # request.GET` on its FIRST line, so a fake request without a .GET
            # raises AttributeError before any permission logic runs.
            self.GET = {}

    assert set(admin_class.get_actions(_Request(staff_admin))) >= {
        "revoke_selected",
        "restore_selected",
    }
    assert "revoke_selected" not in admin_class.get_actions(_Request(moderator))
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && uv run pytest entitlements/tests/test_staff_operations.py -v`
Expected: FAIL — `ImportError: cannot import name 'grant_listing_right' from 'entitlements.services'`.

- [ ] **Step 3: Append the staff services to `backend/entitlements/services.py`**

Extend the module's imports with `from dataclasses import dataclass`, `from rest_framework.exceptions import ErrorDetail, ValidationError` and `from .enums import EntitlementSource, EntitlementType` (beside the existing enum imports), and `from .policy import paid_validity_days`, then append:

```python
class EntitlementReasonRequired(ValidationError):
    """Spec §26.3 and §36.3: every staff operation on the ledger is a
    compensation decision and must say why, in the audit trail and on the row.

    A ValidationError (400) rather than a bespoke APIException, so it renders
    through spec §30.2's `fields` map with the offending field named. The
    consequence, stated because it is easy to get wrong: common.exceptions maps
    EVERY ValidationError to `code: "validation_error"`, so the envelope reads
    `{"code": "validation_error", "fields": {"reason": [...]}}` and
    "entitlement_reason_required" appears only as the FIELD-level code. That is
    the intended contract — a blank reason is a form error about one field, not
    a distinct API failure mode — and it is why `get_codes()` on this exception
    returns a dict, not a string.
    """

    def __init__(self):
        super().__init__(
            {
                "reason": [
                    ErrorDetail(
                        "Explain why this entitlement is being changed.",
                        code="entitlement_reason_required",
                    )
                ]
            }
        )


def _require_reason(reason: str) -> str:
    cleaned = (reason or "").strip()
    if not cleaned:
        raise EntitlementReasonRequired()
    return cleaned


@transaction.atomic
def grant_listing_right(
    *,
    user,
    actor,
    reason: str,
    entitlement_type: str = EntitlementType.PAID_LISTING,
    valid_days: int | None = None,
    now: datetime | None = None,
) -> UserEntitlement:
    """Spec §26.3 item 2: "Grant a compensatory listing/media right with
    mandatory reason."

    Always AVAILABLE and always STAFF_GRANT — a grant hands someone a usable
    right, it never back-dates a consumption, and it is never attributed to
    Stripe.
    """
    cleaned = _require_reason(reason)
    now = now or timezone.now()
    valid_days = valid_days if valid_days is not None else paid_validity_days()

    entitlement = UserEntitlement.objects.create(
        user=user,
        entitlement_type=entitlement_type,
        source=EntitlementSource.STAFF_GRANT,
        state=EntitlementState.AVAILABLE,
        valid_from=now,
        valid_until=now + timedelta(days=valid_days),
        granted_by=actor if getattr(actor, "is_authenticated", False) else None,
        metadata={"reason": cleaned},
    )
    _audit(
        entitlement=entitlement,
        action="entitlement.granted",
        before_state=None,
        actor=actor,
        actor_type=AuditEvent.ActorType.USER,
        source=AuditEvent.Source.ADMIN,
        extra={"reason": cleaned, "valid_days": valid_days},
    )
    return entitlement


def revoke_entitlement(
    *, entitlement, actor, reason: str, now: datetime | None = None
) -> UserEntitlement:
    """Spec §26.3 item 3, and spec §6.3's `CONSUMED -> REVOKED`.

    Works from AVAILABLE/RESERVED (an unused grant withdrawn) and from CONSUMED
    (a refund, chargeback or staff remedy). Spec §26.4's rule that staff must
    not hand-edit Stripe-paid order status is unaffected: this revokes the
    *entitlement*, never a PaymentOrder.
    """
    cleaned = _require_reason(reason)
    now = now or timezone.now()
    return _revoke(
        entitlement=entitlement,
        actor=actor,
        reason=cleaned,
        now=now,
        action="entitlement.revoked",
        extra_metadata={},
    )


def _revoke(*, entitlement, actor, reason, now, action, extra_metadata):
    with transaction.atomic():
        locked = UserEntitlement.objects.select_for_update().get(pk=entitlement.pk)
        before_state = locked.state
        if before_state == EntitlementState.REVOKED or not (
            can_transition_entitlement(before_state, EntitlementState.REVOKED)
            or before_state
            in (EntitlementState.AVAILABLE, EntitlementState.RESERVED)
        ):
            raise InvalidEntitlementState(current_state=before_state)

        locked.state = EntitlementState.REVOKED
        locked.revoked_at = now
        locked.metadata = {
            **locked.metadata,
            "revocation_reason": reason,
            **extra_metadata,
        }
        locked.save(
            update_fields=["state", "revoked_at", "metadata", "updated_at"]
        )
        _audit(
            entitlement=locked,
            action=action,
            before_state=before_state,
            actor=actor,
            actor_type=AuditEvent.ActorType.USER,
            source=AuditEvent.Source.ADMIN,
            extra={"reason": reason, **extra_metadata},
        )
        return locked
```

**Note (ruling — `AVAILABLE -> REVOKED` and `RESERVED -> REVOKED` are legal even though spec §6.3 draws only `CONSUMED -> REVOKED`.)** Spec §26.3 item 3 explicitly requires "Revoke unused staff-granted right", and an *unused* right is by definition AVAILABLE or RESERVED, never CONSUMED. §6.3's diagram names the transition that matters for refunds; it does not enumerate the administrative withdrawal §26.3 mandates. `ENTITLEMENT_TRANSITIONS` (Task 1) is left as the literal spec §6.3 reading, and `_revoke` names the two extra source states explicitly rather than widening the shared map, so the map stays a faithful record of the spec and the widening is visible at exactly one call site.

Then append the restore service:

```python
@dataclass(frozen=True)
class RestoreResult:
    revoked: UserEntitlement
    replacement: UserEntitlement | None


@transaction.atomic
def restore_consumed_right(
    *, entitlement, actor, reason: str, now: datetime | None = None
) -> RestoreResult:
    """Spec §26.3 item 4: "Restore a right after documented staff error."

    Two shapes, because the two right types are restored differently:
      * FREE_LISTING — revoking the consumed row is the whole remedy, because
        free eligibility is recomputed from consumption history (spec §22.1)
        and a REVOKED row no longer counts.
      * PAID_LISTING — revoking alone would leave the buyer with nothing, so a
        replacement AVAILABLE/STAFF_GRANT row is issued with fresh validity.

    The listing this right published is deliberately untouched: spec §36.4
    keeps moderation decisions and entitlement remedies separate.
    """
    cleaned = _require_reason(reason)
    now = now or timezone.now()

    entitlement.refresh_from_db()
    if entitlement.state != EntitlementState.CONSUMED:
        raise InvalidEntitlementState(
            "Only a consumed right can be restored.", current_state=entitlement.state
        )

    revoked = _revoke(
        entitlement=entitlement,
        actor=actor,
        reason=cleaned,
        now=now,
        action="entitlement.restored",
        extra_metadata={"restored": True},
    )

    replacement = None
    if revoked.entitlement_type == EntitlementType.PAID_LISTING:
        replacement = grant_listing_right(
            user=revoked.user,
            actor=actor,
            reason=cleaned,
            entitlement_type=EntitlementType.PAID_LISTING,
            now=now,
        )
        replacement.metadata = {
            **replacement.metadata,
            "restored_from": str(revoked.pk),
        }
        replacement.save(update_fields=["metadata", "updated_at"])

    return RestoreResult(revoked=revoked, replacement=replacement)
```

- [ ] **Step 4: Add the three admin actions to `backend/entitlements/admin.py`**

```python
from django import forms
from django.contrib import admin, messages
from django.shortcuts import redirect, render

from accounts.services import is_staff_admin

from .enums import EntitlementType
from .models import UserEntitlement
from .services import (
    EntitlementReasonRequired,
    InvalidEntitlementState,
    grant_listing_right,
    restore_consumed_right,
    revoke_entitlement,
)


class EntitlementReasonForm(forms.Form):
    """Spec §26.3/§36.3's mandatory reason, collected on an intermediate page.

    The form is a convenience, not the enforcement: the services raise
    EntitlementReasonRequired on a blank reason regardless of entry point.
    """

    reason = forms.CharField(
        widget=forms.Textarea(attrs={"rows": 3}),
        label="Reason (recorded on the entitlement and in the audit trail)",
    )
```

Then, on `UserEntitlementAdmin`, add:

```python
    actions = ("revoke_selected", "restore_selected")

    def get_actions(self, request):
        """Spec §5 / Phase 3 contract rule 6: grant, revoke and restore are
        staff-ADMIN operations. A staff moderator sees the ledger and no
        actions."""
        actions = super().get_actions(request)
        if not is_staff_admin(request.user):
            for name in ("revoke_selected", "restore_selected"):
                actions.pop(name, None)
        return actions

    def _with_reason(self, request, queryset, *, title, apply):
        """Render the reason form, then apply `apply(entitlement, reason)`."""
        if "apply_reason" in request.POST:
            form = EntitlementReasonForm(request.POST)
            if form.is_valid():
                reason = form.cleaned_data["reason"]
                done = 0
                for entitlement in queryset:
                    try:
                        apply(entitlement, reason)
                    except (InvalidEntitlementState, EntitlementReasonRequired) as exc:
                        self.message_user(
                            request, f"{entitlement.pk}: {exc}", level=messages.ERROR
                        )
                    else:
                        done += 1
                self.message_user(request, f"{done} entitlement(s) updated.")
                return redirect(request.get_full_path())
        else:
            form = EntitlementReasonForm()
        return render(
            request,
            "admin/entitlements/reason_action.html",
            {
                "title": title,
                "form": form,
                "queryset": queryset,
                "action_checkbox_name": admin.helpers.ACTION_CHECKBOX_NAME,
            },
        )

    @admin.action(description="Revoke selected entitlements (reason required)")
    def revoke_selected(self, request, queryset):
        return self._with_reason(
            request,
            queryset,
            title="Revoke entitlements",
            apply=lambda entitlement, reason: revoke_entitlement(
                entitlement=entitlement, actor=request.user, reason=reason
            ),
        )

    @admin.action(description="Restore selected consumed rights (reason required)")
    def restore_selected(self, request, queryset):
        return self._with_reason(
            request,
            queryset,
            title="Restore consumed rights",
            apply=lambda entitlement, reason: restore_consumed_right(
                entitlement=entitlement, actor=request.user, reason=reason
            ),
        )
```

Create the template `backend/entitlements/templates/admin/entitlements/reason_action.html`:

```html
{% extends "admin/base_site.html" %}
{% block content %}
  <h1>{{ title }}</h1>
  <ul>
    {% for entitlement in queryset %}
      <li>{{ entitlement }}</li>
    {% endfor %}
  </ul>
  <form method="post">
    {% csrf_token %}
    {{ form.as_p }}
    {% for entitlement in queryset %}
      <input type="hidden" name="{{ action_checkbox_name }}" value="{{ entitlement.pk }}">
    {% endfor %}
    <input type="hidden" name="action" value="{{ request.POST.action }}">
    <input type="submit" name="apply_reason" value="Confirm">
  </form>
{% endblock %}
```

Confirm `backend/config/settings/base.py`'s `TEMPLATES[0]["APP_DIRS"]` is `True` (the Django default this project scaffolded with). If it is not, add `"entitlements/templates"` to `DIRS` rather than flipping `APP_DIRS`, which would change loader behaviour for every other app.

**Granting** has no bulk action, because a grant needs a *target user*, not a selected entitlement. Add it as a link from the user's own admin page in Phase 17's staff UI; for this phase, staff grant from the Django shell or from `entitlements.services.grant_listing_right` invoked by a Phase 17 endpoint. The service is complete, audited and tested — only the admin affordance is deferred. Recorded in Known Limitations.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd backend && uv run pytest entitlements/tests/test_staff_operations.py -v`
Expected: PASS (10 tests).

Run: `cd backend && uv run pytest -q`
Expected: full suite green.

- [ ] **Step 6: Commit**

```bash
git add backend/entitlements
git commit -m "feat(entitlements): audited staff grant, revoke and restore per spec 26.3"
```

---

### Task 14: Phase acceptance tests, full regression and the handoff note

**Files:**
- Create: `backend/entitlements/tests/test_phase_acceptance.py`
- Modify: `ACTIVITY.md`

**Interfaces:**
- Consumes: everything above. No new production symbol.

Every test here drives the phase end to end through real HTTP calls, because spec §22's definition of done is a statement about what the API does, not about what the services can be made to do. This mirrors `listings/tests/test_phase_acceptance.py`'s own opening docstring.

- [ ] **Step 1: Write the acceptance tests**

`backend/entitlements/tests/test_phase_acceptance.py`:

```python
"""Spec §22's definition of done, item by item.

1. Free limits are adjustable without code deployment.
2. UI and API agree on eligibility.
3. Multiple tabs cannot create multiple free listings.
4. Expired listings disappear publicly and remain manageable privately.
"""

from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from entitlements.enums import EntitlementState, EntitlementType
from entitlements.models import UserEntitlement
from entitlements.tests.factories import make_private_seller
from listings.enums import ListingStatus
from listings.expiry import expire_due_listings
from listings.models import BoatListing
from listings.tests.factories import make_brand, make_media, make_model
from platform_settings.services import set_feature_flag, update_setting


@pytest.fixture
def both_flags_on(db):
    set_feature_flag(key="listing_revisions", is_enabled=True, actor=None)
    set_feature_flag(key="individual_entitlements", is_enabled=True, actor=None)


@pytest.fixture
def api():
    return APIClient()


def _draft(api, brand_name):
    brand = make_brand(brand_name)
    response = api.post(
        reverse("listing-draft-create"),
        {
            "brand_id": str(brand.pk),
            "model_id": str(make_model(brand).pk),
            "manufacture_year": 2020,
        },
        format="json",
    )
    return response


def _fill_and_submit(api, created):
    listing = BoatListing.objects.get(pk=created["id"])
    image = make_media(listing)
    patched = api.patch(
        reverse("listing-draft-update", kwargs={"listing_id": listing.pk}),
        {
            "version": created["revision"]["version"],
            "title_en": "Well kept cruiser",
            "description_en": "A well kept cruiser with a recent service.",
            "location_country": "ES",
            "location_region": "Balearic Islands",
            "location_city": "Palma",
            "price": "125000.00",
            "currency": "EUR",
            "media_ids": [str(image.pk)],
        },
        format="json",
    )
    assert patched.status_code == 200, patched.data
    return api.post(
        reverse("listing-submit", kwargs={"listing_id": listing.pk}),
        {"version": patched.data["revision"]["version"]},
        format="json",
    )


@pytest.mark.django_db
def test_done_1_free_limits_are_adjustable_without_a_deployment(api, both_flags_on):
    """Raise the count and the period in the database; the API answer changes."""
    seller = make_private_seller()
    api.force_authenticate(seller)
    first = _draft(api, "Beneteau")
    assert _fill_and_submit(api, first.data).status_code == 200

    blocked = api.get(reverse("listing-eligibility"))
    assert blocked.data["can_start_listing"] is False

    update_setting(key="individual.free_listing_count", value=2, actor=None)

    unblocked = api.get(reverse("listing-eligibility"))
    assert unblocked.data["can_start_listing"] is True
    assert _fill_and_submit(api, _draft(api, "Jeanneau").data).status_code == 200

    update_setting(key="individual.free_publish_days", value=45, actor=None)
    assert api.get(reverse("listing-eligibility")).data["free"]["publication_days"] == 45


@pytest.mark.django_db
def test_done_2_ui_and_api_agree_on_eligibility(api, both_flags_on):
    """Whatever `GET /listing-eligibility/` says, the two mutating endpoints do."""
    seller = make_private_seller()
    api.force_authenticate(seller)

    before = api.get(reverse("listing-eligibility")).data
    assert before["can_start_listing"] is True
    created = _draft(api, "Bavaria")
    assert created.status_code == 201
    assert _fill_and_submit(api, created.data).status_code == 200

    after = api.get(reverse("listing-eligibility")).data
    assert after["can_start_listing"] is False
    assert after["blocking_reason"] == "FREE_ALLOWANCE_USED"

    refused_draft = _draft(api, "Hanse")
    assert refused_draft.status_code == 403
    assert refused_draft.data["error"]["code"] == "listing_entitlement_required"


@pytest.mark.django_db
def test_done_3_multiple_tabs_cannot_create_multiple_free_listings(
    api, both_flags_on
):
    """Two drafts opened before either was submitted — the classic two-tab case.

    Both drafts are legal (nothing is consumed at creation, spec §6.3); the
    second submit is refused by the authoritative locked check at submit time
    (spec §22.2, §22.4), and exactly one ledger row exists afterwards.
    """
    seller = make_private_seller()
    api.force_authenticate(seller)
    tab_one = _draft(api, "Dufour")
    tab_two = _draft(api, "Elan")
    assert tab_one.status_code == 201
    assert tab_two.status_code == 201

    first = _fill_and_submit(api, tab_one.data)
    second = _fill_and_submit(api, tab_two.data)

    assert first.status_code == 200, first.data
    assert second.status_code == 403
    assert second.data["error"]["code"] == "listing_entitlement_required"
    assert (
        UserEntitlement.objects.filter(
            user=seller, entitlement_type=EntitlementType.FREE_LISTING
        ).count()
        == 1
    )
    assert (
        BoatListing.objects.filter(
            owner_user=seller, status=ListingStatus.PENDING_APPROVAL
        ).count()
        == 1
    )


@pytest.mark.django_db
def test_done_4_expired_listings_disappear_publicly_and_stay_private(
    api, both_flags_on, published_listing_with_snapshot
):
    listing = published_listing_with_snapshot
    anonymous = APIClient()
    detail = reverse("listing-detail", kwargs={"listing_id": listing.pk})
    assert anonymous.get(detail).status_code == 200

    BoatListing.objects.filter(pk=listing.pk).update(
        expires_at=timezone.now() - timedelta(minutes=1)
    )
    assert expire_due_listings() == 1

    assert anonymous.get(detail).status_code == 404
    assert anonymous.get(reverse("listing-list")).data["count"] == 0

    listing.refresh_from_db()
    assert listing.status == ListingStatus.EXPIRED
    # Still the owner's record: the row, its snapshot and its ledger entry all
    # survive, and nothing was deleted.
    assert listing.current_public_snapshot_id is not None
    assert listing.owner_user_id is not None


@pytest.mark.django_db
def test_spec_22_1_the_rolling_period_starts_at_consumption_not_publication(
    api, both_flags_on
):
    seller = make_private_seller()
    api.force_authenticate(seller)
    assert _fill_and_submit(api, _draft(api, "Nimbus").data).status_code == 200

    right = UserEntitlement.objects.get(user=seller)
    eligibility = api.get(reverse("listing-eligibility")).data

    assert right.state == EntitlementState.CONSUMED
    assert eligibility["free"]["used_at"] is not None
    # 365 days after CONSUMPTION, not after any approval or publication.
    assert eligibility["free"]["next_available_at"] is not None


@pytest.mark.django_db
def test_spec_22_1_the_window_reopens_after_the_period(api, both_flags_on):
    seller = make_private_seller()
    api.force_authenticate(seller)
    assert _fill_and_submit(api, _draft(api, "Sirius").data).status_code == 200

    UserEntitlement.objects.filter(user=seller).update(
        consumed_at=timezone.now() - timedelta(days=366)
    )

    assert api.get(reverse("listing-eligibility")).data["can_start_listing"] is True
    assert _draft(api, "Linssen").status_code == 201


@pytest.mark.django_db
def test_spec_22_1_deleting_the_listing_does_not_reset_the_quota(api, both_flags_on):
    """Spec §22.1: "Deleting, archiving or selling a boat does not reset free
    quota." Spec §11.9: the ledger, not the listing table, is the record."""
    seller = make_private_seller()
    api.force_authenticate(seller)
    created = _draft(api, "Sealine")
    assert _fill_and_submit(api, created.data).status_code == 200

    # The listing is archived rather than deleted — `consumed_entitlement` is
    # PROTECT, so a hard delete is refused, which is itself the guarantee.
    BoatListing.objects.filter(pk=created.data["id"]).update(
        status=ListingStatus.ARCHIVED
    )

    assert api.get(reverse("listing-eligibility")).data["can_start_listing"] is False
```

- [ ] **Step 2: Run the acceptance tests**

Run: `cd backend && uv run pytest entitlements/tests/test_phase_acceptance.py -v`
Expected: PASS (7 tests).

- [ ] **Step 3: Run the whole backend suite**

Run: `cd backend && uv run pytest -q`
Expected: every test green in one run against real Postgres and Redis. If anything fails, fix the code, not the test, and never the test settings.

Run: `cd backend && uv run python manage.py makemigrations --check --dry-run`
Expected: `No changes detected`.

Run: `cd backend && uv run python manage.py check --deploy`
Expected: no new warnings introduced by this phase (the pre-existing ones from Phase 0/1 are unchanged).

- [ ] **Step 4: Manually verify the rollout switch**

With the backend running on port 8020 and a verified private-seller account:

1. With `individual_entitlements` **off**, publish one listing, then confirm a second draft is still accepted and that `GET /api/v1/listing-eligibility/` reports `can_start_listing: true` with `free.available: false`.
2. Flip the flag on through Django admin.
3. Confirm the same account now gets `403 listing_entitlement_required` from `POST /api/v1/listings/drafts/`, with an `error.action` block naming `INDIVIDUAL_LISTING_RIGHT`.
4. Grant a compensatory right through the Django shell
   (`entitlements.services.grant_listing_right(user=…, actor=…, reason="manual smoke test")`)
   and confirm the endpoint flips back to `can_start_listing: true` with
   `paid_listing_rights_available: 1`.

On this Windows machine set `PYTHONUTF8=1` and `PYTHONIOENCODING=utf-8` before any `manage.py shell` call that passes non-ASCII text — Phase 4's ACTIVITY note records the console-codepage trap that otherwise mangles it.

- [ ] **Step 5: Write the handoff note in `ACTIVITY.md`**

Insert a new section at the **top** of the log (the file is newest-first):

```markdown
### 2026-09-18 — Phase 13 (individual free quota and entitlement enforcement) complete

- Implemented `docs/superpowers/plans/2026-09-18-phase-13-quota-entitlement.md` in full.
- New `entitlements` app: spec §11.9's `UserEntitlement` ledger (with spec §6.3's
  state machine, four database constraints and a read-only Django admin), the
  rolling free-quota arithmetic of spec §22.1, `ListingEligibilityService` and
  `GET /api/v1/listing-eligibility/` (spec §22.2, §30.1), locked once-only
  consumption (spec §22.4), the nightly ledger sweep (spec §6.3), and audited
  staff grant/revoke/restore (spec §26.3).
- `listings` changes, deliberately minimal: `ListingEntitlementGate` is now real
  (Phase 11 contract rule 6), `BoatListing.consumed_entitlement` is a real FK,
  draft creation and submit both return `403 listing_entitlement_required`, and
  publication expiry (spec §22.5) landed as two new modules, `listings/expiry.py`
  and `listings/tasks.py`, plus two appended signals.
- `common.exceptions.nauta_exception_handler` gained an `action` passthrough so
  spec §30.2's worked error body for this exact code renders as specified.
- Rollout: `individual_entitlements` is seeded **disabled**. The ledger is written
  either way — only refusal is gated — so enabling the flag later cannot hand a
  pre-rollout user a second free listing.
- Celery beat: `CELERY_BEAT_SCHEDULE` now declares three nightly jobs. **No beat
  process is deployed yet**; starting one is a Phase 24 (§35.2) deployment step.
  Until then, expiry and the ledger sweep must be run manually or by cron calling
  the task functions, or published listings will never expire.
- Known limitations: no `MarketplaceProduct` and no Checkout, so spec §22.3's
  purchase CTA has no backend source (Phase 14); no frontend at all for §22.3
  (Phase 16); nothing produces a RESERVED row yet; reactivation after expiry is
  undefined in spec §6.1 and is not built. See the plan's Known Limitations for
  the full list with owning phases.
- Next: Phase 14 (Stripe products, Checkout and fulfilment) — it converts
  `UserEntitlement.source_payment_id` into a real FK and becomes the first
  producer of `STRIPE_PURCHASE` rights.
```

- [ ] **Step 6: Commit**

```bash
git add backend/entitlements/tests/test_phase_acceptance.py ACTIVITY.md
git commit -m "test(entitlements): spec 22 definition-of-done acceptance pass and handoff note"
```

---

## Known Limitations (carried forward, not fixed by this plan)

Each item names the phase that closes it. None breaks a MUST requirement *of this phase* (spec §39: "Any known limitation that breaks a MUST requirement prevents completion") — every one is a requirement the spec itself assigns to a later phase, or a transition the spec does not define.

1. **No `MarketplaceProduct`, no price, no Checkout.** The eligibility payload carries `purchase_product_code: "INDIVIDUAL_LISTING_RIGHT"` but nothing carries the product's name, price, currency, Stripe ids or refund/help link, so spec §22.3's purchase modal has no backend source and §22.3's "Confirming creates a Stripe Checkout Session" is unreachable. → **Phase 14** (spec §23.1, §23.2).
2. **No frontend.** Spec §22.3's disabled "Start a listing" control, the adjacent purchase CTA and the "Use an available listing right" branch are Next.js work against pages that do not exist yet (`/sell/`, `/sell/create/`, the private dashboard). This plan is backend-only, matching Phase 11's precedent. The full API contract they render from ships here. → **Phase 16** (spec §25), with §37's `listing.free_allowance_used` and `listing.buy_right` keys.
3. **Nothing produces a `RESERVED` entitlement.** The state, its two spec §6.3 edges, `release_reservation()` and the 30-minute `release_stale_reservations()` sweep are all implemented and tested, but no code path in this phase creates a reserved row — draft creation validates instead of reserving (see the scope ruling), because an attached reservation has no release path while listing deletion/abandonment does not exist. Consequence worth naming explicitly: **spec §36.3's "a draft abandoned before submission releases reservation" is not implemented and cannot be**, because `release_stale_reservations()` filters on `listing__isnull=True` — §6.3's own "unless attached to a saved draft" exemption — and no draft-abandonment flow exists in this codebase to do the releasing. The rule is vacuously satisfied today (nothing creates a draft-attached reservation) and becomes a real obligation for whichever phase first produces one. → **Phase 14** (a right reserved against a pending Stripe order) or **Phase 15** (the listing-bound media upgrade); whichever it is must also ship the abandonment-release flow, or leave `listing` NULL so the clock can reclaim the row.
4. **Reactivation after expiry is not built.** Spec §22.5 states a precondition ("requires a new available paid listing right") on a transition spec §6.1 does not define: `LISTING_TRANSITIONS[EXPIRED]` is `{ARCHIVED}` and there is no `EXPIRED -> PUBLISHED` or `EXPIRED -> DRAFT` edge anywhere in the spec. The precondition ships as reusable services; the transition needs a specified edge. → **Phase 16/17**, or a signed change request extending spec §6.1.
5. **No Celery beat process is deployed.** `CELERY_BEAT_SCHEDULE` declares the three nightly jobs, and the tasks are registered and tested, but nothing runs `celery beat` in any environment. Until one does, no listing ever expires in a running system. → **Phase 24** (spec §35.2's deployment sequence).
6. **Expiry reminders have no receivers and no deduplication store.** `listing_expiring` and `listing_expired` fire correctly, and the window arithmetic makes a daily schedule fire each threshold once, but there is no `Notification` row, no WebSocket frame, no email and no persisted dedup key — so a beat misfire or a schedule change to twice-daily would double-send. → **Phase 18** (spec §27.1, whose dedup keys are "listing + threshold" and "listing + expiry"; the signal already carries `threshold_days`).
7. **`source_payment_id` is a loose `UUIDField`, not a FK.** `PaymentOrder` (spec §11.9) does not exist. Same loose-reference pattern Phase 11 used for `consumed_entitlement_id`, and it is converted the same way. → **Phase 14**.
8. **`MEDIA_UPGRADE` is a vocabulary entry with no behaviour.** The type exists in the enum and is excluded from `LISTING_RIGHT_TYPES` so it can never satisfy a publication right, but nothing grants, consumes or reads it, and `listings.policies.effective_media_allowance` still returns the base tier for every private seller. → **Phase 15** (spec §24.4), funded by **Phase 14**.
9. **No staff API for the ledger.** Spec §26.3's four capabilities are complete, audited services, and two of them (revoke, restore) are Django admin actions. **Granting has no admin affordance** — it needs a target *user*, not a selected entitlement — so a grant is currently made from the Django shell. `GET/POST /api/v1/staff/...` entitlement routes are not built. → **Phase 17** (spec §26.3, §26.1's staff navigation).
10. **No owner-facing "my listings" endpoint.** Spec §22.5 requires expiry to "preserve dashboard access", and it does — nothing is deleted and no read path is closed — but there is no endpoint that lists a seller's own listings, expired or otherwise; Phase 11 shipped none either. → **Phase 16/19**.
11. **`AVAILABLE -> REVOKED` and `RESERVED -> REVOKED` widen spec §6.3 at one call site.** Spec §26.3 requires revoking an *unused* staff grant, which is by definition not CONSUMED, so `entitlements.services._revoke` permits those two source states explicitly while `ENTITLEMENT_TRANSITIONS` stays the literal §6.3 reading. If a later phase wires a generic state-transition guard, it must decide whether to widen the map or keep the exception local.
12. **Consumption serialises on the `User` row, not on a quota row.** This is the correct mechanism for a free right that has no row until it exists, and it is proven by a lock assertion rather than by two racing connections (this project deliberately avoids threaded database tests — see `listings/tests/test_phase_acceptance.py`). A real two-connection race test would be stronger evidence. → **Phase 23** (spec §34.2), which owns the concurrency test strategy.
13. **No `Idempotency-Key` replay store on submit.** Unchanged from Phase 11's Known Limitation 7, and now slightly more load-bearing because a replayed submit consumes nothing but returns a 403 rather than the original 200 body. → **Phase 14**, whose Checkout creation is the mechanism's first real consumer.
14. **The over-allowance ledger row is a rollout artefact.** A consumption recorded while the flag was off and beyond the configured allowance is marked `metadata["over_allowance"] = True`. Nothing reconciles those rows afterwards; they simply count toward the window, which blocks the user until it rolls. If product wants an amnesty at rollout, it is a one-off data task, not code. → operational, Phase 24 (spec §35.2 step 3, "bounded backfills and reconciliation").
15. **Rate limiting on listing mutations is still absent.** Phase 11's Known Limitation 12 named this phase's entitlement gate as the thing that closes unbounded *draft creation* — and it does, for an individual seller with no right. It does not bound a broker (unlimited quota by spec §1) or a seller who still has a right. → **Phase 22** if a broader limit is wanted.

---

## Contract summary for later phases

Everything a downstream phase imports from Phase 13, in one place.

```python
from entitlements.consumption import (
    ListingEntitlementRequired,
    consume_listing_right,
    ensure_can_start_listing,
    lock_user_quota,
)
from entitlements.eligibility import (
    Eligibility,
    ListingEligibilityService,
    RecommendedEntitlement,
)
from entitlements.enums import (
    ENTITLEMENT_TRANSITIONS,
    INDIVIDUAL_ENTITLEMENTS_FLAG,
    LISTING_RIGHT_TYPES,
    PURCHASE_PRODUCT_CODE,
    RESERVATION_TIMEOUT_MINUTES,
    BlockingReason,
    EntitlementSource,
    EntitlementState,
    EntitlementType,
    can_transition_entitlement,
)
from entitlements.models import UserEntitlement, UserEntitlementQuerySet
from entitlements.policy import (
    FreeQuotaState,
    available_paid_rights,
    enforcement_enabled,
    free_listing_count,
    free_period_days,
    free_publication_days,
    free_quota_state,
    paid_publication_days,
    paid_validity_days,
)
from entitlements.services import (
    EntitlementReasonRequired,
    InvalidEntitlementState,
    RestoreResult,
    expire_due_entitlements,
    grant_listing_right,
    release_reservation,
    release_stale_reservations,
    restore_consumed_right,
    revoke_entitlement,
)
from entitlements.tasks import sweep_entitlement_ledger
from listings.expiry import (
    EXPIRY_REMINDER_DAYS,
    due_listings_queryset,
    expire_due_listings,
    expire_listing,
    listings_reaching_threshold,
    send_expiry_reminders,
)
from listings.policies import ConsumedRight, ListingEntitlementGate
from listings.signals import listing_expired, listing_expiring
from listings.tasks import expire_due_listings as expire_due_listings_task
from listings.tasks import send_listing_expiry_reminders
```

**Endpoints shipped by this phase**, against spec §30.1's literal inventory:

| Endpoint | §30.1 |
|---|---|
| `GET /api/v1/listing-eligibility/` | listed ("current private-seller eligibility") |

No other route is added, and no existing route's URL, method or success shape changes. Two existing endpoints gain one new failure mode each: `POST /api/v1/listings/drafts/` and `POST /api/v1/listings/<id>/submit/` can now return `403 listing_entitlement_required`.

**Deliberate, accepted deviations from Phase 11's contract** (recorded here so a later reader does not mistake either for a silent break; the controller is knowingly accepting both):

- **`ListingEntitlementGate.consume()`'s return type changes from `str` to `ConsumedRight`,** so the one call site inside `listings.submissions.submit_listing_revision` changes shape (`publication_source = consumed.publication_source`, plus `consumed.entitlement` passed to `bump_version`). Phase 11's contract rule 6 said *"the call sites in `listings.submissions` and `listings.decisions` do not change"*. Half of that holds and half does not, and the half that does not is unavoidable: a submission must hand the listing both its publication source **and** the ledger row it burned, and a bare string cannot carry two values. The keyword arguments are unchanged.
- **`listings/decisions.py` genuinely is not modified.** `publication_days(*, listing)` keeps Phase 11's exact signature and return type (`int | None`); only its *body* changes, to read the frozen `metadata["publication_days"]` before falling back to the setting. `decisions.py` appears in no task, no file list and no commit in this plan.
- **`can_submit(*, user, broker=None)` also keeps Phase 11's exact signature** — deliberately, so Phase 12's edit to the same function stays a clean merge. The cost is that `can_submit` cannot tell an initial submission from a revision, so the **call site** carries a `charges_a_right` guard (Task 8 Step 4). A later phase that wants a listing-aware gate must not "fix" this by widening `can_submit`'s signature without re-reading that guard first.

Rules a later phase must follow:

1. **Never write `UserEntitlement.state` directly.** Go through `entitlements.consumption.consume_listing_right` or one of `entitlements.services`' functions, all of which hold the transaction, the row lock, the spec §6.3 edge check and the audit event together. Django admin is read-only for exactly this reason.
2. **Never infer quota from listings.** Spec §11.9 forbids it and `entitlements` has no import of `listings` to make it possible. Count ledger rows through `entitlements.policy`.
3. **`entitlements` must never import `listings`.** The `listing` FK is a lazy string reference and every service takes a listing *instance* as an argument. Keeping the arrow one-directional is what lets `listings` depend on the gate without a cycle.
4. **Charge the owner, not the actor.** `ListingEntitlementGate.consume(listing=…, user=…)` takes the acting user for the audit trail but debits `listing.owner_user`. Any new consumption path must do the same, or a staff admin submitting on a seller's behalf would burn their own allowance.
5. **Publication duration comes from the consumed entitlement, not from the setting.** `metadata["publication_days"]` is frozen at consumption (spec §36.3). A phase that adds another publication window must freeze it the same way.
6. **Phase 14** converts `UserEntitlement.source_payment_id` (a loose `UUIDField`) into a real FK to its `PaymentOrder`, exactly as this phase converted Phase 11's `consumed_entitlement_id`. It creates `PAID_LISTING` rights with `source=STRIPE_PURCHASE`, `state=AVAILABLE` and `valid_until = now + individual.paid_entitlement_valid_days`, **only** from a verified, idempotently processed webhook (spec §1, §23.3) — never from the browser redirect. It is also the natural first producer of `RESERVED` rows; if it creates one, it must either attach it to a listing or leave `listing` NULL so `release_stale_reservations()` can time it out.
7. **Phase 15** grants `MEDIA_UPGRADE` entitlements bound to a listing and changes exactly one function body, `listings.policies.effective_media_allowance`. The per-listing uniqueness constraint is keyed on `(listing, entitlement_type)`, so a media upgrade and a listing right can coexist on one listing.
8. **Phase 16** renders spec §22.3 from `GET /api/v1/listing-eligibility/` alone. Do not re-derive quota in the client and do not add a second eligibility representation — `Eligibility.as_dict()` is the single wire format.
9. **Phase 17** builds the staff entitlement UI on `entitlements.services`' existing functions; it should add the *grant* affordance (which needs a target user) and may expose the ledger over `/api/v1/staff/...`. It must not add a second grant/revoke path.
10. **Phase 18** connects receivers to `listings.signals.listing_expiring` and `listing_expired`. `listing_expiring` carries `threshold_days`, which is spec §27.1's dedup key component; `listing_expired` fires inside `transaction.on_commit()` and `listing_expiring` does not, because a reminder writes nothing.
11. **Phase 12 must not remove the `is_initial` branch's `consumed_entitlement=consumed.entitlement` keyword** when it adds the auto-approval `else:` to `submit_listing_revision`, and must not remove or weaken the `charges_a_right` guard above the entitlement block. `is_initial` is assigned **above** that block (this phase moved it three lines up); if Phase 12 reorders that function, the assignment must stay above the guard. If Phase 12's auto-approval path publishes a private-seller listing directly (it should not — auto-approval is a broker policy), it must set `consumed_entitlement` too.
12. **Any new entitlement-related error code must be stable and documented** in this plan's Global Constraints list. The closed set today is two **envelope** codes — `listing_entitlement_required` (403) and `invalid_entitlement_state` (409) — plus one **field-level** code, `entitlement_reason_required`, which surfaces inside a 400 `validation_error` envelope as `fields: {"reason": ["entitlement_reason_required"]}` and never as `error.code`. A phase that needs a distinct top-level code must raise a plain `APIException` subclass, not a `ValidationError`, and must accept losing the per-field `fields` map. Exceptions needing extra response context set a dict attribute named `meta`; exceptions offering the client a next step set one named `action` (both are envelope passthroughs in `common.exceptions`).
13. **Never charge a right for a listing that already has a public snapshot.** Spec §6.3 charges "initial approval" only, and spec §20.2's post-publication edit shares the submit path. `ListingEntitlementGate.consume()` short-circuits on `listing.current_public_snapshot_id is not None`, and the call site's `charges_a_right` guard mirrors it. Checking `consumed_entitlement_id` alone is **not** sufficient: Phase 11's Known Limitation 1 means that column is NULL on every pre-Phase-13 published listing, so such a listing's first revision would be charged a fresh free right (flag off) or refused with a 403 (flag on).

---

## Self-Review

**1. Spec coverage — §22 (Phase 13), line by line:**

| Spec §22 requirement | Where implemented |
|---|---|
| §22.1 One free listing activation per rolling 365-day period | Task 3 (`free_quota_state`), Task 14 done-1 |
| §22.1 Approved publication lasts 30 days | Task 8 (`publication_days`), consumed by Phase 11's `approve_revision` unchanged |
| §22.1 Rolling period starts when the free entitlement is consumed on submission | Task 3 (window keyed on `consumed_at`), Task 6 (`consumed_at=now` at submit), Task 14 `test_spec_22_1_the_rolling_period_starts_at_consumption_not_publication` |
| §22.1 A rejected submission can be corrected without consuming a second right | Task 6 (`consume_listing_right`'s existing-right short-circuit), **Task 8 Step 4's `charges_a_right` guard on the pre-check** (without it the unlocked `can_submit` would 403 before the short-circuit is ever reached), Task 8 `test_resubmitting_a_withdrawn_listing_does_not_burn_a_second_right` |
| §20.2 / §6.3 A post-publication edit of an already-PUBLISHED listing is neither charged nor refused | Task 8 (`consume()`'s `current_public_snapshot_id is not None` short-circuit + the call-site guard), Task 8 `test_a_legacy_published_listing_is_revisable_without_burning_a_right`. Gating on `consumed_entitlement_id` alone would regress every Phase 11-era published listing, whose column is always NULL |
| §22.1 Permanent policy rejection leaves the right consumed unless staff restores it | Task 13 (`restore_consumed_right`), Task 3 (`REVOKED` rows are not counted) |
| §22.1 Deleting/archiving/selling does not reset free quota | Task 3 (ledger-only arithmetic), Task 7 (`PROTECT` makes a hard delete impossible), Task 14 `test_spec_22_1_deleting_the_listing_does_not_reset_the_quota` |
| §22.1 Eligible again once 365 days have elapsed | Task 3, Task 14 `test_spec_22_1_the_window_reopens_after_the_period` |
| §22.2 `ListingEligibilityService.for_user(user)` returning the six-key payload | Task 4 (`Eligibility.as_dict()`), Task 5 (the endpoint), Task 4 `test_payload_has_exactly_the_spec_22_2_keys` |
| §22.2 Evaluate at Sell landing CTA / dashboard CTA / create route | **Frontend — Phase 16.** The single backend source they call is Task 5's endpoint (Known Limitation 2) |
| §22.2 Evaluate at draft creation API | Task 9 (`ensure_can_start_listing` inside `create_listing_draft`) |
| §22.2 Evaluate at final submission inside a locked transaction; last check authoritative | Task 6 (`consume_listing_right` recomputes under `lock_user_quota`), Task 8 (call site inside `submit_listing_revision`'s transaction) |
| §22.3 Primary control disabled, does not navigate to an empty form | **Frontend — Phase 16**, driven by `can_start_listing` (scope ruling + Known Limitation 2) |
| §22.3 "You have used your free listing. Buy a new listing right." | **Frontend — Phase 16**; §37 keys `listing.free_allowance_used` / `listing.buy_right` reserved in the Contract summary |
| §22.3 CTA shows product name, price, currency, inclusions, publication duration, entitlement expiry, refund link | Partly: publication duration and entitlement expiry ship in `recommended_entitlement`; product name/price/currency/refund link need `MarketplaceProduct` — **Phase 14** (Known Limitation 1) |
| §22.3 Confirming creates a Stripe Checkout Session | **Phase 14** (spec §23.2) |
| §22.3 If a paid right exists, show "Use an available listing right" | Backend source shipped: `paid_listing_rights_available` and `recommended_entitlement.entitlement_type == PAID_LISTING` (Task 4 `test_an_exhausted_seller_with_a_paid_right_may_start`); copy is Phase 16 |
| §22.4 `POST /listings/drafts/` returns `403 listing_entitlement_required` | Task 9 |
| §22.4 May reserve a paid right or mark free eligibility without consuming | Ruled: validates without reserving (scope ruling), consumption deferred to submit per spec §6.3 |
| §22.4 `POST /listings/<id>/submit/` locks, revalidates and consumes once | Tasks 6, 8 |
| §22.4 Concurrent requests cannot consume one entitlement twice | Task 6 (`lock_user_quota` + the lock assertion test), Task 2 (the per-listing uniqueness constraint), Task 14 done-3 |
| §22.5 Daily task marks due listings EXPIRED | Tasks 10 (`expire_due_listings`, beat entry) |
| §22.5 Removed from public search/sitemap | Task 10 — automatic via `published_listings_queryset()`; proved end to end in Task 10 and Task 14 done-4 |
| §22.5 Dashboard access preserved | Task 10 (nothing is deleted, no read path closed), Task 14 done-4 |
| §22.5 Notifies owner before and at expiry; defaults 7 and 1 day | Task 11 (`listing_expiring` × 2 thresholds), Task 10 (`listing_expired`); receivers are **Phase 18** (Known Limitation 6) |
| §22.5 Reactivation requires a new paid right unless staff error | Precondition shipped (Tasks 3, 6, 13); the transition is undefined in spec §6.1 — ruled out of scope (Known Limitation 4) |
| Done 1 — Free limits adjustable without code deployment | Task 3 (all five numbers from `platform_settings`), Task 14 done-1 |
| Done 2 — UI and API agree on eligibility | Task 4/5 (one service, one representation, both flag states), Task 14 done-2 |
| Done 3 — Multiple tabs cannot create multiple free listings | Tasks 6, 8, Task 14 done-3 |
| Done 4 — Expired listings disappear publicly, remain manageable privately | Tasks 10, Task 14 done-4 |

**2. Spec coverage — cross-referenced sections:** §11.9's `UserEntitlement` (all thirteen listed fields, plus `granted_by` by documented ruling and `source_payment` as a loose id) → Task 2; its "Free use is also recorded as an entitlement/ledger entry" → Task 6; its "Do not infer historical quota solely from current listings" → Task 3 and the app-boundary ruling. §6.3's four transition lines → Task 1 (`ENTITLEMENT_TRANSITIONS`, with the documented `AVAILABLE -> CONSUMED` reading), Task 12 (both time-driven edges), Task 13 (the `CONSUMED -> REVOKED` remedy and its documented widening). §6.3's "Reservations expire after 30 minutes unless attached to a saved draft" → Task 12 (`release_stale_reservations`). §6.3's "Consumption happens when the listing is submitted for initial approval" → Tasks 6, 9 (the draft gate deliberately does not consume). §10.1's five `individual.*` settings → Task 3 (read, never re-declared — the registry is untouched). §26.3's four staff capabilities → Task 13 (grant, revoke, restore) and Task 2 (the read-only ledger admin), with the missing grant *affordance* in Known Limitation 9. §26.4's "staff must not edit Stripe-paid order status manually" → respected: nothing here touches a payment record. §30.1's `GET /api/v1/listing-eligibility/` → Task 5. §30.2's envelope, stable codes and the worked `action` block for this exact code → Task 6. §31's "Listing CTA availability → `ListingEligibilityService`" and "Free-right copy/countdown → entitlement ledger + platform settings ... exact next eligibility date" → Tasks 4, 5 (`next_available_at`). §35.1's `individual_entitlements` flag → Task 2 (seeded disabled) and the flag ruling. §35.2 step 4's "deploy code with features off" → the same ruling. §36.3's six free-and-paid-rights rules → Task 3 (prospective config, raised/lowered count), Task 6 (frozen publication duration, one right per publication cycle), Task 13 (staff grant records who/why/expiry). **The sixth — "a draft abandoned before submission releases reservation" — is deliberately NOT implemented and is NOT covered by Task 12.** `release_stale_reservations()` filters on `listing__isnull=True`, which by construction never matches a draft-linked reservation; spec §6.3 exempts those from the clock and assumes some other abandonment-release flow, and this codebase has none (no listing deletion, archival or abandonment mechanism exists — `ListingStatus.ARCHIVED` is unreachable). The rule is vacuously satisfied here because this phase never creates a draft-attached reservation in the first place (see the draft-reservation ruling), and it becomes a real obligation for whichever phase first produces one — Phase 14 or Phase 15, per Contract summary rule 6. §36.4's separation of moderation from entitlement remedies → Task 13's `test_restoring_does_not_touch_the_listing_it_published`. §27.1's `listing.expiring` and `listing.expired` rows, including their dedup keys → Tasks 10, 11. §2.4's audit requirement → every state change in Tasks 6, 10, 12, 13. §38's "Individual policy: 1 free use / 365 days / 30 publication days" and "Paid policy defaults: 30 publication days / 365 unused-right validity" → already seeded by Phase 2's `0002_seed_default_settings`; this phase adds no seed data and needs none. §34.2's concurrency requirement → Task 6's lock assertion and Task 14 done-3, with the stronger two-connection test deferred in Known Limitation 12.

**Gaps deliberately left, with the owning phase named:** §22.3's rendered UI and its product/price content (Phases 16 and 14), §22.5's reactivation transition (undefined in §6.1), the `RESERVED` producer (Phases 14/15), `MEDIA_UPGRADE` behaviour (Phase 15), the staff ledger API and the grant affordance (Phase 17), notification delivery (Phase 18), and everything in Known Limitations above. No spec §22 requirement is unaccounted for.

**3. Placeholder scan:** no task contains "TBD", "TODO", "implement later", "add appropriate error handling", "handle edge cases", "similar to Task N", or a test described but not written. Every code step carries the real code, including both fixtures: the `broker_seller` fixture (Task 8) is written out in terms of the real `brokers/tests/factories.py` helpers `make_broker`/`make_membership`, and the `published_listing_with_snapshot` fixture (Task 10) is written out in full against `listings/tests/factories.py`'s `make_snapshot`. One place still tells the implementer to read an existing file rather than restating it — the `test_policies.py` edits (Task 8 Step 5), which change three named assertions in a Phase 11 file this plan does not otherwise own; that is a deliberate refusal to restate Phase 11's test module from memory, not an unwritten step. `release_stale_reservations` (Task 12) is a mechanism with no producer in this phase, built because spec §6.3 mandates the rule; it is complete, tested and flagged, following Phase 5's precedent for the §14.3 legacy-import mechanism. The one `xfail` in the plan (Task 6's envelope test) is created and removed within the plan, in Tasks 6 and 9, with both steps spelled out.

**4. Type and name consistency (checked across every task's Interfaces block):**
- `free_quota_state(user, *, now=None) -> FreeQuotaState` — same signature in Tasks 3, 4, 6, 13.
- `available_paid_rights(user, *, now=None) -> QuerySet[UserEntitlement]` — same in Tasks 3, 4, 6.
- `ListingEligibilityService.for_user(user, *, now=None) -> Eligibility` — same in Tasks 4, 5, 6, 8.
- `consume_listing_right(*, user, listing, actor, now=None) -> UserEntitlement` — defined in Task 6, called once, from `ListingEntitlementGate.consume` in Task 8. It returns the **ledger row**, not a `ConsumedRight`; the `ConsumedRight` wrapper exists only in `listings.policies` so `entitlements` never imports `listings`.
- `ListingEntitlementGate.consume(*, listing, user) -> ConsumedRight` — Task 8's definition, Task 8's single call site in `submit_listing_revision`, and Task 8's updated `test_policies.py` all use the `ConsumedRight` return type. Phase 11's `str` return is replaced everywhere it was read (one place: `publication_source = ...`).
- `ListingEntitlementGate.can_submit(*, user, broker=None)` and `.publication_days(*, listing)` — signatures **unchanged** from Phase 11, so `listings.decisions.approve_revision` needs no edit and `listings/decisions.py` appears in no task. Because `can_submit` takes no listing, Task 8 Step 4's call site wraps it in a `charges_a_right` guard (`is_initial and listing.consumed_entitlement_id is None`); `consume()` re-checks the same two conditions itself, so the guard is an early exit and not the authority.
- `published_listing_with_snapshot` — defined **once**, in `backend/conftest.py` (Task 10), and consumed from two app test packages: `listings/tests/test_expiry.py` (Task 10) and `entitlements/tests/test_phase_acceptance.py` (Task 14). It yields a single `BoatListing`, never a `(listing, snapshot)` tuple, and both consumers use it that way. `listings/tests/test_public_read_api.py`'s own `_published()` tuple helper is untouched and stays module-local.
- `EntitlementReasonRequired` — a `ValidationError` subclass everywhere it appears (Task 13's Interfaces block, its code and its test), and described consistently in Global Constraints and Contract summary rule 12 as a **field-level** code inside a 400 `validation_error` envelope, never as a top-level envelope code. Its test asserts the dict form of `get_codes()`.
- `ListingEntitlementRequired` — an `APIException` subclass with a scalar detail, so `get_codes()` **does** return the bare string `"listing_entitlement_required"`, which is what Tasks 6 and 9 assert. The two exceptions differ deliberately; do not copy one's assertion style onto the other.
- `listing.consumed_entitlement_id` — used in Tasks 6, 8, 9 and in every test; valid both before Task 7 (a `UUIDField` of that name) and after it (the FK's attname). `listing.consumed_entitlement` (the object) is used only in Tasks 7, 8 and their tests, all of which run after the conversion.
- `_transition(...)` — defined once in Task 12, called by `expire_due_entitlements`, `release_reservation` and `release_stale_reservations` in Task 12; Task 13's `_revoke` deliberately does **not** use it, because it must widen the allowed source states and write three fields, and that divergence is documented at the ruling in Task 13 Step 3.
- `_audit(...)` — defined in Task 12's `services.py`, reused by Task 13's `grant_listing_right` and `_revoke`. `entitlements/consumption.py` has its own private `_audit` with a different signature; the two modules never import each other's, and neither is exported.
- `EXPIRY_REMINDER_DAYS` — defined in Task 10's `expiry.py`, read by Task 11's `send_expiry_reminders` and asserted in Task 11's test.
- `expire_due_listings` — the service in `listings.expiry` and the Celery task in `listings.tasks` share the name deliberately; the task module imports the service as `_expire_due_listings` so the two never shadow each other, and the Contract summary imports the task under an alias.
- Feature-flag keys are literals in exactly three places and identical in all of them: `entitlements.enums.INDIVIDUAL_ENTITLEMENTS_FLAG`, the seed migration in Task 2, and the test fixtures — `"individual_entitlements"`.
- Error codes are a closed set of three, listed once in Global Constraints and used verbatim in Tasks 5, 6, 8, 9, 12, 13.
- Enum member names (`EntitlementType.FREE_LISTING`, `EntitlementSource.STAFF_GRANT`, `EntitlementState.CONSUMED`, `BlockingReason.FREE_ALLOWANCE_USED`, `PublicationSource.PAID_ENTITLEMENT`, `ListingStatus.EXPIRED`) are identical everywhere they appear.
- Route name `listing-eligibility` is identical in Task 5's `urls.py` and in every `reverse()` call in Tasks 5 and 14.
