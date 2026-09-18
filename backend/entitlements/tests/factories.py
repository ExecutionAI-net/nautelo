from datetime import timedelta

from django.utils import timezone

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from entitlements.enums import EntitlementSource, EntitlementState, EntitlementType
from entitlements.models import UserEntitlement

_UNSET = object()


def make_private_seller(email="private-seller@example.com", **extra):
    return make_user(email, role=UserRole.PRIVATE_SELLER, verified=True, **extra)


def make_entitlement(
    *,
    user,
    entitlement_type=EntitlementType.FREE_LISTING,
    source=EntitlementSource.FREE_POLICY,
    state=EntitlementState.AVAILABLE,
    listing=None,
    valid_from=None,
    valid_until=None,
    consumed_at=_UNSET,
    reserved_at=_UNSET,
    revoked_at=_UNSET,
    metadata=None,
    granted_by=None,
    source_payment_id=None,
):
    """Build one ledger row.

    `consumed_at`/`reserved_at`/`revoked_at` default to a value consistent with
    `state` so an ordinary caller does not have to think about the database
    constraints — but pass an explicit `None` to build the inconsistent row a
    constraint test needs.
    """
    now = timezone.now()
    valid_from = valid_from or now
    valid_until = valid_until or (valid_from + timedelta(days=365))
    if consumed_at is _UNSET:
        consumed_at = now if state == EntitlementState.CONSUMED else None
    if reserved_at is _UNSET:
        reserved_at = now if state == EntitlementState.RESERVED else None
    if revoked_at is _UNSET:
        revoked_at = now if state == EntitlementState.REVOKED else None
    return UserEntitlement.objects.create(
        user=user,
        entitlement_type=entitlement_type,
        source=source,
        state=state,
        listing=listing,
        valid_from=valid_from,
        valid_until=valid_until,
        consumed_at=consumed_at,
        reserved_at=reserved_at,
        revoked_at=revoked_at,
        metadata=metadata or {},
        granted_by=granted_by,
        source_payment_id=source_payment_id,
    )
