import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from professionals.models import ProfessionalProfile
from services_catalog.models import ServiceCategory

pytestmark = pytest.mark.django_db

PROFILE = {
    "display_name": "Blue Rigging",
    "public_email": "b@example.com",
    "public_phone": "+34600000000",
    "country_code": "es",
}


def client_for(role=UserRole.PROFESSIONAL, email="prov@example.com"):
    client = APIClient()
    client.force_authenticate(make_user(email=email, role=role, verified=True))
    return client


def test_only_service_providers_may_use_the_endpoints():
    assert client_for(UserRole.PRIVATE_SELLER, "b1@example.com").get(reverse("provider-profile")).status_code == 403
    assert APIClient().get(reverse("provider-profile")).status_code in (401, 403)


def test_profile_lifecycle_and_submit():
    api = client_for()
    assert api.get(reverse("provider-profile")).status_code == 404
    created = api.post(reverse("provider-profile"), PROFILE, format="json")
    assert created.status_code == 201
    assert created.json()["status"] == "DRAFT"
    assert created.json()["country_code"] == "ES"
    assert api.post(reverse("provider-profile"), PROFILE, format="json").status_code == 409
    patched = api.patch(
        reverse("provider-profile"), {"city": "Palma", "status": "ACTIVE", "submit": True}, format="json"
    ).json()
    assert patched["city"] == "Palma"
    assert patched["status"] == "PENDING"


def test_services_are_scoped_to_the_owner():
    api = client_for()
    other = client_for(email="prov2@example.com")
    category = ServiceCategory.objects.create(name_en="Rigging", slug="rigging")
    body = {"category": str(category.id), "title_en": "Mast"}
    assert api.post(reverse("provider-service-list"), body, format="json").status_code == 404
    api.post(reverse("provider-profile"), PROFILE, format="json")
    other.post(reverse("provider-profile"), {**PROFILE, "display_name": "Other Co"}, format="json")
    made = api.post(reverse("provider-service-list"), body, format="json")
    assert made.status_code == 201
    assert len(api.get(reverse("provider-service-list")).json()) == 1
    assert other.get(reverse("provider-service-list")).json() == []
    url = reverse("provider-service-detail", args=[made.json()["id"]])
    assert other.patch(url, {"is_active": False}, format="json").status_code == 404
    assert api.patch(url, {"is_active": False}, format="json").json()["is_active"] is False
    assert api.delete(url).status_code == 204
    assert ProfessionalProfile.objects.count() == 2
