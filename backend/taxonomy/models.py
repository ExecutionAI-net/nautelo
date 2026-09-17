import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q

from .services import generate_unique_slug, normalize_taxonomy_name


class BoatBrand(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150)
    slug = models.SlugField(max_length=170, unique=True, blank=True)
    normalized_name = models.CharField(max_length=150, unique=True, editable=False)
    is_active = models.BooleanField(default=True)
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
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        self.normalized_name = normalize_taxonomy_name(self.name)
        if not self.slug:
            self.slug = generate_unique_slug(
                BoatBrand.objects.all(), self.name, exclude_pk=self.pk
            )
        super().save(*args, **kwargs)


class BoatModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    brand = models.ForeignKey(
        BoatBrand, on_delete=models.PROTECT, related_name="models"
    )
    name = models.CharField(max_length=150)
    slug = models.SlugField(max_length=170, blank=True)
    normalized_name = models.CharField(max_length=150, editable=False)
    is_other_placeholder = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
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
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["brand", "normalized_name"],
                name="uniq_boatmodel_brand_normalized_name",
            ),
            models.UniqueConstraint(
                fields=["brand", "slug"],
                name="uniq_boatmodel_brand_slug",
            ),
            models.UniqueConstraint(
                fields=["brand"],
                condition=Q(is_other_placeholder=True),
                name="uniq_boatmodel_other_placeholder_per_brand",
            ),
        ]

    def __str__(self):
        return f"{self.brand.name} — {self.name}"

    def save(self, *args, **kwargs):
        self.normalized_name = normalize_taxonomy_name(self.name)
        if not self.slug:
            self.slug = generate_unique_slug(
                BoatModel.objects.filter(brand_id=self.brand_id), self.name,
                exclude_pk=self.pk,
            )
        super().save(*args, **kwargs)
