"""Products, orders and webhook events (spec §11.9).

NOTHING in this module stores card data. Spec §23.1 is explicit that "Staff does
not enter card data"; Stripe Checkout is hosted by Stripe and this codebase sees
only identifiers, an amount and a currency. A reviewer finding a `last4`, a card
brand, a cardholder name or a receipt body here must reject the change.
"""

from django.conf import settings
from django.db import models
from django.db.models import Q

from common.models import UUIDTimeStampedModel

from .enums import PRODUCT_CODES, ProductCode


class MarketplaceProductQuerySet(models.QuerySet):
    def active(self):
        return self.filter(is_active=True)


class MarketplaceProduct(UUIDTimeStampedModel):
    """Spec §11.9. Stripe is the payment amount authority at Checkout creation
    time; `display_amount` is for UI and must be reconciled against the live
    Stripe Price before a session opens (spec §23.5, payments.products)."""

    code = models.CharField(max_length=32, unique=True, choices=ProductCode.choices)
    name_en = models.CharField(max_length=120)
    name_it = models.CharField(max_length=120, blank=True, default="")
    name_es = models.CharField(max_length=120, blank=True, default="")
    description_en = models.TextField(blank=True, default="")
    description_it = models.TextField(blank=True, default="")
    description_es = models.TextField(blank=True, default="")
    stripe_product_id = models.CharField(max_length=64, blank=True, default="")
    stripe_price_id = models.CharField(max_length=64, blank=True, default="")
    currency = models.CharField(max_length=3, default="EUR")
    display_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    entitlement_valid_days = models.PositiveIntegerField(default=365)
    publication_days = models.PositiveIntegerField(null=True, blank=True)
    is_active = models.BooleanField(default=False)
    display_order = models.PositiveIntegerField(default=0)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    objects = MarketplaceProductQuerySet.as_manager()

    class Meta:
        ordering = ["display_order", "code"]
        constraints = [
            # Spec §23.1: "supports exactly these product codes in this
            # release". Enforced in the database, not only in the enum, so no
            # data migration or shell session can widen the catalogue.
            models.CheckConstraint(
                condition=Q(code__in=sorted(PRODUCT_CODES)),
                name="payments_product_code_is_known",
            ),
            models.CheckConstraint(
                condition=Q(display_amount__gte=0),
                name="payments_product_amount_is_not_negative",
            ),
            models.CheckConstraint(
                condition=Q(currency__regex=r"^[A-Z]{3}$"),
                name="payments_product_currency_is_iso4217",
            ),
            models.CheckConstraint(
                condition=Q(entitlement_valid_days__gt=0),
                name="payments_product_validity_is_positive",
            ),
            models.CheckConstraint(
                condition=Q(publication_days__isnull=True) | Q(publication_days__gt=0),
                name="payments_product_publication_days_is_positive_or_null",
            ),
            # Spec §38 / §32.1 step 8: products are seeded "inactive until valid
            # environment Stripe IDs are supplied", and production "must not
            # include ... decorative financial values or test Stripe IDs". This
            # is that rule as a database invariant: a row cannot be active
            # unless it has a real amount and both Stripe identifiers. It is
            # also why `display_amount` permits 0 at all.
            models.CheckConstraint(
                condition=~Q(is_active=True)
                | (
                    Q(display_amount__gt=0)
                    & ~Q(stripe_product_id="")
                    & ~Q(stripe_price_id="")
                ),
                name="payments_product_active_is_fully_configured",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.code} ({'active' if self.is_active else 'inactive'})"
