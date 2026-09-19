"""Spec 30.1's "authorized inbox", and spec 28's filter and row requirements
(the backend source Phase 19's broker Messages screen reads)."""

import pytest
from django.contrib.auth.models import Group
from django.db import connection
from django.test.utils import CaptureQueriesContext
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
    """One professional thread and one broker thread, one asker, one reader."""
    asker = make_user(email="inbox-asker@phase6.example")
    pro_owner = make_user(email="inbox-pro-owner@phase6.example")
    professional = make_professional(
        pro_owner, display_name="Phase6 Inbox Pro", slug="phase6-inbox-pro"
    )
    broker = make_broker(name="Phase6 Inbox Brokers", slug="phase6-inbox-brokers")
    reader = make_user(email="inbox-reader@phase6.example")
    agent = make_user(email="inbox-agent@phase6.example")
    make_membership(
        reader, broker, role=BrokerMembershipRole.MANAGER, can_read_messages=True
    )
    make_membership(
        agent, broker, role=BrokerMembershipRole.AGENT, can_edit_listings=True
    )

    pro_thread = make_conversation(
        initiator=asker,
        conversation_type=ConversationType.PROFESSIONAL_INQUIRY,
        professional=professional,
        subject="Survey question",
    )
    broker_thread = make_conversation(
        initiator=asker,
        conversation_type=ConversationType.BROKER_INQUIRY,
        broker=broker,
        subject="Fleet question",
    )
    for thread in (pro_thread, broker_thread):
        message = make_message(conversation=thread, sender=asker)
        thread.last_message_at = message.created_at
        thread.save(update_fields=["last_message_at", "updated_at"])
    return {
        "asker": asker,
        "pro_owner": pro_owner,
        "professional": professional,
        "broker": broker,
        "reader": reader,
        "agent": agent,
        "pro_thread": pro_thread,
        "broker_thread": broker_thread,
    }


def test_a_guest_gets_401_authentication_required(api):
    response = api.get(reverse("conversation-list"))
    assert response.status_code == 401
    assert response.data["error"]["code"] == "authentication_required"


def test_the_flag_off_answer_is_403_for_both_anonymous_and_authenticated(
    api, scene, unified_inquiries_disabled
):
    anonymous = api.get(reverse("conversation-list"))
    assert anonymous.status_code == 403
    assert anonymous.data["error"]["code"] == "feature_disabled"

    api.force_authenticate(scene["asker"])
    signed_in = api.get(reverse("conversation-list"))
    assert signed_in.status_code == 403
    assert signed_in.data["error"]["code"] == "feature_disabled"


def test_the_initiator_sees_both_of_their_threads(api, scene):
    api.force_authenticate(scene["asker"])
    response = api.get(reverse("conversation-list"))
    assert response.status_code == 200
    assert {row["id"] for row in response.data["results"]} == {
        str(scene["pro_thread"].pk),
        str(scene["broker_thread"].pk),
    }


def test_the_professional_owner_sees_only_their_own_thread(api, scene):
    api.force_authenticate(scene["pro_owner"])
    response = api.get(reverse("conversation-list"))
    assert [row["id"] for row in response.data["results"]] == [
        str(scene["pro_thread"].pk)
    ]


def test_a_broker_member_with_can_read_messages_sees_the_broker_thread(api, scene):
    api.force_authenticate(scene["reader"])
    response = api.get(reverse("conversation-list"))
    assert [row["id"] for row in response.data["results"]] == [
        str(scene["broker_thread"].pk)
    ]


def test_an_agent_without_can_read_messages_sees_nothing(api, scene):
    """Phase 3 contract rule 4's exact warning: can_edit_listings must not leak
    message access."""
    api.force_authenticate(scene["agent"])
    response = api.get(reverse("conversation-list"))
    assert response.data["results"] == []


def test_an_unrelated_user_sees_nothing(api, scene):
    stranger = make_user(email="inbox-stranger@phase6.example")
    api.force_authenticate(stranger)
    response = api.get(reverse("conversation-list"))
    assert response.data["results"] == []


def test_a_staff_moderator_sees_nothing_either(api, scene):
    """See this task's ruling: Phase 6 ships no staff messaging surface."""
    moderator = make_user(email="inbox-moderator@phase6.example", role=UserRole.STAFF)
    # get_or_create, not get: the same defensive spelling brokers/tests/test_admin.py:35
    # uses. messaging/tests/conftest.py's autouse fixture already guarantees the
    # row, and this keeps the test true even if that fixture is ever narrowed.
    moderator.groups.add(Group.objects.get_or_create(name=StaffGroup.MODERATOR)[0])
    api.force_authenticate(moderator)
    response = api.get(reverse("conversation-list"))
    assert response.data["results"] == []


def test_a_row_carries_every_field_spec_28_names(api, scene):
    api.force_authenticate(scene["pro_owner"])
    row = api.get(reverse("conversation-list")).data["results"][0]
    assert row["conversation_type"] == ConversationType.PROFESSIONAL_INQUIRY
    assert row["subject"] == "Survey question"
    assert row["status"] == ConversationStatus.OPEN
    assert row["last_message_at"] is not None
    assert row["last_message_excerpt"] == (
        "I would like to arrange a viewing next week please."
    )
    assert row["counterparty_name"] == "Ada Rossi"
    assert row["unread_count"] == 1
    assert row["context"] == {
        "type": "PROFESSIONAL",
        "id": str(scene["professional"].pk),
        "label": "Phase6 Inbox Pro",
        "url": "/services/professionals/phase6-inbox-pro/",
    }


def test_the_initiators_own_messages_never_count_as_unread(api, scene):
    api.force_authenticate(scene["asker"])
    rows = api.get(reverse("conversation-list")).data["results"]
    assert {row["unread_count"] for row in rows} == {0}


def test_the_counterparty_name_is_the_context_label_for_the_initiator(api, scene):
    api.force_authenticate(scene["asker"])
    rows = {row["id"]: row for row in api.get(reverse("conversation-list")).data["results"]}
    assert rows[str(scene["pro_thread"].pk)]["counterparty_name"] == "Phase6 Inbox Pro"
    assert (
        rows[str(scene["broker_thread"].pk)]["counterparty_name"]
        == "Phase6 Inbox Brokers"
    )


def test_archived_threads_are_excluded_by_default_and_reachable_by_filter(api, scene):
    """Spec 28's "All" and "Archived" filters."""
    scene["pro_thread"].status = ConversationStatus.ARCHIVED
    scene["pro_thread"].save(update_fields=["status", "updated_at"])
    api.force_authenticate(scene["asker"])

    default_rows = api.get(reverse("conversation-list")).data["results"]
    assert [row["id"] for row in default_rows] == [str(scene["broker_thread"].pk)]

    archived_rows = api.get(
        reverse("conversation-list"), {"status": "ARCHIVED"}
    ).data["results"]
    assert [row["id"] for row in archived_rows] == [str(scene["pro_thread"].pk)]


def test_the_unread_filter_returns_only_threads_with_unread_messages(api, scene):
    """Spec 28's "Unread" filter."""
    api.force_authenticate(scene["pro_owner"])
    assert len(api.get(reverse("conversation-list"), {"unread": "true"}).data["results"]) == 1

    api.force_authenticate(scene["asker"])
    assert api.get(reverse("conversation-list"), {"unread": "true"}).data["results"] == []


def test_the_type_filter_accepts_repeated_values(api, scene):
    """Spec 28's "Listing inquiries" and "Profile inquiries" filters - the
    second is two conversation types, so the parameter repeats."""
    api.force_authenticate(scene["asker"])
    response = api.get(
        reverse("conversation-list"),
        {"type": ["BROKER_INQUIRY", "PROFESSIONAL_INQUIRY"]},
    )
    assert len(response.data["results"]) == 2

    response = api.get(reverse("conversation-list"), {"type": "BROKER_INQUIRY"})
    assert [row["id"] for row in response.data["results"]] == [
        str(scene["broker_thread"].pk)
    ]


def test_an_unknown_type_filter_value_returns_an_empty_inbox(api, scene):
    api.force_authenticate(scene["asker"])
    response = api.get(reverse("conversation-list"), {"type": "NONSENSE"})
    assert response.status_code == 200
    assert response.data["results"] == []


def test_the_broker_filter_scopes_the_inbox(api, scene):
    """Phase 19's broker Messages screen needs one organization's threads."""
    api.force_authenticate(scene["reader"])
    response = api.get(
        reverse("conversation-list"), {"broker": str(scene["broker"].pk)}
    )
    assert [row["id"] for row in response.data["results"]] == [
        str(scene["broker_thread"].pk)
    ]


def test_the_list_is_paginated_and_newest_first(api, scene):
    api.force_authenticate(scene["asker"])
    response = api.get(reverse("conversation-list"))
    assert set(response.data) == {"count", "next", "previous", "results"}
    stamps = [row["last_message_at"] for row in response.data["results"]]
    assert stamps == sorted(stamps, reverse=True)


def test_the_inbox_query_count_is_constant_in_the_number_of_rows(api, scene):
    """Spec 33.3: "Avoid N+1 queries in cards/directories; verify with
    query-count tests."

    An absolute budget that scales with the row count (`max_num_queries(k + 2 *
    rows)`) cannot fail on an N+1 - it BUDGETS for one. This compares two real
    inboxes instead: 2 rows and 7 rows must cost the SAME number of queries.
    `conversations_visible_to` select_relateds the three context objects, and
    `annotate_last_message`/`annotate_unread` fold the first sender, the last
    body and the unread tally into the list query as correlated subqueries, so
    the total is fixed. If this fails, the fix is an annotation or a
    select_related in the selector, never a per-row query in the serializer.
    """
    api.force_authenticate(scene["asker"])
    # Warm-up request, deliberately discarded. messaging/tests/conftest.py starts
    # each test with the feature-flag cache key deleted, and
    # platform_settings.services.is_feature_enabled caches a persisted value with
    # timeout=None - so the FIRST request of any test pays one extra FeatureFlag
    # SELECT that no later request pays. Without this line the comparison below
    # is off by exactly that one query and fails for a reason that has nothing to
    # do with N+1.
    api.get(reverse("conversation-list"))

    with CaptureQueriesContext(connection) as small:
        first = api.get(reverse("conversation-list"))
    assert len(first.data["results"]) == 2

    for index in range(5):
        broker = make_broker(
            name=f"Phase6 Bulk {index}", slug=f"phase6-bulk-{index}"
        )
        conversation = make_conversation(
            initiator=scene["asker"],
            conversation_type=ConversationType.BROKER_INQUIRY,
            broker=broker,
        )
        make_message(conversation=conversation, sender=scene["asker"])

    with CaptureQueriesContext(connection) as large:
        second = api.get(reverse("conversation-list"))

    assert len(second.data["results"]) == 7
    assert len(large) == len(small), [entry["sql"] for entry in large]


def test_no_contact_value_appears_in_any_row(api, scene):
    """Phase 5 contract rule 1 and spec 16: contact data is Phase 7's, and only
    after a grant."""
    api.force_authenticate(scene["asker"])
    rendered = api.get(reverse("conversation-list")).content.decode()
    assert scene["professional"].public_email not in rendered
    assert scene["professional"].public_phone not in rendered
    assert scene["broker"].public_email not in rendered
    assert scene["broker"].public_phone not in rendered
