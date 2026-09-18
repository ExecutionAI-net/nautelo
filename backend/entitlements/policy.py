"""Free/paid quota arithmetic (spec §22.1, §36.3, §10.1).

Nothing here writes. Every number comes from platform_settings, so spec §22's
definition of done — "Free limits are adjustable without code deployment" — is
a property of this module, and spec §36.3's "Configuration changes are
prospective" follows from the fact that the window is recomputed on read.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta

from django.db.models import QuerySet
from django.utils import timezone

from platform_settings.services import get_setting_value, is_feature_enabled

from .enums import INDIVIDUAL_ENTITLEMENTS_FLAG
from .models import UserEntitlement


def free_listing_count() -> int:
    return int(get_setting_value("individual.free_listing_count"))


def free_period_days() -> int:
    return int(get_setting_value("individual.free_period_days"))


def free_publication_days() -> int:
    return int(get_setting_value("individual.free_publish_days"))


def paid_publication_days() -> int:
    return int(get_setting_value("individual.paid_publish_days"))


def paid_validity_days() -> int:
    return int(get_setting_value("individual.paid_entitlement_valid_days"))


def enforcement_enabled() -> bool:
    """Spec §35.1's rollout flag, defaulting to OFF.

    This gates *refusal only*. The ledger is written either way — see the
    plan's ruling: suppressing bookkeeping while the flag is off would hand
    every pre-rollout user a second free listing on the day it is enabled.
    """
    return is_feature_enabled(INDIVIDUAL_ENTITLEMENTS_FLAG, default=False)


@dataclass(frozen=True)
class FreeQuotaState:
    """Spec §22.2's `free` block, plus the two numbers it is derived from."""

    available: bool
    used_at: datetime | None
    next_available_at: datetime | None
    publication_days: int
    allowance: int
    used_in_period: int

    def as_dict(self) -> dict:
        # Exactly spec §22.2's four keys. `allowance`/`used_in_period` are
        # internal arithmetic and are deliberately not part of the wire format.
        return {
            "available": self.available,
            "used_at": self.used_at,
            "next_available_at": self.next_available_at,
            "publication_days": self.publication_days,
        }


def free_quota_state(user, *, now: datetime | None = None) -> FreeQuotaState:
    """Spec §22.1's rolling window, computed from the ledger alone.

    "The rolling period starts when the free entitlement is consumed on
    submission." So the window is keyed on `consumed_at`, not on `created_at`
    and not on any listing's `published_at` — a deleted, archived or moderated
    listing must not change the answer (spec §11.9).

    A REVOKED row is not counted: spec §22.1 says the right "remains consumed
    unless staff explicitly restores it with an audited remedy", and spec §6.3
    makes CONSUMED -> REVOKED the transition that remedy performs.
    """
    now = now or timezone.now()
    allowance = free_listing_count()
    period = timedelta(days=free_period_days())
    cutoff = now - period

    # Newest first: [0] is spec §22.2's `used_at`, and [allowance - 1] is the
    # oldest use still inside the window, which is the one that has to age out
    # before a new right appears.
    consumed_at_values = list(
        UserEntitlement.objects.for_user(user)
        .free()
        .consumed()
        .filter(consumed_at__isnull=False)
        .order_by("-consumed_at")
        .values_list("consumed_at", flat=True)[: max(allowance, 1) + 1]
    )
    used_at = consumed_at_values[0] if consumed_at_values else None
    in_period = [value for value in consumed_at_values if value > cutoff]
    used_in_period = len(in_period)

    available = allowance > 0 and used_in_period < allowance
    next_available_at = None
    if not available and allowance > 0 and len(in_period) >= allowance:
        # `in_period` is newest-first, so the element at `allowance - 1` is the
        # oldest of the `allowance` most recent uses. With the default
        # allowance of 1 this is simply "last use + 365 days" (spec §22.1).
        next_available_at = in_period[allowance - 1] + period

    return FreeQuotaState(
        available=available,
        used_at=used_at,
        next_available_at=next_available_at,
        publication_days=free_publication_days(),
        allowance=allowance,
        used_in_period=used_in_period,
    )


def available_paid_rights(
    user, *, now: datetime | None = None
) -> QuerySet[UserEntitlement]:
    """AVAILABLE, in-window PAID_LISTING rights, soonest-expiring first.

    Soonest-expiring first is deliberate: consuming the right that would lapse
    next is the only ordering that never destroys value the buyer paid for.
    """
    now = now or timezone.now()
    return (
        UserEntitlement.objects.for_user(user)
        .paid()
        .available(now=now)
        .order_by("valid_until", "created_at", "pk")
    )
