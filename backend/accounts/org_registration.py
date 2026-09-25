"""Self-service registration of a broker or professional organization.

One request creates the owner account (with the organization's role), the
organization (DRAFT until it is paid for and approved) and the owner's ADMIN
seat, then sends the email-verification link. Billing and the profile come
next, once the owner is signed in.
"""

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
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
    # A professional may represent more than one trade, but a profile that
    # claims everything stops meaning anything - two is the ceiling (customer
    # feedback, 2026-09-25).
    categories = serializers.ListField(
        child=serializers.SlugField(), required=False, default=list, max_length=2
    )
    locale = serializers.ChoiceField(choices=Locale.choices, required=False, default=Locale.EN)
    # Broker-only fields (customer feedback, 2026-09-25). Required only for
    # org_type=BROKER - see validate() - so a professional registration's
    # payload is unaffected.
    trading_name = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    role = serializers.SlugField(required=False, allow_blank=True, default="")
    registration_id = serializers.RegexField(r"^[0-9a-fA-F-]{16,64}$", required=False, allow_blank=True, default="")
    logo_key = serializers.CharField(max_length=400, required=False, allow_blank=True, default="")
    document_keys = serializers.ListField(
        child=serializers.CharField(max_length=400), required=False, default=list
    )
    # Required for every org registration, not just BROKER (customer
    # feedback, 2026-09-25); register_organization() stamps the acceptance
    # time onto the new user.
    accept_terms = serializers.BooleanField()

    def validate_accept_terms(self, value):
        if not value:
            raise serializers.ValidationError("You must accept the Terms and Conditions.")
        return value

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
            from brokers.models import BrokerPlan, BrokerRole

            plan = BrokerPlan.objects.filter(slug=attrs.get("plan") or "", is_active=True).first()
            if plan is None:
                raise serializers.ValidationError({"plan": ["Choose one of the available plans."]})
            attrs["plan_obj"] = plan

            errors = {}
            if not (attrs.get("trading_name") or "").strip():
                errors["trading_name"] = ["This field is required."]
            role = BrokerRole.objects.filter(slug=attrs.get("role") or "", is_active=True).first()
            if role is None:
                errors["role"] = ["Choose one of the available roles."]
            if not attrs.get("logo_key"):
                errors["logo_key"] = ["Upload your company logo."]
            document_keys = attrs.get("document_keys") or []
            if not document_keys:
                errors["document_keys"] = ["Upload at least one document."]
            if errors:
                raise serializers.ValidationError(errors)

            from accounts.registration_uploads import document_key_is_valid, logo_key_is_valid

            registration_id = attrs.get("registration_id") or ""
            if not registration_id or not logo_key_is_valid(registration_id=registration_id, key=attrs["logo_key"]):
                raise serializers.ValidationError({"logo_key": ["This upload could not be verified. Please upload the logo again."]})
            if not all(document_key_is_valid(registration_id=registration_id, key=key) for key in document_keys):
                raise serializers.ValidationError({"document_keys": ["This upload could not be verified. Please upload the document(s) again."]})
            attrs["role_obj"] = role
        else:
            from services_catalog.models import ServiceCategory

            slugs = attrs.get("categories") or []
            if not slugs:
                raise serializers.ValidationError({"categories": ["Choose at least one category."]})
            categories = list(ServiceCategory.objects.filter(slug__in=slugs, is_active=True))
            if len(categories) != len(set(slugs)):
                raise serializers.ValidationError({"categories": ["Choose one of the available categories."]})
            # Preserve the order the user picked them in, not the query's.
            attrs["category_objs"] = sorted(categories, key=lambda c: slugs.index(c.slug))
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
        terms_accepted_at=timezone.now(),
    )
    if org_type == UserRole.BROKER:
        from brokers.enums import ROLE_DEFAULT_CAPABILITIES, BrokerMembershipRole
        from brokers.models import BrokerMembership, BrokerOrganization, BrokerVerificationDocument

        broker = BrokerOrganization.objects.create(
            name=data["organization_name"],
            trading_name=data["trading_name"].strip(),
            slug=_unique_slug(BrokerOrganization, data["organization_name"], "broker"),
            public_email=data["email"],
            public_phone=data["phone"],
            country_code=data["country_code"],
            plan=data["plan_obj"],
            owner_role=data["role_obj"],
            logo_key=data["logo_key"],
        )
        BrokerVerificationDocument.objects.bulk_create(
            [BrokerVerificationDocument(broker=broker, storage_key=key) for key in data["document_keys"]]
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
        # Registration's own category pick(s) become the profile's first
        # service(s), so a brand-new profile already has at least one active
        # service (professionals/completeness.py) and a non-zero
        # active_service_count - both of which the public directory's default
        # sort (services_catalog/views.py) uses to rank and surface it,
        # instead of a categoryless profile sinking to the last page.
        for category in data["category_objs"]:
            ProfessionalService.objects.create(
                professional=profile,
                category=category,
                title_en=category.name_en,
                is_active=True,
            )
    queue_email_verification(user)
    return user
