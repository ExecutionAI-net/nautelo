"""Spec §20 definition of done, §40 Scenario I, §34.2 concurrency.

Every test here drives the phase end to end through real HTTP calls against the
routes in `listings/urls.py` — no service is called directly — because the
definition of done is a statement about what the API does, not about what the
services can be made to do.
"""

import pytest
from django.contrib.auth.models import Group
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from audit.models import AuditEvent
from listings.enums import ListingStatus, MediaStatus, MediaType, RevisionStatus
from listings.models import BoatListing, ListingRevision, ListingSnapshot
from listings.tests.factories import make_brand, make_media, make_model
from platform_settings.services import set_feature_flag


@pytest.fixture
def workflow_enabled(db):
    set_feature_flag(key="listing_revisions", is_enabled=True, actor=None)


@pytest.fixture
def api():
    return APIClient()


# accounts.tests.factories.make_user() defaults to one fixed email, so every
# helper takes one explicitly: a test that builds a seller and two moderators
# must not collide on User.email's uniqueness constraint.
def _seller(email="private-seller@example.com"):
    return make_user(email, role=UserRole.PRIVATE_SELLER, verified=True)


def _moderator(email="moderator@example.com"):
    user = make_user(email, role=UserRole.STAFF, verified=True)
    user.groups.add(Group.objects.get(name=StaffGroup.MODERATOR))
    return user


def _decide(client, revision_id, decision, version, note=None):
    body = {"decision": decision, "version": version}
    if note is not None:
        body["note"] = note
    return client.post(
        reverse("staff-revision-decision", kwargs={"revision_id": revision_id}),
        body,
        format="json",
    )


def _create_and_submit(api, seller, brand_name="Beneteau"):
    """Draft -> ready media -> complete payload -> submit. Returns (listing, revision)."""
    brand = make_brand(brand_name)
    model = make_model(brand, "Oceanis 46.1")
    api.force_authenticate(seller)

    created = api.post(
        reverse("listing-draft-create"),
        {
            "brand_id": str(brand.pk),
            "model_id": str(model.pk),
            "manufacture_year": 2020,
        },
        format="json",
    )
    assert created.status_code == 201, created.data
    listing = BoatListing.objects.get(pk=created.data["id"])
    image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY)

    patched = api.patch(
        reverse("listing-draft-update", kwargs={"listing_id": listing.pk}),
        {
            "version": created.data["revision"]["version"],
            "title_en": "Oceanis 46.1, one owner",
            "description_en": "Full service history.",
            "specifications": {"length_m": "14.6"},
            "location_country": "IT",
            "location_city": "Genoa",
            "price": "125000.00",
            "currency": "EUR",
            "media_ids": [str(image.pk)],
        },
        format="json",
    )
    assert patched.status_code == 200, patched.data

    submitted = api.post(
        reverse("listing-submit", kwargs={"listing_id": listing.pk}),
        {"version": patched.data["revision"]["version"]},
        format="json",
    )
    assert submitted.status_code == 200, submitted.data
    listing.refresh_from_db()
    return listing, ListingRevision.objects.get(pk=submitted.data["revision"]["id"])


@pytest.mark.django_db
def test_done_1_no_pending_private_listing_leaks_through_the_public_api(
    api, workflow_enabled
):
    seller = _seller()
    listing, _ = _create_and_submit(api, seller)

    guest = APIClient()
    detail = guest.get(reverse("listing-detail", kwargs={"listing_id": listing.pk}))
    listing_page = guest.get(reverse("listing-list"))

    assert listing.status == ListingStatus.PENDING_APPROVAL
    assert detail.status_code == 404
    assert listing_page.data["count"] == 0
    # ...and not even to the owner's own authenticated public request.
    assert (
        api.get(reverse("listing-detail", kwargs={"listing_id": listing.pk})).status_code
        == 404
    )


@pytest.mark.django_db
def test_done_2_locked_field_manipulation_fails_server_side(api, workflow_enabled):
    """Spec §40 Scenario I, first half."""
    seller = _seller()
    listing, revision = _create_and_submit(api, seller)
    api.force_authenticate(_moderator())
    approved = _decide(api, revision.pk, "APPROVE", revision.version)
    assert approved.status_code == 200, approved.data
    listing.refresh_from_db()
    original_year = listing.manufacture_year

    api.force_authenticate(seller)
    response = api.patch(
        reverse("listing-draft-update", kwargs={"listing_id": listing.pk}),
        {"version": listing.version, "manufacture_year": 1999},
        format="json",
    )

    assert response.status_code == 400
    assert "manufacture_year" in response.data["error"]["fields"]
    listing.refresh_from_db()
    assert listing.manufacture_year == original_year
    assert listing.current_public_snapshot.manufacture_year_snapshot == original_year
    # The refused edit left no half-opened revision behind either: the whole
    # service runs in one transaction, so the listing's version did not move.
    assert ListingRevision.objects.filter(
        listing=listing, state=RevisionStatus.DRAFT
    ).count() == 0


@pytest.mark.django_db
def test_done_3_old_public_content_survives_a_rejected_edit(api, workflow_enabled):
    """Spec §40 Scenario I, second half, plus spec §20.2."""
    seller = _seller()
    listing, revision = _create_and_submit(api, seller)
    moderator = _moderator()
    api.force_authenticate(moderator)
    assert _decide(api, revision.pk, "APPROVE", revision.version).status_code == 200
    listing.refresh_from_db()

    api.force_authenticate(seller)
    edited = api.patch(
        reverse("listing-draft-update", kwargs={"listing_id": listing.pk}),
        {
            "version": listing.version,
            "price": "99000.00",
            "description_en": "Reduced for a quick sale.",
        },
        format="json",
    )
    assert edited.status_code == 200, edited.data
    guest = APIClient()
    while_pending = guest.get(
        reverse("listing-detail", kwargs={"listing_id": listing.pk})
    )
    assert while_pending.data["price"]["amount"] == "125000.00"

    submitted = api.post(
        reverse("listing-submit", kwargs={"listing_id": listing.pk}),
        {"version": edited.data["revision"]["version"]},
        format="json",
    )
    assert submitted.status_code == 200, submitted.data
    still_live = guest.get(reverse("listing-detail", kwargs={"listing_id": listing.pk}))
    assert still_live.data["price"]["amount"] == "125000.00"

    second_revision_id = submitted.data["revision"]["id"]
    api.force_authenticate(moderator)
    rejected = _decide(
        api,
        second_revision_id,
        "REJECT",
        submitted.data["revision"]["version"],
        note="Price is not credible.",
    )
    assert rejected.status_code == 200, rejected.data

    after_rejection = guest.get(
        reverse("listing-detail", kwargs={"listing_id": listing.pk})
    )
    listing.refresh_from_db()
    assert listing.status == ListingStatus.PUBLISHED
    assert after_rejection.data["price"]["amount"] == "125000.00"
    assert after_rejection.data["description"]["en"] == "Full service history."
    assert after_rejection.data["snapshot_version"] == 1
    assert ListingSnapshot.objects.filter(listing=listing).count() == 1


@pytest.mark.django_db
def test_done_3b_an_approved_edit_publishes_the_next_snapshot(api, workflow_enabled):
    seller = _seller()
    listing, revision = _create_and_submit(api, seller)
    moderator = _moderator()
    api.force_authenticate(moderator)
    assert _decide(api, revision.pk, "APPROVE", revision.version).status_code == 200
    listing.refresh_from_db()

    api.force_authenticate(seller)
    edited = api.patch(
        reverse("listing-draft-update", kwargs={"listing_id": listing.pk}),
        {"version": listing.version, "price": "99000.00"},
        format="json",
    )
    assert edited.status_code == 200, edited.data
    submitted = api.post(
        reverse("listing-submit", kwargs={"listing_id": listing.pk}),
        {"version": edited.data["revision"]["version"]},
        format="json",
    )
    assert submitted.status_code == 200, submitted.data
    api.force_authenticate(moderator)
    second = _decide(
        api,
        submitted.data["revision"]["id"],
        "APPROVE",
        submitted.data["revision"]["version"],
    )
    assert second.status_code == 200, second.data

    public = APIClient().get(
        reverse("listing-detail", kwargs={"listing_id": listing.pk})
    )
    assert public.data["price"]["amount"] == "99000.00"
    assert public.data["snapshot_version"] == 2
    assert ListingSnapshot.objects.filter(listing=listing).count() == 2


@pytest.mark.django_db
def test_done_4_every_decision_records_actor_note_and_timestamps(api, workflow_enabled):
    seller = _seller()
    listing, revision = _create_and_submit(api, seller)
    moderator = _moderator()
    api.force_authenticate(moderator)

    response = _decide(
        api,
        revision.pk,
        "REQUEST_CHANGES",
        revision.version,
        note="Add an interior photo.",
    )
    assert response.status_code == 200, response.data

    event = AuditEvent.objects.get(action="listing.revision_changes_requested")
    assert event.actor_user_id == moderator.pk
    assert event.actor_type == AuditEvent.ActorType.USER
    assert event.metadata["note"] == "Add an interior photo."
    assert event.created_at is not None
    assert event.after["decided_at"] is not None
    revision.refresh_from_db()
    assert revision.decided_by_id == moderator.pk
    assert revision.decided_at is not None
    assert revision.decision_note == "Add an interior photo."


@pytest.mark.django_db
def test_34_2_two_staff_decisions_on_one_revision_yield_one_success_and_one_conflict(
    api, workflow_enabled
):
    """Spec §34.2, realised as spec §20.5's "two browser tabs".

    Two real DB connections racing inside pytest-django is fragile and would
    prove the `select_for_update()` serialisation rather than the compare-and-
    swap. The deterministic equivalent — both moderators read the same version,
    then both replay their original request — exercises exactly the mechanism
    that makes the loser fail instead of overwriting.
    """
    seller = _seller()
    listing, revision = _create_and_submit(api, seller)
    # Both moderators opened the queue and read the same version.
    version_both_read = revision.version

    first = APIClient()
    first.force_authenticate(_moderator("moderator-one@example.com"))
    second = APIClient()
    second.force_authenticate(_moderator("moderator-two@example.com"))

    first_response = _decide(first, revision.pk, "APPROVE", version_both_read)
    second_response = _decide(
        second, revision.pk, "REJECT", version_both_read, note="Duplicate."
    )

    assert first_response.status_code == 200, first_response.data
    assert second_response.status_code == 409
    revision.refresh_from_db()
    assert revision.state == RevisionStatus.APPROVED
    assert ListingSnapshot.objects.filter(listing=listing).count() == 1


@pytest.mark.django_db
def test_20_5_two_browser_tabs_cannot_silently_overwrite_each_other(
    api, workflow_enabled
):
    seller = _seller()
    brand = make_brand("Jeanneau")
    api.force_authenticate(seller)
    created = api.post(
        reverse("listing-draft-create"),
        {
            "brand_id": str(brand.pk),
            "model_id": str(make_model(brand).pk),
            "manufacture_year": 2020,
        },
        format="json",
    )
    assert created.status_code == 201, created.data
    listing_id = created.data["id"]
    version_both_tabs_read = created.data["revision"]["version"]

    tab_one = api.patch(
        reverse("listing-draft-update", kwargs={"listing_id": listing_id}),
        {"version": version_both_tabs_read, "title_en": "Written by tab one"},
        format="json",
    )
    tab_two = api.patch(
        reverse("listing-draft-update", kwargs={"listing_id": listing_id}),
        {"version": version_both_tabs_read, "title_en": "Written by tab two"},
        format="json",
    )

    assert tab_one.status_code == 200, tab_one.data
    assert tab_two.status_code == 409
    assert tab_two.data["error"]["code"] == "stale_version"
    assert tab_two.data["error"]["meta"]["current_version"] == version_both_tabs_read + 1
    revision = ListingRevision.objects.get(listing_id=listing_id)
    assert revision.payload["title_en"] == "Written by tab one"
