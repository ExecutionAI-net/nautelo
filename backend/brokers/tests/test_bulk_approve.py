"""Spec §21 rule 7: bulk approval is a separate, explicitly confirmed, audited
action — and it never publishes something a moderator would have refused."""

import uuid
from datetime import timedelta

import pytest
from django.contrib.auth.models import Group
from django.db.models import F
from django.urls import reverse
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from audit.models import AuditEvent
from brokers import moderation
from brokers.enums import BrokerMembershipRole, BrokerOrganizationStatus
from brokers.moderation import bulk_approve_pending_broker_revisions
from brokers.tests.factories import make_broker, make_membership
from listings.enums import ListingStatus, MediaStatus, MediaType, RevisionStatus
from listings.models import ListingRevision, ListingSnapshot
from listings.tests.factories import (
    make_brand,
    make_broker_listing,
    make_media,
    make_model,
    make_revision,
    make_snapshot,
)
from platform_settings.services import set_feature_flag
from taxonomy.models import BoatBrand


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def workflow_enabled(db):
    set_feature_flag(key="listing_revisions", is_enabled=True, actor=None)


def _staff(email, group_name):
    user = make_user(email, role=UserRole.STAFF, verified=True)
    user.groups.add(Group.objects.get(name=group_name))
    return user


def _payload(media_id):
    return {
        "title_en": "Bavaria 46, 2019",
        "description_en": "Two cabins, new sails.",
        "specifications": {"length_m": "14.2"},
        "location_country": "ES",
        "location_city": "Barcelona",
        "price": "259000.00",
        "currency": "EUR",
        "media_ids": [str(media_id)],
    }


def _listing_for(broker, agent, *, status):
    """One listing for `broker`, reusing this broker's brand.

    `make_broker_listing` derives a brand name from the broker id, so a second
    call for the same broker collides on the brand's unique normalized name.
    Spec §21 rule 7 is about a *backlog*, so every test here needs several
    listings for one broker; they share one brand exactly as a real agency's
    fleet may.
    """
    name = f"Brand {broker.pk.hex[:8]}"
    brand = BoatBrand.objects.filter(name=name).first() or make_brand(name)
    model = brand.models.first() or make_model(brand)
    return make_broker_listing(
        broker=broker, actor=agent, brand=brand, model=model, status=status
    )


def _pending_listing(broker, agent, *, valid=True, submitted_at=None):
    """One listing holding one SUBMITTED revision.

    One listing per pending revision, never two revisions on one listing: the
    `listings_revision_one_open_per_listing` constraint permits a single open
    (DRAFT or SUBMITTED) revision at a time.
    """
    listing = _listing_for(broker, agent, status=ListingStatus.PENDING_APPROVAL)
    image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY)
    payload = _payload(image.pk)
    if not valid:
        payload = {**payload, "title_en": ""}
    revision = make_revision(
        listing,
        state=RevisionStatus.SUBMITTED,
        payload=payload,
        submitted_by=agent,
        submitted_at=submitted_at or timezone.now(),
    )
    return listing, revision


def _broker_with_backlog(slug, email, *, pending=2, invalid=0):
    broker = make_broker(
        name=f"Broker {slug}", slug=slug, status=BrokerOrganizationStatus.ACTIVE
    )
    agent = make_user(email, role=UserRole.BROKER, verified=True)
    make_membership(
        agent,
        broker,
        role=BrokerMembershipRole.ADMIN,
        can_edit_listings=True,
        can_manage_team=True,
        can_read_messages=True,
    )
    rows = [_pending_listing(broker, agent, valid=True) for _ in range(pending)]
    rows += [_pending_listing(broker, agent, valid=False) for _ in range(invalid)]
    return broker, agent, rows


def _url(broker):
    return reverse("staff-broker-bulk-approve", args=[broker.pk])


def _bulk_event(broker):
    return AuditEvent.objects.filter(
        target_id=str(broker.pk), action="broker.pending_revisions_bulk_approved"
    )


def _no_workflow_audit_rows():
    """No bulk-run row and no per-revision decision row anywhere.

    Scoped by target_type rather than a bare `AuditEvent.objects.count() == 0`:
    the `workflow_enabled` fixture legitimately writes a
    `platform_settings.FeatureFlag` row of its own.
    """
    return not AuditEvent.objects.filter(
        target_type__in=("brokers.BrokerOrganization", "listings.ListingRevision")
    ).exists()


# ---------------------------------------------------------------------------
# The service
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_every_valid_pending_submission_is_published():
    moderator = _staff("bulk-mod@example.com", StaffGroup.MODERATOR)
    broker, _, rows = _broker_with_backlog("bulk-all", "bulk-agent@example.com", pending=3)

    result = bulk_approve_pending_broker_revisions(
        broker=broker, actor=moderator, reason="Backlog cleared after onboarding."
    )

    assert len(result.approved) == 3
    assert result.failures == []
    for listing, revision in rows:
        listing.refresh_from_db()
        revision.refresh_from_db()
        assert listing.status == ListingStatus.PUBLISHED
        assert listing.current_public_snapshot.version == 1
        assert revision.state == RevisionStatus.APPROVED
        assert revision.decided_by_id == moderator.pk
        assert revision.decision_note == "Backlog cleared after onboarding."


@pytest.mark.django_db
def test_an_invalid_submission_is_skipped_and_reported_not_published():
    """Spec §21 acceptance test 4, at bulk scale."""
    moderator = _staff("bulk-mixed-mod@example.com", StaffGroup.MODERATOR)
    broker, _, rows = _broker_with_backlog(
        "bulk-mixed", "bulk-mixed-agent@example.com", pending=2, invalid=1
    )

    result = bulk_approve_pending_broker_revisions(
        broker=broker, actor=moderator, reason="Bulk pass."
    )

    assert len(result.approved) == 2
    assert len(result.failures) == 1
    failure = result.failures[0]
    assert failure.code == "validation_error"
    bad_listing, bad_revision = rows[-1]
    assert failure.revision_id == str(bad_revision.pk)
    assert failure.listing_id == str(bad_listing.pk)
    bad_listing.refresh_from_db()
    bad_revision.refresh_from_db()
    assert bad_listing.status == ListingStatus.PENDING_APPROVAL
    assert bad_listing.current_public_snapshot_id is None
    assert bad_revision.state == RevisionStatus.SUBMITTED
    assert ListingSnapshot.objects.filter(listing=bad_listing).count() == 0


@pytest.mark.django_db
def test_one_failure_does_not_roll_back_the_approvals_that_preceded_it():
    """The invalid revision is submitted *first*, so it is processed first and a
    naive all-or-nothing transaction would take the good ones down with it."""
    moderator = _staff("bulk-isolate-mod@example.com", StaffGroup.MODERATOR)
    broker = make_broker(name="Isolate", slug="bulk-isolate")
    agent = make_user("bulk-isolate-agent@example.com", role=UserRole.BROKER, verified=True)
    earlier = timezone.now() - timedelta(hours=2)
    bad_listing, bad_revision = _pending_listing(
        broker, agent, valid=False, submitted_at=earlier
    )
    good_listing, good_revision = _pending_listing(broker, agent, valid=True)

    result = bulk_approve_pending_broker_revisions(
        broker=broker, actor=moderator, reason="Keep going after a bad row."
    )

    assert result.approved == [str(good_revision.pk)]
    assert [f.revision_id for f in result.failures] == [str(bad_revision.pk)]
    good_listing.refresh_from_db()
    bad_listing.refresh_from_db()
    assert good_listing.status == ListingStatus.PUBLISHED
    assert bad_listing.status == ListingStatus.PENDING_APPROVAL


@pytest.mark.django_db
def test_the_run_is_ordered_by_submission_time():
    moderator = _staff("bulk-order-mod@example.com", StaffGroup.MODERATOR)
    broker = make_broker(name="Ordered", slug="bulk-order")
    agent = make_user("bulk-order-agent@example.com", role=UserRole.BROKER, verified=True)
    now = timezone.now()
    oldest = _pending_listing(broker, agent, submitted_at=now - timedelta(days=3))
    middle = _pending_listing(broker, agent, submitted_at=now - timedelta(days=2))
    newest = _pending_listing(broker, agent, submitted_at=now - timedelta(days=1))

    result = bulk_approve_pending_broker_revisions(
        broker=broker, actor=moderator, reason="Oldest first."
    )

    assert result.approved == [
        str(oldest[1].pk),
        str(middle[1].pk),
        str(newest[1].pk),
    ]


@pytest.mark.django_db
def test_the_run_writes_one_aggregate_audit_event():
    moderator = _staff("bulk-audit-mod@example.com", StaffGroup.MODERATOR)
    broker, _, _ = _broker_with_backlog(
        "bulk-audit", "bulk-audit-agent@example.com", pending=1, invalid=1
    )

    bulk_approve_pending_broker_revisions(
        broker=broker, actor=moderator, reason="Documented backlog sweep."
    )

    event = AuditEvent.objects.get(
        target_id=str(broker.pk), action="broker.pending_revisions_bulk_approved"
    )
    assert event.target_type == "brokers.BrokerOrganization"
    assert event.actor_user == moderator
    assert event.actor_type == AuditEvent.ActorType.USER
    assert event.source == AuditEvent.Source.API
    assert event.before["pending_revision_count"] == 2
    assert event.after["approved_count"] == 1
    assert event.after["failed_count"] == 1
    assert event.metadata["reason"] == "Documented backlog sweep."
    assert event.metadata["broker_slug"] == "bulk-audit"
    assert len(event.metadata["approved_revision_ids"]) == 1
    assert event.metadata["failures"][0]["code"] == "validation_error"


@pytest.mark.django_db
def test_the_audit_metadata_carries_no_listing_content_or_contact_data():
    """Spec §10.2/§21: the bulk report identifies rows, it does not quote them."""
    moderator = _staff("bulk-pii-mod@example.com", StaffGroup.MODERATOR)
    broker, agent, _ = _broker_with_backlog(
        "bulk-pii", "bulk-pii-agent@example.com", pending=1, invalid=1
    )

    bulk_approve_pending_broker_revisions(
        broker=broker, actor=moderator, reason="No PII please."
    )

    event = _bulk_event(broker).get()
    blob = str(event.before) + str(event.after) + str(event.metadata)
    assert "Bavaria" not in blob
    assert "Barcelona" not in blob
    assert agent.email not in blob
    assert broker.public_email not in blob
    assert broker.public_phone not in blob


@pytest.mark.django_db
def test_each_approval_also_writes_its_own_decision_audit_event():
    moderator = _staff("bulk-each-mod@example.com", StaffGroup.MODERATOR)
    broker, _, rows = _broker_with_backlog(
        "bulk-each", "bulk-each-agent@example.com", pending=2
    )

    bulk_approve_pending_broker_revisions(
        broker=broker, actor=moderator, reason="Sweep."
    )

    for _, revision in rows:
        event = AuditEvent.objects.get(
            target_id=str(revision.pk), action="listing.revision_approved"
        )
        assert event.actor_user == moderator


@pytest.mark.django_db
def test_an_empty_backlog_is_a_no_op_that_is_still_audited():
    moderator = _staff("bulk-empty-mod@example.com", StaffGroup.MODERATOR)
    broker = make_broker(name="Nothing Pending", slug="nothing-pending")

    result = bulk_approve_pending_broker_revisions(
        broker=broker, actor=moderator, reason="Checked, nothing to do."
    )

    assert result.approved == []
    assert result.failures == []
    assert _bulk_event(broker).count() == 1


@pytest.mark.django_db
def test_another_brokers_backlog_is_untouched():
    moderator = _staff("bulk-scope-mod@example.com", StaffGroup.MODERATOR)
    mine, _, _ = _broker_with_backlog("bulk-mine", "bulk-mine-agent@example.com", pending=1)
    theirs, _, their_rows = _broker_with_backlog(
        "bulk-theirs", "bulk-theirs-agent@example.com", pending=1
    )

    bulk_approve_pending_broker_revisions(
        broker=mine, actor=moderator, reason="Only mine."
    )

    listing, revision = their_rows[0]
    listing.refresh_from_db()
    revision.refresh_from_db()
    assert listing.status == ListingStatus.PENDING_APPROVAL
    assert revision.state == RevisionStatus.SUBMITTED
    assert _bulk_event(theirs).count() == 0


@pytest.mark.django_db
def test_a_private_sellers_pending_revision_is_never_swept_in():
    """The filter is `listing__broker`, so a listing with no broker is out of
    scope whatever else is true of it."""
    from accounts.enums import SellerType
    from listings.tests.factories import make_private_listing

    moderator = _staff("bulk-priv-mod@example.com", StaffGroup.MODERATOR)
    broker, _, _ = _broker_with_backlog("bulk-priv", "bulk-priv-agent@example.com", pending=1)
    seller = make_user("bulk-priv-seller@example.com", role=UserRole.PRIVATE_SELLER)
    private = make_private_listing(owner=seller, status=ListingStatus.PENDING_APPROVAL)
    assert private.seller_type == SellerType.PRIVATE
    image = make_media(private, media_type=MediaType.IMAGE, status=MediaStatus.READY)
    private_revision = make_revision(
        private,
        state=RevisionStatus.SUBMITTED,
        payload=_payload(image.pk),
        submitted_by=seller,
        submitted_at=timezone.now(),
    )

    bulk_approve_pending_broker_revisions(
        broker=broker, actor=moderator, reason="Brokers only."
    )

    private_revision.refresh_from_db()
    private.refresh_from_db()
    assert private_revision.state == RevisionStatus.SUBMITTED
    assert private.status == ListingStatus.PENDING_APPROVAL


@pytest.mark.django_db
def test_only_submitted_revisions_are_swept():
    """A draft, a withdrawn revision and an already-decided one are all left
    exactly as they are, and none of them is reported as a failure."""
    moderator = _staff("bulk-states-mod@example.com", StaffGroup.MODERATOR)
    broker = make_broker(name="States", slug="bulk-states")
    agent = make_user("bulk-states-agent@example.com", role=UserRole.BROKER, verified=True)
    draft_listing = _listing_for(broker, agent, status=ListingStatus.DRAFT)
    draft = make_revision(draft_listing, state=RevisionStatus.DRAFT)
    withdrawn_listing = _listing_for(broker, agent, status=ListingStatus.DRAFT)
    withdrawn = make_revision(
        withdrawn_listing,
        state=RevisionStatus.WITHDRAWN,
        submitted_by=agent,
        submitted_at=timezone.now(),
    )
    rejected_listing = _listing_for(broker, agent, status=ListingStatus.REJECTED)
    rejected = make_revision(
        rejected_listing,
        state=RevisionStatus.REJECTED,
        submitted_by=agent,
        submitted_at=timezone.now(),
        decided_by=moderator,
        decided_at=timezone.now(),
        decision_note="Not enough photos.",
    )
    _, pending = _pending_listing(broker, agent)

    result = bulk_approve_pending_broker_revisions(
        broker=broker, actor=moderator, reason="Submitted only."
    )

    assert result.approved == [str(pending.pk)]
    assert result.failures == []
    # The backlog the run reports is the SUBMITTED set, not "every revision this
    # broker ever wrote" — the filter is in the query, not only in the loop.
    assert _bulk_event(broker).get().before["pending_revision_count"] == 1
    for revision, expected in (
        (draft, RevisionStatus.DRAFT),
        (withdrawn, RevisionStatus.WITHDRAWN),
        (rejected, RevisionStatus.REJECTED),
    ):
        revision.refresh_from_db()
        assert revision.state == expected
    draft_listing.refresh_from_db()
    withdrawn_listing.refresh_from_db()
    assert draft_listing.status == ListingStatus.DRAFT
    assert withdrawn_listing.status == ListingStatus.DRAFT


@pytest.mark.django_db
def test_a_superseded_revision_is_reported_and_never_published():
    """A revision written against an older snapshot answers `stale_base_snapshot`
    — the same refusal a moderator's single APPROVE would get (spec §20.5)."""
    moderator = _staff("bulk-super-mod@example.com", StaffGroup.MODERATOR)
    broker = make_broker(name="Superseded", slug="bulk-superseded")
    agent = make_user("bulk-super-agent@example.com", role=UserRole.BROKER, verified=True)
    listing = _listing_for(broker, agent, status=ListingStatus.PUBLISHED)
    old = make_snapshot(listing, approved_by=moderator, version=1)
    current = make_snapshot(listing, approved_by=moderator, version=2)
    listing.current_public_snapshot = current
    listing.save(update_fields=["current_public_snapshot", "updated_at"])
    image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY)
    revision = make_revision(
        listing,
        state=RevisionStatus.SUBMITTED,
        base_snapshot=old,
        payload=_payload(image.pk),
        submitted_by=agent,
        submitted_at=timezone.now(),
    )

    result = bulk_approve_pending_broker_revisions(
        broker=broker, actor=moderator, reason="Try the superseded one."
    )

    assert result.approved == []
    assert [f.code for f in result.failures] == ["stale_base_snapshot"]
    assert result.failures[0].revision_id == str(revision.pk)
    revision.refresh_from_db()
    listing.refresh_from_db()
    assert revision.state == RevisionStatus.SUBMITTED
    assert listing.current_public_snapshot_id == current.pk
    assert ListingSnapshot.objects.filter(listing=listing).count() == 2


@pytest.mark.django_db
def test_a_revision_whose_version_moved_under_the_run_is_reported_not_published(
    monkeypatch,
):
    """Spec §20.5's optimistic lock still applies inside a bulk run.

    The competing writer is simulated by bumping the row's `version` exactly as
    `listings.locking.bump_version` would, in the instant between the service
    reading the version and `approve_revision` taking its lock. Everything that
    follows — the refusal, its code, the rollback — is the real code path.
    """
    moderator = _staff("bulk-stale-mod@example.com", StaffGroup.MODERATOR)
    broker, _, rows = _broker_with_backlog(
        "bulk-stale", "bulk-stale-agent@example.com", pending=1
    )
    listing, revision = rows[0]
    real_approve = moderation.approve_revision

    def racing_approve(**kwargs):
        ListingRevision.objects.filter(pk=kwargs["revision_id"]).update(
            version=F("version") + 1
        )
        return real_approve(**kwargs)

    monkeypatch.setattr(moderation, "approve_revision", racing_approve)

    result = bulk_approve_pending_broker_revisions(
        broker=broker, actor=moderator, reason="Racing writer."
    )

    assert result.approved == []
    assert [f.code for f in result.failures] == ["stale_version"]
    listing.refresh_from_db()
    revision.refresh_from_db()
    assert listing.status == ListingStatus.PENDING_APPROVAL
    assert revision.state == RevisionStatus.SUBMITTED
    assert ListingSnapshot.objects.filter(listing=listing).count() == 0


@pytest.mark.django_db
def test_a_revision_decided_between_the_snapshot_and_its_turn_is_skipped_silently(
    monkeypatch,
):
    """Somebody else did the work while the run was going; that is not a failure."""
    moderator = _staff("bulk-race-mod@example.com", StaffGroup.MODERATOR)
    broker = make_broker(name="Raced", slug="bulk-raced")
    agent = make_user("bulk-race-agent@example.com", role=UserRole.BROKER, verified=True)
    now = timezone.now()
    first_listing, first = _pending_listing(
        broker, agent, submitted_at=now - timedelta(hours=1)
    )
    second_listing, second = _pending_listing(broker, agent, submitted_at=now)
    real_approve = moderation.approve_revision

    def withdraw_the_next_one(**kwargs):
        ListingRevision.objects.filter(pk=second.pk).update(
            state=RevisionStatus.WITHDRAWN, version=F("version") + 1
        )
        return real_approve(**kwargs)

    monkeypatch.setattr(moderation, "approve_revision", withdraw_the_next_one)

    result = bulk_approve_pending_broker_revisions(
        broker=broker, actor=moderator, reason="Raced."
    )

    assert result.approved == [str(first.pk)]
    assert result.failures == []
    first_listing.refresh_from_db()
    second_listing.refresh_from_db()
    second.refresh_from_db()
    assert first_listing.status == ListingStatus.PUBLISHED
    assert second.state == RevisionStatus.WITHDRAWN
    assert second_listing.status == ListingStatus.PENDING_APPROVAL
    event = _bulk_event(broker).get()
    assert event.before["pending_revision_count"] == 2
    assert event.after["approved_count"] == 1
    assert event.after["failed_count"] == 0


@pytest.mark.django_db
def test_one_run_approves_at_most_the_batch_limit_and_leaves_the_rest_pending(
    monkeypatch,
):
    """A ceiling on one request, so a five-figure backlog cannot be published by
    a single click. The remainder stays SUBMITTED for the next run."""
    monkeypatch.setattr(moderation, "BULK_APPROVE_MAX_BATCH", 2)
    moderator = _staff("bulk-limit-mod@example.com", StaffGroup.MODERATOR)
    broker = make_broker(name="Limited", slug="bulk-limited")
    agent = make_user("bulk-limit-agent@example.com", role=UserRole.BROKER, verified=True)
    now = timezone.now()
    rows = [
        _pending_listing(broker, agent, submitted_at=now - timedelta(hours=n))
        for n in (3, 2, 1)
    ]
    oldest, middle, newest = rows

    result = bulk_approve_pending_broker_revisions(
        broker=broker, actor=moderator, reason="Two at a time."
    )

    assert result.approved == [str(oldest[1].pk), str(middle[1].pk)]
    newest[1].refresh_from_db()
    newest[0].refresh_from_db()
    assert newest[1].state == RevisionStatus.SUBMITTED
    assert newest[0].status == ListingStatus.PENDING_APPROVAL
    event = _bulk_event(broker).get()
    assert event.before["pending_revision_count"] == 3
    assert event.after["approved_count"] == 2
    assert event.after["remaining_count"] == 1
    assert event.metadata["batch_limit"] == 2


@pytest.mark.django_db
def test_the_default_batch_limit_is_two_hundred():
    assert moderation.BULK_APPROVE_MAX_BATCH == 200


@pytest.mark.django_db
@pytest.mark.parametrize("reason", ["", "   ", None])
def test_the_service_refuses_a_run_without_a_reason(reason):
    moderator = _staff("bulk-svc-noreason@example.com", StaffGroup.MODERATOR)
    broker, _, rows = _broker_with_backlog(
        "bulk-svc-noreason", "bulk-svc-noreason-agent@example.com", pending=1
    )

    with pytest.raises(ValidationError) as exc_info:
        bulk_approve_pending_broker_revisions(
            broker=broker, actor=moderator, reason=reason
        )

    assert exc_info.value.detail["reason"][0].code == "policy_reason_required"
    listing, revision = rows[0]
    listing.refresh_from_db()
    revision.refresh_from_db()
    assert listing.status == ListingStatus.PENDING_APPROVAL
    assert revision.state == RevisionStatus.SUBMITTED
    assert _bulk_event(broker).count() == 0


# ---------------------------------------------------------------------------
# The endpoint
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_a_moderator_can_run_it_through_the_api(api, workflow_enabled):
    moderator = _staff("bulk-api-mod@example.com", StaffGroup.MODERATOR)
    broker, _, _ = _broker_with_backlog("bulk-api", "bulk-api-agent@example.com", pending=2)
    api.force_authenticate(moderator)

    response = api.post(
        _url(broker),
        {"confirm": True, "reason": "Approved after a call with the agency."},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["approved_count"] == 2
    assert response.data["failed_count"] == 0
    assert response.data["failures"] == []
    assert len(response.data["approved_revision_ids"]) == 2
    # The refreshed detail comes back with the run, so the screen needs no
    # second request (spec §30.2).
    assert response.data["broker"]["pending_revision_count"] == 0
    assert response.data["broker"]["listing_counts"]["by_status"]["PUBLISHED"] == 2


@pytest.mark.django_db
def test_a_staff_admin_can_run_it_too(api, workflow_enabled):
    admin = _staff("bulk-api-admin@example.com", StaffGroup.ADMIN)
    broker, _, _ = _broker_with_backlog(
        "bulk-api-admin", "bulk-api-admin-agent@example.com", pending=1
    )
    api.force_authenticate(admin)

    response = api.post(
        _url(broker), {"confirm": True, "reason": "Admin sweep."}, format="json"
    )

    assert response.status_code == 200
    assert response.data["approved_count"] == 1


@pytest.mark.django_db
def test_the_api_reports_each_failure_with_its_row_and_code(api, workflow_enabled):
    moderator = _staff("bulk-api-fail-mod@example.com", StaffGroup.MODERATOR)
    broker, _, rows = _broker_with_backlog(
        "bulk-api-fail", "bulk-api-fail-agent@example.com", pending=1, invalid=1
    )
    bad_listing, bad_revision = rows[-1]
    api.force_authenticate(moderator)

    response = api.post(
        _url(broker), {"confirm": True, "reason": "Mixed bag."}, format="json"
    )

    assert response.status_code == 200
    assert response.data["approved_count"] == 1
    assert response.data["failed_count"] == 1
    failure = response.data["failures"][0]
    assert failure["revision_id"] == str(bad_revision.pk)
    assert failure["listing_id"] == str(bad_listing.pk)
    assert failure["code"] == "validation_error"
    assert failure["message"] == moderation.INVALID_SUBMISSION_MESSAGE
    assert "title_en" not in str(response.data["failures"])
    assert response.data["broker"]["pending_revision_count"] == 1


@pytest.mark.django_db
def test_the_broker_block_matches_the_staff_detail_endpoint(api, workflow_enabled):
    moderator = _staff("bulk-api-shape@example.com", StaffGroup.MODERATOR)
    broker, _, _ = _broker_with_backlog(
        "bulk-api-shape", "bulk-api-shape-agent@example.com", pending=1
    )
    api.force_authenticate(moderator)

    posted = api.post(
        _url(broker), {"confirm": True, "reason": "Shape check."}, format="json"
    )
    detail = api.get(reverse("staff-broker-detail", args=[broker.pk]))

    assert posted.data["broker"] == detail.data


@pytest.mark.django_db
@pytest.mark.parametrize(
    "body", [{"reason": "Forgot to tick the box."}, {"confirm": False, "reason": "No."}]
)
def test_the_api_refuses_an_unconfirmed_run(api, workflow_enabled, body):
    moderator = _staff("bulk-noconfirm-mod@example.com", StaffGroup.MODERATOR)
    broker, _, rows = _broker_with_backlog(
        "bulk-noconfirm", "bulk-noconfirm-agent@example.com", pending=1
    )
    api.force_authenticate(moderator)

    response = api.post(_url(broker), body, format="json")

    assert response.status_code == 400
    assert response.data["error"]["fields"]["confirm"] == [
        {
            "message": "Confirm that every pending submission for this broker should be approved.",
            "code": "bulk_approve_not_confirmed",
        }
    ]
    listing, _ = rows[0]
    listing.refresh_from_db()
    assert listing.status == ListingStatus.PENDING_APPROVAL
    assert _bulk_event(broker).count() == 0


@pytest.mark.django_db
def test_the_api_refuses_a_run_with_no_reason(api, workflow_enabled):
    moderator = _staff("bulk-noreason-mod@example.com", StaffGroup.MODERATOR)
    broker, _, rows = _broker_with_backlog(
        "bulk-noreason", "bulk-noreason-agent@example.com", pending=1
    )
    api.force_authenticate(moderator)

    response = api.post(_url(broker), {"confirm": True}, format="json")

    assert response.status_code == 400
    # The serializer refuses it before the service is ever called, so the caller
    # gets the bulk-approve wording rather than the policy-toggle one that
    # `clean_policy_reason` would raise from behind it.
    assert response.data["error"]["fields"]["reason"] == [
        {
            "message": "Explain why this broker's pending submissions are being approved together.",
            "code": "policy_reason_required",
        }
    ]
    listing, _ = rows[0]
    listing.refresh_from_db()
    assert listing.status == ListingStatus.PENDING_APPROVAL
    assert _bulk_event(broker).count() == 0


@pytest.mark.django_db
def test_a_five_hundred_character_reason_is_accepted_and_a_longer_one_is_not(
    api, workflow_enabled
):
    moderator = _staff("bulk-len-mod@example.com", StaffGroup.MODERATOR)
    broker, _, _ = _broker_with_backlog(
        "bulk-len", "bulk-len-agent@example.com", pending=1
    )
    api.force_authenticate(moderator)

    too_long = api.post(
        _url(broker), {"confirm": True, "reason": "x" * 501}, format="json"
    )
    assert too_long.status_code == 400
    assert "reason" in too_long.data["error"]["fields"]
    assert _bulk_event(broker).count() == 0

    exact = api.post(
        _url(broker), {"confirm": True, "reason": "  " + "x" * 500 + "  "}, format="json"
    )
    assert exact.status_code == 200
    assert _bulk_event(broker).get().metadata["reason"] == "x" * 500


@pytest.mark.django_db
def test_an_unknown_broker_is_a_404(api, workflow_enabled):
    moderator = _staff("bulk-404-mod@example.com", StaffGroup.MODERATOR)
    api.force_authenticate(moderator)

    response = api.post(
        reverse("staff-broker-bulk-approve", args=[uuid.uuid4()]),
        {"confirm": True, "reason": "Nobody home."},
        format="json",
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_the_endpoint_is_gated_on_the_listing_revisions_flag(api, db):
    set_feature_flag(key="listing_revisions", is_enabled=False, actor=None)
    moderator = _staff("bulk-flag-mod@example.com", StaffGroup.MODERATOR)
    broker, _, rows = _broker_with_backlog(
        "bulk-flag", "bulk-flag-agent@example.com", pending=1
    )
    api.force_authenticate(moderator)

    response = api.post(
        _url(broker), {"confirm": True, "reason": "Too early."}, format="json"
    )

    assert response.status_code == 403
    assert response.data["error"]["code"] == "feature_disabled"
    listing, revision = rows[0]
    listing.refresh_from_db()
    revision.refresh_from_db()
    assert listing.status == ListingStatus.PENDING_APPROVAL
    assert revision.state == RevisionStatus.SUBMITTED
    assert _bulk_event(broker).count() == 0


def _assert_denied_and_nothing_published(response, broker, rows, code):
    assert response.status_code == 403
    assert response.data["error"]["code"] == code
    for listing, revision in rows:
        listing.refresh_from_db()
        revision.refresh_from_db()
        assert listing.status == ListingStatus.PENDING_APPROVAL
        assert listing.current_public_snapshot_id is None
        assert revision.state == RevisionStatus.SUBMITTED
    assert ListingSnapshot.objects.count() == 0
    assert _no_workflow_audit_rows()


@pytest.mark.django_db
def test_a_broker_admin_cannot_bulk_approve_their_own_backlog(api, workflow_enabled):
    broker, agent, rows = _broker_with_backlog(
        "bulk-selfserve", "bulk-selfserve-agent@example.com", pending=1
    )
    api.force_authenticate(agent)

    response = api.post(
        _url(broker),
        {"confirm": True, "reason": "Approving my own work."},
        format="json",
    )

    _assert_denied_and_nothing_published(
        response, broker, rows, "staff_moderator_required"
    )


@pytest.mark.django_db
def test_a_broker_agent_of_this_broker_is_denied(api, workflow_enabled):
    broker, _, rows = _broker_with_backlog(
        "bulk-agentdeny", "bulk-agentdeny-owner@example.com", pending=1
    )
    agent = make_user("bulk-agentdeny@example.com", role=UserRole.BROKER, verified=True)
    make_membership(agent, broker, role=BrokerMembershipRole.AGENT, can_edit_listings=True)
    api.force_authenticate(agent)

    response = api.post(
        _url(broker), {"confirm": True, "reason": "Let me."}, format="json"
    )

    _assert_denied_and_nothing_published(
        response, broker, rows, "staff_moderator_required"
    )


@pytest.mark.django_db
def test_a_member_of_another_broker_is_denied(api, workflow_enabled):
    broker, _, rows = _broker_with_backlog(
        "bulk-otherorg", "bulk-otherorg-owner@example.com", pending=1
    )
    other = make_broker(name="Other Org", slug="bulk-other-org")
    outsider = make_user("bulk-otherorg@example.com", role=UserRole.BROKER, verified=True)
    make_membership(
        outsider,
        other,
        role=BrokerMembershipRole.ADMIN,
        can_edit_listings=True,
        can_manage_team=True,
    )
    api.force_authenticate(outsider)

    response = api.post(
        _url(broker), {"confirm": True, "reason": "Not mine."}, format="json"
    )

    _assert_denied_and_nothing_published(
        response, broker, rows, "staff_moderator_required"
    )


@pytest.mark.django_db
@pytest.mark.parametrize("role", [UserRole.PRIVATE_SELLER, UserRole.PRIVATE_SELLER])
def test_a_buyer_or_private_seller_is_denied(api, workflow_enabled, role):
    broker, _, rows = _broker_with_backlog(
        f"bulk-{role.lower()}", f"bulk-{role.lower()}-owner@example.com", pending=1
    )
    user = make_user(f"bulk-{role.lower()}@example.com", role=role, verified=True)
    api.force_authenticate(user)

    response = api.post(
        _url(broker), {"confirm": True, "reason": "Curious."}, format="json"
    )

    _assert_denied_and_nothing_published(
        response, broker, rows, "staff_moderator_required"
    )


@pytest.mark.django_db
def test_a_staff_user_without_a_staff_group_is_denied(api, workflow_enabled):
    broker, _, rows = _broker_with_backlog(
        "bulk-nogroup", "bulk-nogroup-owner@example.com", pending=1
    )
    user = make_user("bulk-nogroup@example.com", role=UserRole.STAFF, verified=True)
    api.force_authenticate(user)

    response = api.post(
        _url(broker), {"confirm": True, "reason": "No group."}, format="json"
    )

    _assert_denied_and_nothing_published(
        response, broker, rows, "staff_moderator_required"
    )


@pytest.mark.django_db
def test_an_inactive_staff_moderator_is_denied(api, workflow_enabled):
    broker, _, rows = _broker_with_backlog(
        "bulk-inactive", "bulk-inactive-owner@example.com", pending=1
    )
    moderator = _staff("bulk-inactive-mod@example.com", StaffGroup.MODERATOR)
    moderator.is_active = False
    moderator.save(update_fields=["is_active"])
    api.force_authenticate(moderator)

    response = api.post(
        _url(broker), {"confirm": True, "reason": "Should not work."}, format="json"
    )

    assert response.status_code in (401, 403)
    for listing, revision in rows:
        listing.refresh_from_db()
        revision.refresh_from_db()
        assert listing.status == ListingStatus.PENDING_APPROVAL
        assert revision.state == RevisionStatus.SUBMITTED
    assert ListingSnapshot.objects.count() == 0
    assert _no_workflow_audit_rows()


@pytest.mark.django_db
def test_an_anonymous_caller_gets_401_and_publishes_nothing(api, workflow_enabled):
    broker, _, rows = _broker_with_backlog(
        "bulk-anon", "bulk-anon-owner@example.com", pending=1
    )

    response = api.post(
        _url(broker), {"confirm": True, "reason": "No."}, format="json"
    )

    assert response.status_code == 401
    for listing, revision in rows:
        listing.refresh_from_db()
        revision.refresh_from_db()
        assert listing.status == ListingStatus.PENDING_APPROVAL
        assert revision.state == RevisionStatus.SUBMITTED
    assert ListingSnapshot.objects.count() == 0
    assert _no_workflow_audit_rows()
