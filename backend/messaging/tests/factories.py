from messaging.enums import (
    CURRENT_PRIVACY_POLICY_VERSION,
    ConversationStatus,
    ConversationType,
)
from messaging.models import ContactAccessGrant, Conversation, Message


def make_conversation(
    *,
    initiator,
    conversation_type=ConversationType.BROKER_INQUIRY,
    broker=None,
    professional=None,
    listing=None,
    subject="Question about your services",
    status=ConversationStatus.OPEN,
    **extra,
):
    return Conversation.objects.create(
        initiator=initiator,
        conversation_type=conversation_type,
        broker=broker,
        professional=professional,
        listing=listing,
        subject=subject,
        status=status,
        **extra,
    )


def make_message(
    *,
    conversation,
    sender,
    body="I would like to arrange a viewing next week please.",
    sender_email_snapshot=None,
    sender_name_snapshot="Ada Rossi",
    sender_phone_snapshot="",
    is_system=False,
    privacy_policy_version=CURRENT_PRIVACY_POLICY_VERSION,
    marketing_consent=False,
    **extra,
):
    return Message.objects.create(
        conversation=conversation,
        sender=sender,
        body=body,
        sender_email_snapshot=(
            sender.email if sender_email_snapshot is None else sender_email_snapshot
        ),
        sender_name_snapshot=sender_name_snapshot,
        sender_phone_snapshot=sender_phone_snapshot,
        is_system=is_system,
        privacy_policy_version=privacy_policy_version,
        marketing_consent=marketing_consent,
        **extra,
    )


def make_grant(
    *,
    viewer,
    target_type,
    source_conversation,
    broker=None,
    professional=None,
    **extra,
):
    return ContactAccessGrant.objects.create(
        viewer=viewer,
        target_type=target_type,
        broker=broker,
        professional=professional,
        source_conversation=source_conversation,
        **extra,
    )
