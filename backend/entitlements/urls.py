from django.urls import path

from .views import ListingEligibilityView

urlpatterns = [
    path(
        "listing-eligibility/",
        ListingEligibilityView.as_view(),
        name="listing-eligibility",
    ),
]
