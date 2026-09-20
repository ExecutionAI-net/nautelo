from django.contrib import admin, messages
from django.shortcuts import redirect, render
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
    actions = ("gift_paid_listing",)
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

    @admin.action(description="Gift one paid listing to selected users (reason required)")
    def gift_paid_listing(self, request, queryset):
        """Staff-admin gift: a paid listing right that never expires in practice."""
        from accounts.services import is_staff_admin
        from django import forms

        from entitlements.services import EntitlementReasonRequired, grant_listing_right
        from payments.models import ListingPackage

        class GiftForm(forms.Form):
            package = forms.ModelChoiceField(
                queryset=ListingPackage.objects.all(),
                required=False,
                empty_label="No package (platform defaults)",
                help_text="The gift carries this package's days, photos and videos.",
            )
            reason = forms.CharField(
                widget=forms.Textarea(attrs={"rows": 3}),
                label="Reason (recorded on the entitlement and in the audit trail)",
            )

        if not is_staff_admin(request.user):
            self.message_user(request, "Only staff admins can gift listings.", level=messages.ERROR)
            return None
        if "apply_reason" in request.POST:
            form = GiftForm(request.POST)
            if form.is_valid():
                done = 0
                package = form.cleaned_data["package"]
                extra = (
                    {
                        "package": package.slug,
                        "publication_days": package.publication_days,
                        "image_limit": package.image_limit,
                        "video_limit": package.video_limit,
                    }
                    if package
                    else {}
                )
                for user in queryset:
                    try:
                        grant_listing_right(
                            user=user,
                            actor=request.user,
                            reason=form.cleaned_data["reason"],
                            valid_days=3650,
                            extra_metadata=extra,
                        )
                    except EntitlementReasonRequired as exc:
                        self.message_user(request, str(exc), level=messages.ERROR)
                    else:
                        done += 1
                self.message_user(request, f"{done} paid listing(s) gifted.")
                return redirect(request.get_full_path())
        else:
            form = GiftForm()
        return render(
            request,
            "admin/entitlements/reason_action.html",
            {
                "title": "Gift a paid listing",
                "form": form,
                "queryset": queryset,
                "action_checkbox_name": admin.helpers.ACTION_CHECKBOX_NAME,
            },
        )
