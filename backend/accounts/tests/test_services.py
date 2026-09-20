import pytest
from django.contrib.auth.models import AnonymousUser, Group
from rest_framework.exceptions import PermissionDenied

from accounts.enums import SellerType, StaffGroup, UserRole
from accounts.services import (
    active_broker_membership,
    can_edit_owned_object,
    can_manage_broker_team,
    can_read_broker_messages,
    has_any_broker_edit_membership,
    is_staff_admin,
    is_staff_moderator,
    resolve_seller_context,
)
from accounts.tests.factories import make_user
from brokers.enums import BrokerMembershipRole, BrokerOrganizationStatus
from brokers.tests.factories import make_broker, make_membership

#: Django model permissions that would let their holder mint a broker ADMIN
#: membership row directly - i.e. escalate themselves into an organization.
MEMBERSHIP_WRITE_PERMISSIONS = frozenset(
    {
        "brokers.add_brokermembership",
        "brokers.change_brokermembership",
        "brokers.delete_brokermembership",
    }
)


def _in_group(user, name):
    user.groups.add(Group.objects.get(name=name))
    return user


def _group_permission_labels(name):
    group = Group.objects.get(name=name)
    return {
        f"{permission.content_type.app_label}.{permission.codename}"
        for permission in group.permissions.select_related("content_type")
    }


@pytest.mark.django_db
def test_staff_tiers_come_from_groups_not_from_primary_role():
    plain_staff = make_user("plain@example.com", role=UserRole.STAFF)
    assert is_staff_moderator(plain_staff) is False
    assert is_staff_admin(plain_staff) is False

    moderator = _in_group(make_user("mod@example.com", role=UserRole.STAFF), StaffGroup.MODERATOR)
    assert is_staff_moderator(moderator) is True
    assert is_staff_admin(moderator) is False

    admin = _in_group(make_user("adm@example.com", role=UserRole.STAFF), StaffGroup.ADMIN)
    assert is_staff_admin(admin) is True
    assert is_staff_moderator(admin) is True


@pytest.mark.django_db
def test_a_buyer_in_a_staff_group_is_not_staff():
    """The group is additive on top of the STAFF primary role, never a substitute for it."""
    impostor = _in_group(make_user("impostor@example.com", role=UserRole.PRIVATE_SELLER), StaffGroup.ADMIN)
    assert is_staff_admin(impostor) is False
    assert is_staff_moderator(impostor) is False


@pytest.mark.django_db
def test_a_superuser_is_a_staff_admin():
    root = make_user("root@example.com", role=UserRole.STAFF, is_superuser=True, is_staff=True)
    assert is_staff_admin(root) is True


@pytest.mark.django_db
def test_an_inactive_staff_admin_has_no_authority():
    admin = _in_group(
        make_user("gone@example.com", role=UserRole.STAFF, is_active=False), StaffGroup.ADMIN
    )
    assert is_staff_admin(admin) is False


@pytest.mark.django_db
def test_the_staff_groups_migration_grants_no_django_model_permissions():
    """Neither staff group may hold BrokerMembership write permissions.

    accounts.0003_staff_groups creates the two groups as bare tier markers: the
    authorization services above are the only thing that reads them. A future
    migration that attached brokers.add/change/delete_brokermembership to
    staff_moderator would hand a moderator the Django admin's membership editor
    and, with it, the ability to mint themselves a broker ADMIN row - the exact
    privilege-escalation path Task 9's actor-vs-target rank check exists to close.
    This test fails the moment either group gains any model permission at all.
    """
    for name in (StaffGroup.MODERATOR, StaffGroup.ADMIN):
        labels = _group_permission_labels(name)
        assert labels == set(), f"{name} unexpectedly holds Django permissions: {sorted(labels)}"
        assert MEMBERSHIP_WRITE_PERMISSIONS.isdisjoint(labels)


@pytest.mark.django_db
def test_active_membership_requires_an_active_broker_and_an_active_membership():
    user = make_user("agent@example.com", role=UserRole.BROKER)
    active = make_broker()
    make_membership(user, active, can_edit_listings=True)
    assert active_broker_membership(user, active.pk) is not None

    suspended = make_broker(
        name="Suspended", slug="suspended", status=BrokerOrganizationStatus.SUSPENDED
    )
    make_membership(user, suspended, can_edit_listings=True)
    assert active_broker_membership(user, suspended.pk) is None

    revoked_broker = make_broker(name="Revoked", slug="revoked")
    make_membership(user, revoked_broker, can_edit_listings=True, is_active=False)
    assert active_broker_membership(user, revoked_broker.pk) is None


@pytest.mark.django_db
def test_an_owner_can_edit_their_own_object():
    owner = make_user("owner@example.com", role=UserRole.PRIVATE_SELLER)
    assert can_edit_owned_object(owner, owner_user_id=owner.pk, broker_id=None) is True


@pytest.mark.django_db
def test_a_different_user_cannot_edit_someone_elses_object():
    owner = make_user("mine@example.com", role=UserRole.PRIVATE_SELLER)
    stranger = make_user("yours@example.com", role=UserRole.PRIVATE_SELLER)
    assert can_edit_owned_object(stranger, owner_user_id=owner.pk, broker_id=None) is False


@pytest.mark.django_db
def test_a_broker_agent_cannot_edit_another_brokers_object():
    """Spec 12 acceptance test: 'A broker agent cannot edit another broker's listing.'"""
    agent = make_user("agent-a@example.com", role=UserRole.BROKER)
    broker_a = make_broker(name="Broker A", slug="broker-a")
    broker_b = make_broker(name="Broker B", slug="broker-b")
    make_membership(agent, broker_a, role=BrokerMembershipRole.AGENT, can_edit_listings=True)

    assert can_edit_owned_object(agent, owner_user_id=None, broker_id=broker_a.pk) is True
    assert can_edit_owned_object(agent, owner_user_id=None, broker_id=broker_b.pk) is False


@pytest.mark.django_db
def test_a_viewer_membership_cannot_edit():
    viewer = make_user("viewer@example.com", role=UserRole.BROKER)
    broker = make_broker()
    make_membership(viewer, broker, role=BrokerMembershipRole.VIEWER, can_edit_listings=False)
    assert can_edit_owned_object(viewer, owner_user_id=None, broker_id=broker.pk) is False


@pytest.mark.django_db
def test_a_broker_admin_membership_can_always_edit():
    admin = make_user("badmin@example.com", role=UserRole.BROKER)
    broker = make_broker()
    make_membership(admin, broker, role=BrokerMembershipRole.ADMIN)
    assert can_edit_owned_object(admin, owner_user_id=None, broker_id=broker.pk) is True
    assert has_any_broker_edit_membership(admin) is True


@pytest.mark.django_db
def test_a_staff_admin_can_edit_on_behalf_but_a_moderator_cannot():
    owner = make_user("target@example.com", role=UserRole.PRIVATE_SELLER)
    admin = _in_group(make_user("sa@example.com", role=UserRole.STAFF), StaffGroup.ADMIN)
    moderator = _in_group(make_user("sm@example.com", role=UserRole.STAFF), StaffGroup.MODERATOR)

    assert can_edit_owned_object(admin, owner_user_id=owner.pk, broker_id=None) is True
    assert can_edit_owned_object(moderator, owner_user_id=owner.pk, broker_id=None) is False


@pytest.mark.django_db
def test_ownership_survives_a_string_uuid_arriving_from_the_request_layer():
    """Regression: comparing a str UUID to a UUID pk with == is always False.

    owner_user_id is a plain identifier, so it can reach this function as a
    string - a URL path kwarg before DRF coerces it, or a JSON-decoded request
    body. Untyped, the real owner of their own listing would be denied edit
    access. Both sides are normalised to str before comparing.
    """
    owner = make_user("strpk@example.com", role=UserRole.PRIVATE_SELLER)
    stranger = make_user("strother@example.com", role=UserRole.PRIVATE_SELLER)

    assert can_edit_owned_object(owner, owner_user_id=str(owner.pk), broker_id=None) is True
    # ...and a non-matching string is still refused, in both directions.
    assert can_edit_owned_object(stranger, owner_user_id=str(owner.pk), broker_id=None) is False
    assert can_edit_owned_object(owner, owner_user_id=str(stranger.pk), broker_id=None) is False


@pytest.mark.django_db
def test_an_inactive_user_can_edit_nothing():
    owner = make_user("frozen@example.com", role=UserRole.PRIVATE_SELLER, is_active=False)
    assert can_edit_owned_object(owner, owner_user_id=owner.pk, broker_id=None) is False


@pytest.mark.django_db
def test_an_anonymous_user_can_edit_nothing():
    assert can_edit_owned_object(AnonymousUser(), owner_user_id=None, broker_id=None) is False
    assert can_edit_owned_object(None, owner_user_id=None, broker_id=None) is False


@pytest.mark.django_db
def test_message_reading_needs_the_can_read_messages_flag():
    reader = make_user("reader@example.com", role=UserRole.BROKER)
    silent = make_user("silent@example.com", role=UserRole.BROKER)
    broker = make_broker()
    make_membership(reader, broker, can_read_messages=True)
    make_membership(silent, broker, can_read_messages=False)

    assert can_read_broker_messages(reader, broker.pk) is True
    assert can_read_broker_messages(silent, broker.pk) is False


@pytest.mark.django_db
def test_team_management_needs_the_can_manage_team_flag():
    """can_manage_broker_team is the primitive Task 9's promotion guard builds on."""
    manager = make_user("tm@example.com", role=UserRole.BROKER)
    agent = make_user("ta@example.com", role=UserRole.BROKER)
    broker = make_broker()
    make_membership(manager, broker, role=BrokerMembershipRole.MANAGER, can_manage_team=True)
    make_membership(agent, broker, role=BrokerMembershipRole.AGENT, can_edit_listings=True)

    assert can_manage_broker_team(manager, broker.pk) is True
    assert can_manage_broker_team(agent, broker.pk) is False


@pytest.mark.django_db
def test_a_suspended_broker_revokes_every_routed_capability():
    """Spec 12 item 5: suspending the organization removes all three capabilities."""
    admin = make_user("allcaps@example.com", role=UserRole.BROKER)
    broker = make_broker()
    make_membership(admin, broker, role=BrokerMembershipRole.ADMIN)
    assert can_edit_owned_object(admin, owner_user_id=None, broker_id=broker.pk) is True
    assert can_manage_broker_team(admin, broker.pk) is True
    assert can_read_broker_messages(admin, broker.pk) is True

    broker.status = BrokerOrganizationStatus.SUSPENDED
    broker.save(update_fields=["status", "updated_at"])

    assert can_edit_owned_object(admin, owner_user_id=None, broker_id=broker.pk) is False
    assert can_manage_broker_team(admin, broker.pk) is False
    assert can_read_broker_messages(admin, broker.pk) is False
    assert has_any_broker_edit_membership(admin) is False


@pytest.mark.django_db
def test_a_private_seller_resolves_to_a_private_seller_context():
    seller = make_user("ps@example.com", role=UserRole.PRIVATE_SELLER)
    context = resolve_seller_context(seller)
    assert context.seller_type == SellerType.PRIVATE
    assert context.owner_user == seller
    assert context.broker is None


@pytest.mark.django_db
def test_a_private_seller_cannot_forge_a_broker_context():
    """Spec 12 acceptance test: a private seller cannot send seller_type=BROKER."""
    seller = make_user("forge@example.com", role=UserRole.PRIVATE_SELLER)
    broker = make_broker()
    with pytest.raises(PermissionDenied) as exc_info:
        resolve_seller_context(seller, broker_id=broker.pk)
    assert exc_info.value.detail.code == "broker_listing_not_allowed"


@pytest.mark.django_db
def test_a_professional_cannot_resolve_a_private_seller_context():
    buyer = make_user("pro@example.com", role=UserRole.PROFESSIONAL)
    with pytest.raises(PermissionDenied) as exc_info:
        resolve_seller_context(buyer)
    assert exc_info.value.detail.code == "private_listing_not_allowed"


@pytest.mark.django_db
def test_an_unverified_user_cannot_resolve_any_seller_context():
    seller = make_user("unv@example.com", role=UserRole.PRIVATE_SELLER, verified=False)
    with pytest.raises(PermissionDenied) as exc_info:
        resolve_seller_context(seller)
    assert exc_info.value.detail.code == "email_not_verified"


@pytest.mark.django_db
def test_a_broker_editor_resolves_to_a_broker_context():
    agent = make_user("ba@example.com", role=UserRole.BROKER)
    broker = make_broker()
    make_membership(agent, broker, can_edit_listings=True)

    context = resolve_seller_context(agent, broker_id=broker.pk)

    assert context.seller_type == SellerType.BROKER
    assert context.broker == broker
    assert context.owner_user is None


@pytest.mark.django_db
def test_a_suspended_broker_cannot_be_used_as_a_seller_context():
    """Spec 12 item 5: suspended organizations cannot create or submit."""
    agent = make_user("susp@example.com", role=UserRole.BROKER)
    broker = make_broker(status=BrokerOrganizationStatus.SUSPENDED)
    make_membership(agent, broker, can_edit_listings=True)
    with pytest.raises(PermissionDenied):
        resolve_seller_context(agent, broker_id=broker.pk)
