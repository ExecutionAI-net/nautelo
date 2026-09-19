"""Turns payment signals into notifications (spec 27.1, 27.4)."""

from django.dispatch import receiver

from notifications.enums import NotificationType
from notifications.fanout import STAFF_QUEUE_URL, admin_staff, notify

from .signals import payment_fulfilled, payment_needs_staff_review


@receiver(payment_fulfilled)
def on_payment_fulfilled(sender, order, entitlement, **kwargs):
    notify(
        order.user,
        NotificationType.PAYMENT_FULFILLED,
        target_url="/dashboard/private-seller/",
        payload={
            "order_id": str(order.pk),
            "product_code": order.product.code,
            "listing_id": str(order.listing_id) if order.listing_id else None,
        },
        dedupe_key=str(order.pk),
    )


@receiver(payment_needs_staff_review)
def on_payment_needs_staff_review(sender, order, reason, detail="", **kwargs):
    # Spec 27.4: operationally critical, so it always goes to every staff admin
    # and there is deliberately no preference that can silence it.
    for user in admin_staff():
        notify(
            user,
            NotificationType.PAYMENT_FULFILLMENT_FAILED,
            target_url=STAFF_QUEUE_URL,
            payload={"order_id": str(order.pk), "reason": reason},
            dedupe_key=f"{order.pk}:{reason}",
        )
