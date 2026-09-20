from celery import shared_task

from .billing import lapse_unpaid_professionals


@shared_task(queue="maintenance")
def lapse_unpaid_memberships() -> int:
    return lapse_unpaid_professionals()
