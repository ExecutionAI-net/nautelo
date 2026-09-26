"""Closing a private seller's own space when the account joins a brokerage.

A broker account never goes back to being a private seller, so whatever it
owned as a private seller is retired for good when it accepts a broker
invitation: its private listings are archived (soft-deleted, exactly like an
owner deletion), their open buyer conversations are closed, and every listing
right it has not spent yet is forfeited. The invitation e-mail and the
accept page warn about this beforehand, using `private_footprint()`.
"""

from django.db import transaction
from django.db.models import F
from django.utils import timezone

from accounts.enums import SellerType, UserRole
from audit.models import AuditEvent
from audit.services import record_audit_event

RETIRE_REASON = "joined_brokerage"


def _private_listings(user):
    from listings.models import BoatListing

    return BoatListing.objects.filter(
        owner_user=user, seller_type=SellerType.PRIVATE, deleted_at__isnull=True
    )


def private_footprint(user) -> dict | None:
    """What a private seller would lose, or None for any other account."""
    if user is None or user.primary_role != UserRole.PRIVATE_SELLER:
        return None
    from entitlements.models import UserEntitlement

    return {
        "listings": _private_listings(user).count(),
        "unused_rights": UserEntitlement.objects.for_user(user).listing_rights().available().count(),
    }


@transaction.atomic
def retire_private_space(user) -> dict:
    from entitlements.services import forfeit_unused_listing_rights
    from listings.enums import ListingStatus, RevisionStatus
    from listings.models import BoatListing, ListingRevision
    from messaging.enums import ConversationStatus
    from messaging.models import Conversation

    now = timezone.now()
    listing_ids = list(_private_listings(user).select_for_update().values_list("pk", flat=True))
    ListingRevision.objects.filter(listing_id__in=listing_ids, state=RevisionStatus.SUBMITTED).update(
        state=RevisionStatus.WITHDRAWN, version=F("version") + 1
    )
    BoatListing.objects.filter(pk__in=listing_ids).update(
        status=ListingStatus.ARCHIVED, deleted_at=now, updated_by=user, version=F("version") + 1, updated_at=now
    )
    closed = Conversation.objects.filter(listing_id__in=listing_ids, status=ConversationStatus.OPEN).update(
        status=ConversationStatus.BLOCKED, updated_at=now
    )
    forfeited = forfeit_unused_listing_rights(user=user, actor=user, reason=RETIRE_REASON)

    summary = {"listings": len(listing_ids), "conversations": closed, "rights": forfeited}
    record_audit_event(
        actor_user=user,
        actor_type=AuditEvent.ActorType.USER,
        action="account.private_space_retired",
        target_type="accounts.User",
        target_id=str(user.pk),
        source=AuditEvent.Source.API,
        before={"primary_role": UserRole.PRIVATE_SELLER},
        after={"primary_role": UserRole.BROKER},
        metadata={**summary, "listing_ids": [str(pk) for pk in listing_ids]},
    )
    return summary
