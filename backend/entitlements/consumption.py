"""Reserving, refusing and consuming a listing right (spec §22.4, §6.3, §36.3).

This module holds the single authoritative check. Spec §22.2 lists five
evaluation points and says of the last one — submission, inside the locked
transaction — "The last check is authoritative and prevents multiple-tab
races." That is `consume_listing_right()`; everything before it is advisory.
"""

from datetime import datetime, timedelta

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import APIException

from audit.models import AuditEvent
from audit.services import record_audit_event

from .eligibility import ListingEligibilityService
from .enums import (
    PURCHASE_PRODUCT_CODE,
    EntitlementSource,
    EntitlementState,
    EntitlementType,
)
from .models import UserEntitlement
from .policy import (
    available_paid_rights,
    enforcement_enabled,
    free_period_days,
    free_publication_days,
    free_quota_state,
    paid_publication_days,
)


class ListingEntitlementRequired(APIException):
    """Spec §22.4's refusal, with spec §30.2's worked `action` block.

    403, not 409: this is "you are not allowed to do this", not "the record
    moved under you". The same code and status are returned by draft creation
    and by submit so a client branches on one value.
    """

    status_code = status.HTTP_403_FORBIDDEN
    # Copied verbatim from spec §30.2's example error body.
    default_detail = "You have used your free listing allowance."
    default_code = "listing_entitlement_required"
    # One message per blocking reason. Without this, an account that is not an
    # individual seller at all would be told it had "used its free listing
    # allowance" — false, and unhelpful. The code and status stay the same for
    # every reason so a client still branches on one value (spec §30.2); only
    # the human-readable message differs.
    DETAIL_BY_REASON = {
        "FREE_ALLOWANCE_USED": default_detail,
        "NOT_AN_INDIVIDUAL_SELLER": (
            "This account cannot create a private-seller listing."
        ),
    }

    def __init__(self, *, blocking_reason: str | None = None, detail=None):
        detail = detail or self.DETAIL_BY_REASON.get(
            blocking_reason, self.default_detail
        )
        super().__init__(detail=detail, code=self.default_code)
        # Both are copied into the envelope by common.exceptions.
        self.action = {"type": "PURCHASE", "product_code": PURCHASE_PRODUCT_CODE}
        if blocking_reason:
            self.meta = {"blocking_reason": blocking_reason}


def lock_user_quota(user) -> None:
    """`SELECT … FOR UPDATE` on the consuming user's own row.

    The serialisation point for free-right consumption, which has no row of its
    own to lock until the instant it is created. Cheap (one row, one user) and
    released with the surrounding transaction.

    LOCK ORDER: BoatListing first, User second. listings.submissions locks the
    listing before calling into here; any future path that needs both must take
    them in that order.
    """
    get_user_model().objects.select_for_update().filter(pk=user.pk).values_list(
        "pk", flat=True
    ).first()


def ensure_can_start_listing(user) -> None:
    """Spec §22.4's draft-creation gate. Raises or returns None.

    No lock: this is one of spec §22.2's advisory evaluation points, not the
    authoritative one. Taking a lock here would serialise draft creation for no
    benefit, since nothing is consumed.

    The raised message is chosen from the blocking reason, so calling this in
    isolation on an account that is not an individual seller produces the
    NOT_AN_INDIVIDUAL_SELLER wording rather than a false "you used your free
    allowance". In the normal flow that reason is unreachable here, because
    listings.drafts calls accounts.services.resolve_seller_context() first and
    that rejects a non-individual seller with its own error.
    """
    if not enforcement_enabled():
        return
    eligibility = ListingEligibilityService.for_user(user)
    if not eligibility.can_start_listing:
        raise ListingEntitlementRequired(blocking_reason=eligibility.blocking_reason)


def _publication_source_days(entitlement_type: str) -> int:
    if entitlement_type == EntitlementType.PAID_LISTING:
        return paid_publication_days()
    return free_publication_days()


@transaction.atomic
def consume_listing_right(
    *, user, listing, actor, now: datetime | None = None
) -> UserEntitlement:
    """Burn exactly one listing right for `listing`, or raise.

    Returns the ledger row. Idempotent per listing: a listing that already
    carries a consumed right returns that same row without burning another
    (spec §22.1's "A rejected submission can be corrected without consuming a
    second right", spec §36.3's "a submitted right stays associated through
    changes-requested/rejected correction loop").
    """
    now = now or timezone.now()

    existing_id = listing.consumed_entitlement_id
    if existing_id is not None:
        return UserEntitlement.objects.get(pk=existing_id)

    lock_user_quota(user)

    # Recomputed INSIDE the lock. Everything read before this point is stale by
    # definition (spec §22.2: "The last check is authoritative").
    free = free_quota_state(user, now=now)
    enforced = enforcement_enabled()

    if free.available:
        return _consume_free(
            user=user, listing=listing, actor=actor, now=now, enforced=enforced,
            over_allowance=False,
        )

    paid = (
        available_paid_rights(user, now=now)
        .select_for_update()
        .first()
    )
    if paid is not None:
        return _consume_paid(entitlement=paid, listing=listing, actor=actor, now=now,
                             enforced=enforced)

    if enforced:
        raise ListingEntitlementRequired(blocking_reason="FREE_ALLOWANCE_USED")

    # Flag off: nothing may be refused, but the ledger must still record that a
    # free listing was activated — otherwise enabling the flag later would hand
    # this user a fresh allowance (spec §11.9's warning). The row is marked so
    # the ledger never claims the use was within policy.
    return _consume_free(
        user=user, listing=listing, actor=actor, now=now, enforced=False,
        over_allowance=True,
    )


def _audit(*, entitlement, actor, listing, before_state):
    # actor_type MUST agree with actor_user. The plan's Global Constraints rule
    # is "system actions use SYSTEM/TASK", and an unauthenticated or absent
    # actor here is exactly a system action — writing actor_type=USER with
    # actor_user=None would put a self-contradicting pair in an immutable audit
    # row (spec §2.4). Same conditional shape as services.release_reservation.
    actor_user = actor if getattr(actor, "is_authenticated", False) else None
    record_audit_event(
        actor_user=actor_user,
        actor_type=(
            AuditEvent.ActorType.USER
            if actor_user is not None
            else AuditEvent.ActorType.SYSTEM
        ),
        action="entitlement.consumed",
        target_type="entitlements.UserEntitlement",
        target_id=str(entitlement.pk),
        source=AuditEvent.Source.API,
        before={"state": before_state},
        after={
            "state": entitlement.state,
            "consumed_at": entitlement.consumed_at,
        },
        metadata={
            "listing_id": str(listing.pk),
            "entitlement_type": entitlement.entitlement_type,
            "source": entitlement.source,
            "publication_days": entitlement.metadata.get("publication_days"),
        },
    )


def _consume_free(*, user, listing, actor, now, enforced, over_allowance):
    entitlement = UserEntitlement.objects.create(
        user=user,
        entitlement_type=EntitlementType.FREE_LISTING,
        source=EntitlementSource.FREE_POLICY,
        state=EntitlementState.CONSUMED,
        listing=listing,
        valid_from=now,
        # A free right is created already consumed, so its window exists only
        # so the row satisfies the model's validity constraint and so the
        # ledger records the policy period that applied (spec §36.3).
        valid_until=now + timedelta(days=free_period_days()),
        consumed_at=now,
        metadata={
            # Frozen here, read back by listings.policies.publication_days at
            # approval time (spec §36.3: "Existing consumed entitlements
            # preserve their recorded publication duration").
            "publication_days": free_publication_days(),
            "free_period_days": free_period_days(),
            "enforced": enforced,
            "over_allowance": over_allowance,
        },
    )
    _audit(entitlement=entitlement, actor=actor, listing=listing, before_state=None)
    return entitlement


def _consume_paid(*, entitlement, listing, actor, now, enforced):
    before_state = entitlement.state
    entitlement.state = EntitlementState.CONSUMED
    entitlement.consumed_at = now
    entitlement.listing = listing
    entitlement.metadata = {
        **entitlement.metadata,
        # A package right carries the length it was bought with; staff gifts and
        # legacy rights fall back to the platform setting.
        "publication_days": entitlement.metadata.get("publication_days")
        or paid_publication_days(),
        "enforced": enforced,
        "over_allowance": False,
    }
    entitlement.save(
        update_fields=["state", "consumed_at", "listing", "metadata", "updated_at"]
    )
    _audit(
        entitlement=entitlement,
        actor=actor,
        listing=listing,
        before_state=before_state,
    )
    return entitlement
