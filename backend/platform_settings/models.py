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
