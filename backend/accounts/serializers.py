from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from accounts.enums import Locale, UserRole
from accounts.models import User, UserManager

# Plain sign-up always yields a private seller; broker/professional accounts
# are created through organization registration or a team invitation.
SELF_SERVICE_ROLES = (UserRole.PRIVATE_SELLER,)


class RegistrationSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(write_only=True, max_length=128)
    full_name = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")
    locale = serializers.ChoiceField(choices=Locale.choices, required=False, default=Locale.EN)
    primary_role = serializers.ChoiceField(
        choices=[(role.value, role.label) for role in SELF_SERVICE_ROLES],
        required=False,
        default=UserRole.PRIVATE_SELLER,
    )

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


class VerifyEmailSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=128)


class ResendVerificationSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)


class UserSummarySerializer(serializers.ModelSerializer):
    email_verified = serializers.BooleanField(source="is_email_verified", read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "full_name",
            "primary_role",
            "locale",
            "email_verified",
            "is_active",
        )
        read_only_fields = ("id", "email", "primary_role", "email_verified", "is_active")


class AccountUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("full_name", "locale")


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Authenticate by normalized email; expose the user summary alongside the tokens."""

    username_field = User.USERNAME_FIELD

    def validate(self, attrs):
        attrs[self.username_field] = UserManager.normalize_email(
            attrs.get(self.username_field, "")
        )
        data = super().validate(attrs)
        data["user"] = UserSummarySerializer(self.user).data
        return data
