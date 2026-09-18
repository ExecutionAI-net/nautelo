# NAUTA Phase 6 — Shared Inquiry Form and Messaging Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the one shared inquiry pipeline spec §15 mandates — a single `InquiryForm` React component and a single backend `submit_inquiry()` service that handle boat, broker and professional contexts identically; the `Conversation` / `Message` / `ContactAccessGrant` models of spec §11.8; the atomic §15.3 submission transaction (conversation → message → grant → notification → post-commit email); the guest draft-and-return flow of §15.2; and the inbox/thread/reply API of §30.1.

**Architecture:** Two new Django apps, both named by spec §3's own app list. `messaging` owns the conversation store, the context resolver, the inquiry transaction and every messaging endpoint. `notifications` owns spec §11.10's `Notification`/`NotificationDelivery` rows plus the email delivery task, and is imported by `messaging` one-directionally (`messaging` → `notifications`; `notifications` imports neither `messaging` nor `listings`). The recipient of an inquiry is **always** derived on the server from the context object's ownership — a client never names a recipient (spec §11.8, §33.1's IDOR rule). No already-merged app is modified: `listings/`, `platform_settings/`, `common/throttling.py`, `brokers/models.py` and `professionals/` are read-only to this plan, which matters because Phases 9, 10, 12 and 13 are in flight against exactly those files. The frontend adds one component, one API module, one message dictionary and one draft-storage helper, and mounts the component at the `PHASE 6 SEAM` comment Phase 5 left behind.

**Tech Stack:** Python 3.13 + `uv`, Django 5.2 LTS, Django REST Framework, PostgreSQL 16 (partial unique indexes and check constraints do the real work), Redis (cache + DRF throttle counters + Celery broker), Celery (`notifications` queue), `django.core.signing` for the guest draft token; **Next.js 16.3.5** (App Router, TypeScript), **Tailwind CSS v4**, `pnpm`, Vitest + Testing Library. No new third-party dependencies in either project.

**Version-drift check (before writing any App Router code):** the frontend is Next.js **16.3.5** with Tailwind **v4**, not the 15.x a model's training data assumes — `frontend/AGENTS.md` flags this. `params`/`searchParams` are **Promises** and every page awaits them. Verify any App Router API against `frontend/node_modules/next/dist/docs/` rather than from memory.

**Spec:** [`NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md`](../../../NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md) — primarily **§15 (Phase 6)**, plus §11.8 (messaging and contact-access data model), §11.10 (notification data model), §1 (fixed decisions: one shared form, inquiry authentication, contact reveal), §2.1–§2.5 (backend source, server authority, atomicity, auditability), §5 (who may submit an inquiry and who may reveal contact), §14.2 (the professional detail page this form mounts on), §16 (Phase 7, the consumer of the grants this phase writes), §27.1/§27.3 (the `inquiry.received` event and its email rules), §28 (Phase 19's broker inbox, which reuses this store), §30.1/§30.2/§30.3/§30.4 (endpoint inventory, error envelope, idempotency, rate limits), §31 (UI-to-backend traceability — three of its rows are this phase's), §33.1/§33.2/§33.5 (security, privacy, logging), §34.1–§34.5 (test classes), §35.1 (`unified_inquiries` flag), §36.6 (contact access and abuse edge cases), §37 (localization keys), §39 (developer execution protocol), §40 Scenarios A and B.

**Predecessor plans (read before starting):**
- [`2026-09-17-phase-3-identity-organizations-permissions.md`](./2026-09-17-phase-3-identity-organizations-permissions.md) — **hard dependency, fully merged.** Supplies `User`, `User.is_email_verified`, `IsActiveUser`/`IsEmailVerified`, `accounts.services.can_read_broker_messages`, `active_broker_membership`, `BrokerOrganization`/`BrokerMembership`, `ProfessionalProfile`, `HashedIPScopedRateThrottle` and `nauta_exception_handler`. Its contract rules 1, 2, 4, 5, 8 and 9 are binding here. Rule 4 names `CanReadBrokerMessages` for message access — see the ruling below for why this phase calls the service function underneath it instead.
- [`2026-09-18-phase-5-directory-consolidation.md`](./2026-09-18-phase-5-directory-consolidation.md) — **hard dependency, fully merged.** Its contract rule 2 reserves the mount point this phase uses (`PHASE 6 SEAM` in the professional detail page) and rule 1 forbids widening the directory serializers with contact fields. Its `DIRECTORY_MESSAGES`/`Locale` pattern is the template for this phase's message dictionary.
- [`2026-09-18-phase-11-listing-workflow.md`](./2026-09-18-phase-11-listing-workflow.md) — supplies `listings.views.published_listings_queryset()`, which is the **only** definition of "a listing a stranger may inquire about" (its contract rule 1). This plan reads it and modifies nothing in `listings/`.
- [`2026-09-18-phase-10-listing-analytics.md`](./2026-09-18-phase-10-listing-analytics.md) and [`2026-09-18-services-directory-throttle-ip-forwarding.md`](./2026-09-18-services-directory-throttle-ip-forwarding.md) — **merged**, and load-bearing here. Between them they produced `backend/common/ip.py` (`get_client_ip`, honouring `X-Internal-Client-IP` only behind a matching `X-Internal-Service-Secret`) and `frontend/src/lib/api/internal-headers.ts` + `directoryFetch`'s forwarding. `fetchInquiryConfig` goes through `directoryFetch` for exactly that reason (Task 11).
- [`2026-09-17-phase-2-shared-types-platform-settings.md`](./2026-09-17-phase-2-shared-types-platform-settings.md) — `common.models.UUIDTimeStampedModel`, `audit.services.record_audit_event()`, `platform_settings.services.is_feature_enabled()`/`set_feature_flag()` and the in-consuming-app feature-flag seed-migration pattern.
- [`2026-09-18-phase-13-quota-entitlement.md`](./2026-09-18-phase-13-quota-entitlement.md) — not a dependency, but read its Global Constraints note on `ValidationError`: **every** DRF `ValidationError` collapses to `code: "validation_error"` in this project's envelope, so a field-level error code never reaches the wire. This plan depends on that fact and says where.

**Phase dependencies:** spec §7 and `docs/superpowers/PHASE-TRACKER.md` — Phase 6 depends on Phase 3 (identity) and Phase 5 (directory), both `done`. Phases **7** (contact privacy and reveal), **18** (WebSocket/email/in-app notifications) and **19** (broker dashboard messaging) depend on *this* phase; their surfaces appear here only as documented seams, and the "Contract summary for later phases" section at the end is written for them.

## Execution Model

Per the standing project convention recorded in `ACTIVITY.md`: each task is implemented on its own branch off the current tip of `dev` (`git checkout -b task-N-<slug> dev`), run through `subagent-driven-development`'s implementer → task-reviewer → fix-loop cycle, opened as a PR (`gh pr create`), and merged by the controller only when CI is green and the branch is cleanly mergeable. **Tasks run strictly sequentially — never two branches in flight at once** — and each new task branches from the just-merged `dev` tip. This includes Task 1, the scaffolding task: `ACTIVITY.md`'s Log shows one PR per task for every prior phase with no exception for scaffolding.

**One worktree per task.** The controller creates the task's worktree with `superpowers:using-git-worktrees` (`git worktree add ../nautelo-worktree-task-N -b task-N-<slug> dev`), copies `backend/.env` and `frontend/.env.local` into it, and removes it after the PR merges. `backend/config/settings/test.py` derives the test database name from `sha1(BASE_DIR)[:10]`, so two worktrees never share a test database — that is exactly why the per-task worktree is safe to run tests in.

**CI gates (`.github/workflows/ci.yml`, both jobs must be green before merge):**
- `backend`: `uv sync` → `docker compose up -d --wait minio` + `createbuckets` → `uv run python manage.py check` → `uv run pytest -v` against **PostgreSQL 16 and Redis 7 service containers**.
- `frontend`: `pnpm install --frozen-lockfile` → `pnpm lint` → `pnpm test` → `pnpm build`.

A task whose final step does not show that command's real output is not finished (`superpowers:verification-before-completion`).

---

## Global Constraints

Exact values copied from the spec. Every task's requirements implicitly include this section.

- **One component, one service.** Spec §15.1: the component is equivalent to `InquiryForm` and there are **no** broker-, professional- or listing-specific copies. Spec §39: "Do not … Add a separate inquiry form for a new context." Spec §15's definition of done: "One backend service handles all types." This plan ships exactly one React component and exactly one `messaging.services.submit_inquiry()`.
- **Field rules, verbatim from spec §15.1** (all enforced on the server, mirrored in the client for usability only, per §2.2):

  | Field | Rule |
  |---|---|
  | Full name | Required; prefilled from profile; **2–120** characters |
  | Email | Required; **verified account email**; displayed read-only |
  | Phone | Optional; E.164-compatible |
  | Subject | Context-derived default, editable; **3–150** characters |
  | Message | Required; **20–4000** characters |
  | Privacy consent | Required checkbox with **versioned** policy reference |
  | Marketing consent | Optional, separate, unchecked; **never required** for inquiry |
  | Context | Hidden/server-derived entity/listing, **never trusted from arbitrary client data** |

- **Honeypot, rate limiting and abuse detection are required** (spec §15.1). "CAPTCHA may be introduced only behind a risk threshold, not as a default barrier" — no CAPTCHA is shipped.
- **Inquiry authentication:** a **verified-email user account** is required to submit (spec §1, §5, §12 item 3). Guests may type; on submit the draft is preserved and authentication opens. **"Do not send an inquiry automatically after login"** (spec §15.2) — after returning, the user must press Send again.
- **Submission transaction (spec §15.3), in this order, inside one `transaction.atomic()`:** 1. validate user, recipient status, context and rate limit; 2. get-or-create an open conversation for the chosen policy; 3. save the message and sender email snapshot; 4. create the contact access grant if none exists; 5. create the recipient in-app notification; 6. register post-commit jobs. **`201 Created` is returned only after the database transaction succeeds.**
- **Enum values are copied verbatim from spec §11.8/§11.10 and must never be renamed** (they are persisted and returned in API responses): `conversation_type` ∈ `LISTING_INQUIRY | BROKER_INQUIRY | PROFESSIONAL_INQUIRY | SUPPORT`; conversation `status` ∈ `OPEN | ARCHIVED | BLOCKED`; grant `target_type` ∈ `BROKER | PROFESSIONAL`; delivery `channel` ∈ `IN_APP | WEBSOCKET | EMAIL`; delivery `status` ∈ `QUEUED | SENT | FAILED | SKIPPED`.
- **Request `context_type` values** are spec §15.5's literals: `LISTING | BROKER | PROFESSIONAL`. They are the API's vocabulary and are mapped to `conversation_type` by the resolver; they are **not** the same strings.
- **Error codes added by this phase (closed set).** Spec §15.5's list is reproduced exactly, plus two documented additions. Per Phase 11's contract rule 10, every one is stable and documented here:

  | Code | HTTP | Raised by |
  |---|---|---|
  | `authentication_required` | 401 | anonymous caller on any messaging endpoint except draft-create |
  | `email_verification_required` | 403 | authenticated but unverified caller |
  | `feature_disabled` | 403 | `unified_inquiries` flag off |
  | `invalid_context` | 400 | unknown `context_type`, malformed or unresolvable `context_id` |
  | `recipient_unavailable` | 409 | context resolves but its owner is SUSPENDED/DRAFT/PENDING, or the listing is not publicly visible |
  | `consent_required` | 400 | privacy consent missing or a stale `privacy_policy_version` |
  | `rate_limited` | 429 | DRF throttle, or the duplicate-message guard |
  | `self_inquiry_not_allowed` | 400 | **addition** — the sender owns the context (see ruling) |
  | `spam_detected` | 400 | **addition** — the honeypot field was filled (see ruling) |
  | `conversation_closed` | 409 | **addition** — replying to an ARCHIVED or BLOCKED thread (spec §36.6) |
  | `invalid_draft` | 400 | **addition** — a guest draft token that is not ours or has been altered (spec §15.2) |
  | `draft_expired` | 400 | **addition** — a guest draft token older than 30 minutes (spec §15.2's "short-lived") |
  | `not_found` | 404 | a conversation the caller may not see — deliberately not 403 (spec §33.1's IDOR rule) |
  | `validation_error` | 400 | any DRF field error; the per-field detail lives in `error.fields` |

- **`validation_error` is the only code a field error can produce.** `common.exceptions.nauta_exception_handler` maps **every** `ValidationError` — subclass or not — to `code: "validation_error"` with `fields` built by `_field_map`, which flattens each item with `str()`. `str(ErrorDetail)` is the **message**, never the code. So a wire-level test asserts `response.data["error"]["fields"]["email"] == ["<message>"]`; an assertion looking for a field-level code string in the JSON body will always fail. Every code in the table above that must surface as `error.code` is therefore an `APIException` subclass with a `default_code`, **not** a `ValidationError`.
- **Error envelope:** spec §30.2, produced by `common.exceptions.nauta_exception_handler`. `rate_limited` additionally carries `error.meta = {"retry_after_seconds": <int>}` through the handler's existing `meta` passthrough, alongside DRF's own `Retry-After` header (spec §30.4: "Return 429 with retry information").
- **Feature flag for this phase:** `unified_inquiries` (spec §35.1), seeded **enabled**, mirroring Phase 5's `combined_services_professionals` rather than Phase 11's disabled `listing_revisions` — see the ruling. Flag off ⇒ every messaging endpoint returns `403 feature_disabled` **and** the form is not rendered, so §35.1's "do not leave an enabled API behind a disabled UI" holds in both directions. **One deliberate carve-out:** `GET /api/v1/inquiries/config/` still answers `200` with `{"enabled": false}`, because it *is* the mechanism that tells the page not to render the form — a `403` there would leave the server component unable to tell "switched off" from "API broken", and both would then have to fail the same way. It is the only messaging endpoint without `UnifiedInquiriesEnabled`; it exposes no user data and performs no mutation.
- **Privacy policy version:** `"2026-09"` (spec §15.5's literal). A submission carrying any other value is refused with `consent_required`. It is a module constant, not a platform setting — see the ruling.
- **Rate limits (spec §30.4).** New `DEFAULT_THROTTLE_RATES` scopes added by this plan, all served by the already-installed `common.throttling.HashedIPScopedRateThrottle`; views declare **only** `throttle_scope`, never `throttle_classes` (Phase 3 contract rule 9):
  - `inquiry_submit` = **`20/hour`**
  - `message_send` = **`60/hour`**
  - `messaging_read` = **`120/min`**
  - `inquiry_draft` = **`30/hour`**
  Plus an in-transaction duplicate guard: the same sender posting a body with the same `normalize_comparison_text()` value into the same conversation within **300 seconds** is refused with `rate_limited`.
- **Supported interface languages are exactly English (`en`), Italian (`it`) and Spanish (`es`)** (spec §0). Every new UI string has all three (spec §37), and backend notification/email content uses translation keys and structured parameters, **not concatenated English strings** (spec §37's closing line).
- **§37 keys this phase owns:** `inquiry.email`, `inquiry.send`, `inquiry.sent` (named in §37's minimum list), plus the `inquiry.*` and `notification.inquiry_received.*` keys enumerated in the Contract summary.
- **Privacy (spec §33.2, §33.5):** consent and its version are recorded on the message. Never log message bodies, and never put a recipient's hidden contact details in an email to the sender (spec §15.4). The email a recipient receives contains a **safe excerpt** and a platform link, never the recipient's own private data restated back.
- **Auditability (spec §2.4):** a contact reveal is one of the five explicitly audited categories. `contact_access.granted` and `inquiry.submitted` audit events are written via `audit.services.record_audit_event()` from *inside* the same `transaction.atomic()` block as the change.
- Backend: Python 3.13 + `uv`, Django 5.2 LTS, DRF for all JSON APIs, PostgreSQL 16 and Redis via the existing `docker-compose.yml` (Postgres `127.0.0.1:5433`, Redis `127.0.0.1:6380`, MinIO `127.0.0.1:9010`). Backend dev server port is **8020**; frontend dev server port is **3020**.
- **Tests run against PostgreSQL, never SQLite.** `backend/config/settings/test.py` MUST NOT be modified to override `DATABASES` or `CACHES` to SQLite / `LocMemCache`. This rule was violated and reverted once already in this project — if a test is slow or awkward against real Postgres/Redis, fix the test, never the settings.
- All primary keys are UUIDs; all timestamps are timezone-aware UTC (spec §11 preamble). Every new model inherits `common.models.UUIDTimeStampedModel` (Phase 3 contract rule 2).
- User references use `settings.AUTH_USER_MODEL` in model fields and `django.contrib.auth.get_user_model()` in code/tests — never a hardcoded `"accounts.User"` string (Phase 3 contract rule 1).
- **No business rule lives only in a view** (spec §3's closing paragraph). Every rule here is a service function called by the view, the admin and any future task alike.
- No partial or visual-only implementations, no faked/hardcoded demo data, no TODO placeholders for backend enforcement (spec §39).
- TDD per task: write the failing test, run it and see it fail, write the minimal implementation, run it and see it pass, commit.
- **Where a task says "append to" an existing module, its code block repeats the imports that block needs.** Consolidate them into the module's single import section at the top rather than leaving mid-file `import` statements — `messaging/models.py`, `serializers.py`, `views.py`, `urls.py` and `services.py` each grow across several tasks.
- **Every settings and urls edit in this plan is additive.** `backend/config/settings/base.py` and `backend/config/urls.py` already carry merged entries from Phases 0/1, 2, 3, 4, 5, 8 and 11. Read the real file, add to it, never paste over it.
- **Test fixture hygiene — the real seeded/default values, verified against merged code.** These already exist and a new fixture that reuses them will collide on a unique constraint or silently match a row it did not create:
  - `accounts.tests.factories.make_user` defaults to `email="user@example.com"`; `DEFAULT_TEST_PASSWORD = "n4uta-test-Passw0rd"`.
  - `brokers.tests.factories.make_broker` defaults to `slug="blue-marine-brokers"`, `public_email="office@blue-marine.example"` — **`slug` is unique**, so two calls in one test need explicit distinct slugs.
  - `professionals.tests.factories.make_professional` defaults to `slug="marine-survey-co"`, `public_email="hello@marine-survey.example"`; `owner_user` is a **OneToOneField**, so one profile per user.
  - `services_catalog` migration `0002` seeds **six real** `ServiceCategory` slugs: `full-brokerage`, `legal`, `insurance`, `engines-maintenance`, `transport-delivery`, `nautical-marketing`. Test categories append `-test`.
  - Feature flags already in the database after `migrate`: `combined_services_professionals` (enabled), `listing_revisions` (disabled).
  - `listings.tests.factories.make_brand` defaults to `name="Beneteau"` and `BoatBrand.normalized_name` is unique — two calls with the same name in one test collide.
  - Every messaging fixture in this plan therefore uses `messaging-…` / `phase6-…` prefixed slugs and `@phase6.example` emails.

---

## Cross-phase collision notice (read this first)

Phases **9, 10, 12 and 13** are actively landing against `backend/listings/`, `backend/platform_settings/`, `backend/finance/` and `backend/common/`. Some of their work is **already merged into `dev`** and this plan is written against that merged state, not against the state those plans described:

- **`entitlements` is a real installed app**, sitting between `"listings"` and `"platform_settings"` in `INSTALLED_APPS` (`backend/config/settings/base.py`). Task 1's edit appends after it.
- **`backend/common/ip.py` exists** (Phase 10 Task 1) and `common/throttling.py` now delegates its identity resolution to `common.ip.get_client_ip()`, which honours `X-Internal-Client-IP` when `X-Internal-Service-Secret` matches. `fetchInquiryConfig` relies on this; see Known Limitation 14.
- **`frontend/src/lib/api/internal-headers.ts` exists** and `directoryFetch` already forwards both headers (PR #103).
- **`listings/publication.py`** (Phase 12 Task 1), `finance/listing_quotes.py` and `finance/migrations/0003`, `platform_settings/migrations/0005` are merged.

Migrations are still landing in those apps, so **generate this phase's migrations against the tree you are on, and read the real latest migration name before writing a `dependencies` entry.** This plan's two hand-written dependencies are on `("platform_settings", "0004_featureflag")` — the migration that creates the `FeatureFlag` model. That is deliberately the *earliest* node that provides what the migration needs rather than the current tip: migrations form a DAG, so depending on `0004` stays correct however far `platform_settings` advances, and it cannot conflict with another phase appending `0006`.

**This plan touches no file under `listings/`, `platform_settings/`, `common/`, `brokers/`, `professionals/` or `accounts/`.** Its complete footprint in already-merged code is four files, every edit append-only:

| Already-merged file | This plan's change | Task | Overlap risk |
|---|---|---|---|
| `backend/config/settings/base.py` | Append `"messaging",` and `"notifications",` to `INSTALLED_APPS`; append four keys to `REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]`; append one entry to `CELERY_TASK_ROUTES`. **Nothing is reordered, reformatted or removed.** | 1, 4, 7, 8, 10 | The tracker's "Known cross-phase risk" names this file. Expect a trivial rebase, not a conflict, as long as each phase only appends. |
| `backend/config/urls.py` | Append one line: `path("api/v1/", include("messaging.urls"))`. | 7 | Same. Phase 12 deliberately avoids this file; Phases 9/10/13 each add one `include`. |
| `frontend/src/app/services/professionals/[slug]/page.tsx` | Replace the `PHASE 6 SEAM` comment block with the `<InquiryForm …>` mount Phase 5's contract rule 2 reserves for it. The `PHASE 7 SEAM` comment is **left untouched**. | 13 | None — no other in-flight phase touches the directory pages. |
| `ACTIVITY.md`, `docs/superpowers/PHASE-TRACKER.md` | Handoff note and status row. | 15 | Append-only; every phase does this. |

**Files this plan explicitly does not open:** anything under `backend/listings/`, `backend/platform_settings/` (including `registry.py`), `backend/common/` (including `throttling.py`, `exceptions.py` and `models.py`), `backend/brokers/`, `backend/professionals/`, `backend/accounts/` and `backend/conftest.py`. Where a spec requirement seemed to need one of these, the ruling below says what was done instead.

**Phase 7 is being planned concurrently** and will consume this phase's Contract summary. Every name in that section is fixed on this plan's authority: `ContactAccessGrant`, its field names, `ContactTargetType`, `messaging.selectors.active_contact_grant()` and `messaging.services.grant_contact_access()` will not be renamed by a later task in this plan.

---

## Scope rulings

Where spec §15 is silent, ambiguous or in tension with another section, the ruling is made once here so no task has to guess.

**Note (ruling — two new apps, `messaging` and `notifications`, both named by spec §3).**
Spec §3's suggested app list contains `messaging` and `notifications` as separate entries, exactly as it contained `services_catalog` (which Phase 5 created rather than growing `professionals`) and `entitlements` (which Phase 13 creates rather than growing `listings`). Three further reasons:
1. **Spec §11.8 groups `Conversation`, `Message` and `ContactAccessGrant` under one heading**, "Messaging and contact access". All three change together and are read together; files that change together live together.
2. **One-directional dependencies, no cycles.** `messaging` imports `accounts`, `brokers`, `professionals`, `listings`, `audit`, `platform_settings`, `common` and `notifications`. `notifications` imports only `accounts`, `audit` and `common` — it has **no** import of `messaging` or `listings`, so Phase 18 can grow it without reaching back into this phase. Nothing imports `messaging`.
3. **Putting conversations inside `accounts` or `brokers` would be wrong twice over:** a conversation belongs to neither party exclusively, and spec §28 is explicit that broker messages must not become "a second broker-only messaging store."

**Note (ruling — `ContactAccessGrant` is written here and read by Phase 7).**
Spec §11.8 files the grant under *messaging*, and spec §15.3 step 4 makes creating it part of *this* phase's transaction: "Create contact access grant if none exists." Spec §16 (Phase 7) owns everything on the read side — the masked `contact` payload, `GET /api/v1/contacts/<target-type>/<id>/`, the blur UI, staff revocation and the suspended-entity rule. So the split is: **Phase 6 owns the model, the constraint, `grant_contact_access()` and `active_contact_grant()`; Phase 7 owns masking, the endpoint, the UI and revocation.** This phase deliberately ships **no** contact-reading endpoint and adds **no** contact field to any serializer, so Phase 5's contract rule 1 continues to hold: no raw contact string reaches any response this phase produces. The one thing the inquiry response says about contact is the enum `"contact_access": "GRANTED"` — an authorization outcome, not a value.

**Note (ruling — `messaging` calls `accounts.services.can_read_broker_messages()`, not the `CanReadBrokerMessages` permission class.)**
Phase 3's contract rule 4 says "For *message* access use `CanReadBrokerMessages`". Read the real class (`backend/accounts/permissions.py`): it is a **view-level** permission that reads `view.kwargs["broker_id"]`, which exists on `brokers/urls.py`'s `brokers/<uuid:broker_id>/…` routes. This phase's routes are addressed by **conversation id** (`/api/v1/conversations/<id>/…`) and by nothing at all (`/api/v1/conversations/`), because spec §30.1 names them that way and because the broker is a *property of the resolved conversation*, not a URL segment. Mounting the class would silently pass for every request (`view.kwargs.get("broker_id")` is `None` → `active_broker_membership(user, None)` returns `None` → `False`; it would silently *fail* for every request, which is worse). This plan therefore calls the function the class delegates to — `accounts.services.can_read_broker_messages(user, broker_id)` — from `messaging.selectors`, preserving rule 4's actual intent (gate on `can_read_messages`, never on `can_edit_listings`) with the correct binding. `accounts/permissions.py` is not modified. Recorded in the Contract summary so Phase 19 does not re-litigate it.

**Note (ruling — the recipient is resolved from the context, never accepted from the client).**
Spec §11.8: "A listing inquiry may derive its recipient from listing ownership; clients may not choose an arbitrary recipient ID." Spec §33.1: "Avoid IDOR by never trusting recipient/owner IDs from client without context resolution." Spec §15.1: context is "Hidden/server-derived entity/listing, never trusted from arbitrary client data." So the request body carries exactly two context fields — `context_type` and `context_id` — and `messaging.context.resolve_inquiry_context()` turns them into the recipient. A broker-owned listing inquiry sets both `listing` **and** `broker` on the conversation, because the broker is who receives it; a private-seller listing inquiry sets `listing` only and creates **no** grant, because §11.8's `target_type` is `BROKER | PROFESSIONAL` and a private seller is neither.

**Note (ruling — visibility of the context is the gate, and `published_listings_queryset()` is its only definition for listings).**
Phase 11's contract rule 1 forbids re-deriving "publicly visible". A `LISTING` context that is not in `listings.views.published_listings_queryset()` is `recipient_unavailable`, full stop — including the owner's own pending draft. A `BROKER` context whose organization is not `ACTIVE`, and a `PROFESSIONAL` context whose profile is not `ACTIVE`, are likewise `recipient_unavailable`. A syntactically valid UUID that matches nothing is **also** `recipient_unavailable`, not `invalid_context` and not `404`: distinguishing "exists but you may not reach it" from "does not exist" is an enumeration oracle over private listings, and spec §34.3 requires that a "pending listing is absent publicly". `invalid_context` is reserved for a malformed request — an unknown `context_type` or a `context_id` that is not a UUID.

**Note (ruling — `self_inquiry_not_allowed` is an addition to spec §15.5's error list).**
§15.5 says error codes "include" its list, so the list is open, and Phase 11's rule 10 requires any addition to be documented. A user cannot usefully inquire to themselves, and allowing it would let anyone mint a `ContactAccessGrant` over their own organization and, more importantly, create real conversations and notifications out of nothing. The rule covers all three contexts: the listing's `owner_user`, any **active member** of the owning/target broker, and the professional profile's `owner_user`. It is checked in `resolve_inquiry_context()`, so every caller inherits it. Returning `recipient_unavailable` instead would be a lie about why.

**Note (ruling — `spam_detected` is a visible code, not a fake success).**
Spec §15.1 requires a honeypot. The usual trick is to return a fake success so the bot learns nothing. That is exactly the "faked state" spec §2.1 and §39 forbid, it cannot be asserted from the client side, and it would make the frontend show `inquiry.sent` for a message that does not exist. So a filled honeypot returns `400 spam_detected` with no database writes, plus a `logger.warning` carrying the request id and **no** message body (spec §33.5). The tradeoff — a determined bot learns the field name — is accepted and written down rather than traded for a dishonest response. The field is named `company_website` and is rendered off-screen with `aria-hidden` and `tabIndex={-1}` so no assistive technology ever offers it.

**Note (ruling — the guest draft is a server-signed token the browser holds, not server-side anonymous session state).**
Spec §15.2 requires the draft to live in "a short-lived signed session". This backend is **headless and JWT-based**: the access token lives in memory and the refresh token in an HttpOnly cookie (`backend/accounts/cookies.py`), and there is no Django session for an anonymous API caller — `SessionMiddleware` is installed for the admin, not for the API. Inventing anonymous server-side session rows would add a table, a sweeper and a cookie that nothing else in the project uses. Instead `POST /api/v1/inquiry-drafts/` returns a `django.core.signing.dumps()` token over the **non-sensitive** fields only (`context_type`, `context_id`, `full_name`, `phone`, `subject`, `message`), the browser keeps it in `sessionStorage`, and `POST /api/v1/inquiry-drafts/resolve/` — which requires a verified account — exchanges it back with `max_age=1800`. This satisfies both halves of §15.2's phrase literally: **signed** (tamper-evident, server-keyed) and **short-lived** (a hard 30-minute TTL the client cannot extend). What is deliberately **not** in the token: the email address (it always comes from the authenticated account), either consent checkbox (consent must be given by the person who is actually sending, after they see the recipient again), and anything that could authorize an action on its own — the token is data restored into a form, and the Send button still runs the full `POST /api/v1/inquiries/` path.

**Note (ruling — the privacy policy version is a module constant, not a platform setting).**
`backend/platform_settings/registry.py`'s `SettingValueType` has exactly three members — `BOOLEAN`, `INTEGER`, `DECIMAL`. **There is no string setting type**, so `"2026-09"` cannot be stored in the typed registry without extending its type system, and `registry.py` is one of the files Phases 9 and 13 are in flight against. The version is therefore `messaging.enums.CURRENT_PRIVACY_POLICY_VERSION = "2026-09"` — spec §15.5's own literal — with its own test, following Phase 13's precedent for `EXPIRY_REMINDER_DAYS`. Recorded in Known Limitations for whoever next opens the registry. The same reasoning covers the four length limits and the duplicate-message window: they are named module constants, served to the client by `GET /api/v1/inquiries/config/` so the form never hard-codes a number the server does not also enforce (spec §2.1, §2.2).

**Note (ruling — broker inquiry email goes to `BrokerOrganization.public_email`; in-app visibility goes to every member with `can_read_messages`).**
Spec §15.4: "team members with `can_read_messages` receive in-app visibility. Email goes to the broker's configured notification recipients, not every member by default." The in-app half is implemented exactly as written. For the email half, the real `BrokerOrganization` (verified: `backend/brokers/models.py`) has **no** notification-recipient field, and spec §11.1's field list for it has none either. Adding one would mean a migration on `brokers/models.py` plus a screen to manage it — and there is no broker settings screen in this repository (Phase 19 builds the broker dashboard; Phase 12's staff broker screen is planned but unmerged). Inventing a column no UI can set is the "invented operational data" §2.1 forbids. So the one **configured** organization-level address that already exists is used: `public_email`. It is set by staff, it is one address rather than every member, and mailing it exposes nothing to the sender. Recorded in Known Limitations and assigned to Phase 19 (or Phase 12's staff broker screen) to replace with a real recipient list when a screen exists to manage one. The same rule gives `ProfessionalProfile.public_email` for professional inquiries, and `BoatListing.owner_user.email` for private-seller listing inquiries (a private seller has no business address — the account email is the only address there is).

**Note (ruling — this phase builds the `Notification`/`NotificationDelivery` models and the email channel; Phase 18 builds the WebSocket channel and the notification REST API).**
Spec §15.3 steps 5 and 6 put "Create recipient in-app notification" and "Register post-commit jobs for WebSocket and email" *inside this phase's transaction*, and spec §31's traceability matrix lists "message + grant + notification" as the mutation behind the inquiry forms. So the in-app row and the email job are this phase's. The **WebSocket** half is not, and building it here would mean building most of §27.2 — the authenticated `/ws/notifications/` endpoint, the opaque server-derived group naming, the Redis channel layer wiring and the staff-group authorization tests — with no `GET /api/v1/notifications/` to reconnect against, which §27.2 explicitly requires ("On connect/reconnect, client fetches unread notifications over REST"); that endpoint is §30.1's and Phase 18's. What this phase ships instead is the exact seam Phase 18 attaches to: `messaging.signals.inquiry_received`, emitted inside `transaction.on_commit()` with the notification ids, mirroring Phase 11's contract rule 8 ("Phase 18 connects receivers to `listings.signals`"). No `WEBSOCKET` delivery row is written here — a `QUEUED` row for a channel nothing drains would be a fabricated state. Recorded in Known Limitations.

**Note (ruling — the `unified_inquiries` flag is seeded enabled, and gates both surfaces).**
Phase 11 and Phase 13 seed their flags **disabled** because they gate *refusal* of an existing working flow. This flag gates an entirely new capability that nothing depends on yet, exactly like Phase 5's `combined_services_professionals`, which is seeded **enabled**. A disabled flag would ship a professional detail page that renders no inquiry form, which is the state Phase 5 already shipped and this phase exists to end. Gate behaviour: `403 feature_disabled` from every messaging endpoint (the `listings.permissions.ListingWorkflowEnabled` pattern, not `services_catalog`'s 404 — these are private API surfaces, not public pages whose existence is itself a signal), and `GET /api/v1/inquiries/config/` reports `enabled: false` so the server component omits the form entirely. That is §35.1's "flags gate both frontend exposure and backend mutation" satisfied in one round trip the form already has to make.

**Note (ruling — spec §34.5's browser end-to-end suite is Phase 23's, and this phase covers its scenario 1 at two lower levels).**
Spec §34.5 scenario 1 is this phase's journey almost word for word: *"Guest opens professional, sees locked contact, fills form, authenticates, confirms send, sees contact unlock."* Two things make it not a deliverable here. First, §34.5 sits inside **§34, "Phase 23 — Test strategy and release acceptance"**, alongside the visual-regression and accessibility suites, and its ten scenarios span nine different phases — building one of them alone would mean standing up a browser harness for a tenth of a suite. Second, **there is no browser-test harness in this repository at all**: `frontend/package.json`'s dev dependencies are Vitest, jsdom and Testing Library, with no Playwright, Cypress or WebDriver, and `pnpm test` is `vitest run`. Adding one is a tooling decision with CI-runtime consequences that belongs to the phase that owns the suite.
What this phase does instead is cover the same journey at the two levels it *can* prove, so Phase 23 inherits a working path rather than a hypothesis: **Task 12** drives guest → fill → save draft → redirect to `/login/?next=…` → return → restore → *confirm* Send as component tests with real user events, and **Task 14** proves the server half end to end over HTTP (Scenario A). The one step neither covers is scenario 1's last clause, "sees contact unlock" — that is Phase 7's panel, which does not exist. Recorded in Known Limitations.

**Note (ruling — spec §15.1's phone "country selector" is not built; the field takes E.164 directly).**
§15.1 asks for "E.164-compatible input and country selector". The input is built and validated (`E164_PATTERN`, server-side, in Task 7). The *selector* is not, for the reason §2.1 gives: a country/dial-code picker needs a list of countries and calling codes, and this project has no such table, no staff screen to curate one, and no other consumer for it — so the list would be invented data hard-coded into a component. It is also a presentation affordance, not a rule: the field accepts and the server enforces exactly the same values with or without it. The form ships a `type="tel"` input, an `autoComplete="tel"` hint and a localized format example (`inquiry.phone_hint`). Recorded in Known Limitations for Phase 20, which owns the public UI polish and is where a shared country dataset would first pay for itself.

**Note (ruling — the messages *pages* are seams; this phase ships their backend and one mount point).**
`frontend/src/app/` today contains `403`, `health`, `login`, `verify-email`, `page.tsx`, `sitemap.ts`, `professionals/profile/` (a redirect route) and the three `services/` routes. **There is no `/boats/`, no `/brokers/`, no `/dashboard/` and no `/messages/` route.** So of §15.4's four recipient inboxes and §15's four inquiry locations, exactly **one** page exists to mount on: the professional detail page, at the `PHASE 6 SEAM` Phase 5 reserved. This plan mounts `InquiryForm` there, and ships the complete backend for all four contexts plus the inbox/thread/reply API those pages will read. Building `/boats/<slug>/`, `/brokers/<slug>/`, `/dashboard/broker/messages/` or `/messages/` here would mean inventing pages Phases 19 and 20 own (spec §28, §29) and rebuilding them when those phases land. The component is written context-agnostic and takes `context={{ type, id, label }}`, so those phases mount the *same* component with no change to it — which is what §15's definition of done ("All inquiry locations render the same component/version") actually asks for. Recorded in Known Limitations.

**Note (ruling — `next_url` returns spec §15.5's literal path even though the page does not exist yet, and the form does not navigate to it).**
Spec §15.5's success body names `/dashboard/messages/<conversation-id>/`. Spec §4.2's private-route table instead lists `/messages/` for both private sellers and brokers, and spec §28 names `/dashboard/broker/messages/` for the broker inbox. **The spec disagrees with itself here.** The API returns §15.5's literal, because it is the only fully written example and because a machine-readable field should match the document that defines its shape; it is produced from one module constant, `messaging.enums.SENDER_CONVERSATION_URL_TEMPLATE`, so the phase that builds the page changes one line. The **form** does not navigate there: it shows the `inquiry.sent` confirmation in place, because auto-navigating to a 404 would be worse than not navigating. Both halves are recorded in Known Limitations and in the Contract summary for Phase 19.

**Note (ruling — spec §30.3's `Idempotency-Key` does not apply to inquiry submission).**
§30.3 requires an idempotency key for "Checkout creation, listing submit and staff decision requests". Inquiry submission is not in that list, and it has a stronger, structural guard: the conversation is `get_or_create`d under a partial unique index, so a double submit adds a second *message to the same thread* rather than a second conversation or a second grant — which is the correct behaviour for a message, not an error to suppress. The duplicate-body guard (same normalized body, same conversation, within 300 s) catches the actual double-click case and answers `rate_limited`. Spec §16's acceptance test — "A successful transaction creates exactly one grant despite concurrent duplicate requests" — is proved by the grant's own partial unique index and a real two-thread test (Task 14), not by an idempotency cache.

**Note (ruling — five columns beyond spec §11.8's field lists).**
They are `Conversation.subject`, `Message.sender_name_snapshot`, `Message.sender_phone_snapshot`, `Message.privacy_policy_version` and `Message.marketing_consent`. Spec §15.1 makes Subject a **required**, validated, 3–150-character field and Full name a **required**, validated, 2–120-character field, makes Phone an accepted optional one, and makes privacy consent (with a **version**) required and marketing consent separately optional — but §11.8's `Conversation` and `Message` field lists have nowhere to put any of them. Validating a required field and then discarding it would make the field decorative, which §2.1 forbids; the recipient would receive a message with no subject line and no sender name; and spec §33.2's "Obtain required consent/version on inquiry" is not satisfiable by a version that is checked and thrown away — a versioned consent is a record or it is nothing. `subject` goes on `Conversation` (it is the thread's subject; a reply inherits it, and §28's thread view needs it); the other four go on `Message` beside the `sender_email_snapshot` §11.8 already defines, for exactly the same reason that field exists — they are what the sender stated *at send time*, not a live join to a profile or policy that may since have changed. This mirrors Phase 11 adding `origin`/`version` to `ListingRevision` and Phase 13 adding `granted_by` to `UserEntitlement`, and is recorded here rather than presented as spec-literal.

**Note (ruling — `Message.is_system` ships with no producer.)**
§11.8 defines `is_system`. This phase writes only sender messages, so every row it creates has `is_system=False`, and the grant rule — "created atomically after the first valid **non-system** inquiry message" (§11.8) — is implemented against the flag rather than assuming it. The column and its filter exist because Phase 7 ("contact unlocked" thread notes) and Phase 19 are the natural first producers, exactly as Phase 13 shipped the `RESERVED` entitlement state with no producer. This is stated so a reviewer does not read the absence as an oversight.

**Note (ruling — one `read_at` per message means "read by the recipient side", not per team member.)**
§11.8 puts a single nullable `read_at` on `Message`. For a broker with several `can_read_messages` team members that models "someone on the recipient side has read this", not "this member has read this", so §28's per-member unread badge will be per-organization, not per-person. Modelling per-member read state would mean a `MessageRead` join table §11.8 does not define, on this plan's own authority, for a screen that does not exist yet. Shipped as §11.8 specifies; recorded in Known Limitations for Phase 19 to revisit with a real screen in front of it.

---

## File Structure

```
nautelo/
├── ACTIVITY.md                                                    (modify: Task 15)
├── docs/superpowers/
│   ├── PHASE-TRACKER.md                                           (modify: Task 15)
│   └── plans/2026-09-18-phase-6-inquiry-messaging.md              (this file)
├── backend/
│   ├── config/
│   │   ├── settings/base.py    (modify: Task 1 + Task 4 INSTALLED_APPS;
│   │   │                        Task 4 CELERY_TASK_ROUTES; Tasks 7, 8, 10
│   │   │                        throttle rates — every edit append-only)
│   │   └── urls.py             (modify: Task 7 — one include)
│   ├── notifications/
│   │   ├── __init__.py, apps.py, enums.py, models.py, services.py,
│   │   │   tasks.py, admin.py                                     (new: Task 4)
│   │   ├── migrations/__init__.py, 0001_initial.py                (new: Task 4)
│   │   └── tests/
│   │       ├── __init__.py, factories.py                          (new: Task 4)
│   │       ├── test_notification_models.py                        (new: Task 4)
│   │       └── test_notification_email.py                         (new: Task 4)
│   └── messaging/
│       ├── __init__.py, apps.py                                   (new: Task 1)
│       ├── enums.py                                               (new: Task 1)
│       ├── models.py                                              (new: Task 2; extended Task 3)
│       ├── admin.py                                               (new: Task 2; extended Task 3)
│       ├── context.py                                             (new: Task 5)
│       ├── selectors.py                                           (new: Task 5; extended Tasks 9, 10)
│       ├── exceptions.py                                          (new: Task 5; extended Tasks 6, 7, 8, 10)
│       ├── permissions.py                                         (new: Task 6)
│       ├── signals.py                                             (new: Task 6)
│       ├── services.py                                            (new: Task 6; refactored + extended Task 10)
│       ├── serializers.py                                         (new: Task 7; extended Tasks 8, 9, 10)
│       ├── drafts.py                                              (new: Task 8)
│       ├── views.py                                               (new: Task 7; extended Tasks 8, 9, 10)
│       ├── urls.py                                                (new: Task 7; extended Tasks 8, 9, 10)
│       ├── pagination.py                                          (new: Task 9; extended Task 10)
│       ├── migrations/
│       │   ├── __init__.py                                        (new: Task 1)
│       │   ├── 0001_conversation.py                               (generated: Task 2)
│       │   ├── 0002_seed_unified_inquiries_flag.py                (hand-written: Task 2)
│       │   └── 0003_message_contactaccessgrant.py                 (generated: Task 3)
│       └── tests/
│           ├── __init__.py, conftest.py, factories.py             (new: Task 2)
│           ├── test_enums.py                                      (new: Task 1)
│           ├── test_conversation_model.py                         (new: Task 2)
│           ├── test_message_and_grant_models.py                   (new: Task 3)
│           ├── test_context_resolution.py                         (new: Task 5)
│           ├── test_submit_inquiry.py                             (new: Task 6)
│           ├── test_inquiry_api.py                                (new: Task 7)
│           ├── test_inquiry_drafts_api.py                         (new: Task 8)
│           ├── test_conversation_list_api.py                      (new: Task 9)
│           ├── test_conversation_thread_api.py                    (new: Task 10)
│           ├── test_phase_6_acceptance.py                         (new: Task 14)
│           └── test_concurrency.py                                (new: Task 14 — the
│                                                                   ONE module carrying
│                                                                   transaction=True)
└── frontend/
    ├── src/lib/api/inquiries.ts                                   (new: Task 11)
    ├── src/lib/api/inquiries.test.ts                              (new: Task 11)
    ├── src/lib/i18n/inquiry.ts                                    (new: Task 11)
    ├── src/lib/i18n/inquiry.test.ts                               (new: Task 11)
    ├── src/lib/inquiry/draft-storage.ts                           (new: Task 11)
    ├── src/lib/inquiry/draft-storage.test.ts                      (new: Task 11)
    ├── src/components/inquiry/InquiryForm.tsx                     (new: Task 12)
    ├── src/components/inquiry/InquiryForm.test.tsx                (new: Task 12)
    └── src/app/services/professionals/[slug]/page.tsx             (modify: Task 13 — the PHASE 6 SEAM)
```

Auto-generated migration filenames are whatever `makemigrations` produces; each task says to run it and commit the result. The hand-written migration's filename is exact.

---

### Task 1: Scaffold the `messaging` app and its vocabulary

**Files:**
- Create: `backend/messaging/__init__.py`, `backend/messaging/apps.py`, `backend/messaging/enums.py`, `backend/messaging/migrations/__init__.py`, `backend/messaging/tests/__init__.py`
- Modify: `backend/config/settings/base.py`
- Test: `backend/messaging/tests/test_enums.py`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `messaging.enums.ConversationType` — `TextChoices`: `LISTING_INQUIRY`, `BROKER_INQUIRY`, `PROFESSIONAL_INQUIRY`, `SUPPORT`
  - `messaging.enums.ConversationStatus` — `TextChoices`: `OPEN`, `ARCHIVED`, `BLOCKED`
  - `messaging.enums.ContactTargetType` — `TextChoices`: `BROKER`, `PROFESSIONAL`
  - `messaging.enums.InquiryContextType` — `TextChoices`: `LISTING`, `BROKER`, `PROFESSIONAL`
  - `messaging.enums.ContactAccessOutcome` — plain class with `GRANTED`, `NOT_APPLICABLE`, `ALL: frozenset[str]`
  - `messaging.enums.CONTEXT_TO_CONVERSATION_TYPE: dict[str, str]`
  - `messaging.enums.UNIFIED_INQUIRIES_FLAG: str = "unified_inquiries"`
  - `messaging.enums.CURRENT_PRIVACY_POLICY_VERSION: str = "2026-09"`
  - `messaging.enums.FULL_NAME_MIN_LENGTH` / `FULL_NAME_MAX_LENGTH` / `SUBJECT_MIN_LENGTH` / `SUBJECT_MAX_LENGTH` / `MESSAGE_MIN_LENGTH` / `MESSAGE_MAX_LENGTH`: `int`
  - `messaging.enums.DUPLICATE_MESSAGE_WINDOW_SECONDS: int = 300`
  - `messaging.enums.DRAFT_TOKEN_MAX_AGE_SECONDS: int = 1800`, `messaging.enums.DRAFT_TOKEN_SALT: str`
  - `messaging.enums.HONEYPOT_FIELD_NAME: str = "company_website"`
  - `messaging.enums.SENDER_CONVERSATION_URL_TEMPLATE: str`, `messaging.enums.conversation_url(conversation_id) -> str`

- [ ] **Step 1: Create the app package by hand (not `startapp`)**

`django-admin startapp` writes five boilerplate modules this app does not want in this shape, and Phase 5 had to delete them. Create the files directly:

```bash
mkdir -p backend/messaging/migrations backend/messaging/tests
touch backend/messaging/__init__.py
touch backend/messaging/migrations/__init__.py
touch backend/messaging/tests/__init__.py
```

`backend/messaging/apps.py`:

```python
from django.apps import AppConfig


class MessagingConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "messaging"
```

- [ ] **Step 2: Write the failing test**

`backend/messaging/tests/test_enums.py`:

```python
"""Spec 11.8 and 15 vocabulary. These values are persisted and returned in API
responses, so the assertions below pin the literal strings, not just the member
names."""

import pytest

from messaging.enums import (
    CONTEXT_TO_CONVERSATION_TYPE,
    CURRENT_PRIVACY_POLICY_VERSION,
    DRAFT_TOKEN_MAX_AGE_SECONDS,
    DUPLICATE_MESSAGE_WINDOW_SECONDS,
    FULL_NAME_MAX_LENGTH,
    FULL_NAME_MIN_LENGTH,
    HONEYPOT_FIELD_NAME,
    MESSAGE_MAX_LENGTH,
    MESSAGE_MIN_LENGTH,
    PHONE_MAX_LENGTH,
    SUBJECT_MAX_LENGTH,
    SUBJECT_MIN_LENGTH,
    UNIFIED_INQUIRIES_FLAG,
    ContactAccessOutcome,
    ContactTargetType,
    ConversationStatus,
    ConversationType,
    InquiryContextType,
    conversation_url,
)


def test_conversation_type_values_match_spec_11_8():
    assert [choice.value for choice in ConversationType] == [
        "LISTING_INQUIRY",
        "BROKER_INQUIRY",
        "PROFESSIONAL_INQUIRY",
        "SUPPORT",
    ]


def test_conversation_status_values_match_spec_11_8():
    assert [choice.value for choice in ConversationStatus] == [
        "OPEN",
        "ARCHIVED",
        "BLOCKED",
    ]


def test_contact_target_type_values_match_spec_11_8():
    assert [choice.value for choice in ContactTargetType] == ["BROKER", "PROFESSIONAL"]


def test_request_context_vocabulary_matches_spec_15_5():
    assert [choice.value for choice in InquiryContextType] == [
        "LISTING",
        "BROKER",
        "PROFESSIONAL",
    ]


def test_every_request_context_maps_to_a_conversation_type():
    assert CONTEXT_TO_CONVERSATION_TYPE == {
        "LISTING": ConversationType.LISTING_INQUIRY,
        "BROKER": ConversationType.BROKER_INQUIRY,
        "PROFESSIONAL": ConversationType.PROFESSIONAL_INQUIRY,
    }
    # SUPPORT has no client-facing context: spec 15 has no support-inquiry entry
    # point, and a client able to name it could open threads nothing recognises.
    assert ConversationType.SUPPORT not in CONTEXT_TO_CONVERSATION_TYPE.values()


def test_contact_access_outcomes_are_the_closed_set():
    assert ContactAccessOutcome.ALL == frozenset({"GRANTED", "NOT_APPLICABLE"})
    assert ContactAccessOutcome.GRANTED == "GRANTED"


def test_spec_15_1_field_limits_are_pinned():
    assert (FULL_NAME_MIN_LENGTH, FULL_NAME_MAX_LENGTH) == (2, 120)
    assert (SUBJECT_MIN_LENGTH, SUBJECT_MAX_LENGTH) == (3, 150)
    assert (MESSAGE_MIN_LENGTH, MESSAGE_MAX_LENGTH) == (20, 4000)
    # Matches the public_phone column width in brokers and professionals.
    assert PHONE_MAX_LENGTH == 32


def test_policy_version_and_flag_and_windows():
    assert CURRENT_PRIVACY_POLICY_VERSION == "2026-09"
    assert UNIFIED_INQUIRIES_FLAG == "unified_inquiries"
    assert DUPLICATE_MESSAGE_WINDOW_SECONDS == 300
    assert DRAFT_TOKEN_MAX_AGE_SECONDS == 1800
    assert HONEYPOT_FIELD_NAME == "company_website"


@pytest.mark.parametrize("raw", ["b0dd1d0e-0000-4000-8000-000000000001"])
def test_conversation_url_matches_spec_15_5(raw):
    assert conversation_url(raw) == f"/dashboard/messages/{raw}/"
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd backend && uv run pytest messaging/tests/test_enums.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'messaging'`.

- [ ] **Step 4: Write `backend/messaging/enums.py`**

```python
"""Messaging vocabulary (NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md 11.8, 15).

Values are copied verbatim from the spec and must never be renamed: they are
persisted in the database, returned in API responses and written into audit
events.
"""

from django.db import models


class ConversationType(models.TextChoices):
    LISTING_INQUIRY = "LISTING_INQUIRY", "Listing inquiry"
    BROKER_INQUIRY = "BROKER_INQUIRY", "Broker inquiry"
    PROFESSIONAL_INQUIRY = "PROFESSIONAL_INQUIRY", "Professional inquiry"
    SUPPORT = "SUPPORT", "Support"


class ConversationStatus(models.TextChoices):
    OPEN = "OPEN", "Open"
    ARCHIVED = "ARCHIVED", "Archived"
    BLOCKED = "BLOCKED", "Blocked"


class ContactTargetType(models.TextChoices):
    """Spec 11.8: a grant targets a broker or a professional, never a person.

    A private seller is deliberately absent. Spec 1 scopes contact reveal to
    "broker/professional contact details"; a private individual's address is not
    business contact data and is never revealed by this mechanism.
    """

    BROKER = "BROKER", "Broker"
    PROFESSIONAL = "PROFESSIONAL", "Professional"


class InquiryContextType(models.TextChoices):
    """The API's own context vocabulary (spec 15.5's `context_type`).

    Deliberately distinct from ConversationType: the client says what it is
    looking at, the server decides what kind of conversation that becomes.
    """

    LISTING = "LISTING", "Listing"
    BROKER = "BROKER", "Broker"
    PROFESSIONAL = "PROFESSIONAL", "Professional"


CONTEXT_TO_CONVERSATION_TYPE: dict[str, str] = {
    InquiryContextType.LISTING: ConversationType.LISTING_INQUIRY,
    InquiryContextType.BROKER: ConversationType.BROKER_INQUIRY,
    InquiryContextType.PROFESSIONAL: ConversationType.PROFESSIONAL_INQUIRY,
}


class ContactAccessOutcome:
    """What POST /api/v1/inquiries/ reports about contact access (spec 15.5).

    GRANTED means an active grant exists for this viewer and target after the
    call, whether this call created it or an earlier one did - the client needs
    to know the state, not the history. NOT_APPLICABLE is the private-seller
    listing case: spec 11.8's target_type has no member for a private person, so
    there is nothing to grant and saying GRANTED would be a lie.
    """

    GRANTED = "GRANTED"
    NOT_APPLICABLE = "NOT_APPLICABLE"
    ALL: frozenset[str] = frozenset({GRANTED, NOT_APPLICABLE})


# Spec 35.1's rollout flag for this phase.
UNIFIED_INQUIRIES_FLAG = "unified_inquiries"

# Spec 15.5's literal. A module constant rather than a platform setting because
# platform_settings.registry.SettingValueType has only BOOLEAN/INTEGER/DECIMAL
# members - there is no string setting type to put it in. See the plan's ruling.
CURRENT_PRIVACY_POLICY_VERSION = "2026-09"

# Spec 15.1's field table, verbatim. PHONE_MAX_LENGTH is not from the table -
# it is the column width brokers.BrokerOrganization.public_phone and
# professionals.ProfessionalProfile.public_phone already use, kept identical so
# a number a provider can store is a number a sender can send.
FULL_NAME_MIN_LENGTH = 2
FULL_NAME_MAX_LENGTH = 120
SUBJECT_MIN_LENGTH = 3
SUBJECT_MAX_LENGTH = 150
MESSAGE_MIN_LENGTH = 20
MESSAGE_MAX_LENGTH = 4000
PHONE_MAX_LENGTH = 32

# Spec 15.1's "abuse detection": the same sender re-posting the same body into
# the same thread inside this window is a double-click, not a second message.
DUPLICATE_MESSAGE_WINDOW_SECONDS = 300

# Spec 15.2's "short-lived signed session" for a guest's draft.
DRAFT_TOKEN_MAX_AGE_SECONDS = 1800
DRAFT_TOKEN_SALT = "messaging.inquiry-draft"

# Spec 15.1's honeypot. Named to look like a field a scraper would fill in.
HONEYPOT_FIELD_NAME = "company_website"

# Spec 15.5's `next_url`. One constant, because spec 4.2 names /messages/ and
# spec 28 names /dashboard/broker/messages/ for the same destination - the phase
# that finally builds the page changes this line and nothing else.
SENDER_CONVERSATION_URL_TEMPLATE = "/dashboard/messages/{conversation_id}/"


def conversation_url(conversation_id) -> str:
    return SENDER_CONVERSATION_URL_TEMPLATE.format(conversation_id=conversation_id)
```

- [ ] **Step 5: Register the app in `INSTALLED_APPS`**

In `backend/config/settings/base.py`, append `"messaging",` to the `INSTALLED_APPS` list, immediately after `"entitlements",`. This is an **append only** — read the real file and add one line. Do not reorder or reformat the existing entries (the tracker's "Known cross-phase risk" section names this exact file).

The tail of the list as it stands on `dev` — Phase 13's `entitlements` app is **already merged**, so `"listings"` is no longer the last local app:

```python
    "taxonomy",
    "listings",
    "entitlements",
    "messaging",
    "platform_settings",
]
```

**Read the file before editing.** Three other phases are landing apps in this window; if `INSTALLED_APPS` has grown again, append after whatever the last local app is and leave `"platform_settings"` last, exactly as every prior phase has.

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd backend && uv run pytest messaging/tests/test_enums.py -v`
Expected: PASS — **9 collected test items** (8 plain tests plus `test_conversation_url_matches_spec_15_5`'s single parametrisation).

Then confirm Django still boots with the new app:

Run: `cd backend && uv run python manage.py check`
Expected: `System check identified no issues`.

- [ ] **Step 7: Commit**

```bash
git add backend/messaging backend/config/settings/base.py
git commit -m "feat(messaging): scaffold app and spec 11.8/15 vocabulary"
```

---

### Task 2: `Conversation` — model, context and uniqueness constraints, admin, rollout flag

**Files:**
- Create: `backend/messaging/models.py`, `backend/messaging/admin.py`, `backend/messaging/tests/conftest.py`, `backend/messaging/tests/factories.py`, `backend/messaging/migrations/0002_seed_unified_inquiries_flag.py`
- Generated: `backend/messaging/migrations/0001_conversation.py`
- Test: `backend/messaging/tests/test_conversation_model.py`

**Interfaces:**
- Consumes: `messaging.enums.ConversationType` / `ConversationStatus` / `SUBJECT_MAX_LENGTH` / `UNIFIED_INQUIRIES_FLAG` (Task 1); `common.models.UUIDTimeStampedModel`; `brokers.models.BrokerOrganization`, `professionals.models.ProfessionalProfile`, `listings.models.BoatListing` — all three by **string** reference in the FK, so this module imports none of those packages.
- Produces:
  - `messaging.models.Conversation` with fields `id`, `conversation_type`, `initiator`, `broker`, `professional`, `listing`, `subject`, `status`, `last_message_at`, `created_at`, `updated_at`
  - Reverse accessors later phases rely on: `user.initiated_conversations`, `broker.conversations`, `professional.conversations`, `listing.conversations`
  - `messaging.tests.factories.make_conversation(*, initiator, conversation_type=…, broker=None, professional=None, listing=None, subject=…, status=…, **extra)`
  - `messaging.tests.conftest`: autouse `_clear_messaging_caches`, `MESSAGING_FEATURE_FLAG_KEYS`, `unified_inquiries_disabled` fixture
  - migration seeding the `unified_inquiries` `FeatureFlag` row, **enabled**

- [ ] **Step 1: Write the failing test**

`backend/messaging/tests/test_conversation_model.py`:

```python
"""Spec 11.8: "Exactly one valid context combination is permitted."

Every assertion below is against a real PostgreSQL constraint, not a Python
guard - spec 2.3 requires database constraints for state that must not drift.
"""

import pytest
from django.db import IntegrityError, transaction
from django.utils import timezone

from accounts.tests.factories import make_user
from brokers.tests.factories import make_broker
from listings.tests.factories import make_broker_listing
from messaging.enums import ConversationStatus, ConversationType
from messaging.models import Conversation
from messaging.tests.factories import make_conversation
from platform_settings.models import FeatureFlag
from professionals.tests.factories import make_professional

pytestmark = pytest.mark.django_db


def test_broker_inquiry_requires_a_broker_and_no_other_context():
    broker = make_broker(name="Phase6 Brokers", slug="phase6-brokers")
    conversation = make_conversation(
        initiator=make_user(email="asker@phase6.example"),
        conversation_type=ConversationType.BROKER_INQUIRY,
        broker=broker,
    )
    assert conversation.broker_id == broker.pk
    assert conversation.professional_id is None
    assert conversation.listing_id is None
    assert conversation.status == ConversationStatus.OPEN


def test_broker_inquiry_without_a_broker_is_refused_by_the_database():
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            make_conversation(
                initiator=make_user(email="asker2@phase6.example"),
                conversation_type=ConversationType.BROKER_INQUIRY,
            )


def test_professional_inquiry_cannot_also_carry_a_broker():
    owner = make_user(email="pro-owner@phase6.example")
    professional = make_professional(
        owner, display_name="Phase6 Surveyors", slug="phase6-surveyors"
    )
    broker = make_broker(name="Phase6 Brokers II", slug="phase6-brokers-ii")
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            make_conversation(
                initiator=make_user(email="asker3@phase6.example"),
                conversation_type=ConversationType.PROFESSIONAL_INQUIRY,
                professional=professional,
                broker=broker,
            )


def test_support_conversation_carries_no_context_at_all():
    conversation = make_conversation(
        initiator=make_user(email="asker4@phase6.example"),
        conversation_type=ConversationType.SUPPORT,
    )
    assert (
        conversation.broker_id,
        conversation.professional_id,
        conversation.listing_id,
    ) == (None, None, None)


def test_only_one_open_broker_conversation_per_initiator_and_broker():
    initiator = make_user(email="asker5@phase6.example")
    broker = make_broker(name="Phase6 Brokers III", slug="phase6-brokers-iii")
    make_conversation(
        initiator=initiator,
        conversation_type=ConversationType.BROKER_INQUIRY,
        broker=broker,
    )
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            make_conversation(
                initiator=initiator,
                conversation_type=ConversationType.BROKER_INQUIRY,
                broker=broker,
            )


def test_an_archived_conversation_does_not_block_a_new_open_one():
    """Spec 11.8's uniqueness is over OPEN threads: archiving must let the same
    pair start again, otherwise archiving would permanently mute a relationship."""
    initiator = make_user(email="asker6@phase6.example")
    broker = make_broker(name="Phase6 Brokers IV", slug="phase6-brokers-iv")
    first = make_conversation(
        initiator=initiator,
        conversation_type=ConversationType.BROKER_INQUIRY,
        broker=broker,
    )
    first.status = ConversationStatus.ARCHIVED
    first.save(update_fields=["status", "updated_at"])

    second = make_conversation(
        initiator=initiator,
        conversation_type=ConversationType.BROKER_INQUIRY,
        broker=broker,
    )
    assert second.pk != first.pk
    assert Conversation.objects.filter(initiator=initiator, broker=broker).count() == 2


def test_a_broker_listing_thread_does_not_collide_with_the_broker_profile_thread():
    """A broker-owned LISTING_INQUIRY sets BOTH listing and broker (spec 11.8:
    the recipient is derived from listing ownership). The broker-profile
    uniqueness constraint must therefore exclude rows that carry a listing, or a
    user could never ask about a boat after asking about the brokerage itself."""
    initiator = make_user(email="asker7@phase6.example")
    broker = make_broker(name="Phase6 Brokers V", slug="phase6-brokers-v")
    make_conversation(
        initiator=initiator,
        conversation_type=ConversationType.BROKER_INQUIRY,
        broker=broker,
    )
    listing = make_broker_listing(broker=broker, actor=initiator)
    listing_thread = make_conversation(
        initiator=initiator,
        conversation_type=ConversationType.LISTING_INQUIRY,
        broker=broker,
        listing=listing,
    )
    assert listing_thread.broker_id == broker.pk
    assert Conversation.objects.filter(initiator=initiator, broker=broker).count() == 2


def test_two_open_threads_about_the_same_listing_are_refused():
    initiator = make_user(email="asker9@phase6.example")
    broker = make_broker(name="Phase6 Brokers VI", slug="phase6-brokers-vi")
    listing = make_broker_listing(broker=broker, actor=initiator)
    make_conversation(
        initiator=initiator,
        conversation_type=ConversationType.LISTING_INQUIRY,
        broker=broker,
        listing=listing,
    )
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            make_conversation(
                initiator=initiator,
                conversation_type=ConversationType.LISTING_INQUIRY,
                broker=broker,
                listing=listing,
            )


def test_last_message_at_defaults_to_null_and_is_writable():
    conversation = make_conversation(
        initiator=make_user(email="asker8@phase6.example"),
        conversation_type=ConversationType.SUPPORT,
    )
    assert conversation.last_message_at is None
    stamp = timezone.now()
    conversation.last_message_at = stamp
    conversation.save(update_fields=["last_message_at", "updated_at"])
    conversation.refresh_from_db()
    assert conversation.last_message_at == stamp


def test_the_rollout_flag_is_seeded_enabled():
    flag = FeatureFlag.objects.get(key="unified_inquiries")
    assert flag.is_enabled is True
    assert flag.description != ""
    assert len(flag.description) <= 255
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && uv run pytest messaging/tests/test_conversation_model.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'messaging.models'`.

- [ ] **Step 3a: Write `backend/messaging/models.py`**

```python
"""Conversation store (NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md 11.8).

Every foreign key to another app is declared as a STRING ("brokers.BrokerOrganization"),
which Django resolves lazily. That keeps this module free of Python imports from
brokers/professionals/listings, so the dependency arrow stays one-directional and
`messaging` can never become part of an app-loading cycle.
"""

from django.conf import settings
from django.db import models

from common.models import UUIDTimeStampedModel
from messaging.enums import SUBJECT_MAX_LENGTH, ConversationStatus, ConversationType


class Conversation(UUIDTimeStampedModel):
    conversation_type = models.CharField(
        max_length=20, choices=ConversationType.choices
    )
    initiator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="initiated_conversations",
        on_delete=models.CASCADE,
    )
    broker = models.ForeignKey(
        "brokers.BrokerOrganization",
        related_name="conversations",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    professional = models.ForeignKey(
        "professionals.ProfessionalProfile",
        related_name="conversations",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    listing = models.ForeignKey(
        "listings.BoatListing",
        related_name="conversations",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    # Beyond spec 11.8's field list; see the plan's ruling. Spec 15.1 makes
    # Subject a required, validated 3-150 character field and 11.8 gives it
    # nowhere to live, so it lives on the thread it titles.
    subject = models.CharField(max_length=SUBJECT_MAX_LENGTH)
    status = models.CharField(
        max_length=10,
        choices=ConversationStatus.choices,
        default=ConversationStatus.OPEN,
    )
    last_message_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-last_message_at", "-created_at")
        indexes = [
            models.Index(fields=["initiator", "-last_message_at"]),
            models.Index(fields=["broker", "-last_message_at"]),
            models.Index(fields=["professional", "-last_message_at"]),
            models.Index(fields=["listing", "-last_message_at"]),
        ]
        constraints = [
            # Spec 11.8: "Exactly one valid context combination is permitted."
            # A LISTING_INQUIRY carries a listing and MAY also carry the broker
            # that owns it, because that broker is the recipient (11.8: "may
            # derive its recipient from listing ownership"). It never carries a
            # professional.
            models.CheckConstraint(
                condition=(
                    models.Q(
                        conversation_type=ConversationType.LISTING_INQUIRY,
                        listing__isnull=False,
                        professional__isnull=True,
                    )
                    | models.Q(
                        conversation_type=ConversationType.BROKER_INQUIRY,
                        broker__isnull=False,
                        listing__isnull=True,
                        professional__isnull=True,
                    )
                    | models.Q(
                        conversation_type=ConversationType.PROFESSIONAL_INQUIRY,
                        professional__isnull=False,
                        broker__isnull=True,
                        listing__isnull=True,
                    )
                    | models.Q(
                        conversation_type=ConversationType.SUPPORT,
                        broker__isnull=True,
                        professional__isnull=True,
                        listing__isnull=True,
                    )
                ),
                name="messaging_conversation_exactly_one_context",
            ),
            # One OPEN thread per (initiator, context). Partial, because an
            # ARCHIVED or BLOCKED thread must not stop a new one - spec 15.3
            # step 2 says "get or create an OPEN conversation". Three separate
            # indexes rather than one over all three FKs, because PostgreSQL
            # treats NULLs as distinct and a single composite index would never
            # fire on rows where two of the three are NULL.
            models.UniqueConstraint(
                fields=["initiator", "listing"],
                condition=models.Q(
                    status=ConversationStatus.OPEN, listing__isnull=False
                ),
                name="messaging_open_listing_thread_unique",
            ),
            models.UniqueConstraint(
                fields=["initiator", "broker"],
                condition=models.Q(
                    status=ConversationStatus.OPEN,
                    broker__isnull=False,
                    listing__isnull=True,
                ),
                name="messaging_open_broker_thread_unique",
            ),
            models.UniqueConstraint(
                fields=["initiator", "professional"],
                condition=models.Q(
                    status=ConversationStatus.OPEN, professional__isnull=False
                ),
                name="messaging_open_professional_thread_unique",
            ),
        ]

    def __str__(self):
        return f"{self.conversation_type} {self.pk}"
```

- [ ] **Step 3b: Write `backend/messaging/admin.py`**

```python
from django.contrib import admin

from messaging.models import Conversation


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    """Read-only. Spec 3 puts every state change in a service function, and this
    phase ships no audited admin write path for a conversation - so the admin
    does not offer one. Spec 33.5 also keeps message bodies out of operational
    tooling by default, which is why Message has no admin at all (Task 3)."""

    list_display = ("id", "conversation_type", "initiator", "status", "last_message_at")
    list_filter = ("conversation_type", "status")
    search_fields = ("id", "initiator__email", "subject")
    readonly_fields = tuple(field.name for field in Conversation._meta.fields)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
```

- [ ] **Step 3c: Write `backend/messaging/tests/factories.py`**

```python
from messaging.enums import ConversationStatus, ConversationType
from messaging.models import Conversation


def make_conversation(
    *,
    initiator,
    conversation_type=ConversationType.BROKER_INQUIRY,
    broker=None,
    professional=None,
    listing=None,
    subject="Question about your services",
    status=ConversationStatus.OPEN,
    **extra,
):
    return Conversation.objects.create(
        initiator=initiator,
        conversation_type=conversation_type,
        broker=broker,
        professional=professional,
        listing=listing,
        subject=subject,
        status=status,
        **extra,
    )
```

- [ ] **Step 3d: Write `backend/messaging/tests/conftest.py`**

```python
import pytest
from django.contrib.auth.models import Group
from django.core.cache import cache

from accounts.enums import StaffGroup
from messaging.enums import UNIFIED_INQUIRIES_FLAG
from platform_settings.models import FeatureFlag
from platform_settings.services import (
    SETTINGS_CACHE_KEY,
    feature_flag_cache_key,
    set_feature_flag,
)

#: Flags this app's tests toggle. Listed so the autouse fixture below clears
#: their cache entries: platform_settings.services.is_feature_enabled caches a
#: persisted value indefinitely, so a flag flipped in one test would otherwise
#: leak into the next.
MESSAGING_FEATURE_FLAG_KEYS = [UNIFIED_INQUIRIES_FLAG]

FLAG_TEST_DESCRIPTION = "Spec 35.1 rollout flag for the shared inquiry form."


@pytest.fixture(autouse=True)
def _clear_messaging_caches():
    """Delete this package's OWN cache keys around every test.

    Never `cache.clear()`. Django's RedisCache.clear() is a FLUSHDB, and this
    project's test Redis DB is shared by concurrently running worktrees - a
    whole-DB flush has already broken parallel suites here once, which is why
    backend/conftest.py was rewritten to scan and delete only its own
    KEY_PREFIX. This fixture is narrower still: the two key shapes this package
    actually writes, exactly as listings/tests/conftest.py and
    platform_settings/tests/conftest.py do.

    Defined FIRST so it runs before _messaging_reference_rows below: pytest
    executes same-scope autouse fixtures in definition order, and the row-seeding
    fixture writes a flag whose cached value must not be a stale one.
    """

    def _clear():
        cache.delete(SETTINGS_CACHE_KEY)
        for key in MESSAGING_FEATURE_FLAG_KEYS:
            cache.delete(feature_flag_cache_key(key))

    _clear()
    yield
    _clear()


@pytest.fixture(autouse=True)
def _messaging_reference_rows(db):
    """Guarantee the reference rows this app's tests assume, instead of trusting
    a migration seed to still be there.

    Two rows are at stake: the `unified_inquiries` FeatureFlag that
    messaging/0002 seeds enabled, and the `staff_moderator`/`staff_admin` Groups
    that accounts/0003 seeds. Both are created by RunPython data migrations, and
    a `@pytest.mark.django_db(transaction=True)` test anywhere in the session
    ends with a `flush`, which truncates every table and re-emits `post_migrate`
    - and `post_migrate` restores content types and permissions, NOT rows a data
    migration inserted. Whether that actually bites depends on collection order
    and on Django/pytest-django internals; this fixture means it cannot bite
    HERE regardless, which is cheaper than being right about the internals.

    In-repo evidence that the concern is real rather than theoretical:
    `brokers/tests/test_admin.py:35` already writes
    `Group.objects.get_or_create(name=StaffGroup.MODERATOR)` where every other
    call site writes `Group.objects.get(...)` - a defensive spelling somebody
    adopted for exactly this class of problem.

    `update_or_create`, not `get_or_create`, for the flag: the test's starting
    state must be ENABLED whatever a previous run left behind. The
    `unified_inquiries_disabled` fixture below is requested explicitly, so
    pytest runs it AFTER this autouse one and its `False` wins where a test asks
    for it.
    """
    FeatureFlag.objects.update_or_create(
        key=UNIFIED_INQUIRIES_FLAG,
        defaults={"is_enabled": True, "description": FLAG_TEST_DESCRIPTION},
    )
    for name in StaffGroup.ALL:
        Group.objects.get_or_create(name=name)
    yield


@pytest.fixture
def unified_inquiries_disabled(db):
    """Flip spec 35.1's flag off for one test. The flag is seeded ENABLED, so
    the interesting case is the off one and only it needs a fixture."""
    set_feature_flag(
        key=UNIFIED_INQUIRIES_FLAG,
        is_enabled=False,
        actor=None,
        description="Disabled by a test.",
    )
    yield
```

**Why the autouse fixture requests `db`:** it makes every module in `messaging/tests/` a database test, including `test_enums.py`, which otherwise needs no database. That is a deliberate, cheap trade — nine pure-Python assertions gaining a transaction is invisible next to the guarantee that no messaging test depends on a migration seed surviving another module's `flush`.

- [ ] **Step 3e: Generate the model migration**

Run: `cd backend && uv run python manage.py makemigrations messaging --name conversation`
Expected: `Migrations for 'messaging': messaging/migrations/0001_conversation.py`.

- [ ] **Step 3f: Hand-write `backend/messaging/migrations/0002_seed_unified_inquiries_flag.py`**

```python
from django.db import migrations

FLAG_KEY = "unified_inquiries"
# platform_settings.FeatureFlag.description is CharField(max_length=255) - a
# longer string raises DataError on migrate, which has happened in this project
# before (see services_catalog/migrations/0004). This text is 213 characters.
FLAG_DESCRIPTION = (
    "Spec 35.1 flag. Off = every /api/v1/inquiries/, /api/v1/inquiry-drafts/ "
    "and /api/v1/conversations/ endpoint returns 403 feature_disabled and the "
    "shared InquiryForm is not rendered on any page."
)


def seed_flag(apps, schema_editor):
    FeatureFlag = apps.get_model("platform_settings", "FeatureFlag")
    FeatureFlag.objects.get_or_create(
        key=FLAG_KEY,
        defaults={"is_enabled": True, "description": FLAG_DESCRIPTION},
    )


class Migration(migrations.Migration):
    dependencies = [
        ("messaging", "0001_conversation"),
        ("platform_settings", "0004_featureflag"),
    ]

    operations = [
        # Reverse is a no-op, mirroring services_catalog/0004: a rollback must
        # not delete an operator-toggleable row (spec 32.3).
        migrations.RunPython(seed_flag, migrations.RunPython.noop),
    ]
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && uv run pytest messaging/tests/ -v`
Expected: PASS — 9 items from `test_enums.py` plus **10** from `test_conversation_model.py` (19 in the package so far).

Then prove the constraints exist in PostgreSQL rather than only in Python:

Run: `cd backend && uv run python manage.py sqlmigrate messaging 0001`
Expected: the output contains all four names — `messaging_conversation_exactly_one_context`, `messaging_open_listing_thread_unique`, `messaging_open_broker_thread_unique`, `messaging_open_professional_thread_unique`.

- [ ] **Step 5: Commit**

```bash
git add backend/messaging
git commit -m "feat(messaging): Conversation model, context constraints and rollout flag"
```

---

### Task 3: `Message` and `ContactAccessGrant` — the rows spec §15.3 steps 3 and 4 write

**Files:**
- Modify (append): `backend/messaging/models.py`, `backend/messaging/tests/factories.py`
- Generated: `backend/messaging/migrations/0003_message_contactaccessgrant.py`
- Test: `backend/messaging/tests/test_message_and_grant_models.py`

**Interfaces:**
- Consumes: `messaging.models.Conversation` (Task 2); `messaging.enums.ContactTargetType`, `FULL_NAME_MAX_LENGTH`, `MESSAGE_MAX_LENGTH` (Task 1).
- Produces:
  - `messaging.models.Message` — fields `id`, `conversation`, `sender`, `body`, `sender_email_snapshot`, `sender_name_snapshot`, `sender_phone_snapshot`, `is_system`, `privacy_policy_version`, `marketing_consent`, `read_at`, `created_at`, `updated_at`; reverse accessor `conversation.messages`
  - `messaging.models.ContactAccessGrant` — fields `id`, `viewer`, `target_type`, `broker`, `professional`, `source_conversation`, `granted_at`, `revoked_at`, `created_at`, `updated_at`; reverse accessors `user.contact_access_grants`, `broker.contact_access_grants`, `professional.contact_access_grants`
  - `messaging.tests.factories.make_message(...)`, `messaging.tests.factories.make_grant(...)`

**Note (the five columns beyond spec §11.8's lists, and why each exists).** `Conversation.subject` (Task 2), `Message.sender_name_snapshot`, `Message.sender_phone_snapshot`, `Message.privacy_policy_version` and `Message.marketing_consent`. The first three are the plan's "three columns" ruling: spec §15.1 makes Subject and Full name required and validated, and Phone accepted, with nowhere in §11.8 to put them, and a required field that is validated and then discarded is a decorative field (spec §2.1). The last two come from spec §33.2's flat requirement — "Obtain required consent/version on inquiry" — which cannot be satisfied by a field that is checked and thrown away: the whole point of a *versioned* consent is that the version is retrievable later, per message. All five are recorded here rather than presented as spec-literal.

- [ ] **Step 1: Write the failing test**

`backend/messaging/tests/test_message_and_grant_models.py`:

```python
"""Spec 11.8's Message and ContactAccessGrant, and the "unique active grant per
viewer and target" rule the spec states in prose and this module enforces in
PostgreSQL (spec 2.3)."""

import pytest
from django.db import IntegrityError, transaction
from django.utils import timezone

from accounts.tests.factories import make_user
from brokers.tests.factories import make_broker
from messaging.enums import ContactTargetType, ConversationType
from messaging.models import ContactAccessGrant, Message
from messaging.tests.factories import make_conversation, make_grant, make_message
from professionals.tests.factories import make_professional

pytestmark = pytest.mark.django_db


@pytest.fixture
def broker_thread():
    initiator = make_user(email="thread-asker@phase6.example")
    broker = make_broker(name="Phase6 Msg Brokers", slug="phase6-msg-brokers")
    conversation = make_conversation(
        initiator=initiator,
        conversation_type=ConversationType.BROKER_INQUIRY,
        broker=broker,
    )
    return initiator, broker, conversation


def test_message_snapshots_the_sender_identity_at_send_time(broker_thread):
    initiator, _broker, conversation = broker_thread
    message = make_message(
        conversation=conversation,
        sender=initiator,
        body="I would like to arrange a viewing next week please.",
    )
    assert message.sender_email_snapshot == initiator.email
    assert message.sender_name_snapshot == "Ada Rossi"
    assert message.sender_phone_snapshot == ""
    assert message.is_system is False
    assert message.read_at is None
    assert message.privacy_policy_version == "2026-09"
    assert message.marketing_consent is False


def test_the_snapshot_survives_a_later_account_email_change(broker_thread):
    """Spec 11.8 gives Message its own sender_email_snapshot precisely so the
    thread records what was true at send time, not a live join."""
    initiator, _broker, conversation = broker_thread
    message = make_message(conversation=conversation, sender=initiator)
    initiator.email = "renamed@phase6.example"
    initiator.save(update_fields=["email", "updated_at"])

    message.refresh_from_db()
    assert message.sender_email_snapshot == "thread-asker@phase6.example"
    assert message.sender.email == "renamed@phase6.example"


def test_messages_are_ordered_oldest_first(broker_thread):
    initiator, _broker, conversation = broker_thread
    first = make_message(conversation=conversation, sender=initiator, body="A" * 25)
    second = make_message(conversation=conversation, sender=initiator, body="B" * 25)
    assert list(conversation.messages.all()) == [first, second]


def test_read_at_is_writable(broker_thread):
    initiator, _broker, conversation = broker_thread
    message = make_message(conversation=conversation, sender=initiator)
    stamp = timezone.now()
    Message.objects.filter(pk=message.pk).update(read_at=stamp)
    message.refresh_from_db()
    assert message.read_at == stamp


def test_broker_grant_requires_a_broker_and_refuses_a_professional(broker_thread):
    initiator, broker, conversation = broker_thread
    grant = make_grant(
        viewer=initiator,
        target_type=ContactTargetType.BROKER,
        broker=broker,
        source_conversation=conversation,
    )
    assert grant.professional_id is None
    assert grant.revoked_at is None
    assert grant.granted_at is not None

    owner = make_user(email="grant-pro-owner@phase6.example")
    professional = make_professional(
        owner, display_name="Phase6 Grant Pro", slug="phase6-grant-pro"
    )
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            make_grant(
                viewer=make_user(email="grant-asker2@phase6.example"),
                target_type=ContactTargetType.BROKER,
                broker=broker,
                professional=professional,
                source_conversation=conversation,
            )


def test_only_one_active_grant_per_viewer_and_broker(broker_thread):
    initiator, broker, conversation = broker_thread
    make_grant(
        viewer=initiator,
        target_type=ContactTargetType.BROKER,
        broker=broker,
        source_conversation=conversation,
    )
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            make_grant(
                viewer=initiator,
                target_type=ContactTargetType.BROKER,
                broker=broker,
                source_conversation=conversation,
            )


def test_a_revoked_grant_does_not_block_a_new_one(broker_thread):
    """Spec 36.6: a recipient blocking a user "may revoke access"; the default is
    to revoke. Revocation must therefore be re-grantable, or a single block would
    permanently bar a relationship the parties later repair."""
    initiator, broker, conversation = broker_thread
    first = make_grant(
        viewer=initiator,
        target_type=ContactTargetType.BROKER,
        broker=broker,
        source_conversation=conversation,
    )
    first.revoked_at = timezone.now()
    first.save(update_fields=["revoked_at", "updated_at"])

    second = make_grant(
        viewer=initiator,
        target_type=ContactTargetType.BROKER,
        broker=broker,
        source_conversation=conversation,
    )
    assert second.pk != first.pk
    assert ContactAccessGrant.objects.filter(viewer=initiator, broker=broker).count() == 2


def test_a_grant_over_broker_a_does_not_cover_broker_b(broker_thread):
    """Spec 16's acceptance test: "Sending to Broker A does not unlock Broker B"."""
    initiator, broker_a, conversation = broker_thread
    broker_b = make_broker(name="Phase6 Other Brokers", slug="phase6-other-brokers")
    make_grant(
        viewer=initiator,
        target_type=ContactTargetType.BROKER,
        broker=broker_a,
        source_conversation=conversation,
    )
    assert (
        ContactAccessGrant.objects.filter(
            viewer=initiator, broker=broker_b, revoked_at__isnull=True
        ).exists()
        is False
    )


def test_grants_are_not_transferable_between_accounts(broker_thread):
    """Spec 36.6: "Contact access is not transferable between accounts"."""
    initiator, broker, conversation = broker_thread
    make_grant(
        viewer=initiator,
        target_type=ContactTargetType.BROKER,
        broker=broker,
        source_conversation=conversation,
    )
    other = make_user(email="someone-else@phase6.example")
    assert (
        ContactAccessGrant.objects.filter(
            viewer=other, broker=broker, revoked_at__isnull=True
        ).exists()
        is False
    )
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && uv run pytest messaging/tests/test_message_and_grant_models.py -v`
Expected: FAIL — `ImportError: cannot import name 'Message' from 'messaging.models'`.

- [ ] **Step 3a: Append to `backend/messaging/models.py`**

Consolidate the new imports into the module's existing import section at the top:

```python
from django.utils import timezone

from messaging.enums import (
    FULL_NAME_MAX_LENGTH,
    MESSAGE_MAX_LENGTH,
    SUBJECT_MAX_LENGTH,
    ContactTargetType,
    ConversationStatus,
    ConversationType,
)
```

Then append the two models:

```python
class Message(UUIDTimeStampedModel):
    """Spec 11.8. Effectively append-only: only `read_at` changes after INSERT,
    which is why this inherits UUIDTimeStampedModel (an `updated_at` that moves
    when a message is marked read is meaningful) rather than the UUIDModel +
    explicit created_at shape ListingSnapshot uses for a truly frozen row.
    """

    conversation = models.ForeignKey(
        Conversation, related_name="messages", on_delete=models.CASCADE
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="sent_messages",
        on_delete=models.PROTECT,
    )
    body = models.TextField(max_length=MESSAGE_MAX_LENGTH)
    sender_email_snapshot = models.EmailField(max_length=254)
    # Beyond spec 11.8's list - see the note in this task. Both exist for the
    # same reason sender_email_snapshot does: they record what the sender stated
    # at send time, not a live join to a profile that may since have changed.
    #
    # blank/default="": an INQUIRY always carries a name (spec 15.1 makes it
    # required, 2-120 characters), but a REPLY has no name field, so it stores
    # whatever the account's own `full_name` holds - which may be empty, and
    # must NEVER fall back to the email address. See services._reply_display_name.
    sender_name_snapshot = models.CharField(
        max_length=FULL_NAME_MAX_LENGTH, blank=True, default=""
    )
    sender_phone_snapshot = models.CharField(max_length=32, blank=True, default="")
    is_system = models.BooleanField(default=False)
    # Spec 33.2: "Obtain required consent/version on inquiry." A versioned
    # consent whose version is not retrievable per message is not a record.
    privacy_policy_version = models.CharField(max_length=16, blank=True, default="")
    marketing_consent = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("created_at",)
        indexes = [
            models.Index(fields=["conversation", "created_at"]),
            models.Index(fields=["conversation", "read_at"]),
        ]

    def __str__(self):
        return f"message {self.pk} in {self.conversation_id}"


class ContactAccessGrant(UUIDTimeStampedModel):
    """Spec 11.8: "unique active grant per viewer and target".

    Written by this phase (spec 15.3 step 4). Read, masked, revoked and served
    by Phase 7 (spec 16). No method here returns a contact value; the grant is
    an authorization record, not a contact record.
    """

    viewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="contact_access_grants",
        on_delete=models.CASCADE,
    )
    target_type = models.CharField(max_length=12, choices=ContactTargetType.choices)
    broker = models.ForeignKey(
        "brokers.BrokerOrganization",
        related_name="contact_access_grants",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    professional = models.ForeignKey(
        "professionals.ProfessionalProfile",
        related_name="contact_access_grants",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    source_conversation = models.ForeignKey(
        Conversation, related_name="contact_access_grants", on_delete=models.PROTECT
    )
    # Named by spec 11.8 in its own right. It equals created_at at INSERT, and
    # is the field Phase 7's "granted_at" response key reads - keeping the API's
    # semantic field separate from the row's bookkeeping timestamp.
    granted_at = models.DateTimeField(default=timezone.now)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-granted_at",)
        indexes = [
            models.Index(fields=["viewer", "target_type"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(
                        target_type=ContactTargetType.BROKER,
                        broker__isnull=False,
                        professional__isnull=True,
                    )
                    | models.Q(
                        target_type=ContactTargetType.PROFESSIONAL,
                        professional__isnull=False,
                        broker__isnull=True,
                    )
                ),
                name="messaging_grant_exactly_one_target",
            ),
            models.UniqueConstraint(
                fields=["viewer", "broker"],
                condition=models.Q(revoked_at__isnull=True, broker__isnull=False),
                name="messaging_active_broker_grant_unique",
            ),
            models.UniqueConstraint(
                fields=["viewer", "professional"],
                condition=models.Q(revoked_at__isnull=True, professional__isnull=False),
                name="messaging_active_professional_grant_unique",
            ),
        ]

    def __str__(self):
        return f"{self.target_type} grant to {self.viewer_id}"

    @property
    def is_active(self) -> bool:
        return self.revoked_at is None
```

- [ ] **Step 3b: Append to `backend/messaging/tests/factories.py`**

```python
from messaging.enums import (
    CURRENT_PRIVACY_POLICY_VERSION,
    ContactTargetType,
    ConversationStatus,
    ConversationType,
)
from messaging.models import ContactAccessGrant, Conversation, Message


def make_message(
    *,
    conversation,
    sender,
    body="I would like to arrange a viewing next week please.",
    sender_email_snapshot=None,
    sender_name_snapshot="Ada Rossi",
    sender_phone_snapshot="",
    is_system=False,
    privacy_policy_version=CURRENT_PRIVACY_POLICY_VERSION,
    marketing_consent=False,
    **extra,
):
    return Message.objects.create(
        conversation=conversation,
        sender=sender,
        body=body,
        sender_email_snapshot=(
            sender.email if sender_email_snapshot is None else sender_email_snapshot
        ),
        sender_name_snapshot=sender_name_snapshot,
        sender_phone_snapshot=sender_phone_snapshot,
        is_system=is_system,
        privacy_policy_version=privacy_policy_version,
        marketing_consent=marketing_consent,
        **extra,
    )


def make_grant(
    *,
    viewer,
    target_type,
    source_conversation,
    broker=None,
    professional=None,
    **extra,
):
    return ContactAccessGrant.objects.create(
        viewer=viewer,
        target_type=target_type,
        broker=broker,
        professional=professional,
        source_conversation=source_conversation,
        **extra,
    )
```

- [ ] **Step 3c: Generate the migration**

Run: `cd backend && uv run python manage.py makemigrations messaging --name message_contactaccessgrant`
Expected: `messaging/migrations/0003_message_contactaccessgrant.py`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && uv run pytest messaging/tests/ -v`
Expected: PASS — 9 + 10 + **9** items.

Prove the grant constraints reached PostgreSQL:

Run: `cd backend && uv run python manage.py sqlmigrate messaging 0003`
Expected: the output contains `messaging_grant_exactly_one_target`, `messaging_active_broker_grant_unique` and `messaging_active_professional_grant_unique`.

- [ ] **Step 5: Commit**

```bash
git add backend/messaging
git commit -m "feat(messaging): Message and ContactAccessGrant models with active-grant constraints"
```

---

### Task 4: The `notifications` app — spec §11.10 rows and the email channel

**Files:**
- Create: `backend/notifications/__init__.py`, `apps.py`, `enums.py`, `models.py`, `services.py`, `tasks.py`, `admin.py`, `migrations/__init__.py`, `tests/__init__.py`, `tests/factories.py`
- Modify: `backend/config/settings/base.py` (append one `CELERY_TASK_ROUTES` entry and one `INSTALLED_APPS` entry)
- Generated: `backend/notifications/migrations/0001_initial.py`
- Test: `backend/notifications/tests/test_notification_models.py`, `backend/notifications/tests/test_notification_email.py`

**Interfaces:**
- Consumes: `common.models.UUIDTimeStampedModel`; `settings.AUTH_USER_MODEL`; `accounts.enums.Locale` (for the EN/IT/ES email dictionaries). **Imports nothing from `messaging` or `listings`** — the dependency arrow is `messaging` → `notifications` and never back.
- Produces:
  - `notifications.enums.NotificationType` — `TextChoices` with `INQUIRY_RECEIVED = "inquiry.received"` (spec §27.1's literal event name)
  - `notifications.enums.DeliveryChannel` — `IN_APP`, `WEBSOCKET`, `EMAIL`
  - `notifications.enums.DeliveryStatus` — `QUEUED`, `SENT`, `FAILED`, `SKIPPED`
  - `notifications.enums.EXCERPT_MAX_LENGTH: int = 200`
  - `notifications.models.Notification` — `id`, `recipient`, `notification_type`, `title_key`, `body_key`, `payload`, `target_url`, `read_at`, `dedupe_key`, `created_at`, `updated_at`; partial unique index on `(recipient, notification_type, dedupe_key)` where the key is non-empty; reverse accessor `user.notifications`
  - `notifications.models.NotificationDelivery` — `notification`, `channel`, `status`, `attempt_count`, `provider_message_id`, `last_error_code`, `sent_at`; `unique(notification, channel)`; reverse accessor `notification.deliveries`
  - `notifications.services.create_notification(*, recipient, notification_type, title_key, body_key, target_url, payload=None, email_to="", dedupe_key="") -> Notification` — idempotent on `(recipient, notification_type, dedupe_key)` when the key is non-empty
  - `notifications.tasks.send_notification_email(notification_id: str, to_email: str) -> None`
  - `notifications.tests.factories.make_notification(...)`

**Note (the wire name is `type`, the Python name is `notification_type`).** Spec §11.10 calls the column `type` and spec §27.2's WebSocket payload carries `type`. `type` is a legal Django field name but shadows the builtin at every call site and is flagged by the project's linting posture, so the model attribute is `notification_type`. Phase 18's serializer must emit it as `type` (`serializers.CharField(source="notification_type")`); this is recorded in the Contract summary so the wire contract does not drift.

- [ ] **Step 1: Create the app package by hand**

```bash
mkdir -p backend/notifications/migrations backend/notifications/tests
touch backend/notifications/__init__.py
touch backend/notifications/migrations/__init__.py
touch backend/notifications/tests/__init__.py
```

`backend/notifications/apps.py`:

```python
from django.apps import AppConfig


class NotificationsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "notifications"
```

- [ ] **Step 2: Write the failing tests**

`backend/notifications/tests/test_notification_models.py`:

```python
"""Spec 11.10's Notification and NotificationDelivery, and spec 27.3's "queue
only after commit" rule."""

import pytest
from django.db import IntegrityError, transaction

from accounts.tests.factories import make_user
from notifications.enums import DeliveryChannel, DeliveryStatus, NotificationType
from notifications.models import Notification, NotificationDelivery
from notifications.services import create_notification

pytestmark = pytest.mark.django_db



def test_enum_values_match_spec_11_10_and_27_1():
    assert NotificationType.INQUIRY_RECEIVED == "inquiry.received"
    assert [choice.value for choice in DeliveryChannel] == [
        "IN_APP",
        "WEBSOCKET",
        "EMAIL",
    ]
    assert [choice.value for choice in DeliveryStatus] == [
        "QUEUED",
        "SENT",
        "FAILED",
        "SKIPPED",
    ]


def test_create_notification_writes_the_in_app_row_and_marks_it_sent():
    recipient = make_user(email="recipient@phase6.example")
    notification = create_notification(
        recipient=recipient,
        notification_type=NotificationType.INQUIRY_RECEIVED,
        title_key="notification.inquiry_received.title",
        body_key="notification.inquiry_received.body",
        target_url="/dashboard/messages/abc/",
        payload={"excerpt": "Hello there"},
    )
    assert notification.read_at is None
    in_app = notification.deliveries.get(channel=DeliveryChannel.IN_APP)
    # The in-app "delivery" IS the row existing - there is nothing left to do
    # asynchronously, so QUEUED would be a state nothing ever leaves.
    assert in_app.status == DeliveryStatus.SENT
    assert in_app.sent_at is not None


def test_no_email_delivery_row_exists_when_no_address_is_supplied():
    notification = create_notification(
        recipient=make_user(email="recipient2@phase6.example"),
        notification_type=NotificationType.INQUIRY_RECEIVED,
        title_key="notification.inquiry_received.title",
        body_key="notification.inquiry_received.body",
        target_url="/dashboard/messages/abc/",
    )
    assert notification.deliveries.filter(channel=DeliveryChannel.EMAIL).exists() is False


def test_no_websocket_delivery_row_is_ever_written_by_this_phase():
    """Spec 2.1: a QUEUED row for a channel nothing drains is a fabricated state.
    Phase 18 owns 27.2 and adds the WEBSOCKET row when it adds the consumer."""
    notification = create_notification(
        recipient=make_user(email="recipient3@phase6.example"),
        notification_type=NotificationType.INQUIRY_RECEIVED,
        title_key="notification.inquiry_received.title",
        body_key="notification.inquiry_received.body",
        target_url="/dashboard/messages/abc/",
        email_to="someone@phase6.example",
    )
    assert set(notification.deliveries.values_list("channel", flat=True)) == {
        DeliveryChannel.IN_APP,
        DeliveryChannel.EMAIL,
    }


def test_one_delivery_row_per_channel_is_enforced_by_the_database():
    notification = create_notification(
        recipient=make_user(email="recipient4@phase6.example"),
        notification_type=NotificationType.INQUIRY_RECEIVED,
        title_key="notification.inquiry_received.title",
        body_key="notification.inquiry_received.body",
        target_url="/dashboard/messages/abc/",
    )
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            NotificationDelivery.objects.create(
                notification=notification, channel=DeliveryChannel.IN_APP
            )


def test_a_repeated_dedupe_key_returns_the_same_row_and_adds_no_delivery():
    """Spec 27.1 gives `inquiry.received` a deduplication key (the message ID)
    and spec 27's acceptance tests require that "Retried task does not create
    duplicate in-app notification/delivery"."""
    recipient = make_user(email="dedupe@phase6.example")
    kwargs = {
        "recipient": recipient,
        "notification_type": NotificationType.INQUIRY_RECEIVED,
        "title_key": "notification.inquiry_received.title",
        "body_key": "notification.inquiry_received.body",
        "target_url": "/dashboard/messages/abc/",
        "dedupe_key": "message-1",
    }
    first = create_notification(**kwargs)
    second = create_notification(**kwargs)

    assert second.pk == first.pk
    assert Notification.objects.count() == 1
    assert first.deliveries.count() == 1


def test_a_repeated_dedupe_key_queues_no_second_email():
    recipient = make_user(email="dedupe2@phase6.example")
    kwargs = {
        "recipient": recipient,
        "notification_type": NotificationType.INQUIRY_RECEIVED,
        "title_key": "notification.inquiry_received.title",
        "body_key": "notification.inquiry_received.body",
        "target_url": "/dashboard/messages/abc/",
        "dedupe_key": "message-2",
        "email_to": "office@phase6.example",
    }
    first = create_notification(**kwargs)
    create_notification(**kwargs)

    assert first.deliveries.filter(channel=DeliveryChannel.EMAIL).count() == 1


def test_the_same_key_for_two_recipients_is_two_notifications():
    """Spec 15.4: one message legitimately notifies every broker team member
    with can_read_messages. The constraint is scoped per recipient for exactly
    that reason."""
    kwargs = {
        "notification_type": NotificationType.INQUIRY_RECEIVED,
        "title_key": "notification.inquiry_received.title",
        "body_key": "notification.inquiry_received.body",
        "target_url": "/dashboard/messages/abc/",
        "dedupe_key": "message-3",
    }
    create_notification(recipient=make_user(email="dd-a@phase6.example"), **kwargs)
    create_notification(recipient=make_user(email="dd-b@phase6.example"), **kwargs)

    assert Notification.objects.filter(dedupe_key="message-3").count() == 2


def test_a_blank_dedupe_key_is_never_deduplicated():
    """An event type with no natural key must still be creatable more than once;
    the unique index is partial and exempts the empty string."""
    recipient = make_user(email="dedupe3@phase6.example")
    for _ in range(2):
        create_notification(
            recipient=recipient,
            notification_type=NotificationType.INQUIRY_RECEIVED,
            title_key="notification.inquiry_received.title",
            body_key="notification.inquiry_received.body",
            target_url="/dashboard/messages/abc/",
        )
    assert Notification.objects.filter(recipient=recipient).count() == 2


def test_notifications_are_ordered_newest_first():
    recipient = make_user(email="recipient5@phase6.example")
    first = create_notification(
        recipient=recipient,
        notification_type=NotificationType.INQUIRY_RECEIVED,
        title_key="notification.inquiry_received.title",
        body_key="notification.inquiry_received.body",
        target_url="/dashboard/messages/a/",
    )
    second = create_notification(
        recipient=recipient,
        notification_type=NotificationType.INQUIRY_RECEIVED,
        title_key="notification.inquiry_received.title",
        body_key="notification.inquiry_received.body",
        target_url="/dashboard/messages/b/",
    )
    assert list(Notification.objects.filter(recipient=recipient)) == [second, first]
```

`backend/notifications/tests/test_notification_email.py`:

```python
"""Spec 27.3: queue only after commit, localize by recipient locale with EN
fallback, include a safe summary and a platform URL, and never include hidden
recipient contact data."""

import pytest
from django.core import mail
from django.test import override_settings

from accounts.enums import Locale
from accounts.tests.factories import make_user
from notifications.enums import DeliveryChannel, DeliveryStatus, NotificationType
from notifications.services import create_notification
from notifications.tasks import send_notification_email

pytestmark = pytest.mark.django_db


def _notify(recipient, **kwargs):
    return create_notification(
        recipient=recipient,
        notification_type=NotificationType.INQUIRY_RECEIVED,
        title_key="notification.inquiry_received.title",
        body_key="notification.inquiry_received.body",
        target_url="/dashboard/messages/abc/",
        payload={
            "sender_display_name": "Ada Rossi",
            "context_label": "Azimut Atlantis 43",
            "excerpt": "I would like to arrange a viewing next week.",
        },
        **kwargs,
    )


@override_settings(PUBLIC_BASE_URL="https://nauta.test")
def test_the_email_carries_the_excerpt_and_a_platform_link():
    recipient = make_user(email="pro@phase6.example", locale=Locale.EN)
    notification = _notify(recipient, email_to="office@phase6.example")
    mail.outbox.clear()

    send_notification_email(str(notification.pk), "office@phase6.example")

    assert len(mail.outbox) == 1
    sent = mail.outbox[0]
    assert sent.to == ["office@phase6.example"]
    assert "Ada Rossi" in sent.body
    assert "Azimut Atlantis 43" in sent.body
    assert "I would like to arrange a viewing next week." in sent.body
    assert "https://nauta.test/dashboard/messages/abc/" in sent.body


def test_the_email_is_localized_by_recipient_locale_with_an_en_fallback():
    italian = make_user(email="it@phase6.example", locale=Locale.IT)
    notification = _notify(italian, email_to="it-office@phase6.example")
    mail.outbox.clear()
    send_notification_email(str(notification.pk), "it-office@phase6.example")
    assert mail.outbox[0].subject == "Nuovo messaggio su NAUTA"

    english = make_user(email="en@phase6.example", locale=Locale.EN)
    notification = _notify(english, email_to="en-office@phase6.example")
    mail.outbox.clear()
    send_notification_email(str(notification.pk), "en-office@phase6.example")
    assert mail.outbox[0].subject == "New message on NAUTA"


def test_a_successful_send_marks_the_delivery_row_sent():
    recipient = make_user(email="pro2@phase6.example")
    notification = _notify(recipient, email_to="office2@phase6.example")
    delivery = notification.deliveries.get(channel=DeliveryChannel.EMAIL)
    assert delivery.status == DeliveryStatus.QUEUED

    send_notification_email(str(notification.pk), "office2@phase6.example")

    delivery.refresh_from_db()
    assert delivery.status == DeliveryStatus.SENT
    assert delivery.sent_at is not None
    assert delivery.attempt_count == 1


def test_a_retried_task_does_not_send_the_email_twice():
    """Spec 27's acceptance test, verbatim: "Retried task does not create
    duplicate in-app notification/delivery."

    Celery redelivers after a lost worker just as readily when the send already
    succeeded as when it failed, and the broker cannot tell the two apart, so
    the second run has to be a no-op.
    """
    recipient = make_user(email="retry@phase6.example")
    notification = _notify(recipient, email_to="retry-office@phase6.example")
    mail.outbox.clear()

    send_notification_email(str(notification.pk), "retry-office@phase6.example")
    send_notification_email(str(notification.pk), "retry-office@phase6.example")

    assert len(mail.outbox) == 1
    delivery = notification.deliveries.get(channel=DeliveryChannel.EMAIL)
    assert delivery.status == DeliveryStatus.SENT
    assert delivery.attempt_count == 1


def test_a_vanished_notification_is_skipped_not_crashed():
    """Spec 27.3: "permanent failure is visible to staff without rolling back the
    original business transaction"."""
    import uuid

    send_notification_email(str(uuid.uuid4()), "nobody@phase6.example")
    # No exception, nothing sent.
    assert mail.outbox == []


def test_the_email_job_is_queued_only_after_the_transaction_commits(
    django_capture_on_commit_callbacks,
):
    """Spec 15.3 step 6 and 27.3.

    `django_capture_on_commit_callbacks` (pytest-django) is required, not
    optional: a plain `@pytest.mark.django_db` test runs inside an atomic block
    that is rolled back and never committed, so on_commit callbacks would never
    fire at all and a naive `with transaction.atomic():` version of this test
    would fail on the last line. CELERY_TASK_ALWAYS_EAGER is on in
    config/settings/test.py, so once the callback does run the mail is sent
    inline - which is what makes the in-block assertion meaningful: a task
    scheduled OUTSIDE on_commit would have filled the outbox already.
    """
    recipient = make_user(email="pro3@phase6.example")
    mail.outbox.clear()
    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        _notify(recipient, email_to="office3@phase6.example")
        assert mail.outbox == []
    assert len(callbacks) == 1
    assert len(mail.outbox) == 1
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd backend && uv run pytest notifications/tests/ -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'notifications'`.

- [ ] **Step 4a: Write `backend/notifications/enums.py`**

```python
"""Notification vocabulary (NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md 11.10, 27.1)."""

from django.db import models


class NotificationType(models.TextChoices):
    """Spec 27.1's event names, verbatim and dotted.

    Only the event this phase produces is declared. Phase 18 appends the other
    ten from 27.1's table; appending a member is additive and needs no
    migration, because `notification_type` is a plain CharField (choices are a
    Django-level validation, not a database enum).
    """

    INQUIRY_RECEIVED = "inquiry.received", "Inquiry received"


class DeliveryChannel(models.TextChoices):
    IN_APP = "IN_APP", "In-app"
    WEBSOCKET = "WEBSOCKET", "WebSocket"
    EMAIL = "EMAIL", "Email"


class DeliveryStatus(models.TextChoices):
    QUEUED = "QUEUED", "Queued"
    SENT = "SENT", "Sent"
    FAILED = "FAILED", "Failed"
    SKIPPED = "SKIPPED", "Skipped"


#: Spec 27.3's "safe summary" / 15.4's "safe excerpt", capped so a notification
#: payload never becomes a second copy of the whole message body.
EXCERPT_MAX_LENGTH = 200
```

- [ ] **Step 4b: Write `backend/notifications/models.py`**

```python
"""Notification store (NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md 11.10)."""

from django.conf import settings
from django.core.serializers.json import DjangoJSONEncoder
from django.db import models

from common.models import UUIDTimeStampedModel
from notifications.enums import DeliveryChannel, DeliveryStatus


class Notification(UUIDTimeStampedModel):
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="notifications",
        on_delete=models.CASCADE,
    )
    # Spec 11.10 names this column `type`. The Python attribute is
    # notification_type because `type` shadows the builtin at every call site;
    # the WIRE name stays `type` (Phase 18's serializer sets
    # source="notification_type"). See the note in this task.
    notification_type = models.CharField(max_length=64)
    title_key = models.CharField(max_length=120)
    body_key = models.CharField(max_length=120)
    payload = models.JSONField(default=dict, blank=True, encoder=DjangoJSONEncoder)
    target_url = models.CharField(max_length=300)
    read_at = models.DateTimeField(null=True, blank=True)
    # Spec 27.1's "Deduplication key" column, which every row of that table
    # defines (`inquiry.received` -> message ID) but 11.10's field list omits.
    # Recorded as an addition beyond 11.10 rather than presented as spec-literal.
    # Blank means "not deduplicated" and is never constrained, so an event type
    # that has no natural key can still be created.
    dedupe_key = models.CharField(max_length=200, blank=True, default="")

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["recipient", "read_at"]),
            models.Index(fields=["recipient", "-created_at"]),
        ]
        constraints = [
            # Spec 27's acceptance test: "Retried task does not create duplicate
            # in-app notification/delivery." Partial, so the empty key is exempt.
            # Scoped to the recipient because one message legitimately produces
            # one notification per broker team member (spec 15.4).
            models.UniqueConstraint(
                fields=["recipient", "notification_type", "dedupe_key"],
                condition=~models.Q(dedupe_key=""),
                name="notifications_dedupe_key_unique_per_recipient",
            ),
        ]

    def __str__(self):
        return f"{self.notification_type} -> {self.recipient_id}"


class NotificationDelivery(UUIDTimeStampedModel):
    notification = models.ForeignKey(
        Notification, related_name="deliveries", on_delete=models.CASCADE
    )
    channel = models.CharField(max_length=10, choices=DeliveryChannel.choices)
    status = models.CharField(
        max_length=10, choices=DeliveryStatus.choices, default=DeliveryStatus.QUEUED
    )
    attempt_count = models.PositiveIntegerField(default=0)
    provider_message_id = models.CharField(max_length=255, blank=True, default="")
    last_error_code = models.CharField(max_length=64, blank=True, default="")
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("channel",)
        constraints = [
            models.UniqueConstraint(
                fields=["notification", "channel"],
                name="notifications_one_delivery_per_channel",
            ),
        ]

    def __str__(self):
        return f"{self.channel}:{self.status} for {self.notification_id}"
```

- [ ] **Step 4c: Write `backend/notifications/services.py`**

```python
"""Notification creation (spec 11.10, 15.3 steps 5-6, 27.3)."""

from django.db import transaction
from django.utils import timezone

from notifications.enums import DeliveryChannel, DeliveryStatus
from notifications.models import Notification, NotificationDelivery


def create_notification(
    *,
    recipient,
    notification_type: str,
    title_key: str,
    body_key: str,
    target_url: str,
    payload: dict | None = None,
    email_to: str = "",
    dedupe_key: str = "",
) -> Notification:
    """Create one in-app notification and, when an address is given, queue its
    email for AFTER the surrounding transaction commits (spec 27.3: "Queue only
    after commit"; spec 2.3: "Notifications are scheduled through
    transaction.on_commit()").

    IDEMPOTENT on `dedupe_key` (spec 27.1's per-event "Deduplication key"; for
    `inquiry.received` that key is the message ID). A second call with the same
    (recipient, type, key) returns the EXISTING row and queues no second email -
    which is what spec 27's acceptance test "Retried task does not create
    duplicate in-app notification/delivery" asks for, and what makes a retried
    or replayed caller safe. `get_or_create` plus a partial unique index, not a
    bare existence check: two workers can race, and only the index settles it.

    Callers invoke this from INSIDE their own transaction.atomic() block, so a
    rolled-back business transaction leaves no notification and sends no email.
    No WEBSOCKET delivery row is written: Phase 18 owns spec 27.2 and adds the
    row in the same change that adds the consumer that drains it.
    """
    defaults = {
        "title_key": title_key,
        "body_key": body_key,
        "target_url": target_url,
        "payload": payload or {},
    }
    if dedupe_key:
        notification, created = Notification.objects.get_or_create(
            recipient=recipient,
            notification_type=notification_type,
            dedupe_key=dedupe_key,
            defaults=defaults,
        )
        if not created:
            # Already delivered once. Returning early is the whole point: no
            # second IN_APP row (the unique(notification, channel) constraint
            # would refuse it anyway) and, more importantly, no second email.
            return notification
    else:
        notification = Notification.objects.create(
            recipient=recipient,
            notification_type=notification_type,
            dedupe_key="",
            **defaults,
        )

    NotificationDelivery.objects.create(
        notification=notification,
        channel=DeliveryChannel.IN_APP,
        status=DeliveryStatus.SENT,
        attempt_count=1,
        sent_at=timezone.now(),
    )

    if email_to:
        NotificationDelivery.objects.create(
            notification=notification,
            channel=DeliveryChannel.EMAIL,
            status=DeliveryStatus.QUEUED,
        )
        notification_id = str(notification.pk)
        # Imported here, not at module scope: notifications.tasks imports this
        # module's models, and a module-level import in both directions is a
        # cycle Celery's autodiscovery would hit at worker start-up.
        from notifications.tasks import send_notification_email

        transaction.on_commit(
            lambda: send_notification_email.delay(notification_id, email_to)
        )

    return notification
```

- [ ] **Step 4d: Write `backend/notifications/tasks.py`**

```python
"""Email delivery for notifications (spec 27.3).

Subjects and bodies are per-locale dictionaries rather than concatenated English
(spec 37). The pattern mirrors accounts/tasks.py, which is the project's one
existing transactional-email task.
"""

import logging

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from notifications.enums import DeliveryChannel, DeliveryStatus
from notifications.models import Notification, NotificationDelivery

logger = logging.getLogger(__name__)

SUBJECTS = {
    "EN": "New message on NAUTA",
    "IT": "Nuovo messaggio su NAUTA",
    "ES": "Nuevo mensaje en NAUTA",
}
# Used when the sender's account carries no name. Never their email address:
# messaging._reply_display_name deliberately stores "" rather than letting
# User.get_full_name()'s `full_name or email` fallback leak an address into a
# message another party reads. Per-locale, not a concatenated literal (spec 37).
SENDER_FALLBACK = {
    "EN": "A NAUTA user",
    "IT": "Un utente NAUTA",
    "ES": "Un usuario de NAUTA",
}
BODIES = {
    "EN": (
        "{sender} sent you a message about {context} on NAUTA.\n\n"
        "{excerpt}\n\n"
        "Read and reply on NAUTA:\n{url}\n\n"
        "Reply through NAUTA so the conversation stays on the platform."
    ),
    "IT": (
        "{sender} ti ha inviato un messaggio su {context} tramite NAUTA.\n\n"
        "{excerpt}\n\n"
        "Leggi e rispondi su NAUTA:\n{url}\n\n"
        "Rispondi tramite NAUTA per mantenere la conversazione sulla piattaforma."
    ),
    "ES": (
        "{sender} te ha enviado un mensaje sobre {context} en NAUTA.\n\n"
        "{excerpt}\n\n"
        "Lee y responde en NAUTA:\n{url}\n\n"
        "Responde a traves de NAUTA para mantener la conversacion en la plataforma."
    ),
}


@shared_task(queue="notifications", bind=True, max_retries=3, default_retry_delay=60)
def send_notification_email(self, notification_id: str, to_email: str) -> None:
    notification = (
        Notification.objects.select_related("recipient")
        .filter(pk=notification_id)
        .first()
    )
    if notification is None:
        # Spec 27.3: a permanent failure is visible without rolling anything back.
        logger.warning(
            "notification email skipped: notification %s no longer exists",
            notification_id,
        )
        return

    locale = notification.recipient.locale
    if locale not in SUBJECTS:
        locale = "EN"

    payload = notification.payload or {}
    body = BODIES[locale].format(
        sender=payload.get("sender_display_name") or SENDER_FALLBACK[locale],
        context=payload.get("context_label", ""),
        excerpt=payload.get("excerpt", ""),
        url=f"{settings.PUBLIC_BASE_URL}{notification.target_url}",
    )

    delivery, _ = NotificationDelivery.objects.get_or_create(
        notification=notification, channel=DeliveryChannel.EMAIL
    )
    if delivery.status == DeliveryStatus.SENT:
        # Spec 27's acceptance test: a retried task must not duplicate a
        # delivery. Celery redelivers on worker loss AFTER the send succeeded
        # just as readily as after it failed, and the broker cannot tell the two
        # apart - so the only safe answer is to make the second run a no-op.
        logger.info(
            "notification email already sent; skipping retry",
            extra={"notification_id": str(notification.pk)},
        )
        return
    delivery.attempt_count += 1
    try:
        send_mail(
            subject=SUBJECTS[locale],
            message=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[to_email],
        )
    except Exception as exc:  # noqa: BLE001 - re-raised via Celery's retry below
        delivery.status = DeliveryStatus.FAILED
        delivery.last_error_code = type(exc).__name__[:64]
        delivery.save(
            update_fields=["status", "last_error_code", "attempt_count", "updated_at"]
        )
        # Spec 27.3: "Retries are bounded." Never log the message body.
        logger.warning(
            "notification email failed",
            extra={"notification_id": str(notification.pk), "error": type(exc).__name__},
        )
        raise self.retry(exc=exc)

    delivery.status = DeliveryStatus.SENT
    delivery.sent_at = timezone.now()
    delivery.save(update_fields=["status", "sent_at", "attempt_count", "updated_at"])
    logger.info(
        "notification email sent", extra={"notification_id": str(notification.pk)}
    )
```

- [ ] **Step 4e: Write `backend/notifications/admin.py` and `backend/notifications/tests/factories.py`**

`backend/notifications/admin.py`:

```python
from django.contrib import admin

from notifications.models import Notification, NotificationDelivery


class NotificationDeliveryInline(admin.TabularInline):
    model = NotificationDelivery
    extra = 0
    can_delete = False
    readonly_fields = (
        "channel",
        "status",
        "attempt_count",
        "provider_message_id",
        "last_error_code",
        "sent_at",
    )

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    """Read-only: spec 33.4 wants delivery failures visible to staff, which is a
    read, and every write belongs to a service function (spec 3)."""

    list_display = ("id", "notification_type", "recipient", "read_at", "created_at")
    list_filter = ("notification_type",)
    search_fields = ("id", "recipient__email")
    readonly_fields = tuple(field.name for field in Notification._meta.fields)
    inlines = [NotificationDeliveryInline]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
```

`backend/notifications/tests/factories.py`:

```python
from notifications.enums import NotificationType
from notifications.services import create_notification


def make_notification(
    *,
    recipient,
    notification_type=NotificationType.INQUIRY_RECEIVED,
    title_key="notification.inquiry_received.title",
    body_key="notification.inquiry_received.body",
    target_url="/dashboard/messages/00000000-0000-4000-8000-000000000000/",
    payload=None,
    email_to="",
):
    return create_notification(
        recipient=recipient,
        notification_type=notification_type,
        title_key=title_key,
        body_key=body_key,
        target_url=target_url,
        payload=payload,
        email_to=email_to,
    )
```

- [ ] **Step 4f: Register the app and its Celery route**

In `backend/config/settings/base.py`, append `"notifications",` to `INSTALLED_APPS` immediately after `"messaging",` (which Task 1 added after the merged `"entitlements"`), and append one entry to the existing `CELERY_TASK_ROUTES` dict. Both are **append only** — read the real file:

```python
    "listings",
    "entitlements",
    "messaging",
    "notifications",
    "platform_settings",
]
```

```python
CELERY_TASK_ROUTES = {
    "common.tasks.*": {"queue": "default"},
    "accounts.tasks.*": {"queue": "notifications"},
    "notifications.tasks.*": {"queue": "notifications"},
}
```

- [ ] **Step 4g: Generate the migration**

Run: `cd backend && uv run python manage.py makemigrations notifications`
Expected: `notifications/migrations/0001_initial.py` creating both models.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd backend && uv run pytest notifications/tests/ -v`
Expected: PASS — **10** items in `test_notification_models.py` and **6** in `test_notification_email.py`.

Run: `cd backend && uv run python manage.py check`
Expected: `System check identified no issues`.

- [ ] **Step 6: Commit**

```bash
git add backend/notifications backend/config/settings/base.py
git commit -m "feat(notifications): spec 11.10 models, in-app creation and the post-commit email channel"
```

---

### Task 5: Server-side context resolution — who the recipient is, and whether they can be reached

**Files:**
- Create: `backend/messaging/context.py`, `backend/messaging/exceptions.py`, `backend/messaging/selectors.py`
- Test: `backend/messaging/tests/test_context_resolution.py`

**Interfaces:**
- Consumes: `messaging.enums.InquiryContextType`, `CONTEXT_TO_CONVERSATION_TYPE`, `ContactTargetType` (Task 1); `messaging.models.ContactAccessGrant` (Task 3); `listings.views.published_listings_queryset()` (Phase 11, **read only**); `brokers.models.BrokerOrganization`/`BrokerMembership` and `brokers.enums.BrokerOrganizationStatus` (Phase 3, read only); `professionals.models.ProfessionalProfile` and `professionals.enums.ProfessionalProfileStatus` (Phase 3, read only).
- Produces:
  - `messaging.exceptions.InvalidInquiryContext` — `APIException`, 400, `default_code="invalid_context"`
  - `messaging.exceptions.RecipientUnavailable` — `APIException`, 409, `default_code="recipient_unavailable"`
  - `messaging.exceptions.SelfInquiryNotAllowed` — `APIException`, 400, `default_code="self_inquiry_not_allowed"`
  - `messaging.exceptions.MessagingThrottled` — `Throttled` subclass, 429, `default_code="rate_limited"`, sets `self.meta = {"retry_after_seconds": int}`. Defined here with the rest of the vocabulary; first *used* in Task 6 (the duplicate-message guard) and Task 7 (the view-level throttle override).
  - `messaging.context.InquiryContext` — frozen dataclass: `context_type`, `conversation_type`, `listing`, `broker`, `professional`, `contact_target_type`, `recipient_users: tuple`, `recipient_email: str`, `context_label: str`
  - `messaging.context.resolve_inquiry_context(*, actor, context_type, context_id) -> InquiryContext`
  - `messaging.selectors.broker_message_readers(broker) -> QuerySet[User]`
  - `messaging.selectors.active_contact_grant(viewer, *, broker=None, professional=None) -> ContactAccessGrant | None`

- [ ] **Step 1: Write the failing test**

`backend/messaging/tests/test_context_resolution.py`:

```python
"""Spec 11.8: "clients may not choose an arbitrary recipient ID"; spec 33.1:
"never trusting recipient/owner IDs from client without context resolution".

Every recipient below is derived from the context object's own ownership.
"""

import uuid

import pytest

from accounts.tests.factories import make_user
from brokers.enums import BrokerMembershipRole, BrokerOrganizationStatus
from brokers.tests.factories import make_broker, make_membership
from listings.tests.factories import (
    make_broker_listing,
    make_private_listing,
    make_snapshot,
)
from listings.enums import ListingStatus
from messaging.context import resolve_inquiry_context
from messaging.enums import ContactTargetType, ConversationType, InquiryContextType
from messaging.exceptions import (
    InvalidInquiryContext,
    RecipientUnavailable,
    SelfInquiryNotAllowed,
)
from professionals.enums import ProfessionalProfileStatus
from professionals.tests.factories import make_professional

pytestmark = pytest.mark.django_db


@pytest.fixture
def asker():
    return make_user(email="ctx-asker@phase6.example")


@pytest.fixture
def staff_approver():
    return make_user(email="ctx-approver@phase6.example")


def _publish(listing, approver):
    """Make a listing publicly visible the way listings.views.published_listings_queryset
    defines it: PUBLISHED status AND a current public snapshot (Phase 11 rule 1)."""
    snapshot = make_snapshot(listing, approved_by=approver)
    listing.status = ListingStatus.PUBLISHED
    listing.current_public_snapshot = snapshot
    listing.save(
        update_fields=["status", "current_public_snapshot", "updated_at"]
    )
    return listing


def test_unknown_context_type_is_invalid_context(asker):
    with pytest.raises(InvalidInquiryContext):
        resolve_inquiry_context(
            actor=asker, context_type="SUPPORT", context_id=uuid.uuid4()
        )


def test_a_non_uuid_context_id_is_invalid_context(asker):
    with pytest.raises(InvalidInquiryContext):
        resolve_inquiry_context(
            actor=asker,
            context_type=InquiryContextType.BROKER,
            context_id="not-a-uuid",
        )


def test_a_uuid_that_matches_nothing_is_recipient_unavailable_not_404(asker):
    """Spec 34.3: "Pending listing is absent publicly." Distinguishing "exists
    but hidden" from "does not exist" would be an enumeration oracle over
    private listings, so both answer the same way."""
    with pytest.raises(RecipientUnavailable):
        resolve_inquiry_context(
            actor=asker,
            context_type=InquiryContextType.LISTING,
            context_id=uuid.uuid4(),
        )


def test_professional_context_resolves_its_owner_and_public_email(asker):
    owner = make_user(email="ctx-pro-owner@phase6.example")
    professional = make_professional(
        owner,
        display_name="Phase6 Ctx Surveyors",
        slug="phase6-ctx-surveyors",
        public_email="hello@phase6-ctx.example",
    )

    context = resolve_inquiry_context(
        actor=asker,
        context_type=InquiryContextType.PROFESSIONAL,
        context_id=professional.pk,
    )

    assert context.conversation_type == ConversationType.PROFESSIONAL_INQUIRY
    assert context.professional == professional
    assert context.broker is None and context.listing is None
    assert context.contact_target_type == ContactTargetType.PROFESSIONAL
    assert [user.pk for user in context.recipient_users] == [owner.pk]
    assert context.recipient_email == "hello@phase6-ctx.example"
    assert context.context_label == "Phase6 Ctx Surveyors"


@pytest.mark.parametrize(
    "status",
    [
        ProfessionalProfileStatus.DRAFT,
        ProfessionalProfileStatus.PENDING,
        ProfessionalProfileStatus.SUSPENDED,
    ],
)
def test_a_non_active_professional_cannot_receive_an_inquiry(asker, status):
    owner = make_user(email=f"ctx-pro-{status.lower()}@phase6.example")
    professional = make_professional(
        owner,
        display_name=f"Phase6 {status}",
        slug=f"phase6-pro-{status.lower()}",
        status=status,
    )
    with pytest.raises(RecipientUnavailable):
        resolve_inquiry_context(
            actor=asker,
            context_type=InquiryContextType.PROFESSIONAL,
            context_id=professional.pk,
        )


def test_a_professional_cannot_inquire_to_their_own_profile():
    owner = make_user(email="ctx-self-pro@phase6.example")
    professional = make_professional(
        owner, display_name="Phase6 Self", slug="phase6-self-pro"
    )
    with pytest.raises(SelfInquiryNotAllowed):
        resolve_inquiry_context(
            actor=owner,
            context_type=InquiryContextType.PROFESSIONAL,
            context_id=professional.pk,
        )


def test_broker_context_notifies_only_members_with_can_read_messages(asker):
    broker = make_broker(name="Phase6 Ctx Brokers", slug="phase6-ctx-brokers")
    reader = make_user(email="ctx-reader@phase6.example")
    editor = make_user(email="ctx-editor@phase6.example")
    inactive_reader = make_user(email="ctx-inactive@phase6.example")
    make_membership(
        reader, broker, role=BrokerMembershipRole.MANAGER, can_read_messages=True
    )
    # An AGENT with can_edit_listings but not can_read_messages: Phase 3 contract
    # rule 4's exact warning - editing power must not leak message access.
    make_membership(
        editor, broker, role=BrokerMembershipRole.AGENT, can_edit_listings=True
    )
    make_membership(
        inactive_reader,
        broker,
        role=BrokerMembershipRole.MANAGER,
        can_read_messages=True,
        is_active=False,
    )

    context = resolve_inquiry_context(
        actor=asker,
        context_type=InquiryContextType.BROKER,
        context_id=broker.pk,
    )

    assert [user.pk for user in context.recipient_users] == [reader.pk]
    assert context.recipient_email == broker.public_email
    assert context.contact_target_type == ContactTargetType.BROKER
    assert context.context_label == "Phase6 Ctx Brokers"


def test_a_suspended_broker_cannot_receive_an_inquiry(asker):
    broker = make_broker(
        name="Phase6 Suspended",
        slug="phase6-suspended",
        status=BrokerOrganizationStatus.SUSPENDED,
    )
    with pytest.raises(RecipientUnavailable):
        resolve_inquiry_context(
            actor=asker, context_type=InquiryContextType.BROKER, context_id=broker.pk
        )


def test_any_active_member_is_an_insider_and_cannot_inquire_to_their_own_broker():
    """Deliberately ANY active membership, not just one with a capability flag: a
    VIEWER minting a contact grant over their own organization is exactly the
    self-grant this rule exists to stop."""
    broker = make_broker(name="Phase6 Insider", slug="phase6-insider")
    viewer = make_user(email="ctx-viewer@phase6.example")
    make_membership(viewer, broker, role=BrokerMembershipRole.VIEWER)
    with pytest.raises(SelfInquiryNotAllowed):
        resolve_inquiry_context(
            actor=viewer, context_type=InquiryContextType.BROKER, context_id=broker.pk
        )


def test_broker_listing_context_carries_both_listing_and_broker(asker, staff_approver):
    broker = make_broker(name="Phase6 Fleet", slug="phase6-fleet")
    reader = make_user(email="ctx-fleet-reader@phase6.example")
    make_membership(
        reader, broker, role=BrokerMembershipRole.MANAGER, can_read_messages=True
    )
    listing = _publish(
        make_broker_listing(broker=broker, actor=reader), staff_approver
    )

    context = resolve_inquiry_context(
        actor=asker, context_type=InquiryContextType.LISTING, context_id=listing.pk
    )

    assert context.conversation_type == ConversationType.LISTING_INQUIRY
    assert context.listing == listing
    assert context.broker == broker
    assert context.professional is None
    assert context.contact_target_type == ContactTargetType.BROKER
    assert [user.pk for user in context.recipient_users] == [reader.pk]
    assert context.recipient_email == broker.public_email
    # The label comes from the immutable public snapshot, never from the draft
    # columns (Phase 11 contract rule 1).
    assert context.context_label == (
        f"{listing.current_public_snapshot.brand_name_snapshot} "
        f"{listing.current_public_snapshot.model_name_snapshot}"
    )


def test_private_listing_context_has_no_contact_target(asker, staff_approver):
    """Spec 11.8's target_type is BROKER|PROFESSIONAL. A private individual's
    address is not business contact data, so there is nothing to grant."""
    seller = make_user(email="ctx-seller@phase6.example")
    listing = _publish(make_private_listing(owner=seller), staff_approver)

    context = resolve_inquiry_context(
        actor=asker, context_type=InquiryContextType.LISTING, context_id=listing.pk
    )

    assert context.broker is None
    assert context.contact_target_type is None
    assert [user.pk for user in context.recipient_users] == [seller.pk]
    assert context.recipient_email == seller.email


def test_an_unpublished_listing_cannot_receive_an_inquiry(asker):
    seller = make_user(email="ctx-draft-seller@phase6.example")
    listing = make_private_listing(owner=seller)
    with pytest.raises(RecipientUnavailable):
        resolve_inquiry_context(
            actor=asker, context_type=InquiryContextType.LISTING, context_id=listing.pk
        )


def test_the_seller_cannot_inquire_about_their_own_published_listing(staff_approver):
    seller = make_user(email="ctx-self-seller@phase6.example")
    listing = _publish(make_private_listing(owner=seller), staff_approver)
    with pytest.raises(SelfInquiryNotAllowed):
        resolve_inquiry_context(
            actor=seller,
            context_type=InquiryContextType.LISTING,
            context_id=listing.pk,
        )


def test_a_broker_with_no_message_readers_resolves_to_an_empty_recipient_list(asker):
    """Not an error: the conversation is still real and appears in the inbox the
    moment staff grants someone can_read_messages. What it does mean is that
    nobody is notified right now - see the plan's Known Limitations."""
    broker = make_broker(name="Phase6 Silent", slug="phase6-silent")
    context = resolve_inquiry_context(
        actor=asker, context_type=InquiryContextType.BROKER, context_id=broker.pk
    )
    assert context.recipient_users == ()
    assert context.recipient_email == broker.public_email
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && uv run pytest messaging/tests/test_context_resolution.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'messaging.context'`.

- [ ] **Step 3a: Write `backend/messaging/exceptions.py`**

```python
"""Messaging error codes (spec 15.5, 30.2).

Each of these is an APIException subclass with a `default_code`, NOT a
ValidationError. That is deliberate and load-bearing:
common.exceptions.nauta_exception_handler maps EVERY ValidationError - subclass
or not - to code "validation_error", so a code that must reach the client as
`error.code` cannot be raised as a field error. Field errors still exist; they
arrive as `error.fields`, under the single code "validation_error".
"""

from rest_framework import status
from rest_framework.exceptions import APIException, Throttled


class InvalidInquiryContext(APIException):
    """The request itself is malformed: an unknown context_type or a
    context_id that is not a UUID. Never used for "not found" - see
    RecipientUnavailable."""

    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "This inquiry context is not recognised."
    default_code = "invalid_context"


class RecipientUnavailable(APIException):
    """The context does not resolve to something reachable: it does not exist,
    it is not published, or its owner is DRAFT/PENDING/SUSPENDED/inactive. All
    four answer identically on purpose (spec 34.3)."""

    status_code = status.HTTP_409_CONFLICT
    default_detail = "This recipient cannot receive messages right now."
    default_code = "recipient_unavailable"


class SelfInquiryNotAllowed(APIException):
    """Addition to spec 15.5's open list; see the plan's ruling."""

    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "You cannot send an inquiry to your own listing or profile."
    default_code = "self_inquiry_not_allowed"


class MessagingThrottled(Throttled):
    """429 with retry information (spec 30.4), under spec 15.5's own code name.

    DRF's stock Throttled uses code "throttled"; spec 15.5 names the code
    `rate_limited`, so the whole API speaks one vocabulary. `meta` rides the
    envelope passthrough common.exceptions.nauta_exception_handler already has,
    and DRF's handler independently sets the Retry-After header from `wait`.
    """

    default_detail = "You are sending messages too quickly."
    extra_detail_singular = "Try again in {wait} second."
    extra_detail_plural = "Try again in {wait} seconds."
    default_code = "rate_limited"

    def __init__(self, wait=None, detail=None, code=None):
        super().__init__(wait=wait, detail=detail, code=code)
        self.meta = {} if self.wait is None else {"retry_after_seconds": int(self.wait)}
```

- [ ] **Step 3b: Write `backend/messaging/selectors.py`**

```python
"""Read-side helpers for messaging."""

from django.contrib.auth import get_user_model

from brokers.enums import BrokerOrganizationStatus
from messaging.models import ContactAccessGrant

User = get_user_model()


def broker_message_readers(broker):
    """Spec 15.4: "team members with can_read_messages receive in-app visibility."

    Gates on can_read_messages ONLY, never on can_edit_listings - Phase 3
    contract rule 4. This is the queryset form of accounts.services'
    can_read_broker_messages(): same three conditions (active membership, ACTIVE
    organization, the capability flag), asked from the other direction.
    """
    return (
        User.objects.filter(
            is_active=True,
            broker_memberships__broker=broker,
            broker_memberships__is_active=True,
            broker_memberships__can_read_messages=True,
            broker_memberships__broker__status=BrokerOrganizationStatus.ACTIVE,
        )
        .order_by("pk")
        .distinct()
    )


def active_contact_grant(viewer, *, broker=None, professional=None):
    """The viewer's live grant over one target, or None (spec 11.8).

    Phase 7 reads this to decide LOCKED vs GRANTED. It returns the grant, never
    a contact value - masking and reveal are Phase 7's, and no function in this
    app returns an email address or phone number.
    """
    if broker is None and professional is None:
        return None
    return (
        ContactAccessGrant.objects.filter(
            viewer=viewer,
            revoked_at__isnull=True,
            broker=broker,
            professional=professional,
        )
        .order_by("-granted_at")
        .first()
    )
```

- [ ] **Step 3c: Write `backend/messaging/context.py`**

```python
"""Server-side resolution of an inquiry's recipient (spec 11.8, 15.1, 33.1).

The client says what it is looking at (`context_type` + `context_id`); this
module decides who receives the message. A recipient id is never accepted from
a request body anywhere in this app.
"""

import uuid
from dataclasses import dataclass

from brokers.enums import BrokerOrganizationStatus
from brokers.models import BrokerMembership, BrokerOrganization
from listings.views import published_listings_queryset
from messaging.enums import (
    CONTEXT_TO_CONVERSATION_TYPE,
    ContactTargetType,
    InquiryContextType,
)
from messaging.exceptions import (
    InvalidInquiryContext,
    RecipientUnavailable,
    SelfInquiryNotAllowed,
)
from messaging.selectors import broker_message_readers
from professionals.enums import ProfessionalProfileStatus
from professionals.models import ProfessionalProfile


@dataclass(frozen=True)
class InquiryContext:
    """Everything the submission transaction needs, all of it server-derived."""

    context_type: str
    conversation_type: str
    listing: object | None
    broker: object | None
    professional: object | None
    #: BROKER, PROFESSIONAL, or None when there is nothing to grant (a private
    #: seller - spec 11.8's target_type has no member for a private person).
    contact_target_type: str | None
    #: Who receives the in-app notification (spec 15.4).
    recipient_users: tuple
    #: The single configured address the email goes to (spec 15.4: "not every
    #: member by default"). Empty string means "no address" and is never sent to.
    recipient_email: str
    #: Human label for the notification payload and the email subject line.
    context_label: str


def resolve_inquiry_context(*, actor, context_type, context_id) -> InquiryContext:
    if context_type not in CONTEXT_TO_CONVERSATION_TYPE:
        raise InvalidInquiryContext()
    try:
        target_id = uuid.UUID(str(context_id))
    except (AttributeError, TypeError, ValueError):
        raise InvalidInquiryContext() from None

    if context_type == InquiryContextType.LISTING:
        return _resolve_listing(actor, target_id)
    if context_type == InquiryContextType.BROKER:
        return _resolve_broker(actor, target_id)
    return _resolve_professional(actor, target_id)


def _is_broker_insider(actor, broker) -> bool:
    """ANY active membership, regardless of capability flags.

    A VIEWER has no capability at all, but letting them "inquire" to their own
    organization would mint a ContactAccessGrant over it and manufacture a
    conversation and a notification out of nothing.
    """
    return BrokerMembership.objects.filter(
        user=actor, broker=broker, is_active=True
    ).exists()


def _broker_context(actor, broker, *, listing=None, label=None) -> InquiryContext:
    if broker.status != BrokerOrganizationStatus.ACTIVE:
        raise RecipientUnavailable()
    if _is_broker_insider(actor, broker):
        raise SelfInquiryNotAllowed()
    # `listing is not None`, never a truthiness test: a model instance is always
    # truthy today, but relying on that makes the branch quietly wrong the day
    # anyone gives BoatListing a __bool__ or __len__.
    resolved_type = (
        InquiryContextType.LISTING if listing is not None else InquiryContextType.BROKER
    )
    return InquiryContext(
        context_type=resolved_type,
        conversation_type=CONTEXT_TO_CONVERSATION_TYPE[resolved_type],
        listing=listing,
        broker=broker,
        professional=None,
        contact_target_type=ContactTargetType.BROKER,
        recipient_users=tuple(broker_message_readers(broker)),
        recipient_email=broker.public_email,
        context_label=label or broker.name,
    )


def _resolve_broker(actor, target_id) -> InquiryContext:
    broker = BrokerOrganization.objects.filter(pk=target_id).first()
    if broker is None:
        raise RecipientUnavailable()
    return _broker_context(actor, broker)


def _resolve_professional(actor, target_id) -> InquiryContext:
    professional = (
        ProfessionalProfile.objects.select_related("owner_user")
        .filter(pk=target_id, status=ProfessionalProfileStatus.ACTIVE)
        .first()
    )
    if professional is None:
        raise RecipientUnavailable()
    owner = professional.owner_user
    if owner is None or not owner.is_active:
        raise RecipientUnavailable()
    if owner.pk == actor.pk:
        raise SelfInquiryNotAllowed()
    return InquiryContext(
        context_type=InquiryContextType.PROFESSIONAL,
        conversation_type=CONTEXT_TO_CONVERSATION_TYPE[
            InquiryContextType.PROFESSIONAL
        ],
        listing=None,
        broker=None,
        professional=professional,
        contact_target_type=ContactTargetType.PROFESSIONAL,
        recipient_users=(owner,),
        recipient_email=professional.public_email,
        context_label=professional.display_name,
    )


def _listing_label(listing) -> str:
    """Read from the immutable public snapshot only (Phase 11 contract rule 1).

    An Other-model listing carries its custom text in the snapshot; prefer it,
    because "Azimut Other" is not a boat anybody recognises.
    """
    snapshot = listing.current_public_snapshot
    model_name = (
        snapshot.custom_model_name_snapshot or snapshot.model_name_snapshot
    )
    return f"{snapshot.brand_name_snapshot} {model_name}".strip()


def _resolve_listing(actor, target_id) -> InquiryContext:
    listing = (
        published_listings_queryset()
        .select_related("broker", "owner_user", "current_public_snapshot")
        .filter(pk=target_id)
        .first()
    )
    if listing is None:
        raise RecipientUnavailable()

    label = _listing_label(listing)
    if listing.broker_id is not None:
        return _broker_context(actor, listing.broker, listing=listing, label=label)

    owner = listing.owner_user
    if owner is None or not owner.is_active:
        raise RecipientUnavailable()
    if owner.pk == actor.pk:
        raise SelfInquiryNotAllowed()
    return InquiryContext(
        context_type=InquiryContextType.LISTING,
        conversation_type=CONTEXT_TO_CONVERSATION_TYPE[InquiryContextType.LISTING],
        listing=listing,
        broker=None,
        professional=None,
        # Spec 11.8: a grant targets a BROKER or a PROFESSIONAL. A private
        # seller is neither, so nothing is granted and the API reports
        # NOT_APPLICABLE rather than inventing a third target type.
        contact_target_type=None,
        recipient_users=(owner,),
        recipient_email=owner.email,
        context_label=label,
    )
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && uv run pytest messaging/tests/test_context_resolution.py -v`
Expected: PASS — **16 collected test items** (13 plain tests plus `test_a_non_active_professional_cannot_receive_an_inquiry` × 3).

Then confirm nothing in `listings/` was touched, because three other phases are working there:

Run: `cd backend && git diff --name-only dev -- listings/ platform_settings/ common/ brokers/ professionals/ accounts/`
Expected: **empty output**.

- [ ] **Step 5: Commit**

```bash
git add backend/messaging
git commit -m "feat(messaging): server-side inquiry context resolution and recipient derivation"
```

---

### Task 6: `submit_inquiry()` — spec §15.3's six-step atomic transaction

**Files:**
- Create: `backend/messaging/services.py`, `backend/messaging/signals.py`, `backend/messaging/permissions.py`
- Modify (append): `backend/messaging/exceptions.py`
- Test: `backend/messaging/tests/test_submit_inquiry.py`

**Interfaces:**
- Consumes: `messaging.context.resolve_inquiry_context`, `messaging.selectors.active_contact_grant`, `messaging.exceptions.MessagingThrottled` (Task 5); `messaging.models.Conversation`/`Message`/`ContactAccessGrant` (Tasks 2, 3); `messaging.enums.*` (Task 1); `notifications.services.create_notification`, `notifications.enums.NotificationType`/`EXCERPT_MAX_LENGTH` (Task 4); `audit.services.record_audit_event`, `audit.models.AuditEvent`; `common.text.normalize_comparison_text`; `platform_settings.services.is_feature_enabled`; `accounts.permissions.IsEmailVerified`.
- Produces:
  - `messaging.exceptions.ConsentRequired` — `APIException`, 400, `default_code="consent_required"`
  - `messaging.signals.inquiry_received` — `Signal`, sent inside `transaction.on_commit()` with kwargs `sender=Message` (the class), `conversation`, `message`, `notification_ids: list[str]`
  - `messaging.exceptions.FeatureDisabled` — `APIException`, 403, `default_code="feature_disabled"`
  - `messaging.permissions.UnifiedInquiriesEnabled` — `BasePermission` that **raises** `FeatureDisabled` (never returns `False`; see the class docstring)
  - `messaging.permissions.InquiryEmailVerified` — subclass of `accounts.permissions.IsEmailVerified`, `code="email_verification_required"`
  - `messaging.services.InquiryResult` — frozen dataclass: `conversation`, `message`, `contact_access: str`, `next_url: str`, `created_conversation: bool`, `created_grant: bool`
  - `messaging.services.submit_inquiry(*, actor, context_type, context_id, full_name, phone, subject, body, privacy_policy_version, marketing_consent=False, request_id=None) -> InquiryResult`
  - `messaging.services.grant_contact_access(*, viewer, context, conversation, request_id=None) -> tuple[ContactAccessGrant | None, bool]`
  - `messaging.services.message_excerpt(body: str) -> str`

- [ ] **Step 1: Write the failing test**

`backend/messaging/tests/test_submit_inquiry.py`:

```python
"""Spec 15.3's submission transaction, step by step, plus spec 40 Scenarios A
and B."""

import pytest
from django.core import mail
from django.utils import timezone

from accounts.tests.factories import make_user
from audit.models import AuditEvent
from brokers.enums import BrokerMembershipRole
from brokers.tests.factories import make_broker, make_membership
from listings.enums import ListingStatus
from listings.tests.factories import (
    make_broker_listing,
    make_private_listing,
    make_snapshot,
)
from messaging.enums import (
    CURRENT_PRIVACY_POLICY_VERSION,
    ContactAccessOutcome,
    ContactTargetType,
    ConversationStatus,
    ConversationType,
    InquiryContextType,
)
from messaging.exceptions import ConsentRequired, MessagingThrottled
from messaging.models import ContactAccessGrant, Conversation, Message
from messaging.services import submit_inquiry
from notifications.models import Notification
from professionals.tests.factories import make_professional

pytestmark = pytest.mark.django_db

BODY = "I would like to arrange a viewing next week, if that suits you."


def _publish(listing, approver):
    snapshot = make_snapshot(listing, approved_by=approver)
    listing.status = ListingStatus.PUBLISHED
    listing.current_public_snapshot = snapshot
    listing.save(update_fields=["status", "current_public_snapshot", "updated_at"])
    return listing


def _submit(actor, context_type, context_id, **overrides):
    payload = {
        "actor": actor,
        "context_type": context_type,
        "context_id": context_id,
        "full_name": "Ada Rossi",
        "phone": "+390000000000",
        "subject": "Question about your services",
        "body": BODY,
        "privacy_policy_version": CURRENT_PRIVACY_POLICY_VERSION,
        "marketing_consent": False,
        "request_id": "req-phase6",
    }
    payload.update(overrides)
    return submit_inquiry(**payload)


@pytest.fixture
def asker():
    return make_user(email="svc-asker@phase6.example")


@pytest.fixture
def professional():
    owner = make_user(email="svc-pro-owner@phase6.example")
    return make_professional(
        owner,
        display_name="Phase6 Svc Surveyors",
        slug="phase6-svc-surveyors",
        public_email="office@phase6-svc.example",
    )


def test_scenario_a_one_conversation_one_message_one_grant_one_notification(
    asker, professional, django_capture_on_commit_callbacks
):
    """Spec 40 Scenario A, end to end at the service layer."""
    mail.outbox.clear()
    with django_capture_on_commit_callbacks(execute=True):
        result = _submit(asker, InquiryContextType.PROFESSIONAL, professional.pk)

    assert Conversation.objects.count() == 1
    conversation = Conversation.objects.get()
    assert conversation.conversation_type == ConversationType.PROFESSIONAL_INQUIRY
    assert conversation.initiator_id == asker.pk
    assert conversation.professional_id == professional.pk
    assert conversation.subject == "Question about your services"
    assert conversation.status == ConversationStatus.OPEN
    assert conversation.last_message_at is not None

    message = Message.objects.get()
    assert message.body == BODY
    assert message.sender_email_snapshot == asker.email
    assert message.sender_name_snapshot == "Ada Rossi"
    assert message.sender_phone_snapshot == "+390000000000"
    assert message.is_system is False
    assert message.privacy_policy_version == CURRENT_PRIVACY_POLICY_VERSION

    grant = ContactAccessGrant.objects.get()
    assert grant.viewer_id == asker.pk
    assert grant.target_type == ContactTargetType.PROFESSIONAL
    assert grant.professional_id == professional.pk
    assert grant.source_conversation_id == conversation.pk
    assert grant.revoked_at is None

    notification = Notification.objects.get()
    assert notification.recipient_id == professional.owner_user_id
    assert notification.notification_type == "inquiry.received"
    assert notification.target_url == f"/dashboard/messages/{conversation.pk}/"
    assert notification.payload["context_label"] == "Phase6 Svc Surveyors"
    assert notification.payload["sender_display_name"] == "Ada Rossi"
    assert notification.payload["excerpt"] == BODY

    assert [sent.to for sent in mail.outbox] == [["office@phase6-svc.example"]]

    assert result.contact_access == ContactAccessOutcome.GRANTED
    assert result.next_url == f"/dashboard/messages/{conversation.pk}/"
    assert result.created_conversation is True
    assert result.created_grant is True


def test_a_second_inquiry_reuses_the_open_thread_and_does_not_re_grant(
    asker, professional
):
    """Spec 15.3 step 2 ("get or create") and step 4 ("if none exists")."""
    _submit(asker, InquiryContextType.PROFESSIONAL, professional.pk)
    result = _submit(
        asker,
        InquiryContextType.PROFESSIONAL,
        professional.pk,
        body="A completely different second question about mooring.",
    )

    assert Conversation.objects.count() == 1
    assert Message.objects.count() == 2
    assert ContactAccessGrant.objects.count() == 1
    assert result.created_conversation is False
    assert result.created_grant is False
    assert result.contact_access == ContactAccessOutcome.GRANTED


def test_a_private_seller_listing_grants_nothing(asker):
    seller = make_user(email="svc-seller@phase6.example")
    approver = make_user(email="svc-approver@phase6.example")
    listing = _publish(make_private_listing(owner=seller), approver)

    result = _submit(asker, InquiryContextType.LISTING, listing.pk)

    assert ContactAccessGrant.objects.count() == 0
    assert result.contact_access == ContactAccessOutcome.NOT_APPLICABLE
    assert Notification.objects.get().recipient_id == seller.pk


def test_a_broker_listing_notifies_readers_and_emails_the_organization_once(
    asker, django_capture_on_commit_callbacks
):
    """Spec 15.4: team members with can_read_messages get in-app visibility;
    email goes to the organization's configured address, "not every member"."""
    broker = make_broker(
        name="Phase6 Svc Brokers",
        slug="phase6-svc-brokers",
        public_email="leads@phase6-svc-brokers.example",
    )
    reader_one = make_user(email="svc-reader1@phase6.example")
    reader_two = make_user(email="svc-reader2@phase6.example")
    agent = make_user(email="svc-agent@phase6.example")
    make_membership(
        reader_one, broker, role=BrokerMembershipRole.MANAGER, can_read_messages=True
    )
    make_membership(
        reader_two, broker, role=BrokerMembershipRole.MANAGER, can_read_messages=True
    )
    make_membership(
        agent, broker, role=BrokerMembershipRole.AGENT, can_edit_listings=True
    )
    listing = _publish(
        make_broker_listing(broker=broker, actor=reader_one),
        make_user(email="svc-approver2@phase6.example"),
    )

    mail.outbox.clear()
    with django_capture_on_commit_callbacks(execute=True):
        result = _submit(asker, InquiryContextType.LISTING, listing.pk)

    assert set(Notification.objects.values_list("recipient_id", flat=True)) == {
        reader_one.pk,
        reader_two.pk,
    }
    assert [sent.to for sent in mail.outbox] == [
        ["leads@phase6-svc-brokers.example"]
    ]
    conversation = Conversation.objects.get()
    assert conversation.conversation_type == ConversationType.LISTING_INQUIRY
    assert conversation.broker_id == broker.pk
    assert conversation.listing_id == listing.pk
    assert result.contact_access == ContactAccessOutcome.GRANTED


def test_a_broker_with_no_message_readers_still_commits_the_inquiry(
    asker, django_capture_on_commit_callbacks
):
    """The conversation is real and shows up the moment staff grants the
    capability. Nobody is notified in the meantime - a documented limitation,
    not a silent success."""
    broker = make_broker(name="Phase6 Svc Silent", slug="phase6-svc-silent")
    mail.outbox.clear()
    with django_capture_on_commit_callbacks(execute=True):
        _submit(asker, InquiryContextType.BROKER, broker.pk)

    assert Conversation.objects.count() == 1
    assert Message.objects.count() == 1
    assert ContactAccessGrant.objects.count() == 1
    assert Notification.objects.count() == 0
    assert mail.outbox == []


def test_a_stale_privacy_policy_version_is_refused_and_writes_nothing(
    asker, professional
):
    with pytest.raises(ConsentRequired) as excinfo:
        _submit(
            asker,
            InquiryContextType.PROFESSIONAL,
            professional.pk,
            privacy_policy_version="2019-01",
        )
    assert excinfo.value.detail.code == "consent_required"
    assert Conversation.objects.count() == 0
    assert Message.objects.count() == 0
    assert ContactAccessGrant.objects.count() == 0


def test_the_same_body_twice_inside_the_window_is_rate_limited(asker, professional):
    _submit(asker, InquiryContextType.PROFESSIONAL, professional.pk)
    with pytest.raises(MessagingThrottled) as excinfo:
        _submit(asker, InquiryContextType.PROFESSIONAL, professional.pk)

    assert excinfo.value.detail.code == "rate_limited"
    assert excinfo.value.meta == {"retry_after_seconds": 300}
    assert Message.objects.count() == 1


def test_a_duplicate_outside_the_window_is_accepted(asker, professional):
    from datetime import timedelta

    _submit(asker, InquiryContextType.PROFESSIONAL, professional.pk)
    Message.objects.update(created_at=timezone.now() - timedelta(seconds=301))

    _submit(asker, InquiryContextType.PROFESSIONAL, professional.pk)
    assert Message.objects.count() == 2


def test_different_bodies_inside_the_window_are_accepted(asker, professional):
    _submit(asker, InquiryContextType.PROFESSIONAL, professional.pk)
    _submit(
        asker,
        InquiryContextType.PROFESSIONAL,
        professional.pk,
        body="A different question entirely, about winter storage rates.",
    )
    assert Message.objects.count() == 2


def test_scenario_b_a_failure_after_the_message_rolls_everything_back(
    asker, professional, monkeypatch
):
    """Spec 40 Scenario B: "no message, notification or grant exists"."""

    def boom(**kwargs):
        raise RuntimeError("notification backend down")

    monkeypatch.setattr("messaging.services.create_notification", boom)
    mail.outbox.clear()

    with pytest.raises(RuntimeError):
        _submit(asker, InquiryContextType.PROFESSIONAL, professional.pk)

    assert Conversation.objects.count() == 0
    assert Message.objects.count() == 0
    assert ContactAccessGrant.objects.count() == 0
    assert Notification.objects.count() == 0
    assert mail.outbox == []


def test_both_audit_events_are_written(asker, professional):
    _submit(asker, InquiryContextType.PROFESSIONAL, professional.pk)

    submitted = AuditEvent.objects.get(action="inquiry.submitted")
    assert submitted.actor_user_id == asker.pk
    assert submitted.target_type == "messaging.Conversation"
    assert submitted.request_id == "req-phase6"
    # Spec 33.5: never log or store the message body in the audit trail.
    assert BODY not in str(submitted.after)

    granted = AuditEvent.objects.get(action="contact_access.granted")
    assert granted.target_type == "messaging.ContactAccessGrant"
    assert granted.after["target_type"] == ContactTargetType.PROFESSIONAL


def test_a_long_body_is_excerpted_to_200_characters(asker, professional):
    long_body = "word " * 100
    _submit(asker, InquiryContextType.PROFESSIONAL, professional.pk, body=long_body)
    excerpt = Notification.objects.get().payload["excerpt"]
    assert len(excerpt) <= 200
    assert excerpt.endswith("…")
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && uv run pytest messaging/tests/test_submit_inquiry.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'messaging.services'`.

- [ ] **Step 3a: Append `FeatureDisabled` and `ConsentRequired` to `backend/messaging/exceptions.py`**

```python
class FeatureDisabled(APIException):
    """Spec 35.1's flag, off.

    Raised from UnifiedInquiriesEnabled.has_permission() rather than signalled by
    returning False, because DRF's APIView.permission_denied() short-circuits to
    `401 NotAuthenticated` for any request without credentials and never reaches
    a permission class's `code`. On the AllowAny guest-draft route that would
    have answered `401 authentication_required` to a flag-off request. See the
    permission class's docstring.
    """

    status_code = status.HTTP_403_FORBIDDEN
    default_detail = "Inquiries are temporarily unavailable."
    default_code = "feature_disabled"


class ConsentRequired(APIException):
    """Spec 15.1's required privacy consent, and spec 33.2's "Obtain required
    consent/version on inquiry". Raised both when the checkbox is missing and
    when the submitted version is not the current one - a consent recorded
    against a superseded policy is not consent to the current one."""

    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "Accept the current privacy policy to send this message."
    default_code = "consent_required"
```

- [ ] **Step 3b: Write `backend/messaging/signals.py`**

```python
"""Messaging domain signals.

`inquiry_received` is the seam spec 27.2's WebSocket push attaches to. It is
sent from INSIDE transaction.on_commit(), so a receiver never fires for a
rolled-back inquiry and never needs its own transaction check - the same
contract listings.signals established in Phase 11 (its contract rule 8).

Kwargs:
    sender: the messaging.models.Message class (Django requires a sender; the
            model class keeps `sender=` stable for receivers that filter on it).
    conversation: messaging.models.Conversation
    message: messaging.models.Message
    notification_ids: list[str] - the Notification rows already created in-app.
"""

from django.dispatch import Signal

inquiry_received = Signal()
```

- [ ] **Step 3c: Write `backend/messaging/permissions.py`**

```python
from rest_framework.permissions import BasePermission

from accounts.permissions import IsEmailVerified
from messaging.enums import UNIFIED_INQUIRIES_FLAG
from messaging.exceptions import FeatureDisabled
from platform_settings.services import is_feature_enabled


class UnifiedInquiriesEnabled(BasePermission):
    """Spec 35.1's rollout gate on the mutation side.

    403 rather than the 404 services_catalog.permissions.CombinedDirectoryEnabled
    uses: these are private API surfaces, not public pages whose very existence
    is the thing being hidden, and a client that already holds a session needs
    to distinguish "switched off" from "wrong URL".

    It RAISES rather than returning False, and that is load-bearing, not style.
    DRF's `APIView.permission_denied` answers `401 NotAuthenticated` whenever the
    request carried no credentials - before it ever looks at WHICH permission
    failed or at its `code`. On an AllowAny endpoint (the guest draft route) a
    flag-off answer would therefore have been `401 authentication_required`,
    which describes the wrong problem: the caller's credentials were never at
    issue. Raising skips that branch entirely, so every endpoint answers `403
    feature_disabled` for anonymous and authenticated callers alike. This is the
    same technique the merged `services_catalog.permissions.CombinedDirectoryEnabled`
    uses (it raises `NotFound()`), for the same underlying reason.
    """

    def has_permission(self, request, view):
        if not is_feature_enabled(UNIFIED_INQUIRIES_FLAG, default=False):
            raise FeatureDisabled()
        return True


class InquiryEmailVerified(IsEmailVerified):
    """Identical rule to Phase 3's IsEmailVerified, under spec 15.5's own code.

    Phase 3 uses `email_not_verified`; spec 15.5 names the inquiry error
    `email_verification_required`. Subclassing keeps one implementation of the
    rule and leaves accounts/permissions.py untouched - which matters, because
    changing that class's `code` would silently rename the error on every
    listing and Checkout endpoint that already relies on it.
    """

    message = "Verify your email address before sending an inquiry."
    code = "email_verification_required"
```

- [ ] **Step 3d: Write `backend/messaging/services.py`**

```python
"""The one inquiry service (spec 15's definition of done: "One backend service
handles all types").

Everything below runs inside a single transaction.atomic() in the order spec
15.3 prescribes. Step 1's rate-limit half is split in two by design: the per-user
and per-IP throttle is a view concern (DRF applies it before the body is even
parsed, spec 30.4), while the duplicate-body guard needs the resolved
conversation and therefore lives here.
"""

import logging
from dataclasses import dataclass
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone

from audit.models import AuditEvent
from audit.services import record_audit_event
from common.text import normalize_comparison_text
from messaging.context import resolve_inquiry_context
from messaging.enums import (
    CURRENT_PRIVACY_POLICY_VERSION,
    DUPLICATE_MESSAGE_WINDOW_SECONDS,
    ContactAccessOutcome,
    ConversationStatus,
    conversation_url,
)
from messaging.exceptions import ConsentRequired, MessagingThrottled
from messaging.models import ContactAccessGrant, Conversation, Message
from messaging.selectors import active_contact_grant
from messaging.signals import inquiry_received
from notifications.enums import EXCERPT_MAX_LENGTH, NotificationType
from notifications.services import create_notification

logger = logging.getLogger(__name__)

INQUIRY_TITLE_KEY = "notification.inquiry_received.title"
INQUIRY_BODY_KEY = "notification.inquiry_received.body"


@dataclass(frozen=True)
class InquiryResult:
    conversation: Conversation
    message: Message
    contact_access: str
    next_url: str
    created_conversation: bool
    created_grant: bool


def message_excerpt(body: str) -> str:
    """Spec 15.4's "safe excerpt" / 27.3's "safe summary", whitespace-collapsed
    and hard-capped so a notification payload never becomes a second copy of the
    message."""
    collapsed = " ".join(body.split())
    if len(collapsed) <= EXCERPT_MAX_LENGTH:
        return collapsed
    return collapsed[: EXCERPT_MAX_LENGTH - 1].rstrip() + "…"


def _open_thread_lookup(actor, context) -> dict:
    lookup = {"initiator": actor, "status": ConversationStatus.OPEN}
    if context.listing is not None:
        lookup["listing"] = context.listing
    elif context.broker is not None:
        # `listing__isnull=True` matches the partial index exactly: a
        # broker-owned LISTING_INQUIRY also carries this broker, and without
        # this clause the broker-profile thread and every listing thread with
        # the same broker would collide.
        lookup["broker"] = context.broker
        lookup["listing__isnull"] = True
    else:
        lookup["professional"] = context.professional
    return lookup


def _get_or_create_open_conversation(actor, context, subject):
    lookup = _open_thread_lookup(actor, context)
    existing = Conversation.objects.select_for_update().filter(**lookup).first()
    if existing is not None:
        return existing, False
    try:
        # Nested atomic == savepoint. Required: in PostgreSQL a unique violation
        # aborts the whole transaction unless it is caught inside one, so
        # without this the recovery below would itself fail.
        with transaction.atomic():
            conversation = Conversation.objects.create(
                initiator=actor,
                conversation_type=context.conversation_type,
                listing=context.listing,
                broker=context.broker,
                professional=context.professional,
                subject=subject,
                status=ConversationStatus.OPEN,
            )
        return conversation, True
    except IntegrityError:
        # A concurrent request won the partial unique index. Re-read it under
        # the lock: exactly one OPEN thread exists and both requests use it.
        return Conversation.objects.select_for_update().get(**lookup), False


def _refuse_duplicate(conversation, actor, body) -> None:
    cutoff = timezone.now() - timedelta(seconds=DUPLICATE_MESSAGE_WINDOW_SECONDS)
    normalized = normalize_comparison_text(body)
    recent = conversation.messages.filter(
        sender=actor, created_at__gte=cutoff
    ).values_list("body", flat=True)
    if any(normalize_comparison_text(previous) == normalized for previous in recent):
        raise MessagingThrottled(wait=DUPLICATE_MESSAGE_WINDOW_SECONDS)


def grant_contact_access(*, viewer, context, conversation, request_id=None):
    """Spec 15.3 step 4: "Create contact access grant if none exists."

    Returns (grant, created). A private-seller listing returns (None, False):
    spec 11.8's target_type has no member for a private person, so there is
    nothing to grant and nothing to reveal.
    """
    if context.contact_target_type is None:
        return None, False

    existing = active_contact_grant(
        viewer, broker=context.broker, professional=context.professional
    )
    if existing is not None:
        return existing, False

    try:
        with transaction.atomic():
            grant = ContactAccessGrant.objects.create(
                viewer=viewer,
                target_type=context.contact_target_type,
                broker=context.broker,
                professional=context.professional,
                source_conversation=conversation,
            )
    except IntegrityError:
        # Spec 16's acceptance test: "exactly one grant despite concurrent
        # duplicate requests". The partial unique index is what guarantees it;
        # this branch is how the loser of the race reports the winner's row.
        return (
            active_contact_grant(
                viewer, broker=context.broker, professional=context.professional
            ),
            False,
        )

    record_audit_event(
        actor_user=viewer,
        actor_type=AuditEvent.ActorType.USER,
        action="contact_access.granted",
        target_type="messaging.ContactAccessGrant",
        target_id=grant.pk,
        source=AuditEvent.Source.API,
        after={
            "viewer_id": str(viewer.pk),
            "target_type": grant.target_type,
            "broker_id": str(grant.broker_id) if grant.broker_id else None,
            "professional_id": (
                str(grant.professional_id) if grant.professional_id else None
            ),
            "source_conversation_id": str(conversation.pk),
        },
        request_id=request_id,
    )
    return grant, True


def _notify_recipients(context, conversation, message) -> list[str]:
    """Spec 15.4. In-app goes to every recipient; the email goes to exactly one
    address, carried by exactly one of those notifications."""
    recipients = list(context.recipient_users)
    if not recipients:
        # Truthful consequence of can_read_messages defaulting to False: nobody
        # at this organization can read messages, so nobody is told. The
        # conversation is still real and appears the moment staff grants the
        # capability. Surfaced as a warning so spec 33.4's alerting can see it.
        logger.warning(
            "inquiry has no in-app recipient",
            extra={"conversation_id": str(conversation.pk)},
        )
        return []

    # Deterministic: prefer the recipient whose own account address IS the
    # configured address (the private-seller and professional-owner cases), so
    # one person does not receive both the in-app row and an email that reads as
    # if it were meant for a shared inbox. Otherwise the lowest pk, because
    # broker_message_readers() orders by pk.
    email_index = 0
    for index, user in enumerate(recipients):
        if user.email == context.recipient_email:
            email_index = index
            break

    payload = {
        "conversation_id": str(conversation.pk),
        "message_id": str(message.pk),
        "context_type": context.context_type,
        "context_label": context.context_label,
        "sender_display_name": message.sender_name_snapshot,
        "excerpt": message_excerpt(message.body),
    }

    notification_ids = []
    for index, user in enumerate(recipients):
        notification = create_notification(
            recipient=user,
            notification_type=NotificationType.INQUIRY_RECEIVED,
            title_key=INQUIRY_TITLE_KEY,
            body_key=INQUIRY_BODY_KEY,
            target_url=conversation_url(conversation.pk),
            payload=payload,
            email_to=(
                context.recipient_email
                if index == email_index and context.recipient_email
                else ""
            ),
        )
        notification_ids.append(str(notification.pk))
    return notification_ids


@transaction.atomic
def submit_inquiry(
    *,
    actor,
    context_type,
    context_id,
    full_name,
    phone,
    subject,
    body,
    privacy_policy_version,
    marketing_consent=False,
    request_id=None,
) -> InquiryResult:
    # Step 1 - validate. The consent version is checked before the context is
    # resolved, so a submission with stale consent cannot be used to probe which
    # context ids exist.
    if privacy_policy_version != CURRENT_PRIVACY_POLICY_VERSION:
        raise ConsentRequired()
    context = resolve_inquiry_context(
        actor=actor, context_type=context_type, context_id=context_id
    )

    # Step 2 - get or create the open conversation for this policy.
    conversation, created_conversation = _get_or_create_open_conversation(
        actor, context, subject
    )
    _refuse_duplicate(conversation, actor, body)

    # Step 3 - the message and the sender snapshots.
    message = Message.objects.create(
        conversation=conversation,
        sender=actor,
        body=body,
        sender_email_snapshot=actor.email,
        sender_name_snapshot=full_name,
        sender_phone_snapshot=phone or "",
        is_system=False,
        privacy_policy_version=privacy_policy_version,
        marketing_consent=marketing_consent,
    )
    conversation.last_message_at = message.created_at
    conversation.save(update_fields=["last_message_at", "updated_at"])

    # Step 4 - the contact access grant.
    grant, created_grant = grant_contact_access(
        viewer=actor,
        context=context,
        conversation=conversation,
        request_id=request_id,
    )

    # Step 5 - recipient in-app notifications (and the queued email).
    notification_ids = _notify_recipients(context, conversation, message)

    record_audit_event(
        actor_user=actor,
        actor_type=AuditEvent.ActorType.USER,
        action="inquiry.submitted",
        target_type="messaging.Conversation",
        target_id=conversation.pk,
        source=AuditEvent.Source.API,
        after={
            "conversation_type": conversation.conversation_type,
            "message_id": str(message.pk),
            "created_conversation": created_conversation,
            "contact_access_granted": created_grant,
            "notification_count": len(notification_ids),
        },
        request_id=request_id,
    )

    # Step 6 - post-commit fan-out. The email job was registered by
    # create_notification(); this signal is the seam Phase 18's WebSocket push
    # attaches to (spec 27.2).
    transaction.on_commit(
        lambda: inquiry_received.send(
            sender=Message,
            conversation=conversation,
            message=message,
            notification_ids=notification_ids,
        )
    )

    return InquiryResult(
        conversation=conversation,
        message=message,
        contact_access=(
            ContactAccessOutcome.GRANTED
            if grant is not None
            else ContactAccessOutcome.NOT_APPLICABLE
        ),
        next_url=conversation_url(conversation.pk),
        created_conversation=created_conversation,
        created_grant=created_grant,
    )
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && uv run pytest messaging/tests/test_submit_inquiry.py -v`
Expected: PASS — **12 collected test items**.

Run the whole app plus the untouched neighbours, to prove nothing regressed:

Run: `cd backend && uv run pytest messaging notifications listings brokers professionals accounts -q`
Expected: all pass, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add backend/messaging
git commit -m "feat(messaging): submit_inquiry, the spec 15.3 atomic submission transaction"
```

---

### Task 7: `POST /api/v1/inquiries/` and `GET /api/v1/inquiries/config/`

**Files:**
- Create: `backend/messaging/serializers.py`, `backend/messaging/views.py`, `backend/messaging/urls.py`
- Modify (append): `backend/messaging/exceptions.py`, `backend/config/settings/base.py` (two throttle rates), `backend/config/urls.py` (one include)
- Test: `backend/messaging/tests/test_inquiry_api.py`

**Interfaces:**
- Consumes: `messaging.services.submit_inquiry`, `messaging.permissions.UnifiedInquiriesEnabled`/`InquiryEmailVerified`, `messaging.exceptions.*` (Tasks 5, 6); `messaging.enums.*` (Task 1); `accounts.permissions.IsActiveUser`; `platform_settings.services.is_feature_enabled`.
- Produces:
  - `messaging.exceptions.SpamDetected` — `APIException`, 400, `default_code="spam_detected"`
  - `messaging.serializers.InquirySubmissionSerializer`, `messaging.serializers.InquiryResultSerializer`
  - `messaging.views.MessagingAPIView` — the base class every later messaging view extends (`permission_denied` and `throttled` overrides, plus the documented rule that `UnifiedInquiriesEnabled` is listed first in every subclass's `permission_classes`)
  - `messaging.views.InquiryCreateView` (route name `inquiry-create`), `messaging.views.InquiryConfigView` (route name `inquiry-config`)
  - `messaging.urls.urlpatterns`
  - throttle scopes `inquiry_submit` = `20/hour` and `messaging_read` = `120/min`

- [ ] **Step 1: Write the failing test**

`backend/messaging/tests/test_inquiry_api.py`:

```python
"""Spec 15.5's request/response shapes and its error-code list, plus spec 34.3's
API test classes: permissions matrix, "Guest cannot submit inquiry", "Context
recipient cannot be spoofed", "Validation/error codes are stable"."""

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.tests.factories import make_user
from brokers.enums import BrokerMembershipRole
from brokers.tests.factories import make_broker, make_membership
from common.throttling import HashedIPScopedRateThrottle
from listings.enums import ListingStatus
from listings.tests.factories import make_private_listing, make_snapshot
from messaging.enums import CURRENT_PRIVACY_POLICY_VERSION
from messaging.models import ContactAccessGrant, Conversation, Message
from professionals.tests.factories import make_professional

pytestmark = pytest.mark.django_db


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def asker():
    return make_user(email="api-asker@phase6.example")


@pytest.fixture
def professional():
    owner = make_user(email="api-pro-owner@phase6.example")
    return make_professional(
        owner,
        display_name="Phase6 Api Surveyors",
        slug="phase6-api-surveyors",
        public_email="office@phase6-api.example",
    )


def _body(context_id, email, **overrides):
    payload = {
        "context_type": "PROFESSIONAL",
        "context_id": str(context_id),
        "full_name": "Ada Rossi",
        "email": email,
        "phone": "+390000000000",
        "subject": "Question about the survey",
        "message": "I would like to arrange a viewing next week please.",
        "privacy_policy_version": CURRENT_PRIVACY_POLICY_VERSION,
        "privacy_consent": True,
        "marketing_consent": False,
    }
    payload.update(overrides)
    return payload


def test_a_guest_gets_401_authentication_required(api, professional):
    """Spec 34.3: "Guest cannot submit inquiry." Spec 15.5 names the code."""
    response = api.post(
        reverse("inquiry-create"),
        _body(professional.pk, "nobody@phase6.example"),
        format="json",
    )
    assert response.status_code == 401
    assert response.data["error"]["code"] == "authentication_required"
    assert Conversation.objects.count() == 0


def test_an_unverified_account_gets_403_email_verification_required(api, professional):
    unverified = make_user(email="api-unverified@phase6.example", verified=False)
    api.force_authenticate(unverified)
    response = api.post(
        reverse("inquiry-create"), _body(professional.pk, unverified.email), format="json"
    )
    assert response.status_code == 403
    assert response.data["error"]["code"] == "email_verification_required"


def test_the_rollout_flag_off_returns_403_feature_disabled(
    api, asker, professional, unified_inquiries_disabled
):
    api.force_authenticate(asker)
    response = api.post(
        reverse("inquiry-create"), _body(professional.pk, asker.email), format="json"
    )
    assert response.status_code == 403
    assert response.data["error"]["code"] == "feature_disabled"


def test_the_flag_off_answer_is_403_for_an_anonymous_caller_too(
    api, professional, unified_inquiries_disabled
):
    """Spec 35.1 has no "unless you are signed out" clause.

    This passes for two reasons that must BOTH hold. (1) UnifiedInquiriesEnabled
    raises FeatureDisabled rather than returning False, because DRF's
    permission_denied() answers 401 NotAuthenticated for any credential-less
    request before it reads a permission's `code`. (2) It is listed FIRST in
    permission_classes, because check_permissions stops at the first gate that
    fails - with IsAuthenticated ahead of it, an anonymous caller would be
    refused for authentication and never reach the flag at all.
    """
    response = api.post(
        reverse("inquiry-create"),
        _body(professional.pk, "nobody@phase6.example"),
        format="json",
    )
    assert response.status_code == 403
    assert response.data["error"]["code"] == "feature_disabled"


def test_the_flag_off_answer_precedes_every_other_permission(
    api, professional, unified_inquiries_disabled
):
    """The regression guard for the ordering rule.

    Four callers who would each fail a DIFFERENT later gate - anonymous
    (IsAuthenticated), deactivated (IsActiveUser), unverified
    (InquiryEmailVerified) and fully eligible - must all hear the same thing
    when the feature is off. If anybody ever reorders permission_classes so the
    flag gate is not first, exactly one of these four flips to 401 or to a
    different 403 code, and this test says which.
    """
    eligible = make_user(email="order-ok@phase6.example")
    deactivated = make_user(email="order-inactive@phase6.example", is_active=False)
    unverified = make_user(email="order-unverified@phase6.example", verified=False)

    for caller in (None, deactivated, unverified, eligible):
        api.force_authenticate(caller)
        response = api.post(
            reverse("inquiry-create"),
            _body(professional.pk, "nobody@phase6.example"),
            format="json",
        )
        assert response.status_code == 403, caller
        assert response.data["error"]["code"] == "feature_disabled", caller


def test_a_valid_submission_returns_spec_15_5_s_success_body(
    api, asker, professional, django_capture_on_commit_callbacks
):
    api.force_authenticate(asker)
    with django_capture_on_commit_callbacks(execute=True):
        response = api.post(
            reverse("inquiry-create"),
            _body(professional.pk, asker.email),
            format="json",
            HTTP_X_REQUEST_ID="req-inquiry-1",
        )

    assert response.status_code == 201
    conversation = Conversation.objects.get()
    message = Message.objects.get()
    assert response.data == {
        "conversation_id": str(conversation.pk),
        "message_id": str(message.pk),
        "contact_access": "GRANTED",
        "next_url": f"/dashboard/messages/{conversation.pk}/",
    }
    assert response["X-Request-ID"] == "req-inquiry-1"


def test_a_filled_honeypot_is_refused_and_writes_nothing(api, asker, professional):
    api.force_authenticate(asker)
    response = api.post(
        reverse("inquiry-create"),
        _body(professional.pk, asker.email, company_website="https://spam.example"),
        format="json",
    )
    assert response.status_code == 400
    assert response.data["error"]["code"] == "spam_detected"
    assert Conversation.objects.count() == 0
    assert Message.objects.count() == 0


def test_an_empty_honeypot_is_accepted(api, asker, professional):
    api.force_authenticate(asker)
    response = api.post(
        reverse("inquiry-create"),
        _body(professional.pk, asker.email, company_website=""),
        format="json",
    )
    assert response.status_code == 201


def test_missing_privacy_consent_is_consent_required(api, asker, professional):
    api.force_authenticate(asker)
    response = api.post(
        reverse("inquiry-create"),
        _body(professional.pk, asker.email, privacy_consent=False),
        format="json",
    )
    assert response.status_code == 400
    assert response.data["error"]["code"] == "consent_required"


def test_a_stale_policy_version_is_consent_required(api, asker, professional):
    api.force_authenticate(asker)
    response = api.post(
        reverse("inquiry-create"),
        _body(professional.pk, asker.email, privacy_policy_version="2019-01"),
        format="json",
    )
    assert response.status_code == 400
    assert response.data["error"]["code"] == "consent_required"


def test_marketing_consent_is_never_required(api, asker, professional):
    """Spec 15.1: "Optional, separate, unchecked; never required for inquiry"."""
    api.force_authenticate(asker)
    payload = _body(professional.pk, asker.email)
    payload.pop("marketing_consent")
    response = api.post(reverse("inquiry-create"), payload, format="json")
    assert response.status_code == 201
    assert Message.objects.get().marketing_consent is False


def test_a_forged_email_is_refused_as_a_field_error(api, asker, professional):
    """Spec 15's definition of done: the email "cannot be forged to another
    account without a verified email-change flow".

    NOTE the envelope: common.exceptions.nauta_exception_handler collapses EVERY
    ValidationError to code "validation_error", so the specific reason lives in
    `fields`, not in `code`. Asserting on a field-level code string here would
    always fail - that is a real property of this codebase, not a quirk of this
    test.
    """
    api.force_authenticate(asker)
    response = api.post(
        reverse("inquiry-create"),
        _body(professional.pk, "someone.else@phase6.example"),
        format="json",
    )
    assert response.status_code == 400
    assert response.data["error"]["code"] == "validation_error"
    assert response.data["error"]["fields"]["email"] == [
        "Send from your own verified account email address."
    ]
    assert Message.objects.count() == 0


def test_the_account_email_is_used_even_though_the_client_sent_it(
    api, asker, professional
):
    api.force_authenticate(asker)
    api.post(reverse("inquiry-create"), _body(professional.pk, asker.email), format="json")
    assert Message.objects.get().sender_email_snapshot == asker.email


def test_an_unknown_context_type_is_invalid_context(api, asker, professional):
    api.force_authenticate(asker)
    response = api.post(
        reverse("inquiry-create"),
        _body(professional.pk, asker.email, context_type="SUPPORT"),
        format="json",
    )
    assert response.status_code == 400
    assert response.data["error"]["code"] == "invalid_context"


def test_a_non_uuid_context_id_is_invalid_context(api, asker, professional):
    api.force_authenticate(asker)
    response = api.post(
        reverse("inquiry-create"),
        _body(professional.pk, asker.email, context_id="../../etc/passwd"),
        format="json",
    )
    assert response.status_code == 400
    assert response.data["error"]["code"] == "invalid_context"


def test_an_unpublished_listing_is_recipient_unavailable(api, asker):
    """Spec 34.3: "Context recipient cannot be spoofed" and "Pending listing is
    absent publicly"."""
    seller = make_user(email="api-draft-seller@phase6.example")
    listing = make_private_listing(owner=seller)
    api.force_authenticate(asker)
    response = api.post(
        reverse("inquiry-create"),
        _body(listing.pk, asker.email, context_type="LISTING"),
        format="json",
    )
    assert response.status_code == 409
    assert response.data["error"]["code"] == "recipient_unavailable"


def test_a_seller_cannot_inquire_about_their_own_listing(api):
    seller = make_user(email="api-self-seller@phase6.example")
    approver = make_user(email="api-approver@phase6.example")
    listing = make_private_listing(owner=seller)
    snapshot = make_snapshot(listing, approved_by=approver)
    listing.status = ListingStatus.PUBLISHED
    listing.current_public_snapshot = snapshot
    listing.save(update_fields=["status", "current_public_snapshot", "updated_at"])

    api.force_authenticate(seller)
    response = api.post(
        reverse("inquiry-create"),
        _body(listing.pk, seller.email, context_type="LISTING"),
        format="json",
    )
    assert response.status_code == 400
    assert response.data["error"]["code"] == "self_inquiry_not_allowed"


def test_a_broker_member_cannot_inquire_to_their_own_broker(api):
    broker = make_broker(name="Phase6 Api Brokers", slug="phase6-api-brokers")
    member = make_user(email="api-member@phase6.example")
    make_membership(member, broker, role=BrokerMembershipRole.VIEWER)
    api.force_authenticate(member)
    response = api.post(
        reverse("inquiry-create"),
        _body(broker.pk, member.email, context_type="BROKER"),
        format="json",
    )
    assert response.status_code == 400
    assert response.data["error"]["code"] == "self_inquiry_not_allowed"


def test_a_message_below_the_minimum_length_is_a_field_error(api, asker, professional):
    api.force_authenticate(asker)
    response = api.post(
        reverse("inquiry-create"),
        _body(professional.pk, asker.email, message="too short"),
        format="json",
    )
    assert response.status_code == 400
    assert response.data["error"]["code"] == "validation_error"
    assert "message" in response.data["error"]["fields"]


def test_a_non_e164_phone_is_a_field_error(api, asker, professional):
    api.force_authenticate(asker)
    response = api.post(
        reverse("inquiry-create"),
        _body(professional.pk, asker.email, phone="0800 CALL ME"),
        format="json",
    )
    assert response.status_code == 400
    assert "phone" in response.data["error"]["fields"]


def test_an_omitted_phone_is_accepted(api, asker, professional):
    api.force_authenticate(asker)
    payload = _body(professional.pk, asker.email)
    payload.pop("phone")
    response = api.post(reverse("inquiry-create"), payload, format="json")
    assert response.status_code == 201
    assert Message.objects.get().sender_phone_snapshot == ""


def test_the_throttle_returns_429_rate_limited_with_retry_information(
    api, asker, professional, monkeypatch
):
    """Spec 30.4: "Return 429 with retry information."

    NOTE: overriding settings.REST_FRAMEWORK does not work - DRF binds
    SimpleRateThrottle.THROTTLE_RATES once from api_settings at import time. The
    already-merged taxonomy, services_catalog and listings rate-limit tests all
    monkeypatch the scope entry directly; this follows them.
    """
    monkeypatch.setitem(
        HashedIPScopedRateThrottle.THROTTLE_RATES, "inquiry_submit", "1/min"
    )
    api.force_authenticate(asker)
    first = api.post(
        reverse("inquiry-create"), _body(professional.pk, asker.email), format="json"
    )
    assert first.status_code == 201

    second = api.post(
        reverse("inquiry-create"),
        _body(professional.pk, asker.email, message="A second, different question."),
        format="json",
    )
    assert second.status_code == 429
    assert second.data["error"]["code"] == "rate_limited"
    assert second.data["error"]["meta"]["retry_after_seconds"] >= 1
    assert "Retry-After" in second


def test_a_throttled_request_creates_nothing(api, asker, professional, monkeypatch):
    """Spec 16's acceptance test: "A failed or rate-limited message does not
    unlock contact"."""
    monkeypatch.setitem(
        HashedIPScopedRateThrottle.THROTTLE_RATES, "inquiry_submit", "0/min"
    )
    api.force_authenticate(asker)
    response = api.post(
        reverse("inquiry-create"), _body(professional.pk, asker.email), format="json"
    )
    assert response.status_code == 429
    assert ContactAccessGrant.objects.count() == 0
    assert Conversation.objects.count() == 0


def test_the_config_endpoint_is_public_and_reports_every_client_side_limit(api):
    response = api.get(reverse("inquiry-config"))
    assert response.status_code == 200
    assert response.data == {
        "enabled": True,
        "privacy_policy_version": CURRENT_PRIVACY_POLICY_VERSION,
        "honeypot_field": "company_website",
        "limits": {
            "full_name": {"min": 2, "max": 120},
            "subject": {"min": 3, "max": 150},
            "message": {"min": 20, "max": 4000},
            "phone_max": 32,
        },
    }


def test_the_config_endpoint_reports_the_flag_state(api, unified_inquiries_disabled):
    """Spec 35.1: flags gate frontend exposure too. This is the one round trip
    the server component makes to decide whether to render the form at all."""
    response = api.get(reverse("inquiry-config"))
    assert response.status_code == 200
    assert response.data["enabled"] is False


def test_the_response_contains_no_contact_value_anywhere(api, asker, professional):
    """Phase 5 contract rule 1 and spec 16: no raw contact string leaves this
    phase. The grant is an authorization outcome, not a contact payload."""
    api.force_authenticate(asker)
    response = api.post(
        reverse("inquiry-create"), _body(professional.pk, asker.email), format="json"
    )
    rendered = response.content.decode()
    assert professional.public_email not in rendered
    assert professional.public_phone not in rendered
    assert set(response.data) == {
        "conversation_id",
        "message_id",
        "contact_access",
        "next_url",
    }
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && uv run pytest messaging/tests/test_inquiry_api.py -v`
Expected: FAIL — `django.urls.exceptions.NoReverseMatch: Reverse for 'inquiry-create' not found`.

- [ ] **Step 3a: Append `SpamDetected` to `backend/messaging/exceptions.py`**

```python
class SpamDetected(APIException):
    """Spec 15.1's honeypot. Addition to spec 15.5's open error list.

    A visible code rather than a fake 201: spec 2.1 and 39 forbid faked state,
    the frontend would otherwise render "message sent" for a message that does
    not exist, and no client-side test could tell the two apart. The cost - a
    determined bot learns the field name - is accepted and written down. See the
    plan's ruling.
    """

    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "This submission could not be accepted."
    default_code = "spam_detected"
```

- [ ] **Step 3b: Write `backend/messaging/serializers.py`**

```python
"""Request and response shapes for spec 15.5."""

import re

from rest_framework import serializers

from messaging.enums import (
    CURRENT_PRIVACY_POLICY_VERSION,
    FULL_NAME_MAX_LENGTH,
    FULL_NAME_MIN_LENGTH,
    HONEYPOT_FIELD_NAME,
    MESSAGE_MAX_LENGTH,
    MESSAGE_MIN_LENGTH,
    PHONE_MAX_LENGTH,
    SUBJECT_MAX_LENGTH,
    SUBJECT_MIN_LENGTH,
)
from messaging.exceptions import ConsentRequired, SpamDetected

#: Spec 15.1: "E.164-compatible input and country selector." E.164 is a leading
#: "+", a non-zero country code digit, then up to 14 more digits. The bound here
#: is deliberately loose at the low end (7 total) because some national numbers
#: are short, and hard at the high end (15) because E.164 says so.
E164_PATTERN = re.compile(r"^\+[1-9]\d{6,14}$")
_PHONE_NOISE = re.compile(r"[\s()\-.]")

EMAIL_MISMATCH_MESSAGE = "Send from your own verified account email address."


class InquirySubmissionSerializer(serializers.Serializer):
    """Spec 15.1's field table and spec 15.5's request body.

    `context_type` and `context_id` are plain CharFields on purpose. A
    ChoiceField or a UUIDField would reject a bad value as a ValidationError,
    which this project's envelope renders as code "validation_error" - but spec
    15.5 names a specific code, `invalid_context`, for exactly this case. Both
    fields are therefore passed through to resolve_inquiry_context(), which owns
    that code and is the single place context is judged.
    """

    context_type = serializers.CharField(max_length=32)
    context_id = serializers.CharField(max_length=64)
    full_name = serializers.CharField(
        min_length=FULL_NAME_MIN_LENGTH,
        max_length=FULL_NAME_MAX_LENGTH,
        trim_whitespace=True,
    )
    email = serializers.EmailField()
    phone = serializers.CharField(
        required=False, allow_blank=True, max_length=PHONE_MAX_LENGTH
    )
    subject = serializers.CharField(
        min_length=SUBJECT_MIN_LENGTH,
        max_length=SUBJECT_MAX_LENGTH,
        trim_whitespace=True,
    )
    message = serializers.CharField(
        min_length=MESSAGE_MIN_LENGTH, max_length=MESSAGE_MAX_LENGTH
    )
    privacy_policy_version = serializers.CharField(
        required=False, allow_blank=True, max_length=16, default=""
    )
    privacy_consent = serializers.BooleanField(required=False, default=False)
    # Spec 15.1: "Optional, separate, unchecked; never required for inquiry."
    marketing_consent = serializers.BooleanField(required=False, default=False)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Declared dynamically so the honeypot's name lives in exactly one
        # place, messaging.enums.HONEYPOT_FIELD_NAME, which is also what
        # GET /api/v1/inquiries/config/ tells the form to render.
        self.fields[HONEYPOT_FIELD_NAME] = serializers.CharField(
            required=False, allow_blank=True, default=""
        )

    def validate_phone(self, value):
        if not value:
            return ""
        normalized = _PHONE_NOISE.sub("", value)
        if not E164_PATTERN.match(normalized):
            raise serializers.ValidationError(
                "Enter a phone number in international format, for example +390000000000.",
                code="invalid_phone",
            )
        return normalized

    def validate_email(self, value):
        """Spec 15's definition of done: the email "cannot be forged to another
        account". The account address is what is actually stored either way
        (services.submit_inquiry reads actor.email); refusing the mismatch as
        well means a client can never believe it sent as somebody else."""
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if user is None or not user.is_authenticated:
            return value
        if value.strip().casefold() != user.email.casefold():
            raise serializers.ValidationError(
                EMAIL_MISMATCH_MESSAGE, code="email_mismatch"
            )
        return value

    def validate(self, attrs):
        if attrs.get(HONEYPOT_FIELD_NAME, "").strip():
            raise SpamDetected()
        if not attrs.get("privacy_consent"):
            raise ConsentRequired()
        if attrs.get("privacy_policy_version") != CURRENT_PRIVACY_POLICY_VERSION:
            raise ConsentRequired()
        return attrs


class InquiryResultSerializer(serializers.Serializer):
    """Spec 15.5's success body, field for field."""

    conversation_id = serializers.SerializerMethodField()
    message_id = serializers.SerializerMethodField()
    contact_access = serializers.CharField()
    next_url = serializers.CharField()

    def get_conversation_id(self, result) -> str:
        return str(result.conversation.pk)

    def get_message_id(self, result) -> str:
        return str(result.message.pk)
```

- [ ] **Step 3c: Write `backend/messaging/views.py`**

```python
"""Messaging endpoints (spec 30.1)."""

from rest_framework import status
from rest_framework.exceptions import NotAuthenticated
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsActiveUser
from messaging.enums import (
    CURRENT_PRIVACY_POLICY_VERSION,
    FULL_NAME_MAX_LENGTH,
    FULL_NAME_MIN_LENGTH,
    HONEYPOT_FIELD_NAME,
    MESSAGE_MAX_LENGTH,
    MESSAGE_MIN_LENGTH,
    PHONE_MAX_LENGTH,
    SUBJECT_MAX_LENGTH,
    SUBJECT_MIN_LENGTH,
    UNIFIED_INQUIRIES_FLAG,
)
from messaging.exceptions import MessagingThrottled
from messaging.permissions import InquiryEmailVerified, UnifiedInquiriesEnabled
from messaging.serializers import InquiryResultSerializer, InquirySubmissionSerializer
from messaging.services import submit_inquiry
from platform_settings.services import is_feature_enabled


class MessagingAPIView(APIView):
    """Base class for every messaging endpoint.

    Two overrides, both about speaking spec 15.5's error vocabulary rather than
    DRF's defaults.

    ONE RULE FOR SUBCLASSES: whenever a subclass has a feature-flag gate,
    `UnifiedInquiriesEnabled` goes FIRST in `permission_classes`. (Phase 7's
    contact-access endpoints are the ruled exception: they carry NO flag gate,
    because `contact_unlock` only ever closes reveal and never blocks the
    LOCKED display - spec 16/35.1.) `check_permissions` stops at the first gate
    that fails, so a flag gate placed after an authentication gate never speaks
    for an anonymous caller - and spec 35.1's "flag off => feature_disabled"
    would silently mean "unless you are signed out". The base class cannot
    enforce this (DRF reads `permission_classes` off the concrete view), so it
    is stated here and in the plan's Contract summary, and Task 7's
    `test_the_flag_off_answer_precedes_every_other_permission` is what actually
    catches a regression.
    """

    def permission_denied(self, request, message=None, code=None):
        """Spec 15.5 names the anonymous case `authentication_required`.

        DRF's own implementation raises a bare NotAuthenticated() when the
        request carried no credentials, which renders as code
        "not_authenticated" - a code spec 15.5 does not define. The 401 status
        is correct and is kept; only the code and message change. Note this
        cannot be fixed by a permission class: DRF decides between 401 and 403
        itself, and a permission class's `code` only reaches the 403 branch.
        """
        if request.authenticators and not request.successful_authenticator:
            raise NotAuthenticated(
                detail="Authentication is required.", code="authentication_required"
            )
        super().permission_denied(request, message=message, code=code)

    def throttled(self, request, wait):
        """Spec 15.5 names the code `rate_limited`, not DRF's "throttled", and
        spec 30.4 wants retry information in the body as well as the header."""
        raise MessagingThrottled(wait=wait)


class InquiryCreateView(MessagingAPIView):
    """POST /api/v1/inquiries/ - spec 30.1's "shared inquiry submission".

    THE FLAG GATE COMES FIRST, and the order is load-bearing.
    `APIView.check_permissions` walks the list and stops at the first failure, so
    whichever gate is first is the one that names the error. With
    `IsAuthenticated` first, an anonymous caller hits it before the flag is ever
    consulted and DRF answers `401 authentication_required` - meaning a switched
    -off feature would report itself differently to signed-in and signed-out
    callers, on the same endpoint, at the same moment.

    Putting `UnifiedInquiriesEnabled` first makes spec 35.1's rule true without
    exception: flag off => `403 feature_disabled` for everyone. It costs nothing
    when the flag is on, because the class then returns True and the
    authentication gates run exactly as before - an anonymous caller still gets
    `401 authentication_required`, which is what
    `test_a_guest_gets_401_authentication_required` asserts.
    """

    permission_classes = [
        UnifiedInquiriesEnabled,
        IsAuthenticated,
        IsActiveUser,
        InquiryEmailVerified,
    ]
    throttle_scope = "inquiry_submit"

    def post(self, request):
        serializer = InquirySubmissionSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        result = submit_inquiry(
            actor=request.user,
            context_type=data["context_type"],
            context_id=data["context_id"],
            full_name=data["full_name"],
            phone=data.get("phone", ""),
            subject=data["subject"],
            body=data["message"],
            privacy_policy_version=data["privacy_policy_version"],
            marketing_consent=data["marketing_consent"],
            request_id=getattr(request, "request_id", "") or None,
        )
        return Response(
            InquiryResultSerializer(result).data, status=status.HTTP_201_CREATED
        )


class InquiryConfigView(MessagingAPIView):
    """GET /api/v1/inquiries/config/ - an addition beyond spec 30.1's table.

    It exists so every number the form enforces client-side has a backend source
    (spec 2.1) and the two can never drift (spec 2.2: client validation
    "improve[s] usability but never enforce[s] business rules"), and so spec
    35.1's frontend gate is one round trip the page already has to make rather
    than a second copy of the flag in the frontend build.

    Public by design: it carries no user data, and a guest filling the form
    before authenticating needs the same limits an authenticated user does.
    """

    permission_classes = [AllowAny]
    throttle_scope = "messaging_read"

    def get(self, request):
        return Response(
            {
                "enabled": is_feature_enabled(UNIFIED_INQUIRIES_FLAG, default=False),
                "privacy_policy_version": CURRENT_PRIVACY_POLICY_VERSION,
                "honeypot_field": HONEYPOT_FIELD_NAME,
                "limits": {
                    "full_name": {
                        "min": FULL_NAME_MIN_LENGTH,
                        "max": FULL_NAME_MAX_LENGTH,
                    },
                    "subject": {"min": SUBJECT_MIN_LENGTH, "max": SUBJECT_MAX_LENGTH},
                    "message": {"min": MESSAGE_MIN_LENGTH, "max": MESSAGE_MAX_LENGTH},
                    "phone_max": PHONE_MAX_LENGTH,
                },
            }
        )
```

- [ ] **Step 3d: Write `backend/messaging/urls.py`**

```python
from django.urls import path

from messaging.views import InquiryConfigView, InquiryCreateView

urlpatterns = [
    path("inquiries/", InquiryCreateView.as_view(), name="inquiry-create"),
    path("inquiries/config/", InquiryConfigView.as_view(), name="inquiry-config"),
]
```

- [ ] **Step 3e: Append the throttle rates and the URL include**

`backend/config/settings/base.py` — add two keys inside the existing `DEFAULT_THROTTLE_RATES` dict. **Append only**; read the real file:

```python
        "services_directory": "60/min",
        # Spec 30.4 requires a limit on inquiry submission. 20/hour is generous
        # for a person contacting brokers and professionals across a browsing
        # session, and hard for a scraper harvesting contact grants - which is
        # what an inquiry actually buys (spec 16).
        "inquiry_submit": "20/hour",
        # Ordinary reads: the inquiry form's config call, the inbox and a thread.
        "messaging_read": "120/min",
```

`backend/config/urls.py` — append one line to `urlpatterns`:

```python
    path("api/v1/", include("messaging.urls")),
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && uv run pytest messaging/tests/test_inquiry_api.py -v`
Expected: PASS — **26 collected test items**.

Then confirm the URL names resolve and nothing else broke:

Run: `cd backend && uv run pytest messaging notifications -q && uv run python manage.py check`
Expected: all pass; `System check identified no issues`.

- [ ] **Step 5: Commit**

```bash
git add backend/messaging backend/config
git commit -m "feat(messaging): POST /api/v1/inquiries/ and the shared form config endpoint"
```

---

### Task 8: The guest draft — spec §15.2's "short-lived signed session"

**Files:**
- Create: `backend/messaging/drafts.py`
- Modify (append): `backend/messaging/exceptions.py`, `backend/messaging/serializers.py`, `backend/messaging/views.py`, `backend/messaging/urls.py`, `backend/config/settings/base.py` (one throttle rate)
- Test: `backend/messaging/tests/test_inquiry_drafts_api.py`

**Interfaces:**
- Consumes: `messaging.enums.DRAFT_TOKEN_MAX_AGE_SECONDS`/`DRAFT_TOKEN_SALT` and the length constants (Task 1); `messaging.views.MessagingAPIView`, `messaging.permissions.*` (Tasks 6, 7).
- Produces:
  - `messaging.exceptions.InvalidInquiryDraft` — `APIException`, 400, `default_code="invalid_draft"`
  - `messaging.exceptions.InquiryDraftExpired` — `APIException`, 400, `default_code="draft_expired"`
  - `messaging.drafts.DRAFT_FIELDS: tuple[str, ...]`
  - `messaging.drafts.sign_inquiry_draft(payload: dict) -> str`
  - `messaging.drafts.read_inquiry_draft(token: str) -> dict`
  - `messaging.serializers.InquiryDraftCreateSerializer`, `InquiryDraftResolveSerializer`
  - `messaging.views.InquiryDraftCreateView` (route name `inquiry-draft-create`), `InquiryDraftResolveView` (route name `inquiry-draft-resolve`)
  - throttle scope `inquiry_draft` = `30/hour`

- [ ] **Step 1: Write the failing test**

`backend/messaging/tests/test_inquiry_drafts_api.py`:

```python
"""Spec 15.2: "preserve non-sensitive draft fields in a short-lived signed
session" and "Do not send an inquiry automatically after login"."""

import pytest
from django.core import signing
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.tests.factories import make_user
from messaging.models import Conversation, Message
from professionals.tests.factories import make_professional

pytestmark = pytest.mark.django_db


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def professional():
    owner = make_user(email="draft-pro-owner@phase6.example")
    return make_professional(
        owner, display_name="Phase6 Draft Pro", slug="phase6-draft-pro"
    )


def _draft_body(professional):
    return {
        "context_type": "PROFESSIONAL",
        "context_id": str(professional.pk),
        "full_name": "Ada Rossi",
        "phone": "+390000000000",
        "subject": "Question about the survey",
        "message": "I would like to arrange a viewing next week please.",
    }


def test_a_guest_can_store_a_draft_without_authenticating(api, professional):
    response = api.post(
        reverse("inquiry-draft-create"), _draft_body(professional), format="json"
    )
    assert response.status_code == 201
    assert response.data["expires_in"] == 1800
    assert isinstance(response.data["draft_token"], str)
    # Storing a draft is not sending a message.
    assert Conversation.objects.count() == 0
    assert Message.objects.count() == 0


def test_the_round_trip_returns_exactly_the_non_sensitive_fields(api, professional):
    created = api.post(
        reverse("inquiry-draft-create"), _draft_body(professional), format="json"
    )
    user = make_user(email="draft-asker@phase6.example")
    api.force_authenticate(user)

    resolved = api.post(
        reverse("inquiry-draft-resolve"),
        {"draft_token": created.data["draft_token"]},
        format="json",
    )

    assert resolved.status_code == 200
    assert resolved.data == _draft_body(professional)
    # Never the email (it comes from the account) and never either consent
    # checkbox (consent is given by the person actually sending, after they see
    # the recipient again - spec 15.2).
    assert "email" not in resolved.data
    assert "privacy_consent" not in resolved.data
    assert "marketing_consent" not in resolved.data


def test_resolving_requires_a_verified_account(api, professional):
    created = api.post(
        reverse("inquiry-draft-create"), _draft_body(professional), format="json"
    )
    token = created.data["draft_token"]

    anonymous = api.post(
        reverse("inquiry-draft-resolve"), {"draft_token": token}, format="json"
    )
    assert anonymous.status_code == 401
    assert anonymous.data["error"]["code"] == "authentication_required"

    unverified = make_user(email="draft-unverified@phase6.example", verified=False)
    api.force_authenticate(unverified)
    response = api.post(
        reverse("inquiry-draft-resolve"), {"draft_token": token}, format="json"
    )
    assert response.status_code == 403
    assert response.data["error"]["code"] == "email_verification_required"


def test_a_tampered_token_is_refused(api, professional):
    created = api.post(
        reverse("inquiry-draft-create"), _draft_body(professional), format="json"
    )
    api.force_authenticate(make_user(email="draft-asker2@phase6.example"))

    response = api.post(
        reverse("inquiry-draft-resolve"),
        {"draft_token": created.data["draft_token"] + "x"},
        format="json",
    )
    assert response.status_code == 400
    assert response.data["error"]["code"] == "invalid_draft"


def test_a_token_signed_with_another_salt_is_refused(api, professional):
    """The salt is what stops a token minted for some other purpose - a session
    cookie, a password-reset payload - from being replayed here."""
    forged = signing.dumps(_draft_body(professional), salt="some.other.purpose")
    api.force_authenticate(make_user(email="draft-asker3@phase6.example"))

    response = api.post(
        reverse("inquiry-draft-resolve"), {"draft_token": forged}, format="json"
    )
    assert response.status_code == 400
    assert response.data["error"]["code"] == "invalid_draft"


def test_an_expired_token_is_refused(api, professional, monkeypatch):
    created = api.post(
        reverse("inquiry-draft-create"), _draft_body(professional), format="json"
    )
    # The TTL is read from the module at call time, so a negative max_age makes
    # any token instantly stale without waiting 30 minutes.
    monkeypatch.setattr("messaging.drafts.DRAFT_TOKEN_MAX_AGE_SECONDS", -1)
    api.force_authenticate(make_user(email="draft-asker4@phase6.example"))

    response = api.post(
        reverse("inquiry-draft-resolve"),
        {"draft_token": created.data["draft_token"]},
        format="json",
    )
    assert response.status_code == 400
    assert response.data["error"]["code"] == "draft_expired"


def test_a_half_typed_draft_is_accepted(api, professional):
    """A guest's draft is not a submission: none of spec 15.1's minimum lengths
    apply yet, or the form could not preserve work in progress."""
    response = api.post(
        reverse("inquiry-draft-create"),
        {
            "context_type": "PROFESSIONAL",
            "context_id": str(professional.pk),
            "message": "hi",
        },
        format="json",
    )
    assert response.status_code == 201


def test_the_flag_gates_both_draft_endpoints(
    api, professional, unified_inquiries_disabled
):
    """The decisive test for UnifiedInquiriesEnabled raising rather than
    returning False.

    inquiry-draft-create is AllowAny, so an anonymous caller reaches the
    permission stack with no credentials. Had the permission class returned
    False, DRF's permission_denied() would have answered `401
    authentication_required` - describing a problem the caller does not have,
    on the one route whose entire purpose is to serve people who are not signed
    in yet. Raising FeatureDisabled skips that branch.
    """
    anonymous = api.post(
        reverse("inquiry-draft-create"), _draft_body(professional), format="json"
    )
    assert anonymous.status_code == 403
    assert anonymous.data["error"]["code"] == "feature_disabled"

    api.force_authenticate(make_user(email="draft-flagoff@phase6.example"))
    resolve = api.post(
        reverse("inquiry-draft-resolve"), {"draft_token": "anything"}, format="json"
    )
    assert resolve.status_code == 403
    assert resolve.data["error"]["code"] == "feature_disabled"


def test_a_resolved_draft_does_not_send_anything(api, professional):
    """Spec 15.2, verbatim: "Do not send an inquiry automatically after login"."""
    created = api.post(
        reverse("inquiry-draft-create"), _draft_body(professional), format="json"
    )
    api.force_authenticate(make_user(email="draft-asker5@phase6.example"))
    api.post(
        reverse("inquiry-draft-resolve"),
        {"draft_token": created.data["draft_token"]},
        format="json",
    )
    assert Conversation.objects.count() == 0
    assert Message.objects.count() == 0
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && uv run pytest messaging/tests/test_inquiry_drafts_api.py -v`
Expected: FAIL — `NoReverseMatch: Reverse for 'inquiry-draft-create' not found`.

- [ ] **Step 3a: Append two exceptions to `backend/messaging/exceptions.py`**

```python
class InvalidInquiryDraft(APIException):
    """A draft token that is not ours, or has been altered."""

    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "This saved draft could not be read."
    default_code = "invalid_draft"


class InquiryDraftExpired(APIException):
    """Spec 15.2's "short-lived" half, made visible.

    A separate code from invalid_draft because the two mean different things to
    a person: "start again" versus "something is wrong". 400 rather than 410,
    because the draft is a value inside the request body, not the resource the
    URL names.
    """

    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "This saved draft has expired. Please retype your message."
    default_code = "draft_expired"
```

- [ ] **Step 3b: Write `backend/messaging/drafts.py`**

```python
"""Spec 15.2's "short-lived signed session" for a guest's inquiry draft.

This backend is headless and JWT-based: there is no Django session for an
anonymous API caller (SessionMiddleware exists for the admin). Rather than
inventing anonymous server-side session rows with their own table and sweeper,
the draft is signed with django.core.signing and handed to the browser, which
keeps it in sessionStorage. Both halves of the spec's phrase hold literally:
SIGNED (tamper-evident, keyed by SECRET_KEY plus a purpose-specific salt) and
SHORT-LIVED (a hard 30-minute TTL the client cannot extend).

The token is data restored into a form. It is not a capability: resolving it
requires a verified account, it carries no email address and no consent, and the
Send button still runs the full POST /api/v1/inquiries/ path with every check.
"""

from django.core import signing

from messaging.enums import DRAFT_TOKEN_MAX_AGE_SECONDS, DRAFT_TOKEN_SALT
from messaging.exceptions import InquiryDraftExpired, InvalidInquiryDraft

#: Exactly spec 15.2's "non-sensitive draft fields". Deliberately absent:
#: `email` (always taken from the authenticated account) and both consent flags.
DRAFT_FIELDS: tuple[str, ...] = (
    "context_type",
    "context_id",
    "full_name",
    "phone",
    "subject",
    "message",
)


def sign_inquiry_draft(payload: dict) -> str:
    return signing.dumps(
        {field: payload.get(field, "") for field in DRAFT_FIELDS},
        salt=DRAFT_TOKEN_SALT,
    )


def read_inquiry_draft(token: str) -> dict:
    try:
        data = signing.loads(
            token, salt=DRAFT_TOKEN_SALT, max_age=DRAFT_TOKEN_MAX_AGE_SECONDS
        )
    except signing.SignatureExpired:
        raise InquiryDraftExpired() from None
    except (signing.BadSignature, TypeError, ValueError):
        # BadSignature covers a tampered token AND one signed with a different
        # salt; TypeError/ValueError cover a token that is not even a string.
        raise InvalidInquiryDraft() from None

    if not isinstance(data, dict):
        raise InvalidInquiryDraft()
    # Re-project onto the known keys: a token minted by an older version with
    # extra keys must not smuggle them into the form.
    return {field: str(data.get(field, "")) for field in DRAFT_FIELDS}
```

- [ ] **Step 3c: Append to `backend/messaging/serializers.py`**

```python
class InquiryDraftCreateSerializer(serializers.Serializer):
    """No minimum lengths: a draft is work in progress, not a submission. The
    maximums are kept so the signed token cannot be inflated without bound."""

    context_type = serializers.CharField(max_length=32)
    context_id = serializers.CharField(max_length=64)
    full_name = serializers.CharField(
        required=False, allow_blank=True, max_length=FULL_NAME_MAX_LENGTH, default=""
    )
    phone = serializers.CharField(
        required=False, allow_blank=True, max_length=PHONE_MAX_LENGTH, default=""
    )
    subject = serializers.CharField(
        required=False, allow_blank=True, max_length=SUBJECT_MAX_LENGTH, default=""
    )
    message = serializers.CharField(
        required=False, allow_blank=True, max_length=MESSAGE_MAX_LENGTH, default=""
    )


class InquiryDraftResolveSerializer(serializers.Serializer):
    draft_token = serializers.CharField(max_length=8000)
```

- [ ] **Step 3d: Append to `backend/messaging/views.py`**

Consolidate the new imports into the module's import section:

```python
from messaging.drafts import read_inquiry_draft, sign_inquiry_draft
from messaging.enums import DRAFT_TOKEN_MAX_AGE_SECONDS
from messaging.serializers import (
    InquiryDraftCreateSerializer,
    InquiryDraftResolveSerializer,
)
```

```python
class InquiryDraftCreateView(MessagingAPIView):
    """POST /api/v1/inquiry-drafts/ - an addition beyond spec 30.1's table,
    required by spec 15.2. AllowAny by definition: its whole purpose is to hold
    a guest's work while they authenticate."""

    permission_classes = [UnifiedInquiriesEnabled, AllowAny]
    throttle_scope = "inquiry_draft"

    def post(self, request):
        serializer = InquiryDraftCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(
            {
                "draft_token": sign_inquiry_draft(serializer.validated_data),
                "expires_in": DRAFT_TOKEN_MAX_AGE_SECONDS,
            },
            status=status.HTTP_201_CREATED,
        )


class InquiryDraftResolveView(MessagingAPIView):
    """POST /api/v1/inquiry-drafts/resolve/ - the return half of spec 15.2.

    Verified account required, for the same reason submission is: restoring a
    draft is the step immediately before sending one, and there is no case where
    an unverified account should reach it. It returns the fields and nothing
    else - it never sends (spec 15.2: "Do not send an inquiry automatically
    after login").
    """

    permission_classes = [
        UnifiedInquiriesEnabled,
        IsAuthenticated,
        IsActiveUser,
        InquiryEmailVerified,
    ]
    throttle_scope = "inquiry_draft"

    def post(self, request):
        serializer = InquiryDraftResolveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(read_inquiry_draft(serializer.validated_data["draft_token"]))
```

- [ ] **Step 3e: Append the routes and the throttle rate**

`backend/messaging/urls.py`:

```python
    path(
        "inquiry-drafts/",
        InquiryDraftCreateView.as_view(),
        name="inquiry-draft-create",
    ),
    path(
        "inquiry-drafts/resolve/",
        InquiryDraftResolveView.as_view(),
        name="inquiry-draft-resolve",
    ),
```

`backend/config/settings/base.py`, inside `DEFAULT_THROTTLE_RATES` (append only):

```python
        # Spec 30.4. Higher than inquiry_submit because a draft is saved on
        # every "sign in to send" click, including the ones a person abandons.
        "inquiry_draft": "30/hour",
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && uv run pytest messaging/tests/test_inquiry_drafts_api.py -v`
Expected: PASS — **9 collected test items**.

- [ ] **Step 5: Commit**

```bash
git add backend/messaging backend/config/settings/base.py
git commit -m "feat(messaging): signed guest inquiry drafts for the spec 15.2 return flow"
```

---

### Task 9: `GET /api/v1/conversations/` — the authorized inbox

**Files:**
- Create: `backend/messaging/pagination.py`
- Modify (append): `backend/messaging/selectors.py`, `backend/messaging/serializers.py`, `backend/messaging/views.py`, `backend/messaging/urls.py`
- Test: `backend/messaging/tests/test_conversation_list_api.py`

**Interfaces:**
- Consumes: `messaging.models.Conversation`/`Message` (Tasks 2, 3); `messaging.views.MessagingAPIView` (Task 7); `brokers.models.BrokerMembership`, `brokers.enums.BrokerOrganizationStatus`.
- Produces:
  - `messaging.selectors.conversations_visible_to(user) -> QuerySet[Conversation]`
  - `messaging.selectors.can_view_conversation(user, conversation) -> bool`
  - `messaging.selectors.annotate_unread(queryset, user) -> QuerySet[Conversation]` (adds `unread_count`, as a correlated `Subquery` — not a `Count` aggregate, so the outer query stays ungrouped)
  - `messaging.selectors.annotate_last_message(queryset) -> QuerySet[Conversation]` (adds `first_sender_name`, `last_message_body`)
  - `messaging.pagination.ConversationPagination` — `page_size=20`, `page_size_query_param="page_size"`, `max_page_size=100`
  - `messaging.serializers.ConversationSerializer`
  - `messaging.views.ConversationListView` (route name `conversation-list`)

**Note (ruling — no staff read path, deliberately).** `accounts.services.can_read_broker_messages()` returns `True` for any staff **moderator**, before it ever looks at a membership. Phase 3 built that shortcut, and Phase 6 does **not** use it: `can_view_conversation()` gates on membership only. Three reasons, and the deviation is from Phase 3 rule 4's *staff shortcut*, never from its actual subject (gate on `can_read_messages`, never on `can_edit_listings`), which is honoured exactly. (1) Spec §5's capability table gives staff no "read conversations" capability — it gives them "Reveal recipient contact after inquiry", which is Phase 7's. (2) Spec §26 enumerates the staff surfaces and messaging is not among them; a staff messaging console, if it is ever wanted, is Phase 17's to specify with a screen in front of it. (3) Spec §33.2 restricts access to personal data, and an inbox endpoint that silently returns every brokerage's private correspondence to every moderator is not a restriction. If this is later judged wrong, the fix is one line in `can_view_conversation` plus a matching `Q` in `conversations_visible_to` — they are written as a pair so the list and the detail can never disagree, which is the actual hazard. Recorded in Known Limitations.

- [ ] **Step 1: Write the failing test**

`backend/messaging/tests/test_conversation_list_api.py`:

```python
"""Spec 30.1's "authorized inbox", and spec 28's filter and row requirements
(the backend source Phase 19's broker Messages screen reads)."""

import pytest
from django.contrib.auth.models import Group
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from brokers.enums import BrokerMembershipRole
from brokers.tests.factories import make_broker, make_membership
from messaging.enums import ConversationStatus, ConversationType
from messaging.tests.factories import make_conversation, make_message
from professionals.tests.factories import make_professional

pytestmark = pytest.mark.django_db


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def scene():
    """One professional thread and one broker thread, one asker, one reader."""
    asker = make_user(email="inbox-asker@phase6.example")
    pro_owner = make_user(email="inbox-pro-owner@phase6.example")
    professional = make_professional(
        pro_owner, display_name="Phase6 Inbox Pro", slug="phase6-inbox-pro"
    )
    broker = make_broker(name="Phase6 Inbox Brokers", slug="phase6-inbox-brokers")
    reader = make_user(email="inbox-reader@phase6.example")
    agent = make_user(email="inbox-agent@phase6.example")
    make_membership(
        reader, broker, role=BrokerMembershipRole.MANAGER, can_read_messages=True
    )
    make_membership(
        agent, broker, role=BrokerMembershipRole.AGENT, can_edit_listings=True
    )

    pro_thread = make_conversation(
        initiator=asker,
        conversation_type=ConversationType.PROFESSIONAL_INQUIRY,
        professional=professional,
        subject="Survey question",
    )
    broker_thread = make_conversation(
        initiator=asker,
        conversation_type=ConversationType.BROKER_INQUIRY,
        broker=broker,
        subject="Fleet question",
    )
    for thread in (pro_thread, broker_thread):
        message = make_message(conversation=thread, sender=asker)
        thread.last_message_at = message.created_at
        thread.save(update_fields=["last_message_at", "updated_at"])
    return {
        "asker": asker,
        "pro_owner": pro_owner,
        "professional": professional,
        "broker": broker,
        "reader": reader,
        "agent": agent,
        "pro_thread": pro_thread,
        "broker_thread": broker_thread,
    }


def test_a_guest_gets_401_authentication_required(api):
    response = api.get(reverse("conversation-list"))
    assert response.status_code == 401
    assert response.data["error"]["code"] == "authentication_required"


def test_the_flag_off_answer_is_403_for_both_anonymous_and_authenticated(
    api, scene, unified_inquiries_disabled
):
    anonymous = api.get(reverse("conversation-list"))
    assert anonymous.status_code == 403
    assert anonymous.data["error"]["code"] == "feature_disabled"

    api.force_authenticate(scene["asker"])
    signed_in = api.get(reverse("conversation-list"))
    assert signed_in.status_code == 403
    assert signed_in.data["error"]["code"] == "feature_disabled"


def test_the_initiator_sees_both_of_their_threads(api, scene):
    api.force_authenticate(scene["asker"])
    response = api.get(reverse("conversation-list"))
    assert response.status_code == 200
    assert {row["id"] for row in response.data["results"]} == {
        str(scene["pro_thread"].pk),
        str(scene["broker_thread"].pk),
    }


def test_the_professional_owner_sees_only_their_own_thread(api, scene):
    api.force_authenticate(scene["pro_owner"])
    response = api.get(reverse("conversation-list"))
    assert [row["id"] for row in response.data["results"]] == [
        str(scene["pro_thread"].pk)
    ]


def test_a_broker_member_with_can_read_messages_sees_the_broker_thread(api, scene):
    api.force_authenticate(scene["reader"])
    response = api.get(reverse("conversation-list"))
    assert [row["id"] for row in response.data["results"]] == [
        str(scene["broker_thread"].pk)
    ]


def test_an_agent_without_can_read_messages_sees_nothing(api, scene):
    """Phase 3 contract rule 4's exact warning: can_edit_listings must not leak
    message access."""
    api.force_authenticate(scene["agent"])
    response = api.get(reverse("conversation-list"))
    assert response.data["results"] == []


def test_an_unrelated_user_sees_nothing(api, scene):
    stranger = make_user(email="inbox-stranger@phase6.example")
    api.force_authenticate(stranger)
    response = api.get(reverse("conversation-list"))
    assert response.data["results"] == []


def test_a_staff_moderator_sees_nothing_either(api, scene):
    """See this task's ruling: Phase 6 ships no staff messaging surface."""
    moderator = make_user(email="inbox-moderator@phase6.example", role=UserRole.STAFF)
    # get_or_create, not get: the same defensive spelling brokers/tests/test_admin.py:35
    # uses. messaging/tests/conftest.py's autouse fixture already guarantees the
    # row, and this keeps the test true even if that fixture is ever narrowed.
    moderator.groups.add(Group.objects.get_or_create(name=StaffGroup.MODERATOR)[0])
    api.force_authenticate(moderator)
    response = api.get(reverse("conversation-list"))
    assert response.data["results"] == []


def test_a_row_carries_every_field_spec_28_names(api, scene):
    api.force_authenticate(scene["pro_owner"])
    row = api.get(reverse("conversation-list")).data["results"][0]
    assert row["conversation_type"] == ConversationType.PROFESSIONAL_INQUIRY
    assert row["subject"] == "Survey question"
    assert row["status"] == ConversationStatus.OPEN
    assert row["last_message_at"] is not None
    assert row["last_message_excerpt"] == (
        "I would like to arrange a viewing next week please."
    )
    assert row["counterparty_name"] == "Ada Rossi"
    assert row["unread_count"] == 1
    assert row["context"] == {
        "type": "PROFESSIONAL",
        "id": str(scene["professional"].pk),
        "label": "Phase6 Inbox Pro",
    }


def test_the_initiators_own_messages_never_count_as_unread(api, scene):
    api.force_authenticate(scene["asker"])
    rows = api.get(reverse("conversation-list")).data["results"]
    assert {row["unread_count"] for row in rows} == {0}


def test_the_counterparty_name_is_the_context_label_for_the_initiator(api, scene):
    api.force_authenticate(scene["asker"])
    rows = {row["id"]: row for row in api.get(reverse("conversation-list")).data["results"]}
    assert rows[str(scene["pro_thread"].pk)]["counterparty_name"] == "Phase6 Inbox Pro"
    assert (
        rows[str(scene["broker_thread"].pk)]["counterparty_name"]
        == "Phase6 Inbox Brokers"
    )


def test_archived_threads_are_excluded_by_default_and_reachable_by_filter(api, scene):
    """Spec 28's "All" and "Archived" filters."""
    scene["pro_thread"].status = ConversationStatus.ARCHIVED
    scene["pro_thread"].save(update_fields=["status", "updated_at"])
    api.force_authenticate(scene["asker"])

    default_rows = api.get(reverse("conversation-list")).data["results"]
    assert [row["id"] for row in default_rows] == [str(scene["broker_thread"].pk)]

    archived_rows = api.get(
        reverse("conversation-list"), {"status": "ARCHIVED"}
    ).data["results"]
    assert [row["id"] for row in archived_rows] == [str(scene["pro_thread"].pk)]


def test_the_unread_filter_returns_only_threads_with_unread_messages(api, scene):
    """Spec 28's "Unread" filter."""
    api.force_authenticate(scene["pro_owner"])
    assert len(api.get(reverse("conversation-list"), {"unread": "true"}).data["results"]) == 1

    api.force_authenticate(scene["asker"])
    assert api.get(reverse("conversation-list"), {"unread": "true"}).data["results"] == []


def test_the_type_filter_accepts_repeated_values(api, scene):
    """Spec 28's "Listing inquiries" and "Profile inquiries" filters - the
    second is two conversation types, so the parameter repeats."""
    api.force_authenticate(scene["asker"])
    response = api.get(
        reverse("conversation-list"),
        {"type": ["BROKER_INQUIRY", "PROFESSIONAL_INQUIRY"]},
    )
    assert len(response.data["results"]) == 2

    response = api.get(reverse("conversation-list"), {"type": "BROKER_INQUIRY"})
    assert [row["id"] for row in response.data["results"]] == [
        str(scene["broker_thread"].pk)
    ]


def test_an_unknown_type_filter_value_returns_an_empty_inbox(api, scene):
    api.force_authenticate(scene["asker"])
    response = api.get(reverse("conversation-list"), {"type": "NONSENSE"})
    assert response.status_code == 200
    assert response.data["results"] == []


def test_the_broker_filter_scopes_the_inbox(api, scene):
    """Phase 19's broker Messages screen needs one organization's threads."""
    api.force_authenticate(scene["reader"])
    response = api.get(
        reverse("conversation-list"), {"broker": str(scene["broker"].pk)}
    )
    assert [row["id"] for row in response.data["results"]] == [
        str(scene["broker_thread"].pk)
    ]


def test_the_list_is_paginated_and_newest_first(api, scene):
    api.force_authenticate(scene["asker"])
    response = api.get(reverse("conversation-list"))
    assert set(response.data) == {"count", "next", "previous", "results"}
    stamps = [row["last_message_at"] for row in response.data["results"]]
    assert stamps == sorted(stamps, reverse=True)


def test_the_inbox_query_count_is_constant_in_the_number_of_rows(api, scene):
    """Spec 33.3: "Avoid N+1 queries in cards/directories; verify with
    query-count tests."

    An absolute budget that scales with the row count (`max_num_queries(k + 2 *
    rows)`) cannot fail on an N+1 - it BUDGETS for one. This compares two real
    inboxes instead: 2 rows and 7 rows must cost the SAME number of queries.
    `conversations_visible_to` select_relateds the three context objects, and
    `annotate_last_message`/`annotate_unread` fold the first sender, the last
    body and the unread tally into the list query as correlated subqueries, so
    the total is fixed. If this fails, the fix is an annotation or a
    select_related in the selector, never a per-row query in the serializer.
    """
    api.force_authenticate(scene["asker"])
    # Warm-up request, deliberately discarded. messaging/tests/conftest.py starts
    # each test with the feature-flag cache key deleted, and
    # platform_settings.services.is_feature_enabled caches a persisted value with
    # timeout=None - so the FIRST request of any test pays one extra FeatureFlag
    # SELECT that no later request pays. Without this line the comparison below
    # is off by exactly that one query and fails for a reason that has nothing to
    # do with N+1.
    api.get(reverse("conversation-list"))

    with CaptureQueriesContext(connection) as small:
        first = api.get(reverse("conversation-list"))
    assert len(first.data["results"]) == 2

    for index in range(5):
        broker = make_broker(
            name=f"Phase6 Bulk {index}", slug=f"phase6-bulk-{index}"
        )
        conversation = make_conversation(
            initiator=scene["asker"],
            conversation_type=ConversationType.BROKER_INQUIRY,
            broker=broker,
        )
        make_message(conversation=conversation, sender=scene["asker"])

    with CaptureQueriesContext(connection) as large:
        second = api.get(reverse("conversation-list"))

    assert len(second.data["results"]) == 7
    assert len(large) == len(small), [entry["sql"] for entry in large]


def test_no_contact_value_appears_in_any_row(api, scene):
    """Phase 5 contract rule 1 and spec 16: contact data is Phase 7's, and only
    after a grant."""
    api.force_authenticate(scene["asker"])
    rendered = api.get(reverse("conversation-list")).content.decode()
    assert scene["professional"].public_email not in rendered
    assert scene["professional"].public_phone not in rendered
    assert scene["broker"].public_email not in rendered
    assert scene["broker"].public_phone not in rendered
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && uv run pytest messaging/tests/test_conversation_list_api.py -v`
Expected: FAIL — `NoReverseMatch: Reverse for 'conversation-list' not found`.

- [ ] **Step 3a: Append to `backend/messaging/selectors.py`**

Consolidate the new imports at the top of the module:

```python
from django.db.models import Count, IntegerField, OuterRef, Q, Subquery, Value
from django.db.models.functions import Coalesce

from brokers.models import BrokerMembership
from messaging.models import Conversation, Message
```

```python
def _readable_broker_ids(user):
    """The organizations whose messages this user may read (spec 15.4, 28).

    Gates on can_read_messages ONLY, and on the organization still being ACTIVE
    - the same three conditions accounts.services.active_broker_membership
    applies, expressed as a subquery so the inbox stays one database round trip.
    """
    return BrokerMembership.objects.filter(
        user=user,
        is_active=True,
        can_read_messages=True,
        broker__status=BrokerOrganizationStatus.ACTIVE,
    ).values("broker_id")


def conversations_visible_to(user):
    """Every thread this user may see, from either side.

    Deliberately no staff branch - see the ruling in this plan's Task 9. This
    function and can_view_conversation() below are written as a pair and must
    stay in agreement: a list that shows a row a detail view then refuses (or
    worse, the other way round) is the real hazard here.
    """
    return (
        Conversation.objects.filter(
            Q(initiator=user)
            | Q(professional__owner_user=user)
            | Q(listing__owner_user=user)
            | Q(broker_id__in=_readable_broker_ids(user))
        )
        .select_related("broker", "professional", "listing__current_public_snapshot")
        .distinct()
    )


def can_view_conversation(user, conversation) -> bool:
    if not user or not user.is_authenticated or not user.is_active:
        return False
    if conversation.initiator_id == user.pk:
        return True
    if (
        conversation.professional_id is not None
        and conversation.professional.owner_user_id == user.pk
    ):
        return True
    if (
        conversation.listing_id is not None
        and conversation.listing.owner_user_id == user.pk
    ):
        return True
    if conversation.broker_id is not None:
        return (
            _readable_broker_ids(user)
            .filter(broker_id=conversation.broker_id)
            .exists()
        )
    return False


def annotate_unread(queryset, user):
    """Spec 28's per-row unread count.

    Spec 11.8 puts ONE nullable read_at on Message, so for a broker team this
    counts "unread by the recipient side", not "unread by this member". That is
    what the spec's data model supports; see the plan's Known Limitations.

    A correlated Subquery rather than `Count("messages", filter=...)`: the
    aggregate form puts a GROUP BY on the outer query, which then has to
    co-exist with `.distinct()` (needed because the visibility filter ORs across
    two joins) and with pagination's `.count()`. A scalar subquery keeps the
    outer query ungrouped, so the row count, the ordering and the LIMIT all stay
    exactly what they look like. Coalesce because a conversation with no
    matching messages yields NULL, and the API must report 0.
    """
    unread = (
        Message.objects.filter(conversation=OuterRef("pk"), read_at__isnull=True)
        .exclude(sender=user)
        .order_by()
        .values("conversation")
        .annotate(total=Count("pk"))
        .values("total")
    )
    return queryset.annotate(
        unread_count=Coalesce(
            Subquery(unread, output_field=IntegerField()), Value(0)
        )
    )


def annotate_last_message(queryset):
    """The two per-row fields spec 28's conversation row needs, as annotations.

    Spec 33.3: "Avoid N+1 queries in cards/directories; verify with query-count
    tests." Reading `conversation.messages.first()` and `.last()` from the
    serializer costs TWO queries per row, which is the textbook N+1 - twenty
    inbox rows would issue forty-one queries. Two correlated subqueries move
    both into the single list query, so the cost is constant in the number of
    rows. `is_system=False` matches the serializer's own rule: a system note is
    never the "sender display name" and never the excerpt.
    """
    visible = Message.objects.filter(conversation=OuterRef("pk"), is_system=False)
    return queryset.annotate(
        first_sender_name=Subquery(
            visible.order_by("created_at").values("sender_name_snapshot")[:1]
        ),
        last_message_body=Subquery(
            visible.order_by("-created_at").values("body")[:1]
        ),
    )
```

- [ ] **Step 3b: Write `backend/messaging/pagination.py`**

```python
from rest_framework.pagination import PageNumberPagination


class ConversationPagination(PageNumberPagination):
    """Spec 33.3: "Paginate every unbounded staff/public collection."

    Mirrors services_catalog.pagination.ProfessionalDirectoryPagination's shape
    so every paginated response in this project looks the same (spec 30.2:
    "Paginated results use one consistent shape").
    """

    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100
```

- [ ] **Step 3c: Append to `backend/messaging/serializers.py`**

Add one import to the module's import section — `messaging.services` imports
`models`, `context`, `selectors`, `signals` and `notifications`, and none of
those import `serializers`, so this is not a cycle:

```python
from messaging.services import message_excerpt
```

```python
class ConversationSerializer(serializers.Serializer):
    """Spec 28's conversation row. Carries no contact value of any kind."""

    id = serializers.UUIDField(read_only=True)
    conversation_type = serializers.CharField(read_only=True)
    subject = serializers.CharField(read_only=True)
    status = serializers.CharField(read_only=True)
    last_message_at = serializers.DateTimeField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    unread_count = serializers.IntegerField(read_only=True)
    context = serializers.SerializerMethodField()
    counterparty_name = serializers.SerializerMethodField()
    last_message_excerpt = serializers.SerializerMethodField()

    def _viewer(self):
        return self.context["request"].user

    def get_context(self, conversation) -> dict:
        if conversation.listing_id is not None:
            snapshot = conversation.listing.current_public_snapshot
            label = ""
            if snapshot is not None:
                model_name = (
                    snapshot.custom_model_name_snapshot
                    or snapshot.model_name_snapshot
                )
                label = f"{snapshot.brand_name_snapshot} {model_name}".strip()
            return {
                "type": "LISTING",
                "id": str(conversation.listing_id),
                "label": label,
            }
        if conversation.broker_id is not None:
            return {
                "type": "BROKER",
                "id": str(conversation.broker_id),
                "label": conversation.broker.name,
            }
        if conversation.professional_id is not None:
            return {
                "type": "PROFESSIONAL",
                "id": str(conversation.professional_id),
                "label": conversation.professional.display_name,
            }
        return {"type": "SUPPORT", "id": "", "label": ""}

    def get_counterparty_name(self, conversation) -> str:
        """Who the OTHER side is, from this viewer's seat.

        For the initiator it is the context's own public label - never the
        private seller's personal name, which is not public information and is
        not what a grant reveals either. For the recipient it is the name the
        sender stated on their first message (spec 15.1's Full name), read from
        the snapshot rather than joined to a live profile.

        `first_sender_name` is an annotation from selectors.annotate_last_message();
        reading `conversation.messages.first()` here instead would be one query
        per row (spec 33.3). It may legitimately be the empty string - see
        services._reply_display_name - and the client renders the localized
        `inquiry.sender_unnamed` string for that case rather than showing an
        email address.
        """
        if conversation.initiator_id == self._viewer().pk:
            return self.get_context(conversation)["label"]
        return getattr(conversation, "first_sender_name", None) or ""

    def get_last_message_excerpt(self, conversation) -> str:
        # Annotation, not a per-row query - same reason as above.
        body = getattr(conversation, "last_message_body", None) or ""
        return message_excerpt(body) if body else ""
```

- [ ] **Step 3d: Append to `backend/messaging/views.py`**

```python
from rest_framework.generics import ListAPIView

from messaging.enums import ConversationStatus, ConversationType
from messaging.pagination import ConversationPagination
from messaging.selectors import (
    annotate_last_message,
    annotate_unread,
    conversations_visible_to,
)
from messaging.serializers import ConversationSerializer
```

```python
class ConversationListView(MessagingAPIView, ListAPIView):
    """GET /api/v1/conversations/ - spec 30.1's "authorized inbox".

    Filters are spec 28's five, expressed as query parameters so one endpoint
    serves the broker screen, the private-seller screen and the sender's own
    list. MessagingAPIView comes first in the MRO so its permission_denied and
    throttled overrides win over ListAPIView's inherited APIView versions.
    """

    # Flag gate FIRST - see InquiryCreateView's docstring. Every messaging view
    # in this app lists UnifiedInquiriesEnabled first, without exception.
    permission_classes = [UnifiedInquiriesEnabled, IsAuthenticated, IsActiveUser]
    throttle_scope = "messaging_read"
    pagination_class = ConversationPagination
    serializer_class = ConversationSerializer

    def get_queryset(self):
        params = self.request.query_params
        queryset = annotate_last_message(
            annotate_unread(
                conversations_visible_to(self.request.user), self.request.user
            )
        )

        status_filter = params.get("status", ConversationStatus.OPEN).upper()
        if status_filter != "ALL":
            queryset = queryset.filter(status=status_filter)

        requested_types = [
            value
            for value in params.getlist("type")
            if value in ConversationType.values
        ]
        if params.getlist("type"):
            # An unrecognised value filters everything out rather than being
            # silently dropped: a client asking for a type that does not exist
            # should see an empty inbox, not somebody else's whole inbox.
            queryset = queryset.filter(conversation_type__in=requested_types)

        broker_id = params.get("broker")
        if broker_id:
            queryset = queryset.filter(broker_id=broker_id)

        if params.get("unread", "").lower() == "true":
            queryset = queryset.filter(unread_count__gt=0)

        return queryset
```

- [ ] **Step 3e: Append the route to `backend/messaging/urls.py`**

```python
    path("conversations/", ConversationListView.as_view(), name="conversation-list"),
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && uv run pytest messaging/tests/test_conversation_list_api.py -v`
Expected: PASS — **19 collected test items**.

Run the whole app to prove nothing earlier regressed:

Run: `cd backend && uv run pytest messaging notifications -q`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend/messaging
git commit -m "feat(messaging): GET /api/v1/conversations/ authorized inbox with spec 28 filters"
```

---

### Task 10: The thread — read, reply and mark-read

**Files:**
- Modify (append/refactor): `backend/messaging/services.py`, `backend/messaging/selectors.py`, `backend/messaging/serializers.py`, `backend/messaging/views.py`, `backend/messaging/urls.py`, `backend/messaging/exceptions.py`, `backend/config/settings/base.py` (one throttle rate)
- Test: `backend/messaging/tests/test_conversation_thread_api.py`

**Interfaces:**
- Consumes: everything from Tasks 1–9.
- Produces:
  - `messaging.exceptions.ConversationClosed` — `APIException`, 409, `default_code="conversation_closed"`
  - `messaging.selectors.conversation_recipients(conversation) -> tuple[list, str]`
  - `messaging.selectors.conversation_context(conversation) -> tuple[str, str]` (context type, label)
  - `messaging.services.post_reply(*, actor, conversation, body, request_id=None) -> Message`
  - `messaging.services.mark_conversation_read(*, actor, conversation) -> int`
  - `messaging.services._dispatch_notifications(...)` — the shared fan-out both `submit_inquiry` and `post_reply` use
  - `messaging.serializers.MessageSerializer`, `messaging.serializers.MessageCreateSerializer`
  - `messaging.views.ConversationMessagesView` (route name `conversation-messages`), `ConversationReadView` (route name `conversation-read`)
  - throttle scope `message_send` = `60/hour`

**Note (ruling — a reply is not an audited event, and carries no consent).** Spec §2.4 lists the five audited categories: staff actions, permission-sensitive status transitions, contact reveals, entitlement movements and listing decisions. A reply inside an existing thread is none of them — the permission-sensitive moment was the inquiry, which *is* audited, along with the grant it produced. Likewise spec §15.1's privacy-consent field belongs to the *inquiry*: `Message.privacy_policy_version` is written on the first message and left empty on replies, because re-presenting a consent checkbox on every reply is consent theatre, not consent. The first message of every thread carries the version, which is what §33.2 asks for.

**Note (ruling — the thread never returns an email address or a phone number).** `Message` stores `sender_email_snapshot` and `sender_phone_snapshot` (spec §11.8 and §15.1), and `MessageSerializer` returns **neither**. Only `sender_name_snapshot` is exposed. Contact data is Phase 7's, after a grant and through its own endpoint; a thread payload that quietly carried the private seller's address would unlock contact in the one direction spec §1 never authorised (a seller is not a grantable target at all — spec §11.8's `target_type`).

- [ ] **Step 1: Write the failing test**

`backend/messaging/tests/test_conversation_thread_api.py`:

```python
"""Spec 30.1's `GET/POST /api/v1/conversations/<id>/messages/` (thread/reply),
plus the mark-read endpoint spec 28 requires ("Mark-read and reply endpoints
enforce broker organization membership")."""

import pytest
from django.core import mail
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.tests.factories import make_user
from brokers.enums import BrokerMembershipRole
from brokers.tests.factories import make_broker, make_membership
from messaging.enums import ConversationStatus, ConversationType
from messaging.models import Message
from messaging.tests.factories import make_conversation, make_message
from notifications.models import Notification
from professionals.tests.factories import make_professional

# `reverse("conversation-list")` is used by the display-name regression test
# below, which checks the inbox payload as well as the thread payload.

pytestmark = pytest.mark.django_db

REPLY = "Thank you for getting in touch, next Tuesday morning works for us."


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def thread():
    asker = make_user(email="thr-asker@phase6.example", full_name="Ada Rossi")
    owner = make_user(email="thr-pro-owner@phase6.example", full_name="Bruno Neri")
    professional = make_professional(
        owner,
        display_name="Phase6 Thread Pro",
        slug="phase6-thread-pro",
        public_email="office@phase6-thread.example",
    )
    conversation = make_conversation(
        initiator=asker,
        conversation_type=ConversationType.PROFESSIONAL_INQUIRY,
        professional=professional,
        subject="Survey question",
    )
    first = make_message(conversation=conversation, sender=asker)
    conversation.last_message_at = first.created_at
    conversation.save(update_fields=["last_message_at", "updated_at"])
    return {
        "asker": asker,
        "owner": owner,
        "professional": professional,
        "conversation": conversation,
        "first": first,
    }


def _messages_url(conversation):
    return reverse("conversation-messages", args=[conversation.pk])


def _read_url(conversation):
    return reverse("conversation-read", args=[conversation.pk])


def test_a_guest_gets_401(api, thread):
    response = api.get(_messages_url(thread["conversation"]))
    assert response.status_code == 401
    assert response.data["error"]["code"] == "authentication_required"


def test_a_stranger_gets_404_not_403(api, thread):
    """Spec 33.1's IDOR rule: a 403 would confirm the conversation id exists."""
    api.force_authenticate(make_user(email="thr-stranger@phase6.example"))
    response = api.get(_messages_url(thread["conversation"]))
    assert response.status_code == 404
    assert response.data["error"]["code"] == "not_found"


def test_the_initiator_reads_the_thread_oldest_first(api, thread):
    second = make_message(
        conversation=thread["conversation"],
        sender=thread["owner"],
        body=REPLY,
        sender_name_snapshot="Bruno Neri",
    )
    api.force_authenticate(thread["asker"])
    response = api.get(_messages_url(thread["conversation"]))

    assert response.status_code == 200
    assert [row["id"] for row in response.data["results"]] == [
        str(thread["first"].pk),
        str(second.pk),
    ]
    assert response.data["results"][0]["sender"] == {
        "display_name": "Ada Rossi",
        "is_you": True,
    }
    assert response.data["results"][1]["sender"]["is_you"] is False


def test_the_thread_payload_contains_no_email_or_phone(api, thread):
    api.force_authenticate(thread["owner"])
    rendered = api.get(_messages_url(thread["conversation"])).content.decode()
    assert thread["asker"].email not in rendered
    assert thread["professional"].public_email not in rendered
    assert thread["professional"].public_phone not in rendered
    assert "sender_email_snapshot" not in rendered
    assert "sender_phone_snapshot" not in rendered


def test_a_broker_member_without_can_read_messages_gets_404(api):
    broker = make_broker(name="Phase6 Thread Brokers", slug="phase6-thread-brokers")
    agent = make_user(email="thr-agent@phase6.example")
    make_membership(
        agent, broker, role=BrokerMembershipRole.AGENT, can_edit_listings=True
    )
    conversation = make_conversation(
        initiator=make_user(email="thr-asker2@phase6.example"),
        conversation_type=ConversationType.BROKER_INQUIRY,
        broker=broker,
    )
    api.force_authenticate(agent)
    assert api.get(_messages_url(conversation)).status_code == 404


def test_the_recipient_replies_and_the_initiator_is_notified(
    api, thread, django_capture_on_commit_callbacks
):
    api.force_authenticate(thread["owner"])
    mail.outbox.clear()
    with django_capture_on_commit_callbacks(execute=True):
        response = api.post(
            _messages_url(thread["conversation"]), {"message": REPLY}, format="json"
        )

    assert response.status_code == 201
    assert Message.objects.count() == 2
    reply = Message.objects.latest("created_at")
    assert reply.sender_id == thread["owner"].pk
    assert reply.sender_name_snapshot == "Bruno Neri"
    # A reply carries no consent version - consent belongs to the inquiry.
    assert reply.privacy_policy_version == ""

    notification = Notification.objects.get()
    assert notification.recipient_id == thread["asker"].pk
    assert [sent.to for sent in mail.outbox] == [[thread["asker"].email]]

    thread["conversation"].refresh_from_db()
    assert thread["conversation"].last_message_at == reply.created_at


def test_the_initiator_replies_and_the_recipient_side_is_notified(
    api, thread, django_capture_on_commit_callbacks
):
    api.force_authenticate(thread["asker"])
    mail.outbox.clear()
    with django_capture_on_commit_callbacks(execute=True):
        api.post(_messages_url(thread["conversation"]), {"message": REPLY}, format="json")

    assert Notification.objects.get().recipient_id == thread["owner"].pk
    assert [sent.to for sent in mail.outbox] == [["office@phase6-thread.example"]]


def test_a_duplicate_reply_inside_the_window_is_rate_limited(api, thread):
    api.force_authenticate(thread["owner"])
    first = api.post(
        _messages_url(thread["conversation"]), {"message": REPLY}, format="json"
    )
    assert first.status_code == 201

    second = api.post(
        _messages_url(thread["conversation"]), {"message": REPLY}, format="json"
    )
    assert second.status_code == 429
    assert second.data["error"]["code"] == "rate_limited"
    assert Message.objects.count() == 2


def test_replying_to_an_archived_thread_is_refused(api, thread):
    thread["conversation"].status = ConversationStatus.ARCHIVED
    thread["conversation"].save(update_fields=["status", "updated_at"])
    api.force_authenticate(thread["owner"])
    response = api.post(
        _messages_url(thread["conversation"]), {"message": REPLY}, format="json"
    )
    assert response.status_code == 409
    assert response.data["error"]["code"] == "conversation_closed"


def test_replying_to_a_blocked_thread_is_refused(api, thread):
    """Spec 36.6: "Recipient blocking a user prevents new messages"."""
    thread["conversation"].status = ConversationStatus.BLOCKED
    thread["conversation"].save(update_fields=["status", "updated_at"])
    api.force_authenticate(thread["asker"])
    response = api.post(
        _messages_url(thread["conversation"]), {"message": REPLY}, format="json"
    )
    assert response.status_code == 409
    assert response.data["error"]["code"] == "conversation_closed"


def test_a_blank_named_replier_never_leaks_their_email_address(api, thread):
    """Regression guard.

    `User.get_full_name()` is `self.full_name or self.email` and
    `accounts.services.register_user` defaults `full_name=""`, so ANY use of it
    to derive a display name puts an email address in front of the other party.
    services._reply_display_name reads `actor.full_name` only and stores "".
    """
    nameless = make_user(email="thr-nameless@phase6.example", full_name="")
    # Give them a seat at this thread: they own the professional profile.
    thread["professional"].owner_user = nameless
    thread["professional"].save(update_fields=["owner_user", "updated_at"])

    api.force_authenticate(nameless)
    response = api.post(
        _messages_url(thread["conversation"]), {"message": REPLY}, format="json"
    )

    assert response.status_code == 201
    reply = Message.objects.latest("created_at")
    assert reply.sender_name_snapshot == ""
    assert nameless.email not in reply.sender_name_snapshot

    api.force_authenticate(thread["asker"])
    thread_body = api.get(_messages_url(thread["conversation"])).content.decode()
    inbox_body = api.get(reverse("conversation-list")).content.decode()
    assert nameless.email not in thread_body
    assert nameless.email not in inbox_body


@pytest.mark.parametrize(
    ("name_length", "expected_length"),
    [(120, 120), (150, 120)],
)
def test_an_over_long_account_name_is_truncated_not_a_database_error(
    api, thread, name_length, expected_length
):
    """accounts.User.full_name is max_length=150; Message.sender_name_snapshot is
    120, spec 15.1's number for this field. Without the truncation in
    services._reply_display_name the 150 case raises DataError inside
    post_reply's transaction and the reply silently never exists."""
    long_name = "N" * name_length
    replier = make_user(email=f"thr-long{name_length}@phase6.example", full_name=long_name)
    thread["professional"].owner_user = replier
    thread["professional"].save(update_fields=["owner_user", "updated_at"])

    api.force_authenticate(replier)
    response = api.post(
        _messages_url(thread["conversation"]), {"message": REPLY}, format="json"
    )

    assert response.status_code == 201
    reply = Message.objects.latest("created_at")
    assert len(reply.sender_name_snapshot) == expected_length
    assert reply.sender_name_snapshot == long_name[:expected_length]


def test_a_short_reply_is_a_field_error(api, thread):
    api.force_authenticate(thread["owner"])
    response = api.post(
        _messages_url(thread["conversation"]), {"message": "ok"}, format="json"
    )
    assert response.status_code == 400
    assert response.data["error"]["code"] == "validation_error"
    assert "message" in response.data["error"]["fields"]


def test_mark_read_only_touches_the_other_sides_messages(api, thread):
    own_reply = make_message(
        conversation=thread["conversation"], sender=thread["owner"], body=REPLY
    )
    api.force_authenticate(thread["owner"])

    response = api.post(_read_url(thread["conversation"]), {}, format="json")

    assert response.status_code == 200
    assert response.data == {"marked_read": 1}
    thread["first"].refresh_from_db()
    own_reply.refresh_from_db()
    assert thread["first"].read_at is not None
    assert own_reply.read_at is None


def test_mark_read_is_idempotent(api, thread):
    api.force_authenticate(thread["owner"])
    api.post(_read_url(thread["conversation"]), {}, format="json")
    second = api.post(_read_url(thread["conversation"]), {}, format="json")
    assert second.data == {"marked_read": 0}


def test_a_stranger_cannot_mark_a_thread_read(api, thread):
    api.force_authenticate(make_user(email="thr-stranger2@phase6.example"))
    assert api.post(_read_url(thread["conversation"]), {}, format="json").status_code == 404


def test_the_flag_gates_the_thread_endpoints(api, thread, unified_inquiries_disabled):
    # Anonymous first: the answer must be feature_disabled, not the
    # authentication_required DRF produces when an authentication gate is
    # consulted before the flag gate. ONE request, asserted twice - a second
    # GET here would add nothing - permissions run before throttles, so a flag-off 403 spends no token.
    anonymous = api.get(_messages_url(thread["conversation"]))
    assert anonymous.status_code == 403
    assert anonymous.data["error"]["code"] == "feature_disabled"

    api.force_authenticate(thread["asker"])
    assert api.get(_messages_url(thread["conversation"])).status_code == 403
    assert (
        api.post(
            _messages_url(thread["conversation"]), {"message": REPLY}, format="json"
        ).status_code
        == 403
    )
    assert api.post(_read_url(thread["conversation"]), {}, format="json").status_code == 403
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && uv run pytest messaging/tests/test_conversation_thread_api.py -v`
Expected: FAIL — `NoReverseMatch: Reverse for 'conversation-messages' not found`.

- [ ] **Step 3a: Append `ConversationClosed` to `backend/messaging/exceptions.py`**

```python
class ConversationClosed(APIException):
    """Spec 36.6: "Recipient blocking a user prevents new messages."

    ARCHIVED is refused for the same reason, deliberately: archiving is a filing
    decision by one side, and silently re-opening a thread because the other
    side typed into it would undo it without asking. Nothing in this phase
    archives or blocks a thread - Phase 19's inbox and any future staff
    moderation are the producers - so today this is a guard, and the guard is
    what makes those phases safe to build.
    """

    status_code = status.HTTP_409_CONFLICT
    default_detail = "This conversation is closed."
    default_code = "conversation_closed"
```

- [ ] **Step 3b: Append to `backend/messaging/selectors.py`**

```python
def conversation_recipients(conversation) -> tuple[list, str]:
    """The RECIPIENT side of a stored thread: who to notify in-app, and the one
    address to email (spec 15.4). Mirrors messaging.context's resolution rules,
    but reads them off a saved Conversation rather than a request."""
    if conversation.broker_id is not None:
        return (
            list(broker_message_readers(conversation.broker)),
            conversation.broker.public_email,
        )
    if conversation.professional_id is not None:
        owner = conversation.professional.owner_user
        return ([owner] if owner is not None else []), conversation.professional.public_email
    if conversation.listing_id is not None:
        owner = conversation.listing.owner_user
        return ([owner], owner.email) if owner is not None else ([], "")
    return [], ""


def conversation_context(conversation) -> tuple[str, str]:
    """(context type, human label) for a stored thread - the notification
    payload's `context_type` and `context_label`."""
    if conversation.listing_id is not None:
        snapshot = conversation.listing.current_public_snapshot
        label = ""
        if snapshot is not None:
            model_name = (
                snapshot.custom_model_name_snapshot or snapshot.model_name_snapshot
            )
            label = f"{snapshot.brand_name_snapshot} {model_name}".strip()
        return "LISTING", label
    if conversation.broker_id is not None:
        return "BROKER", conversation.broker.name
    if conversation.professional_id is not None:
        return "PROFESSIONAL", conversation.professional.display_name
    return "SUPPORT", ""
```

- [ ] **Step 3c: Refactor the notification fan-out in `backend/messaging/services.py`**

Replace the body of `_notify_recipients` with a call to a new shared helper, so the inquiry path and the reply path can never drift:

```python
def _dispatch_notifications(
    *, recipients, email_to, conversation, message, context_type, context_label
) -> list[str]:
    """One fan-out, used by both submit_inquiry() and post_reply().

    In-app goes to every recipient; the email goes to exactly one address,
    carried by exactly one of those notifications (spec 15.4: "not every member
    by default").
    """
    recipients = list(recipients)
    if not recipients:
        # Truthful consequence of can_read_messages defaulting to False: nobody
        # on the recipient side can read messages, so nobody is told. The thread
        # is still real and appears the moment staff grants the capability.
        # Surfaced as a warning so spec 33.4's alerting can see it.
        logger.warning(
            "message has no in-app recipient",
            extra={"conversation_id": str(conversation.pk)},
        )
        return []

    # Deterministic: prefer the recipient whose own account address IS the
    # configured address (the private-seller and professional-owner cases), so
    # one person does not get both the in-app row and an email that reads as if
    # it were meant for a shared inbox. Otherwise the lowest pk, because
    # broker_message_readers() orders by pk.
    email_index = 0
    for index, user in enumerate(recipients):
        if user.email == email_to:
            email_index = index
            break

    payload = {
        "conversation_id": str(conversation.pk),
        "message_id": str(message.pk),
        "context_type": context_type,
        "context_label": context_label,
        "sender_display_name": message.sender_name_snapshot,
        "excerpt": message_excerpt(message.body),
    }

    notification_ids = []
    for index, user in enumerate(recipients):
        notification = create_notification(
            recipient=user,
            notification_type=NotificationType.INQUIRY_RECEIVED,
            title_key=INQUIRY_TITLE_KEY,
            body_key=INQUIRY_BODY_KEY,
            target_url=conversation_url(conversation.pk),
            payload=payload,
            email_to=email_to if index == email_index and email_to else "",
            # Spec 27.1's deduplication key for `inquiry.received` is the
            # message ID. Scoped per recipient by the model's constraint, so a
            # broker team still gets one notification each.
            dedupe_key=str(message.pk),
        )
        notification_ids.append(str(notification.pk))
    return notification_ids


def _notify_recipients(context, conversation, message) -> list[str]:
    return _dispatch_notifications(
        recipients=context.recipient_users,
        email_to=context.recipient_email,
        conversation=conversation,
        message=message,
        context_type=context.context_type,
        context_label=context.context_label,
    )
```

- [ ] **Step 3d: Append `post_reply` and `mark_conversation_read` to `backend/messaging/services.py`**

Add these imports to the module's import section:

```python
from messaging.enums import FULL_NAME_MAX_LENGTH, ConversationStatus
from messaging.exceptions import ConversationClosed
from messaging.selectors import conversation_context, conversation_recipients
```

```python
def _reply_display_name(actor) -> str:
    """The replier's stated name, or the empty string - NEVER their email.

    `actor.full_name` and nothing else. Do not reach for `User.get_full_name()`
    or `get_short_name()`: both are `self.full_name or self.email`
    (accounts/models.py), so an account that never set a name would put its
    EMAIL ADDRESS into `Message.sender_name_snapshot`, which
    `MessageSerializer.get_sender()["display_name"]` and
    `ConversationSerializer.get_counterparty_name()` hand straight to the other
    party. `accounts.services.register_user` defaults `full_name=""`, so this is
    the common case, not an edge one - and spec 15.1's Full name field exists on
    the inquiry form precisely because an account name is not guaranteed.

    An empty string is returned rather than a fabricated English placeholder:
    backend-generated user-visible text must be a translation key, not a
    concatenated literal (spec 37). The thread UI renders
    `inquiry.sender_unnamed` for a blank name (Phase 19), and the notification
    email substitutes its own per-locale fallback in notifications/tasks.py.

    TRUNCATED to FULL_NAME_MAX_LENGTH, and that is not defensive padding:
    `accounts.User.full_name` is `max_length=150` while spec 15.1 caps the
    inquiry form's Full name at 120, which is what `Message.sender_name_snapshot`
    is sized to. An account carrying a 121-150 character name would otherwise
    raise `DataError: value too long for type character varying(120)` inside
    post_reply's transaction, rolling back a message the sender was told nothing
    about. Truncating is the right call rather than widening the column: 120 is
    the spec's number for this field, and every INQUIRY row already obeys it, so
    widening would let replies hold names no inquiry could.
    """
    return (actor.full_name or "").strip()[:FULL_NAME_MAX_LENGTH]


@transaction.atomic
def post_reply(*, actor, conversation, body, request_id=None) -> Message:
    """A reply inside an existing thread (spec 30.1's POST .../messages/).

    Authorization is the CALLER's job - messaging.selectors.can_view_conversation
    decides who may see a thread, and the view refuses before reaching here.
    This function owns what happens once they may.
    """
    if conversation.status != ConversationStatus.OPEN:
        raise ConversationClosed()

    _refuse_duplicate(conversation, actor, body)

    message = Message.objects.create(
        conversation=conversation,
        sender=actor,
        body=body,
        sender_email_snapshot=actor.email,
        sender_name_snapshot=_reply_display_name(actor),
        sender_phone_snapshot="",
        is_system=False,
        # Empty on purpose: consent belongs to the inquiry, not to every reply.
        privacy_policy_version="",
        marketing_consent=False,
    )
    conversation.last_message_at = message.created_at
    conversation.save(update_fields=["last_message_at", "updated_at"])

    recipient_side, recipient_email = conversation_recipients(conversation)
    if actor.pk == conversation.initiator_id:
        recipients, email_to = recipient_side, recipient_email
    else:
        recipients, email_to = [conversation.initiator], conversation.initiator.email

    context_type, context_label = conversation_context(conversation)
    notification_ids = _dispatch_notifications(
        recipients=recipients,
        email_to=email_to,
        conversation=conversation,
        message=message,
        context_type=context_type,
        context_label=context_label,
    )

    transaction.on_commit(
        lambda: inquiry_received.send(
            sender=Message,
            conversation=conversation,
            message=message,
            notification_ids=notification_ids,
        )
    )
    return message


@transaction.atomic
def mark_conversation_read(*, actor, conversation) -> int:
    """Marks every message the actor did NOT send as read, and returns how many
    changed. Spec 11.8 gives Message one read_at, so this means "read by the
    recipient side" for a broker team - see the plan's Known Limitations."""
    return (
        conversation.messages.filter(read_at__isnull=True)
        .exclude(sender=actor)
        .update(read_at=timezone.now())
    )
```

- [ ] **Step 3e: Append to `backend/messaging/serializers.py`**

```python
class MessageSerializer(serializers.Serializer):
    """One message in a thread.

    Returns NO email address and NO phone number - not the sender's, not the
    recipient's. `sender_email_snapshot` and `sender_phone_snapshot` are stored
    for the record (spec 11.8, 15.1) and served by nothing in this phase; contact
    reveal is Phase 7's, through its own endpoint, after a grant.
    """

    id = serializers.UUIDField(read_only=True)
    body = serializers.CharField(read_only=True)
    is_system = serializers.BooleanField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    read_at = serializers.DateTimeField(read_only=True)
    sender = serializers.SerializerMethodField()

    def get_sender(self, message) -> dict:
        """`display_name` may be the empty string, and that is the correct
        answer for a replier whose account has no name: the alternative -
        User.get_full_name()'s `full_name or email` - would publish an email
        address to the other party. The client renders the localized
        `inquiry.sender_unnamed` string for a blank name (spec 37)."""
        viewer = self.context["request"].user
        return {
            "display_name": message.sender_name_snapshot,
            "is_you": message.sender_id == viewer.pk,
        }


class MessageCreateSerializer(serializers.Serializer):
    """Spec 15.1's Message rule applies to a reply too: 20-4000 characters."""

    message = serializers.CharField(
        min_length=MESSAGE_MIN_LENGTH, max_length=MESSAGE_MAX_LENGTH
    )
```

- [ ] **Step 3f: Append to `backend/messaging/views.py`**

Add these imports to the module's import section:

`NotFound` joins the existing `from rest_framework.exceptions import NotAuthenticated`
line added in Task 7:

```python
from rest_framework.exceptions import NotAuthenticated, NotFound

from messaging.models import Conversation
from messaging.pagination import ConversationPagination, MessagePagination
from messaging.selectors import (
    annotate_last_message,
    annotate_unread,
    can_view_conversation,
    conversations_visible_to,
)
from messaging.serializers import MessageCreateSerializer, MessageSerializer
from messaging.services import mark_conversation_read, post_reply, submit_inquiry
```

`mark_conversation_read` lives in `messaging.services`, beside `post_reply` — both
hold a transaction, so neither belongs in `selectors`, which is read-only by
convention in this project.

```python
class ConversationScopedView(MessagingAPIView):
    """Resolve the conversation and refuse with 404, never 403.

    Spec 33.1: "Avoid IDOR by never trusting recipient/owner IDs from client
    without context resolution." A 403 here would confirm that a conversation id
    exists, which is itself information about other people's correspondence.
    """

    # Flag gate FIRST - see InquiryCreateView's docstring.
    permission_classes = [UnifiedInquiriesEnabled, IsAuthenticated, IsActiveUser]

    def get_conversation(self, conversation_id):
        conversation = (
            Conversation.objects.select_related(
                "broker",
                "professional__owner_user",
                "listing__owner_user",
                "listing__current_public_snapshot",
                "initiator",
            )
            .filter(pk=conversation_id)
            .first()
        )
        if conversation is None or not can_view_conversation(
            self.request.user, conversation
        ):
            raise NotFound()
        return conversation


class ConversationMessagesView(ConversationScopedView):
    """GET/POST /api/v1/conversations/<id>/messages/ - spec 30.1's thread/reply."""

    def initial(self, request, *args, **kwargs):
        # throttle_scope is read off the view at request time by
        # ScopedRateThrottle.allow_request, and check_throttles runs inside
        # super().initial() - so setting it here, before the super call, is what
        # lets one route carry spec 30.4's two different limits (a read and a
        # send are not the same kind of traffic).
        self.throttle_scope = (
            "message_send" if request.method == "POST" else "messaging_read"
        )
        super().initial(request, *args, **kwargs)

    def get(self, request, conversation_id):
        conversation = self.get_conversation(conversation_id)
        paginator = MessagePagination()
        page = paginator.paginate_queryset(
            conversation.messages.all(), request, view=self
        )
        serializer = MessageSerializer(page, many=True, context={"request": request})
        return paginator.get_paginated_response(serializer.data)

    def post(self, request, conversation_id):
        conversation = self.get_conversation(conversation_id)
        serializer = MessageCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = post_reply(
            actor=request.user,
            conversation=conversation,
            body=serializer.validated_data["message"],
            request_id=getattr(request, "request_id", "") or None,
        )
        return Response(
            MessageSerializer(message, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class ConversationReadView(ConversationScopedView):
    """POST /api/v1/conversations/<id>/read/ - an addition beyond spec 30.1's
    table, required by spec 28 ("Mark-read and reply endpoints enforce broker
    organization membership") and by the unread counts spec 28's row carries."""

    throttle_scope = "messaging_read"

    def post(self, request, conversation_id):
        conversation = self.get_conversation(conversation_id)
        return Response(
            {
                "marked_read": mark_conversation_read(
                    actor=request.user, conversation=conversation
                )
            }
        )
```

- [ ] **Step 3g: Append `MessagePagination` to `backend/messaging/pagination.py`**

```python
class MessagePagination(PageNumberPagination):
    """A thread is read oldest-first from page 1, so the page is larger than the
    inbox's: a typical conversation fits on one page."""

    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200
```

- [ ] **Step 3h: Append the routes and the throttle rate**

`backend/messaging/urls.py`:

```python
    path(
        "conversations/<uuid:conversation_id>/messages/",
        ConversationMessagesView.as_view(),
        name="conversation-messages",
    ),
    path(
        "conversations/<uuid:conversation_id>/read/",
        ConversationReadView.as_view(),
        name="conversation-read",
    ),
```

`backend/config/settings/base.py`, inside `DEFAULT_THROTTLE_RATES` (append only):

```python
        # Spec 30.4 requires a limit on message sending. Looser than
        # inquiry_submit because a reply inside an existing thread neither
        # creates a contact grant nor reaches a stranger.
        "message_send": "60/hour",
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && uv run pytest messaging/tests/test_conversation_thread_api.py -v`
Expected: PASS — **18 collected test items** (16 plain tests plus `test_an_over_long_account_name_is_truncated_not_a_database_error` × 2).

Then the whole backend, to prove nothing in another app regressed:

Run: `cd backend && uv run pytest -q`
Expected: all pass, 0 failures.

Run: `cd backend && git diff --name-only dev -- listings/ platform_settings/ common/ brokers/ professionals/ accounts/ audit/ taxonomy/ finance/ services_catalog/ conftest.py`
Expected: **empty output** — the only already-merged files this phase touches are `config/settings/base.py` and `config/urls.py`.

- [ ] **Step 5: Commit**

```bash
git add backend/messaging backend/config/settings/base.py
git commit -m "feat(messaging): conversation thread, reply and mark-read endpoints"
```

---

### Task 11: Frontend API module, message dictionary and draft storage

**Files:**
- Create: `frontend/src/lib/api/inquiries.ts`, `frontend/src/lib/api/inquiries.test.ts`, `frontend/src/lib/i18n/inquiry.ts`, `frontend/src/lib/i18n/inquiry.test.ts`, `frontend/src/lib/inquiry/draft-storage.ts`, `frontend/src/lib/inquiry/draft-storage.test.ts`
- Test: the three `.test.ts` files above

**Interfaces:**
- Consumes: `@/lib/api/client`'s `apiFetch` and `ApiError` (Phase 3); `@/lib/api/directory`'s **`directoryFetch`** (Phase 5's contract, extended by the merged PR #103 to forward `X-Internal-Service-Secret` + `X-Internal-Client-IP`); `DEFAULT_LOCALE` and `type Locale` from **`@/lib/i18n/directory`** — that module is where `DEFAULT_LOCALE` is declared, and it re-exports `Locale` from `@/lib/api/directory`, which remains the single declaration site (Phase 5 contract rule 12). **`Locale` is imported, never redeclared.**
- Produces:
  - `@/lib/api/inquiries`: `INQUIRY_CONTEXT_TYPES`, types `InquiryContextType`, `InquiryContextRef`, `InquiryConfig`, `InquiryResult`, `InquiryDraftFields`, `InquirySubmission`; functions `fetchInquiryConfig()`, `submitInquiry(payload)`, `createInquiryDraft(fields)`, `resolveInquiryDraft(token)`
  - `@/lib/i18n/inquiry`: `INQUIRY_MESSAGES`, `tInquiry(locale, key)`, `formatInquiryMessage(template, values)`
  - `@/lib/inquiry/draft-storage`: `storeDraftToken(context, token)`, `readDraftToken(context)`, `clearDraftToken(context)`

- [ ] **Step 1: Write the failing tests**

`frontend/src/lib/api/inquiries.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchInquiryConfig } from "@/lib/api/inquiries";

const directoryFetch = vi.fn();
vi.mock("@/lib/api/directory", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/directory")>();
  return { ...actual, directoryFetch: (...args: unknown[]) => directoryFetch(...args) };
});

const CONFIG = {
  enabled: true,
  privacy_policy_version: "2026-09",
  honeypot_field: "company_website",
  limits: {
    full_name: { min: 2, max: 120 },
    subject: { min: 3, max: 150 },
    message: { min: 20, max: 4000 },
    phone_max: 32,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchInquiryConfig", () => {
  it("reads the config from the API", async () => {
    directoryFetch.mockResolvedValue(CONFIG);
    await expect(fetchInquiryConfig()).resolves.toEqual(CONFIG);
  });

  it("goes through directoryFetch, which is what forwards the visitor IP", async () => {
    // Not an implementation detail: directoryFetch attaches
    // X-Internal-Service-Secret and X-Internal-Client-IP (PR #103), without
    // which every server-rendered visitor shares one `messaging_read` throttle
    // bucket and a 429 makes the inquiry form disappear from the page. A plain
    // `fetch()` here would compile, pass a happy-path test, and reintroduce
    // exactly that - so the delegation is asserted, not assumed.
    directoryFetch.mockResolvedValue(CONFIG);
    await fetchInquiryConfig();
    expect(directoryFetch).toHaveBeenCalledWith("/api/v1/inquiries/config/");
  });

  it("returns null when the API is unreachable, so the page fails closed", async () => {
    directoryFetch.mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(fetchInquiryConfig()).resolves.toBeNull();
  });

  it("returns null on a non-2xx rather than throwing during SSR", async () => {
    directoryFetch.mockRejectedValue(new Error("Directory API failed: 503"));
    await expect(fetchInquiryConfig()).resolves.toBeNull();
  });

  it("returns null on a 404, which directoryFetch reports as null", async () => {
    directoryFetch.mockResolvedValue(null);
    await expect(fetchInquiryConfig()).resolves.toBeNull();
  });
});
```

`frontend/src/lib/i18n/inquiry.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { INQUIRY_MESSAGES, formatInquiryMessage, tInquiry } from "@/lib/i18n/inquiry";

describe("INQUIRY_MESSAGES", () => {
  it("has all three languages for every key (spec 0, spec 37)", () => {
    for (const [key, translations] of Object.entries(INQUIRY_MESSAGES)) {
      for (const locale of ["en", "it", "es"] as const) {
        expect(translations[locale], `${key}.${locale}`).toBeTruthy();
      }
    }
  });

  it("carries the three keys spec 37 names explicitly", () => {
    expect(INQUIRY_MESSAGES["inquiry.email"]).toBeDefined();
    expect(INQUIRY_MESSAGES["inquiry.send"]).toBeDefined();
    expect(INQUIRY_MESSAGES["inquiry.sent"]).toBeDefined();
  });

  it("falls back to English for a locale with no entry", () => {
    expect(tInquiry("it", "inquiry.send")).toBe(INQUIRY_MESSAGES["inquiry.send"].it);
  });

  it("throws on an unknown key rather than rendering an empty label", () => {
    expect(() => tInquiry("en", "inquiry.nope")).toThrow(/Unknown inquiry message key/);
  });

  it("interpolates named placeholders", () => {
    expect(
      formatInquiryMessage("Question about {context}", { context: "Azimut 43" }),
    ).toBe("Question about Azimut 43");
  });

  it("leaves an unmatched placeholder untouched rather than printing undefined", () => {
    expect(formatInquiryMessage("Hello {name}", {})).toBe("Hello {name}");
  });
});
```

`frontend/src/lib/inquiry/draft-storage.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearDraftToken,
  readDraftToken,
  storeDraftToken,
} from "@/lib/inquiry/draft-storage";

const contextA = { type: "PROFESSIONAL" as const, id: "aaa", label: "Pro A" };
const contextB = { type: "PROFESSIONAL" as const, id: "bbb", label: "Pro B" };

beforeEach(() => {
  window.sessionStorage.clear();
});

describe("draft-storage", () => {
  it("round-trips a token for one context", () => {
    storeDraftToken(contextA, "token-a");
    expect(readDraftToken(contextA)).toBe("token-a");
  });

  it("keys by context, so another provider's page never restores this draft", () => {
    storeDraftToken(contextA, "token-a");
    expect(readDraftToken(contextB)).toBeNull();
  });

  it("clears a token", () => {
    storeDraftToken(contextA, "token-a");
    clearDraftToken(contextA);
    expect(readDraftToken(contextA)).toBeNull();
  });

  it("never throws when storage is unavailable (private mode, blocked cookies)", () => {
    const boom = () => {
      throw new Error("SecurityError");
    };
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(boom);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(boom);
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(boom);

    expect(() => storeDraftToken(contextA, "token-a")).not.toThrow();
    expect(readDraftToken(contextA)).toBeNull();
    expect(() => clearDraftToken(contextA)).not.toThrow();

    vi.restoreAllMocks();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && pnpm vitest run src/lib/api/inquiries.test.ts src/lib/i18n/inquiry.test.ts src/lib/inquiry/draft-storage.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/api/inquiries"`.

- [ ] **Step 3a: Write `frontend/src/lib/api/inquiries.ts`**

```ts
// The shared inquiry API (spec 15.5, 30.1). One module for all three contexts,
// because there is one endpoint and one form (spec 15.1, spec 39).
import { apiFetch } from "@/lib/api/client";
import { directoryFetch } from "@/lib/api/directory";

export const INQUIRY_CONTEXT_TYPES = ["LISTING", "BROKER", "PROFESSIONAL"] as const;
export type InquiryContextType = (typeof INQUIRY_CONTEXT_TYPES)[number];

/** What the form is attached to. `label` is only for display and the subject
 *  default; the server re-derives the recipient from `type` + `id` and never
 *  trusts anything else (spec 11.8, 33.1). */
export interface InquiryContextRef {
  type: InquiryContextType;
  id: string;
  label: string;
}

export interface InquiryConfig {
  enabled: boolean;
  privacy_policy_version: string;
  honeypot_field: string;
  limits: {
    full_name: { min: number; max: number };
    subject: { min: number; max: number };
    message: { min: number; max: number };
    phone_max: number;
  };
}

export interface InquirySubmission {
  context_type: InquiryContextType;
  context_id: string;
  full_name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  privacy_policy_version: string;
  privacy_consent: boolean;
  marketing_consent: boolean;
  /** The honeypot. Always sent, always empty for a real person (spec 15.1). */
  company_website: string;
}

export interface InquiryResult {
  conversation_id: string;
  message_id: string;
  contact_access: "GRANTED" | "NOT_APPLICABLE";
  next_url: string;
}

export interface InquiryDraftFields {
  context_type: string;
  context_id: string;
  full_name: string;
  phone: string;
  subject: string;
  message: string;
}

/**
 * Public, unauthenticated read, executed during SSR.
 *
 * It delegates to `directoryFetch` rather than calling `fetch` itself, and that
 * is the whole point: `directoryFetch` (merged with PR #103) attaches
 * `X-Internal-Service-Secret` and the visitor's `X-Internal-Client-IP`, which
 * `backend/common/ip.py` verifies with `hmac.compare_digest` before believing
 * the forwarded address. Without it every server-rendered visitor shares one
 * throttle bucket, and the `messaging_read` limit (120/min) would be consumed
 * platform-wide by ordinary traffic - at which point this call 429s, returns
 * null, and the professional page silently renders with NO inquiry form. It
 * also supplies the right base URL (127.0.0.1, not localhost, because this
 * machine resolves localhost to IPv6 ::1 - Phase 0/1 retrospective) and
 * `cache: "no-store"`.
 *
 * `directoryFetch` returns null on 404 and throws on any other non-2xx; both
 * become null here, because a page that cannot reach the API must render
 * without the form rather than 500. The config endpoint never 404s in practice
 * (it is AllowAny and reports the flag state in its body), so a null answer
 * means "API unreachable" and the page fails closed.
 */
export async function fetchInquiryConfig(): Promise<InquiryConfig | null> {
  try {
    return await directoryFetch<InquiryConfig>("/api/v1/inquiries/config/");
  } catch {
    return null;
  }
}

/** Throws ApiError on any non-2xx; the form reads `.code` to choose its copy. */
export async function submitInquiry(
  payload: InquirySubmission,
): Promise<InquiryResult> {
  return apiFetch<InquiryResult>("/api/v1/inquiries/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Spec 15.2: preserve a guest's work before sending them to sign in. */
export async function createInquiryDraft(
  fields: InquiryDraftFields,
): Promise<{ draft_token: string; expires_in: number }> {
  return apiFetch("/api/v1/inquiry-drafts/", {
    method: "POST",
    body: JSON.stringify(fields),
  });
}

/** Spec 15.2's return half. Restores the fields; never sends anything. */
export async function resolveInquiryDraft(
  draftToken: string,
): Promise<InquiryDraftFields> {
  return apiFetch<InquiryDraftFields>("/api/v1/inquiry-drafts/resolve/", {
    method: "POST",
    body: JSON.stringify({ draft_token: draftToken }),
  });
}
```

- [ ] **Step 3b: Write `frontend/src/lib/i18n/inquiry.ts`**

```ts
// Spec 37: every new UI string has EN/IT/ES and no English is hard-coded inside
// a component. Same typed-dictionary shape as lib/i18n/directory.ts.
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/directory";

type Translations = Record<Locale, string>;

export const INQUIRY_MESSAGES: Record<string, Translations> = {
  // Spec 37 names these three explicitly.
  "inquiry.email": { en: "Email", it: "Email", es: "Correo electrónico" },
  "inquiry.send": { en: "Send message", it: "Invia messaggio", es: "Enviar mensaje" },
  "inquiry.sent": {
    en: "Your message has been sent.",
    it: "Il tuo messaggio è stato inviato.",
    es: "Tu mensaje ha sido enviado.",
  },

  "inquiry.heading": {
    en: "Send a message",
    it: "Invia un messaggio",
    es: "Enviar un mensaje",
  },
  "inquiry.full_name": { en: "Full name", it: "Nome completo", es: "Nombre completo" },
  "inquiry.email_hint": {
    // Spec 15.1's "Update in account". Rendered as text, not a link, until an
    // /account/ page exists - see the comment at its render site.
    en: "Messages are sent from your account email. Change it in your account settings.",
    it: "I messaggi vengono inviati dall'email del tuo account. Modificala nelle impostazioni.",
    es: "Los mensajes se envían desde el correo de tu cuenta. Cámbialo en los ajustes.",
  },
  "inquiry.phone": {
    en: "Phone (optional)",
    it: "Telefono (facoltativo)",
    es: "Teléfono (opcional)",
  },
  "inquiry.phone_hint": {
    en: "International format, for example +390000000000.",
    it: "Formato internazionale, ad esempio +390000000000.",
    es: "Formato internacional, por ejemplo +390000000000.",
  },
  "inquiry.subject": { en: "Subject", it: "Oggetto", es: "Asunto" },
  "inquiry.subject_default": {
    en: "Question about {context}",
    it: "Domanda su {context}",
    es: "Consulta sobre {context}",
  },
  "inquiry.message": { en: "Message", it: "Messaggio", es: "Mensaje" },
  "inquiry.privacy_consent": {
    en: "I accept the privacy policy (version {version}).",
    it: "Accetto l'informativa sulla privacy (versione {version}).",
    es: "Acepto la política de privacidad (versión {version}).",
  },
  "inquiry.marketing_consent": {
    en: "Send me occasional updates from NAUTA.",
    it: "Inviami aggiornamenti occasionali da NAUTA.",
    es: "Enviarme novedades ocasionales de NAUTA.",
  },
  "inquiry.sending": { en: "Sending…", it: "Invio…", es: "Enviando…" },
  // Rendered wherever a message's `sender.display_name` is the empty string -
  // which is what the backend stores for a replier whose account has no name,
  // rather than leaking their email address. Phase 19's thread UI consumes it.
  "inquiry.sender_unnamed": {
    en: "A NAUTA user",
    it: "Un utente NAUTA",
    es: "Un usuario de NAUTA",
  },
  "inquiry.sign_in_to_send": {
    en: "Sign in to send",
    it: "Accedi per inviare",
    es: "Inicia sesión para enviar",
  },
  "inquiry.draft_restored": {
    en: "Your message was saved. Check it and press Send.",
    it: "Il tuo messaggio è stato salvato. Controllalo e premi Invia.",
    es: "Tu mensaje se ha guardado. Revísalo y pulsa Enviar.",
  },
  "inquiry.verify_email_first": {
    en: "Verify your email address before sending a message.",
    it: "Verifica il tuo indirizzo email prima di inviare un messaggio.",
    es: "Verifica tu dirección de correo antes de enviar un mensaje.",
  },
  "inquiry.error.generic": {
    en: "Your message could not be sent. Please try again.",
    it: "Impossibile inviare il messaggio. Riprova.",
    es: "No se ha podido enviar el mensaje. Inténtalo de nuevo.",
  },
  "inquiry.error.validation": {
    en: "Please check the highlighted fields.",
    it: "Controlla i campi evidenziati.",
    es: "Revisa los campos indicados.",
  },
  "inquiry.error.rate_limited": {
    en: "You are sending messages too quickly. Please try again shortly.",
    it: "Stai inviando messaggi troppo rapidamente. Riprova tra poco.",
    es: "Estás enviando mensajes demasiado rápido. Inténtalo en unos minutos.",
  },
  "inquiry.error.recipient_unavailable": {
    en: "This recipient cannot receive messages right now.",
    it: "Questo destinatario non può ricevere messaggi al momento.",
    es: "Este destinatario no puede recibir mensajes ahora mismo.",
  },
  "inquiry.error.consent_required": {
    en: "Accept the privacy policy to send your message.",
    it: "Accetta l'informativa sulla privacy per inviare il messaggio.",
    es: "Acepta la política de privacidad para enviar tu mensaje.",
  },
  "inquiry.error.self_inquiry": {
    en: "You cannot send a message to your own listing or profile.",
    it: "Non puoi inviare un messaggio al tuo annuncio o profilo.",
    es: "No puedes enviar un mensaje a tu propio anuncio o perfil.",
  },
  "inquiry.error.feature_disabled": {
    en: "Messaging is temporarily unavailable.",
    it: "La messaggistica non è temporaneamente disponibile.",
    es: "La mensajería no está disponible temporalmente.",
  },
  "inquiry.error.draft_expired": {
    en: "Your saved message expired. Please retype it.",
    it: "Il messaggio salvato è scaduto. Riscrivilo.",
    es: "Tu mensaje guardado ha caducado. Vuelve a escribirlo.",
  },
};

export function tInquiry(locale: Locale, key: string): string {
  const translations = INQUIRY_MESSAGES[key];
  if (!translations) {
    throw new Error(`Unknown inquiry message key: ${key}`);
  }
  return translations[locale] || translations[DEFAULT_LOCALE];
}

/** Replaces {name} placeholders. An unmatched placeholder is left as written,
 *  so a missing value is visible in review rather than rendering "undefined". */
export function formatInquiryMessage(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? values[name] : match,
  );
}
```

- [ ] **Step 3c: Write `frontend/src/lib/inquiry/draft-storage.ts`**

```ts
// Spec 15.2's browser half. The TOKEN is signed by the server and expires in 30
// minutes; this module only decides where the browser keeps it.
//
// sessionStorage, not localStorage: a draft is meant to survive one sign-in
// round trip in one tab, not to sit on the device indefinitely. Every access is
// wrapped, because sessionStorage throws in private mode and with site data
// blocked, and a saved draft is a convenience - never a reason to break a page.
import type { InquiryContextRef } from "@/lib/api/inquiries";

const KEY_PREFIX = "nauta.inquiry-draft";

function storageKey(context: InquiryContextRef): string {
  return `${KEY_PREFIX}:${context.type}:${context.id}`;
}

export function storeDraftToken(context: InquiryContextRef, token: string): void {
  try {
    window.sessionStorage.setItem(storageKey(context), token);
  } catch {
    // Storage unavailable: the guest simply retypes after signing in.
  }
}

export function readDraftToken(context: InquiryContextRef): string | null {
  try {
    return window.sessionStorage.getItem(storageKey(context));
  } catch {
    return null;
  }
}

export function clearDraftToken(context: InquiryContextRef): void {
  try {
    window.sessionStorage.removeItem(storageKey(context));
  } catch {
    // Nothing to clean up if storage never accepted it.
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && pnpm vitest run src/lib/api/inquiries.test.ts src/lib/i18n/inquiry.test.ts src/lib/inquiry/draft-storage.test.ts`
Expected: PASS — 5 + 6 + 4 = **15 tests**.

Run: `cd frontend && pnpm lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib
git commit -m "feat(inquiry): frontend API module, EN/IT/ES dictionary and draft storage"
```

---

### Task 12: `InquiryForm` — the one shared component

**Files:**
- Create: `frontend/src/components/inquiry/InquiryForm.tsx`, `frontend/src/components/inquiry/InquiryForm.test.tsx`

**Interfaces:**
- Consumes: everything Task 11 produced; `useSession()` from `@/lib/auth/session` (Phase 3); `ApiError` from `@/lib/api/client`; `type Locale` from `@/lib/i18n/directory`.
- Produces:
  - `InquiryForm` — default export of `@/components/inquiry/InquiryForm`, props `{ context: InquiryContextRef; config: InquiryConfig; locale: Locale }`

**Note (this is the only inquiry form there will ever be).** Spec §15.1: "do not create broker-, professional- and listing-specific copies." Spec §39: "Do not … Add a separate inquiry form for a new context." The component takes `context` as a prop and knows nothing about professionals specifically; Phases 19 and 20 mount this same file on `/boats/<slug>/` and `/brokers/<slug>/` with a different `context`, and change nothing inside it.

- [ ] **Step 1: Write the failing test**

`frontend/src/components/inquiry/InquiryForm.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import InquiryForm from "@/components/inquiry/InquiryForm";
import { ApiError } from "@/lib/api/client";
import type { InquiryConfig, InquiryContextRef } from "@/lib/api/inquiries";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/services/professionals/phase6-pro/",
}));

const submitInquiry = vi.fn();
const createInquiryDraft = vi.fn();
const resolveInquiryDraft = vi.fn();
vi.mock("@/lib/api/inquiries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/inquiries")>();
  return {
    ...actual,
    submitInquiry: (...args: unknown[]) => submitInquiry(...args),
    createInquiryDraft: (...args: unknown[]) => createInquiryDraft(...args),
    resolveInquiryDraft: (...args: unknown[]) => resolveInquiryDraft(...args),
  };
});

let sessionValue: unknown;
vi.mock("@/lib/auth/session", () => ({
  useSession: () => sessionValue,
}));

const config: InquiryConfig = {
  enabled: true,
  privacy_policy_version: "2026-09",
  honeypot_field: "company_website",
  limits: {
    full_name: { min: 2, max: 120 },
    subject: { min: 3, max: 150 },
    message: { min: 20, max: 4000 },
    phone_max: 32,
  },
};

const context: InquiryContextRef = {
  type: "PROFESSIONAL",
  id: "11111111-1111-4111-8111-111111111111",
  label: "Phase6 Pro",
};

const BODY = "I would like to arrange a viewing next week please.";

function signedIn(overrides: Record<string, unknown> = {}) {
  return {
    loading: false,
    session: {
      authenticated: true,
      user: {
        id: "u1",
        email: "ada@phase6.example",
        full_name: "Ada Rossi",
        primary_role: "BUYER",
        locale: "EN",
        email_verified: true,
        is_active: true,
        ...overrides,
      },
    },
  };
}

function guest() {
  return { loading: false, session: { authenticated: false, user: null } };
}

function renderForm() {
  return render(<InquiryForm context={context} config={config} locale="en" />);
}

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  sessionValue = guest();
});

describe("InquiryForm", () => {
  it("renders every field spec 15.1 requires", () => {
    sessionValue = signedIn();
    renderForm();

    expect(screen.getByLabelText("Full name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Phone (optional)")).toBeInTheDocument();
    expect(screen.getByLabelText("Subject")).toBeInTheDocument();
    expect(screen.getByLabelText("Message")).toBeInTheDocument();
    expect(
      screen.getByLabelText("I accept the privacy policy (version 2026-09)."),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Send me occasional updates from NAUTA."),
    ).toBeInTheDocument();
  });

  it("prefills name and email from the profile and makes email read-only", () => {
    sessionValue = signedIn();
    renderForm();

    expect(screen.getByLabelText("Full name")).toHaveValue("Ada Rossi");
    const email = screen.getByLabelText("Email");
    expect(email).toHaveValue("ada@phase6.example");
    expect(email).toHaveAttribute("readonly");
    // Text, not a link: there is no /account/ page yet and a 404 would be worse
    // than an explanation. See the component comment and Known Limitation 15.
    expect(
      screen.getByText(
        "Messages are sent from your account email. Change it in your account settings.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /account/i })).toBeNull();
  });

  it("derives the default subject from the context and lets it be edited", async () => {
    sessionValue = signedIn();
    renderForm();
    const subject = screen.getByLabelText("Subject");
    expect(subject).toHaveValue("Question about Phase6 Pro");

    await userEvent.clear(subject);
    await userEvent.type(subject, "Mooring");
    expect(subject).toHaveValue("Mooring");
  });

  it("leaves marketing consent unchecked and privacy consent unchecked", () => {
    sessionValue = signedIn();
    renderForm();
    expect(
      screen.getByLabelText("Send me occasional updates from NAUTA."),
    ).not.toBeChecked();
    expect(
      screen.getByLabelText("I accept the privacy policy (version 2026-09)."),
    ).not.toBeChecked();
  });

  it("renders the honeypot hidden from people and from assistive technology", () => {
    sessionValue = signedIn();
    const { container } = renderForm();
    const honeypot = container.querySelector<HTMLInputElement>(
      'input[name="company_website"]',
    );

    expect(honeypot).not.toBeNull();
    expect(honeypot).toHaveAttribute("tabindex", "-1");
    expect(honeypot).toHaveAttribute("autocomplete", "off");
    expect(honeypot!.parentElement).toHaveAttribute("aria-hidden", "true");
    expect(honeypot).toHaveValue("");
  });

  it("sends a valid inquiry and shows the confirmation", async () => {
    sessionValue = signedIn();
    submitInquiry.mockResolvedValue({
      conversation_id: "c1",
      message_id: "m1",
      contact_access: "GRANTED",
      next_url: "/dashboard/messages/c1/",
    });
    renderForm();

    await userEvent.type(screen.getByLabelText("Message"), BODY);
    await userEvent.click(
      screen.getByLabelText("I accept the privacy policy (version 2026-09)."),
    );
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => expect(submitInquiry).toHaveBeenCalledTimes(1));
    expect(submitInquiry).toHaveBeenCalledWith({
      context_type: "PROFESSIONAL",
      context_id: context.id,
      full_name: "Ada Rossi",
      email: "ada@phase6.example",
      phone: "",
      subject: "Question about Phase6 Pro",
      message: BODY,
      privacy_policy_version: "2026-09",
      privacy_consent: true,
      marketing_consent: false,
      company_website: "",
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Your message has been sent.",
    );
  });

  it("does not navigate away after sending, because the inbox page does not exist yet", async () => {
    sessionValue = signedIn();
    submitInquiry.mockResolvedValue({
      conversation_id: "c1",
      message_id: "m1",
      contact_access: "GRANTED",
      next_url: "/dashboard/messages/c1/",
    });
    renderForm();

    await userEvent.type(screen.getByLabelText("Message"), BODY);
    await userEvent.click(
      screen.getByLabelText("I accept the privacy policy (version 2026-09)."),
    );
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));

    await screen.findByRole("status");
    expect(push).not.toHaveBeenCalled();
  });

  it("will not send without privacy consent", async () => {
    sessionValue = signedIn();
    renderForm();

    await userEvent.type(screen.getByLabelText("Message"), BODY);
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(submitInquiry).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Accept the privacy policy to send your message.",
    );
  });

  it("tells an unverified account to verify first and sends nothing", async () => {
    sessionValue = signedIn({ email_verified: false });
    renderForm();

    await userEvent.type(screen.getByLabelText("Message"), BODY);
    await userEvent.click(
      screen.getByLabelText("I accept the privacy policy (version 2026-09)."),
    );
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(submitInquiry).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Verify your email address before sending a message.",
    );
  });

  it("saves a guest's draft and sends them to sign in with a local next URL", async () => {
    createInquiryDraft.mockResolvedValue({ draft_token: "tok", expires_in: 1800 });
    renderForm();

    await userEvent.type(screen.getByLabelText("Full name"), "Ada Rossi");
    await userEvent.type(screen.getByLabelText("Message"), BODY);
    await userEvent.click(screen.getByRole("button", { name: "Sign in to send" }));

    await waitFor(() => expect(createInquiryDraft).toHaveBeenCalledTimes(1));
    expect(createInquiryDraft).toHaveBeenCalledWith({
      context_type: "PROFESSIONAL",
      context_id: context.id,
      full_name: "Ada Rossi",
      phone: "",
      subject: "Question about Phase6 Pro",
      message: BODY,
    });
    expect(submitInquiry).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith(
      "/login/?next=%2Fservices%2Fprofessionals%2Fphase6-pro%2F",
    );
    expect(
      window.sessionStorage.getItem(`nauta.inquiry-draft:PROFESSIONAL:${context.id}`),
    ).toBe("tok");
  });

  it("does not ask a guest for consent before they have even signed in", () => {
    renderForm();
    // The consent checkbox is still shown (spec 15.1 lists it), but the guest's
    // button is the sign-in one - consent is given by the person who actually
    // sends, after they return (spec 15.2).
    expect(screen.getByRole("button", { name: "Sign in to send" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send message" })).toBeNull();
  });

  it("restores a saved draft after sign-in and waits for a real Send", async () => {
    window.sessionStorage.setItem(
      `nauta.inquiry-draft:PROFESSIONAL:${context.id}`,
      "tok",
    );
    resolveInquiryDraft.mockResolvedValue({
      context_type: "PROFESSIONAL",
      context_id: context.id,
      full_name: "Ada Rossi",
      phone: "+390000000000",
      subject: "Mooring question",
      message: BODY,
    });
    sessionValue = signedIn();
    renderForm();

    await waitFor(() =>
      expect(screen.getByLabelText("Message")).toHaveValue(BODY),
    );
    expect(screen.getByLabelText("Subject")).toHaveValue("Mooring question");
    expect(screen.getByLabelText("Phone (optional)")).toHaveValue("+390000000000");
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Your message was saved. Check it and press Send.",
    );
    // Spec 15.2, verbatim: "Do not send an inquiry automatically after login."
    expect(submitInquiry).not.toHaveBeenCalled();
    expect(
      window.sessionStorage.getItem(`nauta.inquiry-draft:PROFESSIONAL:${context.id}`),
    ).toBeNull();
  });

  it("maps a backend error code onto localized copy", async () => {
    sessionValue = signedIn();
    submitInquiry.mockRejectedValue(
      new ApiError(429, "rate_limited", "raw backend text"),
    );
    renderForm();

    await userEvent.type(screen.getByLabelText("Message"), BODY);
    await userEvent.click(
      screen.getByLabelText("I accept the privacy policy (version 2026-09)."),
    );
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You are sending messages too quickly. Please try again shortly.",
    );
  });

  it("shows field errors from a validation_error envelope", async () => {
    sessionValue = signedIn();
    submitInquiry.mockRejectedValue(
      new ApiError(400, "validation_error", "invalid", {
        message: ["Ensure this field has at least 20 characters."],
      }),
    );
    renderForm();

    await userEvent.type(screen.getByLabelText("Message"), BODY);
    await userEvent.click(
      screen.getByLabelText("I accept the privacy policy (version 2026-09)."),
    );
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Ensure this field has at least 20 characters.",
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && pnpm vitest run src/components/inquiry/InquiryForm.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/inquiry/InquiryForm"`.

- [ ] **Step 3: Write `frontend/src/components/inquiry/InquiryForm.tsx`**

```tsx
"use client";

// THE shared inquiry form (spec 15.1: "Component name should be equivalent to
// InquiryForm; do not create broker-, professional- and listing-specific
// copies"). It is context-agnostic on purpose: Phases 19 and 20 mount this same
// file on /boats/<slug>/ and /brokers/<slug>/ with a different `context` prop.
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ApiError } from "@/lib/api/client";
import {
  createInquiryDraft,
  resolveInquiryDraft,
  submitInquiry,
  type InquiryConfig,
  type InquiryContextRef,
} from "@/lib/api/inquiries";
import {
  clearDraftToken,
  readDraftToken,
  storeDraftToken,
} from "@/lib/inquiry/draft-storage";
import { formatInquiryMessage, tInquiry } from "@/lib/i18n/inquiry";
import type { Locale } from "@/lib/i18n/directory";
import { useSession } from "@/lib/auth/session";

interface InquiryFormProps {
  context: InquiryContextRef;
  config: InquiryConfig;
  locale: Locale;
}

/** Backend error code -> message key. Every code this phase can return has an
 *  entry; anything unrecognised falls back to the generic message rather than
 *  printing the backend's own English at a person (spec 37). */
const ERROR_MESSAGE_KEYS: Record<string, string> = {
  rate_limited: "inquiry.error.rate_limited",
  recipient_unavailable: "inquiry.error.recipient_unavailable",
  consent_required: "inquiry.error.consent_required",
  self_inquiry_not_allowed: "inquiry.error.self_inquiry",
  feature_disabled: "inquiry.error.feature_disabled",
  email_verification_required: "inquiry.verify_email_first",
  draft_expired: "inquiry.error.draft_expired",
  invalid_draft: "inquiry.error.draft_expired",
  validation_error: "inquiry.error.validation",
};

const FIELD_CLASS =
  "mt-space-xs w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-space-sm font-body-md";

export default function InquiryForm({ context, config, locale }: InquiryFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, loading } = useSession();

  const user = session?.user ?? null;
  const isSignedIn = Boolean(session?.authenticated && user);
  const isVerified = Boolean(user?.email_verified);

  // `context` arrives as an object literal from the page (Task 13), so it is a
  // NEW object on every render. Depending on it directly would make the restore
  // effect's dependency array change every render - which eslint's
  // react-hooks/exhaustive-deps correctly flags, and which would re-run the
  // effect forever but for the `restored` ref guard. Memoising on the three
  // primitives gives a genuinely stable reference, so the guard is a belt and
  // the deps are honest.
  const contextRef = useMemo(
    () => ({ type: context.type, id: context.id, label: context.label }),
    [context.type, context.id, context.label],
  );

  const defaultSubject = formatInquiryMessage(
    tInquiry(locale, "inquiry.subject_default"),
    { context: contextRef.label },
  );

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState("");
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Declared BEFORE the effects that call it. A `const` is in the temporal dead
  // zone until its initialiser runs, and although an effect body executes after
  // render (so this would work at runtime), eslint's no-use-before-define and
  // exhaustive-deps both object - and `pnpm lint` is a gate on this task.
  const messageFor = useCallback(
    (caught: unknown): string => {
      if (caught instanceof ApiError) {
        const fieldMessages = Object.values(caught.fields).flat();
        if (caught.code === "validation_error" && fieldMessages.length > 0) {
          return fieldMessages.join(" ");
        }
        const key = ERROR_MESSAGE_KEYS[caught.code];
        if (key) return tInquiry(locale, key);
      }
      return tInquiry(locale, "inquiry.error.generic");
    },
    [locale],
  );

  // Prefill the name from the profile once the session resolves, without
  // clobbering something the person has already typed (spec 15.1: "prefilled
  // from profile", not "locked to profile").
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || !user) return;
    prefilled.current = true;
    setFullName((current) => current || user.full_name);
  }, [user]);

  // Spec 15.2's return half: restore the saved draft once, after the person is
  // signed in and verified. It never sends - it fills the form and asks.
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || loading || !isSignedIn || !isVerified) return;
    const token = readDraftToken(contextRef);
    if (!token) return;
    restored.current = true;
    void (async () => {
      try {
        const draft = await resolveInquiryDraft(token);
        setFullName((current) => draft.full_name || current);
        setPhone(draft.phone);
        setSubject(draft.subject || defaultSubject);
        setMessage(draft.message);
        setNotice(tInquiry(locale, "inquiry.draft_restored"));
      } catch (caught) {
        setError(messageFor(caught));
      } finally {
        clearDraftToken(contextRef);
      }
    })();
  }, [
    contextRef,
    defaultSubject,
    isSignedIn,
    isVerified,
    loading,
    locale,
    messageFor,
  ]);

  async function handleGuestSubmit() {
    setBusy(true);
    setError(null);
    try {
      const { draft_token } = await createInquiryDraft({
        context_type: contextRef.type,
        context_id: contextRef.id,
        full_name: fullName,
        phone,
        subject,
        message,
      });
      storeDraftToken(contextRef, draft_token);
    } catch (caught) {
      // A draft that could not be saved is not a reason to block sign-in; the
      // person retypes. Surfacing the failure would be noise at the exact
      // moment they are being sent elsewhere.
      void caught;
    } finally {
      setBusy(false);
    }
    // `pathname` is this app's own route, so it is always a single-slash local
    // path - exactly what lib/auth/next-url.ts's allowlist accepts (spec 33.1:
    // "Allowlist local return URLs; prevent open redirects").
    router.push(`/login/?next=${encodeURIComponent(pathname)}`);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setError(null);

    if (!isSignedIn) {
      await handleGuestSubmit();
      return;
    }
    if (!isVerified) {
      setError(tInquiry(locale, "inquiry.verify_email_first"));
      return;
    }
    if (!privacyConsent) {
      setError(tInquiry(locale, "inquiry.error.consent_required"));
      return;
    }

    setBusy(true);
    try {
      await submitInquiry({
        context_type: contextRef.type,
        context_id: contextRef.id,
        full_name: fullName,
        email: user!.email,
        phone,
        subject,
        message,
        privacy_policy_version: config.privacy_policy_version,
        privacy_consent: privacyConsent,
        marketing_consent: marketingConsent,
        company_website: honeypot,
      });
      // Spec 15.5 returns next_url, and this form deliberately does NOT follow
      // it: the conversation page is Phase 19/20's and does not exist yet, so
      // navigating there would replace a success with a 404. See the plan's
      // ruling and Known Limitations.
      setSent(true);
      setMessage("");
      setPrivacyConsent(false);
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setBusy(false);
    }
  }

  const consentLabel = formatInquiryMessage(
    tInquiry(locale, "inquiry.privacy_consent"),
    { version: config.privacy_policy_version },
  );

  return (
    <section aria-labelledby="inquiry-heading" className="mt-space-xl">
      <h2
        id="inquiry-heading"
        className="font-title-lg text-title-lg text-primary"
      >
        {tInquiry(locale, "inquiry.heading")}
      </h2>

      <form onSubmit={handleSubmit} className="mt-space-md space-y-space-md" noValidate>
        <label className="block font-label-md text-label-md" htmlFor="inquiry-full-name">
          {tInquiry(locale, "inquiry.full_name")}
          <input
            id="inquiry-full-name"
            name="full_name"
            autoComplete="name"
            minLength={config.limits.full_name.min}
            maxLength={config.limits.full_name.max}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className={FIELD_CLASS}
          />
        </label>

        <label className="block font-label-md text-label-md" htmlFor="inquiry-email">
          {tInquiry(locale, "inquiry.email")}
          <input
            id="inquiry-email"
            name="email"
            type="email"
            readOnly
            value={user?.email ?? ""}
            className={`${FIELD_CLASS} bg-surface-container`}
          />
        </label>
        {/* Spec 15.1 asks for an "Update in account" affordance beside the
            read-only email. There is no /account/ PAGE yet - frontend/src/app
            holds only 403, health, login, professionals, services and
            verify-email - and linking to a 404 would be worse than explaining
            the rule in place, so this is text until Phase 16 or 20 builds the
            account screen. Recorded in Known Limitations. `GET|PATCH
            /api/v1/account/` (Phase 3) already exists behind it. */}
        <p className="font-body-sm text-on-surface-variant">
          {tInquiry(locale, "inquiry.email_hint")}
        </p>

        <label className="block font-label-md text-label-md" htmlFor="inquiry-phone">
          {tInquiry(locale, "inquiry.phone")}
          <input
            id="inquiry-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            maxLength={config.limits.phone_max}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            aria-describedby="inquiry-phone-hint"
            className={FIELD_CLASS}
          />
        </label>
        <p id="inquiry-phone-hint" className="font-body-sm text-on-surface-variant">
          {tInquiry(locale, "inquiry.phone_hint")}
        </p>

        <label className="block font-label-md text-label-md" htmlFor="inquiry-subject">
          {tInquiry(locale, "inquiry.subject")}
          <input
            id="inquiry-subject"
            name="subject"
            minLength={config.limits.subject.min}
            maxLength={config.limits.subject.max}
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className={FIELD_CLASS}
          />
        </label>

        <label className="block font-label-md text-label-md" htmlFor="inquiry-message">
          {tInquiry(locale, "inquiry.message")}
          <textarea
            id="inquiry-message"
            name="message"
            rows={6}
            minLength={config.limits.message.min}
            maxLength={config.limits.message.max}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className={FIELD_CLASS}
          />
        </label>

        {/* Spec 15.1's honeypot. Off-screen rather than display:none, because
            some bots skip hidden inputs; aria-hidden and tabIndex -1 keep it
            away from keyboard and screen-reader users entirely. */}
        <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="inquiry-company-website">Company website</label>
          <input
            id="inquiry-company-website"
            name={config.honeypot_field}
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(event) => setHoneypot(event.target.value)}
          />
        </div>

        <label className="flex items-start gap-space-xs font-body-sm" htmlFor="inquiry-privacy">
          <input
            id="inquiry-privacy"
            name="privacy_consent"
            type="checkbox"
            checked={privacyConsent}
            onChange={(event) => setPrivacyConsent(event.target.checked)}
          />
          {consentLabel}
        </label>

        <label className="flex items-start gap-space-xs font-body-sm" htmlFor="inquiry-marketing">
          <input
            id="inquiry-marketing"
            name="marketing_consent"
            type="checkbox"
            checked={marketingConsent}
            onChange={(event) => setMarketingConsent(event.target.checked)}
          />
          {tInquiry(locale, "inquiry.marketing_consent")}
        </label>

        {error ? (
          <p role="alert" className="font-body-sm text-error">
            {error}
          </p>
        ) : null}
        {sent || notice ? (
          <p role="status" className="font-body-sm text-primary">
            {sent ? tInquiry(locale, "inquiry.sent") : notice}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy || loading}
          className="w-full rounded-lg bg-primary p-space-sm font-label-md text-label-md text-on-primary disabled:opacity-50"
        >
          {busy
            ? tInquiry(locale, "inquiry.sending")
            : isSignedIn
              ? tInquiry(locale, "inquiry.send")
              : tInquiry(locale, "inquiry.sign_in_to_send")}
        </button>
      </form>
    </section>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && pnpm vitest run src/components/inquiry/InquiryForm.test.tsx`
Expected: PASS — **14 tests**.

Run: `cd frontend && pnpm lint && pnpm test`
Expected: no lint errors; the whole suite green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/inquiry
git commit -m "feat(inquiry): the one shared InquiryForm component with the spec 15.2 guest flow"
```

---

### Task 13: Mount the form at Phase 5's `PHASE 6 SEAM`

**Files:**
- Modify: `frontend/src/app/services/professionals/[slug]/page.tsx`

**Interfaces:**
- Consumes: `InquiryForm` (Task 12), `fetchInquiryConfig` (Task 11), `ProfessionalDetail.id` and `display_name` from `@/lib/api/directory` (Phase 5).
- Produces: nothing importable. This is the phase's one UI integration point.

**Note (this is the only page that can mount it today, and that is a scope ruling, not an oversight).** `frontend/src/app/` contains `403`, `health`, `login`, `verify-email`, `page.tsx`, `sitemap.ts`, `professionals/profile/` (a redirect route) and the three `services/` routes. There is **no** `/boats/`, `/brokers/` or `/dashboard/` route to mount on — Phase 11 was backend-only and Phases 19/20 own those pages. Phase 5's contract rule 2 reserved exactly this position for exactly this component. See the plan's ruling and Known Limitations.

- [ ] **Step 1: Establish the failing state at the HTTP level**

There is no Vitest harness for an async server component in this repository (Phase 5 drove its three `page.tsx` deliverables the same way), so the red-to-green check is a real request against a real dev server.

Start the backend and the frontend in two terminals:

```bash
cd backend && uv run python manage.py runserver 8020
```

```bash
cd frontend && pnpm dev --port 3020
```

Seed one ACTIVE professional to look at (a shell one-liner, not a fixture — nothing is committed):

```bash
cd backend && uv run python manage.py shell -c "
from accounts.tests.factories import make_user
from professionals.tests.factories import make_professional
owner = make_user(email='seam-owner@phase6.example')
make_professional(owner, display_name='Seam Surveyors', slug='seam-surveyors')
print('ok')
"
```

Run: `curl -s http://127.0.0.1:3020/services/professionals/seam-surveyors/ | grep -c "inquiry-heading"`
Expected: **`0`** — the seam is still a comment.

- [ ] **Step 2: Replace the seam comment with the mount**

In `frontend/src/app/services/professionals/[slug]/page.tsx`:

Add two imports beside the existing ones:

```tsx
import InquiryForm from "@/components/inquiry/InquiryForm";
import { fetchInquiryConfig } from "@/lib/api/inquiries";
```

Fetch the config alongside the professional, inside `ProfessionalDetailPage`, immediately after the existing `const professional = await fetchProfessional(slug, locale);` / `notFound()` block:

```tsx
  // Spec 35.1: the flag gates frontend exposure as well as the API. One round
  // trip answers both "is messaging on?" and "what limits does the form
  // enforce?" - so no number in the form is a second copy of a server rule
  // (spec 2.1, 2.2). A null config means the API is unreachable: the page still
  // renders, without the form, rather than 500ing.
  const inquiryConfig = await fetchInquiryConfig();
```

Then replace the whole `{/* PHASE 6 SEAM … */}` comment block — the one that ends with `spec 39 prohibits. */}` — with:

```tsx
          {inquiryConfig?.enabled ? (
            <InquiryForm
              context={{
                type: "PROFESSIONAL",
                id: professional.id,
                label: professional.display_name,
              }}
              config={inquiryConfig}
              locale={locale}
            />
          ) : null}
```

**Leave the `PHASE 7 SEAM` comment in the `<aside>` exactly as it is.** It belongs to the phase being planned in parallel.

- [ ] **Step 3: Verify green at the HTTP level**

Run: `curl -s http://127.0.0.1:3020/services/professionals/seam-surveyors/ | grep -c "inquiry-heading"`
Expected: **`1`**.

Run: `curl -s http://127.0.0.1:3020/services/professionals/seam-surveyors/ | grep -c "PHASE 7 SEAM"`
Expected: **`0`** — a JSX comment is never emitted to HTML; this only confirms the page still renders. Re-read the source to confirm the Phase 7 comment is still in the file:

Run: `grep -c "PHASE 7 SEAM" "frontend/src/app/services/professionals/[slug]/page.tsx"`
(the quotes are required: unquoted, the shell treats `[slug]` as a character class and the path matches nothing)
Expected: **`1`**.

Confirm the flag gate really hides it — turn the flag off, reload, turn it back on:

```bash
cd backend && uv run python manage.py shell -c "
from platform_settings.services import set_feature_flag
set_feature_flag(key='unified_inquiries', is_enabled=False, actor=None, description='Manual seam check.')
"
```

Run: `curl -s http://127.0.0.1:3020/services/professionals/seam-surveyors/ | grep -c "inquiry-heading"`
Expected: **`0`**.

```bash
cd backend && uv run python manage.py shell -c "
from platform_settings.services import set_feature_flag
set_feature_flag(key='unified_inquiries', is_enabled=True, actor=None, description='Spec 35.1 rollout flag for the shared inquiry form.')
"
```

Run: `curl -s http://127.0.0.1:3020/services/professionals/seam-surveyors/ | grep -c "inquiry-heading"`
Expected: **`1`**.

Finally, confirm no contact value reached the DOM — Phase 5's contract rule 1 and spec §16's first acceptance test:

Run: `curl -s http://127.0.0.1:3020/services/professionals/seam-surveyors/ | grep -c "hello@marine-survey.example\|+39055000000"`
Expected: **`0`**.

- [ ] **Step 4: Build and lint**

Run: `cd frontend && pnpm lint && pnpm test && pnpm build`
Expected: no lint errors, the whole Vitest suite green, a successful production build.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/services/professionals
git commit -m "feat(inquiry): mount the shared InquiryForm at the professional detail seam"
```

---

### Task 14: Phase acceptance tests and full regression

**Files:**
- Create: `backend/messaging/tests/test_phase_6_acceptance.py`, `backend/messaging/tests/test_concurrency.py`

**Interfaces:**
- Consumes: everything Tasks 1–13 produced. Adds no production code.
- Produces: the evidence spec §39 step 9 requires ("Demonstrate the phase definition of done with verifiable test output").

**Note (ruling — the transactional test lives in its own module, and nothing else in the plan depends on it being harmless).**
Spec §34.2 requires a real concurrency test against PostgreSQL, which means `@pytest.mark.django_db(transaction=True)`. That marker gives the test `TransactionTestCase` semantics, and its teardown is a **`flush`**: every table is truncated and `post_migrate` is re-emitted. `post_migrate` restores content types and permissions; it does **not** restore rows a `RunPython` data migration inserted — in this repository that means the `unified_inquiries` `FeatureFlag` (messaging/0002), the `staff_moderator`/`staff_admin` `Group`s (accounts/0003), the twelve `PlatformSetting` rows (platform_settings/0002), the six SEO `ServiceCategory` rows (services_catalog/0002) and the seeded `FinanceConfigurationVersion` (finance/0002).

The evidence already in the repository points both ways, which is precisely why this plan does not bet on one reading:
- **Against the hazard biting here:** `listings/tests/test_auto_approval.py:271` and `:301`, `listings/tests/test_publication.py:206`, and `taxonomy/tests/test_boat_model_model.py:54` and `:81` all carry the marker today — and `platform_settings/tests/test_admin.py:24`, which collects *after* `listings` in alphabetical order and does a bare `PlatformSetting.objects.get(key="individual.free_listing_count")` against a migration-seeded row, is green in CI.
- **For it:** `brokers/tests/test_admin.py:35` writes `Group.objects.get_or_create(name=StaffGroup.MODERATOR)` where every other call site in the repository writes `Group.objects.get(...)`. Somebody adopted a defensive spelling there for a reason.

So the plan makes the messaging suite **immune either way** instead of arguing the internals: Task 2's `messaging/tests/conftest.py` carries an autouse fixture that `update_or_create`s the flag and `get_or_create`s both groups before every test in the package, and the transactional test sits alone in `test_concurrency.py` where a reviewer can see it. Step 4 below then *measures* the answer, and Step 5's commit message records which mechanism turned out to be needed.

**If Step 4's ordering experiment fails**, the fallback ladder is, in order: (1) add `serialized_rollback=True` to the marker and set `DATABASES["default"]["TEST"]["SERIALIZE"] = True` in `backend/config/settings/test.py` — a settings edit, so call it out in the PR body (it is permitted: the standing prohibition on touching `test.py` is specifically about downgrading `DATABASES`/`CACHES` to SQLite/LocMemCache, which this does not do); (2) give the affected app's own `tests/conftest.py` the same re-seeding fixture this plan gives `messaging`; (3) only as a last resort, drop the two-thread test and prove §34.2 from Task 3's `IntegrityError`-under-`transaction.atomic()` assertions plus Task 6's double-call test, recording the reduced coverage as a Known Limitation. Do not reach for (3) before trying (1) and (2).

- [ ] **Step 1: Write the failing test**

`backend/messaging/tests/test_phase_6_acceptance.py`:

```python
"""Spec 15's definition of done, spec 40 Scenarios A and B, and the four spec 16
acceptance tests that concern the WRITE side.

Everything here goes through the real HTTP API, not the service layer. Spec
34.2's two-thread concurrency requirement lives in its own module,
test_concurrency.py - see the note in this task for why it may not share a file.
"""

import pytest
from django.core import mail
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.tests.factories import make_user
from brokers.enums import BrokerMembershipRole
from brokers.tests.factories import make_broker, make_membership
from common.throttling import HashedIPScopedRateThrottle
from listings.enums import ListingStatus
from listings.tests.factories import make_broker_listing, make_snapshot
from messaging.enums import CURRENT_PRIVACY_POLICY_VERSION, ContactTargetType
from messaging.models import ContactAccessGrant, Conversation, Message
from notifications.models import Notification
from professionals.tests.factories import make_professional

pytestmark = pytest.mark.django_db

BODY = "I would like to arrange a viewing next week, if that suits you."


def _payload(context_type, context_id, email, **overrides):
    payload = {
        "context_type": context_type,
        "context_id": str(context_id),
        "full_name": "Ada Rossi",
        "email": email,
        "phone": "+390000000000",
        "subject": "Question about the survey",
        "message": BODY,
        "privacy_policy_version": CURRENT_PRIVACY_POLICY_VERSION,
        "privacy_consent": True,
        "marketing_consent": False,
        "company_website": "",
    }
    payload.update(overrides)
    return payload


def test_scenario_a_unified_professional_inquiry_and_contact_unlock(
    django_capture_on_commit_callbacks,
):
    """Spec 40 Scenario A, through the API.

    "one conversation/message is committed, P is notified, one access grant is
    created" - the refetch half ("returns P's configured public business
    email/phone only to that user") is Phase 7's endpoint and is deliberately
    NOT asserted here; what is asserted is that the grant Phase 7 will read
    exists and is scoped to this viewer and this target.
    """
    asker = make_user(email="acc-asker@phase6.example")
    owner = make_user(email="acc-pro-owner@phase6.example")
    professional = make_professional(
        owner,
        display_name="Phase6 Acceptance Pro",
        slug="phase6-acceptance-pro",
        public_email="office@phase6-acc.example",
    )
    api = APIClient()
    api.force_authenticate(asker)
    mail.outbox.clear()

    with django_capture_on_commit_callbacks(execute=True):
        response = api.post(
            reverse("inquiry-create"),
            _payload("PROFESSIONAL", professional.pk, asker.email),
            format="json",
        )

    assert response.status_code == 201
    assert Conversation.objects.count() == 1
    assert Message.objects.count() == 1
    assert Notification.objects.get().recipient_id == owner.pk
    assert [sent.to for sent in mail.outbox] == [["office@phase6-acc.example"]]

    grant = ContactAccessGrant.objects.get()
    assert (grant.viewer_id, grant.target_type, grant.professional_id) == (
        asker.pk,
        ContactTargetType.PROFESSIONAL,
        professional.pk,
    )
    assert response.data["contact_access"] == "GRANTED"


def test_scenario_b_a_failed_submission_leaves_nothing_and_leaks_nothing():
    """Spec 40 Scenario B: "no message, notification or grant exists and raw
    contact data is absent from the response"."""
    asker = make_user(email="acc-asker2@phase6.example")
    owner = make_user(email="acc-pro-owner2@phase6.example")
    professional = make_professional(
        owner,
        display_name="Phase6 Acceptance Pro II",
        slug="phase6-acceptance-pro-ii",
        public_email="office2@phase6-acc.example",
        public_phone="+34900111222",
    )
    api = APIClient()
    api.force_authenticate(asker)

    response = api.post(
        reverse("inquiry-create"),
        _payload("PROFESSIONAL", professional.pk, asker.email, privacy_consent=False),
        format="json",
    )

    assert response.status_code == 400
    assert Message.objects.count() == 0
    assert Notification.objects.count() == 0
    assert ContactAccessGrant.objects.count() == 0
    rendered = response.content.decode()
    assert "office2@phase6-acc.example" not in rendered
    assert "+34900111222" not in rendered


def test_a_rate_limited_message_does_not_unlock_contact(monkeypatch):
    """Spec 16: "A failed or rate-limited message does not unlock contact"."""
    monkeypatch.setitem(
        HashedIPScopedRateThrottle.THROTTLE_RATES, "inquiry_submit", "0/min"
    )
    asker = make_user(email="acc-asker3@phase6.example")
    owner = make_user(email="acc-pro-owner3@phase6.example")
    professional = make_professional(
        owner, display_name="Phase6 Acc III", slug="phase6-acc-iii"
    )
    api = APIClient()
    api.force_authenticate(asker)

    response = api.post(
        reverse("inquiry-create"),
        _payload("PROFESSIONAL", professional.pk, asker.email),
        format="json",
    )

    assert response.status_code == 429
    assert ContactAccessGrant.objects.count() == 0


def test_sending_to_broker_a_does_not_unlock_broker_b():
    """Spec 16's second acceptance test."""
    asker = make_user(email="acc-asker4@phase6.example")
    broker_a = make_broker(name="Phase6 Acc A", slug="phase6-acc-a")
    broker_b = make_broker(name="Phase6 Acc B", slug="phase6-acc-b")
    api = APIClient()
    api.force_authenticate(asker)

    api.post(
        reverse("inquiry-create"),
        _payload("BROKER", broker_a.pk, asker.email),
        format="json",
    )

    assert ContactAccessGrant.objects.filter(viewer=asker, broker=broker_a).count() == 1
    assert ContactAccessGrant.objects.filter(viewer=asker, broker=broker_b).count() == 0


def test_definition_of_done_one_service_handles_every_context(
    django_capture_on_commit_callbacks,
):
    """Spec 15's definition of done, item 3: "One backend service handles all
    types." Three contexts, one endpoint, one service, three correct inboxes."""
    asker = make_user(email="acc-asker5@phase6.example")
    api = APIClient()
    api.force_authenticate(asker)

    pro_owner = make_user(email="acc-pro5@phase6.example")
    professional = make_professional(
        pro_owner, display_name="Phase6 Acc V", slug="phase6-acc-v"
    )
    broker = make_broker(name="Phase6 Acc Fleet", slug="phase6-acc-fleet")
    reader = make_user(email="acc-reader5@phase6.example")
    make_membership(
        reader, broker, role=BrokerMembershipRole.MANAGER, can_read_messages=True
    )
    listing = make_broker_listing(broker=broker, actor=reader)
    snapshot = make_snapshot(
        listing, approved_by=make_user(email="acc-approver5@phase6.example")
    )
    listing.status = ListingStatus.PUBLISHED
    listing.current_public_snapshot = snapshot
    listing.save(update_fields=["status", "current_public_snapshot", "updated_at"])

    with django_capture_on_commit_callbacks(execute=True):
        for context_type, context_id in (
            ("PROFESSIONAL", professional.pk),
            ("BROKER", broker.pk),
            ("LISTING", listing.pk),
        ):
            response = api.post(
                reverse("inquiry-create"),
                _payload(
                    context_type,
                    context_id,
                    asker.email,
                    message=f"A distinct question about {context_type.lower()} context.",
                ),
                format="json",
            )
            assert response.status_code == 201, (context_type, response.data)

    assert Conversation.objects.filter(initiator=asker).count() == 3

    # Spec 15's definition of done, item 4: "Messages appear in the correct
    # recipient inbox and sender conversation list."
    api.force_authenticate(asker)
    assert api.get(reverse("conversation-list")).data["count"] == 3

    api.force_authenticate(pro_owner)
    pro_rows = api.get(reverse("conversation-list")).data["results"]
    assert [row["context"]["id"] for row in pro_rows] == [str(professional.pk)]

    api.force_authenticate(reader)
    broker_rows = api.get(reverse("conversation-list")).data["results"]
    assert {row["conversation_type"] for row in broker_rows} == {
        "BROKER_INQUIRY",
        "LISTING_INQUIRY",
    }


def test_definition_of_done_the_email_cannot_be_forged():
    """Spec 15's definition of done, item 2."""
    asker = make_user(email="acc-asker6@phase6.example")
    owner = make_user(email="acc-pro6@phase6.example")
    professional = make_professional(
        owner, display_name="Phase6 Acc VI", slug="phase6-acc-vi"
    )
    api = APIClient()
    api.force_authenticate(asker)

    response = api.post(
        reverse("inquiry-create"),
        _payload("PROFESSIONAL", professional.pk, "victim@phase6.example"),
        format="json",
    )
    assert response.status_code == 400
    assert Message.objects.count() == 0
```


Then create `backend/messaging/tests/test_concurrency.py` — the one module in this phase that carries `transaction=True`:

```python
"""Spec 34.2's database/concurrency requirement, against real PostgreSQL.

ONE module, ONE test, on purpose. `@pytest.mark.django_db(transaction=True)`
ends in a `flush` that truncates every table and does not restore rows inserted
by RunPython data migrations, so a transactional test is a global event in a
pytest session, not a local one. Keeping it alone makes that visible, and
messaging/tests/conftest.py's autouse fixture re-seeds this package's reference
rows before every test so nothing here is load-bearing on a migration seed.
"""

import threading

import pytest
from django.db import connection

from accounts.tests.factories import make_user
from messaging.enums import CURRENT_PRIVACY_POLICY_VERSION
from messaging.models import ContactAccessGrant, Conversation, Message
from messaging.services import submit_inquiry
from professionals.tests.factories import make_professional


@pytest.mark.django_db(transaction=True)
def test_concurrent_duplicate_submissions_create_exactly_one_grant():
    """Spec 16: "A successful transaction creates exactly one grant despite
    concurrent duplicate requests."

    Two threads, two connections. Whichever loses the race on either partial
    unique index recovers through the savepoint in
    _get_or_create_open_conversation / grant_contact_access rather than failing,
    so BOTH submissions succeed and land in the same thread - which is the
    correct behaviour for a message. What must NOT happen is two conversations
    or two active grants.
    """
    asker = make_user(email="race-asker@phase6.example")
    owner = make_user(email="race-owner@phase6.example")
    professional = make_professional(
        owner, display_name="Phase6 Race Pro", slug="phase6-race-pro"
    )
    outcomes: list[str] = []

    def attempt(body):
        try:
            submit_inquiry(
                actor=asker,
                context_type="PROFESSIONAL",
                context_id=professional.pk,
                full_name="Ada Rossi",
                phone="",
                subject="Race",
                body=body,
                privacy_policy_version=CURRENT_PRIVACY_POLICY_VERSION,
            )
            outcomes.append("ok")
        except Exception as exc:  # noqa: BLE001 - recorded, then asserted on
            outcomes.append(type(exc).__name__)
        finally:
            connection.close()

    threads = [
        threading.Thread(target=attempt, args=(f"Concurrent body number {index}.",))
        for index in range(2)
    ]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert outcomes == ["ok", "ok"], outcomes
    assert Conversation.objects.filter(initiator=asker).count() == 1
    assert Message.objects.count() == 2
    assert (
        ContactAccessGrant.objects.filter(
            viewer=asker, revoked_at__isnull=True
        ).count()
        == 1
    )
```

- [ ] **Step 2: Run them**

This task adds **no production code**, so there is no red step to manufacture: it is an acceptance suite over behaviour Tasks 1–13 already built, and it is supposed to pass first time. That is the point of running it — spec §39 step 9 asks the phase to "demonstrate the phase definition of done with verifiable test output", and a suite written after the fact either confirms the phase or finds a real defect.

Run: `cd backend && uv run pytest messaging/tests/test_phase_6_acceptance.py messaging/tests/test_concurrency.py -v`
Expected: PASS — **6** items in `test_phase_6_acceptance.py` and **1** in `test_concurrency.py`.

**If any assertion fails, the defect is in the production code from Tasks 1–13, not in this file.** Fix it there and re-run; do not weaken an assertion to make this suite green. Each test names the spec clause it proves, so a failure tells you which clause is unmet.

- [ ] **Step 4: Full regression, both projects — including the ordering experiment**

First the plain run:

Run: `cd backend && uv run pytest -q`
Expected: every test passes, 0 failures. Record the exact count for the handoff note.

Then the experiment that decides the ruling above. The question is whether the
transactional test's `flush` breaks anything that collects after it, so run it
in the two positions that matter and compare:

Run: `cd backend && uv run pytest -q messaging/tests/test_concurrency.py platform_settings accounts services_catalog finance messaging notifications`
Expected: all pass. This puts the transactional test **first**, ahead of every
suite that reads a migration-seeded row (`platform_settings/tests/test_admin.py`'s
`PlatformSetting.objects.get(...)`, `accounts/tests/test_permissions.py`'s
`Group.objects.get(...)`, `services_catalog`'s seeded categories, `finance`'s
seeded configuration). **This is the run that fails if the hazard is real.**

Run: `cd backend && uv run pytest -q accounts platform_settings messaging/tests/test_concurrency.py messaging notifications`
Expected: all pass. The same modules with the transactional test in the middle.

If both are green, the ruling's fallback ladder is not needed and Step 5's commit
message says so. If the first is red and the second green, the hazard is real and
ordering-dependent: apply ladder step (1), re-run both, and record it. **Paste the
tail of both runs into the task's PR body either way** — spec §39 step 9 wants
verifiable output, and "it passed on my machine in the default order" is not that.

Run: `cd frontend && pnpm lint && pnpm test && pnpm build`
Expected: no lint errors, every Vitest test passes, a successful build. Record the exact count.

Run: `cd backend && git diff --name-only dev -- listings/ platform_settings/ common/ brokers/ professionals/ accounts/ audit/ taxonomy/ finance/ services_catalog/ conftest.py`
Expected: **empty output**.

Run: `cd .. && git diff --numstat dev -- backend/config/settings/base.py backend/config/urls.py`
Expected: **zero deletions on both files** (the second column of every row is `0`). `base.py` gains two `INSTALLED_APPS` entries, one `CELERY_TASK_ROUTES` entry and four `DEFAULT_THROTTLE_RATES` entries plus their comments; `urls.py` gains one `include`. The assertion that matters is the deletion count, not the addition count — three other phases are appending to these same two files.

- [ ] **Step 5: Commit**

```bash
git add backend/messaging/tests/test_phase_6_acceptance.py backend/messaging/tests/test_concurrency.py
git commit -m "test(messaging): phase 6 acceptance suite for spec 15 DoD, spec 40 A/B and spec 34.2"
```

The commit body records the Step 4 outcome in one line — which of the two
ordering runs was green, and whether any fallback-ladder step was applied.

---

### Task 15: Phase handoff note and tracker update

**Files:**
- Modify: `ACTIVITY.md`, `docs/superpowers/PHASE-TRACKER.md`

**Interfaces:**
- Consumes: the recorded test output from Task 14.
- Produces: spec §39's "Required phase handoff note".

- [ ] **Step 1: Append the handoff note to `ACTIVITY.md`**

Read the file's existing `## Log` format and follow it. Substitute `<N>`, `<M>` and the PR numbers with the real values you read off Task 14's output and `gh pr list` — they are counts to look up, not decisions to make:

```markdown
### Phase 6 — Shared inquiry form and messaging core (plan `2026-09-18-phase-6-inquiry-messaging.md`)

**Migrations added:** `messaging/0001_conversation`, `messaging/0002_seed_unified_inquiries_flag`, `messaging/0003_message_contactaccessgrant`, `notifications/0001_initial`. All additive; no column is dropped or altered on an existing table. Rollback characteristics: reversing `0002` is a no-op by design (an operator-toggleable flag row is never deleted by a rollback — spec §32.3); the other three reverse cleanly because nothing outside the two new apps references their tables.

**Models/services/endpoints/components changed:**
- New apps `messaging` and `notifications`. New models `Conversation`, `Message`, `ContactAccessGrant`, `Notification`, `NotificationDelivery`.
- New services `submit_inquiry`, `post_reply`, `mark_conversation_read`, `grant_contact_access`, `resolve_inquiry_context`, `create_notification`, `send_notification_email` (Celery, `notifications` queue).
- New endpoints: `POST /api/v1/inquiries/`, `GET /api/v1/inquiries/config/`, `POST /api/v1/inquiry-drafts/`, `POST /api/v1/inquiry-drafts/resolve/`, `GET /api/v1/conversations/`, `GET|POST /api/v1/conversations/<id>/messages/`, `POST /api/v1/conversations/<id>/read/`. Three are spec §30.1 rows; four are documented additions (see the plan's Contract summary).
- New components `InquiryForm`, modules `lib/api/inquiries.ts`, `lib/i18n/inquiry.ts`, `lib/inquiry/draft-storage.ts`. Mounted at the `PHASE 6 SEAM` in the professional detail page.
- Already-merged files touched: `config/settings/base.py` and `config/urls.py` (append-only), and the professional detail page's seam. **No file under `listings/`, `platform_settings/`, `common/`, `brokers/`, `professionals/` or `accounts/` was modified.**

**Permissions and audit events added:** `messaging.permissions.UnifiedInquiriesEnabled` (`feature_disabled`) and `InquiryEmailVerified` (`email_verification_required`). Audit actions `inquiry.submitted` and `contact_access.granted`, both written inside the submission transaction. No new `PERMISSION_KEYS` entry — `submit_inquiry` and `reveal_contact_after_inquiry` already exist in `accounts.selectors.PERMISSION_KEYS` from Phase 3.

**Tests added and exact results:** `<N>` backend tests (`uv run pytest -q`: `<N> passed`), `<M>` frontend tests (`pnpm test`: `<M> passed`). Includes spec §40 Scenarios A and B, spec §16's four write-side acceptance tests, and spec §34.2's two-thread PostgreSQL concurrency test for "exactly one grant despite concurrent duplicate requests".

**Feature flag state:** `unified_inquiries` seeded **enabled**. Flag off ⇒ every messaging endpoint returns `403 feature_disabled` and the form is not rendered.

**Known limitations:** see the plan's "Known Limitations" section — 12 items, the load-bearing ones being that no messages *page* exists yet (Phases 19/20), that no WebSocket push exists yet (Phase 18), and that a broker with no `can_read_messages` member receives no notification at all.

**Screenshots/video for changed UI states:** capture the professional detail page in three states — guest (button reads "Sign in to send"), signed-in verified (button reads "Send message"), and after a successful send (the `inquiry.sent` confirmation) — at desktop and mobile widths, and attach them to the phase's final PR.
```

- [ ] **Step 2: Update `docs/superpowers/PHASE-TRACKER.md`**

Change the Phase 6 row's Status from `idea` to `done`, fill in the Plan file column with `` `2026-09-18-phase-6-inquiry-messaging.md` `` and the merged PR number, and write the Notes cell in the style the Phase 5 and Phase 11 rows already use: task count, what needed a fix round, what was deliberately deferred, and an explicit pointer that the Contract summary is **required reading before Phases 7, 18 and 19 touch messaging**.

Then update the Phase 7, 18 and 19 rows' Notes to say their dependency is now `done` and name this plan's Contract summary.

- [ ] **Step 3: Verify**

Run: `cd .. && git diff --stat dev -- ACTIVITY.md docs/superpowers/PHASE-TRACKER.md`
Expected: both files show additions; `PHASE-TRACKER.md` shows a small number of changed rows and no reordering.

- [ ] **Step 4: Commit**

```bash
git add ACTIVITY.md docs/superpowers/PHASE-TRACKER.md
git commit -m "docs(phase-6): handoff note and tracker update for the shared inquiry and messaging core"
```

---

## Known Limitations (carried forward, not fixed by this plan)

1. **There is no messages page.** `frontend/src/app/` has no `/dashboard/`, `/messages/`, `/boats/` or `/brokers/` route, so the inbox, thread and reply API this phase ships have no UI. Phase 19 builds the broker inbox (spec §28); Phases 16/20 build the private-seller and public pages. Until then the endpoints are reachable only by an API client.
2. **`next_url` points at a page that does not exist**, and the spec disagrees with itself about its path: §15.5 says `/dashboard/messages/<id>/`, §4.2 says `/messages/`, §28 says `/dashboard/broker/messages/`. The API returns §15.5's literal from one constant (`SENDER_CONVERSATION_URL_TEMPLATE`), and the form deliberately does not navigate to it. Whoever builds the page picks one path and changes that one line.
3. **No WebSocket push.** Spec §15.3 step 6 names WebSocket alongside email; §27.2's endpoint, group naming, channel-layer wiring and `GET /api/v1/notifications/` are all Phase 18's. This phase emits `messaging.signals.inquiry_received` inside `transaction.on_commit()` as the attachment point and writes **no** `WEBSOCKET` delivery row, because a `QUEUED` row nothing drains would be a fabricated state.
4. **No notification REST API and no notification UI.** `Notification` rows accumulate and are visible only in Django admin. Spec §30.1's `GET /api/v1/notifications/` and `POST /api/v1/notifications/<id>/read/` are Phase 18's, as is the bell in spec §31's matrix.
5. **A broker with no `can_read_messages` member is notified by nobody.** `can_read_messages` defaults to `False` and only the ADMIN role forces it true, so a brokerage whose members are all AGENT or VIEWER receives an inquiry into a real conversation that nothing announces. The submission still commits and the thread appears the moment staff grants the capability; a `logger.warning` marks each occurrence for spec §33.4 alerting. Fix belongs with the screen that manages team capabilities (Phase 19) or the staff broker screen (Phase 12).
6. **The broker email recipient is `BrokerOrganization.public_email`, not a configurable recipient list.** Spec §15.4 says "the broker's configured notification recipients"; no such field exists on the model and spec §11.1's field list has none, so inventing a column with no screen to manage it would be the invented configuration §2.1 forbids. Phase 19 or Phase 12 should replace it with a real list once a screen exists.
7. **`Message.read_at` is per-message, not per-member.** Spec §11.8 defines one nullable `read_at`, so for a broker team the unread count means "unread by the recipient side". Phase 19's per-person badge will need a `MessageRead` join table §11.8 does not define — a decision for the phase that has the screen in front of it.
8. **No staff read path.** `can_view_conversation()` deliberately does not use `accounts.services.can_read_broker_messages()`'s staff-moderator shortcut (see Task 9's ruling). If a staff messaging console is ever specified, it is Phase 17's, and the fix is one branch in `can_view_conversation` plus the matching `Q` in `conversations_visible_to` — they must change together.
9. **Nothing archives or blocks a conversation.** `ConversationStatus.ARCHIVED` and `BLOCKED` are modelled, constrained and enforced on the reply path (`409 conversation_closed`), but this phase ships no producer of either state, and therefore no implementation of spec §36.6's "Recipient blocking a user … may revoke access if staff policy requires; default is to revoke contact access for that relationship." The revocation half is Phase 7's (it owns `revoked_at`); the blocking affordance is Phase 19's.
10. **`Message.is_system` has no producer.** Every row this phase writes is `is_system=False`. The flag and its filters exist because Phase 7 ("contact unlocked" thread notes) and Phase 19 are the natural first producers.
11. **`CURRENT_PRIVACY_POLICY_VERSION` is a module constant, not a platform setting**, because `platform_settings.registry.SettingValueType` has only `BOOLEAN`, `INTEGER` and `DECIMAL` members — there is no string setting type. Changing the policy version currently requires a deployment. Whoever next extends the registry with a `STRING` type should move it, along with the four length limits and the duplicate-message window.
12. **`spam_detected` tells a bot it was caught**, and `GET /api/v1/inquiries/config/` names the honeypot field. Both are deliberate (a fake 201 would be the faked state §2.1 and §39 forbid, and the form needs a backend source for the field name), and both are recorded here rather than treated as secure-by-obscurity that works. Spec §15.1's escalation path — "CAPTCHA may be introduced only behind a risk threshold" — remains available and unbuilt.
13. **API error messages are English only.** `common.exceptions.nauta_exception_handler` and every permission class in the project return English strings; spec §30.2 asks for a "localized/user-safe message". This phase does not fix a project-wide gap, and works around it the way the frontend must anyway: the client maps `error.code` to its own EN/IT/ES copy (`ERROR_MESSAGE_KEYS` in `InquiryForm`), so the backend string is a developer-facing fallback, never what a person reads.
14. **SSR client-IP forwarding is solved, and this phase uses it rather than carrying the old gap forward.** `backend/common/ip.py` is merged (Phase 10 Task 1) and honours `X-Internal-Client-IP` only when `X-Internal-Service-Secret` matches, compared with `hmac.compare_digest`; `frontend/src/lib/api/internal-headers.ts` and `directoryFetch` (PR #103) are the sending half. `fetchInquiryConfig` delegates to `directoryFetch`, so each server-rendered visitor lands in their own `messaging_read` bucket. What remains genuinely open is Phase 10's own Known Limitation 13 — `IPV6_HASH_PREFIX_BITS` defaults to 0, so one residential IPv6 /64 can still mint a fresh bucket per address. That is a platform-wide setting, not this phase's to flip, and it makes the throttle weaker rather than the form disappear.

15. **The "Update in account" affordance is text, not a link.** Spec §15.1 asks for it beside the read-only email. `frontend/src/app/` has no `/account/` route — only `403`, `health`, `login`, `professionals`, `services` and `verify-email` — and linking to a 404 would be worse than explaining the rule in place. The backend behind it, `GET|PATCH /api/v1/account/`, already exists (Phase 3). Phase 16 or 20 builds the screen and turns the sentence into a link.
16. **No phone country selector.** Spec §15.1 asks for "E.164-compatible input and country selector". The input and its server-side validation are built; the selector is not, because a country/dial-code picker needs a country list this project does not have, has no staff screen to curate one, and no other consumer — so it would be invented data hard-coded into a component (spec §2.1). The field accepts exactly the same values either way. Assigned to Phase 20, which owns public UI polish and is where a shared country dataset would first pay for itself.
17. **No browser end-to-end test.** Spec §34.5 scenario 1 is this phase's journey, but §34.5 lives inside §34 — **Phase 23** — its ten scenarios span nine phases, and `frontend/package.json` has no Playwright, Cypress or WebDriver at all (`pnpm test` is `vitest run`). Task 12 covers the guest → draft → sign-in → restore → confirm-send sequence as component tests and Task 14 covers the server half over HTTP; the uncovered clause is scenario 1's last one, "sees contact unlock", which is Phase 7's panel.

---

## Contract summary for later phases

Everything a downstream phase imports from Phase 6, in one place. **Phase 7 (contact privacy), Phase 18 (notifications) and Phase 19 (broker messaging) depend on this section; the names below are fixed and will not be renamed by any later task in this plan.**

```python
from messaging.context import InquiryContext, resolve_inquiry_context
from messaging.drafts import DRAFT_FIELDS, read_inquiry_draft, sign_inquiry_draft
from messaging.enums import (
    CONTEXT_TO_CONVERSATION_TYPE,
    CURRENT_PRIVACY_POLICY_VERSION,
    DRAFT_TOKEN_MAX_AGE_SECONDS,
    DRAFT_TOKEN_SALT,
    DUPLICATE_MESSAGE_WINDOW_SECONDS,
    FULL_NAME_MAX_LENGTH,
    FULL_NAME_MIN_LENGTH,
    HONEYPOT_FIELD_NAME,
    MESSAGE_MAX_LENGTH,
    MESSAGE_MIN_LENGTH,
    PHONE_MAX_LENGTH,
    SENDER_CONVERSATION_URL_TEMPLATE,
    SUBJECT_MAX_LENGTH,
    SUBJECT_MIN_LENGTH,
    UNIFIED_INQUIRIES_FLAG,
    ContactAccessOutcome,
    ContactTargetType,
    ConversationStatus,
    ConversationType,
    InquiryContextType,
    conversation_url,
)
from messaging.exceptions import (
    ConsentRequired,
    ConversationClosed,
    FeatureDisabled,
    InquiryDraftExpired,
    InvalidInquiryContext,
    InvalidInquiryDraft,
    MessagingThrottled,
    RecipientUnavailable,
    SelfInquiryNotAllowed,
    SpamDetected,
)
from messaging.models import ContactAccessGrant, Conversation, Message
from messaging.pagination import ConversationPagination, MessagePagination
from messaging.permissions import InquiryEmailVerified, UnifiedInquiriesEnabled
from messaging.selectors import (
    active_contact_grant,
    annotate_last_message,
    annotate_unread,
    broker_message_readers,
    can_view_conversation,
    conversation_context,
    conversation_recipients,
    conversations_visible_to,
)
from messaging.serializers import (
    ConversationSerializer,
    InquiryResultSerializer,
    InquirySubmissionSerializer,
    MessageCreateSerializer,
    MessageSerializer,
)
from messaging.services import (
    InquiryResult,
    grant_contact_access,
    mark_conversation_read,
    message_excerpt,
    post_reply,
    submit_inquiry,
)
from messaging.signals import inquiry_received
from messaging.views import MessagingAPIView
from notifications.enums import (
    EXCERPT_MAX_LENGTH,
    DeliveryChannel,
    DeliveryStatus,
    NotificationType,
)
from notifications.models import Notification, NotificationDelivery
from notifications.services import create_notification
from notifications.tasks import send_notification_email
```

```ts
// frontend
import InquiryForm from "@/components/inquiry/InquiryForm";
import {
  INQUIRY_CONTEXT_TYPES,
  createInquiryDraft,
  fetchInquiryConfig,
  resolveInquiryDraft,
  submitInquiry,
  type InquiryConfig,
  type InquiryContextRef,
  type InquiryContextType,
  type InquiryDraftFields,
  type InquiryResult,
  type InquirySubmission,
} from "@/lib/api/inquiries";
import {
  INQUIRY_MESSAGES,
  formatInquiryMessage,
  tInquiry,
} from "@/lib/i18n/inquiry";
import {
  clearDraftToken,
  readDraftToken,
  storeDraftToken,
} from "@/lib/inquiry/draft-storage";
```

**Exact signatures a later phase calls:**

```python
resolve_inquiry_context(*, actor, context_type: str, context_id) -> InquiryContext
    # raises InvalidInquiryContext | RecipientUnavailable | SelfInquiryNotAllowed

submit_inquiry(
    *, actor, context_type: str, context_id, full_name: str, phone: str,
    subject: str, body: str, privacy_policy_version: str,
    marketing_consent: bool = False, request_id: str | None = None,
) -> InquiryResult
    # InquiryResult(conversation, message, contact_access, next_url,
    #               created_conversation, created_grant)

grant_contact_access(*, viewer, context: InquiryContext, conversation,
                     request_id: str | None = None) -> tuple[ContactAccessGrant | None, bool]

post_reply(*, actor, conversation, body: str, request_id: str | None = None) -> Message
mark_conversation_read(*, actor, conversation) -> int
message_excerpt(body: str) -> str

active_contact_grant(viewer, *, broker=None, professional=None) -> ContactAccessGrant | None
broker_message_readers(broker) -> QuerySet[User]          # ordered by pk, distinct
conversations_visible_to(user) -> QuerySet[Conversation]  # select_related, distinct
can_view_conversation(user, conversation) -> bool
annotate_unread(queryset, user) -> QuerySet               # adds `unread_count`
annotate_last_message(queryset) -> QuerySet               # adds `first_sender_name`, `last_message_body`
conversation_recipients(conversation) -> tuple[list[User], str]
conversation_context(conversation) -> tuple[str, str]     # (context type, label)

create_notification(
    *, recipient, notification_type: str, title_key: str, body_key: str,
    target_url: str, payload: dict | None = None, email_to: str = "",
    dedupe_key: str = "",            # spec 27.1's key; idempotent when non-empty
) -> Notification
send_notification_email(notification_id: str, to_email: str) -> None   # Celery task
```

**Endpoints shipped by this phase**, against spec §30.1's literal inventory:

| Endpoint | §30.1 | Route name |
|---|---|---|
| `POST /api/v1/inquiries/` | listed | `inquiry-create` |
| `GET /api/v1/conversations/` | listed | `conversation-list` |
| `GET\|POST /api/v1/conversations/<id>/messages/` | listed | `conversation-messages` |
| `GET /api/v1/inquiries/config/` | **addition** | `inquiry-config` |
| `POST /api/v1/inquiry-drafts/` | **addition** | `inquiry-draft-create` |
| `POST /api/v1/inquiry-drafts/resolve/` | **addition** | `inquiry-draft-resolve` |
| `POST /api/v1/conversations/<id>/read/` | **addition** | `conversation-read` |

**Request fields beyond spec §15.5's example body**, flagged for the same reason: `privacy_consent` (a boolean; §15.1 requires the checkbox and §33.2 requires the consent be obtained, but §15.5's worked payload shows only `privacy_policy_version`, which records *which* policy without recording that it was *accepted*), `marketing_consent` (§15.1's optional second checkbox, likewise absent from §15.5's example) and `company_website` (§15.1's mandated honeypot, which by its nature cannot appear in a documented payload). A client that omits `privacy_consent` gets `400 consent_required`.

The four endpoint additions are deliberate and flagged here rather than presented as spec-literal: the two draft routes are what spec §15.2 requires and §30.1 has no row for; `config/` is what makes §35.1's frontend gate and §2.1's "every visible state has a backend source" true for the form's own limits; and `read/` is what spec §28's "Mark-read and reply endpoints enforce broker organization membership" and its unread counts require. §30.1's own closing sentence grants the latitude: "Exact URL naming may follow an established API convention, but semantics, authorization and errors must remain equivalent." A later phase publishing an API inventory should list these as Phase 6 additions.

**Rules a later phase must follow:**

1. **Never create a second inquiry form or a second inquiry service.** Spec §15.1 and §39 forbid it outright. `InquiryForm` takes `context={type, id, label}` and nothing else needs to change to mount it on `/boats/<slug>/` or `/brokers/<slug>/`. `submit_inquiry()` is the only writer of an initial `Conversation` + `Message` + `ContactAccessGrant` triple.
2. **Never accept a recipient id from a client.** The only context inputs are `context_type` and `context_id`, and `resolve_inquiry_context()` is the only thing that turns them into a recipient (spec §11.8, §33.1). A new context kind means a new member of `InquiryContextType`, a new entry in `CONTEXT_TO_CONVERSATION_TYPE` and a new `_resolve_*` branch — never a new request field.
3. **Phase 7 reads grants through `active_contact_grant()` and writes revocations to `ContactAccessGrant.revoked_at`.** The active-grant uniqueness is enforced by two **partial** unique indexes conditioned on `revoked_at__isnull=True`, so revoking is what makes a re-grant possible; do not add a plain unique constraint. Phase 7 owns masking, `GET /api/v1/contacts/<target-type>/<id>/`, the blur UI and staff revocation; **this phase's serializers return no contact value of any kind**, and three tests assert their absence. If Phase 7 needs the grant's own timestamp, it is `granted_at`, not `created_at`.
4. **A private-seller listing has no grantable target.** `ContactTargetType` is `BROKER | PROFESSIONAL` (spec §11.8), `resolve_inquiry_context()` returns `contact_target_type=None` for a private listing, and the API reports `contact_access: "NOT_APPLICABLE"`. Phase 7 must handle that third state rather than assuming every inquiry unlocks something.
5. **Phase 18 connects receivers to `messaging.signals.inquiry_received`.** It fires inside `transaction.on_commit()` with `sender=Message` (the class) and kwargs `conversation`, `message`, `notification_ids: list[str]`. Do **not** add WebSocket calls inside `submit_inquiry` or `post_reply`. Phase 18 also writes the `DeliveryChannel.WEBSOCKET` row — this phase writes only `IN_APP` and `EMAIL`, so a missing WEBSOCKET row means "not built yet", never "failed".
6. **The notification model attribute is `notification_type`; the wire name is `type`.** Spec §11.10 and §27.2 both say `type`. Phase 18's serializer must use `serializers.CharField(source="notification_type")`. Adding an event means appending a member to `notifications.enums.NotificationType` — no migration, because the column is a plain `CharField`.
7. **Phase 19 reuses `GET /api/v1/conversations/` and must not build a second store.** Spec §28 says so explicitly. Its five filters are already implemented: `?status=OPEN|ARCHIVED|BLOCKED|ALL` (default `OPEN`), `?unread=true`, repeated `?type=` (so "Profile inquiries" is `type=BROKER_INQUIRY&type=PROFESSIONAL_INQUIRY`) and `?broker=<uuid>`. The row carries `subject`, `context {type,id,label}`, `counterparty_name`, `last_message_excerpt`, `last_message_at` and `unread_count` — spec §28's whole list.
8. **Broker message authorization is `can_read_messages` and nothing else.** Use `messaging.selectors.can_view_conversation()` / `conversations_visible_to()`, never `IsOwnerOrBrokerEditor` and never a fresh query. They are written as a pair and must change as a pair: a list that shows a row the detail view then refuses is the bug this rule exists to prevent. `accounts.permissions.CanReadBrokerMessages` reads `view.kwargs["broker_id"]` and therefore does **not** fit conversation-id-addressed routes — that is why this phase calls the service function underneath it.
9. **Never write a `Message` or a `Conversation` outside `messaging.services`.** `submit_inquiry` and `post_reply` hold the transaction, the duplicate guard, the `last_message_at` update, the notification fan-out and the post-commit signal together. A direct `Message.objects.create()` gets none of them.
10. **Any new messaging error code must be stable and documented** in this plan's Global Constraints table, and must be raised as an `APIException` subclass with a `default_code` — **not** as a `ValidationError`, which this project's envelope always collapses to `code: "validation_error"` with the detail in `error.fields`. An exception needing extra response context sets a dict attribute named `meta` (the passthrough Phase 11 added).
11. **Views extend `messaging.views.MessagingAPIView`**, which turns DRF's anonymous `not_authenticated` into spec §15.5's `authentication_required` and DRF's `throttled` into `rate_limited`. A messaging view that extends `APIView` directly will silently answer in a vocabulary spec §15.5 does not define.
   **11a. `UnifiedInquiriesEnabled` goes FIRST in `permission_classes` on every messaging view that has a flag gate.** `APIView.check_permissions` walks the list and stops at the first gate that fails, so a flag gate listed after `IsAuthenticated` never speaks for an anonymous caller — spec §35.1's "flag off ⇒ `feature_disabled`" would quietly become "unless you are signed out", and the same endpoint would name two different reasons for one state depending on who asked. Ordering it first costs nothing while the flag is on (the class returns `True` and the authentication gates run unchanged, so an anonymous caller still gets `401 authentication_required`). **Phase 7 extends `MessagingAPIView` for its contact endpoints and is the ruled exception:** they carry no flag gate at all (`contact_unlock` only ever closes reveal, it never blocks the LOCKED display; spec §16/§35.1/§14.2), so the rule does not apply to them; Phase 7's plan documents this as reconciliation row 11b. `test_the_flag_off_answer_precedes_every_other_permission` (Task 7) is the regression guard; copy it for any new gate.
12. **New UI strings go in `INQUIRY_MESSAGES` with all three languages** (spec §37); the dictionary test fails on any key missing a locale. `Locale` is still declared once, in `frontend/src/lib/api/directory.ts` (Phase 5 contract rule 12) — import it, never redeclare it.
13. **§37 keys reserved by this phase and not yet translated anywhere:** `notification.inquiry_received.title` and `notification.inquiry_received.body`. They are written into `Notification.title_key`/`body_key` today and have **no** frontend dictionary entry, because no notification UI exists. Phase 18 adds them to its own dictionary with EN/IT/ES.
14. **The `unified_inquiries` flag gates both surfaces.** Backend: `403 feature_disabled` from every messaging endpoint **except `GET /api/v1/inquiries/config/`**, which answers `200 {"enabled": false}` because it is the mechanism that tells the page not to render the form. Frontend: a page must not render `InquiryForm` when `config.enabled` is false. Adding a messaging endpoint means adding `UnifiedInquiriesEnabled` to its `permission_classes` — and that class **raises** `FeatureDisabled`; do not "simplify" it to `return is_feature_enabled(...)`, which would make every anonymous flag-off request answer `401 authentication_required` instead.
15. **Throttle scopes owned by this phase:** `inquiry_submit` (20/hour), `message_send` (60/hour), `messaging_read` (120/min), `inquiry_draft` (30/hour). Views declare **only** `throttle_scope`, never `throttle_classes` (Phase 3 contract rule 9). A view that needs two rates for two methods sets `self.throttle_scope` in `initial()` before calling `super()`, as `ConversationMessagesView` does.

---

## Self-Review

**Spec coverage — §15 (Phase 6), line by line:**

| Spec §15 requirement | Where implemented |
|---|---|
| §15.1 — one component equivalent to `InquiryForm`, no per-context copies | Task 12 (one file, `context` prop), Task 13 (its only mount today), Contract rule 1 |
| §15.1 — Full name required, prefilled, 2–120 | Tasks 1 (constants), 7 (serializer), 12 (prefill from session) |
| §15.1 — Email required, verified account email, read-only + "Update in account" | Tasks 7 (`validate_email` mismatch refusal), 12 (`readOnly` + the explanatory line; a link once an `/account/` page exists — Known Limitation 15) |
| §15.1 — Phone optional, E.164-compatible | Task 7 (`E164_PATTERN`, normalisation), Task 12 (`type="tel"` + hint) |
| §15.1 — Subject context-derived default, editable, 3–150 | Tasks 11 (`inquiry.subject_default`), 12 (default + editable), 7 (length) |
| §15.1 — Message required, 20–4000 | Tasks 1, 7, 10 (replies too), 12 |
| §15.1 — Privacy consent required, versioned | Tasks 1 (`CURRENT_PRIVACY_POLICY_VERSION`), 3 (`Message.privacy_policy_version`), 6, 7, 12 |
| §15.1 — Marketing consent optional, separate, unchecked, never required | Tasks 3 (column), 7 (`default=False`), 12 (unchecked), and a test for each |
| §15.1 — Context hidden/server-derived, never trusted | Task 5 (`resolve_inquiry_context`), Contract rule 2 |
| §15.1 — honeypot, rate limiting, abuse detection required | Task 7 (honeypot + `inquiry_submit`), Task 6 (duplicate-body guard), Task 10 (`message_send`) |
| §15.1 — CAPTCHA only behind a risk threshold, not by default | Not built; recorded in Known Limitations 12 |
| §15.2 — guest may type | Task 12 (the form renders for a guest) |
| §15.2 — on submit, preserve non-sensitive fields in a short-lived signed session | Task 8 (`django.core.signing`, 30-minute TTL, six fields), ruling |
| §15.2 — redirect to login with a validated local `next` | Task 12 (`/login/?next=` + `pathname`), which Phase 3's `safeNextUrl` allowlists |
| §15.2 — after verified auth, restore, show the context again, require confirm Send | Task 12's restore effect + `inquiry.draft_restored` notice; the page still shows the recipient because the form is mounted on it |
| §15.2 — do not send automatically after login | Tasks 8 and 12, one test each, both quoting the sentence |
| §15.3 steps 1–6, in one atomic operation | Task 6 (`submit_inquiry`, in that order, `@transaction.atomic`) |
| §15.3 — `201 Created` only after the transaction succeeds | Task 7 (the view returns after the service returns); Task 6's rollback test |
| §15.4 — broker listing inquiry → owning broker inbox | Task 5 (`_resolve_listing` → `_broker_context`), Task 6 test |
| §15.4 — members with `can_read_messages` get in-app visibility | Task 5 (`broker_message_readers`), Tasks 6, 9, 10 |
| §15.4 — email to configured recipients, not every member | Task 6 (`_dispatch_notifications`, one address); ruling + Known Limitation 6 |
| §15.4 — broker profile inquiry → same inbox | Task 5 (`_resolve_broker`) |
| §15.4 — professional inquiry → professional inbox | Task 5 (`_resolve_professional`) |
| §15.4 — private-seller listing inquiry → private-seller messages | Task 5 (owner branch), Task 9 (`listing__owner_user` in the inbox queryset) |
| §15.4 — email has a safe excerpt and a platform link | Task 4 (`BODIES` templates + `PUBLIC_BASE_URL`), Task 6 (`message_excerpt`, 200 chars) |
| §15.4 — email must not expose the recipient's hidden contact details to the sender | Tasks 4 and 10 — the email goes **to** the recipient, and no serializer returns a contact value; three DOM/response greps assert it |
| §15.5 — request body shape | Task 7 (`InquirySubmissionSerializer`) |
| §15.5 — success body shape | Task 7 (`InquiryResultSerializer`), asserted field-for-field |
| §15.5 — every named error code | Task 7's error table; one test per code |
| DoD — all inquiry locations render the same component/version | Task 13 (the one location that exists), Contract rule 1, ruling + Known Limitation 1 |
| DoD — email exists in every variant, cannot be forged | Task 7 (`validate_email`), Task 14 |
| DoD — one backend service handles all types | Task 6; Task 14's three-context test |
| DoD — messages appear in the correct recipient inbox and sender list | Task 9; Task 14's inbox assertions from three seats |
| §27.1 — `inquiry.received` recipients, channels and **deduplication key** (message ID) | Task 4 (`Notification.dedupe_key` + its partial unique index, `create_notification`'s idempotency), Task 6/10 (`dedupe_key=str(message.pk)` at the one call site) |
| §27 acceptance — "Retried task does not create duplicate in-app notification/delivery" | Task 4 (`create_notification` returns the existing row; `send_notification_email` short-circuits on an already-`SENT` delivery), four tests |
| §34.5 — browser end-to-end, scenario 1 | Ruled to Phase 23 (no browser harness exists); covered at component level by Task 12 and at API level by Task 14 — ruling + Known Limitation 17 |
| §15.1 — phone "country selector" | Ruled out of scope (no country dataset, no staff screen, no other consumer — spec §2.1); input + validation + format hint shipped — ruling + Known Limitation 16 |

**Spec coverage — §11.8 and §11.10 (data model):** `Conversation` — every listed field (`id`, `conversation_type`, `initiator`, `broker`, `professional`, `listing`, `status`, `last_message_at`, `created_at`) plus the ruled `subject`, and §11.8's prose rule "exactly one valid context combination" as a real `CheckConstraint` (Task 2). `Message` — every listed field (`id`, `conversation`, `sender`, `body`, `sender_email_snapshot`, `is_system`, `created_at`, `read_at`) plus the four ruled columns (Task 3). `ContactAccessGrant` — every listed field (`id`, `viewer`, `target_type`, `broker`, `professional`, `source_conversation`, `granted_at`, `revoked_at`) and its prose rule "unique active grant per viewer and target" as two partial unique indexes (Task 3). `Notification` and `NotificationDelivery` — every listed field including `unique(notification, channel)` (Task 4).

**Spec coverage — other sections touched:** §1's fixed decisions (one shared form/serializer/service, verified-email requirement, contact reveal scoped and audited) are in Global Constraints and each has a task. §2.1–§2.5 → the config endpoint (no client-side rule without a backend source), the permission classes and `resolve_inquiry_context` (server authority), `@transaction.atomic` + partial unique indexes + `on_commit` (atomicity), the two audit actions (auditability); §2.5 does not apply (no finance copy here). §5's "Submit inquiry: — for Guest, ✓ for everyone else" → the 401 test; "Reveal recipient contact after inquiry: own access" → the per-viewer grant. §11.8/§11.10 as above. §16 (Phase 7) is a documented seam with four of its acceptance tests proved on the write side in Task 14 and the read side explicitly left to Phase 7. §27.1's `inquiry.received` event, recipients and channels → Task 4 and Task 6; §27.3's rules (queue after commit, localized with EN fallback, safe summary, bounded retries, failure visible without rollback) → Task 4, one test each. §28's backend paragraph and row/filter list → Task 9. §30.1's three rows plus four flagged additions → the Contract summary's table. §30.2's envelope, decimal/ISO rules (no money or dates are returned by this phase beyond ISO timestamps), one pagination shape and `X-Request-ID` echo → Task 7's tests. §30.3's `Idempotency-Key` → ruled not applicable, with the structural guard that replaces it. §30.4's "inquiry submission" and "message sending" rows → four throttle scopes, with 429 + `Retry-After` + `meta.retry_after_seconds`. §31's three inquiry-form rows and its "Broker messages" row → Tasks 6, 9, 12, 13. §33.1 (object authorization, local-URL allowlist, no IDOR) → Task 10's 404-not-403 rule and Task 12's `pathname`-only `next`. §33.2 (consent and version recorded, no fingerprinting, snapshots follow retention) → Task 3's two consent columns. §33.3's "paginate every unbounded collection" and "avoid N+1, verify with query-count tests" → Tasks 9 and 10's paginators and Task 9's query-budget test. §33.5's "never log message bodies" → the two `logger.warning` calls carry ids only, and Task 6 asserts the body is absent from the audit row. §34.1–§34.3's named classes → Tasks 5–10; §34.2's concurrency requirement → Task 14's two-thread test; §34.4's "Inquiry → conversation → grant → notification → email task" integration → Task 14 Scenario A. §35.1's flag → Task 2's migration and Tasks 7–10's permission class, both surfaces. §36.6's four bullets → empty/short content is refused before any grant (Task 7), blocking prevents new messages (Task 10), the "entity changing public contact" bullet is Phase 7's read side by construction (a grant stores no contact value), and non-transferability is a DB-level `viewer` scope with its own test. §37's three named `inquiry.*` keys plus the reserved notification keys → Task 11 and Contract rule 13. §39's protocol → the per-task TDD structure, the HTTP-level red-to-green in Task 13, the "no partial implementations" rulings, and Task 15's handoff note. §40 Scenarios A and B → Task 14.

**Placeholder scan:** no "TBD", "TODO", "implement later", "add appropriate error handling", "handle edge cases", "write tests for the above" or "similar to Task N" appears anywhere in this plan. Every code step carries the actual code; every test step carries the actual test. The `<N>`/`<M>` tokens in Task 15's handoff note are counts the executor reads off their own test output in Task 14, with an explicit instruction to substitute them; they are not unresolved decisions. Task 14's fallback ladder is a decision procedure with a named experiment and three ordered outcomes, not a deferral: Step 4's two commands decide it, and Step 5's commit message records which branch was taken.

**Type consistency:** `Conversation`, `Message`, `ContactAccessGrant`, `Notification` and `NotificationDelivery` are each defined once and referenced by the same name everywhere, including in the File Structure and the Contract summary. `InquiryContext`'s nine fields are read by name in Tasks 6 and 10 exactly as Task 5 defines them (`contact_target_type`, `recipient_users`, `recipient_email`, `context_label` — never `target_type`, `recipients`, `email` or `label`). `submit_inquiry`'s parameter is `body`, and the HTTP field is `message`; Task 7's view is the single place the two names meet, and it maps `data["message"] -> body=` explicitly. `message_excerpt` is defined once in `services.py` and imported by `serializers.py`; `EXCERPT_MAX_LENGTH` lives in `notifications.enums` because it bounds a notification payload, and is the only place the number 200 appears. `ContactAccessOutcome.GRANTED` / `.NOT_APPLICABLE` are the only two values `InquiryResult.contact_access` can hold, and the TypeScript `InquiryResult["contact_access"]` union lists exactly those two. `conversation_url()` is the single producer of `/dashboard/messages/<id>/` and is used for both `next_url` and `Notification.target_url`, so the two can never disagree. `HONEYPOT_FIELD_NAME` is defined once and reaches the browser through the config endpoint, so the serializer field, the rendered input's `name` and the client payload key are one string. `_dispatch_notifications` is introduced in Task 10 and Task 6's `_notify_recipients` is rewritten to call it in the same task, so there is never a moment where two fan-out implementations exist. On the frontend, `Locale` is imported from `@/lib/i18n/directory` (which re-exports Phase 5's single declaration) and never redeclared; `InquiryContextRef` is declared once in `lib/api/inquiries.ts` and consumed by both the component and `draft-storage.ts`.

**Gaps found and closed during review:**

1. The first draft gated the inbox with Phase 3's `CanReadBrokerMessages` permission class, as its contract rule 4 says. Reading the real class showed it resolves `view.kwargs["broker_id"]`, which none of this phase's routes carry — it would have returned `False` for every request, silently hiding every broker's inbox. Replaced with a direct call to the service function underneath it, and the deviation written up in Task 9's ruling.
2. The first draft raised `consent_required`, `invalid_context` and the rest as DRF `ValidationError`s with field codes. Phase 13's plan documents — and `common/exceptions.py` confirms — that every `ValidationError` collapses to `code: "validation_error"`, so none of spec §15.5's named codes would ever have reached a client. All of them became `APIException` subclasses; the one genuinely field-shaped error (a forged email) stayed a `ValidationError` and its test asserts the *message* in `error.fields`, not a code.
3. The first draft returned `401 not_authenticated` for a guest, because DRF chooses that branch itself and a permission class's `code` only reaches the 403 branch. `MessagingAPIView.permission_denied` now raises `NotAuthenticated(code="authentication_required")`, which is spec §15.5's own name.
4. The email recipient was originally "every broker member with `can_read_messages`", which spec §15.4 forbids in as many words ("not every member by default"). Split into two channels: in-app to every reader, email to one configured organization address.
5. A `test_the_email_job_is_queued_only_after_the_transaction_commits` drafted with a bare `with transaction.atomic():` would have failed on its last line — pytest-django's `django_db` never commits, so `on_commit` never fires. Rewritten around `django_capture_on_commit_callbacks`, with the reason spelled out in the docstring so nobody "fixes" it back.
6. The broker-profile partial unique index initially omitted `listing__isnull=True`, which would have made a second inquiry about a second boat from the same broker impossible. Caught by writing `test_a_broker_listing_thread_does_not_collide_with_the_broker_profile_thread` first; the same clause is repeated in `_open_thread_lookup` so the query and the index agree.
7. **(Fix round 2)** Raising `FeatureDisabled` was necessary but not sufficient: `UnifiedInquiriesEnabled` was listed **last** in every `permission_classes`, and `APIView.check_permissions` stops at the first gate that fails. An anonymous caller therefore failed `IsAuthenticated` and got `401 authentication_required` before the flag was ever consulted — so three of this plan's own round-1 tests asserted a 403 that could not arrive, and spec §35.1's rule silently read "flag off ⇒ `feature_disabled`, unless you are signed out". The flag gate is now **first** on every messaging view, the `InquiryCreateView` docstring that argued for the old order is inverted, `MessagingAPIView`'s docstring states the rule for subclasses, Contract rule 11a states it for Phase 7, and `test_the_flag_off_answer_precedes_every_other_permission` walks four callers who would each fail a different later gate and requires all four to hear `feature_disabled`.
8. **(Fix round 2)** The equal-query N+1 test would have failed by exactly one query: `platform_settings.services.is_feature_enabled` caches with `timeout=None`, the package conftest deletes that key at test start, so the first request of any test pays a `FeatureFlag` SELECT no later request pays. A discarded warm-up request now precedes the first `CaptureQueriesContext`.
9. **(Fix round 2)** `messaging/tests/conftest.py` called `cache.clear()` while claiming to mirror `listings/tests/conftest.py`. That claim was false in the way that matters: those conftests delete **named** keys, and `RedisCache.clear()` is a `FLUSHDB` that has already broken concurrently running worktree suites in this repository — which is why `backend/conftest.py` was rewritten to scan and delete only its own `KEY_PREFIX`. The fixture now deletes `SETTINGS_CACHE_KEY` plus `feature_flag_cache_key(k)` for each key in `MESSAGING_FEATURE_FLAG_KEYS`, which also gives that previously-unused constant its job back.
10. **(Fix round 2)** `_reply_display_name` could raise `DataError` inside `post_reply`'s transaction: `accounts.User.full_name` is `max_length=150` while `Message.sender_name_snapshot` is spec §15.1's 120. It now truncates to `FULL_NAME_MAX_LENGTH`, with a parametrised boundary test at 120 and 150.
11. **(Fix round 1)** `UnifiedInquiriesEnabled` originally returned `False`. DRF's `APIView.permission_denied` answers `401 NotAuthenticated` for any credential-less request *before* it consults which permission failed, so on the `AllowAny` guest-draft route a flag-off request would have answered `401 authentication_required` — and this plan's own test asserted `403 feature_disabled`, so it could never have passed. The class now raises `FeatureDisabled`, mirroring the merged `services_catalog.permissions.CombinedDirectoryEnabled`, and every endpoint has an anonymous flag-off assertion.
12. **(Fix round 1)** `_reply_display_name` was `actor.get_full_name() or actor.get_short_name()`. Both are `self.full_name or self.email` in `accounts/models.py`, and `register_user` defaults `full_name=""` — so a nameless replier's **email address** would have been stored in `Message.sender_name_snapshot` and returned by both the thread and the inbox serializers. It now reads `actor.full_name` only, stores `""`, and the localized `inquiry.sender_unnamed` / per-locale `SENDER_FALLBACK` cover the display. A regression test asserts the address appears in neither payload.
13. **(Fix round 1)** The inbox's N+1 guard was `django_assert_max_num_queries(6 + 2 * rows)` — a budget that scales with the row count cannot fail on an N+1, it funds one. Replaced with a 2-row-vs-7-row comparison that requires an *equal* query count, and the two per-row lookups became `Subquery` annotations (`annotate_last_message`). `annotate_unread` also moved from a `Count` aggregate to a subquery so the outer query stays ungrouped alongside `.distinct()` and pagination.
14. **(Fix round 1)** `fetchInquiryConfig` called `fetch` directly, so every server-rendered visitor shared one `messaging_read` bucket and a 429 would have made the form vanish from the page. It now goes through the merged `directoryFetch`, which forwards `X-Internal-Client-IP` behind `X-Internal-Service-Secret` (PR #103) — and a test asserts the delegation, because a plain `fetch` would pass every happy-path assertion while reintroducing the bug.
15. **(Fix round 1)** Every "Expected: PASS — N collected items" line was recounted from the real test bodies; five were wrong.
16. Fixture slugs and emails were checked against the real merged seeds rather than assumed: `blue-marine-brokers`, `marine-survey-co`, `user@example.com`, the six `services_catalog` SEO category slugs and `Beneteau` are all real and unique, so every fixture in this plan uses `phase6-*` slugs and `@phase6.example` addresses.
