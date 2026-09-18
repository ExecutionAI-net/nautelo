from django.contrib import admin

from notifications.models import Notification, NotificationDelivery


class NotificationDeliveryInline(admin.TabularInline):
    model = NotificationDelivery
    extra = 0
    can_delete = False
    readonly_fields = (
        "channel",
        "status",
        "attempt_count",
        "provider_message_id",
        "last_error_code",
        "sent_at",
    )

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    """Read-only: spec 33.4 wants delivery failures visible to staff, which is a
    read, and every write belongs to a service function (spec 3)."""

    list_display = ("id", "notification_type", "recipient", "read_at", "created_at")
    list_filter = ("notification_type",)
    search_fields = ("id", "recipient__email")
    readonly_fields = tuple(field.name for field in Notification._meta.fields)
    inlines = [NotificationDeliveryInline]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
