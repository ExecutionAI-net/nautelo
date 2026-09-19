from django.conf import settings
from django.contrib import admin, messages
from django.shortcuts import redirect
from django.urls import path, reverse

from .models import OpenRouterModel, TranslationSettings
from .openrouter import OpenRouterError, sync_catalog


@admin.register(OpenRouterModel)
class OpenRouterModelAdmin(admin.ModelAdmin):
    """Read-only catalogue. Its search box also powers the model picker in Translation settings."""

    change_list_template = "admin/translation/openroutermodel/change_list.html"
    search_fields = ("id", "name", "description")
    list_display = ("name", "id", "modality", "context_length", "input_price", "output_price", "is_available", "synced_at")
    list_filter = ("is_available", "modality")
    ordering = ("name",)

    @admin.display(description="Input $/M tokens")
    def input_price(self, obj):
        value = obj.prompt_per_million
        return "-" if value is None else f"{value:.2f}"

    @admin.display(description="Output $/M tokens")
    def output_price(self, obj):
        value = obj.completion_per_million
        return "-" if value is None else f"{value:.2f}"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def get_urls(self):
        return [path("sync/", self.admin_site.admin_view(self.sync_view), name="translation_openroutermodel_sync")] + super().get_urls()

    def sync_view(self, request):
        try:
            result = sync_catalog()
        except OpenRouterError as exc:
            self.message_user(request, f"Sync failed: {exc}", level=messages.ERROR)
        else:
            self.message_user(
                request,
                f"{result['received']} models received ({result['text_output']} output text): "
                f"{result['created']} new, {result['updated']} updated, {result['made_unavailable']} no longer listed.",
                level=messages.SUCCESS,
            )
        return redirect(reverse("admin:translation_openroutermodel_changelist"))


@admin.register(TranslationSettings)
class TranslationSettingsAdmin(admin.ModelAdmin):
    autocomplete_fields = ("model",)
    fields = ("enabled", "model", "temperature", "max_input_chars", "api_key_status", "catalogue_status")
    readonly_fields = ("api_key_status", "catalogue_status")

    @admin.display(description="API key")
    def api_key_status(self, obj):
        return "Configured" if getattr(settings, "OPENROUTER_API_KEY", "") else "MISSING - set OPENROUTER_API_KEY in the server secret"

    @admin.display(description="Model catalogue")
    def catalogue_status(self, obj):
        total = OpenRouterModel.objects.filter(is_available=True).count()
        return f"{total} models synced" if total else "Empty - open OpenRouter models and press Sync from OpenRouter"

    def has_add_permission(self, request):
        return not TranslationSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False

    def changelist_view(self, request, extra_context=None):
        obj = TranslationSettings.load()
        return redirect(reverse("admin:translation_translationsettings_change", args=[obj.pk]))
