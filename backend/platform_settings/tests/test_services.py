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


from django.core.exceptions import ValidationError

from audit.models import AuditEvent
from platform_settings.models import PlatformSettingsVersion
from platform_settings.services import update_setting


@pytest.mark.django_db
def test_update_setting_persists_the_new_value(staff_user):
    update_setting(key="individual.free_listing_count", value=36, actor=staff_user)

    assert get_setting_value("individual.free_listing_count") == 36


@pytest.mark.django_db
def test_update_setting_bumps_the_global_version(staff_user):
    version_before = PlatformSettingsVersion.load().version

    update_setting(key="individual.free_listing_count", value=36, actor=staff_user)

    assert PlatformSettingsVersion.load().version == version_before + 1


@pytest.mark.django_db
def test_update_setting_records_an_audit_event_with_before_and_after(staff_user):
    update_setting(key="individual.free_listing_count", value=36, actor=staff_user)

    event = AuditEvent.objects.get(target_id="individual.free_listing_count")
    assert event.actor_user_id == staff_user.id
    assert event.actor_type == AuditEvent.ActorType.USER
    assert event.before == {"value": 1}
    assert event.after == {"value": 36}
    assert event.action == "platform_setting.updated"


@pytest.mark.django_db
def test_update_setting_rejects_an_out_of_range_value_with_no_side_effects(staff_user):
    version_before = PlatformSettingsVersion.load().version

    with pytest.raises(ValidationError):
        update_setting(key="individual.free_listing_count", value=500, actor=staff_user)

    assert get_setting_value("individual.free_listing_count") == 1
    assert PlatformSettingsVersion.load().version == version_before
    assert not AuditEvent.objects.filter(target_id="individual.free_listing_count").exists()


@pytest.mark.django_db
def test_update_setting_invalidates_the_cache_only_after_commit(
    django_capture_on_commit_callbacks, staff_user
):
    from django.core.cache import cache

    from platform_settings.services import SETTINGS_CACHE_KEY

    cache.set(SETTINGS_CACHE_KEY, {"stale": True}, timeout=None)

    with django_capture_on_commit_callbacks(execute=False) as callbacks:
        update_setting(key="individual.free_listing_count", value=36, actor=staff_user)
        # Not yet invalidated — the on_commit hook has only been registered,
        # not run, since `execute=False`.
        assert cache.get(SETTINGS_CACHE_KEY) == {"stale": True}

    assert len(callbacks) == 1
    for callback in callbacks:
        callback()

    assert cache.get(SETTINGS_CACHE_KEY) is None
