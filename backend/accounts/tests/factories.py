from uuid import uuid4

from django.utils import timezone

from accounts.enums import Locale, UserRole
from accounts.models import User

DEFAULT_TEST_PASSWORD = "n4uta-test-Passw0rd"


def make_user(
    email=None,
    *,
    password=DEFAULT_TEST_PASSWORD,
    verified=True,
    role=UserRole.BUYER,
    locale=Locale.EN,
    is_active=True,
    full_name="",
    **extra,
):
    if email is None:
        email = f"user-{uuid4().hex[:8]}@example.com"
    user = User.objects.create_user(
        email=email,
        password=password,
        primary_role=role,
        locale=locale,
        is_active=is_active,
        full_name=full_name,
        **extra,
    )
    if verified:
        user.email_verified_at = timezone.now()
        user.save(update_fields=["email_verified_at", "updated_at"])
    return user
