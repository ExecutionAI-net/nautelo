from unittest.mock import patch

from django.conf import settings

from common.tasks import flush_expired_tokens, ping


def test_ping_task_returns_pong():
    # `.result` on the eager result, not `.get()`: get() raises "Never call
    # result.get() within a task" whenever another test in the (randomised)
    # run leaked a current task, which made this test order-dependent.
    result = ping.apply()
    assert result.result == "pong"


def test_flush_expired_tokens_task_calls_management_command():
    with patch("common.tasks.call_command") as mock_call_command:
        flush_expired_tokens.delay()

    mock_call_command.assert_called_once_with("flushexpiredtokens")


def test_flush_expired_tokens_is_scheduled_daily_on_maintenance_queue():
    entry = settings.CELERY_BEAT_SCHEDULE["flush-expired-jwt-tokens"]

    assert entry["task"] == "common.tasks.flush_expired_tokens"
    assert entry["options"]["queue"] == "maintenance"


def test_every_periodic_task_is_registered_and_none_was_overwritten():
    """base.py once defined CELERY_BEAT_SCHEDULE twice; the second assignment
    silently dropped listing expiry, reminders, media cleanup and the ledger
    sweep. Pin every entry so that cannot recur."""
    from config.celery import app

    app.loader.import_default_modules()
    schedule = settings.CELERY_BEAT_SCHEDULE
    assert {
        "expire-due-listings",
        "send-listing-expiry-reminders",
        "cleanup-stale-media-uploads",
        "sweep-entitlement-ledger",
        "flush-expired-jwt-tokens",
    } <= set(schedule)
    for name, entry in schedule.items():
        assert entry["task"] in app.tasks, f"{name} points at an unregistered task"
