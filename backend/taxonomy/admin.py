from django.contrib import admin

from .models import BoatBrand


@admin.register(BoatBrand)
class BoatBrandAdmin(admin.ModelAdmin):
    list_display = ["name", "slug", "is_active", "created_at"]
    list_filter = ["is_active"]
    search_fields = ["name", "normalized_name", "slug"]
    readonly_fields = ["normalized_name", "created_at", "updated_at"]
