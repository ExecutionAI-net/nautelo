from django.urls import path

from .views import ServiceCategoryDetailView, ServiceCategoryListView

urlpatterns = [
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
