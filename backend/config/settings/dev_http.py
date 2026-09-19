"""Explicit, temporary HTTP deployment mode for dev EC2 IP testing only."""
from django.core.exceptions import ImproperlyConfigured

from .prod import *  # noqa: F401,F403

if env("DEPLOY_ENVIRONMENT", default="") != "dev" or not env.bool("DEPLOY_ALLOW_HTTP", default=False):  # noqa: F405
    raise ImproperlyConfigured("dev_http settings require dev and explicit DEPLOY_ALLOW_HTTP")

# Keep DEBUG=False, explicit hosts, CORS restrictions and all other prod defaults.
SECURE_SSL_REDIRECT = False
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
REFRESH_COOKIE_SECURE = False
SECURE_HSTS_SECONDS = 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = False
SECURE_HSTS_PRELOAD = False
