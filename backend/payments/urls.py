from django.urls import path

from payments.staff_views import StaffPurchaseListView
from payments.views import (
    CheckoutSessionCreateView,
    PaymentOrderDetailView,
    StaffProductDetailView,
    StaffProductListView,
)

urlpatterns = [
    path(
        "checkout-sessions/",
        CheckoutSessionCreateView.as_view(),
        name="checkout-session-create",
    ),
    path(
        "payment-orders/<uuid:order_id>/",
        PaymentOrderDetailView.as_view(),
        name="payment-order-detail",
    ),
    path("staff/products/", StaffProductListView.as_view(), name="staff-product-list"),
    path(
        "staff/products/<uuid:product_id>/",
        StaffProductDetailView.as_view(),
        name="staff-product-detail",
    ),
    path("staff/purchases/", StaffPurchaseListView.as_view(), name="staff-purchase-list"),
]
