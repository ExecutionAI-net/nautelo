from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import NotAuthenticated, PermissionDenied, ValidationError
from rest_framework.test import APIRequestFactory
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.tokens import AccessToken

from common.exceptions import nauta_exception_handler


def _context():
    request = APIRequestFactory().get("/api/v1/session/")
    request.request_id = "req-test-1"
    return {"request": request}


def test_permission_denied_uses_the_envelope():
    response = nauta_exception_handler(PermissionDenied(), _context())
    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.data == {
        "error": {
            "code": "permission_denied",
            "message": "You do not have permission to perform this action.",
            "fields": {},
            "request_id": "req-test-1",
        }
    }


def test_explicit_code_is_preserved():
    exc = PermissionDenied(detail="Verify your email first.", code="email_not_verified")
    response = nauta_exception_handler(exc, _context())
    assert response.data["error"]["code"] == "email_not_verified"
    assert response.data["error"]["message"] == "Verify your email first."


def test_not_authenticated_is_401_with_stable_code():
    response = nauta_exception_handler(NotAuthenticated(), _context())
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.data["error"]["code"] == "not_authenticated"


def test_validation_error_maps_fields():
    exc = ValidationError({"email": ["This field is required."]})
    response = nauta_exception_handler(exc, _context())
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.data["error"]["code"] == "validation_error"
    assert response.data["error"]["fields"] == {"email": ["This field is required."]}


def test_dict_keyed_non_field_errors_are_preserved_under_the_validation_error_code():
    # Every ValidationError carries the stable code `validation_error` regardless of
    # its shape; what varies - and what this asserts - is the `fields` map.
    exc = ValidationError({"non_field_errors": ["Bad credentials."]})
    response = nauta_exception_handler(exc, _context())
    assert response.data["error"]["code"] == "validation_error"
    assert response.data["error"]["fields"] == {"non_field_errors": ["Bad credentials."]}


def test_string_validation_error_is_mapped_to_non_field_errors():
    # `raise ValidationError("...")` inside a validate() method must not be swallowed.
    response = nauta_exception_handler(ValidationError("Passwords do not match."), _context())
    assert response.data["error"]["fields"] == {
        "non_field_errors": ["Passwords do not match."]
    }


def test_list_validation_error_is_mapped_to_non_field_errors():
    response = nauta_exception_handler(ValidationError(["First problem.", "Second."]), _context())
    assert response.data["error"]["fields"] == {
        "non_field_errors": ["First problem.", "Second."]
    }


def test_expired_jwt_yields_a_clean_message_not_a_python_repr():
    """The most frequent error in the product: a real, genuinely expired access token.

    Deliberately NOT mocked - the whole point is that SimpleJWT's real exception
    carries a dict `detail`, which a naive `str(detail)` would leak as a repr.
    """
    token = AccessToken()
    token.set_exp(from_time=timezone.now() - timedelta(hours=2), lifetime=timedelta(minutes=15))
    expired = str(token)

    with pytest.raises(InvalidToken) as excinfo:
        JWTAuthentication().get_validated_token(expired)
    assert isinstance(excinfo.value.detail, dict)  # documents WHY this test exists

    response = nauta_exception_handler(excinfo.value, _context())
    message = response.data["error"]["message"]

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.data["error"]["code"] == "token_not_valid"
    assert isinstance(message, str) and message
    # A human sentence, not a serialized Python structure.
    assert "ErrorDetail" not in message
    assert "{" not in message
    assert "code=" not in message


def test_unhandled_exception_returns_none_so_django_handles_it():
    assert nauta_exception_handler(RuntimeError("boom"), _context()) is None
