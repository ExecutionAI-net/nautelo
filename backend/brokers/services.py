from django.db import transaction
from django.utils import timezone

from brokers.models import BrokerOrganization


@transaction.atomic
def set_broker_auto_approval(
    broker: BrokerOrganization, *, enabled: bool, actor
) -> BrokerOrganization:
    """Change a broker's auto-approval policy, recording who changed it and when.

    Staff-admin authorization is enforced by the caller (Django admin here,
    PATCH /api/v1/staff/brokers/<id>/approval-policy/ in Phase 12). Phase 12 also
    attaches the AuditEvent required by spec 1 / 2.4.
    """
    locked = BrokerOrganization.objects.select_for_update().get(pk=broker.pk)
    if locked.auto_approve_listings == enabled:
        return locked

    locked.auto_approve_listings = enabled
    locked.auto_approve_changed_by = actor
    locked.auto_approve_changed_at = timezone.now()
    locked.save(
        update_fields=[
            "auto_approve_listings",
            "auto_approve_changed_by",
            "auto_approve_changed_at",
            "updated_at",
        ]
    )
    broker.refresh_from_db()
    return locked
