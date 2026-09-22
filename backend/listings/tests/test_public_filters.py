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
    # Every location row carries its own country and region, so the filter can offer only what belongs together.
    assert {row["country"] for row in body["locations"]} == {"ES", "IT"}
    assert all(set(row) == {"country", "region", "place_id", "city", "count"} and row["count"] >= 1 for row in body["locations"])
    assert sum(row["count"] for row in body["locations"]) == len(api.get(reverse("listing-list")).json()["results"])


def test_facets_are_cached_across_requests(api, catalogue):
    from django.core.cache import cache

    from listings.views import FACETS_CACHE_KEY

    first = api.get(reverse("listing-facets")).json()
    assert cache.get(FACETS_CACHE_KEY) == first

    # A brand-new brand does not show up until the cache expires — this is the
    # accepted trade-off (spec: a short TTL, not correctness) that lets the
    # endpoint skip its distinct/group-by queries on every /boats/ page load.
    _published(title_en="Brand New", brand_name_snapshot="ZzTop Yachts")
    assert api.get(reverse("listing-facets")).json() == first

    cache.delete(FACETS_CACHE_KEY)
    refreshed = api.get(reverse("listing-facets")).json()
    assert "ZzTop Yachts" in refreshed["brands"]


def test_exclude_drops_one_listing_and_ignores_garbage(api, catalogue):
    everything = api.get(reverse("listing-list")).json()["results"]
    dropped = everything[0]["id"]
    left = [row["id"] for row in api.get(reverse("listing-list"), {"exclude": dropped}).json()["results"]]
    assert dropped not in left and len(left) == len(everything) - 1
    assert len(api.get(reverse("listing-list"), {"exclude": "not-a-uuid"}).json()["results"]) == len(everything)


def test_spec_filters_match_boat_type_condition_fuel_and_minimum_cabins(api):
    _published(title_en="Diesel Cat", specifications={"boat_type": "Catamaran", "condition": "used", "fuel_type": "Diesel", "cabins": "4"})
    _published(title_en="Petrol Rib", specifications={"boat_type": "RIB", "condition": "new", "fuel_type": "Petrol", "cabins": 0})
    assert _titles(api, boat_type="catamaran") == ["Diesel Cat"]
    assert _titles(api, condition="new") == ["Petrol Rib"]
    assert _titles(api, fuel_type="Diesel") == ["Diesel Cat"]
    assert _titles(api, cabins_min="3") == ["Diesel Cat"]
    assert set(_titles(api, cabins_min="0")) == {"Diesel Cat", "Petrol Rib"}


def test_facets_offer_the_closed_type_and_fuel_lists(api):
    body = api.get(reverse("listing-facets")).json()
    assert "Catamaran" in body["boat_types"] and "Diesel" in body["fuel_types"]


def test_length_range_reads_the_numeric_loa_and_ignores_free_text(api):
    _published(title_en="Twelve", brand_name_snapshot="A", specifications={"loa_m": "12"})
    _published(title_en="Twenty", brand_name_snapshot="B", specifications={"loa_m": "20.5"})
    _published(title_en="Vague", brand_name_snapshot="C", specifications={"loa_m": "about 30"})
    _published(title_en="Unknown", brand_name_snapshot="D", specifications={})

    assert _titles(api, length_min="15") == ["Twenty"]
    assert _titles(api, length_max="15") == ["Twelve"]
    assert set(_titles(api, length_min="10", length_max="25")) == {"Twelve", "Twenty"}
