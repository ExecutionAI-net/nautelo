from django import forms
from django.contrib import admin, messages
from django.shortcuts import redirect, render

from accounts.services import is_staff_admin

from .models import UserEntitlement
from .services import (
    EntitlementReasonRequired,
    InvalidEntitlementState,
    restore_consumed_right,
    revoke_entitlement,
)


class EntitlementReasonForm(forms.Form):
    """Spec §26.3/§36.3's mandatory reason, collected on an intermediate page.

    The form is a convenience, not the enforcement: the services raise
    EntitlementReasonRequired on a blank reason regardless of entry point.
    """

    reason = forms.CharField(
        widget=forms.Textarea(attrs={"rows": 3}),
        label="Reason (recorded on the entitlement and in the audit trail)",
    )


@admin.register(UserEntitlement)
class UserEntitlementAdmin(admin.ModelAdmin):
    """Spec §26.3 item 1: "View entitlement ledger."

    Every field is read-only and there is no add form. The ledger is written
    only by entitlements.consumption and entitlements.services, which hold the
    transaction, the row locks and the audit event together; Django admin has
    none of that, so a hand-edited `state` would be an unaudited grant. Task 13
    adds the three *audited* staff operations as admin actions, which is how a
    staff admin changes a row.
    """

    list_display = (
        "id",
        "user",
        "entitlement_type",
        "source",
        "state",
        "listing",
        "valid_from",
        "valid_until",
        "consumed_at",
        "revoked_at",
    )
    list_filter = ("entitlement_type", "source", "state")
    search_fields = ("id", "user__email", "listing__id")
    raw_id_fields = ("user", "listing", "granted_by")
    date_hierarchy = "created_at"
    readonly_fields = tuple(
        field.name for field in UserEntitlement._meta.fields
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    actions = ("revoke_selected", "restore_selected")

    def get_actions(self, request):
        """Spec §5 / Phase 3 contract rule 6: grant, revoke and restore are
        staff-ADMIN operations. A staff moderator sees the ledger and no
        actions."""
        actions = super().get_actions(request)
        if not (is_staff_admin(request.user) or request.user.is_superuser):
            for name in ("revoke_selected", "restore_selected"):
                actions.pop(name, None)
        return actions

    def _with_reason(self, request, queryset, *, title, apply):
        """Render the reason form, then apply `apply(entitlement, reason)`."""
        if "apply_reason" in request.POST:
            form = EntitlementReasonForm(request.POST)
            if form.is_valid():
                reason = form.cleaned_data["reason"]
                done = 0
                for entitlement in queryset:
                    try:
                        apply(entitlement, reason)
                    except (InvalidEntitlementState, EntitlementReasonRequired) as exc:
                        self.message_user(
                            request, f"{entitlement.pk}: {exc}", level=messages.ERROR
                        )
                    else:
                        done += 1
                self.message_user(request, f"{done} entitlement(s) updated.")
                return redirect(request.get_full_path())
        else:
            form = EntitlementReasonForm()
        return render(
            request,
            "admin/entitlements/reason_action.html",
            {
                "title": title,
                "form": form,
                "queryset": queryset,
                "action_checkbox_name": admin.helpers.ACTION_CHECKBOX_NAME,
            },
        )

    @admin.action(description="Revoke selected entitlements (reason required)")
    def revoke_selected(self, request, queryset):
        return self._with_reason(
            request,
            queryset,
            title="Revoke entitlements",
            apply=lambda entitlement, reason: revoke_entitlement(
                entitlement=entitlement, actor=request.user, reason=reason
            ),
        )

    @admin.action(description="Restore selected consumed rights (reason required)")
    def restore_selected(self, request, queryset):
        return self._with_reason(
            request,
            queryset,
            title="Restore consumed rights",
            apply=lambda entitlement, reason: restore_consumed_right(
                entitlement=entitlement, actor=request.user, reason=reason
            ),
        )
