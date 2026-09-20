import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from professionals.tests.factories import make_professional

pytestmark = pytest.mark.django_db


@pytest.fixture
def api(settings):
    owner = make_user("owner@rules.example", role=UserRole.PROFESSIONAL, verified=True)
    make_professional(owner)
    client = APIClient()
    client.force_authenticate(owner)
    return client


@pytest.mark.parametrize(
    "payload",
    [
        {"display_name": "<script>alert(1)</script>"},
        {"city": "<b>x</b>"},
        {"public_phone": "abc"},
        {"public_phone": "123"},
    ],
)
def test_profile_refuses_markup_and_junk_phone(api, payload):
    response = api.patch(reverse("provider-profile"), payload, format="json")
    assert response.status_code == 400, response.content


def test_profile_accepts_normal_values(api):
    response = api.patch(
        reverse("provider-profile"),
        {"display_name": "Marina Rossi Yachts", "city": "Genoa", "public_phone": "+39 010 123 456"},
        format="json",
    )
    assert response.status_code == 200, response.content


def test_service_title_refuses_markup(api):
    from services_catalog.models import ServiceCategory

    category = ServiceCategory.objects.create(slug="survey", name_en="Survey")
    body = {"category": str(category.pk), "title_en": "<img src=x onerror=alert(1)>", "description_en": "ok", "service_area": []}
    assert api.post(reverse("provider-service-list"), body, format="json").status_code == 400
    body["title_en"] = "Pre-purchase survey"
    assert api.post(reverse("provider-service-list"), body, format="json").status_code == 201
