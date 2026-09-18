"""Spec 12 acceptance tests for Phase 3, one test per named requirement."""

import pytest
from django.contrib.admin.sites import AdminSite
from django.contrib.auth.models import Group
from django.test import RequestFactory
from rest_framework.exceptions import PermissionDenied
from rest_framework.test import APIClient

from accounts.enums import StaffGroup, UserRole
from accounts.permissions import IsStaffAdmin
from accounts.selectors import get_session_permissions
from accounts.services import can_edit_owned_object, resolve_seller_context
from accounts.tests.factories import DEFAULT_TEST_PASSWORD, make_user
from brokers.admin import BrokerOrganizationAdmin
from brokers.enums import BrokerMembershipRole
from brokers.models import BrokerOrganization
from brokers.tests.factories import make_broker, make_membership

LOGIN_URL = "/api/v1/auth/login/"
ACCOUNT_URL = "/api/v1/account/"


@pytest.fixture
def api():
    return APIClient()


def _authenticate(api, user):
    response = api.post(
        LOGIN_URL, {"email": user.email, "password": DEFAULT_TEST_PASSWORD}, format="json"
    )
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
    return response.data["access"]


@pytest.mark.django_db
def test_acceptance_a_broker_agent_cannot_edit_another_brokers_records(api):
    """Spec 12: 'A broker agent cannot edit another broker's listing.'"""
    agent = make_user("agent-a@example.com", role=UserRole.BROKER)
    broker_a = make_broker(name="Broker A", slug="broker-a")
    broker_b = make_broker(name="Broker B", slug="broker-b")
    make_membership(
        agent, broker_a, role=BrokerMembershipRole.ADMIN
    )  # full authority inside A
    victim = make_user("victim@example.com", role=UserRole.BROKER)
    foreign_membership = make_membership(victim, broker_b, can_edit_listings=True)

    # Ownership service: the authority Phase 11's listing endpoints will consult.
    assert can_edit_owned_object(agent, owner_user_id=None, broker_id=broker_a.pk) is True
    assert can_edit_owned_object(agent, owner_user_id=None, broker_id=broker_b.pk) is False

    # And over HTTP, against a real broker-scoped record.
    _authenticate(api, agent)
    response = api.patch(
        f"/api/v1/brokers/{broker_b.pk}/members/{foreign_membership.pk}/",
        {"can_edit_listings": False},
        format="json",
    )
    assert response.status_code == 403
    assert response.data["error"]["code"] == "not_broker_team_manager"
    foreign_membership.refresh_from_db()
    assert foreign_membership.can_edit_listings is True


@pytest.mark.django_db
def test_acceptance_a_private_seller_cannot_forge_broker_seller_type_or_finance(api):
    """Spec 12: 'A private seller cannot send seller_type=BROKER or enable finance
    through a crafted request.'"""
    seller = make_user("private@example.com", role=UserRole.PRIVATE_SELLER)
    broker = make_broker()

    # seller_type is derived, never accepted: passing a broker id is simply refused.
    with pytest.raises(PermissionDenied) as exc_info:
        resolve_seller_context(seller, broker_id=broker.pk)
    assert exc_info.value.detail.code == "broker_listing_not_allowed"

    # And the finance capability is false for this account, so Phase 9's toggle
    # has no server-side basis to appear or be accepted.
    permissions = get_session_permissions(seller)
    assert permissions["create_private_listing"] is True
    assert permissions["create_broker_listing"] is False
    assert permissions["enable_listing_finance_flag"] is False

    _authenticate(api, seller)
    session = api.get("/api/v1/session/").data
    assert session["permissions"]["enable_listing_finance_flag"] is False


@pytest.mark.django_db
def test_acceptance_a_moderator_cannot_configure_products_without_staff_admin(api):
    """Spec 12: 'A moderator cannot change payment products unless separately
    granted staff-admin permission.'"""
    moderator = make_user("mod@example.com", role=UserRole.STAFF, is_staff=True)
    moderator.groups.add(Group.objects.get(name=StaffGroup.MODERATOR))
    request = RequestFactory().get("/admin/")
    request.user = moderator
    broker_admin = BrokerOrganizationAdmin(BrokerOrganization, AdminSite())

    assert get_session_permissions(moderator)["configure_products_and_settings"] is False
    assert get_session_permissions(moderator)["approve_listings_and_revisions"] is True
    assert IsStaffAdmin().has_permission(request, None) is False
    assert "auto_approve_listings" in broker_admin.get_readonly_fields(request)

    # Granting staff-admin separately is what unlocks configuration.
    moderator.groups.add(Group.objects.get(name=StaffGroup.ADMIN))
    moderator = type(moderator).objects.get(pk=moderator.pk)  # drop the permission cache
    request.user = moderator
    assert get_session_permissions(moderator)["configure_products_and_settings"] is True
    assert IsStaffAdmin().has_permission(request, None) is True
    assert "auto_approve_listings" not in broker_admin.get_readonly_fields(request)


@pytest.mark.django_db
def test_acceptance_an_inactive_user_cannot_act_from_an_old_session(api):
    """Spec 12: 'An inactive user cannot submit an inquiry from an old session.'"""
    user = make_user("suspended@example.com", role=UserRole.PRIVATE_SELLER)
    _authenticate(api, user)
    assert api.get(ACCOUNT_URL).status_code == 200

    user.is_active = False
    user.save(update_fields=["is_active", "updated_at"])

    response = api.get(ACCOUNT_URL)

    assert response.status_code == 401
    assert response.data["error"]["code"] == "user_inactive"
    assert get_session_permissions(user)["submit_inquiry"] is False
