import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from listings.enums import ListingStatus
from listings.tests.factories import make_brand, make_model, make_private_listing, make_snapshot
from places.importer import load_alternate_names, load_cities, load_regions
from places.tests.test_importer import ADMIN1, ALTERNATES, CITIES
from semantic.indexing import index_all, index_listing
from semantic.models import ListingEmbedding
from semantic.parse import parse_query

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def places():
    regions = load_regions(ADMIN1, {"IT", "ES"})
    load_cities(CITIES, {"IT", "ES"}, regions, load_alternate_names(ALTERNATES, {3176219}))


def test_prices_lengths_cabins_and_types_are_read_in_three_languages():
    en = parse_query("12 m sailing yacht with 3 cabins under 180,000 euro")
    assert en.filters["length_min"] == "10.8" and en.filters["length_max"] == "13.2"
    assert en.filters["boat_type"] == "Sailing yacht" and en.filters["cabins_min"] == "3"
    assert en.filters["price_max"] == "180000"
    it = parse_query("veliero di 12 metri sotto 180 mila euro")
    assert it.filters["boat_type"] == "Sailing yacht" and it.filters["price_max"] == "180000"
    es = parse_query("velero de 12 metros por debajo de 180.000 €")
    assert es.filters["price_max"] == "180000" and es.filters["boat_type"] == "Sailing yacht"
    rng = parse_query("catamaran between 100k and 250k")
    assert (rng.filters["price_min"], rng.filters["price_max"]) == ("100000", "250000")


def test_a_place_in_any_language_becomes_a_filter_and_leaves_the_feel():
    parsed = parse_query("veliero per famiglia a Genova")
    assert parsed.filters["place"] == "3176219" and parsed.filters["boat_type"] == "Sailing yacht"
    assert "genova" not in parsed.residual
    assert parse_query("barco en Mallorca").filters["region"] == "Balearic Islands"


def _published(owner, brand, title, *, city="Genoa", place=None, price=100000, specs=None):
    listing = make_private_listing(owner=owner, brand=brand, model=make_model(brand, title), price=price)
    staff = make_user(f"s-{title}@x.example", role=UserRole.STAFF, verified=True)
    snapshot = make_snapshot(listing, approved_by=staff, title_en=title, location_city=city, location_place_id=place, specifications=specs or {})
    listing.status = ListingStatus.PUBLISHED
    listing.current_public_snapshot = snapshot
    listing.published_at = timezone.now()
    listing.save()
    return listing


def test_natural_language_search_filters_then_ranks_by_meaning():
    owner = make_user("o@x.example", role=UserRole.PRIVATE_SELLER, verified=True)
    brand = make_brand("Nautica")
    family = _published(owner, brand, "Spacious family catamaran", place=3176219, price=150000, specs={"boat_type": "Catamaran"})
    racer = _published(owner, brand, "Racing sloop carbon", place=3176219, price=150000, specs={"boat_type": "Sailing yacht"})
    _published(owner, brand, "Family cruiser Cadiz", city="Cadiz", place=6355234, price=150000)
    _published(owner, brand, "Family cruiser expensive", place=3176219, price=900000)
    assert index_all() == 4
    assert index_all() == 0  # unchanged text is not re-embedded

    api = APIClient()
    data = api.get(reverse("listing-list"), {"mode": "semantic", "query": "family boat in Genova under 200k"}).json()
    ids = [row["id"] for row in data["results"]]
    assert set(ids) == {str(family.pk), str(racer.pk)}  # Genoa only, price capped
    assert ids[0] == str(family.pk)  # the boat that reads like the request leads
    assert data["interpretation"]["filters"]["place"] == "3176219"

    only_filters = api.get(reverse("listing-list"), {"mode": "semantic", "query": "sailing yacht Genoa"}).json()
    assert [row["id"] for row in only_filters["results"]] == [str(racer.pk)]

    plain = api.get(reverse("listing-list")).json()
    assert plain["count"] == 4 and "interpretation" not in plain


def test_unpublished_or_changed_listings_keep_the_index_honest():
    owner = make_user("o2@x.example", role=UserRole.PRIVATE_SELLER, verified=True)
    listing = _published(owner, make_brand("Nautica2"), "First title")
    assert index_listing(listing.pk) is True
    staff = make_user("s-second@x.example", role=UserRole.STAFF, verified=True)
    listing.current_public_snapshot = make_snapshot(listing, approved_by=staff, version=2, title_en="Second title")
    listing.save()
    assert index_listing(listing.pk) is True
    listing.current_public_snapshot = None
    listing.save()
    assert index_listing(listing.pk) is False
    assert not ListingEmbedding.objects.filter(listing=listing).exists()
