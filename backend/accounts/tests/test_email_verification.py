from datetime import timedelta

import pytest
from django.core import mail
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from accounts.models import EmailVerificationToken, User
from accounts.services import (
    consume_email_verification_token,
    issue_email_verification_token,
)
from accounts.tests.factories import make_user

VERIFY_URL = "/api/v1/auth/verify-email/"
RESEND_URL = "/api/v1/auth/resend-verification/"


@pytest.fixture
def api():
    return APIClient()


@pytest.mark.django_db
def test_verifying_with_a_valid_token_sets_email_verified_at(api):
    user = make_user("verify@example.com", verified=False)
    raw = issue_email_verification_token(user)

    response = api.post(VERIFY_URL, {"token": raw}, format="json")

    assert response.status_code == 200
    user.refresh_from_db()
    assert user.is_email_verified is True


@pytest.mark.django_db
def test_a_token_can_only_be_used_once(api):
    user = make_user("once@example.com", verified=False)
    raw = issue_email_verification_token(user)
    api.post(VERIFY_URL, {"token": raw}, format="json")

    response = api.post(VERIFY_URL, {"token": raw}, format="json")

    assert response.status_code == 400
    assert response.data["error"]["fields"]["token"] == ["invalid_verification_token"]


@pytest.mark.django_db
def test_an_expired_token_is_rejected():
    user = make_user("expired@example.com", verified=False)
    raw = issue_email_verification_token(user)
    EmailVerificationToken.objects.filter(user=user).update(
        expires_at=timezone.now() - timedelta(seconds=1)
    )
    with pytest.raises(ValidationError):
        consume_email_verification_token(raw)
    user.refresh_from_db()
    assert user.is_email_verified is False


@pytest.mark.django_db
def test_an_unknown_token_is_rejected(api):
    response = api.post(VERIFY_URL, {"token": "not-a-real-token"}, format="json")
    assert response.status_code == 400


@pytest.mark.django_db
def test_verifying_invalidates_the_users_other_outstanding_tokens():
    user = make_user("multi@example.com", verified=False)
    stale = issue_email_verification_token(user)
    fresh = issue_email_verification_token(user)

    consume_email_verification_token(fresh)

    assert EmailVerificationToken.objects.filter(user=user, used_at__isnull=True).count() == 0
    with pytest.raises(ValidationError):
        consume_email_verification_token(stale)


@pytest.mark.django_db
def test_resend_issues_a_new_token_and_email(api, django_capture_on_commit_callbacks):
    user = make_user("resend@example.com", verified=False)
    mail.outbox.clear()

    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        response = api.post(RESEND_URL, {"email": "resend@example.com"}, format="json")

    assert response.status_code == 202
    assert len(callbacks) == 1
    assert EmailVerificationToken.objects.filter(user=user, used_at__isnull=True).count() == 1
    assert len(mail.outbox) == 1


@pytest.mark.django_db
def test_resend_does_not_disclose_whether_an_account_exists(
    api, django_capture_on_commit_callbacks
):
    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        response = api.post(RESEND_URL, {"email": "nobody@example.com"}, format="json")

    assert response.status_code == 202
    # The load-bearing assertion: nothing was even QUEUED, because the
    # account-exists check short-circuited. Asserting only on mail.outbox would
    # pass vacuously if on_commit callbacks were never executed at all.
    assert callbacks == []
    assert mail.outbox == []


@pytest.mark.django_db
def test_resend_is_a_no_op_for_an_already_verified_account(
    api, django_capture_on_commit_callbacks
):
    make_user("already@example.com", verified=True)
    mail.outbox.clear()

    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        response = api.post(RESEND_URL, {"email": "already@example.com"}, format="json")

    assert response.status_code == 202
    assert callbacks == []  # the already-verified check short-circuits before queuing
    assert mail.outbox == []
