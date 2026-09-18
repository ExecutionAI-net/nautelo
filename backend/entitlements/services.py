"""Ledger lifecycle services (spec §6.3, §26.3, §36.3).

Every function here is the single sanctioned writer of the transition it
performs: it holds the transaction, locks the row, checks the spec §6.3 edge
and records the audit event. Django admin, Celery tasks and (from Phase 17) the
staff API all call these rather than touching `state` directly.
"""

from datetime import datetime, timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import APIException

from audit.models import AuditEvent
from audit.services import record_audit_event

from .enums import (
    RESERVATION_TIMEOUT_MINUTES,
    EntitlementState,
    can_transition_entitlement,
)
from .models import UserEntitlement


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
