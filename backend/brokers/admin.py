from django.contrib import admin
from django.db import transaction

from audit.models import AuditEvent
from brokers.forms import BrokerOrganizationAdminForm
from brokers.models import BrokerMembership, BrokerOrganization, BrokerPlan
from brokers.services import set_broker_auto_approval

POLICY_READONLY = ("auto_approve_changed_by", "auto_approve_changed_at")
BASE_READONLY = ("id", "created_at", "updated_at")


class BrokerMembershipInline(admin.TabularInline):
    model = BrokerMembership
    extra = 0
    fields = (
        "user",
        "role",
        "can_edit_listings",
        "can_manage_team",
        "can_read_messages",
        "is_active",
    )
    autocomplete_fields = ("user",)


@admin.register(BrokerPlan)
class BrokerPlanAdmin(admin.ModelAdmin):
    list_display = ("name", "monthly_price", "listing_limit", "seat_limit", "profile_visibility", "is_active", "display_order")
    list_editable = ("is_active", "display_order")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(BrokerOrganization)
class BrokerOrganizationAdmin(admin.ModelAdmin):
    form = BrokerOrganizationAdminForm
    list_display = (
        "name",
        "slug",
        "status",
        "plan",
        "plan_renews_at",
        "auto_approve_listings",
        "auto_approve_changed_at",
    )
    list_filter = ("status", "plan", "auto_approve_listings")
    search_fields = ("name", "slug", "public_email")
    prepopulated_fields = {"slug": ("name",)}
    inlines = [BrokerMembershipInline]

    def get_readonly_fields(self, request, obj=None):
        from accounts.services import is_staff_admin

        readonly = BASE_READONLY + POLICY_READONLY
        if not is_staff_admin(request.user):
            readonly += ("auto_approve_listings",)
        return readonly

    def _sync_policy_fields(self, obj, updated):
        # Keep the instance the admin will re-render in sync with the row.
        obj.auto_approve_listings = updated.auto_approve_listings
        obj.auto_approve_changed_by = updated.auto_approve_changed_by
        obj.auto_approve_changed_at = updated.auto_approve_changed_at

    def save_model(self, request, obj, form, change):
        from accounts.services import is_staff_admin

        if change and "auto_approve_listings" in form.changed_data:
            requested = obj.auto_approve_listings
            # The same row lock the service takes, held for the whole
            # read-revert-save-service sequence, so two concurrent staff edits
            # cannot interleave and clobber each other's audit stamp.
            with transaction.atomic():
                stored = (
                    BrokerOrganization.objects.select_for_update()
                    .get(pk=obj.pk)
                    .auto_approve_listings
                )

                # Revert the in-memory instance to the STORED value before the
                # plain save, so super().save_model() never writes this field
                # itself. The service below is the only path that may change it
                # - see the note.
                obj.auto_approve_listings = stored
                super().save_model(request, obj, form, change)

                if is_staff_admin(request.user) and requested != stored:
                    self._sync_policy_fields(
                        obj,
                        set_broker_auto_approval(
                            obj,
                            enabled=requested,
                            actor=request.user,
                            reason=form.cleaned_data["auto_approve_reason"],
                            source=AuditEvent.Source.ADMIN,
                        ).broker,
                    )
            return

        if not change and obj.auto_approve_listings:
            # Creating an organization with the policy already ON. The stored
            # value would then already match what the service is asked to set,
            # so the service would short-circuit and the audit columns would
            # stay NULL - the same trap as above, one step earlier. Create the
            # row OFF and let the service perform the single real transition.
            with transaction.atomic():
                obj.auto_approve_listings = False
                super().save_model(request, obj, form, change)

                if is_staff_admin(request.user):
                    self._sync_policy_fields(
                        obj,
                        set_broker_auto_approval(
                            obj,
                            enabled=True,
                            actor=request.user,
                            reason=form.cleaned_data["auto_approve_reason"],
                            source=AuditEvent.Source.ADMIN,
                        ).broker,
                    )
            return

        super().save_model(request, obj, form, change)


@admin.register(BrokerMembership)
class BrokerMembershipAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "broker",
        "role",
        "can_edit_listings",
        "can_manage_team",
        "is_active",
    )
    list_filter = ("role", "is_active", "broker")
    search_fields = ("user__email", "broker__name")
    autocomplete_fields = ("user", "broker")
    readonly_fields = BASE_READONLY
