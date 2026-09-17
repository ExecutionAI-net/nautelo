from decimal import Decimal
from unittest.mock import Mock

import pytest
from django.contrib.admin.sites import AdminSite

from finance.admin import FinanceConfigurationVersionAdmin
from finance.models import FinanceConfigurationVersion


@pytest.fixture
def admin_instance():
    return FinanceConfigurationVersionAdmin(FinanceConfigurationVersion, AdminSite())


def test_has_change_permission_is_always_false(admin_instance):
    assert admin_instance.has_change_permission(Mock(), obj=None) is False
    assert admin_instance.has_change_permission(Mock(), obj=Mock()) is False


def test_has_add_and_view_permission_follow_the_staff_flag(admin_instance):
    staff_request = Mock(user=Mock(is_staff=True))
    non_staff_request = Mock(user=Mock(is_staff=False))

    assert admin_instance.has_add_permission(staff_request) is True
    assert admin_instance.has_add_permission(non_staff_request) is False
    assert admin_instance.has_view_permission(staff_request) is True
    assert admin_instance.has_view_permission(non_staff_request) is False


def test_has_delete_permission_is_always_false(admin_instance):
    assert admin_instance.has_delete_permission(Mock(), obj=None) is False


@pytest.mark.django_db
def test_save_model_activates_new_version_and_deactivates_previous(admin_instance):
    previous_active = FinanceConfigurationVersion.objects.get(is_active=True)  # seeded v1

    request = Mock()
    request.user.id = "11111111-1111-1111-1111-111111111111"
    new_obj = FinanceConfigurationVersion(
        annual_rate_percent=Decimal("6.00"),
        term_months=60,
        down_payment_percent=Decimal("25.00"),
    )

    admin_instance.save_model(request, new_obj, form=Mock(), change=False)

    assert new_obj.version == previous_active.version + 1
    assert new_obj.is_active is True
    assert str(new_obj.created_by_user_id) == request.user.id

    previous_active.refresh_from_db()
    assert previous_active.is_active is False
