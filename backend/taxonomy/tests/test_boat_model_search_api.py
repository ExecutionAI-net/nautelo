import pytest
from rest_framework.test import APIClient

from taxonomy.models import BoatBrand, BoatModel


@pytest.mark.django_db
def test_boat_model_search_requires_brand_id():
    response = APIClient().get("/api/v1/boat-models/")

    assert response.status_code == 400


@pytest.mark.django_db
def test_boat_model_search_rejects_a_malformed_brand_id():
    response = APIClient().get("/api/v1/boat-models/", {"brand_id": "not-a-uuid"})

    assert response.status_code == 400


@pytest.mark.django_db
def test_boat_model_search_returns_ordinary_models_and_other_metadata():
    brand = BoatBrand.objects.create(name="Beneteau")
    BoatModel.objects.create(brand=brand, name="Oceanis 40")

    response = APIClient().get("/api/v1/boat-models/", {"brand_id": str(brand.id)})

    assert response.status_code == 200
    names = [item["name"] for item in response.data["results"]]
    assert names == ["Oceanis 40"]
    assert response.data["other"]["label"] == "Other"
    assert response.data["show_other_prompt"] is False


@pytest.mark.django_db
def test_boat_model_search_with_no_match_signals_show_other_prompt():
    brand = BoatBrand.objects.create(name="Beneteau")
    BoatModel.objects.create(brand=brand, name="Oceanis 40")

    response = APIClient().get(
        "/api/v1/boat-models/", {"brand_id": str(brand.id), "q": "Nonexistent Model"}
    )

    assert response.status_code == 200
    assert response.data["results"] == []
    assert response.data["show_other_prompt"] is True


@pytest.mark.django_db
def test_boat_model_search_only_returns_models_for_the_requested_brand():
    brand_a = BoatBrand.objects.create(name="Beneteau")
    brand_b = BoatBrand.objects.create(name="Jeanneau")
    BoatModel.objects.create(brand=brand_a, name="Oceanis 40")
    BoatModel.objects.create(brand=brand_b, name="Sun Odyssey 410")

    response = APIClient().get("/api/v1/boat-models/", {"brand_id": str(brand_a.id)})

    names = [item["name"] for item in response.data["results"]]
    assert names == ["Oceanis 40"]


@pytest.mark.django_db
def test_boat_model_search_never_includes_the_other_placeholder_in_results():
    brand = BoatBrand.objects.create(name="Beneteau")  # auto-creates its Other placeholder

    response = APIClient().get("/api/v1/boat-models/", {"brand_id": str(brand.id)})

    assert response.data["results"] == []
    assert response.data["other"]["label"] == "Other"


@pytest.mark.django_db
def test_boat_model_search_returns_empty_for_an_inactive_brand():
    brand = BoatBrand.objects.create(name="Beneteau")
    BoatModel.objects.create(brand=brand, name="Oceanis 40")
    brand.is_active = False
    brand.save()

    response = APIClient().get("/api/v1/boat-models/", {"brand_id": str(brand.id)})

    assert response.status_code == 200
    assert response.data["results"] == []
    assert response.data["other"] is None
