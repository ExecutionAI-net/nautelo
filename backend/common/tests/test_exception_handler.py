import uuid
from datetime import timedelta

import pytest
from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.http import Http404
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import ErrorDetail, NotAuthenticated, PermissionDenied, ValidationError
from rest_framework.test import APIClient, APIRequestFactory
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.tokens import AccessToken

from accounts.enums import UserRole
from accounts.tests.factories import DEFAULT_TEST_PASSWORD, make_user
from brokers.enums import BrokerMembershipRole
from brokers.tests.factories import make_broker, make_membership
from common.exceptions import GENERIC_ERROR_MESSAGE, nauta_exception_handler


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
    assert response.data["error"]["fields"] == {
        "email": [{"message": "This field is required.", "code": "invalid"}]
    }


def test_field_error_code_survives_into_the_envelope():
    """ErrorDetail is a str subclass carrying `.code`; a bare `str(item)` on it
    (the previous behavior) silently threw the code away, breaking spec §30.2's
    promise of "a stable machine code" for every field-level error, not just the
    top-level one. Each `fields` entry must now carry both the message and the
    code, not just the message.
    """
    exc = ValidationError(
        {
            "token": [
                ErrorDetail("Verification link expired.", code="invalid_verification_token")
            ]
        }
    )
    response = nauta_exception_handler(exc, _context())
    assert response.data["error"]["fields"] == {
        "token": [{"message": "Verification link expired.", "code": "invalid_verification_token"}]
    }


def test_dict_keyed_non_field_errors_are_preserved_under_the_validation_error_code():
    # Every ValidationError carries the stable code `validation_error` regardless of
    # its shape; what varies - and what this asserts - is the `fields` map.
    exc = ValidationError({"non_field_errors": ["Bad credentials."]})
    response = nauta_exception_handler(exc, _context())
    assert response.data["error"]["code"] == "validation_error"
    assert response.data["error"]["fields"] == {
        "non_field_errors": [{"message": "Bad credentials.", "code": "invalid"}]
    }


def test_string_validation_error_is_mapped_to_non_field_errors():
    # `raise ValidationError("...")` inside a validate() method must not be swallowed.
    response = nauta_exception_handler(ValidationError("Passwords do not match."), _context())
    assert response.data["error"]["fields"] == {
        "non_field_errors": [{"message": "Passwords do not match.", "code": "invalid"}]
    }


def test_list_validation_error_is_mapped_to_non_field_errors():
    response = nauta_exception_handler(ValidationError(["First problem.", "Second."]), _context())
    assert response.data["error"]["fields"] == {
        "non_field_errors": [
            {"message": "First problem.", "code": "invalid"},
            {"message": "Second.", "code": "invalid"},
        ]
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


def test_django_http404_is_normalized_to_the_not_found_code():
    """`get_object_or_404` raises Django's Http404, not DRF's NotFound.

    DRF rebinds the two only inside its own handler's local scope, so without an
    explicit normalization step this handler sees a bare `Http404` - no `.detail`,
    no `.default_code` - and falls all the way through to the generic envelope.
    """
    response = nauta_exception_handler(Http404("No BoatListing matches the given query."), _context())

    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert response.data["error"]["code"] == "not_found"
    assert response.data["error"]["message"] == "Not found."
    assert response.data["error"]["fields"] == {}


def test_http404_does_not_leak_the_internal_model_name():
    """Django builds the message from the model class; clients must not see it."""
    response = nauta_exception_handler(Http404("No BrokerOrganization matches the given query."), _context())

    assert "BrokerOrganization" not in response.data["error"]["message"]


def test_django_core_permission_denied_is_normalized():
    """Django's own PermissionDenied (middleware, decorators, admin) is not DRF's."""
    response = nauta_exception_handler(DjangoPermissionDenied("nope"), _context())

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.data["error"]["code"] == "permission_denied"
    assert response.data["error"]["message"] == "You do not have permission to perform this action."


@pytest.mark.django_db
def test_a_real_view_404_renders_the_not_found_envelope():
    """End-to-end: a genuine `get_object_or_404` miss inside a real view.

    The team-manager permission passes (the broker exists and the caller manages
    it), so the request reaches `get_membership`, whose `get_object_or_404` raises
    Http404 for real. Before the normalization this returned
    `code: "error"` / "Request failed.", which the frontend cannot branch on.
    """
    broker = make_broker()
    admin = make_user("envelope.admin@example.com", role=UserRole.BROKER)
    make_membership(admin, broker, role=BrokerMembershipRole.ADMIN)

    api = APIClient()
    login = api.post(
        "/api/v1/auth/login/",
        {"email": admin.email, "password": DEFAULT_TEST_PASSWORD},
        format="json",
    )
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")

    response = api.patch(
        f"/api/v1/brokers/{broker.pk}/members/{uuid.uuid4()}/",
        {"can_edit_listings": False},
        format="json",
    )

    assert response.status_code == 404
    assert response.data["error"]["code"] == "not_found"
    assert response.data["error"]["message"] != GENERIC_ERROR_MESSAGE
    assert "not found" in response.data["error"]["message"].lower()
    assert response.data["error"]["fields"] == {}
    assert "request_id" in response.data["error"]
