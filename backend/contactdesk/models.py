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
        HANDLED = "HANDLED"

    topic = models.CharField(max_length=12, choices=Topic.choices)
    name = models.CharField(max_length=120)
    email = models.EmailField()
    phone = models.CharField(max_length=30, blank=True, default="")
    message = models.TextField(max_length=4000, blank=True, default="")
    details = models.JSONField(default=dict, blank=True)
    reply_language = models.CharField(max_length=2, default="EN")
    status = models.CharField(max_length=8, choices=Status.choices, default=Status.NEW)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.topic}: {self.email}"
