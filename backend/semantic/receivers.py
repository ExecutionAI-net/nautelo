import logging

from django.db import transaction
from django.dispatch import receiver

from listings.signals import listing_published, listing_revision_approved

log = logging.getLogger(__name__)


@receiver(listing_published)
@receiver(listing_revision_approved)
def queue_embedding(sender, listing=None, revision=None, **kwargs):
    listing = listing or getattr(revision, "listing", None)
    if listing is None:
        return

    def enqueue():
        from .tasks import index_listing_task

        try:
            index_listing_task.delay(str(listing.pk))
        except Exception:  # search quality must never block publishing
            log.exception("could not queue embedding for %s", listing.pk)

    transaction.on_commit(enqueue)
