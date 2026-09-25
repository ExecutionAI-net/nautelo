"""Read-only staff administration lists (spec §4 /dashboard/staff/* screens).

Every endpoint is staff-admin only and returns plain rows; mutations stay in
the Django admin and the dedicated moderation endpoints.
"""

from django.db.models import Count, Prefetch, Q
from common.money import display_money
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
from listings.enums import RevisionStatus
from listings.models import BoatListing, ListingRevision
from messaging.models import Conversation
from professionals.models import ProfessionalProfile


class StaffPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100

    def get_paginated_response(self, data):
        """`facets`: value -> count over the whole set, ignoring the status filter."""
        response = super().get_paginated_response(data)
        response.data["facets"] = getattr(self, "facets", {})
        return response


class StaffListView(ListAPIView):
    permission_classes = [IsAuthenticated, IsActiveUser, IsStaffAdmin]
    throttle_scope = "staff_moderation"
    pagination_class = StaffPagination
    search_fields: tuple[str, ...] = ()
    facet_field: str | None = None
    #: `?ordering=` values a column header may ask for -> the model field they sort by.
    ordering_fields: dict[str, str] = {}

    def order_queryset(self, queryset):
        raw = self.request.query_params.get("ordering", "").strip()
        key = raw.lstrip("-")
        field = self.ordering_fields.get(key)
        if not field:
            return queryset
        return queryset.order_by(f"-{field}" if raw.startswith("-") else field, "pk")

    def filter_queryset(self, queryset):
        term = self.request.query_params.get("q", "").strip()
        if term and self.search_fields:
            query = Q()
            for field in self.search_fields:
                query |= Q(**{f"{field}__icontains": term})
            queryset = queryset.filter(query)
        if self.facet_field:
            counts = queryset.order_by().values(self.facet_field).annotate(n=Count("pk", distinct=True)).values_list(self.facet_field, "n")
            self.paginator.facets = {str(key): n for key, n in counts}
        status = self.request.query_params.get("status", "").strip()
        if status and hasattr(self, "status_field"):
            queryset = queryset.filter(**{self.status_field: status})
        return self.order_queryset(queryset)


class UserRowSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "email", "full_name", "primary_role", "is_active", "email_verified_at", "date_joined_at", "account_state")

    date_joined_at = serializers.DateTimeField(source="created_at", read_only=True)
    account_state = serializers.SerializerMethodField()

    def get_account_state(self, user) -> str:
        """One word a staff member can act on: the same three states the list filter offers."""
        if not user.is_active:
            return "SUSPENDED"
        return "ACTIVE" if user.email_verified_at else "UNVERIFIED"


class StaffUserListView(StaffListView):
    """`status` here means the account state: active, suspended or unverified; `role` filters primary_role."""

    serializer_class = UserRowSerializer
    search_fields = ("email", "full_name")
    facet_field = "primary_role"
    ordering_fields = {"email": "email", "full_name": "full_name", "primary_role": "primary_role", "date_joined_at": "created_at"}
    queryset = User.objects.order_by("-created_at")

    def filter_queryset(self, queryset):
        state = self.request.query_params.get("state", "").strip()
        queryset = super().filter_queryset(queryset)
        if state == "active":
            queryset = queryset.filter(is_active=True)
        elif state == "suspended":
            queryset = queryset.filter(is_active=False)
        elif state == "unverified":
            queryset = queryset.filter(email_verified_at__isnull=True)
        role = self.request.query_params.get("role", "").strip()
        return queryset.filter(primary_role=role) if role else queryset


class BrokerRowSerializer(serializers.ModelSerializer):
    member_count = serializers.IntegerField(read_only=True)
    listing_count = serializers.IntegerField(read_only=True)
    plan_name = serializers.CharField(source="plan.name", read_only=True, default=None)
    plan_slug = serializers.CharField(source="plan.slug", read_only=True, default=None)

    class Meta:
        model = BrokerOrganization
        fields = (
            "id", "name", "slug", "status", "public_email", "auto_approve_listings", "member_count", "listing_count",
            "plan_name", "plan_slug", "plan_renews_at", "created_at",
        )


class StaffBrokerListView(StaffListView):
    facet_field = "status"
    serializer_class = BrokerRowSerializer
    search_fields = ("name", "public_email")
    status_field = "status"
    ordering_fields = {
        "name": "name", "status": "status", "member_count": "member_count", "listing_count": "listing_count", "created_at": "created_at",
    }

    def get_queryset(self):
        return BrokerOrganization.objects.select_related("plan").annotate(
            member_count=Count("memberships", filter=Q(memberships__is_active=True), distinct=True),
            listing_count=Count("listings", distinct=True),
        ).order_by("name")


class ProviderRowSerializer(serializers.ModelSerializer):
    owner_email = serializers.EmailField(source="owner_user.email", read_only=True)

    class Meta:
        model = ProfessionalProfile
        fields = ("id", "display_name", "slug", "status", "owner_email", "city", "country_code", "created_at")


class StaffProviderListView(StaffListView):
    facet_field = "status"
    serializer_class = ProviderRowSerializer
    search_fields = ("display_name", "owner_user__email", "city")
    ordering_fields = {"display_name": "display_name", "status": "status", "city": "city", "created_at": "created_at"}
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
    facet_field = "status"
    serializer_class = LeadRowSerializer
    search_fields = ("subject", "initiator__email")
    status_field = "status"
    ordering_fields = {"subject": "subject", "status": "status", "conversation_type": "conversation_type", "created_at": "created_at"}

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
    facet_field = "state"
    serializer_class = SubscriptionRowSerializer
    search_fields = ("user__email",)
    status_field = "state"
    ordering_fields = {"user_email": "user__email", "state": "state", "valid_until": "valid_until", "created_at": "created_at"}
    queryset = UserEntitlement.objects.select_related("user").order_by("-created_at")


class StaffReportsView(APIView):
    permission_classes = [IsAuthenticated, IsActiveUser, IsStaffAdmin]
    throttle_scope = "staff_moderation"

    def get(self, request):
        from datetime import timedelta

        from django.utils import timezone

        now = timezone.now()
        last, before = now - timedelta(days=30), now - timedelta(days=60)

        def by(model, field):
            return {str(k): n for k, n in model.objects.order_by().values_list(field).annotate(n=Count("pk", distinct=True))}

        from django.db.models.functions import TruncMonth

        def monthly(model):
            start = (now.replace(day=1) - timedelta(days=150)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            rows = (
                model.objects.filter(created_at__gte=start)
                .annotate(month=TruncMonth("created_at"))
                .order_by()
                .values_list("month")
                .annotate(n=Count("pk", distinct=True))
            )
            return {month.strftime("%Y-%m"): n for month, n in rows}

        series = {"users": monthly(User), "listings": monthly(BoatListing), "conversations": monthly(Conversation)}
        months = []
        cursor = now.replace(day=1)
        for _ in range(6):
            months.append(cursor.strftime("%Y-%m"))
            cursor = (cursor - timedelta(days=1)).replace(day=1)
        months.reverse()
        monthly_rows = [{"month": m, **{name: data.get(m, 0) for name, data in series.items()}} for m in months]
        new_users = User.objects.filter(created_at__gte=last).count()
        prior_users = User.objects.filter(created_at__gte=before, created_at__lt=last).count()
        return Response(
            {
                "users": User.objects.count(),
                "brokers": BrokerOrganization.objects.count(),
                "providers": ProfessionalProfile.objects.count(),
                "listings": BoatListing.objects.count(),
                "conversations": Conversation.objects.count(),
                "entitlements": UserEntitlement.objects.count(),
                "users_by_role": by(User, "primary_role"),
                "listings_by_status": by(BoatListing, "status"),
                "brokers_by_status": by(BrokerOrganization, "status"),
                "providers_by_status": by(ProfessionalProfile, "status"),
                "entitlements_by_state": by(UserEntitlement, "state"),
                "monthly": monthly_rows,
                "listings_by_seller_type": by(BoatListing, "seller_type"),
                "new_users_30d": new_users,
                "new_users_prev_30d": prior_users,
                "new_listings_30d": BoatListing.objects.filter(created_at__gte=last).count(),
                "new_conversations_30d": Conversation.objects.filter(created_at__gte=last).count(),
                "suspended_users": User.objects.filter(is_active=False).count(),
                "unverified_users": User.objects.filter(email_verified_at__isnull=True).count(),
            }
        )


class BoatRowSerializer(serializers.ModelSerializer):
    brand_name = serializers.CharField(source="brand.name", read_only=True)
    owner_email = serializers.EmailField(source="owner_user.email", read_only=True, default=None)
    broker_name = serializers.CharField(source="broker.name", read_only=True, default=None)
    pending_revision_id = serializers.SerializerMethodField()
    title = serializers.SerializerMethodField()
    price_display = serializers.SerializerMethodField()
    seller = serializers.SerializerMethodField()

    class Meta:
        model = BoatListing
        fields = (
            "id", "slug", "status", "seller_type", "title", "brand_name", "manufacture_year", "price", "currency",
            "price_display", "seller", "owner_email", "broker_name", "published_at", "created_at", "updated_at",
            "pending_revision_id",
        )

    def get_seller(self, listing) -> str:
        """Who is selling: the brokerage, else the private owner's e-mail (one column instead of two half-empty ones)."""
        if listing.broker_id and listing.broker:
            return listing.broker.name
        return listing.owner_user.email if listing.owner_user_id and listing.owner_user else ""

    def get_title(self, listing) -> str:
        """The published title, else the year/brand/model heading a buyer would see."""
        snapshot = listing.current_public_snapshot if listing.current_public_snapshot_id else None
        if snapshot is not None and snapshot.title_en:
            return snapshot.title_en
        return f"{listing.manufacture_year} {listing.brand.name} {listing.custom_model_name or listing.model.name}"

    def get_price_display(self, listing) -> str:
        return display_money(listing.price, listing.currency)

    def get_pending_revision_id(self, listing):
        """The submitted revision a moderator can approve, or None (prefetched by the list view)."""
        submitted = getattr(listing, "submitted_revisions", [])
        return str(submitted[0].pk) if submitted else None


class StaffBoatListView(StaffListView):
    facet_field = "status"
    serializer_class = BoatRowSerializer
    search_fields = ("brand__name", "model__name", "owner_user__email", "broker__name", "slug")
    status_field = "status"
    ordering_fields = {
        "manufacture_year": "manufacture_year", "status": "status", "seller_type": "seller_type", "price_display": "price",
        "created_at": "created_at", "updated_at": "updated_at", "brand_name": "brand__name",
    }
    queryset = (
        BoatListing.objects.select_related("brand", "model", "owner_user", "broker", "current_public_snapshot")
        .prefetch_related(
            Prefetch(
                "revisions",
                queryset=ListingRevision.objects.filter(state=RevisionStatus.SUBMITTED),
                to_attr="submitted_revisions",
            )
        )
        .order_by("-created_at")
    )


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


class StaffUserStatusView(APIView):
    """Staff admin freezes (is_active=False) or re-activates a user; audited, never on staff or yourself."""

    permission_classes = [IsAuthenticated, IsActiveUser, IsStaffAdmin]
    throttle_scope = "staff_moderation"

    def post(self, request, pk):
        from django.db import transaction
        from django.shortcuts import get_object_or_404
        from rest_framework.exceptions import ValidationError

        from audit.models import AuditEvent
        from audit.services import record_audit_event

        payload = StatusChangeSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        active = payload.validated_data["status"] == "ACTIVE"
        with transaction.atomic():
            user = get_object_or_404(User.objects.select_for_update(), pk=pk)
            if user.pk == request.user.pk or user.primary_role == "STAFF":
                raise ValidationError({"status": "Staff accounts and your own account cannot be changed here."})
            before = user.is_active
            user.is_active = active
            user.save(update_fields=["is_active", "updated_at"])
            record_audit_event(
                actor_user=request.user,
                actor_type=AuditEvent.ActorType.USER,
                action="accounts.User.status_changed",
                target_type="accounts.User",
                target_id=str(user.pk),
                source=AuditEvent.Source.API,
                before={"is_active": before},
                after={"is_active": active},
                metadata={},
            )
        return Response({"id": str(user.pk), "is_active": user.is_active})


class StaffPlatformSettingsView(APIView):
    """GET lists every registry setting; PATCH {key, value} changes one through update_setting (audited)."""

    permission_classes = [IsAuthenticated, IsActiveUser, IsStaffAdmin]
    throttle_scope = "staff_moderation"

    def get(self, request):
        from platform_settings.models import PlatformSetting, PlatformSettingsVersion
        from platform_settings.registry import SETTINGS_REGISTRY

        rows = {row.key: row for row in PlatformSetting.objects.all()}
        return Response(
            {
                "settings_version": PlatformSettingsVersion.load().version,
                "settings": [
                    {
                        "key": key,
                        "type": definition.value_type.value,
                        "default": definition.default,
                        "value": rows[key].value if key in rows else definition.default,
                        "updated_at": rows[key].updated_at if key in rows else None,
                    }
                    for key, definition in SETTINGS_REGISTRY.items()
                ],
            }
        )

    def patch(self, request):
        from django.core.exceptions import ValidationError as DjangoValidationError
        from rest_framework.exceptions import ValidationError

        from platform_settings.services import update_setting

        key = request.data.get("key")
        if not isinstance(key, str) or "value" not in request.data:
            raise ValidationError({"key": "key and value are required."})
        try:
            row = update_setting(key=key, value=request.data["value"], actor=request.user, source="API")
        except DjangoValidationError as exc:
            raise ValidationError(exc.message_dict if hasattr(exc, "error_dict") else {"value": exc.messages}) from exc
        return Response({"key": row.key, "value": row.value})
