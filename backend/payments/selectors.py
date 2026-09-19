"""Read-only aggregates for spec §23.5's staff card.

Every number is a live query, not a denormalized counter: spec §26's definition
of done requires "All visible counters equal query results", which a cached
column cannot guarantee.
"""

from dataclasses import asdict, dataclass

from django.db.models import Count, Q

from .enums import PAID_STATES, PaymentOrderStatus


@dataclass(frozen=True)
class ProductOperations:
    """Spec §23.5: "Purchases and fulfillment failures (counts, not financial
    analytics beyond product operations)." No revenue, no averages, no totals —
    deliberately."""

    purchases: int
    fulfilled: int
    fulfillment_failures: int
    open_checkouts: int

    def as_dict(self) -> dict:
        return asdict(self)


def product_operations(product) -> ProductOperations:
    counts = product.orders.aggregate(
        purchases=Count("pk", filter=Q(status__in=sorted(PAID_STATES))),
        fulfilled=Count("pk", filter=Q(status=PaymentOrderStatus.FULFILLED)),
        fulfillment_failures=Count("pk", filter=Q(status=PaymentOrderStatus.FAILED)),
        open_checkouts=Count("pk", filter=Q(status=PaymentOrderStatus.CHECKOUT_OPEN)),
    )
    return ProductOperations(**counts)
