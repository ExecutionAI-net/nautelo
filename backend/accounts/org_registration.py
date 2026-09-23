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
from accounts.validators import validate_phone_number as check_phone_number


class OrganizationRegistrationSerializer(serializers.Serializer):
    org_type = serializers.ChoiceField(choices=[UserRole.BROKER, UserRole.PROFESSIONAL])
    organization_name = serializers.CharField(max_length=200)
    full_name = serializers.CharField(max_length=150)
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(write_only=True, max_length=128)
    phone = serializers.CharField(max_length=32)
    newsletter_opt_in = serializers.BooleanField(required=False, default=False)
    country_code = serializers.CharField(max_length=2, min_length=2)
    plan = serializers.SlugField(required=False, allow_blank=True, default="")
    category = serializers.SlugField(required=False, allow_blank=True, default="")
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

    def validate_organization_name(self, value):
        value = value.strip()
        if "<" in value or ">" in value:
            raise serializers.ValidationError("The name cannot contain < or >.")
        return value

    def validate_phone(self, value):
        return check_phone_number(value)

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
        else:
            from services_catalog.models import ServiceCategory

            category = ServiceCategory.objects.filter(slug=attrs.get("category") or "", is_active=True).first()
            if category is None:
                raise serializers.ValidationError({"category": ["Choose one of the available categories."]})
            attrs["category_obj"] = category
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
        phone_number=data["phone"],
        newsletter_opt_in=data["newsletter_opt_in"],
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
            is_owner=True,
            **ROLE_DEFAULT_CAPABILITIES[BrokerMembershipRole.ADMIN],
        )
    else:
        from professionals.models import ProfessionalProfile
        from services_catalog.models import ProfessionalService

        # The post_save hook seats the owner as ADMIN.
        profile = ProfessionalProfile.objects.create(
            owner_user=user,
            display_name=data["organization_name"],
            slug=_unique_slug(ProfessionalProfile, data["organization_name"], "professional"),
            public_email=data["email"],
            public_phone=data["phone"],
            country_code=data["country_code"],
        )
        category = data["category_obj"]
        # Registration's own category pick becomes the profile's first
        # service, so a brand-new profile already has at least one active
        # service (professionals/completeness.py) and a non-zero
        # active_service_count - both of which the public directory's default
        # sort (services_catalog/views.py) uses to rank and surface it,
        # instead of a categoryless profile sinking to the last page.
        ProfessionalService.objects.create(
            professional=profile,
            category=category,
            title_en=category.name_en,
            is_active=True,
        )
    queue_email_verification(user)
    return user
