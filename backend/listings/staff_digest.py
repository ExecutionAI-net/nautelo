"""Daily moderation digest email for staff (spec 27.3).

One plain-text email per moderator or admin summarising the queue tabs, sent
only when something is waiting and only to staff who have not opted out of
email (`NotificationPreference.email_enabled`).
"""

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.db.models import Q

from accounts.enums import StaffGroup, UserRole
from notifications.models import NotificationPreference

from .staff_queue import queue_rows

LABELS = {
    "initial": "New listings awaiting review",
    "revisions": "Revisions awaiting review",
    "other_model": "Listings using the Other model",
    "suspended": "Suspended listings",
    "expiring": "Expiring or expired listings",
}


def digest_recipients():
    User = get_user_model()
    opted_out = NotificationPreference.objects.filter(email_enabled=False).values("user_id")
    return (
        User.objects.filter(is_active=True, primary_role=UserRole.STAFF)
        .filter(
            Q(is_superuser=True)
            | Q(groups__name__in=[StaffGroup.MODERATOR, StaffGroup.ADMIN])
        )
        .exclude(pk__in=opted_out)
        .exclude(email="")
        .distinct()
    )


def send_staff_digest() -> int:
    """Returns the number of emails sent."""
    _, counts = queue_rows(tab="initial")
    if not any(counts.values()):
        return 0
    lines = [f"{LABELS[key]}: {counts[key]}" for key in LABELS if counts.get(key)]
    body = "Moderation queue summary\n\n" + "\n".join(lines) + "\n"
    sent = 0
    for user in digest_recipients():
        send_mail(
            "NAUTA moderation digest",
            body,
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
        )
        sent += 1
    return sent
