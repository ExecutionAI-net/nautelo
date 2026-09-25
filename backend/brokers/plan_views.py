"""Public pricing (/pricing/) and staff plan management."""

from django.db.models import Count, Q, Sum
from rest_framework import serializers
from rest_framework.generics import ListAPIView, ListCreateAPIView, RetrieveUpdateAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsActiveUser, IsStaffAdmin
from brokers.models import BrokerOrganization, BrokerPlan
from services_catalog.services import localized, resolve_locale


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
        from professionals.billing import get_plan as professional_plan

        pro = professional_plan()
        from payments.models import ListingPackage

        packages = ListingPackage.objects.filter(is_active=True)
        # Package and product names are stored per language; the page asks for its own (F18).
        locale = resolve_locale(request.query_params.get("locale"))
        return Response(
            {
                "professional_plan": (
                    {
                        "name": pro.name,
                        "tagline": pro.tagline,
                        "monthly_price": str(pro.monthly_price),
                        "currency": pro.currency,
                    }
                    if pro
                    else None
                ),
                "listing_packages": [
                    {
                        "slug": package.slug,
                        "name": localized(package, "name", locale),
                        "description": localized(package, "description", locale),
                        "amount": str(package.display_amount),
                        "currency": package.currency,
                        "publication_days": package.publication_days,
                        "image_limit": package.image_limit,
                        "video_limit": package.video_limit,
                    }
                    for package in packages
                ],
                "broker_plans": PublicPlanSerializer(BrokerPlan.objects.filter(is_active=True), many=True).data,
                "individual_products": [
                    {
                        "code": product.code,
                        "name": localized(product, "name", locale),
                        "description": localized(product, "description", locale),
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


class StaffSubscriptionPagination(PageNumberPagination):
    page_size = 20
    max_page_size = 100
    page_size_query_param = "page_size"


class StaffSubscriberSerializer(serializers.ModelSerializer):
    plan_slug = serializers.CharField(source="plan.slug", read_only=True, default=None)
    plan_name = serializers.CharField(source="plan.name", read_only=True, default=None)
    monthly_price = serializers.DecimalField(source="plan.monthly_price", max_digits=10, decimal_places=2, read_only=True, default=None)
    currency = serializers.CharField(source="plan.currency", read_only=True, default=None)
    listing_limit = serializers.IntegerField(source="plan.listing_limit", read_only=True, default=None)
    seat_limit = serializers.IntegerField(source="plan.seat_limit", read_only=True, default=None)
    listings_used = serializers.IntegerField(read_only=True)
    seats_used = serializers.IntegerField(read_only=True)

    class Meta:
        model = BrokerOrganization
        fields = (
            "id", "name", "slug", "status", "city", "country_code", "plan_slug", "plan_name", "monthly_price", "currency",
            "plan_renews_at", "listing_limit", "seat_limit", "listings_used", "seats_used",
        )


class StaffBrokerSubscriptionListView(ListAPIView):
    """Brokers with their plan and live usage; filter by ?plan=<slug|none> and ?q=name. The summary rides along."""

    permission_classes = [IsAuthenticated, IsActiveUser, IsStaffAdmin]
    throttle_scope = "staff_moderation"
    serializer_class = StaffSubscriberSerializer
    pagination_class = StaffSubscriptionPagination

    def get_queryset(self):
        from brokers.plans import COUNTED_LISTING_STATES

        queryset = BrokerOrganization.objects.select_related("plan").annotate(
            listings_used=Count("listings", filter=Q(listings__status__in=COUNTED_LISTING_STATES), distinct=True),
            seats_used=Count("memberships", filter=Q(memberships__is_active=True), distinct=True),
        )
        params = self.request.query_params
        plan = params.get("plan", "").strip()
        if plan == "none":
            queryset = queryset.filter(plan__isnull=True)
        elif plan:
            queryset = queryset.filter(plan__slug=plan)
        term = params.get("q", "").strip()
        if term:
            queryset = queryset.filter(name__icontains=term)
        return queryset.order_by("name")

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        subscribed = BrokerOrganization.objects.filter(plan__isnull=False)
        monthly = subscribed.aggregate(total=Sum("plan__monthly_price"))["total"] or 0
        response.data["summary"] = {
            "monthly_recurring_revenue": str(monthly),
            "annual_run_rate": str(monthly * 12),
            "subscribed_brokers": subscribed.count(),
            "unassigned_brokers": BrokerOrganization.objects.filter(plan__isnull=True).count(),
            "by_plan": {
                row["plan__slug"]: row["n"]
                for row in subscribed.values("plan__slug").annotate(n=Count("id"))
            },
        }
        return response
