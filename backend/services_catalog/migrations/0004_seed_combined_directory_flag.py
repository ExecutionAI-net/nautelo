from django.db import migrations

FLAG_KEY = "combined_services_professionals"
# Deviation from the plan's draft text, which was 328 characters: the column is
# platform_settings.FeatureFlag.description = CharField(max_length=255), so the
# original wording raised DataError on migrate. Condensed to 242 characters
# without dropping any of its meaning — the page-by-page enumeration it listed
# is the direct consequence of the endpoints 404ing, which the first clause
# already states.
FLAG_DESCRIPTION = (
    "Spec 35.1 rollout flag. When off, the combined Services / Professionals "
    "directory read endpoints return 404, so every public page built on them "
    "404s too and /sitemap.xml goes empty. The static 301 redirects in "
    "next.config.ts are NOT affected."
)


def seed_flag(apps, schema_editor):
    FeatureFlag = apps.get_model("platform_settings", "FeatureFlag")
    FeatureFlag.objects.get_or_create(
        key=FLAG_KEY,
        defaults={"is_enabled": True, "description": FLAG_DESCRIPTION},
    )


class Migration(migrations.Migration):
    dependencies = [
        ("services_catalog", "0003_professionalservice"),
        ("platform_settings", "0004_featureflag"),
    ]

    operations = [
        # Reverse is a no-op for the same reason as 0002: a rollback must not
        # delete an operator-toggleable row (spec 32.3).
        migrations.RunPython(seed_flag, migrations.RunPython.noop),
    ]
