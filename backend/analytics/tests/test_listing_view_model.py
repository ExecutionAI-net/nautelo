"""Spec §11.7's ListingView, field by field and constraint by constraint.

Every constraint below is a database constraint, not a Python check: the write
path in analytics.recording relies on the unique indexes to serialise concurrent
identical requests (spec §19's acceptance test 5), so a rule enforced only in
application code would be a rule that does not hold under the exact conditions it
exists for.
"""

from datetime import timedelta

import pytest
from django.contrib.admin.sites import site as admin_site
from django.contrib.auth.models import Group
from django.db import DataError, IntegrityError, transaction
from django.test import RequestFactory
from django.utils import timezone

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from analytics.admin import ListingViewAdmin
from analytics.enums import UserAgentClass, ViewerType
from analytics.models import ListingView
from analytics.tests.factories import fake_hash, make_anonymous_view, make_user_view
from listings.tests.factories import make_private_listing

pytestmark = pytest.mark.django_db


@pytest.fixture
def owner():
    return make_user("owner@example.com", role=UserRole.PRIVATE_SELLER, verified=True)


@pytest.fixture
def listing(owner):
    return make_private_listing(owner=owner)


def _viewer(email):
    return make_user(email, role=UserRole.PRIVATE_SELLER, verified=True)


def test_an_authenticated_view_stores_the_user_and_no_hash(listing):
    view = make_user_view(listing, user=_viewer("buyer@example.com"))

    assert view.viewer_type == ViewerType.USER
    assert view.viewer_user is not None
    assert view.viewer_hash is None
    assert view.user_agent_class == UserAgentClass.HUMAN
    assert view.first_viewed_at is not None
    assert view.last_seen_at is not None
    assert listing.views.count() == 1


def test_an_anonymous_view_stores_a_hash_and_no_user(listing):
    view = make_anonymous_view(listing)

    assert view.viewer_type == ViewerType.ANONYMOUS
    assert view.viewer_user is None
    assert len(view.viewer_hash) == 64


def test_one_user_cannot_be_recorded_twice_on_one_listing(listing):
    viewer = _viewer("buyer@example.com")
    make_user_view(listing, user=viewer)

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            make_user_view(listing, user=viewer)


def test_one_hash_cannot_be_recorded_twice_on_one_listing(listing):
    digest = fake_hash("one-household")
    make_anonymous_view(listing, viewer_hash=digest)

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            make_anonymous_view(listing, viewer_hash=digest)


def test_two_different_users_may_view_one_listing(listing):
    make_user_view(listing, user=_viewer("a@example.com"))
    make_user_view(listing, user=_viewer("b@example.com"))

    assert listing.views.count() == 2


def test_two_different_hashes_may_view_one_listing(listing):
    make_anonymous_view(listing, viewer_hash=fake_hash("a"))
    make_anonymous_view(listing, viewer_hash=fake_hash("b"))

    assert listing.views.count() == 2


def test_the_same_viewer_may_be_recorded_on_a_different_listing(owner, listing):
    viewer = _viewer("buyer@example.com")
    # make_private_listing derives a brand name from the owner, so a second call
    # with the same owner collides on the unique brand name; reuse the first's.
    other = make_private_listing(owner=owner, brand=listing.brand, model=listing.model)
    digest = fake_hash("one-household")

    make_user_view(listing, user=viewer)
    make_user_view(other, user=viewer)
    make_anonymous_view(listing, viewer_hash=digest)
    make_anonymous_view(other, viewer_hash=digest)

    assert ListingView.objects.count() == 4


def test_a_row_with_neither_a_user_nor_a_hash_is_rejected(listing):
    now = timezone.now()
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            ListingView.objects.create(
                listing=listing,
                viewer_type=ViewerType.ANONYMOUS,
                viewer_user=None,
                viewer_hash=None,
                first_viewed_at=now,
                last_seen_at=now,
            )


def test_a_row_with_both_a_user_and_a_hash_is_rejected(listing):
    now = timezone.now()
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            ListingView.objects.create(
                listing=listing,
                viewer_type=ViewerType.USER,
                viewer_user=_viewer("buyer@example.com"),
                viewer_hash=fake_hash("both"),
                first_viewed_at=now,
                last_seen_at=now,
            )


def test_the_viewer_type_must_agree_with_which_identity_column_is_set(listing):
    """A USER row pointing at no user would make every aggregate a guess."""
    now = timezone.now()
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            ListingView.objects.create(
                listing=listing,
                viewer_type=ViewerType.USER,
                viewer_user=None,
                viewer_hash=fake_hash("mislabelled"),
                first_viewed_at=now,
                last_seen_at=now,
            )


def test_an_anonymous_label_on_a_user_row_is_rejected(listing):
    now = timezone.now()
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            ListingView.objects.create(
                listing=listing,
                viewer_type=ViewerType.ANONYMOUS,
                viewer_user=_viewer("buyer@example.com"),
                viewer_hash=None,
                first_viewed_at=now,
                last_seen_at=now,
            )


@pytest.mark.parametrize(
    "bad_hash",
    [
        "not-hex-" + "0" * 56,
        "A" * 64,  # uppercase: a second spelling of one identity
        "0" * 63,
        "0" * 65,
        "a" * 63 + "g",  # right length, one character outside [0-9a-f]
        "a" * 63 + "F",  # right length, one uppercase character
    ],
)
def test_a_malformed_hash_is_rejected(listing, bad_hash):
    # 65 characters exceeds the varchar(64) column itself (DataError); every
    # other case is the CHECK constraint (IntegrityError). Both are DB-level.
    with pytest.raises((IntegrityError, DataError)):
        with transaction.atomic():
            make_anonymous_view(listing, viewer_hash=bad_hash)


def test_an_empty_string_hash_is_rejected(listing):
    now = timezone.now()
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            ListingView.objects.create(
                listing=listing,
                viewer_type=ViewerType.ANONYMOUS,
                viewer_user=None,
                viewer_hash="",
                first_viewed_at=now,
                last_seen_at=now,
            )


@pytest.mark.parametrize("good_hash", ["0" * 64, "f" * 64, "9" * 32 + "a" * 32])
def test_a_hash_at_the_exact_length_and_alphabet_boundaries_is_accepted(
    listing, good_hash
):
    view = make_anonymous_view(listing, viewer_hash=good_hash)
    view.refresh_from_db()

    assert view.viewer_hash == good_hash


def test_the_very_first_insert_satisfies_the_timestamp_constraint(listing):
    """Regression pin for the `auto_now_add` trap.

    If `first_viewed_at` were `auto_now_add=True`, it would be stamped at INSERT
    time — after the `now` the caller already passed as `last_seen_at` — and this
    row, the simplest possible one, would be rejected by
    `analytics_view_last_seen_not_before_first_viewed`. Both columns are written
    explicitly from one captured value, so they are equal on a fresh row.
    """
    view = make_anonymous_view(listing)
    view.refresh_from_db()

    assert view.first_viewed_at == view.last_seen_at


def test_the_timestamp_columns_are_not_auto_generated():
    first = ListingView._meta.get_field("first_viewed_at")
    last = ListingView._meta.get_field("last_seen_at")

    assert first.auto_now_add is False
    assert first.auto_now is False
    assert last.auto_now_add is False
    assert last.auto_now is False


def test_last_seen_at_may_not_predate_first_viewed_at(listing):
    view = make_anonymous_view(listing)

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            ListingView.objects.filter(pk=view.pk).update(
                last_seen_at=view.first_viewed_at - timedelta(seconds=1)
            )


def test_last_seen_at_one_microsecond_before_first_viewed_at_is_rejected(listing):
    view = make_anonymous_view(listing)

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            ListingView.objects.filter(pk=view.pk).update(
                last_seen_at=view.first_viewed_at - timedelta(microseconds=1)
            )


def test_last_seen_at_equal_to_first_viewed_at_is_accepted_and_later_is_too(listing):
    view = make_anonymous_view(listing)

    ListingView.objects.filter(pk=view.pk).update(last_seen_at=view.first_viewed_at)
    ListingView.objects.filter(pk=view.pk).update(
        last_seen_at=view.first_viewed_at + timedelta(microseconds=1)
    )

    view.refresh_from_db()
    assert view.last_seen_at == view.first_viewed_at + timedelta(microseconds=1)


def test_deleting_the_listing_deletes_its_view_identity_rows(listing):
    """Spec §19.4: "Delete view identity rows when the listing is permanently
    deleted"."""
    make_user_view(listing, user=_viewer("buyer@example.com"))
    make_anonymous_view(listing)
    assert ListingView.objects.count() == 2

    listing.revisions.all().delete()
    listing.delete()

    assert ListingView.objects.count() == 0


def test_deleting_the_viewing_account_deletes_its_rows(listing):
    """An erasure request must not leave an orphan row. See the plan's ruling:
    the consequence is that reconciliation lowers the lifetime count."""
    viewer = _viewer("buyer@example.com")
    make_user_view(listing, user=viewer)

    viewer.delete()

    assert ListingView.objects.count() == 0


def _staff(email, group_name):
    user = make_user(email, role=UserRole.STAFF, verified=True)
    user.groups.add(Group.objects.get(name=group_name))
    return user


def _request_for(user):
    request = RequestFactory().get("/admin/analytics/listingview/")
    request.user = user
    return request


def test_the_admin_is_registered_and_completely_read_only():
    """Spec §19.4: row-level analytics are for authorized staff/engineering, and
    nothing about a view is a thing a human should be able to author."""
    model_admin = admin_site._registry[ListingView]

    assert isinstance(model_admin, ListingViewAdmin)
    assert model_admin.has_add_permission(_request_for(None)) is False
    assert model_admin.has_change_permission(_request_for(None)) is False
    assert model_admin.has_delete_permission(_request_for(None)) is False


@pytest.mark.parametrize(
    ("group", "expected"),
    [(StaffGroup.ADMIN, True), (StaffGroup.MODERATOR, False)],
)
def test_only_staff_administrators_may_read_the_rows(group, expected):
    model_admin = admin_site._registry[ListingView]
    user = _staff(f"{group}@example.com", group)

    assert model_admin.has_view_permission(_request_for(user)) is expected
    assert model_admin.has_module_permission(_request_for(user)) is expected


def test_a_staff_administrator_is_still_denied_add_change_and_delete():
    model_admin = admin_site._registry[ListingView]
    request = _request_for(_staff("admin-rw@example.com", StaffGroup.ADMIN))

    assert model_admin.has_add_permission(request) is False
    assert model_admin.has_change_permission(request) is False
    assert model_admin.has_delete_permission(request) is False


def test_a_signed_in_non_staff_user_may_not_read_the_rows():
    model_admin = admin_site._registry[ListingView]
    request = _request_for(make_user("buyer2@example.com", role=UserRole.PRIVATE_SELLER))

    assert model_admin.has_view_permission(request) is False


def test_the_admin_never_renders_a_full_viewer_hash(listing):
    """A full hash is a stable cross-listing identifier. Staff need to tell rows
    apart, not to correlate one viewer across the whole catalogue."""
    model_admin = admin_site._registry[ListingView]
    view = make_anonymous_view(listing, viewer_hash=fake_hash("masking"))

    rendered = model_admin.masked_viewer_hash(view)

    assert view.viewer_hash not in rendered
    assert rendered.startswith(view.viewer_hash[:12])
    assert "viewer_hash" not in model_admin.list_display
    assert "viewer_hash" not in model_admin.fields
