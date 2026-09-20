"""Spec §19.3's write path, step by step.

"The count must not increment on refresh, repeated API fetch or a second browser
using the same anonymous IP" is the sentence this file exists to prove, and it is
proved for both identity kinds and under a simulated race.
"""

from datetime import timedelta

import pytest
from django.contrib.auth.models import AnonymousUser
from django.db import IntegrityError
from django.utils import timezone
from rest_framework.test import APIRequestFactory

from accounts.enums import UserRole
from accounts.tests.factories import make_user
from analytics.enums import UserAgentClass, ViewerType
from analytics.models import ListingView
from analytics.policies import ViewerIdentity, resolve_viewer_identity
from analytics.recording import record_listing_view
from common.ip import hash_client_ip
from listings.enums import ListingStatus
from listings.models import BoatListing
from listings.tests.factories import make_private_listing, make_snapshot

pytestmark = pytest.mark.django_db

CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/141.0.0.0 Safari/537.36"


@pytest.fixture
def factory():
    return APIRequestFactory()


@pytest.fixture
def listing(db):
    owner = make_user("owner@example.com", role=UserRole.PRIVATE_SELLER)
    listing = make_private_listing(owner=owner)
    snapshot = make_snapshot(listing, approved_by=owner)
    listing.status = ListingStatus.PUBLISHED
    listing.current_public_snapshot = snapshot
    listing.save(update_fields=["status", "current_public_snapshot", "updated_at"])
    return listing


def _request(factory, *, user=None, remote_addr="198.51.100.9", user_agent=CHROME, **extra):
    request = factory.get(
        "/api/v1/listings/x/", REMOTE_ADDR=remote_addr, HTTP_USER_AGENT=user_agent, **extra
    )
    request.user = user if user is not None else AnonymousUser()
    return request


def _count(listing):
    return BoatListing.objects.values_list("view_count_cached", flat=True).get(
        pk=listing.pk
    )


def test_the_first_eligible_anonymous_view_creates_a_row_and_increments(
    factory, listing, view_counting_enabled, settings
):
    settings.TRUSTED_PROXY_COUNT = 0

    result = record_listing_view(listing=listing, request=_request(factory))

    assert result.counted is True
    assert _count(listing) == 1
    view = ListingView.objects.get()
    assert view.listing_id == listing.pk
    assert view.viewer_type == ViewerType.ANONYMOUS
    assert view.viewer_hash == hash_client_ip("198.51.100.9")
    assert view.user_agent_class == UserAgentClass.HUMAN


def test_the_first_view_stamps_both_timestamps_from_one_captured_now(
    factory, listing, view_counting_enabled, settings
):
    """Spec §11.7's `last_seen_at >= first_viewed_at` CHECK holds at the boundary:
    on an insert the two are the SAME instant, not two clock reads."""
    settings.TRUSTED_PROXY_COUNT = 0

    record_listing_view(listing=listing, request=_request(factory))

    view = ListingView.objects.get()
    assert view.last_seen_at == view.first_viewed_at


def test_a_refresh_from_the_same_address_touches_last_seen_and_does_not_increment(
    factory, listing, view_counting_enabled, settings
):
    settings.TRUSTED_PROXY_COUNT = 0
    record_listing_view(listing=listing, request=_request(factory))
    first = ListingView.objects.get()

    result = record_listing_view(listing=listing, request=_request(factory))

    assert result.counted is False
    assert ListingView.objects.count() == 1
    assert _count(listing) == 1
    refreshed = ListingView.objects.get()
    assert refreshed.pk == first.pk
    assert refreshed.first_viewed_at == first.first_viewed_at
    assert refreshed.last_seen_at > first.last_seen_at


def test_a_refresh_by_the_same_authenticated_user_touches_and_does_not_increment(
    factory, listing, view_counting_enabled
):
    """The user-identity branch of the conflict path: `ViewerIdentity.lookup()`
    must key on `viewer_user`, not on the (NULL) hash, or the touch matches
    nothing and the race handler re-raises."""
    buyer = make_user("buyer@example.com", role=UserRole.PRIVATE_SELLER)
    record_listing_view(listing=listing, request=_request(factory, user=buyer))
    first = ListingView.objects.get()

    result = record_listing_view(listing=listing, request=_request(factory, user=buyer))

    assert result.counted is False
    assert ListingView.objects.count() == 1
    assert _count(listing) == 1
    refreshed = ListingView.objects.get()
    assert refreshed.pk == first.pk
    assert refreshed.first_viewed_at == first.first_viewed_at
    assert refreshed.last_seen_at > first.last_seen_at


def test_a_touch_moves_only_that_users_row(factory, listing, view_counting_enabled):
    """`ViewerIdentity.lookup()` narrows to ONE viewer. A lookup that keyed on the
    empty column instead (`viewer_hash IS NULL`, true of every authenticated row)
    would still find *a* row to touch — this listing's other viewers' — and quietly
    rewrite their recency.
    """
    first = make_user("buyer-one@example.com", role=UserRole.PRIVATE_SELLER)
    second = make_user("buyer-two@example.com", role=UserRole.PRIVATE_SELLER)
    record_listing_view(listing=listing, request=_request(factory, user=first))
    record_listing_view(listing=listing, request=_request(factory, user=second))
    untouched_before = ListingView.objects.get(viewer_user=second).last_seen_at

    record_listing_view(listing=listing, request=_request(factory, user=first))

    assert ListingView.objects.get(viewer_user=second).last_seen_at == untouched_before


def test_a_touch_moves_only_that_addresss_row(
    factory, listing, view_counting_enabled, settings
):
    """The anonymous half of the same rule: `viewer_user IS NULL` is true of every
    anonymous row on the listing, so it is not an identity."""
    settings.TRUSTED_PROXY_COUNT = 0
    record_listing_view(listing=listing, request=_request(factory, remote_addr="198.51.100.9"))
    record_listing_view(listing=listing, request=_request(factory, remote_addr="203.0.113.5"))
    other_hash = hash_client_ip("203.0.113.5")
    untouched_before = ListingView.objects.get(viewer_hash=other_hash).last_seen_at

    record_listing_view(listing=listing, request=_request(factory, remote_addr="198.51.100.9"))

    assert ListingView.objects.get(viewer_hash=other_hash).last_seen_at == untouched_before


def test_a_second_browser_on_the_same_address_does_not_increment(
    factory, listing, view_counting_enabled, settings
):
    """Spec §19.3, verbatim: "...or a second browser using the same anonymous IP."
    Spec §19.2 accepts this: "A household sharing an IP may count as one
    anonymous viewer." """
    settings.TRUSTED_PROXY_COUNT = 0
    record_listing_view(listing=listing, request=_request(factory, user_agent=CHROME))

    record_listing_view(
        listing=listing,
        request=_request(factory, user_agent="Mozilla/5.0 Firefox/130.0"),
    )

    assert ListingView.objects.count() == 1
    assert _count(listing) == 1


def test_a_different_address_is_a_different_viewer(
    factory, listing, view_counting_enabled, settings
):
    settings.TRUSTED_PROXY_COUNT = 0
    record_listing_view(listing=listing, request=_request(factory, remote_addr="198.51.100.9"))
    record_listing_view(listing=listing, request=_request(factory, remote_addr="203.0.113.5"))

    assert ListingView.objects.count() == 2
    assert _count(listing) == 2


def test_two_authenticated_viewers_count_as_two(factory, listing, view_counting_enabled):
    """Spec §19's acceptance test 3."""
    first = make_user("buyer-one@example.com", role=UserRole.PRIVATE_SELLER)
    second = make_user("buyer-two@example.com", role=UserRole.PRIVATE_SELLER)

    record_listing_view(listing=listing, request=_request(factory, user=first))
    record_listing_view(listing=listing, request=_request(factory, user=second))
    # ...and each of them refreshing changes nothing.
    record_listing_view(listing=listing, request=_request(factory, user=first))
    record_listing_view(listing=listing, request=_request(factory, user=second))

    assert ListingView.objects.count() == 2
    assert _count(listing) == 2


def test_the_same_person_anonymously_then_signed_in_counts_twice_by_design(
    factory, listing, view_counting_enabled, settings
):
    """Spec §19.2: "If an anonymous viewer later logs in, the authenticated
    identity may count separately; do not attempt risky probabilistic identity
    merging." This is the documented behaviour, not an accident."""
    settings.TRUSTED_PROXY_COUNT = 0
    buyer = make_user("buyer@example.com", role=UserRole.PRIVATE_SELLER)

    record_listing_view(listing=listing, request=_request(factory))
    record_listing_view(listing=listing, request=_request(factory, user=buyer))

    assert _count(listing) == 2
    assert set(ListingView.objects.values_list("viewer_type", flat=True)) == {
        ViewerType.ANONYMOUS,
        ViewerType.USER,
    }


def test_an_ineligible_request_writes_nothing_at_all(factory, listing, view_counting_enabled):
    result = record_listing_view(
        listing=listing, request=_request(factory, user=listing.owner_user)
    )

    assert result.counted is False
    assert result.identity is None
    assert ListingView.objects.count() == 0
    assert _count(listing) == 0


def test_a_staff_viewer_writes_nothing(factory, listing, view_counting_enabled):
    """Spec §19.1: "Viewer is staff." The recorder must honour every refusal
    `analytics.policies` makes, not only the owner one above."""
    staff = make_user("staff@example.com", role=UserRole.STAFF)

    result = record_listing_view(listing=listing, request=_request(factory, user=staff))

    assert result.counted is False
    assert result.identity is None
    assert ListingView.objects.count() == 0
    assert _count(listing) == 0


def test_a_bot_user_agent_writes_nothing(factory, listing, view_counting_enabled, settings):
    """Spec §19.1: "known verified bots" are excluded."""
    settings.TRUSTED_PROXY_COUNT = 0

    result = record_listing_view(
        listing=listing,
        request=_request(factory, user_agent="Mozilla/5.0 (compatible; Googlebot/2.1)"),
    )

    assert result.counted is False
    assert ListingView.objects.count() == 0
    assert _count(listing) == 0


def test_a_prefetch_writes_nothing(factory, listing, view_counting_enabled, settings):
    """Spec §19.1: "prefetch/prerender"."""
    settings.TRUSTED_PROXY_COUNT = 0

    result = record_listing_view(
        listing=listing, request=_request(factory, HTTP_SEC_PURPOSE="prefetch;prerender")
    )

    assert result.counted is False
    assert ListingView.objects.count() == 0
    assert _count(listing) == 0


def test_a_non_get_writes_nothing(factory, listing, view_counting_enabled, settings):
    """Spec §19.1 counts "a successful human GET" and nothing else."""
    settings.TRUSTED_PROXY_COUNT = 0
    request = factory.post(
        "/api/v1/listings/x/", REMOTE_ADDR="198.51.100.9", HTTP_USER_AGENT=CHROME
    )
    request.user = AnonymousUser()

    result = record_listing_view(listing=listing, request=request)

    assert result.counted is False
    assert ListingView.objects.count() == 0
    assert _count(listing) == 0


def test_an_unpublished_listing_writes_nothing(
    factory, listing, view_counting_enabled, settings
):
    """Spec §19.1: "Listing is not published." Restated here because the recorder
    is callable from anywhere, not only from the public detail view."""
    settings.TRUSTED_PROXY_COUNT = 0
    listing.status = ListingStatus.SUSPENDED
    listing.save(update_fields=["status", "updated_at"])

    result = record_listing_view(listing=listing, request=_request(factory))

    assert result.counted is False
    assert ListingView.objects.count() == 0
    assert _count(listing) == 0


def test_a_request_with_no_trustworthy_address_writes_nothing(
    factory, listing, view_counting_enabled, settings
):
    """Spec §19.2: no address means no uniqueness control, so no row at all —
    counting it would mint a fresh "viewer" on every request."""
    settings.TRUSTED_PROXY_COUNT = 0

    result = record_listing_view(
        listing=listing, request=_request(factory, remote_addr="")
    )

    assert result.counted is False
    assert result.identity is None
    assert ListingView.objects.count() == 0
    assert _count(listing) == 0


def test_nothing_is_written_while_the_feature_flag_is_off(factory, listing, settings):
    """Spec §35.1: "Flags gate both frontend exposure and backend mutation."
    No `view_counting_enabled` fixture here — the flag ships disabled."""
    settings.TRUSTED_PROXY_COUNT = 0

    result = record_listing_view(listing=listing, request=_request(factory))

    assert result.counted is False
    assert result.identity is None
    assert ListingView.objects.count() == 0
    assert _count(listing) == 0


def test_the_flag_is_read_before_the_identity_is_resolved(
    factory, listing, settings, monkeypatch
):
    """With the flag off the recorder does no work at all — it does not even ask
    who the viewer is. Mutation-proof for "check the flag first": moving the flag
    check below `resolve_viewer_identity` trips this.
    """
    settings.TRUSTED_PROXY_COUNT = 0
    from analytics import recording

    def _forbidden(**kwargs):  # pragma: no cover - the assertion is that it is unused
        raise AssertionError("identity must not be resolved while the flag is off")

    monkeypatch.setattr(recording, "resolve_viewer_identity", _forbidden)

    assert record_listing_view(listing=listing, request=_request(factory)).counted is False


def test_a_concurrent_duplicate_yields_one_row_and_one_increment(
    factory, listing, view_counting_enabled, settings
):
    """Spec §19's acceptance test 5, realised deterministically.

    Two real DB connections racing inside pytest-django is fragile and would end
    up proving Postgres' unique index rather than this function's handling of it
    (the same reasoning Phase 11's Task 15 recorded for §34.2). The equivalent
    that exercises the exact branch: the row the loser is about to create already
    exists by the time its INSERT lands, which is what the winner's commit does
    to it. The loser must touch, not raise, and must not increment.
    """
    settings.TRUSTED_PROXY_COUNT = 0
    request = _request(factory)
    identity = resolve_viewer_identity(request=request, listing=listing)
    # The "winner": the row is in place before the loser's call runs.
    now = timezone.now()
    ListingView.objects.create(
        listing=listing,
        viewer_type=identity.viewer_type,
        viewer_user=identity.viewer_user,
        viewer_hash=identity.viewer_hash,
        first_viewed_at=now,
        last_seen_at=now,
        user_agent_class=identity.user_agent_class,
    )
    BoatListing.objects.filter(pk=listing.pk).update(view_count_cached=1)

    result = record_listing_view(listing=listing, request=request)

    assert result.counted is False
    assert ListingView.objects.count() == 1
    assert _count(listing) == 1


def test_the_loser_of_a_race_still_touches_last_seen_at(
    factory, listing, view_counting_enabled, settings
):
    """The conflict path is an "insert-or-touch", not an "insert-or-give-up":
    dropping the UPDATE would leave `last_seen_at` frozen at the winner's value
    and every §19.3 step-5 reconciliation reading of recency would be wrong.
    """
    settings.TRUSTED_PROXY_COUNT = 0
    request = _request(factory)
    identity = resolve_viewer_identity(request=request, listing=listing)
    stamped = timezone.now()
    winner = ListingView.objects.create(
        listing=listing,
        viewer_type=identity.viewer_type,
        viewer_user=identity.viewer_user,
        viewer_hash=identity.viewer_hash,
        first_viewed_at=stamped,
        last_seen_at=stamped,
        user_agent_class=identity.user_agent_class,
    )

    record_listing_view(listing=listing, request=request)

    refreshed = ListingView.objects.get(pk=winner.pk)
    assert refreshed.last_seen_at > stamped
    assert refreshed.first_viewed_at == stamped


def test_a_race_loser_with_a_lagging_clock_touches_without_moving_time_backwards(
    factory, listing, view_counting_enabled, settings
):
    """Clock skew must not turn a lost race into a 500 on a public listing GET.

    `record_listing_view` captures `now` BEFORE attempting the INSERT. Under a
    real race the winner may capture a LATER `now` and still commit first — two
    web workers' clocks are not the same clock, and NTP corrections move them in
    both directions. The loser then arrives with an OLDER `now`, and a fallback
    that wrote `last_seen_at = now` verbatim would set `last_seen_at` earlier than
    the row's `first_viewed_at`, violating
    `analytics_view_last_seen_not_before_first_viewed`. That IntegrityError is
    raised by the UPDATE itself, so it is not a uniqueness race the handler can
    recognise: it propagates, and spec §19's acceptance test 5 scenario becomes a
    500 on the listing detail page.

    The winner here is stamped five seconds into the future relative to the
    `now` the recorder is about to capture, which is exactly that situation.
    `Greatest(last_seen_at, now)` makes the touch monotonic: it never rewinds.
    """
    settings.TRUSTED_PROXY_COUNT = 0
    request = _request(factory)
    identity = resolve_viewer_identity(request=request, listing=listing)
    ahead = timezone.now() + timedelta(seconds=5)
    winner = ListingView.objects.create(
        listing=listing,
        viewer_type=identity.viewer_type,
        viewer_user=identity.viewer_user,
        viewer_hash=identity.viewer_hash,
        first_viewed_at=ahead,
        last_seen_at=ahead,
        user_agent_class=identity.user_agent_class,
    )
    BoatListing.objects.filter(pk=listing.pk).update(view_count_cached=1)

    result = record_listing_view(listing=listing, request=request)

    assert result.counted is False
    assert ListingView.objects.count() == 1
    assert _count(listing) == 1
    refreshed = ListingView.objects.get(pk=winner.pk)
    assert refreshed.last_seen_at == ahead  # held, not rewound
    assert refreshed.last_seen_at >= refreshed.first_viewed_at

    # ...and the clamp is a floor, not a freeze: once the row is genuinely in the
    # past again, the next touch moves it FORWARD as normal.
    behind = timezone.now() - timedelta(seconds=5)
    ListingView.objects.filter(pk=winner.pk).update(
        first_viewed_at=behind, last_seen_at=behind
    )

    record_listing_view(listing=listing, request=request)

    assert ListingView.objects.get(pk=winner.pk).last_seen_at > behind


def test_a_non_uniqueness_integrity_error_propagates_instead_of_being_swallowed(
    factory, listing, view_counting_enabled, settings, monkeypatch
):
    """The `except IntegrityError` branch must not absorb real bugs.

    Every constraint on ListingView raises IntegrityError, not just the unique
    indexes. Here the hash-format constraint is violated (uppercase hex), which
    is a bug in the caller, not a race: no row exists, so the fallback UPDATE
    matches nothing. The function must re-raise rather than report "already
    counted, nothing to do" — spec §39 and the plan's "recording failures are not
    swallowed" ruling. Without the affected-row check this test fails by
    returning ViewRecordResult(counted=False) with an empty table.
    """
    settings.TRUSTED_PROXY_COUNT = 0
    from analytics import recording

    broken = ViewerIdentity(
        viewer_type=ViewerType.ANONYMOUS,
        viewer_user=None,
        viewer_hash="A" * 64,  # uppercase: rejected by the hash-format CHECK
        user_agent_class=UserAgentClass.HUMAN,
    )
    monkeypatch.setattr(
        recording, "resolve_viewer_identity", lambda **kwargs: broken
    )

    with pytest.raises(IntegrityError):
        record_listing_view(listing=listing, request=_request(factory))

    assert ListingView.objects.count() == 0
    assert _count(listing) == 0


def test_the_increment_does_not_bump_the_optimistic_locking_version_or_updated_at(
    factory, listing, view_counting_enabled, settings
):
    """A view is not an edit. Bumping `version` would hand the seller a spurious
    409 stale_version (spec §20.5) for merely being browsed, and touching
    `updated_at` would forge an edit timestamp."""
    settings.TRUSTED_PROXY_COUNT = 0
    before = BoatListing.objects.values("version", "updated_at").get(pk=listing.pk)

    record_listing_view(listing=listing, request=_request(factory))

    after = BoatListing.objects.values("version", "updated_at").get(pk=listing.pk)
    assert after == before
    assert _count(listing) == 1


def test_the_increment_is_relative_to_the_stored_count_not_the_in_memory_copy(
    factory, listing, view_counting_enabled, settings
):
    """Spec §19.3 step 3 with an F() expression. The in-memory `listing` still
    carries `view_count_cached == 0`, so a read-modify-write would store 1 and
    silently discard the 41 views another process already recorded.
    """
    settings.TRUSTED_PROXY_COUNT = 0
    BoatListing.objects.filter(pk=listing.pk).update(view_count_cached=41)
    assert listing.view_count_cached == 0  # the stale copy the caller holds

    record_listing_view(listing=listing, request=_request(factory))

    assert _count(listing) == 42


def test_views_of_one_listing_do_not_affect_another(
    factory, listing, view_counting_enabled, settings
):
    settings.TRUSTED_PROXY_COUNT = 0
    other_owner = make_user("owner-two@example.com", role=UserRole.PRIVATE_SELLER)
    other = make_private_listing(owner=other_owner)
    other.status = ListingStatus.PUBLISHED
    other.current_public_snapshot = make_snapshot(other, approved_by=other_owner)
    other.save(update_fields=["status", "current_public_snapshot", "updated_at"])

    record_listing_view(listing=listing, request=_request(factory))

    assert _count(listing) == 1
    assert _count(other) == 0


def test_the_same_viewer_on_two_listings_counts_on_each(
    factory, listing, view_counting_enabled, settings
):
    """Uniqueness is per (listing, viewer), not per viewer: the partial unique
    indexes include `listing`, and so must the conflict-path lookup."""
    settings.TRUSTED_PROXY_COUNT = 0
    other_owner = make_user("owner-three@example.com", role=UserRole.PRIVATE_SELLER)
    other = make_private_listing(owner=other_owner)
    other.status = ListingStatus.PUBLISHED
    other.current_public_snapshot = make_snapshot(other, approved_by=other_owner)
    other.save(update_fields=["status", "current_public_snapshot", "updated_at"])

    first = record_listing_view(listing=listing, request=_request(factory))
    second = record_listing_view(listing=other, request=_request(factory))

    assert (first.counted, second.counted) == (True, True)
    assert ListingView.objects.count() == 2
    assert _count(listing) == 1
    assert _count(other) == 1

    # ...and a refresh on one listing leaves the other listing's row alone: the
    # conflict-path UPDATE is scoped by `listing`, not by the viewer alone.
    other_before = ListingView.objects.get(listing=other).last_seen_at
    record_listing_view(listing=listing, request=_request(factory))
    assert ListingView.objects.get(listing=other).last_seen_at == other_before


def test_the_result_carries_the_resolved_identity(
    factory, listing, view_counting_enabled, settings
):
    """`ViewRecordResult.identity` is part of the published interface: Task 5's
    caller reads it, so it must be the real identity and not None."""
    settings.TRUSTED_PROXY_COUNT = 0

    result = record_listing_view(listing=listing, request=_request(factory))

    assert result.identity is not None
    assert result.identity.viewer_type == ViewerType.ANONYMOUS
    assert result.identity.viewer_hash == hash_client_ip("198.51.100.9")
