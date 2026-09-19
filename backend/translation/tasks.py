import logging

from celery import shared_task

from .openrouter import OpenRouterError, sync_catalog

logger = logging.getLogger(__name__)


@shared_task(queue="maintenance")
def sync_openrouter_models() -> dict | None:
    try:
        result = sync_catalog()
    except OpenRouterError:
        logger.warning("openrouter catalogue sync failed", exc_info=True)
        return None
    logger.info("openrouter catalogue synced", extra=result)
    return result
