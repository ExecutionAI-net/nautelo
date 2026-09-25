"""Broker organization profile self service (spec §4 /dashboard/broker/profile/).

Same tier as team management: `IsBrokerTeamManager` already resolves the
`broker_id` in the URL to an active admin-level membership of that broker.
Status, slug and the auto-approve policy are deliberately not writable here.
"""

from rest_framework import serializers
from rest_framework.response import Response

from brokers.models import BrokerOrganization
from common.field_rules import phone_number, plain_text, service_country
from brokers.plans import plan_usage
from brokers.views import BrokerTeamBaseView


class BrokerProfileSerializer(serializers.ModelSerializer):
    completeness = serializers.SerializerMethodField()
    place_id = serializers.IntegerField(source="place_geoname_id", required=False, allow_null=True)
    logo_upload_url = serializers.SerializerMethodField()
    cover_upload_url = serializers.SerializerMethodField()

    def get_logo_upload_url(self, obj):
        from common.org_images import resolve_url

        return resolve_url(obj.logo_key)

    def get_cover_upload_url(self, obj):
        from common.org_images import resolve_url

        return resolve_url(obj.cover_key)

    def get_completeness(self, obj):
        from brokers.completeness import completeness

        return completeness(obj)

    def validate_specialties(self, value):
        if not isinstance(value, list) or len(value) > 8 or any(not isinstance(v, str) or not v.strip() or len(v) > 40 for v in value):
            raise serializers.ValidationError("Up to 8 short specialties.")
        return [v.strip() for v in value]

    def validate(self, attrs):
        from places.matching import apply_place_to_attrs

        return apply_place_to_attrs(attrs, has_region=False)

    def validate_name(self, value):
        return plain_text(value)

    def validate_city(self, value):
        return plain_text(value)

    def validate_tagline(self, value):
        return plain_text(value)

    def validate_public_phone(self, value):
        return phone_number(value)

    def validate_country_code(self, value):
        return service_country(value)

    class Meta:
        model = BrokerOrganization
        fields = (
            "id", "name", "slug", "status", "public_email", "public_phone", "website_url", "auto_approve_listings",
            "tagline", "about", "city", "place_id", "country_code", "logo_url", "cover_image_url", "specialties", "completeness",
            "logo_upload_url", "cover_upload_url",
        )
        read_only_fields = ("id", "slug", "status", "auto_approve_listings", "completeness", "logo_upload_url", "cover_upload_url")


class BrokerProfileView(BrokerTeamBaseView):
    def get(self, request, broker_id):
        broker = self.get_broker()
        return Response({**BrokerProfileSerializer(broker).data, **plan_usage(broker)})

    def patch(self, request, broker_id):
        serializer = BrokerProfileSerializer(self.get_broker(), data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        return Response(BrokerProfileSerializer(serializer.save()).data)


class BrokerProfileSubmitView(BrokerTeamBaseView):
    """Send a finished DRAFT brokerage to staff for approval."""

    def post(self, request, broker_id):
        from brokers.completeness import missing_items, subscription_is_live
        from brokers.enums import BrokerOrganizationStatus

        broker = self.get_broker()
        if broker.status != BrokerOrganizationStatus.DRAFT:
            return Response(BrokerProfileSerializer(broker).data)
        if missing_items(broker):
            raise serializers.ValidationError({"submit": ["profile_incomplete"]})
        if not subscription_is_live(broker):
            raise serializers.ValidationError({"submit": ["subscription_required"]})
        broker.status = BrokerOrganizationStatus.PENDING
        broker.save(update_fields=["status", "updated_at"])
        return Response(BrokerProfileSerializer(broker).data)
