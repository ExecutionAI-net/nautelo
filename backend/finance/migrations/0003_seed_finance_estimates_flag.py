"""Seed spec §35.1's `finance_estimates` rollout flag.

The literal is repeated here rather than imported from finance.listing_quotes:
a data migration must keep working when application code moves, and this file
mirrors listings/migrations/0004_seed_listing_revisions_flag.py exactly.
"""

from django.db import migrations

FLAG_KEY = "finance_estimates"
# FeatureFlag.description is varchar(255); keep this under that.
FLAG_DESCRIPTION = (
    "Spec §35.1 rollout flag. Gates the listing finance block and the "
    "listing_id context of POST /api/v1/finance/quotes/, not the manual "
    "calculator. Seeded disabled (spec §35.2 step 4)."
)


def create_flag(apps, schema_editor):
    FeatureFlag = apps.get_model("platform_settings", "FeatureFlag")
    FeatureFlag.objects.get_or_create(
        key=FLAG_KEY,
        defaults={"is_enabled": False, "description": FLAG_DESCRIPTION},
    )


def delete_flag(apps, schema_editor):
    FeatureFlag = apps.get_model("platform_settings", "FeatureFlag")
    FeatureFlag.objects.filter(key=FLAG_KEY).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("finance", "0002_seed_default_configuration"),
        ("platform_settings", "0004_featureflag"),
    ]

    operations = [migrations.RunPython(create_flag, delete_flag)]
