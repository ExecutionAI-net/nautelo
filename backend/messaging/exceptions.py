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


class InquiryInitiatorNotAllowed(APIException):
    """Only private sellers start conversations. Broker and professional
    accounts answer the threads they receive but never open new ones."""

    status_code = status.HTTP_403_FORBIDDEN
    default_detail = "Business accounts can reply to messages but cannot start new conversations."
    default_code = "inquiry_initiator_not_allowed"


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


class FeatureDisabled(APIException):
    """Spec 35.1's flag, off.

    Raised from UnifiedInquiriesEnabled.has_permission() rather than signalled by
    returning False, because DRF's APIView.permission_denied() short-circuits to
    `401 NotAuthenticated` for any request without credentials and never reaches
    a permission class's `code`. On the AllowAny guest-draft route that would
    have answered `401 authentication_required` to a flag-off request. See the
    permission class's docstring.
    """

    status_code = status.HTTP_403_FORBIDDEN
    default_detail = "Inquiries are temporarily unavailable."
    default_code = "feature_disabled"


class ConsentRequired(APIException):
    """Spec 15.1's required privacy consent, and spec 33.2's "Obtain required
    consent/version on inquiry". Raised both when the checkbox is missing and
    when the submitted version is not the current one - a consent recorded
    against a superseded policy is not consent to the current one."""

    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "Accept the current privacy policy to send this message."
    default_code = "consent_required"


class SpamDetected(APIException):
    """Spec 15.1's honeypot. Addition to spec 15.5's open error list.

    A visible code rather than a fake 201: spec 2.1 and 39 forbid faked state,
    the frontend would otherwise render "message sent" for a message that does
    not exist, and no client-side test could tell the two apart. The cost - a
    determined bot learns the field name - is accepted and written down. See the
    plan's ruling.
    """

    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "This submission could not be accepted."
    default_code = "spam_detected"


class InvalidInquiryDraft(APIException):
    """A draft token that is not ours, or has been altered."""

    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "This saved draft could not be read."
    default_code = "invalid_draft"


class InquiryDraftExpired(APIException):
    """Spec 15.2's "short-lived" half, made visible.

    A separate code from invalid_draft because the two mean different things to
    a person: "start again" versus "something is wrong". 400 rather than 410,
    because the draft is a value inside the request body, not the resource the
    URL names.
    """

    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "This saved draft has expired. Please retype your message."
    default_code = "draft_expired"


class ConversationClosed(APIException):
    """Spec 36.6: "Recipient blocking a user prevents new messages."

    ARCHIVED is refused for the same reason, deliberately: archiving is a filing
    decision by one side, and silently re-opening a thread because the other
    side typed into it would undo it without asking. Nothing in this phase
    archives or blocks a thread - Phase 19's inbox and any future staff
    moderation are the producers - so today this is a guard, and the guard is
    what makes those phases safe to build.
    """

    status_code = status.HTTP_409_CONFLICT
    default_detail = "This conversation is closed."
    default_code = "conversation_closed"


class InvalidConversationStatus(APIException):
    """Spec 28's Archived filter needs a producer; BLOCKED is not one.

    A ChoiceField would have been the obvious way to reject this, and a
    max_length the obvious way to bound it. Both are wrong here: every DRF
    ValidationError collapses to code "validation_error" in
    common.exceptions.nauta_exception_handler (common/exceptions.py:107-110),
    so the named code spec 30.2 asks for would never reach a client — and it
    would fail exactly on the oversized input an attacker sends first. The
    serializer therefore accepts any string of any length and the service
    raises this.
    """

    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "A conversation may only be set to OPEN or ARCHIVED."
    default_code = "invalid_conversation_status"


class ConversationSuperseded(APIException):
    """Re-opening an archived thread collided with a newer open one.

    Conversation's three uniqueness constraints are PARTIAL indexes conditioned
    on status=OPEN (messaging/models.py:111-133), precisely so an archived thread
    does not block a new inquiry. The consequence is that un-archiving is not
    always possible, and that is a 409, not a 500.
    """

    status_code = status.HTTP_409_CONFLICT
    default_detail = "A newer open conversation already exists for this context."
    default_code = "conversation_superseded"


class ConversationFilingForbidden(APIException):
    """Only the RECIPIENT side may file a conversation (the plan's ruling 5).

    Spec 11.8 gives Conversation ONE status column, so archiving is shared. A
    sender who could archive would remove their own live lead from the
    brokerage's default OPEN inbox — the screen spec 28 exists to build. Spec
    2.2 puts that refusal on the server.

    403 rather than 404 on purpose: the initiator MAY see this conversation, so
    pretending it does not exist would be theatre. 404 is reserved for callers
    who may not see it at all.
    """

    status_code = status.HTTP_403_FORBIDDEN
    default_detail = "Only the recipient of a conversation can file it."
    default_code = "conversation_filing_forbidden"
