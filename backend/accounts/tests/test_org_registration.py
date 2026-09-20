import pytest
from django.core import mail
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.enums import UserRole
from accounts.models import User
from brokers.models import BrokerMembership, BrokerOrganization, BrokerPlan
from professionals.models import ProfessionalMembership, ProfessionalProfile

pytestmark = pytest.mark.django_db

URL = "auth-register-organization"
BASE = {
    "organization_name": "Blue Rigging",
    "full_name": "Mia Rossi",
    "email": "Mia@Blue-Rigging.example",
    "password": "Str0ng-Org-Pass!",
    "phone": "+34600000000",
    "country_code": "es",
}


def _post(**extra):
    return APIClient().post(reverse(URL), {**BASE, **extra}, format="json")


def test_professional_registration_creates_owner_org_and_seat(django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        res = _post(org_type="PROFESSIONAL")
    assert res.status_code == 201
    user = User.objects.get(email="mia@blue-rigging.example")
    assert user.primary_role == UserRole.PROFESSIONAL and not user.is_email_verified
    profile = ProfessionalProfile.objects.get(owner_user=user)
    assert (profile.status, profile.country_code, profile.display_name) == ("DRAFT", "ES", "Blue Rigging")
    seat = ProfessionalMembership.objects.get(user=user)
    assert (seat.role, seat.is_owner) == ("ADMIN", True)
    assert mail.outbox and "verify-email" in mail.outbox[-1].body


def test_broker_registration_needs_an_active_plan_and_seats_the_owner():
    plan = BrokerPlan.objects.filter(is_active=True).first() or BrokerPlan.objects.create(
        slug="starter-x", name="Starter", monthly_price=99
    )
    assert _post(org_type="BROKER").status_code == 400
    res = _post(org_type="BROKER", plan=plan.slug)
    assert res.status_code == 201
    user = User.objects.get(email="mia@blue-rigging.example")
    broker = BrokerOrganization.objects.get(name="Blue Rigging")
    assert (user.primary_role, broker.status, broker.plan) == (UserRole.BROKER, "DRAFT", plan)
    assert BrokerMembership.objects.get(user=user, broker=broker).role == "ADMIN"


def test_duplicate_email_and_bad_role_are_refused():
    assert _post(org_type="PROFESSIONAL").status_code == 201
    assert _post(org_type="PROFESSIONAL").status_code == 400
    assert _post(org_type="STAFF", email="x@y.example").status_code == 400
    assert not ProfessionalProfile.objects.filter(display_name="Blue Rigging").count() > 1


def test_same_name_gets_a_distinct_slug():
    _post(org_type="PROFESSIONAL")
    _post(org_type="PROFESSIONAL", email="other@blue.example")
    slugs = set(ProfessionalProfile.objects.values_list("slug", flat=True))
    assert slugs == {"blue-rigging", "blue-rigging-2"}
