import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.tests.factories import make_user
from audit.models import AuditEvent
from entitlements.enums import EntitlementSource, EntitlementState, EntitlementType
from entitlements.models import UserEntitlement
from entitlements.tests.factories import make_entitlement, make_private_seller
from listings.policies import effective_media_allowance
from listings.tests.factories import make_brand, make_private_listing
from platform_settings.services import set_feature_flag

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _flag(db):
    set_feature_flag(key="listing_revisions", is_enabled=True, actor=None)


def upgrade_for(user, listing, **kwargs):
    return make_entitlement(
        user=user,
        listing=listing,
        entitlement_type=EntitlementType.MEDIA_UPGRADE,
        source=EntitlementSource.STRIPE_PURCHASE,
        **kwargs,
    )


def apply(client, listing):
    return client.post(reverse("listing-media-upgrade-apply", args=[listing.pk]))


def test_an_available_upgrade_grants_nothing_until_applied():
    seller = make_private_seller()
    listing = make_private_listing(owner=seller)
    upgrade_for(seller, listing)
    allowance = effective_media_allowance(listing)
    assert (allowance.images, allowance.videos) == (1, 0)


def test_applying_consumes_the_upgrade_and_raises_the_allowance():
    seller = make_private_seller()
    listing = make_private_listing(owner=seller)
    entitlement = upgrade_for(seller, listing)
    client = APIClient()
    client.force_authenticate(seller)

    response = apply(client, listing)

    assert response.status_code == 200
    assert response.data["state"] == "CONSUMED"
    entitlement.refresh_from_db()
    assert entitlement.state == EntitlementState.CONSUMED
    assert entitlement.consumed_at is not None
    allowance = effective_media_allowance(listing)
    assert (allowance.images, allowance.videos) == (20, 1)
    assert AuditEvent.objects.filter(
        action="entitlement.media_upgrade_applied", target_id=str(entitlement.pk)
    ).exists()


def test_applying_twice_is_refused_and_consumes_nothing_more():
    seller = make_private_seller()
    listing = make_private_listing(owner=seller)
    upgrade_for(seller, listing)
    client = APIClient()
    client.force_authenticate(seller)
    apply(client, listing)
    second = apply(client, listing)
    assert second.status_code == 409
    assert second.data["error"]["code"] == "media_upgrade_already_applied"
    assert (
        UserEntitlement.objects.filter(state=EntitlementState.CONSUMED).count() == 1
    )


def test_without_a_purchase_there_is_nothing_to_apply():
    seller = make_private_seller()
    listing = make_private_listing(owner=seller)
    client = APIClient()
    client.force_authenticate(seller)
    response = apply(client, listing)
    assert response.status_code == 409
    assert response.data["error"]["code"] == "media_upgrade_unavailable"


def test_an_upgrade_bound_to_one_listing_never_applies_to_another():
    seller = make_private_seller()
    bought_for = make_private_listing(owner=seller)
    other = make_private_listing(owner=seller, brand=make_brand("Other Brand"))
    upgrade_for(seller, bought_for)
    client = APIClient()
    client.force_authenticate(seller)
    assert apply(client, other).status_code == 409
    assert effective_media_allowance(other).images == 1


def test_an_expired_upgrade_is_not_applicable():
    from datetime import timedelta

    from django.utils import timezone

    seller = make_private_seller()
    listing = make_private_listing(owner=seller)
    past = timezone.now() - timedelta(days=400)
    upgrade_for(seller, listing, valid_from=past, valid_until=past + timedelta(days=30))
    client = APIClient()
    client.force_authenticate(seller)
    assert apply(client, listing).status_code == 409


def test_someone_elses_listing_is_not_found_for_a_non_editor():
    seller = make_private_seller()
    stranger = make_user("stranger@example.com", verified=True)
    listing = make_private_listing(owner=seller)
    upgrade_for(seller, listing)
    client = APIClient()
    client.force_authenticate(stranger)
    assert apply(client, listing).status_code in (403, 404)
    assert (
        UserEntitlement.objects.filter(state=EntitlementState.CONSUMED).count() == 0
    )
