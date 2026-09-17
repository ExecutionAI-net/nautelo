from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.db import transaction

from audit.models import AuditEvent
from audit.services import record_audit_event

from .models import FeatureFlag, PlatformSetting, PlatformSettingsVersion
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


def get_public_settings() -> dict:
    """Return the cached, publicly-safe settings payload
    (spec §30.1: GET /api/v1/platform/public-settings/)."""
    cached = cache.get(SETTINGS_CACHE_KEY)
    if cached is not None:
        return cached

    rows = {row.key: row.value for row in PlatformSetting.objects.all()}
    version = PlatformSettingsVersion.load()
    result = {
        "settings_version": version.version,
        "updated_at": version.updated_at.isoformat().replace("+00:00", "Z"),
        "settings": {
            key: coerce_value(definition.value_type, rows[key])
            for key, definition in SETTINGS_REGISTRY.items()
            if definition.is_public and key in rows
        },
    }
    cache.set(SETTINGS_CACHE_KEY, result, timeout=None)
    return result


_CACHE_MISS = object()


def is_feature_enabled(key: str, default: bool = False) -> bool:
    """Look up a feature flag's on/off state, cached indefinitely once known.

    Deviation from the plan's Step 5 draft: only a value actually persisted
    in the DB is cached. `default` is a per-call-site fallback (different
    callers may pass different defaults for the same still-unwritten key),
    not a property of the flag itself — caching it under the shared
    `feature_flag_cache_key(key)` would let one caller's default poison the
    result every other caller (and every future call with a different
    default) sees, since a cached `False` is indistinguishable from a cache
    miss to a plain `cache.get(cache_key) is not None` check.
    """
    cache_key = feature_flag_cache_key(key)
    cached = cache.get(cache_key, _CACHE_MISS)
    if cached is not _CACHE_MISS:
        return cached

    try:
        value = FeatureFlag.objects.get(key=key).is_enabled
    except FeatureFlag.DoesNotExist:
        return default

    cache.set(cache_key, value, timeout=None)
    return value


@transaction.atomic
def set_feature_flag(
    *,
    key: str,
    is_enabled: bool,
    actor,
    description: str = "",
    source: str = AuditEvent.Source.ADMIN,
    request_id: str | None = None,
) -> FeatureFlag:
    flag, created = FeatureFlag.objects.select_for_update().get_or_create(
        key=key, defaults={"is_enabled": is_enabled, "description": description}
    )
    before_value = None if created else flag.is_enabled

    flag.is_enabled = is_enabled
    if description:
        flag.description = description
    actor_user = actor if getattr(actor, "is_authenticated", False) else None
    flag.updated_by = actor_user
    flag.full_clean()
    flag.save()

    record_audit_event(
        actor_user=actor_user,
        actor_type=AuditEvent.ActorType.USER,
        action="feature_flag.created" if created else "feature_flag.updated",
        target_type="platform_settings.FeatureFlag",
        target_id=key,
        source=source,
        before={"is_enabled": before_value},
        after={"is_enabled": is_enabled},
        request_id=request_id,
    )

    cache_key = feature_flag_cache_key(key)
    transaction.on_commit(lambda: cache.delete(cache_key))

    return flag
