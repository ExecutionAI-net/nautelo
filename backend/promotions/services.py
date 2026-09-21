"""Promotion lifecycle. A listing is featured while `featured_until` is in the future."""

from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from listings.enums import ListingStatus
from listings.models import BoatListing

from .models import ListingPromotion


def is_live(listing: BoatListing) -> bool:
    return listing.status == ListingStatus.PUBLISHED and listing.current_public_snapshot_id is not None


def activate(promotion: ListingPromotion, *, now=None) -> bool:
    """Start the paid promotion if its listing is live. Stacks after a running one."""
    now = now or timezone.now()
    if promotion.status != ListingPromotion.Status.PAID or promotion.starts_at is not None:
        return False
    with transaction.atomic():
        listing = BoatListing.objects.select_for_update().get(pk=promotion.listing_id)
        if not is_live(listing):
            return False
        start = max(now, listing.featured_until or now)
        promotion.starts_at = start
        promotion.ends_at = start + timedelta(days=promotion.days)
        promotion.save(update_fields=["starts_at", "ends_at", "updated_at"])
        listing.featured_until = promotion.ends_at
        listing.featured_at = now
        listing.save(update_fields=["featured_until", "featured_at", "updated_at"])
    return True


def start_waiting(listing: BoatListing, *, now=None) -> int:
    """Called when a listing goes live: start every paid promotion that was waiting."""
    started = 0
    waiting = listing.promotions.filter(status=ListingPromotion.Status.PAID, starts_at__isnull=True).order_by("paid_at")
    for promotion in waiting:
        started += activate(promotion, now=now)
    return started
