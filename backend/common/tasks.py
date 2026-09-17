from celery import shared_task


@shared_task(queue="default")
def ping():
    return "pong"
