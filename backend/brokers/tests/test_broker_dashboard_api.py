"""GET /api/v1/brokers/<id>/dashboard/ — spec 28's "Dashboard metrics".

Spec 28: "Broker home may show only backend-derived useful metrics such as
published listings, pending approvals, unread messages and new inquiries."
Every number in this payload is a live query; spec 26's definition of done
requires visible counters to equal query results, and Phase 12 contract rule 10
forbids denormalising them onto the organization.
"""

from datetime import timedelta

import pytest
from django.contrib.auth.models import Group
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from brokers.enums import BrokerMembershipRole, BrokerOrganizationStatus
from brokers.tests.factories import make_broker, make_membership
from listings.enums import ListingStatus, RevisionStatus
from listings.models import ListingRevision
from listings.tests.factories import make_brand, make_broker_listing
from messaging.enums import UNIFIED_INQUIRIES_FLAG, ConversationType
from messaging.tests.factories import make_conversation, make_message
from platform_settings.services import set_feature_flag

pytestmark = pytest.mark.django_db


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture(autouse=True)
def _messaging_flag_on(db):
    """brokers/tests has no messaging conftest, so this package turns spec 35.1's
    flag on for itself. Production seeds it DISABLED (messaging/0002) and
    test_the_messaging_block_is_blank_when_the_flag_is_off covers that side."""
    set_feature_flag(
        key=UNIFIED_INQUIRIES_FLAG,
        is_enabled=True,
        actor=None,
        description="Enabled by brokers dashboard tests.",
    )
    yield


def listing_for(broker, actor, status, tag):
    """One broker listing with its OWN brand.

    listings.tests.factories.make_broker_listing defaults the brand to
    `make_brand(f"Brand {broker.pk.hex[:8]}")`, so creating a SECOND listing for
    the same brokerage without an explicit brand raises IntegrityError:
    taxonomy.BoatBrand enforces accent/case-insensitive uniqueness on the
    normalized name (Phase 4). Every brand name here is phase19-prefixed so it
    also cannot collide with another package's fixtures.
    """
    return make_broker_listing(
        broker=broker,
        actor=actor,
        brand=make_brand(f"Phase19 {tag}"),
        status=status,
    )


def make_moderator(email):
    """A REAL staff moderator.

    accounts.services.is_staff_moderator (accounts/services.py:122-126) requires
    BOTH primary_role == STAFF AND membership of the staff_moderator or
    staff_admin group. A make_user(role=UserRole.STAFF) with no group is not a
    moderator, so a test that only sets the role proves nothing about the staff
    branch it claims to exercise.

    get_or_create, not get: this package's conftest seeds no Groups, and a
    `@pytest.mark.django_db(transaction=True)` test anywhere in the session ends
    with a flush that truncates rows a data migration inserted. The same
    defensive spelling brokers/tests/test_admin.py:35 already uses.
    """
    moderator = make_user(email=email, role=UserRole.STAFF)
    moderator.groups.add(Group.objects.get_or_create(name=StaffGroup.MODERATOR)[0])
    return moderator


@pytest.fixture
def scene():
    """Two brokerages. Alpha has listings, a backlog and conversations; Beta is
    the cross-tenant control and must never appear in Alpha's numbers."""
    broker_a = make_broker(name="Phase19 Metrics Alpha", slug="phase19-metrics-alpha")
    broker_b = make_broker(name="Phase19 Metrics Beta", slug="phase19-metrics-beta")

    reader = make_user(email="metrics-reader@phase19.example")
    agent = make_user(email="metrics-agent@phase19.example")
    outsider = make_user(email="metrics-outsider@phase19.example")
    asker = make_user(email="metrics-asker@phase19.example", full_name="Ada Rossi")

    make_membership(
        reader, broker_a, role=BrokerMembershipRole.MANAGER, can_read_messages=True
    )
    make_membership(
        agent, broker_a, role=BrokerMembershipRole.AGENT, can_edit_listings=True
    )
    make_membership(
        outsider, broker_b, role=BrokerMembershipRole.ADMIN, can_read_messages=True
    )

    published = listing_for(broker_a, reader, ListingStatus.PUBLISHED, "Alpha Pub")
    listing_for(broker_a, reader, ListingStatus.DRAFT, "Alpha Draft")
    pending = listing_for(
        broker_a, reader, ListingStatus.PENDING_APPROVAL, "Alpha Pending"
    )
    ListingRevision.objects.create(
        listing=pending, revision_number=1, state=RevisionStatus.SUBMITTED, submitted_by=reader, submitted_at=timezone.now()
    )
    # Beta's noise: must not be counted anywhere in Alpha's payload.
    beta_published = listing_for(
        broker_b, outsider, ListingStatus.PUBLISHED, "Beta Pub"
    )
    beta_pending = listing_for(
        broker_b, outsider, ListingStatus.PENDING_APPROVAL, "Beta Pending"
    )
    ListingRevision.objects.create(
        listing=beta_pending, revision_number=1, state=RevisionStatus.SUBMITTED, submitted_by=outsider, submitted_at=timezone.now()
    )

    thread = make_conversation(
        initiator=asker,
        conversation_type=ConversationType.BROKER_INQUIRY,
        broker=broker_a,
        subject="Alpha question",
    )
    make_message(conversation=thread, sender=asker)
    beta_thread = make_conversation(
        initiator=asker,
        conversation_type=ConversationType.BROKER_INQUIRY,
        broker=broker_b,
        subject="Beta question",
    )
    make_message(conversation=beta_thread, sender=asker)

    return {
        "broker_a": broker_a,
        "broker_b": broker_b,
        "reader": reader,
        "agent": agent,
        "outsider": outsider,
        "asker": asker,
        "published": published,
        "thread": thread,
        "beta_published": beta_published,
        "beta_thread": beta_thread,
    }


def url_for(broker):
    return reverse("broker-dashboard", args=[broker.pk])


def test_a_guest_gets_401(api, scene):
    response = api.get(url_for(scene["broker_a"]))
    assert response.status_code == 401


def test_a_member_of_another_broker_gets_403_not_broker_member(api, scene):
    """Cross-tenant: Beta's own admin has no business reading Alpha's numbers."""
    api.force_authenticate(scene["outsider"])
    response = api.get(url_for(scene["broker_a"]))
    assert response.status_code == 403
    assert response.data["error"]["code"] == "not_broker_member"


def test_a_real_staff_moderator_with_no_membership_gets_403(api, scene):
    """Ruling 10, matching Phase 6: no staff read path into a broker's inbox.
    Staff read a brokerage through Phase 12's own staff endpoint — which the
    positive control below proves this very user can reach."""
    moderator = make_moderator("metrics-moderator@phase19.example")
    api.force_authenticate(moderator)
    assert api.get(url_for(scene["broker_a"])).status_code == 403


def test_the_same_moderator_can_reach_the_staff_broker_endpoint(api, scene):
    """Positive control for the test above.

    Phase 12's GET /api/v1/staff/brokers/<id>/ is IsStaffModerator-gated. If this
    fails, the 403 above is telling us the fixture is not really a moderator —
    not that the broker dashboard refuses moderators. That is the vacuous-test
    failure mode this pair exists to close.
    """
    moderator = make_moderator("metrics-moderator-control@phase19.example")
    api.force_authenticate(moderator)
    response = api.get(reverse("staff-broker-detail", args=[scene["broker_a"].pk]))
    assert response.status_code == 200
    assert response.data["slug"] == "phase19-metrics-alpha"


def test_a_member_of_a_suspended_organization_gets_403(api, scene):
    """active_broker_membership() requires broker__status=ACTIVE, so suspending
    an organization removes every capability at once (spec 12 item 5)."""
    scene["broker_a"].status = BrokerOrganizationStatus.SUSPENDED
    scene["broker_a"].save(update_fields=["status", "updated_at"])
    api.force_authenticate(scene["reader"])
    assert api.get(url_for(scene["broker_a"])).status_code == 403


def test_the_payload_carries_exactly_spec_28_s_four_metrics(api, scene):
    api.force_authenticate(scene["reader"])
    response = api.get(url_for(scene["broker_a"]))
    assert response.status_code == 200
    assert set(response.data) == {
        "broker",
        "published_listings",
        "pending_approvals",
        "messages",
    }
    assert response.data["broker"] == {
        "id": str(scene["broker_a"].pk),
        "name": "Phase19 Metrics Alpha",
        "slug": "phase19-metrics-alpha",
        "status": BrokerOrganizationStatus.ACTIVE,
    }
    assert response.data["published_listings"] == 1
    assert response.data["pending_approvals"] == 1


def test_the_messaging_block_counts_only_this_brokers_threads(api, scene):
    api.force_authenticate(scene["reader"])
    messages = api.get(url_for(scene["broker_a"])).data["messages"]
    assert messages == {
        "enabled": True,
        "can_read": True,
        "unread_conversations": 1,
        "unread_messages": 1,
        "new_inquiries_7d": 1,
    }


def test_a_member_without_can_read_messages_sees_no_counts(api, scene):
    """Spec 5/28: can_edit_listings must never leak message visibility."""
    api.force_authenticate(scene["agent"])
    response = api.get(url_for(scene["broker_a"]))
    assert response.status_code == 200
    assert response.data["published_listings"] == 1
    assert response.data["messages"] == {
        "enabled": True,
        "can_read": False,
        "unread_conversations": None,
        "unread_messages": None,
        "new_inquiries_7d": None,
    }


def test_the_messaging_block_is_blank_when_the_flag_is_off(api, scene):
    """Ruling 8: the listing metrics keep working; only the messaging block goes
    dark. Spec 35.2 seeds this flag DISABLED in production, so this is the
    shipping state on day one, not an edge case."""
    set_feature_flag(
        key=UNIFIED_INQUIRIES_FLAG,
        is_enabled=False,
        actor=None,
        description="Disabled by a test.",
    )
    api.force_authenticate(scene["reader"])
    response = api.get(url_for(scene["broker_a"]))
    assert response.status_code == 200
    assert response.data["published_listings"] == 1
    assert response.data["messages"]["enabled"] is False
    assert response.data["messages"]["unread_messages"] is None


def test_a_readers_own_reply_never_counts_as_unread_for_them(api, scene):
    """After the reader replies the thread holds two unread messages, but only
    the one they did not send is theirs to read."""
    make_message(conversation=scene["thread"], sender=scene["reader"])
    api.force_authenticate(scene["reader"])
    messages = api.get(url_for(scene["broker_a"])).data["messages"]
    assert messages["unread_messages"] == 1


def test_an_inquiry_older_than_the_window_is_not_new(api, scene):
    stale = make_conversation(
        # A FRESH initiator, not scene["asker"]. The scene already holds an OPEN
        # BROKER_INQUIRY from `asker` to `broker_a`, and Conversation's
        # `messaging_open_broker_thread_unique` partial index
        # (messaging/models.py:118-126) allows exactly one OPEN thread per
        # (initiator, broker) — reusing the asker here raises IntegrityError
        # before the assertion is ever reached.
        initiator=make_user(email="stale-asker@phase19.example"),
        conversation_type=ConversationType.BROKER_INQUIRY,
        broker=scene["broker_a"],
        subject="An old Alpha question",
    )
    # created_at is auto_now_add, so it has to be pushed back with an UPDATE.
    type(stale).objects.filter(pk=stale.pk).update(
        created_at=timezone.now() - timedelta(days=30)
    )
    api.force_authenticate(scene["reader"])
    messages = api.get(url_for(scene["broker_a"])).data["messages"]
    assert messages["new_inquiries_7d"] == 1


def test_an_unknown_broker_id_is_indistinguishable_from_one_you_are_not_in(api, scene):
    """403, not 404, and deliberately so: IsBrokerMember runs at the view level,
    before any object lookup, so an outsider cannot enumerate which broker ids
    exist by watching the status code change."""
    import uuid

    api.force_authenticate(scene["reader"])
    assert api.get(reverse("broker-dashboard", args=[uuid.uuid4()])).status_code == 403


def test_no_contact_value_appears_in_the_payload(api, scene):
    api.force_authenticate(scene["reader"])
    rendered = api.get(url_for(scene["broker_a"])).content.decode()
    assert scene["broker_a"].public_email not in rendered
    assert scene["broker_a"].public_phone not in rendered
    assert scene["asker"].email not in rendered
