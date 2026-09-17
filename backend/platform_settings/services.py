from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.db import transaction

from audit.models import AuditEvent
from audit.services import record_audit_event

from .models import PlatformSetting, PlatformSettingsVersion
from .registry import SETTINGS_REGISTRY, coerce_value

SETTINGS_CACHE_KEY = "platform_settings:public"


def feature_flag_cache_key(key: str) -> str:
    return f"platform_settings:feature_flag:{key}"


def get_setting_value(key: str):
    """Return the current value of a platform setting, coerced to its real
    Python type (bool / int / Decimal). Falls back to the registry default
    if the row hasn't been seeded yet (it always should be, via migration
    0002, but this keeps the function safe to call defensively)."""
    definition = SETTINGS_REGISTRY.get(key)
    if definition is None:
        raise KeyError(f"Unknown platform setting key: {key}")
    try:
        row = PlatformSetting.objects.get(key=key)
    except PlatformSetting.DoesNotExist:
        return definition.default
    return coerce_value(definition.value_type, row.value)


@transaction.atomic
def update_setting(
    *,
    key: str,
    value,
    actor,
    source: str = AuditEvent.Source.ADMIN,
    request_id: str | None = None,
) -> PlatformSetting:
    """The only sanctioned way to change a PlatformSetting's value.

    Validates against the registry, persists, bumps the global version and
    records an audit event, all inside one transaction — then defers only
    the cache invalidation to transaction.on_commit() so a rolled-back
    change never busts the cache for a value that never actually changed.
    """
    definition = SETTINGS_REGISTRY.get(key)
    if definition is None:
        raise ValidationError({"key": [f"Unknown platform setting key: {key}"]})

    setting = PlatformSetting.objects.select_for_update().get(key=key)
    before_value = setting.value

    setting.value = value
    actor_user = actor if getattr(actor, "is_authenticated", False) else None
    setting.updated_by = actor_user
    setting.full_clean()
    setting.save()

    PlatformSettingsVersion.bump()

    record_audit_event(
        actor_user=actor_user,
        actor_type=AuditEvent.ActorType.USER,
        action="platform_setting.updated",
        target_type="platform_settings.PlatformSetting",
        target_id=key,
        source=source,
        before={"value": before_value},
        after={"value": value},
        request_id=request_id,
    )

    transaction.on_commit(lambda: cache.delete(SETTINGS_CACHE_KEY))

    return setting
