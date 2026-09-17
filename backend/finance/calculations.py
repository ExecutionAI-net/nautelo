import decimal
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

TWO_PLACES = Decimal("0.01")
CALCULATION_PRECISION = 28


@dataclass(frozen=True)
class FinanceQuoteCalculation:
    down_payment_amount: Decimal
    principal: Decimal
    monthly_payment: Decimal
    total_payment: Decimal
    total_interest: Decimal


def _round_currency(value: Decimal) -> Decimal:
    return value.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def calculate_finance_quote(
    *,
    price: Decimal,
    down_payment_percent: Decimal,
    annual_rate_percent: Decimal,
    term_months: int,
) -> FinanceQuoteCalculation:
    """Standard fixed-rate, fully amortizing monthly payment calculation
    (spec §17.1). All intermediate arithmetic stays in `Decimal` at 28
    significant digits of precision; rounding to two decimals with
    ROUND_HALF_UP happens only once, per output field, at the very end.
    `total_payment` and `total_interest` are derived from the unrounded
    `monthly_payment`, not the rounded, displayed value.
    """
    with decimal.localcontext() as ctx:
        ctx.prec = CALCULATION_PRECISION

        down_payment_amount_exact = price * down_payment_percent / Decimal("100")
        principal_exact = price - down_payment_amount_exact
        monthly_rate = (annual_rate_percent / Decimal("100")) / Decimal("12")

        if monthly_rate == 0:
            monthly_payment_exact = principal_exact / Decimal(term_months)
        else:
            growth_factor = (Decimal("1") + monthly_rate) ** term_months
            monthly_payment_exact = (
                principal_exact
                * (monthly_rate * growth_factor)
                / (growth_factor - Decimal("1"))
            )

        total_payment_exact = monthly_payment_exact * Decimal(term_months)
        total_interest_exact = total_payment_exact - principal_exact

        return FinanceQuoteCalculation(
            down_payment_amount=_round_currency(down_payment_amount_exact),
            principal=_round_currency(principal_exact),
            monthly_payment=_round_currency(monthly_payment_exact),
            total_payment=_round_currency(total_payment_exact),
            total_interest=_round_currency(total_interest_exact),
        )
