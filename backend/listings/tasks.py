"""Celery entry points for the listing lifecycle (spec §22.5).

Thin wrappers only: every rule lives in listings.expiry so the same code runs
from a task, a management shell and a test (spec §3: "No business rule should
live only in a view, template, serializer or JavaScript handler").
"""

import logging

from celery import shared_task

from .expiry import expire_due_listings as _expire_due_listings
from .expiry import send_expiry_reminders as _send_expiry_reminders

logger = logging.getLogger(__name__)


@shared_task(queue="maintenance")
def expire_due_listings() -> int:
    count = _expire_due_listings()
    logger.info("listing expiry sweep complete", extra={"expired_count": count})
    return count


@shared_task(queue="maintenance")
def send_listing_expiry_reminders() -> dict:
    counts = _send_expiry_reminders()
    logger.info("listing expiry reminders sent", extra={"counts": counts})
    # Celery serialises the result as JSON, which would turn the int keys into
    # strings anyway; doing it here makes the stored result shape explicit.
    return {str(threshold): count for threshold, count in counts.items()}
