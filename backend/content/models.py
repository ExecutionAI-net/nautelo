"""Editorial content: nautical guides (blog) and advertisement banners."""

from django.db import models
from django.utils import timezone

from common.models import UUIDTimeStampedModel


class GuideStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    PUBLISHED = "PUBLISHED", "Published"


class GuideArticle(UUIDTimeStampedModel):
    slug = models.SlugField(max_length=160, unique=True)
    title = models.CharField(max_length=200)
    excerpt = models.CharField(max_length=400, blank=True, default="")
    body = models.TextField(blank=True, default="")
    category = models.CharField(max_length=60, blank=True, default="")
    hero_image_url = models.URLField(max_length=500, blank=True, default="")
    author_name = models.CharField(max_length=120, blank=True, default="")
    status = models.CharField(max_length=9, choices=GuideStatus.choices, default=GuideStatus.DRAFT)
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-published_at", "-created_at"]

    def save(self, *args, **kwargs):
        if self.status == GuideStatus.PUBLISHED and self.published_at is None:
            self.published_at = timezone.now()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title


class AdPlacement(models.TextChoices):
    HOME = "HOME", "Home page"
    BOAT_LIST = "BOAT_LIST", "Boat list"
    BOAT_DETAIL = "BOAT_DETAIL", "Boat detail"
    DIRECTORY = "DIRECTORY", "Directory"
    GUIDES = "GUIDES", "Guides"


class Advertisement(UUIDTimeStampedModel):
    placement = models.CharField(max_length=12, choices=AdPlacement.choices)
    sponsor = models.CharField(max_length=120)
    headline = models.CharField(max_length=200)
    body = models.CharField(max_length=500, blank=True, default="")
    cta_label = models.CharField(max_length=60, blank=True, default="")
    cta_url = models.URLField(max_length=500, blank=True, default="")
    image_url = models.URLField(max_length=500, blank=True, default="")
    # When set, the call to action points at this directory page instead of cta_url.
    broker = models.ForeignKey(
        "brokers.BrokerOrganization", null=True, blank=True, on_delete=models.SET_NULL, related_name="advertisements"
    )
    professional = models.ForeignKey(
        "professionals.ProfessionalProfile", null=True, blank=True, on_delete=models.SET_NULL, related_name="advertisements"
    )
    is_active = models.BooleanField(default=True)
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["placement", "-created_at"]

    def __str__(self):
        return f"{self.placement}: {self.headline}"
