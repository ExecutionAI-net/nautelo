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


def _locked_submitted_revision(revision_id) -> tuple[ListingRevision, BoatListing]:
    """Lock the listing and its revision, and refuse anything already decided.

    Locks are taken listing-first, revision-second — the same order as
    listings.submissions and listings.drafts, which lock the listing and then
    UPDATE the revision through bump_version(). Taking them the other way round
    here would invert the order between a moderator's decision and the seller's
    concurrent withdraw of the same listing, which is a deadlock. The unlocked
    read that opens the function only resolves `listing_id`; nothing is decided
    on it, and `DoesNotExist` propagates as the caller's 404.

    `of=("self",)` keeps each lock on the row this decision actually writes.
    A bare `select_for_update()` with `select_related()` locks every joined row
    too, so two moderators deciding two unrelated listings that happen to share
    a brand would serialise on that one shared taxonomy row.
    """
    listing_id = ListingRevision.objects.values_list("listing_id", flat=True).get(
        pk=revision_id
    )
    listing = (
        BoatListing.objects.select_for_update(of=("self",))
        .select_related("brand", "model")
        .get(pk=listing_id)
    )
    revision = ListingRevision.objects.select_for_update(of=("self",)).get(
        pk=revision_id
    )
    if revision.state != RevisionStatus.SUBMITTED:
        raise InvalidWorkflowState(
            "This revision has already been decided.", code="invalid_revision_state"
        )
    return revision, listing


def _require_note(note: str) -> str:
    """Spec §26.2: "Request changes and reject require a user-visible reason"."""
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


def _refuse(
    *,
    revision_id,
    actor,
    expected_version,
    note,
    target_state,
    listing_status,
    action,
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
    revision = _refuse(
        revision_id=revision_id,
        actor=actor,
        expected_version=expected_version,
        note=note,
        target_state=RevisionStatus.REJECTED,
        listing_status=ListingStatus.REJECTED,
        action="listing.revision_rejected",
        signal=listing_revision_rejected,
    )
    _refund_listing_right(BoatListing.objects.get(pk=revision.listing_id), actor)
    return revision


def _refund_listing_right(listing, actor) -> None:
    """A rejected first submission gives its listing right back.

    Resubmitting the listing burns a right again. Changes-requested keeps the
    right attached (the correction loop), and a listing that already has a
    public snapshot was paid for at its first approval, so neither is refunded.
    """
    if listing.current_public_snapshot_id is not None or listing.consumed_entitlement_id is None:
        return
    from entitlements.services import restore_consumed_right

    restore_consumed_right(
        entitlement=listing.consumed_entitlement,
        actor=actor,
        reason="Listing rejected: right returned to the seller.",
    )
    BoatListing.objects.filter(pk=listing.pk).update(consumed_entitlement=None)


@transaction.atomic
def create_staff_correction_revision(
    *, listing: BoatListing, actor, payload: dict, note: str
) -> ListingRevision:
    """Spec §20.3: a staff-authored correction of a field the seller cannot edit.

    Created already SUBMITTED so it does not sit in DRAFT holding the listing's
    single open-revision slot while nobody decides it; approval then runs through
    approve_revision() like any other revision, producing the next snapshot
    version and leaving the historical snapshot immutable.

    No permission check and no HTTP route live here on purpose: spec §26.2's
    moderation queue is Phase 17, and that phase's dispatch is what gates this
    service behind staff *admin* (spec §20.3), which is narrower than the
    moderator gate on ordinary approve/reject.
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

    # The whole point of a §20.3 correction is the four taxonomy fields, and
    # those live on BoatListing's own columns — which is where
    # listings.snapshots reads brand/model/custom-model/year from. Mirroring
    # them here, exactly as an owner edit does (Task 9), is what makes approving
    # this revision publish a snapshot carrying the *corrected* values instead
    # of silently re-publishing the wrong ones.
    _apply_payload_to_listing(listing, cleaned)
    listing.updated_by = actor
    try:
        listing.full_clean(exclude=FULL_CLEAN_EXCLUDED_FIELDS)
    except DjangoValidationError as exc:
        raise_as_drf_validation_error(exc)
    listing.save()

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
    """The SUSPENDED -> PUBLISHED return edge of spec §6.1's state machine.

    `current_public_snapshot` is never touched in either direction, so the
    content the public sees is exactly what it was before the suspension.
    """
    return _change_suspension(
        listing=listing,
        actor=actor,
        reason=reason,
        target_status=ListingStatus.PUBLISHED,
        action="listing.unsuspended",
    )
