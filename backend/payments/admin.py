from django.contrib import admin

from .models import ListingPackage, MarketplaceProduct, PaymentOrder, ProcessedWebhookEvent


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


@admin.register(ListingPackage)
class ListingPackageAdmin(admin.ModelAdmin):
    """The private-seller packages: days, photos, videos and price, all editable.
    A package can only be activated once it has a price and Stripe ids."""

    list_display = (
        "name_en", "publication_days", "image_limit", "video_limit",
        "display_amount", "currency", "is_active", "display_order",
    )
    list_editable = ("is_active", "display_order")
    search_fields = ("slug", "name_en")
    fieldsets = (
        (None, {"fields": ("slug", "is_active", "display_order")}),
        ("What the buyer gets", {"fields": ("publication_days", "image_limit", "video_limit")}),
        ("Price and Stripe", {"fields": ("display_amount", "currency", "stripe_product_id", "stripe_price_id")}),
        ("Names", {"fields": ("name_en", "name_it", "name_es")}),
        ("Descriptions", {"fields": ("description_en", "description_it", "description_es")}),
    )


@admin.register(PaymentOrder)
class PaymentOrderAdmin(admin.ModelAdmin):
    """Read-only by design. Spec §26.3: "Staff must not edit Stripe-paid order
    status manually. Payment corrections follow Stripe/service workflows."
    Spec §23.1: "Staff does not ... manually mark a browser redirect as paid."
    Both sentences are the same rule, and this class is where it is enforced."""

    list_display = (
        "id", "user", "product", "status", "amount", "currency",
        "stripe_checkout_session_id", "paid_at", "fulfilled_at",
    )
    list_filter = ("status", "product__code", "currency")
    search_fields = (
        "id", "user__email", "stripe_checkout_session_id",
        "stripe_payment_intent_id", "client_idempotency_key",
    )
    raw_id_fields = ("user", "product", "listing", "fulfilled_entitlement")
    date_hierarchy = "created_at"
    readonly_fields = tuple(field.name for field in PaymentOrder._meta.fields)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(ProcessedWebhookEvent)
class ProcessedWebhookEventAdmin(admin.ModelAdmin):
    list_display = ("stripe_event_id", "event_type", "result", "processed_at")
    list_filter = ("result", "event_type")
    search_fields = ("stripe_event_id",)
    date_hierarchy = "processed_at"
    readonly_fields = tuple(field.name for field in ProcessedWebhookEvent._meta.fields)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
