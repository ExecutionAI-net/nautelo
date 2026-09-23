"""Fill a development database with the demonstration guides and ads from the supplied design.

Everything here is placeholder copy for design review. Run it on local and staging
databases only, then delete the rows from the staff "Guides & ads" page before launch.
"""

from django.core.management.base import BaseCommand

from content.models import AdPlacement, Advertisement, GuideArticle, GuideStatus

GUIDES = [
    {
        "slug": "transferring-vessel-flags-between-spain-and-italy",
        "title": "Transferring Vessel Flags Between Spain and Italy: Step-by-Step",
        "category": "Legal & Tax",
        "excerpt": "How to deregister a vessel in one registry and register it in the other without losing months.",
        "hero_image_url": "/design/ce28c27afe.jpg",
        "author_name": "Nautelo editorial team",
        "body": (
            "Moving a boat between the Spanish and Italian registries is a two-sided process: the old flag must "
            "release the vessel before the new one can register it.\n\n"
            "Start by requesting the certificate of deregistration from the current registry, and confirm that no "
            "liens or charter registrations are outstanding. Next, gather the bill of sale, proof of VAT status and "
            "the builder's declaration of conformity.\n\n"
            "Finally, file the registration in the new flag state and update your insurer. Allow several weeks and "
            "involve a nautical legal adviser early."
        ),
    },
    {
        "slug": "spring-commissioning-pre-season-engine-and-hull-protocols",
        "title": "Spring Commissioning: Pre-Season Engine and Hull Protocols",
        "category": "Maintenance",
        "excerpt": "A practical checklist for getting your boat ready for the season.",
        "hero_image_url": "/design/68be5c8e30.jpg",
        "author_name": "Nautelo editorial team",
        "body": (
            "Begin with the hull: inspect antifouling, anodes and through-hull fittings while the boat is still "
            "ashore.\n\n"
            "Then service the engine: change oil and filters, check belts and impellers, and test the cooling "
            "circuit.\n\n"
            "Before launching, verify safety equipment, flares and lifejacket dates, and test navigation "
            "electronics."
        ),
    },
    {
        "slug": "sea-trial-checklist-what-to-test-before-signing",
        "title": "Sea Trial Checklist: What to Test Before Signing a Vessel Purchase",
        "category": "Buyer's Guide",
        "excerpt": "The tests that separate a good purchase from an expensive surprise.",
        "hero_image_url": "/design/83d5b58468.jpg",
        "author_name": "Nautelo editorial team",
        "body": (
            "A sea trial should last long enough to bring the engines to operating temperature and reach full "
            "throttle.\n\n"
            "Listen for vibration under load, check that steering is smooth, and confirm that bilge pumps and "
            "electronics work as advertised.\n\n"
            "Bring a surveyor if the price justifies it, and agree in writing what happens if a fault is found."
        ),
    },
]

# image_url is a demo asset from the frontend's own /public/design/ folder, the same pool the rest of the
# site uses for placeholder photography (spec: keep fake data until the customer removes it before launch).
ADS = [
    (AdPlacement.HOME, "Mediterranean Marine Insurance", "Comprehensive Yacht Protection",
     "Cross-border hull, machinery and liability cover for Spanish and Italian territorial waters.",
     "Request Underwriting Quote", "/design/2ea59788a7.jpg"),
    (AdPlacement.HOME, "Porto Cervo Marina Services", "Berths & Full Shore Support",
     "Secured deep-water berths, round-the-clock security and VIP concierge on the Sardinian coast.",
     "Reserve Seasonal Berth", "/design/6105378ad2.jpg"),
    (AdPlacement.BOAT_LIST, "Balearic Hull & Propeller", "Drydock Maintenance & Antifouling Specialists",
     "Copper-coat application, osmosis prevention and hydrodynamic balancing for yachts up to 24 m.",
     "Reserve Drydock", "/design/4380ad7d78.jpg"),
    (AdPlacement.BOAT_DETAIL, "Adriatic Marine Insurance", "Underwriting for Mediterranean vessels",
     "Comprehensive hull, machinery and P&I cover with tailored quotes within 24 hours.",
     "Request Underwriting Dossier", "/design/018863299d.jpg"),
    (AdPlacement.GUIDES, "NaviTech Marine", "Radar, Sonar & Marine Electronics",
     "Solid-state deep-water sonar, radar and NMEA 2000 multi-station integration.",
     "Discover Electronics Suites", "/design/1b4bad5160.jpg"),
    (AdPlacement.DIRECTORY, "Tirreno Marine Chronometers", "Atelier for offshore navigation timepieces",
     "Precision maritime timepieces engineered for offshore navigation between Genoa, Palma and Porto Cervo.",
     "Discover Atelier", "/design/22fe9bf3e3.jpg"),
]


class Command(BaseCommand):
    help = "Create the demonstration guides and advertisements (idempotent)."

    def handle(self, *args, **options):
        for row in GUIDES:
            GuideArticle.objects.update_or_create(
                slug=row["slug"], defaults={**row, "status": GuideStatus.PUBLISHED}
            )
        for placement, sponsor, headline, body, cta, image_url in ADS:
            Advertisement.objects.update_or_create(
                placement=placement,
                headline=headline,
                defaults={
                    "sponsor": sponsor,
                    "body": body,
                    "cta_label": cta,
                    "cta_url": "https://example.com/",
                    "image_url": image_url,
                    "is_active": True,
                },
            )
        self.stdout.write(self.style.SUCCESS(f"{len(GUIDES)} guides and {len(ADS)} ads ready."))
