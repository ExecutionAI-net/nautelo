from celery import shared_task

from .indexing import index_listing


@shared_task(queue="maintenance")
def index_listing_task(listing_id: str) -> None:
    index_listing(listing_id)
