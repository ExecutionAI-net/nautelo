"""Read-only staff administration lists (spec §4 /dashboard/staff/* screens).

Every endpoint is staff-admin only and returns plain rows; mutations stay in
the Django admin and the dedicated moderation endpoints.
"""

from django.db.models import Count, Q
from rest_framework import serializers
from rest_framework.generics import ListAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.permissions import IsActiveUser, IsStaffAdmin
from brokers.models import BrokerOrganization
from entitlements.models import UserEntitlement
from listings.models import BoatListing
from messaging.models import Conversation
from professionals.models import ProfessionalProfile


class StaffPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100


class StaffListView(ListAPIView):
    permission_classes = [IsAuthenticated, IsActiveUser, IsStaffAdmin]
    throttle_scope = "staff_moderation"
    pagination_class = StaffPagination
    search_fields: tuple[str, ...] = ()

    def filter_queryset(self, queryset):
        term = self.request.query_params.get("q", "").strip()
        if term and self.search_fields:
            query = Q()
            for field in self.search_fields:
                query |= Q(**{f"{field}__icontains": term})
            queryset = queryset.filter(query)
        status = self.request.query_params.get("status", "").strip()
        if status and hasattr(self, "status_field"):
            queryset = queryset.filter(**{self.status_field: status})
        return queryset


class UserRowSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "email", "full_name", "primary_role", "is_active", "email_verified_at", "date_joined_at")

    date_joined_at = serializers.DateTimeField(source="created_at", read_only=True)


class StaffUserListView(StaffListView):
    serializer_class = UserRowSerializer
    search_fields = ("email", "full_name")
    queryset = User.objects.order_by("-created_at")

    def filter_queryset(self, queryset):
        queryset = super().filter_queryset(queryset)
        role = self.request.query_params.get("role", "").strip()
        return queryset.filter(primary_role=role) if role else queryset


class BrokerRowSerializer(serializers.ModelSerializer):
    member_count = serializers.IntegerField(read_only=True)
    listing_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = BrokerOrganization
        fields = ("id", "name", "slug", "status", "public_email", "auto_approve_listings", "member_count", "listing_count", "created_at")


class StaffBrokerListView(StaffListView):
    serializer_class = BrokerRowSerializer
    search_fields = ("name", "public_email")
    status_field = "status"

    def get_queryset(self):
        return BrokerOrganization.objects.annotate(
            member_count=Count("memberships", filter=Q(memberships__is_active=True), distinct=True),
            listing_count=Count("listings", distinct=True),
        ).order_by("name")


class ProviderRowSerializer(serializers.ModelSerializer):
    owner_email = serializers.EmailField(source="owner_user.email", read_only=True)

    class Meta:
        model = ProfessionalProfile
        fields = ("id", "display_name", "slug", "status", "owner_email", "city", "country_code", "created_at")


class StaffProviderListView(StaffListView):
    serializer_class = ProviderRowSerializer
    search_fields = ("display_name", "owner_user__email", "city")
    status_field = "status"
    queryset = ProfessionalProfile.objects.select_related("owner_user").order_by("display_name")


class LeadRowSerializer(serializers.ModelSerializer):
    initiator_email = serializers.EmailField(source="initiator.email", read_only=True)
    broker_name = serializers.CharField(source="broker.name", read_only=True, default=None)
    professional_name = serializers.CharField(source="professional.display_name", read_only=True, default=None)

    class Meta:
        model = Conversation
        fields = ("id", "conversation_type", "status", "subject", "initiator_email", "broker_name", "professional_name", "created_at")


class StaffLeadListView(StaffListView):
    serializer_class = LeadRowSerializer
    search_fields = ("subject", "initiator__email")
    status_field = "status"

    def get_queryset(self):
        qs = Conversation.objects.select_related("initiator", "broker", "professional").order_by("-created_at")
        if self.kwargs.get("kind") == "service-requests":
            return qs.filter(conversation_type="PROFESSIONAL_INQUIRY")
        return qs.exclude(conversation_type="PROFESSIONAL_INQUIRY")


class SubscriptionRowSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = UserEntitlement
        fields = ("id", "user_email", "entitlement_type", "source", "state", "valid_from", "valid_until", "created_at")


class StaffSubscriptionListView(StaffListView):
    serializer_class = SubscriptionRowSerializer
    search_fields = ("user__email",)
    status_field = "state"
    queryset = UserEntitlement.objects.select_related("user").order_by("-created_at")


class StaffReportsView(APIView):
    permission_classes = [IsAuthenticated, IsActiveUser, IsStaffAdmin]
    throttle_scope = "staff_moderation"

    def get(self, request):
        return Response(
            {
                "users": User.objects.count(),
                "brokers": BrokerOrganization.objects.count(),
                "providers": ProfessionalProfile.objects.count(),
                "listings": BoatListing.objects.count(),
                "conversations": Conversation.objects.count(),
                "entitlements": UserEntitlement.objects.count(),
            }
        )


class BoatRowSerializer(serializers.ModelSerializer):
    brand_name = serializers.CharField(source="brand.name", read_only=True)
    owner_email = serializers.EmailField(source="owner_user.email", read_only=True, default=None)
    broker_name = serializers.CharField(source="broker.name", read_only=True, default=None)

    class Meta:
        model = BoatListing
        fields = (
            "id", "slug", "status", "seller_type", "brand_name", "manufacture_year", "price", "currency",
            "owner_email", "broker_name", "published_at", "created_at",
        )


class StaffBoatListView(StaffListView):
    serializer_class = BoatRowSerializer
    search_fields = ("brand__name", "owner_user__email", "broker__name", "slug")
    status_field = "status"
    queryset = BoatListing.objects.select_related("brand", "owner_user", "broker").order_by("-created_at")


class StatusChangeSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=["ACTIVE", "SUSPENDED"])


class StaffStatusChangeView(APIView):
    """Staff admin activates or suspends a broker or provider (spec §4 staff screens)."""

    permission_classes = [IsAuthenticated, IsActiveUser, IsStaffAdmin]
    throttle_scope = "staff_moderation"
    model = None
    target_type = ""

    def post(self, request, pk):
        from django.db import transaction
        from django.shortcuts import get_object_or_404

        from audit.models import AuditEvent
        from audit.services import record_audit_event

        payload = StatusChangeSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        with transaction.atomic():
            row = get_object_or_404(self.model.objects.select_for_update(), pk=pk)
            before = row.status
            row.status = payload.validated_data["status"]
            row.save(update_fields=["status", "updated_at"])
            record_audit_event(
                actor_user=request.user,
                actor_type=AuditEvent.ActorType.USER,
                action=f"{self.target_type}.status_changed",
                target_type=self.target_type,
                target_id=str(row.pk),
                source=AuditEvent.Source.API,
                before={"status": before},
                after={"status": row.status},
                metadata={},
            )
        return Response({"id": str(row.pk), "status": row.status})


class StaffBrokerStatusView(StaffStatusChangeView):
    model = BrokerOrganization
    target_type = "brokers.BrokerOrganization"


class StaffProviderStatusView(StaffStatusChangeView):
    model = ProfessionalProfile
    target_type = "professionals.ProfessionalProfile"
