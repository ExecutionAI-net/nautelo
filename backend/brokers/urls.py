from django.urls import path

from brokers.public_views import PublicBrokerDetailView, PublicBrokerListView
from brokers.views import (
    BrokerDashboardView,
    BrokerApprovalPolicyView,
    BrokerMemberDetailView,
    BrokerMemberListView,
    BrokerPendingApprovalsView,
    StaffBrokerDetailView,
)

urlpatterns = [
    path("brokers/", PublicBrokerListView.as_view(), name="public-broker-list"),
    path(
        "brokers/by-slug/<slug:slug>/",
        PublicBrokerDetailView.as_view(),
        name="public-broker-detail",
    ),
    path(
        "brokers/<uuid:broker_id>/members/",
        BrokerMemberListView.as_view(),
        name="broker-members",
    ),
    path(
        "brokers/<uuid:broker_id>/members/<uuid:membership_id>/",
        BrokerMemberDetailView.as_view(),
        name="broker-member-detail",
    ),
    path(
        "staff/brokers/<uuid:broker_id>/",
        StaffBrokerDetailView.as_view(),
        name="staff-broker-detail",
    ),
    path(
        "staff/brokers/<uuid:broker_id>/approval-policy/",
        BrokerApprovalPolicyView.as_view(),
        name="staff-broker-approval-policy",
    ),
    path(
        "staff/brokers/<uuid:broker_id>/pending-approvals/",
        BrokerPendingApprovalsView.as_view(),
        name="staff-broker-bulk-approve",
    ),
    path(
        "brokers/<uuid:broker_id>/dashboard/",
        BrokerDashboardView.as_view(),
        name="broker-dashboard",
    ),
]
