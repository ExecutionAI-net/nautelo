"""Canonical client IP resolution and pseudonymization (spec §11.7, §19.2, §30.4).

Spec §11.7: "`viewer_hash = HMAC-SHA256(CONTACT_HASH_SECRET, canonical_client_ip)`.
Do not store raw IP in `ListingView`. Proxy headers are trusted only from
configured reverse proxies."

`X-Forwarded-For` is appended to by each hop, and the first hop may be the client
itself: a request arriving with `X-Forwarded-For: 203.0.113.7` when no proxy is
deployed is simply a header someone typed. The only entry that cannot be forged is
the one written by the outermost proxy *we operate*, so this module counts
`settings.TRUSTED_PROXY_COUNT` hops from the RIGHT-hand end of the chain.

Counting from the right is also what DRF's `BaseThrottle.get_ident()` does *once
`NUM_PROXIES` is configured* (`addrs[-min(num_proxies, len(addrs))]`). The problem
this module exists to fix is DRF's behaviour when `NUM_PROXIES` is NOT configured,
which is this project's state: its final line is

    return ''.join(xff.split()) if xff else remote_addr

— the identity becomes the ENTIRE client-supplied header, verbatim. That is not
merely "the wrong entry"; there is no entry selection at all. A caller who sends a
different arbitrary `X-Forwarded-For` value on each request lands in a different
throttle bucket on each request, which is a complete bypass of every rate limit in
spec §30.4 rather than a way to impersonate one other address. This module has no
unconfigured-and-trusting mode: absent configuration it trusts nothing but the
socket.

`TRUSTED_PROXY_COUNT` defaults to 0, which ignores the header completely and uses
`REMOTE_ADDR`. That is the correct value for the current deployment, where Django
is reached directly; raise it to the number of proxies actually in front of it.

`IPV6_HASH_PREFIX_BITS` defaults to 0 (off). See `_truncate_ipv6` below: it exists
because a single residential IPv6 /64 allocation is 2**64 addresses, every one of
which would otherwise hash to a distinct `viewer_hash` and look like a distinct
unique viewer. It is off by default because turning it on merges more households
into one identity, and that trade should be made against observed traffic rather
than guessed at now. Known Limitation 13 records the gap.
"""

import hashlib
import hmac
import ipaddress

from django.conf import settings

XFF_HEADER = "HTTP_X_FORWARDED_FOR"


def _normalize(candidate: str) -> str | None:
    """One canonical text form per host, or None if this is not an address."""
    value = (candidate or "").strip()
    if not value:
        return None

    if value.startswith("["):
        # "[2001:db8::1]:443" -> "2001:db8::1"
        closing = value.find("]")
        if closing == -1:
            return None
        value = value[1:closing]
    elif value.count(":") == 1:
        # "198.51.100.9:51234" -> "198.51.100.9". A bare IPv6 address always has
        # more than one colon, so this only ever strips an IPv4 port.
        value = value.split(":", 1)[0]

    try:
        address = ipaddress.ip_address(value)
    except ValueError:
        return None

    # "::ffff:198.51.100.9" and "198.51.100.9" are the same host. Collapsing them
    # keeps one identity per viewer rather than one per transport.
    mapped = getattr(address, "ipv4_mapped", None)
    if mapped is not None:
        address = mapped
    return str(_truncate_ipv6(address))


def _truncate_ipv6(address):
    """Optionally reduce an IPv6 address to its network prefix. Off by default.

    Spec §11.7 calls `viewer_hash` "a practical uniqueness control, not a perfect
    identity claim". A /64 is the standard allocation handed to one residential
    or mobile subscriber, and every one of its 2**64 addresses is usable for
    outbound traffic — so an unmodified full-address hash lets one subscriber
    mint an unbounded number of "unique viewers", and no throttle catches it
    either (a fresh source address is also a fresh throttle bucket). Truncation
    is the standard mitigation.

    It is nonetheless OFF by default (`IPV6_HASH_PREFIX_BITS = 0`), for the same
    reason `TRUSTED_PROXY_COUNT` is 0: the safe-by-default value is the one that
    changes nothing until a deployment knowingly configures it. Enabling it
    merges every viewer sharing a prefix into one identity, which is a real
    accuracy cost, and the right prefix length depends on traffic nobody has
    seen yet. Set it to 64 once that traffic exists. IPv4 is never truncated —
    an IPv4 address is already one host, and masking it would merge unrelated
    subscribers.
    """
    bits = int(getattr(settings, "IPV6_HASH_PREFIX_BITS", 0) or 0)
    if bits <= 0 or bits >= 128 or address.version != 6:
        return address
    return ipaddress.ip_network(f"{address}/{bits}", strict=False).network_address


def canonical_client_ip(request) -> str | None:
    """The trusted client address for `request`, or None when none can be trusted."""
    trusted = int(getattr(settings, "TRUSTED_PROXY_COUNT", 0) or 0)
    remote_addr = _normalize(request.META.get("REMOTE_ADDR", ""))
    if trusted <= 0:
        return remote_addr

    chain = [
        part
        for part in (request.META.get(XFF_HEADER, "") or "").split(",")
        if part.strip()
    ]
    if len(chain) < trusted:
        # Fewer hops than we operate: this header did not come through our own
        # proxy chain, so none of it is evidence. Fall back to the socket.
        return remote_addr
    return _normalize(chain[-trusted])


def hash_client_ip(value: str) -> str:
    """Spec §11.7's HMAC — the single place this project derives an IP pseudonym.

    One function, one secret: rotating CONTACT_HASH_SECRET rotates every derived
    identifier (throttle buckets and `ListingView.viewer_hash`) at once.
    """
    return hmac.new(
        settings.CONTACT_HASH_SECRET.encode(), str(value).encode(), hashlib.sha256
    ).hexdigest()
