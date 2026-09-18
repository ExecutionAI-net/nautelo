from rest_framework.permissions import BasePermission

from accounts.services import (
    can_edit_owned_object,
    can_manage_broker_team,
    can_read_broker_messages,
    is_staff_admin,
    is_staff_moderator,
)


class IsActiveUser(BasePermission):
    message = "Authentication is required."
    code = "authentication_required"

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_active)


class IsEmailVerified(BasePermission):
    """Spec 12 item 3: verified email for inquiry, listing submission and Checkout."""

    message = "Verify your email address first."
    code = "email_not_verified"

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user and user.is_authenticated and user.is_active and user.is_email_verified
        )


class IsStaffModerator(BasePermission):
    message = "Staff moderator access is required."
    code = "staff_moderator_required"

    def has_permission(self, request, view):
        return is_staff_moderator(request.user)


class IsStaffAdmin(BasePermission):
    message = "Staff administrator access is required."
    code = "staff_admin_required"

    def has_permission(self, request, view):
        return is_staff_admin(request.user)


class IsOwnerOrBrokerEditor(BasePermission):
    """Object-level ownership. The object must expose owner_user_id and/or broker_id.

    EDIT capability only: it delegates to can_edit_owned_object, which gates on
    the `can_edit_listings` flag. It is NOT the class for reading a broker's
    conversations - see CanReadBrokerMessages below.
    """

    message = "You do not have permission to modify this record."
    code = "not_object_owner"

    def has_object_permission(self, request, view, obj):
        return can_edit_owned_object(
            request.user,
            owner_user_id=getattr(obj, "owner_user_id", None),
            broker_id=getattr(obj, "broker_id", None),
        )


class IsBrokerTeamManager(BasePermission):
    """View-level: the caller may manage the team of view.kwargs['broker_id']."""

    message = "You do not have permission to manage this broker's team."
    code = "not_broker_team_manager"

    def has_permission(self, request, view):
        broker_id = getattr(view, "kwargs", {}).get("broker_id")
        return can_manage_broker_team(request.user, broker_id)


class CanReadBrokerMessages(BasePermission):
    """View-level: the caller may read the message threads of view.kwargs['broker_id'].

    Mirrors IsBrokerTeamManager exactly, but delegates to can_read_broker_messages()
    - i.e. the `can_read_messages` capability flag, NOT `can_edit_listings`. Phase 6
    (messaging) uses this class; IsOwnerOrBrokerEditor is the wrong tool there,
    because an AGENT with can_edit_listings=True and can_read_messages=False would
    pass it and read conversations they have no right to see.
    """

    message = "You do not have permission to read this broker's messages."
    code = "not_broker_message_reader"

    def has_permission(self, request, view):
        broker_id = getattr(view, "kwargs", {}).get("broker_id")
        return can_read_broker_messages(request.user, broker_id)
