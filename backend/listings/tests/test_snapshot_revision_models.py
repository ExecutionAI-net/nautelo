import pytest
from django.db import IntegrityError, transaction
from django.db.models import ProtectedError
from django.utils import timezone

from accounts.tests.factories import make_user
from listings.enums import (
    DECIDED_REVISION_STATES,
    NOTE_REQUIRED_REVISION_STATES,
    OPEN_REVISION_STATES,
    RevisionStatus,
)
from listings.models import (
    CONSTRAINT_DECIDED_STATES,
    CONSTRAINT_NOTE_REQUIRED_STATES,
    CONSTRAINT_OPEN_STATES,
    ListingSnapshot,
)
from listings.tests.factories import make_private_listing, make_revision, make_snapshot


def test_constraint_state_tuples_match_the_enum_groupings():
    assert frozenset(CONSTRAINT_OPEN_STATES) == OPEN_REVISION_STATES
    assert frozenset(CONSTRAINT_DECIDED_STATES) == DECIDED_REVISION_STATES
    assert frozenset(CONSTRAINT_NOTE_REQUIRED_STATES) == NOTE_REQUIRED_REVISION_STATES


@pytest.mark.django_db
def test_two_snapshots_cannot_share_a_version_on_one_listing():
    staff = make_user("staff@example.com")
    listing = make_private_listing(owner=make_user("owner@example.com"))
    make_snapshot(listing, approved_by=staff, version=1)

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            make_snapshot(listing, approved_by=staff, version=1)


@pytest.mark.django_db
def test_a_snapshot_cannot_be_updated_after_creation():
    listing = make_private_listing(owner=make_user("owner@example.com"))
    snapshot = make_snapshot(listing, approved_by=make_user("staff@example.com"))

    snapshot.title_en = "Rewritten history"
    with pytest.raises(ValueError, match="immutable"):
        snapshot.save()


@pytest.mark.django_db
def test_queryset_update_cannot_rewrite_a_snapshot():
    listing = make_private_listing(owner=make_user("owner@example.com"))
    make_snapshot(listing, approved_by=make_user("staff@example.com"))

    with pytest.raises(ValueError, match="immutable"):
        ListingSnapshot.objects.all().update(title_en="Rewritten history")


@pytest.mark.django_db
def test_two_revisions_cannot_share_a_revision_number_on_one_listing():
    owner = make_user("owner@example.com")
    listing = make_private_listing(owner=owner)
    make_revision(listing, revision_number=1)

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            make_revision(
                listing,
                revision_number=1,
                state=RevisionStatus.REJECTED,
                submitted_by=owner,
                submitted_at=timezone.now(),
                decided_by=make_user("staff@example.com"),
                decided_at=timezone.now(),
                decision_note="duplicate",
            )


@pytest.mark.django_db
def test_a_listing_can_have_only_one_open_revision():
    listing = make_private_listing(owner=make_user("owner@example.com"))
    make_revision(listing, revision_number=1, state=RevisionStatus.DRAFT)

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            make_revision(
                listing,
                revision_number=2,
                state=RevisionStatus.SUBMITTED,
                submitted_by=make_user("staff@example.com"),
                submitted_at=timezone.now(),
            )


@pytest.mark.django_db
def test_closed_revisions_do_not_block_a_new_open_revision():
    owner = make_user("owner@example.com")
    listing = make_private_listing(owner=owner)
    make_revision(
        listing,
        revision_number=1,
        state=RevisionStatus.REJECTED,
        submitted_by=owner,
        submitted_at=timezone.now(),
        decided_by=make_user("staff@example.com"),
        decided_at=timezone.now(),
        decision_note="Not enough detail.",
    )

    second = make_revision(listing, revision_number=2, state=RevisionStatus.DRAFT)

    assert second.pk is not None


@pytest.mark.django_db
def test_a_non_draft_revision_requires_submission_stamps():
    listing = make_private_listing(owner=make_user())

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            make_revision(listing, revision_number=1, state=RevisionStatus.SUBMITTED)


@pytest.mark.django_db
def test_a_decided_revision_requires_decision_stamps():
    owner = make_user()
    listing = make_private_listing(owner=owner)

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            make_revision(
                listing,
                revision_number=1,
                state=RevisionStatus.APPROVED,
                submitted_by=owner,
                submitted_at=timezone.now(),
            )


@pytest.mark.django_db
def test_request_changes_and_reject_require_a_decision_note():
    owner = make_user("owner@example.com")
    listing = make_private_listing(owner=owner)

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            make_revision(
                listing,
                revision_number=1,
                state=RevisionStatus.CHANGES_REQUESTED,
                submitted_by=owner,
                submitted_at=timezone.now(),
                decided_by=make_user("staff@example.com"),
                decided_at=timezone.now(),
                decision_note="",
            )


@pytest.mark.django_db
def test_approval_does_not_require_a_decision_note():
    owner = make_user("owner@example.com")
    listing = make_private_listing(owner=owner)

    revision = make_revision(
        listing,
        revision_number=1,
        state=RevisionStatus.APPROVED,
        submitted_by=owner,
        submitted_at=timezone.now(),
        decided_by=make_user("staff@example.com"),
        decided_at=timezone.now(),
        decision_note="",
    )

    assert revision.pk is not None


@pytest.mark.django_db
def test_a_listing_can_point_at_its_current_public_snapshot():
    listing = make_private_listing(owner=make_user("owner@example.com"))
    snapshot = make_snapshot(listing, approved_by=make_user("staff@example.com"))

    listing.current_public_snapshot = snapshot
    listing.save(update_fields=["current_public_snapshot"])
    listing.refresh_from_db()

    assert listing.current_public_snapshot_id == snapshot.pk


@pytest.mark.django_db
def test_the_current_public_snapshot_cannot_be_deleted_while_referenced():
    listing = make_private_listing(owner=make_user("owner@example.com"))
    snapshot = make_snapshot(listing, approved_by=make_user("staff@example.com"))
    listing.current_public_snapshot = snapshot
    listing.save(update_fields=["current_public_snapshot"])

    with pytest.raises(ProtectedError):
        snapshot.delete()
