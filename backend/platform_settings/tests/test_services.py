import pytest

from platform_settings.services import get_setting_value


@pytest.mark.django_db
def test_get_setting_value_returns_the_seeded_default_after_migration():
    assert get_setting_value("finance.enabled") is True
    assert get_setting_value("individual.free_listing_count") == 1
    assert get_setting_value("media.broker_video_limit") == 1


@pytest.mark.django_db
def test_get_setting_value_falls_back_to_the_registry_default_if_the_row_is_missing():
    from platform_settings.models import PlatformSetting

    PlatformSetting.objects.filter(key="individual.free_listing_count").delete()

    assert get_setting_value("individual.free_listing_count") == 1


def test_get_setting_value_raises_for_an_unknown_key():
    with pytest.raises(KeyError):
        get_setting_value("not.a.real.key")
