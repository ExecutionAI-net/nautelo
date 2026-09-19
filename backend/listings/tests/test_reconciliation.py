import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from listings.enums import ListingStatus
from listings.reconciliation import reconcile
from listings.tests.factories import make_private_listing

pytestmark = pytest.mark.django_db


def test_a_clean_database_reconciles():
    assert reconcile()["ok"] is True
    call_command("reconcile_listings")


def test_a_published_listing_without_snapshot_or_slug_is_reported():
    owner = make_user(role=UserRole.PRIVATE_SELLER)
    make_private_listing(owner=owner, status=ListingStatus.PUBLISHED)
    report = reconcile()
    assert report["problems"]["published_without_snapshot"] == 1
    assert report["problems"]["published_without_slug"] == 1
    assert report["ok"] is False
    with pytest.raises(CommandError):
        call_command("reconcile_listings")
