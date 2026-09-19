"""Notification store (NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md 11.10)."""

from django.conf import settings
from django.core.serializers.json import DjangoJSONEncoder
from django.db import models

from common.models import UUIDTimeStampedModel
from notifications.enums import DeliveryChannel, DeliveryStatus


class Notification(UUIDTimeStampedModel):
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="notifications",
        on_delete=models.CASCADE,
    )
    # Spec 11.10 names this column `type`. The Python attribute is
    # notification_type because `type` shadows the builtin at every call site;
    # the WIRE name stays `type` (Phase 18's serializer sets
    # source="notification_type").
    notification_type = models.CharField(max_length=64)
    title_key = models.CharField(max_length=120)
    body_key = models.CharField(max_length=120)
    payload = models.JSONField(default=dict, blank=True, encoder=DjangoJSONEncoder)
    target_url = models.CharField(max_length=300)
    read_at = models.DateTimeField(null=True, blank=True)
    # Spec 27.1's "Deduplication key" column, which every row of that table
    # defines (`inquiry.received` -> message ID) but 11.10's field list omits.
    # Recorded as an addition beyond 11.10 rather than presented as spec-literal.
    # Blank means "not deduplicated" and is never constrained, so an event type
    # that has no natural key can still be created.
    dedupe_key = models.CharField(max_length=200, blank=True, default="")

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["recipient", "read_at"]),
            models.Index(fields=["recipient", "-created_at"]),
        ]
        constraints = [
            # Spec 27's acceptance test: "Retried task does not create duplicate
            # in-app notification/delivery." Partial, so the empty key is exempt.
            # Scoped to the recipient because one message legitimately produces
            # one notification per broker team member (spec 15.4).
            models.UniqueConstraint(
                fields=["recipient", "notification_type", "dedupe_key"],
                condition=~models.Q(dedupe_key=""),
                name="notifications_dedupe_key_unique_per_recipient",
            ),
        ]

    def __str__(self):
        return f"{self.notification_type} -> {self.recipient_id}"


class NotificationDelivery(UUIDTimeStampedModel):
    notification = models.ForeignKey(
        Notification, related_name="deliveries", on_delete=models.CASCADE
    )
    channel = models.CharField(max_length=10, choices=DeliveryChannel.choices)
    status = models.CharField(
        max_length=10, choices=DeliveryStatus.choices, default=DeliveryStatus.QUEUED
    )
    attempt_count = models.PositiveIntegerField(default=0)
    provider_message_id = models.CharField(max_length=255, blank=True, default="")
    last_error_code = models.CharField(max_length=64, blank=True, default="")
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("channel",)
        constraints = [
            models.UniqueConstraint(
                fields=["notification", "channel"],
                name="notifications_one_delivery_per_channel",
            ),
        ]

    def __str__(self):
        return f"{self.channel}:{self.status} for {self.notification_id}"


class NotificationPreference(UUIDTimeStampedModel):
    """Per-user delivery choices (spec 27.3). Absent row means defaults: email on.
    In-app delivery is always on; only the email channel can be opted out."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notification_preference",
    )
    email_enabled = models.BooleanField(default=True)
