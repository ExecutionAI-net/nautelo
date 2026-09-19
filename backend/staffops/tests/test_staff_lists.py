"""Staff-admin read-only lists."""

import pytest
from django.contrib.auth.models import Group
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user

pytestmark = pytest.mark.django_db

NAMES = [
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
