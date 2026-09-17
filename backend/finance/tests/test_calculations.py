from decimal import Decimal

import pytest

from finance.calculations import calculate_finance_quote


def test_matches_spec_worked_example_one():
    # Spec §17.1: price 459,000 / 20% down / 5% / 48 months.
    result = calculate_finance_quote(
        price=Decimal("459000.00"),
        down_payment_percent=Decimal("20.00"),
        annual_rate_percent=Decimal("5.00"),
        term_months=48,
    )

    assert result.down_payment_amount == Decimal("91800.00")
    assert result.principal == Decimal("367200.00")
    assert result.monthly_payment == Decimal("8456.36")
    assert result.total_payment == Decimal("405905.12")
    assert result.total_interest == Decimal("38705.12")


def test_matches_spec_worked_example_two():
    # Spec §17.1: price 248,000 / 20% down / 5% / 48 months.
    result = calculate_finance_quote(
        price=Decimal("248000.00"),
        down_payment_percent=Decimal("20.00"),
        annual_rate_percent=Decimal("5.00"),
        term_months=48,
    )

    assert result.down_payment_amount == Decimal("49600.00")
    assert result.principal == Decimal("198400.00")
    assert result.monthly_payment == Decimal("4569.01")
    assert result.total_payment == Decimal("219312.57")
    assert result.total_interest == Decimal("20912.57")


def test_zero_interest_splits_principal_evenly_across_the_term():
    result = calculate_finance_quote(
        price=Decimal("120000.00"),
        down_payment_percent=Decimal("0.00"),
        annual_rate_percent=Decimal("0.00"),
        term_months=12,
    )

    assert result.principal == Decimal("120000.00")
    assert result.monthly_payment == Decimal("10000.00")
    assert result.total_payment == Decimal("120000.00")
    assert result.total_interest == Decimal("0.00")


def test_minimum_term_boundary_of_one_month():
    result = calculate_finance_quote(
        price=Decimal("10000.00"),
        down_payment_percent=Decimal("0.00"),
        annual_rate_percent=Decimal("5.00"),
        term_months=1,
    )

    assert result.principal == Decimal("10000.00")
    assert result.monthly_payment == Decimal("10041.67")
    assert result.total_payment == Decimal("10041.67")
    assert result.total_interest == Decimal("41.67")


def test_maximum_term_rate_and_down_payment_boundaries_together():
    # term_months=360 (max), annual_rate_percent=100 (max), down_payment_percent=99.99 (max).
    result = calculate_finance_quote(
        price=Decimal("500000.00"),
        down_payment_percent=Decimal("99.99"),
        annual_rate_percent=Decimal("100.00"),
        term_months=360,
    )

    assert result.down_payment_amount == Decimal("499950.00")
    assert result.principal == Decimal("50.00")
    assert result.monthly_payment == Decimal("4.17")
    assert result.total_payment == Decimal("1500.00")
    assert result.total_interest == Decimal("1450.00")


@pytest.mark.parametrize("term_months", [1, 48, 360])
def test_total_payment_always_equals_monthly_payment_times_term_within_rounding(term_months):
    result = calculate_finance_quote(
        price=Decimal("300000.00"),
        down_payment_percent=Decimal("10.00"),
        annual_rate_percent=Decimal("7.50"),
        term_months=term_months,
    )

    # total_payment is derived from the *unrounded* monthly payment, so it can
    # differ from monthly_payment * term_months by at most a few cents once
    # each side has been independently rounded.
    naive_total = result.monthly_payment * term_months
    assert abs(result.total_payment - naive_total) < Decimal("1.00")
