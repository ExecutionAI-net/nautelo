from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.db.models.functions import Lower
from django.utils import timezone

from accounts.enums import Locale, UserRole
from common.models import UUIDTimeStampedModel


class UserManager(BaseUserManager):
    use_in_migrations = True

    @classmethod
    def normalize_email(cls, email):
        """Lowercase the WHOLE address, not just the domain.

        Django's BaseUserManager only lowercases the domain part, which would let
        'Alice@example.com' and 'alice@example.com' coexist as two identities.
        """
        return super().normalize_email(email or "").strip().lower()

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Users must have an email address.")
        extra_fields.setdefault("primary_role", UserRole.PRIVATE_SELLER)
        extra_fields.setdefault("locale", Locale.EN)
        user = self.model(email=self.normalize_email(email), **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("primary_role", UserRole.STAFF)
        extra_fields.setdefault("email_verified_at", timezone.now())
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")
        return self.create_user(email, password, **extra_fields)


class User(UUIDTimeStampedModel, AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(max_length=254, unique=True)
    email_verified_at = models.DateTimeField(null=True, blank=True)
    primary_role = models.CharField(
        max_length=20, choices=UserRole.choices, default=UserRole.PRIVATE_SELLER
    )
    locale = models.CharField(max_length=2, choices=Locale.choices, default=Locale.EN)
    full_name = models.CharField(max_length=150, blank=True)
    # Personal contact number, distinct from a broker/professional
    # organization's own public_phone (BrokerOrganization/ProfessionalProfile) -
    # this one is private to the account, editable from Account Settings.
    phone_number = models.CharField(max_length=32, blank=True, default="")
    # Marketing opt-in, tracked as an explicit yes/no on the account (not
    # inferred from any one inquiry's own "send me updates" checkbox), so it
    # can be set at signup and changed later from Account Settings.
    newsletter_opt_in = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(
        default=False, help_text="Can sign in to the Django admin site."
    )

    objects = UserManager()

    USERNAME_FIELD = "email"
    EMAIL_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        ordering = ("email",)
        constraints = [
            models.UniqueConstraint(Lower("email"), name="accounts_user_email_ci_unique"),
        ]

    def __str__(self):
        return self.email

    def save(self, *args, **kwargs):
        self.email = UserManager.normalize_email(self.email)
        return super().save(*args, **kwargs)

    @property
    def is_email_verified(self) -> bool:
        return self.email_verified_at is not None

    def get_full_name(self) -> str:
        return self.full_name or self.email

    def get_short_name(self) -> str:
        return self.full_name.split(" ")[0] if self.full_name else self.email


class EmailVerificationToken(UUIDTimeStampedModel):
    """Single-use, hashed, expiring email-verification token."""

    user = models.ForeignKey(
        "accounts.User",
        related_name="email_verification_tokens",
        on_delete=models.CASCADE,
    )
    token_hash = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [models.Index(fields=["user", "used_at"])]

    def __str__(self):
        return f"verification for {self.user_id}"


class PasswordResetToken(UUIDTimeStampedModel):
    """Single-use, hashed, short-lived password-reset token."""

    user = models.ForeignKey(
        "accounts.User",
        related_name="password_reset_tokens",
        on_delete=models.CASCADE,
    )
    token_hash = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [models.Index(fields=["user", "used_at"])]


class OrganizationInvitation(UUIDTimeStampedModel):
    """An emailed invitation into a broker or professional organization."""

    org_type = models.CharField(max_length=20, choices=[(UserRole.BROKER, "Broker"), (UserRole.PROFESSIONAL, "Professional")])
    broker = models.ForeignKey(
        "brokers.BrokerOrganization", null=True, blank=True, related_name="invitations", on_delete=models.CASCADE
    )
    professional = models.ForeignKey(
        "professionals.ProfessionalProfile", null=True, blank=True, related_name="invitations", on_delete=models.CASCADE
    )
    email = models.EmailField(max_length=254)
    role = models.CharField(max_length=10)
    invited_by = models.ForeignKey(
        "accounts.User", null=True, on_delete=models.SET_NULL, related_name="+"
    )
    token_hash = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    accepted_user = models.ForeignKey(
        "accounts.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )

    class Meta:
        ordering = ("-created_at",)
        indexes = [models.Index(fields=["email", "accepted_at"])]
        constraints = [
            models.CheckConstraint(
                condition=(models.Q(org_type="BROKER", broker__isnull=False, professional__isnull=True)
                           | models.Q(org_type="PROFESSIONAL", professional__isnull=False, broker__isnull=True)),
                name="accounts_invitation_one_organization",
            ),
        ]

    def __str__(self):
        return f"invite {self.email} -> {self.org_type}"
