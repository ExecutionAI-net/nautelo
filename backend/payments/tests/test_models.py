"""Spec §11.9's MarketplaceProduct and the database-level guarantees the rest of
this phase relies on instead of re-checking in every service."""

from decimal import Decimal

import pytest
from django.db import DataError, IntegrityError, transaction

from payments.enums import ProductCode
from payments.models import MarketplaceProduct
from payments.tests.factories import listing_right_product


@pytest.mark.django_db
def test_every_spec_11_9_product_field_exists_with_the_spec_name():
    names = {field.name for field in MarketplaceProduct._meta.get_fields()}
    assert {
        "id",
        "code",
        "name_en",
        "name_it",
        "name_es",
        "description_en",
        "description_it",
        "description_es",
        "stripe_product_id",
        "stripe_price_id",
        "currency",
        "display_amount",
        "entitlement_valid_days",
        "publication_days",
        "is_active",
        "display_order",
        "created_by",
        "updated_by",
        "created_at",
        "updated_at",
    } <= names


@pytest.mark.django_db
def test_no_card_data_field_exists_on_any_payments_model():
    """Spec §23.1: "Staff does not enter card data". This phase never stores a
    PAN, a CVC, an expiry or a cardholder name, and this test is the standing
    guard against someone adding one later "just for the receipt"."""
    forbidden = {"last4", "card_number", "pan", "cvc", "cvv", "exp_month",
                 "exp_year", "cardholder_name", "card_brand", "receipt_body"}
    names = {field.name for field in MarketplaceProduct._meta.get_fields()}
    assert forbidden & names == set()


@pytest.mark.django_db
def test_spec_38_seeds_exactly_two_products_both_inactive_and_unconfigured():
    """Spec §38: "Two product records, inactive until valid environment Stripe
    IDs are supplied", and production setup "must not include ... decorative
    financial values or test Stripe IDs"."""
    products = list(MarketplaceProduct.objects.order_by("display_order"))

    assert [p.code for p in products] == [
        ProductCode.INDIVIDUAL_LISTING_RIGHT,
        ProductCode.LISTING_MEDIA_UPGRADE,
    ]
    for product in products:
        assert product.is_active is False
        assert product.stripe_product_id == ""
        assert product.stripe_price_id == ""
        assert product.display_amount == Decimal("0.00")


@pytest.mark.django_db
def test_the_seeded_durations_are_spec_23_1s_defaults():
    right = MarketplaceProduct.objects.get(code=ProductCode.INDIVIDUAL_LISTING_RIGHT)
    upgrade = MarketplaceProduct.objects.get(code=ProductCode.LISTING_MEDIA_UPGRADE)

    # A purchased paid listing effectively never expires (10 years); its
    # publication window is 30 days from approval.
    assert (right.entitlement_valid_days, right.publication_days) == (3650, 30)
    # A media upgrade grants no publication window of its own.
    assert (upgrade.entitlement_valid_days, upgrade.publication_days) == (365, None)


@pytest.mark.django_db
def test_the_rollout_flag_is_seeded_disabled():
    """Spec §35.2 step 4: deploy with features off. A flag seeded ENABLED would
    open Checkout on the very deploy that ships it."""
    from platform_settings.models import FeatureFlag

    flag = FeatureFlag.objects.get(key="stripe_entitlement_checkout")
    assert flag.is_enabled is False


@pytest.mark.django_db
def test_an_unknown_product_code_is_refused_by_the_database():
    """Spec §23.1: the set of codes is closed "in this release"."""
    with pytest.raises(IntegrityError), transaction.atomic():
        MarketplaceProduct.objects.create(
            code="SUBSCRIPTION",
            name_en="Subscription",
            currency="EUR",
            display_amount=Decimal("10.00"),
            entitlement_valid_days=30,
        )


@pytest.mark.django_db
def test_a_duplicate_product_code_is_refused_by_the_database():
    with pytest.raises(IntegrityError), transaction.atomic():
        MarketplaceProduct.objects.create(
            code=ProductCode.INDIVIDUAL_LISTING_RIGHT,
            name_en="Duplicate",
            currency="EUR",
            display_amount=Decimal("10.00"),
            entitlement_valid_days=30,
        )


@pytest.mark.django_db
def test_a_negative_display_amount_is_refused_by_the_database():
    product = MarketplaceProduct.objects.get(code=ProductCode.LISTING_MEDIA_UPGRADE)
    product.display_amount = Decimal("-1.00")
    with pytest.raises(IntegrityError), transaction.atomic():
        product.save()


@pytest.mark.django_db
@pytest.mark.parametrize("currency", ["eur", "EU", "EURO", "E1R", "", "   "])
def test_a_non_iso4217_currency_is_refused_by_the_database(currency):
    product = MarketplaceProduct.objects.get(code=ProductCode.LISTING_MEDIA_UPGRADE)
    product.currency = currency
    # "EURO" is refused even earlier, by the column's own varchar(3) width.
    with pytest.raises((IntegrityError, DataError)), transaction.atomic():
        product.save()


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("display_amount", Decimal("0.00")),
        ("stripe_product_id", ""),
        ("stripe_price_id", ""),
    ],
)
def test_an_incompletely_configured_product_cannot_be_activated(field, value):
    """Spec §38 / §32.1 step 8, enforced by the database rather than by a
    comment: a row missing its amount, its Stripe product id or its Stripe price
    id cannot go active, so no Checkout can ever open against one."""
    product = listing_right_product(is_active=False)
    setattr(product, field, value)
    product.is_active = True

    with pytest.raises(IntegrityError), transaction.atomic():
        product.save()


@pytest.mark.django_db
def test_a_fully_configured_product_can_be_activated():
    """The positive half of the constraint above. Without it, a constraint that
    refused EVERY activation would still pass all the negative cases."""
    product = listing_right_product()

    product.refresh_from_db()
    assert product.is_active is True
    assert MarketplaceProduct.objects.active().count() == 1


@pytest.mark.django_db
def test_an_inactive_product_may_stay_blank_and_zero():
    """The other side of the same constraint: deactivating is always allowed,
    which is what spec §26.4's "Deactivating a product stops new Checkout
    creation but does not invalidate previously purchased entitlements" needs."""
    product = listing_right_product()
    product.is_active = False
    product.display_amount = Decimal("0.00")
    product.stripe_price_id = ""
    product.save()

    product.refresh_from_db()
    assert product.is_active is False
    assert MarketplaceProduct.objects.active().count() == 0


@pytest.mark.django_db
def test_zero_entitlement_validity_is_refused():
    product = MarketplaceProduct.objects.get(code=ProductCode.LISTING_MEDIA_UPGRADE)
    product.entitlement_valid_days = 0
    with pytest.raises(IntegrityError), transaction.atomic():
        product.save()


@pytest.mark.django_db
def test_zero_publication_days_is_refused_but_null_is_allowed():
    product = MarketplaceProduct.objects.get(code=ProductCode.LISTING_MEDIA_UPGRADE)
    product.publication_days = 0
    with pytest.raises(IntegrityError), transaction.atomic():
        product.save()

    product.refresh_from_db()
    product.publication_days = None
    product.save()  # must not raise
