"""Self-service registration of a broker or professional organization.

One request creates the owner account (with the organization's role), the
organization (DRAFT until it is paid for and approved) and the owner's ADMIN
seat, then sends the email-verification link. Billing and the profile come
next, once the owner is signed in.
"""

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils.text import slugify
from rest_framework import serializers

from accounts.enums import Locale, UserRole
from accounts.models import User, UserManager
from accounts.services import queue_email_verification


class OrganizationRegistrationSerializer(serializers.Serializer):
    org_type = serializers.ChoiceField(choices=[UserRole.BROKER, UserRole.PROFESSIONAL])
    organization_name = serializers.CharField(max_length=200)
    full_name = serializers.CharField(max_length=150)
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(write_only=True, max_length=128)
    phone = serializers.CharField(max_length=32)
    country_code = serializers.CharField(max_length=2, min_length=2)
    plan = serializers.SlugField(required=False, allow_blank=True, default="")
    locale = serializers.ChoiceField(choices=Locale.choices, required=False, default=Locale.EN)

    def validate_email(self, value):
        normalized = UserManager.normalize_email(value)
        if User.objects.filter(email=normalized).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return normalized

    def validate_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages)) from exc
        return value

    def validate_country_code(self, value):
        if not value.isalpha():
            raise serializers.ValidationError("Use a two-letter country code.")
        return value.upper()

    def validate(self, attrs):
        if attrs["org_type"] == UserRole.BROKER:
            from brokers.models import BrokerPlan

            plan = BrokerPlan.objects.filter(slug=attrs.get("plan") or "", is_active=True).first()
            if plan is None:
                raise serializers.ValidationError({"plan": ["Choose one of the available plans."]})
            attrs["plan_obj"] = plan
        return attrs


def _unique_slug(model, name, fallback):
    base = slugify(name)[:200] or fallback
    slug, n = base, 2
    while model.objects.filter(slug=slug).exists():
        slug, n = f"{base}-{n}", n + 1
    return slug


@transaction.atomic
def register_organization(data: dict) -> User:
    org_type = data["org_type"]
    user = User.objects.create_user(
        email=data["email"],
        password=data["password"],
        full_name=data["full_name"],
        locale=data["locale"],
        primary_role=org_type,
    )
    if org_type == UserRole.BROKER:
        from brokers.enums import ROLE_DEFAULT_CAPABILITIES, BrokerMembershipRole
        from brokers.models import BrokerMembership, BrokerOrganization

        broker = BrokerOrganization.objects.create(
            name=data["organization_name"],
            slug=_unique_slug(BrokerOrganization, data["organization_name"], "broker"),
            public_email=data["email"],
            public_phone=data["phone"],
            country_code=data["country_code"],
            plan=data["plan_obj"],
        )
        BrokerMembership.objects.create(
            user=user,
            broker=broker,
            role=BrokerMembershipRole.ADMIN,
            **ROLE_DEFAULT_CAPABILITIES[BrokerMembershipRole.ADMIN],
        )
    else:
        from professionals.models import ProfessionalProfile

        # The post_save hook seats the owner as ADMIN.
        ProfessionalProfile.objects.create(
            owner_user=user,
            display_name=data["organization_name"],
            slug=_unique_slug(ProfessionalProfile, data["organization_name"], "professional"),
            public_email=data["email"],
            public_phone=data["phone"],
            country_code=data["country_code"],
        )
    queue_email_verification(user)
    return user
