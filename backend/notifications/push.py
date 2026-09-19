"""WebSocket push for notifications (spec 27.2).

The socket is an acceleration channel, never the source of truth: every
notification is already a database row by the time it is pushed, and a client
that missed a push (offline, reconnecting) reads it back over REST.

Group names are derived here from the user id with an HMAC keyed by SECRET_KEY.
A client can neither choose nor guess one, and the consumer subscribes a socket
to exactly one group - its own authenticated user's.
"""

import hashlib
import hmac

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings


def user_group_name(user_id) -> str:
    digest = hmac.new(
        settings.SECRET_KEY.encode(), f"notif:{user_id}".encode(), hashlib.sha256
    ).hexdigest()
    return f"notif.{digest[:40]}"


def notification_message(notification) -> dict:
    """Spec 27.2's payload: id, type, text keys, target URL, created timestamp."""
    return {
        "id": str(notification.pk),
        "type": notification.notification_type,
        "title_key": notification.title_key,
        "body_key": notification.body_key,
        "payload": notification.payload or {},
        "target_url": notification.target_url,
        "created_at": notification.created_at.isoformat(),
    }


def push_to_user(notification) -> bool:
    """Publish to the recipient's group. False when no channel layer is
    configured; a broker outage raises so the Celery task can retry."""
    layer = get_channel_layer()
    if layer is None:
        return False
    async_to_sync(layer.group_send)(
        user_group_name(notification.recipient_id),
        {"type": "notification.message", "payload": notification_message(notification)},
    )
    return True
