from django.dispatch import receiver

from listings.signals import listing_published

from .services import start_waiting


@receiver(listing_published)
def start_waiting_promotions(sender, listing, **kwargs):
    start_waiting(listing)
