import pytest

from accounts.tests.factories import make_user
from brokers.services import set_broker_auto_approval
from brokers.tests.factories import make_broker
from listings.enums import MediaStatus, MediaType, PublicationSource
from listings.policies import (
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
    user = make_user()

    assert ListingEntitlementGate.can_submit(user=user) is True
    assert ListingEntitlementGate.can_submit(user=user, broker=make_broker()) is True


@pytest.mark.django_db
def test_consuming_records_a_publication_source_without_touching_a_ledger():
    listing = make_private_listing(owner=make_user())

    source = ListingEntitlementGate.consume(listing=listing, user=listing.owner_user)

    assert source == PublicationSource.FREE_ENTITLEMENT
    assert listing.consumed_entitlement_id is None


@pytest.mark.django_db
def test_a_broker_submission_records_the_broker_policy_source():
    actor = make_user(email="broker-actor@example.com")
    listing = make_broker_listing(broker=make_broker(), actor=actor)

    source = ListingEntitlementGate.consume(
        listing=listing, user=make_user(email="broker-submitter@example.com")
    )

    assert source == PublicationSource.BROKER_POLICY


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


@pytest.mark.django_db
def test_every_submission_requires_staff_approval_in_this_phase():
    private_listing = make_private_listing(
        owner=make_user(email="private-owner@example.com")
    )
    staff_admin = make_user(email="staff-admin@example.com")
    # Phase 3 makes brokers.services.set_broker_auto_approval the ONLY permitted
    # writer of auto_approve_listings: it is what stamps the paired
    # auto_approve_changed_by / _at audit columns. Never set the field directly.
    broker = set_broker_auto_approval(make_broker(), enabled=True, actor=staff_admin)
    broker_listing = make_broker_listing(
        broker=broker, actor=make_user(email="broker-approval-actor@example.com")
    )

    assert requires_staff_approval(private_listing) is True
    # Deliberate: Phase 12 owns the auto-approval policy (see the ruling above).
    assert requires_staff_approval(broker_listing) is True


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
