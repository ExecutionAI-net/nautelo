"""Refunds and disputes (spec §23.4).

Three rules this module exists to keep:

  * "Refund action in staff UI calls a dedicated service; do not alter Stripe
    state by editing database fields" — nothing here calls Stripe. It reacts to
    what Stripe already did.
  * "Do not silently unpublish solely on a webhook" — a CONSUMED right is
    touched by nobody here; the order is flagged and staff are notified.
  * Phase 13 contract rule 1 — every state TRANSITION on a UserEntitlement goes
    through entitlements.services, which holds the lock, the §6.3 edge check and
    the audit event together.
"""

from django.db import transaction

from audit.models import AuditEvent
from entitlements.enums import EntitlementState

from .enums import PaymentOrderStatus, WebhookResult, can_transition_payment
from .fulfillment import flag_for_staff, order_not_found, record_payment_audit
from .models import PaymentOrder
from .webhooks import HANDLERS

# NOTE: `entitlements.services` is imported LAZILY, inside revoke_for_refund,
# and never at module scope. This module is imported by PaymentsConfig.ready(),
# which runs on EVERY management command, so a module-level import of a name
# that Phase 13 has not merged yet would break `manage.py check`, `migrate` and
# the whole test suite rather than just this feature. The Execution Model's gate
# is the primary protection; this is the belt to its braces.


def _locked_order_for_intent(payload):
    intent = payload.get("payment_intent") or ""
    if not isinstance(intent, str):
        intent = intent.get("id", "")
    if not intent:
        return None
    return (
        PaymentOrder.objects.select_for_update(of=("self",))
        .select_related("product", "fulfilled_entitlement")
        .filter(stripe_payment_intent_id=intent)
        .first()
    )


def revoke_for_refund(*, order, reason: str) -> str:
    """Spec §23.4's first three bullets, in order.

    Returns one of "revoked", "released_and_revoked", "staff_review" or
    "nothing_to_revoke" — the value lands in the `payment_order.refunded`
    audit row's metadata, so a released-then-revoked right is distinguishable
    from a plain one months later.
    """
    # Lazy, deliberately: see the module note. `entitlements.services` is a
    # Phase 13 module and this module is imported at app-ready time.
    from entitlements.services import (
        InvalidEntitlementState,
        release_reservation,
        revoke_entitlement,
    )

    # Spec §2.4 and this plan's Global Constraints: a webhook has no user
    # actor, so the audit row must say STRIPE/WEBHOOK, not USER/ADMIN. Phase 13
    # must expose these two overrides — see the reconciliation table.
    attribution = {
        "actor_type": AuditEvent.ActorType.STRIPE,
        "source": AuditEvent.Source.WEBHOOK,
    }

    rights = list(order.granted_entitlements.all()) or (
        [order.fulfilled_entitlement] if order.fulfilled_entitlement else []
    )
    outcomes = [
        _revoke_one(order=order, right=right, reason=reason, attribution=attribution,
                    release_reservation=release_reservation, revoke_entitlement=revoke_entitlement,
                    invalid=InvalidEntitlementState)
        for right in rights
    ]
    if not outcomes:
        return "nothing_to_revoke"
    for preferred in ("staff_review", "released_and_revoked", "revoked"):
        if preferred in outcomes:
            return preferred
    return "nothing_to_revoke"


def _revoke_one(*, order, right, reason, attribution, release_reservation, revoke_entitlement, invalid) -> str:
    if right.state == EntitlementState.CONSUMED:
        # Spec §23.4: "do not silently unpublish solely on a webhook".
        flag_for_staff(
            order,
            reason="refund_of_consumed_right",
            detail="A consumed right was refunded; apply commercial policy manually.",
        )
        return "staff_review"

    # A nested atomic around every entitlement transition, and
    # InvalidEntitlementState caught here rather than allowed to escape. It is a
    # DRF APIException: escaping the webhook would render a 409 ERROR ENVELOPE to
    # Stripe, which would then retry the event for days while the refund sat
    # unprocessed. The row moving under us is an operational fact a human
    # resolves, not a transient fault worth retrying.
    released = False
    try:
        with transaction.atomic():
            if right.state == EntitlementState.RESERVED:
                release_reservation(
                    entitlement=right, actor=None, reason=reason, **attribution
                )
                right.refresh_from_db()
                released = True

            if right.state == EntitlementState.AVAILABLE:
                revoke_entitlement(
                    entitlement=right, actor=None, reason=reason, **attribution
                )
                return "released_and_revoked" if released else "revoked"
    except invalid:
        flag_for_staff(
            order,
            reason="entitlement_state_conflict",
            detail="The right moved while the refund was being processed.",
        )
        return "staff_review"

    # EXPIRED or already REVOKED: nothing left to take back.
    return "nothing_to_revoke"


def handle_charge_refunded(event) -> str:
    payload = event["data"]["object"]
    order = _locked_order_for_intent(payload)
    if order is None:
        return order_not_found(payload, kind="charge")

    if not can_transition_payment(order.status, PaymentOrderStatus.REFUNDED):
        # Already REFUNDED (a repeated delivery), or never paid at all.
        return WebhookResult.IGNORED

    amount = payload.get("amount") or 0
    refunded = payload.get("amount_refunded") or 0
    before = {"status": order.status}

    if refunded < amount:
        # Spec §23.4 bullet 1 says "confirmed FULL refund"; a partial one is a
        # commercial decision, not an entitlement rule.
        flag_for_staff(
            order,
            reason="partial_refund",
            detail="A partial refund was issued; the entitlement was left intact.",
        )
        order.save(update_fields=["metadata", "updated_at"])
        record_payment_audit(
            order,
            "payment_order.refunded",
            before=before,
            after={"status": order.status},
            metadata={"partial": True},
        )
        return WebhookResult.REFUND_HANDLED

    outcome = revoke_for_refund(order=order, reason="Stripe refund")
    order.status = PaymentOrderStatus.REFUNDED
    order.save(update_fields=["status", "metadata", "updated_at"])
    record_payment_audit(
        order,
        "payment_order.refunded",
        before=before,
        after={"status": order.status},
        metadata={"outcome": outcome},
    )
    return WebhookResult.REFUND_HANDLED


def handle_dispute_created(event) -> str:
    """Spec §23.4 bullet 4: "Chargebacks/disputes create high-priority staff
    notification and audit event."

    Nothing is revoked: a dispute is a claim, not a completed refund. If it is
    settled by refunding, Stripe sends charge.refunded and the rule above runs.
    """
    payload = event["data"]["object"]
    order = _locked_order_for_intent(payload)
    if order is None:
        return order_not_found(payload, kind="charge")
    if not can_transition_payment(order.status, PaymentOrderStatus.DISPUTED):
        return WebhookResult.IGNORED

    before = {"status": order.status}
    order.status = PaymentOrderStatus.DISPUTED
    flag_for_staff(
        order,
        reason="dispute",
        detail="A chargeback was opened against this order.",
    )
    order.save(update_fields=["status", "metadata", "updated_at"])
    record_payment_audit(
        order,
        "payment_order.disputed",
        before=before,
        after={"status": order.status},
        # Stripe's dispute `reason` is a fixed enum ("fraudulent",
        # "product_not_received", ...), not free text and not personal data.
        metadata={"stripe_reason": payload.get("reason", "")},
    )
    return WebhookResult.DISPUTE_HANDLED


HANDLERS.update(
    {
        "charge.refunded": handle_charge_refunded,
        "charge.dispute.created": handle_dispute_created,
    }
)
