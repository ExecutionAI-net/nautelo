"""Ledger lifecycle services (spec §6.3, §26.3, §36.3).

Every function here is the single sanctioned writer of the transition it
performs: it holds the transaction, locks the row, checks the spec §6.3 edge
and records the audit event. Django admin, Celery tasks and (from Phase 17) the
staff API all call these rather than touching `state` directly.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import APIException, ErrorDetail, ValidationError

from audit.models import AuditEvent
from audit.services import record_audit_event

from .enums import (
    RESERVATION_TIMEOUT_MINUTES,
    EntitlementSource,
    EntitlementState,
    EntitlementType,
    can_transition_entitlement,
)
from .models import UserEntitlement
from .policy import paid_validity_days


class InvalidEntitlementState(APIException):
    """A well-formed request against a ledger row in the wrong state.

    409, mirroring listings.drafts.InvalidWorkflowState: the caller is not
    unauthorized, the record simply moved (or never was where they thought).
    """

    status_code = status.HTTP_409_CONFLICT
    default_detail = "This entitlement is not in a state that allows that change."
    default_code = "invalid_entitlement_state"

    def __init__(self, detail=None, *, current_state: str | None = None):
        super().__init__(detail=detail or self.default_detail, code=self.default_code)
        if current_state:
            # Copied into the envelope by common.exceptions.nauta_exception_handler.
            self.meta = {"resource": "entitlement", "current_state": current_state}


def _audit(*, entitlement, action, before_state, actor, actor_type, source, extra=None):
    record_audit_event(
        actor_user=actor if getattr(actor, "is_authenticated", False) else None,
        actor_type=actor_type,
        action=action,
        target_type="entitlements.UserEntitlement",
        target_id=str(entitlement.pk),
        source=source,
        before={"state": before_state},
        after={"state": entitlement.state},
        metadata={
            "user_id": str(entitlement.user_id),
            "entitlement_type": entitlement.entitlement_type,
            "source": entitlement.source,
            **(extra or {}),
        },
    )


@transaction.atomic
def _transition(
    *,
    entitlement_id,
    target_state: str,
    actor,
    actor_type: str,
    source: str,
    action: str,
    updates: dict,
    extra_metadata: dict | None = None,
) -> UserEntitlement | None:
    """Lock one row, check the spec §6.3 edge, apply `updates`, audit.

    Returns the updated row, or None when the edge is not legal — callers that
    sweep in bulk treat None as "someone else got there first", while callers
    acting on a user's instruction raise InvalidEntitlementState themselves.
    """
    entitlement = UserEntitlement.objects.select_for_update().get(pk=entitlement_id)
    before_state = entitlement.state
    if not can_transition_entitlement(before_state, target_state):
        return None

    entitlement.state = target_state
    for field, value in updates.items():
        setattr(entitlement, field, value)
    entitlement.save(
        update_fields=["state", *updates.keys(), "updated_at"]
    )
    _audit(
        entitlement=entitlement,
        action=action,
        before_state=before_state,
        actor=actor,
        actor_type=actor_type,
        source=source,
        extra=extra_metadata,
    )
    return entitlement


def expire_due_entitlements(*, now: datetime | None = None) -> int:
    """Spec §6.3's `AVAILABLE -> EXPIRED`. Returns how many rows moved.

    Only AVAILABLE rows are candidates. A CONSUMED right that has published a
    listing is finished, not expired; a RESERVED one is released by the other
    pass; spec §6.3 gives EXPIRED exactly one inbound edge.
    """
    now = now or timezone.now()
    ids = list(
        UserEntitlement.objects.filter(
            state=EntitlementState.AVAILABLE, valid_until__lte=now
        ).values_list("pk", flat=True)
    )
    moved = 0
    for entitlement_id in ids:
        if (
            _transition(
                entitlement_id=entitlement_id,
                target_state=EntitlementState.EXPIRED,
                actor=None,
                actor_type=AuditEvent.ActorType.SYSTEM,
                source=AuditEvent.Source.TASK,
                action="entitlement.expired",
                updates={},
                extra_metadata={"reason": "validity_window_closed"},
            )
            is not None
        ):
            moved += 1
    return moved


def forfeit_unused_listing_rights(*, user, actor, reason: str) -> int:
    """Expire every listing right `user` has not spent yet. Returns how many.

    Used when a private seller joins a brokerage: the account stops being a
    private seller for good, so rights bought or granted for private listings
    can never be used again. A RESERVED right is first released (spec §6.3's
    RESERVED -> AVAILABLE) so it can take the only legal edge into EXPIRED.
    """
    rows = UserEntitlement.objects.for_user(user).listing_rights().filter(
        state__in=(EntitlementState.AVAILABLE, EntitlementState.RESERVED)
    )
    moved = 0
    for entitlement_id, state in list(rows.values_list("pk", "state")):
        common = {
            "actor": actor,
            "actor_type": AuditEvent.ActorType.USER,
            "source": AuditEvent.Source.API,
            "extra_metadata": {"reason": reason},
        }
        if state == EntitlementState.RESERVED:
            _transition(
                entitlement_id=entitlement_id,
                target_state=EntitlementState.AVAILABLE,
                action="entitlement.reservation_released",
                updates={"reserved_at": None, "listing": None},
                **common,
            )
        if (
            _transition(
                entitlement_id=entitlement_id,
                target_state=EntitlementState.EXPIRED,
                action="entitlement.forfeited",
                updates={},
                **common,
            )
            is not None
        ):
            moved += 1
    return moved


def release_reservation(
    *,
    entitlement,
    actor,
    reason: str,
    actor_type: str | None = None,
    source: str | None = None,
) -> UserEntitlement:
    """Spec §6.3's `RESERVED -> AVAILABLE`, on someone's instruction.

    Raises InvalidEntitlementState when the row is not RESERVED, because the
    caller asked for a specific row and deserves to be told it moved.
    """
    released = _transition(
        entitlement_id=entitlement.pk,
        target_state=EntitlementState.AVAILABLE,
        actor=actor,
        actor_type=actor_type
        or (
            AuditEvent.ActorType.USER
            if getattr(actor, "is_authenticated", False)
            else AuditEvent.ActorType.SYSTEM
        ),
        source=source or AuditEvent.Source.ADMIN,
        action="entitlement.reservation_released",
        updates={"reserved_at": None, "listing": None},
        extra_metadata={"reason": reason},
    )
    if released is None:
        entitlement.refresh_from_db()
        raise InvalidEntitlementState(current_state=entitlement.state)
    return released


def release_stale_reservations(*, now: datetime | None = None) -> int:
    """Spec §6.3: "Reservations expire after 30 minutes unless attached to a
    saved draft."

    `listing__isnull=True` is the "unless": a reservation bound to a listing is
    attached by definition, so the clock must not reclaim it.

    Spec §36.3 assumes something else releases it — "a draft abandoned before
    submission releases reservation" — but NO draft-abandonment flow exists in
    this codebase (there is no listing deletion or archival path; ARCHIVED is
    unreachable). That gap is harmless only because this phase creates no
    RESERVED rows at all (see the plan's ruling on draft creation), so on
    today's data this pass is a no-op and no draft-attached reservation can
    exist to be stranded. The first phase that produces a RESERVED row must
    either leave `listing` NULL, so this sweep can time it out, or ship the
    abandonment-release flow §36.3 presumes. It is built anyway
    because spec §6.3 mandates the rule and because Phase 14's Stripe
    fulfilment and Phase 15's media upgrade are its first producers.
    """
    now = now or timezone.now()
    cutoff = now - timedelta(minutes=RESERVATION_TIMEOUT_MINUTES)
    ids = list(
        UserEntitlement.objects.filter(
            state=EntitlementState.RESERVED,
            listing__isnull=True,
            reserved_at__isnull=False,
            reserved_at__lt=cutoff,
        ).values_list("pk", flat=True)
    )
    moved = 0
    for entitlement_id in ids:
        if (
            _transition(
                entitlement_id=entitlement_id,
                target_state=EntitlementState.AVAILABLE,
                actor=None,
                actor_type=AuditEvent.ActorType.SYSTEM,
                source=AuditEvent.Source.TASK,
                action="entitlement.reservation_released",
                updates={"reserved_at": None},
                extra_metadata={"reason": "reservation_timed_out"},
            )
            is not None
        ):
            moved += 1
    return moved


class EntitlementReasonRequired(ValidationError):
    """Spec §26.3 and §36.3: every staff operation on the ledger is a
    compensation decision and must say why, in the audit trail and on the row.

    A ValidationError (400) rather than a bespoke APIException, so it renders
    through spec §30.2's `fields` map with the offending field named. The
    consequence, stated because it is easy to get wrong: common.exceptions maps
    EVERY ValidationError to `code: "validation_error"`, and its `_field_map`
    flattens each detail item with `str()` — which on an ErrorDetail yields the
    MESSAGE, not the code. So the wire reads
    `{"code": "validation_error",
      "fields": {"reason": ["Explain why this entitlement is being changed."]}}`
    and the string "entitlement_reason_required" never leaves Python. It is the
    internal DRF code, assertable as `exc.detail["reason"][0].code`. That is the
    intended contract — a blank reason is a form error about one field, not a
    distinct API failure mode — and it is why `get_codes()` on this exception
    returns a dict, not a string.
    """

    def __init__(self):
        super().__init__(
            {
                "reason": [
                    ErrorDetail(
                        "Explain why this entitlement is being changed.",
                        code="entitlement_reason_required",
                    )
                ]
            }
        )


def _require_reason(reason: str) -> str:
    cleaned = (reason or "").strip()
    if not cleaned:
        raise EntitlementReasonRequired()
    return cleaned


@transaction.atomic
def grant_listing_right(
    *,
    user,
    actor,
    reason: str,
    entitlement_type: str = EntitlementType.PAID_LISTING,
    valid_days: int | None = None,
    now: datetime | None = None,
    extra_metadata: dict | None = None,
) -> UserEntitlement:
    """Spec §26.3 item 2: "Grant a compensatory listing/media right with
    mandatory reason."

    Always AVAILABLE and always STAFF_GRANT — a grant hands someone a usable
    right, it never back-dates a consumption, and it is never attributed to
    Stripe.
    """
    cleaned = _require_reason(reason)
    now = now or timezone.now()
    valid_days = valid_days if valid_days is not None else paid_validity_days()

    entitlement = UserEntitlement.objects.create(
        user=user,
        entitlement_type=entitlement_type,
        source=EntitlementSource.STAFF_GRANT,
        state=EntitlementState.AVAILABLE,
        valid_from=now,
        valid_until=now + timedelta(days=valid_days),
        granted_by=actor if getattr(actor, "is_authenticated", False) else None,
        metadata={**(extra_metadata or {}), "reason": cleaned},
    )
    _audit(
        entitlement=entitlement,
        action="entitlement.granted",
        before_state=None,
        actor=actor,
        actor_type=AuditEvent.ActorType.USER,
        source=AuditEvent.Source.ADMIN,
        extra={"reason": cleaned, "valid_days": valid_days},
    )
    return entitlement


def revoke_entitlement(
    *,
    entitlement,
    actor,
    reason: str,
    now: datetime | None = None,
    actor_type: str | None = None,
    source: str | None = None,
) -> UserEntitlement:
    """Spec §26.3 item 3, and spec §6.3's `CONSUMED -> REVOKED`.

    Works from AVAILABLE/RESERVED (an unused grant withdrawn) and from CONSUMED
    (a refund, chargeback or staff remedy). Spec §26.4's rule that staff must
    not hand-edit Stripe-paid order status is unaffected: this revokes the
    *entitlement*, never a PaymentOrder.
    """
    cleaned = _require_reason(reason)
    now = now or timezone.now()
    return _revoke(
        entitlement=entitlement,
        actor=actor,
        reason=cleaned,
        now=now,
        action="entitlement.revoked",
        extra_metadata={},
        actor_type=actor_type,
        source=source,
    )


def _revoke(
    *,
    entitlement,
    actor,
    reason,
    now,
    action,
    extra_metadata,
    actor_type=None,
    source=None,
):
    with transaction.atomic():
        locked = UserEntitlement.objects.select_for_update().get(pk=entitlement.pk)
        before_state = locked.state
        if before_state == EntitlementState.REVOKED or not (
            can_transition_entitlement(before_state, EntitlementState.REVOKED)
            or before_state
            in (EntitlementState.AVAILABLE, EntitlementState.RESERVED)
        ):
            raise InvalidEntitlementState(current_state=before_state)

        locked.state = EntitlementState.REVOKED
        locked.revoked_at = now
        locked.metadata = {
            **locked.metadata,
            "revocation_reason": reason,
            **extra_metadata,
        }
        locked.save(
            update_fields=["state", "revoked_at", "metadata", "updated_at"]
        )
        _audit(
            entitlement=locked,
            action=action,
            before_state=before_state,
            actor=actor,
            actor_type=actor_type or AuditEvent.ActorType.USER,
            source=source or AuditEvent.Source.ADMIN,
            extra={"reason": reason, **extra_metadata},
        )
        return locked


@dataclass(frozen=True)
class RestoreResult:
    revoked: UserEntitlement
    replacement: UserEntitlement | None


@transaction.atomic
def restore_consumed_right(
    *, entitlement, actor, reason: str, now: datetime | None = None
) -> RestoreResult:
    """Spec §26.3 item 4: "Restore a right after documented staff error."

    Two shapes, because the two right types are restored differently:
      * FREE_LISTING — revoking the consumed row is the whole remedy, because
        free eligibility is recomputed from consumption history (spec §22.1)
        and a REVOKED row no longer counts.
      * PAID_LISTING — revoking alone would leave the buyer with nothing, so a
        replacement AVAILABLE/STAFF_GRANT row is issued with fresh validity.

    The listing this right published is deliberately untouched: spec §36.4
    keeps moderation decisions and entitlement remedies separate.
    """
    cleaned = _require_reason(reason)
    now = now or timezone.now()

    entitlement.refresh_from_db()
    if entitlement.state != EntitlementState.CONSUMED:
        raise InvalidEntitlementState(
            "Only a consumed right can be restored.", current_state=entitlement.state
        )

    revoked = _revoke(
        entitlement=entitlement,
        actor=actor,
        reason=cleaned,
        now=now,
        action="entitlement.restored",
        extra_metadata={"restored": True},
    )

    replacement = None
    if revoked.entitlement_type == EntitlementType.PAID_LISTING:
        replacement = grant_listing_right(
            user=revoked.user,
            actor=actor,
            reason=cleaned,
            entitlement_type=EntitlementType.PAID_LISTING,
            now=now,
        )
        replacement.metadata = {
            **replacement.metadata,
            "restored_from": str(revoked.pk),
        }
        replacement.save(update_fields=["metadata", "updated_at"])

    return RestoreResult(revoked=revoked, replacement=replacement)


def consume_media_upgrade(*, entitlement, actor, now: datetime | None = None):
    """Spec §24.4: applying a media upgrade is `AVAILABLE -> CONSUMED`,
    transactional and irreversible except by a staff remedy.

    The row was bound to its listing at checkout (payments.checkout), so
    consuming it is what makes the upgraded allowance real:
    listings.policies.effective_media_allowance reads CONSUMED rows.
    """
    now = now or timezone.now()
    consumed = _transition(
        entitlement_id=entitlement.pk,
        target_state=EntitlementState.CONSUMED,
        actor=actor,
        actor_type=AuditEvent.ActorType.USER,
        source=AuditEvent.Source.API,
        action="entitlement.media_upgrade_applied",
        updates={"consumed_at": now},
        extra_metadata={"listing_id": str(entitlement.listing_id)},
    )
    if consumed is None:
        entitlement.refresh_from_db()
        raise InvalidEntitlementState(current_state=entitlement.state)
    return consumed
