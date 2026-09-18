"""Spec §11.9 and §6.3 vocabulary. These values are persisted and returned in
API responses, so the assertions below pin the literal strings, not just the
member names."""

import pytest

from entitlements.enums import (
    ENTITLEMENT_TRANSITIONS,
    LISTING_RIGHT_TYPES,
    PURCHASE_PRODUCT_CODE,
    RESERVATION_TIMEOUT_MINUTES,
    BlockingReason,
    EntitlementSource,
    EntitlementState,
    EntitlementType,
    can_transition_entitlement,
)


def test_entitlement_type_values_match_spec_11_9():
    assert [choice.value for choice in EntitlementType] == [
        "FREE_LISTING",
        "PAID_LISTING",
        "MEDIA_UPGRADE",
    ]


def test_entitlement_source_values_match_spec_11_9():
    assert [choice.value for choice in EntitlementSource] == [
        "FREE_POLICY",
        "STRIPE_PURCHASE",
        "STAFF_GRANT",
    ]


def test_entitlement_state_values_match_spec_11_9():
    assert [choice.value for choice in EntitlementState] == [
        "AVAILABLE",
        "RESERVED",
        "CONSUMED",
        "EXPIRED",
        "REVOKED",
    ]


def test_listing_right_types_excludes_media_upgrade():
    assert LISTING_RIGHT_TYPES == frozenset(
        {EntitlementType.FREE_LISTING, EntitlementType.PAID_LISTING}
    )


@pytest.mark.parametrize(
    ("current", "target"),
    [
        (EntitlementState.AVAILABLE, EntitlementState.RESERVED),
        (EntitlementState.AVAILABLE, EntitlementState.CONSUMED),
        (EntitlementState.AVAILABLE, EntitlementState.EXPIRED),
        (EntitlementState.RESERVED, EntitlementState.CONSUMED),
        (EntitlementState.RESERVED, EntitlementState.AVAILABLE),
        (EntitlementState.CONSUMED, EntitlementState.REVOKED),
    ],
)
def test_spec_6_3_edges_are_allowed(current, target):
    assert can_transition_entitlement(current, target) is True


@pytest.mark.parametrize(
    ("current", "target"),
    [
        (EntitlementState.CONSUMED, EntitlementState.AVAILABLE),
        (EntitlementState.CONSUMED, EntitlementState.EXPIRED),
        (EntitlementState.EXPIRED, EntitlementState.AVAILABLE),
        (EntitlementState.REVOKED, EntitlementState.AVAILABLE),
        (EntitlementState.REVOKED, EntitlementState.CONSUMED),
    ],
)
def test_edges_outside_spec_6_3_are_refused(current, target):
    assert can_transition_entitlement(current, target) is False


def test_terminal_states_have_no_outbound_edges():
    assert ENTITLEMENT_TRANSITIONS[EntitlementState.EXPIRED] == frozenset()
    assert ENTITLEMENT_TRANSITIONS[EntitlementState.REVOKED] == frozenset()


def test_every_state_has_a_transition_entry():
    assert set(ENTITLEMENT_TRANSITIONS) == {state.value for state in EntitlementState}


def test_blocking_reasons_are_the_closed_set():
    assert BlockingReason.ALL == frozenset(
        {"FREE_ALLOWANCE_USED", "NOT_AN_INDIVIDUAL_SELLER"}
    )
    assert BlockingReason.FREE_ALLOWANCE_USED == "FREE_ALLOWANCE_USED"


def test_purchase_product_code_and_reservation_timeout_match_the_spec():
    assert PURCHASE_PRODUCT_CODE == "INDIVIDUAL_LISTING_RIGHT"
    assert RESERVATION_TIMEOUT_MINUTES == 30
