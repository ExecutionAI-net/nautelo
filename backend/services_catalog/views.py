from django.db.models import Count, Q
from rest_framework.exceptions import NotFound
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from professionals.enums import ProfessionalProfileStatus
from professionals.models import ProfessionalProfile

from .models import LegacyDirectoryMapping, ProfessionalService, ServiceCategory
from .pagination import ProfessionalDirectoryPagination
from .permissions import CombinedDirectoryEnabled
from .serializers import (
    ProfessionalCardSerializer,
    ProfessionalDetailSerializer,
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


def _filtered_professionals(params, *, exclude=frozenset()):
    """Active professionals matching every current filter except `exclude`d ones.

    A facet's own dimension is always in `exclude` when the facet's counts are
    computed, so choosing "Full brokerage" narrows Croatia's count to the
    professionals that actually offer it instead of freezing every country at
    its grand total, and choosing Croatia narrows the specialization counts to
    Croatia instead of hiding every other specialization down to whatever is
    already selected.
    """
    queryset = ProfessionalProfile.objects.filter(status=ProfessionalProfileStatus.ACTIVE)

    if "category" not in exclude:
        category = params.get("category", "").strip()
        if category:
            queryset = queryset.filter(
                services__is_active=True,
                services__category__slug=category,
                services__category__is_active=True,
            )

    if "q" not in exclude:
        query = params.get("q", "").strip()
        if query:
            queryset = queryset.filter(
                Q(display_name__icontains=query)
                | Q(short_description__icontains=query)
                | Q(services__title_en__icontains=query, services__is_active=True)
            )

    if "location" not in exclude:
        location = params.get("location", "").strip()
        if location:
            queryset = queryset.filter(
                Q(city__icontains=location)
                | Q(region__icontains=location)
                | Q(service_area__contains=[location])
            )

    if "country" not in exclude:
        country = params.get("country", "").strip().upper()
        if country:
            queryset = queryset.filter(country_code=country)

    if "place" not in exclude:
        place = params.get("place", "").strip()
        if place.isdigit():
            queryset = queryset.filter(place_geoname_id=int(place))

    return queryset


def _distinct_professional_ids(queryset):
    """The queryset's distinct professional ids.

    Filtering by `category` or `q` above joins in `services`, which can repeat
    a profile once per matching service row; selecting only `pk` and calling
    `.distinct()` here (rather than on the wider row `_filtered_professionals`
    returns) is what keeps that join from inflating a facet's counts.
    """
    return list(queryset.values_list("pk", flat=True).distinct())


class ProfessionalDirectoryListView(LocalizedContextMixin, ListAPIView):
    """Combined-directory results (spec §14.1 item 3; spec §29.4 filters)."""

    serializer_class = ProfessionalCardSerializer
    permission_classes = [AllowAny, CombinedDirectoryEnabled]
    pagination_class = ProfessionalDirectoryPagination
    throttle_scope = "services_directory"

    def get_queryset(self):
        params = self.request.query_params
        queryset = (
            _filtered_professionals(params)
            .prefetch_related("services__category")
            .annotate(
                active_service_count=Count(
                    "services", filter=Q(services__is_active=True), distinct=True
                )
            )
        )

        if params.get("sort", "recommended").strip() == "alphabetical":
            # `display_name` isn't unique, so `id` is appended as a final
            # tiebreak to keep ordering fully deterministic across page loads.
            ordering = ("display_name", "id")
        else:
            # "Recommended" = breadth of real catalogue coverage, with a
            # deterministic tiebreak so pagination stays stable. No invented
            # ranking signal (spec §2.1). `id` is appended after
            # `display_name` because `display_name` isn't unique either.
            ordering = ("-active_service_count", "display_name", "id")

        from django.db.models import Case, IntegerField, When
        from django.utils import timezone

        queryset = queryset.annotate(
            _promo_rank=Case(When(featured_until__gt=timezone.now(), then=0), default=1, output_field=IntegerField())
        )
        return queryset.order_by("_promo_rank", *ordering).distinct()

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        params = request.query_params

        location_ids = _distinct_professional_ids(_filtered_professionals(params, exclude={"country", "place"}))
        countries = {}
        # Keyed by place_geoname_id, same precedent as listings' and brokers' own
        # location facets: a profile without a real place (free text only) counts
        # toward its country but is not offered as a city choice.
        locations = {}
        for code, place_id, city in ProfessionalProfile.objects.filter(pk__in=location_ids).values_list(
            "country_code", "place_geoname_id", "city"
        ):
            if code:
                countries[code] = countries.get(code, 0) + 1
            if place_id:
                entry = locations.setdefault(place_id, {"country": code, "place_id": place_id, "city": city, "count": 0})
                entry["count"] += 1

        category_ids = _distinct_professional_ids(_filtered_professionals(params, exclude={"category"}))
        categories = {}
        for slug, _professional_id in (
            ProfessionalService.objects.filter(
                is_active=True, category__is_active=True, professional_id__in=category_ids
            )
            .values_list("category__slug", "professional_id")
            .distinct()
        ):
            categories[slug] = categories.get(slug, 0) + 1

        response.data["facets"] = {
            "countries": countries,
            "locations": sorted(locations.values(), key=lambda row: (row["country"], row["city"])),
            "categories": categories,
        }
        return response


class ProfessionalDetailView(LocalizedContextMixin, RetrieveAPIView):
    serializer_class = ProfessionalDetailSerializer
    permission_classes = [AllowAny, CombinedDirectoryEnabled]
    lookup_field = "slug"
    throttle_scope = "services_directory"

    def get_queryset(self):
        # Only ACTIVE profiles are public: DRAFT/PENDING/SUSPENDED 404 rather
        # than 403, so a hidden profile's existence is never disclosed.
        return (
            ProfessionalProfile.objects.filter(status=ProfessionalProfileStatus.ACTIVE)
            .prefetch_related("services__category")
            .annotate(
                active_service_count=Count(
                    "services", filter=Q(services__is_active=True), distinct=True
                )
            )
        )


class LegacyProfessionalRedirectView(APIView):
    """Resolve spec §4.3's /professionals/profile/?id=<legacy> to a canonical URL.

    200 with the destination when resolvable, 404 otherwise; the Next.js route
    handler turns a 200 into a single-hop 301 and anything else into a 404.
    """

    permission_classes = [AllowAny, CombinedDirectoryEnabled]
    throttle_scope = "services_directory"

    def get(self, request):
        legacy_id = request.query_params.get("id", "").strip()
        if not legacy_id:
            raise DRFValidationError({"id": "This query parameter is required."})

        provider_mappings = LegacyDirectoryMapping.objects.filter(
            legacy_kind=LegacyDirectoryMapping.LegacyKind.PROVIDER,
            resolution=LegacyDirectoryMapping.Resolution.MAPPED,
            target_type=LegacyDirectoryMapping.TargetType.PROFESSIONAL_PROFILE,
        ).exclude(target_id=None)

        mapping = provider_mappings.filter(legacy_identifier=legacy_id).first()
        if mapping is None:
            # Spec §14.3 step 4: a slug that changed during migration still
            # needs a deterministic redirect. The import command records the
            # old slug on the mapping row (legacy_slug) precisely so this
            # lookup has something to match when the identifier itself
            # doesn't (e.g. an old URL built from the old slug, not the
            # legacy numeric id).
            mapping = provider_mappings.filter(legacy_slug=legacy_id).first()

        active = ProfessionalProfile.objects.filter(status=ProfessionalProfileStatus.ACTIVE)
        profile = (
            active.filter(pk=mapping.target_id).first()
            if mapping
            # Spec §14.3 step 4: a slug that survived the migration unchanged
            # resolves without needing a mapping row.
            else active.filter(slug=legacy_id).first()
        )
        if profile is None:
            raise NotFound()

        return Response({"url": profile.get_absolute_url()})
