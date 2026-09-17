from django.contrib import admin

from audit.models import AuditEvent

from .models import FeatureFlag, PlatformSetting
from .services import set_feature_flag, update_setting


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


@admin.register(FeatureFlag)
class FeatureFlagAdmin(admin.ModelAdmin):
    list_display = ("key", "is_enabled", "updated_at", "updated_by")
    fields = ("key", "description", "is_enabled", "updated_at", "updated_by")
    readonly_fields = ("updated_at", "updated_by")

    def has_add_permission(self, request):
        # Unlike PlatformSetting (all 12 keys pre-seeded, no ad hoc creation),
        # staff may create a new flag key ahead of the feature that will
        # check it — always allowed, same unconditional style as
        # has_delete_permission below rather than deferring to Django's
        # per-user `auth.Permission` grants.
        return True

    def has_delete_permission(self, request, obj=None):
        # Prefer disabling a flag over deleting it, so its audit history
        # stays attached to a real row. Unlike PlatformSetting, `add` is
        # allowed here — staff may create a new flag key ahead of the
        # feature that will check it.
        return False

    def save_model(self, request, obj, form, change):
        flag = set_feature_flag(
            key=obj.key,
            is_enabled=obj.is_enabled,
            actor=request.user,
            description=obj.description,
            source=AuditEvent.Source.ADMIN,
        )
        # On "Add", `obj` is a fresh instance with its own client-generated
        # UUID (UUIDModel's default=uuid4 fires at instantiation, before any
        # save) — sync `obj` onto the row set_feature_flag() actually
        # created/updated so Django Admin's post-save redirect resolves to
        # the real object instead of a pk that was never written to the DB.
        obj.pk = flag.pk
        obj.updated_at = flag.updated_at
        obj.updated_by = flag.updated_by
