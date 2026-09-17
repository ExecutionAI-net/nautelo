import re
import unicodedata
import uuid

from django.core.exceptions import ValidationError
from django.utils.text import slugify

_HAS_ALPHANUMERIC_RE = re.compile(r"[^\W_]", re.UNICODE)


def normalize_taxonomy_name(value: str) -> str:
    """Case/accent-insensitive key used for uniqueness and search matching."""
    collapsed = " ".join(value.split())
    decomposed = unicodedata.normalize("NFKD", collapsed)
    without_accents = "".join(
        char for char in decomposed if not unicodedata.combining(char)
    )
    return without_accents.casefold()


def generate_unique_slug(queryset, name, *, exclude_pk=None):
    """Return a slug unique within `queryset`, appending a short suffix on collision."""
    base_slug = slugify(name) or "item"
    slug = base_slug
    attempt = 0
    while True:
        conflict = queryset.filter(slug=slug)
        if exclude_pk is not None:
            conflict = conflict.exclude(pk=exclude_pk)
        if not conflict.exists():
            return slug
        attempt += 1
        if attempt > 20:
            raise ValueError(
                f"Could not generate a unique slug for '{name}' after 20 attempts"
            )
        slug = f"{base_slug}-{uuid.uuid4().hex[:6]}"


from django.db import transaction


def ensure_other_placeholder(brand):
    """Idempotently guarantee `brand` has exactly one Other BoatModel."""
    from .models import BoatModel  # local import: avoids a models<->services circular import

    with transaction.atomic():
        other, _ = BoatModel.objects.get_or_create(
            brand=brand,
            is_other_placeholder=True,
            defaults={"name": "Other"},
        )
        return other


def normalize_custom_model_name(value: str) -> str:
    """Whitespace-collapse and Unicode-normalize a free-text 'Other' model name.

    Raises ValidationError if the cleaned value contains no letters or digits
    (spec §13.2 item 5: "rejected if it contains only punctuation").
    """
    collapsed = " ".join(value.split())
    normalized = unicodedata.normalize("NFC", collapsed)
    if not _HAS_ALPHANUMERIC_RE.search(normalized):
        raise ValidationError(
            "Enter the model name.", code="custom_model_name_punctuation_only"
        )
    return normalized
