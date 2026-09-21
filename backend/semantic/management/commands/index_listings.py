from django.core.management.base import BaseCommand

from semantic.indexing import index_all


class Command(BaseCommand):
    help = "Build or refresh search vectors for every published listing (safe to re-run)."

    def handle(self, *args, **options):
        self.stdout.write(f"indexed {index_all()} listings")
