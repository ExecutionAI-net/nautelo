from django import forms
from django.contrib import admin

from .models import FinanceConfigurationVersion, FinanceRule
from .services import FinanceConfigurationService


class FinanceConfigurationVersionAddForm(forms.ModelForm):
    class Meta:
        model = FinanceConfigurationVersion
        fields = [
            "annual_rate_percent",
            "term_months",
            "down_payment_percent",
        ]


@admin.register(FinanceConfigurationVersion)
class FinanceConfigurationVersionAdmin(admin.ModelAdmin):
    list_display = (
        "version",
        "annual_rate_percent",
        "term_months",
        "down_payment_percent",
        "is_active",
        "created_at",
    )
    ordering = ("-version",)
    form = FinanceConfigurationVersionAddForm

    def has_view_permission(self, request, obj=None):
        return bool(request.user and request.user.is_staff)

    def has_add_permission(self, request):
        return bool(request.user and request.user.is_staff)

    def has_change_permission(self, request, obj=None):
        # Configuration versions are immutable once created. Staff use "Add"
        # to create (and thereby activate) a new version instead.
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def save_model(self, request, obj, form, change):
        obj.created_by_user_id = getattr(request.user, "id", None)
        FinanceConfigurationService.activate(obj)



@admin.register(FinanceRule)
class FinanceRuleAdmin(admin.ModelAdmin):
    """The simulator's rulebook: change a rate, add a market or a term here, no deploy needed."""

    list_display = ("label", "country_code", "product", "condition", "use", "tin_percent", "tae_percent", "is_active", "sort_order")
    list_filter = ("country_code", "product", "condition", "use", "is_active")
    search_fields = ("label",)
    fieldsets = (
        (None, {"fields": ("label", "is_active", "sort_order")}),
        ("When this row applies", {"fields": ("country_code", "product", "condition", "use")}),
        ("Rates and fees", {"fields": ("tin_percent", "tae_percent", "opening_fee_percent", "residual_percent", "representative_months")}),
        ("Limits", {"fields": ("min_price", "max_price", "min_down_percent", "max_down_percent", "default_down_percent", "terms_years", "max_age_at_end_years", "age_plus_term_limit")}),
        ("VAT", {"fields": ("vat_percent", "vat_on_installment", "vat_recoverable")}),
        ("Notes shown to the visitor", {"fields": ("note_en", "note_it", "note_es")}),
    )
