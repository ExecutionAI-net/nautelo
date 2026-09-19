from django.urls import path

from .views import (
    ListingDraftCreateView,
    ListingDraftUpdateView,
    ListingMediaCompleteView,
    ListingMediaDetailView,
    ListingMediaIntentView,
    ListingMediaListView,
    ListingMediaUpgradeApplyView,
    ListingSubmitView,
    ListingWithdrawView,
    PublicListingDetailView,
    PublicListingListView,
    StaffRevisionDecisionView,
)

urlpatterns = [
    path("listings/drafts/", ListingDraftCreateView.as_view(), name="listing-draft-create"),
    path(
        "listings/<uuid:listing_id>/draft/",
        ListingDraftUpdateView.as_view(),
        name="listing-draft-update",
    ),
    path(
        "listings/<uuid:listing_id>/submit/",
        ListingSubmitView.as_view(),
        name="listing-submit",
    ),
    path(
        "listings/<uuid:listing_id>/withdraw/",
        ListingWithdrawView.as_view(),
        name="listing-withdraw",
    ),
    path(
        "listings/<uuid:listing_id>/media-upgrade/apply/",
        ListingMediaUpgradeApplyView.as_view(),
        name="listing-media-upgrade-apply",
    ),
    path(
        "listings/<uuid:listing_id>/media/",
        ListingMediaListView.as_view(),
        name="listing-media-list",
    ),
    path(
        "listings/<uuid:listing_id>/media/intents/",
        ListingMediaIntentView.as_view(),
        name="listing-media-intent",
    ),
    path(
        "listings/<uuid:listing_id>/media/<uuid:media_id>/complete/",
        ListingMediaCompleteView.as_view(),
        name="listing-media-complete",
    ),
    path(
        "listings/<uuid:listing_id>/media/<uuid:media_id>/",
        ListingMediaDetailView.as_view(),
        name="listing-media-detail",
    ),
    path(
        "staff/revisions/<uuid:revision_id>/decision/",
        StaffRevisionDecisionView.as_view(),
        name="staff-revision-decision",
    ),
]

# The public read path (spec §30.1). Appended after the workflow routes so the
# literal `listings/drafts/` is matched first. Django resolves top-to-bottom and
# `<uuid:...>` only matches a canonical 8-4-4-4-12 hex UUID, so `drafts` could
# never be captured by it in either order — the ordering is documentation of
# intent, not the thing that makes it safe. The regression test
# `test_the_public_routes_do_not_shadow_the_workflow_routes` pins it anyway.
urlpatterns += [
    path("listings/", PublicListingListView.as_view(), name="listing-list"),
    path(
        "listings/<uuid:listing_id>/",
        PublicListingDetailView.as_view(),
        name="listing-detail",
    ),
]
