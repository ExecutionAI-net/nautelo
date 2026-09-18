"""Spec §22.1's rolling free-allowance window and §36.3's edge cases."""

from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from django.utils import timezone

from entitlements.enums import EntitlementSource, EntitlementState, EntitlementType
from entitlements.models import UserEntitlement
from entitlements.policy import (
    FreeQuotaState,
    available_paid_rights,
    enforcement_enabled,
    free_listing_count,
    free_period_days,
    free_publication_days,
    free_quota_state,
    paid_publication_days,
    paid_validity_days,
)
from entitlements.tests.factories import make_entitlement, make_private_seller
from platform_settings.services import update_setting


def _consumed_free(user, *, when, **extra):
    return make_entitlement(
        user=user,
        entitlement_type=EntitlementType.FREE_LISTING,
        source=EntitlementSource.FREE_POLICY,
        state=EntitlementState.CONSUMED,
        valid_from=when,
        valid_until=when + timedelta(days=365),
        consumed_at=when,
        **extra,
    )


@pytest.mark.django_db
def test_a_brand_new_user_has_the_free_right_available():
    state = free_quota_state(make_private_seller())
    assert state.available is True
    assert state.used_at is None
    assert state.next_available_at is None
    assert state.allowance == 1
    assert state.used_in_period == 0
    assert state.publication_days == 30


@pytest.mark.django_db
def test_one_consumption_inside_the_window_exhausts_the_allowance():
    user = make_private_seller()
    now = timezone.now()
    used = now - timedelta(days=100)
    _consumed_free(user, when=used)

    state = free_quota_state(user, now=now)

    assert state.available is False
    assert state.used_at == used
    assert state.next_available_at == used + timedelta(days=365)
    assert state.used_in_period == 1


@pytest.mark.django_db
def test_a_consumption_older_than_the_period_no_longer_blocks():
    """Spec §22.1: "When 365 days have elapsed since the last free consumption,
    the user becomes eligible for a new free entitlement"."""
    user = make_private_seller()
    now = timezone.now()
    _consumed_free(user, when=now - timedelta(days=366))

    state = free_quota_state(user, now=now)

    assert state.available is True
    assert state.next_available_at is None
    assert state.used_in_period == 0
    # The historical use is still reported, because spec §22.2's `used_at`
    # is the ledger fact, not the window calculation.
    assert state.used_at is not None


@pytest.mark.django_db
def test_a_revoked_consumption_frees_the_window_again():
    """Spec §22.1: the right "remains consumed unless staff explicitly restores
    it with an audited remedy" — a restore revokes the row (spec §6.3)."""
    user = make_private_seller()
    now = timezone.now()
    row = _consumed_free(user, when=now - timedelta(days=10))
    row.state = EntitlementState.REVOKED
    row.revoked_at = now
    row.save(update_fields=["state", "revoked_at", "updated_at"])

    state = free_quota_state(user, now=now)

    assert state.available is True
    assert state.used_in_period == 0


@pytest.mark.django_db
def test_a_raised_allowance_grants_another_use_inside_the_same_window():
    """Spec §36.3: "Increasing free count allows additional uses within current
    rolling window"."""
    user = make_private_seller()
    now = timezone.now()
    _consumed_free(user, when=now - timedelta(days=10))
    update_setting(key="individual.free_listing_count", value=2, actor=None)

    state = free_quota_state(user, now=now)

    assert state.allowance == 2
    assert state.available is True
    assert state.next_available_at is None


@pytest.mark.django_db
def test_with_an_allowance_of_two_the_window_reopens_on_the_older_use():
    user = make_private_seller()
    now = timezone.now()
    update_setting(key="individual.free_listing_count", value=2, actor=None)
    older = now - timedelta(days=300)
    newer = now - timedelta(days=10)
    _consumed_free(user, when=older)
    _consumed_free(user, when=newer)

    state = free_quota_state(user, now=now)

    assert state.available is False
    assert state.used_in_period == 2
    assert state.used_at == newer
    # Eligibility returns when the OLDEST of the two in-window uses ages out.
    assert state.next_available_at == older + timedelta(days=365)


@pytest.mark.django_db
def test_an_allowance_of_zero_is_never_available():
    user = make_private_seller()
    update_setting(key="individual.free_listing_count", value=0, actor=None)

    state = free_quota_state(user)

    assert state.allowance == 0
    assert state.available is False
    assert state.next_available_at is None


@pytest.mark.django_db
def test_a_shortened_period_reopens_eligibility_prospectively():
    """Spec §36.3: configuration changes are prospective — a shorter period
    means an older consumption drops out of the window sooner."""
    user = make_private_seller()
    now = timezone.now()
    _consumed_free(user, when=now - timedelta(days=100))
    update_setting(key="individual.free_period_days", value=30, actor=None)

    assert free_quota_state(user, now=now).available is True


@pytest.mark.django_db
def test_publication_days_follows_the_setting():
    user = make_private_seller()
    update_setting(key="individual.free_publish_days", value=45, actor=None)
    assert free_quota_state(user).publication_days == 45


@pytest.mark.django_db
def test_available_paid_rights_orders_soonest_expiring_first_and_skips_the_rest():
    user = make_private_seller()
    now = timezone.now()
    later = make_entitlement(
        user=user,
        entitlement_type=EntitlementType.PAID_LISTING,
        source=EntitlementSource.STRIPE_PURCHASE,
        state=EntitlementState.AVAILABLE,
        valid_from=now - timedelta(days=1),
        valid_until=now + timedelta(days=200),
    )
    sooner = make_entitlement(
        user=user,
        entitlement_type=EntitlementType.PAID_LISTING,
        source=EntitlementSource.STRIPE_PURCHASE,
        state=EntitlementState.AVAILABLE,
        valid_from=now - timedelta(days=1),
        valid_until=now + timedelta(days=5),
    )
    # Not available: expired window, consumed, reserved, wrong type.
    make_entitlement(
        user=user,
        entitlement_type=EntitlementType.PAID_LISTING,
        state=EntitlementState.AVAILABLE,
        valid_from=now - timedelta(days=400),
        valid_until=now - timedelta(days=1),
    )
    make_entitlement(
        user=user,
        entitlement_type=EntitlementType.PAID_LISTING,
        state=EntitlementState.CONSUMED,
        consumed_at=now,
    )
    make_entitlement(
        user=user,
        entitlement_type=EntitlementType.MEDIA_UPGRADE,
        state=EntitlementState.AVAILABLE,
        valid_from=now - timedelta(days=1),
        valid_until=now + timedelta(days=5),
    )

    assert list(available_paid_rights(user, now=now)) == [sooner, later]


@pytest.mark.django_db
def test_another_users_rights_are_never_counted():
    mine = make_private_seller("mine@example.com")
    theirs = make_private_seller("theirs@example.com")
    _consumed_free(theirs, when=timezone.now())
    make_entitlement(
        user=theirs,
        entitlement_type=EntitlementType.PAID_LISTING,
        state=EntitlementState.AVAILABLE,
    )

    assert free_quota_state(mine).available is True
    assert available_paid_rights(mine).count() == 0


@pytest.mark.django_db
def test_paid_defaults_come_from_platform_settings():
    assert paid_publication_days() == 30
    assert paid_validity_days() == 365


@pytest.mark.django_db
def test_enforcement_is_on_once_the_flag_is_enabled(entitlements_enforced):
    assert enforcement_enabled() is True


@pytest.mark.django_db
def test_enforcement_defaults_to_off():
    assert enforcement_enabled() is False


# --------------------------------------------------------------------------
# Exact-boundary tests. Every threshold is pinned at, one microsecond either
# side of, and (where meaningful) far from the edge so an off-by-one or a
# `<`/`<=` flip changes an assertion.
# --------------------------------------------------------------------------

NOW = datetime(2026, 9, 18, 12, 0, 0, 123456, tzinfo=UTC)
PERIOD = timedelta(days=365)
MICRO = timedelta(microseconds=1)


def _paid(user, *, valid_from, valid_until, state=EntitlementState.AVAILABLE, **kw):
    return make_entitlement(
        user=user,
        entitlement_type=kw.pop("entitlement_type", EntitlementType.PAID_LISTING),
        source=EntitlementSource.STRIPE_PURCHASE,
        state=state,
        valid_from=valid_from,
        valid_until=valid_until,
        **kw,
    )


@pytest.mark.django_db
def test_defaults_of_every_setting_accessor():
    assert free_listing_count() == 1
    assert free_period_days() == 365
    assert free_publication_days() == 30
    assert paid_publication_days() == 30
    assert paid_validity_days() == 365


@pytest.mark.django_db
def test_settings_accessors_follow_updates_and_return_ints():
    update_setting(key="individual.free_listing_count", value=3, actor=None)
    update_setting(key="individual.free_period_days", value=90, actor=None)
    update_setting(key="individual.free_publish_days", value=11, actor=None)
    update_setting(key="individual.paid_publish_days", value=22, actor=None)
    update_setting(key="individual.paid_entitlement_valid_days", value=33, actor=None)
    assert free_listing_count() == 3
    assert free_period_days() == 90
    assert free_publication_days() == 11
    assert paid_publication_days() == 22
    assert paid_validity_days() == 33
    for fn in (
        free_listing_count,
        free_period_days,
        free_publication_days,
        paid_publication_days,
        paid_validity_days,
    ):
        assert type(fn()) is int


@pytest.mark.django_db
def test_consumption_exactly_one_period_ago_no_longer_blocks():
    """`consumed_at == now - period` is OUT of the window: eligibility returns
    at exactly `used_at + period` (the same instant `next_available_at` names)."""
    user = make_private_seller()
    _consumed_free(user, when=NOW - PERIOD)

    state = free_quota_state(user, now=NOW)

    assert state.available is True
    assert state.used_in_period == 0
    assert state.next_available_at is None
    assert state.used_at == NOW - PERIOD


@pytest.mark.django_db
def test_consumption_one_microsecond_inside_the_period_still_blocks():
    user = make_private_seller()
    used = NOW - PERIOD + MICRO
    _consumed_free(user, when=used)

    state = free_quota_state(user, now=NOW)

    assert state.available is False
    assert state.used_in_period == 1
    assert state.next_available_at == used + PERIOD == NOW + MICRO


@pytest.mark.django_db
def test_consumption_one_microsecond_outside_the_period_does_not_block():
    user = make_private_seller()
    _consumed_free(user, when=NOW - PERIOD - MICRO)

    state = free_quota_state(user, now=NOW)

    assert state.available is True
    assert state.used_in_period == 0


@pytest.mark.django_db
def test_next_available_at_is_the_first_instant_the_user_is_available():
    """The advertised instant and the computation agree to the microsecond."""
    user = make_private_seller()
    used = NOW - timedelta(days=100)
    _consumed_free(user, when=used)

    blocked = free_quota_state(user, now=NOW)
    at = blocked.next_available_at

    assert free_quota_state(user, now=at - MICRO).available is False
    assert free_quota_state(user, now=at).available is True
    assert free_quota_state(user, now=at + MICRO).available is True


@pytest.mark.django_db
def test_consumption_exactly_now_blocks():
    user = make_private_seller()
    _consumed_free(user, when=NOW)
    state = free_quota_state(user, now=NOW)
    assert state.available is False
    assert state.next_available_at == NOW + PERIOD


@pytest.mark.django_db
def test_allowance_boundary_n_minus_one_available_n_blocked():
    update_setting(key="individual.free_listing_count", value=3, actor=None)
    user = make_private_seller()
    _consumed_free(user, when=NOW - timedelta(days=30))
    _consumed_free(user, when=NOW - timedelta(days=20))

    below = free_quota_state(user, now=NOW)
    assert below.used_in_period == 2
    assert below.available is True
    assert below.next_available_at is None

    _consumed_free(user, when=NOW - timedelta(days=10))
    at_limit = free_quota_state(user, now=NOW)
    assert at_limit.used_in_period == 3
    assert at_limit.available is False
    assert at_limit.next_available_at == NOW - timedelta(days=30) + PERIOD


@pytest.mark.django_db
def test_allowance_reopens_when_the_oldest_of_n_ages_out_by_one_microsecond():
    update_setting(key="individual.free_listing_count", value=2, actor=None)
    user = make_private_seller()
    older = NOW - PERIOD + MICRO  # one microsecond inside
    newer = NOW - timedelta(days=1)
    _consumed_free(user, when=older)
    _consumed_free(user, when=newer)

    assert free_quota_state(user, now=NOW).available is False
    # One microsecond later the older use is exactly one period old -> out.
    later = free_quota_state(user, now=NOW + MICRO)
    assert later.available is True
    assert later.used_in_period == 1
    assert later.used_at == newer


@pytest.mark.django_db
def test_more_history_than_allowance_reports_newest_used_at_and_right_reopen():
    """Old out-of-window rows and surplus in-window rows must not skew the
    answer: used_at is the newest use, reopening keys on the allowance-th
    newest in-window use."""
    user = make_private_seller()  # allowance 1
    newest = NOW - timedelta(days=5)
    middle = NOW - timedelta(days=50)
    oldest = NOW - timedelta(days=400)
    for when in (oldest, newest, middle):
        _consumed_free(user, when=when)

    state = free_quota_state(user, now=NOW)

    assert state.available is False
    assert state.used_at == newest
    assert state.next_available_at == newest + PERIOD


@pytest.mark.django_db
def test_lowering_the_allowance_below_current_use_blocks_until_newest_ages_out():
    update_setting(key="individual.free_listing_count", value=2, actor=None)
    user = make_private_seller()
    older = NOW - timedelta(days=300)
    newer = NOW - timedelta(days=10)
    _consumed_free(user, when=older)
    _consumed_free(user, when=newer)
    update_setting(key="individual.free_listing_count", value=1, actor=None)

    state = free_quota_state(user, now=NOW)

    assert state.available is False
    assert state.next_available_at == newer + PERIOD


@pytest.mark.django_db
def test_allowance_of_zero_still_reports_used_at():
    user = make_private_seller()
    used = NOW - timedelta(days=3)
    _consumed_free(user, when=used)
    update_setting(key="individual.free_listing_count", value=0, actor=None)

    state = free_quota_state(user, now=NOW)

    assert state.available is False
    assert state.used_at == used
    assert state.next_available_at is None


@pytest.mark.django_db
def test_period_of_one_day_edges():
    update_setting(key="individual.free_period_days", value=1, actor=None)
    user = make_private_seller()
    day = timedelta(days=1)
    _consumed_free(user, when=NOW - day + MICRO)
    assert free_quota_state(user, now=NOW).available is False
    assert free_quota_state(user, now=NOW + MICRO).available is True


@pytest.mark.django_db
def test_free_quota_ignores_non_free_and_non_consumed_rows():
    user = make_private_seller()
    when = NOW - timedelta(days=1)
    # Paid consumption, media-upgrade consumption, and free rows in other
    # states must not count as a free use.
    _paid(
        user,
        valid_from=when,
        valid_until=when + PERIOD,
        state=EntitlementState.CONSUMED,
        consumed_at=when,
    )
    _paid(
        user,
        valid_from=when,
        valid_until=when + PERIOD,
        state=EntitlementState.CONSUMED,
        consumed_at=when,
        entitlement_type=EntitlementType.MEDIA_UPGRADE,
    )
    for other_state in (
        EntitlementState.AVAILABLE,
        EntitlementState.RESERVED,
        EntitlementState.EXPIRED,
    ):
        make_entitlement(
            user=user,
            entitlement_type=EntitlementType.FREE_LISTING,
            state=other_state,
            valid_from=when,
            valid_until=when + PERIOD,
        )

    state = free_quota_state(user, now=NOW)

    assert state.available is True
    assert state.used_at is None
    assert state.used_in_period == 0


@pytest.mark.django_db
def test_revoked_newest_use_leaves_older_use_as_used_at():
    user = make_private_seller()
    older = NOW - timedelta(days=200)
    newer = NOW - timedelta(days=2)
    _consumed_free(user, when=older)
    row = _consumed_free(user, when=newer)
    row.state = EntitlementState.REVOKED
    row.revoked_at = NOW
    row.save(update_fields=["state", "revoked_at", "updated_at"])

    state = free_quota_state(user, now=NOW)

    assert state.used_at == older
    assert state.available is False
    assert state.next_available_at == older + PERIOD


@pytest.mark.django_db
def test_timezone_aware_now_in_another_zone_gives_the_same_answer():
    user = make_private_seller()
    used = NOW - timedelta(days=100)
    _consumed_free(user, when=used)
    tokyo_now = NOW.astimezone(ZoneInfo("Asia/Tokyo"))

    a = free_quota_state(user, now=NOW)
    b = free_quota_state(user, now=tokyo_now)

    assert a.available is False
    assert b.available is False
    assert a.next_available_at == b.next_available_at == used + PERIOD


@pytest.mark.django_db
def test_window_arithmetic_is_absolute_across_a_dst_change():
    """365 days is 365 * 24h of absolute time, not "same wall clock next year":
    a use in New York just before the spring-forward changeover still reopens
    exactly 365 * 24h later."""
    ny = ZoneInfo("America/New_York")
    user = make_private_seller()
    used_local = datetime(2026, 3, 8, 1, 30, tzinfo=ny)  # DST starts 02:00
    _consumed_free(user, when=used_local)

    expected = used_local.astimezone(UTC) + timedelta(days=365)
    state = free_quota_state(user, now=used_local + timedelta(days=10))

    assert state.next_available_at == expected
    assert state.next_available_at.utcoffset() is not None
    assert free_quota_state(user, now=expected - MICRO).available is False
    assert free_quota_state(user, now=expected).available is True


@pytest.mark.django_db
def test_now_defaults_to_the_current_time():
    user = make_private_seller()
    _consumed_free(user, when=timezone.now() - timedelta(days=1))
    assert free_quota_state(user).available is False


def test_as_dict_exposes_exactly_the_four_wire_keys():
    state = FreeQuotaState(
        available=False,
        used_at=NOW,
        next_available_at=NOW + PERIOD,
        publication_days=30,
        allowance=1,
        used_in_period=1,
    )
    assert state.as_dict() == {
        "available": False,
        "used_at": NOW,
        "next_available_at": NOW + PERIOD,
        "publication_days": 30,
    }
    with pytest.raises(AttributeError):
        state.available = True  # frozen


# ---- available_paid_rights window edges ----------------------------------


@pytest.mark.django_db
def test_paid_valid_from_is_inclusive():
    user = make_private_seller()
    row = _paid(user, valid_from=NOW, valid_until=NOW + timedelta(days=1))
    assert list(available_paid_rights(user, now=NOW)) == [row]


@pytest.mark.django_db
def test_paid_not_yet_valid_by_one_microsecond_is_excluded():
    user = make_private_seller()
    _paid(user, valid_from=NOW + MICRO, valid_until=NOW + timedelta(days=1))
    assert list(available_paid_rights(user, now=NOW)) == []


@pytest.mark.django_db
def test_paid_valid_until_is_exclusive():
    user = make_private_seller()
    _paid(user, valid_from=NOW - timedelta(days=1), valid_until=NOW)
    assert list(available_paid_rights(user, now=NOW)) == []


@pytest.mark.django_db
def test_paid_valid_until_one_microsecond_ahead_is_included():
    user = make_private_seller()
    row = _paid(user, valid_from=NOW - timedelta(days=1), valid_until=NOW + MICRO)
    assert list(available_paid_rights(user, now=NOW)) == [row]


@pytest.mark.django_db
def test_paid_selector_excludes_every_non_available_state_and_other_types():
    user = make_private_seller()
    frm, until = NOW - timedelta(days=1), NOW + timedelta(days=1)
    _paid(
        user,
        valid_from=frm,
        valid_until=until,
        state=EntitlementState.RESERVED,
        reserved_at=NOW,
    )
    _paid(
        user,
        valid_from=frm,
        valid_until=until,
        state=EntitlementState.CONSUMED,
        consumed_at=NOW,
    )
    _paid(
        user,
        valid_from=frm,
        valid_until=until,
        state=EntitlementState.REVOKED,
        revoked_at=NOW,
    )
    _paid(user, valid_from=frm, valid_until=until, state=EntitlementState.EXPIRED)
    _paid(
        user,
        valid_from=frm,
        valid_until=until,
        entitlement_type=EntitlementType.FREE_LISTING,
    )
    _paid(
        user,
        valid_from=frm,
        valid_until=until,
        entitlement_type=EntitlementType.MEDIA_UPGRADE,
    )
    assert list(available_paid_rights(user, now=NOW)) == []


@pytest.mark.django_db
def test_paid_selector_on_an_empty_ledger_is_empty():
    user = make_private_seller()
    qs = available_paid_rights(user, now=NOW)
    assert qs.count() == 0
    assert qs.first() is None


@pytest.mark.django_db
def test_paid_selector_orders_by_valid_until_with_microsecond_difference():
    user = make_private_seller()
    frm = NOW - timedelta(days=1)
    base = NOW + timedelta(days=5)
    b = _paid(user, valid_from=frm, valid_until=base + MICRO)
    a = _paid(user, valid_from=frm, valid_until=base)
    c = _paid(user, valid_from=frm, valid_until=base + 2 * MICRO)
    assert list(available_paid_rights(user, now=NOW)) == [a, b, c]


@pytest.mark.django_db
def test_paid_selector_tie_on_valid_until_breaks_on_created_at_then_pk():
    user = make_private_seller()
    frm = NOW - timedelta(days=1)
    until = NOW + timedelta(days=5)
    rows = [_paid(user, valid_from=frm, valid_until=until) for _ in range(10)]
    early, mid = rows[0], rows[1]
    tied = rows[2:]
    UserEntitlement.objects.filter(pk=early.pk).update(
        created_at=NOW - timedelta(hours=3)
    )
    UserEntitlement.objects.filter(pk=mid.pk).update(
        created_at=NOW - timedelta(hours=2)
    )
    # Eight rows identical on valid_until AND created_at: only pk can order
    # them (10 UUID pks make an accidental match vanishingly unlikely).
    UserEntitlement.objects.filter(pk__in=[r.pk for r in tied]).update(
        created_at=NOW - timedelta(hours=1)
    )

    result = list(available_paid_rights(user, now=NOW))

    assert result[:2] == [early, mid]
    assert [r.pk for r in result[2:]] == sorted(r.pk for r in tied)
    assert list(available_paid_rights(user, now=NOW)) == result


@pytest.mark.django_db
def test_paid_selector_returns_a_queryset_and_defaults_now():
    user = make_private_seller()
    row = _paid(
        user,
        valid_from=timezone.now() - timedelta(minutes=1),
        valid_until=timezone.now() + timedelta(minutes=1),
    )
    qs = available_paid_rights(user)
    assert hasattr(qs, "filter")
    assert list(qs) == [row]


@pytest.mark.django_db
def test_paid_selector_with_a_zone_shifted_now():
    user = make_private_seller()
    row = _paid(user, valid_from=NOW, valid_until=NOW + timedelta(days=1))
    la = NOW.astimezone(ZoneInfo("America/Los_Angeles"))
    assert list(available_paid_rights(user, now=la)) == [row]
    assert list(available_paid_rights(user, now=la - MICRO)) == []


# ---- used_in_period is an exact count -----------------------------------


@pytest.mark.django_db
def test_used_in_period_is_an_exact_count_not_capped_by_the_allowance():
    user = make_private_seller()  # allowance 1
    days = (5, 50, 100, 200)
    for d in days:
        _consumed_free(user, when=NOW - timedelta(days=d))

    state = free_quota_state(user, now=NOW)

    assert state.used_in_period == 4
    assert state.available is False
    assert state.used_at == NOW - timedelta(days=5)
    assert state.next_available_at == NOW - timedelta(days=5) + PERIOD


@pytest.mark.django_db
def test_used_in_period_counts_only_the_rolling_window_at_the_edge():
    user = make_private_seller()
    _consumed_free(user, when=NOW - PERIOD + MICRO)  # inside by 1us: counted
    _consumed_free(user, when=NOW - PERIOD)  # exactly at edge: not counted
    _consumed_free(user, when=NOW - PERIOD - MICRO)  # outside: not counted
    _consumed_free(user, when=NOW - timedelta(days=1))  # counted

    assert free_quota_state(user, now=NOW).used_in_period == 2
    assert free_quota_state(user, now=NOW + MICRO).used_in_period == 1


@pytest.mark.django_db
def test_used_in_period_excludes_revoked_other_type_and_other_users_rows():
    user = make_private_seller("count-me@example.com")
    other = make_private_seller("count-not-me@example.com")
    when = NOW - timedelta(days=2)
    _consumed_free(user, when=when)
    revoked = _consumed_free(user, when=when - timedelta(days=1))
    revoked.state = EntitlementState.REVOKED
    revoked.revoked_at = NOW
    revoked.save(update_fields=["state", "revoked_at", "updated_at"])
    _paid(
        user,
        valid_from=when,
        valid_until=when + PERIOD,
        state=EntitlementState.CONSUMED,
        consumed_at=when,
    )
    _consumed_free(other, when=when)
    _consumed_free(other, when=when - timedelta(days=3))

    assert free_quota_state(user, now=NOW).used_in_period == 1
    assert free_quota_state(other, now=NOW).used_in_period == 2


# ---- naive `now` is rejected ---------------------------------------------


@pytest.mark.django_db
def test_a_naive_now_is_rejected():
    user = make_private_seller()
    naive = datetime(2026, 9, 18, 12, 0)  # noqa: DTZ001 - deliberately naive
    with pytest.raises(ValueError, match="timezone-aware"):
        free_quota_state(user, now=naive)
    with pytest.raises(ValueError, match="timezone-aware"):
        available_paid_rights(user, now=naive)
