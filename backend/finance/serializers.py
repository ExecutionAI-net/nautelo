from decimal import Decimal

from rest_framework import serializers

SUPPORTED_CURRENCIES = ("EUR",)


class FinanceQuoteRequestSerializer(serializers.Serializer):
    price = serializers.DecimalField(
        max_digits=11,
        decimal_places=2,
        min_value=Decimal("0.01"),
        max_value=Decimal("999999999.99"),
    )
    down_payment_percent = serializers.DecimalField(
        max_digits=7,
        decimal_places=4,
        min_value=Decimal("0"),
        max_value=Decimal("99.99"),
    )
    annual_rate_percent = serializers.DecimalField(
        max_digits=7,
        decimal_places=4,
        min_value=Decimal("0"),
        max_value=Decimal("100"),
    )
    term_months = serializers.IntegerField(min_value=1, max_value=360)
    currency = serializers.CharField(max_length=3)

    def validate_currency(self, value):
        normalized = value.upper()
        if normalized not in SUPPORTED_CURRENCIES:
            raise serializers.ValidationError(
                "Currency is not supported.", code="unsupported_currency"
            )
        return normalized
