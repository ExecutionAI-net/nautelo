"""Public pricing (/pricing/) and staff plan management."""

from rest_framework import serializers
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsActiveUser, IsStaffAdmin
from brokers.models import BrokerOrganization, BrokerPlan


class PublicPlanSerializer(serializers.ModelSerializer):
    profile_visibility = serializers.CharField(source="get_profile_visibility_display")

    class Meta:
        model = BrokerPlan
        fields = ("slug", "name", "tagline", "monthly_price", "currency", "listing_limit", "seat_limit", "profile_visibility")


class PublicPricingView(APIView):
    """Broker tiers plus what an individual seller can buy (a listing right only)."""

    permission_classes = [AllowAny]
    throttle_scope = "public_listing_read"

    def get(self, request):
        from payments.enums import ProductCode
        from payments.models import MarketplaceProduct

        products = MarketplaceProduct.objects.active().filter(code=ProductCode.INDIVIDUAL_LISTING_RIGHT)
        return Response(
            {
                "broker_plans": PublicPlanSerializer(BrokerPlan.objects.filter(is_active=True), many=True).data,
                "individual_products": [
                    {
                        "code": product.code,
                        "name": product.name_en,
                        "description": product.description_en,
                        "amount": str(product.display_amount),
                        "currency": product.currency,
                        "publication_days": product.publication_days,
                        "valid_days": product.entitlement_valid_days,
                    }
                    for product in products
                ],
            }
        )


class StaffPlanSerializer(serializers.ModelSerializer):
    subscriber_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = BrokerPlan
        fields = (
            "id", "slug", "name", "tagline", "monthly_price", "currency", "listing_limit", "seat_limit",
            "profile_visibility", "display_order", "is_active", "subscriber_count",
        )
        read_only_fields = ("id", "subscriber_count")


class _StaffPlanBase:
    permission_classes = [IsAuthenticated, IsActiveUser, IsStaffAdmin]
    throttle_scope = "staff_moderation"
    serializer_class = StaffPlanSerializer

    def get_queryset(self):
        from django.db.models import Count

        return BrokerPlan.objects.annotate(subscriber_count=Count("brokers"))


class StaffPlanListView(_StaffPlanBase, ListCreateAPIView):
    pagination_class = None


class StaffPlanDetailView(_StaffPlanBase, RetrieveUpdateAPIView):
    pass


class StaffBrokerPlanAssignView(APIView):
    """Assign or clear a broker's plan and renewal date (audited)."""

    permission_classes = [IsAuthenticated, IsActiveUser, IsStaffAdmin]
    throttle_scope = "staff_moderation"

    def post(self, request, pk):
        from django.db import transaction
        from django.shortcuts import get_object_or_404

        from audit.models import AuditEvent
        from audit.services import record_audit_event

        slug = request.data.get("plan")
        renews_at = request.data.get("renews_at") or None
        plan = None
        if slug:
            plan = get_object_or_404(BrokerPlan, slug=slug, is_active=True)
        with transaction.atomic():
            broker = get_object_or_404(BrokerOrganization.objects.select_for_update(), pk=pk)
            before = {"plan": broker.plan.slug if broker.plan_id else None, "renews_at": str(broker.plan_renews_at or "")}
            broker.plan = plan
            broker.plan_renews_at = renews_at
            broker.save(update_fields=["plan", "plan_renews_at", "updated_at"])
            record_audit_event(
                actor_user=request.user,
                actor_type=AuditEvent.ActorType.USER,
                action="broker.plan_assigned",
                target_type="brokers.BrokerOrganization",
                target_id=str(broker.pk),
                source=AuditEvent.Source.API,
                before=before,
                after={"plan": slug or None, "renews_at": str(renews_at or "")},
                metadata={},
            )
        return Response({"id": str(broker.pk), "plan": slug or None, "renews_at": broker.plan_renews_at})
