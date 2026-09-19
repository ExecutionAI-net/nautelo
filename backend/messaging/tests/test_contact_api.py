"""Spec §30.1's contact endpoint, end to end over HTTP.

Guests reach it: spec §34.5's first browser scenario is "Guest opens
professional, sees locked contact", so AllowAny is a requirement, not a
convenience.
"""

import pytest
from common.throttling import HashedIPScopedRateThrottle
from django.contrib.auth.models import Group
from rest_framework.test import APIClient

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from audit.models import AuditEvent
from messaging.enums import CONTACT_UNLOCK_FLAG
from messaging.enums import UNIFIED_INQUIRIES_FLAG
from messaging.tests.contact_factories import make_contact_grant
from platform_settings.models import FeatureFlag
from professionals.enums import ProfessionalProfileStatus
from professionals.tests.factories import make_professional

pytestmark = pytest.mark.django_db

RAW_EMAIL = "info@tramontana.example"
RAW_PHONE = "+34911223344"


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def unlock_enabled():
    FeatureFlag.objects.update_or_create(
        key=CONTACT_UNLOCK_FLAG,
        defaults={"is_enabled": True, "description": "enabled for this test"},
    )


@pytest.fixture
def professional():
    owner = make_user(email="tramontana-owner@example.com", role=UserRole.SERVICE_PROVIDER)
    return make_professional(
        owner,
        display_name="Tramontana Rigging",
        slug="tramontana-rigging",
        public_email=RAW_EMAIL,
        public_phone=RAW_PHONE,
    )


def url(professional):
    return f"/api/v1/contacts/professional/{professional.pk}/"


def assert_no_store(response):
    """Spec §16: this payload must never be cached by anything.

    `Vary` is compared as a SET, never for string equality: corsheaders'
    CorsMiddleware runs after the view and calls
    `patch_vary_headers(response, ("origin",))` unconditionally for every URL
    (its CORS_URLS_REGEX defaults to `^.*$`, and the middleware is installed in
    config/settings/base.py), so the header this project actually emits is
    "Authorization, Cookie, origin". An equality assertion here would fail on
    every single response — and would fail for a reason that has nothing to do
    with what it is trying to prove.
    """
    assert response["Cache-Control"] == "private, no-store, max-age=0"
    vary = {part.strip().lower() for part in response["Vary"].split(",")}
    assert {"authorization", "cookie"} <= vary


def test_a_guest_receives_the_locked_payload(api, professional, unlock_enabled):
    response = api.get(url(professional))

    assert response.status_code == 200
    assert response.data == {
        "contact": {
            "state": "LOCKED",
            "email_mask": "i••••@tramontana.example",
            "phone_mask": "+34 ••• ••• ••4",
            "unlock_rule": "SEND_INQUIRY",
        }
    }


def test_a_grant_holder_receives_the_real_values(api, professional, unlock_enabled):
    viewer = make_user(email="grant-holder@example.com")
    make_contact_grant(viewer=viewer, professional=professional)
    api.force_authenticate(viewer)

    response = api.get(url(professional))

    assert response.status_code == 200
    assert response.data["contact"]["state"] == "GRANTED"
    assert response.data["contact"]["email"] == RAW_EMAIL
    assert response.data["contact"]["phone"] == RAW_PHONE
    assert response.data["contact"]["granted_at"].endswith("Z")


def test_the_first_granted_response_audits_the_reveal_exactly_once(
    api, professional, unlock_enabled
):
    viewer = make_user(email="grant-holder@example.com")
    make_contact_grant(viewer=viewer, professional=professional)
    api.force_authenticate(viewer)

    api.get(url(professional))
    api.get(url(professional))

    assert AuditEvent.objects.filter(action="contact_access.revealed").count() == 1


def test_a_staff_moderator_reveals_over_http_and_is_audited_every_time(
    api, professional, unlock_enabled
):
    """Spec §5's staff row. accounts/selectors.py already reports
    `reveal_any_contact` to staff on GET /api/v1/session/, so this endpoint has
    to honour it."""
    moderator = make_user(email="api-moderator@example.com", role=UserRole.STAFF)
    moderator.groups.add(Group.objects.get(name=StaffGroup.MODERATOR))
    api.force_authenticate(moderator)

    first = api.get(url(professional))
    api.get(url(professional))

    assert first.data["contact"]["state"] == "GRANTED"
    assert first.data["contact"]["email"] == RAW_EMAIL
    assert first.data["contact"]["granted_at"] is None
    assert AuditEvent.objects.filter(action="contact_access.staff_revealed").count() == 2
    assert AuditEvent.objects.filter(action="contact_access.revealed").count() == 0


@pytest.mark.parametrize("flag_enabled", [True, False])
def test_the_flag_state_changes_the_answer_but_never_the_status_code(
    api, professional, flag_enabled
):
    """Phase 6 contract rule 11a's property, in this phase's own terms.

    Rule 11a orders a flag gate FIRST in `permission_classes` so that a
    switched-off feature names one reason for everyone rather than 401 for the
    signed-out and 403 for the signed-in. This view has **no flag gate in
    `permission_classes` at all** — `contact_unlock` is evaluated inside
    `resolve_contact_access`, and it only ever closes the reveal — so the
    property worth pinning is the stronger one: the flag changes the CONTENT and
    never the status code, nor who is allowed to ask.

    Three callers who would each be treated differently by a flag-gated endpoint
    — anonymous, deactivated, and an eligible grant holder — must all get 200 in
    both flag states. If anybody ever "fixes" this view by adding a flag gate to
    `permission_classes`, the `flag_enabled=False` case is what catches it: all
    three flip together to `403 feature_disabled`, and `statuses == {200}`
    fails. (The `flag_enabled=True` case cannot catch that mistake, because a
    gate whose flag is on returns True and changes nothing — which is precisely
    why both parametrizations exist.)

    One limit worth naming rather than overselling: `force_authenticate` installs
    the user directly and **bypasses authentication entirely**, so the
    "deactivated" leg exercises the permission layer only. In production a
    deactivated account's token is rejected by `JWTAuthentication` before any
    permission runs, and the real answer there is a 401 — which is a fact about
    authentication, not about this view's permission order, and is not what this
    test is for.
    """
    FeatureFlag.objects.update_or_create(
        key=CONTACT_UNLOCK_FLAG,
        defaults={"is_enabled": flag_enabled, "description": "ordering check"},
    )
    holder = make_user(email="order-holder@example.com")
    make_contact_grant(viewer=holder, professional=professional)
    deactivated = make_user(email="order-inactive@example.com", is_active=False)

    statuses = set()
    for caller in (None, deactivated, holder):
        api.force_authenticate(caller)
        response = api.get(url(professional))
        statuses.add(response.status_code)
        assert_no_store(response)

    assert statuses == {200}

    api.force_authenticate(holder)
    assert api.get(url(professional)).data["contact"]["state"] == (
        "GRANTED" if flag_enabled else "LOCKED"
    )


def test_the_endpoint_still_answers_when_unified_inquiries_is_off(
    api, professional, unlock_enabled
):
    """Deliberate divergence from Phase 6 contract rule 14 (see the ruling): with
    inquiries paused, the panel must still render LOCKED with its explanation,
    and an existing grant holder must not lose a contact they already unlocked.
    A 403 `feature_disabled` here would break spec §14.2 and §2.1."""
    FeatureFlag.objects.update_or_create(
        key=UNIFIED_INQUIRIES_FLAG,
        defaults={"is_enabled": False, "description": "paused for this test"},
    )
    viewer = make_user(email="paused-grant-holder@example.com")
    make_contact_grant(viewer=viewer, professional=professional)

    guest = api.get(url(professional))
    api.force_authenticate(viewer)
    holder = api.get(url(professional))

    assert guest.status_code == 200
    assert guest.data["contact"]["state"] == "LOCKED"
    assert holder.data["contact"]["state"] == "GRANTED"


def test_a_suspended_entity_answers_unavailable(api, professional, unlock_enabled):
    professional.status = ProfessionalProfileStatus.SUSPENDED
    professional.save(update_fields=["status", "updated_at"])

    response = api.get(url(professional))

    assert response.status_code == 200
    assert response.data == {"contact": {"state": "UNAVAILABLE"}}


def test_a_never_public_entity_is_a_404_envelope(api, professional, unlock_enabled):
    professional.status = ProfessionalProfileStatus.DRAFT
    professional.save(update_fields=["status", "updated_at"])

    response = api.get(url(professional))

    assert response.status_code == 404
    assert response.data["error"]["code"] == "not_found"
    assert response.data["error"]["request_id"]
    assert response["X-Request-ID"]


def test_an_unknown_id_is_a_404(api, unlock_enabled):
    response = api.get("/api/v1/contacts/professional/11111111-1111-4111-8111-111111111111/")

    assert response.status_code == 404


def test_an_unknown_target_type_segment_is_a_404(api, professional, unlock_enabled):
    response = api.get(f"/api/v1/contacts/listing/{professional.pk}/")

    assert response.status_code == 404


def test_a_non_uuid_id_does_not_reach_the_view(api, unlock_enabled):
    """The URL converter is <uuid:...>, so a junk id is a routing 404 and never
    becomes a database error."""
    assert api.get("/api/v1/contacts/professional/not-a-uuid/").status_code == 404


def test_the_endpoint_is_rate_limited_in_spec_15_5s_vocabulary(
    api, professional, unlock_enabled, monkeypatch
):
    # Overriding settings.REST_FRAMEWORK would NOT work: DRF binds
    # SimpleRateThrottle.THROTTLE_RATES once from api_settings at import time.
    # Monkeypatching the scope entry is the pattern this repo already uses
    # (services_catalog/tests/test_service_category_api.py). `backend/conftest.py`
    # has already emptied this checkout's throttle keys — since f8384d8 it
    # deletes only the keys under this worktree's `CACHES["default"]["KEY_PREFIX"]`
    # rather than flushing the shared Redis DB, so a parallel worktree's suite is
    # unaffected and so is this one.
    monkeypatch.setitem(
        HashedIPScopedRateThrottle.THROTTLE_RATES, "contact_access", "2/min"
    )
    api.get(url(professional))
    api.get(url(professional))

    response = api.get(url(professional))

    assert response.status_code == 429
    # MessagingAPIView.throttled() raises MessagingThrottled, so the code is
    # `rate_limited`, not DRF's `throttled` (Phase 6 contract rule 11).
    assert response.data["error"]["code"] == "rate_limited"
    assert RAW_EMAIL not in response.content.decode()


@pytest.mark.parametrize(
    "prepare",
    [
        pytest.param(lambda professional: None, id="guest-locked"),
        pytest.param(
            lambda professional: professional.__class__.objects.filter(
                pk=professional.pk
            ).update(status=ProfessionalProfileStatus.SUSPENDED),
            id="unavailable",
        ),
        pytest.param(
            lambda professional: professional.__class__.objects.filter(
                pk=professional.pk
            ).update(status=ProfessionalProfileStatus.DRAFT),
            id="not-found",
        ),
    ],
)
def test_every_response_path_forbids_caching(api, professional, unlock_enabled, prepare):
    """Spec §16: contact data is never public. The same URL answers LOCKED to
    one viewer and GRANTED to the next, and the browser client sends
    credentials, so a shared or browser cache is a real disclosure path."""
    prepare(professional)

    assert_no_store(api.get(url(professional)))


def test_the_granted_response_forbids_caching_too(api, professional, unlock_enabled):
    viewer = make_user(email="grant-holder@example.com")
    make_contact_grant(viewer=viewer, professional=professional)
    api.force_authenticate(viewer)

    response = api.get(url(professional))

    assert response.data["contact"]["state"] == "GRANTED"
    assert_no_store(response)


def test_the_429_response_forbids_caching_too(
    api, professional, unlock_enabled, monkeypatch
):
    monkeypatch.setitem(
        HashedIPScopedRateThrottle.THROTTLE_RATES, "contact_access", "1/min"
    )
    api.get(url(professional))

    response = api.get(url(professional))

    assert response.status_code == 429
    assert_no_store(response)
