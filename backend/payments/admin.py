from django.contrib import admin

from .models import MarketplaceProduct


@admin.register(MarketplaceProduct)
class MarketplaceProductAdmin(admin.ModelAdmin):
    """Spec §23.5's editable fields. Adding and deleting are both disabled:
    spec §23.1 fixes the catalogue at exactly two codes, so the only legitimate
    operation is editing one of the two seeded rows. The audited path staff
    should normally use is /api/v1/staff/products/ (Task 12); this admin exists
    for break-glass operation and writes `updated_by` so the change is still
    attributable."""

    list_display = (
        "code",
        "is_active",
        "display_amount",
        "currency",
        "stripe_price_id",
        "entitlement_valid_days",
        "publication_days",
        "display_order",
    )
    list_filter = ("is_active", "code")
    search_fields = ("code", "name_en", "stripe_product_id", "stripe_price_id")
    readonly_fields = ("code", "created_by", "updated_by", "created_at", "updated_at")

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def save_model(self, request, obj, form, change):
        obj.updated_by = request.user
        super().save_model(request, obj, form, change)
