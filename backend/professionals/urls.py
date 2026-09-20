from django.urls import path

from .views import MembershipCheckoutView, MembershipView

urlpatterns = [
    path("provider/membership/", MembershipView.as_view(), name="provider-membership"),
    path("provider/membership/checkout/", MembershipCheckoutView.as_view(), name="provider-membership-checkout"),
]
