"""Draft creation and draft editing (spec §20.1 step 1, §20.2, §30.1)."""

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import status
from rest_framework.exceptions import APIException, ErrorDetail, ValidationError

from accounts.enums import SellerType
from accounts.services import resolve_seller_context
from entitlements.consumption import ensure_can_start_listing
from taxonomy.models import BoatBrand, BoatModel

from .enums import ListingStatus, RevisionOrigin, RevisionStatus
from .locking import bump_version
from .models import BoatListing, ListingRevision
from .payloads import (
    TAXONOMY_FIELDS,
    allowed_payload_fields,
    validate_revision_payload,
)

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

    # Spec §22.4: an individual seller with no listing right cannot even open a
    # draft. Broker quota is unlimited (spec §1). Advisory only: consumption
    # happens at submission, under a lock (spec §6.3).
    if context.seller_type == SellerType.PRIVATE:
        ensure_can_start_listing(context.owner_user)

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


class InvalidWorkflowState(APIException):
    """A well-formed request against a record in the wrong state (spec §26.2's
    "return conflict and refresh")."""

    status_code = status.HTTP_409_CONFLICT
    default_detail = "This listing is not in a state that allows the requested change."
    default_code = "invalid_revision_state"

    def __init__(self, detail=None, code=None):
        super().__init__(detail=detail, code=code or self.default_code)


def payload_from_snapshot(snapshot) -> dict:
    """Seed a new revision with the live public content it is proposing to change.

    A revision is a complete proposed document, not a sparse patch: approving a
    price-only edit must not publish a snapshot with no title (spec §20.2, and
    spec §26.2's before/after diff presupposes a whole document).
    """
    if snapshot is None:
        return {}
    payload = {
        "title_en": snapshot.title_en,
        "title_it": snapshot.title_it,
        "title_es": snapshot.title_es,
        "description_en": snapshot.description_en,
        "description_it": snapshot.description_it,
        "description_es": snapshot.description_es,
        "specifications": snapshot.specifications,
        "location_country": snapshot.location_country,
        "location_region": snapshot.location_region,
        "location_city": snapshot.location_city,
        "currency": snapshot.currency,
        "price": f"{snapshot.price:f}",
        "media_ids": [entry["media_id"] for entry in snapshot.media_manifest],
    }
    return {key: value for key, value in payload.items() if value not in ("", None)}


@transaction.atomic
def update_listing_draft(
    *, listing: BoatListing, actor, expected_version: int, payload: dict
) -> ListingRevision:
    listing = BoatListing.objects.select_for_update().get(pk=listing.pk)
    revision = open_revision_for(listing)

    if revision is not None and revision.state == RevisionStatus.SUBMITTED:
        raise InvalidWorkflowState(
            "Withdraw the submitted revision before editing it again.",
            code="invalid_revision_state",
        )

    if revision is None:
        # Opening a new edit cycle. Only the three states that are actually part
        # of the owner's edit loop may do so: DRAFT and REJECTED return to DRAFT,
        # and PUBLISHED opens a post-publication revision against its live
        # snapshot. SUSPENDED, EXPIRED and ARCHIVED (and a PENDING_APPROVAL row
        # that somehow lost its open revision) are outside that loop — carrying
        # their status forward would let them accumulate draft revisions that can
        # never be approved into a public-facing change, leaving the moderation
        # queue holding work it has to special-case.
        if listing.status not in (
            ListingStatus.DRAFT,
            ListingStatus.REJECTED,
            ListingStatus.PUBLISHED,
        ):
            raise InvalidWorkflowState(
                f"A listing in state {listing.status} cannot be edited.",
                code="invalid_listing_state",
            )

        # The client has no revision version to send yet, so the
        # compare-and-swap runs against the listing itself.
        target_status = (
            ListingStatus.DRAFT
            if listing.status in (ListingStatus.DRAFT, ListingStatus.REJECTED)
            else listing.status
        )
        bump_version(
            listing,
            expected_version=expected_version,
            resource="listing",
            status=target_status,
            updated_by=actor,
        )
        revision = ListingRevision.objects.create(
            listing=listing,
            revision_number=(
                ListingRevision.objects.filter(listing=listing)
                .order_by("-revision_number")
                .values_list("revision_number", flat=True)
                .first()
                or 0
            )
            + 1,
            base_snapshot=listing.current_public_snapshot,
            state=RevisionStatus.DRAFT,
            origin=RevisionOrigin.OWNER,
            payload=payload_from_snapshot(listing.current_public_snapshot),
        )
        revision_expected_version = revision.version
    else:
        revision_expected_version = expected_version

    # A `null` means "delete this key", so there is nothing to type-check and
    # `validate_revision_payload` never sees it. The key must still be one this
    # caller is *allowed* to touch, or a private seller could erase a locked
    # taxonomy field from a published listing's payload by sending it as null —
    # spec §11.4's "locked field manipulation fails server-side". This guard is
    # the only thing standing in front of that path; do not move or skip it.
    removals = {key for key, value in payload.items() if value is None}
    allowed = allowed_payload_fields(listing=listing, origin=RevisionOrigin.OWNER)
    illegal = sorted(removals - allowed)
    if illegal:
        raise ValidationError(
            {
                field: [
                    ErrorDetail(
                        "This field cannot be changed.",
                        code=(
                            "immutable_after_publication"
                            if field in TAXONOMY_FIELDS
                            else "unknown_field"
                        ),
                    )
                ]
                for field in illegal
            }
        )

    cleaned = validate_revision_payload(
        {key: value for key, value in payload.items() if value is not None},
        listing=listing,
        origin=RevisionOrigin.OWNER,
        for_submission=False,
    )

    merged = dict(revision.payload)
    merged.update(cleaned)
    for key in removals:
        merged.pop(key, None)

    bump_version(
        revision,
        expected_version=revision_expected_version,
        resource="revision",
        payload=merged,
    )

    _apply_payload_to_listing(listing, cleaned)
    listing.updated_by = actor
    try:
        listing.full_clean(exclude=FULL_CLEAN_EXCLUDED_FIELDS)
    except DjangoValidationError as exc:
        raise_as_drf_validation_error(exc)
    listing.save()
    listing.open_revision = revision
    return revision
