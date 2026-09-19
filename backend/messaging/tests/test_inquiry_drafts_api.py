"""Spec 15.2: "preserve non-sensitive draft fields in a short-lived signed
session" and "Do not send an inquiry automatically after login"."""

import pytest
from django.core import signing
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.tests.factories import make_user
from messaging.models import Conversation, Message
from professionals.tests.factories import make_professional

pytestmark = pytest.mark.django_db


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def professional():
    owner = make_user(email="draft-pro-owner@phase6.example")
    return make_professional(
        owner, display_name="Phase6 Draft Pro", slug="phase6-draft-pro"
    )


def _draft_body(professional):
    return {
        "context_type": "PROFESSIONAL",
        "context_id": str(professional.pk),
        "full_name": "Ada Rossi",
        "phone": "+390000000000",
        "subject": "Question about the survey",
        "message": "I would like to arrange a viewing next week please.",
    }


def test_a_guest_can_store_a_draft_without_authenticating(api, professional):
    response = api.post(
        reverse("inquiry-draft-create"), _draft_body(professional), format="json"
    )
    assert response.status_code == 201
    assert response.data["expires_in"] == 1800
    assert isinstance(response.data["draft_token"], str)
    # Storing a draft is not sending a message.
    assert Conversation.objects.count() == 0
    assert Message.objects.count() == 0


def test_the_round_trip_returns_exactly_the_non_sensitive_fields(api, professional):
    created = api.post(
        reverse("inquiry-draft-create"), _draft_body(professional), format="json"
    )
    user = make_user(email="draft-asker@phase6.example")
    api.force_authenticate(user)

    resolved = api.post(
        reverse("inquiry-draft-resolve"),
        {"draft_token": created.data["draft_token"]},
        format="json",
    )

    assert resolved.status_code == 200
    assert resolved.data == _draft_body(professional)
    # Never the email (it comes from the account) and never either consent
    # checkbox (consent is given by the person actually sending, after they see
    # the recipient again - spec 15.2).
    assert "email" not in resolved.data
    assert "privacy_consent" not in resolved.data
    assert "marketing_consent" not in resolved.data


def test_resolving_requires_a_verified_account(api, professional):
    created = api.post(
        reverse("inquiry-draft-create"), _draft_body(professional), format="json"
    )
    token = created.data["draft_token"]

    anonymous = api.post(
        reverse("inquiry-draft-resolve"), {"draft_token": token}, format="json"
    )
    assert anonymous.status_code == 401
    assert anonymous.data["error"]["code"] == "authentication_required"

    unverified = make_user(email="draft-unverified@phase6.example", verified=False)
    api.force_authenticate(unverified)
    response = api.post(
        reverse("inquiry-draft-resolve"), {"draft_token": token}, format="json"
    )
    assert response.status_code == 403
    assert response.data["error"]["code"] == "email_verification_required"


def test_a_tampered_token_is_refused(api, professional):
    created = api.post(
        reverse("inquiry-draft-create"), _draft_body(professional), format="json"
    )
    api.force_authenticate(make_user(email="draft-asker2@phase6.example"))

    response = api.post(
        reverse("inquiry-draft-resolve"),
        {"draft_token": created.data["draft_token"] + "x"},
        format="json",
    )
    assert response.status_code == 400
    assert response.data["error"]["code"] == "invalid_draft"


def test_a_token_signed_with_another_salt_is_refused(api, professional):
    """The salt is what stops a token minted for some other purpose - a session
    cookie, a password-reset payload - from being replayed here."""
    forged = signing.dumps(_draft_body(professional), salt="some.other.purpose")
    api.force_authenticate(make_user(email="draft-asker3@phase6.example"))

    response = api.post(
        reverse("inquiry-draft-resolve"), {"draft_token": forged}, format="json"
    )
    assert response.status_code == 400
    assert response.data["error"]["code"] == "invalid_draft"


def test_an_expired_token_is_refused(api, professional, monkeypatch):
    created = api.post(
        reverse("inquiry-draft-create"), _draft_body(professional), format="json"
    )
    # The TTL is read from the module at call time, so a negative max_age makes
    # any token instantly stale without waiting 30 minutes.
    monkeypatch.setattr("messaging.drafts.DRAFT_TOKEN_MAX_AGE_SECONDS", -1)
    api.force_authenticate(make_user(email="draft-asker4@phase6.example"))

    response = api.post(
        reverse("inquiry-draft-resolve"),
        {"draft_token": created.data["draft_token"]},
        format="json",
    )
    assert response.status_code == 400
    assert response.data["error"]["code"] == "draft_expired"


def test_a_half_typed_draft_is_accepted(api, professional):
    """A guest's draft is not a submission: none of spec 15.1's minimum lengths
    apply yet, or the form could not preserve work in progress."""
    response = api.post(
        reverse("inquiry-draft-create"),
        {
            "context_type": "PROFESSIONAL",
            "context_id": str(professional.pk),
            "message": "hi",
        },
        format="json",
    )
    assert response.status_code == 201


def test_the_flag_gates_both_draft_endpoints(
    api, professional, unified_inquiries_disabled
):
    """The decisive test for UnifiedInquiriesEnabled raising rather than
    returning False.

    inquiry-draft-create is AllowAny, so an anonymous caller reaches the
    permission stack with no credentials. Had the permission class returned
    False, DRF's permission_denied() would have answered `401
    authentication_required` - describing a problem the caller does not have,
    on the one route whose entire purpose is to serve people who are not signed
    in yet. Raising FeatureDisabled skips that branch.
    """
    anonymous = api.post(
        reverse("inquiry-draft-create"), _draft_body(professional), format="json"
    )
    assert anonymous.status_code == 403
    assert anonymous.data["error"]["code"] == "feature_disabled"

    api.force_authenticate(make_user(email="draft-flagoff@phase6.example"))
    resolve = api.post(
        reverse("inquiry-draft-resolve"), {"draft_token": "anything"}, format="json"
    )
    assert resolve.status_code == 403
    assert resolve.data["error"]["code"] == "feature_disabled"


def test_a_resolved_draft_does_not_send_anything(api, professional):
    """Spec 15.2, verbatim: "Do not send an inquiry automatically after login"."""
    created = api.post(
        reverse("inquiry-draft-create"), _draft_body(professional), format="json"
    )
    api.force_authenticate(make_user(email="draft-asker5@phase6.example"))
    api.post(
        reverse("inquiry-draft-resolve"),
        {"draft_token": created.data["draft_token"]},
        format="json",
    )
    assert Conversation.objects.count() == 0
    assert Message.objects.count() == 0
