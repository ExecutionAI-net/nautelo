"""Spec §19.4: "Restrict access to row-level analytics to authorized
staff/engineering; sellers receive aggregate values only."

Django admin is the only row-level surface this project exposes, so the
restriction is implemented here and nowhere else — there is no analytics API,
no serializer and no staff endpoint that returns a ListingView.
"""

from django.contrib import admin

from accounts.services import is_staff_admin

from .models import ListingView


@admin.register(ListingView)
class ListingViewAdmin(admin.ModelAdmin):
    """Read-only, staff-administrator-only, and never shows a full hash.

    Why staff *admin* rather than staff moderator: a moderator's job (spec §5) is
    approving listings, which needs the listing's content, not the identities of
    the people who looked at it. Spec §19.4 says "authorized staff/engineering",
    and the narrower of the two existing tiers is the one that matches.
    """

    list_display = (
        "id",
        "listing",
        "viewer_type",
        "masked_viewer_hash",
        "user_agent_class",
        "first_viewed_at",
        "last_seen_at",
    )
    list_filter = ("viewer_type", "user_agent_class")
    search_fields = ("listing__id",)
    raw_id_fields = ("listing", "viewer_user")
    readonly_fields = (
        "id",
        "listing",
        "viewer_type",
        "viewer_user",
        "masked_viewer_hash",
        "first_viewed_at",
        "last_seen_at",
        "user_agent_class",
    )
    # `viewer_hash` is deliberately absent from both `fields` and `list_display`:
    # the masked accessor below is the only way it is ever rendered.
    fields = readonly_fields

    @admin.display(description="Viewer hash")
    def masked_viewer_hash(self, obj):
        if not obj.viewer_hash:
            return "—"
        return f"{obj.viewer_hash[:12]}… (masked)"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def has_view_permission(self, request, obj=None):
        return is_staff_admin(getattr(request, "user", None))

    def has_module_permission(self, request):
        return is_staff_admin(getattr(request, "user", None))
