"""Spec §23.4's four rules, one test per bullet."""

from decimal import Decimal

import pytest

from audit.models import AuditEvent
from entitlements.enums import EntitlementState, EntitlementType
from entitlements.models import UserEntitlement
from listings.enums import ListingStatus
from listings.tests.factories import make_private_listing
from payments.enums import PaymentOrderStatus, WebhookResult
from payments.refunds import handle_charge_refunded, handle_dispute_created
from payments.signals import payment_needs_staff_review
from payments.tests.factories import (
    listing_right_product,
    make_order,
    make_payments_seller,
)


@pytest.fixture
def seller(db):
    return make_payments_seller()


@pytest.fixture
def captured_review():
    """`weak=False` for the same reason as in test_fulfillment.py: a receiver
    with no strong reference outside this fixture can be garbage-collected
    mid-test, leaving a silently empty list."""
    received = []

    def on_review(sender, order, reason, detail, **kwargs):
        received.append(reason)

    payment_needs_staff_review.connect(on_review, weak=False)
    yield received
    payment_needs_staff_review.disconnect(on_review)


@pytest.fixture
def deliver(django_capture_on_commit_callbacks):
    """Run a handler so its `transaction.on_commit` callbacks actually fire.

    Identical to test_fulfillment.py's fixture and required for the same
    reason: pytest-django rolls each test's transaction back, so an unwrapped
    call would make every `captured_review` assertion below vacuous.
    """

    def _call(handler, event):
        with django_capture_on_commit_callbacks(execute=True):
            return handler(event)

    return _call


def fulfilled_order(seller, *, state=EntitlementState.AVAILABLE, listing=None):
    from datetime import timedelta

    from django.utils import timezone

    from entitlements.enums import EntitlementSource

    order = make_order(
        user=seller,
        product=listing_right_product(),
        status=PaymentOrderStatus.PAID,
        amount=Decimal("49.00"),
        stripe_payment_intent_id="pi_refund_1",
    )
    now = timezone.now()
    right = UserEntitlement.objects.create(
        user=seller,
        entitlement_type=EntitlementType.PAID_LISTING,
        source=EntitlementSource.STRIPE_PURCHASE,
        source_payment=order,
        listing=listing,
        state=state,
        valid_from=now,
        valid_until=now + timedelta(days=365),
        reserved_at=now if state == EntitlementState.RESERVED else None,
        consumed_at=now if state == EntitlementState.CONSUMED else None,
    )
    order.status = PaymentOrderStatus.FULFILLED
    order.fulfilled_at = now
    order.fulfilled_entitlement = right
    order.save()
    return order, right


def refund_event(order, *, amount_refunded=4900, amount=4900, event_id="evt_refund"):
    return {
        "id": event_id,
        "type": "charge.refunded",
        "data": {
            "object": {
                "id": "ch_1",
                "payment_intent": order.stripe_payment_intent_id,
                "amount": amount,
                "amount_refunded": amount_refunded,
                "refunded": amount_refunded >= amount,
            }
        },
    }


def dispute_event(order, event_id="evt_dispute"):
    return {
        "id": event_id,
        "type": "charge.dispute.created",
        "data": {
            "object": {
                "id": "dp_1",
                "payment_intent": order.stripe_payment_intent_id,
                "amount": 4900,
                "reason": "fraudulent",
            }
        },
    }


@pytest.mark.django_db
def test_refund_and_dispute_handlers_are_registered():
    from payments.webhooks import HANDLERS

    assert {"charge.refunded", "charge.dispute.created"} <= set(HANDLERS)


@pytest.mark.django_db
def test_an_unused_right_is_revoked_on_a_full_refund(seller, captured_review, deliver):
    """Spec §23.4 bullet 1: "Unused entitlement: revoke on confirmed full
    refund"."""
    order, right = fulfilled_order(seller)

    result = deliver(handle_charge_refunded, refund_event(order))

    assert result == WebhookResult.REFUND_HANDLED
    order.refresh_from_db()
    right.refresh_from_db()
    assert order.status == PaymentOrderStatus.REFUNDED
    assert right.state == EntitlementState.REVOKED
    assert right.revoked_at is not None
    refund_audit = AuditEvent.objects.get(action="payment_order.refunded")
    # No release happened, so the outcome must say so. "released_and_revoked"
    # here would be a false record in an immutable audit row.
    assert refund_audit.metadata["outcome"] == "revoked"
    # Spec §2.4: a machine-driven change must not be attributed to a human.
    entitlement_audit = AuditEvent.objects.get(action="entitlement.revoked")
    assert entitlement_audit.actor_user_id is None
    assert entitlement_audit.actor_type == AuditEvent.ActorType.STRIPE
    assert entitlement_audit.source == AuditEvent.Source.WEBHOOK
    # A clean revocation is NOT a staff case: spec §23.4 only escalates the
    # consumed, partial and conflict paths. An alert here would train staff to
    # ignore the queue.
    assert captured_review == []


@pytest.mark.django_db
def test_a_reserved_right_is_released_then_revoked(seller, deliver):
    """Spec §23.4 bullet 2: "Reserved entitlement: release reservation, then
    revoke"."""
    order, right = fulfilled_order(seller, state=EntitlementState.RESERVED)

    deliver(handle_charge_refunded, refund_event(order))

    right.refresh_from_db()
    assert right.state == EntitlementState.REVOKED
    assert (
        AuditEvent.objects.get(action="payment_order.refunded").metadata["outcome"]
        == "released_and_revoked"
    )


@pytest.mark.django_db
def test_an_entitlement_state_conflict_becomes_a_staff_case_not_a_500(
    seller, captured_review, deliver, monkeypatch
):
    """`InvalidEntitlementState` is a DRF APIException.

    If it escaped the handler, DRF would render a **409 error envelope to
    Stripe**, which would then retry the event for three days while the refund
    sat unprocessed — and every retry would roll the dedup row back. A row
    moving under us is an operational fact for a human, not a transient fault
    worth retrying.
    """
    import entitlements.services as services

    order, right = fulfilled_order(seller)

    def _moved(**kwargs):
        raise services.InvalidEntitlementState(current_state="REVOKED")

    monkeypatch.setattr(services, "revoke_entitlement", _moved)

    result = deliver(handle_charge_refunded, refund_event(order))

    assert result == WebhookResult.REFUND_HANDLED
    order.refresh_from_db()
    assert order.status == PaymentOrderStatus.REFUNDED
    assert order.metadata["staff_review_required"] is True
    assert order.metadata["staff_review_reason"] == "entitlement_state_conflict"
    assert "entitlement_state_conflict" in captured_review
    assert (
        AuditEvent.objects.get(action="payment_order.refunded").metadata["outcome"]
        == "staff_review"
    )


@pytest.mark.django_db
def test_a_consumed_right_is_never_silently_revoked_or_unpublished(
    seller, captured_review, deliver
):
    """Spec §23.4 bullet 3, the most important rule in this task: "do not
    silently unpublish solely on a webhook; mark payment case for staff review,
    notify staff and apply documented commercial policy"."""
    listing = make_private_listing(owner=seller, status=ListingStatus.PUBLISHED)
    order, right = fulfilled_order(
        seller, state=EntitlementState.CONSUMED, listing=listing
    )

    result = deliver(handle_charge_refunded, refund_event(order))

    assert result == WebhookResult.REFUND_HANDLED
    right.refresh_from_db()
    listing.refresh_from_db()
    assert right.state == EntitlementState.CONSUMED       # untouched
    assert listing.status == ListingStatus.PUBLISHED       # untouched
    order.refresh_from_db()
    assert order.status == PaymentOrderStatus.REFUNDED
    assert order.metadata["staff_review_required"] is True
    assert "refund_of_consumed_right" in captured_review


@pytest.mark.django_db
def test_a_partial_refund_revokes_nothing_and_asks_for_staff(
    seller, captured_review, deliver
):
    """Spec §23.4 bullet 1 says "confirmed FULL refund". A partial refund is a
    commercial decision, not an entitlement rule."""
    order, right = fulfilled_order(seller)

    deliver(handle_charge_refunded, refund_event(order, amount_refunded=1000))

    right.refresh_from_db()
    assert right.state == EntitlementState.AVAILABLE
    order.refresh_from_db()
    assert order.metadata["staff_review_required"] is True
    assert "partial_refund" in captured_review


@pytest.mark.django_db
def test_a_repeated_refund_event_is_idempotent(seller):
    order, right = fulfilled_order(seller)

    first = handle_charge_refunded(refund_event(order))
    second = handle_charge_refunded(refund_event(order, event_id="evt_refund_2"))

    assert first == WebhookResult.REFUND_HANDLED
    assert second == WebhookResult.IGNORED
    right.refresh_from_db()
    assert right.state == EntitlementState.REVOKED
    assert AuditEvent.objects.filter(action="payment_order.refunded").count() == 1


@pytest.mark.django_db
def test_a_dispute_creates_a_high_priority_staff_case(
    seller, captured_review, deliver
):
    """Spec §23.4 bullet 4: "Chargebacks/disputes create high-priority staff
    notification and audit event." A dispute is not a refund: the money has not
    moved back yet, so nothing is revoked here."""
    order, right = fulfilled_order(seller)

    result = deliver(handle_dispute_created, dispute_event(order))

    assert result == WebhookResult.DISPUTE_HANDLED
    order.refresh_from_db()
    right.refresh_from_db()
    assert order.status == PaymentOrderStatus.DISPUTED
    assert order.metadata["staff_review_required"] is True
    assert right.state == EntitlementState.AVAILABLE
    assert "dispute" in captured_review
    assert AuditEvent.objects.filter(action="payment_order.disputed").count() == 1


@pytest.mark.django_db
def test_a_refund_for_an_unknown_payment_intent_alerts_rather_than_crashing(
    seller, captured_review, deliver
):
    order, _ = fulfilled_order(seller)
    event = refund_event(order)
    event["data"]["object"]["payment_intent"] = "pi_never_seen"

    result = deliver(handle_charge_refunded, event)

    assert result == WebhookResult.ORDER_NOT_FOUND
    assert captured_review == ["unknown_charge"]


@pytest.mark.django_db
def test_a_refund_never_touches_another_users_entitlement(seller):
    """IDOR at the webhook layer: revocation is reached only through
    `order.fulfilled_entitlement`, never through a payload-supplied id."""
    other = make_payments_seller("p14-refund-other@example.com")
    order, right = fulfilled_order(seller)
    from datetime import timedelta

    from django.utils import timezone

    from entitlements.enums import EntitlementSource

    bystander = UserEntitlement.objects.create(
        user=other,
        entitlement_type=EntitlementType.PAID_LISTING,
        source=EntitlementSource.STRIPE_PURCHASE,
        state=EntitlementState.AVAILABLE,
        valid_from=timezone.now(),
        valid_until=timezone.now() + timedelta(days=365),
    )
    event = refund_event(order)
    event["data"]["object"]["entitlement_id"] = str(bystander.pk)

    handle_charge_refunded(event)

    bystander.refresh_from_db()
    assert bystander.state == EntitlementState.AVAILABLE
