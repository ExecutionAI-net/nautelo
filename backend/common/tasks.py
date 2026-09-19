from celery import shared_task
from django.core.management import call_command


@shared_task(queue="default")
def ping():
    return "pong"


@shared_task(queue="maintenance")
def flush_expired_tokens() -> None:
    call_command("flushexpiredtokens")
