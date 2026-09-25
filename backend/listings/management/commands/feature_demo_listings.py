"""Keep the home page's "Featured boats" strip populated on development/staging.

On dev nobody buys promotions, so the strip is either empty or shows whatever QA
listing was last promoted in a test - sometimes one without a single ready photo.
This command features a handful of published demo listings (the `seed_demo_data`
set, which ships with ready photos) for 30 days. It is idempotent and safe to run
on every deploy: listings that are already featured are left alone, and nothing
happens on a database without demo data, so production is untouched by design.

    python manage.py feature_demo_listings            # top up to 4 featured demo listings
    python manage.py feature_demo_listings --count 6
"""

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db.models import Exists, OuterRef, Q
from django.utils import timezone

from listings.enums import ListingStatus, MediaStatus
from listings.models import BoatListing, ListingMedia

DEMO_DOMAIN = "demo.nauta.test"
FEATURED_FOR = timedelta(days=30)


class Command(BaseCommand):
    help = "Feature a few published demo listings (with ready photos) so the home strip is never empty on dev."

    def add_arguments(self, parser):
        parser.add_argument("--count", type=int, default=4, help="How many demo listings should be featured in total.")

    def handle(self, *args, **opts):
        now = timezone.now()
        has_photo = Exists(ListingMedia.objects.filter(listing=OuterRef("pk"), status=MediaStatus.READY))
        demo = (
            BoatListing.objects.filter(status=ListingStatus.PUBLISHED)
            .filter(Q(owner_user__email__endswith="@" + DEMO_DOMAIN) | Q(broker__memberships__user__email__endswith="@" + DEMO_DOMAIN))
            .filter(has_photo)
            .distinct()
        )
        already = demo.filter(featured_until__gt=now).count()
        missing = max(0, opts["count"] - already)
        picked = list(demo.exclude(featured_until__gt=now).order_by("-published_at")[:missing])
        for listing in picked:
            listing.featured_at = now
            listing.featured_until = now + FEATURED_FOR
            listing.save(update_fields=["featured_at", "featured_until", "updated_at"])
        self.stdout.write(self.style.SUCCESS(f"{already} demo listings were already featured; {len(picked)} more featured until {(now + FEATURED_FOR).date()}."))
