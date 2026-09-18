"""Seed spec §17.2's global broker-override switch (added by Phase 9).

Mirrors 0002_seed_default_settings' get_or_create shape so re-running is safe
(spec §38: every environment receives commands that *safely* create seed data).
"""

from django.db import migrations

SETTING_KEY = "finance.broker_overrides_enabled"
SETTING_DEFAULT = True


def seed_setting(apps, schema_editor):
    PlatformSetting = apps.get_model("platform_settings", "PlatformSetting")
    PlatformSetting.objects.get_or_create(
        key=SETTING_KEY, defaults={"value": SETTING_DEFAULT}
    )


def delete_setting(apps, schema_editor):
    PlatformSetting = apps.get_model("platform_settings", "PlatformSetting")
    PlatformSetting.objects.filter(key=SETTING_KEY).delete()


class Migration(migrations.Migration):
    dependencies = [("platform_settings", "0004_featureflag")]
    operations = [migrations.RunPython(seed_setting, delete_setting)]
