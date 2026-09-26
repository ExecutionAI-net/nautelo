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
    ):
        response = client.get("/api/v1/health/")

    assert response.status_code == 200
    assert response.data == {
        "status": "ok",
        "checks": {"database": "ok", "redis": "ok", "celery_worker": "ok"},
    }


@pytest.mark.django_db
def test_health_check_returns_503_when_a_dependency_is_down():
    client = APIClient()
    with (
        patch("common.views.HealthCheckView._check_database", return_value="ok"),
        patch("common.views.HealthCheckView._check_redis", return_value="unavailable"),
        patch("common.views.HealthCheckView._check_celery", return_value="ok"),
    ):
        response = client.get("/api/v1/health/")

    assert response.status_code == 503
    assert response.data["status"] == "degraded"
    assert response.data["checks"]["redis"] == "unavailable"
