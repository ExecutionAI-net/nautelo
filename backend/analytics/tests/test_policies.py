"""Spec §19.1 (which events count) and §19.2 (who the viewer is).

Every `assert ... is None` below is one line of spec §19.1's exclusion list. They
are the substance of this phase: a counter that increments is easy, and a counter
that refuses to increment for the owner, their colleagues, staff, bots and
prefetches is the thing spec §34.7's release checklist actually gates on.
"""

from dataclasses import FrozenInstanceError

import pytest
from django.contrib.auth.models import AnonymousUser, Group
from rest_framework.test import APIRequestFactory

from accounts.enums import StaffGroup, UserRole
from accounts.tests.factories import make_user
from analytics.enums import UserAgentClass, ViewerType
from analytics.policies import (
    BOT_USER_AGENT_MARKERS,
    PREFETCH_META_KEYS,
    ViewerIdentity,
    classify_user_agent,
    is_prefetch_request,
    resolve_viewer_identity,
    viewer_is_listing_insider,
    viewer_is_staff,
)
from brokers.tests.factories import make_broker, make_membership
from common.ip import hash_client_ip
from listings.enums import ListingStatus
from listings.tests.factories import (
    make_broker_listing,
    make_private_listing,
    make_snapshot,
)

CHROME = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36"
)


@pytest.fixture
def factory():
    return APIRequestFactory()


def _request(factory, *, method="get", user=None, user_agent=CHROME, remote_addr="198.51.100.9", **extra):
    headers = {"REMOTE_ADDR": remote_addr}
    if user_agent is not None:
        headers["HTTP_USER_AGENT"] = user_agent
    headers.update(extra)
    request = getattr(factory, method)("/api/v1/listings/x/", **headers)
    request.user = user if user is not None else AnonymousUser()
    return request


# --- user agent classification (spec §19.1 "known verified bot", §36.2) -------


@pytest.mark.parametrize(
    "user_agent",
    [
        CHROME,
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15",
        "Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0",
    ],
)
def test_ordinary_browsers_are_human(user_agent):
    assert classify_user_agent(user_agent) == UserAgentClass.HUMAN


@pytest.mark.parametrize(
    "user_agent",
    [
        "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
        "facebookexternalhit/1.1",
        "Twitterbot/1.0",
        "Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)",
        "curl/8.7.1",
        "python-requests/2.32.3",
        "Go-http-client/2.0",
        "Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/141.0.0.0",
        "Pingdom.com_bot_version_1.4",
        "check_http/v2.3 (monitoring-plugins 2.3)",
    ],
)
def test_known_automation_is_a_bot(user_agent):
    assert classify_user_agent(user_agent) == UserAgentClass.BOT


@pytest.mark.parametrize("user_agent", [None, "", "   "])
def test_an_absent_user_agent_is_unknown_not_bot(user_agent):
    """Spec §36.2: "uncertain clients may count and are labeled operational
    limitation"."""
    assert classify_user_agent(user_agent) == UserAgentClass.UNKNOWN


def test_classification_ignores_case():
    assert classify_user_agent("SOMETHING-GOOGLEBOT/2.1") == UserAgentClass.BOT


# --- prefetch / prerender (spec §19.1) ---------------------------------------


@pytest.mark.parametrize(
    "header",
    [
        {"HTTP_SEC_PURPOSE": "prefetch;prerender"},
        {"HTTP_PURPOSE": "prefetch"},
        {"HTTP_X_PURPOSE": "preview"},
        {"HTTP_X_MOZ": "prefetch"},
        {"HTTP_SEC_FETCH_MODE": "no-cors", "HTTP_SEC_PURPOSE": "Prefetch"},
    ],
)
def test_a_prefetch_or_prerender_request_is_detected(factory, header):
    assert is_prefetch_request(_request(factory, **header)) is True


def test_an_ordinary_navigation_is_not_a_prefetch(factory):
    assert is_prefetch_request(_request(factory)) is False


# --- who is an insider (spec §19.1) ------------------------------------------


@pytest.mark.django_db
def test_a_staff_account_is_staff_even_without_a_group():
    assert viewer_is_staff(make_user("s@example.com", role=UserRole.STAFF)) is True


@pytest.mark.django_db
def test_a_staff_moderator_is_staff():
    user = make_user("mod@example.com", role=UserRole.STAFF)
    user.groups.add(Group.objects.get(name=StaffGroup.MODERATOR))

    assert viewer_is_staff(user) is True


@pytest.mark.django_db
def test_a_buyer_is_not_staff():
    assert viewer_is_staff(make_user("b@example.com", role=UserRole.BUYER)) is False


@pytest.mark.django_db
def test_an_anonymous_user_is_not_staff():
    assert viewer_is_staff(AnonymousUser()) is False


@pytest.mark.django_db
def test_the_private_owner_is_an_insider_on_their_own_listing():
    owner = make_user("owner@example.com", role=UserRole.PRIVATE_SELLER)
    listing = make_private_listing(owner=owner)

    assert viewer_is_listing_insider(owner, listing) is True


@pytest.mark.django_db
def test_another_private_seller_is_not_an_insider():
    owner = make_user("owner@example.com", role=UserRole.PRIVATE_SELLER)
    stranger = make_user("other@example.com", role=UserRole.PRIVATE_SELLER)

    assert viewer_is_listing_insider(stranger, make_private_listing(owner=owner)) is False


@pytest.mark.django_db
def test_any_active_member_of_the_owning_broker_is_an_insider_whatever_their_flags():
    """Capability flags authorize actions; they do not decide who is an insider.
    An agent with no permissions at all is still looking at their own shop."""
    agent = make_user("agent@example.com", role=UserRole.BROKER)
    broker = make_broker()
    make_membership(agent, broker, can_edit_listings=False, can_read_messages=False)
    listing = make_broker_listing(broker=broker, actor=agent)

    assert viewer_is_listing_insider(agent, listing) is True


@pytest.mark.django_db
def test_a_member_of_a_different_broker_is_not_an_insider():
    agent = make_user("agent@example.com", role=UserRole.BROKER)
    other_broker = make_broker("Rival Yachts", "rival-yachts")
    owning_broker = make_broker()
    make_membership(agent, other_broker, can_edit_listings=True)
    listing = make_broker_listing(broker=owning_broker, actor=agent)

    assert viewer_is_listing_insider(agent, listing) is False


@pytest.mark.django_db
def test_a_deactivated_membership_is_not_an_insider():
    """A removed ex-employee is a genuine outside viewer; keeping them
    permanently uncountable would be an unbounded exclusion list."""
    agent = make_user("agent@example.com", role=UserRole.BROKER)
    broker = make_broker()
    make_membership(agent, broker, can_edit_listings=True, is_active=False)
    listing = make_broker_listing(broker=broker, actor=agent)

    assert viewer_is_listing_insider(agent, listing) is False


# --- the whole decision (spec §19.1 + §19.2) ---------------------------------


def _publish(listing, approver):
    """Phase 11 contract rule 1: "publicly visible" is status PUBLISHED *and* a
    non-null current_public_snapshot. A test that sets only the status would be
    testing a state the public queryset never serves."""
    snapshot = make_snapshot(listing, approved_by=approver)
    listing.status = ListingStatus.PUBLISHED
    listing.current_public_snapshot = snapshot
    listing.save(update_fields=["status", "current_public_snapshot", "updated_at"])
    return listing


@pytest.fixture
def published(db):
    owner = make_user("owner@example.com", role=UserRole.PRIVATE_SELLER)
    return _publish(make_private_listing(owner=owner), owner)


def _resolve(factory, listing, **kwargs):
    return resolve_viewer_identity(request=_request(factory, **kwargs), listing=listing)


@pytest.mark.django_db
def test_an_anonymous_browser_gets_a_hashed_ip_identity(factory, published, settings):
    settings.TRUSTED_PROXY_COUNT = 0
    identity = _resolve(factory, published, remote_addr="198.51.100.9")

    assert identity is not None
    assert identity.viewer_type == ViewerType.ANONYMOUS
    assert identity.viewer_user is None
    assert identity.viewer_hash == hash_client_ip("198.51.100.9")
    assert identity.user_agent_class == UserAgentClass.HUMAN
    assert identity.lookup() == {"viewer_hash": hash_client_ip("198.51.100.9")}


@pytest.mark.django_db
def test_a_signed_in_buyer_gets_a_user_identity_and_no_hash(factory, published):
    buyer = make_user("buyer@example.com", role=UserRole.BUYER)
    identity = _resolve(factory, published, user=buyer)

    assert identity.viewer_type == ViewerType.USER
    assert identity.viewer_user == buyer
    assert identity.viewer_hash is None
    assert identity.lookup() == {"viewer_user": buyer}


@pytest.mark.django_db
def test_the_owner_does_not_count(factory, published):
    assert _resolve(factory, published, user=published.owner_user) is None


@pytest.mark.django_db
def test_a_broker_colleague_does_not_count(factory):
    agent = make_user("agent@example.com", role=UserRole.BROKER)
    broker = make_broker()
    make_membership(agent, broker)
    listing = _publish(make_broker_listing(broker=broker, actor=agent), agent)

    assert resolve_viewer_identity(
        request=_request(APIRequestFactory(), user=agent), listing=listing
    ) is None


@pytest.mark.django_db
def test_staff_does_not_count(factory, published):
    staff = make_user("staff@example.com", role=UserRole.STAFF)

    assert _resolve(factory, published, user=staff) is None


@pytest.mark.django_db
def test_a_bot_does_not_count(factory, published):
    assert _resolve(factory, published, user_agent="Googlebot/2.1") is None


@pytest.mark.django_db
def test_a_prefetch_does_not_count(factory, published):
    assert _resolve(factory, published, HTTP_SEC_PURPOSE="prefetch") is None


@pytest.mark.django_db
@pytest.mark.parametrize("method", ["head", "post", "put", "patch", "delete"])
def test_only_a_get_counts(factory, published, method):
    assert _resolve(factory, published, method=method) is None


@pytest.mark.django_db
@pytest.mark.parametrize(
    "status",
    [
        ListingStatus.DRAFT,
        ListingStatus.PENDING_APPROVAL,
        ListingStatus.SUSPENDED,
        ListingStatus.EXPIRED,
    ],
)
def test_an_unpublished_listing_does_not_count(factory, published, status):
    published.status = status
    published.save(update_fields=["status", "updated_at"])

    assert _resolve(factory, published) is None


@pytest.mark.django_db
def test_an_anonymous_viewer_with_no_resolvable_address_does_not_count(
    factory, published, settings
):
    """No identity means no uniqueness control, and a row with a NULL hash is
    forbidden by the model anyway. Refusing is the only honest answer."""
    settings.TRUSTED_PROXY_COUNT = 0

    assert _resolve(factory, published, remote_addr="not-an-ip") is None


@pytest.mark.django_db
def test_an_unknown_user_agent_still_counts_and_is_labelled(factory, published):
    """Spec §36.2: uncertain clients may count and are labeled."""
    identity = _resolve(factory, published, user_agent=None)

    assert identity is not None
    assert identity.user_agent_class == UserAgentClass.UNKNOWN


# --- exhaustive / boundary additions ------------------------------------------


def test_every_bot_marker_is_lowercase_and_nonempty():
    assert BOT_USER_AGENT_MARKERS
    for marker in BOT_USER_AGENT_MARKERS:
        assert marker
        assert marker == marker.lower()
        assert marker == marker.strip()


@pytest.mark.parametrize("marker", BOT_USER_AGENT_MARKERS)
def test_every_bot_marker_classifies_as_bot_in_any_case(marker):
    assert classify_user_agent(f"Mozilla/5.0 {marker} 1.0") == UserAgentClass.BOT
    assert classify_user_agent(f"Mozilla/5.0 {marker.upper()} 1.0") == UserAgentClass.BOT
    assert classify_user_agent(marker) == UserAgentClass.BOT


@pytest.mark.parametrize(
    "user_agent",
    [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/141.0 Safari/537.36 Edg/141.0",
        "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1",
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/141.0 Mobile Safari/537.36",
        "Javascript/1.0",  # near-miss for "java/"
        "Mozilla/5.0 (compatible; Chrome; Headless)",  # near-miss for "headlesschrome"
        "Mozilla/5.0 Go-http/1.0",  # near-miss for "go-http-client"
        "Mozilla/5.0 python/3.12",  # near-miss for "python-requests"
    ],
)
def test_near_misses_and_ordinary_browsers_are_human(user_agent):
    assert classify_user_agent(user_agent) == UserAgentClass.HUMAN


def test_classification_strips_surrounding_whitespace():
    assert classify_user_agent("  Googlebot/2.1  ") == UserAgentClass.BOT
    assert classify_user_agent("\t" + CHROME + "\n") == UserAgentClass.HUMAN


@pytest.mark.parametrize("meta_key,markers", PREFETCH_META_KEYS)
def test_every_prefetch_key_and_value_is_detected_in_any_case(factory, meta_key, markers):
    for marker in markers:
        for value in (marker, marker.upper(), f"  {marker}  ", f"x;{marker}"):
            assert is_prefetch_request(_request(factory, **{meta_key: value})) is True


@pytest.mark.parametrize(
    "header",
    [
        {"HTTP_SEC_PURPOSE": ""},
        {"HTTP_SEC_PURPOSE": "   "},
        {"HTTP_SEC_PURPOSE": "navigate"},
        {"HTTP_SEC_PURPOSE": "preview"},  # only legacy Purpose/X-Purpose use "preview"
        {"HTTP_X_MOZ": "preview"},
        {"HTTP_PURPOSE": "navigate"},
        {"HTTP_SEC_FETCH_MODE": "navigate"},
        {"HTTP_SEC_FETCH_DEST": "document"},
    ],
)
def test_non_prefetch_header_values_are_not_a_prefetch(factory, header):
    assert is_prefetch_request(_request(factory, **header)) is False


@pytest.mark.django_db
def test_a_superuser_is_staff_whatever_their_role():
    user = make_user("su@example.com", role=UserRole.BUYER)
    user.is_superuser = True
    user.save(update_fields=["is_superuser"])

    assert viewer_is_staff(user) is True


@pytest.mark.django_db
@pytest.mark.parametrize("role", [UserRole.BUYER, UserRole.PRIVATE_SELLER, UserRole.BROKER])
def test_non_staff_roles_are_not_staff(role):
    assert viewer_is_staff(make_user("r@example.com", role=role)) is False


@pytest.mark.django_db
def test_an_inactive_staff_account_is_not_treated_as_staff():
    user = make_user("s@example.com", role=UserRole.STAFF, is_active=False)

    assert viewer_is_staff(user) is False


def test_none_is_not_staff_and_not_an_insider():
    assert viewer_is_staff(None) is False
    assert viewer_is_listing_insider(None, object()) is False


@pytest.mark.django_db
def test_an_anonymous_user_is_never_an_insider(published):
    assert viewer_is_listing_insider(AnonymousUser(), published) is False


@pytest.mark.django_db
def test_a_broker_member_is_not_an_insider_on_a_private_listing():
    agent = make_user("agent@example.com", role=UserRole.BROKER)
    make_membership(agent, make_broker(), can_edit_listings=True)
    owner = make_user("owner@example.com", role=UserRole.PRIVATE_SELLER)

    assert viewer_is_listing_insider(agent, make_private_listing(owner=owner)) is False


@pytest.mark.django_db
def test_a_private_seller_is_not_an_insider_on_a_broker_listing():
    seller = make_user("seller@example.com", role=UserRole.PRIVATE_SELLER)
    agent = make_user("agent@example.com", role=UserRole.BROKER)
    broker = make_broker()
    make_membership(agent, broker)
    listing = make_broker_listing(broker=broker, actor=agent)

    assert viewer_is_listing_insider(seller, listing) is False


@pytest.mark.django_db
def test_a_member_of_a_suspended_broker_is_still_an_insider():
    from brokers.enums import BrokerOrganizationStatus

    agent = make_user("agent@example.com", role=UserRole.BROKER)
    broker = make_broker(status=BrokerOrganizationStatus.SUSPENDED)
    make_membership(agent, broker)
    listing = make_broker_listing(broker=broker, actor=agent)

    assert viewer_is_listing_insider(agent, listing) is True


@pytest.mark.django_db
def test_a_member_of_a_rival_broker_counts_on_another_orgs_listing(factory):
    rival_agent = make_user("rival@example.com", role=UserRole.BROKER)
    make_membership(rival_agent, make_broker("Rival Yachts", "rival-yachts"))
    owning = make_broker()
    owning_agent = make_user("own@example.com", role=UserRole.BROKER)
    make_membership(owning_agent, owning)
    listing = _publish(make_broker_listing(broker=owning, actor=owning_agent), owning_agent)

    identity = _resolve(factory, listing, user=rival_agent)

    assert identity is not None
    assert identity.viewer_type == ViewerType.USER


@pytest.mark.django_db
def test_a_removed_ex_employee_counts_on_the_former_employers_listing(factory):
    agent = make_user("agent@example.com", role=UserRole.BROKER)
    broker = make_broker()
    make_membership(agent, broker, is_active=False)
    listing = _publish(make_broker_listing(broker=broker, actor=agent), agent)

    assert _resolve(factory, listing, user=agent) is not None


@pytest.mark.django_db
def test_published_status_without_a_snapshot_does_not_count(factory, published):
    published.current_public_snapshot = None
    published.save(update_fields=["current_public_snapshot", "updated_at"])

    assert _resolve(factory, published) is None


@pytest.mark.django_db
@pytest.mark.parametrize("status", [ListingStatus.REJECTED, ListingStatus.ARCHIVED])
def test_rejected_and_archived_listings_do_not_count(factory, published, status):
    published.status = status
    published.save(update_fields=["status", "updated_at"])

    assert _resolve(factory, published) is None


@pytest.mark.django_db
@pytest.mark.parametrize(
    "kwargs",
    [
        {"user_agent": "curl/8.7.1"},
        {"user_agent": "HEADLESSCHROME/141"},
        {"user_agent": "Googlebot/2.1"},
        {"HTTP_PURPOSE": "prefetch"},
        {"HTTP_X_PURPOSE": "preview"},
        {"HTTP_X_MOZ": "prefetch"},
        {"HTTP_SEC_PURPOSE": "prefetch;prerender"},
    ],
)
def test_bot_and_prefetch_variants_do_not_count_even_when_signed_in(factory, published, kwargs):
    buyer = make_user("buyer@example.com", role=UserRole.BUYER)

    assert _resolve(factory, published, user=buyer, **kwargs) is None


@pytest.mark.django_db
def test_only_get_counts_and_get_does(factory, published):
    assert _resolve(factory, published, method="get") is not None
    assert _resolve(factory, published, method="options") is None


@pytest.mark.django_db
def test_a_signed_in_viewer_with_no_user_agent_is_labelled_unknown(factory, published):
    buyer = make_user("buyer@example.com", role=UserRole.BUYER)
    identity = _resolve(factory, published, user=buyer, user_agent=None)

    assert identity.user_agent_class == UserAgentClass.UNKNOWN
    assert identity.viewer_type == ViewerType.USER


@pytest.mark.django_db
def test_a_blank_user_agent_still_counts_as_unknown(factory, published):
    identity = _resolve(factory, published, user_agent="   ")

    assert identity is not None
    assert identity.user_agent_class == UserAgentClass.UNKNOWN


@pytest.mark.django_db
def test_a_signed_in_viewer_never_carries_a_hash_even_with_a_valid_ip(factory, published):
    buyer = make_user("buyer@example.com", role=UserRole.BUYER)
    identity = _resolve(factory, published, user=buyer, remote_addr="198.51.100.9")

    assert identity.viewer_hash is None
    assert "viewer_hash" not in identity.lookup()


@pytest.mark.django_db
def test_anonymous_identity_is_stable_per_address_and_distinct_across_addresses(
    factory, published, settings
):
    settings.TRUSTED_PROXY_COUNT = 0
    first = _resolve(factory, published, remote_addr="198.51.100.9")
    again = _resolve(factory, published, remote_addr="198.51.100.9")
    other = _resolve(factory, published, remote_addr="198.51.100.10")

    assert first == again
    assert first.viewer_hash != other.viewer_hash


@pytest.mark.django_db
def test_an_untrusted_forwarded_for_header_does_not_change_the_anonymous_identity(
    factory, published, settings
):
    settings.TRUSTED_PROXY_COUNT = 0
    plain = _resolve(factory, published, remote_addr="198.51.100.9")
    spoofed = _resolve(
        factory, published, remote_addr="198.51.100.9", HTTP_X_FORWARDED_FOR="203.0.113.7"
    )

    assert plain.viewer_hash == spoofed.viewer_hash


@pytest.mark.django_db
def test_a_missing_remote_addr_does_not_count(factory, published, settings):
    settings.TRUSTED_PROXY_COUNT = 0

    assert _resolve(factory, published, remote_addr="") is None


def test_lookup_uses_the_user_when_present_and_the_hash_otherwise():
    user = object()
    with_user = ViewerIdentity(ViewerType.USER, user, None, UserAgentClass.HUMAN)
    with_hash = ViewerIdentity(ViewerType.ANONYMOUS, None, "abc", UserAgentClass.HUMAN)

    assert with_user.lookup() == {"viewer_user": user}
    assert with_hash.lookup() == {"viewer_hash": "abc"}


def test_viewer_identity_is_frozen():
    identity = ViewerIdentity(ViewerType.ANONYMOUS, None, "abc", UserAgentClass.HUMAN)

    with pytest.raises(FrozenInstanceError):
        identity.viewer_hash = "other"
