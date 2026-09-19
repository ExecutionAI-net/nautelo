"""Spec 15.5's request/response shapes and its error-code list, plus spec 34.3's
API test classes: permissions matrix, "Guest cannot submit inquiry", "Context
recipient cannot be spoofed", "Validation/error codes are stable"."""

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.tests.factories import make_user
from brokers.enums import BrokerMembershipRole
from brokers.tests.factories import make_broker, make_membership
from common.throttling import HashedIPScopedRateThrottle
from listings.enums import ListingStatus
from listings.tests.factories import make_private_listing, make_snapshot
from messaging.enums import CURRENT_PRIVACY_POLICY_VERSION
from messaging.models import ContactAccessGrant, Conversation, Message
from professionals.tests.factories import make_professional

pytestmark = pytest.mark.django_db


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def asker():
    return make_user(email="api-asker@phase6.example")


@pytest.fixture
def professional():
    owner = make_user(email="api-pro-owner@phase6.example")
    return make_professional(
        owner,
        display_name="Phase6 Api Surveyors",
        slug="phase6-api-surveyors",
        public_email="office@phase6-api.example",
    )


def _body(target_id, email, **overrides):
    payload = {
        "context_type": "PROFESSIONAL",
        "context_id": str(target_id),
        "full_name": "Ada Rossi",
        "email": email,
        "phone": "+390000000000",
        "subject": "Question about the survey",
        "message": "I would like to arrange a viewing next week please.",
        "privacy_policy_version": CURRENT_PRIVACY_POLICY_VERSION,
        "privacy_consent": True,
        "marketing_consent": False,
    }
    payload.update(overrides)
    return payload


def test_a_guest_gets_401_authentication_required(api, professional):
    """Spec 34.3: "Guest cannot submit inquiry." Spec 15.5 names the code."""
    response = api.post(
        reverse("inquiry-create"),
        _body(professional.pk, "nobody@phase6.example"),
        format="json",
    )
    assert response.status_code == 401
    assert response.data["error"]["code"] == "authentication_required"
    assert Conversation.objects.count() == 0


def test_an_unverified_account_gets_403_email_verification_required(api, professional):
    unverified = make_user(email="api-unverified@phase6.example", verified=False)
    api.force_authenticate(unverified)
    response = api.post(
        reverse("inquiry-create"), _body(professional.pk, unverified.email), format="json"
    )
    assert response.status_code == 403
    assert response.data["error"]["code"] == "email_verification_required"


def test_the_rollout_flag_off_returns_403_feature_disabled(
    api, asker, professional, unified_inquiries_disabled
):
    api.force_authenticate(asker)
    response = api.post(
        reverse("inquiry-create"), _body(professional.pk, asker.email), format="json"
    )
    assert response.status_code == 403
    assert response.data["error"]["code"] == "feature_disabled"


def test_the_flag_off_answer_is_403_for_an_anonymous_caller_too(
    api, professional, unified_inquiries_disabled
):
    """Spec 35.1 has no "unless you are signed out" clause.

    This passes for two reasons that must BOTH hold. (1) UnifiedInquiriesEnabled
    raises FeatureDisabled rather than returning False, because DRF's
    permission_denied() answers 401 NotAuthenticated for any credential-less
    request before it reads a permission's `code`. (2) It is listed FIRST in
    permission_classes, because check_permissions stops at the first gate that
    fails - with IsAuthenticated ahead of it, an anonymous caller would be
    refused for authentication and never reach the flag at all.
    """
    response = api.post(
        reverse("inquiry-create"),
        _body(professional.pk, "nobody@phase6.example"),
        format="json",
    )
    assert response.status_code == 403
    assert response.data["error"]["code"] == "feature_disabled"


def test_the_flag_off_answer_precedes_every_other_permission(
    api, professional, unified_inquiries_disabled
):
    """The regression guard for the ordering rule.

    Four callers who would each fail a DIFFERENT later gate - anonymous
    (IsAuthenticated), deactivated (IsActiveUser), unverified
    (InquiryEmailVerified) and fully eligible - must all hear the same thing
    when the feature is off. If anybody ever reorders permission_classes so the
    flag gate is not first, exactly one of these four flips to 401 or to a
    different 403 code, and this test says which.
    """
    eligible = make_user(email="order-ok@phase6.example")
    deactivated = make_user(email="order-inactive@phase6.example", is_active=False)
    unverified = make_user(email="order-unverified@phase6.example", verified=False)

    for caller in (None, deactivated, unverified, eligible):
        api.force_authenticate(caller)
        response = api.post(
            reverse("inquiry-create"),
            _body(professional.pk, "nobody@phase6.example"),
            format="json",
        )
        assert response.status_code == 403, caller
        assert response.data["error"]["code"] == "feature_disabled", caller


def test_a_valid_submission_returns_spec_15_5_s_success_body(
    api, asker, professional, django_capture_on_commit_callbacks
):
    api.force_authenticate(asker)
    with django_capture_on_commit_callbacks(execute=True):
        response = api.post(
            reverse("inquiry-create"),
            _body(professional.pk, asker.email),
            format="json",
            HTTP_X_REQUEST_ID="req-inquiry-1",
        )

    assert response.status_code == 201
    conversation = Conversation.objects.get()
    message = Message.objects.get()
    assert response.data == {
        "conversation_id": str(conversation.pk),
        "message_id": str(message.pk),
        "contact_access": "GRANTED",
        "next_url": f"/dashboard/messages/{conversation.pk}/",
    }
    assert response["X-Request-ID"] == "req-inquiry-1"


def test_a_filled_honeypot_is_refused_and_writes_nothing(api, asker, professional):
    api.force_authenticate(asker)
    response = api.post(
        reverse("inquiry-create"),
        _body(professional.pk, asker.email, company_website="https://spam.example"),
        format="json",
    )
    assert response.status_code == 400
    assert response.data["error"]["code"] == "spam_detected"
    assert Conversation.objects.count() == 0
    assert Message.objects.count() == 0


def test_an_empty_honeypot_is_accepted(api, asker, professional):
    api.force_authenticate(asker)
    response = api.post(
        reverse("inquiry-create"),
        _body(professional.pk, asker.email, company_website=""),
        format="json",
    )
    assert response.status_code == 201


def test_missing_privacy_consent_is_consent_required(api, asker, professional):
    api.force_authenticate(asker)
    response = api.post(
        reverse("inquiry-create"),
        _body(professional.pk, asker.email, privacy_consent=False),
        format="json",
    )
    assert response.status_code == 400
    assert response.data["error"]["code"] == "consent_required"


def test_a_stale_policy_version_is_consent_required(api, asker, professional):
    api.force_authenticate(asker)
    response = api.post(
        reverse("inquiry-create"),
        _body(professional.pk, asker.email, privacy_policy_version="2019-01"),
        format="json",
    )
    assert response.status_code == 400
    assert response.data["error"]["code"] == "consent_required"


def test_marketing_consent_is_never_required(api, asker, professional):
    """Spec 15.1: "Optional, separate, unchecked; never required for inquiry"."""
    api.force_authenticate(asker)
    payload = _body(professional.pk, asker.email)
    payload.pop("marketing_consent")
    response = api.post(reverse("inquiry-create"), payload, format="json")
    assert response.status_code == 201
    assert Message.objects.get().marketing_consent is False


def test_a_forged_email_is_refused_as_a_field_error(api, asker, professional):
    """Spec 15's definition of done: the email "cannot be forged to another
    account without a verified email-change flow".

    NOTE the envelope: common.exceptions.nauta_exception_handler collapses EVERY
    ValidationError to code "validation_error", so the specific reason lives in
    `fields`, not in `code`. Asserting on a field-level code string here would
    always fail - that is a real property of this codebase, not a quirk of this
    test.
    """
    api.force_authenticate(asker)
    response = api.post(
        reverse("inquiry-create"),
        _body(professional.pk, "someone.else@phase6.example"),
        format="json",
    )
    assert response.status_code == 400
    assert response.data["error"]["code"] == "validation_error"
    assert response.data["error"]["fields"]["email"] == [
        "Send from your own verified account email address."
    ]
    assert Message.objects.count() == 0


def test_the_account_email_is_used_even_though_the_client_sent_it(
    api, asker, professional
):
    api.force_authenticate(asker)
    api.post(reverse("inquiry-create"), _body(professional.pk, asker.email), format="json")
    assert Message.objects.get().sender_email_snapshot == asker.email


def test_an_unknown_context_type_is_invalid_context(api, asker, professional):
    api.force_authenticate(asker)
    response = api.post(
        reverse("inquiry-create"),
        _body(professional.pk, asker.email, context_type="SUPPORT"),
        format="json",
    )
    assert response.status_code == 400
    assert response.data["error"]["code"] == "invalid_context"


def test_a_non_uuid_context_id_is_invalid_context(api, asker, professional):
    api.force_authenticate(asker)
    response = api.post(
        reverse("inquiry-create"),
        _body(professional.pk, asker.email, context_id="../../etc/passwd"),
        format="json",
    )
    assert response.status_code == 400
    assert response.data["error"]["code"] == "invalid_context"


def test_an_unpublished_listing_is_recipient_unavailable(api, asker):
    """Spec 34.3: "Context recipient cannot be spoofed" and "Pending listing is
    absent publicly"."""
    seller = make_user(email="api-draft-seller@phase6.example")
    listing = make_private_listing(owner=seller)
    api.force_authenticate(asker)
    response = api.post(
        reverse("inquiry-create"),
        _body(listing.pk, asker.email, context_type="LISTING"),
        format="json",
    )
    assert response.status_code == 409
    assert response.data["error"]["code"] == "recipient_unavailable"


def test_a_seller_cannot_inquire_about_their_own_listing(api):
    seller = make_user(email="api-self-seller@phase6.example")
    approver = make_user(email="api-approver@phase6.example")
    listing = make_private_listing(owner=seller)
    snapshot = make_snapshot(listing, approved_by=approver)
    listing.status = ListingStatus.PUBLISHED
    listing.current_public_snapshot = snapshot
    listing.save(update_fields=["status", "current_public_snapshot", "updated_at"])

    api.force_authenticate(seller)
    response = api.post(
        reverse("inquiry-create"),
        _body(listing.pk, seller.email, context_type="LISTING"),
        format="json",
    )
    assert response.status_code == 400
    assert response.data["error"]["code"] == "self_inquiry_not_allowed"


def test_a_broker_member_cannot_inquire_to_their_own_broker(api):
    broker = make_broker(name="Phase6 Api Brokers", slug="phase6-api-brokers")
    member = make_user(email="api-member@phase6.example")
    make_membership(member, broker, role=BrokerMembershipRole.VIEWER)
    api.force_authenticate(member)
    response = api.post(
        reverse("inquiry-create"),
        _body(broker.pk, member.email, context_type="BROKER"),
        format="json",
    )
    assert response.status_code == 400
    assert response.data["error"]["code"] == "self_inquiry_not_allowed"


def test_a_message_below_the_minimum_length_is_a_field_error(api, asker, professional):
    api.force_authenticate(asker)
    response = api.post(
        reverse("inquiry-create"),
        _body(professional.pk, asker.email, message="too short"),
        format="json",
    )
    assert response.status_code == 400
    assert response.data["error"]["code"] == "validation_error"
    assert "message" in response.data["error"]["fields"]


def test_a_non_e164_phone_is_a_field_error(api, asker, professional):
    api.force_authenticate(asker)
    response = api.post(
        reverse("inquiry-create"),
        _body(professional.pk, asker.email, phone="0800 CALL ME"),
        format="json",
    )
    assert response.status_code == 400
    assert "phone" in response.data["error"]["fields"]


def test_an_omitted_phone_is_accepted(api, asker, professional):
    api.force_authenticate(asker)
    payload = _body(professional.pk, asker.email)
    payload.pop("phone")
    response = api.post(reverse("inquiry-create"), payload, format="json")
    assert response.status_code == 201
    assert Message.objects.get().sender_phone_snapshot == ""


def test_the_throttle_returns_429_rate_limited_with_retry_information(
    api, asker, professional, monkeypatch
):
    """Spec 30.4: "Return 429 with retry information."

    NOTE: overriding settings.REST_FRAMEWORK does not work - DRF binds
    SimpleRateThrottle.THROTTLE_RATES once from api_settings at import time. The
    already-merged taxonomy, services_catalog and listings rate-limit tests all
    monkeypatch the scope entry directly; this follows them.
    """
    monkeypatch.setitem(
        HashedIPScopedRateThrottle.THROTTLE_RATES, "inquiry_submit", "1/min"
    )
    api.force_authenticate(asker)
    first = api.post(
        reverse("inquiry-create"), _body(professional.pk, asker.email), format="json"
    )
    assert first.status_code == 201

    second = api.post(
        reverse("inquiry-create"),
        _body(professional.pk, asker.email, message="A second, different question."),
        format="json",
    )
    assert second.status_code == 429
    assert second.data["error"]["code"] == "rate_limited"
    assert second.data["error"]["meta"]["retry_after_seconds"] >= 1
    assert "Retry-After" in second


def test_a_throttled_request_creates_nothing(api, asker, professional, monkeypatch):
    """Spec 16's acceptance test: "A failed or rate-limited message does not
    unlock contact"."""
    monkeypatch.setitem(
        HashedIPScopedRateThrottle.THROTTLE_RATES, "inquiry_submit", "0/min"
    )
    api.force_authenticate(asker)
    response = api.post(
        reverse("inquiry-create"), _body(professional.pk, asker.email), format="json"
    )
    assert response.status_code == 429
    assert ContactAccessGrant.objects.count() == 0
    assert Conversation.objects.count() == 0


def test_the_config_endpoint_is_public_and_reports_every_client_side_limit(api):
    response = api.get(reverse("inquiry-config"))
    assert response.status_code == 200
    assert response.data == {
        "enabled": True,
        "privacy_policy_version": CURRENT_PRIVACY_POLICY_VERSION,
        "honeypot_field": "company_website",
        "limits": {
            "full_name": {"min": 2, "max": 120},
            "subject": {"min": 3, "max": 150},
            "message": {"min": 20, "max": 4000},
            "phone_max": 32,
        },
    }


def test_the_config_endpoint_reports_the_flag_state(api, unified_inquiries_disabled):
    """Spec 35.1: flags gate frontend exposure too. This is the one round trip
    the server component makes to decide whether to render the form at all."""
    response = api.get(reverse("inquiry-config"))
    assert response.status_code == 200
    assert response.data["enabled"] is False


def test_the_response_contains_no_contact_value_anywhere(api, asker, professional):
    """Phase 5 contract rule 1 and spec 16: no raw contact string leaves this
    phase. The grant is an authorization outcome, not a contact payload."""
    api.force_authenticate(asker)
    response = api.post(
        reverse("inquiry-create"), _body(professional.pk, asker.email), format="json"
    )
    rendered = response.content.decode()
    assert professional.public_email not in rendered
    assert professional.public_phone not in rendered
    assert set(response.data) == {
        "conversation_id",
        "message_id",
        "contact_access",
        "next_url",
    }
