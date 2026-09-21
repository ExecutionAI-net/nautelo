"""Counting featured impressions and clicks, and the owner's report."""

from django.db import transaction
from django.db.models import F, Sum
from django.utils import timezone

from listings.models import BoatListing
from professionals.models import ProfessionalProfile

from .models import PromotionDailyStat


def record_event(*, target: str, target_id, kind: str) -> bool:
    """Count one event, only while the target is featured right now. Returns whether it counted."""
    now = timezone.now()
    if target == "profile":
        obj = ProfessionalProfile.objects.filter(pk=target_id, featured_until__gt=now).first()
        keys = {"professional": obj}
    else:
        obj = BoatListing.objects.filter(pk=target_id, featured_until__gt=now).first()
        keys = {"listing": obj}
    if obj is None:
        return False
    field = "impressions" if kind == "impression" else "clicks"
    with transaction.atomic():
        stat, _ = PromotionDailyStat.objects.get_or_create(day=now.date(), **keys)
        PromotionDailyStat.objects.filter(pk=stat.pk).update(**{field: F(field) + 1})
    return True


def report_for(user) -> dict:
    """Totals per listing the user may edit, plus the user's own directory profile."""
    from accounts.models import User  # noqa: F401 - keeps the import graph explicit
    from brokers.models import BrokerMembership
    from professionals.access import membership_for

    broker_ids = list(BrokerMembership.objects.filter(user=user, is_active=True, can_edit_listings=True).values_list("broker_id", flat=True))
    listing_ids = list(BoatListing.objects.filter(owner_user=user).values_list("pk", flat=True)) + list(
        BoatListing.objects.filter(broker_id__in=broker_ids).values_list("pk", flat=True)
    )
    listings = {
        str(row["listing_id"]): {"impressions": row["i"], "clicks": row["c"]}
        for row in PromotionDailyStat.objects.filter(listing_id__in=listing_ids)
        .values("listing_id")
        .annotate(i=Sum("impressions"), c=Sum("clicks"))
    }
    profile = None
    seat = membership_for(user)
    if seat is not None:
        total = PromotionDailyStat.objects.filter(professional=seat.profile).aggregate(i=Sum("impressions"), c=Sum("clicks"))
        profile = {"impressions": total["i"] or 0, "clicks": total["c"] or 0}
    return {"listings": listings, "profile": profile}
