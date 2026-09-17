from django.contrib import admin as django_admin

from audit.admin import AuditEventAdmin
from audit.models import AuditEvent


def test_audit_event_admin_denies_add_change_and_delete():
    admin_instance = AuditEventAdmin(AuditEvent, django_admin.site)

    assert admin_instance.has_add_permission(None) is False
    assert admin_instance.has_change_permission(None) is False
    assert admin_instance.has_delete_permission(None) is False
