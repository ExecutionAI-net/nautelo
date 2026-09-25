"""Owner-initiated listing pause/resume (customer feedback, 2026-09-25).

Distinct from delete: a paused listing stays visible in the owner's own
dashboard (MyListingsView filters only on `deleted_at`, never `status`), but
drops out of every public read path since published_listings_queryset()
only ever serves status=PUBLISHED. Distinct from suspend_listing/
unsuspend_listing in decisions.py: those are staff-only moderation actions
that feed the staff console's "suspended" queue (spec 6.1, 36.4); pausing is
the seller's own action and must never appear there.
"""

from django.db import transaction

from audit.models import AuditEvent
from audit.services import record_audit_event

from .drafts import InvalidWorkflowState
from .enums import ListingStatus, can_transition_listing
from .locking import bump_version
from .models import BoatListing


def _change_pause_state(*, listing: BoatListing, actor, expected_version: int, target_status: str, action: str) -> BoatListing:
    listing = BoatListing.objects.select_for_update().get(pk=listing.pk)
    if not can_transition_listing(listing.status, target_status):
        raise InvalidWorkflowState(
            f"A listing in state {listing.status} cannot move to {target_status}.",
            code="invalid_listing_state",
        )

    before_status = listing.status
    bump_version(
        listing,
        expected_version=expected_version,
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
        source=AuditEvent.Source.API,
        before={"status": before_status},
        after={"status": listing.status},
    )
    return listing


@transaction.atomic
def pause_listing(*, listing: BoatListing, actor, expected_version: int) -> BoatListing:
    return _change_pause_state(
        listing=listing,
        actor=actor,
        expected_version=expected_version,
        target_status=ListingStatus.PAUSED,
        action="listing.paused",
    )


@transaction.atomic
def resume_listing(*, listing: BoatListing, actor, expected_version: int) -> BoatListing:
    return _change_pause_state(
        listing=listing,
        actor=actor,
        expected_version=expected_version,
        target_status=ListingStatus.PUBLISHED,
        action="listing.resumed",
    )
