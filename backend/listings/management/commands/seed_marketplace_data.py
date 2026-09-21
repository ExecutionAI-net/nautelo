"""Add a multi-country marketplace dataset on top of (or instead of) seed_demo_data.

Creates 50 broker organizations (one published listing each), 50 private sellers
(one listing each) and 50 professional profiles, spread over many countries, cities
and boat brands. Accounts use @demo.nauta.test with an ``mk-`` prefix, so
``seed_demo_data --reset`` removes them too. Development / staging only.

    python manage.py seed_marketplace_data
    python manage.py seed_marketplace_data --password '...'
"""

import os
import random
import secrets

from django.core.management.base import CommandError
from django.db import transaction
from django.utils import timezone

from accounts.enums import StaffGroup, UserRole
from accounts.models import User
from brokers.enums import BrokerMembershipRole, BrokerOrganizationStatus
from brokers.models import BrokerMembership, BrokerOrganization
from listings.enums import ListingStatus
from listings.management.commands import seed_demo_data as base
from professionals.enums import ProfessionalProfileStatus
from professionals.models import ProfessionalProfile
from services_catalog.models import ProfessionalService, ServiceCategory

# brand, model, kind, length_m, engine_hp (each), engines, new price EUR
EXTRA_MODELS = [
    ("Bavaria", "Cruiser 37", "sail", 11.3, 30, 1, 170_000),
    ("Elan", "Impression 40.1", "sail", 12.0, 40, 1, 210_000),
    ("Grand Soleil", "44", "sail", 13.4, 55, 1, 400_000),
    ("Nautor Swan", "48", "sail", 14.6, 75, 1, 900_000),
    ("Salona", "41", "sail", 12.6, 40, 1, 230_000),
    ("Oceanis", "Yacht 54", "sail", 16.0, 110, 1, 850_000),
    ("Galeon", "430 Skydeck", "motor", 13.2, 380, 2, 480_000),
    ("Sealine", "C430", "motor", 13.3, 440, 2, 520_000),
    ("Monte Carlo Yachts", "MCY 66", "motor", 20.3, 1200, 2, 2_600_000),
    ("Sanlorenzo", "SL78", "motor", 24.0, 1500, 2, 4_200_000),
    ("Jeanneau", "NC 33", "motor", 10.0, 300, 2, 200_000),
    ("Sea Ray", "Sundancer 350", "motor", 11.0, 380, 2, 330_000),
    ("Boston Whaler", "350 Outrage", "motor", 10.7, 350, 2, 520_000),
    ("Sunseeker", "Predator 60", "motor", 18.6, 1200, 2, 1_900_000),
    ("Lagoon", "51", "catamaran", 15.4, 75, 2, 1_100_000),
    ("Bali", "4.2", "catamaran", 12.6, 45, 2, 560_000),
    ("Excess", "12", "catamaran", 11.9, 40, 2, 470_000),
    ("Ranieri", "Cayman 26", "rib", 8.0, 250, 1, 60_000),
    ("Capelli", "Tempest 900", "rib", 9.0, 300, 2, 130_000),
    ("Bwa", "38", "rib", 11.5, 300, 2, 200_000),
]

# country, region, city (brokers, professionals and listings all draw from this)
WORLD = [
    ("ES", "Balearic Islands", "Palma de Mallorca"), ("ES", "Catalonia", "Barcelona"),
    ("ES", "Valencia", "Valencia"), ("ES", "Andalusia", "Marbella"), ("ES", "Canary Islands", "Las Palmas"),
    ("IT", "Liguria", "Genoa"), ("IT", "Sardinia", "Olbia"), ("IT", "Tuscany", "Viareggio"),
    ("IT", "Sicily", "Palermo"), ("IT", "Veneto", "Venice"), ("IT", "Campania", "Naples"),
    ("FR", "Provence-Alpes-Cote d'Azur", "Cannes"), ("FR", "Provence-Alpes-Cote d'Azur", "Antibes"),
    ("FR", "Occitanie", "La Grande-Motte"), ("FR", "Corsica", "Ajaccio"), ("FR", "Brittany", "La Trinite-sur-Mer"),
    ("HR", "Split-Dalmatia", "Split"), ("HR", "Dubrovnik-Neretva", "Dubrovnik"), ("HR", "Istria", "Pula"),
    ("GR", "Attica", "Athens"), ("GR", "Ionian Islands", "Corfu"), ("GR", "Dodecanese", "Rhodes"),
    ("PT", "Lisbon", "Cascais"), ("PT", "Algarve", "Vilamoura"), ("PT", "Madeira", "Funchal"),
    ("MT", "Malta", "Valletta"), ("CY", "Limassol", "Limassol"), ("TR", "Mugla", "Bodrum"),
    ("TR", "Mugla", "Marmaris"), ("ME", "Kotor", "Tivat"), ("NL", "Friesland", "Lemmer"),
    ("DE", "Schleswig-Holstein", "Kiel"), ("GB", "Hampshire", "Southampton"), ("US", "Florida", "Fort Lauderdale"),
    ("AE", "Dubai", "Dubai"),
]

STATUS_CYCLE = [
    ListingStatus.PENDING_APPROVAL, ListingStatus.DRAFT, ListingStatus.REJECTED,
    ListingStatus.EXPIRED, ListingStatus.SUSPENDED,
]
BROKER_WORDS = ["Yachting", "Marine Sales", "Boats & Yachts", "Nautica", "Yacht Brokers", "Brokerage", "Charter & Sales"]
PRO_SUFFIX = {
    "legal": "Maritime Law", "insurance": "Yacht Insurance", "engines-maintenance": "Marine Engines",
    "transport-delivery": "Boat Delivery", "nautical-marketing": "Yacht Media", "full-brokerage": "Yacht Consultants",
}
FIRST = ["Andrea", "Maria", "Luca", "Ana", "Paolo", "Isabel", "Davide", "Rosa", "Pierre", "Claire", "Ivan", "Nikos", "Joao", "Emma", "Hans", "James", "Selin", "Marko", "Elena", "Carlos"]
LAST = ["Ferri", "Lopez", "Moretti", "Torres", "Greco", "Navarro", "Serra", "Vidal", "Dubois", "Petit", "Horvat", "Papas", "Silva", "Brown", "Meyer", "Clark", "Yilmaz", "Kovac", "Rossi", "Ortega"]


class Command(base.Command):
    help = "Add 50 brokers, 50 private sellers, 50 professionals and 100 listings across many countries (dev/staging only)."
    models = base.MODELS + EXTRA_MODELS
    locations = WORLD

    def add_arguments(self, parser):
        parser.add_argument("--password", default=None, help="Password for every new account (random by default).")
        parser.add_argument("--allow-production", action="store_true", help="Allow running when DEPLOY_ENVIRONMENT=prod (do not).")

    def handle(self, *args, **opts):
        if os.environ.get("DEPLOY_ENVIRONMENT") == "prod" and not opts["allow_production"]:
            raise CommandError("Refusing to seed demo data in the prod environment.")
        if User.objects.filter(email=f"mk-broker1@{base.DEMO_DOMAIN}").exists():
            raise CommandError("Marketplace data already exists. Run 'seed_demo_data --reset-only' to remove all demo data first.")
        self.rng = random.Random(20260921)
        self.password = opts["password"] or secrets.token_urlsafe(12) + "aA1!"
        self.now = timezone.now()
        self.accounts = []
        self.brokers = []
        self.listings = []
        self.professionals = []
        with transaction.atomic():
            self.admin = self.staff("admin", "Demo Staff Admin", StaffGroup.ADMIN)
            self.moderator = self.staff("moderator", "Demo Moderator", StaffGroup.MODERATOR)
            self.seed_brokers()
            self.seed_private_sellers()
            self.seed_pros()
        self.report()

    def staff(self, local, name, group):
        existing = User.objects.filter(email=f"{local}@{base.DEMO_DOMAIN}").first()
        return existing or self.make_user(local, UserRole.STAFF, name, [group])

    def person(self):
        return f"{self.rng.choice(FIRST)} {self.rng.choice(LAST)}"

    def status_for(self, index):
        return STATUS_CYCLE[(index // 10) % len(STATUS_CYCLE)] if index % 10 == 9 else ListingStatus.PUBLISHED

    def seed_brokers(self):
        rows = self.taxonomy()
        for i in range(1, 51):
            country, region, city = WORLD[(i - 1) % len(WORLD)]
            name = f"{city} {self.rng.choice(BROKER_WORDS)}"
            org = BrokerOrganization(
                name=name, slug=f"mk-{i}-" + "".join(c if c.isalnum() else "-" for c in name.lower()).strip("-")[:60],
                status=BrokerOrganizationStatus.ACTIVE, public_email=f"office-mk{i}@{base.DEMO_DOMAIN}",
                public_phone=f"+34 600 20{i:02d} 30{i:02d}", website_url=f"https://mk-broker{i}.example.com",
                tagline=f"Yacht brokerage in {city}", city=city, country_code=country,
                specialties=self.rng.sample(["sail", "motor", "catamaran", "rib", "luxury"], 2),
            )
            org.save()
            admin = self.make_user(f"mk-broker{i}", UserRole.BROKER, self.person())
            BrokerMembership.objects.create(
                user=admin, broker=org, role=BrokerMembershipRole.ADMIN, is_owner=True,
                can_edit_listings=True, can_manage_team=True, can_read_messages=True, is_active=True,
            )
            self.brokers.append((org, admin, admin))
            self.listings.append(
                self.build_listing(status=self.status_for(i), broker=org, actor=admin, taxonomy_row=rows[(i * 3) % len(rows)])
            )

    def seed_private_sellers(self):
        rows = self.taxonomy()
        for i in range(1, 51):
            seller = self.make_user(f"mk-seller{i}", UserRole.PRIVATE_SELLER, self.person())
            self.listings.append(
                self.build_listing(status=self.status_for(i + 5), owner=seller, actor=seller, taxonomy_row=rows[(i * 7 + 1) % len(rows)])
            )

    def seed_pros(self):
        categories = {c.slug: c for c in ServiceCategory.objects.all()}
        slugs = list(base.SERVICE_TITLES)
        for slug in slugs:
            if slug not in categories:
                categories[slug] = ServiceCategory.objects.create(slug=slug, name_en=slug.replace("-", " ").title(), is_active=True)
        for i in range(1, 51):
            country, region, city = WORLD[(i * 5) % len(WORLD)]
            cat = slugs[i % len(slugs)]
            name = f"{city} {PRO_SUFFIX[cat]}"
            owner = self.make_user(f"mk-pro{i}", UserRole.PROFESSIONAL, self.person())
            blurb = f"{PRO_SUFFIX[cat]} services in {city} and nearby ports."
            profile = ProfessionalProfile(
                owner_user=owner, display_name=name, slug=f"mk-{i}-" + "".join(c if c.isalnum() else "-" for c in name.lower()).strip("-")[:60],
                short_description=blurb, description=blurb + " Experienced team serving private owners and brokers.",
                public_email=f"contact-mk{i}@{base.DEMO_DOMAIN}", public_phone=f"+39 340 66{i:02d} 77{i:02d}",
                website_url=f"https://mk-pro{i}.example.com", city=city, region=region, country_code=country,
                service_area=[region, country], status=ProfessionalProfileStatus.ACTIVE,
            )
            profile.save()
            for title in base.SERVICE_TITLES[cat]:
                ProfessionalService.objects.create(
                    professional=profile, category=categories[cat], title_en=title,
                    description_en=f"{title} by {name}.", service_area=[region], is_active=True,
                )
            self.professionals.append(profile)

    def report(self):
        counts = {}
        for listing in self.listings:
            counts[listing.status] = counts.get(listing.status, 0) + 1
        self.stdout.write(self.style.SUCCESS("Marketplace data ready."))
        self.stdout.write(f"  brokers: {len(self.brokers)}  private sellers: 50  professionals: {len(self.professionals)}")
        self.stdout.write(f"  listings: {len(self.listings)} {counts}")
        self.stdout.write(f"  countries: {len({c for c, _, _ in WORLD})}  password for new accounts: {self.password}")
