"""Spec §6.3's two time-driven transitions:
  AVAILABLE -> EXPIRED
  RESERVED  -> AVAILABLE (creation cancelled or timed out)
"""

from datetime import timedelta

import pytest
from django.utils import timezone

from audit.models import AuditEvent
from entitlements.enums import EntitlementSource, EntitlementState, EntitlementType
from entitlements.services import (
    InvalidEntitlementState,
    expire_due_entitlements,
    release_reservation,
    release_stale_reservations,
)
from entitlements.tasks import sweep_entitlement_ledger
from entitlements.tests.factories import make_entitlement, make_private_seller
from listings.tests.factories import make_private_listing


@pytest.mark.django_db
def test_an_unused_right_past_its_validity_expires():
    user = make_private_seller()
    now = timezone.now()
    stale = make_entitlement(
        user=user,
        entitlement_type=EntitlementType.PAID_LISTING,
        source=EntitlementSource.STRIPE_PURCHASE,
        state=EntitlementState.AVAILABLE,
        valid_from=now - timedelta(days=400),
        valid_until=now - timedelta(days=1),
    )

    assert expire_due_entitlements(now=now) == 1

    stale.refresh_from_db()
    assert stale.state == EntitlementState.EXPIRED


@pytest.mark.django_db
def test_a_right_still_inside_its_window_is_untouched():
    user = make_private_seller()
    now = timezone.now()
    live = make_entitlement(
        user=user,
        entitlement_type=EntitlementType.PAID_LISTING,
        state=EntitlementState.AVAILABLE,
        valid_until=now + timedelta(days=1),
    )

    assert expire_due_entitlements(now=now) == 0

    live.refresh_from_db()
    assert live.state == EntitlementState.AVAILABLE


@pytest.mark.django_db
def test_consumed_reserved_and_revoked_rows_are_never_expired():
    """Spec §6.3 has exactly one inbound edge to EXPIRED, from AVAILABLE."""
    user = make_private_seller()
    now = timezone.now()
    past = {"valid_from": now - timedelta(days=400), "valid_until": now - timedelta(days=1)}
    consumed = make_entitlement(
        user=user, state=EntitlementState.CONSUMED, consumed_at=now, **past
    )
    reserved = make_entitlement(
        user=user, state=EntitlementState.RESERVED, reserved_at=now, **past
    )
    revoked = make_entitlement(
        user=user, state=EntitlementState.REVOKED, revoked_at=now, **past
    )

    assert expire_due_entitlements(now=now) == 0

    for row in (consumed, reserved, revoked):
        row.refresh_from_db()
    assert consumed.state == EntitlementState.CONSUMED
    assert reserved.state == EntitlementState.RESERVED
    assert revoked.state == EntitlementState.REVOKED


@pytest.mark.django_db
def test_expiry_writes_a_system_audit_event_and_is_idempotent():
    user = make_private_seller()
    now = timezone.now()
    make_entitlement(
        user=user,
        state=EntitlementState.AVAILABLE,
        valid_from=now - timedelta(days=400),
        valid_until=now - timedelta(days=1),
    )

    assert expire_due_entitlements(now=now) == 1
    assert expire_due_entitlements(now=now) == 0

    event = AuditEvent.objects.get(action="entitlement.expired")
    assert event.actor_user is None
    assert event.actor_type == AuditEvent.ActorType.SYSTEM
    assert event.source == AuditEvent.Source.TASK
    assert event.before["state"] == EntitlementState.AVAILABLE
    assert event.after["state"] == EntitlementState.EXPIRED


@pytest.mark.django_db
def test_an_unattached_reservation_older_than_thirty_minutes_is_released():
    """Spec §6.3: "Reservations expire after 30 minutes unless attached to a
    saved draft"."""
    user = make_private_seller()
    now = timezone.now()
    stale = make_entitlement(
        user=user,
        entitlement_type=EntitlementType.PAID_LISTING,
        state=EntitlementState.RESERVED,
        reserved_at=now - timedelta(minutes=31),
        valid_until=now + timedelta(days=100),
    )

    assert release_stale_reservations(now=now) == 1

    stale.refresh_from_db()
    assert stale.state == EntitlementState.AVAILABLE
    assert stale.reserved_at is None


@pytest.mark.django_db
def test_a_fresh_reservation_is_left_alone():
    user = make_private_seller()
    now = timezone.now()
    fresh = make_entitlement(
        user=user,
        state=EntitlementState.RESERVED,
        reserved_at=now - timedelta(minutes=5),
        valid_until=now + timedelta(days=100),
    )

    assert release_stale_reservations(now=now) == 0

    fresh.refresh_from_db()
    assert fresh.state == EntitlementState.RESERVED


@pytest.mark.django_db
def test_a_reservation_attached_to_a_listing_is_never_timed_out():
    """Spec §6.3's "unless attached to a saved draft"."""
    user = make_private_seller()
    now = timezone.now()
    attached = make_entitlement(
        user=user,
        listing=make_private_listing(owner=user),
        state=EntitlementState.RESERVED,
        reserved_at=now - timedelta(days=3),
        valid_until=now + timedelta(days=100),
    )

    assert release_stale_reservations(now=now) == 0

    attached.refresh_from_db()
    assert attached.state == EntitlementState.RESERVED


@pytest.mark.django_db
def test_releasing_a_row_that_is_not_reserved_is_refused():
    user = make_private_seller()
    consumed = make_entitlement(
        user=user, state=EntitlementState.CONSUMED, consumed_at=timezone.now()
    )

    with pytest.raises(InvalidEntitlementState) as excinfo:
        release_reservation(entitlement=consumed, actor=None, reason="mistake")

    assert excinfo.value.status_code == 409
    assert excinfo.value.get_codes() == "invalid_entitlement_state"


@pytest.mark.django_db
def test_the_sweep_task_runs_both_passes():
    user = make_private_seller()
    now = timezone.now()
    make_entitlement(
        user=user,
        state=EntitlementState.AVAILABLE,
        valid_from=now - timedelta(days=400),
        valid_until=now - timedelta(days=1),
    )
    make_entitlement(
        user=user,
        state=EntitlementState.RESERVED,
        reserved_at=now - timedelta(hours=2),
        valid_until=now + timedelta(days=100),
    )

    assert sweep_entitlement_ledger() == {"expired": 1, "released": 1}
