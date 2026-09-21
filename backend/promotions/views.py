from rest_framework import serializers, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsActiveUser, IsEmailVerified

from .stats import record_event, report_for
from .checkout import create_profile_promotion_checkout, create_promotion_checkout
from .models import PromotionPlan


class PlanListView(APIView):
    """GET /api/v1/promotion-plans/?locale=it - public, so the pop-up and pricing page can show them."""

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = "public_settings"

    def get(self, request):
        locale = (request.query_params.get("locale") or "en").lower()[:2]
        locale = locale if locale in ("en", "it", "es") else "en"
        plans = PromotionPlan.objects.filter(is_active=True)
        return Response(
            [
                {
                    "code": p.code,
                    "name": p.name(locale),
                    "days": p.days,
                    "price": str(p.price),
                    "currency": p.currency,
                    "is_popular": p.is_popular,
                }
                for p in plans
            ]
        )


class CheckoutSerializer(serializers.Serializer):
    listing_id = serializers.UUIDField(required=False)
    target = serializers.ChoiceField(choices=["listing", "profile"], default="listing")
    plan = serializers.CharField(max_length=30)
    return_path = serializers.CharField(max_length=80, required=False, default="/dashboard/private-seller/listings/")


class PromotionCheckoutView(APIView):
    """POST /api/v1/promotions/checkout/ -> {checkout_url}. Verified email, listing editor only."""

    permission_classes = [IsAuthenticated, IsActiveUser, IsEmailVerified]
    throttle_scope = "checkout_create"

    def post(self, request):
        data = CheckoutSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        values = data.validated_data
        if values["target"] == "profile":
            url = create_profile_promotion_checkout(user=request.user, plan_code=values["plan"], return_path=values["return_path"])
        else:
            if "listing_id" not in values:
                raise serializers.ValidationError({"listing_id": ["This field is required."]})
            url = create_promotion_checkout(
                user=request.user,
                listing_id=values["listing_id"],
                plan_code=values["plan"],
                return_path=values["return_path"],
            )
        return Response({"checkout_url": url}, status=status.HTTP_201_CREATED)


class EventSerializer(serializers.Serializer):
    target = serializers.ChoiceField(choices=["listing", "profile"])
    id = serializers.UUIDField()
    kind = serializers.ChoiceField(choices=["impression", "click"])


class PromotionEventView(APIView):
    """POST /api/v1/promotions/events/ - anonymous beacon from the featured strip; counted only while featured."""

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = "promo_event"

    def post(self, request):
        data = EventSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        record_event(target=data.validated_data["target"], target_id=data.validated_data["id"], kind=data.validated_data["kind"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class PromotionStatsView(APIView):
    """GET /api/v1/promotions/stats/ - the caller's own totals."""

    permission_classes = [IsAuthenticated, IsActiveUser]
    throttle_scope = "account"

    def get(self, request):
        return Response(report_for(request.user))
