"""Entitlement vocabulary (NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md §11.9, §6.3, §22.2).

Values are copied verbatim from the spec and must never be renamed: they are
persisted in the database, returned in API responses and written into audit
events.
"""

from django.db import models


class EntitlementType(models.TextChoices):
    FREE_LISTING = "FREE_LISTING", "Free listing"
    PAID_LISTING = "PAID_LISTING", "Paid listing"
    MEDIA_UPGRADE = "MEDIA_UPGRADE", "Media upgrade"


class EntitlementSource(models.TextChoices):
    FREE_POLICY = "FREE_POLICY", "Free policy"
    STRIPE_PURCHASE = "STRIPE_PURCHASE", "Stripe purchase"
    STAFF_GRANT = "STAFF_GRANT", "Staff grant"


class EntitlementState(models.TextChoices):
    AVAILABLE = "AVAILABLE", "Available"
    RESERVED = "RESERVED", "Reserved"
    CONSUMED = "CONSUMED", "Consumed"
    EXPIRED = "EXPIRED", "Expired"
    REVOKED = "REVOKED", "Revoked"


# The two types that let a listing be published. MEDIA_UPGRADE is spec §24.4's
# listing-bound media tier (Phase 15) and never satisfies a publication right.
LISTING_RIGHT_TYPES: frozenset[str] = frozenset(
    {EntitlementType.FREE_LISTING, EntitlementType.PAID_LISTING}
)

# Spec §6.3, verbatim:
#   AVAILABLE -> RESERVED -> CONSUMED
#   AVAILABLE -> EXPIRED
#   RESERVED  -> AVAILABLE (creation cancelled or timed out)
#   CONSUMED  -> REVOKED (refund/chargeback or staff remedy)
#
# AVAILABLE -> CONSUMED is included as a direct edge because spec §6.3's first
# line is a chain, not an obligation to pass through RESERVED, and because this
# phase deliberately does not reserve at draft creation (see the plan's scope
# ruling): a free or paid right goes straight from AVAILABLE to CONSUMED inside
# the single locked transaction spec §22.4 requires. Reading it any other way
# would make the spec's own "consumes once at submit" rule unreachable.
ENTITLEMENT_TRANSITIONS: dict[str, frozenset[str]] = {
    EntitlementState.AVAILABLE: frozenset(
        {
            EntitlementState.RESERVED,
            EntitlementState.CONSUMED,
            EntitlementState.EXPIRED,
        }
    ),
    EntitlementState.RESERVED: frozenset(
        {EntitlementState.CONSUMED, EntitlementState.AVAILABLE}
    ),
    EntitlementState.CONSUMED: frozenset({EntitlementState.REVOKED}),
    EntitlementState.EXPIRED: frozenset(),
    EntitlementState.REVOKED: frozenset(),
}


def can_transition_entitlement(current: str, target: str) -> bool:
    return target in ENTITLEMENT_TRANSITIONS.get(current, frozenset())


class BlockingReason:
    """Why `can_start_listing` is False (spec §22.2's `blocking_reason`).

    FREE_ALLOWANCE_USED is the spec's own literal. NOT_AN_INDIVIDUAL_SELLER is
    added by this phase for the account that cannot create a private-seller
    listing at all — the same rule accounts.services.resolve_seller_context()
    enforces — because spec §22.2's payload has no other way to say it and a
    bare `false` with a null reason would leave the UI nothing to render.
    """

    FREE_ALLOWANCE_USED = "FREE_ALLOWANCE_USED"
    NOT_AN_INDIVIDUAL_SELLER = "NOT_AN_INDIVIDUAL_SELLER"
    ALL: frozenset[str] = frozenset({FREE_ALLOWANCE_USED, NOT_AN_INDIVIDUAL_SELLER})


# Spec §22.2's `purchase_product_code` and §23.1's first product code.
PURCHASE_PRODUCT_CODE = "INDIVIDUAL_LISTING_RIGHT"

# Spec §35.1's rollout flag for this phase.
INDIVIDUAL_ENTITLEMENTS_FLAG = "individual_entitlements"

# Spec §6.3: "Reservations expire after 30 minutes unless attached to a saved
# draft."
RESERVATION_TIMEOUT_MINUTES = 30
