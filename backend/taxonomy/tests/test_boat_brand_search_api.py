import pytest
from rest_framework.test import APIClient
from rest_framework.throttling import ScopedRateThrottle

from conftest import clear_own_cache_keys
from taxonomy.models import BoatBrand


@pytest.mark.django_db
def test_boat_brand_search_returns_only_active_brands_alphabetically():
    BoatBrand.objects.create(name="Jeanneau")
    BoatBrand.objects.create(name="Beneteau")
    BoatBrand.objects.create(name="Retired Brand", is_active=False)

    response = APIClient().get("/api/v1/boat-brands/")

    assert response.status_code == 200
    names = [item["name"] for item in response.data["results"]]
    assert names == ["Beneteau", "Jeanneau"]


@pytest.mark.django_db
def test_boat_brand_search_is_case_and_accent_insensitive():
    BoatBrand.objects.create(name="Bénéteau")

    response = APIClient().get("/api/v1/boat-brands/", {"q": "beneteau"})

    assert response.status_code == 200
    assert [item["name"] for item in response.data["results"]] == ["Bénéteau"]


@pytest.mark.django_db
def test_boat_brand_search_is_publicly_accessible_without_authentication():
    response = APIClient().get("/api/v1/boat-brands/")

    assert response.status_code == 200


@pytest.mark.django_db
def test_boat_brand_search_is_rate_limited(monkeypatch):
    # NOTE: overriding settings.REST_FRAMEWORK here would not work: DRF's
    # SimpleRateThrottle.THROTTLE_RATES is a class attribute bound once from
    # api_settings.DEFAULT_THROTTLE_RATES at import time. Django's
    # setting_changed signal only resets DRF's api_settings cache, it does
    # not retroactively update that already-bound dict on the throttle
    # class. Monkeypatching the scope entry directly is the reliable way to
    # exercise the throttle in a test.
    clear_own_cache_keys()
    monkeypatch.setitem(ScopedRateThrottle.THROTTLE_RATES, "taxonomy_search", "2/min")
    client = APIClient()
    client.get("/api/v1/boat-brands/")
    client.get("/api/v1/boat-brands/")
    response = client.get("/api/v1/boat-brands/")

    assert response.status_code == 429
