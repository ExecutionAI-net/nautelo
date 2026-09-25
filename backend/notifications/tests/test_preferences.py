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


ALL_ON = {"email_enabled": True, "messages_enabled": True, "listings_enabled": True, "billing_enabled": True}


def test_preferences_default_to_every_switch_on_and_can_be_switched_off():
    user = make_user()
    client = APIClient()
    client.force_authenticate(user)
    url = reverse("notification-preferences")
    assert client.get(url).data == ALL_ON
    assert client.patch(url, {"email_enabled": False}, format="json").data == {**ALL_ON, "email_enabled": False}
    assert client.get(url).data == {**ALL_ON, "email_enabled": False}
    assert client.patch(url, {"email_enabled": "no"}, format="json").status_code == 400
    assert client.patch(url, {}, format="json").status_code == 400


def test_a_single_category_can_be_switched_off_independently():
    user = make_user()
    client = APIClient()
    client.force_authenticate(user)
    url = reverse("notification-preferences")

    response = client.patch(url, {"listings_enabled": False}, format="json")

    assert response.data == {**ALL_ON, "listings_enabled": False}
    assert client.get(url).data["messages_enabled"] is True


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


def test_a_muted_category_skips_only_that_categorys_email(monkeypatch):
    monkeypatch.setattr("django.db.transaction.on_commit", lambda fn: None)
    user = make_user()
    client = APIClient()
    client.force_authenticate(user)
    client.patch(reverse("notification-preferences"), {"listings_enabled": False}, format="json")

    listing_notification = _notify(user)
    message_notification = create_notification(
        recipient=user,
        notification_type="inquiry.received",
        title_key="notification.inquiry_received.title",
        body_key="notification.inquiry_received.body",
        target_url="/dashboard/",
        email_to=user.email,
    )

    assert not NotificationDelivery.objects.filter(notification=listing_notification, channel="EMAIL").exists()
    assert NotificationDelivery.objects.filter(notification=message_notification, channel="EMAIL").exists()


def test_anonymous_callers_are_refused():
    assert APIClient().get(reverse("notification-preferences")).status_code == 401
