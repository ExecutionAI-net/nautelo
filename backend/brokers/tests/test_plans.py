import pytest
from django.contrib.auth.models import Group
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from brokers.enums import BrokerMembershipRole
from brokers.models import BrokerPlan
from brokers.tests.factories import make_broker, make_membership
from listings.tests.factories import make_brand, make_model
from platform_settings.services import set_feature_flag

pytestmark = pytest.mark.django_db


@pytest.fixture
def api():
    return APIClient()


def _staff_client():
    admin = make_user(email="plans-staff@example.com", role=UserRole.STAFF, verified=True)
    admin.groups.add(Group.objects.get(name=StaffGroup.ADMIN))
    client = APIClient()
    client.force_authenticate(admin)
    return client


def test_the_three_design_tiers_are_seeded():
    plans = {p.slug: p for p in BrokerPlan.objects.all()}
    assert set(plans) == {"boutique-broker", "premier-fleet", "sovereign-agency"}
    assert (plans["boutique-broker"].listing_limit, plans["boutique-broker"].seat_limit) == (5, 2)
    assert (plans["premier-fleet"].listing_limit, plans["premier-fleet"].seat_limit) == (25, 10)
    assert plans["sovereign-agency"].listing_limit is None and plans["sovereign-agency"].seat_limit is None


def test_public_pricing_lists_broker_plans_and_only_the_listing_right(api):
    from payments.enums import ProductCode
    from payments.models import MarketplaceProduct

    MarketplaceProduct.objects.filter(code=ProductCode.INDIVIDUAL_LISTING_RIGHT).update(
        name_en="Listing right", display_amount="49.00", is_active=True, stripe_product_id="prod_x", stripe_price_id="price_x"
    )
    MarketplaceProduct.objects.filter(code=ProductCode.LISTING_MEDIA_UPGRADE).update(
        name_en="Media upgrade", display_amount="19.00", is_active=True, stripe_product_id="prod_y", stripe_price_id="price_y"
    )
    body = api.get(reverse("public-pricing")).json()
    assert [p["name"] for p in body["broker_plans"]] == ["Boutique Broker", "Premier Fleet", "Sovereign Agency"]
    assert [p["name"] for p in body["individual_products"]] == ["Listing right"]


def test_a_broker_cannot_open_more_drafts_than_its_plan_allows(api):
    set_feature_flag(key="listing_revisions", is_enabled=True, actor=None, description="flag")
    broker = make_broker(plan=BrokerPlan.objects.get(slug="boutique-broker"))
    agent = make_user("plan-agent@example.com", role=UserRole.BROKER, verified=True)
    make_membership(agent, broker, role=BrokerMembershipRole.MANAGER, can_edit_listings=True)
    brand = make_brand()
    model = make_model(brand)
    api.force_authenticate(agent)
    body = {"brand_id": str(brand.pk), "model_id": str(model.pk), "manufacture_year": 2020, "title_en": "Boat", "broker_id": str(broker.pk)}

    for _ in range(5):
        assert api.post(reverse("listing-draft-create"), body, format="json").status_code == 201
    refused = api.post(reverse("listing-draft-create"), body, format="json")

    assert refused.status_code == 403
    assert refused.data["error"]["code"] == "plan_listing_limit_reached"


def test_a_broker_without_a_plan_is_not_capped(api):
    set_feature_flag(key="listing_revisions", is_enabled=True, actor=None, description="flag")
    broker = make_broker()
    agent = make_user("free-agent@example.com", role=UserRole.BROKER, verified=True)
    make_membership(agent, broker, role=BrokerMembershipRole.MANAGER, can_edit_listings=True)
    brand = make_brand()
    model = make_model(brand)
    api.force_authenticate(agent)
    body = {"brand_id": str(brand.pk), "model_id": str(model.pk), "manufacture_year": 2020, "title_en": "Boat", "broker_id": str(broker.pk)}
    for _ in range(7):
        assert api.post(reverse("listing-draft-create"), body, format="json").status_code == 201


def test_seat_limit_blocks_adding_a_member(api):
    broker = make_broker(plan=BrokerPlan.objects.get(slug="boutique-broker"))
    admin = make_user("seat-admin@example.com", role=UserRole.BROKER, verified=True)
    make_membership(admin, broker, role=BrokerMembershipRole.ADMIN)
    make_membership(make_user("seat-two@example.com", role=UserRole.BROKER), broker)
    make_user("seat-three@example.com", role=UserRole.BROKER)
    api.force_authenticate(admin)

    response = api.post(
        f"/api/v1/brokers/{broker.pk}/members/",
        {"user_email": "seat-three@example.com", "role": BrokerMembershipRole.AGENT},
        format="json",
    )

    assert response.status_code == 403
    assert response.data["error"]["code"] == "plan_seat_limit_reached"


def test_profile_reports_plan_and_usage(api):
    broker = make_broker(plan=BrokerPlan.objects.get(slug="premier-fleet"))
    admin = make_user("usage-admin@example.com", role=UserRole.BROKER, verified=True)
    make_membership(admin, broker, role=BrokerMembershipRole.ADMIN, can_manage_team=True)
    api.force_authenticate(admin)
    body = api.get(f"/api/v1/brokers/{broker.pk}/profile/").json()
    assert body["plan"]["slug"] == "premier-fleet"
    assert body["plan"]["listing_limit"] == 25
    assert body["seats_used"] == 1


def test_staff_assigns_a_plan_and_the_directory_orders_by_placement():
    staff = _staff_client()
    basic = make_broker(name="Zeta Basic", slug="zeta-basic", plan=BrokerPlan.objects.get(slug="boutique-broker"))
    featured = make_broker(name="Yankee Featured", slug="yankee-featured")
    unplanned = make_broker(name="Alpha None", slug="alpha-none")

    assigned = staff.post(
        reverse("staff-broker-plan-assign", args=[featured.pk]), {"plan": "sovereign-agency", "renews_at": "2027-01-15"}, format="json"
    )
    assert assigned.status_code == 200
    featured.refresh_from_db()
    assert featured.plan.slug == "sovereign-agency" and str(featured.plan_renews_at) == "2027-01-15"

    names = [b["name"] for b in APIClient().get(reverse("public-broker-list")).json()["results"]]
    assert names == ["Yankee Featured", "Zeta Basic", "Alpha None"]
    assert basic.plan is not None and unplanned.plan is None


def test_staff_manages_plans():
    staff = _staff_client()
    created = staff.post(
        reverse("staff-broker-plan-list"),
        {"slug": "test-tier", "name": "Test tier", "monthly_price": "10.00", "listing_limit": 1, "seat_limit": 1, "profile_visibility": 0, "display_order": 9},
        format="json",
    )
    assert created.status_code == 201
    listed = staff.get(reverse("staff-broker-plan-list")).json()
    assert "test-tier" in [p["slug"] for p in listed]
