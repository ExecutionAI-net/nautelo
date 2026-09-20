import pytest
from django.contrib.auth.models import Group
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from brokers.enums import BrokerMembershipRole
from brokers.models import BrokerMembership
from brokers.tests.factories import make_broker

pytestmark = pytest.mark.django_db


def test_status_facets_count_organizations_not_joined_rows():
    staff = make_user("staff@facets.example", role=UserRole.STAFF, verified=True)
    staff.groups.add(Group.objects.get(name=StaffGroup.ADMIN))
    broker = make_broker()
    for i in range(3):
        BrokerMembership.objects.create(
            user=make_user(f"m{i}@facets.example", role=UserRole.BROKER, verified=True),
            broker=broker,
            role=BrokerMembershipRole.AGENT,
        )
    api = APIClient()
    api.force_authenticate(staff)
    r = api.get(reverse("staff-broker-list"))
    data = r.json()
    assert sum(data["facets"].values()) == data["count"] == 1
