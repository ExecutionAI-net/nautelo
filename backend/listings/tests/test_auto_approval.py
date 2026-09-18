"""Spec §21 / §20.4: a valid broker submission publishes immediately when the
organization's staff-admin-enabled auto-approval policy is on."""

import pytest
from django.urls import reverse
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from audit.models import AuditEvent
from brokers.enums import BrokerMembershipRole, BrokerOrganizationStatus
from brokers.tests.factories import make_broker, make_membership
from listings.enums import (
    ListingStatus,
    MediaStatus,
    MediaType,
    PublicationSource,
    RevisionStatus,
)
from listings.models import ListingSnapshot
from listings.submissions import submit_listing_revision
from listings.tests.factories import make_broker_listing, make_media, make_revision
from platform_settings.services import set_feature_flag


@pytest.fixture
def workflow_enabled(db):
    set_feature_flag(key="listing_revisions", is_enabled=True, actor=None)


@pytest.fixture
def api():
    return APIClient()


def _broker_admin(email, broker):
    user = make_user(email, role=UserRole.BROKER, verified=True)
    make_membership(
        user,
        broker,
        role=BrokerMembershipRole.ADMIN,
        can_edit_listings=True,
        can_manage_team=True,
        can_read_messages=True,
    )
    return user


def _payload(media_id):
    return {
        "title_en": "Lagoon 42, 2021",
        "description_en": "Owner version, full electronics.",
        "specifications": {"length_m": "12.8"},
        "location_country": "ES",
        "location_city": "Palma",
        "price": "459000.00",
        "currency": "EUR",
        "media_ids": [str(media_id)],
    }


def _ready_broker_listing(*, auto, slug, email, status=ListingStatus.DRAFT):
    broker = make_broker(
        name=f"Broker {slug}",
        slug=slug,
        status=BrokerOrganizationStatus.ACTIVE,
        auto_approve_listings=auto,
    )
    actor = _broker_admin(email, broker)
    listing = make_broker_listing(broker=broker, actor=actor, status=status)
    image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY)
    revision = make_revision(listing, payload=_payload(image.pk))
    return broker, actor, listing, revision


@pytest.mark.django_db
def test_an_auto_approved_initial_submission_publishes_immediately():
    """Spec §21 acceptance test 3."""
    _, actor, listing, revision = _ready_broker_listing(
        auto=True, slug="auto-initial", email="auto-initial@example.com"
    )

    submit_listing_revision(
        listing=listing, actor=actor, expected_version=revision.version
    )

    listing.refresh_from_db()
    revision.refresh_from_db()
    assert listing.status == ListingStatus.PUBLISHED
    assert listing.current_public_snapshot is not None
    assert listing.current_public_snapshot.version == 1
    assert listing.published_at is not None
    assert listing.publication_source == PublicationSource.BROKER_POLICY
    assert revision.state == RevisionStatus.APPROVED
    assert revision.decided_by_id == actor.pk


@pytest.mark.django_db
def test_a_broker_without_the_policy_still_waits_for_a_moderator():
    _, actor, listing, revision = _ready_broker_listing(
        auto=False, slug="auto-off", email="auto-off@example.com"
    )

    submit_listing_revision(
        listing=listing, actor=actor, expected_version=revision.version
    )

    listing.refresh_from_db()
    revision.refresh_from_db()
    assert listing.status == ListingStatus.PENDING_APPROVAL
    assert listing.current_public_snapshot_id is None
    assert revision.state == RevisionStatus.SUBMITTED


@pytest.mark.django_db
def test_an_auto_approved_edit_publishes_the_next_snapshot_and_keeps_the_status():
    """Spec §20.4: 'valid create/edit submissions publish a new snapshot
    immediately.'"""
    _, actor, listing, revision = _ready_broker_listing(
        auto=True, slug="auto-edit", email="auto-edit@example.com"
    )
    submit_listing_revision(
        listing=listing, actor=actor, expected_version=revision.version
    )
    listing.refresh_from_db()
    first_published_at = listing.published_at

    second = make_revision(
        listing,
        base_snapshot=listing.current_public_snapshot,
        payload={**revision.payload, "price": "429000.00"},
    )
    submit_listing_revision(
        listing=listing, actor=actor, expected_version=second.version
    )

    listing.refresh_from_db()
    assert ListingSnapshot.objects.filter(listing=listing).count() == 2
    assert listing.current_public_snapshot.version == 2
    assert str(listing.current_public_snapshot.price) == "429000.00"
    assert listing.status == ListingStatus.PUBLISHED
    assert listing.published_at == first_published_at


@pytest.mark.django_db
def test_an_invalid_submission_never_publishes_even_with_the_policy_on():
    """Spec §21 acceptance test 4."""
    _, actor, listing, revision = _ready_broker_listing(
        auto=True, slug="auto-invalid", email="auto-invalid@example.com"
    )
    revision.payload = {**revision.payload, "title_en": ""}
    revision.save(update_fields=["payload"])

    with pytest.raises(ValidationError):
        submit_listing_revision(
            listing=listing, actor=actor, expected_version=revision.version
        )

    listing.refresh_from_db()
    revision.refresh_from_db()
    assert listing.status == ListingStatus.DRAFT
    assert listing.current_public_snapshot_id is None
    assert revision.state == RevisionStatus.DRAFT
    assert ListingSnapshot.objects.filter(listing=listing).count() == 0


@pytest.mark.django_db
def test_media_that_is_not_ready_blocks_an_auto_approved_submission():
    """Spec §21 rule 2: 'unlimited' does not bypass media limits."""
    _, actor, listing, revision = _ready_broker_listing(
        auto=True, slug="auto-media", email="auto-media@example.com"
    )
    image = listing.media.get()
    image.status = MediaStatus.PROCESSING
    image.save(update_fields=["status"])

    with pytest.raises(ValidationError) as exc_info:
        submit_listing_revision(
            listing=listing, actor=actor, expected_version=revision.version
        )

    assert exc_info.value.detail["media_ids"][0].code == "media_not_ready"
    listing.refresh_from_db()
    assert listing.status == ListingStatus.DRAFT
    assert ListingSnapshot.objects.filter(listing=listing).count() == 0


@pytest.mark.django_db
def test_enabling_the_policy_does_not_retro_approve_a_pending_submission():
    """Spec §21 rule 5."""
    broker, actor, listing, revision = _ready_broker_listing(
        auto=False, slug="auto-pending", email="auto-pending@example.com"
    )
    submit_listing_revision(
        listing=listing, actor=actor, expected_version=revision.version
    )

    broker.auto_approve_listings = True
    broker.save(update_fields=["auto_approve_listings"])

    listing.refresh_from_db()
    revision.refresh_from_db()
    assert listing.status == ListingStatus.PENDING_APPROVAL
    assert revision.state == RevisionStatus.SUBMITTED
    assert listing.current_public_snapshot_id is None


@pytest.mark.django_db
def test_disabling_the_policy_leaves_a_published_listing_live():
    """Spec §21 rule 6."""
    broker, actor, listing, revision = _ready_broker_listing(
        auto=True, slug="auto-disable", email="auto-disable@example.com"
    )
    submit_listing_revision(
        listing=listing, actor=actor, expected_version=revision.version
    )

    broker.auto_approve_listings = False
    broker.save(update_fields=["auto_approve_listings"])

    listing.refresh_from_db()
    assert listing.status == ListingStatus.PUBLISHED
    assert listing.current_public_snapshot is not None


@pytest.mark.django_db
def test_an_auto_approved_submission_records_both_audit_events():
    _, actor, listing, revision = _ready_broker_listing(
        auto=True, slug="auto-audit", email="auto-audit@example.com"
    )

    submit_listing_revision(
        listing=listing, actor=actor, expected_version=revision.version
    )

    actions = set(
        AuditEvent.objects.filter(target_id=str(revision.pk)).values_list(
            "action", flat=True
        )
    )
    assert actions == {"listing.submitted", "listing.revision_auto_approved"}
    submitted = AuditEvent.objects.get(
        target_id=str(revision.pk), action="listing.submitted"
    )
    assert submitted.metadata["auto_approved"] is True
    assert submitted.metadata["publication_source"] == PublicationSource.BROKER_POLICY
    assert submitted.after["listing_status"] == ListingStatus.PUBLISHED
    assert submitted.after["state"] == RevisionStatus.APPROVED


@pytest.mark.django_db
def test_an_auto_approved_publication_records_the_broker_on_the_audit_event():
    """Carried from the Task 1 review: publish_revision() writes
    `metadata["broker_id"]`, and only the private-seller (None) case was covered.
    The auto-approval path is the one that always has a broker."""
    broker, actor, listing, revision = _ready_broker_listing(
        auto=True, slug="auto-broker-id", email="auto-broker-id@example.com"
    )

    submit_listing_revision(
        listing=listing, actor=actor, expected_version=revision.version
    )

    published = AuditEvent.objects.get(
        target_id=str(revision.pk), action="listing.revision_auto_approved"
    )
    assert published.metadata["broker_id"] == str(broker.pk)


@pytest.mark.django_db(transaction=True)
def test_an_auto_approved_submission_does_not_summon_a_moderator():
    from listings.signals import (
        listing_initial_submitted,
        listing_published,
        listing_revision_submitted,
    )

    seen = []
    wired = [
        (listing_initial_submitted, lambda **kw: seen.append("initial")),
        (listing_revision_submitted, lambda **kw: seen.append("submitted")),
        (listing_published, lambda **kw: seen.append("published")),
    ]
    for signal, receiver in wired:
        signal.connect(receiver)
    try:
        _, actor, listing, revision = _ready_broker_listing(
            auto=True, slug="auto-signals", email="auto-signals@example.com"
        )
        submit_listing_revision(
            listing=listing, actor=actor, expected_version=revision.version
        )
    finally:
        for signal, receiver in wired:
            signal.disconnect(receiver)

    assert seen == ["published"]


@pytest.mark.django_db(transaction=True)
def test_a_manual_broker_submission_still_summons_a_moderator():
    from listings.signals import listing_initial_submitted, listing_revision_submitted

    seen = []
    wired = [
        (listing_initial_submitted, lambda **kw: seen.append("initial")),
        (listing_revision_submitted, lambda **kw: seen.append("submitted")),
    ]
    for signal, receiver in wired:
        signal.connect(receiver)
    try:
        _, actor, listing, revision = _ready_broker_listing(
            auto=False, slug="manual-signals", email="manual-signals@example.com"
        )
        submit_listing_revision(
            listing=listing, actor=actor, expected_version=revision.version
        )
    finally:
        for signal, receiver in wired:
            signal.disconnect(receiver)

    assert sorted(seen) == ["initial", "submitted"]


@pytest.mark.django_db
def test_the_service_hands_the_revision_back_on_the_caller_s_listing_object():
    """The response contract, at the service boundary (spec §30.2).

    `ListingSubmitView.post` serializes *its own* `listing` instance, and
    `ListingWorkflowSerializer` reads `getattr(listing, "open_revision", None)`
    before falling back to `open_revision_for()`, which only finds DRAFT or
    SUBMITTED rows. On the auto-approval path the revision is APPROVED before
    the response is built, so the fallback finds nothing — the service must put
    the revision on the object it was given, not only on the row-locked copy it
    re-fetched. This asserts on `listing`, the caller's object, deliberately.
    """
    _, actor, listing, revision = _ready_broker_listing(
        auto=True, slug="auto-caller-obj", email="auto-caller-obj@example.com"
    )

    returned = submit_listing_revision(
        listing=listing, actor=actor, expected_version=revision.version
    )

    assert listing.open_revision is not None
    assert listing.open_revision.pk == returned.pk
    assert listing.open_revision.state == RevisionStatus.APPROVED


@pytest.mark.django_db
def test_the_submit_endpoint_reports_the_published_state(api, workflow_enabled):
    _, actor, listing, revision = _ready_broker_listing(
        auto=True, slug="auto-api", email="auto-api@example.com"
    )
    api.force_authenticate(actor)

    response = api.post(
        reverse("listing-submit", args=[listing.pk]),
        {"version": revision.version},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["status"] == ListingStatus.PUBLISHED
    assert response.data["current_public_snapshot_version"] == 1
    assert response.data["policy"]["requires_approval"] is False
    # Spec §30.2: "Mutations return updated resource/version". A successful
    # auto-approved submission must still carry its revision back — the
    # APPROVED one it just published, not None.
    assert response.data["revision"] is not None
    assert response.data["revision"]["id"] == str(revision.pk)
    assert response.data["revision"]["state"] == RevisionStatus.APPROVED
    assert response.data["revision"]["decided_at"] is not None
