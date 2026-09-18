from decimal import Decimal

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from payments.enums import ProductCode
from payments.models import MarketplaceProduct


def make_payments_seller(email="p14-seller@example.com", **extra):
    """A verified private seller.

    Every email in this package is prefixed `p14-` so it can never collide with
    a seed or with another package's fixtures ("user@example.com",
    "private-seller@example.com", "entitlement-admin@example.com").
    """
    return make_user(email, role=UserRole.PRIVATE_SELLER, verified=True, **extra)


def configure_product(product, **overrides):
    """Take a SEEDED, inactive product and give it a working configuration.

    Deliberately an UPDATE of the migration-seeded row, never a create: `code`
    is unique, so a create would collide with the seed. It is also why no test
    in this package uses `django_db(transaction=True)` — that would truncate the
    tables and drop the migration-seeded product and flag rows, breaking every
    later test in the session.
    """
    defaults = {
        "display_amount": Decimal("49.00"),
        "currency": "EUR",
        "stripe_product_id": "prod_test_listing_right",
        "stripe_price_id": "price_test_listing_right",
        "is_active": True,
    }
    defaults.update(overrides)
    for key, value in defaults.items():
        setattr(
            product,
            key,
            Decimal(value) if key == "display_amount" and not isinstance(value, Decimal) else value,
        )
    product.save()
    return product


def listing_right_product(**overrides):
    return configure_product(
        MarketplaceProduct.objects.get(code=ProductCode.INDIVIDUAL_LISTING_RIGHT),
        **overrides,
    )


def media_upgrade_product(**overrides):
    overrides.setdefault("stripe_product_id", "prod_test_media_upgrade")
    overrides.setdefault("stripe_price_id", "price_test_media_upgrade")
    overrides.setdefault("display_amount", Decimal("19.00"))
    return configure_product(
        MarketplaceProduct.objects.get(code=ProductCode.LISTING_MEDIA_UPGRADE),
        **overrides,
    )
