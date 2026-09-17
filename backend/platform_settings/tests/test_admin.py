import pytest
from django.contrib import admin as django_admin
from django.test import RequestFactory

from audit.models import AuditEvent
from platform_settings.admin import PlatformSettingAdmin
from platform_settings.models import PlatformSetting
from platform_settings.services import get_setting_value


def test_platform_setting_admin_denies_add_and_delete():
    admin_instance = PlatformSettingAdmin(PlatformSetting, django_admin.site)

    assert admin_instance.has_add_permission(None) is False
    assert admin_instance.has_delete_permission(None) is False


@pytest.mark.django_db
def test_platform_setting_admin_save_model_goes_through_update_setting(staff_user):
    admin_instance = PlatformSettingAdmin(PlatformSetting, django_admin.site)
    request = RequestFactory().post("/admin/platform_settings/platformsetting/")
    request.user = staff_user

    obj = PlatformSetting.objects.get(key="individual.free_listing_count")
    obj.value = 36

    admin_instance.save_model(request, obj, form=None, change=True)

    assert get_setting_value("individual.free_listing_count") == 36
    assert AuditEvent.objects.filter(
        target_id="individual.free_listing_count", source=AuditEvent.Source.ADMIN
    ).exists()
