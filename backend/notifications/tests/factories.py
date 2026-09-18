from notifications.enums import NotificationType
from notifications.services import create_notification


def make_notification(
    *,
    recipient,
    notification_type=NotificationType.INQUIRY_RECEIVED,
    title_key="notification.inquiry_received.title",
    body_key="notification.inquiry_received.body",
    target_url="/dashboard/messages/00000000-0000-4000-8000-000000000000/",
    payload=None,
    email_to="",
    dedupe_key="",
):
    return create_notification(
        recipient=recipient,
        notification_type=notification_type,
        title_key=title_key,
        body_key=body_key,
        target_url=target_url,
        payload=payload,
        email_to=email_to,
        dedupe_key=dedupe_key,
    )
