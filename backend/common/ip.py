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

There is exactly one other way a forwarded address is believed, merged in from PR
#103: our own Next.js server proves itself with `INTERNAL_SERVICE_SECRET` and names
the visitor in `X-Internal-Client-IP` (see `_internal_forwarded_ip`). That path is
authenticated, which is precisely what `X-Forwarded-For` is not. Both PRs reached
the same conclusion from different directions — #103 that SSR needs a trustworthy
way to forward a visitor IP, this one that nothing unauthenticated may set identity
— so the two live here together rather than as two competing resolvers.

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

# Set only by this project's own Next.js server on the SSR-to-API hop, where
# REMOTE_ADDR is the Next.js server's address rather than the visitor's. These
# live here, next to the resolver that is the only thing allowed to honour them,
# and are re-exported from common.throttling for its original importers.
INTERNAL_CLIENT_IP_HEADER = "HTTP_X_INTERNAL_CLIENT_IP"
INTERNAL_SERVICE_SECRET_HEADER = "HTTP_X_INTERNAL_SERVICE_SECRET"


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


def _internal_forwarded_ip(request) -> str | None:
    """The visitor IP our own Next.js server forwarded, if it proved who it is.

    Merged in from PR #103. On the SSR-to-API hop `REMOTE_ADDR` is the Next.js
    server's own address, so every server-rendered visitor would otherwise share
    one throttle bucket and one `viewer_hash`. Next.js therefore sends the real
    visitor address alongside a shared secret.

    The secret is what makes this safe, and it is the only reason a forwarded
    address is ever believed here: `X-Internal-Client-IP` on its own is exactly as
    forgeable as `X-Forwarded-For`. Compared with `hmac.compare_digest` so the
    comparison is not a timing oracle for the secret. An empty provided secret is
    rejected before comparing, so a deployment that somehow left
    INTERNAL_SERVICE_SECRET blank cannot be matched by sending no secret at all.
    """
    provided = request.META.get(INTERNAL_SERVICE_SECRET_HEADER, "")
    if not provided:
        return None
    expected = getattr(settings, "INTERNAL_SERVICE_SECRET", "") or ""
    if not expected or not hmac.compare_digest(provided.encode(), expected.encode()):
        return None
    # Authenticated, but still validated: a caller holding the secret is trusted
    # to name a visitor, not to inject an arbitrary string into a cache key.
    return _normalize(request.META.get(INTERNAL_CLIENT_IP_HEADER, ""))


def get_client_ip(request) -> str | None:
    """The trusted client address for `request`, or None when none can be trusted.

    The single client-IP resolver for this project: the throttle (spec §30.4) and
    `ListingView.viewer_hash` (spec §11.7) must agree on who a caller is, and two
    resolvers would eventually disagree.

    Order matters and is narrowest-evidence-first:

    1. A visitor address forwarded by our own Next.js server, accepted only on a
       valid `INTERNAL_SERVICE_SECRET`. This outranks `REMOTE_ADDR` because on
       that hop `REMOTE_ADDR` is known to be the wrong answer (it is Next.js).
    2. Otherwise `TRUSTED_PROXY_COUNT` hops counted from the RIGHT of
       `X-Forwarded-For`, which at the default of 0 means the header is ignored
       entirely and the socket address is used.

    An unauthenticated `X-Forwarded-For` is never trusted in either branch.
    """
    internal = _internal_forwarded_ip(request)
    if internal is not None:
        return internal

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


# Spec §11.7 names this concept `canonical_client_ip`, and Phase 10's later tasks
# import it under that name. One implementation, two spellings.
canonical_client_ip = get_client_ip


def hash_client_ip(value: str) -> str:
    """Spec §11.7's HMAC — the single place this project derives an IP pseudonym.

    One function, one secret: rotating CONTACT_HASH_SECRET rotates every derived
    identifier (throttle buckets and `ListingView.viewer_hash`) at once.
    """
    return hmac.new(
        settings.CONTACT_HASH_SECRET.encode(), str(value).encode(), hashlib.sha256
    ).hexdigest()
