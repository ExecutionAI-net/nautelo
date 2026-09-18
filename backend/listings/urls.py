from django.urls import path

from .views import ListingDraftCreateView, ListingDraftUpdateView

urlpatterns = [
    path("listings/drafts/", ListingDraftCreateView.as_view(), name="listing-draft-create"),
    path(
        "listings/<uuid:listing_id>/draft/",
        ListingDraftUpdateView.as_view(),
        name="listing-draft-update",
    ),
]
