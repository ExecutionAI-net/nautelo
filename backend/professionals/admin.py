from django.contrib import admin

from professionals.models import ProfessionalMembership, ProfessionalPlan, ProfessionalProfile, ProfessionalSubscription


class ProfessionalMembershipInline(admin.TabularInline):
    model = ProfessionalMembership
    extra = 0
    raw_id_fields = ("user",)


@admin.register(ProfessionalProfile)
class ProfessionalProfileAdmin(admin.ModelAdmin):
    list_display = ("display_name", "slug", "owner_user", "status", "country_code")
    list_filter = ("status", "country_code")
    search_fields = ("display_name", "slug", "public_email", "owner_user__email")
    prepopulated_fields = {"slug": ("display_name",)}
    autocomplete_fields = ("owner_user",)
    readonly_fields = ("id", "created_at", "updated_at")
    inlines = [ProfessionalMembershipInline]


@admin.register(ProfessionalPlan)
class ProfessionalPlanAdmin(admin.ModelAdmin):
    list_display = ("name", "monthly_price", "currency", "is_active")
    fields = ("slug", "name", "tagline", "monthly_price", "currency", "stripe_product_id", "stripe_price_id", "is_active")


@admin.register(ProfessionalSubscription)
class ProfessionalSubscriptionAdmin(admin.ModelAdmin):
    list_display = ("profile", "status", "current_period_end", "past_due_since", "last_paid_at")
    list_filter = ("status",)
    search_fields = ("profile__display_name", "profile__owner_user__email", "stripe_subscription_id")
    raw_id_fields = ("profile",)
