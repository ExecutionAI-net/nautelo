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


def test_a_picked_place_sets_city_region_and_country(api):
    from places.importer import load_cities, load_regions

    regions = load_regions(["IT.07\tLiguria\tLiguria\t3174725\n"], {"IT"})
    load_cities(["3176219\tGenoa\tGenoa\tGenova\t44.4\t8.9\tP\tPPLA\tIT\t\t07\t\t\t\t580223\t\t19\tEurope/Rome\t2024-01-01\n"], {"IT"}, regions)
    response = api.patch(reverse("provider-profile"), {"place_id": 3176219, "city": "genova"}, format="json")
    assert response.status_code == 200, response.content
    body = response.json()
    assert (body["city"], body["region"], body["country_code"], body["place_id"]) == ("Genoa", "Liguria", "IT", 3176219)
    forgotten = api.patch(reverse("provider-profile"), {"city": "Elsewhere"}, format="json").json()
    assert forgotten["place_id"] is None
    assert api.patch(reverse("provider-profile"), {"place_id": 1}, format="json").status_code == 400
