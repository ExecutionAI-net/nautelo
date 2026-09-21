"""Stripe Checkout (one-off payment) for a listing promotion.

The amount is read from the plan at this moment and sent as `price_data`, so the
number staff set in Django admin is what the buyer pays and what is recorded.
"""

import re
import uuid
from urllib.parse import urlencode

from django.conf import settings
from rest_framework.exceptions import APIException, NotFound, PermissionDenied, ValidationError

from accounts.services import can_edit_owned_object
from listings.enums import ListingStatus
from listings.models import BoatListing
from payments.products import minor_units

from .models import ListingPromotion, PromotionPlan

KIND = "listing_promotion"
RETURN_PATHS = ("/sell/", "/dashboard/private-seller/listings/", "/dashboard/broker/fleet/")
RETURN_PATTERN = re.compile(r"^/sell/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/$")
PROMOTABLE = (ListingStatus.DRAFT, ListingStatus.PENDING_APPROVAL, ListingStatus.PUBLISHED)


class PromotionUnavailable(APIException):
    status_code = 503
    default_code = "promotion_unavailable"
    default_detail = "Promotions cannot be bought right now. Please try again shortly."


def _is_uuid(value) -> bool:
    try:
        uuid.UUID(str(value))
        return True
    except (ValueError, TypeError):
        return False


def create_promotion_checkout(
    *, user, listing_id, plan_code: str, return_path: str = "/dashboard/private-seller/listings/", gateway=None
) -> str:
    from payments.gateway import StripeUnavailable, default_gateway

    if return_path not in RETURN_PATHS and not RETURN_PATTERN.match(return_path):
        raise ValidationError({"return_path": ["invalid_return_path"]})
    listing = BoatListing.objects.filter(pk=listing_id).first()
    if listing is None or not can_edit_owned_object(user, owner_user_id=listing.owner_user_id, broker_id=listing.broker_id):
        raise NotFound()  # same answer for missing and foreign listings
    if listing.status not in PROMOTABLE:
        raise PermissionDenied("This listing cannot be promoted in its current state.")
    plan = PromotionPlan.objects.filter(code=plan_code, is_active=True).first()
    if plan is None:
        raise ValidationError({"plan": ["unknown_plan"]})

    promotion = ListingPromotion.objects.create(
        listing=listing, user=user, plan=plan, days=plan.days, amount=plan.price, currency=plan.currency.upper()
    )
    base = settings.PUBLIC_BASE_URL.rstrip("/")

    def _url(outcome):
        return f"{base}{return_path}?{urlencode({'promotion': outcome})}"

    metadata = {"kind": KIND, "promotion_id": str(promotion.pk), "listing_id": str(listing.pk)}
    params = {
        "mode": "payment",
        "line_items": [
            {
                "quantity": 1,
                "price_data": {
                    "currency": promotion.currency.lower(),
                    "unit_amount": minor_units(promotion.amount, promotion.currency),
                    "product_data": {"name": f"Featured listing - {plan.name_en} ({plan.days} days)"},
                },
            }
        ],
        "success_url": _url("success"),
        "cancel_url": _url("cancelled"),
        "client_reference_id": str(promotion.pk),
        "customer_email": user.email,
        "metadata": metadata,
        "payment_intent_data": {"metadata": metadata},
    }
    try:
        result = (gateway or default_gateway()).create_checkout_session(
            params=params, idempotency_key=f"promotion:{promotion.pk}:{uuid.uuid4()}"
        )
    except StripeUnavailable as exc:
        promotion.status = ListingPromotion.Status.CANCELED
        promotion.note = "checkout could not be opened"
        promotion.save(update_fields=["status", "note", "updated_at"])
        raise PromotionUnavailable() from exc
    promotion.stripe_checkout_session_id = result.session_id
    promotion.save(update_fields=["stripe_checkout_session_id", "updated_at"])
    return result.url


def handle_checkout(session: dict) -> str:
    """Webhook side: mark paid after checking the amount, then start the clock if the listing is live."""
    from django.utils import timezone

    from payments.enums import WebhookResult

    from .services import activate

    metadata = session.get("metadata") or {}
    if metadata.get("kind") != KIND or session.get("payment_status") != "paid":
        return WebhookResult.IGNORED
    promotion_id = metadata.get("promotion_id")
    promotion = ListingPromotion.objects.filter(pk=promotion_id).first() if _is_uuid(promotion_id) else None
    if promotion is None:
        return WebhookResult.ORDER_NOT_FOUND
    if promotion.status == ListingPromotion.Status.PAID:
        return WebhookResult.ALREADY_FULFILLED
    expected = minor_units(promotion.amount, promotion.currency)
    if session.get("amount_total") != expected or (session.get("currency") or "").upper() != promotion.currency.upper():
        promotion.status = ListingPromotion.Status.REVIEW
        promotion.note = "paid amount does not match the plan price"
        promotion.save(update_fields=["status", "note", "updated_at"])
        return WebhookResult.MISMATCH
    intent = session.get("payment_intent")
    promotion.status = ListingPromotion.Status.PAID
    promotion.paid_at = timezone.now()
    promotion.stripe_payment_intent_id = intent if isinstance(intent, str) else ""
    promotion.save(update_fields=["status", "paid_at", "stripe_payment_intent_id", "updated_at"])
    activate(promotion)
    return WebhookResult.FULFILLED
