"""Staff taxonomy operations on listings (spec 13.3).

Mapping goes through the SAME correction machinery as spec 20.3: for a listing
with a public snapshot, a staff-correction revision is created and approved in
one transaction, producing the next snapshot version and leaving history
immutable. A listing that was never published has no snapshot to correct, so its
columns and any open revision payload are updated in place.
"""

from django.db import IntegrityError, transaction
from rest_framework.exceptions import ValidationError

from audit.models import AuditEvent
from audit.services import record_audit_event
from taxonomy.models import BoatModel

from .decisions import approve_revision, create_staff_correction_revision
from .drafts import InvalidWorkflowState, open_revision_for
from .models import BoatListing


def _audit(actor, action, listing, before, after, metadata):
    record_audit_event(
        actor_user=actor,
        actor_type=AuditEvent.ActorType.USER,
        action=action,
        target_type="listings.BoatListing",
        target_id=str(listing.pk),
        source=AuditEvent.Source.API,
        before=before,
        after=after,
        metadata=metadata,
    )


@transaction.atomic
def map_listing_to_model(
    *, listing: BoatListing, actor, model: BoatModel, note: str, require_other=True
) -> BoatListing:
    listing = BoatListing.objects.select_for_update().select_related("model").get(
        pk=listing.pk
    )
    if require_other and not listing.model.is_other_placeholder:
        raise InvalidWorkflowState(
            "This listing does not use the Other model.", code="not_other_model"
        )
    if model.brand_id != listing.brand_id or not model.is_active:
        raise ValidationError(
            {"model_id": "Select an active model of the listing's brand."}
        )
    before = {"model_id": str(listing.model_id), "custom": listing.custom_model_name}
    preserved_custom = listing.custom_model_name or ""
    cleaned_note = (note or "").strip() or "Taxonomy mapping"

    if listing.current_public_snapshot_id:
        revision = create_staff_correction_revision(
            listing=listing,
            actor=actor,
            payload={
                "brand_id": str(listing.brand_id),
                "model_id": str(model.pk),
                "custom_model_name": "",
            },
            note=cleaned_note,
        )
        approve_revision(
            revision_id=revision.pk,
            actor=actor,
            expected_version=revision.version,
            note=cleaned_note,
        )
    else:
        listing.model = model
        listing.custom_model_name = ""
        listing.updated_by = actor
        listing.save()
        open_revision = open_revision_for(listing)
        if open_revision is not None:
            open_revision.payload = {
                **(open_revision.payload or {}),
                "model_id": str(model.pk),
                "custom_model_name": "",
            }
            open_revision.save(update_fields=["payload", "updated_at"])

    listing.refresh_from_db()
    _audit(
        actor,
        "taxonomy.listing_mapped",
        listing,
        before,
        {"model_id": str(model.pk), "custom": listing.custom_model_name},
        # Spec 13.3: the custom text is preserved here after being cleared.
        {"custom_model_name": preserved_custom, "note": cleaned_note},
    )
    return listing


@transaction.atomic
def create_model_and_map(*, listing, actor, name: str, note: str) -> BoatListing:
    cleaned = " ".join((name or "").split())
    if not cleaned:
        raise ValidationError({"new_model_name": "Enter the model name."})
    brand = listing.brand
    try:
        with transaction.atomic():
            model = BoatModel.objects.create(
                brand=brand, name=cleaned, created_by=actor, updated_by=actor
            )
    except IntegrityError:
        raise InvalidWorkflowState(
            "A model with this name already exists for the brand; map to it instead.",
            code="duplicate_model",
        ) from None
    return map_listing_to_model(listing=listing, actor=actor, model=model, note=note)


def merge_preview(source: BoatModel, target: BoatModel) -> dict:
    affected = BoatListing.objects.filter(model=source)
    return {
        "source_id": str(source.pk),
        "target_id": str(target.pk),
        "affected_count": affected.count(),
        "affected_listing_ids": [str(pk) for pk in affected.values_list("pk", flat=True)],
    }


@transaction.atomic
def merge_models(*, source: BoatModel, target: BoatModel, actor, note: str) -> dict:
    """Never deletes a model referenced by listings (spec 13.3): every listing is
    re-mapped through the correction path, then the source is deactivated."""
    if source.pk == target.pk or source.brand_id != target.brand_id:
        raise ValidationError({"into": "Choose a different model of the same brand."})
    if source.is_other_placeholder:
        raise ValidationError({"source": "The Other placeholder cannot be merged."})
    listings = list(BoatListing.objects.filter(model=source))
    for listing in listings:
        map_listing_to_model(
            listing=listing, actor=actor, model=target, note=note, require_other=False
        )
    source.is_active = False
    source.updated_by = actor
    source.save(update_fields=["is_active", "updated_by", "updated_at"])
    return {"merged_listings": len(listings), "source_deactivated": True}
