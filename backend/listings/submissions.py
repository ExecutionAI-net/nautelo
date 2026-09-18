"""Submission and withdrawal (spec §20.1, §20.2, §6.2, §36.4)."""

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ErrorDetail, ValidationError

from audit.models import AuditEvent
from audit.services import record_audit_event

from .drafts import InvalidWorkflowState, open_revision_for
from .enums import ListingStatus, MediaStatus, MediaType, RevisionStatus
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

    This is the layer on top of listings.payloads, which only checks that
    `media_ids` is a non-empty list of unique UUIDs: it never looks a row up, so
    it cannot tell a real READY photo of *this* listing from a stranger's id.
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
    uses_other_model = listing.model.is_other_placeholder
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
