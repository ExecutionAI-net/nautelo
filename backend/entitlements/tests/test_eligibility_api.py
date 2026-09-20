"""Spec §30.1's `GET /api/v1/listing-eligibility/`.

Every assertion reads the real wire output (`response.json()`), not
`response.data`, so serialization of datetimes and null-vs-missing keys is
exercised as the client sees it.
"""

from datetime import UTC, timedelta

import pytest
from django.contrib.auth.models import Group
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from audit.models import AuditEvent
from entitlements.enums import (
    EntitlementSource,
    EntitlementState,
    EntitlementType,
)
from entitlements.models import UserEntitlement
from entitlements.tests.factories import make_entitlement, make_private_seller

URL_NAME = "listing-eligibility"
TOP_LEVEL_KEYS = [
    "can_start_listing",
    "recommended_entitlement",
    "free",
    "paid_listing_rights_available",
    "blocking_reason",
    "purchase_product_code",
]


@pytest.fixture
def api():
    return APIClient()


def _iso(dt):
    """DRF's JSON encoder: ISO 8601, microseconds kept, `+00:00` -> `Z`."""
    return dt.astimezone(UTC).isoformat().replace("+00:00", "Z")


def _consume_free(user, *, when):
    return make_entitlement(
        user=user,
        entitlement_type=EntitlementType.FREE_LISTING,
        state=EntitlementState.CONSUMED,
        valid_from=when,
        valid_until=when + timedelta(days=365),
        consumed_at=when,
    )


# --- authentication / permission branches, one class at a time ---------------


@pytest.mark.django_db
def test_anonymous_callers_get_401(api):
    response = api.get(reverse(URL_NAME))

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "not_authenticated"


@pytest.mark.django_db
def test_an_inactive_authenticated_user_is_denied(api):
    user = make_user(
        "inactive@example.com",
        role=UserRole.PRIVATE_SELLER,
        verified=True,
        is_active=False,
    )
    api.force_authenticate(user)

    response = api.get(reverse(URL_NAME))

    assert response.status_code == 403
    # IsActiveUser comes before IsEmailVerified, so ITS code must be the one
    # on the wire (proves IsActiveUser itself ran and rejected).
    assert response.json()["error"]["code"] == "authentication_required"


@pytest.mark.django_db
def test_an_unverified_account_is_refused_with_a_stable_code(api):
    user = make_user(
        "unverified@example.com", role=UserRole.PRIVATE_SELLER, verified=False
    )
    api.force_authenticate(user)

    response = api.get(reverse(URL_NAME))

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "email_not_verified"


@pytest.mark.django_db
def test_a_verified_private_seller_is_admitted(api):
    api.force_authenticate(make_private_seller())

    assert api.get(reverse(URL_NAME)).status_code == 200


# --- payload scenarios (flag on) ---------------------------------------------


@pytest.mark.django_db
def test_a_fresh_seller_sees_the_full_spec_22_2_payload(api, entitlements_enforced):
    api.force_authenticate(make_private_seller())

    response = api.get(reverse(URL_NAME))

    assert response.status_code == 200
    assert response["Content-Type"].startswith("application/json")
    assert response.json() == {
        "can_start_listing": True,
        "recommended_entitlement": {
            "entitlement_id": None,
            "entitlement_type": "FREE_LISTING",
            "source": EntitlementSource.FREE_POLICY,
            "valid_until": None,
            "publication_days": 30,
        },
        "free": {
            "available": True,
            "used_at": None,
            "next_available_at": None,
            "publication_days": 30,
        },
        "paid_listing_rights_available": 0,
        "blocking_reason": None,
        "purchase_product_code": "INDIVIDUAL_LISTING_RIGHT",
    }
    assert list(response.json()) == TOP_LEVEL_KEYS


@pytest.mark.django_db
def test_an_exhausted_seller_sees_the_blocking_reason_and_iso_timestamps(
    api, entitlements_enforced
):
    user = make_private_seller()
    used = timezone.now() - timedelta(days=30)
    _consume_free(user, when=used)
    api.force_authenticate(user)

    body = api.get(reverse(URL_NAME)).json()

    assert body["can_start_listing"] is False
    assert body["blocking_reason"] == "FREE_ALLOWANCE_USED"
    assert body["recommended_entitlement"] is None
    assert body["free"]["available"] is False
    assert body["free"]["used_at"] == _iso(used)
    # Spec §31: "Free-right copy/countdown ... exact next eligibility date".
    next_at = body["free"]["next_available_at"]
    assert isinstance(next_at, str)
    assert next_at.endswith("Z")
    assert next_at > body["free"]["used_at"]
    assert body["purchase_product_code"] == "INDIVIDUAL_LISTING_RIGHT"


@pytest.mark.django_db
def test_an_available_paid_right_is_recommended_once_free_is_used(
    api, entitlements_enforced
):
    user = make_private_seller()
    _consume_free(user, when=timezone.now() - timedelta(days=1))
    valid_from = timezone.now() - timedelta(days=1)
    valid_until = timezone.now() + timedelta(days=60)
    right = make_entitlement(
        user=user,
        entitlement_type=EntitlementType.PAID_LISTING,
        source=EntitlementSource.STAFF_GRANT,
        valid_from=valid_from,
        valid_until=valid_until,
    )
    api.force_authenticate(user)

    body = api.get(reverse(URL_NAME)).json()

    assert body["can_start_listing"] is True
    assert body["blocking_reason"] is None
    assert body["paid_listing_rights_available"] == 1
    rec = body["recommended_entitlement"]
    assert rec["entitlement_id"] == str(right.pk)
    assert rec["entitlement_type"] == "PAID_LISTING"
    assert rec["source"] == EntitlementSource.STAFF_GRANT
    assert rec["valid_until"] == _iso(valid_until)
    assert body["free"]["available"] is False


@pytest.mark.django_db
def test_one_seller_never_sees_another_sellers_quota(api, entitlements_enforced):
    mine = make_private_seller("mine@example.com")
    theirs = make_private_seller("theirs@example.com")
    _consume_free(theirs, when=timezone.now())
    make_entitlement(
        user=theirs,
        entitlement_type=EntitlementType.PAID_LISTING,
        source=EntitlementSource.STAFF_GRANT,
    )
    api.force_authenticate(mine)

    body = api.get(reverse(URL_NAME)).json()

    assert body["can_start_listing"] is True
    assert body["free"]["used_at"] is None
    assert body["paid_listing_rights_available"] == 0


# --- non-seller roles: the payload, not a denial -----------------------------


@pytest.mark.django_db
@pytest.mark.parametrize(
    "role", [UserRole.BROKER, UserRole.BUYER, UserRole.SERVICE_PROVIDER]
)
@pytest.mark.parametrize("flag_on", [True, False])
def test_non_seller_roles_get_the_payload_with_a_blocking_reason(
    api, role, flag_on
):
    if flag_on:
        from platform_settings.services import set_feature_flag

        set_feature_flag(key="individual_entitlements", is_enabled=True, actor=None)
    api.force_authenticate(make_user(f"{role}@example.com", role=role, verified=True))

    response = api.get(reverse(URL_NAME))

    assert response.status_code == 200
    body = response.json()
    assert body["can_start_listing"] is False
    assert body["blocking_reason"] == "NOT_AN_INDIVIDUAL_SELLER"
    assert body["recommended_entitlement"] is None
    assert body["purchase_product_code"] == "INDIVIDUAL_LISTING_RIGHT"


def _staff(email, group):
    user = make_user(email, role=UserRole.STAFF, verified=True)
    if group is not None:
        user.groups.add(Group.objects.get_or_create(name=group)[0])
    return user


@pytest.mark.django_db
def test_a_staff_moderator_gets_can_start_false_with_a_blocking_reason(api):
    api.force_authenticate(_staff("mod@example.com", StaffGroup.MODERATOR))

    body = api.get(reverse(URL_NAME)).json()

    assert body["can_start_listing"] is False
    assert body["blocking_reason"] == "NOT_AN_INDIVIDUAL_SELLER"


@pytest.mark.django_db
def test_a_staff_admin_may_start_a_listing(api):
    api.force_authenticate(_staff("admin@example.com", StaffGroup.ADMIN))

    body = api.get(reverse(URL_NAME)).json()

    assert body["can_start_listing"] is True
    assert body["blocking_reason"] is None


# --- feature flag ------------------------------------------------------------


@pytest.mark.django_db
def test_with_enforcement_off_an_exhausted_seller_is_still_allowed(api):
    """Flag off (the default): reachable, everything allowed, `free` truthful."""
    user = make_private_seller()
    used = timezone.now() - timedelta(days=2)
    _consume_free(user, when=used)
    api.force_authenticate(user)

    response = api.get(reverse(URL_NAME))

    assert response.status_code == 200
    body = response.json()
    assert body["can_start_listing"] is True
    assert body["blocking_reason"] is None
    assert body["recommended_entitlement"] is None
    assert body["free"]["available"] is False
    assert body["free"]["used_at"] == _iso(used)


# --- read-only ---------------------------------------------------------------


@pytest.mark.django_db
@pytest.mark.parametrize("method", ["post", "put", "patch", "delete"])
def test_the_endpoint_is_read_only(api, entitlements_enforced, method):
    api.force_authenticate(make_private_seller())

    response = getattr(api, method)(reverse(URL_NAME), {}, format="json")

    assert response.status_code == 405


@pytest.mark.django_db
def test_a_get_writes_nothing(api, entitlements_enforced):
    user = make_private_seller()
    _consume_free(user, when=timezone.now() - timedelta(days=3))
    api.force_authenticate(user)
    api.get(reverse(URL_NAME))  # warm caches
    rows_before = list(UserEntitlement.objects.values_list("pk", "state", "updated_at"))
    audit_before = AuditEvent.objects.count()

    with CaptureQueriesContext(connection) as ctx:
        assert api.get(reverse(URL_NAME)).status_code == 200

    writes = [
        q["sql"]
        for q in ctx.captured_queries
        if q["sql"].lstrip().upper().startswith(("INSERT", "UPDATE", "DELETE"))
    ]
    assert writes == []
    assert (
        list(UserEntitlement.objects.values_list("pk", "state", "updated_at"))
        == rows_before
    )
    assert AuditEvent.objects.count() == audit_before


@pytest.mark.django_db
def test_the_query_count_is_constant_across_ledger_sizes(api, entitlements_enforced):
    user = make_private_seller()
    api.force_authenticate(user)
    api.get(reverse(URL_NAME))  # warm caches

    def count():
        with CaptureQueriesContext(connection) as ctx:
            assert api.get(reverse(URL_NAME)).status_code == 200
        return len(ctx.captured_queries)

    _consume_free(user, when=timezone.now() - timedelta(days=1))
    small = count()
    for _ in range(15):
        make_entitlement(
            user=user,
            entitlement_type=EntitlementType.PAID_LISTING,
            source=EntitlementSource.STAFF_GRANT,
        )
    large = count()

    assert large == small
    assert large <= 8


# --- throttling --------------------------------------------------------------


@pytest.mark.django_db
def test_the_scope_rate_is_configured_and_enforced(api, monkeypatch):
    from django.conf import settings
    from rest_framework.throttling import ScopedRateThrottle

    from conftest import clear_own_cache_keys

    assert (
        settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["listing_eligibility"]
        == "120/min"
    )
    api.force_authenticate(make_private_seller())
    clear_own_cache_keys()
    # DRF binds THROTTLE_RATES at import time, so patch the class dict (see
    # listings/tests/test_public_read_api.py for the same reasoning).
    monkeypatch.setitem(ScopedRateThrottle.THROTTLE_RATES, "listing_eligibility", "2/min")

    assert api.get(reverse(URL_NAME)).status_code == 200
    assert api.get(reverse(URL_NAME)).status_code == 200
    assert api.get(reverse(URL_NAME)).status_code == 429


@pytest.mark.django_db
def test_the_throttle_key_contains_no_raw_ip(api):
    from django.core.cache import cache

    from conftest import clear_own_cache_keys

    api.force_authenticate(make_private_seller())
    clear_own_cache_keys()
    raw_ip = "203.0.113.77"

    assert api.get(reverse(URL_NAME), REMOTE_ADDR=raw_ip).status_code == 200

    client = cache._cache.get_client(write=True)
    keys = [
        k.decode() if isinstance(k, bytes) else k
        for k in client.scan_iter(match="*throttle_listing_eligibility*")
    ]
    assert keys, "the scope must have written a throttle key"
    assert all(raw_ip not in k for k in keys)


def test_the_view_declares_only_the_scope_and_no_throttle_classes():
    from entitlements.views import ListingEligibilityView

    assert ListingEligibilityView.throttle_scope == "listing_eligibility"
    assert "throttle_classes" not in vars(ListingEligibilityView)


@pytest.mark.django_db
def test_my_paid_listings_groups_unused_rights_by_package():
    from django.urls import reverse
    from rest_framework.test import APIClient

    from entitlements.enums import EntitlementType
    from entitlements.tests.factories import make_entitlement, make_private_seller

    seller = make_private_seller()
    meta = {"package": "1-month", "publication_days": 30, "image_limit": 20, "video_limit": 1}
    make_entitlement(user=seller, entitlement_type=EntitlementType.PAID_LISTING, metadata=meta)
    make_entitlement(user=seller, entitlement_type=EntitlementType.PAID_LISTING, metadata=meta)
    api = APIClient()
    api.force_authenticate(seller)

    response = api.get(reverse("my-paid-listings"))

    assert response.status_code == 200
    assert response.data["results"] == [{**meta, "count": 2}]
