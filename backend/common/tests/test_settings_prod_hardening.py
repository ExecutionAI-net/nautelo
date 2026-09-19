"""Production settings fail closed and set the transport-security headers."""
import importlib
import sys

import pytest
from django.core.exceptions import ImproperlyConfigured

_MODULES = ("config.settings.base", "config.settings.prod")


def _load_prod():
    saved = {name: sys.modules.pop(name, None) for name in _MODULES}
    try:
        return importlib.import_module("config.settings.prod")
    finally:
        for name, module in saved.items():
            if module is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = module


@pytest.mark.parametrize("hosts", ["", "*", "api.nauta.example,*"])
def test_prod_refuses_missing_or_wildcard_allowed_hosts(monkeypatch, hosts):
    monkeypatch.setenv("DJANGO_ALLOWED_HOSTS", hosts)
    with pytest.raises(ImproperlyConfigured):
        _load_prod()


def test_prod_sets_hsts_proxy_and_framing_protections(monkeypatch):
    monkeypatch.setenv("DJANGO_ALLOWED_HOSTS", "api.nauta.example")
    prod = _load_prod()
    assert prod.DEBUG is False
    assert prod.SECURE_HSTS_SECONDS >= 31_536_000
    assert prod.SECURE_PROXY_SSL_HEADER == ("HTTP_X_FORWARDED_PROTO", "https")
    assert prod.X_FRAME_OPTIONS == "DENY"
    assert prod.SECURE_CONTENT_TYPE_NOSNIFF is True


def test_wsgi_and_asgi_default_to_production_settings():
    from pathlib import Path

    root = Path(__file__).resolve().parents[2] / "config"
    for name in ("wsgi.py", "asgi.py"):
        text = (root / name).read_text(encoding="utf8")
        assert "config.settings.prod" in text and "config.settings.dev" not in text
