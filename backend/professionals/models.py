from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from common.models import UUIDTimeStampedModel
from professionals.enums import ProfessionalProfileStatus


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
