"""Query-string filters and sorting for the public listing list (boat filter panel).

Every filter reads the approved snapshot, never the draft columns on the
listing row, so a filter can never reveal or match unpublished state. Invalid
numbers are ignored rather than rejected: a shareable URL with a stale
parameter should still render a list.
"""

from decimal import Decimal, InvalidOperation
from uuid import UUID

from django.db.models import Q, QuerySet

SORTS = {
    "newest": ("-published_at", "-created_at"),
    "price_asc": ("current_public_snapshot__price", "-published_at"),
    "price_desc": ("-current_public_snapshot__price", "-published_at"),
    "year_desc": ("-current_public_snapshot__manufacture_year_snapshot", "-published_at"),
    "year_asc": ("current_public_snapshot__manufacture_year_snapshot", "-published_at"),
}

SNAP = "current_public_snapshot__"


def _decimal(value: str | None) -> Decimal | None:
    if not value:
        return None
    try:
        parsed = Decimal(value)
    except InvalidOperation:
        return None
    return parsed if parsed.is_finite() else None


def _int(value: str | None) -> int | None:
    if not value:
        return None
    try:
        return int(value)
    except ValueError:
        return None


def apply_public_filters(queryset: QuerySet, params) -> QuerySet:
    exclude = (params.get("exclude") or "").strip()
    if exclude:
        try:
            queryset = queryset.exclude(pk=UUID(exclude))
        except ValueError:
            pass

    q = (params.get("q") or "").strip()
    if q:
        queryset = queryset.filter(
            Q(**{f"{SNAP}title_en__icontains": q})
            | Q(**{f"{SNAP}brand_name_snapshot__icontains": q})
            | Q(**{f"{SNAP}model_name_snapshot__icontains": q})
            | Q(**{f"{SNAP}custom_model_name_snapshot__icontains": q})
            | Q(**{f"{SNAP}location_city__icontains": q})
        )

    brand = (params.get("brand") or "").strip()
    if brand:
        queryset = queryset.filter(**{f"{SNAP}brand_name_snapshot__iexact": brand})

    model = (params.get("model") or "").strip()
    if model:
        queryset = queryset.filter(
            Q(**{f"{SNAP}model_name_snapshot__iexact": model})
            | Q(**{f"{SNAP}custom_model_name_snapshot__iexact": model})
        )

    country = (params.get("country") or "").strip().upper()
    if country:
        queryset = queryset.filter(**{f"{SNAP}location_country": country})

    region = (params.get("region") or "").strip()
    if region:
        queryset = queryset.filter(**{f"{SNAP}location_region__iexact": region})

    seller_type = (params.get("seller_type") or "").strip().upper()
    if seller_type in {"PRIVATE", "BROKER"}:
        queryset = queryset.filter(seller_type=seller_type)

    price_min, price_max = _decimal(params.get("price_min")), _decimal(params.get("price_max"))
    if price_min is not None:
        queryset = queryset.filter(**{f"{SNAP}price__gte": price_min})
    if price_max is not None:
        queryset = queryset.filter(**{f"{SNAP}price__lte": price_max})

    year_min, year_max = _int(params.get("year_min")), _int(params.get("year_max"))
    if year_min is not None:
        queryset = queryset.filter(**{f"{SNAP}manufacture_year_snapshot__gte": year_min})
    if year_max is not None:
        queryset = queryset.filter(**{f"{SNAP}manufacture_year_snapshot__lte": year_max})

    order = SORTS.get((params.get("sort") or "newest").strip(), SORTS["newest"])
    return queryset.order_by(*order)


def facets(queryset: QuerySet) -> dict:
    """Distinct filter choices present in the published catalogue."""
    rows = queryset.values_list(
        f"{SNAP}brand_name_snapshot", f"{SNAP}location_country", f"{SNAP}location_region"
    ).order_by().distinct()
    brands, countries, regions = set(), set(), set()
    for brand, country, region in rows:
        brands.add(brand)
        countries.add(country)
        if region:
            regions.add(region)
    return {
        "brands": sorted(brands),
        "countries": sorted(countries),
        "regions": sorted(regions),
    }
