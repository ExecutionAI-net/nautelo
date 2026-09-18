"""The published finance settings live on the snapshot (spec §36.1, §11.4).

Spec §36.1: "Draft broker finance settings do not leak before publication."
Phase 11 contract rule 1: "Never read a listing's draft columns on a public
path. Public content comes from listing.current_public_snapshot only."

listings.drafts._apply_payload_to_listing writes show_finance_estimate and the
three override columns onto the BoatListing row the moment a broker saves a
draft, so those columns are draft state. These tests pin the copy that turns
them into published state.
"""

import itertools
from decimal import Decimal

import pytest
from django.utils import timezone

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from brokers.tests.factories import make_broker
from listings.enums import RevisionOrigin, RevisionStatus
from listings.snapshots import create_snapshot_from_revision
from listings.tests.factories import (
    make_broker_listing,
    make_private_listing,
    make_revision,
    make_snapshot,
)

_emails = itertools.count()


def _email(prefix):
    return f"{prefix}-{next(_emails)}@example.com"


def _agent():
    # The brief said UserRole.BROKER_AGENT; accounts.enums.UserRole has no such
    # member (BUYER / PRIVATE_SELLER / BROKER / SERVICE_PROVIDER / STAFF), and
    # listings/tests/test_draft_create.py builds its broker agent with
    # UserRole.BROKER. Same intent, real enum member.
    return make_user(email=_email("agent"), role=UserRole.BROKER, verified=True)


def _moderator():
    return make_user(email=_email("moderator"), role=UserRole.STAFF, verified=True)


def _payload(listing):
    return {
        "title_en": "Motor yacht in excellent order",
        "description_en": "Twin engines, full service history.",
        "location_country": "ES",
        "location_city": "Palma",
        "currency": listing.currency,
        "price": f"{listing.price:f}",
        "media_ids": [],
    }


def _approve(listing, *, moderator):
    revision = make_revision(
        listing,
        state=RevisionStatus.DRAFT,
        origin=RevisionOrigin.OWNER,
        payload=_payload(listing),
    )
    return create_snapshot_from_revision(
        listing=listing,
        revision=revision,
        cleaned_payload=_payload(listing),
        approved_by=moderator,
        approved_at=timezone.now(),
    )


@pytest.mark.django_db
def test_the_snapshot_copies_the_listing_finance_settings_at_approval():
    agent = _agent()
    listing = make_broker_listing(
        broker=make_broker(name="Palma Yachts", slug="palma-yachts"),
        actor=agent,
        show_finance_estimate=True,
        finance_rate_override_percent=Decimal("4.2500"),
        finance_term_override_months=60,
        finance_down_payment_override_percent=Decimal("15.0000"),
    )

    snapshot = _approve(listing, moderator=_moderator())

    assert snapshot.show_finance_estimate is True
    assert snapshot.finance_rate_override_percent == Decimal("4.2500")
    assert snapshot.finance_term_override_months == 60
    assert snapshot.finance_down_payment_override_percent == Decimal("15.0000")


@pytest.mark.django_db
def test_a_later_draft_change_does_not_alter_the_published_snapshot():
    """Spec §36.1: draft broker finance settings do not leak before publication."""
    agent = _agent()
    listing = make_broker_listing(
        broker=make_broker(name="Ibiza Marine", slug="ibiza-marine"),
        actor=agent,
        show_finance_estimate=False,
    )
    snapshot = _approve(listing, moderator=_moderator())

    listing.show_finance_estimate = True
    listing.finance_rate_override_percent = Decimal("0.0100")
    listing.save(
        update_fields=["show_finance_estimate", "finance_rate_override_percent"]
    )
    snapshot.refresh_from_db()

    assert snapshot.show_finance_estimate is False
    assert snapshot.finance_rate_override_percent is None


@pytest.mark.django_db
def test_a_private_listing_publishes_with_finance_disabled():
    owner = make_user(
        email=_email("seller"), role=UserRole.PRIVATE_SELLER, verified=True
    )
    listing = make_private_listing(owner=owner)

    snapshot = _approve(listing, moderator=_moderator())

    assert snapshot.show_finance_estimate is False
    assert snapshot.finance_rate_override_percent is None
    assert snapshot.finance_term_override_months is None
    assert snapshot.finance_down_payment_override_percent is None


@pytest.mark.django_db
def test_the_finance_columns_are_immutable_like_the_rest_of_the_snapshot():
    """Phase 11 contract rule 3: never mutate a ListingSnapshot row."""
    owner = make_user(
        email=_email("seller"), role=UserRole.PRIVATE_SELLER, verified=True
    )
    listing = make_private_listing(owner=owner)
    snapshot = make_snapshot(listing, approved_by=_moderator())

    snapshot.show_finance_estimate = True

    with pytest.raises(ValueError):
        snapshot.save(update_fields=["show_finance_estimate"])
