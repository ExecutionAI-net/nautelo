"""Celery entry points for the ledger (spec §6.3).

Thin wrappers only — every rule lives in entitlements.services.
"""

import logging

from celery import shared_task

from .services import expire_due_entitlements, release_stale_reservations

logger = logging.getLogger(__name__)


@shared_task(queue="maintenance")
def sweep_entitlement_ledger() -> dict:
    """Both time-driven spec §6.3 transitions, in one nightly pass.

    Expiry runs first: a reservation released into an already-closed validity
    window would otherwise sit AVAILABLE-but-unusable until the next night.
    """
    expired = expire_due_entitlements()
    released = release_stale_reservations()
    logger.info(
        "entitlement ledger sweep complete",
        extra={"expired": expired, "released": released},
    )
    return {"expired": expired, "released": released}
