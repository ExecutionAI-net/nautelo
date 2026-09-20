"""Spec §16: "Staff can revoke grants for abuse"; spec §36.6 makes revocation
the default remedy when a recipient blocks a user."""

import json

import pytest
from django.contrib.auth.models import Group
from rest_framework.test import APIClient

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from audit.models import AuditEvent
from messaging.enums import CONTACT_UNLOCK_FLAG
from messaging.tests.contact_factories import make_contact_grant
from platform_settings.models import FeatureFlag
from professionals.tests.factories import make_professional

pytestmark = pytest.mark.django_db

RAW_EMAIL = "info@ponente-marine.example"
RAW_PHONE = "+34655443322"


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
    owner = make_user(email="ponente-owner@example.com", role=UserRole.PROFESSIONAL)
    return make_professional(
        owner,
        display_name="Ponente Marine",
        slug="ponente-marine",
        public_email=RAW_EMAIL,
        public_phone=RAW_PHONE,
    )


@pytest.fixture
def viewer():
    return make_user(email="abusive-viewer@example.com")


@pytest.fixture
def moderator():
    user = make_user(email="moderator@example.com", role=UserRole.STAFF)
    user.groups.add(Group.objects.get(name=StaffGroup.MODERATOR))
    return user


def revoke_url(grant):
    return f"/api/v1/staff/contact-grants/{grant.pk}/revoke/"


def test_a_moderator_revokes_and_gets_the_updated_grant_back(
    api, viewer, professional, moderator, unlock_enabled
):
    grant = make_contact_grant(viewer=viewer, professional=professional)
    api.force_authenticate(moderator)

    response = api.post(revoke_url(grant), {"reason": "Harassment report #22"}, format="json")

    assert response.status_code == 200
    assert response.data["grant"]["id"] == str(grant.pk)
    assert response.data["grant"]["revoked_at"].endswith("Z")
    grant.refresh_from_db()
    assert grant.revoked_at is not None


def test_revocation_re_locks_the_contact_for_that_viewer(
    api, viewer, professional, moderator, unlock_enabled
):
    grant = make_contact_grant(viewer=viewer, professional=professional)
    api.force_authenticate(moderator)
    api.post(revoke_url(grant), {"reason": "Abuse"}, format="json")

    api.force_authenticate(viewer)
    response = api.get(f"/api/v1/contacts/professional/{professional.pk}/")

    assert response.data["contact"]["state"] == "LOCKED"
    assert RAW_EMAIL not in response.content.decode()


def test_the_revocation_is_audited_with_the_reason_and_no_contact_value(
    api, viewer, professional, moderator, unlock_enabled
):
    grant = make_contact_grant(viewer=viewer, professional=professional)
    api.force_authenticate(moderator)

    api.post(revoke_url(grant), {"reason": "Harassment report #22"}, format="json")

    event = AuditEvent.objects.get(action="contact_access.revoked")
    assert event.actor_user == moderator
    assert event.source == AuditEvent.Source.ADMIN
    assert event.target_id == str(grant.pk)
    assert event.metadata["reason"] == "Harassment report #22"
    assert event.metadata["viewer_id"] == str(viewer.pk)
    serialized = json.dumps(
        {"before": event.before, "after": event.after, "metadata": event.metadata}
    )
    assert RAW_EMAIL not in serialized
    assert "655443322" not in serialized


def test_a_reason_is_required(api, viewer, professional, moderator, unlock_enabled):
    """§36.6 frames revocation as an abuse remedy; an unexplained one is not
    auditable."""
    grant = make_contact_grant(viewer=viewer, professional=professional)
    api.force_authenticate(moderator)

    response = api.post(revoke_url(grant), {"reason": "   "}, format="json")

    assert response.status_code == 400
    assert response.data["error"]["code"] == "validation_error"
    assert "reason" in response.data["error"]["fields"]
    grant.refresh_from_db()
    assert grant.revoked_at is None


def test_revoking_twice_is_a_409_rather_than_a_silent_success(
    api, viewer, professional, moderator, unlock_enabled
):
    grant = make_contact_grant(viewer=viewer, professional=professional)
    api.force_authenticate(moderator)
    api.post(revoke_url(grant), {"reason": "Abuse"}, format="json")

    response = api.post(revoke_url(grant), {"reason": "Abuse again"}, format="json")

    assert response.status_code == 409
    assert response.data["error"]["code"] == "invalid_grant_state"
    assert AuditEvent.objects.filter(action="contact_access.revoked").count() == 1


def test_an_ordinary_user_cannot_revoke(api, viewer, professional, unlock_enabled):
    grant = make_contact_grant(viewer=viewer, professional=professional)
    api.force_authenticate(viewer)

    response = api.post(revoke_url(grant), {"reason": "let me in"}, format="json")

    assert response.status_code == 403
    grant.refresh_from_db()
    assert grant.revoked_at is None


def test_an_anonymous_request_cannot_revoke(api, viewer, professional, unlock_enabled):
    """401 `authentication_required`, not DRF's `not_authenticated`: the view
    extends MessagingAPIView (Phase 6 contract rule 11)."""
    grant = make_contact_grant(viewer=viewer, professional=professional)

    response = api.post(revoke_url(grant), {"reason": "let me in"}, format="json")

    assert response.status_code == 401
    assert response.data["error"]["code"] == "authentication_required"
    grant.refresh_from_db()
    assert grant.revoked_at is None


def test_the_revoke_response_forbids_caching(
    api, viewer, professional, moderator, unlock_enabled
):
    grant = make_contact_grant(viewer=viewer, professional=professional)
    api.force_authenticate(moderator)

    response = api.post(revoke_url(grant), {"reason": "Abuse"}, format="json")

    assert response["Cache-Control"] == "private, no-store, max-age=0"


def test_revocation_still_works_when_the_reveal_flag_is_off(
    api, viewer, professional, moderator
):
    """No `unlock_enabled` fixture: this view has no flag gate in
    `permission_classes`, deliberately (see the ruling). Revocation is an abuse
    remedy, and the moment reveals are paused is the worst possible moment for
    the remedy to 403. Phase 6 contract rule 11a orders a flag gate first where
    one exists; here the right answer is that none exists."""
    grant = make_contact_grant(viewer=viewer, professional=professional)
    api.force_authenticate(moderator)

    response = api.post(revoke_url(grant), {"reason": "Abuse"}, format="json")

    assert response.status_code == 200
    grant.refresh_from_db()
    assert grant.revoked_at is not None


def test_an_unknown_grant_is_a_404(api, moderator, unlock_enabled):
    api.force_authenticate(moderator)

    response = api.post(
        "/api/v1/staff/contact-grants/11111111-1111-4111-8111-111111111111/revoke/",
        {"reason": "Abuse"},
        format="json",
    )

    assert response.status_code == 404
