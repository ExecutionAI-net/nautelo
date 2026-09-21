from django.conf import settings
from django.db import models

from common.models import UUIDTimeStampedModel


class PromotionPlan(UUIDTimeStampedModel):
    """A purchasable "featured listing" package. Price and length are edited in Django admin."""

    code = models.SlugField(max_length=30, unique=True)
    name_en = models.CharField(max_length=80)
    name_it = models.CharField(max_length=80, blank=True, default="")
    name_es = models.CharField(max_length=80, blank=True, default="")
    days = models.PositiveIntegerField()
    price = models.DecimalField(max_digits=8, decimal_places=2)
    currency = models.CharField(max_length=3, default="EUR")
    is_popular = models.BooleanField(default=False, help_text="Shows a 'Most popular' mark")
    is_active = models.BooleanField(default=True)
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["display_order", "days"]
        constraints = [
            models.CheckConstraint(condition=models.Q(days__gt=0), name="promotions_plan_days_positive"),
            models.CheckConstraint(condition=models.Q(price__gt=0), name="promotions_plan_price_positive"),
        ]

    def name(self, locale: str = "en") -> str:
        return getattr(self, f"name_{locale}", "") or self.name_en

    def __str__(self) -> str:
        return f"{self.name_en} ({self.days} days, {self.price} {self.currency})"


class ListingPromotion(UUIDTimeStampedModel):
    """One purchase. The clock starts when the listing is live (`starts_at`), not at payment."""

    class Status(models.TextChoices):
        PENDING = "PENDING", "Awaiting payment"
        PAID = "PAID", "Paid"
        REVIEW = "REVIEW", "Needs staff review"
        CANCELED = "CANCELED", "Canceled"

    # Exactly one target: a boat listing, or a professional directory profile.
    listing = models.ForeignKey("listings.BoatListing", null=True, blank=True, related_name="promotions", on_delete=models.PROTECT)
    professional = models.ForeignKey(
        "professionals.ProfessionalProfile", null=True, blank=True, related_name="promotions", on_delete=models.PROTECT
    )
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="promotions", on_delete=models.PROTECT)
    plan = models.ForeignKey(PromotionPlan, related_name="promotions", on_delete=models.PROTECT)
    # Copied at purchase so later price or length edits never change what was bought.
    days = models.PositiveIntegerField()
    amount = models.DecimalField(max_digits=8, decimal_places=2)
    currency = models.CharField(max_length=3, default="EUR")
    status = models.CharField(max_length=8, choices=Status.choices, default=Status.PENDING)
    stripe_checkout_session_id = models.CharField(max_length=128, blank=True, default="")
    stripe_payment_intent_id = models.CharField(max_length=128, blank=True, default="")
    paid_at = models.DateTimeField(null=True, blank=True)
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    note = models.CharField(max_length=300, blank=True, default="")

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["listing", "status"], name="promotions_listing_status")]
        constraints = [
            models.CheckConstraint(
                condition=(models.Q(listing__isnull=False, professional__isnull=True) | models.Q(listing__isnull=True, professional__isnull=False)),
                name="promotions_exactly_one_target",
            )
        ]

    def __str__(self) -> str:
        return f"{self.listing_id} {self.plan.code} {self.status}"
