"""GET /api/v1/conversations/<id>/ — the endpoint the thread screen reads.

Phase 6 shipped the inbox and the thread but no conversation detail, so a
client wanting one thread's subject, status and context had to scan the inbox.
ConversationPagination.page_size is 20, which makes that approach silently wrong
for anyone with 21 conversations — see the plan's ruling 14. This module is the
endpoint's contract, including the cross-broker negative cases spec 33.1
requires of every conversation-addressed route.
"""

import uuid

import pytest
from django.contrib.auth.models import Group
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from brokers.enums import BrokerMembershipRole
from brokers.tests.factories import make_broker, make_membership
from messaging.enums import ConversationStatus, ConversationType
from messaging.tests.factories import make_conversation, make_message
from professionals.tests.factories import make_professional

pytestmark = pytest.mark.django_db


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def scene():
    """Two unrelated brokerages, one asker, one reader in each.

    Every slug, name and address is phase19-prefixed: make_broker defaults to
    "blue-marine-brokers", make_professional to "marine-survey-co" and make_user
    to "user@example.com", all of which other packages' tests already take.
    """
    asker = make_user(email="detail-asker@phase19.example", full_name="Ada Rossi")
    broker_a = make_broker(name="Phase19 Detail Alpha", slug="phase19-detail-alpha")
    broker_b = make_broker(name="Phase19 Detail Beta", slug="phase19-detail-beta")
    reader_a = make_user(email="detail-reader-a@phase19.example")
    reader_b = make_user(email="detail-reader-b@phase19.example")
    agent_a = make_user(email="detail-agent-a@phase19.example")
    make_membership(
        reader_a, broker_a, role=BrokerMembershipRole.MANAGER, can_read_messages=True
    )
    make_membership(
        reader_b, broker_b, role=BrokerMembershipRole.MANAGER, can_read_messages=True
    )
    make_membership(
        agent_a, broker_a, role=BrokerMembershipRole.AGENT, can_edit_listings=True
    )

    thread = make_conversation(
        initiator=asker,
        conversation_type=ConversationType.BROKER_INQUIRY,
        broker=broker_a,
        subject="Alpha fleet question",
    )
    message = make_message(conversation=thread, sender=asker)
    thread.last_message_at = message.created_at
    thread.save(update_fields=["last_message_at", "updated_at"])
    return {
        "asker": asker,
        "broker_a": broker_a,
        "broker_b": broker_b,
        "reader_a": reader_a,
        "reader_b": reader_b,
        "agent_a": agent_a,
        "thread": thread,
    }


def url_for(conversation):
    return reverse("conversation-detail", args=[conversation.pk])


def make_moderator(email):
    """A REAL staff moderator.

    accounts.services.is_staff_moderator (accounts/services.py:122-126) requires
    BOTH primary_role == STAFF AND membership of the staff_moderator or
    staff_admin group. A make_user(role=UserRole.STAFF) with no group is not a
    moderator at all, so a test that only sets the role proves nothing about the
    staff branch it claims to exercise. The Group rows are re-seeded for every
    test by messaging/tests/conftest.py's `_messaging_reference_rows` fixture.
    """
    moderator = make_user(email=email, role=UserRole.STAFF)
    moderator.groups.add(Group.objects.get(name=StaffGroup.MODERATOR))
    return moderator


def test_a_guest_gets_401_authentication_required(api, scene):
    response = api.get(url_for(scene["thread"]))
    assert response.status_code == 401
    assert response.data["error"]["code"] == "authentication_required"


def test_the_flag_off_answer_precedes_every_other_permission(
    api, scene, unified_inquiries_disabled
):
    """Phase 6 contract rule 11a: UnifiedInquiriesEnabled is FIRST, so the flag
    speaks for an anonymous caller too."""
    anonymous = api.get(url_for(scene["thread"]))
    assert anonymous.status_code == 403
    assert anonymous.data["error"]["code"] == "feature_disabled"

    api.force_authenticate(scene["reader_a"])
    signed_in = api.get(url_for(scene["thread"]))
    assert signed_in.status_code == 403
    assert signed_in.data["error"]["code"] == "feature_disabled"


def test_a_broker_reader_gets_the_same_row_the_inbox_returns(api, scene):
    """The point of reading through the inbox's own queryset: the thread screen
    and the list can never disagree about a conversation."""
    api.force_authenticate(scene["reader_a"])
    detail = api.get(url_for(scene["thread"]))
    assert detail.status_code == 200
    row = api.get(reverse("conversation-list")).data["results"][0]
    assert detail.data == row


def test_the_row_carries_every_field_the_thread_screen_reads(api, scene):
    api.force_authenticate(scene["reader_a"])
    data = api.get(url_for(scene["thread"])).data
    assert data["id"] == str(scene["thread"].pk)
    assert data["subject"] == "Alpha fleet question"
    assert data["status"] == ConversationStatus.OPEN
    assert data["conversation_type"] == ConversationType.BROKER_INQUIRY
    assert data["unread_count"] == 1
    assert data["counterparty_name"] == "Ada Rossi"
    assert data["viewer_is_initiator"] is False
    assert data["context"] == {
        "type": "BROKER",
        "id": str(scene["broker_a"].pk),
        "label": "Phase19 Detail Alpha",
        "url": "/brokers/phase19-detail-alpha/",
    }


def test_the_initiator_is_told_they_are_the_initiator(api, scene):
    """Spec 2.1: the archive control's visibility needs a backend source, not a
    client-side guess about who started the thread (ruling 5)."""
    api.force_authenticate(scene["asker"])
    assert api.get(url_for(scene["thread"])).data["viewer_is_initiator"] is True


def test_a_professional_context_carries_its_canonical_url(api, scene):
    owner = make_user(email="detail-pro-owner@phase19.example")
    professional = make_professional(
        owner, display_name="Phase19 Detail Survey", slug="phase19-detail-survey"
    )
    thread = make_conversation(
        initiator=scene["asker"],
        conversation_type=ConversationType.PROFESSIONAL_INQUIRY,
        professional=professional,
        subject="Survey question",
    )
    make_message(conversation=thread, sender=scene["asker"])

    api.force_authenticate(owner)
    assert api.get(url_for(thread)).data["context"]["url"] == (
        "/services/professionals/phase19-detail-survey/"
    )


def test_a_listing_context_has_a_null_url(api, scene):
    """Ruled, not forgotten: BoatListing has no slug column and spec 4.1's
    canonical boat URL is slug-addressed. Phase 20 fills this in."""
    from listings.tests.factories import make_broker_listing

    listing = make_broker_listing(broker=scene["broker_a"], actor=scene["reader_a"])
    thread = make_conversation(
        initiator=scene["asker"],
        conversation_type=ConversationType.LISTING_INQUIRY,
        listing=listing,
        broker=scene["broker_a"],
        subject="Listing question",
    )
    make_message(conversation=thread, sender=scene["asker"])

    api.force_authenticate(scene["asker"])
    assert api.get(url_for(thread)).data["context"]["url"] is None


def test_another_brokers_reader_gets_404_never_403(api, scene):
    """Spec 33.1 IDOR: a 403 would confirm this conversation id exists."""
    api.force_authenticate(scene["reader_b"])
    assert api.get(url_for(scene["thread"])).status_code == 404


def test_an_agent_without_can_read_messages_gets_404(api, scene):
    api.force_authenticate(scene["agent_a"])
    assert api.get(url_for(scene["thread"])).status_code == 404


def test_a_real_staff_moderator_gets_404_too(api, scene):
    """Ruling 10 / Phase 6's Task 9 ruling: no staff messaging read path.

    The moderator below is a REAL one — see make_moderator — and the positive
    control underneath proves it, so this 404 is evidence about messaging
    authorization rather than an accident of an under-built fixture.
    """
    moderator = make_moderator("detail-moderator@phase19.example")
    api.force_authenticate(moderator)
    assert api.get(url_for(scene["thread"])).status_code == 404


def test_the_same_moderator_can_reach_a_staff_only_endpoint(api, scene):
    """Positive control for the test above.

    Phase 12's GET /api/v1/staff/brokers/<id>/ is IsStaffModerator-gated. If this
    ever fails, the 404 above is telling us the fixture is not really a
    moderator, not that messaging refuses moderators — which is exactly the
    vacuous test this pair exists to prevent.
    """
    moderator = make_moderator("detail-moderator-control@phase19.example")
    api.force_authenticate(moderator)
    response = api.get(reverse("staff-broker-detail", args=[scene["broker_a"].pk]))
    assert response.status_code == 200
    assert response.data["slug"] == "phase19-detail-alpha"


def test_an_unknown_id_is_404_and_indistinguishable_from_a_forbidden_one(api, scene):
    api.force_authenticate(scene["reader_a"])
    assert api.get(reverse("conversation-detail", args=[uuid.uuid4()])).status_code == 404


def test_no_contact_value_appears_in_the_detail_payload(api, scene):
    """Phase 6 contract rule 3: a conversation row carries no contact value of
    any kind. Contact reveal is Phase 7's own endpoint, after a grant."""
    api.force_authenticate(scene["reader_a"])
    rendered = api.get(url_for(scene["thread"])).content.decode()
    assert scene["broker_a"].public_email not in rendered
    assert scene["broker_a"].public_phone not in rendered
    assert scene["asker"].email not in rendered
