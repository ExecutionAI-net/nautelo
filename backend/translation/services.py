"""Translate listing text with the model chosen in the admin (TranslationSettings)."""

import json
import re

from .models import TranslationSettings
from .openrouter import OpenRouterError, chat

LANGUAGES = {"en": "English", "it": "Italian", "es": "Spanish"}


class TranslationUnavailable(RuntimeError):
    """Translation is switched off or not fully configured."""


class TranslationFailed(RuntimeError):
    """The provider answered but the result was unusable."""


def _extract_json(text: str) -> dict:
    cleaned = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.MULTILINE).strip()
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start == -1 or end == -1:
        raise TranslationFailed("The model did not return JSON.")
    try:
        data = json.loads(cleaned[start : end + 1])
    except ValueError as exc:
        raise TranslationFailed("The model returned invalid JSON.") from exc
    if not isinstance(data, dict):
        raise TranslationFailed("The model returned an unexpected shape.")
    return data


def translate_listing_text(*, title: str, description: str, source: str, targets: list[str]) -> dict:
    """Return {"it": {"title": ..., "description": ...}, ...} for every requested target."""
    config = TranslationSettings.load()
    if not config.enabled or config.model_id is None:
        raise TranslationUnavailable("Translation is not enabled.")
    if len(title) + len(description) > config.max_input_chars:
        raise TranslationFailed("The text is too long to translate.")
    target_names = ", ".join(f"{code} ({LANGUAGES[code]})" for code in targets)
    system = (
        "You translate boat marketplace listings. Keep brand names, model names, numbers, units and "
        "currency exactly as written. Keep line breaks. Do not add or remove information. "
        f"Translate from {LANGUAGES[source]} into: {target_names}. "
        'Reply with ONLY a JSON object of the form {"<code>": {"title": "...", "description": "..."}} '
        "with one key per target language code and no other text."
    )
    user = json.dumps({"title": title, "description": description}, ensure_ascii=False)
    try:
        reply = chat(
            config.model_id,
            [{"role": "system", "content": system}, {"role": "user", "content": user}],
            temperature=config.temperature,
        )
    except OpenRouterError as exc:
        raise TranslationFailed(str(exc)) from exc
    data = _extract_json(reply)
    result = {}
    for code in targets:
        row = data.get(code)
        if not isinstance(row, dict) or not isinstance(row.get("title", ""), str) or not isinstance(row.get("description", ""), str):
            raise TranslationFailed(f"Missing translation for {code}.")
        result[code] = {"title": row.get("title", ""), "description": row.get("description", "")}
    return result
