"""Brokerage subscription: Stripe Checkout (subscription mode) with a free trial.

The card is collected up front; the first charge happens when the trial ends.
Paying does not publish the brokerage - staff approve DRAFT/PENDING brokerages.
A failed invoice starts a 24-hour clock; unpaid after that, or cancelled, an
ACTIVE brokerage goes SUSPENDED until a later payment succeeds.

Webhook handlers return `payments.enums.WebhookResult` values; the shared
dispatcher in `payments.fulfillment` tries the professional handlers first and
falls through to these when the event is not theirs.
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
from professionals.enums import SubscriptionStatus

from .enums import BrokerOrganizationStatus
from .models import BrokerOrganization, BrokerSubscription

GRACE_PERIOD = timedelta(hours=24)
SUBSCRIPTION_PATH = "/dashboard/broker/subscription/"
KIND = "broker_subscription"


class SubscriptionUnavailable(APIException):
    status_code = 503
    default_code = "subscription_unavailable"
    default_detail = "This plan is not open for sign-up yet."


def trial_available(broker) -> bool:
    plan = broker.plan
    used = BrokerSubscription.objects.filter(broker=broker, trial_used_at__isnull=False).exists()
    return bool(plan and plan.trial_days > 0 and not used)


def _url(outcome: str) -> str:
    return f"{settings.PUBLIC_BASE_URL.rstrip('/')}{SUBSCRIPTION_PATH}?{urlencode({'checkout': outcome})}"


def create_subscription_checkout(*, broker, customer_email: str = "", locale: str = "en", gateway=None) -> str:
    from payments.gateway import StripeUnavailable, default_gateway

    plan = broker.plan
    if plan is None or not plan.stripe_price_id:
        raise SubscriptionUnavailable()
    trial = trial_available(broker)
    metadata = {"kind": KIND, "broker_id": str(broker.pk), "trial": "1" if trial else "0"}
    subscription_data = {"metadata": metadata}
    params = {
        "mode": "subscription",
        "line_items": [{"price": plan.stripe_price_id, "quantity": 1}],
        "success_url": _url("success"),
        "cancel_url": _url("cancelled"),
        "client_reference_id": str(broker.pk),
        "locale": locale,
        "metadata": metadata,
        "subscription_data": subscription_data,
    }
    # Same rule as professionals/billing.py: an existing Stripe customer is
    # reused (no second customer per brokerage); otherwise Checkout is opened
    # with the payer's email so the field is not blank and the payment is
    # attributable in the Stripe dashboard.
    existing = BrokerSubscription.objects.filter(broker=broker).first()
    if existing and existing.stripe_customer_id:
        params["customer"] = existing.stripe_customer_id
    elif customer_email:
        params["customer_email"] = customer_email
    if trial:
        params["payment_method_collection"] = "always"
        subscription_data["trial_period_days"] = plan.trial_days
        subscription_data["trial_settings"] = {"end_behavior": {"missing_payment_method": "cancel"}}
    gateway = gateway or default_gateway()
    try:
        result = gateway.create_checkout_session(
            params=params, idempotency_key=f"broker-subscription:{broker.pk}:{uuid.uuid4()}"
        )
    except StripeUnavailable as exc:
        raise SubscriptionUnavailable() from exc
    return result.url


def _notify(broker, notification_type, key):
    """Tell everyone who can manage the brokerage's team (owner and admins)."""
    from .models import BrokerMembership

    managers = BrokerMembership.objects.filter(broker=broker, is_active=True, can_manage_team=True).select_related("user")
    for membership in managers:
        notify(
            membership.user,
            notification_type,
            target_url=SUBSCRIPTION_PATH,
            payload={"broker_id": str(broker.pk)},
            dedupe_key=f"{key}:{membership.user_id}",
        )


def _from_unix(value):
    return datetime.fromtimestamp(int(value), tz=dt_timezone.utc) if value else None


def _refs(invoice: dict) -> dict:
    details = (invoice.get("parent") or {}).get("subscription_details") or {}
    subscription = invoice.get("subscription") or details.get("subscription") or ""
    if not isinstance(subscription, str):
        subscription = (subscription or {}).get("id", "")
    metadata = details.get("metadata") or (invoice.get("subscription_details") or {}).get("metadata") or {}
    customer = invoice.get("customer")
    return {
        "subscription_id": subscription,
        "customer_id": customer if isinstance(customer, str) else "",
        "broker_id": metadata.get("broker_id", ""),
        "trial": metadata.get("trial") == "1",
    }


def _period_end_from(stripe_sub: dict):
    """`current_period_end` moved from the subscription onto its items in
    newer Stripe API versions; accept either shape."""
    items = (stripe_sub.get("items") or {}).get("data") or []
    return _from_unix(stripe_sub.get("current_period_end") or (items[0] if items else {}).get("current_period_end"))


def _is_trial_checkout(session: dict, metadata: dict) -> bool:
    """Stripe reports a trial checkout as "no_payment_required", but the €0
    first invoice can also surface as "paid"; a zero total settles it either
    way. Reading only payment_status recorded trials as paid ACTIVE rows
    (trial_used_at empty), which re-offered the trial."""
    return metadata.get("trial") == "1" and (
        session.get("payment_status") == "no_payment_required" or not session.get("amount_total")
    )


def _subscription_for(*, subscription_id="", customer_id="", broker_id=""):
    locked = BrokerSubscription.objects.select_for_update(of=("self",)).select_related("broker")
    found = locked.filter(stripe_subscription_id=subscription_id).first() if subscription_id else None
    if found is None and broker_id:
        broker = BrokerOrganization.objects.filter(pk=broker_id).first()
        if broker is not None:
            BrokerSubscription.objects.get_or_create(broker=broker)
            found = locked.filter(broker=broker).first()
    if found is None and customer_id:
        found = locked.filter(stripe_customer_id=customer_id).first()
    return found


def _sync_plan_renewal(subscription):
    if subscription.current_period_end:
        broker = subscription.broker
        broker.plan_renews_at = subscription.current_period_end.date()
        broker.save(update_fields=["plan_renews_at", "updated_at"])


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
    # Named fields only: a full save() would write back whatever this instance
    # was loaded with, including trial_* values another handler just set.
    subscription.save(update_fields=[*STRIPE_REF_FIELDS, "status", "past_due_since", "last_paid_at", "current_period_end", "updated_at"])
    _sync_plan_renewal(subscription)
    broker = subscription.broker
    if was_offline and broker.status == BrokerOrganizationStatus.SUSPENDED:
        broker.status = BrokerOrganizationStatus.ACTIVE
        broker.save(update_fields=["status", "updated_at"])


STRIPE_REF_FIELDS = ("stripe_customer_id", "stripe_subscription_id")
TRIAL_FIELDS = ("status", "trial_used_at", "trial_ends_at", "current_period_end")


def _start_trial(subscription, *, now=None):
    now = now or timezone.now()
    if subscription.status == SubscriptionStatus.TRIALING:
        # checkout.session.completed and the €0 invoice.paid both describe the
        # same trial; whichever lands second must not restart or extend it.
        subscription.save(update_fields=[*STRIPE_REF_FIELDS, "updated_at"])
        return
    days = subscription.broker.plan.trial_days if subscription.broker.plan else 0
    subscription.status = SubscriptionStatus.TRIALING
    subscription.trial_used_at = subscription.trial_used_at or now
    subscription.trial_ends_at = now + timedelta(days=days)
    subscription.current_period_end = subscription.trial_ends_at
    subscription.save(update_fields=[*STRIPE_REF_FIELDS, *TRIAL_FIELDS, "updated_at"])
    _sync_plan_renewal(subscription)
    _notify(subscription.broker, NotificationType.BROKER_TRIAL_STARTED, f"{subscription.pk}:trial:{now.date()}")


def _deactivate(subscription, *, status):
    subscription.status = status
    subscription.save(update_fields=["status", "updated_at"])
    broker = subscription.broker
    if broker.status == BrokerOrganizationStatus.ACTIVE:
        broker.status = BrokerOrganizationStatus.SUSPENDED
        broker.save(update_fields=["status", "updated_at"])
        _notify(broker, NotificationType.BROKER_SUSPENDED, f"{subscription.pk}:suspended:{timezone.now().date()}")


def handle_checkout(session: dict) -> str:
    from payments.enums import WebhookResult

    metadata = session.get("metadata") or {}
    status = session.get("payment_status")
    if metadata.get("kind") != KIND or status not in ("paid", "no_payment_required"):
        return WebhookResult.IGNORED
    subscription = _subscription_for(broker_id=metadata.get("broker_id", ""))
    if subscription is None:
        return WebhookResult.ORDER_NOT_FOUND
    subscription.stripe_customer_id = session.get("customer") or subscription.stripe_customer_id
    sub_id = session.get("subscription") or ""
    subscription.stripe_subscription_id = sub_id if isinstance(sub_id, str) else sub_id.get("id", "")
    if _is_trial_checkout(session, metadata):
        _start_trial(subscription)
    elif status == "paid":
        _activate(subscription)
    else:
        return WebhookResult.IGNORED
    return WebhookResult.FULFILLED


def handle_invoice_paid(event) -> str:
    from payments.enums import WebhookResult

    invoice = event["data"]["object"]
    refs = _refs(invoice)
    trial = refs.pop("trial")
    subscription = _subscription_for(**refs)
    if subscription is None:
        return WebhookResult.IGNORED
    if not subscription.stripe_subscription_id:
        subscription.stripe_subscription_id = refs["subscription_id"]
    if not invoice.get("amount_paid"):
        if subscription.status == SubscriptionStatus.TRIALING:
            return WebhookResult.FULFILLED
        if trial and subscription.trial_used_at is None:
            # Stripe's €0 trial invoice can land before checkout.session.completed;
            # it opens the trial rather than a paid period.
            _start_trial(subscription)
            return WebhookResult.FULFILLED
    lines = (invoice.get("lines") or {}).get("data") or []
    _activate(subscription, period_end=_from_unix(((lines[0] if lines else {}).get("period") or {}).get("end")))
    return WebhookResult.FULFILLED


def handle_subscription_updated(event) -> str:
    """Mirror what the customer did in Stripe's billing portal: a scheduled
    cancellation (`cancel_at_period_end`), its reversal, the period end, and
    the trial rolling into a paid period."""
    from payments.enums import WebhookResult

    stripe_sub = event["data"]["object"]
    subscription = _subscription_for(
        subscription_id=stripe_sub.get("id", ""),
        broker_id=(stripe_sub.get("metadata") or {}).get("broker_id", ""),
    )
    if subscription is None:
        return WebhookResult.IGNORED
    subscription.cancel_at_period_end = bool(stripe_sub.get("cancel_at_period_end"))
    period_end = _period_end_from(stripe_sub)
    if period_end:
        subscription.current_period_end = period_end
    if stripe_sub.get("status") == "active" and subscription.status == SubscriptionStatus.TRIALING:
        subscription.status = SubscriptionStatus.ACTIVE
    subscription.save(update_fields=["cancel_at_period_end", "current_period_end", "status", "updated_at"])
    _sync_plan_renewal(subscription)
    return WebhookResult.FULFILLED


def handle_invoice_payment_failed(event) -> str:
    from payments.enums import WebhookResult

    invoice = event["data"]["object"]
    invoice_id = invoice.get("id", "")
    refs = _refs(invoice)
    refs.pop("trial")
    subscription = _subscription_for(**refs)
    if subscription is None:
        return WebhookResult.IGNORED
    if subscription.past_due_since is None:
        subscription.past_due_since = timezone.now()
    if subscription.status in (SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING):
        subscription.status = SubscriptionStatus.PAST_DUE
    subscription.save()
    _notify(subscription.broker, NotificationType.BROKER_PAYMENT_FAILED, f"{subscription.pk}:failed:{invoice_id}")
    return WebhookResult.FULFILLED


def handle_subscription_deleted(event) -> str:
    from payments.enums import WebhookResult

    stripe_sub = event["data"]["object"]
    subscription = _subscription_for(
        subscription_id=stripe_sub.get("id", ""),
        broker_id=(stripe_sub.get("metadata") or {}).get("broker_id", ""),
    )
    if subscription is None:
        return WebhookResult.IGNORED
    _deactivate(subscription, status=SubscriptionStatus.CANCELED)
    return WebhookResult.FULFILLED


@transaction.atomic
def lapse_unpaid_brokers(*, now=None) -> int:
    now = now or timezone.now()
    due = list(
        BrokerSubscription.objects.select_for_update(of=("self",))
        .filter(status=SubscriptionStatus.PAST_DUE, past_due_since__lte=now - GRACE_PERIOD)
        .select_related("broker")
    )
    for subscription in due:
        _deactivate(subscription, status=SubscriptionStatus.LAPSED)
    return len(due)
