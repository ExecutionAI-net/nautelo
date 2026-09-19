"""Messaging error codes (spec 15.5, 30.2).

Each of these is an APIException subclass with a `default_code`, NOT a
ValidationError. That is deliberate and load-bearing:
common.exceptions.nauta_exception_handler maps EVERY ValidationError - subclass
or not - to code "validation_error", so a code that must reach the client as
`error.code` cannot be raised as a field error. Field errors still exist; they
arrive as `error.fields`, under the single code "validation_error".
"""

from rest_framework import status
from rest_framework.exceptions import APIException, Throttled


class InvalidInquiryContext(APIException):
    """The request itself is malformed: an unknown context_type or a
    context_id that is not a UUID. Never used for "not found" - see
    RecipientUnavailable."""

    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "This inquiry context is not recognised."
    default_code = "invalid_context"


class RecipientUnavailable(APIException):
    """The context does not resolve to something reachable: it does not exist,
    it is not published, or its owner is DRAFT/PENDING/SUSPENDED/inactive. All
    four answer identically on purpose (spec 34.3)."""

    status_code = status.HTTP_409_CONFLICT
    default_detail = "This recipient cannot receive messages right now."
    default_code = "recipient_unavailable"


class SelfInquiryNotAllowed(APIException):
    """Addition to spec 15.5's open list; see the plan's ruling."""

    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "You cannot send an inquiry to your own listing or profile."
    default_code = "self_inquiry_not_allowed"


class MessagingThrottled(Throttled):
    """429 with retry information (spec 30.4), under spec 15.5's own code name.

    DRF's stock Throttled uses code "throttled"; spec 15.5 names the code
    `rate_limited`, so the whole API speaks one vocabulary. `meta` rides the
    envelope passthrough common.exceptions.nauta_exception_handler already has,
    and DRF's handler independently sets the Retry-After header from `wait`.
    """

    default_detail = "You are sending messages too quickly."
    extra_detail_singular = "Try again in {wait} second."
    extra_detail_plural = "Try again in {wait} seconds."
    default_code = "rate_limited"

    def __init__(self, wait=None, detail=None, code=None):
        super().__init__(wait=wait, detail=detail, code=code)
        self.meta = {} if self.wait is None else {"retry_after_seconds": int(self.wait)}
