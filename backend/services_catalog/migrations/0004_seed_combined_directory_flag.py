from django.db import migrations

FLAG_KEY = "combined_services_professionals"
# Deviation from the plan's draft text, which was 356 characters: the column is
# platform_settings.FeatureFlag.description = CharField(max_length=255), so the
# original wording raised DataError on migrate. Condensed to 236 characters
# while keeping the page-by-page enumeration (/services/professionals/,
# professional detail, the six /services/<slug>/ SEO pages), since it fits
# under the limit alongside the rest of the meaning.
FLAG_DESCRIPTION = (
    "Spec 35.1 flag. Off = 404 from the combined Services/Professionals read "
    "endpoints, so /services/professionals/, professional detail and the six "
    "/services/<slug>/ SEO pages 404, and /sitemap.xml empties. "
    "next.config.ts 301s NOT affected."
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
