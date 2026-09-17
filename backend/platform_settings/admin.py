from django.contrib import admin

from audit.models import AuditEvent

from .models import PlatformSetting
from .services import update_setting


@admin.register(PlatformSetting)
class PlatformSettingAdmin(admin.ModelAdmin):
    list_display = ("key", "value", "updated_at", "updated_by")
    fields = ("key", "value", "updated_at", "updated_by")
    # `key` is shown but never editable — it's the registry lookup identity;
    # letting staff rename it would orphan the row from its validation rules.
    readonly_fields = ("key", "updated_at", "updated_by")

    def has_add_permission(self, request):
        # All 12 keys are seeded once by migration 0002; staff only ever
        # edit an existing row's value, never create new arbitrary keys.
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def save_model(self, request, obj, form, change):
        # Delegate entirely to update_setting() so validation, versioning
        # and the audit trail are guaranteed regardless of entry point
        # (admin vs. any future API). `obj` is already the pre-existing
        # row (has_add_permission is False), so its pk already matches the
        # row update_setting() will fetch by `key` — no pk sync needed here
        # (contrast with FeatureFlagAdmin in Task 5, which does need it).
        update_setting(
            key=obj.key,
            value=obj.value,
            actor=request.user,
            source=AuditEvent.Source.ADMIN,
        )
