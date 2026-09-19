"""The single path from an approved revision to public content (spec §20.1 step
8, §20.4, §21).

Two callers, one implementation, on purpose:

  * ``listings.decisions.approve_revision`` — a staff moderator's APPROVE.
  * ``listings.submissions.submit_listing_revision`` — a broker submission under
    spec §21 auto-approval (wired up in Phase 12 Task 2).

Spec §21's acceptance test "Invalid listing never publishes even when
auto-approval is on" is only provable if there is no second, laxer way to create
a snapshot. Both callers validate the revision payload and its media *before*
calling in here and hand the cleaned document over; this module never publishes
a payload it was not given, and never validates on a caller's behalf.

Contract for every caller: be inside ``transaction.atomic()`` and already hold
``select_for_update()`` on the listing row. This module takes no lock of its own
— it is the tail of somebody else's transaction, not a transaction boundary.

It deliberately imports nothing from ``listings.decisions`` or
``listings.submissions``: it is the leaf both of them depend on, and
``decisions`` already imports ``submissions`` for ``validate_submission_media``,
so any arrow back from here would be an import cycle.
"""

from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from audit.models import AuditEvent
from audit.services import record_audit_event

from .drafts import InvalidWorkflowState
from .enums import ListingStatus, RevisionStatus
from .locking import bump_version
from .models import BoatListing, ListingRevision, ListingSnapshot
from .policies import ListingEntitlementGate
from .slugs import listing_slug_base
from .signals import listing_published, listing_revision_approved
from .snapshots import create_snapshot_from_revision


def guard_base_snapshot(listing: BoatListing, revision: ListingRevision) -> None:
    """Refuse a revision written against a snapshot that is no longer current.

    Another revision was approved while this one sat in the queue; publishing it
    now would silently discard that newer content — the snapshot-level
    counterpart of spec §20.5's "do not silently overwrite another
    browser/session edit".

    Zero queries on the happy path: it compares two ids already loaded on the
    instances and only dereferences ``current_public_snapshot`` when it is about
    to raise. ``publish_revision`` calls it first so no caller can skip it;
    ``approve_revision`` *also* calls it explicitly, before validating, to
    preserve the error precedence Phase 11 shipped (a revision that is both
    stale and invalid answers 409 ``stale_base_snapshot``, not 400
    ``validation_error``).
    """
    if (
        revision.base_snapshot_id is None
        or revision.base_snapshot_id == listing.current_public_snapshot_id
    ):
        return

    conflict = InvalidWorkflowState(
        "A newer version of this listing was approved in the meantime. "
        "Ask the seller to rebase their changes.",
        code="stale_base_snapshot",
    )
    # Copied into the error envelope by common.exceptions.nauta_exception_handler.
    conflict.meta = {
        "resource": "snapshot",
        "current_version": (
            listing.current_public_snapshot.version
            if listing.current_public_snapshot_id is not None
            else None
        ),
    }
    raise conflict


def publish_revision(
    *,
    listing: BoatListing,
    revision: ListingRevision,
    actor,
    cleaned: dict,
    expected_revision_version: int,
    note: str = "",
    auto_approved: bool = False,
    publication_source: str | None = None,
) -> ListingSnapshot:
    """Move ``revision`` to APPROVED, freeze the next snapshot, make it public.

    ``auto_approved`` changes exactly three observable things and nothing else:
    the audit ``action`` written, ``metadata.auto_approved``, and the
    ``auto_approved`` kwarg on the ``listing_revision_approved`` signal. The
    validation, the locking, the snapshot content and the state transition are
    identical on both paths — which is what makes spec §21's "Invalid listing
    never publishes even when auto-approval is on" true by construction, rather
    than by a second set of checks somebody has to remember to keep in step.

    ``publication_source`` is written only on a first publication and only when
    supplied; the staff path leaves it ``None`` because
    ``submit_listing_revision`` already wrote it when the listing entered
    PENDING_APPROVAL.
    """
    guard_base_snapshot(listing, revision)

    decided_at = timezone.now()
    is_first_publication = listing.current_public_snapshot_id is None
    before = {"listing_status": listing.status, "revision_state": revision.state}
    cleaned_note = (note or "").strip()

    bump_version(
        revision,
        expected_version=expected_revision_version,
        resource="revision",
        state=RevisionStatus.APPROVED,
        decided_by=actor,
        decided_at=decided_at,
        decision_note=cleaned_note,
    )

    snapshot = create_snapshot_from_revision(
        listing=listing,
        revision=revision,
        cleaned_payload=cleaned,
        approved_by=actor,
        approved_at=decided_at,
    )

    updates = {"current_public_snapshot": snapshot, "updated_by": actor}
    if is_first_publication:
        # The only listing-status move a publication makes. A post-publication
        # revision leaves `status` alone: the listing is already PUBLISHED,
        # LISTING_TRANSITIONS has no PUBLISHED -> PUBLISHED edge, and re-writing
        # it would silently un-suspend a SUSPENDED listing whose queued revision
        # is approved later. `published_at`/`expires_at` move with it for the
        # same reason: spec §11.4 makes `published_at` the listing's publication
        # moment, not the latest snapshot's.
        publication_days = ListingEntitlementGate.publication_days(listing=listing)
        updates["status"] = ListingStatus.PUBLISHED
        if not listing.slug:
            updates["slug"] = listing_slug_base(listing)
        updates["published_at"] = decided_at
        updates["expires_at"] = (
            decided_at + timedelta(days=publication_days)
            if publication_days is not None
            else None
        )
        if publication_source is not None:
            updates["publication_source"] = publication_source

    bump_version(
        listing, expected_version=listing.version, resource="listing", **updates
    )

    record_audit_event(
        actor_user=actor,
        actor_type=AuditEvent.ActorType.USER,
        action=(
            "listing.revision_auto_approved"
            if auto_approved
            else "listing.revision_approved"
        ),
        target_type="listings.ListingRevision",
        target_id=str(revision.pk),
        source=AuditEvent.Source.API,
        before=before,
        after={
            "listing_status": listing.status,
            "state": RevisionStatus.APPROVED,
            "snapshot_version": snapshot.version,
            "decided_at": decided_at,
        },
        metadata={
            "listing_id": str(listing.pk),
            "note": cleaned_note,
            "first_publication": is_first_publication,
            "auto_approved": auto_approved,
            "broker_id": str(listing.broker_id) if listing.broker_id else None,
        },
    )

    def _emit():
        listing_revision_approved.send(
            sender=ListingRevision, revision=revision, auto_approved=auto_approved
        )
        if is_first_publication:
            listing_published.send(
                sender=BoatListing, listing=listing, snapshot=snapshot
            )

    transaction.on_commit(_emit)
    return snapshot
