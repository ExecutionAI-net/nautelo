"""The public read path (spec §20 definition of done, §30.1).

Every test here exists to prove one sentence from spec §20: "No pending private
listing leaks through search, sitemap, direct slug or API." The endpoints under
test are the first AllowAny surface in this app, so the negative tests below —
not the happy path — are the reason the task exists.
"""

import itertools
from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from listings.enums import ListingStatus, MediaStatus, MediaType, RevisionStatus
from listings.tests.factories import (
    make_media,
    make_private_listing,
    make_revision,
    make_snapshot,
)
from listings.views import published_listings_queryset

_emails = itertools.count()


def _email(prefix):
    return f"{prefix}-{next(_emails)}@example.com"


@pytest.fixture
def api():
    return APIClient()


def _owner():
    return make_user(
        email=_email("seller"), role=UserRole.PRIVATE_SELLER, verified=True
    )


def _moderator():
    return make_user(
        email=_email("moderator"), role=UserRole.STAFF, verified=True
    )


def _published(owner=None, **snapshot_kwargs):
    owner = owner or _owner()
    listing = make_private_listing(owner=owner, status=ListingStatus.PUBLISHED)
    image = make_media(listing, media_type=MediaType.IMAGE, status=MediaStatus.READY)
    snapshot = make_snapshot(
        listing,
        approved_by=_moderator(),
        media_manifest=[
            {
                "media_id": str(image.pk),
                "media_type": image.media_type,
                "storage_key": image.storage_key,
                "mime_type": image.mime_type,
                "sort_order": image.sort_order,
                "width": image.width,
                "height": image.height,
                "duration_seconds": image.duration_seconds,
                "checksum_sha256": image.checksum_sha256,
            }
        ],
        **snapshot_kwargs,
    )
    listing.current_public_snapshot = snapshot
    listing.published_at = timezone.now()
    listing.save(update_fields=["current_public_snapshot", "published_at"])
    return listing, snapshot


@pytest.mark.django_db
def test_a_guest_sees_a_published_listing(api):
    listing, snapshot = _published()

    response = api.get(reverse("listing-detail", kwargs={"listing_id": listing.pk}))

    assert response.status_code == 200
    assert response.data["id"] == str(listing.pk)
    assert response.data["title"]["en"] == snapshot.title_en
    assert response.data["price"] == {"amount": "125000.00", "currency": "EUR"}
    assert response.data["brand_name"] == snapshot.brand_name_snapshot
    assert response.data["snapshot_version"] == 1
    assert response.data["view_count"] == 0
    assert len(response.data["media"]) == 1


@pytest.mark.django_db
def test_the_detail_response_is_built_only_from_snapshot_columns(api):
    """Spec §11.4: public pages read the snapshot, never the draft columns."""
    listing, snapshot = _published(
        title_it="Una barca bellissima",
        title_es="Un barco precioso",
        description_it="Tenuta benissimo.",
        description_es="Muy bien cuidado.",
        location_region="Liguria",
    )

    response = api.get(reverse("listing-detail", kwargs={"listing_id": listing.pk}))

    assert response.data["title"] == {
        "en": snapshot.title_en,
        "it": "Una barca bellissima",
        "es": "Un barco precioso",
    }
    assert response.data["description"] == {
        "en": snapshot.description_en,
        "it": "Tenuta benissimo.",
        "es": "Muy bien cuidado.",
    }
    assert response.data["location"] == {
        "country": snapshot.location_country,
        "region": "Liguria",
        "city": snapshot.location_city,
    }
    assert response.data["specifications"] == snapshot.specifications
    assert response.data["specifications_schema_version"] == 1
    assert response.data["manufacture_year"] == snapshot.manufacture_year_snapshot
    assert response.data["model_name"] == snapshot.model_name_snapshot
    assert response.data["custom_model_name"] == snapshot.custom_model_name_snapshot
    assert response.data["seller_type"] == listing.seller_type


@pytest.mark.django_db
def test_the_public_payload_carries_no_owner_or_internal_columns(api):
    """A public card must not become an accidental seller-identity disclosure."""
    listing, _ = _published()

    response = api.get(reverse("listing-detail", kwargs={"listing_id": listing.pk}))

    forbidden = {
        "owner_user",
        "owner_user_id",
        "owner",
        "broker",
        "broker_id",
        "created_by",
        "updated_by",
        "status",
        "version",
        "revision",
        "revisions",
        "snapshots",
        "consumed_entitlement_id",
        "publication_source",
        "show_finance_estimate",
        "finance_down_payment_override_percent",
        "finance_rate_override_percent",
        "finance_term_override_months",
    }
    assert forbidden.isdisjoint(response.data.keys())
    assert "@example.com" not in str(response.data)


@pytest.mark.django_db
def test_the_response_never_exposes_a_finance_block_in_this_phase(api):
    listing, _ = _published()

    response = api.get(reverse("listing-detail", kwargs={"listing_id": listing.pk}))

    assert "finance" not in response.data


@pytest.mark.django_db
def test_a_draft_listing_is_not_publicly_readable(api):
    listing = make_private_listing(owner=_owner())

    response = api.get(reverse("listing-detail", kwargs={"listing_id": listing.pk}))

    assert response.status_code == 404


@pytest.mark.django_db
def test_a_pending_listing_is_not_publicly_readable_even_by_its_owner(api):
    owner = _owner()
    listing = make_private_listing(owner=owner, status=ListingStatus.PENDING_APPROVAL)
    make_revision(
        listing,
        state=RevisionStatus.SUBMITTED,
        submitted_by=owner,
        submitted_at=timezone.now(),
    )
    api.force_authenticate(owner)

    response = api.get(reverse("listing-detail", kwargs={"listing_id": listing.pk}))

    assert response.status_code == 404


@pytest.mark.django_db
def test_authenticating_as_the_owner_really_does_reach_the_view(api):
    """Guards the test above: force_authenticate must not be a silent no-op.

    PublicListingDetailView sets `authentication_classes = []`, so if DRF's
    forced authentication did not override that, the 404 in the previous test
    would prove nothing about owner access. It does override it (see
    rest_framework.request.Request.__init__), and this test pins that: the same
    authenticated owner reaches a *published* row, so the 404 above is the
    queryset filter refusing them, not authentication being switched off.
    """
    listing, _ = _published()
    api.force_authenticate(listing.owner_user)

    response = api.get(reverse("listing-detail", kwargs={"listing_id": listing.pk}))

    assert response.status_code == 200
    assert response.wsgi_request.user == listing.owner_user
    assert response.wsgi_request.user.is_authenticated


@pytest.mark.django_db
def test_a_suspended_listing_disappears_from_public_reads(api):
    listing, _ = _published()
    listing.status = ListingStatus.SUSPENDED
    listing.save(update_fields=["status"])

    detail = api.get(reverse("listing-detail", kwargs={"listing_id": listing.pk}))
    listing_page = api.get(reverse("listing-list"))

    assert detail.status_code == 404
    assert listing_page.data["count"] == 0


@pytest.mark.django_db
def test_an_expired_listing_disappears_from_public_reads(api):
    listing, _ = _published()
    listing.status = ListingStatus.EXPIRED
    listing.save(update_fields=["status"])

    assert api.get(reverse("listing-list")).data["count"] == 0


@pytest.mark.django_db
@pytest.mark.parametrize(
    "status",
    [
        ListingStatus.DRAFT,
        ListingStatus.PENDING_APPROVAL,
        ListingStatus.REJECTED,
        ListingStatus.SUSPENDED,
        ListingStatus.EXPIRED,
        ListingStatus.ARCHIVED,
    ],
)
def test_no_status_other_than_published_is_readable_even_with_a_snapshot(api, status):
    """An attached approved snapshot never overrides the status gate.

    A listing keeps `current_public_snapshot` after suspension, expiry and
    archival, so this is the exact shape a leak would take: real approved
    content sitting on a row staff has taken down.
    """
    listing, _ = _published()
    listing.status = status
    listing.save(update_fields=["status"])

    detail = api.get(reverse("listing-detail", kwargs={"listing_id": listing.pk}))

    assert detail.status_code == 404
    assert api.get(reverse("listing-list")).data["count"] == 0


@pytest.mark.django_db
def test_a_published_row_without_a_snapshot_is_invisible(api):
    """Defence in depth: status alone never makes a listing public."""
    listing = make_private_listing(owner=_owner(), status=ListingStatus.PUBLISHED)

    detail = api.get(reverse("listing-detail", kwargs={"listing_id": listing.pk}))

    assert detail.status_code == 404
    assert api.get(reverse("listing-list")).data["count"] == 0


@pytest.mark.django_db
def test_the_published_queryset_requires_both_conditions():
    """The reusable helper itself, independent of any view."""
    published, _ = _published()
    no_snapshot = make_private_listing(
        owner=_owner(), status=ListingStatus.PUBLISHED
    )
    suspended, _ = _published()
    suspended.status = ListingStatus.SUSPENDED
    suspended.save(update_fields=["status"])

    visible = set(published_listings_queryset().values_list("pk", flat=True))

    assert visible == {published.pk}
    assert no_snapshot.pk not in visible
    assert suspended.pk not in visible


@pytest.mark.django_db
def test_the_list_returns_only_published_listings_newest_first(api):
    older, _ = _published()
    newer, _ = _published()
    newer.published_at = timezone.now()
    newer.save(update_fields=["published_at"])
    older.published_at = timezone.now() - timedelta(days=1)
    older.save(update_fields=["published_at"])
    make_private_listing(owner=_owner())  # a draft that must not appear

    response = api.get(reverse("listing-list"))

    assert response.data["count"] == 2
    assert [row["id"] for row in response.data["results"]] == [
        str(newer.pk),
        str(older.pk),
    ]


@pytest.mark.django_db
def test_a_pending_edit_does_not_change_the_public_content(api):
    listing, snapshot = _published()
    owner = listing.owner_user
    make_revision(
        listing,
        base_snapshot=snapshot,
        payload={"price": "1.00", "title_en": "Not approved yet"},
        state=RevisionStatus.SUBMITTED,
        submitted_by=owner,
        submitted_at=timezone.now(),
    )
    listing.price = None
    listing.save(update_fields=["price"])

    response = api.get(reverse("listing-detail", kwargs={"listing_id": listing.pk}))

    assert response.data["title"]["en"] == snapshot.title_en
    assert response.data["price"]["amount"] == "125000.00"
    assert "Not approved yet" not in str(response.data)


@pytest.mark.django_db
def test_an_unknown_or_malformed_id_is_a_plain_404(api):
    import uuid

    unknown = api.get(reverse("listing-detail", kwargs={"listing_id": uuid.uuid4()}))

    assert unknown.status_code == 404
    assert api.get("/api/v1/listings/not-a-uuid/").status_code == 404


@pytest.mark.django_db
def test_the_public_routes_do_not_shadow_the_workflow_routes(api):
    """`listings/drafts/` must keep resolving to the draft-create view."""
    from django.urls import resolve

    assert resolve("/api/v1/listings/drafts/").url_name == "listing-draft-create"
    assert resolve("/api/v1/listings/").url_name == "listing-list"


@pytest.mark.django_db
def test_the_list_is_paginated_and_page_size_is_capped(api):
    for _ in range(3):
        _published()

    default_page = api.get(reverse("listing-list"))
    small_page = api.get(reverse("listing-list"), {"page_size": 2})
    oversized = api.get(reverse("listing-list"), {"page_size": 5000})

    assert default_page.data["count"] == 3
    assert len(default_page.data["results"]) == 3
    assert len(small_page.data["results"]) == 2
    assert small_page.data["next"] is not None
    assert len(oversized.data["results"]) == 3  # capped at max_page_size, not 5000


@pytest.mark.django_db
def test_the_public_read_endpoints_are_rate_limited(api, monkeypatch):
    """Both public endpoints share one throttle bucket and do return 429.

    Mirrors taxonomy's `test_boat_brand_search_is_rate_limited`: overriding
    settings.REST_FRAMEWORK would not work, because DRF's
    SimpleRateThrottle.THROTTLE_RATES is a class attribute bound once from
    api_settings.DEFAULT_THROTTLE_RATES at import time and Django's
    setting_changed signal does not retroactively update it. Monkeypatching the
    scope entry is the reliable way to exercise the throttle in a test.
    """
    from django.core.cache import cache
    from rest_framework.throttling import ScopedRateThrottle

    listing, _ = _published()
    cache.clear()
    monkeypatch.setitem(ScopedRateThrottle.THROTTLE_RATES, "public_listing_read", "2/min")

    assert api.get(reverse("listing-list")).status_code == 200
    # The detail view shares the scope, so it draws from the same bucket.
    detail_url = reverse("listing-detail", kwargs={"listing_id": listing.pk})
    assert api.get(detail_url).status_code == 200

    assert api.get(reverse("listing-list")).status_code == 429
    assert api.get(detail_url).status_code == 429
