import pytest

from audit.models import AuditEvent
from audit.services import record_audit_event


@pytest.mark.django_db
def test_record_audit_event_creates_a_row_with_defaults():
    event = record_audit_event(
        actor_user=None,
        actor_type=AuditEvent.ActorType.SYSTEM,
        action="platform_setting.updated",
        target_type="platform_settings.PlatformSetting",
        target_id="finance.enabled",
        source=AuditEvent.Source.TASK,
        before={"value": True},
        after={"value": False},
    )

    assert AuditEvent.objects.count() == 1
    assert event.metadata == {}
    assert event.request_id  # auto-generated when not provided


@pytest.mark.django_db
def test_record_audit_event_accepts_an_explicit_request_id_and_metadata():
    event = record_audit_event(
        actor_user=None,
        actor_type=AuditEvent.ActorType.SYSTEM,
        action="platform_setting.updated",
        target_type="platform_settings.PlatformSetting",
        target_id="finance.enabled",
        source=AuditEvent.Source.TASK,
        request_id="req-explicit",
        metadata={"reason": "scheduled_reset"},
    )

    assert event.request_id == "req-explicit"
    assert event.metadata == {"reason": "scheduled_reset"}
