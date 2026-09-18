from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsActiveUser, IsEmailVerified, IsOwnerOrBrokerEditor

from .drafts import create_listing_draft, update_listing_draft
from .models import BoatListing
from .permissions import ListingWorkflowEnabled
from .serializers import (
    ListingDraftCreateSerializer,
    ListingDraftUpdateSerializer,
    ListingVersionSerializer,
    ListingWorkflowSerializer,
)
from .submissions import submit_listing_revision, withdraw_listing_revision


class ListingDraftCreateView(APIView):
    """POST /api/v1/listings/drafts/ — create an authorized draft (spec §30.1)."""

    permission_classes = [
        IsAuthenticated,
        IsActiveUser,
        IsEmailVerified,
        ListingWorkflowEnabled,
    ]

    def post(self, request):
        envelope = ListingDraftCreateSerializer(data=request.data)
        envelope.is_valid(raise_exception=True)
        payload = {
            key: value for key, value in request.data.items() if key != "broker_id"
        }
        listing = create_listing_draft(
            actor=request.user,
            broker_id=envelope.validated_data.get("broker_id"),
            payload=payload,
        )
        return Response(
            ListingWorkflowSerializer().to_representation(listing),
            status=status.HTTP_201_CREATED,
        )


class ListingDraftUpdateView(APIView):
    """PATCH /api/v1/listings/<id>/draft/ — update draft/revision (spec §30.1)."""

    permission_classes = [
        IsAuthenticated,
        IsActiveUser,
        IsEmailVerified,
        ListingWorkflowEnabled,
        IsOwnerOrBrokerEditor,
    ]

    def get_listing(self, request, listing_id):
        listing = get_object_or_404(BoatListing, pk=listing_id)
        self.check_object_permissions(request, listing)
        return listing

    def patch(self, request, listing_id):
        listing = self.get_listing(request, listing_id)
        envelope = ListingDraftUpdateSerializer(data=request.data)
        envelope.is_valid(raise_exception=True)
        payload = {key: value for key, value in request.data.items() if key != "version"}
        update_listing_draft(
            listing=listing,
            actor=request.user,
            expected_version=envelope.validated_data["version"],
            payload=payload,
        )
        listing.refresh_from_db()
        return Response(ListingWorkflowSerializer().to_representation(listing))


class ListingSubmitView(ListingDraftUpdateView):
    """POST /api/v1/listings/<id>/submit/ (spec §30.1).

    Subclasses the draft view for its permission stack and `get_listing`; the
    inherited PATCH handler is refused so the route stays POST-only.
    """

    def patch(self, request, listing_id):
        self.http_method_not_allowed(request)

    def post(self, request, listing_id):
        listing = self.get_listing(request, listing_id)
        envelope = ListingVersionSerializer(data=request.data)
        envelope.is_valid(raise_exception=True)
        submit_listing_revision(
            listing=listing,
            actor=request.user,
            expected_version=envelope.validated_data["version"],
        )
        listing.refresh_from_db()
        return Response(ListingWorkflowSerializer().to_representation(listing))


class ListingWithdrawView(ListingSubmitView):
    """POST /api/v1/listings/<id>/withdraw/ (spec §6.2, §36.4)."""

    def post(self, request, listing_id):
        listing = self.get_listing(request, listing_id)
        envelope = ListingVersionSerializer(data=request.data)
        envelope.is_valid(raise_exception=True)
        withdraw_listing_revision(
            listing=listing,
            actor=request.user,
            expected_version=envelope.validated_data["version"],
        )
        listing.refresh_from_db()
        return Response(ListingWorkflowSerializer().to_representation(listing))
