from django.contrib import admin

from professionals.models import ProfessionalProfile


@admin.register(ProfessionalProfile)
class ProfessionalProfileAdmin(admin.ModelAdmin):
    list_display = ("display_name", "slug", "owner_user", "status", "country_code")
    list_filter = ("status", "country_code")
    search_fields = ("display_name", "slug", "public_email", "owner_user__email")
    prepopulated_fields = {"slug": ("display_name",)}
    autocomplete_fields = ("owner_user",)
    readonly_fields = ("id", "created_at", "updated_at")
