import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.enums import SellerType, UserRole
from accounts.tests.factories import make_user
from brokers.enums import BrokerMembershipRole
from brokers.tests.factories import make_broker, make_membership
from listings.enums import ListingStatus, RevisionStatus
from listings.models import BoatListing, ListingRevision
from listings.tests.factories import make_brand, make_model, other_model_for
from platform_settings.services import set_feature_flag


@pytest.fixture
def workflow_enabled(db):
    set_feature_flag(
        key="listing_revisions", is_enabled=True, actor=None,
        description="Spec §35.1 rollout flag for the listing workflow.",
    )


@pytest.fixture
def api():
    return APIClient()


def _seller(email="private-seller@example.com", **kwargs):
    return make_user(email, role=UserRole.PRIVATE_SELLER, verified=True, **kwargs)


def _body(brand, model, **overrides):
    payload = {
        "brand_id": str(brand.pk),
        "model_id": str(model.pk),
        "manufacture_year": 2020,
        "title_en": "Oceanis 46.1",
    }
    payload.update(overrides)
    return payload


@pytest.mark.django_db
def test_a_private_seller_creates_a_draft_listing_and_its_first_revision(api, workflow_enabled):
    seller = _seller()
    brand = make_brand()
    model = make_model(brand)
    api.force_authenticate(seller)

    response = api.post(
        reverse("listing-draft-create"), _body(brand, model), format="json"
    )

    assert response.status_code == 201
    listing = BoatListing.objects.get(pk=response.data["id"])
    assert listing.status == ListingStatus.DRAFT
    assert listing.seller_type == SellerType.PRIVATE
    assert listing.owner_user_id == seller.pk
    assert listing.broker_id is None
    assert listing.brand_id == brand.pk
    assert listing.model_id == model.pk
    assert listing.manufacture_year == 2020
    revision = ListingRevision.objects.get(listing=listing)
    assert revision.revision_number == 1
    assert revision.state == RevisionStatus.DRAFT
    assert revision.base_snapshot_id is None
    assert revision.payload["title_en"] == "Oceanis 46.1"
    assert response.data["revision"]["version"] == 1


@pytest.mark.django_db
def test_the_response_reports_the_role_policy_capabilities(api, workflow_enabled):
    seller = _seller()
    brand = make_brand()
    api.force_authenticate(seller)

    response = api.post(
        reverse("listing-draft-create"), _body(brand, make_model(brand)), format="json"
    )

    policy = response.data["policy"]
    assert policy["requires_approval"] is True
    # Empty on a fresh draft: the four names lock only after first publication
    # (spec §1, §11.4). Task 9 asserts the populated list on a published listing.
    assert policy["immutable_fields"] == []
    assert policy["image_limit"] == 1
    assert policy["video_limit"] == 0


@pytest.mark.django_db
def test_a_broker_member_creates_a_broker_listing(api, workflow_enabled):
    broker = make_broker()
    agent = make_user("broker-agent@example.com", role=UserRole.BROKER, verified=True)
    make_membership(user=agent, broker=broker, role=BrokerMembershipRole.MANAGER,
                    can_edit_listings=True)
    brand = make_brand()
    api.force_authenticate(agent)

    response = api.post(
        reverse("listing-draft-create"),
        _body(brand, make_model(brand), broker_id=str(broker.pk)),
        format="json",
    )

    assert response.status_code == 201
    listing = BoatListing.objects.get(pk=response.data["id"])
    assert listing.seller_type == SellerType.BROKER
    assert listing.broker_id == broker.pk
    assert listing.owner_user_id is None
    assert response.data["policy"]["image_limit"] == 20
    assert response.data["policy"]["video_limit"] == 1


@pytest.mark.django_db
def test_a_private_seller_cannot_forge_a_broker_listing(api, workflow_enabled):
    seller = _seller()
    broker = make_broker()
    brand = make_brand()
    api.force_authenticate(seller)

    response = api.post(
        reverse("listing-draft-create"),
        _body(brand, make_model(brand), broker_id=str(broker.pk)),
        format="json",
    )

    assert response.status_code == 403
    assert BoatListing.objects.count() == 0


@pytest.mark.django_db
def test_a_seller_type_key_in_the_body_is_rejected(api, workflow_enabled):
    seller = _seller()
    brand = make_brand()
    api.force_authenticate(seller)

    response = api.post(
        reverse("listing-draft-create"),
        _body(brand, make_model(brand), seller_type="BROKER"),
        format="json",
    )

    assert response.status_code == 400
    assert "seller_type" in response.data["error"]["fields"]


@pytest.mark.django_db
def test_an_unverified_email_cannot_create_a_draft(api, workflow_enabled):
    seller = make_user(
        "unverified-seller@example.com",
        role=UserRole.PRIVATE_SELLER,
        verified=False,
        email_verified_at=None,
    )
    brand = make_brand()
    api.force_authenticate(seller)

    response = api.post(
        reverse("listing-draft-create"), _body(brand, make_model(brand)), format="json"
    )

    assert response.status_code == 403
    assert BoatListing.objects.count() == 0


@pytest.mark.django_db
def test_an_anonymous_request_is_rejected(api, workflow_enabled):
    brand = make_brand()

    response = api.post(
        reverse("listing-draft-create"), _body(brand, make_model(brand)), format="json"
    )

    assert response.status_code in (401, 403)


@pytest.mark.django_db
def test_the_endpoint_is_closed_while_the_feature_flag_is_off(api, db):
    seller = _seller()
    brand = make_brand()
    api.force_authenticate(seller)

    response = api.post(
        reverse("listing-draft-create"), _body(brand, make_model(brand)), format="json"
    )

    assert response.status_code == 403
    assert response.data["error"]["code"] == "feature_disabled"
    assert BoatListing.objects.count() == 0


@pytest.mark.django_db
def test_a_model_from_another_brand_is_rejected(api, workflow_enabled):
    seller = _seller()
    brand = make_brand("Beneteau")
    other_brand = make_brand("Jeanneau")
    api.force_authenticate(seller)

    response = api.post(
        reverse("listing-draft-create"),
        _body(brand, make_model(other_brand)),
        format="json",
    )

    assert response.status_code == 400
    assert response.data["error"]["fields"]["model_id"]


@pytest.mark.django_db
def test_the_other_placeholder_requires_custom_text(api, workflow_enabled):
    """One direction of spec §11.4's cross-table rule. The message is pinned to
    BoatListing.clean()'s own wording so this test fails if the service ever
    stops calling full_clean() and some looser check answers instead."""
    seller = _seller()
    brand = make_brand()
    api.force_authenticate(seller)

    response = api.post(
        reverse("listing-draft-create"),
        _body(brand, other_model_for(brand)),
        format="json",
    )

    assert response.status_code == 400
    assert response.data["error"]["fields"]["custom_model_name"] == [
        {
            "message": "The Other model requires custom text between 2 and 100 characters.",
            "code": "invalid",
        }
    ]
    assert BoatListing.objects.count() == 0


@pytest.mark.django_db
def test_a_real_model_rejects_custom_text(api, workflow_enabled):
    """The inverse of the rule above, and the other half of the proof that
    BoatListing.clean() actually runs at this endpoint: custom text is only
    legal alongside the Other placeholder (spec §11.4). The database constraint
    explicitly permits any non-empty string here, so full_clean() is the only
    thing standing between this request and a bad row."""
    seller = _seller()
    brand = make_brand()
    api.force_authenticate(seller)

    response = api.post(
        reverse("listing-draft-create"),
        _body(brand, make_model(brand), custom_model_name="McKenzie"),
        format="json",
    )

    assert response.status_code == 400
    assert response.data["error"]["fields"]["custom_model_name"] == [
        {
            "message": "Custom model text is only allowed when the Other model is selected.",
            "code": "invalid",
        }
    ]
    assert BoatListing.objects.count() == 0


@pytest.mark.django_db
def test_the_other_placeholder_is_accepted_with_custom_text(api, workflow_enabled):
    seller = _seller()
    brand = make_brand()
    api.force_authenticate(seller)

    response = api.post(
        reverse("listing-draft-create"),
        _body(brand, other_model_for(brand), custom_model_name="McKenzie"),
        format="json",
    )

    assert response.status_code == 201
    assert BoatListing.objects.get(pk=response.data["id"]).custom_model_name == "McKenzie"


@pytest.mark.django_db
def test_an_inactive_brand_or_model_is_rejected(api, workflow_enabled):
    seller = _seller()
    brand = make_brand()
    model = make_model(brand)
    model.is_active = False
    model.save(update_fields=["is_active"])
    api.force_authenticate(seller)

    response = api.post(reverse("listing-draft-create"), _body(brand, model), format="json")

    assert response.status_code == 400
    assert response.data["error"]["fields"]["model_id"]
