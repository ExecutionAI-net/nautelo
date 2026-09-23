"""Fills the Italian and Spanish names and descriptions of the listing
packages and marketplace products that staff created with English only, so
/pricing/?locale=it|es (brokers.plan_views) no longer falls back to English.
Texts a human already wrote are left alone."""

from django.db import migrations


def _period(days: int, lang: str) -> str:
    units = {
        "it": (("settimana", "settimane"), ("mese", "mesi"), "giorni"),
        "es": (("semana", "semanas"), ("mes", "meses"), "dias"),
    }[lang]
    if days % 30 == 0:
        n = days // 30
        return f"{n} {units[1][0] if n == 1 else units[1][1]}"
    if days % 7 == 0:
        n = days // 7
        return f"{n} {units[0][0] if n == 1 else units[0][1]}"
    return f"{days} {units[2]}"


def _description(days: int, images: int, videos: int, lang: str) -> str:
    if lang == "it":
        return f"La tua barca online per {days} giorni con fino a {images} foto e {videos} video."
    return f"Tu barco en linea durante {days} dias con hasta {images} fotos y {videos} video."


PRODUCTS = {
    "INDIVIDUAL_LISTING_RIGHT": {
        "it": ("Diritto di inserzione", "Pubblica un annuncio privato sul marketplace."),
        "es": ("Derecho de anuncio", "Publica un anuncio privado en el marketplace."),
    },
    "LISTING_MEDIA_UPGRADE": {
        "it": ("Upgrade media", "Piu foto e video per il tuo annuncio."),
        "es": ("Mejora de medios", "Mas fotos y videos para tu anuncio."),
    },
}


def fill(apps, schema_editor):
    Package = apps.get_model("payments", "ListingPackage")
    for package in Package.objects.all():
        changed = []
        for lang in ("it", "es"):
            if not getattr(package, f"name_{lang}").strip():
                prefix = "Annuncio a pagamento" if lang == "it" else "Anuncio de pago"
                setattr(package, f"name_{lang}", f"{prefix} - {_period(package.publication_days, lang)}")
                changed.append(f"name_{lang}")
            if not getattr(package, f"description_{lang}").strip():
                setattr(package, f"description_{lang}", _description(package.publication_days, package.image_limit, package.video_limit, lang))
                changed.append(f"description_{lang}")
        if changed:
            package.save(update_fields=changed)
    Product = apps.get_model("payments", "MarketplaceProduct")
    for product in Product.objects.filter(code__in=list(PRODUCTS)):
        changed = []
        for lang, (name, description) in PRODUCTS[product.code].items():
            if not getattr(product, f"name_{lang}").strip():
                setattr(product, f"name_{lang}", name)
                changed.append(f"name_{lang}")
            if not getattr(product, f"description_{lang}").strip():
                setattr(product, f"description_{lang}", description)
                changed.append(f"description_{lang}")
        if changed:
            product.save(update_fields=changed)


class Migration(migrations.Migration):
    dependencies = [("payments", "0007_seed_listing_packages")]
    operations = [migrations.RunPython(fill, migrations.RunPython.noop)]
