"""The staff moderation queue and revision detail (spec 26.2).

Reads only. Decisions stay in listings.decisions; nothing here mutates.
"""

from datetime import timedelta

from django.db.models import Q
from django.utils import timezone

from accounts.enums import SellerType
from audit.models import AuditEvent

from .drafts import payload_from_snapshot
from .enums import ListingStatus, MediaStatus, RevisionStatus
from .models import BoatListing, ListingMedia, ListingRevision

TABS = ("initial", "revisions", "other_model", "suspended", "expiring")
EXPIRING_WINDOW_DAYS = 30


def _is_initial(revision) -> bool:
    return revision.revision_number == 1


def _seller_label(listing) -> str:
    if listing.broker_id:
        return listing.broker.name
    owner = listing.owner_user
    return (owner.get_full_name() if owner else "") or "Private seller"


def _brand_model(listing) -> dict:
    return {
        "brand": listing.brand.name,
        "model": listing.model.name,
        "is_other_model": bool(listing.model.is_other_placeholder),
        "custom_model_name": listing.custom_model_name or "",
        "year": listing.manufacture_year,
    }


def _title(payload, listing) -> str:
    snapshot = listing.current_public_snapshot
    return (
        (payload or {}).get("title_en")
        or (snapshot.title_en if snapshot else "")
        or f"{listing.brand.name} {listing.model.name}"
    )


def _base_revisions():
    return ListingRevision.objects.select_related(
        "listing",
        "listing__brand",
        "listing__model",
        "listing__broker",
        "listing__owner_user",
        "listing__current_public_snapshot",
    )


def revision_row(revision, *, now=None) -> dict:
    now = now or timezone.now()
    listing = revision.listing
    waited = (
        int((now - revision.submitted_at).total_seconds())
        if revision.submitted_at
        else None
    )
    return {
        "kind": "revision",
        "id": str(revision.pk),
        "listing_id": str(listing.pk),
        "title": _title(revision.payload, listing),
        "seller": _seller_label(listing),
        "seller_type": listing.seller_type,
        "submission_type": "initial" if _is_initial(revision) else "revision",
        "submitted_at": revision.submitted_at,
        "waiting_seconds": waited,
        **_brand_model(listing),
        "listing_status": listing.status,
        # No assignment model exists (spec 26.2 lists the field); null, not faked.
        "assigned_moderator": None,
    }


def listing_row(listing, *, now=None) -> dict:
    return {
        "kind": "listing",
        "id": str(listing.pk),
        "listing_id": str(listing.pk),
        "title": _title(None, listing),
        "seller": _seller_label(listing),
        "seller_type": listing.seller_type,
        "submission_type": None,
        "submitted_at": None,
        "waiting_seconds": None,
        **_brand_model(listing),
        "listing_status": listing.status,
        "expires_at": listing.expires_at,
        "assigned_moderator": None,
    }


def queue_rows(*, tab: str, seller_type: str | None = None, ordering: str = "oldest"):
    """Returns (rows, total_counts). Counts are live queries for every tab, so
    the tab badges always equal what opening the tab shows (spec 26 DoD)."""
    now = timezone.now()
    pending = _base_revisions().filter(state=RevisionStatus.SUBMITTED)
    if seller_type in (SellerType.PRIVATE, SellerType.BROKER):
        pending = pending.filter(listing__seller_type=seller_type)

    def other_model_qs():
        return pending.filter(listing__model__is_other_placeholder=True)

    listings = BoatListing.objects.select_related(
        "brand", "model", "broker", "owner_user", "current_public_snapshot"
    )
    if seller_type in (SellerType.PRIVATE, SellerType.BROKER):
        listings = listings.filter(seller_type=seller_type)
    soon = now + timedelta(days=EXPIRING_WINDOW_DAYS)
    suspended = listings.filter(status=ListingStatus.SUSPENDED)
    expiring = listings.filter(
        Q(status=ListingStatus.EXPIRED)
        | Q(status=ListingStatus.PUBLISHED, expires_at__lte=soon)
    )

    counts = {
        "initial": pending.filter(revision_number=1).count(),
        "revisions": pending.exclude(revision_number=1).count(),
        "other_model": other_model_qs().count(),
        "suspended": suspended.count(),
        "expiring": expiring.count(),
    }
    if tab == "initial":
        rows = pending.filter(revision_number=1)
    elif tab == "revisions":
        rows = pending.exclude(revision_number=1)
    elif tab == "other_model":
        rows = other_model_qs()
    elif tab == "suspended":
        rows = suspended
    else:
        rows = expiring
    if tab in ("suspended", "expiring"):
        rows = rows.order_by("expires_at" if tab == "expiring" else "-updated_at")
        return [listing_row(item, now=now) for item in rows], counts
    rows = rows.order_by("-submitted_at" if ordering == "newest" else "submitted_at")
    return [revision_row(item, now=now) for item in rows], counts


def _taxonomy_name(model_class, value):
    """A moderator reads "Fairline", not a UUID: resolve a brand/model id."""
    if not value:
        return value
    row = model_class.objects.filter(pk=value).first()
    return row.name if row is not None else value


def _readable(field: str, value):
    from taxonomy.models import BoatBrand, BoatModel

    if field == "brand_id":
        return _taxonomy_name(BoatBrand, value)
    if field == "model_id":
        return _taxonomy_name(BoatModel, value)
    return value


def _diff(before: dict, after: dict) -> list[dict]:
    """One row per changed field. `specifications` is flattened to one row per
    changed key (specifications.cabins) so the moderator sees what moved
    instead of two JSON blobs; brand/model ids are shown by name."""
    changes = []
    for field in sorted(set(before) | set(after)):
        if field == "media_ids":
            continue
        if field == "specifications":
            old, new = before.get(field) or {}, after.get(field) or {}
            for key in sorted(set(old) | set(new)):
                if old.get(key) != new.get(key):
                    changes.append({"field": f"specifications.{key}", "before": old.get(key), "after": new.get(key)})
            continue
        if before.get(field) != after.get(field):
            changes.append(
                {"field": field, "before": _readable(field, before.get(field)), "after": _readable(field, after.get(field))}
            )
    return changes


def _media_facts(ids, *, change: str = "") -> list[dict]:
    from .serializers import _with_url

    ids = [str(i) for i in ids]
    rows = {str(m.pk): m for m in ListingMedia.objects.filter(pk__in=ids)}
    return [
        {
            "id": str(m.pk),
            "media_type": m.media_type,
            "status": m.status,
            "mime_type": m.mime_type,
            "width": m.width,
            "height": m.height,
            "sort_order": m.sort_order,
            "change": change,
            # Thumbnails for the moderator: what they approve is what buyers see.
            "url": _with_url({"storage_key": m.storage_key})["url"],
        }
        for m in (rows[i] for i in ids if i in rows)
    ]


def revision_detail(revision) -> dict:
    listing = revision.listing
    snapshot = listing.current_public_snapshot
    before = payload_from_snapshot(snapshot)
    after = dict(revision.payload or {})
    before_ids = list(before.get("media_ids", []))
    after_ids = list(after.get("media_ids", []))

    warnings = []
    if listing.model.is_other_placeholder:
        warnings.append({"code": "other_model", "custom_model_name": listing.custom_model_name or ""})
    not_ready = ListingMedia.objects.filter(pk__in=after_ids).exclude(
        status=MediaStatus.READY
    )
    if not_ready.exists():
        warnings.append({"code": "media_not_ready", "count": not_ready.count()})

    entitlement = listing.consumed_entitlement
    trail = AuditEvent.objects.filter(
        Q(target_type="listings.ListingRevision", target_id=str(revision.pk))
        | Q(metadata__listing_id=str(listing.pk))
    ).order_by("created_at")

    return {
        **revision_row(revision),
        "state": revision.state,
        "version": revision.version,
        "origin": revision.origin,
        "listing_version": listing.version,
        "diff": _diff(before, after),
        "media_diff": {
            "added": _media_facts([i for i in after_ids if i not in before_ids], change="added"),
            "removed": _media_facts([i for i in before_ids if i not in after_ids], change="removed"),
            "kept": len([i for i in after_ids if i in before_ids]),
            # The proposed gallery in order, each item tagged added/kept.
            "proposed": [
                {**item, "change": "kept" if item["id"] in before_ids else "added"} for item in _media_facts(after_ids)
            ],
        },
        "warnings": warnings,
        # Summary only: type, source and dates. No payment order, no card data.
        "entitlement": (
            {
                "type": entitlement.entitlement_type,
                "source": entitlement.source,
                "state": entitlement.state,
                "valid_until": entitlement.valid_until,
                "publication_days": entitlement.metadata.get("publication_days"),
            }
            if entitlement
            else None
        ),
        "publication_source": listing.publication_source,
        "audit_trail": [
            {
                "at": e.created_at,
                "action": e.action,
                "actor_type": e.actor_type,
                "actor_user_id": str(e.actor_user_id) if e.actor_user_id else None,
            }
            for e in trail
        ],
    }
