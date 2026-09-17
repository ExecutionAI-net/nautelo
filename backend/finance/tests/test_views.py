import pytest
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_finance_quote_endpoint_matches_spec_worked_example():
    client = APIClient()

    response = client.post(
        "/api/v1/finance/quotes/",
        data={
            "price": "459000.00",
            "down_payment_percent": "20.00",
            "annual_rate_percent": "5.00",
            "term_months": 48,
            "currency": "EUR",
        },
        format="json",
    )

    assert response.status_code == 200
    assert response.data == {
        "currency": "EUR",
        "price": "459000.00",
        "down_payment_amount": "91800.00",
        "principal": "367200.00",
        "annual_rate_percent": "5.0000",
        "term_months": 48,
        "monthly_payment": "8456.36",
        "total_payment": "405905.12",
        "total_interest": "38705.12",
        # Manual quotes ignore the stored active configuration entirely (the
        # client supplied every input), so a version number here would
        # misleadingly imply a relationship that doesn't exist — see Task 7's
        # ruling note.
        "configuration_version": None,
        "disclaimer_key": "finance.illustrative_disclaimer",
    }


@pytest.mark.django_db
def test_finance_quote_endpoint_works_for_anonymous_guests():
    client = APIClient()

    response = client.post(
        "/api/v1/finance/quotes/",
        data={
            "price": "248000.00",
            "down_payment_percent": "20.00",
            "annual_rate_percent": "5.00",
            "term_months": 48,
            "currency": "EUR",
        },
        format="json",
    )

    assert response.status_code == 200
    assert response.data["monthly_payment"] == "4569.01"


@pytest.mark.django_db
def test_finance_quote_endpoint_rejects_unsupported_currency():
    client = APIClient()

    response = client.post(
        "/api/v1/finance/quotes/",
        data={
            "price": "100000.00",
            "down_payment_percent": "20.00",
            "annual_rate_percent": "5.00",
            "term_months": 48,
            "currency": "USD",
        },
        format="json",
    )

    assert response.status_code == 400
    assert response.data["error"]["code"] == "unsupported_currency"


@pytest.mark.django_db
def test_finance_quote_endpoint_rejects_invalid_term_with_field_errors():
    client = APIClient()

    response = client.post(
        "/api/v1/finance/quotes/",
        data={
            "price": "100000.00",
            "down_payment_percent": "20.00",
            "annual_rate_percent": "5.00",
            "term_months": 400,
            "currency": "EUR",
        },
        format="json",
    )

    assert response.status_code == 400
    assert response.data["error"]["code"] == "validation_error"
    assert "term_months" in response.data["error"]["fields"]


@pytest.mark.django_db
def test_finance_quote_endpoint_echoes_request_id_header_on_error():
    client = APIClient()

    response = client.post(
        "/api/v1/finance/quotes/",
        data={
            "price": "100000.00",
            "down_payment_percent": "20.00",
            "annual_rate_percent": "5.00",
            "term_months": 400,
            "currency": "EUR",
        },
        format="json",
        HTTP_X_REQUEST_ID="req-test-123",
    )

    assert response.data["error"]["request_id"] == "req-test-123"
