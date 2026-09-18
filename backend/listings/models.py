"""Listing domain models (NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md §11.4, §11.5).

Public pages read from BoatListing.current_public_snapshot, never from the
mutable draft columns below (spec §11.4).
"""

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.utils import timezone

from accounts.enums import SellerType
from common.models import UUIDTimeStampedModel

from .enums import ListingStatus, PublicationSource

MIN_MANUFACTURE_YEAR = 1900
CUSTOM_MODEL_NAME_MIN_LENGTH = 2
CUSTOM_MODEL_NAME_MAX_LENGTH = 100
# Spec §11.4: "currency ISO-4217, initially EUR". Spec §18.2 requires an
# eligibility check for "listing.currency is supported", so the supported set is
# explicit rather than implied.
SUPPORTED_CURRENCIES = frozenset({"EUR"})


class BoatListing(UUIDTimeStampedModel):
    owner_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="owned_listings",
    )
    broker = models.ForeignKey(
        "brokers.BrokerOrganization",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="listings",
    )
    seller_type = models.CharField(max_length=7, choices=SellerType.choices)
    brand = models.ForeignKey(
        "taxonomy.BoatBrand", on_delete=models.PROTECT, related_name="listings"
    )
    model = models.ForeignKey(
        "taxonomy.BoatModel", on_delete=models.PROTECT, related_name="listings"
    )
    custom_model_name = models.CharField(
        max_length=CUSTOM_MODEL_NAME_MAX_LENGTH, blank=True, default=""
    )
    manufacture_year = models.PositiveSmallIntegerField()
    status = models.CharField(
        max_length=16, choices=ListingStatus.choices, default=ListingStatus.DRAFT
    )
    currency = models.CharField(max_length=3, default="EUR")
    price = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    show_finance_estimate = models.BooleanField(default=False)
    finance_down_payment_override_percent = models.DecimalField(
        max_digits=7, decimal_places=4, null=True, blank=True
    )
    finance_rate_override_percent = models.DecimalField(
        max_digits=7, decimal_places=4, null=True, blank=True
    )
    finance_term_override_months = models.PositiveIntegerField(null=True, blank=True)
    publication_source = models.CharField(
        max_length=16, choices=PublicationSource.choices, blank=True, default=""
    )
    # Loose reference to Phase 13's UserEntitlement (spec §11.9), which does not
    # exist yet. Converted to a real ForeignKey by Phase 13.
    consumed_entitlement_id = models.UUIDField(null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    view_count_cached = models.BigIntegerField(default=0)
    # Optimistic locking (spec §20.5); bumped by listings.locking.bump_version().
    version = models.PositiveIntegerField(default=1)
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

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "-published_at"]),
            models.Index(fields=["owner_user", "status"]),
            models.Index(fields=["broker", "status"]),
            models.Index(fields=["expires_at"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=~Q(seller_type=SellerType.PRIVATE)
                | (Q(owner_user__isnull=False) & Q(broker__isnull=True)),
                name="listings_private_requires_owner_and_no_broker",
            ),
            models.CheckConstraint(
                condition=~Q(seller_type=SellerType.BROKER)
                | (Q(broker__isnull=False) & Q(owner_user__isnull=True)),
                name="listings_broker_requires_org_and_no_owner",
            ),
            models.CheckConstraint(
                condition=Q(show_finance_estimate=False)
                | Q(seller_type=SellerType.BROKER),
                name="listings_finance_flag_requires_broker",
            ),
            models.CheckConstraint(
                condition=Q(manufacture_year__gte=MIN_MANUFACTURE_YEAR),
                name="listings_manufacture_year_at_least_1900",
            ),
            models.CheckConstraint(
                condition=Q(price__isnull=True) | Q(price__gt=0),
                name="listings_price_is_positive_when_present",
            ),
            models.CheckConstraint(
                condition=Q(custom_model_name="")
                | Q(
                    custom_model_name__regex=(
                        rf"^.{{{CUSTOM_MODEL_NAME_MIN_LENGTH},"
                        rf"{CUSTOM_MODEL_NAME_MAX_LENGTH}}}$"
                    )
                ),
                name="listings_custom_model_name_length_2_to_100",
            ),
        ]

    def __str__(self):
        return f"{self.brand_id} {self.model_id} ({self.status})"

    @staticmethod
    def max_manufacture_year() -> int:
        """Spec §11.4: "between 1900 and current year + 1"."""
        return timezone.now().year + 1

    def clean(self):
        errors = {}

        if self.currency not in SUPPORTED_CURRENCIES:
            errors["currency"] = (
                f"Unsupported currency: {self.currency}. "
                f"Supported: {', '.join(sorted(SUPPORTED_CURRENCIES))}."
            )

        if (
            self.manufacture_year is not None
            and self.manufacture_year > self.max_manufacture_year()
        ):
            errors["manufacture_year"] = (
                f"Manufacture year must not be later than {self.max_manufacture_year()}."
            )

        # Cross-table rule (spec §11.4) — cannot be a database CheckConstraint.
        if self.model_id is not None:
            trimmed = (self.custom_model_name or "").strip()
            if self.model.is_other_placeholder:
                if not (
                    CUSTOM_MODEL_NAME_MIN_LENGTH
                    <= len(trimmed)
                    <= CUSTOM_MODEL_NAME_MAX_LENGTH
                ):
                    errors["custom_model_name"] = (
                        "The Other model requires custom text between "
                        f"{CUSTOM_MODEL_NAME_MIN_LENGTH} and "
                        f"{CUSTOM_MODEL_NAME_MAX_LENGTH} characters."
                    )
            elif trimmed:
                errors["custom_model_name"] = (
                    "Custom model text is only allowed when the Other model is selected."
                )

        if errors:
            raise ValidationError(errors)
