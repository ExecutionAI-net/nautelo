from django.urls import path

from .provider_views import ProviderProfileView, ProviderServiceDetailView, ProviderServiceListView

urlpatterns = [
    path("provider/profile/", ProviderProfileView.as_view(), name="provider-profile"),
    path("provider/services/", ProviderServiceListView.as_view(), name="provider-service-list"),
    path("provider/services/<uuid:pk>/", ProviderServiceDetailView.as_view(), name="provider-service-detail"),
]
