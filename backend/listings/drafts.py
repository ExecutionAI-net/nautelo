"""Draft creation and draft editing (spec §20.1 step 1, §20.2, §30.1)."""

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework.exceptions import ErrorDetail, ValidationError

from accounts.services import resolve_seller_context
from taxonomy.models import BoatBrand, BoatModel

from .enums import ListingStatus, RevisionOrigin, RevisionStatus
from .models import BoatListing, ListingRevision
from .payloads import validate_revision_payload

# `current_public_snapshot` is unset on a brand-new row and is never written from
# a payload, so it is excluded from every full_clean() call in this module.
FULL_CLEAN_EXCLUDED_FIELDS = ["current_public_snapshot"]


def open_revision_for(listing: BoatListing) -> ListingRevision | None:
    """The listing's single DRAFT-or-SUBMITTED revision, or None.

    Uniqueness is guaranteed by the `listings_revision_one_open_per_listing`
    database constraint (Task 4), so `.first()` cannot hide a second row.
    """
    return (
        ListingRevision.objects.filter(
            listing=listing,
            state__in=(RevisionStatus.DRAFT, RevisionStatus.SUBMITTED),
        )
        .order_by("-revision_number")
        .first()
    )


def raise_as_drf_validation_error(exc: DjangoValidationError) -> None:
    """Re-raise a model-layer ValidationError as DRF's, preserving field keys.

    `Model.full_clean()` is the only enforcement of the cross-table rules in
    `BoatListing.clean()` (spec §11.4's Other-model custom text rule in both
    directions, and the manufacture-year upper bound, which moves with the
    calendar). Those failures are the caller's fault, so they have to reach the
    client as spec §30.2's `validation_error` envelope with the offending field
    named — never as a 500 and never swallowed.
    """
    if hasattr(exc, "error_dict"):
        raise ValidationError(exc.message_dict)
    raise ValidationError({"non_field_errors": list(exc.messages)})


def _resolve_taxonomy(
    payload: dict, *, listing: BoatListing | None = None
) -> tuple[BoatBrand, BoatModel]:
    """Turn `brand_id` / `model_id` into real, active, brand-matching rows.

    A key the payload does not mention falls back to `listing`'s current value,
    so a PATCH that sends only `model_id` is still checked against the listing's
    existing brand, and a staff correction that sends only `brand_id` is refused
    unless the listing's existing model belongs to the new brand (spec §13.3's
    remap flow supplies both ids together).
    """
    errors: dict[str, list[ErrorDetail]] = {}

    if "brand_id" in payload:
        brand = BoatBrand.objects.filter(
            pk=payload["brand_id"], is_active=True
        ).first()
    else:
        brand = listing.brand if listing is not None and listing.brand_id else None
    if brand is None:
        errors["brand_id"] = [
            ErrorDetail("Select an active brand.", code="invalid_brand")
        ]

    model = None
    if brand is not None:
        model_id = (
            payload["model_id"]
            if "model_id" in payload
            else (listing.model_id if listing is not None else None)
        )
        model = BoatModel.objects.filter(
            pk=model_id, brand=brand, is_active=True
        ).first()
    if model is None:
        errors["model_id"] = [
            ErrorDetail(
                "Select an active model belonging to the chosen brand.",
                code="invalid_model",
            )
        ]
    if errors:
        raise ValidationError(errors)
    return brand, model


def _apply_payload_to_listing(listing: BoatListing, cleaned: dict) -> None:
    """Mirror the payload's BoatListing-backed fields onto the row's columns.

    The payload stays the source of truth for free-text content; these columns
    exist so the database constraints in spec §11.4, later phases' queries and —
    critically — the snapshot builder work. `listings.snapshots` reads
    `brand_name_snapshot` / `model_name_snapshot` / `custom_model_name_snapshot` /
    `manufacture_year_snapshot` off **these columns**, so any accepted change to
    the four taxonomy fields has to land here or an approval would publish a
    snapshot carrying the old values. That is why `brand_id` / `model_id` are
    resolved to real rows here rather than left as bare UUIDs in the payload:
    `validate_revision_payload` only checks that they *look* like identifiers.

    The resolve runs only when the payload actually touches taxonomy (or the row
    has no brand yet, i.e. a brand-new draft), so an ordinary price edit is never
    refused because someone deactivated the brand after publication.
    """
    if "brand_id" in cleaned or "model_id" in cleaned or listing.brand_id is None:
        listing.brand, listing.model = _resolve_taxonomy(cleaned, listing=listing)

    column_fields = (
        "custom_model_name",
        "manufacture_year",
        "price",
        "currency",
        "show_finance_estimate",
        "finance_down_payment_override_percent",
        "finance_rate_override_percent",
        "finance_term_override_months",
    )
    for field in column_fields:
        if field in cleaned:
            setattr(listing, field, cleaned[field])


@transaction.atomic
def create_listing_draft(*, actor, broker_id=None, payload: dict) -> BoatListing:
    context = resolve_seller_context(actor, broker_id=broker_id)

    listing = BoatListing(
        owner_user=context.owner_user,
        broker=context.broker,
        seller_type=context.seller_type,
        status=ListingStatus.DRAFT,
        created_by=actor,
        updated_by=actor,
    )

    cleaned = validate_revision_payload(
        payload, listing=listing, origin=RevisionOrigin.OWNER, for_submission=False
    )
    # The shell above carries no brand/model/year yet; this is the single place
    # that fills every BoatListing column from the validated payload. Because
    # `listing.brand_id is None` on a fresh row, the taxonomy resolve always runs
    # here, which is what makes `brand_id` and `model_id` *required* on create
    # (spec §11.4 declares all three columns NOT NULL).
    _apply_payload_to_listing(listing, cleaned)

    try:
        listing.full_clean(exclude=FULL_CLEAN_EXCLUDED_FIELDS)
    except DjangoValidationError as exc:
        raise_as_drf_validation_error(exc)
    listing.save()

    revision = ListingRevision.objects.create(
        listing=listing,
        revision_number=1,
        base_snapshot=None,
        state=RevisionStatus.DRAFT,
        origin=RevisionOrigin.OWNER,
        payload=cleaned,
    )
    listing.open_revision = revision
    return listing
