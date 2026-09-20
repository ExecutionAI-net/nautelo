import hashlib
import hmac
import secrets
from dataclasses import dataclass
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from accounts.enums import Locale, SellerType, StaffGroup, UserRole
from accounts.models import EmailVerificationToken, PasswordResetToken, User
from accounts.tasks import send_email_verification_email, send_password_reset_email

EMAIL_VERIFICATION_TOKEN_TTL = timedelta(hours=24)

# How long a just-consumed token keeps re-affirming success on replay. Wide
# enough to cover a link-scanner prefetch, a double-click, or a browser
# retry, which all land within moments of the original request; narrow
# enough that an old link sitting in mail archives or browser history can't
# be replayed indefinitely to pull the account's PII out of the response.
EMAIL_VERIFICATION_REPLAY_WINDOW = timedelta(seconds=60)


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
    """Single-use consumption under a row lock (spec 2.3).

    A token that resolves by hash but was already used within
    EMAIL_VERIFICATION_REPLAY_WINDOW is replayed, not rejected: a mail client
    or corporate link-scanner prefetching the link, a double-click, or a
    browser retry all resend the exact same token moments after it already
    verified the account. Erroring on that replay would tell a
    genuinely-verified user their verification failed, so it re-affirms
    success instead. Outside that window - or for a token that never existed
    for this hash, or one that expired before ever being used - it's a real
    failure, same as before.
    """
    token = (
        EmailVerificationToken.objects.select_for_update()
        .filter(token_hash=hash_verification_token(raw_token or ""))
        .first()
    )
    now = timezone.now()
    if token is None:
        raise ValidationError({"token": ["invalid_verification_token"]})
    if token.used_at is not None:
        if now - token.used_at <= EMAIL_VERIFICATION_REPLAY_WINDOW:
            return User.objects.get(pk=token.user_id)
        raise ValidationError({"token": ["invalid_verification_token"]})

    if token.expires_at <= now:
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


def revoke_refresh_tokens(user: User) -> int:
    """Blacklist every outstanding refresh token so a changed password ends all
    other sessions (a thief holding an old session loses it)."""
    from rest_framework_simplejwt.token_blacklist.models import (
        BlacklistedToken,
        OutstandingToken,
    )

    count = 0
    for outstanding in OutstandingToken.objects.filter(user=user):
        _, created = BlacklistedToken.objects.get_or_create(token=outstanding)
        count += int(created)
    return count


PASSWORD_RESET_TOKEN_TTL = timedelta(hours=1)


def queue_password_reset(user: User) -> None:
    """Issue a reset token and email it after commit. Older open tokens die."""
    raw_token = secrets.token_urlsafe(32)
    now = timezone.now()
    PasswordResetToken.objects.filter(user=user, used_at__isnull=True).update(used_at=now)
    PasswordResetToken.objects.create(
        user=user,
        token_hash=hash_verification_token(raw_token),
        expires_at=now + PASSWORD_RESET_TOKEN_TTL,
    )
    transaction.on_commit(
        lambda: send_password_reset_email.apply_async(
            args=[str(user.pk), raw_token], queue="notifications"
        )
    )


@transaction.atomic
def reset_password(raw_token: str, new_password: str) -> User:
    """Single-use consumption under a row lock. Every failure is the same
    `invalid_reset_token` so a caller learns nothing about which tokens exist."""
    token = (
        PasswordResetToken.objects.select_for_update()
        .filter(token_hash=hash_verification_token(raw_token or ""))
        .first()
    )
    now = timezone.now()
    if token is None or token.used_at is not None or token.expires_at <= now:
        raise ValidationError({"token": ["invalid_reset_token"]})
    user = User.objects.select_for_update().get(pk=token.user_id)
    if not user.is_active:
        raise ValidationError({"token": ["invalid_reset_token"]})
    from django.contrib.auth.password_validation import validate_password
    from django.core.exceptions import ValidationError as DjangoValidationError

    try:
        validate_password(new_password, user)
    except DjangoValidationError as exc:
        raise ValidationError({"password": list(exc.messages)}) from exc
    user.set_password(new_password)
    user.save(update_fields=["password", "updated_at"])
    PasswordResetToken.objects.filter(user=user, used_at__isnull=True).update(used_at=now)
    revoke_refresh_tokens(user)
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
        primary_role=primary_role or UserRole.PRIVATE_SELLER,
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


def active_broker_membership(user, broker_id):
    """The user's live membership of an ACTIVE broker, or None (spec 12 item 5).

    Suspending an organization makes this return None for every one of its
    members, so every capability routed through it disappears at once without
    each caller repeating the status check.
    """
    # Function-local: accounts.services is imported by brokers.admin, so a
    # module-level brokers import would be an app-loading cycle. See the note
    # at the bottom of this section.
    from brokers.enums import BrokerOrganizationStatus
    from brokers.models import BrokerMembership

    if not _usable(user) or broker_id is None:
        return None
    return (
        BrokerMembership.objects.select_related("broker")
        .filter(
            user=user,
            broker_id=broker_id,
            is_active=True,
            broker__status=BrokerOrganizationStatus.ACTIVE,
        )
        .first()
    )


def has_any_broker_edit_membership(user) -> bool:
    from brokers.enums import BrokerOrganizationStatus
    from brokers.models import BrokerMembership

    if not _usable(user):
        return False
    return BrokerMembership.objects.filter(
        user=user,
        is_active=True,
        can_edit_listings=True,
        broker__status=BrokerOrganizationStatus.ACTIVE,
    ).exists()


def can_edit_owned_object(user, *, owner_user_id, broker_id) -> bool:
    """Server-side ownership resolution for any owner_user/broker-scoped record.

    Takes plain identifiers rather than a model instance so it can be unit-tested
    exhaustively before any listing model exists; IsOwnerOrBrokerEditor is the
    thin DRF adapter over it.
    """
    if not _usable(user):
        return False
    if is_staff_admin(user):
        return True
    # str() on both sides: owner_user_id is a plain identifier, so it may reach
    # this function as a string (a URL path kwarg, or a JSON-decoded body) while
    # user.pk is always a UUID object. UUID(x) == str(x) is False, which would
    # deny the real owner access to their own record.
    if owner_user_id is not None and str(owner_user_id) == str(user.pk):
        return True
    if broker_id is not None:
        membership = active_broker_membership(user, broker_id)
        return membership is not None and membership.can_edit_listings
    return False


def can_read_broker_messages(user, broker_id) -> bool:
    """Gates on `can_read_messages` ONLY - never on `can_edit_listings`.

    The two capability flags are independent by design: an AGENT typically holds
    can_edit_listings=True with can_read_messages=False and must not reach a
    broker's conversations as a side effect of being able to edit its listings.
    """
    if is_staff_moderator(user):
        return True
    membership = active_broker_membership(user, broker_id)
    return membership is not None and membership.can_read_messages


def can_manage_broker_team(user, broker_id) -> bool:
    if is_staff_admin(user):
        return True
    membership = active_broker_membership(user, broker_id)
    return membership is not None and membership.can_manage_team


@dataclass(frozen=True)
class SellerContext:
    """Who a listing belongs to. Derived on the server, never read from the client."""

    seller_type: str
    owner_user: User | None
    broker: object | None


def resolve_seller_context(user, *, broker_id=None) -> SellerContext:
    """Resolve listing ownership exclusively on the server (spec 12 item 2).

    The caller passes at most a broker id. seller_type is never accepted from the
    client: it is a consequence of which broker (if any) this user may act for.
    """
    if not _usable(user):
        raise PermissionDenied(
            detail="Authentication is required.", code="authentication_required"
        )
    if not user.is_email_verified:
        raise PermissionDenied(
            detail="Verify your email address first.", code="email_not_verified"
        )

    if broker_id is None:
        if user.primary_role == UserRole.PRIVATE_SELLER or is_staff_admin(user):
            return SellerContext(
                seller_type=SellerType.PRIVATE, owner_user=user, broker=None
            )
        raise PermissionDenied(
            detail="This account cannot create private-seller listings.",
            code="private_listing_not_allowed",
        )

    membership = active_broker_membership(user, broker_id)
    if membership is not None and membership.can_edit_listings:
        return SellerContext(
            seller_type=SellerType.BROKER, owner_user=None, broker=membership.broker
        )

    if is_staff_admin(user):
        from brokers.enums import BrokerOrganizationStatus
        from brokers.models import BrokerOrganization

        broker = BrokerOrganization.objects.filter(
            pk=broker_id, status=BrokerOrganizationStatus.ACTIVE
        ).first()
        if broker is not None:
            return SellerContext(
                seller_type=SellerType.BROKER, owner_user=None, broker=broker
            )

    raise PermissionDenied(
        detail="This account cannot create listings for that broker.",
        code="broker_listing_not_allowed",
    )


def broker_membership_in(user, broker_id, statuses=None):
    """The user's live membership of this broker whatever its status (or one of `statuses`).

    Onboarding needs this: a brokerage that is still DRAFT/PENDING (or was
    suspended for non-payment) must still let its own members finish the
    profile, invite the team and pay. Public capabilities keep using
    `active_broker_membership`, which requires an ACTIVE brokerage.
    """
    from brokers.models import BrokerMembership

    if not _usable(user) or broker_id is None:
        return None
    query = BrokerMembership.objects.select_related("broker").filter(
        user=user, broker_id=broker_id, is_active=True
    )
    if statuses is not None:
        query = query.filter(broker__status__in=statuses)
    return query.first()
