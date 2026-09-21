"""Map existing free-text locations onto places.City (one-off cleanup, safe to re-run)."""

from django.db import models

from .importer import fold
from .models import City


def find_city(country: str, city_text: str, region_text: str = "") -> City | None:
    """The single best city for the text, or None when there is no match or it is ambiguous."""
    wanted = fold(city_text)
    if not wanted:
        return None
    candidates = []
    for city in City.objects.filter(country_code=country, search_text__contains=wanted).select_related("region"):
        names = {fold(city.name_en), fold(city.ascii_name), fold(city.name_it), fold(city.name_es)}
        if wanted in names:
            candidates.append(city)
    if region_text:
        wanted_region = fold(region_text)
        in_region = [c for c in candidates if c.region and wanted_region in {fold(c.region.name_en), fold(c.region.name_it), fold(c.region.name_es)}]
        candidates = in_region or candidates
    if not candidates:
        return None
    candidates.sort(key=lambda c: -c.population)
    if len(candidates) > 1 and candidates[0].population < 2 * candidates[1].population:
        return None  # two similar-sized places share the name: a person must choose
    return candidates[0]


def backfill_snapshots(*, apply: bool = False) -> dict:
    """Set the place (and canonical region/city names) on published snapshots that lack one.

    Snapshots are immutable through the ORM, so the update goes through a plain
    QuerySet. Only location fields change.
    """
    from listings.models import ListingSnapshot

    matched, unmatched = 0, []
    plain = models.QuerySet(ListingSnapshot)
    for snap in ListingSnapshot.objects.filter(location_place_id__isnull=True).iterator():
        city = find_city(snap.location_country, snap.location_city, snap.location_region)
        if city is None:
            unmatched.append((snap.location_country, snap.location_region, snap.location_city))
            continue
        matched += 1
        if apply:
            plain.filter(pk=snap.pk).update(
                location_place_id=city.geoname_id,
                location_region=city.region.name_en if city.region else snap.location_region,
                location_city=city.name_en,
            )
    return {"matched": matched, "unmatched": sorted(set(unmatched))}
