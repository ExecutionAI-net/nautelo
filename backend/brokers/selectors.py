"""Read-only aggregates behind spec §21's "Staff broker UI".

Import direction: `brokers` may import `listings`; `listings` must never import
`brokers` at module level (see the Phase 12 plan's scope rulings). The listings
imports below are function-local anyway, mirroring the pattern
`accounts.services` established for exactly this neighbourhood — `brokers.admin`
imports this app's modules at admin-autodiscover time, and a module-level import
of another app's models from there has caused an app-loading cycle before.
"""

from django.db.models import Count

from audit.models import AuditEvent
from brokers.models import BrokerOrganization

#: How many of this broker's audit rows the staff screen shows. A window, not a
#: page: spec §21 asks for "Audit history" on a detail panel, and a broker whose
#: policy has been toggled more than fifty times is a conversation, not a
#: pagination problem. Phase 17's staff tooling owns a full, filterable audit
#: browser if one is ever needed.
BROKER_AUDIT_HISTORY_LIMIT = 50


def broker_listing_counts(broker: BrokerOrganization) -> dict:
    """Live per-state counts plus a total (spec §21 Staff broker UI item 2).

    Every one of spec §6.1's seven states is present with an explicit 0 rather
    than omitted, so the screen renders a real zero row instead of a missing
    one (spec §2.1; spec §26 definition of done: "All visible counters equal
    query results"). One GROUP BY query, never a cached counter column — a
    cached count cannot satisfy "equal query results".
    """
    from listings.enums import ListingStatus
    from listings.models import BoatListing

    by_status = {status.value: 0 for status in ListingStatus}
    rows = (
        BoatListing.objects.filter(broker=broker)
        .values("status")
        .annotate(count=Count("id"))
    )
    for row in rows:
        by_status[row["status"]] = row["count"]
    return {"by_status": by_status, "total": sum(by_status.values())}


def pending_revision_count(broker: BrokerOrganization) -> int:
    """SUBMITTED revisions across this broker's listings.

    This is exactly the backlog spec §21 rule 7's bulk approve acts on, so the
    number the screen shows and the number the action processes come from the
    same filter.
    """
    from listings.enums import RevisionStatus
    from listings.models import ListingRevision

    return ListingRevision.objects.filter(
        listing__broker=broker, state=RevisionStatus.SUBMITTED
    ).count()


def broker_audit_history(
    broker: BrokerOrganization, *, limit: int = BROKER_AUDIT_HISTORY_LIMIT
) -> list[AuditEvent]:
    """This organization's own audit rows, newest first (Staff broker UI item 6).

    Filtered by `target_type`/`target_id`, which `audit.AuditEvent.Meta.indexes`
    already covers with `Index(fields=["target_type", "target_id"])`. Listing
    decisions are *not* included: they target `listings.ListingRevision`, belong
    to the moderation queue (Phase 17), and would bury the policy history this
    panel exists to show.
    """
    return list(
        AuditEvent.objects.select_related("actor_user")
        .filter(
            target_type="brokers.BrokerOrganization", target_id=str(broker.pk)
        )
        .order_by("-created_at")[:limit]
    )
