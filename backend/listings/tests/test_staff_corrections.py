"""Staff-authored corrections (spec §20.3) and listing suspension (§6.1, §36.4)."""

import pytest
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from audit.models import AuditEvent
from listings.decisions import (
    approve_revision,
    create_staff_correction_revision,
    suspend_listing,
    unsuspend_listing,
)
from listings.drafts import InvalidWorkflowState
from listings.enums import (
    ListingStatus,
    MediaStatus,
    MediaType,
    RevisionOrigin,
    RevisionStatus,
)
from listings.models import ListingSnapshot
from listings.tests.factories import (
    make_brand,
    make_media,
    make_model,
    make_private_listing,
    make_revision,
    make_snapshot,
)


def _staff(email="staff@example.com"):
    """`make_user` defaults every account to the same address, so every helper
    here takes an explicit one: two calls with the default collide on the unique
    email column."""
    return make_user(email=email, role=UserRole.STAFF, verified=True)


def _published_listing():
    owner = make_user(
        email="private-seller@example.com", role=UserRole.PRIVATE_SELLER, verified=True
    )
    brand = make_brand("Beneteau")
    listing = make_private_listing(
        owner=owner,
        brand=brand,
        model=make_model(brand, "Oceanis 46.1"),
        status=ListingStatus.PUBLISHED,
    )
    image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY)
    snapshot = make_snapshot(
        listing,
        approved_by=_staff("original-approver@example.com"),
        version=1,
        media_manifest=[
            {
                "media_id": str(image.pk),
                "media_type": MediaType.IMAGE,
                "storage_key": image.storage_key,
                "mime_type": image.mime_type,
                "sort_order": image.sort_order,
                "width": image.width,
                "height": image.height,
                "duration_seconds": None,
                "checksum_sha256": image.checksum_sha256,
            }
        ],
    )
    listing.current_public_snapshot = snapshot
    listing.published_at = timezone.now()
    listing.save(update_fields=["current_public_snapshot", "published_at"])
    return listing, snapshot, image


@pytest.mark.django_db
def test_a_correction_revision_may_change_a_locked_field():
    listing, snapshot, _ = _published_listing()
    staff = _staff()

    revision = create_staff_correction_revision(
        listing=listing,
        actor=staff,
        payload={"manufacture_year": 2018},
        note="Owner supplied the registration document.",
    )

    assert revision.origin == RevisionOrigin.STAFF_CORRECTION
    assert revision.state == RevisionStatus.SUBMITTED
    assert revision.submitted_by_id == staff.pk
    assert revision.base_snapshot_id == snapshot.pk
    assert revision.payload["manufacture_year"] == 2018
    # Seeded from the live snapshot, so the rest of the content survives.
    assert revision.payload["title_en"] == snapshot.title_en
    # Mirrored onto the BoatListing column the snapshot builder reads.
    listing.refresh_from_db()
    assert listing.manufacture_year == 2018
    # ...and the live snapshot is untouched until the correction is approved.
    assert listing.current_public_snapshot.manufacture_year_snapshot != 2018


@pytest.mark.django_db
def test_a_correction_may_remap_the_brand_and_model():
    """Spec §13.3's staff taxonomy remap needs both ids together, because a new
    brand invalidates the old model."""
    listing, _, _ = _published_listing()
    correct_brand = make_brand("Jeanneau")
    correct_model = make_model(correct_brand, "Sun Odyssey 410")

    revision = create_staff_correction_revision(
        listing=listing,
        actor=_staff(),
        payload={"brand_id": str(correct_brand.pk), "model_id": str(correct_model.pk)},
        note="Listed under the wrong manufacturer.",
    )

    listing.refresh_from_db()
    assert listing.brand_id == correct_brand.pk
    assert listing.model_id == correct_model.pk
    assert revision.payload["brand_id"] == str(correct_brand.pk)


@pytest.mark.django_db
def test_a_correction_refuses_a_brand_whose_model_no_longer_matches():
    listing, _, _ = _published_listing()

    with pytest.raises(ValidationError) as exc_info:
        create_staff_correction_revision(
            listing=listing,
            actor=_staff(),
            payload={"brand_id": str(make_brand("Jeanneau").pk)},
            note="Listed under the wrong manufacturer.",
        )

    assert "model_id" in exc_info.value.detail


@pytest.mark.django_db
def test_a_correction_requires_a_note():
    listing, _, _ = _published_listing()

    with pytest.raises(ValidationError) as exc_info:
        create_staff_correction_revision(
            listing=listing,
            actor=_staff(),
            payload={"manufacture_year": 2018},
            note="",
        )

    assert exc_info.value.detail["note"][0].code == "decision_note_required"


@pytest.mark.django_db
def test_a_correction_records_an_audit_event_with_actor_and_note():
    listing, _, _ = _published_listing()
    staff = _staff()

    revision = create_staff_correction_revision(
        listing=listing,
        actor=staff,
        payload={"manufacture_year": 2018},
        note="Owner supplied the registration document.",
    )

    event = AuditEvent.objects.get(action="listing.correction_revision_created")
    assert event.actor_user_id == staff.pk
    assert event.target_id == str(revision.pk)
    assert event.metadata["note"] == "Owner supplied the registration document."
    assert event.after["payload_fields"] == ["manufacture_year"]


@pytest.mark.django_db
def test_approving_a_correction_creates_a_new_snapshot_and_keeps_history():
    """The whole point of spec §20.3: the correction must reach the *public*
    snapshot through the ordinary approval flow, with nothing patched by hand."""
    listing, original_snapshot, _ = _published_listing()
    staff = _staff()
    original_year = original_snapshot.manufacture_year_snapshot
    assert original_year != 2018
    revision = create_staff_correction_revision(
        listing=listing,
        actor=staff,
        payload={"manufacture_year": 2018},
        note="Registration document supplied.",
    )

    approve_revision(
        revision_id=revision.pk, actor=staff, expected_version=revision.version
    )

    listing.refresh_from_db()
    assert listing.current_public_snapshot.version == 2
    assert listing.current_public_snapshot.manufacture_year_snapshot == 2018
    assert listing.current_public_snapshot.approved_revision_id == revision.pk
    historical = ListingSnapshot.objects.get(pk=original_snapshot.pk)
    assert historical.manufacture_year_snapshot == original_year


@pytest.mark.django_db
def test_a_correction_is_refused_while_the_seller_has_an_open_revision():
    listing, _, _ = _published_listing()
    make_revision(listing, payload={"title_en": "Seller is editing"})

    with pytest.raises(InvalidWorkflowState) as exc_info:
        create_staff_correction_revision(
            listing=listing,
            actor=_staff(),
            payload={"manufacture_year": 2018},
            note="Registration document supplied.",
        )

    assert exc_info.value.get_codes() == "invalid_revision_state"


@pytest.mark.django_db
def test_suspending_a_published_listing_keeps_its_snapshot_intact():
    listing, snapshot, _ = _published_listing()
    staff = _staff()

    suspend_listing(listing=listing, actor=staff, reason="Reported as a duplicate.")

    listing.refresh_from_db()
    assert listing.status == ListingStatus.SUSPENDED
    assert listing.current_public_snapshot_id == snapshot.pk
    event = AuditEvent.objects.get(action="listing.suspended")
    assert event.actor_user_id == staff.pk
    assert event.metadata["reason"] == "Reported as a duplicate."


@pytest.mark.django_db
def test_suspension_requires_a_reason():
    listing, _, _ = _published_listing()

    with pytest.raises(ValidationError):
        suspend_listing(listing=listing, actor=_staff(), reason="   ")


@pytest.mark.django_db
def test_a_suspended_listing_can_be_restored():
    listing, _, _ = _published_listing()
    staff = _staff()
    suspend_listing(listing=listing, actor=staff, reason="Reported as a duplicate.")
    listing.refresh_from_db()

    unsuspend_listing(listing=listing, actor=staff, reason="Report was unfounded.")

    listing.refresh_from_db()
    assert listing.status == ListingStatus.PUBLISHED
    assert AuditEvent.objects.filter(action="listing.unsuspended").exists()


@pytest.mark.django_db
def test_a_draft_listing_cannot_be_suspended():
    listing = make_private_listing(owner=make_user(email="draft-owner@example.com"))

    with pytest.raises(InvalidWorkflowState):
        suspend_listing(
            listing=listing, actor=_staff(), reason="Nothing to suspend."
        )
