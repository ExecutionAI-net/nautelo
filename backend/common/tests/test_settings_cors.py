"""Production CORS configuration (spec: credentialed cross-origin frontend).

The frontend runs on its own origin and calls this API with
`credentials: "include"`. A production deployment that emits no
`Access-Control-Allow-Origin` / `-Allow-Credentials` headers has every
login/refresh/session/logout call blocked by the browser, with no server-side
symptom at all - which is exactly why it needs a test rather than a code read.

Settings modules read the environment once, at import time, so the only way to
observe what a *different* environment would produce is to import the module
again under that environment.
"""
import importlib
import sys

import pytest

# `prod` star-imports `base`, so both must be evicted for the re-import to
# re-read the environment.
_SETTINGS_MODULES = ("config.settings.base", "config.settings.prod")


@pytest.fixture
def load_prod_settings(monkeypatch):
    """Import `config.settings.prod` fresh, then put `sys.modules` back as it was.

    The active settings module for the test run is `config.settings.test`, which
    already holds its own copy of base's values, so this neither disturbs nor is
    disturbed by the running test session.
    """

    monkeypatch.setenv("DJANGO_ALLOWED_HOSTS", "api.nauta.example")

    def _load():
        saved = {name: sys.modules.pop(name, None) for name in _SETTINGS_MODULES}
        try:
            return importlib.import_module("config.settings.prod")
        finally:
            for name, module in saved.items():
                if module is None:
                    sys.modules.pop(name, None)
                else:
                    sys.modules[name] = module

    return _load


def test_prod_reads_its_allowed_origins_from_the_environment(load_prod_settings, monkeypatch):
    monkeypatch.setenv(
        "DJANGO_CORS_ALLOWED_ORIGINS",
        "https://app.nauta.example,https://www.nauta.example",
    )

    prod = load_prod_settings()

    assert prod.CORS_ALLOWED_ORIGINS == [
        "https://app.nauta.example",
        "https://www.nauta.example",
    ]


def test_prod_allows_credentialed_cross_origin_requests(load_prod_settings, monkeypatch):
    """Without this the browser drops the response of every cookie-bearing call."""
    monkeypatch.setenv("DJANGO_CORS_ALLOWED_ORIGINS", "https://app.nauta.example")

    prod = load_prod_settings()

    assert prod.CORS_ALLOW_CREDENTIALS is True
    # A wildcard origin is illegal alongside credentials; assert we never ask for one.
    assert prod.CORS_ALLOW_ALL_ORIGINS is False


def test_prod_does_not_fall_back_to_the_dev_localhost_origins(load_prod_settings, monkeypatch):
    monkeypatch.setenv("DJANGO_CORS_ALLOWED_ORIGINS", "https://app.nauta.example")

    prod = load_prod_settings()

    assert not any("localhost" in origin for origin in prod.CORS_ALLOWED_ORIGINS)
