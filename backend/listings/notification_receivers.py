"""Turns the listing workflow signals into notifications (spec 27.1).

Every signal is sent from transaction.on_commit(), so a rolled-back business
transaction produces nothing here (spec 27 test 1). Payloads carry ids and safe
labels only - never contact data or staff notes (spec 27.3).
"""

from django.dispatch import receiver

from notifications.enums import NotificationType
from notifications.fanout import STAFF_QUEUE_URL, moderation_staff, notify

from .signals import (
    listing_expired,
    listing_expiring,
    listing_initial_submitted,
    listing_other_model_submitted,
    listing_revision_approved,
    listing_revision_changes_requested,
    listing_revision_rejected,
    listing_revision_submitted,
)

SELLER_LISTINGS_URL = "/dashboard/private-seller/"
BROKER_LISTINGS_URL = "/dashboard/broker/"


def _revision_payload(revision) -> dict:
    return {
        "listing_id": str(revision.listing_id),
        "revision_id": str(revision.pk),
        "revision_number": revision.revision_number,
    }


def _submitter(revision):
    return revision.submitted_by or revision.listing.owner_user


def _listings_url(listing) -> str:
    return BROKER_LISTINGS_URL if listing.broker_id else SELLER_LISTINGS_URL


def _fan_out_to_staff(revision, notification_type, dedupe_key):
    for user in moderation_staff():
        notify(
            user,
            notification_type,
            target_url=STAFF_QUEUE_URL,
            payload=_revision_payload(revision),
            dedupe_key=dedupe_key,
        )


@receiver(listing_initial_submitted)
def on_initial_submitted(sender, revision, **kwargs):
    _fan_out_to_staff(
        revision,
        NotificationType.LISTING_INITIAL_SUBMITTED,
        f"{revision.listing_id}:{revision.revision_number}",
    )


@receiver(listing_revision_submitted)
def on_revision_submitted(sender, revision, **kwargs):
    # An initial submission fires both signals; spec 27.1 gives it its own
    # event, so the generic one is suppressed for revision 1.
    if revision.revision_number == 1:
        return
    _fan_out_to_staff(
        revision, NotificationType.LISTING_REVISION_SUBMITTED, str(revision.pk)
    )


@receiver(listing_other_model_submitted)
def on_other_model_submitted(sender, revision, **kwargs):
    _fan_out_to_staff(
        revision,
        NotificationType.LISTING_OTHER_MODEL_SUBMITTED,
        str(revision.pk),
    )


def _decision(revision, notification_type):
    user = _submitter(revision)
    if user is None:
        return
    decided = revision.decided_at.isoformat() if revision.decided_at else ""
    notify(
        user,
        notification_type,
        target_url=_listings_url(revision.listing),
        payload=_revision_payload(revision),
        dedupe_key=f"{revision.pk}:{decided}",
    )


@receiver(listing_revision_approved)
def on_approved(sender, revision, auto_approved=False, **kwargs):
    # An auto-approved submission is public in the same response the submitter
    # already received; telling them again is noise.
    if not auto_approved:
        _decision(revision, NotificationType.LISTING_APPROVED)


@receiver(listing_revision_changes_requested)
def on_changes_requested(sender, revision, **kwargs):
    _decision(revision, NotificationType.LISTING_CHANGES_REQUESTED)


@receiver(listing_revision_rejected)
def on_rejected(sender, revision, **kwargs):
    _decision(revision, NotificationType.LISTING_REJECTED)


def _listing_owner(listing):
    return listing.owner_user or listing.created_by


@receiver(listing_expiring)
def on_expiring(sender, listing, threshold_days, **kwargs):
    user = _listing_owner(listing)
    if user is None:
        return
    notify(
        user,
        NotificationType.LISTING_EXPIRING,
        target_url=_listings_url(listing),
        payload={"listing_id": str(listing.pk), "threshold_days": threshold_days},
        dedupe_key=f"{listing.pk}:{threshold_days}",
    )


@receiver(listing_expired)
def on_expired(sender, listing, **kwargs):
    user = _listing_owner(listing)
    if user is None:
        return
    expiry = listing.expires_at.isoformat() if listing.expires_at else ""
    notify(
        user,
        NotificationType.LISTING_EXPIRED,
        target_url=_listings_url(listing),
        payload={"listing_id": str(listing.pk)},
        dedupe_key=f"{listing.pk}:{expiry}",
    )
