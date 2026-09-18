from rest_framework.throttling import ScopedRateThrottle

from common.ip import canonical_client_ip, hash_client_ip


class HashedIPScopedRateThrottle(ScopedRateThrottle):
    """ScopedRateThrottle that never lets a raw client IP reach the cache.

    DRF's SimpleRateThrottle.get_cache_key() embeds get_ident()'s return value
    verbatim, producing Redis keys like `throttle_auth_192.0.2.7`. Spec §30.4 is
    explicit: "Rate limiting must not store raw IP beyond approved security
    systems." Hashing the identifier keeps the throttle exactly as effective
    (the hash is stable and 1:1 with the address) while storing no readable one.

    Two things changed in Phase 10 and both matter:

    1. The address now comes from `common.ip.canonical_client_ip()`, which counts
       `settings.TRUSTED_PROXY_COUNT` hops from the RIGHT of `X-Forwarded-For`
       and, at the default of 0, ignores that header entirely.

       What this replaced is worse than "DRF picks the wrong entry". DRF's
       inherited `get_ident()` ends in
       `return ''.join(xff.split()) if xff else remote_addr`, so with
       `NUM_PROXIES` unset — and it is unset in this project — the identity IS
       the entire client-supplied header. No entry is selected. A caller who
       varied `X-Forwarded-For` on every request got a brand-new throttle bucket
       on every request: not bucket-sharing or impersonation, but an unlimited
       supply of buckets, i.e. no rate limit at all. (Note that once
       `NUM_PROXIES` IS set DRF counts from the right just as we do — the defect
       is entirely in its unconfigured default, which trusts the client.)
    2. The HMAC lives in `common.ip.hash_client_ip()` rather than inline, so the
       throttle and spec §11.7's `ListingView.viewer_hash` derive identities with
       one implementation and one secret (CONTACT_HASH_SECRET). Rotating that
       secret rotates both at once.

    There is deliberately NO `super().get_ident()` fallback. `super()` is the
    header-trusting method above; falling back to it when
    `canonical_client_ip()` returns None would re-open the whole vulnerability
    behind a condition an attacker can often arrange (an absent or unparseable
    REMOTE_ADDR happens under some ASGI/daphne, unix-socket and proxy-protocol
    setups). The fallback is `REMOTE_ADDR` read directly, which is the same
    evidence `canonical_client_ip()` uses and never consults a client header. If
    even that is absent the ident is empty — a single shared bucket for such
    requests, which is coarse but fails CLOSED rather than open.
    """

    def get_ident(self, request):
        ident = canonical_client_ip(request) or request.META.get("REMOTE_ADDR", "")
        if not ident:
            return ident
        return hash_client_ip(ident)
