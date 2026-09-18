from django.contrib import admin

from .models import UserEntitlement


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

    def has_delete_permission(self, request, obj=None):
        return False
