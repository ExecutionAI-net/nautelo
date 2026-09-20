import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from entitlements.enums import EntitlementSource, EntitlementState, EntitlementType
from entitlements.tests.factories import make_entitlement, make_private_seller
from listings.enums import MediaStatus
from listings.media_policy import IMAGE_MIN_HEIGHT, IMAGE_MIN_WIDTH
from listings.policies import effective_media_allowance
from listings.tests.factories import make_media, make_private_listing
from platform_settings.services import set_feature_flag

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _flags(db):
    set_feature_flag(key="listing_revisions", is_enabled=True, actor=None)


def limits(listing):
    allowance = effective_media_allowance(listing)
    return allowance.images, allowance.videos


def test_a_listing_on_the_free_right_gets_one_photo_and_no_video():
    seller = make_private_seller()
    assert limits(make_private_listing(owner=seller)) == (1, 0)


def test_a_draft_that_will_use_a_purchased_right_already_gets_the_paid_limits():
    seller = make_private_seller()
    make_entitlement(user=seller, state=EntitlementState.CONSUMED)  # free right used
    make_entitlement(
        user=seller,
        entitlement_type=EntitlementType.PAID_LISTING,
        source=EntitlementSource.STRIPE_PURCHASE,
    )
    assert limits(make_private_listing(owner=seller)) == (20, 1)


def test_a_listing_that_consumed_a_purchased_right_keeps_the_paid_limits():
    seller = make_private_seller()
    paid = make_entitlement(
        user=seller,
        entitlement_type=EntitlementType.PAID_LISTING,
        source=EntitlementSource.STRIPE_PURCHASE,
        state=EntitlementState.CONSUMED,
    )
    listing = make_private_listing(owner=seller)
    listing.consumed_entitlement = paid
    listing.save(update_fields=["consumed_entitlement"])
    assert limits(listing) == (20, 1)


def test_the_owner_can_read_one_upload_with_its_rejection_reason():
    seller = make_private_seller()
    listing = make_private_listing(owner=seller)
    media = make_media(listing, status=MediaStatus.REJECTED, rejection_reason="This image is too small.")
    client = APIClient()
    client.force_authenticate(seller)
    body = client.get(reverse("listing-media-detail", args=[listing.pk, media.pk])).data
    assert body["status"] == "REJECTED" and body["rejection_reason"] == "This image is too small."


def test_the_minimum_image_size_lets_a_550_by_410_photo_through():
    assert 550 >= IMAGE_MIN_WIDTH and 410 >= IMAGE_MIN_HEIGHT
