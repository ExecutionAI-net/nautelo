from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from enum import Enum
from typing import Any, Callable


class SettingValueType(str, Enum):
    BOOLEAN = "boolean"
    INTEGER = "integer"
    DECIMAL = "decimal"


@dataclass(frozen=True)
class SettingDefinition:
    key: str
    value_type: SettingValueType
    default: Any
    validator: Callable[[Any], None]
    is_public: bool = True


def coerce_value(value_type: SettingValueType, raw_value: Any) -> Any:
    """Convert a raw value (as read back from JSONField storage, or as
    submitted by a caller) into the real Python type the registry expects,
    raising ValueError on any type mismatch."""
    if value_type is SettingValueType.BOOLEAN:
        if not isinstance(raw_value, bool):
            raise ValueError(f"expected a boolean, got {raw_value!r}")
        return raw_value
    if value_type is SettingValueType.INTEGER:
        if isinstance(raw_value, bool) or not isinstance(raw_value, int):
            raise ValueError(f"expected an integer, got {raw_value!r}")
        return raw_value
    if value_type is SettingValueType.DECIMAL:
        try:
            return Decimal(str(raw_value))
        except InvalidOperation as exc:
            raise ValueError(f"expected a decimal, got {raw_value!r}") from exc
    raise ValueError(f"Unsupported setting value type: {value_type}")


def _range_validator(minimum, maximum) -> Callable[[Any], None]:
    def _validate(value):
        if not (minimum <= value <= maximum):
            raise ValueError(f"must be between {minimum} and {maximum}, got {value}")

    return _validate


def _exact_validator(expected) -> Callable[[Any], None]:
    def _validate(value):
        if value != expected:
            raise ValueError(f"must be exactly {expected}, got {value}")

    return _validate


def _no_extra_validation(value) -> None:
    return None


# Keys, types, defaults and validation ranges are copied verbatim from
# NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md §10.1.
SETTINGS_REGISTRY: dict[str, SettingDefinition] = {
    "finance.enabled": SettingDefinition(
        "finance.enabled", SettingValueType.BOOLEAN, True, _no_extra_validation
    ),
    # Spec §17.2's global override capability. Not in §10.1's table — see the
    # scope ruling in docs/superpowers/plans/2026-09-18-phase-9-finance-ui.md.
    # Disabling it makes stored listing overrides ignored, never deleted.
    #
    # is_public=False (the only key in this registry that overrides the default):
    # this is a staff-only policy switch with no browser consumer. finance
    # .listing_quotes.FinancePolicy.load() reads it server-side; the listing
    # form's override controls are gated by Phase 16's staff-aware form context,
    # not by GET /api/v1/platform/public-settings/. Keeping it out of the public
    # payload avoids telling anonymous visitors how override policy is
    # configured, and leaves that endpoint's contract test unchanged.
    "finance.broker_overrides_enabled": SettingDefinition(
        "finance.broker_overrides_enabled",
        SettingValueType.BOOLEAN,
        True,
        _no_extra_validation,
        is_public=False,
    ),
    "individual.free_listing_count": SettingDefinition(
        "individual.free_listing_count", SettingValueType.INTEGER, 1, _range_validator(0, 100)
    ),
    "individual.free_period_days": SettingDefinition(
        "individual.free_period_days", SettingValueType.INTEGER, 365, _range_validator(1, 3650)
    ),
    "individual.free_publish_days": SettingDefinition(
        "individual.free_publish_days", SettingValueType.INTEGER, 30, _range_validator(1, 3650)
    ),
    "individual.paid_publish_days": SettingDefinition(
        "individual.paid_publish_days", SettingValueType.INTEGER, 30, _range_validator(1, 3650)
    ),
    "individual.paid_entitlement_valid_days": SettingDefinition(
        "individual.paid_entitlement_valid_days",
        SettingValueType.INTEGER,
        365,
        _range_validator(1, 3650),
    ),
    "media.private_base_image_limit": SettingDefinition(
        "media.private_base_image_limit", SettingValueType.INTEGER, 1, _exact_validator(1)
    ),
    "media.private_base_video_limit": SettingDefinition(
        "media.private_base_video_limit", SettingValueType.INTEGER, 0, _exact_validator(0)
    ),
    "media.upgraded_image_limit": SettingDefinition(
        "media.upgraded_image_limit", SettingValueType.INTEGER, 20, _range_validator(1, 50)
    ),
    "media.upgraded_video_limit": SettingDefinition(
        "media.upgraded_video_limit", SettingValueType.INTEGER, 1, _range_validator(0, 3)
    ),
    "media.broker_image_limit": SettingDefinition(
        "media.broker_image_limit", SettingValueType.INTEGER, 20, _range_validator(1, 50)
    ),
    "media.broker_video_limit": SettingDefinition(
        "media.broker_video_limit", SettingValueType.INTEGER, 1, _range_validator(0, 3)
    ),
}
