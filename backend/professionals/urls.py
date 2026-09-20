from django.urls import path

from .team import TeamListView, TeamMemberView
from .views import MembershipCheckoutView, MembershipView

urlpatterns = [
    path("provider/team/", TeamListView.as_view(), name="provider-team"),
    path("provider/team/<uuid:pk>/", TeamMemberView.as_view(), name="provider-team-member"),
    path("provider/membership/", MembershipView.as_view(), name="provider-membership"),
    path("provider/membership/checkout/", MembershipCheckoutView.as_view(), name="provider-membership-checkout"),
]
