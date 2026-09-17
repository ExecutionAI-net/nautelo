import pytest

from taxonomy.models import BoatBrand, BoatModel


@pytest.mark.django_db
def test_creating_an_active_brand_auto_creates_its_other_placeholder():
    brand = BoatBrand.objects.create(name="Beneteau")

    other = BoatModel.objects.get(brand=brand, is_other_placeholder=True)
    assert other.name == "Other"


@pytest.mark.django_db
def test_saving_an_already_active_brand_again_does_not_create_a_second_placeholder():
    brand = BoatBrand.objects.create(name="Jeanneau")
    assert BoatModel.objects.filter(brand=brand, is_other_placeholder=True).count() == 1

    brand.save()

    assert BoatModel.objects.filter(brand=brand, is_other_placeholder=True).count() == 1


@pytest.mark.django_db
def test_reactivating_a_brand_does_not_create_a_second_other_placeholder():
    brand = BoatBrand.objects.create(name="Lagoon")
    assert BoatModel.objects.filter(brand=brand, is_other_placeholder=True).count() == 1

    brand.is_active = False
    brand.save()
    brand.is_active = True
    brand.save()

    assert BoatModel.objects.filter(brand=brand, is_other_placeholder=True).count() == 1


@pytest.mark.django_db
def test_an_inactive_brand_does_not_get_an_other_placeholder():
    brand = BoatBrand.objects.create(name="Draft Brand", is_active=False)

    assert not BoatModel.objects.filter(brand=brand, is_other_placeholder=True).exists()
