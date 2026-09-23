from django.urls import path

from messaging.contact_views import ContactAccessView, StaffContactGrantRevokeView
from messaging.staff_views import StaffContactGrantListView
from messaging.views import (
    ConversationDetailView,
    ConversationStatusView,
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
    path(
        "contacts/<str:target_type>/<uuid:target_id>/",
        ContactAccessView.as_view(),
        name="contact-access",
    ),
    path("staff/contact-grants/", StaffContactGrantListView.as_view(), name="staff-contact-grant-list"),
    path(
        "staff/contact-grants/<uuid:grant_id>/revoke/",
        StaffContactGrantRevokeView.as_view(),
        name="staff-contact-grant-revoke",
    ),
    path(
        "conversations/<uuid:conversation_id>/",
        ConversationDetailView.as_view(),
        name="conversation-detail",
    ),
    path(
        "conversations/<uuid:conversation_id>/status/",
        ConversationStatusView.as_view(),
        name="conversation-status",
    ),
]
