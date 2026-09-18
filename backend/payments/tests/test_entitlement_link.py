"""Phase 13 contract rule 6: `source_payment_id` becomes a real FK."""

import uuid

import pytest
from django.db import IntegrityError, connection, transaction
from django.db.models import ProtectedError

from entitlements.enums import EntitlementSource, EntitlementType
from entitlements.models import UserEntitlement
from entitlements.tests.factories import make_entitlement
from payments.tests.factories import (
    listing_right_product,
    make_order,
    make_payments_seller,
)


def test_the_exactly_once_constraint_exists_with_the_documented_name():
    # No django_db marker: this reads _meta only and touches no database.
    names = {c.name for c in UserEntitlement._meta.constraints}

    assert "entitlements_one_live_right_per_payment" in names
    # Phase 13's five constraints must all survive this task untouched.
    assert {
        "entitlements_validity_window_is_forward",
        "entitlements_consumed_requires_consumed_at",
        "entitlements_reserved_requires_reserved_at",
        "entitlements_revoked_requires_revoked_at",
        "entitlements_one_live_right_per_listing_and_type",
    } <= names


@pytest.mark.django_db
def test_source_payment_is_a_foreign_key_to_payment_order():
    field = UserEntitlement._meta.get_field("source_payment")

    assert field.many_to_one is True
    assert field.related_model.__name__ == "PaymentOrder"
    assert field.null is True
    # Spec §35.3: "Do not roll back a fulfilled Stripe entitlement by deleting
    # it; preserve ledger and reconcile."
    assert field.remote_field.on_delete.__name__ == "PROTECT"
    # The database column keeps its old name, which is why no factory changes.
    assert field.attname == "source_payment_id"


@pytest.mark.django_db
def test_an_entitlement_can_be_linked_to_a_real_order():
    seller = make_payments_seller("p14-link@example.com")
    order = make_order(user=seller, product=listing_right_product())

    right = make_entitlement(
        user=seller,
        entitlement_type=EntitlementType.PAID_LISTING,
        source=EntitlementSource.STRIPE_PURCHASE,
        source_payment_id=order.pk,
    )

    right.refresh_from_db()
    assert right.source_payment_id == order.pk
    assert list(order.granted_entitlements.all()) == [right]


@pytest.mark.django_db
def test_a_dangling_order_id_is_now_refused_by_the_database():
    """The whole point of the conversion: before it, this row was writable and
    silently referred to nothing."""
    seller = make_payments_seller("p14-dangling@example.com")

    with pytest.raises(IntegrityError), transaction.atomic():
        make_entitlement(
            user=seller,
            entitlement_type=EntitlementType.PAID_LISTING,
            source=EntitlementSource.STRIPE_PURCHASE,
            source_payment_id=uuid.uuid4(),
        )
        # Django's FK constraints are DEFERRABLE INITIALLY DEFERRED, so the
        # dangling reference is only checked here, not at INSERT time.
        connection.check_constraints()


@pytest.mark.django_db
def test_an_order_that_granted_a_right_cannot_be_hard_deleted():
    seller = make_payments_seller("p14-protect@example.com")
    order = make_order(user=seller, product=listing_right_product())
    make_entitlement(
        user=seller,
        entitlement_type=EntitlementType.PAID_LISTING,
        source=EntitlementSource.STRIPE_PURCHASE,
        source_payment_id=order.pk,
    )

    with pytest.raises(ProtectedError), transaction.atomic():
        order.delete()


@pytest.mark.django_db
def test_one_payment_cannot_produce_two_live_rights():
    """Spec §6.4: "an entitlement was created exactly once". Task 10's Python
    guards all sit above the database; this is the backstop under them."""
    seller = make_payments_seller("p14-once@example.com")
    order = make_order(user=seller, product=listing_right_product())
    make_entitlement(
        user=seller,
        entitlement_type=EntitlementType.PAID_LISTING,
        source=EntitlementSource.STRIPE_PURCHASE,
        source_payment_id=order.pk,
    )

    with pytest.raises(IntegrityError), transaction.atomic():
        make_entitlement(
            user=seller,
            entitlement_type=EntitlementType.PAID_LISTING,
            source=EntitlementSource.STRIPE_PURCHASE,
            source_payment_id=order.pk,
        )


@pytest.mark.django_db
def test_a_revoked_right_frees_its_payment_for_a_replacement():
    """The cross-target negative. Spec §23.4 revokes on refund and §26.3 lets
    staff restore a right after their own error; a constraint that counted
    REVOKED rows would make both impossible."""
    from entitlements.enums import EntitlementState

    seller = make_payments_seller("p14-once-revoked@example.com")
    order = make_order(user=seller, product=listing_right_product())
    make_entitlement(
        user=seller,
        entitlement_type=EntitlementType.PAID_LISTING,
        source=EntitlementSource.STRIPE_PURCHASE,
        state=EntitlementState.REVOKED,
        source_payment_id=order.pk,
    )

    replacement = make_entitlement(
        user=seller,
        entitlement_type=EntitlementType.PAID_LISTING,
        source=EntitlementSource.STRIPE_PURCHASE,
        source_payment_id=order.pk,
    )

    assert replacement.source_payment_id == order.pk
    assert UserEntitlement.objects.filter(source_payment_id=order.pk).count() == 2


@pytest.mark.django_db
def test_many_rights_may_share_the_empty_payment():
    """The other cross-target negative: free and staff-granted rights have no
    payment, and a non-partial index would allow exactly one of them to exist in
    the entire system."""
    seller = make_payments_seller("p14-once-free@example.com")
    make_entitlement(user=seller)
    make_entitlement(user=seller)

    assert UserEntitlement.objects.filter(source_payment__isnull=True).count() == 2


@pytest.mark.django_db
def test_a_free_entitlement_still_has_no_order():
    """Phase 13's ordinary free path must be untouched by this conversion."""
    seller = make_payments_seller("p14-free@example.com")

    right = make_entitlement(user=seller)

    assert right.source_payment_id is None
    assert right.source == EntitlementSource.FREE_POLICY
