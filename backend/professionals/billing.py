"""Monthly professional membership: Stripe Checkout (subscription mode) and webhooks.

A professional's profile goes ACTIVE the moment Stripe confirms the first payment.
A failed invoice starts a 24-hour clock; if it is not paid by then the profile goes
offline (SUSPENDED) and stays so until a later payment succeeds. Cancelling the
subscription takes the profile offline immediately.

Webhook handlers return `payments.enums.WebhookResult` values. They are registered
into `payments.webhooks.HANDLERS` by `payments.fulfillment`.
"""

import uuid
from datetime import datetime, timedelta
from datetime import timezone as dt_timezone
from urllib.parse import urlencode

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import APIException

from notifications.enums import NotificationType
from notifications.fanout import notify

from .enums import ProfessionalProfileStatus, SubscriptionStatus
from .models import ProfessionalPlan, ProfessionalProfile, ProfessionalSubscription

GRACE_PERIOD = timedelta(hours=24)
MEMBERSHIP_PATH = "/dashboard/service-provider/membership/"
KIND = "professional_membership"


class MembershipUnavailable(APIException):
    status_code = 503
    default_code = "membership_unavailable"
    default_detail = "Professional membership is not open for sign-up yet."


def get_plan() -> ProfessionalPlan | None:
    return ProfessionalPlan.objects.filter(is_active=True).first()


def _url(outcome: str) -> str:
    base = settings.PUBLIC_BASE_URL.rstrip("/")
    return f"{base}{MEMBERSHIP_PATH}?{urlencode({'checkout': outcome})}"


def create_membership_checkout(*, profile, gateway=None) -> str:
    from payments.gateway import StripeUnavailable, default_gateway

    plan = get_plan()
    if plan is None:
        raise MembershipUnavailable()
    gateway = gateway or default_gateway()
    metadata = {"kind": KIND, "professional_id": str(profile.pk)}
    try:
        result = gateway.create_checkout_session(
            params={
                "mode": "subscription",
                "line_items": [{"price": plan.stripe_price_id, "quantity": 1}],
                "success_url": _url("success"),
                "cancel_url": _url("cancelled"),
                "client_reference_id": str(profile.pk),
                "metadata": metadata,
                "subscription_data": {"metadata": metadata},
            },
            idempotency_key=f"professional-membership:{profile.pk}:{uuid.uuid4()}",
        )
    except StripeUnavailable as exc:
        raise MembershipUnavailable() from exc
    return result.url


def _notify(profile, notification_type, key):
    notify(
        profile.owner_user,
        notification_type,
        target_url=MEMBERSHIP_PATH,
        payload={"professional_id": str(profile.pk)},
        dedupe_key=key,
    )


def _from_unix(value):
    if not value:
        return None
    return datetime.fromtimestamp(int(value), tz=dt_timezone.utc)


def _activate(subscription, *, period_end=None, now=None):
    now = now or timezone.now()
    was_offline = subscription.status in (
        SubscriptionStatus.LAPSED,
        SubscriptionStatus.CANCELED,
        SubscriptionStatus.INACTIVE,
    )
    subscription.status = SubscriptionStatus.ACTIVE
    subscription.past_due_since = None
    subscription.last_paid_at = now
    if period_end:
        subscription.current_period_end = period_end
    subscription.save()

    profile = subscription.profile
    comes_online = profile.status in (
        ProfessionalProfileStatus.DRAFT,
        ProfessionalProfileStatus.PENDING,
    ) or (was_offline and profile.status == ProfessionalProfileStatus.SUSPENDED)
    if profile.status != ProfessionalProfileStatus.ACTIVE and comes_online:
        profile.status = ProfessionalProfileStatus.ACTIVE
        profile.save(update_fields=["status", "updated_at"])
        _notify(profile, NotificationType.PROFESSIONAL_ACTIVATED, f"{subscription.pk}:active:{now.date()}")


def _deactivate(subscription, *, status, now=None):
    now = now or timezone.now()
    subscription.status = status
    subscription.save(update_fields=["status", "updated_at"])
    profile = subscription.profile
    if profile.status == ProfessionalProfileStatus.ACTIVE:
        profile.status = ProfessionalProfileStatus.SUSPENDED
        profile.save(update_fields=["status", "updated_at"])
    _notify(profile, NotificationType.PROFESSIONAL_DEACTIVATED, f"{subscription.pk}:off:{now.date()}")


def _subscription_for(*, subscription_id="", customer_id="", professional_id=""):
    locked = ProfessionalSubscription.objects.select_for_update(of=("self",)).select_related("profile")
    found = None
    if subscription_id:
        found = locked.filter(stripe_subscription_id=subscription_id).first()
    if found is None and professional_id:
        profile = ProfessionalProfile.objects.filter(pk=professional_id).first()
        if profile is not None:
            ProfessionalSubscription.objects.get_or_create(profile=profile)
            found = locked.filter(profile=profile).first()
    if found is None and customer_id:
        found = locked.filter(stripe_customer_id=customer_id).first()
    return found


def _invoice_refs(invoice: dict) -> dict:
    """Subscription, customer and professional ids from an invoice, across Stripe
    API versions (the subscription moved under `parent.subscription_details`)."""
    details = (invoice.get("parent") or {}).get("subscription_details") or {}
    subscription = invoice.get("subscription") or details.get("subscription") or ""
    if not isinstance(subscription, str):
        subscription = (subscription or {}).get("id", "")
    metadata = details.get("metadata") or (invoice.get("subscription_details") or {}).get("metadata") or {}
    customer = invoice.get("customer")
    return {
        "subscription_id": subscription,
        "customer_id": customer if isinstance(customer, str) else "",
        "professional_id": metadata.get("professional_id", ""),
    }


def handle_membership_checkout(session: dict) -> str:
    from payments.enums import WebhookResult

    metadata = session.get("metadata") or {}
    if metadata.get("kind") != KIND or session.get("payment_status") != "paid":
        return WebhookResult.IGNORED
    subscription = _subscription_for(professional_id=metadata.get("professional_id", ""))
    if subscription is None:
        return WebhookResult.ORDER_NOT_FOUND
    subscription.stripe_customer_id = session.get("customer") or subscription.stripe_customer_id
    sub_id = session.get("subscription") or ""
    subscription.stripe_subscription_id = sub_id if isinstance(sub_id, str) else sub_id.get("id", "")
    _activate(subscription)
    return WebhookResult.FULFILLED


def handle_invoice_paid(event) -> str:
    from payments.enums import WebhookResult

    invoice = event["data"]["object"]
    refs = _invoice_refs(invoice)
    subscription = _subscription_for(**refs)
    if subscription is None:
        return WebhookResult.IGNORED
    if not subscription.stripe_subscription_id:
        subscription.stripe_subscription_id = refs["subscription_id"]
    lines = (invoice.get("lines") or {}).get("data") or []
    period_end = _from_unix(((lines[0] if lines else {}).get("period") or {}).get("end"))
    _activate(subscription, period_end=period_end)
    return WebhookResult.FULFILLED


def handle_invoice_payment_failed(event) -> str:
    from payments.enums import WebhookResult

    invoice = event["data"]["object"]
    subscription = _subscription_for(**_invoice_refs(invoice))
    if subscription is None:
        return WebhookResult.IGNORED
    if subscription.past_due_since is None:
        subscription.past_due_since = timezone.now()
    if subscription.status == SubscriptionStatus.ACTIVE:
        subscription.status = SubscriptionStatus.PAST_DUE
    subscription.save()
    _notify(
        subscription.profile,
        NotificationType.PROFESSIONAL_PAYMENT_FAILED,
        f"{subscription.pk}:failed:{invoice.get('id', '')}",
    )
    return WebhookResult.FULFILLED


def handle_subscription_deleted(event) -> str:
    from payments.enums import WebhookResult

    stripe_sub = event["data"]["object"]
    subscription = _subscription_for(
        subscription_id=stripe_sub.get("id", ""),
        professional_id=(stripe_sub.get("metadata") or {}).get("professional_id", ""),
    )
    if subscription is None:
        return WebhookResult.IGNORED
    _deactivate(subscription, status=SubscriptionStatus.CANCELED)
    return WebhookResult.FULFILLED


@transaction.atomic
def lapse_unpaid_professionals(*, now=None) -> int:
    """Take profiles offline once an unpaid invoice is more than 24 hours old."""
    now = now or timezone.now()
    due = list(
        ProfessionalSubscription.objects.select_for_update(of=("self",))
        .filter(status=SubscriptionStatus.PAST_DUE, past_due_since__lte=now - GRACE_PERIOD)
        .select_related("profile", "profile__owner_user")
    )
    for subscription in due:
        _deactivate(subscription, status=SubscriptionStatus.LAPSED, now=now)
    return len(due)
