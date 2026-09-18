"""The entitlement ledger (NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md §11.9).

Spec §11.9: "Free use is also recorded as an entitlement/ledger entry. Do not
infer historical quota solely from current listings, because listings may be
deleted, archived or moderated." Every rule in this app therefore reads this
table and never counts BoatListing rows.

This module deliberately imports nothing from `listings`: the `listing` FK is
declared as a lazy string reference so the dependency arrow stays
listings -> entitlements and never the other way round.
"""

from django.conf import settings
from django.core.serializers.json import DjangoJSONEncoder
from django.db import models
from django.db.models import Q
from django.utils import timezone

from common.models import UUIDTimeStampedModel

from .enums import (
    LISTING_RIGHT_TYPES,
    EntitlementSource,
    EntitlementState,
    EntitlementType,
)


class UserEntitlementQuerySet(models.QuerySet):
    def for_user(self, user):
        return self.filter(user=user)

    def listing_rights(self):
        """FREE_LISTING and PAID_LISTING only — never MEDIA_UPGRADE."""
        return self.filter(entitlement_type__in=sorted(LISTING_RIGHT_TYPES))

    def free(self):
        return self.filter(entitlement_type=EntitlementType.FREE_LISTING)

    def paid(self):
        return self.filter(entitlement_type=EntitlementType.PAID_LISTING)

    def consumed(self):
        return self.filter(state=EntitlementState.CONSUMED)

    def available(self, now=None):
        """AVAILABLE *and* inside its validity window.

        A row whose `valid_until` has passed is only moved to EXPIRED by the
        daily sweep (entitlements.services.expire_due_entitlements), so a
        caller that trusted `state` alone would hand out an expired right in
        the window between the two.
        """
        now = now or timezone.now()
        return self.filter(
            state=EntitlementState.AVAILABLE,
            valid_from__lte=now,
            valid_until__gt=now,
        )


class UserEntitlement(UUIDTimeStampedModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="entitlements",
    )
    entitlement_type = models.CharField(
        max_length=16, choices=EntitlementType.choices
    )
    source = models.CharField(max_length=16, choices=EntitlementSource.choices)
    # Phase 14 converted this from a loose UUIDField into a real FK (Phase 13
    # contract rule 6). PROTECT, not CASCADE or SET_NULL: spec §35.3 says "Do
    # not roll back a fulfilled Stripe entitlement by deleting it; preserve
    # ledger and reconcile", and the order is half of that ledger. The column
    # name is unchanged (`source_payment_id`), so every existing query and the
    # test factory keep working verbatim.
    source_payment = models.ForeignKey(
        "payments.PaymentOrder",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="granted_entitlements",
    )
    listing = models.ForeignKey(
        "listings.BoatListing",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="entitlements",
    )
    state = models.CharField(
        max_length=16,
        choices=EntitlementState.choices,
        default=EntitlementState.AVAILABLE,
    )
    valid_from = models.DateTimeField()
    valid_until = models.DateTimeField()
    reserved_at = models.DateTimeField(null=True, blank=True)
    consumed_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    # Spec §36.3: "Staff-granted right must include who, why and expiry."
    # `who` is this column, `why` is metadata["reason"], `expiry` is valid_until.
    granted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    metadata = models.JSONField(default=dict, blank=True, encoder=DjangoJSONEncoder)

    objects = UserEntitlementQuerySet.as_manager()

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "entitlement_type", "state"]),
            models.Index(fields=["state", "valid_until"]),
            # The rolling-window query in entitlements.policy.
            models.Index(fields=["user", "entitlement_type", "-consumed_at"]),
            models.Index(fields=["state", "reserved_at"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=Q(valid_until__gt=models.F("valid_from")),
                name="entitlements_validity_window_is_forward",
            ),
            models.CheckConstraint(
                condition=~Q(state=EntitlementState.CONSUMED)
                | Q(consumed_at__isnull=False),
                name="entitlements_consumed_requires_consumed_at",
            ),
            models.CheckConstraint(
                condition=~Q(state=EntitlementState.RESERVED)
                | Q(reserved_at__isnull=False),
                name="entitlements_reserved_requires_reserved_at",
            ),
            models.CheckConstraint(
                condition=~Q(state=EntitlementState.REVOKED)
                | Q(revoked_at__isnull=False),
                name="entitlements_revoked_requires_revoked_at",
            ),
            # A listing is published by at most one live right of a given type.
            # REVOKED is excluded so spec §26.3's staff restore can re-issue
            # against the same listing without tripping the index.
            models.UniqueConstraint(
                fields=["listing", "entitlement_type"],
                condition=Q(listing__isnull=False) & ~Q(state=EntitlementState.REVOKED),
                name="entitlements_one_live_right_per_listing_and_type",
            ),
            # Spec §6.4's "an entitlement was created exactly once", as a
            # database invariant rather than a Python guard. Partial on two
            # axes: rows with no payment behind them (free and staff-granted
            # rights) are unconstrained, and a REVOKED row stops counting so
            # that §23.4's refund-then-repurchase and §26.3's staff restore
            # both stay possible. Disjoint from
            # entitlements_one_live_right_per_listing_and_type, which is keyed
            # on (listing, entitlement_type) and is NULL for every listing-right
            # purchase.
            models.UniqueConstraint(
                fields=["source_payment"],
                condition=Q(source_payment__isnull=False)
                & ~Q(state=EntitlementState.REVOKED),
                name="entitlements_one_live_right_per_payment",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.user_id} {self.entitlement_type} {self.state}"
