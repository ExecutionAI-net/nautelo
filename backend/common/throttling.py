from rest_framework.throttling import ScopedRateThrottle

from common.ip import (
    INTERNAL_CLIENT_IP_HEADER,
    INTERNAL_SERVICE_SECRET_HEADER,
    get_client_ip,
    hash_client_ip,
)

# Re-exported: these constants were introduced in common.throttling by PR #103 and
# are imported from here. They now live beside the resolver that honours them.
__all__ = [
    "INTERNAL_CLIENT_IP_HEADER",
    "INTERNAL_SERVICE_SECRET_HEADER",
    "HashedIPScopedRateThrottle",
]


class HashedIPScopedRateThrottle(ScopedRateThrottle):
    """ScopedRateThrottle that never lets a raw client IP reach the cache.

    DRF's SimpleRateThrottle.get_cache_key() embeds get_ident()'s return value
    verbatim, producing Redis keys like `throttle_auth_192.0.2.7`. Spec §30.4 is
    explicit: "Rate limiting must not store raw IP beyond approved security
    systems." Hashing the identifier keeps the throttle exactly as effective
    (the hash is stable and 1:1 with the address) while storing no readable one.

    The HMAC key is CONTACT_HASH_SECRET, the same secret spec §11.7 mandates for
    `viewer_hash = HMAC-SHA256(CONTACT_HASH_SECRET, canonical_client_ip)` on
    ListingView. Reusing it keeps one IP-pseudonymization secret for the whole
    project, so rotating it rotates every derived identifier at once. The HMAC
    itself is `common.ip.hash_client_ip()` — one implementation, not a copy here.

    Identity resolution lives in `common.ip.get_client_ip()`, which is the single
    source of truth shared with spec §11.7's `viewer_hash`. It never consults an
    unauthenticated `X-Forwarded-For`: with REST_FRAMEWORK["NUM_PROXIES"] unset
    (this project's default) DRF's own get_ident() returns the entire
    client-supplied header verbatim, so any anonymous caller could mint a fresh
    throttle bucket per request. This class therefore never calls super().

    There is deliberately NO `super().get_ident()` fallback for the case where no
    address resolves: super() is exactly the header-trusting method above, so
    falling back to it would re-open the hole behind a condition an attacker can
    often arrange (an absent or unparseable REMOTE_ADDR happens under some
    ASGI/daphne, unix-socket and proxy-protocol setups). The fallback is
    REMOTE_ADDR read directly, and if even that is absent the ident is empty — a
    single shared bucket, coarse but failing CLOSED rather than open.
    """

    def get_ident(self, request):
        ident = self._resolve_raw_ident(request)
        if not ident:
            return ident
        return hash_client_ip(ident)

    def _resolve_raw_ident(self, request):
        """Resolve the un-hashed client identifier via the one shared resolver."""
        return get_client_ip(request) or request.META.get("REMOTE_ADDR", "")
