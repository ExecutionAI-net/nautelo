from decimal import Decimal

import pytest
from django.core.management import CommandError, call_command

from brokers.models import BrokerPlan
from payments.gateway import ProductWithPrice
from payments.models import ListingPackage
from payments.tests.fakes import FakeStripeGateway
from professionals.models import ProfessionalPlan

pytestmark = pytest.mark.django_db

PRODUCTS = [
    ProductWithPrice("prod_boutique", "Boutique Broker", "price_boutique", 29900, "eur"),
    ProductWithPrice("prod_premier", "Premier Fleet", "price_premier", 89000, "eur"),
    ProductWithPrice("prod_sovereign", "Sovereign Agency", "price_sovereign", 185000, "eur"),
    ProductWithPrice("prod_professional", "Professional Membership", "price_professional", 4900, "eur"),
    ProductWithPrice("prod_1w", "Paid listing right 1week", "price_1w", 999, "eur"),
    ProductWithPrice("prod_2w", "Paid listing right 2 weeks", "price_2w", 1499, "eur"),
    ProductWithPrice("prod_1m", "Paid listing right 1 Month", "price_1m", 1999, "eur"),
]


@pytest.fixture(autouse=True)
def fake_gateway(monkeypatch):
    gateway = FakeStripeGateway(products=list(PRODUCTS))
    monkeypatch.setattr(
        "payments.management.commands.link_stripe_products.default_gateway", lambda: gateway
    )
    return gateway


def test_links_every_recognized_stripe_product_to_its_local_row():
    call_command("link_stripe_products")

    boutique = BrokerPlan.objects.get(slug="boutique-broker")
    assert boutique.monthly_price == 299
    assert boutique.stripe_product_id == "prod_boutique"
    assert boutique.stripe_price_id == "price_boutique"

    premier = BrokerPlan.objects.get(slug="premier-fleet")
    assert premier.monthly_price == 890
    sovereign = BrokerPlan.objects.get(slug="sovereign-agency")
    assert sovereign.monthly_price == 1850

    professional = ProfessionalPlan.objects.get(slug="professional-membership")
    assert professional.monthly_price == 49
    assert professional.is_active is True
    assert professional.stripe_price_id == "price_professional"

    week = ListingPackage.objects.get(slug="listing-1-week")
    assert week.publication_days == 7
    assert week.display_amount == Decimal("9.99")
    assert week.is_active is True
    two_weeks = ListingPackage.objects.get(slug="listing-2-weeks")
    assert two_weeks.publication_days == 14
    month = ListingPackage.objects.get(slug="listing-1-month")
    assert month.publication_days == 30
    assert month.display_amount == Decimal("19.99")

    # The old, never-priced monthly packages are untouched — still inactive.
    for slug in ("1-month", "2-months", "3-months"):
        assert ListingPackage.objects.get(slug=slug).is_active is False


def test_is_safe_to_run_twice_without_duplicating_rows():
    call_command("link_stripe_products")
    call_command("link_stripe_products")

    assert ListingPackage.objects.filter(slug="listing-1-week").count() == 1
    assert BrokerPlan.objects.filter(slug="boutique-broker").count() == 1


def test_dry_run_reports_without_writing_anything():
    before = BrokerPlan.objects.get(slug="boutique-broker").monthly_price

    call_command("link_stripe_products", dry_run=True)

    assert BrokerPlan.objects.get(slug="boutique-broker").monthly_price == before
    assert not ListingPackage.objects.filter(slug="listing-1-week").exists()


def test_a_missing_stripe_product_fails_loudly_and_writes_nothing(fake_gateway):
    fake_gateway.products = [p for p in PRODUCTS if p.product_name != "Sovereign Agency"]

    with pytest.raises(CommandError, match="Sovereign Agency"):
        call_command("link_stripe_products")

    assert BrokerPlan.objects.get(slug="boutique-broker").stripe_product_id == ""


def test_two_active_products_sharing_a_name_is_refused(fake_gateway):
    fake_gateway.products = [*PRODUCTS, ProductWithPrice("prod_dupe", "Sovereign Agency", "price_dupe", 1, "eur")]

    with pytest.raises(CommandError, match="Sovereign Agency"):
        call_command("link_stripe_products")


def test_a_tiered_price_with_no_flat_amount_is_refused(fake_gateway):
    fake_gateway.products = [
        p if p.product_name != "Boutique Broker" else ProductWithPrice("prod_boutique", "Boutique Broker", "price_boutique", None, "eur")
        for p in PRODUCTS
    ]

    with pytest.raises(CommandError, match="Boutique Broker"):
        call_command("link_stripe_products")
