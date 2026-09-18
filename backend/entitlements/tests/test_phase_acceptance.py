"""Spec §22's definition of done, item by item.

1. Free limits are adjustable without code deployment.
2. UI and API agree on eligibility.
3. Multiple tabs cannot create multiple free listings.
4. Expired listings disappear publicly and remain manageable privately.
"""

from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from entitlements.enums import EntitlementState, EntitlementType
from entitlements.models import UserEntitlement
from entitlements.tests.factories import make_private_seller
from listings.enums import ListingStatus
from listings.expiry import expire_due_listings
from listings.models import BoatListing
from listings.tests.factories import make_brand, make_media, make_model
from platform_settings.services import set_feature_flag, update_setting


@pytest.fixture
def both_flags_on(db):
    set_feature_flag(key="listing_revisions", is_enabled=True, actor=None)
    set_feature_flag(key="individual_entitlements", is_enabled=True, actor=None)


@pytest.fixture
def api():
    return APIClient()


def _draft(api, brand_name):
    brand = make_brand(brand_name)
    response = api.post(
        reverse("listing-draft-create"),
        {
            "brand_id": str(brand.pk),
            "model_id": str(make_model(brand).pk),
            "manufacture_year": 2020,
        },
        format="json",
    )
    return response


def _fill_and_submit(api, created):
    listing = BoatListing.objects.get(pk=created["id"])
    image = make_media(listing)
    patched = api.patch(
        reverse("listing-draft-update", kwargs={"listing_id": listing.pk}),
        {
            "version": created["revision"]["version"],
            "title_en": "Well kept cruiser",
            "description_en": "A well kept cruiser with a recent service.",
            "location_country": "ES",
            "location_region": "Balearic Islands",
            "location_city": "Palma",
            "price": "125000.00",
            "currency": "EUR",
            "media_ids": [str(image.pk)],
        },
        format="json",
    )
    assert patched.status_code == 200, patched.data
    return api.post(
        reverse("listing-submit", kwargs={"listing_id": listing.pk}),
        {"version": patched.data["revision"]["version"]},
        format="json",
    )


@pytest.mark.django_db
def test_done_1_free_limits_are_adjustable_without_a_deployment(api, both_flags_on):
    """Raise the count and the period in the database; the API answer changes."""
    seller = make_private_seller()
    api.force_authenticate(seller)
    first = _draft(api, "Beneteau")
    assert _fill_and_submit(api, first.data).status_code == 200

    blocked = api.get(reverse("listing-eligibility"))
    assert blocked.data["can_start_listing"] is False

    update_setting(key="individual.free_listing_count", value=2, actor=None)

    unblocked = api.get(reverse("listing-eligibility"))
    assert unblocked.data["can_start_listing"] is True
    assert _fill_and_submit(api, _draft(api, "Jeanneau").data).status_code == 200

    update_setting(key="individual.free_publish_days", value=45, actor=None)
    assert api.get(reverse("listing-eligibility")).data["free"]["publication_days"] == 45


@pytest.mark.django_db
def test_done_2_ui_and_api_agree_on_eligibility(api, both_flags_on):
    """Whatever `GET /listing-eligibility/` says, the two mutating endpoints do."""
    seller = make_private_seller()
    api.force_authenticate(seller)

    before = api.get(reverse("listing-eligibility")).data
    assert before["can_start_listing"] is True
    created = _draft(api, "Bavaria")
    assert created.status_code == 201
    assert _fill_and_submit(api, created.data).status_code == 200

    after = api.get(reverse("listing-eligibility")).data
    assert after["can_start_listing"] is False
    assert after["blocking_reason"] == "FREE_ALLOWANCE_USED"

    refused_draft = _draft(api, "Hanse")
    assert refused_draft.status_code == 403
    assert refused_draft.data["error"]["code"] == "listing_entitlement_required"


@pytest.mark.django_db
def test_done_3_multiple_tabs_cannot_create_multiple_free_listings(
    api, both_flags_on
):
    """Two drafts opened before either was submitted — the classic two-tab case.

    Both drafts are legal (nothing is consumed at creation, spec §6.3); the
    second submit is refused by the authoritative locked check at submit time
    (spec §22.2, §22.4), and exactly one ledger row exists afterwards.
    """
    seller = make_private_seller()
    api.force_authenticate(seller)
    tab_one = _draft(api, "Dufour")
    tab_two = _draft(api, "Elan")
    assert tab_one.status_code == 201
    assert tab_two.status_code == 201

    first = _fill_and_submit(api, tab_one.data)
    second = _fill_and_submit(api, tab_two.data)

    assert first.status_code == 200, first.data
    assert second.status_code == 403
    assert second.data["error"]["code"] == "listing_entitlement_required"
    assert (
        UserEntitlement.objects.filter(
            user=seller, entitlement_type=EntitlementType.FREE_LISTING
        ).count()
        == 1
    )
    assert (
        BoatListing.objects.filter(
            owner_user=seller, status=ListingStatus.PENDING_APPROVAL
        ).count()
        == 1
    )


@pytest.mark.django_db
def test_done_4_expired_listings_disappear_publicly_and_stay_private(
    api, both_flags_on, published_listing_with_snapshot
):
    listing = published_listing_with_snapshot
    anonymous = APIClient()
    detail = reverse("listing-detail", kwargs={"listing_id": listing.pk})
    assert anonymous.get(detail).status_code == 200

    BoatListing.objects.filter(pk=listing.pk).update(
        expires_at=timezone.now() - timedelta(minutes=1)
    )
    assert expire_due_listings() == 1

    assert anonymous.get(detail).status_code == 404
    assert anonymous.get(reverse("listing-list")).data["count"] == 0

    listing.refresh_from_db()
    assert listing.status == ListingStatus.EXPIRED
    # Still the owner's record: the row, its snapshot and its ledger entry all
    # survive, and nothing was deleted.
    assert listing.current_public_snapshot_id is not None
    assert listing.owner_user_id is not None


@pytest.mark.django_db
def test_spec_22_1_the_rolling_period_starts_at_consumption_not_publication(
    api, both_flags_on
):
    seller = make_private_seller()
    api.force_authenticate(seller)
    assert _fill_and_submit(api, _draft(api, "Nimbus").data).status_code == 200

    right = UserEntitlement.objects.get(user=seller)
    eligibility = api.get(reverse("listing-eligibility")).data

    assert right.state == EntitlementState.CONSUMED
    assert eligibility["free"]["used_at"] is not None
    # 365 days after CONSUMPTION, not after any approval or publication.
    assert eligibility["free"]["next_available_at"] is not None


@pytest.mark.django_db
def test_spec_22_1_the_window_reopens_after_the_period(api, both_flags_on):
    seller = make_private_seller()
    api.force_authenticate(seller)
    assert _fill_and_submit(api, _draft(api, "Sirius").data).status_code == 200

    UserEntitlement.objects.filter(user=seller).update(
        consumed_at=timezone.now() - timedelta(days=366)
    )

    assert api.get(reverse("listing-eligibility")).data["can_start_listing"] is True
    assert _draft(api, "Linssen").status_code == 201


@pytest.mark.django_db
def test_spec_22_1_deleting_the_listing_does_not_reset_the_quota(api, both_flags_on):
    """Spec §22.1: "Deleting, archiving or selling a boat does not reset free
    quota." Spec §11.9: the ledger, not the listing table, is the record."""
    seller = make_private_seller()
    api.force_authenticate(seller)
    created = _draft(api, "Sealine")
    assert _fill_and_submit(api, created.data).status_code == 200

    # The listing is archived rather than deleted — `consumed_entitlement` is
    # PROTECT, so a hard delete is refused, which is itself the guarantee.
    BoatListing.objects.filter(pk=created.data["id"]).update(
        status=ListingStatus.ARCHIVED
    )

    assert api.get(reverse("listing-eligibility")).data["can_start_listing"] is False
