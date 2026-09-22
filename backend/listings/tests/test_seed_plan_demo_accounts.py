import pytest
from django.core.management import call_command

from accounts.models import User
from brokers.models import BrokerOrganization, BrokerSubscription
from entitlements.models import UserEntitlement
from professionals.enums import SubscriptionStatus
from professionals.models import ProfessionalProfile, ProfessionalSubscription

pytestmark = pytest.mark.django_db


def test_seed_activates_one_demo_account_per_paid_package_bypassing_stripe():
    call_command("seed_plan_demo_accounts", password="Demo-Test-12345!")

    for slug in ["boutique-broker", "premier-fleet", "sovereign-agency"]:
        org = BrokerOrganization.objects.get(slug=f"pd-{slug}")
        assert org.plan.slug == slug
        assert org.plan_renews_at is not None
        subscription = BrokerSubscription.objects.get(broker=org)
        assert subscription.status == SubscriptionStatus.ACTIVE
        assert subscription.stripe_subscription_id.startswith("bypass_")

    professional = ProfessionalProfile.objects.get(slug="pd-professional-membership-demo")
    subscription = ProfessionalSubscription.objects.get(profile=professional)
    assert subscription.status == SubscriptionStatus.ACTIVE

    seller = User.objects.get(email="pd-seller@demo.nauta.test")
    assert seller.check_password("Demo-Test-12345!")
    assert UserEntitlement.objects.for_user(seller).paid().available().exists()

    # Safe to re-run: no duplicate subscriptions or entitlement grants.
    call_command("seed_plan_demo_accounts", password="Demo-Test-12345!")
    assert BrokerSubscription.objects.filter(broker__slug="pd-boutique-broker").count() == 1
    assert ProfessionalSubscription.objects.filter(profile=professional).count() == 1
    assert UserEntitlement.objects.for_user(seller).paid().available().count() == 1

    # seed_demo_data's --reset-only removes this data too, since it shares the demo domain.
    call_command("seed_demo_data", reset_only=True)
    assert not User.objects.filter(email__startswith="pd-").exists()
    assert not BrokerOrganization.objects.filter(slug__startswith="pd-").exists()
    assert not ProfessionalProfile.objects.filter(slug__startswith="pd-").exists()
