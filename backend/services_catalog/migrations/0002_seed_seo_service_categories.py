from django.db import migrations

# Spec §1: "The six approved individual service pages remain indexable and keep
# their own canonical URLs." Spec §4.1 fixes the six routes; spec §11.2 makes
# them ServiceCategory rows flagged has_seo_page, not bespoke templates.
SEO_CATEGORIES = [
    {
        "slug": "full-brokerage",
        "name_en": "Full brokerage",
        "name_it": "Intermediazione completa",
        "name_es": "Intermediación completa",
        "icon_key": "handshake",
        "display_order": 10,
    },
    {
        "slug": "legal",
        "name_en": "Legal",
        "name_it": "Legale",
        "name_es": "Legal",
        "icon_key": "gavel",
        "display_order": 20,
    },
    {
        "slug": "insurance",
        "name_en": "Insurance",
        "name_it": "Assicurazioni",
        "name_es": "Seguros",
        "icon_key": "shield",
        "display_order": 30,
    },
    {
        "slug": "engines-maintenance",
        "name_en": "Engines and maintenance",
        "name_it": "Motori e manutenzione",
        "name_es": "Motores y mantenimiento",
        "icon_key": "build",
        "display_order": 40,
    },
    {
        "slug": "transport-delivery",
        "name_en": "Transport and delivery",
        "name_it": "Trasporto e consegna",
        "name_es": "Transporte y entrega",
        "icon_key": "local_shipping",
        "display_order": 50,
    },
    {
        "slug": "nautical-marketing",
        "name_en": "Nautical marketing",
        "name_it": "Marketing nautico",
        "name_es": "Marketing náutico",
        "icon_key": "campaign",
        "display_order": 60,
    },
]


def seed_seo_categories(apps, schema_editor):
    ServiceCategory = apps.get_model("services_catalog", "ServiceCategory")
    for entry in SEO_CATEGORIES:
        ServiceCategory.objects.get_or_create(
            slug=entry["slug"],
            defaults={
                "name_en": entry["name_en"],
                "name_it": entry["name_it"],
                "name_es": entry["name_es"],
                "icon_key": entry["icon_key"],
                "display_order": entry["display_order"],
                "is_active": True,
                "has_seo_page": True,
            },
        )


class Migration(migrations.Migration):
    dependencies = [("services_catalog", "0001_initial")]

    operations = [
        # Reverse is a deliberate no-op: these rows are staff-editable editorial
        # content and spec §32.3 requires a rollback to keep additive data intact.
        migrations.RunPython(seed_seo_categories, migrations.RunPython.noop),
    ]
