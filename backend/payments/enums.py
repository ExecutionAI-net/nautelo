"""Payment and product vocabulary (spec §23.1, §6.4, §11.9, §35.1).

Values are copied verbatim from the spec and must never be renamed: they are
persisted in the database, returned in API responses, sent to Stripe as
metadata and written into audit events.
"""

from django.db import models

from entitlements.enums import EntitlementType


class ProductCode(models.TextChoices):
    """Spec §23.1: "supports exactly these product codes in this release"."""

    INDIVIDUAL_LISTING_RIGHT = "INDIVIDUAL_LISTING_RIGHT", "Individual listing right"
    LISTING_MEDIA_UPGRADE = "LISTING_MEDIA_UPGRADE", "Listing media upgrade"


PRODUCT_CODES: frozenset[str] = frozenset(ProductCode.values)

# What one purchase of each product grants (spec §23.1). The values come from
# Phase 13's merged enum rather than from string literals, so a rename there is
# a test failure here instead of a silent mis-grant.
PRODUCT_ENTITLEMENT_TYPES: dict[str, str] = {
    ProductCode.INDIVIDUAL_LISTING_RIGHT: EntitlementType.PAID_LISTING,
    ProductCode.LISTING_MEDIA_UPGRADE: EntitlementType.MEDIA_UPGRADE,
}

# Spec §23.1: the media upgrade "Grants one upgrade bound to one eligible
# private-seller listing" and "Cannot be transferred after binding". The listing
# right binds to nothing at purchase time — it is consumed at submit (spec §6.3).
LISTING_BOUND_PRODUCTS: frozenset[str] = frozenset({ProductCode.LISTING_MEDIA_UPGRADE})


class PaymentOrderStatus(models.TextChoices):
    """Spec §11.9's `status` column and §6.4's state machine."""

    CREATED = "CREATED", "Created"
    CHECKOUT_OPEN = "CHECKOUT_OPEN", "Checkout open"
    PAID = "PAID", "Paid"
    FULFILLED = "FULFILLED", "Fulfilled"
    FAILED = "FAILED", "Failed"
    EXPIRED = "EXPIRED", "Expired"
    REFUNDED = "REFUNDED", "Refunded"
    DISPUTED = "DISPUTED", "Disputed"


# Spec §6.4, verbatim:
#   CREATED -> CHECKOUT_OPEN -> PAID -> FULFILLED
#                            -> FAILED
#                            -> EXPIRED
#   PAID/FULFILLED -> REFUNDED or DISPUTED
#
# Two readings are fixed here, because the diagram leaves them open:
#   * CREATED may also go straight to FAILED or EXPIRED. The row is written
#     BEFORE the Stripe session exists (spec §23.2: "Create local PaymentOrder
#     before Stripe session"), so a session creation that never succeeds leaves
#     a CREATED row with nowhere else to go.
#   * REFUNDED and DISPUTED are mutually reachable. A customer can dispute a
#     charge that was already refunded, and a dispute is very often settled by
#     refunding.
# FAILED and EXPIRED are the only terminal states: money never moved.
PAYMENT_TRANSITIONS: dict[str, frozenset[str]] = {
    PaymentOrderStatus.CREATED: frozenset(
        {
            PaymentOrderStatus.CHECKOUT_OPEN,
            PaymentOrderStatus.FAILED,
            PaymentOrderStatus.EXPIRED,
        }
    ),
    PaymentOrderStatus.CHECKOUT_OPEN: frozenset(
        {
            PaymentOrderStatus.PAID,
            PaymentOrderStatus.FAILED,
            PaymentOrderStatus.EXPIRED,
        }
    ),
    PaymentOrderStatus.PAID: frozenset(
        {
            PaymentOrderStatus.FULFILLED,
            PaymentOrderStatus.REFUNDED,
            PaymentOrderStatus.DISPUTED,
        }
    ),
    PaymentOrderStatus.FULFILLED: frozenset(
        {PaymentOrderStatus.REFUNDED, PaymentOrderStatus.DISPUTED}
    ),
    PaymentOrderStatus.FAILED: frozenset(),
    PaymentOrderStatus.EXPIRED: frozenset(),
    PaymentOrderStatus.REFUNDED: frozenset({PaymentOrderStatus.DISPUTED}),
    PaymentOrderStatus.DISPUTED: frozenset({PaymentOrderStatus.REFUNDED}),
}

TERMINAL_PAYMENT_STATES: frozenset[str] = frozenset(
    {PaymentOrderStatus.FAILED, PaymentOrderStatus.EXPIRED}
)

# States in which Stripe has confirmed money moved. Read by the `paid_at`
# database constraint and by the staff counters.
PAID_STATES: frozenset[str] = frozenset(
    {
        PaymentOrderStatus.PAID,
        PaymentOrderStatus.FULFILLED,
        PaymentOrderStatus.REFUNDED,
        PaymentOrderStatus.DISPUTED,
    }
)


def can_transition_payment(current: str, target: str) -> bool:
    return target in PAYMENT_TRANSITIONS.get(current, frozenset())


class WebhookResult(models.TextChoices):
    """Spec §11.9's `ProcessedWebhookEvent.result`.

    RECEIVED is the value the row is inserted with, before the handler runs;
    every path overwrites it inside the same transaction, so a row still at
    RECEIVED after a commit is itself a bug worth alerting on.
    """

    RECEIVED = "RECEIVED", "Received"
    FULFILLED = "FULFILLED", "Fulfilled"
    ALREADY_FULFILLED = "ALREADY_FULFILLED", "Already fulfilled"
    IGNORED = "IGNORED", "Ignored"
    MISMATCH = "MISMATCH", "Mismatch"
    # The database refused the entitlement write (Phase 13's
    # entitlements_one_live_right_per_listing_and_type index). Distinct from
    # MISMATCH: the session DID match the order, the grant collided. Money has
    # moved, so the order stays PAID and a human resolves it.
    GRANT_CONFLICT = "GRANT_CONFLICT", "Grant conflict"
    ORDER_NOT_FOUND = "ORDER_NOT_FOUND", "Order not found"
    EXPIRED = "EXPIRED", "Expired"
    REFUND_HANDLED = "REFUND_HANDLED", "Refund handled"
    DISPUTE_HANDLED = "DISPUTE_HANDLED", "Dispute handled"


# Spec §35.1's rollout flag for this phase. Gates Checkout CREATION only — the
# webhook is deliberately never gated (see the plan's ruling).
STRIPE_CHECKOUT_FLAG = "stripe_entitlement_checkout"

# Stripe's own default replay window for Webhook.construct_event, stated
# explicitly rather than inherited, so a change to it is a visible diff.
STRIPE_SIGNATURE_TOLERANCE_SECONDS = 300

# Spec §30.3: "Store outcome for safe replay within a defined retention window."
# This is that window, as a documented client contract. Orders are never deleted
# (spec §35.3 preserves the ledger), so nothing sweeps them server-side.
IDEMPOTENCY_RETENTION_DAYS = 30
