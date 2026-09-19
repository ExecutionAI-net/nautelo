"""Spec 11.10's Notification and NotificationDelivery, and spec 27.3's "queue
only after commit" rule."""

import pytest
from django.db import IntegrityError, transaction

from accounts.tests.factories import make_user
from notifications.enums import DeliveryChannel, DeliveryStatus, NotificationType
from notifications.models import Notification, NotificationDelivery
from notifications.services import create_notification

pytestmark = pytest.mark.django_db


def test_enum_values_match_spec_11_10_and_27_1():
    assert NotificationType.INQUIRY_RECEIVED == "inquiry.received"
    assert [choice.value for choice in DeliveryChannel] == [
        "IN_APP",
        "WEBSOCKET",
        "EMAIL",
    ]
    assert [choice.value for choice in DeliveryStatus] == [
        "QUEUED",
        "SENT",
        "FAILED",
        "SKIPPED",
    ]


def test_create_notification_writes_the_in_app_row_and_marks_it_sent():
    recipient = make_user(email="recipient@phase6.example")
    notification = create_notification(
        recipient=recipient,
        notification_type=NotificationType.INQUIRY_RECEIVED,
        title_key="notification.inquiry_received.title",
        body_key="notification.inquiry_received.body",
        target_url="/dashboard/messages/abc/",
        payload={"excerpt": "Hello there"},
    )
    assert notification.read_at is None
    in_app = notification.deliveries.get(channel=DeliveryChannel.IN_APP)
    # The in-app "delivery" IS the row existing - there is nothing left to do
    # asynchronously, so QUEUED would be a state nothing ever leaves.
    assert in_app.status == DeliveryStatus.SENT
    assert in_app.sent_at is not None


def test_no_email_delivery_row_exists_when_no_address_is_supplied():
    notification = create_notification(
        recipient=make_user(email="recipient2@phase6.example"),
        notification_type=NotificationType.INQUIRY_RECEIVED,
        title_key="notification.inquiry_received.title",
        body_key="notification.inquiry_received.body",
        target_url="/dashboard/messages/abc/",
    )
    assert notification.deliveries.filter(channel=DeliveryChannel.EMAIL).exists() is False


def test_an_inquiry_notification_has_in_app_websocket_and_email_deliveries():
    """Spec 27.1: inquiry.received goes to in-app, WS and email."""
    notification = create_notification(
        recipient=make_user(email="recipient3@phase6.example"),
        notification_type=NotificationType.INQUIRY_RECEIVED,
        title_key="notification.inquiry_received.title",
        body_key="notification.inquiry_received.body",
        target_url="/dashboard/messages/abc/",
        email_to="someone@phase6.example",
    )
    assert set(notification.deliveries.values_list("channel", flat=True)) == {
        DeliveryChannel.IN_APP,
        DeliveryChannel.WEBSOCKET,
        DeliveryChannel.EMAIL,
    }


def test_one_delivery_row_per_channel_is_enforced_by_the_database():
    notification = create_notification(
        recipient=make_user(email="recipient4@phase6.example"),
        notification_type=NotificationType.INQUIRY_RECEIVED,
        title_key="notification.inquiry_received.title",
        body_key="notification.inquiry_received.body",
        target_url="/dashboard/messages/abc/",
    )
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            NotificationDelivery.objects.create(
                notification=notification, channel=DeliveryChannel.IN_APP
            )


def test_a_repeated_dedupe_key_returns_the_same_row_and_adds_no_delivery():
    """Spec 27.1 gives `inquiry.received` a deduplication key (the message ID)
    and spec 27's acceptance tests require that "Retried task does not create
    duplicate in-app notification/delivery"."""
    recipient = make_user(email="dedupe@phase6.example")
    kwargs = {
        "recipient": recipient,
        "notification_type": NotificationType.INQUIRY_RECEIVED,
        "title_key": "notification.inquiry_received.title",
        "body_key": "notification.inquiry_received.body",
        "target_url": "/dashboard/messages/abc/",
        "dedupe_key": "message-1",
    }
    first = create_notification(**kwargs)
    second = create_notification(**kwargs)

    assert second.pk == first.pk
    assert Notification.objects.count() == 1
    assert first.deliveries.count() == 2  # IN_APP + WEBSOCKET


def test_a_repeated_dedupe_key_queues_no_second_email():
    recipient = make_user(email="dedupe2@phase6.example")
    kwargs = {
        "recipient": recipient,
        "notification_type": NotificationType.INQUIRY_RECEIVED,
        "title_key": "notification.inquiry_received.title",
        "body_key": "notification.inquiry_received.body",
        "target_url": "/dashboard/messages/abc/",
        "dedupe_key": "message-2",
        "email_to": "office@phase6.example",
    }
    first = create_notification(**kwargs)
    create_notification(**kwargs)

    assert first.deliveries.filter(channel=DeliveryChannel.EMAIL).count() == 1


def test_the_same_key_for_two_recipients_is_two_notifications():
    """Spec 15.4: one message legitimately notifies every broker team member
    with can_read_messages. The constraint is scoped per recipient for exactly
    that reason."""
    kwargs = {
        "notification_type": NotificationType.INQUIRY_RECEIVED,
        "title_key": "notification.inquiry_received.title",
        "body_key": "notification.inquiry_received.body",
        "target_url": "/dashboard/messages/abc/",
        "dedupe_key": "message-3",
    }
    create_notification(recipient=make_user(email="dd-a@phase6.example"), **kwargs)
    create_notification(recipient=make_user(email="dd-b@phase6.example"), **kwargs)

    assert Notification.objects.filter(dedupe_key="message-3").count() == 2


def test_a_blank_dedupe_key_is_never_deduplicated():
    """An event type with no natural key must still be creatable more than once;
    the unique index is partial and exempts the empty string."""
    recipient = make_user(email="dedupe3@phase6.example")
    for _ in range(2):
        create_notification(
            recipient=recipient,
            notification_type=NotificationType.INQUIRY_RECEIVED,
            title_key="notification.inquiry_received.title",
            body_key="notification.inquiry_received.body",
            target_url="/dashboard/messages/abc/",
        )
    assert Notification.objects.filter(recipient=recipient).count() == 2


def test_notifications_are_ordered_newest_first():
    recipient = make_user(email="recipient5@phase6.example")
    first = create_notification(
        recipient=recipient,
        notification_type=NotificationType.INQUIRY_RECEIVED,
        title_key="notification.inquiry_received.title",
        body_key="notification.inquiry_received.body",
        target_url="/dashboard/messages/a/",
    )
    second = create_notification(
        recipient=recipient,
        notification_type=NotificationType.INQUIRY_RECEIVED,
        title_key="notification.inquiry_received.title",
        body_key="notification.inquiry_received.body",
        target_url="/dashboard/messages/b/",
    )
    assert list(Notification.objects.filter(recipient=recipient)) == [second, first]


# ---------------------------------------------------------------------------
# The partial unique index itself, asserted at the DATABASE boundary.
#
# Every test above goes through create_notification(), which returns the
# existing row before the database is ever asked to refuse anything - so all of
# them still pass against a model whose constraint was deleted. These four go
# around the service and write rows directly, which is the only way the index is
# the thing under test.
# ---------------------------------------------------------------------------


def _row(recipient, *, dedupe_key, notification_type=NotificationType.INQUIRY_RECEIVED):
    return Notification.objects.create(
        recipient=recipient,
        notification_type=notification_type,
        title_key="notification.inquiry_received.title",
        body_key="notification.inquiry_received.body",
        target_url="/dashboard/messages/abc/",
        dedupe_key=dedupe_key,
    )


def test_the_database_refuses_a_second_row_with_the_same_recipient_type_and_key():
    recipient = make_user(email="idx-a@phase6.example")
    _row(recipient, dedupe_key="msg-idx-1")

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            _row(recipient, dedupe_key="msg-idx-1")


def test_the_database_allows_the_same_key_for_a_different_recipient():
    _row(make_user(email="idx-b@phase6.example"), dedupe_key="msg-idx-2")
    _row(make_user(email="idx-c@phase6.example"), dedupe_key="msg-idx-2")

    assert Notification.objects.filter(dedupe_key="msg-idx-2").count() == 2


def test_the_database_allows_the_same_key_for_a_different_notification_type():
    """The index is scoped by type as well: Phase 18 appends ten more event
    names to spec 27.1's table, and two different events about the same message
    share that message's ID as their key."""
    recipient = make_user(email="idx-d@phase6.example")
    _row(recipient, dedupe_key="msg-idx-3")
    _row(recipient, dedupe_key="msg-idx-3", notification_type="listing.approved")

    assert Notification.objects.filter(dedupe_key="msg-idx-3").count() == 2


def test_the_database_never_deduplicates_the_empty_key():
    recipient = make_user(email="idx-e@phase6.example")
    _row(recipient, dedupe_key="")
    _row(recipient, dedupe_key="")

    assert Notification.objects.filter(recipient=recipient, dedupe_key="").count() == 2


def test_losing_the_create_race_returns_the_winners_row_without_breaking_the_outer_transaction(
    monkeypatch,
):
    """The race the partial index exists to settle, and the savepoint that keeps
    it survivable.

    Two workers handling the same message both find no row and both INSERT; the
    index refuses the loser. The loser must (a) end up with the winner's row and
    (b) leave its CALLER's transaction usable - create_notification runs inside
    the caller's `atomic()` block (spec 15.3), and an IntegrityError raised
    inside an atomic block with no savepoint marks the whole transaction broken,
    so every later statement fails with TransactionManagementError and the
    caller's own business write is lost to a notification detail.

    The race is forced rather than threaded: the lookup is made to miss once,
    exactly as it would for a worker whose SELECT ran before the other worker's
    INSERT committed.
    """
    recipient = make_user(email="race@phase6.example")
    kwargs = {
        "recipient": recipient,
        "notification_type": NotificationType.INQUIRY_RECEIVED,
        "title_key": "notification.inquiry_received.title",
        "body_key": "notification.inquiry_received.body",
        "target_url": "/dashboard/messages/abc/",
        "dedupe_key": "raced-message",
    }
    winner = create_notification(**kwargs)

    from notifications import services

    real_find = services._find_deduplicated
    calls = {"n": 0}

    def find_but_miss_the_first_time(**lookup):
        calls["n"] += 1
        if calls["n"] == 1:
            return None
        return real_find(**lookup)

    monkeypatch.setattr(services, "_find_deduplicated", find_but_miss_the_first_time)

    with transaction.atomic():
        loser = create_notification(**kwargs)
        # The outer transaction must still be usable after the swallowed
        # IntegrityError; without a savepoint this line raises
        # TransactionManagementError instead of returning a count.
        assert Notification.objects.filter(dedupe_key="raced-message").count() == 1

    # Looked up twice: once before the INSERT (forced to miss) and once after
    # the IntegrityError, which is where the winner's row is found.
    assert calls["n"] == 2
    assert loser.pk == winner.pk
    assert winner.deliveries.count() == 2  # IN_APP + WEBSOCKET


def test_notifications_imports_nothing_from_messaging_or_listings():
    """The dependency arrow is `messaging` -> `notifications`, never back.

    A single import the other way makes the two apps a cycle that Celery's
    autodiscovery hits at worker start-up, and it is the kind of line that is
    added absent-mindedly, so it is asserted rather than trusted.
    """
    from pathlib import Path

    import notifications

    package_root = Path(notifications.__path__[0])
    modules = sorted(package_root.glob("*.py"))
    assert modules, "no modules found to inspect"
    for module in modules:
        source = module.read_text(encoding="utf-8")
        for name in ("messaging", "listings"):
            assert f"import {name}" not in source, module.name
            assert f"from {name}" not in source, module.name
