from decimal import Decimal

from rest_framework import serializers
from rest_framework.exceptions import ErrorDetail

SUPPORTED_CURRENCIES = ("EUR",)

#: Spec §17.4 context 2 ("manual finance-page values"): with no listing to load
#: a price and settings from, the client must supply everything.
MANUAL_REQUIRED_FIELDS = (
    "price",
    "down_payment_percent",
    "annual_rate_percent",
    "term_months",
    "currency",
)


class FinanceQuoteRequestSerializer(serializers.Serializer):
    """Both spec §17.4 contexts in one body.

    Context 1 — `listing_id` present: the server loads price and currency from
    the listing's public snapshot and its effective assumptions (Phase 9). Every
    other field is optional; a supplied assumption is an exploration value
    (spec §36.1) and a supplied price must match the server's (§17.4).

    Context 2 — no `listing_id`: Phase 8's manual calculator, unchanged. All
    five fields are required, and they are required *here* rather than by
    `required=True` so that context 1 can legitimately omit them while the
    error codes context 2 produces stay exactly what they were (`required`).
    """

    listing_id = serializers.UUIDField(required=False)
    price = serializers.DecimalField(
        max_digits=11,
        decimal_places=2,
        min_value=Decimal("0.01"),
        max_value=Decimal("999999999.99"),
        required=False,
    )
    down_payment_percent = serializers.DecimalField(
        max_digits=7,
        decimal_places=4,
        min_value=Decimal("0"),
        max_value=Decimal("99.99"),
        required=False,
    )
    annual_rate_percent = serializers.DecimalField(
        max_digits=7,
        decimal_places=4,
        min_value=Decimal("0"),
        max_value=Decimal("100"),
        required=False,
    )
    term_months = serializers.IntegerField(min_value=1, max_value=360, required=False)
    currency = serializers.CharField(max_length=3, required=False)

    def validate_currency(self, value):
        normalized = value.upper()
        if normalized not in SUPPORTED_CURRENCIES:
            raise serializers.ValidationError(
                "Currency is not supported.", code="unsupported_currency"
            )
        return normalized

    def validate(self, attrs):
        if attrs.get("listing_id") is not None:
            return attrs
        missing = {
            field: [ErrorDetail("This field is required.", code="required")]
            for field in MANUAL_REQUIRED_FIELDS
            if field not in attrs
        }
        if missing:
            raise serializers.ValidationError(missing)
        return attrs
