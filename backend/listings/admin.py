from django.contrib import admin

from .models import BoatListing, ListingMedia, ListingRevision, ListingSnapshot


@admin.register(BoatListing)
class BoatListingAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "seller_type",
        "status",
        "brand",
        "model",
        "manufacture_year",
        "price",
        "published_at",
        "expires_at",
        "version",
    )
    list_filter = ("status", "seller_type", "show_finance_estimate")
    search_fields = ("id", "custom_model_name")
    # The workflow services (listings.decisions, listings.drafts,
    # listings.submissions) are the only sanctioned writers of a listing's
    # lifecycle and ownership state, because they are what enforce the state
    # machine, the optimistic locking and the audit trail. Django admin has none
    # of that, so every field they own is read-only here — including `status`
    # (a free-text hop past LISTING_TRANSITIONS), `current_public_snapshot`
    # (an unfiltered dropdown over every snapshot in the database, i.e. a way to
    # publish another listing's content under this row) and the three ownership
    # fields that decide who may edit the listing at all.
    readonly_fields = (
        "id",
        "version",
        "status",
        "current_public_snapshot",
        "seller_type",
        "owner_user",
        "broker",
        "published_at",
        "expires_at",
        "publication_source",
        "consumed_entitlement",
        "view_count_cached",
        "created_at",
        "updated_at",
    )
    raw_id_fields = ("brand", "model", "created_by", "updated_by")


@admin.register(ListingMedia)
class ListingMediaAdmin(admin.ModelAdmin):
    list_display = ("id", "listing", "media_type", "status", "sort_order", "byte_size")
    list_filter = ("media_type", "status")
    search_fields = ("id", "storage_key", "checksum_sha256")
    raw_id_fields = ("listing", "created_by")


@admin.register(ListingSnapshot)
class ListingSnapshotAdmin(admin.ModelAdmin):
    list_display = ("id", "listing", "version", "price", "approved_by", "approved_at")
    search_fields = ("id", "listing__id", "title_en")
    raw_id_fields = ("listing", "approved_revision", "approved_by")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(ListingRevision)
class ListingRevisionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "listing",
        "revision_number",
        "state",
        "origin",
        "submitted_at",
        "decided_by",
        "decided_at",
        "version",
    )
    list_filter = ("state", "origin")
    search_fields = ("id", "listing__id")
    raw_id_fields = ("listing", "base_snapshot", "submitted_by", "decided_by")
    # `state` and `payload` are the revision's whole substance: the state machine
    # in listings.enums and the decision services own the former, and the latter
    # is what an approval turns into a public snapshot. Neither may be hand-edited
    # past the services that validate and audit them.
    readonly_fields = ("version", "state", "payload", "created_at", "updated_at")
