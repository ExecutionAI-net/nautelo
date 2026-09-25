"""What a listing "says", as one string: the words a buyer might use to describe it."""

from places.models import City

SPEC_KEYS = ("boat_type", "condition", "hull_material", "engine_type", "engine_model", "fuel_type", "cabins", "loa_m", "length_m")


def _place_names(snapshot) -> list[str]:
    if not snapshot.location_place_id:
        return []
    city = City.objects.select_related("region").filter(geoname_id=snapshot.location_place_id).first()
    if city is None:
        return []
    names = [city.name_en, city.name_it, city.name_es]
    if city.region:
        names += [city.region.name_en, city.region.name_it, city.region.name_es]
    return names


def listing_text(snapshot) -> str:
    specs = snapshot.specifications or {}
    parts = [
        snapshot.title_en, snapshot.title_it, snapshot.title_es,
        snapshot.brand_name_snapshot, snapshot.model_name_snapshot, snapshot.custom_model_name_snapshot,
        str(snapshot.manufacture_year_snapshot),
        snapshot.location_city, snapshot.location_region, snapshot.location_country,
        *_place_names(snapshot),
        *(f"{key.replace('_', ' ')} {specs[key]}" for key in SPEC_KEYS if specs.get(key)),
        (snapshot.description_en or "")[:800],
        (snapshot.description_it or "")[:400],
        (snapshot.description_es or "")[:400],
    ]
    seen, unique = set(), []
    for part in parts:
        part = (part or "").strip()
        if part and part.lower() not in seen:
            seen.add(part.lower())
            unique.append(part)
    return ". ".join(unique)
