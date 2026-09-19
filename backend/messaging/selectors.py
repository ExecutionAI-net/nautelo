"""Read-only queries over the conversation store (spec §11.8).

Only foreign keys to other apps are used here, never Python imports of them,
so the one-directional dependency arrow `messaging` -> nothing is preserved
(see models.py's module docstring).
"""

from django.contrib.auth import get_user_model
from django.db.models import Count, IntegerField, OuterRef, Q, Subquery, Value
from django.db.models.functions import Coalesce

from brokers.enums import BrokerOrganizationStatus
from brokers.models import BrokerMembership
from messaging.models import ContactAccessGrant, Conversation, Message


def active_contact_grant(viewer, *, broker=None, professional=None):
    """The viewer's live grant for exactly ONE target, or None (spec §16).

    The ONE definition of "an active grant" in this codebase — every caller
    reads through this function so that "active" cannot drift between them.

    Both target columns are always filtered, never just the one the caller
    passed: `filter(broker=None)` becomes `broker__isnull=True`, so a grant for
    a professional can never satisfy a lookup for a broker (or the reverse),
    which is spec §16's "sending to Broker A does not unlock Broker B" applied
    across target kinds as well as within one.

    `revoked_at__isnull=True` is the revocation rule, and `-granted_at` ordering
    means a database that somehow holds two active rows degrades to "newest
    wins" on read rather than raising — the model's partial unique constraints
    are what prevent that pair from existing in the first place.
    """
    if (broker is None) == (professional is None):
        raise ValueError("Pass exactly one of broker= or professional=.")
    return (
        ContactAccessGrant.objects.filter(
            viewer=viewer,
            broker=broker,
            professional=professional,
            revoked_at__isnull=True,
        )
        .order_by("-granted_at")
        .first()
    )


def broker_message_readers(broker):
    """Spec 15.4: "team members with can_read_messages receive in-app visibility."

    Gates on can_read_messages ONLY, never on can_edit_listings (Phase 3
    contract rule 4): active membership, ACTIVE organization and the flag.
    """
    return (
        get_user_model()
        .objects.filter(
            is_active=True,
            broker_memberships__broker=broker,
            broker_memberships__is_active=True,
            broker_memberships__can_read_messages=True,
            broker_memberships__broker__status=BrokerOrganizationStatus.ACTIVE,
        )
        .order_by("pk")
        .distinct()
    )


def _readable_broker_ids(user):
    """The organizations whose messages this user may read (spec 15.4, 28).

    Gates on can_read_messages ONLY, and on the organization still being ACTIVE
    - the same three conditions accounts.services.active_broker_membership
    applies, expressed as a subquery so the inbox stays one database round trip.
    """
    return BrokerMembership.objects.filter(
        user=user,
        is_active=True,
        can_read_messages=True,
        broker__status=BrokerOrganizationStatus.ACTIVE,
    ).values("broker_id")


def conversations_visible_to(user):
    """Every thread this user may see, from either side.

    Deliberately no staff branch - see the ruling in this plan's Task 9. This
    function and can_view_conversation() below are written as a pair and must
    stay in agreement: a list that shows a row a detail view then refuses (or
    worse, the other way round) is the real hazard here.
    """
    return (
        Conversation.objects.filter(
            Q(initiator=user)
            | Q(professional__owner_user=user)
            | Q(listing__owner_user=user)
            | Q(broker_id__in=_readable_broker_ids(user))
        )
        .select_related("broker", "professional", "listing__current_public_snapshot")
        .distinct()
    )


def can_view_conversation(user, conversation) -> bool:
    if not user or not user.is_authenticated or not user.is_active:
        return False
    if conversation.initiator_id == user.pk:
        return True
    if (
        conversation.professional_id is not None
        and conversation.professional.owner_user_id == user.pk
    ):
        return True
    if (
        conversation.listing_id is not None
        and conversation.listing.owner_user_id == user.pk
    ):
        return True
    if conversation.broker_id is not None:
        return (
            _readable_broker_ids(user)
            .filter(broker_id=conversation.broker_id)
            .exists()
        )
    return False


def annotate_unread(queryset, user):
    """Spec 28's per-row unread count.

    Spec 11.8 puts ONE nullable read_at on Message, so for a broker team this
    counts "unread by the recipient side", not "unread by this member". That is
    what the spec's data model supports; see the plan's Known Limitations.

    A correlated Subquery rather than `Count("messages", filter=...)`: the
    aggregate form puts a GROUP BY on the outer query, which then has to
    co-exist with `.distinct()` (needed because the visibility filter ORs across
    two joins) and with pagination's `.count()`. A scalar subquery keeps the
    outer query ungrouped, so the row count, the ordering and the LIMIT all stay
    exactly what they look like. Coalesce because a conversation with no
    matching messages yields NULL, and the API must report 0.
    """
    unread = (
        Message.objects.filter(conversation=OuterRef("pk"), read_at__isnull=True)
        .exclude(sender=user)
        .order_by()
        .values("conversation")
        .annotate(total=Count("pk"))
        .values("total")
    )
    return queryset.annotate(
        unread_count=Coalesce(
            Subquery(unread, output_field=IntegerField()), Value(0)
        )
    )


def annotate_last_message(queryset):
    """The two per-row fields spec 28's conversation row needs, as annotations.

    Spec 33.3: "Avoid N+1 queries in cards/directories; verify with query-count
    tests." Reading `conversation.messages.first()` and `.last()` from the
    serializer costs TWO queries per row, which is the textbook N+1 - twenty
    inbox rows would issue forty-one queries. Two correlated subqueries move
    both into the single list query, so the cost is constant in the number of
    rows. `is_system=False` matches the serializer's own rule: a system note is
    never the "sender display name" and never the excerpt.
    """
    visible = Message.objects.filter(conversation=OuterRef("pk"), is_system=False)
    return queryset.annotate(
        first_sender_name=Subquery(
            visible.order_by("created_at").values("sender_name_snapshot")[:1]
        ),
        last_message_body=Subquery(
            visible.order_by("-created_at").values("body")[:1]
        ),
    )


def conversation_recipients(conversation) -> tuple[list, str]:
    """The RECIPIENT side of a stored thread: who to notify in-app, and the one
    address to email (spec 15.4). Mirrors messaging.context's resolution rules,
    but reads them off a saved Conversation rather than a request."""
    if conversation.broker_id is not None:
        return (
            list(broker_message_readers(conversation.broker)),
            conversation.broker.public_email,
        )
    if conversation.professional_id is not None:
        owner = conversation.professional.owner_user
        return ([owner] if owner is not None else []), conversation.professional.public_email
    if conversation.listing_id is not None:
        owner = conversation.listing.owner_user
        return ([owner], owner.email) if owner is not None else ([], "")
    return [], ""


def conversation_context(conversation) -> tuple[str, str]:
    """(context type, human label) for a stored thread - the notification
    payload's `context_type` and `context_label`."""
    if conversation.listing_id is not None:
        snapshot = conversation.listing.current_public_snapshot
        label = ""
        if snapshot is not None:
            model_name = (
                snapshot.custom_model_name_snapshot or snapshot.model_name_snapshot
            )
            label = f"{snapshot.brand_name_snapshot} {model_name}".strip()
        return "LISTING", label
    if conversation.broker_id is not None:
        return "BROKER", conversation.broker.name
    if conversation.professional_id is not None:
        return "PROFESSIONAL", conversation.professional.display_name
    return "SUPPORT", ""
