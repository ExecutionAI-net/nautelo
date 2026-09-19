"""The one inquiry service (spec 15's definition of done: "One backend service
handles all types").

Everything below runs inside a single transaction.atomic() in the order spec
15.3 prescribes. Step 1's rate-limit half is split in two by design: the per-user
and per-IP throttle is a view concern (DRF applies it before the body is even
parsed, spec 30.4), while the duplicate-body guard needs the resolved
conversation and therefore lives here.
"""

import logging
from dataclasses import dataclass
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone

from audit.models import AuditEvent
from audit.services import record_audit_event
from common.text import normalize_comparison_text
from messaging.context import resolve_inquiry_context
from messaging.enums import (
    CURRENT_PRIVACY_POLICY_VERSION,
    DUPLICATE_MESSAGE_WINDOW_SECONDS,
    FULL_NAME_MAX_LENGTH,
    ContactAccessOutcome,
    ConversationStatus,
    conversation_url,
)
from messaging.exceptions import ConsentRequired, ConversationClosed, MessagingThrottled
from messaging.models import ContactAccessGrant, Conversation, Message
from messaging.selectors import (
    active_contact_grant,
    conversation_context,
    conversation_recipients,
)
from messaging.signals import inquiry_received
from notifications.enums import EXCERPT_MAX_LENGTH, NotificationType
from notifications.services import create_notification

logger = logging.getLogger(__name__)

INQUIRY_TITLE_KEY = "notification.inquiry_received.title"
INQUIRY_BODY_KEY = "notification.inquiry_received.body"


@dataclass(frozen=True)
class InquiryResult:
    conversation: Conversation
    message: Message
    contact_access: str
    next_url: str
    created_conversation: bool
    created_grant: bool


def message_excerpt(body: str) -> str:
    """Spec 15.4's "safe excerpt" / 27.3's "safe summary", whitespace-collapsed
    and hard-capped so a notification payload never becomes a second copy of the
    message."""
    collapsed = " ".join(body.split())
    if len(collapsed) <= EXCERPT_MAX_LENGTH:
        return collapsed
    return collapsed[: EXCERPT_MAX_LENGTH - 1].rstrip() + "…"


def _open_thread_lookup(actor, context) -> dict:
    lookup = {"initiator": actor, "status": ConversationStatus.OPEN}
    if context.listing is not None:
        lookup["listing"] = context.listing
    elif context.broker is not None:
        # `listing__isnull=True` matches the partial index exactly: a
        # broker-owned LISTING_INQUIRY also carries this broker, and without
        # this clause the broker-profile thread and every listing thread with
        # the same broker would collide.
        lookup["broker"] = context.broker
        lookup["listing__isnull"] = True
    else:
        lookup["professional"] = context.professional
    return lookup


def _get_or_create_open_conversation(actor, context, subject):
    lookup = _open_thread_lookup(actor, context)
    existing = Conversation.objects.select_for_update().filter(**lookup).first()
    if existing is not None:
        return existing, False
    try:
        # Nested atomic == savepoint. Required: in PostgreSQL a unique violation
        # aborts the whole transaction unless it is caught inside one, so
        # without this the recovery below would itself fail.
        with transaction.atomic():
            conversation = Conversation.objects.create(
                initiator=actor,
                conversation_type=context.conversation_type,
                listing=context.listing,
                broker=context.broker,
                professional=context.professional,
                subject=subject,
                status=ConversationStatus.OPEN,
            )
        return conversation, True
    except IntegrityError:
        # A concurrent request won the partial unique index. Re-read it under
        # the lock: exactly one OPEN thread exists and both requests use it.
        return Conversation.objects.select_for_update().get(**lookup), False


def _refuse_duplicate(conversation, actor, body) -> None:
    cutoff = timezone.now() - timedelta(seconds=DUPLICATE_MESSAGE_WINDOW_SECONDS)
    normalized = normalize_comparison_text(body)
    recent = conversation.messages.filter(
        sender=actor, created_at__gte=cutoff
    ).values_list("body", flat=True)
    if any(normalize_comparison_text(previous) == normalized for previous in recent):
        raise MessagingThrottled(wait=DUPLICATE_MESSAGE_WINDOW_SECONDS)


def grant_contact_access(*, viewer, context, conversation, request_id=None):
    """Spec 15.3 step 4: "Create contact access grant if none exists."

    Returns (grant, created). A private-seller listing returns (None, False):
    spec 11.8's target_type has no member for a private person, so there is
    nothing to grant and nothing to reveal.
    """
    if context.contact_target_type is None:
        return None, False

    existing = active_contact_grant(
        viewer, broker=context.broker, professional=context.professional
    )
    if existing is not None:
        return existing, False

    try:
        with transaction.atomic():
            grant = ContactAccessGrant.objects.create(
                viewer=viewer,
                target_type=context.contact_target_type,
                broker=context.broker,
                professional=context.professional,
                source_conversation=conversation,
            )
    except IntegrityError:
        # Spec 16's acceptance test: "exactly one grant despite concurrent
        # duplicate requests". The partial unique index is what guarantees it;
        # this branch is how the loser of the race reports the winner's row.
        return (
            active_contact_grant(
                viewer, broker=context.broker, professional=context.professional
            ),
            False,
        )

    record_audit_event(
        actor_user=viewer,
        actor_type=AuditEvent.ActorType.USER,
        action="contact_access.granted",
        target_type="messaging.ContactAccessGrant",
        target_id=grant.pk,
        source=AuditEvent.Source.API,
        after={
            "viewer_id": str(viewer.pk),
            "target_type": grant.target_type,
            "broker_id": str(grant.broker_id) if grant.broker_id else None,
            "professional_id": (
                str(grant.professional_id) if grant.professional_id else None
            ),
            "source_conversation_id": str(conversation.pk),
        },
        request_id=request_id,
    )
    return grant, True


def _dispatch_notifications(
    *, recipients, email_to, conversation, message, context_type, context_label
) -> list[str]:
    """One fan-out, used by both submit_inquiry() and post_reply().

    In-app goes to every recipient; the email goes to exactly one address,
    carried by exactly one of those notifications (spec 15.4: "not every member
    by default").
    """
    recipients = list(recipients)
    if not recipients:
        # Truthful consequence of can_read_messages defaulting to False: nobody
        # on the recipient side can read messages, so nobody is told. The thread
        # is still real and appears the moment staff grants the capability.
        # Surfaced as a warning so spec 33.4's alerting can see it.
        logger.warning(
            "message has no in-app recipient",
            extra={"conversation_id": str(conversation.pk)},
        )
        return []

    # Deterministic: prefer the recipient whose own account address IS the
    # configured address (the private-seller and professional-owner cases), so
    # one person does not get both the in-app row and an email that reads as if
    # it were meant for a shared inbox. Otherwise the lowest pk, because
    # broker_message_readers() orders by pk.
    email_index = 0
    for index, user in enumerate(recipients):
        if user.email == email_to:
            email_index = index
            break

    payload = {
        "conversation_id": str(conversation.pk),
        "message_id": str(message.pk),
        "context_type": context_type,
        "context_label": context_label,
        "sender_display_name": message.sender_name_snapshot,
        "excerpt": message_excerpt(message.body),
    }

    notification_ids = []
    for index, user in enumerate(recipients):
        notification = create_notification(
            recipient=user,
            notification_type=NotificationType.INQUIRY_RECEIVED,
            title_key=INQUIRY_TITLE_KEY,
            body_key=INQUIRY_BODY_KEY,
            target_url=conversation_url(conversation.pk),
            payload=payload,
            email_to=email_to if index == email_index and email_to else "",
            # Spec 27.1's deduplication key for `inquiry.received` is the
            # message ID. Scoped per recipient by the model's constraint, so a
            # broker team still gets one notification each.
            dedupe_key=str(message.pk),
        )
        notification_ids.append(str(notification.pk))
    return notification_ids


def _notify_recipients(context, conversation, message) -> list[str]:
    return _dispatch_notifications(
        recipients=context.recipient_users,
        email_to=context.recipient_email,
        conversation=conversation,
        message=message,
        context_type=context.context_type,
        context_label=context.context_label,
    )


@transaction.atomic
def submit_inquiry(
    *,
    actor,
    context_type,
    context_id,
    full_name,
    phone,
    subject,
    body,
    privacy_policy_version,
    marketing_consent=False,
    request_id=None,
) -> InquiryResult:
    # Step 1 - validate. The consent version is checked before the context is
    # resolved, so a submission with stale consent cannot be used to probe which
    # context ids exist.
    if privacy_policy_version != CURRENT_PRIVACY_POLICY_VERSION:
        raise ConsentRequired()
    context = resolve_inquiry_context(
        actor=actor, context_type=context_type, context_id=context_id
    )

    # Step 2 - get or create the open conversation for this policy.
    conversation, created_conversation = _get_or_create_open_conversation(
        actor, context, subject
    )
    _refuse_duplicate(conversation, actor, body)

    # Step 3 - the message and the sender snapshots.
    message = Message.objects.create(
        conversation=conversation,
        sender=actor,
        body=body,
        sender_email_snapshot=actor.email,
        sender_name_snapshot=full_name,
        sender_phone_snapshot=phone or "",
        is_system=False,
        privacy_policy_version=privacy_policy_version,
        marketing_consent=marketing_consent,
    )
    conversation.last_message_at = message.created_at
    conversation.save(update_fields=["last_message_at", "updated_at"])

    # Step 4 - the contact access grant.
    grant, created_grant = grant_contact_access(
        viewer=actor,
        context=context,
        conversation=conversation,
        request_id=request_id,
    )

    # Step 5 - recipient in-app notifications (and the queued email).
    notification_ids = _notify_recipients(context, conversation, message)

    record_audit_event(
        actor_user=actor,
        actor_type=AuditEvent.ActorType.USER,
        action="inquiry.submitted",
        target_type="messaging.Conversation",
        target_id=conversation.pk,
        source=AuditEvent.Source.API,
        after={
            "conversation_type": conversation.conversation_type,
            "message_id": str(message.pk),
            "created_conversation": created_conversation,
            "contact_access_granted": created_grant,
            "notification_count": len(notification_ids),
        },
        request_id=request_id,
    )

    # Step 6 - post-commit fan-out. The email job was registered by
    # create_notification(); this signal is the seam Phase 18's WebSocket push
    # attaches to (spec 27.2).
    transaction.on_commit(
        lambda: inquiry_received.send(
            sender=Message,
            conversation=conversation,
            message=message,
            notification_ids=notification_ids,
        )
    )

    return InquiryResult(
        conversation=conversation,
        message=message,
        contact_access=(
            ContactAccessOutcome.GRANTED
            if grant is not None
            else ContactAccessOutcome.NOT_APPLICABLE
        ),
        next_url=conversation_url(conversation.pk),
        created_conversation=created_conversation,
        created_grant=created_grant,
    )


def _reply_display_name(actor) -> str:
    """The replier's stated name, or the empty string - NEVER their email.

    `actor.full_name` and nothing else. Do not reach for `User.get_full_name()`
    or `get_short_name()`: both are `self.full_name or self.email`
    (accounts/models.py), so an account that never set a name would put its
    EMAIL ADDRESS into `Message.sender_name_snapshot`, which
    `MessageSerializer.get_sender()["display_name"]` and
    `ConversationSerializer.get_counterparty_name()` hand straight to the other
    party. `accounts.services.register_user` defaults `full_name=""`, so this is
    the common case, not an edge one - and spec 15.1's Full name field exists on
    the inquiry form precisely because an account name is not guaranteed.

    An empty string is returned rather than a fabricated English placeholder:
    backend-generated user-visible text must be a translation key, not a
    concatenated literal (spec 37). The thread UI renders
    `inquiry.sender_unnamed` for a blank name (Phase 19), and the notification
    email substitutes its own per-locale fallback in notifications/tasks.py.

    TRUNCATED to FULL_NAME_MAX_LENGTH, and that is not defensive padding:
    `accounts.User.full_name` is `max_length=150` while spec 15.1 caps the
    inquiry form's Full name at 120, which is what `Message.sender_name_snapshot`
    is sized to. An account carrying a 121-150 character name would otherwise
    raise `DataError: value too long for type character varying(120)` inside
    post_reply's transaction, rolling back a message the sender was told nothing
    about. Truncating is the right call rather than widening the column: 120 is
    the spec's number for this field, and every INQUIRY row already obeys it, so
    widening would let replies hold names no inquiry could.
    """
    return (actor.full_name or "").strip()[:FULL_NAME_MAX_LENGTH]


@transaction.atomic
def post_reply(*, actor, conversation, body, request_id=None) -> Message:
    """A reply inside an existing thread (spec 30.1's POST .../messages/).

    Authorization is the CALLER's job - messaging.selectors.can_view_conversation
    decides who may see a thread, and the view refuses before reaching here.
    This function owns what happens once they may.
    """
    if conversation.status != ConversationStatus.OPEN:
        raise ConversationClosed()

    _refuse_duplicate(conversation, actor, body)

    message = Message.objects.create(
        conversation=conversation,
        sender=actor,
        body=body,
        sender_email_snapshot=actor.email,
        sender_name_snapshot=_reply_display_name(actor),
        sender_phone_snapshot="",
        is_system=False,
        # Empty on purpose: consent belongs to the inquiry, not to every reply.
        privacy_policy_version="",
        marketing_consent=False,
    )
    conversation.last_message_at = message.created_at
    conversation.save(update_fields=["last_message_at", "updated_at"])

    recipient_side, recipient_email = conversation_recipients(conversation)
    if actor.pk == conversation.initiator_id:
        recipients, email_to = recipient_side, recipient_email
    else:
        recipients, email_to = [conversation.initiator], conversation.initiator.email

    context_type, context_label = conversation_context(conversation)
    notification_ids = _dispatch_notifications(
        recipients=recipients,
        email_to=email_to,
        conversation=conversation,
        message=message,
        context_type=context_type,
        context_label=context_label,
    )

    transaction.on_commit(
        lambda: inquiry_received.send(
            sender=Message,
            conversation=conversation,
            message=message,
            notification_ids=notification_ids,
        )
    )
    return message


@transaction.atomic
def mark_conversation_read(*, actor, conversation) -> int:
    """Marks every message the actor did NOT send as read, and returns how many
    changed. Spec 11.8 gives Message one read_at, so this means "read by the
    recipient side" for a broker team - see the plan's Known Limitations."""
    return (
        conversation.messages.filter(read_at__isnull=True)
        .exclude(sender=actor)
        .update(read_at=timezone.now())
    )
