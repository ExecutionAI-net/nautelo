"""Small OpenRouter client: model catalogue sync and chat completions.

Only the standard library is used (no new dependency).

Catalogue note: `GET /api/v1/models` filters to models that OUTPUT TEXT by default
(about 450). Passing `output_modalities=all` returns the full catalogue (about 600,
including image, audio and embedding models). The sync always asks for `all`.
"""

import json
import urllib.error
import urllib.request
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

from django.conf import settings
from django.db import transaction

from .models import OpenRouterModel

# A catalogue smaller than this means a truncated or filtered response: refuse to
# mark everything else unavailable.
MIN_EXPECTED_MODELS = 100
TIMEOUT_SECONDS = 60


class OpenRouterError(RuntimeError):
    pass


def _base() -> str:
    return getattr(settings, "OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1").rstrip("/")


def _request(path: str, *, body: dict | None = None, timeout: int = TIMEOUT_SECONDS) -> dict:
    headers = {"Accept": "application/json", "User-Agent": "nauta-backend"}
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    key = getattr(settings, "OPENROUTER_API_KEY", "")
    if key:
        headers["Authorization"] = f"Bearer {key}"
        headers["HTTP-Referer"] = getattr(settings, "PUBLIC_BASE_URL", "") or "https://nautelo.com"
        headers["X-Title"] = "Nauta"
    request = urllib.request.Request(_base() + path, data=data, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:  # noqa: S310 - fixed https host
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise OpenRouterError(f"OpenRouter answered HTTP {exc.code}") from exc
    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        raise OpenRouterError(f"OpenRouter request failed: {exc}") from exc


def fetch_catalog() -> list[dict]:
    payload = _request("/models?output_modalities=all")
    rows = payload.get("data")
    if not isinstance(rows, list):
        raise OpenRouterError("Unexpected catalogue response")
    return rows


def _decimal(value):
    try:
        return None if value in (None, "") else Decimal(str(value))
    except InvalidOperation:
        return None


def _when(value):
    try:
        return datetime.fromtimestamp(int(value), tz=timezone.utc) if value else None
    except (TypeError, ValueError, OverflowError, OSError):
        return None


def _fields(row: dict) -> dict:
    architecture = row.get("architecture") or {}
    pricing = row.get("pricing") or {}
    top = row.get("top_provider") or {}
    return {
        "name": (row.get("name") or row["id"])[:300],
        "description": row.get("description") or "",
        "context_length": row.get("context_length") or top.get("context_length"),
        "max_completion_tokens": top.get("max_completion_tokens"),
        "input_modalities": architecture.get("input_modalities") or [],
        "output_modalities": architecture.get("output_modalities") or [],
        "modality": architecture.get("modality") or "",
        "prompt_price": _decimal(pricing.get("prompt")),
        "completion_price": _decimal(pricing.get("completion")),
        "supported_parameters": row.get("supported_parameters") or [],
        "is_moderated": bool(top.get("is_moderated")),
        "created_remote_at": _when(row.get("created")),
        "expires_at": None,
        "is_available": True,
        "raw": row,
    }


def sync_catalog(rows: list[dict] | None = None) -> dict:
    """Upsert the whole catalogue; models OpenRouter no longer lists become unavailable."""
    rows = fetch_catalog() if rows is None else rows
    rows = [row for row in rows if isinstance(row, dict) and row.get("id")]
    if len(rows) < MIN_EXPECTED_MODELS:
        raise OpenRouterError(f"Catalogue looks incomplete ({len(rows)} models); nothing was changed.")
    ids = [row["id"] for row in rows]
    existing = set(OpenRouterModel.objects.filter(id__in=ids).values_list("id", flat=True))
    with transaction.atomic():
        for row in rows:
            OpenRouterModel.objects.update_or_create(id=row["id"], defaults=_fields(row))
        gone = OpenRouterModel.objects.exclude(id__in=ids).filter(is_available=True).update(is_available=False)
    available = OpenRouterModel.objects.filter(is_available=True).count()
    if available != len(set(ids)):
        raise OpenRouterError(f"Sync mismatch: API {len(set(ids))} models, database {available}.")
    return {
        "received": len(ids),
        "created": len(set(ids) - existing),
        "updated": len(existing),
        "made_unavailable": gone,
        "text_output": OpenRouterModel.objects.filter(is_available=True, output_modalities__contains=["text"]).count(),
    }


def chat(model_id: str, messages: list[dict], *, temperature: float, max_tokens: int = 4000) -> str:
    if not getattr(settings, "OPENROUTER_API_KEY", ""):
        raise OpenRouterError("OPENROUTER_API_KEY is not configured")
    payload = _request(
        "/chat/completions",
        body={"model": model_id, "messages": messages, "temperature": temperature, "max_tokens": max_tokens},
        timeout=120,
    )
    try:
        return payload["choices"][0]["message"]["content"] or ""
    except (KeyError, IndexError, TypeError) as exc:
        raise OpenRouterError("Unexpected completion response") from exc
