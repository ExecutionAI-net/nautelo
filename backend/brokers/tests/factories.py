from brokers.enums import BrokerMembershipRole, BrokerOrganizationStatus
from brokers.models import BrokerMembership, BrokerOrganization


def make_broker(
    name="Blue Marine Brokers",
    slug="blue-marine-brokers",
    *,
    status=BrokerOrganizationStatus.ACTIVE,
    **extra,
):
    return BrokerOrganization.objects.create(
        name=name,
        slug=slug,
        status=status,
        public_email=extra.pop("public_email", "office@blue-marine.example"),
        public_phone=extra.pop("public_phone", "+34600000000"),
        **extra,
    )


def make_membership(
    user,
    broker,
    *,
    role=BrokerMembershipRole.AGENT,
    can_edit_listings=False,
    can_manage_team=False,
    can_read_messages=False,
    is_active=True,
):
    return BrokerMembership.objects.create(
        user=user,
        broker=broker,
        role=role,
        can_edit_listings=can_edit_listings,
        can_manage_team=can_manage_team,
        can_read_messages=can_read_messages,
        is_active=is_active,
    )
