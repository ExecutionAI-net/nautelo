from messaging.enums import ConversationStatus, ConversationType
from messaging.models import Conversation


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
