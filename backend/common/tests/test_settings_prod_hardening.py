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


def test_s3_can_use_instance_role_without_static_keys_or_endpoint(monkeypatch):
    monkeypatch.setenv("DJANGO_ALLOWED_HOSTS", "api.nauta.example")
    for key in ("OBJECT_STORAGE_ACCESS_KEY", "OBJECT_STORAGE_SECRET_KEY", "OBJECT_STORAGE_ENDPOINT_URL"):
        monkeypatch.delenv(key, raising=False)
    # Do not let a local development .env reintroduce MinIO credentials.
    monkeypatch.setattr("environ.Env.read_env", lambda *args, **kwargs: None)
    prod = _load_prod()
    assert prod.AWS_ACCESS_KEY_ID is None
    assert prod.AWS_SECRET_ACCESS_KEY is None
    assert prod.AWS_S3_ENDPOINT_URL is None
    assert prod.AWS_S3_ADDRESSING_STYLE == "virtual"
    assert prod.AWS_S3_SIGNATURE_VERSION == "s3v4"
