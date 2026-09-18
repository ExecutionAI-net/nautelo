from django.urls import path

from .views import (
    ProfessionalDirectoryListView,
    ServiceCategoryDetailView,
    ServiceCategoryListView,
)

urlpatterns = [
    path(
        "professionals/",
        ProfessionalDirectoryListView.as_view(),
        name="professional-directory",
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
