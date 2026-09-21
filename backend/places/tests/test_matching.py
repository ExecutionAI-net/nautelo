import pytest
from django.utils import timezone

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from listings.enums import ListingStatus
from listings.models import ListingSnapshot
from listings.tests.factories import make_private_listing, make_snapshot
from places.importer import load_alternate_names, load_cities, load_regions
from places.matching import backfill_snapshots, find_city
from places.tests.test_importer import ADMIN1, ALTERNATES, CITIES

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def data():
    regions = load_regions(ADMIN1, {"IT", "ES"})
    load_cities(CITIES, {"IT", "ES"}, regions, load_alternate_names(ALTERNATES, {3176219}))


def test_local_spellings_and_accents_match():
    assert find_city("IT", "Genova").geoname_id == 3176219
    assert find_city("IT", " genoa ", "liguria").geoname_id == 3176219
    assert find_city("ES", "CADIZ").geoname_id == 6355234
    assert find_city("IT", "Atlantis") is None


def test_backfill_sets_place_and_canonical_names_only_when_applied():
    staff = make_user("s@places.example", role=UserRole.STAFF, verified=True)
    owner = make_user("o@places.example", role=UserRole.PRIVATE_SELLER, verified=True)
    listing = make_private_listing(owner=owner, status=ListingStatus.PUBLISHED)
    snap = make_snapshot(listing, approved_by=staff, location_country="IT", location_city="Genova", location_region="")
    assert backfill_snapshots()["matched"] == 1
    assert ListingSnapshot.objects.get(pk=snap.pk).location_place_id is None
    backfill_snapshots(apply=True)
    fresh = ListingSnapshot.objects.get(pk=snap.pk)
    assert (fresh.location_place_id, fresh.location_city, fresh.location_region) == (3176219, "Genoa", "Liguria")
    assert backfill_snapshots()["matched"] == 0
