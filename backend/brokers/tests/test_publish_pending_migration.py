"""The one-off data migration that publishes broker listings queued under the old moderation rule."""

import importlib
from unittest import mock

import pytest

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from brokers.enums import BrokerMembershipRole, BrokerOrganizationStatus
from brokers.tests.factories import make_broker, make_membership
from listings.enums import ListingStatus, MediaStatus, MediaType, RevisionStatus
from listings.submissions import submit_listing_revision
from listings.tests.factories import make_broker_listing, make_media, make_revision, make_private_listing

migration = importlib.import_module("brokers.migrations.0014_publish_pending_broker_listings")

pytestmark = pytest.mark.django_db


def _queued_broker_listing(slug, status=BrokerOrganizationStatus.ACTIVE):
    broker = make_broker(name=f"Queued {slug}", slug=slug, status=BrokerOrganizationStatus.ACTIVE)
    actor = make_user(f"{slug}@example.com", role=UserRole.BROKER)
    make_membership(actor, broker, role=BrokerMembershipRole.ADMIN, can_edit_listings=True)
    listing = make_broker_listing(broker=broker, actor=actor)
    image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY)
    revision = make_revision(listing, payload=_payload(image.pk))
    with mock.patch("listings.submissions.requires_staff_approval", return_value=True):
        submit_listing_revision(listing=listing, actor=actor, expected_version=revision.version)
    broker.status = status
    broker.save(update_fields=["status"])
    listing.refresh_from_db()
    assert listing.status == ListingStatus.PENDING_APPROVAL
    return listing, revision


def _payload(image_id):
    from listings.tests.test_auto_approval import _payload as payload

    return payload(image_id)


def test_queued_listings_of_active_brokers_are_published_and_others_stay_pending():
    live, live_revision = _queued_broker_listing("queued-active")
    held, held_revision = _queued_broker_listing("queued-suspended", status=BrokerOrganizationStatus.SUSPENDED)
    owner = make_user("queued-private@example.com")
    private = make_private_listing(owner=owner, status=ListingStatus.PENDING_APPROVAL)

    migration.publish_pending(None, None)

    live.refresh_from_db()
    live_revision.refresh_from_db()
    held.refresh_from_db()
    private.refresh_from_db()
    assert live.status == ListingStatus.PUBLISHED and live.current_public_snapshot_id is not None
    assert live_revision.state == RevisionStatus.APPROVED
    assert held.status == ListingStatus.PENDING_APPROVAL
    assert private.status == ListingStatus.PENDING_APPROVAL
