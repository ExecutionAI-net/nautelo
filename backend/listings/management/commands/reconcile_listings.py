import json

from django.core.management.base import BaseCommand, CommandError

from listings.reconciliation import reconcile


class Command(BaseCommand):
    help = "Print the listing migration reconciliation report; exit non-zero on problems."

    def handle(self, *args, **options):
        report = reconcile()
        self.stdout.write(json.dumps(report, indent=2))
        if not report["ok"]:
            raise CommandError("Reconciliation found problems.")
