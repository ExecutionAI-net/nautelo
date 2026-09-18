"""Phase 7's one-call grant fixture.

Phase 6 already ships `make_grant`, but it requires a `source_conversation`
that every Phase 7 test would otherwise have to build by hand — with the right
`conversation_type`, because `Conversation` constrains the context combination.
This wraps both. It lives in its own module rather than being appended to
Phase 6's `factories.py` so this phase never edits a file another phase owns.
"""

from messaging.enums import ContactTargetType, ConversationType
from messaging.tests.factories import make_conversation, make_grant


def make_contact_grant(
    *,
    viewer,
    broker=None,
    professional=None,
    conversation=None,
    granted_at=None,
    revoked_at=None,
):
    if (broker is None) == (professional is None):
        raise ValueError("Pass exactly one of broker= or professional=.")
    is_broker = broker is not None
    extra = {}
    if granted_at is not None:
        extra["granted_at"] = granted_at
    if revoked_at is not None:
        extra["revoked_at"] = revoked_at
    return make_grant(
        viewer=viewer,
        target_type=(
            ContactTargetType.BROKER if is_broker else ContactTargetType.PROFESSIONAL
        ),
        broker=broker,
        professional=professional,
        source_conversation=conversation
        or make_conversation(
            initiator=viewer,
            conversation_type=(
                ConversationType.BROKER_INQUIRY
                if is_broker
                else ConversationType.PROFESSIONAL_INQUIRY
            ),
            broker=broker,
            professional=professional,
        ),
        **extra,
    )
