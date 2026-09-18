"""Spec §23.3 steps 1-3 and §33.1's "Verify Stripe signatures from raw body".

These tests deliberately use the REAL stripe library for verification: forging a
signature against Stripe's actual HMAC scheme is the whole point, and a mocked
verifier would prove nothing. No network is involved — construct_event is pure
computation, which is why conftest's `no_network` fixture does not patch it.
"""

import json
import time

import pytest
from rest_framework.test import APIClient

from common.tests.stripe_helpers import generate_stripe_signature
from payments.enums import WebhookResult
from payments.models import ProcessedWebhookEvent
from payments.webhooks import (
    DuplicateWebhookEvent,
    InvalidWebhookPayload,
    InvalidWebhookSignature,
    payload_checksum,
    process_stripe_event,
    verify_stripe_event,
)

WEBHOOK_URL = "/api/v1/stripe/webhook/"
SECRET = "whsec_phase14_test"


def body(**overrides):
    payload = {
        "id": "evt_p14_1",
        "type": "checkout.session.completed",
        "data": {"object": {"id": "cs_test_1"}},
    }
    payload.update(overrides)
    return json.dumps(payload).encode()


@pytest.fixture
def api_client():
    return APIClient()


def post_webhook(client, raw, signature):
    return client.post(
        WEBHOOK_URL,
        data=raw,
        content_type="application/json",
        HTTP_STRIPE_SIGNATURE=signature,
    )


def test_a_valid_signature_verifies(settings):
    raw = body()

    event = verify_stripe_event(
        raw_body=raw,
        signature_header=generate_stripe_signature(raw, SECRET),
        secret=SECRET,
    )

    assert event["id"] == "evt_p14_1"
    assert event["type"] == "checkout.session.completed"


def test_a_forged_signature_is_refused():
    raw = body()

    with pytest.raises(InvalidWebhookSignature):
        verify_stripe_event(
            raw_body=raw, signature_header="t=1,v1=deadbeef", secret=SECRET
        )


def test_a_signature_made_with_the_wrong_secret_is_refused():
    raw = body()

    with pytest.raises(InvalidWebhookSignature):
        verify_stripe_event(
            raw_body=raw,
            signature_header=generate_stripe_signature(raw, "whsec_attacker"),
            secret=SECRET,
        )


def test_a_signature_for_a_different_body_is_refused():
    """The classic substitution attack: a genuine signature lifted from one
    delivery and pasted onto a body the attacker wrote."""
    genuine = generate_stripe_signature(body(), SECRET)
    tampered = body(data={"object": {"id": "cs_attacker"}})

    with pytest.raises(InvalidWebhookSignature):
        verify_stripe_event(
            raw_body=tampered, signature_header=genuine, secret=SECRET
        )


def test_a_genuine_but_stale_signature_is_refused_by_the_tolerance_window():
    """Spec §23.3 step 2 plus Stripe's replay guidance: the signature below is
    cryptographically PERFECT — only its timestamp is old."""
    raw = body()
    stale = generate_stripe_signature(
        raw, SECRET, timestamp=int(time.time()) - 3600
    )

    with pytest.raises(InvalidWebhookSignature):
        verify_stripe_event(raw_body=raw, signature_header=stale, secret=SECRET)


def test_a_signature_just_inside_the_window_is_accepted():
    """The positive half — without it, a tolerance of zero would pass every
    negative test above while rejecting all real traffic."""
    raw = body()
    recent = generate_stripe_signature(raw, SECRET, timestamp=int(time.time()) - 60)

    event = verify_stripe_event(raw_body=raw, signature_header=recent, secret=SECRET)

    assert event["id"] == "evt_p14_1"


def test_an_empty_signature_header_is_refused():
    with pytest.raises(InvalidWebhookSignature):
        verify_stripe_event(raw_body=body(), signature_header="", secret=SECRET)


def test_a_malformed_body_is_a_payload_error_not_a_signature_error():
    raw = b"{not json"

    with pytest.raises(InvalidWebhookPayload):
        verify_stripe_event(
            raw_body=raw,
            signature_header=generate_stripe_signature(raw, SECRET),
            secret=SECRET,
        )


@pytest.mark.django_db
def test_the_endpoint_accepts_a_validly_signed_event(api_client, settings):
    settings.STRIPE_WEBHOOK_SECRET = SECRET
    raw = body()

    response = post_webhook(api_client, raw, generate_stripe_signature(raw, SECRET))

    assert response.status_code == 200
    assert ProcessedWebhookEvent.objects.count() == 1


@pytest.mark.django_db
def test_the_endpoint_refuses_a_forged_signature_with_an_empty_400(
    api_client, settings
):
    """Spec §23's acceptance list: "Forged/invalid signature produces 400 and no
    state change." The empty body is deliberate — a reason string would be a
    signature oracle."""
    settings.STRIPE_WEBHOOK_SECRET = SECRET
    raw = body()

    response = post_webhook(api_client, raw, "t=1,v1=deadbeef")

    assert response.status_code == 400
    assert response.content == b""
    assert ProcessedWebhookEvent.objects.count() == 0


@pytest.mark.django_db
def test_the_endpoint_verifies_the_exact_bytes_django_received(
    api_client, settings
):
    """Spec §33.1: "Verify Stripe signatures from raw body." A view that parsed
    the JSON and re-serialized it would produce different bytes — different key
    order, different unicode escaping, different whitespace — and every genuine
    delivery would fail. This payload is built to break any such view."""
    settings.STRIPE_WEBHOOK_SECRET = SECRET
    raw = (
        b'{\n  "type" : "checkout.session.completed",\n'
        b'  "id":"evt_raw_bytes",\n'
        b'  "data": {"object": {"id": "cs_\\u00e9\\u00e0"}}\n}'
    )

    response = post_webhook(api_client, raw, generate_stripe_signature(raw, SECRET))

    assert response.status_code == 200
    stored = ProcessedWebhookEvent.objects.get()
    assert stored.stripe_event_id == "evt_raw_bytes"
    assert stored.payload_checksum == payload_checksum(raw)


@pytest.mark.django_db
def test_a_duplicate_event_id_returns_200_and_writes_nothing_new(
    api_client, settings
):
    """Spec §23.3 step 3, verbatim: "duplicate event ID returns HTTP 200
    without re-fulfillment"."""
    settings.STRIPE_WEBHOOK_SECRET = SECRET
    raw = body()

    first = post_webhook(api_client, raw, generate_stripe_signature(raw, SECRET))
    second = post_webhook(api_client, raw, generate_stripe_signature(raw, SECRET))

    assert (first.status_code, second.status_code) == (200, 200)
    assert ProcessedWebhookEvent.objects.count() == 1


@pytest.mark.django_db
def test_an_unhandled_event_type_is_recorded_as_ignored(api_client, settings):
    """Stripe delivers whatever the endpoint is subscribed to. An unknown type
    must be a 200 no-op, never a 500 that makes Stripe retry forever."""
    settings.STRIPE_WEBHOOK_SECRET = SECRET
    raw = body(id="evt_unknown", type="customer.subscription.created")

    response = post_webhook(api_client, raw, generate_stripe_signature(raw, SECRET))

    assert response.status_code == 200
    assert ProcessedWebhookEvent.objects.get().result == WebhookResult.IGNORED


@pytest.mark.django_db
def test_a_handler_crash_releases_the_replay_lock(monkeypatch, settings):
    """The critical failure-mode test. If the dedup row survived a crashed
    handler, Stripe's retry would be treated as a duplicate and the customer's
    payment would never be fulfilled."""
    import payments.webhooks as webhooks

    def _boom(event, **kwargs):
        raise RuntimeError("database went away")

    monkeypatch.setitem(webhooks.HANDLERS, "checkout.session.completed", _boom)
    raw = body(id="evt_crash")
    event = verify_stripe_event(
        raw_body=raw,
        signature_header=generate_stripe_signature(raw, SECRET),
        secret=SECRET,
    )

    with pytest.raises(RuntimeError):
        process_stripe_event(event, raw_body=raw)

    assert ProcessedWebhookEvent.objects.filter(stripe_event_id="evt_crash").count() == 0


@pytest.mark.django_db
def test_a_second_call_for_the_same_event_id_raises_duplicate(settings):
    raw = body(id="evt_twice")
    event = verify_stripe_event(
        raw_body=raw,
        signature_header=generate_stripe_signature(raw, SECRET),
        secret=SECRET,
    )

    process_stripe_event(event, raw_body=raw)

    with pytest.raises(DuplicateWebhookEvent):
        process_stripe_event(event, raw_body=raw)


@pytest.mark.django_db
def test_the_webhook_view_is_unauthenticated_ungated_and_unthrottled():
    """Three properties Stripe's retry behaviour depends on:
      * no authentication - Stripe carries no JWT
      * no feature flag - see the plan's ruling; a disabled flag must not
        strand a payment that has already been taken
      * no throttle scope - throttling Stripe's retries would MANUFACTURE the
        paid-not-fulfilled state spec §35.4 tells us to watch for
    """
    from rest_framework.permissions import AllowAny

    from payments.views import StripeWebhookView

    assert StripeWebhookView.authentication_classes == []
    assert StripeWebhookView.permission_classes == [AllowAny]
    assert getattr(StripeWebhookView, "throttle_scope", None) is None
    assert StripeWebhookView.http_method_names == ["post", "options"]


@pytest.mark.django_db
def test_no_secret_reaches_the_response_or_the_stored_row(api_client, settings):
    settings.STRIPE_WEBHOOK_SECRET = SECRET
    raw = body(id="evt_secret_check")

    ok = post_webhook(api_client, raw, generate_stripe_signature(raw, SECRET))
    bad = post_webhook(api_client, raw, "t=1,v1=deadbeef")

    assert SECRET not in ok.content.decode()
    assert SECRET not in bad.content.decode()
    stored = ProcessedWebhookEvent.objects.get(stripe_event_id="evt_secret_check")
    assert SECRET not in str(stored.__dict__)


def test_the_old_common_webhook_view_is_gone():
    """The route moved; leaving a second endpoint alive that verifies a
    signature and then discards the event would be worse than none."""
    import common.views

    assert not hasattr(common.views, "StripeWebhookView")


@pytest.mark.django_db
def test_the_route_name_and_path_are_unchanged():
    """spec §30.1's `POST /api/v1/stripe/webhook/`. Changing it would mean
    reconfiguring every Stripe environment."""
    from django.urls import reverse

    assert reverse("stripe-webhook") == WEBHOOK_URL
