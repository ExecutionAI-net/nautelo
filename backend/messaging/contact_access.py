"""Spec §16's ContactAccessService: contact visibility is an authorization
outcome computed here, never a presentation decision taken downstream.

The three result types are deliberately SEPARATE frozen dataclasses rather than
one class with nullable fields. `LockedContact` has no `email` attribute at all,
so no serializer, template, log line or debugger repr() can leak a raw value on
the locked path — the value is never placed on the object in the first place.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import ClassVar
from uuid import UUID

from django.db import transaction
from django.utils import timezone

from accounts.services import is_staff_moderator
from audit.models import AuditEvent
from audit.services import record_audit_event
from brokers.enums import BrokerOrganizationStatus
from brokers.models import BrokerOrganization
from platform_settings.services import is_feature_enabled
from professionals.enums import ProfessionalProfileStatus
from professionals.models import ProfessionalProfile

from .enums import CONTACT_UNLOCK_FLAG, ContactTargetType
from .masking import mask_email, mask_phone
from .models import ContactAccessGrant
from .selectors import active_contact_grant

#: Spec §16's only unlock_rule value.
UNLOCK_RULE = "SEND_INQUIRY"

#: URL path segment -> spec §11.8's target_type. The segments are this phase's
#: (they are URL vocabulary, not stored data); the values are Phase 6's enum,
#: which is a `TextChoices`, so `"BROKER" == ContactTargetType.BROKER` and the
#: value serializes to the spec-literal string.
#:
#: There is deliberately no "listing" segment: spec §11.8's target_type has no
#: member for a private person, so a private-seller listing has no grantable
#: target at all (Phase 6 reports NOT_APPLICABLE from the inquiry flow instead).
TARGET_TYPE_BY_SEGMENT = {
    "broker": ContactTargetType.BROKER,
    "professional": ContactTargetType.PROFESSIONAL,
}


class ContactTargetNotFound(Exception):
    """No such entity, or one that has never been public (DRAFT/PENDING).

    The view renders this as 404 — never 403 — so a hidden entity's existence
    is not disclosed, matching ProfessionalDetailView's existing rule.
    """


@dataclass(frozen=True)
class ContactTarget:
    target_type: str
    instance: object
    is_suspended: bool

    @property
    def id(self) -> UUID:
        return self.instance.pk

    @property
    def grant_field(self) -> str:
        """The ContactAccessGrant FK column that points at this entity."""
        return (
            "broker"
            if self.target_type == ContactTargetType.BROKER
            else "professional"
        )


@dataclass(frozen=True)
class LockedContact:
    state: ClassVar[str] = "LOCKED"
    email_mask: str
    phone_mask: str
    unlock_rule: str = UNLOCK_RULE


@dataclass(frozen=True)
class GrantedContact:
    state: ClassVar[str] = "GRANTED"
    email: str
    phone: str
    website_url: str | None
    #: Both are None on the staff-bypass path: spec §5 gives staff a reveal
    #: without a grant, and inventing a `granted_at` for a grant that does not
    #: exist would be a fabricated timestamp in an audited payload.
    granted_at: datetime | None
    grant_id: UUID | None


@dataclass(frozen=True)
class UnavailableContact:
    state: ClassVar[str] = "UNAVAILABLE"


ContactAccess = LockedContact | GrantedContact | UnavailableContact


def resolve_contact_target(*, segment: str, target_id) -> ContactTarget:
    target_type = TARGET_TYPE_BY_SEGMENT.get(segment)
    if target_type is None:
        raise ContactTargetNotFound(f"Unknown contact target type: {segment!r}")

    if target_type == ContactTargetType.BROKER:
        instance = BrokerOrganization.objects.filter(pk=target_id).first()
        active, suspended = (
            BrokerOrganizationStatus.ACTIVE,
            BrokerOrganizationStatus.SUSPENDED,
        )
    else:
        instance = ProfessionalProfile.objects.filter(pk=target_id).first()
        active, suspended = (
            ProfessionalProfileStatus.ACTIVE,
            ProfessionalProfileStatus.SUSPENDED,
        )

    if instance is None or instance.status not in (active, suspended):
        raise ContactTargetNotFound(str(target_id))

    return ContactTarget(
        target_type=target_type,
        instance=instance,
        is_suspended=instance.status == suspended,
    )


def resolve_contact_access(*, viewer, segment: str, target_id) -> ContactAccess:
    """Spec §16's whole decision, in the order the rules must be applied."""
    target = resolve_contact_target(segment=segment, target_id=target_id)

    # Suspension outranks a grant: spec §16 makes a suspended entity's contact
    # unavailable, not merely re-locked, because no inquiry can unlock it.
    if target.is_suspended:
        return UnavailableContact()

    if not _is_eligible_viewer(viewer):
        return _locked(target)

    # The rollout flag gates revealing only (see the ruling). Locking is the
    # fail-closed direction, so default=False is right here.
    if not is_feature_enabled(CONTACT_UNLOCK_FLAG, default=False):
        return _locked(target)

    # The selector is the ONE definition of "active grant" — it already filters
    # revoked_at__isnull=True and orders by -granted_at, so a weaker uniqueness
    # constraint degrades to "newest wins" rather than raising on a read. Do not
    # re-implement the queryset here (reconciliation row 3). Passing only the
    # matching FK leaves the other None, which is exactly how the selector
    # distinguishes the two target kinds.
    grant = active_contact_grant(viewer, **{target.grant_field: target.instance})
    if grant is not None:
        return _granted(target, granted_at=grant.granted_at, grant_id=grant.pk)

    # Spec §5's staff row is a bare tick, and accounts.selectors already reports
    # `reveal_any_contact: is_staff_moderator(user)` on GET /api/v1/session/ —
    # so without this branch the session payload advertises a capability no
    # endpoint honours. is_staff_moderator() lets staff admins through too.
    # Checked LAST, so a staff member who actually sent an inquiry reports their
    # real granted_at rather than a null one.
    if is_staff_moderator(viewer):
        return _granted(target, granted_at=None, grant_id=None)

    return _locked(target)


def _is_eligible_viewer(viewer) -> bool:
    return bool(
        viewer is not None
        and getattr(viewer, "is_authenticated", False)
        and getattr(viewer, "is_active", False)
    )


def _granted(target: ContactTarget, *, granted_at, grant_id) -> GrantedContact:
    """The ONE place a raw contact value is ever read off an entity row."""
    return GrantedContact(
        email=target.instance.public_email,
        phone=target.instance.public_phone,
        website_url=target.instance.website_url or None,
        granted_at=granted_at,
        grant_id=grant_id,
    )


def _locked(target: ContactTarget) -> LockedContact:
    return LockedContact(
        email_mask=mask_email(target.instance.public_email),
        phone_mask=mask_phone(target.instance.public_phone),
    )


@transaction.atomic
def record_first_reveal(*, grant_id, actor, request_id=None) -> bool:
    """Stamp `first_revealed_at` and audit the reveal — once per grant.

    Returns True only for the caller whose UPDATE matched, so two concurrent
    first requests produce exactly one audit event. The conditional UPDATE is
    the entire concurrency control: it is one atomic statement, so no row lock,
    no select_for_update and no retry loop is needed.
    """
    now = timezone.now()
    updated = ContactAccessGrant.objects.filter(
        pk=grant_id, first_revealed_at__isnull=True
    ).update(first_revealed_at=now)
    if not updated:
        return False

    grant = ContactAccessGrant.objects.get(pk=grant_id)
    record_audit_event(
        actor_user=actor,
        actor_type=AuditEvent.ActorType.USER,
        action="contact_access.revealed",
        target_type="messaging.ContactAccessGrant",
        target_id=grant.pk,
        source=AuditEvent.Source.API,
        before={"first_revealed_at": None},
        # Spec §30.2's ISO 8601 UTC spelling, the same `.replace("+00:00", "Z")`
        # normalization contact_payloads._isoformat() applies. An audit row is
        # read by people and diffed by tools; two spellings of the same instant
        # in one project is a needless difference.
        after={"first_revealed_at": now.isoformat().replace("+00:00", "Z")},
        # Safe object IDs only (spec §33.5). No email, no phone, no entity name.
        metadata={
            "target_type": grant.target_type,
            "target_entity_id": str(grant.broker_id or grant.professional_id),
        },
        request_id=request_id,
    )
    return True


def record_staff_reveal(*, segment, target_id, actor, request_id=None) -> None:
    """Audit a grant-less staff reveal (spec §5's staff row, §33.1's "staff
    high-impact actions").

    Written on EVERY such request, unlike record_first_reveal's once-per-grant
    rule: there is no grant row to carry a first-reveal stamp, staff reveals are
    rare, and a staff member reading a contact repeatedly is exactly the pattern
    an abuse review needs to see. No contact value is recorded.
    """
    target_type = TARGET_TYPE_BY_SEGMENT[segment]
    record_audit_event(
        actor_user=actor,
        actor_type=AuditEvent.ActorType.USER,
        action="contact_access.staff_revealed",
        target_type=(
            "brokers.BrokerOrganization"
            if target_type == ContactTargetType.BROKER
            else "professionals.ProfessionalProfile"
        ),
        target_id=target_id,
        source=AuditEvent.Source.API,
        before=None,
        after=None,
        metadata={"target_type": str(target_type), "reason": "staff_reveal_any_contact"},
        request_id=request_id,
    )
