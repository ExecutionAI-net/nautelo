from django.contrib import admin

from .models import EmailTemplate


@admin.register(EmailTemplate)
class EmailTemplateAdmin(admin.ModelAdmin):
    list_display = ("key", "locale", "subject", "updated_at")
    list_filter = ("locale",)
    search_fields = ("key", "subject")
