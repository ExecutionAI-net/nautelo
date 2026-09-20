"""Spec §22.2's ListingEligibilityService payload, key by key."""

from datetime import UTC, datetime, timedelta

import pytest
from django.contrib.auth.models import Group
from django.utils import timezone

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from entitlements.eligibility import (
    Eligibility,
    ListingEligibilityService,
    RecommendedEntitlement,
)
from entitlements.enums import (
    BlockingReason,
    EntitlementSource,
    EntitlementState,
    EntitlementType,
)
from entitlements.policy import FreeQuotaState
from entitlements.tests.factories import make_entitlement, make_private_seller
from platform_settings.services import update_setting

NOW = datetime(2026, 6, 15, 12, 0, 0, tzinfo=UTC)


def _consumed_free(user, *, when):
    return make_entitlement(
        user=user,
        entitlement_type=EntitlementType.FREE_LISTING,
        state=EntitlementState.CONSUMED,
        valid_from=when,
        valid_until=when + timedelta(days=365),
        consumed_at=when,
    )


def _paid(user, *, valid_until, valid_from=None, state=EntitlementState.AVAILABLE,
          source=EntitlementSource.STRIPE_PURCHASE,
          entitlement_type=EntitlementType.PAID_LISTING):
    return make_entitlement(
        user=user,
        entitlement_type=entitlement_type,
        source=source,
        state=state,
        valid_from=valid_from or (NOW - timedelta(days=1)),
        valid_until=valid_until,
    )


def _staff(email, *, group=None, superuser=False):
    user = make_user(email, role=UserRole.STAFF, verified=True)
    if group is not None:
        user.groups.add(Group.objects.get_or_create(name=group)[0])
    if superuser:
        user.is_superuser = True
        user.save(update_fields=["is_superuser"])
    return user


# --------------------------------------------------------------------------
# Wire shape
# --------------------------------------------------------------------------


@pytest.mark.django_db
def test_payload_has_exactly_the_spec_22_2_keys(entitlements_enforced):
    payload = ListingEligibilityService.for_user(make_private_seller()).as_dict()
    assert list(payload) == [
        "can_start_listing",
        "recommended_entitlement",
        "free",
        "paid_listing_rights_available",
        "blocking_reason",
        "purchase_product_code",
    ]
    assert set(payload["free"]) == {
        "available",
        "used_at",
        "next_available_at",
        "publication_days",
    }
    assert payload["purchase_product_code"] == "INDIVIDUAL_LISTING_RIGHT"


@pytest.mark.django_db
def test_exact_payload_for_a_fresh_seller(entitlements_enforced):
    payload = ListingEligibilityService.for_user(
        make_private_seller(), now=NOW
    ).as_dict()
    assert payload == {
        "can_start_listing": True,
        "recommended_entitlement": {
            "entitlement_id": None,
            "entitlement_type": "FREE_LISTING",
            "source": "FREE_POLICY",
            "valid_until": None,
            "publication_days": 30,
        },
        "free": {
            "available": True,
            "used_at": None,
            "next_available_at": None,
            "publication_days": 30,
        },
        "paid_listing_rights_available": 0,
        "blocking_reason": None,
        "purchase_product_code": "INDIVIDUAL_LISTING_RIGHT",
    }


@pytest.mark.django_db
def test_exact_payload_for_a_blocked_seller(entitlements_enforced):
    user = make_private_seller()
    used = NOW - timedelta(days=5)
    _consumed_free(user, when=used)

    payload = ListingEligibilityService.for_user(user, now=NOW).as_dict()

    assert payload == {
        "can_start_listing": False,
        "recommended_entitlement": None,
        "free": {
            "available": False,
            "used_at": used,
            "next_available_at": used + timedelta(days=365),
            "publication_days": 30,
        },
        "paid_listing_rights_available": 0,
        "blocking_reason": "FREE_ALLOWANCE_USED",
        "purchase_product_code": "INDIVIDUAL_LISTING_RIGHT",
    }


@pytest.mark.django_db
def test_exact_payload_when_a_paid_right_is_recommended(entitlements_enforced):
    user = make_private_seller()
    used = NOW - timedelta(days=5)
    _consumed_free(user, when=used)
    until = NOW + timedelta(days=100)
    paid = _paid(user, valid_until=until)

    payload = ListingEligibilityService.for_user(user, now=NOW).as_dict()

    assert payload == {
        "can_start_listing": True,
        "recommended_entitlement": {
            "entitlement_id": str(paid.pk),
            "entitlement_type": "PAID_LISTING",
            "source": "STRIPE_PURCHASE",
            "valid_until": until,
            "publication_days": 30,
        },
        "free": {
            "available": False,
            "used_at": used,
            "next_available_at": used + timedelta(days=365),
            "publication_days": 30,
        },
        "paid_listing_rights_available": 1,
        "blocking_reason": None,
        "purchase_product_code": "INDIVIDUAL_LISTING_RIGHT",
    }


def test_dataclasses_are_frozen():
    rec = RecommendedEntitlement(None, "FREE_LISTING", "FREE_POLICY", None, 30)
    with pytest.raises(AttributeError):
        rec.publication_days = 1
    elig = Eligibility(
        True,
        None,
        FreeQuotaState(True, None, None, 30, 1, 0),
        0,
        None,
        "X",
    )
    with pytest.raises(AttributeError):
        elig.can_start_listing = False


# --------------------------------------------------------------------------
# Free / paid recommendation
# --------------------------------------------------------------------------


@pytest.mark.django_db
def test_a_fresh_seller_is_recommended_the_free_right(entitlements_enforced):
    result = ListingEligibilityService.for_user(make_private_seller())

    assert result.can_start_listing is True
    assert result.blocking_reason is None
    assert result.recommended_entitlement.entitlement_type == (
        EntitlementType.FREE_LISTING
    )
    assert result.recommended_entitlement.source == EntitlementSource.FREE_POLICY
    # The free right has no ledger row until it is consumed at submit.
    assert result.recommended_entitlement.entitlement_id is None
    assert result.recommended_entitlement.publication_days == 30


@pytest.mark.django_db
def test_an_exhausted_seller_with_no_paid_right_is_blocked(entitlements_enforced):
    user = make_private_seller()
    now = timezone.now()
    make_entitlement(
        user=user,
        entitlement_type=EntitlementType.FREE_LISTING,
        state=EntitlementState.CONSUMED,
        consumed_at=now - timedelta(days=5),
    )

    result = ListingEligibilityService.for_user(user, now=now)

    assert result.can_start_listing is False
    assert result.blocking_reason == BlockingReason.FREE_ALLOWANCE_USED
    assert result.recommended_entitlement is None
    assert result.paid_listing_rights_available == 0
    assert result.free.available is False
    assert result.free.next_available_at is not None


@pytest.mark.django_db
def test_an_exhausted_seller_with_a_paid_right_may_start(entitlements_enforced):
    """Spec §22.3: "If a paid right already exists, show 'Use an available
    listing right' instead of purchase"."""
    user = make_private_seller()
    now = timezone.now()
    make_entitlement(
        user=user,
        entitlement_type=EntitlementType.FREE_LISTING,
        state=EntitlementState.CONSUMED,
        consumed_at=now - timedelta(days=5),
    )
    paid = make_entitlement(
        user=user,
        entitlement_type=EntitlementType.PAID_LISTING,
        source=EntitlementSource.STRIPE_PURCHASE,
        state=EntitlementState.AVAILABLE,
        valid_from=now - timedelta(days=1),
        valid_until=now + timedelta(days=100),
    )

    result = ListingEligibilityService.for_user(user, now=now)

    assert result.can_start_listing is True
    assert result.blocking_reason is None
    assert result.paid_listing_rights_available == 1
    assert result.recommended_entitlement.entitlement_id == str(paid.pk)
    assert result.recommended_entitlement.entitlement_type == (
        EntitlementType.PAID_LISTING
    )
    assert result.recommended_entitlement.publication_days == 30


@pytest.mark.django_db
def test_free_is_preferred_over_a_paid_right(entitlements_enforced):
    user = make_private_seller()
    make_entitlement(
        user=user,
        entitlement_type=EntitlementType.PAID_LISTING,
        source=EntitlementSource.STRIPE_PURCHASE,
        state=EntitlementState.AVAILABLE,
    )

    result = ListingEligibilityService.for_user(user)

    assert result.recommended_entitlement.entitlement_type == (
        EntitlementType.FREE_LISTING
    )
    assert result.recommended_entitlement.entitlement_id is None
    assert result.recommended_entitlement.valid_until is None
    assert result.paid_listing_rights_available == 1


@pytest.mark.django_db
def test_free_preferred_over_paid_even_with_the_flag_off():
    user = make_private_seller()
    _paid(user, valid_until=NOW + timedelta(days=10))

    result = ListingEligibilityService.for_user(user, now=NOW)

    assert result.recommended_entitlement.entitlement_type == (
        EntitlementType.FREE_LISTING
    )


@pytest.mark.django_db
def test_paid_recommendation_is_the_soonest_expiring_right(entitlements_enforced):
    user = make_private_seller()
    _consumed_free(user, when=NOW - timedelta(days=5))
    _paid(user, valid_until=NOW + timedelta(days=300))
    soonest = _paid(user, valid_until=NOW + timedelta(days=20))
    _paid(user, valid_until=NOW + timedelta(days=100))

    result = ListingEligibilityService.for_user(user, now=NOW)

    assert result.paid_listing_rights_available == 3
    assert result.recommended_entitlement.entitlement_id == str(soonest.pk)
    assert result.recommended_entitlement.valid_until == NOW + timedelta(days=20)


@pytest.mark.django_db
def test_the_recommended_paid_source_is_carried_through(entitlements_enforced):
    user = make_private_seller()
    _consumed_free(user, when=NOW - timedelta(days=5))
    grant = _paid(
        user,
        valid_until=NOW + timedelta(days=50),
        source=EntitlementSource.STAFF_GRANT,
    )

    result = ListingEligibilityService.for_user(user, now=NOW)

    assert result.recommended_entitlement.entitlement_id == str(grant.pk)
    assert result.recommended_entitlement.source == EntitlementSource.STAFF_GRANT


@pytest.mark.django_db
def test_publication_days_come_from_the_right_setting(entitlements_enforced):
    """Distinct values so a free/paid swap cannot hide."""
    update_setting(key="individual.free_publish_days", value=7, actor=None)
    update_setting(key="individual.paid_publish_days", value=14, actor=None)
    user = make_private_seller()

    fresh = ListingEligibilityService.for_user(user, now=NOW)
    assert fresh.recommended_entitlement.publication_days == 7
    assert fresh.free.publication_days == 7

    _consumed_free(user, when=NOW - timedelta(days=5))
    _paid(user, valid_until=NOW + timedelta(days=50))
    paid = ListingEligibilityService.for_user(user, now=NOW)
    assert paid.recommended_entitlement.publication_days == 14
    assert paid.free.publication_days == 7


# --------------------------------------------------------------------------
# Paid-right validity window boundaries
# --------------------------------------------------------------------------


@pytest.mark.django_db
def test_a_paid_right_expiring_exactly_now_is_not_available(entitlements_enforced):
    user = make_private_seller()
    _consumed_free(user, when=NOW - timedelta(days=5))
    _paid(user, valid_until=NOW)

    result = ListingEligibilityService.for_user(user, now=NOW)

    assert result.paid_listing_rights_available == 0
    assert result.can_start_listing is False
    assert result.blocking_reason == BlockingReason.FREE_ALLOWANCE_USED


@pytest.mark.django_db
def test_a_paid_right_expiring_one_second_after_now_is_available(
    entitlements_enforced,
):
    user = make_private_seller()
    _consumed_free(user, when=NOW - timedelta(days=5))
    _paid(user, valid_until=NOW + timedelta(seconds=1))

    result = ListingEligibilityService.for_user(user, now=NOW)

    assert result.paid_listing_rights_available == 1
    assert result.can_start_listing is True


@pytest.mark.django_db
def test_a_paid_right_valid_from_exactly_now_is_available(entitlements_enforced):
    user = make_private_seller()
    _consumed_free(user, when=NOW - timedelta(days=5))
    _paid(user, valid_from=NOW, valid_until=NOW + timedelta(days=30))

    result = ListingEligibilityService.for_user(user, now=NOW)

    assert result.paid_listing_rights_available == 1
    assert result.can_start_listing is True


@pytest.mark.django_db
def test_a_paid_right_not_yet_valid_is_not_available(entitlements_enforced):
    user = make_private_seller()
    _consumed_free(user, when=NOW - timedelta(days=5))
    _paid(
        user,
        valid_from=NOW + timedelta(seconds=1),
        valid_until=NOW + timedelta(days=30),
    )

    result = ListingEligibilityService.for_user(user, now=NOW)

    assert result.paid_listing_rights_available == 0
    assert result.recommended_entitlement is None
    assert result.can_start_listing is False


@pytest.mark.django_db
@pytest.mark.parametrize(
    "state",
    [
        EntitlementState.RESERVED,
        EntitlementState.CONSUMED,
        EntitlementState.EXPIRED,
        EntitlementState.REVOKED,
    ],
)
def test_a_paid_right_in_a_non_available_state_does_not_count(
    entitlements_enforced, state
):
    user = make_private_seller()
    _consumed_free(user, when=NOW - timedelta(days=5))
    _paid(user, valid_until=NOW + timedelta(days=30), state=state)

    result = ListingEligibilityService.for_user(user, now=NOW)

    assert result.paid_listing_rights_available == 0
    assert result.can_start_listing is False


@pytest.mark.django_db
def test_a_media_upgrade_entitlement_is_never_a_listing_right(entitlements_enforced):
    user = make_private_seller()
    _consumed_free(user, when=NOW - timedelta(days=5))
    _paid(
        user,
        valid_until=NOW + timedelta(days=30),
        entitlement_type=EntitlementType.MEDIA_UPGRADE,
    )

    result = ListingEligibilityService.for_user(user, now=NOW)

    assert result.paid_listing_rights_available == 0
    assert result.can_start_listing is False


@pytest.mark.django_db
def test_another_users_paid_right_does_not_count(entitlements_enforced):
    user = make_private_seller()
    other = make_private_seller("other-seller@example.com")
    _consumed_free(user, when=NOW - timedelta(days=5))
    _paid(other, valid_until=NOW + timedelta(days=30))

    result = ListingEligibilityService.for_user(user, now=NOW)

    assert result.paid_listing_rights_available == 0
    assert result.can_start_listing is False


# --------------------------------------------------------------------------
# Free window boundaries
# --------------------------------------------------------------------------


@pytest.mark.django_db
def test_free_returns_exactly_one_period_after_the_use(entitlements_enforced):
    user = make_private_seller()
    _consumed_free(user, when=NOW - timedelta(days=365))

    result = ListingEligibilityService.for_user(user, now=NOW)

    assert result.free.available is True
    assert result.can_start_listing is True
    assert result.recommended_entitlement.entitlement_type == (
        EntitlementType.FREE_LISTING
    )


@pytest.mark.django_db
def test_free_is_still_blocked_one_second_before_the_period_ends(
    entitlements_enforced,
):
    user = make_private_seller()
    _consumed_free(user, when=NOW - timedelta(days=365) + timedelta(seconds=1))

    result = ListingEligibilityService.for_user(user, now=NOW)

    assert result.free.available is False
    assert result.can_start_listing is False
    assert result.blocking_reason == BlockingReason.FREE_ALLOWANCE_USED


@pytest.mark.django_db
def test_an_allowance_of_zero_blocks_with_the_flag_on_unless_paid_exists(
    entitlements_enforced,
):
    update_setting(key="individual.free_listing_count", value=0, actor=None)
    user = make_private_seller()

    blocked = ListingEligibilityService.for_user(user, now=NOW)
    assert blocked.can_start_listing is False
    assert blocked.blocking_reason == BlockingReason.FREE_ALLOWANCE_USED
    assert blocked.recommended_entitlement is None

    paid = _paid(user, valid_until=NOW + timedelta(days=30))
    allowed = ListingEligibilityService.for_user(user, now=NOW)
    assert allowed.can_start_listing is True
    assert allowed.recommended_entitlement.entitlement_id == str(paid.pk)


@pytest.mark.django_db
def test_a_larger_allowance_keeps_the_free_right_recommended(entitlements_enforced):
    update_setting(key="individual.free_listing_count", value=2, actor=None)
    user = make_private_seller()
    _consumed_free(user, when=NOW - timedelta(days=10))

    result = ListingEligibilityService.for_user(user, now=NOW)

    assert result.free.available is True
    assert result.recommended_entitlement.entitlement_type == (
        EntitlementType.FREE_LISTING
    )


@pytest.mark.django_db
def test_a_naive_now_is_rejected():
    with pytest.raises(ValueError):
        ListingEligibilityService.for_user(
            make_private_seller(),
            now=datetime(2026, 6, 15, 12, 0, 0),  # noqa: DTZ001 - naive on purpose
        )


# --------------------------------------------------------------------------
# Roles
# --------------------------------------------------------------------------


@pytest.mark.django_db
def test_a_buyer_account_cannot_start_a_private_listing(entitlements_enforced):
    buyer = make_user("buyer@example.com", role=UserRole.PROFESSIONAL, verified=True)

    result = ListingEligibilityService.for_user(buyer)

    assert result.can_start_listing is False
    assert result.blocking_reason == BlockingReason.NOT_AN_INDIVIDUAL_SELLER
    assert result.recommended_entitlement is None


@pytest.mark.django_db
@pytest.mark.parametrize("flag_on", [True, False])
@pytest.mark.parametrize(
    "role",
    [UserRole.BROKER, UserRole.PROFESSIONAL],
)
def test_non_seller_roles_are_refused_whatever_the_flag(role, flag_on):
    if flag_on:
        from platform_settings.services import set_feature_flag

        set_feature_flag(key="individual_entitlements", is_enabled=True, actor=None)
    user = make_user(f"{role.lower()}-{flag_on}@example.com", role=role, verified=True)

    payload = ListingEligibilityService.for_user(user, now=NOW).as_dict()

    assert payload["can_start_listing"] is False
    assert payload["blocking_reason"] == "NOT_AN_INDIVIDUAL_SELLER"
    assert payload["recommended_entitlement"] is None
    assert payload["purchase_product_code"] == "INDIVIDUAL_LISTING_RIGHT"
    # The free block is still reported truthfully.
    assert payload["free"]["available"] is True


@pytest.mark.django_db
def test_a_non_seller_still_reports_its_paid_right_count_but_cannot_start(
    entitlements_enforced,
):
    buyer = make_user("buyer-paid@example.com", role=UserRole.PROFESSIONAL, verified=True)
    _paid(buyer, valid_until=NOW + timedelta(days=30))

    result = ListingEligibilityService.for_user(buyer, now=NOW)

    assert result.paid_listing_rights_available == 1
    assert result.can_start_listing is False
    assert result.blocking_reason == BlockingReason.NOT_AN_INDIVIDUAL_SELLER
    assert result.recommended_entitlement is None


@pytest.mark.django_db
def test_a_staff_admin_is_treated_as_an_individual_seller(entitlements_enforced):
    """accounts.services.resolve_seller_context() lets a staff admin create a
    private-seller listing; eligibility must agree or the two would disagree
    about the same request."""
    admin = make_user("staff-admin@example.com", role=UserRole.STAFF, verified=True)
    admin.groups.add(Group.objects.get_or_create(name=StaffGroup.ADMIN)[0])

    result = ListingEligibilityService.for_user(admin)

    assert result.can_start_listing is True
    assert result.blocking_reason is None
    assert result.recommended_entitlement.entitlement_type == (
        EntitlementType.FREE_LISTING
    )


@pytest.mark.django_db
def test_a_staff_admin_with_a_used_free_right_is_blocked_like_a_seller(
    entitlements_enforced,
):
    admin = _staff("staff-admin2@example.com", group=StaffGroup.ADMIN)
    _consumed_free(admin, when=NOW - timedelta(days=5))

    result = ListingEligibilityService.for_user(admin, now=NOW)

    assert result.can_start_listing is False
    assert result.blocking_reason == BlockingReason.FREE_ALLOWANCE_USED


@pytest.mark.django_db
def test_a_staff_superuser_counts_as_a_staff_admin(entitlements_enforced):
    su = _staff("staff-su@example.com", superuser=True)

    result = ListingEligibilityService.for_user(su, now=NOW)

    assert result.can_start_listing is True


@pytest.mark.django_db
@pytest.mark.parametrize("group", [StaffGroup.MODERATOR, None])
def test_staff_below_admin_is_not_an_individual_seller(entitlements_enforced, group):
    staff = _staff(f"staff-{group}@example.com", group=group)

    result = ListingEligibilityService.for_user(staff, now=NOW)

    assert result.can_start_listing is False
    assert result.blocking_reason == BlockingReason.NOT_AN_INDIVIDUAL_SELLER


@pytest.mark.django_db
def test_an_inactive_staff_admin_is_not_an_individual_seller(entitlements_enforced):
    admin = _staff("staff-inactive@example.com", group=StaffGroup.ADMIN)
    admin.is_active = False
    admin.save(update_fields=["is_active"])

    result = ListingEligibilityService.for_user(admin, now=NOW)

    assert result.can_start_listing is False
    assert result.blocking_reason == BlockingReason.NOT_AN_INDIVIDUAL_SELLER


# --------------------------------------------------------------------------
# Enforcement flag
# --------------------------------------------------------------------------


@pytest.mark.django_db
def test_with_the_flag_off_nothing_blocks_but_the_free_block_stays_truthful():
    """The plan's flag ruling: refusal is gated, bookkeeping is not."""
    user = make_private_seller()
    now = timezone.now()
    make_entitlement(
        user=user,
        entitlement_type=EntitlementType.FREE_LISTING,
        state=EntitlementState.CONSUMED,
        consumed_at=now - timedelta(days=5),
    )

    result = ListingEligibilityService.for_user(user, now=now)

    assert result.can_start_listing is True
    assert result.blocking_reason is None
    assert result.free.available is False
    assert result.free.next_available_at is not None
    assert result.recommended_entitlement is None


@pytest.mark.django_db
def test_with_the_flag_off_a_paid_right_is_still_recommended():
    user = make_private_seller()
    _consumed_free(user, when=NOW - timedelta(days=5))
    paid = _paid(user, valid_until=NOW + timedelta(days=30))

    result = ListingEligibilityService.for_user(user, now=NOW)

    assert result.can_start_listing is True
    assert result.blocking_reason is None
    assert result.recommended_entitlement.entitlement_id == str(paid.pk)
    assert result.paid_listing_rights_available == 1


@pytest.mark.django_db
def test_with_the_flag_off_a_fresh_seller_gets_the_free_recommendation():
    result = ListingEligibilityService.for_user(make_private_seller(), now=NOW)

    assert result.can_start_listing is True
    assert result.recommended_entitlement.entitlement_type == (
        EntitlementType.FREE_LISTING
    )


@pytest.mark.django_db
def test_a_buyer_is_still_refused_with_the_flag_off():
    """The role rule is not part of the entitlement rollout — it is Phase 3's
    ownership rule, which resolve_seller_context enforces regardless."""
    buyer = make_user("buyer2@example.com", role=UserRole.PROFESSIONAL, verified=True)

    result = ListingEligibilityService.for_user(buyer)

    assert result.can_start_listing is False
    assert result.blocking_reason == BlockingReason.NOT_AN_INDIVIDUAL_SELLER
