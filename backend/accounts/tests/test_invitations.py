import pytest
from django.core import mail
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.enums import UserRole
from accounts.invitations import create_invitation
from accounts.models import OrganizationInvitation, User
from accounts.tests.factories import make_user
from professionals.models import ProfessionalMembership
from professionals.tests.factories import make_professional

pytestmark = pytest.mark.django_db

GOOD_PASSWORD = "Str0ng-Invite-Pass!"


def _client(user=None):
    api = APIClient()
    if user is not None:
        api.force_authenticate(user)
    return api


@pytest.fixture
def org():
    owner = make_user("owner@pro.example", role=UserRole.PROFESSIONAL, verified=True)
    return owner, make_professional(owner)


def _invite(owner, email="new@pro.example", role="AGENT"):
    res = _client(owner).post(reverse("provider-invitations"), {"email": email, "role": role}, format="json")
    return res


def _token_from_mail():
    body = mail.outbox[-1].body
    return body.split("token=")[1].split()[0]


def test_invitation_email_is_sent_and_lists_as_pending(org, django_capture_on_commit_callbacks):
    owner, _ = org
    with django_capture_on_commit_callbacks(execute=True):
        res = _invite(owner)
    assert res.status_code == 201
    assert mail.outbox and "token=" in mail.outbox[-1].body
    pending = _client(owner).get(reverse("provider-invitations")).json()
    assert [row["email"] for row in pending] == ["new@pro.example"]
    assert "token_hash" not in pending[0]


def test_new_address_registers_straight_into_the_role(org, django_capture_on_commit_callbacks):
    owner, profile = org
    with django_capture_on_commit_callbacks(execute=True):
        _invite(owner, role="MANAGER")
    token = _token_from_mail()
    preview = _client().post(reverse("invitation-preview"), {"token": token}, format="json").json()
    assert preview["account_exists"] is False and preview["role"] == "MANAGER"

    res = _client().post(
        reverse("invitation-accept"),
        {"token": token, "password": GOOD_PASSWORD, "full_name": "Mia Rossi"},
        format="json",
    )
    assert res.status_code == 201
    user = User.objects.get(email="new@pro.example")
    assert user.primary_role == UserRole.PROFESSIONAL
    assert user.is_email_verified
    seat = ProfessionalMembership.objects.get(user=user)
    assert (seat.profile, seat.role, seat.can_edit_profile, seat.can_manage_team, seat.can_read_messages) == (
        profile, "MANAGER", True, False, True,
    )


def test_a_token_works_once(org, django_capture_on_commit_callbacks):
    owner, _ = org
    with django_capture_on_commit_callbacks(execute=True):
        _invite(owner)
    token = _token_from_mail()
    body = {"token": token, "password": GOOD_PASSWORD, "full_name": "A"}
    assert _client().post(reverse("invitation-accept"), body, format="json").status_code == 201
    assert _client().post(reverse("invitation-accept"), body, format="json").status_code == 400


def test_existing_private_seller_must_sign_in_then_the_role_changes(org, django_capture_on_commit_callbacks):
    owner, profile = org
    seller = make_user("seller@x.example", role=UserRole.PRIVATE_SELLER, verified=True)
    with django_capture_on_commit_callbacks(execute=True):
        _invite(owner, email="seller@x.example", role="AGENT")
    token = _token_from_mail()
    assert _client().post(reverse("invitation-accept"), {"token": token}, format="json").status_code in (401, 403)
    other = make_user("other@x.example", role=UserRole.PRIVATE_SELLER, verified=True)
    assert _client(other).post(reverse("invitation-accept"), {"token": token}, format="json").status_code == 403

    res = _client(seller).post(reverse("invitation-accept"), {"token": token}, format="json")
    assert res.status_code == 201
    seller.refresh_from_db()
    assert seller.primary_role == UserRole.PROFESSIONAL
    assert ProfessionalMembership.objects.get(user=seller).profile == profile


def test_cannot_invite_someone_who_already_has_a_seat(org):
    owner, profile = org
    member = make_user("m@pro.example", role=UserRole.PROFESSIONAL, verified=True)
    ProfessionalMembership.objects.create(user=member, profile=profile, role="AGENT")
    assert _invite(owner, email="m@pro.example").status_code == 400


def test_staff_accounts_are_not_invitable(org):
    owner, _ = org
    make_user("staff@x.example", role=UserRole.STAFF, verified=True)
    assert _invite(owner, email="staff@x.example").status_code == 400


def test_only_team_managers_invite_and_only_admins_invite_admins(org):
    owner, profile = org
    viewer = make_user("v@pro.example", role=UserRole.PROFESSIONAL, verified=True)
    ProfessionalMembership.objects.create(user=viewer, profile=profile, role="VIEWER")
    assert _invite(viewer).status_code == 403
    manager = make_user("mgr@pro.example", role=UserRole.PROFESSIONAL, verified=True)
    seat = ProfessionalMembership.objects.create(user=manager, profile=profile, role="MANAGER")
    ProfessionalMembership.objects.filter(pk=seat.pk).update(can_manage_team=True)
    assert _invite(manager, role="ADMIN").status_code == 403
    assert _invite(manager, role="AGENT").status_code == 201


def test_reinviting_replaces_the_old_invitation_and_revoke_works(org):
    owner, _ = org
    _invite(owner)
    _invite(owner)
    rows = _client(owner).get(reverse("provider-invitations")).json()
    assert len(rows) == 1
    url = reverse("provider-invitation-detail", args=[rows[0]["id"]])
    assert _client(owner).delete(url).status_code == 204
    assert _client(owner).get(reverse("provider-invitations")).json() == []


def test_expired_and_revoked_tokens_are_refused(org):
    owner, profile = org
    invitation, raw = create_invitation(actor=owner, org_type=UserRole.PROFESSIONAL, org=profile, email="e@x.example", role="AGENT")
    body = {"token": raw, "password": GOOD_PASSWORD, "full_name": "E"}
    OrganizationInvitation.objects.filter(pk=invitation.pk).update(expires_at="2000-01-01T00:00:00Z")
    assert _client().post(reverse("invitation-accept"), body, format="json").status_code == 400
    assert _client().post(reverse("invitation-preview"), {"token": "nonsense"}, format="json").status_code == 400


def test_removing_the_last_seat_returns_the_account_to_private_seller(org):
    owner, profile = org
    member = make_user("m@pro.example", role=UserRole.PROFESSIONAL, verified=True)
    seat = ProfessionalMembership.objects.create(user=member, profile=profile, role="AGENT")
    assert _client(owner).delete(reverse("provider-team-member", args=[seat.pk])).status_code == 204
    member.refresh_from_db()
    assert member.primary_role == UserRole.PRIVATE_SELLER


def test_broker_invitation_end_to_end(django_capture_on_commit_callbacks):
    from brokers.models import BrokerMembership
    from brokers.tests.factories import make_broker, make_membership

    admin = make_user("admin@br.example", role=UserRole.BROKER, verified=True)
    broker = make_broker()
    make_membership(admin, broker, role="ADMIN", can_edit_listings=True, can_manage_team=True, can_read_messages=True)
    api = _client(admin)
    with django_capture_on_commit_callbacks(execute=True):
        res = api.post(reverse("broker-invitations", args=[broker.pk]), {"email": "agent@br.example", "role": "AGENT"}, format="json")
    assert res.status_code == 201
    token = _token_from_mail()
    accepted = _client().post(
        reverse("invitation-accept"), {"token": token, "password": GOOD_PASSWORD, "full_name": "Ann Agent"}, format="json"
    )
    assert accepted.status_code == 201
    user = User.objects.get(email="agent@br.example")
    seat = BrokerMembership.objects.get(user=user)
    assert (user.primary_role, seat.broker, seat.role, seat.can_edit_listings, seat.can_manage_team) == (
        UserRole.BROKER, broker, "AGENT", True, False,
    )
    outsider = make_user("out@x.example", role=UserRole.BROKER, verified=True)
    assert _client(outsider).get(reverse("broker-invitations", args=[broker.pk])).status_code == 403
