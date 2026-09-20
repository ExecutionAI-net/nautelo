"""Team management for a professional organization (list, change role, remove)."""

from django.db import transaction
from rest_framework import serializers, status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsActiveUser, IsEmailVerified
from services_catalog.provider_views import IsServiceProvider

from .access import membership_for
from .enums import ProfessionalMembershipRole
from .models import ProfessionalMembership

ELEVATED_FIELDS = ("role", "can_edit_profile", "can_manage_team", "can_read_messages")


class MembershipSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_full_name = serializers.CharField(source="user.full_name", read_only=True)

    class Meta:
        model = ProfessionalMembership
        fields = (
            "id",
            "user_email",
            "user_full_name",
            "role",
            "is_owner",
            "can_edit_profile",
            "can_manage_team",
            "can_read_messages",
            "show_on_profile",
            "is_active",
            "created_at",
        )
        read_only_fields = fields


class MembershipUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProfessionalMembership
        fields = ("role", "can_edit_profile", "can_manage_team", "can_read_messages", "show_on_profile", "is_active")

    def validate(self, attrs):
        membership = self.instance
        actor = self.context["actor_membership"]
        touching_elevated = any(field in attrs for field in ELEVATED_FIELDS)
        own_row = membership.pk == actor.pk

        if membership.is_owner and (touching_elevated or attrs.get("is_active") is False):
            raise serializers.ValidationError({"role": ["cannot_change_owner"]})
        if touching_elevated and own_row:
            raise serializers.ValidationError({"role": ["cannot_change_own_role"]})

        role = attrs.get("role", membership.role)
        manage_team = attrs.get("can_manage_team", membership.can_manage_team)
        grants_admin = role == ProfessionalMembershipRole.ADMIN or bool(manage_team)
        if grants_admin and touching_elevated and actor.role != ProfessionalMembershipRole.ADMIN:
            field = "role" if role == ProfessionalMembershipRole.ADMIN else "can_manage_team"
            raise serializers.ValidationError({field: ["admin_grant_requires_admin"]})
        # Only an ADMIN may touch another ADMIN at all.
        if membership.role == ProfessionalMembershipRole.ADMIN and not own_row and actor.role != ProfessionalMembershipRole.ADMIN:
            raise serializers.ValidationError({"role": ["admin_grant_requires_admin"]})

        if "role" in attrs and attrs["role"] != membership.role:
            conflicting = [f for f in ELEVATED_FIELDS if f != "role" and f in attrs]
            if conflicting:
                raise serializers.ValidationError({f: ["set_flags_in_a_separate_request"] for f in conflicting})
        return attrs


class TeamBaseView(APIView):
    permission_classes = [IsActiveUser, IsEmailVerified, IsServiceProvider]
    throttle_scope = "broker_team"

    def actor(self, *, manage: bool):
        membership = membership_for(self.request.user)
        if membership is None:
            raise NotFound("No provider profile yet.")
        if manage and not membership.can_manage_team:
            raise PermissionDenied("You cannot manage this team.")
        return membership


class TeamListView(TeamBaseView):
    def get(self, request):
        actor = self.actor(manage=False)
        members = ProfessionalMembership.objects.select_related("user").filter(profile=actor.profile)
        return Response(MembershipSerializer(members, many=True).data)


class TeamMemberView(TeamBaseView):
    def _target(self, actor, pk):
        # Lock the whole team so the last-admin check cannot race.
        list(
            ProfessionalMembership.objects.select_for_update()
            .filter(profile=actor.profile)
            .values_list("pk", flat=True)
        )
        try:
            return ProfessionalMembership.objects.get(pk=pk, profile=actor.profile)
        except ProfessionalMembership.DoesNotExist as exc:
            raise NotFound() from exc

    @transaction.atomic
    def patch(self, request, pk):
        actor = self.actor(manage=True)
        target = self._target(actor, pk)
        serializer = MembershipUpdateSerializer(
            target, data=request.data, partial=True, context={"actor_membership": actor}
        )
        serializer.is_valid(raise_exception=True)
        self._guard_last_admin(target, serializer.validated_data)
        serializer.save()
        target.refresh_from_db()
        return Response(MembershipSerializer(target).data)

    @transaction.atomic
    def delete(self, request, pk):
        actor = self.actor(manage=True)
        target = self._target(actor, pk)
        serializer = MembershipUpdateSerializer(
            target, data={"is_active": False}, partial=True, context={"actor_membership": actor}
        )
        serializer.is_valid(raise_exception=True)
        self._guard_last_admin(target, serializer.validated_data)
        serializer.save()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @staticmethod
    def _guard_last_admin(target, data):
        losing = (
            data.get("role", target.role) != ProfessionalMembershipRole.ADMIN or data.get("is_active", target.is_active) is False
        )
        if target.role == ProfessionalMembershipRole.ADMIN and target.is_active and losing:
            others = (
                ProfessionalMembership.objects.filter(
                    profile=target.profile, role=ProfessionalMembershipRole.ADMIN, is_active=True
                )
                .exclude(pk=target.pk)
                .exists()
            )
            if not others:
                raise serializers.ValidationError({"role": ["last_admin"]})
