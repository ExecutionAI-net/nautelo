from django.urls import path

from brokers.views import (
    BrokerApprovalPolicyView,
    BrokerMemberDetailView,
    BrokerMemberListView,
    StaffBrokerDetailView,
)

urlpatterns = [
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
]
