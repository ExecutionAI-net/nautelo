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
    ContactAccessOutcome,
    ConversationStatus,
    conversation_url,
)
from messaging.exceptions import ConsentRequired, MessagingThrottled
from messaging.models import ContactAccessGrant, Conversation, Message
from messaging.selectors import active_contact_grant
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


def _notify_recipients(context, conversation, message) -> list[str]:
    """Spec 15.4. In-app goes to every recipient; the email goes to exactly one
    address, carried by exactly one of those notifications."""
    recipients = list(context.recipient_users)
    if not recipients:
        # Truthful consequence of can_read_messages defaulting to False: nobody
        # at this organization can read messages, so nobody is told. The
        # conversation is still real and appears the moment staff grants the
        # capability. Surfaced as a warning so spec 33.4's alerting can see it.
        logger.warning(
            "inquiry has no in-app recipient",
            extra={"conversation_id": str(conversation.pk)},
        )
        return []

    # Deterministic: prefer the recipient whose own account address IS the
    # configured address (the private-seller and professional-owner cases), so
    # one person does not receive both the in-app row and an email that reads as
    # if it were meant for a shared inbox. Otherwise the lowest pk, because
    # broker_message_readers() orders by pk.
    email_index = 0
    for index, user in enumerate(recipients):
        if user.email == context.recipient_email:
            email_index = index
            break

    payload = {
        "conversation_id": str(conversation.pk),
        "message_id": str(message.pk),
        "context_type": context.context_type,
        "context_label": context.context_label,
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
            email_to=(
                context.recipient_email
                if index == email_index and context.recipient_email
                else ""
            ),
        )
        notification_ids.append(str(notification.pk))
    return notification_ids


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
