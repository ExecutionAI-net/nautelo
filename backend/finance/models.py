import uuid
from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class FinanceConfigurationVersion(models.Model):
    """A single, immutable snapshot of the global finance calculation defaults
    (annual rate, term, down payment) used by the amortization engine.

    Rows are never updated in place after creation — `is_active` is the only
    field ever mutated post-creation, and only ever flips True -> False when a
    newer version is activated (see `finance.services.FinanceConfigurationService
    .activate`, the sole supported way to change the effective configuration).
    This immutability is what lets a quote response's `configuration_version`
    (an integer, not a live foreign key) remain a permanent, reproducible
    snapshot even after staff change the defaults later.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    version = models.PositiveIntegerField(unique=True, editable=False)
    annual_rate_percent = models.DecimalField(
        max_digits=7,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0")), MaxValueValidator(Decimal("100"))],
    )
    term_months = models.PositiveIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(360)],
    )
    down_payment_percent = models.DecimalField(
        max_digits=7,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0")), MaxValueValidator(Decimal("99.99"))],
    )
    is_active = models.BooleanField(default=False)
    created_by_user_id = models.UUIDField(null=True, blank=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-version"]
        constraints = [
            models.UniqueConstraint(
                fields=["is_active"],
                condition=models.Q(is_active=True),
                name="finance_only_one_active_configuration_version",
            ),
        ]

    #: Fields that must never change once a row has been persisted. `is_active`
    #: is intentionally excluded — `FinanceConfigurationService.activate()` is
    #: the one supported way to flip it when a newer version is activated.
    _IMMUTABLE_FIELDS = (
        "version",
        "annual_rate_percent",
        "term_months",
        "down_payment_percent",
        "created_by_user_id",
        "created_at",
    )

    def save(self, *args, **kwargs):
        if self.pk is not None:
            existing = FinanceConfigurationVersion.objects.filter(pk=self.pk).first()
            if existing is not None:
                changed_fields = [
                    field
                    for field in self._IMMUTABLE_FIELDS
                    if getattr(existing, field) != getattr(self, field)
                ]
                if changed_fields:
                    raise ValueError(
                        "FinanceConfigurationVersion rows are immutable once created; "
                        "only 'is_active' may be changed on an existing row (see "
                        "FinanceConfigurationService.activate()). Attempted to change: "
                        f"{', '.join(changed_fields)}."
                    )

        super().save(*args, **kwargs)

    def __str__(self):
        return f"FinanceConfigurationVersion(v{self.version}, active={self.is_active})"
