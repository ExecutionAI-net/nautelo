from django.db import models


class BrokerOrganizationStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    PENDING = "PENDING", "Pending"
    ACTIVE = "ACTIVE", "Active"
    SUSPENDED = "SUSPENDED", "Suspended"


class BrokerMembershipRole(models.TextChoices):
    ADMIN = "ADMIN", "Broker admin"
    MANAGER = "MANAGER", "Manager"
    AGENT = "AGENT", "Agent"
    VIEWER = "VIEWER", "Viewer"


#: The capability set each role is reset to when a membership's role CHANGES.
#: It is not applied on every save - within a role, the three flags stay
#: individually tunable per member (spec 5's "Broker member - with permission").
#: See the "Note (role capability defaults)" in models.py below for the ruling.
ROLE_DEFAULT_CAPABILITIES = {
    BrokerMembershipRole.ADMIN: {
        "can_edit_listings": True,
        "can_manage_team": True,
        "can_read_messages": True,
    },
    BrokerMembershipRole.MANAGER: {
        "can_edit_listings": True,
        "can_manage_team": False,
        "can_read_messages": True,
    },
    BrokerMembershipRole.AGENT: {
        "can_edit_listings": True,
        "can_manage_team": False,
        "can_read_messages": False,
    },
    BrokerMembershipRole.VIEWER: {
        "can_edit_listings": False,
        "can_manage_team": False,
        "can_read_messages": False,
    },
}
