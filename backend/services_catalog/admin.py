from django.contrib import admin

from audit.models import AuditEvent

from .models import LegacyDirectoryMapping, ProfessionalService, ServiceCategory
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


@admin.register(ProfessionalService)
class ProfessionalServiceAdmin(admin.ModelAdmin):
    list_display = ("title_en", "professional", "category", "is_active")
    list_filter = ("is_active", "category")
    search_fields = ("title_en", "title_it", "title_es", "professional__display_name")
    autocomplete_fields = ("professional", "category")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(LegacyDirectoryMapping)
class LegacyDirectoryMappingAdmin(admin.ModelAdmin):
    # `resolution` and `notes` stay editable so a staff reviewer can resolve a
    # DUPLICATE_REVIEW row by hand — spec §14.3 step 2 requires exactly that
    # human step ("never merge solely on display name without review").
    list_display = (
        "legacy_kind",
        "legacy_identifier",
        "legacy_slug",
        "resolution",
        "target_type",
        "target_id",
    )
    list_filter = ("legacy_kind", "resolution", "target_type")
    search_fields = ("legacy_identifier", "legacy_slug", "normalized_name")
    readonly_fields = ("id", "created_at", "updated_at")
