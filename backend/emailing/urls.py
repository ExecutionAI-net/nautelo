from django.urls import path

from .staff_views import (
    StaffEmailTemplateDetailView,
    StaffEmailTemplateListView,
    StaffEmailTemplatePreviewView,
    StaffEmailTemplateTestSendView,
)

urlpatterns = [
    path("staff/email-templates/", StaffEmailTemplateListView.as_view(), name="staff-email-template-list"),
    path(
        "staff/email-templates/<str:key>/<str:locale>/",
        StaffEmailTemplateDetailView.as_view(),
        name="staff-email-template-detail",
    ),
    path(
        "staff/email-templates/<str:key>/<str:locale>/preview/",
        StaffEmailTemplatePreviewView.as_view(),
        name="staff-email-template-preview",
    ),
    path(
        "staff/email-templates/<str:key>/<str:locale>/test-send/",
        StaffEmailTemplateTestSendView.as_view(),
        name="staff-email-template-test-send",
    ),
]
