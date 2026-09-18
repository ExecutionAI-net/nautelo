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
