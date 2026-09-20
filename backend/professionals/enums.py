from django.db import models


class ProfessionalProfileStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    PENDING = "PENDING", "Pending"
    ACTIVE = "ACTIVE", "Active"
    SUSPENDED = "SUSPENDED", "Suspended"


class SubscriptionStatus(models.TextChoices):
    INACTIVE = "INACTIVE", "Inactive"
    ACTIVE = "ACTIVE", "Active"
    PAST_DUE = "PAST_DUE", "Past due"
    LAPSED = "LAPSED", "Lapsed"
    CANCELED = "CANCELED", "Canceled"


class ProfessionalMembershipRole(models.TextChoices):
    ADMIN = "ADMIN", "Admin"
    MANAGER = "MANAGER", "Manager"
    AGENT = "AGENT", "Agent"
    VIEWER = "VIEWER", "Viewer"


#: Capabilities a membership is reset to when its role changes.
ROLE_DEFAULT_CAPABILITIES = {
    ProfessionalMembershipRole.ADMIN: {"can_edit_profile": True, "can_manage_team": True, "can_read_messages": True},
    ProfessionalMembershipRole.MANAGER: {"can_edit_profile": True, "can_manage_team": False, "can_read_messages": True},
    ProfessionalMembershipRole.AGENT: {"can_edit_profile": True, "can_manage_team": False, "can_read_messages": False},
    ProfessionalMembershipRole.VIEWER: {"can_edit_profile": False, "can_manage_team": False, "can_read_messages": False},
}
