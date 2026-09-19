"""Shared helpers for producers that notify people (spec 27.1).

Kept in `notifications` so the producers - which live in `listings` and
`payments`, because the dependency arrow is producer -> notifications and never
back - share one recipient lookup and one way to build a notification.
"""

from django.contrib.auth import get_user_model

from accounts.enums import StaffGroup
from notifications.copy import keys_for
from notifications.services import create_notification

STAFF_QUEUE_URL = "/dashboard/staff/"


def staff_users(*groups):
    User = get_user_model()
    return User.objects.filter(is_active=True, groups__name__in=groups).distinct()


def moderation_staff():
    """Moderators and admins. Taxonomy decisions (spec 13.3) belong to the same
    two tiers - the project has no separate taxonomy group."""
    return staff_users(StaffGroup.MODERATOR, StaffGroup.ADMIN)


def admin_staff():
    return staff_users(StaffGroup.ADMIN)


def notify(user, notification_type, *, target_url, payload, dedupe_key):
    title_key, body_key = keys_for(notification_type)
    return create_notification(
        recipient=user,
        notification_type=notification_type,
        title_key=title_key,
        body_key=body_key,
        target_url=target_url,
        payload=payload,
        email_to=user.email,
        dedupe_key=dedupe_key,
    )
