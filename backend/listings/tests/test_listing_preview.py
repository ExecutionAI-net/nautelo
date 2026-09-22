"""GET /api/v1/listings/<id>/preview/ - the owner's own draft, in the public shape."""

from decimal import Decimal

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from listings.enums import RevisionStatus
from listings.tests.factories import (
    make_media,
    make_private_listing,
    make_revision,
    make_snapshot,
)
from listings.tests.test_public_read_api import _moderator
from platform_settings.services import set_feature_flag

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _flag(db):
    set_feature_flag(key="listing_revisions", is_enabled=True, actor=None)


def _client(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


def test_preview_is_owner_or_broker_editor_only():
    me = make_user(role=UserRole.PRIVATE_SELLER)
    other = make_user(role=UserRole.PRIVATE_SELLER)
    listing = make_private_listing(owner=me)
    url = reverse("listing-preview", kwargs={"listing_id": listing.pk})

    assert _client(me).get(url).status_code == 200
    assert _client(other).get(url).status_code in (403, 404)
    assert APIClient().get(url).status_code == 401


def test_preview_builds_from_the_open_revisions_draft_payload(settings):
    settings.MEDIA_PUBLIC_BASE_URL = "https://cdn.test"
    me = make_user(role=UserRole.PRIVATE_SELLER)
    listing = make_private_listing(owner=me)
    media = make_media(listing)
    make_revision(
        listing,
        payload={
            "title_en": "A lovely sloop",
            "description_en": "Barely used.",
            "specifications": {"boat_type": "Sailing yacht"},
            "location_country": "ES",
            "location_city": "Palma",
            "price": "89000.00",
            "currency": "EUR",
            "media_ids": [str(media.pk)],
        },
    )

    body = _client(me).get(reverse("listing-preview", kwargs={"listing_id": listing.pk})).data

    assert body["title"]["en"] == "A lovely sloop"
    assert body["description"]["en"] == "Barely used."
    assert body["specifications"] == {"boat_type": "Sailing yacht"}
    assert body["location"] == {"country": "ES", "region": "", "city": "Palma", "place_id": None}
    assert body["price"] == {"amount": "89000.00", "currency": "EUR"}
    assert body["slug"] is None
    assert len(body["media"]) == 1
    assert body["media"][0]["media_id"] == str(media.pk)
    assert body["media"][0]["url"] == f"https://cdn.test/{media.storage_key}"
    assert body["brand_name"] == listing.brand.name
    assert body["finance"] == {"visible": False}


def test_preview_falls_back_to_the_published_snapshot_with_no_open_revision():
    me = make_user(role=UserRole.PRIVATE_SELLER)
    listing = make_private_listing(owner=me)
    snapshot = make_snapshot(listing, approved_by=_moderator())
    listing.current_public_snapshot = snapshot
    listing.save(update_fields=["current_public_snapshot"])

    body = _client(me).get(reverse("listing-preview", kwargs={"listing_id": listing.pk})).data

    assert body["title"]["en"] == snapshot.title_en
    assert body["price"]["amount"] == f"{snapshot.price:f}"
    assert body["snapshot_version"] == snapshot.version


def test_preview_prefers_the_pending_edit_over_the_stale_live_snapshot():
    """The whole point of a preview: an already-published listing under active
    edit shows what will go live next, not what is live right now."""
    me = make_user(role=UserRole.PRIVATE_SELLER)
    listing = make_private_listing(owner=me)
    snapshot = make_snapshot(listing, approved_by=_moderator(), title_en="Old title")
    listing.current_public_snapshot = snapshot
    listing.save(update_fields=["current_public_snapshot"])
    make_revision(listing, state=RevisionStatus.DRAFT, payload={"title_en": "New title, pending review"})

    body = _client(me).get(reverse("listing-preview", kwargs={"listing_id": listing.pk})).data

    assert body["title"]["en"] == "New title, pending review"
