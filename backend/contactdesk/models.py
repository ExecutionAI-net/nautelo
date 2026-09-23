from django.conf import settings
from django.db import models

from common.models import UUIDTimeStampedModel


class ContactRequest(UUIDTimeStampedModel):
    """A message from the public contact page or the financing study form."""

    class Topic(models.TextChoices):
        GENERAL = "general"
        BUYING = "buying"
        SELLING = "selling"
        BROKERS = "brokers"
        SERVICES = "services"
        FINANCING = "financing"
        PRESS = "press"

    class Status(models.TextChoices):
        NEW = "NEW"
        IN_PROGRESS = "IN_PROGRESS"
        HANDLED = "HANDLED"

    topic = models.CharField(max_length=12, choices=Topic.choices)
    name = models.CharField(max_length=120)
    email = models.EmailField()
    phone = models.CharField(max_length=30, blank=True, default="")
    message = models.TextField(max_length=4000, blank=True, default="")
    details = models.JSONField(default=dict, blank=True)
    reply_language = models.CharField(max_length=2, default="EN")
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.NEW)
    # Staff keep what was done about the request here (calls made, answer sent, ...).
    notes = models.TextField(blank=True, default="")
    handled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    handled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.topic}: {self.email}"
