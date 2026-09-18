"""listings.publication is the single path from an approved revision to public
content. Both callers (a staff APPROVE decision and a spec §21 broker
auto-approval) go through publish_revision, so these tests exercise it directly.
"""

import pytest
from django.db import transaction
from django.utils import timezone

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from audit.models import AuditEvent
from listings.drafts import InvalidWorkflowState
from listings.enums import (
    ListingStatus,
    MediaStatus,
    MediaType,
    PublicationSource,
    RevisionStatus,
)
from listings.models import ListingSnapshot
from listings.publication import guard_base_snapshot, publish_revision
from listings.tests.factories import (
    make_media,
    make_private_listing,
    make_revision,
    make_snapshot,
)


def _seller(email="publication-seller@example.com"):
    return make_user(email, role=UserRole.PRIVATE_SELLER, verified=True)


def _staff(email="publication-staff@example.com"):
    return make_user(email, role=UserRole.STAFF, verified=True)


def _cleaned(media_id):
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


def _submitted_revision(listing, actor, media_id, **kwargs):
    return make_revision(
        listing,
        state=RevisionStatus.SUBMITTED,
        payload=_cleaned(media_id),
        submitted_by=actor,
        submitted_at=timezone.now(),
        **kwargs,
    )


@pytest.mark.django_db
def test_publish_revision_publishes_a_first_publication():
    owner = _seller()
    staff = _staff()
    listing = make_private_listing(owner=owner, status=ListingStatus.PENDING_APPROVAL)
    image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY)
    revision = _submitted_revision(listing, owner, image.pk)

    snapshot = publish_revision(
        listing=listing,
        revision=revision,
        actor=staff,
        cleaned=_cleaned(image.pk),
        expected_revision_version=revision.version,
        note="Looks good.",
    )

    listing.refresh_from_db()
    revision.refresh_from_db()
    assert snapshot.version == 1
    assert listing.status == ListingStatus.PUBLISHED
    assert listing.current_public_snapshot_id == snapshot.pk
    assert listing.published_at is not None
    assert revision.state == RevisionStatus.APPROVED
    assert revision.decided_by_id == staff.pk
    assert revision.decision_note == "Looks good."


@pytest.mark.django_db
def test_publish_revision_leaves_the_listing_status_alone_after_first_publication():
    owner = _seller()
    staff = _staff()
    listing = make_private_listing(owner=owner, status=ListingStatus.PUBLISHED)
    first = make_snapshot(listing, approved_by=staff, version=1)
    listing.current_public_snapshot = first
    listing.published_at = timezone.now()
    listing.save(update_fields=["current_public_snapshot", "published_at"])
    image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY)
    revision = _submitted_revision(listing, owner, image.pk, base_snapshot=first)
    published_at = listing.published_at

    snapshot = publish_revision(
        listing=listing,
        revision=revision,
        actor=staff,
        cleaned=_cleaned(image.pk),
        expected_revision_version=revision.version,
    )

    listing.refresh_from_db()
    assert snapshot.version == 2
    assert listing.status == ListingStatus.PUBLISHED
    assert listing.published_at == published_at
    assert ListingSnapshot.objects.filter(listing=listing).count() == 2


@pytest.mark.django_db
def test_publish_revision_refuses_a_superseded_base_snapshot():
    owner = _seller()
    staff = _staff()
    listing = make_private_listing(owner=owner, status=ListingStatus.PUBLISHED)
    stale = make_snapshot(listing, approved_by=staff, version=1)
    current = make_snapshot(listing, approved_by=staff, version=2)
    listing.current_public_snapshot = current
    listing.save(update_fields=["current_public_snapshot"])
    image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY)
    revision = _submitted_revision(listing, owner, image.pk, base_snapshot=stale)

    with pytest.raises(InvalidWorkflowState) as exc_info:
        publish_revision(
            listing=listing,
            revision=revision,
            actor=staff,
            cleaned=_cleaned(image.pk),
            expected_revision_version=revision.version,
        )

    assert exc_info.value.get_codes() == "stale_base_snapshot"
    assert exc_info.value.meta == {"resource": "snapshot", "current_version": 2}


@pytest.mark.django_db
def test_guard_base_snapshot_allows_an_initial_revision_with_no_base():
    owner = _seller()
    listing = make_private_listing(owner=owner)
    image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY)
    revision = _submitted_revision(listing, owner, image.pk)

    assert guard_base_snapshot(listing, revision) is None


@pytest.mark.django_db
def test_a_staff_publication_writes_the_revision_approved_audit_action():
    owner = _seller()
    staff = _staff()
    listing = make_private_listing(owner=owner, status=ListingStatus.PENDING_APPROVAL)
    image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY)
    revision = _submitted_revision(listing, owner, image.pk)

    publish_revision(
        listing=listing,
        revision=revision,
        actor=staff,
        cleaned=_cleaned(image.pk),
        expected_revision_version=revision.version,
        note="Approved.",
    )

    event = AuditEvent.objects.get(target_id=str(revision.pk))
    assert event.action == "listing.revision_approved"
    assert event.metadata["auto_approved"] is False
    assert event.metadata["first_publication"] is True
    assert event.metadata["broker_id"] is None


@pytest.mark.django_db
def test_an_auto_approved_publication_writes_a_distinct_audit_action():
    """The auto-approval *caller* arrives in Task 2; the flag and its audit and
    publication_source consequences are built and proved here, where the code
    lives."""
    owner = _seller()
    listing = make_private_listing(owner=owner, status=ListingStatus.DRAFT)
    image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY)
    revision = _submitted_revision(listing, owner, image.pk)

    publish_revision(
        listing=listing,
        revision=revision,
        actor=owner,
        cleaned=_cleaned(image.pk),
        expected_revision_version=revision.version,
        auto_approved=True,
        publication_source=PublicationSource.BROKER_POLICY,
    )

    listing.refresh_from_db()
    event = AuditEvent.objects.get(target_id=str(revision.pk))
    assert event.action == "listing.revision_auto_approved"
    assert event.metadata["auto_approved"] is True
    assert listing.status == ListingStatus.PUBLISHED
    assert listing.publication_source == PublicationSource.BROKER_POLICY


@pytest.mark.django_db(transaction=True)
def test_the_approved_signal_reports_whether_the_publication_was_automatic():
    from listings.signals import listing_revision_approved

    seen = []

    def receiver(sender, revision, auto_approved=False, **kwargs):
        seen.append(auto_approved)

    listing_revision_approved.connect(receiver)
    try:
        owner = _seller()
        listing = make_private_listing(owner=owner, status=ListingStatus.DRAFT)
        image = make_media(
            listing, media_type=MediaType.IMAGE, status=MediaStatus.READY
        )
        revision = _submitted_revision(listing, owner, image.pk)
        with transaction.atomic():
            publish_revision(
                listing=listing,
                revision=revision,
                actor=owner,
                cleaned=_cleaned(image.pk),
                expected_revision_version=revision.version,
                auto_approved=True,
            )
    finally:
        listing_revision_approved.disconnect(receiver)

    assert seen == [True]
