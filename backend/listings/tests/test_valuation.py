import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from listings.enums import ListingStatus
from listings.tests.factories import make_private_listing, make_snapshot

pytestmark = pytest.mark.django_db


def _publish(n, price, **spec):
    staff = make_user(f"mod{n}@val.example", role=UserRole.STAFF, verified=True)
    owner = make_user(f"own{n}@val.example", role=UserRole.PRIVATE_SELLER, verified=True)
    listing = make_private_listing(owner=owner, status=ListingStatus.PUBLISHED)
    snap = make_snapshot(
        listing, approved_by=staff, price=price,
        specifications={"boat_type": "Motor yacht", "length_m": 12.0, **spec},
    )
    listing.current_public_snapshot = snap
    listing.published_at = timezone.now()
    listing.save(update_fields=["current_public_snapshot", "published_at"])


BODY = {"boat_type": "Motor yacht", "length_m": "12", "year": 2020}


def test_too_few_comparables_gives_no_number():
    response = APIClient().post(reverse("valuation"), BODY, format="json")
    assert response.status_code == 200
    assert response.json()["available"] is False


def test_estimate_is_the_spread_of_comparable_asking_prices():
    for i, price in enumerate([100000, 120000, 140000, 160000]):
        _publish(i, price)
    _publish(9, 900000, boat_type="Sailing yacht")
    data = APIClient().post(reverse("valuation"), BODY, format="json").json()
    assert data["available"] is True
    assert data["comparables"] == 4
    assert data["low"] <= data["mid"] <= data["high"]
    assert data["confidence"] == "low"


def test_invalid_input_is_refused():
    response = APIClient().post(reverse("valuation"), {"boat_type": "Rocket", "length_m": "1", "year": 1800}, format="json")
    assert response.status_code == 400


def test_length_filter_reads_either_spec_key():
    from listings.public_filters import apply_public_filters
    from listings.views import published_listings_queryset

    _publish(1, 100000)
    _publish(2, 100000, loa_m="30")
    hits = apply_public_filters(published_listings_queryset(), {"length_min": "11", "length_max": "13"})
    assert hits.count() == 1
