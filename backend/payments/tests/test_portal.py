import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from payments.tests.fakes import FakeStripeGateway
from professionals.models import ProfessionalSubscription
from professionals.tests.factories import make_professional

pytestmark = pytest.mark.django_db


@pytest.fixture
def owner_api(monkeypatch):
    owner = make_user("owner@portal.example", role=UserRole.PROFESSIONAL, verified=True)
    profile = make_professional(owner)
    api = APIClient()
    api.force_authenticate(owner)
    fake = FakeStripeGateway()
    monkeypatch.setattr("payments.gateway.default_gateway", lambda: fake)
    return api, profile, fake


def test_no_billing_account_yet_is_a_clear_409(owner_api):
    api, _, _ = owner_api
    response = api.post(reverse("provider-membership-portal"))
    assert response.status_code == 409


def test_owner_gets_a_portal_link_for_the_stripe_customer(owner_api):
    api, profile, fake = owner_api
    ProfessionalSubscription.objects.update_or_create(profile=profile, defaults={"stripe_customer_id": "cus_123"})
    response = api.post(reverse("provider-membership-portal"))
    assert response.status_code == 200
    assert response.json()["portal_url"] == fake.portal_url
    assert fake.portals[0]["customer_id"] == "cus_123"
