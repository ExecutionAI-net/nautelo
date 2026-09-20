from django.db import migrations

NAMES = {
    "INDIVIDUAL_LISTING_RIGHT": {
        "name_en": "Paid listing",
        "name_it": "Annuncio a pagamento",
        "name_es": "Anuncio de pago",
        "description_en": "One paid listing for a private seller. No expiry: buy as many as you need, use one per submission for review. Includes 20 photos and 1 video.",
        "description_it": "Un annuncio a pagamento per il venditore privato. Nessuna scadenza: usane uno a ogni invio. Include 20 foto e 1 video.",
        "description_es": "Un anuncio de pago para el vendedor particular. Sin caducidad: usa uno por cada envio. Incluye 20 fotos y 1 video.",
        "entitlement_valid_days": 3650,
    }
}


def forwards(apps, schema_editor):
    Product = apps.get_model("payments", "MarketplaceProduct")
    for code, values in NAMES.items():
        Product.objects.filter(code=code).update(**values)


class Migration(migrations.Migration):
    dependencies = [("payments", "0004_paymentorder_quantity_and_more")]
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
