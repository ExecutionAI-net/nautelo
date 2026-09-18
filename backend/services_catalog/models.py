from django.db import models
from django.db.models import Q

from common.models import UUIDTimeStampedModel
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
