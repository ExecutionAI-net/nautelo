"""Broker organization profile self service (spec §4 /dashboard/broker/profile/).

Same tier as team management: `IsBrokerTeamManager` already resolves the
`broker_id` in the URL to an active admin-level membership of that broker.
Status, slug and the auto-approve policy are deliberately not writable here.
"""

from rest_framework import serializers
from rest_framework.response import Response

from brokers.models import BrokerOrganization
from brokers.views import BrokerTeamBaseView


class BrokerProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = BrokerOrganization
        fields = ("id", "name", "slug", "status", "public_email", "public_phone", "website_url", "auto_approve_listings")
        read_only_fields = ("id", "slug", "status", "auto_approve_listings")


class BrokerProfileView(BrokerTeamBaseView):
    def get(self, request, broker_id):
        return Response(BrokerProfileSerializer(self.get_broker()).data)

    def patch(self, request, broker_id):
        serializer = BrokerProfileSerializer(self.get_broker(), data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        return Response(BrokerProfileSerializer(serializer.save()).data)
