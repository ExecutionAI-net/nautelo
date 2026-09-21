"""Machine translation of site text through OpenRouter, with the model chosen in Translation settings."""

import json
import logging
import re

from translation.models import TranslationSettings
from translation.openrouter import OpenRouterError, chat

from django.db.models import F

from .models import TextRelease, TextValue
from .services import accept_translation, notify_frontend, pending_values

logger = logging.getLogger(__name__)
BATCH = 40


def _json(text: str) -> dict:
    cleaned = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.MULTILINE).strip()
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("no JSON")
    data = json.loads(cleaned[start : end + 1])
    if not isinstance(data, dict):
        raise ValueError("not an object")
    return data


def translate_pending() -> dict:
    """Translate one batch of waiting texts. Safe to call again and again: it only touches what still waits."""
    config = TranslationSettings.load()
    model_id = config.ui_model_id or config.model_id
    if not config.ui_enabled or not model_id:
        return {"skipped": "Site text translation is off, or no model is chosen"}
    waiting = pending_values(BATCH)
    if not waiting:
        return {"translated": 0, "waiting": 0}
    keys = sorted({value.key.key for value in waiting})[:BATCH]
    batch = [value for value in waiting if value.key.key in keys]
    source = {value.key.key: value.key.source_en for value in batch}
    system = (
        "You translate the interface text of a boat marketplace for Spain and Italy. Translate from English into "
        "Italian (it) and Spanish (es). Natural, short, friendly. Keep brand names (NAUTA), numbers, units, currency "
        "symbols and every {placeholder} exactly as written. Do not add HTML or markdown. "
        'Reply with ONLY a JSON object: {"<key>": {"it": "...", "es": "..."}} with one entry for every key given.'
    )
    try:
        reply = chat(
            model_id,
            [{"role": "system", "content": system}, {"role": "user", "content": json.dumps(source, ensure_ascii=False)}],
            temperature=config.temperature,
            max_tokens=8000,
        )
        data = _json(reply)
    except (OpenRouterError, ValueError) as exc:
        logger.warning("site text translation failed: %s", exc)
        TextValue.objects.filter(pk__in=[value.pk for value in batch]).update(attempts=F("attempts") + 1)
        return {"error": str(exc)}
    done = rejected = 0
    for value in batch:
        entry = data.get(value.key.key)
        text = entry.get(value.locale) if isinstance(entry, dict) else None
        if isinstance(text, str) and accept_translation(value, text):
            done += 1
        else:
            rejected += 1
            TextValue.objects.filter(pk=value.pk).update(attempts=F("attempts") + 1)
    if done:
        TextRelease.bump()
        notify_frontend()
    return {"translated": done, "rejected": rejected, "waiting": len(pending_values(1))}
