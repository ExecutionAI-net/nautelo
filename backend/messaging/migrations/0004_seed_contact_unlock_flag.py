from django.db import migrations

FLAG_KEY = "contact_unlock"
# platform_settings.FeatureFlag.description is CharField(max_length=255) - this
# string is well under the limit. Keep any edit under it or migrate() raises
# DataError (the lesson recorded in services_catalog/0004).
FLAG_DESCRIPTION = (
    "Spec 35.1 flag. Off = the contact endpoint still answers, but always with "
    "the LOCKED masked payload, even for a viewer holding a grant. On = grant "
    "holders receive the real business email/phone. Grants are created by the "
    "inquiry flow either way."
)


def seed_flag(apps, schema_editor):
    FeatureFlag = apps.get_model("platform_settings", "FeatureFlag")
    FeatureFlag.objects.get_or_create(
        key=FLAG_KEY,
        # Seeded DISABLED: spec 35.2 step 4 deploys code with features off, and
        # listings/0004's listing_revisions flag set the precedent.
        defaults={"is_enabled": False, "description": FLAG_DESCRIPTION},
    )


class Migration(migrations.Migration):
    dependencies = [
        # Phase 6's last migration (confirmed against messaging/migrations/).
        ("messaging", "0003_message_contactaccessgrant"),
        ("platform_settings", "0004_featureflag"),
    ]

    operations = [
        # Reverse is a no-op: a rollback must not delete an operator-toggleable
        # row (spec 32.3), matching services_catalog/0004 and listings/0004.
        migrations.RunPython(seed_flag, migrations.RunPython.noop),
    ]
