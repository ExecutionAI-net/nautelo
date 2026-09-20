from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from entitlements.enums import EntitlementState, EntitlementType
from entitlements.models import UserEntitlement
from entitlements.tests.factories import make_entitlement, make_private_seller
from listings.enums import ListingStatus
from listings.policies import effective_media_allowance
from listings.tests.factories import make_private_listing
from platform_settings.services import set_feature_flag


@pytest.fixture(autouse=True)
def _flags(db):
    set_feature_flag(key="listing_revisions", is_enabled=True, actor=None)


def _expired_listing(owner):
    now = timezone.now()
    return make_private_listing(
        owner=owner,
        status=ListingStatus.EXPIRED,
        published_at=now - timedelta(days=31),
        expires_at=now - timedelta(days=1),
    )


@pytest.mark.django_db
def test_a_paid_right_reactivates_an_expired_listing_with_the_paid_media_tier():
    seller = make_private_seller()
    listing = _expired_listing(seller)
    make_entitlement(user=seller, entitlement_type=EntitlementType.PAID_LISTING)
    api = APIClient()
    api.force_authenticate(seller)

    response = api.post(reverse("listing-renew", kwargs={"listing_id": listing.pk}))

    assert response.status_code == 200, response.data
    listing.refresh_from_db()
    assert listing.status == ListingStatus.PUBLISHED
    assert listing.expires_at > timezone.now() + timedelta(days=25)
    allowance = effective_media_allowance(listing)
    assert (allowance.images, allowance.videos) == (20, 1)
    right = UserEntitlement.objects.get(listing=listing)
    assert right.state == EntitlementState.CONSUMED and right.is_renewal


@pytest.mark.django_db
def test_renewal_without_a_paid_right_asks_for_a_purchase():
    seller = make_private_seller()
    listing = _expired_listing(seller)
    api = APIClient()
    api.force_authenticate(seller)

    response = api.post(reverse("listing-renew", kwargs={"listing_id": listing.pk}))

    assert response.status_code == 403
    listing.refresh_from_db()
    assert listing.status == ListingStatus.EXPIRED


@pytest.mark.django_db
def test_a_live_listing_can_be_extended_and_keeps_its_remaining_time():
    seller = make_private_seller()
    now = timezone.now()
    listing = make_private_listing(
        owner=seller,
        status=ListingStatus.PUBLISHED,
        published_at=now - timedelta(days=29),
        expires_at=now + timedelta(days=1),
    )
    make_entitlement(user=seller, entitlement_type=EntitlementType.PAID_LISTING)
    api = APIClient()
    api.force_authenticate(seller)

    assert api.post(reverse("listing-renew", kwargs={"listing_id": listing.pk})).status_code == 200
    listing.refresh_from_db()
    assert listing.expires_at > now + timedelta(days=30)


@pytest.mark.django_db
def test_a_package_right_sets_the_renewal_length_and_media_limits():
    seller = make_private_seller()
    listing = _expired_listing(seller)
    make_entitlement(
        user=seller,
        entitlement_type=EntitlementType.PAID_LISTING,
        metadata={"package": "3-months", "publication_days": 90, "image_limit": 12, "video_limit": 0},
    )
    api = APIClient()
    api.force_authenticate(seller)

    response = api.post(reverse("listing-renew", kwargs={"listing_id": listing.pk}), {"package": "3-months"}, format="json")

    assert response.status_code == 200, response.data
    listing.refresh_from_db()
    assert listing.expires_at > timezone.now() + timedelta(days=85)
    allowance = effective_media_allowance(listing)
    assert (allowance.images, allowance.videos) == (12, 0)
