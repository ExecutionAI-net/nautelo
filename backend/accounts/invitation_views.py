from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.enums import UserRole
from accounts.invitations import (
    accept_invitation,
    create_invitation,
    pending_for,
    preview_invitation,
    revoke_invitation,
)
from accounts.permissions import IsActiveUser, IsBrokerTeamManager, IsEmailVerified

ROLE_CHOICES = ("ADMIN", "MANAGER", "AGENT", "VIEWER")


class InviteCreateSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    role = serializers.ChoiceField(choices=ROLE_CHOICES, default="AGENT")


def _row(invitation):
    return {
        "id": str(invitation.pk),
        "email": invitation.email,
        "role": invitation.role,
        "invited_by": invitation.invited_by.email if invitation.invited_by else None,
        "expires_at": invitation.expires_at,
        "created_at": invitation.created_at,
    }


class InvitationPreviewView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_scope = "auth"

    def post(self, request):
        return Response(preview_invitation(request.data.get("token", "")))


class InvitationAcceptView(APIView):
    """Public for a brand-new address; an existing account must be signed in."""

    permission_classes = [AllowAny]
    throttle_scope = "auth"

    def post(self, request):
        user = request.user if request.user and request.user.is_authenticated else None
        accepted = accept_invitation(
            raw_token=request.data.get("token", ""),
            user=user,
            password=request.data.get("password", ""),
            full_name=(request.data.get("full_name") or "")[:150],
        )
        return Response({"email": accepted.email, "role": accepted.primary_role}, status=status.HTTP_201_CREATED)


class _InviteBase(APIView):
    throttle_scope = "broker_team"

    def org(self, request, **kwargs):  # pragma: no cover - overridden
        raise NotImplementedError

    def get(self, request, **kwargs):
        org_type, org = self.org(request, **kwargs)
        return Response([_row(i) for i in pending_for(org_type, org)])

    def post(self, request, **kwargs):
        org_type, org = self.org(request, **kwargs)
        serializer = InviteCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invitation, _ = create_invitation(
            actor=request.user, org_type=org_type, org=org, **serializer.validated_data
        )
        return Response(_row(invitation), status=status.HTTP_201_CREATED)

    def delete(self, request, invitation_id, **kwargs):
        org_type, org = self.org(request, **kwargs)
        invitation = get_object_or_404(pending_for(org_type, org), pk=invitation_id)
        revoke_invitation(invitation)
        return Response(status=status.HTTP_204_NO_CONTENT)


class BrokerInvitationView(_InviteBase):
    permission_classes = [IsActiveUser, IsEmailVerified, IsBrokerTeamManager]

    def org(self, request, broker_id):
        from brokers.models import BrokerOrganization

        return UserRole.BROKER, get_object_or_404(BrokerOrganization, pk=broker_id)


class ProfessionalInvitationView(_InviteBase):
    permission_classes = [IsActiveUser, IsEmailVerified]

    def org(self, request):
        from professionals.access import membership_for

        seat = membership_for(request.user)
        if seat is None:
            raise NotFound("No provider profile yet.")
        if not seat.can_manage_team:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("You cannot manage this team.")
        return UserRole.PROFESSIONAL, seat.profile
