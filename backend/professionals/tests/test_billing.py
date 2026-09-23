from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from notifications.models import Notification
from payments.enums import WebhookResult
from payments.fulfillment import handle_checkout_session_paid
from payments.webhooks import HANDLERS
from professionals import billing
from professionals.enums import ProfessionalProfileStatus, SubscriptionStatus
from professionals.models import ProfessionalPlan, ProfessionalSubscription
from professionals.tests.factories import make_professional


@pytest.fixture
def profile(db):
    owner = make_user("pro@example.com", role=UserRole.PROFESSIONAL)
    return make_professional(owner, status=ProfessionalProfileStatus.PENDING)


def _approve(profile):
    profile.status = ProfessionalProfileStatus.ACTIVE
    profile.save()


def _session(profile, **overrides):
    payload = {
        "id": "cs_sub_1",
        "mode": "subscription",
        "payment_status": "paid",
        "customer": "cus_1",
        "subscription": "sub_1",
        "metadata": {"kind": "professional_membership", "professional_id": str(profile.pk)},
    }
    payload.update(overrides)
    return {"id": "evt_1", "type": "checkout.session.completed", "data": {"object": payload}}


def _invoice_event(event_type, profile, invoice_id="in_1"):
    return {
        "id": f"evt_{event_type}_{invoice_id}",
        "type": event_type,
        "data": {
            "object": {
                "id": invoice_id,
                "customer": "cus_1",
                "parent": {
                    "subscription_details": {
                        "subscription": "sub_1",
                        "metadata": {"professional_id": str(profile.pk)},
                    }
                },
                "lines": {"data": [{"period": {"end": int((timezone.now() + timedelta(days=30)).timestamp())}}]},
            }
        },
    }


@pytest.mark.django_db
def test_first_payment_activates_both_the_subscription_and_the_profile(profile):
    assert handle_checkout_session_paid(_session(profile)) == WebhookResult.FULFILLED

    profile.refresh_from_db()
    subscription = ProfessionalSubscription.objects.get(profile=profile)
    assert profile.status == ProfessionalProfileStatus.ACTIVE
    assert subscription.status == SubscriptionStatus.ACTIVE
    assert subscription.stripe_subscription_id == "sub_1"
    assert Notification.objects.filter(recipient=profile.owner_user, notification_type="professional.activated").exists()


@pytest.mark.django_db
def test_a_trial_checkout_starts_a_free_trial_without_a_charge(profile):
    ProfessionalPlan.objects.create(slug="t", name="T", monthly_price=49, trial_days=30, is_active=True, stripe_product_id="prod_1", stripe_price_id="price_1")
    result = handle_checkout_session_paid(
        _session(profile, payment_status="no_payment_required", metadata={
            "kind": "professional_membership", "professional_id": str(profile.pk), "trial": "1",
        })
    )
    assert result == WebhookResult.FULFILLED
    subscription = ProfessionalSubscription.objects.get(profile=profile)
    assert subscription.status == SubscriptionStatus.TRIALING
    assert subscription.trial_used_at is not None
    assert 29 <= (subscription.trial_ends_at - timezone.now()).days <= 30

    # The zero-amount invoice that opens a trial is not a payment.
    event = _invoice_event("invoice.paid", profile, invoice_id="in_trial")
    event["data"]["object"]["amount_paid"] = 0
    HANDLERS["invoice.paid"](event)
    subscription.refresh_from_db()
    assert subscription.status == SubscriptionStatus.TRIALING

    # The first real charge after the trial makes it a paying subscription.
    paid = _invoice_event("invoice.paid", profile, invoice_id="in_real")
    paid["data"]["object"]["amount_paid"] = 4900
    HANDLERS["invoice.paid"](paid)
    subscription.refresh_from_db()
    assert subscription.status == SubscriptionStatus.ACTIVE


@pytest.mark.django_db
def test_a_second_trial_is_never_offered(profile):
    ProfessionalPlan.objects.create(slug="t", name="T", monthly_price=49, trial_days=30, is_active=True, stripe_price_id="price_1")
    ProfessionalSubscription.objects.create(profile=profile, trial_used_at=timezone.now())
    captured = {}

    class Gateway:
        def create_checkout_session(self, *, params, idempotency_key):
            captured.update(params)
            from types import SimpleNamespace
            return SimpleNamespace(url="https://stripe.example/x")

    billing.create_membership_checkout(profile=profile, gateway=Gateway())
    assert "trial_period_days" not in captured["subscription_data"]
    assert captured["metadata"]["trial"] == "0"


@pytest.mark.django_db
def test_the_first_checkout_collects_a_card_and_asks_for_the_trial(profile):
    ProfessionalPlan.objects.create(slug="t", name="T", monthly_price=49, trial_days=30, is_active=True, stripe_price_id="price_1")
    captured = {}

    class Gateway:
        def create_checkout_session(self, *, params, idempotency_key):
            captured.update(params)
            from types import SimpleNamespace
            return SimpleNamespace(url="https://stripe.example/x")

    profile.owner_user.locale = "ES"
    profile.owner_user.save(update_fields=["locale"])
    billing.create_membership_checkout(profile=profile, gateway=Gateway())
    assert captured["locale"] == "es"
    assert captured["payment_method_collection"] == "always"
    assert captured["subscription_data"]["trial_period_days"] == 30
    assert captured["subscription_data"]["trial_settings"] == {"end_behavior": {"missing_payment_method": "cancel"}}


@pytest.mark.django_db
def test_an_unpaid_subscription_session_does_nothing(profile):
    handle_checkout_session_paid(_session(profile, payment_status="unpaid"))
    profile.refresh_from_db()
    assert profile.status == ProfessionalProfileStatus.PENDING


@pytest.mark.django_db
def test_failed_payment_warns_then_goes_offline_after_24_hours(profile):
    _approve(profile)
    handle_checkout_session_paid(_session(profile))
    HANDLERS["invoice.payment_failed"](_invoice_event("invoice.payment_failed", profile))

    subscription = ProfessionalSubscription.objects.get(profile=profile)
    assert subscription.status == SubscriptionStatus.PAST_DUE
    assert Notification.objects.filter(recipient=profile.owner_user, notification_type="professional.payment_failed").exists()

    # Inside the grace period nothing changes.
    assert billing.lapse_unpaid_professionals(now=timezone.now() + timedelta(hours=23)) == 0
    profile.refresh_from_db()
    assert profile.status == ProfessionalProfileStatus.ACTIVE

    assert billing.lapse_unpaid_professionals(now=timezone.now() + timedelta(hours=25)) == 1
    profile.refresh_from_db()
    assert profile.status == ProfessionalProfileStatus.SUSPENDED
    assert Notification.objects.filter(recipient=profile.owner_user, notification_type="professional.deactivated").exists()


@pytest.mark.django_db
def test_a_later_payment_brings_a_lapsed_profile_back(profile):
    _approve(profile)
    handle_checkout_session_paid(_session(profile))
    HANDLERS["invoice.payment_failed"](_invoice_event("invoice.payment_failed", profile))
    billing.lapse_unpaid_professionals(now=timezone.now() + timedelta(hours=25))

    HANDLERS["invoice.paid"](_invoice_event("invoice.paid", profile, invoice_id="in_2"))

    profile.refresh_from_db()
    assert profile.status == ProfessionalProfileStatus.ACTIVE
    assert ProfessionalSubscription.objects.get(profile=profile).past_due_since is None


@pytest.mark.django_db
def test_a_staff_suspension_is_not_lifted_by_a_payment(profile):
    handle_checkout_session_paid(_session(profile))
    profile.status = ProfessionalProfileStatus.SUSPENDED
    profile.save()

    HANDLERS["invoice.paid"](_invoice_event("invoice.paid", profile, invoice_id="in_3"))

    profile.refresh_from_db()
    assert profile.status == ProfessionalProfileStatus.SUSPENDED


@pytest.mark.django_db
def test_cancelling_the_subscription_takes_the_profile_offline(profile):
    _approve(profile)
    handle_checkout_session_paid(_session(profile))
    event = {"id": "evt_del", "type": "customer.subscription.deleted", "data": {"object": {"id": "sub_1", "metadata": {}}}}

    assert HANDLERS["customer.subscription.deleted"](event) == WebhookResult.FULFILLED

    profile.refresh_from_db()
    assert profile.status == ProfessionalProfileStatus.SUSPENDED
    assert ProfessionalSubscription.objects.get(profile=profile).status == SubscriptionStatus.CANCELED


@pytest.mark.django_db
def test_checkout_endpoint_needs_an_active_plan_then_opens_a_subscription_session(profile):
    from payments.tests.fakes import FakeStripeGateway

    api = APIClient()
    api.force_authenticate(profile.owner_user)
    assert api.post(reverse("provider-membership-checkout")).status_code == 503

    ProfessionalPlan.objects.update(is_active=True, stripe_product_id="prod_x", stripe_price_id="price_x")
    gateway = FakeStripeGateway()
    url = billing.create_membership_checkout(profile=profile, gateway=gateway)

    params = gateway.created[0]["params"]
    assert url and params["mode"] == "subscription"
    assert params["line_items"] == [{"price": "price_x", "quantity": 1}]
    assert params["subscription_data"]["metadata"]["professional_id"] == str(profile.pk)
    assert params["customer_email"] == profile.owner_user.email


@pytest.mark.django_db
def test_checkout_reuses_the_existing_stripe_customer_instead_of_an_email(profile):
    from payments.tests.fakes import FakeStripeGateway

    ProfessionalPlan.objects.update(is_active=True, stripe_product_id="prod_x", stripe_price_id="price_x")
    ProfessionalSubscription.objects.create(profile=profile, stripe_customer_id="cus_existing")
    gateway = FakeStripeGateway()

    billing.create_membership_checkout(profile=profile, gateway=gateway)

    params = gateway.created[0]["params"]
    assert params["customer"] == "cus_existing"
    assert "customer_email" not in params


@pytest.mark.django_db
def test_membership_status_endpoint(profile):
    api = APIClient()
    api.force_authenticate(profile.owner_user)
    response = api.get(reverse("provider-membership"))
    assert response.status_code == 200
    assert response.data["status"] == "INACTIVE"
    assert response.data["profile_status"] == "PENDING"


def _stripe_subscription_event(profile, **extra):
    payload = {
        "id": "sub_1",
        "status": "trialing",
        "cancel_at_period_end": False,
        "metadata": {"kind": "professional_membership", "professional_id": str(profile.pk), "trial": "1"},
        "items": {"data": [{"current_period_end": int((timezone.now() + timedelta(days=30)).timestamp())}]},
    }
    payload.update(extra)
    return {"id": "evt_upd", "type": "customer.subscription.updated", "data": {"object": payload}}


@pytest.mark.django_db
def test_a_trial_invoice_arriving_before_the_checkout_event_opens_the_trial_not_a_paid_period(profile):
    ProfessionalPlan.objects.create(slug="t", name="T", monthly_price=49, trial_days=30, is_active=True, stripe_price_id="price_1")
    invoice = _invoice_event("invoice.paid", profile)
    invoice["data"]["object"]["amount_paid"] = 0
    invoice["data"]["object"]["parent"]["subscription_details"]["metadata"]["trial"] = "1"

    assert HANDLERS["invoice.paid"](invoice) == WebhookResult.FULFILLED
    sub = ProfessionalSubscription.objects.get(profile=profile)
    assert sub.status == SubscriptionStatus.TRIALING and sub.trial_used_at is not None
    first_trial_end = sub.trial_ends_at

    session = _session(profile, payment_status="no_payment_required")
    session["data"]["object"]["metadata"]["trial"] = "1"
    assert handle_checkout_session_paid(session) == WebhookResult.FULFILLED
    sub.refresh_from_db()
    assert (sub.status, sub.trial_ends_at) == (SubscriptionStatus.TRIALING, first_trial_end)


@pytest.mark.django_db
def test_a_zero_total_checkout_reported_as_paid_is_still_a_trial(profile):
    ProfessionalPlan.objects.create(slug="t", name="T", monthly_price=49, trial_days=30, is_active=True, stripe_price_id="price_1")
    session = _session(profile, payment_status="paid", amount_total=0)
    session["data"]["object"]["metadata"]["trial"] = "1"

    assert handle_checkout_session_paid(session) == WebhookResult.FULFILLED
    sub = ProfessionalSubscription.objects.get(profile=profile)
    assert sub.status == SubscriptionStatus.TRIALING and sub.trial_used_at is not None


@pytest.mark.django_db
def test_a_portal_cancellation_is_mirrored_and_can_be_reversed(profile):
    handle_checkout_session_paid(_session(profile))
    api = APIClient()
    api.force_authenticate(profile.owner_user)
    url = reverse("provider-membership")

    event = _stripe_subscription_event(profile, status="active", cancel_at_period_end=True)
    assert HANDLERS["customer.subscription.updated"](event) == WebhookResult.FULFILLED
    assert api.get(url).data["cancel_at_period_end"] is True
    assert ProfessionalSubscription.objects.get(profile=profile).status == SubscriptionStatus.ACTIVE

    HANDLERS["customer.subscription.updated"](_stripe_subscription_event(profile, status="active"))
    assert api.get(url).data["cancel_at_period_end"] is False
