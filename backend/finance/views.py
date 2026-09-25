from decimal import Decimal

from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from listings.views import published_listings_queryset

from .calculations import calculate_finance_quote
from .listing_quotes import (
    REQUESTED,
    FinancePolicy,
    FinanceQuoteService,
    format_percent,
    resolve_effective_assumptions,
)
from .serializers import FinanceQuoteRequestSerializer

DISCLAIMER_KEY = "finance.illustrative_disclaimer"


def _error_code_from_serializer_errors(errors):
    currency_errors = errors.get("currency")
    if currency_errors:
        for detail in currency_errors:
            if getattr(detail, "code", None) == "unsupported_currency":
                return "unsupported_currency"
    return "validation_error"


def _envelope(request, *, code, message, fields=None):
    return {
        "error": {
            "code": code,
            "message": message,
            "fields": fields or {},
            "request_id": request.headers.get("X-Request-ID", ""),
        }
    }


class FinanceQuoteView(APIView):
    """Spec §17.4's quote endpoint, both contexts.

    Context 1 (`listing_id`) is Phase 9's: the listing is the authority for
    price and currency, and spec §18.3 requires that a tampered query price
    cannot change the answer. Context 2 (explicit values) is Phase 8's manual
    calculator and is deliberately unchanged, including its null
    `configuration_version`.
    """

    permission_classes = [AllowAny]
    # Spec §30.4 asks for a user/IP-aware limit here while keeping "the
    # calculation itself reasonably accessible". The scope alone is enough:
    # Phase 3 installs common.throttling.HashedIPScopedRateThrottle as the
    # default class, which hashes the client IP before building the cache key.
    throttle_scope = "finance_quote"

    def post(self, request):
        serializer = FinanceQuoteRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                _envelope(
                    request,
                    code=_error_code_from_serializer_errors(serializer.errors),
                    message="One or more finance quote fields are invalid.",
                    fields=serializer.errors,
                ),
                status=400,
            )

        data = serializer.validated_data
        if data.get("listing_id") is not None:
            return self._listing_quote(request, data)
        return self._manual_quote(request, data)

    def _listing_quote(self, request, data):
        listing = (
            published_listings_queryset().filter(pk=data["listing_id"]).first()
        )
        if listing is None:
            return Response(
                _envelope(
                    request,
                    code="listing_not_found",
                    message="This listing is not available.",
                ),
                status=404,
            )

        policy = FinancePolicy.load()
        if not FinanceQuoteService.is_visible(listing, policy=policy):
            return Response(
                _envelope(
                    request,
                    code="finance_not_available_for_listing",
                    message="This listing does not show a financing estimate.",
                ),
                status=400,
            )

        snapshot = listing.current_public_snapshot
        if (
            data.get("price") is not None
            and data["price"] != snapshot.price
        ):
            return Response(
                _envelope(
                    request,
                    code="price_mismatch",
                    message="The price does not match this listing.",
                    fields={"price": ["The price does not match this listing."]},
                ),
                status=400,
            )

        assumptions = resolve_effective_assumptions(snapshot=snapshot, policy=policy)
        values = {
            "annual_rate_percent": assumptions.annual_rate_percent,
            "term_months": assumptions.term_months,
            "down_payment_percent": assumptions.down_payment_percent,
        }
        sources = dict(assumptions.sources)
        # Spec §36.1: the finance page may explore alternative values. Anything
        # the viewer supplied is reported as REQUESTED so a response can never
        # present a viewer's own input as a platform assumption (spec §17.2's
        # two sources are GLOBAL and LISTING_OVERRIDE).
        for field in values:
            if data.get(field) is not None:
                values[field] = data[field]
                sources[field] = REQUESTED

        return Response(
            self._quote_response(
                currency=snapshot.currency,
                price=snapshot.price,
                values=values,
                configuration_version=assumptions.configuration_version,
                sources=sources,
            ),
            status=200,
        )

    def _manual_quote(self, request, data):
        return Response(
            self._quote_response(
                currency=data["currency"],
                price=data["price"],
                values={
                    "annual_rate_percent": data["annual_rate_percent"],
                    "term_months": data["term_months"],
                    "down_payment_percent": data["down_payment_percent"],
                },
                # A manual quote reads no stored configuration, so naming one
                # would imply a relationship that does not exist (Phase 8's
                # Task 7 ruling, unchanged).
                configuration_version=None,
                sources=None,
            ),
            status=200,
        )

    @staticmethod
    def _quote_response(*, currency, price, values, configuration_version, sources):
        """One response shape for both of spec §17.4's contexts.

        `configuration_version` and `assumption_sources` are always present and
        are None on a manual quote, rather than being omitted there: two shapes
        behind one endpoint would force every client into a presence check and
        would need a second frontend type. Phase 8's
        test_finance_quote_endpoint_matches_spec_worked_example is widened by
        one key in this same commit because of this (see Task 5's ruling).
        """
        result = calculate_finance_quote(
            price=price,
            down_payment_percent=values["down_payment_percent"],
            annual_rate_percent=values["annual_rate_percent"],
            term_months=values["term_months"],
        )
        return {
            "currency": currency,
            "price": str(price.quantize(Decimal("0.01"))),
            "down_payment_amount": str(result.down_payment_amount),
            "principal": str(result.principal),
            "annual_rate_percent": format_percent(values["annual_rate_percent"]),
            "term_months": values["term_months"],
            "down_payment_percent": format_percent(values["down_payment_percent"]),
            "monthly_payment": str(result.monthly_payment),
            "total_payment": str(result.total_payment),
            "total_interest": str(result.total_interest),
            "configuration_version": configuration_version,
            "disclaimer_key": DISCLAIMER_KEY,
            "assumption_sources": sources,
        }


class SimulatorConfigView(APIView):
    """GET /api/v1/finance/simulator-config/ - the rulebook the browser runs the simulator on."""

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = "public_settings"

    def get(self, request):
        from .models import FinanceRule

        def num(value):
            return None if value is None else float(value)

        rules = [
            {
                "id": rule.pk,
                "country_code": rule.country_code,
                "product": rule.product,
                "condition": rule.condition,
                "use": rule.use,
                "tin_percent": num(rule.tin_percent),
                "tae_percent": num(rule.tae_percent),
                "opening_fee_percent": num(rule.opening_fee_percent),
                "residual_percent": num(rule.residual_percent),
                "min_price": num(rule.min_price),
                "max_price": num(rule.max_price),
                "min_down_percent": num(rule.min_down_percent),
                "max_down_percent": num(rule.max_down_percent),
                "default_down_percent": num(rule.default_down_percent),
                "terms_years": rule.terms_years,
                "max_age_at_end_years": rule.max_age_at_end_years,
                "age_plus_term_limit": rule.age_plus_term_limit,
                "vat_percent": num(rule.vat_percent),
                "vat_on_installment": rule.vat_on_installment,
                "vat_recoverable": rule.vat_recoverable,
                "representative_months": rule.representative_months,
                "note": {"en": rule.note_en, "it": rule.note_it, "es": rule.note_es},
            }
            for rule in FinanceRule.objects.filter(is_active=True)
        ]
        response = Response({"rules": rules})
        response["Cache-Control"] = "public, max-age=300"
        return response
