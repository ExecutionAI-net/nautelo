"""Give brokers and professionals without a place a real one (demo data cleanup, safe to re-run)."""

from itertools import cycle

from django.core.management.base import BaseCommand

from brokers.models import BrokerOrganization
from places.matching import find_city
from places.models import City
from professionals.models import ProfessionalProfile

# Coastal cities used to spread organisations that have no usable location of their own.
COASTAL = [
    ("ES", "Barcelona"), ("IT", "Genoa"), ("ES", "Palma"), ("IT", "Naples"), ("ES", "Valencia"),
    ("IT", "Olbia"), ("ES", "Marbella"), ("IT", "La Spezia"), ("ES", "Alicante"), ("IT", "Palermo"),
]


def _fill(obj, city: City) -> None:
    obj.place_geoname_id = city.geoname_id
    obj.country_code = city.country_code
    obj.city = city.name_en
    if hasattr(obj, "region"):
        obj.region = city.region.name_en if city.region else ""


class Command(BaseCommand):
    help = "Dry run by default; pass --apply to write."

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true")

    def handle(self, *args, apply, **options):
        fallbacks = []
        for country, name in COASTAL:
            city = find_city(country, name)
            if city:
                fallbacks.append(city)
        if not fallbacks:
            self.stdout.write("No places imported yet: run sync_places first.")
            return
        pool = cycle(fallbacks)
        changed = 0
        for model in (BrokerOrganization, ProfessionalProfile):
            for obj in model.objects.filter(place_geoname_id__isnull=True):
                city = find_city(obj.country_code, obj.city) if obj.country_code and obj.city else None
                city = city or next(pool)
                _fill(obj, city)
                changed += 1
                self.stdout.write(f"{model.__name__} {obj.pk}: {city.name_en}, {city.country_code}")
                if apply:
                    obj.save()
        self.stdout.write(f"{'updated' if apply else 'would update'} {changed} organisations")
