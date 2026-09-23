"""Staff-facing read view over PaymentOrder (spec §4 /dashboard/staff/purchases/).

Read-only by design - same rule payments/admin.py's PaymentOrderAdmin already
enforces (spec §26.3 / §23.1: staff never edits a Stripe-paid order manually).
This view only ever returns identifiers, an amount and a currency - see this
module's sibling payments/models.py docstring: no card data is ever stored,
so none can leak here either.
"""

from django.db.models import Count, Q
from rest_framework import serializers
from rest_framework.generics import ListAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated

from accounts.permissions import IsActiveUser, IsStaffAdmin

from .models import PaymentOrder


class StaffPurchasePagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100

    def get_paginated_response(self, data):
        """`facets`: status -> count over the whole filtered-by-search set,
        ignoring the status filter itself - same contract as staffops'
        StaffPagination, which frontend's StaffDataTable already expects."""
        response = super().get_paginated_response(data)
        response.data["facets"] = getattr(self, "facets", {})
        return response


class StaffPurchaseSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    product_name = serializers.CharField(source="product.name_en", read_only=True)
    product_code = serializers.CharField(source="product.code", read_only=True)
    amount_display = serializers.SerializerMethodField()

    class Meta:
        model = PaymentOrder
        fields = (
            "id", "user_email", "product_name", "product_code", "quantity",
            "amount_display", "status", "stripe_checkout_session_id",
            "stripe_payment_intent_id", "created_at", "paid_at", "fulfilled_at",
        )

    def get_amount_display(self, obj) -> str:
        return f"{obj.amount} {obj.currency}"


class StaffPurchaseListView(ListAPIView):
    """GET /api/v1/staff/purchases/?q=&status= - every marketplace purchase
    (listing packages, media upgrades) with its Stripe identifiers, for
    support lookups. Subscriptions (broker/professional plans) are a
    different model and live on their own staff screens."""

    permission_classes = [IsAuthenticated, IsActiveUser, IsStaffAdmin]
    throttle_scope = "staff_moderation"
    pagination_class = StaffPurchasePagination
    serializer_class = StaffPurchaseSerializer
    queryset = PaymentOrder.objects.select_related("user", "product").order_by("-created_at")

    def filter_queryset(self, queryset):
        params = self.request.query_params
        term = params.get("q", "").strip()
        if term:
            queryset = queryset.filter(
                Q(user__email__icontains=term)
                | Q(stripe_checkout_session_id__icontains=term)
                | Q(stripe_payment_intent_id__icontains=term)
                | Q(product__code__icontains=term)
            )
        counts = queryset.order_by().values("status").annotate(n=Count("pk")).values_list("status", "n")
        self.paginator.facets = {str(key): n for key, n in counts}
        status = params.get("status", "").strip()
        if status:
            queryset = queryset.filter(status=status)
        return queryset
