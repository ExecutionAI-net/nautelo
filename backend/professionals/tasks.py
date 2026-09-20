from celery import shared_task

from .billing import lapse_unpaid_professionals


@shared_task(queue="maintenance")
def lapse_unpaid_memberships() -> int:
    from brokers.billing import lapse_unpaid_brokers

    return lapse_unpaid_professionals() + lapse_unpaid_brokers()
