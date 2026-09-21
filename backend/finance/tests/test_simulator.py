import json
from decimal import Decimal
from pathlib import Path

import pytest
from django.core.exceptions import ValidationError
from django.urls import reverse
from rest_framework.test import APIClient

from finance.models import FinanceRule
from finance.simulator import simulate

GOLDEN = Path(__file__).resolve().parents[3] / "frontend" / "src" / "lib" / "finance" / "golden.json"

pytestmark = pytest.mark.django_db


def test_customer_example_matches_the_design():
    """180,000 EUR, 20% down, 10 years at 6.5% is the example in the customer's mock-up: 1,635 EUR/month, 196,211 EUR in instalments."""
    rule = {"product": "LOAN", "tin_percent": 6.5}
    result = simulate(rule, price=180000, down_percent=20, term_years=10)
    assert result["financed"] == Decimal("144000.00")
    assert round(result["monthly"]) == 1635
    assert round(result["total_repaid"]) == 196211


def test_python_still_produces_the_shared_vectors_the_browser_is_checked_against():
    for case in json.loads(GOLDEN.read_text(encoding="utf8")):
        got = simulate(case["rule"], price=case["input"]["price"], down_percent=case["input"]["down_percent"], term_years=case["input"]["term_years"])
        assert {k: str(v) for k, v in got.items()} == case["expected"], case


def test_leasing_residual_lowers_the_instalment_and_vat_is_added_on_top():
    loan = {"product": "LOAN", "tin_percent": 6, "vat_on_installment": False}
    lease = {"product": "LEASING", "tin_percent": 6, "residual_percent": 10, "vat_percent": 21, "vat_on_installment": True}
    a = simulate(loan, price=100000, down_percent=20, term_years=5)
    b = simulate(lease, price=100000, down_percent=20, term_years=5)
    assert b["monthly"] < a["monthly"]
    assert b["monthly_with_vat"] == (b["monthly"] * Decimal("1.21")).quantize(Decimal("0.01"))


def test_the_config_endpoint_serves_the_seeded_rulebook():
    data = APIClient().get(reverse("finance-simulator-config")).json()
    combos = {(r["country_code"], r["product"]) for r in data["rules"]}
    assert combos == {("ES", "LOAN"), ("ES", "LEASING"), ("IT", "LOAN"), ("IT", "LEASING")}
    assert all(r["terms_years"] and r["note"]["en"] for r in data["rules"])
    FinanceRule.objects.update(is_active=False)
    assert APIClient().get(reverse("finance-simulator-config")).json()["rules"] == []


def test_a_rule_with_broken_limits_is_refused_in_the_admin():
    rule = FinanceRule.objects.first()
    rule.terms_years = ["five"]
    with pytest.raises(ValidationError):
        rule.clean()
    rule.terms_years = [5]
    rule.vat_on_installment, rule.vat_percent = True, None
    with pytest.raises(ValidationError):
        rule.clean()
