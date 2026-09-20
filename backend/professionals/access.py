"""Who may act on a professional organization."""

from .models import ProfessionalMembership


def membership_for(user):
    """The user's live seat, or None."""
    if user is None or not getattr(user, "is_authenticated", False):
        return None
    return ProfessionalMembership.objects.select_related("profile").filter(user=user, is_active=True).first()


def profile_for(user):
    membership = membership_for(user)
    return membership.profile if membership else None


def add_owner_membership(profile, user):
    return ProfessionalMembership.objects.get_or_create(
        profile=profile,
        user=user,
        defaults={
            "role": "ADMIN",
            "is_owner": True,
            "can_edit_profile": True,
            "can_manage_team": True,
            "can_read_messages": True,
        },
    )[0]
