"""Download GeoNames and refresh Region/City for the countries the marketplace serves."""

import io
import urllib.request
import zipfile

from django.core.management.base import BaseCommand

from listings.form_options import COUNTRIES
from places.importer import load_alternate_names, load_cities, load_regions

BASE = "https://download.geonames.org/export/dump/"


def _fetch_zip_lines(name: str):
    with urllib.request.urlopen(f"{BASE}{name}.zip", timeout=300) as response:  # noqa: S310 - fixed https host
        archive = zipfile.ZipFile(io.BytesIO(response.read()))
    with archive.open(f"{name}.txt") as handle:
        yield from (line.decode("utf-8") for line in handle)


class Command(BaseCommand):
    help = "Refresh regions and cities from GeoNames (CC BY 4.0) for the supported countries."

    def add_arguments(self, parser):
        parser.add_argument("--dataset", default="cities1000", help="GeoNames cities file: cities500, cities1000, cities5000 or cities15000")
        parser.add_argument("--no-alternate-names", action="store_true", help="Skip the large per-language names file (Italian and Spanish names stay empty)")

    def handle(self, *args, dataset, no_alternate_names, **options):
        countries = set(COUNTRIES)
        with urllib.request.urlopen(f"{BASE}admin1CodesASCII.txt", timeout=120) as response:  # noqa: S310
            admin1 = [line.decode("utf-8") for line in response]
        regions = load_regions(admin1, countries)
        cities = list(_fetch_zip_lines(dataset))
        alternates = {}
        if not no_alternate_names:
            wanted = {int(line.split("\t", 1)[0]) for line in cities}
            alternates = load_alternate_names(_fetch_zip_lines("alternateNamesV2"), wanted)
        total = load_cities(cities, countries, regions, alternates)
        self.stdout.write(self.style.SUCCESS(f"{len(regions)} regions, {total} cities"))
