import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from common.throttling import HashedIPScopedRateThrottle
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
    monkeypatch.setitem(
        HashedIPScopedRateThrottle.THROTTLE_RATES, "taxonomy_search", "2/min"
    )
    client = APIClient()
    client.get("/api/v1/boat-brands/")
    client.get("/api/v1/boat-brands/")
    response = client.get("/api/v1/boat-brands/")

    assert response.status_code == 429


# Both taxonomy endpoints share the `taxonomy_search` bucket; the model list
# rejects a missing brand_id with 400, but throttling runs before that, so the
# 429 still proves the bucket was consumed.
TAXONOMY_ENDPOINTS = ["/api/v1/boat-brands/", "/api/v1/boat-models/"]


@pytest.mark.django_db
@pytest.mark.parametrize("url", TAXONOMY_ENDPOINTS)
def test_rotating_x_forwarded_for_does_not_yield_fresh_throttle_buckets(url, monkeypatch):
    # Regression: these views used DRF's raw ScopedRateThrottle, whose
    # get_ident() trusts a client-supplied X-Forwarded-For when NUM_PROXIES is
    # unset, so every new header value was a fresh, unlimited bucket.
    monkeypatch.setitem(
        HashedIPScopedRateThrottle.THROTTLE_RATES, "taxonomy_search", "2/min"
    )
    client = APIClient()
    statuses = [
        client.get(url, REMOTE_ADDR="203.0.113.7", HTTP_X_FORWARDED_FOR=f"1.2.3.{n}").status_code
        for n in range(4)
    ]

    assert statuses[:2] != [429, 429]
    assert statuses[2:] == [429, 429]


@pytest.mark.django_db
@pytest.mark.parametrize("url", TAXONOMY_ENDPOINTS)
def test_throttle_cache_key_contains_no_raw_ip(url):
    APIClient().get(
        url, REMOTE_ADDR="203.0.113.7", HTTP_X_FORWARDED_FOR="198.51.100.99"
    )

    raw_client = cache._cache.get_client()
    keys = [key.decode() for key in raw_client.keys("*throttle_taxonomy_search*")]

    assert keys, "the taxonomy_search throttle should have written a cache key"
    for key in keys:
        assert "203.0.113.7" not in key
        assert "198.51.100.99" not in key
