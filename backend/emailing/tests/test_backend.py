import pytest
from django.core.mail import EmailMultiAlternatives

from emailing.backend import ZeptoMailBackend


class _FakeResponse:
    def __init__(self, status_code=200):
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            raise Exception(f"HTTP {self.status_code}")


def _message(**overrides):
    kwargs = {
        "subject": "Hello",
        "body": "plain text body",
        "from_email": "noreply@nautelo.com",
        "to": ["buyer@example.com"],
    }
    kwargs.update(overrides)
    return EmailMultiAlternatives(**kwargs)


def test_sends_one_request_per_message_and_reports_the_count(settings, monkeypatch):
    settings.ZEPTOMAIL_API_KEY = "Zoho-enczapikey test-key"
    settings.ZEPTOMAIL_API_URL = "https://api.zeptomail.eu/v1.1/email"
    calls = []

    def fake_post(url, json, headers, timeout):
        calls.append((url, json, headers, timeout))
        return _FakeResponse(200)

    monkeypatch.setattr("emailing.backend.requests.post", fake_post)

    sent = ZeptoMailBackend().send_messages([_message(), _message()])

    assert sent == 2
    assert len(calls) == 2
    url, payload, headers, _timeout = calls[0]
    assert url == "https://api.zeptomail.eu/v1.1/email"
    assert headers["Authorization"] == "Zoho-enczapikey test-key"
    assert payload["from"] == {"address": "noreply@nautelo.com"}
    assert payload["to"] == [{"email_address": {"address": "buyer@example.com"}}]
    assert payload["subject"] == "Hello"
    assert payload["textbody"] == "plain text body"
    assert "htmlbody" not in payload


def test_a_raw_key_without_the_scheme_prefix_gets_it_added(settings, monkeypatch):
    """ZeptoMail's API 401s without the "Zoho-enczapikey" scheme prefix on the
    token. The console's own copy button includes it, but a secret stored as
    just the raw token (the more natural thing to put in an env var) must
    still work."""
    settings.ZEPTOMAIL_API_KEY = "raw-token-without-prefix"
    calls = []

    def fake_post(url, json, headers, timeout):
        calls.append(headers)
        return _FakeResponse(200)

    monkeypatch.setattr("emailing.backend.requests.post", fake_post)

    ZeptoMailBackend().send_messages([_message()])

    assert calls[0]["Authorization"] == "Zoho-enczapikey raw-token-without-prefix"


def test_attaches_the_html_alternative_when_present(monkeypatch):
    captured = {}

    def fake_post(url, json, headers, timeout):
        captured.update(json)
        return _FakeResponse(200)

    monkeypatch.setattr("emailing.backend.requests.post", fake_post)

    message = _message()
    message.attach_alternative("<p>hi</p>", "text/html")

    ZeptoMailBackend().send_messages([message])

    assert captured["htmlbody"] == "<p>hi</p>"


def test_a_failed_request_does_not_raise_when_fail_silently(monkeypatch):
    import requests

    def fake_post(*args, **kwargs):
        raise requests.RequestException("boom")

    monkeypatch.setattr("emailing.backend.requests.post", fake_post)

    sent = ZeptoMailBackend(fail_silently=True).send_messages([_message()])

    assert sent == 0


def test_a_failed_request_raises_when_not_fail_silently(monkeypatch):
    import requests

    def fake_post(*args, **kwargs):
        raise requests.RequestException("boom")

    monkeypatch.setattr("emailing.backend.requests.post", fake_post)

    with pytest.raises(requests.RequestException):
        ZeptoMailBackend(fail_silently=False).send_messages([_message()])


def test_an_error_status_raises_with_the_provider_body_and_logs_it(monkeypatch, caplog):
    from emailing.backend import ZeptoMailError

    class _Rejected(_FakeResponse):
        text = '{"error":{"code":"TM_4001","message":"Sender domain not verified"}}'

    monkeypatch.setattr("emailing.backend.requests.post", lambda *a, **k: _Rejected(status_code=400))

    with pytest.raises(ZeptoMailError) as excinfo:
        ZeptoMailBackend(fail_silently=False).send_messages([_message()])

    assert excinfo.value.status_code == 400
    assert "Sender domain not verified" in str(excinfo.value)
    assert "Sender domain not verified" in caplog.text
