"""Every word of the site interface, in every language, editable from the Django admin.

The English source lives in the frontend repo (one JSON file). A deploy registers its keys here (`sync_ui_text`);
machine translation fills Italian and Spanish; staff can edit any text and press "Publish to platform" to send the
edits live. The public API serves only what is published.
"""

import re

from django.core.exceptions import ValidationError
from django.db import models

LOCALES = ("en", "it", "es")
PLACEHOLDER = re.compile(r"\{[A-Za-z0-9_]+\}")


def placeholders(text: str) -> set[str]:
    return set(PLACEHOLDER.findall(text or ""))


def check_text(source: str, text: str) -> None:
    """A translation must keep every {placeholder} of the source and must not carry markup."""
    if placeholders(source) != placeholders(text):
        raise ValidationError(f"Keep exactly the same {{placeholders}} as the English text: {sorted(placeholders(source))}.")
    if "<" in text or ">" in text:
        raise ValidationError("HTML is not allowed in site text.")


class TextKey(models.Model):
    key = models.CharField(max_length=200, unique=True)
    source_en = models.TextField(help_text="The English text written in the code. Change it in the code, not here.")
    description = models.CharField(max_length=300, blank=True)
    is_active = models.BooleanField(default=True, help_text="Off once the code no longer uses the key.")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("key",)
        verbose_name = "text"
        verbose_name_plural = "site texts"

    def __str__(self):
        return self.key

    @property
    def group(self) -> str:
        return self.key.split(".", 1)[0]


class TextValue(models.Model):
    class Origin(models.TextChoices):
        SOURCE = "SOURCE", "Written in the code"
        MACHINE = "MACHINE", "Machine translation"
        HUMAN = "HUMAN", "Edited by staff"

    key = models.ForeignKey(TextKey, on_delete=models.CASCADE, related_name="values")
    locale = models.CharField(max_length=2, choices=[(code, code.upper()) for code in LOCALES])
    text = models.TextField(blank=True, help_text="The working text. It goes live when you press Publish to platform.")
    published_text = models.TextField(blank=True, editable=False)
    origin = models.CharField(max_length=10, choices=Origin.choices, default=Origin.MACHINE)
    stale = models.BooleanField(default=False, help_text="Waiting for a machine translation, or the English changed after a staff edit.")
    attempts = models.PositiveSmallIntegerField(default=0, editable=False, help_text="Failed machine translation tries; it stops at 3.")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["key", "locale"], name="uitext_one_value_per_locale")]
        ordering = ("key__key", "locale")

    def __str__(self):
        return f"{self.key_id}:{self.locale}"

    @property
    def has_pending_edit(self) -> bool:
        return self.text != self.published_text

    def clean(self):
        if self.text:
            check_text(self.key.source_en, self.text)


class TextRelease(models.Model):
    """Singleton counter: bumped whenever published text changes, so caches know to refresh."""

    version = models.PositiveIntegerField(default=1)
    published_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def current(cls) -> "TextRelease":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    @classmethod
    def bump(cls) -> int:
        obj = cls.current()
        obj.version += 1
        obj.save()
        return obj.version
