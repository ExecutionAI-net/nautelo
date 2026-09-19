"""Spec 15.2's "short-lived signed session" for a guest's inquiry draft.

This backend is headless and JWT-based: there is no Django session for an
anonymous API caller (SessionMiddleware exists for the admin). Rather than
inventing anonymous server-side session rows with their own table and sweeper,
the draft is signed with django.core.signing and handed to the browser, which
keeps it in sessionStorage. Both halves of the spec's phrase hold literally:
SIGNED (tamper-evident, keyed by SECRET_KEY plus a purpose-specific salt) and
SHORT-LIVED (a hard 30-minute TTL the client cannot extend).

The token is data restored into a form. It is not a capability: resolving it
requires a verified account, it carries no email address and no consent, and the
Send button still runs the full POST /api/v1/inquiries/ path with every check.
"""

from django.core import signing

from messaging.enums import DRAFT_TOKEN_MAX_AGE_SECONDS, DRAFT_TOKEN_SALT
from messaging.exceptions import InquiryDraftExpired, InvalidInquiryDraft

#: Exactly spec 15.2's "non-sensitive draft fields". Deliberately absent:
#: `email` (always taken from the authenticated account) and both consent flags.
DRAFT_FIELDS: tuple[str, ...] = (
    "context_type",
    "context_id",
    "full_name",
    "phone",
    "subject",
    "message",
)


def sign_inquiry_draft(payload: dict) -> str:
    return signing.dumps(
        {field: payload.get(field, "") for field in DRAFT_FIELDS},
        salt=DRAFT_TOKEN_SALT,
    )


def read_inquiry_draft(token: str) -> dict:
    try:
        data = signing.loads(
            token, salt=DRAFT_TOKEN_SALT, max_age=DRAFT_TOKEN_MAX_AGE_SECONDS
        )
    except signing.SignatureExpired:
        raise InquiryDraftExpired() from None
    except (signing.BadSignature, TypeError, ValueError):
        # BadSignature covers a tampered token AND one signed with a different
        # salt; TypeError/ValueError cover a token that is not even a string.
        raise InvalidInquiryDraft() from None

    if not isinstance(data, dict):
        raise InvalidInquiryDraft()
    # Re-project onto the known keys: a token minted by an older version with
    # extra keys must not smuggle them into the form.
    return {field: str(data.get(field, "")) for field in DRAFT_FIELDS}
