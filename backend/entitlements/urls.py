from django.urls import path

from .staff_views import (
    StaffEntitlementGrantView,
    StaffEntitlementListView,
    StaffEntitlementRestoreView,
    StaffEntitlementRevokeView,
)
from .views import ListingEligibilityView, MyPaidListingsView

urlpatterns = [
    path(
        "listing-eligibility/",
        ListingEligibilityView.as_view(),
        name="listing-eligibility",
    ),
    path("paid-listings/", MyPaidListingsView.as_view(), name="my-paid-listings"),
    path("staff/entitlements/", StaffEntitlementListView.as_view(), name="staff-entitlement-list"),
    path("staff/entitlements/grants/", StaffEntitlementGrantView.as_view(), name="staff-entitlement-grant"),
    path(
        "staff/entitlements/<uuid:entitlement_id>/revoke/",
        StaffEntitlementRevokeView.as_view(),
        name="staff-entitlement-revoke",
    ),
    path(
        "staff/entitlements/<uuid:entitlement_id>/restore/",
        StaffEntitlementRestoreView.as_view(),
        name="staff-entitlement-restore",
    ),
]
