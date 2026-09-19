import csv
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

from taxonomy.models import BoatBrand, BoatModel
from taxonomy.services import normalize_taxonomy_name

DEFAULT_CSV = Path(__file__).resolve().parents[2] / "data_boat_models.csv"


class Command(BaseCommand):
    help = "Import the brand/model seed catalogue (idempotent: existing brands and models are kept)."

    def add_arguments(self, parser):
        parser.add_argument("--csv", default=str(DEFAULT_CSV))

    @transaction.atomic
    def handle(self, *args, **options):
        brands = {b.normalized_name: b for b in BoatBrand.objects.all()}
        known = set(BoatModel.objects.values_list("brand_id", "normalized_name"))
        new_brands = new_models = 0
        with open(options["csv"], newline="", encoding="utf8") as handle:
            for row in csv.DictReader(handle):
                name, model = row["brand"].strip(), row["model"].strip()
                key = normalize_taxonomy_name(name)
                brand = brands.get(key)
                if brand is None:
                    brand = BoatBrand.objects.create(name=name)
                    brands[key] = brand
                    new_brands += 1
                pair = (brand.pk, normalize_taxonomy_name(model))
                if pair in known:
                    continue
                BoatModel.objects.create(brand=brand, name=model)
                known.add(pair)
                new_models += 1
        self.stdout.write(self.style.SUCCESS(f"Catalogue imported: {new_brands} new brands, {new_models} new models."))
