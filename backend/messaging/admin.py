from django.contrib import admin

from messaging.models import Conversation


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    """Read-only. Spec 3 puts every state change in a service function, and this
    phase ships no audited admin write path for a conversation - so the admin
    does not offer one. Spec 33.5 also keeps message bodies out of operational
    tooling by default, which is why Message has no admin at all (Task 3)."""

    list_display = ("id", "conversation_type", "initiator", "status", "last_message_at")
    list_filter = ("conversation_type", "status")
    search_fields = ("id", "initiator__email", "subject")
    readonly_fields = tuple(field.name for field in Conversation._meta.fields)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
