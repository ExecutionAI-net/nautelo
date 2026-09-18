import hashlib
import hmac

from django.conf import settings
from rest_framework.throttling import ScopedRateThrottle

INTERNAL_CLIENT_IP_HEADER = "HTTP_X_INTERNAL_CLIENT_IP"
INTERNAL_SERVICE_SECRET_HEADER = "HTTP_X_INTERNAL_SERVICE_SECRET"


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
        ident = self._resolve_raw_ident(request)
        if not ident:
            return ident
        return hmac.new(
            settings.CONTACT_HASH_SECRET.encode(),
            ident.encode(),
            hashlib.sha256,
        ).hexdigest()

    def _resolve_raw_ident(self, request):
        """Resolve the un-hashed client identifier.

        Deliberately does not call ScopedRateThrottle/SimpleRateThrottle's own
        get_ident(): with REST_FRAMEWORK["NUM_PROXIES"] unset (this project's
        default), DRF trusts a client-supplied X-Forwarded-For verbatim,
        letting any anonymous caller pick its own throttle bucket. This
        resolver never consults X-Forwarded-For at all.

        The only way a forwarded IP is trusted is the internal secret below,
        set only by this project's own Next.js server (see
        frontend/src/lib/api/directory.ts) for the SSR-to-API hop, where
        REMOTE_ADDR is otherwise always the Next.js server's own address, not
        the visitor's.
        """
        provided_secret = request.META.get(INTERNAL_SERVICE_SECRET_HEADER, "")
        if provided_secret and hmac.compare_digest(
            provided_secret.encode(), settings.INTERNAL_SERVICE_SECRET.encode()
        ):
            forwarded_ip = request.META.get(INTERNAL_CLIENT_IP_HEADER, "").strip()
            if forwarded_ip:
                return forwarded_ip
        return request.META.get("REMOTE_ADDR")
