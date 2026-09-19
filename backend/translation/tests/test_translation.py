import json

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from translation import openrouter, services
from translation.models import OpenRouterModel, TranslationSettings

pytestmark = pytest.mark.django_db


def catalogue(n=150):
    rows = [
        {
            "id": f"vendor/text-{i}",
            "name": f"Text Model {i}",
            "context_length": 8000,
            "architecture": {"modality": "text->text", "input_modalities": ["text"], "output_modalities": ["text"]},
            "pricing": {"prompt": "0.000001", "completion": "0.000002"},
            "top_provider": {"max_completion_tokens": 4000},
            "created": 1_700_000_000,
        }
        for i in range(n)
    ]
    rows.append(
        {
            "id": "vendor/image-gen",
            "name": "Image Gen",
            "architecture": {"modality": "text->image", "input_modalities": ["text"], "output_modalities": ["image"]},
            "pricing": {"prompt": "0", "completion": "0"},
        }
    )
    return rows


def test_sync_asks_for_the_full_catalogue_and_stores_every_model(monkeypatch):
    asked = []
    monkeypatch.setattr(openrouter, "_request", lambda path, **kw: asked.append(path) or {"data": catalogue()})

    result = openrouter.sync_catalog()

    assert asked == ["/models?output_modalities=all"]
    assert result["received"] == 151
    assert OpenRouterModel.objects.count() == 151
    assert result["text_output"] == 150
    text = OpenRouterModel.objects.get(id="vendor/text-1")
    assert str(text.prompt_per_million) == "1.000000000000"
    assert OpenRouterModel.objects.get(id="vendor/image-gen").outputs_text is False


def test_models_that_disappear_are_marked_unavailable_not_deleted(monkeypatch):
    rows = catalogue()
    monkeypatch.setattr(openrouter, "fetch_catalog", lambda: rows)
    openrouter.sync_catalog()
    result = openrouter.sync_catalog(rows[1:])
    assert result["made_unavailable"] == 1
    assert OpenRouterModel.objects.get(id="vendor/text-0").is_available is False


def test_a_truncated_catalogue_changes_nothing():
    with pytest.raises(openrouter.OpenRouterError):
        openrouter.sync_catalog(catalogue(5))
    assert OpenRouterModel.objects.count() == 0


def test_admin_model_picker_searches_only_text_models(admin_client, monkeypatch):
    openrouter.sync_catalog(catalogue())
    response = admin_client.get(
        "/admin/autocomplete/",
        {"app_label": "translation", "model_name": "translationsettings", "field_name": "model", "term": "Model 12"},
    )
    assert response.status_code == 200
    ids = [row["id"] for row in response.json()["results"]]
    assert "vendor/text-12" in ids and "vendor/text-120" in ids
    response = admin_client.get(
        "/admin/autocomplete/",
        {"app_label": "translation", "model_name": "translationsettings", "field_name": "model", "term": "Image"},
    )
    assert response.json()["results"] == []


def configure(monkeypatch, reply):
    openrouter.sync_catalog(catalogue())
    settings_row = TranslationSettings.load()
    settings_row.enabled = True
    settings_row.model = OpenRouterModel.objects.get(id="vendor/text-1")
    settings_row.save()
    monkeypatch.setattr(services, "chat", lambda *a, **k: reply)


def user_client(email="tr@example.com"):
    client = APIClient()
    client.force_authenticate(make_user(email=email, role=UserRole.PRIVATE_SELLER, verified=True))
    return client


BODY = {"title": "Sailing yacht", "description": "Well kept.", "source": "en", "targets": ["it", "es"]}


def test_translation_is_off_until_a_model_is_chosen():
    api = user_client()
    assert api.get(reverse("translate-status")).json() == {"enabled": False}
    assert api.post(reverse("translate"), BODY, format="json").status_code == 503


def test_translate_returns_every_target_and_survives_code_fences(monkeypatch):
    reply = "```json\n" + json.dumps({"it": {"title": "Barca a vela", "description": "Ben tenuta."}, "es": {"title": "Velero", "description": "Bien cuidado."}}) + "\n```"
    configure(monkeypatch, reply)
    api = user_client()
    assert api.get(reverse("translate-status")).json() == {"enabled": True}
    body = api.post(reverse("translate"), BODY, format="json").json()
    assert body["translations"]["it"]["title"] == "Barca a vela"
    assert body["translations"]["es"]["description"] == "Bien cuidado."


def test_a_bad_model_answer_is_a_502_not_a_crash(monkeypatch):
    configure(monkeypatch, "sorry, I cannot")
    assert user_client().post(reverse("translate"), BODY, format="json").status_code == 502


def test_translate_validates_and_requires_a_verified_user(monkeypatch):
    configure(monkeypatch, "{}")
    api = user_client()
    assert api.post(reverse("translate"), {**BODY, "targets": ["en"]}, format="json").status_code == 400
    assert api.post(reverse("translate"), {**BODY, "title": "", "description": ""}, format="json").status_code == 400
    assert APIClient().post(reverse("translate"), BODY, format="json").status_code in (401, 403)
    unverified = APIClient()
    unverified.force_authenticate(make_user(email="unv@example.com", role=UserRole.PRIVATE_SELLER, verified=False))
    assert unverified.post(reverse("translate"), BODY, format="json").status_code == 403
