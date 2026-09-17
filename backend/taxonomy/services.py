import unicodedata
import uuid

from django.utils.text import slugify


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
