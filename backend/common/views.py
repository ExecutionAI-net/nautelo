from django.core.cache import cache
from django.db import connection
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthCheckView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        checks = {
            "database": self._check_database(),
            "redis": self._check_redis(),
            "celery_worker": self._check_celery(),
        }
        # The API is healthy without the malware scanner: reads, logins and
        # checkouts keep working and uploads wait in SCANNING for it. Reporting
        # it below (but outside the 503 decision) is what lets an operator see
        # why photos have stopped becoming READY without the container
        # health-check restarting an API that is fine.
        healthy = all(value == "ok" for value in checks.values())
        checks["media_scanner"] = self._check_media_scanner()
        return Response(
            {"status": "ok" if healthy else "degraded", "checks": checks},
            status=200 if healthy else 503,
        )

    def _check_media_scanner(self):
        from django.conf import settings

        if not getattr(settings, "MEDIA_SCANNER", None):
            return "disabled"
        try:
            from listings.media_scan import ping_clamd

            return "ok" if ping_clamd() else "unavailable"
        except Exception:
            return "unavailable"

    def _check_database(self):
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            return "ok"
        except Exception:
            return "unavailable"

    def _check_redis(self):
        try:
            cache.set("healthcheck-probe", "ok", timeout=5)
            return "ok" if cache.get("healthcheck-probe") == "ok" else "unavailable"
        except Exception:
            return "unavailable"

    def _check_celery(self):
        try:
            from config.celery import app as celery_app

            pings = celery_app.control.inspect(timeout=1).ping()
            return "ok" if pings else "unavailable"
        except Exception:
            return "unavailable"

