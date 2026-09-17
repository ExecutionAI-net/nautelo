from django import forms
from django.contrib import admin

from .models import FinanceConfigurationVersion
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
