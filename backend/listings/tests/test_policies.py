import pytest

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from brokers.enums import BrokerOrganizationStatus
from brokers.tests.factories import make_broker
from listings.enums import ListingStatus, MediaStatus, MediaType, PublicationSource
from listings.policies import (
    AUTO_APPROVABLE_LISTING_STATES,
    ListingEntitlementGate,
    MediaAllowance,
    effective_media_allowance,
    media_counts,
    requires_staff_approval,
)
from listings.tests.factories import (
    make_broker_listing,
    make_media,
    make_private_listing,
)
from platform_settings.models import PlatformSetting


@pytest.mark.django_db
def test_the_entitlement_gate_currently_allows_every_submission():
    # The `individual_entitlements` flag is off by default, so the gate allows.
    user = make_user()

    assert ListingEntitlementGate.can_submit(user=user) is True
    assert ListingEntitlementGate.can_submit(user=user, broker=make_broker()) is True


@pytest.mark.django_db
def test_consuming_records_a_publication_source_without_touching_a_ledger():
    listing = make_private_listing(owner=make_user())

    result = ListingEntitlementGate.consume(listing=listing, user=listing.owner_user)

    assert result.publication_source == PublicationSource.FREE_ENTITLEMENT
    assert result.entitlement is not None


@pytest.mark.django_db
def test_a_broker_submission_records_the_broker_policy_source():
    actor = make_user(email="broker-actor@example.com")
    listing = make_broker_listing(broker=make_broker(), actor=actor)

    result = ListingEntitlementGate.consume(
        listing=listing, user=make_user(email="broker-submitter@example.com")
    )

    assert result.publication_source == PublicationSource.BROKER_POLICY
    assert result.entitlement is None


@pytest.mark.django_db
def test_publication_days_reads_the_staff_configurable_setting():
    listing = make_private_listing(owner=make_user())

    assert ListingEntitlementGate.publication_days(listing=listing) == 30

    setting = PlatformSetting.objects.get(key="individual.free_publish_days")
    setting.value = 45
    setting.save()

    assert ListingEntitlementGate.publication_days(listing=listing) == 45


@pytest.mark.django_db
def test_a_broker_listing_has_no_configured_publication_window():
    listing = make_broker_listing(broker=make_broker(), actor=make_user())

    assert ListingEntitlementGate.publication_days(listing=listing) is None


# NOTE (Phase 12 Task 2): Phase 11's
# `test_every_submission_requires_staff_approval_in_this_phase` lived here. It
# asserted `requires_staff_approval(broker_listing) is True` for an ACTIVE broker
# with the policy ON, with the comment "Phase 12 owns the auto-approval policy".
# This is Phase 12: that expectation is now exactly inverted, so the test is
# replaced by the parametrized suite at the bottom of this file, which covers
# both of its assertions (a private seller, and an active broker with the policy
# on) plus the organization-status and listing-status matrices.


@pytest.mark.django_db
def test_private_base_allowance_is_one_image_and_no_video():
    listing = make_private_listing(owner=make_user())

    assert effective_media_allowance(listing) == MediaAllowance(images=1, videos=0)


@pytest.mark.django_db
def test_broker_allowance_is_twenty_images_and_one_video():
    listing = make_broker_listing(broker=make_broker(), actor=make_user())

    assert effective_media_allowance(listing) == MediaAllowance(images=20, videos=1)


@pytest.mark.django_db
def test_media_counts_include_every_non_rejected_row():
    listing = make_broker_listing(broker=make_broker(), actor=make_user())
    make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.UPLOADING, sort_order=0)
    make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY, sort_order=1)
    make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.REJECTED, sort_order=2)
    make_media(listing, media_type=MediaType.VIDEO, status=MediaStatus.PROCESSING, sort_order=0)

    assert media_counts(listing) == (2, 1)


# --- Phase 12 (spec §21): broker auto-approval policy -----------------------


def _policy_broker(slug, *, auto=False, status=BrokerOrganizationStatus.ACTIVE):
    return make_broker(
        name=f"Broker {slug}",
        slug=slug,
        status=status,
        auto_approve_listings=auto,
    )


@pytest.mark.django_db
def test_a_private_seller_always_requires_staff_approval():
    owner = make_user("policy-private@example.com", role=UserRole.PRIVATE_SELLER)
    listing = make_private_listing(owner=owner)
    assert requires_staff_approval(listing) is True


@pytest.mark.django_db
def test_an_active_broker_skips_staff_approval_even_without_the_old_policy_flag():
    actor = make_user("policy-broker-off@example.com", role=UserRole.BROKER)
    broker = _policy_broker("policy-off", auto=False)
    listing = make_broker_listing(broker=broker, actor=actor)
    assert requires_staff_approval(listing) is False


@pytest.mark.django_db
def test_an_active_broker_with_the_policy_on_skips_staff_approval():
    actor = make_user("policy-broker-on@example.com", role=UserRole.BROKER)
    broker = _policy_broker("policy-on", auto=True)
    listing = make_broker_listing(broker=broker, actor=actor)
    assert requires_staff_approval(listing) is False


@pytest.mark.django_db
@pytest.mark.parametrize(
    "org_status",
    [
        BrokerOrganizationStatus.DRAFT,
        BrokerOrganizationStatus.PENDING,
        BrokerOrganizationStatus.SUSPENDED,
    ],
)
def test_a_non_active_organization_never_auto_approves(org_status):
    """Spec §21 rule 2: 'unlimited' does not bypass suspension."""
    slug = f"policy-org-{org_status.lower()}"
    actor = make_user(f"{slug}@example.com", role=UserRole.BROKER)
    broker = _policy_broker(slug, auto=True, status=org_status)
    listing = make_broker_listing(broker=broker, actor=actor)
    assert requires_staff_approval(listing) is True


@pytest.mark.django_db
@pytest.mark.parametrize(
    "listing_status",
    [
        ListingStatus.PENDING_APPROVAL,
        ListingStatus.SUSPENDED,
        ListingStatus.EXPIRED,
        ListingStatus.ARCHIVED,
    ],
)
def test_a_listing_outside_the_edit_loop_never_auto_approves(listing_status):
    """Spec §21 rules 2 and 5: moderation and suspension are not bypassed, and a
    submission a moderator already owns is not retro-approved."""
    slug = f"policy-state-{listing_status.lower()}"
    actor = make_user(f"{slug}@example.com", role=UserRole.BROKER)
    broker = _policy_broker(slug, auto=True)
    listing = make_broker_listing(broker=broker, actor=actor, status=listing_status)
    assert requires_staff_approval(listing) is True


@pytest.mark.django_db
def test_the_auto_approvable_states_are_the_owner_edit_loop():
    assert AUTO_APPROVABLE_LISTING_STATES == frozenset(
        {ListingStatus.DRAFT, ListingStatus.REJECTED, ListingStatus.PUBLISHED}
    )


@pytest.mark.django_db
def test_brokers_have_no_numeric_listing_quota():
    """Spec §21 rule 1. Phase 13 replaces ListingEntitlementGate's body; this
    test is the tripwire that stops it attaching a quota to brokers."""
    actor = make_user("policy-quota@example.com", role=UserRole.BROKER)
    broker = _policy_broker("policy-quota", auto=False)
    assert ListingEntitlementGate.can_submit(user=actor, broker=broker) is True
