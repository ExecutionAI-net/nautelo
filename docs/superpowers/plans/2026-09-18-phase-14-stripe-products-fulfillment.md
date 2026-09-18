# NAUTA Phase 14 — Stripe Products, Checkout and Fulfillment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Phase 13's entitlement ledger into something a private seller can actually buy: two staff-configured `MarketplaceProduct` rows, a server-authored Stripe Checkout Session created against a local `PaymentOrder`, and a signature-verified, replay-proof webhook that is the **only** thing in this system that may create a paid `UserEntitlement` — exactly once per order, whatever Stripe delivers, in whatever order, however many times.

**Architecture:** One new Django app, `payments`, holding spec §11.9's three remaining models (`MarketplaceProduct`, `PaymentOrder`, `ProcessedWebhookEvent`) and five thin service modules (`products`, `checkout`, `webhooks`, `fulfillment`, `refunds`). Every Stripe call goes through one injectable seam, `payments.gateway.StripeGateway`, so no test in this repository ever opens a socket; signature verification is the one place that calls the real `stripe` library in tests, because verifying Stripe's actual HMAC scheme against a forged header is the whole point of that test. The webhook is transactional and idempotent by `stripe_event_id`: the dedup row and the fulfillment live in one `transaction.atomic()`, so a duplicate delivery returns 200 having written nothing and a crashed handler rolls its own replay lock back so Stripe's retry can still fulfil. The browser never grants anything: the success page polls `GET /api/v1/payment-orders/<id>/`.

**Tech Stack:** Python 3.13 + `uv`, Django 5.2, Django REST Framework, PostgreSQL 16 (`127.0.0.1:5433`), Redis (`127.0.0.1:6380`), Celery; `stripe` **15.6.1**, already a declared dependency in `backend/pyproject.toml` and already pinned in `backend/uv.lock`. **No new third-party dependency is added by this phase.** This phase is **backend-only** — see the scope rulings.

**Spec:** [`NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md`](../../../NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md) — **§23 (Phase 14: §23.1 Products, §23.2 Checkout creation, §23.3 Webhook processing, §23.4 Refunds/disputes, §23.5 Staff product UI, Acceptance tests — the primary and authoritative source)**, plus §1 (fixed product decisions), §2.2/§2.3/§2.4 (server authority, atomic state changes, auditability), §2.5 (no misleading finance language), §3 (Stripe Checkout for one-time entitlement purchases), §4.1/§4.2 (the routes a return URL may point at), §5 ("Configure products/settings" is staff-admin only; "A moderator cannot change payment products unless separately granted staff-admin permission"), §6.3 (entitlement state machine), §6.4 (payment state machine), §11.9 (`MarketplaceProduct`, `UserEntitlement`, `PaymentOrder`, `ProcessedWebhookEvent` field lists), §12 item 3 (verified email required for Checkout creation), §22.3 (the CTA this phase supplies the backend for), §26.3/§26.4 (staff entitlement and product operations), §30.1 (endpoint inventory), §30.2 (response envelope), §30.3 (`Idempotency-Key` on Checkout creation), §30.4 (rate limits), §31 (traceability: "Product card/price → `MarketplaceProduct` + verified Stripe price → Checkout Session → unavailable/mismatch warning"), §32.1 step 8 (seed products inactive, attach Stripe IDs per environment), §33.1 (verify Stripe signatures from raw body; allowlist local return URLs; prevent open redirects), §33.2 (privacy/data minimization), §34.1–§34.4 (test classes), §35.1 (`stripe_entitlement_checkout` flag), §35.2 (deployment sequence), §35.3 ("Do not roll back a fulfilled Stripe entitlement by deleting it"), §35.4 ("Verify paid orders fulfill exactly once"), §36.3 (free and paid rights), §38 (seed data: "Two product records, inactive until valid environment Stripe IDs are supplied"; "Production setup must not include … decorative financial values or test Stripe IDs"), §39 (developer execution protocol), §40 Scenario H, §41 (Stripe Checkout fulfillment and Stripe webhooks references).

**Predecessor plans (read before starting — this plan does not restate their contracts, it obeys them):**

- [`2026-09-18-phase-13-quota-entitlement.md`](./2026-09-18-phase-13-quota-entitlement.md) — **hard dependency, partially merged.** Its "Contract summary for later phases" rule 6 is this phase's charter:
  > *"**Phase 14** converts `UserEntitlement.source_payment_id` (a loose `UUIDField`) into a real FK to its `PaymentOrder` … It creates `PAID_LISTING` rights with `source=STRIPE_PURCHASE`, `state=AVAILABLE` and `valid_until = now + individual.paid_entitlement_valid_days`, **only** from a verified, idempotently processed webhook (spec §1, §23.3) — never from the browser redirect. It is also the natural first producer of `RESERVED` rows; if it creates one, it must either attach it to a listing or leave `listing` NULL so `release_stale_reservations()` can time it out."*

  Its rules 1, 2, 3, 5, 7, 12 and 13 are equally binding and are quoted where they bite. Its Known Limitations 1, 3, 7, 8 and 13 name this phase. **Only Tasks 1–3 of that plan are merged into `dev`** — see the "Phase 13 reconciliation required" section below, which is mandatory reading before Task 11.
- [`2026-09-18-phase-11-listing-workflow.md`](./2026-09-18-phase-11-listing-workflow.md) — merged in full. Source of `BoatListing`, `ListingStatus`, `listings.tests.factories`, and the "loose reference, converted by the next phase" pattern this plan repeats for `source_payment`.
- [`2026-09-18-phase-12-broker-policy.md`](./2026-09-18-phase-12-broker-policy.md) — merged in part; source of the **structural template** for this document (Execution Model, Global Constraints, Scope rulings, Contract summary, Known Limitations) and of the staff-endpoint house style in `brokers/views.py`.

**Phase dependencies:** spec §7 and `docs/superpowers/PHASE-TRACKER.md` — Phase 14 depends on Phase 13 only. Phase 15 (media allowance) and Phase 17 (staff back office) depend on this one. Phases 6, 9, 10, 12, 13 are in flight concurrently; the collision notice below states this plan's footprint outside `backend/payments/` exactly.

---

## Execution Model

Per the standing project convention recorded in `ACTIVITY.md`:

- **One worktree per task.** Each task is implemented on its own branch cut from the current tip of `dev` (`git worktree add ../nautelo-worktree-p14-task-N -b task-N-<slug> dev`), run through `subagent-driven-development`'s implementer → task-reviewer → fix-loop cycle, opened as a PR (`gh pr create`), and merged by the controller only when CI is green and the branch is cleanly mergeable.
- **Tasks run strictly sequentially.** Never two branches in flight at once; each new task branches from the just-merged `dev` tip. This includes Task 1, the scaffolding task. Tasks 4 and 11 additionally require a Phase 13 reconciliation check (below) before their branch is cut.
- **CI gates (`.github/workflows/ci.yml`, runs on every PR to `dev`):** `uv run python manage.py check`, then `uv run pytest -v` against the job's own PostgreSQL 16 + Redis 7 services and a MinIO bucket. The Stripe env vars CI supplies are `STRIPE_SECRET_KEY=sk_test_ci`, `STRIPE_PUBLISHABLE_KEY=pk_test_ci`, `STRIPE_WEBHOOK_SECRET=whsec_test_ci` — placeholders that reach no Stripe account, which is why **every test in this plan must pass with them**. A task whose test needs a different webhook secret sets it per-test with pytest's `settings` fixture, never in a settings module. The frontend job runs `pnpm lint`, `pnpm test`, `pnpm build`; this phase changes no frontend file, so that job must stay green untouched.
- **Local gate before opening any PR:** `cd backend && uv run pytest -q` must be green **in full**, not just the task's own file. Migrations must be additive and `uv run python manage.py makemigrations --check --dry-run` must report no missing migration.
- **Mutation check (per task, before requesting review).** For each new guard the task adds, break it deliberately and confirm a *named* test fails — then revert. Each task lists its own mutations under "Mutation check". A guard whose mutation leaves the suite green is an untested guard, and the task is not done.

---

## Global Constraints

Exact values copied from the spec. Every task's requirements implicitly include this section.

### Spec §23.1's two products, verbatim

1. **`INDIVIDUAL_LISTING_RIGHT`** — "Grants one paid listing entitlement." / "One-time payment." / "Default entitlement validity: 365 days from purchase." / "Default publication: 30 days from staff approval/publication."
2. **`LISTING_MEDIA_UPGRADE`** — "Grants one upgrade bound to one eligible private-seller listing." / "Raises total allowance to 20 images and 1 video." / "Cannot be transferred after binding."

"Staff product management supports **exactly these product codes in this release**." The set is closed and enforced by a database `CheckConstraint`, not only by an enum.

### Spec §6.4's payment state machine, verbatim

```text
CREATED -> CHECKOUT_OPEN -> PAID -> FULFILLED
                         -> FAILED
                         -> EXPIRED
PAID/FULFILLED -> REFUNDED or DISPUTED
```

"`PAID` means Stripe has confirmed payment. `FULFILLED` means an entitlement was created exactly once. Repeated webhook delivery must return success without creating a second entitlement."

### Spec §23.3's nine steps, verbatim

1. Read raw body. 2. Verify Stripe signature with the environment-specific secret. 3. Insert `ProcessedWebhookEvent`; duplicate event ID returns HTTP 200 without re-fulfillment. 4. For completed/paid Checkout, lock `PaymentOrder`. 5. Verify expected user, product, amount, currency, mode and payment status. 6. Mark paid and create exactly one entitlement. 7. Link entitlement and mark fulfilled. 8. Commit. 9. After commit, notify user and refresh WebSocket eligibility state.

"The success page polls/read-fetches order status and may show 'Payment received; activating your right' until webhook fulfillment completes. **It must never grant the right itself.**"

### Security constraints (non-negotiable; every one has a named test)

- **No card data, ever.** Nothing in this phase accepts, stores, logs or proxies a card number, CVC, expiry, cardholder name or payment-method detail. Stripe Checkout is hosted by Stripe; this codebase stores only Stripe **identifiers** (`cs_…`, `pi_…`, `prod_…`, `price_…`, `evt_…`), an amount, a currency and a status. `PaymentOrder` has no `last4`, no `brand` and no receipt body, and a reviewer seeing such a field must reject the task.
- **Secrets never reach a log, a response body or an audit event.** `settings.STRIPE_SECRET_KEY`, `settings.STRIPE_WEBHOOK_SECRET`, the raw webhook body and the `Stripe-Signature` header are never passed to `logger.*`, never placed in `record_audit_event(metadata=…)`, and never echoed in an error envelope. The webhook's 400 response has **no body at all** — a verbose rejection is a signature oracle.
- **Raw body only.** Signature verification runs on the exact bytes Django received (`request.body`), never on a re-serialized dict. The webhook view must not touch `request.data` before verifying, because DRF's parsers consume the stream.
- **Replay and clock skew.** `stripe.Webhook.construct_event` is called with an explicit `tolerance=STRIPE_SIGNATURE_TOLERANCE_SECONDS` (**300**, Stripe's own default), which rejects a signature whose `t=` timestamp is outside the window. An attacker replaying a genuine old body with its genuine old signature is rejected twice over: by tolerance, and by the `stripe_event_id` unique index.
- **Idempotent by event id.** Every accepted event writes one `ProcessedWebhookEvent` row keyed on `stripe_event_id unique`. A duplicate delivery returns **HTTP 200 having written nothing** — the spec's own acceptance test is "Duplicate webhook produces one entitlement".
- **Out-of-order tolerant.** Handlers are written as state-machine transitions guarded by `can_transition_payment()`, never as "apply the event". A `checkout.session.completed` arriving after `charge.refunded` cannot resurrect a refunded order; a second `charge.refunded` after the first is a no-op.
- **Amounts and products come from the server.** The Checkout request body carries `product_code`, an optional `listing_id` and an optional `return_url` — **never** an amount, a currency, a price id or a quantity. The amount charged is Stripe's `Price`, resolved server-side from `MarketplaceProduct.stripe_price_id`.
- **No open redirect.** `return_url` is a **path**, validated against a closed allowlist of spec §4.1/§4.2 routes; the absolute URL handed to Stripe is always `settings.PUBLIC_BASE_URL` + that path. Absolute URLs, scheme-relative `//host`, backslashes, `..`, and any path not on the allowlist are refused with `invalid_return_url`.
- **Tests never open a socket.** Every service takes a `gateway` argument defaulting to `payments.gateway.default_gateway()`; tests pass `FakeStripeGateway`. `backend/payments/tests/conftest.py` additionally installs an autouse fixture that makes `stripe.StripeClient` raise, so an accidental real call fails loudly instead of hanging CI. The *one* deliberate real-library call in tests is `stripe.Webhook.construct_event` inside signature verification, exercised through `common.tests.stripe_helpers.generate_stripe_signature`, which implements Stripe's real `t=…,v1=HMAC-SHA256(f"{t}.{payload}")` scheme.

### Platform constraints

- Backend: Python 3.13 + `uv` for every dependency and command, Django 5.2, DRF for every JSON API, PostgreSQL 16 and Redis from the repo's `docker-compose.yml` (Postgres `127.0.0.1:5433`, Redis `127.0.0.1:6380`). Backend dev server port is **8020**.
- **Tests run against PostgreSQL, never SQLite.** `backend/config/settings/test.py` MUST NOT be modified to override `DATABASES` or `CACHES` to SQLite / `LocMemCache`. This rule was violated and reverted once already in this project. This phase depends on it hard: partial `UniqueConstraint`s, `CheckConstraint`s and `select_for_update()` are all load-bearing here and none behave correctly on SQLite.
- **`cache.clear()` is forbidden in any conftest or test.** The repo-root `backend/conftest.py` already clears only keys under this checkout's `KEY_PREFIX` (`clear_own_cache_keys`), because several worktrees share one Redis DB. This plan's `payments/tests/conftest.py` deletes **named keys only** (`SETTINGS_CACHE_KEY` and `feature_flag_cache_key("stripe_entitlement_checkout")`), copying the `entitlements/tests/conftest.py` pattern verbatim.
- All primary keys are UUIDs; all timestamps are timezone-aware UTC (spec §11 preamble). Every new model inherits `common.models.UUIDTimeStampedModel`, except `ProcessedWebhookEvent`, which is append-only and inherits `common.models.UUIDModel` (the `audit.AuditEvent` precedent: an `updated_at` would imply the row may legitimately change).
- User references use `settings.AUTH_USER_MODEL` in model fields and `django.contrib.auth.get_user_model()` in code/tests — never a hardcoded `"accounts.User"` string (Phase 3 contract rule 1).
- **Rate limiting uses `common.throttling.HashedIPScopedRateThrottle`**, already installed as `DEFAULT_THROTTLE_CLASSES`. Views declare **only** `throttle_scope`, never `throttle_classes` (Phase 3 contract rule 9). **New scope added by this plan: `checkout_create` = `10/min`** (spec §30.4 lists "Checkout creation"). The webhook view declares **no** `throttle_scope` — `ScopedRateThrottle` allows any view without one, and throttling Stripe's retries would create exactly the paid-not-fulfilled state §35.4 tells us to watch for.
- **Money and time in JSON:** decimal strings for money, ISO 8601 UTC for times (spec §30.2). `amount` and `display_amount` serialize as strings (`"49.00"`), never as floats. Stripe's API speaks **minor units** (integer cents); the conversion lives in exactly one place, `payments.products.minor_units()` / `from_minor_units()`, and is tested against a currency with two decimals.
- **Error envelope** (spec §30.2): produced by `common.exceptions.nauta_exception_handler` as `{"error": {"code", "message", "fields", "request_id"}}`, plus an optional `meta` key when the exception defines a non-empty dict attribute named `meta`. **Read `backend/common/exceptions.py` before writing any error assertion.** That handler flattens **every** DRF `ValidationError` — subclass or not — to the top-level code `validation_error`, so a code a client must branch on **cannot** be a `ValidationError`. Every named code below is therefore an `rest_framework.exceptions.APIException` subclass with an explicit `default_code`, declared in `backend/payments/errors.py`.
- **New stable machine codes introduced by this phase (closed set; persisted in client code, never renamed):**

  | Code | HTTP | Raised when |
  |---|---:|---|
  | `product_not_available` | 409 | Product code unknown, inactive, or not fully configured |
  | `product_price_mismatch` | 409 | Stored `display_amount`/`currency` differs from Stripe's live `Price` (spec §23.5: "Checkout is blocked until reconciled") |
  | `invalid_return_url` | 400 | `return_url` is not an allowlisted local path |
  | `listing_required_for_product` | 400 | `LISTING_MEDIA_UPGRADE` requested with no `listing_id` |
  | `listing_not_upgradable` | 409 | Listing is not a private listing owned by the caller, or is already upgraded |
  | `idempotency_key_required` | 400 | `Idempotency-Key` header missing or blank on Checkout creation (spec §30.3) |
  | `idempotency_key_reused` | 409 | Same `Idempotency-Key`, different request payload |
  | `payment_gateway_unavailable` | 502 | Stripe returned a transport/API error while creating a session |
  | `feature_disabled` | 403 | `stripe_entitlement_checkout` is off (reused from Phase 11's `ListingWorkflowEnabled`, same string) |

  Codes reused unchanged: `validation_error`, `not_found`, `staff_admin_required`, `email_not_verified`, `authentication_required`, `throttled`.
- **New audit `action` values introduced by this phase (stable; queried by the staff product screen, never renamed):** `payment_order.created`, `payment_order.checkout_opened`, `payment_order.paid`, `payment_order.fulfilled`, `payment_order.mismatch`, `payment_order.failed`, `payment_order.expired`, `payment_order.refunded`, `payment_order.disputed`, `product.created`, `product.updated`, `product.deactivated`. Every one is written through `audit.services.record_audit_event()` **inside the same `transaction.atomic()` block** as the change it describes. Its real signature (read `backend/audit/services.py`, do not guess):

  ```python
  record_audit_event(
      *, actor_user, actor_type: str, action: str, target_type: str, target_id: str,
      source: str, before: dict | None = None, after: dict | None = None,
      request_id: str | None = None, metadata: dict | None = None, ip_hash: str | None = None,
  ) -> AuditEvent
  ```

  `actor_type` takes values from `AuditEvent.ActorType` (`USER` | `SYSTEM` | **`STRIPE`**) and `source` from `AuditEvent.Source` (`WEB` | `API` | `ADMIN` | `TASK` | **`WEBHOOK`**). Both Stripe-shaped values already exist in merged code and are what every webhook-driven event in this phase uses: `actor_type=AuditEvent.ActorType.STRIPE`, `source=AuditEvent.Source.WEBHOOK`, `actor_user=None`.
- **Feature flag key for this phase:** **`stripe_entitlement_checkout`** (spec §35.1's list, verbatim), seeded **DISABLED** by data migration and **never enabled by code** — not in a migration, not in a fixture, not in a settings module (spec §35.2 step 4: "Deploy code with features off/read-compatible"; step 10 enables it by hand). It gates **Checkout creation only**; see the ruling.
- **Feature flags are read, never re-declared.** `platform_settings.services.is_feature_enabled(key, default=False)` is the only reader. `individual.paid_entitlement_valid_days` and `individual.paid_publish_days` already exist in `backend/platform_settings/registry.py`; **this plan adds no registry key and does not modify that file.**
- **Every state change writes an immutable audit event** (spec §2.4) containing actor, action, target, before/after and source.
- **No business rule lives only in a view** (spec §3): every rule here is a service function that the view, the admin action and the webhook all call.
- **No partial or visual-only implementations, no faked data, no TODO placeholders for backend enforcement** (spec §39).
- TDD per task: write the failing test, run it and **read the failure**, write the minimal implementation, run it and see it pass, commit.
- **Where a task says "append to" an existing module, its code block repeats the imports that block needs.** Consolidate them into the module's single import section at the top rather than leaving mid-file `import` statements — `payments/models.py`, `payments/views.py`, `payments/serializers.py`, `payments/urls.py` and `payments/errors.py` each grow across several tasks.
- **Every `config/settings/base.py` and `config/urls.py` edit in this plan is additive and one line long.** Read the real file, add to it, never paste over it.

---

## Cross-phase collision notice (read this first)

Phases 6, 9, 10, 12 and 13 are in flight concurrently. This plan therefore states its footprint **outside `backend/payments/`** exactly. Everything not in this table is untouched.

| File | This plan's change | Task | Collision risk |
|---|---|---|---|
| `backend/config/settings/base.py` | **Two append-only one-liners:** `"payments",` at the end of `INSTALLED_APPS`, and `"checkout_create": "10/min",` at the end of `DEFAULT_THROTTLE_RATES`. Nothing is reordered, reformatted or removed. | 1, 8 | Low — every concurrent phase appends here too. Trivial rebase, not a conflict. |
| `backend/config/urls.py` | **One append-only one-liner** (`path("api/v1/", include("payments.urls"))`, Task 8) plus **two modified lines** (Task 9): the `from common.views import HealthCheckView, StripeWebhookView` import loses `StripeWebhookView`, and the existing `path("api/v1/stripe/webhook/", …)` line's view reference changes to `payments.views.StripeWebhookView`. **The URL string and the route `name="stripe-webhook"` do not change.** This is the only non-append edit to a shared file in this plan, and it is called out again in Task 9. | 8, 9 | Low, but **read the real file before editing** — Phases 6, 9 and 10 each add their own `include`. |
| `backend/common/views.py` | Task 9 **removes** `StripeWebhookView` and the now-unused `import stripe`. `HealthCheckView` is untouched. | 9 | Low. `common/throttling.py`, `common/ip.py`, `common/exceptions.py` and `common/middleware.py` — the files concurrent phases touch — are **not** modified by this plan at all. |
| `backend/common/tests/test_stripe_webhook.py` | **Deleted** in Task 9, superseded by `payments/tests/test_webhook_security.py`, which keeps both of its assertions and adds eight more. Deleting it in the same commit that moves the view is what keeps the suite honest — a test file still importing the removed view would fail collection. | 9 | None. |
| `backend/common/tests/stripe_helpers.py` | **Append-only:** `generate_stripe_signature` gains a keyword-only `timestamp: int | None = None` parameter, defaulting to `int(time.time())`. Every existing call site keeps working unchanged. | 9 | None. |
| `backend/entitlements/models.py` | **One field:** `source_payment_id = models.UUIDField(...)` → `source_payment = models.ForeignKey("payments.PaymentOrder", null=True, blank=True, on_delete=models.PROTECT, related_name="granted_entitlements")`. No constraint, index, queryset method or `Meta` change. | 4 | **Medium — `entitlements/` is in flight (Phase 13 Tasks 5–14).** Those tasks create `eligibility.py`, `consumption.py`, `services.py`, `tasks.py`, `views.py`, `urls.py` and extend `admin.py`; **none of them touches `models.py` or adds an `entitlements` migration after `0002`.** Task 4 must re-verify that before branching. |
| `backend/entitlements/migrations/0003_userentitlement_source_payment.py` | **New file**, depending on `("entitlements", "0002_seed_individual_entitlements_flag")` and `("payments", "0001_initial")`. | 4 | Low — no other in-flight task adds an `entitlements` migration. If one has appeared, renumber. |
| `backend/entitlements/tests/test_user_entitlement_model.py` | **One string** in the spec-§11.9 field-name set: `"source_payment_id"` → `"source_payment"`. Nothing else in the file changes. | 4 | Low — no Phase 13 task modifies this file after its Task 2. |
| `backend/entitlements/tests/factories.py` | **Unchanged.** `make_entitlement(..., source_payment_id=None)` keeps working verbatim after the FK conversion, because Django accepts `Model.objects.create(source_payment_id=<uuid or None>)` for a FK named `source_payment`. Task 4 proves this with a test rather than editing the factory, which is what keeps the merge with Phase 13's in-flight tasks clean. | 4 | None, deliberately. |
| `backend/entitlements/admin.py` | **Unchanged.** `UserEntitlementAdmin.readonly_fields` is computed as `tuple(f.name for f in UserEntitlement._meta.fields)`, so it picks the renamed field up automatically. | — | None. |
| `ACTIVITY.md` | One appended dated section (Task 13). | 13 | Low — append at the top of the log, never rewrite. |
| `backend/listings/**`, `backend/finance/**`, `backend/brokers/**`, `backend/analytics/**`, `backend/messaging/**`, `backend/platform_settings/**`, `backend/accounts/**`, `backend/audit/**`, `backend/taxonomy/**`, `backend/common/throttling.py`, `backend/common/ip.py`, `backend/common/exceptions.py`, `backend/conftest.py`, `frontend/**` | **Untouched.** | — | None. |

---

## Phase 13 reconciliation required

**Verified against the real merged `dev` tip at planning time (commit `ae2b2f5`).** Phase 13 is **not** fully merged. Merged are its Tasks 1–3 only:

- `backend/entitlements/enums.py` — `EntitlementType`, `EntitlementSource`, `EntitlementState`, `LISTING_RIGHT_TYPES`, `ENTITLEMENT_TRANSITIONS`, `can_transition_entitlement`, `BlockingReason`, `PURCHASE_PRODUCT_CODE`, `INDIVIDUAL_ENTITLEMENTS_FLAG`, `RESERVATION_TIMEOUT_MINUTES` (PR #110).
- `backend/entitlements/models.py` — `UserEntitlement` + `UserEntitlementQuerySet` with four `CheckConstraint`s and the partial `UniqueConstraint` `entitlements_one_live_right_per_listing_and_type`; read-only `UserEntitlementAdmin`; the `individual_entitlements` flag seeded **disabled** (PR #115).
- `backend/entitlements/policy.py` — `free_quota_state`, `available_paid_rights`, `paid_validity_days`, `paid_publication_days`, `enforcement_enabled`, … (PR #124).

**Everything below is assumed from the Phase 13 *plan*, not verified in code.** Each is flagged again at its point of use. **Before cutting the branch for a task that consumes one, run the task's prerequisite check and read the real merged source; if the signature differs, reconcile the task, do not re-derive the interface from memory.**

| Assumed interface | Phase 13 task | Used by | If it differs |
|---|---:|---|---|
| `entitlements.services.revoke_entitlement(*, entitlement, actor, reason, now=None) -> UserEntitlement` — `CONSUMED/AVAILABLE/RESERVED → REVOKED`, audited, transactional | 13 | **Task 11** (§23.4 refund revocation) | Task 11 must call whatever the merged service is named. It must **not** fall back to writing `UserEntitlement.state` directly — that violates Phase 13 contract rule 1. If no such service exists at Task 11's start, stop and escalate to the controller. |
| `revoke_entitlement` accepts **`actor=None`** (a webhook has no user actor) | 13 | Task 11 | If it requires a non-null actor, Task 11 adds the keyword-only `actor=None` branch to `entitlements/services.py` as a minimal, separately-reviewed edit, and records it in the Contract summary. Prefer that over a second revocation path. |
| `entitlements.services.release_reservation(*, entitlement, actor, reason) -> UserEntitlement` — `RESERVED → AVAILABLE` | 12 | **Task 11** (§23.4 "Reserved entitlement: release reservation, then revoke") | Same rule. This branch is defensive: **this phase produces no `RESERVED` rows** (ruling below), so the only rows it can encounter are staff- or Phase-15-produced ones. If the service is absent at Task 11's start, ship the `AVAILABLE` and `CONSUMED` branches, `raise NotImplementedError` on `RESERVED`, and record it as a Known Limitation — do not invent a transition. |
| `entitlements.services.InvalidEntitlementState(APIException)` — 409, `default_code="invalid_entitlement_state"` | 12 | Task 11 (caught, converted to a staff-review outcome) | If absent, catch `Exception` narrowly at that one call site and record the mismatch as a staff-review case. |
| `entitlements.eligibility.ListingEligibilityService` / `Eligibility` | 4 | **Nothing in this plan.** Deliberately not consumed, to keep the assumption surface small. | — |
| `entitlements.consumption.*` (`consume_listing_right`, `lock_user_quota`, `ensure_can_start_listing`, `ListingEntitlementRequired`) | 6 | **Nothing in this plan.** | — |
| `common.exceptions.nauta_exception_handler`'s `action` passthrough | 6 | **Nothing in this plan.** Verified absent from merged `common/exceptions.py`, which today passes through `meta` only. Every error in this phase that needs extra context uses **`meta`**, which *is* merged. | — |
| `listings.policies.ListingEntitlementGate` real body / `ConsumedRight` | 8 | **Nothing in this plan.** Verified still the Phase 11 stub. | — |
| `BoatListing.consumed_entitlement` FK (Phase 13 Task 7) | 7 | **Nothing in this plan.** Task 7 (media upgrade eligibility) reads `BoatListing.seller_type`, `owner_user_id`, `status` and `UserEntitlement.listing` — all merged fields. | — |
| root `conftest.py`'s `published_listing_with_snapshot` fixture | 8 | **Nothing in this plan.** Verified absent; this plan's tests build their own listings from `listings.tests.factories`. | — |

**Prerequisite check to run before Task 1** (and again before Tasks 4 and 11):

```bash
cd backend
uv run python -c "import payments" 2>&1 | head -1                     # expect ModuleNotFoundError — this phase creates it
uv run python -c "from entitlements.models import UserEntitlement as U; print(U._meta.get_field('source_payment_id').__class__.__name__)"
uv run python -c "import entitlements.services" 2>&1 | head -1        # Task 11 needs this to EXIST; before Phase 13 Task 12 it will not
uv run python -c "from common.views import StripeWebhookView; import inspect; print(inspect.getsource(StripeWebhookView))"
uv run python -c "import stripe; print(stripe.VERSION); print(stripe.SignatureVerificationError)"
uv run pytest -q
```

The second command must print `UUIDField` before Task 4 and `ForeignKey` after it. The fourth must print the Phase 0/1 stub that verifies a signature and returns 200/400 without touching any model. The fifth must print `15.6.1` and `<class 'stripe._error.SignatureVerificationError'>`.

---

## Scope rulings

Every boundary is ruled here so no task has to guess. Each is repeated as a "Note (ruling — …)" where it bites.

**Note (ruling — the app is named `payments`, and that name is already load-bearing in merged code).**
`backend/entitlements/models.py` line 74 carries the comment *"Loose reference to Phase 14's `payments.PaymentOrder` (spec §11.9)"*, and the Phase 13 plan repeats it. Naming the app anything else would make a merged comment false and would break Task 4's FK string. `MarketplaceProduct` lives here too rather than in `entitlements`, even though spec §11.9 groups them under one heading: the product is a **price and a Stripe configuration**, `PaymentOrder` FKs it, and `entitlements` must keep its import graph clean (Phase 13 contract rule 3 forbids `entitlements` importing `listings`; adding a product/Stripe dependency to it would be worse). The arrow is one-directional: **`payments` imports `entitlements` and `listings`; neither imports `payments`** — except the one lazy string FK `"payments.PaymentOrder"` in Task 4, which creates no import edge.

**Note (ruling — this phase is backend-only; spec §23.5's *screen* is Phase 17's, its *data* is this phase's).**
§23.5 describes `/dashboard/staff/products/`, a Next.js route. Spec §26.1 assigns staff navigation to Phase 17 and warns *"Do not scatter one workflow across unrelated dashboards"*; §26.4 then says *"Product edit fields are defined in section 23"* — i.e. §23.5 is the **field list** Phase 17 renders, not a screen §23 builds. Phase 11 and Phase 13 both set the precedent of shipping the complete API and deferring the screen. What this phase therefore ships is every backend source §23.5's card enumerates — name and code, active state, display price and currency, **Stripe Price validation state**, entitlement/publication durations, and purchase/fulfillment-failure counts — behind `CRUD /api/v1/staff/products/`, which spec §30.1 lists as an endpoint in its own right. The screen is Phase 17's and is recorded in Known Limitations. Consequently **no file under `frontend/` is touched**, and the CI frontend job must stay green with zero changes.

**Note (ruling — the `stripe_entitlement_checkout` flag gates Checkout creation and nothing else; the webhook is never flag-gated).**
Spec §35.1 requires flags to "gate both frontend exposure and backend mutation". The mutation a customer initiates is `POST /api/v1/checkout-sessions/`, and that is what the flag closes. The **webhook is deliberately not gated**, for a reason that is a rollback-safety rule, not a convenience: if the flag were turned off (spec §35.3: "Disable mutation feature flags first") between a customer paying and Stripe delivering, a gated webhook would reject a real payment and strand the money with no entitlement — the exact paid-not-fulfilled state §35.4 tells us to monitor for. §35.3 is explicit that a fulfilled entitlement is never rolled back by deletion; the symmetric rule is that a *pending* fulfilment is never rolled back by refusal. Turning the flag off therefore stops **new** purchases and lets the in-flight ones land. The staff product endpoints are likewise ungated: refusing to show product configuration during an incident helps nobody, and they already require staff admin.

**Note (ruling — `Idempotency-Key` is required on Checkout creation and is stored for replay; this closes Phase 13's Known Limitation 13 for this endpoint only).**
Spec §30.3: *"Require `Idempotency-Key` for Checkout creation, listing submit and staff decision requests. Store outcome for safe replay within a defined retention window."* This phase implements the Checkout-creation third; listing submit and staff decisions stay as Phase 11/13 left them (Known Limitation). The stored outcome is the `PaymentOrder` row itself, keyed by a partial `UniqueConstraint` on `(user, client_idempotency_key)`; a replay returns **200** with the same order and the same Stripe URL, a first request returns **201**. A replay whose body differs from the stored request fingerprint is **409 `idempotency_key_reused`** rather than silently serving the wrong product. **Retention window: 30 days**, a module constant (`IDEMPOTENCY_RETENTION_DAYS`) documented on the model and enforced by nothing in this phase — orders are never deleted (§35.3 preserves the ledger), so the window is a documented client contract, not a sweep. Recorded in Known Limitations.

**Note (ruling — two idempotency keys exist and they are different things; do not conflate them).**
`PaymentOrder.client_idempotency_key` is the caller's `Idempotency-Key` header (spec §30.3). `PaymentOrder.idempotency_key` is spec §23.2's *"idempotency key derived from order UUID and operation"*, sent to **Stripe** as `options={"idempotency_key": …}` and computed as `f"checkout:{order.pk}"`. It is `unique` and deterministic so that a retried session creation after a transport failure returns Stripe's *same* session instead of charging a second one. Spec §11.9 lists one `idempotency_key unique` field on `PaymentOrder`; that is this one. `client_idempotency_key` is an addition beyond §11.9's list, justified by §30.3's own requirement and recorded here rather than presented as spec-literal — the same way Phase 13 added `granted_by`.

**Note (ruling — `PaymentOrder` gains a nullable `listing` FK beyond spec §11.9's field list).**
§23.2's request body carries `listing_id`, §23.1 binds `LISTING_MEDIA_UPGRADE` to "one eligible private-seller listing", and the fulfilment that happens minutes later in a different process must know which listing. The alternatives are a JSON `metadata["listing_id"]` (no referential integrity, no `PROTECT`, unqueryable for the staff screen) or trusting Stripe's returned metadata (client-adjacent data as the source of truth — exactly what §2.2 forbids). So `listing` is a real nullable FK with `on_delete=PROTECT`. **It carries no database CHECK tying it to the product code**, because a CHECK cannot dereference the `product` FK to read `code`; that rule is enforced in `payments.checkout` and re-enforced at fulfilment. The guarantee that *is* at database level — and the one that actually matters — is Phase 13's merged `entitlements_one_live_right_per_listing_and_type` partial unique index, which makes a second live `MEDIA_UPGRADE` on the same listing impossible however the code is called. Task 10 tests exactly that, from two directions.

**Note (ruling — the fulfilment path CREATES an entitlement row directly; it does not call `grant_listing_right`).**
Phase 13 contract rule 1 says *"Never write `UserEntitlement.state` directly. Go through `entitlements.consumption.consume_listing_right` or one of `entitlements.services`' functions."* That rule governs **transitions**. Creating a brand-new `AVAILABLE` row is not a transition — there is no prior state — and `grant_listing_right` is the wrong tool for it three times over: it hard-codes `source=EntitlementSource.STAFF_GRANT` (a Stripe purchase is `STRIPE_PURCHASE`), it hard-codes `granted_by=actor` (a webhook has no user actor), and it *requires* a non-blank `reason` (a purchase has an order, not a reason). `payments.fulfillment.grant_purchased_entitlement()` therefore constructs the row itself, inside the webhook's single `transaction.atomic()`, with its own audit event — and **every transition away from that row (revocation on refund) goes through `entitlements.services`**, which is the half of rule 1 that is really about safety. Recorded in the Contract summary so Phase 15/17 do not read it as licence to write `state` directly.

**Note (ruling — this phase produces no `RESERVED` entitlement rows, so Phase 13's Known Limitation 3 obligation does not bite).**
Phase 13 contract rule 6 says Phase 14 *"is also the natural first producer of `RESERVED` rows; if it creates one, it must either attach it to a listing or leave `listing` NULL so `release_stale_reservations()` can time it out."* This plan creates **none**. A purchased right is `AVAILABLE` the instant it is fulfilled, because the customer has already paid and there is nothing to hold: reserving would mean a 30-minute clock (spec §6.3) running against a right nobody is competing for, and a `RESERVED` row that the sweep could reclaim out from under an ordinary buyer. The `MEDIA_UPGRADE` right is created already bound to its listing (`listing=<listing>`, `state=AVAILABLE`), which is §23.1's "bound to one eligible private-seller listing" and "cannot be transferred after binding" — binding is a FK plus a unique index, not a reservation. Phase 15 remains free to be the first `RESERVED` producer.

**Note (ruling — an amount/currency mismatch answers Stripe 200, not 500).**
Spec §23.3 step 5 requires verification and the §23 acceptance list requires "Currency/amount mismatch blocks fulfillment and alerts staff". It does not say what to answer Stripe. Returning 5xx would make Stripe retry an event that can never succeed — the mismatch is a configuration fact, not a transient fault — burning the retry budget and hiding the real signal. So a mismatch: writes the `ProcessedWebhookEvent` with `result=MISMATCH`, moves the order to `FAILED`, writes a `payment_order.mismatch` audit event, fires `payment_needs_staff_review`, and answers **200**. Stripe stops retrying; the staff alert is the remedy. The genuinely transient failures (database unavailable, a bug) answer **500** by letting the exception propagate, which rolls the dedup row back so the retry can succeed. That asymmetry is the whole design and Task 10 tests both halves.

**Note (ruling — §23.4's "consumed/published entitlement" case marks a staff review case on the order; it does not create a new model).**
§11.9 enumerates exactly four models and none of them is a payment case. §23.4 says *"do not silently unpublish solely on a webhook; mark payment case for staff review, notify staff and apply documented commercial policy"*. "Mark payment case" is satisfied by `PaymentOrder.status = REFUNDED|DISPUTED` plus `metadata["staff_review_required"] = True` and `metadata["staff_review_reason"]`, an audit event, and the `payment_needs_staff_review` signal. Inventing a fifth model would be a schema addition the spec does not list and Phase 17 has not planned a screen for. The listing stays published; nothing is unpublished by a webhook, ever. Recorded in Known Limitations for Phase 17's review queue.

**Note (ruling — notifications are signals, not `Notification` rows).**
§23.3 step 9 ("notify user and refresh WebSocket eligibility state") and §23.4 ("high-priority staff notification") both need a notification system that does not exist: there is no `notifications` app in `INSTALLED_APPS` (verified), and Phase 6's messaging work is still landing. This phase does what Phase 13 did for expiry: defines two `django.dispatch.Signal`s, `payments.signals.payment_fulfilled` and `payments.signals.payment_needs_staff_review`, fires them inside `transaction.on_commit()` with everything a receiver needs, and leaves the receivers to **Phase 18**. Firing on commit is not cosmetic: a receiver that emailed "your right is ready" from inside the transaction would send it even when the transaction later rolled back.

**Note (ruling — the two seeded products carry `display_amount = 0.00` and blank Stripe IDs, and the database refuses to let such a row go active).**
Spec §38 requires "Two product records, inactive until valid environment Stripe IDs are supplied" and forbids "decorative financial values or test Stripe IDs" in production setup. A seeded `49.00` would be exactly a decorative financial value. So the seed writes `display_amount = Decimal("0.00")`, `stripe_product_id = ""`, `stripe_price_id = ""`, `is_active = False`, with the real durations from §23.1 (365 / 30 for the listing right; 365 / NULL for the media upgrade, which grants no publication window). The invariant is then enforced in the database rather than in a comment: the `payments_active_product_is_fully_configured` `CheckConstraint` makes `is_active=True` impossible unless `display_amount > 0` **and** `stripe_product_id != ""` **and** `stripe_price_id != ""`. That single constraint discharges §38's "inactive until valid Stripe IDs are supplied" and §32.1 step 8, and it is why `display_amount` allows `0` at all (`display_amount >= 0`, never negative).

**Note (ruling — staff product endpoints are staff-**admin**-only for every method, including GET).**
Spec §5's capability table gives "Configure products/settings" to staff admin alone, and §12 backend item is blunt: *"A moderator cannot change payment products unless separately granted staff-admin permission."* There is no listed moderator product capability at all, not even read. Rather than invent a split, all five routes take `IsStaffAdmin`. Phase 17 may widen the read if product management genuinely needs a moderator view; widening later is safe, narrowing later is a regression.

**Note (ruling — permission ORDER on the Checkout endpoint: authentication before the flag).**
DRF evaluates `permission_classes` in order and **stops at the first failure**, so the order decides which code a caller sees. Phase 6's contract rule 11a puts the flag gate first on *messaging* views. This endpoint reverses it: `[IsActiveUser, IsEmailVerified, StripeCheckoutEnabled]`. An anonymous caller must learn "authenticate", not "this feature is off" — the flag state is operational information and an unauthenticated stranger has no business enumerating it. §12 item 3 independently requires verified email for Checkout creation, which is why `IsEmailVerified` sits above the flag too. Task 8 pins all three orderings with named tests, so a reviewer reordering the list breaks a test rather than a security property silently.

**Note (ruling — no Celery task, no beat entry.)**
Nothing in §23 is time-driven. Stripe's own `checkout.session.expired` event moves a stale order to `EXPIRED`; there is no local sweep to write and no schedule to add. `CELERY_BEAT_SCHEDULE` and `CELERY_TASK_ROUTES` are therefore untouched by this plan.

---

## File Structure

**New — `backend/payments/` (this phase owns every file here):**

| File | Responsibility |
|---|---|
| `__init__.py`, `apps.py` | App registration |
| `enums.py` | §23.1 product codes and their entitlement mapping; §6.4 `PaymentOrderStatus` + `PAYMENT_TRANSITIONS` + `can_transition_payment`; `WebhookResult`; flag key; tolerance and retention constants |
| `models.py` | `MarketplaceProduct`, `PaymentOrder`, `ProcessedWebhookEvent` and their database constraints |
| `admin.py` | Staff-editable `MarketplaceProductAdmin`; read-only order and webhook-event admin |
| `errors.py` | Every named wire code, as `APIException` subclasses with `default_code` |
| `gateway.py` | The single Stripe seam: `StripeGateway` protocol, `StripeApiGateway`, `default_gateway()` |
| `products.py` | Active-product resolution, minor-unit conversion, §23.5 price reconciliation |
| `checkout.py` | Return-URL allowlist and `create_checkout_session` (§23.2) |
| `webhooks.py` | Raw-body signature verification, event dedup, dispatch (§23.3 steps 1–3) |
| `fulfillment.py` | §23.3 steps 4–8: lock, verify, mark paid, grant exactly one entitlement, link, fulfil |
| `refunds.py` | §23.4 refunds and disputes |
| `signals.py` | `payment_fulfilled`, `payment_needs_staff_review` |
| `selectors.py` | §23.5's operational counters (purchases, fulfilment failures) |
| `services.py` | The one audited product-configuration write (§26.4) |
| `serializers.py` | Checkout request, order representation, staff product read/write |
| `permissions.py` | `StripeCheckoutEnabled` |
| `views.py` | `CheckoutSessionCreateView`, `PaymentOrderDetailView`, `StripeWebhookView`, staff product views |
| `urls.py` | This app's routes |
| `migrations/` | `0001_initial` (Task 2), `0002_seed_products_and_checkout_flag` (Task 2), `0003_paymentorder_processedwebhookevent` (Task 3) |
| `tests/` | `conftest.py`, `factories.py`, `fakes.py`, `test_enums.py`, `test_models.py`, `test_order_models.py`, `test_entitlement_link.py`, `test_gateway.py`, `test_products.py`, `test_checkout.py`, `test_checkout_api.py`, `test_webhook_security.py`, `test_fulfillment.py`, `test_refunds.py`, `test_staff_products_api.py`, `test_phase_acceptance.py` |

Splitting the domain logic across `products.py`, `checkout.py`, `webhooks.py`, `fulfillment.py` and `refunds.py` rather than one `services.py` is deliberate: `webhooks.py` (untrusted input, no business rules) and `fulfillment.py` (trusted input, all the business rules) have different threat models and different reviewers, and keeping that security boundary visible in the file layout is worth more than the convenience of one file. `services.py` holds only the staff product write, which is neither.

**Also created:** `backend/entitlements/migrations/0003_userentitlement_source_payment.py` (Task 4). **Modified outside `payments/`:** `backend/config/settings/base.py` (two appended one-liners), `backend/config/urls.py` (one appended `include`, two modified lines in Task 9), `backend/entitlements/models.py` (one field), `backend/entitlements/tests/test_user_entitlement_model.py` (one string), `backend/common/views.py` (a class removed), `backend/common/tests/stripe_helpers.py` (one appended keyword argument), `ACTIVITY.md` and `docs/superpowers/PHASE-TRACKER.md`. **Deleted:** `backend/common/tests/test_stripe_webhook.py`. The collision notice above states each one's risk.

---

### Task 1: Scaffold the `payments` app and its spec §23.1 / §6.4 vocabulary

**Files:**
- Create: `backend/payments/__init__.py`, `backend/payments/apps.py`, `backend/payments/enums.py`, `backend/payments/migrations/__init__.py`, `backend/payments/tests/__init__.py`
- Modify: `backend/config/settings/base.py` (one appended line in `INSTALLED_APPS`)
- Test: `backend/payments/tests/test_enums.py`

**Interfaces:**
- Consumes: `entitlements.enums.EntitlementType` (Phase 13 Task 1, **merged**). Nothing else.
- Produces:
  - `payments.enums.ProductCode` — `TextChoices`: `INDIVIDUAL_LISTING_RIGHT`, `LISTING_MEDIA_UPGRADE`
  - `payments.enums.PRODUCT_CODES: frozenset[str]`
  - `payments.enums.PRODUCT_ENTITLEMENT_TYPES: dict[str, str]` — product code → `EntitlementType` value
  - `payments.enums.LISTING_BOUND_PRODUCTS: frozenset[str]`
  - `payments.enums.PaymentOrderStatus` — `TextChoices`: `CREATED`, `CHECKOUT_OPEN`, `PAID`, `FULFILLED`, `FAILED`, `EXPIRED`, `REFUNDED`, `DISPUTED`
  - `payments.enums.PAYMENT_TRANSITIONS: dict[str, frozenset[str]]`, `payments.enums.can_transition_payment(current: str, target: str) -> bool`
  - `payments.enums.PAID_STATES: frozenset[str]`, `payments.enums.TERMINAL_PAYMENT_STATES: frozenset[str]`
  - `payments.enums.WebhookResult` — `TextChoices`: `RECEIVED`, `FULFILLED`, `ALREADY_FULFILLED`, `IGNORED`, `MISMATCH`, `ORDER_NOT_FOUND`, `EXPIRED`, `REFUND_HANDLED`, `DISPUTE_HANDLED`
  - `payments.enums.STRIPE_CHECKOUT_FLAG = "stripe_entitlement_checkout"`
  - `payments.enums.STRIPE_SIGNATURE_TOLERANCE_SECONDS = 300`
  - `payments.enums.IDEMPOTENCY_RETENTION_DAYS = 30`

- [ ] **Step 1: Write the failing test**

`backend/payments/tests/test_enums.py`:

```python
"""Spec §23.1's closed product set and §6.4's payment state machine."""

import pytest

from entitlements.enums import EntitlementType
from payments.enums import (
    LISTING_BOUND_PRODUCTS,
    PAID_STATES,
    PAYMENT_TRANSITIONS,
    PRODUCT_CODES,
    PRODUCT_ENTITLEMENT_TYPES,
    STRIPE_CHECKOUT_FLAG,
    STRIPE_SIGNATURE_TOLERANCE_SECONDS,
    TERMINAL_PAYMENT_STATES,
    PaymentOrderStatus,
    ProductCode,
    WebhookResult,
    can_transition_payment,
)


def test_exactly_the_two_spec_23_1_product_codes_exist():
    """Spec §23.1: "supports exactly these product codes in this release"."""
    assert PRODUCT_CODES == {"INDIVIDUAL_LISTING_RIGHT", "LISTING_MEDIA_UPGRADE"}
    assert ProductCode.INDIVIDUAL_LISTING_RIGHT == "INDIVIDUAL_LISTING_RIGHT"
    assert ProductCode.LISTING_MEDIA_UPGRADE == "LISTING_MEDIA_UPGRADE"


def test_each_product_maps_to_a_real_entitlement_type():
    """The mapping must use Phase 13's merged vocabulary, not a local copy."""
    assert PRODUCT_ENTITLEMENT_TYPES == {
        ProductCode.INDIVIDUAL_LISTING_RIGHT: EntitlementType.PAID_LISTING,
        ProductCode.LISTING_MEDIA_UPGRADE: EntitlementType.MEDIA_UPGRADE,
    }
    assert set(PRODUCT_ENTITLEMENT_TYPES) == PRODUCT_CODES


def test_only_the_media_upgrade_binds_to_a_listing():
    """Spec §23.1: the upgrade is "bound to one eligible private-seller
    listing"; the listing right is not bound to anything at purchase time."""
    assert LISTING_BOUND_PRODUCTS == {ProductCode.LISTING_MEDIA_UPGRADE}


def test_the_spec_6_4_forward_chain_is_permitted():
    assert can_transition_payment(
        PaymentOrderStatus.CREATED, PaymentOrderStatus.CHECKOUT_OPEN
    )
    assert can_transition_payment(
        PaymentOrderStatus.CHECKOUT_OPEN, PaymentOrderStatus.PAID
    )
    assert can_transition_payment(PaymentOrderStatus.PAID, PaymentOrderStatus.FULFILLED)


@pytest.mark.parametrize(
    "source", [PaymentOrderStatus.CREATED, PaymentOrderStatus.CHECKOUT_OPEN]
)
@pytest.mark.parametrize(
    "target", [PaymentOrderStatus.FAILED, PaymentOrderStatus.EXPIRED]
)
def test_an_unpaid_order_may_fail_or_expire(source, target):
    assert can_transition_payment(source, target)


@pytest.mark.parametrize(
    "source", [PaymentOrderStatus.PAID, PaymentOrderStatus.FULFILLED]
)
@pytest.mark.parametrize(
    "target", [PaymentOrderStatus.REFUNDED, PaymentOrderStatus.DISPUTED]
)
def test_spec_6_4_paid_or_fulfilled_may_become_refunded_or_disputed(source, target):
    assert can_transition_payment(source, target)


@pytest.mark.parametrize(
    ("source", "target"),
    [
        # The single most important negative edge in this phase: a late
        # checkout.session.completed must never resurrect a refunded order.
        (PaymentOrderStatus.REFUNDED, PaymentOrderStatus.PAID),
        (PaymentOrderStatus.REFUNDED, PaymentOrderStatus.FULFILLED),
        (PaymentOrderStatus.DISPUTED, PaymentOrderStatus.FULFILLED),
        # A failed or expired order is final: a later "paid" event is a bug or
        # an attack, never a legitimate resurrection.
        (PaymentOrderStatus.FAILED, PaymentOrderStatus.PAID),
        (PaymentOrderStatus.EXPIRED, PaymentOrderStatus.PAID),
        # Skipping payment entirely.
        (PaymentOrderStatus.CREATED, PaymentOrderStatus.FULFILLED),
        (PaymentOrderStatus.CHECKOUT_OPEN, PaymentOrderStatus.FULFILLED),
        # Fulfilling twice.
        (PaymentOrderStatus.FULFILLED, PaymentOrderStatus.FULFILLED),
        (PaymentOrderStatus.FULFILLED, PaymentOrderStatus.PAID),
    ],
)
def test_forbidden_payment_transitions_are_refused(source, target):
    assert can_transition_payment(source, target) is False


def test_every_status_has_a_transition_entry():
    """A status missing from the map would silently forbid every transition out
    of it — a bug that only shows up in production."""
    assert set(PAYMENT_TRANSITIONS) == set(PaymentOrderStatus.values)


def test_terminal_states_have_no_outgoing_edges():
    assert TERMINAL_PAYMENT_STATES == {
        PaymentOrderStatus.FAILED,
        PaymentOrderStatus.EXPIRED,
    }
    for state in TERMINAL_PAYMENT_STATES:
        assert PAYMENT_TRANSITIONS[state] == frozenset()


def test_paid_states_are_the_ones_where_money_has_moved():
    assert PAID_STATES == {
        PaymentOrderStatus.PAID,
        PaymentOrderStatus.FULFILLED,
        PaymentOrderStatus.REFUNDED,
        PaymentOrderStatus.DISPUTED,
    }


def test_the_flag_key_is_spec_35_1s_literal():
    assert STRIPE_CHECKOUT_FLAG == "stripe_entitlement_checkout"


def test_the_signature_tolerance_is_stripes_own_default():
    assert STRIPE_SIGNATURE_TOLERANCE_SECONDS == 300


def test_webhook_results_are_a_closed_set():
    assert set(WebhookResult.values) == {
        "RECEIVED",
        "FULFILLED",
        "ALREADY_FULFILLED",
        "IGNORED",
        "MISMATCH",
        "ORDER_NOT_FOUND",
        "EXPIRED",
        "REFUND_HANDLED",
        "DISPUTE_HANDLED",
    }
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
cd backend && uv run pytest payments/tests/test_enums.py -q
```

Expected: a collection error — `ModuleNotFoundError: No module named 'payments'`.

- [ ] **Step 3: Create the app package**

`backend/payments/__init__.py`, `backend/payments/migrations/__init__.py` and `backend/payments/tests/__init__.py` are empty files.

`backend/payments/apps.py`:

```python
from django.apps import AppConfig


class PaymentsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "payments"
    verbose_name = "Payments and products"
```

`backend/payments/enums.py`:

```python
"""Payment and product vocabulary (spec §23.1, §6.4, §11.9, §35.1).

Values are copied verbatim from the spec and must never be renamed: they are
persisted in the database, returned in API responses, sent to Stripe as
metadata and written into audit events.
"""

from django.db import models

from entitlements.enums import EntitlementType


class ProductCode(models.TextChoices):
    """Spec §23.1: "supports exactly these product codes in this release"."""

    INDIVIDUAL_LISTING_RIGHT = "INDIVIDUAL_LISTING_RIGHT", "Individual listing right"
    LISTING_MEDIA_UPGRADE = "LISTING_MEDIA_UPGRADE", "Listing media upgrade"


PRODUCT_CODES: frozenset[str] = frozenset(ProductCode.values)

# What one purchase of each product grants (spec §23.1). The values come from
# Phase 13's merged enum rather than from string literals, so a rename there is
# a test failure here instead of a silent mis-grant.
PRODUCT_ENTITLEMENT_TYPES: dict[str, str] = {
    ProductCode.INDIVIDUAL_LISTING_RIGHT: EntitlementType.PAID_LISTING,
    ProductCode.LISTING_MEDIA_UPGRADE: EntitlementType.MEDIA_UPGRADE,
}

# Spec §23.1: the media upgrade "Grants one upgrade bound to one eligible
# private-seller listing" and "Cannot be transferred after binding". The listing
# right binds to nothing at purchase time — it is consumed at submit (spec §6.3).
LISTING_BOUND_PRODUCTS: frozenset[str] = frozenset({ProductCode.LISTING_MEDIA_UPGRADE})


class PaymentOrderStatus(models.TextChoices):
    """Spec §11.9's `status` column and §6.4's state machine."""

    CREATED = "CREATED", "Created"
    CHECKOUT_OPEN = "CHECKOUT_OPEN", "Checkout open"
    PAID = "PAID", "Paid"
    FULFILLED = "FULFILLED", "Fulfilled"
    FAILED = "FAILED", "Failed"
    EXPIRED = "EXPIRED", "Expired"
    REFUNDED = "REFUNDED", "Refunded"
    DISPUTED = "DISPUTED", "Disputed"


# Spec §6.4, verbatim:
#   CREATED -> CHECKOUT_OPEN -> PAID -> FULFILLED
#                            -> FAILED
#                            -> EXPIRED
#   PAID/FULFILLED -> REFUNDED or DISPUTED
#
# Two readings are fixed here, because the diagram leaves them open:
#   * CREATED may also go straight to FAILED or EXPIRED. The row is written
#     BEFORE the Stripe session exists (spec §23.2: "Create local PaymentOrder
#     before Stripe session"), so a session creation that never succeeds leaves
#     a CREATED row with nowhere else to go.
#   * REFUNDED and DISPUTED are mutually reachable. A customer can dispute a
#     charge that was already refunded, and a dispute is very often settled by
#     refunding.
# FAILED and EXPIRED are the only terminal states: money never moved.
PAYMENT_TRANSITIONS: dict[str, frozenset[str]] = {
    PaymentOrderStatus.CREATED: frozenset(
        {
            PaymentOrderStatus.CHECKOUT_OPEN,
            PaymentOrderStatus.FAILED,
            PaymentOrderStatus.EXPIRED,
        }
    ),
    PaymentOrderStatus.CHECKOUT_OPEN: frozenset(
        {
            PaymentOrderStatus.PAID,
            PaymentOrderStatus.FAILED,
            PaymentOrderStatus.EXPIRED,
        }
    ),
    PaymentOrderStatus.PAID: frozenset(
        {
            PaymentOrderStatus.FULFILLED,
            PaymentOrderStatus.REFUNDED,
            PaymentOrderStatus.DISPUTED,
        }
    ),
    PaymentOrderStatus.FULFILLED: frozenset(
        {PaymentOrderStatus.REFUNDED, PaymentOrderStatus.DISPUTED}
    ),
    PaymentOrderStatus.FAILED: frozenset(),
    PaymentOrderStatus.EXPIRED: frozenset(),
    PaymentOrderStatus.REFUNDED: frozenset({PaymentOrderStatus.DISPUTED}),
    PaymentOrderStatus.DISPUTED: frozenset({PaymentOrderStatus.REFUNDED}),
}

TERMINAL_PAYMENT_STATES: frozenset[str] = frozenset(
    {PaymentOrderStatus.FAILED, PaymentOrderStatus.EXPIRED}
)

# States in which Stripe has confirmed money moved. Read by the `paid_at`
# database constraint and by the staff counters.
PAID_STATES: frozenset[str] = frozenset(
    {
        PaymentOrderStatus.PAID,
        PaymentOrderStatus.FULFILLED,
        PaymentOrderStatus.REFUNDED,
        PaymentOrderStatus.DISPUTED,
    }
)


def can_transition_payment(current: str, target: str) -> bool:
    return target in PAYMENT_TRANSITIONS.get(current, frozenset())


class WebhookResult(models.TextChoices):
    """Spec §11.9's `ProcessedWebhookEvent.result`.

    RECEIVED is the value the row is inserted with, before the handler runs;
    every path overwrites it inside the same transaction, so a row still at
    RECEIVED after a commit is itself a bug worth alerting on.
    """

    RECEIVED = "RECEIVED", "Received"
    FULFILLED = "FULFILLED", "Fulfilled"
    ALREADY_FULFILLED = "ALREADY_FULFILLED", "Already fulfilled"
    IGNORED = "IGNORED", "Ignored"
    MISMATCH = "MISMATCH", "Mismatch"
    ORDER_NOT_FOUND = "ORDER_NOT_FOUND", "Order not found"
    EXPIRED = "EXPIRED", "Expired"
    REFUND_HANDLED = "REFUND_HANDLED", "Refund handled"
    DISPUTE_HANDLED = "DISPUTE_HANDLED", "Dispute handled"


# Spec §35.1's rollout flag for this phase. Gates Checkout CREATION only — the
# webhook is deliberately never gated (see the plan's ruling).
STRIPE_CHECKOUT_FLAG = "stripe_entitlement_checkout"

# Stripe's own default replay window for Webhook.construct_event, stated
# explicitly rather than inherited, so a change to it is a visible diff.
STRIPE_SIGNATURE_TOLERANCE_SECONDS = 300

# Spec §30.3: "Store outcome for safe replay within a defined retention window."
# This is that window, as a documented client contract. Orders are never deleted
# (spec §35.3 preserves the ledger), so nothing sweeps them server-side.
IDEMPOTENCY_RETENTION_DAYS = 30
```

- [ ] **Step 4: Register the app**

Append **one line** to `INSTALLED_APPS` in `backend/config/settings/base.py`, after the existing `"platform_settings",`. Read the real list first; do not paste the whole block.

```python
    "platform_settings",
    "payments",
]
```

- [ ] **Step 5: Run the test and confirm it passes**

```bash
cd backend && uv run pytest payments/tests/test_enums.py -q
cd backend && uv run python manage.py check
cd backend && uv run pytest -q
```

Expected: `payments/tests/test_enums.py` green with zero failures (the three `parametrize`d tests expand, so the reported count is larger than the number of `def`s — read the real number, do not assert a remembered one), `manage.py check` clean, and the pre-existing suite unchanged.

- [ ] **Step 6: Mutation check**

1. Delete the `PaymentOrderStatus.REFUNDED` key from `PAYMENT_TRANSITIONS` → `test_every_status_has_a_transition_entry` must fail.
2. Add `PaymentOrderStatus.PAID` to `PAYMENT_TRANSITIONS[PaymentOrderStatus.REFUNDED]` → `test_forbidden_payment_transitions_are_refused` must fail.
3. Point `PRODUCT_ENTITLEMENT_TYPES[ProductCode.LISTING_MEDIA_UPGRADE]` at `EntitlementType.PAID_LISTING` → `test_each_product_maps_to_a_real_entitlement_type` must fail.

Revert all three.

- [ ] **Step 7: Commit**

```bash
git add backend/payments backend/config/settings/base.py
git commit -m "feat(payments): scaffold the payments app and the spec 23.1/6.4 vocabulary (Phase 14 Task 1)"
```

---

### Task 2: `MarketplaceProduct`, its configuration constraints, spec §38 seeds and the rollout flag

**Files:**
- Create: `backend/payments/models.py`, `backend/payments/admin.py`, `backend/payments/migrations/0001_initial.py` (generated), `backend/payments/migrations/0002_seed_products_and_checkout_flag.py`, `backend/payments/tests/conftest.py`, `backend/payments/tests/factories.py`
- Test: `backend/payments/tests/test_models.py`

**Interfaces:**
- Consumes: `payments.enums.{ProductCode, PRODUCT_CODES}` (Task 1); `common.models.UUIDTimeStampedModel`; `platform_settings.models.FeatureFlag` (through the historical migration model only).
- Produces:
  - `payments.models.MarketplaceProduct` — spec §11.9's field list: `code`, `name_en/it/es`, `description_en/it/es`, `stripe_product_id`, `stripe_price_id`, `currency`, `display_amount`, `entitlement_valid_days`, `publication_days`, `is_active`, `display_order`, `created_by`, `updated_by`, plus `id`/`created_at`/`updated_at` from the base class
  - `payments.models.MarketplaceProductQuerySet.active()`
  - Six database constraints, named `payments_product_code_is_known`, `payments_product_amount_is_not_negative`, `payments_product_currency_is_iso4217`, `payments_product_validity_is_positive`, `payments_product_publication_days_is_positive_or_null`, `payments_product_active_is_fully_configured`
  - `payments.tests.factories.{make_payments_seller, configure_product, listing_right_product, media_upgrade_product}`
  - `payments/tests/conftest.py`'s autouse named-key cache fixture and the `checkout_enabled` fixture
  - Two seeded `MarketplaceProduct` rows (inactive, zero amount, blank Stripe ids) and the `stripe_entitlement_checkout` flag, seeded **disabled**

- [ ] **Step 1: Write the failing test**

`backend/payments/tests/conftest.py`:

```python
"""Named-key cache isolation for this package.

The project's cache is a real, shared Redis instance. NEVER call cache.clear()
here: Django's RedisCache.clear() is a FLUSHDB and would wipe keys owned by
other worktrees' concurrently running suites. Delete named keys only — the same
pattern as entitlements/tests/conftest.py and listings/tests/conftest.py.
"""

import pytest
from django.core.cache import cache

from platform_settings.services import SETTINGS_CACHE_KEY, feature_flag_cache_key

PAYMENTS_FEATURE_FLAG_KEYS = ["stripe_entitlement_checkout", "individual_entitlements"]


@pytest.fixture(autouse=True)
def _clear_payment_caches():
    def _clear():
        cache.delete(SETTINGS_CACHE_KEY)
        for key in PAYMENTS_FEATURE_FLAG_KEYS:
            cache.delete(feature_flag_cache_key(key))

    _clear()
    yield
    _clear()


@pytest.fixture
def checkout_enabled(db):
    """Turn spec §35.1's `stripe_entitlement_checkout` flag on for one test."""
    from platform_settings.services import set_feature_flag

    set_feature_flag(key="stripe_entitlement_checkout", is_enabled=True, actor=None)
```

`backend/payments/tests/factories.py`:

```python
from decimal import Decimal

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from payments.enums import ProductCode
from payments.models import MarketplaceProduct


def make_payments_seller(email="p14-seller@example.com", **extra):
    """A verified private seller.

    Every email in this package is prefixed `p14-` so it can never collide with
    a seed or with another package's fixtures ("user@example.com",
    "private-seller@example.com", "entitlement-admin@example.com").
    """
    return make_user(email, role=UserRole.PRIVATE_SELLER, verified=True, **extra)


def configure_product(product, **overrides):
    """Take a SEEDED, inactive product and give it a working configuration.

    Deliberately an UPDATE of the migration-seeded row, never a create: `code`
    is unique, so a create would collide with the seed. It is also why no test
    in this package uses `django_db(transaction=True)` — that would truncate the
    tables and drop the migration-seeded product and flag rows, breaking every
    later test in the session.
    """
    defaults = {
        "display_amount": Decimal("49.00"),
        "currency": "EUR",
        "stripe_product_id": "prod_test_listing_right",
        "stripe_price_id": "price_test_listing_right",
        "is_active": True,
    }
    defaults.update(overrides)
    for key, value in defaults.items():
        setattr(
            product,
            key,
            Decimal(value) if key == "display_amount" and not isinstance(value, Decimal) else value,
        )
    product.save()
    return product


def listing_right_product(**overrides):
    return configure_product(
        MarketplaceProduct.objects.get(code=ProductCode.INDIVIDUAL_LISTING_RIGHT),
        **overrides,
    )


def media_upgrade_product(**overrides):
    overrides.setdefault("stripe_product_id", "prod_test_media_upgrade")
    overrides.setdefault("stripe_price_id", "price_test_media_upgrade")
    overrides.setdefault("display_amount", Decimal("19.00"))
    return configure_product(
        MarketplaceProduct.objects.get(code=ProductCode.LISTING_MEDIA_UPGRADE),
        **overrides,
    )
```

`backend/payments/tests/test_models.py`:

```python
"""Spec §11.9's MarketplaceProduct and the database-level guarantees the rest of
this phase relies on instead of re-checking in every service."""

from decimal import Decimal

import pytest
from django.db import IntegrityError, transaction

from payments.enums import ProductCode
from payments.models import MarketplaceProduct
from payments.tests.factories import listing_right_product


@pytest.mark.django_db
def test_every_spec_11_9_product_field_exists_with_the_spec_name():
    names = {field.name for field in MarketplaceProduct._meta.get_fields()}
    assert {
        "id",
        "code",
        "name_en",
        "name_it",
        "name_es",
        "description_en",
        "description_it",
        "description_es",
        "stripe_product_id",
        "stripe_price_id",
        "currency",
        "display_amount",
        "entitlement_valid_days",
        "publication_days",
        "is_active",
        "display_order",
        "created_by",
        "updated_by",
        "created_at",
        "updated_at",
    } <= names


@pytest.mark.django_db
def test_no_card_data_field_exists_on_any_payments_model():
    """Spec §23.1: "Staff does not enter card data". This phase never stores a
    PAN, a CVC, an expiry or a cardholder name, and this test is the standing
    guard against someone adding one later "just for the receipt"."""
    forbidden = {"last4", "card_number", "pan", "cvc", "cvv", "exp_month",
                 "exp_year", "cardholder_name", "card_brand", "receipt_body"}
    names = {field.name for field in MarketplaceProduct._meta.get_fields()}
    assert forbidden & names == set()


@pytest.mark.django_db
def test_spec_38_seeds_exactly_two_products_both_inactive_and_unconfigured():
    """Spec §38: "Two product records, inactive until valid environment Stripe
    IDs are supplied", and production setup "must not include ... decorative
    financial values or test Stripe IDs"."""
    products = list(MarketplaceProduct.objects.order_by("display_order"))

    assert [p.code for p in products] == [
        ProductCode.INDIVIDUAL_LISTING_RIGHT,
        ProductCode.LISTING_MEDIA_UPGRADE,
    ]
    for product in products:
        assert product.is_active is False
        assert product.stripe_product_id == ""
        assert product.stripe_price_id == ""
        assert product.display_amount == Decimal("0.00")


@pytest.mark.django_db
def test_the_seeded_durations_are_spec_23_1s_defaults():
    right = MarketplaceProduct.objects.get(code=ProductCode.INDIVIDUAL_LISTING_RIGHT)
    upgrade = MarketplaceProduct.objects.get(code=ProductCode.LISTING_MEDIA_UPGRADE)

    # "Default entitlement validity: 365 days from purchase."
    # "Default publication: 30 days from staff approval/publication."
    assert (right.entitlement_valid_days, right.publication_days) == (365, 30)
    # A media upgrade grants no publication window of its own.
    assert (upgrade.entitlement_valid_days, upgrade.publication_days) == (365, None)


@pytest.mark.django_db
def test_the_rollout_flag_is_seeded_disabled():
    """Spec §35.2 step 4: deploy with features off. A flag seeded ENABLED would
    open Checkout on the very deploy that ships it."""
    from platform_settings.models import FeatureFlag

    flag = FeatureFlag.objects.get(key="stripe_entitlement_checkout")
    assert flag.is_enabled is False


@pytest.mark.django_db
def test_an_unknown_product_code_is_refused_by_the_database():
    """Spec §23.1: the set of codes is closed "in this release"."""
    with pytest.raises(IntegrityError), transaction.atomic():
        MarketplaceProduct.objects.create(
            code="SUBSCRIPTION",
            name_en="Subscription",
            currency="EUR",
            display_amount=Decimal("10.00"),
            entitlement_valid_days=30,
        )


@pytest.mark.django_db
def test_a_duplicate_product_code_is_refused_by_the_database():
    with pytest.raises(IntegrityError), transaction.atomic():
        MarketplaceProduct.objects.create(
            code=ProductCode.INDIVIDUAL_LISTING_RIGHT,
            name_en="Duplicate",
            currency="EUR",
            display_amount=Decimal("10.00"),
            entitlement_valid_days=30,
        )


@pytest.mark.django_db
def test_a_negative_display_amount_is_refused_by_the_database():
    product = MarketplaceProduct.objects.get(code=ProductCode.LISTING_MEDIA_UPGRADE)
    product.display_amount = Decimal("-1.00")
    with pytest.raises(IntegrityError), transaction.atomic():
        product.save()


@pytest.mark.django_db
@pytest.mark.parametrize("currency", ["eur", "EU", "EURO", "E1R", "", "   "])
def test_a_non_iso4217_currency_is_refused_by_the_database(currency):
    product = MarketplaceProduct.objects.get(code=ProductCode.LISTING_MEDIA_UPGRADE)
    product.currency = currency
    with pytest.raises(IntegrityError), transaction.atomic():
        product.save()


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("display_amount", Decimal("0.00")),
        ("stripe_product_id", ""),
        ("stripe_price_id", ""),
    ],
)
def test_an_incompletely_configured_product_cannot_be_activated(field, value):
    """Spec §38 / §32.1 step 8, enforced by the database rather than by a
    comment: a row missing its amount, its Stripe product id or its Stripe price
    id cannot go active, so no Checkout can ever open against one."""
    product = listing_right_product(is_active=False)
    setattr(product, field, value)
    product.is_active = True

    with pytest.raises(IntegrityError), transaction.atomic():
        product.save()


@pytest.mark.django_db
def test_a_fully_configured_product_can_be_activated():
    """The positive half of the constraint above. Without it, a constraint that
    refused EVERY activation would still pass all the negative cases."""
    product = listing_right_product()

    product.refresh_from_db()
    assert product.is_active is True
    assert MarketplaceProduct.objects.active().count() == 1


@pytest.mark.django_db
def test_an_inactive_product_may_stay_blank_and_zero():
    """The other side of the same constraint: deactivating is always allowed,
    which is what spec §26.4's "Deactivating a product stops new Checkout
    creation but does not invalidate previously purchased entitlements" needs."""
    product = listing_right_product()
    product.is_active = False
    product.display_amount = Decimal("0.00")
    product.stripe_price_id = ""
    product.save()

    product.refresh_from_db()
    assert product.is_active is False
    assert MarketplaceProduct.objects.active().count() == 0


@pytest.mark.django_db
def test_zero_entitlement_validity_is_refused():
    product = MarketplaceProduct.objects.get(code=ProductCode.LISTING_MEDIA_UPGRADE)
    product.entitlement_valid_days = 0
    with pytest.raises(IntegrityError), transaction.atomic():
        product.save()


@pytest.mark.django_db
def test_zero_publication_days_is_refused_but_null_is_allowed():
    product = MarketplaceProduct.objects.get(code=ProductCode.LISTING_MEDIA_UPGRADE)
    product.publication_days = 0
    with pytest.raises(IntegrityError), transaction.atomic():
        product.save()

    product.refresh_from_db()
    product.publication_days = None
    product.save()  # must not raise
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
cd backend && uv run pytest payments/tests/test_models.py -q
```

Expected: `ModuleNotFoundError: No module named 'payments.models'`.

- [ ] **Step 3: Write the model**

`backend/payments/models.py`:

```python
"""Products, orders and webhook events (spec §11.9).

NOTHING in this module stores card data. Spec §23.1 is explicit that "Staff does
not enter card data"; Stripe Checkout is hosted by Stripe and this codebase sees
only identifiers, an amount and a currency. A reviewer finding a `last4`, a card
brand, a cardholder name or a receipt body here must reject the change.
"""

from django.conf import settings
from django.db import models
from django.db.models import Q

from common.models import UUIDTimeStampedModel

from .enums import PRODUCT_CODES, ProductCode


class MarketplaceProductQuerySet(models.QuerySet):
    def active(self):
        return self.filter(is_active=True)


class MarketplaceProduct(UUIDTimeStampedModel):
    """Spec §11.9. Stripe is the payment amount authority at Checkout creation
    time; `display_amount` is for UI and must be reconciled against the live
    Stripe Price before a session opens (spec §23.5, payments.products)."""

    code = models.CharField(max_length=32, unique=True, choices=ProductCode.choices)
    name_en = models.CharField(max_length=120)
    name_it = models.CharField(max_length=120, blank=True, default="")
    name_es = models.CharField(max_length=120, blank=True, default="")
    description_en = models.TextField(blank=True, default="")
    description_it = models.TextField(blank=True, default="")
    description_es = models.TextField(blank=True, default="")
    stripe_product_id = models.CharField(max_length=64, blank=True, default="")
    stripe_price_id = models.CharField(max_length=64, blank=True, default="")
    currency = models.CharField(max_length=3, default="EUR")
    display_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    entitlement_valid_days = models.PositiveIntegerField(default=365)
    publication_days = models.PositiveIntegerField(null=True, blank=True)
    is_active = models.BooleanField(default=False)
    display_order = models.PositiveIntegerField(default=0)
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

    objects = MarketplaceProductQuerySet.as_manager()

    class Meta:
        ordering = ["display_order", "code"]
        constraints = [
            # Spec §23.1: "supports exactly these product codes in this
            # release". Enforced in the database, not only in the enum, so no
            # data migration or shell session can widen the catalogue.
            models.CheckConstraint(
                condition=Q(code__in=sorted(PRODUCT_CODES)),
                name="payments_product_code_is_known",
            ),
            models.CheckConstraint(
                condition=Q(display_amount__gte=0),
                name="payments_product_amount_is_not_negative",
            ),
            models.CheckConstraint(
                condition=Q(currency__regex=r"^[A-Z]{3}$"),
                name="payments_product_currency_is_iso4217",
            ),
            models.CheckConstraint(
                condition=Q(entitlement_valid_days__gt=0),
                name="payments_product_validity_is_positive",
            ),
            models.CheckConstraint(
                condition=Q(publication_days__isnull=True) | Q(publication_days__gt=0),
                name="payments_product_publication_days_is_positive_or_null",
            ),
            # Spec §38 / §32.1 step 8: products are seeded "inactive until valid
            # environment Stripe IDs are supplied", and production "must not
            # include ... decorative financial values or test Stripe IDs". This
            # is that rule as a database invariant: a row cannot be active
            # unless it has a real amount and both Stripe identifiers. It is
            # also why `display_amount` permits 0 at all.
            models.CheckConstraint(
                condition=~Q(is_active=True)
                | (
                    Q(display_amount__gt=0)
                    & ~Q(stripe_product_id="")
                    & ~Q(stripe_price_id="")
                ),
                name="payments_product_active_is_fully_configured",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.code} ({'active' if self.is_active else 'inactive'})"
```

`backend/payments/admin.py`:

```python
from django.contrib import admin

from .models import MarketplaceProduct


@admin.register(MarketplaceProduct)
class MarketplaceProductAdmin(admin.ModelAdmin):
    """Spec §23.5's editable fields. Adding and deleting are both disabled:
    spec §23.1 fixes the catalogue at exactly two codes, so the only legitimate
    operation is editing one of the two seeded rows. The audited path staff
    should normally use is /api/v1/staff/products/ (Task 12); this admin exists
    for break-glass operation and writes `updated_by` so the change is still
    attributable."""

    list_display = (
        "code",
        "is_active",
        "display_amount",
        "currency",
        "stripe_price_id",
        "entitlement_valid_days",
        "publication_days",
        "display_order",
    )
    list_filter = ("is_active", "code")
    search_fields = ("code", "name_en", "stripe_product_id", "stripe_price_id")
    readonly_fields = ("code", "created_by", "updated_by", "created_at", "updated_at")

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def save_model(self, request, obj, form, change):
        obj.updated_by = request.user
        super().save_model(request, obj, form, change)
```

- [ ] **Step 4: Generate the schema migration**

```bash
cd backend && uv run python manage.py makemigrations payments
```

Expected: `payments/migrations/0001_initial.py`, creating `MarketplaceProduct` with six constraints. **Read the generated file**; never hand-write it.

- [ ] **Step 5: Write the seed migration**

First confirm the real name of the `FeatureFlag` migration this one depends on:

```bash
cd backend && ls platform_settings/migrations/
```

`backend/payments/migrations/0002_seed_products_and_checkout_flag.py` (adjust the dependency if the listing above shows a different name):

```python
"""Spec §38: "Two product records, inactive until valid environment Stripe IDs
are supplied", plus spec §35.1's rollout flag, seeded DISABLED.

Deliberately NOT seeded: any amount, any Stripe identifier. Spec §38 forbids
"decorative financial values or test Stripe IDs" in production setup, and the
payments_product_active_is_fully_configured constraint makes an unconfigured row
impossible to activate — so staff must supply the real values per environment
before Checkout can open at all. Idempotent via get_or_create (spec §38:
"Commands are idempotent").
"""

from decimal import Decimal

from django.db import migrations

FLAG_KEY = "stripe_entitlement_checkout"
# platform_settings.FeatureFlag.description is CharField(max_length=255) —
# keep this string under that limit.
FLAG_DESCRIPTION = (
    "Spec 35.1 rollout flag. On = POST /api/v1/checkout-sessions/ accepts "
    "requests. Off = 403 feature_disabled. The Stripe webhook is never gated by "
    "this flag, so an in-flight payment still fulfils after it is turned off."
)

PRODUCTS = [
    {
        "code": "INDIVIDUAL_LISTING_RIGHT",
        "name_en": "Individual listing right",
        "name_it": "Diritto di annuncio individuale",
        "name_es": "Derecho de anuncio individual",
        "description_en": "One paid listing right for a private seller.",
        "entitlement_valid_days": 365,
        "publication_days": 30,
        "display_order": 1,
    },
    {
        "code": "LISTING_MEDIA_UPGRADE",
        "name_en": "Listing media upgrade",
        "name_it": "Upgrade media annuncio",
        "name_es": "Mejora de medios del anuncio",
        "description_en": "Raises one listing's allowance to 20 images and 1 video.",
        "entitlement_valid_days": 365,
        "publication_days": None,
        "display_order": 2,
    },
]


def seed(apps, schema_editor):
    MarketplaceProduct = apps.get_model("payments", "MarketplaceProduct")
    FeatureFlag = apps.get_model("platform_settings", "FeatureFlag")

    for definition in PRODUCTS:
        MarketplaceProduct.objects.get_or_create(
            code=definition["code"],
            defaults={
                **definition,
                "currency": "EUR",
                "display_amount": Decimal("0.00"),
                "stripe_product_id": "",
                "stripe_price_id": "",
                "is_active": False,
            },
        )

    FeatureFlag.objects.get_or_create(
        key=FLAG_KEY,
        defaults={"is_enabled": False, "description": FLAG_DESCRIPTION},
    )


def unseed(apps, schema_editor):
    """Removes only the flag.

    Reversing is a rollback, and spec §35.3 says to "keep additive schema/data
    intact". A staff admin may already have entered real Stripe ids; deleting
    the product rows would destroy that configuration, and would fail anyway
    once a PaymentOrder referenced one through PROTECT.
    """
    FeatureFlag = apps.get_model("platform_settings", "FeatureFlag")
    FeatureFlag.objects.filter(key=FLAG_KEY).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("payments", "0001_initial"),
        ("platform_settings", "0004_featureflag"),
    ]

    operations = [migrations.RunPython(seed, unseed)]
```

- [ ] **Step 6: Run the tests and confirm they pass**

```bash
cd backend && uv run pytest payments/tests/ -q
cd backend && uv run python manage.py makemigrations --check --dry-run
cd backend && uv run pytest -q
```

`makemigrations --check --dry-run` must report no missing migration; the full suite must be green.

- [ ] **Step 7: Mutation check**

1. Remove `payments_product_active_is_fully_configured` from `Meta.constraints`, regenerate the migration into a scratch file, migrate, and confirm **all three** `test_an_incompletely_configured_product_cannot_be_activated` cases fail. Revert and delete the scratch migration.
2. Change the seed's `is_active` to `True` — the migration itself must now fail against the constraint. Revert.
3. Change the seeded flag to `is_enabled=True` → `test_the_rollout_flag_is_seeded_disabled` must fail. Revert.
4. Relax the currency constraint to `Q(currency__length=3)`-equivalent (drop the regex) → the `"eur"` and `"E1R"` cases must fail. Revert.

- [ ] **Step 8: Commit**

```bash
git add backend/payments
git commit -m "feat(payments): MarketplaceProduct, configuration constraints, spec 38 seeds and the rollout flag (Phase 14 Task 2)"
```

---

### Task 3: `PaymentOrder` and `ProcessedWebhookEvent`, with their integrity constraints

**Files:**
- Modify: `backend/payments/models.py` (append two models), `backend/payments/admin.py` (append two read-only admins), `backend/payments/tests/factories.py` (append `make_order`)
- Create: `backend/payments/migrations/0003_paymentorder_processedwebhookevent.py` (generated)
- Test: `backend/payments/tests/test_order_models.py`

**Interfaces:**
- Consumes: `payments.enums.{PaymentOrderStatus, PAID_STATES, WebhookResult}` (Task 1); `payments.models.MarketplaceProduct` (Task 2); `common.models.{UUIDModel, UUIDTimeStampedModel}`.
- Produces:
  - `payments.models.PaymentOrder` — `user`, `product`, `listing`, `status`, `stripe_checkout_session_id`, `stripe_payment_intent_id`, `amount`, `currency`, `idempotency_key`, `client_idempotency_key`, `fulfilled_entitlement`, `metadata`, `paid_at`, `fulfilled_at`, plus `id`/`created_at`/`updated_at`
  - `payments.models.PaymentOrderQuerySet.{for_user, paid, fulfilled, needing_staff_review}`
  - Constraints: `payments_order_amount_is_positive`, `payments_order_currency_is_iso4217`, `payments_order_paid_requires_paid_at`, `payments_order_fulfilled_requires_entitlement_and_stamp`, `payments_order_one_row_per_checkout_session`, `payments_order_one_row_per_payment_intent`, `payments_order_one_row_per_client_idempotency_key`
  - `payments.models.ProcessedWebhookEvent` — `stripe_event_id` (unique), `event_type`, `payload_checksum`, `processed_at`, `result`
  - `payments.tests.factories.make_order(...)`

> **Note (ruling — `listing` and `client_idempotency_key` go beyond spec §11.9's field list, deliberately.)** §11.9's `PaymentOrder` lists neither. `listing` is required because §23.2's body carries `listing_id` and the fulfilment that happens minutes later, in a different process, must know which listing to bind the `MEDIA_UPGRADE` to; the alternatives are a JSON blob with no referential integrity or trusting Stripe's echoed metadata, which §2.2 forbids. `client_idempotency_key` is required by §30.3. Both are recorded here rather than presented as spec-literal, exactly as Phase 13 recorded `granted_by`.

> **Note (ruling — no database CHECK ties `listing` to the product code.)** A `CheckConstraint` cannot dereference the `product` FK to read `code`, so "a media upgrade must have a listing, a listing right must not" is enforced in `payments.checkout` (Task 7) and re-enforced under lock at fulfilment (Task 10). The guarantee that *is* at database level — and the one that actually prevents a double upgrade — is Phase 13's merged partial unique index `entitlements_one_live_right_per_listing_and_type`. Task 10 tests it from both directions.

- [ ] **Step 1: Write the failing test**

Append to `backend/payments/tests/factories.py`:

```python
from django.utils import timezone

from payments.enums import PaymentOrderStatus
from payments.models import PaymentOrder


def make_order(
    *,
    user,
    product,
    status=PaymentOrderStatus.CREATED,
    amount=Decimal("49.00"),
    currency="EUR",
    listing=None,
    stripe_checkout_session_id="",
    stripe_payment_intent_id="",
    client_idempotency_key="",
    paid_at=None,
    fulfilled_at=None,
    fulfilled_entitlement=None,
    metadata=None,
    idempotency_key=None,
):
    """Build one PaymentOrder.

    `paid_at` defaults to a value consistent with `status` so an ordinary caller
    does not have to think about the database constraints — pass an explicit
    `None` to build the inconsistent row a constraint test needs. `amount` is
    coerced so a caller may pass a plain string.
    """
    order = PaymentOrder(
        user=user,
        product=product,
        listing=listing,
        status=status,
        amount=Decimal(amount),
        currency=currency,
        stripe_checkout_session_id=stripe_checkout_session_id,
        stripe_payment_intent_id=stripe_payment_intent_id,
        client_idempotency_key=client_idempotency_key,
        fulfilled_entitlement=fulfilled_entitlement,
        metadata=metadata or {},
        paid_at=paid_at,
        fulfilled_at=fulfilled_at,
    )
    if paid_at is None and status in {
        PaymentOrderStatus.PAID,
        PaymentOrderStatus.FULFILLED,
        PaymentOrderStatus.REFUNDED,
        PaymentOrderStatus.DISPUTED,
    }:
        order.paid_at = timezone.now()
    if fulfilled_at is None and status == PaymentOrderStatus.FULFILLED:
        order.fulfilled_at = timezone.now()
    order.idempotency_key = (
        idempotency_key if idempotency_key is not None else f"checkout:{order.pk}"
    )
    order.save()
    return order
```

`backend/payments/tests/test_order_models.py`:

```python
"""Spec §11.9's PaymentOrder and ProcessedWebhookEvent, and the integrity rules
the webhook relies on instead of re-checking them in Python."""

from decimal import Decimal

import pytest
from django.db import IntegrityError, transaction
from django.utils import timezone

from entitlements.enums import EntitlementType
from entitlements.tests.factories import make_entitlement
from payments.enums import PaymentOrderStatus, WebhookResult
from payments.models import PaymentOrder, ProcessedWebhookEvent
from payments.tests.factories import (
    listing_right_product,
    make_order,
    make_payments_seller,
)


@pytest.fixture
def seller(db):
    return make_payments_seller()


@pytest.fixture
def product(db):
    return listing_right_product()


@pytest.mark.django_db
def test_every_spec_11_9_order_field_exists_with_the_spec_name():
    names = {field.name for field in PaymentOrder._meta.get_fields()}
    assert {
        "id",
        "user",
        "product",
        "status",
        "stripe_checkout_session_id",
        "stripe_payment_intent_id",
        "amount",
        "currency",
        "idempotency_key",
        "fulfilled_entitlement",
        "created_at",
        "paid_at",
        "fulfilled_at",
        "updated_at",
        # Beyond spec §11.9's list, justified in the plan's rulings.
        "listing",
        "client_idempotency_key",
        "metadata",
    } <= names


@pytest.mark.django_db
def test_no_card_data_field_exists_on_the_order():
    """Spec §23.1: nothing in this system holds card data."""
    forbidden = {"last4", "card_number", "pan", "cvc", "cvv", "exp_month",
                 "exp_year", "cardholder_name", "card_brand", "receipt_body"}
    names = {field.name for field in PaymentOrder._meta.get_fields()}
    assert forbidden & names == set()


@pytest.mark.django_db
def test_every_spec_11_9_webhook_event_field_exists_with_the_spec_name():
    names = {field.name for field in ProcessedWebhookEvent._meta.get_fields()}
    assert {
        "id",
        "stripe_event_id",
        "event_type",
        "payload_checksum",
        "processed_at",
        "result",
    } <= names
    # Append-only: an updated_at would imply the row may legitimately change.
    assert "updated_at" not in names


@pytest.mark.django_db
def test_a_duplicate_stripe_event_id_is_refused_by_the_database():
    """This index is spec §23.3 step 3 — "duplicate event ID returns HTTP 200
    without re-fulfillment" — and it is the last line of defence behind the
    webhook's own check."""
    ProcessedWebhookEvent.objects.create(
        stripe_event_id="evt_dup",
        event_type="checkout.session.completed",
        payload_checksum="a" * 64,
        result=WebhookResult.FULFILLED,
    )

    with pytest.raises(IntegrityError), transaction.atomic():
        ProcessedWebhookEvent.objects.create(
            stripe_event_id="evt_dup",
            event_type="checkout.session.completed",
            payload_checksum="b" * 64,
            result=WebhookResult.IGNORED,
        )


@pytest.mark.django_db
def test_a_zero_amount_order_is_refused_by_the_database(seller, product):
    with pytest.raises(IntegrityError), transaction.atomic():
        make_order(user=seller, product=product, amount=Decimal("0.00"))


@pytest.mark.django_db
def test_a_lowercase_currency_order_is_refused_by_the_database(seller, product):
    with pytest.raises(IntegrityError), transaction.atomic():
        make_order(user=seller, product=product, currency="eur")


@pytest.mark.django_db
@pytest.mark.parametrize(
    "status",
    [
        PaymentOrderStatus.PAID,
        PaymentOrderStatus.FULFILLED,
        PaymentOrderStatus.REFUNDED,
        PaymentOrderStatus.DISPUTED,
    ],
)
def test_a_paid_status_without_paid_at_is_refused_by_the_database(
    seller, product, status
):
    """Spec §6.4: "PAID means Stripe has confirmed payment." A row claiming that
    without a timestamp is an unreconcilable ledger entry."""
    with pytest.raises(IntegrityError), transaction.atomic():
        make_order(user=seller, product=product, status=status, paid_at=None)


@pytest.mark.django_db
@pytest.mark.parametrize("status", [PaymentOrderStatus.CREATED,
                                    PaymentOrderStatus.CHECKOUT_OPEN,
                                    PaymentOrderStatus.FAILED,
                                    PaymentOrderStatus.EXPIRED])
def test_an_unpaid_status_may_have_no_paid_at(seller, product, status):
    """The positive half: a constraint refusing EVERY row would still pass the
    negative cases above."""
    order = make_order(user=seller, product=product, status=status, paid_at=None)
    assert order.paid_at is None


@pytest.mark.django_db
def test_fulfilled_without_an_entitlement_is_refused_by_the_database(seller, product):
    """Spec §6.4: "FULFILLED means an entitlement was created exactly once."
    A FULFILLED row with no entitlement is that sentence being false."""
    with pytest.raises(IntegrityError), transaction.atomic():
        make_order(
            user=seller,
            product=product,
            status=PaymentOrderStatus.FULFILLED,
            fulfilled_entitlement=None,
        )


@pytest.mark.django_db
def test_fulfilled_without_a_fulfilled_at_is_refused_by_the_database(seller, product):
    right = make_entitlement(user=seller, entitlement_type=EntitlementType.PAID_LISTING)
    with pytest.raises(IntegrityError), transaction.atomic():
        make_order(
            user=seller,
            product=product,
            status=PaymentOrderStatus.FULFILLED,
            fulfilled_entitlement=right,
            fulfilled_at=None,
            paid_at=timezone.now(),
        )


@pytest.mark.django_db
def test_a_complete_fulfilled_order_is_accepted(seller, product):
    right = make_entitlement(user=seller, entitlement_type=EntitlementType.PAID_LISTING)

    order = make_order(
        user=seller,
        product=product,
        status=PaymentOrderStatus.FULFILLED,
        fulfilled_entitlement=right,
    )

    assert order.fulfilled_at is not None
    assert PaymentOrder.objects.fulfilled().count() == 1


@pytest.mark.django_db
def test_two_orders_cannot_share_one_checkout_session(seller, product):
    make_order(user=seller, product=product, stripe_checkout_session_id="cs_one")

    with pytest.raises(IntegrityError), transaction.atomic():
        make_order(user=seller, product=product, stripe_checkout_session_id="cs_one")


@pytest.mark.django_db
def test_many_orders_may_share_the_empty_checkout_session(seller, product):
    """The partial index must key on non-blank values only: every order is
    created BEFORE its Stripe session exists (spec §23.2), so blank is the
    normal state and a naive unique index would allow exactly one order to exist
    at a time in the whole system."""
    make_order(user=seller, product=product, stripe_checkout_session_id="")
    make_order(user=seller, product=product, stripe_checkout_session_id="")

    assert PaymentOrder.objects.filter(stripe_checkout_session_id="").count() == 2


@pytest.mark.django_db
def test_two_orders_cannot_share_one_payment_intent(seller, product):
    make_order(user=seller, product=product, stripe_payment_intent_id="pi_one")

    with pytest.raises(IntegrityError), transaction.atomic():
        make_order(user=seller, product=product, stripe_payment_intent_id="pi_one")


@pytest.mark.django_db
def test_two_orders_cannot_share_one_stripe_idempotency_key(seller, product):
    order = make_order(user=seller, product=product)

    with pytest.raises(IntegrityError), transaction.atomic():
        make_order(user=seller, product=product, idempotency_key=order.idempotency_key)


@pytest.mark.django_db
def test_one_user_cannot_reuse_a_client_idempotency_key(seller, product):
    """Spec §30.3's replay store. The key is scoped to the user, not global."""
    make_order(user=seller, product=product, client_idempotency_key="idem-1")

    with pytest.raises(IntegrityError), transaction.atomic():
        make_order(user=seller, product=product, client_idempotency_key="idem-1")


@pytest.mark.django_db
def test_two_different_users_may_use_the_same_client_idempotency_key(product):
    """The cross-target negative: scoping the index to the user is what stops
    one customer's chosen key from denying service to another's."""
    first = make_payments_seller("p14-idem-a@example.com")
    second = make_payments_seller("p14-idem-b@example.com")

    make_order(user=first, product=product, client_idempotency_key="idem-1")
    make_order(user=second, product=product, client_idempotency_key="idem-1")

    assert PaymentOrder.objects.filter(client_idempotency_key="idem-1").count() == 2


@pytest.mark.django_db
def test_one_user_may_have_many_orders_with_no_client_idempotency_key(product):
    seller = make_payments_seller("p14-idem-c@example.com")
    make_order(user=seller, product=product, client_idempotency_key="")
    make_order(user=seller, product=product, client_idempotency_key="")

    assert PaymentOrder.objects.for_user(seller).count() == 2


@pytest.mark.django_db
def test_a_fulfilled_entitlement_cannot_be_hard_deleted(seller, product):
    """Spec §35.3: "Do not roll back a fulfilled Stripe entitlement by deleting
    it; preserve ledger and reconcile." PROTECT is that sentence in the
    schema."""
    right = make_entitlement(user=seller, entitlement_type=EntitlementType.PAID_LISTING)
    make_order(
        user=seller,
        product=product,
        status=PaymentOrderStatus.FULFILLED,
        fulfilled_entitlement=right,
    )

    from django.db.models import ProtectedError

    with pytest.raises(ProtectedError), transaction.atomic():
        right.delete()


@pytest.mark.django_db
def test_a_purchased_product_cannot_be_hard_deleted(seller, product):
    from django.db.models import ProtectedError

    make_order(user=seller, product=product)

    with pytest.raises(ProtectedError), transaction.atomic():
        product.delete()


@pytest.mark.django_db
def test_needing_staff_review_selects_only_flagged_orders(seller, product):
    make_order(user=seller, product=product)
    flagged = make_order(
        user=seller,
        product=product,
        status=PaymentOrderStatus.REFUNDED,
        metadata={"staff_review_required": True, "staff_review_reason": "consumed"},
    )

    assert list(PaymentOrder.objects.needing_staff_review()) == [flagged]
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
cd backend && uv run pytest payments/tests/test_order_models.py -q
```

Expected: `ImportError: cannot import name 'PaymentOrder' from 'payments.models'`.

- [ ] **Step 3: Append the two models**

Append to `backend/payments/models.py`, consolidating the new imports into the module's existing import block:

```python
from django.core.serializers.json import DjangoJSONEncoder
from django.utils import timezone

from common.models import UUIDModel

from .enums import PAID_STATES, PaymentOrderStatus, WebhookResult


class PaymentOrderQuerySet(models.QuerySet):
    def for_user(self, user):
        return self.filter(user=user)

    def paid(self):
        return self.filter(status__in=sorted(PAID_STATES))

    def fulfilled(self):
        return self.filter(status=PaymentOrderStatus.FULFILLED)

    def needing_staff_review(self):
        """Spec §23.4: a refund or dispute against a consumed right does not
        unpublish anything; it "marks a payment case for staff review"."""
        return self.filter(metadata__staff_review_required=True)


class PaymentOrder(UUIDTimeStampedModel):
    """Spec §11.9 and §6.4.

    Created BEFORE the Stripe session (spec §23.2), which is why every Stripe
    identifier is blank-able and why the uniqueness on them is partial.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="payment_orders"
    )
    product = models.ForeignKey(
        MarketplaceProduct, on_delete=models.PROTECT, related_name="orders"
    )
    # Beyond spec §11.9's field list — see the plan's ruling. Required because
    # LISTING_MEDIA_UPGRADE binds to one listing (spec §23.1) and fulfilment
    # happens in a different process minutes later.
    listing = models.ForeignKey(
        "listings.BoatListing",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="payment_orders",
    )
    status = models.CharField(
        max_length=16,
        choices=PaymentOrderStatus.choices,
        default=PaymentOrderStatus.CREATED,
    )
    stripe_checkout_session_id = models.CharField(max_length=128, blank=True, default="")
    stripe_payment_intent_id = models.CharField(max_length=128, blank=True, default="")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default="EUR")
    # Spec §23.2: "Use an idempotency key derived from order UUID and
    # operation." Sent to STRIPE; deterministic, so a retried session creation
    # returns Stripe's same session instead of charging twice.
    idempotency_key = models.CharField(max_length=128, unique=True)
    # Spec §30.3's caller-supplied `Idempotency-Key` header. A DIFFERENT thing
    # from the field above; see the plan's ruling.
    client_idempotency_key = models.CharField(max_length=255, blank=True, default="")
    fulfilled_entitlement = models.ForeignKey(
        "entitlements.UserEntitlement",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="fulfilled_orders",
    )
    metadata = models.JSONField(default=dict, blank=True, encoder=DjangoJSONEncoder)
    paid_at = models.DateTimeField(null=True, blank=True)
    fulfilled_at = models.DateTimeField(null=True, blank=True)

    objects = PaymentOrderQuerySet.as_manager()

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "status"]),
            models.Index(fields=["product", "status"]),
            models.Index(fields=["status", "created_at"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=Q(amount__gt=0), name="payments_order_amount_is_positive"
            ),
            models.CheckConstraint(
                condition=Q(currency__regex=r"^[A-Z]{3}$"),
                name="payments_order_currency_is_iso4217",
            ),
            # Spec §6.4: "PAID means Stripe has confirmed payment."
            models.CheckConstraint(
                condition=~Q(status__in=sorted(PAID_STATES)) | Q(paid_at__isnull=False),
                name="payments_order_paid_requires_paid_at",
            ),
            # Spec §6.4: "FULFILLED means an entitlement was created exactly
            # once." A FULFILLED row without one is that sentence being false.
            models.CheckConstraint(
                condition=~Q(status=PaymentOrderStatus.FULFILLED)
                | (
                    Q(fulfilled_entitlement__isnull=False)
                    & Q(fulfilled_at__isnull=False)
                ),
                name="payments_order_fulfilled_requires_entitlement_and_stamp",
            ),
            # Partial, because every order is blank on these until Stripe
            # answers: a plain unique index would let only ONE unpaid order
            # exist in the entire system.
            models.UniqueConstraint(
                fields=["stripe_checkout_session_id"],
                condition=~Q(stripe_checkout_session_id=""),
                name="payments_order_one_row_per_checkout_session",
            ),
            models.UniqueConstraint(
                fields=["stripe_payment_intent_id"],
                condition=~Q(stripe_payment_intent_id=""),
                name="payments_order_one_row_per_payment_intent",
            ),
            # Spec §30.3's replay store, scoped to the user so one customer's
            # chosen key cannot deny service to another's.
            models.UniqueConstraint(
                fields=["user", "client_idempotency_key"],
                condition=~Q(client_idempotency_key=""),
                name="payments_order_one_row_per_client_idempotency_key",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.pk} {self.product_id} {self.status}"


class ProcessedWebhookEvent(UUIDModel):
    """Spec §11.9 and §23.3 step 3.

    Append-only, so it inherits UUIDModel rather than UUIDTimeStampedModel: an
    `updated_at` would imply the row may legitimately change (the audit.AuditEvent
    precedent). `result` IS updated once, inside the same transaction that
    inserted the row and before any commit, which is why there is no second
    visible version of the row to timestamp.

    `payload_checksum` is a SHA-256 of the RAW BODY. It exists so an operator
    can prove two deliveries carried identical bytes; it is never used to make a
    decision, because `stripe_event_id` already is the decision.
    """

    stripe_event_id = models.CharField(max_length=128, unique=True)
    event_type = models.CharField(max_length=128)
    payload_checksum = models.CharField(max_length=64)
    processed_at = models.DateTimeField(default=timezone.now)
    result = models.CharField(
        max_length=24, choices=WebhookResult.choices, default=WebhookResult.RECEIVED
    )

    class Meta:
        ordering = ["-processed_at"]
        indexes = [models.Index(fields=["event_type", "-processed_at"])]
        constraints = [
            models.CheckConstraint(
                condition=Q(result__in=sorted(WebhookResult.values)),
                name="payments_webhook_result_is_known",
            )
        ]

    def __str__(self) -> str:
        return f"{self.stripe_event_id} {self.event_type} {self.result}"
```

- [ ] **Step 4: Append the two read-only admins**

Append to `backend/payments/admin.py`:

```python
from .models import PaymentOrder, ProcessedWebhookEvent


@admin.register(PaymentOrder)
class PaymentOrderAdmin(admin.ModelAdmin):
    """Read-only by design. Spec §26.3: "Staff must not edit Stripe-paid order
    status manually. Payment corrections follow Stripe/service workflows."
    Spec §23.1: "Staff does not ... manually mark a browser redirect as paid."
    Both sentences are the same rule, and this class is where it is enforced."""

    list_display = (
        "id", "user", "product", "status", "amount", "currency",
        "stripe_checkout_session_id", "paid_at", "fulfilled_at",
    )
    list_filter = ("status", "product__code", "currency")
    search_fields = (
        "id", "user__email", "stripe_checkout_session_id",
        "stripe_payment_intent_id", "client_idempotency_key",
    )
    raw_id_fields = ("user", "product", "listing", "fulfilled_entitlement")
    date_hierarchy = "created_at"
    readonly_fields = tuple(field.name for field in PaymentOrder._meta.fields)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(ProcessedWebhookEvent)
class ProcessedWebhookEventAdmin(admin.ModelAdmin):
    list_display = ("stripe_event_id", "event_type", "result", "processed_at")
    list_filter = ("result", "event_type")
    search_fields = ("stripe_event_id",)
    date_hierarchy = "processed_at"
    readonly_fields = tuple(field.name for field in ProcessedWebhookEvent._meta.fields)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
```

- [ ] **Step 5: Generate the migration and run the tests**

```bash
cd backend && uv run python manage.py makemigrations payments
cd backend && uv run pytest payments/tests/ -q
cd backend && uv run python manage.py makemigrations --check --dry-run
cd backend && uv run pytest -q
```

- [ ] **Step 6: Mutation check**

1. Change `payments_order_one_row_per_checkout_session` to a plain `unique=True` on the field and confirm `test_many_orders_may_share_the_empty_checkout_session` fails while the positive duplicate test still passes — that is the pair proving the index is *partial*, not just present.
2. Drop the `user` column from `payments_order_one_row_per_client_idempotency_key`'s `fields` and confirm `test_two_different_users_may_use_the_same_client_idempotency_key` fails.
3. Remove `Q(fulfilled_at__isnull=False)` from `payments_order_fulfilled_requires_entitlement_and_stamp` and confirm `test_fulfilled_without_a_fulfilled_at_is_refused_by_the_database` fails.
4. Change `fulfilled_entitlement`'s `on_delete` to `SET_NULL` and confirm `test_a_fulfilled_entitlement_cannot_be_hard_deleted` fails.

Revert each.

- [ ] **Step 7: Commit**

```bash
git add backend/payments
git commit -m "feat(payments): PaymentOrder and ProcessedWebhookEvent with their integrity constraints (Phase 14 Task 3)"
```

---

### Task 4: Convert `UserEntitlement.source_payment_id` into a real foreign key

**Files:**
- Modify: `backend/entitlements/models.py` (one field), `backend/entitlements/tests/test_user_entitlement_model.py` (one string)
- Create: `backend/entitlements/migrations/0003_userentitlement_source_payment.py` (generated)
- Test: `backend/payments/tests/test_entitlement_link.py`

**Interfaces:**
- Consumes: `payments.models.PaymentOrder` (Task 3); `entitlements.models.UserEntitlement` (Phase 13 Task 2, merged).
- Produces: `UserEntitlement.source_payment` — `ForeignKey("payments.PaymentOrder", null=True, blank=True, on_delete=models.PROTECT, related_name="granted_entitlements")`. The column name stays `source_payment_id`, so `make_entitlement(source_payment_id=…)` and every existing query keep working.

> **Note (Phase 13 reconciliation — run this before cutting the branch).** Phase 13's Tasks 5–14 are in flight. Confirm none of them has landed a change to `entitlements/models.py` or an `entitlements` migration after `0002`:
> ```bash
> cd backend && ls entitlements/migrations/
> git log --oneline -20 -- backend/entitlements/models.py
> ```
> If a `0003` already exists, renumber this migration and re-read the model before editing. This task is Phase 13 contract rule 6's first half and must not be skipped or deferred: `PaymentOrder.fulfilled_entitlement` (Task 3) already points one way, and leaving the return arrow loose would mean a fulfilment could reference an order that does not exist.

- [ ] **Step 1: Write the failing test**

`backend/payments/tests/test_entitlement_link.py`:

```python
"""Phase 13 contract rule 6: `source_payment_id` becomes a real FK."""

import uuid

import pytest
from django.db import IntegrityError, ProtectedError, transaction

from entitlements.enums import EntitlementSource, EntitlementType
from entitlements.models import UserEntitlement
from entitlements.tests.factories import make_entitlement
from payments.tests.factories import (
    listing_right_product,
    make_order,
    make_payments_seller,
)


@pytest.mark.django_db
def test_source_payment_is_a_foreign_key_to_payment_order():
    field = UserEntitlement._meta.get_field("source_payment")

    assert field.many_to_one is True
    assert field.related_model.__name__ == "PaymentOrder"
    assert field.null is True
    # Spec §35.3: "Do not roll back a fulfilled Stripe entitlement by deleting
    # it; preserve ledger and reconcile."
    assert field.remote_field.on_delete.__name__ == "PROTECT"
    # The database column keeps its old name, which is why no factory changes.
    assert field.attname == "source_payment_id"


@pytest.mark.django_db
def test_an_entitlement_can_be_linked_to_a_real_order():
    seller = make_payments_seller("p14-link@example.com")
    order = make_order(user=seller, product=listing_right_product())

    right = make_entitlement(
        user=seller,
        entitlement_type=EntitlementType.PAID_LISTING,
        source=EntitlementSource.STRIPE_PURCHASE,
        source_payment_id=order.pk,
    )

    right.refresh_from_db()
    assert right.source_payment_id == order.pk
    assert list(order.granted_entitlements.all()) == [right]


@pytest.mark.django_db
def test_a_dangling_order_id_is_now_refused_by_the_database():
    """The whole point of the conversion: before it, this row was writable and
    silently referred to nothing."""
    seller = make_payments_seller("p14-dangling@example.com")

    with pytest.raises(IntegrityError), transaction.atomic():
        make_entitlement(
            user=seller,
            entitlement_type=EntitlementType.PAID_LISTING,
            source=EntitlementSource.STRIPE_PURCHASE,
            source_payment_id=uuid.uuid4(),
        )


@pytest.mark.django_db
def test_an_order_that_granted_a_right_cannot_be_hard_deleted():
    seller = make_payments_seller("p14-protect@example.com")
    order = make_order(user=seller, product=listing_right_product())
    make_entitlement(
        user=seller,
        entitlement_type=EntitlementType.PAID_LISTING,
        source=EntitlementSource.STRIPE_PURCHASE,
        source_payment_id=order.pk,
    )

    with pytest.raises(ProtectedError), transaction.atomic():
        order.delete()


@pytest.mark.django_db
def test_a_free_entitlement_still_has_no_order():
    """Phase 13's ordinary free path must be untouched by this conversion."""
    seller = make_payments_seller("p14-free@example.com")

    right = make_entitlement(user=seller)

    assert right.source_payment_id is None
    assert right.source == EntitlementSource.FREE_POLICY
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
cd backend && uv run pytest payments/tests/test_entitlement_link.py -q
```

Expected: `FieldDoesNotExist: UserEntitlement has no field named 'source_payment'` on the first test, and `test_a_dangling_order_id_is_now_refused_by_the_database` **passing nothing** — it will fail because no `IntegrityError` is raised, which is exactly the pre-conversion behaviour this task removes. Read both failures before continuing.

- [ ] **Step 3: Change the one field**

In `backend/entitlements/models.py`, replace the `source_payment_id` field and its comment with:

```python
    # Phase 14 converted this from a loose UUIDField into a real FK (Phase 13
    # contract rule 6). PROTECT, not CASCADE or SET_NULL: spec §35.3 says "Do
    # not roll back a fulfilled Stripe entitlement by deleting it; preserve
    # ledger and reconcile", and the order is half of that ledger. The column
    # name is unchanged (`source_payment_id`), so every existing query and the
    # test factory keep working verbatim.
    source_payment = models.ForeignKey(
        "payments.PaymentOrder",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="granted_entitlements",
    )
```

Nothing else in the file changes. Do **not** touch `UserEntitlementQuerySet`, `Meta`, the constraints or the indexes.

- [ ] **Step 4: Update the one Phase 13 assertion that names the field**

In `backend/entitlements/tests/test_user_entitlement_model.py`, inside `test_every_spec_11_9_field_exists_with_the_spec_name`, change the single set member:

```python
        "source_payment",
```

(was `"source_payment_id"`). `_meta.get_fields()` reports a FK by its *field* name. Nothing else in that file changes; in particular `entitlements/tests/factories.py` is **not** edited, because `UserEntitlement.objects.create(source_payment_id=<uuid or None>)` remains valid for a FK — which `test_an_entitlement_can_be_linked_to_a_real_order` proves.

- [ ] **Step 5: Generate the migration**

```bash
cd backend && uv run python manage.py makemigrations entitlements
```

Expected: `entitlements/migrations/0003_userentitlement_source_payment.py`. **Read it.** Django will emit a `RemoveField` + `AddField` pair or an `AlterField`; either is acceptable here because the column is empty in every environment (nothing has ever written it — `PaymentOrder` did not exist). Confirm the migration's `dependencies` include `("payments", "0003_paymentorder_processedwebhookevent")`; if Django did not infer it, add it by hand, because the FK target table must exist first.

- [ ] **Step 6: Run the tests and confirm they pass**

```bash
cd backend && uv run pytest payments/tests/test_entitlement_link.py entitlements/tests/ -q
cd backend && uv run python manage.py makemigrations --check --dry-run
cd backend && uv run pytest -q
```

The whole `entitlements` package must stay green — this task changes one field and one string and must break nothing Phase 13 merged.

- [ ] **Step 7: Mutation check**

Change `on_delete` to `models.SET_NULL` and confirm both `test_source_payment_is_a_foreign_key_to_payment_order` and `test_an_order_that_granted_a_right_cannot_be_hard_deleted` fail. Revert.

- [ ] **Step 8: Commit**

```bash
git add backend/entitlements backend/payments
git commit -m "feat(entitlements): convert source_payment_id into a real PaymentOrder FK (Phase 14 Task 4)"
```

---

### Task 5: The Stripe seam — one injectable gateway, and this phase's error codes

**Files:**
- Create: `backend/payments/gateway.py`, `backend/payments/errors.py`
- Modify: `backend/payments/tests/conftest.py` (append two fixtures)
- Test: `backend/payments/tests/test_gateway.py`

**Interfaces:**
- Consumes: `settings.STRIPE_SECRET_KEY`; the `stripe` library (15.6.1).
- Produces:
  - `payments.gateway.CheckoutSessionResult` — frozen dataclass: `session_id: str`, `url: str`
  - `payments.gateway.PriceSnapshot` — frozen dataclass: `price_id: str`, `product_id: str`, `unit_amount: int | None`, `currency: str`, `active: bool`, `recurring: bool`
  - `payments.gateway.StripeGateway` — `typing.Protocol` with `create_checkout_session(*, params: dict, idempotency_key: str) -> CheckoutSessionResult` and `retrieve_price(price_id: str) -> PriceSnapshot`
  - `payments.gateway.StripeApiGateway` — the real implementation, built on `stripe.StripeClient(settings.STRIPE_SECRET_KEY)`
  - `payments.gateway.default_gateway() -> StripeGateway`
  - `payments.gateway.StripeUnavailable(Exception)` — internal; converted to the wire code by `payments.errors`
  - `payments.errors.{ProductNotAvailable, ProductPriceMismatch, InvalidReturnUrl, ListingRequiredForProduct, ListingNotUpgradable, IdempotencyKeyRequired, IdempotencyKeyReused, PaymentGatewayUnavailable}`
  - `payments.tests.conftest.{fake_gateway, no_network}` fixtures and `payments.tests.fakes.FakeStripeGateway`

> **Note (ruling — every error in this phase is an `APIException` subclass, never a `ValidationError`.)** `common.exceptions.nauta_exception_handler` (merged, read it) flattens **every** DRF `ValidationError` to the top-level envelope code `validation_error` and puts the *message text*, not the code, into `fields`. A client cannot branch on a code that never reaches the wire. Every named code in this plan's Global Constraints table therefore lives on an `APIException` subclass with an explicit `default_code`, which the handler's `_safe_code()` reads. Where a code needs to carry extra context, the exception sets a dict attribute named **`meta`** — the merged handler's only passthrough. It does **not** set `action`; that passthrough is a Phase 13 Task 6 addition and is not merged (verified).

- [ ] **Step 1: Write the failing test**

Append to `backend/payments/tests/conftest.py`:

```python
@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    """Make any accidental real Stripe API client construction fail loudly.

    Tests must never open a socket. Every service in this app takes a `gateway`
    argument, so a test that forgets to pass one would otherwise fall through to
    `default_gateway()` and hang CI on a connection timeout. This turns that
    into an immediate, named failure.

    `stripe.Webhook.construct_event` is deliberately NOT patched: it performs no
    I/O, and verifying Stripe's real HMAC scheme is the entire point of
    test_webhook_security.py.
    """
    import stripe

    def _forbidden(*args, **kwargs):
        raise AssertionError(
            "A test constructed a real Stripe API client. Pass a FakeStripeGateway "
            "via the service's `gateway=` argument instead."
        )

    monkeypatch.setattr(stripe, "StripeClient", _forbidden)


@pytest.fixture
def fake_gateway():
    from payments.tests.fakes import FakeStripeGateway

    return FakeStripeGateway()
```

`backend/payments/tests/fakes.py`:

```python
"""An in-memory Stripe gateway.

Records every call so a test can assert on the params the service built, and
returns whatever the test told it to return. It implements the StripeGateway
protocol structurally; test_gateway.py pins that it stays in sync with the real
implementation, so a signature change on one is a failure on the other.
"""

from dataclasses import dataclass, field

from payments.gateway import CheckoutSessionResult, PriceSnapshot, StripeUnavailable


@dataclass
class FakeStripeGateway:
    session_id: str = "cs_test_fake"
    url: str = "https://checkout.stripe.com/c/pay/cs_test_fake"
    price: PriceSnapshot | None = None
    raise_on_create: Exception | None = None
    raise_on_retrieve: Exception | None = None
    created: list[dict] = field(default_factory=list)
    retrieved: list[str] = field(default_factory=list)

    def create_checkout_session(self, *, params, idempotency_key):
        self.created.append({"params": params, "idempotency_key": idempotency_key})
        if self.raise_on_create is not None:
            raise self.raise_on_create
        return CheckoutSessionResult(session_id=self.session_id, url=self.url)

    def retrieve_price(self, price_id):
        self.retrieved.append(price_id)
        if self.raise_on_retrieve is not None:
            raise self.raise_on_retrieve
        if self.price is not None:
            return self.price
        return PriceSnapshot(
            price_id=price_id,
            product_id="prod_test_listing_right",
            unit_amount=4900,
            currency="eur",
            active=True,
            recurring=False,
        )


def unavailable():
    return StripeUnavailable("Stripe is unreachable in this test.")
```

`backend/payments/tests/test_gateway.py`:

```python
"""The one place this codebase talks to Stripe, and the guard that keeps tests
off the network."""

import inspect

import pytest
import stripe

from payments.errors import PaymentGatewayUnavailable, ProductNotAvailable
from payments.gateway import (
    CheckoutSessionResult,
    PriceSnapshot,
    StripeApiGateway,
    StripeGateway,
    StripeUnavailable,
    default_gateway,
)
from payments.tests.fakes import FakeStripeGateway


def test_the_fake_and_the_real_gateway_have_identical_signatures():
    """A drifted fake is a test suite that proves nothing about production."""
    for name in ("create_checkout_session", "retrieve_price"):
        real = inspect.signature(getattr(StripeApiGateway, name))
        fake = inspect.signature(getattr(FakeStripeGateway, name))
        assert real == fake, name


def test_both_gateways_satisfy_the_protocol():
    assert isinstance(FakeStripeGateway(), StripeGateway)
    assert isinstance(StripeApiGateway(api_key="sk_test_unit"), StripeGateway)


def test_the_real_gateway_never_reads_the_secret_at_import_time():
    """Constructing the module must not require a configured Stripe account, and
    the key must not be captured into module state where a traceback could
    print it."""
    source = inspect.getsource(StripeApiGateway)
    assert "STRIPE_SECRET_KEY" not in source
    assert "__repr__" not in source or "api_key" not in source


def test_the_secret_is_never_in_the_gateways_repr():
    """A gateway landing in a traceback, a Sentry frame or a log line must not
    carry the live secret key with it."""
    gateway = StripeApiGateway(api_key="sk_live_REDACT_ME")

    assert "sk_live_REDACT_ME" not in repr(gateway)


def test_default_gateway_builds_a_real_client_from_settings(settings, monkeypatch):
    settings.STRIPE_SECRET_KEY = "sk_test_from_settings"
    seen = {}

    def _client(api_key, **kwargs):
        seen["api_key"] = api_key
        return object()

    monkeypatch.setattr(stripe, "StripeClient", _client)

    gateway = default_gateway()

    assert isinstance(gateway, StripeApiGateway)
    assert seen["api_key"] == "sk_test_from_settings"


def test_the_no_network_fixture_blocks_a_real_client(db):
    """Proves the guard in conftest.py is armed — without this, a later test
    that forgot its `gateway=` argument would hang CI instead of failing."""
    with pytest.raises(AssertionError, match="real Stripe API client"):
        stripe.StripeClient("sk_test_anything")


def test_the_fake_records_what_the_caller_asked_for():
    gateway = FakeStripeGateway()

    result = gateway.create_checkout_session(
        params={"mode": "payment"}, idempotency_key="checkout:abc"
    )

    assert result == CheckoutSessionResult(
        session_id="cs_test_fake",
        url="https://checkout.stripe.com/c/pay/cs_test_fake",
    )
    assert gateway.created == [
        {"params": {"mode": "payment"}, "idempotency_key": "checkout:abc"}
    ]


def test_the_fake_can_raise_the_transport_error_the_real_one_raises():
    gateway = FakeStripeGateway(raise_on_create=StripeUnavailable("boom"))

    with pytest.raises(StripeUnavailable):
        gateway.create_checkout_session(params={}, idempotency_key="k")


def test_a_price_snapshot_carries_everything_reconciliation_needs():
    snapshot = PriceSnapshot(
        price_id="price_x",
        product_id="prod_x",
        unit_amount=4900,
        currency="eur",
        active=True,
        recurring=False,
    )

    assert snapshot.unit_amount == 4900
    # Stripe returns currency lower-cased; normalization is the caller's job and
    # is tested in test_products.py.
    assert snapshot.currency == "eur"


@pytest.mark.parametrize(
    ("exception", "code", "status"),
    [
        (ProductNotAvailable(), "product_not_available", 409),
        (PaymentGatewayUnavailable(), "payment_gateway_unavailable", 502),
    ],
)
def test_error_codes_are_api_exception_codes_not_validation_errors(
    exception, code, status
):
    """`common.exceptions` flattens every ValidationError to `validation_error`,
    so a code a client must branch on cannot be one. Read that handler before
    changing any error class in this app."""
    from rest_framework.exceptions import ValidationError

    assert not isinstance(exception, ValidationError)
    assert exception.default_code == code
    assert exception.status_code == status


def test_an_error_may_carry_meta_but_never_a_secret():
    error = ProductNotAvailable(product_code="INDIVIDUAL_LISTING_RIGHT")

    assert error.meta == {"product_code": "INDIVIDUAL_LISTING_RIGHT"}
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
cd backend && uv run pytest payments/tests/test_gateway.py -q
```

Expected: `ModuleNotFoundError: No module named 'payments.gateway'`.

- [ ] **Step 3: Write the errors module**

`backend/payments/errors.py`:

```python
"""Every wire code this phase introduces (spec §30.2).

All of them are APIException subclasses with an explicit `default_code`, NEVER
DRF ValidationErrors: `common.exceptions.nauta_exception_handler` maps every
ValidationError — subclass or not — onto the single envelope code
`validation_error` and flattens its detail with `str()`, so a named code carried
on a ValidationError would be invisible to the client that has to branch on it.

`meta` is the merged handler's one passthrough for extra context. It must never
contain a secret, a raw webhook body, a signature header or anything Stripe sent
verbatim.
"""

from rest_framework.exceptions import APIException


class _MetaAPIException(APIException):
    """APIException that also carries `common.exceptions`' `meta` passthrough."""

    def __init__(self, detail=None, code=None, **meta):
        super().__init__(detail=detail, code=code)
        self.meta = {key: value for key, value in meta.items() if value is not None}


class ProductNotAvailable(_MetaAPIException):
    status_code = 409
    default_detail = "This product is not available for purchase right now."
    default_code = "product_not_available"


class ProductPriceMismatch(_MetaAPIException):
    """Spec §23.5: "A warning is shown if stored display amount differs from
    Stripe's current Price; Checkout is blocked until reconciled"."""

    status_code = 409
    default_detail = "This product's price needs to be reconciled before purchase."
    default_code = "product_price_mismatch"


class InvalidReturnUrl(_MetaAPIException):
    """Spec §33.1: "Allowlist local return URLs; prevent open redirects"."""

    status_code = 400
    default_detail = "That return address is not allowed."
    default_code = "invalid_return_url"


class ListingRequiredForProduct(_MetaAPIException):
    status_code = 400
    default_detail = "Choose which listing this upgrade applies to."
    default_code = "listing_required_for_product"


class ListingNotUpgradable(_MetaAPIException):
    status_code = 409
    default_detail = "This listing cannot be upgraded."
    default_code = "listing_not_upgradable"


class IdempotencyKeyRequired(_MetaAPIException):
    """Spec §30.3: "Require Idempotency-Key for Checkout creation"."""

    status_code = 400
    default_detail = "An Idempotency-Key header is required."
    default_code = "idempotency_key_required"


class IdempotencyKeyReused(_MetaAPIException):
    status_code = 409
    default_detail = "That Idempotency-Key was already used for a different request."
    default_code = "idempotency_key_reused"


class PaymentGatewayUnavailable(_MetaAPIException):
    status_code = 502
    default_detail = "The payment provider is unavailable. Try again shortly."
    default_code = "payment_gateway_unavailable"
```

- [ ] **Step 4: Write the gateway**

`backend/payments/gateway.py`:

```python
"""The single seam between this codebase and Stripe's API.

Everything that would open a socket lives here and nowhere else, so every
service can be tested by passing a fake. Two rules this module exists to keep:

  * The secret key is held on the instance, never on the module and never in a
    repr — a gateway object in a traceback or an error report must not leak it.
  * The stripe library's exceptions never escape. Callers see StripeUnavailable
    and translate it once, at the API boundary, into the
    `payment_gateway_unavailable` envelope. That keeps a Stripe error message
    (which can quote request parameters) out of our response bodies.

Signature verification is deliberately NOT here: it needs no API key, performs
no I/O, and lives in payments.webhooks beside the code that consumes it.
"""

from dataclasses import dataclass
from typing import Protocol, runtime_checkable

import stripe
from django.conf import settings


class StripeUnavailable(Exception):
    """A transport or API-level failure talking to Stripe."""


@dataclass(frozen=True)
class CheckoutSessionResult:
    session_id: str
    url: str


@dataclass(frozen=True)
class PriceSnapshot:
    """The parts of a Stripe Price this system reconciles against.

    `unit_amount` is in MINOR UNITS (integer cents) and may be None for a Price
    with tiered or custom pricing — which this product catalogue must never use,
    and which payments.products treats as a mismatch rather than guessing.
    `currency` is whatever Stripe returned, lower-cased; normalizing is the
    caller's job, so the raw value stays inspectable.
    """

    price_id: str
    product_id: str
    unit_amount: int | None
    currency: str
    active: bool
    recurring: bool


@runtime_checkable
class StripeGateway(Protocol):
    def create_checkout_session(
        self, *, params: dict, idempotency_key: str
    ) -> CheckoutSessionResult: ...

    def retrieve_price(self, price_id: str) -> PriceSnapshot: ...


class StripeApiGateway:
    """The real gateway. Uses stripe.StripeClient rather than the module-level
    `stripe.api_key`, so no global mutable state is involved and two settings
    (or two tests) can never race each other."""

    __slots__ = ("_client",)

    def __init__(self, *, api_key: str):
        # stripe-python 15.x: the v1 namespace is the non-deprecated one.
        self._client = stripe.StripeClient(api_key)

    def __repr__(self) -> str:  # pragma: no cover - trivial, but load-bearing
        return "<StripeApiGateway>"

    def create_checkout_session(
        self, *, params: dict, idempotency_key: str
    ) -> CheckoutSessionResult:
        try:
            session = self._client.v1.checkout.sessions.create(
                params=params, options={"idempotency_key": idempotency_key}
            )
        except stripe.StripeError as exc:
            # Deliberately not `from exc` in the message: str(exc) can quote the
            # parameters we sent. The chained traceback keeps it for the logs;
            # the message this raises carries nothing.
            raise StripeUnavailable("Stripe rejected the session creation.") from exc
        return CheckoutSessionResult(session_id=session.id, url=session.url)

    def retrieve_price(self, price_id: str) -> PriceSnapshot:
        try:
            price = self._client.v1.prices.retrieve(price_id)
        except stripe.StripeError as exc:
            raise StripeUnavailable("Stripe rejected the price lookup.") from exc
        product = price.product
        return PriceSnapshot(
            price_id=price.id,
            # Stripe returns `product` either expanded or as a bare id string.
            product_id=product if isinstance(product, str) else product.id,
            unit_amount=price.unit_amount,
            currency=price.currency,
            active=bool(price.active),
            recurring=price.recurring is not None,
        )


def default_gateway() -> StripeGateway:
    """Read the secret at CALL time, never at import time.

    Import-time reads would make every management command and every test module
    require a configured Stripe account, and would freeze a settings override
    that pytest's `settings` fixture is supposed to be able to change.
    """
    return StripeApiGateway(api_key=settings.STRIPE_SECRET_KEY)
```

- [ ] **Step 5: Run the tests and confirm they pass**

```bash
cd backend && uv run pytest payments/tests/test_gateway.py -q
cd backend && uv run pytest -q
```

Note the deliberate ordering inside `default_gateway`: because it reads `settings.STRIPE_SECRET_KEY` when called, the `no_network` autouse fixture's monkeypatch of `stripe.StripeClient` is what stops `test_default_gateway_builds_a_real_client_from_settings` from needing a network — that test supplies its own `monkeypatch.setattr`, which wins over the fixture's for its duration.

- [ ] **Step 6: Mutation check**

1. Move the `settings.STRIPE_SECRET_KEY` read to module level (`_KEY = settings.STRIPE_SECRET_KEY`) and confirm `test_the_real_gateway_never_reads_the_secret_at_import_time` fails.
2. Delete `__repr__` from `StripeApiGateway` and store the key as `self.api_key` on a non-`__slots__` class — confirm `test_the_secret_is_never_in_the_gateways_repr` fails.
3. Rename `FakeStripeGateway.retrieve_price`'s parameter to `price` and confirm `test_the_fake_and_the_real_gateway_have_identical_signatures` fails.
4. Delete the `no_network` fixture and confirm `test_the_no_network_fixture_blocks_a_real_client` fails.

Revert each.

- [ ] **Step 7: Commit**

```bash
git add backend/payments
git commit -m "feat(payments): injectable Stripe gateway, error codes and the no-network test guard (Phase 14 Task 5)"
```

---

### Task 6: Product resolution and spec §23.5 price reconciliation

**Files:**
- Create: `backend/payments/products.py`
- Test: `backend/payments/tests/test_products.py`

**Interfaces:**
- Consumes: `payments.models.MarketplaceProduct` (Task 2); `payments.gateway.{StripeGateway, PriceSnapshot, StripeUnavailable, default_gateway}` (Task 5); `payments.errors.{ProductNotAvailable, ProductPriceMismatch, PaymentGatewayUnavailable}` (Task 5).
- Produces:
  - `payments.products.minor_units(amount: Decimal, currency: str) -> int`
  - `payments.products.from_minor_units(value: int, currency: str) -> Decimal`
  - `payments.products.PriceCheck` — frozen dataclass: `ok: bool`, `reason: str`, `stripe_unit_amount: int | None`, `stripe_currency: str`, `stored_unit_amount: int`, `stored_currency: str`
  - `payments.products.get_purchasable_product(code: str) -> MarketplaceProduct` — raises `ProductNotAvailable`
  - `payments.products.check_stripe_price(product, *, gateway=None) -> PriceCheck` — never raises for a mismatch; raises `PaymentGatewayUnavailable` for a transport failure
  - `payments.products.require_reconciled_price(product, *, gateway=None) -> PriceCheck` — raises `ProductPriceMismatch` when `check_stripe_price` is not ok

> **Note (ruling — zero-decimal currencies are out of scope, and the code says so loudly.)** Stripe's minor-unit factor is not always 100 (JPY and a handful of others are zero-decimal). This catalogue is EUR-only in this release — spec §1 fixes one marketplace currency and the seeded rows are EUR — so `minor_units()` implements the ×100 case and **raises `ValueError` for any currency not in `TWO_DECIMAL_CURRENCIES`** rather than silently mis-charging by a factor of a hundred. Widening the set is a deliberate, tested change, not an accident. Recorded in Known Limitations.

- [ ] **Step 1: Write the failing test**

`backend/payments/tests/test_products.py`:

```python
"""Spec §23.5's reconciliation rule: "Stripe is the payment amount authority at
Checkout creation time" (§11.9) and "Checkout is blocked until reconciled"."""

from decimal import Decimal

import pytest

from payments.enums import ProductCode
from payments.errors import (
    PaymentGatewayUnavailable,
    ProductNotAvailable,
    ProductPriceMismatch,
)
from payments.gateway import PriceSnapshot, StripeUnavailable
from payments.models import MarketplaceProduct
from payments.products import (
    PriceCheck,
    check_stripe_price,
    from_minor_units,
    get_purchasable_product,
    minor_units,
    require_reconciled_price,
)
from payments.tests.factories import listing_right_product
from payments.tests.fakes import FakeStripeGateway


def snapshot(**overrides):
    defaults = {
        "price_id": "price_test_listing_right",
        "product_id": "prod_test_listing_right",
        "unit_amount": 4900,
        "currency": "eur",
        "active": True,
        "recurring": False,
    }
    defaults.update(overrides)
    return PriceSnapshot(**defaults)


@pytest.mark.parametrize(
    ("amount", "expected"),
    [("49.00", 4900), ("0.01", 1), ("1234.56", 123456), ("1000000.00", 100000000)],
)
def test_minor_units_converts_exactly(amount, expected):
    assert minor_units(Decimal(amount), "EUR") == expected


def test_minor_units_never_uses_float_arithmetic():
    """0.29 * 100 is 28.999999999999996 in binary floating point. A float-based
    implementation would undercharge by a cent and pass a casual test."""
    assert minor_units(Decimal("0.29"), "EUR") == 29
    assert minor_units(Decimal("8.70"), "EUR") == 870


def test_a_sub_cent_amount_is_refused_rather_than_rounded():
    with pytest.raises(ValueError):
        minor_units(Decimal("1.005"), "EUR")


def test_from_minor_units_round_trips():
    assert from_minor_units(4900, "EUR") == Decimal("49.00")
    assert minor_units(from_minor_units(123456, "EUR"), "EUR") == 123456


def test_an_unsupported_currency_raises_rather_than_mis_charging():
    """JPY is zero-decimal: charging 4900 "minor units" for ¥49 would be a
    100x overcharge. Refuse loudly instead."""
    with pytest.raises(ValueError, match="JPY"):
        minor_units(Decimal("49.00"), "JPY")


@pytest.mark.django_db
def test_an_unknown_product_code_is_not_purchasable():
    with pytest.raises(ProductNotAvailable) as excinfo:
        get_purchasable_product("SUBSCRIPTION")

    assert excinfo.value.get_codes() == "product_not_available"


@pytest.mark.django_db
def test_an_inactive_product_is_not_purchasable():
    """Spec §26.4: "Deactivating a product stops new Checkout creation"."""
    with pytest.raises(ProductNotAvailable):
        get_purchasable_product(ProductCode.INDIVIDUAL_LISTING_RIGHT)


@pytest.mark.django_db
def test_an_active_configured_product_is_purchasable():
    """The positive half — without it, a resolver that refused everything would
    still pass both negatives."""
    product = listing_right_product()

    assert get_purchasable_product(ProductCode.INDIVIDUAL_LISTING_RIGHT) == product


@pytest.mark.django_db
def test_a_matching_stripe_price_reconciles():
    product = listing_right_product(display_amount=Decimal("49.00"), currency="EUR")
    gateway = FakeStripeGateway(price=snapshot())

    result = check_stripe_price(product, gateway=gateway)

    assert result.ok is True
    assert result.reason == ""
    assert result.stored_unit_amount == 4900
    assert gateway.retrieved == ["price_test_listing_right"]


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("overrides", "reason"),
    [
        ({"unit_amount": 5900}, "amount"),
        ({"currency": "usd"}, "currency"),
        ({"active": False}, "inactive"),
        ({"recurring": True}, "recurring"),
        ({"unit_amount": None}, "amount"),
        ({"product_id": "prod_someone_elses"}, "product"),
    ],
)
def test_every_kind_of_drift_blocks_checkout(overrides, reason):
    """Spec §23.5: "A warning is shown if stored display amount differs from
    Stripe's current Price; Checkout is blocked until reconciled." Each of these
    is a way the two can differ, and each must block."""
    product = listing_right_product(display_amount=Decimal("49.00"), currency="EUR")
    gateway = FakeStripeGateway(price=snapshot(**overrides))

    result = check_stripe_price(product, gateway=gateway)

    assert result.ok is False
    assert reason in result.reason

    with pytest.raises(ProductPriceMismatch) as excinfo:
        require_reconciled_price(product, gateway=gateway)
    assert excinfo.value.get_codes() == "product_price_mismatch"


@pytest.mark.django_db
def test_stripes_lowercase_currency_still_matches_an_uppercase_stored_one():
    """Stripe returns `"eur"`; the database stores `"EUR"`. A naive == would
    report a permanent mismatch and block every Checkout in production."""
    product = listing_right_product(display_amount=Decimal("49.00"), currency="EUR")

    result = check_stripe_price(product, gateway=FakeStripeGateway(price=snapshot()))

    assert result.ok is True


@pytest.mark.django_db
def test_a_product_with_no_stripe_price_id_never_calls_stripe():
    product = listing_right_product(is_active=False, stripe_price_id="")
    gateway = FakeStripeGateway()

    result = check_stripe_price(product, gateway=gateway)

    assert result.ok is False
    assert "not configured" in result.reason
    assert gateway.retrieved == []


@pytest.mark.django_db
def test_a_stripe_transport_failure_is_not_reported_as_a_price_mismatch():
    """Telling staff "your price is wrong" when Stripe was merely unreachable
    would send them to reconcile a price that is in fact correct."""
    product = listing_right_product()
    gateway = FakeStripeGateway(raise_on_retrieve=StripeUnavailable("down"))

    with pytest.raises(PaymentGatewayUnavailable) as excinfo:
        check_stripe_price(product, gateway=gateway)

    assert excinfo.value.get_codes() == "payment_gateway_unavailable"


@pytest.mark.django_db
def test_no_stripe_error_text_reaches_the_envelope():
    """str(StripeError) can quote the parameters we sent, including metadata."""
    product = listing_right_product()
    gateway = FakeStripeGateway(
        raise_on_retrieve=StripeUnavailable("secret sk_live_abc in the message")
    )

    with pytest.raises(PaymentGatewayUnavailable) as excinfo:
        check_stripe_price(product, gateway=gateway)

    assert "sk_live_abc" not in str(excinfo.value.detail)
    assert "sk_live_abc" not in str(getattr(excinfo.value, "meta", {}))


@pytest.mark.django_db
def test_the_price_check_reports_both_sides_so_staff_can_act():
    product = listing_right_product(display_amount=Decimal("49.00"))
    gateway = FakeStripeGateway(price=snapshot(unit_amount=5900))

    result = check_stripe_price(product, gateway=gateway)

    assert isinstance(result, PriceCheck)
    assert (result.stored_unit_amount, result.stripe_unit_amount) == (4900, 5900)
    assert (result.stored_currency, result.stripe_currency) == ("EUR", "EUR")
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
cd backend && uv run pytest payments/tests/test_products.py -q
```

Expected: `ModuleNotFoundError: No module named 'payments.products'`.

- [ ] **Step 3: Write the module**

`backend/payments/products.py`:

```python
"""Product resolution and Stripe price reconciliation (spec §11.9, §23.2, §23.5).

Spec §11.9: "Stripe is the payment amount authority at Checkout creation time.
`display_amount` is for UI and must be synchronized/validated; mismatch blocks
checkout and alerts staff." That sentence is this module.
"""

from dataclasses import dataclass
from decimal import Decimal

from .errors import PaymentGatewayUnavailable, ProductNotAvailable, ProductPriceMismatch
from .gateway import StripeUnavailable, default_gateway
from .models import MarketplaceProduct

# Currencies whose minor unit is 1/100 of the major unit. This release is
# EUR-only (spec §1 fixes one marketplace currency and the seeds are EUR).
# Stripe has zero-decimal currencies (JPY, KRW, …) where an amount in "cents"
# would be a 100x overcharge, so an unlisted currency RAISES rather than
# guessing. Widening this set is a deliberate, tested change.
TWO_DECIMAL_CURRENCIES: frozenset[str] = frozenset({"EUR", "USD", "GBP", "CHF"})
_MINOR_UNIT_FACTOR = 100


def minor_units(amount: Decimal, currency: str) -> int:
    """Convert a stored decimal amount to Stripe's integer minor units.

    Decimal arithmetic throughout: `float(Decimal("0.29")) * 100` is
    28.999999999999996, and int() of that is 28 — a one-cent undercharge that
    a casual test would not catch.
    """
    code = currency.upper()
    if code not in TWO_DECIMAL_CURRENCIES:
        raise ValueError(f"{code} is not a supported two-decimal currency.")
    scaled = amount * _MINOR_UNIT_FACTOR
    if scaled != scaled.to_integral_value():
        raise ValueError(f"{amount} has sub-minor-unit precision in {code}.")
    return int(scaled)


def from_minor_units(value: int, currency: str) -> Decimal:
    code = currency.upper()
    if code not in TWO_DECIMAL_CURRENCIES:
        raise ValueError(f"{code} is not a supported two-decimal currency.")
    return (Decimal(value) / _MINOR_UNIT_FACTOR).quantize(Decimal("0.01"))


@dataclass(frozen=True)
class PriceCheck:
    """Spec §23.5's "Stripe Price ID validation state", in a form the staff
    screen can render and the Checkout path can refuse on."""

    ok: bool
    reason: str
    stripe_unit_amount: int | None
    stripe_currency: str
    stored_unit_amount: int
    stored_currency: str


def get_purchasable_product(code: str) -> MarketplaceProduct:
    """The product a customer may open a Checkout against, or nothing.

    One query, one refusal code. An unknown code and a deactivated product are
    deliberately indistinguishable from outside: spec §26.4 says deactivating
    "stops new Checkout creation", and telling a caller which of the two it was
    only helps someone enumerate the catalogue.
    """
    product = MarketplaceProduct.objects.active().filter(code=code).first()
    if product is None:
        raise ProductNotAvailable(product_code=code)
    return product


def check_stripe_price(product: MarketplaceProduct, *, gateway=None) -> PriceCheck:
    """Compare the stored display price with Stripe's live Price.

    Returns a result rather than raising, because spec §23.5's staff screen has
    to RENDER the mismatch. `require_reconciled_price` is the raising wrapper
    the Checkout path uses.

    A transport failure is NOT a mismatch and must not be reported as one —
    telling staff to reconcile a price that is in fact correct wastes the one
    action that actually fixes the real case.
    """
    stored_currency = product.currency.upper()
    if not product.stripe_price_id or not product.stripe_product_id:
        return PriceCheck(
            ok=False,
            reason="Stripe product/price is not configured for this product.",
            stripe_unit_amount=None,
            stripe_currency="",
            stored_unit_amount=0,
            stored_currency=stored_currency,
        )

    gateway = gateway or default_gateway()
    try:
        snapshot = gateway.retrieve_price(product.stripe_price_id)
    except StripeUnavailable as exc:
        # Deliberately drops str(exc): a Stripe message can quote the request.
        raise PaymentGatewayUnavailable() from exc

    stored_minor = minor_units(product.display_amount, stored_currency)
    stripe_currency = snapshot.currency.upper()
    base = {
        "stripe_unit_amount": snapshot.unit_amount,
        "stripe_currency": stripe_currency,
        "stored_unit_amount": stored_minor,
        "stored_currency": stored_currency,
    }

    if snapshot.product_id != product.stripe_product_id:
        return PriceCheck(
            ok=False, reason="Stripe price belongs to a different product.", **base
        )
    if not snapshot.active:
        return PriceCheck(ok=False, reason="Stripe price is inactive.", **base)
    if snapshot.recurring:
        # Spec §23.1: both products are "One-time payment".
        return PriceCheck(
            ok=False, reason="Stripe price is recurring, not one-time.", **base
        )
    if snapshot.unit_amount is None:
        return PriceCheck(
            ok=False,
            reason="Stripe price has no fixed unit amount.",
            **base,
        )
    if stripe_currency != stored_currency:
        return PriceCheck(ok=False, reason="Stripe currency differs.", **base)
    if snapshot.unit_amount != stored_minor:
        return PriceCheck(ok=False, reason="Stripe amount differs.", **base)

    return PriceCheck(ok=True, reason="", **base)


def require_reconciled_price(product: MarketplaceProduct, *, gateway=None) -> PriceCheck:
    """Spec §23.5: "Checkout is blocked until reconciled"."""
    result = check_stripe_price(product, gateway=gateway)
    if not result.ok:
        raise ProductPriceMismatch(
            product_code=product.code,
            reason=result.reason,
            stored_amount=str(product.display_amount),
            stored_currency=result.stored_currency,
        )
    return result
```

> **Note.** `ProductPriceMismatch`'s `meta` deliberately carries the **stored** amount only, never Stripe's. The stored value is already public (it is the displayed price); echoing Stripe's live amount to an end user would disclose a configuration the customer is not entitled to see, and the staff endpoint in Task 12 returns both because staff *are*.

- [ ] **Step 4: Run the tests and confirm they pass**

```bash
cd backend && uv run pytest payments/tests/test_products.py -q
cd backend && uv run pytest -q
```

Note: the parametrized drift test asserts a substring of `reason`, so keep the reason strings containing the words `amount`, `currency`, `inactive`, `recurring`, `product` and `not configured` exactly as written.

- [ ] **Step 5: Mutation check**

1. Change `minor_units` to `int(float(amount) * 100)` → `test_minor_units_never_uses_float_arithmetic` must fail.
2. Drop the `.upper()` from `stripe_currency` → `test_stripes_lowercase_currency_still_matches_an_uppercase_stored_one` must fail.
3. Delete the `snapshot.recurring` branch → the `recurring` case of `test_every_kind_of_drift_blocks_checkout` must fail.
4. Delete the `snapshot.product_id` branch → the `product` case must fail.
5. Let `StripeUnavailable` fall through as a `PriceCheck(ok=False)` instead of raising → `test_a_stripe_transport_failure_is_not_reported_as_a_price_mismatch` must fail.
6. Change `get_purchasable_product` to drop `.active()` → `test_an_inactive_product_is_not_purchasable` must fail.

Revert each.

- [ ] **Step 6: Commit**

```bash
git add backend/payments
git commit -m "feat(payments): product resolution and spec 23.5 Stripe price reconciliation (Phase 14 Task 6)"
```

---

### Task 7: The return-URL allowlist and `create_checkout_session`

**Files:**
- Create: `backend/payments/checkout.py`, `backend/payments/signals.py`
- Test: `backend/payments/tests/test_checkout.py`

**Interfaces:**
- Consumes: `payments.products.{get_purchasable_product, require_reconciled_price, minor_units}` (Task 6); `payments.gateway.{StripeUnavailable, default_gateway}` (Task 5); `payments.errors.*` (Task 5); `payments.models.{PaymentOrder, MarketplaceProduct}` (Tasks 2–3); `payments.enums.{LISTING_BOUND_PRODUCTS, PaymentOrderStatus, ProductCode}` (Task 1); `entitlements.enums.{EntitlementState, EntitlementType}` and `entitlements.models.UserEntitlement` (Phase 13 Task 1/2, **merged**); `listings.models.BoatListing` and `listings.enums.ListingStatus` (Phase 11, merged); `accounts.enums.SellerType`; `audit.services.record_audit_event`; `settings.PUBLIC_BASE_URL`.
- Produces:
  - `payments.checkout.RETURN_URL_ALLOWLIST: frozenset[str]`, `payments.checkout.DEFAULT_RETURN_URL: str`
  - `payments.checkout.build_return_urls(order_id, return_url) -> tuple[str, str]` — raises `InvalidReturnUrl`
  - `payments.checkout.assert_listing_is_upgradable(*, user, listing) -> None` — raises `ListingNotUpgradable`
  - `payments.checkout.CheckoutResult` — frozen dataclass: `order: PaymentOrder`, `checkout_url: str`, `created: bool`
  - `payments.checkout.create_checkout_session(*, user, product_code, listing_id=None, return_url=None, client_idempotency_key, request_id=None, gateway=None) -> CheckoutResult`
  - `payments.signals.{payment_fulfilled, payment_needs_staff_review}`

> **Note (ruling — the allowlist holds PATHS, and the absolute URL is always built from `PUBLIC_BASE_URL`.)** Spec §23.2: "Success/cancel URLs are allowlisted local routes"; §33.1: "Allowlist local return URLs; prevent open redirects". Accepting an absolute URL and then checking its host is the pattern that keeps producing open redirects (`https://nautelo.test.evil.com`, `//evil.com`, `\/\/evil.com`, userinfo tricks). This implementation never parses a caller-supplied host at all: the caller sends a **path**, the path must be a member of a closed `frozenset`, and the URL handed to Stripe is `settings.PUBLIC_BASE_URL.rstrip("/") + path + query`. Membership in a frozenset is not a prefix match, so `/sell/../../evil` and `/sell/%2e%2e` are simply not members.

> **Note (ruling — the paths on the allowlist are spec §4.1/§4.2 routes, nothing invented.)** `/dashboard/private-seller/listings/` is §23.2's own worked example (§4.2 gives the private seller `/dashboard/private-seller/` and `/listings/`); `/dashboard/private-seller/` is §4.2's dashboard root; `/sell/` and `/sell/create/` are §4.1's sell landing and creation routes, which is where a §22.3 CTA purchase begins. No other route may be added without a spec citation.

- [ ] **Step 1: Write the failing test**

`backend/payments/tests/test_checkout.py`:

```python
"""Spec §23.2's Checkout creation rules, one test per bullet."""

from decimal import Decimal

import pytest
from django.utils import timezone

from audit.models import AuditEvent
from entitlements.enums import EntitlementState, EntitlementType
from entitlements.tests.factories import make_entitlement
from listings.enums import ListingStatus
from listings.tests.factories import make_brand, make_private_listing
from payments.checkout import (
    DEFAULT_RETURN_URL,
    RETURN_URL_ALLOWLIST,
    build_return_urls,
    create_checkout_session,
)
from payments.enums import PaymentOrderStatus, ProductCode
from payments.errors import (
    InvalidReturnUrl,
    ListingNotUpgradable,
    ListingRequiredForProduct,
    PaymentGatewayUnavailable,
    ProductNotAvailable,
    ProductPriceMismatch,
)
from payments.gateway import PriceSnapshot, StripeUnavailable
from payments.models import PaymentOrder
from payments.tests.factories import (
    listing_right_product,
    make_payments_seller,
    media_upgrade_product,
)
from payments.tests.fakes import FakeStripeGateway

# make_private_listing(owner=...) derives its brand name from the OWNER's pk
# (f"Brand {owner.pk.hex[:8]}", see listings/tests/factories.py) and
# BoatBrand.normalized_name is unique=True — so a SECOND listing for the SAME
# owner in one test must be given its own brand or the insert dies with an
# IntegrityError before the assertion under test is ever reached.


@pytest.fixture
def seller(db):
    return make_payments_seller()


@pytest.fixture
def gateway():
    return FakeStripeGateway()


def upgrade_gateway():
    return FakeStripeGateway(
        price=PriceSnapshot(
            price_id="price_test_media_upgrade",
            product_id="prod_test_media_upgrade",
            unit_amount=1900,
            currency="eur",
            active=True,
            recurring=False,
        )
    )


@pytest.mark.django_db
def test_the_allowlist_holds_only_spec_4_routes():
    assert RETURN_URL_ALLOWLIST == {
        "/dashboard/private-seller/listings/",
        "/dashboard/private-seller/",
        "/sell/",
        "/sell/create/",
    }
    assert DEFAULT_RETURN_URL in RETURN_URL_ALLOWLIST


@pytest.mark.django_db
def test_the_success_and_cancel_urls_are_built_from_public_base_url(settings):
    settings.PUBLIC_BASE_URL = "https://nautelo.example"

    success, cancel = build_return_urls("order-1", "/sell/")

    assert success == (
        "https://nautelo.example/sell/?order=order-1&checkout=success"
    )
    assert cancel == "https://nautelo.example/sell/?order=order-1&checkout=cancelled"


@pytest.mark.django_db
def test_a_trailing_slash_on_public_base_url_does_not_double_up(settings):
    settings.PUBLIC_BASE_URL = "https://nautelo.example/"

    success, _ = build_return_urls("order-1", "/sell/")

    assert success.startswith("https://nautelo.example/sell/")


@pytest.mark.django_db
def test_a_missing_return_url_falls_back_to_the_default(settings):
    settings.PUBLIC_BASE_URL = "https://nautelo.example"

    success, _ = build_return_urls("order-1", None)

    assert success.startswith(f"https://nautelo.example{DEFAULT_RETURN_URL}")


@pytest.mark.django_db
@pytest.mark.parametrize(
    "hostile",
    [
        "https://evil.example/steal",
        "http://evil.example",
        "//evil.example",
        "///evil.example",
        "\\\\evil.example",
        "/\\evil.example",
        "https://nautelo.example.evil.test/sell/",
        "/sell/../../etc/passwd",
        "/sell/%2e%2e/",
        "/sell/?next=https://evil.example",
        "/sell",           # not the allowlisted spelling
        "/SELL/",          # case must match exactly
        "javascript:alert(1)",
        "data:text/html,<script>",
        "/dashboard/private-seller/listings/extra/",
        "",
        "   ",
    ],
)
def test_every_non_allowlisted_return_url_is_refused(hostile):
    """Spec §33.1: "Allowlist local return URLs; prevent open redirects." This
    implementation never parses a caller-supplied host at all — membership in a
    frozenset of paths is not a prefix match, so none of these can pass."""
    with pytest.raises(InvalidReturnUrl) as excinfo:
        build_return_urls("order-1", hostile)

    assert excinfo.value.get_codes() == "invalid_return_url"


@pytest.mark.django_db
def test_a_successful_checkout_creates_the_order_before_the_stripe_call(
    seller, gateway
):
    """Spec §23.2: "Create local PaymentOrder before Stripe session"."""
    listing_right_product()

    result = create_checkout_session(
        user=seller,
        product_code=ProductCode.INDIVIDUAL_LISTING_RIGHT,
        return_url="/sell/",
        client_idempotency_key="idem-1",
        gateway=gateway,
    )

    order = result.order
    assert result.created is True
    assert order.status == PaymentOrderStatus.CHECKOUT_OPEN
    assert order.stripe_checkout_session_id == "cs_test_fake"
    assert order.amount == Decimal("49.00")
    assert order.currency == "EUR"
    # Spec §23.2: "Use an idempotency key derived from order UUID and operation."
    assert order.idempotency_key == f"checkout:{order.pk}"
    assert gateway.created[0]["idempotency_key"] == f"checkout:{order.pk}"


@pytest.mark.django_db
def test_the_amount_sent_to_stripe_is_a_price_id_not_a_number(seller, gateway):
    """Spec §23.2: "Server loads Stripe Price; client cannot submit
    amount/currency." The params must reference the price, never quote one."""
    listing_right_product()

    create_checkout_session(
        user=seller,
        product_code=ProductCode.INDIVIDUAL_LISTING_RIGHT,
        client_idempotency_key="idem-1",
        gateway=gateway,
    )

    params = gateway.created[0]["params"]
    assert params["line_items"] == [
        {"price": "price_test_listing_right", "quantity": 1}
    ]
    assert params["mode"] == "payment"
    assert "amount" not in params
    assert "unit_amount" not in params
    assert "price_data" not in params


@pytest.mark.django_db
def test_stripe_metadata_carries_internal_ids_and_no_personal_data(seller, gateway):
    """Spec §23.2: "Store internal order/user/product identifiers in Stripe
    metadata, not personal message content." Spec §33.2 adds the privacy rule."""
    listing_right_product()

    result = create_checkout_session(
        user=seller,
        product_code=ProductCode.INDIVIDUAL_LISTING_RIGHT,
        client_idempotency_key="idem-1",
        gateway=gateway,
    )

    metadata = gateway.created[0]["params"]["metadata"]
    assert metadata == {
        "order_id": str(result.order.pk),
        "user_id": str(seller.pk),
        "product_code": ProductCode.INDIVIDUAL_LISTING_RIGHT,
        "listing_id": "",
    }
    flattened = str(gateway.created[0]["params"])
    assert seller.email not in flattened
    assert "customer_email" not in gateway.created[0]["params"]


@pytest.mark.django_db
def test_an_inactive_product_never_reaches_stripe(seller, gateway):
    with pytest.raises(ProductNotAvailable):
        create_checkout_session(
            user=seller,
            product_code=ProductCode.INDIVIDUAL_LISTING_RIGHT,
            client_idempotency_key="idem-1",
            gateway=gateway,
        )

    assert gateway.created == []
    assert PaymentOrder.objects.count() == 0


@pytest.mark.django_db
def test_a_price_mismatch_blocks_checkout_and_writes_no_order(seller):
    """Spec §23.5: "Checkout is blocked until reconciled"."""
    listing_right_product(display_amount=Decimal("59.00"))
    gateway = FakeStripeGateway()  # its default price is 4900

    with pytest.raises(ProductPriceMismatch):
        create_checkout_session(
            user=seller,
            product_code=ProductCode.INDIVIDUAL_LISTING_RIGHT,
            client_idempotency_key="idem-1",
            gateway=gateway,
        )

    assert gateway.created == []
    assert PaymentOrder.objects.count() == 0


@pytest.mark.django_db
def test_replaying_the_same_idempotency_key_returns_the_same_order(seller, gateway):
    """Spec §30.3: "Store outcome for safe replay"."""
    listing_right_product()
    kwargs = dict(
        user=seller,
        product_code=ProductCode.INDIVIDUAL_LISTING_RIGHT,
        return_url="/sell/",
        client_idempotency_key="idem-1",
        gateway=gateway,
    )

    first = create_checkout_session(**kwargs)
    second = create_checkout_session(**kwargs)

    assert second.created is False
    assert second.order.pk == first.order.pk
    assert second.checkout_url == first.checkout_url
    assert PaymentOrder.objects.count() == 1
    # The replay must not open a second Stripe session.
    assert len(gateway.created) == 1


@pytest.mark.django_db
def test_reusing_an_idempotency_key_for_a_different_request_is_refused(seller, gateway):
    listing_right_product()
    create_checkout_session(
        user=seller,
        product_code=ProductCode.INDIVIDUAL_LISTING_RIGHT,
        return_url="/sell/",
        client_idempotency_key="idem-1",
        gateway=gateway,
    )

    with pytest.raises(Exception) as excinfo:
        create_checkout_session(
            user=seller,
            product_code=ProductCode.INDIVIDUAL_LISTING_RIGHT,
            return_url="/dashboard/private-seller/",
            client_idempotency_key="idem-1",
            gateway=gateway,
        )

    assert excinfo.value.get_codes() == "idempotency_key_reused"


@pytest.mark.django_db
def test_two_users_may_use_the_same_idempotency_key(gateway):
    listing_right_product()
    first = make_payments_seller("p14-two-a@example.com")
    second = make_payments_seller("p14-two-b@example.com")
    kwargs = dict(
        product_code=ProductCode.INDIVIDUAL_LISTING_RIGHT,
        client_idempotency_key="idem-shared",
        gateway=gateway,
    )

    a = create_checkout_session(user=first, **kwargs)
    b = create_checkout_session(user=second, **kwargs)

    assert a.order.pk != b.order.pk


@pytest.mark.django_db
def test_a_stripe_failure_leaves_a_retriable_created_order(seller):
    """The order is written before the Stripe call, so a transport failure must
    leave it recoverable rather than orphaned — and the retry must reuse the
    SAME Stripe idempotency key so a session Stripe did in fact create is
    returned rather than duplicated."""
    listing_right_product()
    failing = FakeStripeGateway(raise_on_create=StripeUnavailable("down"))

    with pytest.raises(PaymentGatewayUnavailable):
        create_checkout_session(
            user=seller,
            product_code=ProductCode.INDIVIDUAL_LISTING_RIGHT,
            client_idempotency_key="idem-1",
            gateway=failing,
        )

    order = PaymentOrder.objects.get()
    assert order.status == PaymentOrderStatus.CREATED
    assert order.stripe_checkout_session_id == ""

    working = FakeStripeGateway()
    retry = create_checkout_session(
        user=seller,
        product_code=ProductCode.INDIVIDUAL_LISTING_RIGHT,
        client_idempotency_key="idem-1",
        gateway=working,
    )

    assert retry.order.pk == order.pk
    assert working.created[0]["idempotency_key"] == f"checkout:{order.pk}"
    assert PaymentOrder.objects.count() == 1


@pytest.mark.django_db
def test_a_media_upgrade_without_a_listing_is_refused(seller, gateway):
    media_upgrade_product()

    with pytest.raises(ListingRequiredForProduct):
        create_checkout_session(
            user=seller,
            product_code=ProductCode.LISTING_MEDIA_UPGRADE,
            client_idempotency_key="idem-1",
            gateway=upgrade_gateway(),
        )


@pytest.mark.django_db
def test_a_listing_right_with_a_listing_id_is_refused(seller, gateway):
    """The inverse. A listing right is consumed at submit (spec §6.3), not bound
    at purchase, so accepting a listing id would create a binding the rest of
    the system does not honour."""
    listing_right_product()
    listing = make_private_listing(owner=seller)

    with pytest.raises(ListingNotUpgradable):
        create_checkout_session(
            user=seller,
            product_code=ProductCode.INDIVIDUAL_LISTING_RIGHT,
            listing_id=str(listing.pk),
            client_idempotency_key="idem-1",
            gateway=gateway,
        )


@pytest.mark.django_db
def test_a_user_cannot_buy_a_media_upgrade_for_someone_elses_listing():
    """Spec §23's acceptance list: "User cannot buy a media upgrade for another
    user's listing." Also spec §33.1's IDOR rule."""
    media_upgrade_product()
    owner = make_payments_seller("p14-owner@example.com")
    attacker = make_payments_seller("p14-attacker@example.com")
    listing = make_private_listing(owner=owner)

    with pytest.raises(ListingNotUpgradable) as excinfo:
        create_checkout_session(
            user=attacker,
            product_code=ProductCode.LISTING_MEDIA_UPGRADE,
            listing_id=str(listing.pk),
            client_idempotency_key="idem-1",
            gateway=upgrade_gateway(),
        )

    assert excinfo.value.get_codes() == "listing_not_upgradable"
    assert PaymentOrder.objects.count() == 0


@pytest.mark.django_db
def test_an_unknown_listing_id_is_refused_the_same_way(seller):
    """A missing listing and someone else's listing must be indistinguishable,
    or the endpoint becomes a listing-ownership oracle."""
    media_upgrade_product()

    with pytest.raises(ListingNotUpgradable):
        create_checkout_session(
            user=seller,
            product_code=ProductCode.LISTING_MEDIA_UPGRADE,
            listing_id="8bd0a6d4-0000-4000-8000-000000000000",
            client_idempotency_key="idem-1",
            gateway=upgrade_gateway(),
        )


@pytest.mark.django_db
def test_an_already_upgraded_listing_cannot_be_upgraded_again(seller):
    """Spec §23.1: one upgrade, "bound to one eligible private-seller listing"."""
    media_upgrade_product()
    listing = make_private_listing(owner=seller)
    make_entitlement(
        user=seller,
        entitlement_type=EntitlementType.MEDIA_UPGRADE,
        listing=listing,
        state=EntitlementState.AVAILABLE,
    )

    with pytest.raises(ListingNotUpgradable):
        create_checkout_session(
            user=seller,
            product_code=ProductCode.LISTING_MEDIA_UPGRADE,
            listing_id=str(listing.pk),
            client_idempotency_key="idem-1",
            gateway=upgrade_gateway(),
        )


@pytest.mark.django_db
def test_a_revoked_upgrade_does_not_block_a_new_purchase(seller):
    """A refunded upgrade is REVOKED (spec §23.4), and a REVOKED row is excluded
    from Phase 13's live-right unique index — so the customer may buy again."""
    media_upgrade_product()
    listing = make_private_listing(owner=seller)
    make_entitlement(
        user=seller,
        entitlement_type=EntitlementType.MEDIA_UPGRADE,
        listing=listing,
        state=EntitlementState.REVOKED,
    )

    result = create_checkout_session(
        user=seller,
        product_code=ProductCode.LISTING_MEDIA_UPGRADE,
        listing_id=str(listing.pk),
        client_idempotency_key="idem-1",
        gateway=upgrade_gateway(),
    )

    assert result.order.listing_id == listing.pk


@pytest.mark.django_db
@pytest.mark.parametrize(
    "status", [ListingStatus.ARCHIVED, ListingStatus.EXPIRED]
)
def test_an_archived_or_expired_listing_cannot_be_upgraded(seller, status):
    """Selling an upgrade for a listing that can never be published again would
    be selling nothing — and reactivation after expiry does not exist (Phase 13
    Known Limitation 4)."""
    media_upgrade_product()
    listing = make_private_listing(owner=seller, status=status)

    with pytest.raises(ListingNotUpgradable):
        create_checkout_session(
            user=seller,
            product_code=ProductCode.LISTING_MEDIA_UPGRADE,
            listing_id=str(listing.pk),
            client_idempotency_key="idem-1",
            gateway=upgrade_gateway(),
        )


@pytest.mark.django_db
def test_a_broker_listing_cannot_be_upgraded(seller):
    """Spec §23.1: the upgrade is bound to a "private-seller listing". Brokers
    already have the higher allowance (spec §24.1)."""
    from brokers.tests.factories import make_broker
    from listings.tests.factories import make_broker_listing

    media_upgrade_product()
    broker = make_broker("P14 Marine", "p14-marine")
    listing = make_broker_listing(broker=broker, actor=seller)

    with pytest.raises(ListingNotUpgradable):
        create_checkout_session(
            user=seller,
            product_code=ProductCode.LISTING_MEDIA_UPGRADE,
            listing_id=str(listing.pk),
            client_idempotency_key="idem-1",
            gateway=upgrade_gateway(),
        )


@pytest.mark.django_db
def test_checkout_creation_writes_two_audit_events(seller, gateway):
    """Spec §2.4: every state change is audited. CREATED and CHECKOUT_OPEN are
    two distinct states and each gets its own row, so an order stuck at CREATED
    is visibly distinguishable from one that never existed."""
    listing_right_product()

    result = create_checkout_session(
        user=seller,
        product_code=ProductCode.INDIVIDUAL_LISTING_RIGHT,
        client_idempotency_key="idem-1",
        gateway=gateway,
        request_id="req-42",
    )

    actions = list(
        AuditEvent.objects.filter(target_id=str(result.order.pk))
        .order_by("created_at")
        .values_list("action", flat=True)
    )
    assert actions == ["payment_order.created", "payment_order.checkout_opened"]
    event = AuditEvent.objects.get(action="payment_order.checkout_opened")
    assert event.actor_user_id == seller.pk
    assert event.source == AuditEvent.Source.API
    assert event.request_id == "req-42"


@pytest.mark.django_db
def test_no_secret_or_url_token_reaches_an_audit_event(seller, gateway, settings):
    settings.STRIPE_SECRET_KEY = "sk_live_NEVER_LOG_ME"
    listing_right_product()

    create_checkout_session(
        user=seller,
        product_code=ProductCode.INDIVIDUAL_LISTING_RIGHT,
        client_idempotency_key="idem-1",
        gateway=gateway,
    )

    dumped = "".join(
        str(event.metadata) + str(event.after) + str(event.before)
        for event in AuditEvent.objects.all()
    )
    assert "sk_live_NEVER_LOG_ME" not in dumped
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
cd backend && uv run pytest payments/tests/test_checkout.py -q
```

Expected: `ModuleNotFoundError: No module named 'payments.checkout'`.

- [ ] **Step 3: Write the signals module**

`backend/payments/signals.py`:

```python
"""Payment signals (spec §23.3 step 9, §23.4).

There is no `notifications` app yet (Phase 6/18), so this phase does what Phase
13 did for listing expiry: define the signal, fire it with everything a receiver
needs, and let Phase 18 connect the receivers. Both are fired inside
transaction.on_commit() — a receiver that emailed "your right is ready" from
inside the transaction would send it even when the transaction later rolled back.
"""

import django.dispatch

# sender = payments.models.PaymentOrder
#   order:       the fulfilled PaymentOrder
#   entitlement: the UserEntitlement it created
payment_fulfilled = django.dispatch.Signal()

# sender = payments.models.PaymentOrder
#   order:  the PaymentOrder needing attention
#   reason: a short machine string ("amount_mismatch", "refund_of_consumed_right",
#           "dispute", "currency_mismatch", ...)
#   detail: a short human string, free of secrets and of anything Stripe sent
payment_needs_staff_review = django.dispatch.Signal()
```

- [ ] **Step 4: Write the checkout module**

`backend/payments/checkout.py`:

```python
"""Checkout Session creation (spec §23.2).

The order of operations is fixed by the spec and by safety, in this sequence:

  1. Resolve the product and refuse an inactive one   (§23.2 "Product must be active")
  2. Reconcile the stored price against Stripe        (§23.5 "blocked until reconciled")
  3. Validate the listing binding                     (§23.2 media-upgrade rule)
  4. Validate the return URL                          (§33.1 open-redirect rule)
  5. Create the local PaymentOrder                    (§23.2 "before Stripe session")
  6. Create the Stripe session with a deterministic idempotency key
  7. Record the session id and move to CHECKOUT_OPEN

Steps 1-4 happen BEFORE any row is written, so a refused request leaves no
orphan order behind. Step 6 happens AFTER the order's transaction has committed,
deliberately: a network call inside a transaction holds row locks open for the
length of an HTTP round trip to a third party.
"""

from dataclasses import dataclass
from urllib.parse import urlencode

from django.conf import settings
from django.db import IntegrityError, transaction

from audit.models import AuditEvent
from audit.services import record_audit_event
from entitlements.enums import EntitlementState, EntitlementType
from entitlements.models import UserEntitlement
from listings.enums import ListingStatus
from listings.models import BoatListing
from accounts.enums import SellerType

from .enums import LISTING_BOUND_PRODUCTS, PaymentOrderStatus
from .errors import (
    IdempotencyKeyRequired,
    IdempotencyKeyReused,
    InvalidReturnUrl,
    ListingNotUpgradable,
    ListingRequiredForProduct,
    PaymentGatewayUnavailable,
)
from .gateway import StripeUnavailable, default_gateway
from .models import PaymentOrder
from .products import get_purchasable_product, require_reconciled_price

# Spec §23.2: "Success/cancel URLs are allowlisted local routes."
# Spec §33.1: "Allowlist local return URLs; prevent open redirects."
# Every member is a spec §4.1/§4.2 route. Membership is exact-match against this
# frozenset — NOT a prefix check, NOT a host check on a caller-supplied absolute
# URL — which is what makes `//evil.example`, `/sell/../x` and
# `https://nautelo.example.evil.test/sell/` structurally unable to pass.
RETURN_URL_ALLOWLIST: frozenset[str] = frozenset(
    {
        "/dashboard/private-seller/listings/",  # spec §23.2's worked example
        "/dashboard/private-seller/",           # spec §4.2
        "/sell/",                               # spec §4.1
        "/sell/create/",                        # spec §4.1
    }
)
DEFAULT_RETURN_URL = "/dashboard/private-seller/listings/"

# Spec §23.1: the upgrade applies to a listing that can still be published.
UPGRADABLE_LISTING_STATES: frozenset[str] = frozenset(
    {
        ListingStatus.DRAFT,
        ListingStatus.PENDING_APPROVAL,
        ListingStatus.PUBLISHED,
        ListingStatus.REJECTED,
        ListingStatus.SUSPENDED,
    }
)


def build_return_urls(order_id, return_url: str | None) -> tuple[str, str]:
    """(success_url, cancel_url), both absolute and both locally-owned."""
    path = DEFAULT_RETURN_URL if return_url is None else return_url
    if path not in RETURN_URL_ALLOWLIST:
        raise InvalidReturnUrl()

    base = settings.PUBLIC_BASE_URL.rstrip("/")

    def _url(outcome: str) -> str:
        query = urlencode({"order": str(order_id), "checkout": outcome})
        return f"{base}{path}?{query}"

    return _url("success"), _url("cancelled")


def assert_listing_is_upgradable(*, user, listing) -> None:
    """Spec §23.2: "Media upgrade requires a private listing owned by the user
    and not already upgraded"."""
    if listing is None:
        raise ListingNotUpgradable()
    if listing.seller_type != SellerType.PRIVATE or listing.owner_user_id != user.pk:
        raise ListingNotUpgradable()
    if listing.status not in UPGRADABLE_LISTING_STATES:
        raise ListingNotUpgradable()
    already = (
        UserEntitlement.objects.filter(
            listing=listing, entitlement_type=EntitlementType.MEDIA_UPGRADE
        )
        .exclude(state=EntitlementState.REVOKED)
        .exists()
    )
    if already:
        raise ListingNotUpgradable()


def _resolve_listing(*, user, product_code, listing_id):
    """The listing this order binds to, or None.

    A missing listing and another user's listing raise the SAME error, so the
    endpoint cannot be used to test whether a listing id exists (spec §33.1's
    IDOR rule).
    """
    binds = product_code in LISTING_BOUND_PRODUCTS
    if not binds:
        if listing_id:
            # A listing right is consumed at submit (spec §6.3), never bound at
            # purchase. Accepting an id would create a binding nothing honours.
            raise ListingNotUpgradable()
        return None
    if not listing_id:
        raise ListingRequiredForProduct()

    listing = BoatListing.objects.filter(pk=listing_id).first()
    assert_listing_is_upgradable(user=user, listing=listing)
    return listing


def _request_fingerprint(product_code, listing, return_url) -> str:
    listing_part = "" if listing is None else str(listing.pk)
    return f"{product_code}|{listing_part}|{return_url or DEFAULT_RETURN_URL}"


@dataclass(frozen=True)
class CheckoutResult:
    order: PaymentOrder
    checkout_url: str
    created: bool


def create_checkout_session(
    *,
    user,
    product_code: str,
    listing_id=None,
    return_url: str | None = None,
    client_idempotency_key: str,
    request_id: str | None = None,
    gateway=None,
) -> CheckoutResult:
    if not (client_idempotency_key or "").strip():
        raise IdempotencyKeyRequired()
    client_idempotency_key = client_idempotency_key.strip()
    gateway = gateway or default_gateway()

    product = get_purchasable_product(product_code)
    require_reconciled_price(product, gateway=gateway)
    listing = _resolve_listing(
        user=user, product_code=product.code, listing_id=listing_id
    )
    fingerprint = _request_fingerprint(product.code, listing, return_url)
    # Validate the return URL before writing anything, so a hostile one leaves
    # no order behind.
    build_return_urls("probe", return_url)

    existing = PaymentOrder.objects.filter(
        user=user, client_idempotency_key=client_idempotency_key
    ).first()
    if existing is not None:
        return _replay(existing, fingerprint, return_url, gateway, request_id)

    try:
        with transaction.atomic():
            order = PaymentOrder(
                user=user,
                product=product,
                listing=listing,
                status=PaymentOrderStatus.CREATED,
                amount=product.display_amount,
                currency=product.currency.upper(),
                client_idempotency_key=client_idempotency_key,
                metadata={
                    "request_fingerprint": fingerprint,
                    "return_url": return_url or DEFAULT_RETURN_URL,
                },
            )
            # Spec §23.2: "an idempotency key derived from order UUID and
            # operation". `order.pk` is populated by UUIDModel's default before
            # the INSERT, so it is available here.
            order.idempotency_key = f"checkout:{order.pk}"
            order.save()
            record_audit_event(
                actor_user=user,
                actor_type=AuditEvent.ActorType.USER,
                action="payment_order.created",
                target_type="payments.PaymentOrder",
                target_id=str(order.pk),
                source=AuditEvent.Source.API,
                after={"status": order.status, "amount": str(order.amount),
                       "currency": order.currency},
                request_id=request_id,
                metadata={"product_code": product.code},
            )
    except IntegrityError:
        # Two concurrent requests with the same key: the loser re-reads the
        # winner's row rather than opening a second Stripe session.
        existing = PaymentOrder.objects.get(
            user=user, client_idempotency_key=client_idempotency_key
        )
        return _replay(existing, fingerprint, return_url, gateway, request_id)

    url = _open_stripe_session(order, return_url, gateway, request_id)
    return CheckoutResult(order=order, checkout_url=url, created=True)


def _replay(order, fingerprint, return_url, gateway, request_id) -> CheckoutResult:
    """Spec §30.3's safe replay."""
    if order.metadata.get("request_fingerprint") != fingerprint:
        raise IdempotencyKeyReused()
    if order.status == PaymentOrderStatus.CREATED:
        # The first attempt never got a session (Stripe was unreachable). Retry
        # with the SAME deterministic key, so a session Stripe did in fact
        # create is returned rather than duplicated.
        url = _open_stripe_session(order, return_url, gateway, request_id)
        return CheckoutResult(order=order, checkout_url=url, created=False)
    return CheckoutResult(
        order=order,
        checkout_url=order.metadata.get("checkout_url", ""),
        created=False,
    )


def _open_stripe_session(order, return_url, gateway, request_id) -> str:
    success_url, cancel_url = build_return_urls(order.pk, return_url)
    params = {
        "mode": "payment",
        # Spec §23.2: "Server loads Stripe Price; client cannot submit
        # amount/currency." The price id IS the amount; no number is sent.
        "line_items": [{"price": order.product.stripe_price_id, "quantity": 1}],
        "success_url": success_url,
        "cancel_url": cancel_url,
        "client_reference_id": str(order.pk),
        # Spec §23.2: "Store internal order/user/product identifiers in Stripe
        # metadata, not personal message content." No email, no name, no listing
        # title. `customer_email` is deliberately NOT set: Stripe collects it
        # itself on its own hosted page, so pre-filling it would export a
        # personal identifier we do not need to export (spec §33.2).
        "metadata": {
            "order_id": str(order.pk),
            "user_id": str(order.user_id),
            "product_code": order.product.code,
            "listing_id": "" if order.listing_id is None else str(order.listing_id),
        },
    }
    try:
        result = gateway.create_checkout_session(
            params=params, idempotency_key=order.idempotency_key
        )
    except StripeUnavailable as exc:
        # The order stays CREATED and is retriable with the same client key.
        raise PaymentGatewayUnavailable() from exc

    with transaction.atomic():
        locked = PaymentOrder.objects.select_for_update().get(pk=order.pk)
        before = {"status": locked.status}
        locked.status = PaymentOrderStatus.CHECKOUT_OPEN
        locked.stripe_checkout_session_id = result.session_id
        locked.metadata = {**locked.metadata, "checkout_url": result.url}
        locked.save(
            update_fields=[
                "status",
                "stripe_checkout_session_id",
                "metadata",
                "updated_at",
            ]
        )
        record_audit_event(
            actor_user=locked.user,
            actor_type=AuditEvent.ActorType.USER,
            action="payment_order.checkout_opened",
            target_type="payments.PaymentOrder",
            target_id=str(locked.pk),
            source=AuditEvent.Source.API,
            before=before,
            after={"status": locked.status,
                   "stripe_checkout_session_id": result.session_id},
            request_id=request_id,
        )
    order.refresh_from_db()
    return result.url
```

- [ ] **Step 5: Run the tests and confirm they pass**

```bash
cd backend && uv run pytest payments/tests/test_checkout.py -q
cd backend && uv run pytest -q
```

- [ ] **Step 6: Mutation check**

1. Change the allowlist check to `any(path.startswith(entry) for entry in RETURN_URL_ALLOWLIST)` → `test_every_non_allowlisted_return_url_is_refused` must fail on `/dashboard/private-seller/listings/extra/`.
2. Delete `if listing.owner_user_id != user.pk` from `assert_listing_is_upgradable` → `test_a_user_cannot_buy_a_media_upgrade_for_someone_elses_listing` must fail.
3. Remove the `.exclude(state=EntitlementState.REVOKED)` → `test_a_revoked_upgrade_does_not_block_a_new_purchase` must fail.
4. Add `"customer_email": order.user.email` to `params` → `test_stripe_metadata_carries_internal_ids_and_no_personal_data` must fail.
5. Replace `line_items` with `price_data` quoting `unit_amount` → `test_the_amount_sent_to_stripe_is_a_price_id_not_a_number` must fail.
6. Make `idempotency_key` a fresh `uuid4()` per attempt → `test_a_stripe_failure_leaves_a_retriable_created_order` must fail.
7. Delete the `_replay` fingerprint comparison → `test_reusing_an_idempotency_key_for_a_different_request_is_refused` must fail.

Revert each.

- [ ] **Step 7: Commit**

```bash
git add backend/payments
git commit -m "feat(payments): return-URL allowlist, idempotent Checkout Session creation and the payment signals (Phase 14 Task 7)"
```

---

### Task 8: `POST /api/v1/checkout-sessions/` and `GET /api/v1/payment-orders/<id>/`

**Files:**
- Create: `backend/payments/permissions.py`, `backend/payments/serializers.py`, `backend/payments/views.py`, `backend/payments/urls.py`
- Modify: `backend/config/urls.py` (one appended `include`), `backend/config/settings/base.py` (one appended throttle rate)
- Test: `backend/payments/tests/test_checkout_api.py`

**Interfaces:**
- Consumes: `payments.checkout.create_checkout_session` (Task 7); `payments.errors.IdempotencyKeyRequired` (Task 5); `payments.models.PaymentOrder` (Task 3); `payments.enums.{ProductCode, STRIPE_CHECKOUT_FLAG}` (Task 1); `accounts.permissions.{IsActiveUser, IsEmailVerified}` (Phase 3, merged); `platform_settings.services.is_feature_enabled`.
- Produces:
  - `payments.permissions.StripeCheckoutEnabled` — `message`/`code` = `feature_disabled`
  - `payments.serializers.CheckoutSessionRequestSerializer` — fields `product_code` (choice, required), `listing_id` (UUID, optional, nullable), `return_url` (char, optional, nullable)
  - `payments.serializers.PaymentOrderSerializer` — `id`, `status`, `product_code`, `listing_id`, `amount` (string), `currency`, `entitlement_id`, `created_at`, `paid_at`, `fulfilled_at`
  - `payments.serializers.CheckoutSessionResponseSerializer` — `checkout_url`, `order`
  - `payments.views.{CheckoutSessionCreateView, PaymentOrderDetailView}`
  - `payments.urls.urlpatterns` — `checkout-sessions/`, `payment-orders/<uuid:order_id>/`
  - New throttle scope `checkout_create` = `10/min`

> **Note (ruling — permission ORDER, pinned by tests).** `permission_classes = [IsActiveUser, IsEmailVerified, StripeCheckoutEnabled]`. DRF stops at the **first** failing permission, so this order decides which code a caller sees: an anonymous stranger gets `authentication_required` (not an enumeration of our rollout state), an authenticated but unverified user gets `email_not_verified` (spec §12 item 3 requires verified email for Checkout creation), and only a fully-qualified caller learns the feature is off. This deliberately differs from Phase 6's rule 11a (flag first on messaging views) and Task 8 pins all three outcomes with named tests so a reviewer reordering the list breaks a test rather than a property.

> **Note (ruling — the poll endpoint returns the order, never a grant.)** Spec §23.3: "The success page polls/read-fetches order status … It must never grant the right itself." `PaymentOrderDetailView` is `GET`-only, has no `post`/`patch` handler, is scoped to `PaymentOrder.objects.for_user(request.user)` (so an id belonging to someone else is a 404, not a 403 — a 403 would confirm the id exists), and imports nothing from `payments.fulfillment`. Task 8's test asserts all four.

- [ ] **Step 1: Write the failing test**

`backend/payments/tests/test_checkout_api.py`:

```python
"""Spec §30.1's two customer-facing payment endpoints."""

from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from entitlements.enums import EntitlementType
from entitlements.tests.factories import make_entitlement
from payments.enums import PaymentOrderStatus, ProductCode
from payments.models import PaymentOrder
from payments.tests.factories import (
    listing_right_product,
    make_order,
    make_payments_seller,
)
from payments.tests.fakes import FakeStripeGateway

CHECKOUT_URL = "/api/v1/checkout-sessions/"


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def seller(db):
    return make_payments_seller()


@pytest.fixture
def patched_gateway(monkeypatch):
    """Point the VIEW's default gateway at a fake.

    The view calls create_checkout_session without a `gateway=`, exactly as
    production does, so patching `payments.checkout.default_gateway` is what
    keeps the test on the real code path while still staying off the network.
    """
    gateway = FakeStripeGateway()
    monkeypatch.setattr("payments.checkout.default_gateway", lambda: gateway)
    return gateway


def post_checkout(client, body, *, key="idem-1"):
    return client.post(
        CHECKOUT_URL, body, format="json", HTTP_IDEMPOTENCY_KEY=key
    )


@pytest.mark.django_db
def test_an_anonymous_caller_is_refused_before_the_flag_is_even_read(api_client):
    """Permission ORDER: an unauthenticated stranger must not be able to probe
    our rollout state."""
    response = post_checkout(
        api_client, {"product_code": ProductCode.INDIVIDUAL_LISTING_RIGHT}
    )

    assert response.status_code in (401, 403)
    assert response.data["error"]["code"] != "feature_disabled"


@pytest.mark.django_db
def test_an_unverified_user_is_refused_with_email_not_verified(
    api_client, checkout_enabled
):
    """Spec §12 item 3: "Require verified email for ... Checkout creation"."""
    user = make_user("p14-unverified@example.com", role=UserRole.PRIVATE_SELLER,
                     verified=False)
    api_client.force_authenticate(user=user)

    response = post_checkout(
        api_client, {"product_code": ProductCode.INDIVIDUAL_LISTING_RIGHT}
    )

    assert response.status_code == 403
    assert response.data["error"]["code"] == "email_not_verified"


@pytest.mark.django_db
def test_with_the_flag_off_a_verified_seller_gets_feature_disabled(
    api_client, seller
):
    """Spec §35.1: the flag gates backend mutation, not only the UI."""
    listing_right_product()
    api_client.force_authenticate(user=seller)

    response = post_checkout(
        api_client, {"product_code": ProductCode.INDIVIDUAL_LISTING_RIGHT}
    )

    assert response.status_code == 403
    assert response.data["error"]["code"] == "feature_disabled"
    assert PaymentOrder.objects.count() == 0


@pytest.mark.django_db
def test_a_missing_idempotency_key_is_refused(api_client, seller, checkout_enabled):
    """Spec §30.3: "Require Idempotency-Key for Checkout creation"."""
    listing_right_product()
    api_client.force_authenticate(user=seller)

    response = api_client.post(
        CHECKOUT_URL,
        {"product_code": ProductCode.INDIVIDUAL_LISTING_RIGHT},
        format="json",
    )

    assert response.status_code == 400
    assert response.data["error"]["code"] == "idempotency_key_required"


@pytest.mark.django_db
def test_a_successful_request_returns_201_with_the_stripe_url(
    api_client, seller, checkout_enabled, patched_gateway
):
    listing_right_product()
    api_client.force_authenticate(user=seller)

    response = post_checkout(
        api_client,
        {
            "product_code": ProductCode.INDIVIDUAL_LISTING_RIGHT,
            "listing_id": None,
            "return_url": "/dashboard/private-seller/listings/",
        },
    )

    assert response.status_code == 201
    assert response.data["checkout_url"] == patched_gateway.url
    order = response.data["order"]
    assert order["status"] == PaymentOrderStatus.CHECKOUT_OPEN
    assert order["product_code"] == ProductCode.INDIVIDUAL_LISTING_RIGHT
    # Spec §30.2: money is a decimal STRING, not a float.
    assert order["amount"] == "49.00"
    assert isinstance(order["amount"], str)
    assert order["entitlement_id"] is None


@pytest.mark.django_db
def test_the_client_cannot_submit_an_amount_or_a_price(
    api_client, seller, checkout_enabled, patched_gateway
):
    """Spec §23.2: "Server loads Stripe Price; client cannot submit
    amount/currency." Unknown keys must be ignored, never honoured."""
    listing_right_product()
    api_client.force_authenticate(user=seller)

    response = post_checkout(
        api_client,
        {
            "product_code": ProductCode.INDIVIDUAL_LISTING_RIGHT,
            "amount": "0.01",
            "currency": "USD",
            "price_id": "price_attacker",
            "quantity": 99,
        },
    )

    assert response.status_code == 201
    order = PaymentOrder.objects.get()
    assert order.amount == Decimal("49.00")
    assert order.currency == "EUR"
    assert patched_gateway.created[0]["params"]["line_items"] == [
        {"price": "price_test_listing_right", "quantity": 1}
    ]


@pytest.mark.django_db
def test_a_hostile_return_url_is_refused_with_its_own_code(
    api_client, seller, checkout_enabled, patched_gateway
):
    listing_right_product()
    api_client.force_authenticate(user=seller)

    response = post_checkout(
        api_client,
        {
            "product_code": ProductCode.INDIVIDUAL_LISTING_RIGHT,
            "return_url": "https://evil.example/harvest",
        },
    )

    assert response.status_code == 400
    assert response.data["error"]["code"] == "invalid_return_url"
    assert PaymentOrder.objects.count() == 0
    assert patched_gateway.created == []


@pytest.mark.django_db
def test_an_unknown_product_code_is_a_validation_error_not_a_500(
    api_client, seller, checkout_enabled
):
    api_client.force_authenticate(user=seller)

    response = post_checkout(api_client, {"product_code": "SUBSCRIPTION"})

    assert response.status_code == 400
    assert response.data["error"]["code"] == "validation_error"
    assert "product_code" in response.data["error"]["fields"]


@pytest.mark.django_db
def test_replaying_the_same_key_returns_200_and_the_same_order(
    api_client, seller, checkout_enabled, patched_gateway
):
    listing_right_product()
    api_client.force_authenticate(user=seller)
    body = {"product_code": ProductCode.INDIVIDUAL_LISTING_RIGHT}

    first = post_checkout(api_client, body)
    second = post_checkout(api_client, body)

    assert (first.status_code, second.status_code) == (201, 200)
    assert first.data["order"]["id"] == second.data["order"]["id"]
    assert PaymentOrder.objects.count() == 1
    assert len(patched_gateway.created) == 1


@pytest.mark.django_db
def test_the_error_envelope_carries_a_request_id(
    api_client, seller, checkout_enabled
):
    """Spec §30.2: "Include/request X-Request-ID; echo it in error responses"."""
    api_client.force_authenticate(user=seller)

    response = post_checkout(
        api_client, {"product_code": ProductCode.INDIVIDUAL_LISTING_RIGHT}
    )

    assert response.status_code == 409  # product is still inactive
    assert response.data["error"]["code"] == "product_not_available"
    assert response.data["error"]["request_id"]
    assert response["X-Request-ID"]


@pytest.mark.django_db
def test_the_checkout_view_declares_only_a_throttle_scope(api_client):
    """Phase 3 contract rule 9: views declare `throttle_scope`, never
    `throttle_classes` — the project's HashedIPScopedRateThrottle is installed
    globally precisely so no view can opt into a raw DRF throttle that would put
    a plaintext IP in a Redis key (spec §30.4)."""
    from payments.views import CheckoutSessionCreateView

    assert CheckoutSessionCreateView.throttle_scope == "checkout_create"
    assert "throttle_classes" not in CheckoutSessionCreateView.__dict__


@pytest.mark.django_db
def test_an_owner_can_poll_their_own_order(api_client, seller):
    order = make_order(user=seller, product=listing_right_product())
    api_client.force_authenticate(user=seller)

    response = api_client.get(f"/api/v1/payment-orders/{order.pk}/")

    assert response.status_code == 200
    assert response.data["id"] == str(order.pk)
    assert response.data["status"] == PaymentOrderStatus.CREATED


@pytest.mark.django_db
def test_a_stranger_polling_someone_elses_order_gets_404_not_403(api_client):
    """A 403 would confirm the id exists. Spec §33.1's IDOR rule."""
    owner = make_payments_seller("p14-poll-owner@example.com")
    stranger = make_payments_seller("p14-poll-stranger@example.com")
    order = make_order(user=owner, product=listing_right_product())
    api_client.force_authenticate(user=stranger)

    response = api_client.get(f"/api/v1/payment-orders/{order.pk}/")

    assert response.status_code == 404


@pytest.mark.django_db
def test_polling_grants_nothing(api_client, seller):
    """Spec §23.3: the success page "must never grant the right itself"."""
    import inspect

    from payments import views

    order = make_order(
        user=seller,
        product=listing_right_product(),
        status=PaymentOrderStatus.PAID,
    )
    api_client.force_authenticate(user=seller)

    before = list(seller.entitlements.values_list("pk", flat=True))
    response = api_client.get(f"/api/v1/payment-orders/{order.pk}/")
    after = list(seller.entitlements.values_list("pk", flat=True))

    assert response.status_code == 200
    assert response.data["status"] == PaymentOrderStatus.PAID
    assert response.data["entitlement_id"] is None
    assert before == after
    # Structural, not just behavioural: the poll view has no write handler and
    # the module does not even import the fulfilment path.
    assert views.PaymentOrderDetailView.http_method_names == ["get", "options"]
    assert "fulfillment" not in inspect.getsource(views)


@pytest.mark.django_db
def test_a_fulfilled_order_exposes_its_entitlement_id(api_client, seller):
    right = make_entitlement(user=seller, entitlement_type=EntitlementType.PAID_LISTING)
    order = make_order(
        user=seller,
        product=listing_right_product(),
        status=PaymentOrderStatus.FULFILLED,
        fulfilled_entitlement=right,
    )
    api_client.force_authenticate(user=seller)

    response = api_client.get(f"/api/v1/payment-orders/{order.pk}/")

    assert response.data["entitlement_id"] == str(right.pk)


@pytest.mark.django_db
def test_an_anonymous_caller_cannot_poll(api_client, seller):
    order = make_order(user=seller, product=listing_right_product())

    response = api_client.get(f"/api/v1/payment-orders/{order.pk}/")

    assert response.status_code in (401, 403)
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
cd backend && uv run pytest payments/tests/test_checkout_api.py -q
```

Expected: 404s everywhere — the routes do not exist yet.

- [ ] **Step 3: Write the permission, serializers, views and urls**

`backend/payments/permissions.py`:

```python
from rest_framework.permissions import BasePermission

from platform_settings.services import is_feature_enabled

from .enums import STRIPE_CHECKOUT_FLAG


class StripeCheckoutEnabled(BasePermission):
    """Spec §35.1: `stripe_entitlement_checkout` gates backend mutation, not
    just UI.

    Deliberately NOT applied to the webhook: turning the flag off between a
    customer paying and Stripe delivering would strand a real payment with no
    entitlement — exactly the paid-not-fulfilled state spec §35.4 tells us to
    monitor for. The flag stops NEW purchases; in-flight ones still land.
    """

    message = "This feature is not enabled yet."
    code = "feature_disabled"

    def has_permission(self, request, view):
        return is_feature_enabled(STRIPE_CHECKOUT_FLAG, default=False)
```

`backend/payments/serializers.py`:

```python
from rest_framework import serializers

from .enums import ProductCode
from .models import PaymentOrder


class CheckoutSessionRequestSerializer(serializers.Serializer):
    """Spec §23.2's request body — and nothing else.

    A plain Serializer with exactly three declared fields: DRF ignores unknown
    keys, so `amount`, `currency`, `price_id` and `quantity` sent by a client
    are silently dropped rather than honoured. That is spec §2.2's server
    authority and §23.2's "client cannot submit amount/currency".
    """

    product_code = serializers.ChoiceField(choices=ProductCode.choices)
    listing_id = serializers.UUIDField(required=False, allow_null=True)
    return_url = serializers.CharField(
        required=False, allow_null=True, allow_blank=True, max_length=200
    )


class PaymentOrderSerializer(serializers.ModelSerializer):
    """Spec §30.1's "poll fulfillment state" payload.

    Carries no Stripe session id, no payment intent id and no Stripe URL: the
    client already has the URL it was handed, and echoing Stripe identifiers
    back to a browser widens the blast radius of an XSS for no product benefit.
    """

    product_code = serializers.CharField(source="product.code", read_only=True)
    # Spec §30.2: "JSON uses decimal strings for money".
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, coerce_to_string=True)
    entitlement_id = serializers.PrimaryKeyRelatedField(
        source="fulfilled_entitlement", read_only=True
    )

    class Meta:
        model = PaymentOrder
        fields = (
            "id",
            "status",
            "product_code",
            "listing_id",
            "amount",
            "currency",
            "entitlement_id",
            "created_at",
            "paid_at",
            "fulfilled_at",
        )
        read_only_fields = fields
```

`backend/payments/views.py`:

```python
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsActiveUser, IsEmailVerified

from .checkout import create_checkout_session
from .errors import IdempotencyKeyRequired
from .models import PaymentOrder
from .permissions import StripeCheckoutEnabled
from .serializers import CheckoutSessionRequestSerializer, PaymentOrderSerializer


class CheckoutSessionCreateView(APIView):
    """POST /api/v1/checkout-sessions/ (spec §30.1, §23.2).

    Permission ORDER is load-bearing and is pinned by tests. DRF stops at the
    first failing permission, so authentication comes first (an anonymous caller
    must not be able to probe our rollout state), verified email second (spec
    §12 item 3) and the feature flag last.
    """

    permission_classes = [IsActiveUser, IsEmailVerified, StripeCheckoutEnabled]
    # Spec §30.4 lists "Checkout creation" among the rate-limited surfaces.
    # Scope only — never throttle_classes (Phase 3 contract rule 9).
    throttle_scope = "checkout_create"

    def post(self, request):
        envelope = CheckoutSessionRequestSerializer(data=request.data)
        envelope.is_valid(raise_exception=True)
        key = request.headers.get("Idempotency-Key", "")
        if not key.strip():
            raise IdempotencyKeyRequired()

        result = create_checkout_session(
            user=request.user,
            product_code=envelope.validated_data["product_code"],
            listing_id=envelope.validated_data.get("listing_id"),
            return_url=envelope.validated_data.get("return_url"),
            client_idempotency_key=key,
            request_id=getattr(request, "request_id", None),
        )
        return Response(
            {
                "checkout_url": result.checkout_url,
                "order": PaymentOrderSerializer(result.order).data,
            },
            status=status.HTTP_201_CREATED if result.created else status.HTTP_200_OK,
        )


class PaymentOrderDetailView(APIView):
    """GET /api/v1/payment-orders/<id>/ (spec §30.1).

    Read-only by construction. Spec §23.3: the success page "polls/read-fetches
    order status ... It must never grant the right itself", so this view has no
    write handler, http_method_names excludes every mutating verb, and this
    module imports nothing from payments.fulfillment.

    Scoped to the caller's own orders, so another user's id is a 404 rather than
    a 403 — a 403 would confirm the id exists (spec §33.1).
    """

    permission_classes = [IsActiveUser]
    http_method_names = ["get", "options"]

    def get(self, request, order_id):
        order = get_object_or_404(
            PaymentOrder.objects.for_user(request.user).select_related(
                "product", "fulfilled_entitlement"
            ),
            pk=order_id,
        )
        return Response(PaymentOrderSerializer(order).data)
```

`backend/payments/urls.py`:

```python
from django.urls import path

from payments.views import CheckoutSessionCreateView, PaymentOrderDetailView

urlpatterns = [
    path(
        "checkout-sessions/",
        CheckoutSessionCreateView.as_view(),
        name="checkout-session-create",
    ),
    path(
        "payment-orders/<uuid:order_id>/",
        PaymentOrderDetailView.as_view(),
        name="payment-order-detail",
    ),
]
```

- [ ] **Step 4: Wire the routes and the throttle rate (two appended one-liners)**

`backend/config/urls.py` — **append** to the existing `urlpatterns` list. Read the real file first; Phases 6, 9 and 10 each add their own `include`.

```python
    path("api/v1/", include("payments.urls")),
]
```

`backend/config/settings/base.py` — **append** to `DEFAULT_THROTTLE_RATES`, after the existing `"finance_quote"` entry:

```python
        # Spec §30.4 lists "Checkout creation" among the rate-limited surfaces.
        # Far tighter than a browsing bucket: a human buys a listing right once
        # in a while, and each accepted request opens a session on a third-party
        # payment provider.
        "checkout_create": "10/min",
    },
```

- [ ] **Step 5: Run the tests and confirm they pass**

```bash
cd backend && uv run pytest payments/tests/test_checkout_api.py -q
cd backend && uv run python manage.py check
cd backend && uv run pytest -q
```

- [ ] **Step 6: Mutation check**

1. Reorder `permission_classes` to put `StripeCheckoutEnabled` first → `test_an_anonymous_caller_is_refused_before_the_flag_is_even_read` must fail.
2. Remove `IsEmailVerified` → `test_an_unverified_user_is_refused_with_email_not_verified` must fail.
3. Change `CheckoutSessionRequestSerializer` to a `ModelSerializer` over `PaymentOrder` with `fields = "__all__"` → `test_the_client_cannot_submit_an_amount_or_a_price` must fail.
4. Change `PaymentOrder.objects.for_user(request.user)` to `PaymentOrder.objects.all()` → `test_a_stranger_polling_someone_elses_order_gets_404_not_403` must fail.
5. Set `coerce_to_string=False` on `amount` → `test_a_successful_request_returns_201_with_the_stripe_url` must fail.
6. Delete `throttle_scope` → `test_the_checkout_view_declares_only_a_throttle_scope` must fail.

Revert each.

- [ ] **Step 7: Commit**

```bash
git add backend/payments backend/config
git commit -m "feat(payments): checkout-sessions and payment-orders endpoints with spec 30.3 idempotency (Phase 14 Task 8)"
```

---

### Task 9: Webhook signature verification, replay rejection and event idempotency

**Files:**
- Create: `backend/payments/webhooks.py`
- Modify: `backend/payments/views.py` (append `StripeWebhookView`), `backend/payments/urls.py` (no change — see below), `backend/config/urls.py` (**two modified lines**), `backend/common/views.py` (**remove** `StripeWebhookView` and `import stripe`), `backend/common/tests/stripe_helpers.py` (append one keyword argument)
- Delete: `backend/common/tests/test_stripe_webhook.py`
- Test: `backend/payments/tests/test_webhook_security.py`

**Interfaces:**
- Consumes: `payments.models.ProcessedWebhookEvent` (Task 3); `payments.enums.{STRIPE_SIGNATURE_TOLERANCE_SECONDS, WebhookResult}` (Task 1); `settings.STRIPE_WEBHOOK_SECRET`; the `stripe` library's `Webhook.construct_event` and `SignatureVerificationError`.
- Produces:
  - `payments.webhooks.InvalidWebhookSignature(Exception)`, `payments.webhooks.InvalidWebhookPayload(Exception)`, `payments.webhooks.DuplicateWebhookEvent(Exception)`
  - `payments.webhooks.verify_stripe_event(*, raw_body: bytes, signature_header: str, secret: str, tolerance: int = STRIPE_SIGNATURE_TOLERANCE_SECONDS) -> stripe.Event`
  - `payments.webhooks.payload_checksum(raw_body: bytes) -> str`
  - `payments.webhooks.HANDLERS: dict[str, Callable]` (empty in this task; filled by Tasks 10 and 11)
  - `payments.webhooks.process_stripe_event(event, *, raw_body: bytes) -> str` — returns a `WebhookResult` value; raises `DuplicateWebhookEvent`
  - `payments.views.StripeWebhookView`

> **Note (ruling — this is the ONE non-append edit to a shared file in this plan.)** `backend/config/urls.py` already routes `path("api/v1/stripe/webhook/", StripeWebhookView.as_view(), name="stripe-webhook")` to the Phase 0/1 stub in `common.views`. The **URL string and the route name do not change**; only the import line and the view reference do. Leaving two webhook endpoints alive would contradict spec §30.1's single entry and would leave a route that verifies a signature and then silently discards the event. Read the real `config/urls.py` before editing — Phases 6, 9 and 10 each add their own `include` line to it.

> **Note (ruling — one transaction, not two.)** The `ProcessedWebhookEvent` insert and the fulfilment share a single `transaction.atomic()`. Two alternatives were considered and rejected: inserting the dedup row in its own committed transaction first leaves a **permanent** replay lock behind when the handler then crashes, so Stripe's retry is treated as a duplicate and the customer's payment is never fulfilled; and skipping the insert until after the handler leaves a window in which two concurrent deliveries both fulfil. With one transaction, a crash rolls the dedup row back so the retry can succeed, and two concurrent deliveries serialize on the unique index — the second blocks until the first commits, then gets `IntegrityError` and answers 200. Catching that `IntegrityError` requires a **nested** `atomic()` around the insert, which is the documented Django pattern; without it the outer transaction would be poisoned and unusable.

> **Note (ruling — the 400 has no body.)** A verbose rejection ("bad timestamp" vs "bad signature") is a signature oracle. `HttpResponse(status=400)` — no envelope, no message, no request id. Stripe reads only the status code.

- [ ] **Step 1: Write the failing test**

Append the one keyword argument to `backend/common/tests/stripe_helpers.py` (every existing call site keeps working):

```python
def generate_stripe_signature(
    payload: bytes, secret: str, *, timestamp: int | None = None
) -> str:
    """Stripe's real scheme: t=<unix>,v1=HMAC-SHA256(f"{t}.{payload}").

    `timestamp` is settable so a test can forge a genuine-but-stale signature
    and prove the tolerance window actually rejects a replay.
    """
    timestamp = int(time.time()) if timestamp is None else timestamp
    signed_payload = f"{timestamp}.{payload.decode()}"
    signature = hmac.new(
        secret.encode(), signed_payload.encode(), hashlib.sha256
    ).hexdigest()
    return f"t={timestamp},v1={signature}"
```

`backend/payments/tests/test_webhook_security.py`:

```python
"""Spec §23.3 steps 1-3 and §33.1's "Verify Stripe signatures from raw body".

These tests deliberately use the REAL stripe library for verification: forging a
signature against Stripe's actual HMAC scheme is the whole point, and a mocked
verifier would prove nothing. No network is involved — construct_event is pure
computation, which is why conftest's `no_network` fixture does not patch it.
"""

import json
import time

import pytest
from rest_framework.test import APIClient

from common.tests.stripe_helpers import generate_stripe_signature
from payments.enums import WebhookResult
from payments.models import ProcessedWebhookEvent
from payments.webhooks import (
    DuplicateWebhookEvent,
    InvalidWebhookPayload,
    InvalidWebhookSignature,
    payload_checksum,
    process_stripe_event,
    verify_stripe_event,
)

WEBHOOK_URL = "/api/v1/stripe/webhook/"
SECRET = "whsec_phase14_test"


def body(**overrides):
    payload = {
        "id": "evt_p14_1",
        "type": "checkout.session.completed",
        "data": {"object": {"id": "cs_test_1"}},
    }
    payload.update(overrides)
    return json.dumps(payload).encode()


@pytest.fixture
def api_client():
    return APIClient()


def post_webhook(client, raw, signature):
    return client.post(
        WEBHOOK_URL,
        data=raw,
        content_type="application/json",
        HTTP_STRIPE_SIGNATURE=signature,
    )


def test_a_valid_signature_verifies(settings):
    raw = body()

    event = verify_stripe_event(
        raw_body=raw,
        signature_header=generate_stripe_signature(raw, SECRET),
        secret=SECRET,
    )

    assert event["id"] == "evt_p14_1"
    assert event["type"] == "checkout.session.completed"


def test_a_forged_signature_is_refused():
    raw = body()

    with pytest.raises(InvalidWebhookSignature):
        verify_stripe_event(
            raw_body=raw, signature_header="t=1,v1=deadbeef", secret=SECRET
        )


def test_a_signature_made_with_the_wrong_secret_is_refused():
    raw = body()

    with pytest.raises(InvalidWebhookSignature):
        verify_stripe_event(
            raw_body=raw,
            signature_header=generate_stripe_signature(raw, "whsec_attacker"),
            secret=SECRET,
        )


def test_a_signature_for_a_different_body_is_refused():
    """The classic substitution attack: a genuine signature lifted from one
    delivery and pasted onto a body the attacker wrote."""
    genuine = generate_stripe_signature(body(), SECRET)
    tampered = body(data={"object": {"id": "cs_attacker"}})

    with pytest.raises(InvalidWebhookSignature):
        verify_stripe_event(
            raw_body=tampered, signature_header=genuine, secret=SECRET
        )


def test_a_genuine_but_stale_signature_is_refused_by_the_tolerance_window():
    """Spec §23.3 step 2 plus Stripe's replay guidance: the signature below is
    cryptographically PERFECT — only its timestamp is old."""
    raw = body()
    stale = generate_stripe_signature(
        raw, SECRET, timestamp=int(time.time()) - 3600
    )

    with pytest.raises(InvalidWebhookSignature):
        verify_stripe_event(raw_body=raw, signature_header=stale, secret=SECRET)


def test_a_signature_just_inside_the_window_is_accepted():
    """The positive half — without it, a tolerance of zero would pass every
    negative test above while rejecting all real traffic."""
    raw = body()
    recent = generate_stripe_signature(raw, SECRET, timestamp=int(time.time()) - 60)

    event = verify_stripe_event(raw_body=raw, signature_header=recent, secret=SECRET)

    assert event["id"] == "evt_p14_1"


def test_an_empty_signature_header_is_refused():
    with pytest.raises(InvalidWebhookSignature):
        verify_stripe_event(raw_body=body(), signature_header="", secret=SECRET)


def test_a_malformed_body_is_a_payload_error_not_a_signature_error():
    raw = b"{not json"

    with pytest.raises(InvalidWebhookPayload):
        verify_stripe_event(
            raw_body=raw,
            signature_header=generate_stripe_signature(raw, SECRET),
            secret=SECRET,
        )


@pytest.mark.django_db
def test_the_endpoint_accepts_a_validly_signed_event(api_client, settings):
    settings.STRIPE_WEBHOOK_SECRET = SECRET
    raw = body()

    response = post_webhook(api_client, raw, generate_stripe_signature(raw, SECRET))

    assert response.status_code == 200
    assert ProcessedWebhookEvent.objects.count() == 1


@pytest.mark.django_db
def test_the_endpoint_refuses_a_forged_signature_with_an_empty_400(
    api_client, settings
):
    """Spec §23's acceptance list: "Forged/invalid signature produces 400 and no
    state change." The empty body is deliberate — a reason string would be a
    signature oracle."""
    settings.STRIPE_WEBHOOK_SECRET = SECRET
    raw = body()

    response = post_webhook(api_client, raw, "t=1,v1=deadbeef")

    assert response.status_code == 400
    assert response.content == b""
    assert ProcessedWebhookEvent.objects.count() == 0


@pytest.mark.django_db
def test_the_endpoint_verifies_the_exact_bytes_django_received(
    api_client, settings
):
    """Spec §33.1: "Verify Stripe signatures from raw body." A view that parsed
    the JSON and re-serialized it would produce different bytes — different key
    order, different unicode escaping, different whitespace — and every genuine
    delivery would fail. This payload is built to break any such view."""
    settings.STRIPE_WEBHOOK_SECRET = SECRET
    raw = (
        b'{\n  "type" : "checkout.session.completed",\n'
        b'  "id":"evt_raw_bytes",\n'
        b'  "data": {"object": {"id": "cs_\\u00e9\\u00e0"}}\n}'
    )

    response = post_webhook(api_client, raw, generate_stripe_signature(raw, SECRET))

    assert response.status_code == 200
    stored = ProcessedWebhookEvent.objects.get()
    assert stored.stripe_event_id == "evt_raw_bytes"
    assert stored.payload_checksum == payload_checksum(raw)


@pytest.mark.django_db
def test_a_duplicate_event_id_returns_200_and_writes_nothing_new(
    api_client, settings
):
    """Spec §23.3 step 3, verbatim: "duplicate event ID returns HTTP 200
    without re-fulfillment"."""
    settings.STRIPE_WEBHOOK_SECRET = SECRET
    raw = body()

    first = post_webhook(api_client, raw, generate_stripe_signature(raw, SECRET))
    second = post_webhook(api_client, raw, generate_stripe_signature(raw, SECRET))

    assert (first.status_code, second.status_code) == (200, 200)
    assert ProcessedWebhookEvent.objects.count() == 1


@pytest.mark.django_db
def test_an_unhandled_event_type_is_recorded_as_ignored(api_client, settings):
    """Stripe delivers whatever the endpoint is subscribed to. An unknown type
    must be a 200 no-op, never a 500 that makes Stripe retry forever."""
    settings.STRIPE_WEBHOOK_SECRET = SECRET
    raw = body(id="evt_unknown", type="customer.subscription.created")

    response = post_webhook(api_client, raw, generate_stripe_signature(raw, SECRET))

    assert response.status_code == 200
    assert ProcessedWebhookEvent.objects.get().result == WebhookResult.IGNORED


@pytest.mark.django_db
def test_a_handler_crash_releases_the_replay_lock(monkeypatch, settings):
    """The critical failure-mode test. If the dedup row survived a crashed
    handler, Stripe's retry would be treated as a duplicate and the customer's
    payment would never be fulfilled."""
    import payments.webhooks as webhooks

    def _boom(event, **kwargs):
        raise RuntimeError("database went away")

    monkeypatch.setitem(webhooks.HANDLERS, "checkout.session.completed", _boom)
    raw = body(id="evt_crash")
    event = verify_stripe_event(
        raw_body=raw,
        signature_header=generate_stripe_signature(raw, SECRET),
        secret=SECRET,
    )

    with pytest.raises(RuntimeError):
        process_stripe_event(event, raw_body=raw)

    assert ProcessedWebhookEvent.objects.filter(stripe_event_id="evt_crash").count() == 0


@pytest.mark.django_db
def test_a_second_call_for_the_same_event_id_raises_duplicate(settings):
    raw = body(id="evt_twice")
    event = verify_stripe_event(
        raw_body=raw,
        signature_header=generate_stripe_signature(raw, SECRET),
        secret=SECRET,
    )

    process_stripe_event(event, raw_body=raw)

    with pytest.raises(DuplicateWebhookEvent):
        process_stripe_event(event, raw_body=raw)


@pytest.mark.django_db
def test_the_webhook_view_is_unauthenticated_ungated_and_unthrottled():
    """Three properties Stripe's retry behaviour depends on:
      * no authentication - Stripe carries no JWT
      * no feature flag - see the plan's ruling; a disabled flag must not
        strand a payment that has already been taken
      * no throttle scope - throttling Stripe's retries would MANUFACTURE the
        paid-not-fulfilled state spec §35.4 tells us to watch for
    """
    from rest_framework.permissions import AllowAny

    from payments.views import StripeWebhookView

    assert StripeWebhookView.authentication_classes == []
    assert StripeWebhookView.permission_classes == [AllowAny]
    assert getattr(StripeWebhookView, "throttle_scope", None) is None
    assert StripeWebhookView.http_method_names == ["post", "options"]


@pytest.mark.django_db
def test_no_secret_reaches_the_response_or_the_stored_row(api_client, settings):
    settings.STRIPE_WEBHOOK_SECRET = SECRET
    raw = body(id="evt_secret_check")

    ok = post_webhook(api_client, raw, generate_stripe_signature(raw, SECRET))
    bad = post_webhook(api_client, raw, "t=1,v1=deadbeef")

    assert SECRET not in ok.content.decode()
    assert SECRET not in bad.content.decode()
    stored = ProcessedWebhookEvent.objects.get(stripe_event_id="evt_secret_check")
    assert SECRET not in str(stored.__dict__)


def test_the_old_common_webhook_view_is_gone():
    """The route moved; leaving a second endpoint alive that verifies a
    signature and then discards the event would be worse than none."""
    import common.views

    assert not hasattr(common.views, "StripeWebhookView")


@pytest.mark.django_db
def test_the_route_name_and_path_are_unchanged():
    """spec §30.1's `POST /api/v1/stripe/webhook/`. Changing it would mean
    reconfiguring every Stripe environment."""
    from django.urls import reverse

    assert reverse("stripe-webhook") == WEBHOOK_URL
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
cd backend && uv run pytest payments/tests/test_webhook_security.py -q
```

Expected: `ModuleNotFoundError: No module named 'payments.webhooks'`.

- [ ] **Step 3: Write the webhook module**

`backend/payments/webhooks.py`:

```python
"""Webhook intake: signature, replay, deduplication and dispatch
(spec §23.3 steps 1-3, §33.1, §41's Stripe webhooks reference).

This module handles UNTRUSTED input and contains no business rules. It never
logs the raw body, the signature header or the webhook secret, and it never
returns a reason to the caller — a verbose 400 is a signature oracle.
"""

import hashlib

import stripe
from django.db import IntegrityError, transaction

from .enums import STRIPE_SIGNATURE_TOLERANCE_SECONDS, WebhookResult
from .models import ProcessedWebhookEvent


class InvalidWebhookSignature(Exception):
    """The signature, its timestamp, or the secret did not check out."""


class InvalidWebhookPayload(Exception):
    """The body was not parseable JSON."""


class DuplicateWebhookEvent(Exception):
    """This stripe_event_id has already been processed (spec §23.3 step 3)."""


def payload_checksum(raw_body: bytes) -> str:
    """SHA-256 of the raw body.

    Stored so an operator can prove two deliveries carried identical bytes. It
    is never used to make a decision — `stripe_event_id` already is the
    decision — and deliberately holds no part of the body itself.
    """
    return hashlib.sha256(raw_body).hexdigest()


def verify_stripe_event(
    *,
    raw_body: bytes,
    signature_header: str,
    secret: str,
    tolerance: int = STRIPE_SIGNATURE_TOLERANCE_SECONDS,
):
    """Spec §23.3 steps 1-2 and §33.1.

    `stripe.Webhook.construct_event` is the library's own implementation of
    Stripe's documented scheme (`t=<unix>,v1=HMAC-SHA256(f"{t}.{payload}")`,
    compared in constant time) and it also enforces the replay window: a
    signature whose `t=` is further from now than `tolerance` is rejected even
    when the HMAC is perfect. `tolerance` is passed explicitly rather than left
    to the library default so a change to it is a visible diff.

    `stripe.SignatureVerificationError` is the modern top-level name.
    `stripe.error.SignatureVerificationError` still resolves in 15.x through a
    deprecated module alias, and the Phase 0/1 stub used it; do not copy that.

    No exception message from this function names the secret, the header or the
    body, and the caller turns every failure into a bodyless 400.
    """
    try:
        return stripe.Webhook.construct_event(
            raw_body, signature_header, secret, tolerance=tolerance
        )
    except ValueError as exc:
        raise InvalidWebhookPayload("Unparseable webhook body.") from exc
    except stripe.SignatureVerificationError as exc:
        raise InvalidWebhookSignature("Webhook signature verification failed.") from exc


# Filled by Tasks 10 and 11. Keyed by Stripe event type; each handler takes the
# verified event and returns a WebhookResult value. A type absent from this map
# is recorded as IGNORED and answered 200 — Stripe delivers whatever the
# endpoint is subscribed to, and a 500 on an unknown type would make it retry
# that event for days.
HANDLERS: dict = {}


def process_stripe_event(event, *, raw_body: bytes) -> str:
    """Spec §23.3 step 3 onwards, in ONE transaction.

    The dedup row and the handler's writes share a single atomic block, which
    gives three properties at once:

      * a duplicate delivery raises DuplicateWebhookEvent having written
        nothing, and the caller answers 200 (spec §23.3 step 3);
      * two CONCURRENT deliveries serialize on the unique index — the second
        blocks until the first commits, then fails the insert;
      * a crashed handler rolls the dedup row back with everything else, so
        Stripe's retry can still fulfil. Inserting the row in its own committed
        transaction first would leave a PERMANENT replay lock behind and the
        customer would never receive what they paid for.

    The inner atomic() around the insert is required, not stylistic: an
    IntegrityError poisons the transaction it occurs in, so without a savepoint
    the outer block would be unusable after catching it.
    """
    event_id = event["id"]
    event_type = event["type"]

    with transaction.atomic():
        try:
            with transaction.atomic():
                row = ProcessedWebhookEvent.objects.create(
                    stripe_event_id=event_id,
                    event_type=event_type,
                    payload_checksum=payload_checksum(raw_body),
                    result=WebhookResult.RECEIVED,
                )
        except IntegrityError as exc:
            raise DuplicateWebhookEvent(event_id) from exc

        handler = HANDLERS.get(event_type)
        result = WebhookResult.IGNORED if handler is None else handler(event)

        row.result = result
        row.save(update_fields=["result"])

    return result
```

- [ ] **Step 4: Append the view, and move the route**

Append to `backend/payments/views.py` (consolidate the new imports into the module's import block):

```python
from django.conf import settings
from django.http import HttpResponse
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework.permissions import AllowAny

from .webhooks import (
    DuplicateWebhookEvent,
    InvalidWebhookPayload,
    InvalidWebhookSignature,
    process_stripe_event,
    verify_stripe_event,
)


@method_decorator(csrf_exempt, name="dispatch")
class StripeWebhookView(APIView):
    """POST /api/v1/stripe/webhook/ (spec §30.1, §23.3).

    Unauthenticated (Stripe carries no JWT), unthrottled (throttling Stripe's
    retries would manufacture the paid-not-fulfilled state spec §35.4 tells us
    to watch for) and deliberately NOT gated by the
    `stripe_entitlement_checkout` flag — see the plan's ruling: turning the flag
    off between a customer paying and Stripe delivering must not strand a real
    payment.

    `request.body` is read BEFORE anything touches `request.data`: DRF's parsers
    consume the stream, and spec §33.1 requires verification against the raw
    bytes Django received. Never introduce a `request.data` access above this.
    """

    authentication_classes = []
    permission_classes = [AllowAny]
    http_method_names = ["post", "options"]

    def post(self, request):
        raw_body = request.body
        signature = request.META.get("HTTP_STRIPE_SIGNATURE", "")
        try:
            event = verify_stripe_event(
                raw_body=raw_body,
                signature_header=signature,
                secret=settings.STRIPE_WEBHOOK_SECRET,
            )
        except (InvalidWebhookSignature, InvalidWebhookPayload):
            # No body: distinguishing "bad timestamp" from "bad signature" would
            # be a signature oracle, and Stripe reads only the status code.
            return HttpResponse(status=400)

        try:
            process_stripe_event(event, raw_body=raw_body)
        except DuplicateWebhookEvent:
            # Spec §23.3 step 3: "duplicate event ID returns HTTP 200 without
            # re-fulfillment".
            return HttpResponse(status=200)
        # Any other exception propagates to a 500 on purpose, so Stripe retries.
        return HttpResponse(status=200)
```

In `backend/config/urls.py`, change exactly two lines. Read the real file first.

```python
from common.views import HealthCheckView
...
from payments.views import StripeWebhookView
```

and leave the route itself byte-identical:

```python
    path("api/v1/stripe/webhook/", StripeWebhookView.as_view(), name="stripe-webhook"),
```

In `backend/common/views.py`, delete the whole `StripeWebhookView` class, the `import stripe` line and any import that becomes unused (`HttpResponse`, `method_decorator`, `csrf_exempt`, `settings` — check each against `HealthCheckView`, which still needs `cache`, `connection`, `Response`, `APIView` and `AllowAny`).

Delete `backend/common/tests/test_stripe_webhook.py`; both of its assertions now live in `payments/tests/test_webhook_security.py` as `test_the_endpoint_accepts_a_validly_signed_event` and `test_the_endpoint_refuses_a_forged_signature_with_an_empty_400`.

- [ ] **Step 5: Run the tests and confirm they pass**

```bash
cd backend && uv run pytest payments/tests/test_webhook_security.py -q
cd backend && uv run python manage.py check
cd backend && uv run pytest -q
```

Note: `manage.py check` is what catches an import left dangling in `common/views.py`.

- [ ] **Step 6: Mutation check**

1. Change `verify_stripe_event` to `construct_event(json.loads(raw_body), ...)` → `test_the_endpoint_verifies_the_exact_bytes_django_received` must fail.
2. Pass `tolerance=10**9` → `test_a_genuine_but_stale_signature_is_refused_by_the_tolerance_window` must fail.
3. Pass `tolerance=0` → `test_a_signature_just_inside_the_window_is_accepted` must fail (this is the pair that proves the window is a *window*).
4. Move the `ProcessedWebhookEvent.objects.create(...)` into its own `transaction.atomic()` that commits before the handler runs → `test_a_handler_crash_releases_the_replay_lock` must fail.
5. Return `HttpResponse(status=400, content=str(exc))` → `test_the_endpoint_refuses_a_forged_signature_with_an_empty_400` must fail.
6. Add `throttle_scope = "checkout_create"` to the webhook view → `test_the_webhook_view_is_unauthenticated_ungated_and_unthrottled` must fail.
7. Add `request.data` access above `raw_body = request.body` → `test_the_endpoint_verifies_the_exact_bytes_django_received` must fail (or error), which is why the ordering comment is in the code.

Revert each.

- [ ] **Step 7: Commit**

```bash
git add backend/payments backend/common backend/config
git rm backend/common/tests/test_stripe_webhook.py
git commit -m "feat(payments): raw-body signature verification, replay rejection and event idempotency (Phase 14 Task 9)"
```

---

### Task 10: Fulfillment — lock, verify, and create exactly one entitlement

**Files:**
- Create: `backend/payments/fulfillment.py`
- Modify: `backend/payments/webhooks.py` (one appended import line registering the handlers)
- Test: `backend/payments/tests/test_fulfillment.py`

**Interfaces:**
- Consumes: `payments.models.{PaymentOrder, MarketplaceProduct}` (Tasks 2–3); `payments.enums.{PaymentOrderStatus, PRODUCT_ENTITLEMENT_TYPES, WebhookResult, can_transition_payment}` (Task 1); `payments.products.minor_units` (Task 6); `payments.signals.{payment_fulfilled, payment_needs_staff_review}` (Task 7); `entitlements.models.UserEntitlement` and `entitlements.enums.{EntitlementSource, EntitlementState, EntitlementType}` (Phase 13 Tasks 1–2, **merged**); `audit.services.record_audit_event`.
- Produces:
  - `payments.fulfillment.grant_purchased_entitlement(*, order, now) -> UserEntitlement`
  - `payments.fulfillment.verify_session_against_order(*, order, session) -> str` — returns `""` when everything matches, else a short machine reason
  - `payments.fulfillment.fulfil_paid_session(*, order, session, now=None) -> str` (a `WebhookResult` value)
  - `payments.fulfillment.handle_checkout_session_paid(event) -> str`
  - `payments.fulfillment.handle_checkout_session_failed(event) -> str`
  - `payments.fulfillment.handle_checkout_session_expired(event) -> str`
  - Four entries appended to `payments.webhooks.HANDLERS`

> **Note (ruling — the purchased right's validity comes from the PRODUCT's `entitlement_valid_days`, not from `individual.paid_entitlement_valid_days`.)** This is a deliberate, named deviation from the wording of Phase 13's contract rule 6 (*"`valid_until = now + individual.paid_entitlement_valid_days`"*). Spec §11.9 gives `MarketplaceProduct` its own `entitlement_valid_days` column and §23.1 says "Staff may edit … policy durations" on the product; a per-product duration that the purchase path ignored in favour of a global setting would make that column decorative, which spec §2.1 forbids. Both are seeded **365**, so they agree today and no behaviour differs; the platform setting remains the default for a right that has no product behind it (Phase 13's staff grant). Recorded in the Contract summary and in Known Limitations.

> **Note (ruling — the entitlement's `metadata` does NOT carry `publication_days`.)** Phase 13 contract rule 5: *"Publication duration comes from the consumed entitlement, not from the setting. `metadata["publication_days"]` is frozen at **consumption**."* Freezing it here, at purchase, would either be overwritten by Phase 13's consumption path or silently shadow it. This task writes `metadata = {"product_code": …, "order_id": …}` and leaves consumption's key alone. The consequence — that a staff edit to a product's `publication_days` currently has no effect, because Phase 13's consumption reads `individual.paid_publish_days` — is real and is recorded as Known Limitation 4 for the phase that reconciles the two.

> **Note (ruling — an `ORDER_NOT_FOUND` or `MISMATCH` answers 200, a database failure answers 500.)** See the plan's scope rulings. A mismatch is a configuration fact that no retry can fix, so retrying would burn Stripe's retry budget and bury the real signal; the staff alert is the remedy. A genuinely transient failure propagates, which rolls the dedup row back (Task 9) so the retry can succeed.

- [ ] **Step 1: Write the failing test**

`backend/payments/tests/test_fulfillment.py`:

```python
"""Spec §23.3 steps 4-9 and §40 Scenario H."""

from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from audit.models import AuditEvent
from entitlements.enums import EntitlementSource, EntitlementState, EntitlementType
from entitlements.models import UserEntitlement
from listings.tests.factories import make_private_listing
from payments.enums import PaymentOrderStatus, ProductCode, WebhookResult
from payments.fulfillment import (
    handle_checkout_session_expired,
    handle_checkout_session_failed,
    handle_checkout_session_paid,
    verify_session_against_order,
)
from payments.models import PaymentOrder
from payments.signals import payment_fulfilled, payment_needs_staff_review
from payments.tests.factories import (
    listing_right_product,
    make_order,
    make_payments_seller,
    media_upgrade_product,
)
from payments.webhooks import HANDLERS


@pytest.fixture
def seller(db):
    return make_payments_seller()


@pytest.fixture
def order(seller):
    return make_order(
        user=seller,
        product=listing_right_product(),
        status=PaymentOrderStatus.CHECKOUT_OPEN,
        amount=Decimal("49.00"),
        currency="EUR",
        stripe_checkout_session_id="cs_live_1",
    )


def session_for(order, **overrides):
    payload = {
        "id": order.stripe_checkout_session_id,
        "object": "checkout.session",
        "mode": "payment",
        "payment_status": "paid",
        "status": "complete",
        "amount_total": 4900,
        "currency": "eur",
        "payment_intent": "pi_live_1",
        "client_reference_id": str(order.pk),
        "metadata": {
            "order_id": str(order.pk),
            "user_id": str(order.user_id),
            "product_code": order.product.code,
            "listing_id": "",
        },
    }
    payload.update(overrides)
    return payload


def event_for(order, event_type="checkout.session.completed", **overrides):
    return {
        "id": f"evt_{event_type}_{order.pk}",
        "type": event_type,
        "data": {"object": session_for(order, **overrides)},
    }


@pytest.fixture
def captured_signals():
    """Collect both payment signals for the duration of one test.

    `weak=False` is required: a receiver defined inside a fixture has no strong
    reference anywhere else, and Django's default weak connection would let it
    be garbage-collected mid-test, producing a silently empty list. The explicit
    disconnect in the teardown is what stops a receiver leaking into the next
    test in the session.
    """
    received = {"fulfilled": [], "review": []}

    def on_fulfilled(sender, order, entitlement, **kwargs):
        received["fulfilled"].append((order, entitlement))

    def on_review(sender, order, reason, detail, **kwargs):
        received["review"].append((order, reason))

    payment_fulfilled.connect(on_fulfilled, weak=False)
    payment_needs_staff_review.connect(on_review, weak=False)
    yield received
    payment_fulfilled.disconnect(on_fulfilled)
    payment_needs_staff_review.disconnect(on_review)


@pytest.fixture
def deliver(django_capture_on_commit_callbacks):
    """Call a handler so that its `transaction.on_commit` callbacks actually run.

    pytest-django wraps each `django_db` test in a transaction it rolls back, so
    a callback registered with `transaction.on_commit` NEVER fires on its own —
    a test asserting on one of this phase's signals without this wrapper passes
    vacuously today and would keep passing if the signal were deleted.
    `django_capture_on_commit_callbacks(execute=True)` is pytest-django's
    supported way to flush them.
    """

    def _call(handler, event):
        with django_capture_on_commit_callbacks(execute=True):
            return handler(event)

    return _call


@pytest.mark.django_db
def test_every_checkout_event_type_this_phase_handles_is_registered():
    assert set(HANDLERS) >= {
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
        "checkout.session.async_payment_failed",
        "checkout.session.expired",
    }


@pytest.mark.django_db
def test_a_paid_session_creates_exactly_one_entitlement(order, captured_signals):
    """Spec §23.3 steps 6-7 and §6.4's "FULFILLED means an entitlement was
    created exactly once"."""
    result = handle_checkout_session_paid(event_for(order))

    assert result == WebhookResult.FULFILLED
    order.refresh_from_db()
    assert order.status == PaymentOrderStatus.FULFILLED
    assert order.paid_at is not None
    assert order.fulfilled_at is not None
    assert order.stripe_payment_intent_id == "pi_live_1"

    right = UserEntitlement.objects.get()
    assert order.fulfilled_entitlement_id == right.pk
    assert right.user_id == order.user_id
    assert right.entitlement_type == EntitlementType.PAID_LISTING
    assert right.source == EntitlementSource.STRIPE_PURCHASE
    assert right.state == EntitlementState.AVAILABLE
    assert right.source_payment_id == order.pk
    assert right.listing_id is None
    assert right.metadata["order_id"] == str(order.pk)
    # Phase 13 contract rule 5: publication duration is frozen at CONSUMPTION,
    # not at purchase. This phase must not pre-empt that key.
    assert "publication_days" not in right.metadata


@pytest.mark.django_db
def test_the_validity_window_comes_from_the_products_own_duration(order):
    order.product.entitlement_valid_days = 180
    order.product.save(update_fields=["entitlement_valid_days"])

    handle_checkout_session_paid(event_for(order))

    right = UserEntitlement.objects.get()
    assert right.valid_until - right.valid_from == timedelta(days=180)


@pytest.mark.django_db
def test_a_duplicate_paid_event_does_not_create_a_second_entitlement(order):
    """Spec §40 Scenario H: "the verified paid event arrives twice ... one order
    becomes fulfilled and exactly one listing entitlement exists".

    This is the handler-level half; the delivery-level half (the same event id
    twice) is test_webhook_security.py's. Both must hold: Stripe can deliver two
    DIFFERENT event ids describing the same completed session.
    """
    handle_checkout_session_paid(event_for(order))
    second = handle_checkout_session_paid(
        {**event_for(order), "id": "evt_a_different_id"}
    )

    assert second == WebhookResult.ALREADY_FULFILLED
    assert UserEntitlement.objects.count() == 1
    assert PaymentOrder.objects.fulfilled().count() == 1


@pytest.mark.django_db
def test_a_session_whose_payment_is_still_unpaid_does_not_fulfil(order):
    """Spec §23.3 step 5 includes "payment status". A Checkout session can be
    `complete` with `payment_status: "unpaid"` for delayed payment methods; the
    later async_payment_succeeded event is what fulfils it."""
    result = handle_checkout_session_paid(event_for(order, payment_status="unpaid"))

    assert result == WebhookResult.IGNORED
    order.refresh_from_db()
    assert order.status == PaymentOrderStatus.CHECKOUT_OPEN
    assert UserEntitlement.objects.count() == 0


@pytest.mark.django_db
def test_an_async_payment_succeeded_event_fulfils(order):
    result = handle_checkout_session_paid(
        event_for(order, event_type="checkout.session.async_payment_succeeded")
    )

    assert result == WebhookResult.FULFILLED
    assert UserEntitlement.objects.count() == 1


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("overrides", "reason"),
    [
        ({"amount_total": 100}, "amount"),
        ({"amount_total": None}, "amount"),
        ({"currency": "usd"}, "currency"),
        ({"mode": "subscription"}, "mode"),
    ],
)
def test_a_mismatched_session_blocks_fulfilment_and_alerts_staff(
    order, captured_signals, deliver, overrides, reason
):
    """Spec §23's acceptance list: "Currency/amount mismatch blocks fulfillment
    and alerts staff"."""
    result = deliver(handle_checkout_session_paid, event_for(order, **overrides))

    assert result == WebhookResult.MISMATCH
    order.refresh_from_db()
    assert order.status == PaymentOrderStatus.FAILED
    assert order.metadata["staff_review_required"] is True
    assert UserEntitlement.objects.count() == 0
    assert AuditEvent.objects.filter(action="payment_order.mismatch").count() == 1
    assert [r for _, r in captured_signals["review"]] == [f"{reason}_mismatch"]
    assert (
        verify_session_against_order(order=order, session=session_for(order, **overrides))
        == f"{reason}_mismatch"
    )


@pytest.mark.django_db
def test_a_session_claiming_a_different_user_blocks_fulfilment(order):
    """Spec §23.3 step 5: "Verify expected user". The metadata is Stripe's echo
    of what we sent, so a divergence means the event does not describe this
    order and must never grant anything to this user."""
    hostile = session_for(order)
    hostile["metadata"] = {**hostile["metadata"], "user_id": "00000000-0000-4000-8000-000000000000"}

    result = handle_checkout_session_paid(
        {"id": "evt_user_mismatch", "type": "checkout.session.completed",
         "data": {"object": hostile}}
    )

    assert result == WebhookResult.MISMATCH
    assert UserEntitlement.objects.count() == 0


@pytest.mark.django_db
def test_a_session_claiming_a_different_product_blocks_fulfilment(order):
    hostile = session_for(order)
    hostile["metadata"] = {
        **hostile["metadata"],
        "product_code": ProductCode.LISTING_MEDIA_UPGRADE,
    }

    result = handle_checkout_session_paid(
        {"id": "evt_product_mismatch", "type": "checkout.session.completed",
         "data": {"object": hostile}}
    )

    assert result == WebhookResult.MISMATCH
    assert UserEntitlement.objects.count() == 0


@pytest.mark.django_db
def test_an_unknown_session_is_recorded_and_alerted_not_crashed(
    seller, captured_signals, deliver
):
    """A signature-verified event whose session we have never heard of is an
    operational anomaly (a second environment sharing the secret, a lost order).
    It must not 500 — Stripe would retry it for days."""
    fake_order = make_order(
        user=seller,
        product=listing_right_product(),
        status=PaymentOrderStatus.CHECKOUT_OPEN,
        stripe_checkout_session_id="cs_known",
    )
    event = event_for(fake_order)
    event["data"]["object"]["id"] = "cs_never_seen"

    result = deliver(handle_checkout_session_paid, event)

    assert result == WebhookResult.ORDER_NOT_FOUND
    assert UserEntitlement.objects.count() == 0
    assert [reason for _, reason in captured_signals["review"]] == [
        "unknown_checkout_session"
    ]


@pytest.mark.django_db
def test_a_late_paid_event_cannot_resurrect_a_failed_order(seller):
    """The out-of-order case spec §23.3 implies and §6.4 makes explicit: FAILED
    is terminal."""
    order = make_order(
        user=seller,
        product=listing_right_product(),
        status=PaymentOrderStatus.FAILED,
        stripe_checkout_session_id="cs_failed",
    )

    result = handle_checkout_session_paid(event_for(order))

    assert result == WebhookResult.IGNORED
    order.refresh_from_db()
    assert order.status == PaymentOrderStatus.FAILED
    assert UserEntitlement.objects.count() == 0


@pytest.mark.django_db
def test_an_expired_session_expires_the_order(order):
    result = handle_checkout_session_expired(
        event_for(order, event_type="checkout.session.expired")
    )

    assert result == WebhookResult.EXPIRED
    order.refresh_from_db()
    assert order.status == PaymentOrderStatus.EXPIRED
    assert UserEntitlement.objects.count() == 0


@pytest.mark.django_db
def test_an_expired_event_for_an_already_fulfilled_order_changes_nothing(order):
    """Out-of-order delivery: expiry arriving after completion must not undo a
    grant. Spec §35.3: "Do not roll back a fulfilled Stripe entitlement"."""
    handle_checkout_session_paid(event_for(order))

    result = handle_checkout_session_expired(
        event_for(order, event_type="checkout.session.expired")
    )

    assert result == WebhookResult.IGNORED
    order.refresh_from_db()
    assert order.status == PaymentOrderStatus.FULFILLED
    assert UserEntitlement.objects.count() == 1


@pytest.mark.django_db
def test_an_async_payment_failure_fails_the_order(order):
    result = handle_checkout_session_failed(
        event_for(order, event_type="checkout.session.async_payment_failed")
    )

    assert result == WebhookResult.IGNORED
    order.refresh_from_db()
    assert order.status == PaymentOrderStatus.FAILED
    assert UserEntitlement.objects.count() == 0
    assert AuditEvent.objects.filter(action="payment_order.failed").count() == 1


@pytest.mark.django_db
def test_a_media_upgrade_binds_its_entitlement_to_the_listing(seller):
    """Spec §23.1: "Grants one upgrade bound to one eligible private-seller
    listing" and "Cannot be transferred after binding"."""
    listing = make_private_listing(owner=seller)
    product = media_upgrade_product()
    order = make_order(
        user=seller,
        product=product,
        listing=listing,
        status=PaymentOrderStatus.CHECKOUT_OPEN,
        amount=Decimal("19.00"),
        stripe_checkout_session_id="cs_upgrade",
    )
    event = event_for(order, amount_total=1900)
    event["data"]["object"]["metadata"]["listing_id"] = str(listing.pk)

    result = handle_checkout_session_paid(event)

    assert result == WebhookResult.FULFILLED
    right = UserEntitlement.objects.get()
    assert right.entitlement_type == EntitlementType.MEDIA_UPGRADE
    assert right.listing_id == listing.pk


@pytest.mark.django_db
def test_a_second_upgrade_for_one_listing_is_refused_by_the_database(seller):
    """Phase 13's merged partial unique index
    `entitlements_one_live_right_per_listing_and_type` is the real guarantee
    behind "cannot be transferred after binding" — it holds even if this
    module's Python checks were removed."""
    from django.db import IntegrityError, transaction

    listing = make_private_listing(owner=seller)
    product = media_upgrade_product()
    first = make_order(
        user=seller, product=product, listing=listing,
        status=PaymentOrderStatus.CHECKOUT_OPEN, amount=Decimal("19.00"),
        stripe_checkout_session_id="cs_up_1",
    )
    handle_checkout_session_paid(event_for(first, amount_total=1900))

    with pytest.raises(IntegrityError), transaction.atomic():
        UserEntitlement.objects.create(
            user=seller,
            entitlement_type=EntitlementType.MEDIA_UPGRADE,
            source=EntitlementSource.STRIPE_PURCHASE,
            state=EntitlementState.AVAILABLE,
            listing=listing,
            valid_from=timezone.now(),
            valid_until=timezone.now() + timedelta(days=365),
        )


@pytest.mark.django_db
def test_a_listing_right_and_a_media_upgrade_may_coexist_on_one_listing(seller):
    """The cross-target negative: the index is keyed on (listing,
    entitlement_type), so it must NOT collapse two different right types."""
    listing = make_private_listing(owner=seller)

    UserEntitlement.objects.create(
        user=seller, entitlement_type=EntitlementType.PAID_LISTING,
        source=EntitlementSource.STRIPE_PURCHASE, state=EntitlementState.CONSUMED,
        listing=listing, valid_from=timezone.now(),
        valid_until=timezone.now() + timedelta(days=365),
        consumed_at=timezone.now(),
    )
    UserEntitlement.objects.create(
        user=seller, entitlement_type=EntitlementType.MEDIA_UPGRADE,
        source=EntitlementSource.STRIPE_PURCHASE, state=EntitlementState.AVAILABLE,
        listing=listing, valid_from=timezone.now(),
        valid_until=timezone.now() + timedelta(days=365),
    )

    assert UserEntitlement.objects.filter(listing=listing).count() == 2


@pytest.mark.django_db
def test_fulfilment_locks_the_order_row(order, django_assert_num_queries):
    """Spec §23.3 step 4: "lock PaymentOrder". Proven by inspecting the SQL, not
    by racing two threads — this project deliberately avoids threaded database
    tests (Phase 13 Known Limitation 12)."""
    from django.db import connection
    from django.test.utils import CaptureQueriesContext

    with CaptureQueriesContext(connection) as captured:
        handle_checkout_session_paid(event_for(order))

    assert any("FOR UPDATE" in q["sql"] for q in captured.captured_queries)


@pytest.mark.django_db
def test_fulfilment_writes_two_audit_events_from_stripe(order):
    """Spec §2.4. A webhook has no user actor, so both rows use the merged
    AuditEvent.ActorType.STRIPE / Source.WEBHOOK values."""
    handle_checkout_session_paid(event_for(order))

    events = AuditEvent.objects.filter(target_id=str(order.pk)).order_by("created_at")
    assert [e.action for e in events] == [
        "payment_order.paid",
        "payment_order.fulfilled",
    ]
    for event in events:
        assert event.actor_user_id is None
        assert event.actor_type == AuditEvent.ActorType.STRIPE
        assert event.source == AuditEvent.Source.WEBHOOK


@pytest.mark.django_db
def test_the_fulfilment_signal_fires_after_commit(
    order, captured_signals, deliver, django_capture_on_commit_callbacks
):
    """Spec §23.3 step 9: "AFTER commit, notify user".

    Two assertions, and the first is what makes the second non-vacuous: the
    signal must NOT have fired while the transaction was still open.
    """
    with django_capture_on_commit_callbacks(execute=False) as callbacks:
        handle_checkout_session_paid(event_for(order))
    assert captured_signals["fulfilled"] == []   # not sent inside the transaction
    assert callbacks                             # but queued for after it

    for callback in callbacks:
        callback()

    assert len(captured_signals["fulfilled"]) == 1
    fired_order, fired_right = captured_signals["fulfilled"][0]
    assert fired_order.pk == order.pk
    assert fired_right.pk == UserEntitlement.objects.get().pk


@pytest.mark.django_db
def test_no_stripe_payload_is_copied_wholesale_into_an_audit_event(order):
    """Spec §33.2's data minimization: audit metadata carries the few fields we
    verified, never the whole session object (which can grow customer details)."""
    event = event_for(order)
    event["data"]["object"]["customer_details"] = {
        "email": "leak@example.com",
        "name": "Leak Me",
        "address": {"line1": "1 Leak Street"},
    }

    handle_checkout_session_paid(event)

    dumped = "".join(
        str(e.metadata) + str(e.after) + str(e.before) for e in AuditEvent.objects.all()
    )
    assert "leak@example.com" not in dumped
    assert "Leak Street" not in dumped
```

> **Note (the mismatch reason strings are a contract).** The parametrized ids above (`amount`, `currency`, `mode`) are concatenated with `_mismatch` in both the signal assertion and the `verify_session_against_order` assertion, so the reasons the implementation returns must be **exactly** `amount_mismatch`, `currency_mismatch`, `mode_mismatch` — plus `user_mismatch`, `product_mismatch` and `listing_mismatch`, which the two hand-written tests below check by outcome. Do not "tidy" them into free text: they are written into `PaymentOrder.metadata["staff_review_reason"]` and into audit metadata, and Phase 17's payment-case queue will branch on them.

- [ ] **Step 2: Run the test and confirm it fails**

```bash
cd backend && uv run pytest payments/tests/test_fulfillment.py -q
```

Expected: `ModuleNotFoundError: No module named 'payments.fulfillment'`.

- [ ] **Step 3: Write the fulfilment module**

`backend/payments/fulfillment.py`:

```python
"""Fulfillment (spec §23.3 steps 4-9).

This module handles TRUSTED input — every event reaching it has already had its
signature verified and its id deduplicated by payments.webhooks — and it holds
all the business rules the webhook layer deliberately has none of.

The one invariant everything here serves: spec §6.4's "FULFILLED means an
entitlement was created exactly once. Repeated webhook delivery must return
success without creating a second entitlement."
"""

from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from audit.models import AuditEvent
from audit.services import record_audit_event
from entitlements.enums import EntitlementSource, EntitlementState
from entitlements.models import UserEntitlement

from .enums import (
    PRODUCT_ENTITLEMENT_TYPES,
    PaymentOrderStatus,
    WebhookResult,
    can_transition_payment,
)
from .models import PaymentOrder
from .products import minor_units
from .signals import payment_fulfilled, payment_needs_staff_review
from .webhooks import HANDLERS


def _session(event) -> dict:
    return event["data"]["object"]


def _audit(order, action, *, before, after, metadata=None):
    """Every webhook-driven audit row. A webhook has no user actor, so it uses
    the merged AuditEvent.ActorType.STRIPE / Source.WEBHOOK values.

    `metadata` carries only fields this module explicitly verified — never the
    session object, which can contain `customer_details` (spec §33.2).
    """
    record_audit_event(
        actor_user=None,
        actor_type=AuditEvent.ActorType.STRIPE,
        action=action,
        target_type="payments.PaymentOrder",
        target_id=str(order.pk),
        source=AuditEvent.Source.WEBHOOK,
        before=before,
        after=after,
        metadata=metadata or {},
    )


def _flag_for_staff(order, *, reason: str, detail: str):
    """Spec §23.4: "mark payment case for staff review, notify staff"."""
    order.metadata = {
        **order.metadata,
        "staff_review_required": True,
        "staff_review_reason": reason,
    }
    transaction.on_commit(
        lambda: payment_needs_staff_review.send(
            sender=PaymentOrder, order=order, reason=reason, detail=detail
        )
    )


def verify_session_against_order(*, order, session) -> str:
    """Spec §23.3 step 5: "Verify expected user, product, amount, currency, mode
    and payment status."

    Returns "" when everything matches, else a short machine reason. The
    metadata compared here is Stripe's echo of what payments.checkout sent; a
    divergence means the event does not describe this order, and an event that
    does not describe this order must never grant anything to this user.
    """
    metadata = session.get("metadata") or {}

    if session.get("mode") != "payment":
        # Spec §23.1: both products are "One-time payment".
        return "mode_mismatch"
    if metadata.get("user_id") != str(order.user_id):
        return "user_mismatch"
    if metadata.get("product_code") != order.product.code:
        return "product_mismatch"
    if (session.get("currency") or "").upper() != order.currency.upper():
        return "currency_mismatch"

    amount_total = session.get("amount_total")
    if amount_total is None:
        return "amount_mismatch"
    if amount_total != minor_units(order.amount, order.currency):
        return "amount_mismatch"

    expected_listing = "" if order.listing_id is None else str(order.listing_id)
    if (metadata.get("listing_id") or "") != expected_listing:
        return "listing_mismatch"

    return ""


def grant_purchased_entitlement(*, order, now) -> UserEntitlement:
    """Create the one right this order paid for.

    Creating a brand-new AVAILABLE row is NOT a state transition, which is why
    this does not go through `entitlements.services` (Phase 13 contract rule 1
    governs transitions). `grant_listing_right` is also the wrong tool: it
    hard-codes STAFF_GRANT, requires a `reason` and stamps `granted_by`, none of
    which describes a purchase. Every transition AWAY from this row — revocation
    on refund, Task 11 — does go through `entitlements.services`.

    The validity window comes from the PRODUCT's own `entitlement_valid_days`
    (spec §11.9, §23.1 "Staff may edit ... policy durations"), not from
    `individual.paid_entitlement_valid_days`; see the plan's ruling. `metadata`
    deliberately omits `publication_days`, which Phase 13 contract rule 5
    freezes at CONSUMPTION.

    This phase creates no RESERVED rows: the customer has already paid, so there
    is nothing to hold, and a reserved row would be reclaimable by Phase 13's
    30-minute sweep out from under the buyer.
    """
    product = order.product
    return UserEntitlement.objects.create(
        user=order.user,
        entitlement_type=PRODUCT_ENTITLEMENT_TYPES[product.code],
        source=EntitlementSource.STRIPE_PURCHASE,
        source_payment=order,
        listing=order.listing,
        state=EntitlementState.AVAILABLE,
        valid_from=now,
        valid_until=now + timedelta(days=product.entitlement_valid_days),
        metadata={"order_id": str(order.pk), "product_code": product.code},
    )


def fulfil_paid_session(*, order, session, now=None) -> str:
    """Spec §23.3 steps 5-8, inside the caller's transaction and lock."""
    now = now or timezone.now()

    if order.status == PaymentOrderStatus.FULFILLED:
        # Stripe can deliver two DIFFERENT event ids describing one session.
        return WebhookResult.ALREADY_FULFILLED
    if not can_transition_payment(order.status, PaymentOrderStatus.PAID):
        # FAILED, EXPIRED, REFUNDED and DISPUTED all land here: a late paid
        # event must never resurrect them (spec §6.4).
        return WebhookResult.IGNORED
    if session.get("payment_status") != "paid":
        # A session can be `complete` with `payment_status: "unpaid"` for
        # delayed payment methods; async_payment_succeeded is what fulfils it.
        return WebhookResult.IGNORED

    reason = verify_session_against_order(order=order, session=session)
    if reason:
        before = {"status": order.status}
        order.status = PaymentOrderStatus.FAILED
        _flag_for_staff(order, reason=reason, detail="Stripe session did not match the order.")
        order.save(update_fields=["status", "metadata", "updated_at"])
        _audit(
            order,
            "payment_order.mismatch",
            before=before,
            after={"status": order.status},
            metadata={"reason": reason},
        )
        return WebhookResult.MISMATCH

    before = {"status": order.status}
    order.status = PaymentOrderStatus.PAID
    order.paid_at = now
    payment_intent = session.get("payment_intent") or ""
    order.stripe_payment_intent_id = (
        payment_intent if isinstance(payment_intent, str) else payment_intent.get("id", "")
    )
    order.save(
        update_fields=["status", "paid_at", "stripe_payment_intent_id", "updated_at"]
    )
    _audit(order, "payment_order.paid", before=before, after={"status": order.status})

    entitlement = grant_purchased_entitlement(order=order, now=now)

    order.status = PaymentOrderStatus.FULFILLED
    order.fulfilled_at = now
    order.fulfilled_entitlement = entitlement
    order.save(
        update_fields=["status", "fulfilled_at", "fulfilled_entitlement", "updated_at"]
    )
    _audit(
        order,
        "payment_order.fulfilled",
        before={"status": PaymentOrderStatus.PAID},
        after={"status": order.status, "entitlement_id": str(entitlement.pk)},
    )

    # Spec §23.3 step 9: "After commit, notify user and refresh WebSocket
    # eligibility state." Receivers are Phase 18's.
    transaction.on_commit(
        lambda: payment_fulfilled.send(
            sender=PaymentOrder, order=order, entitlement=entitlement
        )
    )
    return WebhookResult.FULFILLED


def _locked_order_for(session):
    """Spec §23.3 step 4: "lock PaymentOrder".

    Resolved by the session id WE recorded when we opened the session, not by
    Stripe's echoed metadata: the local column is the fact this system owns.
    """
    return (
        PaymentOrder.objects.select_for_update()
        .select_related("product", "listing")
        .filter(stripe_checkout_session_id=session.get("id", ""))
        .first()
    )


def _order_not_found(session) -> str:
    """A signature-verified event whose session we have never heard of.

    Answers 200 with an alert rather than 500: no retry can make an unknown
    session known, and a retry storm would bury the signal. Causes worth staff
    attention: a second environment sharing the webhook secret, or an order lost
    between creation and session recording.
    """
    transaction.on_commit(
        lambda: payment_needs_staff_review.send(
            sender=PaymentOrder,
            order=None,
            reason="unknown_checkout_session",
            detail=f"No local order for checkout session {session.get('id', '')!r}.",
        )
    )
    return WebhookResult.ORDER_NOT_FOUND


def handle_checkout_session_paid(event) -> str:
    session = _session(event)
    order = _locked_order_for(session)
    if order is None:
        return _order_not_found(session)
    return fulfil_paid_session(order=order, session=session)


def handle_checkout_session_failed(event) -> str:
    session = _session(event)
    order = _locked_order_for(session)
    if order is None:
        return _order_not_found(session)
    if not can_transition_payment(order.status, PaymentOrderStatus.FAILED):
        return WebhookResult.IGNORED
    before = {"status": order.status}
    order.status = PaymentOrderStatus.FAILED
    order.save(update_fields=["status", "updated_at"])
    _audit(order, "payment_order.failed", before=before, after={"status": order.status})
    return WebhookResult.IGNORED


def handle_checkout_session_expired(event) -> str:
    session = _session(event)
    order = _locked_order_for(session)
    if order is None:
        return _order_not_found(session)
    if not can_transition_payment(order.status, PaymentOrderStatus.EXPIRED):
        # An expiry arriving after completion must not undo a grant
        # (spec §35.3).
        return WebhookResult.IGNORED
    before = {"status": order.status}
    order.status = PaymentOrderStatus.EXPIRED
    order.save(update_fields=["status", "updated_at"])
    _audit(order, "payment_order.expired", before=before, after={"status": order.status})
    return WebhookResult.EXPIRED


HANDLERS.update(
    {
        "checkout.session.completed": handle_checkout_session_paid,
        "checkout.session.async_payment_succeeded": handle_checkout_session_paid,
        "checkout.session.async_payment_failed": handle_checkout_session_failed,
        "checkout.session.expired": handle_checkout_session_expired,
    }
)
```

- [ ] **Step 4: Register the handlers at app load**

`payments/webhooks.py` must not import `payments.fulfillment` (that would be a cycle: fulfillment imports `HANDLERS`). Register by importing the handler module from the app config instead. Append to `backend/payments/apps.py`:

```python
    def ready(self):
        # Populates payments.webhooks.HANDLERS. Imported here rather than in
        # webhooks.py because fulfillment imports HANDLERS, and importing it the
        # other way round would be a cycle.
        from . import fulfillment  # noqa: F401
        from . import refunds  # noqa: F401  (added by Task 11)
```

Task 10 adds only the `fulfillment` line; Task 11 adds the `refunds` line.

- [ ] **Step 5: Run the tests and confirm they pass**

```bash
cd backend && uv run pytest payments/tests/test_fulfillment.py -q
cd backend && uv run pytest -q
```

- [ ] **Step 6: Mutation check**

1. Delete the `order.status == FULFILLED` early return → `test_a_duplicate_paid_event_does_not_create_a_second_entitlement` must fail.
2. Delete the `payment_status != "paid"` check → `test_a_session_whose_payment_is_still_unpaid_does_not_fulfil` must fail.
3. Delete the `can_transition_payment(...)` guard → `test_a_late_paid_event_cannot_resurrect_a_failed_order` must fail.
4. Delete the `amount_total` comparison → the `amount` cases of the mismatch test must fail.
5. Delete the `metadata["user_id"]` comparison → `test_a_session_claiming_a_different_user_blocks_fulfilment` must fail.
6. Replace `select_for_update()` with `filter()` → `test_fulfilment_locks_the_order_row` must fail.
7. Change `valid_until` to read `paid_validity_days()` → `test_the_validity_window_comes_from_the_products_own_duration` must fail.
8. Add `"session": session` to an `_audit(..., metadata=...)` call → `test_no_stripe_payload_is_copied_wholesale_into_an_audit_event` must fail.
9. Move the `payment_fulfilled.send(...)` out of `transaction.on_commit` so it sends inline → `test_the_fulfilment_signal_fires_after_commit` must fail on its **first** assertion (`captured_signals["fulfilled"] == []`), because the signal now fires while the transaction is still open. That first assertion exists precisely so this mutation is caught; a test that only checked the receiver eventually ran would pass either way and prove nothing about spec §23.3 step 9's "After commit".
10. Remove the `deliver` fixture's `django_capture_on_commit_callbacks(execute=True)` wrapper (call the handler directly) → every signal assertion in this file must fail. If any of them still passes, it is asserting on something other than the signal and must be fixed.

Revert each.

- [ ] **Step 7: Commit**

```bash
git add backend/payments
git commit -m "feat(payments): locked, verified, exactly-once fulfilment from the Stripe webhook (Phase 14 Task 10)"
```

---

### Task 11: Refunds and disputes (spec §23.4)

**Files:**
- Create: `backend/payments/refunds.py`
- Modify: `backend/payments/apps.py` (the `refunds` import line)
- Test: `backend/payments/tests/test_refunds.py`

**Interfaces:**
- Consumes: `payments.fulfillment._audit`, `payments.fulfillment._flag_for_staff`, `payments.fulfillment._order_not_found` (Task 10 — promote all three to public names `record_payment_audit`, `flag_for_staff`, `order_not_found` in this task and update Task 10's call sites, so a leading underscore is not being imported across modules); `payments.enums.{PaymentOrderStatus, WebhookResult, can_transition_payment}`; `entitlements.enums.EntitlementState`; **`entitlements.services.{revoke_entitlement, release_reservation, InvalidEntitlementState}` (Phase 13 Tasks 12-13 — ASSUMED, see below).**
- Produces:
  - `payments.refunds.revoke_for_refund(*, order, reason) -> str` — the outcome, one of `"revoked"`, `"released_and_revoked"`, `"staff_review"`, `"nothing_to_revoke"`
  - `payments.refunds.handle_charge_refunded(event) -> str`
  - `payments.refunds.handle_dispute_created(event) -> str`
  - Two entries appended to `payments.webhooks.HANDLERS`

> **Note (Phase 13 reconciliation — run this before cutting the branch).**
> ```bash
> cd backend && uv run python -c "import inspect, entitlements.services as s; print(inspect.signature(s.revoke_entitlement)); print(inspect.signature(s.release_reservation))"
> ```
> This task assumes `revoke_entitlement(*, entitlement, actor, reason, now=None)` and `release_reservation(*, entitlement, actor, reason)`, and that both accept **`actor=None`** (a webhook has no user actor). If the merged signatures differ, adapt the call sites — do **not** write `UserEntitlement.state` directly, which Phase 13 contract rule 1 forbids. If `actor=None` is refused, add the keyword-only `actor=None` branch to `entitlements/services.py` as a minimal, separately-reviewed edit and record it in the Contract summary. If `entitlements.services` does not exist yet, **stop and escalate to the controller** rather than inventing a second revocation path.

> **Note (ruling — a consumed right is never silently unpublished.)** Spec §23.4, verbatim: *"Consumed/published entitlement: do not silently unpublish solely on a webhook; mark payment case for staff review, notify staff and apply documented commercial policy."* `revoke_for_refund` therefore inspects the entitlement's state and branches: `AVAILABLE` → revoke; `RESERVED` → release, then revoke; `CONSUMED` → **touch nothing**, flag the order for staff review, notify. No listing is unpublished by this module, and Task 13's acceptance test proves it.

> **Note (ruling — partial refunds are not acted on.)** §23.4 says "Unused entitlement: revoke on **confirmed full refund**". A `charge.refunded` event with `amount_refunded < amount` is recorded as `REFUND_HANDLED` with a staff-review flag and revokes nothing — a partial refund is a commercial decision, not an entitlement rule. Recorded in Known Limitations.

- [ ] **Step 1: Write the failing test**

`backend/payments/tests/test_refunds.py`:

```python
"""Spec §23.4's four rules, one test per bullet."""

from decimal import Decimal

import pytest

from audit.models import AuditEvent
from entitlements.enums import EntitlementState, EntitlementType
from entitlements.models import UserEntitlement
from listings.enums import ListingStatus
from listings.tests.factories import make_private_listing
from payments.enums import PaymentOrderStatus, WebhookResult
from payments.refunds import handle_charge_refunded, handle_dispute_created
from payments.signals import payment_needs_staff_review
from payments.tests.factories import (
    listing_right_product,
    make_order,
    make_payments_seller,
)


@pytest.fixture
def seller(db):
    return make_payments_seller()


@pytest.fixture
def captured_review():
    """`weak=False` for the same reason as in test_fulfillment.py: a receiver
    with no strong reference outside this fixture can be garbage-collected
    mid-test, leaving a silently empty list."""
    received = []

    def on_review(sender, order, reason, detail, **kwargs):
        received.append(reason)

    payment_needs_staff_review.connect(on_review, weak=False)
    yield received
    payment_needs_staff_review.disconnect(on_review)


@pytest.fixture
def deliver(django_capture_on_commit_callbacks):
    """Run a handler so its `transaction.on_commit` callbacks actually fire.

    Identical to test_fulfillment.py's fixture and required for the same
    reason: pytest-django rolls each test's transaction back, so an unwrapped
    call would make every `captured_review` assertion below vacuous.
    """

    def _call(handler, event):
        with django_capture_on_commit_callbacks(execute=True):
            return handler(event)

    return _call


def fulfilled_order(seller, *, state=EntitlementState.AVAILABLE, listing=None):
    from datetime import timedelta

    from django.utils import timezone

    from entitlements.enums import EntitlementSource

    order = make_order(
        user=seller,
        product=listing_right_product(),
        status=PaymentOrderStatus.PAID,
        amount=Decimal("49.00"),
        stripe_payment_intent_id="pi_refund_1",
    )
    now = timezone.now()
    right = UserEntitlement.objects.create(
        user=seller,
        entitlement_type=EntitlementType.PAID_LISTING,
        source=EntitlementSource.STRIPE_PURCHASE,
        source_payment=order,
        listing=listing,
        state=state,
        valid_from=now,
        valid_until=now + timedelta(days=365),
        reserved_at=now if state == EntitlementState.RESERVED else None,
        consumed_at=now if state == EntitlementState.CONSUMED else None,
    )
    order.status = PaymentOrderStatus.FULFILLED
    order.fulfilled_at = now
    order.fulfilled_entitlement = right
    order.save()
    return order, right


def refund_event(order, *, amount_refunded=4900, amount=4900, event_id="evt_refund"):
    return {
        "id": event_id,
        "type": "charge.refunded",
        "data": {
            "object": {
                "id": "ch_1",
                "payment_intent": order.stripe_payment_intent_id,
                "amount": amount,
                "amount_refunded": amount_refunded,
                "refunded": amount_refunded >= amount,
            }
        },
    }


def dispute_event(order, event_id="evt_dispute"):
    return {
        "id": event_id,
        "type": "charge.dispute.created",
        "data": {
            "object": {
                "id": "dp_1",
                "payment_intent": order.stripe_payment_intent_id,
                "amount": 4900,
                "reason": "fraudulent",
            }
        },
    }


@pytest.mark.django_db
def test_refund_and_dispute_handlers_are_registered():
    from payments.webhooks import HANDLERS

    assert {"charge.refunded", "charge.dispute.created"} <= set(HANDLERS)


@pytest.mark.django_db
def test_an_unused_right_is_revoked_on_a_full_refund(seller):
    """Spec §23.4 bullet 1: "Unused entitlement: revoke on confirmed full
    refund"."""
    order, right = fulfilled_order(seller)

    result = handle_charge_refunded(refund_event(order))

    assert result == WebhookResult.REFUND_HANDLED
    order.refresh_from_db()
    right.refresh_from_db()
    assert order.status == PaymentOrderStatus.REFUNDED
    assert right.state == EntitlementState.REVOKED
    assert right.revoked_at is not None
    assert AuditEvent.objects.filter(action="payment_order.refunded").count() == 1


@pytest.mark.django_db
def test_a_reserved_right_is_released_then_revoked(seller):
    """Spec §23.4 bullet 2: "Reserved entitlement: release reservation, then
    revoke"."""
    order, right = fulfilled_order(seller, state=EntitlementState.RESERVED)

    handle_charge_refunded(refund_event(order))

    right.refresh_from_db()
    assert right.state == EntitlementState.REVOKED


@pytest.mark.django_db
def test_a_consumed_right_is_never_silently_revoked_or_unpublished(
    seller, captured_review, deliver
):
    """Spec §23.4 bullet 3, the most important rule in this task: "do not
    silently unpublish solely on a webhook; mark payment case for staff review,
    notify staff and apply documented commercial policy"."""
    listing = make_private_listing(owner=seller, status=ListingStatus.PUBLISHED)
    order, right = fulfilled_order(
        seller, state=EntitlementState.CONSUMED, listing=listing
    )

    result = deliver(handle_charge_refunded, refund_event(order))

    assert result == WebhookResult.REFUND_HANDLED
    right.refresh_from_db()
    listing.refresh_from_db()
    assert right.state == EntitlementState.CONSUMED       # untouched
    assert listing.status == ListingStatus.PUBLISHED       # untouched
    order.refresh_from_db()
    assert order.status == PaymentOrderStatus.REFUNDED
    assert order.metadata["staff_review_required"] is True
    assert "refund_of_consumed_right" in captured_review


@pytest.mark.django_db
def test_a_partial_refund_revokes_nothing_and_asks_for_staff(
    seller, captured_review, deliver
):
    """Spec §23.4 bullet 1 says "confirmed FULL refund". A partial refund is a
    commercial decision, not an entitlement rule."""
    order, right = fulfilled_order(seller)

    deliver(handle_charge_refunded, refund_event(order, amount_refunded=1000))

    right.refresh_from_db()
    assert right.state == EntitlementState.AVAILABLE
    order.refresh_from_db()
    assert order.metadata["staff_review_required"] is True
    assert "partial_refund" in captured_review


@pytest.mark.django_db
def test_a_repeated_refund_event_is_idempotent(seller):
    order, right = fulfilled_order(seller)

    first = handle_charge_refunded(refund_event(order))
    second = handle_charge_refunded(refund_event(order, event_id="evt_refund_2"))

    assert first == WebhookResult.REFUND_HANDLED
    assert second == WebhookResult.IGNORED
    right.refresh_from_db()
    assert right.state == EntitlementState.REVOKED
    assert AuditEvent.objects.filter(action="payment_order.refunded").count() == 1


@pytest.mark.django_db
def test_a_dispute_creates_a_high_priority_staff_case(
    seller, captured_review, deliver
):
    """Spec §23.4 bullet 4: "Chargebacks/disputes create high-priority staff
    notification and audit event." A dispute is not a refund: the money has not
    moved back yet, so nothing is revoked here."""
    order, right = fulfilled_order(seller)

    result = deliver(handle_dispute_created, dispute_event(order))

    assert result == WebhookResult.DISPUTE_HANDLED
    order.refresh_from_db()
    right.refresh_from_db()
    assert order.status == PaymentOrderStatus.DISPUTED
    assert order.metadata["staff_review_required"] is True
    assert right.state == EntitlementState.AVAILABLE
    assert "dispute" in captured_review
    assert AuditEvent.objects.filter(action="payment_order.disputed").count() == 1


@pytest.mark.django_db
def test_a_refund_for_an_unknown_payment_intent_alerts_rather_than_crashing(
    seller, captured_review, deliver
):
    order, _ = fulfilled_order(seller)
    event = refund_event(order)
    event["data"]["object"]["payment_intent"] = "pi_never_seen"

    result = deliver(handle_charge_refunded, event)

    assert result == WebhookResult.ORDER_NOT_FOUND
    assert captured_review == ["unknown_charge"]


@pytest.mark.django_db
def test_a_refund_never_touches_another_users_entitlement(seller):
    """IDOR at the webhook layer: revocation is reached only through
    `order.fulfilled_entitlement`, never through a payload-supplied id."""
    other = make_payments_seller("p14-refund-other@example.com")
    order, right = fulfilled_order(seller)
    from datetime import timedelta

    from django.utils import timezone

    from entitlements.enums import EntitlementSource

    bystander = UserEntitlement.objects.create(
        user=other,
        entitlement_type=EntitlementType.PAID_LISTING,
        source=EntitlementSource.STRIPE_PURCHASE,
        state=EntitlementState.AVAILABLE,
        valid_from=timezone.now(),
        valid_until=timezone.now() + timedelta(days=365),
    )
    event = refund_event(order)
    event["data"]["object"]["entitlement_id"] = str(bystander.pk)

    handle_charge_refunded(event)

    bystander.refresh_from_db()
    assert bystander.state == EntitlementState.AVAILABLE
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
cd backend && uv run pytest payments/tests/test_refunds.py -q
```

Expected: `ModuleNotFoundError: No module named 'payments.refunds'`.

- [ ] **Step 3: Promote the three shared helpers in `fulfillment.py`**

Rename `_audit` → `record_payment_audit`, `_flag_for_staff` → `flag_for_staff`, `_order_not_found` → `order_not_found` in `backend/payments/fulfillment.py`, and update their call sites in that file. Importing a leading-underscore name across modules is exactly the kind of thing a reviewer should reject, so the rename happens here rather than at the import.

While renaming, generalize `order_not_found` so its alert text is not wrong for a charge. Task 10 wrote it against a Checkout session; this task's callers pass a **charge**, whose `id` is a `ch_…`, not a `cs_…`:

```python
def order_not_found(payload, *, kind: str = "checkout session") -> str:
    """A signature-verified event whose subject we have never heard of. ..."""
    identifier = payload.get("id", "")
    transaction.on_commit(
        lambda: payment_needs_staff_review.send(
            sender=PaymentOrder,
            order=None,
            reason=f"unknown_{kind.replace(' ', '_')}",
            detail=f"No local order for {kind} {identifier!r}.",
        )
    )
    return WebhookResult.ORDER_NOT_FOUND
```

`payments/refunds.py` then calls `order_not_found(payload, kind="charge")`, and Task 10's three call sites keep the default. Update Task 10's `test_an_unknown_session_is_recorded_and_alerted_not_crashed` if it asserted on the reason string — the default path's reason is still `unknown_checkout_session`.

- [ ] **Step 4: Write the refunds module**

`backend/payments/refunds.py`:

```python
"""Refunds and disputes (spec §23.4).

Three rules this module exists to keep:

  * "Refund action in staff UI calls a dedicated service; do not alter Stripe
    state by editing database fields" — nothing here calls Stripe. It reacts to
    what Stripe already did.
  * "Do not silently unpublish solely on a webhook" — a CONSUMED right is
    touched by nobody here; the order is flagged and staff are notified.
  * Phase 13 contract rule 1 — every state TRANSITION on a UserEntitlement goes
    through entitlements.services, which holds the lock, the §6.3 edge check and
    the audit event together.
"""

from django.db import transaction

from entitlements.enums import EntitlementState
from entitlements.services import release_reservation, revoke_entitlement

from .enums import PaymentOrderStatus, WebhookResult, can_transition_payment
from .fulfillment import flag_for_staff, order_not_found, record_payment_audit
from .models import PaymentOrder
from .webhooks import HANDLERS


def _locked_order_for_intent(payload):
    intent = payload.get("payment_intent") or ""
    if not isinstance(intent, str):
        intent = intent.get("id", "")
    if not intent:
        return None
    return (
        PaymentOrder.objects.select_for_update()
        .select_related("product", "fulfilled_entitlement")
        .filter(stripe_payment_intent_id=intent)
        .first()
    )


def revoke_for_refund(*, order, reason: str) -> str:
    """Spec §23.4's first three bullets, in order."""
    right = order.fulfilled_entitlement
    if right is None:
        return "nothing_to_revoke"

    if right.state == EntitlementState.CONSUMED:
        # Spec §23.4: "do not silently unpublish solely on a webhook".
        flag_for_staff(
            order,
            reason="refund_of_consumed_right",
            detail="A consumed right was refunded; apply commercial policy manually.",
        )
        return "staff_review"

    if right.state == EntitlementState.RESERVED:
        release_reservation(entitlement=right, actor=None, reason=reason)
        right.refresh_from_db()

    if right.state == EntitlementState.AVAILABLE:
        revoke_entitlement(entitlement=right, actor=None, reason=reason)
        return "released_and_revoked"

    # EXPIRED or already REVOKED: nothing left to take back.
    return "nothing_to_revoke"


def handle_charge_refunded(event) -> str:
    payload = event["data"]["object"]
    order = _locked_order_for_intent(payload)
    if order is None:
        return order_not_found(payload)

    if not can_transition_payment(order.status, PaymentOrderStatus.REFUNDED):
        # Already REFUNDED (a repeated delivery), or never paid at all.
        return WebhookResult.IGNORED

    amount = payload.get("amount") or 0
    refunded = payload.get("amount_refunded") or 0
    before = {"status": order.status}

    if refunded < amount:
        # Spec §23.4 bullet 1 says "confirmed FULL refund"; a partial one is a
        # commercial decision, not an entitlement rule.
        flag_for_staff(
            order,
            reason="partial_refund",
            detail="A partial refund was issued; the entitlement was left intact.",
        )
        order.save(update_fields=["metadata", "updated_at"])
        record_payment_audit(
            order,
            "payment_order.refunded",
            before=before,
            after={"status": order.status},
            metadata={"partial": True},
        )
        return WebhookResult.REFUND_HANDLED

    outcome = revoke_for_refund(order=order, reason="Stripe refund")
    order.status = PaymentOrderStatus.REFUNDED
    order.save(update_fields=["status", "metadata", "updated_at"])
    record_payment_audit(
        order,
        "payment_order.refunded",
        before=before,
        after={"status": order.status},
        metadata={"outcome": outcome},
    )
    return WebhookResult.REFUND_HANDLED


def handle_dispute_created(event) -> str:
    """Spec §23.4 bullet 4: "Chargebacks/disputes create high-priority staff
    notification and audit event."

    Nothing is revoked: a dispute is a claim, not a completed refund. If it is
    settled by refunding, Stripe sends charge.refunded and the rule above runs.
    """
    payload = event["data"]["object"]
    order = _locked_order_for_intent(payload)
    if order is None:
        return order_not_found(payload)
    if not can_transition_payment(order.status, PaymentOrderStatus.DISPUTED):
        return WebhookResult.IGNORED

    before = {"status": order.status}
    order.status = PaymentOrderStatus.DISPUTED
    flag_for_staff(
        order,
        reason="dispute",
        detail="A chargeback was opened against this order.",
    )
    order.save(update_fields=["status", "metadata", "updated_at"])
    record_payment_audit(
        order,
        "payment_order.disputed",
        before=before,
        after={"status": order.status},
        # Stripe's dispute `reason` is a fixed enum ("fraudulent",
        # "product_not_received", ...), not free text and not personal data.
        metadata={"stripe_reason": payload.get("reason", "")},
    )
    return WebhookResult.DISPUTE_HANDLED


HANDLERS.update(
    {
        "charge.refunded": handle_charge_refunded,
        "charge.dispute.created": handle_dispute_created,
    }
)
```

Add the `from . import refunds  # noqa: F401` line to `PaymentsConfig.ready()`.

- [ ] **Step 5: Run the tests and confirm they pass**

```bash
cd backend && uv run pytest payments/tests/test_refunds.py -q
cd backend && uv run pytest -q
```

- [ ] **Step 6: Mutation check**

1. Delete the `EntitlementState.CONSUMED` branch → `test_a_consumed_right_is_never_silently_revoked_or_unpublished` must fail.
2. Delete the `refunded < amount` branch → `test_a_partial_refund_revokes_nothing_and_asks_for_staff` must fail.
3. Delete the `can_transition_payment` guard in `handle_charge_refunded` → `test_a_repeated_refund_event_is_idempotent` must fail.
4. Make `handle_dispute_created` call `revoke_for_refund` → `test_a_dispute_creates_a_high_priority_staff_case` must fail.
5. Resolve the entitlement from `payload.get("entitlement_id")` instead of `order.fulfilled_entitlement` → `test_a_refund_never_touches_another_users_entitlement` must fail.

Revert each.

- [ ] **Step 7: Commit**

```bash
git add backend/payments
git commit -m "feat(payments): spec 23.4 refunds and disputes with no silent unpublication (Phase 14 Task 11)"
```

---

### Task 12: `CRUD /api/v1/staff/products/` — every field spec §23.5's card renders

**Files:**
- Create: `backend/payments/selectors.py`, `backend/payments/services.py`
- Modify: `backend/payments/serializers.py`, `backend/payments/views.py`, `backend/payments/urls.py` (all append-only)
- Test: `backend/payments/tests/test_staff_products_api.py`

**Interfaces:**
- Consumes: `payments.models.{MarketplaceProduct, PaymentOrder}` (Tasks 2–3); `payments.products.check_stripe_price` (Task 6); `payments.enums.{PaymentOrderStatus, PAID_STATES}` (Task 1); `accounts.permissions.{IsActiveUser, IsEmailVerified, IsStaffAdmin}` (Phase 3, merged); `audit.services.record_audit_event`.
- Produces:
  - `payments.selectors.ProductOperations` — frozen dataclass: `purchases: int`, `fulfilled: int`, `fulfillment_failures: int`, `open_checkouts: int`
  - `payments.selectors.product_operations(product) -> ProductOperations`
  - `payments.services.update_product(*, product, changes: dict, actor, request_id=None) -> MarketplaceProduct`
  - `payments.serializers.{StaffProductSerializer, StaffProductUpdateSerializer}`
  - `payments.views.{StaffProductListView, StaffProductDetailView}`
  - Routes `staff/products/` and `staff/products/<uuid:product_id>/`

> **Note (ruling — staff **admin** for every method, including GET.)** Spec §5's capability table gives "Configure products/settings" to staff admin alone, and §12's backend rules say a moderator "cannot change payment products unless separately granted staff-admin permission". There is no listed moderator product capability at all, so all routes take `IsStaffAdmin`. Phase 17 may widen the read; widening later is safe, narrowing later is a regression.

> **Note (ruling — `code` is immutable and the collection is not creatable or deletable.)** Spec §23.1 fixes the catalogue at exactly two codes "in this release", and §26.4's edit fields are display copy, active state, Stripe ids and policy durations. So `POST` to the collection and `DELETE` on the detail are not implemented; the list is a `GET` and the detail is `GET`/`PATCH`. "CRUD" in §30.1's inventory is the row label, not a mandate to allow creation of a third product the rest of the system has no code path for.

> **Note (ruling — the price-check is a per-row `GET` field, and it is I/O.)** Each rendered product costs one Stripe API call, so the **list** endpoint does not check prices (two products, two round trips, on a screen that may poll) and the **detail** endpoint does. The list instead returns `price_state: "UNCHECKED"`; the screen (Phase 17) opens a product to see its real validation state. This keeps spec §23.5's "Stripe Price ID validation state" backend-backed and honest rather than cached and stale.

- [ ] **Step 1: Write the failing test**

`backend/payments/tests/test_staff_products_api.py`:

```python
"""Spec §23.5's card fields, §26.4's edit rules and §5's permission row."""

from decimal import Decimal

import pytest
from django.contrib.auth.models import Group
from rest_framework.test import APIClient

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from audit.models import AuditEvent
from payments.enums import PaymentOrderStatus, ProductCode
from payments.models import MarketplaceProduct
from payments.tests.factories import (
    listing_right_product,
    make_order,
    make_payments_seller,
)
from payments.tests.fakes import FakeStripeGateway

LIST_URL = "/api/v1/staff/products/"


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def staff_admin(db):
    admin = make_user("p14-product-admin@example.com", role=UserRole.STAFF, verified=True)
    admin.groups.add(Group.objects.get_or_create(name=StaffGroup.ADMIN)[0])
    return admin


@pytest.fixture
def staff_moderator(db):
    mod = make_user("p14-product-mod@example.com", role=UserRole.STAFF, verified=True)
    mod.groups.add(Group.objects.get_or_create(name=StaffGroup.MODERATOR)[0])
    return mod


@pytest.fixture
def patched_gateway(monkeypatch):
    gateway = FakeStripeGateway()
    monkeypatch.setattr("payments.products.default_gateway", lambda: gateway)
    return gateway


@pytest.mark.django_db
def test_an_anonymous_caller_cannot_list_products(api_client):
    assert api_client.get(LIST_URL).status_code in (401, 403)


@pytest.mark.django_db
def test_a_private_seller_cannot_list_products(api_client):
    api_client.force_authenticate(user=make_payments_seller())

    response = api_client.get(LIST_URL)

    assert response.status_code == 403
    assert response.data["error"]["code"] == "staff_admin_required"


@pytest.mark.django_db
def test_a_staff_moderator_cannot_read_or_change_products(api_client, staff_moderator):
    """Spec §12: "A moderator cannot change payment products unless separately
    granted staff-admin permission"."""
    product = MarketplaceProduct.objects.get(code=ProductCode.INDIVIDUAL_LISTING_RIGHT)
    api_client.force_authenticate(user=staff_moderator)

    assert api_client.get(LIST_URL).status_code == 403
    assert (
        api_client.patch(
            f"{LIST_URL}{product.pk}/", {"is_active": True}, format="json"
        ).status_code
        == 403
    )


@pytest.mark.django_db
def test_a_staff_admin_sees_every_spec_23_5_card_field(api_client, staff_admin):
    api_client.force_authenticate(user=staff_admin)

    response = api_client.get(LIST_URL)

    assert response.status_code == 200
    assert len(response.data) == 2
    row = response.data[0]
    assert set(row) == {
        "id",
        "code",
        "name_en",
        "name_it",
        "name_es",
        "description_en",
        "description_it",
        "description_es",
        "is_active",
        "display_amount",
        "currency",
        "stripe_product_id",
        "stripe_price_id",
        "entitlement_valid_days",
        "publication_days",
        "display_order",
        "price_state",
        "price_reason",
        "stripe_unit_amount",
        "operations",
        "updated_at",
    }
    assert set(row["operations"]) == {
        "purchases",
        "fulfilled",
        "fulfillment_failures",
        "open_checkouts",
    }
    # Spec §30.2: money is a decimal string.
    assert row["display_amount"] == "0.00"


@pytest.mark.django_db
def test_the_list_does_not_call_stripe(api_client, staff_admin, patched_gateway):
    """Two products would be two API round trips on a screen that may poll."""
    listing_right_product()
    api_client.force_authenticate(user=staff_admin)

    response = api_client.get(LIST_URL)

    assert patched_gateway.retrieved == []
    assert {row["price_state"] for row in response.data} == {"UNCHECKED"}


@pytest.mark.django_db
def test_the_detail_reports_a_matching_price_as_ok(
    api_client, staff_admin, patched_gateway
):
    product = listing_right_product(display_amount=Decimal("49.00"))
    api_client.force_authenticate(user=staff_admin)

    response = api_client.get(f"{LIST_URL}{product.pk}/")

    assert response.status_code == 200
    assert response.data["price_state"] == "OK"
    assert response.data["stripe_unit_amount"] == 4900
    assert patched_gateway.retrieved == ["price_test_listing_right"]


@pytest.mark.django_db
def test_the_detail_reports_drift_as_a_mismatch_with_both_numbers(
    api_client, staff_admin, patched_gateway
):
    """Spec §23.5: "A warning is shown if stored display amount differs from
    Stripe's current Price". Staff see both sides, unlike a customer."""
    product = listing_right_product(display_amount=Decimal("59.00"))
    api_client.force_authenticate(user=staff_admin)

    response = api_client.get(f"{LIST_URL}{product.pk}/")

    assert response.data["price_state"] == "MISMATCH"
    assert "amount" in response.data["price_reason"]
    assert response.data["stripe_unit_amount"] == 4900
    assert response.data["display_amount"] == "59.00"


@pytest.mark.django_db
def test_a_stripe_outage_is_reported_as_unavailable_not_as_a_mismatch(
    api_client, staff_admin, monkeypatch
):
    from payments.gateway import StripeUnavailable

    product = listing_right_product()
    monkeypatch.setattr(
        "payments.products.default_gateway",
        lambda: FakeStripeGateway(raise_on_retrieve=StripeUnavailable("down")),
    )
    api_client.force_authenticate(user=staff_admin)

    response = api_client.get(f"{LIST_URL}{product.pk}/")

    assert response.status_code == 200
    assert response.data["price_state"] == "UNAVAILABLE"


@pytest.mark.django_db
def test_the_operations_counters_equal_real_query_results(api_client, staff_admin):
    """Spec §26's definition of done: "All visible counters equal query
    results." Spec §23.5 limits them to "counts, not financial analytics"."""
    from entitlements.enums import EntitlementType
    from entitlements.tests.factories import make_entitlement

    product = listing_right_product()
    buyer = make_payments_seller("p14-counter@example.com")
    right = make_entitlement(user=buyer, entitlement_type=EntitlementType.PAID_LISTING)
    make_order(user=buyer, product=product, status=PaymentOrderStatus.CHECKOUT_OPEN)
    make_order(user=buyer, product=product, status=PaymentOrderStatus.PAID)
    make_order(
        user=buyer, product=product, status=PaymentOrderStatus.FULFILLED,
        fulfilled_entitlement=right,
    )
    make_order(user=buyer, product=product, status=PaymentOrderStatus.FAILED)
    api_client.force_authenticate(user=staff_admin)

    response = api_client.get(f"{LIST_URL}{product.pk}/")

    ops = response.data["operations"]
    # PAID + FULFILLED: money moved. CHECKOUT_OPEN and FAILED did not.
    assert ops["purchases"] == 2
    assert ops["fulfilled"] == 1
    assert ops["fulfillment_failures"] == 1
    assert ops["open_checkouts"] == 1
    # And no revenue figure anywhere: spec §23.5 says counts only.
    assert "revenue" not in str(response.data)


@pytest.mark.django_db
def test_a_staff_admin_can_configure_and_activate_a_product(api_client, staff_admin):
    product = MarketplaceProduct.objects.get(code=ProductCode.INDIVIDUAL_LISTING_RIGHT)
    api_client.force_authenticate(user=staff_admin)

    response = api_client.patch(
        f"{LIST_URL}{product.pk}/",
        {
            "display_amount": "49.00",
            "currency": "EUR",
            "stripe_product_id": "prod_real",
            "stripe_price_id": "price_real",
            "is_active": True,
            "name_it": "Diritto",
        },
        format="json",
    )

    assert response.status_code == 200
    product.refresh_from_db()
    assert product.is_active is True
    assert product.display_amount == Decimal("49.00")
    assert product.updated_by_id == staff_admin.pk


@pytest.mark.django_db
def test_activating_an_unconfigured_product_is_a_clean_400_not_a_500(
    api_client, staff_admin
):
    """The database constraint from Task 2 must surface as a validation error,
    not as an unhandled IntegrityError."""
    product = MarketplaceProduct.objects.get(code=ProductCode.LISTING_MEDIA_UPGRADE)
    api_client.force_authenticate(user=staff_admin)

    response = api_client.patch(
        f"{LIST_URL}{product.pk}/", {"is_active": True}, format="json"
    )

    assert response.status_code == 400
    assert response.data["error"]["code"] == "validation_error"
    product.refresh_from_db()
    assert product.is_active is False


@pytest.mark.django_db
def test_the_product_code_cannot_be_changed(api_client, staff_admin):
    """Spec §23.1's catalogue is closed. `code` is read-only, so a client
    sending it is ignored rather than obeyed."""
    product = MarketplaceProduct.objects.get(code=ProductCode.LISTING_MEDIA_UPGRADE)
    api_client.force_authenticate(user=staff_admin)

    api_client.patch(
        f"{LIST_URL}{product.pk}/", {"code": "SUBSCRIPTION"}, format="json"
    )

    product.refresh_from_db()
    assert product.code == ProductCode.LISTING_MEDIA_UPGRADE


@pytest.mark.django_db
def test_operational_counters_are_read_only(api_client, staff_admin):
    product = listing_right_product()
    api_client.force_authenticate(user=staff_admin)

    response = api_client.patch(
        f"{LIST_URL}{product.pk}/",
        {"operations": {"purchases": 9999}, "price_state": "OK"},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["operations"]["purchases"] == 0


@pytest.mark.django_db
def test_neither_creating_nor_deleting_a_product_is_possible(api_client, staff_admin):
    product = listing_right_product()
    api_client.force_authenticate(user=staff_admin)

    assert api_client.post(LIST_URL, {"code": "SUBSCRIPTION"}, format="json").status_code == 405
    assert api_client.delete(f"{LIST_URL}{product.pk}/").status_code == 405


@pytest.mark.django_db
def test_every_product_change_is_audited_with_a_before_and_after(
    api_client, staff_admin
):
    """Spec §26's definition of done: "Product, policy, broker approval and
    taxonomy actions are audited"."""
    product = listing_right_product(is_active=False)
    api_client.force_authenticate(user=staff_admin)

    api_client.patch(
        f"{LIST_URL}{product.pk}/", {"is_active": True}, format="json"
    )

    event = AuditEvent.objects.get(action="product.updated")
    assert event.target_id == str(product.pk)
    assert event.actor_user_id == staff_admin.pk
    assert event.source == AuditEvent.Source.ADMIN
    assert event.before["is_active"] is False
    assert event.after["is_active"] is True


@pytest.mark.django_db
def test_deactivation_gets_its_own_audit_action(api_client, staff_admin):
    """Spec §26.4: "Deactivating a product stops new Checkout creation." It is
    the single most consequential product edit, so it is queryable on its own."""
    product = listing_right_product()
    api_client.force_authenticate(user=staff_admin)

    api_client.patch(
        f"{LIST_URL}{product.pk}/", {"is_active": False}, format="json"
    )

    assert AuditEvent.objects.filter(action="product.deactivated").count() == 1


@pytest.mark.django_db
def test_deactivating_a_product_does_not_revoke_purchased_entitlements(
    api_client, staff_admin
):
    """Spec §26.4, verbatim: deactivating "does not invalidate previously
    purchased entitlements"."""
    from entitlements.enums import EntitlementState, EntitlementType
    from entitlements.tests.factories import make_entitlement

    product = listing_right_product()
    buyer = make_payments_seller("p14-deact@example.com")
    right = make_entitlement(user=buyer, entitlement_type=EntitlementType.PAID_LISTING)
    api_client.force_authenticate(user=staff_admin)

    api_client.patch(f"{LIST_URL}{product.pk}/", {"is_active": False}, format="json")

    right.refresh_from_db()
    assert right.state == EntitlementState.AVAILABLE
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
cd backend && uv run pytest payments/tests/test_staff_products_api.py -q
```

Expected: 404s — the routes do not exist.

- [ ] **Step 3: Write the selector and the service**

`backend/payments/selectors.py`:

```python
"""Read-only aggregates for spec §23.5's staff card.

Every number is a live query, not a denormalized counter: spec §26's definition
of done requires "All visible counters equal query results", which a cached
column cannot guarantee.
"""

from dataclasses import asdict, dataclass

from django.db.models import Count, Q

from .enums import PAID_STATES, PaymentOrderStatus


@dataclass(frozen=True)
class ProductOperations:
    """Spec §23.5: "Purchases and fulfillment failures (counts, not financial
    analytics beyond product operations)." No revenue, no averages, no totals —
    deliberately."""

    purchases: int
    fulfilled: int
    fulfillment_failures: int
    open_checkouts: int

    def as_dict(self) -> dict:
        return asdict(self)


def product_operations(product) -> ProductOperations:
    counts = product.orders.aggregate(
        purchases=Count("pk", filter=Q(status__in=sorted(PAID_STATES))),
        fulfilled=Count("pk", filter=Q(status=PaymentOrderStatus.FULFILLED)),
        fulfillment_failures=Count("pk", filter=Q(status=PaymentOrderStatus.FAILED)),
        open_checkouts=Count("pk", filter=Q(status=PaymentOrderStatus.CHECKOUT_OPEN)),
    )
    return ProductOperations(**counts)
```

`backend/payments/services.py`:

```python
"""Audited product configuration (spec §23.1, §26.4)."""

from django.db import IntegrityError, transaction
from rest_framework.exceptions import ValidationError

from audit.models import AuditEvent
from audit.services import record_audit_event

EDITABLE_FIELDS = (
    "name_en", "name_it", "name_es",
    "description_en", "description_it", "description_es",
    "stripe_product_id", "stripe_price_id",
    "currency", "display_amount",
    "entitlement_valid_days", "publication_days",
    "is_active", "display_order",
)


def _snapshot(product) -> dict:
    return {
        field: str(getattr(product, field))
        if field == "display_amount"
        else getattr(product, field)
        for field in EDITABLE_FIELDS
    }


@transaction.atomic
def update_product(*, product, changes: dict, actor, request_id=None):
    """The one sanctioned way to change a MarketplaceProduct.

    `code` is never editable: spec §23.1 fixes the catalogue at two codes.
    Deactivation gets its own audit action because spec §26.4 makes it the most
    consequential edit ("stops new Checkout creation"), and staff need to find
    it without scanning every `product.updated` row.
    """
    locked = type(product).objects.select_for_update().get(pk=product.pk)
    before = _snapshot(locked)

    for field, value in changes.items():
        if field in EDITABLE_FIELDS:
            setattr(locked, field, value)
    locked.updated_by = actor if getattr(actor, "is_authenticated", False) else None

    try:
        locked.save()
    except IntegrityError as exc:
        # Task 2's payments_product_active_is_fully_configured, surfaced as a
        # clean 400 rather than a 500. A ValidationError is correct HERE (it is
        # a field-level complaint, and the envelope's `fields` map is the only
        # thing that can say WHICH field), unlike the named codes in errors.py.
        raise ValidationError(
            {
                "is_active": [
                    "A product needs an amount and both Stripe identifiers "
                    "before it can be activated."
                ]
            }
        ) from exc

    after = _snapshot(locked)
    deactivated = before["is_active"] is True and after["is_active"] is False
    record_audit_event(
        actor_user=locked.updated_by,
        actor_type=AuditEvent.ActorType.USER,
        action="product.deactivated" if deactivated else "product.updated",
        target_type="payments.MarketplaceProduct",
        target_id=str(locked.pk),
        source=AuditEvent.Source.ADMIN,
        before=before,
        after=after,
        request_id=request_id,
        metadata={"code": locked.code},
    )
    return locked
```

> **Note.** `update_product` raises a DRF `ValidationError` on purpose, and that is *not* a contradiction of Global Constraints. The rule there is that a code **a client must branch on** cannot live on a `ValidationError`. This one is the opposite case: it is a field-level complaint whose whole value is the `fields` map naming `is_active`, and the `validation_error` envelope code is exactly right for it.

- [ ] **Step 4: Append the serializers, views and routes**

Append to `backend/payments/serializers.py`:

```python
from .gateway import StripeUnavailable
from .models import MarketplaceProduct
from .products import check_stripe_price
from .selectors import product_operations


class StaffProductSerializer(serializers.ModelSerializer):
    """Every field spec §23.5's card shows, and nothing a customer may see."""

    display_amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, coerce_to_string=True, read_only=True
    )
    price_state = serializers.SerializerMethodField()
    price_reason = serializers.SerializerMethodField()
    stripe_unit_amount = serializers.SerializerMethodField()
    operations = serializers.SerializerMethodField()

    class Meta:
        model = MarketplaceProduct
        fields = (
            "id", "code",
            "name_en", "name_it", "name_es",
            "description_en", "description_it", "description_es",
            "is_active", "display_amount", "currency",
            "stripe_product_id", "stripe_price_id",
            "entitlement_valid_days", "publication_days", "display_order",
            "price_state", "price_reason", "stripe_unit_amount",
            "operations", "updated_at",
        )
        read_only_fields = fields

    def _check(self, product):
        """One Stripe call per rendered product, so only the DETAIL view asks
        for it (context flag `check_price`)."""
        if not self.context.get("check_price"):
            return None
        if "_price_check" not in self.context:
            try:
                self.context["_price_check"] = check_stripe_price(product)
            except Exception:  # PaymentGatewayUnavailable and anything below it
                self.context["_price_check"] = None
        return self.context["_price_check"]

    def get_price_state(self, product):
        if not self.context.get("check_price"):
            return "UNCHECKED"
        result = self._check(product)
        if result is None:
            return "UNAVAILABLE"
        return "OK" if result.ok else "MISMATCH"

    def get_price_reason(self, product):
        result = self._check(product)
        return "" if result is None else result.reason

    def get_stripe_unit_amount(self, product):
        result = self._check(product)
        return None if result is None else result.stripe_unit_amount

    def get_operations(self, product):
        return product_operations(product).as_dict()


class StaffProductUpdateSerializer(serializers.ModelSerializer):
    """Spec §26.4's editable set. `code` is absent by construction."""

    class Meta:
        model = MarketplaceProduct
        fields = (
            "name_en", "name_it", "name_es",
            "description_en", "description_it", "description_es",
            "stripe_product_id", "stripe_price_id",
            "currency", "display_amount",
            "entitlement_valid_days", "publication_days",
            "is_active", "display_order",
        )
```

Append to `backend/payments/views.py`:

```python
from accounts.permissions import IsStaffAdmin

from .models import MarketplaceProduct
from .serializers import StaffProductSerializer, StaffProductUpdateSerializer
from .services import update_product


class StaffProductBaseView(APIView):
    """Spec §5: "Configure products/settings" is staff-admin only, and spec §12
    is explicit that a moderator may not change payment products. Permission
    order matters (DRF stops at the first failure): authentication, then
    verified email, then the staff-admin group."""

    permission_classes = [IsActiveUser, IsEmailVerified, IsStaffAdmin]


class StaffProductListView(StaffProductBaseView):
    """GET /api/v1/staff/products/ (spec §30.1).

    No POST: spec §23.1 fixes the catalogue at exactly two codes, and a third
    product would have no code path anywhere else in the system.
    """

    http_method_names = ["get", "options"]

    def get(self, request):
        products = MarketplaceProduct.objects.all()
        return Response(
            StaffProductSerializer(
                products, many=True, context={"check_price": False}
            ).data
        )


class StaffProductDetailView(StaffProductBaseView):
    """GET/PATCH /api/v1/staff/products/<id>/ (spec §30.1, §23.5, §26.4)."""

    http_method_names = ["get", "patch", "options"]

    def get_product(self, product_id):
        return get_object_or_404(MarketplaceProduct, pk=product_id)

    def get(self, request, product_id):
        product = self.get_product(product_id)
        return Response(
            StaffProductSerializer(product, context={"check_price": True}).data
        )

    def patch(self, request, product_id):
        product = self.get_product(product_id)
        envelope = StaffProductUpdateSerializer(
            product, data=request.data, partial=True
        )
        envelope.is_valid(raise_exception=True)
        updated = update_product(
            product=product,
            changes=envelope.validated_data,
            actor=request.user,
            request_id=getattr(request, "request_id", None),
        )
        return Response(
            StaffProductSerializer(updated, context={"check_price": False}).data
        )
```

Append two routes to `backend/payments/urls.py`:

```python
    path("staff/products/", StaffProductListView.as_view(), name="staff-product-list"),
    path(
        "staff/products/<uuid:product_id>/",
        StaffProductDetailView.as_view(),
        name="staff-product-detail",
    ),
```

- [ ] **Step 5: Run the tests and confirm they pass**

```bash
cd backend && uv run pytest payments/tests/test_staff_products_api.py -q
cd backend && uv run pytest -q
```

- [ ] **Step 6: Mutation check**

1. Change `IsStaffAdmin` to `IsStaffModerator` → `test_a_staff_moderator_cannot_read_or_change_products` must fail.
2. Add `"code"` to `StaffProductUpdateSerializer.Meta.fields` → `test_the_product_code_cannot_be_changed` must fail.
3. Remove the `IntegrityError` catch in `update_product` → `test_activating_an_unconfigured_product_is_a_clean_400_not_a_500` must fail with a 500.
4. Set `context={"check_price": True}` on the list view → `test_the_list_does_not_call_stripe` must fail.
5. Let `PaymentGatewayUnavailable` propagate instead of returning `UNAVAILABLE` → `test_a_stripe_outage_is_reported_as_unavailable_not_as_a_mismatch` must fail.
6. Change `purchases` to count every order → `test_the_operations_counters_equal_real_query_results` must fail.
7. Always write `product.updated` → `test_deactivation_gets_its_own_audit_action` must fail.

Revert each.

- [ ] **Step 7: Commit**

```bash
git add backend/payments
git commit -m "feat(payments): staff product configuration API with spec 23.5 price validation state (Phase 14 Task 12)"
```

---

### Task 13: Phase acceptance tests, full regression and the handoff note

**Files:**
- Create: `backend/payments/tests/test_phase_acceptance.py`
- Modify: `ACTIVITY.md` (one appended dated section), `docs/superpowers/PHASE-TRACKER.md` (the Phase 14 row)
- Test: the file above is the test

**Interfaces:**
- Consumes: everything Tasks 1–12 produced.
- Produces: no new production code. Spec §39 requires a phase handoff note; this task writes it.

> **Note.** This task must add **zero** production code. If an acceptance test fails, that is a real defect in an earlier task and goes back as a fix on its own branch — not as a patch smuggled into the acceptance commit.

- [ ] **Step 1: Write the acceptance tests**

`backend/payments/tests/test_phase_acceptance.py`:

```python
"""Spec §23's five acceptance tests and §40 Scenario H, end to end.

Each test below names the spec sentence it discharges. Nothing here is a unit
test of an internal helper: every one drives the real HTTP surface or the real
webhook entry point.
"""

import json
from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from common.tests.stripe_helpers import generate_stripe_signature
from entitlements.enums import EntitlementSource, EntitlementState, EntitlementType
from entitlements.models import UserEntitlement
from listings.tests.factories import make_private_listing
from payments.enums import PaymentOrderStatus, ProductCode
from payments.models import PaymentOrder, ProcessedWebhookEvent
from payments.tests.factories import (
    listing_right_product,
    make_payments_seller,
    media_upgrade_product,
)
from payments.tests.fakes import FakeStripeGateway

SECRET = "whsec_phase14_acceptance"
CHECKOUT_URL = "/api/v1/checkout-sessions/"
WEBHOOK_URL = "/api/v1/stripe/webhook/"


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def gateway(monkeypatch):
    fake = FakeStripeGateway()
    monkeypatch.setattr("payments.checkout.default_gateway", lambda: fake)
    monkeypatch.setattr("payments.products.default_gateway", lambda: fake)
    return fake


@pytest.fixture
def staff_alerts():
    """`weak=False` and an explicit disconnect: a lambda or a fixture-local
    receiver connected weakly can be garbage-collected mid-test (silently empty
    list), and a receiver left connected leaks stray alerts into every later
    test in the session."""
    from payments.signals import payment_needs_staff_review

    received = []

    def on_review(sender, order, reason, detail, **kwargs):
        received.append(reason)

    payment_needs_staff_review.connect(on_review, weak=False)
    yield received
    payment_needs_staff_review.disconnect(on_review)


def buy(api_client, seller, *, product_code=ProductCode.INDIVIDUAL_LISTING_RIGHT,
        listing_id=None, key="acc-1"):
    api_client.force_authenticate(user=seller)
    body = {"product_code": product_code}
    if listing_id is not None:
        body["listing_id"] = listing_id
    return api_client.post(CHECKOUT_URL, body, format="json", HTTP_IDEMPOTENCY_KEY=key)


def deliver(api_client, order, *, event_id, amount_total=4900, currency="eur",
            listing_id=""):
    payload = {
        "id": event_id,
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": order.stripe_checkout_session_id,
                "mode": "payment",
                "payment_status": "paid",
                "amount_total": amount_total,
                "currency": currency,
                "payment_intent": "pi_acceptance",
                "client_reference_id": str(order.pk),
                "metadata": {
                    "order_id": str(order.pk),
                    "user_id": str(order.user_id),
                    "product_code": order.product.code,
                    "listing_id": listing_id,
                },
            }
        },
    }
    raw = json.dumps(payload).encode()
    return api_client.post(
        WEBHOOK_URL,
        data=raw,
        content_type="application/json",
        HTTP_STRIPE_SIGNATURE=generate_stripe_signature(raw, SECRET),
    )


@pytest.mark.django_db
def test_scenario_h_a_duplicate_webhook_produces_exactly_one_entitlement(
    api_client, settings, checkout_enabled, gateway
):
    """Spec §40 Scenario H and §23's acceptance bullet 1: "Given the blocked
    individual completes Stripe Checkout, when the verified paid event arrives
    twice, then one order becomes fulfilled and exactly one listing entitlement
    exists"."""
    settings.STRIPE_WEBHOOK_SECRET = SECRET
    listing_right_product()
    seller = make_payments_seller("p14-acc-h@example.com")

    created = buy(api_client, seller)
    assert created.status_code == 201
    order = PaymentOrder.objects.get()

    first = deliver(api_client, order, event_id="evt_acc_h")
    second = deliver(api_client, order, event_id="evt_acc_h")

    assert (first.status_code, second.status_code) == (200, 200)
    order.refresh_from_db()
    assert order.status == PaymentOrderStatus.FULFILLED
    assert PaymentOrder.objects.fulfilled().count() == 1
    assert UserEntitlement.objects.count() == 1
    right = UserEntitlement.objects.get()
    assert right.entitlement_type == EntitlementType.PAID_LISTING
    assert right.source == EntitlementSource.STRIPE_PURCHASE
    assert right.state == EntitlementState.AVAILABLE
    assert right.source_payment_id == order.pk
    assert ProcessedWebhookEvent.objects.count() == 1


@pytest.mark.django_db
def test_two_distinct_events_for_one_session_also_produce_one_entitlement(
    api_client, settings, checkout_enabled, gateway
):
    """The other half of "exactly once": Stripe can deliver two DIFFERENT event
    ids describing the same completed session, which the event-id index alone
    does not stop."""
    settings.STRIPE_WEBHOOK_SECRET = SECRET
    listing_right_product()
    seller = make_payments_seller("p14-acc-two@example.com")
    buy(api_client, seller)
    order = PaymentOrder.objects.get()

    deliver(api_client, order, event_id="evt_one")
    deliver(api_client, order, event_id="evt_two")

    assert UserEntitlement.objects.count() == 1
    assert ProcessedWebhookEvent.objects.count() == 2


@pytest.mark.django_db
def test_a_forged_signature_produces_400_and_no_state_change(
    api_client, settings, checkout_enabled, gateway
):
    """Spec §23 acceptance bullet 2."""
    settings.STRIPE_WEBHOOK_SECRET = SECRET
    listing_right_product()
    seller = make_payments_seller("p14-acc-forged@example.com")
    buy(api_client, seller)
    order = PaymentOrder.objects.get()

    raw = json.dumps(
        {
            "id": "evt_forged",
            "type": "checkout.session.completed",
            "data": {"object": {"id": order.stripe_checkout_session_id}},
        }
    ).encode()
    response = api_client.post(
        WEBHOOK_URL, data=raw, content_type="application/json",
        HTTP_STRIPE_SIGNATURE="t=1,v1=deadbeef",
    )

    assert response.status_code == 400
    order.refresh_from_db()
    assert order.status == PaymentOrderStatus.CHECKOUT_OPEN
    assert UserEntitlement.objects.count() == 0
    assert ProcessedWebhookEvent.objects.count() == 0


@pytest.mark.django_db
def test_the_browser_success_url_alone_grants_nothing(
    api_client, settings, checkout_enabled, gateway
):
    """Spec §23 acceptance bullet 3 and §23.3's "It must never grant the right
    itself". The customer returns from Stripe and polls; no webhook has arrived,
    so there is nothing to poll but the order."""
    settings.STRIPE_WEBHOOK_SECRET = SECRET
    listing_right_product()
    seller = make_payments_seller("p14-acc-success@example.com")
    buy(api_client, seller)
    order = PaymentOrder.objects.get()

    for _ in range(3):
        polled = api_client.get(f"/api/v1/payment-orders/{order.pk}/")
        assert polled.status_code == 200
        assert polled.data["status"] == PaymentOrderStatus.CHECKOUT_OPEN
        assert polled.data["entitlement_id"] is None

    assert UserEntitlement.objects.count() == 0


@pytest.mark.django_db
def test_a_currency_or_amount_mismatch_blocks_fulfilment_and_alerts_staff(
    api_client, settings, checkout_enabled, gateway, staff_alerts,
    django_capture_on_commit_callbacks,
):
    """Spec §23 acceptance bullet 4."""
    settings.STRIPE_WEBHOOK_SECRET = SECRET
    listing_right_product()
    seller = make_payments_seller("p14-acc-mismatch@example.com")
    buy(api_client, seller)
    order = PaymentOrder.objects.get()

    with django_capture_on_commit_callbacks(execute=True):
        response = deliver(api_client, order, event_id="evt_mismatch", amount_total=1)

    assert response.status_code == 200
    order.refresh_from_db()
    assert order.status == PaymentOrderStatus.FAILED
    assert order.metadata["staff_review_required"] is True
    assert order.metadata["staff_review_reason"] == "amount_mismatch"
    assert staff_alerts == ["amount_mismatch"]
    assert UserEntitlement.objects.count() == 0


@pytest.mark.django_db
def test_a_user_cannot_buy_a_media_upgrade_for_another_users_listing(
    api_client, checkout_enabled, gateway
):
    """Spec §23 acceptance bullet 5."""
    media_upgrade_product()
    owner = make_payments_seller("p14-acc-owner@example.com")
    attacker = make_payments_seller("p14-acc-attacker@example.com")
    listing = make_private_listing(owner=owner)

    response = buy(
        api_client,
        attacker,
        product_code=ProductCode.LISTING_MEDIA_UPGRADE,
        listing_id=str(listing.pk),
    )

    assert response.status_code == 409
    assert response.data["error"]["code"] == "listing_not_upgradable"
    assert PaymentOrder.objects.count() == 0
    assert UserEntitlement.objects.count() == 0


@pytest.mark.django_db
def test_with_the_flag_off_nothing_can_be_purchased(api_client, gateway):
    """Spec §35.1/§35.2 step 4: the phase ships with its flag off, and off means
    off at the API, not only in the UI."""
    listing_right_product()
    seller = make_payments_seller("p14-acc-flag@example.com")

    response = buy(api_client, seller)

    assert response.status_code == 403
    assert response.data["error"]["code"] == "feature_disabled"
    assert PaymentOrder.objects.count() == 0


@pytest.mark.django_db
def test_an_unconfigured_product_cannot_be_bought_even_with_the_flag_on(
    api_client, checkout_enabled, gateway
):
    """Spec §38: the two seeded products are "inactive until valid environment
    Stripe IDs are supplied", and inactive means unpurchasable."""
    seller = make_payments_seller("p14-acc-unconfigured@example.com")

    response = buy(api_client, seller)

    assert response.status_code == 409
    assert response.data["error"]["code"] == "product_not_available"
```

> **Note (two failure modes this file guards against, both of which produce a silently-passing test).** First, pytest-django rolls each `django_db` test's transaction back, so a `transaction.on_commit` callback never fires by itself — every assertion about `payment_fulfilled` or `payment_needs_staff_review` must happen inside `django_capture_on_commit_callbacks(execute=True)`. Second, `Signal.connect()` holds a **weak** reference by default, so a receiver defined inside a fixture (or a lambda) can be garbage-collected mid-test, leaving an empty list and a green test; `weak=False` plus an explicit `disconnect` in teardown is the pattern used here and in `test_fulfillment.py` / `test_refunds.py`. A reviewer seeing a signal assertion without both must reject it.

- [ ] **Step 2: Run the acceptance tests**

```bash
cd backend && uv run pytest payments/tests/test_phase_acceptance.py -q
```

Every one must pass with **no production change**. If one does not, stop, write down which spec sentence is not in fact satisfied, and fix the owning task on its own branch.

- [ ] **Step 3: Run the full regression and the migration check**

```bash
cd backend && uv run python manage.py check
cd backend && uv run python manage.py makemigrations --check --dry-run
cd backend && uv run pytest -q
cd ../frontend && pnpm lint && pnpm test && pnpm build
```

The frontend must be green **without a single changed file** — this phase is backend-only.

- [ ] **Step 4: Prove the two rollout invariants by hand**

```bash
cd backend
uv run python -c "
import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE','config.settings.dev'); django.setup()
from platform_settings.models import FeatureFlag
from payments.models import MarketplaceProduct
print('flag enabled:', FeatureFlag.objects.get(key='stripe_entitlement_checkout').is_enabled)
print('active products:', MarketplaceProduct.objects.active().count())
"
```

Expected: `flag enabled: False` and `active products: 0`. Both must be true on a freshly migrated database — spec §35.2 step 4 and §38.

- [ ] **Step 5: Write the handoff note**

Append to the top of `ACTIVITY.md`'s log (read the real file; append, never rewrite):

```markdown
### 2026-09-18 — Phase 14 (Stripe products, Checkout and fulfillment) complete

- Implemented `docs/superpowers/plans/2026-09-18-phase-14-stripe-products-fulfillment.md`
  in full.
- New `payments` app: spec §11.9's `MarketplaceProduct`, `PaymentOrder` and
  `ProcessedWebhookEvent`, spec §6.4's payment state machine, server-authored
  Checkout Session creation (§23.2) with a spec §30.3 `Idempotency-Key` replay
  store, the signature-verified and event-id-idempotent webhook (§23.3), refunds
  and disputes (§23.4), and the staff product configuration API (§23.5, §26.4).
- `entitlements` change, deliberately minimal: `UserEntitlement.source_payment`
  is now a real FK to `payments.PaymentOrder` (Phase 13 contract rule 6). The
  column name is unchanged, so no factory or query needed editing.
- The Stripe webhook route moved from `common.views` to `payments.views`; the
  URL `/api/v1/stripe/webhook/` and its route name are unchanged, so no Stripe
  environment needs reconfiguring.
- Security: no card data is stored anywhere; signatures are verified against the
  raw body with Stripe's 300-second tolerance; duplicate deliveries return 200
  without re-fulfilling; success/cancel URLs come from a closed allowlist of
  spec §4 paths joined to `PUBLIC_BASE_URL`; amounts come from the Stripe Price,
  never from the client; no test opens a socket.
- Rollout: `stripe_entitlement_checkout` is seeded **disabled**, and both
  products are seeded **inactive with blank Stripe ids and a zero amount**
  (spec §38). A database constraint makes an unconfigured product impossible to
  activate. Staff must supply real Stripe ids per environment (§35.2 step 5)
  before anything can be bought.
- Known limitations: no staff product SCREEN (Phase 17); no notification
  receivers — two signals are fired and nothing listens (Phase 18); a product's
  `publication_days` is not yet honoured at consumption, which still reads
  `individual.paid_publish_days` (Phase 15/16); partial refunds are flagged for
  staff, not acted on. See the plan's Known Limitations for the full list with
  owning phases.
- Next: Phase 15 (media limits, uploads and upgrade) — it is the first consumer
  of the `MEDIA_UPGRADE` entitlements this phase grants.
```

Update the Phase 14 row of `docs/superpowers/PHASE-TRACKER.md` from `idea` to the status the controller sets, with the plan filename and a one-paragraph note in the established style.

- [ ] **Step 6: Commit**

```bash
git add backend/payments/tests/test_phase_acceptance.py ACTIVITY.md docs/superpowers/PHASE-TRACKER.md
git commit -m "test(payments): spec 23 acceptance pass, Scenario H and the phase handoff note (Phase 14 Task 13)"
```

---

## Known Limitations (carried forward, not fixed by this plan)

Each item names the phase that closes it. None breaks a MUST requirement *of this phase* (spec §39: "Any known limitation that breaks a MUST requirement prevents completion") — every one is a requirement the spec itself assigns to a later phase, a transition the spec does not define, or a documented commercial decision.

1. **No staff product screen.** Spec §23.5 describes `/dashboard/staff/products/`. This phase ships every backend source that screen renders — product fields, active state, display price/currency, **Stripe Price validation state**, durations, and purchase/fulfilment-failure counts — behind `GET/PATCH /api/v1/staff/products/[<id>/]`, but no Next.js route, no navigation entry and no component. Spec §26.1 assigns staff navigation to Phase 17 and warns against scattering one workflow across dashboards. → **Phase 17** (spec §26.1, §26.4).
2. **No frontend at all.** Spec §22.3's purchase CTA ("Confirming creates a Stripe Checkout Session and redirects to Stripe"), the success page that polls `GET /api/v1/payment-orders/<id>/`, and the "Payment received; activating your right" interim state are all Next.js work against pages that do not exist. The full API contract they render from ships here. → **Phase 16** (spec §25), with §37's localization keys.
3. **No notification receivers.** `payments.signals.payment_fulfilled` and `payment_needs_staff_review` fire correctly, inside `transaction.on_commit()`, carrying everything a receiver needs — but there is no `Notification` row, no WebSocket frame and no email, so spec §23.3 step 9's "notify user and refresh WebSocket eligibility state" and §23.4's "high-priority staff notification" are half-built: the event exists, the delivery does not. There is also no `notifications` app in `INSTALLED_APPS` yet. → **Phase 18** (spec §27.1).
4. **A product's `publication_days` is not honoured at consumption.** `MarketplaceProduct.publication_days` is stored, staff-editable and returned by the staff API, but Phase 13's consumption path computes a publication window from `individual.paid_publish_days` and freezes it in `metadata["publication_days"]` at consumption time (Phase 13 contract rule 5). So editing a product's publication duration changes what staff see and nothing that happens. Both default to **30**, so no behaviour is wrong today. Fixing it means teaching `entitlements.consumption` to prefer `entitlement.source_payment.product.publication_days` when there is one — an `entitlements` change this phase deliberately does not make while Phase 13 is still landing. → **Phase 15 or 16**, whichever next touches `entitlements/consumption.py`.
5. **The purchased right's validity comes from the product, the staff-granted right's from the setting.** Two sources for one concept (`MarketplaceProduct.entitlement_valid_days` vs `individual.paid_entitlement_valid_days`), both seeded 365, reconciled by nothing. The ruling in Task 10 explains why the product wins for a purchase; a later phase may want one authority. → **Phase 17**, alongside the staff product screen.
6. **Partial refunds are flagged, not acted on.** Spec §23.4's first bullet says "revoke on confirmed **full** refund" and says nothing about partial ones, so a `charge.refunded` with `amount_refunded < amount` marks the order for staff review and leaves the entitlement intact. "Apply documented commercial policy" (§23.4 bullet 3) presumes a policy this project has not written down. → operational, or **Phase 17**'s payment-case queue.
7. **There is no staff payment-case queue.** §23.4's "mark payment case for staff review" is implemented as `PaymentOrder.metadata["staff_review_required"] = True` plus `PaymentOrder.objects.needing_staff_review()` plus an audit event plus a signal — all real and queryable — but nothing renders it and no endpoint lists it. Deliberately no fifth model: §11.9 enumerates four. → **Phase 17**.
8. **There is no staff-initiated refund action.** §23.4's last bullet ("Refund action in staff UI calls a dedicated service; do not alter Stripe state by editing database fields") describes an outbound call to Stripe that this phase does not build: everything here is **reactive**, responding to refunds an operator issued in the Stripe dashboard. The reactive half is complete and is what protects the entitlement ledger. The staff-facing action needs the screen from limitation 1. → **Phase 17**.
9. **`Idempotency-Key` is enforced on Checkout creation only.** Spec §30.3 also requires it on listing submit and staff decision requests. Those are Phase 11/13 endpoints and are untouched here, so Phase 13's Known Limitation 13 survives for them. The retention window (`IDEMPOTENCY_RETENTION_DAYS = 30`) is a documented client contract with no sweep behind it: orders are never deleted (§35.3), so a key is in practice honoured forever. → **Phase 22** if a real retention policy is wanted.
10. **Only two-decimal currencies are supported.** `payments.products.minor_units` raises `ValueError` for any currency outside `TWO_DECIMAL_CURRENCIES`. This release is EUR-only, so nothing is blocked; a zero-decimal currency (JPY) would need the factor table Stripe publishes. Refusing loudly was chosen over a silent 100× overcharge. → whichever phase adds a second currency.
11. **No reconciliation job for paid-not-fulfilled orders.** Spec §35.4 asks operators to "Verify paid orders fulfill exactly once" in the first hour/day/week. The data to do it exists (`PaymentOrder.objects.paid().exclude(status=FULFILLED)`), and the mismatch path alerts, but there is no scheduled check and no metric. This phase adds no Celery task at all, by ruling. → **Phase 22** (§33.4 metrics and alerts) and **Phase 24** (§35.4).
12. **A `CREATED` order whose Stripe call never succeeded is never cleaned up.** It is retriable with the same `Idempotency-Key` (tested), and Stripe's own `checkout.session.expired` only fires for sessions that were actually created, so a row stuck at `CREATED` stays there. It grants nothing and blocks nothing; it is noise in the staff counters' `open_checkouts`… which it is in fact excluded from, since that counts `CHECKOUT_OPEN`. → operational.
13. **Concurrency is proven by lock assertion, not by two racing connections.** `test_fulfilment_locks_the_order_row` inspects the emitted SQL for `FOR UPDATE`, and the duplicate-event path is proven by sequential delivery plus a unique index. This project deliberately avoids threaded database tests (Phase 13 Known Limitation 12). A real two-connection race against the `stripe_event_id` index would be stronger evidence. → **Phase 23** (spec §34.2).
14. **No CSP work.** Spec §33.1 asks for "Content Security Policy compatible with Stripe". No CSP exists in this project yet and none is added here; since this phase ships no frontend and redirects the browser to Stripe's own domain rather than embedding Stripe.js, there is nothing here for a CSP to allow. `STRIPE_PUBLISHABLE_KEY` is read into settings and used by nothing, which stays true until a frontend needs it. → **Phase 22**.
15. **`ProcessedWebhookEvent` grows without bound.** One row per delivered event, never pruned. At this project's volume that is negligible for years, and pruning is dangerous: deleting a row re-opens the replay window for that event id. If it ever matters, prune only rows older than Stripe's own retry horizon. → operational, **Phase 22**.

---

## Contract summary for later phases

Everything a downstream phase imports from Phase 14, in one place.

```python
from payments.checkout import (
    DEFAULT_RETURN_URL,
    RETURN_URL_ALLOWLIST,
    UPGRADABLE_LISTING_STATES,
    CheckoutResult,
    assert_listing_is_upgradable,
    build_return_urls,
    create_checkout_session,
)
from payments.enums import (
    IDEMPOTENCY_RETENTION_DAYS,
    LISTING_BOUND_PRODUCTS,
    PAID_STATES,
    PAYMENT_TRANSITIONS,
    PRODUCT_CODES,
    PRODUCT_ENTITLEMENT_TYPES,
    STRIPE_CHECKOUT_FLAG,
    STRIPE_SIGNATURE_TOLERANCE_SECONDS,
    TERMINAL_PAYMENT_STATES,
    PaymentOrderStatus,
    ProductCode,
    WebhookResult,
    can_transition_payment,
)
from payments.errors import (
    IdempotencyKeyRequired,
    IdempotencyKeyReused,
    InvalidReturnUrl,
    ListingNotUpgradable,
    ListingRequiredForProduct,
    PaymentGatewayUnavailable,
    ProductNotAvailable,
    ProductPriceMismatch,
)
from payments.fulfillment import (
    flag_for_staff,
    grant_purchased_entitlement,
    order_not_found,
    record_payment_audit,
    verify_session_against_order,
)
from payments.gateway import (
    CheckoutSessionResult,
    PriceSnapshot,
    StripeApiGateway,
    StripeGateway,
    StripeUnavailable,
    default_gateway,
)
from payments.models import (
    MarketplaceProduct,
    MarketplaceProductQuerySet,
    PaymentOrder,
    PaymentOrderQuerySet,
    ProcessedWebhookEvent,
)
from payments.products import (
    TWO_DECIMAL_CURRENCIES,
    PriceCheck,
    check_stripe_price,
    from_minor_units,
    get_purchasable_product,
    minor_units,
    require_reconciled_price,
)
from payments.refunds import revoke_for_refund
from payments.selectors import ProductOperations, product_operations
from payments.services import EDITABLE_FIELDS, update_product
from payments.signals import payment_fulfilled, payment_needs_staff_review
from payments.webhooks import (
    HANDLERS,
    DuplicateWebhookEvent,
    InvalidWebhookPayload,
    InvalidWebhookSignature,
    payload_checksum,
    process_stripe_event,
    verify_stripe_event,
)
```

**Endpoints shipped by this phase**, against spec §30.1's literal inventory:

| Method | Endpoint | §30.1 |
|---|---|---|
| POST | `/api/v1/checkout-sessions/` | listed ("create Stripe Checkout") |
| GET | `/api/v1/payment-orders/<id>/` | listed ("poll fulfillment state") |
| POST | `/api/v1/stripe/webhook/` | listed ("verified Stripe events") — **moved**, not added: the URL and route name are unchanged from Phase 0/1 |
| GET | `/api/v1/staff/products/` | listed ("product configuration") |
| GET, PATCH | `/api/v1/staff/products/<id>/` | listed (same row) |

No other route is added and no existing route's URL, method or success shape changes.

**Deliberate, accepted deviations from Phase 13's contract** (recorded here so a later reader does not mistake either for a silent break):

- **Phase 13 contract rule 6 said the purchased right's `valid_until` is `now + individual.paid_entitlement_valid_days`.** This phase uses `now + product.entitlement_valid_days` instead. Spec §11.9 gives the product that column and §23.1 lets staff edit it; a per-product duration the purchase path ignored would be decorative, which spec §2.1 forbids. Both are seeded 365 today, so no behaviour differs. See Known Limitation 5.
- **Phase 13 contract rule 1 said never to write a `UserEntitlement` outside `entitlements.consumption`/`entitlements.services`.** `payments.fulfillment.grant_purchased_entitlement` CREATES a row directly. The rule governs **transitions**; creation is not one, and `grant_listing_right` hard-codes `STAFF_GRANT`/`granted_by`/`reason`, none of which describes a purchase. Every transition away from the row (revocation on refund) does go through `entitlements.services`. See the ruling in the Scope rulings section.
- **Phase 13 contract rule 6 called this phase "the natural first producer of `RESERVED` rows".** It produces none — a paid right is `AVAILABLE` immediately — so Phase 13's Known Limitation 3 obligation ("must also ship the abandonment-release flow, or leave `listing` NULL") does not bite here and passes intact to **Phase 15**.

Rules a later phase must follow:

1. **Only a verified webhook may grant a paid entitlement.** Never call `grant_purchased_entitlement` from a view, a management command or a success-page handler. Spec §23.3 is explicit that the browser "must never grant the right itself", and `PaymentOrderDetailView` is deliberately `GET`-only with no import of `payments.fulfillment` — a test asserts both.
2. **Never write `PaymentOrder.status` directly.** Go through `payments.fulfillment` or `payments.refunds`, which hold the row lock, the `can_transition_payment` edge check and the audit event together. The Django admin for `PaymentOrder` is read-only for exactly this reason, and spec §26.3 backs it: "Staff must not edit Stripe-paid order status manually."
3. **`payments` may import `entitlements` and `listings`; neither may import `payments`.** The one exception is `entitlements.models`' lazy string FK `"payments.PaymentOrder"`, which creates no import edge. Keeping the arrow one-directional is what lets this app depend on both without a cycle.
4. **Every new Stripe call goes through `payments.gateway.StripeGateway`.** Add a method to the protocol, to `StripeApiGateway` and to `FakeStripeGateway` together — `test_the_fake_and_the_real_gateway_have_identical_signatures` fails if you do not. Never call `stripe.*` from a service, never set the module-level `stripe.api_key`, and never let a `stripe.StripeError` escape the gateway.
5. **Every new webhook event type is registered in `payments.webhooks.HANDLERS`** by a module imported from `PaymentsConfig.ready()`, and its handler returns a `WebhookResult` value. An unregistered type is recorded `IGNORED` and answered 200 — never 500, which would make Stripe retry it for days.
6. **A permanent failure answers Stripe 200; a transient one answers 500.** A mismatch, an unknown session or an unhandled type is a fact no retry can change, so it is recorded, alerted and acknowledged. A database failure propagates, which rolls the `ProcessedWebhookEvent` row back so Stripe's retry can succeed. Do not "helpfully" catch a broad `Exception` in a handler.
7. **A return URL is a PATH from `RETURN_URL_ALLOWLIST`, never a caller-supplied absolute URL.** Adding a member requires a spec §4.1/§4.2 citation. Never change the check to a prefix match, a host comparison or a regex.
8. **Phase 15** is the first consumer of `MEDIA_UPGRADE`. It changes exactly one function body, `listings.policies.effective_media_allowance`, to raise a private seller's allowance to 20 images and 1 video (spec §23.1, §24.1) when a non-`REVOKED` `MEDIA_UPGRADE` `UserEntitlement` exists for that listing. It must **not** consult `PaymentOrder` — the entitlement is the right, the order is only how it was bought. It is also the first phase that may create a `RESERVED` row, and Phase 13's Known Limitation 3 obligation transfers to it. If it wants a product's `publication_days` honoured, it owns Known Limitation 4.
9. **Phase 16** renders spec §22.3's purchase CTA against `POST /api/v1/checkout-sessions/` and the success page against `GET /api/v1/payment-orders/<id>/`. It must send an `Idempotency-Key` header (a UUID minted per CTA click, reused verbatim on retry), must send a `return_url` that is a member of `RETURN_URL_ALLOWLIST`, must never send an amount or a price id, and must treat `entitlement_id == null` as "still activating" rather than as failure. It must not grant, unlock or enable anything based on the success URL alone.
10. **Phase 17** builds the staff product screen on `GET/PATCH /api/v1/staff/products/[<id>/]` and must not add a second product-write path. The detail endpoint's `price_state` is live I/O — render it per product, not per list. It also owns the payment-case queue (`PaymentOrder.objects.needing_staff_review()`), the staff-initiated refund service, and the `product.*` audit actions' history view.
11. **Phase 18** connects receivers to `payments.signals.payment_fulfilled` (spec §23.3 step 9: notify the buyer, refresh WebSocket eligibility) and `payment_needs_staff_review` (spec §23.4: high-priority staff notification). Both already fire inside `transaction.on_commit()`, so a receiver must not re-wrap them; `payment_needs_staff_review` may carry `order=None` when no local order matched the event, and a receiver must tolerate that.
12. **Any new payment error code must be stable and documented** in this plan's Global Constraints table, and must be an `APIException` subclass with an explicit `default_code` — never a DRF `ValidationError`, which `common.exceptions` flattens to `validation_error`. Exceptions needing extra response context set a dict attribute named `meta` (the merged handler's only passthrough). The closed set today is: `product_not_available`, `product_price_mismatch`, `invalid_return_url`, `listing_required_for_product`, `listing_not_upgradable`, `idempotency_key_required`, `idempotency_key_reused`, `payment_gateway_unavailable`, plus the reused `feature_disabled`.
13. **Never store card data, and never log a secret.** No model in `payments` has a card field and a test enforces it. `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, the raw webhook body and the `Stripe-Signature` header never reach a log, a response body or an audit event. The webhook's 400 has no body on purpose.
14. **Deactivating a product stops new Checkout creation and nothing else** (spec §26.4). Previously purchased entitlements keep working; a phase that "cleans up" entitlements for a deactivated product is breaking a spec sentence and a paid customer's rights.

---

## Self-Review

**1. Spec coverage — §23 (Phase 14), line by line:**

| Spec §23 requirement | Where implemented |
|---|---|
| §23.1 Exactly two product codes in this release | Task 1 (`ProductCode`, `PRODUCT_CODES`), Task 2 (`payments_product_code_is_known` CHECK + its negative test) |
| §23.1 `INDIVIDUAL_LISTING_RIGHT` grants one paid listing entitlement, one-time | Task 1 (`PRODUCT_ENTITLEMENT_TYPES`), Task 10 (`grant_purchased_entitlement`), Task 6 (`recurring` drift blocks checkout) |
| §23.1 Default entitlement validity 365 days from purchase | Task 2 (seed), Task 10 (`valid_until = now + product.entitlement_valid_days`, with the documented deviation) |
| §23.1 Default publication 30 days | Task 2 (seed) — **stored and staff-editable, but not yet honoured at consumption**: Known Limitation 4 |
| §23.1 `LISTING_MEDIA_UPGRADE` bound to one eligible private-seller listing | Task 7 (`assert_listing_is_upgradable`), Task 10 (`listing=order.listing` on the granted row) |
| §23.1 Raises allowance to 20 images and 1 video | **Phase 15** (spec §24.1/§24.4) — this phase grants the entitlement, Contract summary rule 8 |
| §23.1 Cannot be transferred after binding | Task 10, proved by Phase 13's merged `entitlements_one_live_right_per_listing_and_type` partial unique index, tested from both directions |
| §23.1 Staff may edit copy, active state, Stripe ids and durations | Task 12 (`StaffProductUpdateSerializer`, `update_product`), Task 2 (admin) |
| §23.1 Staff enters no card data / does not mark a redirect as paid | Task 3 (read-only `PaymentOrderAdmin`), Tasks 2/3 (`test_no_card_data_field_exists_*`) |
| §23.2 Authentication and verified email required | Task 8 (`IsActiveUser`, `IsEmailVerified`, order pinned by tests) |
| §23.2 Media upgrade requires a private listing owned by the user, not already upgraded | Task 7, five named tests including the acceptance case |
| §23.2 Product must be active | Task 6 (`get_purchasable_product`), Task 7 |
| §23.2 Server loads Stripe Price; client cannot submit amount/currency | Task 7 (`line_items` by price id), Task 8 (three-field `Serializer` drops unknown keys), both tested |
| §23.2 Idempotency key derived from order UUID and operation | Task 3 (`idempotency_key unique`), Task 7 (`f"checkout:{order.pk}"`, reused on retry) |
| §23.2 Create local `PaymentOrder` before Stripe session | Task 7, tested including the Stripe-failure path |
| §23.2 Internal identifiers in Stripe metadata, not personal content | Task 7, tested (`customer_email` explicitly not set) |
| §23.2 Success/cancel URLs are allowlisted local routes | Task 7 (`RETURN_URL_ALLOWLIST`, 17 hostile inputs tested) |
| §23.3 step 1 Read raw body | Task 9 (`request.body` before any `request.data`), tested with bytes that survive no re-serialization |
| §23.3 step 2 Verify signature with the environment secret | Task 9 (`verify_stripe_event`, real HMAC scheme, forged/wrong-secret/substituted/stale all tested) |
| §23.3 step 3 Insert `ProcessedWebhookEvent`; duplicate returns 200 without re-fulfilment | Task 3 (unique index), Task 9 (`process_stripe_event`, one transaction) |
| §23.3 step 4 Lock `PaymentOrder` | Task 10 (`select_for_update`), asserted against the emitted SQL |
| §23.3 step 5 Verify user, product, amount, currency, mode, payment status | Task 10 (`verify_session_against_order`, one test per field) |
| §23.3 step 6 Mark paid and create exactly one entitlement | Task 10, plus Task 13's Scenario H and the two-distinct-event-ids case |
| §23.3 step 7 Link entitlement and mark fulfilled | Task 10, enforced by `payments_order_fulfilled_requires_entitlement_and_stamp` |
| §23.3 step 8 Commit | Task 9's single `transaction.atomic()` |
| §23.3 step 9 After commit, notify user and refresh WebSocket state | Task 7/10 (`payment_fulfilled` in `on_commit`); receivers are **Phase 18** (Known Limitation 3) |
| §23.3 Success page polls and never grants | Task 8 (`PaymentOrderDetailView`, GET-only, structural assertions), Task 13 |
| §23.4 Unused entitlement revoked on confirmed full refund | Task 11 (`revoke_for_refund`) |
| §23.4 Reserved entitlement released then revoked | Task 11 — **assumes Phase 13's `release_reservation`**; nothing in this phase produces a `RESERVED` row |
| §23.4 Consumed/published: no silent unpublish, staff case, notify | Task 11, with the listing's status explicitly asserted unchanged |
| §23.4 Chargebacks create high-priority staff notification and audit event | Task 11 (`handle_dispute_created`) |
| §23.4 Staff refund action calls a dedicated service, not field edits | Partly: the read-only admin enforces the prohibition; the staff *action* is **Phase 17** (Known Limitation 8) |
| §23.5 Card shows name/code/active/price/currency/Stripe validation/durations/counts | Task 12 (`StaffProductSerializer`), field-set asserted exactly |
| §23.5 Every card field is backend-backed | Task 12 (`product_operations` is a live aggregate, not a counter column) |
| §23.5 Warning on display-amount drift; Checkout blocked until reconciled | Task 6 (`check_stripe_price` / `require_reconciled_price`), Task 7, Task 12 |
| §23.5 Edit and deactivate actions | Task 12 (`PATCH`, `product.deactivated` audit action) |
| §23.5 The screen itself | **Phase 17** (Known Limitation 1) |
| Acceptance — duplicate webhook produces one entitlement | Task 13 (both senses: same event id, and two event ids for one session) |
| Acceptance — forged/invalid signature produces 400 and no state change | Task 13, Task 9 |
| Acceptance — browser success URL alone grants nothing | Task 13, Task 8 |
| Acceptance — currency/amount mismatch blocks fulfilment and alerts staff | Task 13, Task 10 |
| Acceptance — user cannot buy a media upgrade for another user's listing | Task 13, Task 7 |

**2. Cross-referenced sections.** §6.4's five state lines → Task 1 (`PAYMENT_TRANSITIONS`, with both readings documented) and Task 10/11's guards. §11.9's `MarketplaceProduct` field list → Task 2 (all sixteen, asserted by name); its `PaymentOrder` list → Task 3 (all thirteen, plus `listing`, `client_idempotency_key` and `metadata` by documented ruling); its `ProcessedWebhookEvent` list → Task 3 (all five). §5's "Configure products/settings" staff-admin row and §12's moderator prohibition → Task 12. §12 item 3's verified email → Task 8. §30.1's five endpoint rows → Tasks 8, 9, 12 (table above). §30.2's envelope, decimal-string money and `X-Request-ID` → Tasks 5, 8, 12. §30.3's `Idempotency-Key` → Tasks 3, 7, 8 (Checkout creation only; Known Limitation 9). §30.4's "Checkout creation" rate limit → Task 8 (`checkout_create` scope; the webhook deliberately unthrottled). §31's "Product card/price → `MarketplaceProduct` + verified Stripe price → Checkout Session → unavailable/mismatch warning" → Tasks 6, 7, 12. §32.1 step 8 and §38's "Two product records, inactive until valid environment Stripe IDs are supplied" → Task 2's seed **and** its `payments_product_active_is_fully_configured` constraint. §33.1's raw-body verification, return-URL allowlist and IDOR rules → Tasks 7, 8, 9. §33.2's data minimization → Tasks 7, 10 (no `customer_email` sent, no session object copied into an audit row). §35.1's `stripe_entitlement_checkout` → Tasks 1, 2 (seeded disabled), 8 (the gate), and the webhook exemption ruling. §35.2 steps 4, 5 and 10 → the flag and product seeds. §35.3's "Do not roll back a fulfilled Stripe entitlement by deleting it" → `PROTECT` on `fulfilled_entitlement` and `source_payment`, tested. §35.4's "Verify paid orders fulfill exactly once" → the data exists; the scheduled check is Known Limitation 11. §36.3's "One paid listing right covers one listing publication cycle" → unchanged from Phase 13; this phase grants the right and never consumes it. §40 Scenario H → Task 13. §41's two Stripe references → Tasks 9 and 10 follow both.

**3. Gaps deliberately left, with the owning phase named:** §23.5's screen and §23.4's staff refund action (Phase 17), §22.3's CTA and success page (Phase 16), §23.1's media allowance behaviour (Phase 15), §23.3 step 9's actual notification delivery (Phase 18), §33.1's CSP (Phase 22), and everything in Known Limitations. No spec §23 requirement is unaccounted for.

**4. Placeholder scan.** No task contains "TBD", "implement later", "add appropriate error handling", "write tests for the above" or "similar to Task N"; every code step carries the real code, and every test asserts a specific value rather than a tolerated range of them. Two vacuous-test traps specific to this phase are called out where they bite and guarded in the fixtures: `transaction.on_commit` callbacks do not fire under pytest-django's rolled-back transaction (so every signal assertion runs inside `django_capture_on_commit_callbacks`), and `Signal.connect()` is weak by default (so every test receiver uses `weak=False` with an explicit teardown `disconnect`). Task 10's mutation checks 9 and 10 exist to prove both guards are live.

**5. Type consistency.** `WebhookResult` values are used as handler return types throughout Tasks 9–11 and stored in the `result` column whose CHECK lists the same closed set. `PriceCheck` is constructed in exactly one function (`check_stripe_price`) and read in three places with the same field names. `CheckoutResult.created` drives the 201-vs-200 split in Task 8 and is set in both branches of Task 7. `record_payment_audit` / `flag_for_staff` / `order_not_found` are defined in Task 10 under leading-underscore names and **renamed in Task 11 Step 3 before they are imported** — that rename is the one cross-task signature change in this plan and it is spelled out, with the `kind=` generalization, rather than left to be discovered. `grant_purchased_entitlement` uses `source_payment=order`, which is the FK name Task 4 creates, while the test factories keep using `source_payment_id=` — both valid, and Task 4 has a test proving it.

**6. Task sizing.** Thirteen tasks. The three largest (7, 10, 12) each carry one coherent deliverable with its own review gate: a reviewer can reject the checkout service while approving the models beneath it, or reject the staff API while approving fulfilment. Tasks 1–4 are deliberately small because they are schema, and a schema mistake is the most expensive kind to discover late. Task 4 is separated from Task 3 despite being one field, because it touches an app another phase is actively landing and needs its own reconciliation check and its own revert boundary.
