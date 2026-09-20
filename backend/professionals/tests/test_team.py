import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from professionals.models import ProfessionalMembership
from professionals.tests.factories import make_professional

pytestmark = pytest.mark.django_db


def _client(user):
    api = APIClient()
    api.force_authenticate(user)
    return api


@pytest.fixture
def org():
    owner = make_user("owner@pro.example", role=UserRole.PROFESSIONAL, verified=True)
    profile = make_professional(owner)
    return owner, profile


def _add(profile, email, role="AGENT"):
    user = make_user(email, role=UserRole.PROFESSIONAL, verified=True)
    return ProfessionalMembership.objects.create(user=user, profile=profile, role=role)


def test_creating_a_profile_seats_the_owner_as_admin(org):
    owner, profile = org
    seat = ProfessionalMembership.objects.get(profile=profile, user=owner)
    assert (seat.role, seat.is_owner, seat.can_manage_team) == ("ADMIN", True, True)


def test_a_member_lists_the_team_but_cannot_change_it(org):
    _, profile = org
    agent = _add(profile, "agent@pro.example")
    api = _client(agent.user)
    assert len(api.get(reverse("provider-team")).json()) == 2
    url = reverse("provider-team-member", args=[agent.pk])
    assert api.patch(url, {"show_on_profile": False}, format="json").status_code == 403


def test_admin_changes_a_role_and_the_flags_reset(org):
    owner, profile = org
    manager = _add(profile, "m@pro.example", role="MANAGER")
    manager.can_manage_team = False
    api = _client(owner)
    url = reverse("provider-team-member", args=[manager.pk])
    res = api.patch(url, {"role": "VIEWER"}, format="json")
    assert res.status_code == 200
    assert res.json()["role"] == "VIEWER"
    assert res.json()["can_edit_profile"] is False


def test_the_owner_cannot_be_demoted_or_removed(org):
    owner, profile = org
    other_admin = _add(profile, "a2@pro.example", role="ADMIN")
    seat = ProfessionalMembership.objects.get(user=owner)
    api = _client(other_admin.user)
    url = reverse("provider-team-member", args=[seat.pk])
    assert api.patch(url, {"role": "VIEWER"}, format="json").status_code == 400
    assert api.delete(url).status_code == 400


def test_nobody_changes_their_own_role(org):
    owner, profile = org
    admin = _add(profile, "a2@pro.example", role="ADMIN")
    api = _client(admin.user)
    url = reverse("provider-team-member", args=[admin.pk])
    assert api.patch(url, {"role": "VIEWER"}, format="json").status_code == 400


def test_a_manager_with_team_rights_cannot_mint_admins(org):
    _, profile = org
    manager = _add(profile, "m@pro.example", role="MANAGER")
    ProfessionalMembership.objects.filter(pk=manager.pk).update(can_manage_team=True)
    target = _add(profile, "v@pro.example", role="VIEWER")
    api = _client(manager.user)
    url = reverse("provider-team-member", args=[target.pk])
    assert api.patch(url, {"role": "ADMIN"}, format="json").status_code == 400


def test_removing_a_member_deactivates_the_seat(org):
    owner, profile = org
    agent = _add(profile, "agent@pro.example")
    assert _client(owner).delete(reverse("provider-team-member", args=[agent.pk])).status_code == 204
    agent.refresh_from_db()
    assert agent.is_active is False


def test_a_viewer_cannot_edit_the_profile(org):
    _, profile = org
    viewer = _add(profile, "v@pro.example", role="VIEWER")
    res = _client(viewer.user).patch(reverse("provider-profile"), {"city": "Rome"}, format="json")
    assert res.status_code == 403


def test_another_organizations_admin_is_a_stranger(org):
    _, profile = org
    agent = _add(profile, "agent@pro.example")
    stranger_owner = make_user("s@other.example", role=UserRole.PROFESSIONAL, verified=True)
    make_professional(stranger_owner, slug="other", display_name="Other")
    api = _client(stranger_owner)
    assert api.delete(reverse("provider-team-member", args=[agent.pk])).status_code == 404


def test_public_profile_lists_visible_team_members(org):
    owner, profile = org
    hidden = _add(profile, "hide@pro.example")
    ProfessionalMembership.objects.filter(pk=hidden.pk).update(show_on_profile=False)
    _add(profile, "shown@pro.example")
    res = APIClient().get(reverse("professional-detail", args=[profile.slug]))
    assert res.status_code == 200
    emails = {m["email"] for m in res.json()["team"]}
    assert emails == {"owner@pro.example", "shown@pro.example"}
