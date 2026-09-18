import uuid

import pytest
from django.db import IntegrityError, transaction

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from brokers.enums import (
    ROLE_DEFAULT_CAPABILITIES,
    BrokerMembershipRole,
    BrokerOrganizationStatus,
)
from brokers.models import BrokerOrganization
from brokers.tests.factories import make_broker, make_membership


@pytest.mark.django_db
def test_broker_defaults_to_draft_with_auto_approval_off():
    broker = BrokerOrganization.objects.create(
        name="Fresh Broker",
        slug="fresh-broker",
        public_email="a@b.example",
        public_phone="+34600000001",
    )
    assert isinstance(broker.pk, uuid.UUID)
    assert broker.status == BrokerOrganizationStatus.DRAFT
    assert broker.auto_approve_listings is False
    assert broker.auto_approve_changed_by is None
    assert broker.auto_approve_changed_at is None


@pytest.mark.django_db
def test_broker_slug_is_unique():
    make_broker()
    with pytest.raises(IntegrityError), transaction.atomic():
        make_broker(name="Another", slug="blue-marine-brokers")


@pytest.mark.django_db
def test_a_user_can_hold_only_one_membership_per_broker():
    user = make_user("member@example.com", role=UserRole.BROKER)
    broker = make_broker()
    make_membership(user, broker)
    with pytest.raises(IntegrityError), transaction.atomic():
        make_membership(user, broker, role=BrokerMembershipRole.MANAGER)


@pytest.mark.django_db
def test_the_admin_role_always_carries_every_membership_permission():
    user = make_user("brokeradmin@example.com", role=UserRole.BROKER)
    membership = make_membership(
        user, make_broker(), role=BrokerMembershipRole.ADMIN,
        can_edit_listings=False, can_manage_team=False, can_read_messages=False,
    )
    membership.refresh_from_db()
    assert membership.can_edit_listings is True
    assert membership.can_manage_team is True
    assert membership.can_read_messages is True


@pytest.mark.django_db
def test_demoting_an_admin_revokes_the_capability_flags_the_role_granted():
    """The symmetric half of the ADMIN rule: promotion grants, demotion revokes.

    Without this, a demoted admin keeps can_manage_team=True and can simply
    promote themselves back to ADMIN.
    """
    user = make_user("demoted@example.com", role=UserRole.BROKER)
    membership = make_membership(user, make_broker(), role=BrokerMembershipRole.ADMIN)
    membership.refresh_from_db()
    assert membership.can_manage_team is True

    membership.role = BrokerMembershipRole.VIEWER
    membership.save()

    membership.refresh_from_db()
    assert membership.role == BrokerMembershipRole.VIEWER
    assert membership.can_manage_team is False
    assert membership.can_edit_listings is False
    assert membership.can_read_messages is False


@pytest.mark.django_db
def test_demoting_an_admin_to_manager_applies_the_manager_defaults():
    user = make_user("demoted2@example.com", role=UserRole.BROKER)
    membership = make_membership(user, make_broker(), role=BrokerMembershipRole.ADMIN)

    membership.role = BrokerMembershipRole.MANAGER
    membership.save()

    membership.refresh_from_db()
    assert membership.can_manage_team is False  # the escalation-relevant flag
    assert membership.can_edit_listings is True
    assert membership.can_read_messages is True


@pytest.mark.django_db
def test_demoting_a_manager_revokes_a_separately_granted_can_manage_team():
    """The reset fires on ANY role change, not only on the way out of ADMIN.

    A MANAGER may legitimately have been granted can_manage_team=True by an
    ADMIN. Demoting them must not leave that grant standing at the lower rank.
    """
    user = make_user("demoted3@example.com", role=UserRole.BROKER)
    membership = make_membership(
        user,
        make_broker(),
        role=BrokerMembershipRole.MANAGER,
        can_edit_listings=True,
        can_manage_team=True,
        can_read_messages=True,
    )
    membership.refresh_from_db()
    assert membership.can_manage_team is True

    membership.role = BrokerMembershipRole.VIEWER
    membership.save()

    membership.refresh_from_db()
    expected = ROLE_DEFAULT_CAPABILITIES[BrokerMembershipRole.VIEWER]
    assert membership.role == BrokerMembershipRole.VIEWER
    assert expected == {
        "can_edit_listings": False,
        "can_manage_team": False,
        "can_read_messages": False,
    }
    for field, value in expected.items():
        assert getattr(membership, field) is value


@pytest.mark.django_db
def test_flags_stay_individually_tunable_within_a_role():
    """The reset is scoped to a role CHANGE, not applied on every save."""
    user = make_user("tunable@example.com", role=UserRole.BROKER)
    membership = make_membership(
        user, make_broker(), role=BrokerMembershipRole.AGENT, can_read_messages=False
    )

    membership.can_read_messages = True
    membership.save()

    membership.refresh_from_db()
    assert membership.role == BrokerMembershipRole.AGENT
    assert membership.can_read_messages is True


@pytest.mark.django_db
def test_a_partial_save_persists_the_new_role_alongside_the_flags_it_forced():
    """A role change saved with update_fields must persist the role itself.

    The capability flags are forced to match self.role, so persisting them
    without persisting the role writes a row whose flags belong to a rank the
    row does not hold - e.g. a VIEWER carrying can_manage_team=True. Task 9's
    role-change endpoint is exactly the kind of caller that passes
    update_fields, and it depends on this save() closing that gap.
    """
    user = make_user("partial@example.com", role=UserRole.BROKER)
    membership = make_membership(
        user, make_broker(), role=BrokerMembershipRole.VIEWER
    )

    membership.role = BrokerMembershipRole.ADMIN
    membership.save(update_fields=["is_active"])

    membership.refresh_from_db()
    assert membership.role == BrokerMembershipRole.ADMIN
    assert membership.can_edit_listings is True
    assert membership.can_manage_team is True
    assert membership.can_read_messages is True

    membership.role = BrokerMembershipRole.VIEWER
    membership.save(update_fields=["is_active"])

    membership.refresh_from_db()
    assert membership.role == BrokerMembershipRole.VIEWER
    assert membership.can_edit_listings is False
    assert membership.can_manage_team is False
    assert membership.can_read_messages is False


@pytest.mark.django_db
def test_an_admin_membership_cannot_be_stripped_of_permissions_behind_the_orm():
    user = make_user("strip@example.com", role=UserRole.BROKER)
    membership = make_membership(user, make_broker(), role=BrokerMembershipRole.ADMIN)
    with pytest.raises(IntegrityError), transaction.atomic():
        type(membership).objects.filter(pk=membership.pk).update(can_edit_listings=False)


@pytest.mark.django_db
def test_auto_approve_actor_requires_a_timestamp():
    staff = make_user("staff@example.com", role=UserRole.STAFF)
    broker = make_broker()
    with pytest.raises(IntegrityError), transaction.atomic():
        BrokerOrganization.objects.filter(pk=broker.pk).update(auto_approve_changed_by=staff)


@pytest.mark.django_db
def test_memberships_are_reachable_from_both_sides():
    user = make_user("both@example.com", role=UserRole.BROKER)
    broker = make_broker()
    make_membership(user, broker)
    assert user.broker_memberships.count() == 1
    assert broker.memberships.count() == 1
