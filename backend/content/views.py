from django.db.models import Q
from django.utils import timezone
from rest_framework.generics import ListAPIView, ListCreateAPIView, RetrieveAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsActiveUser, IsStaffAdmin

from .models import AdPlacement, Advertisement, GuideArticle, GuideStatus
from .serializers import (
    PublicAdSerializer,
    PublicGuideDetailSerializer,
    PublicGuideListSerializer,
    StaffAdSerializer,
    StaffGuideSerializer,
)


class GuidePagination(PageNumberPagination):
    page_size = 12
    page_size_query_param = "page_size"
    max_page_size = 48


class PublicContentView:
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = "public_content_read"


def _published_guides():
    return GuideArticle.objects.filter(status=GuideStatus.PUBLISHED, published_at__lte=timezone.now())


class PublicGuideListView(PublicContentView, ListAPIView):
    serializer_class = PublicGuideListSerializer
    pagination_class = GuidePagination

    def get_queryset(self):
        queryset = _published_guides()
        category = self.request.query_params.get("category", "").strip()
        if category:
            queryset = queryset.filter(category__iexact=category)
        return queryset

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        categories = (
            _published_guides().exclude(category="").order_by("category").values_list("category", flat=True).distinct()
        )
        response.data["categories"] = list(categories)
        return response


class PublicGuideDetailView(PublicContentView, RetrieveAPIView):
    serializer_class = PublicGuideDetailSerializer
    lookup_field = "slug"

    def get_queryset(self):
        return _published_guides()


class PublicAdListView(PublicContentView, ListAPIView):
    """Active ads inside their schedule window, optionally for one placement."""

    serializer_class = PublicAdSerializer
    pagination_class = None

    def get_queryset(self):
        now = timezone.now()
        queryset = Advertisement.objects.select_related("broker", "professional").filter(is_active=True).filter(
            Q(starts_at__isnull=True) | Q(starts_at__lte=now),
            Q(ends_at__isnull=True) | Q(ends_at__gt=now),
        )
        placement = self.request.query_params.get("placement", "").strip().upper()
        if placement in AdPlacement.values:
            queryset = queryset.filter(placement=placement)
        return queryset


class StaffContentView:
    permission_classes = [IsAuthenticated, IsActiveUser, IsStaffAdmin]
    throttle_scope = "staff_moderation"


class StaffGuideListView(StaffContentView, ListCreateAPIView):
    serializer_class = StaffGuideSerializer
    queryset = GuideArticle.objects.all()


class StaffGuideDetailView(StaffContentView, RetrieveUpdateDestroyAPIView):
    serializer_class = StaffGuideSerializer
    queryset = GuideArticle.objects.all()


class StaffAdListView(StaffContentView, ListCreateAPIView):
    serializer_class = StaffAdSerializer
    queryset = Advertisement.objects.all()


class StaffAdDetailView(StaffContentView, RetrieveUpdateDestroyAPIView):
    serializer_class = StaffAdSerializer
    queryset = Advertisement.objects.all()


class StaffAdTargetListView(StaffContentView, APIView):
    """Active brokers and professionals an ad can point at, filtered by name."""

    def get(self, request):
        from brokers.models import BrokerOrganization
        from professionals.models import ProfessionalProfile

        needle = request.query_params.get("q", "").strip()
        brokers = BrokerOrganization.objects.filter(status="ACTIVE")
        professionals = ProfessionalProfile.objects.filter(status="ACTIVE")
        if needle:
            brokers = brokers.filter(name__icontains=needle)
            professionals = professionals.filter(display_name__icontains=needle)
        return Response(
            {
                "brokers": [{"id": str(b.pk), "label": b.name} for b in brokers.order_by("name")[:50]],
                "professionals": [{"id": str(p.pk), "label": p.display_name} for p in professionals.order_by("display_name")[:50]],
            }
        )
