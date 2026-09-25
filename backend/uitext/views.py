from django.http import HttpResponse, HttpResponseNotModified
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import LOCALES, TextRelease
from .services import bundle


class UiTextView(APIView):
    """GET /api/v1/ui-text/<locale>/ - the published site text of one language, cheap to cache."""

    permission_classes = [AllowAny]
    authentication_classes: list = []
    throttle_scope = "public_settings"

    def get(self, request, locale):
        if locale not in LOCALES:
            return Response({"detail": "Unknown language."}, status=404)
        version = TextRelease.current().version
        etag = f'"{locale}-{version}"'
        if request.headers.get("If-None-Match") == etag:
            response = HttpResponseNotModified()
        else:
            response = Response({"locale": locale, "version": version, "messages": bundle(locale)})
        response["ETag"] = etag
        response["Cache-Control"] = "public, max-age=60"
        return response
