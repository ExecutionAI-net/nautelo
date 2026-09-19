from rest_framework.permissions import BasePermission

from accounts.permissions import IsEmailVerified
from messaging.enums import UNIFIED_INQUIRIES_FLAG
from messaging.exceptions import FeatureDisabled
from platform_settings.services import is_feature_enabled


class UnifiedInquiriesEnabled(BasePermission):
    """Spec 35.1's rollout gate on the mutation side.

    403 rather than the 404 services_catalog.permissions.CombinedDirectoryEnabled
    uses: these are private API surfaces, not public pages whose very existence
    is the thing being hidden, and a client that already holds a session needs
    to distinguish "switched off" from "wrong URL".

    It RAISES rather than returning False, and that is load-bearing, not style.
    DRF's `APIView.permission_denied` answers `401 NotAuthenticated` whenever the
    request carried no credentials - before it ever looks at WHICH permission
    failed or at its `code`. On an AllowAny endpoint (the guest draft route) a
    flag-off answer would therefore have been `401 authentication_required`,
    which describes the wrong problem: the caller's credentials were never at
    issue. Raising skips that branch entirely, so every endpoint answers `403
    feature_disabled` for anonymous and authenticated callers alike. This is the
    same technique the merged `services_catalog.permissions.CombinedDirectoryEnabled`
    uses (it raises `NotFound()`), for the same underlying reason.
    """

    def has_permission(self, request, view):
        if not is_feature_enabled(UNIFIED_INQUIRIES_FLAG, default=False):
            raise FeatureDisabled()
        return True


class InquiryEmailVerified(IsEmailVerified):
    """Identical rule to Phase 3's IsEmailVerified, under spec 15.5's own code.

    Phase 3 uses `email_not_verified`; spec 15.5 names the inquiry error
    `email_verification_required`. Subclassing keeps one implementation of the
    rule and leaves accounts/permissions.py untouched - which matters, because
    changing that class's `code` would silently rename the error on every
    listing and Checkout endpoint that already relies on it.
    """

    message = "Verify your email address before sending an inquiry."
    code = "email_verification_required"
