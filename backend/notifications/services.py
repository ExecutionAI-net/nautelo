"""Notification creation (spec 11.10, 15.3 steps 5-6, 27.3)."""

from django.db import IntegrityError, transaction
from django.utils import timezone

from notifications.enums import (
    NO_WEBSOCKET_TYPES,
    DeliveryChannel,
    DeliveryStatus,
)
from notifications.models import (
    Notification,
    NotificationDelivery,
    NotificationPreference,
)


def _find_deduplicated(*, recipient, notification_type, dedupe_key):
    """The one lookup the partial unique index mirrors.

    A named function rather than an inline queryset so the create race below can
    be forced in a test: nothing else reproduces "my SELECT ran before the other
    worker's INSERT committed" deterministically.
    """
    return Notification.objects.filter(
        recipient=recipient,
        notification_type=notification_type,
        dedupe_key=dedupe_key,
    ).first()


def _email_enabled(user) -> bool:
    preference = NotificationPreference.objects.filter(user=user).first()
    return preference is None or preference.email_enabled


def create_notification(
    *,
    recipient,
    notification_type: str,
    title_key: str,
    body_key: str,
    target_url: str,
    payload: dict | None = None,
    email_to: str = "",
    dedupe_key: str = "",
) -> Notification:
    """Create one in-app notification and, when an address is given, queue its
    email for AFTER the surrounding transaction commits (spec 27.3: "Queue only
    after commit"; spec 2.3: "Notifications are scheduled through
    transaction.on_commit()").

    IDEMPOTENT on `dedupe_key` (spec 27.1's per-event "Deduplication key"; for
    `inquiry.received` that key is the message ID). A second call with the same
    (recipient, type, key) returns the EXISTING row and queues no second email -
    which is what spec 27's acceptance test "Retried task does not create
    duplicate in-app notification/delivery" asks for, and what makes a retried
    or replayed caller safe. A lookup AND the partial unique index, not a bare
    existence check: two workers can race past the lookup, and only the index
    settles it.

    The INSERT runs in its own `atomic()` block so that losing that race is
    survivable. Callers invoke this from INSIDE their own transaction (spec
    15.3), and an IntegrityError raised in an atomic block with no savepoint
    marks the whole transaction broken - every later statement would then fail
    with TransactionManagementError and the caller would lose its business write
    to a notification detail. The nested block rolls back to a savepoint
    instead, leaving the caller's transaction intact.

    A rolled-back business transaction leaves no notification, no email and
    no WebSocket push: both are queued with transaction.on_commit().
    """
    fields = {
        "recipient": recipient,
        "notification_type": notification_type,
        "dedupe_key": dedupe_key,
        "title_key": title_key,
        "body_key": body_key,
        "target_url": target_url,
        "payload": payload or {},
    }
    lookup = {
        "recipient": recipient,
        "notification_type": notification_type,
        "dedupe_key": dedupe_key,
    }

    if dedupe_key:
        existing = _find_deduplicated(**lookup)
        if existing is not None:
            # Already delivered once. Returning early is the whole point: no
            # second IN_APP row (the unique(notification, channel) constraint
            # would refuse it anyway) and, more importantly, no second email.
            return existing
        try:
            with transaction.atomic():
                notification = Notification.objects.create(**fields)
        except IntegrityError:
            winner = _find_deduplicated(**lookup)
            if winner is None:
                # Not the dedupe index: something else refused this row and
                # swallowing it would hide a real defect.
                raise
            return winner
    else:
        notification = Notification.objects.create(**fields)

    NotificationDelivery.objects.create(
        notification=notification,
        channel=DeliveryChannel.IN_APP,
        status=DeliveryStatus.SENT,
        attempt_count=1,
        sent_at=timezone.now(),
    )

    if notification_type not in NO_WEBSOCKET_TYPES:
        NotificationDelivery.objects.create(
            notification=notification,
            channel=DeliveryChannel.WEBSOCKET,
            status=DeliveryStatus.QUEUED,
        )
        from notifications.tasks import push_notification_ws

        push_id = str(notification.pk)
        transaction.on_commit(lambda: push_notification_ws.delay(push_id))

    if email_to and _email_enabled(recipient):
        NotificationDelivery.objects.create(
            notification=notification,
            channel=DeliveryChannel.EMAIL,
            status=DeliveryStatus.QUEUED,
        )
        notification_id = str(notification.pk)
        # Imported here, not at module scope: notifications.tasks imports this
        # module's models, and a module-level import in both directions is a
        # cycle Celery's autodiscovery would hit at worker start-up.
        from notifications.tasks import send_notification_email

        transaction.on_commit(
            lambda: send_notification_email.delay(notification_id, email_to)
        )

    return notification
