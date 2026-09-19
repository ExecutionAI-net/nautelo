"""Migration reconciliation counts (spec 32.1 / definition of done).

Pure reads. Each check names a condition that must hold after the cutover; a
non-zero `problems` count is a defect to investigate, `info` counts are the
review queues that are expected to be non-empty.
"""

from django.db.models import F

from .enums import ListingStatus
from .models import BoatListing, ListingRevision, ListingSnapshot


def reconcile() -> dict:
    listings = BoatListing.objects.all()
    published = listings.filter(status=ListingStatus.PUBLISHED)
    problems = {
        "published_without_snapshot": published.filter(
            current_public_snapshot__isnull=True
        ).count(),
        "published_without_slug": published.filter(slug__isnull=True).count(),
        "snapshot_of_another_listing": listings.exclude(
            current_public_snapshot__isnull=True
        )
        .exclude(current_public_snapshot__listing_id=F("pk"))
        .count(),
        "broker_seller_without_broker": listings.filter(
            seller_type="BROKER", broker__isnull=True
        ).count(),
        "private_seller_without_owner": listings.filter(
            seller_type="PRIVATE", owner_user__isnull=True
        ).count(),
    }
    info = {
        "listings": listings.count(),
        "published": published.count(),
        "snapshots": ListingSnapshot.objects.count(),
        "open_revisions": ListingRevision.objects.filter(state="SUBMITTED").count(),
        "other_model_unresolved": listings.filter(
            model__is_other_placeholder=True
        ).count(),
    }
    return {"problems": problems, "info": info, "ok": not any(problems.values())}
