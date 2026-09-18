"""Listing view analytics (NAUTA_PRODUCTION_IMPLEMENTATION_SPEC.md §11.7, §19).

PRIVACY (spec §19.4). This table is pseudonymous by construction and is the one
place in the project where a viewer's presence on a specific listing is durable:

  * No raw IP is stored, ever. `viewer_hash` is
    HMAC-SHA256(CONTACT_HASH_SECRET, canonical_client_ip) and is not reversible
    without the secret. Spec §11.7: "Do not store raw IP in `ListingView`."
  * No row from this table is ever serialized to any API response. Sellers see
    `BoatListing.view_count_cached` and nothing else — spec §19.4: "Never expose
    viewer identities to sellers; only aggregate count."
  * Row-level access is staff-administrator-only, through Django admin, read-only
    (see admin.py).
  * Rows are deleted with their listing (`listing` CASCADE) and with their viewer
    (`viewer_user` CASCADE). Otherwise they are retained for as long as the
    listing exists, because lifetime uniqueness is the whole point of the table
    — spec §19.4: "retain while necessary for lifetime uniqueness and document
    the purpose/retention". The written record of that purpose is
    `docs/privacy/listing-view-analytics.md`.

Spec §11.7 closes with the honest caveat this model is built under: "This is a
practical uniqueness control, not a perfect identity claim."
"""

from django.conf import settings
from django.db import models
from django.db.models import F, Q

from common.models import UUIDModel

from .enums import UserAgentClass, ViewerType

VIEWER_HASH_LENGTH = 64


class ListingView(UUIDModel):
    """One (listing, viewer) pair, created once and touched thereafter.

    Inherits UUIDModel rather than UUIDTimeStampedModel deliberately: spec §11.7
    names `first_viewed_at` and `last_seen_at`, and a `created_at`/`updated_at`
    pair beside them would be two more columns meaning the same two things (the
    same reasoning as audit.AuditEvent and listings.ListingSnapshot).
    """

    listing = models.ForeignKey(
        "listings.BoatListing", on_delete=models.CASCADE, related_name="views"
    )
    viewer_type = models.CharField(max_length=9, choices=ViewerType.choices)
    viewer_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="listing_views",
    )
    viewer_hash = models.CharField(
        max_length=VIEWER_HASH_LENGTH, null=True, blank=True, db_index=False
    )
    # NOT auto_now_add. auto_now_add stamps the row at the moment the INSERT
    # executes, which is strictly AFTER the `now` every caller captures before
    # building the row — so `last_seen_at` (that captured `now`) would be earlier
    # than `first_viewed_at` and the CHECK below would reject every first insert.
    # Both timestamps are therefore written explicitly, from one captured value.
    first_viewed_at = models.DateTimeField()
    # Written explicitly, never auto_now: the conflict path in
    # analytics.recording touches this column with QuerySet.update(), which does
    # not fire auto_now, and an auto_now field would additionally be rewritten by
    # any unrelated save().
    last_seen_at = models.DateTimeField()
    user_agent_class = models.CharField(
        max_length=7, choices=UserAgentClass.choices, default=UserAgentClass.UNKNOWN
    )

    class Meta:
        ordering = ["listing", "-last_seen_at"]
        indexes = [
            # The reconciliation task (spec §19.3 step 5) groups by listing.
            models.Index(fields=["listing", "first_viewed_at"]),
        ]
        constraints = [
            # Spec §11.7: "Unique `(listing, viewer_user)` where `viewer_user` is
            # not null." A partial index, because NULLs do not collide in
            # Postgres and an unconditional unique index would therefore permit
            # unlimited anonymous rows to share (listing, NULL).
            models.UniqueConstraint(
                fields=["listing", "viewer_user"],
                condition=Q(viewer_user__isnull=False),
                name="analytics_view_unique_user_per_listing",
            ),
            # Spec §11.7: "Unique `(listing, viewer_hash)` where `viewer_hash` is
            # not null."
            models.UniqueConstraint(
                fields=["listing", "viewer_hash"],
                condition=Q(viewer_hash__isnull=False),
                name="analytics_view_unique_hash_per_listing",
            ),
            # Spec §11.7: "Exactly one of viewer user and viewer hash is present."
            models.CheckConstraint(
                condition=(
                    Q(viewer_user__isnull=False, viewer_hash__isnull=True)
                    | Q(viewer_user__isnull=True, viewer_hash__isnull=False)
                ),
                name="analytics_view_exactly_one_identity",
            ),
            # viewer_type is a label for which identity column is populated. If
            # the two can disagree, every aggregate grouped by viewer_type is a
            # guess, so the database refuses the disagreement.
            models.CheckConstraint(
                condition=(
                    Q(viewer_type=ViewerType.USER, viewer_user__isnull=False)
                    | Q(viewer_type=ViewerType.ANONYMOUS, viewer_user__isnull=True)
                ),
                name="analytics_view_type_matches_identity",
            ),
            # One spelling per hash. Without this, "AB..." and "ab..." are two
            # rows for one viewer and the unique index above never fires.
            models.CheckConstraint(
                condition=Q(viewer_hash__isnull=True)
                | Q(viewer_hash__regex=r"^[0-9a-f]{64}$"),
                name="analytics_view_hash_is_lowercase_sha256_hex",
            ),
            models.CheckConstraint(
                condition=Q(last_seen_at__gte=F("first_viewed_at")),
                name="analytics_view_last_seen_not_before_first_viewed",
            ),
        ]

    def __str__(self):
        # Deliberately does not print viewer_hash in full: __str__ output reaches
        # logs, admin breadcrumbs and error pages.
        identity = (
            f"user:{self.viewer_user_id}"
            if self.viewer_user_id
            else f"anon:{(self.viewer_hash or '')[:12]}…"
        )
        return f"{self.listing_id} {identity}"
