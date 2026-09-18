# NAUTA Phase 7 — Contact Privacy, Blur and Reveal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make broker and professional business contact details a **server-side authorization outcome**: a `ContactAccessService` that returns either a masked, non-revealing `LOCKED` payload or the real values to a viewer who holds an active `(viewer, entity)` grant, exposed at `GET /api/v1/contacts/<target-type>/<id>/`, audited on first reveal, revocable by staff, and rendered by one `ContactPanel` client component whose locked state never receives a raw contact value at all.

**Architecture:** Phase 7 adds **no new model of its own** and **no new Django app**. Spec §11.8 groups `Conversation`, `Message` and `ContactAccessGrant` under a single heading, and Phase 6 creates all three in the `messaging` app (it must: spec §15.3 step 4 makes grant creation part of the inquiry transaction). Phase 7 therefore ships four new modules *beside* that model — `masking.py`, `contact_access.py`, `contact_payloads.py`, `contact_views.py` — plus one additive column (`ContactAccessGrant.first_revealed_at`) and two URL entries. The design's single most important property is that the raw email and phone are **structurally unreachable** on the locked path: `resolve_contact_access()` returns one of three *distinct frozen dataclasses*, and only `GrantedContact` has `email`/`phone` attributes at all. A serializer bug cannot leak what the object does not carry. The frontend mirrors that: `ContactPanel` is a **client** component, so the server-rendered HTML for a professional page contains no contact data of any kind — masked or raw — and the TypeScript payload type is a discriminated union whose `LOCKED` member has no `email` property to read.

**Tech Stack:** Python 3.13 + `uv`, Django 5.2 LTS, Django REST Framework, PostgreSQL 16, Redis (cache + DRF throttle counters); **Next.js 16.3.5** (App Router, TypeScript), **Tailwind CSS v4**, `pnpm`, Vitest + Testing Library. No new third-party dependencies in either project.

**Spec:** [`NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md`](../../../NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md) — primarily §16 (Phase 7), and every section it leans on: §1 (the fixed "Contact reveal" product decision), §2.1/§2.4 (backend source for every visible state; contact reveals are audited), §5 (the "Reveal recipient contact after inquiry" permission row), §11.8 (`ContactAccessGrant`), §14.2 (the professional detail template's contact panel), §15 (Phase 6, which creates the grant), §29.2/§29.3/§29.6 (broker/professional profile contact card, "contact lock explanation remains readable without relying on hover"), §30.1/§30.2/§30.4 (endpoint inventory, error envelope, rate limits), §31 (the `Blurred phone/email` traceability row), §33.2/§33.5 (privacy, log prohibitions), §34.3/§34.5/§34.7 (locked-response and DOM acceptance tests), §35.1 (`contact_unlock` flag), §36.6 (contact access and abuse), §37 (`contact.locked_explanation`, `contact.unlocked`), §39 (execution protocol), §40 Scenarios A and B.

**Predecessor plans (read before starting):**
- **Phase 6 — [`2026-09-18-phase-6-inquiry-messaging.md`](./2026-09-18-phase-6-inquiry-messaging.md). Hard dependency, plan merged to `dev` (PR #116).** Phase 7 must not begin until Phase 6's **code** is merged. Its "Contract summary for later phases" is binding and every row of the **"Phase 6 reconciliation"** table below has been checked against its final text — including contract rules 11 (`MessagingAPIView`), **11a** (the flag gate goes first), 14 (`UnifiedInquiriesEnabled` on every messaging endpoint) and 15 (throttle scopes). Re-check that table against the merged **code** before Task 1, not during Task 5.
- [`2026-09-18-phase-5-directory-consolidation.md`](./2026-09-18-phase-5-directory-consolidation.md) — **structural template for this document**, and the owner of the two files this phase touches on the frontend. Its contract rules **1** (never add `public_email`/`public_phone`/`website_url` to a directory serializer), **3** (the `PHASE 7 SEAM`: "Blur is a server-side authorization outcome, never a CSS filter over a delivered value"), **4** (permission/throttle declaration shape), **9** (new UI strings in a dictionary with all three languages) and **12** (`Locale` is declared once) are all binding here.
- [`2026-09-17-phase-3-identity-organizations-permissions.md`](./2026-09-17-phase-3-identity-organizations-permissions.md) — `User`, `IsActiveUser`/`IsStaffModerator`, `HashedIPScopedRateThrottle`, the `common.exceptions` error envelope, `lib/api/client.ts` and `SessionProvider`.
- [`2026-09-17-phase-2-shared-types-platform-settings.md`](./2026-09-17-phase-2-shared-types-platform-settings.md) — `platform_settings.services.is_feature_enabled()`, `audit.services.record_audit_event()`, `common.models.UUIDTimeStampedModel`.
- [`2026-09-18-phase-11-listing-workflow.md`](./2026-09-18-phase-11-listing-workflow.md) — read its rule **9** ("Phase 9 extends `PublicListingSerializer`… do not create a second public listing representation") before assuming a listing page can resolve a broker id. It cannot today; see Known Limitation 3.

**Phase dependencies:** spec §7 and `docs/superpowers/PHASE-TRACKER.md` — Phase 7 depends on Phase 6 **only**. Phases 9, 10, 12 and 13 are `ready`/in flight concurrently and touch `backend/listings/`, `backend/platform_settings/` and `backend/common/throttling.py`; this plan touches **none of those three** (see the collision notice). Phase 19 (broker dashboard) and Phase 20 (public card/profile integration) consume this phase's contract; Phase 20 is where the broker profile page and the listing-page contact panel actually get mounted.

## Execution Model

Per the standing project convention recorded in `ACTIVITY.md`: each task is implemented on its **own branch off the current tip of `dev`** (`git checkout -b phase7-task-N-<slug> dev`) in **its own worktree** (`git worktree add ../nautelo-worktree-phase7-tN phase7-task-N-<slug>`), run through `subagent-driven-development`'s implementer → task-reviewer → fix-loop cycle, opened as a PR (`gh pr create`), and merged by the controller only when CI is green and the branch is cleanly mergeable. Tasks run **strictly sequentially** — never two branches in flight at once — and each new task branches from the just-merged `dev` tip.

**CI gates (every task, every PR):** the `.github/workflows/ci.yml` `backend` job (`uv sync`, MinIO via root `docker-compose.yml`, `uv run python manage.py migrate`, `uv run pytest`) and the `frontend` job must both be green. A task that touches only the backend still runs the frontend job and vice versa; a red job on a file the task did not touch is a real regression, not noise. Locally, a task is not finished until:

```bash
cd backend && uv run pytest -q
cd frontend && pnpm test && pnpm lint && pnpm build
```

both pass. **Tests run against PostgreSQL and Redis via the root `docker-compose.yml` (Postgres `127.0.0.1:5433`, Redis `127.0.0.1:6380`), never SQLite or `LocMemCache`.**

---

## Global Constraints

Exact values copied from the spec. Every task's requirements implicitly include this section.

- **The product rule, verbatim (spec §1):** *"Broker/professional contact details are blurred until the current user has successfully sent a valid platform inquiry to that entity. Reveal is scoped to that user and entity, is audited, and never makes contact data public."*
- **Grant scope (spec §16):** the grant is scoped to `(viewer, broker)` or `(viewer, professional)` and **applies across that entity's profile and all of its listings**. It is never scoped to a listing, a conversation or a session. **Contact access is not transferable between accounts** (spec §36.6).
- **Locked payload shape, copied verbatim from spec §16:**
  ```json
  {"contact": {"state": "LOCKED",
               "email_mask": "i••••@example.com",
               "phone_mask": "+34 ••• ••• ••7",
               "unlock_rule": "SEND_INQUIRY"}}
  ```
- **Granted payload shape, copied verbatim from spec §16** (plus `website_url`, ruling below):
  ```json
  {"contact": {"state": "GRANTED",
               "email": "info@example.com",
               "phone": "+34900111222",
               "granted_at": "..."}}
  ```
- **State vocabulary (closed set):** `LOCKED`, `GRANTED`, `UNAVAILABLE`. The first two are spec-literal; `UNAVAILABLE` is this plan's name for spec §16's "suspended entity contact becomes unavailable" (ruling below). `unlock_rule` has exactly one value, `SEND_INQUIRY`, spec-literal.
- **Target type vocabulary (closed set), spec §11.8 verbatim:** `BROKER`, `PROFESSIONAL`. These strings are persisted on `ContactAccessGrant.target_type` and must never be renamed. The URL path segments are their lowercase forms, `broker` and `professional`.
- **The mask character is `•` (U+2022 BULLET)**, taken from spec §16's own example strings. It is never `*`, `.` or a CSS effect.
- **Masks never reveal length.** Both masks are **fixed width**: the email mask is one leading character plus bullets to a total of five, and the phone mask is always `+CC` followed by nine mask positions in three groups, of which only the final one may carry a real digit. A mask whose width varied with the secret would leak the secret's length to anyone comparing two profiles. Both widths are derived from spec §16's two example strings and are pinned by tests in Task 1.
- **Never place an unblurred value in HTML, page source, CSS pseudo-content, `aria-label`, an analytics payload or preloaded JSON (spec §16).** On this stack that means: the contact panel is a **client** component, it fetches from the contact endpoint after mount, and no server component, `generateMetadata`, sitemap entry or RSC payload ever reads a contact field.
- **Accessibility (spec §16, §29.6):** screen readers hear the **masked** value and the unlock explanation, never the secret value, and the lock explanation is readable without relying on hover.
- **Never log a private contact value (spec §33.5).** Structured logs carry request ID, event name and safe object IDs only. This applies to audit `before`/`after`/`metadata` payloads too — an `AuditEvent` is a stored log.
- **Every reveal and every revocation writes an immutable audit event** (spec §2.4) via `audit.services.record_audit_event()`, called from inside the same `transaction.atomic()` block as the change.
- **Feature flag for this phase:** `contact_unlock` (spec §35.1), seeded **disabled**, matching the `listing_revisions` precedent and spec §35.2 step 4. **The flag gates revealing, never locking:** with the flag off the endpoint still answers, and it answers `LOCKED` — fail-closed on privacy (ruling below).
- **Neither view has any feature-flag gate in `permission_classes`** — not `UnifiedInquiriesEnabled` (a deliberate, tested exception to Phase 6's contract rule 14, so the locked panel keeps rendering and staff revocation keeps working while inquiries are paused) and not a `contact_unlock` gate either, because that flag only ever *closes the reveal*: with it off the endpoint still answers, with `LOCKED`. Phase 6's contract rule 11a ("the flag gate goes first") is therefore satisfied by having no gate to order, which is a decision recorded in both view docstrings and guarded by two tests (ruling below).
- **Both views extend `messaging.views.MessagingAPIView`, never DRF's `APIView`** (Phase 6 contract rule 11). That base class turns DRF's anonymous `not_authenticated` into spec §15.5's `authentication_required` (401) and DRF's `throttled` into `rate_limited` (429, with `meta.retry_after_seconds`). A messaging view extending `APIView` answers in a vocabulary spec §15.5 does not define.
- **Error codes added by this phase (closed set):** `invalid_grant_state` (409, staff revoking an already-revoked grant). Everything else reuses existing codes: `not_found` (404, unknown/never-public target), `staff_moderator_required` (403, Phase 3's `IsStaffModerator`), `validation_error` (400, missing revoke reason), and — from `MessagingAPIView` — `authentication_required` (401) and `rate_limited` (429). No other new codes.
- **Every response from the reveal endpoint carries `Cache-Control: private, no-store, max-age=0` and a `Vary` containing `Authorization` and `Cookie`** (corsheaders appends `origin` to that header on every response, so tests compare `Vary` as a set, never for string equality) — on all three 200 states and on the 401/404/409/429 error paths alike. The same URL returns `LOCKED` to one viewer and `GRANTED` to another, discriminated only by the `Authorization` header, and `frontend/src/lib/api/client.ts` sends `credentials: "include"`; nothing in `backend/` sets a cache header today and no cache middleware is installed, so an intermediary or the browser's own HTTP cache is free to hand one viewer's granted payload to the next. The browser fetch sets `cache: "no-store"` for the same reason. This is a hard requirement of spec §16's "never makes contact data public", not an optimization.
- **Error envelope:** spec §30.2, produced by `common.exceptions.nauta_exception_handler`, with `X-Request-ID` echoed. Error bodies are subject to the same leak rule as success bodies — a 404, a 409 or a 429 must contain no contact value and no entity name.
- **Times are ISO 8601 UTC** (spec §30.2), serialized as `.isoformat().replace("+00:00", "Z")`, matching `platform_settings.services.get_public_settings()`.
- **Rate limiting uses `common.throttling.HashedIPScopedRateThrottle`**, already installed as `DEFAULT_THROTTLE_CLASSES`. Views declare **only** `throttle_scope`, never `throttle_classes` (Phase 3 contract rule 9). Two scopes are appended by this plan: `contact_access` = **`120/min`** and `contact_grant_admin` = **`30/min`**. `backend/common/throttling.py` itself is **not modified** (Phase 10 owns it this wave).
- **Every new UI string has EN/IT/ES (spec §37)**, in a dictionary module, never a literal inside a component. Spec §37 names two keys this phase must use exactly: `contact.locked_explanation` and `contact.unlocked`.
- **The locked explanation copy is spec-literal (§16):** *"Send a message through NAUTA to unlock business contact details."*
- All primary keys are UUIDs; all timestamps are timezone-aware UTC. User references use `settings.AUTH_USER_MODEL` in model fields and `django.contrib.auth.get_user_model()` in code/tests.
- **No business rule lives only in a view** (spec §3). Every rule here is a service function called by the view and the tests alike.
- No partial or visual-only implementations, no faked data, no TODO placeholders for backend enforcement (spec §39).
- TDD per task: write the failing test, run it and see it fail, write the minimal implementation, run it and see it pass, commit.
- **Where a task says "append to" an existing module, its code block repeats the imports that block needs.** Consolidate them into the module's single import section at the top rather than leaving mid-file `import` statements.
- **Every settings and urls edit in this plan is additive.** `backend/config/settings/base.py` already carries merged entries from Phases 0/1, 2, 3, 4, 5, 8 and 11. Read the real file, add to it, never paste over it.

---

## Cross-phase collision notice (read this first)

Phases 9, 10, 12 and 13 are in flight concurrently. This plan's footprint is stated exactly so a reviewer can verify the disjointness rather than trust it.

| File | This plan's change | Task | Collision risk |
|---|---|---|---|
| `backend/messaging/masking.py`, `contact_access.py`, `contact_payloads.py`, `contact_views.py` | **New files.** | 1–6 | None. Phase 6 created the app; no other in-flight phase touches it. |
| `backend/messaging/urls.py` | **Appends two `path()` entries** to the existing `urlpatterns`. Nothing existing is renamed or reordered. | 5, 6 | Low — Phase 6 owns the file but is merged before this phase starts. |
| `backend/messaging/models.py` | **Appends one nullable field**, `ContactAccessGrant.first_revealed_at`. No constraint, index, `Meta` or method change. | 4 | Low, same reason. |
| `backend/messaging/migrations/` | Two **new** migrations: `0004_seed_contact_unlock_flag` and `0005_contactaccessgrant_first_revealed_at`, after Phase 6's `0003_message_contactaccessgrant`. Confirm the numbering with `ls backend/messaging/migrations/` before writing the `dependencies` tuple. | 2, 4 | Low. |
| `backend/messaging/tests/contact_*.py` | **New test modules and a new factory module** (`contact_factories.py`), deliberately *not* appended to Phase 6's `factories.py`. | 1–7, 12 | None. |
| `backend/messaging/enums.py` | **Appends one constant**, `CONTACT_UNLOCK_FLAG`, beside Phase 6's `UNIFIED_INQUIRIES_FLAG`. | 2 | Low — one line in a Phase 6 file that is merged before this phase starts. |
| `backend/messaging/tests/conftest.py` | **Two additions**: `CONTACT_UNLOCK_FLAG` in `MESSAGING_FEATURE_FLAG_KEYS` (scoped cache-key deletion), and a `contact_unlock` row in `_messaging_reference_rows` (survives a `transaction=True` flush). Nothing existing is changed. | 2 | Low — additive, in a Phase 6 file merged before this phase starts. |
| `backend/config/settings/base.py` | **Appends two keys** to `REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]`: `"contact_access": "120/min"` and `"contact_grant_admin": "30/min"`. Nothing else in the file. | 5, 6 | **Shared file.** Phase 6 has already appended four keys there (`inquiry_submit`, `message_send`, `messaging_read`, `inquiry_draft`) plus its two `INSTALLED_APPS` entries (`messaging`, `notifications`) and a `CELERY_TASK_ROUTES` entry; Phase 13 appends `listing_eligibility` and Phase 9 its own. Append-only, one line each — expect a trivial rebase, not a conflict. Never reorder or reformat the existing dict. |
| `backend/notifications/**` | **Untouched.** Phase 6 creates this app (its Task 4, with `notifications/0001_initial`) and it is listed here only so a reviewer knows it is Phase 6's, not an undeclared dependency of this plan. Nothing in Phase 7 imports it. | — | None. |
| `backend/common/throttling.py` | **Untouched.** Phase 10 rewrites its identity function this wave; this plan only *uses* the class via the existing `DEFAULT_THROTTLE_CLASSES`. | — | None by construction. |
| `backend/listings/**`, `backend/platform_settings/**` | **Untouched.** Phases 9/10/12/13 own them. The `contact_unlock` flag row is seeded from a `messaging` migration (the `services_catalog` precedent), so no `platform_settings` file changes. | — | None by construction. |
| `backend/services_catalog/**`, `backend/professionals/**`, `backend/brokers/**` | **Untouched.** Read-only imports of `ProfessionalProfile`, `BrokerOrganization` and their status enums. | — | None. |
| `frontend/src/lib/i18n/contact.ts`, `lib/api/contacts.ts`, `components/contact/ContactPanel.tsx` (+ tests) | **New files.** A sibling dictionary, not an edit to Phase 5's `lib/i18n/directory.ts` (contract rule 9 explicitly permits "or a sibling dictionary"). | 8, 9 | None. |
| `frontend/src/app/services/professionals/[slug]/page.tsx` | **Replaces the `PHASE 7 SEAM` comment block** with the panel mount. Nothing else in the file changes. | 10 | Low, but **not zero**: Phase 6's Task 13 replaces the `PHASE 6 SEAM` in the same file **and** adds an `await fetchInquiryConfig()` call plus an `InquiryForm` mount. Phase 6 merges before this phase starts, so re-read the merged file; the `locale` variable and `professional.id` this task needs are unaffected by that edit. |
| `frontend/src/components/inquiry/InquiryForm.tsx` | **Adds one import and one call** after a successful submit: `requestContactAccessRefresh(...)`. No prop, state or markup change. | 11 | **Phase 6's file.** It is merged before this phase starts, but this is the one place Phase 7 edits Phase 6's frontend code — re-read it first, and if Phase 6 has meanwhile added its own post-success hook, use that instead (reconciliation row 10). |
| `ACTIVITY.md` | One appended log entry. | 12 | Shared append-only file; entries go at the top of the Log section. |

**`docs/superpowers/PHASE-TRACKER.md` is not modified by this plan.** The tracker states it is "updated by the controller at each wave transition".

---

## Phase 6 reconciliation

Phase 6's plan (`docs/superpowers/plans/2026-09-18-phase-6-inquiry-messaging.md`) was written concurrently with this one. Its plan is now **merged to `dev` (PR #116)** and every row below has been checked against that final text, through its fix round 2 (commit `58d8581`: the flag gate first, the query-count warm-up, the scoped cache clear). Re-check them once more against the **merged code** before Task 1 — a plan is not a codebase — and where a name differs, fix it here in one commit and note the change in this table rather than adapting task by task.

| # | Phase 6 interface | Status | Where this plan uses it | If it differs |
|---|---|---|---|---|
| 1 | The app is **`messaging`**; `backend/messaging/{enums,models,urls,views,selectors,permissions,tests/factories,tests/conftest}.py` all exist. Phase 6 also creates a **second** app, `notifications`. | **Verified** (Phase 6 File Structure). | Every backend path in this plan. Nothing here imports `notifications`. | Rename the four new modules' package path and the two migrations' app label. |
| 2 | `messaging.models.ContactAccessGrant` — `id`, `viewer`, `target_type`, `broker`, `professional`, `source_conversation` (**non-nullable, `on_delete=PROTECT`**), `granted_at` (`DateTimeField(default=timezone.now)`), `revoked_at`, `created_at`, `updated_at`; `Meta.ordering = ("-granted_at",)`; **two partial unique indexes** conditioned on `revoked_at IS NULL` (one per target kind). | **Verified** (Phase 6 Task 3 + contract rule 3). | Tasks 2, 4, 6, 7, 12. `updated_at` exists, so Task 6's `update_fields=["revoked_at", "updated_at"]` is correct; the partial indexes are why revoking is what makes a re-grant possible, and why Task 6 must never hard-delete a grant. | Adjust the field names in `revoke_contact_access` and `contact_factories.py`. |
| 3 | `messaging.selectors.active_contact_grant(viewer, *, broker=None, professional=None) -> ContactAccessGrant \| None` — filters `revoked_at__isnull=True`, orders `-granted_at`, returns `None` when both kwargs are `None`. | **Verified** (Phase 6 Task 5 + contract rule 3: "Phase 7 reads grants through `active_contact_grant()`"). | Task 2 calls it rather than re-deriving "active grant". | If the signature differs, adapt the one call site — but keep calling it. Two definitions of "active grant" is the defect this row exists to prevent. |
| 4 | `messaging.enums.ContactTargetType` (`BROKER`/`PROFESSIONAL`), `ConversationType`, `InquiryContextType`, `CURRENT_PRIVACY_POLICY_VERSION = "2026-09"`, `HONEYPOT_FIELD_NAME`; `messaging.tests.factories.{make_conversation, make_grant}`; `messaging.tests.conftest.MESSAGING_FEATURE_FLAG_KEYS`. | **Verified** (Phase 6 Tasks 1, 2, 3). | Task 2's `contact_factories.make_contact_grant` wraps both factories, `contact_access.py` imports `ContactTargetType`, and Task 2 adds `CONTACT_UNLOCK_FLAG` to `messaging/enums.py`, to the conftest's `MESSAGING_FEATURE_FLAG_KEYS` **and** to its `_messaging_reference_rows`. | Fix the one helper and the two conftest additions. |
| 5 | Migrations `0001_conversation`, `0002_seed_unified_inquiries_flag` (seeds `unified_inquiries` **enabled**), `0003_message_contactaccessgrant`. | **Verified.** | This phase's migrations are `0004_seed_contact_unlock_flag` and `0005_contactaccessgrant_first_revealed_at`. | Renumber and fix the `dependencies` tuple. |
| 6 | `messaging/urls.py` exists and is included from `config/urls.py` under `api/v1/` (Phase 6 Task 7). | **Verified.** | Tasks 5 and 6 append two `path()` entries. | If Phase 6 mounted its URLs some other way, create `backend/messaging/contact_urls.py` with the two paths and add **one** `include()` line to `config/urls.py`. |
| 7 | Phase 6 writes a `contact_access.granted` audit event inside the inquiry transaction. | **Verified** (its Global Constraints). | Task 4's `contact_access.revealed` complements it: `granted` records authorization, `revealed` records delivery. | If the creation event is missing in the merged code, report it in this phase's handoff note and raise it with the controller. Do not audit creation from a read endpoint. |
| 8 | **`messaging.views.MessagingAPIView`** — maps DRF's anonymous `not_authenticated` to `authentication_required` (401) and `throttled` to `rate_limited` (429 with `meta.retry_after_seconds`, via `messaging.exceptions.MessagingThrottled`). Phase 6 contract rule 11 requires **every** messaging view to extend it. | **Verified** (Phase 6 Task 7 + contract rule 11). | Tasks 5 and 6 — both Phase 7 views extend it, and their 401/429 assertions use those codes. | If the base class is renamed, both views and four assertions change. Do not fall back to `APIView`. |
| 9 | `POST /api/v1/inquiries/` (`inquiry-create`). `InquirySubmissionSerializer` fields: `context_type`, `context_id`, `full_name`, `email` (**must equal the actor's own address** — `validate_email` raises `email_mismatch` otherwise), `phone`, `subject`, **`message`** (the service parameter is `body`; the wire name is `message`), `privacy_policy_version` (must equal `"2026-09"`), **`privacy_consent` (`BooleanField(required=False, default=False)`; `validate()` raises `ConsentRequired` when falsy)**, `marketing_consent`, and a dynamically declared honeypot named by `HONEYPOT_FIELD_NAME`. Throttle scope `inquiry_submit` = `20/hour`. Permissions require an authenticated, active, **email-verified** caller and the `unified_inquiries` flag. | **Verified** (Phase 6 Task 7). | **Task 12 only.** Tasks 1–11 do not touch the inquiry endpoint. | Adjust the `inquiry_body()` helper's keys. The honeypot is omitted deliberately: it defaults to `""`, and naming it here would duplicate a constant Phase 6 owns. |
| 10 | `ContactAccessOutcome` — `GRANTED` **and `NOT_APPLICABLE`** (Phase 6 contract rule 4: a private-seller listing inquiry grants nothing, because §11.8's `target_type` has no member for a private person). | **Verified** (Phase 6 Task 1 + contract rule 4). | Task 12 asserts `GRANTED` only for broker/professional contexts. Phase 7's own `contact` payload never uses this vocabulary — its third state is `UNAVAILABLE`, which is about the *entity*, not about an inquiry outcome. The two enums are deliberately separate; see the ruling. | — |
| 11b | Phase 6 contract rule **11a** (added in its fix round 2): the feature-flag gate goes **first** in `permission_classes` on every view extending `MessagingAPIView`, so a flag-off endpoint answers `403 feature_disabled` to everyone before any authentication gate speaks. The rule names Phase 7 explicitly. | **Verified** (Phase 6 fix round 2, commit `58d8581`). | **Satisfied by having no flag gate to order** — a decision, documented in both view docstrings and in the ruling, and guarded by `test_the_flag_state_changes_the_answer_but_never_the_status_code` (Task 5) and `test_revocation_still_works_when_the_reveal_flag_is_off` (Task 6). | If a future contact endpoint *is* rollout-gated, its gate goes first, and it copies Phase 6's `test_the_flag_off_answer_precedes_every_other_permission` rather than inventing a new shape. |
| 11a | Phase 6 contract rule 14: "Adding a messaging endpoint means adding `UnifiedInquiriesEnabled` to its `permission_classes`", and the class **raises** `messaging.exceptions.FeatureDisabled` (403 `feature_disabled`) rather than returning `False`. | **Verified** (Phase 6 fix round 1). | **Deliberately not followed** — see the ruling. Neither Phase 7 endpoint takes that permission; Task 5 pins the divergence with a test. | If Phase 6 later makes rule 14 unconditional, raise it with the controller rather than adding the class: doing so would make the locked panel 403 whenever inquiries are paused. |
| 11 | `frontend/src/components/inquiry/InquiryForm.tsx` takes `{ context, config, locale }` and, on a 201, sets `sent = true` — it does **not** navigate, refresh or emit anything. `frontend/src/app/services/professionals/[slug]/page.tsx` gains an `await fetchInquiryConfig()` and the form mount (Phase 6 Task 13). | **Verified** (Phase 6 Tasks 12, 13). | **Task 11 adds the missing call** — this phase's `requestContactAccessRefresh(...)` — because spec §16's "After successful send, refetch contact authorization" has no other home. | If Phase 6's fix rounds add their own post-success hook (an `onSuccess` prop, a `router.refresh()`), use it and delete the event dispatch — but keep Task 11's end-to-end test, retargeted. |

If, at implementation time, Phase 6 turns out **not** to define `ContactAccessGrant`, stop: that is a spec §15.3-step-4 gap in Phase 6, not a Phase 7 task. Escalate to the controller rather than creating the model here, because the grant must be created inside Phase 6's inquiry transaction.

---

## Scope rulings

Where spec §16 is silent or its two examples disagree, the ruling is made here once so no task has to guess.

**Note (ruling — no new app, no new model; Phase 7 is four modules beside Phase 6's).**
Spec §11.8 is one section, "Messaging and contact access", covering `Conversation`, `Message` and `ContactAccessGrant` together. Spec §15.3 step 4 puts grant *creation* inside Phase 6's inquiry transaction, so the model must exist in Phase 6's app. Splitting the read/mask/revoke half into a separate app would put a one-way import (`contact_access` → `messaging`) across an app boundary for no isolation benefit, add a line to the shared `INSTALLED_APPS` during a wave when three other phases are touching shared files, and split a single spec section across two apps on a phase boundary rather than a domain boundary. Phase 13's opposite ruling (a new `entitlements` app) turned on `UserEntitlement` being a *model group* of its own in §11.9 — there is no such group here.

**Note (ruling — the email mask is fixed-width: one leading character plus bullets to five, domain intact).**
Spec §16's example is `info@example.com` → `i••••@example.com`. Read literally, the local part `info` (4 characters) becomes `i` + **4** bullets (5 characters), so the mask is **not** length-preserving — and that is the right behaviour, because a length-preserving mask leaks the local part's length to an attacker enumerating a known address list. This plan makes the rule explicit: **keep the first character of the local part, then emit bullets up to a total width of five, then `@` and the full domain**. Two consequences, both tested: a one-character local part keeps **nothing** (`a@x.com` → `•••••@x.com`, because keeping the first character there would reveal the whole local part), and `verylongaddress@x.com` and `info@x.com` produce masks of identical width. **The domain is disclosed** — spec §16's own example discloses it, and a business domain is ordinarily public — which is recorded as an accepted disclosure in Known Limitations, not hidden.

**Note (ruling — the phone mask is fixed width: `+CC` plus nine positions, only the last of which may be real; spec §16's two examples are inconsistent and the locked one wins).**
§16's locked example is `+34 ••• ••• ••7` and its granted example is `+34900111222`, whose final digit is `2`, not `7` — the two JSON blocks are simply about different numbers, so no rule can satisfy both literally. This plan adopts the **shape** of the locked example, exactly: `+` then two country-code digits, then **always nine** mask positions in three groups of three, of which only the final position may carry a real digit. `+34900111222` → `+34 ••• ••• ••2`, reproducing the spec string character for character.
The width is fixed rather than derived from the real number, and that is the whole point: an earlier draft emitted `len(digits) - 2` bullets, so the mask's width was the number's length — a Spanish mobile (9 national digits) and a landline with an extension would have rendered at different widths, and comparing two profiles' masks would have leaked how long each number is. With a fixed width, two different numbers from two different countries produce masks that differ in at most three characters, all of which the spec's own example already discloses. A value with fewer than six digits (a malformed or placeholder number) masks the country code too — `+•• ••• ••• •••` — so "this number is short/junk" is not disclosed either. Two digits of country code is exact for the two launch markets (ES `+34`, IT `+39`); for a longer calling code the split is cosmetic and still reveals no more than two leading digits.

**Note (ruling — `website_url` is in the `GRANTED` payload and absent from `LOCKED`, with no mask).**
Phase 5's contract rule 1 forbids `website_url` in the directory serializers and assigns it to "Phase 7's contact endpoint, after a grant", so this phase must place it somewhere. It goes in the granted payload as a plain nullable string. It gets **no** mask: a URL has no meaningful partial form (any prefix either identifies the business outright or says nothing), so the locked payload simply omits the key. Spec §16's granted example does not list it; adding it is the minimum needed to honour Phase 5's rule without inventing a second endpoint.

**Note (ruling — `UNAVAILABLE` is a third state, served with 200, and outranks an existing grant).**
Spec §16: "suspended entity contact becomes unavailable". It names no payload. Returning `LOCKED` would be a lie (no inquiry can unlock a suspended entity), and 404 would be a lie to a grant holder who saw the contact yesterday. So a `SUSPENDED` broker or professional returns `200 {"contact": {"state": "UNAVAILABLE"}}` — no masks, no `unlock_rule`, no raw values — **to everyone, including grant holders**, and the check runs *before* the grant lookup. `DRAFT` and `PENDING` entities, which were never public, return **404**, matching `ProfessionalDetailView`'s existing "404 rather than 403, so a hidden profile's existence is never disclosed" rule. The asymmetry is deliberate: a suspended entity was public (its slug is in search indexes and in grant holders' history), a draft one never was.

**Note (ruling — staff moderators and admins DO get a reveal, because Phase 3 already promises it on the wire).**
Spec §5's capability table (line ~200) gives "Reveal recipient contact after inquiry" as `own access` to every ordinary role and a bare **✓** to staff moderator and staff admin. An earlier draft of this plan left that unimplemented and recorded a deviation. That was wrong, and the evidence is in the merged code: `backend/accounts/selectors.py:44` already computes `"reveal_any_contact": staff_moderator` and `GET /api/v1/session/` already ships it to every staff client — `accounts/tests/test_session.py:133` asserts it is `True` for a moderator. Leaving the endpoint without a staff branch would mean the session payload advertises a capability no endpoint honours, which is spec §2.1's "every visible state requires a backend source" failing in the one direction nobody checks.
So: **`is_staff_moderator(viewer)` (which lets staff admins through too — `accounts/services.py:97`) yields `GRANTED` without a grant.** Four constraints keep it narrow, and each has a test:
- It is evaluated **after** the `contact_unlock` flag, so the rollout flag still gates every reveal. Staff are not a way around a disabled feature.
- It is evaluated **after** the suspended check, so a `SUSPENDED` entity is `UNAVAILABLE` to staff as well. Spec §16 states that rule with no carve-out.
- It is evaluated **after** the grant lookup, so a staff member who *did* send an inquiry takes the ordinary path and reports their real `granted_at`. The bypass only fires when there is no grant, and then `granted_at` and `grant_id` are `null` — the honest answer, since no grant exists.
- **Every** staff bypass reveal writes a `contact_access.staff_revealed` audit event — every request, not once per grant, because there is no grant row to carry a "first reveal" stamp and because spec §33.1 wants staff high-impact actions traceable. `accounts.selectors`'s single `is_staff_moderator` call is the only definition of "staff" involved, so the endpoint and the session payload cannot drift apart.

**Note (ruling — Phase 7's endpoints do NOT take `UnifiedInquiriesEnabled`, which is a deliberate, narrow exception to Phase 6's contract rule 14).**
Phase 6's rule 14 says "Adding a messaging endpoint means adding `UnifiedInquiriesEnabled` to its `permission_classes`", and these two endpoints do live in the `messaging` app. They are exempted, for the same shape of reason Phase 6 exempts its own `GET /api/v1/inquiries/config/`: that route answers `200 {"enabled": false}` rather than 403 precisely because it is the mechanism that tells the page what to render.
- **The read endpoint.** With `unified_inquiries` off, spec §14.2 still requires a contact panel on the professional page, and spec §2.1 still requires every visible state to have a backend source. A `403 feature_disabled` would leave the panel rendering an error where the honest answer is `LOCKED` plus the unlock explanation — the user simply cannot act on it yet, which Phase 6's own `config.enabled` already tells the page. And an existing grant holder losing access to a contact they legitimately unlocked, because *new* inquiries were paused, is a regression with no upside.
- **The staff revoke endpoint.** It is an abuse remedy. The moment inquiries are switched off is exactly when an operator is most likely to be firefighting, and that is the worst possible moment for the revocation route to 403.
What *is* gated is the only thing worth gating here: the reveal, by this phase's own §35.1 flag, `contact_unlock`. Task 5 has a test pinning that the contact endpoint still answers with `unified_inquiries` disabled, so the divergence is deliberate and visible rather than an omission.
**The same ruling settles Phase 6's contract rule 11a** ("the flag gate goes FIRST in `permission_classes`", which names Phase 7 explicitly): neither Phase 7 view has a flag gate in `permission_classes`, so there is nothing to order, and the property rule 11a exists to protect is pinned in the stronger form this phase can actually offer — **the flag state changes the payload and never the status code, nor who may ask**. `contact_unlock` is not a rollout gate in the Phase 6 sense: it only ever closes the reveal, so "off" means everyone sees `LOCKED`, not that the endpoint disappears. Both view docstrings say this, and two tests guard it (Task 5's parametrized ordering test over an anonymous, a deactivated and an eligible caller; Task 6's revoke-with-the-flag-off test). A future contact endpoint that *is* rollout-gated puts its gate first, as rule 11a requires.

**Note (ruling — `UNAVAILABLE` and Phase 6's `NOT_APPLICABLE` are different vocabularies and must not be merged).**
Phase 6's inquiry response reports `contact_access: "GRANTED" | "NOT_APPLICABLE"` (its contract rule 4): `NOT_APPLICABLE` means *this inquiry* had nothing to grant, because a private-seller listing has no `target_type` under §11.8. Phase 7's `contact` payload reports `LOCKED | GRANTED | UNAVAILABLE`: `UNAVAILABLE` means *this entity's* contact cannot be shown at all because it is suspended. They answer different questions about different subjects, and a private seller never reaches Phase 7's endpoint at all — `TARGET_TYPE_BY_SEGMENT` has no segment for one, so such a request is a 404. Collapsing them into one enum would force a client to disambiguate by context. Task 12 asserts `GRANTED` only for broker/professional contexts, and Contract rule 7 keeps the two vocabularies apart.

**Note (ruling — the `contact_unlock` flag gates revealing, never locking).**
Spec §35.1 requires flags to gate backend behaviour, and §35.2 step 4 deploys code with features off. If the flag switched the whole endpoint off (404), the professional page would render no contact panel at all and spec §2.1's "every visible state requires a backend source" would be satisfied only vacuously. If it switched the endpoint to always-granted, it would be a privacy hole. So: **flag off ⇒ every viewer gets `LOCKED`**, even one holding an active grant; **flag on ⇒ grant holders get `GRANTED`**. Locking is the fail-closed direction, the page keeps rendering, and flipping the flag is a pure widening of access that can be reversed instantly. Grants keep being created by Phase 6 while the flag is off (that is Phase 6's bookkeeping, and suppressing it would mean users who inquired during rollout would have to inquire again).

**Note (ruling — the reveal audit fires once per grant, not once per request).**
Spec §2.4 requires contact reveals to produce immutable audit events; a `GET` that writes one `AuditEvent` per request would put an unbounded, self-inflicted write load on a public page and bury the signal. The grant row records *authorization*; this phase adds `first_revealed_at` to record *delivery*, set by a single conditional `UPDATE … WHERE first_revealed_at IS NULL` whose row count decides whether the audit event is written. Concurrent first requests therefore produce exactly one event. This is the same "exactly one despite concurrent duplicates" property spec §16's acceptance list demands of grant creation, applied to the reveal.

**Note (ruling — staff revocation is a new endpoint, flagged as an addition to §30.1's inventory.)**
Spec §16 requires "Staff can revoke grants for abuse" and §30.1's table lists no route for it. Following Phase 11's precedent with `POST /api/v1/listings/<id>/withdraw/`, this phase adds `POST /api/v1/staff/contact-grants/<id>/revoke/` under §30.1's closing latitude ("Exact URL naming may follow an established API convention"), and the Contract summary lists it **as a Phase 7 addition, not as a §30.1 endpoint**. A written `reason` is required, because §36.6 frames revocation as an abuse remedy and an unexplained one is not auditable.

**Note (ruling — §36.6's "recipient blocking a user … revoke contact access for that relationship" is a documented seam, not a deliverable here).**
There is no block endpoint anywhere in §30.1, and `Conversation.status = BLOCKED` is Phase 6's column. This phase ships the service function that does the work — `revoke_contact_access(...)` — so whichever phase builds blocking (Phase 6 if it ships blocking, otherwise Phase 19's broker messaging) calls one function rather than reimplementing the revocation transaction. Recorded in the Contract summary and in Known Limitations.

**Note (ruling — the frontend deliverable is the professional detail page only).**
`frontend/src/app/` contains `login`, `verify-email`, `403`, `health`, `services/**`, `professionals/profile` (a redirect route) and `sitemap.ts`. **There is no broker profile page and no boat listing page** — spec §29.2's broker profile is Phase 20's and the listing detail page is Phase 16/20's. The backend endpoint serves `broker` targets from day one and is tested for them; the *mount* on a broker page is Phase 20's one-line job. Building a broker page here would mean inventing spec §29.2's whole template and rebuilding it in Phase 20. Recorded in Known Limitations.

**Note (ruling — the panel is a client component, and that is a privacy requirement, not a preference).**
Spec §16 forbids the unblurred value in "page source … or preloaded JSON". Next.js server components serialize their data into the RSC payload embedded in the HTML. A server-rendered contact panel would therefore put whatever it fetched into the page source — and the access token needed to prove *which* viewer is asking lives in browser memory (`lib/api/client.ts`), so an SSR fetch could not identify the viewer anyway and would have to render the locked state for everyone. `"use client"` + fetch-after-mount is the only shape that is both correct and private.

---

## File Structure

**Backend — new files (all under `backend/messaging/`):**

| File | Responsibility |
|---|---|
| `masking.py` | Pure string functions: `mask_email`, `mask_phone`, the `•` constant. No Django imports, no I/O. |
| `contact_access.py` | The service. Target resolution, the three frozen result dataclasses, `resolve_contact_access()`, `record_first_reveal()`, `revoke_contact_access()`, the flag constant and the URL-segment map. |
| `contact_payloads.py` | Serialization only: three payload builders plus the `contact_payload()` dispatcher. Kept apart from the service so a leak test can assert the *shape* of each state without touching the database. |
| `contact_views.py` | Two views, both extending Phase 6's `MessagingAPIView`: the public contact read and the staff revoke. Permission classes, throttle scopes, the `no-store` headers, exception mapping. No business rules. |
| `tests/contact_factories.py` | `make_contact_grant(...)` — Phase 7's own fixtures, so Phase 6's `factories.py` is never edited. |
| `tests/test_masking.py`, `tests/test_contact_access_service.py`, `tests/test_contact_payloads.py`, `tests/test_contact_reveal_audit.py`, `tests/test_contact_api.py`, `tests/test_contact_revocation.py`, `tests/test_contact_leak_sweep.py`, `tests/test_phase7_acceptance.py` | One module per task. |

**Backend — modified files:** `messaging/models.py` (one appended field), `messaging/urls.py` (two appended paths), `messaging/tests/conftest.py` (one appended flag key), `config/settings/base.py` (two appended throttle rates), two new migrations in `messaging/migrations/`.

**Frontend — new files:**

| File | Responsibility |
|---|---|
| `src/lib/i18n/contact.ts` | The EN/IT/ES dictionary for every string this phase renders, plus `tContact()`. A sibling of Phase 5's directory dictionary, not an edit to it. |
| `src/lib/api/contacts.ts` | The `ContactAccess` discriminated union, `fetchContactAccess()`, and the refresh-event seam Phase 6's form calls. |
| `src/components/contact/ContactPanel.tsx` (+ `.test.tsx`) | The client component: loading, locked, granted, unavailable and error states; waits for the session to bootstrap before asking. |
| `src/components/contact/inquiry-refresh.test.tsx` | The Phase 6 → Phase 7 seam proved end to end: a real `InquiryForm` submit flips a real `ContactPanel`. |

**Frontend — modified files:** `src/app/services/professionals/[slug]/page.tsx` (the `PHASE 7 SEAM` comment becomes the mount) and `src/components/inquiry/InquiryForm.tsx` (Phase 6's file: one import and the two-line refresh call in its success path).

---

### Task 1: Mask primitives

**Files:**
- Create: `backend/messaging/masking.py`
- Test: `backend/messaging/tests/test_masking.py`

**Interfaces:**
- Consumes: nothing. These are pure functions with no Django import, deliberately, so every masking rule is testable without a database and the module can never grow a query.
- Produces:
  - `messaging.masking.MASK_CHARACTER: str` — `"•"` (`•`).
  - `messaging.masking.mask_email(value: str | None) -> str`
  - `messaging.masking.mask_phone(value: str | None) -> str`
  - `messaging.masking.EMAIL_MASK_WIDTH`, `PHONE_COUNTRY_CODE_DIGITS`, `PHONE_TRAILING_DIGITS`, `PHONE_MINIMUM_DIGITS`, `PHONE_GROUP_SIZE` — the tunable widths, named so a reviewer can see the whole disclosure budget at a glance.

- [ ] **Step 1: Write the failing test**

`backend/messaging/tests/test_masking.py`:

```python
"""Spec §16's two mask shapes, plus the length-non-disclosure rules this phase
adds on top of them (see the two mask rulings in the plan)."""

from messaging.masking import MASK_CHARACTER, mask_email, mask_phone


def test_spec_16_email_example_is_reproduced_exactly():
    assert mask_email("info@example.com") == "i••••@example.com"


def test_email_mask_width_does_not_depend_on_the_local_part_length():
    """A length-preserving mask would leak the local part's length to anyone
    enumerating a known address list. Both masks must be the same width."""
    short = mask_email("info@example.com")
    long = mask_email("verylongaddressindeed@example.com")

    assert len(short.split("@")[0]) == len(long.split("@")[0])


def test_a_one_character_local_part_keeps_nothing():
    """Keeping "the first character" of a one-character local part would
    reveal the entire local part."""
    assert mask_email("a@example.com") == "•••••@example.com"


def test_the_domain_is_preserved_because_spec_16s_own_example_preserves_it():
    assert mask_email("office@blue-marine.example") == "o••••@blue-marine.example"


def test_a_value_that_is_not_an_address_is_masked_entirely():
    assert mask_email("not-an-email") == "•••••"
    assert mask_email("") == "•••••"
    assert mask_email(None) == "•••••"


def test_spec_16_phone_example_shape_is_reproduced():
    assert mask_phone("+34900111222") == "+34 ••• ••• ••2"


def test_only_the_country_code_and_the_final_digit_survive():
    masked = mask_phone("+39055123456")

    assert [character for character in masked if character.isdigit()] == ["3", "9", "6"]


def test_separators_in_the_stored_number_do_not_change_the_mask():
    assert mask_phone("+34 900 111 222") == mask_phone("+34900111222")
    assert mask_phone("(+34) 900-111-222") == mask_phone("+34900111222")


def test_phone_mask_width_does_not_depend_on_the_number_length():
    """The mask is fixed width. A mask whose width tracked the real number
    would leak its length to anyone comparing two profiles."""
    nine_national_digits = mask_phone("+34900111222")
    twelve_national_digits = mask_phone("+390551234567890")

    assert len(nine_national_digits) == len(twelve_national_digits)
    assert nine_national_digits.count(MASK_CHARACTER) == twelve_national_digits.count(
        MASK_CHARACTER
    )


def test_a_short_number_masks_the_country_code_too_and_keeps_the_same_width():
    """With a short or malformed number, "+CC plus the last digit" is too large
    a fraction of the secret — and a narrower mask would itself announce "this
    one is short"."""
    assert mask_phone("+3412") == "+•• ••• ••• •••"
    assert mask_phone("") == "+•• ••• ••• •••"
    assert mask_phone(None) == "+•• ••• ••• •••"
    assert len(mask_phone("+3412")) == len(mask_phone("+34900111222"))


def test_the_mask_character_is_the_bullet_spec_16_uses():
    assert MASK_CHARACTER == "•"
    assert "*" not in mask_email("info@example.com")
    assert "*" not in mask_phone("+34900111222")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest messaging/tests/test_masking.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'messaging.masking'`.

- [ ] **Step 3: Write minimal implementation**

`backend/messaging/masking.py`:

```python
"""Mask helpers for spec §16's LOCKED contact payload.

Pure functions: no Django import, no database, no I/O — so every masking rule
is exhaustively testable without fixtures, and the module can never grow a
query. The two rules implemented here are rulings recorded in this phase's
plan, derived from spec §16's two example strings:

* the email mask is FIXED WIDTH (it does not preserve the local part's length);
* the phone mask keeps only "+CC" and the final digit.
"""

#: U+2022 BULLET — the character spec §16's own examples use. Never "*" or ".".
MASK_CHARACTER = "•"

#: Total width of the masked local part. `info` and a 40-character local part
#: therefore produce masks of identical width.
EMAIL_MASK_WIDTH = 5

#: Digits kept as the country calling code, behind a literal "+". Exact for the
#: two launch markets (ES +34, IT +39); for a longer calling code the split is
#: cosmetic and still reveals no more than two leading digits.
PHONE_COUNTRY_CODE_DIGITS = 2
#: Trailing digits kept, exactly as spec §16's "+34 ••• ••• ••7" keeps one.
PHONE_TRAILING_DIGITS = 1
#: FIXED number of mask positions after the country code, whatever the real
#: number's length — spec §16's example shows nine, in three groups of three.
#: Deriving this from len(digits) would make the mask's width the number's
#: length, which is the disclosure this mask exists to prevent.
PHONE_MASKED_DIGITS = 9
#: Below this many digits, the country code is masked as well.
PHONE_MINIMUM_DIGITS = 6
#: Spec §16's example groups the masked positions in threes.
PHONE_GROUP_SIZE = 3


def mask_email(value: str | None) -> str:
    """"info@example.com" -> "i••••@example.com" (spec §16)."""
    local, separator, domain = (value or "").partition("@")
    if not separator or not domain:
        return MASK_CHARACTER * EMAIL_MASK_WIDTH
    kept = local[:1] if len(local) > 1 else ""
    return f"{kept}{MASK_CHARACTER * (EMAIL_MASK_WIDTH - len(kept))}@{domain}"


def mask_phone(value: str | None) -> str:
    """"+34900111222" -> "+34 ••• ••• ••2" (spec §16's shape), at a FIXED width.

    The output is always "+" + 2 characters + " " + three groups of three, so
    two numbers of different lengths are indistinguishable by their masks.
    """
    digits = "".join(character for character in (value or "") if character.isdigit())
    if len(digits) < PHONE_MINIMUM_DIGITS:
        # Even the country code is masked: a narrower or differently shaped
        # mask here would announce "this number is short or malformed".
        country = MASK_CHARACTER * PHONE_COUNTRY_CODE_DIGITS
        masked = MASK_CHARACTER * PHONE_MASKED_DIGITS
    else:
        country = digits[:PHONE_COUNTRY_CODE_DIGITS]
        masked = (
            MASK_CHARACTER * (PHONE_MASKED_DIGITS - PHONE_TRAILING_DIGITS)
            + digits[-PHONE_TRAILING_DIGITS:]
        )

    groups = [
        masked[index : index + PHONE_GROUP_SIZE]
        for index in range(0, PHONE_MASKED_DIGITS, PHONE_GROUP_SIZE)
    ]
    return f"+{country} {' '.join(groups)}"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && uv run pytest messaging/tests/test_masking.py -v`
Expected: 11 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/messaging/masking.py backend/messaging/tests/test_masking.py
git commit -m "feat(messaging): add contact mask primitives for the locked payload"
```

---

### Task 2: `ContactAccessService` — target resolution, the three result types, the `contact_unlock` flag

**Files:**
- Create: `backend/messaging/contact_access.py`, `backend/messaging/tests/contact_factories.py`, `backend/messaging/tests/test_contact_access_service.py`
- Create: `backend/messaging/migrations/0004_seed_contact_unlock_flag.py` — Phase 6's last migration is `0003_message_contactaccessgrant`; confirm with `ls backend/messaging/migrations/` before writing the dependency.
- Modify: `backend/messaging/enums.py` — append one constant, `CONTACT_UNLOCK_FLAG`.
- Modify: `backend/messaging/tests/conftest.py` — **two** edits: append `CONTACT_UNLOCK_FLAG` to `MESSAGING_FEATURE_FLAG_KEYS` (so its cached value is deleted around every test), **and** add its `FeatureFlag` row to `_messaging_reference_rows` (so a `transaction=True` flush elsewhere in the session cannot delete it — this phase adds two such tests).

**Interfaces:**
- Consumes: `messaging.masking.{mask_email, mask_phone}` (Task 1); `messaging.models.ContactAccessGrant`, `messaging.selectors.active_contact_grant`, `messaging.enums.{ContactTargetType, ConversationType}` and `messaging.tests.factories.{make_conversation, make_grant}` (**Phase 6** — reconciliation rows 2, 3 and 4); `brokers.models.BrokerOrganization`, `brokers.enums.BrokerOrganizationStatus`; `professionals.models.ProfessionalProfile`, `professionals.enums.ProfessionalProfileStatus`; `platform_settings.services.is_feature_enabled`; `accounts.services.is_staff_moderator` (Phase 3 — the same function `accounts.selectors` uses to compute the session payload's `reveal_any_contact`).
- Produces:
  - `messaging.enums.CONTACT_UNLOCK_FLAG = "contact_unlock"` — appended to Phase 6's `enums.py` beside its own `UNIFIED_INQUIRIES_FLAG`, not defined in the service module: `tests/conftest.py` needs the string, and importing a whole service module (and with it `brokers`, `professionals`, `platform_settings` and `accounts`) into a conftest for one constant is a needless import edge. Phase 6 keeps its flag key there for the same reason.
  - `messaging.contact_access.UNLOCK_RULE = "SEND_INQUIRY"`, `TARGET_TYPE_BY_SEGMENT: dict[str, ContactTargetType]`.
  - `messaging.contact_access.ContactTargetNotFound(Exception)`
  - `messaging.contact_access.ContactTarget` — frozen dataclass with `target_type`, `instance`, `is_suspended`, plus the properties `id` and `grant_field`.
  - `messaging.contact_access.LockedContact(email_mask, phone_mask, unlock_rule=UNLOCK_RULE)`, `state: ClassVar[str] = "LOCKED"`.
  - `messaging.contact_access.GrantedContact(email, phone, website_url, granted_at, grant_id)`, `state: ClassVar[str] = "GRANTED"`. `granted_at` and `grant_id` are `None` on the staff-bypass path.
  - `messaging.contact_access.UnavailableContact()`, `state: ClassVar[str] = "UNAVAILABLE"`.
  - `messaging.contact_access.ContactAccess` — the union alias of those three.
  - `messaging.contact_access.resolve_contact_target(*, segment: str, target_id) -> ContactTarget`
  - `messaging.contact_access.resolve_contact_access(*, viewer, segment: str, target_id) -> ContactAccess`
  - `messaging.tests.contact_factories.make_contact_grant(*, viewer, broker=None, professional=None, conversation=None, granted_at=None, revoked_at=None) -> ContactAccessGrant`

- [ ] **Step 1: Write the failing test**

`backend/messaging/tests/contact_factories.py`:

```python
"""Phase 7's one-call grant fixture.

Phase 6 already ships `make_grant`, but it requires a `source_conversation`
that every Phase 7 test would otherwise have to build by hand — with the right
`conversation_type`, because `Conversation` constrains the context combination.
This wraps both. It lives in its own module rather than being appended to
Phase 6's `factories.py` so this phase never edits a file another phase owns.
"""

from messaging.enums import ContactTargetType, ConversationType
from messaging.tests.factories import make_conversation, make_grant


def make_contact_grant(
    *,
    viewer,
    broker=None,
    professional=None,
    conversation=None,
    granted_at=None,
    revoked_at=None,
):
    if (broker is None) == (professional is None):
        raise ValueError("Pass exactly one of broker= or professional=.")
    is_broker = broker is not None
    extra = {}
    if granted_at is not None:
        extra["granted_at"] = granted_at
    if revoked_at is not None:
        extra["revoked_at"] = revoked_at
    return make_grant(
        viewer=viewer,
        target_type=(
            ContactTargetType.BROKER if is_broker else ContactTargetType.PROFESSIONAL
        ),
        broker=broker,
        professional=professional,
        source_conversation=conversation
        or make_conversation(
            initiator=viewer,
            conversation_type=(
                ConversationType.BROKER_INQUIRY
                if is_broker
                else ConversationType.PROFESSIONAL_INQUIRY
            ),
            broker=broker,
            professional=professional,
        ),
        **extra,
    )
```

`backend/messaging/tests/test_contact_access_service.py`:

```python
"""Spec §16's authorization outcomes, decided server-side.

Every assertion here is about WHICH of the three result types comes back, and
about the fact that the locked one structurally cannot carry a raw value.
"""

import pytest
from django.contrib.auth.models import AnonymousUser, Group
from django.utils import timezone

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from brokers.enums import BrokerOrganizationStatus
from brokers.tests.factories import make_broker
from messaging.contact_access import (
    CONTACT_UNLOCK_FLAG,
    ContactTargetNotFound,
    GrantedContact,
    LockedContact,
    UnavailableContact,
    resolve_contact_access,
)
from messaging.tests.contact_factories import make_contact_grant
from platform_settings.models import FeatureFlag
from professionals.enums import ProfessionalProfileStatus
from professionals.tests.factories import make_professional

pytestmark = pytest.mark.django_db


@pytest.fixture
def unlock_enabled():
    FeatureFlag.objects.update_or_create(
        key=CONTACT_UNLOCK_FLAG,
        defaults={"is_enabled": True, "description": "enabled for this test"},
    )


@pytest.fixture
def viewer():
    return make_user(email="viewer@example.com")


@pytest.fixture
def professional():
    owner = make_user(email="adriatic-owner@example.com", role=UserRole.SERVICE_PROVIDER)
    return make_professional(
        owner,
        display_name="Adriatic Surveyors",
        slug="adriatic-surveyors",
        public_email="info@adriatic.example",
        public_phone="+39055123456",
        website_url="https://adriatic.example",
    )


@pytest.fixture
def broker():
    return make_broker(
        name="Levante Yachts",
        slug="levante-yachts",
        public_email="office@levante.example",
        public_phone="+34900111222",
    )


def test_a_guest_sees_the_locked_state_with_masks(professional, unlock_enabled):
    access = resolve_contact_access(
        viewer=AnonymousUser(), segment="professional", target_id=professional.pk
    )

    assert isinstance(access, LockedContact)
    assert access.state == "LOCKED"
    assert access.unlock_rule == "SEND_INQUIRY"
    assert access.email_mask == "i••••@adriatic.example"
    assert access.phone_mask == "+39 ••• ••• ••6"


def test_the_locked_result_has_no_attribute_that_could_hold_a_raw_value(
    professional, unlock_enabled
):
    """The strongest guarantee in this phase: a serializer bug cannot leak what
    the object does not carry."""
    access = resolve_contact_access(
        viewer=AnonymousUser(), segment="professional", target_id=professional.pk
    )

    assert not hasattr(access, "email")
    assert not hasattr(access, "phone")
    assert not hasattr(access, "website_url")


def test_a_signed_in_viewer_without_a_grant_is_still_locked(
    viewer, professional, unlock_enabled
):
    access = resolve_contact_access(
        viewer=viewer, segment="professional", target_id=professional.pk
    )

    assert isinstance(access, LockedContact)


def test_a_grant_reveals_the_configured_business_contact(
    viewer, professional, unlock_enabled
):
    grant = make_contact_grant(viewer=viewer, professional=professional)

    access = resolve_contact_access(
        viewer=viewer, segment="professional", target_id=professional.pk
    )

    assert isinstance(access, GrantedContact)
    assert access.state == "GRANTED"
    assert access.email == "info@adriatic.example"
    assert access.phone == "+39055123456"
    assert access.website_url == "https://adriatic.example"
    assert access.granted_at == grant.granted_at
    assert access.grant_id == grant.pk


def test_sending_to_one_entity_does_not_unlock_another(
    viewer, broker, professional, unlock_enabled
):
    """Spec §16 acceptance: "Sending to Broker A does not unlock Broker B"."""
    make_contact_grant(viewer=viewer, professional=professional)

    access = resolve_contact_access(viewer=viewer, segment="broker", target_id=broker.pk)

    assert isinstance(access, LockedContact)


def test_another_viewers_grant_does_not_unlock_for_me(
    viewer, professional, unlock_enabled
):
    """Spec §36.6: "Contact access is not transferable between accounts"."""
    somebody_else = make_user(email="somebody-else@example.com")
    make_contact_grant(viewer=somebody_else, professional=professional)

    access = resolve_contact_access(
        viewer=viewer, segment="professional", target_id=professional.pk
    )

    assert isinstance(access, LockedContact)


def test_a_revoked_grant_re_locks_the_contact(viewer, professional, unlock_enabled):
    make_contact_grant(
        viewer=viewer, professional=professional, revoked_at=timezone.now()
    )

    access = resolve_contact_access(
        viewer=viewer, segment="professional", target_id=professional.pk
    )

    assert isinstance(access, LockedContact)


def test_a_suspended_entity_is_unavailable_even_to_a_grant_holder(
    viewer, professional, unlock_enabled
):
    """Spec §16: "suspended entity contact becomes unavailable"."""
    make_contact_grant(viewer=viewer, professional=professional)
    professional.status = ProfessionalProfileStatus.SUSPENDED
    professional.save(update_fields=["status", "updated_at"])

    access = resolve_contact_access(
        viewer=viewer, segment="professional", target_id=professional.pk
    )

    assert isinstance(access, UnavailableContact)
    assert access.state == "UNAVAILABLE"


def test_a_suspended_broker_is_unavailable_too(viewer, broker, unlock_enabled):
    broker.status = BrokerOrganizationStatus.SUSPENDED
    broker.save(update_fields=["status", "updated_at"])

    access = resolve_contact_access(viewer=viewer, segment="broker", target_id=broker.pk)

    assert isinstance(access, UnavailableContact)


@pytest.mark.parametrize(
    "status", [ProfessionalProfileStatus.DRAFT, ProfessionalProfileStatus.PENDING]
)
def test_a_never_public_entity_is_not_found_rather_than_locked(
    professional, status, unlock_enabled
):
    """Matches ProfessionalDetailView's existing rule: a hidden profile's
    existence is never disclosed."""
    professional.status = status
    professional.save(update_fields=["status", "updated_at"])

    with pytest.raises(ContactTargetNotFound):
        resolve_contact_access(
            viewer=AnonymousUser(), segment="professional", target_id=professional.pk
        )


def test_an_unknown_segment_is_not_found(professional, unlock_enabled):
    with pytest.raises(ContactTargetNotFound):
        resolve_contact_access(
            viewer=AnonymousUser(), segment="listing", target_id=professional.pk
        )


def test_a_staff_moderator_reveals_without_holding_a_grant(professional, unlock_enabled):
    """Spec §5's staff row, and the capability accounts/selectors.py:44 already
    advertises as `reveal_any_contact` on GET /api/v1/session/."""
    moderator = make_user(email="service-moderator@example.com", role=UserRole.STAFF)
    moderator.groups.add(Group.objects.get(name=StaffGroup.MODERATOR))

    access = resolve_contact_access(
        viewer=moderator, segment="professional", target_id=professional.pk
    )

    assert isinstance(access, GrantedContact)
    assert access.email == "info@adriatic.example"
    # No grant exists, so there is no timestamp to report and none is invented.
    assert access.granted_at is None
    assert access.grant_id is None


def test_a_staff_admin_reveals_too(professional, unlock_enabled):
    """accounts.services.is_staff_moderator() lets ADMIN through, matching
    spec §5's table, which ticks both staff columns."""
    admin = make_user(email="service-admin@example.com", role=UserRole.STAFF)
    admin.groups.add(Group.objects.get(name=StaffGroup.ADMIN))

    access = resolve_contact_access(
        viewer=admin, segment="professional", target_id=professional.pk
    )

    assert isinstance(access, GrantedContact)


def test_a_staff_member_who_did_inquire_reports_the_real_grant(
    professional, unlock_enabled
):
    """The grant lookup runs BEFORE the staff branch, so a staff member who
    actually sent an inquiry is not downgraded to a null timestamp."""
    moderator = make_user(email="inquiring-moderator@example.com", role=UserRole.STAFF)
    moderator.groups.add(Group.objects.get(name=StaffGroup.MODERATOR))
    grant = make_contact_grant(viewer=moderator, professional=professional)

    access = resolve_contact_access(
        viewer=moderator, segment="professional", target_id=professional.pk
    )

    assert access.grant_id == grant.pk
    assert access.granted_at == grant.granted_at


def test_a_staff_moderator_does_not_bypass_a_suspension(professional, unlock_enabled):
    """Spec §16 states the suspension rule with no staff carve-out."""
    moderator = make_user(email="suspended-case-moderator@example.com", role=UserRole.STAFF)
    moderator.groups.add(Group.objects.get(name=StaffGroup.MODERATOR))
    professional.status = ProfessionalProfileStatus.SUSPENDED
    professional.save(update_fields=["status", "updated_at"])

    access = resolve_contact_access(
        viewer=moderator, segment="professional", target_id=professional.pk
    )

    assert isinstance(access, UnavailableContact)


def test_a_staff_moderator_does_not_bypass_the_rollout_flag(professional):
    """The staff branch is evaluated after the flag: staff are not a way around
    a disabled feature. No `unlock_enabled` fixture here."""
    moderator = make_user(email="flag-off-moderator@example.com", role=UserRole.STAFF)
    moderator.groups.add(Group.objects.get(name=StaffGroup.MODERATOR))

    access = resolve_contact_access(
        viewer=moderator, segment="professional", target_id=professional.pk
    )

    assert isinstance(access, LockedContact)


def test_an_ordinary_signed_in_user_is_not_mistaken_for_staff(
    viewer, professional, unlock_enabled
):
    """Guards the four tests above: `is_staff_moderator` must not be a no-op
    that lets everyone through."""
    access = resolve_contact_access(
        viewer=viewer, segment="professional", target_id=professional.pk
    )

    assert isinstance(access, LockedContact)


def test_with_the_flag_off_even_a_grant_holder_stays_locked(viewer, professional):
    """The rollout flag gates REVEALING, never locking — the fail-closed
    direction (spec §35.1, §35.2 step 4). No `unlock_enabled` fixture here."""
    make_contact_grant(viewer=viewer, professional=professional)

    access = resolve_contact_access(
        viewer=viewer, segment="professional", target_id=professional.pk
    )

    assert isinstance(access, LockedContact)


def test_the_flag_ships_disabled():
    """Pins the state every test in this package starts from.

    Note what this does and does not prove, now that `_messaging_reference_rows`
    re-asserts the row: it proves the **starting state of the suite** is the
    shipped one (disabled), not that `messaging/0004` inserted it — a
    `transaction=True` test elsewhere in the session can truncate the migration's
    row, which is exactly why the fixture exists. The migration's own default is
    a one-line `defaults={"is_enabled": False, ...}` in a file under review, and
    spec §35.2 step 4's "deploy with features off" is verified at deploy time,
    not here. Read together, the pair still catches the mistake that matters:
    somebody flipping the shipped default to True.
    """
    assert FeatureFlag.objects.get(key=CONTACT_UNLOCK_FLAG).is_enabled is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest messaging/tests/test_contact_access_service.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'messaging.contact_access'`.

- [ ] **Step 3: Write minimal implementation**

`backend/messaging/contact_access.py`:

```python
"""Spec §16's ContactAccessService: contact visibility is an authorization
outcome computed here, never a presentation decision taken downstream.

The three result types are deliberately SEPARATE frozen dataclasses rather than
one class with nullable fields. `LockedContact` has no `email` attribute at all,
so no serializer, template, log line or debugger repr() can leak a raw value on
the locked path — the value is never placed on the object in the first place.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import ClassVar
from uuid import UUID

from accounts.services import is_staff_moderator
from brokers.enums import BrokerOrganizationStatus
from brokers.models import BrokerOrganization
from platform_settings.services import is_feature_enabled
from professionals.enums import ProfessionalProfileStatus
from professionals.models import ProfessionalProfile

from .enums import CONTACT_UNLOCK_FLAG, ContactTargetType
from .masking import mask_email, mask_phone
from .models import ContactAccessGrant
from .selectors import active_contact_grant

#: Spec §16's only unlock_rule value.
UNLOCK_RULE = "SEND_INQUIRY"

#: URL path segment -> spec §11.8's target_type. The segments are this phase's
#: (they are URL vocabulary, not stored data); the values are Phase 6's enum,
#: which is a `TextChoices`, so `"BROKER" == ContactTargetType.BROKER` and the
#: value serializes to the spec-literal string.
TARGET_TYPE_BY_SEGMENT = {
    "broker": ContactTargetType.BROKER,
    "professional": ContactTargetType.PROFESSIONAL,
}


class ContactTargetNotFound(Exception):
    """No such entity, or one that has never been public (DRAFT/PENDING).

    The view renders this as 404 — never 403 — so a hidden entity's existence
    is not disclosed, matching ProfessionalDetailView's existing rule.
    """


@dataclass(frozen=True)
class ContactTarget:
    target_type: str
    instance: object
    is_suspended: bool

    @property
    def id(self) -> UUID:
        return self.instance.pk

    @property
    def grant_field(self) -> str:
        """The ContactAccessGrant FK column that points at this entity."""
        return (
            "broker"
            if self.target_type == ContactTargetType.BROKER
            else "professional"
        )


@dataclass(frozen=True)
class LockedContact:
    state: ClassVar[str] = "LOCKED"
    email_mask: str
    phone_mask: str
    unlock_rule: str = UNLOCK_RULE


@dataclass(frozen=True)
class GrantedContact:
    state: ClassVar[str] = "GRANTED"
    email: str
    phone: str
    website_url: str | None
    #: Both are None on the staff-bypass path: spec §5 gives staff a reveal
    #: without a grant, and inventing a `granted_at` for a grant that does not
    #: exist would be a fabricated timestamp in an audited payload.
    granted_at: datetime | None
    grant_id: UUID | None


@dataclass(frozen=True)
class UnavailableContact:
    state: ClassVar[str] = "UNAVAILABLE"


ContactAccess = LockedContact | GrantedContact | UnavailableContact


def resolve_contact_target(*, segment: str, target_id) -> ContactTarget:
    target_type = TARGET_TYPE_BY_SEGMENT.get(segment)
    if target_type is None:
        raise ContactTargetNotFound(f"Unknown contact target type: {segment!r}")

    if target_type == ContactTargetType.BROKER:
        instance = BrokerOrganization.objects.filter(pk=target_id).first()
        active, suspended = (
            BrokerOrganizationStatus.ACTIVE,
            BrokerOrganizationStatus.SUSPENDED,
        )
    else:
        instance = ProfessionalProfile.objects.filter(pk=target_id).first()
        active, suspended = (
            ProfessionalProfileStatus.ACTIVE,
            ProfessionalProfileStatus.SUSPENDED,
        )

    if instance is None or instance.status not in (active, suspended):
        raise ContactTargetNotFound(str(target_id))

    return ContactTarget(
        target_type=target_type,
        instance=instance,
        is_suspended=instance.status == suspended,
    )


def resolve_contact_access(*, viewer, segment: str, target_id) -> ContactAccess:
    """Spec §16's whole decision, in the order the rules must be applied."""
    target = resolve_contact_target(segment=segment, target_id=target_id)

    # Suspension outranks a grant: spec §16 makes a suspended entity's contact
    # unavailable, not merely re-locked, because no inquiry can unlock it.
    if target.is_suspended:
        return UnavailableContact()

    if not _is_eligible_viewer(viewer):
        return _locked(target)

    # The rollout flag gates revealing only (see the ruling). Locking is the
    # fail-closed direction, so default=False is right here.
    if not is_feature_enabled(CONTACT_UNLOCK_FLAG, default=False):
        return _locked(target)

    # Phase 6's selector is the ONE definition of "active grant" — it already
    # filters revoked_at__isnull=True and orders by -granted_at, so a weaker
    # uniqueness constraint degrades to "newest wins" rather than raising on a
    # read. Do not re-implement the queryset here (reconciliation row 3).
    # Passing only the matching FK leaves the other None, which is exactly how
    # the selector distinguishes the two target kinds.
    grant = active_contact_grant(viewer, **{target.grant_field: target.instance})
    if grant is not None:
        return _granted(target, granted_at=grant.granted_at, grant_id=grant.pk)

    # Spec §5's staff row is a bare tick, and accounts.selectors already reports
    # `reveal_any_contact: is_staff_moderator(user)` on GET /api/v1/session/ —
    # so without this branch the session payload advertises a capability no
    # endpoint honours. is_staff_moderator() lets staff admins through too.
    # Checked LAST, so a staff member who actually sent an inquiry reports their
    # real granted_at rather than a null one.
    if is_staff_moderator(viewer):
        return _granted(target, granted_at=None, grant_id=None)

    return _locked(target)


def _is_eligible_viewer(viewer) -> bool:
    return bool(
        viewer is not None
        and getattr(viewer, "is_authenticated", False)
        and viewer.is_active
    )


def _granted(target: ContactTarget, *, granted_at, grant_id) -> GrantedContact:
    """The ONE place a raw contact value is ever read off an entity row."""
    return GrantedContact(
        email=target.instance.public_email,
        phone=target.instance.public_phone,
        website_url=target.instance.website_url or None,
        granted_at=granted_at,
        grant_id=grant_id,
    )


def _locked(target: ContactTarget) -> LockedContact:
    return LockedContact(
        email_mask=mask_email(target.instance.public_email),
        phone_mask=mask_phone(target.instance.public_phone),
    )
```

Append one constant to Phase 6's `backend/messaging/enums.py`, beside its `UNIFIED_INQUIRIES_FLAG`:

```python
#: Spec §35.1's rollout flag for Phase 7 (contact privacy and reveal). Lives
#: here rather than in contact_access.py so tests/conftest.py can import the
#: string without importing the service and its whole dependency fan-out.
CONTACT_UNLOCK_FLAG = "contact_unlock"
```

Then make **two** edits to Phase 6's `backend/messaging/tests/conftest.py` (read the real file first; change nothing else):

```python
from messaging.enums import CONTACT_UNLOCK_FLAG, UNIFIED_INQUIRIES_FLAG

# The cache keys this package clears around every test. Without the second
# entry a cached `contact_unlock` value leaks from one test into the next.
MESSAGING_FEATURE_FLAG_KEYS = [UNIFIED_INQUIRIES_FLAG, CONTACT_UNLOCK_FLAG]

#: Phase 7's flag ships DISABLED (spec §35.2 step 4) — the opposite of
#: `unified_inquiries`, so this reference row's default is False.
CONTACT_FLAG_TEST_DESCRIPTION = "Spec 35.1 rollout flag for contact reveal."
```

and, inside the existing `_messaging_reference_rows` fixture, immediately after its `UNIFIED_INQUIRIES_FLAG` block:

```python
    # Same reasoning as the row above, and this phase is what makes it
    # load-bearing: Phase 7 adds two `@pytest.mark.django_db(transaction=True)`
    # tests, and such a test ends with a `flush` that truncates every table and
    # re-emits `post_migrate` — which restores content types and permissions,
    # NOT rows a RunPython data migration inserted. Without this row,
    # `messaging/0004`'s seed can be gone by the time a later test reads it and
    # `test_the_flag_ships_disabled` fails with DoesNotExist, depending on
    # collection order.
    FeatureFlag.objects.update_or_create(
        key=CONTACT_UNLOCK_FLAG,
        defaults={"is_enabled": False, "description": CONTACT_FLAG_TEST_DESCRIPTION},
    )
```

**`update_or_create` with `is_enabled=False` is deliberate**, mirroring Phase 6's `True` for its own flag: every test starts from the shipped state, and the tests that need the reveal open say so through the `unlock_enabled` fixture, which pytest runs after this autouse one.

`backend/messaging/migrations/0004_seed_contact_unlock_flag.py`:

```python
from django.db import migrations

FLAG_KEY = "contact_unlock"
# platform_settings.FeatureFlag.description is CharField(max_length=255) — this
# string is 236 characters. Keep any edit under the limit or migrate() raises
# DataError (the lesson recorded in services_catalog/0004).
FLAG_DESCRIPTION = (
    "Spec 35.1 flag. Off = GET /api/v1/contacts/<type>/<id>/ still answers, but "
    "always with the LOCKED masked payload, even for a viewer holding a grant. "
    "On = grant holders receive the real business email/phone. Grants are "
    "created by the inquiry flow either way."
)


def seed_flag(apps, schema_editor):
    FeatureFlag = apps.get_model("platform_settings", "FeatureFlag")
    FeatureFlag.objects.get_or_create(
        key=FLAG_KEY,
        # Seeded DISABLED: spec 35.2 step 4 deploys code with features off, and
        # listings/0004's listing_revisions flag set the precedent.
        defaults={"is_enabled": False, "description": FLAG_DESCRIPTION},
    )


class Migration(migrations.Migration):
    dependencies = [
        # Phase 6's last migration. Verify with `ls backend/messaging/migrations/`.
        ("messaging", "0003_message_contactaccessgrant"),
        ("platform_settings", "0004_featureflag"),
    ]

    operations = [
        # Reverse is a no-op: a rollback must not delete an operator-toggleable
        # row (spec 32.3), matching services_catalog/0004 and listings/0004.
        migrations.RunPython(seed_flag, migrations.RunPython.noop),
    ]
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd backend && uv run python manage.py migrate && uv run pytest messaging/tests/test_contact_access_service.py -v
```
Expected: 20 passed (19 test functions, one of which is a two-case parametrize). Then `uv run python manage.py makemigrations --check --dry-run` must report no changes.

- [ ] **Step 5: Commit**

```bash
git add backend/messaging/contact_access.py backend/messaging/migrations backend/messaging/tests/contact_factories.py backend/messaging/tests/test_contact_access_service.py
git commit -m "feat(messaging): resolve contact access as a server-side authorization outcome"
```

---

### Task 3: Contact payload builders

**Files:**
- Create: `backend/messaging/contact_payloads.py`
- Test: `backend/messaging/tests/test_contact_payloads.py`

**Interfaces:**
- Consumes: `messaging.contact_access.{GrantedContact, LockedContact, UnavailableContact}` (Task 2).
- Produces:
  - `messaging.contact_payloads.locked_payload(access: LockedContact) -> dict`
  - `messaging.contact_payloads.granted_payload(access: GrantedContact) -> dict`
  - `messaging.contact_payloads.unavailable_payload(access: UnavailableContact) -> dict`
  - `messaging.contact_payloads.contact_payload(access) -> dict` — the dispatcher returning spec §16's `{"contact": {...}}` envelope.

- [ ] **Step 1: Write the failing test**

`backend/messaging/tests/test_contact_payloads.py`:

```python
"""Spec §16's two payload shapes, asserted as EXACT key sets.

The exactness is the point: a locked payload that merely happens not to contain
a raw value today would silently start containing one the day somebody adds a
field. These tests fail on any added key, in either direction.
"""

from datetime import datetime, timezone as datetime_timezone
from uuid import uuid4

import pytest

from messaging.contact_access import GrantedContact, LockedContact, UnavailableContact
from messaging.contact_payloads import contact_payload


def locked():
    return LockedContact(email_mask="i••••@example.com", phone_mask="+34 ••• ••• ••2")


def granted():
    return GrantedContact(
        email="info@example.com",
        phone="+34900111222",
        website_url="https://example.com",
        granted_at=datetime(2026, 9, 18, 10, 30, tzinfo=datetime_timezone.utc),
        grant_id=uuid4(),
    )


def test_the_locked_payload_matches_spec_16_exactly():
    assert contact_payload(locked()) == {
        "contact": {
            "state": "LOCKED",
            "email_mask": "i••••@example.com",
            "phone_mask": "+34 ••• ••• ••2",
            "unlock_rule": "SEND_INQUIRY",
        }
    }


def test_the_locked_payload_carries_no_raw_key_at_all():
    body = contact_payload(locked())["contact"]

    assert set(body) == {"state", "email_mask", "phone_mask", "unlock_rule"}


def test_the_granted_payload_matches_spec_16_plus_website_url():
    assert contact_payload(granted()) == {
        "contact": {
            "state": "GRANTED",
            "email": "info@example.com",
            "phone": "+34900111222",
            "website_url": "https://example.com",
            "granted_at": "2026-09-18T10:30:00Z",
        }
    }


def test_the_granted_payload_carries_no_mask_and_no_internal_id():
    """Masks are noise once unlocked, and grant_id is an internal handle the
    viewer has no endpoint for."""
    body = contact_payload(granted())["contact"]

    assert set(body) == {"state", "email", "phone", "website_url", "granted_at"}


def test_a_missing_website_is_null_not_absent():
    body = contact_payload(
        GrantedContact(
            email="info@example.com",
            phone="+34900111222",
            website_url=None,
            granted_at=datetime(2026, 9, 18, 10, 30, tzinfo=datetime_timezone.utc),
            grant_id=uuid4(),
        )
    )["contact"]

    assert body["website_url"] is None


def test_a_staff_reveal_reports_a_null_granted_at_rather_than_inventing_one():
    """Spec §5's staff row reveals without a grant; there is no timestamp to
    report, and a fabricated one in an audited payload would be worse than
    null."""
    body = contact_payload(
        GrantedContact(
            email="info@example.com",
            phone="+34900111222",
            website_url=None,
            granted_at=None,
            grant_id=None,
        )
    )["contact"]

    assert body["granted_at"] is None
    assert set(body) == {"state", "email", "phone", "website_url", "granted_at"}


def test_granted_at_is_iso_8601_utc_with_a_z_suffix():
    """Spec §30.2. Same transform as platform_settings.get_public_settings()."""
    body = contact_payload(granted())["contact"]

    assert body["granted_at"].endswith("Z")
    assert "+00:00" not in body["granted_at"]


def test_the_unavailable_payload_says_only_that():
    assert contact_payload(UnavailableContact()) == {"contact": {"state": "UNAVAILABLE"}}


def test_an_unknown_access_type_raises_rather_than_serializing_something():
    """Fail loudly: silently rendering an unknown object is how a leak ships."""
    with pytest.raises(TypeError):
        contact_payload(object())
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest messaging/tests/test_contact_payloads.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'messaging.contact_payloads'`.

- [ ] **Step 3: Write minimal implementation**

`backend/messaging/contact_payloads.py`:

```python
"""Spec §16's wire shapes. Serialization only — no queries, no rules.

Kept apart from contact_access.py so the exact key set of each state can be
asserted without a database, and so a reviewer can read every field that ever
reaches a client in one screen.
"""

from .contact_access import GrantedContact, LockedContact, UnavailableContact


def _isoformat(value) -> str:
    """Spec §30.2: ISO 8601 UTC. Same transform as get_public_settings()."""
    return value.isoformat().replace("+00:00", "Z")


def locked_payload(access: LockedContact) -> dict:
    return {
        "state": LockedContact.state,
        "email_mask": access.email_mask,
        "phone_mask": access.phone_mask,
        "unlock_rule": access.unlock_rule,
    }


def granted_payload(access: GrantedContact) -> dict:
    # `grant_id` is deliberately NOT serialized: it is an internal handle, and
    # nothing a viewer can call takes one.
    #
    # `granted_at` is null on the staff-bypass path (spec §5's staff row), where
    # no grant exists. The key is always present so a client never has to branch
    # on its absence — only on its value.
    return {
        "state": GrantedContact.state,
        "email": access.email,
        "phone": access.phone,
        "website_url": access.website_url,
        "granted_at": _isoformat(access.granted_at) if access.granted_at else None,
    }


def unavailable_payload(access: UnavailableContact) -> dict:
    return {"state": UnavailableContact.state}


def contact_payload(access) -> dict:
    """Spec §16's `{"contact": {...}}` envelope."""
    if isinstance(access, GrantedContact):
        body = granted_payload(access)
    elif isinstance(access, LockedContact):
        body = locked_payload(access)
    elif isinstance(access, UnavailableContact):
        body = unavailable_payload(access)
    else:
        raise TypeError(f"Not a contact access result: {type(access).__name__}")
    return {"contact": body}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && uv run pytest messaging/tests/test_contact_payloads.py -v`
Expected: 9 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/messaging/contact_payloads.py backend/messaging/tests/test_contact_payloads.py
git commit -m "feat(messaging): add locked/granted/unavailable contact payload builders"
```

---

### Task 4: First-reveal marker and the reveal audit event

**Files:**
- Modify: `backend/messaging/models.py` (append one field to `ContactAccessGrant`)
- Modify: `backend/messaging/contact_access.py` (append `record_first_reveal`)
- Create: `backend/messaging/migrations/0005_contactaccessgrant_first_revealed_at.py` (generated by `makemigrations messaging`)
- Test: `backend/messaging/tests/test_contact_reveal_audit.py`

**Interfaces:**
- Consumes: `messaging.models.ContactAccessGrant` (Phase 6); `audit.services.record_audit_event`, `audit.models.AuditEvent` (Phase 2).
- Produces:
  - `messaging.models.ContactAccessGrant.first_revealed_at: DateTimeField(null=True, blank=True)`
  - `messaging.contact_access.record_first_reveal(*, grant_id, actor, request_id=None) -> bool` — `True` exactly once per grant, for the caller whose UPDATE matched; `False` for every caller after.
  - `messaging.contact_access.record_staff_reveal(*, segment, target_id, actor, request_id=None) -> None` — the grant-less staff path's audit, written on **every** such request.
  - Audit actions `"contact_access.revealed"` (on `"messaging.ContactAccessGrant"`) and `"contact_access.staff_revealed"` (on `"brokers.BrokerOrganization"` / `"professionals.ProfessionalProfile"`).

- [ ] **Step 1: Write the failing test**

`backend/messaging/tests/test_contact_reveal_audit.py`:

```python
"""Spec §2.4: "contact reveals … must generate immutable audit events".

The grant row records AUTHORIZATION; this records DELIVERY — once per grant,
not once per request (see the ruling).
"""

import json
import threading

import pytest
from django.db import connection

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from audit.models import AuditEvent
from messaging.contact_access import record_first_reveal, record_staff_reveal
from messaging.models import ContactAccessGrant
from messaging.tests.contact_factories import make_contact_grant
from professionals.tests.factories import make_professional


def build_professional():
    owner = make_user(email="reveal-owner@example.com", role=UserRole.SERVICE_PROVIDER)
    return make_professional(
        owner,
        display_name="Ligurian Refit",
        slug="ligurian-refit",
        public_email="hello@ligurian-refit.example",
        public_phone="+39010777888",
    )


@pytest.mark.django_db
def test_the_first_reveal_stamps_the_column_and_returns_true():
    viewer = make_user(email="reveal-viewer@example.com")
    grant = make_contact_grant(viewer=viewer, professional=build_professional())

    assert record_first_reveal(grant_id=grant.pk, actor=viewer) is True

    grant.refresh_from_db()
    assert grant.first_revealed_at is not None


@pytest.mark.django_db
def test_a_second_reveal_changes_nothing_and_returns_false():
    viewer = make_user(email="reveal-viewer@example.com")
    grant = make_contact_grant(viewer=viewer, professional=build_professional())
    record_first_reveal(grant_id=grant.pk, actor=viewer)
    grant.refresh_from_db()
    stamped = grant.first_revealed_at

    assert record_first_reveal(grant_id=grant.pk, actor=viewer) is False

    grant.refresh_from_db()
    assert grant.first_revealed_at == stamped
    assert AuditEvent.objects.filter(action="contact_access.revealed").count() == 1


@pytest.mark.django_db
def test_the_audit_event_records_who_what_and_when_but_no_contact_value():
    """Spec §33.5: never log private contact values. An AuditEvent is a log."""
    viewer = make_user(email="reveal-viewer@example.com")
    professional = build_professional()
    grant = make_contact_grant(viewer=viewer, professional=professional)

    record_first_reveal(grant_id=grant.pk, actor=viewer, request_id="req-123")

    event = AuditEvent.objects.get(action="contact_access.revealed")
    assert event.actor_user == viewer
    assert event.actor_type == AuditEvent.ActorType.USER
    assert event.source == AuditEvent.Source.API
    assert event.target_type == "messaging.ContactAccessGrant"
    assert event.target_id == str(grant.pk)
    assert event.request_id == "req-123"
    assert event.metadata["target_type"] == "PROFESSIONAL"
    assert event.metadata["target_entity_id"] == str(professional.pk)

    serialized = json.dumps(
        {"before": event.before, "after": event.after, "metadata": event.metadata}
    )
    assert "hello@ligurian-refit.example" not in serialized
    assert "39010777888" not in serialized


@pytest.mark.django_db
def test_a_staff_reveal_is_audited_on_every_request_and_names_no_contact_value():
    """Spec §5's staff row has no grant row to stamp, so this event is written
    every time rather than once (spec §33.1: staff high-impact actions)."""
    from django.contrib.auth.models import Group

    from accounts.enums import StaffGroup

    professional = build_professional()
    moderator = make_user(email="audit-moderator@example.com", role=UserRole.STAFF)
    moderator.groups.add(Group.objects.get(name=StaffGroup.MODERATOR))

    record_staff_reveal(
        segment="professional", target_id=professional.pk, actor=moderator
    )
    record_staff_reveal(
        segment="professional", target_id=professional.pk, actor=moderator
    )

    events = AuditEvent.objects.filter(action="contact_access.staff_revealed")
    assert events.count() == 2
    event = events.first()
    assert event.actor_user == moderator
    assert event.target_type == "professionals.ProfessionalProfile"
    assert event.target_id == str(professional.pk)
    assert event.metadata["target_type"] == "PROFESSIONAL"
    serialized = json.dumps(
        {"before": event.before, "after": event.after, "metadata": event.metadata}
    )
    assert "hello@ligurian-refit.example" not in serialized
    assert "39010777888" not in serialized


@pytest.mark.django_db(transaction=True)
def test_concurrent_first_reveals_produce_exactly_one_audit_event():
    """Spec §16's acceptance list demands exactly-one-despite-duplicates for the
    grant; the reveal marker must hold the same property."""
    viewer = make_user(email="race-viewer@example.com")
    grant = make_contact_grant(viewer=viewer, professional=build_professional())
    results = []

    def attempt():
        try:
            results.append(record_first_reveal(grant_id=grant.pk, actor=viewer))
        finally:
            connection.close()

    threads = [threading.Thread(target=attempt) for _ in range(2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert sorted(results) == [False, True]
    assert AuditEvent.objects.filter(action="contact_access.revealed").count() == 1
    assert ContactAccessGrant.objects.filter(first_revealed_at__isnull=False).count() == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest messaging/tests/test_contact_reveal_audit.py -v`
Expected: FAIL — `ImportError: cannot import name 'record_first_reveal' from 'messaging.contact_access'`.

- [ ] **Step 3: Write minimal implementation**

Append to `ContactAccessGrant` in `backend/messaging/models.py` (read the real class first; put the field beside the other timestamps and reorder nothing):

```python
    # Phase 7 (spec §2.4): when the raw contact values were first DELIVERED to
    # the viewer, as distinct from `granted_at`, which is when access was
    # authorized. Set exactly once, by contact_access.record_first_reveal(),
    # whose conditional UPDATE is also what decides which of two concurrent
    # requests writes the single "contact_access.revealed" audit event.
    first_revealed_at = models.DateTimeField(null=True, blank=True)
```

Append to `backend/messaging/contact_access.py` (consolidate these imports into the module's existing import block):

```python
from django.db import transaction
from django.utils import timezone

from audit.models import AuditEvent
from audit.services import record_audit_event


@transaction.atomic
def record_first_reveal(*, grant_id, actor, request_id=None) -> bool:
    """Stamp `first_revealed_at` and audit the reveal — once per grant.

    Returns True only for the caller whose UPDATE matched, so two concurrent
    first requests produce exactly one audit event. The conditional UPDATE is
    the entire concurrency control: it is one atomic statement, so no row lock,
    no select_for_update and no retry loop is needed.
    """
    now = timezone.now()
    updated = ContactAccessGrant.objects.filter(
        pk=grant_id, first_revealed_at__isnull=True
    ).update(first_revealed_at=now)
    if not updated:
        return False

    grant = ContactAccessGrant.objects.get(pk=grant_id)
    record_audit_event(
        actor_user=actor,
        actor_type=AuditEvent.ActorType.USER,
        action="contact_access.revealed",
        target_type="messaging.ContactAccessGrant",
        target_id=grant.pk,
        source=AuditEvent.Source.API,
        before={"first_revealed_at": None},
        # Spec §30.2's ISO 8601 UTC spelling, the same `.replace("+00:00", "Z")`
        # normalization contact_payloads._isoformat() applies. An audit row is
        # read by people and diffed by tools; two spellings of the same instant
        # in one project is a needless difference.
        after={"first_revealed_at": now.isoformat().replace("+00:00", "Z")},
        # Safe object IDs only (spec §33.5). No email, no phone, no entity name.
        metadata={
            "target_type": grant.target_type,
            "target_entity_id": str(grant.broker_id or grant.professional_id),
        },
        request_id=request_id,
    )
    return True


def record_staff_reveal(*, segment, target_id, actor, request_id=None) -> None:
    """Audit a grant-less staff reveal (spec §5's staff row, §33.1's "staff
    high-impact actions").

    Written on EVERY such request, unlike record_first_reveal's once-per-grant
    rule: there is no grant row to carry a first-reveal stamp, staff reveals are
    rare, and a staff member reading a contact repeatedly is exactly the pattern
    an abuse review needs to see. No contact value is recorded.
    """
    target_type = TARGET_TYPE_BY_SEGMENT[segment]
    record_audit_event(
        actor_user=actor,
        actor_type=AuditEvent.ActorType.USER,
        action="contact_access.staff_revealed",
        target_type=(
            "brokers.BrokerOrganization"
            if target_type == ContactTargetType.BROKER
            else "professionals.ProfessionalProfile"
        ),
        target_id=target_id,
        source=AuditEvent.Source.API,
        before=None,
        after=None,
        metadata={"target_type": str(target_type), "reason": "staff_reveal_any_contact"},
        request_id=request_id,
    )
```

Then generate the migration: `cd backend && uv run python manage.py makemigrations messaging`.

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd backend && uv run python manage.py migrate && uv run pytest messaging/tests/test_contact_reveal_audit.py -v
```
Expected: 5 passed. Then `uv run python manage.py makemigrations --check --dry-run` reports no changes.

- [ ] **Step 5: Commit**

```bash
git add backend/messaging/models.py backend/messaging/contact_access.py backend/messaging/migrations backend/messaging/tests/test_contact_reveal_audit.py
git commit -m "feat(messaging): audit the first delivery of revealed contact details"
```

---

### Task 5: `GET /api/v1/contacts/<target-type>/<id>/`

**Files:**
- Create: `backend/messaging/contact_views.py`
- Modify: `backend/messaging/urls.py` (append one `path`), `backend/config/settings/base.py` (append one throttle rate)
- Test: `backend/messaging/tests/test_contact_api.py`

**Interfaces:**
- Consumes: `messaging.contact_access.{ContactTargetNotFound, GrantedContact, record_first_reveal, resolve_contact_access}` (Tasks 2, 4); `messaging.contact_payloads.contact_payload` (Task 3); `common.middleware.RequestIDMiddleware`'s `request.request_id` (Phase 0/1).
- Consumes also: `messaging.views.MessagingAPIView` (Phase 6 contract rule 11 — reconciliation row 8).
- Produces:
  - `messaging.contact_views.ContactAccessView` — `GET /api/v1/contacts/<target-type>/<id>/`, URL name `contact-access`, extends `MessagingAPIView`, `permission_classes = [AllowAny]`, `throttle_scope = "contact_access"`.
  - `messaging.contact_views.CACHE_CONTROL_HEADER: str`, `messaging.contact_views.VARY_HEADERS: tuple[str, ...]` and `messaging.contact_views.apply_no_store(response) -> response`.
  - Throttle scope `contact_access` = `120/min` in `DEFAULT_THROTTLE_RATES`.

- [ ] **Step 1: Write the failing test**

`backend/messaging/tests/test_contact_api.py`:

```python
"""Spec §30.1's contact endpoint, end to end over HTTP.

Guests reach it: spec §34.5's first browser scenario is "Guest opens
professional, sees locked contact", so AllowAny is a requirement, not a
convenience.
"""

import pytest
from common.throttling import HashedIPScopedRateThrottle
from django.contrib.auth.models import Group
from rest_framework.test import APIClient

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from audit.models import AuditEvent
from messaging.enums import CONTACT_UNLOCK_FLAG
from messaging.enums import UNIFIED_INQUIRIES_FLAG
from messaging.tests.contact_factories import make_contact_grant
from platform_settings.models import FeatureFlag
from professionals.enums import ProfessionalProfileStatus
from professionals.tests.factories import make_professional

pytestmark = pytest.mark.django_db

RAW_EMAIL = "info@tramontana.example"
RAW_PHONE = "+34911223344"


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def unlock_enabled():
    FeatureFlag.objects.update_or_create(
        key=CONTACT_UNLOCK_FLAG,
        defaults={"is_enabled": True, "description": "enabled for this test"},
    )


@pytest.fixture
def professional():
    owner = make_user(email="tramontana-owner@example.com", role=UserRole.SERVICE_PROVIDER)
    return make_professional(
        owner,
        display_name="Tramontana Rigging",
        slug="tramontana-rigging",
        public_email=RAW_EMAIL,
        public_phone=RAW_PHONE,
    )


def url(professional):
    return f"/api/v1/contacts/professional/{professional.pk}/"


def assert_no_store(response):
    """Spec §16: this payload must never be cached by anything.

    `Vary` is compared as a SET, never for string equality: corsheaders'
    CorsMiddleware runs after the view and calls
    `patch_vary_headers(response, ("origin",))` unconditionally for every URL
    (its CORS_URLS_REGEX defaults to `^.*$`, and the middleware is installed in
    config/settings/base.py), so the header this project actually emits is
    "Authorization, Cookie, origin". An equality assertion here would fail on
    every single response — and would fail for a reason that has nothing to do
    with what it is trying to prove.
    """
    assert response["Cache-Control"] == "private, no-store, max-age=0"
    vary = {part.strip().lower() for part in response["Vary"].split(",")}
    assert {"authorization", "cookie"} <= vary


def test_a_guest_receives_the_locked_payload(api, professional, unlock_enabled):
    response = api.get(url(professional))

    assert response.status_code == 200
    assert response.data == {
        "contact": {
            "state": "LOCKED",
            "email_mask": "i••••@tramontana.example",
            "phone_mask": "+34 ••• ••• ••4",
            "unlock_rule": "SEND_INQUIRY",
        }
    }


def test_a_grant_holder_receives_the_real_values(api, professional, unlock_enabled):
    viewer = make_user(email="grant-holder@example.com")
    make_contact_grant(viewer=viewer, professional=professional)
    api.force_authenticate(viewer)

    response = api.get(url(professional))

    assert response.status_code == 200
    assert response.data["contact"]["state"] == "GRANTED"
    assert response.data["contact"]["email"] == RAW_EMAIL
    assert response.data["contact"]["phone"] == RAW_PHONE
    assert response.data["contact"]["granted_at"].endswith("Z")


def test_the_first_granted_response_audits_the_reveal_exactly_once(
    api, professional, unlock_enabled
):
    viewer = make_user(email="grant-holder@example.com")
    make_contact_grant(viewer=viewer, professional=professional)
    api.force_authenticate(viewer)

    api.get(url(professional))
    api.get(url(professional))

    assert AuditEvent.objects.filter(action="contact_access.revealed").count() == 1


def test_a_staff_moderator_reveals_over_http_and_is_audited_every_time(
    api, professional, unlock_enabled
):
    """Spec §5's staff row. accounts/selectors.py already reports
    `reveal_any_contact` to staff on GET /api/v1/session/, so this endpoint has
    to honour it."""
    moderator = make_user(email="api-moderator@example.com", role=UserRole.STAFF)
    moderator.groups.add(Group.objects.get(name=StaffGroup.MODERATOR))
    api.force_authenticate(moderator)

    first = api.get(url(professional))
    api.get(url(professional))

    assert first.data["contact"]["state"] == "GRANTED"
    assert first.data["contact"]["email"] == RAW_EMAIL
    assert first.data["contact"]["granted_at"] is None
    assert AuditEvent.objects.filter(action="contact_access.staff_revealed").count() == 2
    assert AuditEvent.objects.filter(action="contact_access.revealed").count() == 0


@pytest.mark.parametrize("flag_enabled", [True, False])
def test_the_flag_state_changes_the_answer_but_never_the_status_code(
    api, professional, flag_enabled
):
    """Phase 6 contract rule 11a's property, in this phase's own terms.

    Rule 11a orders a flag gate FIRST in `permission_classes` so that a
    switched-off feature names one reason for everyone rather than 401 for the
    signed-out and 403 for the signed-in. This view has **no flag gate in
    `permission_classes` at all** — `contact_unlock` is evaluated inside
    `resolve_contact_access`, and it only ever closes the reveal — so the
    property worth pinning is the stronger one: the flag changes the CONTENT and
    never the status code, nor who is allowed to ask.

    Three callers who would each fail a different gate on a flag-gated endpoint —
    anonymous, deactivated, and an eligible grant holder — must all get 200 in
    both flag states. If anybody ever "fixes" this view by adding a flag gate to
    `permission_classes`, exactly one of these flips to 401 or 403 and this test
    says which.
    """
    FeatureFlag.objects.update_or_create(
        key=CONTACT_UNLOCK_FLAG,
        defaults={"is_enabled": flag_enabled, "description": "ordering check"},
    )
    holder = make_user(email="order-holder@example.com")
    make_contact_grant(viewer=holder, professional=professional)
    deactivated = make_user(email="order-inactive@example.com", is_active=False)

    statuses = set()
    for caller in (None, deactivated, holder):
        api.force_authenticate(caller)
        response = api.get(url(professional))
        statuses.add(response.status_code)
        assert_no_store(response)

    assert statuses == {200}

    api.force_authenticate(holder)
    assert api.get(url(professional)).data["contact"]["state"] == (
        "GRANTED" if flag_enabled else "LOCKED"
    )


def test_the_endpoint_still_answers_when_unified_inquiries_is_off(
    api, professional, unlock_enabled
):
    """Deliberate divergence from Phase 6 contract rule 14 (see the ruling): with
    inquiries paused, the panel must still render LOCKED with its explanation,
    and an existing grant holder must not lose a contact they already unlocked.
    A 403 `feature_disabled` here would break spec §14.2 and §2.1."""
    FeatureFlag.objects.update_or_create(
        key=UNIFIED_INQUIRIES_FLAG,
        defaults={"is_enabled": False, "description": "paused for this test"},
    )
    viewer = make_user(email="paused-grant-holder@example.com")
    make_contact_grant(viewer=viewer, professional=professional)

    guest = api.get(url(professional))
    api.force_authenticate(viewer)
    holder = api.get(url(professional))

    assert guest.status_code == 200
    assert guest.data["contact"]["state"] == "LOCKED"
    assert holder.data["contact"]["state"] == "GRANTED"


def test_a_suspended_entity_answers_unavailable(api, professional, unlock_enabled):
    professional.status = ProfessionalProfileStatus.SUSPENDED
    professional.save(update_fields=["status", "updated_at"])

    response = api.get(url(professional))

    assert response.status_code == 200
    assert response.data == {"contact": {"state": "UNAVAILABLE"}}


def test_a_never_public_entity_is_a_404_envelope(api, professional, unlock_enabled):
    professional.status = ProfessionalProfileStatus.DRAFT
    professional.save(update_fields=["status", "updated_at"])

    response = api.get(url(professional))

    assert response.status_code == 404
    assert response.data["error"]["code"] == "not_found"
    assert response.data["error"]["request_id"]
    assert response["X-Request-ID"]


def test_an_unknown_id_is_a_404(api, unlock_enabled):
    response = api.get("/api/v1/contacts/professional/11111111-1111-4111-8111-111111111111/")

    assert response.status_code == 404


def test_an_unknown_target_type_segment_is_a_404(api, professional, unlock_enabled):
    response = api.get(f"/api/v1/contacts/listing/{professional.pk}/")

    assert response.status_code == 404


def test_a_non_uuid_id_does_not_reach_the_view(api, unlock_enabled):
    """The URL converter is <uuid:...>, so a junk id is a routing 404 and never
    becomes a database error."""
    assert api.get("/api/v1/contacts/professional/not-a-uuid/").status_code == 404


def test_the_endpoint_is_rate_limited_in_spec_15_5s_vocabulary(
    api, professional, unlock_enabled, monkeypatch
):
    # Overriding settings.REST_FRAMEWORK would NOT work: DRF binds
    # SimpleRateThrottle.THROTTLE_RATES once from api_settings at import time.
    # Monkeypatching the scope entry is the pattern this repo already uses
    # (services_catalog/tests/test_service_category_api.py). `backend/conftest.py`
    # has already emptied this checkout's throttle keys — since f8384d8 it
    # deletes only the keys under this worktree's `CACHES["default"]["KEY_PREFIX"]`
    # rather than flushing the shared Redis DB, so a parallel worktree's suite is
    # unaffected and so is this one.
    monkeypatch.setitem(
        HashedIPScopedRateThrottle.THROTTLE_RATES, "contact_access", "2/min"
    )
    api.get(url(professional))
    api.get(url(professional))

    response = api.get(url(professional))

    assert response.status_code == 429
    # MessagingAPIView.throttled() raises MessagingThrottled, so the code is
    # `rate_limited`, not DRF's `throttled` (Phase 6 contract rule 11).
    assert response.data["error"]["code"] == "rate_limited"
    assert RAW_EMAIL not in response.content.decode()


@pytest.mark.parametrize(
    "prepare",
    [
        pytest.param(lambda professional: None, id="guest-locked"),
        pytest.param(
            lambda professional: professional.__class__.objects.filter(
                pk=professional.pk
            ).update(status=ProfessionalProfileStatus.SUSPENDED),
            id="unavailable",
        ),
        pytest.param(
            lambda professional: professional.__class__.objects.filter(
                pk=professional.pk
            ).update(status=ProfessionalProfileStatus.DRAFT),
            id="not-found",
        ),
    ],
)
def test_every_response_path_forbids_caching(api, professional, unlock_enabled, prepare):
    """Spec §16: contact data is never public. The same URL answers LOCKED to
    one viewer and GRANTED to the next, and the browser client sends
    credentials, so a shared or browser cache is a real disclosure path."""
    prepare(professional)

    assert_no_store(api.get(url(professional)))


def test_the_granted_response_forbids_caching_too(api, professional, unlock_enabled):
    viewer = make_user(email="grant-holder@example.com")
    make_contact_grant(viewer=viewer, professional=professional)
    api.force_authenticate(viewer)

    response = api.get(url(professional))

    assert response.data["contact"]["state"] == "GRANTED"
    assert_no_store(response)


def test_the_429_response_forbids_caching_too(
    api, professional, unlock_enabled, monkeypatch
):
    monkeypatch.setitem(
        HashedIPScopedRateThrottle.THROTTLE_RATES, "contact_access", "1/min"
    )
    api.get(url(professional))

    response = api.get(url(professional))

    assert response.status_code == 429
    assert_no_store(response)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest messaging/tests/test_contact_api.py -v`
Expected: FAIL — every request 404s because no `contacts/` route is registered yet.

- [ ] **Step 3: Write minimal implementation**

`backend/messaging/contact_views.py`:

```python
"""Spec §30.1: GET /api/v1/contacts/<target-type>/<id>/.

The view holds no rules. It resolves, records the first reveal, and serializes
— everything else is in contact_access.py, so the same decision is reachable
from a test, a management command or another view without going through HTTP.
"""

from django.utils.cache import patch_vary_headers
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from messaging.views import MessagingAPIView

from .contact_access import (
    ContactTargetNotFound,
    GrantedContact,
    record_first_reveal,
    record_staff_reveal,
    resolve_contact_access,
)
from .contact_payloads import contact_payload

#: Spec §16: contact data is never public. This URL returns LOCKED to one viewer
#: and GRANTED to the next, discriminated only by the Authorization header, and
#: the browser client sends `credentials: "include"` — so a shared cache (a CDN,
#: a corporate proxy, the browser's own HTTP cache after a logout) is a real
#: cross-viewer disclosure path. Nothing else in this codebase sets a cache
#: header, so nothing else would stop it.
CACHE_CONTROL_HEADER = "private, no-store, max-age=0"
VARY_HEADERS = ("Authorization", "Cookie")


def apply_no_store(response):
    """Stamp the no-store headers on ANY response object, success or error.

    `patch_vary_headers`, not `response["Vary"] = ...`: assignment would discard
    whatever is already there, and something already is — corsheaders'
    CorsMiddleware adds `origin` to every response in this project, and Django's
    SessionMiddleware adds `Cookie` when a session is touched. Patching merges;
    assigning would silently drop another middleware's correctness fix. The
    emitted header therefore ends up as "Authorization, Cookie, origin", which
    is why every assertion in this phase compares `Vary` as a set.
    """
    response["Cache-Control"] = CACHE_CONTROL_HEADER
    patch_vary_headers(response, VARY_HEADERS)
    return response


class ContactAccessView(MessagingAPIView):
    """Extends MessagingAPIView, not APIView (Phase 6 contract rule 11), so a
    throttled caller gets `rate_limited` rather than DRF's `throttled`.

    **Phase 6 contract rule 11a — "the flag gate goes FIRST in
    permission_classes" — is satisfied here by there being no flag gate to
    order.** That is a decision, not an omission, and it is the one place this
    phase deliberately diverges from a Phase 6 rule:

    * `unified_inquiries` does not gate this view. With inquiries paused, spec
      §14.2 still requires a contact panel and spec §2.1 still requires it to
      have a backend source; `403 feature_disabled` would replace an honest
      LOCKED state with an error, and would strip an existing grant holder of a
      contact they legitimately unlocked.
    * `contact_unlock` does not gate it either, because that flag's semantics
      are narrower than a rollout gate's: it only ever CLOSES the reveal. Flag
      off means everyone sees LOCKED — the fail-closed direction — not that the
      endpoint disappears.

    So the flag changes the payload and never the status code or who may ask,
    which `test_the_flag_state_changes_the_answer_but_never_the_status_code` is
    the standing guard for. A future contact endpoint that *is* rollout-gated
    puts its gate first, exactly as rule 11a says.
    """

    # AllowAny is deliberate and required: spec §34.5's browser scenario starts
    # with a GUEST seeing the locked contact panel. The endpoint never reveals
    # anything to an unauthenticated caller — resolve_contact_access() returns
    # LockedContact for them — so "public" here means "public masked values".
    permission_classes = [AllowAny]
    throttle_scope = "contact_access"

    def finalize_response(self, request, response, *args, **kwargs):
        """The ONE place the headers are applied, so no response path can miss
        them. DRF routes every outcome through here — the three 200 states and
        the 401/404/429 envelopes the exception handler produced alike."""
        response = super().finalize_response(request, response, *args, **kwargs)
        return apply_no_store(response)

    def get(self, request, target_type, target_id):
        try:
            access = resolve_contact_access(
                viewer=request.user, segment=target_type, target_id=target_id
            )
        except ContactTargetNotFound:
            # 404, never 403: a DRAFT/PENDING entity's existence is not
            # disclosed. The envelope carries no entity name either.
            raise NotFound()

        if isinstance(access, GrantedContact):
            request_id = getattr(request, "request_id", "") or None
            if access.grant_id is not None:
                record_first_reveal(
                    grant_id=access.grant_id,
                    actor=request.user,
                    request_id=request_id,
                )
            else:
                # No grant: this is spec §5's staff reveal, which has no row to
                # stamp and is therefore audited on every request.
                record_staff_reveal(
                    segment=target_type,
                    target_id=target_id,
                    actor=request.user,
                    request_id=request_id,
                )

        return Response(contact_payload(access))
```

`finalize_response` rather than stamping each `Response`: DRF calls it for **every** outcome of `dispatch()`, including the responses its exception handler built for `NotFound`, `MessagingThrottled` and `NotAuthenticated`. Setting the headers on the `Response` objects returned from `get()` would cover the 200s only — and the 404 body, which tells an attacker that an id is not publicly reachable, is exactly as cacheable-by-mistake as the rest.

Append to `backend/messaging/urls.py`'s existing `urlpatterns` (read the real file; add only this entry):

```python
    path(
        "contacts/<str:target_type>/<uuid:target_id>/",
        ContactAccessView.as_view(),
        name="contact-access",
    ),
```

with `from .contact_views import ContactAccessView` added to the module's imports. `<str:target_type>` rather than a regex of the two valid segments: an unknown segment must produce the same 404 envelope as an unknown id, not a routing 404 with a different body, and `TARGET_TYPE_BY_SEGMENT` is already the single source of truth for which segments exist.

Append one entry to `REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]` in `backend/config/settings/base.py` (append inside the existing dict; reorder nothing):

```python
        # Phase 7, spec §30.4. Looser than `services_directory` because the
        # contact panel fetches once per profile view AND again after a
        # successful inquiry, on top of the page's own directory calls.
        "contact_access": "120/min",
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && uv run pytest messaging/tests/test_contact_api.py -v`
Expected: 18 passed — 15 test functions, of which one is a three-case parametrize and one a two-case parametrize.

- [ ] **Step 5: Commit**

```bash
git add backend/messaging/contact_views.py backend/messaging/urls.py backend/config/settings/base.py backend/messaging/tests/test_contact_api.py
git commit -m "feat(messaging): serve the locked/granted contact payload over the API"
```

---

### Task 6: Staff revocation of a contact access grant

**Files:**
- Modify: `backend/messaging/contact_access.py` (append `ContactGrantAlreadyRevoked`, `revoke_contact_access`), `backend/messaging/contact_payloads.py` (append `staff_grant_payload`), `backend/messaging/contact_views.py` (append the serializer, the 409 exception and the view), `backend/messaging/urls.py` (append one `path`), `backend/config/settings/base.py` (append one throttle rate)
- Test: `backend/messaging/tests/test_contact_revocation.py`

**Interfaces:**
- Consumes: `accounts.permissions.{IsActiveUser, IsStaffModerator}` (Phase 3); `messaging.views.MessagingAPIView` (Phase 6 contract rule 11); `messaging.contact_views.apply_no_store` (Task 5); `audit.services.record_audit_event`; Task 2's model access.
- Produces:
  - `messaging.contact_access.ContactGrantAlreadyRevoked(Exception)`
  - `messaging.contact_access.revoke_contact_access(*, grant_id, actor, reason, request_id=None) -> ContactAccessGrant`
  - `messaging.contact_payloads.staff_grant_payload(grant) -> dict`
  - `messaging.contact_views.{StaffContactGrantRevokeSerializer, ContactGrantStateConflict, StaffContactGrantRevokeView}` — `POST /api/v1/staff/contact-grants/<id>/revoke/`, URL name `staff-contact-grant-revoke`.
  - Audit action `"contact_access.revoked"`; error code `invalid_grant_state` (409).
  - Throttle scope `contact_grant_admin` = `30/min`.

- [ ] **Step 1: Write the failing test**

`backend/messaging/tests/test_contact_revocation.py`:

```python
"""Spec §16: "Staff can revoke grants for abuse"; spec §36.6 makes revocation
the default remedy when a recipient blocks a user."""

import json

import pytest
from django.contrib.auth.models import Group
from rest_framework.test import APIClient

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from audit.models import AuditEvent
from messaging.enums import CONTACT_UNLOCK_FLAG
from messaging.tests.contact_factories import make_contact_grant
from platform_settings.models import FeatureFlag
from professionals.tests.factories import make_professional

pytestmark = pytest.mark.django_db

RAW_EMAIL = "info@ponente-marine.example"
RAW_PHONE = "+34655443322"


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def unlock_enabled():
    FeatureFlag.objects.update_or_create(
        key=CONTACT_UNLOCK_FLAG,
        defaults={"is_enabled": True, "description": "enabled for this test"},
    )


@pytest.fixture
def professional():
    owner = make_user(email="ponente-owner@example.com", role=UserRole.SERVICE_PROVIDER)
    return make_professional(
        owner,
        display_name="Ponente Marine",
        slug="ponente-marine",
        public_email=RAW_EMAIL,
        public_phone=RAW_PHONE,
    )


@pytest.fixture
def viewer():
    return make_user(email="abusive-viewer@example.com")


@pytest.fixture
def moderator():
    user = make_user(email="moderator@example.com", role=UserRole.STAFF)
    user.groups.add(Group.objects.get(name=StaffGroup.MODERATOR))
    return user


def revoke_url(grant):
    return f"/api/v1/staff/contact-grants/{grant.pk}/revoke/"


def test_a_moderator_revokes_and_gets_the_updated_grant_back(
    api, viewer, professional, moderator, unlock_enabled
):
    grant = make_contact_grant(viewer=viewer, professional=professional)
    api.force_authenticate(moderator)

    response = api.post(revoke_url(grant), {"reason": "Harassment report #22"}, format="json")

    assert response.status_code == 200
    assert response.data["grant"]["id"] == str(grant.pk)
    assert response.data["grant"]["revoked_at"].endswith("Z")
    grant.refresh_from_db()
    assert grant.revoked_at is not None


def test_revocation_re_locks_the_contact_for_that_viewer(
    api, viewer, professional, moderator, unlock_enabled
):
    grant = make_contact_grant(viewer=viewer, professional=professional)
    api.force_authenticate(moderator)
    api.post(revoke_url(grant), {"reason": "Abuse"}, format="json")

    api.force_authenticate(viewer)
    response = api.get(f"/api/v1/contacts/professional/{professional.pk}/")

    assert response.data["contact"]["state"] == "LOCKED"
    assert RAW_EMAIL not in response.content.decode()


def test_the_revocation_is_audited_with_the_reason_and_no_contact_value(
    api, viewer, professional, moderator, unlock_enabled
):
    grant = make_contact_grant(viewer=viewer, professional=professional)
    api.force_authenticate(moderator)

    api.post(revoke_url(grant), {"reason": "Harassment report #22"}, format="json")

    event = AuditEvent.objects.get(action="contact_access.revoked")
    assert event.actor_user == moderator
    assert event.source == AuditEvent.Source.ADMIN
    assert event.target_id == str(grant.pk)
    assert event.metadata["reason"] == "Harassment report #22"
    assert event.metadata["viewer_id"] == str(viewer.pk)
    serialized = json.dumps(
        {"before": event.before, "after": event.after, "metadata": event.metadata}
    )
    assert RAW_EMAIL not in serialized
    assert "655443322" not in serialized


def test_a_reason_is_required(api, viewer, professional, moderator, unlock_enabled):
    """§36.6 frames revocation as an abuse remedy; an unexplained one is not
    auditable."""
    grant = make_contact_grant(viewer=viewer, professional=professional)
    api.force_authenticate(moderator)

    response = api.post(revoke_url(grant), {"reason": "   "}, format="json")

    assert response.status_code == 400
    assert response.data["error"]["code"] == "validation_error"
    assert "reason" in response.data["error"]["fields"]
    grant.refresh_from_db()
    assert grant.revoked_at is None


def test_revoking_twice_is_a_409_rather_than_a_silent_success(
    api, viewer, professional, moderator, unlock_enabled
):
    grant = make_contact_grant(viewer=viewer, professional=professional)
    api.force_authenticate(moderator)
    api.post(revoke_url(grant), {"reason": "Abuse"}, format="json")

    response = api.post(revoke_url(grant), {"reason": "Abuse again"}, format="json")

    assert response.status_code == 409
    assert response.data["error"]["code"] == "invalid_grant_state"
    assert AuditEvent.objects.filter(action="contact_access.revoked").count() == 1


def test_an_ordinary_user_cannot_revoke(api, viewer, professional, unlock_enabled):
    grant = make_contact_grant(viewer=viewer, professional=professional)
    api.force_authenticate(viewer)

    response = api.post(revoke_url(grant), {"reason": "let me in"}, format="json")

    assert response.status_code == 403
    grant.refresh_from_db()
    assert grant.revoked_at is None


def test_an_anonymous_request_cannot_revoke(api, viewer, professional, unlock_enabled):
    """401 `authentication_required`, not DRF's `not_authenticated`: the view
    extends MessagingAPIView (Phase 6 contract rule 11)."""
    grant = make_contact_grant(viewer=viewer, professional=professional)

    response = api.post(revoke_url(grant), {"reason": "let me in"}, format="json")

    assert response.status_code == 401
    assert response.data["error"]["code"] == "authentication_required"
    grant.refresh_from_db()
    assert grant.revoked_at is None


def test_the_revoke_response_forbids_caching(
    api, viewer, professional, moderator, unlock_enabled
):
    grant = make_contact_grant(viewer=viewer, professional=professional)
    api.force_authenticate(moderator)

    response = api.post(revoke_url(grant), {"reason": "Abuse"}, format="json")

    assert response["Cache-Control"] == "private, no-store, max-age=0"


def test_revocation_still_works_when_the_reveal_flag_is_off(
    api, viewer, professional, moderator
):
    """No `unlock_enabled` fixture: this view has no flag gate in
    `permission_classes`, deliberately (see the ruling). Revocation is an abuse
    remedy, and the moment reveals are paused is the worst possible moment for
    the remedy to 403. Phase 6 contract rule 11a orders a flag gate first where
    one exists; here the right answer is that none exists."""
    grant = make_contact_grant(viewer=viewer, professional=professional)
    api.force_authenticate(moderator)

    response = api.post(revoke_url(grant), {"reason": "Abuse"}, format="json")

    assert response.status_code == 200
    grant.refresh_from_db()
    assert grant.revoked_at is not None


def test_an_unknown_grant_is_a_404(api, moderator, unlock_enabled):
    api.force_authenticate(moderator)

    response = api.post(
        "/api/v1/staff/contact-grants/11111111-1111-4111-8111-111111111111/revoke/",
        {"reason": "Abuse"},
        format="json",
    )

    assert response.status_code == 404
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest messaging/tests/test_contact_revocation.py -v`
Expected: FAIL — the revoke route does not exist, so every POST 404s.

- [ ] **Step 3: Write minimal implementation**

Append to `backend/messaging/contact_access.py`:

```python
class ContactGrantAlreadyRevoked(Exception):
    """The grant is already revoked; re-revoking is a conflict, not a no-op."""


@transaction.atomic
def revoke_contact_access(*, grant_id, actor, reason, request_id=None) -> ContactAccessGrant:
    """Spec §16's staff remedy, and §36.6's default response to a block.

    Raises ContactAccessGrant.DoesNotExist for an unknown id (the view renders
    404) and ContactGrantAlreadyRevoked for a second attempt (409). The row is
    locked for the check-then-act so two moderators cannot both write a
    revocation event for the same grant.
    """
    grant = ContactAccessGrant.objects.select_for_update().get(pk=grant_id)
    if grant.revoked_at is not None:
        raise ContactGrantAlreadyRevoked(str(grant_id))

    now = timezone.now()
    grant.revoked_at = now
    # Drop "updated_at" from update_fields if Phase 6's ContactAccessGrant does
    # not inherit common.models.UUIDTimeStampedModel (reconciliation row 2).
    grant.save(update_fields=["revoked_at", "updated_at"])

    record_audit_event(
        actor_user=actor,
        actor_type=AuditEvent.ActorType.USER,
        action="contact_access.revoked",
        target_type="messaging.ContactAccessGrant",
        target_id=grant.pk,
        source=AuditEvent.Source.ADMIN,
        before={"revoked_at": None},
        # Same ISO 8601 UTC normalization as record_first_reveal above.
        after={"revoked_at": now.isoformat().replace("+00:00", "Z")},
        # Safe object IDs and the staff-supplied reason. No contact value, no
        # entity name, no viewer email (spec §33.5).
        metadata={
            "target_type": grant.target_type,
            "target_entity_id": str(grant.broker_id or grant.professional_id),
            "viewer_id": str(grant.viewer_id),
            "reason": reason,
        },
        request_id=request_id,
    )
    return grant
```

Append to `backend/messaging/contact_payloads.py`:

```python
def staff_grant_payload(grant) -> dict:
    """Spec §30.2: "Mutations return updated resource".

    Safe object IDs only — no contact value, no entity name and not the
    viewer's email address, because a moderator does not need one to act and
    this body is logged by every proxy in front of the API.
    """
    return {
        "grant": {
            "id": str(grant.pk),
            "target_type": grant.target_type,
            "target_entity_id": str(grant.broker_id or grant.professional_id),
            "viewer_id": str(grant.viewer_id),
            "granted_at": _isoformat(grant.granted_at),
            "revoked_at": _isoformat(grant.revoked_at) if grant.revoked_at else None,
        }
    }
```

Append to `backend/messaging/contact_views.py` (consolidate the imports):

```python
from rest_framework import serializers, status
from rest_framework.exceptions import APIException

from accounts.permissions import IsActiveUser, IsStaffModerator

from .contact_access import ContactGrantAlreadyRevoked, revoke_contact_access
from .contact_payloads import staff_grant_payload
from .models import ContactAccessGrant
# `apply_no_store` and `MessagingAPIView` are already imported at the top of
# this module by Task 5.


class ContactGrantStateConflict(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "This contact access grant is no longer active."
    default_code = "invalid_grant_state"


class StaffContactGrantRevokeSerializer(serializers.Serializer):
    # trim_whitespace + allow_blank=False together reject "   ".
    reason = serializers.CharField(max_length=500, allow_blank=False, trim_whitespace=True)


class StaffContactGrantRevokeView(MessagingAPIView):
    """Extends MessagingAPIView for the same reason the read view does: an
    anonymous caller must hear `authentication_required`, not DRF's
    `not_authenticated` (Phase 6 contract rule 11).

    No flag gate here either (rule 11a), and for a sharper reason than on the
    read view: revocation is spec §16's abuse remedy, and the moment a feature
    is switched off is exactly when an operator is most likely to be
    firefighting. `test_revocation_still_works_when_the_reveal_flag_is_off`
    pins it.
    """

    permission_classes = [IsActiveUser, IsStaffModerator]
    throttle_scope = "contact_grant_admin"

    def finalize_response(self, request, response, *args, **kwargs):
        # The body carries a viewer id and grant timestamps. It is not contact
        # data, but it is per-staff-actor and has no business in any cache.
        response = super().finalize_response(request, response, *args, **kwargs)
        return apply_no_store(response)

    def post(self, request, grant_id):
        serializer = StaffContactGrantRevokeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            grant = revoke_contact_access(
                grant_id=grant_id,
                actor=request.user,
                reason=serializer.validated_data["reason"],
                request_id=getattr(request, "request_id", "") or None,
            )
        except ContactAccessGrant.DoesNotExist:
            raise NotFound()
        except ContactGrantAlreadyRevoked:
            raise ContactGrantStateConflict()
        return Response(staff_grant_payload(grant))
```

Append to `backend/messaging/urls.py`:

```python
    path(
        "staff/contact-grants/<uuid:grant_id>/revoke/",
        StaffContactGrantRevokeView.as_view(),
        name="staff-contact-grant-revoke",
    ),
```

Append one entry to `DEFAULT_THROTTLE_RATES` in `backend/config/settings/base.py`:

```python
        # Phase 7, spec §30.4. A staff remedy, used a handful of times a day.
        "contact_grant_admin": "30/min",
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && uv run pytest messaging/tests/test_contact_revocation.py -v`
Expected: 10 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/messaging backend/config/settings/base.py
git commit -m "feat(messaging): let staff revoke a contact access grant, audited"
```

---

### Task 7: Adversarial leak sweep

**Files:**
- Test: `backend/messaging/tests/test_contact_leak_sweep.py` (new; no production code changes expected)

**Interfaces:**
- Consumes: everything Tasks 1–6 produced, plus `services_catalog.serializers.{ProfessionalCardSerializer, ProfessionalDetailSerializer}` (Phase 5) and `listings.tests.factories.{make_broker_listing, make_snapshot}` + the `listing-list` / `listing-detail` routes (Phase 11) — read-only, to prove the public listing surface carries no broker contact data.
- Produces: no new symbols. This task's deliverable is the standing proof of spec §34.3 ("Locked contact response contains no raw contact value"), §34.7 ("Raw contact data is absent from unauthorized responses/DOM") and §33.5 (logs).

**If any test in this task fails, the fix belongs in the module that leaked, not in the test.** A leak found here is a Critical finding, not a test bug.

- [ ] **Step 1: Write the failing test**

`backend/messaging/tests/test_contact_leak_sweep.py`:

```python
"""One file that tries, from every angle available to an unauthorized caller,
to obtain a raw contact value.

Spec §34.7's release checklist item — "Raw contact data is absent from
unauthorized responses/DOM" — and §34.3's "Locked contact response contains no
raw contact value". Every assertion scans the RENDERED BYTES, not the parsed
dict, so a value hidden in an unexpected key still fails the test. Both target
kinds are covered end to end, because the broker path has no frontend surface
yet and would otherwise be the one nobody exercises.
"""

import logging

import pytest
from common.throttling import HashedIPScopedRateThrottle
from django.contrib.auth.models import Group
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from brokers.enums import BrokerOrganizationStatus
from brokers.tests.factories import make_broker
from listings.enums import ListingStatus
from listings.tests.factories import make_broker_listing, make_snapshot
from messaging.enums import CONTACT_UNLOCK_FLAG
from messaging.tests.contact_factories import make_contact_grant
from platform_settings.models import FeatureFlag
from professionals.enums import ProfessionalProfileStatus
from professionals.tests.factories import make_professional
from services_catalog.serializers import (
    ProfessionalCardSerializer,
    ProfessionalDetailSerializer,
)

pytestmark = pytest.mark.django_db

PRO_EMAIL = "confidential@secret-yard.example"
PRO_PHONE = "+34612345678"
PRO_WEBSITE = "https://secret-yard.example"
BROKER_EMAIL = "backoffice@hidden-brokerage.example"
BROKER_PHONE = "+34655000111"

#: Digit runs are checked without the "+" and separators too: a leak that
#: reformatted the number would otherwise slip past a whole-string check.
SECRETS = (
    PRO_EMAIL,
    PRO_PHONE,
    "612345678",
    PRO_WEBSITE,
    BROKER_EMAIL,
    BROKER_PHONE,
    "655000111",
)


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def unlock_enabled():
    FeatureFlag.objects.update_or_create(
        key=CONTACT_UNLOCK_FLAG,
        defaults={"is_enabled": True, "description": "enabled for this test"},
    )


@pytest.fixture
def professional():
    owner = make_user(email="secret-yard-owner@example.com", role=UserRole.SERVICE_PROVIDER)
    return make_professional(
        owner,
        display_name="Secret Yard",
        slug="secret-yard",
        public_email=PRO_EMAIL,
        public_phone=PRO_PHONE,
        website_url=PRO_WEBSITE,
    )


@pytest.fixture
def broker():
    return make_broker(
        name="Hidden Brokerage",
        slug="hidden-brokerage",
        public_email=BROKER_EMAIL,
        public_phone=BROKER_PHONE,
    )


@pytest.fixture
def moderator():
    user = make_user(email="sweep-moderator@example.com", role=UserRole.STAFF)
    user.groups.add(Group.objects.get(name=StaffGroup.MODERATOR))
    return user


def published_broker_listing(broker):
    """A live public listing owned by `broker` — the surface Phase 20 will mount
    the panel on, and the one most likely to grow a contact field by accident."""
    staff = make_user(email="sweep-approver@example.com", role=UserRole.STAFF)
    listing = make_broker_listing(
        broker=broker, actor=staff, status=ListingStatus.PUBLISHED
    )
    snapshot = make_snapshot(listing, approved_by=staff)
    listing.current_public_snapshot = snapshot
    listing.published_at = timezone.now()
    listing.save(update_fields=["current_public_snapshot", "published_at"])
    return listing


def assert_clean(response):
    """No secret of EITHER entity appears anywhere in the rendered bytes."""
    body = response.content.decode()
    for secret in SECRETS:
        assert secret not in body, f"{secret!r} leaked into a {response.status_code} body"


def assert_private(response):
    """Spec §16: this payload must never be cached by anything.

    `Vary` is compared as a SET: corsheaders' CorsMiddleware appends "origin" to
    it on every response (`patch_vary_headers(response, ("origin",))`, with
    CORS_URLS_REGEX defaulting to `^.*$`), so the emitted header is
    "Authorization, Cookie, origin". What matters is that both names this phase
    needs are present, not that nothing else added one.
    """
    assert response["Cache-Control"] == "private, no-store, max-age=0"
    vary = {part.strip().lower() for part in response["Vary"].split(",")}
    assert {"authorization", "cookie"} <= vary


def contact_url(target_type, entity):
    return f"/api/v1/contacts/{target_type}/{entity.pk}/"


# --------------------------------------------------------------------------
# The professional path
# --------------------------------------------------------------------------


def test_the_guest_locked_response_leaks_nothing(api, professional, unlock_enabled):
    response = api.get(contact_url("professional", professional))

    assert_clean(response)
    assert_private(response)


def test_a_signed_in_viewer_without_a_grant_leaks_nothing(
    api, professional, unlock_enabled
):
    api.force_authenticate(make_user(email="nosy@example.com"))

    assert_clean(api.get(contact_url("professional", professional)))


def test_a_revoked_grant_leaks_nothing(api, professional, unlock_enabled):
    viewer = make_user(email="revoked@example.com")
    make_contact_grant(
        viewer=viewer, professional=professional, revoked_at=timezone.now()
    )
    api.force_authenticate(viewer)

    assert_clean(api.get(contact_url("professional", professional)))


def test_a_grant_for_a_different_entity_leaks_nothing(
    api, professional, broker, unlock_enabled
):
    viewer = make_user(email="other-grant@example.com")
    make_contact_grant(viewer=viewer, broker=broker)
    api.force_authenticate(viewer)

    response = api.get(contact_url("professional", professional))

    assert response.data["contact"]["state"] == "LOCKED"
    assert_clean(response)


def test_with_the_flag_off_even_a_grant_holder_gets_nothing(api, professional):
    viewer = make_user(email="early-bird@example.com")
    make_contact_grant(viewer=viewer, professional=professional)
    api.force_authenticate(viewer)

    response = api.get(contact_url("professional", professional))

    assert response.data["contact"]["state"] == "LOCKED"
    assert_clean(response)


def test_a_suspended_entity_leaks_nothing_to_its_own_grant_holder(
    api, professional, unlock_enabled
):
    viewer = make_user(email="held-grant@example.com")
    make_contact_grant(viewer=viewer, professional=professional)
    professional.status = ProfessionalProfileStatus.SUSPENDED
    professional.save(update_fields=["status", "updated_at"])
    api.force_authenticate(viewer)

    assert_clean(api.get(contact_url("professional", professional)))


@pytest.mark.parametrize(
    "status", [ProfessionalProfileStatus.DRAFT, ProfessionalProfileStatus.PENDING]
)
def test_the_404_envelope_leaks_neither_contact_nor_entity_name(
    api, professional, status, unlock_enabled
):
    professional.status = status
    professional.save(update_fields=["status", "updated_at"])

    response = api.get(contact_url("professional", professional))

    assert response.status_code == 404
    assert_clean(response)
    assert_private(response)
    assert "Secret Yard" not in response.content.decode()


def test_the_429_envelope_leaks_nothing(api, professional, unlock_enabled, monkeypatch):
    monkeypatch.setitem(
        HashedIPScopedRateThrottle.THROTTLE_RATES, "contact_access", "1/min"
    )
    api.get(contact_url("professional", professional))

    response = api.get(contact_url("professional", professional))

    assert response.status_code == 429
    assert_clean(response)
    assert_private(response)


# --------------------------------------------------------------------------
# The broker path — no frontend surface yet, so nothing else exercises it
# --------------------------------------------------------------------------


def test_the_broker_locked_response_leaks_nothing(api, broker, unlock_enabled):
    response = api.get(contact_url("broker", broker))

    assert response.data["contact"]["state"] == "LOCKED"
    assert_clean(response)
    assert_private(response)


def test_a_professional_grant_does_not_unlock_a_broker(
    api, broker, professional, unlock_enabled
):
    """The mirror image of the professional-side test, so neither direction of
    spec §16's "Sending to Broker A does not unlock Broker B" is untested."""
    viewer = make_user(email="pro-grant-holder@example.com")
    make_contact_grant(viewer=viewer, professional=professional)
    api.force_authenticate(viewer)

    assert_clean(api.get(contact_url("broker", broker)))


def test_a_suspended_broker_leaks_nothing(api, broker, unlock_enabled):
    viewer = make_user(email="broker-grant-holder@example.com")
    make_contact_grant(viewer=viewer, broker=broker)
    broker.status = BrokerOrganizationStatus.SUSPENDED
    broker.save(update_fields=["status", "updated_at"])
    api.force_authenticate(viewer)

    response = api.get(contact_url("broker", broker))

    assert response.data["contact"]["state"] == "UNAVAILABLE"
    assert_clean(response)


def test_the_broker_granted_path_is_the_positive_control(api, broker, unlock_enabled):
    """Without this, every broker assertion above could be passing because the
    fixture never carried the values."""
    viewer = make_user(email="legit-broker-asker@example.com")
    make_contact_grant(viewer=viewer, broker=broker)
    api.force_authenticate(viewer)

    body = api.get(contact_url("broker", broker)).content.decode()

    assert BROKER_EMAIL in body
    assert "655000111" in body


# --------------------------------------------------------------------------
# Every other public surface that touches these entities
# --------------------------------------------------------------------------


def test_the_public_directory_endpoints_still_carry_no_contact_data(
    api, professional, unlock_enabled
):
    """Phase 5 contract rule 1, re-proved from the wire rather than from the
    serializer's field list."""
    assert_clean(api.get("/api/v1/professionals/"))
    assert_clean(api.get(f"/api/v1/professionals/{professional.slug}/"))


def test_the_public_listing_endpoints_carry_no_broker_contact_data(api, broker):
    """Phase 9 extends PublicListingSerializer this wave and Phase 20 will add a
    broker reference to it (Contract rule 15). An id is fine; a contact value is
    not, and this is the test that says so."""
    listing = published_broker_listing(broker)

    assert_clean(api.get(reverse("listing-list")))
    assert_clean(api.get(reverse("listing-detail", kwargs={"listing_id": listing.pk})))


def test_no_directory_serializer_declares_a_contact_field():
    forbidden = {"public_email", "public_phone", "website_url"}

    assert forbidden.isdisjoint(set(ProfessionalCardSerializer.Meta.fields))
    assert forbidden.isdisjoint(set(ProfessionalDetailSerializer.Meta.fields))


# --------------------------------------------------------------------------
# The staff surface
# --------------------------------------------------------------------------


def test_no_staff_revocation_response_carries_a_contact_value(
    api, professional, moderator, unlock_enabled
):
    """All three outcomes: the 200 resource, the 409 conflict, and the 403 a
    non-staff caller gets."""
    viewer = make_user(email="revoked-by-staff@example.com")
    grant = make_contact_grant(viewer=viewer, professional=professional)
    url = f"/api/v1/staff/contact-grants/{grant.pk}/revoke/"
    api.force_authenticate(moderator)

    ok = api.post(url, {"reason": "Abuse"}, format="json")
    conflict = api.post(url, {"reason": "Abuse again"}, format="json")
    api.force_authenticate(viewer)
    forbidden = api.post(url, {"reason": "let me in"}, format="json")

    assert (ok.status_code, conflict.status_code, forbidden.status_code) == (200, 409, 403)
    for response in (ok, conflict, forbidden):
        assert_clean(response)
    # The 200 body identifies the viewer by id, never by email address.
    assert viewer.email not in ok.content.decode()


# --------------------------------------------------------------------------
# Logs
# --------------------------------------------------------------------------


def test_nothing_is_logged_that_contains_a_contact_value(
    api, professional, unlock_enabled, caplog
):
    """Spec §33.5: never log private contact values.

    caplog is cleared immediately before the requests, so fixture creation —
    which legitimately handles the values — cannot account for a hit. Both the
    locked and the granted path are exercised; the granted one is the dangerous
    one, because it has the values in hand. The scan covers every record
    ATTRIBUTE, not just getMessage(): a value passed through `extra=` or riding
    on an exception in `exc_info` never reaches the formatted message but is
    still written out by a structured handler.
    """
    viewer = make_user(email="logger@example.com")
    make_contact_grant(viewer=viewer, professional=professional)

    with caplog.at_level(logging.DEBUG):
        caplog.clear()
        api.get(contact_url("professional", professional))
        api.force_authenticate(viewer)
        api.get(contact_url("professional", professional))

    emitted = []
    for record in caplog.records:
        emitted.append(record.getMessage())
        emitted.extend(str(value) for value in record.__dict__.values())
    haystack = "\n".join(emitted)
    for secret in (PRO_EMAIL, "612345678"):
        assert secret not in haystack


def test_the_granted_path_is_the_only_one_that_can_produce_the_values(
    api, professional, unlock_enabled
):
    """The positive control for the professional path. Without it, every
    assertion above could be passing because the fixture never carried the
    values in the first place."""
    viewer = make_user(email="legitimate@example.com")
    make_contact_grant(viewer=viewer, professional=professional)
    api.force_authenticate(viewer)

    body = api.get(contact_url("professional", professional)).content.decode()

    assert PRO_EMAIL in body
    assert "612345678" in body
    assert PRO_WEBSITE in body
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest messaging/tests/test_contact_leak_sweep.py -v`
Expected: this is a **verification** task, so the honest expectation is that most tests pass on first run — the production code that satisfies them shipped in Tasks 1–6. A green run is only meaningful after the two positive controls and the four mutation checks below. **Run all six, paste their output into the PR description, and revert each mutation before the next.** A sweep nobody has seen fail is a sweep that proves nothing.

1. **Positive controls (must already pass, unmodified):** `test_the_granted_path_is_the_only_one_that_can_produce_the_values` and `test_the_broker_granted_path_is_the_positive_control`. If either fails, every other assertion in the file is vacuous because the fixtures never carried the values.
2. **Mutation A — the payload builder.** Give `LockedContact` a `leak: str` field, set it to `target.instance.public_email` in `_locked()`, and emit it from `locked_payload()`. Expected red: the guest, no-grant, revoked, cross-entity, flag-off and suspended tests, on both target kinds.
3. **Mutation B — the error path.** Change `raise NotFound()` in `ContactAccessView.get` to `raise NotFound(f"No contact for {target_type} {target_id}")` and add the entity's `display_name` to the message. Expected red: `test_the_404_envelope_leaks_neither_contact_nor_entity_name`. This is the check that the error paths are swept at all, not just the 200s.
4. **Mutation C — the headers.** Delete the `finalize_response` override from `ContactAccessView`. Expected red: every `assert_private` call, across the 200, 404 and 429 paths. Note what this proves and what it does not: with the override gone, `Cache-Control` is absent entirely (a `KeyError`/`MultiValueDictKeyError` on the response) while `Vary` survives as bare `origin` from corsheaders — which is exactly why `assert_private` checks both headers rather than trusting `Vary` alone.
5. **Mutation D — the logs.** Add `logging.getLogger(__name__).info("revealing %s", target.instance.public_email)` to `resolve_contact_access`'s granted branch, and separately a variant passing it as `extra={"email": ...}` rather than in the message. **Both** must turn `test_nothing_is_logged_that_contains_a_contact_value` red — the second one is precisely why that test scans `record.__dict__` and not only `getMessage()`. If the `extra=` variant passes, the scan is broken and the test is near-vacuous.
6. **Mutation E — the other serializers.** Add `"public_email"` to `ProfessionalCardSerializer.Meta.fields`. Expected red: both `test_the_public_directory_endpoints_still_carry_no_contact_data` and `test_no_directory_serializer_declares_a_contact_field` — the wire test and the structural test, so neither is carrying the other.

- [ ] **Step 3: Write minimal implementation**

None expected. If a test genuinely fails, fix the leaking module (`contact_payloads.py`, `contact_views.py` or the directory serializer) and state the fix in the PR description. Do not weaken an assertion.

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd backend && uv run pytest messaging/tests/ -v && uv run pytest -q
```
Expected: the whole messaging suite green and the full backend suite green (no regression in `services_catalog`, `listings` or `accounts`).

- [ ] **Step 5: Commit**

```bash
git add backend/messaging/tests/test_contact_leak_sweep.py
git commit -m "test(messaging): adversarial sweep for raw contact leaks in responses and logs"
```

---

### Task 8: Frontend contact dictionary and API client

**Files:**
- Create: `frontend/src/lib/i18n/contact.ts`, `frontend/src/lib/i18n/contact.test.ts`, `frontend/src/lib/api/contacts.ts`, `frontend/src/lib/api/contacts.test.ts`

**Interfaces:**
- Consumes: `@/lib/api/client`'s `apiFetch` (Phase 3); `@/lib/api/directory`'s `Locale` type (Phase 5 contract rule 12 — declared once, never redeclared).
- Produces:
  - `@/lib/i18n/contact`: `CONTACT_MESSAGES: Record<string, Record<Locale, string>>`, `tContact(locale: Locale, key: string): string`, and a re-export of `type Locale`.
  - `@/lib/api/contacts`: `type ContactTargetType = "broker" | "professional"`; the interfaces `LockedContact`, `GrantedContact`, `UnavailableContact`; `type ContactAccess` (their discriminated union on `state`); `contactAccessPath(targetType, targetId): string`; `fetchContactAccess(targetType, targetId): Promise<ContactAccess>`; `CONTACT_ACCESS_REFRESH_EVENT: "nauta:contact-access-refresh"`; `type ContactAccessRefreshDetail`; `requestContactAccessRefresh(targetType, targetId): void`.

- [ ] **Step 1: Write the failing test**

`frontend/src/lib/i18n/contact.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { CONTACT_MESSAGES, tContact } from "@/lib/i18n/contact";
import { SUPPORTED_LOCALES } from "@/lib/i18n/directory";

describe("CONTACT_MESSAGES", () => {
  it("has every one of the three languages for every key (spec 37)", () => {
    for (const [key, translations] of Object.entries(CONTACT_MESSAGES)) {
      for (const locale of SUPPORTED_LOCALES) {
        expect(translations[locale], `${key}.${locale}`).toBeTruthy();
      }
    }
  });

  it("carries spec 37's two required contact keys", () => {
    expect(CONTACT_MESSAGES["contact.locked_explanation"]).toBeDefined();
    expect(CONTACT_MESSAGES["contact.unlocked"]).toBeDefined();
  });

  it("uses spec 16's locked explanation copy verbatim in English", () => {
    expect(tContact("en", "contact.locked_explanation")).toBe(
      "Send a message through NAUTA to unlock business contact details.",
    );
  });

  it("throws on an unknown key rather than rendering it raw", () => {
    expect(() => tContact("en", "contact.nope")).toThrow();
  });
});
```

`frontend/src/lib/api/contacts.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CONTACT_ACCESS_REFRESH_EVENT,
  contactAccessPath,
  fetchContactAccess,
  requestContactAccessRefresh,
  type ContactAccessRefreshDetail,
} from "@/lib/api/contacts";

const apiFetch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", () => ({ apiFetch }));

beforeEach(() => {
  apiFetch.mockReset();
});

describe("contactAccessPath", () => {
  it("builds spec 30.1's path from the lowercase segment", () => {
    expect(contactAccessPath("professional", "abc-123")).toBe(
      "/api/v1/contacts/professional/abc-123/",
    );
    expect(contactAccessPath("broker", "abc-123")).toBe(
      "/api/v1/contacts/broker/abc-123/",
    );
  });
});

describe("fetchContactAccess", () => {
  it("unwraps the { contact } envelope", async () => {
    apiFetch.mockResolvedValue({
      contact: {
        state: "LOCKED",
        email_mask: "i••••@example.com",
        phone_mask: "+34 ••• ••• ••2",
        unlock_rule: "SEND_INQUIRY",
      },
    });

    const access = await fetchContactAccess("professional", "abc-123");

    expect(apiFetch).toHaveBeenCalledWith("/api/v1/contacts/professional/abc-123/", {
      cache: "no-store",
    });
    expect(access.state).toBe("LOCKED");
  });

  it("never lets the browser cache a per-viewer answer", () => {
    // The server sends Cache-Control: private, no-store; this is the client
    // half of the same rule. A cached LOCKED replayed after login (or a cached
    // GRANTED replayed after logout) is a cross-viewer disclosure.
    apiFetch.mockResolvedValue({ contact: { state: "UNAVAILABLE" } });

    void fetchContactAccess("broker", "abc-123");

    expect(apiFetch.mock.calls[0][1]).toMatchObject({ cache: "no-store" });
  });

  it("propagates an ApiError rather than inventing a locked state", async () => {
    // A network failure must not be indistinguishable from "locked": the panel
    // shows an error, so a reader is never told a false reason for the lock.
    apiFetch.mockRejectedValue(new Error("boom"));

    await expect(fetchContactAccess("professional", "abc-123")).rejects.toThrow("boom");
  });
});

describe("requestContactAccessRefresh", () => {
  it("dispatches an event carrying the target it refers to", () => {
    const seen: ContactAccessRefreshDetail[] = [];
    const listener = (event: Event) => {
      seen.push((event as CustomEvent<ContactAccessRefreshDetail>).detail);
    };
    window.addEventListener(CONTACT_ACCESS_REFRESH_EVENT, listener);

    requestContactAccessRefresh("professional", "abc-123");

    window.removeEventListener(CONTACT_ACCESS_REFRESH_EVENT, listener);
    expect(seen).toEqual([{ targetType: "professional", targetId: "abc-123" }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm test src/lib/i18n/contact.test.ts src/lib/api/contacts.test.ts`
Expected: FAIL — both modules are unresolved imports.

- [ ] **Step 3: Write minimal implementation**

`frontend/src/lib/i18n/contact.ts`:

```ts
// Spec 37: EN/IT/ES for every string, none hard-coded in a component. A sibling
// of lib/i18n/directory.ts rather than an edit to it — Phase 5's contract rule 9
// explicitly allows "a sibling dictionary", and keeping this phase's copy in its
// own module means a concurrent phase editing the directory dictionary never
// collides with this one.
import type { Locale } from "@/lib/api/directory";

// Locale is declared once, in lib/api/directory.ts (Phase 5 contract rule 12).
export type { Locale };

type Translations = Record<Locale, string>;

export const CONTACT_MESSAGES: Record<string, Translations> = {
  "contact.heading": {
    en: "Business contact",
    it: "Contatto aziendale",
    es: "Contacto profesional",
  },
  "contact.locked_explanation": {
    // Spec 16 fixes this sentence exactly.
    en: "Send a message through NAUTA to unlock business contact details.",
    it: "Invia un messaggio tramite NAUTA per sbloccare i dati di contatto aziendali.",
    es: "Envía un mensaje a través de NAUTA para desbloquear los datos de contacto profesionales.",
  },
  "contact.unlocked": {
    en: "Contact details unlocked",
    it: "Dati di contatto sbloccati",
    es: "Datos de contacto desbloqueados",
  },
  "contact.email_label": { en: "Email", it: "Email", es: "Correo electrónico" },
  "contact.phone_label": { en: "Phone", it: "Telefono", es: "Teléfono" },
  "contact.website_label": { en: "Website", it: "Sito web", es: "Sitio web" },
  "contact.unavailable": {
    // Spec 16: "suspended entity contact becomes unavailable". Deliberately
    // says nothing about why — a suspension is not the visitor's business.
    en: "Contact details are not available for this profile right now.",
    it: "I dati di contatto non sono disponibili per questo profilo al momento.",
    es: "Los datos de contacto no están disponibles para este perfil en este momento.",
  },
  "contact.loading": {
    en: "Loading contact details…",
    it: "Caricamento dei dati di contatto…",
    es: "Cargando los datos de contacto…",
  },
  "contact.error": {
    en: "Contact details could not be loaded. Please try again.",
    it: "Impossibile caricare i dati di contatto. Riprova.",
    es: "No se han podido cargar los datos de contacto. Inténtalo de nuevo.",
  },
  "contact.granted_on": { en: "Unlocked on", it: "Sbloccato il", es: "Desbloqueado el" },
};

export function tContact(locale: Locale, key: string): string {
  const translations = CONTACT_MESSAGES[key];
  if (!translations) {
    throw new Error(`Unknown contact message key: ${key}`);
  }
  return translations[locale] || translations.en;
}
```

`frontend/src/lib/api/contacts.ts`:

```ts
// Spec 16's contact payload, as a DISCRIMINATED UNION. This is a privacy
// control, not a style choice: TypeScript will not let a component read
// `access.email` without first narrowing `access.state === "GRANTED"`, so the
// locked branch cannot even be written to display a raw value.
import { apiFetch } from "@/lib/api/client";

export type ContactTargetType = "broker" | "professional";

export interface LockedContact {
  state: "LOCKED";
  email_mask: string;
  phone_mask: string;
  unlock_rule: "SEND_INQUIRY";
}

export interface GrantedContact {
  state: "GRANTED";
  email: string;
  phone: string;
  website_url: string | null;
  /** null on the staff-bypass path: spec §5 gives a staff moderator or admin a
   *  reveal without a grant, and there is no grant timestamp to report. Every
   *  consumer must handle it — `granted_at.slice(...)` on a staff reveal is a
   *  TypeError that takes the whole panel down. */
  granted_at: string | null;
}

export interface UnavailableContact {
  state: "UNAVAILABLE";
}

export type ContactAccess = LockedContact | GrantedContact | UnavailableContact;

export function contactAccessPath(
  targetType: ContactTargetType,
  targetId: string,
): string {
  return `/api/v1/contacts/${targetType}/${encodeURIComponent(targetId)}/`;
}

/** Authorization is decided server-side; this only asks. Errors propagate:
 * a failed request must not be rendered as "locked", which would tell the
 * reader a false reason.
 *
 * `cache: "no-store"` matches the server's `Cache-Control: private, no-store`
 * and belongs on BOTH sides: the same URL answers LOCKED to a guest and GRANTED
 * to a grant holder, so a cached response replayed after a login — or after a
 * logout on a shared machine — is a cross-viewer disclosure. */
export async function fetchContactAccess(
  targetType: ContactTargetType,
  targetId: string,
): Promise<ContactAccess> {
  const payload = await apiFetch<{ contact: ContactAccess }>(
    contactAccessPath(targetType, targetId),
    { cache: "no-store" },
  );
  return payload.contact;
}

/** The seam spec 16's "After successful send, refetch contact authorization"
 * needs. Phase 6's InquiryForm calls this after a 201; the panel re-asks the
 * server. A browser event rather than a shared store, so the form and the panel
 * stay independent components with no common ancestor requirement. */
export const CONTACT_ACCESS_REFRESH_EVENT = "nauta:contact-access-refresh";

export interface ContactAccessRefreshDetail {
  targetType: ContactTargetType;
  targetId: string;
}

export function requestContactAccessRefresh(
  targetType: ContactTargetType,
  targetId: string,
): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(
    new CustomEvent<ContactAccessRefreshDetail>(CONTACT_ACCESS_REFRESH_EVENT, {
      detail: { targetType, targetId },
    }),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && pnpm test src/lib/i18n/contact.test.ts src/lib/api/contacts.test.ts && pnpm lint`
Expected: 9 passed, lint clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/i18n/contact.ts frontend/src/lib/i18n/contact.test.ts frontend/src/lib/api/contacts.ts frontend/src/lib/api/contacts.test.ts
git commit -m "feat(frontend): add the contact access client and EN/IT/ES dictionary"
```

---

### Task 9: `ContactPanel` client component

**Files:**
- Create: `frontend/src/components/contact/ContactPanel.tsx`, `frontend/src/components/contact/ContactPanel.test.tsx`

**Interfaces:**
- Consumes: `@/lib/api/contacts`'s `{ CONTACT_ACCESS_REFRESH_EVENT, fetchContactAccess, type ContactAccess, type ContactAccessRefreshDetail, type ContactTargetType }` (Task 8); `@/lib/i18n/contact`'s `{ tContact, type Locale }` (Task 8); `@/lib/auth/session`'s `useSession` (Phase 3 — mounted in `app/layout.tsx`, so every route already has the provider).
- Produces: `ContactPanel` — the default export of `components/contact/ContactPanel.tsx`, props `{ targetType: ContactTargetType; targetId: string; locale: Locale }`.

- [ ] **Step 1: Write the failing test**

`frontend/src/components/contact/ContactPanel.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ContactPanel from "@/components/contact/ContactPanel";
import { CONTACT_ACCESS_REFRESH_EVENT } from "@/lib/api/contacts";

const fetchContactAccess = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/contacts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/contacts")>()),
  fetchContactAccess,
}));

// The panel must not ask the server before SessionProvider has traded the
// HttpOnly refresh cookie for an access token, so the session is part of every
// test's setup rather than something the panel is assumed to ignore.
const sessionState = vi.hoisted(() => ({
  current: { session: null as unknown, loading: false },
}));
vi.mock("@/lib/auth/session", () => ({ useSession: () => sessionState.current }));

function signedIn(id: string) {
  return { authenticated: true, user: { id, email: `${id}@example.com` } };
}

const TARGET_ID = "0f1e2d3c-4b5a-4697-8899-aabbccddeeff";

function locked() {
  return {
    state: "LOCKED" as const,
    email_mask: "i••••@example.com",
    phone_mask: "+34 ••• ••• ••2",
    unlock_rule: "SEND_INQUIRY" as const,
  };
}

function granted() {
  return {
    state: "GRANTED" as const,
    email: "info@example.com",
    phone: "+34900111222",
    website_url: "https://example.com",
    granted_at: "2026-09-18T10:30:00Z",
  };
}

function renderPanel() {
  return render(
    <ContactPanel targetType="professional" targetId={TARGET_ID} locale="en" />,
  );
}

beforeEach(() => {
  fetchContactAccess.mockReset();
  sessionState.current = { session: null, loading: false };
});

describe("ContactPanel", () => {
  it("shows the masked values and the unlock explanation when locked", async () => {
    fetchContactAccess.mockResolvedValue(locked());

    renderPanel();

    expect(await screen.findByText("i••••@example.com")).toBeInTheDocument();
    expect(screen.getByText("+34 ••• ••• ••2")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Send a message through NAUTA to unlock business contact details.",
      ),
    ).toBeInTheDocument();
  });

  it("renders no raw contact value anywhere in the locked DOM", async () => {
    fetchContactAccess.mockResolvedValue(locked());

    const { container } = renderPanel();
    await screen.findByText("i••••@example.com");

    expect(container.innerHTML).not.toContain("info@example.com");
    expect(container.innerHTML).not.toContain("900111222");
  });

  it("puts nothing secret in an aria-label or a title attribute (spec 16)", async () => {
    fetchContactAccess.mockResolvedValue(locked());

    const { container } = renderPanel();
    await screen.findByText("i••••@example.com");

    for (const element of container.querySelectorAll("[aria-label], [title]")) {
      expect(element.getAttribute("aria-label") ?? "").not.toContain("@");
      expect(element.getAttribute("title") ?? "").not.toContain("@");
    }
  });

  it("keeps the masked values readable by a screen reader", async () => {
    // Spec 16: "screen readers hear the masked value and unlock explanation".
    // The mask must therefore NOT be aria-hidden; only the decorative lock
    // glyph is.
    fetchContactAccess.mockResolvedValue(locked());

    renderPanel();
    const mask = await screen.findByText("i••••@example.com");

    expect(mask.closest("[aria-hidden='true']")).toBeNull();
  });

  it("marks the locked values non-selectable rather than hiding them", async () => {
    fetchContactAccess.mockResolvedValue(locked());

    renderPanel();
    const mask = await screen.findByText("i••••@example.com");

    expect(mask.className).toContain("select-none");
  });

  it("renders actionable links once granted", async () => {
    fetchContactAccess.mockResolvedValue(granted());

    renderPanel();

    expect(await screen.findByRole("link", { name: "info@example.com" })).toHaveAttribute(
      "href",
      "mailto:info@example.com",
    );
    expect(screen.getByRole("link", { name: "+34900111222" })).toHaveAttribute(
      "href",
      "tel:+34900111222",
    );
    expect(screen.getByRole("link", { name: "https://example.com" })).toHaveAttribute(
      "href",
      "https://example.com",
    );
    expect(screen.getByText("Contact details unlocked")).toBeInTheDocument();
  });

  it("renders a staff reveal, which has no grant date, without crashing", async () => {
    // Spec §5 lets a staff moderator or admin reveal without a grant, so the
    // payload's `granted_at` is null. An unguarded `.slice()` would throw here
    // and unmount the panel for every staff viewer of every profile.
    fetchContactAccess.mockResolvedValue({ ...granted(), granted_at: null });

    renderPanel();

    expect(await screen.findByRole("link", { name: "info@example.com" })).toBeInTheDocument();
    expect(screen.getByText("Contact details unlocked")).toBeInTheDocument();
    expect(screen.queryByText("Unlocked on")).not.toBeInTheDocument();
    expect(document.querySelector("time")).toBeNull();
  });

  it("omits the website row when the entity has none", async () => {
    fetchContactAccess.mockResolvedValue({ ...granted(), website_url: null });

    renderPanel();
    await screen.findByRole("link", { name: "info@example.com" });

    expect(screen.queryByText("Website")).not.toBeInTheDocument();
  });

  it("explains an unavailable profile without masks or an unlock prompt", async () => {
    fetchContactAccess.mockResolvedValue({ state: "UNAVAILABLE" as const });

    renderPanel();

    expect(
      await screen.findByText(
        "Contact details are not available for this profile right now.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Send a message through NAUTA to unlock business contact details.",
      ),
    ).not.toBeInTheDocument();
  });

  it("shows an error state instead of pretending the contact is locked", async () => {
    fetchContactAccess.mockRejectedValue(new Error("network"));

    renderPanel();

    expect(
      await screen.findByText(
        "Contact details could not be loaded. Please try again.",
      ),
    ).toBeInTheDocument();
  });

  it("waits for the session to bootstrap before asking the server", async () => {
    // Regression test for a real failure mode: lib/auth/session.tsx starts with
    // `loading: true` and the in-memory access token empty. A request sent then
    // is anonymous, and this endpoint answers 200 LOCKED to an anonymous
    // caller — so apiFetch's 401-refresh-retry never fires and a grant holder
    // would be shown LOCKED until they reloaded the page.
    sessionState.current = { session: null, loading: true };
    fetchContactAccess.mockResolvedValue(granted());

    const { rerender } = renderPanel();

    expect(fetchContactAccess).not.toHaveBeenCalled();

    sessionState.current = { session: signedIn("viewer-1"), loading: false };
    rerender(
      <ContactPanel targetType="professional" targetId={TARGET_ID} locale="en" />,
    );

    expect(await screen.findByRole("link", { name: "info@example.com" })).toBeInTheDocument();
    await waitFor(() => expect(fetchContactAccess).toHaveBeenCalledTimes(1));
  });

  it("re-asks when the viewer identity changes", async () => {
    // Logging in without a full page load must not leave a stale LOCKED panel.
    sessionState.current = { session: null, loading: false };
    fetchContactAccess.mockResolvedValueOnce(locked()).mockResolvedValueOnce(granted());

    const { rerender } = renderPanel();
    await screen.findByText("i••••@example.com");

    sessionState.current = { session: signedIn("viewer-2"), loading: false };
    rerender(
      <ContactPanel targetType="professional" targetId={TARGET_ID} locale="en" />,
    );

    expect(await screen.findByRole("link", { name: "info@example.com" })).toBeInTheDocument();
  });

  it("refetches when an inquiry for this target reports success", async () => {
    // Spec 16: "After successful send, refetch contact authorization; do not
    // rely on client-side unblur alone."
    fetchContactAccess.mockResolvedValueOnce(locked()).mockResolvedValueOnce(granted());

    renderPanel();
    await screen.findByText("i••••@example.com");

    window.dispatchEvent(
      new CustomEvent(CONTACT_ACCESS_REFRESH_EVENT, {
        detail: { targetType: "professional", targetId: TARGET_ID },
      }),
    );

    expect(await screen.findByRole("link", { name: "info@example.com" })).toBeInTheDocument();
  });

  it("ignores a refresh event for a different target", async () => {
    fetchContactAccess.mockResolvedValue(locked());

    renderPanel();
    await screen.findByText("i••••@example.com");

    window.dispatchEvent(
      new CustomEvent(CONTACT_ACCESS_REFRESH_EVENT, {
        detail: { targetType: "broker", targetId: "someone-else" },
      }),
    );

    await waitFor(() => expect(fetchContactAccess).toHaveBeenCalledTimes(1));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm test src/components/contact/ContactPanel.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/contact/ContactPanel"`.

- [ ] **Step 3: Write minimal implementation**

`frontend/src/components/contact/ContactPanel.tsx`:

```tsx
"use client";

// A CLIENT component on purpose, and it is a privacy requirement rather than a
// preference (spec 16: never place the unblurred value in "page source … or
// preloaded JSON"). A server component would serialize whatever it fetched into
// the RSC payload embedded in the HTML — and it could not identify the viewer
// anyway, because the access token lives in browser memory (lib/api/client.ts).
import { useCallback, useEffect, useState } from "react";

import {
  CONTACT_ACCESS_REFRESH_EVENT,
  fetchContactAccess,
  type ContactAccess,
  type ContactAccessRefreshDetail,
  type ContactTargetType,
} from "@/lib/api/contacts";
import { useSession } from "@/lib/auth/session";
import { tContact, type Locale } from "@/lib/i18n/contact";

interface ContactPanelProps {
  targetType: ContactTargetType;
  targetId: string;
  locale: Locale;
}

export default function ContactPanel({
  targetType,
  targetId,
  locale,
}: ContactPanelProps) {
  // The session, not just the token: on a fresh page load lib/api/client.ts's
  // access token is empty and SessionProvider is still trading the HttpOnly
  // refresh cookie for a new one (session.tsx's `loading` starts true). Asking
  // before that finishes sends an UNAUTHENTICATED request, which this endpoint
  // answers 200 LOCKED — so apiFetch's 401-refresh-retry never fires and a
  // grant holder would sit on a locked panel until they reloaded. Waiting for
  // `loading` to clear is the fix; `viewerId` in the dependency list is what
  // re-asks when somebody logs in or out without a full page load.
  const { session, loading: sessionLoading } = useSession();
  const viewerId = session?.user?.id ?? null;

  const [access, setAccess] = useState<ContactAccess | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      setAccess(await fetchContactAccess(targetType, targetId));
      setFailed(false);
    } catch {
      // A failed request is NOT "locked": saying so would give the reader a
      // false reason. The panel says it could not load instead.
      setAccess(null);
      setFailed(true);
    }
  }, [targetType, targetId]);

  useEffect(() => {
    if (sessionLoading) {
      return;
    }
    void load();
  }, [load, sessionLoading, viewerId]);

  useEffect(() => {
    function onRefresh(event: Event) {
      const detail = (event as CustomEvent<ContactAccessRefreshDetail>).detail;
      if (detail?.targetType === targetType && detail?.targetId === targetId) {
        void load();
      }
    }
    window.addEventListener(CONTACT_ACCESS_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(CONTACT_ACCESS_REFRESH_EVENT, onRefresh);
  }, [load, targetType, targetId]);

  return (
    <section
      aria-labelledby="contact-heading"
      className="rounded-xl border border-outline-variant p-space-md"
    >
      <h2
        id="contact-heading"
        className="flex items-center gap-space-xs font-title-lg text-title-lg text-primary"
      >
        {/* Decorative only — the lock state is also stated in words below, so
            spec 29.6's "readable without relying on hover" holds. */}
        <span className="material-symbols-outlined" aria-hidden="true">
          {access?.state === "GRANTED" ? "lock_open" : "lock"}
        </span>
        {tContact(locale, "contact.heading")}
      </h2>

      {failed ? (
        <p className="mt-space-sm font-body-md text-on-surface-variant" role="status">
          {tContact(locale, "contact.error")}
        </p>
      ) : null}

      {!failed && access === null ? (
        <p className="mt-space-sm font-body-md text-on-surface-variant" aria-busy="true">
          {tContact(locale, "contact.loading")}
        </p>
      ) : null}

      {access?.state === "UNAVAILABLE" ? (
        <p className="mt-space-sm font-body-md text-on-surface-variant">
          {tContact(locale, "contact.unavailable")}
        </p>
      ) : null}

      {access?.state === "LOCKED" ? (
        <>
          <dl className="mt-space-sm space-y-space-xs">
            <div>
              <dt className="font-body-sm text-on-surface-variant">
                {tContact(locale, "contact.email_label")}
              </dt>
              {/* The blur is cosmetic over a value that is ALREADY masked
                  server-side. The secret never reaches this browser, so this is
                  not the "hide prohibited fields only with CSS" that spec 39
                  forbids — remove the class and the mask is still a mask. */}
              <dd className="select-none blur-[2px] font-body-md text-on-surface">
                {access.email_mask}
              </dd>
            </div>
            <div>
              <dt className="font-body-sm text-on-surface-variant">
                {tContact(locale, "contact.phone_label")}
              </dt>
              <dd className="select-none blur-[2px] font-body-md text-on-surface">
                {access.phone_mask}
              </dd>
            </div>
          </dl>
          <p className="mt-space-sm font-body-sm text-on-surface-variant">
            {tContact(locale, "contact.locked_explanation")}
          </p>
        </>
      ) : null}

      {access?.state === "GRANTED" ? (
        <>
          <p className="mt-space-sm font-body-sm text-on-surface-variant">
            {tContact(locale, "contact.unlocked")}
          </p>
          <dl className="mt-space-sm space-y-space-xs">
            <div>
              <dt className="font-body-sm text-on-surface-variant">
                {tContact(locale, "contact.email_label")}
              </dt>
              <dd className="font-body-md">
                <a className="text-secondary underline" href={`mailto:${access.email}`}>
                  {access.email}
                </a>
              </dd>
            </div>
            <div>
              <dt className="font-body-sm text-on-surface-variant">
                {tContact(locale, "contact.phone_label")}
              </dt>
              <dd className="font-body-md">
                <a className="text-secondary underline" href={`tel:${access.phone}`}>
                  {access.phone}
                </a>
              </dd>
            </div>
            {access.website_url ? (
              <div>
                <dt className="font-body-sm text-on-surface-variant">
                  {tContact(locale, "contact.website_label")}
                </dt>
                <dd className="font-body-md">
                  <a
                    className="text-secondary underline"
                    href={access.website_url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {access.website_url}
                  </a>
                </dd>
              </div>
            ) : null}
          </dl>
          {/* Guarded, not assumed: `granted_at` is null on the staff-bypass
              path (spec §5), where there is no grant and therefore no date to
              show. An unguarded .slice() here would throw and unmount the whole
              panel for every staff viewer. */}
          {access.granted_at ? (
            <p className="mt-space-sm font-body-sm text-on-surface-variant">
              {tContact(locale, "contact.granted_on")}{" "}
              <time dateTime={access.granted_at}>{access.granted_at.slice(0, 10)}</time>
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && pnpm test src/components/contact/ContactPanel.test.tsx && pnpm lint`
Expected: 14 passed, lint clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/contact
git commit -m "feat(frontend): add the locked/granted contact panel component"
```

---

### Task 10: Mount the panel on the professional detail page

**Files:**
- Modify: `frontend/src/app/services/professionals/[slug]/page.tsx` (replace the `PHASE 7 SEAM` comment block)

**Interfaces:**
- Consumes: `ContactPanel` (Task 9); `ProfessionalDetail.id` from `fetchProfessional` (Phase 5 — `id` is already in `ProfessionalCardSerializer.Meta.fields`, so no backend change is needed).
- Produces: nothing importable. The deliverable is the rendered page and the proof that its HTML carries no contact value.

**Note.** Phase 5's seam comment sketches `<ContactPanel targetType="PROFESSIONAL" targetId={professional.id} />` in **upper case**. The real prop is `"professional"`, lower case, because the value is the URL path segment (`TARGET_TYPE_BY_SEGMENT`) rather than the stored `target_type`. The sketch was written before the endpoint existed; follow this plan, and delete the sketch along with the comment.

- [ ] **Step 1: Write the failing check**

This is a server-rendered route, so the red-to-green evidence is HTTP, matching the precedent in Phase 5's page tasks. Prepare the environment once:

```bash
docker compose -f docker-compose.yml up -d --wait postgres redis
cd backend && uv run python manage.py migrate
uv run python manage.py shell -c "
from django.contrib.auth import get_user_model
from platform_settings.models import FeatureFlag
from professionals.models import ProfessionalProfile
from professionals.enums import ProfessionalProfileStatus
owner, _ = get_user_model().objects.get_or_create(email='seam-owner@example.com')
ProfessionalProfile.objects.update_or_create(
    slug='seam-check',
    defaults=dict(owner_user=owner, display_name='Seam Check Marine',
                  status=ProfessionalProfileStatus.ACTIVE, country_code='ES',
                  public_email='hidden@seam-check.example', public_phone='+34699888777'))
FeatureFlag.objects.filter(key='contact_unlock').update(is_enabled=True)
"
uv run python manage.py runserver 8020 &
cd ../frontend && pnpm build && pnpm start --port 3020 &
```

Then run the check:

```bash
curl -s http://localhost:3020/services/professionals/seam-check/ | grep -c "Business contact"
```
Expected **before** the change: `0` — the aside still holds only the seam comment, which is stripped from the output entirely.

- [ ] **Step 2: Verify the leak check is meaningful before the change**

```bash
curl -s http://localhost:3020/services/professionals/seam-check/ | grep -c "hidden@seam-check.example"
curl -s http://localhost:3020/services/professionals/seam-check/ | grep -c "699888777"
```
Expected: `0` and `0`. This is the baseline the next step must preserve — Phase 5 already keeps contact data out of the directory payload, and mounting the panel must not change that.

- [ ] **Step 3: Write minimal implementation**

In `frontend/src/app/services/professionals/[slug]/page.tsx`, add the import beside the existing ones:

```tsx
import ContactPanel from "@/components/contact/ContactPanel";
```

and replace the whole `{/* PHASE 7 SEAM — … */}` comment block inside `<aside>` with:

```tsx
          {/* Spec 14.2's contact panel. The panel is a client component and
              fetches GET /api/v1/contacts/professional/<id>/ after mount, so
              this server-rendered HTML contains no contact value at all —
              masked or otherwise (spec 16). `professional.id` is already in the
              directory payload; no contact field was added to it. */}
          <ContactPanel
            targetType="professional"
            targetId={professional.id}
            locale={locale}
          />
```

- [ ] **Step 4: Run the checks to verify they pass**

```bash
cd frontend && pnpm test && pnpm lint && pnpm build
pnpm start --port 3020 &
curl -s http://localhost:3020/services/professionals/seam-check/ | grep -c "Business contact"
curl -s http://localhost:3020/services/professionals/seam-check/ | grep -c "hidden@seam-check.example"
curl -s http://localhost:3020/services/professionals/seam-check/ | grep -c "699888777"
curl -s http://localhost:3020/services/professionals/seam-check/ | grep -ci "unlock business contact details"
```
Expected, in order: a non-zero count (the panel's heading now renders in the initial HTML), then `0`, then `0` — and the last one is `0` too, which is **correct, not a bug**: the locked explanation is rendered only after the client-side fetch resolves, so it is absent from the server HTML. Confirm the full locked panel in a browser (heading, both masks, lock icon, explanation) and attach the screenshot to the PR, as spec §39's handoff note requires for changed UI states.

Also confirm the two accessibility properties by hand, since a screenshot cannot: with a screen reader (or the browser's accessibility inspector), the panel announces the masked email, the masked phone and the unlock sentence, and the lock glyph is skipped.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/services/professionals/[slug]/page.tsx
git commit -m "feat(frontend): mount the contact panel on the professional detail page"
```

---

### Task 11: Make a successful inquiry actually refresh the panel

**Files:**
- Modify: `frontend/src/lib/api/contacts.ts` (append `contactTargetTypeForContext`)
- Modify: `frontend/src/components/inquiry/InquiryForm.tsx` (**Phase 6's file** — one import, two lines in the success path)
- Test: `frontend/src/components/contact/inquiry-refresh.test.tsx` (new; Phase 6's `InquiryForm.test.tsx` is **not** edited)

**Interfaces:**
- Consumes: Phase 6's `InquiryForm`, `submitInquiry`, `InquiryConfig`, `InquiryContextRef` (reconciliation row 11); Task 8's `requestContactAccessRefresh`; Task 9's `ContactPanel`.
- Produces: `@/lib/api/contacts`'s `contactTargetTypeForContext(contextType: string): ContactTargetType | null`.

**Why this task exists.** Spec §16 says "After successful send, refetch contact authorization; do not rely on client-side unblur alone", and Task 8 built the seam for it — but **nothing dispatches it**. Phase 6's `InquiryForm` takes `{ context, config, locale }`, and on a 201 it sets `sent = true` and deliberately does not navigate (its own ruling: the conversation page does not exist yet). So without this task the panel only refreshes on a full page reload, and Task 9's refresh test proves nothing but that a hand-dispatched event works. The end-to-end test below is the point of the task: it drives the **real** form and asserts the **real** panel changes state.

- [ ] **Step 1: Write the failing test**

`frontend/src/components/contact/inquiry-refresh.test.tsx`:

```tsx
/**
 * The Phase 6 -> Phase 7 seam, end to end in one render tree: a real
 * InquiryForm submit must flip a real ContactPanel from LOCKED to GRANTED
 * without a page reload (spec 16).
 *
 * Only the two network calls are mocked. Both components are the real ones, so
 * a missing dispatch, a wrong target type or a listener bound to the wrong
 * event name all fail here — none of which Task 9's test can see, because it
 * dispatches the event itself.
 *
 * The form setup below (labels, config, session shape) is copied from Phase 6's
 * own InquiryForm.test.tsx. Re-read that file before changing anything here.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ContactPanel from "@/components/contact/ContactPanel";
import InquiryForm from "@/components/inquiry/InquiryForm";
import type { InquiryConfig, InquiryContextRef } from "@/lib/api/inquiries";

const submitInquiry = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/inquiries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/inquiries")>()),
  submitInquiry: (...args: unknown[]) => submitInquiry(...args),
}));

const fetchContactAccess = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/contacts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/contacts")>()),
  fetchContactAccess,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/services/professionals/phase6-pro/",
}));

const sessionState = vi.hoisted(() => ({ current: {} as unknown }));
vi.mock("@/lib/auth/session", () => ({ useSession: () => sessionState.current }));

const TARGET_ID = "11111111-1111-4111-8111-111111111111";

const context: InquiryContextRef = {
  type: "PROFESSIONAL",
  id: TARGET_ID,
  label: "Phase6 Pro",
};

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

const BODY = "I would like to arrange a viewing next week please.";

function signedIn() {
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
      },
    },
  };
}

function renderProfilePage() {
  return render(
    <>
      <InquiryForm context={context} config={config} locale="en" />
      <ContactPanel targetType="professional" targetId={TARGET_ID} locale="en" />
    </>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  sessionState.current = signedIn();
});

describe("a successful inquiry and the contact panel", () => {
  it("unlocks the panel without a page reload", async () => {
    fetchContactAccess
      .mockResolvedValueOnce({
        state: "LOCKED",
        email_mask: "i••••@example.com",
        phone_mask: "+34 ••• ••• ••2",
        unlock_rule: "SEND_INQUIRY",
      })
      .mockResolvedValue({
        state: "GRANTED",
        email: "info@example.com",
        phone: "+34900111222",
        website_url: null,
        granted_at: "2026-09-18T10:30:00Z",
      });
    submitInquiry.mockResolvedValue({
      conversation_id: "c1",
      message_id: "m1",
      contact_access: "GRANTED",
      next_url: "/dashboard/messages/c1/",
    });
    renderProfilePage();
    await screen.findByText("i••••@example.com");

    await userEvent.type(screen.getByLabelText("Message"), BODY);
    await userEvent.click(
      screen.getByLabelText("I accept the privacy policy (version 2026-09)."),
    );
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => expect(submitInquiry).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByRole("link", { name: "info@example.com" }),
    ).toBeInTheDocument();
    expect(fetchContactAccess).toHaveBeenCalledTimes(2);
  });

  it("re-asks the server rather than unblurring locally", async () => {
    // Spec 16: "do not rely on client-side unblur alone." If the second answer
    // is still LOCKED — a grant the backend declined to create, or a flag that
    // is off — the panel must stay locked.
    fetchContactAccess.mockResolvedValue({
      state: "LOCKED",
      email_mask: "i••••@example.com",
      phone_mask: "+34 ••• ••• ••2",
      unlock_rule: "SEND_INQUIRY",
    });
    submitInquiry.mockResolvedValue({
      conversation_id: "c1",
      message_id: "m1",
      contact_access: "GRANTED",
      next_url: "/dashboard/messages/c1/",
    });
    renderProfilePage();
    await screen.findByText("i••••@example.com");

    await userEvent.type(screen.getByLabelText("Message"), BODY);
    await userEvent.click(
      screen.getByLabelText("I accept the privacy policy (version 2026-09)."),
    );
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => expect(fetchContactAccess).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("link", { name: "info@example.com" })).toBeNull();
    expect(screen.getByText("i••••@example.com")).toBeInTheDocument();
  });

  it("does not refresh when the submit failed", async () => {
    fetchContactAccess.mockResolvedValue({
      state: "LOCKED",
      email_mask: "i••••@example.com",
      phone_mask: "+34 ••• ••• ••2",
      unlock_rule: "SEND_INQUIRY",
    });
    submitInquiry.mockRejectedValue(new Error("rate limited"));
    renderProfilePage();
    await screen.findByText("i••••@example.com");

    await userEvent.type(screen.getByLabelText("Message"), BODY);
    await userEvent.click(
      screen.getByLabelText("I accept the privacy policy (version 2026-09)."),
    );
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => expect(submitInquiry).toHaveBeenCalledTimes(1));
    expect(fetchContactAccess).toHaveBeenCalledTimes(1);
  });
});

describe("contactTargetTypeForContext", () => {
  it("maps the two grantable contexts onto their URL segments", async () => {
    const { contactTargetTypeForContext } = await vi.importActual<
      typeof import("@/lib/api/contacts")
    >("@/lib/api/contacts");

    expect(contactTargetTypeForContext("BROKER")).toBe("broker");
    expect(contactTargetTypeForContext("PROFESSIONAL")).toBe("professional");
  });

  it("returns null for a LISTING context, which has no contact endpoint", () => {
    // A private-seller listing grants nothing at all (Phase 6 reports
    // NOT_APPLICABLE), and a broker-owned listing grants the BROKER's contact,
    // whose id this form does not carry. Dispatching the listing id as a
    // contact target would be a refresh request no panel can match.
    return import("@/lib/api/contacts").then(({ contactTargetTypeForContext }) => {
      expect(contactTargetTypeForContext("LISTING")).toBeNull();
      expect(contactTargetTypeForContext("nonsense")).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm test src/components/contact/inquiry-refresh.test.tsx`
Expected: FAIL. The first test fails on `expect(fetchContactAccess).toHaveBeenCalledTimes(2)` — the form submits, but nothing tells the panel — and the `contactTargetTypeForContext` block fails to import.

- [ ] **Step 3: Write minimal implementation**

Append to `frontend/src/lib/api/contacts.ts`:

```ts
/** Phase 6's inquiry `context_type` -> this module's URL segment, or null when
 *  the context has no contact endpoint.
 *
 *  LISTING deliberately maps to null. A private-seller listing grants nothing
 *  (Phase 6 reports `contact_access: "NOT_APPLICABLE"`), and a broker-owned
 *  listing grants the BROKER's contact — whose id the inquiry form does not
 *  carry, because the public listing payload has no broker reference yet
 *  (Contract rule 15). Dispatching a listing id as a contact target would be a
 *  refresh no panel could match. */
export function contactTargetTypeForContext(
  contextType: string,
): ContactTargetType | null {
  const segment = contextType.toLowerCase();
  return segment === "broker" || segment === "professional" ? segment : null;
}
```

In `frontend/src/components/inquiry/InquiryForm.tsx` — **read the merged file first** — add the import beside the others:

```ts
import {
  contactTargetTypeForContext,
  requestContactAccessRefresh,
} from "@/lib/api/contacts";
```

and, immediately after the existing `setSent(true);` in the success path (inside the same `try`, so a failed submit never reaches it):

```ts
      // Spec 16: "After successful send, refetch contact authorization; do not
      // rely on client-side unblur alone." This asks Phase 7's panel to re-ask
      // the server; it never unlocks anything by itself.
      //
      // `contextRef`, not the raw `context` prop: Phase 6's form memoizes the
      // context into `contextRef` and every other call site in the file
      // (the draft token, the submit payload, the label) reads it. Mixing the
      // two spellings in one function is how the two drift apart later.
      const contactTarget = contactTargetTypeForContext(contextRef.type);
      if (contactTarget) {
        requestContactAccessRefresh(contactTarget, contextRef.id);
      }
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd frontend && pnpm test && pnpm lint && pnpm build
```
Expected: 5 passed in this file (three seam tests plus the two `contactTargetTypeForContext` cases), Phase 6's own `InquiryForm.test.tsx` still passes unchanged (it asserts the `submitInquiry` payload and the confirmation, neither of which this edit touches), and the whole frontend suite is green.

Then prove the dispatch is load-bearing rather than incidental: comment out the `requestContactAccessRefresh` call and confirm the first seam test goes red; restore it. Record that in the PR description.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/api/contacts.ts frontend/src/components/inquiry/InquiryForm.tsx frontend/src/components/contact/inquiry-refresh.test.tsx
git commit -m "feat(frontend): refresh contact authorization after a successful inquiry"
```

---

### Task 12: Spec §40 Scenario A/B acceptance and the phase handoff note

**Files:**
- Create: `backend/messaging/tests/test_phase7_acceptance.py`
- Modify: `ACTIVITY.md` (one appended log entry at the top of the Log section)

**Interfaces:**
- Consumes: everything Tasks 1–11 produced, plus Phase 6's `POST /api/v1/inquiries/` and `messaging.enums.CURRENT_PRIVACY_POLICY_VERSION` (**reconciliation row 9** — re-read the merged serializer's field names and error codes before writing these tests).
- Produces: no new symbols. The deliverable is spec §40 Scenarios A and B proved end to end, and the §39 handoff note.

- [ ] **Step 1: Write the failing test**

`backend/messaging/tests/test_phase7_acceptance.py`:

```python
"""Spec §40 Scenarios A and B, and spec §16's four acceptance tests, proved
across the Phase 6 + Phase 7 seam with no mocking of either side."""

import threading

import pytest
from common.throttling import HashedIPScopedRateThrottle
from django.db import connection
from rest_framework.test import APIClient

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from messaging.enums import CONTACT_UNLOCK_FLAG
from messaging.enums import CURRENT_PRIVACY_POLICY_VERSION
from messaging.models import ContactAccessGrant
from platform_settings.models import FeatureFlag
from professionals.tests.factories import make_professional

RAW_EMAIL = "info@scenario-a.example"
RAW_PHONE = "+34633221100"
INQUIRY_URL = "/api/v1/inquiries/"


def enable_flags():
    for key in ("contact_unlock", "unified_inquiries"):
        FeatureFlag.objects.update_or_create(
            key=key, defaults={"is_enabled": True, "description": "acceptance"}
        )


def build_professional():
    owner = make_user(email="scenario-a-owner@example.com", role=UserRole.SERVICE_PROVIDER)
    return make_professional(
        owner,
        display_name="Scenario A Marine",
        slug="scenario-a-marine",
        public_email=RAW_EMAIL,
        public_phone=RAW_PHONE,
    )


def contact_url(professional):
    return f"/api/v1/contacts/professional/{professional.pk}/"


def inquiry_body(professional, **overrides):
    """Phase 6's `InquirySubmissionSerializer`, field for field (reconciliation
    row 9 — re-read the merged serializer before changing a name here).

    Three of these are easy to get wrong and each would fail the whole file:
    * `message` is the WIRE name; the service parameter underneath is `body`.
    * `email` MUST equal the authenticated actor's address — `validate_email`
      raises `email_mismatch` otherwise, so the fixture user's email and this
      value are the same string on purpose.
    * `privacy_consent` is a separate required-in-effect boolean: it is declared
      `BooleanField(required=False, default=False)`, and `validate()` raises
      `ConsentRequired` when it is falsy. Sending only
      `privacy_policy_version` is a 400, not a 201.
    The honeypot (`HONEYPOT_FIELD_NAME`) is deliberately omitted: it defaults to
    `""`, and repeating its name here would duplicate a constant Phase 6 owns.
    """
    body = {
        "context_type": "PROFESSIONAL",
        "context_id": str(professional.pk),
        "full_name": "Ada Rossi",
        "email": "buyer@example.com",
        "phone": "+390000000000",
        "subject": "Question about your survey services",
        "message": "I would like to arrange a survey for a boat next week.",
        "privacy_policy_version": CURRENT_PRIVACY_POLICY_VERSION,
        "privacy_consent": True,
        "marketing_consent": False,
    }
    body.update(overrides)
    return body


@pytest.mark.django_db
def test_scenario_a_a_valid_inquiry_unlocks_exactly_that_entity():
    """Spec §40 Scenario A."""
    enable_flags()
    professional = build_professional()
    buyer = make_user(email="buyer@example.com")
    api = APIClient()
    api.force_authenticate(buyer)

    before = api.get(contact_url(professional))
    assert before.data["contact"]["state"] == "LOCKED"
    assert RAW_EMAIL not in before.content.decode()

    submitted = api.post(INQUIRY_URL, inquiry_body(professional), format="json")
    assert submitted.status_code == 201
    assert submitted.data["contact_access"] == "GRANTED"

    after = api.get(contact_url(professional))
    assert after.data["contact"]["state"] == "GRANTED"
    assert after.data["contact"]["email"] == RAW_EMAIL
    assert after.data["contact"]["phone"] == RAW_PHONE
    assert ContactAccessGrant.objects.filter(viewer=buyer, professional=professional).count() == 1


@pytest.mark.django_db
def test_scenario_a_reveals_to_that_viewer_only():
    enable_flags()
    professional = build_professional()
    buyer = make_user(email="buyer@example.com")
    api = APIClient()
    api.force_authenticate(buyer)
    api.post(INQUIRY_URL, inquiry_body(professional), format="json")

    bystander = make_user(email="bystander@example.com")
    api.force_authenticate(bystander)
    response = api.get(contact_url(professional))

    assert response.data["contact"]["state"] == "LOCKED"
    assert RAW_EMAIL not in response.content.decode()


@pytest.mark.django_db
def test_an_inquiry_without_privacy_consent_is_refused_and_grants_nothing():
    """Phase 6's serializer raises ConsentRequired when `privacy_consent` is
    falsy (spec §15.1's required checkbox, §33.2's "obtain required
    consent/version"). Also guards this file's own fixture: if the happy-path
    body were missing the flag, every 201 assertion above would be wrong."""
    enable_flags()
    professional = build_professional()
    buyer = make_user(email="buyer@example.com")
    api = APIClient()
    api.force_authenticate(buyer)

    refused = api.post(
        INQUIRY_URL, inquiry_body(professional, privacy_consent=False), format="json"
    )

    assert refused.status_code == 400
    assert refused.data["error"]["code"] == "consent_required"
    assert ContactAccessGrant.objects.count() == 0
    assert api.get(contact_url(professional)).data["contact"]["state"] == "LOCKED"


@pytest.mark.django_db
def test_an_inquiry_sent_as_somebody_elses_email_is_refused():
    """Spec §15's definition of done: the email "cannot be forged to another
    account". Phase 6's validate_email enforces it; this pins that a forged
    sender never produces a grant for the real account either."""
    enable_flags()
    professional = build_professional()
    buyer = make_user(email="buyer@example.com")
    api = APIClient()
    api.force_authenticate(buyer)

    refused = api.post(
        INQUIRY_URL,
        inquiry_body(professional, email="someone-else@example.com"),
        format="json",
    )

    assert refused.status_code == 400
    assert ContactAccessGrant.objects.count() == 0


@pytest.mark.django_db
def test_scenario_b_a_failed_inquiry_leaves_the_contact_locked():
    """Spec §40 Scenario B: "no message, notification or grant exists and raw
    contact data is absent from the response and DOM"."""
    enable_flags()
    professional = build_professional()
    buyer = make_user(email="buyer@example.com")
    api = APIClient()
    api.force_authenticate(buyer)

    # Too short for spec §15.1's 20-character minimum.
    rejected = api.post(INQUIRY_URL, inquiry_body(professional, message="no"), format="json")

    assert rejected.status_code == 400
    assert RAW_EMAIL not in rejected.content.decode()
    assert ContactAccessGrant.objects.count() == 0
    response = api.get(contact_url(professional))
    assert response.data["contact"]["state"] == "LOCKED"
    assert RAW_EMAIL not in response.content.decode()


@pytest.mark.django_db
def test_a_rate_limited_inquiry_does_not_unlock_contact(monkeypatch):
    """Spec §16: "A failed or rate-limited message does not unlock contact"."""
    enable_flags()
    professional = build_professional()
    buyer = make_user(email="buyer@example.com")
    api = APIClient()
    api.force_authenticate(buyer)
    # `inquiry_submit` is Phase 6's scope, declared at 20/hour (its contract
    # rule 15). Confirm it in the merged settings before running.
    monkeypatch.setitem(HashedIPScopedRateThrottle.THROTTLE_RATES, "inquiry_submit", "0/min")

    throttled = api.post(INQUIRY_URL, inquiry_body(professional), format="json")

    assert throttled.status_code == 429
    assert ContactAccessGrant.objects.count() == 0
    assert api.get(contact_url(professional)).data["contact"]["state"] == "LOCKED"


@pytest.mark.django_db(transaction=True)
def test_concurrent_duplicate_inquiries_create_exactly_one_grant():
    """Spec §16: "A successful transaction creates exactly one grant despite
    concurrent duplicate requests". The constraint that makes this true is
    Phase 6's; if this fails, the fix belongs there — escalate, do not relax
    the assertion."""
    enable_flags()
    professional = build_professional()
    buyer = make_user(email="buyer@example.com")
    body = inquiry_body(professional)

    def attempt():
        try:
            client = APIClient()
            client.force_authenticate(buyer)
            client.post(INQUIRY_URL, body, format="json")
        finally:
            connection.close()

    threads = [threading.Thread(target=attempt) for _ in range(2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert ContactAccessGrant.objects.filter(viewer=buyer, professional=professional).count() == 1


@pytest.mark.django_db
def test_staff_revocation_takes_effect_immediately_after_a_real_inquiry():
    """Spec §16: "Staff can revoke grants for abuse"."""
    from django.contrib.auth.models import Group

    from accounts.enums import StaffGroup

    enable_flags()
    professional = build_professional()
    buyer = make_user(email="buyer@example.com")
    api = APIClient()
    api.force_authenticate(buyer)
    api.post(INQUIRY_URL, inquiry_body(professional), format="json")
    grant = ContactAccessGrant.objects.get(viewer=buyer, professional=professional)

    moderator = make_user(email="acceptance-moderator@example.com", role=UserRole.STAFF)
    moderator.groups.add(Group.objects.get(name=StaffGroup.MODERATOR))
    api.force_authenticate(moderator)
    api.post(
        f"/api/v1/staff/contact-grants/{grant.pk}/revoke/",
        {"reason": "Acceptance check"},
        format="json",
    )

    api.force_authenticate(buyer)
    response = api.get(contact_url(professional))

    assert response.data["contact"]["state"] == "LOCKED"
    assert RAW_EMAIL not in response.content.decode()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest messaging/tests/test_phase7_acceptance.py -v`
Expected: this task adds **no production code**, so the honest expectation is that these eight tests pass once Phase 6's endpoint behaves as its plan says. Treat any failure as one of three things, and say which in the PR description: (a) a real Phase 7 defect — fix it here; (b) a Phase 6 defect — escalate to the controller, do not work around it; (c) a wrong assumption in this test about Phase 6's request body or throttle scope — fix the test against the merged code and update reconciliation row 9.

- [ ] **Step 3: Write the handoff note**

Append to the top of `ACTIVITY.md`'s Log section (substitute the real counts from your own test output — they are read off Step 4's runs, not guessed):

```markdown
### 2026-09-18 — Phase 7 (contact privacy, blur and reveal) complete

**Migrations added:** `messaging/0004_seed_contact_unlock_flag` (seeds the
`contact_unlock` flag **disabled**; reverse is a no-op so a rollback never
deletes an operator-toggleable row) and
`messaging/0005_contactaccessgrant_first_revealed_at` (one nullable column;
additive and backwards-compatible — old code ignores it).

**Models/services/endpoints/components:** no new model. New
`messaging.masking`, `messaging.contact_access` (`resolve_contact_access`,
`record_first_reveal`, `revoke_contact_access`), `messaging.contact_payloads`
and `messaging.contact_views`. New endpoints `GET
/api/v1/contacts/<target-type>/<id>/` (spec §30.1) and `POST
/api/v1/staff/contact-grants/<id>/revoke/` (**an addition to §30.1's
inventory**, see the plan's Contract summary). New frontend
`lib/api/contacts.ts`, `lib/i18n/contact.ts` and `components/contact/
ContactPanel.tsx`, mounted on the professional detail page.

**Permissions and audit:** the read endpoint is `AllowAny` (guests see the
masked locked state) and both views extend `messaging.views.MessagingAPIView`;
revocation requires `IsActiveUser + IsStaffModerator`. Staff moderators and
admins reveal without a grant, honouring the `reveal_any_contact` capability
`GET /api/v1/session/` already advertises. Audit events added:
`contact_access.revealed` (once per grant, on first delivery),
`contact_access.staff_revealed` (every grant-less staff read) and
`contact_access.revoked`. None carries a contact value. Every reveal response
carries `Cache-Control: private, no-store, max-age=0` and
`Vary: Authorization, Cookie`.

**Tests added and results:** <N> new backend tests and <M> new frontend tests,
all green; full suites `uv run pytest -q` and `pnpm test` green. The
adversarial leak sweep (`test_contact_leak_sweep.py`) was mutation-checked by
temporarily adding a raw key to `locked_payload()` and confirming it goes red.

**Feature flag state:** `contact_unlock` seeded **disabled**. With it off the
endpoint still answers and always answers LOCKED; grants keep being created by
the inquiry flow. Enable it at spec §35.2 step 8.

**Known limitations:** see the plan's Known Limitations section — the broker
profile page and the listing-page contact panel are Phase 20's mount, and
recipient-blocking-driven revocation (spec §36.6) has a service but no caller.

**Screenshots:** locked, granted and unavailable panel states attached to the
Task 10 PR, and the locked-to-unlocked transition after a real send attached to
the Task 11 PR.
```

- [ ] **Step 4: Run the full verification**

```bash
cd backend && uv run pytest -q
cd ../frontend && pnpm test && pnpm lint && pnpm build
```
Expected: both suites green. Record the exact counts in the handoff note before committing.

- [ ] **Step 5: Commit**

```bash
git add backend/messaging/tests/test_phase7_acceptance.py ACTIVITY.md
git commit -m "test(messaging): prove spec 40 scenarios A and B across the inquiry/contact seam"
```

---

## Contract summary for later phases

**Endpoints shipped by this phase**, against spec §30.1's literal inventory:

| Endpoint | §30.1 |
|---|---|
| `GET /api/v1/contacts/<target-type>/<id>/` | listed |
| `POST /api/v1/staff/contact-grants/<id>/revoke/` | **added by this phase — not in §30.1's table** |

The addition is deliberate and flagged rather than presented as spec-literal: §16 requires "Staff can revoke grants for abuse" and §36.6 makes revocation the default remedy for a block, but §30.1 lists no route for either. §30.1's closing sentence grants the latitude ("Exact URL naming may follow an established API convention, but semantics, authorization and errors must remain equivalent"), and Phase 11 set the precedent with `POST /api/v1/listings/<id>/withdraw/`. A later phase publishing an API inventory must list it as a Phase 7 addition.

Everything a downstream phase imports from Phase 7, in one place.

```python
from messaging.contact_access import (
    TARGET_TYPE_BY_SEGMENT,
    UNLOCK_RULE,
    ContactAccess,
    ContactGrantAlreadyRevoked,
    ContactTarget,
    ContactTargetNotFound,
    GrantedContact,
    LockedContact,
    UnavailableContact,
    record_first_reveal,
    record_staff_reveal,
    resolve_contact_access,
    resolve_contact_target,
    revoke_contact_access,
)
from messaging.contact_payloads import (
    contact_payload,
    granted_payload,
    locked_payload,
    staff_grant_payload,
    unavailable_payload,
)
from messaging.contact_views import (
    CACHE_CONTROL_HEADER,
    VARY_HEADERS,
    ContactAccessView,
    StaffContactGrantRevokeView,
    apply_no_store,
)
from messaging.enums import CONTACT_UNLOCK_FLAG  # appended to Phase 6's enums.py
from messaging.masking import MASK_CHARACTER, mask_email, mask_phone
from messaging.tests.contact_factories import make_contact_grant
```

```ts
// frontend
import ContactPanel from "@/components/contact/ContactPanel";
import {
  CONTACT_ACCESS_REFRESH_EVENT,
  contactAccessPath,
  contactTargetTypeForContext,
  fetchContactAccess,
  requestContactAccessRefresh,
  type ContactAccess,
  type ContactAccessRefreshDetail,
  type ContactTargetType,
  type GrantedContact,
  type LockedContact,
  type UnavailableContact,
} from "@/lib/api/contacts";
import { CONTACT_MESSAGES, tContact, type Locale } from "@/lib/i18n/contact";
```

Rules a later phase must follow:

1. **No contact value reaches any response except through `contact_payloads.granted_payload`.** Phase 5's contract rule 1 (never add `public_email`, `public_phone` or `website_url` to a directory serializer) now extends to every serializer in the project, including `PublicListingSerializer`, the broker serializers and anything Phase 19/20 adds. There is exactly one authorized exit, and it is behind a grant.
2. **Never give `LockedContact` a raw field, and never merge the three result types into one class with nullable fields.** The separation is the phase's central control: a serializer bug cannot leak what the object does not carry. `test_the_locked_result_has_no_attribute_that_could_hold_a_raw_value` fails if someone tries.
3. **The contact panel stays a client component.** Never fetch contact access from a server component, `generateMetadata`, a sitemap entry, a route handler that renders into HTML, or anything whose result lands in an RSC payload (spec §16: not in "page source … or preloaded JSON").
4. **Mount `<ContactPanel targetType={…} targetId={…} locale={…} />`; never build a second contact UI.** Phase 19's broker dashboard and Phase 20's broker profile and listing pages reuse this component, exactly as spec §29.2/§29.3 require one shared "contact card position".
5. **After a successful inquiry, call `requestContactAccessRefresh(targetType, targetId)`.** Spec §16: "After successful send, refetch contact authorization; do not rely on client-side unblur alone." Task 11 wires this into Phase 6's `InquiryForm` for the broker and professional contexts; a new inquiry surface (Phase 16's create flow, Phase 19's dashboard, Phase 20's listing page) must keep the call, and must use `contactTargetTypeForContext()` rather than lower-casing the context type itself — `LISTING` maps to `null` for a reason. Never flip the panel to granted client-side; the second answer is the server's to give.
6. **Every revocation goes through `revoke_contact_access()`** — including the one spec §36.6 requires when a recipient blocks a user. It holds the row lock, the state check and the audit event together; a direct `revoked_at` write skips all three.
7. **A private seller is never a contact target.** `TARGET_TYPE_BY_SEGMENT` has exactly two entries because spec §1 scopes reveal to "broker/professional contact details". A private individual's address is not business contact data. Adding a third target type means changing spec §11.8's enum, the grant model and this map together. Relatedly, **Phase 6's `contact_access: "NOT_APPLICABLE"` is not Phase 7's `state: "UNAVAILABLE"`**: the first answers "did *this inquiry* grant anything", the second "can *this entity's* contact be shown at all". Do not map one onto the other.
8. **`messaging.masking` is the only place a masking rule lives.** Widening or narrowing disclosure means changing `EMAIL_MASK_WIDTH`, `PHONE_COUNTRY_CODE_DIGITS`, `PHONE_TRAILING_DIGITS` or `PHONE_MINIMUM_DIGITS` and the tests that pin them — never building a second mask at a call site.
9. **`contact_unlock` gates revealing, never locking.** A future flag change must keep "flag off ⇒ LOCKED" true; the fail-closed direction is the only safe one.
10. **Adding a key to any contact payload is a deliberate act.** `test_contact_payloads.py` asserts exact key sets in both directions, so a new key fails the suite. Change the test in the same commit, with a written reason.
11. **Never put a contact value in a log, an audit `before`/`after`/`metadata`, an error message or an exception argument** (spec §33.5). `test_contact_leak_sweep.py` scans rendered bytes and every log-record attribute for exactly this.
12. **Any new contact-bearing response keeps the `no-store` headers.** Call `apply_no_store()` from the view's `finalize_response`, so the error paths are covered too. A per-viewer payload on a shared URL is cacheable-by-accident until something says otherwise, and nothing else in this codebase says otherwise.
13. **Both views extend `messaging.views.MessagingAPIView`** (Phase 6 contract rule 11). A third contact endpoint extends it too, or it answers `not_authenticated`/`throttled` where the rest of the API says `authentication_required`/`rate_limited`.
14. **Staff reveal is `accounts.services.is_staff_moderator` and nothing else.** It is the same predicate `accounts.selectors` uses for the session payload's `reveal_any_contact`; a second definition would let the advertised capability and the honoured one drift. A staff reveal reports `granted_at: null` and writes `contact_access.staff_revealed` on every request.
15. **Phase 20, to mount the panel on a listing page, must first add a broker identifier to the public listing payload.** `PublicListingSerializer` today emits `id`, `seller_type`, snapshot content, price, media and `view_count` and **no broker reference at all**, so a listing page cannot currently resolve which broker to ask about. Add `broker_id` (an id, not a contact field) under Phase 11's rule 9 — extend the one serializer, do not create a second representation.

---

## Known Limitations

1. **No broker profile page and no listing page mount.** The backend serves `broker` targets and Task 7 sweeps them end to end, but `frontend/src/app/` has no broker profile route and no listing detail route: spec §29.2 is Phase 20's and the listing page is Phase 16/20's. The only mounted panel in this phase is on the professional detail page.
1a. **`UNAVAILABLE` is unreachable on the only mounted surface.** `fetchProfessional` returns `null` for a non-`ACTIVE` profile (Phase 5's detail endpoint filters `status=ACTIVE`), so the professional page calls `notFound()` before the panel ever renders — a suspended professional's page is a 404, not a page with an "unavailable" panel. The state is real, correct and tested at the API level, and it becomes visible the moment a surface exists that outlives its entity's suspension: a grant holder's conversation thread (Phase 19) or the broker profile (Phase 20). Named here so nobody reads the untested-on-screen state as dead code and deletes it.
2. **Spec §16's "applies across that entity's profile and listings" is enforced but only half-demonstrated.** The grant is keyed on `(viewer, entity)`, never on a listing, so it *does* apply everywhere; but until Phase 20 renders a listing page there is no second surface to see it on.
3. **`PublicListingSerializer` carries no broker identifier** (verified against the merged Phase 11 code), so Phase 20 has a prerequisite before it can mount the panel on a listing — Contract rule 15.
4. **A broker-owned *listing* inquiry does not refresh a contact panel.** Task 11 dispatches the refresh for `BROKER` and `PROFESSIONAL` contexts only. A `LISTING` context grants the owning broker's contact, but the inquiry form carries the listing's id, not the broker's, and the public listing payload has no broker reference (Known Limitation 3). Phase 20, when it mounts the panel on a listing page, dispatches with the broker id it will by then have. Until then there is no listing page, so nothing is broken — only unbuilt.
5. **Spec §36.6's block-driven revocation has a service but no caller.** `revoke_contact_access()` is complete and tested; nothing calls it except the staff endpoint, because no block action exists anywhere in §30.1. Whichever phase ships blocking (Phase 6 if it ships `Conversation.status = BLOCKED` transitions, otherwise Phase 19) must call it.
6. **There is no staff UI, and no endpoint to *find* a grant.** Revocation needs the grant's UUID, which today comes from Django admin or the database. Spec §26 (Phase 17) owns staff screens; a `GET /api/v1/staff/contact-grants/` list belongs there, not here.
7. **`UNAVAILABLE` discloses that a suspended entity exists** to anyone holding its UUID, where `DRAFT`/`PENDING` return 404. This is the deliberate ruling above (a suspended entity was previously public), but it is a disclosure and is recorded as one. UUIDs are unguessable, so the practical exposure is limited to someone who already had the id.
8. **The email mask discloses the domain and the first character of the local part**, exactly as spec §16's own example does. For a business address the domain is ordinarily public; for a personal one it is a real, accepted disclosure.
9. **The phone mask discloses `+CC` and the final digit**, again from spec §16's example. With the country code known from the profile's location anyway, the marginal disclosure is one digit. It no longer discloses length.
10. **`first_revealed_at` records the first delivery only.** There is no per-request access log, deliberately (see the ruling), so "how many times did this viewer look at the number" is not answerable. If §35.4's "review contact-access failures" later needs more, it needs a metric, not an audit row per GET.
11. **The granted payload is read live from the entity row.** Spec §36.6 requires exactly this ("An entity changing public phone/email updates the revealed current business contact"), so there is no snapshot and no history of what a viewer saw at reveal time.
12. **The panel always renders in `DEFAULT_LOCALE`** on the professional page, because Phase 5's `page.tsx` pins `const locale = DEFAULT_LOCALE`. The component itself is fully localized and takes `locale` as a prop; the page-level locale negotiation is Phase 20's (spec §29) to fix once, for the whole route.
13. **Guests are throttled per hashed IP and authenticated viewers per user id**, which is DRF's `ScopedRateThrottle` behaviour, not a decision this phase made. It means one office NAT shares the guest budget for the contact endpoint. `contact_access` is set at 120/min partly for that reason.
14. **The reconciliation table is checked against Phase 6's *plan* (merged, PR #116, through its fix round 2), not against its merged code**, which does not exist yet. Every row reads **Verified** against that text; the table is re-checked against real code before Task 1 regardless.
15. **The staff revocation `reason` is the one audited field this phase does not control the content of.** It is up to 500 characters of free text, typed by a moderator, stored in `AuditEvent.metadata["reason"]` and therefore exempt from the "no contact value in an audit payload" rule that every other field here obeys — a moderator who pastes the reported user's phone number into it has put a contact value in an audit row, and no test can catch that. It is kept because §36.6 frames revocation as an abuse remedy and an unexplained one is not auditable. If this ever needs tightening, the fix is a structured reason code plus an optional note, not a regex over free text; Phase 17, which builds the staff screens, is where that decision belongs.
16. **Staff reveals are audited per request, so a staff member browsing many profiles writes many audit rows.** That is the intended trade (spec §33.1), but it means `contact_access.staff_revealed` is the noisiest action this phase writes. If it ever becomes a volume problem, the fix is a metric, not a quieter audit.
17. **No CAPTCHA or risk scoring on the reveal path.** Spec §15.1 permits CAPTCHA "only behind a risk threshold"; the reveal itself is not a submission, and the abuse control here is the grant requirement plus the throttle plus staff revocation.

---

## Self-Review

**Spec coverage — §16 (Phase 7), line by line:**

| Spec §16 requirement | Where implemented |
|---|---|
| Public broker/professional responses never include raw contact strings when access is absent | Tasks 2 (`LockedContact` has no raw attribute), 3 (exact key sets), 7 (wire-level sweep of every unauthorized shape) |
| Locked payload `state`/`email_mask`/`phone_mask`/`unlock_rule` | Tasks 1, 2, 3 |
| Granted payload `state`/`email`/`phone`/`granted_at` | Tasks 2, 3 (+ `website_url`, ruled) |
| Locked email/phone use a non-selectable blur/mask treatment plus lock icon and text | Task 9 (`select-none blur-[2px]`, `lock` glyph, the spec-literal sentence) |
| Never in HTML, page source, CSS pseudo-content, `aria-label`, analytics payload or preloaded JSON | Tasks 9 (the aria-label/title test), 10 (the HTTP page-source check) + the client-component ruling |
| Accessibility: screen readers hear the masked value and unlock explanation | Task 9 (the mask is not `aria-hidden`; only the glyph is) + Task 10's manual screen-reader check |
| After successful send, refetch contact authorization; do not rely on client-side unblur | Tasks 8 (`requestContactAccessRefresh`), 9 (the listener), **11 (the dispatch from Phase 6's real form, proved end to end)** |
| Grant scoped to `(viewer, broker)` / `(viewer, professional)`, applying across profile and listings | Task 2 (the queryset is keyed on the entity, never on a listing or conversation) |
| Staff can revoke grants for abuse | Task 6 |
| Suspended entity contact becomes unavailable | Tasks 2 (`UnavailableContact`, checked before the grant), 3, 9 |
| Acceptance: inspecting DOM/network as an unauthorized user reveals no raw contact data | Tasks 7, 10 |
| Acceptance: sending to Broker A does not unlock Broker B | Tasks 2, 7 |
| Acceptance: a failed or rate-limited message does not unlock contact | Task 12 |
| Acceptance: one grant despite concurrent duplicate requests | Task 12 (and Task 4 proves the same property for the reveal marker) |
| Never makes contact data public (spec §1) — including via a cache | Task 5 (`no-store` plus `Vary` on every response path), Task 8 (`cache: "no-store"` on the fetch), Task 7 (header assertions, compared as a set because corsheaders appends `origin`) |

**Spec coverage — the sections §16 depends on:** §1's contact-reveal decision → Global Constraints + Tasks 2/6. §2.1 (every visible state has a backend source) → the panel renders only what the endpoint returned; there is no client-side lock state. §2.4 (contact reveals are audited) → Task 4 (`contact_access.revealed`) plus Phase 6's `contact_access.granted`, with Task 6 adding `contact_access.revoked`. §5's "Reveal recipient contact after inquiry" row → `own access` for every ordinary role is Task 2's viewer-scoped grant lookup plus Task 2's "another viewer's grant does not unlock for me"; the **bare ✓ for staff moderator and staff admin** is Task 2's `is_staff_moderator` branch, audited by Task 4's `contact_access.staff_revealed` and asserted over HTTP in Task 5. An earlier draft of this plan misread that row as "own access" for staff and left the branch out; `accounts/selectors.py:44` already advertises the capability as `reveal_any_contact`, so the omission would have made the session payload lie. §11.8's grant fields → consumed as Phase 6 defines them, with one additive column. §14.2's blurred contact panel "governed by ContactAccessService" → Tasks 9, 10, closing Phase 5's `PHASE 7 SEAM`. §29.6's "contact lock explanation remains readable without relying on hover" → the explanation is body text, not a tooltip. §30.1 → the contact endpoint, plus one flagged addition. §30.2 → the error envelope, ISO-8601-Z times, `X-Request-ID`, and "mutations return updated resource" for the revoke response. §30.4 → two new throttle scopes on Phase 3's hashed-IP throttle. §31's `Blurred phone/email | ContactAccessService | grant after successful inquiry | locked explanation` row → all four cells have a named implementation. §33.2's consent/privacy-notice items belong to Phase 6 (consent capture) and Phase 22 (the notice text); this phase's contribution is that contact unlock logs exist and contain no contact values. §33.5 → Task 7's log sweep and the audit-payload assertions in Tasks 4 and 6. §34.3's "Locked contact response contains no raw contact value" and §34.7's "Raw contact data is absent from unauthorized responses/DOM" → Task 7 and Task 10. §35.1's `contact_unlock` → Task 2's seed migration and the flag-off tests in Tasks 2 and 7. §36.6's four bullets → "empty/spam content does not create access" is Phase 6's validation; blocking-driven revocation is a documented seam; "an entity changing public phone/email updates the revealed contact" is satisfied by reading live (Known Limitation 10); "not transferable between accounts" is Task 2's per-viewer test. §37's `contact.locked_explanation` and `contact.unlocked` → Task 8, with all three languages. §39 → the per-task TDD structure, the HTTP-level red-to-green in Task 10, the "no visual-only implementation" ruling behind the client-component design, and Task 12's handoff note. §40 Scenarios A and B → Task 12.

**Placeholder scan:** no "TBD", "TODO", "implement later", "add appropriate error handling", "handle edge cases", "write tests for the above" or "similar to Task N" appears anywhere. Every code step carries real code; every test step carries real test code. Three constructs could be mistaken for placeholders and are not: (a) the `<next>`-style migration numbers were resolved to `0004`/`0005` once Phase 6's plan was readable, and the remaining instruction is to *confirm* with `ls`, which is verification, not a decision; (b) the `<N>`/`<M>` tokens in Task 12's ACTIVITY entry are counts the executor reads off their own test output, with an explicit instruction to substitute them; (c) the "Phase 6 reconciliation" table now reads Verified on every row, and the one standing instruction — re-check it against Phase 6's *merged code* before Task 1, because that plan is still taking fix rounds — is verification, not an unmade decision.

**Type consistency:** `LockedContact`, `GrantedContact` and `UnavailableContact` are defined once in `contact_access.py` and referenced by those exact names in `contact_payloads.py`, `contact_views.py`, four test modules and the Contract summary. Their `state` values (`"LOCKED"`, `"GRANTED"`, `"UNAVAILABLE"`) are `ClassVar`s read through the class in `contact_payloads.py`, so the wire strings and the Python types cannot drift. `resolve_contact_access(*, viewer, segment, target_id)` keeps that signature in Tasks 2, 5 and every test; `record_first_reveal(*, grant_id, actor, request_id=None)`, `record_staff_reveal(*, segment, target_id, actor, request_id=None)` and `revoke_contact_access(*, grant_id, actor, reason, request_id=None)` likewise. `grant_id` is the parameter name in both grant-addressed functions, and `GrantedContact.grant_id` — `None` exactly on the staff-bypass path — is both what Task 5 passes and what it branches on to choose between the two audit functions. `TARGET_TYPE_BY_SEGMENT` maps the two URL segments to Phase 6's `ContactTargetType` members, and `ContactTarget.grant_field` is the only place the segment→FK-column mapping exists. On the frontend, `ContactAccess` is declared once in `lib/api/contacts.ts` as the union of three interfaces discriminated on `state`, whose members match the backend builders' key sets one for one (`email_mask`/`phone_mask`/`unlock_rule`; `email`/`phone`/`website_url`/`granted_at`); `Locale` is imported from `lib/api/directory` and re-exported by `lib/i18n/contact`, never redeclared (Phase 5 contract rule 12). The component is `ContactPanel` (default export of `ContactPanel.tsx`) in Tasks 9, 10 and the Contract summary; `tContact` is deliberately not named `t`, so a module importing both dictionaries has no collision. `CONTACT_ACCESS_REFRESH_EVENT` and `ContactAccessRefreshDetail` are used with the same shape in the dispatcher (Task 8) and the listener (Task 9). Backend audit action strings (`contact_access.revealed`, `contact_access.staff_revealed`, `contact_access.revoked`) appear identically in the services and their assertions, and none collides with Phase 6's `contact_access.granted`. `contactTargetTypeForContext` returns the same `ContactTargetType` union `requestContactAccessRefresh` accepts, so Task 11's call site type-checks without a cast.

**Gaps found and closed during review:**

1. The first draft filtered grants by hard-coded `"BROKER"`/`"PROFESSIONAL"` strings to stay independent of Phase 6. Once Phase 6's plan confirmed `messaging.enums.ContactTargetType`, the literals were replaced with the enum — one vocabulary, not two that happen to agree.
2. The first draft's `contact_factories.make_contact_grant` built `ContactAccessGrant.objects.create(...)` directly, bypassing Phase 6's `make_grant`, and created its conversation without a `conversation_type` — which `Conversation`'s context constraint would have rejected for a professional target. It now wraps Phase 6's two factories and passes the matching `ConversationType`.
3. `revoke_contact_access` originally saved with `update_fields=["revoked_at"]`, which would silently leave `updated_at` stale. Phase 6's plan confirms the model carries `updated_at`, so the field list now includes it, with a one-line note for the case where it does not.
4. The locked email mask was originally length-preserving (`"info"` → four bullets). That reproduced neither spec §16's example nor the privacy property, and would have leaked the local part's length; it is now fixed-width, with a test that two very different addresses produce masks of equal width.
5. Task 7's sweep originally had no positive control, so every assertion in it could have passed vacuously with a fixture that never carried the values. `test_the_granted_path_is_the_only_one_that_can_produce_the_values` was added, and Step 2 now prescribes an explicit mutation check.
6. (fix round 1) The plan's own §5 coverage row misquoted the spec — it claimed staff hold "own access" — and the service had no staff branch, while `accounts/selectors.py:44` has been shipping `reveal_any_contact: is_staff_moderator(user)` in the session payload since Phase 3. The branch, its audit action and its `granted_at: null` payload were added, with tests that it does **not** bypass the rollout flag or a suspension.
7. (fix round 1) Nothing set a cache header on the reveal endpoint, and nothing in `backend/` sets one anywhere — so the one URL that answers differently per viewer was the one URL with no `Cache-Control` and no `Vary`. `finalize_response` now stamps `private, no-store, max-age=0` and adds `Authorization`/`Cookie` to `Vary` on every path including the errors, the browser fetch sends `cache: "no-store"`, and both the API tests and the leak sweep assert it.
8. (fix round 1) `ContactPanel` fetched in a mount effect while `SessionProvider` was still trading the refresh cookie for an access token. The first request went out anonymous, this endpoint answers **200** LOCKED to an anonymous caller, so `apiFetch`'s 401-refresh-retry never fired — a grant holder would have seen a locked panel until they reloaded. The panel now waits for `loading` to clear and re-asks when the viewer identity changes.
9. (fix round 1) Nothing dispatched the refresh event: Phase 6's `InquiryForm` only sets `sent = true`. Task 11 was added to wire it, with an end-to-end test that drives the real form and asserts the real panel changes state — the previous test dispatched the event by hand and would have passed with no dispatcher in existence.
10. (fix round 1) `inquiry_body()` in the acceptance tests omitted `privacy_consent`, which Phase 6's serializer defaults to `False` and then rejects with `ConsentRequired` — every Scenario A assertion would have failed on a 400. Fixed, with two new tests pinning the consent and email-forgery refusals so the fixture cannot silently rot again.
11. (fix round 1) The phone mask emitted `len(digits) - 2` bullets, so its width was the number's length — the disclosure the "masks never reveal length" constraint claims to prevent. It is now fixed width, with a test comparing a 9-digit and a 12-digit number.
12. (fix round 1) Both views extended DRF's `APIView`, which Phase 6's contract rule 11 forbids for messaging endpoints: they would have answered `not_authenticated`/`throttled` where the rest of the API says `authentication_required`/`rate_limited`. Both now extend `MessagingAPIView`, and the 401/429 assertions name the right codes.
13. (fix round 1) The leak sweep never exercised a broker target end to end, never touched `/api/v1/listings/`, never checked the staff revoke bodies, never asserted a header, and omitted `website_url` from its secret list although the fixture set one. All added, plus a second positive control and five prescribed mutation checks — including one proving the log scan catches a value passed via `extra=` rather than in the message, which the previous near-vacuous version would have missed.
14. Task 2 originally re-derived "active grant" with its own queryset, to stay independent of a Phase 6 selector whose signature was not yet written. Once `active_contact_grant(viewer, *, broker=None, professional=None)` was readable, the queryset was replaced by a call to it: two definitions of "active grant" that agree today are two that can disagree after the first change to either.
15. (fix round 2) Four `Vary` assertions could never have passed: corsheaders' `CorsMiddleware` appends `origin` to every response (`patch_vary_headers(response, ("origin",))`, `CORS_URLS_REGEX` defaulting to `^.*$`), so the emitted header is `Authorization, Cookie, origin` and a string-equality assertion fails on every request — including inside Task 7's mutation check C, which would then have "gone red" for the wrong reason. Both helpers now compare `Vary` as a set, and `apply_no_store` uses `patch_vary_headers` rather than assignment, so it merges with whatever other middleware legitimately added.
16. (fix round 2) The round-1 staff bypass broke the frontend it was not tested against: `contacts.ts` typed `granted_at: string`, the staff path returns `null`, and `ContactPanel` called `.slice(0, 10)` on it — a TypeError that unmounts the whole panel for every staff viewer of every profile, on the one page this phase actually mounts. The type is now `string | null`, the date line is guarded, and a Task 9 test renders exactly that payload.
17. (fix round 2) `test_the_flag_ships_disabled` was order-dependent: Phase 6's `_messaging_reference_rows` re-seeds `unified_inquiries` after a `transaction=True` flush precisely because `post_migrate` does not restore data-migration rows — and this phase adds two such tests while seeding nothing. The conftest edit now adds the `contact_unlock` row too, and the test's docstring says what it proves and what it does not.
18. (fix round 2) Every "N passed" line was recounted programmatically rather than by eye; four were wrong (`test_masking` 10→11, `test_contact_api` →18, `test_contact_revocation` 11→10, `ContactPanel` 13→14), and each now states how the parametrized cases make up the total.
19. Task 10's HTTP check originally expected the *locked explanation* in the server-rendered HTML, which would have been wrong — and worse, a passing version of that assertion would have meant the panel was rendering server-side, the exact thing the privacy design forbids. The check now asserts the heading is present and the explanation is **absent** from the server HTML, with the browser screenshot covering the rendered state.
