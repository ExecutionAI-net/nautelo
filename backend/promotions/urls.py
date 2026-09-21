from django.urls import path

from .views import PlanListView, PromotionCheckoutView

urlpatterns = [
    path("promotion-plans/", PlanListView.as_view(), name="promotion-plans"),
    path("promotions/checkout/", PromotionCheckoutView.as_view(), name="promotion-checkout"),
]
