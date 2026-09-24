"""One way to print an amount for people: the staff console, notifications and emails
should all say "€245,000" and "€9.99", never "245000.00 EUR" in one place and
"€ 9.99" in another (stafftest S20). The public site formats on the client with the
visitor's locale; this is the server-side counterpart for English staff screens.
"""

from decimal import Decimal

SYMBOLS = {"EUR": "€", "USD": "$", "GBP": "£"}


def display_money(amount, currency: str) -> str:
    """"€245,000" for whole amounts, "€9.99" otherwise; "CHF 1,200" for currencies without a symbol."""
    if amount is None:
        return ""
    value = Decimal(str(amount))
    code = (currency or "").upper()
    number = f"{value:,.0f}" if value == value.to_integral_value() else f"{value:,.2f}"
    symbol = SYMBOLS.get(code)
    return f"{symbol}{number}" if symbol else f"{code} {number}".strip()
