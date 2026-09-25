"""Attach places.City to published listings that only have free-text locations."""

from django.core.management.base import BaseCommand

from places.matching import backfill_snapshots


class Command(BaseCommand):
    help = "Dry run by default; pass --apply to write. Lists the locations that could not be matched."

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true")

    def handle(self, *args, apply, **options):
        result = backfill_snapshots(apply=apply)
        verb = "updated" if apply else "would update"
        self.stdout.write(f"{verb} {result['matched']} listings")
        for country, region, city in result["unmatched"]:
            self.stdout.write(f"unmatched: {country} / {region} / {city}")
