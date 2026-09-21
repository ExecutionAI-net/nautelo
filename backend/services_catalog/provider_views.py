"""Owner-side self service for service providers (spec §4 /dashboard/service-provider/*).

A provider manages one ProfessionalProfile and its ProfessionalService rows.
Activation stays a staff decision: the owner can only move DRAFT -> PENDING.
"""

from django.utils.text import slugify
from rest_framework import serializers
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.enums import UserRole
from accounts.permissions import IsActiveUser
from common.field_rules import phone_number, plain_text
from professionals.enums import ProfessionalProfileStatus
from professionals.access import add_owner_membership, membership_for, profile_for
from professionals.models import ProfessionalProfile

from .models import ProfessionalService
from .permissions import CombinedDirectoryEnabled


class IsServiceProvider(BasePermission):
    message = "A service provider account is required."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.primary_role == UserRole.PROFESSIONAL)


class ProviderProfileSerializer(serializers.ModelSerializer):
    submit = serializers.BooleanField(write_only=True, required=False)
    place_id = serializers.IntegerField(source="place_geoname_id", required=False, allow_null=True)
    completeness = serializers.SerializerMethodField()
    logo_url = serializers.SerializerMethodField()
    cover_url = serializers.SerializerMethodField()

    def get_logo_url(self, obj):
        from common.org_images import resolve_url

        return resolve_url(obj.logo_key)

    def get_cover_url(self, obj):
        from common.org_images import resolve_url

        return resolve_url(obj.cover_key)

    def get_completeness(self, obj):
        from professionals.completeness import completeness

        return completeness(obj)

    class Meta:
        model = ProfessionalProfile
        fields = (
            "id", "display_name", "slug", "short_description", "description", "public_email", "public_phone",
            "website_url", "city", "place_id", "postal_code", "region", "country_code", "service_area", "status", "submit", "completeness", "logo_url", "cover_url",
        )
        read_only_fields = ("id", "slug", "status", "logo_url", "cover_url")

    def validate(self, attrs):
        from places.matching import apply_place_to_attrs

        return apply_place_to_attrs(attrs, has_region=True)

    def validate_display_name(self, value):
        return plain_text(value)

    def validate_city(self, value):
        return plain_text(value)

    def validate_region(self, value):
        return plain_text(value)

    def validate_postal_code(self, value):
        return plain_text(value)

    def validate_public_phone(self, value):
        return phone_number(value)

    def validate_country_code(self, value):
        if len(value) != 2 or not value.isalpha():
            raise serializers.ValidationError("Use a two-letter country code.")
        return value.upper()

    def create(self, validated_data):
        validated_data.pop("submit", None)
        base = slugify(validated_data["display_name"])[:200] or "provider"
        slug, n = base, 2
        while ProfessionalProfile.objects.filter(slug=slug).exists():
            slug, n = f"{base}-{n}", n + 1
        user = self.context["request"].user
        profile = ProfessionalProfile.objects.create(slug=slug, owner_user=user, **validated_data)
        add_owner_membership(profile, user)
        return profile

    def update(self, instance, validated_data):
        submit = validated_data.pop("submit", False)
        instance = super().update(instance, validated_data)
        if submit and instance.status == ProfessionalProfileStatus.DRAFT:
            from professionals.completeness import missing_items, subscription_is_live

            missing = missing_items(instance)
            if missing:
                raise serializers.ValidationError({"submit": ["profile_incomplete"]})
            if not subscription_is_live(instance):
                raise serializers.ValidationError({"submit": ["subscription_required"]})
            instance.status = ProfessionalProfileStatus.PENDING
            instance.save(update_fields=["status", "updated_at"])
        return instance


class ProviderProfileView(APIView):
    permission_classes = [CombinedDirectoryEnabled, IsActiveUser, IsServiceProvider]
    throttle_scope = "staff_moderation"

    def _profile(self, request):
        profile = profile_for(request.user)
        if profile is None:
            raise NotFound("No provider profile yet.")
        return profile

    def get(self, request):
        return Response(ProviderProfileSerializer(self._profile(request)).data)

    def post(self, request):
        if membership_for(request.user) is not None:
            return Response({"detail": "A profile already exists."}, status=409)
        serializer = ProviderProfileSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        return Response(ProviderProfileSerializer(serializer.save()).data, status=201)

    def patch(self, request):
        membership = membership_for(request.user)
        if membership is not None and not membership.can_edit_profile:
            raise PermissionDenied("Your role cannot edit the profile.")
        serializer = ProviderProfileSerializer(
            self._profile(request), data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        return Response(ProviderProfileSerializer(serializer.save()).data)


class ProviderServiceSerializer(serializers.ModelSerializer):
    category_slug = serializers.SlugRelatedField(source="category", slug_field="slug", read_only=True)

    def validate_title_en(self, value):
        return plain_text(value)

    def validate_description_en(self, value):
        return plain_text(value)

    class Meta:
        model = ProfessionalService
        fields = ("id", "category", "category_slug", "title_en", "description_en", "service_area", "is_active")


class ProviderServiceMixin:
    permission_classes = [CombinedDirectoryEnabled, IsActiveUser, IsServiceProvider]
    throttle_scope = "staff_moderation"
    serializer_class = ProviderServiceSerializer

    def get_queryset(self):
        profile = profile_for(self.request.user)
        return ProfessionalService.objects.filter(professional=profile).select_related("category")


class ProviderServiceListView(ProviderServiceMixin, ListCreateAPIView):
    pagination_class = None

    def perform_create(self, serializer):
        membership = membership_for(self.request.user)
        if membership is None:
            raise NotFound("Create your provider profile first.")
        if not membership.can_edit_profile:
            raise PermissionDenied("Your role cannot edit services.")
        profile = membership.profile
        serializer.save(professional=profile)


class ProviderServiceDetailView(ProviderServiceMixin, RetrieveUpdateDestroyAPIView):
    pass
