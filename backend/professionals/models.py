from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from common.models import UUIDTimeStampedModel
from django.db.models import Q

from professionals.enums import ProfessionalProfileStatus, SubscriptionStatus


def validate_service_area(value):
    """service_area is a list of non-empty region identifier strings (spec 11.1)."""
    if not isinstance(value, list):
        raise ValidationError("service_area must be a list of region identifiers.")
    for item in value:
        if not isinstance(item, str) or not item.strip():
            raise ValidationError("Each service_area entry must be a non-empty string.")


class ProfessionalProfile(UUIDTimeStampedModel):
    owner_user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        related_name="professional_profile",
        on_delete=models.CASCADE,
    )
    display_name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True)
    short_description = models.CharField(max_length=300, blank=True)
    description = models.TextField(blank=True)
    public_email = models.EmailField(max_length=254)
    public_phone = models.CharField(max_length=32)
    website_url = models.URLField(max_length=300, blank=True, null=True)
    address_line1 = models.CharField(max_length=200, blank=True)
    address_line2 = models.CharField(max_length=200, blank=True)
    city = models.CharField(max_length=120, blank=True)
    postal_code = models.CharField(max_length=20, blank=True)
    region = models.CharField(max_length=120, blank=True)
    country_code = models.CharField(max_length=2)
    service_area = models.JSONField(default=list, blank=True, validators=[validate_service_area])
    status = models.CharField(
        max_length=10,
        choices=ProfessionalProfileStatus.choices,
        default=ProfessionalProfileStatus.DRAFT,
    )

    class Meta:
        ordering = ("display_name",)

    def __str__(self):
        return self.display_name

    @property
    def is_active(self) -> bool:
        return self.status == ProfessionalProfileStatus.ACTIVE

    def get_absolute_url(self) -> str:
        return f"/services/professionals/{self.slug}/"


class ProfessionalPlan(UUIDTimeStampedModel):
    """The single monthly membership every service professional pays to be listed."""

    slug = models.SlugField(max_length=40, unique=True, default="professional-membership")
    name = models.CharField(max_length=120, default="Professional membership")
    tagline = models.CharField(max_length=300, blank=True, default="")
    monthly_price = models.DecimalField(max_digits=10, decimal_places=2, default=49)
    currency = models.CharField(max_length=3, default="EUR")
    stripe_product_id = models.CharField(max_length=64, blank=True, default="")
    stripe_price_id = models.CharField(max_length=64, blank=True, default="")
    is_active = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=~Q(is_active=True) | ~Q(stripe_price_id=""),
                name="professional_plan_active_needs_stripe_price",
            ),
        ]

    def __str__(self):
        return f"{self.name} ({'active' if self.is_active else 'inactive'})"


class ProfessionalSubscription(UUIDTimeStampedModel):
    """Monthly billing state of one professional profile; drives its visibility."""

    profile = models.OneToOneField(
        ProfessionalProfile, related_name="subscription", on_delete=models.CASCADE
    )
    status = models.CharField(
        max_length=10, choices=SubscriptionStatus.choices, default=SubscriptionStatus.INACTIVE
    )
    stripe_customer_id = models.CharField(max_length=64, blank=True, default="")
    stripe_subscription_id = models.CharField(max_length=64, blank=True, default="")
    current_period_end = models.DateTimeField(null=True, blank=True)
    last_paid_at = models.DateTimeField(null=True, blank=True)
    # Set by the first failed invoice; the profile goes offline 24 hours later.
    past_due_since = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["stripe_subscription_id"],
                condition=~Q(stripe_subscription_id=""),
                name="professional_subscription_one_row_per_stripe_subscription",
            ),
        ]

    def __str__(self):
        return f"{self.profile_id} {self.status}"
