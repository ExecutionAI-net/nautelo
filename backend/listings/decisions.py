"""Staff decisions on a submitted revision (spec §20.1 steps 7-8, §20.2, §26.2)."""

from datetime import timedelta

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
from .policies import ListingEntitlementGate
from .signals import (
    listing_published,
    listing_revision_approved,
    listing_revision_changes_requested,
    listing_revision_rejected,
    listing_revision_submitted,
)
from .snapshots import create_snapshot_from_revision
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

    if (
        revision.base_snapshot_id is not None
        and revision.base_snapshot_id != listing.current_public_snapshot_id
    ):
        # Another revision was approved while this one sat in the queue;
        # approving it now would silently discard that newer content. The
        # snapshot-level counterpart of spec §20.5's "do not silently overwrite
        # another browser/session edit".
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
        "updated_by": actor,
    }
    if is_first_publication:
        # PENDING_APPROVAL -> PUBLISHED, the only listing-status move approval
        # makes. A post-publication revision leaves `status` alone: the listing
        # is already PUBLISHED and LISTING_TRANSITIONS has no PUBLISHED ->
        # PUBLISHED edge, so re-writing it would be a no-op that contradicts the
        # state map (and would silently un-suspend a SUSPENDED listing whose
        # queued revision is approved later). `published_at` and `expires_at`
        # move with it, for the same reason: spec §11.4 makes `published_at` the
        # listing's publication moment, not the latest snapshot's.
        publication_days = ListingEntitlementGate.publication_days(listing=listing)
        updates["status"] = ListingStatus.PUBLISHED
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
