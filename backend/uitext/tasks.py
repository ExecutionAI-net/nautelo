import logging

from celery import shared_task

from .translate import translate_pending

logger = logging.getLogger(__name__)


@shared_task(queue="maintenance")
def translate_pending_ui_text() -> dict:
    """Translate the next batch of waiting site texts; the schedule calls it every few minutes until none wait."""
    result = translate_pending()
    logger.info("site text translation run", extra={"result": str(result)})
    return result
