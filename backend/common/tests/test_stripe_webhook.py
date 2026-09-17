import json

from common.tests.stripe_helpers import generate_stripe_signature


def test_stripe_webhook_accepts_a_validly_signed_event(client, settings):
    settings.STRIPE_WEBHOOK_SECRET = "whsec_test_secret"
    payload = json.dumps(
        {"id": "evt_test", "type": "checkout.session.completed"}
    ).encode()
    signature = generate_stripe_signature(payload, "whsec_test_secret")

    response = client.post(
        "/api/v1/stripe/webhook/",
        data=payload,
        content_type="application/json",
        HTTP_STRIPE_SIGNATURE=signature,
    )

    assert response.status_code == 200


def test_stripe_webhook_rejects_an_invalid_signature(client, settings):
    settings.STRIPE_WEBHOOK_SECRET = "whsec_test_secret"
    payload = json.dumps(
        {"id": "evt_test", "type": "checkout.session.completed"}
    ).encode()

    response = client.post(
        "/api/v1/stripe/webhook/",
        data=payload,
        content_type="application/json",
        HTTP_STRIPE_SIGNATURE="t=1,v1=deadbeef",
    )

    assert response.status_code == 400
