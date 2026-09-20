"""Spec §16's authorization outcomes, decided server-side.

Every assertion here is about WHICH of the three result types comes back, and
about the fact that the locked one structurally cannot carry a raw value.
"""

import uuid

import pytest
from django.contrib.auth.models import AnonymousUser, Group
from django.utils import timezone

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from brokers.enums import BrokerOrganizationStatus
from brokers.tests.factories import make_broker
from messaging.contact_access import (
    CONTACT_UNLOCK_FLAG,
    TARGET_TYPE_BY_SEGMENT,
    ContactTargetNotFound,
    GrantedContact,
    LockedContact,
    UnavailableContact,
    resolve_contact_access,
    resolve_contact_target,
)
from messaging.enums import ContactTargetType
from messaging.selectors import active_contact_grant
from messaging.tests.contact_factories import make_contact_grant
from platform_settings.models import FeatureFlag
from professionals.enums import ProfessionalProfileStatus
from professionals.tests.factories import make_professional

pytestmark = pytest.mark.django_db


@pytest.fixture
def unlock_enabled():
    FeatureFlag.objects.update_or_create(
        key=CONTACT_UNLOCK_FLAG,
        defaults={"is_enabled": True, "description": "enabled for this test"},
    )


@pytest.fixture
def viewer():
    return make_user(email="viewer@example.com")


@pytest.fixture
def professional():
    owner = make_user(email="adriatic-owner@example.com", role=UserRole.PROFESSIONAL)
    return make_professional(
        owner,
        display_name="Adriatic Surveyors",
        slug="adriatic-surveyors",
        public_email="info@adriatic.example",
        public_phone="+39055123456",
        website_url="https://adriatic.example",
    )


@pytest.fixture
def broker():
    return make_broker(
        name="Levante Yachts",
        slug="levante-yachts",
        public_email="office@levante.example",
        public_phone="+34900111222",
    )


@pytest.fixture
def other_broker():
    return make_broker(
        name="Ponente Yachts",
        slug="ponente-yachts",
        public_email="office@ponente.example",
        public_phone="+34900333444",
    )


def test_a_guest_sees_the_locked_state_with_masks(professional, unlock_enabled):
    access = resolve_contact_access(
        viewer=AnonymousUser(), segment="professional", target_id=professional.pk
    )

    assert isinstance(access, LockedContact)
    assert access.state == "LOCKED"
    assert access.unlock_rule == "SEND_INQUIRY"
    assert access.email_mask == "i••••@adriatic.example"
    assert access.phone_mask == "+39 ••• ••• ••6"


def test_the_locked_result_has_no_attribute_that_could_hold_a_raw_value(
    professional, unlock_enabled
):
    """The strongest guarantee in this phase: a serializer bug cannot leak what
    the object does not carry."""
    access = resolve_contact_access(
        viewer=AnonymousUser(), segment="professional", target_id=professional.pk
    )

    assert not hasattr(access, "email")
    assert not hasattr(access, "phone")
    assert not hasattr(access, "website_url")


def test_the_unavailable_result_carries_nothing_at_all(
    viewer, professional, unlock_enabled
):
    """A suspended entity's payload is a bare state: not the raw values, and not
    the masks either."""
    make_contact_grant(viewer=viewer, professional=professional)
    professional.status = ProfessionalProfileStatus.SUSPENDED
    professional.save(update_fields=["status", "updated_at"])

    access = resolve_contact_access(
        viewer=viewer, segment="professional", target_id=professional.pk
    )

    assert isinstance(access, UnavailableContact)
    for attribute in ("email", "phone", "website_url", "email_mask", "phone_mask"):
        assert not hasattr(access, attribute)


def test_a_signed_in_viewer_without_a_grant_is_still_locked(
    viewer, professional, unlock_enabled
):
    access = resolve_contact_access(
        viewer=viewer, segment="professional", target_id=professional.pk
    )

    assert isinstance(access, LockedContact)


def test_a_grant_reveals_the_configured_business_contact(
    viewer, professional, unlock_enabled
):
    grant = make_contact_grant(viewer=viewer, professional=professional)

    access = resolve_contact_access(
        viewer=viewer, segment="professional", target_id=professional.pk
    )

    assert isinstance(access, GrantedContact)
    assert access.state == "GRANTED"
    assert access.email == "info@adriatic.example"
    assert access.phone == "+39055123456"
    assert access.website_url == "https://adriatic.example"
    assert access.granted_at == grant.granted_at
    assert access.grant_id == grant.pk


def test_a_grant_reveals_a_brokers_contact_too(viewer, broker, unlock_enabled):
    """The broker branch of the same path; `website_url` is genuinely unset on
    this fixture, and an unset URL is reported as None rather than ""."""
    grant = make_contact_grant(viewer=viewer, broker=broker)

    access = resolve_contact_access(viewer=viewer, segment="broker", target_id=broker.pk)

    assert isinstance(access, GrantedContact)
    assert access.email == "office@levante.example"
    assert access.phone == "+34900111222"
    assert access.website_url is None
    assert access.grant_id == grant.pk


def test_sending_to_one_entity_does_not_unlock_another(
    viewer, broker, professional, unlock_enabled
):
    """Spec §16 acceptance: "Sending to Broker A does not unlock Broker B"."""
    make_contact_grant(viewer=viewer, professional=professional)

    access = resolve_contact_access(viewer=viewer, segment="broker", target_id=broker.pk)

    assert isinstance(access, LockedContact)


def test_a_broker_grant_does_not_unlock_a_second_broker(
    viewer, broker, other_broker, unlock_enabled
):
    """The same rule inside one segment: a grant is scoped to its own row, not
    to the target TYPE."""
    make_contact_grant(viewer=viewer, broker=broker)

    access = resolve_contact_access(
        viewer=viewer, segment="broker", target_id=other_broker.pk
    )

    assert isinstance(access, LockedContact)


def test_a_broker_grant_does_not_unlock_a_professional(
    viewer, broker, professional, unlock_enabled
):
    """The reverse direction of `test_sending_to_one_entity_does_not_unlock_another`:
    the grant lookup must filter BOTH foreign keys, not just the one that
    matches the requested segment."""
    make_contact_grant(viewer=viewer, broker=broker)

    access = resolve_contact_access(
        viewer=viewer, segment="professional", target_id=professional.pk
    )

    assert isinstance(access, LockedContact)


def test_another_viewers_grant_does_not_unlock_for_me(
    viewer, professional, unlock_enabled
):
    """Spec §36.6: "Contact access is not transferable between accounts"."""
    somebody_else = make_user(email="somebody-else@example.com")
    make_contact_grant(viewer=somebody_else, professional=professional)

    access = resolve_contact_access(
        viewer=viewer, segment="professional", target_id=professional.pk
    )

    assert isinstance(access, LockedContact)


def test_a_revoked_grant_re_locks_the_contact(viewer, professional, unlock_enabled):
    make_contact_grant(
        viewer=viewer, professional=professional, revoked_at=timezone.now()
    )

    access = resolve_contact_access(
        viewer=viewer, segment="professional", target_id=professional.pk
    )

    assert isinstance(access, LockedContact)


def test_a_deactivated_account_is_treated_as_a_guest(
    professional, unlock_enabled
):
    """`is_active=False` is a closed account: its old grant does not survive it."""
    closed = make_user(email="closed-account@example.com")
    make_contact_grant(viewer=closed, professional=professional)
    closed.is_active = False
    closed.save(update_fields=["is_active", "updated_at"])

    access = resolve_contact_access(
        viewer=closed, segment="professional", target_id=professional.pk
    )

    assert isinstance(access, LockedContact)


def test_a_suspended_entity_is_unavailable_even_to_a_grant_holder(
    viewer, professional, unlock_enabled
):
    """Spec §16: "suspended entity contact becomes unavailable"."""
    make_contact_grant(viewer=viewer, professional=professional)
    professional.status = ProfessionalProfileStatus.SUSPENDED
    professional.save(update_fields=["status", "updated_at"])

    access = resolve_contact_access(
        viewer=viewer, segment="professional", target_id=professional.pk
    )

    assert isinstance(access, UnavailableContact)
    assert access.state == "UNAVAILABLE"


def test_a_suspended_broker_is_unavailable_too(viewer, broker, unlock_enabled):
    broker.status = BrokerOrganizationStatus.SUSPENDED
    broker.save(update_fields=["status", "updated_at"])

    access = resolve_contact_access(viewer=viewer, segment="broker", target_id=broker.pk)

    assert isinstance(access, UnavailableContact)


@pytest.mark.parametrize(
    "status", [ProfessionalProfileStatus.DRAFT, ProfessionalProfileStatus.PENDING]
)
def test_a_never_public_entity_is_not_found_rather_than_locked(
    professional, status, unlock_enabled
):
    """Matches ProfessionalDetailView's existing rule: a hidden profile's
    existence is never disclosed."""
    professional.status = status
    professional.save(update_fields=["status", "updated_at"])

    with pytest.raises(ContactTargetNotFound):
        resolve_contact_access(
            viewer=AnonymousUser(), segment="professional", target_id=professional.pk
        )


@pytest.mark.parametrize(
    "status", [BrokerOrganizationStatus.DRAFT, BrokerOrganizationStatus.PENDING]
)
def test_a_never_public_broker_is_not_found_either(broker, status, unlock_enabled):
    broker.status = status
    broker.save(update_fields=["status", "updated_at"])

    with pytest.raises(ContactTargetNotFound):
        resolve_contact_access(
            viewer=AnonymousUser(), segment="broker", target_id=broker.pk
        )


def test_an_unknown_id_is_not_found(unlock_enabled):
    with pytest.raises(ContactTargetNotFound):
        resolve_contact_access(
            viewer=AnonymousUser(), segment="broker", target_id=uuid.uuid4()
        )


def test_an_unknown_segment_is_not_found(professional, unlock_enabled):
    with pytest.raises(ContactTargetNotFound):
        resolve_contact_access(
            viewer=AnonymousUser(), segment="listing", target_id=professional.pk
        )


def test_a_private_seller_listing_has_no_grantable_target():
    """Phase 6 contract rule 4: spec §11.8's `target_type` has no member for a
    private person, so a listing is not a contact target at all — the caller
    gets NOT_APPLICABLE from the inquiry flow, never a reveal from here."""
    assert set(TARGET_TYPE_BY_SEGMENT) == {"broker", "professional"}
    assert "listing" not in TARGET_TYPE_BY_SEGMENT


def test_resolve_contact_target_describes_the_entity(broker, professional):
    """The two properties the view layer (Task 3) reads off the target."""
    broker_target = resolve_contact_target(segment="broker", target_id=broker.pk)
    assert broker_target.target_type == ContactTargetType.BROKER
    assert broker_target.id == broker.pk
    assert broker_target.grant_field == "broker"
    assert broker_target.is_suspended is False

    professional_target = resolve_contact_target(
        segment="professional", target_id=professional.pk
    )
    assert professional_target.target_type == ContactTargetType.PROFESSIONAL
    assert professional_target.id == professional.pk
    assert professional_target.grant_field == "professional"

    professional.status = ProfessionalProfileStatus.SUSPENDED
    professional.save(update_fields=["status", "updated_at"])
    assert (
        resolve_contact_target(
            segment="professional", target_id=professional.pk
        ).is_suspended
        is True
    )


def test_the_grant_selector_filters_both_target_columns(viewer, broker, professional):
    """The selector the service reads through, asserted directly: a grant for
    one target kind is invisible to a lookup for the other, and a revoked row is
    invisible to both."""
    broker_grant = make_contact_grant(viewer=viewer, broker=broker)

    assert active_contact_grant(viewer, broker=broker) == broker_grant
    assert active_contact_grant(viewer, professional=professional) is None

    broker_grant.revoked_at = timezone.now()
    broker_grant.save(update_fields=["revoked_at", "updated_at"])
    assert active_contact_grant(viewer, broker=broker) is None


def test_the_grant_selector_refuses_an_ambiguous_lookup(viewer, broker, professional):
    """Neither "both targets" nor "no target" is a meaningful question, and
    answering one would silently widen the scope of a grant."""
    with pytest.raises(ValueError):
        active_contact_grant(viewer, broker=broker, professional=professional)
    with pytest.raises(ValueError):
        active_contact_grant(viewer)


def test_a_staff_moderator_reveals_without_holding_a_grant(professional, unlock_enabled):
    """Spec §5's staff row, and the capability accounts/selectors.py:44 already
    advertises as `reveal_any_contact` on GET /api/v1/session/."""
    moderator = make_user(email="service-moderator@example.com", role=UserRole.STAFF)
    moderator.groups.add(Group.objects.get(name=StaffGroup.MODERATOR))

    access = resolve_contact_access(
        viewer=moderator, segment="professional", target_id=professional.pk
    )

    assert isinstance(access, GrantedContact)
    assert access.email == "info@adriatic.example"
    # No grant exists, so there is no timestamp to report and none is invented.
    assert access.granted_at is None
    assert access.grant_id is None


def test_a_staff_admin_reveals_too(professional, unlock_enabled):
    """accounts.services.is_staff_moderator() lets ADMIN through, matching
    spec §5's table, which ticks both staff columns."""
    admin = make_user(email="service-admin@example.com", role=UserRole.STAFF)
    admin.groups.add(Group.objects.get(name=StaffGroup.ADMIN))

    access = resolve_contact_access(
        viewer=admin, segment="professional", target_id=professional.pk
    )

    assert isinstance(access, GrantedContact)


def test_a_staff_member_who_did_inquire_reports_the_real_grant(
    professional, unlock_enabled
):
    """The grant lookup runs BEFORE the staff branch, so a staff member who
    actually sent an inquiry is not downgraded to a null timestamp."""
    moderator = make_user(email="inquiring-moderator@example.com", role=UserRole.STAFF)
    moderator.groups.add(Group.objects.get(name=StaffGroup.MODERATOR))
    grant = make_contact_grant(viewer=moderator, professional=professional)

    access = resolve_contact_access(
        viewer=moderator, segment="professional", target_id=professional.pk
    )

    assert access.grant_id == grant.pk
    assert access.granted_at == grant.granted_at


def test_a_staff_moderator_does_not_bypass_a_suspension(professional, unlock_enabled):
    """Spec §16 states the suspension rule with no staff carve-out."""
    moderator = make_user(email="suspended-case-moderator@example.com", role=UserRole.STAFF)
    moderator.groups.add(Group.objects.get(name=StaffGroup.MODERATOR))
    professional.status = ProfessionalProfileStatus.SUSPENDED
    professional.save(update_fields=["status", "updated_at"])

    access = resolve_contact_access(
        viewer=moderator, segment="professional", target_id=professional.pk
    )

    assert isinstance(access, UnavailableContact)


def test_a_staff_moderator_does_not_bypass_the_rollout_flag(professional):
    """The staff branch is evaluated after the flag: staff are not a way around
    a disabled feature. No `unlock_enabled` fixture here."""
    moderator = make_user(email="flag-off-moderator@example.com", role=UserRole.STAFF)
    moderator.groups.add(Group.objects.get(name=StaffGroup.MODERATOR))

    access = resolve_contact_access(
        viewer=moderator, segment="professional", target_id=professional.pk
    )

    assert isinstance(access, LockedContact)


def test_an_ordinary_signed_in_user_is_not_mistaken_for_staff(
    viewer, professional, unlock_enabled
):
    """Guards the four tests above: `is_staff_moderator` must not be a no-op
    that lets everyone through."""
    access = resolve_contact_access(
        viewer=viewer, segment="professional", target_id=professional.pk
    )

    assert isinstance(access, LockedContact)


def test_with_the_flag_off_even_a_grant_holder_stays_locked(viewer, professional):
    """The rollout flag gates REVEALING, never locking — the fail-closed
    direction (spec §35.1, §35.2 step 4). No `unlock_enabled` fixture here."""
    make_contact_grant(viewer=viewer, professional=professional)

    access = resolve_contact_access(
        viewer=viewer, segment="professional", target_id=professional.pk
    )

    assert isinstance(access, LockedContact)


def test_with_the_flag_off_a_guest_still_sees_the_locked_masks(professional):
    """The flag closes the reveal; it never blocks the LOCKED display, so the
    masked payload is what an off deployment serves."""
    access = resolve_contact_access(
        viewer=AnonymousUser(), segment="professional", target_id=professional.pk
    )

    assert isinstance(access, LockedContact)
    assert access.email_mask == "i••••@adriatic.example"


def test_the_flag_ships_disabled():
    """Pins the state every test in this package starts from.

    Note what this does and does not prove, now that `_messaging_reference_rows`
    re-asserts the row: it proves the **starting state of the suite** is the
    shipped one (disabled), not that `messaging/0004` inserted it — a
    `transaction=True` test elsewhere in the session can truncate the migration's
    row, which is exactly why the fixture exists. The migration's own default is
    exercised by test_contact_unlock_seed_migration.py, which runs the migration
    against an empty table.
    """
    assert FeatureFlag.objects.get(key=CONTACT_UNLOCK_FLAG).is_enabled is False
