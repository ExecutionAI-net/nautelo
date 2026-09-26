from listings.enums import (
    DECIDED_REVISION_STATES,
    LISTING_TRANSITIONS,
    NOTE_REQUIRED_REVISION_STATES,
    OPEN_REVISION_STATES,
    REVISION_TRANSITIONS,
    ListingStatus,
    MediaStatus,
    MediaType,
    PublicationSource,
    RevisionOrigin,
    RevisionStatus,
    can_transition_listing,
    can_transition_revision,
)


def test_listing_status_values_match_the_spec():
    assert [choice.value for choice in ListingStatus] == [
        "DRAFT",
        "PENDING_APPROVAL",
        "PUBLISHED",
        "REJECTED",
        "SUSPENDED",
        "PAUSED",
        "EXPIRED",
        "ARCHIVED",
    ]


def test_revision_status_values_match_the_spec():
    assert [choice.value for choice in RevisionStatus] == [
        "DRAFT",
        "SUBMITTED",
        "APPROVED",
        "CHANGES_REQUESTED",
        "REJECTED",
        "WITHDRAWN",
    ]


def test_publication_source_and_media_enums_match_the_spec():
    assert [choice.value for choice in PublicationSource] == [
        "FREE_ENTITLEMENT",
        "PAID_ENTITLEMENT",
        "BROKER_POLICY",
    ]
    assert [choice.value for choice in MediaType] == ["IMAGE", "VIDEO"]
    assert [choice.value for choice in MediaStatus] == [
        "UPLOADING",
        "SCANNING",
        "PROCESSING",
        "READY",
        "REJECTED",
    ]
    assert [choice.value for choice in RevisionOrigin] == ["OWNER", "STAFF_CORRECTION"]


def test_listing_transition_map_covers_every_status_exactly_once():
    assert set(LISTING_TRANSITIONS) == {choice.value for choice in ListingStatus}


def test_sanctioned_listing_transitions_are_allowed():
    assert can_transition_listing(ListingStatus.DRAFT, ListingStatus.PENDING_APPROVAL)
    assert can_transition_listing(ListingStatus.PENDING_APPROVAL, ListingStatus.PUBLISHED)
    assert can_transition_listing(ListingStatus.PENDING_APPROVAL, ListingStatus.REJECTED)
    assert can_transition_listing(ListingStatus.PENDING_APPROVAL, ListingStatus.DRAFT)
    assert can_transition_listing(ListingStatus.REJECTED, ListingStatus.DRAFT)
    assert can_transition_listing(ListingStatus.PUBLISHED, ListingStatus.SUSPENDED)
    assert can_transition_listing(ListingStatus.SUSPENDED, ListingStatus.PUBLISHED)
    assert can_transition_listing(ListingStatus.SUSPENDED, ListingStatus.ARCHIVED)
    assert can_transition_listing(ListingStatus.PUBLISHED, ListingStatus.PAUSED)
    assert can_transition_listing(ListingStatus.PAUSED, ListingStatus.PUBLISHED)
    assert can_transition_listing(ListingStatus.PUBLISHED, ListingStatus.EXPIRED)
    assert can_transition_listing(ListingStatus.EXPIRED, ListingStatus.ARCHIVED)
    # Reserved for Phase 12 broker auto-approval; unreachable in Phase 11.
    assert can_transition_listing(ListingStatus.DRAFT, ListingStatus.PUBLISHED)


def test_unsanctioned_listing_transitions_are_refused():
    assert not can_transition_listing(ListingStatus.DRAFT, ListingStatus.EXPIRED)
    assert not can_transition_listing(ListingStatus.DRAFT, ListingStatus.ARCHIVED)
    assert not can_transition_listing(ListingStatus.ARCHIVED, ListingStatus.PUBLISHED)
    assert not can_transition_listing(ListingStatus.EXPIRED, ListingStatus.PUBLISHED)
    assert not can_transition_listing(ListingStatus.PUBLISHED, ListingStatus.DRAFT)
    assert not can_transition_listing(ListingStatus.PAUSED, ListingStatus.ARCHIVED)


def test_revision_transitions_follow_spec_6_2():
    assert can_transition_revision(RevisionStatus.DRAFT, RevisionStatus.SUBMITTED)
    assert can_transition_revision(RevisionStatus.SUBMITTED, RevisionStatus.APPROVED)
    assert can_transition_revision(RevisionStatus.SUBMITTED, RevisionStatus.CHANGES_REQUESTED)
    assert can_transition_revision(RevisionStatus.SUBMITTED, RevisionStatus.REJECTED)
    assert can_transition_revision(RevisionStatus.SUBMITTED, RevisionStatus.WITHDRAWN)
    # §6.2's `CHANGES_REQUESTED -> DRAFT` is a *listing*-level return (asserted
    # as PENDING_APPROVAL -> DRAFT in test_sanctioned_listing_transitions_are_allowed
    # above), not a revision-row one: a decided row never reverts, the seller's
    # next edit opens the next revision number. See the ruling in this task.
    assert not can_transition_revision(
        RevisionStatus.CHANGES_REQUESTED, RevisionStatus.DRAFT
    )
    assert not can_transition_revision(RevisionStatus.APPROVED, RevisionStatus.DRAFT)
    assert not can_transition_revision(RevisionStatus.REJECTED, RevisionStatus.SUBMITTED)
    assert not can_transition_revision(RevisionStatus.WITHDRAWN, RevisionStatus.SUBMITTED)
    assert not can_transition_revision(RevisionStatus.DRAFT, RevisionStatus.APPROVED)


def test_revision_state_groupings():
    assert OPEN_REVISION_STATES == frozenset({"DRAFT", "SUBMITTED"})
    assert DECIDED_REVISION_STATES == frozenset(
        {"APPROVED", "CHANGES_REQUESTED", "REJECTED"}
    )
    assert NOTE_REQUIRED_REVISION_STATES == frozenset({"CHANGES_REQUESTED", "REJECTED"})
