import pytest
from django.contrib.auth.models import Group
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from listings.enums import ListingStatus, MediaStatus, MediaType, RevisionStatus
from listings.models import ListingSnapshot
from listings.tests.factories import (
    make_media,
    make_private_listing,
    make_revision,
)
from platform_settings.services import set_feature_flag


@pytest.fixture
def workflow_enabled(db):
    set_feature_flag(key="listing_revisions", is_enabled=True, actor=None)


@pytest.fixture
def api():
    return APIClient()


# accounts.tests.factories.make_user() defaults to a single fixed email, so every
# helper here takes one explicitly: a test that builds both a moderator and a
# seller must not collide on User.email's uniqueness.
def _staff_in_group(email, group_name):
    user = make_user(email, role=UserRole.STAFF, verified=True)
    user.groups.add(Group.objects.get(name=group_name))
    return user


def _moderator(email="moderator@example.com"):
    return _staff_in_group(email, StaffGroup.MODERATOR)


def _admin(email="staff-admin@example.com"):
    return _staff_in_group(email, StaffGroup.ADMIN)


def _payload(media_id):
    return {
        "title_en": "Oceanis 46.1, one owner",
        "description_en": "Full service history.",
        "specifications": {"length_m": "14.6"},
        "location_country": "IT",
        "location_city": "Genoa",
        "price": "125000.00",
        "currency": "EUR",
        "media_ids": [str(media_id)],
    }


def _submitted(owner_email="private-seller@example.com"):
    owner = make_user(owner_email, role=UserRole.PRIVATE_SELLER, verified=True)
    listing = make_private_listing(owner=owner, status=ListingStatus.PENDING_APPROVAL)
    image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY)
    revision = make_revision(
        listing,
        payload=_payload(image.pk),
        state=RevisionStatus.SUBMITTED,
        submitted_by=owner,
        submitted_at=timezone.now(),
    )
    return listing, revision


def _url(revision):
    return reverse("staff-revision-decision", kwargs={"revision_id": revision.pk})


@pytest.mark.django_db
def test_a_moderator_approves_a_revision(api, workflow_enabled):
    listing, revision = _submitted()
    api.force_authenticate(_moderator())

    response = api.post(
        _url(revision),
        {"decision": "APPROVE", "version": revision.version},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["state"] == RevisionStatus.APPROVED
    assert response.data["listing"]["status"] == ListingStatus.PUBLISHED
    assert response.data["listing"]["current_public_snapshot_version"] == 1
    assert response.data["version"] == revision.version + 1


@pytest.mark.django_db
def test_a_moderator_requests_changes_with_a_reason(api, workflow_enabled):
    listing, revision = _submitted()
    api.force_authenticate(_moderator())

    response = api.post(
        _url(revision),
        {
            "decision": "REQUEST_CHANGES",
            "version": revision.version,
            "note": "Add an interior photo.",
        },
        format="json",
    )

    assert response.status_code == 200
    assert response.data["state"] == RevisionStatus.CHANGES_REQUESTED
    assert response.data["decision_note"] == "Add an interior photo."
    listing.refresh_from_db()
    assert listing.status == ListingStatus.DRAFT


@pytest.mark.django_db
def test_a_moderator_rejects_with_a_reason(api, workflow_enabled):
    listing, revision = _submitted()
    api.force_authenticate(_moderator())

    response = api.post(
        _url(revision),
        {"decision": "REJECT", "version": revision.version, "note": "Not a boat."},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["state"] == RevisionStatus.REJECTED
    assert response.data["decision_note"] == "Not a boat."
    listing.refresh_from_db()
    assert listing.status == ListingStatus.REJECTED
    assert ListingSnapshot.objects.count() == 0


@pytest.mark.django_db
def test_request_changes_without_a_note_is_rejected(api, workflow_enabled):
    _, revision = _submitted()
    api.force_authenticate(_moderator())

    response = api.post(
        _url(revision),
        {"decision": "REQUEST_CHANGES", "version": revision.version},
        format="json",
    )

    assert response.status_code == 400
    assert "note" in response.data["error"]["fields"]


@pytest.mark.django_db
def test_reject_without_a_note_is_rejected(api, workflow_enabled):
    _, revision = _submitted()
    api.force_authenticate(_moderator())

    response = api.post(
        _url(revision),
        {"decision": "REJECT", "version": revision.version, "note": "  "},
        format="json",
    )

    assert response.status_code == 400
    assert "note" in response.data["error"]["fields"]


@pytest.mark.django_db
def test_approval_does_not_require_a_note(api, workflow_enabled):
    _, revision = _submitted()
    api.force_authenticate(_moderator())

    response = api.post(
        _url(revision),
        {"decision": "APPROVE", "version": revision.version},
        format="json",
    )

    assert response.status_code == 200


@pytest.mark.django_db
def test_a_repeated_click_conflicts_and_creates_no_second_snapshot(api, workflow_enabled):
    listing, revision = _submitted()
    api.force_authenticate(_moderator())
    api.post(
        _url(revision),
        {"decision": "APPROVE", "version": revision.version},
        format="json",
    )

    response = api.post(
        _url(revision),
        {"decision": "APPROVE", "version": revision.version},
        format="json",
    )

    assert response.status_code == 409
    assert response.data["error"]["code"] in ("invalid_revision_state", "stale_version")
    assert ListingSnapshot.objects.filter(listing=listing).count() == 1


@pytest.mark.django_db
def test_a_stale_version_returns_current_version_metadata(api, workflow_enabled):
    _, revision = _submitted()
    api.force_authenticate(_moderator())

    response = api.post(
        _url(revision),
        {"decision": "APPROVE", "version": revision.version + 7},
        format="json",
    )

    assert response.status_code == 409
    assert response.data["error"]["code"] == "stale_version"
    assert response.data["error"]["meta"]["resource"] == "revision"
    assert response.data["error"]["meta"]["current_version"] == revision.version


@pytest.mark.django_db
def test_the_listing_owner_cannot_approve_their_own_listing(api, workflow_enabled):
    listing, revision = _submitted()
    api.force_authenticate(listing.owner_user)

    response = api.post(
        _url(revision),
        {"decision": "APPROVE", "version": revision.version},
        format="json",
    )

    assert response.status_code == 403
    assert ListingSnapshot.objects.count() == 0


@pytest.mark.django_db
def test_an_anonymous_request_cannot_decide(api, workflow_enabled):
    _, revision = _submitted()

    response = api.post(
        _url(revision),
        {"decision": "APPROVE", "version": revision.version},
        format="json",
    )

    assert response.status_code in (401, 403)
    assert ListingSnapshot.objects.count() == 0


@pytest.mark.django_db
def test_a_staff_admin_may_also_decide(api, workflow_enabled):
    """Spec §5's capability table gives "Approve listings/revisions" to BOTH
    tiers, and accounts.services.is_staff_moderator() lets ADMIN through."""
    _, revision = _submitted()
    api.force_authenticate(_admin())

    response = api.post(
        _url(revision),
        {"decision": "APPROVE", "version": revision.version},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["state"] == RevisionStatus.APPROVED


@pytest.mark.django_db
def test_a_staff_account_in_no_staff_group_cannot_decide(api, workflow_enabled):
    """The STAFF primary role alone is not the capability; group membership is."""
    _, revision = _submitted()
    api.force_authenticate(make_user("ungrouped-staff@example.com", role=UserRole.STAFF))

    response = api.post(
        _url(revision),
        {"decision": "APPROVE", "version": revision.version},
        format="json",
    )

    assert response.status_code == 403
    assert ListingSnapshot.objects.count() == 0


@pytest.mark.django_db
def test_a_non_staff_account_in_the_moderator_group_cannot_decide(api, workflow_enabled):
    """The mirror image: group membership alone is not the capability either -
    is_staff_moderator() requires primary_role == STAFF as well."""
    _, revision = _submitted()
    impostor = make_user("impostor@example.com", role=UserRole.PRIVATE_SELLER)
    impostor.groups.add(Group.objects.get(name=StaffGroup.MODERATOR))
    api.force_authenticate(impostor)

    response = api.post(
        _url(revision),
        {"decision": "APPROVE", "version": revision.version},
        format="json",
    )

    assert response.status_code == 403
    assert ListingSnapshot.objects.count() == 0


@pytest.mark.django_db
def test_a_deactivated_moderator_cannot_decide(api, workflow_enabled):
    _, revision = _submitted()
    moderator = _moderator()
    moderator.is_active = False
    moderator.save(update_fields=["is_active"])
    api.force_authenticate(moderator)

    response = api.post(
        _url(revision),
        {"decision": "APPROVE", "version": revision.version},
        format="json",
    )

    assert response.status_code == 403
    assert ListingSnapshot.objects.count() == 0


@pytest.mark.django_db
def test_an_unknown_decision_value_is_rejected(api, workflow_enabled):
    _, revision = _submitted()
    api.force_authenticate(_moderator())

    response = api.post(
        _url(revision),
        {"decision": "PUBLISH_NOW", "version": revision.version},
        format="json",
    )

    assert response.status_code == 400
    assert "decision" in response.data["error"]["fields"]


@pytest.mark.django_db
def test_a_missing_version_is_rejected(api, workflow_enabled):
    """Spec §20.5: "All edit submissions include listing/revision version."""
    _, revision = _submitted()
    api.force_authenticate(_moderator())

    response = api.post(_url(revision), {"decision": "APPROVE"}, format="json")

    assert response.status_code == 400
    assert "version" in response.data["error"]["fields"]


@pytest.mark.django_db
def test_an_unknown_revision_is_not_found(api, workflow_enabled):
    _, revision = _submitted()
    api.force_authenticate(_moderator())

    response = api.post(
        reverse(
            "staff-revision-decision",
            kwargs={"revision_id": "00000000-0000-4000-8000-000000000000"},
        ),
        {"decision": "APPROVE", "version": revision.version},
        format="json",
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_the_endpoint_is_closed_while_the_feature_flag_is_off(api, db):
    _, revision = _submitted()
    api.force_authenticate(_moderator())

    response = api.post(
        _url(revision),
        {"decision": "APPROVE", "version": revision.version},
        format="json",
    )

    assert response.status_code == 403
    assert response.data["error"]["code"] == "feature_disabled"
    assert ListingSnapshot.objects.count() == 0
