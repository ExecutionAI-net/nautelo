import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from places.importer import load_alternate_names, load_cities, load_regions
from places.tests.test_importer import ADMIN1, ALTERNATES, CITIES

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def data():
    regions = load_regions(ADMIN1, {"IT", "ES"})
    load_cities(CITIES, {"IT", "ES"}, regions, load_alternate_names(ALTERNATES, {3176219}))


def _get(name, **params):
    return APIClient().get(reverse(name), params)


def test_regions_are_listed_in_the_requested_language():
    data = _get("places-regions", country="IT").json()
    assert [r["name"] for r in data] == ["Liguria"]


def test_city_search_ignores_accents_and_language():
    for term in ("genova", "GENOA", "genua"):
        assert [c["id"] for c in _get("places-cities", country="IT", q=term).json()] == [3176219]
    assert [c["name"] for c in _get("places-cities", country="ES", q="cadiz").json()] == ["Cádiz"]
    assert _get("places-cities", country="IT", q="genova", locale="it").json()[0]["name"] == "Genova"
    assert _get("places-cities", country="ES", q="genova").json() == []


def test_country_is_required():
    assert _get("places-cities", q="x").status_code == 400
