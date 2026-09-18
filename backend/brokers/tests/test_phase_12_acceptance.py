"""Spec §21's four acceptance tests and seven rules, end to end.

These go through the real HTTP endpoints — no service is called directly —
because the rules they prove are about what a broker user and a staff user can
and cannot make the system do.

The draft/submit request bodies below follow Phase 11's `listings.payloads`
schema. **Copy the exact key names from `listings/tests/test_draft_create.py`
rather than from memory** if anything fails to validate: that file is the
merged, authoritative example of the schema.
"""

import pytest
from django.contrib.auth.models import Group
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.enums import StaffGroup, UserRole
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
from listings.models import BoatListing, ListingSnapshot
from listings.tests.factories import (
    make_brand,
    make_broker_listing,
    make_media,
    make_model,
    make_revision,
)
from platform_settings.services import set_feature_flag


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


def _agency(slug, email, *, auto=False, status=BrokerOrganizationStatus.ACTIVE):
    broker = make_broker(
        name=f"Agency {slug}",
        slug=slug,
        status=status,
        auto_approve_listings=auto,
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
    return broker, agent


def _draft_body(broker, brand, model, **overrides):
    body = {
        "broker_id": str(broker.pk),
        "brand_id": str(brand.pk),
        "model_id": str(model.pk),
        "manufacture_year": 2022,
        "title_en": "Fountaine Pajot Astrea 42",
        "description_en": "Owner version, full service history.",
        "specifications": {"length_m": "12.6"},
        "location_country": "ES",
        "location_city": "Palma",
        "price": "399000.00",
        "currency": "EUR",
    }
    body.update(overrides)
    return body


def _publish_through_the_api(api, broker, agent, brand, model, **overrides):
    """Create a broker draft, attach a READY image and submit it, all over HTTP.

    Media rows are created directly because Phase 11 owns the model only — the
    upload/scan pipeline is Phase 15 (spec §24), so there is no upload endpoint
    to call and `ListingMedia.status` is written by tests and Django admin.
    """
    created = api.post(
        reverse("listing-draft-create"),
        _draft_body(broker, brand, model, **overrides),
        format="json",
    )
    assert created.status_code == 201, created.data
    listing = BoatListing.objects.get(pk=created.data["id"])
    image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY)

    patched = api.patch(
        reverse("listing-draft-update", args=[listing.pk]),
        {"version": created.data["revision"]["version"], "media_ids": [str(image.pk)]},
        format="json",
    )
    assert patched.status_code == 200, patched.data

    submitted = api.post(
        reverse("listing-submit", args=[listing.pk]),
        {"version": patched.data["revision"]["version"]},
        format="json",
    )
    return listing, submitted


# --- Acceptance test 1: "A broker can create listing 101 without quota failure."


@pytest.mark.django_db
def test_21_acceptance_1_a_broker_creates_listing_101_without_a_quota_failure(
    api, workflow_enabled
):
    broker, agent = _agency("quota-101", "quota-101@example.com", auto=True)
    brand = make_brand("Fountaine Pajot")
    model = make_model(brand, "Astrea 42")
    # The first hundred exist already. They are built with the factory rather
    # than a hundred HTTP round trips because what this test proves is that
    # listing *101* is refused by nothing — not that the factory works.
    for _ in range(100):
        make_broker_listing(
            broker=broker,
            actor=agent,
            brand=brand,
            model=model,
            status=ListingStatus.PUBLISHED,
        )
    assert BoatListing.objects.filter(broker=broker).count() == 100
    api.force_authenticate(agent)

    listing, submitted = _publish_through_the_api(api, broker, agent, brand, model)

    assert submitted.status_code == 200, submitted.data
    listing.refresh_from_db()
    assert BoatListing.objects.filter(broker=broker).count() == 101
    assert listing.status == ListingStatus.PUBLISHED
    assert listing.publication_source == PublicationSource.BROKER_POLICY


# --- Acceptance test 2: "An ordinary broker user cannot toggle auto-approval
# --- through UI or API." (The UI half is
# --- frontend/src/app/dashboard/staff/brokers/[brokerId]/page.test.tsx.)


@pytest.mark.django_db
def test_21_acceptance_2_a_broker_user_cannot_toggle_the_policy_through_the_api(
    api, workflow_enabled
):
    broker, agent = _agency("self-toggle", "self-toggle@example.com")
    api.force_authenticate(agent)

    response = api.patch(
        reverse("staff-broker-approval-policy", args=[broker.pk]),
        {"auto_approve_listings": True, "reason": "I would like this on."},
        format="json",
    )

    assert response.status_code == 403
    assert response.data["error"]["code"] == "staff_admin_required"
    broker.refresh_from_db()
    assert broker.auto_approve_listings is False
    assert AuditEvent.objects.filter(target_id=str(broker.pk)).count() == 0


@pytest.mark.django_db
def test_21_acceptance_2_a_broker_user_cannot_read_the_staff_broker_screen(
    api, workflow_enabled
):
    broker, agent = _agency("self-read", "self-read@example.com")
    api.force_authenticate(agent)

    response = api.get(reverse("staff-broker-detail", args=[broker.pk]))

    assert response.status_code == 403
    assert response.data["error"]["code"] == "staff_moderator_required"


@pytest.mark.django_db
def test_21_acceptance_2_a_broker_user_cannot_bulk_approve(api, workflow_enabled):
    broker, agent = _agency("self-bulk", "self-bulk@example.com")
    api.force_authenticate(agent)

    response = api.post(
        reverse("staff-broker-bulk-approve", args=[broker.pk]),
        {"confirm": True, "reason": "Approving my own work."},
        format="json",
    )

    assert response.status_code == 403


# --- Acceptance test 3: "Auto-approved submission creates snapshot/published
# --- state atomically."


@pytest.mark.django_db
def test_21_acceptance_3_an_auto_approved_submission_publishes_atomically(
    api, workflow_enabled
):
    broker, agent = _agency("atomic", "atomic@example.com", auto=True)
    brand = make_brand("Lagoon")
    model = make_model(brand, "42")
    api.force_authenticate(agent)

    listing, submitted = _publish_through_the_api(api, broker, agent, brand, model)

    assert submitted.status_code == 200, submitted.data
    listing.refresh_from_db()
    snapshot = listing.current_public_snapshot
    # One transaction: the listing is PUBLISHED, a version-1 snapshot exists and
    # is current, and the revision is APPROVED. No intermediate state is
    # observable, because all four writes happened under one atomic block.
    assert listing.status == ListingStatus.PUBLISHED
    assert snapshot is not None and snapshot.version == 1
    assert snapshot.approved_at is not None
    assert listing.published_at is not None
    assert listing.revisions.get().state == RevisionStatus.APPROVED
    assert submitted.data["current_public_snapshot_version"] == 1

    # And it is publicly readable straight away — the point of auto-approval.
    public = APIClient().get(reverse("listing-detail", args=[listing.pk]))
    assert public.status_code == 200
    assert public.data["snapshot_version"] == 1


# --- Acceptance test 4: "Invalid listing never publishes even when
# --- auto-approval is on."


@pytest.mark.django_db
def test_21_acceptance_4_an_invalid_listing_never_publishes(api, workflow_enabled):
    broker, agent = _agency("invalid", "invalid@example.com", auto=True)
    brand = make_brand("Bavaria")
    model = make_model(brand, "46")
    api.force_authenticate(agent)
    created = api.post(
        reverse("listing-draft-create"),
        _draft_body(broker, brand, model),
        format="json",
    )
    listing = BoatListing.objects.get(pk=created.data["id"])
    # No media at all: spec §20.1 step 3 requires at least one READY image.

    submitted = api.post(
        reverse("listing-submit", args=[listing.pk]),
        {"version": created.data["revision"]["version"]},
        format="json",
    )

    assert submitted.status_code == 400
    listing.refresh_from_db()
    assert listing.status == ListingStatus.DRAFT
    assert listing.current_public_snapshot_id is None
    assert ListingSnapshot.objects.filter(listing=listing).count() == 0
    assert listing.revisions.get().state == RevisionStatus.DRAFT
    assert APIClient().get(
        reverse("listing-detail", args=[listing.pk])
    ).status_code == 404


# --- Rules 2, 3, 5, 6 and 7.


@pytest.mark.django_db
def test_21_rule_3_a_new_broker_organization_starts_with_the_policy_off():
    broker = make_broker(name="Fresh", slug="fresh")
    assert broker.auto_approve_listings is False
    assert broker.auto_approve_changed_by_id is None
    assert broker.auto_approve_changed_at is None


@pytest.mark.django_db
def test_21_rule_2_a_suspended_organization_does_not_auto_publish(
    api, workflow_enabled
):
    """"Unlimited" does not bypass suspension. The membership path is closed by
    Phase 3's active-organization check, so this exercises the staff-admin
    on-behalf path, which is the only way to submit for a suspended agency."""
    broker, _ = _agency(
        "suspended",
        "suspended-agent@example.com",
        auto=True,
        status=BrokerOrganizationStatus.SUSPENDED,
    )
    admin = _staff("suspend-admin@example.com", StaffGroup.ADMIN)
    listing = make_broker_listing(broker=broker, actor=admin)
    image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY)
    revision = make_revision(
        listing,
        payload={
            "title_en": "Suspended agency boat",
            "description_en": "Should not auto-publish.",
            "specifications": {"length_m": "11.0"},
            "location_country": "ES",
            "location_city": "Ibiza",
            "price": "199000.00",
            "currency": "EUR",
            "media_ids": [str(image.pk)],
        },
    )
    api.force_authenticate(admin)

    response = api.post(
        reverse("listing-submit", args=[listing.pk]),
        {"version": revision.version},
        format="json",
    )

    assert response.status_code == 200, response.data
    listing.refresh_from_db()
    assert listing.status == ListingStatus.PENDING_APPROVAL
    assert listing.current_public_snapshot_id is None


@pytest.mark.django_db
def test_21_rule_5_enabling_the_policy_leaves_the_pending_backlog_pending(
    api, workflow_enabled
):
    broker, agent = _agency("rule5", "rule5@example.com", auto=False)
    brand = make_brand("Jeanneau")
    model = make_model(brand, "Sun Odyssey 410")
    api.force_authenticate(agent)
    listing, submitted = _publish_through_the_api(api, broker, agent, brand, model)
    assert submitted.status_code == 200
    listing.refresh_from_db()
    assert listing.status == ListingStatus.PENDING_APPROVAL

    admin = _staff("rule5-admin@example.com", StaffGroup.ADMIN)
    api.force_authenticate(admin)
    policy = api.patch(
        reverse("staff-broker-approval-policy", args=[broker.pk]),
        {"auto_approve_listings": True, "reason": "Vetted after review."},
        format="json",
    )

    assert policy.status_code == 200
    listing.refresh_from_db()
    assert listing.status == ListingStatus.PENDING_APPROVAL
    assert listing.current_public_snapshot_id is None
    assert policy.data["pending_revision_count"] == 1


@pytest.mark.django_db
def test_21_rule_6_disabling_the_policy_leaves_published_listings_live(
    api, workflow_enabled
):
    broker, agent = _agency("rule6", "rule6@example.com", auto=True)
    brand = make_brand("Beneteau")
    model = make_model(brand, "Oceanis 46.1")
    api.force_authenticate(agent)
    listing, submitted = _publish_through_the_api(api, broker, agent, brand, model)
    assert submitted.status_code == 200

    admin = _staff("rule6-admin@example.com", StaffGroup.ADMIN)
    api.force_authenticate(admin)
    api.patch(
        reverse("staff-broker-approval-policy", args=[broker.pk]),
        {"auto_approve_listings": False, "reason": "Two quality complaints."},
        format="json",
    )

    listing.refresh_from_db()
    assert listing.status == ListingStatus.PUBLISHED
    assert listing.current_public_snapshot is not None
    assert APIClient().get(
        reverse("listing-detail", args=[listing.pk])
    ).status_code == 200


@pytest.mark.django_db
def test_21_rule_7_staff_bulk_approve_clears_the_backlog_and_is_audited(
    api, workflow_enabled
):
    broker, agent = _agency("rule7", "rule7@example.com", auto=False)
    brand = make_brand("Dufour")
    api.force_authenticate(agent)
    for index in range(3):
        model = make_model(brand, f"470-{index}")
        _, submitted = _publish_through_the_api(api, broker, agent, brand, model)
        assert submitted.status_code == 200

    moderator = _staff("rule7-mod@example.com", StaffGroup.MODERATOR)
    api.force_authenticate(moderator)
    response = api.post(
        reverse("staff-broker-bulk-approve", args=[broker.pk]),
        {"confirm": True, "reason": "Backlog cleared after onboarding call."},
        format="json",
    )

    assert response.status_code == 200, response.data
    assert response.data["approved_count"] == 3
    assert response.data["failed_count"] == 0
    assert response.data["broker"]["pending_revision_count"] == 0
    assert response.data["broker"]["listing_counts"]["by_status"]["PUBLISHED"] == 3
    event = AuditEvent.objects.get(
        target_id=str(broker.pk), action="broker.pending_revisions_bulk_approved"
    )
    assert event.metadata["reason"] == "Backlog cleared after onboarding call."


@pytest.mark.django_db
def test_21_rule_4_every_policy_change_is_audited_with_its_reason(
    api, workflow_enabled
):
    broker, _ = _agency("rule4", "rule4@example.com")
    admin = _staff("rule4-admin@example.com", StaffGroup.ADMIN)
    api.force_authenticate(admin)

    api.patch(
        reverse("staff-broker-approval-policy", args=[broker.pk]),
        {"auto_approve_listings": True, "reason": "Onboarded 2026-09-18."},
        format="json",
    )
    api.patch(
        reverse("staff-broker-approval-policy", args=[broker.pk]),
        {"auto_approve_listings": False, "reason": "Paused pending review."},
        format="json",
    )

    events = AuditEvent.objects.filter(
        target_id=str(broker.pk), action="broker.auto_approval_changed"
    ).order_by("created_at")
    assert [event.metadata["reason"] for event in events] == [
        "Onboarded 2026-09-18.",
        "Paused pending review.",
    ]
    assert all(event.actor_user_id == admin.pk for event in events)
