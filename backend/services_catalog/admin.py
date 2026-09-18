from django.contrib import admin

from audit.models import AuditEvent

from .models import ServiceCategory
from .services import delete_service_category, save_service_category


@admin.register(ServiceCategory)
class ServiceCategoryAdmin(admin.ModelAdmin):
    list_display = ("name_en", "slug", "display_order", "is_active", "has_seo_page")
    list_filter = ("is_active", "has_seo_page")
    search_fields = ("name_en", "name_it", "name_es", "slug")
    prepopulated_fields = {"slug": ("name_en",)}
    ordering = ("display_order", "name_en")
    readonly_fields = ("id", "created_at", "updated_at")

    def save_model(self, request, obj, form, change):
        # Delegate entirely so validation and the audit trail are guaranteed
        # regardless of entry point (admin now, staff API later) — same shape
        # as PlatformSettingAdmin/FeatureFlagAdmin from Phase 2.
        save_service_category(
            category=obj, actor=request.user, source=AuditEvent.Source.ADMIN
        )

    def delete_model(self, request, obj):
        delete_service_category(
            category=obj, actor=request.user, source=AuditEvent.Source.ADMIN
        )

    def delete_queryset(self, request, queryset):
        # Django's default bulk delete issues one SQL DELETE and would skip
        # delete_model() entirely, losing the audit rows.
        for obj in queryset:
            delete_service_category(
                category=obj, actor=request.user, source=AuditEvent.Source.ADMIN
            )
