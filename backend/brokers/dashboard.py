"""Spec 28 "Dashboard metrics" — the only numbers broker home may show.

Spec 28: "Broker home may show only backend-derived useful metrics such as
published listings, pending approvals, unread messages and new inquiries.
Remove surveyor/service widgets completely."

EVERY cross-app import below is function-local, and that is not a style choice.
`messaging.selectors` imports `brokers.models.BrokerMembership` at module level,
so a module-level messaging import here would close an app-loading cycle whose
symptom is AppRegistryNotReady at manage.py start — and `brokers/admin.py`
imports this app at admin-autodiscover time, which is exactly when that bites.
`brokers/selectors.py` already does the same for `listings` (Phase 12 contract
rule 2). Do not consolidate them to the top of the module.
"""

from datetime import timedelta

from django.utils import timezone

#: Spec 28 names "new inquiries" without defining "new". Seven days is decided
#: here, once, and reported on the wire as `new_inquiries_7d` so a screen cannot
#: label the number with a window the backend did not compute (spec 2.1).
NEW_INQUIRY_WINDOW_DAYS = 7

#: What the messaging block looks like when there is nothing to report. Every key
#: is present with an explicit None rather than omitted, so the client renders a
#: known-empty tile instead of branching on a missing key (spec 2.1; spec 26's
#: "All visible counters equal query results").
_BLANK_MESSAGE_METRICS = {
    "enabled": False,
    "can_read": False,
    "unread_conversations": None,
    "unread_messages": None,
    "new_inquiries_7d": None,
}


def _can_read_messages(viewer, broker) -> bool:
    from accounts.services import active_broker_membership

    membership = active_broker_membership(viewer, broker.pk)
    return membership is not None and membership.can_read_messages


def broker_message_metrics(broker, *, viewer) -> dict:
    """Spec 28's "unread messages" and "new inquiries", for ONE organization.

    Scoped by `messaging.selectors.conversations_visible_to(viewer)`, never by a
    fresh query: Phase 6 contract rule 8 requires it, and it already applies
    `can_read_messages`, the membership's own `is_active` and the organization's
    ACTIVE status. Filtering that queryset by this broker is therefore the whole
    cross-tenant boundary — a member of another brokerage gets an empty set
    rather than somebody else's numbers, at the same place the inbox does.

    Spec 11.8 gives Message ONE nullable read_at, so "unread" means unread by the
    recipient SIDE, not by this member. See the plan's Known Limitations.
    """
    from messaging.enums import UNIFIED_INQUIRIES_FLAG
    from messaging.models import Message
    from messaging.selectors import annotate_unread, conversations_visible_to
    from platform_settings.services import is_feature_enabled

    if not is_feature_enabled(UNIFIED_INQUIRIES_FLAG, default=False):
        return dict(_BLANK_MESSAGE_METRICS)
    if not _can_read_messages(viewer, broker):
        return {**_BLANK_MESSAGE_METRICS, "enabled": True}

    visible = conversations_visible_to(viewer).filter(broker=broker)
    since = timezone.now() - timedelta(days=NEW_INQUIRY_WINDOW_DAYS)
    return {
        "enabled": True,
        "can_read": True,
        "unread_conversations": (
            annotate_unread(visible, viewer).filter(unread_count__gt=0).count()
        ),
        # `.values("pk")` rather than passing the queryset itself: `visible`
        # carries select_related and distinct, and an explicit pk projection
        # keeps the generated subquery obviously one column wide.
        "unread_messages": (
            Message.objects.filter(conversation_id__in=visible.values("pk"))
            .exclude(sender=viewer)
            .filter(read_at__isnull=True)
            .count()
        ),
        "new_inquiries_7d": visible.filter(created_at__gte=since).count(),
    }


def broker_dashboard_metrics(broker, *, viewer) -> dict:
    """The whole broker-home payload (spec 28 "Dashboard metrics").

    `broker_listing_counts` is Phase 12's live GROUP BY and is reused rather than
    re-counted: two implementations of "how many published listings" is exactly
    how a screen ends up disagreeing with the staff screen beside it. Only the
    PUBLISHED cell is exposed here — spec 28 permits "published listings", not a
    full state breakdown, and a broker-facing payload should not grow surface it
    was not asked for.
    """
    from brokers.selectors import broker_listing_counts, pending_revision_count
    from listings.enums import ListingStatus

    counts = broker_listing_counts(broker)
    return {
        "broker": {
            "id": str(broker.pk),
            "name": broker.name,
            "slug": broker.slug,
            "status": broker.status,
        },
        "published_listings": counts["by_status"][ListingStatus.PUBLISHED],
        "pending_approvals": pending_revision_count(broker),
        "messages": broker_message_metrics(broker, viewer=viewer),
    }
