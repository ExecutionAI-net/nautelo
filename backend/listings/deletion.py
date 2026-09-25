"""Owner-initiated listing deletion.

A soft delete, not a row delete: `deleted_at` is independent of `status` and
settable from any workflow state. The row - and the FREE_LISTING entitlement
its publication may have consumed - is never removed, so a deleted listing
still counts against the owner's free-listing quota (entitlements.policy
computes that purely from the entitlement ledger, never from this table).
Once deleted, the listing disappears from the owner's dashboard and its
counters, and - if it was published - from every public read path too, since
published_listings_queryset() excludes deleted_at rows.
"""

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import APIException
from rest_framework import status

from audit.models import AuditEvent
from audit.services import record_audit_event

from .locking import bump_version
from .models import BoatListing


class ListingAlreadyDeleted(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "This listing was already deleted."
    default_code = "listing_already_deleted"


@transaction.atomic
def delete_listing(*, listing: BoatListing, actor, expected_version: int) -> BoatListing:
    listing = BoatListing.objects.select_for_update().get(pk=listing.pk)
    if listing.deleted_at is not None:
        raise ListingAlreadyDeleted()

    before = {"status": listing.status, "deleted_at": None}
    bump_version(
        listing,
        expected_version=expected_version,
        resource="listing",
        deleted_at=timezone.now(),
        updated_by=actor,
    )

    record_audit_event(
        actor_user=actor,
        actor_type=AuditEvent.ActorType.USER,
        action="listing.deleted",
        target_type="listings.BoatListing",
        target_id=str(listing.pk),
        source=AuditEvent.Source.API,
        before=before,
        after={"status": listing.status, "deleted_at": listing.deleted_at},
    )
    return listing
