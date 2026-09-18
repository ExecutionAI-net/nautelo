"""Spec §11.9's UserEntitlement, and the database-level guarantees this phase
relies on rather than re-checking in every service."""

from datetime import timedelta

import pytest
from django.db import IntegrityError, transaction
from django.utils import timezone

from entitlements.enums import EntitlementSource, EntitlementState, EntitlementType
from entitlements.models import UserEntitlement
from entitlements.tests.factories import make_entitlement, make_private_seller
from listings.tests.factories import make_private_listing
from platform_settings.models import FeatureFlag


@pytest.mark.django_db
def test_every_spec_11_9_field_exists_with_the_spec_name():
    names = {field.name for field in UserEntitlement._meta.get_fields()}
    assert {
        "id",
        "user",
        "entitlement_type",
        "source",
        "source_payment",
        "listing",
        "state",
        "valid_from",
        "valid_until",
        "reserved_at",
        "consumed_at",
        "revoked_at",
        "metadata",
        "created_at",
        "updated_at",
        # Beyond spec §11.9's list, justified by §36.3's "who, why and expiry".
        "granted_by",
    } <= names


@pytest.mark.django_db
def test_a_consumed_row_without_consumed_at_is_refused_by_the_database():
    user = make_private_seller()
    with pytest.raises(IntegrityError), transaction.atomic():
        make_entitlement(user=user, state=EntitlementState.CONSUMED, consumed_at=None)


@pytest.mark.django_db
def test_a_revoked_row_without_revoked_at_is_refused_by_the_database():
    user = make_private_seller()
    with pytest.raises(IntegrityError), transaction.atomic():
        make_entitlement(user=user, state=EntitlementState.REVOKED, revoked_at=None)


@pytest.mark.django_db
def test_validity_window_must_not_be_inverted():
    user = make_private_seller()
    now = timezone.now()
    with pytest.raises(IntegrityError), transaction.atomic():
        make_entitlement(
            user=user, valid_from=now, valid_until=now - timedelta(days=1)
        )


@pytest.mark.django_db
def test_one_live_right_of_a_type_per_listing():
    """A listing cannot be published by two listing rights at once (spec §36.3:
    "One paid listing right covers one listing publication cycle")."""
    user = make_private_seller()
    listing = make_private_listing(owner=user)
    make_entitlement(
        user=user,
        listing=listing,
        entitlement_type=EntitlementType.FREE_LISTING,
        state=EntitlementState.CONSUMED,
        consumed_at=timezone.now(),
    )
    with pytest.raises(IntegrityError), transaction.atomic():
        make_entitlement(
            user=user,
            listing=listing,
            entitlement_type=EntitlementType.FREE_LISTING,
            state=EntitlementState.CONSUMED,
            consumed_at=timezone.now(),
        )


@pytest.mark.django_db
def test_a_revoked_row_does_not_block_a_replacement_for_the_same_listing():
    """Spec §26.3's staff restore must be able to re-issue against the same
    listing, so the uniqueness rule excludes REVOKED rows."""
    user = make_private_seller()
    listing = make_private_listing(owner=user)
    make_entitlement(
        user=user,
        listing=listing,
        entitlement_type=EntitlementType.FREE_LISTING,
        state=EntitlementState.REVOKED,
        consumed_at=timezone.now(),
        revoked_at=timezone.now(),
    )
    replacement = make_entitlement(
        user=user,
        listing=listing,
        entitlement_type=EntitlementType.FREE_LISTING,
        state=EntitlementState.CONSUMED,
        consumed_at=timezone.now(),
    )
    assert replacement.pk is not None


@pytest.mark.django_db
def test_queryset_helpers_partition_the_ledger():
    user = make_private_seller()
    now = timezone.now()
    live_paid = make_entitlement(
        user=user,
        entitlement_type=EntitlementType.PAID_LISTING,
        source=EntitlementSource.STRIPE_PURCHASE,
        state=EntitlementState.AVAILABLE,
        valid_from=now - timedelta(days=1),
        valid_until=now + timedelta(days=10),
    )
    make_entitlement(
        user=user,
        entitlement_type=EntitlementType.PAID_LISTING,
        state=EntitlementState.AVAILABLE,
        valid_from=now - timedelta(days=20),
        valid_until=now - timedelta(days=1),
    )
    consumed_free = make_entitlement(
        user=user,
        entitlement_type=EntitlementType.FREE_LISTING,
        state=EntitlementState.CONSUMED,
        consumed_at=now,
    )
    make_entitlement(
        user=user,
        entitlement_type=EntitlementType.MEDIA_UPGRADE,
        state=EntitlementState.AVAILABLE,
        valid_until=now + timedelta(days=10),
    )

    rights = UserEntitlement.objects.for_user(user).listing_rights()
    assert list(rights.available(now=now)) == [live_paid]
    assert list(rights.free().consumed()) == [consumed_free]
    assert rights.paid().count() == 2


@pytest.mark.django_db
def test_the_rollout_flag_is_seeded_disabled():
    flag = FeatureFlag.objects.get(key="individual_entitlements")
    assert flag.is_enabled is False


# --- Boundary tests: exact allowed value accepted, just-outside rejected -------


@pytest.mark.django_db
def test_validity_window_of_zero_length_is_refused():
    user = make_private_seller()
    now = timezone.now()
    with pytest.raises(IntegrityError), transaction.atomic():
        make_entitlement(user=user, valid_from=now, valid_until=now)


@pytest.mark.django_db
def test_validity_window_one_microsecond_long_is_accepted():
    user = make_private_seller()
    now = timezone.now()
    row = make_entitlement(
        user=user, valid_from=now, valid_until=now + timedelta(microseconds=1)
    )
    assert row.pk is not None


@pytest.mark.django_db
def test_consumed_row_with_consumed_at_is_accepted():
    user = make_private_seller()
    row = make_entitlement(
        user=user, state=EntitlementState.CONSUMED, consumed_at=timezone.now()
    )
    assert row.pk is not None


@pytest.mark.django_db
def test_revoked_row_with_revoked_at_is_accepted():
    user = make_private_seller()
    row = make_entitlement(
        user=user, state=EntitlementState.REVOKED, revoked_at=timezone.now()
    )
    assert row.pk is not None


@pytest.mark.django_db
def test_a_reserved_row_without_reserved_at_is_refused_by_the_database():
    user = make_private_seller()
    with pytest.raises(IntegrityError), transaction.atomic():
        make_entitlement(user=user, state=EntitlementState.RESERVED, reserved_at=None)


@pytest.mark.django_db
def test_reserved_row_with_reserved_at_is_accepted():
    user = make_private_seller()
    row = make_entitlement(
        user=user, state=EntitlementState.RESERVED, reserved_at=timezone.now()
    )
    assert row.pk is not None


@pytest.mark.django_db
def test_available_row_needs_no_state_timestamps():
    user = make_private_seller()
    row = make_entitlement(user=user, state=EntitlementState.AVAILABLE)
    assert (row.consumed_at, row.reserved_at, row.revoked_at) == (None, None, None)


@pytest.mark.django_db
def test_different_types_may_share_a_listing():
    user = make_private_seller()
    listing = make_private_listing(owner=user)
    for ent_type in (EntitlementType.FREE_LISTING, EntitlementType.PAID_LISTING):
        make_entitlement(
            user=user,
            listing=listing,
            entitlement_type=ent_type,
            state=EntitlementState.CONSUMED,
        )
    assert UserEntitlement.objects.filter(listing=listing).count() == 2


@pytest.mark.django_db
def test_rows_without_a_listing_are_not_unique_constrained():
    user = make_private_seller()
    make_entitlement(user=user, entitlement_type=EntitlementType.FREE_LISTING)
    make_entitlement(user=user, entitlement_type=EntitlementType.FREE_LISTING)
    assert UserEntitlement.objects.for_user(user).count() == 2


@pytest.mark.django_db
def test_every_non_revoked_state_blocks_a_second_row_for_the_listing():
    for state in (
        EntitlementState.AVAILABLE,
        EntitlementState.RESERVED,
        EntitlementState.CONSUMED,
        EntitlementState.EXPIRED,
    ):
        with transaction.atomic():
            sid = transaction.savepoint()
            user = make_private_seller(email=f"uniq-{state.lower()}@example.com")
            listing = make_private_listing(owner=user)
            make_entitlement(user=user, listing=listing, state=state)
            with pytest.raises(IntegrityError), transaction.atomic():
                make_entitlement(user=user, listing=listing, state=state)
            transaction.savepoint_rollback(sid)


@pytest.mark.django_db
def test_available_window_bounds_are_valid_from_inclusive_valid_until_exclusive():
    user = make_private_seller()
    now = timezone.now()
    starts_now = make_entitlement(
        user=user, valid_from=now, valid_until=now + timedelta(days=1)
    )
    ends_now = make_entitlement(
        user=user, valid_from=now - timedelta(days=1), valid_until=now
    )
    starts_later = make_entitlement(
        user=user,
        valid_from=now + timedelta(microseconds=1),
        valid_until=now + timedelta(days=1),
    )
    found = set(UserEntitlement.objects.available(now=now))
    assert starts_now in found
    assert ends_now not in found
    assert starts_later not in found


@pytest.mark.django_db
def test_available_excludes_non_available_states_even_inside_the_window():
    user = make_private_seller()
    make_entitlement(user=user, state=EntitlementState.EXPIRED)
    make_entitlement(user=user, state=EntitlementState.REVOKED)
    make_entitlement(user=user, state=EntitlementState.RESERVED)
    assert UserEntitlement.objects.available().count() == 0


@pytest.mark.django_db
def test_for_user_isolates_other_users():
    a = make_private_seller()
    b = make_private_seller(email="other-seller@example.com")
    mine = make_entitlement(user=a)
    make_entitlement(user=b)
    assert list(UserEntitlement.objects.for_user(a)) == [mine]


@pytest.mark.django_db
def test_admin_ledger_is_read_only_for_every_kind_of_staff_user():
    """Asserted through what Django actually calls (get_readonly_fields and the
    permission methods), not through the `readonly_fields` attribute."""
    from django.contrib import admin
    from django.contrib.auth.models import Group
    from django.test import RequestFactory

    from accounts.enums import StaffGroup, UserRole
    from accounts.tests.factories import make_user

    superuser = make_user(
        "ledger-super@example.com", role=UserRole.STAFF, is_staff=True, is_superuser=True
    )
    staff_admin = make_user(
        "ledger-admin@example.com", role=UserRole.STAFF, is_staff=True
    )
    staff_admin.groups.add(Group.objects.get(name=StaffGroup.ADMIN))
    moderator = make_user(
        "ledger-mod@example.com", role=UserRole.STAFF, is_staff=True
    )

    moderator.groups.add(Group.objects.get(name=StaffGroup.MODERATOR))

    model_admin = admin.site._registry[UserEntitlement]
    row = make_entitlement(user=make_private_seller())
    all_fields = {f.name for f in UserEntitlement._meta.fields}

    for actor in (superuser, staff_admin, moderator):
        request = RequestFactory().get("/")
        request.user = actor
        assert all_fields <= set(model_admin.get_readonly_fields(request, row))
        assert all_fields <= set(model_admin.get_readonly_fields(request, None))
        assert model_admin.has_add_permission(request) is False
        assert model_admin.has_change_permission(request) is False
        assert model_admin.has_change_permission(request, row) is False
        assert model_admin.has_delete_permission(request) is False
        assert model_admin.has_delete_permission(request, row) is False
