"""Audited product configuration (spec §23.1, §26.4)."""

from django.db import IntegrityError, transaction
from rest_framework.exceptions import ValidationError

from audit.models import AuditEvent
from audit.services import record_audit_event

EDITABLE_FIELDS = (
    "name_en", "name_it", "name_es",
    "description_en", "description_it", "description_es",
    "stripe_product_id", "stripe_price_id",
    "currency", "display_amount",
    "entitlement_valid_days", "publication_days",
    "is_active", "display_order",
)


def _snapshot(product) -> dict:
    return {
        field: str(getattr(product, field))
        if field == "display_amount"
        else getattr(product, field)
        for field in EDITABLE_FIELDS
    }


@transaction.atomic
def update_product(*, product, changes: dict, actor, request_id=None):
    """The one sanctioned way to change a MarketplaceProduct.

    `code` is never editable: spec §23.1 fixes the catalogue at two codes.
    Deactivation gets its own audit action because spec §26.4 makes it the most
    consequential edit ("stops new Checkout creation"), and staff need to find
    it without scanning every `product.updated` row.
    """
    locked = type(product).objects.select_for_update().get(pk=product.pk)
    before = _snapshot(locked)

    for field, value in changes.items():
        if field in EDITABLE_FIELDS:
            setattr(locked, field, value)
    locked.updated_by = actor if getattr(actor, "is_authenticated", False) else None

    try:
        locked.save()
    except IntegrityError as exc:
        # Task 2's payments_product_active_is_fully_configured, surfaced as a
        # clean 400 rather than a 500. A ValidationError is correct HERE (it is
        # a field-level complaint, and the envelope's `fields` map is the only
        # thing that can say WHICH field), unlike the named codes in errors.py.
        raise ValidationError(
            {
                "is_active": [
                    "A product needs an amount and both Stripe identifiers "
                    "before it can be activated."
                ]
            }
        ) from exc

    after = _snapshot(locked)
    deactivated = before["is_active"] is True and after["is_active"] is False
    record_audit_event(
        actor_user=locked.updated_by,
        actor_type=AuditEvent.ActorType.USER,
        action="product.deactivated" if deactivated else "product.updated",
        target_type="payments.MarketplaceProduct",
        target_id=str(locked.pk),
        source=AuditEvent.Source.ADMIN,
        before=before,
        after=after,
        request_id=request_id,
        metadata={"code": locked.code},
    )
    return locked
