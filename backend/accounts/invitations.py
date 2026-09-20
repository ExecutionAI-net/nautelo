"""Team invitations for broker and professional organizations.

An owner/admin invites an email address with a role. The invitee opens the
emailed link: a new address registers (name + password) straight into the
organization's role; an existing account signs in and accepts, and its role
changes to the organization's. A user belongs to at most one organization.
"""

import hashlib
import secrets
from datetime import timedelta

from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from accounts.enums import Locale, UserRole
from accounts.models import OrganizationInvitation, User, UserManager

INVITATION_TTL = timedelta(days=7)
ROLES = ("ADMIN", "MANAGER", "AGENT", "VIEWER")


def _hash(raw: str) -> str:
    return hashlib.sha256(f"{settings.SECRET_KEY}:invite:{raw}".encode()).hexdigest()


def _org_of(invitation):
    return invitation.broker if invitation.org_type == UserRole.BROKER else invitation.professional


def organization_name(invitation) -> str:
    org = _org_of(invitation)
    return getattr(org, "name", None) or getattr(org, "display_name", "")


def has_live_seat(user) -> bool:
    from brokers.models import BrokerMembership
    from professionals.models import ProfessionalMembership

    return (
        BrokerMembership.objects.filter(user=user, is_active=True).exists()
        or ProfessionalMembership.objects.filter(user=user, is_active=True).exists()
    )


def _capabilities(org_type, role) -> dict:
    if org_type == UserRole.BROKER:
        from brokers.enums import ROLE_DEFAULT_CAPABILITIES
    else:
        from professionals.enums import ROLE_DEFAULT_CAPABILITIES
    return dict(ROLE_DEFAULT_CAPABILITIES[role])


def create_invitation(*, actor, org_type, org, email, role) -> tuple[OrganizationInvitation, str]:
    """Issue (or re-issue) an invitation; returns it with the RAW token."""
    from accounts.tasks import send_invitation_email

    if role not in ROLES:
        raise ValidationError({"role": ["invalid_role"]})
    email = UserManager.normalize_email(email)
    # Only an ADMIN of the organization (or staff) may invite another ADMIN.
    if role == "ADMIN" and not _actor_is_admin(actor, org_type, org):
        raise PermissionDenied("Only an administrator can invite another administrator.")

    existing = User.objects.filter(email=email).first()
    if existing is not None:
        if existing.primary_role == UserRole.STAFF or existing.is_staff:
            raise ValidationError({"email": ["not_invitable"]})
        if has_live_seat(existing):
            raise ValidationError({"email": ["already_member"]})

    if org_type == UserRole.BROKER:
        from brokers.plans import ensure_seat_capacity

        ensure_seat_capacity(org)

    fk = {"broker": org} if org_type == UserRole.BROKER else {"professional": org}
    raw = secrets.token_urlsafe(32)
    with transaction.atomic():
        OrganizationInvitation.objects.filter(
            org_type=org_type, email=email, accepted_at__isnull=True, revoked_at__isnull=True, **fk
        ).update(revoked_at=timezone.now())
        invitation = OrganizationInvitation.objects.create(
            org_type=org_type,
            email=email,
            role=role,
            invited_by=actor,
            token_hash=_hash(raw),
            expires_at=timezone.now() + INVITATION_TTL,
            **fk,
        )
        transaction.on_commit(lambda: send_invitation_email.apply_async(args=[str(invitation.pk), raw], queue="notifications"))
    return invitation, raw


def _actor_is_admin(actor, org_type, org) -> bool:
    from accounts.services import is_staff_admin

    if is_staff_admin(actor):
        return True
    if org_type == UserRole.BROKER:
        from brokers.models import BrokerMembership as Seat

        return Seat.objects.filter(user=actor, broker=org, role="ADMIN", is_active=True).exists()
    from professionals.models import ProfessionalMembership as Seat

    return Seat.objects.filter(user=actor, profile=org, role="ADMIN", is_active=True).exists()


def pending_for(org_type, org):
    fk = {"broker": org} if org_type == UserRole.BROKER else {"professional": org}
    return OrganizationInvitation.objects.filter(
        org_type=org_type, accepted_at__isnull=True, revoked_at__isnull=True, expires_at__gt=timezone.now(), **fk
    ).select_related("invited_by")


def revoke_invitation(invitation) -> None:
    if invitation.accepted_at is None and invitation.revoked_at is None:
        invitation.revoked_at = timezone.now()
        invitation.save(update_fields=["revoked_at", "updated_at"])


def _resolve(raw_token: str) -> OrganizationInvitation:
    invitation = (
        OrganizationInvitation.objects.select_related("broker", "professional")
        .filter(token_hash=_hash(raw_token or ""))
        .first()
    )
    if invitation is None or invitation.revoked_at is not None:
        raise ValidationError({"token": ["invalid_invitation"]})
    if invitation.accepted_at is not None:
        raise ValidationError({"token": ["invitation_already_used"]})
    if invitation.expires_at <= timezone.now():
        raise ValidationError({"token": ["invitation_expired"]})
    return invitation


def preview_invitation(raw_token: str) -> dict:
    invitation = _resolve(raw_token)
    return {
        "organization": organization_name(invitation),
        "org_type": invitation.org_type,
        "role": invitation.role,
        "email": invitation.email,
        "account_exists": User.objects.filter(email=invitation.email).exists(),
    }


@transaction.atomic
def accept_invitation(*, raw_token, user=None, password="", full_name="", locale=None) -> User:
    invitation = OrganizationInvitation.objects.select_for_update().get(pk=_resolve(raw_token).pk)
    if invitation.accepted_at is not None:
        raise ValidationError({"token": ["invitation_already_used"]})
    existing = User.objects.filter(email=invitation.email).first()

    if existing is None:
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError as DjangoValidationError

        try:
            validate_password(password)
        except DjangoValidationError as exc:
            raise ValidationError({"password": list(exc.messages)}) from exc
        user = User.objects.create_user(
            email=invitation.email,
            password=password,
            full_name=full_name,
            locale=locale or Locale.EN,
            primary_role=invitation.org_type,
            # The invitation went to this mailbox, so following it proves ownership.
            email_verified_at=timezone.now(),
        )
    else:
        if user is None or user.pk != existing.pk:
            raise PermissionDenied("Sign in with the invited email address to accept this invitation.")
        if existing.primary_role == UserRole.STAFF or existing.is_staff:
            raise ValidationError({"token": ["not_invitable"]})
        if has_live_seat(existing):
            raise ValidationError({"token": ["already_member"]})
        user = existing
        user.primary_role = invitation.org_type
        user.save(update_fields=["primary_role", "updated_at"])

    caps = _capabilities(invitation.org_type, invitation.role)
    try:
        if invitation.org_type == UserRole.BROKER:
            from brokers.models import BrokerMembership
            from brokers.plans import ensure_seat_capacity

            ensure_seat_capacity(invitation.broker)
            BrokerMembership.objects.update_or_create(
                user=user, broker=invitation.broker, defaults={"role": invitation.role, "is_active": True, **caps}
            )
        else:
            from professionals.models import ProfessionalMembership

            ProfessionalMembership.objects.update_or_create(
                user=user, profile=invitation.professional, defaults={"role": invitation.role, "is_active": True, **caps}
            )
    except IntegrityError as exc:
        raise ValidationError({"token": ["already_member"]}) from exc

    invitation.accepted_at = timezone.now()
    invitation.accepted_user = user
    invitation.save(update_fields=["accepted_at", "accepted_user", "updated_at"])
    return user


def release_role_if_unseated(user) -> None:
    """A member with no live seat left goes back to being a private seller."""
    if user.primary_role in (UserRole.BROKER, UserRole.PROFESSIONAL) and not has_live_seat(user):
        User.objects.filter(pk=user.pk).update(primary_role=UserRole.PRIVATE_SELLER)


def _seat_saved(sender, instance, **kwargs):
    if not instance.is_active:
        release_role_if_unseated(instance.user)


def connect_seat_signals():
    from brokers.models import BrokerMembership
    from professionals.models import ProfessionalMembership

    post_save.connect(_seat_saved, sender=BrokerMembership, dispatch_uid="release_broker_seat")
    post_save.connect(_seat_saved, sender=ProfessionalMembership, dispatch_uid="release_pro_seat")
