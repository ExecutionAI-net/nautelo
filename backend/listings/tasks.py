"""Celery entry points for the listing lifecycle (spec §22.5).

Thin wrappers only: every rule lives in listings.expiry so the same code runs
from a task, a management shell and a test (spec §3: "No business rule should
live only in a view, template, serializer or JavaScript handler").
"""

import logging

from celery import shared_task

from .expiry import expire_due_listings as _expire_due_listings

logger = logging.getLogger(__name__)


@shared_task(queue="maintenance")
def expire_due_listings() -> int:
    count = _expire_due_listings()
    logger.info("listing expiry sweep complete", extra={"expired_count": count})
    return count
