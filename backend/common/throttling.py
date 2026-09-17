import hashlib
import hmac

from django.conf import settings
from rest_framework.throttling import ScopedRateThrottle


class HashedIPScopedRateThrottle(ScopedRateThrottle):
    """ScopedRateThrottle that never lets a raw client IP reach the cache.

    DRF's SimpleRateThrottle.get_cache_key() embeds get_ident()'s return value
    verbatim, producing Redis keys like `throttle_auth_192.0.2.7`. Spec 30.4 is
    explicit: "Rate limiting must not store raw IP beyond approved security
    systems." Hashing the identifier keeps the throttle exactly as effective
    (the hash is stable and 1:1 with the IP) while storing no readable address.

    The HMAC key is CONTACT_HASH_SECRET, the same secret spec 11.7 already
    mandates for `viewer_hash = HMAC-SHA256(CONTACT_HASH_SECRET, canonical_client_ip)`
    on ListingView. Reusing it keeps one IP-pseudonymization secret for the whole
    project, so rotating it rotates every derived identifier at once.
    """

    def get_ident(self, request):
        ident = super().get_ident(request)
        if not ident:
            return ident
        return hmac.new(
            settings.CONTACT_HASH_SECRET.encode(),
            str(ident).encode(),
            hashlib.sha256,
        ).hexdigest()
