"""Publication expiry (spec §22.5).

This lives in `listings`, not in `entitlements`, because expiry is a listing
state change: Phase 11 contract rule 2 says `BoatListing.status` is written only
by a service that holds the transaction, the row lock, the optimistic-locking
compare-and-swap and the audit event together, and this is such a service.
"""

from datetime import datetime, timedelta

from django.db import transaction
from django.db.models import QuerySet
from django.utils import timezone

from audit.models import AuditEvent
from audit.services import record_audit_event

from .enums import ListingStatus, can_transition_listing
from .locking import bump_version
from .models import BoatListing
from .signals import listing_expired, listing_expiring

# Spec §22.5: "Default reminders: 7 days and 1 day before expiration."
# A module constant rather than a platform setting: spec §10.1's registry — the
# closed list of typed settings — defines no reminder key, and inventing one
# would put an unvalidated value in a registry whose purpose is validation.
EXPIRY_REMINDER_DAYS: tuple[int, ...] = (7, 1)


def due_listings_queryset(now: datetime) -> QuerySet[BoatListing]:
    """Published listings whose window has closed.

    `expires_at__isnull=False` is not redundant with the `__lte` filter for a
    reader's benefit: it states the rule. A broker listing has no configured
    window in this release (spec §21) and carries NULL, which must never be
    read as "already due".
    """
    return BoatListing.objects.filter(
        status=ListingStatus.PUBLISHED,
        expires_at__isnull=False,
        expires_at__lte=now,
    ).order_by("expires_at")


@transaction.atomic
def expire_listing(*, listing_id, now: datetime) -> bool:
    """Move one listing to EXPIRED. Returns True if it moved.

    Every precondition is re-checked under the lock, so two overlapping runs of
    the daily task cannot both expire the same row and write two audit events.
    """
    listing = BoatListing.objects.select_for_update().get(pk=listing_id)
    if (
        listing.status != ListingStatus.PUBLISHED
        or listing.expires_at is None
        or listing.expires_at > now
    ):
        return False
    if not can_transition_listing(listing.status, ListingStatus.EXPIRED):
        return False

    before = {"listing_status": listing.status}
    bump_version(
        listing,
        expected_version=listing.version,
        resource="listing",
        status=ListingStatus.EXPIRED,
    )
    record_audit_event(
        actor_user=None,
        actor_type=AuditEvent.ActorType.SYSTEM,
        action="listing.expired",
        target_type="listings.BoatListing",
        target_id=str(listing.pk),
        source=AuditEvent.Source.TASK,
        before=before,
        after={"listing_status": ListingStatus.EXPIRED},
        metadata={
            "expires_at": listing.expires_at,
            "published_at": listing.published_at,
            "owner_user_id": (
                str(listing.owner_user_id) if listing.owner_user_id else None
            ),
        },
    )
    transaction.on_commit(
        lambda: listing_expired.send(sender=BoatListing, listing=listing)
    )
    return True


def expire_due_listings(*, now: datetime | None = None) -> int:
    """Spec §22.5's daily sweep. Returns how many listings moved.

    One transaction per listing, not one for the whole sweep: a single failing
    row must not roll back every other expiry, and one long transaction would
    hold locks across the entire published catalogue.
    """
    now = now or timezone.now()
    listing_ids = list(due_listings_queryset(now).values_list("pk", flat=True))
    return sum(
        1
        for listing_id in listing_ids
        if expire_listing(listing_id=listing_id, now=now)
    )


# One day wide, matching the task's daily cadence. A listing is reminded at
# threshold D on the single run whose `now` falls inside
# [expires_at - D days, expires_at - (D - 1) days).
REMINDER_WINDOW = timedelta(days=1)


def listings_reaching_threshold(
    *, threshold_days: int, now: datetime
) -> QuerySet[BoatListing]:
    """Published listings that cross `threshold_days` remaining on this run.

    The window is half-open — `[lower, upper)` — so two adjacent thresholds can
    never both match the same listing on the same run, a listing is never
    reminded twice for one threshold by a daily schedule, and a listing whose
    window has already closed is not caught up retroactively.
    """
    upper = now + timedelta(days=threshold_days)
    lower = upper - REMINDER_WINDOW
    return BoatListing.objects.filter(
        status=ListingStatus.PUBLISHED,
        expires_at__isnull=False,
        expires_at__gte=lower,
        expires_at__lt=upper,
    ).order_by("expires_at")


def send_expiry_reminders(*, now: datetime | None = None) -> dict[int, int]:
    """Spec §22.5: "notifies owner before ... expiry".

    Fires `listings.signals.listing_expiring` once per listing per threshold.
    Phase 18 (spec §27) attaches the receivers that turn that into an in-app row
    and an email; this phase owns the *when*, not the *how* — exactly as Phase
    11 left its eight workflow signals without receivers.

    No transaction and no database write: a reminder changes nothing. That is
    also why the signal is sent directly rather than through
    `transaction.on_commit()` — there is no commit for it to wait on.
    """
    now = now or timezone.now()
    counts: dict[int, int] = {}
    for threshold_days in EXPIRY_REMINDER_DAYS:
        listings = list(
            listings_reaching_threshold(threshold_days=threshold_days, now=now)
        )
        for listing in listings:
            listing_expiring.send(
                sender=BoatListing, listing=listing, threshold_days=threshold_days
            )
        counts[threshold_days] = len(listings)
    return counts
