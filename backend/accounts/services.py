import hashlib
import hmac
import secrets
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from accounts.enums import Locale, StaffGroup, UserRole
from accounts.models import EmailVerificationToken, User
from accounts.tasks import send_email_verification_email

EMAIL_VERIFICATION_TOKEN_TTL = timedelta(hours=24)


def hash_verification_token(raw_token: str) -> str:
    return hmac.new(
        settings.SECRET_KEY.encode(), raw_token.encode(), hashlib.sha256
    ).hexdigest()


def issue_email_verification_token(user: User) -> str:
    """Create a token row and return the RAW token. Only the hash is persisted."""
    raw_token = secrets.token_urlsafe(32)
    EmailVerificationToken.objects.create(
        user=user,
        token_hash=hash_verification_token(raw_token),
        expires_at=timezone.now() + EMAIL_VERIFICATION_TOKEN_TTL,
    )
    return raw_token


@transaction.atomic
def consume_email_verification_token(raw_token: str) -> User:
    """Single-use consumption under a row lock (spec 2.3)."""
    token = (
        EmailVerificationToken.objects.select_for_update()
        .filter(token_hash=hash_verification_token(raw_token or ""))
        .first()
    )
    now = timezone.now()
    if token is None or token.used_at is not None or token.expires_at <= now:
        raise ValidationError({"token": ["invalid_verification_token"]})

    token.used_at = now
    token.save(update_fields=["used_at", "updated_at"])

    EmailVerificationToken.objects.filter(user_id=token.user_id, used_at__isnull=True).update(
        used_at=now, updated_at=now
    )

    user = User.objects.select_for_update().get(pk=token.user_id)
    if user.email_verified_at is None:
        user.email_verified_at = now
        user.save(update_fields=["email_verified_at", "updated_at"])
    return user


def queue_email_verification(user: User) -> None:
    """Issue a token and schedule the email AFTER the transaction commits (spec 1)."""
    raw_token = issue_email_verification_token(user)
    transaction.on_commit(
        lambda: send_email_verification_email.apply_async(
            args=[str(user.pk), raw_token], queue="notifications"
        )
    )


@transaction.atomic
def register_user(*, email, password, full_name="", locale=None, primary_role=None) -> User:
    user = User.objects.create_user(
        email=email,
        password=password,
        full_name=full_name,
        locale=locale or Locale.EN,
        primary_role=primary_role or UserRole.BUYER,
    )
    queue_email_verification(user)
    return user


def _usable(user) -> bool:
    return (
        user is not None
        and getattr(user, "is_authenticated", False)
        and getattr(user, "is_active", False)
    )


def _in_staff_group(user, *names) -> bool:
    return user.is_superuser or user.groups.filter(name__in=names).exists()


def is_staff_moderator(user) -> bool:
    """Staff moderator or above (spec 5). The STAFF primary role is required."""
    if not _usable(user) or user.primary_role != UserRole.STAFF:
        return False
    return _in_staff_group(user, StaffGroup.MODERATOR, StaffGroup.ADMIN)


def is_staff_admin(user) -> bool:
    if not _usable(user) or user.primary_role != UserRole.STAFF:
        return False
    return _in_staff_group(user, StaffGroup.ADMIN)
