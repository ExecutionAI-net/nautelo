"""Free market-value estimate from comparable published listings.

No model, no guesswork: the estimate is the spread of asking prices of live
listings of the same type, similar length and similar age. The confidence label
says how many comparables it rests on, and asking prices run a little above
selling prices, so the result is a guide and never an appraisal.
"""

from decimal import Decimal
from statistics import median

from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .form_options import BOAT_TYPES
from .public_filters import SNAP, apply_public_filters

YEAR_WINDOW = 6
LENGTH_WINDOW = Decimal("0.15")
MIN_COMPARABLES = 3


class ValuationInputSerializer(serializers.Serializer):
    boat_type = serializers.ChoiceField(choices=BOAT_TYPES)
    length_m = serializers.DecimalField(max_digits=5, decimal_places=2, min_value=Decimal("2"), max_value=Decimal("120"))
    year = serializers.IntegerField(min_value=1950, max_value=2100)
    country = serializers.RegexField(r"^[A-Za-z]{2}$", required=False, allow_blank=True)


def confidence_for(count: int) -> str:
    if count >= 15:
        return "high"
    if count >= 6:
        return "medium"
    return "low"


def _length_of(specs) -> Decimal | None:
    for key in ("loa_m", "length_m"):
        try:
            return Decimal(str((specs or {})[key]))
        except (KeyError, ArithmeticError, ValueError):
            continue
    return None


def estimate(*, boat_type: str, length_m: Decimal, year: int, country: str = "") -> dict:
    from .views import published_listings_queryset

    params = {
        "boat_type": boat_type,
        "year_min": str(year - YEAR_WINDOW),
        "year_max": str(year + YEAR_WINDOW),
    }
    rows = apply_public_filters(published_listings_queryset(), params).filter(**{f"{SNAP}currency": "EUR"})
    low_len, high_len = length_m * (1 - LENGTH_WINDOW), length_m * (1 + LENGTH_WINDOW)
    prices = []
    # Length is read in Python because listings carry it as `loa_m` (text) or `length_m` (number).
    for price, specs in rows.values_list(f"{SNAP}price", f"{SNAP}specifications")[:2000]:
        length = _length_of(specs)
        if price and length is not None and low_len <= length <= high_len:
            prices.append(Decimal(price))
    prices.sort()
    if len(prices) < MIN_COMPARABLES:
        return {"available": False, "comparables": len(prices)}
    low = prices[len(prices) // 4]
    high = prices[(len(prices) * 3) // 4]
    return {
        "available": True,
        "currency": "EUR",
        "comparables": len(prices),
        "confidence": confidence_for(len(prices)),
        "low": int(low),
        "mid": int(median(prices)),
        "high": int(high),
    }


class ValuationView(APIView):
    """POST /api/v1/valuation/ - public, throttled."""

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = "public_listing_read"

    def post(self, request):
        data = ValuationInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        return Response(estimate(**data.validated_data))
