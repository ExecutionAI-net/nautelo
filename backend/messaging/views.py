"""Messaging endpoints (spec 30.1)."""

from rest_framework import status
from rest_framework.exceptions import NotAuthenticated
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsActiveUser
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
    UNIFIED_INQUIRIES_FLAG,
)
from messaging.exceptions import MessagingThrottled
from messaging.permissions import InquiryEmailVerified, UnifiedInquiriesEnabled
from messaging.serializers import InquiryResultSerializer, InquirySubmissionSerializer
from messaging.services import submit_inquiry
from platform_settings.services import is_feature_enabled


class MessagingAPIView(APIView):
    """Base class for every messaging endpoint.

    Two overrides, both about speaking spec 15.5's error vocabulary rather than
    DRF's defaults.

    ONE RULE FOR SUBCLASSES: whenever a subclass has a feature-flag gate,
    `UnifiedInquiriesEnabled` goes FIRST in `permission_classes`. (Phase 7's
    contact-access endpoints are the ruled exception: they carry NO flag gate,
    because `contact_unlock` only ever closes reveal and never blocks the
    LOCKED display - spec 16/35.1.) `check_permissions` stops at the first gate
    that fails, so a flag gate placed after an authentication gate never speaks
    for an anonymous caller - and spec 35.1's "flag off => feature_disabled"
    would silently mean "unless you are signed out". The base class cannot
    enforce this (DRF reads `permission_classes` off the concrete view), so it
    is stated here and in the plan's Contract summary, and Task 7's
    `test_the_flag_off_answer_precedes_every_other_permission` is what actually
    catches a regression.
    """

    def permission_denied(self, request, message=None, code=None):
        """Spec 15.5 names the anonymous case `authentication_required`.

        DRF's own implementation raises a bare NotAuthenticated() when the
        request carried no credentials, which renders as code
        "not_authenticated" - a code spec 15.5 does not define. The 401 status
        is correct and is kept; only the code and message change. Note this
        cannot be fixed by a permission class: DRF decides between 401 and 403
        itself, and a permission class's `code` only reaches the 403 branch.
        """
        if request.authenticators and not request.successful_authenticator:
            raise NotAuthenticated(
                detail="Authentication is required.", code="authentication_required"
            )
        super().permission_denied(request, message=message, code=code)

    def throttled(self, request, wait):
        """Spec 15.5 names the code `rate_limited`, not DRF's "throttled", and
        spec 30.4 wants retry information in the body as well as the header."""
        raise MessagingThrottled(wait=wait)


class InquiryCreateView(MessagingAPIView):
    """POST /api/v1/inquiries/ - spec 30.1's "shared inquiry submission".

    THE FLAG GATE COMES FIRST, and the order is load-bearing.
    `APIView.check_permissions` walks the list and stops at the first failure, so
    whichever gate is first is the one that names the error. With
    `IsAuthenticated` first, an anonymous caller hits it before the flag is ever
    consulted and DRF answers `401 authentication_required` - meaning a switched
    -off feature would report itself differently to signed-in and signed-out
    callers, on the same endpoint, at the same moment.

    Putting `UnifiedInquiriesEnabled` first makes spec 35.1's rule true without
    exception: flag off => `403 feature_disabled` for everyone. It costs nothing
    when the flag is on, because the class then returns True and the
    authentication gates run exactly as before - an anonymous caller still gets
    `401 authentication_required`, which is what
    `test_a_guest_gets_401_authentication_required` asserts.
    """

    permission_classes = [
        UnifiedInquiriesEnabled,
        IsAuthenticated,
        IsActiveUser,
        InquiryEmailVerified,
    ]
    throttle_scope = "inquiry_submit"

    def post(self, request):
        serializer = InquirySubmissionSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        result = submit_inquiry(
            actor=request.user,
            context_type=data["context_type"],
            context_id=data["context_id"],
            full_name=data["full_name"],
            phone=data.get("phone", ""),
            subject=data["subject"],
            body=data["message"],
            privacy_policy_version=data["privacy_policy_version"],
            marketing_consent=data["marketing_consent"],
            request_id=getattr(request, "request_id", "") or None,
        )
        return Response(
            InquiryResultSerializer(result).data, status=status.HTTP_201_CREATED
        )


class InquiryConfigView(MessagingAPIView):
    """GET /api/v1/inquiries/config/ - an addition beyond spec 30.1's table.

    It exists so every number the form enforces client-side has a backend source
    (spec 2.1) and the two can never drift (spec 2.2: client validation
    "improve[s] usability but never enforce[s] business rules"), and so spec
    35.1's frontend gate is one round trip the page already has to make rather
    than a second copy of the flag in the frontend build.

    Public by design: it carries no user data, and a guest filling the form
    before authenticating needs the same limits an authenticated user does.
    """

    permission_classes = [AllowAny]
    throttle_scope = "messaging_read"

    def get(self, request):
        return Response(
            {
                "enabled": is_feature_enabled(UNIFIED_INQUIRIES_FLAG, default=False),
                "privacy_policy_version": CURRENT_PRIVACY_POLICY_VERSION,
                "honeypot_field": HONEYPOT_FIELD_NAME,
                "limits": {
                    "full_name": {
                        "min": FULL_NAME_MIN_LENGTH,
                        "max": FULL_NAME_MAX_LENGTH,
                    },
                    "subject": {"min": SUBJECT_MIN_LENGTH, "max": SUBJECT_MAX_LENGTH},
                    "message": {"min": MESSAGE_MIN_LENGTH, "max": MESSAGE_MAX_LENGTH},
                    "phone_max": PHONE_MAX_LENGTH,
                },
            }
        )
