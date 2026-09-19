"""Spec §23's five acceptance tests and §40 Scenario H, end to end.

Each test below names the spec sentence it discharges. Nothing here is a unit
test of an internal helper: every one drives the real HTTP surface or the real
webhook entry point.
"""

import json
from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from common.tests.stripe_helpers import generate_stripe_signature
from entitlements.enums import EntitlementSource, EntitlementState, EntitlementType
from entitlements.models import UserEntitlement
from listings.tests.factories import make_private_listing
from payments.enums import PaymentOrderStatus, ProductCode
from payments.models import PaymentOrder, ProcessedWebhookEvent
from payments.tests.factories import (
    listing_right_product,
    make_payments_seller,
    media_upgrade_product,
)
from payments.tests.fakes import FakeStripeGateway

SECRET = "whsec_phase14_acceptance"
CHECKOUT_URL = "/api/v1/checkout-sessions/"
WEBHOOK_URL = "/api/v1/stripe/webhook/"


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def gateway(monkeypatch):
    fake = FakeStripeGateway()
    monkeypatch.setattr("payments.checkout.default_gateway", lambda: fake)
    monkeypatch.setattr("payments.products.default_gateway", lambda: fake)
    return fake


@pytest.fixture
def staff_alerts():
    """`weak=False` and an explicit disconnect: a lambda or a fixture-local
    receiver connected weakly can be garbage-collected mid-test (silently empty
    list), and a receiver left connected leaks stray alerts into every later
    test in the session."""
    from payments.signals import payment_needs_staff_review

    received = []

    def on_review(sender, order, reason, detail, **kwargs):
        received.append(reason)

    payment_needs_staff_review.connect(on_review, weak=False)
    yield received
    payment_needs_staff_review.disconnect(on_review)


def buy(api_client, seller, *, product_code=ProductCode.INDIVIDUAL_LISTING_RIGHT,
        listing_id=None, key="acc-1"):
    api_client.force_authenticate(user=seller)
    body = {"product_code": product_code}
    if listing_id is not None:
        body["listing_id"] = listing_id
    return api_client.post(CHECKOUT_URL, body, format="json", HTTP_IDEMPOTENCY_KEY=key)


def deliver(api_client, order, *, event_id, amount_total=4900, currency="eur",
            listing_id=""):
    payload = {
        "id": event_id,
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": order.stripe_checkout_session_id,
                "mode": "payment",
                "payment_status": "paid",
                "amount_total": amount_total,
                "currency": currency,
                "payment_intent": "pi_acceptance",
                "client_reference_id": str(order.pk),
                "metadata": {
                    "order_id": str(order.pk),
                    "user_id": str(order.user_id),
                    "product_code": order.product.code,
                    "listing_id": listing_id,
                },
            }
        },
    }
    raw = json.dumps(payload).encode()
    return api_client.post(
        WEBHOOK_URL,
        data=raw,
        content_type="application/json",
        HTTP_STRIPE_SIGNATURE=generate_stripe_signature(raw, SECRET),
    )


@pytest.mark.django_db
def test_scenario_h_a_duplicate_webhook_produces_exactly_one_entitlement(
    api_client, settings, checkout_enabled, gateway
):
    """Spec §40 Scenario H and §23's acceptance bullet 1: "Given the blocked
    individual completes Stripe Checkout, when the verified paid event arrives
    twice, then one order becomes fulfilled and exactly one listing entitlement
    exists"."""
    settings.STRIPE_WEBHOOK_SECRET = SECRET
    listing_right_product()
    seller = make_payments_seller("p14-acc-h@example.com")

    created = buy(api_client, seller)
    assert created.status_code == 201
    order = PaymentOrder.objects.get()

    first = deliver(api_client, order, event_id="evt_acc_h")
    second = deliver(api_client, order, event_id="evt_acc_h")

    assert (first.status_code, second.status_code) == (200, 200)
    order.refresh_from_db()
    assert order.status == PaymentOrderStatus.FULFILLED
    assert PaymentOrder.objects.fulfilled().count() == 1
    assert UserEntitlement.objects.count() == 1
    right = UserEntitlement.objects.get()
    assert right.entitlement_type == EntitlementType.PAID_LISTING
    assert right.source == EntitlementSource.STRIPE_PURCHASE
    assert right.state == EntitlementState.AVAILABLE
    assert right.source_payment_id == order.pk
    assert ProcessedWebhookEvent.objects.count() == 1


@pytest.mark.django_db
def test_two_distinct_events_for_one_session_also_produce_one_entitlement(
    api_client, settings, checkout_enabled, gateway
):
    """The other half of "exactly once": Stripe can deliver two DIFFERENT event
    ids describing the same completed session, which the event-id index alone
    does not stop."""
    settings.STRIPE_WEBHOOK_SECRET = SECRET
    listing_right_product()
    seller = make_payments_seller("p14-acc-two@example.com")
    buy(api_client, seller)
    order = PaymentOrder.objects.get()

    deliver(api_client, order, event_id="evt_one")
    deliver(api_client, order, event_id="evt_two")

    assert UserEntitlement.objects.count() == 1
    assert ProcessedWebhookEvent.objects.count() == 2


@pytest.mark.django_db
def test_a_forged_signature_produces_400_and_no_state_change(
    api_client, settings, checkout_enabled, gateway
):
    """Spec §23 acceptance bullet 2."""
    settings.STRIPE_WEBHOOK_SECRET = SECRET
    listing_right_product()
    seller = make_payments_seller("p14-acc-forged@example.com")
    buy(api_client, seller)
    order = PaymentOrder.objects.get()

    raw = json.dumps(
        {
            "id": "evt_forged",
            "type": "checkout.session.completed",
            "data": {"object": {"id": order.stripe_checkout_session_id}},
        }
    ).encode()
    response = api_client.post(
        WEBHOOK_URL, data=raw, content_type="application/json",
        HTTP_STRIPE_SIGNATURE="t=1,v1=deadbeef",
    )

    assert response.status_code == 400
    order.refresh_from_db()
    assert order.status == PaymentOrderStatus.CHECKOUT_OPEN
    assert UserEntitlement.objects.count() == 0
    assert ProcessedWebhookEvent.objects.count() == 0


@pytest.mark.django_db
def test_the_browser_success_url_alone_grants_nothing(
    api_client, settings, checkout_enabled, gateway
):
    """Spec §23 acceptance bullet 3 and §23.3's "It must never grant the right
    itself". The customer returns from Stripe and polls; no webhook has arrived,
    so there is nothing to poll but the order."""
    settings.STRIPE_WEBHOOK_SECRET = SECRET
    listing_right_product()
    seller = make_payments_seller("p14-acc-success@example.com")
    buy(api_client, seller)
    order = PaymentOrder.objects.get()

    for _ in range(3):
        polled = api_client.get(f"/api/v1/payment-orders/{order.pk}/")
        assert polled.status_code == 200
        assert polled.data["status"] == PaymentOrderStatus.CHECKOUT_OPEN
        assert polled.data["entitlement_id"] is None

    assert UserEntitlement.objects.count() == 0


@pytest.mark.django_db
def test_a_currency_or_amount_mismatch_blocks_fulfilment_and_alerts_staff(
    api_client, settings, checkout_enabled, gateway, staff_alerts,
    django_capture_on_commit_callbacks,
):
    """Spec §23 acceptance bullet 4."""
    settings.STRIPE_WEBHOOK_SECRET = SECRET
    listing_right_product()
    seller = make_payments_seller("p14-acc-mismatch@example.com")
    buy(api_client, seller)
    order = PaymentOrder.objects.get()

    with django_capture_on_commit_callbacks(execute=True):
        response = deliver(api_client, order, event_id="evt_mismatch", amount_total=1)

    assert response.status_code == 200
    order.refresh_from_db()
    assert order.status == PaymentOrderStatus.FAILED
    assert order.metadata["staff_review_required"] is True
    assert order.metadata["staff_review_reason"] == "amount_mismatch"
    assert staff_alerts == ["amount_mismatch"]
    assert UserEntitlement.objects.count() == 0


@pytest.mark.django_db
def test_a_user_cannot_buy_a_media_upgrade_for_another_users_listing(
    api_client, checkout_enabled, gateway
):
    """Spec §23 acceptance bullet 5."""
    from payments.gateway import PriceSnapshot

    gateway.price = PriceSnapshot(
        price_id="price_test_media_upgrade",
        product_id="prod_test_media_upgrade",
        unit_amount=1900,
        currency="eur",
        active=True,
        recurring=False,
    )
    media_upgrade_product()
    owner = make_payments_seller("p14-acc-owner@example.com")
    attacker = make_payments_seller("p14-acc-attacker@example.com")
    listing = make_private_listing(owner=owner)

    response = buy(
        api_client,
        attacker,
        product_code=ProductCode.LISTING_MEDIA_UPGRADE,
        listing_id=str(listing.pk),
    )

    assert response.status_code == 409
    assert response.data["error"]["code"] == "listing_not_upgradable"
    assert PaymentOrder.objects.count() == 0
    assert UserEntitlement.objects.count() == 0


@pytest.mark.django_db
def test_with_the_flag_off_nothing_can_be_purchased(api_client, gateway):
    """Spec §35.1/§35.2 step 4: the phase ships with its flag off, and off means
    off at the API, not only in the UI."""
    listing_right_product()
    seller = make_payments_seller("p14-acc-flag@example.com")

    response = buy(api_client, seller)

    assert response.status_code == 403
    assert response.data["error"]["code"] == "feature_disabled"
    assert PaymentOrder.objects.count() == 0


@pytest.mark.django_db
def test_an_unconfigured_product_cannot_be_bought_even_with_the_flag_on(
    api_client, checkout_enabled, gateway
):
    """Spec §38: the two seeded products are "inactive until valid environment
    Stripe IDs are supplied", and inactive means unpurchasable."""
    seller = make_payments_seller("p14-acc-unconfigured@example.com")

    response = buy(api_client, seller)

    assert response.status_code == 409
    assert response.data["error"]["code"] == "product_not_available"
