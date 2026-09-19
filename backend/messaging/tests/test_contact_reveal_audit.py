"""Spec §2.4: "contact reveals … must generate immutable audit events".

The grant row records AUTHORIZATION; this records DELIVERY — once per grant,
not once per request (see the ruling).
"""

import json
import threading

import pytest
from django.db import connection

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from audit.models import AuditEvent
from messaging.contact_access import record_first_reveal, record_staff_reveal
from messaging.models import ContactAccessGrant
from messaging.tests.contact_factories import make_contact_grant
from professionals.tests.factories import make_professional


def build_professional():
    owner = make_user(email="reveal-owner@example.com", role=UserRole.SERVICE_PROVIDER)
    return make_professional(
        owner,
        display_name="Ligurian Refit",
        slug="ligurian-refit",
        public_email="hello@ligurian-refit.example",
        public_phone="+39010777888",
    )


@pytest.mark.django_db
def test_the_first_reveal_stamps_the_column_and_returns_true():
    viewer = make_user(email="reveal-viewer@example.com")
    grant = make_contact_grant(viewer=viewer, professional=build_professional())

    assert record_first_reveal(grant_id=grant.pk, actor=viewer) is True

    grant.refresh_from_db()
    assert grant.first_revealed_at is not None


@pytest.mark.django_db
def test_a_second_reveal_changes_nothing_and_returns_false():
    viewer = make_user(email="reveal-viewer@example.com")
    grant = make_contact_grant(viewer=viewer, professional=build_professional())
    record_first_reveal(grant_id=grant.pk, actor=viewer)
    grant.refresh_from_db()
    stamped = grant.first_revealed_at

    assert record_first_reveal(grant_id=grant.pk, actor=viewer) is False

    grant.refresh_from_db()
    assert grant.first_revealed_at == stamped
    assert AuditEvent.objects.filter(action="contact_access.revealed").count() == 1


@pytest.mark.django_db
def test_the_audit_event_records_who_what_and_when_but_no_contact_value():
    """Spec §33.5: never log private contact values. An AuditEvent is a log."""
    viewer = make_user(email="reveal-viewer@example.com")
    professional = build_professional()
    grant = make_contact_grant(viewer=viewer, professional=professional)

    record_first_reveal(grant_id=grant.pk, actor=viewer, request_id="req-123")

    event = AuditEvent.objects.get(action="contact_access.revealed")
    assert event.actor_user == viewer
    assert event.actor_type == AuditEvent.ActorType.USER
    assert event.source == AuditEvent.Source.API
    assert event.target_type == "messaging.ContactAccessGrant"
    assert event.target_id == str(grant.pk)
    assert event.request_id == "req-123"
    assert event.metadata["target_type"] == "PROFESSIONAL"
    assert event.metadata["target_entity_id"] == str(professional.pk)

    serialized = json.dumps(
        {"before": event.before, "after": event.after, "metadata": event.metadata}
    )
    assert "hello@ligurian-refit.example" not in serialized
    assert "39010777888" not in serialized


@pytest.mark.django_db
def test_a_staff_reveal_is_audited_on_every_request_and_names_no_contact_value():
    """Spec §5's staff row has no grant row to stamp, so this event is written
    every time rather than once (spec §33.1: staff high-impact actions)."""
    from django.contrib.auth.models import Group

    from accounts.enums import StaffGroup

    professional = build_professional()
    moderator = make_user(email="audit-moderator@example.com", role=UserRole.STAFF)
    moderator.groups.add(Group.objects.get(name=StaffGroup.MODERATOR))

    record_staff_reveal(
        segment="professional", target_id=professional.pk, actor=moderator
    )
    record_staff_reveal(
        segment="professional", target_id=professional.pk, actor=moderator
    )

    events = AuditEvent.objects.filter(action="contact_access.staff_revealed")
    assert events.count() == 2
    event = events.first()
    assert event.actor_user == moderator
    assert event.target_type == "professionals.ProfessionalProfile"
    assert event.target_id == str(professional.pk)
    assert event.metadata["target_type"] == "PROFESSIONAL"
    serialized = json.dumps(
        {"before": event.before, "after": event.after, "metadata": event.metadata}
    )
    assert "hello@ligurian-refit.example" not in serialized
    assert "39010777888" not in serialized


@pytest.mark.django_db(transaction=True)
def test_concurrent_first_reveals_produce_exactly_one_audit_event():
    """Spec §16's acceptance list demands exactly-one-despite-duplicates for the
    grant; the reveal marker must hold the same property."""
    viewer = make_user(email="race-viewer@example.com")
    grant = make_contact_grant(viewer=viewer, professional=build_professional())
    results = []

    def attempt():
        try:
            results.append(record_first_reveal(grant_id=grant.pk, actor=viewer))
        finally:
            connection.close()

    threads = [threading.Thread(target=attempt) for _ in range(2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert sorted(results) == [False, True]
    assert AuditEvent.objects.filter(action="contact_access.revealed").count() == 1
    assert ContactAccessGrant.objects.filter(first_revealed_at__isnull=False).count() == 1
