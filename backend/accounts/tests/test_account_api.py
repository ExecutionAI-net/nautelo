import pytest
from rest_framework.test import APIClient

from accounts.enums import Locale, UserRole
from accounts.tests.factories import DEFAULT_TEST_PASSWORD, make_user

ACCOUNT_URL = "/api/v1/account/"
LOGIN_URL = "/api/v1/auth/login/"


@pytest.fixture
def api():
    return APIClient()


def _authenticate(api, user):
    response = api.post(
        LOGIN_URL, {"email": user.email, "password": DEFAULT_TEST_PASSWORD}, format="json"
    )
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
    return api


@pytest.mark.django_db
def test_a_guest_cannot_read_an_account(api):
    response = api.get(ACCOUNT_URL)
    assert response.status_code == 401
    assert response.data["error"]["code"] == "not_authenticated"


@pytest.mark.django_db
def test_a_user_reads_their_own_account(api):
    user = make_user("me@example.com", full_name="Me Myself", role=UserRole.PRIVATE_SELLER)
    _authenticate(api, user)

    response = api.get(ACCOUNT_URL)

    assert response.status_code == 200
    assert response.data["id"] == str(user.pk)
    assert response.data["full_name"] == "Me Myself"
    assert response.data["primary_role"] == UserRole.PRIVATE_SELLER
    assert response.data["phone_number"] == ""
    assert "password" not in response.data


@pytest.mark.django_db
def test_a_user_can_update_their_name_and_locale(api):
    user = make_user("edit@example.com")
    _authenticate(api, user)

    response = api.patch(
        ACCOUNT_URL, {"full_name": "Nuevo Nombre", "locale": Locale.ES}, format="json"
    )

    assert response.status_code == 200
    user.refresh_from_db()
    assert user.full_name == "Nuevo Nombre"
    assert user.locale == Locale.ES


@pytest.mark.django_db
@pytest.mark.parametrize("role", [UserRole.PRIVATE_SELLER, UserRole.BROKER, UserRole.PROFESSIONAL])
def test_a_user_can_add_a_personal_phone_number_regardless_of_role(api, role):
    user = make_user(f"phone-{role.lower()}@example.com", role=role)
    _authenticate(api, user)

    response = api.patch(ACCOUNT_URL, {"phone_number": "+34 600 000 000"}, format="json")

    assert response.status_code == 200
    assert response.data["phone_number"] == "+34 600 000 000"
    user.refresh_from_db()
    assert user.phone_number == "+34 600 000 000"


@pytest.mark.django_db
def test_privileged_and_identity_fields_are_read_only(api):
    user = make_user("escalate@example.com", role=UserRole.PRIVATE_SELLER)
    _authenticate(api, user)

    api.patch(
        ACCOUNT_URL,
        {
            "email": "someone.else@example.com",
            "primary_role": UserRole.STAFF,
            "is_active": False,
            "email_verified": False,
        },
        format="json",
    )

    user.refresh_from_db()
    assert user.email == "escalate@example.com"
    assert user.primary_role == UserRole.PRIVATE_SELLER
    assert user.is_active is True
    assert user.is_email_verified is True


@pytest.mark.django_db
def test_an_invalid_locale_is_rejected(api):
    _authenticate(api, make_user("loc@example.com"))
    response = api.patch(ACCOUNT_URL, {"locale": "DE"}, format="json")
    assert response.status_code == 400
    assert "locale" in response.data["error"]["fields"]
