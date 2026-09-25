from django.db.models import Q
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .importer import fold
from .models import City, Region

MAX_RESULTS = 25
LOCALES = ("en", "it", "es")


def _locale(request) -> str:
    value = (request.query_params.get("locale") or "en").lower()[:2]
    return value if value in LOCALES else "en"


class _PublicView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = "public_settings"


class RegionListView(_PublicView):
    """GET /api/v1/places/regions/?country=IT&locale=it"""

    def get(self, request):
        country = (request.query_params.get("country") or "").upper()
        if len(country) != 2:
            raise serializers.ValidationError({"country": ["Send a two-letter country code."]})
        locale = _locale(request)
        rows = sorted(Region.objects.filter(country_code=country), key=lambda r: fold(r.name(locale)))
        return Response([{"id": r.pk, "name": r.name(locale)} for r in rows])


class CitySearchView(_PublicView):
    """GET /api/v1/places/cities/?country=IT&region=<id>&q=gen&locale=it

    Accent- and language-insensitive: "genova", "Genoa" and "GÉNOVA" find the same city.
    Names that start with the query rank first, then bigger cities.
    """

    def get(self, request):
        country = (request.query_params.get("country") or "").upper()
        if len(country) != 2:
            raise serializers.ValidationError({"country": ["Send a two-letter country code."]})
        locale = _locale(request)
        rows = City.objects.filter(country_code=country).select_related("region")
        region = request.query_params.get("region")
        if region and region.isdigit():
            rows = rows.filter(region_id=int(region))
        term = fold(request.query_params.get("q") or "")
        if term:
            rows = rows.filter(Q(search_text__contains=term))
        found = list(rows.order_by("-population")[:200])
        if term:
            found.sort(key=lambda c: (not any(w.startswith(term) for w in c.search_text.split()), -c.population))
        return Response(
            [
                {
                    "id": c.geoname_id,
                    "name": c.name(locale),
                    "region_id": c.region_id,
                    "region": c.region.name(locale) if c.region else "",
                    "country": c.country_code,
                }
                for c in found[:MAX_RESULTS]
            ]
        )
