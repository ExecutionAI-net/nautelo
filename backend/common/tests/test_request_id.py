import pytest


@pytest.mark.django_db
def test_response_carries_a_generated_request_id(client):
    response = client.get("/api/v1/health/")
    assert len(response.headers["X-Request-ID"]) == 32


@pytest.mark.django_db
def test_incoming_request_id_is_echoed_back(client):
    response = client.get("/api/v1/health/", headers={"x-request-id": "abc-123"})
    assert response.headers["X-Request-ID"] == "abc-123"


@pytest.mark.django_db
def test_unsafe_incoming_request_id_is_discarded(client):
    response = client.get("/api/v1/health/", headers={"x-request-id": "bad value <script>"})
    assert response.headers["X-Request-ID"] != "bad value <script>"
    assert len(response.headers["X-Request-ID"]) == 32
