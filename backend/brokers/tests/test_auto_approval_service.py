"""Spec §21 rule 4 and §26's definition of done: the auto-approval toggle
requires a reason and is audited, whichever entry point performs it."""

import pytest
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from audit.models import AuditEvent
from brokers.services import PolicyChange, clean_policy_reason, set_broker_auto_approval
from brokers.tests.factories import make_broker


def _admin(email):
    return make_user(email, role=UserRole.STAFF, verified=True)


@pytest.mark.django_db
def test_enabling_the_policy_writes_an_audit_event_carrying_the_reason():
    actor = _admin("policy-audit@example.com")
    broker = make_broker(name="Audited", slug="audited")
    before = timezone.now()

    result = set_broker_auto_approval(
        broker, enabled=True, actor=actor, reason="Vetted partner, 8 years."
    )

    assert isinstance(result, PolicyChange)
    assert result.changed is True
    assert result.broker.auto_approve_listings is True
    assert result.broker.auto_approve_changed_by == actor
    assert result.broker.auto_approve_changed_at >= before

    event = AuditEvent.objects.get(target_id=str(broker.pk))
    assert event.action == "broker.auto_approval_changed"
    assert event.target_type == "brokers.BrokerOrganization"
    assert event.actor_user == actor
    assert event.actor_type == AuditEvent.ActorType.USER
    assert event.source == AuditEvent.Source.API
    assert event.before["auto_approve_listings"] is False
    assert event.before["auto_approve_changed_by"] is None
    assert event.after["auto_approve_listings"] is True
    assert event.after["auto_approve_changed_by"] == str(actor.pk)
    assert event.metadata["reason"] == "Vetted partner, 8 years."
    assert event.metadata["broker_slug"] == "audited"
    assert event.metadata["future_submissions_only"] is True


@pytest.mark.django_db
@pytest.mark.parametrize("reason", ["", "   ", None])
def test_a_missing_reason_is_refused_with_a_stable_code(reason):
    actor = _admin("policy-noreason@example.com")
    broker = make_broker(name="No Reason", slug="no-reason")

    with pytest.raises(ValidationError) as exc_info:
        set_broker_auto_approval(broker, enabled=True, actor=actor, reason=reason)

    assert exc_info.value.detail["reason"][0].code == "policy_reason_required"
    broker.refresh_from_db()
    assert broker.auto_approve_listings is False
    assert AuditEvent.objects.filter(target_id=str(broker.pk)).count() == 0


@pytest.mark.django_db
def test_a_missing_reason_is_refused_even_when_the_value_would_not_change():
    actor = _admin("policy-noreason-noop@example.com")
    broker = make_broker(name="No Reason Noop", slug="no-reason-noop")

    with pytest.raises(ValidationError):
        set_broker_auto_approval(broker, enabled=False, actor=actor, reason="  ")


@pytest.mark.django_db
def test_a_one_character_reason_is_accepted_and_the_stored_reason_is_trimmed():
    actor = _admin("policy-trim@example.com")
    broker = make_broker(name="Trim", slug="trim")

    set_broker_auto_approval(broker, enabled=True, actor=actor, reason=" x ")

    event = AuditEvent.objects.get(target_id=str(broker.pk))
    assert event.metadata["reason"] == "x"


@pytest.mark.django_db
def test_setting_the_same_value_changes_nothing_and_audits_nothing():
    actor = _admin("policy-noop@example.com")
    broker = make_broker(name="No Op", slug="no-op")
    set_broker_auto_approval(broker, enabled=True, actor=actor, reason="First pass.")
    first_stamp = broker.auto_approve_changed_at

    result = set_broker_auto_approval(
        broker, enabled=True, actor=actor, reason="Second pass."
    )

    assert result.changed is False
    broker.refresh_from_db()
    assert broker.auto_approve_changed_at == first_stamp
    assert AuditEvent.objects.filter(target_id=str(broker.pk)).count() == 1


@pytest.mark.django_db
def test_disabling_an_already_disabled_policy_is_a_no_op():
    actor = _admin("policy-noop-off@example.com")
    broker = make_broker(name="Already Off", slug="already-off")

    result = set_broker_auto_approval(
        broker, enabled=False, actor=actor, reason="Just in case."
    )

    assert result.changed is False
    assert result.broker.auto_approve_changed_by is None
    assert result.broker.auto_approve_changed_at is None
    assert AuditEvent.objects.filter(target_id=str(broker.pk)).count() == 0


@pytest.mark.django_db
def test_disabling_the_policy_restamps_and_audits_again():
    actor = _admin("policy-disable@example.com")
    broker = make_broker(name="Toggled", slug="toggled")
    set_broker_auto_approval(broker, enabled=True, actor=actor, reason="Trial.")
    enabled_at = broker.auto_approve_changed_at

    set_broker_auto_approval(
        broker, enabled=False, actor=actor, reason="Two rejected listings."
    )

    broker.refresh_from_db()
    assert broker.auto_approve_listings is False
    assert broker.auto_approve_changed_at > enabled_at
    events = AuditEvent.objects.filter(target_id=str(broker.pk)).order_by("created_at")
    assert [event.after["auto_approve_listings"] for event in events] == [True, False]
    assert events[1].before["auto_approve_listings"] is True
    assert events[1].metadata["reason"] == "Two rejected listings."


@pytest.mark.django_db
def test_the_admin_entry_point_is_audited_with_the_admin_source():
    actor = _admin("policy-adminsource@example.com")
    broker = make_broker(name="Admin Source", slug="admin-source")

    set_broker_auto_approval(
        broker,
        enabled=True,
        actor=actor,
        reason="Enabled from Django admin.",
        source=AuditEvent.Source.ADMIN,
    )

    event = AuditEvent.objects.get(target_id=str(broker.pk))
    assert event.source == AuditEvent.Source.ADMIN


def test_clean_policy_reason_trims():
    assert clean_policy_reason("  vetted  ") == "vetted"


def test_clean_policy_reason_length_boundary_is_500_after_trimming():
    assert clean_policy_reason("a" * 500) == "a" * 500
    assert clean_policy_reason("  " + "a" * 500 + "  ") == "a" * 500
    with pytest.raises(ValidationError) as exc_info:
        clean_policy_reason("a" * 501)
    assert exc_info.value.detail["reason"][0].code == "policy_reason_too_long"


@pytest.mark.django_db
def test_an_over_long_reason_is_refused_by_the_service_and_changes_nothing():
    actor = _admin("policy-toolong@example.com")
    broker = make_broker(name="Too Long", slug="too-long")

    with pytest.raises(ValidationError):
        set_broker_auto_approval(broker, enabled=True, actor=actor, reason="a" * 501)
    set_broker_auto_approval(broker, enabled=True, actor=actor, reason="a" * 500)

    events = AuditEvent.objects.filter(target_id=str(broker.pk))
    assert events.count() == 1
    assert len(events[0].metadata["reason"]) == 500


@pytest.mark.django_db
def test_audit_payloads_with_datetimes_round_trip_through_the_json_field():
    actor = _admin("policy-json@example.com")
    broker = make_broker(name="Json", slug="json")
    set_broker_auto_approval(broker, enabled=True, actor=actor, reason="On.")
    set_broker_auto_approval(broker, enabled=False, actor=actor, reason="Off.")

    events = list(
        AuditEvent.objects.filter(target_id=str(broker.pk)).order_by("created_at")
    )
    first, second = (AuditEvent.objects.get(pk=e.pk) for e in events)
    assert first.before["auto_approve_changed_at"] is None
    assert isinstance(first.after["auto_approve_changed_at"], str)
    # The second toggle's "before" is exactly the first toggle's "after".
    assert isinstance(second.before["auto_approve_changed_at"], str)
    assert second.before["auto_approve_changed_at"] == first.after["auto_approve_changed_at"]
    assert isinstance(second.after["auto_approve_changed_at"], str)
    assert second.before["auto_approve_changed_by"] == str(actor.pk)


@pytest.mark.django_db(transaction=True)
def test_a_failing_audit_write_rolls_back_the_toggle(monkeypatch):
    actor = _admin("policy-atomic@example.com")
    broker = make_broker(name="Atomic", slug="atomic")

    def boom(**kwargs):
        raise RuntimeError("audit store down")

    monkeypatch.setattr("brokers.services.record_audit_event", boom)

    with pytest.raises(RuntimeError):
        set_broker_auto_approval(broker, enabled=True, actor=actor, reason="Atomic.")

    broker.refresh_from_db()
    assert broker.auto_approve_listings is False
    assert broker.auto_approve_changed_by is None
    assert broker.auto_approve_changed_at is None
    assert AuditEvent.objects.filter(target_id=str(broker.pk)).count() == 0


@pytest.mark.django_db
def test_the_toggle_takes_a_row_lock_on_the_broker():
    from django.db import connection
    from django.test.utils import CaptureQueriesContext

    actor = _admin("policy-lock@example.com")
    broker = make_broker(name="Locked", slug="locked")

    with CaptureQueriesContext(connection) as queries:
        set_broker_auto_approval(broker, enabled=True, actor=actor, reason="Lock.")

    locking = [
        q["sql"]
        for q in queries.captured_queries
        if "FOR UPDATE" in q["sql"].upper() and "brokers_brokerorganization" in q["sql"]
    ]
    assert len(locking) == 1
    # The lock is taken before the column write, in the same transaction.
    sqls = [q["sql"] for q in queries.captured_queries]
    assert sqls.index(locking[0]) < next(
        i for i, sql in enumerate(sqls) if sql.startswith("UPDATE")
    )
