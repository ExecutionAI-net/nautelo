import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from listings.tests.factories import make_private_listing
from platform_settings.services import set_feature_flag

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _flag(db):
    set_feature_flag(key="listing_revisions", is_enabled=True, actor=None)


def _client(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


def test_mine_lists_only_my_listings():
    me = make_user(role=UserRole.PRIVATE_SELLER)
    other = make_user(role=UserRole.PRIVATE_SELLER)
    mine = make_private_listing(owner=me)
    make_private_listing(owner=other)
    rows = _client(me).get(reverse("my-listings")).data
    assert [r["id"] for r in rows] == [str(mine.pk)]


def test_workflow_detail_is_owner_only_and_carries_policy():
    me = make_user(role=UserRole.PRIVATE_SELLER)
    other = make_user(role=UserRole.PRIVATE_SELLER)
    listing = make_private_listing(owner=me)
    url = reverse("listing-workflow-detail", kwargs={"listing_id": listing.pk})
    ok = _client(me).get(url)
    assert ok.status_code == 200 and "policy" in ok.data
    assert _client(other).get(url).status_code in (403, 404)
    assert APIClient().get(url).status_code == 401


def test_summary_counts_only_my_listings_by_status():
    me = make_user(role=UserRole.PRIVATE_SELLER)
    other = make_user(role=UserRole.PRIVATE_SELLER)
    make_private_listing(owner=me)
    make_private_listing(owner=other)
    body = _client(me).get(reverse("my-listings-summary")).data
    assert set(body) == {"published", "drafts", "in_review"}
    assert sum(body.values()) <= 1


def test_mine_rows_carry_everything_the_dashboard_card_shows():
    me = make_user(role=UserRole.PRIVATE_SELLER)
    make_private_listing(owner=me)
    row = _client(me).get(reverse("my-listings")).data[0]
    for key in ("price", "currency", "year", "city", "country", "boat_type", "loa_m", "engine", "views", "image_url"):
        assert key in row
    assert row["views"] == 0 and row["image_url"] is None
