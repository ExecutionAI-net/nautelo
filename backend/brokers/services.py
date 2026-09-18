from dataclasses import dataclass

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ErrorDetail, ValidationError

from audit.models import AuditEvent
from audit.services import record_audit_event
from brokers.models import BrokerOrganization

POLICY_REASON_MAX_LENGTH = 500
POLICY_REASON_REQUIRED_MESSAGE = (
    "Explain why this broker's auto-approval policy is changing."
)


@dataclass(frozen=True)
class PolicyChange:
    """What set_broker_auto_approval() actually did.

    `changed` is False when the requested value already matched. The API returns
    it so the staff screen can say "already on" instead of implying a policy
    change happened, and so a repeated click writes no second audit row.
    """

    broker: BrokerOrganization
    changed: bool


def clean_policy_reason(reason: str | None) -> str:
    """Spec §21 rule 4: "Only staff admin may toggle policy; change requires a
    reason."

    Enforced in the service, not only in the serializer, so the rule holds for
    every caller — the API, Django admin, and any future management command.
    """
    cleaned = (reason or "").strip()
    if not cleaned:
        raise ValidationError(
            {
                "reason": [
                    ErrorDetail(
                        POLICY_REASON_REQUIRED_MESSAGE,
                        code="policy_reason_required",
                    )
                ]
            }
        )
    if len(cleaned) > POLICY_REASON_MAX_LENGTH:
        raise ValidationError(
            {
                "reason": [
                    ErrorDetail(
                        f"Keep the reason to {POLICY_REASON_MAX_LENGTH} characters or fewer.",
                        code="policy_reason_too_long",
                    )
                ]
            }
        )
    return cleaned


@transaction.atomic
def set_broker_auto_approval(
    broker: BrokerOrganization,
    *,
    enabled: bool,
    actor,
    reason: str,
    source: str = AuditEvent.Source.API,
) -> PolicyChange:
    """Change a broker's auto-approval policy, with actor, timestamp and reason.

    Staff-admin authorization is enforced by the caller — `IsStaffAdmin` on
    `BrokerApprovalPolicyView`, `is_staff_admin()` in `brokers.admin` — because
    the two entry points fail differently (403 envelope vs. a silent admin
    no-op) and this service has no request to answer.

    The audit event is written inside the same transaction as the column change
    (spec §2.4), so a rolled-back toggle leaves no orphaned row, and the reason
    lives in `metadata.reason` where the staff screen's audit history reads it.

    Spec §21 rules 5 and 6 are the reason nothing else happens here: enabling
    does **not** sweep the pending backlog (that is the separate, explicitly
    confirmed bulk-approve action) and disabling does **not** unpublish anything.
    `metadata.future_submissions_only` records that intent in the trail.
    """
    cleaned_reason = clean_policy_reason(reason)
    locked = BrokerOrganization.objects.select_for_update().get(pk=broker.pk)
    if locked.auto_approve_listings == enabled:
        return PolicyChange(broker=locked, changed=False)

    before = {
        "auto_approve_listings": locked.auto_approve_listings,
        "auto_approve_changed_by": (
            str(locked.auto_approve_changed_by_id)
            if locked.auto_approve_changed_by_id
            else None
        ),
        "auto_approve_changed_at": locked.auto_approve_changed_at,
    }

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

    record_audit_event(
        actor_user=actor,
        actor_type=AuditEvent.ActorType.USER,
        action="broker.auto_approval_changed",
        target_type="brokers.BrokerOrganization",
        target_id=str(locked.pk),
        source=source,
        before=before,
        after={
            "auto_approve_listings": locked.auto_approve_listings,
            "auto_approve_changed_by": str(locked.auto_approve_changed_by_id),
            "auto_approve_changed_at": locked.auto_approve_changed_at,
        },
        metadata={
            "reason": cleaned_reason,
            "broker_slug": locked.slug,
            "future_submissions_only": True,
        },
    )

    broker.refresh_from_db()
    return PolicyChange(broker=locked, changed=True)
