import pytest
from django.core.exceptions import ValidationError

from platform_settings.models import PlatformSetting


@pytest.mark.django_db
def test_platform_setting_clean_rejects_an_unknown_key():
    setting = PlatformSetting(key="not.a.real.key", value=True)

    with pytest.raises(ValidationError):
        setting.clean()


@pytest.mark.django_db
def test_platform_setting_clean_rejects_an_out_of_range_value():
    setting = PlatformSetting(key="individual.free_listing_count", value=500)

    with pytest.raises(ValidationError):
        setting.clean()


@pytest.mark.django_db
def test_platform_setting_clean_accepts_a_valid_value():
    setting = PlatformSetting(key="individual.free_listing_count", value=60)

    setting.clean()  # does not raise
