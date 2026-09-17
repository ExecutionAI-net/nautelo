from django.conf import settings
from django.core.serializers.json import DjangoJSONEncoder
from django.db import models

from common.models import UUIDModel


class AuditEventQuerySet(models.QuerySet):
    """Blocks the bulk-mutation paths that bypass AuditEvent.save()/delete().

    QuerySet.update()/.delete() issue raw SQL directly and never call an
    instance's save()/delete(), so those per-instance guards alone don't
    stop `AuditEvent.objects.filter(...).update(...)` or `.delete()`.
    """

    def update(self, **kwargs):
        raise ValueError("AuditEvent rows are append-only; bulk update is not permitted.")

    def delete(self):
        raise ValueError("AuditEvent rows are append-only; bulk delete is not permitted.")


class AuditEvent(UUIDModel):
    """Append-only audit trail entry (NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md §10.2).

    Rows are created only through audit.services.record_audit_event() —
    never edited or deleted once written, enforced in save()/delete() below
    and again at the Django Admin layer (see admin.py). AuditEventQuerySet
    above blocks the bulk update()/delete() paths that bypass those.
    """

    class ActorType(models.TextChoices):
        USER = "USER", "User"
        SYSTEM = "SYSTEM", "System"
        STRIPE = "STRIPE", "Stripe"

    class Source(models.TextChoices):
        WEB = "WEB", "Web"
        API = "API", "API"
        ADMIN = "ADMIN", "Admin"
        TASK = "TASK", "Task"
        WEBHOOK = "WEBHOOK", "Webhook"

    actor_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="audit_events",
    )
    actor_type = models.CharField(max_length=16, choices=ActorType.choices)
    action = models.CharField(max_length=255)
    target_type = models.CharField(max_length=255)
    target_id = models.CharField(max_length=255)
    request_id = models.CharField(max_length=64)
    source = models.CharField(max_length=16, choices=Source.choices)
    before = models.JSONField(null=True, blank=True, encoder=DjangoJSONEncoder)
    after = models.JSONField(null=True, blank=True, encoder=DjangoJSONEncoder)
    metadata = models.JSONField(default=dict, blank=True, encoder=DjangoJSONEncoder)
    ip_hash = models.CharField(max_length=64, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = AuditEventQuerySet.as_manager()

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["target_type", "target_id"]),
            models.Index(fields=["actor_user", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.created_at:%Y-%m-%d %H:%M} {self.action} {self.target_type}:{self.target_id}"

    def save(self, *args, **kwargs):
        # `self._state.adding` (not `self.pk is None`) is the correct check
        # here: UUIDModel assigns a UUID at instantiation time (default=uuid4),
        # so a brand-new unsaved instance already has a non-None pk.
        if not self._state.adding:
            raise ValueError("AuditEvent records are immutable once created.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValueError("AuditEvent records are append-only and cannot be deleted.")
