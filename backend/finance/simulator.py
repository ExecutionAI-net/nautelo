"""The financing simulator's arithmetic, in one small pure module.

The browser runs the same formulas (frontend/src/lib/finance/simulator.ts) so sliders answer instantly; both sides are
checked against the shared vectors in frontend/src/lib/finance/golden.json. The server recomputes when a visitor asks
for a study, so what is stored is never just what the browser claimed.
"""

import decimal
from decimal import ROUND_HALF_UP, Decimal

CENT = Decimal("0.01")
HUNDRED = Decimal("100")


def _cents(value: Decimal) -> Decimal:
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


def _annuity_factor(monthly_rate: Decimal, months: int) -> Decimal:
    """Payment per unit borrowed. A zero rate is a straight division."""
    if monthly_rate == 0:
        return Decimal(1) / Decimal(months)
    return monthly_rate / (Decimal(1) - (Decimal(1) + monthly_rate) ** -months)


def simulate(rule: dict, *, price, down_percent, term_years) -> dict:
    """Monthly payment and totals for one rule row (the dict shape served by the config endpoint)."""
    with decimal.localcontext() as ctx:
        ctx.prec = 28
        price, down_percent = Decimal(str(price)), Decimal(str(down_percent))
        months = int(term_years) * 12
        down = price * down_percent / HUNDRED
        financed = price - down
        monthly_rate = Decimal(str(rule["tin_percent"])) / HUNDRED / 12
        residual = price * Decimal(str(rule.get("residual_percent") or 0)) / HUNDRED if rule["product"] == "LEASING" else Decimal(0)
        # A leasing purchase option is paid at the end, so the instalments only have to repay what is left today.
        present_residual = residual / ((Decimal(1) + monthly_rate) ** months)
        monthly = (financed - present_residual) * _annuity_factor(monthly_rate, months)
        vat_rate = Decimal(str(rule["vat_percent"])) / HUNDRED if rule.get("vat_on_installment") and rule.get("vat_percent") is not None else Decimal(0)
        monthly_with_vat = monthly * (Decimal(1) + vat_rate)
        residual_with_vat = residual * (Decimal(1) + vat_rate)
        opening_fee = financed * Decimal(str(rule.get("opening_fee_percent") or 0)) / HUNDRED
        total_repaid = monthly_with_vat * months + residual_with_vat + opening_fee
        return {
            "down_payment": _cents(down),
            "financed": _cents(financed),
            "monthly": _cents(monthly),
            "monthly_with_vat": _cents(monthly_with_vat),
            "vat_per_month": _cents(monthly_with_vat - monthly),
            "residual": _cents(residual_with_vat),
            "opening_fee": _cents(opening_fee),
            "total_repaid": _cents(total_repaid),
            "cost_of_financing": _cents(total_repaid - financed),
        }
