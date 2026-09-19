"""One file that tries, from every angle available to an unauthorized caller,
to obtain a raw contact value.

Spec §34.7's release checklist item — "Raw contact data is absent from
unauthorized responses/DOM" — and §34.3's "Locked contact response contains no
raw contact value". Every assertion scans the RENDERED BYTES, not the parsed
dict, so a value hidden in an unexpected key still fails the test. Both target
kinds are covered end to end, because the broker path has no frontend surface
yet and would otherwise be the one nobody exercises.
"""

import logging

import pytest
from common.throttling import HashedIPScopedRateThrottle
from django.contrib.auth.models import Group
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from brokers.enums import BrokerOrganizationStatus
from brokers.tests.factories import make_broker
from listings.enums import ListingStatus
from listings.tests.factories import make_broker_listing, make_snapshot
from messaging.enums import CONTACT_UNLOCK_FLAG
from messaging.tests.contact_factories import make_contact_grant
from platform_settings.models import FeatureFlag
from professionals.enums import ProfessionalProfileStatus
from professionals.tests.factories import make_professional
from services_catalog.serializers import (
    ProfessionalCardSerializer,
    ProfessionalDetailSerializer,
)

pytestmark = pytest.mark.django_db

PRO_EMAIL = "confidential@secret-yard.example"
PRO_PHONE = "+34612345678"
PRO_WEBSITE = "https://secret-yard.example"
BROKER_EMAIL = "backoffice@hidden-brokerage.example"
BROKER_PHONE = "+34655000111"

#: Digit runs are checked without the "+" and separators too: a leak that
#: reformatted the number would otherwise slip past a whole-string check.
SECRETS = (
    PRO_EMAIL,
    PRO_PHONE,
    "612345678",
    PRO_WEBSITE,
    BROKER_EMAIL,
    BROKER_PHONE,
    "655000111",
)


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
    owner = make_user(email="secret-yard-owner@example.com", role=UserRole.SERVICE_PROVIDER)
    return make_professional(
        owner,
        display_name="Secret Yard",
        slug="secret-yard",
        public_email=PRO_EMAIL,
        public_phone=PRO_PHONE,
        website_url=PRO_WEBSITE,
    )


@pytest.fixture
def broker():
    return make_broker(
        name="Hidden Brokerage",
        slug="hidden-brokerage",
        public_email=BROKER_EMAIL,
        public_phone=BROKER_PHONE,
    )


@pytest.fixture
def moderator():
    user = make_user(email="sweep-moderator@example.com", role=UserRole.STAFF)
    user.groups.add(Group.objects.get(name=StaffGroup.MODERATOR))
    return user


def published_broker_listing(broker):
    """A live public listing owned by `broker` — the surface Phase 20 will mount
    the panel on, and the one most likely to grow a contact field by accident."""
    staff = make_user(email="sweep-approver@example.com", role=UserRole.STAFF)
    listing = make_broker_listing(
        broker=broker, actor=staff, status=ListingStatus.PUBLISHED
    )
    snapshot = make_snapshot(listing, approved_by=staff)
    listing.current_public_snapshot = snapshot
    listing.published_at = timezone.now()
    listing.save(update_fields=["current_public_snapshot", "published_at"])
    return listing


def assert_clean(response):
    """No secret of EITHER entity appears anywhere in the rendered bytes."""
    body = response.content.decode()
    for secret in SECRETS:
        assert secret not in body, f"{secret!r} leaked into a {response.status_code} body"


def assert_private(response):
    """Spec §16: this payload must never be cached by anything.

    `Vary` is compared as a SET: corsheaders' CorsMiddleware appends "origin" to
    it on every response (`patch_vary_headers(response, ("origin",))`, with
    CORS_URLS_REGEX defaulting to `^.*$`), so the emitted header is
    "Authorization, Cookie, origin". What matters is that both names this phase
    needs are present, not that nothing else added one.
    """
    assert response["Cache-Control"] == "private, no-store, max-age=0"
    vary = {part.strip().lower() for part in response["Vary"].split(",")}
    assert {"authorization", "cookie"} <= vary


def contact_url(target_type, entity):
    return f"/api/v1/contacts/{target_type}/{entity.pk}/"


# --------------------------------------------------------------------------
# The professional path
# --------------------------------------------------------------------------


def test_the_guest_locked_response_leaks_nothing(api, professional, unlock_enabled):
    response = api.get(contact_url("professional", professional))

    assert_clean(response)
    assert_private(response)


def test_a_signed_in_viewer_without_a_grant_leaks_nothing(
    api, professional, unlock_enabled
):
    api.force_authenticate(make_user(email="nosy@example.com"))

    assert_clean(api.get(contact_url("professional", professional)))


def test_a_revoked_grant_leaks_nothing(api, professional, unlock_enabled):
    viewer = make_user(email="revoked@example.com")
    make_contact_grant(
        viewer=viewer, professional=professional, revoked_at=timezone.now()
    )
    api.force_authenticate(viewer)

    assert_clean(api.get(contact_url("professional", professional)))


def test_a_grant_for_a_different_entity_leaks_nothing(
    api, professional, broker, unlock_enabled
):
    viewer = make_user(email="other-grant@example.com")
    make_contact_grant(viewer=viewer, broker=broker)
    api.force_authenticate(viewer)

    response = api.get(contact_url("professional", professional))

    assert response.data["contact"]["state"] == "LOCKED"
    assert_clean(response)


def test_with_the_flag_off_even_a_grant_holder_gets_nothing(api, professional):
    viewer = make_user(email="early-bird@example.com")
    make_contact_grant(viewer=viewer, professional=professional)
    api.force_authenticate(viewer)

    response = api.get(contact_url("professional", professional))

    assert response.data["contact"]["state"] == "LOCKED"
    assert_clean(response)


def test_a_suspended_entity_leaks_nothing_to_its_own_grant_holder(
    api, professional, unlock_enabled
):
    viewer = make_user(email="held-grant@example.com")
    make_contact_grant(viewer=viewer, professional=professional)
    professional.status = ProfessionalProfileStatus.SUSPENDED
    professional.save(update_fields=["status", "updated_at"])
    api.force_authenticate(viewer)

    assert_clean(api.get(contact_url("professional", professional)))


@pytest.mark.parametrize(
    "status", [ProfessionalProfileStatus.DRAFT, ProfessionalProfileStatus.PENDING]
)
def test_the_404_envelope_leaks_neither_contact_nor_entity_name(
    api, professional, status, unlock_enabled
):
    professional.status = status
    professional.save(update_fields=["status", "updated_at"])

    response = api.get(contact_url("professional", professional))

    assert response.status_code == 404
    assert_clean(response)
    assert_private(response)
    assert "Secret Yard" not in response.content.decode()


def test_the_429_envelope_leaks_nothing(api, professional, unlock_enabled, monkeypatch):
    monkeypatch.setitem(
        HashedIPScopedRateThrottle.THROTTLE_RATES, "contact_access", "1/min"
    )
    api.get(contact_url("professional", professional))

    response = api.get(contact_url("professional", professional))

    assert response.status_code == 429
    assert_clean(response)
    assert_private(response)


# --------------------------------------------------------------------------
# The broker path — no frontend surface yet, so nothing else exercises it
# --------------------------------------------------------------------------


def test_the_broker_locked_response_leaks_nothing(api, broker, unlock_enabled):
    response = api.get(contact_url("broker", broker))

    assert response.data["contact"]["state"] == "LOCKED"
    assert_clean(response)
    assert_private(response)


def test_a_professional_grant_does_not_unlock_a_broker(
    api, broker, professional, unlock_enabled
):
    """The mirror image of the professional-side test, so neither direction of
    spec §16's "Sending to Broker A does not unlock Broker B" is untested."""
    viewer = make_user(email="pro-grant-holder@example.com")
    make_contact_grant(viewer=viewer, professional=professional)
    api.force_authenticate(viewer)

    assert_clean(api.get(contact_url("broker", broker)))


def test_a_suspended_broker_leaks_nothing(api, broker, unlock_enabled):
    viewer = make_user(email="broker-grant-holder@example.com")
    make_contact_grant(viewer=viewer, broker=broker)
    broker.status = BrokerOrganizationStatus.SUSPENDED
    broker.save(update_fields=["status", "updated_at"])
    api.force_authenticate(viewer)

    response = api.get(contact_url("broker", broker))

    assert response.data["contact"]["state"] == "UNAVAILABLE"
    assert_clean(response)


def test_the_broker_granted_path_is_the_positive_control(api, broker, unlock_enabled):
    """Without this, every broker assertion above could be passing because the
    fixture never carried the values."""
    viewer = make_user(email="legit-broker-asker@example.com")
    make_contact_grant(viewer=viewer, broker=broker)
    api.force_authenticate(viewer)

    body = api.get(contact_url("broker", broker)).content.decode()

    assert BROKER_EMAIL in body
    assert "655000111" in body


# --------------------------------------------------------------------------
# Every other public surface that touches these entities
# --------------------------------------------------------------------------


def test_the_public_directory_endpoints_still_carry_no_contact_data(
    api, professional, unlock_enabled
):
    """Phase 5 contract rule 1, re-proved from the wire rather than from the
    serializer's field list."""
    assert_clean(api.get("/api/v1/professionals/"))
    assert_clean(api.get(f"/api/v1/professionals/{professional.slug}/"))


def test_the_public_listing_endpoints_carry_no_broker_contact_data(api, broker):
    """Phase 9 extends PublicListingSerializer this wave and Phase 20 will add a
    broker reference to it (Contract rule 15). An id is fine; a contact value is
    not, and this is the test that says so."""
    listing = published_broker_listing(broker)

    assert_clean(api.get(reverse("listing-list")))
    assert_clean(api.get(reverse("listing-detail", kwargs={"listing_id": listing.pk})))


def test_no_directory_serializer_declares_a_contact_field():
    forbidden = {"public_email", "public_phone", "website_url"}

    assert forbidden.isdisjoint(set(ProfessionalCardSerializer.Meta.fields))
    assert forbidden.isdisjoint(set(ProfessionalDetailSerializer.Meta.fields))


# --------------------------------------------------------------------------
# The staff surface
# --------------------------------------------------------------------------


def test_no_staff_revocation_response_carries_a_contact_value(
    api, professional, moderator, unlock_enabled
):
    """All three outcomes: the 200 resource, the 409 conflict, and the 403 a
    non-staff caller gets."""
    viewer = make_user(email="revoked-by-staff@example.com")
    grant = make_contact_grant(viewer=viewer, professional=professional)
    url = f"/api/v1/staff/contact-grants/{grant.pk}/revoke/"
    api.force_authenticate(moderator)

    ok = api.post(url, {"reason": "Abuse"}, format="json")
    conflict = api.post(url, {"reason": "Abuse again"}, format="json")
    api.force_authenticate(viewer)
    forbidden = api.post(url, {"reason": "let me in"}, format="json")

    assert (ok.status_code, conflict.status_code, forbidden.status_code) == (200, 409, 403)
    for response in (ok, conflict, forbidden):
        assert_clean(response)
    # The 200 body identifies the viewer by id, never by email address.
    assert viewer.email not in ok.content.decode()


# --------------------------------------------------------------------------
# Logs
# --------------------------------------------------------------------------


def test_nothing_is_logged_that_contains_a_contact_value(
    api, professional, unlock_enabled, caplog
):
    """Spec §33.5: never log private contact values.

    caplog is cleared immediately before the requests, so fixture creation —
    which legitimately handles the values — cannot account for a hit. Both the
    locked and the granted path are exercised; the granted one is the dangerous
    one, because it has the values in hand. The scan covers every record
    ATTRIBUTE, not just getMessage(): a value passed through `extra=` or riding
    on an exception in `exc_info` never reaches the formatted message but is
    still written out by a structured handler.
    """
    viewer = make_user(email="logger@example.com")
    make_contact_grant(viewer=viewer, professional=professional)

    with caplog.at_level(logging.DEBUG):
        caplog.clear()
        api.get(contact_url("professional", professional))
        api.force_authenticate(viewer)
        api.get(contact_url("professional", professional))

    emitted = []
    for record in caplog.records:
        emitted.append(record.getMessage())
        emitted.extend(str(value) for value in record.__dict__.values())
    haystack = "\n".join(emitted)
    for secret in (PRO_EMAIL, "612345678"):
        assert secret not in haystack


def test_the_granted_path_is_the_only_one_that_can_produce_the_values(
    api, professional, unlock_enabled
):
    """The positive control for the professional path. Without it, every
    assertion above could be passing because the fixture never carried the
    values in the first place."""
    viewer = make_user(email="legitimate@example.com")
    make_contact_grant(viewer=viewer, professional=professional)
    api.force_authenticate(viewer)

    body = api.get(contact_url("professional", professional)).content.decode()

    assert PRO_EMAIL in body
    assert "612345678" in body
    assert PRO_WEBSITE in body
