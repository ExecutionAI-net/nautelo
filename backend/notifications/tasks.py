"""Email delivery for notifications (spec 27.3).

Subjects and bodies are per-locale dictionaries rather than concatenated English
(spec 37). The pattern mirrors accounts/tasks.py, which is the project's one
existing transactional-email task.

Nothing here logs the destination address or the message text: the address is a
broker's contact detail (spec 16) and the excerpt is private correspondence, so
the log line carries the notification ID and the exception CLASS and nothing
else. `str(exc)` is deliberately never logged - an SMTP library routinely puts
the rejected address into its own message.
"""

import logging

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from emailing.services import render_email
from notifications.copy import text_for
from notifications.enums import DeliveryChannel, DeliveryStatus, NotificationType
from notifications.models import Notification, NotificationDelivery

#: Maps a NotificationType to the emailing.models.TEMPLATE_KEYS entry a staff
#: editor can author HTML for. A type absent here (there are none today, but a
#: newly appended NotificationType starts absent until someone adds it) simply
#: never gets an HTML version - the plain-text body below still sends.
TEMPLATE_KEY_BY_TYPE = {
    NotificationType.INQUIRY_RECEIVED: "new_message",
    NotificationType.LISTING_APPROVED: "listing_approved",
    NotificationType.LISTING_CHANGES_REQUESTED: "listing_changes_requested",
    NotificationType.LISTING_REJECTED: "listing_rejected",
    NotificationType.LISTING_EXPIRING: "listing_expiring",
    NotificationType.LISTING_EXPIRED: "listing_expired",
    NotificationType.BROKER_TRIAL_STARTED: "broker_trial_started",
    NotificationType.BROKER_PAYMENT_FAILED: "broker_payment_failed",
    NotificationType.BROKER_SUSPENDED: "broker_suspended",
    NotificationType.PAYMENT_FULFILLED: "payment_fulfilled",
    NotificationType.PROFESSIONAL_ACTIVATED: "professional_activated",
    NotificationType.PROFESSIONAL_PAYMENT_FAILED: "professional_payment_failed",
    NotificationType.PROFESSIONAL_DEACTIVATED: "professional_deactivated",
    NotificationType.PAYMENT_FULFILLMENT_FAILED: "payment_fulfillment_failed",
}

logger = logging.getLogger(__name__)

SUBJECTS = {
    "EN": "New message on Nautelo",
    "IT": "Nuovo messaggio su Nautelo",
    "ES": "Nuevo mensaje en Nautelo",
}
# Used when the sender's account carries no name. Never their email address:
# messaging._reply_display_name deliberately stores "" rather than letting
# User.get_full_name()'s `full_name or email` fallback leak an address into a
# message another party reads. Per-locale, not a concatenated literal (spec 37).
SENDER_FALLBACK = {
    "EN": "A Nautelo user",
    "IT": "Un utente Nautelo",
    "ES": "Un usuario de Nautelo",
}
BODIES = {
    "EN": (
        "{sender} sent you a message about {context} on Nautelo.\n\n"
        "{excerpt}\n\n"
        "Read and reply on Nautelo:\n{url}\n\n"
        "Reply through Nautelo so the conversation stays on the platform."
    ),
    "IT": (
        "{sender} ti ha inviato un messaggio su {context} tramite Nautelo.\n\n"
        "{excerpt}\n\n"
        "Leggi e rispondi su Nautelo:\n{url}\n\n"
        "Rispondi tramite Nautelo per mantenere la conversazione sulla piattaforma."
    ),
    "ES": (
        "{sender} te ha enviado un mensaje sobre {context} en Nautelo.\n\n"
        "{excerpt}\n\n"
        "Lee y responde en Nautelo:\n{url}\n\n"
        "Responde a traves de Nautelo para mantener la conversacion en la plataforma."
    ),
}

#: Spec 27.3: "Retries are bounded." One original attempt plus this many.
MAX_RETRIES = 3
RETRY_DELAY_SECONDS = 60


@shared_task(
    queue="notifications",
    bind=True,
    max_retries=MAX_RETRIES,
    default_retry_delay=RETRY_DELAY_SECONDS,
)
def send_notification_email(self, notification_id: str, to_email: str) -> None:
    notification = (
        Notification.objects.select_related("recipient")
        .filter(pk=notification_id)
        .first()
    )
    if notification is None:
        # Spec 27.3: a permanent failure is visible without rolling anything back.
        logger.warning(
            "notification email skipped: notification %s no longer exists",
            notification_id,
        )
        return

    locale = notification.recipient.locale
    if locale not in SUBJECTS:
        locale = "EN"

    payload = notification.payload or {}
    url = f"{settings.PUBLIC_BASE_URL}{notification.target_url}"
    generic = text_for(notification.notification_type, locale)
    if notification.notification_type == NotificationType.INQUIRY_RECEIVED or generic is None:
        subject = SUBJECTS[locale]
        body = BODIES[locale].format(
            sender=payload.get("sender_display_name") or SENDER_FALLBACK[locale],
            context=payload.get("context_label", ""),
            excerpt=payload.get("excerpt", ""),
            url=url,
        )
    else:
        # Spec 27.3: a safe summary and a signed-in platform URL, nothing else.
        subject, summary = generic
        body = f"{summary}\n\n{url}"

    html_body = None
    template_key = TEMPLATE_KEY_BY_TYPE.get(notification.notification_type)
    if template_key is not None:
        context = (
            {
                "sender": payload.get("sender_display_name") or SENDER_FALLBACK[locale],
                "context": payload.get("context_label", ""),
                "excerpt": payload.get("excerpt", ""),
                "url": url,
            }
            if notification.notification_type == NotificationType.INQUIRY_RECEIVED
            else {"url": url}
        )
        rendered = render_email(template_key, locale, context)
        if rendered is not None:
            subject, html_body = rendered

    delivery, _ = NotificationDelivery.objects.get_or_create(
        notification=notification, channel=DeliveryChannel.EMAIL
    )
    if delivery.status == DeliveryStatus.SENT:
        # Spec 27's acceptance test: a retried task must not duplicate a
        # delivery. Celery redelivers on worker loss AFTER the send succeeded
        # just as readily as after it failed, and the broker cannot tell the two
        # apart - so the only safe answer is to make the second run a no-op.
        logger.info(
            "notification email already sent; skipping retry",
            extra={"notification_id": str(notification.pk)},
        )
        return
    delivery.attempt_count += 1
    try:
        send_mail(
            subject=subject,
            message=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[to_email],
            html_message=html_body,
        )
    except Exception as exc:  # noqa: BLE001 - re-raised via Celery's retry below
        delivery.status = DeliveryStatus.FAILED
        delivery.last_error_code = type(exc).__name__[:64]
        delivery.save(
            update_fields=["status", "last_error_code", "attempt_count", "updated_at"]
        )
        # Spec 27.3: "Retries are bounded." Never log the message body, and
        # never str(exc) - only the class name.
        logger.warning(
            "notification email failed",
            extra={
                "notification_id": str(notification.pk),
                "error": type(exc).__name__,
            },
        )
        raise self.retry(exc=exc)

    delivery.status = DeliveryStatus.SENT
    delivery.sent_at = timezone.now()
    delivery.save(update_fields=["status", "sent_at", "attempt_count", "updated_at"])
    logger.info(
        "notification email sent", extra={"notification_id": str(notification.pk)}
    )


@shared_task(queue="notifications", bind=True, max_retries=MAX_RETRIES)
def push_notification_ws(self, notification_id: str) -> None:
    """Spec 27.2: publish to the recipient's group. Idempotent - a delivery that
    is already SENT is left alone. A missing channel layer marks the delivery
    SKIPPED; the notification stays readable over REST either way."""
    from notifications.push import push_to_user

    notification = Notification.objects.filter(pk=notification_id).first()
    if notification is None:
        return
    delivery, _ = NotificationDelivery.objects.get_or_create(
        notification=notification, channel=DeliveryChannel.WEBSOCKET
    )
    if delivery.status in (DeliveryStatus.SENT, DeliveryStatus.SKIPPED):
        return
    delivery.attempt_count += 1
    try:
        published = push_to_user(notification)
    except Exception as exc:  # noqa: BLE001 - retried below
        delivery.status = DeliveryStatus.FAILED
        delivery.last_error_code = type(exc).__name__[:64]
        delivery.save(
            update_fields=["status", "last_error_code", "attempt_count", "updated_at"]
        )
        raise self.retry(exc=exc, countdown=RETRY_DELAY_SECONDS)
    delivery.status = DeliveryStatus.SENT if published else DeliveryStatus.SKIPPED
    delivery.sent_at = timezone.now() if published else None
    delivery.save(update_fields=["status", "sent_at", "attempt_count", "updated_at"])
