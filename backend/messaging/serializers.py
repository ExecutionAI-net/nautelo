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
