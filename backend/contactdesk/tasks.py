"""Announce every stored public form submission to the team mailbox."""

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail

from emailing.services import render_email

from .models import ContactRequest

SUBJECT = "New {topic} request from {name} ({reference})"
BODY = (
    "A new request arrived through the website.\n\n"
    "Reference: {reference}\nTopic: {topic}\nName: {name}\nEmail: {email}\nPhone: {phone}\n"
    "Reply language: {language}\n\nMessage:\n{message}\n\nDetails:\n{details}\n\nHandle it here: {url}\n"
)


def reference_for(row) -> str:
    return f"NAU-{str(row.pk)[:8].upper()}"


def _details_text(details: dict) -> str:
    lines = []
    for key, value in details.items():
        if isinstance(value, dict):
            value = ", ".join(f"{k}={v}" for k, v in value.items())
        lines.append(f"{key}: {value}")
    return "\n".join(lines) or "-"


@shared_task(queue="notifications")
def notify_team_of_contact_request(request_id: str) -> None:
    row = ContactRequest.objects.filter(pk=request_id).first()
    if row is None or not settings.CONTACT_NOTIFY_EMAIL:
        return
    context = {
        "reference": reference_for(row),
        "topic": row.get_topic_display(),
        "name": row.name,
        "email": row.email,
        "phone": row.phone or "-",
        "language": row.reply_language,
        "message": row.message or "-",
        "details": _details_text(row.details),
        "url": f"{settings.PUBLIC_BASE_URL}/dashboard/staff/contact-requests/",
    }
    rendered = render_email("contact_request_received", "EN", context)
    send_mail(
        subject=rendered[0] if rendered else SUBJECT.format(**context),
        message=BODY.format(**context),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[settings.CONTACT_NOTIFY_EMAIL],
        html_message=rendered[1] if rendered else None,
    )
