from django.db import migrations

FLAG_KEY = "unified_inquiries"
# platform_settings.FeatureFlag.description is CharField(max_length=255) - a
# longer string raises DataError on migrate, which has happened in this project
# before (see services_catalog/migrations/0004). This text is 213 characters.
FLAG_DESCRIPTION = (
    "Spec 35.1 flag. Off = every /api/v1/inquiries/, /api/v1/inquiry-drafts/ "
    "and /api/v1/conversations/ endpoint returns 403 feature_disabled and the "
    "shared InquiryForm is not rendered on any page."
)


def seed_flag(apps, schema_editor):
    FeatureFlag = apps.get_model("platform_settings", "FeatureFlag")
    FeatureFlag.objects.get_or_create(
        key=FLAG_KEY,
        defaults={"is_enabled": True, "description": FLAG_DESCRIPTION},
    )


class Migration(migrations.Migration):
    dependencies = [
        ("messaging", "0001_conversation"),
        ("platform_settings", "0004_featureflag"),
    ]

    operations = [
        # Reverse is a no-op, mirroring services_catalog/0004: a rollback must
        # not delete an operator-toggleable row (spec 32.3).
        migrations.RunPython(seed_flag, migrations.RunPython.noop),
    ]
