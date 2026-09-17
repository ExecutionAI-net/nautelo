from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.serializers.json import DjangoJSONEncoder
from django.db import models

from common.models import UUIDTimeStampedModel

from .registry import SETTINGS_REGISTRY, coerce_value


class PlatformSetting(UUIDTimeStampedModel):
    """A single staff-editable typed setting (NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md §10.1).

    Rows are seeded once for all SETTINGS_REGISTRY keys by migration 0002
    and are never created ad hoc — see services.update_setting() for the
    only sanctioned mutation path (also used by admin.PlatformSettingAdmin).
    """

    key = models.CharField(max_length=100, unique=True)
    value = models.JSONField(encoder=DjangoJSONEncoder)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="platform_setting_updates",
    )

    class Meta:
        ordering = ["key"]

    def __str__(self):
        return self.key

    def clean(self):
        definition = SETTINGS_REGISTRY.get(self.key)
        if definition is None:
            raise ValidationError({"key": f"Unknown platform setting key: {self.key}"})
        try:
            coerced = coerce_value(definition.value_type, self.value)
            definition.validator(coerced)
        except ValueError as exc:
            raise ValidationError({"value": str(exc)}) from exc


class PlatformSettingsVersion(models.Model):
    """Global, monotonically increasing settings version + last-updated
    timestamp (NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md §10.1: "Settings responses
    include a monotonically increasing settings_version and updated_at").

    Ruling: this is a genuine process-wide singleton counter, not a domain
    entity with its own identity — it deliberately uses a fixed small-integer
    primary key rather than a UUID, matching the Global Constraints' own
    "unless stated otherwise" carve-out from the UUID-PK default.
    """

    SINGLETON_ID = 1

    id = models.PositiveSmallIntegerField(primary_key=True, default=SINGLETON_ID, editable=False)
    version = models.PositiveIntegerField(default=1)
    updated_at = models.DateTimeField(auto_now=True)

    @classmethod
    def load(cls) -> "PlatformSettingsVersion":
        obj, _ = cls.objects.get_or_create(id=cls.SINGLETON_ID)
        return obj

    @classmethod
    def bump(cls) -> int:
        obj, _ = cls.objects.select_for_update().get_or_create(id=cls.SINGLETON_ID)
        obj.version += 1
        obj.save(update_fields=["version", "updated_at"])
        return obj.version


class FeatureFlag(UUIDTimeStampedModel):
    """A generic staff-toggleable on/off switch (NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md §7
    row 2 / §35.1). Unlike PlatformSetting, flag keys are not fixed by a
    registry — each phase that needs one creates its own row (typically via
    a data migration) when the feature it gates is actually built."""

    key = models.CharField(max_length=100, unique=True)
    description = models.CharField(max_length=255, blank=True)
    is_enabled = models.BooleanField(default=False)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="feature_flag_updates",
    )

    class Meta:
        ordering = ["key"]

    def __str__(self):
        return self.key
