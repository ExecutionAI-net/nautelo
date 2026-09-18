from django.db.models import Count, Q
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.permissions import AllowAny

from professionals.enums import ProfessionalProfileStatus
from professionals.models import ProfessionalProfile

from .models import ServiceCategory
from .pagination import ProfessionalDirectoryPagination
from .permissions import CombinedDirectoryEnabled
from .serializers import (
    ProfessionalCardSerializer,
    ServiceCategoryDetailSerializer,
    ServiceCategorySerializer,
)
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


class ProfessionalDirectoryListView(LocalizedContextMixin, ListAPIView):
    """Combined-directory results (spec §14.1 item 3; spec §29.4 filters)."""

    serializer_class = ProfessionalCardSerializer
    permission_classes = [AllowAny, CombinedDirectoryEnabled]
    pagination_class = ProfessionalDirectoryPagination
    throttle_scope = "services_directory"

    def get_queryset(self):
        params = self.request.query_params
        queryset = (
            ProfessionalProfile.objects.filter(status=ProfessionalProfileStatus.ACTIVE)
            .prefetch_related("services__category")
            .annotate(
                active_service_count=Count(
                    "services", filter=Q(services__is_active=True), distinct=True
                )
            )
        )

        category = params.get("category", "").strip()
        if category:
            queryset = queryset.filter(
                services__is_active=True,
                services__category__slug=category,
                services__category__is_active=True,
            )

        query = params.get("q", "").strip()
        if query:
            queryset = queryset.filter(
                Q(display_name__icontains=query)
                | Q(short_description__icontains=query)
                | Q(services__title_en__icontains=query, services__is_active=True)
            )

        location = params.get("location", "").strip()
        if location:
            queryset = queryset.filter(
                Q(city__icontains=location)
                | Q(region__icontains=location)
                | Q(service_area__contains=[location])
            )

        if params.get("sort", "recommended").strip() == "alphabetical":
            ordering = ("display_name",)
        else:
            # "Recommended" = breadth of real catalogue coverage, with a
            # deterministic tiebreak so pagination stays stable. No invented
            # ranking signal (spec §2.1).
            ordering = ("-active_service_count", "display_name")

        return queryset.order_by(*ordering).distinct()
