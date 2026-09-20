"""Products, orders and webhook events (spec §11.9).

NOTHING in this module stores card data. Spec §23.1 is explicit that "Staff does
not enter card data"; Stripe Checkout is hosted by Stripe and this codebase sees
only identifiers, an amount and a currency. A reviewer finding a `last4`, a card
brand, a cardholder name or a receipt body here must reject the change.
"""

from django.conf import settings
from django.core.serializers.json import DjangoJSONEncoder
from django.db import models
from django.db.models import Q
from django.utils import timezone

from common.models import UUIDModel, UUIDTimeStampedModel

from .enums import (
    PAID_STATES,
    PRODUCT_CODES,
    PaymentOrderStatus,
    ProductCode,
    WebhookResult,
)


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


class ListingPackage(UUIDTimeStampedModel):
    """A purchasable private-seller listing: price, publication length and media
    limits are all editable in Django admin. The values are copied onto the right a
    buyer receives, so later edits never change rights that were already bought."""

    slug = models.SlugField(max_length=40, unique=True)
    name_en = models.CharField(max_length=120)
    name_it = models.CharField(max_length=120, blank=True, default="")
    name_es = models.CharField(max_length=120, blank=True, default="")
    description_en = models.TextField(blank=True, default="")
    description_it = models.TextField(blank=True, default="")
    description_es = models.TextField(blank=True, default="")
    publication_days = models.PositiveIntegerField()
    image_limit = models.PositiveSmallIntegerField(default=20)
    video_limit = models.PositiveSmallIntegerField(default=1)
    display_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    currency = models.CharField(max_length=3, default="EUR")
    stripe_product_id = models.CharField(max_length=64, blank=True, default="")
    stripe_price_id = models.CharField(max_length=64, blank=True, default="")
    is_active = models.BooleanField(default=False)
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["display_order", "publication_days"]
        constraints = [
            models.CheckConstraint(
                condition=Q(publication_days__gt=0), name="payments_package_days_positive"
            ),
            models.CheckConstraint(
                condition=~Q(is_active=True)
                | (
                    Q(display_amount__gt=0)
                    & ~Q(stripe_product_id="")
                    & ~Q(stripe_price_id="")
                ),
                name="payments_package_active_is_fully_configured",
            ),
        ]

    @property
    def code(self) -> str:
        """Duck-types MarketplaceProduct for price reconciliation."""
        return f"PACKAGE:{self.slug}"

    def __str__(self) -> str:
        return f"{self.name_en} ({self.publication_days} days)"


class PaymentOrderQuerySet(models.QuerySet):
    def for_user(self, user):
        return self.filter(user=user)

    def paid(self):
        return self.filter(status__in=sorted(PAID_STATES))

    def fulfilled(self):
        return self.filter(status=PaymentOrderStatus.FULFILLED)

    def needing_staff_review(self):
        """Spec §23.4: a refund or dispute against a consumed right does not
        unpublish anything; it "marks a payment case for staff review"."""
        return self.filter(metadata__staff_review_required=True)


class PaymentOrder(UUIDTimeStampedModel):
    """Spec §11.9 and §6.4.

    Created BEFORE the Stripe session (spec §23.2), which is why every Stripe
    identifier is blank-able and why the uniqueness on them is partial.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="payment_orders"
    )
    product = models.ForeignKey(
        MarketplaceProduct, on_delete=models.PROTECT, related_name="orders"
    )
    # Beyond spec §11.9's field list — see the plan's ruling. Required because
    # LISTING_MEDIA_UPGRADE binds to one listing (spec §23.1) and fulfilment
    # happens in a different process minutes later.
    listing = models.ForeignKey(
        "listings.BoatListing",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="payment_orders",
    )
    package = models.ForeignKey(
        ListingPackage,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="orders",
    )
    # Units bought in one checkout. `amount` is the total for all of them.
    quantity = models.PositiveSmallIntegerField(default=1)
    status = models.CharField(
        max_length=16,
        choices=PaymentOrderStatus.choices,
        default=PaymentOrderStatus.CREATED,
    )
    stripe_checkout_session_id = models.CharField(max_length=128, blank=True, default="")
    stripe_payment_intent_id = models.CharField(max_length=128, blank=True, default="")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default="EUR")
    # Spec §23.2: "Use an idempotency key derived from order UUID and
    # operation." Sent to STRIPE; deterministic, so a retried session creation
    # returns Stripe's same session instead of charging twice.
    idempotency_key = models.CharField(max_length=128, unique=True)
    # Spec §30.3's caller-supplied `Idempotency-Key` header. A DIFFERENT thing
    # from the field above; see the plan's ruling.
    client_idempotency_key = models.CharField(max_length=255, blank=True, default="")
    fulfilled_entitlement = models.ForeignKey(
        "entitlements.UserEntitlement",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="fulfilled_orders",
    )
    metadata = models.JSONField(default=dict, blank=True, encoder=DjangoJSONEncoder)
    paid_at = models.DateTimeField(null=True, blank=True)
    fulfilled_at = models.DateTimeField(null=True, blank=True)

    objects = PaymentOrderQuerySet.as_manager()

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "status"]),
            models.Index(fields=["product", "status"]),
            models.Index(fields=["status", "created_at"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=Q(amount__gt=0), name="payments_order_amount_is_positive"
            ),
            models.CheckConstraint(
                condition=Q(quantity__gte=1), name="payments_order_quantity_is_positive"
            ),
            models.CheckConstraint(
                condition=Q(currency__regex=r"^[A-Z]{3}$"),
                name="payments_order_currency_is_iso4217",
            ),
            # Spec §6.4: "PAID means Stripe has confirmed payment."
            models.CheckConstraint(
                condition=~Q(status__in=sorted(PAID_STATES)) | Q(paid_at__isnull=False),
                name="payments_order_paid_requires_paid_at",
            ),
            # Spec §6.4: "FULFILLED means an entitlement was created exactly
            # once." A FULFILLED row without one is that sentence being false.
            models.CheckConstraint(
                condition=~Q(status=PaymentOrderStatus.FULFILLED)
                | (
                    Q(fulfilled_entitlement__isnull=False)
                    & Q(fulfilled_at__isnull=False)
                ),
                name="payments_order_fulfilled_requires_entitlement_and_stamp",
            ),
            # Partial, because every order is blank on these until Stripe
            # answers: a plain unique index would let only ONE unpaid order
            # exist in the entire system.
            models.UniqueConstraint(
                fields=["stripe_checkout_session_id"],
                condition=~Q(stripe_checkout_session_id=""),
                name="payments_order_one_row_per_checkout_session",
            ),
            models.UniqueConstraint(
                fields=["stripe_payment_intent_id"],
                condition=~Q(stripe_payment_intent_id=""),
                name="payments_order_one_row_per_payment_intent",
            ),
            # Spec §30.3's replay store, scoped to the user so one customer's
            # chosen key cannot deny service to another's.
            models.UniqueConstraint(
                fields=["user", "client_idempotency_key"],
                condition=~Q(client_idempotency_key=""),
                name="payments_order_one_row_per_client_idempotency_key",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.pk} {self.product_id} {self.status}"


class ProcessedWebhookEvent(UUIDModel):
    """Spec §11.9 and §23.3 step 3.

    Append-only, so it inherits UUIDModel rather than UUIDTimeStampedModel: an
    `updated_at` would imply the row may legitimately change (the audit.AuditEvent
    precedent). `result` IS updated once, inside the same transaction that
    inserted the row and before any commit, which is why there is no second
    visible version of the row to timestamp.

    `payload_checksum` is a SHA-256 of the RAW BODY. It exists so an operator
    can prove two deliveries carried identical bytes; it is never used to make a
    decision, because `stripe_event_id` already is the decision.
    """

    stripe_event_id = models.CharField(max_length=128, unique=True)
    event_type = models.CharField(max_length=128)
    payload_checksum = models.CharField(max_length=64)
    processed_at = models.DateTimeField(default=timezone.now)
    result = models.CharField(
        max_length=24, choices=WebhookResult.choices, default=WebhookResult.RECEIVED
    )

    class Meta:
        ordering = ["-processed_at"]
        indexes = [models.Index(fields=["event_type", "-processed_at"])]
        constraints = [
            models.CheckConstraint(
                condition=Q(result__in=sorted(WebhookResult.values)),
                name="payments_webhook_result_is_known",
            )
        ]

    def __str__(self) -> str:
        return f"{self.stripe_event_id} {self.event_type} {self.result}"
