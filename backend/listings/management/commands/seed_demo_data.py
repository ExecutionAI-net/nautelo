"""Fill a DEVELOPMENT or STAGING database with a large, filterable demo dataset.

Everything created here is marked as demo data (accounts use the @demo.nauta.test
domain) so it can be removed again with ``--reset``. Never run this on production.

    python manage.py seed_demo_data                # add the dataset (refuses if demo data exists)
    python manage.py seed_demo_data --reset        # delete previous demo data, then add
    python manage.py seed_demo_data --reset-only   # delete demo data and stop
    python manage.py seed_demo_data --password '...' --enable-flags

The dataset is written directly to the models (not through the HTTP workflow) but
follows the same shapes the workflow produces: revisions, immutable snapshots,
media manifests, entitlement ledger rows, conversations and messages.
"""

import hashlib
import os
import random
import secrets
import uuid
from datetime import timedelta
from decimal import Decimal
from pathlib import Path

from django.contrib.auth.models import Group
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from PIL import Image

from accounts.enums import SellerType, StaffGroup, UserRole
from accounts.models import User
from brokers.enums import BrokerMembershipRole, BrokerOrganizationStatus
from brokers.models import BrokerMembership, BrokerOrganization
from entitlements.enums import EntitlementSource, EntitlementState, EntitlementType
from entitlements.models import UserEntitlement
from listings.enums import ListingStatus, MediaStatus, MediaType, PublicationSource, RevisionOrigin, RevisionStatus
from listings.models import BoatListing, ListingMedia, ListingRevision, ListingSnapshot
from listings.slugs import listing_slug_base
from messaging.enums import ConversationStatus, ConversationType
from messaging.models import Conversation, Message
from platform_settings.models import FeatureFlag
from professionals.enums import ProfessionalProfileStatus
from professionals.models import ProfessionalProfile
from services_catalog.models import ProfessionalService, ServiceCategory
from taxonomy.models import BoatBrand, BoatModel

DEMO_DOMAIN = "demo.nauta.test"
ASSETS = Path(__file__).resolve().parents[2] / "demo_assets"
PRIVACY_VERSION = "2026-09"

# brand, model, kind, length_m, engine_hp (each), engines, new price EUR
MODELS = [
    ("Beneteau", "Oceanis 46.1", "sail", 14.0, 60, 1, 320_000),
    ("Beneteau", "First 36", "sail", 10.9, 29, 1, 130_000),
    ("Beneteau", "Antares 9", "motor", 8.9, 200, 1, 90_000),
    ("Beneteau", "Gran Turismo 41", "motor", 12.5, 380, 2, 480_000),
    ("Jeanneau", "Sun Odyssey 410", "sail", 12.4, 57, 1, 260_000),
    ("Jeanneau", "Merry Fisher 895", "motor", 8.9, 200, 1, 110_000),
    ("Jeanneau", "Leader 33", "motor", 10.5, 300, 2, 280_000),
    ("Bavaria", "Cruiser 46", "sail", 14.3, 75, 1, 300_000),
    ("Bavaria", "C42", "sail", 12.5, 60, 1, 240_000),
    ("Bavaria", "S36", "motor", 11.0, 320, 2, 300_000),
    ("Dufour", "390 Grand Large", "sail", 11.9, 40, 1, 190_000),
    ("Dufour", "470", "sail", 14.5, 75, 1, 340_000),
    ("Hanse", "418", "sail", 12.5, 50, 1, 230_000),
    ("Hanse", "508", "sail", 15.4, 100, 1, 500_000),
    ("Lagoon", "42", "catamaran", 12.8, 45, 2, 620_000),
    ("Lagoon", "46", "catamaran", 13.9, 57, 2, 850_000),
    ("Fountaine Pajot", "Astrea 42", "catamaran", 12.5, 45, 2, 590_000),
    ("Fountaine Pajot", "Isla 40", "catamaran", 11.9, 30, 2, 480_000),
    ("Sunseeker", "Manhattan 55", "motor", 17.0, 800, 2, 1_300_000),
    ("Sunseeker", "Predator 50", "motor", 15.4, 900, 2, 1_100_000),
    ("Sunseeker", "Portofino 40", "motor", 12.7, 480, 2, 700_000),
    ("Azimut", "55", "motor", 17.1, 900, 2, 1_200_000),
    ("Azimut", "S6", "motor", 18.7, 1200, 2, 1_900_000),
    ("Azimut", "Atlantis 45", "motor", 14.0, 480, 2, 650_000),
    ("Ferretti", "500", "motor", 15.9, 800, 2, 1_100_000),
    ("Ferretti", "670", "motor", 20.6, 1200, 2, 2_500_000),
    ("Princess", "V50", "motor", 15.6, 800, 2, 1_050_000),
    ("Princess", "F45", "motor", 14.1, 600, 2, 800_000),
    ("Fairline", "Targa 43", "motor", 13.5, 480, 2, 550_000),
    ("Fairline", "Squadron 50", "motor", 16.0, 725, 2, 1_000_000),
    ("Cranchi", "E26 Classic", "motor", 8.0, 200, 1, 100_000),
    ("Cranchi", "M44 HT", "motor", 13.6, 480, 2, 650_000),
    ("Sessa", "C42", "motor", 13.0, 420, 2, 520_000),
    ("Prestige", "420", "motor", 12.9, 370, 2, 470_000),
    ("Prestige", "460", "motor", 14.5, 480, 2, 720_000),
    ("Absolute", "50 Fly", "motor", 15.3, 700, 2, 880_000),
    ("Zodiac", "Medline 6.5", "rib", 6.5, 150, 1, 40_000),
    ("Nuova Jolly", "Prince 38", "rib", 11.4, 300, 2, 190_000),
    ("Riva", "Rivamare", "motor", 12.0, 400, 2, 900_000),
    ("Pershing", "6X", "motor", 20.0, 1500, 2, 3_200_000),
    ("Sunreef", "60", "catamaran", 18.3, 150, 2, 2_900_000),
]

LOCATIONS = [
    ("ES", "Balearic Islands", "Palma de Mallorca"),
    ("ES", "Balearic Islands", "Ibiza"),
    ("ES", "Balearic Islands", "Port d'Andratx"),
    ("ES", "Catalonia", "Barcelona"),
    ("ES", "Catalonia", "Roses"),
    ("ES", "Valencia", "Valencia"),
    ("ES", "Andalusia", "Marbella"),
    ("ES", "Costa Blanca", "Alicante"),
    ("IT", "Liguria", "Genoa"),
    ("IT", "Liguria", "La Spezia"),
    ("IT", "Sardinia", "Olbia"),
    ("IT", "Tuscany", "Viareggio"),
    ("IT", "Campania", "Naples"),
    ("IT", "Sicily", "Palermo"),
    ("IT", "Lazio", "Fiumicino"),
    ("IT", "Friuli-Venezia Giulia", "Trieste"),
]

BROKERS = [
    ("Mediterranean Yacht Brokers", "ACTIVE", True),
    ("Balearic Marine Sales", "ACTIVE", False),
    ("Costa Brava Yachting", "ACTIVE", False),
    ("Ligurian Yacht Partners", "ACTIVE", True),
    ("Sardinia Blue Brokerage", "ACTIVE", False),
    ("Tyrrhenian Boats & Yachts", "ACTIVE", False),
    ("Valencia Nautica", "ACTIVE", False),
    ("Adriatic Yacht Group", "ACTIVE", False),
    ("Pending Harbour Brokers", "PENDING", False),
    ("Suspended Wharf Yachts", "SUSPENDED", False),
]

PROVIDERS = [
    ("Palma Legal Maritime", "legal", "Palma de Mallorca", "ES", "Balearic Islands", ["Balearic Islands", "Catalonia"], "Yacht registration, flag transfers and sale contracts."),
    ("Genoa Marine Law Studio", "legal", "Genoa", "IT", "Liguria", ["Liguria", "Tuscany"], "Italian registry, VAT status and charter compliance."),
    ("BlueShield Yacht Insurance", "insurance", "Barcelona", "ES", "Catalonia", ["Spain", "Italy"], "Hull, liability and charter insurance for private and commercial yachts."),
    ("Tirreno Assicurazioni Nautiche", "insurance", "Viareggio", "IT", "Tuscany", ["Tuscany", "Liguria", "Sardinia"], "Comprehensive cover and claims handling for motor yachts."),
    ("Mallorca Marine Engines", "engines-maintenance", "Palma de Mallorca", "ES", "Balearic Islands", ["Balearic Islands"], "Volvo Penta and MAN service, repowering and survey."),
    ("Ibiza Yacht Care", "engines-maintenance", "Ibiza", "ES", "Balearic Islands", ["Balearic Islands"], "Winterisation, detailing, antifouling and mechanical repairs."),
    ("Olbia Cantiere Servizi", "engines-maintenance", "Olbia", "IT", "Sardinia", ["Sardinia", "Corsica"], "Shipyard services, refits and engine overhaul."),
    ("Levante Yacht Transport", "transport-delivery", "Valencia", "ES", "Valencia", ["Spain", "Italy", "France"], "Road transport and sea delivery for yachts up to 24 m."),
    ("Adria Boat Delivery", "transport-delivery", "Trieste", "IT", "Friuli-Venezia Giulia", ["Adriatic", "Ionian"], "Professional skippers for delivery voyages."),
    ("Sail & Shine Marketing", "nautical-marketing", "Barcelona", "ES", "Catalonia", ["Spain"], "Listing photography, drone video and campaign management."),
    ("Riviera Yacht Media", "nautical-marketing", "Genoa", "IT", "Liguria", ["Italy"], "Brochures, virtual tours and social campaigns for brokers."),
    ("Full Service Charter & Sales", "full-brokerage", "Marbella", "ES", "Andalusia", ["Andalusia", "Costa Blanca"], "End-to-end sales brokerage and vessel management."),
    ("Isola Yacht Consultants", "full-brokerage", "Naples", "IT", "Campania", ["Campania", "Sicily"], "Buyer representation, valuation and negotiation."),
    ("Pending Marine Services", "engines-maintenance", "Alicante", "ES", "Costa Blanca", ["Costa Blanca"], "Awaiting review."),
]

SERVICE_TITLES = {
    "legal": ["Vessel registration", "Sale contract review", "Flag transfer"],
    "insurance": ["Hull and machinery cover", "Third-party liability", "Charter insurance"],
    "engines-maintenance": ["Engine service", "Winterisation", "Hull and antifouling"],
    "transport-delivery": ["Road transport", "Sea delivery", "Launch and haul-out"],
    "nautical-marketing": ["Listing photography", "Drone video", "Campaign management"],
    "full-brokerage": ["Sales brokerage", "Buyer representation", "Valuation"],
}

TAGLINES = [
    "well maintained, ready to cruise",
    "one owner, full service history",
    "recently refitted",
    "low engine hours",
    "immaculate condition",
    "fully equipped",
    "ideal family cruiser",
    "ready for the season",
]

BUYER_TEXT = [
    "Hello, is this boat still available? I would like to arrange a viewing next week.",
    "Could you share the service history and the latest survey report, please?",
    "We are interested in this vessel. Is the price negotiable, and where is it berthed?",
    "Can you confirm the engine hours and whether VAT has been paid on the boat?",
    "I am comparing a few boats in this range. Could we schedule a sea trial this month?",
]
SELLER_TEXT = [
    "Thank you for your interest. The boat is available and we can arrange a viewing any day this week.",
    "Yes, the full service history is available and the last survey was completed recently. I will send it over.",
    "The price is fixed but we are open to a reasonable offer after the viewing. The boat is berthed in the marina listed.",
    "VAT is paid and documents are in order. Engine hours are as shown in the specifications.",
]
PRO_TEXT = [
    "We would like a quote for the service you describe. The boat is in the Balearic Islands.",
    "Could you tell us your availability next month and a rough price range?",
]
PRO_REPLY = [
    "Thank you for getting in touch. We can help; please send the boat details and we will prepare a quote within two working days.",
]


class Command(BaseCommand):
    help = "Create a large demo dataset for filtering and UI review (dev/staging only)."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Delete previous demo data first.")
        parser.add_argument("--reset-only", action="store_true", help="Delete demo data and stop.")
        parser.add_argument("--password", default=None, help="Password for every demo account (random by default).")
        parser.add_argument("--enable-flags", action="store_true", help="Turn on every feature flag.")
        parser.add_argument("--allow-production", action="store_true", help="Allow running when DEPLOY_ENVIRONMENT=prod (do not).")

    def handle(self, *args, **opts):
        if os.environ.get("DEPLOY_ENVIRONMENT") == "prod" and not opts["allow_production"]:
            raise CommandError("Refusing to seed demo data in the prod environment.")
        if opts["reset"] or opts["reset_only"]:
            self.reset()
            if opts["reset_only"]:
                return
        if User.objects.filter(email__endswith="@" + DEMO_DOMAIN).exists():
            raise CommandError("Demo data already exists. Run again with --reset to rebuild it.")
        self.rng = random.Random(20260919)
        self.password = opts["password"] or secrets.token_urlsafe(12) + "aA1!"
        self.now = timezone.now()
        self.accounts = []
        with transaction.atomic():
            self.seed_users_and_orgs()
            self.seed_listings()
            self.seed_professionals()
            self.seed_conversations()
        call_command("seed_demo_content")
        if opts["enable_flags"]:
            self.enable_flags()
        self.report()

    # ---------------------------------------------------------------- reset
    def reset(self):
        demo_users = User.objects.filter(email__endswith="@" + DEMO_DOMAIN)
        with transaction.atomic():
            Conversation.objects.filter(initiator__in=demo_users).delete()
            Conversation.objects.filter(listing__owner_user__in=demo_users).delete()
            listings = BoatListing.objects.filter(created_by__in=demo_users)
            keys = list(ListingMedia.objects.filter(listing__in=listings).values_list("storage_key", flat=True))
            listings.update(current_public_snapshot=None, consumed_entitlement=None)
            ListingRevision.objects.filter(listing__in=listings).update(base_snapshot=None)
            UserEntitlement.objects.filter(user__in=demo_users).delete()
            ListingSnapshot.objects.filter(listing__in=listings).delete()
            ListingRevision.objects.filter(listing__in=listings).delete()
            listings.delete()
            ProfessionalProfile.objects.filter(owner_user__in=demo_users).delete()
            BrokerOrganization.objects.filter(memberships__user__in=demo_users).delete()
            demo_users.delete()
        for key in keys:
            try:
                default_storage.delete(key)
            except Exception:  # noqa: BLE001 - storage cleanup is best effort
                pass
        self.stdout.write("Previous demo data removed.")

    # ---------------------------------------------------------------- users
    def make_user(self, local, role, name, groups=()):
        email = f"{local}@{DEMO_DOMAIN}"
        user = User.objects.filter(email=email).first()
        if user is None:
            user = User(email=email)
        user.primary_role = role
        user.full_name = name
        user.locale = self.rng.choice(["EN", "IT", "ES"])
        user.is_active = True
        user.email_verified_at = self.now
        user.set_password(self.password)
        user.save()
        for group in groups:
            user.groups.add(Group.objects.get_or_create(name=group)[0])
        self.accounts.append((role, email, name))
        return user

    def seed_users_and_orgs(self):
        self.admin = self.make_user("admin", UserRole.STAFF, "Demo Staff Admin", [StaffGroup.ADMIN])
        self.moderator = self.make_user("moderator", UserRole.STAFF, "Demo Moderator", [StaffGroup.MODERATOR])
        self.buyers = [
            self.make_user(f"buyer{i}", UserRole.PRIVATE_SELLER, name)
            for i, name in enumerate(
                ["Laura Bianchi", "Carlos Ortega", "Sophie Martin", "Marco Rossi", "Elena Garcia", "Thomas Weber", "Giulia Conti", "Pablo Ruiz"], 1
            )
        ]
        self.sellers = [
            self.make_user(f"seller{i}", UserRole.PRIVATE_SELLER, name)
            for i, name in enumerate(
                ["Andrea Ferri", "Maria Lopez", "Luca Moretti", "Ana Torres", "Paolo Greco", "Isabel Navarro", "Davide Serra", "Rosa Vidal"], 1
            )
        ]
        self.brokers = []
        for i, (name, status, auto) in enumerate(BROKERS, 1):
            org = BrokerOrganization.objects.filter(name=name).first() or BrokerOrganization(name=name)
            org.slug = f"demo-{i}-" + "".join(c if c.isalnum() else "-" for c in name.lower()).strip("-")[:60]
            org.status = getattr(BrokerOrganizationStatus, status)
            org.public_email = f"office{i}@{DEMO_DOMAIN}"
            org.public_phone = f"+34 600 10{i:02d} 20{i:02d}"
            org.website_url = f"https://broker{i}.example.com"
            org.auto_approve_listings = auto
            org.save()
            admin = self.make_user(f"broker{i}-admin", UserRole.BROKER, f"{name.split()[0]} Admin")
            agent = self.make_user(f"broker{i}-agent", UserRole.BROKER, f"{name.split()[0]} Agent")
            BrokerMembership.objects.update_or_create(
                user=admin, broker=org,
                defaults=dict(role=BrokerMembershipRole.ADMIN, can_edit_listings=True, can_manage_team=True, can_read_messages=True, is_active=True),
            )
            BrokerMembership.objects.update_or_create(
                user=agent, broker=org,
                defaults=dict(role=BrokerMembershipRole.AGENT, can_edit_listings=True, can_manage_team=False, can_read_messages=True, is_active=True),
            )
            self.brokers.append((org, admin, agent))

    # ------------------------------------------------------------- listings
    def taxonomy(self):
        rows = []
        for brand_name, model_name, kind, length, hp, engines, price in MODELS:
            brand, _ = BoatBrand.objects.get_or_create(name=brand_name)
            model, _ = BoatModel.objects.get_or_create(brand=brand, name=model_name)
            rows.append((brand, model, kind, length, hp, engines, price))
        return rows

    def specs(self, kind, length, hp, engines, year):
        beam = round(length * self.rng.uniform(0.29, 0.34), 2)
        age = self.now.year - year
        spec = {
            "boat_type": {"sail": "Sailing yacht", "motor": "Motor yacht", "catamaran": "Catamaran", "rib": "RIB"}[kind],
            "length_m": length,
            "loa_m": str(length),
            "beam_m": beam,
            "draft_m": round(length * (0.13 if kind != "motor" else 0.08), 2),
            "cabins": max(1, int(length // 4.2)) if kind != "rib" else 0,
            "berths": max(2, int(length // 2.2)) if kind != "rib" else 0,
            "heads": max(1, int(length // 6)) if kind != "rib" else 0,
            "hull_material": "Fibreglass" if kind != "rib" else "Hypalon",
            "engines": engines,
            "engine_power_hp": hp,
            "fuel_type": "Diesel" if kind != "rib" else "Petrol",
            "engine_hours": int(self.rng.uniform(40, 220) * max(1, age)),
            "max_speed_kn": {"sail": 8, "catamaran": 9, "motor": self.rng.choice([22, 26, 30, 34, 38]), "rib": 42}[kind],
            "fuel_capacity_l": int(length * (60 if kind == "sail" else 95)),
            "water_capacity_l": int(length * 26),
            "condition": "Used" if age > 0 else "New",
            "vat_paid": self.rng.random() > 0.15,
        }
        return spec

    def describe(self, year, brand, model, kind, city, spec, tagline):
        en = (
            f"{year} {brand} {model}, {tagline}. This {spec['length_m']} m {spec['boat_type'].lower()} is berthed in {city}.\n\n"
            f"She offers {spec['cabins']} cabin(s), {spec['berths']} berths and {spec['heads']} head(s), with {spec['engines']} x "
            f"{spec['engine_power_hp']} hp {spec['fuel_type'].lower()} engine(s) showing {spec['engine_hours']} hours.\n\n"
            "Full equipment list and documentation are available on request. Viewings by appointment."
        )
        it = (
            f"{year} {brand} {model}, {tagline}. Questa barca di {spec['length_m']} m si trova a {city}.\n\n"
            f"{spec['cabins']} cabina/e, {spec['berths']} posti letto, motori {spec['engines']} x {spec['engine_power_hp']} hp con "
            f"{spec['engine_hours']} ore. Documentazione completa disponibile su richiesta."
        )
        es = (
            f"{year} {brand} {model}, {tagline}. Esta embarcacion de {spec['length_m']} m esta amarrada en {city}.\n\n"
            f"{spec['cabins']} camarote(s), {spec['berths']} literas, motores {spec['engines']} x {spec['engine_power_hp']} hp con "
            f"{spec['engine_hours']} horas. Documentacion completa disponible bajo peticion."
        )
        return en, it, es

    def add_media(self, listing, kind, count, actor):
        pool = {"sail": "sail", "catamaran": "sail", "motor": "motor", "rib": "motor"}[kind]
        files = sorted(ASSETS.glob(f"{pool}-*.jpg")) + sorted(ASSETS.glob("deck-*.jpg"))
        chosen = self.rng.sample(files, min(count, len(files)))
        ids = []
        for order, path in enumerate(chosen):
            data = path.read_bytes()
            with Image.open(path) as image:
                width, height = image.size
            key = f"listings/{listing.pk}/{uuid.uuid4().hex}.jpg"
            default_storage.save(key, ContentFile(data))
            media = ListingMedia.objects.create(
                listing=listing, media_type=MediaType.IMAGE, storage_key=key, status=MediaStatus.READY,
                mime_type="image/jpeg", byte_size=len(data), width=width, height=height, sort_order=order,
                checksum_sha256=hashlib.sha256(data).hexdigest(), created_by=actor,
            )
            ids.append(str(media.pk))
        return ids

    def build_listing(self, *, status, owner=None, broker=None, actor, taxonomy_row, age_days=None, decided_note=""):
        brand, model, kind, length, hp, engines, new_price = taxonomy_row
        year = self.rng.randint(1999, self.now.year)
        age = self.now.year - year
        price = Decimal(int(new_price * max(0.25, 1 - 0.045 * age) * self.rng.uniform(0.9, 1.1) / 500) * 500)
        country, region, city = self.rng.choice(LOCATIONS)
        spec = self.specs(kind, length, hp, engines, year)
        tagline = self.rng.choice(TAGLINES)
        title = f"{year} {brand.name} {model.name} - {tagline}"
        en, it, es = self.describe(year, brand.name, model.name, kind, city, spec, tagline)
        listing = BoatListing.objects.create(
            owner_user=owner, broker=broker,
            seller_type=SellerType.PRIVATE if owner else SellerType.BROKER,
            brand=brand, model=model, manufacture_year=year, currency="EUR", price=price,
            status=ListingStatus.DRAFT, created_by=actor, updated_by=actor,
            show_finance_estimate=bool(broker and self.rng.random() > 0.5),
        )
        media_ids = self.add_media(listing, kind, self.rng.randint(3, 6), actor)
        payload = {
            "title_en": title, "title_it": title, "title_es": title,
            "description_en": en, "description_it": it, "description_es": es,
            "specifications": spec, "location_country": country, "location_region": region, "location_city": city,
            "price": str(price), "currency": "EUR", "media_ids": media_ids,
        }
        published_days = age_days if age_days is not None else self.rng.randint(1, 120)
        stamp = self.now - timedelta(days=published_days)
        if status in (ListingStatus.DRAFT, ListingStatus.PENDING_APPROVAL, ListingStatus.REJECTED):
            state = {
                ListingStatus.DRAFT: RevisionStatus.DRAFT,
                ListingStatus.PENDING_APPROVAL: RevisionStatus.SUBMITTED,
                ListingStatus.REJECTED: RevisionStatus.REJECTED,
            }[status]
            extra = {}
            if state != RevisionStatus.DRAFT:
                extra = dict(submitted_by=actor, submitted_at=stamp)
            if state == RevisionStatus.REJECTED:
                extra.update(decided_by=self.moderator, decided_at=stamp + timedelta(hours=5), decision_note=decided_note or "Photos do not show the boat clearly.")
            ListingRevision.objects.create(listing=listing, revision_number=1, state=state, origin=RevisionOrigin.OWNER, payload=payload, **extra)
            listing.status = status
            listing.save(update_fields=["status", "updated_at"])
            return listing
        revision = ListingRevision.objects.create(
            listing=listing, revision_number=1, state=RevisionStatus.APPROVED, origin=RevisionOrigin.OWNER, payload=payload,
            submitted_by=actor, submitted_at=stamp, decided_by=self.admin, decided_at=stamp + timedelta(hours=3), decision_note="Approved.",
        )
        manifest = [
            {"media_id": str(m.pk), "media_type": m.media_type, "storage_key": m.storage_key, "mime_type": m.mime_type,
             "sort_order": m.sort_order, "width": m.width, "height": m.height, "duration_seconds": None, "checksum_sha256": m.checksum_sha256}
            for m in ListingMedia.objects.filter(listing=listing)
        ]
        snapshot = ListingSnapshot.objects.create(
            listing=listing, version=1, approved_revision=revision, brand_name_snapshot=brand.name, model_name_snapshot=model.name,
            manufacture_year_snapshot=year, title_en=title, title_it=title, title_es=title, description_en=en, description_it=it,
            description_es=es, specifications=spec, location_country=country, location_region=region, location_city=city,
            currency="EUR", price=price, show_finance_estimate=listing.show_finance_estimate,
            media_manifest=manifest, approved_by=self.admin, approved_at=stamp + timedelta(hours=3),
        )
        listing.current_public_snapshot = snapshot
        listing.slug = listing_slug_base(listing)
        listing.published_at = stamp + timedelta(hours=3)
        listing.expires_at = None if broker else listing.published_at + timedelta(days=180)
        listing.status = status
        listing.view_count_cached = self.rng.randint(0, 900)
        listing.publication_source = PublicationSource.BROKER_POLICY if broker else PublicationSource.FREE_ENTITLEMENT
        if status == ListingStatus.EXPIRED:
            listing.expires_at = self.now - timedelta(days=self.rng.randint(1, 20))
        listing.save()
        if owner is not None:
            entitlement = UserEntitlement.objects.create(
                user=owner, entitlement_type=EntitlementType.FREE_LISTING, source=EntitlementSource.FREE_POLICY,
                state=EntitlementState.CONSUMED, valid_from=stamp - timedelta(days=1), valid_until=stamp + timedelta(days=365),
                consumed_at=stamp, listing=listing, metadata={"demo": True},
            )
            listing.consumed_entitlement = entitlement
            listing.save(update_fields=["consumed_entitlement"])
        return listing

    def seed_listings(self):
        rows = self.taxonomy()
        self.listings = []
        plan = []
        for org, admin, agent in self.brokers[:8]:
            for _ in range(6):
                plan.append((ListingStatus.PUBLISHED, dict(broker=org, actor=self.rng.choice([admin, agent]))))
        for seller in self.sellers:
            for _ in range(3):
                plan.append((ListingStatus.PUBLISHED, dict(owner=seller, actor=seller)))
        for status, count in [(ListingStatus.PENDING_APPROVAL, 6), (ListingStatus.DRAFT, 6), (ListingStatus.REJECTED, 3), (ListingStatus.SUSPENDED, 2), (ListingStatus.EXPIRED, 2)]:
            for i in range(count):
                if i % 2 == 0:
                    seller = self.rng.choice(self.sellers)
                    plan.append((status, dict(owner=seller, actor=seller)))
                else:
                    org, admin, agent = self.rng.choice(self.brokers[:8])
                    plan.append((status, dict(broker=org, actor=admin)))
        self.rng.shuffle(plan)
        for status, kwargs in plan:
            listing = self.build_listing(status=status, taxonomy_row=self.rng.choice(rows), **kwargs)
            self.listings.append(listing)

    # -------------------------------------------------------- professionals
    def seed_professionals(self):
        categories = {c.slug: c for c in ServiceCategory.objects.all()}
        for slug in SERVICE_TITLES:
            if slug not in categories:
                categories[slug] = ServiceCategory.objects.create(slug=slug, name_en=slug.replace("-", " ").title(), is_active=True)
        self.professionals = []
        for i, (name, cat, city, country, region, area, blurb) in enumerate(PROVIDERS, 1):
            owner = self.make_user(f"provider{i}", UserRole.PROFESSIONAL, f"{name.split()[0]} Owner")
            profile = ProfessionalProfile.objects.filter(owner_user=owner).first() or ProfessionalProfile(owner_user=owner)
            profile.display_name = name
            profile.slug = f"demo-{i}-" + "".join(c if c.isalnum() else "-" for c in name.lower()).strip("-")[:60]
            profile.short_description = blurb
            profile.description = blurb + " Experienced team serving private owners and brokers across the western Mediterranean."
            profile.public_email = f"contact{i}@{DEMO_DOMAIN}"
            profile.public_phone = f"+39 340 55{i:02d} 88{i:02d}" if country == "IT" else f"+34 611 55{i:02d} 88{i:02d}"
            profile.website_url = f"https://provider{i}.example.com"
            profile.city, profile.region, profile.country_code, profile.service_area = city, region, country, area
            profile.status = ProfessionalProfileStatus.PENDING if name.startswith("Pending") else ProfessionalProfileStatus.ACTIVE
            profile.save()
            for title in SERVICE_TITLES[cat]:
                ProfessionalService.objects.get_or_create(
                    professional=profile, category=categories[cat], title_en=title,
                    defaults=dict(description_en=f"{title} by {name}.", service_area=area, is_active=True),
                )
            self.professionals.append(profile)

    # -------------------------------------------------------- conversations
    def add_message(self, conversation, sender, body, when, read):
        Message.objects.create(
            conversation=conversation, sender=sender, body=body, sender_email_snapshot=sender.email,
            sender_name_snapshot=sender.full_name, privacy_policy_version=PRIVACY_VERSION,
            read_at=when + timedelta(hours=2) if read else None,
        )
        Conversation.objects.filter(pk=conversation.pk).update(last_message_at=when, created_at=conversation.created_at)

    def thread(self, initiator, ctype, subject, first, replies, recipient, **context):
        start = self.now - timedelta(days=self.rng.randint(0, 45), hours=self.rng.randint(0, 20))
        conversation = Conversation.objects.create(
            conversation_type=ctype, initiator=initiator, subject=subject[:150], status=ConversationStatus.OPEN, **context,
        )
        when = start
        self.add_message(conversation, initiator, first, when, read=True)
        for reply in replies:
            when += timedelta(hours=self.rng.randint(1, 10))
            self.add_message(conversation, recipient, reply, when, read=self.rng.random() > 0.3)
        if replies and self.rng.random() > 0.5:
            when += timedelta(hours=self.rng.randint(1, 8))
            self.add_message(conversation, initiator, "Thank you, that is helpful. I will get back to you shortly.", when, read=False)
        return conversation

    def seed_conversations(self):
        published = [l for l in self.listings if l.status == ListingStatus.PUBLISHED]
        used = set()
        for _ in range(30):
            buyer = self.rng.choice(self.buyers)
            listing = self.rng.choice(published)
            if (buyer.pk, listing.pk) in used:
                continue
            used.add((buyer.pk, listing.pk))
            if listing.broker_id:
                org, admin, agent = next(b for b in self.brokers if b[0].pk == listing.broker_id)
                recipient = admin
            else:
                recipient = listing.owner_user
            replies = [self.rng.choice(SELLER_TEXT)] if self.rng.random() > 0.35 else []
            snapshot = listing.current_public_snapshot
            self.thread(
                buyer, ConversationType.LISTING_INQUIRY, f"Enquiry: {snapshot.title_en}", self.rng.choice(BUYER_TEXT), replies, recipient,
                listing=listing, broker=listing.broker,
            )
        for i in range(6):
            org, admin, agent = self.brokers[i]
            self.thread(
                self.buyers[i], ConversationType.BROKER_INQUIRY, f"Question for {org.name}", self.rng.choice(BUYER_TEXT), [self.rng.choice(SELLER_TEXT)], admin, broker=org,
            )
        for i in range(10):
            profile = self.professionals[i % 12]
            asker = self.rng.choice(self.buyers + self.sellers)
            if Conversation.objects.filter(initiator=asker, professional=profile).exists():
                continue
            self.thread(
                asker, ConversationType.PROFESSIONAL_INQUIRY, f"Quote request: {profile.display_name}", self.rng.choice(PRO_TEXT),
                [PRO_REPLY[0]] if self.rng.random() > 0.3 else [], profile.owner_user, professional=profile,
            )
        for buyer in self.buyers[:2]:
            self.thread(buyer, ConversationType.SUPPORT, "Question about my account", "How do I change the language of my notifications?", [], self.admin)

    # ---------------------------------------------------------------- flags
    def enable_flags(self):
        from django.core.cache import cache

        from platform_settings.services import feature_flag_cache_key

        for flag in FeatureFlag.objects.all():
            FeatureFlag.objects.filter(pk=flag.pk).update(is_enabled=True)
            cache.delete(feature_flag_cache_key(flag.key))
        self.stdout.write(f"Enabled {FeatureFlag.objects.count()} feature flags.")

    # --------------------------------------------------------------- report
    def report(self):
        self.stdout.write(self.style.SUCCESS("Demo data ready."))
        self.stdout.write(
            f"  listings: {BoatListing.objects.filter(created_by__email__endswith=DEMO_DOMAIN).count()} "
            f"(published {sum(1 for l in self.listings if l.status == ListingStatus.PUBLISHED)})"
        )
        self.stdout.write(f"  brokers: {len(self.brokers)}  professionals: {len(self.professionals)}  conversations: {Conversation.objects.filter(initiator__email__endswith=DEMO_DOMAIN).count()}")
        self.stdout.write(f"\nAll demo accounts use the password: {self.password}")
        shown = {}
        for role, email, name in self.accounts:
            shown.setdefault(role, []).append(email)
        for role, emails in shown.items():
            sample = ", ".join(emails[:3])
            self.stdout.write(f"  {role:<17} {len(emails):>3} accounts, e.g. {sample}")
