"""Fulfillment (spec §23.3 steps 4-9).

This module handles TRUSTED input — every event reaching it has already had its
signature verified and its id deduplicated by payments.webhooks — and it holds
all the business rules the webhook layer deliberately has none of.

The one invariant everything here serves: spec §6.4's "FULFILLED means an
entitlement was created exactly once. Repeated webhook delivery must return
success without creating a second entitlement."
"""

from datetime import timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone

from audit.models import AuditEvent
from audit.services import record_audit_event
from entitlements.enums import EntitlementSource, EntitlementState
from entitlements.models import UserEntitlement

from .enums import (
    PRODUCT_ENTITLEMENT_TYPES,
    PaymentOrderStatus,
    WebhookResult,
    can_transition_payment,
)
from .models import PaymentOrder
from .products import minor_units
from .signals import payment_fulfilled, payment_needs_staff_review
from .webhooks import HANDLERS


def _session(event) -> dict:
    return event["data"]["object"]


def record_payment_audit(order, action, *, before, after, metadata=None):
    """Every webhook-driven audit row. A webhook has no user actor, so it uses
    the merged AuditEvent.ActorType.STRIPE / Source.WEBHOOK values.

    Public from the start (no leading underscore): payments.refunds imports it
    in Task 11, and importing a private name across modules is exactly what a
    reviewer should reject. Same for `flag_for_staff` and `order_not_found`.

    `metadata` carries only fields this module explicitly verified — never the
    session object, which can contain `customer_details` (spec §33.2).
    """
    record_audit_event(
        actor_user=None,
        actor_type=AuditEvent.ActorType.STRIPE,
        action=action,
        target_type="payments.PaymentOrder",
        target_id=str(order.pk),
        source=AuditEvent.Source.WEBHOOK,
        before=before,
        after=after,
        metadata=metadata or {},
    )


def flag_for_staff(order, *, reason: str, detail: str):
    """Spec §23.4: "mark payment case for staff review, notify staff".

    Mutates `order.metadata` in memory and queues the signal; the CALLER saves,
    so one UPDATE covers the status change and the flag together."""
    order.metadata = {
        **order.metadata,
        "staff_review_required": True,
        "staff_review_reason": reason,
    }
    transaction.on_commit(
        lambda: payment_needs_staff_review.send(
            sender=PaymentOrder, order=order, reason=reason, detail=detail
        )
    )


def verify_session_against_order(*, order, session) -> str:
    """Spec §23.3 step 5: "Verify expected user, product, amount, currency, mode
    and payment status."

    Returns "" when everything matches, else a short machine reason. The
    metadata compared here is Stripe's echo of what payments.checkout sent; a
    divergence means the event does not describe this order, and an event that
    does not describe this order must never grant anything to this user.
    """
    metadata = session.get("metadata") or {}

    if session.get("mode") != "payment":
        # Spec §23.1: both products are "One-time payment".
        return "mode_mismatch"
    if metadata.get("user_id") != str(order.user_id):
        return "user_mismatch"
    if metadata.get("product_code") != order.product.code:
        return "product_mismatch"
    if (session.get("currency") or "").upper() != order.currency.upper():
        return "currency_mismatch"

    amount_total = session.get("amount_total")
    if amount_total is None:
        return "amount_mismatch"
    if amount_total != minor_units(order.amount, order.currency):
        return "amount_mismatch"

    if (metadata.get("quantity") or "1") != str(order.quantity):
        return "quantity_mismatch"

    expected_listing = "" if order.listing_id is None else str(order.listing_id)
    if (metadata.get("listing_id") or "") != expected_listing:
        return "listing_mismatch"

    return ""


def grant_purchased_entitlements(*, order, now) -> list[UserEntitlement]:
    """One ledger row per unit the order paid for (quantity may exceed 1)."""
    return [
        grant_purchased_entitlement(order=order, now=now, grant_index=index)
        for index in range(order.quantity)
    ]


def grant_purchased_entitlement(*, order, now, grant_index=0) -> UserEntitlement:
    """Create the one right this order paid for.

    Creating a brand-new AVAILABLE row is NOT a state transition, which is why
    this does not go through `entitlements.services` (Phase 13 contract rule 1
    governs transitions). `grant_listing_right` is also the wrong tool: it
    hard-codes STAFF_GRANT, requires a `reason` and stamps `granted_by`, none of
    which describes a purchase. Every transition AWAY from this row — revocation
    on refund, Task 11 — does go through `entitlements.services`.

    The validity window comes from the PRODUCT's own `entitlement_valid_days`
    (spec §11.9, §23.1 "Staff may edit ... policy durations"), not from
    `individual.paid_entitlement_valid_days`; see the plan's ruling. `metadata`
    deliberately omits `publication_days`, which Phase 13 contract rule 5
    freezes at CONSUMPTION.

    This phase creates no RESERVED rows: the customer has already paid, so there
    is nothing to hold, and a reserved row would be reclaimable by Phase 13's
    30-minute sweep out from under the buyer.
    """
    product = order.product
    return UserEntitlement.objects.create(
        user=order.user,
        entitlement_type=PRODUCT_ENTITLEMENT_TYPES[product.code],
        source=EntitlementSource.STRIPE_PURCHASE,
        source_payment=order,
        listing=order.listing,
        state=EntitlementState.AVAILABLE,
        valid_from=now,
        valid_until=now + timedelta(days=product.entitlement_valid_days),
        metadata={"order_id": str(order.pk), "product_code": product.code},
        grant_index=grant_index,
    )


def fulfil_paid_session(*, order, session, now=None) -> str:
    """Spec §23.3 steps 5-8, inside the caller's transaction and lock."""
    now = now or timezone.now()

    if order.status == PaymentOrderStatus.FULFILLED:
        # Stripe can deliver two DIFFERENT event ids describing one session.
        return WebhookResult.ALREADY_FULFILLED
    if not can_transition_payment(order.status, PaymentOrderStatus.PAID):
        # FAILED, EXPIRED, REFUNDED and DISPUTED all land here: a late paid
        # event must never resurrect them (spec §6.4). It must not be dropped
        # in SILENCE either — if Stripe says this session was paid and our
        # ledger says the order is dead, money moved and nothing was granted,
        # which is precisely the paid-not-fulfilled condition spec §35.4 tells
        # operators to hunt for. Nobody would be looking.
        if session.get("payment_status") == "paid":
            flag_for_staff(
                order,
                reason="paid_event_on_terminal_order",
                detail=(
                    "Stripe reported a paid session for an order already in "
                    f"state {order.status}."
                ),
            )
            order.save(update_fields=["metadata", "updated_at"])
            record_payment_audit(
                order,
                "payment_order.mismatch",
                before={"status": order.status},
                after={"status": order.status},
                metadata={"reason": "paid_event_on_terminal_order"},
            )
        return WebhookResult.IGNORED
    if session.get("payment_status") != "paid":
        # A session can be `complete` with `payment_status: "unpaid"` for
        # delayed payment methods; async_payment_succeeded is what fulfils it.
        return WebhookResult.IGNORED

    reason = verify_session_against_order(order=order, session=session)
    if reason:
        before = {"status": order.status}
        order.status = PaymentOrderStatus.FAILED
        flag_for_staff(
            order, reason=reason, detail="Stripe session did not match the order."
        )
        order.save(update_fields=["status", "metadata", "updated_at"])
        record_payment_audit(
            order,
            "payment_order.mismatch",
            before=before,
            after={"status": order.status},
            metadata={"reason": reason},
        )
        return WebhookResult.MISMATCH

    before = {"status": order.status}
    order.status = PaymentOrderStatus.PAID
    order.paid_at = now
    payment_intent = session.get("payment_intent") or ""
    order.stripe_payment_intent_id = (
        payment_intent if isinstance(payment_intent, str) else payment_intent.get("id", "")
    )
    order.save(
        update_fields=["status", "paid_at", "stripe_payment_intent_id", "updated_at"]
    )
    record_payment_audit(
        order, "payment_order.paid", before=before, after={"status": order.status}
    )

    # A NESTED atomic, so an IntegrityError here neither poisons the webhook's
    # outer transaction nor escapes as a 500 that Stripe would retry for days.
    # What can collide: two media-upgrade orders for one listing racing past
    # payments.checkout's Python check and both reaching Phase 13's merged
    # partial unique index `entitlements_one_live_right_per_listing_and_type`,
    # or (after Task 4) `entitlements_one_live_right_per_payment`. Money HAS
    # moved, so the order stays PAID rather than moving to FAILED — PAID ->
    # FAILED is not a legal edge in spec §6.4 and would be a lie about the
    # ledger — and a human resolves it. 200 is deliberate: no retry can make
    # the collision go away.
    try:
        with transaction.atomic():
            entitlement = grant_purchased_entitlements(order=order, now=now)[0]
    except IntegrityError:
        flag_for_staff(
            order,
            reason="grant_conflict",
            detail="Payment succeeded but the entitlement could not be created.",
        )
        order.save(update_fields=["metadata", "updated_at"])
        record_payment_audit(
            order,
            "payment_order.mismatch",
            before={"status": order.status},
            after={"status": order.status},
            metadata={"reason": "grant_conflict"},
        )
        return WebhookResult.GRANT_CONFLICT

    order.status = PaymentOrderStatus.FULFILLED
    order.fulfilled_at = now
    order.fulfilled_entitlement = entitlement
    order.save(
        update_fields=["status", "fulfilled_at", "fulfilled_entitlement", "updated_at"]
    )
    record_payment_audit(
        order,
        "payment_order.fulfilled",
        before={"status": PaymentOrderStatus.PAID},
        after={"status": order.status, "entitlement_id": str(entitlement.pk)},
    )

    # Spec §23.3 step 9: "After commit, notify user and refresh WebSocket
    # eligibility state." Receivers are Phase 18's.
    transaction.on_commit(
        lambda: payment_fulfilled.send(
            sender=PaymentOrder, order=order, entitlement=entitlement
        )
    )
    return WebhookResult.FULFILLED


def _locked_order_for(session):
    """Spec §23.3 step 4: "lock PaymentOrder".

    Resolved by the session id WE recorded when we opened the session, not by
    Stripe's echoed metadata: the local column is the fact this system owns.
    """
    return (
        PaymentOrder.objects.select_for_update(of=("self",))
        .select_related("product", "listing")
        .filter(stripe_checkout_session_id=session.get("id", ""))
        .first()
    )


def order_not_found(payload, *, kind: str = "checkout session") -> str:
    """A signature-verified event whose subject we have never heard of.

    Answers 200 with an alert rather than 500: no retry can make an unknown
    session known, and a retry storm would bury the signal. Causes worth staff
    attention: a second environment sharing the webhook secret, or an order lost
    between creation and session recording.

    `kind` exists because Task 11's callers pass a **charge**, whose id is a
    `ch_...`, not a `cs_...`; the alert text and the reason string would
    otherwise be wrong for half the callers.
    """
    identifier = payload.get("id", "")
    transaction.on_commit(
        lambda: payment_needs_staff_review.send(
            sender=PaymentOrder,
            order=None,
            reason=f"unknown_{kind.replace(' ', '_')}",
            detail=f"No local order for {kind} {identifier!r}.",
        )
    )
    return WebhookResult.ORDER_NOT_FOUND


def handle_checkout_session_paid(event) -> str:
    session = _session(event)
    order = _locked_order_for(session)
    if order is None:
        return order_not_found(session)
    return fulfil_paid_session(order=order, session=session)


def handle_checkout_session_failed(event) -> str:
    session = _session(event)
    order = _locked_order_for(session)
    if order is None:
        return order_not_found(session)
    if not can_transition_payment(order.status, PaymentOrderStatus.FAILED):
        return WebhookResult.IGNORED
    before = {"status": order.status}
    order.status = PaymentOrderStatus.FAILED
    order.save(update_fields=["status", "updated_at"])
    record_payment_audit(
        order, "payment_order.failed", before=before, after={"status": order.status}
    )
    return WebhookResult.IGNORED


def handle_checkout_session_expired(event) -> str:
    session = _session(event)
    order = _locked_order_for(session)
    if order is None:
        return order_not_found(session)
    if not can_transition_payment(order.status, PaymentOrderStatus.EXPIRED):
        # An expiry arriving after completion must not undo a grant
        # (spec §35.3).
        return WebhookResult.IGNORED
    before = {"status": order.status}
    order.status = PaymentOrderStatus.EXPIRED
    order.save(update_fields=["status", "updated_at"])
    record_payment_audit(
        order, "payment_order.expired", before=before, after={"status": order.status}
    )
    return WebhookResult.EXPIRED


HANDLERS.update(
    {
        "checkout.session.completed": handle_checkout_session_paid,
        "checkout.session.async_payment_succeeded": handle_checkout_session_paid,
        "checkout.session.async_payment_failed": handle_checkout_session_failed,
        "checkout.session.expired": handle_checkout_session_expired,
    }
)
