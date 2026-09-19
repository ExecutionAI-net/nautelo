from django.urls import path

from messaging.views import (
    ConversationMessagesView,
    ConversationReadView,
    ConversationListView,
    InquiryConfigView,
    InquiryCreateView,
    InquiryDraftCreateView,
    InquiryDraftResolveView,
)

urlpatterns = [
    path("inquiries/", InquiryCreateView.as_view(), name="inquiry-create"),
    path("inquiries/config/", InquiryConfigView.as_view(), name="inquiry-config"),
    path(
        "inquiry-drafts/",
        InquiryDraftCreateView.as_view(),
        name="inquiry-draft-create",
    ),
    path(
        "inquiry-drafts/resolve/",
        InquiryDraftResolveView.as_view(),
        name="inquiry-draft-resolve",
    ),
    path("conversations/", ConversationListView.as_view(), name="conversation-list"),
    path(
        "conversations/<uuid:conversation_id>/messages/",
        ConversationMessagesView.as_view(),
        name="conversation-messages",
    ),
    path(
        "conversations/<uuid:conversation_id>/read/",
        ConversationReadView.as_view(),
        name="conversation-read",
    ),
]
