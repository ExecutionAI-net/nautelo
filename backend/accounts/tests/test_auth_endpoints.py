import pytest
from rest_framework.test import APIClient, APIRequestFactory
from rest_framework_simplejwt.authentication import JWTAuthentication

from accounts.cookies import REFRESH_COOKIE_NAME
from accounts.tests.factories import DEFAULT_TEST_PASSWORD, make_user

LOGIN_URL = "/api/v1/auth/login/"
REFRESH_URL = "/api/v1/auth/token/refresh/"
LOGOUT_URL = "/api/v1/auth/logout/"
ACCOUNT_URL = "/api/v1/account/"


@pytest.fixture
def api():
    return APIClient()


@pytest.mark.django_db
def test_login_returns_an_access_token_and_the_user_summary(api):
    make_user("login@example.com", full_name="Log In")

    response = api.post(
        LOGIN_URL, {"email": "login@example.com", "password": DEFAULT_TEST_PASSWORD}, format="json"
    )

    assert response.status_code == 200
    assert response.data["access"]
    assert response.data["user"]["email"] == "login@example.com"
    assert response.data["user"]["email_verified"] is True


@pytest.mark.django_db
def test_login_never_puts_the_refresh_token_in_the_body(api):
    make_user("cookie@example.com")
    response = api.post(
        LOGIN_URL, {"email": "cookie@example.com", "password": DEFAULT_TEST_PASSWORD}, format="json"
    )
    assert "refresh" not in response.data
    cookie = response.cookies[REFRESH_COOKIE_NAME]
    assert cookie["httponly"] is True
    assert cookie["samesite"] == "Lax"
    assert cookie["path"] == "/api/v1/auth/"


@pytest.mark.django_db
def test_login_refresh_cookie_is_marked_secure(api):
    """REFRESH_COOKIE_SECURE is an explicit setting, not `not DEBUG`.

    config/settings/test.py inherits base.py's fail-closed default of True, so
    this catches a regression to an implicitly-derived (or forgotten) flag.
    """
    make_user("secureflag@example.com")
    response = api.post(
        LOGIN_URL,
        {"email": "secureflag@example.com", "password": DEFAULT_TEST_PASSWORD},
        format="json",
    )
    assert response.cookies[REFRESH_COOKIE_NAME]["secure"] is True


@pytest.mark.django_db
def test_login_is_case_insensitive_on_email(api):
    make_user("case@example.com")
    response = api.post(
        LOGIN_URL, {"email": "CASE@Example.com", "password": DEFAULT_TEST_PASSWORD}, format="json"
    )
    assert response.status_code == 200


@pytest.mark.django_db
def test_login_with_a_wrong_password_is_401_with_a_stable_code(api):
    make_user("wrong@example.com")
    response = api.post(
        LOGIN_URL, {"email": "wrong@example.com", "password": "not-the-password"}, format="json"
    )
    assert response.status_code == 401
    assert response.data["error"]["code"] == "no_active_account"


@pytest.mark.django_db
def test_an_inactive_user_cannot_log_in(api):
    make_user("inactive@example.com", is_active=False)
    response = api.post(
        LOGIN_URL, {"email": "inactive@example.com", "password": DEFAULT_TEST_PASSWORD},
        format="json",
    )
    assert response.status_code == 401


@pytest.mark.django_db
def test_an_unverified_user_can_still_log_in(api):
    """Verification gates actions, not authentication (spec 1 + 12)."""
    make_user("unverified@example.com", verified=False)
    response = api.post(
        LOGIN_URL, {"email": "unverified@example.com", "password": DEFAULT_TEST_PASSWORD},
        format="json",
    )
    assert response.status_code == 200
    assert response.data["user"]["email_verified"] is False


@pytest.mark.django_db
def test_refresh_uses_the_cookie_and_rotates_it(api):
    make_user("refresh@example.com")
    login = api.post(
        LOGIN_URL, {"email": "refresh@example.com", "password": DEFAULT_TEST_PASSWORD},
        format="json",
    )
    original_cookie = login.cookies[REFRESH_COOKIE_NAME].value

    response = api.post(REFRESH_URL, {}, format="json")

    assert response.status_code == 200
    assert response.data["access"]
    assert "refresh" not in response.data
    assert response.cookies[REFRESH_COOKIE_NAME].value != original_cookie


@pytest.mark.django_db
def test_refresh_without_a_cookie_is_401(api):
    response = api.post(REFRESH_URL, {}, format="json")
    assert response.status_code == 401
    assert response.data["error"]["code"] == "token_not_valid"


@pytest.mark.django_db
def test_refresh_with_a_non_string_refresh_field_is_400_validation_error(api):
    """The JSON-*type* boundary, not the JWT-*format* boundary.

    Three distinct failures must keep three distinct statuses:
      - no credential at all            -> 401 token_not_valid (asserted above)
      - a malformed JWT *string*        -> 401 token_not_valid (asserted below)
      - `refresh` that is not a string  -> 400 validation_error (asserted here)
    Only the last one is a malformed *payload*. SimpleJWT's
    `TokenRefreshSerializer.refresh` is a plain, required, non-blank `CharField`,
    so a list fails DRF's own type check before any token parsing happens, and
    the Task-2 envelope renders it as 400. None of the three may drift into
    another's case.
    """
    response = api.post(REFRESH_URL, {"refresh": ["not", "a", "string"]}, format="json")
    assert response.status_code == 400
    assert response.data["error"]["code"] == "validation_error"


@pytest.mark.django_db
def test_refresh_with_a_malformed_jwt_string_is_401(api):
    """A syntactically invalid token string is an auth failure, not a payload error."""
    response = api.post(REFRESH_URL, {"refresh": "total-garbage-not-a-jwt"}, format="json")
    assert response.status_code == 401
    assert response.data["error"]["code"] == "token_not_valid"


@pytest.mark.django_db
def test_refresh_accepts_a_form_encoded_body_token(api):
    """Non-browser clients may post `refresh` as a form field, not just JSON.

    For a form-encoded body `request.data` is an immutable `QueryDict`, whose
    `dict()` copy wraps every value in a LIST - so a valid token read that way
    reaches the serializer as `["<jwt>"]` and is rejected with 400 "Not a valid
    string.". The view must pull the scalar out with `.get()` instead. No cookie
    is sent here, so the body is the only credential in play.
    """
    make_user("formpost@example.com")
    login = api.post(
        LOGIN_URL, {"email": "formpost@example.com", "password": DEFAULT_TEST_PASSWORD},
        format="json",
    )
    token = login.cookies[REFRESH_COOKIE_NAME].value
    api.cookies.pop(REFRESH_COOKIE_NAME, None)

    response = api.post(REFRESH_URL, {"refresh": token}, format="multipart")

    assert response.status_code == 200
    assert response.data["access"]
    assert "refresh" not in response.data
    assert response.cookies[REFRESH_COOKIE_NAME].value != token


@pytest.mark.django_db
@pytest.mark.parametrize("url", [REFRESH_URL, LOGOUT_URL])
def test_a_non_mapping_json_body_does_not_crash_the_auth_endpoints(api, url):
    """A JSON body need not be an object, and a list has no `.get()`.

    Reading `refresh` straight off `request.data` raises an uncaught
    AttributeError for a top-level JSON array, which DRF's handler cannot render
    - the client gets a bare 500 with no spec 30.2 envelope. A non-mapping body
    simply carries no refresh token, so it must be treated as absent: 401 for
    refresh (a missing credential) and 204 for logout (already signed out).
    """
    response = api.post(url, [1, 2], format="json")

    assert response.status_code != 500
    if url == REFRESH_URL:
        assert response.status_code == 401
        assert response.data["error"]["code"] == "token_not_valid"
    else:
        assert response.status_code == 204


@pytest.mark.django_db
def test_logout_blacklists_the_refresh_token_and_clears_the_cookie(api):
    make_user("logout@example.com")
    login = api.post(
        LOGIN_URL, {"email": "logout@example.com", "password": DEFAULT_TEST_PASSWORD}, format="json"
    )
    # Capture the REAL token value BEFORE logout deletes the cookie. Replaying
    # whatever the cookie jar holds AFTER logout would replay an empty string and
    # only prove "an empty token is rejected" - which says nothing about blacklisting.
    saved_refresh_token = login.cookies[REFRESH_COOKIE_NAME].value
    assert saved_refresh_token  # guard: the test is meaningless without a real value

    logout = api.post(LOGOUT_URL, {}, format="json")
    assert logout.status_code == 204
    assert logout.cookies[REFRESH_COOKIE_NAME].value == ""

    # Replay the SAVED, previously-valid token explicitly. It must be refused
    # because logout blacklisted that specific token, not because it is blank.
    replay = api.post(REFRESH_URL, {"refresh": saved_refresh_token}, format="json")
    assert replay.status_code == 401
    assert replay.data["error"]["code"] == "token_not_valid"

    # Separately: with no cookie and no body at all, the result is also 401 (not 400).
    api.cookies.pop(REFRESH_COOKIE_NAME, None)
    bare = api.post(REFRESH_URL, {}, format="json")
    assert bare.status_code == 401
    assert bare.data["error"]["code"] == "token_not_valid"


@pytest.mark.django_db
def test_a_rotated_refresh_token_cannot_be_replayed(api):
    make_user("replay@example.com")
    login = api.post(
        LOGIN_URL, {"email": "replay@example.com", "password": DEFAULT_TEST_PASSWORD}, format="json"
    )
    first = login.cookies[REFRESH_COOKIE_NAME].value
    api.post(REFRESH_URL, {}, format="json")

    response = api.post(REFRESH_URL, {"refresh": first}, format="json")

    assert response.status_code == 401


@pytest.mark.django_db
def test_the_issued_access_token_authenticates_a_real_request(api):
    """Task 4's OWN proof that login produces a usable credential.

    The `/api/v1/account/` test below is xfailed until Task 9 ships that endpoint,
    which would otherwise leave this task claiming "login works" with nothing
    proving it. This drives SimpleJWT's real authentication class over a real
    request carrying the real Authorization header - no mocks, no stubs.
    """
    user = make_user("bearer@example.com")
    login = api.post(
        LOGIN_URL, {"email": "bearer@example.com", "password": DEFAULT_TEST_PASSWORD}, format="json"
    )
    access = login.data["access"]

    request = APIRequestFactory().get(
        "/api/v1/anything/", HTTP_AUTHORIZATION=f"Bearer {access}"
    )
    authenticated_user, validated_token = JWTAuthentication().authenticate(request)

    assert authenticated_user.pk == user.pk
    assert authenticated_user.is_authenticated is True
    # Spec 2.2 / the "token contents" note: the token carries user_id and nothing else.
    assert validated_token["user_id"] == str(user.pk)
    assert "primary_role" not in validated_token
    assert "permissions" not in validated_token


@pytest.mark.xfail(reason="GET /api/v1/account/ arrives in Task 9", strict=True)
@pytest.mark.django_db
def test_access_token_authenticates_a_protected_endpoint(api):
    make_user("bearer2@example.com")
    login = api.post(
        LOGIN_URL, {"email": "bearer2@example.com", "password": DEFAULT_TEST_PASSWORD}, format="json"
    )
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")

    response = api.get(ACCOUNT_URL)

    assert response.status_code == 200
    assert response.data["email"] == "bearer2@example.com"


@pytest.mark.django_db
def test_login_is_rate_limited(api):
    make_user("throttle@example.com")
    payload = {"email": "throttle@example.com", "password": "wrong-password-value"}
    for _ in range(10):
        api.post(LOGIN_URL, payload, format="json")

    response = api.post(LOGIN_URL, payload, format="json")

    assert response.status_code == 429
    assert response.data["error"]["code"] == "throttled"


@pytest.mark.django_db
def test_silent_refresh_does_not_consume_the_login_throttle_budget(api):
    """Refresh runs on every page load; it must not be able to lock out logins.

    Proves the `auth-refresh` scope is genuinely separate from `auth`.
    """
    credentials = {"email": "budget@example.com", "password": DEFAULT_TEST_PASSWORD}
    make_user("budget@example.com")
    assert api.post(LOGIN_URL, credentials, format="json").status_code == 200

    for _ in range(12):  # comfortably past the `auth` scope's 10/min
        assert api.post(REFRESH_URL, {}, format="json").status_code == 200

    assert api.post(LOGIN_URL, credentials, format="json").status_code == 200
