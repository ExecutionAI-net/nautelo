"""Public broker directory (spec 4.1: /brokers/ and /brokers/<slug>/).

Only ACTIVE organizations are visible; every other status is a 404. Contact
details are deliberately absent: they go through the contact-access flow.
"""

from django.db.models import Count, Q
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny
from rest_framework.serializers import ModelSerializer, SerializerMethodField

from listings.enums import ListingStatus

from .enums import BrokerOrganizationStatus
from .models import BrokerOrganization


class PublicBrokerSerializer(ModelSerializer):
    website_url = SerializerMethodField()
    listing_count = SerializerMethodField()
    url = SerializerMethodField()

    class Meta:
        model = BrokerOrganization
        fields = ["id", "name", "slug", "url", "website_url", "listing_count"]

    def get_website_url(self, obj):
        return obj.website_url or None

    def get_listing_count(self, obj):
        return obj.published_count

    def get_url(self, obj):
        return f"/brokers/{obj.slug}/"


def active_brokers():
    return (
        BrokerOrganization.objects.filter(status=BrokerOrganizationStatus.ACTIVE)
        .annotate(
            published_count=Count(
                "listings",
                filter=Q(
                    listings__status=ListingStatus.PUBLISHED,
                    listings__current_public_snapshot__isnull=False,
                ),
            )
        )
        .order_by("name")
    )


class _PublicBrokerBase:
    permission_classes = [AllowAny]
    authentication_classes = []
    serializer_class = PublicBrokerSerializer
    throttle_scope = "public_listing_read"

    def get_queryset(self):
        return active_brokers()


class PublicBrokerPagination(PageNumberPagination):
    page_size = 24
    max_page_size = 48
    page_size_query_param = "page_size"


class PublicBrokerListView(_PublicBrokerBase, ListAPIView):
    pagination_class = PublicBrokerPagination


class PublicBrokerDetailView(_PublicBrokerBase, RetrieveAPIView):
    lookup_field = "slug"
