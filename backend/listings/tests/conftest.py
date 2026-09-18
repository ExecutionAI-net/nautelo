import pytest
from django.core.cache import cache

from platform_settings.services import SETTINGS_CACHE_KEY, feature_flag_cache_key

# This project's cache is a real, shared Redis instance, not an in-memory
# backend that resets between runs, so every test in this package starts from
# and leaves behind a clean cache (same pattern as platform_settings/tests).
LISTINGS_FEATURE_FLAG_KEYS = ["listing_revisions", "individual_entitlements"]


@pytest.fixture(autouse=True)
def _clear_listings_caches():
    def _clear():
        cache.delete(SETTINGS_CACHE_KEY)
        for key in LISTINGS_FEATURE_FLAG_KEYS:
            cache.delete(feature_flag_cache_key(key))

    _clear()
    yield
    _clear()


@pytest.fixture
def broker_seller(db):
    """An ACTIVE broker, a member who may edit its listings, and a brand."""
    from accounts.enums import UserRole
    from accounts.tests.factories import make_user
    from brokers.enums import BrokerMembershipRole, BrokerOrganizationStatus
    from brokers.tests.factories import make_broker, make_membership
    from listings.tests.factories import make_brand

    actor = make_user("broker-agent@example.com", role=UserRole.BROKER, verified=True)
    broker = make_broker(
        "Palma Yachts", "palma-yachts", status=BrokerOrganizationStatus.ACTIVE
    )
    make_membership(
        actor,
        broker,
        role=BrokerMembershipRole.ADMIN,
        can_edit_listings=True,
    )
    return actor, broker, make_brand("Azimut")
