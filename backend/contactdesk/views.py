from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from common.field_rules import phone_number, plain_text

from .models import ContactRequest

DETAIL_KEYS = ("price", "deposit", "term_months", "vessel_ref")


class ContactRequestSerializer(serializers.Serializer):
    topic = serializers.ChoiceField(choices=ContactRequest.Topic.choices)
    name = serializers.CharField(max_length=120)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True, default="")
    message = serializers.CharField(max_length=4000, required=False, allow_blank=True, default="")
    reply_language = serializers.ChoiceField(choices=["EN", "ES", "IT"], default="EN")
    details = serializers.DictField(child=serializers.CharField(max_length=80, allow_blank=True), required=False, default=dict)
    consent = serializers.BooleanField()
    website = serializers.CharField(required=False, allow_blank=True, default="")  # honeypot

    def validate_name(self, value):
        return plain_text(value)

    def validate_phone(self, value):
        return phone_number(value)

    def validate_message(self, value):
        return plain_text(value)

    def validate_consent(self, value):
        if not value:
            raise serializers.ValidationError("Consent is required.")
        return value

    def validate_details(self, value):
        return {k: plain_text(v) for k, v in value.items() if k in DETAIL_KEYS}

    def validate(self, attrs):
        if attrs["topic"] != ContactRequest.Topic.FINANCING and not attrs["message"].strip():
            raise serializers.ValidationError({"message": ["This field is required."]})
        return attrs


class ContactRequestView(APIView):
    """POST /api/v1/contact/ - public, throttled, honeypot-protected."""

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = "contact_request"

    def post(self, request):
        data = ContactRequestSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        values = data.validated_data
        if values["website"]:
            # Bots fill the hidden field; answer like a success and store nothing.
            return Response({"reference": "NAU-0000"}, status=status.HTTP_201_CREATED)
        row = ContactRequest.objects.create(
            topic=values["topic"], name=values["name"], email=values["email"], phone=values["phone"],
            message=values["message"], details=values["details"], reply_language=values["reply_language"],
        )
        return Response({"reference": f"NAU-{str(row.pk)[:8].upper()}"}, status=status.HTTP_201_CREATED)
