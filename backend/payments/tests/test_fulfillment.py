"""Spec §23.3 steps 4-9 and §40 Scenario H."""

from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from audit.models import AuditEvent
from entitlements.enums import EntitlementSource, EntitlementState, EntitlementType
from entitlements.models import UserEntitlement
from entitlements.tests.factories import make_entitlement
from listings.tests.factories import make_private_listing
from payments.enums import PaymentOrderStatus, ProductCode, WebhookResult
from payments.fulfillment import (
    handle_checkout_session_expired,
    handle_checkout_session_failed,
    handle_checkout_session_paid,
    verify_session_against_order,
)
from payments.models import PaymentOrder
from payments.signals import payment_fulfilled, payment_needs_staff_review
from payments.tests.factories import (
    listing_right_product,
    make_order,
    make_payments_seller,
    media_upgrade_product,
)
from payments.webhooks import HANDLERS


@pytest.fixture
def seller(db):
    return make_payments_seller()


@pytest.fixture
def order(seller):
    return make_order(
        user=seller,
        product=listing_right_product(),
        status=PaymentOrderStatus.CHECKOUT_OPEN,
        amount=Decimal("49.00"),
        currency="EUR",
        stripe_checkout_session_id="cs_live_1",
    )


def session_for(order, **overrides):
    payload = {
        "id": order.stripe_checkout_session_id,
        "object": "checkout.session",
        "mode": "payment",
        "payment_status": "paid",
        "status": "complete",
        "amount_total": 4900,
        "currency": "eur",
        "payment_intent": "pi_" + order.stripe_checkout_session_id.removeprefix("cs_"),
        "client_reference_id": str(order.pk),
        "metadata": {
            "order_id": str(order.pk),
            "user_id": str(order.user_id),
            "product_code": order.product.code,
            "listing_id": "",
        },
    }
    payload.update(overrides)
    return payload


def event_for(order, event_type="checkout.session.completed", **overrides):
    return {
        "id": f"evt_{event_type}_{order.pk}",
        "type": event_type,
        "data": {"object": session_for(order, **overrides)},
    }


@pytest.fixture
def captured_signals():
    """Collect both payment signals for the duration of one test.

    `weak=False` is required: a receiver defined inside a fixture has no strong
    reference anywhere else, and Django's default weak connection would let it
    be garbage-collected mid-test, producing a silently empty list. The explicit
    disconnect in the teardown is what stops a receiver leaking into the next
    test in the session.
    """
    received = {"fulfilled": [], "review": []}

    def on_fulfilled(sender, order, entitlement, **kwargs):
        received["fulfilled"].append((order, entitlement))

    def on_review(sender, order, reason, detail, **kwargs):
        received["review"].append((order, reason))

    payment_fulfilled.connect(on_fulfilled, weak=False)
    payment_needs_staff_review.connect(on_review, weak=False)
    yield received
    payment_fulfilled.disconnect(on_fulfilled)
    payment_needs_staff_review.disconnect(on_review)


@pytest.fixture
def deliver(django_capture_on_commit_callbacks):
    """Call a handler so that its `transaction.on_commit` callbacks actually run.

    pytest-django wraps each `django_db` test in a transaction it rolls back, so
    a callback registered with `transaction.on_commit` NEVER fires on its own —
    a test asserting on one of this phase's signals without this wrapper passes
    vacuously today and would keep passing if the signal were deleted.
    `django_capture_on_commit_callbacks(execute=True)` is pytest-django's
    supported way to flush them.
    """

    def _call(handler, event):
        with django_capture_on_commit_callbacks(execute=True):
            return handler(event)

    return _call


@pytest.mark.django_db
def test_every_checkout_event_type_this_phase_handles_is_registered():
    assert set(HANDLERS) >= {
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
        "checkout.session.async_payment_failed",
        "checkout.session.expired",
    }


@pytest.mark.django_db
def test_a_paid_session_creates_exactly_one_entitlement(order, captured_signals):
    """Spec §23.3 steps 6-7 and §6.4's "FULFILLED means an entitlement was
    created exactly once"."""
    result = handle_checkout_session_paid(event_for(order))

    assert result == WebhookResult.FULFILLED
    order.refresh_from_db()
    assert order.status == PaymentOrderStatus.FULFILLED
    assert order.paid_at is not None
    assert order.fulfilled_at is not None
    assert order.stripe_payment_intent_id == "pi_live_1"

    right = UserEntitlement.objects.get()
    assert order.fulfilled_entitlement_id == right.pk
    assert right.user_id == order.user_id
    assert right.entitlement_type == EntitlementType.PAID_LISTING
    assert right.source == EntitlementSource.STRIPE_PURCHASE
    assert right.state == EntitlementState.AVAILABLE
    assert right.source_payment_id == order.pk
    assert right.listing_id is None
    assert right.metadata["order_id"] == str(order.pk)
    # Phase 13 contract rule 5: publication duration is frozen at CONSUMPTION,
    # not at purchase. This phase must not pre-empt that key.
    assert "publication_days" not in right.metadata


@pytest.mark.django_db
def test_the_validity_window_comes_from_the_products_own_duration(order):
    order.product.entitlement_valid_days = 180
    order.product.save(update_fields=["entitlement_valid_days"])

    handle_checkout_session_paid(event_for(order))

    right = UserEntitlement.objects.get()
    assert right.valid_until - right.valid_from == timedelta(days=180)


@pytest.mark.django_db
def test_a_duplicate_paid_event_does_not_create_a_second_entitlement(order):
    """Spec §40 Scenario H: "the verified paid event arrives twice ... one order
    becomes fulfilled and exactly one listing entitlement exists".

    This is the handler-level half; the delivery-level half (the same event id
    twice) is test_webhook_security.py's. Both must hold: Stripe can deliver two
    DIFFERENT event ids describing the same completed session.
    """
    handle_checkout_session_paid(event_for(order))
    second = handle_checkout_session_paid(
        {**event_for(order), "id": "evt_a_different_id"}
    )

    assert second == WebhookResult.ALREADY_FULFILLED
    assert UserEntitlement.objects.count() == 1
    assert PaymentOrder.objects.fulfilled().count() == 1


@pytest.mark.django_db
def test_a_session_whose_payment_is_still_unpaid_does_not_fulfil(order):
    """Spec §23.3 step 5 includes "payment status". A Checkout session can be
    `complete` with `payment_status: "unpaid"` for delayed payment methods; the
    later async_payment_succeeded event is what fulfils it."""
    result = handle_checkout_session_paid(event_for(order, payment_status="unpaid"))

    assert result == WebhookResult.IGNORED
    order.refresh_from_db()
    assert order.status == PaymentOrderStatus.CHECKOUT_OPEN
    assert UserEntitlement.objects.count() == 0


@pytest.mark.django_db
def test_an_async_payment_succeeded_event_fulfils(order):
    result = handle_checkout_session_paid(
        event_for(order, event_type="checkout.session.async_payment_succeeded")
    )

    assert result == WebhookResult.FULFILLED
    assert UserEntitlement.objects.count() == 1


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("overrides", "reason"),
    [
        ({"amount_total": 100}, "amount"),
        ({"amount_total": None}, "amount"),
        ({"currency": "usd"}, "currency"),
        ({"mode": "subscription"}, "mode"),
    ],
)
def test_a_mismatched_session_blocks_fulfilment_and_alerts_staff(
    order, captured_signals, deliver, overrides, reason
):
    """Spec §23's acceptance list: "Currency/amount mismatch blocks fulfillment
    and alerts staff"."""
    result = deliver(handle_checkout_session_paid, event_for(order, **overrides))

    assert result == WebhookResult.MISMATCH
    order.refresh_from_db()
    assert order.status == PaymentOrderStatus.FAILED
    assert order.metadata["staff_review_required"] is True
    assert UserEntitlement.objects.count() == 0
    assert AuditEvent.objects.filter(action="payment_order.mismatch").count() == 1
    assert [r for _, r in captured_signals["review"]] == [f"{reason}_mismatch"]
    assert (
        verify_session_against_order(order=order, session=session_for(order, **overrides))
        == f"{reason}_mismatch"
    )


@pytest.mark.django_db
def test_a_session_claiming_a_different_user_blocks_fulfilment(order):
    """Spec §23.3 step 5: "Verify expected user". The metadata is Stripe's echo
    of what we sent, so a divergence means the event does not describe this
    order and must never grant anything to this user."""
    hostile = session_for(order)
    hostile["metadata"] = {**hostile["metadata"], "user_id": "00000000-0000-4000-8000-000000000000"}

    result = handle_checkout_session_paid(
        {"id": "evt_user_mismatch", "type": "checkout.session.completed",
         "data": {"object": hostile}}
    )

    assert result == WebhookResult.MISMATCH
    assert UserEntitlement.objects.count() == 0


@pytest.mark.django_db
def test_a_session_claiming_a_different_product_blocks_fulfilment(order):
    hostile = session_for(order)
    hostile["metadata"] = {
        **hostile["metadata"],
        "product_code": ProductCode.LISTING_MEDIA_UPGRADE,
    }

    result = handle_checkout_session_paid(
        {"id": "evt_product_mismatch", "type": "checkout.session.completed",
         "data": {"object": hostile}}
    )

    assert result == WebhookResult.MISMATCH
    assert UserEntitlement.objects.count() == 0


@pytest.mark.django_db
def test_an_unknown_session_is_recorded_and_alerted_not_crashed(
    seller, captured_signals, deliver
):
    """A signature-verified event whose session we have never heard of is an
    operational anomaly (a second environment sharing the secret, a lost order).
    It must not 500 — Stripe would retry it for days."""
    fake_order = make_order(
        user=seller,
        product=listing_right_product(),
        status=PaymentOrderStatus.CHECKOUT_OPEN,
        stripe_checkout_session_id="cs_known",
    )
    event = event_for(fake_order)
    event["data"]["object"]["id"] = "cs_never_seen"

    result = deliver(handle_checkout_session_paid, event)

    assert result == WebhookResult.ORDER_NOT_FOUND
    assert UserEntitlement.objects.count() == 0
    assert [reason for _, reason in captured_signals["review"]] == [
        "unknown_checkout_session"
    ]


@pytest.mark.django_db
def test_a_late_paid_event_cannot_resurrect_a_failed_order(seller):
    """The out-of-order case spec §23.3 implies and §6.4 makes explicit: FAILED
    is terminal."""
    order = make_order(
        user=seller,
        product=listing_right_product(),
        status=PaymentOrderStatus.FAILED,
        stripe_checkout_session_id="cs_failed",
    )

    result = handle_checkout_session_paid(event_for(order))

    assert result == WebhookResult.IGNORED
    order.refresh_from_db()
    assert order.status == PaymentOrderStatus.FAILED
    assert UserEntitlement.objects.count() == 0


@pytest.mark.django_db
@pytest.mark.parametrize(
    "terminal",
    [
        PaymentOrderStatus.FAILED,
        PaymentOrderStatus.EXPIRED,
        PaymentOrderStatus.REFUNDED,
        PaymentOrderStatus.DISPUTED,
    ],
)
def test_a_paid_event_on_a_terminal_order_alerts_staff(
    seller, captured_signals, deliver, terminal
):
    """Refusing the transition is right; refusing it SILENTLY is not.

    Stripe says this session was paid and our ledger says the order is dead:
    money moved and nothing was granted, which is exactly the paid-not-fulfilled
    condition spec §35.4 tells operators to hunt for. Without this alert
    nobody would be looking.
    """
    right = make_entitlement(user=seller, entitlement_type=EntitlementType.PAID_LISTING)
    order = make_order(
        user=seller,
        product=listing_right_product(),
        status=terminal,
        stripe_checkout_session_id=f"cs_{terminal.lower()}",
        fulfilled_entitlement=right if terminal
        in {PaymentOrderStatus.REFUNDED, PaymentOrderStatus.DISPUTED}
        else None,
    )

    result = deliver(handle_checkout_session_paid, event_for(order))

    assert result == WebhookResult.IGNORED
    order.refresh_from_db()
    assert order.status == terminal
    assert order.metadata["staff_review_required"] is True
    assert order.metadata["staff_review_reason"] == "paid_event_on_terminal_order"
    assert [r for _, r in captured_signals["review"]] == [
        "paid_event_on_terminal_order"
    ]
    assert AuditEvent.objects.filter(action="payment_order.mismatch").count() == 1


@pytest.mark.django_db
def test_a_racing_second_upgrade_order_is_a_staff_case_not_a_500(
    seller, captured_signals, deliver
):
    """The escape hatch an uncaught exception would open.

    Two media-upgrade orders for one listing can both pass payments.checkout's
    Python check (it is a read, not a lock) and both reach fulfilment. The
    second hits Phase 13's merged partial unique index
    `entitlements_one_live_right_per_listing_and_type`. If that IntegrityError
    escaped, the webhook would answer 500, Stripe would retry the event for
    three days, and every retry would roll the dedup row back — a retry storm
    against a condition no retry can fix. It must be a staff case and a 200.
    """
    listing = make_private_listing(owner=seller)
    product = media_upgrade_product()
    first = make_order(
        user=seller, product=product, listing=listing, amount=Decimal("19.00"),
        status=PaymentOrderStatus.CHECKOUT_OPEN, stripe_checkout_session_id="cs_up_a",
    )
    second = make_order(
        user=seller, product=product, listing=listing, amount=Decimal("19.00"),
        status=PaymentOrderStatus.CHECKOUT_OPEN, stripe_checkout_session_id="cs_up_b",
    )
    for order_ in (first, second):
        event = event_for(order_, amount_total=1900)
        event["data"]["object"]["metadata"]["listing_id"] = str(listing.pk)
        result = deliver(handle_checkout_session_paid, event)

    assert result == WebhookResult.GRANT_CONFLICT
    second.refresh_from_db()
    # Money moved, so the order stays PAID. PAID -> FAILED is not a legal edge in
    # spec §6.4 and would be a lie about the ledger.
    assert second.status == PaymentOrderStatus.PAID
    assert second.fulfilled_entitlement_id is None
    assert second.metadata["staff_review_required"] is True
    assert second.metadata["staff_review_reason"] == "grant_conflict"
    assert [r for _, r in captured_signals["review"]] == ["grant_conflict"]
    # Exactly one upgrade exists, and the first order is intact.
    assert UserEntitlement.objects.filter(listing=listing).count() == 1
    first.refresh_from_db()
    assert first.status == PaymentOrderStatus.FULFILLED


@pytest.mark.django_db
def test_an_expired_session_expires_the_order(order):
    result = handle_checkout_session_expired(
        event_for(order, event_type="checkout.session.expired")
    )

    assert result == WebhookResult.EXPIRED
    order.refresh_from_db()
    assert order.status == PaymentOrderStatus.EXPIRED
    assert UserEntitlement.objects.count() == 0


@pytest.mark.django_db
def test_an_expired_event_for_an_already_fulfilled_order_changes_nothing(order):
    """Out-of-order delivery: expiry arriving after completion must not undo a
    grant. Spec §35.3: "Do not roll back a fulfilled Stripe entitlement"."""
    handle_checkout_session_paid(event_for(order))

    result = handle_checkout_session_expired(
        event_for(order, event_type="checkout.session.expired")
    )

    assert result == WebhookResult.IGNORED
    order.refresh_from_db()
    assert order.status == PaymentOrderStatus.FULFILLED
    assert UserEntitlement.objects.count() == 1


@pytest.mark.django_db
def test_an_async_payment_failure_fails_the_order(order):
    result = handle_checkout_session_failed(
        event_for(order, event_type="checkout.session.async_payment_failed")
    )

    assert result == WebhookResult.IGNORED
    order.refresh_from_db()
    assert order.status == PaymentOrderStatus.FAILED
    assert UserEntitlement.objects.count() == 0
    assert AuditEvent.objects.filter(action="payment_order.failed").count() == 1


@pytest.mark.django_db
def test_a_media_upgrade_binds_its_entitlement_to_the_listing(seller):
    """Spec §23.1: "Grants one upgrade bound to one eligible private-seller
    listing" and "Cannot be transferred after binding"."""
    listing = make_private_listing(owner=seller)
    product = media_upgrade_product()
    order = make_order(
        user=seller,
        product=product,
        listing=listing,
        status=PaymentOrderStatus.CHECKOUT_OPEN,
        amount=Decimal("19.00"),
        stripe_checkout_session_id="cs_upgrade",
    )
    event = event_for(order, amount_total=1900)
    event["data"]["object"]["metadata"]["listing_id"] = str(listing.pk)

    result = handle_checkout_session_paid(event)

    assert result == WebhookResult.FULFILLED
    right = UserEntitlement.objects.get()
    assert right.entitlement_type == EntitlementType.MEDIA_UPGRADE
    assert right.listing_id == listing.pk


@pytest.mark.django_db
def test_a_second_upgrade_for_one_listing_is_refused_by_the_database(seller):
    """Phase 13's merged partial unique index
    `entitlements_one_live_right_per_listing_and_type` is the real guarantee
    behind "cannot be transferred after binding" — it holds even if this
    module's Python checks were removed."""
    from django.db import IntegrityError, transaction

    listing = make_private_listing(owner=seller)
    product = media_upgrade_product()
    first = make_order(
        user=seller, product=product, listing=listing,
        status=PaymentOrderStatus.CHECKOUT_OPEN, amount=Decimal("19.00"),
        stripe_checkout_session_id="cs_up_1",
    )
    first_event = event_for(first, amount_total=1900)
    first_event["data"]["object"]["metadata"]["listing_id"] = str(listing.pk)
    assert handle_checkout_session_paid(first_event) == WebhookResult.FULFILLED

    with pytest.raises(IntegrityError), transaction.atomic():
        UserEntitlement.objects.create(
            user=seller,
            entitlement_type=EntitlementType.MEDIA_UPGRADE,
            source=EntitlementSource.STRIPE_PURCHASE,
            state=EntitlementState.AVAILABLE,
            listing=listing,
            valid_from=timezone.now(),
            valid_until=timezone.now() + timedelta(days=365),
        )


@pytest.mark.django_db
def test_a_listing_right_and_a_media_upgrade_may_coexist_on_one_listing(seller):
    """The cross-target negative: the index is keyed on (listing,
    entitlement_type), so it must NOT collapse two different right types."""
    listing = make_private_listing(owner=seller)

    UserEntitlement.objects.create(
        user=seller, entitlement_type=EntitlementType.PAID_LISTING,
        source=EntitlementSource.STRIPE_PURCHASE, state=EntitlementState.CONSUMED,
        listing=listing, valid_from=timezone.now(),
        valid_until=timezone.now() + timedelta(days=365),
        consumed_at=timezone.now(),
    )
    UserEntitlement.objects.create(
        user=seller, entitlement_type=EntitlementType.MEDIA_UPGRADE,
        source=EntitlementSource.STRIPE_PURCHASE, state=EntitlementState.AVAILABLE,
        listing=listing, valid_from=timezone.now(),
        valid_until=timezone.now() + timedelta(days=365),
    )

    assert UserEntitlement.objects.filter(listing=listing).count() == 2


@pytest.mark.django_db
def test_fulfilment_locks_the_order_row(order, django_assert_num_queries):
    """Spec §23.3 step 4: "lock PaymentOrder". Proven by inspecting the SQL, not
    by racing two threads — this project deliberately avoids threaded database
    tests (Phase 13 Known Limitation 12)."""
    from django.db import connection
    from django.test.utils import CaptureQueriesContext

    with CaptureQueriesContext(connection) as captured:
        handle_checkout_session_paid(event_for(order))

    assert any("FOR UPDATE" in q["sql"] for q in captured.captured_queries)


@pytest.mark.django_db
def test_fulfilment_writes_two_audit_events_from_stripe(order):
    """Spec §2.4. A webhook has no user actor, so both rows use the merged
    AuditEvent.ActorType.STRIPE / Source.WEBHOOK values."""
    handle_checkout_session_paid(event_for(order))

    events = AuditEvent.objects.filter(target_id=str(order.pk)).order_by("created_at")
    assert [e.action for e in events] == [
        "payment_order.paid",
        "payment_order.fulfilled",
    ]
    for event in events:
        assert event.actor_user_id is None
        assert event.actor_type == AuditEvent.ActorType.STRIPE
        assert event.source == AuditEvent.Source.WEBHOOK


@pytest.mark.django_db
def test_the_fulfilment_signal_fires_after_commit(
    order, captured_signals, deliver, django_capture_on_commit_callbacks
):
    """Spec §23.3 step 9: "AFTER commit, notify user".

    Two assertions, and the first is what makes the second non-vacuous: the
    signal must NOT have fired while the transaction was still open.
    """
    with django_capture_on_commit_callbacks(execute=False) as callbacks:
        handle_checkout_session_paid(event_for(order))
    assert captured_signals["fulfilled"] == []   # not sent inside the transaction
    assert callbacks                             # but queued for after it

    for callback in callbacks:
        callback()

    assert len(captured_signals["fulfilled"]) == 1
    fired_order, fired_right = captured_signals["fulfilled"][0]
    assert fired_order.pk == order.pk
    assert fired_right.pk == UserEntitlement.objects.get().pk


@pytest.mark.django_db
def test_no_stripe_payload_is_copied_wholesale_into_an_audit_event(order):
    """Spec §33.2's data minimization: audit metadata carries the few fields we
    verified, never the whole session object (which can grow customer details)."""
    event = event_for(order)
    event["data"]["object"]["customer_details"] = {
        "email": "leak@example.com",
        "name": "Leak Me",
        "address": {"line1": "1 Leak Street"},
    }

    handle_checkout_session_paid(event)

    dumped = "".join(
        str(e.metadata) + str(e.after) + str(e.before) for e in AuditEvent.objects.all()
    )
    assert "leak@example.com" not in dumped
    assert "Leak Street" not in dumped


@pytest.mark.django_db
def test_a_multi_unit_order_grants_one_right_per_unit(seller):
    order = make_order(
        user=seller,
        product=listing_right_product(),
        status=PaymentOrderStatus.CHECKOUT_OPEN,
        amount=Decimal("147.00"),
        currency="EUR",
        quantity=3,
        stripe_checkout_session_id="cs_live_3",
    )
    event = event_for(order, amount_total=14700)
    event["data"]["object"]["metadata"]["quantity"] = "3"

    assert handle_checkout_session_paid(event) == WebhookResult.FULFILLED

    rights = UserEntitlement.objects.filter(source_payment=order)
    assert rights.count() == 3
    assert sorted(rights.values_list("grant_index", flat=True)) == [0, 1, 2]
    # A replayed event grants nothing more.
    assert handle_checkout_session_paid(event) == WebhookResult.ALREADY_FULFILLED
    assert UserEntitlement.objects.filter(source_payment=order).count() == 3


@pytest.mark.django_db
def test_a_quantity_mismatch_blocks_fulfilment(seller):
    order = make_order(
        user=seller,
        product=listing_right_product(),
        status=PaymentOrderStatus.CHECKOUT_OPEN,
        amount=Decimal("98.00"),
        currency="EUR",
        quantity=2,
        stripe_checkout_session_id="cs_live_q",
    )
    assert verify_session_against_order(order=order, session=session_for(order, amount_total=9800)) == "quantity_mismatch"
