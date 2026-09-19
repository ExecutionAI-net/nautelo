"""PATCH /api/v1/conversations/<id>/status/ — the producer spec 28's "Archived"
filter needs.

Spec 28 lists Archived among the five filters the broker inbox must offer. Phase
6 modelled and constrained ConversationStatus.ARCHIVED but shipped nothing that
writes it, so the filter existed with no way to reach the state.

Filing is RECIPIENT-SIDE ONLY (the plan's ruling 5). Conversation has one status
column (spec 11.8), so an initiator who could archive would be hiding a live lead
from the broker's default inbox — the one screen spec 28 exists to build.
"""

import pytest
from django.contrib.auth.models import Group
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from brokers.enums import BrokerMembershipRole
from brokers.tests.factories import make_broker, make_membership
from messaging.enums import ConversationStatus, ConversationType
from messaging.models import Conversation
from messaging.tests.factories import make_conversation, make_message

pytestmark = pytest.mark.django_db


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def scene():
    asker = make_user(email="status-asker@phase19.example", full_name="Ada Rossi")
    broker_a = make_broker(name="Phase19 Status Alpha", slug="phase19-status-alpha")
    broker_b = make_broker(name="Phase19 Status Beta", slug="phase19-status-beta")
    reader_a = make_user(email="status-reader-a@phase19.example")
    reader_b = make_user(email="status-reader-b@phase19.example")
    agent_a = make_user(email="status-agent-a@phase19.example")
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
    return reverse("conversation-status", args=[conversation.pk])


def test_a_guest_gets_401_authentication_required(api, scene):
    response = api.patch(url_for(scene["thread"]), {"status": "ARCHIVED"}, format="json")
    assert response.status_code == 401
    assert response.data["error"]["code"] == "authentication_required"


def test_the_flag_off_answer_precedes_every_other_permission(
    api, scene, unified_inquiries_disabled
):
    anonymous = api.patch(url_for(scene["thread"]), {"status": "ARCHIVED"}, format="json")
    assert anonymous.status_code == 403
    assert anonymous.data["error"]["code"] == "feature_disabled"

    api.force_authenticate(scene["reader_a"])
    signed_in = api.patch(url_for(scene["thread"]), {"status": "ARCHIVED"}, format="json")
    assert signed_in.status_code == 403
    assert signed_in.data["error"]["code"] == "feature_disabled"


def test_a_broker_reader_archives_and_gets_the_updated_row_back(api, scene):
    """Spec 30.2: mutations return the updated resource."""
    api.force_authenticate(scene["reader_a"])
    response = api.patch(url_for(scene["thread"]), {"status": "ARCHIVED"}, format="json")
    assert response.status_code == 200
    assert response.data["status"] == ConversationStatus.ARCHIVED
    assert response.data["id"] == str(scene["thread"].pk)
    assert response.data["unread_count"] == 1
    assert response.data["counterparty_name"] == "Ada Rossi"
    scene["thread"].refresh_from_db()
    assert scene["thread"].status == ConversationStatus.ARCHIVED


def test_the_initiator_may_not_archive_the_recipients_thread(api, scene):
    """Ruling 5, and the reason it exists.

    Conversation has ONE status column (spec 11.8) and the broker's default
    inbox is status=OPEN, so a sender who could archive would remove their own
    live lead from the brokerage's screen. Spec 2.2 puts that refusal on the
    server, not in the UI.
    """
    api.force_authenticate(scene["asker"])
    response = api.patch(url_for(scene["thread"]), {"status": "ARCHIVED"}, format="json")
    assert response.status_code == 403
    assert response.data["error"]["code"] == "conversation_filing_forbidden"
    scene["thread"].refresh_from_db()
    assert scene["thread"].status == ConversationStatus.OPEN


def test_the_initiator_may_not_unarchive_either(api, scene):
    """The same rule in the other direction: an initiator must not be able to
    pull a thread the brokerage filed back into its open inbox."""
    scene["thread"].status = ConversationStatus.ARCHIVED
    scene["thread"].save(update_fields=["status", "updated_at"])
    api.force_authenticate(scene["asker"])
    response = api.patch(url_for(scene["thread"]), {"status": "OPEN"}, format="json")
    assert response.status_code == 403
    assert response.data["error"]["code"] == "conversation_filing_forbidden"


def test_unarchiving_returns_the_thread_to_open(api, scene):
    scene["thread"].status = ConversationStatus.ARCHIVED
    scene["thread"].save(update_fields=["status", "updated_at"])
    api.force_authenticate(scene["reader_a"])
    response = api.patch(url_for(scene["thread"]), {"status": "OPEN"}, format="json")
    assert response.status_code == 200
    assert response.data["status"] == ConversationStatus.OPEN


def test_setting_the_status_it_already_has_is_a_no_op_200(api, scene):
    api.force_authenticate(scene["reader_a"])
    response = api.patch(url_for(scene["thread"]), {"status": "OPEN"}, format="json")
    assert response.status_code == 200
    assert response.data["status"] == ConversationStatus.OPEN


def test_another_brokers_reader_gets_404_never_403(api, scene):
    """Spec 33.1 IDOR. Note the contrast with the initiator's 403 above: the
    initiator may SEE this thread, so hiding its existence would be theatre —
    they are told why. Someone who may not see it is told nothing."""
    api.force_authenticate(scene["reader_b"])
    response = api.patch(url_for(scene["thread"]), {"status": "ARCHIVED"}, format="json")
    assert response.status_code == 404
    scene["thread"].refresh_from_db()
    assert scene["thread"].status == ConversationStatus.OPEN


def test_an_agent_without_can_read_messages_gets_404(api, scene):
    """can_edit_listings must never leak message access (spec 11.1, 28)."""
    api.force_authenticate(scene["agent_a"])
    assert (
        api.patch(url_for(scene["thread"]), {"status": "ARCHIVED"}, format="json").status_code
        == 404
    )


def test_a_real_staff_moderator_gets_404_too(api, scene):
    """A REAL moderator: is_staff_moderator needs primary_role == STAFF AND the
    staff_moderator group (accounts/services.py:122-126). The positive control
    lives in test_conversation_detail_api.py."""
    moderator = make_user(email="status-moderator@phase19.example", role=UserRole.STAFF)
    moderator.groups.add(Group.objects.get(name=StaffGroup.MODERATOR))
    assert moderator.groups.filter(name=StaffGroup.MODERATOR).exists()
    api.force_authenticate(moderator)
    assert (
        api.patch(url_for(scene["thread"]), {"status": "ARCHIVED"}, format="json").status_code
        == 404
    )


def test_blocked_is_refused_with_its_own_named_code(api, scene):
    """Spec 36.6 makes blocking a moderation act with contact-revocation
    consequences; it is not an inbox toggle."""
    api.force_authenticate(scene["reader_a"])
    response = api.patch(url_for(scene["thread"]), {"status": "BLOCKED"}, format="json")
    assert response.status_code == 400
    assert response.data["error"]["code"] == "invalid_conversation_status"


def test_a_missing_status_field_gets_the_same_named_code(api, scene):
    """Phase 6 contract rule 10: this project's envelope collapses every DRF
    ValidationError to code "validation_error" (common/exceptions.py:107-110),
    so the field is declared required=False/allow_blank and the SERVICE names
    the error."""
    api.force_authenticate(scene["reader_a"])
    response = api.patch(url_for(scene["thread"]), {}, format="json")
    assert response.status_code == 400
    assert response.data["error"]["code"] == "invalid_conversation_status"


def test_an_absurdly_long_status_gets_the_named_code_not_validation_error(api, scene):
    """The regression guard for a max_length that used to be on this field.

    A CharField(max_length=20) turns a 21-character body into a DRF
    ValidationError, which the envelope flattens to "validation_error" — so the
    plan's own claim that every invalid status answers with the named code would
    have been false for exactly the input an attacker sends first.
    """
    api.force_authenticate(scene["reader_a"])
    response = api.patch(
        url_for(scene["thread"]), {"status": "A" * 500}, format="json"
    )
    assert response.status_code == 400
    assert response.data["error"]["code"] == "invalid_conversation_status"


def test_a_blocked_thread_cannot_be_reopened(api, scene):
    scene["thread"].status = ConversationStatus.BLOCKED
    scene["thread"].save(update_fields=["status", "updated_at"])
    api.force_authenticate(scene["reader_a"])
    response = api.patch(url_for(scene["thread"]), {"status": "OPEN"}, format="json")
    assert response.status_code == 409
    assert response.data["error"]["code"] == "conversation_closed"


def test_reopening_a_superseded_thread_is_409_not_500(api, scene):
    """Conversation's three unique indexes are PARTIAL on status=OPEN
    (messaging/models.py:111-133), so a newer OPEN thread about the same context
    makes re-opening an archived one a real conflict. Without the savepoint in
    set_conversation_status this fails with a 500 and a
    TransactionManagementError, not a 409."""
    scene["thread"].status = ConversationStatus.ARCHIVED
    scene["thread"].save(update_fields=["status", "updated_at"])
    make_conversation(
        initiator=scene["asker"],
        conversation_type=ConversationType.BROKER_INQUIRY,
        broker=scene["broker_a"],
        subject="Alpha fleet question, again",
    )

    api.force_authenticate(scene["reader_a"])
    response = api.patch(url_for(scene["thread"]), {"status": "OPEN"}, format="json")
    assert response.status_code == 409
    assert response.data["error"]["code"] == "conversation_superseded"
    scene["thread"].refresh_from_db()
    assert scene["thread"].status == ConversationStatus.ARCHIVED


def test_archiving_makes_the_thread_reachable_only_through_the_archived_filter(
    api, scene
):
    """The whole point of this endpoint: spec 28's Archived filter now has a
    producer, and the default OPEN inbox stops showing the row."""
    api.force_authenticate(scene["reader_a"])
    api.patch(url_for(scene["thread"]), {"status": "ARCHIVED"}, format="json")

    assert api.get(reverse("conversation-list")).data["results"] == []
    archived = api.get(reverse("conversation-list"), {"status": "ARCHIVED"}).data
    assert [row["id"] for row in archived["results"]] == [str(scene["thread"].pk)]


def test_no_contact_value_appears_in_the_status_response(api, scene):
    api.force_authenticate(scene["reader_a"])
    rendered = api.patch(
        url_for(scene["thread"]), {"status": "ARCHIVED"}, format="json"
    ).content.decode()
    assert scene["broker_a"].public_email not in rendered
    assert scene["broker_a"].public_phone not in rendered
    assert scene["asker"].email not in rendered


def test_the_write_is_scoped_to_one_row(api, scene):
    """A sibling thread of the same brokerage must not be touched.

    A DIFFERENT initiator, because Conversation's
    `messaging_open_broker_thread_unique` partial index allows exactly one OPEN
    thread per (initiator, broker).
    """
    sibling = make_conversation(
        initiator=make_user(email="status-asker-2@phase19.example"),
        conversation_type=ConversationType.BROKER_INQUIRY,
        broker=scene["broker_a"],
        subject="Another Alpha question",
    )
    api.force_authenticate(scene["reader_a"])
    api.patch(url_for(scene["thread"]), {"status": "ARCHIVED"}, format="json")
    sibling.refresh_from_db()
    assert sibling.status == ConversationStatus.OPEN
    assert Conversation.objects.filter(status=ConversationStatus.ARCHIVED).count() == 1
