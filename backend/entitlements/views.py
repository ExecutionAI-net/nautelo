from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsActiveUser, IsEmailVerified

from .eligibility import ListingEligibilityService


class ListingEligibilityView(APIView):
    """GET /api/v1/listing-eligibility/ — spec §30.1, §22.2.

    Deliberately *not* gated by the `individual_entitlements` flag: with the
    flag off the service already reports `can_start_listing: true` and a null
    `blocking_reason`, which is the truth about what the backend will do, so
    the endpoint keeps agreeing with the API under both flag states (spec §22
    definition of done item 2). A 404 behind the flag would instead force the
    UI to invent a fallback.

    `IsEmailVerified` is here because spec §12 item 3 and Phase 3 contract rule
    5 gate listing submission on a verified email: an account that cannot
    submit must not be told it can start a listing.
    """

    permission_classes = [IsAuthenticated, IsActiveUser, IsEmailVerified]
    throttle_scope = "listing_eligibility"
    http_method_names = ["get", "options"]

    def get(self, request):
        return Response(ListingEligibilityService.for_user(request.user).as_dict())
