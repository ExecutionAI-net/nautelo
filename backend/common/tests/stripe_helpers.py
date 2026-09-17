import hashlib
import hmac
import time


def generate_stripe_signature(payload: bytes, secret: str) -> str:
    timestamp = int(time.time())
    signed_payload = f"{timestamp}.{payload.decode()}"
    signature = hmac.new(
        secret.encode(), signed_payload.encode(), hashlib.sha256
    ).hexdigest()
    return f"t={timestamp},v1={signature}"
