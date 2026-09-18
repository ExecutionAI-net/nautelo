"""Spec §11.7 ("Proxy headers are trusted only from configured reverse proxies")
and §30.4 ("Rate limiting must not store raw IP beyond approved security systems").

The forged-header tests below are the reason this module exists. DRF's stock
BaseThrottle.get_ident() ends in `return ''.join(xff.split()) if xff else
remote_addr` — so when NUM_PROXIES is unset (it is unset in this project) the
identity is the ENTIRE X-Forwarded-For header, verbatim, as the caller wrote it.
Not its left-most entry: the whole string. A caller who varies that header on
every request gets a fresh identity on every request. canonical_client_ip()
instead derives the identity only from evidence we produced ourselves —
REMOTE_ADDR, or the hop written by a proxy we actually operate.
"""

import hashlib

import pytest
from rest_framework.test import APIRequestFactory

from common.ip import (
    INTERNAL_CLIENT_IP_HEADER,
    INTERNAL_SERVICE_SECRET_HEADER,
    XFF_HEADER,
    canonical_client_ip,
    get_client_ip,
    hash_client_ip,
)


@pytest.fixture
def factory():
    return APIRequestFactory()


def _get(factory, *, remote_addr="198.51.100.9", xff=None):
    extra = {"REMOTE_ADDR": remote_addr}
    if xff is not None:
        extra[XFF_HEADER] = xff
    return factory.get("/api/v1/listings/", **extra)


def test_with_no_trusted_proxies_the_forwarded_header_is_ignored_entirely(
    factory, settings
):
    settings.TRUSTED_PROXY_COUNT = 0
    request = _get(factory, remote_addr="198.51.100.9", xff="203.0.113.7, 10.0.0.1")

    assert canonical_client_ip(request) == "198.51.100.9"


def test_with_one_trusted_proxy_the_right_most_hop_wins_not_the_spoofable_first(
    factory, settings
):
    # Our own proxy appended "198.51.100.9"; "203.0.113.7" is the attacker's
    # hand-written prefix. DRF's stock get_ident() with NUM_PROXIES unset would
    # return the whole header, "203.0.113.7,198.51.100.9" — an identity the
    # attacker can change at will. (With NUM_PROXIES=1 DRF would agree with us
    # and return "198.51.100.9"; the disagreement is only about the default.)
    settings.TRUSTED_PROXY_COUNT = 1
    request = _get(factory, remote_addr="10.0.0.1", xff="203.0.113.7, 198.51.100.9")

    assert canonical_client_ip(request) == "198.51.100.9"


def test_with_two_trusted_proxies_it_counts_two_hops_from_the_right(factory, settings):
    settings.TRUSTED_PROXY_COUNT = 2
    request = _get(
        factory, remote_addr="10.0.0.1", xff="203.0.113.7, 198.51.100.9, 10.0.0.2"
    )

    assert canonical_client_ip(request) == "198.51.100.9"


def test_a_chain_shorter_than_the_configured_proxy_count_falls_back_to_remote_addr(
    factory, settings
):
    settings.TRUSTED_PROXY_COUNT = 2
    request = _get(factory, remote_addr="10.0.0.1", xff="198.51.100.9")

    assert canonical_client_ip(request) == "10.0.0.1"


def test_a_missing_forwarded_header_falls_back_to_remote_addr(factory, settings):
    settings.TRUSTED_PROXY_COUNT = 1
    request = _get(factory, remote_addr="10.0.0.1")

    assert canonical_client_ip(request) == "10.0.0.1"


def test_whitespace_around_chain_entries_is_tolerated(factory, settings):
    settings.TRUSTED_PROXY_COUNT = 1
    request = _get(factory, remote_addr="10.0.0.1", xff="203.0.113.7,   198.51.100.9  ")

    assert canonical_client_ip(request) == "198.51.100.9"


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("198.51.100.9:51234", "198.51.100.9"),
        ("[2001:db8::1]:443", "2001:db8::1"),
        ("2001:0db8:0000:0000:0000:0000:0000:0001", "2001:db8::1"),
        # One host is one identity, not one identity per transport.
        ("::ffff:198.51.100.9", "198.51.100.9"),
    ],
)
def test_addresses_are_canonicalized_to_one_form_per_host(
    factory, settings, raw, expected
):
    settings.TRUSTED_PROXY_COUNT = 0
    request = _get(factory, remote_addr=raw)

    assert canonical_client_ip(request) == expected


@pytest.mark.parametrize("raw", ["", "   ", "not-an-ip", "999.1.1.1", "[2001:db8::1"])
def test_an_unparseable_address_yields_none_rather_than_a_bogus_identity(
    factory, settings, raw
):
    settings.TRUSTED_PROXY_COUNT = 0
    request = _get(factory, remote_addr=raw)

    assert canonical_client_ip(request) is None


def test_ipv6_is_not_truncated_by_default(factory, settings):
    """Safe default: the setting changes nothing until a deployment sets it."""
    settings.TRUSTED_PROXY_COUNT = 0
    settings.IPV6_HASH_PREFIX_BITS = 0
    request = _get(factory, remote_addr="2001:db8::dead:beef")

    assert canonical_client_ip(request) == "2001:db8::dead:beef"


@pytest.mark.parametrize(
    "raw", ["2001:db8:0:1::1", "2001:db8:0:1:aaaa:bbbb:cccc:dddd", "2001:db8:0:1::"]
)
def test_when_enabled_every_address_in_one_ipv6_prefix_is_one_identity(
    factory, settings, raw
):
    """The counter-inflation mitigation: 2**64 addresses, one viewer identity.

    Without this, one residential /64 allocation can mint 2**64 distinct
    viewer_hash values that each look like a legitimate first-time viewer.
    """
    settings.TRUSTED_PROXY_COUNT = 0
    settings.IPV6_HASH_PREFIX_BITS = 64

    assert canonical_client_ip(_get(factory, remote_addr=raw)) == "2001:db8:0:1::"


def test_ipv4_is_never_truncated_even_when_the_setting_is_on(factory, settings):
    """An IPv4 address is already one host; masking it would merge strangers."""
    settings.TRUSTED_PROXY_COUNT = 0
    settings.IPV6_HASH_PREFIX_BITS = 64
    request = _get(factory, remote_addr="198.51.100.9")

    assert canonical_client_ip(request) == "198.51.100.9"


def test_the_hash_is_a_stable_64_character_hex_digest_that_hides_the_address():
    digest = hash_client_ip("198.51.100.9")

    assert len(digest) == 64
    assert set(digest) <= set("0123456789abcdef")
    assert "198.51.100.9" not in digest
    assert digest == hash_client_ip("198.51.100.9")
    assert digest != hash_client_ip("198.51.100.10")


def test_the_hash_is_keyed_by_the_secret_and_is_not_a_bare_digest(settings):
    """The pseudonym must be UNFORGEABLE, not merely unreadable.

    A bare `sha256(ip)` would satisfy every other assertion in this file — stable,
    64 hex chars, hides the address — while being trivially reversible: the IPv4
    space is 2**32, so anyone holding a `viewer_hash` or a throttle key could
    enumerate it in seconds and recover the raw address, defeating spec §30.4's
    "must not store raw IP". Keying the digest with CONTACT_HASH_SECRET is what
    makes that enumeration impossible without the secret.

    It is also what makes secret rotation meaningful: spec §11.7 relies on
    rotating CONTACT_HASH_SECRET to rotate every derived identifier at once, and
    an unkeyed digest would ignore the rotation entirely.
    """
    settings.CONTACT_HASH_SECRET = "first-secret"
    first = hash_client_ip("198.51.100.9")

    settings.CONTACT_HASH_SECRET = "second-secret"
    second = hash_client_ip("198.51.100.9")

    # Rotating the secret must rotate the pseudonym.
    assert first != second

    # And neither may be the unkeyed digest anyone could compute without the secret.
    unkeyed = hashlib.sha256(b"198.51.100.9").hexdigest()
    assert first != unkeyed
    assert second != unkeyed


# --------------------------------------------------------------------------
# The PR #103 / Phase 10 combination: two ways a client identity can be set,
# one authenticated and one not. These pin how they interact, which is where a
# merge of two independent fixes is most likely to go wrong.
# --------------------------------------------------------------------------

SECRET = "test-internal-secret"


def _internal(factory, *, secret, client_ip, remote_addr="10.0.0.5", xff=None):
    extra = {
        "REMOTE_ADDR": remote_addr,
        INTERNAL_SERVICE_SECRET_HEADER: secret,
        INTERNAL_CLIENT_IP_HEADER: client_ip,
    }
    if xff is not None:
        extra[XFF_HEADER] = xff
    return factory.get("/api/v1/service-categories/", **extra)


def test_the_public_alias_and_the_resolver_are_one_function():
    """Later Phase 10 tasks import `canonical_client_ip`; #103's name is
    `get_client_ip`. They must never drift into two resolvers."""
    assert canonical_client_ip is get_client_ip


def test_an_authenticated_forwarded_ip_beats_remote_addr(factory, settings):
    """The SSR case: REMOTE_ADDR is our own Next.js box, not the visitor."""
    settings.INTERNAL_SERVICE_SECRET = SECRET
    settings.TRUSTED_PROXY_COUNT = 0
    request = _internal(
        factory, secret=SECRET, client_ip="198.51.100.42", remote_addr="10.0.0.5"
    )

    assert get_client_ip(request) == "198.51.100.42"


def test_an_authenticated_forwarded_ip_beats_a_spoofed_forwarded_for(factory, settings):
    """Both headers present: the authenticated one wins, the forgeable one loses."""
    settings.INTERNAL_SERVICE_SECRET = SECRET
    settings.TRUSTED_PROXY_COUNT = 1
    request = _internal(
        factory,
        secret=SECRET,
        client_ip="198.51.100.42",
        remote_addr="10.0.0.5",
        xff="203.0.113.7, 203.0.113.8",
    )

    assert get_client_ip(request) == "198.51.100.42"


@pytest.mark.parametrize(
    "bad_secret", ["", "not-the-real-secret", "test-internal-secre"]
)
def test_a_wrong_or_missing_secret_makes_the_forwarded_ip_worthless(
    factory, settings, bad_secret
):
    """Without the secret, X-Internal-Client-IP is just another forgeable header."""
    settings.INTERNAL_SERVICE_SECRET = SECRET
    settings.TRUSTED_PROXY_COUNT = 0
    request = _internal(
        factory, secret=bad_secret, client_ip="198.51.100.42", remote_addr="10.0.0.5"
    )

    assert get_client_ip(request) == "10.0.0.5"


@pytest.mark.parametrize("junk", ["not-an-ip", "999.1.1.1", "   ", ""])
def test_an_authenticated_but_unparseable_forwarded_ip_falls_through(
    factory, settings, junk
):
    """Holding the secret buys the right to name a visitor, not to inject a string.

    An unparseable value is not evidence, so resolution falls through to the
    socket rather than letting an arbitrary string become a cache key.
    """
    settings.INTERNAL_SERVICE_SECRET = SECRET
    settings.TRUSTED_PROXY_COUNT = 0
    request = _internal(factory, secret=SECRET, client_ip=junk, remote_addr="10.0.0.5")

    assert get_client_ip(request) == "10.0.0.5"


def test_with_a_trusted_proxy_but_no_secret_the_right_counted_hop_still_wins(
    factory, settings
):
    """The two mechanisms are independent: #103's path must not disable ours."""
    settings.INTERNAL_SERVICE_SECRET = SECRET
    settings.TRUSTED_PROXY_COUNT = 1
    request = _get(factory, remote_addr="10.0.0.1", xff="203.0.113.7, 198.51.100.9")

    assert get_client_ip(request) == "198.51.100.9"


def test_rotating_the_forwarded_header_still_yields_one_identity_by_default(
    factory, settings
):
    """Default posture, restated after the merge: no secret, no trusted proxies,
    so nothing a caller sends can change who they are."""
    settings.INTERNAL_SERVICE_SECRET = SECRET
    settings.TRUSTED_PROXY_COUNT = 0

    identities = {
        get_client_ip(_get(factory, remote_addr="198.51.100.9", xff=chain))
        for chain in ("203.0.113.7", "203.0.113.8, 10.0.0.1", "1.1.1.1, 2.2.2.2")
    }

    assert identities == {"198.51.100.9"}
