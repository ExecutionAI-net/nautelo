"""Owner-side reads of the listing workflow (spec 25, 30.1).

The public endpoints only ever serve published snapshots, so a seller needs
their own read path to find a draft, see its state and reopen it.
"""

from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsActiveUser, IsOwnerOrBrokerEditor
from brokers.models import BrokerMembership

from .drafts import open_revision_for
from .enums import ListingStatus
from .models import BoatListing
from .permissions import ListingWorkflowEnabled
from .serializers import ListingWorkflowSerializer, _with_url


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
            .prefetch_related("media")
            .order_by("-updated_at")
        )
        return Response([_row(item) for item in rows])


def _row(item) -> dict:
    """One dashboard card: the seller's working copy (open revision) or, failing
    that, what is published. Everything the card shows is computed here."""
    revision = open_revision_for(item)
    payload = dict((revision.payload if revision else None) or {})
    snapshot = item.current_public_snapshot
    specs = payload.get("specifications") or (snapshot.specifications if snapshot else {}) or {}
    price = payload.get("price") or (str(snapshot.price) if snapshot and snapshot.price is not None else None)
    image = next(
        (
            media
            for media in sorted(item.media.all(), key=lambda m: (m.sort_order, m.created_at))
            if media.media_type == "IMAGE" and media.status == "READY"
        ),
        None,
    )
    return {
        "id": str(item.pk),
        "title": _title(item),
        "status": item.status,
        "seller_type": item.seller_type,
        "slug": item.slug,
        "updated_at": item.updated_at,
        "expires_at": item.expires_at,
        "price": price,
        "currency": payload.get("currency") or (snapshot.currency if snapshot else "EUR"),
        "year": payload.get("manufacture_year") or (snapshot.manufacture_year_snapshot if snapshot else None),
        "city": payload.get("location_city") or (snapshot.location_city if snapshot else ""),
        "country": payload.get("location_country") or (snapshot.location_country if snapshot else ""),
        "boat_type": specs.get("boat_type") or "",
        "condition": specs.get("condition") or "",
        "loa_m": specs.get("loa_m") or "",
        "beam_m": specs.get("beam_m") or "",
        "engine": specs.get("engine_model") or specs.get("engine_type") or "",
        "views": item.view_count_cached,
        "image_url": _with_url({"storage_key": image.storage_key})["url"] if image else None,
    }


class MyListingsSummaryView(APIView):
    """GET /api/v1/listings/mine/summary/ - dashboard counters, computed here."""

    permission_classes = [IsAuthenticated, IsActiveUser, ListingWorkflowEnabled]
    throttle_scope = "listing_workflow"
    http_method_names = ["get", "options"]

    def get(self, request):
        broker_ids = BrokerMembership.objects.filter(
            user=request.user, is_active=True, can_edit_listings=True
        ).values_list("broker_id", flat=True)
        counts = dict(
            BoatListing.objects.filter(
                Q(owner_user=request.user) | Q(broker_id__in=list(broker_ids))
            )
            .values_list("status")
            .annotate(total=Count("pk"))
        )
        return Response(
            {
                "published": counts.get(ListingStatus.PUBLISHED, 0),
                "drafts": counts.get(ListingStatus.DRAFT, 0),
                "in_review": counts.get(ListingStatus.PENDING_APPROVAL, 0),
            }
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
