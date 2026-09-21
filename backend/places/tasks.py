from celery import shared_task
from django.core.management import call_command


@shared_task(queue="maintenance")
def sync_places() -> None:
    call_command("sync_places")
    # Attach places to any published listings that still carry only free text.
    call_command("match_places", "--apply")
