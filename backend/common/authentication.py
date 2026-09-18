"""Authentication classes for endpoints that are public but identity-aware.

A public page must not 401 because someone's access token expired in a background
tab. It must nonetheless know who is looking, when a rule depends on it — spec
§19.1 excludes "the private listing owner", "the owning broker organization" and
"staff" from view counting, and none of those is decidable against AnonymousUser.
"""

from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication


class OptionalJWTAuthentication(JWTAuthentication):
    """Identify the caller when the credential is good; otherwise stay anonymous.

    The `except` is narrowed to AuthenticationFailed on purpose. SimpleJWT's
    InvalidToken and TokenError-derived failures are subclasses of it, so every
    bad-credential case is covered — while a genuine misconfiguration (a missing
    signing key, an unimportable user model) still raises and is still visible.
    A catch-all handler here would silently turn "auth is broken in
    production" into "everyone is a guest".

    This class grants nothing. `permission_classes` still decides access; all this
    does is populate `request.user` when it honestly can.
    """

    def authenticate(self, request):
        try:
            return super().authenticate(request)
        except AuthenticationFailed:
            return None
