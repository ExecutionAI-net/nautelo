import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.tests.factories import make_user
from notifications.models import NotificationDelivery
from notifications.services import create_notification

pytestmark = pytest.mark.django_db


def _notify(user):
    return create_notification(
        recipient=user,
        notification_type="listing.approved",
        title_key="notification.listing_approved.title",
        body_key="notification.listing_approved.body",
        target_url="/dashboard/",
        email_to=user.email,
    )


def test_preferences_default_to_email_on_and_can_be_switched_off():
    user = make_user()
    client = APIClient()
    client.force_authenticate(user)
    url = reverse("notification-preferences")
    assert client.get(url).data == {"email_enabled": True}
    assert client.patch(url, {"email_enabled": False}, format="json").data == {
        "email_enabled": False
    }
    assert client.get(url).data == {"email_enabled": False}
    assert client.patch(url, {"email_enabled": "no"}, format="json").status_code == 400


def test_opting_out_skips_the_email_delivery_but_keeps_the_in_app_one(monkeypatch):
    monkeypatch.setattr("django.db.transaction.on_commit", lambda fn: None)
    opted_in, opted_out = make_user(), make_user()
    client = APIClient()
    client.force_authenticate(opted_out)
    client.patch(reverse("notification-preferences"), {"email_enabled": False}, format="json")

    kept = _notify(opted_in)
    skipped = _notify(opted_out)

    assert NotificationDelivery.objects.filter(notification=kept, channel="EMAIL").exists()
    assert not NotificationDelivery.objects.filter(notification=skipped, channel="EMAIL").exists()
    assert NotificationDelivery.objects.filter(notification=skipped, channel="IN_APP").exists()


def test_anonymous_callers_are_refused():
    assert APIClient().get(reverse("notification-preferences")).status_code == 401
