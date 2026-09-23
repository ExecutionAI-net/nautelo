from django.urls import path

from common.org_image_views import ProfessionalServicePhotoCompleteView, ProfessionalServicePhotoIntentView

from .provider_views import ProviderProfileView, ProviderServiceDetailView, ProviderServiceListView

urlpatterns = [
    path("provider/profile/", ProviderProfileView.as_view(), name="provider-profile"),
    path("provider/services/", ProviderServiceListView.as_view(), name="provider-service-list"),
    path("provider/services/<uuid:pk>/", ProviderServiceDetailView.as_view(), name="provider-service-detail"),
    path(
        "provider/services/<uuid:service_id>/images/intent/",
        ProfessionalServicePhotoIntentView.as_view(),
        name="provider-service-image-intent",
    ),
    path(
        "provider/services/<uuid:service_id>/images/complete/",
        ProfessionalServicePhotoCompleteView.as_view(),
        name="provider-service-image-complete",
    ),
]
