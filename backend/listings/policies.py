"""Policy seams this phase deliberately stubs, with their owners named.

Each callable below is the single call site a later phase replaces:
  * ListingEntitlementGate    -> spec Phase 13 (§22, ListingEligibilityService)
  * requires_staff_approval   -> spec Phase 12 (§21, broker auto-approval)
  * effective_media_allowance -> spec Phase 15 (§24, media upgrade tier)
"""

from dataclasses import dataclass

from accounts.enums import SellerType
from platform_settings.services import get_setting_value

from .enums import MediaType, PublicationSource
from .models import BoatListing, ListingMedia


@dataclass(frozen=True)
class MediaAllowance:
    images: int
    videos: int


class ListingEntitlementGate:
    """Phase 11 stub for spec §22.2's ListingEligibilityService.

    KNOWN LIMITATION: `can_submit` always returns True and `consume` never
    touches an entitlement ledger, because `UserEntitlement` (spec §11.9) is
    built in spec Phase 13. Phase 13 replaces these method bodies; the call
    sites in listings.submissions and listings.decisions do not change.
    """

    @staticmethod
    def can_submit(*, user, broker=None) -> bool:
        return True

    @staticmethod
    def consume(*, listing: BoatListing, user) -> str:
        """Return the PublicationSource to record on the listing.

        No ledger row is reserved or consumed in this phase, so
        BoatListing.consumed_entitlement_id stays NULL.
        """
        if listing.seller_type == SellerType.BROKER:
            return PublicationSource.BROKER_POLICY
        return PublicationSource.FREE_ENTITLEMENT

    @staticmethod
    def publication_days(*, listing: BoatListing) -> int | None:
        """How long an approved publication stays live.

        Real behaviour, not a stub: spec §1/§22.1 fix the individual free
        publication at 30 days and require it to be staff-configurable, which
        `individual.free_publish_days` already is. A broker listing has no
        configured window in this release (spec §21), so this returns None and
        `expires_at` stays NULL.
        """
        if listing.seller_type == SellerType.BROKER:
            return None
        return int(get_setting_value("individual.free_publish_days"))


def requires_staff_approval(listing: BoatListing) -> bool:
    """Whether a submission must wait for a moderator.

    Always True in Phase 11. Spec §6.1 allows a broker initial publication to go
    straight to PUBLISHED when `BrokerOrganization.auto_approve_listings` is
    true, but the surrounding policy (staff-admin-only toggle with a mandatory
    reason, future-only effect, bulk approval of the pending backlog) is spec
    Phase 12 (§21). Phase 12 swaps this body for the real check.
    """
    return True


def effective_media_allowance(listing: BoatListing) -> MediaAllowance:
    """Total images/videos permitted on this listing (spec §24.1 — totals, not
    increments).

    KNOWN LIMITATION: the private-seller *upgrade* tier (20 images / 1 video) is
    granted by a MEDIA_UPGRADE entitlement bound to the listing, which is spec
    Phase 13/14/15. Until then a private seller gets the base tier only.
    """
    if listing.seller_type == SellerType.BROKER:
        return MediaAllowance(
            images=int(get_setting_value("media.broker_image_limit")),
            videos=int(get_setting_value("media.broker_video_limit")),
        )
    return MediaAllowance(
        images=int(get_setting_value("media.private_base_image_limit")),
        videos=int(get_setting_value("media.private_base_video_limit")),
    )


def media_counts(listing: BoatListing) -> tuple[int, int]:
    """(images, videos) among all NON-REJECTED media rows.

    Spec §11.5: "Media count limits include all non-rejected items to prevent
    concurrent upload bypasses."
    """
    rows = ListingMedia.objects.non_rejected().filter(listing=listing)
    images = rows.filter(media_type=MediaType.IMAGE).count()
    videos = rows.filter(media_type=MediaType.VIDEO).count()
    return images, videos
