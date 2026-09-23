from django.db import models
from django.db.models import Q

from common.models import UUIDTimeStampedModel
from professionals.models import validate_service_area
from services_catalog.services import RESERVED_CATEGORY_SLUGS, validate_category_slug


class ServiceCategory(UUIDTimeStampedModel):
    """A nautical service category (spec §11.2).

    The six approved SEO service pages are ordinary rows of this table flagged
    has_seo_page=True — spec §11.2: "they are not separate hard-coded templates
    with divergent data models".
    """

    name_en = models.CharField(max_length=120)
    name_it = models.CharField(max_length=120, blank=True)
    name_es = models.CharField(max_length=120, blank=True)
    slug = models.SlugField(max_length=140, unique=True, validators=[validate_category_slug])
    description_en = models.TextField(blank=True)
    description_it = models.TextField(blank=True)
    description_es = models.TextField(blank=True)
    icon_key = models.CharField(max_length=64, blank=True)
    display_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    has_seo_page = models.BooleanField(default=False)
    seo_title_en = models.CharField(max_length=180, blank=True)
    seo_title_it = models.CharField(max_length=180, blank=True)
    seo_title_es = models.CharField(max_length=180, blank=True)
    seo_description_en = models.CharField(max_length=320, blank=True)
    seo_description_it = models.CharField(max_length=320, blank=True)
    seo_description_es = models.CharField(max_length=320, blank=True)

    class Meta:
        ordering = ("display_order", "name_en")
        verbose_name = "service category"
        verbose_name_plural = "service categories"
        constraints = [
            models.CheckConstraint(
                condition=~Q(slug__in=RESERVED_CATEGORY_SLUGS),
                name="service_category_slug_not_reserved",
            )
        ]
        indexes = [models.Index(fields=["is_active", "display_order"])]

    def __str__(self):
        return self.name_en

    def get_absolute_url(self) -> str:
        return f"/services/{self.slug}/"


class ProfessionalService(UUIDTimeStampedModel):
    """One service a professional offers inside one category (spec §11.2)."""

    professional = models.ForeignKey(
        "professionals.ProfessionalProfile",
        related_name="services",
        on_delete=models.CASCADE,
    )
    category = models.ForeignKey(
        ServiceCategory,
        related_name="professional_services",
        on_delete=models.PROTECT,
    )
    title_en = models.CharField(max_length=160)
    title_it = models.CharField(max_length=160, blank=True)
    title_es = models.CharField(max_length=160, blank=True)
    description_en = models.TextField(blank=True)
    description_it = models.TextField(blank=True)
    description_es = models.TextField(blank=True)
    service_area = models.JSONField(
        default=list, blank=True, validators=[validate_service_area]
    )
    # Both optional: a professional may want to publish a starting price, add
    # a free-text qualifier ("per survey", "+VAT"), both, or neither (in which
    # case the public page shows "Quote on request").
    price_from = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    pricing_note = models.CharField(max_length=120, blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("category__display_order", "title_en")
        constraints = [
            models.UniqueConstraint(
                fields=["professional", "category", "title_en"],
                name="unique_professional_category_title",
            )
        ]
        indexes = [models.Index(fields=["is_active"])]

    def __str__(self):
        return f"{self.professional.display_name} — {self.title_en}"


class LegacyDirectoryMapping(UUIDTimeStampedModel):
    """Spec §14.3 step 1: the mapping table from old service/provider records to
    canonical professional/category records.

    It is deliberately empty in every environment today — the prior NAUTA
    artefact was a set of static HTML mockups with no database, so there are no
    legacy records to map (see the plan's Scope rulings). The table exists
    because spec §14.3 and §32.1 step 7 require the mechanism, and because
    spec §4.3's /professionals/profile/?id=<legacy> redirect needs a place to
    look up what "resolvable" means.
    """

    class LegacyKind(models.TextChoices):
        SERVICE = "SERVICE", "Legacy service record"
        PROVIDER = "PROVIDER", "Legacy provider record"

    class TargetType(models.TextChoices):
        SERVICE_CATEGORY = "SERVICE_CATEGORY", "Service category"
        PROFESSIONAL_PROFILE = "PROFESSIONAL_PROFILE", "Professional profile"

    class Resolution(models.TextChoices):
        PENDING = "PENDING", "Pending"
        MAPPED = "MAPPED", "Mapped"
        DUPLICATE_REVIEW = "DUPLICATE_REVIEW", "Duplicate — needs human review"
        UNRESOLVED = "UNRESOLVED", "Unresolved"

    legacy_kind = models.CharField(max_length=16, choices=LegacyKind.choices)
    legacy_identifier = models.CharField(max_length=190)
    legacy_slug = models.CharField(max_length=190, blank=True)
    normalized_name = models.CharField(max_length=190, blank=True)
    normalized_address = models.CharField(max_length=255, blank=True)
    target_type = models.CharField(max_length=32, choices=TargetType.choices, blank=True)
    target_id = models.UUIDField(null=True, blank=True)
    resolution = models.CharField(
        max_length=20, choices=Resolution.choices, default=Resolution.PENDING
    )
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ("legacy_kind", "legacy_identifier")
        constraints = [
            models.UniqueConstraint(
                fields=["legacy_kind", "legacy_identifier"],
                name="unique_legacy_kind_identifier",
            )
        ]
        indexes = [
            models.Index(fields=["legacy_kind", "legacy_slug"]),
            models.Index(fields=["resolution"]),
        ]

    def __str__(self):
        return f"{self.legacy_kind}:{self.legacy_identifier} -> {self.resolution}"
