"""Spec §26.3's four staff capabilities, and §36.3's "who, why and expiry"."""

from datetime import timedelta

import pytest
from django.contrib.auth.models import Group
from django.utils import timezone

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from audit.models import AuditEvent
from entitlements.enums import EntitlementSource, EntitlementState, EntitlementType
from entitlements.policy import free_quota_state
from entitlements.services import (
    EntitlementReasonRequired,
    InvalidEntitlementState,
    grant_listing_right,
    restore_consumed_right,
    revoke_entitlement,
)
from entitlements.tests.factories import make_entitlement, make_private_seller


@pytest.fixture
def staff_admin(db):
    admin = make_user("entitlement-admin@example.com", role=UserRole.STAFF, verified=True)
    admin.groups.add(Group.objects.get_or_create(name=StaffGroup.ADMIN)[0])
    return admin


@pytest.mark.django_db
def test_a_granted_right_records_who_why_and_expiry(staff_admin):
    """Spec §36.3: "Staff-granted right must include who, why and expiry"."""
    seller = make_private_seller()

    right = grant_listing_right(
        user=seller, actor=staff_admin, reason="Goodwill after a support incident."
    )

    assert right.entitlement_type == EntitlementType.PAID_LISTING
    assert right.source == EntitlementSource.STAFF_GRANT
    assert right.state == EntitlementState.AVAILABLE
    assert right.granted_by_id == staff_admin.pk
    assert right.metadata["reason"] == "Goodwill after a support incident."
    assert right.valid_until > timezone.now() + timedelta(days=364)


@pytest.mark.django_db
def test_a_grant_without_a_reason_is_refused(staff_admin):
    with pytest.raises(EntitlementReasonRequired) as excinfo:
        grant_listing_right(user=make_private_seller(), actor=staff_admin, reason="  ")

    assert excinfo.value.status_code == 400
    # A dict-detail ValidationError's get_codes() returns a DICT, not a string:
    # this is a FIELD-level code inside a `validation_error` envelope, not a
    # top-level envelope code. See the Global Constraints note.
    assert excinfo.value.get_codes() == {"reason": ["entitlement_reason_required"]}
    assert excinfo.value.detail["reason"][0].code == "entitlement_reason_required"


@pytest.mark.django_db
def test_a_grant_writes_an_audit_event(staff_admin):
    seller = make_private_seller()

    right = grant_listing_right(user=seller, actor=staff_admin, reason="Compensation.")

    event = AuditEvent.objects.get(action="entitlement.granted")
    assert event.target_id == str(right.pk)
    assert event.actor_user_id == staff_admin.pk
    assert event.source == AuditEvent.Source.ADMIN
    assert event.metadata["reason"] == "Compensation."


@pytest.mark.django_db
def test_an_unused_staff_grant_can_be_revoked(staff_admin):
    """Spec §26.3 item 3: "Revoke unused staff-granted right"."""
    seller = make_private_seller()
    right = grant_listing_right(user=seller, actor=staff_admin, reason="Granted in error.")

    revoked = revoke_entitlement(
        entitlement=right, actor=staff_admin, reason="Granted in error."
    )

    assert revoked.state == EntitlementState.REVOKED
    assert revoked.revoked_at is not None
    assert revoked.metadata["revocation_reason"] == "Granted in error."
    assert AuditEvent.objects.filter(action="entitlement.revoked").count() == 1


@pytest.mark.django_db
def test_revoking_an_already_revoked_right_is_refused(staff_admin):
    seller = make_private_seller()
    right = grant_listing_right(user=seller, actor=staff_admin, reason="Oops.")
    revoke_entitlement(entitlement=right, actor=staff_admin, reason="Oops.")

    with pytest.raises(InvalidEntitlementState):
        revoke_entitlement(entitlement=right, actor=staff_admin, reason="Again.")


@pytest.mark.django_db
def test_restoring_a_consumed_free_right_reopens_the_window(staff_admin):
    """Spec §22.1: the right "remains consumed unless staff explicitly restores
    it with an audited remedy"."""
    seller = make_private_seller()
    consumed = make_entitlement(
        user=seller,
        entitlement_type=EntitlementType.FREE_LISTING,
        state=EntitlementState.CONSUMED,
        consumed_at=timezone.now() - timedelta(days=3),
    )
    assert free_quota_state(seller).available is False

    result = restore_consumed_right(
        entitlement=consumed, actor=staff_admin, reason="Expired by staff error."
    )

    assert result.revoked.state == EntitlementState.REVOKED
    # A free right needs no replacement row: eligibility is recomputed from
    # consumption history, and the revoked row no longer counts.
    assert result.replacement is None
    assert free_quota_state(seller).available is True


@pytest.mark.django_db
def test_restoring_a_consumed_paid_right_issues_a_replacement(staff_admin):
    seller = make_private_seller()
    consumed = make_entitlement(
        user=seller,
        entitlement_type=EntitlementType.PAID_LISTING,
        source=EntitlementSource.STRIPE_PURCHASE,
        state=EntitlementState.CONSUMED,
        consumed_at=timezone.now() - timedelta(days=3),
    )

    result = restore_consumed_right(
        entitlement=consumed, actor=staff_admin, reason="Published in error by staff."
    )

    assert result.revoked.state == EntitlementState.REVOKED
    assert result.replacement is not None
    assert result.replacement.entitlement_type == EntitlementType.PAID_LISTING
    assert result.replacement.source == EntitlementSource.STAFF_GRANT
    assert result.replacement.state == EntitlementState.AVAILABLE
    assert result.replacement.metadata["restored_from"] == str(consumed.pk)


@pytest.mark.django_db
def test_restoring_a_right_that_was_never_consumed_is_refused(staff_admin):
    seller = make_private_seller()
    available = grant_listing_right(user=seller, actor=staff_admin, reason="Goodwill.")

    with pytest.raises(InvalidEntitlementState):
        restore_consumed_right(
            entitlement=available, actor=staff_admin, reason="Not consumed."
        )


@pytest.mark.django_db
def test_restoring_does_not_touch_the_listing_it_published(staff_admin):
    """Spec §36.4 keeps moderation and entitlement remedies separate."""
    from listings.enums import ListingStatus
    from listings.tests.factories import make_private_listing

    seller = make_private_seller()
    listing = make_private_listing(owner=seller, status=ListingStatus.PUBLISHED)
    consumed = make_entitlement(
        user=seller,
        listing=listing,
        entitlement_type=EntitlementType.FREE_LISTING,
        state=EntitlementState.CONSUMED,
        consumed_at=timezone.now(),
    )

    restore_consumed_right(
        entitlement=consumed, actor=staff_admin, reason="Staff error."
    )

    listing.refresh_from_db()
    assert listing.status == ListingStatus.PUBLISHED


@pytest.mark.django_db
def test_the_admin_actions_are_staff_admin_only(staff_admin):
    """Spec §5 and Phase 3 contract rule 6: grant/revoke/restore are
    configuration and compensation, so staff-admin, not staff-moderator."""
    from django.contrib.admin.sites import site

    from entitlements.models import UserEntitlement

    admin_class = site._registry[UserEntitlement]
    moderator = make_user("mod@example.com", role=UserRole.STAFF, verified=True)
    moderator.groups.add(Group.objects.get_or_create(name=StaffGroup.MODERATOR)[0])

    class _Request:
        def __init__(self, user):
            self.user = user
            # Django 5.2's ModelAdmin.get_actions() reads `IS_POPUP_VAR in
            # request.GET` on its FIRST line, so a fake request without a .GET
            # raises AttributeError before any permission logic runs.
            self.GET = {}

    assert set(admin_class.get_actions(_Request(staff_admin))) >= {
        "revoke_selected",
        "restore_selected",
    }
    assert "revoke_selected" not in admin_class.get_actions(_Request(moderator))
