from django.urls import path

from .views import PlanListView, PromotionCancelView, PromotionCheckoutView, PromotionEventView, PromotionStatsView

urlpatterns = [
    path("promotion-plans/", PlanListView.as_view(), name="promotion-plans"),
    path("promotions/events/", PromotionEventView.as_view(), name="promotion-events"),
    path("promotions/stats/", PromotionStatsView.as_view(), name="promotion-stats"),
    path("promotions/checkout/", PromotionCheckoutView.as_view(), name="promotion-checkout"),
    path("promotions/cancel/", PromotionCancelView.as_view(), name="promotion-cancel"),
]
