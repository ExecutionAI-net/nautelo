"""Owner-side reads of the listing workflow (spec 25, 30.1).

The public endpoints only ever serve published snapshots, so a seller needs
their own read path to find a draft, see its state and reopen it.
"""

from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsActiveUser, IsOwnerOrBrokerEditor
from brokers.models import BrokerMembership

from .drafts import open_revision_for
from .models import BoatListing
from .permissions import ListingWorkflowEnabled
from .serializers import ListingWorkflowSerializer


def _title(listing) -> str:
    revision = open_revision_for(listing)
    payload = revision.payload if revision else {}
    snapshot = listing.current_public_snapshot
    return (
        (payload or {}).get("title_en")
        or (snapshot.title_en if snapshot else "")
        or f"{listing.brand.name} {listing.model.name}"
    )


class MyListingsView(APIView):
    """GET /api/v1/listings/mine/ - listings I own or may edit for a broker."""

    permission_classes = [IsAuthenticated, IsActiveUser, ListingWorkflowEnabled]
    throttle_scope = "listing_workflow"

    def get(self, request):
        broker_ids = BrokerMembership.objects.filter(
            user=request.user, is_active=True, can_edit_listings=True
        ).values_list("broker_id", flat=True)
        rows = (
            BoatListing.objects.filter(
                Q(owner_user=request.user) | Q(broker_id__in=list(broker_ids))
            )
            .select_related("brand", "model", "current_public_snapshot")
            .order_by("-updated_at")
        )
        return Response(
            [
                {
                    "id": str(item.pk),
                    "title": _title(item),
                    "status": item.status,
                    "seller_type": item.seller_type,
                    "slug": item.slug,
                    "updated_at": item.updated_at,
                    "expires_at": item.expires_at,
                }
                for item in rows
            ]
        )


class ListingWorkflowDetailView(APIView):
    """GET /api/v1/listings/<id>/workflow/ - the owner's view incl. open revision."""

    permission_classes = [
        IsAuthenticated,
        IsActiveUser,
        ListingWorkflowEnabled,
        IsOwnerOrBrokerEditor,
    ]
    throttle_scope = "listing_workflow"

    def get(self, request, listing_id):
        listing = get_object_or_404(BoatListing, pk=listing_id)
        self.check_object_permissions(request, listing)
        return Response(ListingWorkflowSerializer().to_representation(listing))
