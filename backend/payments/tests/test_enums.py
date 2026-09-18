"""Spec §23.1's closed product set and §6.4's payment state machine."""

import pytest

from entitlements.enums import EntitlementType
from payments.enums import (
    IDEMPOTENCY_RETENTION_DAYS,
    LISTING_BOUND_PRODUCTS,
    PAID_STATES,
    PAYMENT_TRANSITIONS,
    PRODUCT_CODES,
    PRODUCT_ENTITLEMENT_TYPES,
    STRIPE_CHECKOUT_FLAG,
    STRIPE_SIGNATURE_TOLERANCE_SECONDS,
    TERMINAL_PAYMENT_STATES,
    PaymentOrderStatus,
    ProductCode,
    WebhookResult,
    can_transition_payment,
)

S = PaymentOrderStatus

ALLOWED_EDGES = {
    ("CREATED", "CHECKOUT_OPEN"),
    ("CREATED", "FAILED"),
    ("CREATED", "EXPIRED"),
    ("CHECKOUT_OPEN", "PAID"),
    ("CHECKOUT_OPEN", "FAILED"),
    ("CHECKOUT_OPEN", "EXPIRED"),
    ("PAID", "FULFILLED"),
    ("PAID", "REFUNDED"),
    ("PAID", "DISPUTED"),
    ("FULFILLED", "REFUNDED"),
    ("FULFILLED", "DISPUTED"),
    ("REFUNDED", "DISPUTED"),
    ("DISPUTED", "REFUNDED"),
}


def test_exactly_the_two_spec_23_1_product_codes_exist():
    """Spec §23.1: "supports exactly these product codes in this release"."""
    assert PRODUCT_CODES == {"INDIVIDUAL_LISTING_RIGHT", "LISTING_MEDIA_UPGRADE"}
    assert ProductCode.INDIVIDUAL_LISTING_RIGHT == "INDIVIDUAL_LISTING_RIGHT"
    assert ProductCode.LISTING_MEDIA_UPGRADE == "LISTING_MEDIA_UPGRADE"
    assert {(m.name, m.value) for m in ProductCode} == {
        ("INDIVIDUAL_LISTING_RIGHT", "INDIVIDUAL_LISTING_RIGHT"),
        ("LISTING_MEDIA_UPGRADE", "LISTING_MEDIA_UPGRADE"),
    }


def test_each_product_maps_to_a_real_entitlement_type():
    """The mapping must use Phase 13's merged vocabulary, not a local copy."""
    assert PRODUCT_ENTITLEMENT_TYPES == {
        ProductCode.INDIVIDUAL_LISTING_RIGHT: EntitlementType.PAID_LISTING,
        ProductCode.LISTING_MEDIA_UPGRADE: EntitlementType.MEDIA_UPGRADE,
    }
    assert set(PRODUCT_ENTITLEMENT_TYPES) == PRODUCT_CODES
    assert PRODUCT_ENTITLEMENT_TYPES["INDIVIDUAL_LISTING_RIGHT"] == "PAID_LISTING"
    assert PRODUCT_ENTITLEMENT_TYPES["LISTING_MEDIA_UPGRADE"] == "MEDIA_UPGRADE"


def test_only_the_media_upgrade_binds_to_a_listing():
    """Spec §23.1: the upgrade is "bound to one eligible private-seller
    listing"; the listing right is not bound to anything at purchase time."""
    assert LISTING_BOUND_PRODUCTS == {ProductCode.LISTING_MEDIA_UPGRADE}


def test_payment_order_status_members_and_values_are_exact():
    names = {
        "CREATED",
        "CHECKOUT_OPEN",
        "PAID",
        "FULFILLED",
        "FAILED",
        "EXPIRED",
        "REFUNDED",
        "DISPUTED",
    }
    assert {(m.name, m.value) for m in PaymentOrderStatus} == {(n, n) for n in names}


def test_the_spec_6_4_forward_chain_is_permitted():
    assert can_transition_payment(
        PaymentOrderStatus.CREATED, PaymentOrderStatus.CHECKOUT_OPEN
    )
    assert can_transition_payment(
        PaymentOrderStatus.CHECKOUT_OPEN, PaymentOrderStatus.PAID
    )
    assert can_transition_payment(PaymentOrderStatus.PAID, PaymentOrderStatus.FULFILLED)


@pytest.mark.parametrize(
    "source", [PaymentOrderStatus.CREATED, PaymentOrderStatus.CHECKOUT_OPEN]
)
@pytest.mark.parametrize(
    "target", [PaymentOrderStatus.FAILED, PaymentOrderStatus.EXPIRED]
)
def test_an_unpaid_order_may_fail_or_expire(source, target):
    assert can_transition_payment(source, target)


@pytest.mark.parametrize(
    "source", [PaymentOrderStatus.PAID, PaymentOrderStatus.FULFILLED]
)
@pytest.mark.parametrize(
    "target", [PaymentOrderStatus.REFUNDED, PaymentOrderStatus.DISPUTED]
)
def test_spec_6_4_paid_or_fulfilled_may_become_refunded_or_disputed(source, target):
    assert can_transition_payment(source, target)


@pytest.mark.parametrize(
    ("source", "target"),
    [
        # The single most important negative edge in this phase: a late
        # checkout.session.completed must never resurrect a refunded order.
        (PaymentOrderStatus.REFUNDED, PaymentOrderStatus.PAID),
        (PaymentOrderStatus.REFUNDED, PaymentOrderStatus.FULFILLED),
        (PaymentOrderStatus.DISPUTED, PaymentOrderStatus.FULFILLED),
        # A failed or expired order is final: a later "paid" event is a bug or
        # an attack, never a legitimate resurrection.
        (PaymentOrderStatus.FAILED, PaymentOrderStatus.PAID),
        (PaymentOrderStatus.EXPIRED, PaymentOrderStatus.PAID),
        # Skipping payment entirely.
        (PaymentOrderStatus.CREATED, PaymentOrderStatus.FULFILLED),
        (PaymentOrderStatus.CHECKOUT_OPEN, PaymentOrderStatus.FULFILLED),
        # Fulfilling twice.
        (PaymentOrderStatus.FULFILLED, PaymentOrderStatus.FULFILLED),
        (PaymentOrderStatus.FULFILLED, PaymentOrderStatus.PAID),
    ],
)
def test_forbidden_payment_transitions_are_refused(source, target):
    assert can_transition_payment(source, target) is False


def test_the_transition_table_is_exactly_the_allowed_edge_set():
    """Every one of the 64 (source, target) pairs: allowed iff in the pinned
    set. Catches any added or dropped edge, including self-loops."""
    for source in PaymentOrderStatus.values:
        for target in PaymentOrderStatus.values:
            expected = (source, target) in ALLOWED_EDGES
            assert can_transition_payment(source, target) is expected, (
                source,
                target,
            )
    assert sum(len(v) for v in PAYMENT_TRANSITIONS.values()) == len(ALLOWED_EDGES)


def test_unknown_states_transition_nowhere():
    assert can_transition_payment("NOPE", "PAID") is False
    assert can_transition_payment("CREATED", "NOPE") is False


def test_every_status_has_a_transition_entry():
    """A status missing from the map would silently forbid every transition out
    of it — a bug that only shows up in production."""
    assert set(PAYMENT_TRANSITIONS) == set(PaymentOrderStatus.values)


def test_terminal_states_have_no_outgoing_edges():
    assert TERMINAL_PAYMENT_STATES == {
        PaymentOrderStatus.FAILED,
        PaymentOrderStatus.EXPIRED,
    }
    for state in TERMINAL_PAYMENT_STATES:
        assert PAYMENT_TRANSITIONS[state] == frozenset()


def test_paid_states_are_the_ones_where_money_has_moved():
    assert PAID_STATES == {
        PaymentOrderStatus.PAID,
        PaymentOrderStatus.FULFILLED,
        PaymentOrderStatus.REFUNDED,
        PaymentOrderStatus.DISPUTED,
    }


def test_the_flag_key_is_spec_35_1s_literal():
    assert STRIPE_CHECKOUT_FLAG == "stripe_entitlement_checkout"


def test_the_signature_tolerance_is_stripes_own_default():
    assert STRIPE_SIGNATURE_TOLERANCE_SECONDS == 300


def test_the_idempotency_retention_window_is_thirty_days():
    assert IDEMPOTENCY_RETENTION_DAYS == 30


def test_webhook_results_are_a_closed_set():
    expected = {
        "RECEIVED",
        "FULFILLED",
        "ALREADY_FULFILLED",
        "IGNORED",
        "MISMATCH",
        "GRANT_CONFLICT",
        "ORDER_NOT_FOUND",
        "EXPIRED",
        "REFUND_HANDLED",
        "DISPUTE_HANDLED",
    }
    assert set(WebhookResult.values) == expected
    assert {(m.name, m.value) for m in WebhookResult} == {(n, n) for n in expected}
