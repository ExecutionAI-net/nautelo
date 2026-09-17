# NAUTA Phase 11 — Listing Workflow, Revisions and Immutable Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `listings` Django app — `BoatListing`, `ListingSnapshot`, `ListingRevision` and `ListingMedia` plus the full draft → submit → staff decision → immutable public snapshot workflow, with private-seller field immutability after first publication, staff-authored correction revisions, optimistic locking on every edit submission, and an audit event for every decision — so that no pending listing can leak publicly, no locked field can be changed server-side, and an approved public version survives a rejected edit.

**Architecture:** One new Django app, `listings`, under `backend/`, following the layout the existing `taxonomy`/`finance`/`platform_settings` apps established (flat, single-responsibility modules at the app root plus a `tests/` package). Public pages never read mutable draft state: every published byte comes from an immutable `ListingSnapshot` row that an approved `ListingRevision` produced. Draft *content* lives in `ListingRevision.payload` (a JSON document validated against an explicit schema); the columns spec §11.4 enumerates on `BoatListing` are the queryable, database-constrained projection of that payload, rewritten in the same transaction. Every state-changing write goes through a domain service in its own module (`drafts.py`, `submissions.py`, `decisions.py`), never through a view or serializer, and every one of those services performs a conditional `UPDATE ... WHERE version = <expected>` compare-and-swap so two browsers or two moderators can never silently overwrite each other.

**Tech Stack:** Python 3.13 + `uv`, Django 5.2, Django REST Framework, PostgreSQL 16 (via the repo's `docker-compose.yml`, Postgres on `127.0.0.1:5433`), Redis (existing cache backend, used here only for the `platform_settings` feature-flag/settings cache). No new third-party dependencies.

**Spec:** [`NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md`](../../../NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md) — §20 (Phase 11, the primary source), §6.1/§6.2 (listing and revision state machines), §11 preamble (UUID pks, UTC timestamps, `Decimal` money), §11.4 (`BoatListing`, `ListingSnapshot`, `ListingRevision`), §11.5 (`ListingMedia`), §2 (non-negotiable implementation principles), §5 (roles and permissions), §10.2 (audit event), §13.4 (`listing.other_model_submitted`), §25.1/§25.3 (policy capabilities and field locking — the frontend half is Phase 16), §26.2 (staff decision rules), §30.1–§30.3 (endpoints, response envelope, concurrency), §34.1/§34.2/§34.3 (required test classes), §35.1 (`listing_revisions` feature flag), §36.4/§36.5 (listing moderation and media edge cases), §39 (developer execution protocol), §40 Scenario I (immutable fields and revision). Structural templates and "what already exists" reference: [`2026-09-17-phase-4-brand-model-taxonomy.md`](2026-09-17-phase-4-brand-model-taxonomy.md), [`2026-09-17-phase-8-finance-calculation-engine.md`](2026-09-17-phase-8-finance-calculation-engine.md), [`2026-09-17-phase-3-identity-organizations-permissions.md`](2026-09-17-phase-3-identity-organizations-permissions.md).

---

## Prerequisite: Phase 3 must be merged first

This plan is written to be **implemented after spec Phase 3 (identity, organizations and permissions) has fully merged into `dev`**, and can be written/reviewed before that happens. As of writing, only Phase 3's Task 1 (the custom `accounts.User` model) is implemented; Tasks 2–12 — including the `brokers` app, the DRF permission classes and the shared error envelope — are not yet in `dev` (`backend/` currently contains only `common`, `audit`, `finance`, `taxonomy`, `platform_settings`).

Every name this plan imports from Phase 3 comes from the "Contract summary for later phases" block at the end of `docs/superpowers/plans/2026-09-17-phase-3-identity-organizations-permissions.md`, and this plan obeys that block's numbered rules (FK via `settings.AUTH_USER_MODEL`, inherit `common.models.UUIDTimeStampedModel`, never trust `seller_type`/`owner_user`/`broker` from a request body, protect objects with `IsOwnerOrBrokerEditor`, gate submission with `IsEmailVerified`, gate staff endpoints with `IsStaffModerator`/`IsStaffAdmin`). Specifically, this plan consumes:

```python
from accounts.enums import SellerType, UserRole
from accounts.permissions import (
    IsActiveUser, IsEmailVerified, IsOwnerOrBrokerEditor, IsStaffAdmin, IsStaffModerator,
)
from accounts.services import SellerContext, resolve_seller_context
from brokers.models import BrokerOrganization
from common.exceptions import nauta_exception_handler   # extended by Task 6
```

**Before starting Task 1**, run `cd backend && uv run python -c "import accounts, brokers"` and confirm it succeeds. If it does not, Phase 3 has not merged and this plan cannot begin.

---

## Global Constraints

Every task's requirements implicitly include this section.

- Backend: Python 3.13 + `uv` for all dependency/command management, Django 5.2, DRF for every JSON API, PostgreSQL 16 (Postgres on `127.0.0.1:5433`, Redis on `127.0.0.1:6380`, both from the repo's `docker-compose.yml`).
- Backend dev server runs on port **8020**, not Django's default 8000 (standing Phase 0/1 ruling — an unrelated project occupies 8000 on this machine).
- **Use PostgreSQL in tests, never SQLite** (spec §34.2: "Use PostgreSQL in CI for tests that depend on production constraints/locking; SQLite is insufficient."). `backend/config/settings/test.py` MUST NOT be modified to override `DATABASES` or `CACHES` to SQLite/LocMem. This project has had that rule violated and reverted before — do not reintroduce it, including "just for speed". This phase depends on it more than any earlier phase: partial unique constraints, `CheckConstraint`s and `select_for_update()` are all load-bearing here and none of them behave correctly on SQLite.
- **All primary keys are UUIDs; all timestamps are timezone-aware UTC** (spec §11 preamble). New models inherit `common.models.UUIDTimeStampedModel`, except `ListingSnapshot`, which inherits `common.models.UUIDModel` and declares only `created_at` — see the ruling in Task 4.
- **Monetary fields use `Decimal`, never binary floating point** (spec §11 preamble). `price` is `DecimalField(max_digits=14, decimal_places=2)`; finance override percents are `DecimalField(max_digits=7, decimal_places=4)`; JSON carries money and rates as **decimal strings**, never JSON numbers (spec §30.2: "JSON uses decimal strings for money/rates requiring exact representation").
- **Atomic state changes** (spec §2.3): any operation affecting listing publication or revision approval runs inside `transaction.atomic()`, locks the rows it decides on with `select_for_update()`, and schedules every notification through `transaction.on_commit()`.
- **Auditability** (spec §2.4 and §20 definition of done — "Every decision records actor, note and timestamps"): every approve / request-changes / reject / staff-correction / suspend / unsuspend call writes an `audit.models.AuditEvent` through `audit.services.record_audit_event()` **inside the same `transaction.atomic()` block** as the change it describes. Its exact current signature (do not guess — this is the real code in `backend/audit/services.py`):

  ```python
  record_audit_event(
      *, actor_user, actor_type: str, action: str, target_type: str, target_id: str,
      source: str, before: dict | None = None, after: dict | None = None,
      request_id: str | None = None, metadata: dict | None = None, ip_hash: str | None = None,
  ) -> AuditEvent
  ```

  `actor_type` and `source` take values from `audit.models.AuditEvent.ActorType` (`USER` | `SYSTEM` | `STRIPE`) and `AuditEvent.Source` (`WEB` | `API` | `ADMIN` | `TASK` | `WEBHOOK`).
- **Server authority** (spec §2.2): `seller_type`, `owner_user` and `broker` are never read from a request body. They come from `accounts.services.resolve_seller_context(request.user, broker_id=...)`.
- **No partial/visual-only implementations, no faked data, no TODO placeholders for backend enforcement** (spec §39). Every rule in this plan is enforced by real backend code, covered by a real test against real Postgres.
- TDD per task: write the failing test first, run it and confirm the failure mode, write the minimal implementation, confirm it passes, then commit.
- **Exact enum values, copied verbatim from the spec** (§6.1, §6.2, §11.4, §11.5):
  - `ListingStatus`: `DRAFT`, `PENDING_APPROVAL`, `PUBLISHED`, `REJECTED`, `SUSPENDED`, `EXPIRED`, `ARCHIVED`
  - `RevisionStatus`: `DRAFT`, `SUBMITTED`, `APPROVED`, `CHANGES_REQUESTED`, `REJECTED`, `WITHDRAWN`
  - `PublicationSource`: `FREE_ENTITLEMENT`, `PAID_ENTITLEMENT`, `BROKER_POLICY`
  - `ListingMedia.media_type`: `IMAGE`, `VIDEO`
  - `ListingMedia.status`: `UPLOADING`, `SCANNING`, `PROCESSING`, `READY`, `REJECTED`
  - `seller_type`: `PRIVATE`, `BROKER` (reuse `accounts.enums.SellerType`; do not redeclare it)
- **Exact `BoatListing` constraints, copied verbatim from spec §11.4:**
  - `seller_type=PRIVATE` requires `owner_user` and forbids `broker`.
  - `seller_type=BROKER` requires `broker`.
  - `show_finance_estimate=true` is valid only for `seller_type=BROKER`.
  - A non-Other model requires blank `custom_model_name`.
  - The Other model requires trimmed custom text between **2 and 100** characters.
  - Manufacture year must be between **1900** and **current year + 1**.
  - Price must be positive when publication is submitted.
- **Exact media rule, copied verbatim from spec §11.5:** "Only `READY` media can enter a submitted revision/public snapshot. Media count limits include all non-rejected items to prevent concurrent upload bypasses."
- **Exact immutability rule, copied verbatim from spec §11.5:** "Only fields explicitly allowed by role are accepted in `payload`; unknown fields return validation errors. For a private seller after first publication, `brand_id`, `model_id`, `custom_model_name` and `manufacture_year` are rejected with `immutable_after_publication`." The four locked names spec §25.1 reports to the frontend are `["brand", "model", "custom_model_name", "manufacture_year"]`.
- **Exact media allowance numbers, copied verbatim from spec §10.1/§24.1** (read at runtime from `platform_settings`, never hardcoded in a service): private seller base = **1** image / **0** videos (`media.private_base_image_limit`, `media.private_base_video_limit`); broker = **20** images / **1** video (`media.broker_image_limit`, `media.broker_video_limit`). The media *upgrade* tier (20/1 for private sellers) belongs to Phase 13/15 and is not applied here.
- **Exact publication window, copied verbatim from spec §1/§10.1:** a free private-seller publication lasts **30** days (`individual.free_publish_days`), read at runtime from `platform_settings`.
- **Exact optimistic-locking contract (spec §20.5):** "All edit submissions include listing/revision version. Stale updates return `409 conflict` with current version metadata. Do not silently overwrite another browser/session edit." Mechanism is fully specified in Task 6.
- **Exact decision rules, copied verbatim from spec §26.2:** "Approval reason/note optional unless warning override exists. Request changes and reject require a user-visible reason. Decisions are atomic and idempotent; repeated click cannot create multiple snapshots. If another moderator already decided, return conflict and refresh."
- **Error envelope** (spec §30.2): every error response is rendered by Phase 3's `common.exceptions.nauta_exception_handler` as `{"error": {"code", "message", "fields", "request_id"}}`. Task 6 adds one optional `meta` key to it. Machine codes introduced by this phase are stable and must not be renamed: `immutable_after_publication`, `unknown_field`, `stale_version`, `feature_disabled`, `invalid_listing_state`, `invalid_revision_state`, `media_not_ready`, `media_allowance_exceeded`, `decision_note_required`, `finance_not_allowed_for_private_seller`.
- **Feature flag** (spec §35.1): the four mutation endpoints are gated behind the `listing_revisions` flag, seeded **disabled** so the deployment sequence in §35.2 step 4 ("Deploy code with features off/read-compatible") is possible. Public read endpoints are not gated.
- **No finance UI or calculation in this plan.** `BoatListing` stores `show_finance_estimate` and the three override columns because spec §11.4 puts them there, and the payload validator refuses them for private sellers (spec §1, §18.4, §40 Scenario D). Rendering a `finance` block on a listing response is spec Phase 9 and is deliberately absent — see Known Limitations.
- Localization: user-facing strings this phase emits (decision notes are staff-authored free text, so they are exempt) use the translation keys spec §37 already reserves — `listing.pending_approval`, `listing.approved_version_live`, `listing.immutable_field_help`. No new English copy is invented in backend responses beyond the stable error messages listed above.

---

## Execution Model

Per the standing project convention recorded in `ACTIVITY.md` and repeated in every earlier plan: each task is implemented on its own branch off the current tip of `dev` (`git checkout -b listings-task-N-<slug> dev`), run through `subagent-driven-development`'s implementer → task-reviewer → fix-loop cycle, opened as a PR (`gh pr create`), and merged by the controller only when the CI workflow (`.github/workflows/ci.yml`) is green and the branch is cleanly mergeable. Tasks run strictly sequentially — never two branches in flight at once — and each new task branches from the just-merged `dev` tip (run `git fetch && git merge origin/dev --ff-only` first; the Phase 4 retrospective records a real bug caused by branching a worktree off a stale local `dev`).

This plan touches exactly three files outside `backend/listings/`: `backend/config/settings/base.py` (one line: register the app), `backend/config/urls.py` (one import + one include), and `backend/common/exceptions.py` (a four-line `meta` passthrough in Task 6). Each is called out per-task with its exact expected current content.

---

## Phase boundaries (decided by the project controller — do not re-litigate)

1. **This phase owns and creates** `BoatListing`, `ListingSnapshot`, `ListingRevision` and `ListingMedia`. `ListingMedia` is a **model only** — fields, statuses, constraints, ordering and allowance counting. There is **no** upload intent endpoint, signed URL, virus scan, transcode or derivative generation here; that whole pipeline is spec Phase 15 (§24). In this phase, `ListingMedia.status` is driven directly from tests and Django admin, and the "media must be READY and within allowance" check (spec §20.1 step 3) reads the `status` column as it stands.
2. **Entitlement/quota consumption is Phase 13's job.** This phase exposes an explicit seam — `listings.policies.ListingEntitlementGate` — whose stub **always allows submission**. It is replaced by Phase 13's real `ListingEligibilityService` (spec §22.2). No quota logic is built now.
3. **Broker auto-approval is Phase 12's job.** Phase 3's `brokers.models.BrokerOrganization.auto_approve_listings` (a `BooleanField(default=False)`) is the field Phase 12 will read, but this phase deliberately does **not** read it: `listings.policies.requires_staff_approval()` returns `True` unconditionally, so a broker submission behaves exactly like a private-seller submission (pending approval, hidden publicly). Phase 12 owns the *semantics* around that flag — future-only effect, mandatory staff reason, bulk-approve of already-pending submissions, "invalid listing never publishes even when auto-approval is on" (spec §21) — and half-implementing them here would produce a policy that looks done and is not.
4. **Taxonomy already exists and is merged.** `taxonomy.models.BoatBrand` and `taxonomy.models.BoatModel` are the real, current models in `backend/taxonomy/models.py`. `BoatModel` carries `brand` (FK, `related_name="models"`), `name`, `slug`, `normalized_name`, `is_other_placeholder`, `is_active`, `created_by`, `updated_by`, `created_at`, `updated_at`, and a database-enforced one-Other-placeholder-per-brand unique constraint. The Other placeholder row is created automatically by a `post_save` signal on `BoatBrand`, so tests fetch it with `BoatModel.objects.get(brand=brand, is_other_placeholder=True)` rather than creating one.
5. **Audit uses the existing shared service** — `audit.services.record_audit_event()`, signature quoted verbatim in Global Constraints. No listings-specific audit model is created.
6. **Common mixins**: `common.models.UUIDTimeStampedModel` for `BoatListing`, `ListingRevision` and `ListingMedia`; `common.models.UUIDModel` + an explicit `created_at` for the immutable `ListingSnapshot`.
7. **Optimistic locking is specified exactly** in Task 6 — an integer `version` column on `BoatListing` and `ListingRevision`, bumped by a conditional `UPDATE ... WHERE version = <expected>` on every state-changing write, with the expected value supplied as a required `version` field in the request body.

### Explicitly out of scope for this plan

- Media upload/processing pipeline (spec §24 — Phase 15), including the media-upgrade entitlement tier.
- Entitlement ledger, free/paid quota, `UserEntitlement`, `GET /api/v1/listing-eligibility/`, and the scheduled expiry task that marks due listings `EXPIRED` (spec §22 — Phase 13). `ListingStatus.EXPIRED` exists in the enum and the transition map; nothing in this phase moves a listing into it.
- Broker auto-approval policy and its staff toggle UI (spec §21 — Phase 12).
- `GET /api/v1/staff/moderation/` queue endpoint, moderator assignment, before/after diff UI, bulk actions (spec §26.2 — Phase 17). The *decision* endpoint that queue drives is built here.
- Finance display block on listing responses, `FinanceQuoteService` integration and the broker finance form (spec §18 — Phase 9).
- `ListingView` unique view analytics (spec §19 — Phase 10). `BoatListing.view_count_cached` exists as a column (spec §11.4 puts it there) and is serialized as-is; nothing in this phase writes to it.
- Notification fan-out, WebSocket and email (spec §27 — Phase 18). This phase emits real Django signals after commit; Phase 18 connects receivers.
- The `/sell/create/` Next.js form, field-locking UI, autosave and policy-capability rendering (spec §25 — Phase 16). This plan is backend-only, matching the Django-headless architecture recorded in `ACTIVITY.md`.
- Taxonomy-mapping staff transaction that rewrites a published listing's brand/model (spec §13.3 — Phase 17). This phase provides the mechanism it needs (a staff-authored correction revision that may touch immutable fields) and Phase 17 drives it from the taxonomy queue.
- Listing slugs and `/boats/<listing-slug>/` routing (spec §4.1 — Phase 20/21). See the ruling in Task 14.

---

## File Structure

```
nautelo/
├── ACTIVITY.md                                       (updated in Task 15)
├── docs/superpowers/plans/2026-09-18-phase-11-listing-workflow.md   (this file)
└── backend/
    ├── common/
    │   └── exceptions.py                             (modified: Task 6)
    ├── config/
    │   ├── settings/base.py                          (modified: Task 1)
    │   └── urls.py                                   (modified: Task 8)
    └── listings/
        ├── __init__.py                               (Task 1)
        ├── apps.py                                   (Task 1)
        ├── enums.py                                  (Task 1 — statuses + transition maps)
        ├── models.py                                 (Task 2, modified: Tasks 3, 4)
        ├── admin.py                                  (Task 2, modified: Tasks 3, 4)
        ├── payloads.py                               (Task 5 — revision payload schema)
        ├── locking.py                                (Task 6 — StaleVersionConflict, bump_version)
        ├── policies.py                               (Task 7 — entitlement/approval/media seams)
        ├── signals.py                                (Task 10 — post-commit domain signals)
        ├── permissions.py                            (Task 8 — feature-flag gate)
        ├── drafts.py                                 (Task 8, modified: Task 9)
        ├── submissions.py                            (Task 10)
        ├── snapshots.py                              (Task 11)
        ├── decisions.py                              (Task 11, modified: Task 13)
        ├── serializers.py                            (Task 8, modified: Tasks 9, 10, 12, 14)
        ├── views.py                                  (Task 8, modified: Tasks 9, 10, 12, 14)
        ├── urls.py                                   (Task 8, modified: Tasks 9, 10, 12, 14)
        ├── migrations/
        │   ├── __init__.py                           (Task 1)
        │   ├── 0001_boatlisting.py                   (generated: Task 2)
        │   ├── 0002_listingmedia.py                  (generated: Task 3)
        │   ├── 0003_listingsnapshot_listingrevision.py (generated: Task 4)
        │   └── 0004_seed_listing_revisions_flag.py   (hand-written data migration: Task 8)
        └── tests/
            ├── __init__.py                           (Task 1)
            ├── conftest.py                           (Task 1, modified: Task 8)
            ├── factories.py                          (Task 2, modified: Tasks 3, 4)
            ├── test_enums.py                         (Task 1)
            ├── test_boat_listing_model.py            (Task 2)
            ├── test_listing_media_model.py           (Task 3)
            ├── test_snapshot_revision_models.py      (Task 4)
            ├── test_payloads.py                      (Task 5)
            ├── test_locking.py                       (Task 6)
            ├── test_policies.py                      (Task 7)
            ├── test_draft_create.py                  (Task 8)
            ├── test_draft_update.py                  (Task 9)
            ├── test_submit_withdraw.py               (Task 10)
            ├── test_decisions.py                     (Task 11)
            ├── test_decision_api.py                  (Task 12)
            ├── test_staff_corrections.py             (Task 13)
            ├── test_public_read_api.py               (Task 14)
            └── test_phase_acceptance.py              (Task 15)
```

Migration filenames above are what Django's auto-numbering produces for a fresh app; the actual generated names are whatever `makemigrations` emits (each task says to run it and commit the result, never to hand-author a schema migration).

---

### Task 1: Scaffold the `listings` app, its enums and its state-transition maps

**Files:**
- Create: `backend/listings/__init__.py`, `backend/listings/apps.py`, `backend/listings/enums.py`, `backend/listings/migrations/__init__.py`, `backend/listings/tests/__init__.py`, `backend/listings/tests/conftest.py`, `backend/listings/tests/test_enums.py`
- Modify: `backend/config/settings/base.py`
- Delete: `backend/listings/tests.py`, `backend/listings/views.py`, `backend/listings/admin.py`, `backend/listings/models.py` (Django `startapp` boilerplate — recreated with real content in later tasks)

**Interfaces:**
- Produces: `listings.enums.ListingStatus`, `listings.enums.RevisionStatus`, `listings.enums.RevisionOrigin`, `listings.enums.PublicationSource`, `listings.enums.MediaType`, `listings.enums.MediaStatus` (all `django.db.models.TextChoices`), plus `listings.enums.LISTING_TRANSITIONS: dict[str, frozenset[str]]`, `listings.enums.REVISION_TRANSITIONS: dict[str, frozenset[str]]`, `listings.enums.OPEN_REVISION_STATES: frozenset[str]`, `listings.enums.DECIDED_REVISION_STATES: frozenset[str]`, `listings.enums.NOTE_REQUIRED_REVISION_STATES: frozenset[str]`, and the helpers `can_transition_listing(current, target) -> bool` / `can_transition_revision(current, target) -> bool`.
- Produces: `listings` registered in `INSTALLED_APPS`.

**Note:** Phase 0/1's retrospective in `ACTIVITY.md` records a real bug from `django-admin startapp`: it generates a flat `tests.py` that silently shadows a `tests/` package. Delete it immediately after `startapp`, before creating the package.

**Note (ruling — how to read spec §6.1's listing diagram):** §6.1 prints

```text
DRAFT
  -> PENDING_APPROVAL
  -> PUBLISHED
  -> EXPIRED
  -> ARCHIVED
```

which could be read as a fan-out from `DRAFT` or as a chain. It is read here as a **chain** (`DRAFT → PENDING_APPROVAL → PUBLISHED → EXPIRED → ARCHIVED`), because the fan-out reading would allow `DRAFT → EXPIRED` and `DRAFT → ARCHIVED`, which no rule in the spec describes, and because §6.1's own rule list separately names the only sanctioned direct `DRAFT → PUBLISHED` path ("A broker initial publication enters `PUBLISHED` only if its broker has `auto_approve_listings=true`"). `DRAFT → PUBLISHED` is therefore included in the map, reserved for Phase 12; nothing in this phase triggers it, because `policies.requires_staff_approval()` always returns `True` (see Task 7).

**Note (ruling — `PENDING_APPROVAL → DRAFT` is required and §6.1 omits it):** §6.2 says a revision may go `SUBMITTED → CHANGES_REQUESTED → DRAFT`, and §36.4 says "'Request changes' permits resubmission in the same entitlement/submission chain." For an *initial* submission the listing is sitting in `PENDING_APPROVAL`; if that status did not change, the listing would remain in the moderation queue while it is actually back with the seller, and the seller could not edit it. `PENDING_APPROVAL → DRAFT` is therefore in the map. It mirrors the `REJECTED → DRAFT` return path §6.1 does print. The same transition carries an owner **withdrawal** of an initial submission (§6.2 `SUBMITTED → WITHDRAWN`, §36.4 "they may withdraw submission, preserving audit").

**Note (ruling — changes-requested vs rejected leave the listing in different states):** on an initial submission, *request changes* returns the listing to `DRAFT` (an invitation to edit — the seller can immediately continue), while *reject* sets the listing to `REJECTED` (a refusal, which §6.1 prints explicitly), and the listing only returns to `DRAFT` when the seller actively opens a new draft revision (Task 9). Both are spec-grounded; the asymmetry is intentional and is what makes `REJECTED → DRAFT` in §6.1 mean something. For a listing that already has a public snapshot, **no** decision changes the listing status at all — it stays `PUBLISHED` (spec §20.2: "Existing approved snapshot remains live", "Rejection leaves the approved public snapshot untouched").

- [ ] **Step 1: Generate the app skeleton and remove the placeholder files**

```bash
cd backend
uv run python manage.py startapp listings
rm listings/tests.py listings/views.py listings/admin.py listings/models.py
mkdir listings/tests
touch listings/tests/__init__.py
```

- [ ] **Step 2: Write the failing test**

`backend/listings/tests/test_enums.py`:

```python
from listings.enums import (
    DECIDED_REVISION_STATES,
    LISTING_TRANSITIONS,
    NOTE_REQUIRED_REVISION_STATES,
    OPEN_REVISION_STATES,
    REVISION_TRANSITIONS,
    ListingStatus,
    MediaStatus,
    MediaType,
    PublicationSource,
    RevisionOrigin,
    RevisionStatus,
    can_transition_listing,
    can_transition_revision,
)


def test_listing_status_values_match_the_spec():
    assert [choice.value for choice in ListingStatus] == [
        "DRAFT",
        "PENDING_APPROVAL",
        "PUBLISHED",
        "REJECTED",
        "SUSPENDED",
        "EXPIRED",
        "ARCHIVED",
    ]


def test_revision_status_values_match_the_spec():
    assert [choice.value for choice in RevisionStatus] == [
        "DRAFT",
        "SUBMITTED",
        "APPROVED",
        "CHANGES_REQUESTED",
        "REJECTED",
        "WITHDRAWN",
    ]


def test_publication_source_and_media_enums_match_the_spec():
    assert [choice.value for choice in PublicationSource] == [
        "FREE_ENTITLEMENT",
        "PAID_ENTITLEMENT",
        "BROKER_POLICY",
    ]
    assert [choice.value for choice in MediaType] == ["IMAGE", "VIDEO"]
    assert [choice.value for choice in MediaStatus] == [
        "UPLOADING",
        "SCANNING",
        "PROCESSING",
        "READY",
        "REJECTED",
    ]
    assert [choice.value for choice in RevisionOrigin] == ["OWNER", "STAFF_CORRECTION"]


def test_listing_transition_map_covers_every_status_exactly_once():
    assert set(LISTING_TRANSITIONS) == {choice.value for choice in ListingStatus}


def test_sanctioned_listing_transitions_are_allowed():
    assert can_transition_listing(ListingStatus.DRAFT, ListingStatus.PENDING_APPROVAL)
    assert can_transition_listing(ListingStatus.PENDING_APPROVAL, ListingStatus.PUBLISHED)
    assert can_transition_listing(ListingStatus.PENDING_APPROVAL, ListingStatus.REJECTED)
    assert can_transition_listing(ListingStatus.PENDING_APPROVAL, ListingStatus.DRAFT)
    assert can_transition_listing(ListingStatus.REJECTED, ListingStatus.DRAFT)
    assert can_transition_listing(ListingStatus.PUBLISHED, ListingStatus.SUSPENDED)
    assert can_transition_listing(ListingStatus.SUSPENDED, ListingStatus.PUBLISHED)
    assert can_transition_listing(ListingStatus.SUSPENDED, ListingStatus.ARCHIVED)
    assert can_transition_listing(ListingStatus.PUBLISHED, ListingStatus.EXPIRED)
    assert can_transition_listing(ListingStatus.EXPIRED, ListingStatus.ARCHIVED)
    # Reserved for Phase 12 broker auto-approval; unreachable in Phase 11.
    assert can_transition_listing(ListingStatus.DRAFT, ListingStatus.PUBLISHED)


def test_unsanctioned_listing_transitions_are_refused():
    assert not can_transition_listing(ListingStatus.DRAFT, ListingStatus.EXPIRED)
    assert not can_transition_listing(ListingStatus.DRAFT, ListingStatus.ARCHIVED)
    assert not can_transition_listing(ListingStatus.ARCHIVED, ListingStatus.PUBLISHED)
    assert not can_transition_listing(ListingStatus.EXPIRED, ListingStatus.PUBLISHED)
    assert not can_transition_listing(ListingStatus.PUBLISHED, ListingStatus.DRAFT)


def test_revision_transitions_follow_spec_6_2():
    assert can_transition_revision(RevisionStatus.DRAFT, RevisionStatus.SUBMITTED)
    assert can_transition_revision(RevisionStatus.SUBMITTED, RevisionStatus.APPROVED)
    assert can_transition_revision(RevisionStatus.SUBMITTED, RevisionStatus.CHANGES_REQUESTED)
    assert can_transition_revision(RevisionStatus.SUBMITTED, RevisionStatus.REJECTED)
    assert can_transition_revision(RevisionStatus.SUBMITTED, RevisionStatus.WITHDRAWN)
    assert can_transition_revision(RevisionStatus.CHANGES_REQUESTED, RevisionStatus.DRAFT)
    assert not can_transition_revision(RevisionStatus.APPROVED, RevisionStatus.DRAFT)
    assert not can_transition_revision(RevisionStatus.REJECTED, RevisionStatus.SUBMITTED)
    assert not can_transition_revision(RevisionStatus.WITHDRAWN, RevisionStatus.SUBMITTED)
    assert not can_transition_revision(RevisionStatus.DRAFT, RevisionStatus.APPROVED)


def test_revision_state_groupings():
    assert OPEN_REVISION_STATES == frozenset({"DRAFT", "SUBMITTED"})
    assert DECIDED_REVISION_STATES == frozenset(
        {"APPROVED", "CHANGES_REQUESTED", "REJECTED"}
    )
    assert NOTE_REQUIRED_REVISION_STATES == frozenset({"CHANGES_REQUESTED", "REJECTED"})
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
cd backend
uv run pytest listings/tests/test_enums.py -v
```

Expected: collection `ERROR` — `ModuleNotFoundError: No module named 'listings.enums'`.

- [ ] **Step 4: Implement the enums and transition maps**

`backend/listings/enums.py`:

```python
"""Listing and revision state vocabulary (NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md §6.1, §6.2, §11.4, §11.5).

Values are copied verbatim from the spec and must never be renamed: they are
persisted in the database, returned in API responses and written into audit
events.
"""

from django.db import models


class ListingStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    PENDING_APPROVAL = "PENDING_APPROVAL", "Pending approval"
    PUBLISHED = "PUBLISHED", "Published"
    REJECTED = "REJECTED", "Rejected"
    SUSPENDED = "SUSPENDED", "Suspended"
    EXPIRED = "EXPIRED", "Expired"
    ARCHIVED = "ARCHIVED", "Archived"


class RevisionStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    SUBMITTED = "SUBMITTED", "Submitted"
    APPROVED = "APPROVED", "Approved"
    CHANGES_REQUESTED = "CHANGES_REQUESTED", "Changes requested"
    REJECTED = "REJECTED", "Rejected"
    WITHDRAWN = "WITHDRAWN", "Withdrawn"


class RevisionOrigin(models.TextChoices):
    """Who authored a revision. A STAFF_CORRECTION revision may touch the fields
    that are immutable for the owner (spec §20.3)."""

    OWNER = "OWNER", "Owner"
    STAFF_CORRECTION = "STAFF_CORRECTION", "Staff correction"


class PublicationSource(models.TextChoices):
    FREE_ENTITLEMENT = "FREE_ENTITLEMENT", "Free entitlement"
    PAID_ENTITLEMENT = "PAID_ENTITLEMENT", "Paid entitlement"
    BROKER_POLICY = "BROKER_POLICY", "Broker policy"


class MediaType(models.TextChoices):
    IMAGE = "IMAGE", "Image"
    VIDEO = "VIDEO", "Video"


class MediaStatus(models.TextChoices):
    UPLOADING = "UPLOADING", "Uploading"
    SCANNING = "SCANNING", "Scanning"
    PROCESSING = "PROCESSING", "Processing"
    READY = "READY", "Ready"
    REJECTED = "REJECTED", "Rejected"


# Spec §6.1, read as a chain plus the two explicitly documented return paths.
# DRAFT -> PUBLISHED is reserved for Phase 12 broker auto-approval and is never
# taken in Phase 11, where policies.requires_staff_approval() always returns True.
LISTING_TRANSITIONS: dict[str, frozenset[str]] = {
    ListingStatus.DRAFT: frozenset(
        {ListingStatus.PENDING_APPROVAL, ListingStatus.PUBLISHED}
    ),
    ListingStatus.PENDING_APPROVAL: frozenset(
        {ListingStatus.PUBLISHED, ListingStatus.REJECTED, ListingStatus.DRAFT}
    ),
    ListingStatus.PUBLISHED: frozenset(
        {ListingStatus.SUSPENDED, ListingStatus.EXPIRED}
    ),
    ListingStatus.REJECTED: frozenset({ListingStatus.DRAFT}),
    ListingStatus.SUSPENDED: frozenset(
        {ListingStatus.PUBLISHED, ListingStatus.ARCHIVED}
    ),
    ListingStatus.EXPIRED: frozenset({ListingStatus.ARCHIVED}),
    ListingStatus.ARCHIVED: frozenset(),
}

# Spec §6.2.
REVISION_TRANSITIONS: dict[str, frozenset[str]] = {
    RevisionStatus.DRAFT: frozenset({RevisionStatus.SUBMITTED}),
    RevisionStatus.SUBMITTED: frozenset(
        {
            RevisionStatus.APPROVED,
            RevisionStatus.CHANGES_REQUESTED,
            RevisionStatus.REJECTED,
            RevisionStatus.WITHDRAWN,
        }
    ),
    RevisionStatus.CHANGES_REQUESTED: frozenset({RevisionStatus.DRAFT}),
    RevisionStatus.APPROVED: frozenset(),
    RevisionStatus.REJECTED: frozenset(),
    RevisionStatus.WITHDRAWN: frozenset(),
}

# A listing may have at most one revision in these states (DB constraint, Task 4).
OPEN_REVISION_STATES: frozenset[str] = frozenset(
    {RevisionStatus.DRAFT, RevisionStatus.SUBMITTED}
)

# States that mean a moderator has ruled: decided_by/decided_at are mandatory.
DECIDED_REVISION_STATES: frozenset[str] = frozenset(
    {RevisionStatus.APPROVED, RevisionStatus.CHANGES_REQUESTED, RevisionStatus.REJECTED}
)

# Spec §26.2: "Request changes and reject require a user-visible reason."
NOTE_REQUIRED_REVISION_STATES: frozenset[str] = frozenset(
    {RevisionStatus.CHANGES_REQUESTED, RevisionStatus.REJECTED}
)


def can_transition_listing(current: str, target: str) -> bool:
    return target in LISTING_TRANSITIONS.get(current, frozenset())


def can_transition_revision(current: str, target: str) -> bool:
    return target in REVISION_TRANSITIONS.get(current, frozenset())
```

- [ ] **Step 5: Register the app**

In `backend/config/settings/base.py`, add `"listings"` to the **existing** `INSTALLED_APPS` list after `"taxonomy"` (read the file first; a concurrent phase may have added entries):

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
    "finance",
    "taxonomy",
    "listings",
    "platform_settings",
    # ...plus whatever Phase 3 added ("accounts", "brokers", "professionals")
]
```

- [ ] **Step 6: Add the shared test fixture file**

`backend/listings/tests/conftest.py`:

```python
import pytest
from django.core.cache import cache

from platform_settings.services import SETTINGS_CACHE_KEY, feature_flag_cache_key

# This project's cache is a real, shared Redis instance, not an in-memory
# backend that resets between runs, so every test in this package starts from
# and leaves behind a clean cache (same pattern as platform_settings/tests).
LISTINGS_FEATURE_FLAG_KEYS = ["listing_revisions"]


@pytest.fixture(autouse=True)
def _clear_listings_caches():
    def _clear():
        cache.delete(SETTINGS_CACHE_KEY)
        for key in LISTINGS_FEATURE_FLAG_KEYS:
            cache.delete(feature_flag_cache_key(key))

    _clear()
    yield
    _clear()
```

- [ ] **Step 7: Run the tests and the system check**

```bash
cd backend
uv run pytest listings/tests/test_enums.py -v
uv run python manage.py check
```

Expected: all `test_enums.py` tests PASS; `System check identified no issues (0 silenced).`

- [ ] **Step 8: Commit**

```bash
git add backend/listings backend/config/settings/base.py
git commit -m "feat(listings): scaffold listings app with spec-exact status enums and transition maps"
```

---

### Task 2: `BoatListing` model, database constraints and admin

**Files:**
- Create: `backend/listings/models.py`, `backend/listings/admin.py`, `backend/listings/tests/factories.py`
- Test: `backend/listings/tests/test_boat_listing_model.py`
- Generated: `backend/listings/migrations/0001_boatlisting.py`

**Interfaces:**
- Consumes: `listings.enums.{ListingStatus, PublicationSource}` (Task 1); `common.models.UUIDTimeStampedModel`; `accounts.enums.SellerType`; `brokers.models.BrokerOrganization`; `taxonomy.models.{BoatBrand, BoatModel}`.
- Produces: `listings.models.BoatListing` with fields `id`, `owner_user`, `broker`, `seller_type`, `brand`, `model`, `custom_model_name`, `manufacture_year`, `status`, `currency`, `price`, `show_finance_estimate`, `finance_down_payment_override_percent`, `finance_rate_override_percent`, `finance_term_override_months`, `publication_source`, `consumed_entitlement_id`, `published_at`, `expires_at`, `current_public_snapshot` (added in Task 4), `view_count_cached`, `version`, `created_by`, `updated_by`, `created_at`, `updated_at`; the constants `MIN_MANUFACTURE_YEAR = 1900`, `CUSTOM_MODEL_NAME_MIN_LENGTH = 2`, `CUSTOM_MODEL_NAME_MAX_LENGTH = 100`, `SUPPORTED_CURRENCIES = frozenset({"EUR"})`; and `BoatListing.max_manufacture_year() -> int`.
- Produces: `listings.tests.factories.{make_brand, make_model, other_model_for, make_private_listing, make_broker_listing}`.

**Note (ruling — `current_public_snapshot` is added in Task 4, not here):** `BoatListing.current_public_snapshot` points at `ListingSnapshot`, which points back at `BoatListing`. Django resolves that cycle with a lazy string reference, but the two models must land in the same or in dependency order for `makemigrations`. Splitting them across two tasks keeps each task independently reviewable: Task 2 creates `BoatListing` without the column, Task 4 creates both snapshot/revision models **and** adds the `current_public_snapshot` column in the same generated migration. Every interface block below therefore lists `current_public_snapshot` as a Task 4 product.

**Note (ruling — `consumed_entitlement` is a loose UUID, not a FK):** spec §11.4 lists `consumed_entitlement nullable FK`, pointing at `UserEntitlement` (spec §11.9), which is Phase 13's model and does not exist. Following the precedent Phase 8 set for `FinanceConfigurationVersion.created_by_user_id`, the column is a nullable `UUIDField` named `consumed_entitlement_id`, capturing the value for later. Phase 13 converts it into a real `ForeignKey` with a data migration. It stays `NULL` throughout this phase, because the entitlement gate is a stub (Task 7).

**Note (ruling — a `BROKER` listing must have `owner_user` NULL):** spec §11.4 says only "`seller_type=BROKER` requires `broker`", leaving `owner_user` unconstrained for broker listings. It is constrained to `NULL` here for a security reason: Phase 3's `can_edit_owned_object(user, owner_user_id=…, broker_id=…)` grants edit rights if **either** the user is `owner_user` **or** the user holds an active `can_edit_listings` membership. A broker listing that also recorded an individual `owner_user` would grant that person permanent edit rights over organization property even after they left the organization. Who created the row is already recorded in `created_by`.

**Note (ruling — which constraints can live in the database and which cannot):** three of spec §11.4's seven rules cannot be `CheckConstraint`s:
- *"A non-Other model requires blank `custom_model_name`"* and its inverse depend on `BoatModel.is_other_placeholder`, a column on a **different table**; Postgres check constraints cannot reference another row. Enforced in `BoatListing.clean()` and again in the payload validator (Task 5), with tests for both.
- *"Manufacture year must be between 1900 and current year + 1"* has a moving upper bound; a static `CheckConstraint` would need a migration every January. The **lower** bound (`>= 1900`) is a database constraint; the upper bound is checked in `clean()` and in the payload validator against `BoatListing.max_manufacture_year()`.
- *"Price must be positive when publication is submitted"* is conditional on the workflow, not on the row; the database constraint is the unconditional half (`price IS NULL OR price > 0`) and the submit service enforces "present and positive" (Task 10).
The trimmed 2–100 character rule for `custom_model_name` **is** database-enforceable once the service stores already-trimmed text, and is expressed as a regex check constraint below.

- [ ] **Step 1: Write the failing tests**

`backend/listings/tests/factories.py`:

```python
from decimal import Decimal

from accounts.enums import SellerType
from listings.models import BoatListing
from taxonomy.models import BoatBrand, BoatModel


def make_brand(name="Beneteau"):
    return BoatBrand.objects.create(name=name)


def make_model(brand, name="Oceanis 46.1"):
    return BoatModel.objects.create(brand=brand, name=name)


def other_model_for(brand):
    """The per-brand Other placeholder taxonomy creates automatically via a
    post_save signal on BoatBrand (see backend/taxonomy/signals.py)."""
    return BoatModel.objects.get(brand=brand, is_other_placeholder=True)


def make_private_listing(*, owner, brand=None, model=None, **kwargs):
    brand = brand or make_brand(f"Brand {owner.pk.hex[:8]}")
    model = model or make_model(brand)
    defaults = {
        "owner_user": owner,
        "broker": None,
        "seller_type": SellerType.PRIVATE,
        "brand": brand,
        "model": model,
        "manufacture_year": 2020,
        "currency": "EUR",
        "price": Decimal("125000.00"),
        "created_by": owner,
    }
    defaults.update(kwargs)
    return BoatListing.objects.create(**defaults)


def make_broker_listing(*, broker, actor, brand=None, model=None, **kwargs):
    brand = brand or make_brand(f"Brand {broker.pk.hex[:8]}")
    model = model or make_model(brand)
    defaults = {
        "owner_user": None,
        "broker": broker,
        "seller_type": SellerType.BROKER,
        "brand": brand,
        "model": model,
        "manufacture_year": 2021,
        "currency": "EUR",
        "price": Decimal("459000.00"),
        "created_by": actor,
    }
    defaults.update(kwargs)
    return BoatListing.objects.create(**defaults)
```

`backend/listings/tests/test_boat_listing_model.py`:

```python
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from accounts.enums import SellerType
from accounts.tests.factories import make_user
from brokers.tests.factories import make_broker
from listings.enums import ListingStatus
from listings.models import BoatListing
from listings.tests.factories import (
    make_brand,
    make_broker_listing,
    make_model,
    make_private_listing,
    other_model_for,
)


@pytest.mark.django_db
def test_a_new_listing_starts_as_a_draft_at_version_one():
    listing = make_private_listing(owner=make_user())

    assert listing.status == ListingStatus.DRAFT
    assert listing.version == 1
    assert listing.published_at is None
    assert listing.expires_at is None
    assert listing.view_count_cached == 0
    assert listing.publication_source == ""
    assert listing.consumed_entitlement_id is None


@pytest.mark.django_db
def test_private_listing_without_owner_is_rejected_by_the_database():
    brand = make_brand()
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            BoatListing.objects.create(
                owner_user=None,
                broker=None,
                seller_type=SellerType.PRIVATE,
                brand=brand,
                model=make_model(brand),
                manufacture_year=2020,
            )


@pytest.mark.django_db
def test_private_listing_with_a_broker_is_rejected_by_the_database():
    owner = make_user()
    broker = make_broker()
    brand = make_brand()
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            BoatListing.objects.create(
                owner_user=owner,
                broker=broker,
                seller_type=SellerType.PRIVATE,
                brand=brand,
                model=make_model(brand),
                manufacture_year=2020,
            )


@pytest.mark.django_db
def test_broker_listing_without_a_broker_is_rejected_by_the_database():
    brand = make_brand()
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            BoatListing.objects.create(
                owner_user=None,
                broker=None,
                seller_type=SellerType.BROKER,
                brand=brand,
                model=make_model(brand),
                manufacture_year=2020,
            )


@pytest.mark.django_db
def test_broker_listing_carrying_an_owner_user_is_rejected_by_the_database():
    brand = make_brand()
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            BoatListing.objects.create(
                owner_user=make_user(),
                broker=make_broker(),
                seller_type=SellerType.BROKER,
                brand=brand,
                model=make_model(brand),
                manufacture_year=2020,
            )


@pytest.mark.django_db
def test_private_listing_cannot_enable_the_finance_estimate_flag():
    owner = make_user()
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            make_private_listing(owner=owner, show_finance_estimate=True)


@pytest.mark.django_db
def test_broker_listing_may_enable_the_finance_estimate_flag():
    broker = make_broker()
    actor = make_user()
    listing = make_broker_listing(broker=broker, actor=actor, show_finance_estimate=True)

    assert listing.show_finance_estimate is True


@pytest.mark.django_db
def test_manufacture_year_before_1900_is_rejected_by_the_database():
    owner = make_user()
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            make_private_listing(owner=owner, manufacture_year=1899)


@pytest.mark.django_db
def test_negative_or_zero_price_is_rejected_by_the_database():
    owner = make_user()
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            make_private_listing(owner=owner, price=Decimal("0.00"))


@pytest.mark.django_db
def test_a_draft_may_have_no_price_yet():
    listing = make_private_listing(owner=make_user(), price=None)

    assert listing.price is None


@pytest.mark.django_db
def test_custom_model_name_shorter_than_two_characters_is_rejected_by_the_database():
    owner = make_user()
    brand = make_brand()
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            make_private_listing(
                owner=owner,
                brand=brand,
                model=other_model_for(brand),
                custom_model_name="M",
            )


@pytest.mark.django_db
def test_clean_rejects_custom_model_name_on_an_ordinary_model():
    owner = make_user()
    brand = make_brand()
    listing = make_private_listing(owner=owner, brand=brand, model=make_model(brand))
    listing.custom_model_name = "McKenzie"

    with pytest.raises(ValidationError) as exc_info:
        listing.clean()

    assert "custom_model_name" in exc_info.value.message_dict


@pytest.mark.django_db
def test_clean_requires_custom_model_name_on_the_other_placeholder():
    owner = make_user()
    brand = make_brand()
    listing = make_private_listing(
        owner=owner, brand=brand, model=other_model_for(brand), custom_model_name="McKenzie"
    )
    listing.custom_model_name = ""

    with pytest.raises(ValidationError) as exc_info:
        listing.clean()

    assert "custom_model_name" in exc_info.value.message_dict


@pytest.mark.django_db
def test_clean_rejects_a_manufacture_year_beyond_next_year():
    owner = make_user()
    listing = make_private_listing(owner=owner)
    listing.manufacture_year = timezone.now().year + 2

    with pytest.raises(ValidationError) as exc_info:
        listing.clean()

    assert "manufacture_year" in exc_info.value.message_dict


@pytest.mark.django_db
def test_clean_accepts_next_year_as_a_manufacture_year():
    owner = make_user()
    listing = make_private_listing(owner=owner)
    listing.manufacture_year = BoatListing.max_manufacture_year()

    listing.clean()  # must not raise


@pytest.mark.django_db
def test_clean_rejects_an_unsupported_currency():
    listing = make_private_listing(owner=make_user())
    listing.currency = "USD"

    with pytest.raises(ValidationError) as exc_info:
        listing.clean()

    assert "currency" in exc_info.value.message_dict
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd backend
uv run pytest listings/tests/test_boat_listing_model.py -v
```

Expected: collection `ERROR` — `ModuleNotFoundError: No module named 'listings.models'`.

- [ ] **Step 3: Implement the model**

`backend/listings/models.py`:

```python
"""Listing domain models (NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md §11.4, §11.5).

Public pages read from BoatListing.current_public_snapshot, never from the
mutable draft columns below (spec §11.4).
"""

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.utils import timezone

from accounts.enums import SellerType
from common.models import UUIDTimeStampedModel

from .enums import ListingStatus, PublicationSource

MIN_MANUFACTURE_YEAR = 1900
CUSTOM_MODEL_NAME_MIN_LENGTH = 2
CUSTOM_MODEL_NAME_MAX_LENGTH = 100
# Spec §11.4: "currency ISO-4217, initially EUR". Spec §18.2 requires an
# eligibility check for "listing.currency is supported", so the supported set is
# explicit rather than implied.
SUPPORTED_CURRENCIES = frozenset({"EUR"})


class BoatListing(UUIDTimeStampedModel):
    owner_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="owned_listings",
    )
    broker = models.ForeignKey(
        "brokers.BrokerOrganization",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="listings",
    )
    seller_type = models.CharField(max_length=7, choices=SellerType.choices)
    brand = models.ForeignKey(
        "taxonomy.BoatBrand", on_delete=models.PROTECT, related_name="listings"
    )
    model = models.ForeignKey(
        "taxonomy.BoatModel", on_delete=models.PROTECT, related_name="listings"
    )
    custom_model_name = models.CharField(
        max_length=CUSTOM_MODEL_NAME_MAX_LENGTH, blank=True, default=""
    )
    manufacture_year = models.PositiveSmallIntegerField()
    status = models.CharField(
        max_length=16, choices=ListingStatus.choices, default=ListingStatus.DRAFT
    )
    currency = models.CharField(max_length=3, default="EUR")
    price = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    show_finance_estimate = models.BooleanField(default=False)
    finance_down_payment_override_percent = models.DecimalField(
        max_digits=7, decimal_places=4, null=True, blank=True
    )
    finance_rate_override_percent = models.DecimalField(
        max_digits=7, decimal_places=4, null=True, blank=True
    )
    finance_term_override_months = models.PositiveIntegerField(null=True, blank=True)
    publication_source = models.CharField(
        max_length=16, choices=PublicationSource.choices, blank=True, default=""
    )
    # Loose reference to Phase 13's UserEntitlement (spec §11.9), which does not
    # exist yet. Converted to a real ForeignKey by Phase 13.
    consumed_entitlement_id = models.UUIDField(null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    view_count_cached = models.BigIntegerField(default=0)
    # Optimistic locking (spec §20.5); bumped by listings.locking.bump_version().
    version = models.PositiveIntegerField(default=1)
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

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "-published_at"]),
            models.Index(fields=["owner_user", "status"]),
            models.Index(fields=["broker", "status"]),
            models.Index(fields=["expires_at"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=~Q(seller_type=SellerType.PRIVATE)
                | (Q(owner_user__isnull=False) & Q(broker__isnull=True)),
                name="listings_private_requires_owner_and_no_broker",
            ),
            models.CheckConstraint(
                condition=~Q(seller_type=SellerType.BROKER)
                | (Q(broker__isnull=False) & Q(owner_user__isnull=True)),
                name="listings_broker_requires_org_and_no_owner",
            ),
            models.CheckConstraint(
                condition=Q(show_finance_estimate=False)
                | Q(seller_type=SellerType.BROKER),
                name="listings_finance_flag_requires_broker",
            ),
            models.CheckConstraint(
                condition=Q(manufacture_year__gte=MIN_MANUFACTURE_YEAR),
                name="listings_manufacture_year_at_least_1900",
            ),
            models.CheckConstraint(
                condition=Q(price__isnull=True) | Q(price__gt=0),
                name="listings_price_is_positive_when_present",
            ),
            models.CheckConstraint(
                condition=Q(custom_model_name="")
                | Q(
                    custom_model_name__regex=(
                        rf"^.{{{CUSTOM_MODEL_NAME_MIN_LENGTH},"
                        rf"{CUSTOM_MODEL_NAME_MAX_LENGTH}}}$"
                    )
                ),
                name="listings_custom_model_name_length_2_to_100",
            ),
        ]

    def __str__(self):
        return f"{self.brand_id} {self.model_id} ({self.status})"

    @staticmethod
    def max_manufacture_year() -> int:
        """Spec §11.4: "between 1900 and current year + 1"."""
        return timezone.now().year + 1

    def clean(self):
        errors = {}

        if self.currency not in SUPPORTED_CURRENCIES:
            errors["currency"] = (
                f"Unsupported currency: {self.currency}. "
                f"Supported: {', '.join(sorted(SUPPORTED_CURRENCIES))}."
            )

        if self.manufacture_year is not None and self.manufacture_year > self.max_manufacture_year():
            errors["manufacture_year"] = (
                f"Manufacture year must not be later than {self.max_manufacture_year()}."
            )

        # Cross-table rule (spec §11.4) — cannot be a database CheckConstraint.
        if self.model_id is not None:
            trimmed = (self.custom_model_name or "").strip()
            if self.model.is_other_placeholder:
                if not (
                    CUSTOM_MODEL_NAME_MIN_LENGTH
                    <= len(trimmed)
                    <= CUSTOM_MODEL_NAME_MAX_LENGTH
                ):
                    errors["custom_model_name"] = (
                        "The Other model requires custom text between "
                        f"{CUSTOM_MODEL_NAME_MIN_LENGTH} and "
                        f"{CUSTOM_MODEL_NAME_MAX_LENGTH} characters."
                    )
            elif trimmed:
                errors["custom_model_name"] = (
                    "Custom model text is only allowed when the Other model is selected."
                )

        if errors:
            raise ValidationError(errors)
```

`backend/listings/admin.py`:

```python
from django.contrib import admin

from .models import BoatListing


@admin.register(BoatListing)
class BoatListingAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "seller_type",
        "status",
        "brand",
        "model",
        "manufacture_year",
        "price",
        "published_at",
        "expires_at",
        "version",
    )
    list_filter = ("status", "seller_type", "show_finance_estimate")
    search_fields = ("id", "custom_model_name")
    readonly_fields = (
        "id",
        "version",
        "published_at",
        "expires_at",
        "publication_source",
        "consumed_entitlement_id",
        "view_count_cached",
        "created_at",
        "updated_at",
    )
    raw_id_fields = ("owner_user", "broker", "brand", "model", "created_by", "updated_by")
```

- [ ] **Step 4: Generate the migration and run the tests**

```bash
cd backend
uv run python manage.py makemigrations listings
uv run pytest listings/tests/test_boat_listing_model.py -v
```

Expected: a migration named like `listings/migrations/0001_initial.py` is created, and all `test_boat_listing_model.py` tests PASS.

- [ ] **Step 5: Confirm no migration drift and run the whole suite**

```bash
cd backend
uv run python manage.py makemigrations --check --dry-run
uv run pytest
```

Expected: `No changes detected`; the full suite passes with no regressions.

- [ ] **Step 6: Commit**

```bash
git add backend/listings
git commit -m "feat(listings): add BoatListing with spec-exact ownership, finance and taxonomy constraints"
```

---

### Task 3: `ListingMedia` model, allowance-relevant constraints and admin

**Files:**
- Modify: `backend/listings/models.py`, `backend/listings/admin.py`, `backend/listings/tests/factories.py`
- Test: `backend/listings/tests/test_listing_media_model.py`
- Generated: `backend/listings/migrations/0002_listingmedia.py`

**Interfaces:**
- Consumes: `listings.models.BoatListing` (Task 2); `listings.enums.{MediaType, MediaStatus}` (Task 1).
- Produces: `listings.models.ListingMedia` with fields `id`, `listing`, `media_type`, `storage_key`, `status`, `mime_type`, `byte_size`, `width`, `height`, `duration_seconds`, `sort_order`, `checksum_sha256`, `created_by`, `created_at`, `updated_at`; the manager helpers `ListingMedia.objects.non_rejected()` and `ListingMedia.objects.ready()`.
- Produces: `listings.tests.factories.make_media(listing, *, media_type=MediaType.IMAGE, status=MediaStatus.READY, sort_order=0) -> ListingMedia`.

**Note (ruling — model only, no pipeline):** per the phase boundary above, this task creates the table and its invariants and nothing else. There is no upload intent endpoint, no signed URL, no checksum verification against real bytes, no malware scan and no transcode; spec §24 assigns all of that to Phase 15. `status` is therefore an ordinary writable column in this phase: tests and Django admin move a row to `READY` directly. The workflow rule this phase *does* enforce is spec §11.5's — only `READY` media may enter a submitted revision or public snapshot, and allowance counting includes every non-`REJECTED` row (Task 7, Task 10).

**Note (ruling — `ListingMedia` gets `updated_at`, `ListingSnapshot` does not):** spec §11.5 lists only `created_at` on `ListingMedia`. But a media row is genuinely mutable — it walks `UPLOADING → SCANNING → PROCESSING → READY`/`REJECTED` and its `sort_order` changes — so `UUIDTimeStampedModel`'s `updated_at` records something true and matches every other mutable domain model in this codebase. `ListingSnapshot` (Task 4) is the opposite case and is handled there.

**Note (ruling — `unique(listing, media_type, sort_order)`):** spec §36.5 says "Primary image is the first ready image by explicit order", which is only well-defined if the order has no ties. Uniqueness is scoped per `media_type` so that images and videos number independently (an image at `sort_order=0` and a video at `sort_order=0` are both legitimate).

- [ ] **Step 1: Write the failing tests**

Append to `backend/listings/tests/factories.py`:

```python
import hashlib
import uuid

from listings.enums import MediaStatus, MediaType
from listings.models import ListingMedia


def make_media(listing, *, media_type=MediaType.IMAGE, status=MediaStatus.READY, sort_order=0, **kwargs):
    unique = uuid.uuid4().hex
    defaults = {
        "listing": listing,
        "media_type": media_type,
        "status": status,
        "sort_order": sort_order,
        "storage_key": f"listings/{listing.pk}/{unique}",
        "mime_type": "image/jpeg" if media_type == MediaType.IMAGE else "video/mp4",
        "byte_size": 204_800,
        "width": 1920 if media_type == MediaType.IMAGE else 1280,
        "height": 1080 if media_type == MediaType.IMAGE else 720,
        "duration_seconds": None if media_type == MediaType.IMAGE else 45,
        "checksum_sha256": hashlib.sha256(unique.encode()).hexdigest(),
    }
    defaults.update(kwargs)
    return ListingMedia.objects.create(**defaults)
```

`backend/listings/tests/test_listing_media_model.py`:

```python
import pytest
from django.db import IntegrityError, transaction

from accounts.tests.factories import make_user
from listings.enums import MediaStatus, MediaType
from listings.models import ListingMedia
from listings.tests.factories import make_media, make_private_listing


@pytest.mark.django_db
def test_media_defaults_to_uploading_when_status_is_not_supplied():
    listing = make_private_listing(owner=make_user())
    media = make_media(listing, status=MediaStatus.UPLOADING)

    assert media.status == MediaStatus.UPLOADING
    assert media.media_type == MediaType.IMAGE


@pytest.mark.django_db
def test_duplicate_storage_key_on_one_listing_is_rejected():
    listing = make_private_listing(owner=make_user())
    first = make_media(listing)

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            make_media(listing, storage_key=first.storage_key, sort_order=1)


@pytest.mark.django_db
def test_duplicate_sort_order_within_one_media_type_is_rejected():
    listing = make_private_listing(owner=make_user())
    make_media(listing, media_type=MediaType.IMAGE, sort_order=0)

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            make_media(listing, media_type=MediaType.IMAGE, sort_order=0)


@pytest.mark.django_db
def test_an_image_and_a_video_may_share_a_sort_order():
    listing = make_private_listing(owner=make_user())
    make_media(listing, media_type=MediaType.IMAGE, sort_order=0)
    video = make_media(listing, media_type=MediaType.VIDEO, sort_order=0)

    assert video.pk is not None


@pytest.mark.django_db
def test_zero_byte_media_is_rejected():
    listing = make_private_listing(owner=make_user())

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            make_media(listing, byte_size=0)


@pytest.mark.django_db
def test_a_malformed_checksum_is_rejected():
    listing = make_private_listing(owner=make_user())

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            make_media(listing, checksum_sha256="not-a-sha256")


@pytest.mark.django_db
def test_non_rejected_counts_every_status_except_rejected():
    listing = make_private_listing(owner=make_user())
    make_media(listing, status=MediaStatus.UPLOADING, sort_order=0)
    make_media(listing, status=MediaStatus.SCANNING, sort_order=1)
    make_media(listing, status=MediaStatus.PROCESSING, sort_order=2)
    make_media(listing, status=MediaStatus.READY, sort_order=3)
    make_media(listing, status=MediaStatus.REJECTED, sort_order=4)

    assert ListingMedia.objects.non_rejected().filter(listing=listing).count() == 4
    assert ListingMedia.objects.ready().filter(listing=listing).count() == 1


@pytest.mark.django_db
def test_media_is_ordered_by_type_then_sort_order():
    listing = make_private_listing(owner=make_user())
    second = make_media(listing, sort_order=1)
    first = make_media(listing, sort_order=0)

    assert list(ListingMedia.objects.filter(listing=listing)) == [first, second]


@pytest.mark.django_db
def test_deleting_a_listing_deletes_its_media():
    listing = make_private_listing(owner=make_user())
    make_media(listing)

    listing.delete()

    assert ListingMedia.objects.count() == 0
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd backend
uv run pytest listings/tests/test_listing_media_model.py -v
```

Expected: collection `ERROR` — `ImportError: cannot import name 'ListingMedia' from 'listings.models'`.

- [ ] **Step 3: Implement the model**

Append to `backend/listings/models.py` (and add `MediaStatus, MediaType` to the existing `from .enums import ...` line):

```python
class ListingMediaQuerySet(models.QuerySet):
    def non_rejected(self):
        """Spec §11.5: "Media count limits include all non-rejected items to
        prevent concurrent upload bypasses."""
        return self.exclude(status=MediaStatus.REJECTED)

    def ready(self):
        """Spec §11.5: "Only READY media can enter a submitted revision/public
        snapshot."""
        return self.filter(status=MediaStatus.READY)


class ListingMedia(UUIDTimeStampedModel):
    """Spec §11.5. This phase owns the model only — the upload/scan/transcode
    pipeline is spec Phase 15 (§24), which will drive `status` for real."""

    listing = models.ForeignKey(
        BoatListing, on_delete=models.CASCADE, related_name="media"
    )
    media_type = models.CharField(max_length=5, choices=MediaType.choices)
    storage_key = models.CharField(max_length=500)
    status = models.CharField(
        max_length=10, choices=MediaStatus.choices, default=MediaStatus.UPLOADING
    )
    mime_type = models.CharField(max_length=100)
    byte_size = models.PositiveBigIntegerField()
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    duration_seconds = models.PositiveIntegerField(null=True, blank=True)
    sort_order = models.PositiveIntegerField(default=0)
    checksum_sha256 = models.CharField(max_length=64)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    objects = ListingMediaQuerySet.as_manager()

    class Meta:
        ordering = ["media_type", "sort_order", "created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["listing", "storage_key"],
                name="listings_media_unique_storage_key_per_listing",
            ),
            models.UniqueConstraint(
                fields=["listing", "media_type", "sort_order"],
                name="listings_media_unique_sort_order_per_type",
            ),
            models.CheckConstraint(
                condition=Q(byte_size__gt=0),
                name="listings_media_byte_size_is_positive",
            ),
            models.CheckConstraint(
                condition=Q(checksum_sha256__regex=r"^[0-9a-f]{64}$"),
                name="listings_media_checksum_is_lowercase_sha256_hex",
            ),
        ]

    def __str__(self):
        return f"{self.media_type} {self.storage_key} ({self.status})"
```

Append to `backend/listings/admin.py`:

```python
from .models import ListingMedia


@admin.register(ListingMedia)
class ListingMediaAdmin(admin.ModelAdmin):
    list_display = ("id", "listing", "media_type", "status", "sort_order", "byte_size")
    list_filter = ("media_type", "status")
    search_fields = ("id", "storage_key", "checksum_sha256")
    raw_id_fields = ("listing", "created_by")
```

- [ ] **Step 4: Generate the migration and run the tests**

```bash
cd backend
uv run python manage.py makemigrations listings
uv run pytest listings/tests/test_listing_media_model.py -v
```

Expected: a `0002_listingmedia`-style migration is created; all tests PASS.

- [ ] **Step 5: Confirm no migration drift and run the whole suite**

```bash
cd backend
uv run python manage.py makemigrations --check --dry-run
uv run pytest
```

Expected: `No changes detected`; full suite green.

- [ ] **Step 6: Commit**

```bash
git add backend/listings
git commit -m "feat(listings): add ListingMedia model with ready/non-rejected allowance queries"
```

---

### Task 4: `ListingSnapshot` and `ListingRevision` models, plus `BoatListing.current_public_snapshot`

**Files:**
- Modify: `backend/listings/models.py`, `backend/listings/admin.py`, `backend/listings/tests/factories.py`
- Test: `backend/listings/tests/test_snapshot_revision_models.py`
- Generated: `backend/listings/migrations/0003_listingsnapshot_listingrevision.py`

**Interfaces:**
- Consumes: `listings.models.BoatListing` (Task 2); `listings.enums.{RevisionStatus, RevisionOrigin, DECIDED_REVISION_STATES, NOTE_REQUIRED_REVISION_STATES, OPEN_REVISION_STATES}` (Task 1); `common.models.UUIDModel`.
- Produces: `listings.models.ListingSnapshot` with fields `id`, `listing`, `version`, `approved_revision`, `brand_name_snapshot`, `model_name_snapshot`, `custom_model_name_snapshot`, `manufacture_year_snapshot`, `title_en`, `title_it`, `title_es`, `description_en`, `description_it`, `description_es`, `specifications`, `specifications_schema_version`, `location_country`, `location_region`, `location_city`, `currency`, `price`, `media_manifest`, `approved_by`, `approved_at`, `created_at`.
- Produces: `listings.models.ListingRevision` with fields `id`, `listing`, `revision_number`, `base_snapshot`, `state`, `origin`, `payload`, `submitted_by`, `submitted_at`, `decided_by`, `decided_at`, `decision_note`, `version`, `created_at`, `updated_at`.
- Produces: `listings.models.BoatListing.current_public_snapshot` (nullable FK to `ListingSnapshot`, `related_name="+"`, `on_delete=PROTECT`).
- Produces: `listings.models.{CONSTRAINT_OPEN_STATES, CONSTRAINT_DECIDED_STATES, CONSTRAINT_NOTE_REQUIRED_STATES}` (ordered tuples used inside constraints).
- Produces: `listings.tests.factories.{make_revision, make_snapshot}`.

**Note (ruling — `ListingSnapshot` inherits `UUIDModel`, not `UUIDTimeStampedModel`):** spec §11.4 calls `ListingSnapshot` "Immutable, versioned public content" and gives it `approved_at`, not `created_at`/`updated_at`. `backend/common/models.py`'s own docstring says `TimeStampedModel` is "Not suitable for append-only/immutable models (e.g. `audit.AuditEvent`), which should declare only `created_at` themselves — an `updated_at` field would imply the row can legitimately change after creation." `ListingSnapshot` therefore inherits `UUIDModel` and declares `created_at` itself, exactly as `AuditEvent` does. `approved_at` (when the moderator decided) and `created_at` (when the row was written) are both kept because spec §11.4 names `approved_at` explicitly and a staff-authored correction can carry a decision time the snapshot builder does not control.

**Note (ruling — snapshots block updates but allow deletes):** `save()` raises on any non-adding write, and the default manager's `update()` raises too, mirroring `audit.AuditEvent`, so "historical snapshot remains immutable" (spec §20.3) is enforced in code rather than by convention. `delete()` is **not** blocked, because spec §36.5 contemplates eventual physical cleanup ("Media referenced by any public snapshot cannot be physically deleted until snapshot retention permits it") and because deleting a whole listing must cascade. `BoatListing.current_public_snapshot` uses `on_delete=PROTECT`, so the *live* snapshot can never be deleted out from under a published listing.

**Note (ruling — spec's `title_*`/`description_*`/`location fields` expanded to exact columns):** spec §11.4 writes `title_*, description_*` and `location fields` without enumerating them. Spec §0 and §37 fix the supported languages as exactly English (`en`), Italian (`it`) and Spanish (`es`), so the localized columns are `title_en`/`title_it`/`title_es` and `description_en`/`description_it`/`description_es`, with the `en` pair required and the other four optional (spec §25.5 makes translation "user-triggered", so a listing may legitimately carry only its source language). The location columns are `location_country` (ISO-3166-1 alpha-2, required), `location_region` (optional) and `location_city` (required) — the minimum the public card in spec §29.1 needs ("Location") without inventing an address model the spec never describes.

**Note (ruling — `specifications JSON with schema version` becomes a column plus a JSON blob):** the version is stored in its own queryable integer column `specifications_schema_version` rather than inside the JSON, so a future migration can find every row on an old schema with an index-friendly filter instead of a JSON path scan. The payload schema (Task 5) stamps `SPECIFICATIONS_SCHEMA_VERSION = 1`.

**Note (ruling — `submitted_by` is nullable, unlike spec §11.4's bare `submitted_by FK`):** a revision row exists in `DRAFT` before anyone submits it, and spec §11.4 itself makes the paired `submitted_at` nullable. `submitted_by` is therefore nullable too, with a `CheckConstraint` making both stamps **mandatory for every state other than `DRAFT`** — which is the real invariant. A revision sent back by "request changes" returns to `DRAFT` but keeps the stamps from its last submission, so the constraint deliberately does not force them back to `NULL`.

**Note (ruling — at most one open revision per listing):** spec §20 talks throughout about "the" revision of a listing ("On submit, revision becomes `SUBMITTED`"), and §20.5's optimistic-locking contract is only coherent if "the open revision" is a single unambiguous row. A partial `UniqueConstraint` over `listing` where `state IN ('DRAFT', 'SUBMITTED')` enforces that in the database, which is also what makes Task 15's concurrency test meaningful. A listing accumulates any number of *closed* revisions (`APPROVED`, `CHANGES_REQUESTED`, `REJECTED`, `WITHDRAWN`).

**Note (constraint state lists are explicit tuples, not the enums' frozensets):** `frozenset` iteration order is not stable across Python processes, so embedding one in a `CheckConstraint` would make `makemigrations` emit a spurious migration at random. The model module declares ordered tuples for constraint use, and `test_constraint_state_tuples_match_the_enum_groupings` pins them to the canonical groupings so the two can never drift.

- [ ] **Step 1: Write the failing tests**

Append to `backend/listings/tests/factories.py`:

```python
from django.utils import timezone

from listings.enums import RevisionOrigin, RevisionStatus
from listings.models import ListingRevision, ListingSnapshot


def make_revision(listing, **kwargs):
    defaults = {
        "listing": listing,
        "revision_number": listing.revisions.count() + 1,
        "state": RevisionStatus.DRAFT,
        "origin": RevisionOrigin.OWNER,
        "payload": {},
    }
    defaults.update(kwargs)
    return ListingRevision.objects.create(**defaults)


def make_snapshot(listing, *, approved_by, version=1, **kwargs):
    defaults = {
        "listing": listing,
        "version": version,
        "brand_name_snapshot": listing.brand.name,
        "model_name_snapshot": listing.model.name,
        "custom_model_name_snapshot": listing.custom_model_name,
        "manufacture_year_snapshot": listing.manufacture_year,
        "title_en": "A very nice boat",
        "description_en": "Well kept, one owner.",
        "specifications": {"length_m": "14.6"},
        "specifications_schema_version": 1,
        "location_country": "IT",
        "location_city": "Genoa",
        "currency": listing.currency,
        "price": listing.price,
        "media_manifest": [],
        "approved_by": approved_by,
        "approved_at": timezone.now(),
    }
    defaults.update(kwargs)
    return ListingSnapshot.objects.create(**defaults)
```

`backend/listings/tests/test_snapshot_revision_models.py`:

```python
import pytest
from django.db import IntegrityError, transaction
from django.db.models import ProtectedError
from django.utils import timezone

from accounts.tests.factories import make_user
from listings.enums import (
    DECIDED_REVISION_STATES,
    NOTE_REQUIRED_REVISION_STATES,
    OPEN_REVISION_STATES,
    RevisionStatus,
)
from listings.models import (
    CONSTRAINT_DECIDED_STATES,
    CONSTRAINT_NOTE_REQUIRED_STATES,
    CONSTRAINT_OPEN_STATES,
    ListingSnapshot,
)
from listings.tests.factories import make_private_listing, make_revision, make_snapshot


def test_constraint_state_tuples_match_the_enum_groupings():
    assert frozenset(CONSTRAINT_OPEN_STATES) == OPEN_REVISION_STATES
    assert frozenset(CONSTRAINT_DECIDED_STATES) == DECIDED_REVISION_STATES
    assert frozenset(CONSTRAINT_NOTE_REQUIRED_STATES) == NOTE_REQUIRED_REVISION_STATES


@pytest.mark.django_db
def test_two_snapshots_cannot_share_a_version_on_one_listing():
    staff = make_user()
    listing = make_private_listing(owner=make_user())
    make_snapshot(listing, approved_by=staff, version=1)

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            make_snapshot(listing, approved_by=staff, version=1)


@pytest.mark.django_db
def test_a_snapshot_cannot_be_updated_after_creation():
    listing = make_private_listing(owner=make_user())
    snapshot = make_snapshot(listing, approved_by=make_user())

    snapshot.title_en = "Rewritten history"
    with pytest.raises(ValueError, match="immutable"):
        snapshot.save()


@pytest.mark.django_db
def test_queryset_update_cannot_rewrite_a_snapshot():
    listing = make_private_listing(owner=make_user())
    make_snapshot(listing, approved_by=make_user())

    with pytest.raises(ValueError, match="immutable"):
        ListingSnapshot.objects.all().update(title_en="Rewritten history")


@pytest.mark.django_db
def test_two_revisions_cannot_share_a_revision_number_on_one_listing():
    owner = make_user()
    listing = make_private_listing(owner=owner)
    make_revision(listing, revision_number=1)

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            make_revision(
                listing,
                revision_number=1,
                state=RevisionStatus.REJECTED,
                submitted_by=owner,
                submitted_at=timezone.now(),
                decided_by=make_user(),
                decided_at=timezone.now(),
                decision_note="duplicate",
            )


@pytest.mark.django_db
def test_a_listing_can_have_only_one_open_revision():
    listing = make_private_listing(owner=make_user())
    make_revision(listing, revision_number=1, state=RevisionStatus.DRAFT)

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            make_revision(
                listing,
                revision_number=2,
                state=RevisionStatus.SUBMITTED,
                submitted_by=make_user(),
                submitted_at=timezone.now(),
            )


@pytest.mark.django_db
def test_closed_revisions_do_not_block_a_new_open_revision():
    owner = make_user()
    listing = make_private_listing(owner=owner)
    make_revision(
        listing,
        revision_number=1,
        state=RevisionStatus.REJECTED,
        submitted_by=owner,
        submitted_at=timezone.now(),
        decided_by=make_user(),
        decided_at=timezone.now(),
        decision_note="Not enough detail.",
    )

    second = make_revision(listing, revision_number=2, state=RevisionStatus.DRAFT)

    assert second.pk is not None


@pytest.mark.django_db
def test_a_non_draft_revision_requires_submission_stamps():
    listing = make_private_listing(owner=make_user())

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            make_revision(listing, revision_number=1, state=RevisionStatus.SUBMITTED)


@pytest.mark.django_db
def test_a_decided_revision_requires_decision_stamps():
    owner = make_user()
    listing = make_private_listing(owner=owner)

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            make_revision(
                listing,
                revision_number=1,
                state=RevisionStatus.APPROVED,
                submitted_by=owner,
                submitted_at=timezone.now(),
            )


@pytest.mark.django_db
def test_request_changes_and_reject_require_a_decision_note():
    owner = make_user()
    listing = make_private_listing(owner=owner)

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            make_revision(
                listing,
                revision_number=1,
                state=RevisionStatus.CHANGES_REQUESTED,
                submitted_by=owner,
                submitted_at=timezone.now(),
                decided_by=make_user(),
                decided_at=timezone.now(),
                decision_note="",
            )


@pytest.mark.django_db
def test_approval_does_not_require_a_decision_note():
    owner = make_user()
    listing = make_private_listing(owner=owner)

    revision = make_revision(
        listing,
        revision_number=1,
        state=RevisionStatus.APPROVED,
        submitted_by=owner,
        submitted_at=timezone.now(),
        decided_by=make_user(),
        decided_at=timezone.now(),
        decision_note="",
    )

    assert revision.pk is not None


@pytest.mark.django_db
def test_a_listing_can_point_at_its_current_public_snapshot():
    listing = make_private_listing(owner=make_user())
    snapshot = make_snapshot(listing, approved_by=make_user())

    listing.current_public_snapshot = snapshot
    listing.save(update_fields=["current_public_snapshot"])
    listing.refresh_from_db()

    assert listing.current_public_snapshot_id == snapshot.pk


@pytest.mark.django_db
def test_the_current_public_snapshot_cannot_be_deleted_while_referenced():
    listing = make_private_listing(owner=make_user())
    snapshot = make_snapshot(listing, approved_by=make_user())
    listing.current_public_snapshot = snapshot
    listing.save(update_fields=["current_public_snapshot"])

    with pytest.raises(ProtectedError):
        snapshot.delete()
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd backend
uv run pytest listings/tests/test_snapshot_revision_models.py -v
```

Expected: collection `ERROR` — `ImportError: cannot import name 'ListingSnapshot' from 'listings.models'`.

- [ ] **Step 3: Implement the two models and the listing column**

First extend the imports at the top of `backend/listings/models.py`:

```python
from django.core.serializers.json import DjangoJSONEncoder

from common.models import UUIDModel, UUIDTimeStampedModel

from .enums import (
    ListingStatus,
    MediaStatus,
    MediaType,
    PublicationSource,
    RevisionOrigin,
    RevisionStatus,
)
```

Add the `current_public_snapshot` column to `BoatListing`, directly after `expires_at`:

```python
    current_public_snapshot = models.ForeignKey(
        "listings.ListingSnapshot",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="+",
    )
```

Then append to `backend/listings/models.py`:

```python
# Ordered tuples for use inside CheckConstraints. frozenset iteration order is
# not stable across processes, so embedding listings.enums' frozensets directly
# would make `makemigrations` emit a spurious migration at random. The test
# `test_constraint_state_tuples_match_the_enum_groupings` pins these to the
# canonical groupings so they cannot drift apart.
CONSTRAINT_OPEN_STATES = (RevisionStatus.DRAFT, RevisionStatus.SUBMITTED)
CONSTRAINT_DECIDED_STATES = (
    RevisionStatus.APPROVED,
    RevisionStatus.CHANGES_REQUESTED,
    RevisionStatus.REJECTED,
)
CONSTRAINT_NOTE_REQUIRED_STATES = (
    RevisionStatus.CHANGES_REQUESTED,
    RevisionStatus.REJECTED,
)


class ListingSnapshotQuerySet(models.QuerySet):
    def update(self, **kwargs):
        raise ValueError(
            "ListingSnapshot rows are immutable public content; "
            "bulk update is not permitted."
        )


class ListingSnapshot(UUIDModel):
    """Immutable, versioned public content (spec §11.4).

    Public pages read this, never BoatListing's mutable draft columns. Rows are
    written only by listings.snapshots.create_snapshot_from_revision() and are
    never rewritten: a taxonomy correction or a later edit creates the *next*
    version and leaves history intact (spec §11.4, §20.3).

    Inherits UUIDModel rather than UUIDTimeStampedModel deliberately: an
    `updated_at` column on an immutable row would be a lie (see the docstring on
    common.models.TimeStampedModel and the same decision in audit.AuditEvent).
    """

    listing = models.ForeignKey(
        BoatListing, on_delete=models.CASCADE, related_name="snapshots"
    )
    version = models.PositiveIntegerField()
    approved_revision = models.ForeignKey(
        "listings.ListingRevision",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="approved_snapshots",
    )
    brand_name_snapshot = models.CharField(max_length=150)
    model_name_snapshot = models.CharField(max_length=150)
    custom_model_name_snapshot = models.CharField(
        max_length=CUSTOM_MODEL_NAME_MAX_LENGTH, blank=True, default=""
    )
    manufacture_year_snapshot = models.PositiveSmallIntegerField()
    title_en = models.CharField(max_length=200)
    title_it = models.CharField(max_length=200, blank=True, default="")
    title_es = models.CharField(max_length=200, blank=True, default="")
    description_en = models.TextField()
    description_it = models.TextField(blank=True, default="")
    description_es = models.TextField(blank=True, default="")
    specifications = models.JSONField(default=dict, encoder=DjangoJSONEncoder)
    specifications_schema_version = models.PositiveIntegerField(default=1)
    location_country = models.CharField(max_length=2)
    location_region = models.CharField(max_length=120, blank=True, default="")
    location_city = models.CharField(max_length=120)
    currency = models.CharField(max_length=3)
    price = models.DecimalField(max_digits=14, decimal_places=2)
    media_manifest = models.JSONField(default=list, encoder=DjangoJSONEncoder)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    approved_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    objects = ListingSnapshotQuerySet.as_manager()

    class Meta:
        ordering = ["listing", "-version"]
        constraints = [
            models.UniqueConstraint(
                fields=["listing", "version"],
                name="listings_snapshot_unique_version_per_listing",
            ),
            models.CheckConstraint(
                condition=Q(version__gte=1),
                name="listings_snapshot_version_is_positive",
            ),
            models.CheckConstraint(
                condition=Q(price__gt=0), name="listings_snapshot_price_is_positive"
            ),
        ]

    def __str__(self):
        return f"{self.listing_id} v{self.version}"

    def save(self, *args, **kwargs):
        # `_state.adding` rather than `pk is None`: UUIDModel assigns the pk at
        # instantiation, so a brand-new unsaved row already has one.
        if not self._state.adding:
            raise ValueError("ListingSnapshot rows are immutable once created.")
        super().save(*args, **kwargs)


class ListingRevision(UUIDTimeStampedModel):
    """A proposed change to a listing (spec §11.4, §6.2).

    `payload` is the single write surface for editable content and is validated
    against the explicit schema in listings.payloads before it is ever stored.
    """

    listing = models.ForeignKey(
        BoatListing, on_delete=models.CASCADE, related_name="revisions"
    )
    revision_number = models.PositiveIntegerField()
    base_snapshot = models.ForeignKey(
        ListingSnapshot,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="based_revisions",
    )
    state = models.CharField(
        max_length=17, choices=RevisionStatus.choices, default=RevisionStatus.DRAFT
    )
    origin = models.CharField(
        max_length=16, choices=RevisionOrigin.choices, default=RevisionOrigin.OWNER
    )
    payload = models.JSONField(default=dict, encoder=DjangoJSONEncoder)
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="submitted_listing_revisions",
    )
    submitted_at = models.DateTimeField(null=True, blank=True)
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="decided_listing_revisions",
    )
    decided_at = models.DateTimeField(null=True, blank=True)
    decision_note = models.TextField(blank=True, default="")
    # Optimistic locking (spec §20.5); bumped by listings.locking.bump_version().
    version = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ["listing", "-revision_number"]
        indexes = [models.Index(fields=["state", "submitted_at"])]
        constraints = [
            models.UniqueConstraint(
                fields=["listing", "revision_number"],
                name="listings_revision_unique_number_per_listing",
            ),
            models.UniqueConstraint(
                fields=["listing"],
                condition=Q(state__in=CONSTRAINT_OPEN_STATES),
                name="listings_revision_one_open_per_listing",
            ),
            models.CheckConstraint(
                condition=Q(state=RevisionStatus.DRAFT)
                | (Q(submitted_by__isnull=False) & Q(submitted_at__isnull=False)),
                name="listings_revision_non_draft_requires_submission_stamps",
            ),
            models.CheckConstraint(
                condition=~Q(state__in=CONSTRAINT_DECIDED_STATES)
                | (Q(decided_by__isnull=False) & Q(decided_at__isnull=False)),
                name="listings_revision_decided_requires_decision_stamps",
            ),
            models.CheckConstraint(
                condition=~Q(state__in=CONSTRAINT_NOTE_REQUIRED_STATES)
                | ~Q(decision_note=""),
                name="listings_revision_refusal_requires_a_note",
            ),
            models.CheckConstraint(
                condition=Q(revision_number__gte=1),
                name="listings_revision_number_is_positive",
            ),
        ]

    def __str__(self):
        return f"{self.listing_id} r{self.revision_number} ({self.state})"
```

Append to `backend/listings/admin.py`:

```python
from .models import ListingRevision, ListingSnapshot


@admin.register(ListingSnapshot)
class ListingSnapshotAdmin(admin.ModelAdmin):
    list_display = ("id", "listing", "version", "price", "approved_by", "approved_at")
    search_fields = ("id", "listing__id", "title_en")
    raw_id_fields = ("listing", "approved_revision", "approved_by")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(ListingRevision)
class ListingRevisionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "listing",
        "revision_number",
        "state",
        "origin",
        "submitted_at",
        "decided_by",
        "decided_at",
        "version",
    )
    list_filter = ("state", "origin")
    search_fields = ("id", "listing__id")
    raw_id_fields = ("listing", "base_snapshot", "submitted_by", "decided_by")
    readonly_fields = ("version", "created_at", "updated_at")
```

- [ ] **Step 4: Generate the migration and run the tests**

```bash
cd backend
uv run python manage.py makemigrations listings
uv run pytest listings/tests/test_snapshot_revision_models.py -v
```

Expected: a `0003_*` migration creating both models and adding `boatlisting.current_public_snapshot`; all tests PASS.

- [ ] **Step 5: Confirm no migration drift and run the whole suite**

```bash
cd backend
uv run python manage.py makemigrations --check --dry-run
uv run pytest
```

Expected: `No changes detected`; full suite green.

- [ ] **Step 6: Commit**

```bash
git add backend/listings
git commit -m "feat(listings): add immutable ListingSnapshot and ListingRevision with one-open-revision invariant"
```

---

### Task 5: Revision payload schema, role/state-aware validation and `immutable_after_publication`

**Files:**
- Create: `backend/listings/payloads.py`
- Test: `backend/listings/tests/test_payloads.py`

**Interfaces:**
- Consumes: `listings.models.{BoatListing, SUPPORTED_CURRENCIES, CUSTOM_MODEL_NAME_MIN_LENGTH, CUSTOM_MODEL_NAME_MAX_LENGTH, MIN_MANUFACTURE_YEAR}` (Task 2); `listings.enums.RevisionOrigin` (Task 1); `accounts.enums.SellerType`; `taxonomy.services.normalize_custom_model_name`.
- Produces: `listings.payloads.SPECIFICATIONS_SCHEMA_VERSION: int = 1`; the constants `TITLE_FIELDS`, `DESCRIPTION_FIELDS`, `CONTENT_FIELDS`, `TAXONOMY_FIELDS`, `BROKER_FINANCE_FIELDS`, `IMMUTABLE_FIELD_NAMES`, `REQUIRED_FOR_SUBMISSION`, `MAX_MEDIA_IDS`; and

  ```python
  def is_locked_for_owner(listing: BoatListing) -> bool: ...
  def allowed_payload_fields(*, listing: BoatListing, origin: str) -> frozenset[str]: ...
  def validate_revision_payload(
      payload: dict, *, listing: BoatListing, origin: str, for_submission: bool
  ) -> dict: ...
  ```

  `validate_revision_payload` raises `rest_framework.exceptions.ValidationError` and returns the **normalized** payload (money and percentages as canonical decimal strings, `custom_model_name` whitespace-collapsed, `location_country` upper-cased, `media_ids` as a list of `str`).

**Note (ruling — the draft's content lives in the payload, and `BoatListing`'s columns mirror it):** spec §11.4 gives `BoatListing` no title, description, specification or location columns, while its `ListingRevision` entry gives that model `payload JSON validated against explicit schema`, and §11.4's closing paragraph calls `BoatListing`'s own columns "mutable draft fields". This plan reads that literally: `ListingRevision.payload` is the single write surface for **all** editable content; `BoatListing`'s enumerated columns (`brand`, `model`, `custom_model_name`, `manufacture_year`, `price`, `currency` and the four broker finance fields) are a projection of that payload, rewritten inside the same transaction (Task 9), so this phase's database constraints and later phases' queries operate on real columns. Title, description, specifications, location and media selection exist only in the payload and in the snapshot — adding uncalled-for columns to `BoatListing` would contradict the spec's own field list.

**Note (ruling — `immutable_after_publication` triggers on "has ever been published", not "is currently published"):** spec §1 says the individual immutable fields "lock after first publication approval" and §11.4 says "for a private seller **after first publication**". The trigger is therefore `listing.current_public_snapshot_id is not None` — a listing that was published and later expired or was suspended keeps its fields locked, because a public snapshot bearing that brand/model/year already exists and has been indexed and linked.

**Note (ruling — immutability binds private sellers only):** spec §11.4 scopes the rule to "a private seller after first publication", §1 calls the row "Immutable individual fields", and §20.4 (broker listing edits) never mentions locking. Brokers may therefore submit taxonomy changes in an ordinary revision, which then goes through the normal approval path like any other substantive public-field edit (§20.4: "default is that all public content fields are substantive").

**Note (ruling — "contact preference" from spec §20.2 is not implemented):** §20.2's editable examples list "price, description, specifications, location, contact preference and media". No contact-preference field exists anywhere in the spec's data model (§11.4 has none, and contact visibility is governed by `ContactAccessService` in §11.8 / spec Phase 7). It is therefore absent from this phase's payload schema. Recorded in Known Limitations for whoever owns contact policy.

**Note (ruling — `specifications` has an explicit but open schema):** the spec never enumerates boat specification keys (the catalogue is Phase 16's form definition, §25.2 step 3). "Validated against explicit schema" is honoured by validating the *shape*: a JSON object of at most 50 entries, keys matching `^[a-z][a-z0-9_]{0,49}$`, values limited to `str` (≤ 500 characters), `int`, `bool` or `None` — no nested objects or arrays, so a snapshot's specifications can always be rendered as a flat table. The stored blob is stamped with `SPECIFICATIONS_SCHEMA_VERSION`.

**Note (ruling — at least one image is required to submit):** spec §6.1 makes `PUBLISHED` require "required media/content" without naming a number, and §24.1 gives a private seller a base allowance of exactly **1** image — a number that only makes sense if one image is the floor as well as the ceiling. Submission therefore requires a non-empty `media_ids` here, and Task 10 additionally requires at least one of them to be a `READY` `IMAGE` (that check needs the media rows, which this pure validator does not read). Spec §29.1's "Primary approved image **or defined placeholder**" covers migrated legacy rows (§32.1 backfill), not newly submitted listings.

- [ ] **Step 1: Write the failing tests**

`backend/listings/tests/test_payloads.py`:

```python
import uuid
from decimal import Decimal

import pytest
from rest_framework.exceptions import ValidationError

from accounts.tests.factories import make_user
from brokers.tests.factories import make_broker
from listings.enums import RevisionOrigin
from listings.models import BoatListing
from listings.payloads import (
    SPECIFICATIONS_SCHEMA_VERSION,
    allowed_payload_fields,
    validate_revision_payload,
)
from listings.tests.factories import (
    make_brand,
    make_broker_listing,
    make_model,
    make_private_listing,
    make_snapshot,
    other_model_for,
)


def _codes(exc_info, field):
    return [detail.code for detail in exc_info.value.detail[field]]


def _publish(listing):
    listing.current_public_snapshot = make_snapshot(listing, approved_by=make_user())
    listing.save(update_fields=["current_public_snapshot"])
    return listing


def _minimal_payload(**overrides):
    payload = {
        "title_en": "Oceanis 46.1, one owner",
        "description_en": "Lovingly maintained, full service history.",
        "specifications": {"length_m": "14.6", "cabins": 3, "has_generator": True},
        "location_country": "it",
        "location_city": "Genoa",
        "price": "125000.00",
        "currency": "EUR",
        "media_ids": [str(uuid.uuid4())],
    }
    payload.update(overrides)
    return payload


@pytest.mark.django_db
def test_an_unknown_field_is_rejected_with_a_stable_code():
    listing = make_private_listing(owner=make_user())

    with pytest.raises(ValidationError) as exc_info:
        validate_revision_payload(
            {"sparkle_level": 11},
            listing=listing,
            origin=RevisionOrigin.OWNER,
            for_submission=False,
        )

    assert _codes(exc_info, "sparkle_level") == ["unknown_field"]


@pytest.mark.django_db
def test_taxonomy_fields_are_allowed_before_first_publication():
    listing = make_private_listing(owner=make_user())

    cleaned = validate_revision_payload(
        {"manufacture_year": 2019},
        listing=listing,
        origin=RevisionOrigin.OWNER,
        for_submission=False,
    )

    assert cleaned["manufacture_year"] == 2019


@pytest.mark.django_db
def test_taxonomy_fields_are_immutable_for_a_private_seller_after_publication():
    listing = _publish(make_private_listing(owner=make_user()))

    with pytest.raises(ValidationError) as exc_info:
        validate_revision_payload(
            {
                "brand_id": str(uuid.uuid4()),
                "model_id": str(uuid.uuid4()),
                "custom_model_name": "McKenzie",
                "manufacture_year": 2018,
            },
            listing=listing,
            origin=RevisionOrigin.OWNER,
            for_submission=False,
        )

    for field in ("brand_id", "model_id", "custom_model_name", "manufacture_year"):
        assert _codes(exc_info, field) == ["immutable_after_publication"]


@pytest.mark.django_db
def test_a_staff_correction_may_change_immutable_fields_after_publication():
    listing = _publish(make_private_listing(owner=make_user()))

    cleaned = validate_revision_payload(
        {"manufacture_year": 2018},
        listing=listing,
        origin=RevisionOrigin.STAFF_CORRECTION,
        for_submission=False,
    )

    assert cleaned["manufacture_year"] == 2018


@pytest.mark.django_db
def test_a_broker_may_change_taxonomy_after_publication():
    listing = _publish(make_broker_listing(broker=make_broker(), actor=make_user()))

    cleaned = validate_revision_payload(
        {"manufacture_year": 2018},
        listing=listing,
        origin=RevisionOrigin.OWNER,
        for_submission=False,
    )

    assert cleaned["manufacture_year"] == 2018


@pytest.mark.django_db
def test_a_private_seller_cannot_send_finance_fields():
    listing = make_private_listing(owner=make_user())

    with pytest.raises(ValidationError) as exc_info:
        validate_revision_payload(
            {"show_finance_estimate": True},
            listing=listing,
            origin=RevisionOrigin.OWNER,
            for_submission=False,
        )

    assert _codes(exc_info, "show_finance_estimate") == [
        "finance_not_allowed_for_private_seller"
    ]


@pytest.mark.django_db
def test_a_broker_may_send_finance_fields():
    listing = make_broker_listing(broker=make_broker(), actor=make_user())

    cleaned = validate_revision_payload(
        {
            "show_finance_estimate": True,
            "finance_rate_override_percent": "4.75",
            "finance_term_override_months": 60,
        },
        listing=listing,
        origin=RevisionOrigin.OWNER,
        for_submission=False,
    )

    assert cleaned["show_finance_estimate"] is True
    assert cleaned["finance_rate_override_percent"] == "4.7500"
    assert cleaned["finance_term_override_months"] == 60


@pytest.mark.django_db
def test_allowed_fields_drops_the_locked_names_for_a_published_private_listing():
    listing = _publish(make_private_listing(owner=make_user()))

    allowed = allowed_payload_fields(listing=listing, origin=RevisionOrigin.OWNER)

    assert "price" in allowed
    assert "brand_id" not in allowed
    assert "manufacture_year" not in allowed


@pytest.mark.django_db
def test_price_must_be_a_positive_decimal_string():
    listing = make_private_listing(owner=make_user())

    with pytest.raises(ValidationError) as exc_info:
        validate_revision_payload(
            {"price": "-1.00"}, listing=listing,
            origin=RevisionOrigin.OWNER, for_submission=False,
        )
    assert _codes(exc_info, "price") == ["invalid_price"]

    with pytest.raises(ValidationError) as exc_info:
        validate_revision_payload(
            {"price": 125000}, listing=listing,
            origin=RevisionOrigin.OWNER, for_submission=False,
        )
    assert _codes(exc_info, "price") == ["invalid_price"]


@pytest.mark.django_db
def test_price_is_normalized_to_two_decimals():
    listing = make_private_listing(owner=make_user())

    cleaned = validate_revision_payload(
        {"price": "125000"}, listing=listing,
        origin=RevisionOrigin.OWNER, for_submission=False,
    )

    assert cleaned["price"] == "125000.00"
    assert Decimal(cleaned["price"]) == Decimal("125000.00")


@pytest.mark.django_db
def test_an_unsupported_currency_is_rejected():
    listing = make_private_listing(owner=make_user())

    with pytest.raises(ValidationError) as exc_info:
        validate_revision_payload(
            {"currency": "USD"}, listing=listing,
            origin=RevisionOrigin.OWNER, for_submission=False,
        )

    assert _codes(exc_info, "currency") == ["unsupported_currency"]


@pytest.mark.django_db
def test_specifications_reject_nested_structures_and_bad_keys():
    listing = make_private_listing(owner=make_user())

    with pytest.raises(ValidationError) as exc_info:
        validate_revision_payload(
            {"specifications": {"engine": {"make": "Yanmar"}}}, listing=listing,
            origin=RevisionOrigin.OWNER, for_submission=False,
        )
    assert _codes(exc_info, "specifications") == ["invalid_specifications"]

    with pytest.raises(ValidationError) as exc_info:
        validate_revision_payload(
            {"specifications": {"Engine Make": "Yanmar"}}, listing=listing,
            origin=RevisionOrigin.OWNER, for_submission=False,
        )
    assert _codes(exc_info, "specifications") == ["invalid_specifications"]


@pytest.mark.django_db
def test_location_country_is_normalized_to_upper_case_and_validated():
    listing = make_private_listing(owner=make_user())

    cleaned = validate_revision_payload(
        {"location_country": "it"}, listing=listing,
        origin=RevisionOrigin.OWNER, for_submission=False,
    )
    assert cleaned["location_country"] == "IT"

    with pytest.raises(ValidationError) as exc_info:
        validate_revision_payload(
            {"location_country": "ITA"}, listing=listing,
            origin=RevisionOrigin.OWNER, for_submission=False,
        )
    assert _codes(exc_info, "location_country") == ["invalid_country"]


@pytest.mark.django_db
def test_custom_model_name_is_collapsed_and_punctuation_only_is_rejected():
    brand = make_brand()
    listing = make_private_listing(
        owner=make_user(),
        brand=brand,
        model=other_model_for(brand),
        custom_model_name="McKenzie",
    )

    cleaned = validate_revision_payload(
        {"custom_model_name": "  Mc   Kenzie  "}, listing=listing,
        origin=RevisionOrigin.OWNER, for_submission=False,
    )
    assert cleaned["custom_model_name"] == "Mc Kenzie"

    with pytest.raises(ValidationError) as exc_info:
        validate_revision_payload(
            {"custom_model_name": "---"}, listing=listing,
            origin=RevisionOrigin.OWNER, for_submission=False,
        )
    assert _codes(exc_info, "custom_model_name") == [
        "custom_model_name_punctuation_only"
    ]


@pytest.mark.django_db
def test_manufacture_year_bounds_are_enforced():
    listing = make_private_listing(owner=make_user())

    with pytest.raises(ValidationError) as exc_info:
        validate_revision_payload(
            {"manufacture_year": 1899}, listing=listing,
            origin=RevisionOrigin.OWNER, for_submission=False,
        )
    assert _codes(exc_info, "manufacture_year") == ["invalid_manufacture_year"]

    with pytest.raises(ValidationError) as exc_info:
        validate_revision_payload(
            {"manufacture_year": BoatListing.max_manufacture_year() + 1},
            listing=listing, origin=RevisionOrigin.OWNER, for_submission=False,
        )
    assert _codes(exc_info, "manufacture_year") == ["invalid_manufacture_year"]


@pytest.mark.django_db
def test_media_ids_must_be_unique_uuid_strings():
    listing = make_private_listing(owner=make_user())
    duplicate = str(uuid.uuid4())

    with pytest.raises(ValidationError) as exc_info:
        validate_revision_payload(
            {"media_ids": [duplicate, duplicate]}, listing=listing,
            origin=RevisionOrigin.OWNER, for_submission=False,
        )
    assert _codes(exc_info, "media_ids") == ["invalid_media_ids"]

    with pytest.raises(ValidationError) as exc_info:
        validate_revision_payload(
            {"media_ids": ["not-a-uuid"]}, listing=listing,
            origin=RevisionOrigin.OWNER, for_submission=False,
        )
    assert _codes(exc_info, "media_ids") == ["invalid_media_ids"]


@pytest.mark.django_db
def test_submission_requires_the_publishable_minimum():
    listing = make_private_listing(owner=make_user())

    with pytest.raises(ValidationError) as exc_info:
        validate_revision_payload(
            {"title_en": "Only a title"}, listing=listing,
            origin=RevisionOrigin.OWNER, for_submission=True,
        )

    for field in (
        "description_en", "location_country", "location_city", "price", "media_ids",
    ):
        assert _codes(exc_info, field) == ["required_for_submission"]


@pytest.mark.django_db
def test_a_complete_payload_passes_submission_validation():
    listing = make_private_listing(owner=make_user())

    cleaned = validate_revision_payload(
        _minimal_payload(), listing=listing,
        origin=RevisionOrigin.OWNER, for_submission=True,
    )

    assert cleaned["title_en"] == "Oceanis 46.1, one owner"
    assert cleaned["location_country"] == "IT"
    assert SPECIFICATIONS_SCHEMA_VERSION == 1
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd backend
uv run pytest listings/tests/test_payloads.py -v
```

Expected: collection `ERROR` — `ModuleNotFoundError: No module named 'listings.payloads'`.

- [ ] **Step 3: Implement the payload schema**

`backend/listings/payloads.py`:

```python
"""Explicit schema for ListingRevision.payload (spec §11.4, §20.2, §20.3, §25.1).

Spec §11.4: "Only fields explicitly allowed by role are accepted in `payload`;
unknown fields return validation errors. For a private seller after first
publication, `brand_id`, `model_id`, `custom_model_name` and `manufacture_year`
are rejected with `immutable_after_publication`."
"""

import re
import uuid
from decimal import Decimal, InvalidOperation

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ErrorDetail, ValidationError

from accounts.enums import SellerType
from taxonomy.services import normalize_custom_model_name

from .enums import RevisionOrigin
from .models import (
    CUSTOM_MODEL_NAME_MAX_LENGTH,
    CUSTOM_MODEL_NAME_MIN_LENGTH,
    MIN_MANUFACTURE_YEAR,
    SUPPORTED_CURRENCIES,
    BoatListing,
)

SPECIFICATIONS_SCHEMA_VERSION = 1

MAX_TITLE_LENGTH = 200
MAX_DESCRIPTION_LENGTH = 20_000
MAX_SPECIFICATION_KEYS = 50
MAX_SPECIFICATION_STRING_LENGTH = 500
MAX_LOCATION_LENGTH = 120
MAX_MEDIA_IDS = 21  # 20 images + 1 video, the largest allowance in spec §24.1
SPECIFICATION_KEY_RE = re.compile(r"^[a-z][a-z0-9_]{0,49}$")
COUNTRY_RE = re.compile(r"^[A-Z]{2}$")

TITLE_FIELDS = ("title_en", "title_it", "title_es")
DESCRIPTION_FIELDS = ("description_en", "description_it", "description_es")
CONTENT_FIELDS = frozenset(
    TITLE_FIELDS
    + DESCRIPTION_FIELDS
    + (
        "specifications",
        "location_country",
        "location_region",
        "location_city",
        "price",
        "currency",
        "media_ids",
    )
)
TAXONOMY_FIELDS = frozenset(
    {"brand_id", "model_id", "custom_model_name", "manufacture_year"}
)
BROKER_FINANCE_FIELDS = frozenset(
    {
        "show_finance_estimate",
        "finance_down_payment_override_percent",
        "finance_rate_override_percent",
        "finance_term_override_months",
    }
)
# The names spec §25.1 reports to the frontend as `immutable_fields`.
IMMUTABLE_FIELD_NAMES = ("brand", "model", "custom_model_name", "manufacture_year")
REQUIRED_FOR_SUBMISSION = (
    "title_en",
    "description_en",
    "location_country",
    "location_city",
    "price",
    "media_ids",
)


def _error(message, code):
    return [ErrorDetail(message, code=code)]


def is_locked_for_owner(listing: BoatListing) -> bool:
    """Spec §1/§11.4: individual immutable fields lock after first publication
    approval. The trigger is "has ever been published", so an expired or
    suspended listing stays locked."""
    return (
        listing.seller_type == SellerType.PRIVATE
        and listing.current_public_snapshot_id is not None
    )


def allowed_payload_fields(*, listing: BoatListing, origin: str) -> frozenset[str]:
    allowed = set(CONTENT_FIELDS)
    if listing.seller_type == SellerType.BROKER:
        allowed |= BROKER_FINANCE_FIELDS
    if origin == RevisionOrigin.STAFF_CORRECTION or not is_locked_for_owner(listing):
        allowed |= TAXONOMY_FIELDS
    return frozenset(allowed)


def _clean_text(errors, payload, field, max_length):
    value = payload[field]
    if not isinstance(value, str) or len(value) > max_length:
        errors[field] = _error(
            f"Provide text of at most {max_length} characters.", "invalid_text"
        )
        return None
    return value.strip()


def _clean_specifications(errors, value):
    if not isinstance(value, dict) or len(value) > MAX_SPECIFICATION_KEYS:
        errors["specifications"] = _error(
            "Provide a flat object of at most "
            f"{MAX_SPECIFICATION_KEYS} specification entries.",
            "invalid_specifications",
        )
        return None
    for key, item in value.items():
        bad_key = not isinstance(key, str) or not SPECIFICATION_KEY_RE.match(key)
        bad_value = not isinstance(item, (str, int, bool, type(None))) or (
            isinstance(item, str) and len(item) > MAX_SPECIFICATION_STRING_LENGTH
        )
        if bad_key or bad_value:
            errors["specifications"] = _error(
                "Specification keys must be lowercase identifiers and values must be "
                "text, whole numbers, booleans or null.",
                "invalid_specifications",
            )
            return None
    return dict(value)


def _clean_price(errors, value):
    if not isinstance(value, str):
        errors["price"] = _error(
            'Send the price as a decimal string, e.g. "125000.00".', "invalid_price"
        )
        return None
    try:
        amount = Decimal(value)
    except InvalidOperation:
        errors["price"] = _error("Enter a valid price.", "invalid_price")
        return None
    if amount <= 0 or amount.as_tuple().exponent < -2 or amount >= Decimal(10) ** 12:
        errors["price"] = _error(
            "Enter a positive price with at most two decimal places.", "invalid_price"
        )
        return None
    return f"{amount.quantize(Decimal('0.01')):f}"


def _clean_percent(errors, field, value):
    if not isinstance(value, str):
        errors[field] = _error(
            'Send the percentage as a decimal string, e.g. "4.7500".', "invalid_percent"
        )
        return None
    try:
        amount = Decimal(value)
    except InvalidOperation:
        errors[field] = _error("Enter a valid percentage.", "invalid_percent")
        return None
    if not (Decimal(0) <= amount <= Decimal(100)) or amount.as_tuple().exponent < -4:
        errors[field] = _error(
            "Enter a percentage between 0 and 100 with at most four decimal places.",
            "invalid_percent",
        )
        return None
    return f"{amount.quantize(Decimal('0.0001')):f}"


def _clean_media_ids(errors, value):
    if not isinstance(value, list) or len(value) > MAX_MEDIA_IDS:
        errors["media_ids"] = _error(
            f"Send at most {MAX_MEDIA_IDS} media identifiers.", "invalid_media_ids"
        )
        return None
    cleaned = []
    for item in value:
        try:
            cleaned.append(str(uuid.UUID(str(item))))
        except (ValueError, AttributeError, TypeError):
            errors["media_ids"] = _error(
                "Every media identifier must be a UUID.", "invalid_media_ids"
            )
            return None
    if len(set(cleaned)) != len(cleaned):
        errors["media_ids"] = _error(
            "Media identifiers must not repeat.", "invalid_media_ids"
        )
        return None
    return cleaned


def _reject_disallowed_fields(errors, payload, *, listing, allowed):
    for field in payload:
        if field in allowed:
            continue
        if field in TAXONOMY_FIELDS and is_locked_for_owner(listing):
            errors[field] = _error(
                "This field cannot be changed after the listing was first published.",
                "immutable_after_publication",
            )
        elif field in BROKER_FINANCE_FIELDS:
            errors[field] = _error(
                "Finance options are available to broker listings only.",
                "finance_not_allowed_for_private_seller",
            )
        else:
            errors[field] = _error("Unknown field.", "unknown_field")


def validate_revision_payload(
    payload: dict, *, listing: BoatListing, origin: str, for_submission: bool
) -> dict:
    if not isinstance(payload, dict):
        raise ValidationError(
            {"payload": _error("Send a JSON object.", "invalid_payload")}
        )

    allowed = allowed_payload_fields(listing=listing, origin=origin)
    errors: dict[str, list[ErrorDetail]] = {}
    cleaned: dict = {}

    _reject_disallowed_fields(errors, payload, listing=listing, allowed=allowed)

    def present(field):
        return field in payload and field in allowed

    for field in TITLE_FIELDS:
        if present(field):
            value = _clean_text(errors, payload, field, MAX_TITLE_LENGTH)
            if value is not None:
                cleaned[field] = value
    for field in DESCRIPTION_FIELDS:
        if present(field):
            value = _clean_text(errors, payload, field, MAX_DESCRIPTION_LENGTH)
            if value is not None:
                cleaned[field] = value
    for field in ("location_region", "location_city"):
        if present(field):
            value = _clean_text(errors, payload, field, MAX_LOCATION_LENGTH)
            if value is not None:
                cleaned[field] = value

    if present("location_country"):
        raw = payload["location_country"]
        candidate = raw.strip().upper() if isinstance(raw, str) else ""
        if COUNTRY_RE.match(candidate):
            cleaned["location_country"] = candidate
        else:
            errors["location_country"] = _error(
                "Enter a two-letter ISO-3166-1 country code.", "invalid_country"
            )

    if present("specifications"):
        value = _clean_specifications(errors, payload["specifications"])
        if value is not None:
            cleaned["specifications"] = value

    if present("price"):
        value = _clean_price(errors, payload["price"])
        if value is not None:
            cleaned["price"] = value

    if present("currency"):
        raw = payload["currency"]
        candidate = raw.strip().upper() if isinstance(raw, str) else ""
        if candidate in SUPPORTED_CURRENCIES:
            cleaned["currency"] = candidate
        else:
            errors["currency"] = _error(
                "This currency is not supported.", "unsupported_currency"
            )

    if present("media_ids"):
        value = _clean_media_ids(errors, payload["media_ids"])
        if value is not None:
            cleaned["media_ids"] = value

    for field in ("brand_id", "model_id"):
        if present(field):
            try:
                cleaned[field] = str(uuid.UUID(str(payload[field])))
            except (ValueError, AttributeError, TypeError):
                errors[field] = _error("Enter a valid identifier.", "invalid_identifier")

    if present("custom_model_name"):
        raw = payload["custom_model_name"]
        if not isinstance(raw, str):
            errors["custom_model_name"] = _error("Enter the model name.", "invalid_text")
        elif raw.strip() == "":
            cleaned["custom_model_name"] = ""
        else:
            try:
                normalized = normalize_custom_model_name(raw)
            except DjangoValidationError as exc:
                errors["custom_model_name"] = _error(
                    "Enter the model name.",
                    getattr(exc, "code", None) or "invalid_text",
                )
            else:
                if (
                    CUSTOM_MODEL_NAME_MIN_LENGTH
                    <= len(normalized)
                    <= CUSTOM_MODEL_NAME_MAX_LENGTH
                ):
                    cleaned["custom_model_name"] = normalized
                else:
                    errors["custom_model_name"] = _error(
                        f"Enter between {CUSTOM_MODEL_NAME_MIN_LENGTH} and "
                        f"{CUSTOM_MODEL_NAME_MAX_LENGTH} characters.",
                        "invalid_text",
                    )

    if present("manufacture_year"):
        raw = payload["manufacture_year"]
        if (
            isinstance(raw, bool)
            or not isinstance(raw, int)
            or not (MIN_MANUFACTURE_YEAR <= raw <= BoatListing.max_manufacture_year())
        ):
            errors["manufacture_year"] = _error(
                f"Enter a year between {MIN_MANUFACTURE_YEAR} and "
                f"{BoatListing.max_manufacture_year()}.",
                "invalid_manufacture_year",
            )
        else:
            cleaned["manufacture_year"] = raw

    if present("show_finance_estimate"):
        raw = payload["show_finance_estimate"]
        if isinstance(raw, bool):
            cleaned["show_finance_estimate"] = raw
        else:
            errors["show_finance_estimate"] = _error(
                "Send true or false.", "invalid_boolean"
            )

    for field in (
        "finance_down_payment_override_percent",
        "finance_rate_override_percent",
    ):
        if present(field):
            value = _clean_percent(errors, field, payload[field])
            if value is not None:
                cleaned[field] = value

    if present("finance_term_override_months"):
        raw = payload["finance_term_override_months"]
        if isinstance(raw, bool) or not isinstance(raw, int) or not (1 <= raw <= 360):
            errors["finance_term_override_months"] = _error(
                "Enter a term between 1 and 360 months.", "invalid_term"
            )
        else:
            cleaned["finance_term_override_months"] = raw

    if for_submission:
        for field in REQUIRED_FOR_SUBMISSION:
            if field in errors:
                continue
            if cleaned.get(field) in (None, "", []):
                errors[field] = _error(
                    "This field is required before the listing can be submitted.",
                    "required_for_submission",
                )

    if errors:
        raise ValidationError(errors)
    return cleaned
```

**Note (why `for_submission` validates `cleaned`, not `payload`):** at submit time the caller passes the *accumulated* payload stored on the revision (Task 10), not a single PATCH body, so `cleaned` already holds everything the seller has entered across every draft save. Validating the merged document is what makes "price must be positive **when publication is submitted**" (spec §11.4) enforceable without also rejecting an incomplete draft save (spec §25.2: "Draft saves return field-level validation but may allow incomplete content. Final submit applies complete validation.").

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd backend
uv run pytest listings/tests/test_payloads.py -v
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/listings
git commit -m "feat(listings): add explicit revision payload schema enforcing immutable_after_publication"
```

---

### Task 6: Optimistic locking — `version` compare-and-swap, `409 stale_version` and `meta` in the error envelope

**Files:**
- Create: `backend/listings/locking.py`
- Modify: `backend/common/exceptions.py`
- Test: `backend/listings/tests/test_locking.py`

**Interfaces:**
- Consumes: `listings.models.{BoatListing, ListingRevision}` (Tasks 2, 4).
- Produces: `listings.locking.StaleVersionConflict(APIException)` with `status_code = 409`, `default_code = "stale_version"` and an instance attribute `meta = {"resource": str, "current_version": int | None}`.
- Produces: `listings.locking.bump_version(instance, *, expected_version: int, resource: str, **updates) -> None` — a conditional `UPDATE … WHERE pk = … AND version = expected_version` that raises `StaleVersionConflict` when it matches zero rows and refreshes the in-memory instance when it succeeds.
- Produces: `common.exceptions.nauta_exception_handler` now copies an exception's `meta` dict into `response.data["error"]["meta"]` when one is present.

**Note (ruling — the exact optimistic-locking mechanism, spec §20.5):** spec §20.5 says only "All edit submissions include listing/revision version. Stale updates return `409 conflict` with current version metadata." This plan fixes every remaining degree of freedom:

1. **Where the version lives:** an integer column `version`, default `1`, on both `BoatListing` and `ListingRevision` (declared in Tasks 2 and 4).
2. **How it is transmitted:** as a required integer field named `version` in the JSON request body of every state-changing endpoint (`PATCH /api/v1/listings/<id>/draft/`, `POST /api/v1/listings/<id>/submit/`, `POST /api/v1/listings/<id>/withdraw/`, `POST /api/v1/staff/revisions/<id>/decision/`). **Not** an `If-Match`/ETag header: spec §30.3 offers "resource version/ETag **or explicit `version`** for edits", a body field is the simpler of the two to test end to end, and supporting both would create two sources of truth.
3. **Which object's version:** always the **revision's**. Every edit in this phase flows through the listing's single open `ListingRevision`, and the staff decision endpoint addresses a revision directly. `BoatListing.version` exists and is bumped whenever the listing's own status/publication columns change, so later phases can expose a listing-level ETag, but no request in this phase is validated against it.
4. **How the check is performed:** one conditional `UPDATE` (`QuerySet.filter(pk=…, version=expected).update(version=F("version") + 1, **updates)`). A single statement is atomic on its own, so it is safe even without a prior read; where a service must also read related rows before deciding (approval), it additionally takes `select_for_update()` on the revision, so a concurrent moderator blocks until the first transaction commits and then loses the compare-and-swap.
5. **What the client gets back:** HTTP `409` with the standard envelope plus a `meta` object — `{"error": {"code": "stale_version", "message": …, "fields": {}, "request_id": …, "meta": {"resource": "revision", "current_version": 4}}}`. Spec §30.2's envelope has no slot for "current version metadata", so this task adds the general-purpose `meta` passthrough, exactly as Phase 3's own note anticipated ("Phase 13/14 … will extend this handler to copy an `action` attribute off exceptions that define one").
6. **What a successful mutation returns:** the updated resource **including its new `version`**, per spec §30.2 ("Mutations return updated resource/version"), so a client can chain edits without an extra GET.

**Note (ruling — idempotency of staff decisions without an `Idempotency-Key` store):** spec §30.3 asks for an `Idempotency-Key` header on Checkout creation, listing submit and staff decision requests, with a stored outcome for replay. This phase satisfies spec §26.2's actual requirement ("Decisions are atomic and idempotent; repeated click cannot create multiple snapshots") through state + version: a repeated click carries a now-stale `version` and receives `409 stale_version` instead of creating a second snapshot, and the one-open-revision constraint makes a duplicate impossible even under a race. The *replayable* store §30.3 describes is a cross-cutting mechanism whose first real consumer is Stripe Checkout creation (§23.2), so it is built in Phase 14 and retrofitted onto these endpoints there. Recorded in Known Limitations.

- [ ] **Step 1: Write the failing tests**

`backend/listings/tests/test_locking.py`:

```python
import pytest
from rest_framework.exceptions import APIException

from accounts.tests.factories import make_user
from listings.enums import ListingStatus
from listings.locking import StaleVersionConflict, bump_version
from listings.models import BoatListing
from listings.tests.factories import make_private_listing, make_revision


@pytest.mark.django_db
def test_bump_version_increments_and_applies_updates():
    listing = make_private_listing(owner=make_user())

    bump_version(
        listing,
        expected_version=1,
        resource="listing",
        status=ListingStatus.PENDING_APPROVAL,
    )

    listing.refresh_from_db()
    assert listing.version == 2
    assert listing.status == ListingStatus.PENDING_APPROVAL


@pytest.mark.django_db
def test_bump_version_refreshes_the_in_memory_instance():
    listing = make_private_listing(owner=make_user())

    bump_version(listing, expected_version=1, resource="listing",
                 status=ListingStatus.PENDING_APPROVAL)

    # No explicit refresh_from_db() by the caller.
    assert listing.version == 2
    assert listing.status == ListingStatus.PENDING_APPROVAL


@pytest.mark.django_db
def test_a_stale_version_raises_a_409_conflict_carrying_the_current_version():
    listing = make_private_listing(owner=make_user())
    bump_version(listing, expected_version=1, resource="listing",
                 status=ListingStatus.PENDING_APPROVAL)

    with pytest.raises(StaleVersionConflict) as exc_info:
        bump_version(listing, expected_version=1, resource="listing",
                     status=ListingStatus.DRAFT)

    conflict = exc_info.value
    assert isinstance(conflict, APIException)
    assert conflict.status_code == 409
    assert conflict.get_codes() == "stale_version"
    assert conflict.meta == {"resource": "listing", "current_version": 2}


@pytest.mark.django_db
def test_a_stale_version_does_not_apply_the_update():
    listing = make_private_listing(owner=make_user())
    bump_version(listing, expected_version=1, resource="listing",
                 status=ListingStatus.PENDING_APPROVAL)

    with pytest.raises(StaleVersionConflict):
        bump_version(listing, expected_version=1, resource="listing",
                     status=ListingStatus.REJECTED)

    assert BoatListing.objects.get(pk=listing.pk).status == ListingStatus.PENDING_APPROVAL


@pytest.mark.django_db
def test_a_missing_row_reports_a_null_current_version():
    listing = make_private_listing(owner=make_user())
    revision = make_revision(listing)
    revision_id, expected = revision.pk, revision.version
    revision.delete()
    revision.pk = revision_id

    with pytest.raises(StaleVersionConflict) as exc_info:
        bump_version(revision, expected_version=expected, resource="revision")

    assert exc_info.value.meta == {"resource": "revision", "current_version": None}


def test_the_error_envelope_carries_meta():
    """The handler passthrough itself — exercised over HTTP in Task 12."""
    from common.exceptions import nauta_exception_handler

    class _Request:
        request_id = "req-123"

    conflict = StaleVersionConflict(resource="revision", current_version=7)
    response = nauta_exception_handler(conflict, {"request": _Request()})

    assert response.status_code == 409
    assert response.data["error"]["code"] == "stale_version"
    assert response.data["error"]["meta"] == {
        "resource": "revision",
        "current_version": 7,
    }
    assert response.data["error"]["request_id"] == "req-123"
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd backend
uv run pytest listings/tests/test_locking.py -v
```

Expected: collection `ERROR` — `ModuleNotFoundError: No module named 'listings.locking'`.

- [ ] **Step 3: Implement the locking helper**

`backend/listings/locking.py`:

```python
"""Optimistic locking for listing edits (spec §20.5).

"All edit submissions include listing/revision version. Stale updates return
409 conflict with current version metadata. Do not silently overwrite another
browser/session edit."
"""

from django.db.models import F
from rest_framework import status
from rest_framework.exceptions import APIException


class StaleVersionConflict(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "This listing was changed somewhere else. Reload it and try again."
    default_code = "stale_version"

    def __init__(self, *, resource: str, current_version: int | None):
        super().__init__()
        # Copied into the error envelope by common.exceptions.nauta_exception_handler.
        self.meta = {"resource": resource, "current_version": current_version}


def bump_version(instance, *, expected_version: int, resource: str, **updates) -> None:
    """Apply `updates` to `instance` only if its stored version still matches.

    One atomic `UPDATE … WHERE pk = … AND version = …` statement, so two
    concurrent writers can never both succeed. Callers that must *read* related
    rows before deciding should additionally hold `select_for_update()` on this
    row, so the loser blocks rather than races.
    """
    model = type(instance)
    changed = model.objects.filter(pk=instance.pk, version=expected_version).update(
        version=F("version") + 1, **updates
    )
    if changed == 0:
        current = (
            model.objects.filter(pk=instance.pk)
            .values_list("version", flat=True)
            .first()
        )
        raise StaleVersionConflict(resource=resource, current_version=current)
    instance.refresh_from_db()
```

- [ ] **Step 4: Add the `meta` passthrough to the shared error envelope**

`backend/common/exceptions.py` (created by Phase 3's Task 2) currently ends `nauta_exception_handler` with:

```python
    response.data = {
        "error": {
            "code": code,
            "message": message,
            "fields": fields,
            "request_id": request_id,
        }
    }
    response["X-Request-ID"] = request_id
    return response
```

Change it to (six added lines plus a comment, nothing else touched):

```python
    response.data = {
        "error": {
            "code": code,
            "message": message,
            "fields": fields,
            "request_id": request_id,
        }
    }
    # Optional, exception-supplied extra context. Spec §20.5 requires a stale
    # edit to return "current version metadata", for which §30.2's envelope has
    # no other slot. Only exceptions that explicitly define a non-empty dict
    # `meta` contribute one, so the key is absent otherwise and no client is
    # tempted to branch on a permanently-null field.
    meta = getattr(exc, "meta", None)
    if isinstance(meta, dict) and meta:
        response.data["error"]["meta"] = meta
    response["X-Request-ID"] = request_id
    return response
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd backend
uv run pytest listings/tests/test_locking.py common/tests -v
```

Expected: every `test_locking.py` test PASSes and the existing `common` tests still pass (the envelope change is additive).

- [ ] **Step 6: Commit**

```bash
git add backend/listings backend/common/exceptions.py
git commit -m "feat(listings): add version compare-and-swap locking with 409 stale_version and envelope meta"
```

---

### Task 7: Policy seams — entitlement gate stub, approval requirement and media allowance

**Files:**
- Create: `backend/listings/policies.py`
- Test: `backend/listings/tests/test_policies.py`

**Interfaces:**
- Consumes: `listings.models.{BoatListing, ListingMedia}` (Tasks 2, 3); `listings.enums.{MediaType, PublicationSource}` (Task 1); `accounts.enums.SellerType`; `platform_settings.services.get_setting_value`.
- Produces:

  ```python
  @dataclass(frozen=True)
  class MediaAllowance:
      images: int
      videos: int

  class ListingEntitlementGate:
      @staticmethod
      def can_submit(*, user, broker=None) -> bool: ...
      @staticmethod
      def consume(*, listing: BoatListing, user) -> str: ...   # a PublicationSource value
      @staticmethod
      def publication_days(*, listing: BoatListing) -> int | None: ...

  def requires_staff_approval(listing: BoatListing) -> bool: ...
  def effective_media_allowance(listing: BoatListing) -> MediaAllowance: ...
  def media_counts(listing: BoatListing) -> tuple[int, int]: ...
  ```

**Note (ruling — the entitlement gate is a documented stub that always allows, by controller decision):** spec §20.1 steps 2 and 4 require submission to "validate eligibility and reserve/choose entitlement" and to "atomically consume entitlement". The entitlement ledger (`UserEntitlement`, §11.9), the rolling free-quota window and `ListingEligibilityService` (§22.2) are **spec Phase 13**, which depends on this phase rather than the reverse. Building even a partial quota here would mean inventing a ledger Phase 13 would then have to unpick. `ListingEntitlementGate` is therefore the named seam: `can_submit()` returns `True` for everyone, `consume()` records a `publication_source` and touches no ledger (leaving `BoatListing.consumed_entitlement_id` `NULL`), and `publication_days()` **is** real — it reads `individual.free_publish_days` from `platform_settings`, so the 30-day publication window in §1/§22.1 is honoured from day one and stays staff-configurable without a deploy. Phase 13 replaces the class body with calls into `ListingEligibilityService`; the call sites in `listings.submissions` and `listings.decisions` do not change. Recorded in Known Limitations.

**Note (ruling — broker listings get no expiry in this phase):** `publication_days()` returns `None` for a broker listing, so `expires_at` stays `NULL`. Spec §21 gives broker organizations "no numeric listing quota in this release" and §22.5's expiry task is defined entirely in terms of the individual entitlement's publication window; no spec section gives a broker listing a publication duration. A `NULL` `expires_at` is therefore the accurate representation of "no configured expiry", not a placeholder.

**Note (ruling — `requires_staff_approval()` always returns `True`, by controller decision):** spec §6.1 says "A broker initial publication enters `PUBLISHED` only if its broker has `auto_approve_listings=true`", and Phase 3's `brokers.models.BrokerOrganization.auto_approve_listings` is a real `BooleanField(default=False)`. This phase nevertheless does **not** read it. Auto-approval is spec Phase 12 (§21), which owns rules this phase cannot satisfy — the toggle is staff-admin-only and requires a reason, enabling it "affects future submissions, not currently pending submissions automatically", disabling it leaves published listings live, and staff must be able to bulk-approve the pending backlog as a separate audited action. Reading the flag here would produce auto-approval behaviour without any of those guarantees. Phase 12's change is a one-line body swap in this function plus its own tests; every caller already routes through it.

**Note (ruling — this phase applies base media allowances only):** `effective_media_allowance()` reads `media.private_base_image_limit` (**1**) / `media.private_base_video_limit` (**0**) for a private seller and `media.broker_image_limit` (**20**) / `media.broker_video_limit` (**1**) for a broker, all from `platform_settings`. The private *upgrade* tier (20 images / 1 video, §24.1 row 2) is unreachable here because it is granted by a `MEDIA_UPGRADE` entitlement bound to a listing — Phase 13/14/15 territory. Phase 15 replaces this function's body with the effective-allowance service; the call site in `listings.submissions` does not change. Per §11.5, `media_counts()` counts **all non-rejected** rows, not just `READY` ones.

- [ ] **Step 1: Write the failing tests**

`backend/listings/tests/test_policies.py`:

```python
import pytest

from accounts.tests.factories import make_user
from brokers.tests.factories import make_broker
from listings.enums import MediaStatus, MediaType, PublicationSource
from listings.policies import (
    ListingEntitlementGate,
    MediaAllowance,
    effective_media_allowance,
    media_counts,
    requires_staff_approval,
)
from listings.tests.factories import (
    make_broker_listing,
    make_media,
    make_private_listing,
)
from platform_settings.models import PlatformSetting


@pytest.mark.django_db
def test_the_entitlement_gate_currently_allows_every_submission():
    user = make_user()

    assert ListingEntitlementGate.can_submit(user=user) is True
    assert ListingEntitlementGate.can_submit(user=user, broker=make_broker()) is True


@pytest.mark.django_db
def test_consuming_records_a_publication_source_without_touching_a_ledger():
    listing = make_private_listing(owner=make_user())

    source = ListingEntitlementGate.consume(listing=listing, user=listing.owner_user)

    assert source == PublicationSource.FREE_ENTITLEMENT
    assert listing.consumed_entitlement_id is None


@pytest.mark.django_db
def test_a_broker_submission_records_the_broker_policy_source():
    listing = make_broker_listing(broker=make_broker(), actor=make_user())

    source = ListingEntitlementGate.consume(listing=listing, user=make_user())

    assert source == PublicationSource.BROKER_POLICY


@pytest.mark.django_db
def test_publication_days_reads_the_staff_configurable_setting():
    listing = make_private_listing(owner=make_user())

    assert ListingEntitlementGate.publication_days(listing=listing) == 30

    setting = PlatformSetting.objects.get(key="individual.free_publish_days")
    setting.value = 45
    setting.save()

    assert ListingEntitlementGate.publication_days(listing=listing) == 45


@pytest.mark.django_db
def test_a_broker_listing_has_no_configured_publication_window():
    listing = make_broker_listing(broker=make_broker(), actor=make_user())

    assert ListingEntitlementGate.publication_days(listing=listing) is None


@pytest.mark.django_db
def test_every_submission_requires_staff_approval_in_this_phase():
    private_listing = make_private_listing(owner=make_user())
    broker = make_broker()
    broker.auto_approve_listings = True
    broker.auto_approve_changed_at = None
    broker.save(update_fields=["auto_approve_listings"])
    broker_listing = make_broker_listing(broker=broker, actor=make_user())

    assert requires_staff_approval(private_listing) is True
    # Deliberate: Phase 12 owns the auto-approval policy (see the ruling above).
    assert requires_staff_approval(broker_listing) is True


@pytest.mark.django_db
def test_private_base_allowance_is_one_image_and_no_video():
    listing = make_private_listing(owner=make_user())

    assert effective_media_allowance(listing) == MediaAllowance(images=1, videos=0)


@pytest.mark.django_db
def test_broker_allowance_is_twenty_images_and_one_video():
    listing = make_broker_listing(broker=make_broker(), actor=make_user())

    assert effective_media_allowance(listing) == MediaAllowance(images=20, videos=1)


@pytest.mark.django_db
def test_media_counts_include_every_non_rejected_row():
    listing = make_broker_listing(broker=make_broker(), actor=make_user())
    make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.UPLOADING, sort_order=0)
    make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY, sort_order=1)
    make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.REJECTED, sort_order=2)
    make_media(listing, media_type=MediaType.VIDEO, status=MediaStatus.PROCESSING, sort_order=0)

    assert media_counts(listing) == (2, 1)
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd backend
uv run pytest listings/tests/test_policies.py -v
```

Expected: collection `ERROR` — `ModuleNotFoundError: No module named 'listings.policies'`.

- [ ] **Step 3: Implement the policy seams**

`backend/listings/policies.py`:

```python
"""Policy seams this phase deliberately stubs, with their owners named.

Each callable below is the single call site a later phase replaces:
  * ListingEntitlementGate    -> spec Phase 13 (§22, ListingEligibilityService)
  * requires_staff_approval   -> spec Phase 12 (§21, broker auto-approval)
  * effective_media_allowance -> spec Phase 15 (§24, media upgrade tier)
"""

from dataclasses import dataclass

from accounts.enums import SellerType
from platform_settings.services import get_setting_value

from .enums import MediaType, PublicationSource
from .models import BoatListing, ListingMedia


@dataclass(frozen=True)
class MediaAllowance:
    images: int
    videos: int


class ListingEntitlementGate:
    """Phase 11 stub for spec §22.2's ListingEligibilityService.

    KNOWN LIMITATION: `can_submit` always returns True and `consume` never
    touches an entitlement ledger, because `UserEntitlement` (spec §11.9) is
    built in spec Phase 13. Phase 13 replaces these method bodies; the call
    sites in listings.submissions and listings.decisions do not change.
    """

    @staticmethod
    def can_submit(*, user, broker=None) -> bool:
        return True

    @staticmethod
    def consume(*, listing: BoatListing, user) -> str:
        """Return the PublicationSource to record on the listing.

        No ledger row is reserved or consumed in this phase, so
        BoatListing.consumed_entitlement_id stays NULL.
        """
        if listing.seller_type == SellerType.BROKER:
            return PublicationSource.BROKER_POLICY
        return PublicationSource.FREE_ENTITLEMENT

    @staticmethod
    def publication_days(*, listing: BoatListing) -> int | None:
        """How long an approved publication stays live.

        Real behaviour, not a stub: spec §1/§22.1 fix the individual free
        publication at 30 days and require it to be staff-configurable, which
        `individual.free_publish_days` already is. A broker listing has no
        configured window in this release (spec §21), so this returns None and
        `expires_at` stays NULL.
        """
        if listing.seller_type == SellerType.BROKER:
            return None
        return int(get_setting_value("individual.free_publish_days"))


def requires_staff_approval(listing: BoatListing) -> bool:
    """Whether a submission must wait for a moderator.

    Always True in Phase 11. Spec §6.1 allows a broker initial publication to go
    straight to PUBLISHED when `BrokerOrganization.auto_approve_listings` is
    true, but the surrounding policy (staff-admin-only toggle with a mandatory
    reason, future-only effect, bulk approval of the pending backlog) is spec
    Phase 12 (§21). Phase 12 swaps this body for the real check.
    """
    return True


def effective_media_allowance(listing: BoatListing) -> MediaAllowance:
    """Total images/videos permitted on this listing (spec §24.1 — totals, not
    increments).

    KNOWN LIMITATION: the private-seller *upgrade* tier (20 images / 1 video) is
    granted by a MEDIA_UPGRADE entitlement bound to the listing, which is spec
    Phase 13/14/15. Until then a private seller gets the base tier only.
    """
    if listing.seller_type == SellerType.BROKER:
        return MediaAllowance(
            images=int(get_setting_value("media.broker_image_limit")),
            videos=int(get_setting_value("media.broker_video_limit")),
        )
    return MediaAllowance(
        images=int(get_setting_value("media.private_base_image_limit")),
        videos=int(get_setting_value("media.private_base_video_limit")),
    )


def media_counts(listing: BoatListing) -> tuple[int, int]:
    """(images, videos) among all NON-REJECTED media rows.

    Spec §11.5: "Media count limits include all non-rejected items to prevent
    concurrent upload bypasses."
    """
    rows = ListingMedia.objects.non_rejected().filter(listing=listing)
    images = rows.filter(media_type=MediaType.IMAGE).count()
    videos = rows.filter(media_type=MediaType.VIDEO).count()
    return images, videos
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd backend
uv run pytest listings/tests/test_policies.py -v
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/listings
git commit -m "feat(listings): add entitlement, approval and media-allowance policy seams for Phases 12/13/15"
```

---

### Task 8: Draft creation service, `POST /api/v1/listings/drafts/` and the `listing_revisions` feature gate

**Files:**
- Create: `backend/listings/drafts.py`, `backend/listings/permissions.py`, `backend/listings/serializers.py`, `backend/listings/views.py`, `backend/listings/urls.py`, `backend/listings/migrations/0004_seed_listing_revisions_flag.py`
- Modify: `backend/config/urls.py`, `backend/listings/tests/conftest.py`
- Test: `backend/listings/tests/test_draft_create.py`

**Interfaces:**
- Consumes: `listings.models.{BoatListing, ListingRevision}`; `listings.payloads.validate_revision_payload`; `listings.enums.{ListingStatus, RevisionOrigin, RevisionStatus}`; `accounts.services.resolve_seller_context`; `accounts.permissions.{IsActiveUser, IsEmailVerified}`; `platform_settings.services.is_feature_enabled`; `taxonomy.models.{BoatBrand, BoatModel}`.
- Produces: `listings.drafts.create_listing_draft(*, actor, broker_id=None, payload: dict) -> BoatListing` (the created listing, with `listing.open_revision` set on the returned instance for convenience).
- Produces: `listings.drafts.open_revision_for(listing: BoatListing) -> ListingRevision | None` — the single `DRAFT`-or-`SUBMITTED` revision, or `None`.
- Produces: `listings.permissions.ListingWorkflowEnabled` (DRF permission returning `is_feature_enabled("listing_revisions", default=False)`, `code = "feature_disabled"`).
- Produces: `listings.serializers.{ListingDraftCreateSerializer, ListingWorkflowSerializer}` — the latter is the shared owner-facing representation `{"id", "status", "seller_type", "version", "revision": {"id", "revision_number", "state", "version", "payload", "decision_note"}, "policy": {"requires_approval", "immutable_fields", "image_limit", "video_limit"}}`.
- Produces: `listings.views.ListingDraftCreateView`; `listings.urls.urlpatterns` mounted at `api/v1/`.

**Note (ruling — the create payload must carry brand, model and year):** `BoatListing.brand`, `.model` and `.manufacture_year` are `NOT NULL` columns (spec §11.4 lists no nullability for them), so a draft cannot exist without them. `POST /api/v1/listings/drafts/` therefore requires `brand_id`, `model_id` and `manufacture_year` in its payload, and everything else is optional. This matches spec §25.2's form order, where brand/model/year is step 2 and price is step 7.

**Note (ruling — `seller_type` is never accepted from the client):** per Phase 3's contract rule 3 and spec §12 acceptance test 2 ("A private seller cannot send `seller_type=BROKER` … through a crafted request"), the create endpoint accepts at most an optional `broker_id` and calls `accounts.services.resolve_seller_context(request.user, broker_id=…)`. A `seller_type` key in the request body is rejected as an unknown field.

**Note (ruling — the `listing_revisions` feature flag gates mutations only):** spec §35.1 lists `listing_revisions` among the rollout flags and §35.1 says "Flags gate both frontend exposure and backend mutation." The flag is seeded **disabled** by a data migration so §35.2 step 4 ("Deploy code with features off/read-compatible") is achievable, and it gates the four mutation endpoints (draft create, draft update, submit/withdraw, staff decision) with `403 feature_disabled`. Public read endpoints (Task 14) are **not** gated: they return only already-approved snapshots and therefore expose nothing new while the flag is off.

**Note (ruling — no new throttle scope):** spec §30.4 enumerates exactly which paths are rate limited (auth, brand/model search, inquiry, messages, finance quote logging, Checkout creation, upload intent creation). Listing draft/submit endpoints are not on that list, and unbounded draft creation is closed by Phase 13's entitlement gate, which refuses `POST /api/v1/listings/drafts/` with `403 listing_entitlement_required` once a user's allowance is used (spec §22.4). Recorded in Known Limitations.

- [ ] **Step 1: Write the failing tests**

`backend/listings/tests/test_draft_create.py`:

```python
import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.enums import SellerType, UserRole
from accounts.tests.factories import make_user
from brokers.enums import BrokerMembershipRole
from brokers.tests.factories import make_broker, make_membership
from listings.enums import ListingStatus, RevisionStatus
from listings.models import BoatListing, ListingRevision
from listings.tests.factories import make_brand, make_model, other_model_for
from platform_settings.services import set_feature_flag


@pytest.fixture
def workflow_enabled(db):
    set_feature_flag(
        key="listing_revisions", is_enabled=True, actor=None,
        description="Spec §35.1 rollout flag for the listing workflow.",
    )


@pytest.fixture
def api():
    return APIClient()


def _seller(**kwargs):
    return make_user(primary_role=UserRole.PRIVATE_SELLER, is_email_verified=True, **kwargs)


def _body(brand, model, **overrides):
    payload = {
        "brand_id": str(brand.pk),
        "model_id": str(model.pk),
        "manufacture_year": 2020,
        "title_en": "Oceanis 46.1",
    }
    payload.update(overrides)
    return payload


@pytest.mark.django_db
def test_a_private_seller_creates_a_draft_listing_and_its_first_revision(api, workflow_enabled):
    seller = _seller()
    brand = make_brand()
    model = make_model(brand)
    api.force_authenticate(seller)

    response = api.post(
        reverse("listing-draft-create"), _body(brand, model), format="json"
    )

    assert response.status_code == 201
    listing = BoatListing.objects.get(pk=response.data["id"])
    assert listing.status == ListingStatus.DRAFT
    assert listing.seller_type == SellerType.PRIVATE
    assert listing.owner_user_id == seller.pk
    assert listing.broker_id is None
    assert listing.brand_id == brand.pk
    assert listing.manufacture_year == 2020
    revision = ListingRevision.objects.get(listing=listing)
    assert revision.revision_number == 1
    assert revision.state == RevisionStatus.DRAFT
    assert revision.base_snapshot_id is None
    assert revision.payload["title_en"] == "Oceanis 46.1"
    assert response.data["revision"]["version"] == 1


@pytest.mark.django_db
def test_the_response_reports_the_role_policy_capabilities(api, workflow_enabled):
    seller = _seller()
    brand = make_brand()
    api.force_authenticate(seller)

    response = api.post(
        reverse("listing-draft-create"), _body(brand, make_model(brand)), format="json"
    )

    policy = response.data["policy"]
    assert policy["requires_approval"] is True
    # Empty on a fresh draft: the four names lock only after first publication
    # (spec §1, §11.4). Task 9 asserts the populated list on a published listing.
    assert policy["immutable_fields"] == []
    assert policy["image_limit"] == 1
    assert policy["video_limit"] == 0


@pytest.mark.django_db
def test_a_broker_member_creates_a_broker_listing(api, workflow_enabled):
    broker = make_broker()
    agent = make_user(primary_role=UserRole.BROKER, is_email_verified=True)
    make_membership(user=agent, broker=broker, role=BrokerMembershipRole.MANAGER,
                    can_edit_listings=True)
    brand = make_brand()
    api.force_authenticate(agent)

    response = api.post(
        reverse("listing-draft-create"),
        _body(brand, make_model(brand), broker_id=str(broker.pk)),
        format="json",
    )

    assert response.status_code == 201
    listing = BoatListing.objects.get(pk=response.data["id"])
    assert listing.seller_type == SellerType.BROKER
    assert listing.broker_id == broker.pk
    assert listing.owner_user_id is None
    assert response.data["policy"]["image_limit"] == 20
    assert response.data["policy"]["video_limit"] == 1


@pytest.mark.django_db
def test_a_private_seller_cannot_forge_a_broker_listing(api, workflow_enabled):
    seller = _seller()
    broker = make_broker()
    brand = make_brand()
    api.force_authenticate(seller)

    response = api.post(
        reverse("listing-draft-create"),
        _body(brand, make_model(brand), broker_id=str(broker.pk)),
        format="json",
    )

    assert response.status_code == 403
    assert BoatListing.objects.count() == 0


@pytest.mark.django_db
def test_a_seller_type_key_in_the_body_is_rejected(api, workflow_enabled):
    seller = _seller()
    brand = make_brand()
    api.force_authenticate(seller)

    response = api.post(
        reverse("listing-draft-create"),
        _body(brand, make_model(brand), seller_type="BROKER"),
        format="json",
    )

    assert response.status_code == 400
    assert "seller_type" in response.data["error"]["fields"]


@pytest.mark.django_db
def test_an_unverified_email_cannot_create_a_draft(api, workflow_enabled):
    seller = make_user(primary_role=UserRole.PRIVATE_SELLER, is_email_verified=False)
    brand = make_brand()
    api.force_authenticate(seller)

    response = api.post(
        reverse("listing-draft-create"), _body(brand, make_model(brand)), format="json"
    )

    assert response.status_code == 403
    assert BoatListing.objects.count() == 0


@pytest.mark.django_db
def test_an_anonymous_request_is_rejected(api, workflow_enabled):
    brand = make_brand()

    response = api.post(
        reverse("listing-draft-create"), _body(brand, make_model(brand)), format="json"
    )

    assert response.status_code in (401, 403)


@pytest.mark.django_db
def test_the_endpoint_is_closed_while_the_feature_flag_is_off(api, db):
    seller = _seller()
    brand = make_brand()
    api.force_authenticate(seller)

    response = api.post(
        reverse("listing-draft-create"), _body(brand, make_model(brand)), format="json"
    )

    assert response.status_code == 403
    assert response.data["error"]["code"] == "feature_disabled"
    assert BoatListing.objects.count() == 0


@pytest.mark.django_db
def test_a_model_from_another_brand_is_rejected(api, workflow_enabled):
    seller = _seller()
    brand = make_brand("Beneteau")
    other_brand = make_brand("Jeanneau")
    api.force_authenticate(seller)

    response = api.post(
        reverse("listing-draft-create"),
        _body(brand, make_model(other_brand)),
        format="json",
    )

    assert response.status_code == 400
    assert response.data["error"]["fields"]["model_id"]


@pytest.mark.django_db
def test_the_other_placeholder_requires_custom_text(api, workflow_enabled):
    seller = _seller()
    brand = make_brand()
    api.force_authenticate(seller)

    response = api.post(
        reverse("listing-draft-create"),
        _body(brand, other_model_for(brand)),
        format="json",
    )

    assert response.status_code == 400
    assert response.data["error"]["fields"]["custom_model_name"]


@pytest.mark.django_db
def test_the_other_placeholder_is_accepted_with_custom_text(api, workflow_enabled):
    seller = _seller()
    brand = make_brand()
    api.force_authenticate(seller)

    response = api.post(
        reverse("listing-draft-create"),
        _body(brand, other_model_for(brand), custom_model_name="McKenzie"),
        format="json",
    )

    assert response.status_code == 201
    assert BoatListing.objects.get(pk=response.data["id"]).custom_model_name == "McKenzie"


@pytest.mark.django_db
def test_an_inactive_brand_or_model_is_rejected(api, workflow_enabled):
    seller = _seller()
    brand = make_brand()
    model = make_model(brand)
    model.is_active = False
    model.save(update_fields=["is_active"])
    api.force_authenticate(seller)

    response = api.post(reverse("listing-draft-create"), _body(brand, model), format="json")

    assert response.status_code == 400
    assert response.data["error"]["fields"]["model_id"]
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd backend
uv run pytest listings/tests/test_draft_create.py -v
```

Expected: collection `ERROR` — `django.urls.exceptions.NoReverseMatch: Reverse for 'listing-draft-create' not found.`

- [ ] **Step 3: Seed the feature flag**

`backend/listings/migrations/0004_seed_listing_revisions_flag.py`:

```python
from django.db import migrations

FLAG_KEY = "listing_revisions"
FLAG_DESCRIPTION = (
    "Spec §35.1 rollout flag. Gates every listing draft/submit/decision "
    "mutation endpoint. Seeded disabled so code can ship ahead of the feature "
    "(spec §35.2 step 4)."
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
        ("listings", "0003_listingsnapshot_listingrevision"),
        ("platform_settings", "0004_featureflag"),
    ]

    operations = [migrations.RunPython(create_flag, delete_flag)]
```

Replace `"0003_listingsnapshot_listingrevision"` with whatever `makemigrations` actually named Task 4's migration (check `ls backend/listings/migrations/`).

- [ ] **Step 4: Implement the permission, the service, the serializers, the view and the routes**

`backend/listings/permissions.py`:

```python
from rest_framework.permissions import BasePermission

from platform_settings.services import is_feature_enabled

LISTING_WORKFLOW_FLAG = "listing_revisions"


class ListingWorkflowEnabled(BasePermission):
    """Spec §35.1: `listing_revisions` gates backend mutation, not just UI."""

    message = "This feature is not enabled yet."
    code = "feature_disabled"

    def has_permission(self, request, view):
        return is_feature_enabled(LISTING_WORKFLOW_FLAG, default=False)
```

`backend/listings/drafts.py`:

```python
"""Draft creation and draft editing (spec §20.1 step 1, §20.2, §30.1)."""

from django.db import transaction
from rest_framework.exceptions import ErrorDetail, ValidationError

from accounts.services import resolve_seller_context
from taxonomy.models import BoatBrand, BoatModel

from .enums import ListingStatus, RevisionOrigin, RevisionStatus
from .models import BoatListing, ListingRevision
from .payloads import validate_revision_payload


def open_revision_for(listing: BoatListing) -> ListingRevision | None:
    """The listing's single DRAFT-or-SUBMITTED revision, or None.

    Uniqueness is guaranteed by the `listings_revision_one_open_per_listing`
    database constraint (Task 4), so `.first()` cannot hide a second row.
    """
    return (
        ListingRevision.objects.filter(
            listing=listing,
            state__in=(RevisionStatus.DRAFT, RevisionStatus.SUBMITTED),
        )
        .order_by("-revision_number")
        .first()
    )


def _resolve_taxonomy(payload: dict) -> tuple[BoatBrand, BoatModel]:
    errors: dict[str, list[ErrorDetail]] = {}
    brand = BoatBrand.objects.filter(pk=payload.get("brand_id"), is_active=True).first()
    if brand is None:
        errors["brand_id"] = [
            ErrorDetail("Select an active brand.", code="invalid_brand")
        ]
    model = None
    if brand is not None:
        model = BoatModel.objects.filter(
            pk=payload.get("model_id"), brand=brand, is_active=True
        ).first()
    if model is None:
        errors["model_id"] = [
            ErrorDetail(
                "Select an active model belonging to the chosen brand.",
                code="invalid_model",
            )
        ]
    if errors:
        raise ValidationError(errors)
    return brand, model


def _apply_payload_to_listing(listing: BoatListing, cleaned: dict) -> None:
    """Mirror the payload's BoatListing-backed fields onto the row's columns.

    The payload stays the source of truth for content; these columns exist so
    the database constraints in spec §11.4 and later phases' queries work.
    """
    column_fields = (
        "custom_model_name",
        "manufacture_year",
        "price",
        "currency",
        "show_finance_estimate",
        "finance_down_payment_override_percent",
        "finance_rate_override_percent",
        "finance_term_override_months",
    )
    for field in column_fields:
        if field in cleaned:
            setattr(listing, field, cleaned[field])


@transaction.atomic
def create_listing_draft(*, actor, broker_id=None, payload: dict) -> BoatListing:
    context = resolve_seller_context(actor, broker_id=broker_id)

    brand, model = _resolve_taxonomy(payload)

    listing = BoatListing(
        owner_user=context.owner_user,
        broker=context.broker,
        seller_type=context.seller_type,
        brand=brand,
        model=model,
        manufacture_year=payload.get("manufacture_year"),
        status=ListingStatus.DRAFT,
        created_by=actor,
        updated_by=actor,
    )

    cleaned = validate_revision_payload(
        payload, listing=listing, origin=RevisionOrigin.OWNER, for_submission=False
    )
    _apply_payload_to_listing(listing, cleaned)

    try:
        listing.full_clean(exclude=["current_public_snapshot"])
    except Exception as exc:  # django.core.exceptions.ValidationError
        raise ValidationError(getattr(exc, "message_dict", {"non_field_errors": [str(exc)]}))
    listing.save()

    revision = ListingRevision.objects.create(
        listing=listing,
        revision_number=1,
        base_snapshot=None,
        state=RevisionStatus.DRAFT,
        origin=RevisionOrigin.OWNER,
        payload=cleaned,
    )
    listing.open_revision = revision
    return listing
```

**Note (why `full_clean(exclude=["current_public_snapshot"])`):** `full_clean()` runs the model's `clean()`, which is where the two cross-table/moving-target rules live (Other-model custom text, manufacture year upper bound). `current_public_snapshot` is excluded because it is unset on a brand-new row and Django would otherwise complain about a missing related object.

`backend/listings/serializers.py`:

```python
from rest_framework import serializers

from .drafts import open_revision_for
from .payloads import IMMUTABLE_FIELD_NAMES, is_locked_for_owner
from .policies import effective_media_allowance, requires_staff_approval


class ListingDraftCreateSerializer(serializers.Serializer):
    """Accepts only `broker_id` plus the revision payload.

    `seller_type`, `owner_user` and `broker` are resolved on the server
    (spec §12 item 2); the payload itself is validated by
    listings.payloads.validate_revision_payload inside the service.
    """

    broker_id = serializers.UUIDField(required=False, allow_null=True)


class RevisionSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    revision_number = serializers.IntegerField()
    state = serializers.CharField()
    origin = serializers.CharField()
    version = serializers.IntegerField()
    payload = serializers.JSONField()
    decision_note = serializers.CharField()
    submitted_at = serializers.DateTimeField(allow_null=True)
    decided_at = serializers.DateTimeField(allow_null=True)


class ListingWorkflowSerializer(serializers.Serializer):
    """The owner-facing representation every mutation endpoint returns.

    Spec §30.2: "Mutations return updated resource/version".
    Spec §25.1: the policy block is the server-supplied capability payload the
    Phase 16 form renders from.
    """

    def to_representation(self, listing):
        revision = getattr(listing, "open_revision", None) or open_revision_for(listing)
        allowance = effective_media_allowance(listing)
        return {
            "id": str(listing.pk),
            "status": listing.status,
            "seller_type": listing.seller_type,
            "version": listing.version,
            "published_at": listing.published_at,
            "expires_at": listing.expires_at,
            "current_public_snapshot_version": (
                listing.current_public_snapshot.version
                if listing.current_public_snapshot_id
                else None
            ),
            "revision": RevisionSerializer(revision).data if revision else None,
            "policy": {
                "requires_approval": requires_staff_approval(listing),
                "immutable_fields": (
                    list(IMMUTABLE_FIELD_NAMES) if is_locked_for_owner(listing) else []
                ),
                "image_limit": allowance.images,
                "video_limit": allowance.videos,
            },
        }
```

**Note (ruling — `immutable_fields` is empty until the listing is locked):** spec §25.1's example capability payload shows `"immutable_fields": ["brand", "model", "custom_model_name", "manufacture_year"]` for a private seller. Those fields only actually lock *after first publication* (spec §1, §11.4), so reporting them as locked on a brand-new draft would contradict the backend, which accepts them happily. The list is therefore populated exactly when `payloads.is_locked_for_owner()` is true — `[]` on a fresh draft, the four names once a public snapshot exists (asserted in Task 9).

`backend/listings/views.py`:

```python
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsActiveUser, IsEmailVerified

from .drafts import create_listing_draft
from .permissions import ListingWorkflowEnabled
from .serializers import ListingDraftCreateSerializer, ListingWorkflowSerializer


class ListingDraftCreateView(APIView):
    """POST /api/v1/listings/drafts/ — create an authorized draft (spec §30.1)."""

    permission_classes = [
        IsAuthenticated,
        IsActiveUser,
        IsEmailVerified,
        ListingWorkflowEnabled,
    ]

    def post(self, request):
        envelope = ListingDraftCreateSerializer(data=request.data)
        envelope.is_valid(raise_exception=True)
        payload = {
            key: value for key, value in request.data.items() if key != "broker_id"
        }
        listing = create_listing_draft(
            actor=request.user,
            broker_id=envelope.validated_data.get("broker_id"),
            payload=payload,
        )
        return Response(
            ListingWorkflowSerializer().to_representation(listing),
            status=status.HTTP_201_CREATED,
        )
```

`backend/listings/urls.py`:

```python
from django.urls import path

from .views import ListingDraftCreateView

urlpatterns = [
    path("listings/drafts/", ListingDraftCreateView.as_view(), name="listing-draft-create"),
]
```

In `backend/config/urls.py`, add one include after the existing taxonomy include:

```python
    path("api/v1/", include("taxonomy.urls")),
    path("api/v1/", include("listings.urls")),
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd backend
uv run python manage.py migrate
uv run pytest listings/tests/test_draft_create.py -v
```

Expected: all tests PASS.

- [ ] **Step 6: Confirm no migration drift and run the whole suite**

```bash
cd backend
uv run python manage.py makemigrations --check --dry-run
uv run pytest
```

Expected: `No changes detected`; full suite green.

- [ ] **Step 7: Commit**

```bash
git add backend/listings backend/config/urls.py
git commit -m "feat(listings): add draft creation endpoint behind the listing_revisions rollout flag"
```

---

### Task 9: Draft update service and `PATCH /api/v1/listings/<id>/draft/`

**Files:**
- Modify: `backend/listings/drafts.py`, `backend/listings/serializers.py`, `backend/listings/views.py`, `backend/listings/urls.py`
- Test: `backend/listings/tests/test_draft_update.py`

**Interfaces:**
- Consumes: `listings.drafts.{open_revision_for, _apply_payload_to_listing}` (Task 8); `listings.locking.bump_version` (Task 6); `listings.payloads.validate_revision_payload` (Task 5); `accounts.permissions.IsOwnerOrBrokerEditor`.
- Produces: `listings.drafts.update_listing_draft(*, listing, actor, expected_version: int, payload: dict) -> ListingRevision` — merges `payload` into the open revision's stored payload, mirrors the listing columns, and bumps the revision's `version`.
- Produces: `listings.serializers.ListingDraftUpdateSerializer` (fields: `version` required integer; everything else is the revision payload).
- Produces: `listings.views.ListingDraftUpdateView` at `PATCH /api/v1/listings/<uuid:listing_id>/draft/`, route name `listing-draft-update`.

**Note (ruling — a PATCH merges into the stored payload, it does not replace it):** spec §30.1 names the endpoint `PATCH /api/v1/listings/<id>/draft/` ("update draft/revision") and spec §25.4 requires autosave of a partially-filled form. A `PATCH` therefore merges its keys into `ListingRevision.payload` (last write wins per key) rather than replacing the document, so an autosave of one step cannot wipe the other eight. Sending an explicit `null` for a key **removes** it from the stored payload, which is how a seller clears an optional field (`location_region`, `title_it`, a finance override). `media_ids` is a list and is replaced wholesale when present — a partial merge of an ordered list has no coherent meaning.

**Note (ruling — which revision a PATCH targets, and when a new one is created):** `update_listing_draft` only ever writes a revision in state `DRAFT`. Concretely:
- open revision is `DRAFT` → write into it.
- open revision is `SUBMITTED` → refuse with `409` and code `invalid_revision_state`; the seller must withdraw first (spec §36.4: "Seller cannot delete an item under active staff review; they may withdraw submission"). It is a `409`, not a `400`, because the request is well-formed and the *state* is the conflict.
- no open revision (the previous one was approved, rejected or withdrawn) → create the next `revision_number` in `DRAFT`, with `base_snapshot` set to the listing's `current_public_snapshot` (which may be `NULL` for a never-published listing). This is the path that opens a post-publication edit, and it is why `base_snapshot` exists: spec §11.4 defines it as the snapshot a revision was written against, and Task 11 uses it to detect that a newer snapshot appeared while the revision sat in the queue.
- a listing in status `REJECTED` returns to `DRAFT` at this moment, which is spec §6.1's `REJECTED -> DRAFT` edge.

**Note (ruling — a revision payload inherits from its base snapshot):** when a new revision is opened against an existing `current_public_snapshot`, its starting payload is the **snapshot's own content** (title/description/specifications/location/price/currency and the media ids from the manifest), not an empty document. Otherwise a seller who edits only the price would submit a revision whose approval produced a snapshot with no title. Spec §26.2's "Side-by-side before/after diff for revisions" (Phase 17) also presupposes that a revision is a complete proposed document, not a sparse patch.

- [ ] **Step 1: Write the failing tests**

`backend/listings/tests/test_draft_update.py`:

```python
import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from listings.enums import ListingStatus, RevisionStatus
from listings.models import ListingRevision
from listings.tests.factories import (
    make_private_listing,
    make_revision,
    make_snapshot,
)
from platform_settings.services import set_feature_flag


@pytest.fixture
def workflow_enabled(db):
    set_feature_flag(key="listing_revisions", is_enabled=True, actor=None)


@pytest.fixture
def api():
    return APIClient()


def _seller():
    return make_user(primary_role=UserRole.PRIVATE_SELLER, is_email_verified=True)


def _url(listing):
    return reverse("listing-draft-update", kwargs={"listing_id": listing.pk})


@pytest.mark.django_db
def test_a_patch_merges_into_the_stored_payload(api, workflow_enabled):
    owner = _seller()
    listing = make_private_listing(owner=owner)
    revision = make_revision(listing, payload={"title_en": "First", "location_city": "Genoa"})
    api.force_authenticate(owner)

    response = api.patch(
        _url(listing), {"version": revision.version, "price": "99000.00"}, format="json"
    )

    assert response.status_code == 200
    revision.refresh_from_db()
    assert revision.payload["title_en"] == "First"
    assert revision.payload["price"] == "99000.00"
    assert revision.version == 2
    assert response.data["revision"]["version"] == 2


@pytest.mark.django_db
def test_a_patch_mirrors_payload_fields_onto_the_listing_columns(api, workflow_enabled):
    owner = _seller()
    listing = make_private_listing(owner=owner, price=None)
    revision = make_revision(listing)
    api.force_authenticate(owner)

    api.patch(_url(listing), {"version": revision.version, "price": "99000.00"},
              format="json")

    listing.refresh_from_db()
    assert str(listing.price) == "99000.00"


@pytest.mark.django_db
def test_an_explicit_null_removes_a_key_from_the_payload(api, workflow_enabled):
    owner = _seller()
    listing = make_private_listing(owner=owner)
    revision = make_revision(listing, payload={"title_en": "Keep", "location_region": "Liguria"})
    api.force_authenticate(owner)

    api.patch(_url(listing), {"version": revision.version, "location_region": None},
              format="json")

    revision.refresh_from_db()
    assert "location_region" not in revision.payload
    assert revision.payload["title_en"] == "Keep"


@pytest.mark.django_db
def test_a_stale_version_is_refused_with_409_and_current_version_metadata(api, workflow_enabled):
    owner = _seller()
    listing = make_private_listing(owner=owner)
    revision = make_revision(listing)
    api.force_authenticate(owner)
    api.patch(_url(listing), {"version": 1, "title_en": "First writer wins"},
              format="json")

    response = api.patch(
        _url(listing), {"version": 1, "title_en": "Second writer loses"}, format="json"
    )

    assert response.status_code == 409
    assert response.data["error"]["code"] == "stale_version"
    assert response.data["error"]["meta"] == {"resource": "revision", "current_version": 2}
    revision.refresh_from_db()
    assert revision.payload["title_en"] == "First writer wins"


@pytest.mark.django_db
def test_the_version_field_is_required(api, workflow_enabled):
    owner = _seller()
    listing = make_private_listing(owner=owner)
    make_revision(listing)
    api.force_authenticate(owner)

    response = api.patch(_url(listing), {"title_en": "No version"}, format="json")

    assert response.status_code == 400
    assert "version" in response.data["error"]["fields"]


@pytest.mark.django_db
def test_another_user_cannot_edit_someone_elses_listing(api, workflow_enabled):
    listing = make_private_listing(owner=_seller())
    revision = make_revision(listing)
    api.force_authenticate(_seller())

    response = api.patch(_url(listing), {"version": revision.version, "title_en": "Mine now"},
                         format="json")

    assert response.status_code in (403, 404)


@pytest.mark.django_db
def test_a_submitted_revision_cannot_be_edited(api, workflow_enabled):
    owner = _seller()
    listing = make_private_listing(owner=owner, status=ListingStatus.PENDING_APPROVAL)
    revision = make_revision(
        listing, state=RevisionStatus.SUBMITTED, submitted_by=owner,
        submitted_at=timezone.now(),
    )
    api.force_authenticate(owner)

    response = api.patch(_url(listing), {"version": revision.version, "title_en": "Sneaky"},
                         format="json")

    assert response.status_code == 409
    assert response.data["error"]["code"] == "invalid_revision_state"


@pytest.mark.django_db
def test_a_published_listing_opens_a_new_revision_seeded_from_its_snapshot(api, workflow_enabled):
    owner = _seller()
    staff = make_user()
    listing = make_private_listing(owner=owner, status=ListingStatus.PUBLISHED)
    snapshot = make_snapshot(listing, approved_by=staff)
    listing.current_public_snapshot = snapshot
    listing.save(update_fields=["current_public_snapshot"])
    api.force_authenticate(owner)

    response = api.patch(
        _url(listing), {"version": listing.version, "price": "115000.00"}, format="json"
    )

    assert response.status_code == 200
    revision = ListingRevision.objects.get(listing=listing, state=RevisionStatus.DRAFT)
    assert revision.revision_number == 1
    assert revision.base_snapshot_id == snapshot.pk
    # Seeded from the live snapshot, then patched.
    assert revision.payload["title_en"] == snapshot.title_en
    assert revision.payload["price"] == "115000.00"
    listing.refresh_from_db()
    assert listing.status == ListingStatus.PUBLISHED


@pytest.mark.django_db
def test_opening_a_revision_on_a_published_listing_uses_the_listing_version(api, workflow_enabled):
    """With no open revision yet, the client has nothing but the listing's own
    version to send, so the service accepts it against the listing."""
    owner = _seller()
    listing = make_private_listing(owner=owner, status=ListingStatus.PUBLISHED)
    listing.current_public_snapshot = make_snapshot(listing, approved_by=make_user())
    listing.save(update_fields=["current_public_snapshot"])
    api.force_authenticate(owner)

    stale = api.patch(_url(listing), {"version": 99, "price": "1.00"}, format="json")

    assert stale.status_code == 409
    assert stale.data["error"]["meta"]["resource"] == "listing"


@pytest.mark.django_db
def test_a_published_private_listing_rejects_locked_fields(api, workflow_enabled):
    owner = _seller()
    listing = make_private_listing(owner=owner, status=ListingStatus.PUBLISHED)
    listing.current_public_snapshot = make_snapshot(listing, approved_by=make_user())
    listing.save(update_fields=["current_public_snapshot"])
    api.force_authenticate(owner)

    response = api.patch(
        _url(listing), {"version": listing.version, "manufacture_year": 2001},
        format="json",
    )

    assert response.status_code == 400
    assert response.data["error"]["fields"]["manufacture_year"] == [
        "This field cannot be changed after the listing was first published."
    ]
    listing.refresh_from_db()
    assert listing.manufacture_year != 2001


@pytest.mark.django_db
def test_the_policy_block_reports_the_locked_names_once_published(api, workflow_enabled):
    owner = _seller()
    listing = make_private_listing(owner=owner, status=ListingStatus.PUBLISHED)
    listing.current_public_snapshot = make_snapshot(listing, approved_by=make_user())
    listing.save(update_fields=["current_public_snapshot"])
    api.force_authenticate(owner)

    response = api.patch(
        _url(listing), {"version": listing.version, "price": "115000.00"}, format="json"
    )

    assert response.data["policy"]["immutable_fields"] == [
        "brand", "model", "custom_model_name", "manufacture_year",
    ]


@pytest.mark.django_db
def test_a_rejected_listing_returns_to_draft_when_editing_resumes(api, workflow_enabled):
    owner = _seller()
    listing = make_private_listing(owner=owner, status=ListingStatus.REJECTED)
    make_revision(
        listing, state=RevisionStatus.REJECTED, submitted_by=owner,
        submitted_at=timezone.now(), decided_by=make_user(),
        decided_at=timezone.now(), decision_note="Photos are unusable.",
    )
    api.force_authenticate(owner)

    response = api.patch(
        _url(listing), {"version": listing.version, "title_en": "Second attempt"},
        format="json",
    )

    assert response.status_code == 200
    listing.refresh_from_db()
    assert listing.status == ListingStatus.DRAFT
    assert ListingRevision.objects.filter(
        listing=listing, state=RevisionStatus.DRAFT, revision_number=2
    ).exists()


@pytest.mark.django_db
def test_the_endpoint_is_closed_while_the_feature_flag_is_off(api, db):
    owner = _seller()
    listing = make_private_listing(owner=owner)
    revision = make_revision(listing)
    api.force_authenticate(owner)

    response = api.patch(_url(listing), {"version": revision.version, "title_en": "x"},
                         format="json")

    assert response.status_code == 403
    assert response.data["error"]["code"] == "feature_disabled"
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd backend
uv run pytest listings/tests/test_draft_update.py -v
```

Expected: collection `ERROR` — `NoReverseMatch: Reverse for 'listing-draft-update' not found.`

- [ ] **Step 3: Implement the service**

Append to `backend/listings/drafts.py` (and extend its imports with `from rest_framework import status`, `from rest_framework.exceptions import APIException`, `from .locking import bump_version`, `from .payloads import CONTENT_FIELDS`):

```python
class InvalidWorkflowState(APIException):
    """A well-formed request against a record in the wrong state (spec §26.2's
    "return conflict and refresh")."""

    status_code = status.HTTP_409_CONFLICT
    default_detail = "This listing is not in a state that allows the requested change."
    default_code = "invalid_revision_state"

    def __init__(self, detail=None, code=None):
        super().__init__(detail=detail, code=code or self.default_code)


def _payload_from_snapshot(snapshot) -> dict:
    """Seed a new revision with the live public content it is proposing to change.

    A revision is a complete proposed document, not a sparse patch: approving a
    price-only edit must not publish a snapshot with no title (spec §20.2, and
    spec §26.2's before/after diff presupposes a whole document).
    """
    if snapshot is None:
        return {}
    payload = {
        "title_en": snapshot.title_en,
        "title_it": snapshot.title_it,
        "title_es": snapshot.title_es,
        "description_en": snapshot.description_en,
        "description_it": snapshot.description_it,
        "description_es": snapshot.description_es,
        "specifications": snapshot.specifications,
        "location_country": snapshot.location_country,
        "location_region": snapshot.location_region,
        "location_city": snapshot.location_city,
        "currency": snapshot.currency,
        "price": f"{snapshot.price:f}",
        "media_ids": [entry["media_id"] for entry in snapshot.media_manifest],
    }
    return {key: value for key, value in payload.items() if value not in ("", None)}


@transaction.atomic
def update_listing_draft(
    *, listing: BoatListing, actor, expected_version: int, payload: dict
) -> ListingRevision:
    listing = BoatListing.objects.select_for_update().get(pk=listing.pk)
    revision = open_revision_for(listing)

    if revision is not None and revision.state == RevisionStatus.SUBMITTED:
        raise InvalidWorkflowState(
            "Withdraw the submitted revision before editing it again.",
            code="invalid_revision_state",
        )

    if revision is None:
        # Opening a new edit cycle. The client has no revision version to send
        # yet, so the compare-and-swap runs against the listing itself.
        target_status = (
            ListingStatus.DRAFT
            if listing.status in (ListingStatus.DRAFT, ListingStatus.REJECTED)
            else listing.status
        )
        bump_version(
            listing,
            expected_version=expected_version,
            resource="listing",
            status=target_status,
            updated_by=actor,
        )
        revision = ListingRevision.objects.create(
            listing=listing,
            revision_number=(
                ListingRevision.objects.filter(listing=listing)
                .order_by("-revision_number")
                .values_list("revision_number", flat=True)
                .first()
                or 0
            )
            + 1,
            base_snapshot=listing.current_public_snapshot,
            state=RevisionStatus.DRAFT,
            origin=RevisionOrigin.OWNER,
            payload=_payload_from_snapshot(listing.current_public_snapshot),
        )
        revision_expected_version = revision.version
    else:
        revision_expected_version = expected_version

    removals = {key for key, value in payload.items() if value is None}
    cleaned = validate_revision_payload(
        {key: value for key, value in payload.items() if value is not None},
        listing=listing,
        origin=RevisionOrigin.OWNER,
        for_submission=False,
    )

    merged = dict(revision.payload)
    merged.update(cleaned)
    for key in removals:
        merged.pop(key, None)

    bump_version(
        revision,
        expected_version=revision_expected_version,
        resource="revision",
        payload=merged,
    )

    _apply_payload_to_listing(listing, cleaned)
    listing.updated_by = actor
    try:
        listing.full_clean(exclude=["current_public_snapshot"])
    except Exception as exc:  # django.core.exceptions.ValidationError
        raise ValidationError(
            getattr(exc, "message_dict", {"non_field_errors": [str(exc)]})
        )
    listing.save()
    listing.open_revision = revision
    return revision
```

**Note (why the removal keys bypass `validate_revision_payload`):** a `null` means "delete this key", so there is nothing to type-check; but the key must still be one the caller is *allowed* to touch. Add that guard immediately before the `validate_revision_payload` call:

```python
    allowed = allowed_payload_fields(listing=listing, origin=RevisionOrigin.OWNER)
    illegal = sorted(removals - allowed)
    if illegal:
        raise ValidationError(
            {
                field: [
                    ErrorDetail(
                        "This field cannot be changed.",
                        code=(
                            "immutable_after_publication"
                            if field in TAXONOMY_FIELDS
                            else "unknown_field"
                        ),
                    )
                ]
                for field in illegal
            }
        )
```

and extend the module's imports with `from .payloads import TAXONOMY_FIELDS, allowed_payload_fields, validate_revision_payload`.

- [ ] **Step 4: Implement the serializer, the view and the route**

Append to `backend/listings/serializers.py`:

```python
class ListingDraftUpdateSerializer(serializers.Serializer):
    """Spec §20.5: "All edit submissions include listing/revision version."""

    version = serializers.IntegerField(min_value=1)
```

Append to `backend/listings/views.py`:

```python
from django.shortcuts import get_object_or_404

from accounts.permissions import IsOwnerOrBrokerEditor

from .drafts import update_listing_draft
from .models import BoatListing
from .serializers import ListingDraftUpdateSerializer


class ListingDraftUpdateView(APIView):
    """PATCH /api/v1/listings/<id>/draft/ — update draft/revision (spec §30.1)."""

    permission_classes = [
        IsAuthenticated,
        IsActiveUser,
        IsEmailVerified,
        ListingWorkflowEnabled,
        IsOwnerOrBrokerEditor,
    ]

    def get_listing(self, request, listing_id):
        listing = get_object_or_404(BoatListing, pk=listing_id)
        self.check_object_permissions(request, listing)
        return listing

    def patch(self, request, listing_id):
        listing = self.get_listing(request, listing_id)
        envelope = ListingDraftUpdateSerializer(data=request.data)
        envelope.is_valid(raise_exception=True)
        payload = {key: value for key, value in request.data.items() if key != "version"}
        update_listing_draft(
            listing=listing,
            actor=request.user,
            expected_version=envelope.validated_data["version"],
            payload=payload,
        )
        listing.refresh_from_db()
        return Response(ListingWorkflowSerializer().to_representation(listing))
```

Append to `backend/listings/urls.py`:

```python
from .views import ListingDraftUpdateView

urlpatterns += [
    path(
        "listings/<uuid:listing_id>/draft/",
        ListingDraftUpdateView.as_view(),
        name="listing-draft-update",
    ),
]
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd backend
uv run pytest listings/tests/test_draft_update.py -v
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/listings
git commit -m "feat(listings): add draft update endpoint with payload merge and version conflict handling"
```

---

### Task 10: Submit and withdraw services, their endpoints, and the post-commit domain signals

**Files:**
- Create: `backend/listings/submissions.py`, `backend/listings/signals.py`
- Modify: `backend/listings/serializers.py`, `backend/listings/views.py`, `backend/listings/urls.py`
- Test: `backend/listings/tests/test_submit_withdraw.py`

**Interfaces:**
- Consumes: `listings.drafts.{open_revision_for, InvalidWorkflowState}`; `listings.locking.bump_version`; `listings.payloads.validate_revision_payload`; `listings.policies.{ListingEntitlementGate, effective_media_allowance, media_counts, requires_staff_approval}`; `listings.models.ListingMedia`; `audit.services.record_audit_event`.
- Produces: `listings.signals.{listing_initial_submitted, listing_revision_submitted, listing_other_model_submitted, listing_revision_withdrawn, listing_revision_approved, listing_revision_changes_requested, listing_revision_rejected, listing_published}` — `django.dispatch.Signal` instances, each sent with `sender=ListingRevision` (or `BoatListing` for `listing_published`) and keyword arguments documented in the module.
- Produces: `listings.submissions.submit_listing_revision(*, listing, actor, expected_version: int) -> ListingRevision`.
- Produces: `listings.submissions.withdraw_listing_revision(*, listing, actor, expected_version: int) -> ListingRevision`.
- Produces: `listings.views.{ListingSubmitView, ListingWithdrawView}` at `POST /api/v1/listings/<uuid:listing_id>/submit/` (`listing-submit`) and `POST /api/v1/listings/<uuid:listing_id>/withdraw/` (`listing-withdraw`).

**Note (ruling — notifications are real Django signals, not no-op stubs):** spec §20.1 step 6 requires "Staff receives notification after commit", §13.4 requires `listing.other_model_submitted` on an Other-model submission, and §27.1 tabulates eight listing events — all of which belong to spec Phase 18, which has no model, task queue binding or WebSocket consumer yet. Writing empty `def notify_x(): pass` functions would be exactly the TODO placeholder §39 forbids. Instead this phase emits genuine `django.dispatch.Signal`s through `transaction.on_commit()`. A signal with no receivers is a complete, working mechanism, and it already satisfies two spec requirements outright: §2.3's "Notifications are scheduled through `transaction.on_commit()`" and §27's acceptance test "Rolled-back submission sends no email/WS event", both of which this task tests. Phase 18 connects receivers and changes nothing here.

**Note (ruling — what `submit` validates, in order):** spec §20.1's numbered steps map onto the service as:
1. `open_revision_for(listing)` must return a `DRAFT` revision, else `409 invalid_revision_state`.
2. `validate_revision_payload(..., for_submission=True)` on the **merged stored payload** — this is where "price must be positive when publication is submitted" (spec §11.4) and the required-content rules bite.
3. Media: every id in `media_ids` must resolve to a `ListingMedia` row **of this listing** whose status is `READY`, else `400 media_not_ready`; at least one must be an `IMAGE`; and the non-rejected counts must be within `effective_media_allowance()`, else `400 media_allowance_exceeded` (spec §20.1 step 3, §11.5).
4. `ListingEntitlementGate.can_submit(...)` — always true in this phase (Task 7's stub), then `.consume(...)` to choose the `publication_source`.
5. `requires_staff_approval(listing)` — always true in this phase, so the listing goes to `PENDING_APPROVAL` and **never** to `PUBLISHED` on submit. The `else` branch is deliberately absent rather than written and dead: Phase 12 adds it together with the auto-approval rules it needs.
6. Both `version` bumps and the audit event happen inside one `transaction.atomic()`, and the signals fire on commit (spec §2.3).

**Note (ruling — listing status on withdraw):** withdrawing an **initial** submission (the listing has no `current_public_snapshot`) returns the listing to `DRAFT`, which is the `PENDING_APPROVAL -> DRAFT` edge ruled in Task 1. Withdrawing a **post-publication** revision leaves the listing `PUBLISHED` and the live snapshot untouched (spec §20.2). Either way the revision becomes `WITHDRAWN` and is terminal: the next edit opens a fresh revision number, preserving the audit trail (spec §36.4: "they may withdraw submission, preserving audit").

- [ ] **Step 1: Write the failing tests**

`backend/listings/tests/test_submit_withdraw.py`:

```python
import pytest
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from audit.models import AuditEvent
from listings.enums import ListingStatus, MediaStatus, MediaType, RevisionStatus
from listings.models import ListingRevision
from listings.signals import (
    listing_initial_submitted,
    listing_other_model_submitted,
    listing_revision_submitted,
)
from listings.tests.factories import (
    make_brand,
    make_media,
    make_private_listing,
    make_revision,
    make_snapshot,
    other_model_for,
)
from platform_settings.services import set_feature_flag


@pytest.fixture
def workflow_enabled(db):
    set_feature_flag(key="listing_revisions", is_enabled=True, actor=None)


@pytest.fixture
def api():
    return APIClient()


def _seller():
    return make_user(primary_role=UserRole.PRIVATE_SELLER, is_email_verified=True)


def _complete_payload(media_id):
    return {
        "title_en": "Oceanis 46.1, one owner",
        "description_en": "Full service history.",
        "specifications": {"length_m": "14.6"},
        "location_country": "IT",
        "location_city": "Genoa",
        "price": "125000.00",
        "currency": "EUR",
        "media_ids": [str(media_id)],
    }


def _ready_private_listing(owner, **listing_kwargs):
    listing = make_private_listing(owner=owner, **listing_kwargs)
    image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY)
    revision = make_revision(listing, payload=_complete_payload(image.pk))
    return listing, revision, image


@pytest.mark.django_db
def test_submitting_moves_the_listing_and_revision_into_the_pending_states(api, workflow_enabled):
    owner = _seller()
    listing, revision, _ = _ready_private_listing(owner)
    api.force_authenticate(owner)

    response = api.post(
        reverse("listing-submit", kwargs={"listing_id": listing.pk}),
        {"version": revision.version},
        format="json",
    )

    assert response.status_code == 200
    listing.refresh_from_db()
    revision.refresh_from_db()
    assert listing.status == ListingStatus.PENDING_APPROVAL
    assert revision.state == RevisionStatus.SUBMITTED
    assert revision.submitted_by_id == owner.pk
    assert revision.submitted_at is not None
    assert listing.publication_source == "FREE_ENTITLEMENT"
    assert listing.published_at is None


@pytest.mark.django_db
def test_a_pending_listing_is_not_published(api, workflow_enabled):
    owner = _seller()
    listing, revision, _ = _ready_private_listing(owner)
    api.force_authenticate(owner)

    api.post(
        reverse("listing-submit", kwargs={"listing_id": listing.pk}),
        {"version": revision.version}, format="json",
    )

    listing.refresh_from_db()
    assert listing.current_public_snapshot_id is None
    assert listing.status != ListingStatus.PUBLISHED


@pytest.mark.django_db
def test_submitting_records_an_audit_event(api, workflow_enabled):
    owner = _seller()
    listing, revision, _ = _ready_private_listing(owner)
    api.force_authenticate(owner)

    api.post(
        reverse("listing-submit", kwargs={"listing_id": listing.pk}),
        {"version": revision.version}, format="json",
    )

    event = AuditEvent.objects.get(action="listing.submitted")
    assert event.actor_user_id == owner.pk
    assert event.target_type == "listings.ListingRevision"
    assert event.target_id == str(revision.pk)
    assert event.after["state"] == RevisionStatus.SUBMITTED


@pytest.mark.django_db
def test_an_incomplete_draft_cannot_be_submitted(api, workflow_enabled):
    owner = _seller()
    listing = make_private_listing(owner=owner, price=None)
    revision = make_revision(listing, payload={"title_en": "Only a title"})
    api.force_authenticate(owner)

    response = api.post(
        reverse("listing-submit", kwargs={"listing_id": listing.pk}),
        {"version": revision.version}, format="json",
    )

    assert response.status_code == 400
    assert response.data["error"]["fields"]["price"] == [
        "This field is required before the listing can be submitted."
    ]
    listing.refresh_from_db()
    assert listing.status == ListingStatus.DRAFT


@pytest.mark.django_db
def test_media_that_is_not_ready_blocks_submission(api, workflow_enabled):
    owner = _seller()
    listing = make_private_listing(owner=owner)
    image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.PROCESSING)
    revision = make_revision(listing, payload=_complete_payload(image.pk))
    api.force_authenticate(owner)

    response = api.post(
        reverse("listing-submit", kwargs={"listing_id": listing.pk}),
        {"version": revision.version}, format="json",
    )

    assert response.status_code == 400
    assert response.data["error"]["fields"]["media_ids"][0]
    assert response.data["error"]["code"] == "validation_error"
    listing.refresh_from_db()
    assert listing.status == ListingStatus.DRAFT


@pytest.mark.django_db
def test_media_belonging_to_another_listing_is_refused(api, workflow_enabled):
    owner = _seller()
    listing = make_private_listing(owner=owner)
    stranger_image = make_media(
        make_private_listing(owner=_seller()), media_type=MediaType.IMAGE,
        status=MediaStatus.READY,
    )
    revision = make_revision(listing, payload=_complete_payload(stranger_image.pk))
    api.force_authenticate(owner)

    response = api.post(
        reverse("listing-submit", kwargs={"listing_id": listing.pk}),
        {"version": revision.version}, format="json",
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_exceeding_the_private_base_allowance_blocks_submission(api, workflow_enabled):
    owner = _seller()
    listing = make_private_listing(owner=owner)
    first = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY, sort_order=0)
    make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY, sort_order=1)
    revision = make_revision(listing, payload=_complete_payload(first.pk))
    api.force_authenticate(owner)

    response = api.post(
        reverse("listing-submit", kwargs={"listing_id": listing.pk}),
        {"version": revision.version}, format="json",
    )

    assert response.status_code == 400
    assert response.data["error"]["fields"]["media_ids"][0]


@pytest.mark.django_db
def test_submitting_twice_is_refused(api, workflow_enabled):
    owner = _seller()
    listing, revision, _ = _ready_private_listing(owner)
    api.force_authenticate(owner)
    api.post(reverse("listing-submit", kwargs={"listing_id": listing.pk}),
             {"version": revision.version}, format="json")

    response = api.post(
        reverse("listing-submit", kwargs={"listing_id": listing.pk}),
        {"version": revision.version + 1}, format="json",
    )

    assert response.status_code == 409
    assert response.data["error"]["code"] == "invalid_revision_state"


@pytest.mark.django_db
def test_withdrawing_an_initial_submission_returns_the_listing_to_draft(api, workflow_enabled):
    owner = _seller()
    listing, revision, _ = _ready_private_listing(owner)
    api.force_authenticate(owner)
    api.post(reverse("listing-submit", kwargs={"listing_id": listing.pk}),
             {"version": revision.version}, format="json")
    revision.refresh_from_db()

    response = api.post(
        reverse("listing-withdraw", kwargs={"listing_id": listing.pk}),
        {"version": revision.version}, format="json",
    )

    assert response.status_code == 200
    listing.refresh_from_db()
    revision.refresh_from_db()
    assert listing.status == ListingStatus.DRAFT
    assert revision.state == RevisionStatus.WITHDRAWN


@pytest.mark.django_db
def test_withdrawing_a_post_publication_revision_leaves_the_listing_published(api, workflow_enabled):
    owner = _seller()
    listing = make_private_listing(owner=owner, status=ListingStatus.PUBLISHED)
    snapshot = make_snapshot(listing, approved_by=make_user())
    listing.current_public_snapshot = snapshot
    listing.save(update_fields=["current_public_snapshot"])
    image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY)
    revision = make_revision(
        listing, base_snapshot=snapshot, payload=_complete_payload(image.pk),
        state=RevisionStatus.SUBMITTED, submitted_by=owner, submitted_at=timezone.now(),
    )
    api.force_authenticate(owner)

    api.post(reverse("listing-withdraw", kwargs={"listing_id": listing.pk}),
             {"version": revision.version}, format="json")

    listing.refresh_from_db()
    revision.refresh_from_db()
    assert listing.status == ListingStatus.PUBLISHED
    assert listing.current_public_snapshot_id == snapshot.pk
    assert revision.state == RevisionStatus.WITHDRAWN


@pytest.mark.django_db
def test_a_stale_version_cannot_submit(api, workflow_enabled):
    owner = _seller()
    listing, revision, _ = _ready_private_listing(owner)
    api.force_authenticate(owner)

    response = api.post(
        reverse("listing-submit", kwargs={"listing_id": listing.pk}),
        {"version": revision.version + 5}, format="json",
    )

    assert response.status_code == 409
    assert response.data["error"]["code"] == "stale_version"


class SubmissionSignalTests(TestCase):
    """Uses TestCase for captureOnCommitCallbacks (spec §2.3, §27 acceptance)."""

    def setUp(self):
        set_feature_flag(key="listing_revisions", is_enabled=True, actor=None)
        self.owner = _seller()
        self.listing = make_private_listing(owner=self.owner)
        image = make_media(
            self.listing, media_type=MediaType.IMAGE, status=MediaStatus.READY
        )
        self.revision = make_revision(self.listing, payload=_complete_payload(image.pk))
        self.client = APIClient()
        self.client.force_authenticate(self.owner)

    def test_an_initial_submission_fires_both_signals_after_commit(self):
        received = []
        listing_initial_submitted.connect(
            lambda **kwargs: received.append("initial"), weak=False
        )
        listing_revision_submitted.connect(
            lambda **kwargs: received.append("revision"), weak=False
        )

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                reverse("listing-submit", kwargs={"listing_id": self.listing.pk}),
                {"version": self.revision.version},
                format="json",
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(sorted(received), ["initial", "revision"])

    def test_a_failed_submission_fires_no_signal(self):
        received = []
        listing_revision_submitted.connect(
            lambda **kwargs: received.append("revision"), weak=False
        )
        self.revision.payload = {"title_en": "Incomplete"}
        self.revision.save(update_fields=["payload"])

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                reverse("listing-submit", kwargs={"listing_id": self.listing.pk}),
                {"version": self.revision.version},
                format="json",
            )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(received, [])

    def test_an_other_model_submission_fires_the_taxonomy_signal(self):
        brand = make_brand("Nameless Yard")
        listing = make_private_listing(
            owner=self.owner, brand=brand, model=other_model_for(brand),
            custom_model_name="McKenzie",
        )
        image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY)
        revision = make_revision(listing, payload=_complete_payload(image.pk))
        received = []
        listing_other_model_submitted.connect(
            lambda **kwargs: received.append(kwargs["revision"]), weak=False
        )

        with self.captureOnCommitCallbacks(execute=True):
            self.client.post(
                reverse("listing-submit", kwargs={"listing_id": listing.pk}),
                {"version": revision.version},
                format="json",
            )

        self.assertEqual(received, [ListingRevision.objects.get(pk=revision.pk)])
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd backend
uv run pytest listings/tests/test_submit_withdraw.py -v
```

Expected: collection `ERROR` — `ModuleNotFoundError: No module named 'listings.signals'`.

- [ ] **Step 3: Implement the signals**

`backend/listings/signals.py`:

```python
"""Post-commit domain events for the listing workflow (spec §2.3, §13.4, §27.1).

These are real Django signals with, for now, no receivers: spec Phase 18 (§27)
owns notification fan-out and connects to them there. Every one is sent from
inside transaction.on_commit(), so a rolled-back transaction emits nothing
(spec §27 acceptance test 1).

Every signal is sent with `sender=listings.models.ListingRevision` and the
keyword argument `revision` (a ListingRevision), except `listing_published`,
which is sent with `sender=listings.models.BoatListing` and the keyword
arguments `listing` and `snapshot`.
"""

import django.dispatch

listing_initial_submitted = django.dispatch.Signal()
listing_revision_submitted = django.dispatch.Signal()
listing_other_model_submitted = django.dispatch.Signal()
listing_revision_withdrawn = django.dispatch.Signal()
listing_revision_approved = django.dispatch.Signal()
listing_revision_changes_requested = django.dispatch.Signal()
listing_revision_rejected = django.dispatch.Signal()
listing_published = django.dispatch.Signal()
```

- [ ] **Step 4: Implement the submit and withdraw services**

`backend/listings/submissions.py`:

```python
"""Submission and withdrawal (spec §20.1, §20.2, §6.2, §36.4)."""

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ErrorDetail, ValidationError

from audit.models import AuditEvent
from audit.services import record_audit_event

from .drafts import InvalidWorkflowState, open_revision_for
from .enums import ListingStatus, MediaStatus, MediaType, RevisionOrigin, RevisionStatus
from .locking import bump_version
from .models import BoatListing, ListingMedia, ListingRevision
from .payloads import validate_revision_payload
from .policies import (
    ListingEntitlementGate,
    effective_media_allowance,
    media_counts,
    requires_staff_approval,
)
from .signals import (
    listing_initial_submitted,
    listing_other_model_submitted,
    listing_revision_submitted,
    listing_revision_withdrawn,
)


def _media_error(message, code):
    raise ValidationError({"media_ids": [ErrorDetail(message, code=code)]})


def validate_submission_media(listing: BoatListing, media_ids: list[str]) -> None:
    """Spec §20.1 step 3 and §11.5.

    "Media must be READY and within allowance."
    "Only READY media can enter a submitted revision/public snapshot."
    "Media count limits include all non-rejected items."
    """
    rows = list(ListingMedia.objects.filter(listing=listing, pk__in=media_ids))
    if len(rows) != len(media_ids):
        _media_error(
            "Every selected item must be media belonging to this listing.",
            "media_not_ready",
        )
    if any(row.status != MediaStatus.READY for row in rows):
        _media_error(
            "Every selected item must finish processing before you submit.",
            "media_not_ready",
        )
    if not any(row.media_type == MediaType.IMAGE for row in rows):
        _media_error("Add at least one photo before you submit.", "media_not_ready")

    allowance = effective_media_allowance(listing)
    images, videos = media_counts(listing)
    if images > allowance.images or videos > allowance.videos:
        _media_error(
            "This listing has more media than its allowance permits "
            f"({allowance.images} photos and {allowance.videos} videos).",
            "media_allowance_exceeded",
        )


@transaction.atomic
def submit_listing_revision(
    *, listing: BoatListing, actor, expected_version: int
) -> ListingRevision:
    listing = BoatListing.objects.select_for_update().get(pk=listing.pk)
    revision = open_revision_for(listing)
    if revision is None or revision.state != RevisionStatus.DRAFT:
        raise InvalidWorkflowState(
            "There is no editable draft to submit.", code="invalid_revision_state"
        )

    cleaned = validate_revision_payload(
        revision.payload,
        listing=listing,
        origin=revision.origin,
        for_submission=True,
    )
    validate_submission_media(listing, cleaned["media_ids"])

    if not ListingEntitlementGate.can_submit(user=actor, broker=listing.broker):
        # Unreachable in Phase 11 (the gate always allows); Phase 13 makes this
        # the `403 listing_entitlement_required` path of spec §22.4.
        raise InvalidWorkflowState(
            "You do not have a listing right available.",
            code="listing_entitlement_required",
        )
    publication_source = ListingEntitlementGate.consume(listing=listing, user=actor)

    is_initial = listing.current_public_snapshot_id is None
    before = {"listing_status": listing.status, "revision_state": revision.state}
    submitted_at = timezone.now()

    bump_version(
        revision,
        expected_version=expected_version,
        resource="revision",
        state=RevisionStatus.SUBMITTED,
        submitted_by=actor,
        submitted_at=submitted_at,
    )

    if requires_staff_approval(listing):
        if is_initial:
            bump_version(
                listing,
                expected_version=listing.version,
                resource="listing",
                status=ListingStatus.PENDING_APPROVAL,
                publication_source=publication_source,
                updated_by=actor,
            )
        else:
            # Spec §20.2: the approved snapshot stays live while the edit is
            # reviewed, so the listing's own status does not move.
            bump_version(
                listing,
                expected_version=listing.version,
                resource="listing",
                updated_by=actor,
            )
    # No `else` branch: spec §6.1's broker auto-approval path is Phase 12 and
    # requires_staff_approval() always returns True here (see listings.policies).

    record_audit_event(
        actor_user=actor,
        actor_type=AuditEvent.ActorType.USER,
        action="listing.submitted",
        target_type="listings.ListingRevision",
        target_id=str(revision.pk),
        source=AuditEvent.Source.API,
        before=before,
        after={
            "listing_status": listing.status,
            "state": RevisionStatus.SUBMITTED,
            "submitted_at": submitted_at,
        },
        metadata={
            "listing_id": str(listing.pk),
            "revision_number": revision.revision_number,
            "is_initial_submission": is_initial,
            "publication_source": publication_source,
        },
    )

    uses_other_model = listing.model.is_other_placeholder

    def _emit():
        listing_revision_submitted.send(sender=ListingRevision, revision=revision)
        if is_initial:
            listing_initial_submitted.send(sender=ListingRevision, revision=revision)
        if uses_other_model:
            listing_other_model_submitted.send(
                sender=ListingRevision, revision=revision
            )

    transaction.on_commit(_emit)
    listing.open_revision = revision
    return revision


@transaction.atomic
def withdraw_listing_revision(
    *, listing: BoatListing, actor, expected_version: int
) -> ListingRevision:
    listing = BoatListing.objects.select_for_update().get(pk=listing.pk)
    revision = open_revision_for(listing)
    if revision is None or revision.state != RevisionStatus.SUBMITTED:
        raise InvalidWorkflowState(
            "There is no submitted revision to withdraw.",
            code="invalid_revision_state",
        )

    before = {"listing_status": listing.status, "revision_state": revision.state}

    bump_version(
        revision,
        expected_version=expected_version,
        resource="revision",
        state=RevisionStatus.WITHDRAWN,
    )

    if listing.current_public_snapshot_id is None:
        bump_version(
            listing,
            expected_version=listing.version,
            resource="listing",
            status=ListingStatus.DRAFT,
            updated_by=actor,
        )

    record_audit_event(
        actor_user=actor,
        actor_type=AuditEvent.ActorType.USER,
        action="listing.revision_withdrawn",
        target_type="listings.ListingRevision",
        target_id=str(revision.pk),
        source=AuditEvent.Source.API,
        before=before,
        after={"listing_status": listing.status, "state": RevisionStatus.WITHDRAWN},
        metadata={"listing_id": str(listing.pk)},
    )

    transaction.on_commit(
        lambda: listing_revision_withdrawn.send(
            sender=ListingRevision, revision=revision
        )
    )
    listing.open_revision = revision
    return revision
```

- [ ] **Step 5: Implement the serializer, views and routes**

Append to `backend/listings/serializers.py`:

```python
class ListingVersionSerializer(serializers.Serializer):
    """Body for submit/withdraw: nothing but the expected revision version."""

    version = serializers.IntegerField(min_value=1)
```

Append to `backend/listings/views.py`:

```python
from .serializers import ListingVersionSerializer
from .submissions import submit_listing_revision, withdraw_listing_revision


class ListingSubmitView(ListingDraftUpdateView):
    """POST /api/v1/listings/<id>/submit/ (spec §30.1)."""

    def patch(self, request, listing_id):
        self.http_method_not_allowed(request)

    def post(self, request, listing_id):
        listing = self.get_listing(request, listing_id)
        envelope = ListingVersionSerializer(data=request.data)
        envelope.is_valid(raise_exception=True)
        submit_listing_revision(
            listing=listing,
            actor=request.user,
            expected_version=envelope.validated_data["version"],
        )
        listing.refresh_from_db()
        return Response(ListingWorkflowSerializer().to_representation(listing))


class ListingWithdrawView(ListingSubmitView):
    """POST /api/v1/listings/<id>/withdraw/ (spec §6.2, §36.4)."""

    def post(self, request, listing_id):
        listing = self.get_listing(request, listing_id)
        envelope = ListingVersionSerializer(data=request.data)
        envelope.is_valid(raise_exception=True)
        withdraw_listing_revision(
            listing=listing,
            actor=request.user,
            expected_version=envelope.validated_data["version"],
        )
        listing.refresh_from_db()
        return Response(ListingWorkflowSerializer().to_representation(listing))
```

Append to `backend/listings/urls.py`:

```python
from .views import ListingSubmitView, ListingWithdrawView

urlpatterns += [
    path(
        "listings/<uuid:listing_id>/submit/",
        ListingSubmitView.as_view(),
        name="listing-submit",
    ),
    path(
        "listings/<uuid:listing_id>/withdraw/",
        ListingWithdrawView.as_view(),
        name="listing-withdraw",
    ),
]
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
cd backend
uv run pytest listings/tests/test_submit_withdraw.py -v
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/listings
git commit -m "feat(listings): add submit/withdraw services, media gating and post-commit domain signals"
```

---

### Task 11: Snapshot builder and the approve / request-changes / reject decision services

**Files:**
- Create: `backend/listings/snapshots.py`, `backend/listings/decisions.py`
- Test: `backend/listings/tests/test_decisions.py`

**Interfaces:**
- Consumes: `listings.models.{BoatListing, ListingMedia, ListingRevision, ListingSnapshot}`; `listings.locking.bump_version`; `listings.payloads.{SPECIFICATIONS_SCHEMA_VERSION, validate_revision_payload}`; `listings.policies.ListingEntitlementGate`; `listings.submissions.validate_submission_media`; `listings.signals.*`; `audit.services.record_audit_event`; `accounts.services.is_staff_moderator`.
- Produces:

  ```python
  def build_media_manifest(listing, media_ids: list[str]) -> list[dict]: ...
  def create_snapshot_from_revision(*, listing, revision, approved_by, approved_at) -> ListingSnapshot: ...
  ```

- Produces, in `listings.decisions`:

  ```python
  def approve_revision(*, revision_id, actor, expected_version: int, note: str = "") -> ListingRevision: ...
  def request_revision_changes(*, revision_id, actor, expected_version: int, note: str) -> ListingRevision: ...
  def reject_revision(*, revision_id, actor, expected_version: int, note: str) -> ListingRevision: ...
  ```

**Note (ruling — the exact `media_manifest` entry shape):** spec §11.4 says `media_manifest JSON` and nothing more. Each entry is
`{"media_id": str, "media_type": "IMAGE"|"VIDEO", "storage_key": str, "mime_type": str, "sort_order": int, "width": int|None, "height": int|None, "duration_seconds": int|None, "checksum_sha256": str}`,
ordered by `media_type` then `sort_order`, which is exactly the ordering `ListingMedia.Meta.ordering` produces. The "primary image" a card renders is therefore the first `IMAGE` entry (spec §36.5: "Primary image is the first ready image by explicit order"). The manifest copies the media *facts* rather than referencing the rows, so the snapshot stays readable and immutable even after a later revision reorders or removes media (spec §36.5: "Media referenced by any public snapshot cannot be physically deleted until snapshot retention permits it" — a manifest that only held ids would go dangling the moment Phase 15 implements retention cleanup).

**Note (ruling — approval re-validates rather than trusting the stored payload):** the payload was validated when it was submitted, but the world may have moved since: media may have been rejected by a scan, a setting may have changed the allowance, the taxonomy row may have been deactivated. Spec §21's acceptance test "Invalid listing never publishes even when auto-approval is on" makes revalidation at publication time a requirement, not an optimization. `approve_revision` therefore re-runs `validate_revision_payload(..., for_submission=True)` and `validate_submission_media(...)` before writing anything, and a failure returns `400` with the same field map a submission would, leaving the revision `SUBMITTED` for the moderator to bounce back with "request changes".

**Note (ruling — what approval does to each object, for both the initial and the post-publication case):** in one `transaction.atomic()`, with `select_for_update()` held on the revision:

| | initial submission | post-publication revision |
|---|---|---|
| new `ListingSnapshot` | `version = 1` | `version = previous + 1` |
| `listing.current_public_snapshot` | set | repointed |
| `listing.status` | `PENDING_APPROVAL → PUBLISHED` | unchanged (`PUBLISHED`) |
| `listing.published_at` | set to now | unchanged (first publication only) |
| `listing.expires_at` | now + `publication_days` (`None` for brokers) | unchanged |
| revision | `SUBMITTED → APPROVED` | `SUBMITTED → APPROVED` |
| signals | `listing_revision_approved`, `listing_published` | `listing_revision_approved` |

`published_at` is set only on first publication because spec §36.2 fixes the related rule for view counts ("Republishing the same listing after expiration does not reset lifetime unique count") and because spec §11.4 describes `published_at` as the listing's publication moment, not the most recent snapshot's.

**Note (ruling — a revision whose base snapshot is no longer current is refused):** if `revision.base_snapshot_id` is set and no longer equals `listing.current_public_snapshot_id`, another revision was approved while this one sat in the queue, so approving it would silently discard that newer content. The service raises `409` with code `stale_base_snapshot`, and the `meta` block reports the listing's current snapshot version. This is the snapshot-level counterpart of spec §20.5's "Do not silently overwrite another browser/session edit", and it is reachable only because the one-open-revision constraint permits exactly one *open* revision, not exactly one approval per snapshot.

**Note (ruling — `request changes` and `reject` never touch the public snapshot):** spec §20.2 is explicit — "Rejection leaves the approved public snapshot untouched." Both services only write the revision's state, `decided_by`, `decided_at` and `decision_note`, plus (for an initial submission only) the listing's status, per the Task 1 ruling: `request changes` → listing `DRAFT`, `reject` → listing `REJECTED`. A published listing's status is untouched by either. The mandatory note is enforced in three places: the serializer (Task 12), these services, and the `listings_revision_refusal_requires_a_note` database constraint (Task 4).

- [ ] **Step 1: Write the failing tests**

`backend/listings/tests/test_decisions.py`:

```python
from datetime import timedelta

import pytest
from django.utils import timezone

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from audit.models import AuditEvent
from listings.decisions import approve_revision, reject_revision, request_revision_changes
from listings.drafts import InvalidWorkflowState
from listings.enums import ListingStatus, MediaStatus, MediaType, RevisionStatus
from listings.locking import StaleVersionConflict
from listings.models import ListingSnapshot
from listings.snapshots import build_media_manifest
from listings.tests.factories import (
    make_media,
    make_private_listing,
    make_revision,
    make_snapshot,
)
from rest_framework.exceptions import ValidationError


def _staff():
    return make_user(primary_role=UserRole.STAFF, is_email_verified=True, is_staff=True)


def _payload(media_id, **overrides):
    payload = {
        "title_en": "Oceanis 46.1, one owner",
        "description_en": "Full service history.",
        "specifications": {"length_m": "14.6"},
        "location_country": "IT",
        "location_city": "Genoa",
        "price": "125000.00",
        "currency": "EUR",
        "media_ids": [str(media_id)],
    }
    payload.update(overrides)
    return payload


def _submitted_listing(owner=None, **listing_kwargs):
    owner = owner or make_user(primary_role=UserRole.PRIVATE_SELLER, is_email_verified=True)
    listing = make_private_listing(
        owner=owner, status=ListingStatus.PENDING_APPROVAL, **listing_kwargs
    )
    image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY)
    revision = make_revision(
        listing,
        payload=_payload(image.pk),
        state=RevisionStatus.SUBMITTED,
        submitted_by=owner,
        submitted_at=timezone.now(),
    )
    return listing, revision, image


@pytest.mark.django_db
def test_build_media_manifest_copies_the_media_facts_in_order():
    listing = make_private_listing(owner=make_user())
    second = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY, sort_order=1)
    first = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY, sort_order=0)

    manifest = build_media_manifest(listing, [str(second.pk), str(first.pk)])

    assert [entry["media_id"] for entry in manifest] == [str(first.pk), str(second.pk)]
    assert manifest[0]["media_type"] == MediaType.IMAGE
    assert manifest[0]["storage_key"] == first.storage_key
    assert manifest[0]["checksum_sha256"] == first.checksum_sha256


@pytest.mark.django_db
def test_approving_an_initial_submission_publishes_snapshot_version_one():
    listing, revision, _ = _submitted_listing()
    staff = _staff()

    approve_revision(revision_id=revision.pk, actor=staff, expected_version=revision.version)

    listing.refresh_from_db()
    revision.refresh_from_db()
    snapshot = ListingSnapshot.objects.get(listing=listing)
    assert snapshot.version == 1
    assert snapshot.approved_revision_id == revision.pk
    assert snapshot.approved_by_id == staff.pk
    assert snapshot.title_en == "Oceanis 46.1, one owner"
    assert str(snapshot.price) == "125000.00"
    assert snapshot.specifications_schema_version == 1
    assert listing.status == ListingStatus.PUBLISHED
    assert listing.current_public_snapshot_id == snapshot.pk
    assert listing.published_at is not None
    assert revision.state == RevisionStatus.APPROVED
    assert revision.decided_by_id == staff.pk


@pytest.mark.django_db
def test_approval_sets_the_expiry_from_the_publication_policy():
    listing, revision, _ = _submitted_listing()

    approve_revision(revision_id=revision.pk, actor=_staff(), expected_version=revision.version)

    listing.refresh_from_db()
    expected = listing.published_at + timedelta(days=30)
    assert abs((listing.expires_at - expected).total_seconds()) < 5


@pytest.mark.django_db
def test_approval_records_an_audit_event_with_actor_note_and_timestamps():
    listing, revision, _ = _submitted_listing()
    staff = _staff()

    approve_revision(
        revision_id=revision.pk, actor=staff, expected_version=revision.version,
        note="Looks good.",
    )

    event = AuditEvent.objects.get(action="listing.revision_approved")
    assert event.actor_user_id == staff.pk
    assert event.target_id == str(revision.pk)
    assert event.metadata["note"] == "Looks good."
    assert event.after["snapshot_version"] == 1
    assert event.created_at is not None


@pytest.mark.django_db
def test_approving_a_post_publication_revision_creates_version_two_and_keeps_published_at():
    owner = make_user(primary_role=UserRole.PRIVATE_SELLER, is_email_verified=True)
    listing = make_private_listing(owner=owner, status=ListingStatus.PUBLISHED)
    first_snapshot = make_snapshot(listing, approved_by=_staff(), version=1)
    listing.current_public_snapshot = first_snapshot
    listing.published_at = timezone.now() - timedelta(days=3)
    listing.save(update_fields=["current_public_snapshot", "published_at"])
    original_published_at = listing.published_at
    image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY)
    revision = make_revision(
        listing,
        base_snapshot=first_snapshot,
        payload=_payload(image.pk, price="115000.00"),
        state=RevisionStatus.SUBMITTED,
        submitted_by=owner,
        submitted_at=timezone.now(),
    )

    approve_revision(revision_id=revision.pk, actor=_staff(), expected_version=revision.version)

    listing.refresh_from_db()
    assert listing.current_public_snapshot.version == 2
    assert str(listing.current_public_snapshot.price) == "115000.00"
    assert listing.published_at == original_published_at
    assert ListingSnapshot.objects.filter(listing=listing).count() == 2
    assert str(ListingSnapshot.objects.get(listing=listing, version=1).price) == "125000.00"


@pytest.mark.django_db
def test_a_revision_based_on_a_superseded_snapshot_is_refused():
    owner = make_user(primary_role=UserRole.PRIVATE_SELLER, is_email_verified=True)
    listing = make_private_listing(owner=owner, status=ListingStatus.PUBLISHED)
    stale_base = make_snapshot(listing, approved_by=_staff(), version=1)
    current = make_snapshot(listing, approved_by=_staff(), version=2)
    listing.current_public_snapshot = current
    listing.save(update_fields=["current_public_snapshot"])
    image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY)
    revision = make_revision(
        listing, base_snapshot=stale_base, payload=_payload(image.pk),
        state=RevisionStatus.SUBMITTED, submitted_by=owner, submitted_at=timezone.now(),
    )

    with pytest.raises(InvalidWorkflowState) as exc_info:
        approve_revision(revision_id=revision.pk, actor=_staff(),
                         expected_version=revision.version)

    assert exc_info.value.get_codes() == "stale_base_snapshot"


@pytest.mark.django_db
def test_approval_revalidates_and_refuses_media_rejected_after_submission():
    listing, revision, image = _submitted_listing()
    image.status = MediaStatus.REJECTED
    image.save(update_fields=["status"])

    with pytest.raises(ValidationError):
        approve_revision(revision_id=revision.pk, actor=_staff(),
                         expected_version=revision.version)

    listing.refresh_from_db()
    revision.refresh_from_db()
    assert listing.status == ListingStatus.PENDING_APPROVAL
    assert revision.state == RevisionStatus.SUBMITTED
    assert ListingSnapshot.objects.count() == 0


@pytest.mark.django_db
def test_a_second_moderator_decision_conflicts_and_creates_no_second_snapshot():
    listing, revision, _ = _submitted_listing()
    first_version = revision.version
    approve_revision(revision_id=revision.pk, actor=_staff(), expected_version=first_version)

    with pytest.raises(StaleVersionConflict):
        approve_revision(revision_id=revision.pk, actor=_staff(),
                         expected_version=first_version)

    assert ListingSnapshot.objects.filter(listing=listing).count() == 1


@pytest.mark.django_db
def test_requesting_changes_returns_an_initial_submission_to_draft():
    listing, revision, _ = _submitted_listing()

    request_revision_changes(
        revision_id=revision.pk, actor=_staff(), expected_version=revision.version,
        note="Please add an interior photo.",
    )

    listing.refresh_from_db()
    revision.refresh_from_db()
    assert listing.status == ListingStatus.DRAFT
    assert revision.state == RevisionStatus.CHANGES_REQUESTED
    assert revision.decision_note == "Please add an interior photo."
    assert AuditEvent.objects.filter(action="listing.revision_changes_requested").exists()


@pytest.mark.django_db
def test_rejecting_an_initial_submission_sets_the_listing_to_rejected():
    listing, revision, _ = _submitted_listing()

    reject_revision(
        revision_id=revision.pk, actor=_staff(), expected_version=revision.version,
        note="Duplicate of an existing listing.",
    )

    listing.refresh_from_db()
    revision.refresh_from_db()
    assert listing.status == ListingStatus.REJECTED
    assert revision.state == RevisionStatus.REJECTED
    assert AuditEvent.objects.filter(action="listing.revision_rejected").exists()


@pytest.mark.django_db
def test_rejecting_a_post_publication_revision_leaves_the_public_snapshot_live():
    owner = make_user(primary_role=UserRole.PRIVATE_SELLER, is_email_verified=True)
    listing = make_private_listing(owner=owner, status=ListingStatus.PUBLISHED)
    snapshot = make_snapshot(listing, approved_by=_staff(), version=1)
    listing.current_public_snapshot = snapshot
    listing.save(update_fields=["current_public_snapshot"])
    image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY)
    revision = make_revision(
        listing, base_snapshot=snapshot, payload=_payload(image.pk, price="1000.00"),
        state=RevisionStatus.SUBMITTED, submitted_by=owner, submitted_at=timezone.now(),
    )

    reject_revision(
        revision_id=revision.pk, actor=_staff(), expected_version=revision.version,
        note="Price is not credible.",
    )

    listing.refresh_from_db()
    assert listing.status == ListingStatus.PUBLISHED
    assert listing.current_public_snapshot_id == snapshot.pk
    assert str(listing.current_public_snapshot.price) == "125000.00"


@pytest.mark.django_db
def test_a_refusal_without_a_note_is_rejected():
    listing, revision, _ = _submitted_listing()

    with pytest.raises(ValidationError) as exc_info:
        reject_revision(revision_id=revision.pk, actor=_staff(),
                        expected_version=revision.version, note="   ")

    assert exc_info.value.detail["note"][0].code == "decision_note_required"


@pytest.mark.django_db
def test_a_draft_revision_cannot_be_decided():
    listing = make_private_listing(owner=make_user())
    revision = make_revision(listing)

    with pytest.raises(InvalidWorkflowState):
        approve_revision(revision_id=revision.pk, actor=_staff(),
                         expected_version=revision.version)
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd backend
uv run pytest listings/tests/test_decisions.py -v
```

Expected: collection `ERROR` — `ModuleNotFoundError: No module named 'listings.decisions'`.

- [ ] **Step 3: Implement the snapshot builder**

`backend/listings/snapshots.py`:

```python
"""Building the immutable public snapshot from an approved revision (spec §11.4, §20)."""

from decimal import Decimal

from .models import BoatListing, ListingMedia, ListingRevision, ListingSnapshot
from .payloads import SPECIFICATIONS_SCHEMA_VERSION


def build_media_manifest(listing: BoatListing, media_ids: list[str]) -> list[dict]:
    """Copy the media facts, in public display order, into a self-contained list.

    Ordered by (media_type, sort_order) — ListingMedia.Meta.ordering — so the
    first IMAGE entry is the primary image (spec §36.5). Facts are copied rather
    than referenced so the snapshot stays readable and immutable after a later
    revision reorders or drops media.
    """
    rows = ListingMedia.objects.filter(listing=listing, pk__in=media_ids)
    return [
        {
            "media_id": str(row.pk),
            "media_type": row.media_type,
            "storage_key": row.storage_key,
            "mime_type": row.mime_type,
            "sort_order": row.sort_order,
            "width": row.width,
            "height": row.height,
            "duration_seconds": row.duration_seconds,
            "checksum_sha256": row.checksum_sha256,
        }
        for row in rows
    ]


def create_snapshot_from_revision(
    *,
    listing: BoatListing,
    revision: ListingRevision,
    cleaned_payload: dict,
    approved_by,
    approved_at,
) -> ListingSnapshot:
    previous_version = (
        ListingSnapshot.objects.filter(listing=listing)
        .order_by("-version")
        .values_list("version", flat=True)
        .first()
        or 0
    )
    return ListingSnapshot.objects.create(
        listing=listing,
        version=previous_version + 1,
        approved_revision=revision,
        brand_name_snapshot=listing.brand.name,
        model_name_snapshot=listing.model.name,
        custom_model_name_snapshot=listing.custom_model_name,
        manufacture_year_snapshot=listing.manufacture_year,
        title_en=cleaned_payload["title_en"],
        title_it=cleaned_payload.get("title_it", ""),
        title_es=cleaned_payload.get("title_es", ""),
        description_en=cleaned_payload["description_en"],
        description_it=cleaned_payload.get("description_it", ""),
        description_es=cleaned_payload.get("description_es", ""),
        specifications=cleaned_payload.get("specifications", {}),
        specifications_schema_version=SPECIFICATIONS_SCHEMA_VERSION,
        location_country=cleaned_payload["location_country"],
        location_region=cleaned_payload.get("location_region", ""),
        location_city=cleaned_payload["location_city"],
        currency=cleaned_payload.get("currency", listing.currency),
        price=Decimal(cleaned_payload["price"]),
        media_manifest=build_media_manifest(listing, cleaned_payload["media_ids"]),
        approved_by=approved_by,
        approved_at=approved_at,
    )
```

- [ ] **Step 4: Implement the decision services**

`backend/listings/decisions.py`:

```python
"""Staff decisions on a submitted revision (spec §20.1 steps 7-8, §20.2, §26.2)."""

from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ErrorDetail, ValidationError

from audit.models import AuditEvent
from audit.services import record_audit_event

from .drafts import InvalidWorkflowState
from .enums import ListingStatus, RevisionStatus
from .locking import bump_version
from .models import BoatListing, ListingRevision
from .payloads import validate_revision_payload
from .policies import ListingEntitlementGate
from .signals import (
    listing_published,
    listing_revision_approved,
    listing_revision_changes_requested,
    listing_revision_rejected,
)
from .snapshots import create_snapshot_from_revision
from .submissions import validate_submission_media


def _locked_submitted_revision(revision_id) -> tuple[ListingRevision, BoatListing]:
    revision = (
        ListingRevision.objects.select_for_update()
        .select_related("listing", "listing__brand", "listing__model")
        .get(pk=revision_id)
    )
    if revision.state != RevisionStatus.SUBMITTED:
        raise InvalidWorkflowState(
            "This revision has already been decided.", code="invalid_revision_state"
        )
    listing = BoatListing.objects.select_for_update().get(pk=revision.listing_id)
    return revision, listing


def _require_note(note: str) -> str:
    """Spec §26.2: "Request changes and reject require a user-visible reason."""
    cleaned = (note or "").strip()
    if not cleaned:
        raise ValidationError(
            {
                "note": [
                    ErrorDetail(
                        "Explain what the seller needs to change.",
                        code="decision_note_required",
                    )
                ]
            }
        )
    return cleaned


@transaction.atomic
def approve_revision(
    *, revision_id, actor, expected_version: int, note: str = ""
) -> ListingRevision:
    revision, listing = _locked_submitted_revision(revision_id)

    if (
        revision.base_snapshot_id is not None
        and revision.base_snapshot_id != listing.current_public_snapshot_id
    ):
        raise InvalidWorkflowState(
            "A newer version of this listing was approved in the meantime. "
            "Ask the seller to rebase their changes.",
            code="stale_base_snapshot",
        )

    # Spec §21 acceptance: "Invalid listing never publishes." Re-validate at
    # publication time, because media, settings and taxonomy may have moved
    # since the seller submitted.
    cleaned = validate_revision_payload(
        revision.payload,
        listing=listing,
        origin=revision.origin,
        for_submission=True,
    )
    validate_submission_media(listing, cleaned["media_ids"])

    decided_at = timezone.now()
    is_first_publication = listing.current_public_snapshot_id is None
    before = {"listing_status": listing.status, "revision_state": revision.state}

    bump_version(
        revision,
        expected_version=expected_version,
        resource="revision",
        state=RevisionStatus.APPROVED,
        decided_by=actor,
        decided_at=decided_at,
        decision_note=(note or "").strip(),
    )

    snapshot = create_snapshot_from_revision(
        listing=listing,
        revision=revision,
        cleaned_payload=cleaned,
        approved_by=actor,
        approved_at=decided_at,
    )

    updates = {
        "current_public_snapshot": snapshot,
        "status": ListingStatus.PUBLISHED,
        "updated_by": actor,
    }
    if is_first_publication:
        publication_days = ListingEntitlementGate.publication_days(listing=listing)
        updates["published_at"] = decided_at
        updates["expires_at"] = (
            decided_at + timedelta(days=publication_days)
            if publication_days is not None
            else None
        )
    bump_version(
        listing, expected_version=listing.version, resource="listing", **updates
    )

    record_audit_event(
        actor_user=actor,
        actor_type=AuditEvent.ActorType.USER,
        action="listing.revision_approved",
        target_type="listings.ListingRevision",
        target_id=str(revision.pk),
        source=AuditEvent.Source.API,
        before=before,
        after={
            "listing_status": listing.status,
            "state": RevisionStatus.APPROVED,
            "snapshot_version": snapshot.version,
            "decided_at": decided_at,
        },
        metadata={
            "listing_id": str(listing.pk),
            "note": (note or "").strip(),
            "first_publication": is_first_publication,
        },
    )

    def _emit():
        listing_revision_approved.send(sender=ListingRevision, revision=revision)
        if is_first_publication:
            listing_published.send(
                sender=BoatListing, listing=listing, snapshot=snapshot
            )

    transaction.on_commit(_emit)
    listing.open_revision = None
    return revision


def _refuse(
    *, revision_id, actor, expected_version, note, target_state, listing_status, action,
    signal,
):
    cleaned_note = _require_note(note)
    revision, listing = _locked_submitted_revision(revision_id)
    decided_at = timezone.now()
    before = {"listing_status": listing.status, "revision_state": revision.state}

    bump_version(
        revision,
        expected_version=expected_version,
        resource="revision",
        state=target_state,
        decided_by=actor,
        decided_at=decided_at,
        decision_note=cleaned_note,
    )

    # Spec §20.2: "Rejection leaves the approved public snapshot untouched."
    # Only an initial submission moves the listing's own status.
    if listing.current_public_snapshot_id is None:
        bump_version(
            listing,
            expected_version=listing.version,
            resource="listing",
            status=listing_status,
            updated_by=actor,
        )

    record_audit_event(
        actor_user=actor,
        actor_type=AuditEvent.ActorType.USER,
        action=action,
        target_type="listings.ListingRevision",
        target_id=str(revision.pk),
        source=AuditEvent.Source.API,
        before=before,
        after={
            "listing_status": listing.status,
            "state": target_state,
            "decided_at": decided_at,
        },
        metadata={"listing_id": str(listing.pk), "note": cleaned_note},
    )

    transaction.on_commit(
        lambda: signal.send(sender=ListingRevision, revision=revision)
    )
    return revision


@transaction.atomic
def request_revision_changes(
    *, revision_id, actor, expected_version: int, note: str
) -> ListingRevision:
    return _refuse(
        revision_id=revision_id,
        actor=actor,
        expected_version=expected_version,
        note=note,
        target_state=RevisionStatus.CHANGES_REQUESTED,
        listing_status=ListingStatus.DRAFT,
        action="listing.revision_changes_requested",
        signal=listing_revision_changes_requested,
    )


@transaction.atomic
def reject_revision(
    *, revision_id, actor, expected_version: int, note: str
) -> ListingRevision:
    return _refuse(
        revision_id=revision_id,
        actor=actor,
        expected_version=expected_version,
        note=note,
        target_state=RevisionStatus.REJECTED,
        listing_status=ListingStatus.REJECTED,
        action="listing.revision_rejected",
        signal=listing_revision_rejected,
    )
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd backend
uv run pytest listings/tests/test_decisions.py -v
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/listings
git commit -m "feat(listings): add snapshot builder and audited approve/request-changes/reject services"
```

---

### Task 12: `POST /api/v1/staff/revisions/<id>/decision/`

**Files:**
- Modify: `backend/listings/serializers.py`, `backend/listings/views.py`, `backend/listings/urls.py`
- Test: `backend/listings/tests/test_decision_api.py`

**Interfaces:**
- Consumes: `listings.decisions.{approve_revision, request_revision_changes, reject_revision}` (Task 11); `accounts.permissions.IsStaffModerator`.
- Produces: `listings.serializers.RevisionDecisionSerializer` with fields `decision` (choice of `APPROVE`, `REQUEST_CHANGES`, `REJECT`), `version` (required integer) and `note` (string, optional for `APPROVE`, required and non-blank for the other two).
- Produces: `listings.serializers.StaffRevisionSerializer` — the moderator-facing representation `{"id", "listing_id", "revision_number", "state", "origin", "version", "decision_note", "decided_at", "listing": {"id", "status", "version", "current_public_snapshot_version"}}`.
- Produces: `listings.views.StaffRevisionDecisionView` at `POST /api/v1/staff/revisions/<uuid:revision_id>/decision/`, route name `staff-revision-decision`.

**Note (ruling — one endpoint, three decisions):** spec §30.1 lists a single endpoint, `POST /api/v1/staff/revisions/<id>/decision/`, whose purpose is "approve/request changes/reject". The three are therefore one endpoint discriminated by a required `decision` field, not three routes. The values are the uppercase verbs `APPROVE`, `REQUEST_CHANGES`, `REJECT` — matching this codebase's convention that every persisted or transmitted enum value is an uppercase identifier.

**Note (ruling — moderator, not admin):** spec §5's capability table gives "Approve listings/revisions" a ✓ for both **Staff moderator** and **Staff admin**, so the endpoint is gated with `IsStaffModerator` (Phase 3's `is_staff_admin` implies `is_staff_moderator`, so admins pass too). The staff-authored *correction* revision in Task 13 is a different, narrower power and is gated with `IsStaffAdmin`, per spec §20.3's "Staff **admin** may create a staff-authored correction revision".

**Note (ruling — the decision endpoint is behind the feature flag too):** it is a mutation, and spec §35.1 says flags gate backend mutation. A moderator hitting it while `listing_revisions` is off gets `403 feature_disabled`. This is coherent with §35.2's rollout order: nothing can be submitted while the flag is off, so there is nothing to decide.

- [ ] **Step 1: Write the failing tests**

`backend/listings/tests/test_decision_api.py`:

```python
import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from django.contrib.auth.models import Group
from listings.enums import ListingStatus, MediaStatus, MediaType, RevisionStatus
from listings.models import ListingSnapshot
from listings.tests.factories import (
    make_media,
    make_private_listing,
    make_revision,
)
from platform_settings.services import set_feature_flag


@pytest.fixture
def workflow_enabled(db):
    set_feature_flag(key="listing_revisions", is_enabled=True, actor=None)


@pytest.fixture
def api():
    return APIClient()


def _moderator():
    user = make_user(primary_role=UserRole.STAFF, is_email_verified=True)
    user.groups.add(Group.objects.get(name=StaffGroup.MODERATOR))
    return user


def _payload(media_id):
    return {
        "title_en": "Oceanis 46.1, one owner",
        "description_en": "Full service history.",
        "specifications": {"length_m": "14.6"},
        "location_country": "IT",
        "location_city": "Genoa",
        "price": "125000.00",
        "currency": "EUR",
        "media_ids": [str(media_id)],
    }


def _submitted():
    owner = make_user(primary_role=UserRole.PRIVATE_SELLER, is_email_verified=True)
    listing = make_private_listing(owner=owner, status=ListingStatus.PENDING_APPROVAL)
    image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY)
    revision = make_revision(
        listing, payload=_payload(image.pk), state=RevisionStatus.SUBMITTED,
        submitted_by=owner, submitted_at=timezone.now(),
    )
    return listing, revision


def _url(revision):
    return reverse("staff-revision-decision", kwargs={"revision_id": revision.pk})


@pytest.mark.django_db
def test_a_moderator_approves_a_revision(api, workflow_enabled):
    listing, revision = _submitted()
    api.force_authenticate(_moderator())

    response = api.post(
        _url(revision), {"decision": "APPROVE", "version": revision.version},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["state"] == RevisionStatus.APPROVED
    assert response.data["listing"]["status"] == ListingStatus.PUBLISHED
    assert response.data["listing"]["current_public_snapshot_version"] == 1
    assert response.data["version"] == revision.version + 1


@pytest.mark.django_db
def test_a_moderator_requests_changes_with_a_reason(api, workflow_enabled):
    listing, revision = _submitted()
    api.force_authenticate(_moderator())

    response = api.post(
        _url(revision),
        {"decision": "REQUEST_CHANGES", "version": revision.version,
         "note": "Add an interior photo."},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["state"] == RevisionStatus.CHANGES_REQUESTED
    assert response.data["decision_note"] == "Add an interior photo."
    listing.refresh_from_db()
    assert listing.status == ListingStatus.DRAFT


@pytest.mark.django_db
def test_request_changes_without_a_note_is_rejected(api, workflow_enabled):
    _, revision = _submitted()
    api.force_authenticate(_moderator())

    response = api.post(
        _url(revision), {"decision": "REQUEST_CHANGES", "version": revision.version},
        format="json",
    )

    assert response.status_code == 400
    assert "note" in response.data["error"]["fields"]


@pytest.mark.django_db
def test_reject_without_a_note_is_rejected(api, workflow_enabled):
    _, revision = _submitted()
    api.force_authenticate(_moderator())

    response = api.post(
        _url(revision), {"decision": "REJECT", "version": revision.version, "note": "  "},
        format="json",
    )

    assert response.status_code == 400
    assert "note" in response.data["error"]["fields"]


@pytest.mark.django_db
def test_approval_does_not_require_a_note(api, workflow_enabled):
    _, revision = _submitted()
    api.force_authenticate(_moderator())

    response = api.post(
        _url(revision), {"decision": "APPROVE", "version": revision.version},
        format="json",
    )

    assert response.status_code == 200


@pytest.mark.django_db
def test_a_repeated_click_conflicts_and_creates_no_second_snapshot(api, workflow_enabled):
    listing, revision = _submitted()
    api.force_authenticate(_moderator())
    api.post(_url(revision), {"decision": "APPROVE", "version": revision.version},
             format="json")

    response = api.post(
        _url(revision), {"decision": "APPROVE", "version": revision.version},
        format="json",
    )

    assert response.status_code == 409
    assert response.data["error"]["code"] in ("invalid_revision_state", "stale_version")
    assert ListingSnapshot.objects.filter(listing=listing).count() == 1


@pytest.mark.django_db
def test_a_stale_version_returns_current_version_metadata(api, workflow_enabled):
    _, revision = _submitted()
    api.force_authenticate(_moderator())

    response = api.post(
        _url(revision), {"decision": "APPROVE", "version": revision.version + 7},
        format="json",
    )

    assert response.status_code == 409
    assert response.data["error"]["code"] == "stale_version"
    assert response.data["error"]["meta"]["resource"] == "revision"
    assert response.data["error"]["meta"]["current_version"] == revision.version


@pytest.mark.django_db
def test_the_listing_owner_cannot_approve_their_own_listing(api, workflow_enabled):
    listing, revision = _submitted()
    api.force_authenticate(listing.owner_user)

    response = api.post(
        _url(revision), {"decision": "APPROVE", "version": revision.version},
        format="json",
    )

    assert response.status_code == 403
    assert ListingSnapshot.objects.count() == 0


@pytest.mark.django_db
def test_an_anonymous_request_cannot_decide(api, workflow_enabled):
    _, revision = _submitted()

    response = api.post(
        _url(revision), {"decision": "APPROVE", "version": revision.version},
        format="json",
    )

    assert response.status_code in (401, 403)


@pytest.mark.django_db
def test_an_unknown_decision_value_is_rejected(api, workflow_enabled):
    _, revision = _submitted()
    api.force_authenticate(_moderator())

    response = api.post(
        _url(revision), {"decision": "PUBLISH_NOW", "version": revision.version},
        format="json",
    )

    assert response.status_code == 400
    assert "decision" in response.data["error"]["fields"]


@pytest.mark.django_db
def test_the_endpoint_is_closed_while_the_feature_flag_is_off(api, db):
    _, revision = _submitted()
    api.force_authenticate(_moderator())

    response = api.post(
        _url(revision), {"decision": "APPROVE", "version": revision.version},
        format="json",
    )

    assert response.status_code == 403
    assert response.data["error"]["code"] == "feature_disabled"
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd backend
uv run pytest listings/tests/test_decision_api.py -v
```

Expected: collection `ERROR` — `NoReverseMatch: Reverse for 'staff-revision-decision' not found.`

- [ ] **Step 3: Implement the serializers**

Append to `backend/listings/serializers.py`:

```python
class RevisionDecisionSerializer(serializers.Serializer):
    """Spec §30.1's single decision endpoint, discriminated by `decision`.
    Spec §26.2: "Request changes and reject require a user-visible reason."""

    APPROVE = "APPROVE"
    REQUEST_CHANGES = "REQUEST_CHANGES"
    REJECT = "REJECT"

    decision = serializers.ChoiceField(choices=[APPROVE, REQUEST_CHANGES, REJECT])
    version = serializers.IntegerField(min_value=1)
    note = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        if attrs["decision"] != self.APPROVE and not attrs.get("note", "").strip():
            raise serializers.ValidationError(
                {
                    "note": serializers.ErrorDetail(
                        "Explain what the seller needs to change.",
                        code="decision_note_required",
                    )
                }
            )
        return attrs


class StaffRevisionSerializer(serializers.Serializer):
    """The moderator-facing view of a decided revision (spec §30.2: mutations
    return the updated resource and its version)."""

    def to_representation(self, revision):
        listing = revision.listing
        return {
            "id": str(revision.pk),
            "listing_id": str(listing.pk),
            "revision_number": revision.revision_number,
            "state": revision.state,
            "origin": revision.origin,
            "version": revision.version,
            "decision_note": revision.decision_note,
            "decided_at": revision.decided_at,
            "listing": {
                "id": str(listing.pk),
                "status": listing.status,
                "version": listing.version,
                "current_public_snapshot_version": (
                    listing.current_public_snapshot.version
                    if listing.current_public_snapshot_id
                    else None
                ),
            },
        }
```

- [ ] **Step 4: Implement the view and the route**

Append to `backend/listings/views.py`:

```python
from accounts.permissions import IsStaffModerator

from .decisions import approve_revision, reject_revision, request_revision_changes
from .models import ListingRevision
from .serializers import RevisionDecisionSerializer, StaffRevisionSerializer

_DECISION_SERVICES = {
    RevisionDecisionSerializer.APPROVE: approve_revision,
    RevisionDecisionSerializer.REQUEST_CHANGES: request_revision_changes,
    RevisionDecisionSerializer.REJECT: reject_revision,
}


class StaffRevisionDecisionView(APIView):
    """POST /api/v1/staff/revisions/<id>/decision/ (spec §30.1, §26.2)."""

    permission_classes = [
        IsAuthenticated,
        IsActiveUser,
        ListingWorkflowEnabled,
        IsStaffModerator,
    ]

    def post(self, request, revision_id):
        envelope = RevisionDecisionSerializer(data=request.data)
        envelope.is_valid(raise_exception=True)
        get_object_or_404(ListingRevision, pk=revision_id)

        service = _DECISION_SERVICES[envelope.validated_data["decision"]]
        revision = service(
            revision_id=revision_id,
            actor=request.user,
            expected_version=envelope.validated_data["version"],
            note=envelope.validated_data.get("note", ""),
        )
        revision.refresh_from_db()
        revision.listing.refresh_from_db()
        return Response(StaffRevisionSerializer().to_representation(revision))
```

Append to `backend/listings/urls.py`:

```python
from .views import StaffRevisionDecisionView

urlpatterns += [
    path(
        "staff/revisions/<uuid:revision_id>/decision/",
        StaffRevisionDecisionView.as_view(),
        name="staff-revision-decision",
    ),
]
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd backend
uv run pytest listings/tests/test_decision_api.py -v
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/listings
git commit -m "feat(listings): add the staff revision decision endpoint with mandatory refusal reasons"
```

---

### Task 13: Staff-authored immutable-field corrections and listing suspension

**Files:**
- Modify: `backend/listings/decisions.py`
- Test: `backend/listings/tests/test_staff_corrections.py`

**Interfaces:**
- Consumes: everything Task 11 produced, plus `listings.enums.RevisionOrigin`.
- Produces:

  ```python
  def create_staff_correction_revision(*, listing, actor, payload: dict, note: str) -> ListingRevision: ...
  def suspend_listing(*, listing, actor, reason: str) -> BoatListing: ...
  def unsuspend_listing(*, listing, actor, reason: str) -> BoatListing: ...
  ```

**Note (ruling — a correction is an ordinary revision with `origin=STAFF_CORRECTION`, submitted in the same call):** spec §20.3 says a staff admin "may create a staff-authored correction revision", that "the action requires a note and audit event", and that "staff approval generates a new snapshot". Rather than inventing a parallel correction model, this is an ordinary `ListingRevision` whose `origin` is `STAFF_CORRECTION` — the value Task 5's payload validator already recognises as permitted to touch the immutable fields. It is created **already in `SUBMITTED` state** (stamped `submitted_by = actor`), because a correction that sat in `DRAFT` would occupy the listing's single open-revision slot and silently block the seller from editing while staff forgot about it. Approval then runs through the *same* `approve_revision` service as any other revision, which is what produces the new snapshot and leaves the historical one immutable.

**Note (ruling — a correction refuses to run while the seller has an open revision):** the `listings_revision_one_open_per_listing` constraint means a correction cannot be created while the seller holds a `DRAFT` or `SUBMITTED` revision. Rather than surfacing an `IntegrityError`, the service checks first and raises `409 invalid_revision_state` with a message telling staff to decide the pending revision first. That is the honest ordering: spec §13.3's taxonomy-mapping flow (Phase 17) also decides the pending submission before mapping.

**Note (ruling — a correction seeds itself from the live snapshot):** like any post-publication revision (Task 9), the correction's payload starts as the current snapshot's content and the staff-supplied `payload` is merged over it, so approving a brand-only correction does not blank the description.

**Note (ruling — suspension has services and audit but no HTTP endpoint in this phase):** spec §6.1 puts `SUSPENDED` in the listing state machine ("Suspension is staff-only and requires a reason") and §36.4 says "Staff can suspend a live listing without modifying snapshot content", so the state machine this phase owns is incomplete without it. But the moderation queue and its action buttons are spec §26.2 — Phase 17 — and §30.1 lists no suspension endpoint. This task therefore ships `suspend_listing` / `unsuspend_listing` as fully tested, fully audited domain services with no route; Phase 17 wires its queue to them. Neither service touches `current_public_snapshot`, so the snapshot content survives suspension exactly as §36.4 requires; what changes is that Task 14's public queries filter on `status=PUBLISHED`, so a suspended listing disappears from public read paths.

- [ ] **Step 1: Write the failing tests**

`backend/listings/tests/test_staff_corrections.py`:

```python
import pytest
from django.utils import timezone

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from audit.models import AuditEvent
from listings.decisions import (
    approve_revision,
    create_staff_correction_revision,
    suspend_listing,
    unsuspend_listing,
)
from listings.drafts import InvalidWorkflowState
from listings.enums import ListingStatus, MediaStatus, MediaType, RevisionOrigin, RevisionStatus
from listings.models import ListingSnapshot
from listings.tests.factories import (
    make_brand,
    make_media,
    make_model,
    make_private_listing,
    make_revision,
    make_snapshot,
)
from rest_framework.exceptions import ValidationError


def _staff():
    return make_user(primary_role=UserRole.STAFF, is_email_verified=True)


def _published_listing():
    owner = make_user(primary_role=UserRole.PRIVATE_SELLER, is_email_verified=True)
    brand = make_brand("Beneteau")
    listing = make_private_listing(
        owner=owner, brand=brand, model=make_model(brand, "Oceanis 46.1"),
        status=ListingStatus.PUBLISHED,
    )
    image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY)
    snapshot = make_snapshot(
        listing, approved_by=_staff(), version=1,
        media_manifest=[{
            "media_id": str(image.pk), "media_type": MediaType.IMAGE,
            "storage_key": image.storage_key, "mime_type": image.mime_type,
            "sort_order": image.sort_order, "width": image.width,
            "height": image.height, "duration_seconds": None,
            "checksum_sha256": image.checksum_sha256,
        }],
    )
    listing.current_public_snapshot = snapshot
    listing.published_at = timezone.now()
    listing.save(update_fields=["current_public_snapshot", "published_at"])
    return listing, snapshot, image


@pytest.mark.django_db
def test_a_correction_revision_may_change_a_locked_field():
    listing, snapshot, _ = _published_listing()
    staff = _staff()

    revision = create_staff_correction_revision(
        listing=listing, actor=staff, payload={"manufacture_year": 2018},
        note="Owner supplied the registration document.",
    )

    assert revision.origin == RevisionOrigin.STAFF_CORRECTION
    assert revision.state == RevisionStatus.SUBMITTED
    assert revision.submitted_by_id == staff.pk
    assert revision.base_snapshot_id == snapshot.pk
    assert revision.payload["manufacture_year"] == 2018
    # Seeded from the live snapshot, so the rest of the content survives.
    assert revision.payload["title_en"] == snapshot.title_en


@pytest.mark.django_db
def test_a_correction_requires_a_note():
    listing, _, _ = _published_listing()

    with pytest.raises(ValidationError) as exc_info:
        create_staff_correction_revision(
            listing=listing, actor=_staff(), payload={"manufacture_year": 2018}, note="",
        )

    assert exc_info.value.detail["note"][0].code == "decision_note_required"


@pytest.mark.django_db
def test_a_correction_records_an_audit_event_with_actor_and_note():
    listing, _, _ = _published_listing()
    staff = _staff()

    revision = create_staff_correction_revision(
        listing=listing, actor=staff, payload={"manufacture_year": 2018},
        note="Owner supplied the registration document.",
    )

    event = AuditEvent.objects.get(action="listing.correction_revision_created")
    assert event.actor_user_id == staff.pk
    assert event.target_id == str(revision.pk)
    assert event.metadata["note"] == "Owner supplied the registration document."
    assert event.after["payload_fields"] == ["manufacture_year"]


@pytest.mark.django_db
def test_approving_a_correction_creates_a_new_snapshot_and_keeps_history():
    listing, original_snapshot, _ = _published_listing()
    staff = _staff()
    revision = create_staff_correction_revision(
        listing=listing, actor=staff, payload={"manufacture_year": 2018},
        note="Registration document supplied.",
    )
    listing.refresh_from_db()
    listing.manufacture_year = 2018
    listing.save(update_fields=["manufacture_year"])

    approve_revision(revision_id=revision.pk, actor=staff, expected_version=revision.version)

    listing.refresh_from_db()
    assert listing.current_public_snapshot.version == 2
    assert listing.current_public_snapshot.manufacture_year_snapshot == 2018
    historical = ListingSnapshot.objects.get(pk=original_snapshot.pk)
    assert historical.manufacture_year_snapshot == original_snapshot.manufacture_year_snapshot


@pytest.mark.django_db
def test_a_correction_is_refused_while_the_seller_has_an_open_revision():
    listing, _, _ = _published_listing()
    make_revision(listing, payload={"title_en": "Seller is editing"})

    with pytest.raises(InvalidWorkflowState) as exc_info:
        create_staff_correction_revision(
            listing=listing, actor=_staff(), payload={"manufacture_year": 2018},
            note="Registration document supplied.",
        )

    assert exc_info.value.get_codes() == "invalid_revision_state"


@pytest.mark.django_db
def test_suspending_a_published_listing_keeps_its_snapshot_intact():
    listing, snapshot, _ = _published_listing()
    staff = _staff()

    suspend_listing(listing=listing, actor=staff, reason="Reported as a duplicate.")

    listing.refresh_from_db()
    assert listing.status == ListingStatus.SUSPENDED
    assert listing.current_public_snapshot_id == snapshot.pk
    event = AuditEvent.objects.get(action="listing.suspended")
    assert event.actor_user_id == staff.pk
    assert event.metadata["reason"] == "Reported as a duplicate."


@pytest.mark.django_db
def test_suspension_requires_a_reason():
    listing, _, _ = _published_listing()

    with pytest.raises(ValidationError):
        suspend_listing(listing=listing, actor=_staff(), reason="   ")


@pytest.mark.django_db
def test_a_suspended_listing_can_be_restored():
    listing, _, _ = _published_listing()
    staff = _staff()
    suspend_listing(listing=listing, actor=staff, reason="Reported as a duplicate.")
    listing.refresh_from_db()

    unsuspend_listing(listing=listing, actor=staff, reason="Report was unfounded.")

    listing.refresh_from_db()
    assert listing.status == ListingStatus.PUBLISHED
    assert AuditEvent.objects.filter(action="listing.unsuspended").exists()


@pytest.mark.django_db
def test_a_draft_listing_cannot_be_suspended():
    listing = make_private_listing(owner=make_user())

    with pytest.raises(InvalidWorkflowState):
        suspend_listing(listing=listing, actor=_staff(), reason="Nothing to suspend.")
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd backend
uv run pytest listings/tests/test_staff_corrections.py -v
```

Expected: `ImportError: cannot import name 'create_staff_correction_revision' from 'listings.decisions'`.

- [ ] **Step 3: Implement the three services**

Append to `backend/listings/decisions.py` (extend its imports with `from .drafts import _payload_from_snapshot, open_revision_for` and `from .enums import RevisionOrigin` and `from .locking import bump_version`, and rename `drafts._payload_from_snapshot` to the public `drafts.payload_from_snapshot` in the same commit so the cross-module import is not reaching into a private name):

```python
@transaction.atomic
def create_staff_correction_revision(
    *, listing: BoatListing, actor, payload: dict, note: str
) -> ListingRevision:
    """Spec §20.3: a staff-authored correction of a field the seller cannot edit.

    Created already SUBMITTED so it does not occupy the listing's single open
    revision slot indefinitely; approval then runs through approve_revision()
    like any other revision, producing the next snapshot version and leaving the
    historical snapshot immutable.
    """
    cleaned_note = _require_note(note)
    listing = BoatListing.objects.select_for_update().get(pk=listing.pk)

    if open_revision_for(listing) is not None:
        raise InvalidWorkflowState(
            "Decide the seller's pending revision before creating a correction.",
            code="invalid_revision_state",
        )

    merged = payload_from_snapshot(listing.current_public_snapshot)
    cleaned = validate_revision_payload(
        payload,
        listing=listing,
        origin=RevisionOrigin.STAFF_CORRECTION,
        for_submission=False,
    )
    merged.update(cleaned)

    submitted_at = timezone.now()
    revision = ListingRevision.objects.create(
        listing=listing,
        revision_number=(
            ListingRevision.objects.filter(listing=listing)
            .order_by("-revision_number")
            .values_list("revision_number", flat=True)
            .first()
            or 0
        )
        + 1,
        base_snapshot=listing.current_public_snapshot,
        state=RevisionStatus.SUBMITTED,
        origin=RevisionOrigin.STAFF_CORRECTION,
        payload=merged,
        submitted_by=actor,
        submitted_at=submitted_at,
    )

    record_audit_event(
        actor_user=actor,
        actor_type=AuditEvent.ActorType.USER,
        action="listing.correction_revision_created",
        target_type="listings.ListingRevision",
        target_id=str(revision.pk),
        source=AuditEvent.Source.API,
        before={"listing_status": listing.status},
        after={
            "state": RevisionStatus.SUBMITTED,
            "origin": RevisionOrigin.STAFF_CORRECTION,
            "payload_fields": sorted(cleaned),
            "submitted_at": submitted_at,
        },
        metadata={"listing_id": str(listing.pk), "note": cleaned_note},
    )

    transaction.on_commit(
        lambda: listing_revision_submitted.send(
            sender=ListingRevision, revision=revision
        )
    )
    return revision


def _change_suspension(*, listing, actor, reason, target_status, action):
    cleaned_reason = _require_note(reason)
    listing = BoatListing.objects.select_for_update().get(pk=listing.pk)
    if not can_transition_listing(listing.status, target_status):
        raise InvalidWorkflowState(
            f"A listing in state {listing.status} cannot move to {target_status}.",
            code="invalid_listing_state",
        )

    before_status = listing.status
    bump_version(
        listing,
        expected_version=listing.version,
        resource="listing",
        status=target_status,
        updated_by=actor,
    )

    record_audit_event(
        actor_user=actor,
        actor_type=AuditEvent.ActorType.USER,
        action=action,
        target_type="listings.BoatListing",
        target_id=str(listing.pk),
        source=AuditEvent.Source.ADMIN,
        before={"status": before_status},
        after={"status": target_status},
        metadata={"reason": cleaned_reason},
    )
    return listing


@transaction.atomic
def suspend_listing(*, listing: BoatListing, actor, reason: str) -> BoatListing:
    """Spec §6.1 ("Suspension is staff-only and requires a reason") and §36.4
    ("Staff can suspend a live listing without modifying snapshot content").

    No HTTP route in this phase: spec §26.2's moderation queue (Phase 17) wires
    its Suspend action to this service.
    """
    return _change_suspension(
        listing=listing,
        actor=actor,
        reason=reason,
        target_status=ListingStatus.SUSPENDED,
        action="listing.suspended",
    )


@transaction.atomic
def unsuspend_listing(*, listing: BoatListing, actor, reason: str) -> BoatListing:
    return _change_suspension(
        listing=listing,
        actor=actor,
        reason=reason,
        target_status=ListingStatus.PUBLISHED,
        action="listing.unsuspended",
    )
```

Extend `backend/listings/decisions.py`'s imports with `from .enums import can_transition_listing` — or, since `can_transition_listing` lives in `listings.enums`, add it to the existing `from .enums import ...` line.

In `backend/listings/drafts.py`, rename `_payload_from_snapshot` to `payload_from_snapshot` (it now has a second caller) and update the one reference inside `update_listing_draft`.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd backend
uv run pytest listings/tests/test_staff_corrections.py listings/tests/test_draft_update.py -v
```

Expected: all tests PASS (the second file re-run proves the `payload_from_snapshot` rename did not break Task 9).

- [ ] **Step 5: Commit**

```bash
git add backend/listings
git commit -m "feat(listings): add staff correction revisions and audited listing suspension services"
```

---

### Task 14: Public read API — `GET /api/v1/listings/` and `GET /api/v1/listings/<id>/`

**Files:**
- Modify: `backend/listings/serializers.py`, `backend/listings/views.py`, `backend/listings/urls.py`
- Test: `backend/listings/tests/test_public_read_api.py`

**Interfaces:**
- Consumes: `listings.models.{BoatListing, ListingSnapshot}`; `listings.enums.ListingStatus`.
- Produces: `listings.serializers.PublicListingSerializer` — serialized **entirely from `listing.current_public_snapshot`**, never from the listing's draft columns.
- Produces: `listings.views.{PublicListingListView, PublicListingDetailView}` at `GET /api/v1/listings/` (`listing-list`) and `GET /api/v1/listings/<uuid:listing_id>/` (`listing-detail`), both `AllowAny`.
- Produces: `listings.views.published_listings_queryset() -> QuerySet[BoatListing]` — `status=PUBLISHED` **and** `current_public_snapshot__isnull=False`, the single definition of "publicly visible" every later phase must reuse.

**Note (ruling — why this phase owns a public read path at all):** spec §20's definition of done opens with "No pending private listing leaks through search, sitemap, direct slug or API." That is unprovable without a public read path, so the minimum one that can carry the proof is built here: a list and a detail endpoint that serve **only** approved snapshot content. Card composition proper — the finance block (spec §18.5, Phase 9), the view count write path (§19, Phase 10), media CDN URLs (§24, Phase 15), search filters, sorting and facets (§29.4, Phase 20) — is explicitly not built here, and each of those phases extends this serializer rather than adding a second one (spec §29.1: "Every boat card uses one component and one API representation").

**Note (ruling — the listing UUID is the public identifier; there is no slug in this phase):** spec §4.1 routes public detail at `/boats/<listing-slug>/`, and §36.2 mentions that "changing a listing slug does not reset views". But §11.4's `BoatListing` field list — which is the normative one for field names — contains **no** slug column, and no spec section says how a listing slug is derived. Rather than invent one, this phase uses the listing UUID, exactly as spec §30.1's own API inventory does (`GET /api/v1/listings/<id>/`). Whichever phase implements the public Next.js boat detail route (Phase 20/21, which also owns SEO and redirects per §32.2) adds a slug column and a slug-to-UUID resolver. The "direct slug" half of the definition of done is proved here at the identifier level: a non-published listing returns `404` for every caller, including its own owner, so no public URL scheme can reach it.

**Note (ruling — the `finance` key is omitted, not stubbed):** spec §18.5 says an ineligible listing returns `"finance": {"visible": false}`. Emitting that unconditionally here would be *wrong* for an eligible broker listing (`show_finance_estimate=true`), and computing the real value needs `FinanceQuoteService` from spec Phase 8/9. The key is therefore absent from this phase's response, and Phase 9 adds it. A client that does not find the key must render no finance block, which is the same outcome §18.2 demands ("remove the entire estimated-payment column, calculator CTA and disclosure").

**Note (ruling — localized content is returned as a per-locale object):** the serializer returns `"title": {"en": …, "it": …, "es": …}` and the same for `description`, rather than negotiating a language server-side. No spec section defines server-side locale negotiation for listing content, spec §37 requires EN/IT/ES keys throughout, and the client already knows the user's locale (`User.locale`, spec §11.1; `GET /api/v1/session/`, Phase 3).

**Note (ruling — the owner's private preview is not built here):** spec §32.2 says "Pending/rejected/draft private listings return 404 to guests and include `noindex` where an authenticated private preview exists". This phase returns `404` to **everyone**, owner included, on the public endpoints; the owner's view of their own draft is the workflow response `ListingWorkflowSerializer` already returns from every mutation, and the seller dashboard that lists them is Phase 16. Since no authenticated private preview URL exists yet, the `noindex` clause has nothing to attach to. Recorded in Known Limitations.

- [ ] **Step 1: Write the failing tests**

`backend/listings/tests/test_public_read_api.py`:

```python
import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from listings.enums import ListingStatus, MediaStatus, MediaType, RevisionStatus
from listings.tests.factories import (
    make_media,
    make_private_listing,
    make_revision,
    make_snapshot,
)


@pytest.fixture
def api():
    return APIClient()


def _owner():
    return make_user(primary_role=UserRole.PRIVATE_SELLER, is_email_verified=True)


def _published(owner=None, **snapshot_kwargs):
    owner = owner or _owner()
    listing = make_private_listing(owner=owner, status=ListingStatus.PUBLISHED)
    image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY)
    snapshot = make_snapshot(
        listing,
        approved_by=make_user(),
        media_manifest=[{
            "media_id": str(image.pk), "media_type": MediaType.IMAGE,
            "storage_key": image.storage_key, "mime_type": image.mime_type,
            "sort_order": 0, "width": image.width, "height": image.height,
            "duration_seconds": None, "checksum_sha256": image.checksum_sha256,
        }],
        **snapshot_kwargs,
    )
    listing.current_public_snapshot = snapshot
    listing.published_at = timezone.now()
    listing.save(update_fields=["current_public_snapshot", "published_at"])
    return listing, snapshot


@pytest.mark.django_db
def test_a_guest_sees_a_published_listing(api):
    listing, snapshot = _published()

    response = api.get(reverse("listing-detail", kwargs={"listing_id": listing.pk}))

    assert response.status_code == 200
    assert response.data["id"] == str(listing.pk)
    assert response.data["title"]["en"] == snapshot.title_en
    assert response.data["price"] == {"amount": "125000.00", "currency": "EUR"}
    assert response.data["brand_name"] == snapshot.brand_name_snapshot
    assert response.data["snapshot_version"] == 1
    assert response.data["view_count"] == 0
    assert len(response.data["media"]) == 1


@pytest.mark.django_db
def test_the_response_never_exposes_a_finance_block_in_this_phase(api):
    listing, _ = _published()

    response = api.get(reverse("listing-detail", kwargs={"listing_id": listing.pk}))

    assert "finance" not in response.data


@pytest.mark.django_db
def test_a_draft_listing_is_not_publicly_readable(api):
    listing = make_private_listing(owner=_owner())

    response = api.get(reverse("listing-detail", kwargs={"listing_id": listing.pk}))

    assert response.status_code == 404


@pytest.mark.django_db
def test_a_pending_listing_is_not_publicly_readable_even_by_its_owner(api):
    owner = _owner()
    listing = make_private_listing(owner=owner, status=ListingStatus.PENDING_APPROVAL)
    make_revision(
        listing, state=RevisionStatus.SUBMITTED, submitted_by=owner,
        submitted_at=timezone.now(),
    )
    api.force_authenticate(owner)

    response = api.get(reverse("listing-detail", kwargs={"listing_id": listing.pk}))

    assert response.status_code == 404


@pytest.mark.django_db
def test_a_suspended_listing_disappears_from_public_reads(api):
    listing, _ = _published()
    listing.status = ListingStatus.SUSPENDED
    listing.save(update_fields=["status"])

    detail = api.get(reverse("listing-detail", kwargs={"listing_id": listing.pk}))
    listing_page = api.get(reverse("listing-list"))

    assert detail.status_code == 404
    assert listing_page.data["count"] == 0


@pytest.mark.django_db
def test_an_expired_listing_disappears_from_public_reads(api):
    listing, _ = _published()
    listing.status = ListingStatus.EXPIRED
    listing.save(update_fields=["status"])

    assert api.get(reverse("listing-list")).data["count"] == 0


@pytest.mark.django_db
def test_a_published_row_without_a_snapshot_is_invisible(api):
    """Defence in depth: status alone never makes a listing public."""
    listing = make_private_listing(owner=_owner(), status=ListingStatus.PUBLISHED)

    detail = api.get(reverse("listing-detail", kwargs={"listing_id": listing.pk}))

    assert detail.status_code == 404
    assert api.get(reverse("listing-list")).data["count"] == 0


@pytest.mark.django_db
def test_the_list_returns_only_published_listings_newest_first(api):
    older, _ = _published()
    newer, _ = _published()
    newer.published_at = timezone.now()
    newer.save(update_fields=["published_at"])
    older.published_at = timezone.now() - timezone.timedelta(days=1)
    older.save(update_fields=["published_at"])
    make_private_listing(owner=_owner())  # a draft that must not appear

    response = api.get(reverse("listing-list"))

    assert response.data["count"] == 2
    assert [row["id"] for row in response.data["results"]] == [
        str(newer.pk), str(older.pk),
    ]


@pytest.mark.django_db
def test_a_pending_edit_does_not_change_the_public_content(api):
    listing, snapshot = _published()
    owner = listing.owner_user
    make_revision(
        listing, base_snapshot=snapshot,
        payload={"price": "1.00", "title_en": "Not approved yet"},
        state=RevisionStatus.SUBMITTED, submitted_by=owner, submitted_at=timezone.now(),
    )
    listing.price = None
    listing.save(update_fields=["price"])

    response = api.get(reverse("listing-detail", kwargs={"listing_id": listing.pk}))

    assert response.data["title"]["en"] == snapshot.title_en
    assert response.data["price"]["amount"] == "125000.00"
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd backend
uv run pytest listings/tests/test_public_read_api.py -v
```

Expected: collection `ERROR` — `NoReverseMatch: Reverse for 'listing-detail' not found.`

- [ ] **Step 3: Implement the serializer**

Append to `backend/listings/serializers.py`:

```python
class PublicListingSerializer(serializers.Serializer):
    """Public representation, built ENTIRELY from the approved snapshot.

    Spec §11.4: "Public pages read from `current_public_snapshot`, not mutable
    draft fields."

    Deliberately absent: the `finance` block (spec §18.5 — Phase 9) and CDN media
    URLs (spec §24 — Phase 15). Those phases extend this serializer; they do not
    add a second public representation (spec §29.1).
    """

    def to_representation(self, listing):
        snapshot = listing.current_public_snapshot
        return {
            "id": str(listing.pk),
            "seller_type": listing.seller_type,
            "snapshot_version": snapshot.version,
            "published_at": listing.published_at,
            "expires_at": listing.expires_at,
            "brand_name": snapshot.brand_name_snapshot,
            "model_name": snapshot.model_name_snapshot,
            "custom_model_name": snapshot.custom_model_name_snapshot,
            "manufacture_year": snapshot.manufacture_year_snapshot,
            "title": {
                "en": snapshot.title_en,
                "it": snapshot.title_it,
                "es": snapshot.title_es,
            },
            "description": {
                "en": snapshot.description_en,
                "it": snapshot.description_it,
                "es": snapshot.description_es,
            },
            "specifications": snapshot.specifications,
            "specifications_schema_version": snapshot.specifications_schema_version,
            "location": {
                "country": snapshot.location_country,
                "region": snapshot.location_region,
                "city": snapshot.location_city,
            },
            # Spec §30.2: money as decimal strings.
            "price": {
                "amount": f"{snapshot.price:f}",
                "currency": snapshot.currency,
            },
            "media": snapshot.media_manifest,
            "view_count": listing.view_count_cached,
        }
```

- [ ] **Step 4: Implement the views and routes**

Append to `backend/listings/views.py`:

```python
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny

from .enums import ListingStatus
from .serializers import PublicListingSerializer


def published_listings_queryset():
    """The single definition of "publicly visible" (spec §20 definition of done).

    Both conditions are required: a listing is public only when staff moved it to
    PUBLISHED *and* an approved snapshot exists to serve. Later phases must reuse
    this helper rather than re-deriving the filter.
    """
    return (
        BoatListing.objects.filter(
            status=ListingStatus.PUBLISHED, current_public_snapshot__isnull=False
        )
        .select_related("current_public_snapshot")
        .order_by("-published_at", "-created_at")
    )


class PublicListingPagination(PageNumberPagination):
    page_size = 24
    page_size_query_param = "page_size"
    max_page_size = 96


class PublicListingListView(ListAPIView):
    """GET /api/v1/listings/ — public listing cards (spec §30.1)."""

    permission_classes = [AllowAny]
    authentication_classes = []
    pagination_class = PublicListingPagination
    serializer_class = PublicListingSerializer

    def get_queryset(self):
        return published_listings_queryset()


class PublicListingDetailView(RetrieveAPIView):
    """GET /api/v1/listings/<id>/ — public detail (spec §30.1).

    Returns 404 for anything not published, including to the listing's owner:
    the owner's view of their own work comes from the workflow endpoints.
    """

    permission_classes = [AllowAny]
    authentication_classes = []
    serializer_class = PublicListingSerializer
    lookup_url_kwarg = "listing_id"

    def get_queryset(self):
        return published_listings_queryset()
```

Append to `backend/listings/urls.py` — **after** the `listings/drafts/` route so the literal path is matched first:

```python
from .views import PublicListingDetailView, PublicListingListView

urlpatterns += [
    path("listings/", PublicListingListView.as_view(), name="listing-list"),
    path(
        "listings/<uuid:listing_id>/",
        PublicListingDetailView.as_view(),
        name="listing-detail",
    ),
]
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd backend
uv run pytest listings/tests/test_public_read_api.py -v
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/listings
git commit -m "feat(listings): add snapshot-only public read endpoints that cannot leak pending listings"
```

---

### Task 15: Phase acceptance tests, full regression and the handoff note

**Files:**
- Create: `backend/listings/tests/test_phase_acceptance.py`
- Modify: `ACTIVITY.md`

**Interfaces:**
- Consumes: every service and endpoint built in Tasks 1–14.
- Produces: an executable proof of spec §20's definition of done, spec §40 Scenario I, and the two §34.2 concurrency cases that belong to this phase.

**Note (how the concurrency test works without threads):** spec §34.2 requires "Two staff decisions on one revision yield one success and one conflict." Running two real database connections concurrently inside pytest-django is fragile; the deterministic equivalent — and the one that actually proves the mechanism — is to capture the version a first moderator read, let a second moderator complete their decision, and then replay the first moderator's original request. That is exactly the "two browser tabs" scenario spec §20.5 describes, and it exercises the same compare-and-swap. The `select_for_update()` in `_locked_submitted_revision` handles the true-simultaneity case by serializing the transactions; the compare-and-swap is what makes the loser fail rather than overwrite.

- [ ] **Step 1: Write the acceptance tests**

`backend/listings/tests/test_phase_acceptance.py`:

```python
"""Spec §20 definition of done, §40 Scenario I, §34.2 concurrency."""

import pytest
from django.contrib.auth.models import Group
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from audit.models import AuditEvent
from listings.enums import ListingStatus, MediaStatus, MediaType, RevisionStatus
from listings.models import BoatListing, ListingRevision, ListingSnapshot
from listings.tests.factories import make_brand, make_media, make_model
from platform_settings.services import set_feature_flag


@pytest.fixture
def workflow_enabled(db):
    set_feature_flag(key="listing_revisions", is_enabled=True, actor=None)


@pytest.fixture
def api():
    return APIClient()


def _seller():
    return make_user(primary_role=UserRole.PRIVATE_SELLER, is_email_verified=True)


def _moderator():
    user = make_user(primary_role=UserRole.STAFF, is_email_verified=True)
    user.groups.add(Group.objects.get(name=StaffGroup.MODERATOR))
    return user


def _create_and_submit(api, seller):
    """Draft -> ready media -> complete payload -> submit. Returns (listing, revision)."""
    brand = make_brand("Beneteau")
    model = make_model(brand, "Oceanis 46.1")
    api.force_authenticate(seller)

    created = api.post(
        reverse("listing-draft-create"),
        {
            "brand_id": str(brand.pk),
            "model_id": str(model.pk),
            "manufacture_year": 2020,
        },
        format="json",
    )
    assert created.status_code == 201
    listing = BoatListing.objects.get(pk=created.data["id"])
    image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY)

    patched = api.patch(
        reverse("listing-draft-update", kwargs={"listing_id": listing.pk}),
        {
            "version": created.data["revision"]["version"],
            "title_en": "Oceanis 46.1, one owner",
            "description_en": "Full service history.",
            "specifications": {"length_m": "14.6"},
            "location_country": "IT",
            "location_city": "Genoa",
            "price": "125000.00",
            "currency": "EUR",
            "media_ids": [str(image.pk)],
        },
        format="json",
    )
    assert patched.status_code == 200

    submitted = api.post(
        reverse("listing-submit", kwargs={"listing_id": listing.pk}),
        {"version": patched.data["revision"]["version"]},
        format="json",
    )
    assert submitted.status_code == 200
    listing.refresh_from_db()
    return listing, ListingRevision.objects.get(pk=submitted.data["revision"]["id"])


@pytest.mark.django_db
def test_done_1_no_pending_private_listing_leaks_through_the_public_api(api, workflow_enabled):
    seller = _seller()
    listing, _ = _create_and_submit(api, seller)

    guest = APIClient()
    detail = guest.get(reverse("listing-detail", kwargs={"listing_id": listing.pk}))
    listing_page = guest.get(reverse("listing-list"))

    assert listing.status == ListingStatus.PENDING_APPROVAL
    assert detail.status_code == 404
    assert listing_page.data["count"] == 0
    # ...and not even to the owner's own authenticated public request.
    assert api.get(
        reverse("listing-detail", kwargs={"listing_id": listing.pk})
    ).status_code == 404


@pytest.mark.django_db
def test_done_2_locked_field_manipulation_fails_server_side(api, workflow_enabled):
    """Spec §40 Scenario I, first half."""
    seller = _seller()
    listing, revision = _create_and_submit(api, seller)
    api.force_authenticate(_moderator())
    api.post(
        reverse("staff-revision-decision", kwargs={"revision_id": revision.pk}),
        {"decision": "APPROVE", "version": revision.version},
        format="json",
    )
    listing.refresh_from_db()
    original_year = listing.manufacture_year

    api.force_authenticate(seller)
    response = api.patch(
        reverse("listing-draft-update", kwargs={"listing_id": listing.pk}),
        {"version": listing.version, "manufacture_year": 1999},
        format="json",
    )

    assert response.status_code == 400
    assert "manufacture_year" in response.data["error"]["fields"]
    listing.refresh_from_db()
    assert listing.manufacture_year == original_year
    assert listing.current_public_snapshot.manufacture_year_snapshot == original_year


@pytest.mark.django_db
def test_done_3_old_public_content_survives_a_rejected_edit(api, workflow_enabled):
    """Spec §40 Scenario I, second half, plus spec §20.2."""
    seller = _seller()
    listing, revision = _create_and_submit(api, seller)
    moderator = _moderator()
    api.force_authenticate(moderator)
    api.post(
        reverse("staff-revision-decision", kwargs={"revision_id": revision.pk}),
        {"decision": "APPROVE", "version": revision.version},
        format="json",
    )
    listing.refresh_from_db()

    api.force_authenticate(seller)
    edited = api.patch(
        reverse("listing-draft-update", kwargs={"listing_id": listing.pk}),
        {"version": listing.version, "price": "99000.00",
         "description_en": "Reduced for a quick sale."},
        format="json",
    )
    assert edited.status_code == 200
    guest = APIClient()
    while_pending = guest.get(reverse("listing-detail", kwargs={"listing_id": listing.pk}))
    assert while_pending.data["price"]["amount"] == "125000.00"

    submitted = api.post(
        reverse("listing-submit", kwargs={"listing_id": listing.pk}),
        {"version": edited.data["revision"]["version"]},
        format="json",
    )
    assert submitted.status_code == 200
    still_live = guest.get(reverse("listing-detail", kwargs={"listing_id": listing.pk}))
    assert still_live.data["price"]["amount"] == "125000.00"

    second_revision_id = submitted.data["revision"]["id"]
    api.force_authenticate(moderator)
    api.post(
        reverse("staff-revision-decision", kwargs={"revision_id": second_revision_id}),
        {"decision": "REJECT", "version": submitted.data["revision"]["version"],
         "note": "Price is not credible."},
        format="json",
    )

    after_rejection = guest.get(reverse("listing-detail", kwargs={"listing_id": listing.pk}))
    listing.refresh_from_db()
    assert listing.status == ListingStatus.PUBLISHED
    assert after_rejection.data["price"]["amount"] == "125000.00"
    assert after_rejection.data["snapshot_version"] == 1
    assert ListingSnapshot.objects.filter(listing=listing).count() == 1


@pytest.mark.django_db
def test_done_3b_an_approved_edit_publishes_the_next_snapshot(api, workflow_enabled):
    seller = _seller()
    listing, revision = _create_and_submit(api, seller)
    moderator = _moderator()
    api.force_authenticate(moderator)
    api.post(
        reverse("staff-revision-decision", kwargs={"revision_id": revision.pk}),
        {"decision": "APPROVE", "version": revision.version}, format="json",
    )
    listing.refresh_from_db()

    api.force_authenticate(seller)
    edited = api.patch(
        reverse("listing-draft-update", kwargs={"listing_id": listing.pk}),
        {"version": listing.version, "price": "99000.00"}, format="json",
    )
    submitted = api.post(
        reverse("listing-submit", kwargs={"listing_id": listing.pk}),
        {"version": edited.data["revision"]["version"]}, format="json",
    )
    api.force_authenticate(moderator)
    api.post(
        reverse(
            "staff-revision-decision",
            kwargs={"revision_id": submitted.data["revision"]["id"]},
        ),
        {"decision": "APPROVE", "version": submitted.data["revision"]["version"]},
        format="json",
    )

    public = APIClient().get(reverse("listing-detail", kwargs={"listing_id": listing.pk}))
    assert public.data["price"]["amount"] == "99000.00"
    assert public.data["snapshot_version"] == 2
    assert ListingSnapshot.objects.filter(listing=listing).count() == 2


@pytest.mark.django_db
def test_done_4_every_decision_records_actor_note_and_timestamps(api, workflow_enabled):
    seller = _seller()
    listing, revision = _create_and_submit(api, seller)
    moderator = _moderator()
    api.force_authenticate(moderator)

    api.post(
        reverse("staff-revision-decision", kwargs={"revision_id": revision.pk}),
        {"decision": "REQUEST_CHANGES", "version": revision.version,
         "note": "Add an interior photo."},
        format="json",
    )

    event = AuditEvent.objects.get(action="listing.revision_changes_requested")
    assert event.actor_user_id == moderator.pk
    assert event.actor_type == AuditEvent.ActorType.USER
    assert event.metadata["note"] == "Add an interior photo."
    assert event.created_at is not None
    assert event.after["decided_at"] is not None
    revision.refresh_from_db()
    assert revision.decided_by_id == moderator.pk
    assert revision.decided_at is not None
    assert revision.decision_note == "Add an interior photo."


@pytest.mark.django_db
def test_34_2_two_staff_decisions_on_one_revision_yield_one_success_and_one_conflict(
    api, workflow_enabled
):
    seller = _seller()
    listing, revision = _create_and_submit(api, seller)
    # Both moderators opened the queue and read the same version.
    version_both_read = revision.version

    first = APIClient()
    first.force_authenticate(_moderator())
    second = APIClient()
    second.force_authenticate(_moderator())

    first_response = first.post(
        reverse("staff-revision-decision", kwargs={"revision_id": revision.pk}),
        {"decision": "APPROVE", "version": version_both_read}, format="json",
    )
    second_response = second.post(
        reverse("staff-revision-decision", kwargs={"revision_id": revision.pk}),
        {"decision": "REJECT", "version": version_both_read, "note": "Duplicate."},
        format="json",
    )

    assert first_response.status_code == 200
    assert second_response.status_code == 409
    revision.refresh_from_db()
    assert revision.state == RevisionStatus.APPROVED
    assert ListingSnapshot.objects.filter(listing=listing).count() == 1


@pytest.mark.django_db
def test_20_5_two_browser_tabs_cannot_silently_overwrite_each_other(api, workflow_enabled):
    seller = _seller()
    brand = make_brand("Jeanneau")
    api.force_authenticate(seller)
    created = api.post(
        reverse("listing-draft-create"),
        {"brand_id": str(brand.pk), "model_id": str(make_model(brand).pk),
         "manufacture_year": 2020},
        format="json",
    )
    listing_id = created.data["id"]
    version_both_tabs_read = created.data["revision"]["version"]

    tab_one = api.patch(
        reverse("listing-draft-update", kwargs={"listing_id": listing_id}),
        {"version": version_both_tabs_read, "title_en": "Written by tab one"},
        format="json",
    )
    tab_two = api.patch(
        reverse("listing-draft-update", kwargs={"listing_id": listing_id}),
        {"version": version_both_tabs_read, "title_en": "Written by tab two"},
        format="json",
    )

    assert tab_one.status_code == 200
    assert tab_two.status_code == 409
    assert tab_two.data["error"]["code"] == "stale_version"
    assert tab_two.data["error"]["meta"]["current_version"] == version_both_tabs_read + 1
    revision = ListingRevision.objects.get(listing_id=listing_id)
    assert revision.payload["title_en"] == "Written by tab one"
```

- [ ] **Step 2: Run the acceptance tests**

```bash
cd backend
uv run pytest listings/tests/test_phase_acceptance.py -v
```

Expected: all tests PASS. If any fails, fix the *implementation*, not the test — each one is a verbatim definition-of-done item.

- [ ] **Step 3: Run the full backend regression and confirm no migration drift**

```bash
cd backend
uv run python manage.py check
uv run python manage.py makemigrations --check --dry-run
uv run pytest -v
```

Expected: `System check identified no issues`; `No changes detected`; every test in `common`, `audit`, `platform_settings`, `finance`, `taxonomy`, `accounts`, `brokers`, `professionals` and `listings` passes in one run. Record the exact final count (`N passed`) — it goes in the handoff note.

- [ ] **Step 4: Write the phase handoff note**

Add a new entry at the top of `ACTIVITY.md`'s `## Log` section, matching the format of the existing entries and covering every item spec §39's "Required phase handoff note" demands:

```markdown
### 2026-09-18 — Phase 11 (listing workflow, revisions and immutable fields) complete

- Implemented `docs/superpowers/plans/2026-09-18-phase-11-listing-workflow.md` in full (Tasks 1-15).
- New `listings` app: `BoatListing`, `ListingSnapshot` (immutable, versioned public content), `ListingRevision` (one open revision per listing, DB-enforced) and `ListingMedia` (model only — the upload/scan/transcode pipeline is Phase 15).
- Migrations added: `listings/0001_*` (BoatListing), `0002_*` (ListingMedia), `0003_*` (ListingSnapshot + ListingRevision + `boatlisting.current_public_snapshot`), `0004_seed_listing_revisions_flag` (data). All additive; the data migration is reversible and idempotent.
- New endpoints: `POST /api/v1/listings/drafts/`, `PATCH /api/v1/listings/<id>/draft/`, `POST /api/v1/listings/<id>/submit/`, `POST /api/v1/listings/<id>/withdraw/`, `POST /api/v1/staff/revisions/<id>/decision/`, `GET /api/v1/listings/`, `GET /api/v1/listings/<id>/`.
- Permissions: mutations require `IsAuthenticated + IsActiveUser + IsEmailVerified + ListingWorkflowEnabled` and object-level `IsOwnerOrBrokerEditor`; staff decisions require `IsStaffModerator`; public reads are `AllowAny` and serve only approved snapshots.
- Audit events added: `listing.submitted`, `listing.revision_withdrawn`, `listing.revision_approved`, `listing.revision_changes_requested`, `listing.revision_rejected`, `listing.correction_revision_created`, `listing.suspended`, `listing.unsuspended`.
- Optimistic locking: an integer `version` on `BoatListing` and `ListingRevision`, sent as a required `version` body field, checked by a conditional `UPDATE`, returning `409 stale_version` with `meta.current_version`. `common.exceptions.nauta_exception_handler` gained a generic `meta` passthrough for this.
- Feature flag state: `listing_revisions` seeded **disabled**; every mutation endpoint returns `403 feature_disabled` until staff enable it.
- Tests added: <N> in `backend/listings/tests/`, including spec §20's four definition-of-done items, §40 Scenario I and §34.2's "two staff decisions yield one success and one conflict". Full backend suite: <TOTAL> passed.
- Known limitations (all documented in the plan): entitlement consumption is a stub that always allows (Phase 13); broker auto-approval is never read, so every submission requires approval (Phase 12); media allowance uses the base tier only and there is no upload pipeline (Phase 15); no `finance` block on listing responses (Phase 9); no listing slug or public preview URL (Phase 20/21); no `Idempotency-Key` replay store (Phase 14); notifications are emitted as Django signals with no receivers (Phase 18).
- Next: Phase 12 (broker auto-approval) and Phase 13 (individual quota and entitlement ledger) both unblock from here; Phase 9 (finance card UI) needs this phase's listing model plus Phase 8's finance engine.
```

Replace `<N>` and `<TOTAL>` with the real numbers from Step 3. Do not write the note before the suite is green — spec §39 step 9 requires demonstrating the definition of done "with verifiable test output".

- [ ] **Step 5: Commit**

```bash
git add backend/listings ACTIVITY.md
git commit -m "test(listings): add Phase 11 acceptance tests and record the phase handoff note"
```

---

## Known Limitations (carried forward, not fixed by this plan)

Each item names the phase that closes it. None of them breaks a MUST requirement *of this phase* (spec §39: "Any known limitation that breaks a MUST requirement prevents completion") — every one is a requirement the spec itself assigns to a later phase.

1. **Entitlement consumption is a stub.** `listings.policies.ListingEntitlementGate.can_submit()` always returns `True` and `.consume()` writes a `publication_source` without reserving or consuming a ledger row, so `BoatListing.consumed_entitlement_id` is always `NULL`. → **Phase 13** (spec §22), which replaces the class body with `ListingEligibilityService` and converts `consumed_entitlement_id` into a real FK.
2. **Broker auto-approval is never read.** `listings.policies.requires_staff_approval()` returns `True` unconditionally, so a broker with `auto_approve_listings=true` still goes through moderation, and `ListingStatus.DRAFT → PUBLISHED` is in the transition map but unreachable. → **Phase 12** (spec §21).
3. **Media is a model without a pipeline.** No upload intent endpoint, signed URL, checksum verification against real bytes, malware scan, dimension/duration validation, transcode, derivative generation or stale-reservation cleanup. `ListingMedia.status` is written directly by tests and Django admin. The private-seller media *upgrade* tier (20 images / 1 video) is unreachable, so a private seller is held to the base 1 image / 0 videos. → **Phase 15** (spec §24), with the upgrade entitlement from **Phases 13/14**.
4. **No `finance` block on listing responses.** `BoatListing` stores `show_finance_estimate` and the three override columns and the payload validator refuses them for private sellers, but no endpoint computes or returns an estimate. → **Phase 9** (spec §18).
5. **No view counting.** `BoatListing.view_count_cached` is serialized as-is and nothing in this phase writes to it. → **Phase 10** (spec §19).
6. **No listing slug and no authenticated private preview URL.** Public detail is addressed by UUID (`GET /api/v1/listings/<id>/`, spec §30.1), and a non-published listing returns `404` to everyone including its owner, so spec §32.2's "include `noindex` where an authenticated private preview exists" has nothing to attach to yet. → **Phase 20/21** (spec §29, §32).
7. **No `Idempotency-Key` replay store.** Spec §30.3 asks for one on listing submit and staff decisions. Duplicate submissions and repeated decision clicks are refused by state + optimistic locking (`409`), which satisfies spec §26.2's "repeated click cannot create multiple snapshots", but a replayed request does not return the original response body. → **Phase 14**, whose Stripe Checkout creation is the mechanism's first real consumer.
8. **Notifications have no receivers.** Eight `django.dispatch.Signal`s fire after commit (including spec §13.4's `listing.other_model_submitted`, which Phase 4 deferred here), but nothing listens, so no in-app row, WebSocket frame or email is produced. → **Phase 18** (spec §27).
9. **No moderation queue endpoint.** `GET /api/v1/staff/moderation/` (spec §30.1), moderator assignment, before/after diff, media diff, bulk actions and the Other-model queue are absent; only the decision endpoint exists. Suspension has fully audited services (`suspend_listing`/`unsuspend_listing`) but no route. → **Phase 17** (spec §26).
10. **No expiry task.** `ListingStatus.EXPIRED` is in the enum and in the transition map, and `expires_at` is calculated correctly on first publication, but nothing marks due listings expired or sends the 7-day/1-day reminders. → **Phase 13** (spec §22.5).
11. **No "contact preference" field.** Spec §20.2 lists it among editable fields, but no such field exists in the spec's own data model (§11.4), so the payload schema has none. → whichever phase owns contact policy (spec §11.8 / Phase 7), if the field is ever specified.
12. **No rate limit on listing mutations.** Spec §30.4's enumerated list does not include them, and unbounded draft creation is closed by Phase 13's entitlement gate (`403 listing_entitlement_required` on `POST /api/v1/listings/drafts/`, spec §22.4). → **Phase 13**, or **Phase 22** if a broader limit is wanted.
13. **No staff taxonomy-mapping transaction.** Spec §13.3's "Create model and map listing" / "Map to existing model" flows are not built; this phase provides the mechanism they need (`create_staff_correction_revision`, which may touch the immutable taxonomy fields and produces a new audited snapshot on approval). → **Phase 17**.
14. **No frontend.** `/sell/`, `/sell/create/`, the role-aware form, field-locking UI, autosave, the staff moderation screens and the public boat detail page are all Next.js work. This plan is backend-only, matching the Django-headless architecture recorded in `ACTIVITY.md`. → **Phases 16, 17, 20**.

---

## Contract summary for later phases

Everything a downstream phase imports from Phase 11, in one place.

```python
from listings.decisions import (
    approve_revision,
    create_staff_correction_revision,
    reject_revision,
    request_revision_changes,
    suspend_listing,
    unsuspend_listing,
)
from listings.drafts import (
    InvalidWorkflowState,
    create_listing_draft,
    open_revision_for,
    payload_from_snapshot,
    update_listing_draft,
)
from listings.enums import (
    LISTING_TRANSITIONS,
    REVISION_TRANSITIONS,
    ListingStatus,
    MediaStatus,
    MediaType,
    PublicationSource,
    RevisionOrigin,
    RevisionStatus,
    can_transition_listing,
    can_transition_revision,
)
from listings.locking import StaleVersionConflict, bump_version
from listings.models import BoatListing, ListingMedia, ListingRevision, ListingSnapshot
from listings.payloads import (
    IMMUTABLE_FIELD_NAMES,
    SPECIFICATIONS_SCHEMA_VERSION,
    allowed_payload_fields,
    is_locked_for_owner,
    validate_revision_payload,
)
from listings.permissions import ListingWorkflowEnabled
from listings.policies import (
    ListingEntitlementGate,
    MediaAllowance,
    effective_media_allowance,
    media_counts,
    requires_staff_approval,
)
from listings.serializers import PublicListingSerializer
from listings.signals import (
    listing_initial_submitted,
    listing_other_model_submitted,
    listing_published,
    listing_revision_approved,
    listing_revision_changes_requested,
    listing_revision_rejected,
    listing_revision_submitted,
    listing_revision_withdrawn,
)
from listings.snapshots import build_media_manifest, create_snapshot_from_revision
from listings.views import published_listings_queryset
```

Rules a later phase must follow:

1. **Never read a listing's draft columns on a public path.** Public content comes from `listing.current_public_snapshot` only (spec §11.4). Use `listings.views.published_listings_queryset()` as the definition of "publicly visible"; do not re-derive the `status=PUBLISHED AND current_public_snapshot IS NOT NULL` filter.
2. **Never write `BoatListing.status`, `ListingRevision.state`, `published_at`, `expires_at` or `current_public_snapshot` directly.** Go through `listings.drafts` / `listings.submissions` / `listings.decisions`, all of which hold the transaction, the lock, the version compare-and-swap and the audit event together.
3. **Never mutate a `ListingSnapshot`.** `save()` and `QuerySet.update()` both raise. To change public content, create the next version through `approve_revision`.
4. **Every state-changing endpoint takes a `version` in its body** and returns the new one (spec §20.5, §30.2). Use `listings.locking.bump_version`; do not hand-roll a read-modify-write.
5. **Phase 12** changes exactly one function body: `listings.policies.requires_staff_approval`. When it starts returning `False`, `listings.submissions.submit_listing_revision` needs the auto-approval branch that is deliberately absent today — publish directly by calling into the same snapshot-creation path `approve_revision` uses, so an auto-approved listing is validated identically (spec §21: "Invalid listing never publishes even when auto-approval is on").
6. **Phase 13** changes exactly one class body: `listings.policies.ListingEntitlementGate`. It must also convert `BoatListing.consumed_entitlement_id` (a loose `UUIDField`) into a real FK to `UserEntitlement`, and set it inside `submit_listing_revision`'s existing transaction.
7. **Phase 15** changes exactly one function body: `listings.policies.effective_media_allowance`. `listings.submissions.validate_submission_media` already enforces READY-only and non-rejected counting and needs no change.
8. **Phase 18** connects receivers to `listings.signals`. Do not add notification calls inside the services; every signal already fires inside `transaction.on_commit()`.
9. **Phase 9** extends `listings.serializers.PublicListingSerializer` with the `finance` block. Do not create a second public listing representation (spec §29.1: "Every boat card uses one component and one API representation").
10. **Any new listing-related error code must be stable and documented** in this plan's Global Constraints list, and any exception needing extra response context sets a dict attribute named `meta` (the envelope passthrough added in Task 6).

---

## Self-Review

**1. Spec coverage — §20 (Phase 11), line by line:**

| Spec §20 requirement | Where implemented |
|---|---|
| §20.1.1 User saves draft | Tasks 8, 9 (`POST /listings/drafts/`, `PATCH /listings/<id>/draft/`) |
| §20.1.2 Validate eligibility and reserve/choose entitlement | Task 7 (`ListingEntitlementGate`, stub by controller ruling) + Task 10 (call site) |
| §20.1.3 Media must be READY and within allowance | Task 10 (`validate_submission_media`), Task 7 (`effective_media_allowance`, `media_counts`) |
| §20.1.4 Submit atomically consumes entitlement and creates PENDING_APPROVAL state | Task 10 (`submit_listing_revision`, one `transaction.atomic()`) |
| §20.1.5 Listing is not publicly queryable | Task 14 (`published_listings_queryset`), Task 15 acceptance test 1 |
| §20.1.6 Staff notified after commit | Task 10 (`listing_initial_submitted` / `listing_revision_submitted` via `transaction.on_commit`); receivers are Phase 18 |
| §20.1.7 Staff approves, requests changes or rejects | Tasks 11, 12 |
| §20.1.8 Approval creates snapshot v1, sets published_at, calculates expires_at, publishes | Task 11 (`approve_revision`) |
| §20.2 Brand/model/custom/year locked in backend | Task 5 (`immutable_after_publication`), Task 9, Task 15 acceptance test 2 |
| §20.2 Editable: price, description, specifications, location, media | Task 5 (`CONTENT_FIELDS`); "contact preference" ruled out of scope (no such field in the data model) |
| §20.2 Save as draft stays private | Task 9 + Task 14 (public reads serve snapshots only) |
| §20.2 Submit → SUBMITTED, staff notified | Task 10 |
| §20.2 Existing approved snapshot remains live | Task 11, Task 15 acceptance test 3 |
| §20.2 "Your approved version remains visible…" copy | Frontend (Phase 16); the reserved key `listing.approved_version_live` is named in Global Constraints |
| §20.2 Approval creates next snapshot and makes it current atomically | Task 11, Task 15 acceptance test 3b |
| §20.2 Rejection leaves the approved snapshot untouched | Task 11 (`_refuse`), Task 15 acceptance test 3 |
| §20.3 Seller cannot edit immutable fields | Task 5, Task 9 |
| §20.3 Staff admin may create a correction revision | Task 13 (`create_staff_correction_revision`) |
| §20.3 Requires a note and audit event | Task 13 (`_require_note`, `listing.correction_revision_created`) |
| §20.3 Approval generates a new snapshot; history immutable | Task 13 test, Task 4 (`ListingSnapshot.save()` raises) |
| §20.4 Broker auto-approval publishes immediately | **Phase 12** by controller ruling; seam in Task 7 |
| §20.4 Otherwise broker submissions require approval, old snapshot stays live | Tasks 10, 11 (brokers take the same path as private sellers) |
| §20.4 Non-substantive auto-publish fields | Not implemented — spec says "default is that all public content fields are substantive", which is what this phase does; enumerating exceptions is Phase 12's staff-configurable list |
| §20.5 Optimistic locking, 409 with current version metadata | Task 6, Task 15 acceptance test `test_20_5_two_browser_tabs…` |
| Done 1 — no pending private listing leaks | Task 14, Task 15 test 1 |
| Done 2 — locked field manipulation fails server-side | Task 5, Task 15 test 2 |
| Done 3 — old public content survives rejected edits | Task 11, Task 15 test 3 |
| Done 4 — every decision records actor, note and timestamps | Task 11, Task 13, Task 15 test 4 |

**2. Spec coverage — cross-referenced sections:** §6.1 and §6.2 state machines → Task 1 (with two documented readings recorded as rulings). §11.4's `BoatListing` (all 21 listed fields) → Task 2; `ListingSnapshot` (all listed fields, with `title_*`/`description_*`/`location fields` expanded by ruling) → Task 4; `ListingRevision` (all listed fields plus `origin` and `version`) → Task 4. §11.5's `ListingMedia` (all 13 listed fields) → Task 3. §11.4's "Only fields explicitly allowed by role… `immutable_after_publication`" → Task 5 verbatim. §13.4's `listing.other_model_submitted` (deferred to this phase by the Phase 4 plan) → Task 10. §25.1's policy-capability payload → Task 8 (`policy` block). §26.2's four decision rules → Tasks 11, 12 and the Task 4 database constraint. §30.1's six listing endpoints → Tasks 8, 9, 10, 12, 14. §30.2's envelope, decimal-string money and "mutations return updated resource/version" → Tasks 6, 8, 12. §34.1's "Listing/revision transitions" and "Immutable field validation" → Tasks 1, 5. §34.2's "Two staff decisions on one revision yield one success and one conflict" → Task 15. §34.3's "Pending listing is absent publicly" and "Validation/error codes are stable" → Tasks 14, 15 and the Global Constraints code list. §35.1's `listing_revisions` flag → Task 8. §36.4's four moderation rules → Tasks 10 (withdraw), 11 (request-changes chain), 13 (suspend). §36.5's "Primary image is the first ready image by explicit order" → Task 11 (`build_media_manifest`) and Task 3's per-type sort-order uniqueness. §40 Scenario I → Task 15.

**Gaps deliberately left, with the owning phase named:** §20.1.2/§20.1.4's real entitlement consumption (Phase 13), §20.4's auto-approval (Phase 12), §20.4's enumerated non-substantive fields (Phase 12), the §37 copy keys (Phase 16 frontend), and everything in Known Limitations above. No spec §20 requirement is unaccounted for.

**3. Placeholder scan:** no task contains "TBD", "TODO", "implement later", "add appropriate error handling", "handle edge cases", "similar to Task N", or a test described but not written. Every code step carries the real code. The three stubbed *policies* (Tasks 7) are not placeholders in the §39 sense: each is a complete, tested function with the correct return type and a docstring naming the phase that replaces it, and none of them leaves a backend rule unenforced — they choose a conservative answer (always require approval, always allow submission, apply the base allowance) rather than skipping a check. The signals in Task 10 are a working mechanism, not empty functions.

**4. Type and name consistency (checked across every task's Interfaces block):**
- `bump_version(instance, *, expected_version, resource, **updates)` — same signature in Tasks 6, 9, 10, 11, 13.
- `validate_revision_payload(payload, *, listing, origin, for_submission)` — same in Tasks 5, 8, 9, 10, 11, 13.
- `open_revision_for(listing)` — same in Tasks 8, 9, 10, 13.
- `payload_from_snapshot(snapshot)` — created private as `_payload_from_snapshot` in Task 9 and renamed public in Task 13, which is called out explicitly in Task 13's Step 3 and re-tested there.
- `InvalidWorkflowState` — defined once (Task 9), imported by Tasks 10, 11, 13.
- `validate_submission_media(listing, media_ids)` — defined in Task 10, reused unchanged by Task 11's `approve_revision`.
- `create_snapshot_from_revision(*, listing, revision, cleaned_payload, approved_by, approved_at)` — Task 11's definition and its single call site agree (note the `cleaned_payload` argument, which the Interfaces block in Task 11 lists).
- Error codes are a closed set, listed once in Global Constraints and used verbatim in Tasks 5, 6, 8, 9, 10, 11, 12, 13.
- Enum member names (`ListingStatus.PENDING_APPROVAL`, `RevisionStatus.CHANGES_REQUESTED`, `RevisionOrigin.STAFF_CORRECTION`, `MediaStatus.READY`, `PublicationSource.FREE_ENTITLEMENT`) are identical everywhere they appear.
- Route names (`listing-draft-create`, `listing-draft-update`, `listing-submit`, `listing-withdraw`, `staff-revision-decision`, `listing-list`, `listing-detail`) are identical in the URL definitions and in every test's `reverse()` call.
