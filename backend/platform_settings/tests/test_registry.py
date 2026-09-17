from decimal import Decimal

import pytest

from platform_settings.registry import SETTINGS_REGISTRY, SettingValueType, coerce_value

EXPECTED_KEYS_AND_DEFAULTS = {
    "finance.enabled": (SettingValueType.BOOLEAN, True),
    "individual.free_listing_count": (SettingValueType.INTEGER, 1),
    "individual.free_period_days": (SettingValueType.INTEGER, 365),
    "individual.free_publish_days": (SettingValueType.INTEGER, 30),
    "individual.paid_publish_days": (SettingValueType.INTEGER, 30),
    "individual.paid_entitlement_valid_days": (SettingValueType.INTEGER, 365),
    "media.private_base_image_limit": (SettingValueType.INTEGER, 1),
    "media.private_base_video_limit": (SettingValueType.INTEGER, 0),
    "media.upgraded_image_limit": (SettingValueType.INTEGER, 20),
    "media.upgraded_video_limit": (SettingValueType.INTEGER, 1),
    "media.broker_image_limit": (SettingValueType.INTEGER, 20),
    "media.broker_video_limit": (SettingValueType.INTEGER, 1),
}


def test_registry_defines_exactly_the_twelve_spec_keys():
    assert set(SETTINGS_REGISTRY) == set(EXPECTED_KEYS_AND_DEFAULTS)


@pytest.mark.parametrize("key, expected", EXPECTED_KEYS_AND_DEFAULTS.items())
def test_registry_default_and_type_match_spec_table(key, expected):
    expected_type, expected_default = expected
    definition = SETTINGS_REGISTRY[key]

    assert definition.value_type is expected_type
    assert definition.default == expected_default


def test_coerce_value_rejects_non_boolean_for_boolean_type():
    with pytest.raises(ValueError):
        coerce_value(SettingValueType.BOOLEAN, "true")


def test_coerce_value_rejects_non_integer_for_integer_type():
    with pytest.raises(ValueError):
        coerce_value(SettingValueType.INTEGER, "48")
    with pytest.raises(ValueError):
        coerce_value(SettingValueType.INTEGER, True)  # bool is an int subclass in Python


def test_coerce_value_parses_decimal_from_string_or_number():
    assert coerce_value(SettingValueType.DECIMAL, "5.0000") == Decimal("5.0000")
    assert coerce_value(SettingValueType.DECIMAL, 5) == Decimal("5")


def test_media_private_base_limits_require_exact_values():
    image_definition = SETTINGS_REGISTRY["media.private_base_image_limit"]
    video_definition = SETTINGS_REGISTRY["media.private_base_video_limit"]

    image_definition.validator(1)
    video_definition.validator(0)
    with pytest.raises(ValueError):
        image_definition.validator(2)
    with pytest.raises(ValueError):
        video_definition.validator(1)
