from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny
from rest_framework.throttling import ScopedRateThrottle

from .models import BoatBrand
from .pagination import TaxonomySearchPagination
from .serializers import BoatBrandSerializer
from .services import normalize_taxonomy_name


class BoatBrandListView(ListAPIView):
    serializer_class = BoatBrandSerializer
    permission_classes = [AllowAny]
    pagination_class = TaxonomySearchPagination
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "taxonomy_search"

    def get_queryset(self):
        queryset = BoatBrand.objects.filter(is_active=True).order_by("name")
        query = self.request.query_params.get("q", "").strip()
        if query:
            queryset = queryset.filter(
                normalized_name__icontains=normalize_taxonomy_name(query)
            )
        return queryset
