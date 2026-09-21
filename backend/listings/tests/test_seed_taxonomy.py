import pytest

from listings.management.commands.seed_marketplace_data import Command
from taxonomy.models import BoatBrand

pytestmark = pytest.mark.django_db


def test_seed_taxonomy_reuses_a_brand_that_differs_only_by_case():
    existing = BoatBrand.objects.create(name="BWA")
    command = Command()
    rows = command.taxonomy()
    bwa = [row for row in rows if row[0].normalized_name == "bwa"]
    assert bwa and all(row[0].pk == existing.pk for row in bwa)
    assert BoatBrand.objects.filter(normalized_name="bwa").count() == 1
