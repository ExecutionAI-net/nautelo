"""Spec 15's definition of done, spec 40 Scenarios A and B, and the four spec 16
acceptance tests that concern the WRITE side.

Everything here goes through the real HTTP API, not the service layer. Spec
34.2's two-thread concurrency requirement lives in its own module,
test_concurrency.py - see the note in this task for why it may not share a file.
"""

import pytest
from django.core import mail
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.tests.factories import make_user
from brokers.enums import BrokerMembershipRole
from brokers.tests.factories import make_broker, make_membership
from common.throttling import HashedIPScopedRateThrottle
from listings.enums import ListingStatus
from listings.tests.factories import make_broker_listing, make_snapshot
from messaging.enums import CURRENT_PRIVACY_POLICY_VERSION, ContactTargetType
from messaging.models import ContactAccessGrant, Conversation, Message
from notifications.models import Notification
from professionals.tests.factories import make_professional

pytestmark = pytest.mark.django_db

BODY = "I would like to arrange a viewing next week, if that suits you."


def _payload(context_type, context_id, email, **overrides):
    payload = {
        "context_type": context_type,
        "context_id": str(context_id),
        "full_name": "Ada Rossi",
        "email": email,
        "phone": "+390000000000",
        "subject": "Question about the survey",
        "message": BODY,
        "privacy_policy_version": CURRENT_PRIVACY_POLICY_VERSION,
        "privacy_consent": True,
        "marketing_consent": False,
        "company_website": "",
    }
    payload.update(overrides)
    return payload


def test_scenario_a_unified_professional_inquiry_and_contact_unlock(
    django_capture_on_commit_callbacks,
):
    """Spec 40 Scenario A, through the API.

    "one conversation/message is committed, P is notified, one access grant is
    created" - the refetch half ("returns P's configured public business
    email/phone only to that user") is Phase 7's endpoint and is deliberately
    NOT asserted here; what is asserted is that the grant Phase 7 will read
    exists and is scoped to this viewer and this target.
    """
    asker = make_user(email="acc-asker@phase6.example")
    owner = make_user(email="acc-pro-owner@phase6.example")
    professional = make_professional(
        owner,
        display_name="Phase6 Acceptance Pro",
        slug="phase6-acceptance-pro",
        public_email="office@phase6-acc.example",
    )
    api = APIClient()
    api.force_authenticate(asker)
    mail.outbox.clear()

    with django_capture_on_commit_callbacks(execute=True):
        response = api.post(
            reverse("inquiry-create"),
            _payload("PROFESSIONAL", professional.pk, asker.email),
            format="json",
        )

    assert response.status_code == 201
    assert Conversation.objects.count() == 1
    assert Message.objects.count() == 1
    assert Notification.objects.get().recipient_id == owner.pk
    assert [sent.to for sent in mail.outbox] == [["office@phase6-acc.example"]]

    grant = ContactAccessGrant.objects.get()
    assert (grant.viewer_id, grant.target_type, grant.professional_id) == (
        asker.pk,
        ContactTargetType.PROFESSIONAL,
        professional.pk,
    )
    assert response.data["contact_access"] == "GRANTED"


def test_scenario_b_a_failed_submission_leaves_nothing_and_leaks_nothing():
    """Spec 40 Scenario B: "no message, notification or grant exists and raw
    contact data is absent from the response"."""
    asker = make_user(email="acc-asker2@phase6.example")
    owner = make_user(email="acc-pro-owner2@phase6.example")
    professional = make_professional(
        owner,
        display_name="Phase6 Acceptance Pro II",
        slug="phase6-acceptance-pro-ii",
        public_email="office2@phase6-acc.example",
        public_phone="+34900111222",
    )
    api = APIClient()
    api.force_authenticate(asker)

    response = api.post(
        reverse("inquiry-create"),
        _payload("PROFESSIONAL", professional.pk, asker.email, privacy_consent=False),
        format="json",
    )

    assert response.status_code == 400
    assert Message.objects.count() == 0
    assert Notification.objects.count() == 0
    assert ContactAccessGrant.objects.count() == 0
    rendered = response.content.decode()
    assert "office2@phase6-acc.example" not in rendered
    assert "+34900111222" not in rendered


def test_a_rate_limited_message_does_not_unlock_contact(monkeypatch):
    """Spec 16: "A failed or rate-limited message does not unlock contact"."""
    monkeypatch.setitem(
        HashedIPScopedRateThrottle.THROTTLE_RATES, "inquiry_submit", "0/min"
    )
    asker = make_user(email="acc-asker3@phase6.example")
    owner = make_user(email="acc-pro-owner3@phase6.example")
    professional = make_professional(
        owner, display_name="Phase6 Acc III", slug="phase6-acc-iii"
    )
    api = APIClient()
    api.force_authenticate(asker)

    response = api.post(
        reverse("inquiry-create"),
        _payload("PROFESSIONAL", professional.pk, asker.email),
        format="json",
    )

    assert response.status_code == 429
    assert ContactAccessGrant.objects.count() == 0


def test_sending_to_broker_a_does_not_unlock_broker_b():
    """Spec 16's second acceptance test."""
    asker = make_user(email="acc-asker4@phase6.example")
    broker_a = make_broker(name="Phase6 Acc A", slug="phase6-acc-a")
    broker_b = make_broker(name="Phase6 Acc B", slug="phase6-acc-b")
    api = APIClient()
    api.force_authenticate(asker)

    api.post(
        reverse("inquiry-create"),
        _payload("BROKER", broker_a.pk, asker.email),
        format="json",
    )

    assert ContactAccessGrant.objects.filter(viewer=asker, broker=broker_a).count() == 1
    assert ContactAccessGrant.objects.filter(viewer=asker, broker=broker_b).count() == 0


def test_definition_of_done_one_service_handles_every_context(
    django_capture_on_commit_callbacks,
):
    """Spec 15's definition of done, item 3: "One backend service handles all
    types." Three contexts, one endpoint, one service, three correct inboxes."""
    asker = make_user(email="acc-asker5@phase6.example")
    api = APIClient()
    api.force_authenticate(asker)

    pro_owner = make_user(email="acc-pro5@phase6.example")
    professional = make_professional(
        pro_owner, display_name="Phase6 Acc V", slug="phase6-acc-v"
    )
    broker = make_broker(name="Phase6 Acc Fleet", slug="phase6-acc-fleet")
    reader = make_user(email="acc-reader5@phase6.example")
    make_membership(
        reader, broker, role=BrokerMembershipRole.MANAGER, can_read_messages=True
    )
    listing = make_broker_listing(broker=broker, actor=reader)
    snapshot = make_snapshot(
        listing, approved_by=make_user(email="acc-approver5@phase6.example")
    )
    listing.status = ListingStatus.PUBLISHED
    listing.current_public_snapshot = snapshot
    listing.save(update_fields=["status", "current_public_snapshot", "updated_at"])

    with django_capture_on_commit_callbacks(execute=True):
        for context_type, context_id in (
            ("PROFESSIONAL", professional.pk),
            ("BROKER", broker.pk),
            ("LISTING", listing.pk),
        ):
            response = api.post(
                reverse("inquiry-create"),
                _payload(
                    context_type,
                    context_id,
                    asker.email,
                    message=f"A distinct question about {context_type.lower()} context.",
                ),
                format="json",
            )
            assert response.status_code == 201, (context_type, response.data)

    assert Conversation.objects.filter(initiator=asker).count() == 3

    # Spec 15's definition of done, item 4: "Messages appear in the correct
    # recipient inbox and sender conversation list."
    api.force_authenticate(asker)
    assert api.get(reverse("conversation-list")).data["count"] == 3

    api.force_authenticate(pro_owner)
    pro_rows = api.get(reverse("conversation-list")).data["results"]
    assert [row["context"]["id"] for row in pro_rows] == [str(professional.pk)]

    api.force_authenticate(reader)
    broker_rows = api.get(reverse("conversation-list")).data["results"]
    assert {row["conversation_type"] for row in broker_rows} == {
        "BROKER_INQUIRY",
        "LISTING_INQUIRY",
    }


def test_definition_of_done_the_email_cannot_be_forged():
    """Spec 15's definition of done, item 2."""
    asker = make_user(email="acc-asker6@phase6.example")
    owner = make_user(email="acc-pro6@phase6.example")
    professional = make_professional(
        owner, display_name="Phase6 Acc VI", slug="phase6-acc-vi"
    )
    api = APIClient()
    api.force_authenticate(asker)

    response = api.post(
        reverse("inquiry-create"),
        _payload("PROFESSIONAL", professional.pk, "victim@phase6.example"),
        format="json",
    )
    assert response.status_code == 400
    assert Message.objects.count() == 0
