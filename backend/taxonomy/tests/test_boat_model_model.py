import threading

import pytest
from django.db import IntegrityError, connection, transaction

from taxonomy.models import BoatBrand, BoatModel


@pytest.mark.django_db
def test_creating_model_computes_normalized_name_scoped_to_its_brand():
    brand = BoatBrand.objects.create(name="Beneteau")

    model = BoatModel.objects.create(brand=brand, name="Oceanis 40")

    assert model.normalized_name == "oceanis 40"
    assert model.slug == "oceanis-40"


@pytest.mark.django_db
def test_same_model_name_is_allowed_across_different_brands():
    brand_a = BoatBrand.objects.create(name="Beneteau")
    brand_b = BoatBrand.objects.create(name="Jeanneau")

    BoatModel.objects.create(brand=brand_a, name="Flagship 40")
    BoatModel.objects.create(brand=brand_b, name="Flagship 40")

    assert BoatModel.objects.filter(normalized_name="flagship 40").count() == 2


@pytest.mark.django_db
def test_duplicate_normalized_name_within_the_same_brand_is_rejected():
    brand = BoatBrand.objects.create(name="Beneteau")
    BoatModel.objects.create(brand=brand, name="Oceanis 40")

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            BoatModel.objects.create(brand=brand, name="OCEANIS 40")


@pytest.mark.django_db
def test_only_one_other_placeholder_per_brand_is_allowed_at_the_database_level():
    brand = BoatBrand.objects.create(name="Beneteau")
    BoatModel.objects.create(brand=brand, name="Other", is_other_placeholder=True)

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            BoatModel.objects.create(
                brand=brand, name="Other (duplicate)", is_other_placeholder=True
            )


@pytest.mark.django_db(transaction=True)
def test_concurrent_creation_of_the_same_normalized_model_name_yields_one_winner():
    brand = BoatBrand.objects.create(name="Concurrent Yachts")
    results = []

    def attempt_create():
        try:
            BoatModel.objects.create(brand=brand, name="Flagship 40")
            results.append("ok")
        except IntegrityError:
            results.append("conflict")
        finally:
            connection.close()

    threads = [threading.Thread(target=attempt_create) for _ in range(2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert sorted(results) == ["conflict", "ok"]
    assert (
        BoatModel.objects.filter(brand=brand, normalized_name="flagship 40").count()
        == 1
    )


@pytest.mark.django_db(transaction=True)
def test_concurrent_creation_of_the_other_placeholder_for_the_same_brand_yields_one_winner():
    brand = BoatBrand.objects.create(name="Concurrent Yachts II")
    # Task 4 (once it lands) auto-creates an Other placeholder via a post_save
    # signal on BoatBrand — clear it first so the race below is genuine. This
    # is a no-op today, before Task 4 exists, since no placeholder exists yet.
    BoatModel.objects.filter(brand=brand, is_other_placeholder=True).delete()
    results = []

    def attempt_create(name):
        try:
            BoatModel.objects.create(
                brand=brand, name=name, is_other_placeholder=True
            )
            results.append("ok")
        except IntegrityError:
            results.append("conflict")
        finally:
            connection.close()

    threads = [
        threading.Thread(target=attempt_create, args=(name,))
        for name in ("Other", "Other (alt)")
    ]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert sorted(results) == ["conflict", "ok"]
    assert (
        BoatModel.objects.filter(brand=brand, is_other_placeholder=True).count() == 1
    )
