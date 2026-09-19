"""Spec §23.5's card fields, §26.4's edit rules and §5's permission row."""

from decimal import Decimal

import pytest
from django.contrib.auth.models import Group
from rest_framework.test import APIClient

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from audit.models import AuditEvent
from payments.enums import PaymentOrderStatus, ProductCode
from payments.models import MarketplaceProduct
from payments.tests.factories import (
    listing_right_product,
    make_order,
    make_payments_seller,
)
from payments.tests.fakes import FakeStripeGateway

LIST_URL = "/api/v1/staff/products/"


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def staff_admin(db):
    admin = make_user("p14-product-admin@example.com", role=UserRole.STAFF, verified=True)
    admin.groups.add(Group.objects.get_or_create(name=StaffGroup.ADMIN)[0])
    return admin


@pytest.fixture
def staff_moderator(db):
    mod = make_user("p14-product-mod@example.com", role=UserRole.STAFF, verified=True)
    mod.groups.add(Group.objects.get_or_create(name=StaffGroup.MODERATOR)[0])
    return mod


@pytest.fixture
def patched_gateway(monkeypatch):
    gateway = FakeStripeGateway()
    monkeypatch.setattr("payments.products.default_gateway", lambda: gateway)
    return gateway


@pytest.mark.django_db
def test_an_anonymous_caller_cannot_list_products(api_client):
    assert api_client.get(LIST_URL).status_code in (401, 403)


@pytest.mark.django_db
def test_a_private_seller_cannot_list_products(api_client):
    api_client.force_authenticate(user=make_payments_seller())

    response = api_client.get(LIST_URL)

    assert response.status_code == 403
    assert response.data["error"]["code"] == "staff_admin_required"


@pytest.mark.django_db
def test_a_staff_moderator_cannot_read_or_change_products(api_client, staff_moderator):
    """Spec §12: "A moderator cannot change payment products unless separately
    granted staff-admin permission"."""
    product = MarketplaceProduct.objects.get(code=ProductCode.INDIVIDUAL_LISTING_RIGHT)
    api_client.force_authenticate(user=staff_moderator)

    assert api_client.get(LIST_URL).status_code == 403
    assert (
        api_client.patch(
            f"{LIST_URL}{product.pk}/", {"is_active": True}, format="json"
        ).status_code
        == 403
    )


@pytest.mark.django_db
def test_a_staff_admin_sees_every_spec_23_5_card_field(api_client, staff_admin):
    api_client.force_authenticate(user=staff_admin)

    response = api_client.get(LIST_URL)

    assert response.status_code == 200
    assert len(response.data) == 2
    row = response.data[0]
    assert set(row) == {
        "id",
        "code",
        "name_en",
        "name_it",
        "name_es",
        "description_en",
        "description_it",
        "description_es",
        "is_active",
        "display_amount",
        "currency",
        "stripe_product_id",
        "stripe_price_id",
        "entitlement_valid_days",
        "publication_days",
        "display_order",
        "price_state",
        "price_reason",
        "stripe_unit_amount",
        "operations",
        "updated_at",
    }
    assert set(row["operations"]) == {
        "purchases",
        "fulfilled",
        "fulfillment_failures",
        "open_checkouts",
    }
    # Spec §30.2: money is a decimal string.
    assert row["display_amount"] == "0.00"


@pytest.mark.django_db
def test_the_list_does_not_call_stripe(api_client, staff_admin, patched_gateway):
    """Two products would be two API round trips on a screen that may poll."""
    listing_right_product()
    api_client.force_authenticate(user=staff_admin)

    response = api_client.get(LIST_URL)

    assert patched_gateway.retrieved == []
    assert {row["price_state"] for row in response.data} == {"UNCHECKED"}


@pytest.mark.django_db
def test_the_detail_reports_a_matching_price_as_ok(
    api_client, staff_admin, patched_gateway
):
    product = listing_right_product(display_amount=Decimal("49.00"))
    api_client.force_authenticate(user=staff_admin)

    response = api_client.get(f"{LIST_URL}{product.pk}/")

    assert response.status_code == 200
    assert response.data["price_state"] == "OK"
    assert response.data["stripe_unit_amount"] == 4900
    assert patched_gateway.retrieved == ["price_test_listing_right"]


@pytest.mark.django_db
def test_the_detail_reports_drift_as_a_mismatch_with_both_numbers(
    api_client, staff_admin, patched_gateway
):
    """Spec §23.5: "A warning is shown if stored display amount differs from
    Stripe's current Price". Staff see both sides, unlike a customer."""
    product = listing_right_product(display_amount=Decimal("59.00"))
    api_client.force_authenticate(user=staff_admin)

    response = api_client.get(f"{LIST_URL}{product.pk}/")

    assert response.data["price_state"] == "MISMATCH"
    assert "amount" in response.data["price_reason"]
    assert response.data["stripe_unit_amount"] == 4900
    assert response.data["display_amount"] == "59.00"


@pytest.mark.django_db
def test_a_stripe_outage_is_reported_as_unavailable_not_as_a_mismatch(
    api_client, staff_admin, monkeypatch
):
    from payments.gateway import StripeUnavailable

    product = listing_right_product()
    monkeypatch.setattr(
        "payments.products.default_gateway",
        lambda: FakeStripeGateway(raise_on_retrieve=StripeUnavailable("down")),
    )
    api_client.force_authenticate(user=staff_admin)

    response = api_client.get(f"{LIST_URL}{product.pk}/")

    assert response.status_code == 200
    assert response.data["price_state"] == "UNAVAILABLE"


@pytest.mark.django_db
def test_the_operations_counters_equal_real_query_results(api_client, staff_admin):
    """Spec §26's definition of done: "All visible counters equal query
    results." Spec §23.5 limits them to "counts, not financial analytics"."""
    from entitlements.enums import EntitlementType
    from entitlements.tests.factories import make_entitlement

    product = listing_right_product()
    buyer = make_payments_seller("p14-counter@example.com")
    right = make_entitlement(user=buyer, entitlement_type=EntitlementType.PAID_LISTING)
    make_order(user=buyer, product=product, status=PaymentOrderStatus.CHECKOUT_OPEN)
    make_order(user=buyer, product=product, status=PaymentOrderStatus.PAID)
    make_order(
        user=buyer, product=product, status=PaymentOrderStatus.FULFILLED,
        fulfilled_entitlement=right,
    )
    make_order(user=buyer, product=product, status=PaymentOrderStatus.FAILED)
    api_client.force_authenticate(user=staff_admin)

    response = api_client.get(f"{LIST_URL}{product.pk}/")

    ops = response.data["operations"]
    # PAID + FULFILLED: money moved. CHECKOUT_OPEN and FAILED did not.
    assert ops["purchases"] == 2
    assert ops["fulfilled"] == 1
    assert ops["fulfillment_failures"] == 1
    assert ops["open_checkouts"] == 1
    # And no revenue figure anywhere: spec §23.5 says counts only.
    assert "revenue" not in str(response.data)


@pytest.mark.django_db
def test_a_staff_admin_can_configure_and_activate_a_product(api_client, staff_admin):
    product = MarketplaceProduct.objects.get(code=ProductCode.INDIVIDUAL_LISTING_RIGHT)
    api_client.force_authenticate(user=staff_admin)

    response = api_client.patch(
        f"{LIST_URL}{product.pk}/",
        {
            "display_amount": "49.00",
            "currency": "EUR",
            "stripe_product_id": "prod_real",
            "stripe_price_id": "price_real",
            "is_active": True,
            "name_it": "Diritto",
        },
        format="json",
    )

    assert response.status_code == 200
    product.refresh_from_db()
    assert product.is_active is True
    assert product.display_amount == Decimal("49.00")
    assert product.updated_by_id == staff_admin.pk


@pytest.mark.django_db
def test_activating_an_unconfigured_product_is_a_clean_400_not_a_500(
    api_client, staff_admin
):
    """The database constraint from Task 2 must surface as a validation error,
    not as an unhandled IntegrityError."""
    product = MarketplaceProduct.objects.get(code=ProductCode.LISTING_MEDIA_UPGRADE)
    api_client.force_authenticate(user=staff_admin)

    response = api_client.patch(
        f"{LIST_URL}{product.pk}/", {"is_active": True}, format="json"
    )

    assert response.status_code == 400
    assert response.data["error"]["code"] == "validation_error"
    product.refresh_from_db()
    assert product.is_active is False


@pytest.mark.django_db
def test_the_product_code_cannot_be_changed(api_client, staff_admin):
    """Spec §23.1's catalogue is closed. `code` is read-only, so a client
    sending it is ignored rather than obeyed."""
    product = MarketplaceProduct.objects.get(code=ProductCode.LISTING_MEDIA_UPGRADE)
    api_client.force_authenticate(user=staff_admin)

    api_client.patch(
        f"{LIST_URL}{product.pk}/", {"code": "SUBSCRIPTION"}, format="json"
    )

    product.refresh_from_db()
    assert product.code == ProductCode.LISTING_MEDIA_UPGRADE


@pytest.mark.django_db
def test_operational_counters_are_read_only(api_client, staff_admin):
    product = listing_right_product()
    api_client.force_authenticate(user=staff_admin)

    response = api_client.patch(
        f"{LIST_URL}{product.pk}/",
        {"operations": {"purchases": 9999}, "price_state": "OK"},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["operations"]["purchases"] == 0


@pytest.mark.django_db
def test_neither_creating_nor_deleting_a_product_is_possible(api_client, staff_admin):
    product = listing_right_product()
    api_client.force_authenticate(user=staff_admin)

    assert api_client.post(LIST_URL, {"code": "SUBSCRIPTION"}, format="json").status_code == 405
    assert api_client.delete(f"{LIST_URL}{product.pk}/").status_code == 405


@pytest.mark.django_db
def test_every_product_change_is_audited_with_a_before_and_after(
    api_client, staff_admin
):
    """Spec §26's definition of done: "Product, policy, broker approval and
    taxonomy actions are audited"."""
    product = listing_right_product(is_active=False)
    api_client.force_authenticate(user=staff_admin)

    api_client.patch(
        f"{LIST_URL}{product.pk}/", {"is_active": True}, format="json"
    )

    event = AuditEvent.objects.get(action="product.updated")
    assert event.target_id == str(product.pk)
    assert event.actor_user_id == staff_admin.pk
    assert event.source == AuditEvent.Source.ADMIN
    assert event.before["is_active"] is False
    assert event.after["is_active"] is True


@pytest.mark.django_db
def test_deactivation_gets_its_own_audit_action(api_client, staff_admin):
    """Spec §26.4: "Deactivating a product stops new Checkout creation." It is
    the single most consequential product edit, so it is queryable on its own."""
    product = listing_right_product()
    api_client.force_authenticate(user=staff_admin)

    api_client.patch(
        f"{LIST_URL}{product.pk}/", {"is_active": False}, format="json"
    )

    assert AuditEvent.objects.filter(action="product.deactivated").count() == 1


@pytest.mark.django_db
def test_deactivating_a_product_does_not_revoke_purchased_entitlements(
    api_client, staff_admin
):
    """Spec §26.4, verbatim: deactivating "does not invalidate previously
    purchased entitlements"."""
    from entitlements.enums import EntitlementState, EntitlementType
    from entitlements.tests.factories import make_entitlement

    product = listing_right_product()
    buyer = make_payments_seller("p14-deact@example.com")
    right = make_entitlement(user=buyer, entitlement_type=EntitlementType.PAID_LISTING)
    api_client.force_authenticate(user=staff_admin)

    api_client.patch(f"{LIST_URL}{product.pk}/", {"is_active": False}, format="json")

    right.refresh_from_db()
    assert right.state == EntitlementState.AVAILABLE
