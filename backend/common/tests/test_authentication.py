"""OptionalJWTAuthentication: identify the caller when possible, never 401.

Used by public read endpoints that must distinguish a signed-in viewer from a
guest (spec §19.1's owner/staff/broker exclusions) while remaining open to guests.
"""

import inspect

import pytest
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.test import APIRequestFactory
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.tokens import AccessToken

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from common.authentication import OptionalJWTAuthentication

pytestmark = pytest.mark.django_db


def _request(authorization=None):
    extra = {"HTTP_AUTHORIZATION": authorization} if authorization else {}
    return APIRequestFactory().get("/api/v1/listings/x/", **extra)


def test_no_header_authenticates_nobody_and_raises_nothing():
    assert OptionalJWTAuthentication().authenticate(_request()) is None


def test_a_valid_token_identifies_the_user():
    user = make_user("buyer@example.com", role=UserRole.PRIVATE_SELLER)
    token = AccessToken.for_user(user)

    result = OptionalJWTAuthentication().authenticate(_request(f"Bearer {token}"))

    assert result is not None
    assert result[0] == user


@pytest.mark.parametrize(
    "authorization",
    [
        "Bearer not-a-token",
        "Bearer ",
        "Bearer eyJhbGciOiJIUzI1NiJ9.eyJmb28iOiJiYXIifQ.zzzzzzzzzzzz",
    ],
)
def test_a_broken_token_degrades_to_anonymous_instead_of_401(authorization):
    """Phase 11's reason for authentication_classes = [] on the public read path,
    preserved: "an expired or malformed Authorization header cannot turn a public
    page into a 401"."""
    assert OptionalJWTAuthentication().authenticate(_request(authorization)) is None


def test_a_token_for_a_deleted_user_degrades_to_anonymous():
    user = make_user("gone@example.com", role=UserRole.PRIVATE_SELLER)
    token = str(AccessToken.for_user(user))
    user.delete()

    assert OptionalJWTAuthentication().authenticate(_request(f"Bearer {token}")) is None


def test_it_narrows_its_except_to_authentication_failed():
    """Regression pin: the class must swallow AuthenticationFailed (which covers
    SimpleJWT's InvalidToken), not everything. A bare `except Exception` would
    hide real configuration faults."""
    source = inspect.getsource(OptionalJWTAuthentication)

    assert "except Exception" not in source
    assert "except AuthenticationFailed" in source
    assert issubclass(InvalidToken, AuthenticationFailed)
