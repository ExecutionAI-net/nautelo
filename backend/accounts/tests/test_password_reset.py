import pytest
from django.core import mail
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import PasswordResetToken
from accounts.tests.factories import make_user

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _commit_now(monkeypatch):
    monkeypatch.setattr("django.db.transaction.on_commit", lambda fn, *a, **k: fn())


def _token_from_mail():
    return mail.outbox[-1].body.split("token=")[1].split()[0]


def test_reset_flow_changes_the_password_once():
    user = make_user()
    client = APIClient()
    assert client.post(reverse("auth-password-reset"), {"email": user.email}, format="json").status_code == 202
    token = _token_from_mail()
    new = "Br4nd-new-pass-77"
    ok = client.post(reverse("auth-password-reset-confirm"), {"token": token, "password": new}, format="json")
    assert ok.status_code == 204
    user.refresh_from_db()
    assert user.check_password(new)
    replay = client.post(reverse("auth-password-reset-confirm"), {"token": token, "password": "Another-pass-88"}, format="json")
    assert replay.status_code == 400
    login = client.post(reverse("auth-login"), {"email": user.email, "password": new}, format="json")
    assert login.status_code == 200


def test_unknown_email_gets_the_same_202_and_no_mail():
    client = APIClient()
    assert client.post(reverse("auth-password-reset"), {"email": "nobody@x.test"}, format="json").status_code == 202
    assert mail.outbox == []


def test_weak_password_is_refused_and_the_token_survives_and_a_new_request_kills_old_tokens():
    user = make_user()
    client = APIClient()
    client.post(reverse("auth-password-reset"), {"email": user.email}, format="json")
    first = _token_from_mail()
    weak = client.post(reverse("auth-password-reset-confirm"), {"token": first, "password": "123"}, format="json")
    assert weak.status_code == 400
    client.post(reverse("auth-password-reset"), {"email": user.email}, format="json")
    stale = client.post(reverse("auth-password-reset-confirm"), {"token": first, "password": "Br4nd-new-pass-77"}, format="json")
    assert stale.status_code == 400
    assert PasswordResetToken.objects.filter(user=user, used_at__isnull=True).count() == 1


def test_a_reset_ends_every_existing_refresh_token():
    from rest_framework_simplejwt.tokens import RefreshToken

    user = make_user()
    old = str(RefreshToken.for_user(user))
    client = APIClient()
    client.post(reverse("auth-password-reset"), {"email": user.email}, format="json")
    client.post(
        reverse("auth-password-reset-confirm"),
        {"token": _token_from_mail(), "password": "Br4nd-new-pass-77"},
        format="json",
    )
    assert client.post(reverse("auth-token-refresh"), {"refresh": old}, format="json").status_code == 401
