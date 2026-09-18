from rest_framework.exceptions import NotFound
from rest_framework.permissions import BasePermission

from platform_settings.services import is_feature_enabled

# Spec §35.1 rollout flag for this phase.
COMBINED_DIRECTORY_FLAG = "combined_services_professionals"


class CombinedDirectoryEnabled(BasePermission):
    """Make the whole combined-directory read surface vanish when the flag is off.

    404 rather than 403: with the feature disabled the resource genuinely does
    not exist publicly, and the Next.js pages already handle 404 (spec §35.3).
    default=False fails closed if the seeded flag row is ever removed.
    """

    def has_permission(self, request, view):
        if not is_feature_enabled(COMBINED_DIRECTORY_FLAG, default=False):
            raise NotFound()
        return True
