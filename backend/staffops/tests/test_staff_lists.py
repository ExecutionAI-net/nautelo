"""Staff-admin read-only lists."""

import pytest
from django.contrib.auth.models import Group
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user

pytestmark = pytest.mark.django_db

NAMES = [
    "staff-boat-list",
    "staff-user-list",
    "staff-broker-list",
    "staff-provider-list",
    "staff-lead-list",
    "staff-service-request-list",
    "staff-subscription-list",
]


@pytest.fixture
def staff_api():
    admin = make_user(email="ops-staff@example.com", role=UserRole.STAFF, verified=True)
    admin.groups.add(Group.objects.get(name=StaffGroup.ADMIN))
    client = APIClient()
    client.force_authenticate(admin)
    return client


@pytest.mark.parametrize("name", NAMES)
def test_lists_are_paginated_for_staff_admin(staff_api, name):
    response = staff_api.get(reverse(name))
    assert response.status_code == 200
    assert "results" in response.json()


@pytest.mark.parametrize("name", NAMES + ["staff-reports"])
def test_lists_reject_non_staff_and_anonymous(name):
    assert APIClient().get(reverse(name)).status_code in (401, 403)
    seller = APIClient()
    seller.force_authenticate(make_user(email="ops-seller@example.com", role=UserRole.PRIVATE_SELLER, verified=True))
    assert seller.get(reverse(name)).status_code == 403


def test_user_search_and_role_filter(staff_api):
    make_user(email="findme@example.com", role=UserRole.PRIVATE_SELLER, verified=True)
    body = staff_api.get(reverse("staff-user-list"), {"q": "findme", "role": UserRole.PRIVATE_SELLER}).json()
    assert [row["email"] for row in body["results"]] == ["findme@example.com"]


def test_reports_counts(staff_api):
    body = staff_api.get(reverse("staff-reports")).json()
    assert body["users"] >= 1 and set(body) >= {"brokers", "providers", "listings"}


def test_staff_admin_activates_and_suspends_a_provider_and_it_is_audited(staff_api):
    from audit.models import AuditEvent
    from professionals.models import ProfessionalProfile

    owner = make_user(email="prov-owner@example.com", role=UserRole.PROFESSIONAL, verified=True)
    profile = ProfessionalProfile.objects.create(
        owner_user=owner, display_name="P", slug="p", public_email="p@example.com", public_phone="+34600", country_code="ES", status="PENDING"
    )
    url = reverse("staff-provider-status", args=[profile.id])
    assert staff_api.post(url, {"status": "ACTIVE"}, format="json").json()["status"] == "ACTIVE"
    profile.refresh_from_db()
    assert profile.status == "ACTIVE"
    assert staff_api.post(url, {"status": "DRAFT"}, format="json").status_code == 400
    assert AuditEvent.objects.filter(action="professionals.ProfessionalProfile.status_changed").count() == 1


def test_status_change_needs_staff_admin():
    from brokers.models import BrokerOrganization

    broker = BrokerOrganization.objects.create(name="B", slug="b", public_email="b@example.com", public_phone="+34600")
    seller = APIClient()
    seller.force_authenticate(make_user(email="not-staff@example.com", role=UserRole.PRIVATE_SELLER, verified=True))
    assert seller.post(reverse("staff-broker-status", args=[broker.id]), {"status": "ACTIVE"}, format="json").status_code == 403


def test_user_list_carries_role_facets_and_an_account_state_filter(staff_api):
    make_user(email="a-seller@example.com", role=UserRole.PRIVATE_SELLER, verified=True)
    make_user(email="b-seller@example.com", role=UserRole.PRIVATE_SELLER, verified=False)
    body = staff_api.get(reverse("staff-user-list"), {"role": UserRole.PRIVATE_SELLER}).json()
    assert body["facets"][UserRole.PRIVATE_SELLER] == 2
    unverified = staff_api.get(reverse("staff-user-list"), {"state": "unverified"}).json()
    assert "b-seller@example.com" in [row["email"] for row in unverified["results"]]
    assert "a-seller@example.com" not in [row["email"] for row in unverified["results"]]


def test_reports_carry_breakdowns_and_thirty_day_growth(staff_api):
    body = staff_api.get(reverse("staff-reports")).json()
    assert body["new_users_30d"] >= 1
    assert sum(body["users_by_role"].values()) == body["users"]
    assert set(body) >= {"listings_by_status", "new_users_prev_30d", "suspended_users", "unverified_users"}


def test_staff_admin_freezes_a_user_and_it_is_audited_but_not_staff(staff_api):
    from audit.models import AuditEvent

    seller = make_user(email="freeze-me@example.com", role=UserRole.PRIVATE_SELLER, verified=True)
    url = reverse("staff-user-status", args=[seller.pk])
    assert staff_api.post(url, {"status": "SUSPENDED"}, format="json").status_code == 200
    seller.refresh_from_db()
    assert seller.is_active is False
    assert AuditEvent.objects.filter(action="accounts.User.status_changed", target_id=str(seller.pk)).exists()
    other_staff = make_user(email="other-staff@example.com", role=UserRole.STAFF, verified=True)
    assert staff_api.post(reverse("staff-user-status", args=[other_staff.pk]), {"status": "SUSPENDED"}, format="json").status_code == 400


def test_reports_carry_a_six_month_series_and_country_split(staff_api):
    body = staff_api.get(reverse("staff-reports")).json()
    assert len(body["monthly"]) == 6
    assert body["monthly"][-1]["users"] >= 1
    assert isinstance(body["listings_by_seller_type"], dict)


def test_staff_reads_and_changes_a_platform_setting_and_bad_values_are_refused(staff_api):
    from platform_settings.models import PlatformSetting

    body = staff_api.get(reverse("staff-settings")).json()
    keys = {row["key"] for row in body["settings"]}
    assert "media.upgraded_image_limit" in keys
    ok = staff_api.patch(reverse("staff-settings"), {"key": "media.upgraded_image_limit", "value": 25}, format="json")
    assert ok.status_code == 200 and ok.json()["value"] == 25
    bad = staff_api.patch(reverse("staff-settings"), {"key": "media.upgraded_image_limit", "value": 500}, format="json")
    assert bad.status_code == 400
    assert staff_api.patch(reverse("staff-settings"), {"key": "nope", "value": 1}, format="json").status_code == 400


def test_boat_rows_carry_the_submitted_revision_a_moderator_can_decide(staff_api):
    from django.utils import timezone

    from listings.enums import ListingStatus, RevisionStatus
    from listings.tests.factories import make_private_listing, make_revision

    owner = make_user(email="boat-owner@example.com", role=UserRole.PRIVATE_SELLER, verified=True)
    pending = make_private_listing(owner=owner, status=ListingStatus.PENDING_APPROVAL)
    revision = make_revision(pending, state=RevisionStatus.SUBMITTED, submitted_at=timezone.now(), submitted_by=owner)
    draft = make_private_listing(owner=owner, brand=pending.brand, model=pending.model)
    rows = {row["id"]: row for row in staff_api.get(reverse("staff-boat-list")).json()["results"]}
    assert rows[str(pending.pk)]["pending_revision_id"] == str(revision.pk)
    assert rows[str(draft.pk)]["pending_revision_id"] is None
