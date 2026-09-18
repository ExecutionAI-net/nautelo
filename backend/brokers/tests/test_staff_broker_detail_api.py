"""Spec §21 "Staff broker UI": every item the screen shows has a real source."""

import pytest
from django.contrib.auth.models import Group
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from audit.models import AuditEvent
from audit.services import record_audit_event
from brokers import selectors
from brokers.enums import BrokerMembershipRole, BrokerOrganizationStatus
from brokers.services import set_broker_auto_approval
from brokers.tests.factories import make_broker, make_membership
from listings.enums import ListingStatus, RevisionStatus
from listings.tests.factories import (
    make_brand,
    make_broker_listing,
    make_model,
    make_revision,
)
from taxonomy.models import BoatBrand


@pytest.fixture
def api():
    return APIClient()


def _staff(email, group_name):
    user = make_user(email, role=UserRole.STAFF, verified=True)
    user.groups.add(Group.objects.get(name=group_name))
    return user


def _listing(broker, agent, status):
    """make_broker_listing derives a brand from the broker id, so a second listing
    for the same broker collides on the unique brand name; reuse one brand."""
    brand = BoatBrand.objects.filter(name=f"Brand {broker.pk.hex[:8]}").first() or make_brand(
        f"Brand {broker.pk.hex[:8]}"
    )
    model = brand.models.first() or make_model(brand)
    return make_broker_listing(
        broker=broker, actor=agent, brand=brand, model=model, status=status
    )


def _detail_url(broker):
    return reverse("staff-broker-detail", args=[broker.pk])


@pytest.mark.django_db
def test_a_moderator_reads_status_counts_policy_and_audit_history(api):
    moderator = _staff("detail-mod@example.com", StaffGroup.MODERATOR)
    admin = _staff("detail-admin@example.com", StaffGroup.ADMIN)
    broker = make_broker(name="Blue Marine", slug="blue-marine")
    agent = make_user("detail-agent@example.com", role=UserRole.BROKER, verified=True)
    make_membership(agent, broker, role=BrokerMembershipRole.ADMIN)
    published = _listing(broker, agent, ListingStatus.PUBLISHED)
    pending = _listing(broker, agent, ListingStatus.PENDING_APPROVAL)
    make_revision(pending, state=RevisionStatus.SUBMITTED, submitted_by=agent,
                  submitted_at=published.created_at)
    set_broker_auto_approval(
        broker, enabled=True, actor=admin, reason="Vetted partner."
    )
    api.force_authenticate(moderator)

    response = api.get(_detail_url(broker))

    assert response.status_code == 200
    body = response.data
    assert body["id"] == str(broker.pk)
    assert body["name"] == "Blue Marine"
    assert body["status"] == BrokerOrganizationStatus.ACTIVE
    assert body["auto_approve_listings"] is True
    assert body["auto_approve_changed_by"]["email"] == "detail-admin@example.com"
    assert body["auto_approve_changed_at"] is not None
    assert body["listing_counts"]["by_status"][ListingStatus.PUBLISHED] == 1
    assert body["listing_counts"]["by_status"][ListingStatus.PENDING_APPROVAL] == 1
    assert body["listing_counts"]["by_status"][ListingStatus.ARCHIVED] == 0
    assert body["listing_counts"]["total"] == 2
    assert body["pending_revision_count"] == 1
    assert [entry["action"] for entry in body["audit_history"]] == [
        "broker.auto_approval_changed"
    ]
    assert body["audit_history"][0]["reason"] == "Vetted partner."
    assert body["audit_history"][0]["actor"]["email"] == "detail-admin@example.com"


@pytest.mark.django_db
def test_every_listing_state_is_reported_even_at_zero(api):
    moderator = _staff("detail-zero@example.com", StaffGroup.MODERATOR)
    broker = make_broker(name="Empty", slug="empty")
    api.force_authenticate(moderator)

    response = api.get(_detail_url(broker))

    assert response.status_code == 200
    by_status = response.data["listing_counts"]["by_status"]
    assert set(by_status) == {status.value for status in ListingStatus}
    assert set(by_status.values()) == {0}
    assert response.data["listing_counts"]["total"] == 0
    assert response.data["audit_history"] == []
    assert response.data["auto_approve_changed_by"] is None


@pytest.mark.django_db
def test_counts_only_cover_this_broker(api):
    moderator = _staff("detail-scope@example.com", StaffGroup.MODERATOR)
    mine = make_broker(name="Mine", slug="mine")
    theirs = make_broker(name="Theirs", slug="theirs")
    agent = make_user("detail-scope-agent@example.com", role=UserRole.BROKER, verified=True)
    make_broker_listing(broker=theirs, actor=agent, status=ListingStatus.PUBLISHED)
    api.force_authenticate(moderator)

    response = api.get(_detail_url(mine))

    assert response.data["listing_counts"]["total"] == 0


@pytest.mark.django_db
@pytest.mark.parametrize(
    "role,expected",
    [(UserRole.BROKER, 403), (UserRole.PRIVATE_SELLER, 403), (UserRole.BUYER, 403)],
)
def test_a_non_staff_user_cannot_read_the_staff_broker_detail(api, role, expected):
    broker = make_broker(name="Guarded", slug="guarded-detail")
    user = make_user(f"detail-{role.lower()}@example.com", role=role, verified=True)
    if role == UserRole.BROKER:
        make_membership(user, broker, role=BrokerMembershipRole.ADMIN)
    api.force_authenticate(user)

    response = api.get(_detail_url(broker))

    assert response.status_code == expected
    assert response.data["error"]["code"] == "staff_moderator_required"


@pytest.mark.django_db
def test_an_anonymous_request_is_rejected(api):
    broker = make_broker(name="Anon", slug="anon-detail")

    response = api.get(_detail_url(broker))

    assert response.status_code == 401


@pytest.mark.django_db
def test_an_unknown_broker_is_a_404(api):
    import uuid

    moderator = _staff("detail-404@example.com", StaffGroup.MODERATOR)
    api.force_authenticate(moderator)

    response = api.get(reverse("staff-broker-detail", args=[uuid.uuid4()]))

    assert response.status_code == 404


@pytest.mark.django_db
def test_an_admin_can_also_read_the_detail(api):
    admin = _staff("detail-admin-read@example.com", StaffGroup.ADMIN)
    broker = make_broker(name="Admin Read", slug="admin-read")
    api.force_authenticate(admin)

    assert api.get(_detail_url(broker)).status_code == 200


@pytest.mark.django_db
def test_a_staff_role_user_without_a_staff_group_is_refused(api):
    broker = make_broker(name="No Group", slug="no-group")
    user = make_user("detail-nogroup@example.com", role=UserRole.STAFF, verified=True)
    api.force_authenticate(user)

    response = api.get(_detail_url(broker))

    assert response.status_code == 403
    assert response.data["error"]["code"] == "staff_moderator_required"


@pytest.mark.django_db
def test_a_staff_group_member_without_the_staff_role_is_refused(api):
    broker = make_broker(name="Wrong Role", slug="wrong-role")
    user = make_user("detail-wrongrole@example.com", role=UserRole.BUYER, verified=True)
    user.groups.add(Group.objects.get(name=StaffGroup.ADMIN))
    api.force_authenticate(user)

    assert api.get(_detail_url(broker)).status_code == 403


@pytest.mark.django_db
def test_an_inactive_staff_user_is_refused(api):
    broker = make_broker(name="Inactive", slug="inactive-staff")
    moderator = _staff("detail-inactive@example.com", StaffGroup.MODERATOR)
    moderator.is_active = False
    moderator.save(update_fields=["is_active"])
    api.force_authenticate(moderator)

    assert api.get(_detail_url(broker)).status_code in (401, 403)


@pytest.mark.django_db
def test_a_member_of_this_very_broker_cannot_read_the_staff_detail(api):
    broker = make_broker(name="Own", slug="own-detail")
    agent = make_user("detail-own@example.com", role=UserRole.BROKER, verified=True)
    make_membership(agent, broker, role=BrokerMembershipRole.ADMIN, can_manage_team=True)
    api.force_authenticate(agent)

    response = api.get(_detail_url(broker))

    assert response.status_code == 403
    assert "audit_history" not in response.data


@pytest.mark.django_db
def test_audit_history_never_includes_another_brokers_or_other_targets_rows(api):
    moderator = _staff("detail-iso-mod@example.com", StaffGroup.MODERATOR)
    admin = _staff("detail-iso-admin@example.com", StaffGroup.ADMIN)
    mine = make_broker(name="Iso Mine", slug="iso-mine")
    theirs = make_broker(name="Iso Theirs", slug="iso-theirs")
    set_broker_auto_approval(theirs, enabled=True, actor=admin, reason="Theirs only.")
    record_audit_event(
        actor_user=admin,
        actor_type=AuditEvent.ActorType.USER,
        action="listings.revision_approved",
        target_type="listings.ListingRevision",
        target_id=str(mine.pk),
        source=AuditEvent.Source.API,
    )
    api.force_authenticate(moderator)

    response = api.get(_detail_url(mine))

    assert response.data["audit_history"] == []
    assert "Theirs only." not in str(response.data)


@pytest.mark.django_db
def test_audit_history_is_newest_first_and_the_selector_caps_it(api):
    moderator = _staff("detail-cap-mod@example.com", StaffGroup.MODERATOR)
    admin = _staff("detail-cap-admin@example.com", StaffGroup.ADMIN)
    broker = make_broker(name="Cap", slug="cap-detail")
    for index, enabled in enumerate([True, False, True]):
        set_broker_auto_approval(
            broker, enabled=enabled, actor=admin, reason=f"Change {index}."
        )
    api.force_authenticate(moderator)

    response = api.get(_detail_url(broker))

    assert [e["reason"] for e in response.data["audit_history"]] == [
        "Change 2.",
        "Change 1.",
        "Change 0.",
    ]
    capped = selectors.broker_audit_history(broker, limit=2)
    assert [e.metadata["reason"] for e in capped] == ["Change 2.", "Change 1."]
    assert selectors.BROKER_AUDIT_HISTORY_LIMIT == 50


@pytest.mark.django_db
def test_query_count_does_not_grow_with_audit_rows_or_pending_items(
    api, django_assert_num_queries
):
    moderator = _staff("detail-n1-mod@example.com", StaffGroup.MODERATOR)
    admin = _staff("detail-n1-admin@example.com", StaffGroup.ADMIN)
    agent = make_user("detail-n1-agent@example.com", role=UserRole.BROKER, verified=True)
    broker = make_broker(name="N Plus One", slug="n-plus-one")
    api.force_authenticate(moderator)
    set_broker_auto_approval(broker, enabled=True, actor=admin, reason="First.")
    api.get(_detail_url(broker))  # warm caches (permission groups, content types)
    with CaptureQueriesContext(connection) as small:
        api.get(_detail_url(broker))

    for index in range(6):
        set_broker_auto_approval(
            broker, enabled=index % 2 == 1, actor=admin, reason=f"Flip {index}."
        )
        listing = _listing(broker, agent, ListingStatus.PENDING_APPROVAL)
        make_revision(
            listing, state=RevisionStatus.SUBMITTED, submitted_by=agent,
            submitted_at=listing.created_at,
        )
    with CaptureQueriesContext(connection) as large:
        response = api.get(_detail_url(broker))

    assert len(response.data["audit_history"]) == 7
    assert len(large) == len(small)


@pytest.mark.django_db
def test_pending_revision_count_only_covers_this_brokers_submitted_revisions(api):
    moderator = _staff("detail-pend-mod@example.com", StaffGroup.MODERATOR)
    agent = make_user("detail-pend-agent@example.com", role=UserRole.BROKER, verified=True)
    mine = make_broker(name="Pend Mine", slug="pend-mine")
    theirs = make_broker(name="Pend Theirs", slug="pend-theirs")
    for _ in range(2):
        their_listing = _listing(theirs, agent, ListingStatus.PENDING_APPROVAL)
        make_revision(
            their_listing, state=RevisionStatus.SUBMITTED,
            submitted_by=agent, submitted_at=their_listing.created_at,
        )
    api.force_authenticate(moderator)

    assert api.get(_detail_url(mine)).data["pending_revision_count"] == 0
    assert selectors.pending_revision_count(mine) == 0

    my_listing = _listing(mine, agent, ListingStatus.PENDING_APPROVAL)
    make_revision(
        my_listing, state=RevisionStatus.SUBMITTED, submitted_by=agent,
        submitted_at=my_listing.created_at,
    )
    make_revision(_listing(mine, agent, ListingStatus.DRAFT), state=RevisionStatus.DRAFT)

    assert api.get(_detail_url(mine)).data["pending_revision_count"] == 1
    assert api.get(_detail_url(theirs)).data["pending_revision_count"] == 2


@pytest.mark.django_db
def test_listing_counts_by_status_ignore_other_brokers(api):
    mine = make_broker(name="Cnt Mine", slug="cnt-mine")
    theirs = make_broker(name="Cnt Theirs", slug="cnt-theirs")
    agent = make_user("detail-cnt-agent@example.com", role=UserRole.BROKER, verified=True)
    _listing(mine, agent, ListingStatus.PUBLISHED)
    _listing(theirs, agent, ListingStatus.PUBLISHED)
    _listing(theirs, agent, ListingStatus.ARCHIVED)

    counts = selectors.broker_listing_counts(mine)

    assert counts["by_status"][ListingStatus.PUBLISHED] == 1
    assert counts["by_status"][ListingStatus.ARCHIVED] == 0
    assert counts["total"] == 1


@pytest.mark.django_db
def test_audit_history_order_is_stable_when_timestamps_tie(monkeypatch):
    admin = _staff("detail-tie-admin@example.com", StaffGroup.ADMIN)
    broker = make_broker(name="Tie", slug="tie-detail")
    frozen = timezone.now()
    monkeypatch.setattr(timezone, "now", lambda: frozen)
    for index in range(5):
        record_audit_event(
            actor_user=admin,
            actor_type=AuditEvent.ActorType.USER,
            action=f"broker.tie_{index}",
            target_type="brokers.BrokerOrganization",
            target_id=str(broker.pk),
            source=AuditEvent.Source.API,
        )
    assert AuditEvent.objects.filter(
        target_id=str(broker.pk), created_at=frozen
    ).count() == 5

    first = [e.pk for e in selectors.broker_audit_history(broker)]
    expected = [
        e.pk
        for e in sorted(
            AuditEvent.objects.filter(target_id=str(broker.pk)),
            key=lambda e: e.pk,
            reverse=True,
        )
    ]

    assert first == expected
