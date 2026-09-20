"""Spec §22.4 enforcement at submit, and spec §36.3's publication-duration freeze.

These tests drive the real HTTP endpoints, because spec §22's definition of
done is a statement about what the API does.
"""

from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from entitlements.enums import EntitlementSource, EntitlementState, EntitlementType
from entitlements.models import UserEntitlement
from entitlements.tests.factories import make_entitlement, make_private_seller
from listings.enums import ListingStatus, PublicationSource
from listings.models import BoatListing
from listings.policies import ListingEntitlementGate
from listings.tests.factories import make_brand, make_media, make_model, make_private_listing
from platform_settings.services import set_feature_flag, update_setting


@pytest.fixture
def workflow_enabled(db):
    set_feature_flag(key="listing_revisions", is_enabled=True, actor=None)


@pytest.fixture
def entitlements_on(db):
    set_feature_flag(key="individual_entitlements", is_enabled=True, actor=None)


@pytest.fixture
def api():
    return APIClient()


def _draft(api, *, brand):
    response = api.post(
        reverse("listing-draft-create"),
        {
            "brand_id": str(brand.pk),
            "model_id": str(make_model(brand).pk),
            "manufacture_year": 2020,
        },
        format="json",
    )
    assert response.status_code == 201, response.data
    return response.data


def _submission_payload(version, *, media_ids, **overrides):
    """A COMPLETE, submission-valid PATCH body.

    Every field in `listings.payloads.REQUIRED_FOR_SUBMISSION` is present —
    `title_en`, `description_en`, `location_country`, `location_city`, `price`,
    `media_ids`. That completeness is load-bearing, not tidiness: a revision is a
    whole proposed document, and `submit_listing_revision` runs
    `validate_revision_payload(revision.payload, for_submission=True)` and
    `validate_submission_media(...)` BEFORE it ever reaches the entitlement
    block. A PATCH that sends one field therefore yields a 400 that never
    exercises the gate at all — which is exactly what a test re-opening an edit
    cycle on a listing with NO public snapshot must avoid, because
    `update_listing_draft` seeds such a cycle from `payload_from_snapshot(None)`
    == `{}` and keeps nothing from the withdrawn draft (Known Limitation 16).
    """
    payload = {
        "version": version,
        "title_en": "Well kept cruiser",
        "description_en": "A well kept cruiser with a recent service.",
        "location_country": "ES",
        "location_region": "Balearic Islands",
        "location_city": "Palma",
        "price": "125000.00",
        "currency": "EUR",
        "media_ids": [str(media_id) for media_id in media_ids],
    }
    payload.update(overrides)
    return payload


def _fill_and_submit(api, created):
    listing = BoatListing.objects.get(pk=created["id"])
    image = make_media(listing)
    patched = api.patch(
        reverse("listing-draft-update", kwargs={"listing_id": listing.pk}),
        _submission_payload(created["revision"]["version"], media_ids=[image.pk]),
        format="json",
    )
    assert patched.status_code == 200, patched.data
    return api.post(
        reverse("listing-submit", kwargs={"listing_id": listing.pk}),
        {"version": patched.data["revision"]["version"]},
        format="json",
    )


@pytest.mark.django_db
def test_the_first_submission_consumes_the_free_right(
    api, workflow_enabled, entitlements_on
):
    seller = make_private_seller()
    api.force_authenticate(seller)

    response = _fill_and_submit(api, _draft(api, brand=make_brand("Beneteau")))

    assert response.status_code == 200, response.data
    listing = BoatListing.objects.get(pk=response.data["id"])
    assert listing.status == ListingStatus.PENDING_APPROVAL
    assert listing.publication_source == PublicationSource.FREE_ENTITLEMENT
    right = listing.consumed_entitlement
    assert right is not None
    assert right.entitlement_type == EntitlementType.FREE_LISTING
    assert right.state == EntitlementState.CONSUMED
    assert right.listing_id == listing.pk


@pytest.mark.django_db
def test_a_second_submission_is_refused_with_403_and_the_action_block(
    api, workflow_enabled, entitlements_on
):
    """Spec §22 definition of done: "Multiple tabs cannot create multiple free
    listings." Two drafts exist; only one can ever be submitted."""
    seller = make_private_seller()
    api.force_authenticate(seller)
    first = _draft(api, brand=make_brand("Beneteau"))
    second = _draft(api, brand=make_brand("Jeanneau"))

    assert _fill_and_submit(api, first).status_code == 200
    refused = _fill_and_submit(api, second)

    assert refused.status_code == 403
    assert refused.data["error"]["code"] == "listing_entitlement_required"
    assert refused.data["error"]["action"]["product_code"] == (
        "INDIVIDUAL_LISTING_RIGHT"
    )
    assert UserEntitlement.objects.filter(user=seller).count() == 1
    assert BoatListing.objects.get(pk=second["id"]).status == ListingStatus.DRAFT


@pytest.mark.django_db
def test_resubmitting_a_withdrawn_listing_does_not_burn_a_second_right(
    api, workflow_enabled, entitlements_on
):
    """Spec §22.1: "A rejected submission can be corrected without consuming a
    second right." Spec §36.3: "a submitted right stays associated through
    changes-requested/rejected correction loop".

    This is the test that forces `submit_listing_revision`'s pre-check to be
    guarded by `listing.consumed_entitlement_id is None` (Step 4). By the second
    submit the seller's free right is gone, so a bare
    `can_submit(user=actor, broker=...)` returns False and would 403 — even
    though `consume()` would correctly hand back the very same right.

    **The correction PATCH must resend the WHOLE payload, and that is not
    optional.** Withdrawing moves the revision to `WITHDRAWN`, which
    `open_revision_for()` no longer returns, so the PATCH opens a *new* edit
    cycle seeded with `payload_from_snapshot(listing.current_public_snapshot)`.
    This listing was never published, so that snapshot is `None` and the seed is
    `{}`. A one-field PATCH would leave the revision missing every one of
    `REQUIRED_FOR_SUBMISSION`, and the re-submit would 400 inside
    `validate_revision_payload` — before the `charges_a_right` guard this test
    exists to prove. (That payload loss is a real Phase 11 gap; it is recorded
    as Known Limitation 16 and is not this phase's to fix.)
    """
    seller = make_private_seller()
    api.force_authenticate(seller)
    created = _draft(api, brand=make_brand("Bavaria"))
    submitted = _fill_and_submit(api, created)
    assert submitted.status_code == 200
    listing = BoatListing.objects.get(pk=created["id"])
    first_right_id = listing.consumed_entitlement_id
    assert first_right_id is not None

    withdrawn = api.post(
        reverse("listing-withdraw", kwargs={"listing_id": listing.pk}),
        {"version": submitted.data["revision"]["version"]},
        format="json",
    )
    assert withdrawn.status_code == 200, withdrawn.data

    listing.refresh_from_db()
    # The withdraw bumped the LISTING's version (it was never published, so the
    # listing itself went back to DRAFT), and the new edit cycle has no revision
    # version for the client to send yet — so the compare-and-swap here runs
    # against `listing.version`, which is what `update_listing_draft` expects on
    # a `revision is None` path.
    reopened = api.patch(
        reverse("listing-draft-update", kwargs={"listing_id": listing.pk}),
        _submission_payload(
            listing.version,
            media_ids=list(listing.media.values_list("pk", flat=True)),
            title_en="Well kept cruiser, reduced",
            price="119000.00",
        ),
        format="json",
    )
    assert reopened.status_code == 200, reopened.data
    again = api.post(
        reverse("listing-submit", kwargs={"listing_id": listing.pk}),
        {"version": reopened.data["revision"]["version"]},
        format="json",
    )

    # A 400 here means the correction payload was incomplete and the test never
    # reached the gate; a 403 means the `charges_a_right` guard is missing.
    assert again.status_code == 200, again.data
    listing.refresh_from_db()
    assert listing.consumed_entitlement_id == first_right_id
    assert UserEntitlement.objects.filter(user=seller).count() == 1


@pytest.mark.django_db
def test_a_legacy_published_listing_is_revisable_without_burning_a_right(
    api, workflow_enabled, entitlements_on, published_listing_with_snapshot
):
    """Phase 11 Known Limitation 1: EVERY listing published before this phase
    has `consumed_entitlement_id = NULL`, because no code path ever wrote that
    column — that is real data in dev and staging today.

    Spec §6.3 charges a right only on submission "for initial approval", and
    spec §20.2's post-publication edit runs through this same submit path. So
    the first revision of such a listing must be neither charged nor refused,
    even when its owner has no right left. Gating on `consumed_entitlement_id`
    alone would do both.
    """
    listing = published_listing_with_snapshot
    seller = listing.owner_user
    assert listing.consumed_entitlement_id is None
    assert listing.current_public_snapshot_id is not None

    # This owner has nothing available: one spent free right, no paid right.
    # The explicit `brand=` is required, not decorative: the fixture already
    # created this owner's default brand (`make_private_listing` derives the name
    # from the OWNER's pk when none is given) and `BoatBrand.normalized_name` is
    # `unique=True`, so a bare second `make_private_listing(owner=seller)` here
    # raises IntegrityError before any assertion runs.
    make_entitlement(
        user=seller,
        listing=make_private_listing(owner=seller, brand=make_brand("Sunseeker")),
        entitlement_type=EntitlementType.FREE_LISTING,
        source=EntitlementSource.FREE_POLICY,
        state=EntitlementState.CONSUMED,
        consumed_at=timezone.now(),
    )
    assert ListingEntitlementGate.can_submit(user=seller, broker=None) is False

    api.force_authenticate(seller)
    reopened = api.patch(
        reverse("listing-draft-update", kwargs={"listing_id": listing.pk}),
        {"version": listing.version, "title_en": "Now with a new tender"},
        format="json",
    )
    assert reopened.status_code == 200, reopened.data
    again = api.post(
        reverse("listing-submit", kwargs={"listing_id": listing.pk}),
        {"version": reopened.data["revision"]["version"]},
        format="json",
    )

    assert again.status_code == 200, again.data
    listing.refresh_from_db()
    # Spec §20.2: the approved snapshot stays live while the edit is reviewed.
    assert listing.status == ListingStatus.PUBLISHED
    assert listing.consumed_entitlement_id is None
    # Exactly the one row created above — nothing new was burned.
    assert UserEntitlement.objects.filter(user=seller).count() == 1


@pytest.mark.django_db
def test_with_the_flag_off_a_second_submission_still_succeeds(api, workflow_enabled):
    seller = make_private_seller()
    api.force_authenticate(seller)
    first = _fill_and_submit(api, _draft(api, brand=make_brand("Bavaria")))
    assert first.status_code == 200, first.data

    second = _fill_and_submit(api, _draft(api, brand=make_brand("Hanse")))

    assert second.status_code == 200, second.data
    # ...but the ledger recorded both, so enabling the flag later blocks a third.
    assert UserEntitlement.objects.filter(user=seller).count() == 2


@pytest.mark.django_db
def test_a_broker_submission_never_touches_the_ledger(
    api, workflow_enabled, entitlements_on, broker_seller
):
    """Spec §1: "Broker listing quota: Unlimited"."""
    actor, broker, brand = broker_seller
    api.force_authenticate(actor)
    created = api.post(
        reverse("listing-draft-create"),
        {
            "broker_id": str(broker.pk),
            "brand_id": str(brand.pk),
            "model_id": str(make_model(brand).pk),
            "manufacture_year": 2022,
        },
        format="json",
    )
    assert created.status_code == 201, created.data

    response = _fill_and_submit(api, created.data)

    assert response.status_code == 200, response.data
    listing = BoatListing.objects.get(pk=created.data["id"])
    assert listing.publication_source == PublicationSource.BROKER_POLICY
    assert listing.consumed_entitlement_id is None
    assert UserEntitlement.objects.count() == 0


@pytest.mark.django_db
def test_publication_days_is_frozen_at_consumption(entitlements_on):
    """Spec §36.3: "Existing consumed entitlements preserve their recorded
    publication duration"."""
    seller = make_private_seller()
    listing = make_private_listing(owner=seller)
    right = make_entitlement(
        user=seller,
        listing=listing,
        entitlement_type=EntitlementType.FREE_LISTING,
        state=EntitlementState.CONSUMED,
        consumed_at=timezone.now(),
        metadata={"publication_days": 30},
    )
    listing.consumed_entitlement = right
    listing.save(update_fields=["consumed_entitlement_id", "updated_at"])

    update_setting(key="individual.free_publish_days", value=90, actor=None)

    assert ListingEntitlementGate.publication_days(listing=listing) == 30


@pytest.mark.django_db
def test_publication_days_falls_back_to_the_setting_without_an_entitlement():
    listing = make_private_listing(owner=make_private_seller())
    update_setting(key="individual.free_publish_days", value=45, actor=None)

    assert ListingEntitlementGate.publication_days(listing=listing) == 45


@pytest.mark.django_db
def test_a_paid_right_publishes_for_the_paid_duration(
    api, workflow_enabled, entitlements_on
):
    seller = make_private_seller()
    api.force_authenticate(seller)
    first = _fill_and_submit(api, _draft(api, brand=make_brand("Dufour")))
    assert first.status_code == 200, first.data
    make_entitlement(
        user=seller,
        entitlement_type=EntitlementType.PAID_LISTING,
        source=EntitlementSource.STRIPE_PURCHASE,
        state=EntitlementState.AVAILABLE,
        valid_until=timezone.now() + timedelta(days=200),
    )
    update_setting(key="individual.paid_publish_days", value=60, actor=None)

    second = _fill_and_submit(api, _draft(api, brand=make_brand("Elan")))

    assert second.status_code == 200, second.data
    listing = BoatListing.objects.get(pk=second.data["id"])
    assert listing.publication_source == PublicationSource.PAID_ENTITLEMENT
    assert ListingEntitlementGate.publication_days(listing=listing) == 60


@pytest.mark.django_db
def test_draft_creation_is_refused_once_the_allowance_is_gone(
    api, workflow_enabled, entitlements_on
):
    """Spec §22.4: "POST /api/v1/listings/drafts/ returns
    403 listing_entitlement_required when no right exists"."""
    seller = make_private_seller()
    api.force_authenticate(seller)
    first = _fill_and_submit(api, _draft(api, brand=make_brand("Sealine")))
    assert first.status_code == 200, first.data

    brand = make_brand("Fairline")
    refused = api.post(
        reverse("listing-draft-create"),
        {
            "brand_id": str(brand.pk),
            "model_id": str(make_model(brand).pk),
            "manufacture_year": 2019,
        },
        format="json",
    )

    assert refused.status_code == 403
    assert refused.data["error"]["code"] == "listing_entitlement_required"
    assert refused.data["error"]["action"] == {
        "type": "PURCHASE",
        "product_code": "INDIVIDUAL_LISTING_RIGHT",
    }
    assert refused.data["error"]["meta"]["blocking_reason"] == "FREE_ALLOWANCE_USED"
    # Nothing was written: the refusal happens before the listing row.
    assert BoatListing.objects.filter(owner_user=seller).count() == 1


@pytest.mark.django_db
def test_draft_creation_is_allowed_again_once_a_paid_right_arrives(
    api, workflow_enabled, entitlements_on
):
    seller = make_private_seller()
    api.force_authenticate(seller)
    first = _fill_and_submit(api, _draft(api, brand=make_brand("Nimbus")))
    assert first.status_code == 200, first.data
    make_entitlement(
        user=seller,
        entitlement_type=EntitlementType.PAID_LISTING,
        source=EntitlementSource.STRIPE_PURCHASE,
        state=EntitlementState.AVAILABLE,
        valid_until=timezone.now() + timedelta(days=30),
    )

    created = _draft(api, brand=make_brand("Grand Banks"))

    assert created["status"] == ListingStatus.DRAFT


@pytest.mark.django_db
def test_a_broker_draft_is_never_gated(
    api, workflow_enabled, entitlements_on, broker_seller
):
    actor, broker, brand = broker_seller
    api.force_authenticate(actor)

    for year in (2019, 2020, 2021):
        response = api.post(
            reverse("listing-draft-create"),
            {
                "broker_id": str(broker.pk),
                "brand_id": str(brand.pk),
                "model_id": str(make_model(brand, f"Model {year}").pk),
                "manufacture_year": year,
            },
            format="json",
        )
        assert response.status_code == 201, response.data
    assert UserEntitlement.objects.count() == 0


@pytest.mark.django_db
def test_draft_creation_is_not_gated_while_the_flag_is_off(api, workflow_enabled):
    seller = make_private_seller()
    api.force_authenticate(seller)
    first = _fill_and_submit(api, _draft(api, brand=make_brand("Linssen")))
    assert first.status_code == 200, first.data

    created = _draft(api, brand=make_brand("Sirius"))

    assert created["status"] == ListingStatus.DRAFT


@pytest.mark.django_db
def test_a_rejected_first_submission_returns_its_right(api, workflow_enabled, entitlements_on):
    from listings.decisions import reject_revision
    from entitlements.eligibility import ListingEligibilityService

    seller = make_private_seller()
    api.force_authenticate(seller)
    response = _fill_and_submit(api, _draft(api, brand=make_brand("Jeanneau")))
    assert response.status_code == 200, response.data
    listing = BoatListing.objects.get(pk=response.data["id"])
    used = listing.consumed_entitlement
    revision = listing.revisions.get(state="SUBMITTED")

    reject_revision(revision_id=revision.pk, actor=seller, expected_version=revision.version, note="No.")

    listing.refresh_from_db()
    used.refresh_from_db()
    assert listing.consumed_entitlement_id is None
    assert used.state == EntitlementState.REVOKED
    assert ListingEligibilityService.for_user(seller).can_start_listing
