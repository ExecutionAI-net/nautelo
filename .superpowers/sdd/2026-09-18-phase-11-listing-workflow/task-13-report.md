# Task 13 report — staff corrections and listing suspension

Branch: `phase-11-task-13-staff-corrections` (worktree `nautelo-worktree-phase11-t13`), based on `dev` @ `6d93184`.

## What was built

### Step 3a — `listings/drafts.py`
- `_payload_from_snapshot` → `payload_from_snapshot` (public). Exactly two references existed in
  the repository (the definition plus the one call inside `update_listing_draft`); a repo-wide grep
  confirmed no other module, test or serializer referenced the private name. Both were updated.

### Step 3b — `listings/decisions.py`
Appended three public services plus one private helper, and widened the existing import block:

- `create_staff_correction_revision(*, listing, actor, payload, note) -> ListingRevision`
  — `@transaction.atomic`; requires a note via the existing `_require_note`; re-reads the listing
  under `select_for_update()`; refuses with `InvalidWorkflowState(code="invalid_revision_state")`
  (409) when `open_revision_for(listing)` is not `None`; seeds `merged` from
  `payload_from_snapshot(listing.current_public_snapshot)`; validates the staff payload with
  `validate_revision_payload(..., origin=RevisionOrigin.STAFF_CORRECTION, for_submission=False)`
  and merges it over the seed; mirrors the cleaned fields onto the `BoatListing` columns via
  `_apply_payload_to_listing` + `full_clean` + `save`; creates the revision already in
  `SUBMITTED` with `origin=STAFF_CORRECTION`, `base_snapshot=current_public_snapshot`,
  `submitted_by=actor`, `submitted_at=now`; writes a `listing.correction_revision_created`
  audit event; emits `listing_revision_submitted` on commit.
- `_change_suspension(*, listing, actor, reason, target_status, action)` — shared body: note/reason
  required, `select_for_update()` re-read, `can_transition_listing` guard raising
  `InvalidWorkflowState(code="invalid_listing_state")`, `bump_version(...)`, audit event with
  `source=ADMIN` and `metadata["reason"]`.
- `suspend_listing(...)` → `PUBLISHED → SUSPENDED`, action `listing.suspended`.
- `unsuspend_listing(...)` → `SUSPENDED → PUBLISHED`, action `listing.unsuspended`.

Neither suspension service reads or writes `current_public_snapshot` (spec §36.4).

### Step 1 — `listings/tests/test_staff_corrections.py`
11 tests, exactly the ones the brief lists.

## Signatures verified before use (not taken from the brief's inline code)

| Symbol | Real signature / fact | Confirmed |
|---|---|---|
| `listings.drafts.open_revision_for` | `(listing) -> ListingRevision \| None`, filters `DRAFT`/`SUBMITTED` | yes |
| `listings.drafts._apply_payload_to_listing` | `(listing, cleaned) -> None`; resolves taxonomy only when the payload touches it or `brand_id is None` | yes |
| `listings.payloads.validate_revision_payload` | `(payload, *, listing, origin, for_submission) -> dict` | yes |
| `listings.enums.can_transition_listing` | `(current, target) -> bool` | yes |
| `LISTING_TRANSITIONS` | `PUBLISHED → {SUSPENDED, EXPIRED}`, `SUSPENDED → {PUBLISHED, ARCHIVED}`, `DRAFT → {PENDING_APPROVAL, PUBLISHED}` — so `DRAFT → SUSPENDED` is genuinely invalid | yes |
| `listings.locking.bump_version` | `(instance, *, expected_version, resource, **updates) -> None`, raises `StaleVersionConflict` | yes |
| `audit.services.record_audit_event` | keyword-only `actor_user, actor_type, action, target_type, target_id, source, before, after, request_id, metadata, ip_hash` — same call shape Task 11 uses | yes |
| `AuditEvent.Source.ADMIN` | exists | yes |
| `AuditEvent.before/after/metadata` | `JSONField(encoder=DjangoJSONEncoder)`, so the raw `submitted_at` datetime serialises | yes |
| `listings.tests.factories.*` | `make_brand(name)`, `make_model(brand, name)`, `make_media(listing, *, media_type, status, sort_order, **kw)`, `make_private_listing(*, owner, brand=None, model=None, **kw)`, `make_revision(listing, **kw)`, `make_snapshot(listing, *, approved_by, version=1, **kw)` | yes |
| `accounts.tests.factories.make_user` | `(email="user@example.com", *, password, verified=True, role=UserRole.BUYER, locale, is_active, full_name, **extra)` | yes |
| `ListingRevision` constraints | `listings_revision_non_draft_requires_submission_stamps` needs `submitted_by` + `submitted_at` on a non-DRAFT row — satisfied | yes |

## Deviations from the brief (all deliberate, all small)

1. **Test factory kwargs corrected.** The brief's sample used
   `make_user(primary_role=UserRole.STAFF, is_email_verified=True)`. The real factory takes
   `email` positionally-or-by-keyword and `role=` / `verified=` keyword-only, and passes
   `primary_role=role` itself, so the brief's call would have raised `TypeError` twice over.
   Replaced with `make_user(email=..., role=UserRole.STAFF, verified=True)`.
2. **Distinct emails per user.** `make_user`'s email default is fixed, so the brief's
   `_published_listing()` (which calls `_staff()` for the snapshot approver) plus a test-body
   `_staff()` would have collided on the unique email column. `_staff(email="staff@example.com")`
   now takes an argument; the snapshot approver is `original-approver@example.com`, the seller
   `private-seller@example.com`, and the DRAFT-listing owner `draft-owner@example.com`.
3. **`full_clean` error handling reuses the module's existing helpers.** The brief's inline code
   caught a bare `Exception` and hand-built a DRF `ValidationError` from `message_dict`.
   `listings/drafts.py` already exports `raise_as_drf_validation_error(exc)` and
   `FULL_CLEAN_EXCLUDED_FIELDS` for exactly this, and `create_listing_draft` /
   `update_listing_draft` both use them. The correction service now does the same: catch
   `django.core.exceptions.ValidationError` specifically and re-raise through the shared helper.
   Same observable behaviour, one code path instead of two, and it no longer swallows unrelated
   exceptions (e.g. `StaleVersionConflict`, `DatabaseError`) into a 400.
4. **Import list.** The brief's Step 3b import block omitted `FULL_CLEAN_EXCLUDED_FIELDS`,
   `raise_as_drf_validation_error` and `django.core.exceptions.ValidationError`, which follow from
   deviation 3. Existing lines were widened rather than duplicated, as instructed.
5. **Added a docstring to `unsuspend_listing`** (the brief left it bare) noting the §6.1 return
   edge and that `current_public_snapshot` is untouched. Also expanded
   `create_staff_correction_revision`'s docstring with the "no permission check, no route here —
   Phase 17 gates this behind staff *admin*" note, so the next reader does not mistake the absence
   of a gate for an oversight.

Nothing else in `decisions.py` changed. No view, route, serializer, permission class or migration
was added — per the brief's explicit ruling, and per the coordinating instruction that Phase 17's
dispatch is what must add `IsStaffAdmin` (spec §20.3 requires admin, narrower than Task 12's
`IsStaffModerator` gate on approve/reject).

## Test results

| Run | Command | Result |
|---|---|---|
| New file only | `uv run python -m pytest listings/tests/test_staff_corrections.py -q` | **11 passed** |
| Brief's Step 4 (new + Task 9's suite, proving the rename) | `uv run python -m pytest listings/tests/test_staff_corrections.py listings/tests/test_draft_update.py -q --create-db` | **33 passed** (11 new + 22 Task 9) |
| Whole app | `uv run python -m pytest listings/ -q --reuse-db` | **182 passed** |
| Whole backend | `uv run python -m pytest -q --reuse-db` | **482 passed**, 0 failed, 115 warnings (all pre-existing `InsecureKeyLengthWarning` from the test JWT key) |

No test outside `listings/` changed behaviour. `test_draft_update.py` (Task 9) passes unchanged
after the `payload_from_snapshot` rename — it never referenced the private name, it exercises
`update_listing_draft`, which is the one caller that was updated.

No lint run: `ruff` is not installed in this project's `uv` environment (`program not found`),
and the repo has no other configured linter entry point.

## Concerns (none blocking)

1. **A "correction" can be created on a listing that was never published.** There is no guard that
   `listing.current_public_snapshot` is not `None`. On an unpublished DRAFT listing the service
   would seed an empty payload, set `base_snapshot=None`, and leave a `SUBMITTED` staff revision
   occupying the single-open-revision slot — which is precisely the seller-blocking situation the
   brief's "created already SUBMITTED" ruling exists to avoid. The brief does not ask for the
   guard and no test covers it, so I did not invent one; Phase 17's dispatch should either add
   `listing.current_public_snapshot_id is not None` as a precondition or the service should grow
   that check then.
2. **The brief's own docstring rationale is slightly self-contradictory.** It says the revision is
   created SUBMITTED "because a correction that sat in DRAFT would occupy the listing's single
   open-revision slot" — but `SUBMITTED` is also an open state, so the slot is occupied either
   way. What actually changes is that the revision lands in the moderation queue immediately
   instead of being invisible. I reworded the implementation docstring to say that, rather than
   copying a claim the constraint contradicts.
3. **`_require_note` is reused for the suspension `reason`.** Its DRF error therefore comes back
   under the key `"note"` with the text "Explain what the seller needs to change.", which will
   read oddly once Phase 17 surfaces a suspension form field called `reason`. Harmless today
   (no route, and the test only asserts `ValidationError`), but Phase 17 should either pass a
   field name into the helper or add a `_require_reason` sibling.
4. **Suspension takes no caller-supplied `expected_version`.** `_change_suspension` passes
   `expected_version=listing.version` from the row it just locked, so it cannot lose a concurrent
   write, but it also cannot honour spec §20.5's "stale updates return 409" contract for a client
   that held an older version. When Phase 17 wires a route, `expected_version` should become a
   parameter of `suspend_listing` / `unsuspend_listing` rather than being read from the row.
5. **`_apply_payload_to_listing` is still underscore-private but now has a second module calling
   it**, the same argument the brief used to justify renaming `_payload_from_snapshot`. The brief
   explicitly imports the private name, so I left it; it is a consistency wart worth cleaning up in
   whichever task next touches `drafts.py`.
6. **No permission check and no route, by design.** Flagging it explicitly so a reviewer does not
   read it as a hole: anything that eventually dispatches `create_staff_correction_revision` must
   gate on staff **admin** (spec §20.3), and `suspend_listing` / `unsuspend_listing` on staff
   (spec §6.1 "staff-only"). Nothing in this phase can call them, so nothing is currently exposed.
