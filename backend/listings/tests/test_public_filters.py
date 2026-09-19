"""Boat filter panel: query-string filters, sorting and facets on the public list."""

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from listings.tests.test_public_read_api import _published


pytestmark = pytest.mark.django_db


@pytest.fixture
def api():
    return APIClient()


def _titles(api, **params):
    response = api.get(reverse("listing-list"), params)
    assert response.status_code == 200
    return [row["title"]["en"] for row in response.json()["results"]]


@pytest.fixture
def catalogue():
    _published(
        title_en="Cheap Sloop",
        brand_name_snapshot="Bavaria",
        manufacture_year_snapshot=2005,
        price="40000.00",
        location_country="ES",
        location_region="Balearic Islands",
        location_city="Palma",
    )
    _published(
        title_en="Mid Cat",
        brand_name_snapshot="Lagoon",
        manufacture_year_snapshot=2018,
        price="300000.00",
        location_country="ES",
        location_region="Catalonia",
        location_city="Barcelona",
    )
    _published(
        title_en="Dear Yacht",
        brand_name_snapshot="Sanlorenzo",
        manufacture_year_snapshot=2021,
        price="5000000.00",
        location_country="IT",
        location_region="Liguria",
        location_city="Genoa",
    )


def test_without_filters_everything_published_is_listed(api, catalogue):
    assert set(_titles(api)) == {"Cheap Sloop", "Mid Cat", "Dear Yacht"}


def test_price_range_filters_on_the_snapshot(api, catalogue):
    assert _titles(api, price_min="100000", price_max="1000000") == ["Mid Cat"]


def test_country_region_and_brand_filters(api, catalogue):
    assert _titles(api, country="it") == ["Dear Yacht"]
    assert _titles(api, region="catalonia") == ["Mid Cat"]
    assert _titles(api, brand="bavaria") == ["Cheap Sloop"]


def test_year_range(api, catalogue):
    assert set(_titles(api, year_min="2018")) == {"Mid Cat", "Dear Yacht"}
    assert _titles(api, year_max="2010") == ["Cheap Sloop"]


def test_free_text_matches_title_brand_and_city(api, catalogue):
    assert _titles(api, q="genoa") == ["Dear Yacht"]
    assert _titles(api, q="lagoon") == ["Mid Cat"]


def test_sorting(api, catalogue):
    assert _titles(api, sort="price_asc") == ["Cheap Sloop", "Mid Cat", "Dear Yacht"]
    assert _titles(api, sort="price_desc")[0] == "Dear Yacht"
    assert _titles(api, sort="year_desc")[0] == "Dear Yacht"


def test_garbage_parameters_are_ignored_not_rejected(api, catalogue):
    assert len(_titles(api, price_min="abc", year_max="x", sort="nonsense", seller_type="??")) == 3


def test_facets_list_distinct_choices(api, catalogue):
    body = api.get(reverse("listing-facets")).json()
    assert body["brands"] == ["Bavaria", "Lagoon", "Sanlorenzo"]
    assert body["countries"] == ["ES", "IT"]
    assert "Liguria" in body["regions"]


def test_exclude_drops_one_listing_and_ignores_garbage(api, catalogue):
    everything = api.get(reverse("listing-list")).json()["results"]
    dropped = everything[0]["id"]
    left = [row["id"] for row in api.get(reverse("listing-list"), {"exclude": dropped}).json()["results"]]
    assert dropped not in left and len(left) == len(everything) - 1
    assert len(api.get(reverse("listing-list"), {"exclude": "not-a-uuid"}).json()["results"]) == len(everything)
