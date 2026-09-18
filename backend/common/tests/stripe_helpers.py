import hashlib
import hmac
import time


def generate_stripe_signature(
    payload: bytes, secret: str, *, timestamp: int | None = None
) -> str:
    """Stripe's real scheme: t=<unix>,v1=HMAC-SHA256(f"{t}.{payload}").

    `timestamp` is settable so a test can forge a genuine-but-stale signature
    and prove the tolerance window actually rejects a replay.
    """
    timestamp = int(time.time()) if timestamp is None else timestamp
    signed_payload = f"{timestamp}.{payload.decode()}"
    signature = hmac.new(
        secret.encode(), signed_payload.encode(), hashlib.sha256
    ).hexdigest()
    return f"t={timestamp},v1={signature}"
