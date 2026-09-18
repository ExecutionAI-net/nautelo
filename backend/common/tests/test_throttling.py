from django.test import override_settings
from rest_framework.test import APIRequestFactory

from common.throttling import HashedIPScopedRateThrottle


def test_the_cache_key_never_contains_the_raw_ip():
    request = APIRequestFactory().post("/api/v1/auth/register/", REMOTE_ADDR="198.51.100.9")
    throttle = HashedIPScopedRateThrottle()
    ident = throttle.get_ident(request)

    assert "198.51.100.9" not in ident
    assert len(ident) == 64  # sha256 hex
    # Deterministic: the same address must always map to the same bucket.
    assert throttle.get_ident(request) == ident


@override_settings(INTERNAL_SERVICE_SECRET="test-internal-secret")
def test_a_valid_internal_secret_makes_the_forwarded_ip_the_throttle_identity():
    forwarded_request = APIRequestFactory().get(
        "/api/v1/service-categories/",
        REMOTE_ADDR="10.0.0.5",  # the Next.js server's own address
        HTTP_X_INTERNAL_SERVICE_SECRET="test-internal-secret",
        HTTP_X_INTERNAL_CLIENT_IP="198.51.100.42",  # the real visitor's address
    )
    direct_request = APIRequestFactory().get(
        "/api/v1/service-categories/", REMOTE_ADDR="198.51.100.42"
    )
    throttle = HashedIPScopedRateThrottle()

    # Same hash as hashing the visitor's IP directly as REMOTE_ADDR, proving
    # the forwarded value - not the Next.js server's REMOTE_ADDR - won.
    assert throttle.get_ident(forwarded_request) == throttle.get_ident(direct_request)


@override_settings(INTERNAL_SERVICE_SECRET="test-internal-secret")
def test_a_wrong_internal_secret_ignores_the_forwarded_ip():
    wrong_secret_request = APIRequestFactory().get(
        "/api/v1/service-categories/",
        REMOTE_ADDR="10.0.0.5",
        HTTP_X_INTERNAL_SERVICE_SECRET="not-the-real-secret",
        HTTP_X_INTERNAL_CLIENT_IP="198.51.100.42",
    )
    no_header_request = APIRequestFactory().get(
        "/api/v1/service-categories/", REMOTE_ADDR="10.0.0.5"
    )
    throttle = HashedIPScopedRateThrottle()

    assert throttle.get_ident(wrong_secret_request) == throttle.get_ident(no_header_request)


def test_an_unauthenticated_x_forwarded_for_header_is_never_trusted():
    # Regression guard for the pre-existing global gap: with NUM_PROXIES unset
    # (this project's default), DRF's own SimpleRateThrottle.get_ident() would
    # trust this header verbatim. This class must never call that method.
    spoofed_request = APIRequestFactory().get(
        "/api/v1/auth/login/",
        REMOTE_ADDR="203.0.113.7",
        HTTP_X_FORWARDED_FOR="1.2.3.4",
    )
    plain_request = APIRequestFactory().get(
        "/api/v1/auth/login/", REMOTE_ADDR="203.0.113.7"
    )
    throttle = HashedIPScopedRateThrottle()

    assert throttle.get_ident(spoofed_request) == throttle.get_ident(plain_request)
