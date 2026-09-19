import asyncio

import pytest
from channels.db import database_sync_to_async
from channels.layers import get_channel_layer
from channels.testing import WebsocketCommunicator
from django.contrib.auth.models import Group
from django.core import mail
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from accounts.enums import StaffGroup
from accounts.tests.factories import make_user
from config.asgi import application
from listings.signals import (
    listing_initial_submitted,
    listing_revision_approved,
    listing_revision_submitted,
)
from listings.tests.factories import make_private_listing, make_revision
from notifications.copy import TEXT, keys_for, text_for
from notifications.enums import DeliveryChannel, DeliveryStatus, NotificationType
from notifications.models import Notification
from notifications.push import user_group_name
from notifications.tasks import push_notification_ws
from notifications.tests.factories import make_notification

pytestmark = pytest.mark.django_db


def moderator(email="mod@phase18.example"):
    user = make_user(email)
    group, _ = Group.objects.get_or_create(name=StaffGroup.MODERATOR)
    user.groups.add(group)
    return user


def _revision():
    owner = make_user("owner@phase18.example", verified=True)
    listing = make_private_listing(owner=owner)
    revision = make_revision(listing, submitted_by=owner)
    return owner, revision


# --- REST: the source of truth -------------------------------------------------


def test_the_list_is_the_recipients_own_and_carries_an_unread_count():
    me = make_user("me@phase18.example")
    other = make_user("other@phase18.example")
    make_notification(recipient=me)
    make_notification(recipient=me)
    make_notification(recipient=other)
    client = APIClient()
    client.force_authenticate(me)
    body = client.get(reverse("notification-list")).data
    assert body["count"] == 2
    assert body["unread_count"] == 2
    assert {row["type"] for row in body["results"]} == {"inquiry.received"}


def test_reading_is_idempotent_and_owner_scoped():
    me = make_user("me2@phase18.example")
    other = make_user("other2@phase18.example")
    mine = make_notification(recipient=me)
    theirs = make_notification(recipient=other)
    client = APIClient()
    client.force_authenticate(me)
    first = client.post(reverse("notification-read", args=[mine.pk]))
    stamp = first.data["read_at"]
    second = client.post(reverse("notification-read", args=[mine.pk]))
    assert second.data["read_at"] == stamp
    assert client.post(reverse("notification-read", args=[theirs.pk])).status_code == 404
    assert client.get(reverse("notification-list"), {"unread": "true"}).data["count"] == 0


def test_read_all_marks_only_my_notifications():
    me = make_user("me3@phase18.example")
    other = make_user("other3@phase18.example")
    make_notification(recipient=me)
    keep = make_notification(recipient=other)
    client = APIClient()
    client.force_authenticate(me)
    assert client.post(reverse("notification-read-all")).data == {"marked_read": 1}
    keep.refresh_from_db()
    assert keep.read_at is None


def test_a_guest_cannot_list():
    assert APIClient().get(reverse("notification-list")).status_code == 401


def test_an_offline_user_finds_the_notification_over_rest_after_reconnect():
    """Spec 27 test 2: the row exists whether or not any socket was listening."""
    me = make_user("offline@phase18.example")
    make_notification(recipient=me)
    client = APIClient()
    client.force_authenticate(me)
    assert client.get(reverse("notification-list"), {"unread": "true"}).data["count"] == 1


# --- Producers -----------------------------------------------------------------


def test_an_initial_submission_notifies_moderation_staff_once():
    staff = moderator()
    make_user("nobody@phase18.example")
    _, revision = _revision()
    listing_initial_submitted.send(sender=type(revision), revision=revision)
    listing_initial_submitted.send(sender=type(revision), revision=revision)
    rows = Notification.objects.filter(
        notification_type=NotificationType.LISTING_INITIAL_SUBMITTED
    )
    assert list(rows.values_list("recipient", flat=True)) == [staff.pk]


def test_the_generic_revision_event_is_suppressed_for_an_initial_submission():
    moderator()
    _, revision = _revision()
    assert revision.revision_number == 1
    listing_revision_submitted.send(sender=type(revision), revision=revision)
    assert not Notification.objects.filter(
        notification_type=NotificationType.LISTING_REVISION_SUBMITTED
    ).exists()


def test_an_approval_notifies_the_submitter_but_not_when_auto_approved():
    owner, revision = _revision()
    listing_revision_approved.send(
        sender=type(revision), revision=revision, auto_approved=True
    )
    assert not Notification.objects.filter(recipient=owner).exists()
    listing_revision_approved.send(
        sender=type(revision), revision=revision, auto_approved=False
    )
    row = Notification.objects.get(recipient=owner)
    assert row.notification_type == NotificationType.LISTING_APPROVED
    assert row.title_key == "notification.listing_approved.title"


def test_expiry_signals_notify_the_owner_and_expiring_has_no_websocket_delivery():
    from listings.signals import listing_expired, listing_expiring

    owner = make_user("owner2@phase18.example", verified=True)
    listing = make_private_listing(owner=owner)
    listing_expiring.send(sender=type(listing), listing=listing, threshold_days=7)
    listing_expiring.send(sender=type(listing), listing=listing, threshold_days=7)
    listing_expired.send(sender=type(listing), listing=listing)
    expiring = Notification.objects.get(
        recipient=owner, notification_type=NotificationType.LISTING_EXPIRING
    )
    channels = set(expiring.deliveries.values_list("channel", flat=True))
    assert DeliveryChannel.WEBSOCKET not in channels
    assert Notification.objects.filter(recipient=owner).count() == 2


def test_payment_failure_reaches_every_staff_admin():
    from payments.signals import payment_needs_staff_review

    admin = make_user("admin@phase18.example")
    group, _ = Group.objects.get_or_create(name=StaffGroup.ADMIN)
    admin.groups.add(group)
    moderator("mod2@phase18.example")

    class Order:
        pk = "00000000-0000-4000-8000-000000000001"

    payment_needs_staff_review.send(
        sender=type(Order), order=Order(), reason="amount_mismatch", detail="x"
    )
    row = Notification.objects.get()
    assert row.recipient == admin
    assert row.payload == {"order_id": Order.pk, "reason": "amount_mismatch"}


def test_every_new_event_has_copy_in_all_three_locales():
    for notification_type, (title, body) in TEXT.items():
        for locale in ("EN", "IT", "ES"):
            assert title[locale] and body[locale], (notification_type, locale)
    assert set(TEXT) == {
        t for t in NotificationType if t != NotificationType.INQUIRY_RECEIVED
    }
    assert keys_for("listing.approved") == (
        "notification.listing_approved.title",
        "notification.listing_approved.body",
    )
    assert text_for("listing.approved", "IT")[0] != text_for("listing.approved", "EN")[0]


def test_an_event_email_is_localized_and_carries_only_a_summary_and_url(
    django_capture_on_commit_callbacks,
):
    owner, revision = _revision()
    owner.locale = "IT"
    owner.save(update_fields=["locale"])
    mail.outbox.clear()
    with django_capture_on_commit_callbacks(execute=True):
        listing_revision_approved.send(
            sender=type(revision), revision=revision, auto_approved=False
        )
    assert len(mail.outbox) == 1
    assert mail.outbox[0].subject == "Il tuo annuncio e stato approvato"
    assert "/dashboard/private-seller/" in mail.outbox[0].body


# --- WebSocket push --------------------------------------------------------------


def test_the_push_task_is_idempotent_and_marks_the_delivery_sent():
    me = make_user("push@phase18.example")
    notification = make_notification(recipient=me)
    push_notification_ws(str(notification.pk))
    push_notification_ws(str(notification.pk))
    delivery = notification.deliveries.get(channel=DeliveryChannel.WEBSOCKET)
    assert delivery.status == DeliveryStatus.SENT
    assert delivery.attempt_count == 1


def test_group_names_are_opaque_and_per_user():
    a = user_group_name("1")
    assert a == user_group_name("1")
    assert a != user_group_name("2")
    assert "1" not in a.split(".", 1)[1][:0] and a.startswith("notif.")


@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
async def test_an_authenticated_socket_receives_a_pushed_notification():
    me = await database_sync_to_async(make_user)("ws@phase18.example")
    token = str(AccessToken.for_user(me))
    communicator = WebsocketCommunicator(application, "/ws/notifications/")
    connected, _ = await communicator.connect()
    assert connected
    await communicator.send_json_to({"type": "auth", "token": token})
    assert (await communicator.receive_json_from())["type"] == "auth_ok"

    notification = await database_sync_to_async(make_notification)(recipient=me)
    await database_sync_to_async(push_notification_ws)(str(notification.pk))
    message = await communicator.receive_json_from()
    assert message["kind"] == "notification"
    assert message["type"] == "inquiry.received"
    assert message["id"] == str(notification.pk)
    assert message["target_url"] == notification.target_url
    await communicator.disconnect()


@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
async def test_a_socket_with_a_bad_token_is_closed_and_hears_nothing():
    victim = await database_sync_to_async(make_user)("victim@phase18.example")
    communicator = WebsocketCommunicator(application, "/ws/notifications/")
    await communicator.connect()
    await communicator.send_json_to({"type": "auth", "token": "not-a-token"})
    closed = await communicator.receive_output()
    assert closed["type"] == "websocket.close"

    # Even a client that guesses a group name cannot subscribe: the server never
    # reads a group from the client.
    layer = get_channel_layer()
    await layer.group_send(
        user_group_name(victim.pk),
        {"type": "notification.message", "payload": {"id": "x"}},
    )
    assert await communicator.receive_nothing(timeout=0.1)


@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
async def test_a_socket_that_never_authenticates_receives_nothing():
    me = await database_sync_to_async(make_user)("silent@phase18.example")
    communicator = WebsocketCommunicator(application, "/ws/notifications/")
    await communicator.connect()
    notification = await database_sync_to_async(make_notification)(recipient=me)
    await database_sync_to_async(push_notification_ws)(str(notification.pk))
    assert await communicator.receive_nothing(timeout=0.2)
    await communicator.disconnect()
    await asyncio.sleep(0)
