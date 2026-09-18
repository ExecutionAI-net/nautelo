from django.db import migrations

FLAG_KEY = "unique_listing_views"
# platform_settings.FeatureFlag.description is CharField(max_length=255) —
# keep this string under that limit.
FLAG_DESCRIPTION = (
    "Spec §35.1 rollout flag. Gates the ListingView write and the "
    "view_count_cached increment — NOT the public listing read, which stays "
    "open. Seeded disabled so code can ship ahead of the feature (spec §35.2 "
    "step 4); step 9 turns it on."
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
        ("analytics", "0001_listingview"),
        ("platform_settings", "0004_featureflag"),
    ]

    operations = [migrations.RunPython(create_flag, delete_flag)]
