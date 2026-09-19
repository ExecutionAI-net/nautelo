import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.test import APIClient

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from listings.drafts import update_listing_draft
from listings.enums import ListingStatus, RevisionStatus
from listings.models import ListingRevision
from listings.tests.factories import (
    make_brand,
    make_model,
    make_private_listing,
    make_revision,
    make_snapshot,
)
from platform_settings.services import set_feature_flag


@pytest.fixture
def workflow_enabled(db):
    set_feature_flag(key="listing_revisions", is_enabled=True, actor=None)


@pytest.fixture
def api():
    return APIClient()


def _seller(email="private-seller@example.com"):
    return make_user(email, role=UserRole.PRIVATE_SELLER, verified=True)


def _staff(email="staff@example.com"):
    return make_user(email)


def _url(listing):
    return reverse("listing-draft-update", kwargs={"listing_id": listing.pk})


def _published(owner):
    """A private listing that has been published once, so the owner's taxonomy
    fields are locked and there is no open revision."""
    listing = make_private_listing(owner=owner, status=ListingStatus.PUBLISHED)
    listing.current_public_snapshot = make_snapshot(listing, approved_by=_staff())
    listing.save(update_fields=["current_public_snapshot"])
    return listing


@pytest.mark.django_db
def test_a_patch_merges_into_the_stored_payload(api, workflow_enabled):
    owner = _seller()
    listing = make_private_listing(owner=owner)
    revision = make_revision(listing, payload={"title_en": "First", "location_city": "Genoa"})
    api.force_authenticate(owner)

    response = api.patch(
        _url(listing), {"version": revision.version, "price": "99000.00"}, format="json"
    )

    assert response.status_code == 200
    revision.refresh_from_db()
    assert revision.payload["title_en"] == "First"
    assert revision.payload["price"] == "99000.00"
    assert revision.version == 2
    assert response.data["revision"]["version"] == 2


@pytest.mark.django_db
def test_a_patch_mirrors_payload_fields_onto_the_listing_columns(api, workflow_enabled):
    owner = _seller()
    listing = make_private_listing(owner=owner, price=None)
    revision = make_revision(listing)
    api.force_authenticate(owner)

    api.patch(_url(listing), {"version": revision.version, "price": "99000.00"},
              format="json")

    listing.refresh_from_db()
    assert str(listing.price) == "99000.00"


@pytest.mark.django_db
def test_an_explicit_null_removes_a_key_from_the_payload(api, workflow_enabled):
    owner = _seller()
    listing = make_private_listing(owner=owner)
    revision = make_revision(listing, payload={"title_en": "Keep", "location_region": "Liguria"})
    api.force_authenticate(owner)

    api.patch(_url(listing), {"version": revision.version, "location_region": None},
              format="json")

    revision.refresh_from_db()
    assert "location_region" not in revision.payload
    assert revision.payload["title_en"] == "Keep"


@pytest.mark.django_db
def test_a_stale_version_is_refused_with_409_and_current_version_metadata(api, workflow_enabled):
    owner = _seller()
    listing = make_private_listing(owner=owner)
    revision = make_revision(listing)
    api.force_authenticate(owner)
    api.patch(_url(listing), {"version": 1, "title_en": "First writer wins"},
              format="json")

    response = api.patch(
        _url(listing), {"version": 1, "title_en": "Second writer loses"}, format="json"
    )

    assert response.status_code == 409
    assert response.data["error"]["code"] == "stale_version"
    assert response.data["error"]["meta"] == {"resource": "revision", "current_version": 2}
    revision.refresh_from_db()
    assert revision.payload["title_en"] == "First writer wins"


@pytest.mark.django_db
def test_the_version_field_is_required(api, workflow_enabled):
    owner = _seller()
    listing = make_private_listing(owner=owner)
    make_revision(listing)
    api.force_authenticate(owner)

    response = api.patch(_url(listing), {"title_en": "No version"}, format="json")

    assert response.status_code == 400
    assert "version" in response.data["error"]["fields"]


@pytest.mark.django_db
def test_another_user_cannot_edit_someone_elses_listing(api, workflow_enabled):
    listing = make_private_listing(owner=_seller())
    revision = make_revision(listing)
    api.force_authenticate(_seller("intruder@example.com"))

    response = api.patch(_url(listing), {"version": revision.version, "title_en": "Mine now"},
                         format="json")

    # Deterministically 403, not 404: the view looks the listing up with
    # get_object_or_404 and only then calls check_object_permissions, so an
    # existing listing always reaches IsOwnerOrBrokerEditor's refusal.
    assert response.status_code == 403
    assert response.data["error"]["code"] == "not_object_owner"
    revision.refresh_from_db()
    assert "title_en" not in revision.payload


@pytest.mark.django_db
def test_a_submitted_revision_cannot_be_edited(api, workflow_enabled):
    owner = _seller()
    listing = make_private_listing(owner=owner, status=ListingStatus.PENDING_APPROVAL)
    revision = make_revision(
        listing, state=RevisionStatus.SUBMITTED, submitted_by=owner,
        submitted_at=timezone.now(),
    )
    api.force_authenticate(owner)

    response = api.patch(_url(listing), {"version": revision.version, "title_en": "Sneaky"},
                         format="json")

    assert response.status_code == 409
    assert response.data["error"]["code"] == "invalid_revision_state"


@pytest.mark.django_db
def test_a_published_listing_opens_a_new_revision_seeded_from_its_snapshot(api, workflow_enabled):
    owner = _seller()
    listing = make_private_listing(owner=owner, status=ListingStatus.PUBLISHED)
    snapshot = make_snapshot(listing, approved_by=_staff())
    listing.current_public_snapshot = snapshot
    listing.save(update_fields=["current_public_snapshot"])
    api.force_authenticate(owner)

    response = api.patch(
        _url(listing), {"version": listing.version, "price": "115000.00"}, format="json"
    )

    assert response.status_code == 200
    revision = ListingRevision.objects.get(listing=listing, state=RevisionStatus.DRAFT)
    assert revision.revision_number == 1
    assert revision.base_snapshot_id == snapshot.pk
    # Seeded from the live snapshot, then patched.
    assert revision.payload["title_en"] == snapshot.title_en
    assert revision.payload["price"] == "115000.00"
    listing.refresh_from_db()
    assert listing.status == ListingStatus.PUBLISHED


@pytest.mark.django_db
def test_opening_a_revision_on_a_published_listing_uses_the_listing_version(api, workflow_enabled):
    """With no open revision yet, the client has nothing but the listing's own
    version to send, so the service accepts it against the listing."""
    owner = _seller()
    listing = _published(owner)
    api.force_authenticate(owner)

    stale = api.patch(_url(listing), {"version": 99, "price": "1.00"}, format="json")

    assert stale.status_code == 409
    assert stale.data["error"]["code"] == "stale_version"
    assert stale.data["error"]["meta"]["resource"] == "listing"
    assert stale.data["error"]["meta"]["current_version"] == listing.version


@pytest.mark.django_db
def test_a_stale_version_against_an_open_revision_names_the_revision_resource(api, workflow_enabled):
    """The mirror image of the test above: once a revision is open the
    compare-and-swap moves to the revision, and the 409 must say so."""
    owner = _seller()
    listing = make_private_listing(owner=owner)
    revision = make_revision(listing)
    api.force_authenticate(owner)

    stale = api.patch(
        _url(listing), {"version": revision.version + 50, "title_en": "x"}, format="json"
    )

    assert stale.status_code == 409
    assert stale.data["error"]["meta"] == {
        "resource": "revision",
        "current_version": revision.version,
    }


@pytest.mark.django_db
def test_a_published_private_listing_rejects_locked_fields(api, workflow_enabled):
    owner = _seller()
    listing = _published(owner)
    api.force_authenticate(owner)

    response = api.patch(
        _url(listing), {"version": listing.version, "manufacture_year": 2001},
        format="json",
    )

    assert response.status_code == 400
    assert response.data["error"]["fields"]["manufacture_year"] == [
        {
            "message": "This field cannot be changed after the listing was first published.",
            "code": "immutable_after_publication",
        }
    ]
    listing.refresh_from_db()
    assert listing.manufacture_year != 2001


@pytest.mark.django_db
def test_a_null_cannot_delete_a_locked_field(api, workflow_enabled):
    """A removal bypasses validate_revision_payload, so the allow-list guard
    inside update_listing_draft is the only thing refusing it."""
    owner = _seller()
    listing = _published(owner)
    api.force_authenticate(owner)

    response = api.patch(
        _url(listing), {"version": listing.version, "manufacture_year": None},
        format="json",
    )

    assert response.status_code == 400
    assert response.data["error"]["fields"]["manufacture_year"] == [
        {"message": "This field cannot be changed.", "code": "immutable_after_publication"}
    ]
    # The whole request rolled back: no revision was opened behind the refusal.
    assert not ListingRevision.objects.filter(listing=listing).exists()
    listing.refresh_from_db()
    assert listing.manufacture_year is not None


@pytest.mark.django_db
def test_the_removal_guard_codes_a_locked_field_as_immutable_after_publication(workflow_enabled):
    """Asserted at the service boundary, where the detail is still an ErrorDetail
    - see test_a_published_private_listing_rejects_locked_fields for the same
    code surviving all the way into the rendered envelope's `fields` map."""
    owner = _seller()
    listing = _published(owner)

    with pytest.raises(DRFValidationError) as excinfo:
        update_listing_draft(
            listing=listing,
            actor=owner,
            expected_version=listing.version,
            payload={"manufacture_year": None, "brand_id": None},
        )

    detail = excinfo.value.detail
    assert detail["manufacture_year"][0].code == "immutable_after_publication"
    assert detail["brand_id"][0].code == "immutable_after_publication"


@pytest.mark.django_db
def test_the_removal_guard_codes_an_unknown_field_as_unknown_field(workflow_enabled):
    owner = _seller()
    listing = make_private_listing(owner=owner)
    make_revision(listing)

    with pytest.raises(DRFValidationError) as excinfo:
        update_listing_draft(
            listing=listing,
            actor=owner,
            expected_version=listing.version,
            payload={"is_staff_pick": None},
        )

    assert excinfo.value.detail["is_staff_pick"][0].code == "unknown_field"


@pytest.mark.django_db
def test_a_pre_publication_model_change_is_resolved_and_applied(api, workflow_enabled):
    """Before first publication the taxonomy fields are editable, and an accepted
    change has to reach the BoatListing columns the snapshot builder reads.

    This is also the `_resolve_taxonomy(listing=...)` brand fallback: the payload
    carries `model_id` only, so the brand comes from the listing's current value.
    """
    owner = _seller()
    brand = make_brand("Beneteau")
    listing = make_private_listing(
        owner=owner, brand=brand, model=make_model(brand, "Oceanis 40")
    )
    replacement = make_model(brand, "Oceanis 46.1")
    revision = make_revision(listing)
    api.force_authenticate(owner)

    response = api.patch(
        _url(listing),
        {"version": revision.version, "model_id": str(replacement.pk)},
        format="json",
    )

    assert response.status_code == 200
    listing.refresh_from_db()
    assert listing.model_id == replacement.pk
    assert listing.brand_id == brand.pk


@pytest.mark.django_db
def test_a_patched_model_must_belong_to_the_listings_brand(api, workflow_enabled):
    owner = _seller()
    brand = make_brand("Beneteau")
    listing = make_private_listing(owner=owner, brand=brand, model=make_model(brand))
    revision = make_revision(listing)
    foreign_model = make_model(make_brand("Jeanneau"), "Sun Odyssey 410")
    api.force_authenticate(owner)

    response = api.patch(
        _url(listing),
        {"version": revision.version, "model_id": str(foreign_model.pk)},
        format="json",
    )

    assert response.status_code == 400
    assert response.data["error"]["fields"]["model_id"] == [
        {"message": "Select an active model belonging to the chosen brand.", "code": "invalid_model"}
    ]
    listing.refresh_from_db()
    assert listing.model_id != foreign_model.pk
    revision.refresh_from_db()
    assert revision.version == 1


@pytest.mark.django_db
def test_a_brand_only_patch_is_refused_while_the_old_model_belongs_to_the_old_brand(
    api, workflow_enabled
):
    """The asymmetric remap: `_resolve_taxonomy` falls the omitted `model_id`
    back to the listing's current model, which cannot belong to the new brand,
    so a brand-only change is refused rather than silently orphaning the model.
    Spec §13.3's remap flow supplies both ids together.
    """
    owner = _seller()
    brand = make_brand("Beneteau")
    listing = make_private_listing(owner=owner, brand=brand, model=make_model(brand))
    replacement_brand = make_brand("Jeanneau")
    make_model(replacement_brand, "Sun Odyssey 410")
    revision = make_revision(listing)
    api.force_authenticate(owner)

    response = api.patch(
        _url(listing),
        {"version": revision.version, "brand_id": str(replacement_brand.pk)},
        format="json",
    )

    assert response.status_code == 400
    assert response.data["error"]["fields"]["model_id"] == [
        {"message": "Select an active model belonging to the chosen brand.", "code": "invalid_model"}
    ]
    assert "brand_id" not in response.data["error"]["fields"]
    listing.refresh_from_db()
    assert listing.brand_id == brand.pk
    revision.refresh_from_db()
    assert revision.version == 1
    assert "brand_id" not in revision.payload


@pytest.mark.django_db
def test_a_brand_and_model_remap_sent_together_is_accepted(api, workflow_enabled):
    """The other half of the asymmetry: the same brand change succeeds as soon as
    the payload also names a model that belongs to the new brand."""
    owner = _seller()
    brand = make_brand("Beneteau")
    listing = make_private_listing(owner=owner, brand=brand, model=make_model(brand))
    replacement_brand = make_brand("Jeanneau")
    replacement_model = make_model(replacement_brand, "Sun Odyssey 410")
    revision = make_revision(listing)
    api.force_authenticate(owner)

    response = api.patch(
        _url(listing),
        {
            "version": revision.version,
            "brand_id": str(replacement_brand.pk),
            "model_id": str(replacement_model.pk),
        },
        format="json",
    )

    assert response.status_code == 200
    listing.refresh_from_db()
    assert listing.brand_id == replacement_brand.pk
    assert listing.model_id == replacement_model.pk


@pytest.mark.django_db
def test_an_untouched_taxonomy_is_not_re_resolved(api, workflow_enabled):
    """A price edit must not fail just because staff deactivated the brand after
    publication — the resolve runs only when the payload touches taxonomy."""
    owner = _seller()
    brand = make_brand("Beneteau")
    listing = make_private_listing(owner=owner, brand=brand, model=make_model(brand))
    revision = make_revision(listing)
    brand.is_active = False
    brand.save(update_fields=["is_active"])
    api.force_authenticate(owner)

    response = api.patch(
        _url(listing), {"version": revision.version, "price": "99000.00"}, format="json"
    )

    assert response.status_code == 200


@pytest.mark.django_db
def test_the_policy_block_reports_the_locked_names_once_published(api, workflow_enabled):
    owner = _seller()
    listing = _published(owner)
    api.force_authenticate(owner)

    response = api.patch(
        _url(listing), {"version": listing.version, "price": "115000.00"}, format="json"
    )

    assert response.data["policy"]["immutable_fields"] == [
        "brand", "model", "custom_model_name", "manufacture_year",
    ]


@pytest.mark.django_db
def test_a_rejected_listing_returns_to_draft_when_editing_resumes(api, workflow_enabled):
    owner = _seller()
    listing = make_private_listing(owner=owner, status=ListingStatus.REJECTED)
    make_revision(
        listing, state=RevisionStatus.REJECTED, submitted_by=owner,
        submitted_at=timezone.now(), decided_by=_staff(),
        decided_at=timezone.now(), decision_note="Photos are unusable.",
    )
    api.force_authenticate(owner)

    response = api.patch(
        _url(listing), {"version": listing.version, "title_en": "Second attempt"},
        format="json",
    )

    assert response.status_code == 200
    listing.refresh_from_db()
    assert listing.status == ListingStatus.DRAFT
    assert ListingRevision.objects.filter(
        listing=listing, state=RevisionStatus.DRAFT, revision_number=2
    ).exists()


@pytest.mark.parametrize(
    "status",
    [ListingStatus.SUSPENDED, ListingStatus.EXPIRED, ListingStatus.ARCHIVED],
)
@pytest.mark.django_db
def test_a_listing_outside_the_edit_loop_cannot_open_a_new_revision(
    api, workflow_enabled, status
):
    """SUSPENDED / EXPIRED / ARCHIVED are not part of the owner's edit loop, so a
    new edit cycle is refused rather than silently carrying the status forward
    onto a draft revision the moderation queue could never approve."""
    owner = _seller()
    listing = make_private_listing(owner=owner, status=status)
    listing.current_public_snapshot = make_snapshot(listing, approved_by=_staff())
    listing.save(update_fields=["current_public_snapshot"])
    original_version = listing.version
    api.force_authenticate(owner)

    response = api.patch(
        _url(listing), {"version": original_version, "price": "1000.00"}, format="json"
    )

    assert response.status_code == 409
    assert response.data["error"]["code"] == "invalid_listing_state"
    assert not ListingRevision.objects.filter(listing=listing).exists()
    listing.refresh_from_db()
    assert listing.status == status
    assert listing.version == original_version


@pytest.mark.django_db
def test_the_endpoint_is_closed_while_the_feature_flag_is_off(api, db):
    owner = _seller()
    listing = make_private_listing(owner=owner)
    revision = make_revision(listing)
    api.force_authenticate(owner)

    response = api.patch(_url(listing), {"version": revision.version, "title_en": "x"},
                         format="json")

    assert response.status_code == 403
    assert response.data["error"]["code"] == "feature_disabled"
