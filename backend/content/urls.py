from django.urls import path

from .views import (
    PublicAdListView,
    PublicGuideDetailView,
    PublicGuideListView,
    StaffAdDetailView,
    StaffAdListView,
    StaffGuideDetailView,
    StaffAdTargetListView,
    StaffGuideListView,
)

urlpatterns = [
    path("guides/", PublicGuideListView.as_view(), name="guide-list"),
    path("guides/<slug:slug>/", PublicGuideDetailView.as_view(), name="guide-detail"),
    path("ads/", PublicAdListView.as_view(), name="ad-list"),
    path("staff/guides/", StaffGuideListView.as_view(), name="staff-guide-list"),
    path("staff/guides/<uuid:pk>/", StaffGuideDetailView.as_view(), name="staff-guide-detail"),
    path("staff/ads/", StaffAdListView.as_view(), name="staff-ad-list"),
    path("staff/ad-targets/", StaffAdTargetListView.as_view(), name="staff-ad-targets"),
    path("staff/ads/<uuid:pk>/", StaffAdDetailView.as_view(), name="staff-ad-detail"),
]
