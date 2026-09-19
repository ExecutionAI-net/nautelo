"""Messaging domain signals.

`inquiry_received` is the seam spec 27.2's WebSocket push attaches to. It is
sent from INSIDE transaction.on_commit(), so a receiver never fires for a
rolled-back inquiry and never needs its own transaction check - the same
contract listings.signals established in Phase 11 (its contract rule 8).

Kwargs:
    sender: the messaging.models.Message class (Django requires a sender; the
            model class keeps `sender=` stable for receivers that filter on it).
    conversation: messaging.models.Conversation
    message: messaging.models.Message
    notification_ids: list[str] - the Notification rows already created in-app.
"""

from django.dispatch import Signal

inquiry_received = Signal()
