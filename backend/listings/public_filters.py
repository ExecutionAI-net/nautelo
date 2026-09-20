"""Query-string filters and sorting for the public listing list (boat filter panel).

Every filter reads the approved snapshot, never the draft columns on the
listing row, so a filter can never reveal or match unpublished state. Invalid
numbers are ignored rather than rejected: a shareable URL with a stale
parameter should still render a list.
"""

from decimal import Decimal, InvalidOperation
from uuid import UUID

from django.db.models import Case, DecimalField, Q, QuerySet, When
from django.db.models.fields.json import KeyTextTransform
from django.db.models.functions import Cast

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

    length_min, length_max = _decimal(params.get("length_min")), _decimal(params.get("length_max"))
    if length_min is not None or length_max is not None:
        # The overall length lives in the snapshot's free-form specifications ("loa_m", text). Only values that
        # read as a plain number take part, so a stray "about 14" can never break the query.
        raw = KeyTextTransform("loa_m", f"{SNAP}specifications")
        queryset = queryset.annotate(
            _loa_m=Case(
                When(**{f"{SNAP}specifications__loa_m__regex": r"^[0-9]+(\.[0-9]+)?$"}, then=Cast(raw, DecimalField(max_digits=8, decimal_places=2))),
                default=None,
                output_field=DecimalField(max_digits=8, decimal_places=2),
            )
        )
        if length_min is not None:
            queryset = queryset.filter(_loa_m__gte=length_min)
        if length_max is not None:
            queryset = queryset.filter(_loa_m__lte=length_max)

    for key in ("boat_type", "condition", "fuel_type"):
        value = (params.get(key) or "").strip()
        if value:
            queryset = queryset.filter(**{f"{SNAP}specifications__{key}__iexact": value})

    cabins_min = _int(params.get("cabins_min"))
    if cabins_min is not None and cabins_min > 0:
        wanted = range(cabins_min, 13)
        queryset = queryset.filter(
            Q(**{f"{SNAP}specifications__cabins__in": [str(n) for n in wanted]})
            | Q(**{f"{SNAP}specifications__cabins__in": list(wanted)})
        )

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
    from .form_options import BOAT_TYPES, FUEL_TYPES

    return {
        "brands": sorted(brands),
        "countries": sorted(countries),
        "regions": sorted(regions),
        "boat_types": BOAT_TYPES,
        "fuel_types": FUEL_TYPES,
    }
