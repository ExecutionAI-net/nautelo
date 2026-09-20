from django.contrib import admin
from django.db.models import Count

from messaging.models import Conversation


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    """Read-only. Spec 3 puts every state change in a service function, and this
    phase ships no audited admin write path for a conversation - so the admin
    does not offer one. Spec 33.5 also keeps message bodies out of operational
    tooling by default, which is why Message has no admin at all (Task 3)."""

    list_display = (
        "id", "conversation_type", "initiator", "recipient", "listing", "status", "message_total", "last_message_at",
    )
    # Bodies stay out (spec 33.5); who wrote to whom, when and how much is operational data.
    list_filter = (
        "conversation_type",
        "status",
        ("broker", admin.RelatedOnlyFieldListFilter),
        ("professional", admin.RelatedOnlyFieldListFilter),
        "last_message_at",
    )
    date_hierarchy = "last_message_at"
    list_select_related = ("initiator", "broker", "professional", "listing", "listing__owner_user")
    search_fields = (
        "id", "initiator__email", "subject", "broker__name", "professional__display_name", "listing__owner_user__email",
    )
    readonly_fields = tuple(field.name for field in Conversation._meta.fields)

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(_message_total=Count("messages"))

    @admin.display(description="Recipient")
    def recipient(self, conversation):
        if conversation.professional_id:
            return f"Professional: {conversation.professional.display_name}"
        if conversation.broker_id:
            return f"Broker: {conversation.broker.name}"
        if conversation.listing_id and conversation.listing.owner_user_id:
            return f"Seller: {conversation.listing.owner_user.email}"
        return "-"

    @admin.display(description="Messages", ordering="_message_total")
    def message_total(self, conversation):
        return conversation._message_total

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
