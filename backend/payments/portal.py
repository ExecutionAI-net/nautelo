"""Stripe customer portal: payment methods, tax details and invoices, hosted by Stripe."""

from rest_framework.exceptions import APIException


class PortalUnavailable(APIException):
    status_code = 409
    default_code = "no_billing_account"
    default_detail = "There is no billing account yet. Start your subscription first."


def portal_url(*, customer_id: str, return_url: str, gateway=None) -> str:
    from .gateway import StripeUnavailable, default_gateway

    if not customer_id:
        raise PortalUnavailable()
    try:
        return (gateway or default_gateway()).create_portal_session(customer_id=customer_id, return_url=return_url)
    except StripeUnavailable as exc:
        raise PortalUnavailable(detail="Billing management is not available right now.") from exc
