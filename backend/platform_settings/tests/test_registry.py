from decimal import Decimal

import pytest

from platform_settings.registry import SETTINGS_REGISTRY, SettingValueType, coerce_value

EXPECTED_KEYS_AND_DEFAULTS = {
    "finance.enabled": (SettingValueType.BOOLEAN, True),
    # Spec §17.2 requires a global switch for broker finance overrides ("Staff
    # can disable override capability globally without altering existing stored
    # values") and gives it no home: §10.1's table has no such key and §11.6's
    # FinanceConfigurationVersion has no such column. The Phase 9 plan's scope
    # ruling puts it here, in the typed audited registry §10.1 exists to hold,
    # rather than inventing a column on the immutable configuration model or
    # stretching §35.1's closed flag list. This test is the contract for §10.1's
    # table, so the deviation is recorded here rather than silently absorbed.
    # It is the registry's only non-public key (see the test below).
    "finance.broker_overrides_enabled": (SettingValueType.BOOLEAN, True),
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


def test_registry_defines_the_spec_keys_plus_the_phase_9_override_switch():
    assert set(SETTINGS_REGISTRY) == set(EXPECTED_KEYS_AND_DEFAULTS)


def test_the_broker_override_switch_is_not_a_public_setting():
    """Staff-only policy, so `is_public=False` — the registry's only such key.

    FinancePolicy.load() reads it server-side and no browser consumer exists:
    the listing form's "use custom assumptions" control is gated by Phase 16's
    own staff-aware form context, not by the public settings payload. Keeping it
    non-public also means GET /api/v1/platform/public-settings/ is unchanged, so
    test_views.py::test_public_settings_endpoint_returns_all_seeded_keys — an
    exact-dict assertion over that payload — stays untouched by Phase 9.
    """
    assert SETTINGS_REGISTRY["finance.broker_overrides_enabled"].is_public is False


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
