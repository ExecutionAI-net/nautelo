from django.conf import settings

REFRESH_COOKIE_NAME = "nauta_refresh"
REFRESH_COOKIE_PATH = "/api/v1/auth/"

# A plain marker, not a credential: readable by frontend JS (unlike the HttpOnly
# refresh cookie above) so the client can tell "never signed in" from "may still have
# a valid refresh cookie" without asking the server. Path "/" so it travels with every
# page, not just /api/v1/auth/ requests. Same lifetime and clearing as the refresh
# cookie, so the two can never disagree about whether a session might exist.
SESSION_HINT_COOKIE_NAME = "nauta_session_hint"
SESSION_HINT_COOKIE_PATH = "/"


def set_refresh_cookie(response, refresh_token: str):
    max_age = int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds())
    response.set_cookie(
        REFRESH_COOKIE_NAME,
        refresh_token,
        max_age=max_age,
        httponly=True,
        secure=settings.REFRESH_COOKIE_SECURE,
        samesite="Lax",
        path=REFRESH_COOKIE_PATH,
    )
    response.set_cookie(
        SESSION_HINT_COOKIE_NAME,
        "1",
        max_age=max_age,
        httponly=False,
        secure=settings.REFRESH_COOKIE_SECURE,
        samesite="Lax",
        path=SESSION_HINT_COOKIE_PATH,
    )
    return response


def clear_refresh_cookie(response):
    response.delete_cookie(REFRESH_COOKIE_NAME, path=REFRESH_COOKIE_PATH)
    response.delete_cookie(SESSION_HINT_COOKIE_NAME, path=SESSION_HINT_COOKIE_PATH)
    return response
