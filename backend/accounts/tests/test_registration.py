import pytest
from django.core import mail
from rest_framework.test import APIClient

from accounts.enums import Locale, UserRole
from accounts.models import EmailVerificationToken, User
from accounts.tests.factories import make_user

REGISTER_URL = "/api/v1/auth/register/"
VALID_PASSWORD = "n4uta-test-Passw0rd"


@pytest.fixture
def api():
    return APIClient()


@pytest.mark.django_db
def test_registration_creates_an_unverified_active_buyer(api):
    response = api.post(
        REGISTER_URL,
        {"email": "New.User@Example.com", "password": VALID_PASSWORD, "full_name": "New User"},
        format="json",
    )
    assert response.status_code == 201
    user = User.objects.get(email="new.user@example.com")
    assert user.is_active is True
    assert user.is_email_verified is False
    assert user.primary_role == UserRole.BUYER
    assert user.locale == Locale.EN
    assert response.data["email"] == "new.user@example.com"
    assert "password" not in response.data


@pytest.mark.django_db
def test_registration_sends_one_verification_email_and_stores_only_a_hash(
    api, django_capture_on_commit_callbacks
):
    # register_user() queues the send with transaction.on_commit(). Inside a
    # @pytest.mark.django_db test nothing ever really commits, so without this
    # fixture the callback would never run and mail.outbox would stay empty.
    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        api.post(
            REGISTER_URL,
            {"email": "hash@example.com", "password": VALID_PASSWORD},
            format="json",
        )

    assert len(callbacks) == 1  # exactly one queued send - not zero, not two
    token = EmailVerificationToken.objects.get(user__email="hash@example.com")
    assert len(mail.outbox) == 1
    assert len(token.token_hash) == 64
    assert token.token_hash not in mail.outbox[0].body


@pytest.mark.django_db
def test_registration_accepts_only_self_service_roles(api):
    ok = api.post(
        REGISTER_URL,
        {"email": "seller@example.com", "password": VALID_PASSWORD, "primary_role": "PRIVATE_SELLER"},
        format="json",
    )
    assert ok.status_code == 201
    assert User.objects.get(email="seller@example.com").primary_role == UserRole.PRIVATE_SELLER


@pytest.mark.django_db
@pytest.mark.parametrize("forbidden_role", ["STAFF", "BROKER"])
def test_registration_rejects_privileged_roles(api, forbidden_role):
    response = api.post(
        REGISTER_URL,
        {"email": f"{forbidden_role.lower()}@example.com", "password": VALID_PASSWORD,
         "primary_role": forbidden_role},
        format="json",
    )
    assert response.status_code == 400
    assert response.data["error"]["code"] == "validation_error"
    assert "primary_role" in response.data["error"]["fields"]
    assert not User.objects.filter(email=f"{forbidden_role.lower()}@example.com").exists()


@pytest.mark.django_db
def test_registration_rejects_a_weak_password(api):
    response = api.post(
        REGISTER_URL, {"email": "weak@example.com", "password": "pass"}, format="json"
    )
    assert response.status_code == 400
    assert "password" in response.data["error"]["fields"]


@pytest.mark.django_db
def test_registration_rejects_a_duplicate_email_case_insensitively(api):
    make_user("taken@example.com")
    response = api.post(
        REGISTER_URL, {"email": "TAKEN@example.com", "password": VALID_PASSWORD}, format="json"
    )
    assert response.status_code == 400
    assert "email" in response.data["error"]["fields"]


@pytest.mark.django_db
def test_registration_cannot_set_verification_or_staff_flags(api):
    api.post(
        REGISTER_URL,
        {"email": "sneaky@example.com", "password": VALID_PASSWORD,
         "is_staff": True, "is_superuser": True, "email_verified_at": "2020-01-01T00:00:00Z"},
        format="json",
    )
    user = User.objects.get(email="sneaky@example.com")
    assert user.is_staff is False
    assert user.is_superuser is False
    assert user.is_email_verified is False
