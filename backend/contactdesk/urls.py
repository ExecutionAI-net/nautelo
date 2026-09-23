from django.urls import path

from .views import ContactRequestView, StaffContactRequestListView, StaffContactRequestUpdateView

urlpatterns = [
    path("contact/", ContactRequestView.as_view(), name="contact-request"),
    path("staff/contact-requests/", StaffContactRequestListView.as_view(), name="staff-contact-request-list"),
    path("staff/contact-requests/<uuid:pk>/", StaffContactRequestUpdateView.as_view(), name="staff-contact-request-update"),
]
