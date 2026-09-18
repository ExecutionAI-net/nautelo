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

#: The most revisions one run will publish. Spec §21 rule 7 puts no number on
#: "bulk", but one HTTP request that makes an unbounded number of listings
#: public is both an operational risk (every approval writes a snapshot, an
#: audit row and an on-commit signal fan-out) and an irreversible one — there is
#: no bulk *un*-approve. Above the ceiling the run approves the oldest
#: submissions and leaves the rest SUBMITTED, so the operator repeats the
#: action, each repetition separately confirmed and separately audited. The
#: audit row and the refreshed `pending_revision_count` in the response both say
#: what is left, so a capped run is never a silent one.
BULK_APPROVE_MAX_BATCH = 200


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


def pending_revision_ids(broker: BrokerOrganization) -> list[tuple]:
    """This broker's SUBMITTED revisions, oldest submission first.

    `listing__broker` is the whole scoping rule: another organization's backlog
    and every private seller's listing are outside it by construction. The order
    is `(submitted_at, pk)` — deterministic even when two agents submit inside
    the same clock tick, which matters because the batch ceiling below decides
    *which* rows a capped run takes.
    """
    return list(
        ListingRevision.objects.filter(
            listing__broker=broker, state=RevisionStatus.SUBMITTED
        )
        .order_by("submitted_at", "pk")
        .values_list("pk", "listing_id")
    )


def bulk_approve_pending_broker_revisions(
    *, broker: BrokerOrganization, actor, reason: str
) -> BulkApprovalResult:
    """Approve every SUBMITTED revision on this broker's listings, one by one.

    Staff-moderator authorization is enforced by the caller
    (`BrokerPendingApprovalsView`), and the `confirm` flag by its serializer:
    this service has no request to answer, and it is also reachable from a
    future management command where "confirmation" means something else. The
    reason is re-checked here through `clean_policy_reason`, so no caller can
    run an unexplained sweep.

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

    pending = pending_revision_ids(broker)
    batch = pending[:BULK_APPROVE_MAX_BATCH]

    approved: list[str] = []
    failures: list[BulkApprovalFailure] = []

    for revision_id, listing_id in batch:
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
            after={
                "approved_count": len(approved),
                "failed_count": len(failures),
                # Counted again rather than derived, so the trail records what
                # the next run will actually find: the capped remainder, the
                # rows that failed, and anything submitted while this ran.
                "remaining_count": len(pending_revision_ids(broker)),
            },
            metadata={
                "reason": cleaned_reason,
                "broker_slug": broker.slug,
                "batch_limit": BULK_APPROVE_MAX_BATCH,
                "approved_revision_ids": approved,
                # Ids and stable codes only: no listing content, no contact
                # details, nothing a staff reader would have to be entitled to
                # see (spec §10.2).
                "failures": [asdict(failure) for failure in failures],
            },
        )

    return BulkApprovalResult(approved=approved, failures=failures)
