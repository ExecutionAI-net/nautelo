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


class FinanceRule(models.Model):
    """One row of the financing simulator's rulebook.

    A visitor's choices (country, product, condition, use) pick the most specific active row; everything the
    simulator shows or refuses comes from that row, so a new lender term, market or question is a new row in the
    admin, not a code change. The numbers seeded at first are illustrative assumptions, not lender offers.
    """

    class Product(models.TextChoices):
        LOAN = "LOAN", "Loan / mortgage"
        LEASING = "LEASING", "Leasing (with purchase option)"

    class Condition(models.TextChoices):
        ANY = "ANY", "Any"
        NEW = "NEW", "New"
        USED = "USED", "Used"

    class Use(models.TextChoices):
        ANY = "ANY", "Any"
        PRIVATE = "PRIVATE", "Private"
        COMPANY = "COMPANY", "Company / charter"

    label = models.CharField(max_length=120, help_text="Only for staff: what this row is.")
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)
    country_code = models.CharField(max_length=2, help_text="ISO code, e.g. ES or IT. Operations are national only.")
    product = models.CharField(max_length=10, choices=Product.choices)
    condition = models.CharField(max_length=4, choices=Condition.choices, default=Condition.ANY)
    use = models.CharField(max_length=8, choices=Use.choices, default=Use.ANY)

    tin_percent = models.DecimalField(max_digits=6, decimal_places=3, help_text="Nominal yearly rate used for the payment.")
    tae_percent = models.DecimalField(max_digits=6, decimal_places=3, null=True, blank=True, help_text="Effective rate shown in the representative example.")
    opening_fee_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0, help_text="One-off fee, % of the financed amount.")
    residual_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0, help_text="Leasing purchase option, % of the price, paid at the end.")

    min_price = models.DecimalField(max_digits=12, decimal_places=2, default=15000)
    max_price = models.DecimalField(max_digits=12, decimal_places=2, default=2000000)
    min_down_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    max_down_percent = models.DecimalField(max_digits=5, decimal_places=2, default=50)
    default_down_percent = models.DecimalField(max_digits=5, decimal_places=2, default=20)
    terms_years = models.JSONField(default=list, help_text='Allowed terms in years, e.g. [5, 7, 10, 15].')
    max_age_at_end_years = models.PositiveSmallIntegerField(null=True, blank=True, help_text="Used boats: boat age when the contract ends must not exceed this.")
    age_plus_term_limit = models.PositiveSmallIntegerField(null=True, blank=True, help_text="Used boats: boat age + term in years must not exceed this (e.g. 35).")

    vat_percent = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    vat_on_installment = models.BooleanField(default=False, help_text="Leasing instalments carry VAT that a private buyer cannot recover.")
    vat_recoverable = models.BooleanField(default=False, help_text="Companies can deduct that VAT, so the simulator leads with the instalment without VAT.")
    representative_months = models.PositiveSmallIntegerField(default=120)

    note_en = models.TextField(blank=True, default="", help_text="Shown under the result for this row.")
    note_it = models.TextField(blank=True, default="")
    note_es = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["sort_order", "country_code", "product", "condition", "use"]
        constraints = [
            models.UniqueConstraint(fields=["country_code", "product", "condition", "use"], name="finance_rule_unique_combo"),
        ]

    def clean(self):
        from django.core.exceptions import ValidationError

        terms = self.terms_years
        if not isinstance(terms, list) or not terms or any(not isinstance(t, int) or t < 1 or t > 30 for t in terms):
            raise ValidationError({"terms_years": "Use a list of whole years between 1 and 30, e.g. [5, 7, 10, 15]."})
        if self.min_price >= self.max_price:
            raise ValidationError({"max_price": "Must be higher than the minimum price."})
        if self.min_down_percent > self.max_down_percent:
            raise ValidationError({"max_down_percent": "Must not be lower than the minimum."})
        if self.vat_on_installment and self.vat_percent is None:
            raise ValidationError({"vat_percent": "Set the VAT rate when instalments carry VAT."})

    def __str__(self) -> str:
        return self.label
