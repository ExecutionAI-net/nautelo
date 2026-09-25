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
    from payments.checkout import checkout_locale
    from payments.gateway import StripeUnavailable, default_gateway

    plan = get_plan()
    if plan is None:
        raise MembershipUnavailable()
    gateway = gateway or default_gateway()
    trial = plan.trial_days > 0 and not ProfessionalSubscription.objects.filter(
        profile=profile, trial_used_at__isnull=False
    ).exists()
    metadata = {"kind": KIND, "professional_id": str(profile.pk), "trial": "1" if trial else "0"}
    subscription_data = {"metadata": metadata}
    params = {
        "mode": "subscription",
        "line_items": [{"price": plan.stripe_price_id, "quantity": 1}],
        "success_url": _url("success"),
        "cancel_url": _url("cancelled"),
        "client_reference_id": str(profile.pk),
        "locale": checkout_locale(profile.owner_user),
        "metadata": metadata,
        "subscription_data": subscription_data,
    }
    # Without this, Stripe Checkout leaves the email field blank and every
    # payment shows up identical in the dashboard - there is no way to tell
    # which professional paid. `customer` (an existing Stripe customer from a
    # prior checkout) takes precedence over `customer_email` so paying again
    # does not mint a second Stripe customer for the same professional.
    existing = ProfessionalSubscription.objects.filter(profile=profile).first()
    if existing and existing.stripe_customer_id:
        params["customer"] = existing.stripe_customer_id
    else:
        params["customer_email"] = profile.owner_user.email
    if trial:
        # The card is collected now; the first charge happens when the trial
        # ends. No card on file at that point cancels the subscription.
        params["payment_method_collection"] = "always"
        subscription_data["trial_period_days"] = plan.trial_days
        subscription_data["trial_settings"] = {"end_behavior": {"missing_payment_method": "cancel"}}
    try:
        result = gateway.create_checkout_session(
            params=params,
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
    # Named fields only: a full save() would write back whatever this instance
    # was loaded with, including trial_* values another handler just set.
    subscription.save(update_fields=[*STRIPE_REF_FIELDS, "status", "past_due_since", "last_paid_at", "current_period_end", "updated_at"])

    profile = subscription.profile
    # Payment is what puts a profile live - a brand-new profile's first
    # payment (DRAFT/PENDING) or a lapsed one paying again (SUSPENDED because
    # its own subscription had gone offline) both go ACTIVE here. The one
    # exception: a profile a staff member suspended while its subscription
    # kept renewing normally (`not was_offline`) is a policy decision, not a
    # billing state, and a routine recurring payment must not silently
    # override it.
    staff_suspended = profile.status == ProfessionalProfileStatus.SUSPENDED and not was_offline
    if profile.status != ProfessionalProfileStatus.ACTIVE and not staff_suspended:
        profile.status = ProfessionalProfileStatus.ACTIVE
        profile.save(update_fields=["status", "updated_at"])
        _notify(profile, NotificationType.PROFESSIONAL_ACTIVATED, f"{subscription.pk}:active:{now.date()}")


STRIPE_REF_FIELDS = ("stripe_customer_id", "stripe_subscription_id")
TRIAL_FIELDS = ("status", "trial_used_at", "trial_ends_at", "current_period_end")


def _start_trial(subscription, *, now=None):
    now = now or timezone.now()
    if subscription.status == SubscriptionStatus.TRIALING:
        # checkout.session.completed and the €0 invoice.paid both describe the
        # same trial; whichever lands second must not restart or extend it.
        subscription.save(update_fields=[*STRIPE_REF_FIELDS, "updated_at"])
        return
    plan = get_plan()
    days = plan.trial_days if plan else 0
    subscription.status = SubscriptionStatus.TRIALING
    subscription.trial_used_at = subscription.trial_used_at or now
    subscription.trial_ends_at = now + timedelta(days=days)
    subscription.current_period_end = subscription.trial_ends_at
    subscription.save(update_fields=[*STRIPE_REF_FIELDS, *TRIAL_FIELDS, "updated_at"])


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


def handle_membership_checkout(session: dict) -> str:
    from payments.enums import WebhookResult

    metadata = session.get("metadata") or {}
    # A trial checkout completes with no payment due; a paid one with "paid".
    if metadata.get("kind") != KIND or session.get("payment_status") not in ("paid", "no_payment_required"):
        return WebhookResult.IGNORED
    subscription = _subscription_for(professional_id=metadata.get("professional_id", ""))
    if subscription is None:
        return WebhookResult.ORDER_NOT_FOUND
    subscription.stripe_customer_id = session.get("customer") or subscription.stripe_customer_id
    sub_id = session.get("subscription") or ""
    subscription.stripe_subscription_id = sub_id if isinstance(sub_id, str) else sub_id.get("id", "")
    if _is_trial_checkout(session, metadata):
        _start_trial(subscription)
    elif session.get("payment_status") == "paid":
        _activate(subscription)
    else:
        return WebhookResult.IGNORED
    return WebhookResult.FULFILLED


def handle_invoice_paid(event) -> str:
    from payments.enums import WebhookResult

    invoice = event["data"]["object"]
    refs = _invoice_refs(invoice)
    trial = refs.pop("trial")
    subscription = _subscription_for(**refs)
    if subscription is None:
        return WebhookResult.IGNORED
    if not subscription.stripe_subscription_id:
        subscription.stripe_subscription_id = refs["subscription_id"]
    if not invoice.get("amount_paid"):
        # The zero-amount invoice Stripe issues when a trial starts is not a payment.
        if subscription.status == SubscriptionStatus.TRIALING:
            return WebhookResult.FULFILLED
        if trial and subscription.trial_used_at is None:
            # It can land before checkout.session.completed; it opens the trial.
            _start_trial(subscription)
            return WebhookResult.FULFILLED
    lines = (invoice.get("lines") or {}).get("data") or []
    period_end = _from_unix(((lines[0] if lines else {}).get("period") or {}).get("end"))
    _activate(subscription, period_end=period_end)
    return WebhookResult.FULFILLED


def handle_invoice_payment_failed(event) -> str:
    from payments.enums import WebhookResult

    invoice = event["data"]["object"]
    refs = _invoice_refs(invoice)
    refs.pop("trial")
    subscription = _subscription_for(**refs)
    if subscription is None:
        return WebhookResult.IGNORED
    if subscription.past_due_since is None:
        subscription.past_due_since = timezone.now()
    if subscription.status in (SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING):
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


def handle_subscription_updated(event) -> str:
    """Mirror what the customer did in Stripe's billing portal: a scheduled
    cancellation (`cancel_at_period_end`), its reversal, the period end, and
    the trial rolling into a paid period."""
    from payments.enums import WebhookResult

    stripe_sub = event["data"]["object"]
    subscription = _subscription_for(
        subscription_id=stripe_sub.get("id", ""),
        professional_id=(stripe_sub.get("metadata") or {}).get("professional_id", ""),
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
