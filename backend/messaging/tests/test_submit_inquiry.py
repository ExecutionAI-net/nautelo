"""Spec 15.3's submission transaction, step by step, plus spec 40 Scenarios A
and B."""

import pytest
from django.core import mail
from django.utils import timezone

from accounts.tests.factories import make_user
from audit.models import AuditEvent
from brokers.enums import BrokerMembershipRole
from brokers.tests.factories import make_broker, make_membership
from listings.enums import ListingStatus
from listings.tests.factories import (
    make_broker_listing,
    make_private_listing,
    make_snapshot,
)
from messaging.enums import (
    CURRENT_PRIVACY_POLICY_VERSION,
    ContactAccessOutcome,
    ContactTargetType,
    ConversationStatus,
    ConversationType,
    InquiryContextType,
)
from messaging.exceptions import ConsentRequired, MessagingThrottled
from messaging.models import ContactAccessGrant, Conversation, Message
from messaging.services import submit_inquiry
from notifications.models import Notification
from professionals.tests.factories import make_professional

pytestmark = pytest.mark.django_db

BODY = "I would like to arrange a viewing next week, if that suits you."


def _publish(listing, approver):
    snapshot = make_snapshot(listing, approved_by=approver)
    listing.status = ListingStatus.PUBLISHED
    listing.current_public_snapshot = snapshot
    listing.save(update_fields=["status", "current_public_snapshot", "updated_at"])
    return listing


def _submit(actor, context_type, context_id, **overrides):
    payload = {
        "actor": actor,
        "context_type": context_type,
        "context_id": context_id,
        "full_name": "Ada Rossi",
        "phone": "+390000000000",
        "subject": "Question about your services",
        "body": BODY,
        "privacy_policy_version": CURRENT_PRIVACY_POLICY_VERSION,
        "marketing_consent": False,
        "request_id": "req-phase6",
    }
    payload.update(overrides)
    return submit_inquiry(**payload)


@pytest.fixture
def asker():
    return make_user(email="svc-asker@phase6.example")


@pytest.fixture
def professional():
    owner = make_user(email="svc-pro-owner@phase6.example")
    return make_professional(
        owner,
        display_name="Phase6 Svc Surveyors",
        slug="phase6-svc-surveyors",
        public_email="office@phase6-svc.example",
    )


def test_scenario_a_one_conversation_one_message_one_grant_one_notification(
    asker, professional, django_capture_on_commit_callbacks
):
    """Spec 40 Scenario A, end to end at the service layer."""
    mail.outbox.clear()
    with django_capture_on_commit_callbacks(execute=True):
        result = _submit(asker, InquiryContextType.PROFESSIONAL, professional.pk)

    assert Conversation.objects.count() == 1
    conversation = Conversation.objects.get()
    assert conversation.conversation_type == ConversationType.PROFESSIONAL_INQUIRY
    assert conversation.initiator_id == asker.pk
    assert conversation.professional_id == professional.pk
    assert conversation.subject == "Question about your services"
    assert conversation.status == ConversationStatus.OPEN
    assert conversation.last_message_at is not None

    message = Message.objects.get()
    assert message.body == BODY
    assert message.sender_email_snapshot == asker.email
    assert message.sender_name_snapshot == "Ada Rossi"
    assert message.sender_phone_snapshot == "+390000000000"
    assert message.is_system is False
    assert message.privacy_policy_version == CURRENT_PRIVACY_POLICY_VERSION

    grant = ContactAccessGrant.objects.get()
    assert grant.viewer_id == asker.pk
    assert grant.target_type == ContactTargetType.PROFESSIONAL
    assert grant.professional_id == professional.pk
    assert grant.source_conversation_id == conversation.pk
    assert grant.revoked_at is None

    notification = Notification.objects.get()
    assert notification.recipient_id == professional.owner_user_id
    assert notification.notification_type == "inquiry.received"
    assert notification.target_url == f"/dashboard/messages/{conversation.pk}/"
    assert notification.payload["context_label"] == "Phase6 Svc Surveyors"
    assert notification.payload["sender_display_name"] == "Ada Rossi"
    assert notification.payload["excerpt"] == BODY

    assert [sent.to for sent in mail.outbox] == [["office@phase6-svc.example"]]

    assert result.contact_access == ContactAccessOutcome.GRANTED
    assert result.next_url == f"/dashboard/messages/{conversation.pk}/"
    assert result.created_conversation is True
    assert result.created_grant is True


def test_a_second_inquiry_reuses_the_open_thread_and_does_not_re_grant(
    asker, professional
):
    """Spec 15.3 step 2 ("get or create") and step 4 ("if none exists")."""
    _submit(asker, InquiryContextType.PROFESSIONAL, professional.pk)
    result = _submit(
        asker,
        InquiryContextType.PROFESSIONAL,
        professional.pk,
        body="A completely different second question about mooring.",
    )

    assert Conversation.objects.count() == 1
    assert Message.objects.count() == 2
    assert ContactAccessGrant.objects.count() == 1
    assert result.created_conversation is False
    assert result.created_grant is False
    assert result.contact_access == ContactAccessOutcome.GRANTED


def test_a_private_seller_listing_grants_nothing(asker):
    seller = make_user(email="svc-seller@phase6.example")
    approver = make_user(email="svc-approver@phase6.example")
    listing = _publish(make_private_listing(owner=seller), approver)

    result = _submit(asker, InquiryContextType.LISTING, listing.pk)

    assert ContactAccessGrant.objects.count() == 0
    assert result.contact_access == ContactAccessOutcome.NOT_APPLICABLE
    assert Notification.objects.get().recipient_id == seller.pk


def test_a_broker_listing_notifies_readers_and_emails_the_organization_once(
    asker, django_capture_on_commit_callbacks
):
    """Spec 15.4: team members with can_read_messages get in-app visibility;
    email goes to the organization's configured address, "not every member"."""
    broker = make_broker(
        name="Phase6 Svc Brokers",
        slug="phase6-svc-brokers",
        public_email="leads@phase6-svc-brokers.example",
    )
    reader_one = make_user(email="svc-reader1@phase6.example")
    reader_two = make_user(email="svc-reader2@phase6.example")
    agent = make_user(email="svc-agent@phase6.example")
    make_membership(
        reader_one, broker, role=BrokerMembershipRole.MANAGER, can_read_messages=True
    )
    make_membership(
        reader_two, broker, role=BrokerMembershipRole.MANAGER, can_read_messages=True
    )
    make_membership(
        agent, broker, role=BrokerMembershipRole.AGENT, can_edit_listings=True
    )
    listing = _publish(
        make_broker_listing(broker=broker, actor=reader_one),
        make_user(email="svc-approver2@phase6.example"),
    )

    mail.outbox.clear()
    with django_capture_on_commit_callbacks(execute=True):
        result = _submit(asker, InquiryContextType.LISTING, listing.pk)

    assert set(Notification.objects.values_list("recipient_id", flat=True)) == {
        reader_one.pk,
        reader_two.pk,
    }
    assert [sent.to for sent in mail.outbox] == [
        ["leads@phase6-svc-brokers.example"]
    ]
    conversation = Conversation.objects.get()
    assert conversation.conversation_type == ConversationType.LISTING_INQUIRY
    assert conversation.broker_id == broker.pk
    assert conversation.listing_id == listing.pk
    assert result.contact_access == ContactAccessOutcome.GRANTED


def test_a_broker_with_no_message_readers_still_commits_the_inquiry(
    asker, django_capture_on_commit_callbacks
):
    """The conversation is real and shows up the moment staff grants the
    capability. Nobody is notified in the meantime - a documented limitation,
    not a silent success."""
    broker = make_broker(name="Phase6 Svc Silent", slug="phase6-svc-silent")
    mail.outbox.clear()
    with django_capture_on_commit_callbacks(execute=True):
        _submit(asker, InquiryContextType.BROKER, broker.pk)

    assert Conversation.objects.count() == 1
    assert Message.objects.count() == 1
    assert ContactAccessGrant.objects.count() == 1
    assert Notification.objects.count() == 0
    assert mail.outbox == []


def test_a_stale_privacy_policy_version_is_refused_and_writes_nothing(
    asker, professional
):
    with pytest.raises(ConsentRequired) as excinfo:
        _submit(
            asker,
            InquiryContextType.PROFESSIONAL,
            professional.pk,
            privacy_policy_version="2019-01",
        )
    assert excinfo.value.detail.code == "consent_required"
    assert Conversation.objects.count() == 0
    assert Message.objects.count() == 0
    assert ContactAccessGrant.objects.count() == 0


def test_the_same_body_twice_inside_the_window_is_rate_limited(asker, professional):
    _submit(asker, InquiryContextType.PROFESSIONAL, professional.pk)
    with pytest.raises(MessagingThrottled) as excinfo:
        _submit(asker, InquiryContextType.PROFESSIONAL, professional.pk)

    assert excinfo.value.detail.code == "rate_limited"
    assert excinfo.value.meta == {"retry_after_seconds": 300}
    assert Message.objects.count() == 1


def test_a_duplicate_outside_the_window_is_accepted(asker, professional):
    from datetime import timedelta

    _submit(asker, InquiryContextType.PROFESSIONAL, professional.pk)
    Message.objects.update(created_at=timezone.now() - timedelta(seconds=301))

    _submit(asker, InquiryContextType.PROFESSIONAL, professional.pk)
    assert Message.objects.count() == 2


def test_different_bodies_inside_the_window_are_accepted(asker, professional):
    _submit(asker, InquiryContextType.PROFESSIONAL, professional.pk)
    _submit(
        asker,
        InquiryContextType.PROFESSIONAL,
        professional.pk,
        body="A different question entirely, about winter storage rates.",
    )
    assert Message.objects.count() == 2


def test_scenario_b_a_failure_after_the_message_rolls_everything_back(
    asker, professional, monkeypatch
):
    """Spec 40 Scenario B: "no message, notification or grant exists"."""

    def boom(**kwargs):
        raise RuntimeError("notification backend down")

    monkeypatch.setattr("messaging.services.create_notification", boom)
    mail.outbox.clear()

    with pytest.raises(RuntimeError):
        _submit(asker, InquiryContextType.PROFESSIONAL, professional.pk)

    assert Conversation.objects.count() == 0
    assert Message.objects.count() == 0
    assert ContactAccessGrant.objects.count() == 0
    assert Notification.objects.count() == 0
    assert mail.outbox == []


def test_both_audit_events_are_written(asker, professional):
    _submit(asker, InquiryContextType.PROFESSIONAL, professional.pk)

    submitted = AuditEvent.objects.get(action="inquiry.submitted")
    assert submitted.actor_user_id == asker.pk
    assert submitted.target_type == "messaging.Conversation"
    assert submitted.request_id == "req-phase6"
    # Spec 33.5: never log or store the message body in the audit trail.
    assert BODY not in str(submitted.after)

    granted = AuditEvent.objects.get(action="contact_access.granted")
    assert granted.target_type == "messaging.ContactAccessGrant"
    assert granted.after["target_type"] == ContactTargetType.PROFESSIONAL


def test_a_long_body_is_excerpted_to_200_characters(asker, professional):
    long_body = "word " * 100
    _submit(asker, InquiryContextType.PROFESSIONAL, professional.pk, body=long_body)
    excerpt = Notification.objects.get().payload["excerpt"]
    assert len(excerpt) <= 200
    assert excerpt.endswith("…")
