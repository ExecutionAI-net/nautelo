"""Extending or re-activating a private listing with a paid listing right.

A private seller whose free (30-day, one photo) publication is about to lapse, or
already has, can spend one purchased right to keep the listing online. The
right is consumed as a renewal row, the listing goes back to PUBLISHED with a
fresh window, and because the listing now stands on a paid right it gets the
upgraded media allowance (20 images, 1 video).

EXPIRED -> PUBLISHED is not an edge of the general listing state machine
(spec §6.2); this is the one sanctioned way across it.
"""

from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from accounts.enums import SellerType
from audit.models import AuditEvent
from audit.services import record_audit_event
from entitlements.consumption import ListingEntitlementRequired, lock_user_quota
from entitlements.enums import EntitlementState
from entitlements.policy import available_paid_rights, paid_publication_days

from .enums import ListingStatus, PublicationSource
from .locking import bump_version
from .models import BoatListing

RENEWABLE_STATES = frozenset({ListingStatus.PUBLISHED, ListingStatus.EXPIRED})


@transaction.atomic
def renew_listing(*, listing_id, actor, package: str | None = None) -> BoatListing:
    listing = BoatListing.objects.select_for_update().get(pk=listing_id)
    if listing.seller_type != SellerType.PRIVATE or listing.owner_user_id != actor.pk:
        raise PermissionDenied("Only the private seller can renew this listing.")
    if listing.status not in RENEWABLE_STATES or listing.expires_at is None:
        raise ValidationError({"detail": "This listing cannot be renewed."})

    now = timezone.now()
    lock_user_quota(actor)
    rights = available_paid_rights(actor, now=now)
    if package:
        rights = rights.filter(metadata__package=package)
    right = rights.select_for_update().first()
    if right is None:
        raise ListingEntitlementRequired(blocking_reason="FREE_ALLOWANCE_USED")

    days = right.metadata.get("publication_days") or paid_publication_days()
    right.state = EntitlementState.CONSUMED
    right.consumed_at = now
    right.listing = listing
    right.is_renewal = True
    right.metadata = {**right.metadata, "publication_days": days, "renewal": True}
    right.save(
        update_fields=[
            "state", "consumed_at", "listing", "is_renewal", "metadata", "updated_at",
        ]
    )

    before = {"listing_status": listing.status, "expires_at": listing.expires_at}
    base = max(now, listing.expires_at)
    bump_version(
        listing,
        expected_version=listing.version,
        resource="listing",
        status=ListingStatus.PUBLISHED,
        expires_at=base + timedelta(days=days),
        consumed_entitlement=right,
        publication_source=PublicationSource.PAID_ENTITLEMENT,
        updated_by=actor,
    )
    record_audit_event(
        actor_user=actor,
        actor_type=AuditEvent.ActorType.USER,
        action="listing.renewed",
        target_type="listings.BoatListing",
        target_id=str(listing.pk),
        source=AuditEvent.Source.API,
        before=before,
        after={"listing_status": listing.status, "expires_at": listing.expires_at},
        metadata={"entitlement_id": str(right.pk)},
    )
    return listing
