"""Listing and revision state vocabulary (NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md §6.1, §6.2, §11.4, §11.5).

Values are copied verbatim from the spec and must never be renamed: they are
persisted in the database, returned in API responses and written into audit
events.
"""

from django.db import models


class ListingStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    PENDING_APPROVAL = "PENDING_APPROVAL", "Pending approval"
    PUBLISHED = "PUBLISHED", "Published"
    REJECTED = "REJECTED", "Rejected"
    SUSPENDED = "SUSPENDED", "Suspended"
    # Owner-initiated pause (customer feedback, 2026-09-25), distinct from
    # SUSPENDED: SUSPENDED is staff-only moderation and feeds the staff
    # console's "suspended" queue (spec 6.1, 36.4); PAUSED is the seller's own
    # action, never a moderation concern, and staff_queue.py must not surface it.
    PAUSED = "PAUSED", "Paused"
    EXPIRED = "EXPIRED", "Expired"
    ARCHIVED = "ARCHIVED", "Archived"


class RevisionStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    SUBMITTED = "SUBMITTED", "Submitted"
    APPROVED = "APPROVED", "Approved"
    CHANGES_REQUESTED = "CHANGES_REQUESTED", "Changes requested"
    REJECTED = "REJECTED", "Rejected"
    WITHDRAWN = "WITHDRAWN", "Withdrawn"


class RevisionOrigin(models.TextChoices):
    """Who authored a revision. A STAFF_CORRECTION revision may touch the fields
    that are immutable for the owner (spec §20.3)."""

    OWNER = "OWNER", "Owner"
    STAFF_CORRECTION = "STAFF_CORRECTION", "Staff correction"


class PublicationSource(models.TextChoices):
    FREE_ENTITLEMENT = "FREE_ENTITLEMENT", "Free entitlement"
    PAID_ENTITLEMENT = "PAID_ENTITLEMENT", "Paid entitlement"
    BROKER_POLICY = "BROKER_POLICY", "Broker policy"


class MediaType(models.TextChoices):
    IMAGE = "IMAGE", "Image"
    VIDEO = "VIDEO", "Video"


class MediaStatus(models.TextChoices):
    UPLOADING = "UPLOADING", "Uploading"
    SCANNING = "SCANNING", "Scanning"
    PROCESSING = "PROCESSING", "Processing"
    READY = "READY", "Ready"
    REJECTED = "REJECTED", "Rejected"


# Spec §6.1, read as a chain plus the two explicitly documented return paths.
# DRAFT -> PUBLISHED is reserved for Phase 12 broker auto-approval and is never
# taken in Phase 11, where policies.requires_staff_approval() always returns True.
LISTING_TRANSITIONS: dict[str, frozenset[str]] = {
    ListingStatus.DRAFT: frozenset(
        {ListingStatus.PENDING_APPROVAL, ListingStatus.PUBLISHED}
    ),
    ListingStatus.PENDING_APPROVAL: frozenset(
        {ListingStatus.PUBLISHED, ListingStatus.REJECTED, ListingStatus.DRAFT}
    ),
    ListingStatus.PUBLISHED: frozenset(
        {ListingStatus.SUSPENDED, ListingStatus.PAUSED, ListingStatus.EXPIRED}
    ),
    ListingStatus.REJECTED: frozenset({ListingStatus.DRAFT}),
    ListingStatus.SUSPENDED: frozenset(
        {ListingStatus.PUBLISHED, ListingStatus.ARCHIVED}
    ),
    # PAUSED <-> PUBLISHED is the seller's own pause/resume toggle
    # (customer feedback, 2026-09-25); not part of the original spec 6.1 chain.
    ListingStatus.PAUSED: frozenset({ListingStatus.PUBLISHED}),
    ListingStatus.EXPIRED: frozenset({ListingStatus.ARCHIVED}),
    ListingStatus.ARCHIVED: frozenset(),
}

# Spec §6.2. Every decided state is terminal *for the row*: §6.2's
# `CHANGES_REQUESTED -> DRAFT` edge is realised as the listing returning to
# DRAFT plus a fresh revision number, never as a decided row reverting to DRAFT
# (see the ruling in this task).
REVISION_TRANSITIONS: dict[str, frozenset[str]] = {
    RevisionStatus.DRAFT: frozenset({RevisionStatus.SUBMITTED}),
    RevisionStatus.SUBMITTED: frozenset(
        {
            RevisionStatus.APPROVED,
            RevisionStatus.CHANGES_REQUESTED,
            RevisionStatus.REJECTED,
            RevisionStatus.WITHDRAWN,
        }
    ),
    RevisionStatus.CHANGES_REQUESTED: frozenset(),
    RevisionStatus.APPROVED: frozenset(),
    RevisionStatus.REJECTED: frozenset(),
    RevisionStatus.WITHDRAWN: frozenset(),
}

# A listing may have at most one revision in these states (DB constraint, Task 4).
OPEN_REVISION_STATES: frozenset[str] = frozenset(
    {RevisionStatus.DRAFT, RevisionStatus.SUBMITTED}
)

# States that mean a moderator has ruled: decided_by/decided_at are mandatory.
DECIDED_REVISION_STATES: frozenset[str] = frozenset(
    {RevisionStatus.APPROVED, RevisionStatus.CHANGES_REQUESTED, RevisionStatus.REJECTED}
)

# Spec §26.2: "Request changes and reject require a user-visible reason."
NOTE_REQUIRED_REVISION_STATES: frozenset[str] = frozenset(
    {RevisionStatus.CHANGES_REQUESTED, RevisionStatus.REJECTED}
)


def can_transition_listing(current: str, target: str) -> bool:
    return target in LISTING_TRANSITIONS.get(current, frozenset())


def can_transition_revision(current: str, target: str) -> bool:
    return target in REVISION_TRANSITIONS.get(current, frozenset())
