"""Carry each broker listing's stored finance settings onto its snapshots.

Migration 0006 defaults every existing snapshot to finance-off. For a broker
listing that already has the toggle on, that would silently remove a live
public estimate on deploy, so the values are copied forward here.

(The Phase 9 plan calls these migrations 0005 and 0006; the prerequisite
`fix-finance-percent-ceiling` PR landed on dev first and took 0005, so the
schema migration is 0006 and this backfill is 0007. Only the numbering moved.)

There is no per-version history to recover — the columns did not exist before
now — so every snapshot of a listing receives that listing's current values.
This is expected to run against zero rows in every environment that exists
today (no broker listing has been published with the toggle on) and is written
anyway so the migration is correct wherever it is applied. That expectation is
verified against each real database by the controller before this migration
merges, not assumed — see the Phase 9 plan's Task 1, Step 3e.

`apps.get_model` returns the historical model, which carries Django's plain
default manager rather than listings.models.ListingSnapshotQuerySet — so the
.update() below is not blocked by that queryset's refusal. Phase 11 contract
rule 3 ("never mutate a ListingSnapshot") governs application code; a schema
backfill inside the migration that adds the columns is the one sanctioned place.
"""

from django.db import migrations

BROKER = "BROKER"


def copy_finance_settings_onto_snapshots(apps, schema_editor):
    BoatListing = apps.get_model("listings", "BoatListing")
    ListingSnapshot = apps.get_model("listings", "ListingSnapshot")

    configured = BoatListing.objects.filter(seller_type=BROKER).exclude(
        show_finance_estimate=False,
        finance_down_payment_override_percent__isnull=True,
        finance_rate_override_percent__isnull=True,
        finance_term_override_months__isnull=True,
    )
    for listing in configured.iterator():
        ListingSnapshot.objects.filter(listing_id=listing.pk).update(
            show_finance_estimate=listing.show_finance_estimate,
            finance_down_payment_override_percent=(
                listing.finance_down_payment_override_percent
            ),
            finance_rate_override_percent=listing.finance_rate_override_percent,
            finance_term_override_months=listing.finance_term_override_months,
        )


def noop_reverse(apps, schema_editor):
    """Reversing 0006 drops the columns outright; there is nothing to undo."""


class Migration(migrations.Migration):
    dependencies = [("listings", "0006_listingsnapshot_finance_settings")]
    operations = [
        migrations.RunPython(copy_finance_settings_onto_snapshots, noop_reverse)
    ]
