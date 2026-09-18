from rest_framework.test import APIRequestFactory

from taxonomy.views import BoatBrandListView, BoatModelListView


def test_boat_brand_view_throttle_cache_key_never_contains_the_raw_ip():
    request = APIRequestFactory().get("/api/v1/boat-brands/", REMOTE_ADDR="198.51.100.9")
    throttle = BoatBrandListView().get_throttles()[0]
    ident = throttle.get_ident(request)

    assert "198.51.100.9" not in ident
    assert len(ident) == 64  # sha256 hex


def test_boat_model_view_throttle_cache_key_never_contains_the_raw_ip():
    request = APIRequestFactory().get("/api/v1/boat-models/", REMOTE_ADDR="198.51.100.9")
    throttle = BoatModelListView().get_throttles()[0]
    ident = throttle.get_ident(request)

    assert "198.51.100.9" not in ident
    assert len(ident) == 64  # sha256 hex
