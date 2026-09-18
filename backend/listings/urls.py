from django.urls import path

from .views import ListingDraftCreateView

urlpatterns = [
    path("listings/drafts/", ListingDraftCreateView.as_view(), name="listing-draft-create"),
]
