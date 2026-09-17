import uuid

from .models import AuditEvent


def record_audit_event(
    *,
    actor_user,
    actor_type: str,
    action: str,
    target_type: str,
    target_id: str,
    source: str,
    before: dict | None = None,
    after: dict | None = None,
    request_id: str | None = None,
    metadata: dict | None = None,
    ip_hash: str | None = None,
) -> AuditEvent:
    """Create one immutable AuditEvent row.

    Callers are expected to invoke this from *inside* the same
    transaction.atomic() block as the change being described, so that a
    rolled-back mutation never leaves behind an orphaned audit row.
    """
    return AuditEvent.objects.create(
        actor_user=actor_user,
        actor_type=actor_type,
        action=action,
        target_type=target_type,
        target_id=str(target_id),
        source=source,
        before=before,
        after=after,
        request_id=request_id or str(uuid.uuid4()),
        metadata=metadata or {},
        ip_hash=ip_hash,
    )
