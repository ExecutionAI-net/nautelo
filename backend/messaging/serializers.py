"""Request and response shapes for spec 15.5."""

import re

from rest_framework import serializers

from messaging.enums import (
    CURRENT_PRIVACY_POLICY_VERSION,
    FULL_NAME_MAX_LENGTH,
    FULL_NAME_MIN_LENGTH,
    HONEYPOT_FIELD_NAME,
    MESSAGE_MAX_LENGTH,
    MESSAGE_MIN_LENGTH,
    PHONE_MAX_LENGTH,
    SUBJECT_MAX_LENGTH,
    SUBJECT_MIN_LENGTH,
)
from messaging.exceptions import ConsentRequired, SpamDetected
from messaging.services import message_excerpt

#: Spec 15.1: "E.164-compatible input and country selector." E.164 is a leading
#: "+", a non-zero country code digit, then up to 14 more digits. The bound here
#: is deliberately loose at the low end (7 total) because some national numbers
#: are short, and hard at the high end (15) because E.164 says so.
E164_PATTERN = re.compile(r"^\+[1-9]\d{6,14}$")
_PHONE_NOISE = re.compile(r"[\s()\-.]")

EMAIL_MISMATCH_MESSAGE = "Send from your own verified account email address."


class InquirySubmissionSerializer(serializers.Serializer):
    """Spec 15.1's field table and spec 15.5's request body.

    `context_type` and `context_id` are plain CharFields on purpose. A
    ChoiceField or a UUIDField would reject a bad value as a ValidationError,
    which this project's envelope renders as code "validation_error" - but spec
    15.5 names a specific code, `invalid_context`, for exactly this case. Both
    fields are therefore passed through to resolve_inquiry_context(), which owns
    that code and is the single place context is judged.
    """

    context_type = serializers.CharField(max_length=32)
    context_id = serializers.CharField(max_length=64)
    full_name = serializers.CharField(
        min_length=FULL_NAME_MIN_LENGTH,
        max_length=FULL_NAME_MAX_LENGTH,
        trim_whitespace=True,
    )
    email = serializers.EmailField()
    phone = serializers.CharField(
        required=False, allow_blank=True, max_length=PHONE_MAX_LENGTH
    )
    subject = serializers.CharField(
        min_length=SUBJECT_MIN_LENGTH,
        max_length=SUBJECT_MAX_LENGTH,
        trim_whitespace=True,
    )
    message = serializers.CharField(
        min_length=MESSAGE_MIN_LENGTH, max_length=MESSAGE_MAX_LENGTH
    )
    privacy_policy_version = serializers.CharField(
        required=False, allow_blank=True, max_length=16, default=""
    )
    privacy_consent = serializers.BooleanField(required=False, default=False)
    # Spec 15.1: "Optional, separate, unchecked; never required for inquiry."
    marketing_consent = serializers.BooleanField(required=False, default=False)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Declared dynamically so the honeypot's name lives in exactly one
        # place, messaging.enums.HONEYPOT_FIELD_NAME, which is also what
        # GET /api/v1/inquiries/config/ tells the form to render.
        self.fields[HONEYPOT_FIELD_NAME] = serializers.CharField(
            required=False, allow_blank=True, default=""
        )

    def validate_phone(self, value):
        if not value:
            return ""
        normalized = _PHONE_NOISE.sub("", value)
        if not E164_PATTERN.match(normalized):
            raise serializers.ValidationError(
                "Enter a phone number in international format, for example +390000000000.",
                code="invalid_phone",
            )
        return normalized

    def validate_email(self, value):
        """Spec 15's definition of done: the email "cannot be forged to another
        account". The account address is what is actually stored either way
        (services.submit_inquiry reads actor.email); refusing the mismatch as
        well means a client can never believe it sent as somebody else."""
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if user is None or not user.is_authenticated:
            return value
        if value.strip().casefold() != user.email.casefold():
            raise serializers.ValidationError(
                EMAIL_MISMATCH_MESSAGE, code="email_mismatch"
            )
        return value

    def validate(self, attrs):
        if attrs.get(HONEYPOT_FIELD_NAME, "").strip():
            raise SpamDetected()
        if not attrs.get("privacy_consent"):
            raise ConsentRequired()
        if attrs.get("privacy_policy_version") != CURRENT_PRIVACY_POLICY_VERSION:
            raise ConsentRequired()
        return attrs


class InquiryResultSerializer(serializers.Serializer):
    """Spec 15.5's success body, field for field."""

    conversation_id = serializers.SerializerMethodField()
    message_id = serializers.SerializerMethodField()
    contact_access = serializers.CharField()
    next_url = serializers.CharField()

    def get_conversation_id(self, result) -> str:
        return str(result.conversation.pk)

    def get_message_id(self, result) -> str:
        return str(result.message.pk)


class InquiryDraftCreateSerializer(serializers.Serializer):
    """No minimum lengths: a draft is work in progress, not a submission. The
    maximums are kept so the signed token cannot be inflated without bound."""

    context_type = serializers.CharField(max_length=32)
    context_id = serializers.CharField(max_length=64)
    full_name = serializers.CharField(
        required=False, allow_blank=True, max_length=FULL_NAME_MAX_LENGTH, default=""
    )
    phone = serializers.CharField(
        required=False, allow_blank=True, max_length=PHONE_MAX_LENGTH, default=""
    )
    subject = serializers.CharField(
        required=False, allow_blank=True, max_length=SUBJECT_MAX_LENGTH, default=""
    )
    message = serializers.CharField(
        required=False, allow_blank=True, max_length=MESSAGE_MAX_LENGTH, default=""
    )


class InquiryDraftResolveSerializer(serializers.Serializer):
    draft_token = serializers.CharField(max_length=8000)


class ConversationSerializer(serializers.Serializer):
    """Spec 28's conversation row. Carries no contact value of any kind."""

    id = serializers.UUIDField(read_only=True)
    conversation_type = serializers.CharField(read_only=True)
    subject = serializers.CharField(read_only=True)
    status = serializers.CharField(read_only=True)
    last_message_at = serializers.DateTimeField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    unread_count = serializers.IntegerField(read_only=True)
    context = serializers.SerializerMethodField()
    counterparty_name = serializers.SerializerMethodField()
    last_message_excerpt = serializers.SerializerMethodField()
    viewer_is_initiator = serializers.SerializerMethodField()

    def _viewer(self):
        return self.context["request"].user

    def get_context(self, conversation) -> dict:
        """Spec 28's "context/listing" for the row, and the thread's
        "listing/profile link".

        `url` is the entity's CANONICAL public URL per spec 4.1, derived here
        because spec 2.1 requires a backend source for every visible state and a
        client must not assemble a slug URL from a label. It is None where no
        canonical URL can be derived:

        * LISTING — `listings.BoatListing` has no slug column, and spec 4.1's
          canonical boat URL is `/boats/<listing-slug>/`. Phase 20 owns the boat
          detail page and fills this in.
        * SUPPORT — there is no public page for a support thread.

        A non-None url does NOT promise the page is built: `/brokers/<slug>/` is
        canonical per spec 4.1 but has no Next.js route yet. The client keeps the
        one-line allowlist of prefixes it can actually navigate to; see the
        plan's ruling 9.
        """
        if conversation.listing_id is not None:
            snapshot = conversation.listing.current_public_snapshot
            label = ""
            if snapshot is not None:
                model_name = (
                    snapshot.custom_model_name_snapshot
                    or snapshot.model_name_snapshot
                )
                label = f"{snapshot.brand_name_snapshot} {model_name}".strip()
            return {
                "type": "LISTING",
                "id": str(conversation.listing_id),
                "label": label,
                "url": (
                    f"/boats/{conversation.listing.slug}/"
                    if conversation.listing.slug
                    else None
                ),
            }
        if conversation.broker_id is not None:
            return {
                "type": "BROKER",
                "id": str(conversation.broker_id),
                "label": conversation.broker.name,
                "url": f"/brokers/{conversation.broker.slug}/",
            }
        if conversation.professional_id is not None:
            return {
                "type": "PROFESSIONAL",
                "id": str(conversation.professional_id),
                "label": conversation.professional.display_name,
                "url": (
                    f"/services/professionals/{conversation.professional.slug}/"
                ),
            }
        return {"type": "SUPPORT", "id": "", "label": "", "url": None}

    def get_viewer_is_initiator(self, conversation) -> bool:
        """Whose seat is this? Spec 2.1: every visible state needs a backend
        source, and the thread's archive control is a visible state — only the
        recipient side may file a conversation (the plan's ruling 5). Without
        this field the client would have to infer the seat from
        `counterparty_name`, which is display text, not authorization data."""
        return conversation.initiator_id == self._viewer().pk

    def get_counterparty_name(self, conversation) -> str:
        """Who the OTHER side is, from this viewer's seat.

        For the initiator it is the context's own public label - never the
        private seller's personal name, which is not public information and is
        not what a grant reveals either. For the recipient it is the name the
        sender stated on their first message (spec 15.1's Full name), read from
        the snapshot rather than joined to a live profile.

        `first_sender_name` is an annotation from selectors.annotate_last_message();
        reading `conversation.messages.first()` here instead would be one query
        per row (spec 33.3). It may legitimately be the empty string - see
        services._reply_display_name - and the client renders the localized
        `inquiry.sender_unnamed` string for that case rather than showing an
        email address.
        """
        if conversation.initiator_id == self._viewer().pk:
            return self.get_context(conversation)["label"]
        return getattr(conversation, "first_sender_name", None) or ""

    def get_last_message_excerpt(self, conversation) -> str:
        # Annotation, not a per-row query - same reason as above.
        body = getattr(conversation, "last_message_body", None) or ""
        return message_excerpt(body) if body else ""


class MessageSerializer(serializers.Serializer):
    """One message in a thread.

    Returns NO email address and NO phone number - not the sender's, not the
    recipient's. `sender_email_snapshot` and `sender_phone_snapshot` are stored
    for the record (spec 11.8, 15.1) and served by nothing in this phase; contact
    reveal is Phase 7's, through its own endpoint, after a grant.
    """

    id = serializers.UUIDField(read_only=True)
    body = serializers.CharField(read_only=True)
    is_system = serializers.BooleanField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    read_at = serializers.DateTimeField(read_only=True)
    sender = serializers.SerializerMethodField()

    def get_sender(self, message) -> dict:
        """`display_name` may be the empty string, and that is the correct
        answer for a replier whose account has no name: the alternative -
        User.get_full_name()'s `full_name or email` - would publish an email
        address to the other party. The client renders the localized
        `inquiry.sender_unnamed` string for a blank name (spec 37)."""
        viewer = self.context["request"].user
        return {
            "display_name": message.sender_name_snapshot,
            "is_you": message.sender_id == viewer.pk,
        }


class MessageCreateSerializer(serializers.Serializer):
    """Spec 15.1's Message rule applies to a reply too: 20-4000 characters."""

    message = serializers.CharField(
        min_length=MESSAGE_MIN_LENGTH, max_length=MESSAGE_MAX_LENGTH
    )


class ConversationStatusSerializer(serializers.Serializer):
    """Body of PATCH /api/v1/conversations/<id>/status/.

    A plain CharField with a blank default and NO max_length. Both a ChoiceField
    and a length bound would raise DRF ValidationError, which this project's
    envelope collapses to code "validation_error" (Phase 6 contract rule 10) —
    and the length bound would do it for precisely the oversized input that most
    needs a stable code. Letting every value through to
    services.set_conversation_status means a missing, blank, nonsense or
    500-character status all answer with the named `invalid_conversation_status`.
    """

    status = serializers.CharField(required=False, allow_blank=True, default="")
