"""Spec §30.1: GET /api/v1/contacts/<target-type>/<id>/.

The view holds no rules. It resolves, records the first reveal, and serializes
— everything else is in contact_access.py, so the same decision is reachable
from a test, a management command or another view without going through HTTP.
"""

from django.utils.cache import patch_vary_headers
from rest_framework import serializers, status
from rest_framework.exceptions import APIException, NotFound
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from accounts.permissions import IsActiveUser, IsStaffModerator
from messaging.views import MessagingAPIView

from .contact_access import (
    ContactGrantAlreadyRevoked,
    ContactTargetNotFound,
    GrantedContact,
    record_first_reveal,
    record_staff_reveal,
    resolve_contact_access,
    revoke_contact_access,
)
from .contact_payloads import contact_payload, staff_grant_payload
from .models import ContactAccessGrant

#: Spec §16: contact data is never public. This URL returns LOCKED to one viewer
#: and GRANTED to the next, discriminated only by the Authorization header, and
#: the browser client sends `credentials: "include"` — so a shared cache (a CDN,
#: a corporate proxy, the browser's own HTTP cache after a logout) is a real
#: cross-viewer disclosure path. Nothing else in this codebase sets a cache
#: header, so nothing else would stop it.
CACHE_CONTROL_HEADER = "private, no-store, max-age=0"
VARY_HEADERS = ("Authorization", "Cookie")


def apply_no_store(response):
    """Stamp the no-store headers on ANY response object, success or error.

    `patch_vary_headers`, not `response["Vary"] = ...`: assignment would discard
    whatever is already there, and something already is — corsheaders'
    CorsMiddleware adds `origin` to every response in this project, and Django's
    SessionMiddleware adds `Cookie` when a session is touched. Patching merges;
    assigning would silently drop another middleware's correctness fix. The
    emitted header therefore ends up as "Authorization, Cookie, origin", which
    is why every assertion in this phase compares `Vary` as a set.
    """
    response["Cache-Control"] = CACHE_CONTROL_HEADER
    patch_vary_headers(response, VARY_HEADERS)
    return response


class ContactAccessView(MessagingAPIView):
    """Extends MessagingAPIView, not APIView (Phase 6 contract rule 11), so a
    throttled caller gets `rate_limited` rather than DRF's `throttled`.

    **Phase 6 contract rule 11a — "the flag gate goes FIRST in
    permission_classes" — is satisfied here by there being no flag gate to
    order.** That is a decision, not an omission, and it is the one place this
    phase deliberately diverges from a Phase 6 rule:

    * `unified_inquiries` does not gate this view. With inquiries paused, spec
      §14.2 still requires a contact panel and spec §2.1 still requires it to
      have a backend source; `403 feature_disabled` would replace an honest
      LOCKED state with an error, and would strip an existing grant holder of a
      contact they legitimately unlocked.
    * `contact_unlock` does not gate it either, because that flag's semantics
      are narrower than a rollout gate's: it only ever CLOSES the reveal. Flag
      off means everyone sees LOCKED — the fail-closed direction — not that the
      endpoint disappears.

    So the flag changes the payload and never the status code or who may ask,
    which `test_the_flag_state_changes_the_answer_but_never_the_status_code` is
    the standing guard for. A future contact endpoint that *is* rollout-gated
    puts its gate first, exactly as rule 11a says.
    """

    # AllowAny is deliberate and required: spec §34.5's browser scenario starts
    # with a GUEST seeing the locked contact panel. The endpoint never reveals
    # anything to an unauthenticated caller — resolve_contact_access() returns
    # LockedContact for them — so "public" here means "public masked values".
    permission_classes = [AllowAny]
    throttle_scope = "contact_access"

    def finalize_response(self, request, response, *args, **kwargs):
        """The ONE place the headers are applied, so no response path can miss
        them. DRF routes every outcome through here — the three 200 states and
        the 401/404/429 envelopes the exception handler produced alike."""
        response = super().finalize_response(request, response, *args, **kwargs)
        return apply_no_store(response)

    def get(self, request, target_type, target_id):
        try:
            access = resolve_contact_access(
                viewer=request.user, segment=target_type, target_id=target_id
            )
        except ContactTargetNotFound:
            # 404, never 403: a DRAFT/PENDING entity's existence is not
            # disclosed. The envelope carries no entity name either.
            raise NotFound()

        if isinstance(access, GrantedContact):
            request_id = getattr(request, "request_id", "") or None
            if access.grant_id is not None:
                record_first_reveal(
                    grant_id=access.grant_id,
                    actor=request.user,
                    request_id=request_id,
                )
            else:
                # No grant: this is spec §5's staff reveal, which has no row to
                # stamp and is therefore audited on every request.
                record_staff_reveal(
                    segment=target_type,
                    target_id=target_id,
                    actor=request.user,
                    request_id=request_id,
                )

        return Response(contact_payload(access))


class ContactGrantStateConflict(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "This contact access grant is no longer active."
    default_code = "invalid_grant_state"


class StaffContactGrantRevokeSerializer(serializers.Serializer):
    # trim_whitespace + allow_blank=False together reject "   ".
    reason = serializers.CharField(max_length=500, allow_blank=False, trim_whitespace=True)


class StaffContactGrantRevokeView(MessagingAPIView):
    """Extends MessagingAPIView for the same reason the read view does: an
    anonymous caller must hear `authentication_required`, not DRF's
    `not_authenticated` (Phase 6 contract rule 11).

    No flag gate here either (rule 11a), and for a sharper reason than on the
    read view: revocation is spec §16's abuse remedy, and the moment a feature
    is switched off is exactly when an operator is most likely to be
    firefighting. `test_revocation_still_works_when_the_reveal_flag_is_off`
    pins it.
    """

    permission_classes = [IsActiveUser, IsStaffModerator]
    throttle_scope = "contact_grant_admin"

    def finalize_response(self, request, response, *args, **kwargs):
        # The body carries a viewer id and grant timestamps. It is not contact
        # data, but it is per-staff-actor and has no business in any cache.
        response = super().finalize_response(request, response, *args, **kwargs)
        return apply_no_store(response)

    def post(self, request, grant_id):
        serializer = StaffContactGrantRevokeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            grant = revoke_contact_access(
                grant_id=grant_id,
                actor=request.user,
                reason=serializer.validated_data["reason"],
                request_id=getattr(request, "request_id", "") or None,
            )
        except ContactAccessGrant.DoesNotExist:
            raise NotFound()
        except ContactGrantAlreadyRevoked:
            raise ContactGrantStateConflict()
        return Response(staff_grant_payload(grant))
