"""Spec §16's two payload shapes, asserted as EXACT key sets.

The exactness is the point: a locked payload that merely happens not to contain
a raw value today would silently start containing one the day somebody adds a
field. These tests fail on any added key, in either direction.
"""

from datetime import datetime, timezone as datetime_timezone
from uuid import uuid4

import pytest

from messaging.contact_access import GrantedContact, LockedContact, UnavailableContact
from messaging.contact_payloads import contact_payload


def locked():
    return LockedContact(email_mask="i••••@example.com", phone_mask="+34 ••• ••• ••2")


def granted():
    return GrantedContact(
        email="info@example.com",
        phone="+34900111222",
        website_url="https://example.com",
        granted_at=datetime(2026, 9, 18, 10, 30, tzinfo=datetime_timezone.utc),
        grant_id=uuid4(),
    )


def test_the_locked_payload_matches_spec_16_exactly():
    assert contact_payload(locked()) == {
        "contact": {
            "state": "LOCKED",
            "email_mask": "i••••@example.com",
            "phone_mask": "+34 ••• ••• ••2",
            "unlock_rule": "SEND_INQUIRY",
        }
    }


def test_the_locked_payload_carries_no_raw_key_at_all():
    body = contact_payload(locked())["contact"]

    assert set(body) == {"state", "email_mask", "phone_mask", "unlock_rule"}


def test_the_granted_payload_matches_spec_16_plus_website_url():
    assert contact_payload(granted()) == {
        "contact": {
            "state": "GRANTED",
            "email": "info@example.com",
            "phone": "+34900111222",
            "website_url": "https://example.com",
            "granted_at": "2026-09-18T10:30:00Z",
        }
    }


def test_the_granted_payload_carries_no_mask_and_no_internal_id():
    """Masks are noise once unlocked, and grant_id is an internal handle the
    viewer has no endpoint for."""
    body = contact_payload(granted())["contact"]

    assert set(body) == {"state", "email", "phone", "website_url", "granted_at"}


def test_a_missing_website_is_null_not_absent():
    body = contact_payload(
        GrantedContact(
            email="info@example.com",
            phone="+34900111222",
            website_url=None,
            granted_at=datetime(2026, 9, 18, 10, 30, tzinfo=datetime_timezone.utc),
            grant_id=uuid4(),
        )
    )["contact"]

    assert body["website_url"] is None


def test_a_staff_reveal_reports_a_null_granted_at_rather_than_inventing_one():
    """Spec §5's staff row reveals without a grant; there is no timestamp to
    report, and a fabricated one in an audited payload would be worse than
    null."""
    body = contact_payload(
        GrantedContact(
            email="info@example.com",
            phone="+34900111222",
            website_url=None,
            granted_at=None,
            grant_id=None,
        )
    )["contact"]

    assert body["granted_at"] is None
    assert set(body) == {"state", "email", "phone", "website_url", "granted_at"}


def test_granted_at_is_iso_8601_utc_with_a_z_suffix():
    """Spec §30.2. Same transform as platform_settings.get_public_settings()."""
    body = contact_payload(granted())["contact"]

    assert body["granted_at"].endswith("Z")
    assert "+00:00" not in body["granted_at"]


def test_the_unavailable_payload_says_only_that():
    assert contact_payload(UnavailableContact()) == {"contact": {"state": "UNAVAILABLE"}}


def test_an_unknown_access_type_raises_rather_than_serializing_something():
    """Fail loudly: silently rendering an unknown object is how a leak ships."""
    with pytest.raises(TypeError):
        contact_payload(object())
