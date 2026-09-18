import uuid
from decimal import Decimal

import pytest
from rest_framework.exceptions import ValidationError

from accounts.tests.factories import make_user
from brokers.tests.factories import make_broker
from listings.enums import RevisionOrigin
from listings.models import BoatListing
from listings.payloads import (
    SPECIFICATIONS_SCHEMA_VERSION,
    allowed_payload_fields,
    validate_revision_payload,
)
from listings.tests.factories import (
    make_brand,
    make_broker_listing,
    make_private_listing,
    make_snapshot,
    other_model_for,
)

# accounts.tests.factories.make_user() has a fixed default email, so a test that
# needs two users must name them both explicitly or hit a real IntegrityError.
OWNER_EMAIL = "owner@example.com"
MODERATOR_EMAIL = "moderator@example.com"


def _codes(exc_info, field):
    return [detail.code for detail in exc_info.value.detail[field]]


def _publish(listing):
    listing.current_public_snapshot = make_snapshot(
        listing, approved_by=make_user(email=MODERATOR_EMAIL)
    )
    listing.save(update_fields=["current_public_snapshot"])
    return listing


def _minimal_payload(**overrides):
    payload = {
        "title_en": "Oceanis 46.1, one owner",
        "description_en": "Lovingly maintained, full service history.",
        "specifications": {"length_m": "14.6", "cabins": 3, "has_generator": True},
        "location_country": "it",
        "location_city": "Genoa",
        "price": "125000.00",
        "currency": "EUR",
        "media_ids": [str(uuid.uuid4())],
    }
    payload.update(overrides)
    return payload


@pytest.mark.django_db
def test_an_unknown_field_is_rejected_with_a_stable_code():
    listing = make_private_listing(owner=make_user(email=OWNER_EMAIL))

    with pytest.raises(ValidationError) as exc_info:
        validate_revision_payload(
            {"sparkle_level": 11},
            listing=listing,
            origin=RevisionOrigin.OWNER,
            for_submission=False,
        )

    assert _codes(exc_info, "sparkle_level") == ["unknown_field"]


@pytest.mark.django_db
def test_taxonomy_fields_are_allowed_before_first_publication():
    listing = make_private_listing(owner=make_user(email=OWNER_EMAIL))

    cleaned = validate_revision_payload(
        {"manufacture_year": 2019},
        listing=listing,
        origin=RevisionOrigin.OWNER,
        for_submission=False,
    )

    assert cleaned["manufacture_year"] == 2019


@pytest.mark.django_db
def test_taxonomy_fields_are_immutable_for_a_private_seller_after_publication():
    listing = _publish(make_private_listing(owner=make_user(email=OWNER_EMAIL)))

    with pytest.raises(ValidationError) as exc_info:
        validate_revision_payload(
            {
                "brand_id": str(uuid.uuid4()),
                "model_id": str(uuid.uuid4()),
                "custom_model_name": "McKenzie",
                "manufacture_year": 2018,
            },
            listing=listing,
            origin=RevisionOrigin.OWNER,
            for_submission=False,
        )

    for field in ("brand_id", "model_id", "custom_model_name", "manufacture_year"):
        assert _codes(exc_info, field) == ["immutable_after_publication"]


@pytest.mark.django_db
def test_a_staff_correction_may_change_immutable_fields_after_publication():
    listing = _publish(make_private_listing(owner=make_user(email=OWNER_EMAIL)))

    cleaned = validate_revision_payload(
        {"manufacture_year": 2018},
        listing=listing,
        origin=RevisionOrigin.STAFF_CORRECTION,
        for_submission=False,
    )

    assert cleaned["manufacture_year"] == 2018


@pytest.mark.django_db
def test_a_broker_may_change_taxonomy_after_publication():
    listing = _publish(
        make_broker_listing(broker=make_broker(), actor=make_user(email=OWNER_EMAIL))
    )

    cleaned = validate_revision_payload(
        {"manufacture_year": 2018},
        listing=listing,
        origin=RevisionOrigin.OWNER,
        for_submission=False,
    )

    assert cleaned["manufacture_year"] == 2018


@pytest.mark.django_db
def test_a_private_seller_cannot_send_finance_fields():
    listing = make_private_listing(owner=make_user(email=OWNER_EMAIL))

    with pytest.raises(ValidationError) as exc_info:
        validate_revision_payload(
            {"show_finance_estimate": True},
            listing=listing,
            origin=RevisionOrigin.OWNER,
            for_submission=False,
        )

    assert _codes(exc_info, "show_finance_estimate") == [
        "finance_not_allowed_for_private_seller"
    ]


@pytest.mark.django_db
def test_a_broker_may_send_finance_fields():
    listing = make_broker_listing(
        broker=make_broker(), actor=make_user(email=OWNER_EMAIL)
    )

    cleaned = validate_revision_payload(
        {
            "show_finance_estimate": True,
            "finance_rate_override_percent": "4.75",
            "finance_term_override_months": 60,
        },
        listing=listing,
        origin=RevisionOrigin.OWNER,
        for_submission=False,
    )

    assert cleaned["show_finance_estimate"] is True
    assert cleaned["finance_rate_override_percent"] == "4.7500"
    assert cleaned["finance_term_override_months"] == 60


@pytest.mark.django_db
def test_a_finance_down_payment_override_of_100_percent_is_rejected():
    listing = make_broker_listing(
        broker=make_broker(), actor=make_user(email=OWNER_EMAIL)
    )

    with pytest.raises(ValidationError) as exc_info:
        validate_revision_payload(
            {
                "show_finance_estimate": True,
                "finance_down_payment_override_percent": "100",
            },
            listing=listing,
            origin=RevisionOrigin.OWNER,
            for_submission=False,
        )

    assert _codes(exc_info, "finance_down_payment_override_percent") == [
        "invalid_percent"
    ]


@pytest.mark.django_db
def test_a_finance_down_payment_override_of_99_99_percent_is_accepted():
    listing = make_broker_listing(
        broker=make_broker(), actor=make_user(email=OWNER_EMAIL)
    )

    cleaned = validate_revision_payload(
        {
            "show_finance_estimate": True,
            "finance_down_payment_override_percent": "99.99",
        },
        listing=listing,
        origin=RevisionOrigin.OWNER,
        for_submission=False,
    )

    assert cleaned["finance_down_payment_override_percent"] == "99.9900"


@pytest.mark.django_db
def test_a_finance_rate_override_of_100_percent_is_still_accepted():
    # Regression guard: only the down-payment override's ceiling is 99.99%.
    # The rate override must keep allowing up to 100%.
    listing = make_broker_listing(
        broker=make_broker(), actor=make_user(email=OWNER_EMAIL)
    )

    cleaned = validate_revision_payload(
        {
            "show_finance_estimate": True,
            "finance_rate_override_percent": "100",
        },
        listing=listing,
        origin=RevisionOrigin.OWNER,
        for_submission=False,
    )

    assert cleaned["finance_rate_override_percent"] == "100.0000"


@pytest.mark.django_db
def test_allowed_fields_drops_the_locked_names_for_a_published_private_listing():
    listing = _publish(make_private_listing(owner=make_user(email=OWNER_EMAIL)))

    allowed = allowed_payload_fields(listing=listing, origin=RevisionOrigin.OWNER)

    assert "price" in allowed
    assert "brand_id" not in allowed
    assert "manufacture_year" not in allowed


@pytest.mark.django_db
def test_price_must_be_a_positive_decimal_string():
    listing = make_private_listing(owner=make_user(email=OWNER_EMAIL))

    with pytest.raises(ValidationError) as exc_info:
        validate_revision_payload(
            {"price": "-1.00"}, listing=listing,
            origin=RevisionOrigin.OWNER, for_submission=False,
        )
    assert _codes(exc_info, "price") == ["invalid_price"]

    with pytest.raises(ValidationError) as exc_info:
        validate_revision_payload(
            {"price": 125000}, listing=listing,
            origin=RevisionOrigin.OWNER, for_submission=False,
        )
    assert _codes(exc_info, "price") == ["invalid_price"]


@pytest.mark.django_db
def test_price_is_normalized_to_two_decimals():
    listing = make_private_listing(owner=make_user(email=OWNER_EMAIL))

    cleaned = validate_revision_payload(
        {"price": "125000"}, listing=listing,
        origin=RevisionOrigin.OWNER, for_submission=False,
    )

    assert cleaned["price"] == "125000.00"
    assert Decimal(cleaned["price"]) == Decimal("125000.00")


@pytest.mark.django_db
def test_an_unsupported_currency_is_rejected():
    listing = make_private_listing(owner=make_user(email=OWNER_EMAIL))

    with pytest.raises(ValidationError) as exc_info:
        validate_revision_payload(
            {"currency": "USD"}, listing=listing,
            origin=RevisionOrigin.OWNER, for_submission=False,
        )

    assert _codes(exc_info, "currency") == ["unsupported_currency"]


@pytest.mark.django_db
def test_specifications_reject_nested_structures_and_bad_keys():
    listing = make_private_listing(owner=make_user(email=OWNER_EMAIL))

    with pytest.raises(ValidationError) as exc_info:
        validate_revision_payload(
            {"specifications": {"engine": {"make": "Yanmar"}}}, listing=listing,
            origin=RevisionOrigin.OWNER, for_submission=False,
        )
    assert _codes(exc_info, "specifications") == ["invalid_specifications"]

    with pytest.raises(ValidationError) as exc_info:
        validate_revision_payload(
            {"specifications": {"Engine Make": "Yanmar"}}, listing=listing,
            origin=RevisionOrigin.OWNER, for_submission=False,
        )
    assert _codes(exc_info, "specifications") == ["invalid_specifications"]


@pytest.mark.django_db
def test_location_country_is_normalized_to_upper_case_and_validated():
    listing = make_private_listing(owner=make_user(email=OWNER_EMAIL))

    cleaned = validate_revision_payload(
        {"location_country": "it"}, listing=listing,
        origin=RevisionOrigin.OWNER, for_submission=False,
    )
    assert cleaned["location_country"] == "IT"

    with pytest.raises(ValidationError) as exc_info:
        validate_revision_payload(
            {"location_country": "ITA"}, listing=listing,
            origin=RevisionOrigin.OWNER, for_submission=False,
        )
    assert _codes(exc_info, "location_country") == ["invalid_country"]


@pytest.mark.django_db
def test_custom_model_name_is_collapsed_and_punctuation_only_is_rejected():
    brand = make_brand()
    listing = make_private_listing(
        owner=make_user(email=OWNER_EMAIL),
        brand=brand,
        model=other_model_for(brand),
        custom_model_name="McKenzie",
    )

    cleaned = validate_revision_payload(
        {"custom_model_name": "  Mc   Kenzie  "}, listing=listing,
        origin=RevisionOrigin.OWNER, for_submission=False,
    )
    assert cleaned["custom_model_name"] == "Mc Kenzie"

    with pytest.raises(ValidationError) as exc_info:
        validate_revision_payload(
            {"custom_model_name": "---"}, listing=listing,
            origin=RevisionOrigin.OWNER, for_submission=False,
        )
    assert _codes(exc_info, "custom_model_name") == [
        "custom_model_name_punctuation_only"
    ]


@pytest.mark.django_db
def test_manufacture_year_bounds_are_enforced():
    listing = make_private_listing(owner=make_user(email=OWNER_EMAIL))

    with pytest.raises(ValidationError) as exc_info:
        validate_revision_payload(
            {"manufacture_year": 1899}, listing=listing,
            origin=RevisionOrigin.OWNER, for_submission=False,
        )
    assert _codes(exc_info, "manufacture_year") == ["invalid_manufacture_year"]

    with pytest.raises(ValidationError) as exc_info:
        validate_revision_payload(
            {"manufacture_year": BoatListing.max_manufacture_year() + 1},
            listing=listing, origin=RevisionOrigin.OWNER, for_submission=False,
        )
    assert _codes(exc_info, "manufacture_year") == ["invalid_manufacture_year"]


@pytest.mark.django_db
def test_media_ids_must_be_unique_uuid_strings():
    listing = make_private_listing(owner=make_user(email=OWNER_EMAIL))
    duplicate = str(uuid.uuid4())

    with pytest.raises(ValidationError) as exc_info:
        validate_revision_payload(
            {"media_ids": [duplicate, duplicate]}, listing=listing,
            origin=RevisionOrigin.OWNER, for_submission=False,
        )
    assert _codes(exc_info, "media_ids") == ["invalid_media_ids"]

    with pytest.raises(ValidationError) as exc_info:
        validate_revision_payload(
            {"media_ids": ["not-a-uuid"]}, listing=listing,
            origin=RevisionOrigin.OWNER, for_submission=False,
        )
    assert _codes(exc_info, "media_ids") == ["invalid_media_ids"]


@pytest.mark.django_db
def test_submission_requires_the_publishable_minimum():
    listing = make_private_listing(owner=make_user(email=OWNER_EMAIL))

    with pytest.raises(ValidationError) as exc_info:
        validate_revision_payload(
            {"title_en": "Only a title"}, listing=listing,
            origin=RevisionOrigin.OWNER, for_submission=True,
        )

    for field in (
        "description_en", "location_country", "location_city", "price", "media_ids",
    ):
        assert _codes(exc_info, field) == ["required_for_submission"]


@pytest.mark.django_db
def test_a_complete_payload_passes_submission_validation():
    listing = make_private_listing(owner=make_user(email=OWNER_EMAIL))

    cleaned = validate_revision_payload(
        _minimal_payload(), listing=listing,
        origin=RevisionOrigin.OWNER, for_submission=True,
    )

    assert cleaned["title_en"] == "Oceanis 46.1, one owner"
    assert cleaned["location_country"] == "IT"
    assert SPECIFICATIONS_SCHEMA_VERSION == 1
