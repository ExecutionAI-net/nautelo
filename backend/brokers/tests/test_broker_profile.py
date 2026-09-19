import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.tests.factories import make_user
from brokers.enums import BrokerMembershipRole
from brokers.models import BrokerMembership, BrokerOrganization

pytestmark = pytest.mark.django_db


def make_broker(slug="acme"):
    return BrokerOrganization.objects.create(
        name="Acme", slug=slug, status="ACTIVE", public_email="a@example.com", public_phone="+34600000000"
    )


def member(broker, email, role):
    user = make_user(email=email, verified=True)
    flags = role == BrokerMembershipRole.ADMIN
    BrokerMembership.objects.create(
        user=user, broker=broker, role=role, can_edit_listings=flags, can_manage_team=flags, can_read_messages=flags
    )
    client = APIClient()
    client.force_authenticate(user)
    return client


def test_admin_reads_and_updates_the_profile_but_not_status():
    broker = make_broker()
    api = member(broker, "boss@example.com", BrokerMembershipRole.ADMIN)
    url = reverse("broker-profile", args=[broker.id])
    assert api.get(url).json()["name"] == "Acme"
    body = api.patch(url, {"public_phone": "+34611111111", "status": "SUSPENDED", "slug": "hijack"}, format="json").json()
    assert body["public_phone"] == "+34611111111"
    assert body["status"] == "ACTIVE"
    assert body["slug"] == "acme"


def test_non_admin_and_outsiders_are_refused():
    broker = make_broker()
    url = reverse("broker-profile", args=[broker.id])
    assert member(broker, "viewer@example.com", BrokerMembershipRole.VIEWER).get(url).status_code == 403
    other = member(make_broker("other"), "other@example.com", BrokerMembershipRole.ADMIN)
    assert other.patch(url, {"name": "Taken"}, format="json").status_code == 403
