"""Spec §4 /dashboard/staff/purchases/: a read-only ledger of every marketplace order."""

import pytest
from django.contrib.auth.models import Group
from rest_framework.test import APIClient

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from payments.enums import PaymentOrderStatus
from payments.tests.factories import listing_right_product, make_order, make_payments_seller

LIST_URL = "/api/v1/staff/purchases/"


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def staff_admin(db):
    admin = make_user("p14-purchase-admin@example.com", role=UserRole.STAFF, verified=True)
    admin.groups.add(Group.objects.get_or_create(name=StaffGroup.ADMIN)[0])
    return admin


@pytest.fixture
def staff_moderator(db):
    mod = make_user("p14-purchase-mod@example.com", role=UserRole.STAFF, verified=True)
    mod.groups.add(Group.objects.get_or_create(name=StaffGroup.MODERATOR)[0])
    return mod


@pytest.mark.django_db
def test_an_anonymous_caller_cannot_list_purchases(api_client):
    assert api_client.get(LIST_URL).status_code in (401, 403)


@pytest.mark.django_db
def test_a_private_seller_cannot_list_purchases(api_client):
    api_client.force_authenticate(user=make_payments_seller())

    response = api_client.get(LIST_URL)

    assert response.status_code == 403


@pytest.mark.django_db
def test_a_staff_moderator_cannot_list_purchases(api_client, staff_moderator):
    api_client.force_authenticate(user=staff_moderator)

    assert api_client.get(LIST_URL).status_code == 403


@pytest.mark.django_db
def test_a_staff_admin_sees_every_order_with_its_detail(api_client, staff_admin):
    from entitlements.enums import EntitlementType
    from entitlements.tests.factories import make_entitlement

    product = listing_right_product()
    buyer = make_payments_seller("p14-buyer@example.com")
    right = make_entitlement(user=buyer, entitlement_type=EntitlementType.PAID_LISTING)
    make_order(
        user=buyer, product=product, status=PaymentOrderStatus.FULFILLED,
        stripe_checkout_session_id="cs_test_1", stripe_payment_intent_id="pi_test_1",
        fulfilled_entitlement=right,
    )
    api_client.force_authenticate(user=staff_admin)

    response = api_client.get(LIST_URL)

    assert response.status_code == 200
    assert response.data["count"] == 1
    row = response.data["results"][0]
    assert row["user_email"] == "p14-buyer@example.com"
    assert row["product_code"] == product.code
    assert row["status"] == "FULFILLED"
    assert row["stripe_checkout_session_id"] == "cs_test_1"
    assert row["stripe_payment_intent_id"] == "pi_test_1"


@pytest.mark.django_db
def test_the_amount_is_shown_with_its_currency(api_client, staff_admin):
    from decimal import Decimal

    product = listing_right_product()
    buyer = make_payments_seller("p14-amount@example.com")
    make_order(user=buyer, product=product, status=PaymentOrderStatus.PAID, amount=Decimal("49.00"), currency="EUR")
    api_client.force_authenticate(user=staff_admin)

    row = api_client.get(LIST_URL).data["results"][0]

    assert row["amount_display"] == "49.00 EUR"


@pytest.mark.django_db
def test_search_matches_buyer_email_or_a_stripe_identifier(api_client, staff_admin):
    product = listing_right_product()
    a = make_payments_seller("p14-alpha@example.com")
    b = make_payments_seller("p14-beta@example.com")
    make_order(user=a, product=product, status=PaymentOrderStatus.PAID, stripe_payment_intent_id="pi_unique_x")
    make_order(user=b, product=product, status=PaymentOrderStatus.PAID)
    api_client.force_authenticate(user=staff_admin)

    by_email = api_client.get(LIST_URL, {"q": "alpha"}).data["results"]
    by_intent = api_client.get(LIST_URL, {"q": "pi_unique_x"}).data["results"]

    assert len(by_email) == 1 and by_email[0]["user_email"] == "p14-alpha@example.com"
    assert len(by_intent) == 1 and by_intent[0]["user_email"] == "p14-alpha@example.com"


@pytest.mark.django_db
def test_the_status_filter_and_facets_agree_with_the_real_counts(api_client, staff_admin):
    product = listing_right_product()
    buyer = make_payments_seller("p14-facets@example.com")
    make_order(user=buyer, product=product, status=PaymentOrderStatus.PAID)
    make_order(user=buyer, product=product, status=PaymentOrderStatus.PAID)
    make_order(user=buyer, product=product, status=PaymentOrderStatus.FAILED)
    api_client.force_authenticate(user=staff_admin)

    response = api_client.get(LIST_URL)
    assert response.data["facets"] == {"PAID": 2, "FAILED": 1}

    filtered = api_client.get(LIST_URL, {"status": "FAILED"})
    assert filtered.data["count"] == 1
    assert filtered.data["results"][0]["status"] == "FAILED"


@pytest.mark.django_db
def test_purchases_cannot_be_created_or_mutated_from_this_endpoint(api_client, staff_admin):
    api_client.force_authenticate(user=staff_admin)

    assert api_client.post(LIST_URL, {}, format="json").status_code == 405


@pytest.mark.django_db
def test_promotions_and_subscriptions_appear_in_the_same_ledger_as_orders(api_client, staff_admin):
    from brokers.models import BrokerPlan, BrokerSubscription
    from brokers.tests.factories import make_broker, make_membership
    from listings.tests.factories import make_private_listing
    from promotions.models import ListingPromotion, PromotionPlan

    product = listing_right_product()
    buyer = make_payments_seller("p14-ledger@example.com")
    make_order(user=buyer, product=product, status=PaymentOrderStatus.PAID, stripe_payment_intent_id="pi_order")
    listing = make_private_listing(owner=buyer)
    plan = PromotionPlan.objects.create(code="qa-ledger-week", name_en="Featured week", days=7, price="149.00")
    ListingPromotion.objects.create(
        listing=listing, user=buyer, plan=plan, days=7, amount="149.00", status="PAID", stripe_payment_intent_id="pi_promo"
    )
    broker_plan = BrokerPlan.objects.create(
        slug="qa-ledger-plan", name="Marina", monthly_price=99, trial_days=0, stripe_product_id="prod_l", stripe_price_id="price_l"
    )
    broker = make_broker(name="Ledger Brokers", slug="ledger-brokers", plan=broker_plan)
    owner = make_user("p14-broker-owner@example.com", role=UserRole.BROKER, verified=True)
    make_membership(owner, broker, role="ADMIN", can_manage_team=True)
    BrokerSubscription.objects.create(broker=broker, status="ACTIVE", stripe_subscription_id="sub_ledger")
    api_client.force_authenticate(user=staff_admin)

    rows = api_client.get(LIST_URL).data["results"]

    by_kind = {row["kind"]: row for row in rows}
    assert set(by_kind) == {"Order", "Promotion", "Broker subscription"}
    assert by_kind["Promotion"]["amount_display"] == "149.00 EUR"
    assert by_kind["Promotion"]["stripe_payment_intent_id"] == "pi_promo"
    assert "Featured week" in by_kind["Promotion"]["product_name"]
    assert by_kind["Broker subscription"]["user_email"] == "p14-broker-owner@example.com"
    assert by_kind["Broker subscription"]["detail"] == "Ledger Brokers"
    assert by_kind["Broker subscription"]["amount_display"] == "99.00 EUR/month"

    only_promotions = api_client.get(LIST_URL, {"kind": "Promotion"}).data
    assert only_promotions["count"] == 1
    assert api_client.get(LIST_URL, {"q": "ledger brokers"}).data["count"] == 1
