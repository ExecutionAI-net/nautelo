import pytest
from django.db import IntegrityError, transaction

from taxonomy.models import BoatBrand


@pytest.mark.django_db
def test_creating_brand_computes_normalized_name_and_slug():
    brand = BoatBrand.objects.create(name="Beneteau")

    assert brand.normalized_name == "beneteau"
    assert brand.slug == "beneteau"


@pytest.mark.django_db
def test_duplicate_normalized_name_is_rejected_case_and_accent_insensitively():
    BoatBrand.objects.create(name="Bénéteau")

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            BoatBrand.objects.create(name="BENETEAU")


@pytest.mark.django_db
def test_slug_collision_gets_a_unique_suffix():
    first = BoatBrand.objects.create(name="Jeanneau!!")
    second = BoatBrand.objects.create(name="Jeanneau??")

    assert first.slug == "jeanneau"
    assert second.slug != "jeanneau"
    assert second.slug.startswith("jeanneau-")


@pytest.mark.django_db
def test_brand_string_representation_is_its_name():
    brand = BoatBrand.objects.create(name="Lagoon")

    assert str(brand) == "Lagoon"
