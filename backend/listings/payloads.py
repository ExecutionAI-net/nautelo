"""Explicit schema for ListingRevision.payload (spec §11.4, §20.2, §20.3, §25.1).

Spec §11.4: "Only fields explicitly allowed by role are accepted in `payload`;
unknown fields return validation errors. For a private seller after first
publication, `brand_id`, `model_id`, `custom_model_name` and `manufacture_year`
are rejected with `immutable_after_publication`."
"""

import re
import uuid
from decimal import Decimal, InvalidOperation

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ErrorDetail, ValidationError

from accounts.enums import SellerType
from taxonomy.services import normalize_custom_model_name

from .enums import RevisionOrigin
from .models import (
    CUSTOM_MODEL_NAME_MAX_LENGTH,
    CUSTOM_MODEL_NAME_MIN_LENGTH,
    MIN_MANUFACTURE_YEAR,
    SUPPORTED_CURRENCIES,
    BoatListing,
)

SPECIFICATIONS_SCHEMA_VERSION = 1

MAX_TITLE_LENGTH = 200
MAX_DESCRIPTION_LENGTH = 20_000
MAX_SPECIFICATION_KEYS = 50
MAX_SPECIFICATION_STRING_LENGTH = 500
MAX_LOCATION_LENGTH = 120
# A structural ceiling on the *list*, not the per-listing allowance. The real
# allowance is staff-configurable and enforced against live media rows at submit
# time (listings.policies.effective_media_allowance + validate_submission_media),
# so this constant only has to be large enough never to contradict it: it is the
# largest allowance the platform_settings registry can ever hold
# (media.broker_image_limit max 50 + media.broker_video_limit max 3), which keeps
# a raised setting from being silently capped here.
MAX_MEDIA_IDS = 53
SPECIFICATION_KEY_RE = re.compile(r"^[a-z][a-z0-9_]{0,49}$")
COUNTRY_RE = re.compile(r"^[A-Z]{2}$")

TITLE_FIELDS = ("title_en", "title_it", "title_es")
DESCRIPTION_FIELDS = ("description_en", "description_it", "description_es")
CONTENT_FIELDS = frozenset(
    TITLE_FIELDS
    + DESCRIPTION_FIELDS
    + (
        "specifications",
        "location_country",
        "location_region",
        "location_city",
        "price",
        "currency",
        "media_ids",
    )
)
TAXONOMY_FIELDS = frozenset(
    {"brand_id", "model_id", "custom_model_name", "manufacture_year"}
)
BROKER_FINANCE_FIELDS = frozenset(
    {
        "show_finance_estimate",
        "finance_down_payment_override_percent",
        "finance_rate_override_percent",
        "finance_term_override_months",
    }
)
# The names spec §25.1 reports to the frontend as `immutable_fields`.
IMMUTABLE_FIELD_NAMES = ("brand", "model", "custom_model_name", "manufacture_year")
REQUIRED_FOR_SUBMISSION = (
    "title_en",
    "description_en",
    "location_country",
    "location_city",
    "price",
    "media_ids",
)


def _error(message, code):
    return [ErrorDetail(message, code=code)]


def is_locked_for_owner(listing: BoatListing) -> bool:
    """Spec §1/§11.4: individual immutable fields lock after first publication
    approval. The trigger is "has ever been published", so an expired or
    suspended listing stays locked."""
    return (
        listing.seller_type == SellerType.PRIVATE
        and listing.current_public_snapshot_id is not None
    )


def allowed_payload_fields(*, listing: BoatListing, origin: str) -> frozenset[str]:
    allowed = set(CONTENT_FIELDS)
    if listing.seller_type == SellerType.BROKER:
        allowed |= BROKER_FINANCE_FIELDS
    if origin == RevisionOrigin.STAFF_CORRECTION or not is_locked_for_owner(listing):
        allowed |= TAXONOMY_FIELDS
    return frozenset(allowed)


def _clean_text(errors, payload, field, max_length):
    value = payload[field]
    if not isinstance(value, str) or len(value) > max_length:
        errors[field] = _error(
            f"Provide text of at most {max_length} characters.", "invalid_text"
        )
        return None
    return value.strip()


def _clean_specifications(errors, value):
    if not isinstance(value, dict) or len(value) > MAX_SPECIFICATION_KEYS:
        errors["specifications"] = _error(
            "Provide a flat object of at most "
            f"{MAX_SPECIFICATION_KEYS} specification entries.",
            "invalid_specifications",
        )
        return None
    for key, item in value.items():
        bad_key = not isinstance(key, str) or not SPECIFICATION_KEY_RE.match(key)
        bad_value = not isinstance(item, (str, int, bool, type(None))) or (
            isinstance(item, str) and len(item) > MAX_SPECIFICATION_STRING_LENGTH
        )
        if bad_key or bad_value:
            errors["specifications"] = _error(
                "Specification keys must be lowercase identifiers and values must be "
                "text, whole numbers, booleans or null.",
                "invalid_specifications",
            )
            return None
    return dict(value)


def _clean_price(errors, value):
    if not isinstance(value, str):
        errors["price"] = _error(
            'Send the price as a decimal string, e.g. "125000.00".', "invalid_price"
        )
        return None
    try:
        amount = Decimal(value)
    except InvalidOperation:
        errors["price"] = _error("Enter a valid price.", "invalid_price")
        return None
    if amount <= 0 or amount.as_tuple().exponent < -2 or amount >= Decimal(10) ** 12:
        errors["price"] = _error(
            "Enter a positive price with at most two decimal places.", "invalid_price"
        )
        return None
    return f"{amount.quantize(Decimal('0.01')):f}"


def _clean_percent(errors, field, value):
    if not isinstance(value, str):
        errors[field] = _error(
            'Send the percentage as a decimal string, e.g. "4.7500".', "invalid_percent"
        )
        return None
    try:
        amount = Decimal(value)
    except InvalidOperation:
        errors[field] = _error("Enter a valid percentage.", "invalid_percent")
        return None
    if not (Decimal(0) <= amount <= Decimal(100)) or amount.as_tuple().exponent < -4:
        errors[field] = _error(
            "Enter a percentage between 0 and 100 with at most four decimal places.",
            "invalid_percent",
        )
        return None
    return f"{amount.quantize(Decimal('0.0001')):f}"


def _clean_media_ids(errors, value):
    if not isinstance(value, list) or len(value) > MAX_MEDIA_IDS:
        errors["media_ids"] = _error(
            f"Send at most {MAX_MEDIA_IDS} media identifiers.", "invalid_media_ids"
        )
        return None
    cleaned = []
    for item in value:
        try:
            cleaned.append(str(uuid.UUID(str(item))))
        except (ValueError, AttributeError, TypeError):
            errors["media_ids"] = _error(
                "Every media identifier must be a UUID.", "invalid_media_ids"
            )
            return None
    if len(set(cleaned)) != len(cleaned):
        errors["media_ids"] = _error(
            "Media identifiers must not repeat.", "invalid_media_ids"
        )
        return None
    return cleaned


def _reject_disallowed_fields(errors, payload, *, listing, allowed):
    for field in payload:
        if field in allowed:
            continue
        if field in TAXONOMY_FIELDS and is_locked_for_owner(listing):
            errors[field] = _error(
                "This field cannot be changed after the listing was first published.",
                "immutable_after_publication",
            )
        elif field in BROKER_FINANCE_FIELDS:
            errors[field] = _error(
                "Finance options are available to broker listings only.",
                "finance_not_allowed_for_private_seller",
            )
        else:
            errors[field] = _error("Unknown field.", "unknown_field")


def validate_revision_payload(
    payload: dict, *, listing: BoatListing, origin: str, for_submission: bool
) -> dict:
    if not isinstance(payload, dict):
        raise ValidationError(
            {"payload": _error("Send a JSON object.", "invalid_payload")}
        )

    allowed = allowed_payload_fields(listing=listing, origin=origin)
    errors: dict[str, list[ErrorDetail]] = {}
    cleaned: dict = {}

    _reject_disallowed_fields(errors, payload, listing=listing, allowed=allowed)

    def present(field):
        return field in payload and field in allowed

    for field in TITLE_FIELDS:
        if present(field):
            value = _clean_text(errors, payload, field, MAX_TITLE_LENGTH)
            if value is not None:
                cleaned[field] = value
    for field in DESCRIPTION_FIELDS:
        if present(field):
            value = _clean_text(errors, payload, field, MAX_DESCRIPTION_LENGTH)
            if value is not None:
                cleaned[field] = value
    for field in ("location_region", "location_city"):
        if present(field):
            value = _clean_text(errors, payload, field, MAX_LOCATION_LENGTH)
            if value is not None:
                cleaned[field] = value

    if present("location_country"):
        raw = payload["location_country"]
        candidate = raw.strip().upper() if isinstance(raw, str) else ""
        if COUNTRY_RE.match(candidate):
            cleaned["location_country"] = candidate
        else:
            errors["location_country"] = _error(
                "Enter a two-letter ISO-3166-1 country code.", "invalid_country"
            )

    if present("specifications"):
        value = _clean_specifications(errors, payload["specifications"])
        if value is not None:
            cleaned["specifications"] = value

    if present("price"):
        value = _clean_price(errors, payload["price"])
        if value is not None:
            cleaned["price"] = value

    if present("currency"):
        raw = payload["currency"]
        candidate = raw.strip().upper() if isinstance(raw, str) else ""
        if candidate in SUPPORTED_CURRENCIES:
            cleaned["currency"] = candidate
        else:
            errors["currency"] = _error(
                "This currency is not supported.", "unsupported_currency"
            )

    if present("media_ids"):
        value = _clean_media_ids(errors, payload["media_ids"])
        if value is not None:
            cleaned["media_ids"] = value

    for field in ("brand_id", "model_id"):
        if present(field):
            try:
                cleaned[field] = str(uuid.UUID(str(payload[field])))
            except (ValueError, AttributeError, TypeError):
                errors[field] = _error(
                    "Enter a valid identifier.", "invalid_identifier"
                )

    if present("custom_model_name"):
        raw = payload["custom_model_name"]
        if not isinstance(raw, str):
            errors["custom_model_name"] = _error(
                "Enter the model name.", "invalid_text"
            )
        elif raw.strip() == "":
            cleaned["custom_model_name"] = ""
        else:
            try:
                normalized = normalize_custom_model_name(raw)
            except DjangoValidationError as exc:
                errors["custom_model_name"] = _error(
                    "Enter the model name.",
                    getattr(exc, "code", None) or "invalid_text",
                )
            else:
                if (
                    CUSTOM_MODEL_NAME_MIN_LENGTH
                    <= len(normalized)
                    <= CUSTOM_MODEL_NAME_MAX_LENGTH
                ):
                    cleaned["custom_model_name"] = normalized
                else:
                    errors["custom_model_name"] = _error(
                        f"Enter between {CUSTOM_MODEL_NAME_MIN_LENGTH} and "
                        f"{CUSTOM_MODEL_NAME_MAX_LENGTH} characters.",
                        "invalid_text",
                    )

    if present("manufacture_year"):
        raw = payload["manufacture_year"]
        if (
            isinstance(raw, bool)
            or not isinstance(raw, int)
            or not (MIN_MANUFACTURE_YEAR <= raw <= BoatListing.max_manufacture_year())
        ):
            errors["manufacture_year"] = _error(
                f"Enter a year between {MIN_MANUFACTURE_YEAR} and "
                f"{BoatListing.max_manufacture_year()}.",
                "invalid_manufacture_year",
            )
        else:
            cleaned["manufacture_year"] = raw

    if present("show_finance_estimate"):
        raw = payload["show_finance_estimate"]
        if isinstance(raw, bool):
            cleaned["show_finance_estimate"] = raw
        else:
            errors["show_finance_estimate"] = _error(
                "Send true or false.", "invalid_boolean"
            )

    for field in (
        "finance_down_payment_override_percent",
        "finance_rate_override_percent",
    ):
        if present(field):
            value = _clean_percent(errors, field, payload[field])
            if value is not None:
                cleaned[field] = value

    if present("finance_term_override_months"):
        raw = payload["finance_term_override_months"]
        if isinstance(raw, bool) or not isinstance(raw, int) or not (1 <= raw <= 360):
            errors["finance_term_override_months"] = _error(
                "Enter a term between 1 and 360 months.", "invalid_term"
            )
        else:
            cleaned["finance_term_override_months"] = raw

    if for_submission:
        for field in REQUIRED_FOR_SUBMISSION:
            if field in errors:
                continue
            if cleaned.get(field) in (None, "", []):
                errors[field] = _error(
                    "This field is required before the listing can be submitted.",
                    "required_for_submission",
                )

    if errors:
        raise ValidationError(errors)
    return cleaned
