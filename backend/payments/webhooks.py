"""Webhook intake: signature, replay, deduplication and dispatch
(spec §23.3 steps 1-3, §33.1, §41's Stripe webhooks reference).

This module handles UNTRUSTED input and contains no business rules. It never
logs the raw body, the signature header or the webhook secret, and it never
returns a reason to the caller — a verbose 400 is a signature oracle.
"""

import hashlib

import stripe
from django.db import IntegrityError, transaction

from .enums import STRIPE_SIGNATURE_TOLERANCE_SECONDS, WebhookResult
from .models import ProcessedWebhookEvent


class InvalidWebhookSignature(Exception):
    """The signature, its timestamp, or the secret did not check out."""


class InvalidWebhookPayload(Exception):
    """The body was not parseable JSON."""


class DuplicateWebhookEvent(Exception):
    """This stripe_event_id has already been processed (spec §23.3 step 3)."""


def payload_checksum(raw_body: bytes) -> str:
    """SHA-256 of the raw body.

    Stored so an operator can prove two deliveries carried identical bytes. It
    is never used to make a decision — `stripe_event_id` already is the
    decision — and deliberately holds no part of the body itself.
    """
    return hashlib.sha256(raw_body).hexdigest()


def verify_stripe_event(
    *,
    raw_body: bytes,
    signature_header: str,
    secret: str,
    tolerance: int = STRIPE_SIGNATURE_TOLERANCE_SECONDS,
):
    """Spec §23.3 steps 1-2 and §33.1.

    `stripe.Webhook.construct_event` is the library's own implementation of
    Stripe's documented scheme (`t=<unix>,v1=HMAC-SHA256(f"{t}.{payload}")`,
    compared in constant time) and it also enforces the replay window: a
    signature whose `t=` is further from now than `tolerance` is rejected even
    when the HMAC is perfect. `tolerance` is passed explicitly rather than left
    to the library default so a change to it is a visible diff.

    `stripe.SignatureVerificationError` is the modern top-level name.
    `stripe.error.SignatureVerificationError` still resolves in 15.x through a
    deprecated module alias, and the Phase 0/1 stub used it; do not copy that.

    No exception message from this function names the secret, the header or the
    body, and the caller turns every failure into a bodyless 400.
    """
    try:
        return stripe.Webhook.construct_event(
            raw_body, signature_header, secret, tolerance=tolerance
        )
    except ValueError as exc:
        raise InvalidWebhookPayload("Unparseable webhook body.") from exc
    except stripe.SignatureVerificationError as exc:
        raise InvalidWebhookSignature("Webhook signature verification failed.") from exc


# Filled by Tasks 10 and 11. Keyed by Stripe event type; each handler takes the
# verified event and returns a WebhookResult value. A type absent from this map
# is recorded as IGNORED and answered 200 — Stripe delivers whatever the
# endpoint is subscribed to, and a 500 on an unknown type would make it retry
# that event for days.
HANDLERS: dict = {}


def process_stripe_event(event, *, raw_body: bytes) -> str:
    """Spec §23.3 step 3 onwards, in ONE transaction.

    The dedup row and the handler's writes share a single atomic block, which
    gives three properties at once:

      * a duplicate delivery raises DuplicateWebhookEvent having written
        nothing, and the caller answers 200 (spec §23.3 step 3);
      * two CONCURRENT deliveries serialize on the unique index — the second
        blocks until the first commits, then fails the insert;
      * a crashed handler rolls the dedup row back with everything else, so
        Stripe's retry can still fulfil. Inserting the row in its own committed
        transaction first would leave a PERMANENT replay lock behind and the
        customer would never receive what they paid for.

    The inner atomic() around the insert is required, not stylistic: an
    IntegrityError poisons the transaction it occurs in, so without a savepoint
    the outer block would be unusable after catching it.
    """
    event_id = event["id"]
    event_type = event["type"]

    with transaction.atomic():
        try:
            with transaction.atomic():
                row = ProcessedWebhookEvent.objects.create(
                    stripe_event_id=event_id,
                    event_type=event_type,
                    payload_checksum=payload_checksum(raw_body),
                    result=WebhookResult.RECEIVED,
                )
        except IntegrityError as exc:
            raise DuplicateWebhookEvent(event_id) from exc

        handler = HANDLERS.get(event_type)
        result = WebhookResult.IGNORED if handler is None else handler(event)

        row.result = result
        row.save(update_fields=["result"])

    return result
