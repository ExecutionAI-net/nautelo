from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import BoatBrand
from .services import ensure_other_placeholder


@receiver(post_save, sender=BoatBrand)
def ensure_other_placeholder_on_brand_save(sender, instance, **kwargs):
    if instance.is_active:
        ensure_other_placeholder(instance)
