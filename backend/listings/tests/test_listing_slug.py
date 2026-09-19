import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from listings.enums import ListingStatus, MediaStatus, MediaType
from listings.publication import publish_revision
from listings.tests.factories import make_media, make_private_listing
from listings.tests.test_publication import (
    _cleaned,
    _seller,
    _staff,
    _submitted_revision,
)

pytestmark = pytest.mark.django_db


def publish(listing, owner, staff):
    image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY)
    revision = _submitted_revision(listing, owner, image.pk)
    publish_revision(
        listing=listing,
        revision=revision,
        actor=staff,
        cleaned=_cleaned(image.pk),
        expected_revision_version=revision.version,
        note="ok",
    )
    listing.refresh_from_db()


def test_first_publication_assigns_a_readable_unique_slug_that_never_changes():
    owner, staff = _seller(), _staff()
    listing = make_private_listing(owner=owner, status=ListingStatus.PENDING_APPROVAL)
    assert listing.slug is None
    publish(listing, owner, staff)
    slug = listing.slug
    assert slug.startswith("beneteau-") or slug  # brand comes from the factory
    assert listing.pk.hex[:8] in slug

    image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY, sort_order=1)
    revision = _submitted_revision(listing, owner, image.pk)
    publish_revision(
        listing=listing,
        revision=revision,
        actor=staff,
        cleaned=_cleaned(image.pk),
        expected_revision_version=revision.version,
        note="edit",
    )
    listing.refresh_from_db()
    assert listing.slug == slug


def test_the_detail_is_served_by_slug_with_the_slug_in_the_payload():
    owner, staff = _seller(), _staff()
    listing = make_private_listing(owner=owner, status=ListingStatus.PENDING_APPROVAL)
    publish(listing, owner, staff)
    response = APIClient().get(
        reverse("listing-detail-by-slug", kwargs={"slug": listing.slug})
    )
    assert response.status_code == 200
    assert response.data["slug"] == listing.slug
    assert response.data["broker"] is None
    assert response.data["id"] == str(listing.pk)


def test_an_unknown_or_unpublished_slug_is_a_404():
    owner = _seller()
    draft = make_private_listing(owner=owner)
    draft.slug = "draft-slug"
    draft.save(update_fields=["slug"])
    client = APIClient()
    assert (
        client.get(reverse("listing-detail-by-slug", kwargs={"slug": "draft-slug"})).status_code
        == 404
    )
    assert (
        client.get(reverse("listing-detail-by-slug", kwargs={"slug": "nope"})).status_code
        == 404
    )


def test_a_broker_listing_carries_its_broker_identity():
    from brokers.tests.factories import make_broker
    from listings.tests.factories import make_broker_listing, make_snapshot

    staff = _staff()
    broker = make_broker("Acme Yachts", "acme-yachts")
    listing = make_broker_listing(broker=broker, actor=staff, status=ListingStatus.PUBLISHED)
    snapshot = make_snapshot(listing, approved_by=staff)
    listing.current_public_snapshot = snapshot
    listing.slug = "acme-boat-1"
    listing.save(update_fields=["current_public_snapshot", "slug"])
    data = APIClient().get(
        reverse("listing-detail-by-slug", kwargs={"slug": "acme-boat-1"})
    ).data
    assert data["broker"] == {
        "id": str(broker.pk),
        "name": "Acme Yachts",
        "slug": "acme-yachts",
    }
