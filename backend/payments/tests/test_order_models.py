"""Spec §11.9's PaymentOrder and ProcessedWebhookEvent, and the integrity rules
the webhook relies on instead of re-checking them in Python."""

from decimal import Decimal

import pytest
from django.db import IntegrityError, transaction
from django.utils import timezone

from entitlements.enums import EntitlementType
from entitlements.tests.factories import make_entitlement
from payments.enums import PaymentOrderStatus, WebhookResult
from payments.models import PaymentOrder, ProcessedWebhookEvent
from payments.tests.factories import (
    listing_right_product,
    make_order,
    make_payments_seller,
)


@pytest.fixture
def seller(db):
    return make_payments_seller()


@pytest.fixture
def product(db):
    return listing_right_product()


@pytest.mark.django_db
def test_every_spec_11_9_order_field_exists_with_the_spec_name():
    names = {field.name for field in PaymentOrder._meta.get_fields()}
    assert {
        "id",
        "user",
        "product",
        "status",
        "stripe_checkout_session_id",
        "stripe_payment_intent_id",
        "amount",
        "currency",
        "idempotency_key",
        "fulfilled_entitlement",
        "created_at",
        "paid_at",
        "fulfilled_at",
        "updated_at",
        # Beyond spec §11.9's list, justified in the plan's rulings.
        "listing",
        "client_idempotency_key",
        "metadata",
    } <= names


@pytest.mark.django_db
def test_no_card_data_field_exists_on_the_order():
    """Spec §23.1: nothing in this system holds card data."""
    forbidden = {"last4", "card_number", "pan", "cvc", "cvv", "exp_month",
                 "exp_year", "cardholder_name", "card_brand", "receipt_body"}
    names = {field.name for field in PaymentOrder._meta.get_fields()}
    assert forbidden & names == set()


@pytest.mark.django_db
def test_every_spec_11_9_webhook_event_field_exists_with_the_spec_name():
    names = {field.name for field in ProcessedWebhookEvent._meta.get_fields()}
    assert {
        "id",
        "stripe_event_id",
        "event_type",
        "payload_checksum",
        "processed_at",
        "result",
    } <= names
    # Append-only: an updated_at would imply the row may legitimately change.
    assert "updated_at" not in names


@pytest.mark.django_db
def test_a_duplicate_stripe_event_id_is_refused_by_the_database():
    """This index is spec §23.3 step 3 — "duplicate event ID returns HTTP 200
    without re-fulfillment" — and it is the last line of defence behind the
    webhook's own check."""
    ProcessedWebhookEvent.objects.create(
        stripe_event_id="evt_dup",
        event_type="checkout.session.completed",
        payload_checksum="a" * 64,
        result=WebhookResult.FULFILLED,
    )

    with pytest.raises(IntegrityError), transaction.atomic():
        ProcessedWebhookEvent.objects.create(
            stripe_event_id="evt_dup",
            event_type="checkout.session.completed",
            payload_checksum="b" * 64,
            result=WebhookResult.IGNORED,
        )


@pytest.mark.django_db
def test_a_zero_amount_order_is_refused_by_the_database(seller, product):
    with pytest.raises(IntegrityError), transaction.atomic():
        make_order(user=seller, product=product, amount=Decimal("0.00"))


@pytest.mark.django_db
def test_a_lowercase_currency_order_is_refused_by_the_database(seller, product):
    with pytest.raises(IntegrityError), transaction.atomic():
        make_order(user=seller, product=product, currency="eur")


@pytest.mark.django_db
@pytest.mark.parametrize(
    "status",
    [
        PaymentOrderStatus.PAID,
        PaymentOrderStatus.FULFILLED,
        PaymentOrderStatus.REFUNDED,
        PaymentOrderStatus.DISPUTED,
    ],
)
def test_a_paid_status_without_paid_at_is_refused_by_the_database(
    seller, product, status
):
    """Spec §6.4: "PAID means Stripe has confirmed payment." A row claiming that
    without a timestamp is an unreconcilable ledger entry."""
    with pytest.raises(IntegrityError), transaction.atomic():
        make_order(user=seller, product=product, status=status, paid_at=None)


@pytest.mark.django_db
@pytest.mark.parametrize("status", [PaymentOrderStatus.CREATED,
                                    PaymentOrderStatus.CHECKOUT_OPEN,
                                    PaymentOrderStatus.FAILED,
                                    PaymentOrderStatus.EXPIRED])
def test_an_unpaid_status_may_have_no_paid_at(seller, product, status):
    """The positive half: a constraint refusing EVERY row would still pass the
    negative cases above."""
    order = make_order(user=seller, product=product, status=status, paid_at=None)
    assert order.paid_at is None


@pytest.mark.django_db
def test_fulfilled_without_an_entitlement_is_refused_by_the_database(seller, product):
    """Spec §6.4: "FULFILLED means an entitlement was created exactly once."
    A FULFILLED row with no entitlement is that sentence being false."""
    with pytest.raises(IntegrityError), transaction.atomic():
        make_order(
            user=seller,
            product=product,
            status=PaymentOrderStatus.FULFILLED,
            fulfilled_entitlement=None,
        )


@pytest.mark.django_db
def test_fulfilled_without_a_fulfilled_at_is_refused_by_the_database(seller, product):
    right = make_entitlement(user=seller, entitlement_type=EntitlementType.PAID_LISTING)
    with pytest.raises(IntegrityError), transaction.atomic():
        make_order(
            user=seller,
            product=product,
            status=PaymentOrderStatus.FULFILLED,
            fulfilled_entitlement=right,
            fulfilled_at=None,
            paid_at=timezone.now(),
        )


@pytest.mark.django_db
def test_a_complete_fulfilled_order_is_accepted(seller, product):
    right = make_entitlement(user=seller, entitlement_type=EntitlementType.PAID_LISTING)

    order = make_order(
        user=seller,
        product=product,
        status=PaymentOrderStatus.FULFILLED,
        fulfilled_entitlement=right,
    )

    assert order.fulfilled_at is not None
    assert PaymentOrder.objects.fulfilled().count() == 1


@pytest.mark.django_db
def test_two_orders_cannot_share_one_checkout_session(seller, product):
    make_order(user=seller, product=product, stripe_checkout_session_id="cs_one")

    with pytest.raises(IntegrityError), transaction.atomic():
        make_order(user=seller, product=product, stripe_checkout_session_id="cs_one")


@pytest.mark.django_db
def test_many_orders_may_share_the_empty_checkout_session(seller, product):
    """The partial index must key on non-blank values only: every order is
    created BEFORE its Stripe session exists (spec §23.2), so blank is the
    normal state and a naive unique index would allow exactly one order to exist
    at a time in the whole system."""
    make_order(user=seller, product=product, stripe_checkout_session_id="")
    make_order(user=seller, product=product, stripe_checkout_session_id="")

    assert PaymentOrder.objects.filter(stripe_checkout_session_id="").count() == 2


@pytest.mark.django_db
def test_two_orders_cannot_share_one_payment_intent(seller, product):
    make_order(user=seller, product=product, stripe_payment_intent_id="pi_one")

    with pytest.raises(IntegrityError), transaction.atomic():
        make_order(user=seller, product=product, stripe_payment_intent_id="pi_one")


@pytest.mark.django_db
def test_two_orders_cannot_share_one_stripe_idempotency_key(seller, product):
    order = make_order(user=seller, product=product)

    with pytest.raises(IntegrityError), transaction.atomic():
        make_order(user=seller, product=product, idempotency_key=order.idempotency_key)


@pytest.mark.django_db
def test_one_user_cannot_reuse_a_client_idempotency_key(seller, product):
    """Spec §30.3's replay store. The key is scoped to the user, not global."""
    make_order(user=seller, product=product, client_idempotency_key="idem-1")

    with pytest.raises(IntegrityError), transaction.atomic():
        make_order(user=seller, product=product, client_idempotency_key="idem-1")


@pytest.mark.django_db
def test_two_different_users_may_use_the_same_client_idempotency_key(product):
    """The cross-target negative: scoping the index to the user is what stops
    one customer's chosen key from denying service to another's."""
    first = make_payments_seller("p14-idem-a@example.com")
    second = make_payments_seller("p14-idem-b@example.com")

    make_order(user=first, product=product, client_idempotency_key="idem-1")
    make_order(user=second, product=product, client_idempotency_key="idem-1")

    assert PaymentOrder.objects.filter(client_idempotency_key="idem-1").count() == 2


@pytest.mark.django_db
def test_one_user_may_have_many_orders_with_no_client_idempotency_key(product):
    seller = make_payments_seller("p14-idem-c@example.com")
    make_order(user=seller, product=product, client_idempotency_key="")
    make_order(user=seller, product=product, client_idempotency_key="")

    assert PaymentOrder.objects.for_user(seller).count() == 2


@pytest.mark.django_db
def test_a_fulfilled_entitlement_cannot_be_hard_deleted(seller, product):
    """Spec §35.3: "Do not roll back a fulfilled Stripe entitlement by deleting
    it; preserve ledger and reconcile." PROTECT is that sentence in the
    schema."""
    right = make_entitlement(user=seller, entitlement_type=EntitlementType.PAID_LISTING)
    make_order(
        user=seller,
        product=product,
        status=PaymentOrderStatus.FULFILLED,
        fulfilled_entitlement=right,
    )

    from django.db.models import ProtectedError

    with pytest.raises(ProtectedError), transaction.atomic():
        right.delete()


@pytest.mark.django_db
def test_a_purchased_product_cannot_be_hard_deleted(seller, product):
    from django.db.models import ProtectedError

    make_order(user=seller, product=product)

    with pytest.raises(ProtectedError), transaction.atomic():
        product.delete()


@pytest.mark.django_db
def test_needing_staff_review_selects_only_flagged_orders(seller, product):
    make_order(user=seller, product=product)
    flagged = make_order(
        user=seller,
        product=product,
        status=PaymentOrderStatus.REFUNDED,
        metadata={"staff_review_required": True, "staff_review_reason": "consumed"},
    )

    assert list(PaymentOrder.objects.needing_staff_review()) == [flagged]
