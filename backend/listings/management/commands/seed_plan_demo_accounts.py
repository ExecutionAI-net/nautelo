"""Activate one demo account per paid package, bypassing Stripe entirely, so the
packages can be reviewed in the UI without a real checkout.

Every mechanism this command drives already exists and is the same one a real
purchase or a staff action would use — it just skips the Stripe round-trip:

- Broker plans: `BrokerOrganization.plan` + a `BrokerSubscription` row, exactly
  what `brokers.billing` sets from a paid Stripe webhook (see
  ``StaffBrokerPlanAssignView`` for the same bypass at the single-broker level).
- Professional membership: a `ProfessionalSubscription` row, same shape as
  `brokers.billing`'s broker-side counterpart. The `ProfessionalPlan` row
  itself is left untouched (its `is_active` gates the *pricing page and
  checkout*, not one profile's own subscription state).
- Individual seller paid listing: `entitlements.services.grant_listing_right`,
  the same staff-grant path spec §26.3 already defines for a compensatory
  right, with `EntitlementSource.STAFF_GRANT` marking it as never Stripe.

Accounts use @demo.nauta.test with a "pd-" prefix (paid-demo), so
``seed_demo_data --reset-only`` removes them too. Safe to re-run: every
account and its subscription state are upserted, never duplicated.
Development / staging only.

    python manage.py seed_plan_demo_accounts
    python manage.py seed_plan_demo_accounts --password '...'
"""

import os
import random
import secrets
from datetime import timedelta

from django.core.management.base import CommandError
from django.db import transaction
from django.utils import timezone

from accounts.enums import UserRole
from brokers.enums import BrokerMembershipRole, BrokerOrganizationStatus
from brokers.models import BrokerMembership, BrokerOrganization, BrokerPlan, BrokerSubscription
from entitlements.enums import EntitlementType
from entitlements.models import UserEntitlement
from entitlements.services import grant_listing_right
from listings.management.commands import seed_demo_data as base
from professionals.enums import ProfessionalProfileStatus, SubscriptionStatus
from professionals.models import ProfessionalPlan, ProfessionalProfile, ProfessionalSubscription

BROKER_TIERS = ["boutique-broker", "premier-fleet", "sovereign-agency"]


class Command(base.Command):
    help = "Activate one demo account per paid package (broker tiers, professional membership, individual paid listing), bypassing Stripe. Dev/staging only."

    def add_arguments(self, parser):
        parser.add_argument("--password", default=None, help="Password for every account (random by default).")
        parser.add_argument("--allow-production", action="store_true", help="Allow running when DEPLOY_ENVIRONMENT=prod (do not).")

    def handle(self, *args, **opts):
        if os.environ.get("DEPLOY_ENVIRONMENT") == "prod" and not opts["allow_production"]:
            raise CommandError("Refusing to seed demo data in the prod environment.")

        self.password = opts["password"] or secrets.token_urlsafe(12) + "aA1!"
        self.now = timezone.now()
        self.rng = random.Random(20260923)
        self.accounts = []
        with transaction.atomic():
            for slug in BROKER_TIERS:
                self.activate_broker(slug)
            self.activate_professional()
            self.activate_individual_seller()
        self.report()

    def activate_broker(self, plan_slug):
        try:
            plan = BrokerPlan.objects.get(slug=plan_slug)
        except BrokerPlan.DoesNotExist:
            raise CommandError(
                f"BrokerPlan '{plan_slug}' does not exist. Run migrations (brokers.0005_seed_plans) first."
            )

        local = f"pd-broker-{plan_slug}"
        org_slug = f"pd-{plan_slug}"
        org = BrokerOrganization.objects.filter(slug=org_slug).first() or BrokerOrganization(slug=org_slug)
        org.name = f"{plan.name} Demo Brokerage"
        org.status = BrokerOrganizationStatus.ACTIVE
        org.public_email = f"office-{local}@{base.DEMO_DOMAIN}"
        org.public_phone = "+34 600 400 500"
        org.tagline = f"Bypassed straight onto the {plan.name} plan for UI testing."
        org.city = "Palma"
        org.country_code = "ES"
        org.plan = plan
        org.plan_renews_at = (self.now + timedelta(days=30)).date()
        org.save()

        owner = self.make_user(local, UserRole.BROKER, f"{plan.name} Demo Owner")
        BrokerMembership.objects.update_or_create(
            user=owner,
            broker=org,
            defaults={
                "role": BrokerMembershipRole.ADMIN,
                "is_owner": True,
                "can_edit_listings": True,
                "can_manage_team": True,
                "can_read_messages": True,
                "is_active": True,
            },
        )

        BrokerSubscription.objects.update_or_create(
            broker=org,
            defaults={
                "status": SubscriptionStatus.ACTIVE,
                "stripe_customer_id": f"bypass_{org_slug}",
                "stripe_subscription_id": f"bypass_{org_slug}",
                "current_period_end": self.now + timedelta(days=30),
                "last_paid_at": self.now,
            },
        )

    def activate_professional(self):
        # Ensure the single membership plan row exists, but never flip its
        # `is_active` here: that flag gates the pricing page and checkout
        # eligibility (and is DB-constrained to require a real Stripe price),
        # neither of which this bypass touches.
        ProfessionalPlan.objects.get_or_create(slug="professional-membership")

        local = "pd-professional"
        owner = self.make_user(local, UserRole.PROFESSIONAL, "Professional Membership Demo")
        profile = ProfessionalProfile.objects.filter(owner_user=owner).first() or ProfessionalProfile(
            owner_user=owner
        )
        profile.display_name = "Professional Membership Demo"
        profile.slug = "pd-professional-membership-demo"
        profile.status = ProfessionalProfileStatus.ACTIVE
        profile.short_description = "Bypassed straight onto an active membership for UI testing."
        profile.public_email = f"contact-{local}@{base.DEMO_DOMAIN}"
        profile.public_phone = "+39 340 900 100"
        profile.city = "Genoa"
        profile.country_code = "IT"
        profile.save()

        ProfessionalSubscription.objects.update_or_create(
            profile=profile,
            defaults={
                "status": SubscriptionStatus.ACTIVE,
                "stripe_customer_id": "bypass_pd_professional",
                "stripe_subscription_id": "bypass_pd_professional",
                "current_period_end": self.now + timedelta(days=30),
                "last_paid_at": self.now,
            },
        )

    def activate_individual_seller(self):
        local = "pd-seller"
        owner = self.make_user(local, UserRole.PRIVATE_SELLER, "Paid Listing Demo Seller")
        # grant_listing_right() always creates a fresh ledger row; guard against
        # piling up a new one on every re-run of this command.
        already_available = UserEntitlement.objects.for_user(owner).paid().available(self.now).exists()
        if not already_available:
            grant_listing_right(
                user=owner,
                actor=None,
                reason="QA bypass: activate the paid-listing package for UI testing (no Stripe).",
                entitlement_type=EntitlementType.PAID_LISTING,
                now=self.now,
            )

    def report(self):
        self.stdout.write(self.style.SUCCESS("Paid packages activated, bypassing Stripe:"))
        self.stdout.write(f"  password for every account: {self.password}")
        for slug in BROKER_TIERS:
            self.stdout.write(f"  broker/{slug}: pd-broker-{slug}@{base.DEMO_DOMAIN}")
        self.stdout.write(f"  professional membership: pd-professional@{base.DEMO_DOMAIN}")
        self.stdout.write(f"  individual paid listing: pd-seller@{base.DEMO_DOMAIN}")
