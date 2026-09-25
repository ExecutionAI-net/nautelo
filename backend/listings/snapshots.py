"""Building the immutable public snapshot from an approved revision (spec §11.4, §20)."""

from decimal import Decimal

from .models import BoatListing, ListingMedia, ListingRevision, ListingSnapshot
from .payloads import SPECIFICATIONS_SCHEMA_VERSION


def build_media_manifest(listing: BoatListing, media_ids: list[str]) -> list[dict]:
    """Copy the media facts, in public display order, into a self-contained list.

    Ordered by (media_type, sort_order) — ListingMedia.Meta.ordering — so the
    first IMAGE entry is the primary image (spec §36.5). Facts are copied rather
    than referenced so the snapshot stays readable and immutable after a later
    revision reorders or drops media, and so nothing dangles once Phase 15's
    retention cleanup starts deleting media rows.
    """
    rows = ListingMedia.objects.filter(listing=listing, pk__in=media_ids)
    return [
        {
            "media_id": str(row.pk),
            "media_type": row.media_type,
            "storage_key": row.storage_key,
            "mime_type": row.mime_type,
            "sort_order": row.sort_order,
            "width": row.width,
            "height": row.height,
            "duration_seconds": row.duration_seconds,
            "checksum_sha256": row.checksum_sha256,
        }
        for row in rows
    ]


def create_snapshot_from_revision(
    *,
    listing: BoatListing,
    revision: ListingRevision,
    cleaned_payload: dict,
    approved_by,
    approved_at,
) -> ListingSnapshot:
    """Freeze the approved content into the next immutable snapshot version.

    Two sources, deliberately: free-text content comes from `cleaned_payload`
    (the revision's own re-validated document), while the four taxonomy fields
    and the four broker finance settings come from the **listing columns**,
    which are where spec §11.4 puts them. Those columns are kept in step with
    every accepted payload by `listings.drafts._apply_payload_to_listing`,
    which every service that accepts a payload calls — including a §20.3 staff
    correction of a locked field, so such a correction really does reach this
    snapshot. Copying the finance settings here is what makes spec §36.1's
    "draft broker finance settings do not leak before publication" true: the
    public card reads this snapshot, never the draft column.
    """
    previous_version = (
        ListingSnapshot.objects.filter(listing=listing)
        .order_by("-version")
        .values_list("version", flat=True)
        .first()
        or 0
    )
    return ListingSnapshot.objects.create(
        listing=listing,
        version=previous_version + 1,
        approved_revision=revision,
        brand_name_snapshot=listing.brand.name,
        model_name_snapshot=listing.model.name,
        custom_model_name_snapshot=listing.custom_model_name,
        manufacture_year_snapshot=listing.manufacture_year,
        title_en=cleaned_payload["title_en"],
        title_it=cleaned_payload.get("title_it", ""),
        title_es=cleaned_payload.get("title_es", ""),
        description_en=cleaned_payload["description_en"],
        description_it=cleaned_payload.get("description_it", ""),
        description_es=cleaned_payload.get("description_es", ""),
        specifications=cleaned_payload.get("specifications", {}),
        specifications_schema_version=SPECIFICATIONS_SCHEMA_VERSION,
        location_country=cleaned_payload["location_country"],
        location_region=cleaned_payload.get("location_region", ""),
        location_city=cleaned_payload["location_city"],
        location_place_id=cleaned_payload.get("location_place_id") or None,
        currency=cleaned_payload.get("currency", listing.currency),
        price=Decimal(cleaned_payload["price"]),
        show_finance_estimate=listing.show_finance_estimate,
        finance_down_payment_override_percent=(
            listing.finance_down_payment_override_percent
        ),
        finance_rate_override_percent=listing.finance_rate_override_percent,
        finance_term_override_months=listing.finance_term_override_months,
        media_manifest=build_media_manifest(listing, cleaned_payload["media_ids"]),
        approved_by=approved_by,
        approved_at=approved_at,
    )
