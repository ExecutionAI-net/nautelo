import json
from unittest import mock

import pytest
from django.core.exceptions import ValidationError
from django.urls import reverse
from rest_framework.test import APIClient

from translation.models import OpenRouterModel, TranslationSettings
from uitext import services
from uitext.models import TextKey, TextRelease, TextValue, check_text
from uitext.translate import translate_pending

pytestmark = pytest.mark.django_db

SOURCE = {"boats.title": "Boats for sale", "boats.count": "{count} boats found"}


def _configure_translation(enabled=True):
    model = OpenRouterModel.objects.create(id="test/model", name="Test", output_modalities=["text"])
    settings_row = TranslationSettings.load()
    settings_row.ui_enabled, settings_row.ui_model = enabled, model
    settings_row.save()


def _reply(payload):
    return mock.patch("uitext.translate.chat", return_value=json.dumps(payload))


def test_sync_registers_keys_and_queues_other_languages():
    result = services.sync_source(SOURCE)
    assert result == {"created": 2, "changed": 0, "retired": 0}
    en = TextValue.objects.get(key__key="boats.title", locale="en")
    assert en.published_text == "Boats for sale" and en.origin == "SOURCE"
    it = TextValue.objects.get(key__key="boats.title", locale="it")
    assert it.stale and it.published_text == ""
    assert services.sync_source(SOURCE) == {"created": 0, "changed": 0, "retired": 0}


def test_removed_keys_are_retired_not_deleted():
    services.sync_source(SOURCE)
    result = services.sync_source({"boats.title": "Boats for sale"})
    assert result["retired"] == 1
    assert not TextKey.objects.get(key="boats.count").is_active
    assert "boats.count" not in services.bundle("en")


def test_machine_translation_fills_it_and_es_and_goes_live():
    services.sync_source(SOURCE)
    _configure_translation()
    payload = {
        "boats.title": {"it": "Barche in vendita", "es": "Barcos en venta"},
        "boats.count": {"it": "{count} barche trovate", "es": "{count} barcos encontrados"},
    }
    with _reply(payload):
        result = translate_pending()
    assert result["translated"] == 4
    assert services.bundle("it")["boats.count"] == "{count} barche trovate"
    assert services.bundle("es")["boats.title"] == "Barcos en venta"


def test_translation_that_loses_a_placeholder_or_adds_html_is_rejected_and_retried_only_three_times():
    services.sync_source({"boats.count": "{count} boats found"})
    _configure_translation()
    bad = {"boats.count": {"it": "barche trovate", "es": "<b>{count}</b> barcos"}}
    for _ in range(4):
        with _reply(bad):
            translate_pending()
    it = TextValue.objects.get(key__key="boats.count", locale="it")
    assert it.published_text == "" and it.attempts == 3
    assert translate_pending()["translated"] == 0


def test_translation_is_skipped_when_switched_off():
    services.sync_source(SOURCE)
    _configure_translation(enabled=False)
    assert "skipped" in translate_pending()


def test_staff_edit_needs_publish_and_is_never_overwritten_by_a_new_translation():
    services.sync_source({"boats.title": "Boats for sale"})
    _configure_translation()
    with _reply({"boats.title": {"it": "Barche", "es": "Barcos"}}):
        translate_pending()
    it = TextValue.objects.get(key__key="boats.title", locale="it")
    it.text, it.origin = "Barche in vendita", TextValue.Origin.HUMAN
    it.save()
    assert services.bundle("it")["boats.title"] == "Barche"  # not live yet
    with mock.patch("uitext.services.notify_frontend") as notify:
        assert services.publish() == 1
    notify.assert_called_once()
    assert services.bundle("it")["boats.title"] == "Barche in vendita"
    # The English changes in the code: the edited text is flagged, not replaced.
    services.sync_source({"boats.title": "Boats on sale"})
    it.refresh_from_db()
    assert it.text == "Barche in vendita" and it.stale
    with _reply({"boats.title": {"it": "X", "es": "Barcos en oferta"}}):
        translate_pending()
    it.refresh_from_db()
    assert it.text == "Barche in vendita"


def test_publish_bumps_the_version_only_when_something_changed():
    services.sync_source(SOURCE)
    before = TextRelease.current().version
    assert services.publish() == 0
    assert TextRelease.current().version == before


def test_edited_text_must_keep_placeholders_and_have_no_markup():
    with pytest.raises(ValidationError):
        check_text("{count} boats", "barche")
    with pytest.raises(ValidationError):
        check_text("Boats", "<script>x</script>")
    check_text("{count} boats", "{count} barche")


def test_public_api_serves_published_text_with_an_etag():
    services.sync_source(SOURCE)
    client = APIClient()
    response = client.get(reverse("ui-text", args=["en"]))
    assert response.status_code == 200
    assert response.json()["messages"]["boats.title"] == "Boats for sale"
    assert response["Cache-Control"] == "public, max-age=60"
    again = client.get(reverse("ui-text", args=["en"]), HTTP_IF_NONE_MATCH=response["ETag"])
    assert again.status_code == 304
    assert client.get(reverse("ui-text", args=["it"])).json()["messages"] == {}
    assert client.get(reverse("ui-text", args=["xx"])).status_code == 404


def test_source_file_is_validated(tmp_path):
    bad = tmp_path / "s.json"
    bad.write_text(json.dumps({"Bad Key": "x"}))
    with pytest.raises(ValueError):
        services.load_source(bad)
    bad.write_text(json.dumps({"a.b": "<b>x</b>"}))
    with pytest.raises(ValueError):
        services.load_source(bad)
    good = tmp_path / "g.json"
    good.write_text(json.dumps({"a.b": "x"}))
    assert services.load_source(good) == {"a.b": "x"}


def test_admin_lists_texts_and_publishes(admin_client):
    services.sync_source(SOURCE)
    listing = admin_client.get(reverse("admin:uitext_textkey_changelist"))
    assert listing.status_code == 200 and b"Publish to platform" in listing.content
    assert admin_client.get(reverse("admin:uitext_textkey_change", args=[TextKey.objects.first().pk])).status_code == 200
    it = TextValue.objects.get(key__key="boats.title", locale="it")
    it.text = "Barche in vendita"
    it.save()
    assert admin_client.get(reverse("admin:uitext_textkey_publish"), follow=True).status_code == 200
    assert services.bundle("it")["boats.title"] == "Barche in vendita"
    assert admin_client.get(reverse("admin:uitext_textkey_changelist") + "?state=pending").status_code == 200


def test_seed_gives_new_keys_a_live_hand_written_translation_and_skips_bad_ones():
    seeds = {"it": {"boats.title": "Barche in vendita", "boats.count": "{numero} barche"}, "es": {"boats.title": "Barcos en venta"}}
    services.sync_source(SOURCE, seeds)
    it = TextValue.objects.get(key__key="boats.title", locale="it")
    assert (it.text, it.published_text, it.origin, it.stale) == ("Barche in vendita", "Barche in vendita", "HUMAN", False)
    assert TextValue.objects.get(key__key="boats.title", locale="es").text == "Barcos en venta"
    bad = TextValue.objects.get(key__key="boats.count", locale="it")  # wrong placeholder: left for the machine
    assert bad.text == "" and bad.origin == "MACHINE" and bad.stale
    assert TextValue.objects.get(key__key="boats.count", locale="es").stale


def test_sync_scrubs_the_retired_brand_from_stored_text():
    services.sync_source({"fin.note": "Nautelo does not lend money"})
    en = TextValue.objects.get(key__key="fin.note", locale="en")
    en.text = en.published_text = "Nauta does not lend money"
    en.origin = TextValue.Origin.HUMAN
    en.save()
    it = TextValue.objects.get(key__key="fin.note", locale="it")
    it.text = it.published_text = "Nauta non presta denaro"
    it.stale = False
    it.save()
    version = TextRelease.current().version

    services.sync_source({"fin.note": "Nautelo does not lend money"})

    en.refresh_from_db()
    it.refresh_from_db()
    assert en.published_text == "Nautelo does not lend money" and en.origin == "SOURCE"
    assert it.published_text == "Nautelo non presta denaro" and it.stale
    assert TextRelease.current().version == version + 1
    assert "Nauta" not in services.bundle("it")["fin.note"]
