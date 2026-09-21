from django.db.models.signals import post_save
from django.dispatch import receiver

from listings.signals import listing_published

from .services import start_waiting


@receiver(post_save, sender="professionals.ProfessionalProfile")
def start_waiting_profile_promotions(sender, instance, **kwargs):
    from .services import profile_is_live, start_waiting_profile

    if profile_is_live(instance) and instance.promotions.filter(status="PAID", starts_at__isnull=True).exists():
        start_waiting_profile(instance)


@receiver(listing_published)
def start_waiting_promotions(sender, listing, **kwargs):
    start_waiting(listing)
