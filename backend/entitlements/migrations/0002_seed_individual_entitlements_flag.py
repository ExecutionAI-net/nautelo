from django.db import migrations

FLAG_KEY = "individual_entitlements"
# platform_settings.FeatureFlag.description is CharField(max_length=255) —
# keep this string under that limit.
FLAG_DESCRIPTION = (
    "Spec 35.1 rollout flag. On = 403 listing_entitlement_required when an "
    "individual seller has no listing right, at draft creation and at submit. "
    "Off = nothing is refused, but the ledger is still written."
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
        ("entitlements", "0001_userentitlement"),
        ("platform_settings", "0004_featureflag"),
    ]

    operations = [migrations.RunPython(create_flag, delete_flag)]
