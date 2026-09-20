"""Guides (blog) and advertisement banners: public reads and staff CRUD."""

from datetime import timedelta

import pytest
from django.contrib.auth.models import Group
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from content.models import Advertisement, GuideArticle, GuideStatus

pytestmark = pytest.mark.django_db


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def staff_api():
    admin = make_user(email="cms-staff@example.com", role=UserRole.STAFF, verified=True)
    admin.groups.add(Group.objects.get(name=StaffGroup.ADMIN))
    client = APIClient()
    client.force_authenticate(admin)
    return client


@pytest.fixture
def seller_api():
    client = APIClient()
    client.force_authenticate(make_user(email="cms-seller@example.com", role=UserRole.PRIVATE_SELLER, verified=True))
    return client


def test_only_published_guides_are_public(api):
    GuideArticle.objects.create(slug="live", title="Live", status=GuideStatus.PUBLISHED, body="Hello")
    GuideArticle.objects.create(slug="draft", title="Draft", status=GuideStatus.DRAFT)
    body = api.get(reverse("guide-list")).json()
    assert [row["slug"] for row in body["results"]] == ["live"]
    assert api.get(reverse("guide-detail", args=["live"])).json()["body"] == "Hello"
    assert api.get(reverse("guide-detail", args=["draft"])).status_code == 404


def test_publishing_stamps_the_publication_time():
    article = GuideArticle.objects.create(slug="a", title="A", status=GuideStatus.PUBLISHED)
    assert article.published_at is not None


def test_a_scheduled_ad_is_hidden_outside_its_window(api):
    now = timezone.now()
    Advertisement.objects.create(placement="HOME", sponsor="S", headline="Live", is_active=True)
    Advertisement.objects.create(
        placement="HOME", sponsor="S", headline="Future", starts_at=now + timedelta(days=1)
    )
    Advertisement.objects.create(placement="HOME", sponsor="S", headline="Expired", ends_at=now - timedelta(days=1))
    Advertisement.objects.create(placement="HOME", sponsor="S", headline="Off", is_active=False)
    Advertisement.objects.create(placement="GUIDES", sponsor="S", headline="Other place")
    rows = api.get(reverse("ad-list"), {"placement": "home"}).json()
    assert [row["headline"] for row in rows] == ["Live"]


def test_staff_can_create_edit_and_delete_a_guide(staff_api):
    created = staff_api.post(
        reverse("staff-guide-list"),
        {"slug": "tax", "title": "Tax", "status": "PUBLISHED", "category": "Legal"},
        format="json",
    )
    assert created.status_code == 201
    pk = created.json()["id"]
    assert staff_api.patch(reverse("staff-guide-detail", args=[pk]), {"title": "Tax 2"}, format="json").json()["title"] == "Tax 2"
    assert staff_api.delete(reverse("staff-guide-detail", args=[pk])).status_code == 204


def test_ad_end_must_follow_start(staff_api):
    now = timezone.now()
    response = staff_api.post(
        reverse("staff-ad-list"),
        {
            "placement": "HOME",
            "sponsor": "S",
            "headline": "H",
            "starts_at": now.isoformat(),
            "ends_at": (now - timedelta(days=1)).isoformat(),
        },
        format="json",
    )
    assert response.status_code == 400


def test_non_staff_cannot_use_the_staff_endpoints(seller_api, api):
    assert seller_api.get(reverse("staff-guide-list")).status_code == 403
    assert seller_api.get(reverse("staff-ad-list")).status_code == 403
    assert api.get(reverse("staff-ad-list")).status_code in (401, 403)


def test_guide_list_reports_the_published_categories(api):
    GuideArticle.objects.create(slug="a", title="A", category="Maintenance", status=GuideStatus.PUBLISHED)
    GuideArticle.objects.create(slug="b", title="B", category="Legal", status=GuideStatus.PUBLISHED)
    GuideArticle.objects.create(slug="c", title="C", category="Secret", status=GuideStatus.DRAFT)
    assert api.get(reverse("guide-list")).json()["categories"] == ["Legal", "Maintenance"]
