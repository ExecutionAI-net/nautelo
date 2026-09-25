"""Load GeoNames dumps into Region and City.

Inputs are plain iterables of lines so the same code runs from a downloaded
file, a test string and a scheduled task. GeoNames columns used:
  cities file: 0 id, 1 name, 2 asciiname, 3 alternatenames, 4 lat, 5 lon, 8 country, 10 admin1, 14 population
  admin1 file: code (CC.admin1), name, asciiname, geoname id
  alternate names (optional): id, geonameid, isolanguage, name, isPreferred, ...
"""

import unicodedata
from decimal import Decimal
from typing import Iterable

from django.db import transaction

from .models import City, Region

LOCALES = ("en", "it", "es")


def fold(text: str) -> str:
    """Lower-case and strip accents: 'Genova' == 'genova', 'Cádiz' == 'cadiz'."""
    decomposed = unicodedata.normalize("NFKD", text)
    return "".join(c for c in decomposed if not unicodedata.combining(c)).lower().strip()


def load_regions(lines: Iterable[str], countries: set[str]) -> dict:
    """Upsert regions; returns {(country, admin1_code): Region}."""
    found = {}
    for line in lines:
        parts = line.rstrip("\n").split("\t")
        if len(parts) < 4 or "." not in parts[0]:
            continue
        country, code = parts[0].split(".", 1)
        if country not in countries:
            continue
        region, _ = Region.objects.update_or_create(
            geoname_id=int(parts[3]),
            defaults={"country_code": country, "admin1_code": code, "name_en": parts[2] or parts[1]},
        )
        found[(country, code)] = region
    return found


def load_alternate_names(lines: Iterable[str], wanted_ids: set[int]) -> dict[int, dict[str, str]]:
    """{geoname_id: {'it': 'Genova', ...}} - a preferred name wins over the first one seen."""
    names: dict[int, dict[str, str]] = {}
    preferred: set[tuple[int, str]] = set()
    for line in lines:
        parts = line.rstrip("\n").split("\t")
        if len(parts) < 4 or parts[2] not in LOCALES:
            continue
        geoname_id = int(parts[1])
        if geoname_id not in wanted_ids:
            continue
        key = (geoname_id, parts[2])
        is_preferred = len(parts) > 4 and parts[4] == "1"
        if key in preferred or (key[1] in names.get(geoname_id, {}) and not is_preferred):
            continue
        names.setdefault(geoname_id, {})[parts[2]] = parts[3]
        if is_preferred:
            preferred.add(key)
    return names


@transaction.atomic
def load_cities(lines: Iterable[str], countries: set[str], regions: dict, alternates: dict | None = None) -> int:
    alternates = alternates or {}
    incoming: dict[int, City] = {}
    for line in lines:
        parts = line.rstrip("\n").split("\t")
        if len(parts) < 15 or parts[8] not in countries:
            continue
        geoname_id = int(parts[0])
        local = alternates.get(geoname_id, {})
        spellings = {parts[1], parts[2], *local.values(), *[a for a in parts[3].split(",") if a]}
        incoming[geoname_id] = City(
            geoname_id=geoname_id,
            country_code=parts[8],
            region=regions.get((parts[8], parts[10])),
            name_en=parts[1],
            name_it=local.get("it", ""),
            name_es=local.get("es", ""),
            ascii_name=parts[2],
            search_text=" ".join(sorted({fold(x) for x in spellings if x}))[:4000],
            latitude=Decimal(parts[4]),
            longitude=Decimal(parts[5]),
            population=int(parts[14] or 0),
        )
    existing = dict(City.objects.filter(geoname_id__in=incoming).values_list("geoname_id", "pk"))
    to_create = [c for gid, c in incoming.items() if gid not in existing]
    to_update = []
    for gid, city in incoming.items():
        if gid in existing:
            city.pk = existing[gid]
            to_update.append(city)
    City.objects.bulk_create(to_create, batch_size=2000)
    City.objects.bulk_update(
        to_update,
        ["country_code", "region", "name_en", "name_it", "name_es", "ascii_name", "search_text", "latitude", "longitude", "population"],
        batch_size=2000,
    )
    return len(incoming)
