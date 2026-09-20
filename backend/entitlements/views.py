from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsActiveUser, IsEmailVerified

from .eligibility import ListingEligibilityService
from .policy import available_paid_rights


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


class MyPaidListingsView(APIView):
    """GET /api/v1/paid-listings/ - the caller's unused paid listings, by package."""

    permission_classes = [IsAuthenticated, IsActiveUser]
    throttle_scope = "listing_eligibility"
    http_method_names = ["get", "options"]

    def get(self, request):
        groups: dict[str, dict] = {}
        for right in available_paid_rights(request.user):
            meta = right.metadata or {}
            key = meta.get("package", "")
            group = groups.setdefault(
                key,
                {
                    "package": key,
                    "publication_days": meta.get("publication_days"),
                    "image_limit": meta.get("image_limit"),
                    "video_limit": meta.get("video_limit"),
                    "count": 0,
                },
            )
            group["count"] += 1
        return Response({"results": list(groups.values())})
