from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from accounts.forms import AdminUserChangeForm, AdminUserCreationForm
from accounts.models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    form = AdminUserChangeForm
    add_form = AdminUserCreationForm
    model = User
    ordering = ("email",)
    list_display = ("email", "full_name", "primary_role", "is_active", "email_verified_at")
    list_filter = ("primary_role", "is_active", "is_staff", "is_superuser", "locale")
    search_fields = ("email", "full_name")
    readonly_fields = ("id", "created_at", "updated_at", "last_login")
    filter_horizontal = ("groups", "user_permissions")
    fieldsets = (
        (None, {"fields": ("id", "email", "password")}),
        ("Profile", {"fields": ("full_name", "locale", "primary_role")}),
        ("Verification", {"fields": ("email_verified_at",)}),
        (
            "Permissions",
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                )
            },
        ),
        ("Timestamps", {"fields": ("last_login", "created_at", "updated_at")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "email",
                    "full_name",
                    "primary_role",
                    "locale",
                    "password1",
                    "password2",
                ),
            },
        ),
    )
