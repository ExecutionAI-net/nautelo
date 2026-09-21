from django.contrib import admin

from .models import ContactRequest


@admin.register(ContactRequest)
class ContactRequestAdmin(admin.ModelAdmin):
    list_display = ("created_at", "topic", "name", "email", "status")
    list_filter = ("topic", "status")
    search_fields = ("name", "email", "message")
    readonly_fields = ("created_at", "updated_at")
