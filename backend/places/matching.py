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


def apply_place_to_attrs(attrs: dict, *, has_region: bool) -> dict:
    """Serializer helper: `place_geoname_id` fixes country, city (and region) to canonical names.

    A free-text city sent without a place forgets the old place, so the two never disagree.
    Raises serializers.ValidationError for an unknown place.
    """
    from rest_framework import serializers

    if "place_geoname_id" in attrs:
        raw = attrs["place_geoname_id"]
        if raw is None:
            return attrs
        try:
            city = City.objects.select_related("region").get(geoname_id=raw)
        except City.DoesNotExist:
            raise serializers.ValidationError({"place_id": ["Choose a place from the list."]}) from None
        attrs["country_code"] = city.country_code
        attrs["city"] = city.name_en
        if has_region:
            attrs["region"] = city.region.name_en if city.region else ""
    elif "city" in attrs:
        attrs["place_geoname_id"] = None
    return attrs
