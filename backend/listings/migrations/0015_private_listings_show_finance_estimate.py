"""Private listings show the estimated monthly payment too (product decision 2026-09-26).

The flag used to be broker-only (a check constraint). Private listings now always
carry it, at the platform's standard rate and term, without a switch in the form.
"""

from django.db import migrations


def private_listings_show_finance(apps, schema_editor):
    BoatListing = apps.get_model("listings", "BoatListing")
    BoatListing.objects.filter(seller_type="PRIVATE", show_finance_estimate=False).update(show_finance_estimate=True)


class Migration(migrations.Migration):
    dependencies = [
        ("listings", "0014_boatlisting_status_paused"),
    ]

    operations = [
        migrations.RemoveConstraint(model_name="boatlisting", name="listings_finance_flag_requires_broker"),
        migrations.RunPython(private_listings_show_finance, migrations.RunPython.noop),
    ]
