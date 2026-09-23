"""Spec §16: a moderator must be able to find a grant id before revoking it."""

import pytest
from django.contrib.auth.models import Group
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from brokers.tests.factories import make_broker
from messaging.tests.contact_factories import make_contact_grant
from professionals.tests.factories import make_professional

pytestmark = pytest.mark.django_db

LIST_URL = "/api/v1/staff/contact-grants/"


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def moderator():
    user = make_user(email="p16-moderator@example.com", role=UserRole.STAFF)
    user.groups.add(Group.objects.get(name=StaffGroup.MODERATOR))
    return user


@pytest.fixture
def viewer():
    return make_user(email="p16-viewer@example.com")


@pytest.fixture
def professional():
    owner = make_user(email="p16-pro-owner@example.com", role=UserRole.PROFESSIONAL)
    return make_professional(owner, display_name="P16 Marine", slug="p16-marine")


def test_an_anonymous_caller_cannot_list_grants(api):
    assert api.get(LIST_URL).status_code in (401, 403)


def test_a_private_seller_cannot_list_grants(api, viewer):
    api.force_authenticate(viewer)

    assert api.get(LIST_URL).status_code == 403


def test_a_moderator_sees_the_grant_by_safe_ids_only(api, moderator, viewer, professional):
    grant = make_contact_grant(viewer=viewer, professional=professional)
    api.force_authenticate(moderator)

    response = api.get(LIST_URL)

    assert response.status_code == 200
    assert response.data["count"] == 1
    row = response.data["results"][0]
    assert row["id"] == str(grant.pk)
    assert row["viewer_id"] == str(viewer.pk)
    assert row["target_type"] == "PROFESSIONAL"
    assert row["target_entity_id"] == str(professional.pk)
    assert row["status"] == "ACTIVE"
    assert row["revoked_at"] is None
    body = str(response.content)
    assert viewer.email not in body
    assert professional.display_name not in body


def test_a_revoked_grant_is_flagged_and_counted_in_facets(api, moderator, viewer, professional):
    make_contact_grant(viewer=viewer, professional=professional)
    other_viewer = make_user(email="p16-other@example.com")
    make_contact_grant(viewer=other_viewer, professional=professional, revoked_at=timezone.now())
    api.force_authenticate(moderator)

    response = api.get(LIST_URL)
    assert response.data["facets"] == {"ACTIVE": 1, "REVOKED": 1}

    revoked_only = api.get(LIST_URL, {"status": "REVOKED"})
    assert revoked_only.data["count"] == 1
    assert revoked_only.data["results"][0]["status"] == "REVOKED"


def test_search_matches_a_grant_viewer_or_target_id_exactly(api, moderator, viewer, professional):
    broker = make_broker()
    grant = make_contact_grant(viewer=viewer, professional=professional)
    make_contact_grant(viewer=make_user(email="p16-else@example.com"), broker=broker)
    api.force_authenticate(moderator)

    by_grant_id = api.get(LIST_URL, {"q": str(grant.pk)}).data["results"]
    by_viewer_id = api.get(LIST_URL, {"q": str(viewer.pk)}).data["results"]
    by_target_id = api.get(LIST_URL, {"q": str(professional.pk)}).data["results"]

    assert [row["id"] for row in by_grant_id] == [str(grant.pk)]
    assert [row["id"] for row in by_viewer_id] == [str(grant.pk)]
    assert [row["id"] for row in by_target_id] == [str(grant.pk)]


def test_a_malformed_search_term_returns_no_rows_rather_than_erroring(api, moderator, viewer, professional):
    make_contact_grant(viewer=viewer, professional=professional)
    api.force_authenticate(moderator)

    response = api.get(LIST_URL, {"q": "not-a-uuid"})

    assert response.status_code == 200
    assert response.data["count"] == 0


def test_the_response_carries_no_store_cache_headers(api, moderator, viewer, professional):
    make_contact_grant(viewer=viewer, professional=professional)
    api.force_authenticate(moderator)

    response = api.get(LIST_URL)

    assert response["Cache-Control"] == "private, no-store, max-age=0"
