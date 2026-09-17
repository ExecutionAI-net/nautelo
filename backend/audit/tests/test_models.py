import pytest

from audit.models import AuditEvent


@pytest.mark.django_db
def test_audit_event_can_be_created_with_required_fields():
    event = AuditEvent.objects.create(
        actor_user=None,
        actor_type=AuditEvent.ActorType.SYSTEM,
        action="platform_setting.updated",
        target_type="platform_settings.PlatformSetting",
        target_id="finance.enabled",
        source=AuditEvent.Source.TASK,
        before={"value": True},
        after={"value": False},
        request_id="req-1",
    )

    assert event.id is not None
    assert event.created_at is not None
    assert event.metadata == {}
    assert event.ip_hash is None


@pytest.mark.django_db
def test_audit_event_survives_actor_user_deletion(staff_user):
    event = AuditEvent.objects.create(
        actor_user=staff_user,
        actor_type=AuditEvent.ActorType.USER,
        action="platform_setting.updated",
        target_type="platform_settings.PlatformSetting",
        target_id="finance.enabled",
        source=AuditEvent.Source.ADMIN,
        request_id="req-2",
    )

    staff_user.delete()
    event.refresh_from_db()

    assert event.actor_user_id is None
    assert event.action == "platform_setting.updated"


@pytest.mark.django_db
def test_audit_event_cannot_be_updated_once_created():
    event = AuditEvent.objects.create(
        actor_user=None,
        actor_type=AuditEvent.ActorType.SYSTEM,
        action="platform_setting.updated",
        target_type="platform_settings.PlatformSetting",
        target_id="finance.enabled",
        source=AuditEvent.Source.TASK,
        request_id="req-3",
    )

    event.action = "tampered"
    with pytest.raises(ValueError, match="immutable"):
        event.save()


@pytest.mark.django_db
def test_audit_event_cannot_be_deleted():
    event = AuditEvent.objects.create(
        actor_user=None,
        actor_type=AuditEvent.ActorType.SYSTEM,
        action="platform_setting.updated",
        target_type="platform_settings.PlatformSetting",
        target_id="finance.enabled",
        source=AuditEvent.Source.TASK,
        request_id="req-4",
    )

    with pytest.raises(ValueError, match="append-only"):
        event.delete()
