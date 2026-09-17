from .models import PlatformSetting
from .registry import SETTINGS_REGISTRY, coerce_value


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
