"""Spec 28's definition of done and spec 40 Scenario L, proved end to end.

Scenario L: "Given a broker user, When dashboard navigation loads, Then Messages
is present with real conversation counts and Services & Surveyors is absent; its
old URL redirects once to Messages."

The navigation and redirect halves are frontend facts and are proved by
frontend/src/components/broker/BrokerDashboardNav.test.tsx and
frontend/next.config.test.ts. THIS module proves the half a browser test cannot:
that the counts are real, that they are one organization's, and that no second
message store exists.
"""

from datetime import timedelta

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.tests.factories import make_user
from brokers.enums import BrokerMembershipRole
from brokers.tests.factories import make_broker, make_membership
from listings.enums import ListingStatus, RevisionStatus
from listings.models import ListingRevision
from listings.tests.factories import make_brand, make_broker_listing
from messaging.enums import UNIFIED_INQUIRIES_FLAG, ConversationStatus, ConversationType
from messaging.models import Conversation, Message
from messaging.tests.factories import make_conversation, make_message
from platform_settings.services import set_feature_flag

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _messaging_flag_on(db):
    set_feature_flag(
        key=UNIFIED_INQUIRIES_FLAG,
        is_enabled=True,
        actor=None,
        description="Enabled by Phase 19 acceptance tests.",
    )
    yield


@pytest.fixture
def api():
    return APIClient()


def listing_for(broker, actor, status, tag):
    """One broker listing with its OWN brand — see the note in
    test_broker_dashboard_api.py: taxonomy.BoatBrand enforces normalized-name
    uniqueness, and make_broker_listing derives its default brand name from the
    broker's pk, so two default-brand listings for one brokerage collide."""
    return make_broker_listing(
        broker=broker,
        actor=actor,
        brand=make_brand(f"Phase19 {tag}"),
        status=status,
    )


def thread_from(email, broker, subject, *, bodies=("Hello, I am interested in this.",)):
    """One OPEN broker thread, from a NEW initiator every time.

    Conversation's `messaging_open_broker_thread_unique` partial index allows one
    OPEN thread per (initiator, broker), so two threads for the same brokerage
    need two different initiators. This helper makes that impossible to forget.
    """
    conversation = make_conversation(
        initiator=make_user(email=email),
        conversation_type=ConversationType.BROKER_INQUIRY,
        broker=broker,
        subject=subject,
    )
    for body in bodies:
        make_message(conversation=conversation, sender=conversation.initiator, body=body)
    return conversation


@pytest.fixture
def two_brokerages():
    alpha = make_broker(name="Phase19 Accept Alpha", slug="phase19-accept-alpha")
    beta = make_broker(name="Phase19 Accept Beta", slug="phase19-accept-beta")
    alpha_reader = make_user(email="accept-alpha@phase19.example")
    beta_reader = make_user(email="accept-beta@phase19.example")
    asker = make_user(email="accept-asker@phase19.example", full_name="Ada Rossi")
    make_membership(
        alpha_reader, alpha, role=BrokerMembershipRole.ADMIN, can_read_messages=True
    )
    make_membership(
        beta_reader, beta, role=BrokerMembershipRole.ADMIN, can_read_messages=True
    )
    return {
        "alpha": alpha,
        "beta": beta,
        "alpha_reader": alpha_reader,
        "beta_reader": beta_reader,
        "asker": asker,
    }


def test_scenario_l_the_counts_a_broker_home_shows_are_real_query_results(
    api, two_brokerages
):
    """Spec 40 Scenario L: "Messages is present with REAL conversation counts."

    Every number is asserted against the rows that produced it, not against a
    fixture constant — spec 26's definition of done: "All visible counters equal
    query results."
    """
    alpha = two_brokerages["alpha"]
    reader = two_brokerages["alpha_reader"]

    for index in range(3):
        listing_for(alpha, reader, ListingStatus.PUBLISHED, f"Pub {index}")
    pending = listing_for(alpha, reader, ListingStatus.PENDING_APPROVAL, "Pending")
    ListingRevision.objects.create(
        listing=pending, revision_number=1,
        state=RevisionStatus.SUBMITTED,
        submitted_by=reader,
        submitted_at=timezone.now(),
    )
    for index in range(2):
        thread_from(
            f"scenario-l-{index}@phase19.example",
            alpha,
            f"Alpha question {index}",
            bodies=(
                "Hello, I am interested in this.",
                "A follow-up question, thank you.",
            ),
        )

    api.force_authenticate(reader)
    payload = api.get(reverse("broker-dashboard", args=[alpha.pk])).data

    assert payload["published_listings"] == 3
    assert payload["pending_approvals"] == 1
    assert payload["messages"]["unread_conversations"] == 2
    assert payload["messages"]["unread_messages"] == 4
    assert payload["messages"]["new_inquiries_7d"] == 2

    # And the same numbers, recomputed independently from the rows.
    assert payload["published_listings"] == alpha.listings.filter(
        status=ListingStatus.PUBLISHED
    ).count()
    assert payload["messages"]["unread_messages"] == Message.objects.filter(
        conversation__broker=alpha, read_at__isnull=True
    ).exclude(sender=reader).count()


def test_scenario_l_reading_a_thread_moves_the_dashboard_count(api, two_brokerages):
    """A count that does not move is a decoration. This walks the whole loop:
    inbox -> thread -> mark read -> dashboard."""
    alpha = two_brokerages["alpha"]
    reader = two_brokerages["alpha_reader"]
    thread = thread_from("loop-asker@phase19.example", alpha, "Alpha question")

    api.force_authenticate(reader)
    assert (
        api.get(reverse("broker-dashboard", args=[alpha.pk])).data["messages"][
            "unread_messages"
        ]
        == 1
    )

    rows = api.get(reverse("conversation-list"), {"broker": str(alpha.pk)}).data[
        "results"
    ]
    assert [row["id"] for row in rows] == [str(thread.pk)]

    # The thread screen's own two reads, in the order it makes them.
    detail = api.get(reverse("conversation-detail", args=[thread.pk]))
    assert detail.status_code == 200
    assert detail.data == rows[0]
    api.get(reverse("conversation-messages", args=[thread.pk]))
    api.post(reverse("conversation-read", args=[thread.pk]))

    assert (
        api.get(reverse("broker-dashboard", args=[alpha.pk])).data["messages"][
            "unread_messages"
        ]
        == 0
    )


def test_a_broker_never_sees_another_brokers_conversations_from_any_surface(
    api, two_brokerages
):
    """Spec 33.1, swept across every route this phase touches or reuses."""
    alpha = two_brokerages["alpha"]
    beta_reader = two_brokerages["beta_reader"]
    thread = thread_from("idor-asker@phase19.example", alpha, "Alpha question")

    api.force_authenticate(beta_reader)

    # List, unfiltered and filtered by the other organization's id.
    assert api.get(reverse("conversation-list")).data["results"] == []
    assert (
        api.get(reverse("conversation-list"), {"broker": str(alpha.pk)}).data["results"]
        == []
    )
    # Detail, thread read, reply, mark-read, archive: 404 every time, never 403.
    assert api.get(reverse("conversation-detail", args=[thread.pk])).status_code == 404
    assert api.get(reverse("conversation-messages", args=[thread.pk])).status_code == 404
    assert (
        api.post(
            reverse("conversation-messages", args=[thread.pk]),
            {"message": "Let me read somebody else's mail, thank you."},
            format="json",
        ).status_code
        == 404
    )
    assert api.post(reverse("conversation-read", args=[thread.pk])).status_code == 404
    assert (
        api.patch(
            reverse("conversation-status", args=[thread.pk]),
            {"status": "ARCHIVED"},
            format="json",
        ).status_code
        == 404
    )
    # Dashboard metrics: 403, because IsBrokerMember answers before any lookup.
    assert api.get(reverse("broker-dashboard", args=[alpha.pk])).status_code == 403

    # And nothing was written.
    thread.refresh_from_db()
    assert thread.status == ConversationStatus.OPEN
    assert thread.messages.count() == 1


def test_this_phase_added_no_second_message_store(api, two_brokerages):
    """Spec 28 Backend, verbatim: "Do not build a second broker-only messaging
    store." A structural assertion rather than a behavioural one — if a model
    had been added, this list would have grown."""
    from django.apps import apps

    messaging_models = sorted(
        model.__name__ for model in apps.get_app_config("messaging").get_models()
    )
    assert messaging_models == ["ContactAccessGrant", "Conversation", "Message"]
    broker_models = sorted(
        model.__name__ for model in apps.get_app_config("brokers").get_models()
    )
    assert broker_models == ["BrokerMembership", "BrokerOrganization", "BrokerPlan", "BrokerSubscription"]


def test_the_broker_inbox_query_count_is_constant_in_the_number_of_rows(
    api, two_brokerages
):
    """Spec 33.3: "Avoid N+1 queries; verify with query-count tests."

    Two REAL inboxes are compared — 2 rows and 7 rows must cost the SAME number
    of queries. An absolute budget that scales with the row count cannot fail on
    an N+1, it budgets for one. This re-proves Phase 6's property after Task 1
    added `context.url`, which reads `broker.slug` / `professional.slug`: if
    either ever stops being select_related, this is what catches it.
    """
    alpha = two_brokerages["alpha"]
    reader = two_brokerages["alpha_reader"]
    for index in range(2):
        thread_from(f"nplus1-{index}@phase19.example", alpha, f"Alpha {index}")

    api.force_authenticate(reader)
    # Warm-up, deliberately discarded: platform_settings.services.is_feature_enabled
    # caches with timeout=None and this package's flag fixture writes a fresh
    # value, so the FIRST request of a test pays one FeatureFlag SELECT no later
    # request pays. Without this line the comparison below is off by exactly one.
    api.get(reverse("conversation-list"), {"broker": str(alpha.pk)})

    with CaptureQueriesContext(connection) as small:
        first = api.get(reverse("conversation-list"), {"broker": str(alpha.pk)})
    assert len(first.data["results"]) == 2

    for index in range(5):
        thread_from(
            f"nplus1-bulk-{index}@phase19.example", alpha, f"Alpha bulk {index}"
        )

    with CaptureQueriesContext(connection) as large:
        second = api.get(reverse("conversation-list"), {"broker": str(alpha.pk)})
    assert len(second.data["results"]) == 7

    assert len(large) == len(small), [entry["sql"] for entry in large]


def test_the_dashboard_is_a_fixed_number_of_queries(api, two_brokerages):
    """Same rule for broker home: adding listings and threads must not add
    queries, because every metric is an aggregate."""
    alpha = two_brokerages["alpha"]
    reader = two_brokerages["alpha_reader"]

    api.force_authenticate(reader)
    api.get(reverse("broker-dashboard", args=[alpha.pk]))  # warm the flag cache

    with CaptureQueriesContext(connection) as small:
        api.get(reverse("broker-dashboard", args=[alpha.pk]))

    for index in range(5):
        listing_for(alpha, reader, ListingStatus.PUBLISHED, f"Dash {index}")
        thread_from(
            f"dash-bulk-{index}@phase19.example", alpha, f"Alpha dash {index}"
        )

    with CaptureQueriesContext(connection) as large:
        payload = api.get(reverse("broker-dashboard", args=[alpha.pk])).data

    assert payload["published_listings"] == 5
    assert len(large) == len(small), [entry["sql"] for entry in large]


def test_a_sender_cannot_hide_a_live_lead_from_the_brokers_inbox(api, two_brokerages):
    """Ruling 5's abuse scenario, end to end.

    Conversation has ONE status column (spec 11.8), so an initiator who could
    archive would remove their own live inquiry from the brokerage's default
    OPEN inbox — the screen spec 28 exists to build. Spec 2.2 puts that refusal
    on the server, and this test is the proof it is there rather than only in
    the UI that hides the button.
    """
    alpha = two_brokerages["alpha"]
    reader = two_brokerages["alpha_reader"]
    thread = thread_from("abuse-asker@phase19.example", alpha, "Alpha question")

    api.force_authenticate(thread.initiator)
    response = api.patch(
        reverse("conversation-status", args=[thread.pk]),
        {"status": "ARCHIVED"},
        format="json",
    )
    assert response.status_code == 403
    assert response.data["error"]["code"] == "conversation_filing_forbidden"

    # The broker's inbox still shows the lead.
    api.force_authenticate(reader)
    rows = api.get(reverse("conversation-list"), {"broker": str(alpha.pk)}).data[
        "results"
    ]
    assert [row["id"] for row in rows] == [str(thread.pk)]
    assert rows[0]["viewer_is_initiator"] is False

    # …and the broker, who IS the recipient side, can file it.
    assert (
        api.patch(
            reverse("conversation-status", args=[thread.pk]),
            {"status": "ARCHIVED"},
            format="json",
        ).status_code
        == 200
    )


def test_an_archived_thread_still_belongs_to_the_same_single_store(api, two_brokerages):
    """Archiving changes one column on the shared Conversation row. Nothing is
    copied, moved or duplicated — which is what spec 28's "shared model" means
    in practice."""
    alpha = two_brokerages["alpha"]
    reader = two_brokerages["alpha_reader"]
    thread = thread_from("archive-asker@phase19.example", alpha, "Alpha question")

    before = Conversation.objects.count()
    api.force_authenticate(reader)
    api.patch(
        reverse("conversation-status", args=[thread.pk]),
        {"status": "ARCHIVED"},
        format="json",
    )
    assert Conversation.objects.count() == before
    assert Conversation.objects.get(pk=thread.pk).status == ConversationStatus.ARCHIVED


def test_the_inquiry_window_boundary_is_the_documented_seven_days(
    api, two_brokerages
):
    """Ruling 7: the window is 7 days, it is named on the wire, and the boundary
    is asserted rather than assumed."""
    from brokers.dashboard import NEW_INQUIRY_WINDOW_DAYS

    assert NEW_INQUIRY_WINDOW_DAYS == 7
    alpha = two_brokerages["alpha"]
    reader = two_brokerages["alpha_reader"]
    inside = make_conversation(
        initiator=two_brokerages["asker"],
        conversation_type=ConversationType.BROKER_INQUIRY,
        broker=alpha,
        subject="Recent",
    )
    outside = make_conversation(
        initiator=make_user(email="old-asker@phase19.example"),
        conversation_type=ConversationType.BROKER_INQUIRY,
        broker=alpha,
        subject="Old",
    )
    Conversation.objects.filter(pk=inside.pk).update(
        created_at=timezone.now() - timedelta(days=6, hours=23)
    )
    Conversation.objects.filter(pk=outside.pk).update(
        created_at=timezone.now() - timedelta(days=7, hours=1)
    )

    api.force_authenticate(reader)
    payload = api.get(reverse("broker-dashboard", args=[alpha.pk])).data
    assert payload["messages"]["new_inquiries_7d"] == 1
