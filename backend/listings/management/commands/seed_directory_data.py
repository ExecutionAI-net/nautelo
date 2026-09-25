"""Add 100 broker organizations and 100 professional profiles across many sectors,
locations and languages — for testing the brokers/professionals directory search and
filter UI at a realistic volume (a handful of rows per filter combination isn't enough).

Builds on seed_demo_data: accounts use @demo.nauta.test with a "dd-" prefix, so
``seed_demo_data --reset`` removes them too. No boat listings are created here — this
command is only about the directory pages having enough brokers/professionals to
filter across sector, country and language. Development / staging only.

    python manage.py seed_directory_data
    python manage.py seed_directory_data --password '...'
"""

import os
import random
import secrets

from django.core.management.base import CommandError
from django.db import transaction
from django.utils import timezone

from accounts.enums import UserRole
from accounts.models import User
from brokers.enums import BrokerMembershipRole, BrokerOrganizationStatus
from brokers.models import BrokerMembership, BrokerOrganization
from listings.management.commands import seed_demo_data as base
from listings.management.commands.seed_marketplace_data import BROKER_WORDS, FIRST, LAST, PRO_SUFFIX, WORLD
from professionals.enums import ProfessionalProfileStatus
from professionals.models import ProfessionalProfile
from services_catalog.models import ProfessionalService, ServiceCategory

# Existing demo photography (frontend's public/design/), reused here only for the
# broker logo/cover URLField — plain relative paths resolve against the site's own
# origin, exactly like the home page ad seeding (content/seed_demo_content.py).
# Professional profiles use a real uploaded logo/cover (org_images storage keys, not
# a plain URL field), which this command does not attempt — their cards fall back
# to the same placeholder art the existing professional seed data already uses.
DESIGN_ASSETS = [
    "/design/018863299d.jpg", "/design/03e66b80f4.jpg", "/design/041d025292.jpg", "/design/0f668a7caf.jpg",
    "/design/18ba38ef13.jpg", "/design/1b4bad5160.jpg", "/design/1fe92292a7.jpg", "/design/22fe9bf3e3.jpg",
    "/design/24fcaabe59.jpg", "/design/2529dd6d49.jpg", "/design/2690a5e9b1.jpg", "/design/26b5f516db.jpg",
    "/design/26c71ce9e6.jpg", "/design/2caf76f397.jpg", "/design/2ea59788a7.jpg", "/design/2ef1cc7663.jpg",
    "/design/3629b97ed0.jpg", "/design/386d95d2ba.jpg", "/design/3c22acc6af.jpg", "/design/4380ad7d78.jpg",
    "/design/6105378ad2.jpg", "/design/68be5c8e30.jpg", "/design/83d5b58468.jpg", "/design/ce28c27afe.jpg",
]

# The site only ships EN/IT/ES site text, so language diversity means leaning each
# account's locale toward its own country when that country is Spain or Italy, and
# spreading the rest (the many other Mediterranean countries in WORLD) across all
# three - never one language dominating the sample.
LOCALE_BY_COUNTRY = {"ES": "ES", "IT": "IT"}


class Command(base.Command):
    help = "Add 100 broker organizations and 100 professional profiles across many sectors, locations and languages (dev/staging only)."

    def add_arguments(self, parser):
        parser.add_argument("--password", default=None, help="Password for every new account (random by default).")
        parser.add_argument("--allow-production", action="store_true", help="Allow running when DEPLOY_ENVIRONMENT=prod (do not).")

    def handle(self, *args, **opts):
        if os.environ.get("DEPLOY_ENVIRONMENT") == "prod" and not opts["allow_production"]:
            raise CommandError("Refusing to seed demo data in the prod environment.")
        if User.objects.filter(email=f"dd-broker1@{base.DEMO_DOMAIN}").exists():
            raise CommandError("Directory data already exists. Run 'seed_demo_data --reset-only' to remove all demo data first.")
        self.rng = random.Random(20260922)
        self.password = opts["password"] or secrets.token_urlsafe(12) + "aA1!"
        self.now = timezone.now()
        self.accounts = []
        self.brokers = []
        self.professionals = []
        with transaction.atomic():
            self.seed_brokers()
            self.seed_professionals()
        self.report()

    def person(self):
        return f"{self.rng.choice(FIRST)} {self.rng.choice(LAST)}"

    def locale_for(self, country):
        return LOCALE_BY_COUNTRY.get(country, self.rng.choice(["EN", "IT", "ES"]))

    def slug_for(self, prefix, index, name):
        return f"{prefix}-{index}-" + "".join(c if c.isalnum() else "-" for c in name.lower()).strip("-")[:60]

    def seed_brokers(self):
        for i in range(1, 101):
            country, region, city = WORLD[(i - 1) % len(WORLD)]
            name = f"{city} {self.rng.choice(BROKER_WORDS)}"
            org = BrokerOrganization(
                name=name,
                slug=self.slug_for("dd", i, name),
                status=BrokerOrganizationStatus.ACTIVE,
                public_email=f"office-dd{i}@{base.DEMO_DOMAIN}",
                public_phone=f"+34 600 40{i:02d} 50{i:02d}",
                website_url=f"https://dd-broker{i}.example.com",
                tagline=f"Yacht brokerage in {city}",
                city=city,
                country_code=country,
                specialties=self.rng.sample(["sail", "motor", "catamaran", "rib", "luxury"], 2),
                logo_url=DESIGN_ASSETS[i % len(DESIGN_ASSETS)],
                cover_image_url=DESIGN_ASSETS[(i + 1) % len(DESIGN_ASSETS)],
            )
            org.save()
            admin = self.make_user(f"dd-broker{i}", UserRole.BROKER, self.person())
            admin.locale = self.locale_for(country)
            admin.save(update_fields=["locale"])
            BrokerMembership.objects.create(
                user=admin, broker=org, role=BrokerMembershipRole.ADMIN, is_owner=True,
                can_edit_listings=True, can_manage_team=True, can_read_messages=True, is_active=True,
            )
            self.brokers.append(org)

    def seed_professionals(self):
        categories = {c.slug: c for c in ServiceCategory.objects.all()}
        slugs = list(base.SERVICE_TITLES)
        for slug in slugs:
            if slug not in categories:
                categories[slug] = ServiceCategory.objects.create(slug=slug, name_en=slug.replace("-", " ").title(), is_active=True)
        for i in range(1, 101):
            # Randomised rather than seed_brokers' round-robin, so the two datasets
            # don't line up on the same WORLD row for the same i (still
            # deterministic - self.rng is seeded).
            country, region, city = self.rng.choice(WORLD)
            cat = slugs[i % len(slugs)]
            name = f"{city} {PRO_SUFFIX[cat]}"
            owner = self.make_user(f"dd-pro{i}", UserRole.PROFESSIONAL, self.person())
            owner.locale = self.locale_for(country)
            owner.save(update_fields=["locale"])
            blurb = f"{PRO_SUFFIX[cat]} services in {city} and nearby ports."
            profile = ProfessionalProfile(
                owner_user=owner,
                display_name=name,
                slug=self.slug_for("dd", i, name),
                short_description=blurb,
                description=blurb + " Experienced team serving private owners and brokers.",
                public_email=f"contact-dd{i}@{base.DEMO_DOMAIN}",
                public_phone=f"+39 340 90{i:02d} 10{i:02d}",
                website_url=f"https://dd-pro{i}.example.com",
                city=city,
                region=region,
                country_code=country,
                service_area=[region, country],
                status=ProfessionalProfileStatus.ACTIVE,
            )
            profile.save()
            for title in base.SERVICE_TITLES[cat]:
                ProfessionalService.objects.create(
                    professional=profile, category=categories[cat], title_en=title,
                    description_en=f"{title} by {name}.", service_area=[region], is_active=True,
                )
            self.professionals.append(profile)

    def report(self):
        countries = {country for country, _, _ in WORLD}
        locales = User.objects.filter(email__startswith="dd-").values_list("locale", flat=True)
        self.stdout.write(self.style.SUCCESS("Directory data ready."))
        self.stdout.write(f"  brokers: {len(self.brokers)}  professionals: {len(self.professionals)}")
        self.stdout.write(f"  sectors: {len(base.SERVICE_TITLES)}  countries: {len(countries)}  languages: {sorted(set(locales))}")
        self.stdout.write(f"  password for new accounts: {self.password}")
