from django.urls import path

from .views import (
    LegacyProfessionalRedirectView,
    ProfessionalDetailView,
    ProfessionalDirectoryListView,
    ServiceCategoryDetailView,
    ServiceCategoryListView,
)

urlpatterns = [
    path(
        "legacy/professional-redirect/",
        LegacyProfessionalRedirectView.as_view(),
        name="legacy-professional-redirect",
    ),
    path(
        "professionals/",
        ProfessionalDirectoryListView.as_view(),
        name="professional-directory",
    ),
    path(
        "professionals/<slug:slug>/",
        ProfessionalDetailView.as_view(),
        name="professional-detail",
    ),
    path(
        "service-categories/",
        ServiceCategoryListView.as_view(),
        name="service-category-list",
    ),
    path(
        "service-categories/<slug:slug>/",
        ServiceCategoryDetailView.as_view(),
        name="service-category-detail",
    ),
]
