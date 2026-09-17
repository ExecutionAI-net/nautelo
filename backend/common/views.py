import stripe
from django.conf import settings
from django.core.cache import cache
from django.db import connection
from django.http import HttpResponse
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
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
        healthy = all(value == "ok" for value in checks.values())
        return Response(
            {"status": "ok" if healthy else "degraded", "checks": checks},
            status=200 if healthy else 503,
        )

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


@method_decorator(csrf_exempt, name="dispatch")
class StripeWebhookView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        payload = request.body
        sig_header = request.META.get("HTTP_STRIPE_SIGNATURE", "")
        try:
            stripe.Webhook.construct_event(
                payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
            )
        except (ValueError, stripe.error.SignatureVerificationError):
            return HttpResponse(status=400)
        return HttpResponse(status=200)
