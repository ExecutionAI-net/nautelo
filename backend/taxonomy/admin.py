from django.contrib import admin

from .models import BoatBrand, BoatModel


@admin.register(BoatBrand)
class BoatBrandAdmin(admin.ModelAdmin):
    list_display = ["name", "slug", "is_active", "created_at"]
    list_filter = ["is_active"]
    search_fields = ["name", "normalized_name", "slug"]
    readonly_fields = ["normalized_name", "created_at", "updated_at"]


@admin.register(BoatModel)
class BoatModelAdmin(admin.ModelAdmin):
    list_display = ["name", "brand", "is_other_placeholder", "is_active", "created_at"]
    list_filter = ["is_active", "is_other_placeholder", "brand"]
    search_fields = ["name", "normalized_name", "slug"]
    readonly_fields = ["normalized_name", "is_other_placeholder", "created_at", "updated_at"]
    autocomplete_fields = ["brand"]
