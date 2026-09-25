from unittest.mock import patch

import pytest
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_health_check_returns_ok_when_all_dependencies_healthy():
    client = APIClient()
    with (
        patch("common.views.HealthCheckView._check_database", return_value="ok"),
        patch("common.views.HealthCheckView._check_redis", return_value="ok"),
        patch("common.views.HealthCheckView._check_celery", return_value="ok"),
        patch("common.views.HealthCheckView._check_media_scanner", return_value="ok"),
    ):
        response = client.get("/api/v1/health/")

    assert response.status_code == 200
    assert response.data == {
        "status": "ok",
        "checks": {"database": "ok", "redis": "ok", "celery_worker": "ok", "media_scanner": "ok"},
    }


@pytest.mark.django_db
def test_a_dead_malware_scanner_is_reported_without_taking_the_api_down():
    """Photos stop becoming READY when clamd is down, but logins, reads and
    checkouts do not: the operator sees it here, the container stays up."""
    client = APIClient()
    with (
        patch("common.views.HealthCheckView._check_database", return_value="ok"),
        patch("common.views.HealthCheckView._check_redis", return_value="ok"),
        patch("common.views.HealthCheckView._check_celery", return_value="ok"),
        patch("listings.media_scan.ping_clamd", return_value=False),
        patch("django.conf.settings.MEDIA_SCANNER", "listings.media_scan.clamd_scan"),
    ):
        response = client.get("/api/v1/health/")

    assert response.status_code == 200
    assert response.data["status"] == "ok"
    assert response.data["checks"]["media_scanner"] == "unavailable"


@pytest.mark.django_db
def test_health_check_returns_503_when_a_dependency_is_down():
    client = APIClient()
    with (
        patch("common.views.HealthCheckView._check_database", return_value="ok"),
        patch("common.views.HealthCheckView._check_redis", return_value="unavailable"),
        patch("common.views.HealthCheckView._check_celery", return_value="ok"),
        patch("common.views.HealthCheckView._check_media_scanner", return_value="ok"),
    ):
        response = client.get("/api/v1/health/")

    assert response.status_code == 503
    assert response.data["status"] == "degraded"
    assert response.data["checks"]["redis"] == "unavailable"
