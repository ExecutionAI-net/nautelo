import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from brokers.enums import BrokerOrganizationStatus
from brokers.tests.factories import make_broker
from listings.enums import ListingStatus
from listings.tests.factories import make_broker_listing, make_snapshot

pytestmark = pytest.mark.django_db


def _publish(broker):
    staff = make_user(role=UserRole.STAFF)
    listing = make_broker_listing(broker=broker, actor=staff, status=ListingStatus.PUBLISHED)
    listing.current_public_snapshot = make_snapshot(listing, approved_by=staff)
    listing.save(update_fields=["current_public_snapshot"])
    return listing


def test_only_active_brokers_are_listed_with_published_counts_and_no_contact_data():
    active = make_broker("Alpha Yachts", "alpha-yachts")
    make_broker("Draft Co", "draft-co", status=BrokerOrganizationStatus.DRAFT)
    make_broker("Gone Co", "gone-co", status=BrokerOrganizationStatus.SUSPENDED)
    _publish(active)

    body = APIClient().get(reverse("public-broker-list")).data

    assert [row["slug"] for row in body["results"]] == ["alpha-yachts"]
    row = body["results"][0]
    assert row["listing_count"] == 1
    assert "public_email" not in row and "public_phone" not in row


def test_detail_is_by_slug_and_404s_for_non_active_brokers():
    make_broker("Draft Co", "draft-co", status=BrokerOrganizationStatus.DRAFT)
    make_broker("Alpha Yachts", "alpha-yachts")
    client = APIClient()
    assert client.get(reverse("public-broker-detail", kwargs={"slug": "alpha-yachts"})).status_code == 200
    assert client.get(reverse("public-broker-detail", kwargs={"slug": "draft-co"})).status_code == 404


def test_listings_can_be_filtered_to_one_broker():
    a = make_broker("Alpha Yachts", "alpha-yachts")
    b = make_broker("Beta Yachts", "beta-yachts")
    la, lb = _publish(a), _publish(b)
    rows = APIClient().get(reverse("listing-list"), {"broker": "alpha-yachts"}).data["results"]
    assert [r["id"] for r in rows] == [str(la.pk)]
    assert str(lb.pk) not in [r["id"] for r in rows]


def test_directory_searches_filters_and_reports_facets():
    palma = make_broker("Palma Yachts", "palma-yachts")
    palma.city, palma.country_code, palma.specialties = "Palma", "ES", ["Motor yachts", "Superyachts"]
    palma.save()
    genoa = make_broker("Genoa Marine", "genoa-marine")
    genoa.city, genoa.country_code, genoa.specialties = "Genoa", "IT", ["Sailing yachts"]
    genoa.save()
    client = APIClient()
    url = reverse("public-broker-list")
    assert [r["slug"] for r in client.get(url, {"country": "it"}).data["results"]] == ["genoa-marine"]
    assert [r["slug"] for r in client.get(url, {"q": "palm"}).data["results"]] == ["palma-yachts"]
    assert [r["slug"] for r in client.get(url, {"specialty": "Superyachts"}).data["results"]] == ["palma-yachts"]
    facets = client.get(url).data["facets"]
    assert facets["countries"] == {"ES": 1, "IT": 1} and facets["specialties"]["Sailing yachts"] == 1


def test_place_id_filters_exactly_and_only_geocoded_brokers_reach_the_location_facet():
    palma = make_broker("Palma Yachts", "palma-yachts")
    palma.city, palma.country_code, palma.place_geoname_id = "Palma de Mallorca", "ES", 3128760
    palma.save()
    # Free text only, never run through the standard place picker - still counts
    # toward its country, but must not appear as a fake city choice.
    genoa = make_broker("Genoa Marine", "genoa-marine")
    genoa.city, genoa.country_code = "Genoa", "IT"
    genoa.save()

    client = APIClient()
    url = reverse("public-broker-list")
    assert [r["slug"] for r in client.get(url, {"place": "3128760"}).data["results"]] == ["palma-yachts"]
    assert client.get(url, {"place": "999999"}).data["results"] == []

    facets = client.get(url).data["facets"]
    assert facets["locations"] == [{"country": "ES", "place_id": 3128760, "city": "Palma de Mallorca", "count": 1}]
