"""Spec §38: "Two product records, inactive until valid environment Stripe IDs
are supplied", plus spec §35.1's rollout flag, seeded DISABLED.

Deliberately NOT seeded: any amount, any Stripe identifier. Spec §38 forbids
"decorative financial values or test Stripe IDs" in production setup, and the
payments_product_active_is_fully_configured constraint makes an unconfigured row
impossible to activate — so staff must supply the real values per environment
before Checkout can open at all. Idempotent via get_or_create (spec §38:
"Commands are idempotent").
"""

from decimal import Decimal

from django.db import migrations

FLAG_KEY = "stripe_entitlement_checkout"
# platform_settings.FeatureFlag.description is CharField(max_length=255) —
# keep this string under that limit.
FLAG_DESCRIPTION = (
    "Spec 35.1 rollout flag. On = POST /api/v1/checkout-sessions/ accepts "
    "requests. Off = 403 feature_disabled. The Stripe webhook is never gated by "
    "this flag, so an in-flight payment still fulfils after it is turned off."
)

PRODUCTS = [
    {
        "code": "INDIVIDUAL_LISTING_RIGHT",
        "name_en": "Individual listing right",
        "name_it": "Diritto di annuncio individuale",
        "name_es": "Derecho de anuncio individual",
        "description_en": "One paid listing right for a private seller.",
        "entitlement_valid_days": 365,
        "publication_days": 30,
        "display_order": 1,
    },
    {
        "code": "LISTING_MEDIA_UPGRADE",
        "name_en": "Listing media upgrade",
        "name_it": "Upgrade media annuncio",
        "name_es": "Mejora de medios del anuncio",
        "description_en": "Raises one listing's allowance to 20 images and 1 video.",
        "entitlement_valid_days": 365,
        "publication_days": None,
        "display_order": 2,
    },
]


def seed(apps, schema_editor):
    MarketplaceProduct = apps.get_model("payments", "MarketplaceProduct")
    FeatureFlag = apps.get_model("platform_settings", "FeatureFlag")

    for definition in PRODUCTS:
        MarketplaceProduct.objects.get_or_create(
            code=definition["code"],
            defaults={
                **definition,
                "currency": "EUR",
                "display_amount": Decimal("0.00"),
                "stripe_product_id": "",
                "stripe_price_id": "",
                "is_active": False,
            },
        )

    FeatureFlag.objects.get_or_create(
        key=FLAG_KEY,
        defaults={"is_enabled": False, "description": FLAG_DESCRIPTION},
    )


def unseed(apps, schema_editor):
    """Removes only the flag.

    Reversing is a rollback, and spec §35.3 says to "keep additive schema/data
    intact". A staff admin may already have entered real Stripe ids; deleting
    the product rows would destroy that configuration, and would fail anyway
    once a PaymentOrder referenced one through PROTECT.
    """
    FeatureFlag = apps.get_model("platform_settings", "FeatureFlag")
    FeatureFlag.objects.filter(key=FLAG_KEY).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("payments", "0001_initial"),
        ("platform_settings", "0004_featureflag"),
    ]

    operations = [migrations.RunPython(seed, unseed)]
