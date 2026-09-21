from django.contrib import admin

from .models import ListingPromotion, PromotionPlan


@admin.register(PromotionPlan)
class PromotionPlanAdmin(admin.ModelAdmin):
    list_display = ("code", "name_en", "days", "price", "currency", "is_popular", "is_active", "display_order")
    list_editable = ("price", "days", "is_popular", "is_active", "display_order")


@admin.register(ListingPromotion)
class ListingPromotionAdmin(admin.ModelAdmin):
    list_display = ("created_at", "listing", "plan", "amount", "currency", "status", "starts_at", "ends_at")
    list_filter = ("status", "plan")
    search_fields = ("listing__slug", "user__email", "stripe_checkout_session_id")
    readonly_fields = ("stripe_checkout_session_id", "stripe_payment_intent_id", "paid_at", "created_at", "updated_at")
