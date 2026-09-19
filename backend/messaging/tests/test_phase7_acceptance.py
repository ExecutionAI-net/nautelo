"""Spec §40 Scenarios A and B, and spec §16's four acceptance tests, proved
across the Phase 6 + Phase 7 seam with no mocking of either side."""

import threading

import pytest
from common.throttling import HashedIPScopedRateThrottle
from django.db import connection
from rest_framework.test import APIClient

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from messaging.enums import CONTACT_UNLOCK_FLAG
from messaging.enums import CURRENT_PRIVACY_POLICY_VERSION
from messaging.models import ContactAccessGrant
from platform_settings.models import FeatureFlag
from professionals.tests.factories import make_professional

RAW_EMAIL = "info@scenario-a.example"
RAW_PHONE = "+34633221100"
INQUIRY_URL = "/api/v1/inquiries/"


def enable_flags():
    for key in ("contact_unlock", "unified_inquiries"):
        FeatureFlag.objects.update_or_create(
            key=key, defaults={"is_enabled": True, "description": "acceptance"}
        )


def build_professional():
    owner = make_user(email="scenario-a-owner@example.com", role=UserRole.SERVICE_PROVIDER)
    return make_professional(
        owner,
        display_name="Scenario A Marine",
        slug="scenario-a-marine",
        public_email=RAW_EMAIL,
        public_phone=RAW_PHONE,
    )


def contact_url(professional):
    return f"/api/v1/contacts/professional/{professional.pk}/"


def inquiry_body(professional, **overrides):
    """Phase 6's `InquirySubmissionSerializer`, field for field (reconciliation
    row 9 — re-read the merged serializer before changing a name here).

    Three of these are easy to get wrong and each would fail the whole file:
    * `message` is the WIRE name; the service parameter underneath is `body`.
    * `email` MUST equal the authenticated actor's address — `validate_email`
      raises `email_mismatch` otherwise, so the fixture user's email and this
      value are the same string on purpose.
    * `privacy_consent` is a separate required-in-effect boolean: it is declared
      `BooleanField(required=False, default=False)`, and `validate()` raises
      `ConsentRequired` when it is falsy. Sending only
      `privacy_policy_version` is a 400, not a 201.
    The honeypot (`HONEYPOT_FIELD_NAME`) is deliberately omitted: it defaults to
    `""`, and repeating its name here would duplicate a constant Phase 6 owns.
    """
    body = {
        "context_type": "PROFESSIONAL",
        "context_id": str(professional.pk),
        "full_name": "Ada Rossi",
        "email": "buyer@example.com",
        "phone": "+390000000000",
        "subject": "Question about your survey services",
        "message": "I would like to arrange a survey for a boat next week.",
        "privacy_policy_version": CURRENT_PRIVACY_POLICY_VERSION,
        "privacy_consent": True,
        "marketing_consent": False,
    }
    body.update(overrides)
    return body


@pytest.mark.django_db
def test_scenario_a_a_valid_inquiry_unlocks_exactly_that_entity():
    """Spec §40 Scenario A."""
    enable_flags()
    professional = build_professional()
    buyer = make_user(email="buyer@example.com")
    api = APIClient()
    api.force_authenticate(buyer)

    before = api.get(contact_url(professional))
    assert before.data["contact"]["state"] == "LOCKED"
    assert RAW_EMAIL not in before.content.decode()

    submitted = api.post(INQUIRY_URL, inquiry_body(professional), format="json")
    assert submitted.status_code == 201
    assert submitted.data["contact_access"] == "GRANTED"

    after = api.get(contact_url(professional))
    assert after.data["contact"]["state"] == "GRANTED"
    assert after.data["contact"]["email"] == RAW_EMAIL
    assert after.data["contact"]["phone"] == RAW_PHONE
    assert ContactAccessGrant.objects.filter(viewer=buyer, professional=professional).count() == 1


@pytest.mark.django_db
def test_scenario_a_reveals_to_that_viewer_only():
    enable_flags()
    professional = build_professional()
    buyer = make_user(email="buyer@example.com")
    api = APIClient()
    api.force_authenticate(buyer)
    api.post(INQUIRY_URL, inquiry_body(professional), format="json")

    bystander = make_user(email="bystander@example.com")
    api.force_authenticate(bystander)
    response = api.get(contact_url(professional))

    assert response.data["contact"]["state"] == "LOCKED"
    assert RAW_EMAIL not in response.content.decode()


@pytest.mark.django_db
def test_an_inquiry_without_privacy_consent_is_refused_and_grants_nothing():
    """Phase 6's serializer raises ConsentRequired when `privacy_consent` is
    falsy (spec §15.1's required checkbox, §33.2's "obtain required
    consent/version"). Also guards this file's own fixture: if the happy-path
    body were missing the flag, every 201 assertion above would be wrong."""
    enable_flags()
    professional = build_professional()
    buyer = make_user(email="buyer@example.com")
    api = APIClient()
    api.force_authenticate(buyer)

    refused = api.post(
        INQUIRY_URL, inquiry_body(professional, privacy_consent=False), format="json"
    )

    assert refused.status_code == 400
    assert refused.data["error"]["code"] == "consent_required"
    assert ContactAccessGrant.objects.count() == 0
    assert api.get(contact_url(professional)).data["contact"]["state"] == "LOCKED"


@pytest.mark.django_db
def test_an_inquiry_sent_as_somebody_elses_email_is_refused():
    """Spec §15's definition of done: the email "cannot be forged to another
    account". Phase 6's validate_email enforces it; this pins that a forged
    sender never produces a grant for the real account either."""
    enable_flags()
    professional = build_professional()
    buyer = make_user(email="buyer@example.com")
    api = APIClient()
    api.force_authenticate(buyer)

    refused = api.post(
        INQUIRY_URL,
        inquiry_body(professional, email="someone-else@example.com"),
        format="json",
    )

    assert refused.status_code == 400
    assert ContactAccessGrant.objects.count() == 0


@pytest.mark.django_db
def test_scenario_b_a_failed_inquiry_leaves_the_contact_locked():
    """Spec §40 Scenario B: "no message, notification or grant exists and raw
    contact data is absent from the response and DOM"."""
    enable_flags()
    professional = build_professional()
    buyer = make_user(email="buyer@example.com")
    api = APIClient()
    api.force_authenticate(buyer)

    # Too short for spec §15.1's 20-character minimum.
    rejected = api.post(INQUIRY_URL, inquiry_body(professional, message="no"), format="json")

    assert rejected.status_code == 400
    assert RAW_EMAIL not in rejected.content.decode()
    assert ContactAccessGrant.objects.count() == 0
    response = api.get(contact_url(professional))
    assert response.data["contact"]["state"] == "LOCKED"
    assert RAW_EMAIL not in response.content.decode()


@pytest.mark.django_db
def test_a_rate_limited_inquiry_does_not_unlock_contact(monkeypatch):
    """Spec §16: "A failed or rate-limited message does not unlock contact"."""
    enable_flags()
    professional = build_professional()
    buyer = make_user(email="buyer@example.com")
    api = APIClient()
    api.force_authenticate(buyer)
    # `inquiry_submit` is Phase 6's scope, declared at 20/hour (its contract
    # rule 15). Confirm it in the merged settings before running.
    monkeypatch.setitem(HashedIPScopedRateThrottle.THROTTLE_RATES, "inquiry_submit", "0/min")

    throttled = api.post(INQUIRY_URL, inquiry_body(professional), format="json")

    assert throttled.status_code == 429
    assert ContactAccessGrant.objects.count() == 0
    assert api.get(contact_url(professional)).data["contact"]["state"] == "LOCKED"


@pytest.mark.django_db(transaction=True)
def test_concurrent_duplicate_inquiries_create_exactly_one_grant():
    """Spec §16: "A successful transaction creates exactly one grant despite
    concurrent duplicate requests". The constraint that makes this true is
    Phase 6's; if this fails, the fix belongs there — escalate, do not relax
    the assertion."""
    enable_flags()
    professional = build_professional()
    buyer = make_user(email="buyer@example.com")
    body = inquiry_body(professional)

    def attempt():
        try:
            client = APIClient()
            client.force_authenticate(buyer)
            client.post(INQUIRY_URL, body, format="json")
        finally:
            connection.close()

    threads = [threading.Thread(target=attempt) for _ in range(2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert ContactAccessGrant.objects.filter(viewer=buyer, professional=professional).count() == 1


@pytest.mark.django_db
def test_staff_revocation_takes_effect_immediately_after_a_real_inquiry():
    """Spec §16: "Staff can revoke grants for abuse"."""
    from django.contrib.auth.models import Group

    from accounts.enums import StaffGroup

    enable_flags()
    professional = build_professional()
    buyer = make_user(email="buyer@example.com")
    api = APIClient()
    api.force_authenticate(buyer)
    api.post(INQUIRY_URL, inquiry_body(professional), format="json")
    grant = ContactAccessGrant.objects.get(viewer=buyer, professional=professional)

    moderator = make_user(email="acceptance-moderator@example.com", role=UserRole.STAFF)
    moderator.groups.add(Group.objects.get(name=StaffGroup.MODERATOR))
    api.force_authenticate(moderator)
    api.post(
        f"/api/v1/staff/contact-grants/{grant.pk}/revoke/",
        {"reason": "Acceptance check"},
        format="json",
    )

    api.force_authenticate(buyer)
    response = api.get(contact_url(professional))

    assert response.data["contact"]["state"] == "LOCKED"
    assert RAW_EMAIL not in response.content.decode()
