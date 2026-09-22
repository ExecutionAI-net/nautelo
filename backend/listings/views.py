import logging

from django.core.cache import cache
from django.db.models import QuerySet
from django.shortcuts import get_object_or_404
from django.utils.cache import patch_vary_headers
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import (
    IsActiveUser,
    IsEmailVerified,
    IsOwnerOrBrokerEditor,
    IsStaffModerator,
)
from analytics.recording import record_listing_view
from common.authentication import OptionalJWTAuthentication

from .decisions import (
    approve_revision,
    reject_revision,
    request_revision_changes,
    suspend_listing,
    unsuspend_listing,
)
from .staff_queue import TABS, queue_rows, revision_detail
from .media_upgrade import apply_media_upgrade
from .renewal import renew_listing
from .media_uploads import complete_upload, create_upload_intent, remove_media
from .drafts import create_listing_draft, update_listing_draft
from .enums import ListingStatus
from .models import BoatListing, ListingMedia, ListingRevision
from .permissions import ListingWorkflowEnabled
from .public_filters import apply_public_filters, facets
from .serializers import (
    ListingMediaSerializer,
    MediaIntentSerializer,
    ListingDraftCreateSerializer,
    ListingDraftUpdateSerializer,
    ListingVersionSerializer,
    ListingWorkflowSerializer,
    PublicListingSerializer,
    RevisionDecisionSerializer,
    StaffRevisionSerializer,
)
from .submissions import submit_listing_revision, withdraw_listing_revision

logger = logging.getLogger(__name__)


class ListingDraftCreateView(APIView):
    """POST /api/v1/listings/drafts/ — create an authorized draft (spec §30.1)."""
    throttle_scope = "listing_workflow"

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
    throttle_scope = "listing_workflow"

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

    Subclasses the draft view for its permission stack and `get_listing`. The
    inherited PATCH handler is removed from the view's vocabulary by
    `http_method_names` rather than overridden with a refusing stub: DRF derives
    `allowed_methods` (and therefore the `Allow` header and the OPTIONS body)
    from `http_method_names` intersected with the handlers that exist, so a stub
    would still advertise PATCH to a client doing capability discovery while
    refusing every call to it.

    `permission_classes` is deliberately *not* redeclared here (nor on
    `ListingWithdrawView`): both routes inherit the draft view's full stack —
    authenticated, active, verified, feature-flagged and object-owner — and the
    authz tests in `test_submit_withdraw.py` pin that inheritance.
    """

    http_method_names = ["post", "options"]

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


_DECISION_SERVICES = {
    RevisionDecisionSerializer.APPROVE: approve_revision,
    RevisionDecisionSerializer.REQUEST_CHANGES: request_revision_changes,
    RevisionDecisionSerializer.REJECT: reject_revision,
}


class StaffRevisionDecisionView(APIView):
    """POST /api/v1/staff/revisions/<id>/decision/ (spec §30.1, §26.2).

    One endpoint for all three outcomes, discriminated by `decision`. The
    permission stack is the whole security boundary of staff moderation, so it
    is listed deliberately: authenticated, active, the `listing_revisions` flag
    (spec §35.1 — a decision is a mutation), and staff moderator or above.
    IsStaffModerator is the right tier, not IsStaffAdmin: spec §5's capability
    table gives "Approve listings/revisions" to both, and Phase 3's
    is_staff_moderator() already admits staff admins.
    """
    throttle_scope = "staff_moderation"

    permission_classes = [
        IsAuthenticated,
        IsActiveUser,
        ListingWorkflowEnabled,
        IsStaffModerator,
    ]

    def post(self, request, revision_id):
        envelope = RevisionDecisionSerializer(data=request.data)
        envelope.is_valid(raise_exception=True)
        # Turns an unknown id into a 404 before the service's own unlocked read
        # would surface it as an unhandled DoesNotExist.
        get_object_or_404(ListingRevision, pk=revision_id)

        service = _DECISION_SERVICES[envelope.validated_data["decision"]]
        revision = service(
            revision_id=revision_id,
            actor=request.user,
            expected_version=envelope.validated_data["version"],
            note=envelope.validated_data.get("note", ""),
        )
        revision.refresh_from_db()
        revision.listing.refresh_from_db()
        return Response(StaffRevisionSerializer().to_representation(revision))


class StaffModerationBaseView(APIView):
    permission_classes = [IsAuthenticated, IsActiveUser, IsStaffModerator]
    throttle_scope = "staff_moderation"


class StaffModerationQueueView(StaffModerationBaseView):
    """GET /api/v1/staff/moderation/queue/?tab=&seller_type=&ordering= (spec 26.2)."""

    def get(self, request):
        tab = request.query_params.get("tab", "initial")
        if tab not in TABS:
            raise ValidationError({"tab": f"Must be one of {', '.join(TABS)}."})
        rows, counts = queue_rows(
            tab=tab,
            seller_type=request.query_params.get("seller_type"),
            ordering=request.query_params.get("ordering", "oldest"),
        )
        return Response({"tab": tab, "counts": counts, "results": rows})


class StaffRevisionDetailView(StaffModerationBaseView):
    """GET /api/v1/staff/revisions/<id>/ - before/after diff, warnings, audit."""

    def get(self, request, revision_id):
        revision = get_object_or_404(
            ListingRevision.objects.select_related(
                "listing",
                "listing__brand",
                "listing__model",
                "listing__broker",
                "listing__owner_user",
                "listing__current_public_snapshot",
                "listing__consumed_entitlement",
            ),
            pk=revision_id,
        )
        return Response(revision_detail(revision))


class StaffListingSuspensionView(StaffModerationBaseView):
    """POST /api/v1/staff/listings/<id>/suspension/ {action, reason} (spec 26.2)."""

    permission_classes = StaffModerationBaseView.permission_classes + [
        ListingWorkflowEnabled
    ]

    def post(self, request, listing_id):
        listing = get_object_or_404(BoatListing, pk=listing_id)
        action = request.data.get("action")
        reason = request.data.get("reason", "")
        if action == "suspend":
            suspend_listing(listing=listing, actor=request.user, reason=reason)
        elif action == "unsuspend":
            unsuspend_listing(listing=listing, actor=request.user, reason=reason)
        else:
            raise ValidationError({"action": "Must be suspend or unsuspend."})
        listing.refresh_from_db()
        return Response({"listing_id": str(listing.pk), "status": listing.status})


def published_listings_queryset() -> QuerySet[BoatListing]:
    """The single definition of "publicly visible" (spec §20 definition of done).

    Both conditions are required: a listing is public only when staff moved it to
    PUBLISHED *and* an approved snapshot exists to serve. Neither implies the
    other — a PUBLISHED row keeps `current_public_snapshot` after suspension,
    expiry and archival, and a corrupt or half-written PUBLISHED row could carry
    no snapshot at all — so status is never trusted on its own.

    Later phases (search, sitemap, view counting, the public detail page) must
    reuse this helper rather than re-deriving the filter; spec §20's definition
    of done is only provable if "publicly visible" has exactly one definition.

    Note what is deliberately absent: the requesting user. There is no
    owner/staff escape hatch here, so an authenticated owner sees precisely what
    a guest sees — their own pending work is 404 on this path, and the workflow
    endpoints are where they read it instead.
    """
    return (
        BoatListing.objects.filter(
            status=ListingStatus.PUBLISHED, current_public_snapshot__isnull=False
        )
        .select_related("current_public_snapshot", "broker")
        .order_by("-published_at", "-created_at")
    )


class PublicListingPagination(PageNumberPagination):
    page_size = 24
    page_size_query_param = "page_size"
    max_page_size = 96


class PublicListingReadView:
    """Shared configuration for the two public read endpoints.

    `authentication_classes = []` is deliberate and is not the access control:
    the queryset is. Dropping authentication only means an expired or malformed
    Authorization header cannot turn a public page into a 401, and that no
    credential is parsed on an anonymous read path.
    """

    permission_classes = [AllowAny]
    authentication_classes = []
    serializer_class = PublicListingSerializer
    # The project's default throttle class is a ScopedRateThrottle subclass, and
    # a scoped throttle without a scope is a silent no-op — so an AllowAny view
    # that omits this is completely unthrottled. Set here rather than on each
    # view so the two public endpoints share one bucket and cannot drift apart.
    throttle_scope = "public_listing_read"

    def get_queryset(self):
        return published_listings_queryset()


class PublicListingListView(PublicListingReadView, ListAPIView):
    """GET /api/v1/listings/ — public listing cards (spec §30.1)."""

    pagination_class = PublicListingPagination

    def _semantic(self):
        """(query, parsed) when the caller asked for a natural-language search, else None."""
        if not hasattr(self, "_semantic_cache"):
            params = self.request.query_params
            query = (params.get("query") or "").strip()[:300]
            if params.get("mode") == "semantic" and query:
                from semantic.parse import parse_query

                self._semantic_cache = (query, parse_query(query))
            else:
                self._semantic_cache = None
        return self._semantic_cache

    def get_queryset(self):
        queryset = super().get_queryset()
        broker = self.request.query_params.get("broker", "").strip()
        if broker:
            queryset = queryset.filter(broker__slug=broker)
        params = self.request.query_params
        semantic = self._semantic()
        if semantic is None:
            return apply_public_filters(queryset, params)
        query, parsed = semantic
        merged = params.copy()
        for key, value in parsed.filters.items():
            if not merged.get(key):  # a filter the visitor set by hand wins over the sentence
                merged[key] = value
        base = queryset
        queryset = apply_public_filters(base, merged)
        self._relaxed = []
        if not queryset.exists():
            # No boat matches every detail: keep place, price and length, and let type and cabins go before saying "nothing".
            for dropped in (("cabins", "cabins_min"), ("boat_type", "cabins", "cabins_min")):
                loose = merged.copy()
                gone = [key for key in dropped if key in parsed.filters and loose.get(key) == parsed.filters[key]]
                for key in gone:
                    del loose[key]
                if not gone:
                    continue
                candidate = apply_public_filters(base, loose)
                if candidate.exists():
                    queryset, self._relaxed = candidate, gone
                    break
        from semantic.search import rank

        return rank(queryset, query, parsed)[0]

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        semantic = self._semantic()
        if semantic is not None and isinstance(response.data, dict):
            response.data["interpretation"] = {
                "labels": semantic[1].labels,
                "filters": semantic[1].filters,
                "relaxed": getattr(self, "_relaxed", []),
            }
        return response


FACETS_CACHE_KEY = "listings:public_facets"
# Every visitor gets the same response (no personalization, no locale variance —
# BOAT_TYPES/FUEL_TYPES are plain enum values); a short TTL trades a few minutes of
# staleness on newly published brands/locations for skipping facets()'s several
# distinct/group-by queries on every /boats/ page load.
FACETS_CACHE_TTL_SECONDS = 180


class PublicListingFacetsView(PublicListingReadView, APIView):
    """GET /api/v1/listings/facets/ - distinct filter choices for the boat filter panel."""

    def get(self, request):
        cached = cache.get(FACETS_CACHE_KEY)
        if cached is not None:
            return Response(cached)
        data = facets(published_listings_queryset())
        cache.set(FACETS_CACHE_KEY, data, FACETS_CACHE_TTL_SECONDS)
        return Response(data)


class PublicListingDetailView(PublicListingReadView, RetrieveAPIView):
    """GET /api/v1/listings/<id>/ — public detail and counted view (spec §30.1).

    Returns 404 for anything not published, including to the listing's owner:
    the owner's view of their own work comes from the workflow endpoints.

    Two deliberate departures from the shared PublicListingReadView config:

    1. `authentication_classes` is OptionalJWTAuthentication, which never 401s
       (an expired or malformed Authorization header still yields a public page)
       but populates `request.user` so spec §19.1's owner / broker-colleague /
       staff exclusions are decidable. `permission_classes` stays AllowAny.
    2. `retrieve()` records the view. The list view records nothing (spec §19.1:
       card impressions do not count).

    Recording is contained HERE, not in the recorder: `record_listing_view`
    propagates faults by design (a silent swallow would produce fake counts), so
    this caller decides that an analytics fault must not take down a public page.
    The log line carries the listing id and exception class only — never the IP,
    user agent or viewer key.

    The body varies by viewer (an excluded viewer sees the unincremented count,
    a first-time viewer sees N+1), so the response is never shared-cacheable:
    `Cache-Control: private, no-store` plus `Vary: Authorization`, set on every
    response so cacheability never depends on the request.
    """

    lookup_url_kwarg = "listing_id"
    authentication_classes = [OptionalJWTAuthentication]

    def retrieve(self, request, *args, **kwargs):
        listing = self.get_object()
        try:
            counted = record_listing_view(listing=listing, request=request).counted
            if counted:
                listing.refresh_from_db(fields=["view_count_cached"])
        except Exception as exc:
            # ATOMIC_REQUESTS is off and the recorder opens its own atomic, so
            # the connection remains usable for the response below.
            logger.error(
                "listing view recording failed listing_id=%s error=%s",
                listing.pk,
                type(exc).__name__,
            )
        response = Response(self.get_serializer(listing).data)
        response["Cache-Control"] = "private, no-store"
        patch_vary_headers(response, ("Authorization",))
        return response


class PublicListingBySlugView(PublicListingDetailView):
    """GET /api/v1/listings/by-slug/<slug>/ - the page behind /boats/<slug>/."""

    lookup_field = "slug"
    lookup_url_kwarg = "slug"


class ListingMediaUpgradeApplyView(ListingDraftUpdateView):
    """POST /api/v1/listings/<id>/media-upgrade/apply/ (spec §24.4).

    Inherits the draft view's permission stack and `get_listing` (owner or
    broker editor); the service further requires the PRIVATE owner.
    """

    http_method_names = ["post", "options"]
    throttle_scope = "media_upgrade_apply"

    def post(self, request, listing_id):
        listing = self.get_listing(request, listing_id)
        entitlement = apply_media_upgrade(actor=request.user, listing=listing)
        return Response(
            {
                "listing_id": str(listing.pk),
                "entitlement_id": str(entitlement.pk),
                "state": entitlement.state,
            }
        )


class ListingRenewView(ListingDraftUpdateView):
    """POST /api/v1/listings/<id>/renew/ - spend a paid listing right to extend
    or re-activate a private listing (20 images and 1 video included)."""

    http_method_names = ["post", "options"]
    throttle_scope = "media_upgrade_apply"

    def post(self, request, listing_id):
        listing = self.get_listing(request, listing_id)
        renewed = renew_listing(
            listing_id=listing.pk,
            actor=request.user,
            package=(request.data.get("package") or None),
        )
        return Response(
            {
                "listing_id": str(renewed.pk),
                "status": renewed.status,
                "expires_at": renewed.expires_at,
            }
        )


class _MediaBaseView(ListingDraftUpdateView):
    """Media routes share the draft view permission stack (owner or editor)."""

    throttle_scope = "media_upload"

    def get_media(self, request, listing_id, media_id):
        listing = self.get_listing(request, listing_id)
        media = get_object_or_404(ListingMedia, pk=media_id, listing=listing)
        return listing, media


class ListingMediaListView(_MediaBaseView):
    """GET /api/v1/listings/<id>/media/ - the owner uploads and their states."""

    http_method_names = ["get", "options"]

    def get(self, request, listing_id):
        listing = self.get_listing(request, listing_id)
        rows = ListingMedia.objects.filter(listing=listing).exclude(status="REJECTED")
        return Response(ListingMediaSerializer(rows, many=True).data)


class ListingMediaIntentView(_MediaBaseView):
    """POST /api/v1/listings/<id>/media/intents/ (spec 24.2 steps 1-4)."""

    http_method_names = ["post", "options"]

    def post(self, request, listing_id):
        listing = self.get_listing(request, listing_id)
        envelope = MediaIntentSerializer(data=request.data)
        envelope.is_valid(raise_exception=True)
        data = envelope.validated_data
        intent = create_upload_intent(
            actor=request.user,
            listing=listing,
            media_type=data["media_type"],
            filename=data["filename"],
            mime_type=data["mime_type"],
            size=data["size"],
            checksum_sha256=data["checksum_sha256"],
        )
        return Response(
            {
                "media": ListingMediaSerializer(intent.media).data,
                "upload": {
                    "url": intent.target.url,
                    "method": intent.target.method,
                    "headers": intent.target.headers,
                    "expires_in": intent.target.expires_in,
                },
            },
            status=status.HTTP_201_CREATED,
        )


class ListingMediaCompleteView(_MediaBaseView):
    """POST /api/v1/listings/<id>/media/<media_id>/complete/ (spec 24.2 step 6)."""

    http_method_names = ["post", "options"]

    def post(self, request, listing_id, media_id):
        _, media = self.get_media(request, listing_id, media_id)
        media = complete_upload(actor=request.user, media=media)
        return Response(
            ListingMediaSerializer(media).data, status=status.HTTP_202_ACCEPTED
        )


class ListingMediaDetailView(_MediaBaseView):
    """GET (poll one upload, incl. why it was rejected) and DELETE /api/v1/listings/<id>/media/<media_id>/."""

    http_method_names = ["get", "delete", "options"]

    def get(self, request, listing_id, media_id):
        _, media = self.get_media(request, listing_id, media_id)
        return Response(ListingMediaSerializer(media).data)

    def delete(self, request, listing_id, media_id):
        _, media = self.get_media(request, listing_id, media_id)
        remove_media(actor=request.user, media=media)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ListingMediaReorderView(_MediaBaseView):
    """POST /api/v1/listings/<id>/media/reorder/ {media_type, ids: [...]} - first id becomes the cover."""

    http_method_names = ["post", "options"]

    def post(self, request, listing_id):
        from rest_framework.exceptions import ValidationError

        from .media_uploads import reorder_media

        listing = self.get_listing(request, listing_id)
        media_type = request.data.get("media_type")
        ids = request.data.get("ids")
        if media_type not in ("IMAGE", "VIDEO") or not isinstance(ids, list):
            raise ValidationError({"ids": "media_type and ids are required."})
        try:
            reorder_media(listing=listing, media_type=media_type, ordered_ids=ids)
        except ValueError as exc:
            raise ValidationError({"ids": str(exc)}) from exc
        rows = ListingMedia.objects.filter(listing=listing).exclude(status="REJECTED")
        return Response(ListingMediaSerializer(rows, many=True).data)


class ListingFormOptionsView(APIView):
    """GET /api/v1/listing-form/options/ - closed choice lists for the sell form."""

    permission_classes = [IsAuthenticated, IsActiveUser]
    throttle_scope = "listing_form_options"
    http_method_names = ["get", "options"]

    def get(self, request):
        from .form_options import form_options

        return Response(form_options())
