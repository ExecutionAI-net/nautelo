"""Applying a purchased media upgrade to a listing (spec §24.4)."""

from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import APIException

from accounts.enums import SellerType
from entitlements.enums import EntitlementState, EntitlementType
from entitlements.models import UserEntitlement
from entitlements.services import consume_media_upgrade

from .models import BoatListing


class MediaUpgradeUnavailable(APIException):
    """No purchased, unexpired upgrade exists for this listing."""

    status_code = status.HTTP_409_CONFLICT
    default_detail = "There is no media upgrade available for this listing."
    default_code = "media_upgrade_unavailable"


class MediaUpgradeAlreadyApplied(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "This listing already has its media upgrade."
    default_code = "media_upgrade_already_applied"


@transaction.atomic
def apply_media_upgrade(*, actor, listing: BoatListing) -> UserEntitlement:
    """Consume the upgrade bound to `listing`. One listing, once, irreversible.

    The listing row is locked first so two tabs applying at once serialise; the
    loser sees the CONSUMED row and gets MediaUpgradeAlreadyApplied.
    """
    listing = BoatListing.objects.select_for_update().get(pk=listing.pk)
    if listing.seller_type != SellerType.PRIVATE or listing.owner_user_id != actor.pk:
        raise MediaUpgradeUnavailable()

    rows = UserEntitlement.objects.filter(
        listing=listing,
        user=actor,
        entitlement_type=EntitlementType.MEDIA_UPGRADE,
    )
    if rows.filter(state=EntitlementState.CONSUMED).exists():
        raise MediaUpgradeAlreadyApplied()
    entitlement = rows.available(now=timezone.now()).first()
    if entitlement is None:
        raise MediaUpgradeUnavailable()
    return consume_media_upgrade(entitlement=entitlement, actor=actor)
