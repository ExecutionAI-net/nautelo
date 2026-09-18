"""Spec §19.3's write path. The single writer of ListingView and of
BoatListing.view_count_cached.

    1. Resolve viewer identity.                      -> analytics.policies
    2. INSERT ... ON CONFLICT DO UPDATE last_seen_at -> _insert_or_touch below
    3. Increment view_count_cached ONLY on insert.   -> _increment below
    4. Short transaction; do not delay rendering.    -> see the module notes
    5. Reconciliation task.                          -> analytics.tasks

On (2): Django's only supported way to emit a literal `ON CONFLICT DO UPDATE` is
`bulk_create(update_conflicts=True, ...)`, which does not report which rows were
inserted versus updated — and step 3 depends on exactly that distinction. The
"or equivalent" the spec allows is therefore a `create()` inside a savepoint with
the unique index's `IntegrityError` caught narrowly and converted into the
`UPDATE last_seen_at`. Same two outcomes, same guarantee under concurrency (the
unique index is what serialises the race in both designs), and it yields the
insert/update signal step 3 needs.

On (4): spec §19.3 says "do not delay page rendering **if an async durable event
pipeline already exists**". None does — `common/tasks.py` holds a single `ping`
task and there is no durable event outbox anywhere in this repository — so the
write happens in-request. It is one INSERT (or one UPDATE) on a unique index plus,
only on insertion, one single-column UPDATE by primary key. If a durable pipeline
is ever built, this function is the one place that moves behind it.

Errors are NOT swallowed. The IntegrityError raised by the unique index is an
expected outcome of two viewers racing and is handled precisely; anything else is
a fault and propagates to the standard spec §30.2 envelope, because an analytics
path that fails silently is an analytics path nobody ever fixes.
"""

from dataclasses import dataclass

from django.db import IntegrityError, transaction
from django.db.models import F, Value
from django.db.models.functions import Greatest
from django.utils import timezone

from listings.models import BoatListing
from platform_settings.services import is_feature_enabled

from .models import ListingView
from .policies import ViewerIdentity, resolve_viewer_identity

# Spec §35.1's flag list. §35.2 step 9 ("Enable finance and view counting") is
# when this goes on in production; analytics/migrations/0002 seeds it disabled.
UNIQUE_LISTING_VIEWS_FLAG = "unique_listing_views"


@dataclass(frozen=True)
class ViewRecordResult:
    """`counted` is True only when a NEW unique row was inserted — i.e. only when
    `view_count_cached` moved. Callers use it to decide whether to re-read."""

    counted: bool
    identity: ViewerIdentity | None


def _insert_or_touch(*, listing, identity: ViewerIdentity, now) -> bool:
    """Spec §19.3 step 2. Returns True when a new row was inserted.

    The savepoint is load-bearing, not decoration: an IntegrityError marks the
    surrounding transaction unusable in Postgres, so without `atomic()` here the
    UPDATE in the except branch would itself fail with InFailedSqlTransaction.
    This is the same shape `QuerySet.get_or_create()` uses internally.

    `first_viewed_at` and `last_seen_at` both receive the SAME captured `now`.
    Neither column auto-generates (see analytics/models.py): an `auto_now_add`
    `first_viewed_at` would be stamped after this `now` and every first insert
    would violate the `last_seen_at >= first_viewed_at` CHECK.
    """
    try:
        with transaction.atomic():
            ListingView.objects.create(
                listing=listing,
                viewer_type=identity.viewer_type,
                viewer_user=identity.viewer_user,
                viewer_hash=identity.viewer_hash,
                first_viewed_at=now,
                last_seen_at=now,
                user_agent_class=identity.user_agent_class,
            )
    except IntegrityError:
        # `IntegrityError` is the exception class for EVERY constraint on this
        # table, not just the unique indexes: a malformed hash, a viewer_type
        # that disagrees with the identity column, or a timestamp inversion all
        # raise it too. Only ONE of those is a legitimate, expected outcome — the
        # uniqueness race — and the difference is observable: if the row this
        # error implies already exists really does exist, the UPDATE below finds
        # it. When it matches zero rows, the IntegrityError was NOT a uniqueness
        # race, there is no row, and nothing was recorded. Swallowing that and
        # returning False would be exactly the silent, permanent undercount the
        # "recording failures are not swallowed" ruling forbids, so it is
        # re-raised with its original traceback.
        #
        # `Greatest`, not a bare assignment: `now` was captured BEFORE the INSERT
        # attempt, and the thread that won this race may have captured a LATER
        # `now` and still committed first — two web workers do not share a clock,
        # and an NTP correction moves one in either direction. Writing `now`
        # verbatim would then set `last_seen_at` earlier than this row's
        # `first_viewed_at` and violate
        # `analytics_view_last_seen_not_before_first_viewed`. That IntegrityError
        # comes from the UPDATE itself, so the handler below cannot recognise it
        # as a race and it would propagate — turning a lost race (spec §19's
        # acceptance test 5) into a 500 on a public listing GET. The clamp makes
        # the touch monotonic: recency only ever moves forward. The matched-row
        # count is unaffected, so it still serves as the existence probe.
        touched = ListingView.objects.filter(
            listing=listing, **identity.lookup()
        ).update(last_seen_at=Greatest(F("last_seen_at"), Value(now)))
        if not touched:
            raise
        return False
    return True


def _increment(listing) -> None:
    """Spec §19.3 step 3.

    QuerySet.update() writes exactly the named column: it does not fire
    `auto_now` on `updated_at` and it does not touch `version`. Both omissions
    are deliberate — a view is not an edit, and bumping `version` would give the
    seller a spurious `409 stale_version` (spec §20.5) for being browsed. This is
    also why the increment does not go through listings.locking.bump_version
    (Phase 11 contract rule 4 governs state-changing endpoints; this is not one).

    F() rather than a read-modify-write: two concurrent increments must both
    land, and only the database can guarantee that.
    """
    BoatListing.objects.filter(pk=listing.pk).update(
        view_count_cached=F("view_count_cached") + 1
    )


def record_listing_view(*, listing, request) -> ViewRecordResult:
    """Record one view of `listing` by whoever made `request`.

    Safe to call on every public detail read: it decides for itself whether the
    request counts (spec §19.1) and returns without writing when it does not.
    """
    # Spec §35.1: "Flags gate both frontend exposure and backend mutation." The
    # check is first so that a disabled feature costs one cached lookup and no
    # membership query.
    if not is_feature_enabled(UNIQUE_LISTING_VIEWS_FLAG, default=False):
        return ViewRecordResult(counted=False, identity=None)

    identity = resolve_viewer_identity(request=request, listing=listing)
    if identity is None:
        return ViewRecordResult(counted=False, identity=None)

    now = timezone.now()
    with transaction.atomic():
        inserted = _insert_or_touch(listing=listing, identity=identity, now=now)
        if inserted:
            _increment(listing)

    return ViewRecordResult(counted=inserted, identity=identity)
