# Phase 19 — Broker dashboard simplification and messaging — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a broker organization a working Messages screen and a broker home that shows only backend-derived metrics, built entirely on Phase 6's shared `Conversation`/`Message` store, and retire the obsolete `Services & Surveyors` route with a single 301 to Messages.

**Architecture:** Nothing in this phase creates a message store, a second inquiry form or a second inquiry service — spec §28 forbids the first outright and Phase 6's contract rules 1 and 7 forbid the rest. The backend contribution is deliberately small: two additions that spec §28 asks for and Phase 6 did not ship (a producer for `ConversationStatus.ARCHIVED`, so §28's "Archived" filter is a control rather than a decoration, and a broker dashboard metrics endpoint so §28's four numbers have a backend source). Everything else is frontend: one shared, role-neutral component layer (`components/messages/`) mounted twice — once at the sender-side route Phase 6's `conversation_url()` already emits (`/dashboard/messages/…`, today a dangling link in every `next_url` and every `Notification.target_url`) and once inside broker chrome at `/dashboard/broker/messages/` — which is exactly what §28's definition of done means by "Broker messages and private seller messages share components/services where practical".

**Tech Stack:** Django 5.2 + DRF (backend, `messaging` and `brokers` apps), PostgreSQL 16, Redis (cache + DRF throttle buckets), Next.js 16 App Router + React 19 + Tailwind v4 (frontend), Vitest + Testing Library (frontend tests), pytest + pytest-django (backend tests).

**Spec:** [`NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md`](../../../NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md) §28 (Phase 19, line 1908), and the sections it depends on: §3 (architecture/app layout), §4.2–§4.3 (private routes, the `/dashboard/broker/services/` → `/dashboard/broker/messages/` 301), §5 (the role capability table), §11.1 (`BrokerMembership`, where **`can_read_messages` is actually defined** — §5's table has no row for it), §11.8 (`Conversation`/`Message`/`ContactAccessGrant`), §15 (Phase 6 messaging core), §21 (Phase 12 broker policy), §26.x/§30 (API conventions), §33 (security/privacy/performance), §34 (test strategy), §35.1–§35.2 (feature flags, seeded **disabled**), §36.6 (contact access and abuse), §37 (EN/IT/ES keys, including the literal `broker.messages`), §40 Scenario L.

**Plans this one builds on (read before starting):**

- [`2026-09-18-phase-6-inquiry-messaging.md`](./2026-09-18-phase-6-inquiry-messaging.md) — **hard dependency.** Its "Contract summary for later phases" is binding on this plan, and its **rule 7** is this phase's charter: *"Phase 19 reuses `GET /api/v1/conversations/` and must not build a second store… Its five filters are already implemented."* Rules 8, 9, 10, 11/11a, 12 and 15 constrain every backend step here.
- [`2026-09-18-phase-12-broker-policy.md`](./2026-09-18-phase-12-broker-policy.md) — **hard dependency.** `brokers.selectors.broker_listing_counts()` and `pending_revision_count()` are the backend source for two of spec §28's four metrics, and are consumed read-only. Its contract rules 2 (import direction) and 10 (`listing_counts` is a live aggregate, never denormalised) bind Task 2.
- [`2026-09-17-phase-3-identity-organizations-permissions.md`](./2026-09-17-phase-3-identity-organizations-permissions.md) — `accounts.services.active_broker_membership()`, the `GET /api/v1/session/` payload (`broker_memberships[].can_read_messages` is already there, verified in `backend/accounts/selectors.py:78` and `frontend/src/lib/auth/types.ts:50`), `IsActiveUser`, and its rule that views declare `throttle_scope` only, never `throttle_classes`.
- [`2026-09-18-phase-5-directory-consolidation.md`](./2026-09-18-phase-5-directory-consolidation.md) — house style for a Next.js page/component/dictionary trio, and its contract rule 12: **`Locale` is declared once, in `frontend/src/lib/api/directory.ts`.** Import it; never redeclare it.

**Phase dependencies:** spec §7 and `docs/superpowers/PHASE-TRACKER.md` list Phase 19 as depending on Phases **6** and **12**. Both must be **fully merged** before Task 1 begins — see "Cross-phase collision notice" below, which is the reason this plan can touch `messaging/` and `brokers/` at all.

---

## Execution Model

Per the standing project convention recorded in `ACTIVITY.md`: each task is implemented on its own branch off the current tip of `dev` (`git checkout -b task-N-<slug> dev`), run through `subagent-driven-development`'s implementer → task-reviewer → fix-loop cycle, opened as a PR (`gh pr create`), and merged by the controller only when CI is green and the branch is cleanly mergeable. **Tasks run strictly sequentially — never two branches in flight at once** — and each new task branches from the just-merged `dev` tip.

**One worktree per task.** The controller creates the task's worktree with `superpowers:using-git-worktrees` (`git worktree add ../nautelo-worktree-task-N -b task-N-<slug> dev`), copies `backend/.env` and `frontend/.env.local` into it, and removes it after the PR merges. `backend/config/settings/test.py` derives the test database name from `sha1(BASE_DIR)[:10]`, so two worktrees never share a test database.

**CI gates (`.github/workflows/ci.yml`, both jobs must be green before merge):**
- `backend`: `uv sync` → `docker compose up -d --wait minio` + `createbuckets` → `uv run python manage.py check` → `uv run pytest -v` against **PostgreSQL 16 and Redis 7 service containers**.
- `frontend`: `pnpm install --frozen-lockfile` → `pnpm lint` → `pnpm test` → `pnpm build`.

A task whose final step does not show that command's real output is not finished (`superpowers:verification-before-completion`).

**Ordering constraint inside this plan.** Tasks 1 and 2 are backend and independent of each other. Tasks 3–9 are frontend and strictly sequential: 4 consumes 3, 5 and 6 consume 3 and 4, 7 consumes 5 and 6, 8 consumes 7, 9 consumes 4 and 8. Task 10 depends on nothing in 1–9 but its regression sweep is only meaningful once 8 has shipped the nav. Task 11 is last.

**Ordering constraint ACROSS phases — this is a hard gate, not a preference.** Task 1 extends modules Phase 6 has not written yet. Verified against `dev` at the time of this revision (merge commit `6dec1e6`): `backend/messaging/` contains only `__init__.py`, `admin.py`, `apps.py`, `enums.py`, `masking.py`, `models.py`, `migrations/{0001_conversation,0002_seed_unified_inquiries_flag}.py` and its tests. There is **no** `views.py`, `serializers.py`, `selectors.py`, `services.py`, `permissions.py`, `exceptions.py`, `pagination.py` or `urls.py`; `messaging/models.py` defines **only `Conversation`** (no `Message`, no `ContactAccessGrant`); `config/urls.py` has **no** `include("messaging.urls")`; and `REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]` holds six scopes, **none** of them `messaging_read` or `message_send`.

Therefore: **Phase 6 Tasks 3, 4, 5, 6, 7, 8, 9 and 10 must all be merged to `dev` before Task 1 of this phase is started**, because between them they create every module, model, route and throttle scope Task 1 appends to. Phase 6 Tasks 11–15 (frontend) must be merged before **Task 4** of this phase, which reconciles against `INQUIRY_MESSAGES`. Phase 12 Tasks 6–10 must be merged before **Task 2**, which appends to `brokers/views.py` and `brokers/urls.py`. Task 1 Step 0 is a machine-checked gate over exactly these artifacts and **fails the task** if any is absent — it is not advisory.

---

## Global Constraints

Exact values copied from the spec. Every task's requirements implicitly include this section.

- **No second message store.** Spec §28, Backend: *"Use the shared `Conversation`/`Message` model. Do not build a second broker-only messaging store."* This plan adds **no model and no migration.** If a task appears to need one, it is out of scope — record it in Known Limitations instead.
- **Mark-read and reply endpoints enforce broker organization membership** (spec §28, Backend). They already do: Phase 6's `messaging.selectors.can_view_conversation()` is the single gate, and Phase 6's contract rule 8 forbids replacing it with `IsOwnerOrBrokerEditor` or a fresh query.
- **Broker team access is `can_read_messages` and nothing else** (spec §28 Add; the field is defined in **§11.1**'s `BrokerMembership` block — §5's capability table has no row for it, which is exactly why no `PermissionKey` in `frontend/src/lib/auth/types.ts` expresses it and why the client must never try to). Never `can_edit_listings`, never `can_manage_team`, never role.
- **Spec §28's five filters, verbatim:** `All`, `Unread`, `Listing inquiries`, `Profile inquiries`, `Archived`.
- **Spec §28's conversation row, verbatim:** sender display name, context/listing, last message excerpt, timestamp, unread count.
- **Spec §28's thread, verbatim:** messages, context sidebar, listing/profile link, reply composer.
- **Spec §28's dashboard metrics, verbatim:** *"only backend-derived useful metrics such as published listings, pending approvals, unread messages and new inquiries. Remove surveyor/service widgets completely."*
- **Spec §4.2/§4.3:** `/dashboard/broker/services/` returns **301** (not 308, not 302) to `/dashboard/broker/messages/`, must not remain in navigation, and **must not create a redirect chain**.
- **Feature flags (spec §35.1, §35.2):** this phase introduces **no new flag**. §35.1's list has nine flags and none of them is a broker-dashboard flag; the messaging surfaces here are gated by Phase 6's `unified_inquiries`, which `backend/messaging/migrations/0002_seed_unified_inquiries_flag.py` already seeds **DISABLED** (verified). No task in this plan seeds, enables or adds a flag.
- **Throttling (Phase 3 contract rule 9, Phase 6 contract rule 15):** views declare **`throttle_scope` only**, never `throttle_classes`. The project-wide class is `common.throttling.HashedIPScopedRateThrottle`, already the `DEFAULT_THROTTLE_CLASSES` entry. This plan adds exactly two scope keys, both as append-only one-liners in `REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]`.
- **Error codes (spec §30.2, Phase 6 contract rule 10):** a named wire code must be an `APIException` subclass with a `default_code`. A DRF `ValidationError` collapses to `code: "validation_error"` in `common.exceptions.nauta_exception_handler` and its detail lands in `error.fields` — so a named code can never be delivered through one.
- **Permission order (Phase 6 contract rule 11a):** on a messaging view that has a flag gate, `UnifiedInquiriesEnabled` goes **FIRST** in `permission_classes`, because `APIView.check_permissions` stops at the first gate that fails. Views in this plan that carry **no** flag gate (Task 2's broker dashboard) put `IsAuthenticated` first, and the task says why.
- **Cross-tenant isolation (spec §33.1):** a broker must never see another broker's conversations, counts or metrics. Every list, detail, count and mutation in this plan carries a **cross-broker negative test**. A conversation the caller may not see answers **404, never 403** (Phase 6's `ConversationScopedView` rule — a 403 confirms the id exists).
- **Localization (spec §37):** all new UI text is an EN/IT/ES key. The literal key **`broker.messages`** is named by §37 and is shipped by Task 3. No English string is hard-coded in a component.
- **`Locale` is imported from `@/lib/i18n/directory` (which re-exports `@/lib/api/directory`'s single declaration), never redeclared** (Phase 5 contract rule 12).
- **Next.js 16 specifics:** `params` and `searchParams` are **Promises** and must be awaited; `trailingSlash: true` is set in `next.config.ts` so every route and redirect uses the slashed form; `next.config.test.ts` pins the redirect table's **length** and must be updated in the same commit that adds a redirect.
- **Authenticated frontend reads go through `apiFetch` from `@/lib/api/client`, never `directoryFetch`.** `directoryFetch` is the unauthenticated SSR reader: it sends `X-Internal-Service-Secret` and a forwarded visitor IP and sends **no** `Authorization` header. A conversation inbox fetched through it would either be empty or, worse, be attributed to the Next.js server. Ruling restated in Task 4.
- **`useSession()` has a `loading` state and it must be honoured.** On a fresh page load the in-memory access token is gone and `SessionProvider` trades the refresh cookie for a new one *before* asking for the session (`frontend/src/lib/auth/session.tsx:56-68`). A screen that reads `session` while `loading` is true renders a signed-in broker as a guest. Every client screen in this plan branches on `loading` first.
- **No `cache.clear()` in any conftest.** `RedisCache.clear()` is a `FLUSHDB` and this project's test Redis DB is shared by concurrently running worktrees. Delete named keys only, as `backend/conftest.py`, `backend/messaging/tests/conftest.py` and `backend/listings/tests/conftest.py` all do.
- **Fixture identity discipline.** Every user email in a new test is `@phase19.example`; every broker slug/name and professional slug/name a new test creates is prefixed `phase19-` / `Phase19 `. The factory defaults (`make_broker` → `blue-marine-brokers`, `make_professional` → `marine-survey-co`, `make_user` → `user@example.com`) are shared across the whole suite and must never be taken by a new test that also creates a second organization.
- **N+1 tests compare, never budget.** An absolute `max_num_queries(k + 2 * rows)` assertion cannot fail on an N+1 — it budgets for one. Compare two real result sets (2 rows vs 7 rows) and assert **equal** query counts, and warm the feature-flag cache with one discarded request first, because `platform_settings.services.is_feature_enabled` caches with `timeout=None` and the package conftest deletes that key at test start.

---

## Cross-phase collision notice (read this first)

Concurrent phases are editing `listings/`, `platform_settings/`, `finance/`, `brokers/`, `analytics/`, `messaging/`, `notifications/`, `entitlements/` and `common/throttling.py`.

**This plan opens `messaging/` and `brokers/`, and that is safe only because of a sequencing fact, not because the edits are small.** Phase 19 depends on Phase 6 and Phase 12 (spec §7, PHASE-TRACKER). Merged to `dev` at merge commit `6dec1e6`: **Phase 6 Tasks 1–2** (`messaging/enums.py`, `messaging/models.py`'s `Conversation`, migrations `0001`/`0002`, `tests/{conftest,factories}.py`), **Phase 7 Task 1** (`messaging/masking.py` + `messaging/tests/test_masking.py`, PR #131), **Phase 12 Tasks 1–5** and **Phase 13 Task 4** (`entitlements/eligibility.py`, PR #130). Phase 6 Tasks 3–15 and Phase 12 Tasks 6–10 are in flight. **Task 1 of this plan does not start until Phase 6 Task 15 and Phase 12 Task 10 are both merged to `dev`** — see the Execution Model's cross-phase gate for the module-by-module reason. The controller must confirm this before creating Task 1's worktree; Task 1 Step 0 is the machine check.

**`messaging/masking.py` is Phase 7's and this plan never imports it.** It is listed here only so a reader of the merged tree does not mistake it for a Phase 6 module this plan should be reconciling against. Contact masking is Phase 7's `GET /api/v1/contacts/<target-type>/<id>/`; nothing in this phase renders a contact value at all.

**Files this plan opens that it did not create:**

| File | Change | Task | Why it is unavoidable |
|---|---|---|---|
| `backend/messaging/exceptions.py` | **Append** three `APIException` subclasses: `InvalidConversationStatus`, `ConversationSuperseded`, `ConversationFilingForbidden`. | 1 | Spec §28's Archived filter needs a producer, ruling 5 needs a named refusal for a sender who tries to file, and Phase 6 contract rule 10 requires every named code to be an `APIException` subclass. |
| `backend/messaging/services.py` | **Append** `ARCHIVABLE_STATUSES` and `set_conversation_status()`. | 1 | Phase 6 contract rule 9: *"Never write a `Message` or a `Conversation` outside `messaging.services`."* The writer has to live here. |
| `backend/messaging/serializers.py` | **Append** `ConversationStatusSerializer`; **edit** `ConversationSerializer` to add one `viewer_is_initiator` field and one `"url"` key inside `get_context()`. | 1 | Spec §28's thread requires a "listing/profile link", and spec §2.1 requires a backend source for the archive control's own visibility. Both edits add; neither changes an existing field. |
| `backend/messaging/views.py` | **Append** `ConversationDetailView` and `ConversationStatusView`. | 1 | Phase 6 contract rule 11: a messaging view must extend `MessagingAPIView`, which lives here. |
| `backend/messaging/urls.py` | **Append** two `path(...)` entries: `conversation-detail` and `conversation-status`. | 1 | — |
| `backend/brokers/permissions.py` | **New file.** | 2 | Avoids editing `accounts/permissions.py`. |
| `backend/brokers/dashboard.py` | **New file.** | 2 | Keeps the metric aggregation out of `brokers/selectors.py`, which Phase 12 owns. |
| `backend/brokers/views.py` | **Append** `BrokerDashboardView`. | 2 | House style: one views module per app. |
| `backend/brokers/urls.py` | **Append** one `path(...)`. | 2 | — |
| `backend/config/settings/base.py` | **Append two one-liners** to `REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]`. Nothing reordered, reformatted or removed. | 1, 2 | The tracker's "Known cross-phase risk" names this file; append-only is the agreed protocol. |
| `backend/brokers/tests/conftest.py` | **New file** (this package has none today — verified). | 2 | Global Constraints require named-key cache deletes around tests that flip a feature flag; `brokers/tests/` flips `unified_inquiries`. |
| `frontend/src/components/auth/RequirePermission.tsx` + `.test.tsx` | Make the `permission` prop **optional**; when it is absent the component is the project's existing sign-in redirect and nothing else. Backwards compatible — every current caller passes a permission. | 7 | See ruling 13. There is no `PermissionKey` for "has conversations", and inventing one would be the client-side inference spec §2.2 forbids. Phase 3 owns this file; no in-flight phase edits it. |
| `frontend/src/components/layout/PrimaryNav.tsx` + `.test.tsx` | **Append** one gated `LINKS` entry and widen the visibility predicate. | 8 | Without an entry point the broker dashboard is unreachable. No other phase edits this file. |
| `frontend/next.config.ts` + `next.config.test.ts` | Add spec §4.3's third redirect; update the pinned redirect **count** from 2 to 3. | 10 | Spec §4.3 row 5. The count assertion is at `next.config.test.ts:13`. |
| `ACTIVITY.md`, `docs/superpowers/PHASE-TRACKER.md` | Handoff note and status row. | 11 | Append-only; every phase does this. |

**Files this plan explicitly does not open:** anything under `backend/listings/`, `backend/platform_settings/`, `backend/finance/`, `backend/analytics/`, `backend/entitlements/`, `backend/notifications/`, `backend/accounts/`, `backend/professionals/`, `backend/taxonomy/`, `backend/services_catalog/`, `backend/common/` (including `throttling.py`, `ip.py` and `exceptions.py`), `backend/conftest.py`, and `backend/config/urls.py` (Phase 6 already adds `include("messaging.urls")`; `brokers.urls` is already included).

---

## Phase 6 reconciliation required

**Every name in this list is taken from the Phase 6 plan's "Contract summary for later phases" and is NOT verified against merged code, because Phase 6 Tasks 3–15 were not merged when this plan was written.** Verified present on `dev` at merge commit `6dec1e6`: `backend/messaging/{__init__,admin,apps,enums,masking,models}.py`, `migrations/0001_conversation.py`, `migrations/0002_seed_unified_inquiries_flag.py`, `tests/{conftest,factories,test_conversation_model,test_enums,test_masking,test_seed_migration}.py`. Verified **absent**: `views.py`, `serializers.py`, `selectors.py`, `services.py`, `permissions.py`, `exceptions.py`, `pagination.py`, `urls.py`; the `Message` and `ContactAccessGrant` models; `include("messaging.urls")` in `config/urls.py`; and the `messaging_read` / `message_send` throttle scopes in `REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]` (that dict holds six keys today: `taxonomy_search`, `public_listing_read`, `auth`, `auth-refresh`, `services_directory`, `finance_quote`). `masking.py` is **Phase 7's**, not Phase 6's, and nothing in this plan imports it.

**Task 1, Step 0 is a reconciliation gate** that greps each of these out of the merged tree and stops the task if any is missing or differently shaped. If a name drifted, fix this plan's call site — do not rename Phase 6's symbol.

| # | Assumed interface | Used by | If it drifted |
|---|---|---|---|
| 1 | `messaging.views.MessagingAPIView` — turns DRF's `not_authenticated` into `authentication_required` and `throttled` into `rate_limited`. | Task 1 | Extend whatever base Phase 6 shipped; never `APIView` directly (rule 11). |
| 2 | `messaging.views.ConversationScopedView` — `permission_classes = [UnifiedInquiriesEnabled, IsAuthenticated, IsActiveUser]`, `get_conversation(id)` raising `NotFound` for an unauthorised id. | Task 1 | If Phase 6 folded it into `ConversationMessagesView`, extract it in Task 1 and say so in the PR. |
| 3 | `messaging.permissions.UnifiedInquiriesEnabled` — **raises** `FeatureDisabled`, listed first. | Task 1 | — |
| 4 | `messaging.selectors.conversations_visible_to(user)`, `can_view_conversation(user, conversation)`, `annotate_unread(qs, user)` (adds `unread_count`), `annotate_last_message(qs)` (adds `first_sender_name`, `last_message_body`). | Tasks 1, 2 | — |
| 5 | `messaging.serializers.ConversationSerializer` with fields `id, conversation_type, subject, status, last_message_at, created_at, unread_count, context, counterparty_name, last_message_excerpt`, and a `get_context()` returning `{"type","id","label"}`. | Tasks 1, 4 | Task 1 adds `"url"` to `get_context()`; if the method is named differently, add the key wherever the dict is built. |
| 6 | `messaging.serializers.MessageSerializer` → `{id, body, is_system, created_at, read_at, sender: {display_name, is_you}}`. | Task 4 | Adjust `MessageRow` in `lib/api/conversations.ts`. |
| 7 | `messaging.exceptions.ConversationClosed` — 409, `default_code="conversation_closed"`. | Tasks 1, 3, 4 | — |
| 8 | `messaging.enums.ConversationStatus`, `ConversationType`, `UNIFIED_INQUIRIES_FLAG`, `conversation_url()`, `SENDER_CONVERSATION_URL_TEMPLATE = "/dashboard/messages/{conversation_id}/"`. | Tasks 1, 2, 7 | **Merged and verified** (`backend/messaging/enums.py`). Task 7 mounts a real page at that template's path, so the constant stays as-is. |
| 9 | `messaging.models.Message` with `read_at`, `sender`, `conversation`, `is_system`, `sender_name_snapshot`, and `messaging.models.ContactAccessGrant`. **Neither model exists today** — `messaging/models.py` defines only `Conversation`. Phase 6 Task 3 creates both. | Tasks 1, 2, 11 | Task 11's `test_this_phase_added_no_second_message_store` pins the app's model list to exactly these three; if Phase 6 shipped a different set, update that assertion to Phase 6's real set — never add a model to make it pass. |
| 10 | Routes `conversation-list`, `conversation-messages`, `conversation-read` at `/api/v1/conversations/…`, with filters `?status=OPEN\|ARCHIVED\|BLOCKED\|ALL` (default `OPEN`), `?unread=true`, repeated `?type=`, `?broker=<uuid>`. Reached through `path("api/v1/", include("messaging.urls"))` in `config/urls.py`, which Phase 6 Task 7 adds and which is **not there today**. | Tasks 1, 2, 4 | Task 4's query-string tests are the tripwire. |
| 10a | `messaging.pagination.ConversationPagination` (`page_size=20`, `page_size_query_param="page_size"`, `max_page_size=100`) — in **`messaging/pagination.py`**, its own module, not in `views.py`. | Task 1 | Import it from `messaging.pagination`; the earlier draft of this table wrongly implied `views.py`. |
| 11 | Throttle scopes `messaging_read` (120/min) and `message_send` (60/hour) in `DEFAULT_THROTTLE_RATES`. **Neither is there today** — Phase 6 Tasks 7 and 10 append them. This plan's two views reuse `messaging_read` and add `conversation_status` and `broker_dashboard`. | Tasks 1, 2 | A view whose `throttle_scope` names a key absent from `DEFAULT_THROTTLE_RATES` raises at request time, so Step 0 checks the key, not just the file. |
| 12 | `messaging/tests/factories.py` exports `make_message(conversation=…, sender=…, body=…)` alongside the already-merged `make_conversation`. | Tasks 1, 2, 11 | If the kwargs differ, adapt this plan's tests; do not add a second factory. |
| 13 | `frontend/src/lib/i18n/inquiry.ts` exports `INQUIRY_MESSAGES` and may contain `inquiry.sender_unnamed`. | Task 3 | Task 3 ships `messages.sender_unnamed`. **If `inquiry.sender_unnamed` exists in `INQUIRY_MESSAGES`, delete ours and import `tInquiry` instead** — spec §37 must not carry two keys for one string. |
| 14 | `frontend/src/lib/api/inquiries.ts` exports `fetchInquiryConfig()` returning `{ enabled: boolean, … }`. | Task 9 | Broker home uses `dashboard.messages.enabled` from Task 2's own endpoint instead, so this is a fallback only. |

**Phase 12 assumed interfaces** (Tasks 6–10 in flight; Tasks 1–5 merged and verified):

| # | Interface | Status | Used by |
|---|---|---|---|
| A | `brokers.selectors.broker_listing_counts(broker) -> {"by_status": {…}, "total": int}` | **Verified merged** (`backend/brokers/selectors.py:24`) | Task 2 |
| B | `brokers.selectors.pending_revision_count(broker) -> int` | **Verified merged** (`backend/brokers/selectors.py:47`) | Task 2 |
| C | `frontend/src/app/dashboard/staff/brokers/[brokerId]/page.tsx` exists (Phase 12 Task 7) | **Assumed** | Task 8's nav only — if it has not landed, omit that nav entry rather than linking to a 404. |
| D | `brokers/urls.py` gains `staff/brokers/<id>/pending-approvals/` (Phase 12 Task 6) | **Assumed** | Task 2 appends below it; a rebase, not a conflict. |

---

## Scope rulings

Where spec §28 is silent, ambiguous or in tension with another section, the ruling is made once here so no task has to guess.

**Ruling 1 — spec §28's "Remove" section has nothing to remove, and the plan says so rather than pretending otherwise.** `rg -i surveyor` over `frontend/src` and `backend` returns exactly one hit today: the string `"Phase6 Surveyors"` inside `backend/messaging/tests/test_conversation_model.py:47`, a professional profile's display name in a Phase 6 unit test. There is no `Services & Surveyors` navigation item, no broker dashboard, no `/dashboard/broker/services/` route, no service/survey metric and no permission for any of it — `frontend/src/app/` contains only `403`, `health`, `login`, `professionals/profile`, `services`, `verify-email`, `layout.tsx`, `page.tsx` and `sitemap.ts`. §28's "Remove" list describes the **Stitch static prototype** that `ACTIVITY.md` records as the visual reference, not this repository. So this phase implements the removal as **two durable guarantees instead of a deletion**: (a) the 301 in Task 10, which spec §4.3 requires whether or not the old page ever existed here, and (b) a nav test in Task 8 that pins the broker navigation's link set **exactly**, so the item can never be added. Task 10 Step 1 re-runs the `rg` sweep as evidence, not as a claim.

**Ruling 2 — two routes, because there are two seats; `SENDER_CONVERSATION_URL_TEMPLATE` keeps its value, and Phase 6's in-code comment about it is wrong on its premise.**

The comment in question, `backend/messaging/enums.py:101-103` (merged, verbatim):

> `# Spec 15.5's next_url. One constant, because spec 4.2 names /messages/ and`
> `# spec 28 names /dashboard/broker/messages/ for the same destination - the`
> `# phase that finally builds the page changes this line and nothing else.`

**The premise "for the same destination" is false**, and the three spec passages do not actually conflict once you ask *whose screen each one names*:

- **§15.5** (line 1104) fixes `"next_url": "/dashboard/messages/<conversation-id>/"` as a literal JSON value in the response to `POST /api/v1/inquiries/`. That response goes to the person who **sent** the inquiry. Per §5's capability table the sender is any authenticated account — typically a **buyer**, and §4.2 has **no row for a buyer at all**. There is no role-prefixed dashboard to put a buyer's conversation under, which is precisely why §15.5's path carries no role segment.
- **§28** (line 1918) fixes `/dashboard/broker/messages/` as the **recipient broker's** screen, and §4.2 (line 176) repeats it for the 301.
- **§4.2**'s `/messages/` cells are role-prefixed shorthand, exactly like the Staff row's `/boats/` and `/users/`, which §26.1 writes out in full as `/dashboard/staff/...` and which Phase 12 already built as `/dashboard/staff/brokers/<id>/`.

So §15.5 and §28 name **two different seats on the same conversation**, not one destination spelled two ways. A single constant cannot serve both, and changing it to `/dashboard/broker/messages/` would send every buyer to a broker screen they have no membership for.

**Decision:** this phase builds `/dashboard/broker/messages/…` for brokers (§28's literal path) **and** `/dashboard/messages/…` as the sender-side, role-neutral path (§15.5's literal path), from the same components. `SENDER_CONVERSATION_URL_TEMPLATE` is **not changed**, so `backend/messaging/tests/test_enums.py:108` and `:113` — the two merged assertions that pin its value, found by `rg -n SENDER_CONVERSATION_URL_TEMPLATE backend/` — stay green and untouched. Phase 6 Known Limitation 2 ("`next_url` points at a page that does not exist") is closed by Task 7, not by editing the constant. The stale comment is a Phase 6 file; **Task 1 Step 6 corrects it in this phase's own diff**, since leaving a merged comment that instructs the next reader to change a line we deliberately kept is how the line gets changed by accident later.

**Ruling 3 — the broker dashboard navigation contains exactly two entries: Dashboard and Messages.** Spec §4.2's broker row also lists `/fleet/`, `/leads/`, `/team/`, `/profile/` and `/subscription/`. None of those pages exists and none is in this phase's scope (Phases 16, 17 and 20 own them). Spec §39 and §2.1 forbid shipping a control that leads nowhere.

**Correction to an earlier draft of this ruling, which cited a precedent that does not exist.** `PrimaryNav.test.tsx:80` is titled *"links to no page that does not exist yet"*, but it asserts only the absence of `Sell` and `Fleet`. The component itself (`frontend/src/components/layout/PrimaryNav.tsx:15-32`) links to `/boats/`, `/brokers/`, `/services/professionals/`, `/financing/`, `/dashboard/staff/`, `/settings/` and `/account/`, and of those **only `/services/professionals/` has a page** — `frontend/src/app/` contains `403`, `health`, `login`, `professionals/profile`, `services`, `verify-email`, `layout.tsx`, `page.tsx` and `sitemap.ts` and nothing else. So the project's actual practice is the opposite of the precedent that was claimed. The ruling stands on spec §39 and §2.1 alone, and on the narrower point that this phase is *authoring* this navigation now, so it has no legacy to preserve. PrimaryNav's six dead links are pre-existing, out of this phase's scope, and recorded as Known Limitation 16 for Phase 20, which builds most of those pages.

Task 8's nav test pins the set to exactly these two. Phase 12's staff broker screen is **not** linked from here — it is a staff screen, and Phase 12's own contract rule 8 assigns its navigation to Phase 17.

**Ruling 4 — spec §28's "Archived" filter gets a producer, because a filter for an unreachable state is a decoration.** Phase 6 modelled and constrained `ConversationStatus.ARCHIVED` but shipped nothing that writes it (its Known Limitation 9, which assigns the affordance to this phase). Task 1 adds `PATCH /api/v1/conversations/<id>/status/`, restricted to `OPEN ↔ ARCHIVED`. **`BLOCKED` is deliberately unreachable from this endpoint**: spec §36.6 makes blocking a moderation act with contact-revocation consequences, and `ContactAccessGrant.revoked_at` is Phase 7's column — an inbox toggle that silently revokes somebody's contact access is not an inbox toggle. Blocking stays unbuilt and stays in Known Limitations.

**Ruling 5 — archiving is per-conversation (spec §11.8 gives `Conversation` one `status` column), and *because* of that only the RECIPIENT side may archive.**

The one-column fact is not negotiable: a per-participant archive flag is a table §11.8 does not define and §28 does not ask for. But a shared column plus an unrestricted control is an abuse vector, and an earlier draft of this plan shipped exactly that. Concretely: a buyer sends an inquiry to a brokerage, then archives the thread. The brokerage's default inbox is `status=OPEN`, so the lead **disappears from the broker's screen** — the one screen spec §28 exists to build — and the buyer, not the broker, decided that. Spec §36.6 ("Contact access and abuse") is the section this falls under, and spec §2.2 ("Server authority") is what makes it the server's job to refuse rather than the UI's to hide.

**Decision:** `set_conversation_status` refuses when `actor.pk == conversation.initiator_id`, with the named code `conversation_filing_forbidden` (403). Filing a conversation is a property of the inbox that *received* it. `ConversationSerializer` grows a `viewer_is_initiator` boolean so the control's visibility has a backend source (spec §2.1) instead of the client guessing, and `ConversationThread` renders no archive button when it is true.

**What this costs, stated plainly:** a sender cannot file their own inbox at all. That is the honest price of one shared `status` column, it is strictly better than the alternative (letting a sender hide a broker's live lead), and the real fix — a per-participant flag — needs an amendment to §11.8. Known Limitation 1 records both halves.

**Ruling 6 — unread counts are per-recipient-side, not per-team-member, for the same reason.** Spec §11.8 gives `Message` one nullable `read_at` (Phase 6 Known Limitation 7). Broker member A opening a thread marks it read for member B as well. A per-member badge needs a `MessageRead` join table §11.8 does not define. The UI therefore labels the count as the conversation's unread count, never "your unread", and Known Limitation 3 records it.

**Ruling 7 — "new inquiries" is defined as a 7-day window, computed on the server and named on the wire.** Spec §28 lists "new inquiries" among the permitted metrics without defining "new". The constant is `brokers.dashboard.NEW_INQUIRY_WINDOW_DAYS = 7`, the JSON field is **`new_inquiries_7d`**, and the localized label says "last 7 days". Naming the window on the wire is what stops the screen from labelling the number with a period the backend did not compute (spec §2.1).

**Ruling 8 — the broker dashboard endpoint is not flag-gated; its messaging block is.** `unified_inquiries` is Phase 6's flag over the inquiry/conversation surfaces. Broker home's listing metrics come from Phase 11/12 state and have nothing to do with it. So `GET /api/v1/brokers/<id>/dashboard/` always answers 200 for a member, and its `messages` block reports `{"enabled": false, "can_read": false, "unread_conversations": null, …}` when the flag is off, which the screen renders as a hidden tile group rather than a broken page. Spec §35.1's warning runs the other way — *"Do not leave an enabled API behind a disabled UI"* — and every messaging **mutation** stays behind Phase 6's gate. Because this view has no flag gate, Phase 6 contract rule 11a does not apply to it and `IsAuthenticated` is listed first.

**Ruling 9 — the thread's "listing/profile link" ships for professionals only, and the backend still returns every derivable URL.** Spec §28's thread wants a listing/profile link. Three facts, each verified: `BoatListing` has **no slug column** (`backend/listings/models.py:35-95`) while spec §4.1's canonical boat URL is `/boats/<listing-slug>/`; `frontend/src/app/` has **no `/boats/` route**; and it has **no `/brokers/` route** either. So Task 1 has the backend return a truthful canonical `url` for BROKER (`/brokers/<slug>/`) and PROFESSIONAL (`/services/professionals/<slug>/`) and `null` for LISTING and SUPPORT, and Task 6 keeps a **one-line allowlist of route prefixes that exist today** (`/services/professionals/`) so the component never renders a link to a 404. Phase 20, which builds `/boats/` and `/brokers/`, deletes that allowlist line. Each layer is honest about what it actually knows.

**On the inconsistency with `PrimaryNav`, which links to six pages that do not exist** (ruling 3's correction): this plan does **not** reach into `PrimaryNav` to fix it, and the two are therefore inconsistent until Phase 20. That is a deliberate scope call, not an oversight, and the asymmetry has a reason worth stating: a dead nav link reads as "coming soon" and costs a back button, whereas a dead link *on the boat the conversation is about*, inside a thread where the whole point is to look at that boat, reads as a broken product. Where this plan authors the surface (the thread, the broker nav) it holds the line; where it does not, it records the gap (Known Limitation 16) rather than silently widening its own diff into a merged Phase 3 component.

**Ruling 10 — no staff read path, following Phase 6's ruling exactly.** `accounts.services.can_read_broker_messages()` returns `True` for any staff moderator *before* it looks at a membership, and Phase 6 deliberately did not use that shortcut in `can_view_conversation()`. Task 2's `IsBrokerMember` matches: a staff moderator with no membership gets `403 not_broker_member` on a broker's dashboard. Staff already have Phase 12's `GET /api/v1/staff/brokers/<id>/`, which spec §21 specifies with a screen in front of it. If this is ever judged wrong, the fix is one branch in `IsBrokerMember` **and** the matching branch in `messaging.selectors.can_view_conversation` — they must change together or a list will show a row a detail view refuses.

**Ruling 11 — no WebSocket, no live polling.** Spec §27.2's real-time layer is Phase 18's. The inbox refetches on filter change, on navigation and after a mutation, and the thread refetches after a reply. No `setInterval`. A polling loop here would be a second, undisclosed load source on `messaging_read`'s 120/min bucket and would be ripped out by Phase 18 anyway.

**Ruling 12 — no `Idempotency-Key` on this phase's two mutations.** Spec §30.3 requires it for Checkout creation, listing submit and staff decisions. Archiving is idempotent by construction (`set_conversation_status` returns early when the status already matches) and the dashboard endpoint is a read.

**Ruling 13 — the dashboard routes are guarded by `RequirePermission` with *no* permission, and the `permission` prop becomes optional to allow it.**

Phase 3 shipped `frontend/src/components/auth/RequirePermission.tsx`, which does two things: redirect an unauthenticated visitor to `/login?next=<safeNextUrl(pathname)>`, and show `ForbiddenScreen` when `can(permission)` is false. An earlier draft of this plan used neither, so a guest landing on `/dashboard/messages/` got a dead-end sentence instead of the sign-in flow every other private route in this project uses.

The obvious fix — pass a `PermissionKey` — does not work, and the reason matters. `PermissionKey` (`frontend/src/lib/auth/types.ts:1-13`) is exactly spec §5's capability table, and **§5 has no row for reading conversations**; `can_read_messages` is defined in §11.1 as a `BrokerMembership` column, and `accounts/selectors.py:33-53` correctly does not surface it as a permission. The nearest candidate, `submit_inquiry`, evaluates to `verified` (`accounts/selectors.py:38`), so using it would show `ForbiddenScreen` to a broker member with an unverified email who has perfectly readable conversations — a client-side authorization rule the server does not hold, which spec §2.2 forbids.

**Decision:** make `permission` optional — `permission?: PermissionKey`, with `const allowed = permission === undefined || can(permission)`. Backwards compatible (every existing caller passes one, and every existing test keeps passing), one line of behaviour, and it gives this project a reusable "signed-in only" guard it was missing. All four of this phase's dashboard routes wrap their screen in `<RequirePermission>` with no permission; **the authorization that matters stays on the server**, where `conversations_visible_to` and `IsBrokerMember` already enforce `can_read_messages` and membership. A member of the wrong organization sees an empty inbox and a 403 with a specific message (ruling 15), not a client-side guess.

**Ruling 14 — Phase 19 adds `GET /api/v1/conversations/<id>/`, because the thread screen cannot be correct without it.**

Phase 6 shipped the inbox and the thread but no conversation detail, so an earlier draft of this plan found a thread's row by scanning `fetchConversations("ALL", {})`. `ConversationPagination.page_size` is 20, so **a broker opening their 21st conversation would have seen "This conversation is not available."** — a data-dependent bug that no test with a handful of fixtures would ever catch, on the exact screen this phase exists to build. Paging the whole inbox client-side to find one row would be worse.

**Decision:** Task 1 ships it, in the file it is already opening. It is a `ConversationScopedView` subclass, so it inherits the flag gate first (rule 11a), `can_view_conversation`, and 404-not-403; it returns `ConversationSerializer` read through the same annotated, visibility-scoped queryset the list uses, so the two can never disagree; it carries `throttle_scope = "messaging_read"`, Phase 6's existing read scope. Flagged in the Contract summary as a §30.1 addition, on the same footing as Phase 6's own four.

**Ruling 15 — a SUSPENDED brokerage's member gets a specific, translated explanation, and Phase 3's selector is not touched.**

`accounts/selectors.py:63-65` returns every `is_active=True` membership **regardless of the organization's status**, while `accounts/services.py:150-159`'s `active_broker_membership` requires `broker__status=ACTIVE`. Both are right for their own job — the session payload describes what the account *is*, the capability helper decides what it may *do* — but together they mean a member of a SUSPENDED brokerage sees the Messages nav, opens it, and gets a 403 their screen would render as "Something went wrong."

**Decision:** do not change Phase 3's selector (it feeds screens this phase cannot see, and narrowing it would silently remove a suspended brokerage from every other consumer). Instead `not_broker_member` joins the client's known-code list with its own EN/IT/ES copy naming the two real causes — the organization is suspended, or the membership was removed — so the screen tells the truth. Tested in Tasks 5 and 10 and recorded as Known Limitation 15.

---

## File Structure

```
nautelo/
├── ACTIVITY.md                                                      (modify: Task 11)
├── docs/superpowers/PHASE-TRACKER.md                                (modify: Task 11)
├── docs/superpowers/plans/2026-09-18-phase-19-broker-dashboard-messages.md   (this file)
├── backend/
│   ├── config/settings/base.py            (modify: Tasks 1, 2 — one throttle rate each)
│   ├── messaging/
│   │   ├── enums.py                       (modify: Task 1 — one stale comment, ruling 2)
│   │   ├── exceptions.py                  (append: Task 1 — three APIException subclasses)
│   │   ├── services.py                    (append: Task 1 — set_conversation_status)
│   │   ├── serializers.py                 (append + two additive edits: Task 1)
│   │   ├── views.py                       (append: Task 1 — ConversationDetailView, ConversationStatusView)
│   │   ├── urls.py                        (append: Task 1 — two routes)
│   │   └── tests/
│   │       ├── test_conversation_detail_api.py                      (new: Task 1)
│   │       └── test_conversation_status_api.py                      (new: Task 1)
│   └── brokers/
│       ├── permissions.py                 (new: Task 2 — IsBrokerMember)
│       ├── dashboard.py                   (new: Task 2 — the metric selectors)
│       ├── views.py                       (append: Task 2 — BrokerDashboardView)
│       ├── urls.py                        (append: Task 2 — one route)
│       └── tests/
│           ├── conftest.py                                          (new: Task 2 — named-key cache fixture)
│           ├── test_broker_dashboard_api.py                         (new: Task 2)
│           └── test_phase_19_acceptance.py                          (new: Task 11)
└── frontend/
    ├── next.config.ts                     (modify: Task 10 — one redirect)
    ├── next.config.test.ts                (modify: Task 10 — count 2 → 3)
    └── src/
        ├── app/dashboard/
        │   ├── messages/
        │   │   ├── page.tsx + page.test.tsx                         (new: Task 7)
        │   │   └── [conversationId]/page.tsx + page.test.tsx        (new: Task 7)
        │   └── broker/
        │       ├── page.tsx + page.test.tsx                         (new: Task 9)
        │       ├── layout.tsx                                       (new: Task 8)
        │       └── messages/
        │           ├── page.tsx + page.test.tsx                     (new: Task 8)
        │           └── [conversationId]/page.tsx + page.test.tsx    (new: Task 8)
        ├── components/
        │   ├── auth/RequirePermission.tsx + .test.tsx               (modify: Task 7 — optional prop, ruling 13)
        │   ├── layout/PrimaryNav.tsx + .test.tsx                    (modify: Task 8)
        │   ├── broker/
        │   │   ├── BrokerDashboardNav.tsx + .test.tsx               (new: Task 8)
        │   │   └── BrokerMetrics.tsx + .test.tsx                    (new: Task 9)
        │   └── messages/
        │       ├── ConversationFilters.tsx + .test.tsx              (new: Task 5)
        │       ├── ConversationRow.tsx + .test.tsx                  (new: Task 5)
        │       ├── ConversationList.tsx + .test.tsx                 (new: Task 5)
        │       ├── ConversationContextPanel.tsx + .test.tsx         (new: Task 6)
        │       ├── ReplyComposer.tsx + .test.tsx                    (new: Task 6)
        │       ├── ConversationThread.tsx + .test.tsx               (new: Task 6)
        │       ├── MessagesScreen.tsx + .test.tsx                   (new: Task 7)
        │       └── ThreadScreen.tsx + .test.tsx                     (new: Task 7)
        └── lib/
            ├── api/conversations.ts + conversations.test.ts         (new: Task 4)
            └── i18n/conversations.ts + conversations.test.ts        (new: Task 3)
```

Responsibilities, so the decomposition is not just a list:

- **`lib/i18n/conversations.ts`** — the only place an EN/IT/ES string for this phase lives. No component holds copy.
- **`lib/api/conversations.ts`** — the only place a `/api/v1/conversations/…` or broker-dashboard URL is built. Components never call `apiFetch` directly, so the query-string mapping of spec §28's five filters is unit-testable without rendering anything.
- **`components/messages/*`** — role-neutral. Nothing in this directory imports a broker concept; scoping is a `brokerId` prop that becomes `?broker=`. This is what makes the same files serve both routes (§28 DoD).
- **`components/broker/*`** — broker chrome only: navigation and metric tiles.
- **`app/dashboard/**`** — thin: await params, render one screen component, nothing else.

---

### Task 1: The three messaging extensions spec §28 needs — detail, context URL, and a producer for `ARCHIVED`

**Files:**
- Modify (append): `backend/messaging/exceptions.py`, `backend/messaging/services.py`, `backend/messaging/views.py`, `backend/messaging/urls.py`
- Modify (two additive edits + append): `backend/messaging/serializers.py`
- Modify (one stale comment): `backend/messaging/enums.py`
- Modify (append one line): `backend/config/settings/base.py`
- Test: `backend/messaging/tests/test_conversation_detail_api.py`, `backend/messaging/tests/test_conversation_status_api.py`

**Why these three ship as one task.** They are not three features; they are the three places Phase 6's read surface is one step short of what spec §28 asks for, and all three land in the same four files and the same serializer. `get_context()` in particular would otherwise be edited by two tasks in a row, which is a guaranteed rebase of one task onto the other for no review benefit. A reviewer rejecting any one of them rejects the same diff hunk neighbourhood, so there is nothing to gain by splitting.

**Interfaces:**
- Consumes: `messaging.enums.ConversationStatus`; `messaging.models.Conversation`; `messaging.exceptions.ConversationClosed`; `messaging.views.MessagingAPIView`, `ConversationScopedView`; `messaging.selectors.annotate_last_message`, `annotate_unread`, `conversations_visible_to`; `messaging.serializers.ConversationSerializer`; `messaging.pagination.ConversationPagination` (in `messaging/pagination.py`, its own module); `messaging.tests.factories.make_conversation`, `make_message`; the merged `unified_inquiries_disabled` fixture in `messaging/tests/conftest.py`.
- Produces:
  - `messaging.exceptions.InvalidConversationStatus` — `APIException`, 400, `default_code="invalid_conversation_status"`
  - `messaging.exceptions.ConversationSuperseded` — `APIException`, 409, `default_code="conversation_superseded"`
  - `messaging.exceptions.ConversationFilingForbidden` — `APIException`, 403, `default_code="conversation_filing_forbidden"`
  - `messaging.services.ARCHIVABLE_STATUSES: frozenset[str]`
  - `messaging.services.set_conversation_status(*, actor, conversation, new_status: str) -> Conversation`
  - `messaging.serializers.ConversationStatusSerializer` (one field: `status`)
  - `ConversationSerializer` gains a **`viewer_is_initiator: bool`** field; its `get_context()` gains a **`"url": str | None`** key
  - `messaging.views.ConversationDetailView` (route name `conversation-detail`), `messaging.views.ConversationStatusView` (route name `conversation-status`)
  - throttle scope `conversation_status` = `120/hour`

- [ ] **Step 0: Reconciliation gate — machine-checked, and it fails the task**

This is not advisory. Every module below is one Phase 6 task's output, and this task appends to all of them. Run from the worktree root:

```bash
cd backend
python - <<'PY'
import pathlib, re, sys

FILE_NEEDLES = {
  "messaging/views.py": ["class MessagingAPIView", "class ConversationScopedView",
                         "class ConversationMessagesView", "class ConversationListView"],
  "messaging/selectors.py": ["def conversations_visible_to", "def can_view_conversation",
                             "def annotate_unread", "def annotate_last_message"],
  # `def _viewer` because Step 4c's get_viewer_is_initiator calls it; if Phase 6
  # spelled that helper differently, this task's new method must follow suit
  # rather than introduce a second way to read the request user.
  "messaging/serializers.py": ["class ConversationSerializer", "class MessageSerializer",
                               "def get_context", "def _viewer"],
  "messaging/services.py": ["def post_reply", "def mark_conversation_read"],
  "messaging/exceptions.py": ["class ConversationClosed"],
  "messaging/permissions.py": ["class UnifiedInquiriesEnabled"],
  "messaging/pagination.py": ["class ConversationPagination"],
  "messaging/urls.py": ["conversation-list", "conversation-messages", "conversation-read"],
  "messaging/models.py": ["class Conversation", "class Message", "class ContactAccessGrant"],
  "messaging/tests/factories.py": ["def make_message"],
  "config/urls.py": ['include("messaging.urls")'],
  "brokers/selectors.py": ["def broker_listing_counts", "def pending_revision_count"],
  "brokers/moderation.py": ["def bulk_approve_pending_broker_revisions"],
}
missing = []
for path, needles in FILE_NEEDLES.items():
    target = pathlib.Path(path)
    text = target.read_text(encoding="utf-8") if target.exists() else ""
    for needle in needles:
        if needle not in text:
            missing.append(f"{path}: {needle}")

# Throttle SCOPES, not just the file: a view whose throttle_scope names a key
# absent from DEFAULT_THROTTLE_RATES raises at request time.
settings_text = pathlib.Path("config/settings/base.py").read_text(encoding="utf-8")
for scope in ("messaging_read", "message_send", "inquiry_submit"):
    if f'"{scope}"' not in settings_text:
        missing.append(f"config/settings/base.py: DEFAULT_THROTTLE_RATES[{scope!r}]")

print("ALL PRESENT" if not missing else "MISSING:")
for item in missing:
    print(" -", item)
sys.exit(1 if missing else 0)
PY
```

Expected: `ALL PRESENT`, exit 0.

**If anything is missing, STOP and do not start the task.** As of this plan's revision (merge commit `6dec1e6`) this gate **fails**: `messaging/` has no `views.py`, `serializers.py`, `selectors.py`, `services.py`, `permissions.py`, `exceptions.py`, `pagination.py` or `urls.py`; `messaging/models.py` defines only `Conversation`; `config/urls.py` has no messaging include; and none of the three throttle scopes exists. That is the expected state until Phase 6 Tasks 3–10 merge — the gate exists to make "Phase 6 is ready" a fact somebody checked rather than a date somebody assumed. Report which names are missing; the controller decides whether to wait or amend this plan's call sites. Never rename a Phase 6 symbol to satisfy this gate.

- [ ] **Step 1: Write the failing detail-endpoint test**

`backend/messaging/tests/test_conversation_detail_api.py`:

```python
"""GET /api/v1/conversations/<id>/ — the endpoint the thread screen reads.

Phase 6 shipped the inbox and the thread but no conversation detail, so a
client wanting one thread's subject, status and context had to scan the inbox.
ConversationPagination.page_size is 20, which makes that approach silently wrong
for anyone with 21 conversations — see the plan's ruling 14. This module is the
endpoint's contract, including the cross-broker negative cases spec 33.1
requires of every conversation-addressed route.
"""

import uuid

import pytest
from django.contrib.auth.models import Group
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
    """Two unrelated brokerages, one asker, one reader in each.

    Every slug, name and address is phase19-prefixed: make_broker defaults to
    "blue-marine-brokers", make_professional to "marine-survey-co" and make_user
    to "user@example.com", all of which other packages' tests already take.
    """
    asker = make_user(email="detail-asker@phase19.example", full_name="Ada Rossi")
    broker_a = make_broker(name="Phase19 Detail Alpha", slug="phase19-detail-alpha")
    broker_b = make_broker(name="Phase19 Detail Beta", slug="phase19-detail-beta")
    reader_a = make_user(email="detail-reader-a@phase19.example")
    reader_b = make_user(email="detail-reader-b@phase19.example")
    agent_a = make_user(email="detail-agent-a@phase19.example")
    make_membership(
        reader_a, broker_a, role=BrokerMembershipRole.MANAGER, can_read_messages=True
    )
    make_membership(
        reader_b, broker_b, role=BrokerMembershipRole.MANAGER, can_read_messages=True
    )
    make_membership(
        agent_a, broker_a, role=BrokerMembershipRole.AGENT, can_edit_listings=True
    )

    thread = make_conversation(
        initiator=asker,
        conversation_type=ConversationType.BROKER_INQUIRY,
        broker=broker_a,
        subject="Alpha fleet question",
    )
    message = make_message(conversation=thread, sender=asker)
    thread.last_message_at = message.created_at
    thread.save(update_fields=["last_message_at", "updated_at"])
    return {
        "asker": asker,
        "broker_a": broker_a,
        "broker_b": broker_b,
        "reader_a": reader_a,
        "reader_b": reader_b,
        "agent_a": agent_a,
        "thread": thread,
    }


def url_for(conversation):
    return reverse("conversation-detail", args=[conversation.pk])


def make_moderator(email):
    """A REAL staff moderator.

    accounts.services.is_staff_moderator (accounts/services.py:122-126) requires
    BOTH primary_role == STAFF AND membership of the staff_moderator or
    staff_admin group. A make_user(role=UserRole.STAFF) with no group is not a
    moderator at all, so a test that only sets the role proves nothing about the
    staff branch it claims to exercise. The Group rows are re-seeded for every
    test by messaging/tests/conftest.py's `_messaging_reference_rows` fixture.
    """
    moderator = make_user(email=email, role=UserRole.STAFF)
    moderator.groups.add(Group.objects.get(name=StaffGroup.MODERATOR))
    return moderator


def test_a_guest_gets_401_authentication_required(api, scene):
    response = api.get(url_for(scene["thread"]))
    assert response.status_code == 401
    assert response.data["error"]["code"] == "authentication_required"


def test_the_flag_off_answer_precedes_every_other_permission(
    api, scene, unified_inquiries_disabled
):
    """Phase 6 contract rule 11a: UnifiedInquiriesEnabled is FIRST, so the flag
    speaks for an anonymous caller too."""
    anonymous = api.get(url_for(scene["thread"]))
    assert anonymous.status_code == 403
    assert anonymous.data["error"]["code"] == "feature_disabled"

    api.force_authenticate(scene["reader_a"])
    signed_in = api.get(url_for(scene["thread"]))
    assert signed_in.status_code == 403
    assert signed_in.data["error"]["code"] == "feature_disabled"


def test_a_broker_reader_gets_the_same_row_the_inbox_returns(api, scene):
    """The point of reading through the inbox's own queryset: the thread screen
    and the list can never disagree about a conversation."""
    api.force_authenticate(scene["reader_a"])
    detail = api.get(url_for(scene["thread"]))
    assert detail.status_code == 200
    row = api.get(reverse("conversation-list")).data["results"][0]
    assert detail.data == row


def test_the_row_carries_every_field_the_thread_screen_reads(api, scene):
    api.force_authenticate(scene["reader_a"])
    data = api.get(url_for(scene["thread"])).data
    assert data["id"] == str(scene["thread"].pk)
    assert data["subject"] == "Alpha fleet question"
    assert data["status"] == ConversationStatus.OPEN
    assert data["conversation_type"] == ConversationType.BROKER_INQUIRY
    assert data["unread_count"] == 1
    assert data["counterparty_name"] == "Ada Rossi"
    assert data["viewer_is_initiator"] is False
    assert data["context"] == {
        "type": "BROKER",
        "id": str(scene["broker_a"].pk),
        "label": "Phase19 Detail Alpha",
        "url": "/brokers/phase19-detail-alpha/",
    }


def test_the_initiator_is_told_they_are_the_initiator(api, scene):
    """Spec 2.1: the archive control's visibility needs a backend source, not a
    client-side guess about who started the thread (ruling 5)."""
    api.force_authenticate(scene["asker"])
    assert api.get(url_for(scene["thread"])).data["viewer_is_initiator"] is True


def test_a_professional_context_carries_its_canonical_url(api, scene):
    owner = make_user(email="detail-pro-owner@phase19.example")
    professional = make_professional(
        owner, display_name="Phase19 Detail Survey", slug="phase19-detail-survey"
    )
    thread = make_conversation(
        initiator=scene["asker"],
        conversation_type=ConversationType.PROFESSIONAL_INQUIRY,
        professional=professional,
        subject="Survey question",
    )
    make_message(conversation=thread, sender=scene["asker"])

    api.force_authenticate(owner)
    assert api.get(url_for(thread)).data["context"]["url"] == (
        "/services/professionals/phase19-detail-survey/"
    )


def test_a_listing_context_has_a_null_url(api, scene):
    """Ruled, not forgotten: BoatListing has no slug column and spec 4.1's
    canonical boat URL is slug-addressed. Phase 20 fills this in."""
    from listings.tests.factories import make_broker_listing

    listing = make_broker_listing(broker=scene["broker_a"], actor=scene["reader_a"])
    thread = make_conversation(
        initiator=scene["asker"],
        conversation_type=ConversationType.LISTING_INQUIRY,
        listing=listing,
        broker=scene["broker_a"],
        subject="Listing question",
    )
    make_message(conversation=thread, sender=scene["asker"])

    api.force_authenticate(scene["asker"])
    assert api.get(url_for(thread)).data["context"]["url"] is None


def test_another_brokers_reader_gets_404_never_403(api, scene):
    """Spec 33.1 IDOR: a 403 would confirm this conversation id exists."""
    api.force_authenticate(scene["reader_b"])
    assert api.get(url_for(scene["thread"])).status_code == 404


def test_an_agent_without_can_read_messages_gets_404(api, scene):
    api.force_authenticate(scene["agent_a"])
    assert api.get(url_for(scene["thread"])).status_code == 404


def test_a_real_staff_moderator_gets_404_too(api, scene):
    """Ruling 10 / Phase 6's Task 9 ruling: no staff messaging read path.

    The moderator below is a REAL one — see make_moderator — and the positive
    control underneath proves it, so this 404 is evidence about messaging
    authorization rather than an accident of an under-built fixture.
    """
    moderator = make_moderator("detail-moderator@phase19.example")
    api.force_authenticate(moderator)
    assert api.get(url_for(scene["thread"])).status_code == 404


def test_the_same_moderator_can_reach_a_staff_only_endpoint(api, scene):
    """Positive control for the test above.

    Phase 12's GET /api/v1/staff/brokers/<id>/ is IsStaffModerator-gated. If this
    ever fails, the 404 above is telling us the fixture is not really a
    moderator, not that messaging refuses moderators — which is exactly the
    vacuous test this pair exists to prevent.
    """
    moderator = make_moderator("detail-moderator-control@phase19.example")
    api.force_authenticate(moderator)
    response = api.get(reverse("staff-broker-detail", args=[scene["broker_a"].pk]))
    assert response.status_code == 200
    assert response.data["slug"] == "phase19-detail-alpha"


def test_an_unknown_id_is_404_and_indistinguishable_from_a_forbidden_one(api, scene):
    api.force_authenticate(scene["reader_a"])
    assert api.get(reverse("conversation-detail", args=[uuid.uuid4()])).status_code == 404


def test_no_contact_value_appears_in_the_detail_payload(api, scene):
    """Phase 6 contract rule 3: a conversation row carries no contact value of
    any kind. Contact reveal is Phase 7's own endpoint, after a grant."""
    api.force_authenticate(scene["reader_a"])
    rendered = api.get(url_for(scene["thread"])).content.decode()
    assert scene["broker_a"].public_email not in rendered
    assert scene["broker_a"].public_phone not in rendered
    assert scene["asker"].email not in rendered
```

- [ ] **Step 2: Write the failing status-endpoint test**

`backend/messaging/tests/test_conversation_status_api.py`:

```python
"""PATCH /api/v1/conversations/<id>/status/ — the producer spec 28's "Archived"
filter needs.

Spec 28 lists Archived among the five filters the broker inbox must offer. Phase
6 modelled and constrained ConversationStatus.ARCHIVED but shipped nothing that
writes it, so the filter existed with no way to reach the state.

Filing is RECIPIENT-SIDE ONLY (the plan's ruling 5). Conversation has one status
column (spec 11.8), so an initiator who could archive would be hiding a live lead
from the broker's default inbox — the one screen spec 28 exists to build.
"""

import pytest
from django.contrib.auth.models import Group
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from brokers.enums import BrokerMembershipRole
from brokers.tests.factories import make_broker, make_membership
from messaging.enums import ConversationStatus, ConversationType
from messaging.models import Conversation
from messaging.tests.factories import make_conversation, make_message

pytestmark = pytest.mark.django_db


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def scene():
    asker = make_user(email="status-asker@phase19.example", full_name="Ada Rossi")
    broker_a = make_broker(name="Phase19 Status Alpha", slug="phase19-status-alpha")
    broker_b = make_broker(name="Phase19 Status Beta", slug="phase19-status-beta")
    reader_a = make_user(email="status-reader-a@phase19.example")
    reader_b = make_user(email="status-reader-b@phase19.example")
    agent_a = make_user(email="status-agent-a@phase19.example")
    make_membership(
        reader_a, broker_a, role=BrokerMembershipRole.MANAGER, can_read_messages=True
    )
    make_membership(
        reader_b, broker_b, role=BrokerMembershipRole.MANAGER, can_read_messages=True
    )
    make_membership(
        agent_a, broker_a, role=BrokerMembershipRole.AGENT, can_edit_listings=True
    )

    thread = make_conversation(
        initiator=asker,
        conversation_type=ConversationType.BROKER_INQUIRY,
        broker=broker_a,
        subject="Alpha fleet question",
    )
    message = make_message(conversation=thread, sender=asker)
    thread.last_message_at = message.created_at
    thread.save(update_fields=["last_message_at", "updated_at"])
    return {
        "asker": asker,
        "broker_a": broker_a,
        "broker_b": broker_b,
        "reader_a": reader_a,
        "reader_b": reader_b,
        "agent_a": agent_a,
        "thread": thread,
    }


def url_for(conversation):
    return reverse("conversation-status", args=[conversation.pk])


def test_a_guest_gets_401_authentication_required(api, scene):
    response = api.patch(url_for(scene["thread"]), {"status": "ARCHIVED"}, format="json")
    assert response.status_code == 401
    assert response.data["error"]["code"] == "authentication_required"


def test_the_flag_off_answer_precedes_every_other_permission(
    api, scene, unified_inquiries_disabled
):
    anonymous = api.patch(url_for(scene["thread"]), {"status": "ARCHIVED"}, format="json")
    assert anonymous.status_code == 403
    assert anonymous.data["error"]["code"] == "feature_disabled"

    api.force_authenticate(scene["reader_a"])
    signed_in = api.patch(url_for(scene["thread"]), {"status": "ARCHIVED"}, format="json")
    assert signed_in.status_code == 403
    assert signed_in.data["error"]["code"] == "feature_disabled"


def test_a_broker_reader_archives_and_gets_the_updated_row_back(api, scene):
    """Spec 30.2: mutations return the updated resource."""
    api.force_authenticate(scene["reader_a"])
    response = api.patch(url_for(scene["thread"]), {"status": "ARCHIVED"}, format="json")
    assert response.status_code == 200
    assert response.data["status"] == ConversationStatus.ARCHIVED
    assert response.data["id"] == str(scene["thread"].pk)
    assert response.data["unread_count"] == 1
    assert response.data["counterparty_name"] == "Ada Rossi"
    scene["thread"].refresh_from_db()
    assert scene["thread"].status == ConversationStatus.ARCHIVED


def test_the_initiator_may_not_archive_the_recipients_thread(api, scene):
    """Ruling 5, and the reason it exists.

    Conversation has ONE status column (spec 11.8) and the broker's default
    inbox is status=OPEN, so a sender who could archive would remove their own
    live lead from the brokerage's screen. Spec 2.2 puts that refusal on the
    server, not in the UI.
    """
    api.force_authenticate(scene["asker"])
    response = api.patch(url_for(scene["thread"]), {"status": "ARCHIVED"}, format="json")
    assert response.status_code == 403
    assert response.data["error"]["code"] == "conversation_filing_forbidden"
    scene["thread"].refresh_from_db()
    assert scene["thread"].status == ConversationStatus.OPEN


def test_the_initiator_may_not_unarchive_either(api, scene):
    """The same rule in the other direction: an initiator must not be able to
    pull a thread the brokerage filed back into its open inbox."""
    scene["thread"].status = ConversationStatus.ARCHIVED
    scene["thread"].save(update_fields=["status", "updated_at"])
    api.force_authenticate(scene["asker"])
    response = api.patch(url_for(scene["thread"]), {"status": "OPEN"}, format="json")
    assert response.status_code == 403
    assert response.data["error"]["code"] == "conversation_filing_forbidden"


def test_unarchiving_returns_the_thread_to_open(api, scene):
    scene["thread"].status = ConversationStatus.ARCHIVED
    scene["thread"].save(update_fields=["status", "updated_at"])
    api.force_authenticate(scene["reader_a"])
    response = api.patch(url_for(scene["thread"]), {"status": "OPEN"}, format="json")
    assert response.status_code == 200
    assert response.data["status"] == ConversationStatus.OPEN


def test_setting_the_status_it_already_has_is_a_no_op_200(api, scene):
    api.force_authenticate(scene["reader_a"])
    response = api.patch(url_for(scene["thread"]), {"status": "OPEN"}, format="json")
    assert response.status_code == 200
    assert response.data["status"] == ConversationStatus.OPEN


def test_another_brokers_reader_gets_404_never_403(api, scene):
    """Spec 33.1 IDOR. Note the contrast with the initiator's 403 above: the
    initiator may SEE this thread, so hiding its existence would be theatre —
    they are told why. Someone who may not see it is told nothing."""
    api.force_authenticate(scene["reader_b"])
    response = api.patch(url_for(scene["thread"]), {"status": "ARCHIVED"}, format="json")
    assert response.status_code == 404
    scene["thread"].refresh_from_db()
    assert scene["thread"].status == ConversationStatus.OPEN


def test_an_agent_without_can_read_messages_gets_404(api, scene):
    """can_edit_listings must never leak message access (spec 11.1, 28)."""
    api.force_authenticate(scene["agent_a"])
    assert (
        api.patch(url_for(scene["thread"]), {"status": "ARCHIVED"}, format="json").status_code
        == 404
    )


def test_a_real_staff_moderator_gets_404_too(api, scene):
    """A REAL moderator: is_staff_moderator needs primary_role == STAFF AND the
    staff_moderator group (accounts/services.py:122-126). The positive control
    lives in test_conversation_detail_api.py."""
    moderator = make_user(email="status-moderator@phase19.example", role=UserRole.STAFF)
    moderator.groups.add(Group.objects.get(name=StaffGroup.MODERATOR))
    assert moderator.groups.filter(name=StaffGroup.MODERATOR).exists()
    api.force_authenticate(moderator)
    assert (
        api.patch(url_for(scene["thread"]), {"status": "ARCHIVED"}, format="json").status_code
        == 404
    )


def test_blocked_is_refused_with_its_own_named_code(api, scene):
    """Spec 36.6 makes blocking a moderation act with contact-revocation
    consequences; it is not an inbox toggle."""
    api.force_authenticate(scene["reader_a"])
    response = api.patch(url_for(scene["thread"]), {"status": "BLOCKED"}, format="json")
    assert response.status_code == 400
    assert response.data["error"]["code"] == "invalid_conversation_status"


def test_a_missing_status_field_gets_the_same_named_code(api, scene):
    """Phase 6 contract rule 10: this project's envelope collapses every DRF
    ValidationError to code "validation_error" (common/exceptions.py:107-110),
    so the field is declared required=False/allow_blank and the SERVICE names
    the error."""
    api.force_authenticate(scene["reader_a"])
    response = api.patch(url_for(scene["thread"]), {}, format="json")
    assert response.status_code == 400
    assert response.data["error"]["code"] == "invalid_conversation_status"


def test_an_absurdly_long_status_gets_the_named_code_not_validation_error(api, scene):
    """The regression guard for a max_length that used to be on this field.

    A CharField(max_length=20) turns a 21-character body into a DRF
    ValidationError, which the envelope flattens to "validation_error" — so the
    plan's own claim that every invalid status answers with the named code would
    have been false for exactly the input an attacker sends first.
    """
    api.force_authenticate(scene["reader_a"])
    response = api.patch(
        url_for(scene["thread"]), {"status": "A" * 500}, format="json"
    )
    assert response.status_code == 400
    assert response.data["error"]["code"] == "invalid_conversation_status"


def test_a_blocked_thread_cannot_be_reopened(api, scene):
    scene["thread"].status = ConversationStatus.BLOCKED
    scene["thread"].save(update_fields=["status", "updated_at"])
    api.force_authenticate(scene["reader_a"])
    response = api.patch(url_for(scene["thread"]), {"status": "OPEN"}, format="json")
    assert response.status_code == 409
    assert response.data["error"]["code"] == "conversation_closed"


def test_reopening_a_superseded_thread_is_409_not_500(api, scene):
    """Conversation's three unique indexes are PARTIAL on status=OPEN
    (messaging/models.py:111-133), so a newer OPEN thread about the same context
    makes re-opening an archived one a real conflict. Without the savepoint in
    set_conversation_status this fails with a 500 and a
    TransactionManagementError, not a 409."""
    scene["thread"].status = ConversationStatus.ARCHIVED
    scene["thread"].save(update_fields=["status", "updated_at"])
    make_conversation(
        initiator=scene["asker"],
        conversation_type=ConversationType.BROKER_INQUIRY,
        broker=scene["broker_a"],
        subject="Alpha fleet question, again",
    )

    api.force_authenticate(scene["reader_a"])
    response = api.patch(url_for(scene["thread"]), {"status": "OPEN"}, format="json")
    assert response.status_code == 409
    assert response.data["error"]["code"] == "conversation_superseded"
    scene["thread"].refresh_from_db()
    assert scene["thread"].status == ConversationStatus.ARCHIVED


def test_archiving_makes_the_thread_reachable_only_through_the_archived_filter(
    api, scene
):
    """The whole point of this endpoint: spec 28's Archived filter now has a
    producer, and the default OPEN inbox stops showing the row."""
    api.force_authenticate(scene["reader_a"])
    api.patch(url_for(scene["thread"]), {"status": "ARCHIVED"}, format="json")

    assert api.get(reverse("conversation-list")).data["results"] == []
    archived = api.get(reverse("conversation-list"), {"status": "ARCHIVED"}).data
    assert [row["id"] for row in archived["results"]] == [str(scene["thread"].pk)]


def test_no_contact_value_appears_in_the_status_response(api, scene):
    api.force_authenticate(scene["reader_a"])
    rendered = api.patch(
        url_for(scene["thread"]), {"status": "ARCHIVED"}, format="json"
    ).content.decode()
    assert scene["broker_a"].public_email not in rendered
    assert scene["broker_a"].public_phone not in rendered
    assert scene["asker"].email not in rendered


def test_the_write_is_scoped_to_one_row(api, scene):
    """A sibling thread of the same brokerage must not be touched.

    A DIFFERENT initiator, because Conversation's
    `messaging_open_broker_thread_unique` partial index allows exactly one OPEN
    thread per (initiator, broker).
    """
    sibling = make_conversation(
        initiator=make_user(email="status-asker-2@phase19.example"),
        conversation_type=ConversationType.BROKER_INQUIRY,
        broker=scene["broker_a"],
        subject="Another Alpha question",
    )
    api.force_authenticate(scene["reader_a"])
    api.patch(url_for(scene["thread"]), {"status": "ARCHIVED"}, format="json")
    sibling.refresh_from_db()
    assert sibling.status == ConversationStatus.OPEN
    assert Conversation.objects.filter(status=ConversationStatus.ARCHIVED).count() == 1
```

- [ ] **Step 3: Run both tests to verify they fail**

Run: `cd backend && uv run pytest messaging/tests/test_conversation_detail_api.py messaging/tests/test_conversation_status_api.py -v`
Expected: FAIL — `NoReverseMatch: Reverse for 'conversation-detail' not found` and the same for `'conversation-status'`.

- [ ] **Step 4a: Append to `backend/messaging/exceptions.py`**

Consolidate with the module's existing imports (it already imports `APIException` for `ConversationClosed`; add `status` only if it is not already there):

```python
from rest_framework import status
from rest_framework.exceptions import APIException
```

```python
class InvalidConversationStatus(APIException):
    """Spec 28's Archived filter needs a producer; BLOCKED is not one.

    A ChoiceField would have been the obvious way to reject this, and a
    max_length the obvious way to bound it. Both are wrong here: every DRF
    ValidationError collapses to code "validation_error" in
    common.exceptions.nauta_exception_handler (common/exceptions.py:107-110),
    so the named code spec 30.2 asks for would never reach a client — and it
    would fail exactly on the oversized input an attacker sends first. The
    serializer therefore accepts any string of any length and the service
    raises this.
    """

    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "A conversation may only be set to OPEN or ARCHIVED."
    default_code = "invalid_conversation_status"


class ConversationSuperseded(APIException):
    """Re-opening an archived thread collided with a newer open one.

    Conversation's three uniqueness constraints are PARTIAL indexes conditioned
    on status=OPEN (messaging/models.py:111-133), precisely so an archived thread
    does not block a new inquiry. The consequence is that un-archiving is not
    always possible, and that is a 409, not a 500.
    """

    status_code = status.HTTP_409_CONFLICT
    default_detail = "A newer open conversation already exists for this context."
    default_code = "conversation_superseded"


class ConversationFilingForbidden(APIException):
    """Only the RECIPIENT side may file a conversation (the plan's ruling 5).

    Spec 11.8 gives Conversation ONE status column, so archiving is shared. A
    sender who could archive would remove their own live lead from the
    brokerage's default OPEN inbox — the screen spec 28 exists to build. Spec
    2.2 puts that refusal on the server.

    403 rather than 404 on purpose: the initiator MAY see this conversation, so
    pretending it does not exist would be theatre. 404 is reserved for callers
    who may not see it at all.
    """

    status_code = status.HTTP_403_FORBIDDEN
    default_detail = "Only the recipient of a conversation can file it."
    default_code = "conversation_filing_forbidden"
```

- [ ] **Step 4b: Append to `backend/messaging/services.py`**

Add to the module's import section (`transaction` is already imported; `IntegrityError` is the new name):

```python
from django.db import IntegrityError, transaction

from messaging.enums import ConversationStatus
from messaging.exceptions import (
    ConversationClosed,
    ConversationFilingForbidden,
    ConversationSuperseded,
    InvalidConversationStatus,
)
from messaging.models import Conversation
```

```python
#: Spec 28's Archived filter, and nothing else. BLOCKED is deliberately absent:
#: spec 36.6 makes blocking a moderation act that "may revoke access", and
#: ContactAccessGrant.revoked_at is Phase 7's column. An inbox toggle that can
#: silently revoke somebody's contact access is not an inbox toggle.
ARCHIVABLE_STATUSES: frozenset[str] = frozenset(
    {ConversationStatus.OPEN, ConversationStatus.ARCHIVED}
)


@transaction.atomic
def set_conversation_status(*, actor, conversation, new_status: str) -> Conversation:
    """Archive or un-archive a thread (spec 28's Archived filter).

    VISIBILITY is the caller's job — messaging.selectors.can_view_conversation
    decides who may see a thread and the view refuses with 404 before reaching
    here, mirroring post_reply exactly. FILING RIGHTS are this function's job,
    because they are a rule about the conversation rather than about the route,
    and a rule that lives only in a view is the thing spec 3's last paragraph
    forbids.

    Spec 11.8 gives Conversation ONE status column, so archiving is per
    conversation, not per participant. That is why only the recipient side may
    do it: a sender archiving their own inquiry would pull a live lead out of
    the brokerage's default OPEN inbox. See the plan's ruling 5 and Known
    Limitation 2.

    Not audited: spec 2.4's five audited categories are staff actions,
    permission-sensitive status transitions, contact reveals, entitlement
    movements and listing decisions. Filing an inbox is none of them, and Phase 6
    made the same call for post_reply.
    """
    if new_status not in ARCHIVABLE_STATUSES:
        raise InvalidConversationStatus()
    if actor.pk == conversation.initiator_id:
        raise ConversationFilingForbidden()

    locked = Conversation.objects.select_for_update().get(pk=conversation.pk)
    if locked.status == ConversationStatus.BLOCKED:
        # Spec 36.6: blocking "prevents new messages". Un-blocking is a
        # moderation act this phase does not build.
        raise ConversationClosed()
    if locked.status == new_status:
        # Idempotent, which is also why spec 30.3's Idempotency-Key is not
        # required here.
        return locked

    locked.status = new_status
    try:
        # A NESTED atomic block, and it is load-bearing rather than defensive:
        # an IntegrityError marks the enclosing atomic block as needing
        # rollback, so catching it without a savepoint makes the very next query
        # raise TransactionManagementError instead of returning a 409.
        with transaction.atomic():
            locked.save(update_fields=["status", "updated_at"])
    except IntegrityError as exc:
        raise ConversationSuperseded() from exc
    return locked
```

- [ ] **Step 4c: Two additive edits and one append in `backend/messaging/serializers.py`**

**Edit 1 — add one field to `ConversationSerializer`** (beside the existing declared fields; change no existing one):

```python
    viewer_is_initiator = serializers.SerializerMethodField()
```

```python
    def get_viewer_is_initiator(self, conversation) -> bool:
        """Whose seat is this? Spec 2.1: every visible state needs a backend
        source, and the thread's archive control is a visible state — only the
        recipient side may file a conversation (the plan's ruling 5). Without
        this field the client would have to infer the seat from
        `counterparty_name`, which is display text, not authorization data."""
        return conversation.initiator_id == self._viewer().pk
```

**Edit 2 — add the `"url"` key to each of `get_context()`'s four returned dicts**, changing no existing key:

```python
    def get_context(self, conversation) -> dict:
        """Spec 28's "context/listing" for the row, and the thread's
        "listing/profile link".

        `url` is the entity's CANONICAL public URL per spec 4.1, derived here
        because spec 2.1 requires a backend source for every visible state and a
        client must not assemble a slug URL from a label. It is None where no
        canonical URL can be derived:

        * LISTING — `listings.BoatListing` has no slug column, and spec 4.1's
          canonical boat URL is `/boats/<listing-slug>/`. Phase 20 owns the boat
          detail page and fills this in.
        * SUPPORT — there is no public page for a support thread.

        A non-None url does NOT promise the page is built: `/brokers/<slug>/` is
        canonical per spec 4.1 but has no Next.js route yet. The client keeps the
        one-line allowlist of prefixes it can actually navigate to; see the
        plan's ruling 9.
        """
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
                "url": None,
            }
        if conversation.broker_id is not None:
            return {
                "type": "BROKER",
                "id": str(conversation.broker_id),
                "label": conversation.broker.name,
                "url": f"/brokers/{conversation.broker.slug}/",
            }
        if conversation.professional_id is not None:
            return {
                "type": "PROFESSIONAL",
                "id": str(conversation.professional_id),
                "label": conversation.professional.display_name,
                "url": (
                    f"/services/professionals/{conversation.professional.slug}/"
                ),
            }
        return {"type": "SUPPORT", "id": "", "label": "", "url": None}
```

**Append — the status body serializer:**

```python
class ConversationStatusSerializer(serializers.Serializer):
    """Body of PATCH /api/v1/conversations/<id>/status/.

    A plain CharField with a blank default and NO max_length. Both a ChoiceField
    and a length bound would raise DRF ValidationError, which this project's
    envelope collapses to code "validation_error" (Phase 6 contract rule 10) —
    and the length bound would do it for precisely the oversized input that most
    needs a stable code. Letting every value through to
    services.set_conversation_status means a missing, blank, nonsense or
    500-character status all answer with the named `invalid_conversation_status`.
    """

    status = serializers.CharField(required=False, allow_blank=True, default="")
```

**Note for the implementer.** `conversations_visible_to()` already `select_related`s `broker` and `professional`, and `ConversationScopedView.get_conversation()` `select_related`s `professional__owner_user`, so `.slug` on either object costs no extra query. Task 11's N+1 comparison test is the tripwire if that ever changes.

**Note for the task reviewer.** Phase 6's `test_a_row_carries_every_field_spec_28_names` asserts `row["context"] == {...}` with `==`, so **that one Phase 6 test must be updated in this commit** to include `"url"`. Find it with `rg -n '"label": "Phase6' backend/messaging/tests/`. It is the only existing assertion these two edits break; `viewer_is_initiator` is a new key and `==` on the whole row is not something Phase 6's tests do.

- [ ] **Step 4d: Append to `backend/messaging/views.py`**

Add to the module's import section:

```python
from messaging.serializers import ConversationStatusSerializer
from messaging.services import set_conversation_status
```

```python
class ConversationDetailView(ConversationScopedView):
    """GET /api/v1/conversations/<id>/ — one conversation's row.

    An addition beyond spec 30.1's table. Phase 6 shipped the list and the
    thread; without this, a client wanting one thread's subject, status and
    context has to scan the inbox, and `ConversationPagination.page_size` is 20 —
    so that approach is silently wrong for anybody with 21 conversations. See the
    plan's ruling 14.

    Authorization is inherited unchanged from ConversationScopedView: flag gate
    first (Phase 6 contract rule 11a), then authentication, then
    can_view_conversation() with 404 rather than 403 for anything else.
    """

    throttle_scope = "messaging_read"

    def get(self, request, conversation_id):
        self.get_conversation(conversation_id)
        return Response(_annotated_row(request, conversation_id))


class ConversationStatusView(ConversationScopedView):
    """PATCH /api/v1/conversations/<id>/status/ — spec 28's Archived filter.

    An addition beyond spec 30.1's table, for the same reason Phase 6's `read/`
    route is one: spec 28 lists Archived among the five filters the broker inbox
    must offer, and a filter whose state nothing can produce is a control that
    does nothing. Spec 30.1's closing sentence grants the latitude.

    Visibility is inherited from ConversationScopedView (404, never 403). The
    narrower rule — only the recipient side may file — lives in
    services.set_conversation_status, so it holds for every caller and not just
    for this route.
    """

    throttle_scope = "conversation_status"

    def patch(self, request, conversation_id):
        conversation = self.get_conversation(conversation_id)
        payload = ConversationStatusSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        set_conversation_status(
            actor=request.user,
            conversation=conversation,
            new_status=payload.validated_data["status"].strip().upper(),
        )
        # Spec 30.2: "Mutations return updated resource/version".
        return Response(_annotated_row(request, conversation_id))
```

…and the one helper both views share, placed above them:

```python
def _annotated_row(request, conversation_id):
    """One conversation, read through the SAME annotated, visibility-scoped
    queryset the inbox uses.

    Two reasons it is not a second query shaped by hand. First, the row a detail
    view returns and the row the list returned must be byte-for-byte identical
    or the client is holding two representations of one thread — the detail
    test asserts exactly that equality. Second, `ConversationSerializer` reads
    `unread_count`, `first_sender_name` and `last_message_body` off annotations;
    serializing a plain `Conversation` instance would quietly render an
    incomplete row.

    The caller has already run `get_conversation()`, so authorization has
    happened; this re-read cannot widen it — `conversations_visible_to` applies
    the same visibility filter a second time.
    """
    return ConversationSerializer(
        annotate_last_message(
            annotate_unread(conversations_visible_to(request.user), request.user)
        )
        .filter(pk=conversation_id)
        .first(),
        context={"request": request},
    ).data
```

- [ ] **Step 4e: Append the two routes to `backend/messaging/urls.py`**

```python
    path(
        "conversations/<uuid:conversation_id>/",
        ConversationDetailView.as_view(),
        name="conversation-detail",
    ),
    path(
        "conversations/<uuid:conversation_id>/status/",
        ConversationStatusView.as_view(),
        name="conversation-status",
    ),
```

- [ ] **Step 4f: Append one line to `backend/config/settings/base.py`**

Inside `REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]`, **append only** — reorder nothing:

```python
        # Spec 30.4 does not name inbox filing, but this is a write and it sits
        # on an authenticated screen a broker refreshes all day. Looser than
        # `message_send` because archiving reaches nobody and creates nothing;
        # tighter than `messaging_read` because it takes a row lock.
        "conversation_status": "120/hour",
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd backend && uv run pytest messaging/tests/test_conversation_detail_api.py -v`
Expected: PASS — **13 collected test items**.

Run: `cd backend && uv run pytest messaging/tests/test_conversation_status_api.py -v`
Expected: PASS — **18 collected test items**.

Then the whole messaging app, which includes the Phase 6 assertion updated in Step 4c:

Run: `cd backend && uv run pytest messaging -q`
Expected: all pass, 0 failures.

Then prove the footprint outside `messaging/` is the one line this task claims:

Run: `cd backend && git diff --name-only dev -- . ':!messaging'`
Expected: exactly `config/settings/base.py`.

- [ ] **Step 6: Correct the stale comment in `backend/messaging/enums.py`**

Ruling 2 keeps `SENDER_CONVERSATION_URL_TEMPLATE` exactly as it is, and Task 7 builds the page it points at. The merged comment above it currently instructs the next reader to change that line, on a premise this plan showed to be false. Leaving it is how the line gets changed by accident later, so this task corrects it — **the constant's value is not touched**, and `messaging/tests/test_enums.py:108` and `:113`, which pin it, stay green and unedited.

Replace lines 101–103 of `backend/messaging/enums.py`:

```python
# Spec 15.5's next_url: the URL given to the person who SENT an inquiry, who is
# typically a buyer - and spec 4.2 has no buyer row, which is why this path
# carries no role segment. It is NOT the same destination as spec 28's
# /dashboard/broker/messages/, which is the RECIPIENT broker's screen; those are
# two seats on one conversation, so they are two URLs. Phase 19 builds both
# pages and deliberately leaves this line alone.
SENDER_CONVERSATION_URL_TEMPLATE = "/dashboard/messages/{conversation_id}/"
```

Run: `cd backend && uv run pytest messaging/tests/test_enums.py -v`
Expected: PASS, unchanged — the assertions read the value, not the comment.

- [ ] **Step 7: Commit**

```bash
git add backend/messaging backend/config/settings/base.py
git commit -m "feat(messaging): conversation detail, context URL and archive endpoint (Phase 19 Task 1)"
```

---

### Task 2: `GET /api/v1/brokers/<id>/dashboard/` — the four metrics spec §28 permits

**Files:**
- Create: `backend/brokers/permissions.py`, `backend/brokers/dashboard.py`, `backend/brokers/tests/conftest.py`
- Modify (append): `backend/brokers/views.py`, `backend/brokers/urls.py`, `backend/config/settings/base.py`
- Test: `backend/brokers/tests/test_broker_dashboard_api.py`

**Interfaces:**
- Consumes: `accounts.services.active_broker_membership`; `accounts.permissions.IsActiveUser`; `brokers.models.BrokerOrganization`; `brokers.selectors.broker_listing_counts`, `pending_revision_count` (Phase 12, read-only); `listings.enums.ListingStatus` (read-only, function-local); `messaging.enums.UNIFIED_INQUIRIES_FLAG`; `messaging.models.Message`; `messaging.selectors.annotate_unread`, `conversations_visible_to`; `platform_settings.services.is_feature_enabled`.
- Produces:
  - `brokers.permissions.IsBrokerMember` — view-level, `code="not_broker_member"`
  - `brokers.dashboard.NEW_INQUIRY_WINDOW_DAYS = 7`
  - `brokers.dashboard.broker_message_metrics(broker, *, viewer) -> dict`
  - `brokers.dashboard.broker_dashboard_metrics(broker, *, viewer) -> dict`
  - `brokers.views.BrokerDashboardView` (route name `broker-dashboard`)
  - throttle scope `broker_dashboard` = `120/min`

**Note (ruling — every cross-app import in `brokers/dashboard.py` is function-local, and that is not style).** Phase 6's `messaging/selectors.py` imports `brokers.models.BrokerMembership` **at module level**. A module-level `from messaging.selectors import …` here would therefore close an app-loading cycle whose symptom is `AppRegistryNotReady` at `manage.py` start — and `brokers/admin.py` imports this app's modules at admin-autodiscover time, which is exactly when that bites. `brokers/selectors.py` already uses the same function-local pattern for `listings`, for the same reason (Phase 12 contract rule 2). Do not "clean these up".

- [ ] **Step 1a: Write `backend/brokers/tests/conftest.py`**

This package has no conftest today (verified: `brokers/tests/` holds only `__init__.py`, `factories.py` and six `test_*.py` files). This task's tests flip `unified_inquiries`, and `platform_settings.services.is_feature_enabled` caches a persisted value with `timeout=None` — so a flag flipped in one test leaks into the next without this.

```python
import pytest
from django.core.cache import cache

from messaging.enums import UNIFIED_INQUIRIES_FLAG
from platform_settings.services import SETTINGS_CACHE_KEY, feature_flag_cache_key

#: Flags this package's tests toggle. Listed so the fixture below clears exactly
#: these entries and nothing else.
BROKER_FEATURE_FLAG_KEYS = [UNIFIED_INQUIRIES_FLAG]


@pytest.fixture(autouse=True)
def _clear_broker_caches():
    """Delete this package's OWN cache keys around every test.

    NEVER `cache.clear()`. Django's RedisCache.clear() is a FLUSHDB, and this
    project's test Redis DB is shared by concurrently running worktrees — which
    is why backend/conftest.py was rewritten to scan and delete only its own
    KEY_PREFIX. The same narrow shape as messaging/tests/conftest.py and
    listings/tests/conftest.py: named keys, by name.
    """

    def _clear():
        cache.delete(SETTINGS_CACHE_KEY)
        for key in BROKER_FEATURE_FLAG_KEYS:
            cache.delete(feature_flag_cache_key(key))

    _clear()
    yield
    _clear()
```

- [ ] **Step 1b: Write the failing test**

`backend/brokers/tests/test_broker_dashboard_api.py`:

```python
"""GET /api/v1/brokers/<id>/dashboard/ — spec 28's "Dashboard metrics".

Spec 28: "Broker home may show only backend-derived useful metrics such as
published listings, pending approvals, unread messages and new inquiries."
Every number in this payload is a live query; spec 26's definition of done
requires visible counters to equal query results, and Phase 12 contract rule 10
forbids denormalising them onto the organization.
"""

from datetime import timedelta

import pytest
from django.contrib.auth.models import Group
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from brokers.enums import BrokerMembershipRole, BrokerOrganizationStatus
from brokers.tests.factories import make_broker, make_membership
from listings.enums import ListingStatus, RevisionStatus
from listings.models import ListingRevision
from listings.tests.factories import make_brand, make_broker_listing
from messaging.enums import UNIFIED_INQUIRIES_FLAG, ConversationType
from messaging.tests.factories import make_conversation, make_message
from platform_settings.services import set_feature_flag

pytestmark = pytest.mark.django_db


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture(autouse=True)
def _messaging_flag_on(db):
    """brokers/tests has no messaging conftest, so this package turns spec 35.1's
    flag on for itself. Production seeds it DISABLED (messaging/0002) and
    test_the_messaging_block_is_blank_when_the_flag_is_off covers that side."""
    set_feature_flag(
        key=UNIFIED_INQUIRIES_FLAG,
        is_enabled=True,
        actor=None,
        description="Enabled by brokers dashboard tests.",
    )
    yield


def listing_for(broker, actor, status, tag):
    """One broker listing with its OWN brand.

    listings.tests.factories.make_broker_listing defaults the brand to
    `make_brand(f"Brand {broker.pk.hex[:8]}")`, so creating a SECOND listing for
    the same brokerage without an explicit brand raises IntegrityError:
    taxonomy.BoatBrand enforces accent/case-insensitive uniqueness on the
    normalized name (Phase 4). Every brand name here is phase19-prefixed so it
    also cannot collide with another package's fixtures.
    """
    return make_broker_listing(
        broker=broker,
        actor=actor,
        brand=make_brand(f"Phase19 {tag}"),
        status=status,
    )


def make_moderator(email):
    """A REAL staff moderator.

    accounts.services.is_staff_moderator (accounts/services.py:122-126) requires
    BOTH primary_role == STAFF AND membership of the staff_moderator or
    staff_admin group. A make_user(role=UserRole.STAFF) with no group is not a
    moderator, so a test that only sets the role proves nothing about the staff
    branch it claims to exercise.

    get_or_create, not get: this package's conftest seeds no Groups, and a
    `@pytest.mark.django_db(transaction=True)` test anywhere in the session ends
    with a flush that truncates rows a data migration inserted. The same
    defensive spelling brokers/tests/test_admin.py:35 already uses.
    """
    moderator = make_user(email=email, role=UserRole.STAFF)
    moderator.groups.add(Group.objects.get_or_create(name=StaffGroup.MODERATOR)[0])
    return moderator


@pytest.fixture
def scene():
    """Two brokerages. Alpha has listings, a backlog and conversations; Beta is
    the cross-tenant control and must never appear in Alpha's numbers."""
    broker_a = make_broker(name="Phase19 Metrics Alpha", slug="phase19-metrics-alpha")
    broker_b = make_broker(name="Phase19 Metrics Beta", slug="phase19-metrics-beta")

    reader = make_user(email="metrics-reader@phase19.example")
    agent = make_user(email="metrics-agent@phase19.example")
    outsider = make_user(email="metrics-outsider@phase19.example")
    asker = make_user(email="metrics-asker@phase19.example", full_name="Ada Rossi")

    make_membership(
        reader, broker_a, role=BrokerMembershipRole.MANAGER, can_read_messages=True
    )
    make_membership(
        agent, broker_a, role=BrokerMembershipRole.AGENT, can_edit_listings=True
    )
    make_membership(
        outsider, broker_b, role=BrokerMembershipRole.ADMIN, can_read_messages=True
    )

    published = listing_for(broker_a, reader, ListingStatus.PUBLISHED, "Alpha Pub")
    listing_for(broker_a, reader, ListingStatus.DRAFT, "Alpha Draft")
    pending = listing_for(
        broker_a, reader, ListingStatus.PENDING_APPROVAL, "Alpha Pending"
    )
    ListingRevision.objects.create(
        listing=pending, state=RevisionStatus.SUBMITTED, created_by=reader
    )
    # Beta's noise: must not be counted anywhere in Alpha's payload.
    beta_published = listing_for(
        broker_b, outsider, ListingStatus.PUBLISHED, "Beta Pub"
    )
    beta_pending = listing_for(
        broker_b, outsider, ListingStatus.PENDING_APPROVAL, "Beta Pending"
    )
    ListingRevision.objects.create(
        listing=beta_pending, state=RevisionStatus.SUBMITTED, created_by=outsider
    )

    thread = make_conversation(
        initiator=asker,
        conversation_type=ConversationType.BROKER_INQUIRY,
        broker=broker_a,
        subject="Alpha question",
    )
    make_message(conversation=thread, sender=asker)
    beta_thread = make_conversation(
        initiator=asker,
        conversation_type=ConversationType.BROKER_INQUIRY,
        broker=broker_b,
        subject="Beta question",
    )
    make_message(conversation=beta_thread, sender=asker)

    return {
        "broker_a": broker_a,
        "broker_b": broker_b,
        "reader": reader,
        "agent": agent,
        "outsider": outsider,
        "asker": asker,
        "published": published,
        "thread": thread,
        "beta_published": beta_published,
        "beta_thread": beta_thread,
    }


def url_for(broker):
    return reverse("broker-dashboard", args=[broker.pk])


def test_a_guest_gets_401(api, scene):
    response = api.get(url_for(scene["broker_a"]))
    assert response.status_code == 401


def test_a_member_of_another_broker_gets_403_not_broker_member(api, scene):
    """Cross-tenant: Beta's own admin has no business reading Alpha's numbers."""
    api.force_authenticate(scene["outsider"])
    response = api.get(url_for(scene["broker_a"]))
    assert response.status_code == 403
    assert response.data["error"]["code"] == "not_broker_member"


def test_a_real_staff_moderator_with_no_membership_gets_403(api, scene):
    """Ruling 10, matching Phase 6: no staff read path into a broker's inbox.
    Staff read a brokerage through Phase 12's own staff endpoint — which the
    positive control below proves this very user can reach."""
    moderator = make_moderator("metrics-moderator@phase19.example")
    api.force_authenticate(moderator)
    assert api.get(url_for(scene["broker_a"])).status_code == 403


def test_the_same_moderator_can_reach_the_staff_broker_endpoint(api, scene):
    """Positive control for the test above.

    Phase 12's GET /api/v1/staff/brokers/<id>/ is IsStaffModerator-gated. If this
    fails, the 403 above is telling us the fixture is not really a moderator —
    not that the broker dashboard refuses moderators. That is the vacuous-test
    failure mode this pair exists to close.
    """
    moderator = make_moderator("metrics-moderator-control@phase19.example")
    api.force_authenticate(moderator)
    response = api.get(reverse("staff-broker-detail", args=[scene["broker_a"].pk]))
    assert response.status_code == 200
    assert response.data["slug"] == "phase19-metrics-alpha"


def test_a_member_of_a_suspended_organization_gets_403(api, scene):
    """active_broker_membership() requires broker__status=ACTIVE, so suspending
    an organization removes every capability at once (spec 12 item 5)."""
    scene["broker_a"].status = BrokerOrganizationStatus.SUSPENDED
    scene["broker_a"].save(update_fields=["status", "updated_at"])
    api.force_authenticate(scene["reader"])
    assert api.get(url_for(scene["broker_a"])).status_code == 403


def test_the_payload_carries_exactly_spec_28_s_four_metrics(api, scene):
    api.force_authenticate(scene["reader"])
    response = api.get(url_for(scene["broker_a"]))
    assert response.status_code == 200
    assert set(response.data) == {
        "broker",
        "published_listings",
        "pending_approvals",
        "messages",
    }
    assert response.data["broker"] == {
        "id": str(scene["broker_a"].pk),
        "name": "Phase19 Metrics Alpha",
        "slug": "phase19-metrics-alpha",
        "status": BrokerOrganizationStatus.ACTIVE,
    }
    assert response.data["published_listings"] == 1
    assert response.data["pending_approvals"] == 1


def test_the_messaging_block_counts_only_this_brokers_threads(api, scene):
    api.force_authenticate(scene["reader"])
    messages = api.get(url_for(scene["broker_a"])).data["messages"]
    assert messages == {
        "enabled": True,
        "can_read": True,
        "unread_conversations": 1,
        "unread_messages": 1,
        "new_inquiries_7d": 1,
    }


def test_a_member_without_can_read_messages_sees_no_counts(api, scene):
    """Spec 5/28: can_edit_listings must never leak message visibility."""
    api.force_authenticate(scene["agent"])
    response = api.get(url_for(scene["broker_a"]))
    assert response.status_code == 200
    assert response.data["published_listings"] == 1
    assert response.data["messages"] == {
        "enabled": True,
        "can_read": False,
        "unread_conversations": None,
        "unread_messages": None,
        "new_inquiries_7d": None,
    }


def test_the_messaging_block_is_blank_when_the_flag_is_off(api, scene):
    """Ruling 8: the listing metrics keep working; only the messaging block goes
    dark. Spec 35.2 seeds this flag DISABLED in production, so this is the
    shipping state on day one, not an edge case."""
    set_feature_flag(
        key=UNIFIED_INQUIRIES_FLAG,
        is_enabled=False,
        actor=None,
        description="Disabled by a test.",
    )
    api.force_authenticate(scene["reader"])
    response = api.get(url_for(scene["broker_a"]))
    assert response.status_code == 200
    assert response.data["published_listings"] == 1
    assert response.data["messages"]["enabled"] is False
    assert response.data["messages"]["unread_messages"] is None


def test_a_readers_own_reply_never_counts_as_unread_for_them(api, scene):
    """After the reader replies the thread holds two unread messages, but only
    the one they did not send is theirs to read."""
    make_message(conversation=scene["thread"], sender=scene["reader"])
    api.force_authenticate(scene["reader"])
    messages = api.get(url_for(scene["broker_a"])).data["messages"]
    assert messages["unread_messages"] == 1


def test_an_inquiry_older_than_the_window_is_not_new(api, scene):
    stale = make_conversation(
        # A FRESH initiator, not scene["asker"]. The scene already holds an OPEN
        # BROKER_INQUIRY from `asker` to `broker_a`, and Conversation's
        # `messaging_open_broker_thread_unique` partial index
        # (messaging/models.py:118-126) allows exactly one OPEN thread per
        # (initiator, broker) — reusing the asker here raises IntegrityError
        # before the assertion is ever reached.
        initiator=make_user(email="stale-asker@phase19.example"),
        conversation_type=ConversationType.BROKER_INQUIRY,
        broker=scene["broker_a"],
        subject="An old Alpha question",
    )
    # created_at is auto_now_add, so it has to be pushed back with an UPDATE.
    type(stale).objects.filter(pk=stale.pk).update(
        created_at=timezone.now() - timedelta(days=30)
    )
    api.force_authenticate(scene["reader"])
    messages = api.get(url_for(scene["broker_a"])).data["messages"]
    assert messages["new_inquiries_7d"] == 1


def test_an_unknown_broker_id_is_indistinguishable_from_one_you_are_not_in(api, scene):
    """403, not 404, and deliberately so: IsBrokerMember runs at the view level,
    before any object lookup, so an outsider cannot enumerate which broker ids
    exist by watching the status code change."""
    import uuid

    api.force_authenticate(scene["reader"])
    assert api.get(reverse("broker-dashboard", args=[uuid.uuid4()])).status_code == 403


def test_no_contact_value_appears_in_the_payload(api, scene):
    api.force_authenticate(scene["reader"])
    rendered = api.get(url_for(scene["broker_a"])).content.decode()
    assert scene["broker_a"].public_email not in rendered
    assert scene["broker_a"].public_phone not in rendered
    assert scene["asker"].email not in rendered
```

- [ ] **Step 1c: Sweep this task's fixtures for the two collision classes**

Before running anything, read the test file you just wrote against these two rules — they are the defect class this plan has already hit once:

1. **One OPEN thread per (initiator, context).** `messaging/models.py:111-133` declares three *partial* unique indexes conditioned on `status=OPEN`: `(initiator, listing)`, `(initiator, broker)` and `(initiator, professional)`. A second OPEN conversation reusing an initiator **and** the same broker/professional/listing raises `IntegrityError` at creation, before any assertion runs. Every extra thread in this file uses a fresh `make_user`.
2. **`BoatBrand` normalized names are globally unique.** `make_broker_listing` derives its default brand name from the broker's pk, so two default-brand listings for one brokerage collide. `listing_for()` gives each listing its own phase19-prefixed brand.

Run: `cd backend && rg -n "make_conversation\(|make_broker_listing\(" brokers/tests/test_broker_dashboard_api.py`
Expected: every `make_conversation` call passes either a distinct `initiator` or a distinct `broker`/`professional`; no bare `make_broker_listing` call appears (all go through `listing_for`).

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && uv run pytest brokers/tests/test_broker_dashboard_api.py -v`
Expected: FAIL — `NoReverseMatch: Reverse for 'broker-dashboard' not found.`

- [ ] **Step 3a: Write `backend/brokers/permissions.py`**

```python
from rest_framework.permissions import BasePermission

from accounts.services import active_broker_membership


class IsBrokerMember(BasePermission):
    """View-level: the caller holds a live membership of view.kwargs['broker_id'].

    Mirrors accounts.permissions.IsBrokerTeamManager's shape, but gates on mere
    membership: spec 28's broker home shows organization-level counts, which
    every member of the organization may see. The narrower `can_read_messages`
    capability is applied inside the payload, per metric, not here — an AGENT
    must still be able to load their own dashboard.

    Deliberately NOT satisfied by staff. `active_broker_membership` returns None
    for a moderator with no membership, which matches Phase 6's ruling that this
    project ships no staff inbox read path (spec 5's capability table gives staff
    no such row). Staff read a brokerage through Phase 12's
    `GET /api/v1/staff/brokers/<id>/`, which spec 21 specifies with a screen in
    front of it.

    Also the reason an unknown broker id answers 403 rather than 404: this runs
    before any object lookup, so "no such organization" and "not your
    organization" are indistinguishable, and an outsider cannot enumerate ids.
    """

    message = "You are not a member of this broker organization."
    code = "not_broker_member"

    def has_permission(self, request, view):
        broker_id = getattr(view, "kwargs", {}).get("broker_id")
        return active_broker_membership(request.user, broker_id) is not None
```

- [ ] **Step 3b: Write `backend/brokers/dashboard.py`**

```python
"""Spec 28 "Dashboard metrics" — the only numbers broker home may show.

Spec 28: "Broker home may show only backend-derived useful metrics such as
published listings, pending approvals, unread messages and new inquiries.
Remove surveyor/service widgets completely."

EVERY cross-app import below is function-local, and that is not a style choice.
`messaging.selectors` imports `brokers.models.BrokerMembership` at module level,
so a module-level messaging import here would close an app-loading cycle whose
symptom is AppRegistryNotReady at manage.py start — and `brokers/admin.py`
imports this app at admin-autodiscover time, which is exactly when that bites.
`brokers/selectors.py` already does the same for `listings` (Phase 12 contract
rule 2). Do not consolidate them to the top of the module.
"""

from datetime import timedelta

from django.utils import timezone

#: Spec 28 names "new inquiries" without defining "new". Seven days is decided
#: here, once, and reported on the wire as `new_inquiries_7d` so a screen cannot
#: label the number with a window the backend did not compute (spec 2.1).
NEW_INQUIRY_WINDOW_DAYS = 7

#: What the messaging block looks like when there is nothing to report. Every key
#: is present with an explicit None rather than omitted, so the client renders a
#: known-empty tile instead of branching on a missing key (spec 2.1; spec 26's
#: "All visible counters equal query results").
_BLANK_MESSAGE_METRICS = {
    "enabled": False,
    "can_read": False,
    "unread_conversations": None,
    "unread_messages": None,
    "new_inquiries_7d": None,
}


def _can_read_messages(viewer, broker) -> bool:
    from accounts.services import active_broker_membership

    membership = active_broker_membership(viewer, broker.pk)
    return membership is not None and membership.can_read_messages


def broker_message_metrics(broker, *, viewer) -> dict:
    """Spec 28's "unread messages" and "new inquiries", for ONE organization.

    Scoped by `messaging.selectors.conversations_visible_to(viewer)`, never by a
    fresh query: Phase 6 contract rule 8 requires it, and it already applies
    `can_read_messages`, the membership's own `is_active` and the organization's
    ACTIVE status. Filtering that queryset by this broker is therefore the whole
    cross-tenant boundary — a member of another brokerage gets an empty set
    rather than somebody else's numbers, at the same place the inbox does.

    Spec 11.8 gives Message ONE nullable read_at, so "unread" means unread by the
    recipient SIDE, not by this member. See the plan's Known Limitations.
    """
    from messaging.enums import UNIFIED_INQUIRIES_FLAG
    from messaging.models import Message
    from messaging.selectors import annotate_unread, conversations_visible_to
    from platform_settings.services import is_feature_enabled

    if not is_feature_enabled(UNIFIED_INQUIRIES_FLAG, default=False):
        return dict(_BLANK_MESSAGE_METRICS)
    if not _can_read_messages(viewer, broker):
        return {**_BLANK_MESSAGE_METRICS, "enabled": True}

    visible = conversations_visible_to(viewer).filter(broker=broker)
    since = timezone.now() - timedelta(days=NEW_INQUIRY_WINDOW_DAYS)
    return {
        "enabled": True,
        "can_read": True,
        "unread_conversations": (
            annotate_unread(visible, viewer).filter(unread_count__gt=0).count()
        ),
        # `.values("pk")` rather than passing the queryset itself: `visible`
        # carries select_related and distinct, and an explicit pk projection
        # keeps the generated subquery obviously one column wide.
        "unread_messages": (
            Message.objects.filter(conversation_id__in=visible.values("pk"))
            .exclude(sender=viewer)
            .filter(read_at__isnull=True)
            .count()
        ),
        "new_inquiries_7d": visible.filter(created_at__gte=since).count(),
    }


def broker_dashboard_metrics(broker, *, viewer) -> dict:
    """The whole broker-home payload (spec 28 "Dashboard metrics").

    `broker_listing_counts` is Phase 12's live GROUP BY and is reused rather than
    re-counted: two implementations of "how many published listings" is exactly
    how a screen ends up disagreeing with the staff screen beside it. Only the
    PUBLISHED cell is exposed here — spec 28 permits "published listings", not a
    full state breakdown, and a broker-facing payload should not grow surface it
    was not asked for.
    """
    from brokers.selectors import broker_listing_counts, pending_revision_count
    from listings.enums import ListingStatus

    counts = broker_listing_counts(broker)
    return {
        "broker": {
            "id": str(broker.pk),
            "name": broker.name,
            "slug": broker.slug,
            "status": broker.status,
        },
        "published_listings": counts["by_status"][ListingStatus.PUBLISHED],
        "pending_approvals": pending_revision_count(broker),
        "messages": broker_message_metrics(broker, viewer=viewer),
    }
```

- [ ] **Step 3c: Append to `backend/brokers/views.py`**

Add to the module's import section:

```python
from brokers.dashboard import broker_dashboard_metrics
from brokers.permissions import IsBrokerMember
```

```python
class BrokerDashboardView(APIView):
    """GET /api/v1/brokers/<id>/dashboard/ — spec 28's "Dashboard metrics".

    An addition beyond spec 30.1's table, flagged here rather than presented as
    spec-literal, exactly as Phase 12 flagged its two staff routes. Spec 28's
    "Broker home may show only backend-derived useful metrics" cannot be true
    without one (spec 2.1), and spec 30.1's closing sentence grants the latitude.

    NOT flag-gated, so `IsAuthenticated` is first and Phase 6 contract rule 11a
    does not apply (it governs messaging views that HAVE a flag gate). The
    listing metrics are Phase 11/12 state and have nothing to do with
    `unified_inquiries`; the messaging block reports enabled=false with null
    counts when the flag is off, so broker home keeps working with its messaging
    tiles hidden rather than 403-ing whole. Every messaging *mutation* stays
    behind Phase 6's gate.
    """

    permission_classes = [IsAuthenticated, IsActiveUser, IsBrokerMember]
    throttle_scope = "broker_dashboard"

    def get(self, request, broker_id):
        broker = get_object_or_404(BrokerOrganization, pk=broker_id)
        return Response(broker_dashboard_metrics(broker, viewer=request.user))
```

- [ ] **Step 3d: Append the route to `backend/brokers/urls.py`**

```python
    path(
        "brokers/<uuid:broker_id>/dashboard/",
        BrokerDashboardView.as_view(),
        name="broker-dashboard",
    ),
```

…and add `BrokerDashboardView` to the existing `from brokers.views import (...)` tuple, keeping it alphabetical.

- [ ] **Step 3e: Append one line to `backend/config/settings/base.py`**

Inside `REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]`, **append only**:

```python
        # Broker home is a screen a brokerage refreshes through the working day,
        # and every field is a live aggregate. Matches `taxonomy_search`'s order
        # of magnitude: well above a human's page loads, well below scripted
        # polling of another organization's counters.
        "broker_dashboard": "120/min",
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && uv run pytest brokers/tests/test_broker_dashboard_api.py -v`
Expected: PASS — **13 collected test items**.

Run: `cd backend && uv run pytest brokers messaging -q`
Expected: all pass.

Run: `cd backend && uv run python manage.py check`
Expected: `System check identified no issues` — this is the check that catches the app-loading cycle the function-local imports exist to prevent.

Run: `cd backend && git diff --name-only dev -- . ':!brokers'`
Expected: exactly `config/settings/base.py`.

- [ ] **Step 5: Commit**

```bash
git add backend/brokers backend/config/settings/base.py
git commit -m "feat(brokers): broker dashboard metrics endpoint (Phase 19 Task 2)"
```

**Note on the new `brokers/tests/conftest.py` and test ordering.** It is autouse and package-scoped, so it also runs around Phase 12's six existing test modules in this package. That is safe — it deletes two named keys neither of those modules writes — and it is the reason it deletes *named* keys rather than calling `cache.clear()`, which would be a `FLUSHDB` against a Redis DB shared with other worktrees' suites. Do not "simplify" it.

---

### Task 3: The EN/IT/ES dictionary for every string this phase renders

**Files:**
- Create: `frontend/src/lib/i18n/conversations.ts`, `frontend/src/lib/i18n/conversations.test.ts`

**Interfaces:**
- Consumes: `type Locale`, `DEFAULT_LOCALE`, `SUPPORTED_LOCALES` from `@/lib/i18n/directory` (Phase 5 contract rule 12 — `Locale` is declared once, in `@/lib/api/directory`, and re-exported there).
- Produces:
  - `@/lib/i18n/conversations`: `CONVERSATION_MESSAGES: Record<string, Record<Locale, string>>`, `tConversations(locale, key) -> string`, `formatConversationMessage(template, values) -> string`

**Note (reconciliation item 13).** This module ships `messages.sender_unnamed`. Phase 6's `MessageSerializer` docstring says the client renders **`inquiry.sender_unnamed`** for a blank display name. Step 0 checks whether that key exists in `INQUIRY_MESSAGES`; **if it does, delete ours and import `tInquiry` at every call site** (Tasks 5 and 6). Spec §37 must not carry two keys for one string.

- [ ] **Step 0: Check the Phase 6 key**

Run: `cd frontend && rg -n "sender_unnamed" src/lib/i18n/`
Expected: either no output (keep `messages.sender_unnamed`) or a hit in `inquiry.ts` (drop ours, use `tInquiry`). Record which branch was taken in the commit message.

- [ ] **Step 1: Write the failing test**

`frontend/src/lib/i18n/conversations.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { SUPPORTED_LOCALES } from "@/lib/i18n/directory";
import {
  CONVERSATION_MESSAGES,
  formatConversationMessage,
  tConversations,
} from "@/lib/i18n/conversations";

describe("CONVERSATION_MESSAGES", () => {
  it("gives every key a non-empty EN, IT and ES translation", () => {
    // Spec 37: "All new UI text must have EN/IT/ES translation keys." A missing
    // locale silently falls back to English at runtime, so the dictionary is
    // where it has to be caught.
    const gaps: string[] = [];
    for (const [key, translations] of Object.entries(CONVERSATION_MESSAGES)) {
      for (const locale of SUPPORTED_LOCALES) {
        if (!translations[locale] || translations[locale].trim() === "") {
          gaps.push(`${key}.${locale}`);
        }
      }
    }
    expect(gaps).toEqual([]);
  });

  it("carries spec 37's literal broker.messages key", () => {
    expect(CONVERSATION_MESSAGES["broker.messages"]).toBeDefined();
    expect(tConversations("it", "broker.messages")).toBe("Messaggi");
  });

  it("gives ARCHIVED and BLOCKED distinct badge strings", () => {
    // Spec 2.1: two different statuses must not render the same word. The
    // components gate on `=== "ARCHIVED"` / `=== "BLOCKED"`, never `!== "OPEN"`.
    for (const locale of SUPPORTED_LOCALES) {
      expect(tConversations(locale, "messages.archived_badge")).not.toBe(
        tConversations(locale, "messages.blocked_badge"),
      );
    }
  });

  it("names a filter string for each of spec 28's five filters", () => {
    for (const key of [
      "messages.filter.all",
      "messages.filter.unread",
      "messages.filter.listing_inquiries",
      "messages.filter.profile_inquiries",
      "messages.filter.archived",
    ]) {
      expect(CONVERSATION_MESSAGES[key]).toBeDefined();
    }
  });

  it("names a message for every error code this phase can receive", () => {
    for (const code of [
      "feature_disabled",
      "authentication_required",
      "rate_limited",
      "conversation_closed",
      "conversation_superseded",
      "invalid_conversation_status",
      "conversation_filing_forbidden",
      "not_broker_member",
      "not_found",
      "validation_error",
      "unexpected_error",
    ]) {
      expect(CONVERSATION_MESSAGES[`messages.error.${code}`]).toBeDefined();
    }
  });

  it("throws on an unknown key rather than rendering it raw", () => {
    // Same contract as lib/i18n/directory.ts's t(): a raw key on screen is a
    // bug that ships silently, a thrown error is one a test catches.
    expect(() => tConversations("en", "messages.nope")).toThrow(
      /Unknown conversation message key/,
    );
  });

  it("returns the requested locale's own string when it has one", () => {
    expect(tConversations("es", "broker.messages")).toBe("Mensajes");
    expect(tConversations("it", "messages.filter.unread")).toBe("Non letti");
  });

  it("falls back to English for a blank locale entry", () => {
    // The EN-fallback branch cannot be reached through the shipped dictionary,
    // because the first test in this file forbids a blank locale anywhere in it.
    // Asserting tConversations("es", ...) === "Mensajes" would therefore prove
    // only that the Spanish string exists — it would never execute the `||`.
    // So the branch is exercised against an INJECTED entry and cleaned up.
    const KEY = "messages.__fallback_probe__";
    CONVERSATION_MESSAGES[KEY] = { en: "English only", it: "", es: "" };
    try {
      expect(tConversations("es", KEY)).toBe("English only");
      expect(tConversations("it", KEY)).toBe("English only");
      expect(tConversations("en", KEY)).toBe("English only");
    } finally {
      delete CONVERSATION_MESSAGES[KEY];
    }
  });
});

describe("formatConversationMessage", () => {
  it("substitutes named placeholders", () => {
    expect(
      formatConversationMessage(tConversations("en", "messages.unread_count"), {
        count: 3,
      }),
    ).toBe("3 unread");
  });

  it("leaves an unknown placeholder untouched rather than printing undefined", () => {
    expect(formatConversationMessage("Hi {name}", {})).toBe("Hi {name}");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && pnpm vitest run src/lib/i18n/conversations.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/i18n/conversations"`.

- [ ] **Step 3: Write `frontend/src/lib/i18n/conversations.ts`**

```ts
// Spec 37: all new UI text has EN/IT/ES translation keys and no English is
// hard-coded inside a component. A typed dictionary, not an i18n framework —
// the same shape lib/i18n/directory.ts established in Phase 5.
//
// `Locale` is imported, never redeclared (Phase 5 contract rule 12): it is
// declared once in lib/api/directory.ts and re-exported by lib/i18n/directory.
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/directory";

type Translations = Record<Locale, string>;

export const CONVERSATION_MESSAGES: Record<string, Translations> = {
  // Spec 37 names this key literally.
  "broker.messages": { en: "Messages", it: "Messaggi", es: "Mensajes" },
  "broker.dashboard": {
    en: "Dashboard",
    it: "Pannello",
    es: "Panel",
  },
  "messages.title": { en: "Messages", it: "Messaggi", es: "Mensajes" },
  "messages.intro": {
    en: "Conversations started from your listings and profile.",
    it: "Conversazioni avviate dai tuoi annunci e dal tuo profilo.",
    es: "Conversaciones iniciadas desde tus anuncios y tu perfil.",
  },

  // Spec 28's five filters, verbatim.
  "messages.filter.all": { en: "All", it: "Tutti", es: "Todos" },
  "messages.filter.unread": { en: "Unread", it: "Non letti", es: "No leídos" },
  "messages.filter.listing_inquiries": {
    en: "Listing inquiries",
    it: "Richieste sugli annunci",
    es: "Consultas de anuncios",
  },
  "messages.filter.profile_inquiries": {
    en: "Profile inquiries",
    it: "Richieste dal profilo",
    es: "Consultas del perfil",
  },
  "messages.filter.archived": {
    en: "Archived",
    it: "Archiviati",
    es: "Archivados",
  },
  "messages.filter.label": { en: "Filter", it: "Filtro", es: "Filtro" },

  "messages.empty": {
    en: "No conversations match this filter.",
    it: "Nessuna conversazione corrisponde a questo filtro.",
    es: "Ninguna conversación coincide con este filtro.",
  },
  "messages.loading": { en: "Loading…", it: "Caricamento…", es: "Cargando…" },
  "messages.unread_count": {
    en: "{count} unread",
    it: "{count} non letti",
    es: "{count} sin leer",
  },
  "messages.sender_unnamed": {
    // Phase 6 refuses to put an account's email into sender_name_snapshot when
    // the account has no full name, so a blank name is the common case, not an
    // edge one.
    en: "Unnamed sender",
    it: "Mittente senza nome",
    es: "Remitente sin nombre",
  },
  "messages.context.LISTING": { en: "Listing", it: "Annuncio", es: "Anuncio" },
  "messages.context.BROKER": { en: "Broker", it: "Broker", es: "Bróker" },
  "messages.context.PROFESSIONAL": {
    en: "Professional",
    it: "Professionista",
    es: "Profesional",
  },
  "messages.context.SUPPORT": { en: "Support", it: "Assistenza", es: "Soporte" },

  "messages.archive": { en: "Archive", it: "Archivia", es: "Archivar" },
  "messages.unarchive": {
    en: "Move to inbox",
    it: "Sposta in arrivo",
    es: "Mover a recibidos",
  },
  "messages.archived_badge": {
    en: "Archived",
    it: "Archiviata",
    es: "Archivada",
  },
  "messages.blocked_badge": {
    // A distinct state, not a synonym for archived. Spec 36.6 makes BLOCKED a
    // moderation outcome; nothing in this phase produces it (ruling 4), but a
    // thread that reaches it must not be mislabelled "Archived".
    en: "Blocked",
    it: "Bloccata",
    es: "Bloqueada",
  },

  "messages.thread.back": {
    en: "Back to messages",
    it: "Torna ai messaggi",
    es: "Volver a mensajes",
  },
  "messages.thread.context_heading": {
    en: "About",
    it: "Riguarda",
    es: "Acerca de",
  },
  "messages.thread.open_context": {
    en: "Open",
    it: "Apri",
    es: "Abrir",
  },
  "messages.thread.you": { en: "You", it: "Tu", es: "Tú" },
  "messages.thread.system_note": {
    en: "System note",
    it: "Nota di sistema",
    es: "Nota del sistema",
  },
  "messages.thread.empty": {
    en: "This conversation has no messages yet.",
    it: "Questa conversazione non ha ancora messaggi.",
    es: "Esta conversación aún no tiene mensajes.",
  },
  "messages.reply.label": { en: "Reply", it: "Rispondi", es: "Responder" },
  "messages.reply.placeholder": {
    en: "Write your reply…",
    it: "Scrivi la tua risposta…",
    es: "Escribe tu respuesta…",
  },
  "messages.reply.send": { en: "Send", it: "Invia", es: "Enviar" },
  "messages.reply.sending": {
    en: "Sending…",
    it: "Invio in corso…",
    es: "Enviando…",
  },
  "messages.reply.too_short": {
    // Spec 15.1's Message rule applies to a reply too: 20-4000 characters. The
    // server is the authority (spec 2.2); this is usability only.
    en: "A reply must be at least 20 characters.",
    it: "Una risposta deve contenere almeno 20 caratteri.",
    es: "Una respuesta debe tener al menos 20 caracteres.",
  },
  "messages.reply.too_long": {
    en: "A reply may be at most 4000 characters.",
    it: "Una risposta può contenere al massimo 4000 caratteri.",
    es: "Una respuesta puede tener como máximo 4000 caracteres.",
  },

  // Spec 30.2 asks for a localized, user-safe message. The backend's strings are
  // English-only today (Phase 6 Known Limitation 13), so the client maps
  // error.code to its own copy and never renders error.message.
  "messages.error.feature_disabled": {
    en: "Messages are not available yet.",
    it: "I messaggi non sono ancora disponibili.",
    es: "Los mensajes aún no están disponibles.",
  },
  "messages.error.authentication_required": {
    en: "Sign in to see your messages.",
    it: "Accedi per vedere i tuoi messaggi.",
    es: "Inicia sesión para ver tus mensajes.",
  },
  "messages.error.rate_limited": {
    en: "Too many requests. Try again in a moment.",
    it: "Troppe richieste. Riprova tra poco.",
    es: "Demasiadas solicitudes. Inténtalo de nuevo en un momento.",
  },
  "messages.error.conversation_closed": {
    en: "This conversation is closed.",
    it: "Questa conversazione è chiusa.",
    es: "Esta conversación está cerrada.",
  },
  "messages.error.conversation_superseded": {
    en: "A newer conversation about this already exists.",
    it: "Esiste già una conversazione più recente su questo argomento.",
    es: "Ya existe una conversación más reciente sobre esto.",
  },
  "messages.error.invalid_conversation_status": {
    en: "That change is not allowed.",
    it: "Questa modifica non è consentita.",
    es: "Ese cambio no está permitido.",
  },
  "messages.error.conversation_filing_forbidden": {
    // Ruling 5: one shared `status` column means only the recipient may file.
    en: "Only the recipient of a conversation can archive it.",
    it: "Solo il destinatario di una conversazione può archiviarla.",
    es: "Solo el destinatario de una conversación puede archivarla.",
  },
  "messages.error.not_broker_member": {
    // Ruling 15: the session lists a membership whose organization may be
    // SUSPENDED (accounts/selectors.py:63-65 does not filter on broker status,
    // while accounts/services.py:150-159 requires ACTIVE). Name both real causes
    // instead of showing "Something went wrong".
    en: "This broker organization is not available to your account. It may be suspended, or your membership may have been removed.",
    it: "Questa organizzazione broker non è disponibile per il tuo account. Potrebbe essere sospesa oppure la tua iscrizione potrebbe essere stata rimossa.",
    es: "Esta organización de bróker no está disponible para tu cuenta. Puede estar suspendida o tu membresía puede haberse eliminado.",
  },
  "messages.error.not_found": {
    en: "This conversation is not available.",
    it: "Questa conversazione non è disponibile.",
    es: "Esta conversación no está disponible.",
  },
  "messages.error.validation_error": {
    en: "Check the highlighted field and try again.",
    it: "Controlla il campo evidenziato e riprova.",
    es: "Revisa el campo resaltado e inténtalo de nuevo.",
  },
  "messages.error.unexpected_error": {
    en: "Something went wrong. Try again.",
    it: "Qualcosa è andato storto. Riprova.",
    es: "Algo salió mal. Inténtalo de nuevo.",
  },

  // Broker home (spec 28 "Dashboard metrics").
  "broker.dashboard.title": {
    en: "Broker dashboard",
    it: "Pannello broker",
    es: "Panel del bróker",
  },
  "broker.dashboard.metric.published_listings": {
    en: "Published listings",
    it: "Annunci pubblicati",
    es: "Anuncios publicados",
  },
  "broker.dashboard.metric.pending_approvals": {
    en: "Pending approvals",
    it: "In attesa di approvazione",
    es: "Pendientes de aprobación",
  },
  "broker.dashboard.metric.unread_messages": {
    en: "Unread messages",
    it: "Messaggi non letti",
    es: "Mensajes sin leer",
  },
  "broker.dashboard.metric.new_inquiries": {
    en: "New inquiries",
    it: "Nuove richieste",
    es: "Consultas nuevas",
  },
  "broker.dashboard.metric.new_inquiries_help": {
    // The window is the backend's `new_inquiries_7d`; the label states it so the
    // screen cannot describe a period the server did not compute (spec 2.1).
    en: "Last 7 days",
    it: "Ultimi 7 giorni",
    es: "Últimos 7 días",
  },
  "broker.dashboard.messages_locked": {
    en: "Your team role does not include reading this organization's messages.",
    it: "Il tuo ruolo nel team non include la lettura dei messaggi di questa organizzazione.",
    es: "Tu rol en el equipo no incluye leer los mensajes de esta organización.",
  },
  "broker.dashboard.messages_unavailable": {
    en: "Messaging is not enabled yet.",
    it: "La messaggistica non è ancora attiva.",
    es: "La mensajería aún no está activada.",
  },
  "broker.dashboard.no_organization": {
    en: "Your account is not a member of a broker organization.",
    it: "Il tuo account non appartiene a un'organizzazione broker.",
    es: "Tu cuenta no pertenece a una organización de bróker.",
  },
};

export function tConversations(locale: Locale, key: string): string {
  const translations = CONVERSATION_MESSAGES[key];
  if (!translations) {
    throw new Error(`Unknown conversation message key: ${key}`);
  }
  return translations[locale] || translations[DEFAULT_LOCALE];
}

/** Substitute `{name}` placeholders. An unknown placeholder is left in place
 * rather than replaced with "undefined": a visible `{count}` is a bug report,
 * `undefined` on a screen is a mystery. */
export function formatConversationMessage(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && pnpm vitest run src/lib/i18n/conversations.test.ts`
Expected: PASS — **10 tests**.

Run: `cd frontend && pnpm lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/i18n/conversations.ts frontend/src/lib/i18n/conversations.test.ts
git commit -m "feat(messages): EN/IT/ES dictionary for the broker messages screen (Phase 19 Task 3)"
```

---

### Task 4: `lib/api/conversations.ts` — the only place a messaging URL is built

**Files:**
- Create: `frontend/src/lib/api/conversations.ts`, `frontend/src/lib/api/conversations.test.ts`

**Interfaces:**
- Consumes: `apiFetch` and `ApiError` from `@/lib/api/client`; `type Paginated` from `@/lib/api/directory` (already declared there — do not redeclare it).
- Produces:
  - Types `ConversationStatus`, `ConversationType`, `ConversationContextRef`, `ConversationRow`, `MessageRow`, `BrokerDashboard`, `ConversationFilter`
  - `CONVERSATION_FILTERS: readonly ConversationFilter[]`
  - `FILTER_MESSAGE_KEYS: Record<ConversationFilter, string>` — the filter → dictionary-key map `ConversationFilters` (Task 5) renders from
  - `resolveFilter(raw: string | undefined) -> ConversationFilter`
  - `conversationListQuery(filter, options) -> string`
  - `fetchConversations(filter, options?) -> Promise<Paginated<ConversationRow>>`
  - `fetchConversation(conversationId) -> Promise<ConversationRow>`
  - `fetchThread(conversationId, page?) -> Promise<Paginated<MessageRow>>`
  - `postReply(conversationId, body) -> Promise<MessageRow>`
  - `markConversationRead(conversationId) -> Promise<{ marked_read: number }>`
  - `setConversationStatus(conversationId, status) -> Promise<ConversationRow>`
  - `fetchBrokerDashboard(brokerId) -> Promise<BrokerDashboard>`
  - `messageErrorKey(error: unknown) -> string`

**Note (ruling — `apiFetch`, never `directoryFetch`).** `directoryFetch` is the unauthenticated **server-side** reader: it sends `X-Internal-Service-Secret` plus a forwarded visitor IP and **no `Authorization` header** (`frontend/src/lib/api/directory.ts`). An inbox fetched through it would be the Next.js server's inbox, not the signed-in broker's. Every function here runs in the browser and goes through `apiFetch`, which attaches the in-memory access token and retries once through the refresh cookie on a 401.

- [ ] **Step 1: Write the failing test**

`frontend/src/lib/api/conversations.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import {
  CONVERSATION_FILTERS,
  conversationListQuery,
  fetchBrokerDashboard,
  fetchConversation,
  fetchConversations,
  fetchThread,
  markConversationRead,
  messageErrorKey,
  postReply,
  resolveFilter,
  setConversationStatus,
} from "@/lib/api/conversations";

const apiFetch = vi.fn();
vi.mock("@/lib/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/client")>();
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetch(...args) };
});

beforeEach(() => {
  vi.clearAllMocks();
  apiFetch.mockResolvedValue({ count: 0, next: null, previous: null, results: [] });
});

describe("conversationListQuery", () => {
  it("covers exactly spec 28's five filters", () => {
    expect([...CONVERSATION_FILTERS]).toEqual([
      "ALL",
      "UNREAD",
      "LISTING",
      "PROFILE",
      "ARCHIVED",
    ]);
  });

  it("maps ALL onto status=ALL", () => {
    expect(conversationListQuery("ALL", {})).toBe("status=ALL");
  });

  it("maps UNREAD onto the default OPEN inbox plus unread=true", () => {
    expect(conversationListQuery("UNREAD", {})).toBe("unread=true");
  });

  it("maps LISTING onto one conversation type", () => {
    expect(conversationListQuery("LISTING", {})).toBe("type=LISTING_INQUIRY");
  });

  it("maps PROFILE onto two REPEATED type parameters", () => {
    // Spec 28's "Profile inquiries" is two conversation types, so the parameter
    // repeats — Phase 6 contract rule 7. A comma-joined value would filter to
    // nothing, because the server matches each value exactly.
    expect(conversationListQuery("PROFILE", {})).toBe(
      "type=BROKER_INQUIRY&type=PROFESSIONAL_INQUIRY",
    );
  });

  it("maps ARCHIVED onto status=ARCHIVED", () => {
    expect(conversationListQuery("ARCHIVED", {})).toBe("status=ARCHIVED");
  });

  it("adds the broker scope when one is given", () => {
    expect(conversationListQuery("ALL", { brokerId: "b-1" })).toBe(
      "status=ALL&broker=b-1",
    );
  });

  it("omits page=1 so the first page has exactly one URL", () => {
    expect(conversationListQuery("ALL", { page: 1 })).toBe("status=ALL");
    expect(conversationListQuery("ALL", { page: 2 })).toBe("status=ALL&page=2");
  });
});

describe("fetchConversations", () => {
  it("calls the inbox endpoint with the built query", async () => {
    await fetchConversations("PROFILE", { brokerId: "b-1" });
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/v1/conversations/?type=BROKER_INQUIRY&type=PROFESSIONAL_INQUIRY&broker=b-1",
    );
  });
});

describe("resolveFilter", () => {
  it("accepts a known filter, case-insensitively", () => {
    expect(resolveFilter("ARCHIVED")).toBe("ARCHIVED");
    expect(resolveFilter("unread")).toBe("UNREAD");
  });

  it("falls back to ALL for anything else", () => {
    expect(resolveFilter(undefined)).toBe("ALL");
    expect(resolveFilter("")).toBe("ALL");
    expect(resolveFilter("NONSENSE")).toBe("ALL");
  });
});

describe("fetchConversation", () => {
  it("calls the detail endpoint rather than scanning the inbox", async () => {
    // Ruling 14: ConversationPagination.page_size is 20, so finding a row by
    // paging the inbox is silently wrong for anyone with 21 conversations.
    apiFetch.mockResolvedValue({ id: "c-1" });
    await fetchConversation("c-1");
    expect(apiFetch).toHaveBeenCalledWith("/api/v1/conversations/c-1/");
  });
});

describe("fetchThread", () => {
  it("calls the thread endpoint", async () => {
    await fetchThread("c-1");
    expect(apiFetch).toHaveBeenCalledWith("/api/v1/conversations/c-1/messages/");
  });

  it("passes a page through", async () => {
    await fetchThread("c-1", 3);
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/v1/conversations/c-1/messages/?page=3",
    );
  });
});

describe("postReply", () => {
  it("POSTs the body under the server's field name", async () => {
    apiFetch.mockResolvedValue({ id: "m-1" });
    await postReply("c-1", "Thank you, next Tuesday morning works for us.");
    expect(apiFetch).toHaveBeenCalledWith("/api/v1/conversations/c-1/messages/", {
      method: "POST",
      body: JSON.stringify({
        message: "Thank you, next Tuesday morning works for us.",
      }),
    });
  });
});

describe("markConversationRead", () => {
  it("POSTs an empty body to the read endpoint", async () => {
    apiFetch.mockResolvedValue({ marked_read: 2 });
    await markConversationRead("c-1");
    expect(apiFetch).toHaveBeenCalledWith("/api/v1/conversations/c-1/read/", {
      method: "POST",
      body: "{}",
    });
  });
});

describe("setConversationStatus", () => {
  it("PATCHes the status endpoint", async () => {
    apiFetch.mockResolvedValue({ id: "c-1", status: "ARCHIVED" });
    await setConversationStatus("c-1", "ARCHIVED");
    expect(apiFetch).toHaveBeenCalledWith("/api/v1/conversations/c-1/status/", {
      method: "PATCH",
      body: JSON.stringify({ status: "ARCHIVED" }),
    });
  });
});

describe("fetchBrokerDashboard", () => {
  it("calls the broker dashboard endpoint", async () => {
    apiFetch.mockResolvedValue({ published_listings: 0 });
    await fetchBrokerDashboard("b-1");
    expect(apiFetch).toHaveBeenCalledWith("/api/v1/brokers/b-1/dashboard/");
  });
});

describe("messageErrorKey", () => {
  it("maps a known ApiError code onto its dictionary key", () => {
    expect(messageErrorKey(new ApiError(403, "feature_disabled", "x"))).toBe(
      "messages.error.feature_disabled",
    );
  });

  it("maps an unknown ApiError code onto the generic key", () => {
    expect(messageErrorKey(new ApiError(500, "teapot", "x"))).toBe(
      "messages.error.unexpected_error",
    );
  });

  it("maps a 404 onto not_found even though DRF sends code not_found", () => {
    expect(messageErrorKey(new ApiError(404, "not_found", "x"))).toBe(
      "messages.error.not_found",
    );
  });

  it("maps a non-ApiError throwable onto the generic key", () => {
    expect(messageErrorKey(new Error("network"))).toBe(
      "messages.error.unexpected_error",
    );
  });

  it("maps the two codes this phase's own endpoints introduce", () => {
    expect(
      messageErrorKey(new ApiError(403, "conversation_filing_forbidden", "x")),
    ).toBe("messages.error.conversation_filing_forbidden");
    expect(messageErrorKey(new ApiError(403, "not_broker_member", "x"))).toBe(
      "messages.error.not_broker_member",
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && pnpm vitest run src/lib/api/conversations.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/api/conversations"`.

- [ ] **Step 3: Write `frontend/src/lib/api/conversations.ts`**

```ts
// The single place a /api/v1/conversations/ or broker-dashboard URL is built.
//
// apiFetch, never directoryFetch: directoryFetch is the UNAUTHENTICATED,
// server-side directory reader (it sends X-Internal-Service-Secret and a
// forwarded visitor IP and no Authorization header). An inbox fetched through it
// would be the Next.js server's, not the signed-in broker's. Everything here
// runs in the browser.
import { ApiError, apiFetch } from "@/lib/api/client";
import type { Paginated } from "@/lib/api/directory";

export type { Paginated };

export type ConversationStatus = "OPEN" | "ARCHIVED" | "BLOCKED";

export type ConversationType =
  | "LISTING_INQUIRY"
  | "BROKER_INQUIRY"
  | "PROFESSIONAL_INQUIRY"
  | "SUPPORT";

export type ConversationContextType =
  | "LISTING"
  | "BROKER"
  | "PROFESSIONAL"
  | "SUPPORT";

export interface ConversationContextRef {
  type: ConversationContextType;
  id: string;
  label: string;
  /** Canonical public URL per spec 4.1, or null where none can be derived
   * (a listing has no slug column; a support thread has no public page). */
  url: string | null;
}

/** Spec 28's conversation row, field for field. */
export interface ConversationRow {
  id: string;
  conversation_type: ConversationType;
  subject: string;
  status: ConversationStatus;
  last_message_at: string | null;
  created_at: string;
  unread_count: number;
  context: ConversationContextRef;
  counterparty_name: string;
  last_message_excerpt: string;
  /** Whose seat this is. Only the RECIPIENT side may archive (ruling 5), and
   * spec 2.1 requires that control's visibility to have a backend source
   * rather than being inferred from display text. */
  viewer_is_initiator: boolean;
}

export interface MessageRow {
  id: string;
  body: string;
  is_system: boolean;
  created_at: string;
  read_at: string | null;
  sender: { display_name: string; is_you: boolean };
}

export interface BrokerDashboardMessages {
  enabled: boolean;
  can_read: boolean;
  unread_conversations: number | null;
  unread_messages: number | null;
  new_inquiries_7d: number | null;
}

export interface BrokerDashboard {
  broker: { id: string; name: string; slug: string; status: string };
  published_listings: number;
  pending_approvals: number;
  messages: BrokerDashboardMessages;
}

/** Spec 28's five filters. The order is the order they render in. */
export type ConversationFilter =
  | "ALL"
  | "UNREAD"
  | "LISTING"
  | "PROFILE"
  | "ARCHIVED";

export const CONVERSATION_FILTERS: readonly ConversationFilter[] = [
  "ALL",
  "UNREAD",
  "LISTING",
  "PROFILE",
  "ARCHIVED",
];

export const FILTER_MESSAGE_KEYS: Record<ConversationFilter, string> = {
  ALL: "messages.filter.all",
  UNREAD: "messages.filter.unread",
  LISTING: "messages.filter.listing_inquiries",
  PROFILE: "messages.filter.profile_inquiries",
  ARCHIVED: "messages.filter.archived",
};

/** Turn a `?filter=` query value into a filter, defaulting to ALL.
 *
 * Lives HERE, beside CONVERSATION_FILTERS, and not in a page module: both the
 * server page at /dashboard/messages/ and the client page at
 * /dashboard/broker/messages/ need it, and a client component cannot import
 * from a server page module (that module also exports `generateMetadata` and
 * `dynamic`, which are route config, not values). */
export function resolveFilter(raw: string | undefined): ConversationFilter {
  const candidate = (raw ?? "").toUpperCase();
  return (CONVERSATION_FILTERS as readonly string[]).includes(candidate)
    ? (candidate as ConversationFilter)
    : "ALL";
}

interface ListOptions {
  brokerId?: string;
  page?: number;
}

/** Spec 28's five filters expressed in Phase 6's query parameters (its contract
 * rule 7). URLSearchParams is used with `append`, not `set`, for `type`,
 * because "Profile inquiries" is TWO conversation types and the server matches
 * each value exactly — a comma-joined value filters to nothing. */
export function conversationListQuery(
  filter: ConversationFilter,
  { brokerId, page }: ListOptions,
): string {
  const search = new URLSearchParams();
  switch (filter) {
    case "ALL":
      search.set("status", "ALL");
      break;
    case "UNREAD":
      // No status: the server's default is OPEN, which is what "Unread" means
      // on an inbox. Archived-but-unread is reachable through ARCHIVED.
      search.set("unread", "true");
      break;
    case "LISTING":
      search.append("type", "LISTING_INQUIRY");
      break;
    case "PROFILE":
      search.append("type", "BROKER_INQUIRY");
      search.append("type", "PROFESSIONAL_INQUIRY");
      break;
    case "ARCHIVED":
      search.set("status", "ARCHIVED");
      break;
  }
  if (brokerId) {
    search.set("broker", brokerId);
  }
  // Page 1 is the bare query: ?page=1 would make the first page reachable at two
  // URLs, the same reasoning the directory page already applies.
  if (page && page > 1) {
    search.set("page", String(page));
  }
  return search.toString();
}

export async function fetchConversations(
  filter: ConversationFilter,
  options: ListOptions = {},
): Promise<Paginated<ConversationRow>> {
  const query = conversationListQuery(filter, options);
  return apiFetch<Paginated<ConversationRow>>(
    query ? `/api/v1/conversations/?${query}` : "/api/v1/conversations/",
  );
}

/** One conversation's row, from the detail endpoint Task 1 adds.
 *
 * Never by scanning `fetchConversations("ALL")`: that returns one page of 20,
 * so a broker's 21st conversation would report "not available" (ruling 14). */
export async function fetchConversation(
  conversationId: string,
): Promise<ConversationRow> {
  return apiFetch<ConversationRow>(`/api/v1/conversations/${conversationId}/`);
}

export async function fetchThread(
  conversationId: string,
  page?: number,
): Promise<Paginated<MessageRow>> {
  const suffix = page && page > 1 ? `?page=${page}` : "";
  return apiFetch<Paginated<MessageRow>>(
    `/api/v1/conversations/${conversationId}/messages/${suffix}`,
  );
}

export async function postReply(
  conversationId: string,
  body: string,
): Promise<MessageRow> {
  // The server's field is `message`; ours is `body`. This is the one place the
  // two names meet, exactly as Phase 6's InquiryCreateView is on its side.
  return apiFetch<MessageRow>(
    `/api/v1/conversations/${conversationId}/messages/`,
    { method: "POST", body: JSON.stringify({ message: body }) },
  );
}

export async function markConversationRead(
  conversationId: string,
): Promise<{ marked_read: number }> {
  return apiFetch<{ marked_read: number }>(
    `/api/v1/conversations/${conversationId}/read/`,
    { method: "POST", body: "{}" },
  );
}

export async function setConversationStatus(
  conversationId: string,
  status: Extract<ConversationStatus, "OPEN" | "ARCHIVED">,
): Promise<ConversationRow> {
  return apiFetch<ConversationRow>(
    `/api/v1/conversations/${conversationId}/status/`,
    { method: "PATCH", body: JSON.stringify({ status }) },
  );
}

export async function fetchBrokerDashboard(
  brokerId: string,
): Promise<BrokerDashboard> {
  return apiFetch<BrokerDashboard>(`/api/v1/brokers/${brokerId}/dashboard/`);
}

const KNOWN_ERROR_CODES = new Set([
  "feature_disabled",
  "authentication_required",
  "rate_limited",
  "conversation_closed",
  "conversation_superseded",
  "invalid_conversation_status",
  "conversation_filing_forbidden",
  // Ruling 15: the session payload lists memberships regardless of the
  // organization's status, so a member of a SUSPENDED brokerage reaches a screen
  // whose API then refuses them. Without this entry the screen would say
  // "Something went wrong" for a condition that has a precise explanation.
  "not_broker_member",
  "not_found",
  "validation_error",
]);

/** Map a thrown error onto a dictionary key.
 *
 * Spec 30.2 asks for a localized message, and the backend's strings are English
 * only (Phase 6 Known Limitation 13) — so the client renders its own copy keyed
 * by `error.code` and never renders `error.message`. An unrecognised code lands
 * on the generic key rather than leaking a developer string to a person. */
export function messageErrorKey(error: unknown): string {
  if (error instanceof ApiError && KNOWN_ERROR_CODES.has(error.code)) {
    return `messages.error.${error.code}`;
  }
  return "messages.error.unexpected_error";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && pnpm vitest run src/lib/api/conversations.test.ts`
Expected: PASS — **23 tests**.

Run: `cd frontend && pnpm lint && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/api/conversations.ts frontend/src/lib/api/conversations.test.ts
git commit -m "feat(messages): conversations API client with spec 28's five filters (Phase 19 Task 4)"
```

---

### Task 5: The inbox — filters, row and list

**Files:**
- Create: `frontend/src/components/messages/ConversationFilters.tsx` + `.test.tsx`
- Create: `frontend/src/components/messages/ConversationRow.tsx` + `.test.tsx`
- Create: `frontend/src/components/messages/ConversationList.tsx` + `.test.tsx`

**Interfaces:**
- Consumes: `CONVERSATION_FILTERS`, `FILTER_MESSAGE_KEYS`, types `ConversationFilter`, `ConversationRow` from `@/lib/api/conversations`; `tConversations`, `formatConversationMessage` from `@/lib/i18n/conversations`; `type Locale` from `@/lib/i18n/directory`.
- Produces:
  - `ConversationFilters` — props `{ locale, active, hrefFor }`, where `hrefFor(filter) => string`
  - `ConversationRowCard` — props `{ locale, row, href }`
  - `ConversationList` — props `{ locale, rows, hrefFor }`

**Note (why the filters are links, not buttons).** The active filter lives in the URL (`?filter=UNREAD`), so a filtered inbox is shareable and the browser's back button works — the same property Phase 5 required of the directory's filters (spec §29.4's "Filter URL state must be shareable and back-button safe", applied here because it is the same class of control). The parent supplies `hrefFor` so the identical component serves `/dashboard/messages/` and `/dashboard/broker/messages/` without knowing either path.

- [ ] **Step 1: Write the failing tests**

`frontend/src/components/messages/ConversationFilters.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ConversationFilters from "@/components/messages/ConversationFilters";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const hrefFor = (filter: string) => `/dashboard/messages/?filter=${filter}`;

describe("ConversationFilters", () => {
  it("renders exactly spec 28's five filters, in order", () => {
    render(<ConversationFilters locale="en" active="ALL" hrefFor={hrefFor} />);
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "All",
      "Unread",
      "Listing inquiries",
      "Profile inquiries",
      "Archived",
    ]);
  });

  it("marks the active filter with aria-current", () => {
    render(<ConversationFilters locale="en" active="ARCHIVED" hrefFor={hrefFor} />);
    expect(screen.getByRole("link", { name: "Archived" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("link", { name: "All" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("renders Italian copy for the it locale", () => {
    render(<ConversationFilters locale="it" active="ALL" hrefFor={hrefFor} />);
    expect(screen.getByRole("link", { name: "Non letti" })).toBeInTheDocument();
  });

  it("builds every href through the caller's hrefFor", () => {
    render(
      <ConversationFilters
        locale="en"
        active="ALL"
        hrefFor={(filter) => `/dashboard/broker/messages/?filter=${filter}`}
      />,
    );
    expect(screen.getByRole("link", { name: "Unread" })).toHaveAttribute(
      "href",
      "/dashboard/broker/messages/?filter=UNREAD",
    );
  });
});
```

`frontend/src/components/messages/ConversationRow.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ConversationRowCard from "@/components/messages/ConversationRow";
import type { ConversationRow } from "@/lib/api/conversations";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const ROW: ConversationRow = {
  id: "c-1",
  conversation_type: "BROKER_INQUIRY",
  subject: "Fleet question",
  status: "OPEN",
  last_message_at: "2026-09-18T09:30:00Z",
  created_at: "2026-09-18T09:00:00Z",
  unread_count: 2,
  context: {
    type: "BROKER",
    id: "b-1",
    label: "Phase19 Alpha Brokers",
    url: "/brokers/phase19-alpha-brokers/",
  },
  counterparty_name: "Ada Rossi",
  last_message_excerpt: "I would like to arrange a viewing next week.",
  viewer_is_initiator: false,
};

describe("ConversationRowCard", () => {
  it("shows every field spec 28's row names", () => {
    const { container } = render(
      <ConversationRowCard locale="en" row={ROW} href="/dashboard/messages/c-1/" />,
    );
    expect(screen.getByText("Ada Rossi")).toBeInTheDocument();
    // The context type and the label are separate elements on purpose (see the
    // component), so each is addressable by its exact text. If this ever has to
    // become a regex, the component has regressed to one span.
    expect(screen.getByText("Broker")).toBeInTheDocument();
    expect(screen.getByText("Phase19 Alpha Brokers")).toBeInTheDocument();
    expect(
      screen.getByText("I would like to arrange a viewing next week."),
    ).toBeInTheDocument();
    expect(screen.getByText("2 unread")).toBeInTheDocument();
    // querySelector, not getByRole("time"): `time` is not an ARIA role (it is
    // not in the ARIA role vocabulary, and jsx-a11y's no-noninteractive-element-
    // to-interactive-role / aria-role rules reject `role="time"` on the
    // element), so there is no role to query and none to add.
    expect(container.querySelector("time")).toHaveAttribute(
      "datetime",
      "2026-09-18T09:30:00Z",
    );
  });

  it("falls back to a localized placeholder for a blank sender name", () => {
    // Phase 6 refuses to put an email address into sender_name_snapshot, so a
    // blank name is the common case and must never render as empty space.
    render(
      <ConversationRowCard
        locale="en"
        row={{ ...ROW, counterparty_name: "" }}
        href="/x/"
      />,
    );
    expect(screen.getByText("Unnamed sender")).toBeInTheDocument();
  });

  it("hides the unread badge at zero rather than showing '0 unread'", () => {
    render(
      <ConversationRowCard locale="en" row={{ ...ROW, unread_count: 0 }} href="/x/" />,
    );
    expect(screen.queryByText(/unread/)).not.toBeInTheDocument();
  });

  it("marks an archived row with a visible badge, not only a colour", () => {
    // Spec 29.6: state is never conveyed by colour alone.
    render(
      <ConversationRowCard
        locale="en"
        row={{ ...ROW, status: "ARCHIVED" }}
        href="/x/"
      />,
    );
    expect(screen.getByText("Archived")).toBeInTheDocument();
    expect(screen.queryByText("Blocked")).not.toBeInTheDocument();
  });

  it("labels a blocked row Blocked, not Archived", () => {
    // Spec 2.1: a visible state must be the state the data says. A `!== "OPEN"`
    // badge condition would call every blocked thread archived.
    render(
      <ConversationRowCard
        locale="en"
        row={{ ...ROW, status: "BLOCKED" }}
        href="/x/"
      />,
    );
    expect(screen.getByText("Blocked")).toBeInTheDocument();
    expect(screen.queryByText("Archived")).not.toBeInTheDocument();
  });

  it("shows no status badge at all on an open row", () => {
    render(<ConversationRowCard locale="en" row={ROW} href="/x/" />);
    expect(screen.queryByText("Archived")).not.toBeInTheDocument();
    expect(screen.queryByText("Blocked")).not.toBeInTheDocument();
  });

  it("renders no timestamp at all when there is no last message", () => {
    const { container } = render(
      <ConversationRowCard
        locale="en"
        row={{ ...ROW, last_message_at: null }}
        href="/x/"
      />,
    );
    expect(container.querySelector("time")).toBeNull();
  });

  it("never renders an email address or a phone number", () => {
    const { container } = render(
      <ConversationRowCard locale="en" row={ROW} href="/x/" />,
    );
    expect(container.textContent).not.toMatch(/@/);
    expect(container.textContent).not.toMatch(/\+\d{6,}/);
  });
});
```

`frontend/src/components/messages/ConversationList.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ConversationList from "@/components/messages/ConversationList";
import type { ConversationRow } from "@/lib/api/conversations";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

function row(id: string, name: string): ConversationRow {
  return {
    id,
    conversation_type: "BROKER_INQUIRY",
    subject: `Subject ${id}`,
    status: "OPEN",
    last_message_at: "2026-09-18T09:30:00Z",
    created_at: "2026-09-18T09:00:00Z",
    unread_count: 0,
    context: { type: "BROKER", id: "b-1", label: "Alpha", url: null },
    counterparty_name: name,
    last_message_excerpt: "Hello there, about the boat.",
    viewer_is_initiator: false,
  };
}

describe("ConversationList", () => {
  it("renders one list item per conversation", () => {
    render(
      <ConversationList
        locale="en"
        rows={[row("c-1", "Ada"), row("c-2", "Bo")]}
        hrefFor={(id) => `/dashboard/messages/${id}/`}
      />,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("link", { name: /Ada/ })).toHaveAttribute(
      "href",
      "/dashboard/messages/c-1/",
    );
  });

  it("shows a real empty state rather than an empty list", () => {
    render(
      <ConversationList locale="en" rows={[]} hrefFor={() => "/x/"} />,
    );
    expect(
      screen.getByText("No conversations match this filter."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && pnpm vitest run src/components/messages/`
Expected: FAIL — three unresolved imports.

- [ ] **Step 3a: Write `frontend/src/components/messages/ConversationFilters.tsx`**

```tsx
import Link from "next/link";

import {
  CONVERSATION_FILTERS,
  FILTER_MESSAGE_KEYS,
  type ConversationFilter,
} from "@/lib/api/conversations";
import { tConversations } from "@/lib/i18n/conversations";
import type { Locale } from "@/lib/i18n/directory";

interface Props {
  locale: Locale;
  active: ConversationFilter;
  /** The parent owns the URL shape, so this identical component serves both
   * /dashboard/messages/ and /dashboard/broker/messages/. */
  hrefFor: (filter: ConversationFilter) => string;
}

const BASE =
  "rounded-full border px-space-md py-space-xs font-label-md text-label-md";

/** Spec 28's five inbox filters.
 *
 * Links rather than buttons, because the active filter lives in the URL: a
 * filtered inbox is then shareable and the back button works, which is the
 * property spec 29.4 requires of filter state elsewhere in the product. */
export default function ConversationFilters({ locale, active, hrefFor }: Props) {
  return (
    <nav aria-label={tConversations(locale, "messages.filter.label")}>
      <ul className="flex flex-wrap gap-space-sm">
        {CONVERSATION_FILTERS.map((filter) => {
          const isActive = filter === active;
          return (
            <li key={filter}>
              <Link
                href={hrefFor(filter)}
                aria-current={isActive ? "true" : undefined}
                className={`${BASE} ${
                  isActive
                    ? "border-primary bg-primary text-on-primary"
                    : "border-outline-variant text-on-surface-variant"
                }`}
              >
                {tConversations(locale, FILTER_MESSAGE_KEYS[filter])}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 3b: Write `frontend/src/components/messages/ConversationRow.tsx`**

```tsx
import Link from "next/link";

import type { ConversationRow } from "@/lib/api/conversations";
import {
  formatConversationMessage,
  tConversations,
} from "@/lib/i18n/conversations";
import type { Locale } from "@/lib/i18n/directory";

interface Props {
  locale: Locale;
  row: ConversationRow;
  href: string;
}

/** Spec 28's conversation row: "sender display name, context/listing, last
 * message excerpt, timestamp and unread count."
 *
 * Carries no contact value of any kind. Phase 6's serializers return none, and
 * ConversationRow has no field that could hold one — contact reveal is Phase 7's
 * own endpoint, after a grant. */
export default function ConversationRowCard({ locale, row, href }: Props) {
  const senderName =
    row.counterparty_name.trim() ||
    tConversations(locale, "messages.sender_unnamed");

  return (
    <Link
      href={href}
      className="block rounded-xl border border-outline-variant p-space-md hover:border-primary"
    >
      <div className="flex flex-wrap items-baseline gap-space-sm">
        <span className="font-title-sm text-title-sm text-on-surface">
          {senderName}
        </span>
        {/* The context type and the context label are SEPARATE elements, not
            one span holding `type + " · " + label`. Testing Library matches an
            element on the concatenation of its direct text-node children, so a
            single span would have the accessible text "Broker · Phase19 Alpha
            Brokers" and no exact query could ever address the label on its own.
            Splitting them makes each independently assertable and costs one
            element; the flex `gap-space-sm` on the parent already spaces them,
            and the separator is decorative so it is aria-hidden. */}
        <span className="font-body-sm text-on-surface-variant">
          {tConversations(locale, `messages.context.${row.context.type}`)}
        </span>
        {row.context.label ? (
          <>
            <span aria-hidden="true" className="font-body-sm text-on-surface-variant">
              ·
            </span>
            <span className="font-body-sm text-on-surface-variant">
              {row.context.label}
            </span>
          </>
        ) : null}
        {row.status === "ARCHIVED" ? (
          // Spec 29.6: never convey state by colour alone. Gated on ARCHIVED
          // exactly, never on `!== "OPEN"` — a BLOCKED thread is not archived,
          // and labelling it "Archived" would be a false visible state (spec 2.1).
          <span className="rounded border border-outline-variant px-space-xs font-label-sm text-label-sm text-on-surface-variant">
            {tConversations(locale, "messages.archived_badge")}
          </span>
        ) : null}
        {row.status === "BLOCKED" ? (
          <span className="rounded border border-outline-variant px-space-xs font-label-sm text-label-sm text-on-surface-variant">
            {tConversations(locale, "messages.blocked_badge")}
          </span>
        ) : null}
        {row.unread_count > 0 ? (
          <span className="rounded-full bg-primary px-space-sm font-label-sm text-label-sm text-on-primary">
            {formatConversationMessage(
              tConversations(locale, "messages.unread_count"),
              { count: row.unread_count },
            )}
          </span>
        ) : null}
        {row.last_message_at ? (
          // No `role` attribute: `time` is not an ARIA role, and jsx-a11y
          // rejects inventing one. The test addresses this with
          // container.querySelector("time").
          <time
            dateTime={row.last_message_at}
            className="ml-auto font-body-sm text-on-surface-variant"
          >
            {new Date(row.last_message_at).toLocaleString(locale)}
          </time>
        ) : null}
      </div>
      <p className="mt-space-xs font-body-md text-on-surface-variant">
        {row.last_message_excerpt}
      </p>
    </Link>
  );
}
```

- [ ] **Step 3c: Write `frontend/src/components/messages/ConversationList.tsx`**

```tsx
import ConversationRowCard from "@/components/messages/ConversationRow";
import type { ConversationRow } from "@/lib/api/conversations";
import { tConversations } from "@/lib/i18n/conversations";
import type { Locale } from "@/lib/i18n/directory";

interface Props {
  locale: Locale;
  rows: ConversationRow[];
  hrefFor: (conversationId: string) => string;
}

export default function ConversationList({ locale, rows, hrefFor }: Props) {
  if (rows.length === 0) {
    return (
      <p className="font-body-md text-on-surface-variant">
        {tConversations(locale, "messages.empty")}
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-space-sm">
      {rows.map((row) => (
        <li key={row.id}>
          <ConversationRowCard locale={locale} row={row} href={hrefFor(row.id)} />
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && pnpm vitest run src/components/messages/`
Expected: PASS — **14 tests** (4 filters, 8 row, 2 list).

Run: `cd frontend && pnpm lint && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/messages
git commit -m "feat(messages): inbox filters, row and list components (Phase 19 Task 5)"
```

---

### Task 6: The thread — messages, context sidebar and reply composer

**Files:**
- Create: `frontend/src/components/messages/ConversationContextPanel.tsx` + `.test.tsx`
- Create: `frontend/src/components/messages/ReplyComposer.tsx` + `.test.tsx`
- Create: `frontend/src/components/messages/ConversationThread.tsx` + `.test.tsx`

**Interfaces:**
- Consumes: types `ConversationRow`, `MessageRow` from `@/lib/api/conversations`; `tConversations`, `formatConversationMessage` from `@/lib/i18n/conversations`; `type Locale`.
- Produces:
  - `ConversationContextPanel` — props `{ locale, context }`
  - `NAVIGABLE_URL_PREFIXES: readonly string[]` (exported from `ConversationContextPanel.tsx`)
  - `ReplyComposer` — props `{ locale, disabled, onSend }` where `onSend(body: string) => Promise<void>`
  - `ConversationThread` — props `{ locale, conversation, messages, onSend, onToggleArchive }`
- Constants: `REPLY_MIN_LENGTH = 20`, `REPLY_MAX_LENGTH = 4000` (spec §15.1's Message rule, which applies to replies too — Phase 6's `MessageCreateSerializer` enforces the same numbers server-side; these are usability only, per spec §2.2).

**Note (ruling 9, restated where it is implemented).** `context.url` is the backend's canonical URL and may point at a page this app has not built. `NAVIGABLE_URL_PREFIXES` is the one-line allowlist of prefixes that exist today — `/services/professionals/` and nothing else, because `frontend/src/app/` has no `/boats/` and no `/brokers/` route (verified). Phase 20 builds both and deletes the allowlist. A non-navigable context renders its label as plain text, never as a link to a 404 (spec §39).

- [ ] **Step 1: Write the failing tests**

`frontend/src/components/messages/ConversationContextPanel.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ConversationContextPanel from "@/components/messages/ConversationContextPanel";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("ConversationContextPanel", () => {
  it("links a professional context, because that page exists", () => {
    render(
      <ConversationContextPanel
        locale="en"
        context={{
          type: "PROFESSIONAL",
          id: "p-1",
          label: "Phase19 Survey Co",
          url: "/services/professionals/phase19-survey-co/",
        }}
      />,
    );
    expect(screen.getByRole("link", { name: /Phase19 Survey Co/ })).toHaveAttribute(
      "href",
      "/services/professionals/phase19-survey-co/",
    );
  });

  it("does NOT link a broker context, because /brokers/ has no page yet", () => {
    // Spec 39 and the precedent in PrimaryNav.test.tsx: never ship a control
    // that leads to a 404. Phase 20 builds /brokers/ and deletes the allowlist.
    render(
      <ConversationContextPanel
        locale="en"
        context={{
          type: "BROKER",
          id: "b-1",
          label: "Phase19 Alpha Brokers",
          url: "/brokers/phase19-alpha-brokers/",
        }}
      />,
    );
    expect(screen.getByText("Phase19 Alpha Brokers")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("does not link a listing context, whose url is null", () => {
    render(
      <ConversationContextPanel
        locale="en"
        context={{ type: "LISTING", id: "l-1", label: "Beneteau Oceanis 46.1", url: null }}
      />,
    );
    expect(screen.getByText("Beneteau Oceanis 46.1")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("names the context type in the reader's locale", () => {
    render(
      <ConversationContextPanel
        locale="es"
        context={{ type: "LISTING", id: "l-1", label: "Oceanis", url: null }}
      />,
    );
    expect(screen.getByText("Anuncio")).toBeInTheDocument();
  });
});
```

`frontend/src/components/messages/ReplyComposer.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import ReplyComposer from "@/components/messages/ReplyComposer";

const LONG = "Thank you for getting in touch, next Tuesday morning works well.";

describe("ReplyComposer", () => {
  it("refuses a reply below spec 15.1's 20-character floor without calling the API", async () => {
    const onSend = vi.fn();
    render(<ReplyComposer locale="en" disabled={false} onSend={onSend} />);
    await userEvent.type(screen.getByLabelText("Reply"), "too short");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(
      screen.getByText("A reply must be at least 20 characters."),
    ).toBeInTheDocument();
    expect(onSend).not.toHaveBeenCalled();
  });

  it("sends a valid reply and clears the box", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<ReplyComposer locale="en" disabled={false} onSend={onSend} />);
    const box = screen.getByLabelText("Reply");
    await userEvent.type(box, LONG);
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(onSend).toHaveBeenCalledWith(LONG));
    await waitFor(() => expect(box).toHaveValue(""));
  });

  it("keeps the text when sending fails, so nothing a person wrote is lost", async () => {
    const onSend = vi.fn().mockRejectedValue(new Error("boom"));
    render(<ReplyComposer locale="en" disabled={false} onSend={onSend} />);
    const box = screen.getByLabelText("Reply");
    await userEvent.type(box, LONG);
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(box).toHaveValue(LONG));
  });

  it("disables the control entirely when the thread is not open", () => {
    render(<ReplyComposer locale="en" disabled onSend={vi.fn()} />);
    expect(screen.getByLabelText("Reply")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("prevents a double submit while a send is in flight", async () => {
    let resolve!: () => void;
    const onSend = vi.fn(
      () => new Promise<void>((r) => {
        resolve = r;
      }),
    );
    render(<ReplyComposer locale="en" disabled={false} onSend={onSend} />);
    await userEvent.type(screen.getByLabelText("Reply"), LONG);
    const button = screen.getByRole("button", { name: "Send" });
    await userEvent.click(button);
    expect(screen.getByRole("button", { name: "Sending…" })).toBeDisabled();
    resolve();
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
  });
});
```

`frontend/src/components/messages/ConversationThread.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import ConversationThread from "@/components/messages/ConversationThread";
import type { ConversationRow, MessageRow } from "@/lib/api/conversations";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const CONVERSATION: ConversationRow = {
  id: "c-1",
  conversation_type: "BROKER_INQUIRY",
  subject: "Fleet question",
  status: "OPEN",
  last_message_at: "2026-09-18T09:30:00Z",
  created_at: "2026-09-18T09:00:00Z",
  unread_count: 0,
  context: { type: "BROKER", id: "b-1", label: "Phase19 Alpha Brokers", url: null },
  counterparty_name: "Ada Rossi",
  last_message_excerpt: "Hello",
  viewer_is_initiator: false,
};

function message(id: string, overrides: Partial<MessageRow> = {}): MessageRow {
  return {
    id,
    body: `Body of ${id}`,
    is_system: false,
    created_at: "2026-09-18T09:00:00Z",
    read_at: null,
    sender: { display_name: "Ada Rossi", is_you: false },
    ...overrides,
  };
}

describe("ConversationThread", () => {
  it("renders the subject, the context panel and every message", () => {
    render(
      <ConversationThread
        locale="en"
        conversation={CONVERSATION}
        messages={[message("m-1"), message("m-2")]}
        onSend={vi.fn()}
        onToggleArchive={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Fleet question" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Phase19 Alpha Brokers")).toBeInTheDocument();
    expect(screen.getByText("Body of m-1")).toBeInTheDocument();
    expect(screen.getByText("Body of m-2")).toBeInTheDocument();
  });

  it("labels the viewer's own messages without naming them", () => {
    render(
      <ConversationThread
        locale="en"
        conversation={CONVERSATION}
        messages={[
          message("m-1", { sender: { display_name: "Bo Reader", is_you: true } }),
        ]}
        onSend={vi.fn()}
        onToggleArchive={vi.fn()}
      />,
    );
    expect(screen.getByText("You")).toBeInTheDocument();
  });

  it("falls back to a localized placeholder for a blank sender name", () => {
    render(
      <ConversationThread
        locale="en"
        conversation={CONVERSATION}
        messages={[message("m-1", { sender: { display_name: "", is_you: false } })]}
        onSend={vi.fn()}
        onToggleArchive={vi.fn()}
      />,
    );
    expect(screen.getByText("Unnamed sender")).toBeInTheDocument();
  });

  it("marks a system note as one", () => {
    render(
      <ConversationThread
        locale="en"
        conversation={CONVERSATION}
        messages={[message("m-1", { is_system: true })]}
        onSend={vi.fn()}
        onToggleArchive={vi.fn()}
      />,
    );
    expect(screen.getByText("System note")).toBeInTheDocument();
  });

  it("offers no archive control to the sender of the inquiry", async () => {
    // Ruling 5: Conversation has ONE status column, so only the recipient side
    // may file. The server refuses with `conversation_filing_forbidden`; this is
    // the UI half, driven by the backend's own `viewer_is_initiator` rather than
    // by the client guessing from display text (spec 2.1).
    render(
      <ConversationThread
        locale="en"
        conversation={{ ...CONVERSATION, viewer_is_initiator: true }}
        messages={[]}
        onSend={vi.fn()}
        onToggleArchive={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Move to inbox" }),
    ).not.toBeInTheDocument();
    // …but they can still reply. Filing is not participation.
    expect(screen.getByLabelText("Reply")).toBeEnabled();
  });

  it("offers Archive on an open thread and Move to inbox on an archived one", async () => {
    const onToggleArchive = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <ConversationThread
        locale="en"
        conversation={CONVERSATION}
        messages={[]}
        onSend={vi.fn()}
        onToggleArchive={onToggleArchive}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(onToggleArchive).toHaveBeenCalledWith("ARCHIVED");

    rerender(
      <ConversationThread
        locale="en"
        conversation={{ ...CONVERSATION, status: "ARCHIVED" }}
        messages={[]}
        onSend={vi.fn()}
        onToggleArchive={onToggleArchive}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Move to inbox" }));
    expect(onToggleArchive).toHaveBeenCalledWith("OPEN");
  });

  it("disables the composer on a blocked thread and labels it Blocked", () => {
    // Spec 2.1: the badge must say what the status IS. A `!== "OPEN"` condition
    // would render "Archived" here, which is a different state with a different
    // meaning and a different way out of it.
    render(
      <ConversationThread
        locale="en"
        conversation={{ ...CONVERSATION, status: "BLOCKED" }}
        messages={[]}
        onSend={vi.fn()}
        onToggleArchive={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Reply")).toBeDisabled();
    expect(screen.getByText("Blocked")).toBeInTheDocument();
    expect(screen.queryByText("Archived")).not.toBeInTheDocument();
    // …and no filing control, because BLOCKED is not a state this phase's
    // endpoint can leave (ruling 4).
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Move to inbox" }),
    ).not.toBeInTheDocument();
  });

  it("shows a real empty state for a thread with no messages", () => {
    render(
      <ConversationThread
        locale="en"
        conversation={CONVERSATION}
        messages={[]}
        onSend={vi.fn()}
        onToggleArchive={vi.fn()}
      />,
    );
    expect(
      screen.getByText("This conversation has no messages yet."),
    ).toBeInTheDocument();
  });

  it("renders no email address or phone number anywhere in the thread", () => {
    // Phase 6's MessageSerializer returns neither sender_email_snapshot nor
    // sender_phone_snapshot; this is the DOM-side half of that guarantee.
    const { container } = render(
      <ConversationThread
        locale="en"
        conversation={CONVERSATION}
        messages={[message("m-1"), message("m-2")]}
        onSend={vi.fn()}
        onToggleArchive={vi.fn()}
      />,
    );
    expect(container.textContent).not.toMatch(/@/);
    expect(container.textContent).not.toMatch(/\+\d{6,}/);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && pnpm vitest run src/components/messages/`
Expected: FAIL — three unresolved imports (the Task 5 tests still pass).

- [ ] **Step 3a: Write `frontend/src/components/messages/ConversationContextPanel.tsx`**

```tsx
import Link from "next/link";

import type { ConversationContextRef } from "@/lib/api/conversations";
import { tConversations } from "@/lib/i18n/conversations";
import type { Locale } from "@/lib/i18n/directory";

/** The route prefixes this application can actually navigate to today.
 *
 * `context.url` from the API is the entity's CANONICAL public URL per spec 4.1
 * and is truthful about the product; it is not a promise that this Next.js app
 * has built the page. `src/app/` has no `/boats/` and no `/brokers/` route, and
 * spec 39 forbids shipping a control that leads nowhere. Phase 20 builds both
 * and deletes this constant along with the check below. */
export const NAVIGABLE_URL_PREFIXES: readonly string[] = [
  "/services/professionals/",
];

function isNavigable(url: string | null): url is string {
  return url !== null && NAVIGABLE_URL_PREFIXES.some((p) => url.startsWith(p));
}

interface Props {
  locale: Locale;
  context: ConversationContextRef;
}

/** Spec 28's thread "context sidebar, listing/profile link". */
export default function ConversationContextPanel({ locale, context }: Props) {
  const typeLabel = tConversations(locale, `messages.context.${context.type}`);
  return (
    <aside
      aria-labelledby="thread-context-heading"
      className="rounded-xl border border-outline-variant p-space-md"
    >
      <h2
        id="thread-context-heading"
        className="font-label-md text-label-md text-on-surface-variant"
      >
        {tConversations(locale, "messages.thread.context_heading")}
      </h2>
      <p className="mt-space-xs font-body-sm text-on-surface-variant">{typeLabel}</p>
      {isNavigable(context.url) ? (
        <Link
          href={context.url}
          className="mt-space-xs block font-title-sm text-title-sm text-primary underline"
        >
          {context.label}
        </Link>
      ) : (
        <p className="mt-space-xs font-title-sm text-title-sm text-on-surface">
          {context.label}
        </p>
      )}
    </aside>
  );
}
```

- [ ] **Step 3b: Write `frontend/src/components/messages/ReplyComposer.tsx`**

```tsx
"use client";

import { useState } from "react";

import { tConversations } from "@/lib/i18n/conversations";
import type { Locale } from "@/lib/i18n/directory";

// Spec 15.1's Message rule, which applies to a reply too. The SERVER is the
// authority (Phase 6's MessageCreateSerializer enforces the identical numbers);
// these exist only so a person is told before a round trip (spec 2.2).
export const REPLY_MIN_LENGTH = 20;
export const REPLY_MAX_LENGTH = 4000;

interface Props {
  locale: Locale;
  disabled: boolean;
  onSend: (body: string) => Promise<void>;
}

export default function ReplyComposer({ locale, disabled, onSend }: Props) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = body.trim();
    if (trimmed.length < REPLY_MIN_LENGTH) {
      setError(tConversations(locale, "messages.reply.too_short"));
      return;
    }
    if (trimmed.length > REPLY_MAX_LENGTH) {
      setError(tConversations(locale, "messages.reply.too_long"));
      return;
    }
    setError(null);
    setSending(true);
    try {
      await onSend(trimmed);
      // Cleared only on success: a failed send must not throw away what a person
      // wrote, which is the one unrecoverable failure mode of a composer.
      setBody("");
    } catch {
      // The parent owns the error banner — it is the only layer that knows the
      // error code. Here we simply stop and keep the text.
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-space-lg">
      <label
        htmlFor="reply-body"
        className="block font-label-md text-label-md text-on-surface"
      >
        {tConversations(locale, "messages.reply.label")}
      </label>
      <textarea
        id="reply-body"
        name="reply-body"
        rows={4}
        value={body}
        disabled={disabled || sending}
        onChange={(event) => setBody(event.target.value)}
        placeholder={tConversations(locale, "messages.reply.placeholder")}
        aria-invalid={error !== null}
        aria-describedby={error ? "reply-error" : undefined}
        className="mt-space-xs w-full rounded-lg border border-outline-variant p-space-sm font-body-md"
      />
      {error ? (
        <p id="reply-error" role="alert" className="mt-space-xs font-body-sm text-error">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={disabled || sending}
        className="mt-space-sm rounded-full bg-primary px-space-lg py-space-sm font-label-md text-label-md text-on-primary disabled:opacity-50"
      >
        {tConversations(
          locale,
          sending ? "messages.reply.sending" : "messages.reply.send",
        )}
      </button>
    </form>
  );
}
```

- [ ] **Step 3c: Write `frontend/src/components/messages/ConversationThread.tsx`**

```tsx
"use client";

import ConversationContextPanel from "@/components/messages/ConversationContextPanel";
import ReplyComposer from "@/components/messages/ReplyComposer";
import type { ConversationRow, MessageRow } from "@/lib/api/conversations";
import { tConversations } from "@/lib/i18n/conversations";
import type { Locale } from "@/lib/i18n/directory";

interface Props {
  locale: Locale;
  conversation: ConversationRow;
  messages: MessageRow[];
  onSend: (body: string) => Promise<void>;
  onToggleArchive: (next: "OPEN" | "ARCHIVED") => Promise<void>;
}

/** Spec 28's thread: "messages, context sidebar, listing/profile link and reply
 * composer". Presentational — every network call belongs to the parent screen,
 * which is what lets this identical component serve both the role-neutral and
 * the broker-scoped route. */
export default function ConversationThread({
  locale,
  conversation,
  messages,
  onSend,
  onToggleArchive,
}: Props) {
  const isOpen = conversation.status === "OPEN";
  const archived = conversation.status === "ARCHIVED";
  // Ruling 5: only the recipient side may file, because spec 11.8 gives
  // Conversation one shared `status` column and a sender who archived would be
  // pulling a live lead out of the brokerage's default inbox. `viewer_is_initiator`
  // comes from the server (spec 2.1); this is the control's visibility, and
  // messaging.services.set_conversation_status is the rule.
  const canFile =
    conversation.status !== "BLOCKED" && !conversation.viewer_is_initiator;

  return (
    <div className="grid gap-space-lg lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section aria-labelledby="thread-subject">
        <div className="flex flex-wrap items-center gap-space-sm">
          <h1
            id="thread-subject"
            className="font-headline-sm text-headline-sm text-primary"
          >
            {conversation.subject}
          </h1>
          {/* Gated on the exact status, never on `!== "OPEN"`. A BLOCKED thread
              is not an archived one, and spec 2.1 forbids showing a state the
              data does not support — the earlier `!== "OPEN"` form labelled
              every blocked conversation "Archived". */}
          {conversation.status === "ARCHIVED" ? (
            <span className="rounded border border-outline-variant px-space-xs font-label-sm text-label-sm text-on-surface-variant">
              {tConversations(locale, "messages.archived_badge")}
            </span>
          ) : null}
          {conversation.status === "BLOCKED" ? (
            <span className="rounded border border-outline-variant px-space-xs font-label-sm text-label-sm text-on-surface-variant">
              {tConversations(locale, "messages.blocked_badge")}
            </span>
          ) : null}
          {canFile ? (
            <button
              type="button"
              onClick={() => void onToggleArchive(archived ? "OPEN" : "ARCHIVED")}
              className="ml-auto rounded-full border border-outline-variant px-space-md py-space-xs font-label-md text-label-md text-primary"
            >
              {tConversations(
                locale,
                archived ? "messages.unarchive" : "messages.archive",
              )}
            </button>
          ) : null}
        </div>

        {messages.length === 0 ? (
          <p className="mt-space-lg font-body-md text-on-surface-variant">
            {tConversations(locale, "messages.thread.empty")}
          </p>
        ) : (
          <ol className="mt-space-lg flex flex-col gap-space-md">
            {messages.map((message) => (
              <li
                key={message.id}
                className="rounded-xl border border-outline-variant p-space-md"
              >
                {/* The attribution is its OWN span, for the same reason the
                    inbox row splits its context label: Testing Library matches
                    an element on the concatenation of its direct text-node
                    children, so leaving the name and the " · " separator as
                    siblings of <time> inside this <p> would give it the text
                    "You ·" and no exact query could address "You". */}
                <p className="font-label-md text-label-md text-on-surface-variant">
                  <span>
                    {message.is_system
                      ? tConversations(locale, "messages.thread.system_note")
                      : message.sender.is_you
                        ? tConversations(locale, "messages.thread.you")
                        : message.sender.display_name.trim() ||
                          tConversations(locale, "messages.sender_unnamed")}
                  </span>
                  <span aria-hidden="true">{" · "}</span>
                  <time dateTime={message.created_at}>
                    {new Date(message.created_at).toLocaleString(locale)}
                  </time>
                </p>
                <p className="mt-space-xs whitespace-pre-wrap font-body-md text-on-surface">
                  {message.body}
                </p>
              </li>
            ))}
          </ol>
        )}

        <ReplyComposer locale={locale} disabled={!isOpen} onSend={onSend} />
      </section>

      <ConversationContextPanel locale={locale} context={conversation.context} />
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && pnpm vitest run src/components/messages/`
Expected: PASS — **32 tests** (14 from Task 5, 18 from this task).

Run: `cd frontend && pnpm lint && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/messages
git commit -m "feat(messages): thread view, context panel and reply composer (Phase 19 Task 6)"
```

---

### Task 7: The two screens, and the role-neutral routes Phase 6's `next_url` already points at

**Files:**
- Create: `frontend/src/components/messages/MessagesScreen.tsx` + `.test.tsx`
- Create: `frontend/src/components/messages/ThreadScreen.tsx` + `.test.tsx`
- Create: `frontend/src/app/dashboard/messages/page.tsx` + `page.test.tsx`
- Create: `frontend/src/app/dashboard/messages/[conversationId]/page.tsx` + `page.test.tsx`
- Modify: `frontend/src/components/auth/RequirePermission.tsx` + `.test.tsx` (ruling 13 — one optional prop)

**Interfaces:**
- Consumes: everything from Tasks 4–6; `useSession` from `@/lib/auth/session`; `RequirePermission` from `@/components/auth/RequirePermission`.
- Produces:
  - `RequirePermission`'s `permission` prop becomes optional; with it absent the component is a sign-in guard and nothing more
  - `MessagesScreen` — props `{ brokerId?: string; basePath: string; filter: ConversationFilter }`
  - `ThreadScreen` — props `{ conversationId: string; basePath: string }`
  - Routes `/dashboard/messages/` and `/dashboard/messages/<conversationId>/`

**Note (ruling 2, restated where it is implemented).** Phase 6's `SENDER_CONVERSATION_URL_TEMPLATE` is `/dashboard/messages/{conversation_id}/` and is returned as `next_url` from every inquiry and written into every `Notification.target_url`. These two routes make that link real. **`SENDER_CONVERSATION_URL_TEMPLATE` is not changed.**

**Note (session timing).** `SessionProvider` trades the refresh cookie for an access token *before* the first `/api/v1/session/` call, so on a fresh load `loading` is true while a signed-in broker still looks like a guest. Both screens branch on `loading` first and fetch nothing until it is false; a fetch fired earlier would carry no `Authorization` header and 401.

**Note (ruling 13 — the guard, and why the screens still keep their guest branch).** The two route files wrap their screen in `<RequirePermission>`, which is Phase 3's existing redirect-to-`/login?next=…` component, so a guest lands in the sign-in flow instead of a dead-end sentence. The screens **keep** their own `!authenticated` branch anyway: `RequirePermission` performs the redirect inside a `useEffect` and returns `null` in the meantime, so the screen must still be safe to render for an unauthenticated session, and the components are used directly in tests without the wrapper. Belt and braces here is one line, and the alternative is a screen that fetches during the redirect frame.

- [ ] **Step 0: Make `RequirePermission`'s `permission` prop optional**

Three edits to `frontend/src/components/auth/RequirePermission.tsx`, none of which change behaviour for any existing caller (all of them pass a permission):

```tsx
interface Props {
  /** Optional. When omitted, this component is purely the project's sign-in
   * guard: it redirects an unauthenticated visitor to /login?next=… and renders
   * nothing else of its own.
   *
   * Phase 19's dashboard routes need exactly that and cannot pass a permission.
   * `PermissionKey` is spec §5's capability table, and §5 has NO row for reading
   * conversations — `can_read_messages` is a §11.1 `BrokerMembership` column,
   * deliberately not surfaced as a session permission. The nearest candidate,
   * `submit_inquiry`, evaluates to `verified` (accounts/selectors.py:38), so
   * using it would hide the inbox from a broker member with an unverified email
   * who has perfectly readable conversations — a client-side authorization rule
   * the server does not hold, which spec §2.2 forbids. The real authorization
   * stays server-side in `conversations_visible_to` and `IsBrokerMember`. */
  permission?: PermissionKey;
  children: React.ReactNode;
}
```

```tsx
export default function RequirePermission({ permission, children }: Props) {
```

```tsx
  const allowed = permission === undefined || can(permission);
```

Append two cases to `frontend/src/components/auth/RequirePermission.test.tsx`, inside its existing `describe("RequirePermission", …)`. They use that file's own helpers exactly as written — the `session(overrides)` factory, `mockSession(value, loading?)`, the hoisted `replace` spy, and its `usePathname` mock, which returns `"/dashboard/private-seller/"`. **Nothing existing is edited.**

```tsx
  it("with no permission, still redirects a guest to sign in", async () => {
    // Ruling 13: this is the shape Phase 19's dashboard routes use. The
    // expected next-url is the file's own usePathname mock value, not a Phase 19
    // path — the assertion is about the redirect, not about the route.
    mockSession(session());
    render(
      <RequirePermission>
        <p>inbox</p>
      </RequirePermission>,
    );
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(
        "/login?next=%2Fdashboard%2Fprivate-seller%2F",
      ),
    );
    expect(screen.queryByText("inbox")).not.toBeInTheDocument();
  });

  it("with no permission, renders children for an authenticated user holding none", () => {
    // ALL_FALSE: the guard is "signed in", not a capability. The capability that
    // matters (can_read_messages) is enforced server-side and has no
    // PermissionKey by design — spec §5's table has no row for it.
    mockSession(
      session({
        authenticated: true,
        user: {
          id: "1",
          email: "member@example.com",
          full_name: "",
          primary_role: "BROKER",
          locale: "EN",
          email_verified: false,
          is_active: true,
        },
      }),
    );
    render(
      <RequirePermission>
        <p>inbox</p>
      </RequirePermission>,
    );
    expect(screen.getByText("inbox")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
```

Note `email_verified: false` in the second case: that is the exact account `submit_inquiry` would have excluded, and the reason ruling 13 rejects borrowing that permission.

Run: `cd frontend && pnpm vitest run src/components/auth/`
Expected: PASS — **6 tests** (the file's existing 4, unedited, plus these 2).

- [ ] **Step 1: Write the failing tests**

`frontend/src/components/messages/MessagesScreen.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import MessagesScreen from "@/components/messages/MessagesScreen";
import { ApiError } from "@/lib/api/client";

const { useSessionMock, fetchConversationsMock } = vi.hoisted(() => ({
  useSessionMock: vi.fn(),
  fetchConversationsMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ useSession: () => useSessionMock() }));
vi.mock("@/lib/api/conversations", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/api/conversations")>();
  return {
    ...actual,
    fetchConversations: (...args: unknown[]) => fetchConversationsMock(...args),
  };
});
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

function session(loading: boolean, authenticated = true) {
  useSessionMock.mockReturnValue({
    session: authenticated
      ? { authenticated: true, user: { locale: "EN" }, broker_memberships: [] }
      : { authenticated: false, user: null, broker_memberships: [] },
    loading,
    error: null,
    can: () => false,
    login: vi.fn(),
    logout: vi.fn(),
    reload: vi.fn(),
  });
}

const ROW = {
  id: "c-1",
  conversation_type: "BROKER_INQUIRY",
  subject: "Fleet question",
  status: "OPEN",
  last_message_at: "2026-09-18T09:30:00Z",
  created_at: "2026-09-18T09:00:00Z",
  unread_count: 1,
  context: { type: "BROKER", id: "b-1", label: "Alpha", url: null },
  counterparty_name: "Ada Rossi",
  last_message_excerpt: "Hello about the boat, please.",
  viewer_is_initiator: false,
};

afterEach(() => {
  useSessionMock.mockReset();
  fetchConversationsMock.mockReset();
});

describe("MessagesScreen", () => {
  it("fetches nothing while the session is still loading", () => {
    // SessionProvider trades the refresh cookie for an access token first; a
    // fetch fired before that carries no Authorization header and 401s.
    session(true);
    render(<MessagesScreen basePath="/dashboard/messages/" filter="ALL" />);
    expect(fetchConversationsMock).not.toHaveBeenCalled();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders the rows once the session has resolved", async () => {
    session(false);
    fetchConversationsMock.mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [ROW],
    });
    render(<MessagesScreen basePath="/dashboard/messages/" filter="ALL" />);
    await waitFor(() => expect(screen.getByText("Ada Rossi")).toBeInTheDocument());
    expect(fetchConversationsMock).toHaveBeenCalledWith("ALL", {
      brokerId: undefined,
    });
  });

  it("scopes the fetch to one organization when a brokerId is given", async () => {
    session(false);
    fetchConversationsMock.mockResolvedValue({
      count: 0,
      next: null,
      previous: null,
      results: [],
    });
    render(
      <MessagesScreen
        brokerId="b-1"
        basePath="/dashboard/broker/messages/"
        filter="UNREAD"
      />,
    );
    await waitFor(() =>
      expect(fetchConversationsMock).toHaveBeenCalledWith("UNREAD", {
        brokerId: "b-1",
      }),
    );
  });

  it("builds every href from basePath, so one component serves both routes", async () => {
    session(false);
    fetchConversationsMock.mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [ROW],
    });
    render(
      <MessagesScreen basePath="/dashboard/broker/messages/" filter="ALL" />,
    );
    await waitFor(() =>
      expect(screen.getByRole("link", { name: /Ada Rossi/ })).toHaveAttribute(
        "href",
        "/dashboard/broker/messages/c-1/",
      ),
    );
    expect(screen.getByRole("link", { name: "Archived" })).toHaveAttribute(
      "href",
      "/dashboard/broker/messages/?filter=ARCHIVED",
    );
  });

  it("shows the localized copy for a flag-off 403, never the server's string", async () => {
    session(false);
    fetchConversationsMock.mockRejectedValue(
      new ApiError(403, "feature_disabled", "This feature is not enabled yet."),
    );
    render(<MessagesScreen basePath="/dashboard/messages/" filter="ALL" />);
    await waitFor(() =>
      expect(
        screen.getByText("Messages are not available yet."),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByText("This feature is not enabled yet."),
    ).not.toBeInTheDocument();
  });

  it("asks a guest to sign in rather than fetching", () => {
    // The route wraps this screen in RequirePermission, which redirects a guest
    // to /login (ruling 13). This branch covers the frame before that redirect
    // lands, and the component's use in tests without the wrapper.
    session(false, false);
    render(<MessagesScreen basePath="/dashboard/messages/" filter="ALL" />);
    expect(fetchConversationsMock).not.toHaveBeenCalled();
    expect(screen.getByText("Sign in to see your messages.")).toBeInTheDocument();
  });

  it("explains a suspended or removed membership instead of a generic failure", async () => {
    // Ruling 15: accounts/selectors.py:63-65 lists memberships regardless of the
    // organization's status while accounts/services.py:150-159 requires ACTIVE,
    // so a member of a SUSPENDED brokerage reaches this screen and is refused.
    // "Something went wrong" would be true and useless.
    session(false);
    fetchConversationsMock.mockRejectedValue(
      new ApiError(403, "not_broker_member", "You are not a member."),
    );
    render(
      <MessagesScreen
        brokerId="b-1"
        basePath="/dashboard/broker/messages/"
        filter="ALL"
      />,
    );
    await waitFor(() =>
      expect(
        screen.getByText(/suspended, or your membership may have been removed/),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText("You are not a member.")).not.toBeInTheDocument();
  });
});
```

`frontend/src/components/messages/ThreadScreen.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ThreadScreen from "@/components/messages/ThreadScreen";
import { ApiError } from "@/lib/api/client";

const {
  useSessionMock,
  fetchConversationMock,
  fetchThreadMock,
  markReadMock,
  postReplyMock,
  setStatusMock,
} = vi.hoisted(() => ({
  useSessionMock: vi.fn(),
  fetchConversationMock: vi.fn(),
  fetchThreadMock: vi.fn(),
  markReadMock: vi.fn(),
  postReplyMock: vi.fn(),
  setStatusMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ useSession: () => useSessionMock() }));
vi.mock("@/lib/api/conversations", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/api/conversations")>();
  return {
    ...actual,
    fetchConversation: (...a: unknown[]) => fetchConversationMock(...a),
    fetchThread: (...a: unknown[]) => fetchThreadMock(...a),
    markConversationRead: (...a: unknown[]) => markReadMock(...a),
    postReply: (...a: unknown[]) => postReplyMock(...a),
    setConversationStatus: (...a: unknown[]) => setStatusMock(...a),
  };
});
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const CONVERSATION = {
  id: "c-1",
  conversation_type: "BROKER_INQUIRY",
  subject: "Fleet question",
  status: "OPEN",
  last_message_at: "2026-09-18T09:30:00Z",
  created_at: "2026-09-18T09:00:00Z",
  unread_count: 1,
  context: { type: "BROKER", id: "b-1", label: "Alpha", url: null },
  counterparty_name: "Ada Rossi",
  last_message_excerpt: "Hello",
  viewer_is_initiator: false,
};

function readySession() {
  useSessionMock.mockReturnValue({
    session: { authenticated: true, user: { locale: "EN" }, broker_memberships: [] },
    loading: false,
    error: null,
    can: () => false,
    login: vi.fn(),
    logout: vi.fn(),
    reload: vi.fn(),
  });
}

afterEach(() => {
  [
    useSessionMock,
    fetchConversationMock,
    fetchThreadMock,
    markReadMock,
    postReplyMock,
    setStatusMock,
  ].forEach((mock) => mock.mockReset());
});

describe("ThreadScreen", () => {
  it("loads the thread and marks it read once", async () => {
    readySession();
    fetchConversationMock.mockResolvedValue(CONVERSATION);
    fetchThreadMock.mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: "m-1",
          body: "Hello about the boat, please.",
          is_system: false,
          created_at: "2026-09-18T09:00:00Z",
          read_at: null,
          sender: { display_name: "Ada Rossi", is_you: false },
        },
      ],
    });
    markReadMock.mockResolvedValue({ marked_read: 1 });

    render(<ThreadScreen conversationId="c-1" basePath="/dashboard/messages/" />);
    await waitFor(() =>
      expect(screen.getByText("Hello about the boat, please.")).toBeInTheDocument(),
    );
    await waitFor(() => expect(markReadMock).toHaveBeenCalledTimes(1));
    expect(markReadMock).toHaveBeenCalledWith("c-1");
  });

  it("reads the conversation from the detail endpoint, never by scanning the inbox", async () => {
    // Ruling 14. The inbox returns one page of 20, so a scan silently fails for
    // a broker's 21st conversation — a bug no fixture-sized test would catch,
    // which is why the assertion is about WHICH call is made.
    readySession();
    fetchConversationMock.mockResolvedValue(CONVERSATION);
    fetchThreadMock.mockResolvedValue({
      count: 0,
      next: null,
      previous: null,
      results: [],
    });
    markReadMock.mockResolvedValue({ marked_read: 0 });

    render(<ThreadScreen conversationId="c-1" basePath="/dashboard/messages/" />);
    await waitFor(() => expect(fetchConversationMock).toHaveBeenCalledWith("c-1"));
  });

  it("shows the not-found copy for a conversation the caller may not see", async () => {
    // Spec 33.1: the server answers 404 rather than 403 so an id cannot be
    // probed. The screen must not invent a different story.
    readySession();
    fetchConversationMock.mockRejectedValue(new ApiError(404, "not_found", "x"));
    fetchThreadMock.mockRejectedValue(new ApiError(404, "not_found", "x"));
    render(<ThreadScreen conversationId="c-9" basePath="/dashboard/messages/" />);
    await waitFor(() =>
      expect(
        screen.getByText("This conversation is not available."),
      ).toBeInTheDocument(),
    );
  });

  it("posts a reply and appends it without a full reload", async () => {
    const userEvent = (await import("@testing-library/user-event")).default;
    readySession();
    fetchConversationMock.mockResolvedValue(CONVERSATION);
    fetchThreadMock.mockResolvedValue({
      count: 0,
      next: null,
      previous: null,
      results: [],
    });
    markReadMock.mockResolvedValue({ marked_read: 0 });
    postReplyMock.mockResolvedValue({
      id: "m-2",
      body: "Thank you, next Tuesday morning works well.",
      is_system: false,
      created_at: "2026-09-18T10:00:00Z",
      read_at: null,
      sender: { display_name: "Bo Reader", is_you: true },
    });

    render(<ThreadScreen conversationId="c-1" basePath="/dashboard/messages/" />);
    await waitFor(() => expect(screen.getByLabelText("Reply")).toBeEnabled());
    await userEvent.type(
      screen.getByLabelText("Reply"),
      "Thank you, next Tuesday morning works well.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() =>
      expect(
        screen.getByText("Thank you, next Tuesday morning works well."),
      ).toBeInTheDocument(),
    );
  });

  it("surfaces a 409 conversation_closed in the reader's language", async () => {
    const userEvent = (await import("@testing-library/user-event")).default;
    readySession();
    fetchConversationMock.mockResolvedValue(CONVERSATION);
    fetchThreadMock.mockResolvedValue({
      count: 0,
      next: null,
      previous: null,
      results: [],
    });
    markReadMock.mockResolvedValue({ marked_read: 0 });
    postReplyMock.mockRejectedValue(
      new ApiError(409, "conversation_closed", "Closed."),
    );

    render(<ThreadScreen conversationId="c-1" basePath="/dashboard/messages/" />);
    await waitFor(() => expect(screen.getByLabelText("Reply")).toBeEnabled());
    await userEvent.type(
      screen.getByLabelText("Reply"),
      "Thank you, next Tuesday morning works well.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() =>
      expect(screen.getByText("This conversation is closed.")).toBeInTheDocument(),
    );
  });

  it("archives through the status endpoint and re-renders the new state", async () => {
    const userEvent = (await import("@testing-library/user-event")).default;
    readySession();
    fetchConversationMock.mockResolvedValue(CONVERSATION);
    fetchThreadMock.mockResolvedValue({
      count: 0,
      next: null,
      previous: null,
      results: [],
    });
    markReadMock.mockResolvedValue({ marked_read: 0 });
    setStatusMock.mockResolvedValue({ ...CONVERSATION, status: "ARCHIVED" });

    render(<ThreadScreen conversationId="c-1" basePath="/dashboard/messages/" />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole("button", { name: "Archive" }));
    await waitFor(() =>
      expect(setStatusMock).toHaveBeenCalledWith("c-1", "ARCHIVED"),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Move to inbox" }),
      ).toBeInTheDocument(),
    );
  });

  it("links back to the inbox it was opened from", async () => {
    readySession();
    fetchConversationMock.mockResolvedValue(CONVERSATION);
    fetchThreadMock.mockResolvedValue({
      count: 0,
      next: null,
      previous: null,
      results: [],
    });
    markReadMock.mockResolvedValue({ marked_read: 0 });
    render(
      <ThreadScreen conversationId="c-1" basePath="/dashboard/broker/messages/" />,
    );
    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Back to messages" })).toHaveAttribute(
        "href",
        "/dashboard/broker/messages/",
      ),
    );
  });
});
```

`frontend/src/app/dashboard/messages/page.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import MessagesPage from "@/app/dashboard/messages/page";

vi.mock("@/components/messages/MessagesScreen", () => ({
  default: ({ basePath, filter, brokerId }: Record<string, unknown>) => (
    <div
      data-testid="screen"
      data-base-path={String(basePath)}
      data-filter={String(filter)}
      data-broker-id={String(brokerId)}
    />
  ),
}));

// The guard is Phase 3's and has its own tests; here it is a passthrough so
// these assertions are about this route's own wiring. Its presence IS asserted,
// once, by the first test below.
vi.mock("@/components/auth/RequirePermission", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="guard">{children}</div>
  ),
}));

describe("/dashboard/messages/", () => {
  it("wraps the screen in the sign-in guard", async () => {
    // Ruling 13: a guest must land in /login?next=…, not on a dead-end
    // sentence. Without this assertion the guard could be dropped silently.
    render(await MessagesPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByTestId("guard")).toContainElement(
      screen.getByTestId("screen"),
    );
  });

  it("awaits searchParams and defaults to the ALL filter", async () => {
    // Next 16: searchParams is a Promise. Verify against
    // node_modules/next/dist/docs/ before changing this signature.
    render(await MessagesPage({ searchParams: Promise.resolve({}) }));
    const screenEl = screen.getByTestId("screen");
    expect(screenEl).toHaveAttribute("data-filter", "ALL");
    expect(screenEl).toHaveAttribute("data-base-path", "/dashboard/messages/");
    expect(screenEl).toHaveAttribute("data-broker-id", "undefined");
  });

  it("accepts a known filter from the query string", async () => {
    render(
      await MessagesPage({ searchParams: Promise.resolve({ filter: "ARCHIVED" }) }),
    );
    expect(screen.getByTestId("screen")).toHaveAttribute("data-filter", "ARCHIVED");
  });

  it("falls back to ALL for an unknown filter rather than passing it through", async () => {
    render(
      await MessagesPage({ searchParams: Promise.resolve({ filter: "NONSENSE" }) }),
    );
    expect(screen.getByTestId("screen")).toHaveAttribute("data-filter", "ALL");
  });
});
```

`frontend/src/app/dashboard/messages/[conversationId]/page.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ThreadPage from "@/app/dashboard/messages/[conversationId]/page";

vi.mock("@/components/messages/ThreadScreen", () => ({
  default: ({ conversationId, basePath }: Record<string, unknown>) => (
    <div
      data-testid="thread"
      data-conversation-id={String(conversationId)}
      data-base-path={String(basePath)}
    />
  ),
}));

vi.mock("@/components/auth/RequirePermission", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="guard">{children}</div>
  ),
}));

describe("/dashboard/messages/<id>/", () => {
  it("awaits params and passes the conversation id through", async () => {
    render(await ThreadPage({ params: Promise.resolve({ conversationId: "c-1" }) }));
    const el = screen.getByTestId("thread");
    expect(el).toHaveAttribute("data-conversation-id", "c-1");
    expect(el).toHaveAttribute("data-base-path", "/dashboard/messages/");
  });

  it("wraps the thread in the sign-in guard", async () => {
    render(await ThreadPage({ params: Promise.resolve({ conversationId: "c-1" }) }));
    expect(screen.getByTestId("guard")).toContainElement(
      screen.getByTestId("thread"),
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && pnpm vitest run src/components/messages/MessagesScreen.test.tsx src/components/messages/ThreadScreen.test.tsx src/app/dashboard/`
Expected: FAIL — four unresolved imports.

- [ ] **Step 3a: Write `frontend/src/components/messages/MessagesScreen.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";

import ConversationFilters from "@/components/messages/ConversationFilters";
import ConversationList from "@/components/messages/ConversationList";
import {
  fetchConversations,
  messageErrorKey,
  type ConversationFilter,
  type ConversationRow,
} from "@/lib/api/conversations";
import { tConversations } from "@/lib/i18n/conversations";
import { resolveLocale } from "@/lib/i18n/directory";
import { useSession } from "@/lib/auth/session";

interface Props {
  /** Present on the broker route, absent on the role-neutral one. It becomes
   * `?broker=<id>` and is the ONLY difference between the two mounts. */
  brokerId?: string;
  /** e.g. "/dashboard/messages/" or "/dashboard/broker/messages/". Every href
   * on this screen is built from it, which is what lets one component serve
   * both routes (spec 28's "share components where practical"). */
  basePath: string;
  filter: ConversationFilter;
}

export default function MessagesScreen({ brokerId, basePath, filter }: Props) {
  const { session, loading } = useSession();
  const [rows, setRows] = useState<ConversationRow[]>([]);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);

  const locale = resolveLocale(session?.user?.locale);
  const authenticated = session?.authenticated === true;

  const load = useCallback(async () => {
    setFetching(true);
    try {
      const page = await fetchConversations(filter, { brokerId });
      setRows(page.results);
      setErrorKey(null);
    } catch (caught) {
      setRows([]);
      setErrorKey(messageErrorKey(caught));
    } finally {
      setFetching(false);
    }
  }, [brokerId, filter]);

  useEffect(() => {
    // Nothing is fetched while `loading` is true. SessionProvider trades the
    // HttpOnly refresh cookie for an access token BEFORE the first session
    // call, so a fetch fired earlier would carry no Authorization header and
    // 401 — and the 401 would then be reported as an error to a person who is
    // in fact perfectly signed in.
    if (loading) return;
    if (!authenticated) {
      setFetching(false);
      return;
    }
    void load();
  }, [loading, authenticated, load]);

  if (loading || (authenticated && fetching)) {
    return (
      <p className="font-body-md text-on-surface-variant" aria-busy="true">
        {tConversations(locale, "messages.loading")}
      </p>
    );
  }

  if (!authenticated) {
    return (
      <p className="font-body-md text-on-surface-variant">
        {tConversations(locale, "messages.error.authentication_required")}
      </p>
    );
  }

  return (
    <section aria-labelledby="messages-title">
      <h1 id="messages-title" className="font-headline-md text-headline-md text-primary">
        {tConversations(locale, "messages.title")}
      </h1>
      <p className="mt-space-sm font-body-md text-on-surface-variant">
        {tConversations(locale, "messages.intro")}
      </p>
      <div className="mt-space-lg">
        <ConversationFilters
          locale={locale}
          active={filter}
          hrefFor={(value) => `${basePath}?filter=${value}`}
        />
      </div>
      {errorKey ? (
        <p role="alert" className="mt-space-lg font-body-md text-error">
          {tConversations(locale, errorKey)}
        </p>
      ) : (
        <div className="mt-space-lg">
          <ConversationList
            locale={locale}
            rows={rows}
            hrefFor={(id) => `${basePath}${id}/`}
          />
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 3b: Write `frontend/src/components/messages/ThreadScreen.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import ConversationThread from "@/components/messages/ConversationThread";
import {
  fetchConversation,
  fetchThread,
  markConversationRead,
  messageErrorKey,
  postReply,
  setConversationStatus,
  type ConversationRow,
  type MessageRow,
} from "@/lib/api/conversations";
import { tConversations } from "@/lib/i18n/conversations";
import { resolveLocale } from "@/lib/i18n/directory";
import { useSession } from "@/lib/auth/session";

interface Props {
  conversationId: string;
  basePath: string;
}

export default function ThreadScreen({ conversationId, basePath }: Props) {
  const { session, loading } = useSession();
  const [conversation, setConversation] = useState<ConversationRow | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);

  const locale = resolveLocale(session?.user?.locale);
  const authenticated = session?.authenticated === true;

  const load = useCallback(async () => {
    setFetching(true);
    try {
      // fetchConversation, NOT a scan of fetchConversations("ALL"): the inbox
      // returns one page of 20, so scanning it would report "not available" for
      // a broker's 21st conversation (ruling 14). Both calls are
      // visibility-scoped server-side and both answer 404 for a thread this
      // viewer may not see.
      const [row, thread] = await Promise.all([
        fetchConversation(conversationId),
        fetchThread(conversationId),
      ]);
      setConversation(row);
      setMessages(thread.results);
      setErrorKey(null);
      // Spec 28's unread counts only mean anything if opening a thread clears
      // them. Deliberately fire-and-forget: a failed mark-read must not stop a
      // person reading what they came for.
      void markConversationRead(conversationId).catch(() => undefined);
    } catch (caught) {
      setErrorKey(messageErrorKey(caught));
    } finally {
      setFetching(false);
    }
  }, [conversationId]);

  useEffect(() => {
    if (loading) return;
    if (!authenticated) {
      setFetching(false);
      return;
    }
    void load();
  }, [loading, authenticated, load]);

  const onSend = useCallback(
    async (body: string) => {
      try {
        const message = await postReply(conversationId, body);
        setMessages((current) => [...current, message]);
        setErrorKey(null);
      } catch (caught) {
        setErrorKey(messageErrorKey(caught));
        // Rethrown so ReplyComposer keeps the person's text.
        throw caught;
      }
    },
    [conversationId],
  );

  const onToggleArchive = useCallback(
    async (next: "OPEN" | "ARCHIVED") => {
      try {
        setConversation(await setConversationStatus(conversationId, next));
        setErrorKey(null);
      } catch (caught) {
        setErrorKey(messageErrorKey(caught));
      }
    },
    [conversationId],
  );

  if (loading || (authenticated && fetching)) {
    return (
      <p className="font-body-md text-on-surface-variant" aria-busy="true">
        {tConversations(locale, "messages.loading")}
      </p>
    );
  }
  if (!authenticated) {
    return (
      <p className="font-body-md text-on-surface-variant">
        {tConversations(locale, "messages.error.authentication_required")}
      </p>
    );
  }

  return (
    <div>
      <Link
        href={basePath}
        className="font-label-md text-label-md text-primary underline"
      >
        {tConversations(locale, "messages.thread.back")}
      </Link>
      {errorKey ? (
        <p role="alert" className="mt-space-md font-body-md text-error">
          {tConversations(locale, errorKey)}
        </p>
      ) : null}
      {conversation ? (
        <div className="mt-space-lg">
          <ConversationThread
            locale={locale}
            conversation={conversation}
            messages={messages}
            onSend={onSend}
            onToggleArchive={onToggleArchive}
          />
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 3c: Write the two route files**

`frontend/src/app/dashboard/messages/page.tsx`:

```tsx
import type { Metadata } from "next";

import RequirePermission from "@/components/auth/RequirePermission";
import MessagesScreen from "@/components/messages/MessagesScreen";
import { resolveFilter } from "@/lib/api/conversations";
import { tConversations } from "@/lib/i18n/conversations";
import { DEFAULT_LOCALE } from "@/lib/i18n/directory";

// The inbox is per-person and authenticated; there is nothing to cache or
// prerender.
export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return { title: tConversations(DEFAULT_LOCALE, "messages.title") };
}

// Next 16: searchParams is a Promise. Verify against
// node_modules/next/dist/docs/ before changing this signature.
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  return (
    <main className="mx-auto max-w-[1440px] px-margin-mobile py-space-xl md:px-margin-desktop">
      {/* Ruling 13: no permission argument. There is no PermissionKey for
          "has conversations", and the real authorization is server-side. This
          is the sign-in redirect every other private route in this project
          uses. */}
      <RequirePermission>
        <MessagesScreen
          basePath="/dashboard/messages/"
          filter={resolveFilter(first(params.filter))}
        />
      </RequirePermission>
    </main>
  );
}
```

`frontend/src/app/dashboard/messages/[conversationId]/page.tsx`:

```tsx
import RequirePermission from "@/components/auth/RequirePermission";
import ThreadScreen from "@/components/messages/ThreadScreen";

export const dynamic = "force-dynamic";

// Next 16: params is a Promise.
type Params = Promise<{ conversationId: string }>;

export default async function ThreadPage({ params }: { params: Params }) {
  const { conversationId } = await params;
  return (
    <main className="mx-auto max-w-[1440px] px-margin-mobile py-space-xl md:px-margin-desktop">
      <RequirePermission>
        <ThreadScreen
          conversationId={conversationId}
          basePath="/dashboard/messages/"
        />
      </RequirePermission>
    </main>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && pnpm vitest run src/components/messages/ src/app/dashboard/ src/components/auth/`
Expected: PASS — **58 tests**, made up of: 46 under `components/messages/` (32 from Tasks 5–6, plus 7 `MessagesScreen` and 7 `ThreadScreen`), 6 under `app/dashboard/` (4 in the inbox route, 2 in the thread route), and 6 under `components/auth/` (the 4 that were already there, unedited, plus this task's 2).

Run: `cd frontend && pnpm lint && pnpm exec tsc --noEmit && pnpm build`
Expected: no errors; the build output lists `/dashboard/messages` and `/dashboard/messages/[conversationId]`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/messages frontend/src/app/dashboard
git commit -m "feat(messages): inbox and thread screens at the route next_url already points at (Phase 19 Task 7)"
```

---

### Task 8: Broker chrome — the navigation spec §28 adds, and the broker message routes

**Files:**
- Create: `frontend/src/components/broker/BrokerDashboardNav.tsx` + `.test.tsx`
- Create: `frontend/src/app/dashboard/broker/layout.tsx`
- Create: `frontend/src/app/dashboard/broker/messages/page.tsx` + `page.test.tsx`
- Create: `frontend/src/app/dashboard/broker/messages/[conversationId]/page.tsx` + `page.test.tsx`
- Modify: `frontend/src/components/layout/PrimaryNav.tsx`, `frontend/src/components/layout/PrimaryNav.test.tsx`

**Interfaces:**
- Consumes: `useSession` from `@/lib/auth/session`; `BrokerMembershipSummary`, `SessionPayload` from `@/lib/auth/types`; `MessagesScreen`, `ThreadScreen` (Task 7); `tConversations` (Task 3).
- Produces:
  - `BrokerDashboardNav` — props `{ locale }`, plus the exported constant `BROKER_NAV_LINKS`
  - `primaryBrokerMembership(session): BrokerMembershipSummary | null` (exported from `BrokerDashboardNav.tsx`, reused by Task 9)
  - Routes `/dashboard/broker/messages/` and `/dashboard/broker/messages/<conversationId>/`
  - One new entry in `PrimaryNav`'s `LINKS`, visible only to a member of a broker organization

**Note (ruling 3, restated where it is implemented).** `BROKER_NAV_LINKS` contains exactly two entries — Dashboard and Messages. Spec §4.2's broker row also names `/fleet/`, `/leads/`, `/team/`, `/profile/` and `/subscription/`; none of those pages exists and Phases 16/17/20 own them. `PrimaryNav.test.tsx:80` already encodes the project's own precedent ("links to no page that does not exist yet"). **`Services & Surveyors` is not among them and the test pins the set exactly**, which is how spec §28's "Remove" becomes a guarantee rather than a deletion (ruling 1).

**Note (which organization).** A user may hold memberships in several broker organizations. `primaryBrokerMembership` takes the first `broker_memberships` entry — the session serializer returns only `is_active=True` rows, ordered by the default queryset. An organization switcher is not in spec §28 and is recorded in Known Limitations rather than invented.

- [ ] **Step 1: Write the failing tests**

`frontend/src/components/broker/BrokerDashboardNav.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import BrokerDashboardNav, {
  BROKER_NAV_LINKS,
  primaryBrokerMembership,
} from "@/components/broker/BrokerDashboardNav";
import type { SessionPayload } from "@/lib/auth/types";

const { useSessionMock, usePathnameMock } = vi.hoisted(() => ({
  useSessionMock: vi.fn(),
  usePathnameMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ useSession: () => useSessionMock() }));
vi.mock("next/navigation", () => ({ usePathname: () => usePathnameMock() }));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function mockSession(loading = false) {
  useSessionMock.mockReturnValue({
    session: {
      authenticated: true,
      user: { locale: "EN" },
      broker_memberships: [],
    },
    loading,
    error: null,
    can: () => false,
    login: vi.fn(),
    logout: vi.fn(),
    reload: vi.fn(),
  });
}

afterEach(() => {
  useSessionMock.mockReset();
  usePathnameMock.mockReset();
});

describe("BrokerDashboardNav", () => {
  it("contains exactly Dashboard and Messages — no Services & Surveyors, ever", () => {
    // Spec 28 "Remove": Navigation item `Services & Surveyors`. This assertion
    // is the durable form of that requirement in a codebase that never had one:
    // the set is pinned, so the item cannot be added back by accident.
    expect(BROKER_NAV_LINKS.map((link) => link.href)).toEqual([
      "/dashboard/broker/",
      "/dashboard/broker/messages/",
    ]);
  });

  it("renders spec 37's broker.messages label", () => {
    mockSession();
    usePathnameMock.mockReturnValue("/dashboard/broker/");
    render(<BrokerDashboardNav locale="en" />);
    expect(screen.getByRole("link", { name: "Messages" })).toHaveAttribute(
      "href",
      "/dashboard/broker/messages/",
    );
  });

  it("links to no route this application has not built", () => {
    mockSession();
    usePathnameMock.mockReturnValue("/dashboard/broker/");
    render(<BrokerDashboardNav locale="en" />);
    for (const absent of ["Fleet", "Leads", "Team", "Subscription", "Services"]) {
      expect(screen.queryByRole("link", { name: absent })).not.toBeInTheDocument();
    }
  });

  it("marks the current page with aria-current", () => {
    mockSession();
    usePathnameMock.mockReturnValue("/dashboard/broker/messages/");
    render(<BrokerDashboardNav locale="en" />);
    expect(screen.getByRole("link", { name: "Messages" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("marks Messages current for a thread URL underneath it too", () => {
    mockSession();
    usePathnameMock.mockReturnValue("/dashboard/broker/messages/c-1/");
    render(<BrokerDashboardNav locale="en" />);
    expect(screen.getByRole("link", { name: "Messages" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("renders Spanish copy for the es locale", () => {
    mockSession();
    usePathnameMock.mockReturnValue("/dashboard/broker/");
    render(<BrokerDashboardNav locale="es" />);
    expect(screen.getByRole("link", { name: "Mensajes" })).toBeInTheDocument();
  });
});

describe("primaryBrokerMembership", () => {
  const membership = {
    broker_id: "b-1",
    broker_name: "Phase19 Alpha Brokers",
    broker_slug: "phase19-alpha-brokers",
    broker_status: "ACTIVE" as const,
    broker_auto_approve_listings: false,
    role: "MANAGER" as const,
    can_edit_listings: false,
    can_manage_team: false,
    can_read_messages: true,
  };

  it("returns the first membership", () => {
    const session = { broker_memberships: [membership] } as SessionPayload;
    expect(primaryBrokerMembership(session)?.broker_id).toBe("b-1");
  });

  it("returns null when there is none", () => {
    expect(
      primaryBrokerMembership({ broker_memberships: [] } as SessionPayload),
    ).toBeNull();
  });

  it("returns null for a null session", () => {
    expect(primaryBrokerMembership(null)).toBeNull();
  });
});
```

`frontend/src/app/dashboard/broker/messages/page.test.tsx`:

```tsx
import { Suspense } from "react";

import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import BrokerMessagesPage from "@/app/dashboard/broker/messages/page";

const { useSessionMock } = vi.hoisted(() => ({ useSessionMock: vi.fn() }));

vi.mock("@/lib/auth/session", () => ({ useSession: () => useSessionMock() }));
vi.mock("@/components/messages/MessagesScreen", () => ({
  default: ({ basePath, filter, brokerId }: Record<string, unknown>) => (
    <div
      data-testid="screen"
      data-base-path={String(basePath)}
      data-filter={String(filter)}
      data-broker-id={String(brokerId)}
    />
  ),
}));
vi.mock("@/components/auth/RequirePermission", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="guard">{children}</div>
  ),
}));

/** Render the page as an ELEMENT, not by calling it.
 *
 * This page is a `"use client"` component: it calls `use(searchParams)` and
 * `useSession()`. `render(await BrokerMessagesPage({...}))` invokes it as a
 * plain function outside React's render phase, which throws "Invalid hook
 * call" — and `use()` on a pending promise must suspend, so it needs a
 * Suspense boundary above it. The server pages under /dashboard/messages/ are
 * async server components and ARE called directly in their own tests; the two
 * shapes are different on purpose and must not be copied across.
 */
function renderPage(params: Record<string, string | string[] | undefined> = {}) {
  return render(
    <Suspense fallback={<p>loading</p>}>
      <BrokerMessagesPage searchParams={Promise.resolve(params)} />
    </Suspense>,
  );
}

function mockSession(memberships: unknown[]) {
  useSessionMock.mockReturnValue({
    session: {
      authenticated: true,
      user: { locale: "EN" },
      broker_memberships: memberships,
    },
    loading: false,
    error: null,
    can: () => false,
    login: vi.fn(),
    logout: vi.fn(),
    reload: vi.fn(),
  });
}

const MEMBERSHIP = {
  broker_id: "b-1",
  broker_name: "Phase19 Alpha Brokers",
  broker_slug: "phase19-alpha-brokers",
  broker_status: "ACTIVE",
  broker_auto_approve_listings: false,
  role: "MANAGER",
  can_edit_listings: false,
  can_manage_team: false,
  can_read_messages: true,
};

afterEach(() => useSessionMock.mockReset());

describe("/dashboard/broker/messages/", () => {
  it("scopes the inbox to the caller's organization", async () => {
    mockSession([MEMBERSHIP]);
    renderPage();
    const el = await screen.findByTestId("screen");
    expect(el).toHaveAttribute("data-broker-id", "b-1");
    expect(el).toHaveAttribute("data-base-path", "/dashboard/broker/messages/");
    expect(el).toHaveAttribute("data-filter", "ALL");
  });

  it("passes a known filter through", async () => {
    mockSession([MEMBERSHIP]);
    renderPage({ filter: "UNREAD" });
    expect(await screen.findByTestId("screen")).toHaveAttribute(
      "data-filter",
      "UNREAD",
    );
  });

  it("falls back to ALL for an unknown filter", async () => {
    mockSession([MEMBERSHIP]);
    renderPage({ filter: "NONSENSE" });
    expect(await screen.findByTestId("screen")).toHaveAttribute(
      "data-filter",
      "ALL",
    );
  });

  it("wraps the screen in the sign-in guard", async () => {
    mockSession([MEMBERSHIP]);
    renderPage();
    await screen.findByTestId("screen");
    expect(screen.getByTestId("guard")).toContainElement(
      screen.getByTestId("screen"),
    );
  });

  it("explains itself instead of rendering an inbox for a non-member", async () => {
    mockSession([]);
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByText("Your account is not a member of a broker organization."),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByTestId("screen")).not.toBeInTheDocument();
  });
});
```

`frontend/src/app/dashboard/broker/messages/[conversationId]/page.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import BrokerThreadPage from "@/app/dashboard/broker/messages/[conversationId]/page";

vi.mock("@/components/messages/ThreadScreen", () => ({
  default: ({ conversationId, basePath }: Record<string, unknown>) => (
    <div
      data-testid="thread"
      data-conversation-id={String(conversationId)}
      data-base-path={String(basePath)}
    />
  ),
}));
vi.mock("@/components/auth/RequirePermission", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="guard">{children}</div>
  ),
}));

describe("/dashboard/broker/messages/<id>/", () => {
  it("awaits params and sends the reader back to the broker inbox", async () => {
    // Called directly, unlike the inbox page beside it: this one is an async
    // SERVER component with no hooks. See the comment in its page.tsx.
    render(
      await BrokerThreadPage({
        params: Promise.resolve({ conversationId: "c-1" }),
      }),
    );
    const el = screen.getByTestId("thread");
    expect(el).toHaveAttribute("data-conversation-id", "c-1");
    expect(el).toHaveAttribute("data-base-path", "/dashboard/broker/messages/");
  });

  it("wraps the thread in the sign-in guard", async () => {
    render(
      await BrokerThreadPage({
        params: Promise.resolve({ conversationId: "c-1" }),
      }),
    );
    expect(screen.getByTestId("guard")).toContainElement(
      screen.getByTestId("thread"),
    );
  });
});
```

Append three cases to `frontend/src/components/layout/PrimaryNav.test.tsx`. The file's existing four tests are not edited; only its `mockSession` helper is widened, below, and both new parameters default to what it does today.

```tsx
const BROKER_MEMBERSHIP = {
  broker_id: "b-1",
  broker_name: "Phase19 Alpha Brokers",
  broker_slug: "phase19-alpha-brokers",
  broker_status: "ACTIVE" as const,
  broker_auto_approve_listings: false,
  role: "AGENT" as const,
  can_edit_listings: false,
  can_manage_team: false,
  can_read_messages: false,
};

  it("shows the broker dashboard link only to a member of a broker organization", () => {
    mockSession(ALL_FALSE);
    render(<PrimaryNav />);
    expect(
      screen.queryByRole("link", { name: "Broker dashboard" }),
    ).not.toBeInTheDocument();
  });

  it("shows the broker dashboard link to a broker member with no permissions at all", () => {
    // Membership, not a permission: spec 5's capability table has no "broker
    // dashboard" row, and an AGENT with every flag false is still a member.
    mockSession(ALL_FALSE, true, [BROKER_MEMBERSHIP]);
    render(<PrimaryNav />);
    expect(
      screen.getByRole("link", { name: "Broker dashboard" }),
    ).toHaveAttribute("href", "/dashboard/broker/");
  });

  it.each([
    ["EN", "Broker dashboard"],
    ["IT", "Pannello broker"],
    ["ES", "Panel del bróker"],
  ])("renders the broker dashboard label in %s", (localeCode, label) => {
    // Spec 37: this phase's new nav text is a dictionary key, not a literal.
    // The six entries merged in Phase 3 remain hard-coded English — see this
    // task's note and Known Limitation 18.
    mockSession(ALL_FALSE, true, [BROKER_MEMBERSHIP], localeCode);
    render(<PrimaryNav />);
    expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
  });
```

The locale has to reach `mockSession`, so widen it once more — the existing calls are unaffected because both new parameters have defaults:

```tsx
function mockSession(
  permissions: PermissionMap,
  authenticated = true,
  brokerMemberships: SessionPayload["broker_memberships"] = [],
  localeCode: SessionPayload["locale"] = "EN",
) {
  const value: SessionPayload = {
    authenticated,
    user: authenticated
      ? {
          id: "1",
          email: "nav@example.com",
          full_name: "Nav User",
          primary_role: "BUYER",
          locale: localeCode,
          email_verified: true,
          is_active: true,
        }
      : null,
    locale: localeCode,
    permissions,
    broker_memberships: brokerMemberships,
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && pnpm vitest run src/components/broker/ src/app/dashboard/broker/ src/components/layout/`
Expected: FAIL — unresolved imports for the three new modules, and two new `PrimaryNav` failures.

- [ ] **Step 3a: Write `frontend/src/components/broker/BrokerDashboardNav.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { BrokerMembershipSummary, SessionPayload } from "@/lib/auth/types";
import { tConversations } from "@/lib/i18n/conversations";
import type { Locale } from "@/lib/i18n/directory";

interface BrokerNavLink {
  href: string;
  messageKey: string;
}

/** Spec 28 "Add": Navigation item `Messages` at /dashboard/broker/messages/.
 *
 * EXACTLY these two, and the test pins the array. Spec 4.2's broker row also
 * names /fleet/, /leads/, /team/, /profile/ and /subscription/ — none of those
 * pages exists, and spec 39 forbids shipping a control that leads nowhere
 * (PrimaryNav already holds the same line for /sell/ and /fleet/). Phases 16, 17
 * and 20 add their own entries when they add their own pages.
 *
 * Spec 28 "Remove" names a `Services & Surveyors` item. This repository never
 * had one — it belonged to the static prototype — so the removal is expressed
 * here as a pinned set that it cannot re-enter, plus the 301 in
 * next.config.ts. */
export const BROKER_NAV_LINKS: readonly BrokerNavLink[] = [
  { href: "/dashboard/broker/", messageKey: "broker.dashboard" },
  { href: "/dashboard/broker/messages/", messageKey: "broker.messages" },
];

/** The organization this dashboard is about.
 *
 * `broker_memberships` already contains only `is_active=True` rows
 * (accounts.selectors.get_broker_memberships), so the first entry is a live
 * membership. A person in two brokerages sees the first; an organization
 * switcher is not in spec 28's scope and is recorded in the plan's Known
 * Limitations rather than invented here. */
export function primaryBrokerMembership(
  session: SessionPayload | null,
): BrokerMembershipSummary | null {
  return session?.broker_memberships?.[0] ?? null;
}

export default function BrokerDashboardNav({ locale }: { locale: Locale }) {
  const pathname = usePathname() ?? "";

  return (
    <nav
      aria-label={tConversations(locale, "broker.dashboard.title")}
      className="flex flex-wrap gap-space-md border-b border-outline-variant px-margin-mobile py-space-sm md:px-margin"
    >
      {BROKER_NAV_LINKS.map((link) => {
        // startsWith, so a thread URL underneath Messages still marks Messages
        // as the current section. The dashboard root is matched exactly, or it
        // would claim every page below it.
        const current =
          link.href === "/dashboard/broker/"
            ? pathname === link.href
            : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={current ? "page" : undefined}
            className={`font-label-md text-label-md ${
              current ? "text-primary underline" : "text-on-surface-variant"
            }`}
          >
            {tConversations(locale, link.messageKey)}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 3b: Write `frontend/src/app/dashboard/broker/layout.tsx`**

```tsx
"use client";

import BrokerDashboardNav from "@/components/broker/BrokerDashboardNav";
import { useSession } from "@/lib/auth/session";
import { resolveLocale } from "@/lib/i18n/directory";

/** The broker dashboard shell. The nav renders on every /dashboard/broker/ page
 * so spec 28's "Navigation item `Messages`" is present wherever a broker is,
 * not only on one screen. */
export default function BrokerDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session } = useSession();
  return (
    <>
      <BrokerDashboardNav locale={resolveLocale(session?.user?.locale)} />
      {children}
    </>
  );
}
```

- [ ] **Step 3c: Write the two broker message routes**

`frontend/src/app/dashboard/broker/messages/page.tsx`:

```tsx
"use client";

import { use } from "react";

import RequirePermission from "@/components/auth/RequirePermission";
import { primaryBrokerMembership } from "@/components/broker/BrokerDashboardNav";
import MessagesScreen from "@/components/messages/MessagesScreen";
// resolveFilter comes from lib/api/conversations, NOT from
// app/dashboard/messages/page.tsx. That module is a server route file: it also
// exports `generateMetadata` and `dynamic`, which are route configuration
// rather than values, and importing it from a "use client" module drags a
// server page into the client graph and breaks the build.
import { resolveFilter } from "@/lib/api/conversations";
import { useSession } from "@/lib/auth/session";
import { tConversations } from "@/lib/i18n/conversations";
import { resolveLocale } from "@/lib/i18n/directory";

// Next 16: searchParams is a Promise, including in a client component, where it
// is unwrapped with React's `use()`.
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function BrokerMessagesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = use(searchParams);
  const { session } = useSession();
  const locale = resolveLocale(session?.user?.locale);
  const membership = primaryBrokerMembership(session);

  return (
    <main className="mx-auto max-w-[1440px] px-margin-mobile py-space-xl md:px-margin-desktop">
      <RequirePermission>
        {membership === null ? (
          <p className="font-body-md text-on-surface-variant">
            {tConversations(locale, "broker.dashboard.no_organization")}
          </p>
        ) : (
          <MessagesScreen
            brokerId={membership.broker_id}
            basePath="/dashboard/broker/messages/"
            filter={resolveFilter(first(params.filter))}
          />
        )}
      </RequirePermission>
    </main>
  );
}
```

`frontend/src/app/dashboard/broker/messages/[conversationId]/page.tsx`:

```tsx
import RequirePermission from "@/components/auth/RequirePermission";
import ThreadScreen from "@/components/messages/ThreadScreen";

// An async SERVER component, unlike its sibling inbox page: it needs no session
// and no searchParams, only the route param. Its test therefore calls it
// directly, while the inbox page's test renders it as an element inside
// Suspense. The difference is deliberate; do not unify them.
export const dynamic = "force-dynamic";

type Params = Promise<{ conversationId: string }>;

export default async function BrokerThreadPage({ params }: { params: Params }) {
  const { conversationId } = await params;
  return (
    <main className="mx-auto max-w-[1440px] px-margin-mobile py-space-xl md:px-margin-desktop">
      <RequirePermission>
        <ThreadScreen
          conversationId={conversationId}
          basePath="/dashboard/broker/messages/"
        />
      </RequirePermission>
    </main>
  );
}
```

- [ ] **Step 3d: Modify `frontend/src/components/layout/PrimaryNav.tsx`**

Widen the link type and append one entry — reorder nothing, and **rename nothing**: the existing six entries keep their hard-coded `label`.

```tsx
interface NavLink {
  href: string;
  /** Hard-coded English, as the six entries merged in Phase 3 all are. */
  label?: string;
  /** A key in CONVERSATION_MESSAGES, resolved per the viewer's locale.
   *
   * New UI text must be an EN/IT/ES key (spec 37), so this phase's entry uses
   * this rather than `label`. The existing entries are NOT converted here:
   * retro-fitting six labels into a dictionary is a change to Phase 3's
   * component with its own copy decisions (what is "Boats" in Italian on a
   * marketplace that has not shipped a boats page?), and this plan's charter is
   * spec 28. Recorded as Known Limitation 18, beside the related observation
   * that the same six links point at pages that do not exist. */
  messageKey?: string;
  permission?: PermissionKey;
  /** Some entries are gated on membership rather than on a spec 5 capability:
   * spec 5's table has no "broker dashboard" row, and an AGENT with every flag
   * false is still a member of the organization. */
  requiresBrokerMembership?: boolean;
}
```

```tsx
  {
    href: "/dashboard/broker/",
    // Spec 37: new UI text is a key, never a literal. `broker.dashboard.title`
    // already carries EN/IT/ES and is the same string the broker home page's
    // own nav landmark uses, so the two can never drift.
    messageKey: "broker.dashboard.title",
    requiresBrokerMembership: true,
  },
```

…add two imports:

```tsx
import { tConversations } from "@/lib/i18n/conversations";
import { resolveLocale } from "@/lib/i18n/directory";
```

…and replace the `visible` computation and the label expression:

```tsx
  const isBrokerMember = (session?.broker_memberships?.length ?? 0) > 0;
  // PrimaryNav is already a client component holding the session, so the
  // viewer's own locale is available here. resolveLocale is the shared helper
  // (lib/i18n/directory.ts:15) — the session's LocaleCode is "EN"/"IT"/"ES"
  // and the dictionary's Locale is "en"/"it"/"es", and that lowercasing lives
  // in exactly one place.
  const locale = resolveLocale(session?.user?.locale);

  const visible = LINKS.filter((link) => {
    if (link.permission !== undefined && !can(link.permission)) return false;
    if (link.requiresBrokerMembership && !isBrokerMember) return false;
    return true;
  });
```

```tsx
            <Link
              href={link.href}
              className="font-body-md text-on-surface-variant hover:text-primary"
            >
              {link.messageKey
                ? tConversations(locale, link.messageKey)
                : link.label}
            </Link>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && pnpm vitest run`
Expected: PASS — the whole frontend suite, with **21 new tests** from this task: 9 in `BrokerDashboardNav.test.tsx` (6 for the nav, 3 for `primaryBrokerMembership`), 5 in the broker inbox page, 2 in the broker thread page, and 5 appended to `PrimaryNav.test.tsx` (2 plain cases plus one `it.each` over EN/IT/ES), whose existing 4 stay green and unedited.

Run: `cd frontend && pnpm lint && pnpm exec tsc --noEmit && pnpm build`
Expected: no errors; the build output lists `/dashboard/broker/messages` and `/dashboard/broker/messages/[conversationId]`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components frontend/src/app/dashboard
git commit -m "feat(broker): Messages navigation and broker-scoped message routes (Phase 19 Task 8)"
```

---

### Task 9: Broker home — only the metrics spec §28 permits

**Files:**
- Create: `frontend/src/components/broker/BrokerMetrics.tsx` + `.test.tsx`
- Create: `frontend/src/app/dashboard/broker/page.tsx` + `page.test.tsx`

**Interfaces:**
- Consumes: `fetchBrokerDashboard`, `messageErrorKey`, type `BrokerDashboard` from `@/lib/api/conversations`; `primaryBrokerMembership` from `@/components/broker/BrokerDashboardNav`; `useSession`; `tConversations`.
- Produces: `BrokerMetrics` — props `{ locale, dashboard }`; the route `/dashboard/broker/`.

- [ ] **Step 1: Write the failing tests**

`frontend/src/components/broker/BrokerMetrics.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import BrokerMetrics from "@/components/broker/BrokerMetrics";
import type { BrokerDashboard } from "@/lib/api/conversations";

const DASHBOARD: BrokerDashboard = {
  broker: {
    id: "b-1",
    name: "Phase19 Alpha Brokers",
    slug: "phase19-alpha-brokers",
    status: "ACTIVE",
  },
  published_listings: 12,
  pending_approvals: 3,
  messages: {
    enabled: true,
    can_read: true,
    unread_conversations: 4,
    unread_messages: 7,
    new_inquiries_7d: 2,
  },
};

describe("BrokerMetrics", () => {
  it("shows exactly spec 28's four metrics and nothing else", () => {
    render(<BrokerMetrics locale="en" dashboard={DASHBOARD} />);
    const terms = screen.getAllByRole("term").map((node) => node.textContent);
    expect(terms).toEqual([
      "Published listings",
      "Pending approvals",
      "Unread messages",
      "New inquiries",
    ]);
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("states the window the backend actually computed", () => {
    render(<BrokerMetrics locale="en" dashboard={DASHBOARD} />);
    expect(screen.getByText("Last 7 days")).toBeInTheDocument();
  });

  it("shows no service or surveyor widget", () => {
    // Spec 28 "Remove": "Any empty service/survey metrics left on broker home."
    const { container } = render(
      <BrokerMetrics locale="en" dashboard={DASHBOARD} />,
    );
    expect(container.textContent?.toLowerCase()).not.toMatch(/surveyor|service/);
  });

  it("hides the messaging tiles and explains why when the role cannot read them", () => {
    render(
      <BrokerMetrics
        locale="en"
        dashboard={{
          ...DASHBOARD,
          messages: {
            enabled: true,
            can_read: false,
            unread_conversations: null,
            unread_messages: null,
            new_inquiries_7d: null,
          },
        }}
      />,
    );
    expect(screen.queryByText("Unread messages")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Your team role does not include reading this organization's messages.",
      ),
    ).toBeInTheDocument();
    // The listing metrics still work.
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("explains a disabled flag differently from a missing capability", () => {
    render(
      <BrokerMetrics
        locale="en"
        dashboard={{
          ...DASHBOARD,
          messages: {
            enabled: false,
            can_read: false,
            unread_conversations: null,
            unread_messages: null,
            new_inquiries_7d: null,
          },
        }}
      />,
    );
    expect(
      screen.getByText("Messaging is not enabled yet."),
    ).toBeInTheDocument();
  });

  it("never renders a hard-coded zero in place of an unknown count", () => {
    // Spec 2.1: every visible state has a backend source. null means "not
    // computed", and printing 0 would be a fabricated number.
    render(
      <BrokerMetrics
        locale="en"
        dashboard={{
          ...DASHBOARD,
          messages: {
            enabled: true,
            can_read: false,
            unread_conversations: null,
            unread_messages: null,
            new_inquiries_7d: null,
          },
        }}
      />,
    );
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});
```

`frontend/src/app/dashboard/broker/page.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import BrokerHomePage from "@/app/dashboard/broker/page";
import { ApiError } from "@/lib/api/client";

const { useSessionMock, fetchDashboardMock } = vi.hoisted(() => ({
  useSessionMock: vi.fn(),
  fetchDashboardMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ useSession: () => useSessionMock() }));
vi.mock("@/lib/api/conversations", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/api/conversations")>();
  return {
    ...actual,
    fetchBrokerDashboard: (...a: unknown[]) => fetchDashboardMock(...a),
  };
});
vi.mock("@/components/auth/RequirePermission", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="guard">{children}</div>
  ),
}));

const MEMBERSHIP = {
  broker_id: "b-1",
  broker_name: "Phase19 Alpha Brokers",
  broker_slug: "phase19-alpha-brokers",
  broker_status: "ACTIVE",
  broker_auto_approve_listings: false,
  role: "MANAGER",
  can_edit_listings: false,
  can_manage_team: false,
  can_read_messages: true,
};

function mockSession(memberships: unknown[], loading = false) {
  useSessionMock.mockReturnValue({
    session: {
      authenticated: true,
      user: { locale: "EN" },
      broker_memberships: memberships,
    },
    loading,
    error: null,
    can: () => false,
    login: vi.fn(),
    logout: vi.fn(),
    reload: vi.fn(),
  });
}

afterEach(() => {
  useSessionMock.mockReset();
  fetchDashboardMock.mockReset();
});

describe("/dashboard/broker/", () => {
  it("fetches nothing while the session is loading", () => {
    mockSession([MEMBERSHIP], true);
    render(<BrokerHomePage />);
    expect(fetchDashboardMock).not.toHaveBeenCalled();
  });

  it("loads the metrics for the caller's organization", async () => {
    mockSession([MEMBERSHIP]);
    fetchDashboardMock.mockResolvedValue({
      broker: {
        id: "b-1",
        name: "Phase19 Alpha Brokers",
        slug: "phase19-alpha-brokers",
        status: "ACTIVE",
      },
      published_listings: 12,
      pending_approvals: 3,
      messages: {
        enabled: true,
        can_read: true,
        unread_conversations: 4,
        unread_messages: 7,
        new_inquiries_7d: 2,
      },
    });
    render(<BrokerHomePage />);
    await waitFor(() => expect(screen.getByText("12")).toBeInTheDocument());
    expect(fetchDashboardMock).toHaveBeenCalledWith("b-1");
    expect(
      screen.getByRole("heading", { name: "Phase19 Alpha Brokers" }),
    ).toBeInTheDocument();
  });

  it("explains itself to an account with no broker organization", () => {
    mockSession([]);
    render(<BrokerHomePage />);
    expect(fetchDashboardMock).not.toHaveBeenCalled();
    expect(
      screen.getByText("Your account is not a member of a broker organization."),
    ).toBeInTheDocument();
  });

  it("names the real cause of a 403, never the server's English string", async () => {
    // Ruling 15. The session lists memberships regardless of the organization's
    // status (accounts/selectors.py:63-65) while the API requires ACTIVE
    // (accounts/services.py:150-159), so a member of a SUSPENDED brokerage
    // reaches this screen and is refused. "Something went wrong" would be true
    // and useless.
    mockSession([MEMBERSHIP]);
    fetchDashboardMock.mockRejectedValue(
      new ApiError(403, "not_broker_member", "You are not a member."),
    );
    render(<BrokerHomePage />);
    await waitFor(() =>
      expect(
        screen.getByText(/suspended, or your membership may have been removed/),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText("You are not a member.")).not.toBeInTheDocument();
  });

  it("falls back to the generic message for a code it does not know", async () => {
    mockSession([MEMBERSHIP]);
    fetchDashboardMock.mockRejectedValue(new ApiError(500, "teapot", "boom"));
    render(<BrokerHomePage />);
    await waitFor(() =>
      expect(
        screen.getByText("Something went wrong. Try again."),
      ).toBeInTheDocument(),
    );
  });

  it("wraps its content in the sign-in guard", () => {
    mockSession([MEMBERSHIP]);
    fetchDashboardMock.mockResolvedValue({
      broker: {
        id: "b-1",
        name: "Phase19 Alpha Brokers",
        slug: "phase19-alpha-brokers",
        status: "ACTIVE",
      },
      published_listings: 0,
      pending_approvals: 0,
      messages: {
        enabled: false,
        can_read: false,
        unread_conversations: null,
        unread_messages: null,
        new_inquiries_7d: null,
      },
    });
    render(<BrokerHomePage />);
    expect(screen.getByTestId("guard")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && pnpm vitest run src/components/broker/ src/app/dashboard/broker/`
Expected: FAIL — two unresolved imports.

- [ ] **Step 3a: Write `frontend/src/components/broker/BrokerMetrics.tsx`**

```tsx
import type { BrokerDashboard } from "@/lib/api/conversations";
import { tConversations } from "@/lib/i18n/conversations";
import type { Locale } from "@/lib/i18n/directory";

interface Props {
  locale: Locale;
  dashboard: BrokerDashboard;
}

const TILE =
  "rounded-xl border border-outline-variant p-space-md";

/** Spec 28 "Dashboard metrics": "only backend-derived useful metrics such as
 * published listings, pending approvals, unread messages and new inquiries.
 * Remove surveyor/service widgets completely."
 *
 * There are exactly four tiles and each one prints a number the server
 * computed. A null count is never rendered as 0 — null means "not computed"
 * (the flag is off, or this role may not read messages), and printing a zero
 * would be the fabricated state spec 2.1 forbids. */
export default function BrokerMetrics({ locale, dashboard }: Props) {
  const { messages } = dashboard;
  const showMessageTiles = messages.enabled && messages.can_read;

  return (
    <section aria-labelledby="broker-metrics-heading">
      <h2 id="broker-metrics-heading" className="sr-only">
        {tConversations(locale, "broker.dashboard.title")}
      </h2>
      <dl className="grid grid-cols-1 gap-space-md sm:grid-cols-2 lg:grid-cols-4">
        <div className={TILE}>
          <dt className="font-label-md text-label-md text-on-surface-variant">
            {tConversations(locale, "broker.dashboard.metric.published_listings")}
          </dt>
          <dd className="font-headline-sm text-headline-sm text-primary">
            {dashboard.published_listings}
          </dd>
        </div>
        <div className={TILE}>
          <dt className="font-label-md text-label-md text-on-surface-variant">
            {tConversations(locale, "broker.dashboard.metric.pending_approvals")}
          </dt>
          <dd className="font-headline-sm text-headline-sm text-primary">
            {dashboard.pending_approvals}
          </dd>
        </div>
        {showMessageTiles ? (
          <>
            <div className={TILE}>
              <dt className="font-label-md text-label-md text-on-surface-variant">
                {tConversations(
                  locale,
                  "broker.dashboard.metric.unread_messages",
                )}
              </dt>
              <dd className="font-headline-sm text-headline-sm text-primary">
                {messages.unread_messages}
              </dd>
            </div>
            <div className={TILE}>
              <dt className="font-label-md text-label-md text-on-surface-variant">
                {tConversations(locale, "broker.dashboard.metric.new_inquiries")}
              </dt>
              <dd className="font-headline-sm text-headline-sm text-primary">
                {messages.new_inquiries_7d}
              </dd>
              <p className="font-body-sm text-on-surface-variant">
                {tConversations(
                  locale,
                  "broker.dashboard.metric.new_inquiries_help",
                )}
              </p>
            </div>
          </>
        ) : null}
      </dl>
      {showMessageTiles ? null : (
        <p className="mt-space-md font-body-md text-on-surface-variant">
          {tConversations(
            locale,
            messages.enabled
              ? "broker.dashboard.messages_locked"
              : "broker.dashboard.messages_unavailable",
          )}
        </p>
      )}
    </section>
  );
}
```

- [ ] **Step 3b: Write `frontend/src/app/dashboard/broker/page.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";

import RequirePermission from "@/components/auth/RequirePermission";
import { primaryBrokerMembership } from "@/components/broker/BrokerDashboardNav";
import BrokerMetrics from "@/components/broker/BrokerMetrics";
import {
  fetchBrokerDashboard,
  messageErrorKey,
  type BrokerDashboard,
} from "@/lib/api/conversations";
import { useSession } from "@/lib/auth/session";
import { tConversations } from "@/lib/i18n/conversations";
import { resolveLocale } from "@/lib/i18n/directory";

export default function BrokerHomePage() {
  const { session, loading } = useSession();
  const [dashboard, setDashboard] = useState<BrokerDashboard | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const locale = resolveLocale(session?.user?.locale);
  const membership = primaryBrokerMembership(session);
  const brokerId = membership?.broker_id ?? null;

  const load = useCallback(async () => {
    if (brokerId === null) return;
    try {
      setDashboard(await fetchBrokerDashboard(brokerId));
      setErrorKey(null);
    } catch (caught) {
      setDashboard(null);
      setErrorKey(messageErrorKey(caught));
    }
  }, [brokerId]);

  useEffect(() => {
    // Same session-timing rule as the messages screens: nothing is fetched
    // until SessionProvider has finished trading the refresh cookie.
    if (loading) return;
    void load();
  }, [loading, load]);

  return (
    <main className="mx-auto max-w-[1440px] px-margin-mobile py-space-xl md:px-margin-desktop">
      <RequirePermission>
        {membership === null ? (
          <p className="font-body-md text-on-surface-variant">
            {tConversations(locale, "broker.dashboard.no_organization")}
          </p>
        ) : (
          <>
            <h1 className="font-headline-md text-headline-md text-primary">
              {membership.broker_name}
            </h1>
            {errorKey ? (
              <p role="alert" className="mt-space-lg font-body-md text-error">
                {tConversations(locale, errorKey)}
              </p>
            ) : null}
            {dashboard ? (
              <div className="mt-space-lg">
                <BrokerMetrics locale={locale} dashboard={dashboard} />
              </div>
            ) : null}
          </>
        )}
      </RequirePermission>
    </main>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && pnpm vitest run`
Expected: PASS — the whole suite, with **12 new tests** from this task (6 in `BrokerMetrics.test.tsx`, 6 in the broker home page).

Run: `cd frontend && pnpm lint && pnpm exec tsc --noEmit && pnpm build`
Expected: no errors; the build output lists `/dashboard/broker`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/broker frontend/src/app/dashboard/broker
git commit -m "feat(broker): broker home with spec 28's four backend-derived metrics (Phase 19 Task 9)"
```

---

### Task 10: Spec §4.3's 301, and the evidence that no `Services & Surveyors` surface exists

**Files:**
- Modify: `frontend/next.config.ts`, `frontend/next.config.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: the `/dashboard/broker/services/` → `/dashboard/broker/messages/` 301.

- [ ] **Step 1: Run the removal sweep and record the result**

Spec §28's definition of done: *"No visible or API navigation remains for broker Services & Surveyors."* This is evidence, not a claim:

```bash
cd /path/to/worktree
rg -i "surveyor" frontend/src backend --glob '!*.lock' || echo "NO SURVEYOR SURFACE"
rg -n "dashboard/broker/services" frontend backend || echo "NO LEGACY ROUTE"
rg -n "services" frontend/src/components/broker/BrokerDashboardNav.tsx || echo "NOT IN BROKER NAV"
```

Expected, verbatim, in the PR description:
- the first command prints **only** `backend/messaging/tests/test_conversation_model.py` (the Phase 6 fixture display name `"Phase6 Surveyors"`) — a test fixture, not a surface;
- the second prints nothing before this task's change, and after it prints only the new `next.config.ts` line;
- the third prints nothing.

If any command prints something else, a surface has appeared since this plan was written — stop and report it rather than deleting anything unilaterally.

- [ ] **Step 2: Write the failing test**

Update `frontend/next.config.test.ts`. **The existing `toHaveLength(2)` at line 13 must become 3, and the new case is added; every other assertion in the file already covers the new redirect** (no `permanent`, explicit 301, no chain):

```ts
  it("301-redirects both retired directory URLs and the retired broker services URL", async () => {
    const redirects = await nextConfig.redirects!();

    expect(redirects).toHaveLength(3);
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
        expect.objectContaining({
          // Spec 4.2: "The obsolete broker route /dashboard/broker/services/
          // returns 301 to /dashboard/broker/messages/ after deployment."
          source: "/dashboard/broker/services/",
          destination: "/dashboard/broker/messages/",
          statusCode: 301,
        }),
      ]),
    );
  });

  it("redirects the retired broker route to a page that exists", async () => {
    // Spec 28's definition of done: "Legacy route redirects ONCE to Messages."
    // The existing "never redirects to a destination that is itself a redirect
    // source" test proves the "once"; this one proves the destination is the
    // route Task 8 actually built.
    const redirects = await nextConfig.redirects!();
    const legacy = redirects.find(
      (redirect) => redirect.source === "/dashboard/broker/services/",
    );
    expect(legacy?.destination).toBe("/dashboard/broker/messages/");
  });
```

Also rename the existing `it("301-redirects both retired directory URLs to the combined directory")` block to the new title above rather than leaving two overlapping cases.

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd frontend && pnpm vitest run next.config.test.ts`
Expected: FAIL — `expected length 3, received 2`.

- [ ] **Step 4: Add the redirect to `frontend/next.config.ts`**

Append inside the returned array — reorder nothing:

```ts
      {
        // Spec 4.2/4.3 row 5. `trailingSlash: true` is set above, so the
        // slashed form is the canonical one on both sides and this stays a
        // single hop rather than 301 → 308 → page.
        source: "/dashboard/broker/services/",
        destination: "/dashboard/broker/messages/",
        statusCode: 301,
      },
```

- [ ] **Step 5: Run the tests and verify the redirect end to end**

Run: `cd frontend && pnpm vitest run next.config.test.ts`
Expected: PASS — **5 tests** (the file's existing four, one of them renamed and widened, plus the new destination test).

Run this as **one command** from `frontend/` — it starts the server, waits for it, probes both URL shapes and always stops the server again:

```bash
cd frontend && pnpm build && \
( pnpm start & echo $! > .redirect-probe.pid ) && \
until curl -sSf -o /dev/null http://127.0.0.1:3000/health/; do sleep 1; done && \
echo "=== canonical (slashed), the form spec 4.3 names ===" && \
curl -sS -o /dev/null -D - -L http://127.0.0.1:3000/dashboard/broker/services/ ; \
echo "=== slashless, for the record ===" ; \
curl -sS -o /dev/null -D - -L http://127.0.0.1:3000/dashboard/broker/services ; \
kill "$(cat .redirect-probe.pid)" && rm -f .redirect-probe.pid
```

Expected, and **paste both blocks into the PR description** — spec §4.3 requires redirect destinations to be covered and to create no chain, and only a running server proves the second half:

- **Slashed** (`/dashboard/broker/services/`): exactly one `HTTP/1.1 301` with `location: /dashboard/broker/messages/`, then one `200`. One hop, which is what §4.3's "Status 301" row and §28's "Legacy route redirects **once**" require.
- **Slashless** (`/dashboard/broker/services`): a `308` to the slashed form, then the `301`, then `200` — **two hops**. This is inherent to `trailingSlash: true` and is already true of the two Phase 5 redirects merged in `next.config.ts`; spec §4.3's table names only the slashed URL, so the slashless shape is not a route this project publishes. Recorded as Known Limitation 17 rather than left for a reviewer to discover, and **not** "fixed" by dropping `trailingSlash`, which would un-canonicalise every §4.1 route.

If `/health/` is not the right readiness URL in this checkout, substitute the one `frontend/src/app/health/page.tsx` serves; do not replace the `until` loop with a fixed `sleep`.

- [ ] **Step 6: Commit**

```bash
git add frontend/next.config.ts frontend/next.config.test.ts
git commit -m "feat(broker): 301 the retired /dashboard/broker/services/ route to Messages (Phase 19 Task 10)"
```

---

### Task 11: Phase acceptance tests, full regression and the handoff note

**Files:**
- Create: `backend/brokers/tests/test_phase_19_acceptance.py`
- Modify: `ACTIVITY.md`, `docs/superpowers/PHASE-TRACKER.md`

**Interfaces:**
- Consumes: everything Tasks 1–10 produced.
- Produces: nothing importable. This task's product is evidence.

- [ ] **Step 1: Write the acceptance tests**

`backend/brokers/tests/test_phase_19_acceptance.py`:

```python
"""Spec 28's definition of done and spec 40 Scenario L, proved end to end.

Scenario L: "Given a broker user, When dashboard navigation loads, Then Messages
is present with real conversation counts and Services & Surveyors is absent; its
old URL redirects once to Messages."

The navigation and redirect halves are frontend facts and are proved by
frontend/src/components/broker/BrokerDashboardNav.test.tsx and
frontend/next.config.test.ts. THIS module proves the half a browser test cannot:
that the counts are real, that they are one organization's, and that no second
message store exists.
"""

from datetime import timedelta

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.tests.factories import make_user
from brokers.enums import BrokerMembershipRole
from brokers.tests.factories import make_broker, make_membership
from listings.enums import ListingStatus, RevisionStatus
from listings.models import ListingRevision
from listings.tests.factories import make_brand, make_broker_listing
from messaging.enums import UNIFIED_INQUIRIES_FLAG, ConversationStatus, ConversationType
from messaging.models import Conversation, Message
from messaging.tests.factories import make_conversation, make_message
from platform_settings.services import set_feature_flag

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _messaging_flag_on(db):
    set_feature_flag(
        key=UNIFIED_INQUIRIES_FLAG,
        is_enabled=True,
        actor=None,
        description="Enabled by Phase 19 acceptance tests.",
    )
    yield


@pytest.fixture
def api():
    return APIClient()


def listing_for(broker, actor, status, tag):
    """One broker listing with its OWN brand — see the note in
    test_broker_dashboard_api.py: taxonomy.BoatBrand enforces normalized-name
    uniqueness, and make_broker_listing derives its default brand name from the
    broker's pk, so two default-brand listings for one brokerage collide."""
    return make_broker_listing(
        broker=broker,
        actor=actor,
        brand=make_brand(f"Phase19 {tag}"),
        status=status,
    )


def thread_from(email, broker, subject, *, bodies=("Hello, I am interested in this.",)):
    """One OPEN broker thread, from a NEW initiator every time.

    Conversation's `messaging_open_broker_thread_unique` partial index allows one
    OPEN thread per (initiator, broker), so two threads for the same brokerage
    need two different initiators. This helper makes that impossible to forget.
    """
    conversation = make_conversation(
        initiator=make_user(email=email),
        conversation_type=ConversationType.BROKER_INQUIRY,
        broker=broker,
        subject=subject,
    )
    for body in bodies:
        make_message(conversation=conversation, sender=conversation.initiator, body=body)
    return conversation


@pytest.fixture
def two_brokerages():
    alpha = make_broker(name="Phase19 Accept Alpha", slug="phase19-accept-alpha")
    beta = make_broker(name="Phase19 Accept Beta", slug="phase19-accept-beta")
    alpha_reader = make_user(email="accept-alpha@phase19.example")
    beta_reader = make_user(email="accept-beta@phase19.example")
    asker = make_user(email="accept-asker@phase19.example", full_name="Ada Rossi")
    make_membership(
        alpha_reader, alpha, role=BrokerMembershipRole.ADMIN, can_read_messages=True
    )
    make_membership(
        beta_reader, beta, role=BrokerMembershipRole.ADMIN, can_read_messages=True
    )
    return {
        "alpha": alpha,
        "beta": beta,
        "alpha_reader": alpha_reader,
        "beta_reader": beta_reader,
        "asker": asker,
    }


def test_scenario_l_the_counts_a_broker_home_shows_are_real_query_results(
    api, two_brokerages
):
    """Spec 40 Scenario L: "Messages is present with REAL conversation counts."

    Every number is asserted against the rows that produced it, not against a
    fixture constant — spec 26's definition of done: "All visible counters equal
    query results."
    """
    alpha = two_brokerages["alpha"]
    reader = two_brokerages["alpha_reader"]

    for index in range(3):
        listing_for(alpha, reader, ListingStatus.PUBLISHED, f"Pub {index}")
    pending = listing_for(alpha, reader, ListingStatus.PENDING_APPROVAL, "Pending")
    ListingRevision.objects.create(
        listing=pending, state=RevisionStatus.SUBMITTED, created_by=reader
    )
    for index in range(2):
        thread_from(
            f"scenario-l-{index}@phase19.example",
            alpha,
            f"Alpha question {index}",
            bodies=(
                "Hello, I am interested in this.",
                "A follow-up question, thank you.",
            ),
        )

    api.force_authenticate(reader)
    payload = api.get(reverse("broker-dashboard", args=[alpha.pk])).data

    assert payload["published_listings"] == 3
    assert payload["pending_approvals"] == 1
    assert payload["messages"]["unread_conversations"] == 2
    assert payload["messages"]["unread_messages"] == 4
    assert payload["messages"]["new_inquiries_7d"] == 2

    # And the same numbers, recomputed independently from the rows.
    assert payload["published_listings"] == alpha.listings.filter(
        status=ListingStatus.PUBLISHED
    ).count()
    assert payload["messages"]["unread_messages"] == Message.objects.filter(
        conversation__broker=alpha, read_at__isnull=True
    ).exclude(sender=reader).count()


def test_scenario_l_reading_a_thread_moves_the_dashboard_count(api, two_brokerages):
    """A count that does not move is a decoration. This walks the whole loop:
    inbox -> thread -> mark read -> dashboard."""
    alpha = two_brokerages["alpha"]
    reader = two_brokerages["alpha_reader"]
    thread = thread_from("loop-asker@phase19.example", alpha, "Alpha question")

    api.force_authenticate(reader)
    assert (
        api.get(reverse("broker-dashboard", args=[alpha.pk])).data["messages"][
            "unread_messages"
        ]
        == 1
    )

    rows = api.get(reverse("conversation-list"), {"broker": str(alpha.pk)}).data[
        "results"
    ]
    assert [row["id"] for row in rows] == [str(thread.pk)]

    # The thread screen's own two reads, in the order it makes them.
    detail = api.get(reverse("conversation-detail", args=[thread.pk]))
    assert detail.status_code == 200
    assert detail.data == rows[0]
    api.get(reverse("conversation-messages", args=[thread.pk]))
    api.post(reverse("conversation-read", args=[thread.pk]))

    assert (
        api.get(reverse("broker-dashboard", args=[alpha.pk])).data["messages"][
            "unread_messages"
        ]
        == 0
    )


def test_a_broker_never_sees_another_brokers_conversations_from_any_surface(
    api, two_brokerages
):
    """Spec 33.1, swept across every route this phase touches or reuses."""
    alpha = two_brokerages["alpha"]
    beta_reader = two_brokerages["beta_reader"]
    thread = thread_from("idor-asker@phase19.example", alpha, "Alpha question")

    api.force_authenticate(beta_reader)

    # List, unfiltered and filtered by the other organization's id.
    assert api.get(reverse("conversation-list")).data["results"] == []
    assert (
        api.get(reverse("conversation-list"), {"broker": str(alpha.pk)}).data["results"]
        == []
    )
    # Detail, thread read, reply, mark-read, archive: 404 every time, never 403.
    assert api.get(reverse("conversation-detail", args=[thread.pk])).status_code == 404
    assert api.get(reverse("conversation-messages", args=[thread.pk])).status_code == 404
    assert (
        api.post(
            reverse("conversation-messages", args=[thread.pk]),
            {"message": "Let me read somebody else's mail, thank you."},
            format="json",
        ).status_code
        == 404
    )
    assert api.post(reverse("conversation-read", args=[thread.pk])).status_code == 404
    assert (
        api.patch(
            reverse("conversation-status", args=[thread.pk]),
            {"status": "ARCHIVED"},
            format="json",
        ).status_code
        == 404
    )
    # Dashboard metrics: 403, because IsBrokerMember answers before any lookup.
    assert api.get(reverse("broker-dashboard", args=[alpha.pk])).status_code == 403

    # And nothing was written.
    thread.refresh_from_db()
    assert thread.status == ConversationStatus.OPEN
    assert thread.messages.count() == 1


def test_this_phase_added_no_second_message_store(api, two_brokerages):
    """Spec 28 Backend, verbatim: "Do not build a second broker-only messaging
    store." A structural assertion rather than a behavioural one — if a model
    had been added, this list would have grown."""
    from django.apps import apps

    messaging_models = sorted(
        model.__name__ for model in apps.get_app_config("messaging").get_models()
    )
    assert messaging_models == ["ContactAccessGrant", "Conversation", "Message"]
    broker_models = sorted(
        model.__name__ for model in apps.get_app_config("brokers").get_models()
    )
    assert broker_models == ["BrokerMembership", "BrokerOrganization"]


def test_the_broker_inbox_query_count_is_constant_in_the_number_of_rows(
    api, two_brokerages
):
    """Spec 33.3: "Avoid N+1 queries; verify with query-count tests."

    Two REAL inboxes are compared — 2 rows and 7 rows must cost the SAME number
    of queries. An absolute budget that scales with the row count cannot fail on
    an N+1, it budgets for one. This re-proves Phase 6's property after Task 1
    added `context.url`, which reads `broker.slug` / `professional.slug`: if
    either ever stops being select_related, this is what catches it.
    """
    alpha = two_brokerages["alpha"]
    reader = two_brokerages["alpha_reader"]
    for index in range(2):
        thread_from(f"nplus1-{index}@phase19.example", alpha, f"Alpha {index}")

    api.force_authenticate(reader)
    # Warm-up, deliberately discarded: platform_settings.services.is_feature_enabled
    # caches with timeout=None and this package's flag fixture writes a fresh
    # value, so the FIRST request of a test pays one FeatureFlag SELECT no later
    # request pays. Without this line the comparison below is off by exactly one.
    api.get(reverse("conversation-list"), {"broker": str(alpha.pk)})

    with CaptureQueriesContext(connection) as small:
        first = api.get(reverse("conversation-list"), {"broker": str(alpha.pk)})
    assert len(first.data["results"]) == 2

    for index in range(5):
        thread_from(
            f"nplus1-bulk-{index}@phase19.example", alpha, f"Alpha bulk {index}"
        )

    with CaptureQueriesContext(connection) as large:
        second = api.get(reverse("conversation-list"), {"broker": str(alpha.pk)})
    assert len(second.data["results"]) == 7

    assert len(large) == len(small), [entry["sql"] for entry in large]


def test_the_dashboard_is_a_fixed_number_of_queries(api, two_brokerages):
    """Same rule for broker home: adding listings and threads must not add
    queries, because every metric is an aggregate."""
    alpha = two_brokerages["alpha"]
    reader = two_brokerages["alpha_reader"]

    api.force_authenticate(reader)
    api.get(reverse("broker-dashboard", args=[alpha.pk]))  # warm the flag cache

    with CaptureQueriesContext(connection) as small:
        api.get(reverse("broker-dashboard", args=[alpha.pk]))

    for index in range(5):
        listing_for(alpha, reader, ListingStatus.PUBLISHED, f"Dash {index}")
        thread_from(
            f"dash-bulk-{index}@phase19.example", alpha, f"Alpha dash {index}"
        )

    with CaptureQueriesContext(connection) as large:
        payload = api.get(reverse("broker-dashboard", args=[alpha.pk])).data

    assert payload["published_listings"] == 5
    assert len(large) == len(small), [entry["sql"] for entry in large]


def test_a_sender_cannot_hide_a_live_lead_from_the_brokers_inbox(api, two_brokerages):
    """Ruling 5's abuse scenario, end to end.

    Conversation has ONE status column (spec 11.8), so an initiator who could
    archive would remove their own live inquiry from the brokerage's default
    OPEN inbox — the screen spec 28 exists to build. Spec 2.2 puts that refusal
    on the server, and this test is the proof it is there rather than only in
    the UI that hides the button.
    """
    alpha = two_brokerages["alpha"]
    reader = two_brokerages["alpha_reader"]
    thread = thread_from("abuse-asker@phase19.example", alpha, "Alpha question")

    api.force_authenticate(thread.initiator)
    response = api.patch(
        reverse("conversation-status", args=[thread.pk]),
        {"status": "ARCHIVED"},
        format="json",
    )
    assert response.status_code == 403
    assert response.data["error"]["code"] == "conversation_filing_forbidden"

    # The broker's inbox still shows the lead.
    api.force_authenticate(reader)
    rows = api.get(reverse("conversation-list"), {"broker": str(alpha.pk)}).data[
        "results"
    ]
    assert [row["id"] for row in rows] == [str(thread.pk)]
    assert rows[0]["viewer_is_initiator"] is False

    # …and the broker, who IS the recipient side, can file it.
    assert (
        api.patch(
            reverse("conversation-status", args=[thread.pk]),
            {"status": "ARCHIVED"},
            format="json",
        ).status_code
        == 200
    )


def test_an_archived_thread_still_belongs_to_the_same_single_store(api, two_brokerages):
    """Archiving changes one column on the shared Conversation row. Nothing is
    copied, moved or duplicated — which is what spec 28's "shared model" means
    in practice."""
    alpha = two_brokerages["alpha"]
    reader = two_brokerages["alpha_reader"]
    thread = thread_from("archive-asker@phase19.example", alpha, "Alpha question")

    before = Conversation.objects.count()
    api.force_authenticate(reader)
    api.patch(
        reverse("conversation-status", args=[thread.pk]),
        {"status": "ARCHIVED"},
        format="json",
    )
    assert Conversation.objects.count() == before
    assert Conversation.objects.get(pk=thread.pk).status == ConversationStatus.ARCHIVED


def test_the_inquiry_window_boundary_is_the_documented_seven_days(
    api, two_brokerages
):
    """Ruling 7: the window is 7 days, it is named on the wire, and the boundary
    is asserted rather than assumed."""
    from brokers.dashboard import NEW_INQUIRY_WINDOW_DAYS

    assert NEW_INQUIRY_WINDOW_DAYS == 7
    alpha = two_brokerages["alpha"]
    reader = two_brokerages["alpha_reader"]
    inside = make_conversation(
        initiator=two_brokerages["asker"],
        conversation_type=ConversationType.BROKER_INQUIRY,
        broker=alpha,
        subject="Recent",
    )
    outside = make_conversation(
        initiator=make_user(email="old-asker@phase19.example"),
        conversation_type=ConversationType.BROKER_INQUIRY,
        broker=alpha,
        subject="Old",
    )
    Conversation.objects.filter(pk=inside.pk).update(
        created_at=timezone.now() - timedelta(days=6, hours=23)
    )
    Conversation.objects.filter(pk=outside.pk).update(
        created_at=timezone.now() - timedelta(days=7, hours=1)
    )

    api.force_authenticate(reader)
    payload = api.get(reverse("broker-dashboard", args=[alpha.pk])).data
    assert payload["messages"]["new_inquiries_7d"] == 1
```

- [ ] **Step 2: Run the acceptance tests**

Run: `cd backend && uv run pytest brokers/tests/test_phase_19_acceptance.py -v`
Expected: PASS — **9 collected test items**.

- [ ] **Step 3: Full regression, both halves**

Run: `cd backend && uv run pytest -q`
Expected: all pass, 0 failures. Record the exact totals line.

Run: `cd frontend && pnpm lint && pnpm test && pnpm build`
Expected: all pass. Record the exact totals line.

Run: `cd backend && uv run python manage.py check && uv run python manage.py makemigrations --check --dry-run`
Expected: no issues and **no missing migrations** — this phase adds no model and must add no migration.

- [ ] **Step 4: Write the handoff note**

Prepend to the Log section of `ACTIVITY.md` (newest at the top, matching every prior entry):

```markdown
### 2026-09-18 — Phase 19 broker dashboard and messaging complete

- Implemented `docs/superpowers/plans/2026-09-18-phase-19-broker-dashboard-messages.md` in full (11 tasks).
- **No second message store, no new model, no migration** (spec §28 Backend). The broker inbox is Phase 6's `GET /api/v1/conversations/` with `?broker=<id>`, and its five spec §28 filters are Phase 6's existing query parameters.
- Backend additions, all three flagged in the plan as beyond spec §30.1's table: `GET /api/v1/conversations/<id>/` (the thread screen's own read — scanning the paginated inbox instead would have failed silently at a broker's 21st conversation), `PATCH /api/v1/conversations/<id>/status/` (the producer spec §28's "Archived" filter needed — `OPEN ↔ ARCHIVED` only; `BLOCKED` is deliberately unreachable because spec §36.6 makes blocking a moderation act with contact-revocation consequences), and `GET /api/v1/brokers/<id>/dashboard/` (spec §28's four metrics, every one a live query). `ConversationSerializer` gained `viewer_is_initiator` and a `context.url`. Two throttle scopes appended: `conversation_status` 120/hour, `broker_dashboard` 120/min.
- **Filing is recipient-side only.** Spec §11.8 gives `Conversation` one `status` column, so an initiator who could archive would pull their own live lead out of the brokerage's default inbox. `set_conversation_status` refuses with `403 conversation_filing_forbidden` and the control is hidden via `viewer_is_initiator`; the price, recorded as a Known Limitation, is that a sender cannot file their own inbox at all.
- Frontend: one role-neutral `components/messages/` layer mounted twice — at `/dashboard/messages/…`, which is the path Phase 6's `SENDER_CONVERSATION_URL_TEMPLATE` already returns as `next_url` and writes into every `Notification.target_url` (it was a 404 until now), and at `/dashboard/broker/messages/…` inside broker chrome. Broker home at `/dashboard/broker/`. All four routes are wrapped in Phase 3's `RequirePermission`, whose `permission` prop became optional: `PermissionKey` is spec §5's capability table and §5 has no row for reading conversations, so borrowing `submit_inquiry` would have hidden the inbox from an unverified broker member — a client-side rule the server does not hold. `/dashboard/broker/services/` now 301s to Messages (spec §4.3 row 5), verified against a running server as a single hop for the canonical slashed URL.
- **`SENDER_CONVERSATION_URL_TEMPLATE` was kept, not changed**, and the merged comment telling the next reader to change it was corrected: spec §15.5's sender URL and spec §28's `/dashboard/broker/messages/` are two seats on one conversation (the sender is usually a buyer, for whom spec §4.2 has no row at all), so they are two routes. `messaging/tests/test_enums.py`'s two assertions on the constant stayed green and unedited.
- Spec §28's "Remove" section had nothing to remove: `rg -i surveyor` over `frontend/src` and `backend` returns only a Phase 6 test fixture's display name. The removal is guaranteed instead by a pinned broker-navigation link set (exactly Dashboard and Messages) and the 301.
- Known limitations: archiving and unread state are per-conversation, not per-participant (spec §11.8 gives `Conversation` one `status` and `Message` one `read_at`), and senders cannot file at all; no organization switcher; no thread link for a listing context (`BoatListing` has no slug column and `/boats/` has no page); no inbox pagination controls; no WebSocket (Phase 18); no blocking affordance; no staff read path (Phase 6's ruling, upheld, with a positive control proving the moderator fixtures are real); a SUSPENDED brokerage's member still sees the nav before being refused, but is now told why. Full list of 17 in the plan.
- Next: Phase 18 (notifications) can now attach a real `target_url` destination; Phase 20 should delete `NAVIGABLE_URL_PREFIXES` in `ConversationContextPanel.tsx` once `/boats/` and `/brokers/` exist, and should close `PrimaryNav`'s six pre-existing dead links (Known Limitation 16).
```

Update `docs/superpowers/PHASE-TRACKER.md` row 19 to `**done**` with the plan path and a one-paragraph note in the established style.

- [ ] **Step 5: Commit**

```bash
git add backend/brokers/tests/test_phase_19_acceptance.py ACTIVITY.md docs/superpowers/PHASE-TRACKER.md
git commit -m "test(brokers): Phase 19 acceptance suite and handoff note (Phase 19 Task 11)"
```

---

## Known Limitations (carried forward, not fixed by this plan)

1. **Archiving is per conversation, not per participant, and only the recipient side may do it.** Spec §11.8 gives `Conversation` one `status` column. Ruling 5 makes the consequence safe rather than pretending it away: a sender cannot hide a broker's live lead, and the price is that **a sender cannot file their own inbox at all** — `Archive` simply does not appear for them, and `PATCH .../status/` answers `403 conversation_filing_forbidden`. The real fix is a per-participant flag, which needs an amendment to §11.8; it is not something a screen may invent.
2. **Unread is per recipient side, not per team member.** Spec §11.8 gives `Message` one nullable `read_at` (Phase 6 Known Limitation 7). Broker member A opening a thread clears it for member B. A per-person badge needs a `MessageRead` join table §11.8 does not define. The UI never says "your unread" for this reason.
3. **No organization switcher.** A person with memberships in two brokerages sees the first (`primaryBrokerMembership`). Spec §28 does not ask for a switcher and `broker_memberships` has no "primary" marker. A `?broker=` override on `/dashboard/broker/…` is the natural shape when one is wanted.
4. **No listing link in the thread context panel.** `BoatListing` has no slug column while spec §4.1's canonical boat URL is `/boats/<listing-slug>/`, and `frontend/src/app/` has no `/boats/` route. The backend returns `url: null` for a listing context and the panel renders the label as text. Phase 20 owns both halves.
5. **No broker-profile link either, for now.** The backend returns the canonical `/brokers/<slug>/`, but `NAVIGABLE_URL_PREFIXES` in `ConversationContextPanel.tsx` does not yet include it because that page does not exist. **Phase 20 deletes one array entry and the link appears.**
6. **No WebSocket and no polling.** Spec §27.2 is Phase 18's. The inbox refetches on navigation, filter change and mutation; nothing pushes.
7. **No blocking affordance.** `ConversationStatus.BLOCKED` remains modelled, enforced on reply and on the status endpoint, and produced by nothing. Spec §36.6's "recipient blocking a user … may revoke access" needs Phase 7's `revoked_at` and a moderation surface; ruled out of this phase deliberately (ruling 4).
8. **No staff read path.** Upheld from Phase 6's Task 9 ruling and extended to `IsBrokerMember`: a staff moderator with no membership sees no conversations and no broker dashboard. Both tests that assert this build a **real** moderator (`primary_role == STAFF` **and** the `staff_moderator` group, which `accounts/services.py:122-126` both require) and are paired with a positive control proving the same user can reach Phase 12's staff broker endpoint — without that pairing the assertion would pass for the wrong reason. If the ruling is ever reversed, the fix is a branch in `IsBrokerMember` **and** a matching branch in `messaging.selectors.can_view_conversation` plus its `Q` in `conversations_visible_to` — all three change together, or a list will show a row a detail view refuses.
9. **No pagination controls on the inbox.** `ConversationPagination` is 20 per page and the screen renders page 1. The API returns `next`/`previous`; the controls are a small follow-up, and Phase 5's directory page has the worked pattern (rebuild the href against the page's own URL, never render the API's absolute `next`). This no longer breaks the *thread* screen — ruling 14's detail endpoint removed that coupling — it only means a broker with more than 20 conversations cannot reach the older ones from the list.
10. **No `/dashboard/private-seller/` shell.** `/dashboard/messages/…` exists and works for a private seller, a buyer or a professional, but there is no role navigation around it. Spec §4.2's private-seller row is Phase 16's.
11. **Spec §15.4's "broker's configured notification recipients" is still `BrokerOrganization.public_email`** (Phase 6 Known Limitation 6). This phase builds a broker screen but not a team-settings screen, so the field to configure a recipient list still has nowhere to live. Phase 17's staff broker tooling or a later broker settings screen owns it.
12. **A brokerage whose members all lack `can_read_messages` is still notified by nobody** (Phase 6 Known Limitation 5). The broker dashboard now makes the condition *visible* — `messages.can_read` is false and the screen says so — but the team-capability editor that fixes it is Phase 17's.
13. **API error messages remain English on the wire.** Spec §30.2 asks for a localized message; `common.exceptions.nauta_exception_handler` returns English. This phase does what Phase 6 did: the client maps `error.code` to its own EN/IT/ES copy and never renders `error.message`. The project-wide gap is unchanged.
14. **No browser end-to-end test.** `frontend/package.json` has no Playwright, Cypress or WebDriver (`pnpm test` is `vitest run`). Spec §34.5 lives inside §34, which is Phase 23. Scenario L is covered at component level (`BrokerDashboardNav.test.tsx`), at config level (`next.config.test.ts`, plus a real `curl` against a running server in Task 10) and at API level (`test_phase_19_acceptance.py`).
15. **A SUSPENDED brokerage's member still sees the Messages navigation before being refused.** `accounts/selectors.py:63-65` returns every `is_active=True` membership regardless of the organization's status, while `accounts/services.py:150-159` requires `broker__status=ACTIVE`. Both are right for their own job, so ruling 15 changes neither: the screen now names the real cause (`messages.error.not_broker_member` says the organization may be suspended or the membership removed) instead of showing a generic failure. Hiding the nav entry as well would mean teaching `PrimaryNav` and `BrokerDashboardNav` a status rule the session payload does not carry — a change to Phase 3's contract, not this phase's.
16. **`PrimaryNav` links to six pages that do not exist.** `frontend/src/components/layout/PrimaryNav.tsx:15-32` offers `/boats/`, `/brokers/`, `/financing/`, `/dashboard/staff/`, `/settings/` and `/account/`; of its link set only `/services/professionals/` has a page today. An earlier draft of this plan cited that component as a *precedent* for avoiding dead links, which was the opposite of the truth (see ruling 3's correction). This phase holds the line on the surfaces it authors — the broker nav and the thread's context link — and deliberately does not widen its diff into a merged Phase 3 component to fix the rest. Phase 20 builds most of those pages and should close this.
17. **`/dashboard/broker/services` (no trailing slash) reaches Messages in two hops, not one.** With `trailingSlash: true` Next.js 308s the slashless form to the slashed one, which then 301s to Messages. Spec §4.3's table names only `/dashboard/broker/services/`, and the same two-hop shape already applies to the two Phase 5 redirects merged in `next.config.ts`, so this is a property of the project's canonical-URL setting rather than of this redirect. Task 10's probe prints both shapes so the behaviour is recorded rather than discovered. Dropping `trailingSlash` would un-canonicalise every §4.1 route and is not the fix.
18. **`PrimaryNav` now mixes a localized label with six hard-coded English ones.** This phase's entry carries `messageKey: "broker.dashboard.title"` and renders through `tConversations`, because spec §37 governs *new* UI text. The six Phase 3 entries (`Boats`, `Brokers`, `Services / Professionals`, `Financing`, `Moderation`, `Settings`) keep their literals, along with `Sign in`, `Sign out` and the account link. Retro-fitting them is a change to Phase 3's component with copy decisions of its own — `directory.ts` already holds `nav.services_professionals`, so one of the six even has a key waiting — and doing it here would put six unreviewed Italian and Spanish marketplace terms into a diff whose charter is spec §28. The `NavLink` type carries both fields with a comment saying which is for what, so the next phase to touch this file can convert them a link at a time. Phase 20, which owns public UI, is the natural place.


## Contract summary for later phases

Everything a downstream phase imports from Phase 19, in one place. **Phases 16, 17, 18 and 20 depend on this section; the names below are fixed.**

```python
from brokers.dashboard import (
    NEW_INQUIRY_WINDOW_DAYS,
    broker_dashboard_metrics,
    broker_message_metrics,
)
from brokers.permissions import IsBrokerMember
from brokers.views import BrokerDashboardView
from messaging.exceptions import (
    ConversationFilingForbidden,
    ConversationSuperseded,
    InvalidConversationStatus,
)
from messaging.serializers import ConversationStatusSerializer
from messaging.services import ARCHIVABLE_STATUSES, set_conversation_status
from messaging.views import ConversationDetailView, ConversationStatusView
```

```ts
// frontend
import BrokerDashboardNav, {
  BROKER_NAV_LINKS,
  primaryBrokerMembership,
} from "@/components/broker/BrokerDashboardNav";
import BrokerMetrics from "@/components/broker/BrokerMetrics";
import ConversationContextPanel, {
  NAVIGABLE_URL_PREFIXES,
} from "@/components/messages/ConversationContextPanel";
import ConversationFilters from "@/components/messages/ConversationFilters";
import ConversationList from "@/components/messages/ConversationList";
import ConversationRowCard from "@/components/messages/ConversationRow";
import ConversationThread from "@/components/messages/ConversationThread";
import MessagesScreen from "@/components/messages/MessagesScreen";
import ReplyComposer, {
  REPLY_MAX_LENGTH,
  REPLY_MIN_LENGTH,
} from "@/components/messages/ReplyComposer";
import ThreadScreen from "@/components/messages/ThreadScreen";
import {
  CONVERSATION_FILTERS,
  FILTER_MESSAGE_KEYS,
  conversationListQuery,
  fetchBrokerDashboard,
  fetchConversation,
  fetchConversations,
  fetchThread,
  markConversationRead,
  messageErrorKey,
  postReply,
  resolveFilter,
  setConversationStatus,
  type BrokerDashboard,
  type ConversationContextRef,
  type ConversationFilter,
  type ConversationRow,
  type MessageRow,
} from "@/lib/api/conversations";
import {
  CONVERSATION_MESSAGES,
  formatConversationMessage,
  tConversations,
} from "@/lib/i18n/conversations";
```

**Exact signatures a later phase calls:**

```python
set_conversation_status(*, actor, conversation, new_status: str) -> Conversation
    # new_status ∈ ARCHIVABLE_STATUSES ("OPEN", "ARCHIVED")
    # RECIPIENT SIDE ONLY: raises ConversationFilingForbidden (403) when
    #   actor.pk == conversation.initiator_id (ruling 5)
    # also raises InvalidConversationStatus (400) | ConversationClosed (409)
    #      | ConversationSuperseded (409)

broker_dashboard_metrics(broker, *, viewer) -> dict
    # {"broker": {...}, "published_listings": int, "pending_approvals": int,
    #  "messages": broker_message_metrics(...)}

broker_message_metrics(broker, *, viewer) -> dict
    # {"enabled": bool, "can_read": bool, "unread_conversations": int | None,
    #  "unread_messages": int | None, "new_inquiries_7d": int | None}
```

**Endpoints shipped by this phase**, against spec §30.1's literal inventory:

| Endpoint | §30.1 | Route name | Permission |
|---|---|---|---|
| `GET /api/v1/conversations/<id>/` | **addition** | `conversation-detail` | `UnifiedInquiriesEnabled` → `IsAuthenticated` → `IsActiveUser` → `can_view_conversation` (404) |
| `PATCH /api/v1/conversations/<id>/status/` | **addition** | `conversation-status` | the same four, **plus** recipient-side-only inside the service (403 `conversation_filing_forbidden`) |
| `GET /api/v1/brokers/<id>/dashboard/` | **addition** | `broker-dashboard` | `IsAuthenticated` → `IsActiveUser` → `IsBrokerMember` |

All three are flagged as additions rather than presented as spec-literal, exactly as Phase 6 flagged its four and Phase 12 its two. §30.1's closing sentence grants the latitude; §28's own text is what requires them (an Archived filter with no producer, dashboard metrics with no backend source, and a thread screen that cannot read its own conversation past row 20, are all things §2.1 forbids).

**Error codes added to the messaging vocabulary by this phase:** `invalid_conversation_status` (400), `conversation_filing_forbidden` (403), `conversation_superseded` (409), and `not_broker_member` (403, from `brokers.permissions.IsBrokerMember`). Each is an `APIException` subclass with a `default_code`, per Phase 6 contract rule 10, and each has a `messages.error.<code>` key in all three languages.

**Rules a later phase must follow:**

1. **Still no second message store.** Spec §28's sentence outlives this phase. `Conversation` and `Message` are the only tables; `messaging.services` is the only writer (Phase 6 contract rule 9, extended to `set_conversation_status`). A per-participant archive flag or a `MessageRead` join table is a *schema* decision that belongs to whoever amends spec §11.8, not to a screen.
2. **`components/messages/` is role-neutral and must stay that way.** Nothing in that directory imports a broker concept; scoping is the `brokerId` prop and `basePath`. That is the whole mechanism behind spec §28's "share components/services where practical", and it is what lets Phase 16 mount the same inbox in a private-seller shell by passing a different `basePath`.
3. **`BROKER_NAV_LINKS` is pinned by a test that asserts the exact array.** A phase adding `/fleet/`, `/leads/`, `/team/`, `/profile/` or `/subscription/` adds its entry **and** updates that assertion in the same commit, and only once the page exists (spec §39 and §2.1 — **not** `PrimaryNav`, which links to six pages that do not exist; see ruling 3's correction and Known Limitation 16). Never re-add a `Services & Surveyors` entry — spec §28 removes it by name. Every entry carries a `messageKey`, never a literal label (spec §37).
4. **`NAVIGABLE_URL_PREFIXES` is Phase 20's to delete.** When `/boats/` and `/brokers/` exist, add those prefixes (or drop the allowlist entirely) and the thread's context link starts working for those contexts. The backend already returns the canonical URLs; nothing server-side needs to change except giving `BoatListing` a slug.
5. **`context.url` is canonical, not navigable.** A serializer returning a URL is stating the product's canonical path (spec §4.1), not promising a built page. Any new context kind adds a `url` key to `ConversationSerializer.get_context()` — never a second field, and never a client-side slug assembly.
6. **New UI strings go in `CONVERSATION_MESSAGES` with all three languages.** The dictionary test fails on any key missing a locale (spec §37). `Locale` is still declared once, in `frontend/src/lib/api/directory.ts` — import it.
7. **Never render `error.message`.** Map `error.code` through `messageErrorKey()` and a dictionary key. The backend's strings are English-only and developer-facing.
8. **`IsBrokerMember` gates membership, not capability.** Per-capability narrowing happens inside the payload (`messages.can_read`), so an AGENT can still load their own dashboard. A new broker-facing endpoint that needs `can_read_messages` uses `messaging.selectors` for the data and `IsBrokerMember` for the door — do **not** widen `IsBrokerMember` itself.
9. **Phase 18's `Notification.target_url` now resolves, and `SENDER_CONVERSATION_URL_TEMPLATE` is settled.** `/dashboard/messages/<id>/` is a real page. The constant is **not** a placeholder awaiting "the phase that builds the page" — ruling 2 shows spec §15.5's sender URL and spec §28's broker URL are two seats on one conversation, so they are two routes, and Task 1 Step 6 rewrites the comment that said otherwise. Do not change its value. If a role-specific destination is ever wanted, redirect in the frontend from the neutral path rather than forking the constant, because it is written into rows already in the database.
10. **Any new messaging error code is an `APIException` subclass with a `default_code`** (Phase 6 contract rule 10, restated because this phase added two). A `ValidationError` collapses to `validation_error`.
11. **Views declare `throttle_scope` only.** This phase owns `conversation_status` (120/hour) and `broker_dashboard` (120/min), both in `DEFAULT_THROTTLE_RATES`.
12. **Query-count tests compare, never budget.** Both N+1 tests in `test_phase_19_acceptance.py` assert `len(large) == len(small)` after a discarded warm-up request. Copy that shape; an absolute budget cannot fail on an N+1.
13. **Only the recipient side may file a conversation.** `set_conversation_status` refuses the initiator with `conversation_filing_forbidden`, and `ConversationSerializer.viewer_is_initiator` is how a client knows whether to render the control. A phase that adds a per-participant archive flag (which needs an amendment to spec §11.8) should remove both together, not just the client half.
14. **Use `fetchConversation(id)`, never a scan of the inbox, to load one conversation.** The list is paginated at 20; scanning it is correct only until somebody has 21 conversations. `GET /api/v1/conversations/<id>/` exists for this.
15. **`RequirePermission`'s `permission` prop is optional.** With it omitted the component is a sign-in guard. Do not "fix" that by inventing a `PermissionKey` for a membership capability — `PermissionKey` is spec §5's table, and §5 has no row for reading conversations.

---

## Self-Review

**1. Spec coverage — §28, line by line.**

| Spec §28 requirement | Where implemented |
|---|---|
| Remove — navigation item `Services & Surveyors` | Ruling 1 (nothing exists to remove; verified by `rg`), Task 8's pinned `BROKER_NAV_LINKS` assertion, Task 10 Step 1's recorded sweep |
| Remove — the corresponding cards, data calls, routes and permissions | Same. No such card, call, route or permission exists in `frontend/src` or `backend`; Task 10 Step 1 is the evidence |
| Remove — any empty service/survey metrics on broker home | Task 9's `BrokerMetrics` renders exactly four tiles, and `test_shows_no_service_or_surveyor_widget` asserts the rendered text contains neither word |
| Add — navigation item `Messages` at `/dashboard/broker/messages/` | Task 8 (`BROKER_NAV_LINKS`, the broker layout), Task 3 (`broker.messages`, spec §37's literal key) |
| Add — conversation list and thread layout consistent with private-seller messages | Task 7 mounts the identical `MessagesScreen`/`ThreadScreen` at `/dashboard/messages/…`; Task 8 mounts them at `/dashboard/broker/messages/…`. "Consistent" is enforced by their being the same files |
| Add — filters: All, Unread, Listing inquiries, Profile inquiries, Archived | Task 4 (`CONVERSATION_FILTERS` + `conversationListQuery`, one test per filter incl. the repeated `type` parameter), Task 5 (`ConversationFilters`), Task 1 (the Archived producer) |
| Add — row: sender display name, context/listing, last message excerpt, timestamp, unread count | Task 5 `ConversationRowCard`, `test_shows_every_field_spec_28_s_row_names` |
| Add — thread: messages, context sidebar, listing/profile link, reply composer | Task 6 (`ConversationThread`, `ConversationContextPanel`, `ReplyComposer`); the link is ruled (ruling 9) and its two gaps are Known Limitations 4 and 5. The thread reads its conversation through Task 1's detail endpoint (ruling 14), not by scanning a 20-row page |
| Add — broker team access according to `can_read_messages` | Phase 6's `conversations_visible_to`/`can_view_conversation` (reused, never re-implemented); Task 1's `test_an_agent_without_can_read_messages_gets_404`; Task 2's `test_a_member_without_can_read_messages_sees_no_counts` |
| Backend — use the shared `Conversation`/`Message` model; no second store | Global Constraints; Task 11's `test_this_phase_added_no_second_message_store`; no migration in the whole plan (Task 11 Step 3's `makemigrations --check`) |
| Backend — mark-read and reply endpoints enforce broker organization membership | Phase 6's `ConversationScopedView`; Task 11's cross-broker sweep exercises the detail route, `messages`, `read/` and `status/` from another brokerage's seat and asserts nothing was written |
| Dashboard metrics — published listings, pending approvals, unread messages, new inquiries | Task 2 (`broker_dashboard_metrics`), Task 9 (`BrokerMetrics`), Task 11's Scenario L test recomputing each number from rows |
| Dashboard metrics — only backend-derived; remove surveyor/service widgets | Task 9's `test_shows_exactly_spec_28_s_four_metrics_and_nothing_else` (asserts the `<dt>` list exactly) and `test_never_renders_a_hard_coded_zero_in_place_of_an_unknown_count` |
| DoD — no visible or API navigation remains for broker Services & Surveyors | Ruling 1 + Task 10 Step 1's sweep + Task 8's pinned nav set |
| DoD — legacy route redirects **once** to Messages | Task 10 (`next.config.ts`, the count and destination assertions, the existing no-chain test, and a real `curl -L` against a running server) |
| DoD — broker and private-seller messages share components/services where practical | Tasks 5–8: one component directory, two mounts, differing only by `basePath` and an optional `brokerId`. Contract rule 2 binds later phases |
| DoD — team permissions and unread counts are correct | Task 1, Task 2 and Task 11's cross-broker sweep; Task 11's "reading a thread moves the dashboard count" walks the whole loop |

**2. Spec coverage — the sections §28 references.**

- **§3** — no new app; `messaging` and `brokers` are both on §3's suggested list. No business rule lives in a view: the archive rule is in `messaging.services`, the metrics in `brokers.dashboard`.
- **§4.2** — the broker row's `/dashboard/broker/` and `/messages/` are built; `/fleet/`, `/leads/`, `/team/`, `/profile/` and `/subscription/` are ruled out with reasons and assigned to Phases 16, 17 and 20 (ruling 3). The private-seller row is Known Limitation 10. §4.2's own sentence about `/dashboard/broker/services/` is Task 10.
- **§4.3 row 5** — Task 10, with the no-chain requirement proved against a running server.
- **§5** — "Browse public content" is untouched; no capability is added, because a broker dashboard is not a §5 capability (Task 8's `requiresBrokerMembership`, with a test that a member holding *zero* permissions still sees the link). Staff get no conversation capability, matching §5's table (ruling 10).
- **§11.1** — `can_read_messages` is read, never written. `BrokerMembership` is unchanged.
- **§11.8** — `Conversation.status` is the only column this phase writes; `Message` is untouched except by Phase 6's own `mark_conversation_read`. The one-`status`/one-`read_at` constraints are what rulings 5 and 6 are about.
- **§15 (Phase 6)** — reused wholesale. §15.1's 20–4000 message rule is mirrored client-side in `ReplyComposer` and enforced server-side by Phase 6's `MessageCreateSerializer` (§2.2: the client mirrors, the server decides).
- **§21 (Phase 12)** — `broker_listing_counts` and `pending_revision_count` are consumed read-only; contract rule 10's "live aggregate, never denormalised" is honoured and re-proved by Task 11's fixed-query-count test.
- **§26** — "All visible counters equal query results": Task 11 recomputes every dashboard number from the rows.
- **§30.1/§30.2** — two additions, both listed in the Contract summary's table with their permissions; both mutations return the updated resource; timestamps are ISO-8601; the inbox keeps Phase 6's one pagination shape; errors carry stable machine codes.
- **§30.3** — ruled not applicable (ruling 12): archiving is idempotent by construction and the dashboard is a read.
- **§30.4** — two new scopes, both via `throttle_scope`, both on `HashedIPScopedRateThrottle` so no raw IP reaches the cache.
- **§33.1** — every conversation route answers 404 for an unauthorised id; the dashboard answers 403 before any lookup so ids cannot be enumerated. Task 11 sweeps all five routes from another brokerage's seat and asserts nothing was written.
- **§33.2** — no contact value appears in any payload or any DOM this phase renders; there are four separate assertions to that effect (Tasks 1, 2, 5, 6).
- **§33.3** — two equal-query-count tests with a warm-up request (Task 11).
- **§34.1–§34.3** — unit (dictionary, query builder), API (Tasks 1, 2), integration (Task 11). §34.5's browser tier is Known Limitation 14, assigned to Phase 23.
- **§35.1/§35.2** — no new flag; `unified_inquiries` gates the messaging surfaces and is seeded **disabled**; ruling 8 explains why the dashboard endpoint is not gated and what it reports when the flag is off, with a test for that exact state.
- **§36.6** — blocking is deliberately not built and deliberately unreachable from the status endpoint (ruling 4, Known Limitation 7), with a test that `BLOCKED` is refused by name. The section's abuse concern is also what ruling 5 answers: a sender cannot file a broker's live lead out of sight, and Task 11 proves it end to end.
- **§37** — one dictionary, EN/IT/ES, with a coverage test; the literal key `broker.messages` has its own assertion; the EN-fallback branch is exercised against an injected entry rather than against a key the dictionary guarantees is populated.
- **§39** — no control leads to a page that does not exist **on the surfaces this phase authors**: ruling 3 (nav), ruling 9 (context link). `PrimaryNav`'s six pre-existing dead links are out of scope and recorded as Known Limitation 16 rather than claimed as a precedent, which an earlier draft wrongly did.
- **§40 Scenario L** — Task 11's first two tests plus `BrokerDashboardNav.test.tsx` plus `next.config.test.ts` plus Task 10's `curl`.
- **§2.2 (server authority)** — every rule this phase adds is enforced server-side and only *mirrored* in the UI: filing rights live in `set_conversation_status` (not in the hidden button), reply length lives in Phase 6's `MessageCreateSerializer` (the composer's check is usability), and the route guard is a sign-in redirect rather than a client-side capability check, because no `PermissionKey` expresses `can_read_messages` (ruling 13).

**3. Placeholder scan.** No "TBD", "TODO", "implement later", "add appropriate error handling", "handle edge cases", "write tests for the above" or "similar to Task N" appears anywhere. Every code step carries the actual code; every test step carries the actual test. **One** step is a decision procedure rather than a deferral, and it names the command that decides and requires the outcome in the commit message: Task 3 Step 0 (`inquiry.sender_unnamed` exists in `INQUIRY_MESSAGES` or it does not — `rg` decides, and the losing branch is deleted). An earlier draft carried a second such step, Task 8's "let `pnpm build` decide where `resolveFilter` lives"; that was a real deferral dressed as a procedure, and it is now settled — `resolveFilter` is exported from `lib/api/conversations.ts`, with the reason (a `"use client"` module cannot import a server page module, which also exports `generateMetadata` and `dynamic`) written at both the definition and the import.

**4. Type consistency.** `ConversationRow`, `MessageRow`, `ConversationContextRef` and `BrokerDashboard` are declared once, in `lib/api/conversations.ts`, and every component's props reference them by those names. `ConversationRow.viewer_is_initiator` is produced by `ConversationSerializer.get_viewer_is_initiator` and consumed by exactly one expression, `ConversationThread`'s `canFile`; the five embedded TypeScript fixtures all carry it. `ConversationContextRef.url` is produced by `get_context()` for all four context kinds and consumed only through `NAVIGABLE_URL_PREFIXES`. `ConversationFilter`'s five members are the same five in `CONVERSATION_FILTERS`, `FILTER_MESSAGE_KEYS`, `resolveFilter` and `conversationListQuery`'s `switch`, and the switch is exhaustive over the union. `basePath` and `brokerId` keep those names from `MessagesScreen` through `ThreadScreen` to both route pairs. `set_conversation_status`'s parameter is `new_status` (never `status`, which would shadow `rest_framework.status` at any future import) and the HTTP field is `status`; `ConversationStatusView` is the single place the two meet. `_annotated_row` is defined once and used by both new views, so the detail and status payloads cannot drift. `NEW_INQUIRY_WINDOW_DAYS` is defined once and the wire field `new_inquiries_7d` names it; both appear in Task 11's boundary test. `primaryBrokerMembership` is exported from `BrokerDashboardNav.tsx` and imported by both broker pages — one implementation, not two. `messageErrorKey`'s `KNOWN_ERROR_CODES` holds **ten** wire codes and `CONVERSATION_MESSAGES` holds **eleven** `messages.error.*` keys — the ten, plus `unexpected_error`, which is the fallback `messageErrorKey` returns for anything it does not recognise and therefore never appears in the set. Task 3's test enumerates all eleven.

**5. Right-sizing.** Eleven tasks, unchanged in number by this revision: ruling 14's detail endpoint went into Task 1 rather than becoming a twelfth, because it edits the same four files and the same `get_context()` method as the other two deliverables there — splitting would have meant rebasing one task onto another for no review benefit, and Task 1 says so in as many words. Each task ends with an independently testable deliverable and a commit, and each could be rejected by a reviewer without rejecting its neighbour: Task 1 is the messaging read/write extension, Task 2 is an endpoint, Tasks 3–4 are pure modules with unit tests, Tasks 5–6 are component groups that render without a network, Task 7 is the first thing a person can actually use, Task 8 is the broker chrome spec §28 names, Task 9 is broker home, Task 10 is one redirect, Task 11 is evidence. Setup is folded in rather than split out: Task 1 carries its own reconciliation gate, Task 2 carries its own cache conftest, Task 7 carries the one-prop `RequirePermission` change its routes need, Task 8 carries the `PrimaryNav` edit its nav entry needs.

**6. Counts.** Every "Expected: PASS — N" line in this plan was re-derived programmatically from the embedded test bodies after this revision (counting `^def test_` in each Python block and `^\s*it\(` in each TypeScript block), not carried forward by hand. Backend: 13 + 18 (Task 1), 13 (Task 2), 9 (Task 11) = **53 new backend tests**. Frontend: 10 (Task 3) + 23 (Task 4) + 14 (Task 5) + 18 (Task 6) + 14 screens + 6 routes + 2 auth (Task 7) + 21 (Task 8) + 12 (Task 9) + 1 net new in `next.config.test.ts` = **121 new frontend tests**, plus the 4 existing `RequirePermission` tests and 4 existing `PrimaryNav` tests that must stay green unedited.





