from django.urls import path

from brokers.public_views import PublicBrokerDetailView, PublicBrokerListView
from brokers.views import (
    BrokerDashboardView,
    BrokerApprovalPolicyView,
    BrokerMemberDetailView,
    BrokerMemberListView,
    BrokerPendingApprovalsView,
    BrokerSubscriptionView,
    BrokerBillingPortalView,
    StaffBrokerDetailView,
)

from brokers.plan_views import (
    PublicPricingView,
    StaffBrokerSubscriptionListView,
    StaffBrokerPlanAssignView,
    StaffPlanDetailView,
    StaffPlanListView,
)
from brokers.profile_views import BrokerProfileSubmitView, BrokerProfileView

urlpatterns = [
    path("staff/broker-subscriptions/", StaffBrokerSubscriptionListView.as_view(), name="staff-broker-subscriptions"),
    path("pricing/", PublicPricingView.as_view(), name="public-pricing"),
    path("brokers/<uuid:broker_id>/subscription/", BrokerSubscriptionView.as_view(), name="broker-subscription"),
    path("brokers/<uuid:broker_id>/subscription/portal/", BrokerBillingPortalView.as_view(), name="broker-billing-portal"),
    path("staff/broker-plans/", StaffPlanListView.as_view(), name="staff-broker-plan-list"),
    path("staff/broker-plans/<uuid:pk>/", StaffPlanDetailView.as_view(), name="staff-broker-plan-detail"),
    path("staff/brokers/<uuid:pk>/plan/", StaffBrokerPlanAssignView.as_view(), name="staff-broker-plan-assign"),
    path("brokers/<uuid:broker_id>/profile/", BrokerProfileView.as_view(), name="broker-profile"),
    path("brokers/<uuid:broker_id>/profile/submit/", BrokerProfileSubmitView.as_view(), name="broker-profile-submit"),
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
