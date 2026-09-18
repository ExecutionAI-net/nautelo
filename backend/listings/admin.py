from django.contrib import admin

from .models import BoatListing, ListingMedia


@admin.register(BoatListing)
class BoatListingAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "seller_type",
        "status",
        "brand",
        "model",
        "manufacture_year",
        "price",
        "published_at",
        "expires_at",
        "version",
    )
    list_filter = ("status", "seller_type", "show_finance_estimate")
    search_fields = ("id", "custom_model_name")
    readonly_fields = (
        "id",
        "version",
        "published_at",
        "expires_at",
        "publication_source",
        "consumed_entitlement_id",
        "view_count_cached",
        "created_at",
        "updated_at",
    )
    raw_id_fields = ("owner_user", "broker", "brand", "model", "created_by", "updated_by")


@admin.register(ListingMedia)
class ListingMediaAdmin(admin.ModelAdmin):
    list_display = ("id", "listing", "media_type", "status", "sort_order", "byte_size")
    list_filter = ("media_type", "status")
    search_fields = ("id", "storage_key", "checksum_sha256")
    raw_id_fields = ("listing", "created_by")
