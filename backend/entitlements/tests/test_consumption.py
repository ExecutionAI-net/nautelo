"""Spec §22.4's locked, once-only consumption and its 403."""

from datetime import timedelta

import pytest
from django.db import transaction
from django.test.utils import CaptureQueriesContext
from django.db import connection
from django.utils import timezone

from audit.models import AuditEvent
from entitlements.consumption import (
    ListingEntitlementRequired,
    consume_listing_right,
    ensure_can_start_listing,
)
from entitlements.enums import EntitlementSource, EntitlementState, EntitlementType
from entitlements.models import UserEntitlement
from entitlements.tests.factories import make_entitlement, make_private_seller
from listings.tests.factories import make_brand, make_private_listing
from platform_settings.services import update_setting

# `make_private_listing(owner=...)` with no explicit `brand=` derives the brand
# name from the OWNER's pk (`f"Brand {owner.pk.hex[:8]}"`, see
# listings/tests/factories.py), and `BoatBrand.normalized_name` is `unique=True`.
# So a SECOND listing for the SAME owner in the SAME test must be given its own
# brand, or the insert dies with an IntegrityError before the assertion under
# test is ever reached. Every test below that creates two listings for one user
# passes an explicit `brand=make_brand(...)` on the second one for that reason;
# do not "simplify" it away.


@pytest.mark.django_db
def test_a_fresh_seller_consumes_the_free_right_and_gets_a_ledger_row(
    entitlements_enforced,
):
    user = make_private_seller()
    listing = make_private_listing(owner=user)

    right = consume_listing_right(user=user, listing=listing, actor=user)

    assert right.entitlement_type == EntitlementType.FREE_LISTING
    assert right.source == EntitlementSource.FREE_POLICY
    assert right.state == EntitlementState.CONSUMED
    assert right.consumed_at is not None
    assert right.listing_id == listing.pk
    assert right.metadata["publication_days"] == 30
    assert right.metadata["enforced"] is True
    assert UserEntitlement.objects.count() == 1


@pytest.mark.django_db
def test_consumption_writes_an_audit_event(entitlements_enforced):
    user = make_private_seller()
    listing = make_private_listing(owner=user)

    right = consume_listing_right(user=user, listing=listing, actor=user)

    event = AuditEvent.objects.get(action="entitlement.consumed")
    assert event.target_id == str(right.pk)
    assert event.metadata["listing_id"] == str(listing.pk)
    assert event.before["state"] is None
    assert event.after["state"] == EntitlementState.CONSUMED


@pytest.mark.django_db
def test_a_second_listing_is_refused_once_the_free_right_is_gone(
    entitlements_enforced,
):
    user = make_private_seller()
    consume_listing_right(
        user=user, listing=make_private_listing(owner=user), actor=user
    )
    second = make_private_listing(owner=user, brand=make_brand("Sessa Marine"))

    with pytest.raises(ListingEntitlementRequired) as excinfo:
        consume_listing_right(user=user, listing=second, actor=user)

    assert excinfo.value.status_code == 403
    assert excinfo.value.get_codes() == "listing_entitlement_required"
    assert excinfo.value.action == {
        "type": "PURCHASE",
        "product_code": "INDIVIDUAL_LISTING_RIGHT",
    }
    assert UserEntitlement.objects.count() == 1


@pytest.mark.django_db
def test_resubmitting_the_same_listing_reuses_its_right(entitlements_enforced):
    """Spec §22.1: "A rejected submission can be corrected without consuming a
    second right." Spec §36.3: "a submitted right stays associated through
    changes-requested/rejected correction loop"."""
    user = make_private_seller()
    listing = make_private_listing(owner=user)
    first = consume_listing_right(user=user, listing=listing, actor=user)

    # `consumed_entitlement_id` is the column name both before Task 7 (a loose
    # UUIDField) and after it (the FK's attname), so this line survives the
    # conversion unchanged.
    listing.consumed_entitlement_id = first.pk
    listing.save(update_fields=["consumed_entitlement_id", "updated_at"])

    again = consume_listing_right(user=user, listing=listing, actor=user)

    assert again.pk == first.pk
    assert UserEntitlement.objects.count() == 1


@pytest.mark.django_db
def test_a_paid_right_is_consumed_when_the_free_one_is_gone(entitlements_enforced):
    user = make_private_seller()
    consume_listing_right(
        user=user, listing=make_private_listing(owner=user), actor=user
    )
    paid = make_entitlement(
        user=user,
        entitlement_type=EntitlementType.PAID_LISTING,
        source=EntitlementSource.STRIPE_PURCHASE,
        state=EntitlementState.AVAILABLE,
        valid_until=timezone.now() + timedelta(days=90),
    )
    update_setting(key="individual.paid_publish_days", value=60, actor=None)
    second = make_private_listing(owner=user, brand=make_brand("Fairline"))

    right = consume_listing_right(user=user, listing=second, actor=user)

    paid.refresh_from_db()
    assert right.pk == paid.pk
    assert paid.state == EntitlementState.CONSUMED
    assert paid.listing_id == second.pk
    assert paid.metadata["publication_days"] == 60


@pytest.mark.django_db
def test_with_the_flag_off_an_over_allowance_use_is_still_recorded():
    """The plan's flag ruling: refusal is gated, bookkeeping is not."""
    user = make_private_seller()
    consume_listing_right(
        user=user, listing=make_private_listing(owner=user), actor=user
    )
    second = make_private_listing(owner=user, brand=make_brand("Grand Banks"))

    right = consume_listing_right(user=user, listing=second, actor=user)

    assert right.state == EntitlementState.CONSUMED
    assert right.metadata["enforced"] is False
    assert right.metadata["over_allowance"] is True
    assert UserEntitlement.objects.count() == 2


@pytest.mark.django_db(transaction=True)
def test_consumption_takes_a_row_lock_on_the_consuming_user(entitlements_enforced):
    """Spec §22.4: "locks entitlement/quota rows ... Concurrent requests cannot
    consume one entitlement twice."

    The free right has no row to lock until it exists, so the serialisation
    point is the user's own row. This asserts the lock is actually taken rather
    than racing two real connections, which this project deliberately avoids
    (see listings/tests/test_phase_acceptance.py).
    """
    user = make_private_seller()
    listing = make_private_listing(owner=user)

    with CaptureQueriesContext(connection) as captured:
        with transaction.atomic():
            consume_listing_right(user=user, listing=listing, actor=user)

    locking = [
        query["sql"]
        for query in captured.captured_queries
        if "FOR UPDATE" in query["sql"] and "accounts_user" in query["sql"]
    ]
    assert locking, [query["sql"] for query in captured.captured_queries]


@pytest.mark.django_db
def test_ensure_can_start_listing_raises_only_when_enforced():
    user = make_private_seller()
    consume_listing_right(
        user=user, listing=make_private_listing(owner=user), actor=user
    )

    # Flag off: no refusal.
    ensure_can_start_listing(user)


@pytest.mark.django_db
def test_ensure_can_start_listing_raises_with_a_blocking_reason(
    entitlements_enforced,
):
    user = make_private_seller()
    consume_listing_right(
        user=user, listing=make_private_listing(owner=user), actor=user
    )

    with pytest.raises(ListingEntitlementRequired) as excinfo:
        ensure_can_start_listing(user)

    assert excinfo.value.meta == {"blocking_reason": "FREE_ALLOWANCE_USED"}
    assert str(excinfo.value.detail) == "You have used your free listing allowance."


@pytest.mark.django_db
def test_the_refusal_message_follows_the_blocking_reason():
    """The 403's code and status are one value for every reason (spec §30.2),
    but the human-readable message must not claim a free allowance was used when
    the real problem is that the account is not an individual seller."""
    not_a_seller = ListingEntitlementRequired(
        blocking_reason="NOT_AN_INDIVIDUAL_SELLER"
    )

    assert not_a_seller.get_codes() == "listing_entitlement_required"
    assert str(not_a_seller.detail) == (
        "This account cannot create a private-seller listing."
    )


@pytest.mark.xfail(reason="draft gate lands in Task 9", strict=True)
@pytest.mark.django_db
def test_the_error_envelope_carries_the_spec_30_2_action_block(
    entitlements_enforced,
):
    """Spec §30.2's worked example for this exact code includes an `action`
    block; the envelope had no slot for it before this phase."""
    from rest_framework.test import APIClient

    from listings.tests.factories import make_brand, make_model
    from platform_settings.services import set_feature_flag

    set_feature_flag(key="listing_revisions", is_enabled=True, actor=None)
    user = make_private_seller()
    consume_listing_right(
        user=user, listing=make_private_listing(owner=user), actor=user
    )

    api = APIClient()
    api.force_authenticate(user)
    brand = make_brand("Azimut")
    response = api.post(
        "/api/v1/listings/drafts/",
        {
            "brand_id": str(brand.pk),
            "model_id": str(make_model(brand).pk),
            "manufacture_year": 2021,
        },
        format="json",
    )

    assert response.status_code == 403
    assert response.data["error"]["code"] == "listing_entitlement_required"
    assert response.data["error"]["message"] == (
        "You have used your free listing allowance."
    )
    assert response.data["error"]["action"] == {
        "type": "PURCHASE",
        "product_code": "INDIVIDUAL_LISTING_RIGHT",
    }
