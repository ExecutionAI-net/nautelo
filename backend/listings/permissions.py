from rest_framework.permissions import BasePermission

from platform_settings.services import is_feature_enabled

LISTING_WORKFLOW_FLAG = "listing_revisions"


class ListingWorkflowEnabled(BasePermission):
    """Spec §35.1: `listing_revisions` gates backend mutation, not just UI."""

    message = "This feature is not enabled yet."
    code = "feature_disabled"

    def has_permission(self, request, view):
        return is_feature_enabled(LISTING_WORKFLOW_FLAG, default=False)
