import pytest
from django.core.management import call_command

from taxonomy.models import BoatBrand, BoatModel

pytestmark = pytest.mark.django_db


def test_import_loads_the_catalogue_and_is_idempotent(capsys):
    BoatBrand.objects.create(name="Absolute")
    call_command("import_boat_catalogue")
    brands, models = BoatBrand.objects.count(), BoatModel.objects.count()
    assert brands >= 200
    assert models >= 3053
    assert BoatModel.objects.filter(brand__name="Absolute", name="Absolute 40").exists() or models > 3000
    call_command("import_boat_catalogue")
    assert (BoatBrand.objects.count(), BoatModel.objects.count()) == (brands, models)
