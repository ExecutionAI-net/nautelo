"""Canonical public slug for a boat listing (spec 4.1)."""

from django.utils.text import slugify


def listing_slug_base(listing) -> str:
    parts = [
        listing.brand.name,
        listing.model.name,
        str(listing.manufacture_year),
        listing.pk.hex[:8],
    ]
    return slugify(" ".join(parts))[:190]
