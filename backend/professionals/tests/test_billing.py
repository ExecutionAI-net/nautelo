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
    owner = make_user("pro@example.com", role=UserRole.SERVICE_PROVIDER)
    return make_professional(owner, status=ProfessionalProfileStatus.PENDING)


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
def test_first_payment_activates_the_profile_automatically(profile):
    assert handle_checkout_session_paid(_session(profile)) == WebhookResult.FULFILLED

    profile.refresh_from_db()
    subscription = ProfessionalSubscription.objects.get(profile=profile)
    assert profile.status == ProfessionalProfileStatus.ACTIVE
    assert subscription.status == SubscriptionStatus.ACTIVE
    assert subscription.stripe_subscription_id == "sub_1"
    assert Notification.objects.filter(recipient=profile.owner_user, notification_type="professional.activated").exists()


@pytest.mark.django_db
def test_an_unpaid_subscription_session_does_nothing(profile):
    handle_checkout_session_paid(_session(profile, payment_status="unpaid"))
    profile.refresh_from_db()
    assert profile.status == ProfessionalProfileStatus.PENDING


@pytest.mark.django_db
def test_failed_payment_warns_then_goes_offline_after_24_hours(profile):
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


@pytest.mark.django_db
def test_membership_status_endpoint(profile):
    api = APIClient()
    api.force_authenticate(profile.owner_user)
    response = api.get(reverse("provider-membership"))
    assert response.status_code == 200
    assert response.data["status"] == "INACTIVE"
    assert response.data["profile_status"] == "PENDING"
