from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from accounts.enums import SellerType
from accounts.tests.factories import make_user
from brokers.tests.factories import make_broker
from listings.enums import ListingStatus
from listings.models import BoatListing
from listings.tests.factories import (
    make_brand,
    make_broker_listing,
    make_model,
    make_private_listing,
    other_model_for,
)


@pytest.mark.django_db
def test_a_new_listing_starts_as_a_draft_at_version_one():
    listing = make_private_listing(owner=make_user())

    assert listing.status == ListingStatus.DRAFT
    assert listing.version == 1
    assert listing.published_at is None
    assert listing.expires_at is None
    assert listing.view_count_cached == 0
    assert listing.publication_source == ""
    assert listing.consumed_entitlement_id is None


@pytest.mark.django_db
def test_private_listing_without_owner_is_rejected_by_the_database():
    brand = make_brand()
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            BoatListing.objects.create(
                owner_user=None,
                broker=None,
                seller_type=SellerType.PRIVATE,
                brand=brand,
                model=make_model(brand),
                manufacture_year=2020,
            )


@pytest.mark.django_db
def test_private_listing_with_a_broker_is_rejected_by_the_database():
    owner = make_user()
    broker = make_broker()
    brand = make_brand()
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            BoatListing.objects.create(
                owner_user=owner,
                broker=broker,
                seller_type=SellerType.PRIVATE,
                brand=brand,
                model=make_model(brand),
                manufacture_year=2020,
            )


@pytest.mark.django_db
def test_broker_listing_without_a_broker_is_rejected_by_the_database():
    brand = make_brand()
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            BoatListing.objects.create(
                owner_user=None,
                broker=None,
                seller_type=SellerType.BROKER,
                brand=brand,
                model=make_model(brand),
                manufacture_year=2020,
            )


@pytest.mark.django_db
def test_broker_listing_carrying_an_owner_user_is_rejected_by_the_database():
    brand = make_brand()
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            BoatListing.objects.create(
                owner_user=make_user(),
                broker=make_broker(),
                seller_type=SellerType.BROKER,
                brand=brand,
                model=make_model(brand),
                manufacture_year=2020,
            )


@pytest.mark.django_db
def test_private_listing_cannot_enable_the_finance_estimate_flag():
    owner = make_user()
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            make_private_listing(owner=owner, show_finance_estimate=True)


@pytest.mark.django_db
def test_broker_listing_may_enable_the_finance_estimate_flag():
    broker = make_broker()
    actor = make_user()
    listing = make_broker_listing(broker=broker, actor=actor, show_finance_estimate=True)

    assert listing.show_finance_estimate is True


@pytest.mark.django_db
def test_manufacture_year_before_1900_is_rejected_by_the_database():
    owner = make_user()
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            make_private_listing(owner=owner, manufacture_year=1899)


@pytest.mark.django_db
def test_negative_or_zero_price_is_rejected_by_the_database():
    owner = make_user()
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            make_private_listing(owner=owner, price=Decimal("0.00"))


@pytest.mark.django_db
def test_a_draft_may_have_no_price_yet():
    listing = make_private_listing(owner=make_user(), price=None)

    assert listing.price is None


@pytest.mark.django_db
def test_finance_down_payment_override_of_100_percent_is_rejected_by_the_database():
    broker = make_broker()
    actor = make_user()
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            make_broker_listing(
                broker=broker,
                actor=actor,
                show_finance_estimate=True,
                finance_down_payment_override_percent=Decimal("100"),
            )


@pytest.mark.django_db
def test_finance_down_payment_override_of_99_99_percent_is_accepted_by_the_database():
    broker = make_broker()
    actor = make_user()
    listing = make_broker_listing(
        broker=broker,
        actor=actor,
        show_finance_estimate=True,
        finance_down_payment_override_percent=Decimal("99.99"),
    )

    assert listing.finance_down_payment_override_percent == Decimal("99.99")


@pytest.mark.django_db
def test_finance_rate_override_of_100_percent_is_still_accepted_by_the_database():
    # Regression guard: unlike the down-payment override, the rate override's
    # database ceiling stays at 100%.
    broker = make_broker()
    actor = make_user()
    listing = make_broker_listing(
        broker=broker,
        actor=actor,
        show_finance_estimate=True,
        finance_rate_override_percent=Decimal("100"),
    )

    assert listing.finance_rate_override_percent == Decimal("100")


@pytest.mark.django_db
def test_custom_model_name_shorter_than_two_characters_is_rejected_by_the_database():
    owner = make_user()
    brand = make_brand()
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            make_private_listing(
                owner=owner,
                brand=brand,
                model=other_model_for(brand),
                custom_model_name="M",
            )


@pytest.mark.django_db
def test_clean_rejects_custom_model_name_on_an_ordinary_model():
    owner = make_user()
    brand = make_brand()
    listing = make_private_listing(owner=owner, brand=brand, model=make_model(brand))
    listing.custom_model_name = "McKenzie"

    with pytest.raises(ValidationError) as exc_info:
        listing.clean()

    assert "custom_model_name" in exc_info.value.message_dict


@pytest.mark.django_db
def test_clean_requires_custom_model_name_on_the_other_placeholder():
    owner = make_user()
    brand = make_brand()
    listing = make_private_listing(
        owner=owner, brand=brand, model=other_model_for(brand), custom_model_name="McKenzie"
    )
    listing.custom_model_name = ""

    with pytest.raises(ValidationError) as exc_info:
        listing.clean()

    assert "custom_model_name" in exc_info.value.message_dict


@pytest.mark.django_db
def test_clean_rejects_a_manufacture_year_beyond_next_year():
    owner = make_user()
    listing = make_private_listing(owner=owner)
    listing.manufacture_year = timezone.now().year + 2

    with pytest.raises(ValidationError) as exc_info:
        listing.clean()

    assert "manufacture_year" in exc_info.value.message_dict


@pytest.mark.django_db
def test_clean_accepts_next_year_as_a_manufacture_year():
    owner = make_user()
    listing = make_private_listing(owner=owner)
    listing.manufacture_year = BoatListing.max_manufacture_year()

    listing.clean()  # must not raise


@pytest.mark.django_db
def test_clean_rejects_an_unsupported_currency():
    listing = make_private_listing(owner=make_user())
    listing.currency = "USD"

    with pytest.raises(ValidationError) as exc_info:
        listing.clean()

    assert "currency" in exc_info.value.message_dict
