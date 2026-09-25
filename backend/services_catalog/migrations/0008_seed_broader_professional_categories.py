from django.db import migrations

# Customer feedback (2026-09-25): the professional-registration category list
# was too narrow (only the six SEO categories). These are broader, general
# categories a professional can pick alongside/instead of those - is_active
# only, no has_seo_page: they have no dedicated SEO landing page, they only
# need to appear in the ordinary category pickers (registration, directory
# filters), which filter on is_active alone (services_catalog/views.py).
NEW_CATEGORIES = [
    {"slug": "mechanics", "name_en": "Mechanics", "name_it": "Meccanica", "name_es": "Mecánica", "icon_key": "build", "display_order": 70},
    {"slug": "electronics", "name_en": "Electronics", "name_it": "Elettronica", "name_es": "Electrónica", "icon_key": "bolt", "display_order": 80},
    {"slug": "woodwork-carpentry", "name_en": "Woodwork / Carpentry", "name_it": "Falegnameria", "name_es": "Carpintería", "icon_key": "carpenter", "display_order": 90},
    {"slug": "fiberglass-composites", "name_en": "Fiberglass / Composites", "name_it": "Vetroresina / Compositi", "name_es": "Fibra de vidrio / Compuestos", "icon_key": "layers", "display_order": 100},
    {"slug": "painting", "name_en": "Painting", "name_it": "Verniciatura", "name_es": "Pintura", "icon_key": "format_paint", "display_order": 110},
    {"slug": "consulting", "name_en": "Consulting", "name_it": "Consulenza", "name_es": "Consultoría", "icon_key": "support_agent", "display_order": 120},
    {"slug": "accounting-administrative-services", "name_en": "Accounting / Administrative Services", "name_it": "Contabilità / Servizi amministrativi", "name_es": "Contabilidad / Servicios administrativos", "icon_key": "receipt_long", "display_order": 130},
    {"slug": "legal-services", "name_en": "Legal Services", "name_it": "Servizi legali", "name_es": "Servicios legales", "icon_key": "gavel", "display_order": 140},
    {"slug": "charter-agency", "name_en": "Charter Agency", "name_it": "Agenzia di charter", "name_es": "Agencia de chárter", "icon_key": "sailing", "display_order": 150},
]


def seed_categories(apps, schema_editor):
    ServiceCategory = apps.get_model("services_catalog", "ServiceCategory")
    for entry in NEW_CATEGORIES:
        ServiceCategory.objects.get_or_create(
            slug=entry["slug"],
            defaults={
                "name_en": entry["name_en"],
                "name_it": entry["name_it"],
                "name_es": entry["name_es"],
                "icon_key": entry["icon_key"],
                "display_order": entry["display_order"],
                "is_active": True,
                "has_seo_page": False,
            },
        )


class Migration(migrations.Migration):
    dependencies = [("services_catalog", "0007_professionalservice_photo_key")]

    operations = [
        # Reverse is a deliberate no-op, same rationale as 0002: these rows are
        # staff-editable editorial content and a rollback must keep additive
        # data intact.
        migrations.RunPython(seed_categories, migrations.RunPython.noop),
    ]
