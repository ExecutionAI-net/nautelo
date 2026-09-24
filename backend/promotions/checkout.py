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
RETURN_PATHS = (
    "/sell/",
    "/dashboard/private-seller/listings/",
    "/dashboard/broker/fleet/",
    "/dashboard/broker/subscription/",
    "/dashboard/service-provider/membership/",
)
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

    # One open Checkout per target: the buyer who backed out and chose again
    # must not be left with two payable links.
    cancel_pending_promotions(user=user, listing=listing, gateway=gateway, note="replaced by a new checkout")
    promotion = ListingPromotion.objects.create(
        listing=listing, user=user, plan=plan, days=plan.days, amount=plan.price, currency=plan.currency.upper()
    )
    metadata = {"kind": KIND, "promotion_id": str(promotion.pk), "listing_id": str(listing.pk)}
    return _open_checkout(
        user, promotion, metadata, return_path, f"Featured listing - {plan.name_en} ({plan.days} days)", gateway,
        cancel_query={"listing": str(listing.pk)},
    )


def cancel_pending_promotions(*, user, listing=None, professional=None, gateway=None, note="cancelled by the buyer") -> int:
    """Close the caller's PENDING checkouts for one target, at Stripe and here.

    Called when the buyer comes back through Stripe's cancel link and before a
    new checkout for the same target opens. A session that Stripe refuses to
    expire (already paid, or Stripe unreachable) is left alone: the webhook
    stays the authority on money."""
    from payments.gateway import StripeUnavailable, default_gateway

    pending = ListingPromotion.objects.filter(user=user, status=ListingPromotion.Status.PENDING)
    if listing is not None:
        pending = pending.filter(listing=listing)
    elif professional is not None:
        pending = pending.filter(professional=professional)
    else:
        return 0
    closed = 0
    for promotion in pending:
        if promotion.stripe_checkout_session_id:
            try:
                (gateway or default_gateway()).expire_checkout_session(promotion.stripe_checkout_session_id)
            except StripeUnavailable:
                continue
        promotion.status = ListingPromotion.Status.CANCELED
        promotion.note = note
        promotion.save(update_fields=["status", "note", "updated_at"])
        closed += 1
    return closed


def cancel_listing_promotion_checkout(*, user, listing_id, gateway=None) -> int:
    listing = BoatListing.objects.filter(pk=listing_id).first()
    if listing is None or not can_edit_owned_object(user, owner_user_id=listing.owner_user_id, broker_id=listing.broker_id):
        raise NotFound()
    return cancel_pending_promotions(user=user, listing=listing, gateway=gateway)


def cancel_profile_promotion_checkout(*, user, gateway=None) -> int:
    from professionals.access import membership_for

    seat = membership_for(user)
    if seat is None:
        raise NotFound()
    return cancel_pending_promotions(user=user, professional=seat.profile, gateway=gateway)


def create_profile_promotion_checkout(
    *, user, plan_code: str, return_path: str = "/dashboard/service-provider/membership/", gateway=None
) -> str:
    """Feature the caller's professional directory profile."""
    from professionals.access import membership_for
    from professionals.enums import ProfessionalProfileStatus

    if return_path not in RETURN_PATHS:
        raise ValidationError({"return_path": ["invalid_return_path"]})
    seat = membership_for(user)
    if seat is None or not seat.can_edit_profile:
        raise PermissionDenied("Only people who can edit the profile can promote it.")
    profile = seat.profile
    if profile.status not in (ProfessionalProfileStatus.DRAFT, ProfessionalProfileStatus.PENDING, ProfessionalProfileStatus.ACTIVE):
        raise PermissionDenied("This profile cannot be promoted in its current state.")
    plan = PromotionPlan.objects.filter(code=plan_code, is_active=True).first()
    if plan is None:
        raise ValidationError({"plan": ["unknown_plan"]})
    cancel_pending_promotions(user=user, professional=profile, gateway=gateway, note="replaced by a new checkout")
    promotion = ListingPromotion.objects.create(
        professional=profile, user=user, plan=plan, days=plan.days, amount=plan.price, currency=plan.currency.upper()
    )
    metadata = {"kind": KIND, "promotion_id": str(promotion.pk), "professional_id": str(profile.pk)}
    return _open_checkout(user, promotion, metadata, return_path, f"Featured profile - {plan.name_en} ({plan.days} days)", gateway)


def _open_checkout(user, promotion, metadata, return_path, product_name, gateway, cancel_query=None) -> str:
    from payments.checkout import checkout_locale
    from payments.gateway import StripeUnavailable, default_gateway

    base = settings.PUBLIC_BASE_URL.rstrip("/")

    def _url(outcome):
        # The cancel link names the target, so the page the buyer lands on can
        # close the abandoned session without guessing which listing it was.
        extra = cancel_query if outcome == "cancelled" and cancel_query else {}
        return f"{base}{return_path}?{urlencode({'promotion': outcome, **extra})}"

    params = {
        "mode": "payment",
        "line_items": [
            {
                "quantity": 1,
                "price_data": {
                    "currency": promotion.currency.lower(),
                    "unit_amount": minor_units(promotion.amount, promotion.currency),
                    "product_data": {"name": product_name},
                },
            }
        ],
        "success_url": _url("success"),
        "cancel_url": _url("cancelled"),
        "client_reference_id": str(promotion.pk),
        "locale": checkout_locale(user),
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
