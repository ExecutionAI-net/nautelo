from django.db import migrations

PACKAGES = [
    ("1-month", "1 month", "1 mese", "1 mes", 30, 1),
    ("2-months", "2 months", "2 mesi", "2 meses", 60, 2),
    ("3-months", "3 months", "3 mesi", "3 meses", 90, 3),
]


def seed(apps, schema_editor):
    Package = apps.get_model("payments", "ListingPackage")
    for slug, en, it, es, days, order in PACKAGES:
        Package.objects.get_or_create(
            slug=slug,
            defaults={
                "name_en": f"Paid listing - {en}",
                "name_it": f"Annuncio a pagamento - {it}",
                "name_es": f"Anuncio de pago - {es}",
                "description_en": f"Your boat online for {days} days with up to 20 photos and 1 video.",
                "publication_days": days,
                "image_limit": 20,
                "video_limit": 1,
                "display_amount": 0,
                "is_active": False,
                "display_order": order,
            },
        )


class Migration(migrations.Migration):
    dependencies = [("payments", "0006_listing_packages")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
