import uuid

from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny

from .models import BoatBrand, BoatModel
from .pagination import TaxonomySearchPagination
from .serializers import BoatBrandSerializer, BoatModelSerializer
from .services import normalize_taxonomy_name


class BoatBrandListView(ListAPIView):
    serializer_class = BoatBrandSerializer
    permission_classes = [AllowAny]
    pagination_class = TaxonomySearchPagination
    throttle_scope = "taxonomy_search"

    def get_queryset(self):
        queryset = BoatBrand.objects.filter(is_active=True).order_by("name")
        query = self.request.query_params.get("q", "").strip()
        if query:
            queryset = queryset.filter(
                normalized_name__icontains=normalize_taxonomy_name(query)
            )
        return queryset


class BoatModelListView(ListAPIView):
    serializer_class = BoatModelSerializer
    permission_classes = [AllowAny]
    pagination_class = TaxonomySearchPagination
    throttle_scope = "taxonomy_search"

    def get_queryset(self):
        brand_id = self.request.query_params.get("brand_id")
        if not brand_id:
            raise DRFValidationError({"brand_id": "This query parameter is required."})
        try:
            uuid.UUID(brand_id)
        except ValueError as exc:
            raise DRFValidationError({"brand_id": "Must be a valid UUID."}) from exc

        queryset = BoatModel.objects.filter(
            brand_id=brand_id,
            brand__is_active=True,
            is_active=True,
            is_other_placeholder=False,
        ).order_by("name")
        query = self.request.query_params.get("q", "").strip()
        if query:
            queryset = queryset.filter(
                normalized_name__icontains=normalize_taxonomy_name(query)
            )
        return queryset

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        query = request.query_params.get("q", "").strip()

        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page, many=True)
        response = self.get_paginated_response(serializer.data)
        total_count = self.paginator.page.paginator.count

        brand_id = request.query_params.get("brand_id")
        other = (
            BoatModel.objects.filter(
                brand_id=brand_id, brand__is_active=True, is_other_placeholder=True
            )
            .values("id")
            .first()
        )
        response.data["other"] = (
            {"id": str(other["id"]), "label": "Other"} if other else None
        )
        response.data["show_other_prompt"] = bool(query) and total_count == 0
        return response
