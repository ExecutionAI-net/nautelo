from django.urls import path

from .views import (
    ListingDraftCreateView,
    ListingDraftUpdateView,
    ListingSubmitView,
    ListingWithdrawView,
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
]
