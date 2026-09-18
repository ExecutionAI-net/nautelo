"""The two staff-controlled switches this phase adds (spec §17.2, §35.1)."""

import pytest

from platform_settings.models import FeatureFlag, PlatformSetting
from platform_settings.services import get_setting_value, is_feature_enabled


@pytest.mark.django_db
def test_the_broker_override_switch_is_seeded_and_defaults_to_enabled():
    """Spec §17.2: "For release 1.0, broker overrides are supported but
    optional" and "Staff can disable override capability globally without
    altering existing stored values"."""
    assert PlatformSetting.objects.filter(
        key="finance.broker_overrides_enabled"
    ).exists()
    assert get_setting_value("finance.broker_overrides_enabled") is True


@pytest.mark.django_db
def test_the_finance_estimates_flag_is_seeded_disabled():
    """Spec §35.1 rollout flag, §35.2 step 4: code ships ahead of the feature."""
    flag = FeatureFlag.objects.get(key="finance_estimates")

    assert flag.is_enabled is False
    assert is_feature_enabled("finance_estimates", default=False) is False
