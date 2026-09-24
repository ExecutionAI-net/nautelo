from decimal import Decimal

from common.money import display_money


def test_whole_amounts_drop_the_cents_and_fractions_keep_two():
    assert display_money(Decimal("245000.00"), "EUR") == "€245,000"
    assert display_money(Decimal("9.99"), "eur") == "€9.99"
    assert display_money("1850", "USD") == "$1,850"


def test_currencies_without_a_symbol_are_spelled_out_and_none_is_empty():
    assert display_money(Decimal("1200"), "CHF") == "CHF 1,200"
    assert display_money(None, "EUR") == ""
