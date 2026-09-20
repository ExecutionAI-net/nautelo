from decimal import Decimal

from django.utils import timezone

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from payments.enums import PaymentOrderStatus, ProductCode
from payments.models import MarketplaceProduct, PaymentOrder


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


_UNSET = object()


def make_order(
    *,
    user,
    product,
    status=PaymentOrderStatus.CREATED,
    amount=Decimal("49.00"),
    currency="EUR",
    listing=None,
    quantity=1,
    stripe_checkout_session_id="",
    stripe_payment_intent_id="",
    client_idempotency_key="",
    paid_at=_UNSET,
    fulfilled_at=_UNSET,
    fulfilled_entitlement=None,
    metadata=None,
    idempotency_key=None,
):
    """Build one PaymentOrder.

    `paid_at`/`fulfilled_at` default to a value consistent with `status` so an
    ordinary caller does not have to think about the database constraints — pass
    an explicit `None` to build the inconsistent row a constraint test needs. `amount` is
    coerced so a caller may pass a plain string.
    """
    order = PaymentOrder(
        user=user,
        product=product,
        listing=listing,
        quantity=quantity,
        status=status,
        amount=Decimal(amount),
        currency=currency,
        stripe_checkout_session_id=stripe_checkout_session_id,
        stripe_payment_intent_id=stripe_payment_intent_id,
        client_idempotency_key=client_idempotency_key,
        fulfilled_entitlement=fulfilled_entitlement,
        metadata=metadata or {},
        paid_at=None if paid_at is _UNSET else paid_at,
        fulfilled_at=None if fulfilled_at is _UNSET else fulfilled_at,
    )
    if paid_at is _UNSET and status in {
        PaymentOrderStatus.PAID,
        PaymentOrderStatus.FULFILLED,
        PaymentOrderStatus.REFUNDED,
        PaymentOrderStatus.DISPUTED,
    }:
        order.paid_at = timezone.now()
    if fulfilled_at is _UNSET and status == PaymentOrderStatus.FULFILLED:
        order.fulfilled_at = timezone.now()
    order.idempotency_key = (
        idempotency_key if idempotency_key is not None else f"checkout:{order.pk}"
    )
    order.save()
    return order
