"""Spec §22.2's ListingEligibilityService.

Spec §22.2 names the five places this is evaluated: the Sell landing CTA, the
private dashboard CTA, the create route, the draft-creation API and the final
submission inside the locked transaction. All five call THIS function; the
last one calls it again while holding the lock, which is what makes it
authoritative ("The last check is authoritative and prevents multiple-tab
races").
"""

from dataclasses import dataclass
from datetime import datetime

from accounts.enums import UserRole
from accounts.services import is_staff_admin

from .enums import (
    PURCHASE_PRODUCT_CODE,
    BlockingReason,
    EntitlementSource,
    EntitlementType,
)
from .policy import (
    FreeQuotaState,
    available_paid_rights,
    enforcement_enabled,
    free_quota_state,
    paid_publication_days,
)


@dataclass(frozen=True)
class RecommendedEntitlement:
    """Which right a submission would actually burn.

    Spec §22.2 shows this key as `null` and never shows a populated shape, so
    the shape is this plan's ruling: the fields the UI needs to say "you are
    about to use X, which publishes for N days and itself expires on D".
    `entitlement_id` is null for the free right, which has no ledger row until
    it is consumed at submit (spec §6.3).
    """

    entitlement_id: str | None
    entitlement_type: str
    source: str
    valid_until: datetime | None
    publication_days: int

    def as_dict(self) -> dict:
        return {
            "entitlement_id": self.entitlement_id,
            "entitlement_type": self.entitlement_type,
            "source": self.source,
            "valid_until": self.valid_until,
            "publication_days": self.publication_days,
        }


@dataclass(frozen=True)
class Eligibility:
    can_start_listing: bool
    recommended_entitlement: RecommendedEntitlement | None
    free: FreeQuotaState
    paid_listing_rights_available: int
    blocking_reason: str | None
    purchase_product_code: str

    def as_dict(self) -> dict:
        """Spec §22.2's payload, key for key and in its order.

        There is no DRF Serializer here on purpose: the dataclass is the single
        representation, so the API, the services and the tests cannot drift
        apart the way two parallel definitions would.
        """
        return {
            "can_start_listing": self.can_start_listing,
            "recommended_entitlement": (
                self.recommended_entitlement.as_dict()
                if self.recommended_entitlement is not None
                else None
            ),
            "free": self.free.as_dict(),
            "paid_listing_rights_available": self.paid_listing_rights_available,
            "blocking_reason": self.blocking_reason,
            "purchase_product_code": self.purchase_product_code,
        }


def _may_sell_privately(user) -> bool:
    """The same rule accounts.services.resolve_seller_context() applies when
    `broker_id` is None. Kept in lockstep deliberately: if these two ever
    disagree, the UI would offer a CTA the create endpoint then refuses."""
    return user.primary_role == UserRole.PRIVATE_SELLER or is_staff_admin(user)


class ListingEligibilityService:
    @staticmethod
    def for_user(user, *, now: datetime | None = None) -> Eligibility:
        free = free_quota_state(user, now=now)
        paid = list(available_paid_rights(user, now=now))
        paid_count = len(paid)

        if not _may_sell_privately(user):
            # Not an entitlement problem and not gated by the rollout flag:
            # this account could never create a private-seller listing.
            return Eligibility(
                can_start_listing=False,
                recommended_entitlement=None,
                free=free,
                paid_listing_rights_available=paid_count,
                blocking_reason=BlockingReason.NOT_AN_INDIVIDUAL_SELLER,
                purchase_product_code=PURCHASE_PRODUCT_CODE,
            )

        recommended = None
        if free.available:
            # Free first: never burn a purchased right while a free one is
            # available.
            recommended = RecommendedEntitlement(
                entitlement_id=None,
                entitlement_type=EntitlementType.FREE_LISTING,
                source=EntitlementSource.FREE_POLICY,
                valid_until=None,
                publication_days=free.publication_days,
            )
        elif paid:
            right = paid[0]
            recommended = RecommendedEntitlement(
                entitlement_id=str(right.pk),
                entitlement_type=EntitlementType.PAID_LISTING,
                source=right.source,
                valid_until=right.valid_until,
                # The package's length was frozen on the right at purchase; the
                # platform default only covers rights granted without one.
                publication_days=(right.metadata or {}).get("publication_days") or paid_publication_days(),
            )

        has_right = recommended is not None
        if has_right:
            can_start, blocking_reason = True, None
        elif enforcement_enabled():
            can_start, blocking_reason = False, BlockingReason.FREE_ALLOWANCE_USED
        else:
            # Flag off: nothing is refused, so the honest answer is "yes", and
            # the `free` block still reports the real quota state.
            can_start, blocking_reason = True, None

        return Eligibility(
            can_start_listing=can_start,
            recommended_entitlement=recommended,
            free=free,
            paid_listing_rights_available=paid_count,
            blocking_reason=blocking_reason,
            purchase_product_code=PURCHASE_PRODUCT_CODE,
        )
