from types import SimpleNamespace

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from brokers import billing
from brokers.models import BrokerPlan, BrokerSubscription
from brokers.tests.factories import make_broker, make_membership
from payments.enums import WebhookResult
from payments.fulfillment import handle_checkout_session_paid
from payments.webhooks import HANDLERS

pytestmark = pytest.mark.django_db


@pytest.fixture
def broker():
    plan = BrokerPlan.objects.create(
        slug="t-plan", name="T", monthly_price=99, trial_days=30, stripe_product_id="prod_b", stripe_price_id="price_b"
    )
    return make_broker(status="PENDING", plan=plan)


def _session(broker, **extra):
    payload = {
        "id": "cs_b1",
        "mode": "subscription",
        "payment_status": "no_payment_required",
        "customer": "cus_b",
        "subscription": "sub_b",
        "metadata": {"kind": "broker_subscription", "broker_id": str(broker.pk), "trial": "1"},
    }
    payload.update(extra)
    return {"id": "evt_b", "type": "checkout.session.completed", "data": {"object": payload}}


def _invoice(event_type, broker, amount=0, invoice_id="in_b1"):
    return {
        "id": f"evt_{event_type}_{invoice_id}",
        "type": event_type,
        "data": {
            "object": {
                "id": invoice_id,
                "customer": "cus_b",
                "amount_paid": amount,
                "parent": {"subscription_details": {"subscription": "sub_b", "metadata": {"broker_id": str(broker.pk)}}},
                "lines": {"data": [{"period": {"end": int((timezone.now() + timezone.timedelta(days=30)).timestamp())}}]},
            }
        },
    }


def test_trial_starts_without_publishing_the_brokerage(broker):
    assert handle_checkout_session_paid(_session(broker)) == WebhookResult.FULFILLED
    broker.refresh_from_db()
    sub = BrokerSubscription.objects.get(broker=broker)
    assert (sub.status, broker.status) == ("TRIALING", "PENDING")
    assert sub.trial_used_at and broker.plan_renews_at is not None
    HANDLERS["invoice.paid"](_invoice("invoice.paid", broker, amount=0))
    sub.refresh_from_db()
    assert sub.status == "TRIALING"
    HANDLERS["invoice.paid"](_invoice("invoice.paid", broker, amount=9900, invoice_id="in_b2"))
    sub.refresh_from_db()
    assert sub.status == "ACTIVE"


def test_payment_failure_then_lapse_suspends_an_active_brokerage_and_payment_restores_it(broker):
    handle_checkout_session_paid(_session(broker))
    broker.status = "ACTIVE"
    broker.save()
    HANDLERS["invoice.payment_failed"](_invoice("invoice.payment_failed", broker))
    assert billing.lapse_unpaid_brokers(now=timezone.now() + timezone.timedelta(hours=25)) == 1
    broker.refresh_from_db()
    assert broker.status == "SUSPENDED"
    HANDLERS["invoice.paid"](_invoice("invoice.paid", broker, amount=9900, invoice_id="in_b3"))
    broker.refresh_from_db()
    assert broker.status == "ACTIVE"


def test_cancellation_takes_an_active_brokerage_offline(broker):
    handle_checkout_session_paid(_session(broker))
    broker.status = "ACTIVE"
    broker.save()
    event = {"id": "evt_d", "type": "customer.subscription.deleted", "data": {"object": {"id": "sub_b", "metadata": {}}}}
    assert HANDLERS["customer.subscription.deleted"](event) == WebhookResult.FULFILLED
    broker.refresh_from_db()
    assert broker.status == "SUSPENDED"


def test_professional_events_are_not_swallowed_by_broker_handlers(broker):
    event = {"id": "e", "type": "invoice.paid", "data": {"object": {"id": "in_x", "customer": "cus_none", "amount_paid": 5}}}
    assert HANDLERS["invoice.paid"](event) == WebhookResult.IGNORED


def test_checkout_sets_card_up_front_and_never_offers_a_second_trial(broker):
    captured = {}

    class Gateway:
        def create_checkout_session(self, *, params, idempotency_key):
            captured.clear()
            captured.update(params)
            return SimpleNamespace(url="https://stripe.example/b")

    billing.create_subscription_checkout(broker=broker, customer_email="owner@b.example", locale="it", gateway=Gateway())
    assert captured["locale"] == "it"
    assert captured["payment_method_collection"] == "always"
    assert captured["subscription_data"]["trial_period_days"] == 30
    # First checkout: the payer's email is prefilled; a later one reuses the Stripe customer instead.
    assert captured["customer_email"] == "owner@b.example" and "customer" not in captured
    BrokerSubscription.objects.create(broker=broker, trial_used_at=timezone.now(), stripe_customer_id="cus_b")
    billing.create_subscription_checkout(broker=broker, customer_email="owner@b.example", gateway=Gateway())
    assert "trial_period_days" not in captured["subscription_data"]
    assert captured["customer"] == "cus_b" and "customer_email" not in captured


def test_subscription_endpoint_permissions(broker):
    admin = make_user("a@b.example", role=UserRole.BROKER, verified=True)
    make_membership(admin, broker, role="ADMIN", can_edit_listings=True, can_manage_team=True, can_read_messages=True)
    viewer = make_user("v@b.example", role=UserRole.BROKER, verified=True)
    make_membership(viewer, broker, role="VIEWER")
    url = reverse("broker-subscription", args=[broker.pk])
    api = APIClient()
    api.force_authenticate(viewer)
    res = api.get(url)
    body = res.json()
    print(res.status_code, body)
    assert body["trial_available"] is True and body["trial_days"] == 30
    assert api.post(url).status_code == 403
    api.force_authenticate(admin)
    assert api.get(url).status_code == 200


def test_a_brokerage_submits_for_review_only_when_complete_and_subscribed(broker):
    from brokers.models import BrokerSubscription

    admin = make_user("sub@b.example", role=UserRole.BROKER, verified=True)
    make_membership(admin, broker, role="ADMIN", can_edit_listings=True, can_manage_team=True, can_read_messages=True)
    broker.status = "DRAFT"
    broker.save()
    api = APIClient()
    api.force_authenticate(admin)
    url = reverse("broker-profile-submit", args=[broker.pk])
    profile_url = reverse("broker-profile", args=[broker.pk])

    res = api.post(url)
    assert res.status_code == 400 and "profile_incomplete" in str(res.json())
    assert set(api.get(profile_url).json()["completeness"]["missing"]) == {"tagline", "about", "city", "specialties", "country_code"}

    api.patch(
        profile_url,
        {
            "tagline": "Boats we love",
            "about": "A family brokerage selling motor and sailing yachts along the Spanish coast since 1998.",
            "city": "Palma",
            "country_code": "es",
            "specialties": ["Motor yachts"],
        },
        format="json",
    )
    assert "subscription_required" in str(api.post(url).json())
    BrokerSubscription.objects.create(broker=broker, status="TRIALING")
    res = api.post(url)
    assert res.status_code == 200 and res.json()["status"] == "PENDING"


def test_team_managers_are_told_about_trial_payment_failure_and_suspension(broker):
    from notifications.models import Notification

    admin = make_user("admin@notify.example", role=UserRole.BROKER, verified=True)
    make_membership(admin, broker, can_manage_team=True)
    agent = make_user("agent@notify.example", role=UserRole.BROKER, verified=True)
    make_membership(agent, broker)

    handle_checkout_session_paid(_session(broker))
    broker.status = "ACTIVE"
    broker.save()
    HANDLERS["invoice.payment_failed"](_invoice("invoice.payment_failed", broker))
    billing.lapse_unpaid_brokers(now=timezone.now() + timezone.timedelta(hours=25))

    kinds = set(Notification.objects.filter(recipient=admin).values_list("notification_type", flat=True))
    assert {"broker.trial_started", "broker.payment_failed", "broker.suspended"} <= kinds
    assert not Notification.objects.filter(recipient=agent).exists()


def _stripe_subscription_event(broker, **extra):
    payload = {
        "id": "sub_b",
        "status": "trialing",
        "cancel_at_period_end": False,
        "metadata": {"kind": "broker_subscription", "broker_id": str(broker.pk), "trial": "1"},
        "items": {"data": [{"current_period_end": int((timezone.now() + timezone.timedelta(days=30)).timestamp())}]},
    }
    payload.update(extra)
    return {"id": "evt_upd", "type": "customer.subscription.updated", "data": {"object": payload}}


def test_a_trial_invoice_arriving_before_the_checkout_event_opens_the_trial_not_a_paid_period(broker):
    invoice = _invoice("invoice.paid", broker, amount=0)
    invoice["data"]["object"]["parent"]["subscription_details"]["metadata"]["trial"] = "1"

    assert HANDLERS["invoice.paid"](invoice) == WebhookResult.FULFILLED
    sub = BrokerSubscription.objects.get(broker=broker)
    assert sub.status == "TRIALING"
    assert sub.trial_used_at is not None and sub.trial_ends_at is not None
    first_trial_end = sub.trial_ends_at

    assert handle_checkout_session_paid(_session(broker)) == WebhookResult.FULFILLED
    sub.refresh_from_db()
    assert (sub.status, sub.trial_ends_at) == ("TRIALING", first_trial_end)
    assert billing.trial_available(broker) is False


def test_a_zero_total_checkout_reported_as_paid_is_still_a_trial(broker):
    event = _session(broker, payment_status="paid", amount_total=0)

    assert handle_checkout_session_paid(event) == WebhookResult.FULFILLED
    sub = BrokerSubscription.objects.get(broker=broker)
    assert sub.status == "TRIALING" and sub.trial_used_at is not None
    assert billing.trial_available(broker) is False


def test_a_portal_cancellation_is_mirrored_and_can_be_reversed(broker):
    handle_checkout_session_paid(_session(broker))
    api = APIClient()
    owner = make_user("b-owner@example.com", role=UserRole.BROKER, verified=True)
    make_membership(owner, broker, role="ADMIN", can_manage_team=True)
    api.force_authenticate(owner)
    url = reverse("broker-subscription", kwargs={"broker_id": broker.pk})

    assert HANDLERS["customer.subscription.updated"](_stripe_subscription_event(broker, cancel_at_period_end=True)) == WebhookResult.FULFILLED
    assert api.get(url).data["cancel_at_period_end"] is True
    assert BrokerSubscription.objects.get(broker=broker).status == "TRIALING"

    HANDLERS["customer.subscription.updated"](_stripe_subscription_event(broker, cancel_at_period_end=False))
    assert api.get(url).data["cancel_at_period_end"] is False


def test_the_trial_rolling_into_a_paid_period_activates_the_subscription(broker):
    handle_checkout_session_paid(_session(broker))

    HANDLERS["customer.subscription.updated"](_stripe_subscription_event(broker, status="active"))

    assert BrokerSubscription.objects.get(broker=broker).status == "ACTIVE"
