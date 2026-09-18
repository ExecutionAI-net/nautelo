from django.urls import path

from payments.views import CheckoutSessionCreateView, PaymentOrderDetailView

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
]
