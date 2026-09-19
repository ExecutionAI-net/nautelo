from django.urls import path

from .views import (
    StaffBrokerStatusView,
    StaffProviderStatusView,
    StaffBoatListView,
    StaffBrokerListView,
    StaffLeadListView,
    StaffProviderListView,
    StaffReportsView,
    StaffSubscriptionListView,
    StaffUserListView,
)

urlpatterns = [
    path("staff/brokers/<uuid:pk>/status/", StaffBrokerStatusView.as_view(), name="staff-broker-status"),
    path("staff/providers/<uuid:pk>/status/", StaffProviderStatusView.as_view(), name="staff-provider-status"),
    path("staff/boats/", StaffBoatListView.as_view(), name="staff-boat-list"),
    path("staff/users/", StaffUserListView.as_view(), name="staff-user-list"),
    path("staff/brokers/", StaffBrokerListView.as_view(), name="staff-broker-list"),
    path("staff/providers/", StaffProviderListView.as_view(), name="staff-provider-list"),
    path("staff/leads/", StaffLeadListView.as_view(), {"kind": "leads"}, name="staff-lead-list"),
    path("staff/service-requests/", StaffLeadListView.as_view(), {"kind": "service-requests"}, name="staff-service-request-list"),
    path("staff/subscriptions/", StaffSubscriptionListView.as_view(), name="staff-subscription-list"),
    path("staff/reports/", StaffReportsView.as_view(), name="staff-reports"),
]
