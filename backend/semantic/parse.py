"""Turn a buyer's sentence into filters we can trust (price, length, cabins, type, place).

Everything left over is the "feel" of the request, ranked by meaning instead of matched exactly.
English, Italian and Spanish phrasings are understood.
"""

import re
from dataclasses import dataclass, field
from decimal import Decimal

from places.importer import fold
from places.matching import find_city
from places.models import Region

MAX_WORDS = 3
UNDER = r"(?:under|below|max(?:imum)?|up to|less than|at most|within|sotto|fino a|entro|massimo|menos de|hasta|maximo|por debajo de)"
OVER = r"(?:over|above|more than|at least|min(?:imum)?|from|sopra|oltre|piu di|almeno|minimo|dal|desde|mas de|al menos)"
AMOUNT = r"(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)\s*(k|m(?:ila|il|illion|illions|illoni|illones)?|thousand|mila|mil)?"
CURRENCY = r"(?:€|eur(?:o|os)?)"
LENGTH_UNIT = r"(?:-|\s)?(?:m|mt|mtr|mtrs|metre|metres|meter|meters|metri|metro|metros)\b"

TYPES = {
    "Sailing yacht": ["sailing yacht", "sailboat", "sailing boat", "veliero", "barca a vela", "velero", "yate de vela", "sloop", "ketch"],
    "Motor yacht": ["motor yacht", "motoryacht", "yacht a motore", "yate a motor", "yate de motor", "power yacht", "flybridge"],
    "Catamaran": ["catamaran", "catamarano"],
    "Motorboat": ["motorboat", "motor boat", "motoscafo", "lancha", "speedboat", "speed boat"],
    "RIB": ["rib", "gommone", "neumatica", "semirigida", "inflatable"],
    "Fishing boat": ["fishing boat", "peschereccio", "barca da pesca", "barco de pesca", "sportfisher"],
}
# Islands and coasts people name that are not GeoNames cities: they mean a region.
REGION_ALIASES = {
    "mallorca": "Balearic Islands", "majorca": "Balearic Islands", "maiorca": "Balearic Islands", "ibiza": "Balearic Islands",
    "eivissa": "Balearic Islands", "menorca": "Balearic Islands", "minorca": "Balearic Islands", "formentera": "Balearic Islands",
    "baleares": "Balearic Islands", "sicilia": "Sicily", "sardegna": "Sardinia", "cerdena": "Sardinia", "toscana": "Tuscany",
    "cataluna": "Catalonia", "catalunya": "Catalonia", "andalucia": "Andalusia", "costa del sol": "Andalusia",
    "costa brava": "Catalonia", "amalfi": "Campania",
}
SKIP = {"with", "boat", "yacht", "near", "the", "for", "and", "barca", "barco", "per", "una", "con", "del", "de", "in", "en", "a"}


@dataclass
class Parsed:
    filters: dict = field(default_factory=dict)
    labels: list = field(default_factory=list)
    residual: str = ""


def _amount(number: str, unit: str | None) -> Decimal | None:
    raw = number
    if re.fullmatch(r"\d{1,3}(?:[.,]\d{3})+", raw):
        raw = re.sub(r"[.,]", "", raw)
    else:
        raw = raw.replace(",", ".")
    try:
        value = Decimal(raw)
    except Exception:
        return None
    unit = (unit or "").lower()
    if unit in ("k", "thousand", "mila", "mil"):
        value *= 1000
    elif unit.startswith("m"):
        value *= 1_000_000
    return value


def _money(value: Decimal) -> str:
    return f"€{int(value):,}"


def parse_query(text: str) -> Parsed:
    parsed = Parsed()
    work = " " + fold(text).replace("€", " € ") + " "

    def take(match) -> None:
        nonlocal work
        work = work[: match.start()] + " " + work[match.end():]

    # Length first: "12 m" must never be read as twelve million.
    match = re.search(rf"(?:(?P<cue>{UNDER}|{OVER})\s+)?(?<![\d.,])(?P<num>\d{{1,2}}(?:[.,]\d)?){LENGTH_UNIT}", work)
    if match:
        value = Decimal(match.group("num").replace(",", "."))
        cue = match.group("cue") or ""
        if cue and re.fullmatch(UNDER, cue):
            parsed.filters["length_max"] = str(value)
            parsed.labels.append(f"up to {value} m")
        elif cue:
            parsed.filters["length_min"] = str(value)
            parsed.labels.append(f"from {value} m")
        else:
            parsed.filters["length_min"] = str((value * Decimal("0.9")).quantize(Decimal("0.1")))
            parsed.filters["length_max"] = str((value * Decimal("1.1")).quantize(Decimal("0.1")))
            parsed.labels.append(f"about {value} m")
        take(match)

    between = re.search(rf"(?:between|tra|entre)\s+{AMOUNT}\s*{CURRENCY}?\s+(?:and|e|y|-)\s+{AMOUNT}\s*{CURRENCY}?", work)
    if between:
        low = _amount(between.group(1), between.group(2))
        high = _amount(between.group(3), between.group(4) or between.group(2))
        if low and high:
            parsed.filters["price_min"], parsed.filters["price_max"] = str(min(low, high)), str(max(low, high))
            parsed.labels.append(f"{_money(min(low, high))} to {_money(max(low, high))}")
            take(between)
    else:
        for cue_re, key, prefix in ((UNDER, "price_max", "up to"), (OVER, "price_min", "from")):
            match = re.search(rf"{cue_re}\s+{CURRENCY}?\s*{AMOUNT}\s*{CURRENCY}?", work)
            if match:
                value = _amount(match.group(1), match.group(2))
                if value and value >= 1000:
                    parsed.filters[key] = str(value)
                    parsed.labels.append(f"{prefix} {_money(value)}")
                    take(match)
        if "price_max" not in parsed.filters and "price_min" not in parsed.filters:
            match = re.search(rf"{CURRENCY}\s*{AMOUNT}|{AMOUNT}\s*{CURRENCY}|(\d+)\s*(k|mila)\b", work)
            if match:
                groups = [g for g in match.groups() if g is not None]
                value = _amount(groups[0], groups[1] if len(groups) > 1 else None)
                if value and value >= 1000:
                    parsed.filters["price_max"] = str(value)
                    parsed.labels.append(f"up to {_money(value)}")
                    take(match)

    cabins = re.search(r"(\d)\s*\+?\s*(?:cabins?|cabine|cabinas?|camere|bedrooms?|dormitorios?)\b", work)
    if cabins:
        parsed.filters["cabins_min"] = cabins.group(1)
        parsed.labels.append(f"{cabins.group(1)}+ cabins")
        take(cabins)

    for boat_type, words in TYPES.items():
        hit = next((w for w in words if re.search(rf"\b{re.escape(fold(w))}s?\b", work)), None)
        if hit:
            parsed.filters["boat_type"] = boat_type
            parsed.labels.append(boat_type)
            work = re.sub(rf"\b{re.escape(fold(hit))}s?\b", " ", work, count=1)
            break

    matched = _find_place(work, parsed)
    if matched:
        work = re.sub(rf"\b{re.escape(matched)}\b", " ", work, count=1)

    words = [w for w in re.findall(r"[a-z0-9]+", work) if len(w) > 2 and w not in SKIP]
    parsed.residual = " ".join(words)
    return parsed


def _find_place(work: str, parsed: Parsed) -> str:
    """Set place/region filters from the first place name in the text; returns the words used."""
    tokens = re.findall(r"[a-z0-9]+", work)
    for size in range(MAX_WORDS, 0, -1):
        for start in range(0, len(tokens) - size + 1):
            phrase = " ".join(tokens[start : start + size])
            if len(phrase) < 4 or phrase in SKIP:
                continue
            region_name = REGION_ALIASES.get(phrase)
            if region_name:
                parsed.filters["region"] = region_name
                parsed.labels.append(region_name)
                return phrase
            candidates = [c for c in (find_city("ES", phrase), find_city("IT", phrase)) if c]
            if candidates:
                city = max(candidates, key=lambda c: c.population)
                parsed.filters["place"] = str(city.geoname_id)
                parsed.labels.append(city.name_en)
                return phrase
            for region in Region.objects.filter(country_code__in=["ES", "IT"]):
                if phrase in {fold(region.name_en), fold(region.name_it), fold(region.name_es)}:
                    parsed.filters["region"] = region.name_en
                    parsed.labels.append(region.name_en)
                    return phrase
    return ""
