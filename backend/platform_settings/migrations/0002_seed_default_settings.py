from django.db import migrations

from platform_settings.registry import SETTINGS_REGISTRY


def seed_default_settings(apps, schema_editor):
    PlatformSetting = apps.get_model("platform_settings", "PlatformSetting")
    for key, definition in SETTINGS_REGISTRY.items():
        PlatformSetting.objects.get_or_create(key=key, defaults={"value": definition.default})


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [("platform_settings", "0001_initial")]
    operations = [migrations.RunPython(seed_default_settings, noop_reverse)]
