from django.contrib import admin, messages
from django.db.models import Exists, OuterRef
from django.shortcuts import redirect
from django.urls import path, reverse

from .models import TextKey, TextRelease, TextValue
from .services import publish
from .tasks import translate_pending_ui_text


class PendingFilter(admin.SimpleListFilter):
    title = "status"
    parameter_name = "state"

    def lookups(self, request, model_admin):
        return [("pending", "Edited, not published"), ("waiting", "Waiting for machine translation"), ("stale", "English changed")]

    def queryset(self, request, queryset):
        values = TextValue.objects.filter(key=OuterRef("pk"))
        if self.value() == "pending":
            edited = [pk for pk, text, live in TextValue.objects.values_list("key_id", "text", "published_text") if text != live]
            return queryset.filter(pk__in=edited)
        if self.value() == "waiting":
            return queryset.filter(Exists(values.filter(stale=True).exclude(origin="HUMAN")))
        if self.value() == "stale":
            return queryset.filter(Exists(values.filter(stale=True, origin="HUMAN")))
        return queryset


class TextValueInline(admin.TabularInline):
    model = TextValue
    extra = 0
    can_delete = False
    fields = ("locale", "text", "origin", "stale", "live")
    readonly_fields = ("locale", "origin", "stale", "live")

    def has_add_permission(self, request, obj=None):
        return False

    @admin.display(description="Live text")
    def live(self, obj):
        return obj.published_text or "-"


@admin.register(TextKey)
class TextKeyAdmin(admin.ModelAdmin):
    change_list_template = "admin/uitext/textkey/change_list.html"
    list_display = ("key", "source_en", "italian", "spanish", "state", "is_active")
    list_filter = (PendingFilter, "is_active")
    search_fields = ("key", "source_en", "values__text")
    readonly_fields = ("key", "source_en", "is_active", "created_at")
    fields = ("key", "source_en", "description", "is_active", "created_at")
    inlines = [TextValueInline]
    actions = ["translate_again"]
    list_per_page = 100

    def get_queryset(self, request):
        return super().get_queryset(request).prefetch_related("values")

    def _value(self, obj, locale):
        return next((value for value in obj.values.all() if value.locale == locale), None)

    @admin.display(description="Italian")
    def italian(self, obj):
        value = self._value(obj, "it")
        return (value.text if value and value.text else "-")[:70]

    @admin.display(description="Spanish")
    def spanish(self, obj):
        value = self._value(obj, "es")
        return (value.text if value and value.text else "-")[:70]

    @admin.display(description="State")
    def state(self, obj):
        values = list(obj.values.all())
        if any(value.text != value.published_text for value in values):
            return "Edited, not published"
        if any(value.stale and value.origin != "HUMAN" for value in values):
            return "Waiting for translation"
        if any(value.stale for value in values):
            return "English changed"
        return "Live"

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def save_formset(self, request, form, formset, change):
        instances = formset.save(commit=False)
        for value in instances:
            value.origin = TextValue.Origin.HUMAN if value.locale != "en" or value.text != value.key.source_en else TextValue.Origin.SOURCE
            value.stale = False
            value.save()
        formset.save_m2m()

    @admin.action(description="Translate again with AI (replaces the selected texts in it/es)")
    def translate_again(self, request, queryset):
        count = (
            TextValue.objects.filter(key__in=queryset, locale__in=("it", "es"))
            .update(stale=True, attempts=0, origin=TextValue.Origin.MACHINE)
        )
        translate_pending_ui_text.delay()
        self.message_user(request, f"{count} texts queued for machine translation.", messages.SUCCESS)

    def get_urls(self):
        return [path("publish/", self.admin_site.admin_view(self.publish_view), name="uitext_textkey_publish")] + super().get_urls()

    def publish_view(self, request):
        changed = publish()
        message = f"Published: {changed} texts are now live." if changed else "Nothing to publish: every edit is already live."
        self.message_user(request, message, level=messages.SUCCESS)
        return redirect(reverse("admin:uitext_textkey_changelist"))

    def changelist_view(self, request, extra_context=None):
        pending = sum(1 for text, live in TextValue.objects.values_list("text", "published_text") if text != live)
        extra_context = {**(extra_context or {}), "pending_edits": pending, "release": TextRelease.current().version}
        return super().changelist_view(request, extra_context)
