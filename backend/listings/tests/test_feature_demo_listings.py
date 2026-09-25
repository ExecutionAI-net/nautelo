"""The dev-only `feature_demo_listings` command and the "featured needs a ready photo" rule."""

from datetime import timedelta

import pytest
from django.core.management import call_command
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from listings.enums import ListingStatus, MediaStatus
from listings.models import BoatListing
from listings.tests.factories import make_media, make_private_listing, make_snapshot

pytestmark = pytest.mark.django_db


def _published(owner_email, *, photo=True):
    owner = make_user(owner_email, role=UserRole.PRIVATE_SELLER, verified=True)
    listing = make_private_listing(owner=owner)
    staff = make_user(f"mod-{listing.pk}@example.test", role=UserRole.STAFF, verified=True)
    listing.current_public_snapshot = make_snapshot(listing, approved_by=staff)
    listing.status = ListingStatus.PUBLISHED
    listing.published_at = timezone.now()
    listing.save()
    if photo:
        make_media(listing)
    return listing


def test_the_command_features_only_demo_listings_with_a_ready_photo_and_is_idempotent():
    with_photo = _published("one@demo.nauta.test")
    no_photo = _published("two@demo.nauta.test", photo=False)
    real = _published("real@example.test")

    call_command("feature_demo_listings", "--count", "2")

    assert BoatListing.objects.get(pk=with_photo.pk).featured_until > timezone.now()
    assert BoatListing.objects.get(pk=no_photo.pk).featured_until is None
    assert BoatListing.objects.get(pk=real.pk).featured_until is None

    first = BoatListing.objects.get(pk=with_photo.pk).featured_until
    call_command("feature_demo_listings", "--count", "2")
    assert BoatListing.objects.get(pk=with_photo.pk).featured_until == first


def test_a_featured_listing_without_a_ready_photo_stays_out_of_the_featured_strip():
    shown = _published("shown@example.test")
    hidden = _published("hidden@example.test", photo=False)
    make_media(hidden, status=MediaStatus.SCANNING)
    for listing in (shown, hidden):
        listing.featured_at = timezone.now()
        listing.featured_until = timezone.now() + timedelta(days=7)
        listing.save()

    ids = [row["id"] for row in APIClient().get(reverse("listing-list"), {"featured": "1"}).json()["results"]]

    assert ids == [str(shown.pk)]
