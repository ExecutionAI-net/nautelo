"""Owner-side self service for service providers (spec §4 /dashboard/service-provider/*).

A provider manages one ProfessionalProfile and its ProfessionalService rows.
Activation stays a staff decision: the owner can only move DRAFT -> PENDING.
"""

from django.utils.text import slugify
from rest_framework import serializers
from rest_framework.exceptions import NotFound
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.enums import UserRole
from accounts.permissions import IsActiveUser
from professionals.enums import ProfessionalProfileStatus
from professionals.models import ProfessionalProfile

from .models import ProfessionalService
from .permissions import CombinedDirectoryEnabled


class IsServiceProvider(BasePermission):
    message = "A service provider account is required."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.primary_role == UserRole.SERVICE_PROVIDER)


class ProviderProfileSerializer(serializers.ModelSerializer):
    submit = serializers.BooleanField(write_only=True, required=False)

    class Meta:
        model = ProfessionalProfile
        fields = (
            "id", "display_name", "slug", "short_description", "description", "public_email", "public_phone",
            "website_url", "city", "postal_code", "region", "country_code", "service_area", "status", "submit",
        )
        read_only_fields = ("id", "slug", "status")

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
        return ProfessionalProfile.objects.create(slug=slug, owner_user=self.context["request"].user, **validated_data)

    def update(self, instance, validated_data):
        submit = validated_data.pop("submit", False)
        instance = super().update(instance, validated_data)
        if submit and instance.status == ProfessionalProfileStatus.DRAFT:
            instance.status = ProfessionalProfileStatus.PENDING
            instance.save(update_fields=["status", "updated_at"])
        return instance


class ProviderProfileView(APIView):
    permission_classes = [CombinedDirectoryEnabled, IsActiveUser, IsServiceProvider]
    throttle_scope = "staff_moderation"

    def _profile(self, request):
        profile = ProfessionalProfile.objects.filter(owner_user=request.user).first()
        if profile is None:
            raise NotFound("No provider profile yet.")
        return profile

    def get(self, request):
        return Response(ProviderProfileSerializer(self._profile(request)).data)

    def post(self, request):
        if ProfessionalProfile.objects.filter(owner_user=request.user).exists():
            return Response({"detail": "A profile already exists."}, status=409)
        serializer = ProviderProfileSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        return Response(ProviderProfileSerializer(serializer.save()).data, status=201)

    def patch(self, request):
        serializer = ProviderProfileSerializer(
            self._profile(request), data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        return Response(ProviderProfileSerializer(serializer.save()).data)


class ProviderServiceSerializer(serializers.ModelSerializer):
    category_slug = serializers.SlugRelatedField(source="category", slug_field="slug", read_only=True)

    class Meta:
        model = ProfessionalService
        fields = ("id", "category", "category_slug", "title_en", "description_en", "service_area", "is_active")


class ProviderServiceMixin:
    permission_classes = [CombinedDirectoryEnabled, IsActiveUser, IsServiceProvider]
    throttle_scope = "staff_moderation"
    serializer_class = ProviderServiceSerializer

    def get_queryset(self):
        return ProfessionalService.objects.filter(professional__owner_user=self.request.user).select_related("category")


class ProviderServiceListView(ProviderServiceMixin, ListCreateAPIView):
    pagination_class = None

    def perform_create(self, serializer):
        profile = ProfessionalProfile.objects.filter(owner_user=self.request.user).first()
        if profile is None:
            raise NotFound("Create your provider profile first.")
        serializer.save(professional=profile)


class ProviderServiceDetailView(ProviderServiceMixin, RetrieveUpdateDestroyAPIView):
    pass
