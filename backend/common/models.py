import uuid

from django.db import models


class UUIDModel(models.Model):
    """Abstract base giving a model a UUID primary key instead of Django's
    default auto-incrementing integer, per the spec's "all primary keys are
    UUIDs unless stated otherwise" rule (NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md §11).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True


class TimeStampedModel(models.Model):
    """Abstract base adding auto-managed created_at/updated_at timestamps.

    Not suitable for append-only/immutable models (e.g. audit.AuditEvent),
    which should declare only `created_at` themselves — an `updated_at`
    field would imply the row can legitimately change after creation.
    """

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class UUIDTimeStampedModel(UUIDModel, TimeStampedModel):
    """Convenience base combining a UUID primary key with created_at/updated_at
    timestamps — the common case for most domain models (per the spec's "all
    primary keys are UUIDs, all timestamps are timezone-aware UTC" rule).
    Models that need only one of the two (e.g. append-only audit rows that
    should not have `updated_at`) should inherit from `UUIDModel` or
    `TimeStampedModel` directly instead.
    """

    class Meta:
        abstract = True
