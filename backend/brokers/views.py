from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import (
    IsActiveUser,
    IsBrokerTeamManager,
    IsEmailVerified,
    IsStaffAdmin,
    IsStaffModerator,
)
from brokers.models import BrokerMembership, BrokerOrganization
from brokers.serializers import (
    BrokerApprovalPolicySerializer,
    BrokerMembershipCreateSerializer,
    BrokerMembershipSerializer,
    BrokerMembershipUpdateSerializer,
    StaffBrokerDetailSerializer,
)
from brokers.services import set_broker_auto_approval
from listings.permissions import ListingWorkflowEnabled


class BrokerTeamBaseView(APIView):
    permission_classes = [IsActiveUser, IsEmailVerified, IsBrokerTeamManager]

    def get_broker(self):
        return get_object_or_404(BrokerOrganization, pk=self.kwargs["broker_id"])

    def get_locked_broker(self):
        """Lock the broker row, then the membership rows the admin count reads.

        Locking the parent row first gives every team-mutating request on this
        broker a single serialization point, so the last-admin check below is a
        genuine check-then-act rather than two racing reads.
        """
        broker = get_object_or_404(
            BrokerOrganization.objects.select_for_update(), pk=self.kwargs["broker_id"]
        )
        list(
            BrokerMembership.objects.select_for_update()
            .filter(broker=broker)
            .values_list("pk", flat=True)
        )
        return broker

    def get_membership(self, broker):
        return get_object_or_404(
            BrokerMembership, pk=self.kwargs["membership_id"], broker=broker
        )


class BrokerMemberListView(BrokerTeamBaseView):
    def get(self, request, broker_id):
        broker = self.get_broker()
        memberships = BrokerMembership.objects.select_related("user").filter(broker=broker)
        return Response(BrokerMembershipSerializer(memberships, many=True).data)

    @transaction.atomic
    def post(self, request, broker_id):
        broker = self.get_locked_broker()
        serializer = BrokerMembershipCreateSerializer(
            data=request.data, context={"broker": broker, "actor": request.user}
        )
        serializer.is_valid(raise_exception=True)
        membership = serializer.save()
        return Response(
            BrokerMembershipSerializer(membership).data, status=status.HTTP_201_CREATED
        )


class BrokerMemberDetailView(BrokerTeamBaseView):
    @transaction.atomic
    def patch(self, request, broker_id, membership_id):
        membership = self.get_membership(self.get_locked_broker())
        serializer = BrokerMembershipUpdateSerializer(
            membership,
            data=request.data,
            partial=True,
            context={"actor": request.user},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        membership.refresh_from_db()
        return Response(BrokerMembershipSerializer(membership).data)

    @transaction.atomic
    def delete(self, request, broker_id, membership_id):
        membership = self.get_membership(self.get_locked_broker())
        serializer = BrokerMembershipUpdateSerializer(
            membership,
            data={"is_active": False},
            partial=True,
            context={"actor": request.user},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


class StaffBrokerDetailView(APIView):
    """GET /api/v1/staff/brokers/<id>/ — the source behind spec §21's staff screen.

    IsStaffModerator, not IsStaffAdmin: spec §5 restricts *configuring* the
    policy to staff admin and says nothing about seeing it, and a moderator
    working the boats queue needs this broker's status, backlog and policy state
    to decide anything. The payload carries no contact details, no member list
    and no listing content — only counts, policy state and this organization's
    own audit rows.

    Not gated on the `listing_revisions` flag: refusing to *show* a policy state
    tells staff nothing and would hide the audit history during an incident. The
    two mutations that follow are gated.
    """

    permission_classes = [IsAuthenticated, IsActiveUser, IsStaffModerator]

    def get(self, request, broker_id):
        broker = get_object_or_404(
            BrokerOrganization.objects.select_related("auto_approve_changed_by"),
            pk=broker_id,
        )
        return Response(StaffBrokerDetailSerializer().to_representation(broker))


class BrokerApprovalPolicyView(APIView):
    """PATCH /api/v1/staff/brokers/<id>/approval-policy/ (spec §30.1, §21 rule 4).

    The permission stack is the whole security boundary of spec §5's
    "Configure broker auto-approval - staff admin only" row, so it is spelled
    out rather than inherited: authenticated, active, the `listing_revisions`
    flag (spec §35.1), and staff **admin**, strictly narrower than the
    IsStaffModerator gate on the read endpoint beside it.

    Returns the whole staff-broker detail payload plus `changed`, so the screen
    refreshes in one round trip (spec §30.2). A repeat toggle is a 200 with
    `changed: false` and no new audit row.
    """

    permission_classes = [
        IsAuthenticated,
        IsActiveUser,
        ListingWorkflowEnabled,
        IsStaffAdmin,
    ]

    def patch(self, request, broker_id):
        broker = get_object_or_404(BrokerOrganization, pk=broker_id)
        envelope = BrokerApprovalPolicySerializer(data=request.data)
        envelope.is_valid(raise_exception=True)

        change = set_broker_auto_approval(
            broker,
            enabled=envelope.validated_data["auto_approve_listings"],
            actor=request.user,
            reason=envelope.validated_data["reason"],
        )

        payload = StaffBrokerDetailSerializer().to_representation(change.broker)
        payload["changed"] = change.changed
        return Response(payload)
