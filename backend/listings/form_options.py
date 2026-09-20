"""Closed choice lists for the listing form, served by GET listing-form/options/.

Kept server-side so a wrong or free-typed value cannot reach a listing, and so
the year range moves on its own every January.
"""

from django.utils import timezone

OLDEST_YEAR = 1900

BOAT_TYPES = ["Motor yacht", "Sailing yacht", "Catamaran", "Motorboat", "RIB", "Fishing boat"]

HULL_MATERIALS = [
    "Fiberglass (GRP)",
    "Steel",
    "Aluminium",
    "Wood",
    "Carbon fiber",
    "Composite",
    "Ferro-cement",
    "Inflatable (PVC / Hypalon)",
    "Polyethylene",
    "Other",
]

ENGINE_TYPES = [
    "Inboard",
    "Outboard",
    "Sterndrive (I/O)",
    "Saildrive",
    "Jet drive",
    "Pod drive (IPS / Zeus)",
    "Shaft drive",
    "Electric",
    "Hybrid",
    "No engine",
    "Other",
]

FUEL_TYPES = ["Diesel", "Petrol", "Electric", "Hybrid", "LPG", "Hydrogen", "Other"]

CABINS = [str(n) for n in range(0, 13)]
BATHROOMS = [str(n) for n in range(0, 11)]

# ISO 3166-1 alpha-2. EU members, the big non-EU markets and the flag states
# common in yachting. Display names are localised by the client from the code.
COUNTRIES = [
    # EU
    "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE",
    "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
    # Major markets
    "US", "CA", "RU", "TR", "GB", "NO", "CH", "IS", "UA", "ME", "AL", "MC",
    "AU", "NZ", "AE", "SA", "QA", "IL", "EG", "MA", "TN",
    # Flag states and yachting hubs
    "BS", "KY", "MH", "PA", "BM", "VG", "AG", "BB", "LR", "GI", "IM", "JE", "GG", "SC",
    "MU", "TH", "SG", "HK", "JP", "ZA", "BR", "MX", "AR", "CL",
]


def year_choices(now=None) -> list[int]:
    current = (now or timezone.now()).year
    return list(range(current, OLDEST_YEAR - 1, -1))


def media_limits() -> dict:
    """Photo/video allowances, read from the platform settings staff edit in Django."""
    from platform_settings.services import get_setting_value

    return {
        "free_images": int(get_setting_value("media.private_base_image_limit")),
        "free_videos": int(get_setting_value("media.private_base_video_limit")),
        "paid_images": int(get_setting_value("media.upgraded_image_limit")),
        "paid_videos": int(get_setting_value("media.upgraded_video_limit")),
        "broker_images": int(get_setting_value("media.broker_image_limit")),
        "broker_videos": int(get_setting_value("media.broker_video_limit")),
    }


def form_options(now=None) -> dict:
    return {
        "media_limits": media_limits(),
        "years": year_choices(now),
        "boat_types": BOAT_TYPES,
        "hull_materials": HULL_MATERIALS,
        "engine_types": ENGINE_TYPES,
        "fuel_types": FUEL_TYPES,
        "cabins": CABINS,
        "bathrooms": BATHROOMS,
        "countries": COUNTRIES,
    }
