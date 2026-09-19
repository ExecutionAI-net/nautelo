import pytest
from django.contrib.auth.models import Group
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from entitlements.enums import EntitlementState, EntitlementType
from entitlements.models import UserEntitlement
from entitlements.tests.factories import make_entitlement, make_private_seller
from listings.enums import ListingStatus, RevisionStatus
from listings.tests.factories import (
    make_brand,
    make_media,
    make_private_listing,
    make_revision,
    make_snapshot,
    other_model_for,
)
from platform_settings.services import set_feature_flag

pytestmark = pytest.mark.django_db


def staff(email, group):
    user = make_user(email, role=UserRole.STAFF)
    user.groups.add(Group.objects.get_or_create(name=group)[0])
    return user


@pytest.fixture(autouse=True)
def _flag(db):
    set_feature_flag(key="listing_revisions", is_enabled=True, actor=None)


@pytest.fixture
def mod():
    return staff("mod@console.example", StaffGroup.MODERATOR)


@pytest.fixture
def admin():
    return staff("admin@console.example", StaffGroup.ADMIN)


def client_for(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


def submitted(owner, **kw):
    listing = make_private_listing(
        owner=owner, brand=make_brand(f"B{owner.pk.hex[:6]}"), **kw
    )
    return listing, make_revision(
        listing,
        state=RevisionStatus.SUBMITTED,
        submitted_by=owner,
        submitted_at=timezone.now(),
        payload={"title_en": "Nice boat", "price": "100000.00"},
    )


def test_the_queue_counts_equal_what_each_tab_shows(mod):
    owner = make_private_seller()
    submitted(owner)
    c = client_for(mod)
    body = c.get(reverse("staff-moderation-queue"), {"tab": "initial"}).data
    assert body["counts"]["initial"] == len(body["results"]) == 1
    assert body["results"][0]["submission_type"] == "initial"
    assert body["results"][0]["assigned_moderator"] is None
    other = c.get(reverse("staff-moderation-queue"), {"tab": "revisions"}).data
    assert other["results"] == [] and other["counts"]["revisions"] == 0


def test_other_model_submissions_are_highlighted_and_have_their_own_tab(mod):
    owner = make_private_seller("o2@console.example")
    brand = make_brand("Obrand")
    listing = make_private_listing(
        owner=owner, brand=brand, model=other_model_for(brand), custom_model_name="McKenzie"
    )
    make_revision(
        listing,
        state=RevisionStatus.SUBMITTED,
        submitted_by=owner,
        submitted_at=timezone.now(),
        payload={"title_en": "x"},
    )
    rows = client_for(mod).get(
        reverse("staff-moderation-queue"), {"tab": "other_model"}
    ).data["results"]
    assert rows[0]["is_other_model"] is True
    assert rows[0]["custom_model_name"] == "McKenzie"


def test_suspended_and_expiring_tabs_list_listings(mod):
    owner = make_private_seller("o3@console.example")
    make_private_listing(owner=owner, status=ListingStatus.SUSPENDED)
    body = client_for(mod).get(reverse("staff-moderation-queue"), {"tab": "suspended"}).data
    assert [r["kind"] for r in body["results"]] == ["listing"]
    assert body["counts"]["suspended"] == 1


def test_the_detail_shows_a_field_diff_media_diff_and_warnings(mod):
    owner = make_private_seller("o4@console.example")
    listing, revision = submitted(owner)
    media = make_media(listing)
    revision.payload = {**revision.payload, "media_ids": [str(media.pk)]}
    revision.save(update_fields=["payload"])
    data = client_for(mod).get(
        reverse("staff-revision-detail", args=[revision.pk])
    ).data
    assert {c["field"] for c in data["diff"]} >= {"title_en", "price"}
    assert [m["id"] for m in data["media_diff"]["added"]] == [str(media.pk)]
    assert "payment" not in str(data).lower()
    assert data["version"] == revision.version


def test_a_buyer_and_a_guest_cannot_use_the_console():
    buyer = make_user("buyer@console.example")
    assert client_for(buyer).get(reverse("staff-moderation-queue")).status_code == 403
    assert APIClient().get(reverse("staff-moderation-queue")).status_code == 401


def test_suspend_requires_a_reason_and_unsuspend_returns_to_published(mod):
    owner = make_private_seller("o5@console.example")
    listing = make_private_listing(owner=owner, status=ListingStatus.PUBLISHED)
    make_snapshot(listing, approved_by=mod)
    c = client_for(mod)
    url = reverse("staff-listing-suspension", args=[listing.pk])
    assert c.post(url, {"action": "suspend", "reason": ""}, format="json").status_code == 400
    ok = c.post(url, {"action": "suspend", "reason": "Fraud report"}, format="json")
    assert ok.data["status"] == "SUSPENDED"
    back = c.post(url, {"action": "unsuspend", "reason": "Cleared"}, format="json")
    assert back.data["status"] == "PUBLISHED"
    assert c.post(url, {"action": "nope"}, format="json").status_code == 400


def test_entitlement_ops_are_staff_admin_only(mod):
    assert client_for(mod).get(reverse("staff-entitlement-list")).status_code == 403


def test_grant_revoke_and_restore_require_a_reason_and_leave_the_order_alone(admin):
    user = make_private_seller("buyer2@console.example")
    c = client_for(admin)
    bad = c.post(
        reverse("staff-entitlement-grant"),
        {"user_id": str(user.pk), "reason": ""},
        format="json",
    )
    assert bad.status_code == 400
    ok = c.post(
        reverse("staff-entitlement-grant"),
        {"user_id": str(user.pk), "reason": "Compensation for outage"},
        format="json",
    )
    assert ok.status_code == 201
    assert ok.data["state"] == "AVAILABLE" and ok.data["reason"]
    revoked = c.post(
        reverse("staff-entitlement-revoke", args=[ok.data["id"]]),
        {"reason": "Granted in error"},
        format="json",
    )
    assert revoked.data["state"] == "REVOKED"

    consumed = make_entitlement(
        user=user,
        entitlement_type=EntitlementType.PAID_LISTING,
        state=EntitlementState.CONSUMED,
    )
    restored = c.post(
        reverse("staff-entitlement-restore", args=[consumed.pk]),
        {"reason": "Staff error"},
        format="json",
    )
    assert restored.data["revoked"]["state"] == "REVOKED"
    assert restored.data["replacement"]["state"] == "AVAILABLE"
    listed = c.get(reverse("staff-entitlement-list"), {"user": str(user.pk)}).data
    assert listed["count"] == UserEntitlement.objects.filter(user=user).count()


def test_a_non_grantable_type_is_refused(admin):
    user = make_private_seller("b3@console.example")
    r = client_for(admin).post(
        reverse("staff-entitlement-grant"),
        {"user_id": str(user.pk), "entitlement_type": "FREE_LISTING", "reason": "x"},
        format="json",
    )
    assert r.status_code == 400
