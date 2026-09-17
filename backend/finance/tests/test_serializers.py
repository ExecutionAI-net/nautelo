import pytest

from finance.serializers import FinanceQuoteRequestSerializer


def _valid_payload(**overrides):
    payload = {
        "price": "459000.00",
        "down_payment_percent": "20.00",
        "annual_rate_percent": "5.00",
        "term_months": 48,
        "currency": "EUR",
    }
    payload.update(overrides)
    return payload


def test_accepts_a_fully_valid_payload():
    from decimal import Decimal

    serializer = FinanceQuoteRequestSerializer(data=_valid_payload())

    assert serializer.is_valid(), serializer.errors
    assert serializer.validated_data["price"] == Decimal("459000.00")
    assert serializer.validated_data["currency"] == "EUR"


def test_lowercase_currency_is_normalized_to_uppercase():
    serializer = FinanceQuoteRequestSerializer(data=_valid_payload(currency="eur"))

    assert serializer.is_valid(), serializer.errors
    assert serializer.validated_data["currency"] == "EUR"


@pytest.mark.parametrize("bad_price", ["0.00", "-1.00", "1000000000.00"])
def test_rejects_price_outside_allowed_range(bad_price):
    serializer = FinanceQuoteRequestSerializer(data=_valid_payload(price=bad_price))

    assert not serializer.is_valid()
    assert "price" in serializer.errors


@pytest.mark.parametrize("bad_rate", ["-0.01", "100.01"])
def test_rejects_annual_rate_outside_allowed_range(bad_rate):
    serializer = FinanceQuoteRequestSerializer(data=_valid_payload(annual_rate_percent=bad_rate))

    assert not serializer.is_valid()
    assert "annual_rate_percent" in serializer.errors


@pytest.mark.parametrize("bad_term", [0, 361])
def test_rejects_term_outside_allowed_range(bad_term):
    serializer = FinanceQuoteRequestSerializer(data=_valid_payload(term_months=bad_term))

    assert not serializer.is_valid()
    assert "term_months" in serializer.errors


@pytest.mark.parametrize("bad_down_payment", ["-0.01", "100.00"])
def test_rejects_down_payment_outside_allowed_range(bad_down_payment):
    serializer = FinanceQuoteRequestSerializer(
        data=_valid_payload(down_payment_percent=bad_down_payment)
    )

    assert not serializer.is_valid()
    assert "down_payment_percent" in serializer.errors


def test_rejects_unsupported_currency_with_a_stable_error_code():
    serializer = FinanceQuoteRequestSerializer(data=_valid_payload(currency="USD"))

    assert not serializer.is_valid()
    assert serializer.errors["currency"][0].code == "unsupported_currency"
