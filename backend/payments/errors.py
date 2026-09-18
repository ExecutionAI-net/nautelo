"""Every wire code this phase introduces (spec §30.2).

All of them are APIException subclasses with an explicit `default_code`, NEVER
DRF ValidationErrors: `common.exceptions.nauta_exception_handler` maps every
ValidationError — subclass or not — onto the single envelope code
`validation_error` and flattens its detail with `str()`, so a named code carried
on a ValidationError would be invisible to the client that has to branch on it.

`meta` is the merged handler's one passthrough for extra context. It must never
contain a secret, a raw webhook body, a signature header or anything Stripe sent
verbatim.
"""

from rest_framework.exceptions import APIException


class _MetaAPIException(APIException):
    """APIException that also carries `common.exceptions`' `meta` passthrough."""

    def __init__(self, detail=None, code=None, **meta):
        super().__init__(detail=detail, code=code)
        self.meta = {key: value for key, value in meta.items() if value is not None}


class ProductNotAvailable(_MetaAPIException):
    status_code = 409
    default_detail = "This product is not available for purchase right now."
    default_code = "product_not_available"


class ProductPriceMismatch(_MetaAPIException):
    """Spec §23.5: "A warning is shown if stored display amount differs from
    Stripe's current Price; Checkout is blocked until reconciled"."""

    status_code = 409
    default_detail = "This product's price needs to be reconciled before purchase."
    default_code = "product_price_mismatch"


class InvalidReturnUrl(_MetaAPIException):
    """Spec §33.1: "Allowlist local return URLs; prevent open redirects"."""

    status_code = 400
    default_detail = "That return address is not allowed."
    default_code = "invalid_return_url"


class ListingRequiredForProduct(_MetaAPIException):
    status_code = 400
    default_detail = "Choose which listing this upgrade applies to."
    default_code = "listing_required_for_product"


class ListingNotUpgradable(_MetaAPIException):
    status_code = 409
    default_detail = "This listing cannot be upgraded."
    default_code = "listing_not_upgradable"


class IdempotencyKeyRequired(_MetaAPIException):
    """Spec §30.3: "Require Idempotency-Key for Checkout creation"."""

    status_code = 400
    default_detail = "An Idempotency-Key header is required."
    default_code = "idempotency_key_required"


class IdempotencyKeyReused(_MetaAPIException):
    status_code = 409
    default_detail = "That Idempotency-Key was already used for a different request."
    default_code = "idempotency_key_reused"


class PaymentGatewayUnavailable(_MetaAPIException):
    status_code = 502
    default_detail = "The payment provider is unavailable. Try again shortly."
    default_code = "payment_gateway_unavailable"
