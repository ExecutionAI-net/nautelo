"""Spec §35.2 step 3: "Run bounded backfills and reconciliation."

A thin synchronous wrapper so an operator can reconcile without a broker or a
worker — during a deploy, or when repairing one listing. The behaviour is the
Celery task's, called directly; nothing is duplicated here.
"""

from django.core.management.base import BaseCommand

from analytics.tasks import RECONCILIATION_BATCH_SIZE, reconcile_listing_view_counts


class Command(BaseCommand):
    help = "Recompute BoatListing.view_count_cached from ListingView rows."

    def add_arguments(self, parser):
        parser.add_argument(
            "--batch-size",
            type=int,
            default=RECONCILIATION_BATCH_SIZE,
            help="Listings per query (default: %(default)s).",
        )
        parser.add_argument(
            "--listing-id",
            action="append",
            dest="listing_ids",
            default=None,
            help="Limit the run to this listing. Repeatable.",
        )

    def handle(self, *args, **options):
        report = reconcile_listing_view_counts(
            batch_size=options["batch_size"], listing_ids=options["listing_ids"]
        )
        self.stdout.write(
            "checked={checked} corrected={corrected} drift={drift}".format(**report)
        )
