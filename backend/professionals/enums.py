from django.db import models


class ProfessionalProfileStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    PENDING = "PENDING", "Pending"
    ACTIVE = "ACTIVE", "Active"
    SUSPENDED = "SUSPENDED", "Suspended"


class SubscriptionStatus(models.TextChoices):
    INACTIVE = "INACTIVE", "Inactive"
    ACTIVE = "ACTIVE", "Active"
    PAST_DUE = "PAST_DUE", "Past due"
    LAPSED = "LAPSED", "Lapsed"
    CANCELED = "CANCELED", "Canceled"
