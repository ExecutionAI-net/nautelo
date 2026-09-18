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
    ListingEntitlementRequired,
    effective_media_allowance,
    media_counts,
    requires_staff_approval,
)
from .publication import publish_revision
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
    # Keep a handle on the object the caller handed us BEFORE rebinding the
    # name. `ListingSubmitView.post` serializes its *own* instance after
    # `refresh_from_db()`, and `ListingWorkflowSerializer.to_representation`
    # reads `getattr(listing, "open_revision", None)` before falling back to
    # `open_revision_for()` — which only ever finds a DRAFT or SUBMITTED row.
    # On the auto-approval path the revision is APPROVED by the time the
    # response is built, so without this reference the fallback finds nothing
    # and the endpoint answers `"revision": null` on a successful publication,
    # breaking spec §30.2's "Mutations return updated resource/version". The
    # closing assignment at the bottom of this function writes to it.
    #
    # (Phase 11 never hit this: a submitted revision stayed SUBMITTED, so the
    # fallback query always found it. This phase is the first caller that closes
    # the revision inside the same request. `listings/views.py` and
    # `listings/serializers.py` are owned by the Phase 9/10 plans and are not
    # touched here, so the fix belongs on this side of the call.)
    caller_listing = listing

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

    # Moved up from below: the entitlement guard needs it. Same expression, same
    # meaning, and it is still the value the `if requires_staff_approval(...)`
    # block below reads.
    is_initial = listing.current_public_snapshot_id is None
    # Spec §6.3 charges a right when a listing is "submitted for initial
    # approval" — so only an initial submission that has not already been
    # charged can possibly need one. A post-publication revision (spec §20.2)
    # and a correction of a withdrawn/rejected submission (spec §22.1) are both
    # already paid for, and `can_submit()` — which is not told which listing
    # this is — would refuse both once the seller's free right is gone.
    charges_a_right = is_initial and listing.consumed_entitlement_id is None

    if charges_a_right and not ListingEntitlementGate.can_submit(
        user=actor, broker=listing.broker
    ):
        # Spec §22.4. 403, not the 409 Phase 11's placeholder used: this is an
        # authorization answer, not a stale-state answer, and it must match the
        # code and status the draft-creation gate returns.
        #
        # This is only an early exit. `consume()` re-checks the same thing under
        # a lock and is the authoritative answer (spec §22.2's "last check"), so
        # a `charges_a_right` that is wrongly True still cannot burn a second
        # right, and one that is wrongly False still cannot publish for free.
        raise ListingEntitlementRequired()
    # Authoritative: re-checks and consumes under a lock on the seller's own
    # row, inside this transaction (spec §22.4, and §22.2's "last check").
    consumed = ListingEntitlementGate.consume(listing=listing, user=actor)
    publication_source = consumed.publication_source
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
                consumed_entitlement=consumed.entitlement,
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
    # Both objects: the locked copy this function worked on, and the instance
    # the caller (ListingSubmitView.post) still holds and is about to serialize.
    # Without the second line the response carries `"revision": null` whenever
    # the revision left DRAFT/SUBMITTED inside this call — i.e. on every
    # auto-approved submission. See the ruling above Step 3b's first edit.
    listing.open_revision = revision
    caller_listing.open_revision = revision
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
