# NAUTA Phase 12 — Broker Unlimited Listings and Auto-Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `BrokerOrganization.auto_approve_listings` actually govern publication — a broker whose staff-admin-enabled policy is on publishes a valid submission straight to an immutable snapshot without waiting for a moderator, while every validation, media-allowance, suspension and moderation control still applies — and give staff the audited, reason-bearing controls to turn that policy on/off and to bulk-approve a broker's existing pending backlog.

**Architecture:** Phase 11 built the whole draft → submit → decision → snapshot workflow and left exactly one seam for this phase: `listings.policies.requires_staff_approval()`, which returns `True` unconditionally today. This plan (a) gives that function a real body that reads the broker organization's policy, (b) extracts Phase 11's publication core out of `listings.decisions.approve_revision` into a new module, `listings/publication.py`, so the staff-approval path and the auto-approval path are literally the same code, and (c) adds the staff-facing policy surface — one audited service, three staff endpoints and one Next.js staff screen — in the **`brokers`** app rather than in `listings`, so this phase's footprint inside `listings/` stays as small as a phase that changes publication semantics can be. There is no new model, no new migration and no new feature flag.

**Tech Stack:** Python 3.13 + `uv`, Django 5.2, Django REST Framework, PostgreSQL 16 (Postgres on `127.0.0.1:5433`), Redis (`127.0.0.1:6380`); **Next.js 16.3.5** (App Router, TypeScript), **Tailwind CSS v4**, `pnpm`, Vitest + Testing Library. No new third-party dependencies in either project.

**Spec:** [`NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md`](../../../NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md) — **§21 (Phase 12, the primary and authoritative source: Rules, Staff broker UI, Acceptance tests)**, plus §1 (fixed product decisions), §2.2/§2.3/§2.4 (server authority, atomic state changes, auditability), §5 (only staff admin may "Configure broker auto-approval"), §6.1 (`DRAFT → PUBLISHED` edge), §10.2 (audit event), §11.1 (`BrokerOrganization` / `BrokerMembership` fields, and "Only staff admin can change `auto_approve_listings`. Broker users may see the current policy but cannot change it."), §11.4/§11.5 (listing, snapshot, revision, media), §20.1 step 8 and §20.4 (broker listing edits under auto-approval), §20.5 (optimistic locking), §26.2 (decision rules), §26 definition of done ("Product, policy, broker approval and taxonomy actions are audited"), §30.1 (`PATCH /api/v1/staff/brokers/<id>/approval-policy/`), §30.2 (response envelope), §31 (UI-to-backend traceability), §34.1–§34.3 (test classes), §35.1 (feature-flag list), §37 (localization keys), §39 (developer execution protocol).

**Predecessor plans (read before starting — this plan does not restate their contracts, it obeys them):**

- [`2026-09-18-phase-11-listing-workflow.md`](./2026-09-18-phase-11-listing-workflow.md) — **hard dependency, fully merged into `dev`.** Its "Contract summary for later phases" is binding. In particular **its rule 5 is this phase's charter**:
  > *"**Phase 12** changes exactly one function body: `listings.policies.requires_staff_approval`. When it starts returning `False`, `listings.submissions.submit_listing_revision` needs the auto-approval branch that is deliberately absent today — publish directly by calling into the same snapshot-creation path `approve_revision` uses, so an auto-approved listing is validated identically (spec §21: 'Invalid listing never publishes even when auto-approval is on')."*

  Its rules 1, 2, 3, 4, 10 and 12 are equally binding and are quoted where they bite. Its Known Limitation 14 names this phase as the one that introduces a caller-supplied target state into the listing state machine.
- [`2026-09-17-phase-3-identity-organizations-permissions.md`](./2026-09-17-phase-3-identity-organizations-permissions.md) — defines `brokers.models.BrokerOrganization` (including `auto_approve_listings`, `auto_approve_changed_by`, `auto_approve_changed_at` and the `brokers_auto_approve_actor_requires_timestamp` check constraint), `brokers.models.BrokerMembership`, `accounts.services.is_staff_admin`/`is_staff_moderator`/`active_broker_membership`, `accounts.permissions.IsStaffAdmin`/`IsStaffModerator`, `accounts.selectors.get_session_permissions` (which already emits the `configure_broker_auto_approval` key) and `brokers.services.set_broker_auto_approval`, whose own docstring hands this phase two named jobs: the PATCH endpoint and the `AuditEvent`.
- [`2026-09-18-phase-5-directory-consolidation.md`](./2026-09-18-phase-5-directory-consolidation.md) — **structural template** for this document, and the source of the frontend patterns reused here: the typed EN/IT/ES message dictionary with a `t(locale, key)` accessor (`frontend/src/lib/i18n/directory.ts`), the per-domain API module, and Vitest + Testing Library component tests.

**Phase dependencies:** spec §7 and `docs/superpowers/PHASE-TRACKER.md` — Phase 12 depends on Phase 11 only, and Phase 11 is **done** (all 15 tasks plus a whole-branch review merged to `dev`). Nothing here depends on Phase 13 (entitlements), Phase 14 (Stripe), Phase 15 (media pipeline), Phase 17 (staff moderation queue) or Phase 18 (notifications); each of those appears below only as a named seam.

---

## Prerequisite check (run before Task 1)

```bash
cd backend
uv run python -c "import listings.publication" 2>&1 | head -1   # expect ModuleNotFoundError — this phase creates it
uv run python -c "from listings.policies import requires_staff_approval; import inspect; print(inspect.getsource(requires_staff_approval))"
uv run python -c "from brokers.services import set_broker_auto_approval; import inspect; print(inspect.getsource(set_broker_auto_approval))"
```

The second command must print a function whose body is `return True`, and the third must print a service that takes `(broker, *, enabled, actor)` and writes **no** audit event. If either has already changed, Phase 12 has been started by someone else — stop and reconcile before continuing. Then confirm the baseline is green:

```bash
cd backend && uv run pytest -q
cd ../frontend && pnpm test
```

---

## Global Constraints

Exact values copied from the spec. Every task's requirements implicitly include this section.

### Spec §21's rules, verbatim (the whole of this phase's behavioural contract)

1. "Broker organizations have no numeric listing quota in this release."
2. "'Unlimited' does not bypass validation, moderation, suspension, media limits or abuse controls."
3. "`auto_approve_listings=false` by default for migrated/new brokers unless staff explicitly enables it."
4. "Only staff admin may toggle policy; change requires a reason."
5. "Enabling policy affects future submissions, not currently pending submissions automatically."
6. "Disabling policy affects future submissions; current published listings stay live unless moderated."
7. "Staff may bulk approve existing pending broker submissions as a separate explicit action with confirmation and audit."

And spec §20.4, which Phase 11 explicitly deferred to this phase: "If broker auto-approval is on, valid create/edit submissions publish a new snapshot immediately." / "Staff may define clearly enumerated non-substantive fields that auto-publish, but default is that all public content fields are substantive."

### Platform constraints

- Backend: Python 3.13 + `uv` for every dependency/command, Django 5.2, DRF for every JSON API, PostgreSQL 16 and Redis from the repo's `docker-compose.yml` (Postgres `127.0.0.1:5433`, Redis `127.0.0.1:6380`).
- Backend dev server runs on port **8020**; frontend dev server on **3020** (standing Phase 0/1 ruling — 8000/3000 are occupied on this machine).
- **Use PostgreSQL in tests, never SQLite.** `backend/config/settings/test.py` MUST NOT be modified to override `DATABASES` or `CACHES` to SQLite/LocMem. This rule has been violated and reverted in this project before. This phase depends on it: `select_for_update(of=("self",))`, partial unique constraints and `CheckConstraint`s are all load-bearing here and none behave correctly on SQLite.
- **Version-drift check before writing any App Router code:** the frontend is Next.js **16.3.5** with Tailwind **v4**, not the 15.x a model's training data assumes (`frontend/AGENTS.md` flags this). `params` is a **Promise** in this version and every dynamic page in this plan awaits it. Verify any App Router API against `frontend/node_modules/next/package.json` and the installed types rather than from memory.
- All primary keys are UUIDs; all timestamps are timezone-aware UTC (spec §11 preamble). **This phase adds no model and no migration** — see the ruling below.
- **Atomic state changes** (spec §2.3): every operation that publishes, changes policy or bulk-approves runs inside `transaction.atomic()`, locks the rows it decides on with `select_for_update()`, and schedules every notification through `transaction.on_commit()`.
- **Auditability** (spec §2.4, §26 definition of done): every policy toggle, every auto-approval publication and every bulk-approve run writes an `audit.models.AuditEvent` through `audit.services.record_audit_event()` **inside the same `transaction.atomic()` block** as the change it describes. Its exact current signature (real code in `backend/audit/services.py`, do not guess):

  ```python
  record_audit_event(
      *, actor_user, actor_type: str, action: str, target_type: str, target_id: str,
      source: str, before: dict | None = None, after: dict | None = None,
      request_id: str | None = None, metadata: dict | None = None, ip_hash: str | None = None,
  ) -> AuditEvent
  ```

  `actor_type` takes values from `AuditEvent.ActorType` (`USER` | `SYSTEM` | `STRIPE`) and `source` from `AuditEvent.Source` (`WEB` | `API` | `ADMIN` | `TASK` | `WEBHOOK`).
- **Server authority** (spec §2.2): `seller_type`, `owner_user` and `broker` are never read from a request body; the policy flag is never read from a request body except on the one staff-admin endpoint that exists to change it.
- **Error envelope** (spec §30.2): every error response is rendered by `common.exceptions.nauta_exception_handler` as `{"error": {"code", "message", "fields", "request_id"}}`, plus an optional `meta` key when the exception defines a non-empty dict attribute named `meta`. **New stable machine codes introduced by this phase** (they are persisted in client code and must never be renamed): `policy_reason_required` (a staff broker-policy action — the toggle *or* the bulk approve — was sent without a reason) and `bulk_approve_not_confirmed`. Codes reused unchanged from Phase 11 and Phase 3: `stale_version`, `stale_base_snapshot`, `invalid_revision_state`, `invalid_listing_state`, `media_not_ready`, `media_allowance_exceeded`, `validation_error`, `staff_admin_required`, `staff_moderator_required`, `feature_disabled`, `not_found`.
- **New audit `action` values introduced by this phase** (stable; they are queried by the staff audit-history panel and must never be renamed): `broker.auto_approval_changed`, `listing.revision_auto_approved`, `broker.pending_revisions_bulk_approved`.
- **Feature flag:** this phase adds **no** new flag. Spec §35.1's list is closed and contains no broker-policy flag; `listing_revisions` already gates every listing mutation endpoint and gates the new staff endpoints too. See the ruling below.
- **Rate limiting** uses `common.throttling.HashedIPScopedRateThrottle` (installed as `DEFAULT_THROTTLE_CLASSES` because spec §30.4 forbids raw client IPs in throttle cache keys). Views in this plan declare **only** `throttle_scope`, never `throttle_classes`. This phase adds no new throttle scope — spec §30.4's enumerated list does not include staff endpoints, and every new endpoint requires a staff group.
- **No partial or visual-only implementations, no faked data, no TODO placeholders for backend enforcement** (spec §39). Nothing in this phase is hidden with CSS: the auto-approval switch is disabled *and* the API refuses a non-staff-admin caller, and the acceptance tests prove both halves.
- **Localization** (spec §37): all new UI text has EN/IT/ES keys in a typed dictionary; no English is hard-coded inside components. Backend responses emit stable machine codes and staff-authored free text only — no new English UI copy is invented in a JSON response.
- TDD per task: write the failing test, run it and read the failure, write the minimal implementation, run it and see it pass, commit.
- **Every settings and urls edit in this plan is additive.** `backend/config/urls.py` already carries merged entries from Phases 0/1, 2, 3, 4, 5, 8 and 11. Read the real file, add to it, never paste over it. (This phase needs **no** `config/urls.py` edit at all — see the ruling below.)
- **Where a task says "append to" an existing module, its code block repeats the imports that block needs.** Consolidate them into the module's single import section at the top rather than leaving mid-file `import` statements — `brokers/views.py`, `brokers/serializers.py` and `brokers/urls.py` each grow across three tasks.

---

## Scope rulings

Spec §21 is short and sits between two unbuilt neighbours (Phase 13's entitlement ledger, Phase 17's staff dashboard). Every boundary is ruled explicitly here so no task has to guess. Each is written into the plan as a "Note (ruling — …)" at the point it bites, and repeated here for the reviewer.

**Note (ruling — no new model, no new migration, no new field).**
Spec §11.1 already gives `BrokerOrganization` the three columns this phase needs (`auto_approve_listings bool default false`, `auto_approve_changed_by nullable FK User`, `auto_approve_changed_at nullable`), and Phase 3 **already built all three**, plus the `brokers_auto_approve_actor_requires_timestamp` check constraint. Spec §21 rule 3 ("`auto_approve_listings=false` by default for migrated/new brokers") is therefore already satisfied by `models.BooleanField(default=False)` in merged code — this phase proves it with a test rather than re-declaring it. "Listing counts by status" (Staff broker UI item 2) is an aggregate query, not a denormalized column: spec §2.1 requires every visible state to have a real backend source, and §26's definition of done requires "All visible counters equal query results", which a cached counter cannot guarantee. Consequently **no task in this plan runs `makemigrations`**, and a reviewer seeing a new migration file should reject the task.

**Note (ruling — the publication core moves to a new module, `listings/publication.py`).**
Phase 11's contract rule 5 says the auto-approval branch must "publish directly by calling into the same snapshot-creation path `approve_revision` uses". That path is currently ~70 lines inlined in `listings.decisions.approve_revision`. Calling `approve_revision` itself from `submit_listing_revision` is impossible: `approve_revision` opens its own `transaction.atomic()`, re-takes `select_for_update()` locks the submit transaction already holds, and refuses any revision that is not already `SUBMITTED` — and inverting the module dependency would create a cycle, because `decisions.py` already imports `validate_submission_media` from `submissions.py`. The core therefore moves down into a new leaf module that both import: `listings/publication.py`, exporting `publish_revision()` and `guard_base_snapshot()`. Task 1 is that extraction as a **pure refactor with zero behaviour change**, proven by Phase 11's existing suite staying green with no test edits. The alternative — a second, parallel publication path inside `submissions.py` — is exactly what spec §21's acceptance test "Invalid listing never publishes even when auto-approval is on" is designed to catch, and is forbidden here.

**Note (ruling — the staff policy surface lives in the `brokers` app, not in `listings`).**
The three new endpoints are all `.../staff/brokers/<id>/...`: they read and write `BrokerOrganization`. Putting them in `brokers/` keeps this phase's `listings/` footprint to three files (`policies.py`, `submissions.py`, `signals.py`) plus the one extraction, which matters because Phases 9 and 10 are being planned in parallel against the same app. The import direction is the safe one: **`brokers` may import `listings`; `listings` must never import `brokers` at module level.** `listings.policies.requires_staff_approval` reads `listing.broker.auto_approve_listings` through the FK attribute and imports nothing from `brokers`. The bulk-approve service, which does need `listings.decisions`, goes in a brand-new module `brokers/moderation.py` rather than in `brokers/services.py`, because `brokers/services.py` is imported by `brokers/admin.py` at admin-autodiscover time and `accounts/services.py` documents a real app-loading cycle in that neighbourhood — a new leaf module has no such exposure.

**Note (ruling — no `config/urls.py` edit; the new routes join `brokers/urls.py`.)**
`backend/config/urls.py` already does `path("api/v1/", include("brokers.urls"))`. All three new routes are declared in `brokers/urls.py` and need no project-level change. This is deliberate: `config/urls.py` is the single file most likely to conflict with the Phase 9 and Phase 10 plans being written in parallel.

**Note (ruling — no new feature flag).**
Spec §35.1 enumerates nine flags and none of them is a broker-policy flag. Inventing `broker_auto_approval` would contradict a closed list and would add a tenth rollout switch nobody has planned a rollout for. The existing `listing_revisions` flag already gates every listing mutation (Phase 11's `ListingWorkflowEnabled`), so with it off there are no submissions to auto-approve; the three new staff endpoints declare the same `ListingWorkflowEnabled` permission, because the policy toggle and the bulk approve are both mutations of listing-workflow behaviour and §35.1 requires flags to "gate both frontend exposure and backend mutation". The read-only staff detail endpoint is **not** flag-gated: refusing to *show* a policy state would tell staff nothing and hide the audit history during an incident.

**Note (ruling — `decided_by` on an auto-approved revision is the submitting user, not the staff admin who enabled the policy).**
`ListingRevision`'s `listings_revision_decided_requires_decision_stamps` check constraint makes `decided_by` and `decided_at` mandatory on an `APPROVED` row, and `ListingSnapshot.approved_by` is a non-nullable FK. So auto-approval must name somebody. The three candidates are: (a) the staff admin who last toggled the policy — rejected, because they did not see this listing and attributing this decision to them is a false audit trail; (b) `NULL` — impossible without dropping a database constraint that exists to guarantee §20's "Every decision records actor, note and timestamps"; (c) **the submitting user** — chosen. Under auto-approval the organization's own submission *is* the decision; the staff admin's grant of that power is recorded separately and permanently in the `broker.auto_approval_changed` audit event. Ambiguity is removed by making the auto path write a **different** audit action (`listing.revision_auto_approved`, never `listing.revision_approved`) with `metadata.auto_approved = True` and `metadata.broker_id`, and by `publication_source = BROKER_POLICY` on the listing row. **Flagged for human review**: if the project prefers a dedicated system actor, that is a `User` row that does not exist today and would be a Phase 3 addition.

**Note (ruling — spec §21 rule 1 is proved, not coded).**
"Broker organizations have no numeric listing quota in this release" cannot be *implemented* because no quota code exists: Phase 11's `ListingEntitlementGate.can_submit()` returns `True` for everyone and Phase 13 (§22) is the phase that introduces counting, for individuals only. Writing a `BROKER_LISTING_QUOTA = None` constant that nothing compares against would be the placeholder spec §39 forbids. This phase therefore discharges rule 1 two ways, both real: **(a)** an acceptance test that a broker organization genuinely creates, submits and publishes its **101st** listing with no failure (Task 10), and **(b)** a unit test pinning `ListingEntitlementGate.can_submit(user=..., broker=<org>) is True` plus a binding contract rule (below) requiring Phase 13 to preserve the broker branch when it replaces that class body. `listings/policies.py` is not otherwise edited for rule 1.

**Note (ruling — spec §20.4's "clearly enumerated non-substantive fields" are not built).**
§20.4 permits staff to define a list of non-substantive fields that auto-publish even without auto-approval, and in the same sentence fixes the default: "default is that all public content fields are substantive." This phase implements the default and nothing else. A staff-editable field allowlist is a `PlatformSetting` plus a staff screen plus a per-field diff engine, all of which are spec §26's staff-operations surface (Phase 17), and none of which §21 asks for. Recorded in Known Limitations.

**Note (ruling — the staff broker screen is built; the staff dashboard shell and navigation are not).**
Spec §21's "Staff broker UI" section enumerates six concrete items, so it is a deliverable, not a seam, and Tasks 7–9 build it at `/dashboard/staff/brokers/<brokerId>/` (matching §26.1's fully-written `/dashboard/staff/products/` and `/dashboard/staff/taxonomy/`). What is **not** built: a staff dashboard home, a broker index/search page, and any navigation entry. Spec §26.1 assigns staff navigation to Phase 17 and warns "Do not scatter one workflow across unrelated dashboards", and Phase 3's contract rule 11 forbids adding a nav link in a commit that does not create its target. The screen is therefore reachable by direct URL and by whatever Phase 17's moderation queue links to it — recorded in Known Limitations, not hidden.

**Note (ruling — bulk approve is gated on staff *moderator*, not staff admin).**
§21 rule 4 restricts the **policy toggle** to staff admin, and §5's capability table lists "Configure broker auto-approval" as staff-admin-only. §21 rule 7 says only "Staff may bulk approve", and §5 gives "Approve listings/revisions" to staff moderator **and** staff admin. Bulk approve is approving listings — many at once — so it takes the moderator gate, `IsStaffModerator` (which Phase 3's `is_staff_moderator()` already admits staff admins through). The "explicit action with confirmation and audit" §21 demands is enforced server-side as a required `confirm: true` body field plus a required non-blank `reason`, not merely as a browser modal.

**Note (ruling — the broker row is not locked while reading its policy at submit time).**
`submit_listing_revision` reads `listing.broker.auto_approve_listings` under the listing's own `select_for_update(of=("self",))`. It deliberately does **not** lock the `BrokerOrganization` row: doing so would serialize every concurrent submission across a large broker organization behind one row lock, in exchange for closing a microsecond-wide race whose two outcomes are *both* spec-compliant — §21 rules 5 and 6 say the policy affects "future submissions", and a submission landing in the same instant as the toggle is, by definition, on the boundary. What *is* guaranteed and tested: a submission that has already reached `PENDING_APPROVAL` is never retro-approved by a later toggle (rule 5), and a published listing is never unpublished by a later toggle (rule 6).

---

## Execution Model

Per the standing project convention recorded in `ACTIVITY.md` and repeated in every earlier plan: each task is implemented on its own branch off the current tip of `dev` (`git checkout -b phase12-task-N-<slug> dev`), run through `subagent-driven-development`'s implementer → task-reviewer → fix-loop cycle, opened as a PR (`gh pr create`), and merged by the controller only when the CI workflow (`.github/workflows/ci.yml`) is green and the branch is cleanly mergeable. Tasks run strictly sequentially — never two branches in flight at once — and each new task branches from the just-merged `dev` tip (run `git fetch && git merge origin/dev --ff-only` first; the Phase 4 retrospective records a real bug caused by branching a worktree off a stale local `dev`).

**Ordering constraint that is not negotiable:** Task 1 (pure refactor) must merge before Task 2 (the policy + auto-approval branch), and Task 2 must merge as **one** commit. Landing the new `requires_staff_approval` body without the `else` branch in `submit_listing_revision` would leave a broker submission in a broken intermediate state — listing `DRAFT`, revision `SUBMITTED`, nothing published, no moderator queue entry. Tasks 1 and 2 are split because a pure refactor and a semantic change deserve separate reviewer gates; they are **not** independently deployable.

---

## Cross-phase conflict surface (for the controller merging Phases 9, 10 and 12)

Phases 9 and 10 are being planned in parallel against the same `listings` app. This plan touches exactly these already-merged files, and nothing else inside `backend/listings/`:

| File | What this phase does to it | Task |
|---|---|---|
| `backend/listings/decisions.py` | **Removes** ~65 lines from the body of `approve_revision` (the base-snapshot guard, revision bump, snapshot creation, listing bump, audit event and signal emission) and replaces them with one `publish_revision(...)` call. `_refuse`, `request_revision_changes`, `reject_revision`, `create_staff_correction_revision`, `suspend_listing`, `unsuspend_listing` and `_locked_submitted_revision` are **untouched**. Imports change. | 1 |
| `backend/listings/publication.py` | **New file.** | 1 |
| `backend/listings/policies.py` | Replaces the body of `requires_staff_approval` (7 lines → 20). `ListingEntitlementGate`, `effective_media_allowance`, `media_counts` and `MediaAllowance` are **untouched**. | 2 |
| `backend/listings/submissions.py` | Adds `.select_for_update(of=("self",)).select_related("broker")` to the one row fetch at the top of `submit_listing_revision`, and adds an `else:` branch to the existing `if requires_staff_approval(listing):`. `validate_submission_media` and `withdraw_listing_revision` are **untouched**. | 2 |
| `backend/listings/signals.py` | Docstring only: records that `listing_revision_approved` now also carries an `auto_approved: bool` kwarg. No signal added or removed. | 2 |
| `backend/listings/tests/factories.py` | Adds nothing; Task 2 imports `brokers.tests.factories.make_broker` instead. **Untouched.** | — |

Files this phase **does not** touch, and which Phases 9 and 10 are expected to: `listings/models.py`, `listings/serializers.py`, `listings/views.py`, `listings/urls.py`, `listings/migrations/`, `listings/enums.py`, `listings/payloads.py`, `listings/locking.py`, `listings/drafts.py`, `listings/snapshots.py`, `listings/admin.py`, `backend/config/urls.py`, `backend/config/settings/base.py`.

Test files inside `backend/listings/tests/` that this plan does modify: `test_policies.py` (Task 2 appends a block) and the two new files `test_publication.py` and `test_auto_approval.py`. Every other Phase 11 test file must stay **byte-identical** — Tasks 1 and 2 both state that an existing test needing a change means the change is wrong.

Two files **outside** `listings/` that another plan might also want: `backend/accounts/selectors.py` (Task 4 adds one key to `get_broker_memberships`'s dict) and `frontend/src/lib/auth/types.ts` (Task 4 adds the matching field to `BrokerMembershipSummary`). Everything else this phase writes in `backend/brokers/`, `frontend/src/components/staff/`, `frontend/src/lib/api/staffBrokers.ts`, `frontend/src/lib/i18n/staff-brokers.ts` and `frontend/src/app/dashboard/` is new.

---

## File Structure

```
nautelo/
├── ACTIVITY.md                                                        (modify: Task 10)
├── docs/superpowers/plans/2026-09-18-phase-12-broker-policy.md        (this file)
├── backend/
│   ├── accounts/
│   │   ├── selectors.py                                               (modify: Task 4 — one dict key)
│   │   └── tests/test_session.py                                      (modify: Task 4 — one test)
│   ├── brokers/
│   │   ├── moderation.py                                              (new: Task 6)
│   │   ├── selectors.py                                               (new: Task 4)
│   │   ├── services.py                                                (modify: Task 3 — reason + audit; Task 5 — message constant)
│   │   ├── admin.py                                                   (modify: Task 3 — mandatory reason form)
│   │   ├── forms.py                                                   (new: Task 3)
│   │   ├── serializers.py                                             (modify: Tasks 4, 5, 6)
│   │   ├── views.py                                                   (modify: Tasks 4, 5, 6)
│   │   ├── urls.py                                                    (modify: Tasks 4, 5, 6)
│   │   └── tests/
│   │       ├── test_auto_approval_service.py                          (new: Task 3)
│   │       ├── test_services.py                                       (modify: Task 3 — new signature)
│   │       ├── test_admin.py                                          (modify: Task 3)
│   │       ├── test_staff_broker_detail_api.py                        (new: Task 4)
│   │       ├── test_approval_policy_api.py                            (new: Task 5)
│   │       ├── test_bulk_approve.py                                   (new: Task 6)
│   │       └── test_phase_12_acceptance.py                            (new: Task 10)
│   └── listings/
│       ├── publication.py                                             (new: Task 1)
│       ├── decisions.py                                               (modify: Task 1)
│       ├── policies.py                                                (modify: Task 2)
│       ├── submissions.py                                             (modify: Task 2)
│       ├── signals.py                                                 (modify: Task 2 — docstring)
│       └── tests/
│           ├── test_publication.py                                    (new: Task 1)
│           ├── test_policies.py                                       (modify: Task 2)
│           └── test_auto_approval.py                                  (new: Task 2)
└── frontend/
    └── src/
        ├── app/dashboard/staff/brokers/[brokerId]/
        │   ├── page.tsx                                               (new: Task 7)
        │   └── page.test.tsx                                          (new: Task 7)
        ├── components/staff/
        │   ├── StaffBrokerDetailView.tsx    + .test.tsx               (new: Task 7; modified Tasks 8, 9)
        │   ├── BrokerOverviewPanel.tsx      + .test.tsx               (new: Task 7)
        │   ├── AutoApprovalPanel.tsx        + .test.tsx               (new: Task 8)
        │   ├── ConfirmPolicyChangeDialog.tsx + .test.tsx              (new: Task 8)
        │   ├── BrokerAuditHistory.tsx       + .test.tsx               (new: Task 9)
        │   └── BulkApprovePanel.tsx         + .test.tsx               (new: Task 9)
        ├── lib/api/staffBrokers.ts                                    (new: Task 7; modified Tasks 8, 9)
        ├── lib/i18n/staff-brokers.ts                                  (new: Task 7; modified Tasks 8, 9)
        └── lib/auth/types.ts                                          (modify: Task 4 — one field)
```

---

### Task 1: Extract Phase 11's publication core into `listings/publication.py`

Pure refactor. No behaviour change, no new endpoint, no migration. Phase 11's entire existing test suite must stay green **with no edits to any existing test file** — that is the proof the extraction is faithful.

**Files:**
- Create: `backend/listings/publication.py`
- Create: `backend/listings/tests/test_publication.py`
- Modify: `backend/listings/decisions.py` (the import block, and the body of `approve_revision` only)

**Interfaces:**
- Consumes (all already merged): `listings.drafts.InvalidWorkflowState`, `listings.enums.ListingStatus`, `listings.enums.RevisionStatus`, `listings.locking.bump_version`, `listings.models.BoatListing`/`ListingRevision`/`ListingSnapshot`, `listings.policies.ListingEntitlementGate.publication_days`, `listings.signals.listing_published`/`listing_revision_approved`, `listings.snapshots.create_snapshot_from_revision`, `audit.services.record_audit_event`, `audit.models.AuditEvent`.
- Produces:
  - `listings.publication.guard_base_snapshot(listing: BoatListing, revision: ListingRevision) -> None` — raises `InvalidWorkflowState(code="stale_base_snapshot")` carrying a `meta` dict `{"resource": "snapshot", "current_version": int | None}`.
  - `listings.publication.publish_revision(*, listing: BoatListing, revision: ListingRevision, actor, cleaned: dict, expected_revision_version: int, note: str = "", auto_approved: bool = False, publication_source: str | None = None) -> ListingSnapshot`
  - `listings.decisions.approve_revision` keeps its exact public signature `(*, revision_id, actor, expected_version: int, note: str = "") -> ListingRevision`.

- [ ] **Step 1: Write the failing test**

Create `backend/listings/tests/test_publication.py`:

```python
"""listings.publication is the single path from an approved revision to public
content. Both callers (a staff APPROVE decision and a spec §21 broker
auto-approval) go through publish_revision, so these tests exercise it directly.
"""

import pytest
from django.db import transaction
from django.utils import timezone

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from audit.models import AuditEvent
from listings.drafts import InvalidWorkflowState
from listings.enums import (
    ListingStatus,
    MediaStatus,
    MediaType,
    PublicationSource,
    RevisionStatus,
)
from listings.models import ListingSnapshot
from listings.publication import guard_base_snapshot, publish_revision
from listings.tests.factories import (
    make_media,
    make_private_listing,
    make_revision,
    make_snapshot,
)


def _seller(email="publication-seller@example.com"):
    return make_user(email, role=UserRole.PRIVATE_SELLER, verified=True)


def _staff(email="publication-staff@example.com"):
    return make_user(email, role=UserRole.STAFF, verified=True)


def _cleaned(media_id):
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


def _submitted_revision(listing, actor, media_id, **kwargs):
    return make_revision(
        listing,
        state=RevisionStatus.SUBMITTED,
        payload=_cleaned(media_id),
        submitted_by=actor,
        submitted_at=timezone.now(),
        **kwargs,
    )


@pytest.mark.django_db
def test_publish_revision_publishes_a_first_publication():
    owner = _seller()
    staff = _staff()
    listing = make_private_listing(owner=owner, status=ListingStatus.PENDING_APPROVAL)
    image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY)
    revision = _submitted_revision(listing, owner, image.pk)

    snapshot = publish_revision(
        listing=listing,
        revision=revision,
        actor=staff,
        cleaned=_cleaned(image.pk),
        expected_revision_version=revision.version,
        note="Looks good.",
    )

    listing.refresh_from_db()
    revision.refresh_from_db()
    assert snapshot.version == 1
    assert listing.status == ListingStatus.PUBLISHED
    assert listing.current_public_snapshot_id == snapshot.pk
    assert listing.published_at is not None
    assert revision.state == RevisionStatus.APPROVED
    assert revision.decided_by_id == staff.pk
    assert revision.decision_note == "Looks good."


@pytest.mark.django_db
def test_publish_revision_leaves_the_listing_status_alone_after_first_publication():
    owner = _seller()
    staff = _staff()
    listing = make_private_listing(owner=owner, status=ListingStatus.PUBLISHED)
    first = make_snapshot(listing, approved_by=staff, version=1)
    listing.current_public_snapshot = first
    listing.published_at = timezone.now()
    listing.save(update_fields=["current_public_snapshot", "published_at"])
    image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY)
    revision = _submitted_revision(listing, owner, image.pk, base_snapshot=first)
    published_at = listing.published_at

    snapshot = publish_revision(
        listing=listing,
        revision=revision,
        actor=staff,
        cleaned=_cleaned(image.pk),
        expected_revision_version=revision.version,
    )

    listing.refresh_from_db()
    assert snapshot.version == 2
    assert listing.status == ListingStatus.PUBLISHED
    assert listing.published_at == published_at
    assert ListingSnapshot.objects.filter(listing=listing).count() == 2


@pytest.mark.django_db
def test_publish_revision_refuses_a_superseded_base_snapshot():
    owner = _seller()
    staff = _staff()
    listing = make_private_listing(owner=owner, status=ListingStatus.PUBLISHED)
    stale = make_snapshot(listing, approved_by=staff, version=1)
    current = make_snapshot(listing, approved_by=staff, version=2)
    listing.current_public_snapshot = current
    listing.save(update_fields=["current_public_snapshot"])
    image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY)
    revision = _submitted_revision(listing, owner, image.pk, base_snapshot=stale)

    with pytest.raises(InvalidWorkflowState) as exc_info:
        publish_revision(
            listing=listing,
            revision=revision,
            actor=staff,
            cleaned=_cleaned(image.pk),
            expected_revision_version=revision.version,
        )

    assert exc_info.value.get_codes() == "stale_base_snapshot"
    assert exc_info.value.meta == {"resource": "snapshot", "current_version": 2}


@pytest.mark.django_db
def test_guard_base_snapshot_allows_an_initial_revision_with_no_base():
    owner = _seller()
    listing = make_private_listing(owner=owner)
    image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY)
    revision = _submitted_revision(listing, owner, image.pk)

    assert guard_base_snapshot(listing, revision) is None


@pytest.mark.django_db
def test_a_staff_publication_writes_the_revision_approved_audit_action():
    owner = _seller()
    staff = _staff()
    listing = make_private_listing(owner=owner, status=ListingStatus.PENDING_APPROVAL)
    image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY)
    revision = _submitted_revision(listing, owner, image.pk)

    publish_revision(
        listing=listing,
        revision=revision,
        actor=staff,
        cleaned=_cleaned(image.pk),
        expected_revision_version=revision.version,
        note="Approved.",
    )

    event = AuditEvent.objects.get(target_id=str(revision.pk))
    assert event.action == "listing.revision_approved"
    assert event.metadata["auto_approved"] is False
    assert event.metadata["first_publication"] is True
    assert event.metadata["broker_id"] is None


@pytest.mark.django_db
def test_an_auto_approved_publication_writes_a_distinct_audit_action():
    """The auto-approval *caller* arrives in Task 2; the flag and its audit and
    publication_source consequences are built and proved here, where the code
    lives."""
    owner = _seller()
    listing = make_private_listing(owner=owner, status=ListingStatus.DRAFT)
    image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY)
    revision = _submitted_revision(listing, owner, image.pk)

    publish_revision(
        listing=listing,
        revision=revision,
        actor=owner,
        cleaned=_cleaned(image.pk),
        expected_revision_version=revision.version,
        auto_approved=True,
        publication_source=PublicationSource.BROKER_POLICY,
    )

    listing.refresh_from_db()
    event = AuditEvent.objects.get(target_id=str(revision.pk))
    assert event.action == "listing.revision_auto_approved"
    assert event.metadata["auto_approved"] is True
    assert listing.status == ListingStatus.PUBLISHED
    assert listing.publication_source == PublicationSource.BROKER_POLICY


@pytest.mark.django_db(transaction=True)
def test_the_approved_signal_reports_whether_the_publication_was_automatic():
    from listings.signals import listing_revision_approved

    seen = []

    def receiver(sender, revision, auto_approved=False, **kwargs):
        seen.append(auto_approved)

    listing_revision_approved.connect(receiver)
    try:
        owner = _seller()
        listing = make_private_listing(owner=owner, status=ListingStatus.DRAFT)
        image = make_media(
            listing, media_type=MediaType.IMAGE, status=MediaStatus.READY
        )
        revision = _submitted_revision(listing, owner, image.pk)
        with transaction.atomic():
            publish_revision(
                listing=listing,
                revision=revision,
                actor=owner,
                cleaned=_cleaned(image.pk),
                expected_revision_version=revision.version,
                auto_approved=True,
            )
    finally:
        listing_revision_approved.disconnect(receiver)

    assert seen == [True]
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && uv run pytest listings/tests/test_publication.py -q`

Expected: a collection error — `ModuleNotFoundError: No module named 'listings.publication'`.

- [ ] **Step 3: Create `backend/listings/publication.py`**

```python
"""The single path from an approved revision to public content (spec §20.1 step
8, §20.4, §21).

Two callers, one implementation, on purpose:

  * ``listings.decisions.approve_revision`` — a staff moderator's APPROVE.
  * ``listings.submissions.submit_listing_revision`` — a broker submission under
    spec §21 auto-approval (wired up in Phase 12 Task 2).

Spec §21's acceptance test "Invalid listing never publishes even when
auto-approval is on" is only provable if there is no second, laxer way to create
a snapshot. Both callers validate the revision payload and its media *before*
calling in here and hand the cleaned document over; this module never publishes
a payload it was not given, and never validates on a caller's behalf.

Contract for every caller: be inside ``transaction.atomic()`` and already hold
``select_for_update()`` on the listing row. This module takes no lock of its own
— it is the tail of somebody else's transaction, not a transaction boundary.

It deliberately imports nothing from ``listings.decisions`` or
``listings.submissions``: it is the leaf both of them depend on, and
``decisions`` already imports ``submissions`` for ``validate_submission_media``,
so any arrow back from here would be an import cycle.
"""

from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from audit.models import AuditEvent
from audit.services import record_audit_event

from .drafts import InvalidWorkflowState
from .enums import ListingStatus, RevisionStatus
from .locking import bump_version
from .models import BoatListing, ListingRevision, ListingSnapshot
from .policies import ListingEntitlementGate
from .signals import listing_published, listing_revision_approved
from .snapshots import create_snapshot_from_revision


def guard_base_snapshot(listing: BoatListing, revision: ListingRevision) -> None:
    """Refuse a revision written against a snapshot that is no longer current.

    Another revision was approved while this one sat in the queue; publishing it
    now would silently discard that newer content — the snapshot-level
    counterpart of spec §20.5's "do not silently overwrite another
    browser/session edit".

    Zero queries on the happy path: it compares two ids already loaded on the
    instances and only dereferences ``current_public_snapshot`` when it is about
    to raise. ``publish_revision`` calls it first so no caller can skip it;
    ``approve_revision`` *also* calls it explicitly, before validating, to
    preserve the error precedence Phase 11 shipped (a revision that is both
    stale and invalid answers 409 ``stale_base_snapshot``, not 400
    ``validation_error``).
    """
    if (
        revision.base_snapshot_id is None
        or revision.base_snapshot_id == listing.current_public_snapshot_id
    ):
        return

    conflict = InvalidWorkflowState(
        "A newer version of this listing was approved in the meantime. "
        "Ask the seller to rebase their changes.",
        code="stale_base_snapshot",
    )
    # Copied into the error envelope by common.exceptions.nauta_exception_handler.
    conflict.meta = {
        "resource": "snapshot",
        "current_version": (
            listing.current_public_snapshot.version
            if listing.current_public_snapshot_id is not None
            else None
        ),
    }
    raise conflict


def publish_revision(
    *,
    listing: BoatListing,
    revision: ListingRevision,
    actor,
    cleaned: dict,
    expected_revision_version: int,
    note: str = "",
    auto_approved: bool = False,
    publication_source: str | None = None,
) -> ListingSnapshot:
    """Move ``revision`` to APPROVED, freeze the next snapshot, make it public.

    ``auto_approved`` changes exactly three observable things and nothing else:
    the audit ``action`` written, ``metadata.auto_approved``, and the
    ``auto_approved`` kwarg on the ``listing_revision_approved`` signal. The
    validation, the locking, the snapshot content and the state transition are
    identical on both paths — which is what makes spec §21's "Invalid listing
    never publishes even when auto-approval is on" true by construction, rather
    than by a second set of checks somebody has to remember to keep in step.

    ``publication_source`` is written only on a first publication and only when
    supplied; the staff path leaves it ``None`` because
    ``submit_listing_revision`` already wrote it when the listing entered
    PENDING_APPROVAL.
    """
    guard_base_snapshot(listing, revision)

    decided_at = timezone.now()
    is_first_publication = listing.current_public_snapshot_id is None
    before = {"listing_status": listing.status, "revision_state": revision.state}
    cleaned_note = (note or "").strip()

    bump_version(
        revision,
        expected_version=expected_revision_version,
        resource="revision",
        state=RevisionStatus.APPROVED,
        decided_by=actor,
        decided_at=decided_at,
        decision_note=cleaned_note,
    )

    snapshot = create_snapshot_from_revision(
        listing=listing,
        revision=revision,
        cleaned_payload=cleaned,
        approved_by=actor,
        approved_at=decided_at,
    )

    updates = {"current_public_snapshot": snapshot, "updated_by": actor}
    if is_first_publication:
        # The only listing-status move a publication makes. A post-publication
        # revision leaves `status` alone: the listing is already PUBLISHED,
        # LISTING_TRANSITIONS has no PUBLISHED -> PUBLISHED edge, and re-writing
        # it would silently un-suspend a SUSPENDED listing whose queued revision
        # is approved later. `published_at`/`expires_at` move with it for the
        # same reason: spec §11.4 makes `published_at` the listing's publication
        # moment, not the latest snapshot's.
        publication_days = ListingEntitlementGate.publication_days(listing=listing)
        updates["status"] = ListingStatus.PUBLISHED
        updates["published_at"] = decided_at
        updates["expires_at"] = (
            decided_at + timedelta(days=publication_days)
            if publication_days is not None
            else None
        )
        if publication_source is not None:
            updates["publication_source"] = publication_source

    bump_version(
        listing, expected_version=listing.version, resource="listing", **updates
    )

    record_audit_event(
        actor_user=actor,
        actor_type=AuditEvent.ActorType.USER,
        action=(
            "listing.revision_auto_approved"
            if auto_approved
            else "listing.revision_approved"
        ),
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
            "note": cleaned_note,
            "first_publication": is_first_publication,
            "auto_approved": auto_approved,
            "broker_id": str(listing.broker_id) if listing.broker_id else None,
        },
    )

    def _emit():
        listing_revision_approved.send(
            sender=ListingRevision, revision=revision, auto_approved=auto_approved
        )
        if is_first_publication:
            listing_published.send(
                sender=BoatListing, listing=listing, snapshot=snapshot
            )

    transaction.on_commit(_emit)
    return snapshot
```

**Note (ruling — `decided_by` on an auto-approved revision is the submitting user).** `publish_revision` writes `decided_by=actor`, and on the auto path Task 2 passes the submitting user. `ListingRevision`'s `listings_revision_decided_requires_decision_stamps` constraint makes that column mandatory on an `APPROVED` row and `ListingSnapshot.approved_by` is a non-nullable FK, so auto-approval must name somebody. The staff admin who toggled the policy did not see this listing and must not be recorded as having decided it; `NULL` is unavailable without dropping a constraint that exists to satisfy spec §20's "Every decision records actor, note and timestamps". Under auto-approval the organization's own submission *is* the decision, and the grant of that power is recorded separately and permanently as the `broker.auto_approval_changed` audit event. The distinct audit action plus `metadata.auto_approved` keep the two apart for anyone reading the trail.

- [ ] **Step 4: Replace the body of `approve_revision` in `backend/listings/decisions.py`**

Two edits, both in that one file.

**4a — the import block.** After the edit, the block at the top of `decisions.py` reads exactly:

```python
"""Staff decisions on a submitted revision (spec §20.1 steps 7-8, §20.2, §26.2)."""

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ErrorDetail, ValidationError

from audit.models import AuditEvent
from audit.services import record_audit_event

from .drafts import (
    FULL_CLEAN_EXCLUDED_FIELDS,
    InvalidWorkflowState,
    _apply_payload_to_listing,
    open_revision_for,
    payload_from_snapshot,
    raise_as_drf_validation_error,
)
from .enums import ListingStatus, RevisionOrigin, RevisionStatus, can_transition_listing
from .locking import bump_version
from .models import BoatListing, ListingRevision
from .payloads import validate_revision_payload
from .publication import guard_base_snapshot, publish_revision
from .signals import (
    listing_revision_changes_requested,
    listing_revision_rejected,
    listing_revision_submitted,
)
from .submissions import validate_submission_media
```

Removed: `from datetime import timedelta`, `from .policies import ListingEntitlementGate`, `from .snapshots import create_snapshot_from_revision`, and `listing_published` + `listing_revision_approved` from the `.signals` import. **Kept** (still used elsewhere in the file): `ListingStatus` and `can_transition_listing` (by `request_revision_changes`/`reject_revision`/`_change_suspension`), `bump_version` (by `_refuse`/`_change_suspension`), `BoatListing` (by `create_staff_correction_revision`/`suspend_listing` type hints), `timezone` (by `_refuse`/`create_staff_correction_revision`).

**4b — the function.** Replace everything from the `@transaction.atomic` decorator above `def approve_revision` down to and including its `return revision` with:

```python
@transaction.atomic
def approve_revision(
    *, revision_id, actor, expected_version: int, note: str = ""
) -> ListingRevision:
    revision, listing = _locked_submitted_revision(revision_id)

    # Checked here, before validation, so a revision that is both stale and
    # invalid still answers 409 stale_base_snapshot — the precedence Phase 11
    # shipped and `test_a_revision_based_on_a_superseded_snapshot_is_refused`
    # pins. publish_revision() re-checks it, so no future caller can skip it.
    guard_base_snapshot(listing, revision)

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

    publish_revision(
        listing=listing,
        revision=revision,
        actor=actor,
        cleaned=cleaned,
        expected_revision_version=expected_version,
        note=note,
    )
    return revision
```

Nothing else in `decisions.py` changes: `_locked_submitted_revision`, `_require_note`, `_refuse`, `request_revision_changes`, `reject_revision`, `create_staff_correction_revision`, `_change_suspension`, `suspend_listing` and `unsuspend_listing` are untouched.

- [ ] **Step 5: Run the new tests and the whole Phase 11 suite**

Run:
```bash
cd backend && uv run pytest listings/tests/test_publication.py -q
cd backend && uv run pytest listings -q
cd backend && uv run pytest -q
```

Expected: the new file passes, and **every existing test still passes with no test file edited**. If an existing test needed a change, the extraction was not faithful — revert the test and fix `publication.py` instead.

- [ ] **Step 6: Check for dead imports**

Run: `cd backend && uv run ruff check listings/decisions.py listings/publication.py`

Expected: no `F401` (unused import) findings. If `ruff` is not configured in this repo, use `uv run python -m pyflakes listings/decisions.py` or read the import block against the symbol list in Step 4a — an unused import left behind is a review rejection.

- [ ] **Step 7: Commit**

```bash
git add backend/listings/publication.py backend/listings/decisions.py backend/listings/tests/test_publication.py
git commit -m "refactor(listings): extract the publication core into listings.publication"
```

---

### Task 2: `requires_staff_approval` reads the broker policy, and submit publishes immediately when it returns False

The phase's core. It lands as **one** commit: the new policy body without the new submit branch would strand a broker submission (listing `DRAFT`, revision `SUBMITTED`, nothing published, nothing queued for a moderator).

**Files:**
- Modify: `backend/listings/policies.py` (one import line, one new module constant, the body of `requires_staff_approval`)
- Modify: `backend/listings/submissions.py` (the row fetch and the branch inside `submit_listing_revision` only)
- Modify: `backend/listings/signals.py` (module docstring only)
- Modify: `backend/listings/tests/test_policies.py` (append)
- Create: `backend/listings/tests/test_auto_approval.py`

**Interfaces:**
- Consumes: `listings.publication.publish_revision` (Task 1); `brokers.models.BrokerOrganization.auto_approve_listings` and `.is_active` (Phase 3 — read through `listing.broker`, never imported); `brokers.tests.factories.make_broker`/`make_membership` (Phase 3); `listings.tests.factories.make_broker_listing`/`make_media`/`make_revision` (Phase 11).
- Produces:
  - `listings.policies.AUTO_APPROVABLE_LISTING_STATES: frozenset[str]`
  - `listings.policies.requires_staff_approval(listing: BoatListing) -> bool` — unchanged signature, real body.
  - `listings.signals.listing_revision_approved` now also carries `auto_approved: bool`.

- [ ] **Step 1: Write the failing tests**

Append to `backend/listings/tests/test_policies.py` (first open the real file and fold these imports into its existing import section — do not leave mid-file imports):

```python
# --- Phase 12 (spec §21): broker auto-approval policy -----------------------
# Imports to fold into the file's existing import block:
#   from brokers.enums import BrokerOrganizationStatus
#   from brokers.tests.factories import make_broker
#   from listings.policies import AUTO_APPROVABLE_LISTING_STATES, ListingEntitlementGate
#   from listings.tests.factories import make_broker_listing


def _policy_broker(slug, *, auto=False, status=BrokerOrganizationStatus.ACTIVE):
    return make_broker(
        name=f"Broker {slug}",
        slug=slug,
        status=status,
        auto_approve_listings=auto,
    )


@pytest.mark.django_db
def test_a_private_seller_always_requires_staff_approval():
    owner = make_user("policy-private@example.com", role=UserRole.PRIVATE_SELLER)
    listing = make_private_listing(owner=owner)
    assert requires_staff_approval(listing) is True


@pytest.mark.django_db
def test_a_broker_without_the_policy_requires_staff_approval():
    actor = make_user("policy-broker-off@example.com", role=UserRole.BROKER)
    broker = _policy_broker("policy-off", auto=False)
    listing = make_broker_listing(broker=broker, actor=actor)
    assert requires_staff_approval(listing) is True


@pytest.mark.django_db
def test_an_active_broker_with_the_policy_on_skips_staff_approval():
    actor = make_user("policy-broker-on@example.com", role=UserRole.BROKER)
    broker = _policy_broker("policy-on", auto=True)
    listing = make_broker_listing(broker=broker, actor=actor)
    assert requires_staff_approval(listing) is False


@pytest.mark.django_db
@pytest.mark.parametrize(
    "org_status",
    [
        BrokerOrganizationStatus.DRAFT,
        BrokerOrganizationStatus.PENDING,
        BrokerOrganizationStatus.SUSPENDED,
    ],
)
def test_a_non_active_organization_never_auto_approves(org_status):
    """Spec §21 rule 2: 'unlimited' does not bypass suspension."""
    slug = f"policy-org-{org_status.lower()}"
    actor = make_user(f"{slug}@example.com", role=UserRole.BROKER)
    broker = _policy_broker(slug, auto=True, status=org_status)
    listing = make_broker_listing(broker=broker, actor=actor)
    assert requires_staff_approval(listing) is True


@pytest.mark.django_db
@pytest.mark.parametrize(
    "listing_status",
    [
        ListingStatus.PENDING_APPROVAL,
        ListingStatus.SUSPENDED,
        ListingStatus.EXPIRED,
        ListingStatus.ARCHIVED,
    ],
)
def test_a_listing_outside_the_edit_loop_never_auto_approves(listing_status):
    """Spec §21 rules 2 and 5: moderation and suspension are not bypassed, and a
    submission a moderator already owns is not retro-approved."""
    slug = f"policy-state-{listing_status.lower()}"
    actor = make_user(f"{slug}@example.com", role=UserRole.BROKER)
    broker = _policy_broker(slug, auto=True)
    listing = make_broker_listing(broker=broker, actor=actor, status=listing_status)
    assert requires_staff_approval(listing) is True


@pytest.mark.django_db
def test_the_auto_approvable_states_are_the_owner_edit_loop():
    assert AUTO_APPROVABLE_LISTING_STATES == frozenset(
        {ListingStatus.DRAFT, ListingStatus.REJECTED, ListingStatus.PUBLISHED}
    )


@pytest.mark.django_db
def test_brokers_have_no_numeric_listing_quota():
    """Spec §21 rule 1. Phase 13 replaces ListingEntitlementGate's body; this
    test is the tripwire that stops it attaching a quota to brokers."""
    actor = make_user("policy-quota@example.com", role=UserRole.BROKER)
    broker = _policy_broker("policy-quota", auto=False)
    assert ListingEntitlementGate.can_submit(user=actor, broker=broker) is True
```

Create `backend/listings/tests/test_auto_approval.py`:

```python
"""Spec §21 / §20.4: a valid broker submission publishes immediately when the
organization's staff-admin-enabled auto-approval policy is on."""

import pytest
from django.urls import reverse
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from audit.models import AuditEvent
from brokers.enums import BrokerMembershipRole, BrokerOrganizationStatus
from brokers.tests.factories import make_broker, make_membership
from listings.enums import (
    ListingStatus,
    MediaStatus,
    MediaType,
    PublicationSource,
    RevisionStatus,
)
from listings.models import ListingSnapshot
from listings.submissions import submit_listing_revision
from listings.tests.factories import make_broker_listing, make_media, make_revision
from platform_settings.services import set_feature_flag


@pytest.fixture
def workflow_enabled(db):
    set_feature_flag(key="listing_revisions", is_enabled=True, actor=None)


@pytest.fixture
def api():
    return APIClient()


def _broker_admin(email, broker):
    user = make_user(email, role=UserRole.BROKER, verified=True)
    make_membership(
        user,
        broker,
        role=BrokerMembershipRole.ADMIN,
        can_edit_listings=True,
        can_manage_team=True,
        can_read_messages=True,
    )
    return user


def _payload(media_id):
    return {
        "title_en": "Lagoon 42, 2021",
        "description_en": "Owner version, full electronics.",
        "specifications": {"length_m": "12.8"},
        "location_country": "ES",
        "location_city": "Palma",
        "price": "459000.00",
        "currency": "EUR",
        "media_ids": [str(media_id)],
    }


def _ready_broker_listing(*, auto, slug, email, status=ListingStatus.DRAFT):
    broker = make_broker(
        name=f"Broker {slug}",
        slug=slug,
        status=BrokerOrganizationStatus.ACTIVE,
        auto_approve_listings=auto,
    )
    actor = _broker_admin(email, broker)
    listing = make_broker_listing(broker=broker, actor=actor, status=status)
    image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY)
    revision = make_revision(listing, payload=_payload(image.pk))
    return broker, actor, listing, revision


@pytest.mark.django_db
def test_an_auto_approved_initial_submission_publishes_immediately():
    """Spec §21 acceptance test 3."""
    _, actor, listing, revision = _ready_broker_listing(
        auto=True, slug="auto-initial", email="auto-initial@example.com"
    )

    submit_listing_revision(
        listing=listing, actor=actor, expected_version=revision.version
    )

    listing.refresh_from_db()
    revision.refresh_from_db()
    assert listing.status == ListingStatus.PUBLISHED
    assert listing.current_public_snapshot is not None
    assert listing.current_public_snapshot.version == 1
    assert listing.published_at is not None
    assert listing.publication_source == PublicationSource.BROKER_POLICY
    assert revision.state == RevisionStatus.APPROVED
    assert revision.decided_by_id == actor.pk


@pytest.mark.django_db
def test_a_broker_without_the_policy_still_waits_for_a_moderator():
    _, actor, listing, revision = _ready_broker_listing(
        auto=False, slug="auto-off", email="auto-off@example.com"
    )

    submit_listing_revision(
        listing=listing, actor=actor, expected_version=revision.version
    )

    listing.refresh_from_db()
    revision.refresh_from_db()
    assert listing.status == ListingStatus.PENDING_APPROVAL
    assert listing.current_public_snapshot_id is None
    assert revision.state == RevisionStatus.SUBMITTED


@pytest.mark.django_db
def test_an_auto_approved_edit_publishes_the_next_snapshot_and_keeps_the_status():
    """Spec §20.4: 'valid create/edit submissions publish a new snapshot
    immediately.'"""
    _, actor, listing, revision = _ready_broker_listing(
        auto=True, slug="auto-edit", email="auto-edit@example.com"
    )
    submit_listing_revision(
        listing=listing, actor=actor, expected_version=revision.version
    )
    listing.refresh_from_db()
    first_published_at = listing.published_at

    second = make_revision(
        listing,
        base_snapshot=listing.current_public_snapshot,
        payload={**revision.payload, "price": "429000.00"},
    )
    submit_listing_revision(
        listing=listing, actor=actor, expected_version=second.version
    )

    listing.refresh_from_db()
    assert ListingSnapshot.objects.filter(listing=listing).count() == 2
    assert listing.current_public_snapshot.version == 2
    assert str(listing.current_public_snapshot.price) == "429000.00"
    assert listing.status == ListingStatus.PUBLISHED
    assert listing.published_at == first_published_at


@pytest.mark.django_db
def test_an_invalid_submission_never_publishes_even_with_the_policy_on():
    """Spec §21 acceptance test 4."""
    _, actor, listing, revision = _ready_broker_listing(
        auto=True, slug="auto-invalid", email="auto-invalid@example.com"
    )
    revision.payload = {**revision.payload, "title_en": ""}
    revision.save(update_fields=["payload"])

    with pytest.raises(ValidationError):
        submit_listing_revision(
            listing=listing, actor=actor, expected_version=revision.version
        )

    listing.refresh_from_db()
    revision.refresh_from_db()
    assert listing.status == ListingStatus.DRAFT
    assert listing.current_public_snapshot_id is None
    assert revision.state == RevisionStatus.DRAFT
    assert ListingSnapshot.objects.filter(listing=listing).count() == 0


@pytest.mark.django_db
def test_media_that_is_not_ready_blocks_an_auto_approved_submission():
    """Spec §21 rule 2: 'unlimited' does not bypass media limits."""
    _, actor, listing, revision = _ready_broker_listing(
        auto=True, slug="auto-media", email="auto-media@example.com"
    )
    image = listing.media.get()
    image.status = MediaStatus.PROCESSING
    image.save(update_fields=["status"])

    with pytest.raises(ValidationError) as exc_info:
        submit_listing_revision(
            listing=listing, actor=actor, expected_version=revision.version
        )

    assert exc_info.value.detail["media_ids"][0].code == "media_not_ready"
    listing.refresh_from_db()
    assert listing.status == ListingStatus.DRAFT
    assert ListingSnapshot.objects.filter(listing=listing).count() == 0


@pytest.mark.django_db
def test_enabling_the_policy_does_not_retro_approve_a_pending_submission():
    """Spec §21 rule 5."""
    broker, actor, listing, revision = _ready_broker_listing(
        auto=False, slug="auto-pending", email="auto-pending@example.com"
    )
    submit_listing_revision(
        listing=listing, actor=actor, expected_version=revision.version
    )

    broker.auto_approve_listings = True
    broker.save(update_fields=["auto_approve_listings"])

    listing.refresh_from_db()
    revision.refresh_from_db()
    assert listing.status == ListingStatus.PENDING_APPROVAL
    assert revision.state == RevisionStatus.SUBMITTED
    assert listing.current_public_snapshot_id is None


@pytest.mark.django_db
def test_disabling_the_policy_leaves_a_published_listing_live():
    """Spec §21 rule 6."""
    broker, actor, listing, revision = _ready_broker_listing(
        auto=True, slug="auto-disable", email="auto-disable@example.com"
    )
    submit_listing_revision(
        listing=listing, actor=actor, expected_version=revision.version
    )

    broker.auto_approve_listings = False
    broker.save(update_fields=["auto_approve_listings"])

    listing.refresh_from_db()
    assert listing.status == ListingStatus.PUBLISHED
    assert listing.current_public_snapshot is not None


@pytest.mark.django_db
def test_an_auto_approved_submission_records_both_audit_events():
    _, actor, listing, revision = _ready_broker_listing(
        auto=True, slug="auto-audit", email="auto-audit@example.com"
    )

    submit_listing_revision(
        listing=listing, actor=actor, expected_version=revision.version
    )

    actions = set(
        AuditEvent.objects.filter(target_id=str(revision.pk)).values_list(
            "action", flat=True
        )
    )
    assert actions == {"listing.submitted", "listing.revision_auto_approved"}
    submitted = AuditEvent.objects.get(
        target_id=str(revision.pk), action="listing.submitted"
    )
    assert submitted.metadata["auto_approved"] is True
    assert submitted.metadata["publication_source"] == PublicationSource.BROKER_POLICY
    assert submitted.after["listing_status"] == ListingStatus.PUBLISHED
    assert submitted.after["state"] == RevisionStatus.APPROVED


@pytest.mark.django_db(transaction=True)
def test_an_auto_approved_submission_does_not_summon_a_moderator():
    from listings.signals import (
        listing_initial_submitted,
        listing_published,
        listing_revision_submitted,
    )

    seen = []
    wired = [
        (listing_initial_submitted, lambda **kw: seen.append("initial")),
        (listing_revision_submitted, lambda **kw: seen.append("submitted")),
        (listing_published, lambda **kw: seen.append("published")),
    ]
    for signal, receiver in wired:
        signal.connect(receiver)
    try:
        _, actor, listing, revision = _ready_broker_listing(
            auto=True, slug="auto-signals", email="auto-signals@example.com"
        )
        submit_listing_revision(
            listing=listing, actor=actor, expected_version=revision.version
        )
    finally:
        for signal, receiver in wired:
            signal.disconnect(receiver)

    assert seen == ["published"]


@pytest.mark.django_db(transaction=True)
def test_a_manual_broker_submission_still_summons_a_moderator():
    from listings.signals import listing_initial_submitted, listing_revision_submitted

    seen = []
    wired = [
        (listing_initial_submitted, lambda **kw: seen.append("initial")),
        (listing_revision_submitted, lambda **kw: seen.append("submitted")),
    ]
    for signal, receiver in wired:
        signal.connect(receiver)
    try:
        _, actor, listing, revision = _ready_broker_listing(
            auto=False, slug="manual-signals", email="manual-signals@example.com"
        )
        submit_listing_revision(
            listing=listing, actor=actor, expected_version=revision.version
        )
    finally:
        for signal, receiver in wired:
            signal.disconnect(receiver)

    assert sorted(seen) == ["initial", "submitted"]


@pytest.mark.django_db
def test_the_submit_endpoint_reports_the_published_state(api, workflow_enabled):
    _, actor, listing, revision = _ready_broker_listing(
        auto=True, slug="auto-api", email="auto-api@example.com"
    )
    api.force_authenticate(actor)

    response = api.post(
        reverse("listing-submit", args=[listing.pk]),
        {"version": revision.version},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["status"] == ListingStatus.PUBLISHED
    assert response.data["current_public_snapshot_version"] == 1
    assert response.data["policy"]["requires_approval"] is False
    assert response.data["revision"]["state"] == RevisionStatus.APPROVED
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && uv run pytest listings/tests/test_auto_approval.py listings/tests/test_policies.py -q`

Expected: `AUTO_APPROVABLE_LISTING_STATES` is an `ImportError`; every auto-approval assertion fails because `requires_staff_approval` still returns `True`, so the listing stays `PENDING_APPROVAL` and no snapshot appears; the audit test fails on the missing `auto_approved` metadata key.

- [ ] **Step 3a: Give `requires_staff_approval` a real body**

In `backend/listings/policies.py`, extend the existing `.enums` import to:

```python
from .enums import ListingStatus, MediaType, PublicationSource
```

Then replace the whole `requires_staff_approval` function with:

```python
# Spec §21 rule 2: auto-approval "does not bypass validation, moderation,
# suspension, media limits or abuse controls". A listing outside the owner's
# ordinary edit loop always goes to a human, whatever the organization's policy
# says: SUSPENDED / EXPIRED / ARCHIVED are moderation outcomes, and
# PENDING_APPROVAL is a submission a moderator already owns (spec §21 rule 5 —
# enabling the policy must not retro-approve it). The set is deliberately
# identical to the one listings.drafts.update_listing_draft uses to decide who
# may open a new revision at all.
AUTO_APPROVABLE_LISTING_STATES: frozenset[str] = frozenset(
    {ListingStatus.DRAFT, ListingStatus.REJECTED, ListingStatus.PUBLISHED}
)


def requires_staff_approval(listing: BoatListing) -> bool:
    """Whether a submission must wait for a moderator (spec §21, §20.4, §6.1).

    Returns False in exactly one case: a broker listing, inside the ordinary
    edit loop, belonging to an ACTIVE organization whose staff-admin-enabled
    `auto_approve_listings` policy is on. Everything else still goes through
    moderation — every private seller, a broker listing with no organization
    row, an organization that is DRAFT/PENDING/SUSPENDED, and any listing state
    outside AUTO_APPROVABLE_LISTING_STATES.

    Read at submit time only, which is what makes spec §21 rules 5 and 6 true:
    the policy governs *future* submissions, so a revision already sitting in
    PENDING_APPROVAL is never retro-approved by enabling it, and a published
    listing is never unpublished by disabling it.

    `listing.broker` is dereferenced rather than imported: `listings` must never
    import `brokers` at module level — that arrow belongs to `brokers`, which
    imports `listings` for the staff screen. On a listing loaded without
    `select_related("broker")` this costs one query; `submit_listing_revision`
    selects it, and `ListingWorkflowSerializer` pays it once per broker listing
    it renders.
    """
    if listing.seller_type != SellerType.BROKER:
        return True
    if listing.status not in AUTO_APPROVABLE_LISTING_STATES:
        return True
    broker = listing.broker
    if broker is None or not broker.is_active:
        return True
    return not broker.auto_approve_listings
```

- [ ] **Step 3b: Add the auto-approval branch to `submit_listing_revision`**

In `backend/listings/submissions.py`, add to the import block:

```python
from .publication import publish_revision
```

Replace the first statement of `submit_listing_revision`:

```python
    listing = BoatListing.objects.select_for_update().get(pk=listing.pk)
```

with:

```python
    # `of=("self",)` keeps the lock on the listing row alone. `select_related`
    # is needed because requires_staff_approval() reads the organization's
    # policy, and a bare select_for_update() across that join would lock the
    # BrokerOrganization row too — serialising every concurrent submission of a
    # large broker behind one row. The policy is deliberately read *unlocked*;
    # see the ruling in the Phase 12 plan. Lock order matches
    # listings.decisions._locked_submitted_revision: listing first.
    listing = (
        BoatListing.objects.select_for_update(of=("self",))
        .select_related("broker")
        .get(pk=listing.pk)
    )
```

Then replace the block that begins at `is_initial = listing.current_public_snapshot_id is None` and runs to the end of the function with:

```python
    is_initial = listing.current_public_snapshot_id is None
    uses_other_model = listing.model.is_other_placeholder
    needs_approval = requires_staff_approval(listing)
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

    if needs_approval:
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
    else:
        # Spec §21 / §20.4: "If broker auto-approval is on, valid create/edit
        # submissions publish a new snapshot immediately." The payload and its
        # media were validated above, so this hands publish_revision() exactly
        # the cleaned document a moderator's APPROVE would have carried — one
        # publication path, one set of checks, which is what makes spec §21's
        # "Invalid listing never publishes even when auto-approval is on" true
        # by construction.
        publish_revision(
            listing=listing,
            revision=revision,
            actor=actor,
            cleaned=cleaned,
            expected_revision_version=revision.version,
            auto_approved=True,
            publication_source=publication_source if is_initial else None,
        )

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
            # Read from the row, not hard-coded to SUBMITTED: on the auto path
            # the revision is already APPROVED by now, and an audit row claiming
            # otherwise would be false.
            "state": revision.state,
            "submitted_at": submitted_at,
        },
        metadata={
            "listing_id": str(listing.pk),
            "revision_number": revision.revision_number,
            "is_initial_submission": is_initial,
            "publication_source": publication_source,
            "auto_approved": not needs_approval,
        },
    )

    def _emit():
        if needs_approval:
            # Spec §27.1 gives both of these events the recipients "moderation
            # staff". An auto-approved submission is already public, so
            # summoning a moderator for it would create a queue item with
            # nothing to decide. Phase 18 fans out `listing_revision_approved`
            # instead — publish_revision() sends it with auto_approved=True.
            listing_revision_submitted.send(sender=ListingRevision, revision=revision)
            if is_initial:
                listing_initial_submitted.send(
                    sender=ListingRevision, revision=revision
                )
        if uses_other_model:
            # Recipients are *taxonomy* staff (spec §27.1), and an Other-model
            # placeholder still needs a mapping decision (spec §13.3) whether or
            # not the listing is already live.
            listing_other_model_submitted.send(
                sender=ListingRevision, revision=revision
            )

    transaction.on_commit(_emit)
    listing.open_revision = revision
    return revision
```

`validate_submission_media` and `withdraw_listing_revision` are untouched.

- [ ] **Step 3c: Record the signal contract change**

In `backend/listings/signals.py`, replace the final paragraph of the module docstring with:

```text
Every signal is sent with `sender=listings.models.ListingRevision` and the
keyword argument `revision` (a ListingRevision), with two exceptions:

  * `listing_published` is sent with `sender=listings.models.BoatListing` and
    the keyword arguments `listing` and `snapshot`.
  * `listing_revision_approved` additionally carries `auto_approved: bool`
    (Phase 12, spec §21) — True when a broker organization's auto-approval
    policy published the revision rather than a moderator. Receivers must accept
    it through `**kwargs` and must not assume a human decided.
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:
```bash
cd backend && uv run pytest listings/tests/test_auto_approval.py listings/tests/test_policies.py -q
cd backend && uv run pytest listings -q
cd backend && uv run pytest -q
```

Expected: all pass, including every Phase 11 test with no edit. A private-seller submission takes the `needs_approval` branch unchanged, so `listings/tests/test_submit_withdraw.py` must still pass as written; if it does not, the branch was mis-wired — fix the branch, not the test.

- [ ] **Step 5: Commit**

```bash
git add backend/listings/policies.py backend/listings/submissions.py backend/listings/signals.py backend/listings/tests/
git commit -m "feat(listings): publish a broker submission immediately when auto-approval is on"
```

---

### Task 3: The policy toggle requires a reason and writes an audit event, at every entry point

Spec §21 rule 4 — "Only staff admin may toggle policy; **change requires a reason**" — and spec §26's definition of done — "Product, policy, broker approval and taxonomy actions are audited". Phase 3 built the toggle service with neither; its own docstring hands both to this phase. Django admin is a real write path into the flag, so the reason is collected there too rather than only on the API.

**Files:**
- Modify: `backend/brokers/services.py`
- Create: `backend/brokers/forms.py`
- Modify: `backend/brokers/admin.py`
- Create: `backend/brokers/tests/test_auto_approval_service.py`
- Modify: `backend/brokers/tests/test_services.py` (the three existing tests gain a `reason=` argument and read `.broker` off the result)
- Modify: `backend/brokers/tests/test_admin.py` (the fake `form` objects gain a `cleaned_data` dict)

**Interfaces:**
- Consumes: `audit.services.record_audit_event`, `audit.models.AuditEvent`, `brokers.models.BrokerOrganization`, `accounts.services.is_staff_admin` (already used by `brokers.admin`).
- Produces:
  - `brokers.services.PolicyChange` — frozen dataclass with `.broker: BrokerOrganization` and `.changed: bool`.
  - `brokers.services.clean_policy_reason(reason: str | None) -> str` — raises DRF `ValidationError` with field `reason`, code `policy_reason_required`.
  - `brokers.services.set_broker_auto_approval(broker, *, enabled: bool, actor, reason: str, source: str = AuditEvent.Source.API) -> PolicyChange` — **signature change**: `reason` is new and required, and the return type is `PolicyChange`, not `BrokerOrganization`.
  - `brokers.forms.BrokerOrganizationAdminForm`.

- [ ] **Step 1: Write the failing tests**

Create `backend/brokers/tests/test_auto_approval_service.py`:

```python
"""Spec §21 rule 4 and §26's definition of done: the auto-approval toggle
requires a reason and is audited, whichever entry point performs it."""

import pytest
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from audit.models import AuditEvent
from brokers.services import PolicyChange, clean_policy_reason, set_broker_auto_approval
from brokers.tests.factories import make_broker


def _admin(email):
    return make_user(email, role=UserRole.STAFF, verified=True)


@pytest.mark.django_db
def test_enabling_the_policy_writes_an_audit_event_carrying_the_reason():
    actor = _admin("policy-audit@example.com")
    broker = make_broker(name="Audited", slug="audited")
    before = timezone.now()

    result = set_broker_auto_approval(
        broker, enabled=True, actor=actor, reason="Vetted partner, 8 years."
    )

    assert isinstance(result, PolicyChange)
    assert result.changed is True
    assert result.broker.auto_approve_listings is True
    assert result.broker.auto_approve_changed_by == actor
    assert result.broker.auto_approve_changed_at >= before

    event = AuditEvent.objects.get(target_id=str(broker.pk))
    assert event.action == "broker.auto_approval_changed"
    assert event.target_type == "brokers.BrokerOrganization"
    assert event.actor_user == actor
    assert event.source == AuditEvent.Source.API
    assert event.before["auto_approve_listings"] is False
    assert event.after["auto_approve_listings"] is True
    assert event.metadata["reason"] == "Vetted partner, 8 years."
    assert event.metadata["broker_slug"] == "audited"
    assert event.metadata["future_submissions_only"] is True


@pytest.mark.django_db
@pytest.mark.parametrize("reason", ["", "   ", None])
def test_a_missing_reason_is_refused_with_a_stable_code(reason):
    actor = _admin("policy-noreason@example.com")
    broker = make_broker(name="No Reason", slug="no-reason")

    with pytest.raises(ValidationError) as exc_info:
        set_broker_auto_approval(broker, enabled=True, actor=actor, reason=reason)

    assert exc_info.value.detail["reason"][0].code == "policy_reason_required"
    broker.refresh_from_db()
    assert broker.auto_approve_listings is False
    assert AuditEvent.objects.filter(target_id=str(broker.pk)).count() == 0


@pytest.mark.django_db
def test_setting_the_same_value_changes_nothing_and_audits_nothing():
    actor = _admin("policy-noop@example.com")
    broker = make_broker(name="No Op", slug="no-op")
    set_broker_auto_approval(broker, enabled=True, actor=actor, reason="First pass.")
    first_stamp = broker.auto_approve_changed_at

    result = set_broker_auto_approval(
        broker, enabled=True, actor=actor, reason="Second pass."
    )

    assert result.changed is False
    broker.refresh_from_db()
    assert broker.auto_approve_changed_at == first_stamp
    assert AuditEvent.objects.filter(target_id=str(broker.pk)).count() == 1


@pytest.mark.django_db
def test_disabling_the_policy_restamps_and_audits_again():
    actor = _admin("policy-disable@example.com")
    broker = make_broker(name="Toggled", slug="toggled")
    set_broker_auto_approval(broker, enabled=True, actor=actor, reason="Trial.")
    enabled_at = broker.auto_approve_changed_at

    set_broker_auto_approval(
        broker, enabled=False, actor=actor, reason="Two rejected listings."
    )

    broker.refresh_from_db()
    assert broker.auto_approve_listings is False
    assert broker.auto_approve_changed_at > enabled_at
    events = AuditEvent.objects.filter(target_id=str(broker.pk)).order_by("created_at")
    assert [event.after["auto_approve_listings"] for event in events] == [True, False]
    assert events[1].metadata["reason"] == "Two rejected listings."


@pytest.mark.django_db
def test_the_admin_entry_point_is_audited_with_the_admin_source():
    actor = _admin("policy-adminsource@example.com")
    broker = make_broker(name="Admin Source", slug="admin-source")

    set_broker_auto_approval(
        broker,
        enabled=True,
        actor=actor,
        reason="Enabled from Django admin.",
        source=AuditEvent.Source.ADMIN,
    )

    event = AuditEvent.objects.get(target_id=str(broker.pk))
    assert event.source == AuditEvent.Source.ADMIN


def test_clean_policy_reason_trims():
    assert clean_policy_reason("  vetted  ") == "vetted"
```

Then update the two existing test files:

`backend/brokers/tests/test_services.py` — add `reason="..."` to all five `set_broker_auto_approval(...)` calls, and change `updated = set_broker_auto_approval(...)` / `assert updated.auto_approve_listings ...` in `test_enabling_auto_approval_stamps_the_actor_and_time` to read through the result:

```python
    result = set_broker_auto_approval(
        broker, enabled=True, actor=actor, reason="Vetted partner."
    )

    assert result.changed is True
    assert result.broker.auto_approve_listings is True
    assert result.broker.auto_approve_changed_by == actor
    assert result.broker.auto_approve_changed_at >= before
```

`backend/brokers/tests/test_admin.py` — every `SimpleNamespace(changed_data=["auto_approve_listings"])` becomes:

```python
        SimpleNamespace(
            changed_data=["auto_approve_listings"],
            cleaned_data={"auto_approve_reason": "Vetted partner."},
        ),
```

and append one new test:

```python
@pytest.mark.django_db
def test_the_admin_form_demands_a_reason_when_the_flag_changes():
    from brokers.forms import BrokerOrganizationAdminForm

    broker = make_broker(name="Form Broker", slug="form-broker")
    form = BrokerOrganizationAdminForm(
        data={
            "name": broker.name,
            "slug": broker.slug,
            "status": broker.status,
            "public_email": broker.public_email,
            "public_phone": broker.public_phone,
            "auto_approve_listings": "on",
            "auto_approve_reason": "",
        },
        instance=broker,
    )

    assert form.is_valid() is False
    assert "auto_approve_reason" in form.errors


@pytest.mark.django_db
def test_the_admin_form_accepts_an_unrelated_edit_with_no_reason():
    from brokers.forms import BrokerOrganizationAdminForm

    broker = make_broker(name="Form Broker 2", slug="form-broker-2")
    form = BrokerOrganizationAdminForm(
        data={
            "name": "Renamed",
            "slug": broker.slug,
            "status": broker.status,
            "public_email": broker.public_email,
            "public_phone": broker.public_phone,
            "auto_approve_reason": "",
        },
        instance=broker,
    )

    assert form.is_valid() is True, form.errors
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && uv run pytest brokers -q`

Expected: `TypeError: set_broker_auto_approval() got an unexpected keyword argument 'reason'` on the new service tests, `ModuleNotFoundError: No module named 'brokers.forms'` on the two new admin tests, and `AttributeError: 'BrokerOrganization' object has no attribute 'changed'` on the updated `test_services.py`.

- [ ] **Step 3a: Rewrite `backend/brokers/services.py`**

```python
from dataclasses import dataclass

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ErrorDetail, ValidationError

from audit.models import AuditEvent
from audit.services import record_audit_event
from brokers.models import BrokerOrganization


@dataclass(frozen=True)
class PolicyChange:
    """What set_broker_auto_approval() actually did.

    `changed` is False when the requested value already matched. The API returns
    it so the staff screen can say "already on" instead of implying a policy
    change happened, and so a repeated click writes no second audit row.
    """

    broker: BrokerOrganization
    changed: bool


def clean_policy_reason(reason: str | None) -> str:
    """Spec §21 rule 4: "Only staff admin may toggle policy; change requires a
    reason."

    Enforced in the service, not only in the serializer, so the rule holds for
    every caller — the API, Django admin, and any future management command.
    """
    cleaned = (reason or "").strip()
    if not cleaned:
        raise ValidationError(
            {
                "reason": [
                    ErrorDetail(
                        "Explain why this broker's auto-approval policy is changing.",
                        code="policy_reason_required",
                    )
                ]
            }
        )
    return cleaned


@transaction.atomic
def set_broker_auto_approval(
    broker: BrokerOrganization,
    *,
    enabled: bool,
    actor,
    reason: str,
    source: str = AuditEvent.Source.API,
) -> PolicyChange:
    """Change a broker's auto-approval policy, with actor, timestamp and reason.

    Staff-admin authorization is enforced by the caller — `IsStaffAdmin` on
    `BrokerApprovalPolicyView`, `is_staff_admin()` in `brokers.admin` — because
    the two entry points fail differently (403 envelope vs. a silent admin
    no-op) and this service has no request to answer.

    The audit event is written inside the same transaction as the column change
    (spec §2.4), so a rolled-back toggle leaves no orphaned row, and the reason
    lives in `metadata.reason` where the staff screen's audit history reads it.

    Spec §21 rules 5 and 6 are the reason nothing else happens here: enabling
    does **not** sweep the pending backlog (that is the separate, explicitly
    confirmed bulk-approve action) and disabling does **not** unpublish anything.
    `metadata.future_submissions_only` records that intent in the trail.
    """
    cleaned_reason = clean_policy_reason(reason)
    locked = BrokerOrganization.objects.select_for_update().get(pk=broker.pk)
    if locked.auto_approve_listings == enabled:
        return PolicyChange(broker=locked, changed=False)

    before = {
        "auto_approve_listings": locked.auto_approve_listings,
        "auto_approve_changed_by": (
            str(locked.auto_approve_changed_by_id)
            if locked.auto_approve_changed_by_id
            else None
        ),
        "auto_approve_changed_at": locked.auto_approve_changed_at,
    }

    locked.auto_approve_listings = enabled
    locked.auto_approve_changed_by = actor
    locked.auto_approve_changed_at = timezone.now()
    locked.save(
        update_fields=[
            "auto_approve_listings",
            "auto_approve_changed_by",
            "auto_approve_changed_at",
            "updated_at",
        ]
    )

    record_audit_event(
        actor_user=actor,
        actor_type=AuditEvent.ActorType.USER,
        action="broker.auto_approval_changed",
        target_type="brokers.BrokerOrganization",
        target_id=str(locked.pk),
        source=source,
        before=before,
        after={
            "auto_approve_listings": locked.auto_approve_listings,
            "auto_approve_changed_by": str(locked.auto_approve_changed_by_id),
            "auto_approve_changed_at": locked.auto_approve_changed_at,
        },
        metadata={
            "reason": cleaned_reason,
            "broker_slug": locked.slug,
            "future_submissions_only": True,
        },
    )

    broker.refresh_from_db()
    return PolicyChange(broker=locked, changed=True)
```

- [ ] **Step 3b: Create `backend/brokers/forms.py`**

```python
from django import forms

from brokers.models import BrokerOrganization


class BrokerOrganizationAdminForm(forms.ModelForm):
    """Adds the mandatory reason spec §21 rule 4 requires to the admin form.

    Django admin is a real write path into `auto_approve_listings` — `brokers.
    admin.BrokerOrganizationAdmin.save_model` routes it through
    `set_broker_auto_approval` — so leaving the reason to the API form alone
    would leave one audited rule with an unaudited back door. Spec §26's
    definition of done ("Staff can operate every new workflow without Django
    shell/database edits") means the admin stays usable, not that it stays
    unaudited.

    The field is not on the model: the reason belongs to the *event*, and the
    event lives in `audit.AuditEvent`, not in a column that only ever holds the
    most recent one.
    """

    auto_approve_reason = forms.CharField(
        label="Reason for the auto-approval change",
        required=False,
        max_length=500,
        widget=forms.Textarea(attrs={"rows": 2}),
        help_text=(
            "Required when the auto-approval switch changes. Stored in the audit "
            "trail. The change affects future submissions only."
        ),
    )

    class Meta:
        model = BrokerOrganization
        fields = "__all__"

    def clean(self):
        cleaned = super().clean()
        # `changed_data` does not contain a field the admin rendered read-only,
        # so a moderator — who cannot edit the flag at all — is never asked for
        # a reason they have no way to act on.
        if "auto_approve_listings" in self.changed_data and not (
            cleaned.get("auto_approve_reason") or ""
        ).strip():
            self.add_error(
                "auto_approve_reason",
                "Explain why this broker's auto-approval policy is changing.",
            )
        return cleaned
```

- [ ] **Step 3c: Wire the form and the reason into `backend/brokers/admin.py`**

Three edits to `BrokerOrganizationAdmin`, nothing else in the file changes.

1. Add the import `from brokers.forms import BrokerOrganizationAdminForm` and `from audit.models import AuditEvent` to the module's import block.
2. Add `form = BrokerOrganizationAdminForm` as the first attribute of the class, above `list_display`.
3. In `save_model`, replace the two `set_broker_auto_approval(...)` calls so they pass the reason and the ADMIN source and read `.broker` off the result:

```python
                if is_staff_admin(request.user) and requested != stored:
                    self._sync_policy_fields(
                        obj,
                        set_broker_auto_approval(
                            obj,
                            enabled=requested,
                            actor=request.user,
                            reason=form.cleaned_data["auto_approve_reason"],
                            source=AuditEvent.Source.ADMIN,
                        ).broker,
                    )
```

and, on the create path:

```python
                if is_staff_admin(request.user):
                    self._sync_policy_fields(
                        obj,
                        set_broker_auto_approval(
                            obj,
                            enabled=True,
                            actor=request.user,
                            reason=form.cleaned_data["auto_approve_reason"],
                            source=AuditEvent.Source.ADMIN,
                        ).broker,
                    )
```

`form.cleaned_data["auto_approve_reason"]` is read directly, without a `getattr` fallback: `BrokerOrganizationAdminForm.clean()` has already refused a blank one on exactly these two paths, so a missing key is a wiring bug that should raise loudly rather than silently audit an empty reason.

- [ ] **Step 4: Run the tests to verify they pass**

Run:
```bash
cd backend && uv run pytest brokers -q
cd backend && uv run pytest -q
```

Expected: all pass. Also check by hand that `uv run python manage.py check` reports no admin errors (`admin.E0xx` fires if the declared extra form field is not renderable).

- [ ] **Step 5: Commit**

```bash
git add backend/brokers/services.py backend/brokers/forms.py backend/brokers/admin.py backend/brokers/tests/
git commit -m "feat(brokers): require a reason and write an audit event for every auto-approval toggle"
```

---

### Task 4: `GET /api/v1/staff/brokers/<id>/` — the backend source for spec §21's Staff broker UI

Spec §2.1 ("Every visible state requires a backend source") and §31 make this endpoint a prerequisite for Tasks 7–9. It answers all six of §21's "Staff broker UI" items in one payload. It also closes spec §11.1's "Broker users may see the current policy but cannot change it" by adding one read-only key to the session payload.

**Files:**
- Create: `backend/brokers/selectors.py`
- Modify: `backend/brokers/serializers.py` (append)
- Modify: `backend/brokers/views.py` (append)
- Modify: `backend/brokers/urls.py` (append)
- Modify: `backend/accounts/selectors.py` (one key inside `get_broker_memberships`)
- Modify: `backend/accounts/tests/test_session.py` (append one test)
- Modify: `frontend/src/lib/auth/types.ts` (one field on `BrokerMembershipSummary`)
- Create: `backend/brokers/tests/test_staff_broker_detail_api.py`

**Interfaces:**
- Consumes: `listings.enums.ListingStatus`/`RevisionStatus`, `listings.models.BoatListing`/`ListingRevision` (through function-local imports), `audit.models.AuditEvent`, `accounts.permissions.IsActiveUser`/`IsStaffModerator`.
- Produces:
  - `brokers.selectors.broker_listing_counts(broker) -> dict` — `{"by_status": {<each of the seven ListingStatus values>: int}, "total": int}`
  - `brokers.selectors.pending_revision_count(broker) -> int`
  - `brokers.selectors.broker_audit_history(broker, *, limit: int = 50) -> list[AuditEvent]`
  - `brokers.selectors.BROKER_AUDIT_HISTORY_LIMIT: int`
  - `brokers.serializers.actor_ref(user) -> dict | None`
  - `brokers.serializers.StaffBrokerDetailSerializer` — `to_representation(broker) -> dict`
  - `brokers.views.StaffBrokerDetailView`
  - Route name `staff-broker-detail` at `staff/brokers/<uuid:broker_id>/`
  - `accounts.selectors.get_broker_memberships` entries gain `broker_auto_approve_listings: bool`

**Note (ruling — this endpoint is an addition beyond spec §30.1's literal table.)** §30.1 lists `PATCH /api/v1/staff/brokers/<id>/approval-policy/` but no GET. §21's Staff broker UI nevertheless requires account status, listing counts, policy state with last-changed-by/at, and audit history, and §2.1 forbids rendering any of that without a backend source. §30.1's own closing sentence grants the latitude — "Exact URL naming may follow an established API convention, but semantics, authorization and errors must remain equivalent." A later phase publishing an API inventory should list this, and the bulk-approve route from Task 6, as Phase 12 additions rather than §30.1 endpoints.

**Note (ruling — the read tier is staff *moderator*, the write tier is staff admin.)** §5 gives "Configure broker auto-approval" to staff admin alone; it says nothing about *seeing* it, and a moderator working the boats queue needs the broker's account status, backlog size and policy state to do their job. Reading is therefore `IsStaffModerator` (which admits staff admins) and every mutation in Tasks 5 and 6 declares its own, narrower gate. The payload deliberately contains no broker contact details, no member list and no listing content — only counts, policy state and this broker's own audit rows — so widening the read tier widens no privacy surface.

- [ ] **Step 1: Write the failing test**

Create `backend/brokers/tests/test_staff_broker_detail_api.py`:

```python
"""Spec §21 "Staff broker UI": every item the screen shows has a real source."""

import pytest
from django.contrib.auth.models import Group
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from brokers.enums import BrokerMembershipRole, BrokerOrganizationStatus
from brokers.services import set_broker_auto_approval
from brokers.tests.factories import make_broker, make_membership
from listings.enums import ListingStatus, RevisionStatus
from listings.tests.factories import make_broker_listing, make_revision


@pytest.fixture
def api():
    return APIClient()


def _staff(email, group_name):
    user = make_user(email, role=UserRole.STAFF, verified=True)
    user.groups.add(Group.objects.get(name=group_name))
    return user


def _detail_url(broker):
    return reverse("staff-broker-detail", args=[broker.pk])


@pytest.mark.django_db
def test_a_moderator_reads_status_counts_policy_and_audit_history(api):
    moderator = _staff("detail-mod@example.com", StaffGroup.MODERATOR)
    admin = _staff("detail-admin@example.com", StaffGroup.ADMIN)
    broker = make_broker(name="Blue Marine", slug="blue-marine")
    agent = make_user("detail-agent@example.com", role=UserRole.BROKER, verified=True)
    make_membership(agent, broker, role=BrokerMembershipRole.ADMIN)
    published = make_broker_listing(
        broker=broker, actor=agent, status=ListingStatus.PUBLISHED
    )
    pending = make_broker_listing(
        broker=broker, actor=agent, status=ListingStatus.PENDING_APPROVAL
    )
    make_revision(pending, state=RevisionStatus.SUBMITTED, submitted_by=agent,
                  submitted_at=published.created_at)
    set_broker_auto_approval(
        broker, enabled=True, actor=admin, reason="Vetted partner."
    )
    api.force_authenticate(moderator)

    response = api.get(_detail_url(broker))

    assert response.status_code == 200
    body = response.data
    assert body["id"] == str(broker.pk)
    assert body["name"] == "Blue Marine"
    assert body["status"] == BrokerOrganizationStatus.ACTIVE
    assert body["auto_approve_listings"] is True
    assert body["auto_approve_changed_by"]["email"] == "detail-admin@example.com"
    assert body["auto_approve_changed_at"] is not None
    assert body["listing_counts"]["by_status"][ListingStatus.PUBLISHED] == 1
    assert body["listing_counts"]["by_status"][ListingStatus.PENDING_APPROVAL] == 1
    assert body["listing_counts"]["by_status"][ListingStatus.ARCHIVED] == 0
    assert body["listing_counts"]["total"] == 2
    assert body["pending_revision_count"] == 1
    assert [entry["action"] for entry in body["audit_history"]] == [
        "broker.auto_approval_changed"
    ]
    assert body["audit_history"][0]["reason"] == "Vetted partner."
    assert body["audit_history"][0]["actor"]["email"] == "detail-admin@example.com"


@pytest.mark.django_db
def test_every_listing_state_is_reported_even_at_zero(api):
    moderator = _staff("detail-zero@example.com", StaffGroup.MODERATOR)
    broker = make_broker(name="Empty", slug="empty")
    api.force_authenticate(moderator)

    response = api.get(_detail_url(broker))

    assert response.status_code == 200
    by_status = response.data["listing_counts"]["by_status"]
    assert set(by_status) == {status.value for status in ListingStatus}
    assert set(by_status.values()) == {0}
    assert response.data["listing_counts"]["total"] == 0
    assert response.data["audit_history"] == []
    assert response.data["auto_approve_changed_by"] is None


@pytest.mark.django_db
def test_counts_only_cover_this_broker(api):
    moderator = _staff("detail-scope@example.com", StaffGroup.MODERATOR)
    mine = make_broker(name="Mine", slug="mine")
    theirs = make_broker(name="Theirs", slug="theirs")
    agent = make_user("detail-scope-agent@example.com", role=UserRole.BROKER, verified=True)
    make_broker_listing(broker=theirs, actor=agent, status=ListingStatus.PUBLISHED)
    api.force_authenticate(moderator)

    response = api.get(_detail_url(mine))

    assert response.data["listing_counts"]["total"] == 0


@pytest.mark.django_db
@pytest.mark.parametrize(
    "role,expected",
    [(UserRole.BROKER, 403), (UserRole.PRIVATE_SELLER, 403), (UserRole.BUYER, 403)],
)
def test_a_non_staff_user_cannot_read_the_staff_broker_detail(api, role, expected):
    broker = make_broker(name="Guarded", slug="guarded-detail")
    user = make_user(f"detail-{role.lower()}@example.com", role=role, verified=True)
    if role == UserRole.BROKER:
        make_membership(user, broker, role=BrokerMembershipRole.ADMIN)
    api.force_authenticate(user)

    response = api.get(_detail_url(broker))

    assert response.status_code == expected
    assert response.data["error"]["code"] == "staff_moderator_required"


@pytest.mark.django_db
def test_an_anonymous_request_is_rejected(api):
    broker = make_broker(name="Anon", slug="anon-detail")

    response = api.get(_detail_url(broker))

    assert response.status_code in (401, 403)


@pytest.mark.django_db
def test_an_unknown_broker_is_a_404(api):
    import uuid

    moderator = _staff("detail-404@example.com", StaffGroup.MODERATOR)
    api.force_authenticate(moderator)

    response = api.get(reverse("staff-broker-detail", args=[uuid.uuid4()]))

    assert response.status_code == 404
```

Append to `backend/accounts/tests/test_session.py`:

```python
@pytest.mark.django_db
def test_a_broker_member_sees_the_current_auto_approval_policy(api):
    """Spec §11.1: "Broker users may see the current policy but cannot change
    it." Seeing it is a read-only key on the membership summary; changing it is
    PATCH /api/v1/staff/brokers/<id>/approval-policy/, which is staff-admin."""
    from brokers.enums import BrokerMembershipRole
    from brokers.tests.factories import make_broker, make_membership

    user = make_user("policy-viewer@example.com", role=UserRole.BROKER, verified=True)
    broker = make_broker(
        name="Policy Viewer", slug="policy-viewer", auto_approve_listings=True
    )
    make_membership(user, broker, role=BrokerMembershipRole.AGENT)
    api.force_authenticate(user)

    response = api.get(reverse("session"))

    membership = response.data["broker_memberships"][0]
    assert membership["broker_auto_approve_listings"] is True
    assert response.data["permissions"]["configure_broker_auto_approval"] is False
```

Before writing it, open `backend/accounts/tests/test_session.py` and match its existing fixtures and the real `reverse()` route name for the session endpoint — use whatever that file already uses rather than the placeholder `"session"` above, and fold the two local imports into the file's import block.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && uv run pytest brokers/tests/test_staff_broker_detail_api.py accounts/tests/test_session.py -q`

Expected: `django.urls.exceptions.NoReverseMatch: Reverse for 'staff-broker-detail' not found` and, for the session test, `KeyError: 'broker_auto_approve_listings'`.

- [ ] **Step 3a: Create `backend/brokers/selectors.py`**

```python
"""Read-only aggregates behind spec §21's "Staff broker UI".

Import direction: `brokers` may import `listings`; `listings` must never import
`brokers` at module level (see the Phase 12 plan's scope rulings). The listings
imports below are function-local anyway, mirroring the pattern
`accounts.services` established for exactly this neighbourhood — `brokers.admin`
imports this app's modules at admin-autodiscover time, and a module-level import
of another app's models from there has caused an app-loading cycle before.
"""

from django.db.models import Count

from audit.models import AuditEvent
from brokers.models import BrokerOrganization

#: How many of this broker's audit rows the staff screen shows. A window, not a
#: page: spec §21 asks for "Audit history" on a detail panel, and a broker whose
#: policy has been toggled more than fifty times is a conversation, not a
#: pagination problem. Phase 17's staff tooling owns a full, filterable audit
#: browser if one is ever needed.
BROKER_AUDIT_HISTORY_LIMIT = 50


def broker_listing_counts(broker: BrokerOrganization) -> dict:
    """Live per-state counts plus a total (spec §21 Staff broker UI item 2).

    Every one of spec §6.1's seven states is present with an explicit 0 rather
    than omitted, so the screen renders a real zero row instead of a missing
    one (spec §2.1; spec §26 definition of done: "All visible counters equal
    query results"). One GROUP BY query, never a cached counter column — a
    cached count cannot satisfy "equal query results".
    """
    from listings.enums import ListingStatus
    from listings.models import BoatListing

    by_status = {status.value: 0 for status in ListingStatus}
    rows = (
        BoatListing.objects.filter(broker=broker)
        .values("status")
        .annotate(count=Count("id"))
    )
    for row in rows:
        by_status[row["status"]] = row["count"]
    return {"by_status": by_status, "total": sum(by_status.values())}


def pending_revision_count(broker: BrokerOrganization) -> int:
    """SUBMITTED revisions across this broker's listings.

    This is exactly the backlog spec §21 rule 7's bulk approve acts on, so the
    number the screen shows and the number the action processes come from the
    same filter.
    """
    from listings.enums import RevisionStatus
    from listings.models import ListingRevision

    return ListingRevision.objects.filter(
        listing__broker=broker, state=RevisionStatus.SUBMITTED
    ).count()


def broker_audit_history(
    broker: BrokerOrganization, *, limit: int = BROKER_AUDIT_HISTORY_LIMIT
) -> list[AuditEvent]:
    """This organization's own audit rows, newest first (Staff broker UI item 6).

    Filtered by `target_type`/`target_id`, which `audit.AuditEvent.Meta.indexes`
    already covers with `Index(fields=["target_type", "target_id"])`. Listing
    decisions are *not* included: they target `listings.ListingRevision`, belong
    to the moderation queue (Phase 17), and would bury the policy history this
    panel exists to show.
    """
    return list(
        AuditEvent.objects.select_related("actor_user")
        .filter(
            target_type="brokers.BrokerOrganization", target_id=str(broker.pk)
        )
        .order_by("-created_at")[:limit]
    )
```

- [ ] **Step 3b: Append to `backend/brokers/serializers.py`**

Fold these imports into the file's existing import block:

```python
from brokers.selectors import (
    broker_audit_history,
    broker_listing_counts,
    pending_revision_count,
)
```

Then append:

```python
def actor_ref(user) -> dict | None:
    """The minimum identification of a staff actor: who to ask about a change.

    Deliberately three fields. This payload is read by staff moderators, and a
    full user serialization would put an unrelated person's role, locale and
    verification state on a screen that only needs to name them.
    """
    if user is None:
        return None
    return {
        "id": str(user.pk),
        "email": user.email,
        "full_name": user.full_name,
    }


def audit_entry(event) -> dict:
    """One row of the staff broker audit history.

    `reason` is lifted out of `metadata` to the top level because it is the one
    field spec §21 requires the panel to show; the raw `before`/`after` are kept
    alongside it so a reviewer can see exactly what moved.
    """
    return {
        "id": str(event.pk),
        "action": event.action,
        "actor": actor_ref(event.actor_user),
        "created_at": event.created_at,
        "reason": (event.metadata or {}).get("reason", ""),
        "before": event.before,
        "after": event.after,
    }


class StaffBrokerDetailSerializer(serializers.Serializer):
    """Everything spec §21's "Staff broker UI" enumerates, in one payload.

    Read-only by construction — no `create`, no `update`. The two mutations have
    their own serializers and their own, narrower permission tiers, so nothing
    here can be turned into a write by adding a field.

    Also the response body of the approval-policy PATCH (Task 5), so a staff
    admin toggling the switch gets the refreshed counts, stamps and audit
    history back in the same round trip (spec §30.2: "Mutations return updated
    resource/version").
    """

    def to_representation(self, broker):
        return {
            "id": str(broker.pk),
            "name": broker.name,
            "slug": broker.slug,
            # §21 Staff broker UI item 1 — account status.
            "status": broker.status,
            # §21 Staff broker UI item 3 — the switch, its state, last changed
            # by and last changed at.
            "auto_approve_listings": broker.auto_approve_listings,
            "auto_approve_changed_by": actor_ref(broker.auto_approve_changed_by),
            "auto_approve_changed_at": broker.auto_approve_changed_at,
            # §21 Staff broker UI item 2 — listing counts by status.
            "listing_counts": broker_listing_counts(broker),
            # Drives the §21 rule 7 bulk-approve action (Task 6).
            "pending_revision_count": pending_revision_count(broker),
            # §21 Staff broker UI item 6 — audit history.
            "audit_history": [
                audit_entry(event) for event in broker_audit_history(broker)
            ],
        }
```

- [ ] **Step 3c: Append to `backend/brokers/views.py`**

Fold these imports into the file's existing import block:

```python
from rest_framework.permissions import IsAuthenticated

from accounts.permissions import IsStaffModerator
from brokers.serializers import StaffBrokerDetailSerializer
```

Then append:

```python
class StaffBrokerDetailView(APIView):
    """GET /api/v1/staff/brokers/<id>/ — the source behind spec §21's staff screen.

    IsStaffModerator, not IsStaffAdmin: spec §5 restricts *configuring* the
    policy to staff admin and says nothing about seeing it, and a moderator
    working the boats queue needs this broker's status, backlog and policy state
    to decide anything. The payload carries no contact details, no member list
    and no listing content — only counts, policy state and this organization's
    own audit rows.

    Not gated on the `listing_revisions` flag: refusing to *show* a policy state
    tells staff nothing and would hide the audit history during an incident. The
    two mutations that follow are gated.
    """

    permission_classes = [IsAuthenticated, IsActiveUser, IsStaffModerator]

    def get(self, request, broker_id):
        broker = get_object_or_404(
            BrokerOrganization.objects.select_related("auto_approve_changed_by"),
            pk=broker_id,
        )
        return Response(StaffBrokerDetailSerializer().to_representation(broker))
```

- [ ] **Step 3d: Append to `backend/brokers/urls.py`**

Add `StaffBrokerDetailView` to the `from brokers.views import ...` line and append to `urlpatterns`:

```python
    path(
        "staff/brokers/<uuid:broker_id>/",
        StaffBrokerDetailView.as_view(),
        name="staff-broker-detail",
    ),
```

- [ ] **Step 3e: Expose the policy read-only on the session payload**

In `backend/accounts/selectors.py`, inside `get_broker_memberships`'s dict comprehension, add one key after `"broker_status"`:

```python
            # Spec §11.1: "Broker users may see the current policy but cannot
            # change it." Read-only here; the only write path is
            # PATCH /api/v1/staff/brokers/<id>/approval-policy/, behind
            # IsStaffAdmin. `membership.broker` is already select_related, so
            # this costs no extra query.
            "broker_auto_approve_listings": membership.broker.auto_approve_listings,
```

In `frontend/src/lib/auth/types.ts`, add the matching field to `BrokerMembershipSummary`, directly after `broker_status`:

```ts
  /** Spec §11.1: visible to broker members, changeable only by staff admin. */
  broker_auto_approve_listings: boolean;
```

Then grep the frontend for object literals that construct a `BrokerMembershipSummary` and add the field there too, or TypeScript will not compile:

```bash
cd frontend && grep -rn "broker_memberships" src/ | grep -v "\.d\.ts"
```

At the time of writing every hit builds `broker_memberships: []`, so no literal needs changing — but check, do not assume.

- [ ] **Step 4: Run the tests to verify they pass**

Run:
```bash
cd backend && uv run pytest brokers accounts -q
cd backend && uv run pytest -q
cd frontend && pnpm exec tsc --noEmit && pnpm test
```

- [ ] **Step 5: Commit**

```bash
git add backend/brokers backend/accounts frontend/src/lib/auth/types.ts
git commit -m "feat(brokers): add the staff broker detail endpoint behind spec 21's staff screen"
```

---

### Task 5: `PATCH /api/v1/staff/brokers/<id>/approval-policy/`

The spec §30.1 endpoint, and the API half of spec §21's acceptance test 2 ("An ordinary broker user cannot toggle auto-approval through UI or API"). The UI half is Task 8.

**Files:**
- Modify: `backend/brokers/services.py` (extract one message constant)
- Modify: `backend/brokers/serializers.py` (append)
- Modify: `backend/brokers/views.py` (append)
- Modify: `backend/brokers/urls.py` (append)
- Create: `backend/brokers/tests/test_approval_policy_api.py`

**Interfaces:**
- Consumes: `brokers.services.set_broker_auto_approval`/`PolicyChange`/`POLICY_REASON_REQUIRED_MESSAGE` (Task 3), `brokers.serializers.StaffBrokerDetailSerializer` (Task 4), `accounts.permissions.IsStaffAdmin`, `listings.permissions.ListingWorkflowEnabled`.
- Produces:
  - `brokers.services.POLICY_REASON_REQUIRED_MESSAGE: str`
  - `brokers.serializers.BrokerApprovalPolicySerializer` — fields `auto_approve_listings: bool` (required), `reason: str`.
  - `brokers.views.BrokerApprovalPolicyView`
  - Route name `staff-broker-approval-policy` at `staff/brokers/<uuid:broker_id>/approval-policy/`.
  - Response body: the full `StaffBrokerDetailSerializer` payload plus one extra key, `changed: bool`.

- [ ] **Step 1: Write the failing test**

Create `backend/brokers/tests/test_approval_policy_api.py`:

```python
"""Spec §30.1's PATCH /api/v1/staff/brokers/<id>/approval-policy/ and spec §21
rule 4: "Only staff admin may toggle policy; change requires a reason."
"""

import pytest
from django.contrib.auth.models import Group
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from audit.models import AuditEvent
from brokers.enums import BrokerMembershipRole
from brokers.tests.factories import make_broker, make_membership
from platform_settings.services import set_feature_flag


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def workflow_enabled(db):
    set_feature_flag(key="listing_revisions", is_enabled=True, actor=None)


def _staff(email, group_name):
    user = make_user(email, role=UserRole.STAFF, verified=True)
    user.groups.add(Group.objects.get(name=group_name))
    return user


def _url(broker):
    return reverse("staff-broker-approval-policy", args=[broker.pk])


@pytest.mark.django_db
def test_a_staff_admin_enables_the_policy_and_gets_the_refreshed_detail(
    api, workflow_enabled
):
    admin = _staff("policy-api-admin@example.com", StaffGroup.ADMIN)
    broker = make_broker(name="Toggle Me", slug="toggle-me")
    api.force_authenticate(admin)

    response = api.patch(
        _url(broker),
        {"auto_approve_listings": True, "reason": "Vetted partner, 8 years."},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["changed"] is True
    assert response.data["auto_approve_listings"] is True
    assert response.data["auto_approve_changed_by"]["email"] == admin.email
    assert response.data["auto_approve_changed_at"] is not None
    # Spec §30.2: a mutation returns the updated resource — including the audit
    # row it just wrote, so the screen needs no second request.
    assert response.data["audit_history"][0]["action"] == "broker.auto_approval_changed"
    assert response.data["audit_history"][0]["reason"] == "Vetted partner, 8 years."
    broker.refresh_from_db()
    assert broker.auto_approve_listings is True


@pytest.mark.django_db
def test_a_staff_admin_disables_the_policy(api, workflow_enabled):
    admin = _staff("policy-api-off@example.com", StaffGroup.ADMIN)
    broker = make_broker(
        name="Turn Off", slug="turn-off", auto_approve_listings=True
    )
    api.force_authenticate(admin)

    response = api.patch(
        _url(broker),
        {"auto_approve_listings": False, "reason": "Two rejected listings."},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["auto_approve_listings"] is False
    assert response.data["changed"] is True


@pytest.mark.django_db
def test_setting_the_value_it_already_has_reports_no_change_and_audits_nothing(
    api, workflow_enabled
):
    admin = _staff("policy-api-noop@example.com", StaffGroup.ADMIN)
    broker = make_broker(name="Already Off", slug="already-off")
    api.force_authenticate(admin)

    response = api.patch(
        _url(broker),
        {"auto_approve_listings": False, "reason": "Confirming current state."},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["changed"] is False
    assert AuditEvent.objects.filter(target_id=str(broker.pk)).count() == 0


@pytest.mark.django_db
@pytest.mark.parametrize("body", [{"auto_approve_listings": True}, {"auto_approve_listings": True, "reason": "   "}])
def test_a_change_without_a_reason_is_refused(api, workflow_enabled, body):
    """Spec §21 rule 4: "change requires a reason"."""
    admin = _staff("policy-api-noreason@example.com", StaffGroup.ADMIN)
    broker = make_broker(name="No Reason API", slug="no-reason-api")
    api.force_authenticate(admin)

    response = api.patch(_url(broker), body, format="json")

    assert response.status_code == 400
    assert response.data["error"]["code"] == "validation_error"
    assert "reason" in response.data["error"]["fields"]
    broker.refresh_from_db()
    assert broker.auto_approve_listings is False


@pytest.mark.django_db
def test_the_flag_is_required(api, workflow_enabled):
    admin = _staff("policy-api-noflag@example.com", StaffGroup.ADMIN)
    broker = make_broker(name="No Flag", slug="no-flag")
    api.force_authenticate(admin)

    response = api.patch(_url(broker), {"reason": "Because."}, format="json")

    assert response.status_code == 400
    assert "auto_approve_listings" in response.data["error"]["fields"]


@pytest.mark.django_db
def test_a_staff_moderator_cannot_toggle_the_policy(api, workflow_enabled):
    """Spec §5: "Configure broker auto-approval" is staff admin only."""
    moderator = _staff("policy-api-mod@example.com", StaffGroup.MODERATOR)
    broker = make_broker(name="Mod Guard", slug="mod-guard")
    api.force_authenticate(moderator)

    response = api.patch(
        _url(broker),
        {"auto_approve_listings": True, "reason": "Trying it on."},
        format="json",
    )

    assert response.status_code == 403
    assert response.data["error"]["code"] == "staff_admin_required"
    broker.refresh_from_db()
    assert broker.auto_approve_listings is False


@pytest.mark.django_db
def test_a_broker_admin_cannot_toggle_their_own_organizations_policy(
    api, workflow_enabled
):
    """Spec §21 acceptance test 2, API half; spec §11.1 "Broker users may see
    the current policy but cannot change it."""
    broker = make_broker(name="Self Serve", slug="self-serve")
    user = make_user("policy-api-broker@example.com", role=UserRole.BROKER, verified=True)
    make_membership(
        user,
        broker,
        role=BrokerMembershipRole.ADMIN,
        can_edit_listings=True,
        can_manage_team=True,
        can_read_messages=True,
    )
    api.force_authenticate(user)

    response = api.patch(
        _url(broker),
        {"auto_approve_listings": True, "reason": "I would like this on."},
        format="json",
    )

    assert response.status_code == 403
    assert response.data["error"]["code"] == "staff_admin_required"
    broker.refresh_from_db()
    assert broker.auto_approve_listings is False
    assert AuditEvent.objects.filter(target_id=str(broker.pk)).count() == 0


@pytest.mark.django_db
def test_an_anonymous_caller_cannot_toggle_the_policy(api, workflow_enabled):
    broker = make_broker(name="Anon Policy", slug="anon-policy")

    response = api.patch(
        _url(broker),
        {"auto_approve_listings": True, "reason": "No."},
        format="json",
    )

    assert response.status_code in (401, 403)
    broker.refresh_from_db()
    assert broker.auto_approve_listings is False


@pytest.mark.django_db
def test_the_endpoint_is_gated_on_the_listing_revisions_flag(api, db):
    """Spec §35.1: flags gate backend mutation, not just UI."""
    set_feature_flag(key="listing_revisions", is_enabled=False, actor=None)
    admin = _staff("policy-api-flag@example.com", StaffGroup.ADMIN)
    broker = make_broker(name="Flagged", slug="flagged")
    api.force_authenticate(admin)

    response = api.patch(
        _url(broker),
        {"auto_approve_listings": True, "reason": "Too early."},
        format="json",
    )

    assert response.status_code == 403
    assert response.data["error"]["code"] == "feature_disabled"


@pytest.mark.django_db
def test_an_unknown_broker_is_a_404(api, workflow_enabled):
    import uuid

    admin = _staff("policy-api-404@example.com", StaffGroup.ADMIN)
    api.force_authenticate(admin)

    response = api.patch(
        reverse("staff-broker-approval-policy", args=[uuid.uuid4()]),
        {"auto_approve_listings": True, "reason": "Nobody home."},
        format="json",
    )

    assert response.status_code == 404
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && uv run pytest brokers/tests/test_approval_policy_api.py -q`

Expected: `NoReverseMatch: Reverse for 'staff-broker-approval-policy' not found`.

- [ ] **Step 3a: Extract the reason message in `backend/brokers/services.py`**

Add the module constant above `clean_policy_reason` and use it in the function, so the serializer and the service can never drift:

```python
POLICY_REASON_REQUIRED_MESSAGE = (
    "Explain why this broker's auto-approval policy is changing."
)
```

and inside `clean_policy_reason`, replace the inline string with `POLICY_REASON_REQUIRED_MESSAGE`.

- [ ] **Step 3b: Append to `backend/brokers/serializers.py`**

Fold into the file's import block:

```python
from rest_framework.exceptions import ErrorDetail

from brokers.services import POLICY_REASON_REQUIRED_MESSAGE
```

Then append:

```python
class BrokerApprovalPolicySerializer(serializers.Serializer):
    """Body of PATCH /api/v1/staff/brokers/<id>/approval-policy/ (spec §30.1).

    The reason is validated here *as well as* inside
    `brokers.services.clean_policy_reason`, deliberately and for the same reason
    Phase 11's `RevisionDecisionSerializer` duplicates its note check: this layer
    turns a missing reason into a 400 with the field named before any row is
    locked, while the service keeps its own check so the rule still holds for
    every non-HTTP caller. The message lives in one constant so the two can
    never drift.

    `required=False, allow_blank=True, default=""` is what makes a *missing*
    `reason` and a *blank* one produce the same stable `policy_reason_required`
    code instead of DRF's generic `required` / `blank`.
    """

    auto_approve_listings = serializers.BooleanField()
    reason = serializers.CharField(
        required=False, allow_blank=True, default="", max_length=500
    )

    def validate_reason(self, value):
        cleaned = (value or "").strip()
        if not cleaned:
            raise serializers.ValidationError(
                ErrorDetail(
                    POLICY_REASON_REQUIRED_MESSAGE, code="policy_reason_required"
                )
            )
        return cleaned
```

- [ ] **Step 3c: Append to `backend/brokers/views.py`**

Fold into the file's import block:

```python
from accounts.permissions import IsStaffAdmin
from brokers.serializers import BrokerApprovalPolicySerializer
from brokers.services import set_broker_auto_approval
from listings.permissions import ListingWorkflowEnabled
```

Then append:

```python
class BrokerApprovalPolicyView(APIView):
    """PATCH /api/v1/staff/brokers/<id>/approval-policy/ (spec §30.1, §21 rule 4).

    The permission stack is the whole security boundary of spec §5's
    "Configure broker auto-approval — staff admin only" row, so it is spelled
    out rather than inherited: authenticated, active, the `listing_revisions`
    flag (spec §35.1 — a policy change is a mutation of listing-workflow
    behaviour), and staff **admin**, which is strictly narrower than the
    IsStaffModerator gate on the read endpoint beside it.

    Returns the whole staff-broker detail payload, not just the flag, so the
    screen's counts, stamps and audit history refresh in one round trip
    (spec §30.2: "Mutations return updated resource/version"). The extra
    `changed` key reports whether anything actually moved — a second click on an
    already-on switch is a 200 with `changed: false` and no new audit row, never
    a silent pretence that a policy change happened.
    """

    permission_classes = [
        IsAuthenticated,
        IsActiveUser,
        ListingWorkflowEnabled,
        IsStaffAdmin,
    ]

    def patch(self, request, broker_id):
        broker = get_object_or_404(BrokerOrganization, pk=broker_id)
        envelope = BrokerApprovalPolicySerializer(data=request.data)
        envelope.is_valid(raise_exception=True)

        change = set_broker_auto_approval(
            broker,
            enabled=envelope.validated_data["auto_approve_listings"],
            actor=request.user,
            reason=envelope.validated_data["reason"],
        )

        payload = StaffBrokerDetailSerializer().to_representation(change.broker)
        payload["changed"] = change.changed
        return Response(payload)
```

- [ ] **Step 3d: Append to `backend/brokers/urls.py`**

Add `BrokerApprovalPolicyView` to the `from brokers.views import ...` line and append to `urlpatterns`:

```python
    path(
        "staff/brokers/<uuid:broker_id>/approval-policy/",
        BrokerApprovalPolicyView.as_view(),
        name="staff-broker-approval-policy",
    ),
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:
```bash
cd backend && uv run pytest brokers -q
cd backend && uv run pytest -q
```

- [ ] **Step 5: Commit**

```bash
git add backend/brokers
git commit -m "feat(brokers): add the staff-admin auto-approval policy endpoint"
```

---

### Task 6: Bulk approve a broker's pending submissions

Spec §21 rule 7: "Staff may bulk approve existing pending broker submissions as a separate explicit action with confirmation and audit."

**Files:**
- Create: `backend/brokers/moderation.py`
- Modify: `backend/brokers/serializers.py` (append)
- Modify: `backend/brokers/views.py` (append)
- Modify: `backend/brokers/urls.py` (append)
- Create: `backend/brokers/tests/test_bulk_approve.py`

**Interfaces:**
- Consumes: `listings.decisions.approve_revision` (unchanged), `listings.enums.RevisionStatus`, `listings.models.ListingRevision`, `brokers.services.POLICY_REASON_REQUIRED_MESSAGE`, `brokers.serializers.StaffBrokerDetailSerializer`, `accounts.permissions.IsStaffModerator`, `listings.permissions.ListingWorkflowEnabled`.
- Produces:
  - `brokers.moderation.BulkApprovalFailure` — frozen dataclass `revision_id: str`, `listing_id: str`, `code: str`, `message: str`.
  - `brokers.moderation.BulkApprovalResult` — frozen dataclass `approved: list[str]`, `failures: list[BulkApprovalFailure]`.
  - `brokers.moderation.bulk_approve_pending_broker_revisions(*, broker, actor, reason: str) -> BulkApprovalResult`
  - `brokers.serializers.BrokerBulkApproveSerializer` — fields `confirm: bool`, `reason: str`.
  - `brokers.views.BrokerPendingApprovalsView`
  - Route name `staff-broker-bulk-approve` at `staff/brokers/<uuid:broker_id>/pending-approvals/`.

**Note (ruling — moderator tier, and a server-side confirmation flag.)** §21 rule 4 restricts the *policy toggle* to staff admin; rule 7 says only "Staff may bulk approve", and §5 gives "Approve listings/revisions" to staff moderator and staff admin alike. Bulk approve is approving listings, so it takes `IsStaffModerator`. "With confirmation" is enforced as a required `confirm: true` body field, not merely as a browser dialog — a dialog is not a control (spec §39: no visual-only implementations).

**Note (ruling — one savepoint per revision; a failure skips, it never publishes.)** Each `approve_revision` call runs inside its own `transaction.atomic()` block, which nests as a savepoint. A revision whose payload, media or base snapshot no longer passes rolls that savepoint back — and Django discards `transaction.on_commit` callbacks registered inside a rolled-back savepoint, so no signal fires for a publication that did not happen — while the rest of the run continues. The failure is reported back with its stable code so staff see exactly what was left for a human. This is what makes spec §21's acceptance test 4 ("Invalid listing never publishes even when auto-approval is on") hold for a hundred listings at once as well as for one.

- [ ] **Step 1: Write the failing test**

Create `backend/brokers/tests/test_bulk_approve.py`:

```python
"""Spec §21 rule 7: bulk approval is a separate, explicitly confirmed, audited
action — and it never publishes something a moderator would have refused."""

import pytest
from django.contrib.auth.models import Group
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from audit.models import AuditEvent
from brokers.enums import BrokerMembershipRole, BrokerOrganizationStatus
from brokers.moderation import bulk_approve_pending_broker_revisions
from brokers.tests.factories import make_broker, make_membership
from listings.enums import ListingStatus, MediaStatus, MediaType, RevisionStatus
from listings.models import ListingSnapshot
from listings.tests.factories import make_broker_listing, make_media, make_revision
from platform_settings.services import set_feature_flag


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def workflow_enabled(db):
    set_feature_flag(key="listing_revisions", is_enabled=True, actor=None)


def _staff(email, group_name):
    user = make_user(email, role=UserRole.STAFF, verified=True)
    user.groups.add(Group.objects.get(name=group_name))
    return user


def _payload(media_id):
    return {
        "title_en": "Bavaria 46, 2019",
        "description_en": "Two cabins, new sails.",
        "specifications": {"length_m": "14.2"},
        "location_country": "ES",
        "location_city": "Barcelona",
        "price": "259000.00",
        "currency": "EUR",
        "media_ids": [str(media_id)],
    }


def _pending_listing(broker, agent, *, valid=True):
    listing = make_broker_listing(
        broker=broker, actor=agent, status=ListingStatus.PENDING_APPROVAL
    )
    image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY)
    payload = _payload(image.pk)
    if not valid:
        payload = {**payload, "title_en": ""}
    revision = make_revision(
        listing,
        state=RevisionStatus.SUBMITTED,
        payload=payload,
        submitted_by=agent,
        submitted_at=timezone.now(),
    )
    return listing, revision


def _broker_with_backlog(slug, email, *, pending=2, invalid=0):
    broker = make_broker(
        name=f"Broker {slug}", slug=slug, status=BrokerOrganizationStatus.ACTIVE
    )
    agent = make_user(email, role=UserRole.BROKER, verified=True)
    make_membership(
        agent,
        broker,
        role=BrokerMembershipRole.ADMIN,
        can_edit_listings=True,
        can_manage_team=True,
        can_read_messages=True,
    )
    rows = [_pending_listing(broker, agent, valid=True) for _ in range(pending)]
    rows += [_pending_listing(broker, agent, valid=False) for _ in range(invalid)]
    return broker, agent, rows


@pytest.mark.django_db
def test_every_valid_pending_submission_is_published():
    moderator = _staff("bulk-mod@example.com", StaffGroup.MODERATOR)
    broker, _, rows = _broker_with_backlog("bulk-all", "bulk-agent@example.com", pending=3)

    result = bulk_approve_pending_broker_revisions(
        broker=broker, actor=moderator, reason="Backlog cleared after onboarding."
    )

    assert len(result.approved) == 3
    assert result.failures == []
    for listing, revision in rows:
        listing.refresh_from_db()
        revision.refresh_from_db()
        assert listing.status == ListingStatus.PUBLISHED
        assert listing.current_public_snapshot.version == 1
        assert revision.state == RevisionStatus.APPROVED
        assert revision.decided_by_id == moderator.pk
        assert revision.decision_note == "Backlog cleared after onboarding."


@pytest.mark.django_db
def test_an_invalid_submission_is_skipped_and_reported_not_published():
    """Spec §21 acceptance test 4, at bulk scale."""
    moderator = _staff("bulk-mixed-mod@example.com", StaffGroup.MODERATOR)
    broker, _, rows = _broker_with_backlog(
        "bulk-mixed", "bulk-mixed-agent@example.com", pending=2, invalid=1
    )

    result = bulk_approve_pending_broker_revisions(
        broker=broker, actor=moderator, reason="Bulk pass."
    )

    assert len(result.approved) == 2
    assert len(result.failures) == 1
    failure = result.failures[0]
    assert failure.code == "validation_error"
    bad_listing, bad_revision = rows[-1]
    assert failure.revision_id == str(bad_revision.pk)
    assert failure.listing_id == str(bad_listing.pk)
    bad_listing.refresh_from_db()
    bad_revision.refresh_from_db()
    assert bad_listing.status == ListingStatus.PENDING_APPROVAL
    assert bad_listing.current_public_snapshot_id is None
    assert bad_revision.state == RevisionStatus.SUBMITTED
    assert ListingSnapshot.objects.filter(listing=bad_listing).count() == 0


@pytest.mark.django_db
def test_the_run_writes_one_aggregate_audit_event():
    moderator = _staff("bulk-audit-mod@example.com", StaffGroup.MODERATOR)
    broker, _, _ = _broker_with_backlog(
        "bulk-audit", "bulk-audit-agent@example.com", pending=1, invalid=1
    )

    bulk_approve_pending_broker_revisions(
        broker=broker, actor=moderator, reason="Documented backlog sweep."
    )

    event = AuditEvent.objects.get(
        target_id=str(broker.pk), action="broker.pending_revisions_bulk_approved"
    )
    assert event.target_type == "brokers.BrokerOrganization"
    assert event.actor_user == moderator
    assert event.before["pending_revision_count"] == 2
    assert event.after["approved_count"] == 1
    assert event.after["failed_count"] == 1
    assert event.metadata["reason"] == "Documented backlog sweep."
    assert len(event.metadata["approved_revision_ids"]) == 1
    assert event.metadata["failures"][0]["code"] == "validation_error"


@pytest.mark.django_db
def test_each_approval_also_writes_its_own_decision_audit_event():
    moderator = _staff("bulk-each-mod@example.com", StaffGroup.MODERATOR)
    broker, _, rows = _broker_with_backlog(
        "bulk-each", "bulk-each-agent@example.com", pending=2
    )

    bulk_approve_pending_broker_revisions(
        broker=broker, actor=moderator, reason="Sweep."
    )

    for _, revision in rows:
        event = AuditEvent.objects.get(
            target_id=str(revision.pk), action="listing.revision_approved"
        )
        assert event.actor_user == moderator


@pytest.mark.django_db
def test_an_empty_backlog_is_a_no_op_that_is_still_audited():
    moderator = _staff("bulk-empty-mod@example.com", StaffGroup.MODERATOR)
    broker = make_broker(name="Nothing Pending", slug="nothing-pending")

    result = bulk_approve_pending_broker_revisions(
        broker=broker, actor=moderator, reason="Checked, nothing to do."
    )

    assert result.approved == []
    assert result.failures == []
    assert AuditEvent.objects.filter(
        target_id=str(broker.pk), action="broker.pending_revisions_bulk_approved"
    ).count() == 1


@pytest.mark.django_db
def test_another_brokers_backlog_is_untouched():
    moderator = _staff("bulk-scope-mod@example.com", StaffGroup.MODERATOR)
    mine, _, _ = _broker_with_backlog("bulk-mine", "bulk-mine-agent@example.com", pending=1)
    theirs, _, their_rows = _broker_with_backlog(
        "bulk-theirs", "bulk-theirs-agent@example.com", pending=1
    )

    bulk_approve_pending_broker_revisions(
        broker=mine, actor=moderator, reason="Only mine."
    )

    listing, revision = their_rows[0]
    listing.refresh_from_db()
    revision.refresh_from_db()
    assert listing.status == ListingStatus.PENDING_APPROVAL
    assert revision.state == RevisionStatus.SUBMITTED


@pytest.mark.django_db
def test_a_moderator_can_run_it_through_the_api(api, workflow_enabled):
    moderator = _staff("bulk-api-mod@example.com", StaffGroup.MODERATOR)
    broker, _, _ = _broker_with_backlog("bulk-api", "bulk-api-agent@example.com", pending=2)
    api.force_authenticate(moderator)

    response = api.post(
        reverse("staff-broker-bulk-approve", args=[broker.pk]),
        {"confirm": True, "reason": "Approved after a call with the agency."},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["approved_count"] == 2
    assert response.data["failed_count"] == 0
    assert response.data["failures"] == []
    # The refreshed detail comes back with the run, so the screen needs no
    # second request (spec §30.2).
    assert response.data["broker"]["pending_revision_count"] == 0
    assert response.data["broker"]["listing_counts"]["by_status"]["PUBLISHED"] == 2


@pytest.mark.django_db
def test_the_api_refuses_an_unconfirmed_run(api, workflow_enabled):
    moderator = _staff("bulk-noconfirm-mod@example.com", StaffGroup.MODERATOR)
    broker, _, rows = _broker_with_backlog(
        "bulk-noconfirm", "bulk-noconfirm-agent@example.com", pending=1
    )
    api.force_authenticate(moderator)

    response = api.post(
        reverse("staff-broker-bulk-approve", args=[broker.pk]),
        {"reason": "Forgot to tick the box."},
        format="json",
    )

    assert response.status_code == 400
    assert "confirm" in response.data["error"]["fields"]
    listing, _ = rows[0]
    listing.refresh_from_db()
    assert listing.status == ListingStatus.PENDING_APPROVAL


@pytest.mark.django_db
def test_the_api_refuses_a_run_with_no_reason(api, workflow_enabled):
    moderator = _staff("bulk-noreason-mod@example.com", StaffGroup.MODERATOR)
    broker, _, _ = _broker_with_backlog(
        "bulk-noreason", "bulk-noreason-agent@example.com", pending=1
    )
    api.force_authenticate(moderator)

    response = api.post(
        reverse("staff-broker-bulk-approve", args=[broker.pk]),
        {"confirm": True},
        format="json",
    )

    assert response.status_code == 400
    assert "reason" in response.data["error"]["fields"]


@pytest.mark.django_db
def test_a_broker_admin_cannot_bulk_approve_their_own_backlog(api, workflow_enabled):
    broker, agent, rows = _broker_with_backlog(
        "bulk-selfserve", "bulk-selfserve-agent@example.com", pending=1
    )
    api.force_authenticate(agent)

    response = api.post(
        reverse("staff-broker-bulk-approve", args=[broker.pk]),
        {"confirm": True, "reason": "Approving my own work."},
        format="json",
    )

    assert response.status_code == 403
    assert response.data["error"]["code"] == "staff_moderator_required"
    listing, _ = rows[0]
    listing.refresh_from_db()
    assert listing.status == ListingStatus.PENDING_APPROVAL


@pytest.mark.django_db
def test_the_endpoint_is_gated_on_the_listing_revisions_flag(api, db):
    set_feature_flag(key="listing_revisions", is_enabled=False, actor=None)
    moderator = _staff("bulk-flag-mod@example.com", StaffGroup.MODERATOR)
    broker, _, _ = _broker_with_backlog("bulk-flag", "bulk-flag-agent@example.com", pending=1)
    api.force_authenticate(moderator)

    response = api.post(
        reverse("staff-broker-bulk-approve", args=[broker.pk]),
        {"confirm": True, "reason": "Too early."},
        format="json",
    )

    assert response.status_code == 403
    assert response.data["error"]["code"] == "feature_disabled"
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && uv run pytest brokers/tests/test_bulk_approve.py -q`

Expected: `ModuleNotFoundError: No module named 'brokers.moderation'`.

- [ ] **Step 3a: Create `backend/brokers/moderation.py`**

```python
"""Bulk approval of a broker's pending submissions (spec §21 rule 7).

  "Staff may bulk approve existing pending broker submissions as a separate
   explicit action with confirmation and audit."

Three words in that sentence shape this module:

  * *separate* — its own endpoint, its own permission check. Enabling the
    auto-approval policy never runs it: spec §21 rule 5 says enabling "affects
    future submissions, not currently pending submissions automatically".
  * *explicit* — the caller must send `confirm: true` and a non-blank reason.
  * *audit* — every individual approval writes its own
    `listing.revision_approved` event through the ordinary decision service, and
    the run as a whole writes one `broker.pending_revisions_bulk_approved`.

`listings.decisions.approve_revision` is reused unchanged, which is the point:
it re-validates the payload, the media and the base snapshot at publication
time, so spec §21's "Invalid listing never publishes even when auto-approval is
on" holds for a hundred listings at once exactly as it does for one. A revision
that no longer validates is skipped and reported, never published.

This module lives in `brokers` rather than `listings` because it is scoped to an
organization, and it is a separate module from `brokers.services` because
`brokers.admin` imports that one at admin-autodiscover time and a cross-app
model import from there has caused an app-loading cycle in this project before.
"""

from dataclasses import asdict, dataclass

from django.db import transaction
from rest_framework.exceptions import APIException, ValidationError

from audit.models import AuditEvent
from audit.services import record_audit_event
from brokers.models import BrokerOrganization
from brokers.services import clean_policy_reason
from listings.decisions import approve_revision
from listings.enums import RevisionStatus
from listings.models import ListingRevision

INVALID_SUBMISSION_MESSAGE = (
    "This submission no longer passes validation and was left for a moderator."
)


@dataclass(frozen=True)
class BulkApprovalFailure:
    revision_id: str
    listing_id: str
    code: str
    message: str


@dataclass(frozen=True)
class BulkApprovalResult:
    approved: list[str]
    failures: list[BulkApprovalFailure]


def _as_failure(revision_id, listing_id, exc: APIException) -> BulkApprovalFailure:
    """Turn whatever approve_revision refused with into one reportable row.

    A DRF ValidationError's `detail` is a field map naming the seller's own
    content, which has no business on a staff bulk-run summary — the staff
    action is "open that listing and look", not "read a field error out of a
    batch report". Everything else (InvalidWorkflowState, StaleVersionConflict)
    carries a single user-safe sentence and a stable code, so those pass through.
    """
    if isinstance(exc, ValidationError):
        code, message = "validation_error", INVALID_SUBMISSION_MESSAGE
    else:
        codes = exc.get_codes()
        code = codes if isinstance(codes, str) else getattr(exc, "default_code", "error")
        message = str(exc.detail)
    return BulkApprovalFailure(
        revision_id=str(revision_id),
        listing_id=str(listing_id),
        code=code,
        message=message,
    )


def bulk_approve_pending_broker_revisions(
    *, broker: BrokerOrganization, actor, reason: str
) -> BulkApprovalResult:
    """Approve every SUBMITTED revision on this broker's listings, one by one.

    Staff-moderator authorization is enforced by the caller
    (`BrokerPendingApprovalsView`), and the `confirm` flag by its serializer:
    this service has no request to answer, and it is also reachable from a
    future management command where "confirmation" means something else.

    Deliberately **not** wrapped in one big transaction. Each approval gets its
    own `transaction.atomic()` block — a savepoint, since `approve_revision` is
    itself atomic — so one bad revision rolls back alone and the rest of the run
    continues. Django discards `transaction.on_commit` callbacks registered
    inside a rolled-back savepoint, so a skipped revision emits no signal either.
    An all-or-nothing transaction would mean one stale draft could block a
    hundred good listings, which is the opposite of what spec §21 rule 7 is for.

    The pending set is snapshotted as a list of ids *before* the loop: the loop
    approves rows, which removes them from the same filter, and iterating a
    live queryset while mutating its rows is how batch jobs skip records.
    """
    cleaned_reason = clean_policy_reason(reason)

    pending = list(
        ListingRevision.objects.filter(
            listing__broker=broker, state=RevisionStatus.SUBMITTED
        )
        .order_by("submitted_at", "pk")
        .values_list("pk", "listing_id")
    )

    approved: list[str] = []
    failures: list[BulkApprovalFailure] = []

    for revision_id, listing_id in pending:
        try:
            with transaction.atomic():
                current = ListingRevision.objects.get(pk=revision_id)
                if current.state != RevisionStatus.SUBMITTED:
                    # Decided by a moderator between the snapshot and now. Not a
                    # failure — somebody already did the work.
                    continue
                approve_revision(
                    revision_id=revision_id,
                    actor=actor,
                    expected_version=current.version,
                    note=cleaned_reason,
                )
        except APIException as exc:
            failures.append(_as_failure(revision_id, listing_id, exc))
        else:
            approved.append(str(revision_id))

    with transaction.atomic():
        record_audit_event(
            actor_user=actor,
            actor_type=AuditEvent.ActorType.USER,
            action="broker.pending_revisions_bulk_approved",
            target_type="brokers.BrokerOrganization",
            target_id=str(broker.pk),
            source=AuditEvent.Source.API,
            before={"pending_revision_count": len(pending)},
            after={"approved_count": len(approved), "failed_count": len(failures)},
            metadata={
                "reason": cleaned_reason,
                "broker_slug": broker.slug,
                "approved_revision_ids": approved,
                "failures": [asdict(failure) for failure in failures],
            },
        )

    return BulkApprovalResult(approved=approved, failures=failures)
```

- [ ] **Step 3b: Append to `backend/brokers/serializers.py`**

```python
class BrokerBulkApproveSerializer(serializers.Serializer):
    """Body of POST /api/v1/staff/brokers/<id>/pending-approvals/ (spec §21 rule 7).

    `confirm` is a server-side control, not a record of a browser dialog: spec
    §39 forbids visual-only implementations, so "with confirmation" has to be
    something the API refuses without. `required=False, default=False` makes an
    omitted flag fail the same way an explicit `false` does.
    """

    confirm = serializers.BooleanField(required=False, default=False)
    reason = serializers.CharField(
        required=False, allow_blank=True, default="", max_length=500
    )

    def validate_confirm(self, value):
        if value is not True:
            raise serializers.ValidationError(
                ErrorDetail(
                    "Confirm that every pending submission for this broker "
                    "should be approved.",
                    code="bulk_approve_not_confirmed",
                )
            )
        return value

    def validate_reason(self, value):
        cleaned = (value or "").strip()
        if not cleaned:
            raise serializers.ValidationError(
                ErrorDetail(
                    "Explain why this broker's pending submissions are being "
                    "approved together.",
                    code="policy_reason_required",
                )
            )
        return cleaned
```

- [ ] **Step 3c: Append to `backend/brokers/views.py`**

Fold into the file's import block:

```python
from dataclasses import asdict

from brokers.moderation import bulk_approve_pending_broker_revisions
from brokers.serializers import BrokerBulkApproveSerializer
```

Then append:

```python
class BrokerPendingApprovalsView(APIView):
    """POST /api/v1/staff/brokers/<id>/pending-approvals/ (spec §21 rule 7).

    IsStaffModerator, not IsStaffAdmin: spec §5 gives "Approve
    listings/revisions" to both tiers, and this action is approving listings —
    many at once — not configuring a policy. The narrower staff-admin gate
    belongs to BrokerApprovalPolicyView beside it.

    Deliberately not `@transaction.atomic`: the service takes one savepoint per
    revision so a single invalid submission cannot block the rest of the run.
    """

    permission_classes = [
        IsAuthenticated,
        IsActiveUser,
        ListingWorkflowEnabled,
        IsStaffModerator,
    ]

    def post(self, request, broker_id):
        broker = get_object_or_404(BrokerOrganization, pk=broker_id)
        envelope = BrokerBulkApproveSerializer(data=request.data)
        envelope.is_valid(raise_exception=True)

        result = bulk_approve_pending_broker_revisions(
            broker=broker,
            actor=request.user,
            reason=envelope.validated_data["reason"],
        )

        broker.refresh_from_db()
        return Response(
            {
                "approved_count": len(result.approved),
                "failed_count": len(result.failures),
                "approved_revision_ids": result.approved,
                "failures": [asdict(failure) for failure in result.failures],
                # The refreshed detail travels with the run so the screen's
                # counts, backlog size and audit history update in one round
                # trip (spec §30.2).
                "broker": StaffBrokerDetailSerializer().to_representation(broker),
            }
        )
```

- [ ] **Step 3d: Append to `backend/brokers/urls.py`**

Add `BrokerPendingApprovalsView` to the `from brokers.views import ...` line and append to `urlpatterns`:

```python
    path(
        "staff/brokers/<uuid:broker_id>/pending-approvals/",
        BrokerPendingApprovalsView.as_view(),
        name="staff-broker-bulk-approve",
    ),
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:
```bash
cd backend && uv run pytest brokers -q
cd backend && uv run pytest -q
```

- [ ] **Step 5: Commit**

```bash
git add backend/brokers
git commit -m "feat(brokers): add the audited bulk approval of a broker's pending submissions"
```

---

### Task 7: The staff broker screen — API module, message dictionary, page shell and overview panel

Spec §21 "Staff broker UI" items 1 (account status) and 2 (listing counts by status), plus the route and the permission boundary that carries items 3–6 in Tasks 8 and 9.

**Note (ruling — this phase builds the screen, not the staff dashboard.)** The page lives at `/dashboard/staff/brokers/<brokerId>/`, matching §26.1's fully-written `/dashboard/staff/products/` and `/dashboard/staff/taxonomy/`. No staff dashboard home, no broker index/search page and **no navigation entry** is added: §26.1 assigns staff navigation to Phase 17 and warns "Do not scatter one workflow across unrelated dashboards", and Phase 3's contract rule 11 forbids adding a nav link in a commit that does not create its target. The screen is reachable by direct URL and by whatever Phase 17's moderation queue links to it. Recorded in Known Limitations.

**Note (ruling — client component, not a server component.)** Every other authenticated screen in this codebase (`/login`, `RequirePermission`) is a client component, because the access token lives in memory in `lib/api/client.ts` and the refresh token is an HttpOnly cookie the browser holds — there is no server-side session to render from. `params` is a Promise in Next 16, so the page awaits it with React's `use()`.

**Files:**
- Create: `frontend/src/lib/api/staffBrokers.ts`
- Create: `frontend/src/lib/i18n/staff-brokers.ts`
- Create: `frontend/src/components/staff/BrokerOverviewPanel.tsx` + `BrokerOverviewPanel.test.tsx`
- Create: `frontend/src/components/staff/StaffBrokerDetailView.tsx` + `StaffBrokerDetailView.test.tsx`
- Create: `frontend/src/app/dashboard/staff/brokers/[brokerId]/page.tsx` + `page.test.tsx`

**Interfaces:**
- Consumes: `apiFetch`/`ApiError` from `@/lib/api/client`; `useSession` from `@/lib/auth/session`; `RequirePermission` from `@/components/auth/RequirePermission`; `resolveLocale`, `DEFAULT_LOCALE` and the `Locale` type from `@/lib/i18n/directory`; the backend route `GET /api/v1/staff/brokers/<id>/` (Task 4).
- Produces:
  - `@/lib/api/staffBrokers`: types `BrokerAccountStatus`, `ListingStatusKey`, `ActorRef`, `BrokerAuditEntry`, `StaffBrokerListingCounts`, `StaffBrokerDetail`; function `fetchStaffBrokerDetail(brokerId: string): Promise<StaffBrokerDetail>`.
  - `@/lib/i18n/staff-brokers`: `STAFF_BROKER_MESSAGES`, `tStaffBroker(locale: Locale, key: string): string`.
  - `@/components/staff/BrokerOverviewPanel` — default export, props `{ locale: Locale; broker: StaffBrokerDetail }`.
  - `@/components/staff/StaffBrokerDetailView` — default export, props `{ brokerId: string }`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/staff/BrokerOverviewPanel.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import BrokerOverviewPanel from "@/components/staff/BrokerOverviewPanel";
import type { StaffBrokerDetail } from "@/lib/api/staffBrokers";

function detail(overrides: Partial<StaffBrokerDetail> = {}): StaffBrokerDetail {
  return {
    id: "b1",
    name: "Blue Marine Brokers",
    slug: "blue-marine-brokers",
    status: "ACTIVE",
    auto_approve_listings: false,
    auto_approve_changed_by: null,
    auto_approve_changed_at: null,
    listing_counts: {
      by_status: {
        DRAFT: 2,
        PENDING_APPROVAL: 1,
        PUBLISHED: 7,
        REJECTED: 0,
        SUSPENDED: 0,
        EXPIRED: 3,
        ARCHIVED: 0,
      },
      total: 13,
    },
    pending_revision_count: 1,
    audit_history: [],
    ...overrides,
  };
}

describe("BrokerOverviewPanel", () => {
  it("shows the account status", () => {
    render(<BrokerOverviewPanel locale="en" broker={detail({ status: "SUSPENDED" })} />);
    expect(screen.getByTestId("broker-account-status")).toHaveTextContent("Suspended");
  });

  it("shows every listing state, including the zeroes", () => {
    render(<BrokerOverviewPanel locale="en" broker={detail()} />);
    expect(screen.getByTestId("listing-count-PUBLISHED")).toHaveTextContent("7");
    expect(screen.getByTestId("listing-count-REJECTED")).toHaveTextContent("0");
    expect(screen.getByTestId("listing-count-ARCHIVED")).toHaveTextContent("0");
    expect(screen.getByTestId("listing-count-total")).toHaveTextContent("13");
  });

  it("translates its labels", () => {
    render(<BrokerOverviewPanel locale="it" broker={detail()} />);
    expect(screen.getByText("Stato dell'account")).toBeInTheDocument();
    expect(screen.getByText("In attesa di approvazione")).toBeInTheDocument();
  });
});
```

Create `frontend/src/components/staff/StaffBrokerDetailView.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import StaffBrokerDetailView from "@/components/staff/StaffBrokerDetailView";
import { ApiError } from "@/lib/api/client";
import type { StaffBrokerDetail } from "@/lib/api/staffBrokers";

const { fetchStaffBrokerDetail, useSessionMock } = vi.hoisted(() => ({
  fetchStaffBrokerDetail: vi.fn(),
  useSessionMock: vi.fn(),
}));

vi.mock("@/lib/api/staffBrokers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/staffBrokers")>()),
  fetchStaffBrokerDetail,
}));

vi.mock("@/lib/auth/session", () => ({ useSession: () => useSessionMock() }));

function detail(): StaffBrokerDetail {
  return {
    id: "b1",
    name: "Blue Marine Brokers",
    slug: "blue-marine-brokers",
    status: "ACTIVE",
    auto_approve_listings: false,
    auto_approve_changed_by: null,
    auto_approve_changed_at: null,
    listing_counts: {
      by_status: {
        DRAFT: 0,
        PENDING_APPROVAL: 0,
        PUBLISHED: 4,
        REJECTED: 0,
        SUSPENDED: 0,
        EXPIRED: 0,
        ARCHIVED: 0,
      },
      total: 4,
    },
    pending_revision_count: 0,
    audit_history: [],
  };
}

function mockSession(locale = "EN", canConfigure = false) {
  useSessionMock.mockReturnValue({
    session: { locale },
    loading: false,
    error: null,
    can: (key: string) => key === "configure_broker_auto_approval" && canConfigure,
    login: vi.fn(),
    logout: vi.fn(),
    reload: vi.fn(),
  });
}

afterEach(() => {
  fetchStaffBrokerDetail.mockReset();
  useSessionMock.mockReset();
});

describe("StaffBrokerDetailView", () => {
  it("shows a loading state, then the broker", async () => {
    mockSession();
    fetchStaffBrokerDetail.mockResolvedValue(detail());

    render(<StaffBrokerDetailView brokerId="b1" />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
    expect(
      await screen.findByRole("heading", { name: "Blue Marine Brokers" }),
    ).toBeInTheDocument();
    expect(fetchStaffBrokerDetail).toHaveBeenCalledWith("b1");
    expect(screen.getByTestId("listing-count-total")).toHaveTextContent("4");
  });

  it("shows a real failure state rather than an empty screen", async () => {
    mockSession();
    fetchStaffBrokerDetail.mockRejectedValue(
      new ApiError(404, "not_found", "No broker matches the given query."),
    );

    render(<StaffBrokerDetailView brokerId="missing" />);

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "This broker could not be loaded.",
      ),
    );
  });

  it("renders in the signed-in user's locale", async () => {
    mockSession("ES");
    fetchStaffBrokerDetail.mockResolvedValue(detail());

    render(<StaffBrokerDetailView brokerId="b1" />);

    expect(await screen.findByText("Estado de la cuenta")).toBeInTheDocument();
  });
});
```

Create `frontend/src/app/dashboard/staff/brokers/[brokerId]/page.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import StaffBrokerPage from "@/app/dashboard/staff/brokers/[brokerId]/page";
import type { PermissionKey, PermissionMap } from "@/lib/auth/types";

const { replace, useSessionMock } = vi.hoisted(() => ({
  replace: vi.fn(),
  useSessionMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => "/dashboard/staff/brokers/b1/",
}));
vi.mock("@/lib/auth/session", () => ({ useSession: () => useSessionMock() }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/components/staff/StaffBrokerDetailView", () => ({
  default: ({ brokerId }: { brokerId: string }) => <p>detail for {brokerId}</p>,
}));

const ALL_FALSE = {
  browse_public_content: true,
  submit_inquiry: false,
  reveal_contact_after_inquiry: false,
  reveal_any_contact: false,
  create_private_listing: false,
  create_broker_listing: false,
  create_listing_on_behalf: false,
  enable_listing_finance_flag: false,
  approve_listings_and_revisions: false,
  configure_broker_auto_approval: false,
  configure_products_and_settings: false,
  manage_taxonomy: false,
} satisfies PermissionMap;

function mockSession(permissions: PermissionMap) {
  useSessionMock.mockReturnValue({
    session: { authenticated: true, locale: "EN", permissions },
    loading: false,
    error: null,
    can: (key: PermissionKey) => permissions[key] === true,
    login: vi.fn(),
    logout: vi.fn(),
    reload: vi.fn(),
  });
}

afterEach(() => {
  replace.mockClear();
  useSessionMock.mockReset();
});

describe("staff broker detail page", () => {
  it("renders the screen for a staff moderator", async () => {
    mockSession({ ...ALL_FALSE, approve_listings_and_revisions: true });

    render(await StaffBrokerPage({ params: Promise.resolve({ brokerId: "b1" }) }));

    expect(screen.getByText("detail for b1")).toBeInTheDocument();
  });

  it("shows the 403 screen to a broker user", async () => {
    // Spec §21 acceptance test 2, UI half: an ordinary broker user cannot reach
    // the auto-approval switch at all, let alone toggle it.
    mockSession({ ...ALL_FALSE, create_broker_listing: true });

    render(await StaffBrokerPage({ params: Promise.resolve({ brokerId: "b1" }) }));

    expect(
      screen.getByRole("heading", { name: /access denied/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText("detail for b1")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && pnpm exec vitest run src/components/staff src/app/dashboard`

Expected: three "Failed to resolve import" errors for the modules this task creates.

- [ ] **Step 3a: Create `frontend/src/lib/api/staffBrokers.ts`**

```ts
// Authenticated staff reads and writes for the broker policy screen
// (spec §21). Uses lib/api/client's browser client — access token, credentials,
// silent refresh on 401, ApiError on every non-2xx — because every route here
// is behind a staff group and there is no unauthenticated variant.
import { apiFetch } from "@/lib/api/client";

export type BrokerAccountStatus = "DRAFT" | "PENDING" | "ACTIVE" | "SUSPENDED";

/** Spec §6.1's listing states, in the order the screen lists them. */
export const LISTING_STATUS_ORDER = [
  "DRAFT",
  "PENDING_APPROVAL",
  "PUBLISHED",
  "REJECTED",
  "SUSPENDED",
  "EXPIRED",
  "ARCHIVED",
] as const;

export type ListingStatusKey = (typeof LISTING_STATUS_ORDER)[number];

export interface ActorRef {
  id: string;
  email: string;
  full_name: string;
}

export interface BrokerAuditEntry {
  id: string;
  action: string;
  actor: ActorRef | null;
  created_at: string;
  reason: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

export interface StaffBrokerListingCounts {
  by_status: Record<ListingStatusKey, number>;
  total: number;
}

export interface StaffBrokerDetail {
  id: string;
  name: string;
  slug: string;
  status: BrokerAccountStatus;
  auto_approve_listings: boolean;
  auto_approve_changed_by: ActorRef | null;
  auto_approve_changed_at: string | null;
  listing_counts: StaffBrokerListingCounts;
  pending_revision_count: number;
  audit_history: BrokerAuditEntry[];
}

export function fetchStaffBrokerDetail(
  brokerId: string,
): Promise<StaffBrokerDetail> {
  return apiFetch<StaffBrokerDetail>(`/api/v1/staff/brokers/${brokerId}/`);
}
```

- [ ] **Step 3b: Create `frontend/src/lib/i18n/staff-brokers.ts`**

```ts
// Spec §37: all new UI text has EN/IT/ES keys and no English is hard-coded
// inside a component. Same typed-dictionary pattern as lib/i18n/directory.ts —
// a dictionary, not an i18n framework (Phase 5's ruling).
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/directory";

type Translations = Record<Locale, string>;

export const STAFF_BROKER_MESSAGES: Record<string, Translations> = {
  "staff.broker.loading": {
    en: "Loading…",
    it: "Caricamento…",
    es: "Cargando…",
  },
  "staff.broker.load_failed": {
    en: "This broker could not be loaded.",
    it: "Impossibile caricare questo broker.",
    es: "No se ha podido cargar este bróker.",
  },
  "staff.broker.account_status": {
    en: "Account status",
    it: "Stato dell'account",
    es: "Estado de la cuenta",
  },
  "staff.broker.status.DRAFT": { en: "Draft", it: "Bozza", es: "Borrador" },
  "staff.broker.status.PENDING": {
    en: "Pending",
    it: "In attesa",
    es: "Pendiente",
  },
  "staff.broker.status.ACTIVE": { en: "Active", it: "Attivo", es: "Activo" },
  "staff.broker.status.SUSPENDED": {
    en: "Suspended",
    it: "Sospeso",
    es: "Suspendido",
  },
  "staff.broker.listing_counts": {
    en: "Listings by status",
    it: "Annunci per stato",
    es: "Anuncios por estado",
  },
  "staff.broker.listing_status.DRAFT": {
    en: "Draft",
    it: "Bozza",
    es: "Borrador",
  },
  "staff.broker.listing_status.PENDING_APPROVAL": {
    en: "Pending approval",
    it: "In attesa di approvazione",
    es: "Pendiente de aprobación",
  },
  "staff.broker.listing_status.PUBLISHED": {
    en: "Published",
    it: "Pubblicati",
    es: "Publicados",
  },
  "staff.broker.listing_status.REJECTED": {
    en: "Rejected",
    it: "Rifiutati",
    es: "Rechazados",
  },
  "staff.broker.listing_status.SUSPENDED": {
    en: "Suspended",
    it: "Sospesi",
    es: "Suspendidos",
  },
  "staff.broker.listing_status.EXPIRED": {
    en: "Expired",
    it: "Scaduti",
    es: "Caducados",
  },
  "staff.broker.listing_status.ARCHIVED": {
    en: "Archived",
    it: "Archiviati",
    es: "Archivados",
  },
  "staff.broker.listing_counts.total": {
    en: "Total",
    it: "Totale",
    es: "Total",
  },
  "staff.broker.no_quota": {
    // Spec §21 rule 1, stated on the screen so staff do not go looking for a
    // quota control that does not exist.
    en: "Broker organisations have no listing quota.",
    it: "Le organizzazioni broker non hanno un limite di annunci.",
    es: "Las organizaciones de bróker no tienen límite de anuncios.",
  },
};

export function tStaffBroker(locale: Locale, key: string): string {
  const translations = STAFF_BROKER_MESSAGES[key];
  if (!translations) {
    throw new Error(`Unknown staff broker message key: ${key}`);
  }
  return translations[locale] || translations[DEFAULT_LOCALE];
}
```

- [ ] **Step 3c: Create `frontend/src/components/staff/BrokerOverviewPanel.tsx`**

```tsx
import {
  LISTING_STATUS_ORDER,
  type StaffBrokerDetail,
} from "@/lib/api/staffBrokers";
import type { Locale } from "@/lib/i18n/directory";
import { tStaffBroker } from "@/lib/i18n/staff-brokers";

/**
 * Spec §21 "Staff broker UI" items 1 and 2: account status and listing counts
 * by status.
 *
 * Every one of spec §6.1's seven states is rendered even at zero, because the
 * backend always sends all seven (spec §26 definition of done: "All visible
 * counters equal query results") and a row that disappears at zero reads as
 * missing data rather than as an answer.
 */
export default function BrokerOverviewPanel({
  locale,
  broker,
}: {
  locale: Locale;
  broker: StaffBrokerDetail;
}) {
  return (
    <section
      aria-labelledby="broker-overview-heading"
      className="rounded-xl border border-outline-variant bg-surface-container-lowest p-space-md"
    >
      <h2
        id="broker-overview-heading"
        className="font-title-lg text-title-lg text-primary"
      >
        {tStaffBroker(locale, "staff.broker.account_status")}
      </h2>
      <p
        data-testid="broker-account-status"
        className="mt-space-xs font-body-md text-on-surface"
      >
        {tStaffBroker(locale, `staff.broker.status.${broker.status}`)}
      </p>

      <h3 className="mt-space-md font-title-md text-title-md text-on-surface">
        {tStaffBroker(locale, "staff.broker.listing_counts")}
      </h3>
      <dl className="mt-space-sm grid grid-cols-2 gap-space-sm sm:grid-cols-4">
        {LISTING_STATUS_ORDER.map((status) => (
          <div
            key={status}
            className="rounded-lg bg-surface-container px-space-sm py-space-xs"
          >
            <dt className="font-body-sm text-on-surface-variant">
              {tStaffBroker(locale, `staff.broker.listing_status.${status}`)}
            </dt>
            <dd
              data-testid={`listing-count-${status}`}
              className="font-title-md text-title-md text-on-surface"
            >
              {broker.listing_counts.by_status[status]}
            </dd>
          </div>
        ))}
        <div className="rounded-lg bg-secondary-container px-space-sm py-space-xs">
          <dt className="font-body-sm text-on-secondary-container">
            {tStaffBroker(locale, "staff.broker.listing_counts.total")}
          </dt>
          <dd
            data-testid="listing-count-total"
            className="font-title-md text-title-md text-on-secondary-container"
          >
            {broker.listing_counts.total}
          </dd>
        </div>
      </dl>
      <p className="mt-space-sm font-body-sm text-on-surface-variant">
        {tStaffBroker(locale, "staff.broker.no_quota")}
      </p>
    </section>
  );
}
```

- [ ] **Step 3d: Create `frontend/src/components/staff/StaffBrokerDetailView.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";

import BrokerOverviewPanel from "@/components/staff/BrokerOverviewPanel";
import { ApiError } from "@/lib/api/client";
import {
  fetchStaffBrokerDetail,
  type StaffBrokerDetail,
} from "@/lib/api/staffBrokers";
import { useSession } from "@/lib/auth/session";
import { resolveLocale } from "@/lib/i18n/directory";
import { tStaffBroker } from "@/lib/i18n/staff-brokers";

/**
 * The staff broker screen's data owner. Tasks 8 and 9 mount their panels here
 * and hand back a refreshed `StaffBrokerDetail` through `applyUpdate`, so the
 * whole screen stays consistent after a mutation without a second GET — every
 * mutation endpoint returns the same detail payload (spec §30.2).
 *
 * The permission gate is the *page*, not this component: it renders whatever
 * the API returned, and the API is the authority (spec §2.2).
 */
export default function StaffBrokerDetailView({
  brokerId,
}: {
  brokerId: string;
}) {
  const { session } = useSession();
  const locale = resolveLocale(session?.locale);
  const [broker, setBroker] = useState<StaffBrokerDetail | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      setBroker(await fetchStaffBrokerDetail(brokerId));
      setFailed(false);
    } catch (caught) {
      // An ApiError or a network failure both mean "there is nothing to show".
      // Spec §2.1: render a real state, never an empty screen.
      setFailed(caught instanceof ApiError || caught instanceof Error);
    }
  }, [brokerId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (failed) {
    return (
      <p role="alert" className="font-body-md text-error">
        {tStaffBroker(locale, "staff.broker.load_failed")}
      </p>
    );
  }

  if (broker === null) {
    return (
      <p role="status" aria-busy="true" className="font-body-md text-on-surface-variant">
        {tStaffBroker(locale, "staff.broker.loading")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-space-lg">
      <header>
        <h1 className="font-headline-md text-headline-md text-primary">
          {broker.name}
        </h1>
        <p className="font-body-sm text-on-surface-variant">{broker.slug}</p>
      </header>
      <BrokerOverviewPanel locale={locale} broker={broker} />
    </div>
  );
}
```

- [ ] **Step 3e: Create `frontend/src/app/dashboard/staff/brokers/[brokerId]/page.tsx`**

```tsx
import RequirePermission from "@/components/auth/RequirePermission";
import StaffBrokerDetailView from "@/components/staff/StaffBrokerDetailView";

/**
 * Spec §21 "Staff broker UI", at spec §4.2's staff `/brokers/` route under the
 * staff dashboard prefix §26.1 writes out in full.
 *
 * The gate is `approve_listings_and_revisions` (staff moderator and above), not
 * `configure_broker_auto_approval` (staff admin only): a moderator working the
 * boats queue needs this broker's status, backlog and policy state, and the
 * switch itself is disabled for them (Task 8). Spec §21's acceptance test 2 —
 * "An ordinary broker user cannot toggle auto-approval through UI or API" — is
 * satisfied here for the UI half: a broker user has neither permission and gets
 * the 403 screen instead of the page.
 *
 * `params` is a Promise in Next 16. This page is a server component that awaits
 * it and hands the plain id to the client component below.
 */
export default async function StaffBrokerPage({
  params,
}: {
  params: Promise<{ brokerId: string }>;
}) {
  const { brokerId } = await params;
  return (
    <main className="mx-auto w-full max-w-4xl p-space-lg">
      <RequirePermission permission="approve_listings_and_revisions">
        <StaffBrokerDetailView brokerId={brokerId} />
      </RequirePermission>
    </main>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:
```bash
cd frontend && pnpm exec vitest run src/components/staff src/app/dashboard
cd frontend && pnpm exec tsc --noEmit
cd frontend && pnpm test
cd frontend && pnpm lint
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): add the staff broker detail screen with account status and listing counts"
```

---

### Task 8: The auto-approval switch, its confirmation dialog and its mandatory reason

Spec §21 "Staff broker UI" items 3, 4 and 5: "Auto-approval switch with current state, last changed by/at", "Confirmation modal explaining future-only effect", "Mandatory reason field". Plus the UI half of acceptance test 2 for a staff *moderator*, who may see the policy but not change it.

**Files:**
- Modify: `frontend/src/lib/api/staffBrokers.ts` (append)
- Modify: `frontend/src/lib/i18n/staff-brokers.ts` (append keys)
- Create: `frontend/src/components/staff/ConfirmPolicyChangeDialog.tsx` + `.test.tsx`
- Create: `frontend/src/components/staff/AutoApprovalPanel.tsx` + `.test.tsx`
- Modify: `frontend/src/components/staff/StaffBrokerDetailView.tsx` (mount the panel)
- Modify: `frontend/src/components/staff/StaffBrokerDetailView.test.tsx` (one added assertion)

**Interfaces:**
- Consumes: `fetchStaffBrokerDetail`/`StaffBrokerDetail` (Task 7), `tStaffBroker` (Task 7), `useSession().can` (Phase 3), the backend route `PATCH /api/v1/staff/brokers/<id>/approval-policy/` (Task 5).
- Produces:
  - `@/lib/api/staffBrokers`: `PolicyUpdateResponse` (= `StaffBrokerDetail & { changed: boolean }`) and `setBrokerAutoApproval(brokerId: string, input: { enabled: boolean; reason: string }): Promise<PolicyUpdateResponse>`.
  - `@/components/staff/ConfirmPolicyChangeDialog` — default export, props `{ locale: Locale; title: string; body: string; submitting: boolean; error: string | null; onConfirm: (reason: string) => void; onCancel: () => void }`.
  - `@/components/staff/AutoApprovalPanel` — default export, props `{ locale: Locale; broker: StaffBrokerDetail; canConfigure: boolean; onUpdated: (broker: StaffBrokerDetail) => void }`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/staff/ConfirmPolicyChangeDialog.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import ConfirmPolicyChangeDialog from "@/components/staff/ConfirmPolicyChangeDialog";

function renderDialog(overrides = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ConfirmPolicyChangeDialog
      locale="en"
      title="Confirm the policy change"
      body="Turning this on affects future submissions only."
      submitting={false}
      error={null}
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...overrides}
    />,
  );
  return { onConfirm, onCancel };
}

describe("ConfirmPolicyChangeDialog", () => {
  it("explains the future-only effect", () => {
    renderDialog();
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Turning this on affects future submissions only.",
    );
  });

  it("refuses to confirm without a reason", async () => {
    const { onConfirm } = renderDialog();

    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a reason before confirming.",
    );
  });

  it("refuses to confirm on whitespace alone", async () => {
    const { onConfirm } = renderDialog();

    await userEvent.type(screen.getByLabelText(/reason/i), "   ");
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("passes the trimmed reason up", async () => {
    const { onConfirm } = renderDialog();

    await userEvent.type(screen.getByLabelText(/reason/i), "  Vetted partner. ");
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(onConfirm).toHaveBeenCalledWith("Vetted partner.");
  });

  it("cancels without confirming", async () => {
    const { onCancel, onConfirm } = renderDialog();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("shows a server error and disables the buttons while saving", () => {
    renderDialog({ submitting: true, error: "The change could not be saved." });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "The change could not be saved.",
    );
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  });
});
```

Create `frontend/src/components/staff/AutoApprovalPanel.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import AutoApprovalPanel from "@/components/staff/AutoApprovalPanel";
import { ApiError } from "@/lib/api/client";
import type { StaffBrokerDetail } from "@/lib/api/staffBrokers";

const { setBrokerAutoApproval } = vi.hoisted(() => ({
  setBrokerAutoApproval: vi.fn(),
}));

vi.mock("@/lib/api/staffBrokers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/staffBrokers")>()),
  setBrokerAutoApproval,
}));

function detail(overrides: Partial<StaffBrokerDetail> = {}): StaffBrokerDetail {
  return {
    id: "b1",
    name: "Blue Marine Brokers",
    slug: "blue-marine-brokers",
    status: "ACTIVE",
    auto_approve_listings: false,
    auto_approve_changed_by: null,
    auto_approve_changed_at: null,
    listing_counts: {
      by_status: {
        DRAFT: 0,
        PENDING_APPROVAL: 0,
        PUBLISHED: 0,
        REJECTED: 0,
        SUSPENDED: 0,
        EXPIRED: 0,
        ARCHIVED: 0,
      },
      total: 0,
    },
    pending_revision_count: 0,
    audit_history: [],
    ...overrides,
  };
}

afterEach(() => setBrokerAutoApproval.mockReset());

describe("AutoApprovalPanel", () => {
  it("shows the current state and that it has never been changed", () => {
    render(
      <AutoApprovalPanel
        locale="en"
        broker={detail()}
        canConfigure
        onUpdated={vi.fn()}
      />,
    );

    expect(screen.getByTestId("auto-approval-state")).toHaveTextContent("Off");
    expect(screen.getByText("Never changed.")).toBeInTheDocument();
  });

  it("shows who last changed it and when", () => {
    render(
      <AutoApprovalPanel
        locale="en"
        broker={detail({
          auto_approve_listings: true,
          auto_approve_changed_by: {
            id: "u1",
            email: "admin@nauta.example",
            full_name: "Ada Admin",
          },
          auto_approve_changed_at: "2026-09-18T10:30:00Z",
        })}
        canConfigure
        onUpdated={vi.fn()}
      />,
    );

    expect(screen.getByTestId("auto-approval-state")).toHaveTextContent("On");
    expect(screen.getByTestId("auto-approval-last-changed")).toHaveTextContent(
      "Ada Admin",
    );
    expect(screen.getByTestId("auto-approval-last-changed")).toHaveTextContent(
      "2026",
    );
  });

  it("disables the switch for a user without the staff-admin permission", () => {
    // Spec §21 acceptance test 2 and spec §5: only staff admin may configure
    // the policy. A moderator sees it and cannot move it.
    render(
      <AutoApprovalPanel
        locale="en"
        broker={detail()}
        canConfigure={false}
        onUpdated={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Turn on automatic approval" }),
    ).toBeDisabled();
    expect(
      screen.getByText("Only a staff administrator can change this policy."),
    ).toBeInTheDocument();
  });

  it("explains the future-only effect of turning the policy on", async () => {
    render(
      <AutoApprovalPanel
        locale="en"
        broker={detail()}
        canConfigure
        onUpdated={vi.fn()}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Turn on automatic approval" }),
    );

    expect(screen.getByRole("dialog")).toHaveTextContent(
      "affects future submissions only",
    );
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "stay in the queue until somebody decides them",
    );
  });

  it("explains the future-only effect of turning the policy off", async () => {
    render(
      <AutoApprovalPanel
        locale="en"
        broker={detail({ auto_approve_listings: true })}
        canConfigure
        onUpdated={vi.fn()}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Turn off automatic approval" }),
    );

    expect(screen.getByRole("dialog")).toHaveTextContent("stay live");
  });

  it("sends the toggle with its reason and hands the refreshed broker up", async () => {
    const onUpdated = vi.fn();
    const refreshed = { ...detail({ auto_approve_listings: true }), changed: true };
    setBrokerAutoApproval.mockResolvedValue(refreshed);
    render(
      <AutoApprovalPanel
        locale="en"
        broker={detail()}
        canConfigure
        onUpdated={onUpdated}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Turn on automatic approval" }),
    );
    await userEvent.type(screen.getByLabelText(/reason/i), "Vetted partner.");
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() =>
      expect(setBrokerAutoApproval).toHaveBeenCalledWith("b1", {
        enabled: true,
        reason: "Vetted partner.",
      }),
    );
    expect(onUpdated).toHaveBeenCalledWith(refreshed);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the dialog open and shows the server message when the save fails", async () => {
    const onUpdated = vi.fn();
    setBrokerAutoApproval.mockRejectedValue(
      new ApiError(403, "staff_admin_required", "Staff administrator access is required."),
    );
    render(
      <AutoApprovalPanel
        locale="en"
        broker={detail()}
        canConfigure
        onUpdated={onUpdated}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Turn on automatic approval" }),
    );
    await userEvent.type(screen.getByLabelText(/reason/i), "Trying it on.");
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Staff administrator access is required.",
      ),
    );
    expect(onUpdated).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
```

Append one assertion to `frontend/src/components/staff/StaffBrokerDetailView.test.tsx`'s first test:

```tsx
    expect(screen.getByTestId("auto-approval-state")).toHaveTextContent("Off");
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && pnpm exec vitest run src/components/staff`

Expected: unresolved imports for `ConfirmPolicyChangeDialog` and `AutoApprovalPanel`, and `setBrokerAutoApproval` missing from the API module.

- [ ] **Step 3a: Append to `frontend/src/lib/api/staffBrokers.ts`**

```ts
/**
 * The policy PATCH returns the whole refreshed detail plus `changed` — false
 * when the switch was already in the requested state, so the screen can say so
 * instead of implying a change happened (spec §30.2).
 */
export type PolicyUpdateResponse = StaffBrokerDetail & { changed: boolean };

export function setBrokerAutoApproval(
  brokerId: string,
  { enabled, reason }: { enabled: boolean; reason: string },
): Promise<PolicyUpdateResponse> {
  return apiFetch<PolicyUpdateResponse>(
    `/api/v1/staff/brokers/${brokerId}/approval-policy/`,
    {
      method: "PATCH",
      body: JSON.stringify({ auto_approve_listings: enabled, reason }),
    },
  );
}
```

- [ ] **Step 3b: Append the message keys to `frontend/src/lib/i18n/staff-brokers.ts`**

Add inside `STAFF_BROKER_MESSAGES`:

```ts
  "staff.broker.auto_approval": {
    en: "Automatic approval",
    it: "Approvazione automatica",
    es: "Aprobación automática",
  },
  "staff.broker.auto_approval.on": { en: "On", it: "Attiva", es: "Activada" },
  "staff.broker.auto_approval.off": {
    en: "Off",
    it: "Disattivata",
    es: "Desactivada",
  },
  "staff.broker.auto_approval.enable": {
    en: "Turn on automatic approval",
    it: "Attiva l'approvazione automatica",
    es: "Activar la aprobación automática",
  },
  "staff.broker.auto_approval.disable": {
    en: "Turn off automatic approval",
    it: "Disattiva l'approvazione automatica",
    es: "Desactivar la aprobación automática",
  },
  "staff.broker.auto_approval.last_changed": {
    en: "Last changed by",
    it: "Ultima modifica di",
    es: "Última modificación por",
  },
  "staff.broker.auto_approval.never_changed": {
    en: "Never changed.",
    it: "Mai modificata.",
    es: "Nunca modificada.",
  },
  "staff.broker.auto_approval.readonly": {
    en: "Only a staff administrator can change this policy.",
    it: "Solo un amministratore dello staff può modificare questa politica.",
    es: "Solo un administrador del equipo puede cambiar esta política.",
  },
  "staff.broker.auto_approval.confirm_title": {
    en: "Confirm the policy change",
    it: "Conferma la modifica della politica",
    es: "Confirma el cambio de política",
  },
  "staff.broker.auto_approval.confirm_enable": {
    // Spec §21 rule 5, said in the confirmation modal spec §21 requires.
    en: "Turning this on affects future submissions only. Submissions already waiting for a moderator stay in the queue until somebody decides them.",
    it: "L'attivazione riguarda solo gli invii futuri. Gli invii già in attesa di un moderatore restano in coda finché qualcuno non li decide.",
    es: "Activarla afecta solo a los envíos futuros. Los envíos que ya esperan a un moderador permanecen en la cola hasta que alguien los decida.",
  },
  "staff.broker.auto_approval.confirm_disable": {
    // Spec §21 rule 6.
    en: "Turning this off affects future submissions only. Listings that are already published stay live unless they are moderated.",
    it: "La disattivazione riguarda solo gli invii futuri. Gli annunci già pubblicati restano online salvo moderazione.",
    es: "Desactivarla afecta solo a los envíos futuros. Los anuncios ya publicados siguen visibles salvo que se moderen.",
  },
  "staff.broker.reason_label": {
    en: "Reason (required)",
    it: "Motivo (obbligatorio)",
    es: "Motivo (obligatorio)",
  },
  "staff.broker.reason_required": {
    en: "Enter a reason before confirming.",
    it: "Inserisci un motivo prima di confermare.",
    es: "Introduce un motivo antes de confirmar.",
  },
  "staff.broker.confirm": { en: "Confirm", it: "Conferma", es: "Confirmar" },
  "staff.broker.cancel": { en: "Cancel", it: "Annulla", es: "Cancelar" },
  "staff.broker.saving": {
    en: "Saving…",
    it: "Salvataggio…",
    es: "Guardando…",
  },
  "staff.broker.save_failed": {
    en: "The change could not be saved.",
    it: "Impossibile salvare la modifica.",
    es: "No se ha podido guardar el cambio.",
  },
  "staff.broker.no_change": {
    en: "The policy was already in that state. Nothing changed.",
    it: "La politica era già in questo stato. Nessuna modifica.",
    es: "La política ya estaba en ese estado. No ha cambiado nada.",
  },
```

- [ ] **Step 3c: Create `frontend/src/components/staff/ConfirmPolicyChangeDialog.tsx`**

```tsx
"use client";

import { useState } from "react";

import type { Locale } from "@/lib/i18n/directory";
import { tStaffBroker } from "@/lib/i18n/staff-brokers";

/**
 * Spec §21 "Staff broker UI" items 4 and 5: the confirmation modal that
 * explains the future-only effect, and the mandatory reason field.
 *
 * It owns the reason and the client-side "is it blank" check only. The server
 * enforces the same rule again (`policy_reason_required`), because a browser
 * dialog is not a control — spec §39 forbids visual-only implementations. Shared
 * by the policy toggle (Task 8) and the bulk approve (Task 9), which differ only
 * in their title and body copy.
 */
export default function ConfirmPolicyChangeDialog({
  locale,
  title,
  body,
  submitting,
  error,
  onConfirm,
  onCancel,
}: {
  locale: Locale;
  title: string;
  body: string;
  submitting: boolean;
  error: string | null;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const [blank, setBlank] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleaned = reason.trim();
    if (!cleaned) {
      setBlank(true);
      return;
    }
    setBlank(false);
    onConfirm(cleaned);
  }

  // `error` comes from the server and always wins: a stale local "blank"
  // message must not hide the reason the save actually failed.
  const message = error ?? (blank ? tStaffBroker(locale, "staff.broker.reason_required") : null);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="mt-space-md rounded-xl border border-outline bg-surface-container p-space-md"
    >
      <h3 className="font-title-md text-title-md text-on-surface">{title}</h3>
      <p className="mt-space-xs font-body-md text-on-surface-variant">{body}</p>
      <form onSubmit={handleSubmit} className="mt-space-sm flex flex-col gap-space-sm">
        <label className="font-label-md text-label-md" htmlFor="policy-change-reason">
          {tStaffBroker(locale, "staff.broker.reason_label")}
          <textarea
            id="policy-change-reason"
            name="reason"
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="mt-space-xs w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-space-sm font-body-md"
          />
        </label>
        {message ? (
          <p role="alert" className="font-body-sm text-error">
            {message}
          </p>
        ) : null}
        <div className="flex gap-space-sm">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-primary px-space-md py-space-sm font-label-md text-label-md text-on-primary disabled:opacity-50"
          >
            {submitting
              ? tStaffBroker(locale, "staff.broker.saving")
              : tStaffBroker(locale, "staff.broker.confirm")}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-lg border border-outline px-space-md py-space-sm font-label-md text-label-md text-on-surface disabled:opacity-50"
          >
            {tStaffBroker(locale, "staff.broker.cancel")}
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 3d: Create `frontend/src/components/staff/AutoApprovalPanel.tsx`**

```tsx
"use client";

import { useState } from "react";

import ConfirmPolicyChangeDialog from "@/components/staff/ConfirmPolicyChangeDialog";
import { ApiError } from "@/lib/api/client";
import {
  setBrokerAutoApproval,
  type StaffBrokerDetail,
} from "@/lib/api/staffBrokers";
import type { Locale } from "@/lib/i18n/directory";
import { tStaffBroker } from "@/lib/i18n/staff-brokers";

/**
 * Spec §21 "Staff broker UI" item 3: the auto-approval switch with its current
 * state and last changed by/at, wired to the staff-admin-only endpoint.
 *
 * `canConfigure` comes from spec §5's `configure_broker_auto_approval`
 * permission, which the session already reports. It disables the control — it
 * is *not* the security boundary: `IsStaffAdmin` on the endpoint is (spec §2.2).
 * A staff moderator therefore sees the policy, which is what they need for the
 * boats queue, and cannot move it.
 */
export default function AutoApprovalPanel({
  locale,
  broker,
  canConfigure,
  onUpdated,
}: {
  locale: Locale;
  broker: StaffBrokerDetail;
  canConfigure: boolean;
  onUpdated: (broker: StaffBrokerDetail) => void;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const enabled = broker.auto_approve_listings;
  const target = !enabled;

  async function handleConfirm(reason: string) {
    setSubmitting(true);
    setError(null);
    try {
      const updated = await setBrokerAutoApproval(broker.id, {
        enabled: target,
        reason,
      });
      setOpen(false);
      setNotice(
        updated.changed ? null : tStaffBroker(locale, "staff.broker.no_change"),
      );
      onUpdated(updated);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : tStaffBroker(locale, "staff.broker.save_failed"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      aria-labelledby="auto-approval-heading"
      className="rounded-xl border border-outline-variant bg-surface-container-lowest p-space-md"
    >
      <h2
        id="auto-approval-heading"
        className="font-title-lg text-title-lg text-primary"
      >
        {tStaffBroker(locale, "staff.broker.auto_approval")}
      </h2>
      <p
        data-testid="auto-approval-state"
        className="mt-space-xs font-title-md text-title-md text-on-surface"
      >
        {tStaffBroker(
          locale,
          enabled
            ? "staff.broker.auto_approval.on"
            : "staff.broker.auto_approval.off",
        )}
      </p>

      <p
        data-testid="auto-approval-last-changed"
        className="mt-space-xs font-body-sm text-on-surface-variant"
      >
        {broker.auto_approve_changed_at === null
          ? tStaffBroker(locale, "staff.broker.auto_approval.never_changed")
          : `${tStaffBroker(locale, "staff.broker.auto_approval.last_changed")}: ${
              broker.auto_approve_changed_by?.full_name ||
              broker.auto_approve_changed_by?.email ||
              ""
            } — ${new Date(broker.auto_approve_changed_at).toISOString()}`}
      </p>

      {notice ? (
        <p role="status" className="mt-space-xs font-body-sm text-on-surface-variant">
          {notice}
        </p>
      ) : null}

      <button
        type="button"
        disabled={!canConfigure || open}
        onClick={() => {
          setError(null);
          setNotice(null);
          setOpen(true);
        }}
        className="mt-space-sm rounded-lg bg-primary px-space-md py-space-sm font-label-md text-label-md text-on-primary disabled:opacity-50"
      >
        {tStaffBroker(
          locale,
          target
            ? "staff.broker.auto_approval.enable"
            : "staff.broker.auto_approval.disable",
        )}
      </button>

      {canConfigure ? null : (
        <p className="mt-space-xs font-body-sm text-on-surface-variant">
          {tStaffBroker(locale, "staff.broker.auto_approval.readonly")}
        </p>
      )}

      {open ? (
        <ConfirmPolicyChangeDialog
          locale={locale}
          title={tStaffBroker(
            locale,
            "staff.broker.auto_approval.confirm_title",
          )}
          body={tStaffBroker(
            locale,
            target
              ? "staff.broker.auto_approval.confirm_enable"
              : "staff.broker.auto_approval.confirm_disable",
          )}
          submitting={submitting}
          error={error}
          onConfirm={handleConfirm}
          onCancel={() => {
            setOpen(false);
            setError(null);
          }}
        />
      ) : null}
    </section>
  );
}
```

- [ ] **Step 3e: Mount the panel in `StaffBrokerDetailView.tsx`**

Add the imports:

```tsx
import AutoApprovalPanel from "@/components/staff/AutoApprovalPanel";
```

and change the returned tree so the panel sits below the overview:

```tsx
      <BrokerOverviewPanel locale={locale} broker={broker} />
      <AutoApprovalPanel
        locale={locale}
        broker={broker}
        canConfigure={can("configure_broker_auto_approval")}
        // Every mutation endpoint returns the same detail payload, so the whole
        // screen — counts, stamps, audit history — refreshes from the response
        // with no second GET (spec §30.2).
        onUpdated={setBroker}
      />
```

and pull `can` out of the session hook at the top of the component:

```tsx
  const { session, can } = useSession();
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:
```bash
cd frontend && pnpm exec vitest run src/components/staff src/app/dashboard
cd frontend && pnpm exec tsc --noEmit
cd frontend && pnpm test && pnpm lint
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): add the staff auto-approval switch with its confirmation and mandatory reason"
```

---

### Task 9: Audit history and the bulk-approve action

Spec §21 "Staff broker UI" item 6 ("Audit history") and rule 7's "separate explicit action with confirmation and audit", now with a control behind it.

**Files:**
- Modify: `frontend/src/lib/api/staffBrokers.ts` (append)
- Modify: `frontend/src/lib/i18n/staff-brokers.ts` (append keys)
- Create: `frontend/src/components/staff/BrokerAuditHistory.tsx` + `.test.tsx`
- Create: `frontend/src/components/staff/BulkApprovePanel.tsx` + `.test.tsx`
- Modify: `frontend/src/components/staff/StaffBrokerDetailView.tsx` (mount both)

**Interfaces:**
- Consumes: `StaffBrokerDetail`/`BrokerAuditEntry` (Task 7), `ConfirmPolicyChangeDialog` (Task 8), the backend route `POST /api/v1/staff/brokers/<id>/pending-approvals/` (Task 6).
- Produces:
  - `@/lib/api/staffBrokers`: `BulkApproveFailure`, `BulkApproveResponse`, `bulkApprovePendingSubmissions(brokerId: string, input: { reason: string }): Promise<BulkApproveResponse>`.
  - `@/components/staff/BrokerAuditHistory` — default export, props `{ locale: Locale; entries: BrokerAuditEntry[] }`.
  - `@/components/staff/BulkApprovePanel` — default export, props `{ locale: Locale; broker: StaffBrokerDetail; onUpdated: (broker: StaffBrokerDetail) => void }`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/staff/BrokerAuditHistory.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import BrokerAuditHistory from "@/components/staff/BrokerAuditHistory";
import type { BrokerAuditEntry } from "@/lib/api/staffBrokers";

const entries: BrokerAuditEntry[] = [
  {
    id: "e1",
    action: "broker.auto_approval_changed",
    actor: { id: "u1", email: "admin@nauta.example", full_name: "Ada Admin" },
    created_at: "2026-09-18T10:30:00Z",
    reason: "Vetted partner, 8 years.",
    before: { auto_approve_listings: false },
    after: { auto_approve_listings: true },
  },
  {
    id: "e2",
    action: "broker.pending_revisions_bulk_approved",
    actor: { id: "u2", email: "mod@nauta.example", full_name: "" },
    created_at: "2026-09-18T11:00:00Z",
    reason: "Backlog sweep.",
    before: { pending_revision_count: 4 },
    after: { approved_count: 4, failed_count: 0 },
  },
];

describe("BrokerAuditHistory", () => {
  it("names the action, the actor and the reason for each entry", () => {
    render(<BrokerAuditHistory locale="en" entries={entries} />);

    expect(screen.getByText("Automatic approval changed")).toBeInTheDocument();
    expect(screen.getByText("Pending submissions approved in bulk")).toBeInTheDocument();
    expect(screen.getByText(/Vetted partner, 8 years\./)).toBeInTheDocument();
    expect(screen.getByText(/Ada Admin/)).toBeInTheDocument();
    // No full_name: fall back to the email rather than rendering an empty cell.
    expect(screen.getByText(/mod@nauta\.example/)).toBeInTheDocument();
  });

  it("renders an unknown action as its raw code rather than crashing", () => {
    render(
      <BrokerAuditHistory
        locale="en"
        entries={[{ ...entries[0], action: "broker.something_new" }]}
      />,
    );

    expect(screen.getByText("broker.something_new")).toBeInTheDocument();
  });

  it("shows a real empty state", () => {
    render(<BrokerAuditHistory locale="en" entries={[]} />);

    expect(
      screen.getByText("No policy changes recorded yet."),
    ).toBeInTheDocument();
  });
});
```

Create `frontend/src/components/staff/BulkApprovePanel.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import BulkApprovePanel from "@/components/staff/BulkApprovePanel";
import type { StaffBrokerDetail } from "@/lib/api/staffBrokers";

const { bulkApprovePendingSubmissions } = vi.hoisted(() => ({
  bulkApprovePendingSubmissions: vi.fn(),
}));

vi.mock("@/lib/api/staffBrokers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/staffBrokers")>()),
  bulkApprovePendingSubmissions,
}));

function detail(pending: number): StaffBrokerDetail {
  return {
    id: "b1",
    name: "Blue Marine Brokers",
    slug: "blue-marine-brokers",
    status: "ACTIVE",
    auto_approve_listings: true,
    auto_approve_changed_by: null,
    auto_approve_changed_at: null,
    listing_counts: {
      by_status: {
        DRAFT: 0,
        PENDING_APPROVAL: pending,
        PUBLISHED: 0,
        REJECTED: 0,
        SUSPENDED: 0,
        EXPIRED: 0,
        ARCHIVED: 0,
      },
      total: pending,
    },
    pending_revision_count: pending,
    audit_history: [],
  };
}

afterEach(() => bulkApprovePendingSubmissions.mockReset());

describe("BulkApprovePanel", () => {
  it("shows the backlog size", () => {
    render(<BulkApprovePanel locale="en" broker={detail(4)} onUpdated={vi.fn()} />);
    expect(screen.getByTestId("pending-revision-count")).toHaveTextContent("4");
  });

  it("offers no action and says so when nothing is pending", () => {
    render(<BulkApprovePanel locale="en" broker={detail(0)} onUpdated={vi.fn()} />);

    expect(
      screen.getByText("There is nothing waiting for a decision."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Approve all pending submissions" }),
    ).not.toBeInTheDocument();
  });

  it("requires an explicit confirmation with a reason", async () => {
    render(<BulkApprovePanel locale="en" broker={detail(2)} onUpdated={vi.fn()} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Approve all pending submissions" }),
    );

    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Anything that no longer validates is left for a moderator.",
    );

    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(bulkApprovePendingSubmissions).not.toHaveBeenCalled();
  });

  it("reports how many were approved and how many were left behind", async () => {
    const onUpdated = vi.fn();
    const refreshed = detail(1);
    bulkApprovePendingSubmissions.mockResolvedValue({
      approved_count: 3,
      failed_count: 1,
      approved_revision_ids: ["r1", "r2", "r3"],
      failures: [
        {
          revision_id: "r4",
          listing_id: "l4",
          code: "validation_error",
          message: "This submission no longer passes validation.",
        },
      ],
      broker: refreshed,
    });
    render(<BulkApprovePanel locale="en" broker={detail(4)} onUpdated={onUpdated} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Approve all pending submissions" }),
    );
    await userEvent.type(screen.getByLabelText(/reason/i), "Backlog sweep.");
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() =>
      expect(bulkApprovePendingSubmissions).toHaveBeenCalledWith("b1", {
        reason: "Backlog sweep.",
      }),
    );
    expect(screen.getByTestId("bulk-approved-count")).toHaveTextContent("3");
    expect(screen.getByTestId("bulk-failed-count")).toHaveTextContent("1");
    expect(screen.getByText(/l4/)).toBeInTheDocument();
    expect(onUpdated).toHaveBeenCalledWith(refreshed);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && pnpm exec vitest run src/components/staff`

Expected: unresolved imports for `BrokerAuditHistory` and `BulkApprovePanel`.

- [ ] **Step 3a: Append to `frontend/src/lib/api/staffBrokers.ts`**

```ts
export interface BulkApproveFailure {
  revision_id: string;
  listing_id: string;
  code: string;
  message: string;
}

export interface BulkApproveResponse {
  approved_count: number;
  failed_count: number;
  approved_revision_ids: string[];
  failures: BulkApproveFailure[];
  /** The refreshed detail travels with the run (spec §30.2). */
  broker: StaffBrokerDetail;
}

export function bulkApprovePendingSubmissions(
  brokerId: string,
  { reason }: { reason: string },
): Promise<BulkApproveResponse> {
  return apiFetch<BulkApproveResponse>(
    `/api/v1/staff/brokers/${brokerId}/pending-approvals/`,
    {
      method: "POST",
      // `confirm` is a server-side control (spec §21 rule 7's "explicit action
      // with confirmation"); this client only ever sends it after the dialog
      // has been confirmed with a reason.
      body: JSON.stringify({ confirm: true, reason }),
    },
  );
}
```

- [ ] **Step 3b: Append the message keys to `frontend/src/lib/i18n/staff-brokers.ts`**

```ts
  "staff.broker.audit_history": {
    en: "Policy audit history",
    it: "Cronologia delle modifiche alla politica",
    es: "Historial de auditoría de la política",
  },
  "staff.broker.audit_empty": {
    en: "No policy changes recorded yet.",
    it: "Nessuna modifica registrata.",
    es: "Todavía no hay cambios registrados.",
  },
  "staff.broker.audit.broker.auto_approval_changed": {
    en: "Automatic approval changed",
    it: "Approvazione automatica modificata",
    es: "Aprobación automática modificada",
  },
  "staff.broker.audit.broker.pending_revisions_bulk_approved": {
    en: "Pending submissions approved in bulk",
    it: "Invii in attesa approvati in blocco",
    es: "Envíos pendientes aprobados en bloque",
  },
  "staff.broker.bulk.title": {
    en: "Pending submissions",
    it: "Invii in attesa",
    es: "Envíos pendientes",
  },
  "staff.broker.bulk.count": {
    en: "Submissions waiting for a decision",
    it: "Invii in attesa di una decisione",
    es: "Envíos a la espera de una decisión",
  },
  "staff.broker.bulk.none": {
    en: "There is nothing waiting for a decision.",
    it: "Non c'è nulla in attesa di una decisione.",
    es: "No hay nada a la espera de una decisión.",
  },
  "staff.broker.bulk.action": {
    en: "Approve all pending submissions",
    it: "Approva tutti gli invii in attesa",
    es: "Aprobar todos los envíos pendientes",
  },
  "staff.broker.bulk.confirm_title": {
    en: "Approve every pending submission",
    it: "Approva ogni invio in attesa",
    es: "Aprobar todos los envíos pendientes",
  },
  "staff.broker.bulk.confirm_body": {
    en: "Every pending submission that still passes validation is published immediately. Anything that no longer validates is left for a moderator.",
    it: "Ogni invio in attesa che supera ancora la validazione viene pubblicato subito. Tutto ciò che non la supera più resta a un moderatore.",
    es: "Todos los envíos pendientes que sigan superando la validación se publican de inmediato. Lo que ya no la supere se deja para un moderador.",
  },
  "staff.broker.bulk.approved": {
    en: "Approved",
    it: "Approvati",
    es: "Aprobados",
  },
  "staff.broker.bulk.failed": {
    en: "Left for a moderator",
    it: "Lasciati a un moderatore",
    es: "Dejados para un moderador",
  },
```

- [ ] **Step 3c: Create `frontend/src/components/staff/BrokerAuditHistory.tsx`**

```tsx
import type { BrokerAuditEntry } from "@/lib/api/staffBrokers";
import type { Locale } from "@/lib/i18n/directory";
import { STAFF_BROKER_MESSAGES, tStaffBroker } from "@/lib/i18n/staff-brokers";

/**
 * Spec §21 "Staff broker UI" item 6: the audit history of this organization's
 * policy actions, straight from `audit.AuditEvent` — no derived or invented
 * rows (spec §2.1, §2.4).
 *
 * An action with no translation key renders as its raw machine code rather than
 * throwing: the audit trail is append-only and immutable, so a row written by a
 * future phase will show up here long before this dictionary learns about it,
 * and a staff screen that crashes on an unknown-but-real event is worse than
 * one that shows the code.
 */
function actionLabel(locale: Locale, action: string): string {
  const key = `staff.broker.audit.${action}`;
  return key in STAFF_BROKER_MESSAGES ? tStaffBroker(locale, key) : action;
}

export default function BrokerAuditHistory({
  locale,
  entries,
}: {
  locale: Locale;
  entries: BrokerAuditEntry[];
}) {
  return (
    <section
      aria-labelledby="broker-audit-heading"
      className="rounded-xl border border-outline-variant bg-surface-container-lowest p-space-md"
    >
      <h2
        id="broker-audit-heading"
        className="font-title-lg text-title-lg text-primary"
      >
        {tStaffBroker(locale, "staff.broker.audit_history")}
      </h2>
      {entries.length === 0 ? (
        <p className="mt-space-sm font-body-md text-on-surface-variant">
          {tStaffBroker(locale, "staff.broker.audit_empty")}
        </p>
      ) : (
        <ol className="mt-space-sm flex flex-col gap-space-sm">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="rounded-lg bg-surface-container px-space-sm py-space-xs"
            >
              <p className="font-label-md text-label-md text-on-surface">
                {actionLabel(locale, entry.action)}
              </p>
              <p className="font-body-sm text-on-surface-variant">
                {`${entry.actor?.full_name || entry.actor?.email || ""} — ${new Date(
                  entry.created_at,
                ).toISOString()}`}
              </p>
              {entry.reason ? (
                <p className="mt-space-xs font-body-sm text-on-surface">
                  {entry.reason}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
```

- [ ] **Step 3d: Create `frontend/src/components/staff/BulkApprovePanel.tsx`**

```tsx
"use client";

import { useState } from "react";

import ConfirmPolicyChangeDialog from "@/components/staff/ConfirmPolicyChangeDialog";
import { ApiError } from "@/lib/api/client";
import {
  bulkApprovePendingSubmissions,
  type BulkApproveResponse,
  type StaffBrokerDetail,
} from "@/lib/api/staffBrokers";
import type { Locale } from "@/lib/i18n/directory";
import { tStaffBroker } from "@/lib/i18n/staff-brokers";

/**
 * Spec §21 rule 7: "Staff may bulk approve existing pending broker submissions
 * as a separate explicit action with confirmation and audit."
 *
 * Separate from the policy switch on purpose, and never triggered by it:
 * enabling auto-approval affects future submissions only (rule 5). The reason
 * dialog is reused from the policy change, because both actions need exactly
 * the same thing — a confirmation the user has to read and a reason the server
 * refuses to proceed without.
 *
 * The result is reported honestly: anything the server refused to publish is
 * listed with its listing id so staff can open it. No control is disabled to
 * hide a failure.
 */
export default function BulkApprovePanel({
  locale,
  broker,
  onUpdated,
}: {
  locale: Locale;
  broker: StaffBrokerDetail;
  onUpdated: (broker: StaffBrokerDetail) => void;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkApproveResponse | null>(null);

  async function handleConfirm(reason: string) {
    setSubmitting(true);
    setError(null);
    try {
      const response = await bulkApprovePendingSubmissions(broker.id, { reason });
      setOpen(false);
      setResult(response);
      onUpdated(response.broker);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : tStaffBroker(locale, "staff.broker.save_failed"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      aria-labelledby="bulk-approve-heading"
      className="rounded-xl border border-outline-variant bg-surface-container-lowest p-space-md"
    >
      <h2
        id="bulk-approve-heading"
        className="font-title-lg text-title-lg text-primary"
      >
        {tStaffBroker(locale, "staff.broker.bulk.title")}
      </h2>
      <p className="mt-space-xs font-body-sm text-on-surface-variant">
        {tStaffBroker(locale, "staff.broker.bulk.count")}
      </p>
      <p
        data-testid="pending-revision-count"
        className="font-title-md text-title-md text-on-surface"
      >
        {broker.pending_revision_count}
      </p>

      {broker.pending_revision_count === 0 ? (
        <p className="mt-space-sm font-body-md text-on-surface-variant">
          {tStaffBroker(locale, "staff.broker.bulk.none")}
        </p>
      ) : (
        <button
          type="button"
          disabled={open}
          onClick={() => {
            setError(null);
            setResult(null);
            setOpen(true);
          }}
          className="mt-space-sm rounded-lg bg-primary px-space-md py-space-sm font-label-md text-label-md text-on-primary disabled:opacity-50"
        >
          {tStaffBroker(locale, "staff.broker.bulk.action")}
        </button>
      )}

      {open ? (
        <ConfirmPolicyChangeDialog
          locale={locale}
          title={tStaffBroker(locale, "staff.broker.bulk.confirm_title")}
          body={tStaffBroker(locale, "staff.broker.bulk.confirm_body")}
          submitting={submitting}
          error={error}
          onConfirm={handleConfirm}
          onCancel={() => {
            setOpen(false);
            setError(null);
          }}
        />
      ) : null}

      {result ? (
        <div className="mt-space-sm flex flex-col gap-space-xs">
          <p className="font-body-md text-on-surface">
            {tStaffBroker(locale, "staff.broker.bulk.approved")}:{" "}
            <span data-testid="bulk-approved-count">{result.approved_count}</span>
          </p>
          <p className="font-body-md text-on-surface">
            {tStaffBroker(locale, "staff.broker.bulk.failed")}:{" "}
            <span data-testid="bulk-failed-count">{result.failed_count}</span>
          </p>
          {result.failures.length > 0 ? (
            <ul className="flex flex-col gap-space-xs">
              {result.failures.map((failure) => (
                <li
                  key={failure.revision_id}
                  className="font-body-sm text-on-surface-variant"
                >
                  {`${failure.listing_id} — ${failure.message}`}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 3e: Mount both in `StaffBrokerDetailView.tsx`**

Add the imports:

```tsx
import BrokerAuditHistory from "@/components/staff/BrokerAuditHistory";
import BulkApprovePanel from "@/components/staff/BulkApprovePanel";
```

and append to the returned tree, below `AutoApprovalPanel`:

```tsx
      <BulkApprovePanel
        locale={locale}
        broker={broker}
        onUpdated={setBroker}
      />
      <BrokerAuditHistory locale={locale} entries={broker.audit_history} />
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:
```bash
cd frontend && pnpm exec vitest run src/components/staff src/app/dashboard
cd frontend && pnpm exec tsc --noEmit
cd frontend && pnpm test && pnpm lint
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): add the broker policy audit history and the bulk approve action"
```

---

### Task 10: Phase acceptance tests, full regression and the handoff note

Spec §39 step 9 requires the phase's definition of done to be demonstrated "with verifiable test output". This task proves each of spec §21's four acceptance tests and each of its seven rules end to end, through the real HTTP endpoints, and records the handoff note.

**Files:**
- Create: `backend/brokers/tests/test_phase_12_acceptance.py`
- Modify: `ACTIVITY.md`

**Interfaces:**
- Consumes: everything Tasks 1–9 produced. Adds nothing new.

- [ ] **Step 1: Write the acceptance tests**

Create `backend/brokers/tests/test_phase_12_acceptance.py`:

```python
"""Spec §21's four acceptance tests and seven rules, end to end.

These go through the real HTTP endpoints — no service is called directly —
because the rules they prove are about what a broker user and a staff user can
and cannot make the system do.

The draft/submit request bodies below follow Phase 11's `listings.payloads`
schema. **Copy the exact key names from `listings/tests/test_draft_create.py`
rather than from memory** if anything fails to validate: that file is the
merged, authoritative example of the schema.
"""

import pytest
from django.contrib.auth.models import Group
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from audit.models import AuditEvent
from brokers.enums import BrokerMembershipRole, BrokerOrganizationStatus
from brokers.tests.factories import make_broker, make_membership
from listings.enums import (
    ListingStatus,
    MediaStatus,
    MediaType,
    PublicationSource,
    RevisionStatus,
)
from listings.models import BoatListing, ListingSnapshot
from listings.tests.factories import (
    make_brand,
    make_broker_listing,
    make_media,
    make_model,
    make_revision,
)
from platform_settings.services import set_feature_flag


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def workflow_enabled(db):
    set_feature_flag(key="listing_revisions", is_enabled=True, actor=None)


def _staff(email, group_name):
    user = make_user(email, role=UserRole.STAFF, verified=True)
    user.groups.add(Group.objects.get(name=group_name))
    return user


def _agency(slug, email, *, auto=False, status=BrokerOrganizationStatus.ACTIVE):
    broker = make_broker(
        name=f"Agency {slug}",
        slug=slug,
        status=status,
        auto_approve_listings=auto,
    )
    agent = make_user(email, role=UserRole.BROKER, verified=True)
    make_membership(
        agent,
        broker,
        role=BrokerMembershipRole.ADMIN,
        can_edit_listings=True,
        can_manage_team=True,
        can_read_messages=True,
    )
    return broker, agent


def _draft_body(broker, brand, model, **overrides):
    body = {
        "broker_id": str(broker.pk),
        "brand_id": str(brand.pk),
        "model_id": str(model.pk),
        "manufacture_year": 2022,
        "title_en": "Fountaine Pajot Astrea 42",
        "description_en": "Owner version, full service history.",
        "specifications": {"length_m": "12.6"},
        "location_country": "ES",
        "location_city": "Palma",
        "price": "399000.00",
        "currency": "EUR",
    }
    body.update(overrides)
    return body


def _publish_through_the_api(api, broker, agent, brand, model, **overrides):
    """Create a broker draft, attach a READY image and submit it, all over HTTP.

    Media rows are created directly because Phase 11 owns the model only — the
    upload/scan pipeline is Phase 15 (spec §24), so there is no upload endpoint
    to call and `ListingMedia.status` is written by tests and Django admin.
    """
    created = api.post(
        reverse("listing-draft-create"),
        _draft_body(broker, brand, model, **overrides),
        format="json",
    )
    assert created.status_code == 201, created.data
    listing = BoatListing.objects.get(pk=created.data["id"])
    image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY)

    patched = api.patch(
        reverse("listing-draft-update", args=[listing.pk]),
        {"version": created.data["revision"]["version"], "media_ids": [str(image.pk)]},
        format="json",
    )
    assert patched.status_code == 200, patched.data

    submitted = api.post(
        reverse("listing-submit", args=[listing.pk]),
        {"version": patched.data["revision"]["version"]},
        format="json",
    )
    return listing, submitted


# --- Acceptance test 1: "A broker can create listing 101 without quota failure."


@pytest.mark.django_db
def test_21_acceptance_1_a_broker_creates_listing_101_without_a_quota_failure(
    api, workflow_enabled
):
    broker, agent = _agency("quota-101", "quota-101@example.com", auto=True)
    brand = make_brand("Fountaine Pajot")
    model = make_model(brand, "Astrea 42")
    # The first hundred exist already. They are built with the factory rather
    # than a hundred HTTP round trips because what this test proves is that
    # listing *101* is refused by nothing — not that the factory works.
    for index in range(100):
        make_broker_listing(
            broker=broker,
            actor=agent,
            brand=brand,
            model=model,
            status=ListingStatus.PUBLISHED,
        )
        assert index >= 0
    assert BoatListing.objects.filter(broker=broker).count() == 100
    api.force_authenticate(agent)

    listing, submitted = _publish_through_the_api(api, broker, agent, brand, model)

    assert submitted.status_code == 200, submitted.data
    listing.refresh_from_db()
    assert BoatListing.objects.filter(broker=broker).count() == 101
    assert listing.status == ListingStatus.PUBLISHED
    assert listing.publication_source == PublicationSource.BROKER_POLICY


# --- Acceptance test 2: "An ordinary broker user cannot toggle auto-approval
# --- through UI or API." (The UI half is
# --- frontend/src/app/dashboard/staff/brokers/[brokerId]/page.test.tsx.)


@pytest.mark.django_db
def test_21_acceptance_2_a_broker_user_cannot_toggle_the_policy_through_the_api(
    api, workflow_enabled
):
    broker, agent = _agency("self-toggle", "self-toggle@example.com")
    api.force_authenticate(agent)

    response = api.patch(
        reverse("staff-broker-approval-policy", args=[broker.pk]),
        {"auto_approve_listings": True, "reason": "I would like this on."},
        format="json",
    )

    assert response.status_code == 403
    assert response.data["error"]["code"] == "staff_admin_required"
    broker.refresh_from_db()
    assert broker.auto_approve_listings is False
    assert AuditEvent.objects.filter(target_id=str(broker.pk)).count() == 0


@pytest.mark.django_db
def test_21_acceptance_2_a_broker_user_cannot_read_the_staff_broker_screen(
    api, workflow_enabled
):
    broker, agent = _agency("self-read", "self-read@example.com")
    api.force_authenticate(agent)

    response = api.get(reverse("staff-broker-detail", args=[broker.pk]))

    assert response.status_code == 403
    assert response.data["error"]["code"] == "staff_moderator_required"


@pytest.mark.django_db
def test_21_acceptance_2_a_broker_user_cannot_bulk_approve(api, workflow_enabled):
    broker, agent = _agency("self-bulk", "self-bulk@example.com")
    api.force_authenticate(agent)

    response = api.post(
        reverse("staff-broker-bulk-approve", args=[broker.pk]),
        {"confirm": True, "reason": "Approving my own work."},
        format="json",
    )

    assert response.status_code == 403


# --- Acceptance test 3: "Auto-approved submission creates snapshot/published
# --- state atomically."


@pytest.mark.django_db
def test_21_acceptance_3_an_auto_approved_submission_publishes_atomically(
    api, workflow_enabled
):
    broker, agent = _agency("atomic", "atomic@example.com", auto=True)
    brand = make_brand("Lagoon")
    model = make_model(brand, "42")
    api.force_authenticate(agent)

    listing, submitted = _publish_through_the_api(api, broker, agent, brand, model)

    assert submitted.status_code == 200, submitted.data
    listing.refresh_from_db()
    snapshot = listing.current_public_snapshot
    # One transaction: the listing is PUBLISHED, a version-1 snapshot exists and
    # is current, and the revision is APPROVED. No intermediate state is
    # observable, because all four writes happened under one atomic block.
    assert listing.status == ListingStatus.PUBLISHED
    assert snapshot is not None and snapshot.version == 1
    assert snapshot.approved_at is not None
    assert listing.published_at is not None
    assert listing.revisions.get().state == RevisionStatus.APPROVED
    assert submitted.data["current_public_snapshot_version"] == 1

    # And it is publicly readable straight away — the point of auto-approval.
    public = APIClient().get(reverse("listing-detail", args=[listing.pk]))
    assert public.status_code == 200
    assert public.data["snapshot_version"] == 1


# --- Acceptance test 4: "Invalid listing never publishes even when
# --- auto-approval is on."


@pytest.mark.django_db
def test_21_acceptance_4_an_invalid_listing_never_publishes(api, workflow_enabled):
    broker, agent = _agency("invalid", "invalid@example.com", auto=True)
    brand = make_brand("Bavaria")
    model = make_model(brand, "46")
    api.force_authenticate(agent)
    created = api.post(
        reverse("listing-draft-create"),
        _draft_body(broker, brand, model),
        format="json",
    )
    listing = BoatListing.objects.get(pk=created.data["id"])
    # No media at all: spec §20.1 step 3 requires at least one READY image.

    submitted = api.post(
        reverse("listing-submit", args=[listing.pk]),
        {"version": created.data["revision"]["version"]},
        format="json",
    )

    assert submitted.status_code == 400
    listing.refresh_from_db()
    assert listing.status == ListingStatus.DRAFT
    assert listing.current_public_snapshot_id is None
    assert ListingSnapshot.objects.filter(listing=listing).count() == 0
    assert listing.revisions.get().state == RevisionStatus.DRAFT
    assert APIClient().get(
        reverse("listing-detail", args=[listing.pk])
    ).status_code == 404


# --- Rules 2, 3, 5, 6 and 7.


@pytest.mark.django_db
def test_21_rule_3_a_new_broker_organization_starts_with_the_policy_off():
    broker = make_broker(name="Fresh", slug="fresh")
    assert broker.auto_approve_listings is False
    assert broker.auto_approve_changed_by_id is None
    assert broker.auto_approve_changed_at is None


@pytest.mark.django_db
def test_21_rule_2_a_suspended_organization_does_not_auto_publish(
    api, workflow_enabled
):
    """"Unlimited" does not bypass suspension. The membership path is closed by
    Phase 3's active-organization check, so this exercises the staff-admin
    on-behalf path, which is the only way to submit for a suspended agency."""
    broker, _ = _agency(
        "suspended",
        "suspended-agent@example.com",
        auto=True,
        status=BrokerOrganizationStatus.SUSPENDED,
    )
    admin = _staff("suspend-admin@example.com", StaffGroup.ADMIN)
    listing = make_broker_listing(broker=broker, actor=admin)
    image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY)
    revision = make_revision(
        listing,
        payload={
            "title_en": "Suspended agency boat",
            "description_en": "Should not auto-publish.",
            "specifications": {"length_m": "11.0"},
            "location_country": "ES",
            "location_city": "Ibiza",
            "price": "199000.00",
            "currency": "EUR",
            "media_ids": [str(image.pk)],
        },
    )
    api.force_authenticate(admin)

    response = api.post(
        reverse("listing-submit", args=[listing.pk]),
        {"version": revision.version},
        format="json",
    )

    assert response.status_code == 200, response.data
    listing.refresh_from_db()
    assert listing.status == ListingStatus.PENDING_APPROVAL
    assert listing.current_public_snapshot_id is None


@pytest.mark.django_db
def test_21_rule_5_enabling_the_policy_leaves_the_pending_backlog_pending(
    api, workflow_enabled
):
    broker, agent = _agency("rule5", "rule5@example.com", auto=False)
    brand = make_brand("Jeanneau")
    model = make_model(brand, "Sun Odyssey 410")
    api.force_authenticate(agent)
    listing, submitted = _publish_through_the_api(api, broker, agent, brand, model)
    assert submitted.status_code == 200
    listing.refresh_from_db()
    assert listing.status == ListingStatus.PENDING_APPROVAL

    admin = _staff("rule5-admin@example.com", StaffGroup.ADMIN)
    api.force_authenticate(admin)
    policy = api.patch(
        reverse("staff-broker-approval-policy", args=[broker.pk]),
        {"auto_approve_listings": True, "reason": "Vetted after review."},
        format="json",
    )

    assert policy.status_code == 200
    listing.refresh_from_db()
    assert listing.status == ListingStatus.PENDING_APPROVAL
    assert listing.current_public_snapshot_id is None
    assert policy.data["pending_revision_count"] == 1


@pytest.mark.django_db
def test_21_rule_6_disabling_the_policy_leaves_published_listings_live(
    api, workflow_enabled
):
    broker, agent = _agency("rule6", "rule6@example.com", auto=True)
    brand = make_brand("Beneteau")
    model = make_model(brand, "Oceanis 46.1")
    api.force_authenticate(agent)
    listing, submitted = _publish_through_the_api(api, broker, agent, brand, model)
    assert submitted.status_code == 200

    admin = _staff("rule6-admin@example.com", StaffGroup.ADMIN)
    api.force_authenticate(admin)
    api.patch(
        reverse("staff-broker-approval-policy", args=[broker.pk]),
        {"auto_approve_listings": False, "reason": "Two quality complaints."},
        format="json",
    )

    listing.refresh_from_db()
    assert listing.status == ListingStatus.PUBLISHED
    assert listing.current_public_snapshot is not None
    assert APIClient().get(
        reverse("listing-detail", args=[listing.pk])
    ).status_code == 200


@pytest.mark.django_db
def test_21_rule_7_staff_bulk_approve_clears_the_backlog_and_is_audited(
    api, workflow_enabled
):
    broker, agent = _agency("rule7", "rule7@example.com", auto=False)
    brand = make_brand("Dufour")
    api.force_authenticate(agent)
    for index in range(3):
        model = make_model(brand, f"470-{index}")
        _, submitted = _publish_through_the_api(api, broker, agent, brand, model)
        assert submitted.status_code == 200

    moderator = _staff("rule7-mod@example.com", StaffGroup.MODERATOR)
    api.force_authenticate(moderator)
    response = api.post(
        reverse("staff-broker-bulk-approve", args=[broker.pk]),
        {"confirm": True, "reason": "Backlog cleared after onboarding call."},
        format="json",
    )

    assert response.status_code == 200, response.data
    assert response.data["approved_count"] == 3
    assert response.data["failed_count"] == 0
    assert response.data["broker"]["pending_revision_count"] == 0
    assert response.data["broker"]["listing_counts"]["by_status"]["PUBLISHED"] == 3
    event = AuditEvent.objects.get(
        target_id=str(broker.pk), action="broker.pending_revisions_bulk_approved"
    )
    assert event.metadata["reason"] == "Backlog cleared after onboarding call."


@pytest.mark.django_db
def test_21_rule_4_every_policy_change_is_audited_with_its_reason(
    api, workflow_enabled
):
    broker, _ = _agency("rule4", "rule4@example.com")
    admin = _staff("rule4-admin@example.com", StaffGroup.ADMIN)
    api.force_authenticate(admin)

    api.patch(
        reverse("staff-broker-approval-policy", args=[broker.pk]),
        {"auto_approve_listings": True, "reason": "Onboarded 2026-09-18."},
        format="json",
    )
    api.patch(
        reverse("staff-broker-approval-policy", args=[broker.pk]),
        {"auto_approve_listings": False, "reason": "Paused pending review."},
        format="json",
    )

    events = AuditEvent.objects.filter(
        target_id=str(broker.pk), action="broker.auto_approval_changed"
    ).order_by("created_at")
    assert [event.metadata["reason"] for event in events] == [
        "Onboarded 2026-09-18.",
        "Paused pending review.",
    ]
    assert all(event.actor_user_id == admin.pk for event in events)
```

- [ ] **Step 2: Run the acceptance tests**

Run: `cd backend && uv run pytest brokers/tests/test_phase_12_acceptance.py -v`

Expected: every test passes. If `_publish_through_the_api` fails on the draft body, open `backend/listings/tests/test_draft_create.py` and copy its payload keys exactly — Phase 11's `listings.payloads` schema is the authority, not this plan's example.

- [ ] **Step 3: Run the full regression, both projects**

Run:
```bash
cd backend && uv run pytest -q
cd backend && uv run python manage.py makemigrations --check --dry-run
cd frontend && pnpm exec tsc --noEmit && pnpm test && pnpm lint
```

Expected: the backend suite is green, `No changes detected` from the migration check (**this phase adds no migration** — a migration here is a bug), and the frontend type-check, tests and lint are clean. Record the two test counts for the handoff note.

- [ ] **Step 4: Write the phase handoff note**

Add a new entry at the top of `ACTIVITY.md`'s `## Log` section, matching the format of the existing entries and covering everything spec §39's "Required phase handoff note" demands:

```markdown
### 2026-09-18 — Phase 12 (broker unlimited listings and auto-approval) complete

- Implemented `docs/superpowers/plans/2026-09-18-phase-12-broker-policy.md` in full (Tasks 1-10).
- `listings.policies.requires_staff_approval()` now reads `BrokerOrganization.auto_approve_listings`. It returns False only for a broker listing, in DRAFT/REJECTED/PUBLISHED, belonging to an ACTIVE organization with the policy on; everything else still goes to a moderator.
- New module `listings/publication.py` holds the single publication path (`publish_revision`, `guard_base_snapshot`). `listings.decisions.approve_revision` and the new auto-approval branch in `listings.submissions.submit_listing_revision` both call it, so an auto-approved listing is validated exactly as a moderator-approved one is.
- **No new model, no new field, no migration.** Phase 3 already built all three `auto_approve_*` columns and their check constraint; listing counts are live aggregates, not cached columns.
- New endpoints (all in the `brokers` app, no `config/urls.py` change): `GET /api/v1/staff/brokers/<id>/` (staff moderator), `PATCH /api/v1/staff/brokers/<id>/approval-policy/` (staff admin — the spec §30.1 endpoint), `POST /api/v1/staff/brokers/<id>/pending-approvals/` (staff moderator, bulk approve). The GET and the POST are Phase 12 additions beyond §30.1's literal table and are flagged as such in the plan's Contract summary.
- `brokers.services.set_broker_auto_approval` now requires a `reason`, returns a `PolicyChange(broker, changed)` and writes a `broker.auto_approval_changed` audit event. Django admin collects the same mandatory reason through `brokers.forms.BrokerOrganizationAdminForm`, so the flag has no unaudited write path.
- Audit actions added: `broker.auto_approval_changed`, `listing.revision_auto_approved`, `broker.pending_revisions_bulk_approved`.
- Error codes added (stable): `policy_reason_required`, `bulk_approve_not_confirmed`.
- Signal contract change: `listings.signals.listing_revision_approved` now also carries `auto_approved: bool`. Under auto-approval the moderator-recruiting signals (`listing_initial_submitted`, `listing_revision_submitted`) are **not** emitted; `listing_other_model_submitted` still is, because taxonomy staff still owe a mapping decision.
- Feature flag state unchanged: no new flag (spec §35.1's list is closed). The two staff mutation endpoints are gated on the existing `listing_revisions` flag; the staff read endpoint is not.
- Frontend: `/dashboard/staff/brokers/<brokerId>/` with account status, listing counts by status, the auto-approval switch with last-changed-by/at, a confirmation dialog that states the future-only effect, a mandatory reason field, the policy audit history and the bulk-approve action. EN/IT/ES keys in `frontend/src/lib/i18n/staff-brokers.ts`. No navigation entry and no staff dashboard shell — Phase 17 owns staff navigation.
- Tests added: <N_BACKEND> backend in `backend/listings/tests/` and `backend/brokers/tests/`, <N_FRONTEND> frontend in `frontend/src/components/staff/` and `frontend/src/app/dashboard/`. Spec §21's four acceptance tests and all seven rules are covered end to end in `backend/brokers/tests/test_phase_12_acceptance.py`. Full backend suite: <TOTAL_BACKEND> passed. Full frontend suite: <TOTAL_FRONTEND> passed.
- Known limitations (all documented in the plan): no staff dashboard shell or broker index page (Phase 17); §20.4's staff-enumerated "non-substantive fields" list not built (Phase 17); no `Idempotency-Key` replay store on the staff mutations (Phase 14); bulk approve is synchronous and unpaginated; auto-approval records the submitting user as `decided_by`; notification receivers still absent (Phase 18); the entitlement gate is still Phase 11's allow-everything stub (Phase 13).
- Next: Phase 13 (individual quota and entitlement ledger) must preserve the broker branch of `ListingEntitlementGate.can_submit` — `listings/tests/test_policies.py::test_brokers_have_no_numeric_listing_quota` is the tripwire. Phase 17's moderation queue links to `/dashboard/staff/brokers/<id>/` and owns the staff navigation entry for it.
```

Replace `<N_BACKEND>`, `<N_FRONTEND>`, `<TOTAL_BACKEND>` and `<TOTAL_FRONTEND>` with the real numbers from Step 3. Do not write the note before both suites are green — spec §39 step 9 requires the definition of done to be demonstrated "with verifiable test output".

- [ ] **Step 5: Commit**

```bash
git add backend/brokers/tests/test_phase_12_acceptance.py ACTIVITY.md
git commit -m "test(brokers): add the Phase 12 acceptance tests and record the phase handoff note"
```

---

## Known Limitations (carried forward, not fixed by this plan)

Each item names the phase that closes it. None breaks a MUST requirement *of this phase* (spec §39: "Any known limitation that breaks a MUST requirement prevents completion") — every one is either assigned elsewhere by the spec or an explicitly ruled scope boundary.

1. **No staff dashboard shell, no broker index, no navigation entry.** `/dashboard/staff/brokers/<id>/` is reachable by direct URL only. Spec §26.1 assigns staff navigation to **Phase 17** and warns against scattering one workflow across dashboards; Phase 3's contract rule 11 forbids adding a nav link in a commit that does not create its target. → **Phase 17** (spec §26).
2. **Spec §20.4's "clearly enumerated non-substantive fields" are not built.** §20.4 permits staff to define a list of fields that auto-publish even without auto-approval, and in the same sentence fixes the default: "default is that all public content fields are substantive." This phase implements the default. A staff-editable allowlist needs a `PlatformSetting`, a staff screen and a per-field diff engine — all spec §26 surface. → **Phase 17**.
3. **No `Idempotency-Key` replay store.** Spec §30.3 asks for one on listing submit and staff decision requests; the policy PATCH and the bulk approve inherit that shape. A repeated policy PATCH is already harmless (the service short-circuits and returns `changed: false` with no second audit row) and a repeated bulk approve re-reads an empty backlog, but a replayed request does not return the original response body. Carried over from Phase 11's Known Limitation 7. → **Phase 14**.
4. **Bulk approve is synchronous, unpaginated and unbounded.** One HTTP request approves the whole backlog in a loop. For the realistic case — an organization with tens of pending submissions — that is a second or two. A broker with thousands would time out. There is no background task, no batch size and no progress reporting. → **Phase 18/22** if it ever becomes real; deliberately not solved speculatively.
5. **Auto-approval records the submitting user as `decided_by` / `approved_by`.** Ruled in Task 1. There is no dedicated system actor `User` row in this codebase, and inventing one is a Phase 3 data-model change. The distinct audit action `listing.revision_auto_approved` plus `metadata.auto_approved` and `publication_source=BROKER_POLICY` keep an automatic publication distinguishable from a human one. → revisit only if a system actor is introduced.
6. **Notifications still have no receivers.** `listing_revision_approved` now carries `auto_approved`, and the moderator-recruiting signals are correctly suppressed on the auto path, but nothing listens to any of them, so no in-app row, WebSocket frame or email is produced. Carried over from Phase 11's Known Limitation 8. → **Phase 18** (spec §27).
7. **The entitlement gate is still Phase 11's allow-everything stub.** Spec §21 rule 1 is discharged by proof (the 101-listing acceptance test plus a unit tripwire), not by code, because no quota code exists yet. → **Phase 13** (spec §22), bound by contract rule 3 below.
8. **The audit-history panel is a fixed 50-row window.** No pagination, no filtering, no date range, and it deliberately excludes listing-decision events (which target `listings.ListingRevision`). A full audit browser is staff tooling. → **Phase 17**.
9. **Broker-facing visibility of the policy is one session field.** `broker_auto_approve_listings` on each membership summary satisfies spec §11.1's "Broker users may see the current policy"; there is no broker dashboard panel rendering it, because the broker dashboard is **Phase 19** (spec §28).
10. **The policy is read without locking the broker row.** Ruled in Global Constraints. A submission landing in the same instant as a toggle may take either branch; both outcomes satisfy §21 rules 5 and 6, which speak of "future submissions". What *is* guaranteed and tested: a submission already in `PENDING_APPROVAL` is never retro-approved, and a published listing is never unpublished.
11. **No rate limit on the three staff endpoints.** Spec §30.4's enumerated list does not include staff endpoints, and all three require membership of a staff group. → **Phase 22** if a broader policy is adopted.
12. **Media allowance under auto-approval is still Phase 11's base tier.** `effective_media_allowance` is unchanged, so an auto-approving broker gets the configured broker allowance and nothing more. That is correct for this phase — §21 rule 2 requires media limits to keep applying — but the private-seller upgrade tier remains unreachable. → **Phase 15** (spec §24).
13. **Nothing in the public API says a listing was auto-approved.** `PublicListingSerializer` is untouched, and the workflow serializer reports only `policy.requires_approval`. Whether a buyer should see "published without staff review" is a product question nobody has asked; the fact is recorded in the audit trail and on `publication_source`.
14. **`listings.policies.AUTO_APPROVABLE_LISTING_STATES` duplicates the state set in `listings.drafts.update_listing_draft`.** They are deliberately two constants with one test pinning the value, because they answer different questions — "who may open a revision" versus "who may publish one without a human" — and forcing them to share a name would make a future intentional divergence look like a bug. If they ever diverge, nothing detects it beyond that test.
15. **No end-to-end browser test.** Spec §34.5's Playwright/Cypress suite is Phase 23. The staff screen is covered by component and page tests with a mocked API, and the API by real HTTP tests against real Postgres. → **Phase 23**.

---

## Contract summary for later phases

**Endpoints shipped by this phase**, against spec §30.1's literal inventory:

| Endpoint | §30.1 | Permission |
|---|---|---|
| `PATCH /api/v1/staff/brokers/<id>/approval-policy/` | listed | `IsStaffAdmin` + `listing_revisions` flag |
| `GET /api/v1/staff/brokers/<id>/` | **added by this phase** | `IsStaffModerator` |
| `POST /api/v1/staff/brokers/<id>/pending-approvals/` | **added by this phase** | `IsStaffModerator` + `listing_revisions` flag |

The two additions are flagged here rather than presented as spec-literal, exactly as Phase 11 flagged `POST /listings/<id>/withdraw/`. §30.1's closing sentence grants the latitude: "Exact URL naming may follow an established API convention, but semantics, authorization and errors must remain equivalent." §21's Staff broker UI cannot exist without the GET (spec §2.1), and §21 rule 7 cannot exist without the POST.

Everything a downstream phase imports from Phase 12, in one place:

```python
from brokers.moderation import (
    BulkApprovalFailure,
    BulkApprovalResult,
    bulk_approve_pending_broker_revisions,
)
from brokers.selectors import (
    BROKER_AUDIT_HISTORY_LIMIT,
    broker_audit_history,
    broker_listing_counts,
    pending_revision_count,
)
from brokers.serializers import (
    BrokerApprovalPolicySerializer,
    BrokerBulkApproveSerializer,
    StaffBrokerDetailSerializer,
    actor_ref,
    audit_entry,
)
from brokers.services import (
    POLICY_REASON_REQUIRED_MESSAGE,
    PolicyChange,
    clean_policy_reason,
    set_broker_auto_approval,
)
from brokers.views import (
    BrokerApprovalPolicyView,
    BrokerPendingApprovalsView,
    StaffBrokerDetailView,
)
from listings.policies import AUTO_APPROVABLE_LISTING_STATES, requires_staff_approval
from listings.publication import guard_base_snapshot, publish_revision
```

```ts
// frontend
import {
  LISTING_STATUS_ORDER,
  bulkApprovePendingSubmissions,
  fetchStaffBrokerDetail,
  setBrokerAutoApproval,
  type BrokerAuditEntry,
  type BulkApproveResponse,
  type StaffBrokerDetail,
} from "@/lib/api/staffBrokers";
import { STAFF_BROKER_MESSAGES, tStaffBroker } from "@/lib/i18n/staff-brokers";
```

Rules a later phase must follow:

1. **`listings.publication.publish_revision` is the only way to create a public snapshot.** Do not call `listings.snapshots.create_snapshot_from_revision` directly and do not add a third publication path. Every caller must validate its payload and media first and pass the cleaned document in; `publish_revision` deliberately does not validate on a caller's behalf, because a function that sometimes validates is a function nobody trusts. This is what makes spec §21's "Invalid listing never publishes even when auto-approval is on" a structural property rather than a rule somebody has to remember.
2. **`listings` must never import `brokers` at module level.** The arrow runs the other way: `brokers` imports `listings` (for listing counts, the pending backlog and `approve_revision`). `requires_staff_approval` reads `listing.broker` through the FK attribute for exactly this reason. Breaking this creates an import cycle whose symptom is an `AppRegistryNotReady` at `manage.py` start.
3. **Phase 13 must preserve the broker branch of `ListingEntitlementGate.can_submit`.** Spec §21 rule 1 — "Broker organizations have no numeric listing quota in this release" — outlives the stub. When Phase 13 replaces that class body with `ListingEligibilityService`, a call with a non-`None` `broker` must still return `True`. `listings/tests/test_policies.py::test_brokers_have_no_numeric_listing_quota` and `brokers/tests/test_phase_12_acceptance.py::test_21_acceptance_1_...` are the tripwires; do not weaken either.
4. **Phase 13 must also leave `ListingEntitlementGate.publication_days` returning `None` for brokers** unless the spec grows a broker publication window. `publish_revision` writes `expires_at = NULL` on that basis, and the expiry task Phase 13 adds must not start expiring broker listings by treating `None` as zero.
5. **Never write `BrokerOrganization.auto_approve_listings` directly.** Go through `brokers.services.set_broker_auto_approval`, which holds the row lock, the mandatory reason, the actor/timestamp stamps and the audit event together. `brokers.admin` is the worked example of how to route an existing write path through it. A management command or a data migration that sets the column by hand produces a policy change with no reason and no trail, which spec §26's definition of done forbids.
6. **Auto-approval is evaluated once, at submit time.** Spec §21 rules 5 and 6 are properties of *when* `requires_staff_approval` is called, not of anything stored. Do not add a background job that sweeps pending submissions when the policy flips — §21 rule 7's explicit, confirmed, audited bulk approve is the only sanctioned way to act on an existing backlog.
7. **Phase 18 receivers must accept `auto_approved` on `listing_revision_approved`** (through `**kwargs`) and must not assume a human decided. Spec §27.1's `listing.approved` notification goes to "owner/broker submitter"; when `auto_approved` is True that is the same person who just clicked submit, so a receiver that mails them "your listing was approved" is telling them something they watched happen.
8. **Phase 17's moderation queue owns the navigation entry** for `/dashboard/staff/brokers/<brokerId>/`, the broker index/search page, and the staff dashboard shell this screen currently hangs off nothing. It should also surface `broker.pending_revisions_bulk_approved` and `listing.revision_auto_approved` in whatever audit browser it builds.
9. **Any new staff broker-policy action must reuse `clean_policy_reason`** and emit an audit event with `metadata.reason`, so `brokers.selectors.broker_audit_history` and the screen's audit panel keep working without a special case. A new action also needs a `staff.broker.audit.<action>` key in `frontend/src/lib/i18n/staff-brokers.ts` — the panel renders an unknown action as its raw code rather than crashing, but a raw code on a staff screen is a bug, not a feature.
10. **`listing_counts` is a live aggregate, not a column.** Do not denormalize it onto `BrokerOrganization` for performance without also satisfying spec §26's "All visible counters equal query results".

---

## Self-Review

**1. Spec coverage — §21 (Phase 12), line by line:**

| Spec §21 requirement | Where implemented |
|---|---|
| Rule 1 — "Broker organizations have no numeric listing quota in this release." | Task 10 acceptance test 1 (listing 101 published end to end) + Task 2's `test_brokers_have_no_numeric_listing_quota` tripwire + Contract rule 3 binding Phase 13. Ruled: proved, not coded — no quota code exists to disable. |
| Rule 2 — "'Unlimited' does not bypass validation, moderation, suspension, media limits or abuse controls." | Validation and media: Task 2 (`submit_listing_revision` validates before the branch; `test_an_invalid_submission_never_publishes_even_with_the_policy_on`, `test_media_that_is_not_ready_blocks_an_auto_approved_submission`) and Task 1 (one publication path). Suspension: Task 2's `AUTO_APPROVABLE_LISTING_STATES` + the organization `is_active` check, tested per organization status and per listing status, and again in Task 10. Moderation: a listing already in `PENDING_APPROVAL` never auto-approves. |
| Rule 3 — "`auto_approve_listings=false` by default for migrated/new brokers unless staff explicitly enables it." | Already true in merged Phase 3 code (`BooleanField(default=False)`); proved by Task 10's `test_21_rule_3_...`. Ruled: no migration, no field change. |
| Rule 4 — "Only staff admin may toggle policy; change requires a reason." | Staff admin: Task 5 (`IsStaffAdmin` on the endpoint) + Task 3 (`is_staff_admin` in the admin) + Task 8 (disabled control) + Task 10 acceptance test 2. Reason: Task 3 (`clean_policy_reason` in the service, `BrokerOrganizationAdminForm` in the admin), Task 5 (serializer), Task 8 (dialog), Task 10's `test_21_rule_4_...`. |
| Rule 5 — "Enabling policy affects future submissions, not currently pending submissions automatically." | Task 2 (the policy is read once, at submit time; `PENDING_APPROVAL` is excluded from `AUTO_APPROVABLE_LISTING_STATES`), `test_enabling_the_policy_does_not_retro_approve_a_pending_submission`, Task 10's `test_21_rule_5_...`, and the dialog copy in Task 8. |
| Rule 6 — "Disabling policy affects future submissions; current published listings stay live unless moderated." | Task 3 (`set_broker_auto_approval` touches three columns and nothing else), `test_disabling_the_policy_leaves_a_published_listing_live`, Task 10's `test_21_rule_6_...`, and the dialog copy in Task 8. |
| Rule 7 — "Staff may bulk approve existing pending broker submissions as a separate explicit action with confirmation and audit." | Task 6 (`brokers.moderation` + its own endpoint, `confirm: true` + mandatory reason, per-revision savepoints, one aggregate audit event plus each revision's own), Task 9 (the control), Task 10's `test_21_rule_7_...`. |
| Staff broker UI — Account status | Task 4 (`status` in the payload), Task 7 (`BrokerOverviewPanel`, `broker-account-status`). |
| Staff broker UI — Listing counts by status | Task 4 (`broker_listing_counts`, all seven states with explicit zeroes), Task 7 (the `<dl>` grid + total). |
| Staff broker UI — Auto-approval switch with current state, last changed by/at | Task 4 (`auto_approve_listings`, `auto_approve_changed_by`, `auto_approve_changed_at`), Task 8 (`AutoApprovalPanel`). |
| Staff broker UI — Confirmation modal explaining future-only effect | Task 8 (`ConfirmPolicyChangeDialog` with separate enable/disable copy naming rules 5 and 6), tested for both directions. |
| Staff broker UI — Mandatory reason field | Task 8 (the dialog's textarea and blank check) backed by Task 3/Task 5's server-side refusal — spec §39: the dialog is not the control. |
| Staff broker UI — Audit history | Task 4 (`broker_audit_history`, `audit_entry`), Task 9 (`BrokerAuditHistory` with a real empty state). |
| Acceptance 1 — "A broker can create listing 101 without quota failure." | Task 10 `test_21_acceptance_1_...` |
| Acceptance 2 — "An ordinary broker user cannot toggle auto-approval through UI or API." | API: Task 10's three `test_21_acceptance_2_...` tests (policy PATCH, staff read, bulk approve), plus Task 5 and Task 6's own authz tests. UI: Task 7's `page.test.tsx` "shows the 403 screen to a broker user", plus Task 8's disabled-switch test for a staff moderator. |
| Acceptance 3 — "Auto-approved submission creates snapshot/published state atomically." | Task 10 `test_21_acceptance_3_...` (one transaction; listing PUBLISHED, snapshot v1 current, revision APPROVED, and the public detail endpoint serving it immediately), plus Task 2's service-level test. |
| Acceptance 4 — "Invalid listing never publishes even when auto-approval is on." | Task 10 `test_21_acceptance_4_...`, Task 2's payload and media variants, Task 6's bulk-scale variant, and structurally by Task 1's single publication path. |

**2. Spec coverage — cross-referenced sections:**

- **§20.4** ("If broker auto-approval is on, valid create/edit submissions publish a new snapshot immediately") → Task 2, `test_an_auto_approved_edit_publishes_the_next_snapshot_and_keeps_the_status`. Its second half ("Staff may define clearly enumerated non-substantive fields…") is ruled out of scope with the spec's own default implemented; Known Limitation 2.
- **§6.1** — the `DRAFT → PUBLISHED` edge Phase 11 put in `LISTING_TRANSITIONS` and never took is now taken, by exactly one caller.
- **§5** — "Configure broker auto-approval: staff admin only" → `IsStaffAdmin` (Task 5) and `configure_broker_auto_approval` (Task 8). "Approve listings/revisions: staff moderator and staff admin" → `IsStaffModerator` on the read and bulk endpoints (Tasks 4, 6), matching Phase 11's choice for the decision endpoint.
- **§11.1** — the three `auto_approve_*` fields are used exactly as specified; "Only staff admin can change `auto_approve_listings`" → Tasks 3 and 5; "Broker users may see the current policy but cannot change it" → Task 4's session key plus Task 5's 403.
- **§2.2** (server authority) — the flag is read from the request body on exactly one endpoint, the one that exists to change it, behind staff admin. `requires_staff_approval` never consults a request.
- **§2.3** (atomic state changes) — `publish_revision` runs inside the caller's transaction with the listing locked; `set_broker_auto_approval` locks the row and audits in the same transaction; bulk approve takes one savepoint per revision, deliberately (Task 6 ruling).
- **§2.4 / §10.2 / §26 definition of done** ("Product, policy, broker approval and taxonomy actions are audited") — three new audit actions, every one written inside the transaction it describes, every one carrying a reason where the spec demands one.
- **§26.2**'s decision rules are unchanged and still enforced: bulk approve goes through `approve_revision`, so "repeated click cannot create multiple snapshots" and "if another moderator already decided, return conflict" hold — a revision decided between the snapshot and the loop is skipped, not double-approved.
- **§30.1** — one listed endpoint implemented, two additions flagged in the Contract summary.
- **§30.2** — every mutation returns the updated resource (the full staff broker detail); errors use the standard envelope; the new codes are listed in Global Constraints.
- **§30.3** — `Idempotency-Key` still absent; Known Limitation 3.
- **§30.4** — no new throttle scope; staff endpoints are not in §30.4's enumerated list and all require a staff group.
- **§34.1/§34.2/§34.3** — unit tests for the policy function and the transition set; concurrency covered by the unchanged optimistic-locking path (`bump_version` compare-and-swap inside `publish_revision`, exercised by Phase 11's existing `test_locking.py` and by bulk approve's stale-state skip); API tests for authz, stable error codes and the pending-listing-absent-publicly assertion in Task 10 acceptance test 4.
- **§35.1** — no new flag; the two mutations sit behind `listing_revisions`, tested in Tasks 5 and 6.
- **§37** — every new UI string has EN/IT/ES keys in `frontend/src/lib/i18n/staff-brokers.ts`; no English is hard-coded in a component; no new English UI copy is invented in a backend JSON response.
- **§39** — no partial implementations, no faked data, no TODO placeholders; the handoff note in Task 10 covers every required item.

**Gaps deliberately left, with the owning phase named:** the staff dashboard shell and navigation (Phase 17), §20.4's non-substantive field list (Phase 17), `Idempotency-Key` (Phase 14), notification receivers (Phase 18), the entitlement ledger (Phase 13), the media upgrade tier (Phase 15), the broker dashboard (Phase 19), browser end-to-end tests (Phase 23). No spec §21 requirement is unaccounted for.

**3. Placeholder scan:** searched this plan for "TBD", "TODO", "implement later", "fill in details", "add appropriate error handling", "add validation", "handle edge cases", "similar to Task N", and tests described but not written. **None found.** Every code step carries the real code, and every test step carries the real test. Three things that could be mistaken for placeholders are deliberate and are called out where they appear:
- `ListingEntitlementGate` is left exactly as Phase 11 wrote it. That is the ruling on §21 rule 1, not an omission: there is no quota to switch off, and the rule is discharged by an end-to-end proof plus a tripwire test plus a binding contract rule.
- The `<N_BACKEND>` / `<TOTAL_BACKEND>` markers in the handoff note are counts that cannot exist before the suite runs; Step 4 says so and forbids writing the note first.
- The draft-payload keys in Task 10's helper are followed by an explicit instruction to copy them from `listings/tests/test_draft_create.py` if they fail — Phase 11's schema is the authority, and a plan that pretends to remember another file's exact schema is worse than one that names the file.

**4. Type and name consistency (checked across every task's Interfaces block):**
- `publish_revision(*, listing, revision, actor, cleaned, expected_revision_version, note="", auto_approved=False, publication_source=None) -> ListingSnapshot` — identical in Task 1's Interfaces block, its definition, its test, its call in `approve_revision` (Task 1) and its call in `submit_listing_revision` (Task 2).
- `guard_base_snapshot(listing, revision) -> None` — positional in all three places it appears (Task 1's definition, `publish_revision`'s first line, `approve_revision`).
- `requires_staff_approval(listing) -> bool` — signature unchanged from Phase 11, so `listings.serializers.ListingWorkflowSerializer`'s existing call keeps working untouched; asserted by Task 2's API test reading `policy.requires_approval`.
- `set_broker_auto_approval(broker, *, enabled, actor, reason, source=AuditEvent.Source.API) -> PolicyChange` — same in Task 3's definition, Task 3's admin call sites, Task 5's view, and Tasks 3/4/5/10's tests. Every caller reads `.broker` / `.changed`, never treats the result as a `BrokerOrganization`.
- `clean_policy_reason(reason) -> str` and `POLICY_REASON_REQUIRED_MESSAGE` — defined in Task 3 (constant extracted in Task 5 Step 3a), consumed by `BrokerApprovalPolicySerializer` (Task 5) and `bulk_approve_pending_broker_revisions` (Task 6).
- `broker_listing_counts(broker)` returns `{"by_status": {...}, "total": int}` — same shape in Task 4's selector, Task 4's serializer, Task 4's and Task 10's assertions, and the TypeScript `StaffBrokerListingCounts` in Task 7. The seven keys are spec §6.1's `ListingStatus` values verbatim, and `LISTING_STATUS_ORDER` in Task 7 lists exactly those seven.
- `BulkApprovalResult(approved: list[str], failures: list[BulkApprovalFailure])` and `BulkApprovalFailure(revision_id, listing_id, code, message)` — Task 6's dataclasses, `asdict()`-ed into the response in Task 6's view, mirrored field-for-field by `BulkApproveFailure` / `BulkApproveResponse` in Task 9's TypeScript.
- `StaffBrokerDetail` (TypeScript, Task 7) matches `StaffBrokerDetailSerializer.to_representation` (Python, Task 4) field for field, including `auto_approve_changed_at: string | null` for a nullable datetime and `pending_revision_count: number`. The policy PATCH response adds `changed` (`PolicyUpdateResponse`, Task 8) and the bulk response nests the detail under `broker` (Task 9) — both match their views.
- `tStaffBroker(locale: Locale, key: string): string` — one accessor, used by all five components; `Locale` and `DEFAULT_LOCALE` are imported from `@/lib/i18n/directory` and never re-declared (the same single-source rule Phase 5 set).
- `ConfirmPolicyChangeDialog` props `{ locale, title, body, submitting, error, onConfirm, onCancel }` — identical in its definition, its own test, `AutoApprovalPanel` (Task 8) and `BulkApprovePanel` (Task 9).
- `onUpdated: (broker: StaffBrokerDetail) => void` — the same prop name and type on `AutoApprovalPanel` and `BulkApprovePanel`, both wired to `setBroker` in `StaffBrokerDetailView`.
- Route names — `staff-broker-detail`, `staff-broker-approval-policy`, `staff-broker-bulk-approve` — identical in every `path(..., name=...)` and every `reverse()` call in Tasks 4, 5, 6 and 10. Phase 11's names (`listing-draft-create`, `listing-draft-update`, `listing-submit`, `listing-detail`) are used unchanged in Tasks 2 and 10.
- Audit actions — `broker.auto_approval_changed`, `listing.revision_auto_approved`, `broker.pending_revisions_bulk_approved` — spelled identically in the services that write them, the tests that read them, `brokers.selectors.broker_audit_history`'s filter and the `staff.broker.audit.<action>` i18n keys in Task 9.
- Error codes — `policy_reason_required`, `bulk_approve_not_confirmed` — spelled identically in Global Constraints, the serializers that raise them and the tests that assert them. Reused Phase 3/11 codes (`staff_admin_required`, `staff_moderator_required`, `feature_disabled`, `validation_error`, `stale_base_snapshot`) are never re-defined here.
- Enum members — `ListingStatus.PENDING_APPROVAL`, `ListingStatus.PUBLISHED`, `RevisionStatus.SUBMITTED`, `RevisionStatus.APPROVED`, `PublicationSource.BROKER_POLICY`, `BrokerOrganizationStatus.ACTIVE`, `BrokerMembershipRole.ADMIN`, `StaffGroup.ADMIN`/`MODERATOR` — identical everywhere they appear, and all come from the merged modules rather than being re-declared.
