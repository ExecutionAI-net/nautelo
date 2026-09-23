"""Spec 27.3: queue only after commit, localize by recipient locale with EN
fallback, include a safe summary and a platform URL, and never include hidden
recipient contact data."""

import logging
from smtplib import SMTPDataError, SMTPServerDisconnected

import pytest
from celery.exceptions import MaxRetriesExceededError, Retry
from django.conf import settings
from django.core import mail
from django.test import override_settings

from accounts.enums import Locale
from accounts.tests.factories import make_user
from notifications import tasks
from notifications.enums import DeliveryChannel, DeliveryStatus, NotificationType
from notifications.models import Notification
from notifications.services import create_notification
from notifications.tasks import send_notification_email

pytestmark = pytest.mark.django_db

EXCERPT = "I would like to arrange a viewing next week."


def _notify(recipient, **kwargs):
    return create_notification(
        recipient=recipient,
        notification_type=NotificationType.INQUIRY_RECEIVED,
        title_key="notification.inquiry_received.title",
        body_key="notification.inquiry_received.body",
        target_url="/dashboard/messages/abc/",
        payload={
            "sender_display_name": "Ada Rossi",
            "context_label": "Azimut Atlantis 43",
            "excerpt": EXCERPT,
        },
        **kwargs,
    )


@override_settings(PUBLIC_BASE_URL="https://nauta.test")
def test_the_email_carries_the_excerpt_and_a_platform_link():
    recipient = make_user(email="pro@phase6.example", locale=Locale.EN)
    notification = _notify(recipient, email_to="office@phase6.example")
    mail.outbox.clear()

    send_notification_email(str(notification.pk), "office@phase6.example")

    assert len(mail.outbox) == 1
    sent = mail.outbox[0]
    assert sent.to == ["office@phase6.example"]
    assert "Ada Rossi" in sent.body
    assert "Azimut Atlantis 43" in sent.body
    assert "I would like to arrange a viewing next week." in sent.body
    assert "https://nauta.test/dashboard/messages/abc/" in sent.body


def test_the_email_is_localized_by_recipient_locale_with_an_en_fallback():
    italian = make_user(email="it@phase6.example", locale=Locale.IT)
    notification = _notify(italian, email_to="it-office@phase6.example")
    mail.outbox.clear()
    send_notification_email(str(notification.pk), "it-office@phase6.example")
    assert mail.outbox[0].subject == "Nuovo messaggio su Nautelo"

    english = make_user(email="en@phase6.example", locale=Locale.EN)
    notification = _notify(english, email_to="en-office@phase6.example")
    mail.outbox.clear()
    send_notification_email(str(notification.pk), "en-office@phase6.example")
    assert mail.outbox[0].subject == "New message on Nautelo"


def test_a_successful_send_marks_the_delivery_row_sent():
    recipient = make_user(email="pro2@phase6.example")
    notification = _notify(recipient, email_to="office2@phase6.example")
    delivery = notification.deliveries.get(channel=DeliveryChannel.EMAIL)
    assert delivery.status == DeliveryStatus.QUEUED

    send_notification_email(str(notification.pk), "office2@phase6.example")

    delivery.refresh_from_db()
    assert delivery.status == DeliveryStatus.SENT
    assert delivery.sent_at is not None
    assert delivery.attempt_count == 1


def test_a_retried_task_does_not_send_the_email_twice():
    """Spec 27's acceptance test, verbatim: "Retried task does not create
    duplicate in-app notification/delivery."

    Celery redelivers after a lost worker just as readily when the send already
    succeeded as when it failed, and the broker cannot tell the two apart, so
    the second run has to be a no-op.
    """
    recipient = make_user(email="retry@phase6.example")
    notification = _notify(recipient, email_to="retry-office@phase6.example")
    mail.outbox.clear()

    send_notification_email(str(notification.pk), "retry-office@phase6.example")
    send_notification_email(str(notification.pk), "retry-office@phase6.example")

    assert len(mail.outbox) == 1
    delivery = notification.deliveries.get(channel=DeliveryChannel.EMAIL)
    assert delivery.status == DeliveryStatus.SENT
    assert delivery.attempt_count == 1


def test_a_vanished_notification_is_skipped_not_crashed():
    """Spec 27.3: "permanent failure is visible to staff without rolling back the
    original business transaction"."""
    import uuid

    send_notification_email(str(uuid.uuid4()), "nobody@phase6.example")
    # No exception, nothing sent.
    assert mail.outbox == []


def test_the_email_job_is_queued_only_after_the_transaction_commits(
    django_capture_on_commit_callbacks,
):
    """Spec 15.3 step 6 and 27.3.

    `django_capture_on_commit_callbacks` (pytest-django) is required, not
    optional: a plain `@pytest.mark.django_db` test runs inside an atomic block
    that is rolled back and never committed, so on_commit callbacks would never
    fire at all and a naive `with transaction.atomic():` version of this test
    would fail on the last line. CELERY_TASK_ALWAYS_EAGER is on in
    config/settings/test.py, so once the callback does run the mail is sent
    inline - which is what makes the in-block assertion meaningful: a task
    scheduled OUTSIDE on_commit would have filled the outbox already.
    """
    recipient = make_user(email="pro3@phase6.example")
    mail.outbox.clear()
    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        _notify(recipient, email_to="office3@phase6.example")
        assert mail.outbox == []
    # The email job and the WebSocket push, both queued on commit.
    assert len(callbacks) == 2
    assert len(mail.outbox) == 1


# ---------------------------------------------------------------------------
# Spec 37: every user-visible string exists in all three launch locales.
# ---------------------------------------------------------------------------


def test_every_email_string_exists_in_every_supported_locale():
    """A missing locale must fail here rather than at send time.

    The task falls back to EN for an unknown locale, which means a dictionary
    that simply forgot ES would silently mail Spanish brokers in English instead
    of raising - so the completeness of the dictionaries is asserted directly,
    against accounts.enums.Locale rather than against a hand-written list that
    would go stale the day a fourth language is added.
    """
    expected = {member.value for member in Locale}
    assert expected == {"EN", "IT", "ES"}
    for dictionary in (tasks.SUBJECTS, tasks.SENDER_FALLBACK, tasks.BODIES):
        assert set(dictionary) == expected
        assert all(value.strip() for value in dictionary.values())
    # The three subjects are genuinely translated, not the same English string
    # copied into three keys.
    assert len(set(tasks.SUBJECTS.values())) == 3


@override_settings(PUBLIC_BASE_URL="https://nauta.test")
def test_the_spanish_email_is_rendered_in_spanish():
    recipient = make_user(email="es@phase6.example", locale=Locale.ES)
    notification = _notify(recipient, email_to="es-office@phase6.example")
    mail.outbox.clear()

    send_notification_email(str(notification.pk), "es-office@phase6.example")

    sent = mail.outbox[0]
    assert sent.subject == "Nuevo mensaje en Nautelo"
    assert sent.body.startswith("Ada Rossi te ha enviado un mensaje")
    assert "https://nauta.test/dashboard/messages/abc/" in sent.body


def test_a_sender_without_a_name_falls_back_to_a_localized_placeholder():
    """Never the sender's email address: messaging stores "" rather than letting
    User.get_full_name()'s `full_name or email` fallback leak an address."""
    recipient = make_user(email="noname@phase6.example", locale=Locale.IT)
    notification = create_notification(
        recipient=recipient,
        notification_type=NotificationType.INQUIRY_RECEIVED,
        title_key="notification.inquiry_received.title",
        body_key="notification.inquiry_received.body",
        target_url="/dashboard/messages/abc/",
        payload={"sender_display_name": "", "context_label": "Azimut Atlantis 43"},
        email_to="noname-office@phase6.example",
    )
    mail.outbox.clear()

    send_notification_email(str(notification.pk), "noname-office@phase6.example")

    assert mail.outbox[0].body.startswith("Un utente Nautelo")


def test_an_unknown_locale_falls_back_to_english():
    recipient = make_user(email="xx@phase6.example")
    recipient.locale = "XX"
    recipient.save(update_fields=["locale", "updated_at"])
    notification = _notify(recipient, email_to="xx-office@phase6.example")
    mail.outbox.clear()

    send_notification_email(str(notification.pk), "xx-office@phase6.example")

    assert mail.outbox[0].subject == "New message on Nautelo"


# ---------------------------------------------------------------------------
# Failure handling (spec 27.3: "Retries are bounded").
# ---------------------------------------------------------------------------


def test_the_task_is_routed_to_the_notifications_queue():
    assert send_notification_email.queue == "notifications"
    assert settings.CELERY_TASK_ROUTES["notifications.tasks.*"] == {
        "queue": "notifications"
    }
    assert "notifications" in {queue.name for queue in settings.CELERY_TASK_QUEUES}


def test_a_transient_smtp_failure_marks_the_row_failed_and_retries(monkeypatch):
    recipient = make_user(email="fail@phase6.example")
    notification = _notify(recipient, email_to="fail-office@phase6.example")

    def explode(**kwargs):
        raise SMTPServerDisconnected("connection lost")

    monkeypatch.setattr(tasks, "send_mail", explode)

    # Called directly, Celery's retry() re-raises the original exception rather
    # than scheduling anything - the retry itself is bounded by max_retries,
    # asserted below.
    with pytest.raises(SMTPServerDisconnected):
        send_notification_email(str(notification.pk), "fail-office@phase6.example")

    delivery = notification.deliveries.get(channel=DeliveryChannel.EMAIL)
    delivery.refresh_from_db()
    assert delivery.status == DeliveryStatus.FAILED
    assert delivery.last_error_code == "SMTPServerDisconnected"
    assert delivery.attempt_count == 1
    assert mail.outbox == []


def test_retries_are_bounded_and_a_permanent_failure_stays_failed(monkeypatch):
    """Spec 27.3: "Retries are bounded" - a permanently broken address must not
    be retried forever, and the row it leaves behind must carry the reason.

    The redelivery chain is driven by hand, one execution per `retries` count,
    because that counter is what a real worker advances between redeliveries:
    under CELERY_TASK_ALWAYS_EAGER `self.retry()` raises `Retry` out of the
    first attempt, so a single `.delay()` would only ever show attempt one and
    would assert nothing at all about the bound.
    """
    recipient = make_user(email="perm@phase6.example")
    notification = _notify(recipient, email_to="perm-office@phase6.example")
    attempts = {"n": 0}

    def explode(**kwargs):
        attempts["n"] += 1
        raise SMTPDataError(550, "mailbox unavailable")

    monkeypatch.setattr(tasks, "send_mail", explode)

    assert send_notification_email.max_retries == 3
    assert send_notification_email.default_retry_delay == 60

    outcomes = []
    for already_retried in range(5):
        # Deliberately broad: which exception comes out IS the assertion, and
        # it differs between the retrying runs and the one that gives up.
        with pytest.raises(Exception) as excinfo:
            send_notification_email.apply(
                args=[str(notification.pk), "perm-office@phase6.example"],
                retries=already_retried,
            )
        outcomes.append(excinfo.value)

    # The original run and exactly max_retries redeliveries ask for another go;
    # every run after that gives up and lets the error surface instead of
    # looping - four attempts at the SMTP server, not an unbounded number.
    assert [isinstance(outcome, Retry) for outcome in outcomes] == [
        True,
        True,
        True,
        False,
        False,
    ]
    assert isinstance(outcomes[3], SMTPDataError)
    assert not isinstance(outcomes[3], MaxRetriesExceededError)

    delivery = notification.deliveries.get(channel=DeliveryChannel.EMAIL)
    assert delivery.status == DeliveryStatus.FAILED
    assert delivery.last_error_code == "SMTPDataError"
    assert delivery.attempt_count == attempts["n"] == 5


# ---------------------------------------------------------------------------
# Privacy (spec 27.3 / 16): the address and the message body stay out of the
# logs and out of every stored row.
# ---------------------------------------------------------------------------


def _log_text(caplog):
    chunks = []
    for record in caplog.records:
        chunks.append(record.getMessage())
        chunks.extend(str(value) for value in record.__dict__.values())
    return "\n".join(chunks)


def test_a_successful_send_logs_neither_the_address_nor_the_message(caplog):
    recipient = make_user(email="quiet@phase6.example")
    notification = _notify(recipient, email_to="quiet-office@phase6.example")
    caplog.clear()

    with caplog.at_level(logging.INFO):
        send_notification_email(str(notification.pk), "quiet-office@phase6.example")

    logged = _log_text(caplog)
    assert "quiet-office@phase6.example" not in logged
    assert "quiet@phase6.example" not in logged
    assert EXCERPT not in logged
    assert str(notification.pk) in logged


def test_a_failed_send_logs_neither_the_address_nor_the_message(caplog, monkeypatch):
    recipient = make_user(email="quiet2@phase6.example")
    notification = _notify(recipient, email_to="quiet2-office@phase6.example")

    def explode(**kwargs):
        raise SMTPServerDisconnected("connection to quiet2-office@phase6.example lost")

    monkeypatch.setattr(tasks, "send_mail", explode)
    caplog.clear()

    with caplog.at_level(logging.INFO):
        with pytest.raises(SMTPServerDisconnected):
            send_notification_email(
                str(notification.pk), "quiet2-office@phase6.example"
            )

    logged = _log_text(caplog)
    # The provider's own exception text carries the address; only the exception
    # CLASS may be logged, never str(exc).
    assert "quiet2-office@phase6.example" not in logged
    assert EXCERPT not in logged
    assert "SMTPServerDisconnected" in logged


def test_no_stored_row_records_the_destination_address():
    """Spec 16: the destination is a broker's published business address, and it
    is passed to the task as an argument rather than persisted on a row the
    in-app feed later serializes."""
    recipient = make_user(email="stored@phase6.example")
    notification = _notify(recipient, email_to="stored-office@phase6.example")

    send_notification_email(str(notification.pk), "stored-office@phase6.example")

    notification.refresh_from_db()
    delivery = notification.deliveries.get(channel=DeliveryChannel.EMAIL)
    row_text = "".join(
        str(getattr(notification, field.name))
        for field in Notification._meta.fields
    ) + "".join(
        str(getattr(delivery, field.name)) for field in delivery._meta.fields
    )
    assert "stored-office@phase6.example" not in row_text
