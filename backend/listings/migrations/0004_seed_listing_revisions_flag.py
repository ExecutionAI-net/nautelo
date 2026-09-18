from django.db import migrations

FLAG_KEY = "listing_revisions"
FLAG_DESCRIPTION = (
    "Spec §35.1 rollout flag. Gates every listing draft/submit/decision "
    "mutation endpoint. Seeded disabled so code can ship ahead of the feature "
    "(spec §35.2 step 4)."
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
        ("listings", "0003_listingsnapshot_listingrevision"),
        ("platform_settings", "0004_featureflag"),
    ]

    operations = [migrations.RunPython(create_flag, delete_flag)]
