from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.permissions import AllowAny

from .models import ServiceCategory
from .permissions import CombinedDirectoryEnabled
from .serializers import ServiceCategoryDetailSerializer, ServiceCategorySerializer
from .services import resolve_locale


class LocalizedContextMixin:
    """Put the resolved ?locale= value in the serializer context."""

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["locale"] = resolve_locale(self.request.query_params.get("locale"))
        return context


class ServiceCategoryListView(LocalizedContextMixin, ListAPIView):
    serializer_class = ServiceCategorySerializer
    permission_classes = [AllowAny, CombinedDirectoryEnabled]
    pagination_class = None
    throttle_scope = "services_directory"

    def get_queryset(self):
        return ServiceCategory.objects.filter(is_active=True)


class ServiceCategoryDetailView(LocalizedContextMixin, RetrieveAPIView):
    serializer_class = ServiceCategoryDetailSerializer
    permission_classes = [AllowAny, CombinedDirectoryEnabled]
    lookup_field = "slug"
    throttle_scope = "services_directory"

    def get_queryset(self):
        return ServiceCategory.objects.filter(is_active=True)
