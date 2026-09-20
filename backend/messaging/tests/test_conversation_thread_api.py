"""Spec 30.1's `GET/POST /api/v1/conversations/<id>/messages/` (thread/reply),
plus the mark-read endpoint spec 28 requires ("Mark-read and reply endpoints
enforce broker organization membership")."""

import pytest
from django.core import mail
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.tests.factories import make_user
from brokers.enums import BrokerMembershipRole
from brokers.tests.factories import make_broker, make_membership
from messaging.enums import ConversationStatus, ConversationType
from messaging.models import Message
from messaging.tests.factories import make_conversation, make_message
from notifications.models import Notification
from professionals.tests.factories import make_professional

# `reverse("conversation-list")` is used by the display-name regression test
# below, which checks the inbox payload as well as the thread payload.

pytestmark = pytest.mark.django_db

REPLY = "Thank you for getting in touch, next Tuesday morning works for us."


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def thread():
    asker = make_user(email="thr-asker@phase6.example", full_name="Ada Rossi")
    owner = make_user(email="thr-pro-owner@phase6.example", full_name="Bruno Neri")
    professional = make_professional(
        owner,
        display_name="Phase6 Thread Pro",
        slug="phase6-thread-pro",
        public_email="office@phase6-thread.example",
    )
    conversation = make_conversation(
        initiator=asker,
        conversation_type=ConversationType.PROFESSIONAL_INQUIRY,
        professional=professional,
        subject="Survey question",
    )
    first = make_message(conversation=conversation, sender=asker)
    conversation.last_message_at = first.created_at
    conversation.save(update_fields=["last_message_at", "updated_at"])
    return {
        "asker": asker,
        "owner": owner,
        "professional": professional,
        "conversation": conversation,
        "first": first,
    }


def _messages_url(conversation):
    return reverse("conversation-messages", args=[conversation.pk])


def _read_url(conversation):
    return reverse("conversation-read", args=[conversation.pk])


def test_a_guest_gets_401(api, thread):
    response = api.get(_messages_url(thread["conversation"]))
    assert response.status_code == 401
    assert response.data["error"]["code"] == "authentication_required"


def test_a_stranger_gets_404_not_403(api, thread):
    """Spec 33.1's IDOR rule: a 403 would confirm the conversation id exists."""
    api.force_authenticate(make_user(email="thr-stranger@phase6.example"))
    response = api.get(_messages_url(thread["conversation"]))
    assert response.status_code == 404
    assert response.data["error"]["code"] == "not_found"


def test_the_initiator_reads_the_thread_oldest_first(api, thread):
    second = make_message(
        conversation=thread["conversation"],
        sender=thread["owner"],
        body=REPLY,
        sender_name_snapshot="Bruno Neri",
    )
    api.force_authenticate(thread["asker"])
    response = api.get(_messages_url(thread["conversation"]))

    assert response.status_code == 200
    assert [row["id"] for row in response.data["results"]] == [
        str(thread["first"].pk),
        str(second.pk),
    ]
    assert response.data["results"][0]["sender"] == {
        "display_name": "Ada Rossi",
        "is_you": True,
    }
    assert response.data["results"][1]["sender"]["is_you"] is False


def test_the_thread_payload_contains_no_email_or_phone(api, thread):
    api.force_authenticate(thread["owner"])
    rendered = api.get(_messages_url(thread["conversation"])).content.decode()
    assert thread["asker"].email not in rendered
    assert thread["professional"].public_email not in rendered
    assert thread["professional"].public_phone not in rendered
    assert "sender_email_snapshot" not in rendered
    assert "sender_phone_snapshot" not in rendered


def test_a_broker_member_without_can_read_messages_gets_404(api):
    broker = make_broker(name="Phase6 Thread Brokers", slug="phase6-thread-brokers")
    agent = make_user(email="thr-agent@phase6.example")
    make_membership(
        agent, broker, role=BrokerMembershipRole.AGENT, can_edit_listings=True
    )
    conversation = make_conversation(
        initiator=make_user(email="thr-asker2@phase6.example"),
        conversation_type=ConversationType.BROKER_INQUIRY,
        broker=broker,
    )
    api.force_authenticate(agent)
    assert api.get(_messages_url(conversation)).status_code == 404


def test_the_recipient_replies_and_the_initiator_is_notified(
    api, thread, django_capture_on_commit_callbacks
):
    api.force_authenticate(thread["owner"])
    mail.outbox.clear()
    with django_capture_on_commit_callbacks(execute=True):
        response = api.post(
            _messages_url(thread["conversation"]), {"message": REPLY}, format="json"
        )

    assert response.status_code == 201
    assert Message.objects.count() == 2
    reply = Message.objects.latest("created_at")
    assert reply.sender_id == thread["owner"].pk
    assert reply.sender_name_snapshot == "Bruno Neri"
    # A reply carries no consent version - consent belongs to the inquiry.
    assert reply.privacy_policy_version == ""

    notification = Notification.objects.get()
    assert notification.recipient_id == thread["asker"].pk
    assert [sent.to for sent in mail.outbox] == [[thread["asker"].email]]

    thread["conversation"].refresh_from_db()
    assert thread["conversation"].last_message_at == reply.created_at


def test_the_initiator_replies_and_the_recipient_side_is_notified(
    api, thread, django_capture_on_commit_callbacks
):
    api.force_authenticate(thread["asker"])
    mail.outbox.clear()
    with django_capture_on_commit_callbacks(execute=True):
        api.post(_messages_url(thread["conversation"]), {"message": REPLY}, format="json")

    assert Notification.objects.get().recipient_id == thread["owner"].pk
    assert [sent.to for sent in mail.outbox] == [["office@phase6-thread.example"]]


def test_a_duplicate_reply_inside_the_window_is_rate_limited(api, thread):
    api.force_authenticate(thread["owner"])
    first = api.post(
        _messages_url(thread["conversation"]), {"message": REPLY}, format="json"
    )
    assert first.status_code == 201

    second = api.post(
        _messages_url(thread["conversation"]), {"message": REPLY}, format="json"
    )
    assert second.status_code == 429
    assert second.data["error"]["code"] == "rate_limited"
    assert Message.objects.count() == 2


def test_replying_to_an_archived_thread_is_refused(api, thread):
    thread["conversation"].status = ConversationStatus.ARCHIVED
    thread["conversation"].save(update_fields=["status", "updated_at"])
    api.force_authenticate(thread["owner"])
    response = api.post(
        _messages_url(thread["conversation"]), {"message": REPLY}, format="json"
    )
    assert response.status_code == 409
    assert response.data["error"]["code"] == "conversation_closed"


def test_replying_to_a_blocked_thread_is_refused(api, thread):
    """Spec 36.6: "Recipient blocking a user prevents new messages"."""
    thread["conversation"].status = ConversationStatus.BLOCKED
    thread["conversation"].save(update_fields=["status", "updated_at"])
    api.force_authenticate(thread["asker"])
    response = api.post(
        _messages_url(thread["conversation"]), {"message": REPLY}, format="json"
    )
    assert response.status_code == 409
    assert response.data["error"]["code"] == "conversation_closed"


def test_a_blank_named_replier_never_leaks_their_email_address(api, thread):
    """Regression guard.

    `User.get_full_name()` is `self.full_name or self.email` and
    `accounts.services.register_user` defaults `full_name=""`, so ANY use of it
    to derive a display name puts an email address in front of the other party.
    services._reply_display_name reads `actor.full_name` only and stores "".
    """
    nameless = make_user(email="thr-nameless@phase6.example", full_name="")
    # Give them a seat at this thread: they own the professional profile.
    thread["professional"].owner_user = nameless
    thread["professional"].save(update_fields=["owner_user", "updated_at"])

    api.force_authenticate(nameless)
    response = api.post(
        _messages_url(thread["conversation"]), {"message": REPLY}, format="json"
    )

    assert response.status_code == 201
    reply = Message.objects.latest("created_at")
    assert reply.sender_name_snapshot == ""
    assert nameless.email not in reply.sender_name_snapshot

    api.force_authenticate(thread["asker"])
    thread_body = api.get(_messages_url(thread["conversation"])).content.decode()
    inbox_body = api.get(reverse("conversation-list")).content.decode()
    assert nameless.email not in thread_body
    assert nameless.email not in inbox_body


@pytest.mark.parametrize(
    ("name_length", "expected_length"),
    [(120, 120), (150, 120)],
)
def test_an_over_long_account_name_is_truncated_not_a_database_error(
    api, thread, name_length, expected_length
):
    """accounts.User.full_name is max_length=150; Message.sender_name_snapshot is
    120, spec 15.1's number for this field. Without the truncation in
    services._reply_display_name the 150 case raises DataError inside
    post_reply's transaction and the reply silently never exists."""
    long_name = "N" * name_length
    replier = make_user(email=f"thr-long{name_length}@phase6.example", full_name=long_name)
    thread["professional"].owner_user = replier
    thread["professional"].save(update_fields=["owner_user", "updated_at"])

    api.force_authenticate(replier)
    response = api.post(
        _messages_url(thread["conversation"]), {"message": REPLY}, format="json"
    )

    assert response.status_code == 201
    reply = Message.objects.latest("created_at")
    assert len(reply.sender_name_snapshot) == expected_length
    assert reply.sender_name_snapshot == long_name[:expected_length]


def test_a_one_character_or_emoji_reply_is_accepted(api, thread):
    api.force_authenticate(thread["owner"])
    for body in ("k", "👍"):
        response = api.post(_messages_url(thread["conversation"]), {"message": body}, format="json")
        assert response.status_code == 201, response.data


def test_an_empty_reply_is_a_field_error(api, thread):
    api.force_authenticate(thread["owner"])
    response = api.post(
        _messages_url(thread["conversation"]), {"message": "   "}, format="json"
    )
    assert response.status_code == 400
    assert response.data["error"]["code"] == "validation_error"
    assert "message" in response.data["error"]["fields"]


def test_mark_read_only_touches_the_other_sides_messages(api, thread):
    own_reply = make_message(
        conversation=thread["conversation"], sender=thread["owner"], body=REPLY
    )
    api.force_authenticate(thread["owner"])

    response = api.post(_read_url(thread["conversation"]), {}, format="json")

    assert response.status_code == 200
    assert response.data == {"marked_read": 1}
    thread["first"].refresh_from_db()
    own_reply.refresh_from_db()
    assert thread["first"].read_at is not None
    assert own_reply.read_at is None


def test_mark_read_is_idempotent(api, thread):
    api.force_authenticate(thread["owner"])
    api.post(_read_url(thread["conversation"]), {}, format="json")
    second = api.post(_read_url(thread["conversation"]), {}, format="json")
    assert second.data == {"marked_read": 0}


def test_a_stranger_cannot_mark_a_thread_read(api, thread):
    api.force_authenticate(make_user(email="thr-stranger2@phase6.example"))
    assert api.post(_read_url(thread["conversation"]), {}, format="json").status_code == 404


def test_the_flag_gates_the_thread_endpoints(api, thread, unified_inquiries_disabled):
    # Anonymous first: the answer must be feature_disabled, not the
    # authentication_required DRF produces when an authentication gate is
    # consulted before the flag gate. ONE request, asserted twice - a second
    # GET here would add nothing - permissions run before throttles, so a flag-off 403 spends no token.
    anonymous = api.get(_messages_url(thread["conversation"]))
    assert anonymous.status_code == 403
    assert anonymous.data["error"]["code"] == "feature_disabled"

    api.force_authenticate(thread["asker"])
    assert api.get(_messages_url(thread["conversation"])).status_code == 403
    assert (
        api.post(
            _messages_url(thread["conversation"]), {"message": REPLY}, format="json"
        ).status_code
        == 403
    )
    assert api.post(_read_url(thread["conversation"]), {}, format="json").status_code == 403
