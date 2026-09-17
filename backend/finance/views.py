from decimal import Decimal

from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .calculations import calculate_finance_quote
from .serializers import FinanceQuoteRequestSerializer

DISCLAIMER_KEY = "finance.illustrative_disclaimer"


def _error_code_from_serializer_errors(errors):
    currency_errors = errors.get("currency")
    if currency_errors:
        for detail in currency_errors:
            if getattr(detail, "code", None) == "unsupported_currency":
                return "unsupported_currency"
    return "validation_error"


class FinanceQuoteView(APIView):
    """Manual finance-quote calculation (spec §17.4, context 2 only).

    Listing-linked quotes (context 1: `listing_id`) are out of scope for this
    phase — see this plan's Task 7 ruling note.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = FinanceQuoteRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    "error": {
                        "code": _error_code_from_serializer_errors(serializer.errors),
                        "message": "One or more finance quote fields are invalid.",
                        "fields": serializer.errors,
                        "request_id": request.headers.get("X-Request-ID", ""),
                    }
                },
                status=400,
            )

        data = serializer.validated_data
        result = calculate_finance_quote(
            price=data["price"],
            down_payment_percent=data["down_payment_percent"],
            annual_rate_percent=data["annual_rate_percent"],
            term_months=data["term_months"],
        )

        return Response(
            {
                "currency": data["currency"],
                "price": str(data["price"].quantize(Decimal("0.01"))),
                "down_payment_amount": str(result.down_payment_amount),
                "principal": str(result.principal),
                "annual_rate_percent": str(data["annual_rate_percent"].quantize(Decimal("0.0001"))),
                "term_months": data["term_months"],
                "monthly_payment": str(result.monthly_payment),
                "total_payment": str(result.total_payment),
                "total_interest": str(result.total_interest),
                # This is a manual quote (client-supplied inputs only) — it
                # never reads the stored active configuration, so there is no
                # configuration version that actually produced these numbers.
                # Reporting the currently-active version here would misleadingly
                # imply a relationship that doesn't exist (see Task 7's ruling
                # note above).
                "configuration_version": None,
                "disclaimer_key": DISCLAIMER_KEY,
            },
            status=200,
        )
