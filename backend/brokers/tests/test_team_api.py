import pytest
from django.contrib.auth.models import Group
from rest_framework.test import APIClient

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import DEFAULT_TEST_PASSWORD, make_user
from brokers.enums import BrokerMembershipRole, BrokerOrganizationStatus
from brokers.models import BrokerMembership
from brokers.serializers import (
    BrokerMembershipCreateSerializer,
    BrokerMembershipUpdateSerializer,
)
from brokers.tests.factories import make_broker, make_membership

LOGIN_URL = "/api/v1/auth/login/"


def members_url(broker):
    return f"/api/v1/brokers/{broker.pk}/members/"


def member_url(broker, membership):
    return f"/api/v1/brokers/{broker.pk}/members/{membership.pk}/"


@pytest.fixture
def api():
    return APIClient()


def _authenticate(api, user):
    response = api.post(
        LOGIN_URL, {"email": user.email, "password": DEFAULT_TEST_PASSWORD}, format="json"
    )
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
    return api


@pytest.fixture
def broker_with_admin():
    broker = make_broker()
    admin = make_user("teamadmin@example.com", role=UserRole.BROKER)
    make_membership(admin, broker, role=BrokerMembershipRole.ADMIN)
    return broker, admin


@pytest.mark.django_db
def test_a_team_manager_lists_their_brokers_members(api, broker_with_admin):
    broker, admin = broker_with_admin
    _authenticate(api, admin)

    response = api.get(members_url(broker))

    assert response.status_code == 200
    assert len(response.data) == 1
    assert response.data[0]["user_email"] == "teamadmin@example.com"
    assert response.data[0]["role"] == BrokerMembershipRole.ADMIN


@pytest.mark.django_db
def test_an_agent_without_can_manage_team_is_forbidden(api, broker_with_admin):
    broker, _ = broker_with_admin
    agent = make_user("plainagent@example.com", role=UserRole.BROKER)
    make_membership(agent, broker, role=BrokerMembershipRole.AGENT, can_edit_listings=True)
    _authenticate(api, agent)

    response = api.get(members_url(broker))

    assert response.status_code == 403
    assert response.data["error"]["code"] == "not_broker_team_manager"


@pytest.mark.django_db
def test_a_member_of_another_broker_is_forbidden(api, broker_with_admin):
    broker, _ = broker_with_admin
    other_broker = make_broker(name="Other", slug="other")
    outsider = make_user("outsider@example.com", role=UserRole.BROKER)
    make_membership(outsider, other_broker, role=BrokerMembershipRole.ADMIN)
    _authenticate(api, outsider)

    assert api.get(members_url(broker)).status_code == 403


@pytest.mark.django_db
def test_a_team_manager_adds_an_existing_user(api, broker_with_admin):
    broker, admin = broker_with_admin
    newcomer = make_user("newcomer@example.com", role=UserRole.BROKER)
    _authenticate(api, admin)

    response = api.post(
        members_url(broker),
        {"user_email": "newcomer@example.com", "role": BrokerMembershipRole.AGENT,
         "can_edit_listings": True},
        format="json",
    )

    assert response.status_code == 201
    membership = BrokerMembership.objects.get(user=newcomer, broker=broker)
    assert membership.role == BrokerMembershipRole.AGENT
    assert membership.can_edit_listings is True
    assert membership.can_manage_team is False


@pytest.mark.django_db
def test_adding_an_unknown_email_returns_a_stable_code(api, broker_with_admin):
    broker, admin = broker_with_admin
    _authenticate(api, admin)

    response = api.post(
        members_url(broker), {"user_email": "ghost@example.com"}, format="json"
    )

    assert response.status_code == 400
    assert response.data["error"]["fields"]["user_email"] == ["user_not_found"]


@pytest.mark.django_db
def test_adding_the_same_user_twice_is_rejected(api, broker_with_admin):
    broker, admin = broker_with_admin
    make_user("twice@example.com", role=UserRole.BROKER)
    _authenticate(api, admin)
    api.post(members_url(broker), {"user_email": "twice@example.com"}, format="json")

    response = api.post(members_url(broker), {"user_email": "twice@example.com"}, format="json")

    assert response.status_code == 400
    assert response.data["error"]["fields"]["user_email"] == ["membership_exists"]


@pytest.mark.django_db
def test_promoting_to_admin_grants_every_flag(api, broker_with_admin):
    broker, admin = broker_with_admin
    agent = make_user("promote@example.com", role=UserRole.BROKER)
    membership = make_membership(agent, broker, role=BrokerMembershipRole.AGENT)
    _authenticate(api, admin)

    response = api.patch(
        member_url(broker, membership), {"role": BrokerMembershipRole.ADMIN}, format="json"
    )

    assert response.status_code == 200
    membership.refresh_from_db()
    assert membership.can_edit_listings is True
    assert membership.can_manage_team is True
    assert membership.can_read_messages is True


@pytest.fixture
def broker_with_admin_and_manager(broker_with_admin):
    """A MANAGER who legitimately holds can_manage_team - the escalation starting point."""
    broker, admin = broker_with_admin
    manager = make_user("teammanager@example.com", role=UserRole.BROKER)
    manager_membership = make_membership(
        manager,
        broker,
        role=BrokerMembershipRole.MANAGER,
        can_edit_listings=True,
        can_manage_team=True,
        can_read_messages=True,
    )
    return broker, admin, manager, manager_membership


@pytest.mark.django_db
def test_a_manager_cannot_promote_themselves_to_admin(api, broker_with_admin_and_manager):
    """Organization takeover, step 1. Must be refused.

    A MANAGER with can_manage_team=True passes IsBrokerTeamManager, so without an
    explicit rank + self-edit check they could PATCH their own row to ADMIN, have
    save() grant every flag, and then remove the real ADMIN.
    """
    broker, _admin, manager, manager_membership = broker_with_admin_and_manager
    _authenticate(api, manager)

    response = api.patch(
        member_url(broker, manager_membership),
        {"role": BrokerMembershipRole.ADMIN},
        format="json",
    )

    assert response.status_code == 400
    assert response.data["error"]["fields"]["role"] == ["cannot_change_own_broker_role"]
    manager_membership.refresh_from_db()
    assert manager_membership.role == BrokerMembershipRole.MANAGER


@pytest.mark.django_db
def test_a_manager_cannot_grant_admin_to_a_third_party(api, broker_with_admin_and_manager):
    """Organization takeover via a confederate. Also refused."""
    broker, _admin, manager, _mm = broker_with_admin_and_manager
    agent = make_user("confederate@example.com", role=UserRole.BROKER)
    agent_membership = make_membership(agent, broker, role=BrokerMembershipRole.AGENT)
    _authenticate(api, manager)

    response = api.patch(
        member_url(broker, agent_membership),
        {"role": BrokerMembershipRole.ADMIN},
        format="json",
    )

    assert response.status_code == 400
    assert response.data["error"]["fields"]["role"] == [
        "broker_admin_grant_requires_admin"
    ]
    agent_membership.refresh_from_db()
    assert agent_membership.role == BrokerMembershipRole.AGENT
    assert agent_membership.can_manage_team is False


@pytest.mark.django_db
def test_an_admin_can_grant_admin_to_a_third_party(api, broker_with_admin_and_manager):
    """The same request, from an actual ADMIN, must succeed."""
    broker, admin, _manager, _mm = broker_with_admin_and_manager
    agent = make_user("deputy@example.com", role=UserRole.BROKER)
    agent_membership = make_membership(agent, broker, role=BrokerMembershipRole.AGENT)
    _authenticate(api, admin)

    response = api.patch(
        member_url(broker, agent_membership),
        {"role": BrokerMembershipRole.ADMIN},
        format="json",
    )

    assert response.status_code == 200
    agent_membership.refresh_from_db()
    assert agent_membership.role == BrokerMembershipRole.ADMIN
    assert agent_membership.can_manage_team is True


@pytest.mark.django_db
def test_a_manager_cannot_hand_out_can_manage_team(api, broker_with_admin_and_manager):
    """can_manage_team is ADMIN-equivalent authority; granting it needs ADMIN."""
    broker, _admin, manager, _mm = broker_with_admin_and_manager
    agent = make_user("wannabe@example.com", role=UserRole.BROKER)
    agent_membership = make_membership(agent, broker, role=BrokerMembershipRole.AGENT)
    _authenticate(api, manager)

    response = api.patch(
        member_url(broker, agent_membership), {"can_manage_team": True}, format="json"
    )

    assert response.status_code == 400
    # The rejection is keyed under the field that carried the grant, not `role`:
    # this request never mentioned `role`.
    assert response.data["error"]["fields"]["can_manage_team"] == [
        "broker_admin_grant_requires_admin"
    ]
    agent_membership.refresh_from_db()
    assert agent_membership.can_manage_team is False


@pytest.mark.django_db
def test_a_manager_cannot_create_an_admin_membership(api, broker_with_admin_and_manager):
    """The same rank rule applies on the create path, not just on update."""
    broker, _admin, manager, _mm = broker_with_admin_and_manager
    make_user("freshadmin@example.com", role=UserRole.BROKER)
    _authenticate(api, manager)

    response = api.post(
        members_url(broker),
        {"user_email": "freshadmin@example.com", "role": BrokerMembershipRole.ADMIN},
        format="json",
    )

    assert response.status_code == 400
    assert response.data["error"]["fields"]["role"] == [
        "broker_admin_grant_requires_admin"
    ]
    assert not BrokerMembership.objects.filter(
        broker=broker, user__email="freshadmin@example.com"
    ).exists()


@pytest.mark.django_db
def test_even_an_admin_cannot_edit_their_own_role(api, broker_with_admin):
    """Rule (b) has no rank exemption: role changes are done TO you, not BY you."""
    broker, admin = broker_with_admin
    membership = BrokerMembership.objects.get(user=admin, broker=broker)
    _authenticate(api, admin)

    response = api.patch(
        member_url(broker, membership),
        {"role": BrokerMembershipRole.MANAGER},
        format="json",
    )

    assert response.status_code == 400
    assert response.data["error"]["fields"]["role"] == ["cannot_change_own_broker_role"]


@pytest.mark.django_db
def test_demoting_through_the_api_revokes_can_manage_team(api, broker_with_admin_and_manager):
    """The demotion half of the ADMIN rule, end to end through the endpoint."""
    broker, admin, _manager, _mm = broker_with_admin_and_manager
    deputy = make_user("deputy2@example.com", role=UserRole.BROKER)
    deputy_membership = make_membership(deputy, broker, role=BrokerMembershipRole.ADMIN)
    _authenticate(api, admin)

    response = api.patch(
        member_url(broker, deputy_membership),
        {"role": BrokerMembershipRole.VIEWER},
        format="json",
    )

    assert response.status_code == 200
    deputy_membership.refresh_from_db()
    assert deputy_membership.role == BrokerMembershipRole.VIEWER
    assert deputy_membership.can_manage_team is False
    assert deputy_membership.can_edit_listings is False
    assert deputy_membership.can_read_messages is False


@pytest.mark.django_db
def test_a_role_change_and_a_flag_change_cannot_share_one_request(
    api, broker_with_admin_and_manager
):
    broker, admin, _manager, _mm = broker_with_admin_and_manager
    agent = make_user("combo@example.com", role=UserRole.BROKER)
    agent_membership = make_membership(agent, broker, role=BrokerMembershipRole.AGENT)
    _authenticate(api, admin)

    response = api.patch(
        member_url(broker, agent_membership),
        {"role": BrokerMembershipRole.VIEWER, "can_read_messages": True},
        format="json",
    )

    assert response.status_code == 400
    assert response.data["error"]["fields"]["can_read_messages"] == [
        "set_flags_in_a_separate_request"
    ]


@pytest.mark.django_db
def test_the_last_active_admin_cannot_be_demoted(api, broker_with_admin):
    """Driven by a STAFF admin, deliberately.

    The broker's own admin cannot demote themselves at all (rule (b) rejects it
    with `cannot_change_own_broker_role` before the count is ever reached), so a
    third party who legitimately outranks them is what actually exercises the
    last-admin guard.
    """
    broker, admin = broker_with_admin
    membership = BrokerMembership.objects.get(user=admin, broker=broker)
    staff_admin = make_user("lastadmin.staff@example.com", role=UserRole.STAFF)
    staff_admin.groups.add(Group.objects.get(name=StaffGroup.ADMIN))
    _authenticate(api, staff_admin)

    response = api.patch(
        member_url(broker, membership), {"role": BrokerMembershipRole.AGENT}, format="json"
    )

    assert response.status_code == 400
    assert response.data["error"]["fields"]["role"] == ["last_broker_admin"]
    membership.refresh_from_db()
    assert membership.role == BrokerMembershipRole.ADMIN


@pytest.mark.django_db
def test_the_last_active_admin_cannot_be_deactivated(api, broker_with_admin):
    """Leaving the team yourself IS allowed (is_active is not an elevated field) -
    but not when it would leave the organization with zero admins."""
    broker, admin = broker_with_admin
    membership = BrokerMembership.objects.get(user=admin, broker=broker)
    _authenticate(api, admin)

    response = api.delete(member_url(broker, membership))

    assert response.status_code == 400
    assert response.data["error"]["fields"]["is_active"] == ["last_broker_admin"]


@pytest.mark.django_db
def test_deleting_a_member_deactivates_rather_than_destroys(api, broker_with_admin):
    broker, admin = broker_with_admin
    agent = make_user("bye@example.com", role=UserRole.BROKER)
    membership = make_membership(agent, broker, can_edit_listings=True)
    _authenticate(api, admin)

    response = api.delete(member_url(broker, membership))

    assert response.status_code == 204
    membership.refresh_from_db()
    assert membership.is_active is False


@pytest.mark.django_db
def test_a_membership_of_another_broker_cannot_be_reached_through_this_broker(api, broker_with_admin):
    broker, admin = broker_with_admin
    other_broker = make_broker(name="Elsewhere", slug="elsewhere")
    victim = make_user("victim@example.com", role=UserRole.BROKER)
    foreign = make_membership(victim, other_broker, can_edit_listings=True)
    _authenticate(api, admin)

    response = api.patch(
        f"/api/v1/brokers/{broker.pk}/members/{foreign.pk}/",
        {"can_edit_listings": False},
        format="json",
    )

    assert response.status_code == 404
    foreign.refresh_from_db()
    assert foreign.can_edit_listings is True


@pytest.mark.django_db
def test_a_suspended_broker_cannot_have_its_team_changed(api):
    broker = make_broker(status=BrokerOrganizationStatus.SUSPENDED)
    admin = make_user("suspadmin@example.com", role=UserRole.BROKER)
    make_membership(admin, broker, role=BrokerMembershipRole.ADMIN)
    _authenticate(api, admin)

    assert api.get(members_url(broker)).status_code == 403


@pytest.mark.django_db
def test_a_staff_admin_can_manage_any_brokers_team(api, broker_with_admin):
    broker, _ = broker_with_admin

    staff_admin = make_user("platformadmin@example.com", role=UserRole.STAFF)
    staff_admin.groups.add(Group.objects.get(name=StaffGroup.ADMIN))
    _authenticate(api, staff_admin)

    assert api.get(members_url(broker)).status_code == 200


@pytest.mark.django_db
def test_an_unverified_team_manager_is_rejected(api):
    broker = make_broker()
    admin = make_user("unvadmin@example.com", role=UserRole.BROKER, verified=False)
    make_membership(admin, broker, role=BrokerMembershipRole.ADMIN)
    _authenticate(api, admin)

    response = api.get(members_url(broker))

    assert response.status_code == 403
    assert response.data["error"]["code"] == "email_not_verified"


@pytest.mark.django_db
def test_a_manager_cannot_create_a_membership_holding_can_manage_team(
    api, broker_with_admin_and_manager
):
    """The can_manage_team branch of the rank rule on the CREATE path.

    The brief pins the role=ADMIN branch of create; this pins the other one, so
    minting an ADMIN-equivalent peer is closed on both paths and both fields.
    """
    broker, _admin, manager, _mm = broker_with_admin_and_manager
    make_user("freshmanager@example.com", role=UserRole.BROKER)
    _authenticate(api, manager)

    response = api.post(
        members_url(broker),
        {"user_email": "freshmanager@example.com", "can_manage_team": True},
        format="json",
    )

    assert response.status_code == 400
    assert response.data["error"]["fields"]["can_manage_team"] == [
        "broker_admin_grant_requires_admin"
    ]
    assert not BrokerMembership.objects.filter(
        broker=broker, user__email="freshmanager@example.com"
    ).exists()


@pytest.mark.django_db
def test_a_manager_cannot_touch_an_admins_membership_even_for_an_unrelated_flag(
    api, broker_with_admin_and_manager
):
    """The post-patch evaluation, pinned.

    A PATCH that omits `role`/`can_manage_team` keeps the target's existing
    values, so a membership that CURRENTLY holds ADMIN authority stays out of a
    MANAGER's reach whatever field the request carries.
    """
    broker, admin, manager, _mm = broker_with_admin_and_manager
    admin_membership = BrokerMembership.objects.get(user=admin, broker=broker)
    _authenticate(api, manager)

    response = api.patch(
        member_url(broker, admin_membership), {"can_edit_listings": False}, format="json"
    )

    assert response.status_code == 400
    assert response.data["error"]["fields"]["role"] == [
        "broker_admin_grant_requires_admin"
    ]
    admin_membership.refresh_from_db()
    assert admin_membership.can_edit_listings is True


@pytest.mark.django_db
def test_a_manager_cannot_deactivate_the_brokers_admin(api, broker_with_admin_and_manager):
    """Organization takeover, step 2 - reached even without step 1 succeeding.

    Removing the real ADMIN is the payoff of the escalation chain, so the DELETE
    path must refuse it independently of whether the attacker ever got promoted.
    """
    broker, admin, manager, _mm = broker_with_admin_and_manager
    admin_membership = BrokerMembership.objects.get(user=admin, broker=broker)
    _authenticate(api, manager)

    response = api.delete(member_url(broker, admin_membership))

    assert response.status_code == 400
    assert response.data["error"]["fields"]["role"] == [
        "broker_admin_grant_requires_admin"
    ]
    admin_membership.refresh_from_db()
    assert admin_membership.is_active is True


@pytest.mark.django_db
def test_a_role_change_bundled_with_is_active_cannot_dodge_the_last_admin_guard(
    api, broker_with_admin
):
    """`is_active` is not an elevated field, so it MAY share a request with `role`.

    That makes it the one remaining way to reach the last-admin guard with two
    moving parts at once; the guard must still count the post-patch state.
    """
    broker, admin = broker_with_admin
    membership = BrokerMembership.objects.get(user=admin, broker=broker)
    staff_admin = make_user("bundle.staff@example.com", role=UserRole.STAFF)
    staff_admin.groups.add(Group.objects.get(name=StaffGroup.ADMIN))
    _authenticate(api, staff_admin)

    response = api.patch(
        member_url(broker, membership),
        {"role": BrokerMembershipRole.AGENT, "is_active": False},
        format="json",
    )

    assert response.status_code == 400
    assert response.data["error"]["fields"]["role"] == ["last_broker_admin"]
    membership.refresh_from_db()
    assert membership.role == BrokerMembershipRole.ADMIN
    assert membership.is_active is True


@pytest.mark.django_db
def test_the_write_serializers_refuse_to_run_without_an_actor_in_context(broker_with_admin):
    """A missing `actor` must fail loudly rather than skip the rank checks."""
    broker, admin = broker_with_admin
    membership = BrokerMembership.objects.get(user=admin, broker=broker)
    make_user("contextless@example.com", role=UserRole.BROKER)

    create_serializer = BrokerMembershipCreateSerializer(
        data={"user_email": "contextless@example.com", "role": BrokerMembershipRole.ADMIN},
        context={"broker": broker},
    )
    with pytest.raises(KeyError):
        create_serializer.is_valid(raise_exception=True)

    update_serializer = BrokerMembershipUpdateSerializer(
        membership, data={"role": BrokerMembershipRole.VIEWER}, partial=True, context={}
    )
    with pytest.raises(KeyError):
        update_serializer.is_valid(raise_exception=True)
