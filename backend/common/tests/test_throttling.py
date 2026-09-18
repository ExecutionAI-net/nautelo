from rest_framework.test import APIRequestFactory

from common.ip import XFF_HEADER, hash_client_ip
from common.throttling import HashedIPScopedRateThrottle


def test_the_cache_key_never_contains_the_raw_ip():
    request = APIRequestFactory().post("/api/v1/auth/register/", REMOTE_ADDR="198.51.100.9")
    throttle = HashedIPScopedRateThrottle()
    ident = throttle.get_ident(request)

    assert "198.51.100.9" not in ident
    assert len(ident) == 64  # sha256 hex
    # Deterministic: the same address must always map to the same bucket.
    assert throttle.get_ident(request) == ident


def test_the_throttle_bucket_is_derived_from_the_canonical_ip(settings):
    """One IP parser, one secret: the throttle and `viewer_hash` must agree."""
    settings.TRUSTED_PROXY_COUNT = 0
    request = APIRequestFactory().post(
        "/api/v1/auth/register/", REMOTE_ADDR="198.51.100.9"
    )

    assert HashedIPScopedRateThrottle().get_ident(request) == hash_client_ip(
        "198.51.100.9"
    )


def test_a_forged_forwarded_header_cannot_move_a_caller_to_a_fresh_bucket(settings):
    """Spec §30.4's limits are worthless if a header resets the counter.

    With no trusted proxies configured, two requests from one socket must land in
    one bucket no matter what X-Forwarded-For claims.
    """
    settings.TRUSTED_PROXY_COUNT = 0
    factory = APIRequestFactory()
    throttle = HashedIPScopedRateThrottle()

    honest = factory.post("/api/v1/auth/register/", REMOTE_ADDR="198.51.100.9")
    forged = factory.post(
        "/api/v1/auth/register/",
        REMOTE_ADDR="198.51.100.9",
        **{XFF_HEADER: "203.0.113.7"},
    )

    assert throttle.get_ident(forged) == throttle.get_ident(honest)


def test_rotating_the_forwarded_header_cannot_mint_endless_fresh_buckets(settings):
    """The actual pre-fix defect, stated precisely.

    DRF's unconfigured `get_ident()` returns `''.join(xff.split())` — the WHOLE
    header. So the bypass is not "impersonate one other address", it is "send a
    different header each time and never reuse a bucket". Three requests from one
    socket with three different headers must produce one identity, not three.
    """
    settings.TRUSTED_PROXY_COUNT = 0
    factory = APIRequestFactory()
    throttle = HashedIPScopedRateThrottle()

    idents = {
        throttle.get_ident(
            factory.post(
                "/api/v1/auth/register/",
                REMOTE_ADDR="198.51.100.9",
                **{XFF_HEADER: chain},
            )
        )
        for chain in ("203.0.113.7", "203.0.113.8, 10.0.0.1", "1.1.1.1, 2.2.2.2")
    }

    assert len(idents) == 1


def test_an_unresolvable_address_never_falls_back_to_drfs_header_trusting_logic(
    settings,
):
    """The fallback must not re-open the hole this class exists to close.

    When `canonical_client_ip()` cannot parse an address (no REMOTE_ADDR at all
    under some ASGI/unix-socket/proxy-protocol setups), delegating to
    `super().get_ident()` would hand identity back to the raw X-Forwarded-For
    header — the exact behaviour being replaced, reachable by simply omitting
    REMOTE_ADDR. The fallback is `REMOTE_ADDR` read directly, so an absent
    address yields an empty, header-independent ident instead.
    """
    settings.TRUSTED_PROXY_COUNT = 0
    throttle = HashedIPScopedRateThrottle()
    request = APIRequestFactory().post("/api/v1/auth/register/")
    request.META.pop("REMOTE_ADDR", None)
    request.META[XFF_HEADER] = "203.0.113.7"

    assert throttle.get_ident(request) == ""

    request.META[XFF_HEADER] = "198.51.100.9, 10.0.0.1"
    assert throttle.get_ident(request) == ""
