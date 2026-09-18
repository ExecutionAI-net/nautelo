import pytest
from django.contrib.auth.models import Group
from rest_framework.test import APIClient

from accounts.enums import Locale, StaffGroup, UserRole
from accounts.selectors import PERMISSION_KEYS
from accounts.tests.factories import DEFAULT_TEST_PASSWORD, make_user
from brokers.enums import BrokerMembershipRole, BrokerOrganizationStatus
from brokers.tests.factories import make_broker, make_membership
from professionals.tests.factories import make_professional

SESSION_URL = "/api/v1/session/"
LOGIN_URL = "/api/v1/auth/login/"


@pytest.fixture
def api():
    return APIClient()


def _authenticate(api, user):
    response = api.post(
        LOGIN_URL, {"email": user.email, "password": DEFAULT_TEST_PASSWORD}, format="json"
    )
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
    return api


@pytest.mark.django_db
def test_a_guest_gets_a_full_all_false_permission_map(api):
    response = api.get(SESSION_URL)

    assert response.status_code == 200
    assert response.data["authenticated"] is False
    assert response.data["user"] is None
    assert response.data["locale"] == Locale.EN
    assert response.data["broker_memberships"] == []
    assert response.data["professional_profile"] is None
    assert set(response.data["permissions"]) == set(PERMISSION_KEYS)
    assert response.data["permissions"]["browse_public_content"] is True
    assert all(
        value is False
        for key, value in response.data["permissions"].items()
        if key != "browse_public_content"
    )


@pytest.mark.django_db
def test_an_authenticated_buyer_may_inquire_but_not_sell(api):
    buyer = make_user("buyer@example.com", role=UserRole.BUYER, locale=Locale.IT)
    _authenticate(api, buyer)

    response = api.get(SESSION_URL)

    assert response.data["authenticated"] is True
    assert response.data["user"]["email"] == "buyer@example.com"
    assert response.data["locale"] == Locale.IT
    permissions = response.data["permissions"]
    assert permissions["submit_inquiry"] is True
    assert permissions["reveal_contact_after_inquiry"] is True
    assert permissions["reveal_any_contact"] is False
    assert permissions["create_private_listing"] is False
    assert permissions["create_broker_listing"] is False


@pytest.mark.django_db
def test_an_unverified_user_cannot_inquire_or_list(api):
    user = make_user("unv@example.com", role=UserRole.PRIVATE_SELLER, verified=False)
    _authenticate(api, user)

    permissions = api.get(SESSION_URL).data["permissions"]

    assert permissions["submit_inquiry"] is False
    assert permissions["create_private_listing"] is False


@pytest.mark.django_db
def test_a_verified_private_seller_may_create_a_private_listing(api):
    seller = make_user("ps@example.com", role=UserRole.PRIVATE_SELLER)
    _authenticate(api, seller)

    permissions = api.get(SESSION_URL).data["permissions"]

    assert permissions["create_private_listing"] is True
    assert permissions["create_broker_listing"] is False
    assert permissions["enable_listing_finance_flag"] is False


@pytest.mark.django_db
def test_a_broker_editor_may_create_broker_listings_and_enable_finance(api):
    agent = make_user("agent@example.com", role=UserRole.BROKER)
    broker = make_broker()
    make_membership(agent, broker, role=BrokerMembershipRole.AGENT, can_edit_listings=True)
    _authenticate(api, agent)

    response = api.get(SESSION_URL)

    assert response.data["permissions"]["create_broker_listing"] is True
    assert response.data["permissions"]["enable_listing_finance_flag"] is True
    assert response.data["permissions"]["create_private_listing"] is False
    membership = response.data["broker_memberships"][0]
    assert membership["broker_slug"] == broker.slug
    assert membership["role"] == BrokerMembershipRole.AGENT
    assert membership["can_edit_listings"] is True
    assert membership["can_manage_team"] is False


@pytest.mark.django_db
def test_a_suspended_broker_membership_is_not_reported_as_usable(api):
    agent = make_user("susp@example.com", role=UserRole.BROKER)
    broker = make_broker(status=BrokerOrganizationStatus.SUSPENDED)
    make_membership(agent, broker, can_edit_listings=True)
    _authenticate(api, agent)

    response = api.get(SESSION_URL)

    assert response.data["permissions"]["create_broker_listing"] is False
    assert response.data["broker_memberships"][0]["broker_status"] == (
        BrokerOrganizationStatus.SUSPENDED
    )


@pytest.mark.django_db
def test_a_moderator_may_approve_but_not_configure(api):
    moderator = make_user("mod@example.com", role=UserRole.STAFF)
    moderator.groups.add(Group.objects.get(name=StaffGroup.MODERATOR))
    _authenticate(api, moderator)

    response = api.get(SESSION_URL)

    permissions = response.data["permissions"]
    assert permissions["approve_listings_and_revisions"] is True
    assert permissions["reveal_any_contact"] is True
    assert permissions["configure_products_and_settings"] is False
    assert permissions["configure_broker_auto_approval"] is False
    assert permissions["manage_taxonomy"] is False
    assert response.data["staff"] == {"is_staff_moderator": True, "is_staff_admin": False}


@pytest.mark.django_db
def test_a_staff_admin_may_configure_everything(api):
    admin = make_user("sa@example.com", role=UserRole.STAFF)
    admin.groups.add(Group.objects.get(name=StaffGroup.ADMIN))
    _authenticate(api, admin)

    permissions = api.get(SESSION_URL).data["permissions"]

    assert permissions["configure_products_and_settings"] is True
    assert permissions["configure_broker_auto_approval"] is True
    assert permissions["manage_taxonomy"] is True
    assert permissions["create_listing_on_behalf"] is True
    assert permissions["approve_listings_and_revisions"] is True


@pytest.mark.django_db
def test_a_service_provider_session_includes_their_profile(api):
    pro = make_user("pro@example.com", role=UserRole.SERVICE_PROVIDER)
    profile = make_professional(pro, display_name="Ocean Legal", slug="ocean-legal")
    _authenticate(api, pro)

    payload = api.get(SESSION_URL).data

    assert payload["professional_profile"] == {
        "id": str(profile.pk),
        "slug": "ocean-legal",
        "display_name": "Ocean Legal",
        "status": profile.status,
    }


@pytest.mark.django_db
def test_the_session_payload_never_contains_a_token_or_password(api):
    user = make_user("leak@example.com")
    _authenticate(api, user)

    body = str(api.get(SESSION_URL).data)

    assert "password" not in body
    assert "refresh" not in body
    assert "access" not in body


@pytest.mark.django_db
def test_an_expired_or_bogus_token_is_rejected_rather_than_treated_as_a_guest(api):
    api.credentials(HTTP_AUTHORIZATION="Bearer not-a-real-token")
    response = api.get(SESSION_URL)
    assert response.status_code == 401
    assert response.data["error"]["code"] == "token_not_valid"


@pytest.mark.django_db
def test_session_query_count_is_stable_with_many_memberships(api, django_assert_max_num_queries):
    agent = make_user("many@example.com", role=UserRole.BROKER)
    for index in range(5):
        broker = make_broker(name=f"Broker {index}", slug=f"broker-{index}")
        make_membership(agent, broker, can_edit_listings=True)
    _authenticate(api, agent)

    with django_assert_max_num_queries(8):
        api.get(SESSION_URL)
