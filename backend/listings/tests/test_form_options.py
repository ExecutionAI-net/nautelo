import datetime

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from listings.form_options import OLDEST_YEAR, form_options

pytestmark = pytest.mark.django_db


def test_years_start_at_the_current_year_and_reach_1900():
    years = form_options(datetime.datetime(2031, 3, 1, tzinfo=datetime.timezone.utc))["years"]
    assert years[0] == 2031 and years[-1] == OLDEST_YEAR
    assert len(years) == len(set(years))


def test_options_endpoint_serves_every_list_to_a_signed_in_user():
    api = APIClient()
    api.force_authenticate(make_user(email="opt@example.com", role=UserRole.PRIVATE_SELLER, verified=True))
    body = api.get(reverse("listing-form-options")).json()
    for key in ("years", "hull_materials", "engine_types", "fuel_types", "cabins", "bathrooms", "countries", "boat_types"):
        assert body[key]
    assert {"TR", "US", "CA", "RU", "DE", "IT", "ES"} <= set(body["countries"])
    assert APIClient().get(reverse("listing-form-options")).status_code in (401, 403)


def test_options_carry_the_media_limits_staff_configure():
    limits = form_options()["media_limits"]
    assert limits == {
        "free_images": 1, "free_videos": 0,
        "paid_images": 20, "paid_videos": 1,
        "broker_images": 20, "broker_videos": 1,
    }
