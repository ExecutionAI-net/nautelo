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
        # Added with Phase 9 Task 10: the effective down-payment percentage must
        # travel with the quote, otherwise a listing's own override (spec §17.3)
        # could never reach the finance page's form and Recalculate would send
        # the platform default in its place.
        "down_payment_percent": "20.0000",
        "monthly_payment": "8456.36",
        "total_payment": "405905.12",
        "total_interest": "38705.12",
        # Manual quotes ignore the stored active configuration entirely (the
        # client supplied every input), so a version number here would
        # misleadingly imply a relationship that doesn't exist — see Task 7's
        # ruling note.
        "configuration_version": None,
        "disclaimer_key": "finance.illustrative_disclaimer",
        # Added by Phase 9 (docs/superpowers/plans/2026-09-18-phase-9-finance-ui
        # .md, Task 5). FinanceQuoteView._quote_response now builds ONE response
        # shape for both of spec §17.4's contexts, so `assumption_sources` is
        # present on a manual quote too — and is None here, because a manual
        # quote reads no stored configuration and no listing override, so there
        # is no platform source (§17.2's GLOBAL / LISTING_OVERRIDE) to report.
        #
        # This exact-dict assertion is Phase 8's locked contract for the manual
        # context and it is widened deliberately, in the same commit as the
        # change that widens the response. The alternative — omitting the key on
        # the manual path — would leave two response shapes behind one endpoint
        # and force the frontend's FinanceQuote type into an optional field or a
        # second type, for no gain. Every other key above is unchanged, and the
        # money values are the proof that the calculation itself did not move.
        "assumption_sources": None,
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
