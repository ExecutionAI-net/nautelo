"""Spec §30.1's two customer-facing payment endpoints."""

from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from entitlements.enums import EntitlementType
from entitlements.tests.factories import make_entitlement
from payments.enums import PaymentOrderStatus, ProductCode
from payments.models import PaymentOrder
from payments.tests.factories import (
    listing_right_product,
    make_order,
    make_payments_seller,
)
from payments.tests.fakes import FakeStripeGateway

CHECKOUT_URL = "/api/v1/checkout-sessions/"


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def seller(db):
    return make_payments_seller()


@pytest.fixture
def patched_gateway(monkeypatch):
    """Point the VIEW's default gateway at a fake.

    The view calls create_checkout_session without a `gateway=`, exactly as
    production does, so patching `payments.checkout.default_gateway` is what
    keeps the test on the real code path while still staying off the network.
    """
    gateway = FakeStripeGateway()
    monkeypatch.setattr("payments.checkout.default_gateway", lambda: gateway)
    return gateway


def post_checkout(client, body, *, key="idem-1"):
    return client.post(
        CHECKOUT_URL, body, format="json", HTTP_IDEMPOTENCY_KEY=key
    )


@pytest.mark.django_db
def test_an_anonymous_caller_is_refused_before_the_flag_is_even_read(api_client):
    """Permission ORDER: an unauthenticated stranger must not be able to probe
    our rollout state."""
    response = post_checkout(
        api_client, {"product_code": ProductCode.INDIVIDUAL_LISTING_RIGHT}
    )

    assert response.status_code in (401, 403)
    assert response.data["error"]["code"] != "feature_disabled"


@pytest.mark.django_db
def test_an_unverified_user_is_refused_with_email_not_verified(
    api_client, checkout_enabled
):
    """Spec §12 item 3: "Require verified email for ... Checkout creation"."""
    user = make_user("p14-unverified@example.com", role=UserRole.PRIVATE_SELLER,
                     verified=False)
    api_client.force_authenticate(user=user)

    response = post_checkout(
        api_client, {"product_code": ProductCode.INDIVIDUAL_LISTING_RIGHT}
    )

    assert response.status_code == 403
    assert response.data["error"]["code"] == "email_not_verified"


@pytest.mark.django_db
def test_with_the_flag_off_a_verified_seller_gets_feature_disabled(
    api_client, seller
):
    """Spec §35.1: the flag gates backend mutation, not only the UI."""
    listing_right_product()
    api_client.force_authenticate(user=seller)

    response = post_checkout(
        api_client, {"product_code": ProductCode.INDIVIDUAL_LISTING_RIGHT}
    )

    assert response.status_code == 403
    assert response.data["error"]["code"] == "feature_disabled"
    assert PaymentOrder.objects.count() == 0


@pytest.mark.django_db
def test_a_missing_idempotency_key_is_refused(api_client, seller, checkout_enabled):
    """Spec §30.3: "Require Idempotency-Key for Checkout creation"."""
    listing_right_product()
    api_client.force_authenticate(user=seller)

    response = api_client.post(
        CHECKOUT_URL,
        {"product_code": ProductCode.INDIVIDUAL_LISTING_RIGHT},
        format="json",
    )

    assert response.status_code == 400
    assert response.data["error"]["code"] == "idempotency_key_required"


@pytest.mark.django_db
def test_a_missing_key_beats_a_malformed_body(api_client, seller, checkout_enabled):
    """The header is a precondition, not a field: a client making both mistakes
    must be told about the systematic one."""
    listing_right_product()
    api_client.force_authenticate(user=seller)

    response = api_client.post(CHECKOUT_URL, {"product_code": "NONSENSE"}, format="json")

    assert response.status_code == 400
    assert response.data["error"]["code"] == "idempotency_key_required"


@pytest.mark.django_db
def test_a_successful_request_returns_201_with_the_stripe_url(
    api_client, seller, checkout_enabled, patched_gateway
):
    listing_right_product()
    api_client.force_authenticate(user=seller)

    response = post_checkout(
        api_client,
        {
            "product_code": ProductCode.INDIVIDUAL_LISTING_RIGHT,
            "listing_id": None,
            "return_url": "/dashboard/private-seller/listings/",
        },
    )

    assert response.status_code == 201
    assert response.data["checkout_url"] == patched_gateway.url
    order = response.data["order"]
    assert order["status"] == PaymentOrderStatus.CHECKOUT_OPEN
    assert order["product_code"] == ProductCode.INDIVIDUAL_LISTING_RIGHT
    # Spec §30.2: money is a decimal STRING, not a float.
    assert order["amount"] == "49.00"
    assert isinstance(order["amount"], str)
    assert order["entitlement_id"] is None


@pytest.mark.django_db
def test_the_client_cannot_submit_an_amount_or_a_price(
    api_client, seller, checkout_enabled, patched_gateway
):
    """Spec §23.2: "Server loads Stripe Price; client cannot submit
    amount/currency." Unknown keys must be ignored, never honoured. Quantity is honoured
    only inside its 1-20 bound."""
    listing_right_product()
    api_client.force_authenticate(user=seller)

    response = post_checkout(
        api_client,
        {
            "product_code": ProductCode.INDIVIDUAL_LISTING_RIGHT,
            "amount": "0.01",
            "currency": "USD",
            "price_id": "price_attacker",
        },
    )

    assert response.status_code == 201
    order = PaymentOrder.objects.get()
    assert order.amount == Decimal("49.00")
    assert order.currency == "EUR"
    assert patched_gateway.created[0]["params"]["line_items"] == [
        {"price": "price_test_listing_right", "quantity": 1}
    ]


@pytest.mark.django_db
def test_a_hostile_return_url_is_refused_with_its_own_code(
    api_client, seller, checkout_enabled, patched_gateway
):
    listing_right_product()
    api_client.force_authenticate(user=seller)

    response = post_checkout(
        api_client,
        {
            "product_code": ProductCode.INDIVIDUAL_LISTING_RIGHT,
            "return_url": "https://evil.example/harvest",
        },
    )

    assert response.status_code == 400
    assert response.data["error"]["code"] == "invalid_return_url"
    assert PaymentOrder.objects.count() == 0
    assert patched_gateway.created == []


@pytest.mark.django_db
def test_an_unknown_product_code_is_a_validation_error_not_a_500(
    api_client, seller, checkout_enabled
):
    api_client.force_authenticate(user=seller)

    response = post_checkout(api_client, {"product_code": "SUBSCRIPTION"})

    assert response.status_code == 400
    assert response.data["error"]["code"] == "validation_error"
    assert "product_code" in response.data["error"]["fields"]


@pytest.mark.django_db
def test_replaying_the_same_key_returns_200_and_the_same_order(
    api_client, seller, checkout_enabled, patched_gateway
):
    listing_right_product()
    api_client.force_authenticate(user=seller)
    body = {"product_code": ProductCode.INDIVIDUAL_LISTING_RIGHT}

    first = post_checkout(api_client, body)
    second = post_checkout(api_client, body)

    assert (first.status_code, second.status_code) == (201, 200)
    assert first.data["order"]["id"] == second.data["order"]["id"]
    assert PaymentOrder.objects.count() == 1
    assert len(patched_gateway.created) == 1


@pytest.mark.django_db
def test_the_error_envelope_carries_a_request_id(
    api_client, seller, checkout_enabled, patched_gateway
):
    """Spec §30.2: "Include/request X-Request-ID; echo it in error responses"."""
    api_client.force_authenticate(user=seller)

    response = post_checkout(
        api_client, {"product_code": ProductCode.INDIVIDUAL_LISTING_RIGHT}
    )

    assert response.status_code == 409  # product is still inactive
    assert response.data["error"]["code"] == "product_not_available"
    assert response.data["error"]["request_id"]
    assert response["X-Request-ID"]


@pytest.mark.django_db
def test_the_checkout_view_declares_only_a_throttle_scope(api_client):
    """Phase 3 contract rule 9: views declare `throttle_scope`, never
    `throttle_classes` — the project's HashedIPScopedRateThrottle is installed
    globally precisely so no view can opt into a raw DRF throttle that would put
    a plaintext IP in a Redis key (spec §30.4)."""
    from payments.views import CheckoutSessionCreateView

    assert CheckoutSessionCreateView.throttle_scope == "checkout_create"
    assert "throttle_classes" not in CheckoutSessionCreateView.__dict__
    # The scope must also EXIST in settings: ScopedRateThrottle with an unknown
    # scope raises at request time, and a scope removed from settings would turn
    # this endpoint unlimited without any test noticing.
    from django.conf import settings as django_settings

    assert (
        django_settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["checkout_create"]
        == "30/min"
    )


@pytest.mark.django_db
def test_the_permission_stack_matches_the_house_order():
    """Defence in depth, pinned structurally.

    `IsActiveUser` already refuses an anonymous caller, so dropping
    `IsAuthenticated` changes no response — which is exactly why this has to be
    asserted on the class list. The ORDER is the load-bearing part: DRF stops at
    the first failure, so a flag gate hoisted above authentication would let an
    anonymous stranger enumerate our rollout state.
    """
    from rest_framework.permissions import IsAuthenticated

    from accounts.permissions import IsActiveUser, IsEmailVerified, IsStaffAdmin
    from payments.permissions import StripeCheckoutEnabled
    from payments.views import (
        CheckoutSessionCreateView,
        PaymentOrderDetailView,
        StaffProductDetailView,
        StaffProductListView,
    )

    assert CheckoutSessionCreateView.permission_classes == [
        IsAuthenticated, IsActiveUser, IsEmailVerified, StripeCheckoutEnabled,
    ]
    assert PaymentOrderDetailView.permission_classes == [IsAuthenticated, IsActiveUser]
    for view in (StaffProductListView, StaffProductDetailView):
        assert view.permission_classes == [
            IsAuthenticated, IsActiveUser, IsEmailVerified, IsStaffAdmin,
        ]


@pytest.mark.django_db
def test_an_owner_can_poll_their_own_order(api_client, seller):
    order = make_order(user=seller, product=listing_right_product())
    api_client.force_authenticate(user=seller)

    response = api_client.get(f"/api/v1/payment-orders/{order.pk}/")

    assert response.status_code == 200
    assert response.data["id"] == str(order.pk)
    assert response.data["status"] == PaymentOrderStatus.CREATED


@pytest.mark.django_db
def test_a_stranger_polling_someone_elses_order_gets_404_not_403(api_client):
    """A 403 would confirm the id exists. Spec §33.1's IDOR rule."""
    owner = make_payments_seller("p14-poll-owner@example.com")
    stranger = make_payments_seller("p14-poll-stranger@example.com")
    order = make_order(user=owner, product=listing_right_product())
    api_client.force_authenticate(user=stranger)

    response = api_client.get(f"/api/v1/payment-orders/{order.pk}/")

    assert response.status_code == 404


@pytest.mark.django_db
def test_polling_grants_nothing(api_client, seller):
    """Spec §23.3: the success page "must never grant the right itself"."""
    import inspect

    from payments import views

    order = make_order(
        user=seller,
        product=listing_right_product(),
        status=PaymentOrderStatus.PAID,
    )
    api_client.force_authenticate(user=seller)

    before = list(seller.entitlements.values_list("pk", flat=True))
    response = api_client.get(f"/api/v1/payment-orders/{order.pk}/")
    after = list(seller.entitlements.values_list("pk", flat=True))

    assert response.status_code == 200
    assert response.data["status"] == PaymentOrderStatus.PAID
    assert response.data["entitlement_id"] is None
    assert before == after
    # Structural, not just behavioural: the poll view has no write handler and
    # the module does not even import the fulfilment path.
    assert views.PaymentOrderDetailView.http_method_names == ["get", "options"]
    # Assert on the IMPORT, not on the word: payments/views.py legitimately
    # contains the word "fulfilment" in prose (reporting fulfilment state is
    # this endpoint's whole job), so a bare substring check would fail against
    # the module's own docstrings. What must be absent is any way to REACH the
    # granting code from here.
    source = inspect.getsource(views)
    assert "payments.fulfillment" not in source
    assert "from .fulfillment" not in source
    assert "import fulfillment" not in source


@pytest.mark.django_db
def test_a_fulfilled_order_exposes_its_entitlement_id(api_client, seller):
    right = make_entitlement(user=seller, entitlement_type=EntitlementType.PAID_LISTING)
    order = make_order(
        user=seller,
        product=listing_right_product(),
        status=PaymentOrderStatus.FULFILLED,
        fulfilled_entitlement=right,
    )
    api_client.force_authenticate(user=seller)

    response = api_client.get(f"/api/v1/payment-orders/{order.pk}/")

    assert str(response.data["entitlement_id"]) == str(right.pk)


@pytest.mark.django_db
def test_an_anonymous_caller_cannot_poll(api_client, seller):
    order = make_order(user=seller, product=listing_right_product())

    response = api_client.get(f"/api/v1/payment-orders/{order.pk}/")

    assert response.status_code in (401, 403)


@pytest.mark.django_db
def test_a_quantity_above_the_cap_is_rejected(api_client, seller, checkout_enabled, patched_gateway):
    listing_right_product()
    api_client.force_authenticate(user=seller)
    response = post_checkout(
        api_client,
        {"product_code": ProductCode.INDIVIDUAL_LISTING_RIGHT, "quantity": 99},
    )
    assert response.status_code == 400
