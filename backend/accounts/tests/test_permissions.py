from types import SimpleNamespace

import pytest
from django.contrib.auth.models import AnonymousUser, Group
from rest_framework.test import APIRequestFactory

from accounts.enums import StaffGroup, UserRole
from accounts.permissions import (
    CanReadBrokerMessages,
    IsActiveUser,
    IsBrokerTeamManager,
    IsEmailVerified,
    IsOwnerOrBrokerEditor,
    IsStaffAdmin,
    IsStaffModerator,
)
from accounts.tests.factories import make_user
from brokers.enums import BrokerMembershipRole
from brokers.tests.factories import make_broker, make_membership


def _request(user, method="get"):
    request = getattr(APIRequestFactory(), method)("/api/v1/whatever/")
    request.user = user
    return request


@pytest.mark.django_db
def test_is_active_user_rejects_anonymous_and_inactive():
    assert IsActiveUser().has_permission(_request(AnonymousUser()), None) is False
    inactive = make_user("x@example.com", is_active=False)
    assert IsActiveUser().has_permission(_request(inactive), None) is False
    assert IsActiveUser().has_permission(_request(make_user("y@example.com")), None) is True


@pytest.mark.django_db
def test_is_email_verified_gates_on_the_verification_timestamp():
    unverified = make_user("u@example.com", verified=False)
    verified = make_user("v@example.com", verified=True)
    assert IsEmailVerified().has_permission(_request(unverified), None) is False
    assert IsEmailVerified().has_permission(_request(verified), None) is True


@pytest.mark.django_db
def test_staff_permission_classes_follow_the_group_tiers():
    moderator = make_user("m@example.com", role=UserRole.STAFF)
    moderator.groups.add(Group.objects.get(name=StaffGroup.MODERATOR))
    admin = make_user("a@example.com", role=UserRole.STAFF)
    admin.groups.add(Group.objects.get(name=StaffGroup.ADMIN))

    assert IsStaffModerator().has_permission(_request(moderator), None) is True
    assert IsStaffAdmin().has_permission(_request(moderator), None) is False
    assert IsStaffModerator().has_permission(_request(admin), None) is True
    assert IsStaffAdmin().has_permission(_request(admin), None) is True


@pytest.mark.django_db
def test_object_permission_reads_owner_user_id_and_broker_id():
    owner = make_user("o@example.com", role=UserRole.PRIVATE_SELLER)
    stranger = make_user("s@example.com", role=UserRole.PRIVATE_SELLER)
    obj = SimpleNamespace(owner_user_id=owner.pk, broker_id=None)

    assert IsOwnerOrBrokerEditor().has_object_permission(_request(owner), None, obj) is True
    assert IsOwnerOrBrokerEditor().has_object_permission(_request(stranger), None, obj) is False


@pytest.mark.django_db
def test_object_permission_tolerates_an_object_missing_both_attributes():
    """Both attributes are optional on the protected model (getattr defaults to None)."""
    owner = make_user("bare@example.com", role=UserRole.PRIVATE_SELLER)
    assert (
        IsOwnerOrBrokerEditor().has_object_permission(_request(owner), None, SimpleNamespace())
        is False
    )


@pytest.mark.django_db
def test_object_permission_honours_broker_editor_membership():
    agent = make_user("ag@example.com", role=UserRole.BROKER)
    mine = make_broker(name="Mine", slug="mine")
    theirs = make_broker(name="Theirs", slug="theirs")
    make_membership(agent, mine, role=BrokerMembershipRole.AGENT, can_edit_listings=True)

    assert (
        IsOwnerOrBrokerEditor().has_object_permission(
            _request(agent), None, SimpleNamespace(owner_user_id=None, broker_id=mine.pk)
        )
        is True
    )
    assert (
        IsOwnerOrBrokerEditor().has_object_permission(
            _request(agent), None, SimpleNamespace(owner_user_id=None, broker_id=theirs.pk)
        )
        is False
    )


@pytest.mark.django_db
def test_broker_team_manager_permission_reads_the_view_kwarg():
    manager = make_user("mgr@example.com", role=UserRole.BROKER)
    agent = make_user("agt@example.com", role=UserRole.BROKER)
    broker = make_broker()
    make_membership(manager, broker, role=BrokerMembershipRole.MANAGER, can_manage_team=True)
    make_membership(agent, broker, role=BrokerMembershipRole.AGENT, can_edit_listings=True)
    view = SimpleNamespace(kwargs={"broker_id": str(broker.pk)})

    assert IsBrokerTeamManager().has_permission(_request(manager), view) is True
    assert IsBrokerTeamManager().has_permission(_request(agent), view) is False


@pytest.mark.django_db
def test_view_level_broker_permissions_deny_when_the_kwarg_is_absent():
    """A view wired up without the broker_id kwarg must fail closed, not open."""
    manager = make_user("nokwarg@example.com", role=UserRole.BROKER)
    broker = make_broker()
    make_membership(
        manager,
        broker,
        role=BrokerMembershipRole.MANAGER,
        can_manage_team=True,
        can_read_messages=True,
    )
    view = SimpleNamespace(kwargs={})

    assert IsBrokerTeamManager().has_permission(_request(manager), view) is False
    assert CanReadBrokerMessages().has_permission(_request(manager), view) is False


@pytest.mark.django_db
def test_message_reading_permission_keys_off_can_read_messages_not_can_edit_listings():
    """Phase 6 must use CanReadBrokerMessages, never IsOwnerOrBrokerEditor.

    The editor asserted here has can_edit_listings=True and can_read_messages=False:
    IsOwnerOrBrokerEditor would let them through, CanReadBrokerMessages must not.
    """
    reader = make_user("msgread@example.com", role=UserRole.BROKER)
    editor = make_user("msgedit@example.com", role=UserRole.BROKER)
    broker = make_broker()
    make_membership(reader, broker, role=BrokerMembershipRole.AGENT, can_read_messages=True)
    make_membership(editor, broker, role=BrokerMembershipRole.AGENT, can_edit_listings=True)
    view = SimpleNamespace(kwargs={"broker_id": str(broker.pk)})

    assert CanReadBrokerMessages().has_permission(_request(reader), view) is True
    assert CanReadBrokerMessages().has_permission(_request(editor), view) is False
    # And the class that would have been wrong here does let the editor through:
    assert (
        IsOwnerOrBrokerEditor().has_object_permission(
            _request(editor), None, SimpleNamespace(owner_user_id=None, broker_id=broker.pk)
        )
        is True
    )
    # The reader's own flags are the mirror image: no edit capability at all.
    assert (
        IsOwnerOrBrokerEditor().has_object_permission(
            _request(reader), None, SimpleNamespace(owner_user_id=None, broker_id=broker.pk)
        )
        is False
    )
