from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsActiveUser, IsBrokerTeamManager, IsEmailVerified
from brokers.models import BrokerMembership, BrokerOrganization
from brokers.serializers import (
    BrokerMembershipCreateSerializer,
    BrokerMembershipSerializer,
    BrokerMembershipUpdateSerializer,
)


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
