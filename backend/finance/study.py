"""Server-side check of a simulator result attached to a financing study request."""

from decimal import Decimal, InvalidOperation

from .models import FinanceRule
from .simulator import simulate


def pick_rule(rules, *, country, product, condition, use):
    """The most specific active rule: an exact condition/use beats "any"."""
    best, best_score = None, -1
    for rule in rules:
        if rule.country_code != country or rule.product != product:
            continue
        if rule.condition not in (condition, "ANY") or rule.use not in (use, "ANY"):
            continue
        score = (2 if rule.condition == condition else 0) + (1 if rule.use == use else 0)
        if score > best_score:
            best, best_score = rule, score
    return best


def calculated_details(details: dict) -> dict:
    """Recompute the visitor's simulation from the rulebook. Empty when the inputs are incomplete or outside the rules."""
    try:
        price, down, years = Decimal(details["price"]), Decimal(details["down_percent"]), int(details["term_years"])
    except (KeyError, InvalidOperation, ValueError):
        return {}
    rule = pick_rule(
        FinanceRule.objects.filter(is_active=True),
        country=details.get("country", "ES"),
        product=details.get("product", "LOAN"),
        condition=details.get("condition", "NEW"),
        use=details.get("use", "PRIVATE"),
    )
    if rule is None or years not in rule.terms_years or not (rule.min_price <= price <= rule.max_price):
        return {}
    if not (rule.min_down_percent <= down <= rule.max_down_percent):
        return {}
    rule_dict = {
        "product": rule.product,
        "tin_percent": rule.tin_percent,
        "opening_fee_percent": rule.opening_fee_percent,
        "residual_percent": rule.residual_percent,
        "vat_percent": rule.vat_percent,
        "vat_on_installment": rule.vat_on_installment,
    }
    result = simulate(rule_dict, price=price, down_percent=down, term_years=years)
    return {"rule": rule.label, "tin_percent": str(rule.tin_percent), **{k: str(v) for k, v in result.items()}}
