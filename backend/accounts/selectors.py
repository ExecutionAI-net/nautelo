from accounts.enums import Locale, UserRole
from accounts.services import (
    has_any_broker_edit_membership,
    is_staff_admin,
    is_staff_moderator,
)

PERMISSION_KEYS = (
    "browse_public_content",
    "submit_inquiry",
    "reveal_contact_after_inquiry",
    "reveal_any_contact",
    "create_private_listing",
    "create_broker_listing",
    "create_listing_on_behalf",
    "enable_listing_finance_flag",
    "approve_listings_and_revisions",
    "configure_broker_auto_approval",
    "configure_products_and_settings",
    "manage_taxonomy",
)


def _is_usable(user) -> bool:
    return (
        user is not None
        and getattr(user, "is_authenticated", False)
        and getattr(user, "is_active", False)
    )


def get_session_permissions(user) -> dict:
    """Spec 5's capability table, evaluated server-side. Always returns every key."""
    usable = _is_usable(user)
    verified = usable and user.is_email_verified
    staff_moderator = is_staff_moderator(user) if usable else False
    staff_admin = is_staff_admin(user) if usable else False
    broker_editor = verified and has_any_broker_edit_membership(user)

    permissions = {
        "browse_public_content": True,
        "submit_inquiry": verified,
        "reveal_contact_after_inquiry": verified,
        "reveal_any_contact": staff_moderator,
        "create_private_listing": verified and user.primary_role == UserRole.PRIVATE_SELLER,
        "create_broker_listing": broker_editor,
        "create_listing_on_behalf": staff_admin,
        "enable_listing_finance_flag": broker_editor,
        "approve_listings_and_revisions": staff_moderator,
        "configure_broker_auto_approval": staff_admin,
        "configure_products_and_settings": staff_admin,
        "manage_taxonomy": staff_admin,
    }
    assert set(permissions) == set(PERMISSION_KEYS)  # keeps the contract honest
    return permissions


def get_broker_memberships(user) -> list:
    from brokers.models import BrokerMembership

    if not _is_usable(user):
        return []
    memberships = BrokerMembership.objects.select_related("broker").filter(
        user=user, is_active=True
    )
    return [
        {
            "broker_id": str(membership.broker_id),
            "broker_name": membership.broker.name,
            "broker_slug": membership.broker.slug,
            "broker_status": membership.broker.status,
            # Spec §11.1: read-only here; the only write path is the staff-admin
            # approval-policy PATCH. `broker` is already select_related.
            "broker_auto_approve_listings": membership.broker.auto_approve_listings,
            "role": membership.role,
            "can_edit_listings": membership.can_edit_listings,
            "can_manage_team": membership.can_manage_team,
            "can_read_messages": membership.can_read_messages,
        }
        for membership in memberships
    ]


def get_professional_profile_summary(user):
    from professionals.models import ProfessionalProfile

    if not _is_usable(user):
        return None
    from professionals.access import membership_for

    membership = membership_for(user)
    if membership is None:
        return None
    profile = membership.profile
    return {
        "role": membership.role,
        "is_owner": membership.is_owner,
        "can_edit_profile": membership.can_edit_profile,
        "can_manage_team": membership.can_manage_team,
        "can_read_messages": membership.can_read_messages,
        "id": str(profile.pk),
        "slug": profile.slug,
        "display_name": profile.display_name,
        "status": profile.status,
    }


def build_session_payload(user) -> dict:
    from accounts.serializers import UserSummarySerializer

    usable = _is_usable(user)
    return {
        "authenticated": usable,
        "user": UserSummarySerializer(user).data if usable else None,
        "locale": user.locale if usable else Locale.EN,
        "permissions": get_session_permissions(user),
        "broker_memberships": get_broker_memberships(user),
        "professional_profile": get_professional_profile_summary(user),
        "staff": {
            "is_staff_moderator": is_staff_moderator(user) if usable else False,
            "is_staff_admin": is_staff_admin(user) if usable else False,
        },
    }
