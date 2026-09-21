from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver

from common.models import UUIDTimeStampedModel
from django.db.models import Q

from professionals.enums import (
    ROLE_DEFAULT_CAPABILITIES,
    ProfessionalMembershipRole,
    ProfessionalProfileStatus,
    SubscriptionStatus,
)


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
    # GeoNames id of the city picked from places.City; null while only free text exists.
    place_geoname_id = models.PositiveBigIntegerField(null=True, blank=True, db_index=True)
    postal_code = models.CharField(max_length=20, blank=True)
    region = models.CharField(max_length=120, blank=True)
    country_code = models.CharField(max_length=2)
    service_area = models.JSONField(default=list, blank=True, validators=[validate_service_area])
    # Paid promotion: featured in the directory while `featured_until` is in the future.
    featured_until = models.DateTimeField(null=True, blank=True, db_index=True)
    featured_at = models.DateTimeField(null=True, blank=True)
    logo_key = models.CharField(max_length=300, blank=True, default="")
    cover_key = models.CharField(max_length=300, blank=True, default="")
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
    trial_days = models.PositiveSmallIntegerField(
        default=30, help_text="Free days before the first charge; a card is still collected up front. 0 = no trial."
    )
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
    # One free trial per organization, ever.
    trial_used_at = models.DateTimeField(null=True, blank=True)
    trial_ends_at = models.DateTimeField(null=True, blank=True)
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


class ProfessionalMembership(UUIDTimeStampedModel):
    """A user's seat in a professional organization (the profile is the org).

    The owner holds an ADMIN seat flagged `is_owner`. A user has at most one
    live seat, so the account keeps a single role.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="professional_memberships", on_delete=models.CASCADE
    )
    profile = models.ForeignKey(ProfessionalProfile, related_name="memberships", on_delete=models.CASCADE)
    role = models.CharField(
        max_length=10, choices=ProfessionalMembershipRole.choices, default=ProfessionalMembershipRole.VIEWER
    )
    can_edit_profile = models.BooleanField(default=False)
    can_manage_team = models.BooleanField(default=False)
    can_read_messages = models.BooleanField(default=False)
    is_owner = models.BooleanField(default=False)
    show_on_profile = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("-is_owner", "user__full_name", "user__email")
        constraints = [
            models.UniqueConstraint(fields=["user", "profile"], name="professionals_membership_unique_user_profile"),
            models.UniqueConstraint(
                fields=["user"], condition=Q(is_active=True), name="professionals_one_live_membership_per_user"
            ),
            models.CheckConstraint(
                condition=~Q(role=ProfessionalMembershipRole.ADMIN)
                | Q(can_edit_profile=True, can_manage_team=True, can_read_messages=True),
                name="professionals_admin_membership_has_all_permissions",
            ),
        ]

    def __str__(self):
        return f"{self.user_id} @ {self.profile_id} ({self.role})"

    @classmethod
    def from_db(cls, db, field_names, values):
        instance = super().from_db(db, field_names, values)
        instance._loaded_role = instance.role
        return instance

    def refresh_from_db(self, *args, **kwargs):
        super().refresh_from_db(*args, **kwargs)
        self._loaded_role = self.role

    def save(self, *args, **kwargs):
        previous_role = getattr(self, "_loaded_role", None)
        forced = None
        if self.role == ProfessionalMembershipRole.ADMIN:
            forced = ROLE_DEFAULT_CAPABILITIES[ProfessionalMembershipRole.ADMIN]
        elif previous_role is not None and previous_role != self.role:
            forced = ROLE_DEFAULT_CAPABILITIES[self.role]
        if forced is not None:
            for field, value in forced.items():
                setattr(self, field, value)
            if kwargs.get("update_fields") is not None:
                kwargs["update_fields"] = set(kwargs["update_fields"]) | set(forced) | {"role"}
        result = super().save(*args, **kwargs)
        self._loaded_role = self.role
        return result


@receiver(post_save, sender=ProfessionalProfile)
def ensure_owner_membership(sender, instance, created, **kwargs):
    """Every organization has its owner seated as ADMIN (created here so seeds,
    admin and API creation all agree)."""
    if created and instance.owner_user_id:
        ProfessionalMembership.objects.get_or_create(
            profile=instance,
            user_id=instance.owner_user_id,
            defaults={
                "role": ProfessionalMembershipRole.ADMIN,
                "is_owner": True,
                "can_edit_profile": True,
                "can_manage_team": True,
                "can_read_messages": True,
            },
        )
