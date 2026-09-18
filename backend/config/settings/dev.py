from .base import *  # noqa: F401,F403

DEBUG = True
CORS_ALLOWED_ORIGINS = ["http://localhost:3020", "http://127.0.0.1:3020"]
CORS_ALLOW_CREDENTIALS = True
# Dev is served over plain http://localhost, where a Secure cookie is never sent.
# This is the ONLY environment that opts out; base.py's default is True.
REFRESH_COOKIE_SECURE = False
