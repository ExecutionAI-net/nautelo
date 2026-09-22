"""Register keys from the code, translate what is missing, publish edits."""

import json
import logging
import re
import urllib.request
from pathlib import Path

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import transaction

from .models import LOCALES, TextKey, TextRelease, TextValue, check_text

logger = logging.getLogger(__name__)
KEY_RE = re.compile(r"^[a-z0-9][a-z0-9_.-]*$")
MAX_ATTEMPTS = 3
OTHER_LOCALES = [code for code in LOCALES if code != "en"]


def load_source(path: str | Path) -> dict[str, str]:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("The source file must be a flat JSON object.")
    for key, value in data.items():
        if not KEY_RE.match(key) or len(key) > 200:
            raise ValueError(f"Invalid text key: {key!r}")
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"Text for {key!r} must be a non-empty string.")
        if "<" in value or ">" in value:
            raise ValueError(f"Text for {key!r} must not contain markup.")
    return data


def load_seed(path: str | Path) -> dict[str, dict[str, str]]:
    """Hand-written translations that came with the code: {"it": {key: text}, "es": {...}}. Missing file = none."""
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}
    if not isinstance(data, dict):
        raise ValueError("The seed file must map a language code to {key: text}.")
    return data


def _apply_seed(row: TextKey, seeds: dict[str, dict[str, str]]) -> None:
    """A new key that already has a hand-written translation in the code starts with it, live, and is not machine-translated."""
    for locale, texts in seeds.items():
        text = texts.get(row.key)
        if locale not in OTHER_LOCALES or not isinstance(text, str) or not text.strip():
            continue
        try:
            check_text(row.source_en, text)
        except ValidationError:
            continue
        TextValue.objects.filter(key=row, locale=locale).update(
            text=text, published_text=text, origin=TextValue.Origin.HUMAN, stale=False, attempts=0
        )


def sync_source(source: dict[str, str], seeds: dict[str, dict[str, str]] | None = None) -> dict:
    """Make the database match the keys in the code. Returns counts; never overwrites staff-edited text."""
    created = changed = 0
    with transaction.atomic():
        existing = {row.key: row for row in TextKey.objects.all()}
        for key, english in source.items():
            row = existing.get(key)
            if row is None:
                row = TextKey.objects.create(key=key, source_en=english)
                created += 1
            elif row.source_en != english or not row.is_active:
                row.source_en, row.is_active = english, True
                row.save(update_fields=["source_en", "is_active"])
                changed += 1
            else:
                continue
            _apply_english(row)
            if seeds and row.pk and not row.values.filter(locale__in=OTHER_LOCALES).exclude(text="").exists():
                _apply_seed(row, seeds)
        retired = TextKey.objects.filter(is_active=True).exclude(key__in=source.keys()).update(is_active=False)
        if created or changed:
            TextRelease.bump()
    return {"created": created, "changed": changed, "retired": retired}


def _apply_english(row: TextKey) -> None:
    """English follows the code, unless staff rewrote it. The other languages are queued for (re)translation."""
    en, _ = TextValue.objects.get_or_create(key=row, locale="en", defaults={"origin": TextValue.Origin.SOURCE})
    if en.origin == TextValue.Origin.SOURCE:
        en.text = en.published_text = row.source_en
        en.save()
    for locale in OTHER_LOCALES:
        value = TextValue.objects.filter(key=row, locale=locale).first()
        if value is None:
            TextValue.objects.create(key=row, locale=locale, origin=TextValue.Origin.MACHINE, stale=True)
        else:
            value.stale, value.attempts = True, 0
            value.save(update_fields=["stale", "attempts", "updated_at"])


def pending_values(limit: int = 40) -> list[TextValue]:
    """Texts still waiting for a machine translation. A staff-edited text is never queued: it is only flagged."""
    return list(
        TextValue.objects.filter(key__is_active=True, locale__in=OTHER_LOCALES, stale=True, attempts__lt=MAX_ATTEMPTS)
        .exclude(origin=TextValue.Origin.HUMAN)
        .select_related("key")
        .order_by("key__key", "locale")[: limit * len(OTHER_LOCALES)]
    )


def publish() -> int:
    """Send every edited text live. Returns how many texts changed."""
    changed = 0
    with transaction.atomic():
        for value in TextValue.objects.select_related("key").filter(key__is_active=True):
            if value.text != value.published_text:
                value.published_text = value.text
                value.save(update_fields=["published_text", "updated_at"])
                changed += 1
        if changed:
            TextRelease.bump()
    if changed:
        notify_frontend()
    return changed


def notify_frontend() -> None:
    """Ask the site to drop its cached text now. Best effort: the site's own cache expires within a minute anyway."""
    url = getattr(settings, "UITEXT_REVALIDATE_URL", "")
    token = getattr(settings, "UITEXT_REVALIDATE_TOKEN", "")
    if not url or not token:
        return
    request = urllib.request.Request(url, data=b"{}", method="POST", headers={"Content-Type": "application/json", "X-Revalidate-Token": token})
    try:
        urllib.request.urlopen(request, timeout=5).read()  # noqa: S310 - operator-configured URL
    except Exception:  # noqa: BLE001
        logger.warning("could not tell the site to refresh its text", exc_info=True)


def bundle(locale: str) -> dict[str, str]:
    """Published text for one language; keys with nothing published are left out so the site falls back to English."""
    rows = TextValue.objects.filter(key__is_active=True, locale=locale).exclude(published_text="").values_list("key__key", "published_text")
    return dict(rows)


def accept_translation(value: TextValue, text: str) -> bool:
    """Store a machine translation that keeps the placeholders and has no markup. Nobody edited it, so it goes live at once."""
    text = (text or "").strip()
    if not text:
        return False
    try:
        check_text(value.key.source_en, text)
    except Exception:  # noqa: BLE001
        return False
    value.text = value.published_text = text
    value.origin = TextValue.Origin.MACHINE
    value.stale = False
    value.save()
    return True
