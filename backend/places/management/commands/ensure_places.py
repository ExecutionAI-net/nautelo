"""Queue the first places import when the table is empty. Never fails a deploy."""

from django.core.management.base import BaseCommand

from places.models import City


class Command(BaseCommand):
    help = "If no places are loaded yet, queue the GeoNames sync on the maintenance queue."

    def handle(self, *args, **options):
        if City.objects.exists():
            self.stdout.write("places already loaded")
            return
        try:
            from places.tasks import sync_places

            sync_places.apply_async(retry=False)
            self.stdout.write("places import queued")
        except Exception as exc:  # noqa: BLE001 - a missing broker must not block a release
            self.stderr.write(f"could not queue the places import: {exc}")
