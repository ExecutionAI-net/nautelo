"""Spec §19.3 step 5: "Provide a reconciliation task that recomputes cached
counts from rows."

`BoatListing.view_count_cached` is a denormalised counter maintained by
analytics.recording. Denormalised counters drift — a rolled-back transaction, a
CASCADE delete when an account is erased, a future bulk import, a bug. This task
is the authority that puts them back, and spec §35.2 step 3 ("Run bounded
backfills and reconciliation") schedules it into the deployment sequence.

It is eventually consistent by design: an increment landing between the COUNT and
the UPDATE is lost by this pass and repaired by the next. The alternative —
locking each listing row — would block the public detail endpoint on a
maintenance job. Every correction writes an audit event, so drift is visible in
the record rather than quietly smoothed away.
"""

from celery import shared_task
from django.db import transaction
from django.db.models import Count

from audit.models import AuditEvent
from audit.services import record_audit_event
from listings.models import BoatListing

RECONCILIATION_BATCH_SIZE = 500
RECONCILIATION_ACTION = "listing.view_count_reconciled"


def _batches(queryset, batch_size):
    """Bounded iteration by primary key. `iterator()` alone would hold one long
    server-side cursor open across the whole table; keyset pagination keeps every
    query small and lets the task be interrupted without losing its place."""
    last_pk = None
    while True:
        page = queryset
        if last_pk is not None:
            page = page.filter(pk__gt=last_pk)
        rows = list(page.order_by("pk")[:batch_size])
        if not rows:
            return
        yield rows
        last_pk = rows[-1].pk


@shared_task(queue="maintenance")
def reconcile_listing_view_counts(
    *, batch_size: int = RECONCILIATION_BATCH_SIZE, listing_ids=None
) -> dict:
    """Recompute every listing's cached view count from its ListingView rows.

    Returns {"checked": n, "corrected": m, "drift": total absolute difference}.
    `listing_ids` limits the run to specific listings (used by the management
    command and by anyone repairing one row).
    """
    queryset = BoatListing.objects.only("pk", "view_count_cached").annotate(
        actual_views=Count("views", distinct=True)
    )
    if listing_ids:
        queryset = queryset.filter(pk__in=list(listing_ids))

    checked = corrected = drift = 0

    for rows in _batches(queryset, batch_size):
        for listing in rows:
            checked += 1
            if listing.actual_views == listing.view_count_cached:
                continue

            previous = listing.view_count_cached
            drift += abs(listing.actual_views - previous)
            corrected += 1

            # One short transaction per correction: the counter write and its
            # audit event must land together or not at all, and a single long
            # transaction over the whole run would hold locks for minutes.
            with transaction.atomic():
                BoatListing.objects.filter(pk=listing.pk).update(
                    view_count_cached=listing.actual_views
                )
                record_audit_event(
                    actor_user=None,
                    actor_type=AuditEvent.ActorType.SYSTEM,
                    action=RECONCILIATION_ACTION,
                    target_type="listings.BoatListing",
                    target_id=str(listing.pk),
                    source=AuditEvent.Source.TASK,
                    before={"view_count_cached": previous},
                    after={"view_count_cached": listing.actual_views},
                )

    return {"checked": checked, "corrected": corrected, "drift": drift}
