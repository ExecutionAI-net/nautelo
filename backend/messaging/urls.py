from django.urls import path

from messaging.views import (
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
]
