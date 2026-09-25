"""OpenRouter model catalogue and the single translation settings row.

The catalogue is a local copy of https://openrouter.ai/api/v1/models so staff can pick
the translation model from a searchable dropdown in the Django admin. The API key is
NOT stored here: it comes from the OPENROUTER_API_KEY environment variable.
"""

from decimal import Decimal

from django.db import models
from django.db.models import Q

PER_MILLION = Decimal(1_000_000)


class OpenRouterModel(models.Model):
    id = models.CharField(max_length=200, primary_key=True)
    name = models.CharField(max_length=300)
    description = models.TextField(blank=True)
    context_length = models.BigIntegerField(null=True, blank=True)
    max_completion_tokens = models.BigIntegerField(null=True, blank=True)
    input_modalities = models.JSONField(default=list, blank=True)
    output_modalities = models.JSONField(default=list, blank=True)
    modality = models.CharField(max_length=100, blank=True)
    prompt_price = models.DecimalField(max_digits=24, decimal_places=12, null=True, blank=True, help_text="USD per token")
    completion_price = models.DecimalField(max_digits=24, decimal_places=12, null=True, blank=True, help_text="USD per token")
    supported_parameters = models.JSONField(default=list, blank=True)
    is_moderated = models.BooleanField(default=False)
    created_remote_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    is_available = models.BooleanField(default=True, help_text="False once OpenRouter stops listing the model.")
    raw = models.JSONField(default=dict, blank=True)
    synced_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("name",)
        verbose_name = "OpenRouter model"

    def __str__(self):
        return f"{self.name} ({self.id})"

    @property
    def prompt_per_million(self):
        return None if self.prompt_price is None else self.prompt_price * PER_MILLION

    @property
    def completion_per_million(self):
        return None if self.completion_price is None else self.completion_price * PER_MILLION

    @property
    def outputs_text(self) -> bool:
        return "text" in (self.output_modalities or [])


TEXT_MODELS = Q(is_available=True, output_modalities__contains=["text"])


class TranslationSettings(models.Model):
    """Singleton: which model translates listing text, and whether translation is on."""

    enabled = models.BooleanField(default=False)
    model = models.ForeignKey(
        OpenRouterModel,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
        limit_choices_to=TEXT_MODELS,
        help_text="Only models that return text are offered. Type to search.",
    )
    ui_enabled = models.BooleanField(default=True, help_text="Translate the site's interface text (buttons, headings, labels) into Italian and Spanish.")
    ui_model = models.ForeignKey(
        OpenRouterModel,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
        limit_choices_to=TEXT_MODELS,
        help_text="Model for the interface text. Leave empty to use the listing model above.",
    )
    temperature = models.FloatField(default=0.2, help_text="0 = literal, 1 = creative. Translation works best low.")
    max_input_chars = models.PositiveIntegerField(default=6000)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "translation settings"
        verbose_name_plural = "translation settings"

    def __str__(self):
        return "Translation settings"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls) -> "TranslationSettings":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj
