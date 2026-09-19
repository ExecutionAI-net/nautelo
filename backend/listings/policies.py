"""Policy seams, and the entitlement gate.

  * ListingEntitlementGate    -> spec §22 (Phase 13) — IMPLEMENTED
  * requires_staff_approval   -> spec Phase 12 (§21, broker auto-approval) — stub
  * effective_media_allowance -> spec Phase 15 (§24, media upgrade tier) — IMPLEMENTED
"""

from dataclasses import dataclass

from accounts.enums import SellerType
from entitlements.consumption import ListingEntitlementRequired, consume_listing_right
from entitlements.eligibility import ListingEligibilityService
from entitlements.enums import EntitlementState, EntitlementType
from entitlements.models import UserEntitlement
from entitlements.policy import enforcement_enabled, free_publication_days
from platform_settings.services import get_setting_value

from .enums import ListingStatus, MediaType, PublicationSource
from .models import BoatListing, ListingMedia

__all__ = [
    "ConsumedRight",
    "ListingEntitlementGate",
    # Re-exported so listings.submissions has one import source for the gate.
    "ListingEntitlementRequired",
    "MediaAllowance",
    "effective_media_allowance",
    "is_media_upgraded",
    "media_counts",
    "requires_staff_approval",
]


@dataclass(frozen=True)
class MediaAllowance:
    images: int
    videos: int


@dataclass(frozen=True)
class ConsumedRight:
    """What a submission actually burned.

    `entitlement` is None for a broker listing, whose quota is unlimited
    (spec §1) and which therefore has no ledger row at all.
    """

    entitlement: object | None
    publication_source: str


# The only mapping between the ledger's vocabulary (spec §11.9) and the
# listing's (spec §11.4). It lives here rather than in `entitlements` so that
# app never has to import `listings`.
_PUBLICATION_SOURCE_BY_TYPE = {
    EntitlementType.FREE_LISTING: PublicationSource.FREE_ENTITLEMENT,
    EntitlementType.PAID_LISTING: PublicationSource.PAID_ENTITLEMENT,
}


class ListingEntitlementGate:
    """Spec §22.2's ListingEligibilityService, seen from the listing side.

    Phase 11 shipped this class as a stub with its call sites already in place;
    this is the promised replacement (Phase 11 contract rule 6).

    `listings.decisions` is untouched: it calls `publication_days(*, listing)`,
    whose signature and return type are unchanged. `listings.submissions` DOES
    change, because `consume()`'s return type goes from `str` to `ConsumedRight`
    — a deliberate, documented deviation from Phase 11's "the call sites do not
    change" wording. See the Contract summary.
    """

    @staticmethod
    def can_submit(*, user, broker=None) -> bool:
        """A cheap, UNLOCKED pre-check: "could this user start a NEW listing?"

        Not authoritative — `consume()` re-checks while holding the lock, which
        is what spec §22.2 means by "The last check is authoritative and
        prevents multiple-tab races". This exists so an obviously-blocked
        submission fails before any row is written.

        It deliberately keeps Phase 11's signature and therefore knows nothing
        about *which* listing is being submitted. That means it answers the
        wrong question for a resubmission or a post-publication edit, both of
        which must never be charged or refused. The CALL SITE is responsible for
        only consulting it when a right would actually be charged — see
        listings.submissions.submit_listing_revision.
        """
        if broker is not None:
            # Spec §1: "Broker listing quota: Unlimited."
            return True
        if not enforcement_enabled():
            return True
        return ListingEligibilityService.for_user(user).can_start_listing

    @staticmethod
    def consume(*, listing: BoatListing, user) -> ConsumedRight:
        """Burn one right for this listing, or raise ListingEntitlementRequired.

        MUST be called inside the caller's transaction with the listing row
        already locked — listings.submissions.submit_listing_revision does both.

        Note the two different people: `user` is the ACTOR performing the
        submission (a staff admin may submit on a seller's behalf), while the
        quota that is charged belongs to `listing.owner_user`. Charging the
        actor would let a staff admin burn their own allowance on someone
        else's boat.

        Three cases never reach the ledger at all:
          * a broker listing (spec §1, unlimited quota);
          * an already-published listing (spec §6.3 charges "initial approval"
            only, and spec §20.2's post-publication edit goes through this same
            function);
          * a listing that already carries a consumed right — handled one layer
            down by `consume_listing_right`'s own idempotent short-circuit
            (spec §22.1's correction loop).
        """
        if listing.seller_type == SellerType.BROKER:
            return ConsumedRight(
                entitlement=None, publication_source=PublicationSource.BROKER_POLICY
            )
        if listing.current_public_snapshot_id is not None:
            # Spec §6.3: "Consumption happens when the listing is submitted for
            # initial approval." A listing with a live public snapshot is past
            # that point, so every later submission is a revision of something
            # already paid for.
            #
            # This check — not `consumed_entitlement_id` — is what protects
            # legacy data. Phase 11's Known Limitation 1 records that
            # `consumed_entitlement_id` is ALWAYS NULL on every listing
            # published before this phase, so gating on that column alone would
            # charge a brand-new free right for the first edit of any
            # pre-Phase-13 listing in dev, staging or production.
            #
            # `publication_source` is whatever the listing already carries and is
            # not rewritten; on the non-initial path `submit_listing_revision`
            # does not pass it to `bump_version` at all.
            return ConsumedRight(
                entitlement=listing.consumed_entitlement,
                publication_source=listing.publication_source,
            )
        entitlement = consume_listing_right(
            user=listing.owner_user, listing=listing, actor=user
        )
        return ConsumedRight(
            entitlement=entitlement,
            publication_source=_PUBLICATION_SOURCE_BY_TYPE[
                entitlement.entitlement_type
            ],
        )

    @staticmethod
    def publication_days(*, listing: BoatListing) -> int | None:
        """How long an approved publication stays live.

        Read from the CONSUMED entitlement, not from the live setting: this is
        called by listings.decisions.approve_revision, which can run days after
        submission, and spec §36.3 requires that "Existing consumed entitlements
        preserve their recorded publication duration."

        A broker listing has no configured window in this release (spec §21), so
        this returns None and `expires_at` stays NULL. A private listing with no
        consumed entitlement (one published before the ledger existed) falls
        back to the current free setting rather than to no expiry at all.
        """
        if listing.seller_type == SellerType.BROKER:
            return None
        entitlement = listing.consumed_entitlement
        if entitlement is not None:
            recorded = entitlement.metadata.get("publication_days")
            if isinstance(recorded, int) and recorded > 0:
                return recorded
        return free_publication_days()


# Spec §21 rule 2: auto-approval "does not bypass validation, moderation,
# suspension, media limits or abuse controls". A listing outside the owner's
# ordinary edit loop always goes to a human, whatever the organization's policy
# says: SUSPENDED / EXPIRED / ARCHIVED are moderation outcomes, and
# PENDING_APPROVAL is a submission a moderator already owns (spec §21 rule 5 —
# enabling the policy must not retro-approve it). The set is deliberately
# identical to the one listings.drafts.update_listing_draft uses to decide who
# may open a new revision at all.
AUTO_APPROVABLE_LISTING_STATES: frozenset[str] = frozenset(
    {ListingStatus.DRAFT, ListingStatus.REJECTED, ListingStatus.PUBLISHED}
)


def requires_staff_approval(listing: BoatListing) -> bool:
    """Whether a submission must wait for a moderator (spec §21, §20.4, §6.1).

    Returns False in exactly one case: a broker listing, inside the ordinary
    edit loop, belonging to an ACTIVE organization whose staff-admin-enabled
    `auto_approve_listings` policy is on. Everything else still goes through
    moderation — every private seller, a broker listing with no organization
    row, an organization that is DRAFT/PENDING/SUSPENDED, and any listing state
    outside AUTO_APPROVABLE_LISTING_STATES.

    Read at submit time only, which is what makes spec §21 rules 5 and 6 true:
    the policy governs *future* submissions, so a revision already sitting in
    PENDING_APPROVAL is never retro-approved by enabling it, and a published
    listing is never unpublished by disabling it.

    `listing.broker` is dereferenced rather than imported: `listings` must never
    import `brokers` at module level — that arrow belongs to `brokers`, which
    imports `listings` for the staff screen. On a listing loaded without
    `select_related("broker")` this costs one query; `submit_listing_revision`
    selects it, and `ListingWorkflowSerializer` pays it once per broker listing
    it renders.
    """
    if listing.seller_type != SellerType.BROKER:
        return True
    if listing.status not in AUTO_APPROVABLE_LISTING_STATES:
        return True
    broker = listing.broker
    if broker is None or not broker.is_active:
        return True
    return not broker.auto_approve_listings


def effective_media_allowance(listing: BoatListing) -> MediaAllowance:
    """Total images/videos permitted on this listing (spec §24.1 — totals, not
    increments).

    A private seller gets the upgraded tier (20 images / 1 video, spec §24.1) once
    a MEDIA_UPGRADE entitlement bound to THIS listing has been CONSUMED. A merely
    AVAILABLE one grants nothing: spec §24.4 requires the owner to apply it
    explicitly.
    """
    if listing.seller_type == SellerType.BROKER:
        return MediaAllowance(
            images=int(get_setting_value("media.broker_image_limit")),
            videos=int(get_setting_value("media.broker_video_limit")),
        )
    if is_media_upgraded(listing):
        return MediaAllowance(
            images=int(get_setting_value("media.upgraded_image_limit")),
            videos=int(get_setting_value("media.upgraded_video_limit")),
        )
    return MediaAllowance(
        images=int(get_setting_value("media.private_base_image_limit")),
        videos=int(get_setting_value("media.private_base_video_limit")),
    )


def is_media_upgraded(listing: BoatListing) -> bool:
    return UserEntitlement.objects.filter(
        listing=listing,
        entitlement_type=EntitlementType.MEDIA_UPGRADE,
        state=EntitlementState.CONSUMED,
    ).exists()


def media_counts(listing: BoatListing) -> tuple[int, int]:
    """(images, videos) among all NON-REJECTED media rows.

    Spec §11.5: "Media count limits include all non-rejected items to prevent
    concurrent upload bypasses."
    """
    rows = ListingMedia.objects.non_rejected().filter(listing=listing)
    images = rows.filter(media_type=MediaType.IMAGE).count()
    videos = rows.filter(media_type=MediaType.VIDEO).count()
    return images, videos
