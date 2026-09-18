import pytest
from rest_framework.exceptions import APIException

from accounts.tests.factories import make_user
from common.exceptions import nauta_exception_handler
from listings.enums import ListingStatus
from listings.locking import StaleVersionConflict, bump_version
from listings.models import BoatListing
from listings.tests.factories import make_private_listing, make_revision


@pytest.mark.django_db
def test_bump_version_increments_and_applies_updates():
    listing = make_private_listing(owner=make_user())

    bump_version(
        listing,
        expected_version=1,
        resource="listing",
        status=ListingStatus.PENDING_APPROVAL,
    )

    listing.refresh_from_db()
    assert listing.version == 2
    assert listing.status == ListingStatus.PENDING_APPROVAL


@pytest.mark.django_db
def test_bump_version_refreshes_the_in_memory_instance():
    listing = make_private_listing(owner=make_user())

    bump_version(listing, expected_version=1, resource="listing",
                 status=ListingStatus.PENDING_APPROVAL)

    # No explicit refresh_from_db() by the caller.
    assert listing.version == 2
    assert listing.status == ListingStatus.PENDING_APPROVAL


@pytest.mark.django_db
def test_a_stale_version_raises_a_409_conflict_carrying_the_current_version():
    listing = make_private_listing(owner=make_user())
    bump_version(listing, expected_version=1, resource="listing",
                 status=ListingStatus.PENDING_APPROVAL)

    with pytest.raises(StaleVersionConflict) as exc_info:
        bump_version(listing, expected_version=1, resource="listing",
                     status=ListingStatus.DRAFT)

    conflict = exc_info.value
    assert isinstance(conflict, APIException)
    assert conflict.status_code == 409
    assert conflict.get_codes() == "stale_version"
    assert conflict.meta == {"resource": "listing", "current_version": 2}


@pytest.mark.django_db
def test_a_stale_version_does_not_apply_the_update():
    listing = make_private_listing(owner=make_user())
    bump_version(listing, expected_version=1, resource="listing",
                 status=ListingStatus.PENDING_APPROVAL)

    with pytest.raises(StaleVersionConflict):
        bump_version(listing, expected_version=1, resource="listing",
                     status=ListingStatus.REJECTED)

    assert BoatListing.objects.get(pk=listing.pk).status == ListingStatus.PENDING_APPROVAL


@pytest.mark.django_db
def test_a_missing_row_reports_a_null_current_version():
    listing = make_private_listing(owner=make_user())
    revision = make_revision(listing)
    revision_id, expected = revision.pk, revision.version
    revision.delete()
    revision.pk = revision_id

    with pytest.raises(StaleVersionConflict) as exc_info:
        bump_version(revision, expected_version=expected, resource="revision")

    assert exc_info.value.meta == {"resource": "revision", "current_version": None}


def test_the_error_envelope_carries_meta():
    """The handler passthrough itself - exercised over HTTP in Task 12."""

    class _Request:
        request_id = "req-123"

    conflict = StaleVersionConflict(resource="revision", current_version=7)
    response = nauta_exception_handler(conflict, {"request": _Request()})

    assert response.status_code == 409
    assert response.data["error"]["code"] == "stale_version"
    assert response.data["error"]["meta"] == {
        "resource": "revision",
        "current_version": 7,
    }
    assert response.data["error"]["request_id"] == "req-123"


def test_the_error_envelope_omits_meta_when_the_exception_has_none():
    """Exceptions without a `meta` attribute must not grow an empty `meta: {}`."""

    class _Request:
        request_id = "req-456"

    response = nauta_exception_handler(
        APIException("Something went wrong."), {"request": _Request()}
    )

    assert "meta" not in response.data["error"]
