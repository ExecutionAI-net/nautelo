from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsActiveUser, IsStaffAdmin
from common.field_rules import phone_number, plain_text
from staffops.views import StaffListView

from .models import ContactRequest
from .tasks import notify_team_of_contact_request, reference_for

DETAIL_KEYS = ("price", "deposit", "term_months", "vessel_ref", "country", "product", "condition", "use", "down_percent", "term_years", "boat_year")


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

    @staticmethod
    def _with_calculation(values):
        """A financing study keeps what the server calculates from the rulebook next to what the visitor typed."""
        details = dict(values["details"])
        if values["topic"] == ContactRequest.Topic.FINANCING and "down_percent" in details:
            from finance.study import calculated_details

            calculated = calculated_details(details)
            if calculated:
                details["calculated"] = calculated
        return details

    def post(self, request):
        data = ContactRequestSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        values = data.validated_data
        if values["website"]:
            # Bots fill the hidden field; answer like a success and store nothing.
            return Response({"reference": "NAU-0000"}, status=status.HTTP_201_CREATED)
        row = ContactRequest.objects.create(
            topic=values["topic"], name=values["name"], email=values["email"], phone=values["phone"],
            message=values["message"], details=self._with_calculation(values), reply_language=values["reply_language"],
        )
        # The team mailbox hears about every form the moment it is stored.
        transaction.on_commit(lambda: notify_team_of_contact_request.delay(str(row.pk)))
        return Response({"reference": reference_for(row)}, status=status.HTTP_201_CREATED)


class ContactRequestRowSerializer(serializers.ModelSerializer):
    reference = serializers.SerializerMethodField()
    topic_label = serializers.CharField(source="get_topic_display", read_only=True)
    handled_by_email = serializers.EmailField(source="handled_by.email", read_only=True, default=None)

    class Meta:
        model = ContactRequest
        fields = (
            "id", "reference", "topic", "topic_label", "name", "email", "phone", "message", "details", "reply_language",
            "status", "notes", "handled_by_email", "handled_at", "created_at", "updated_at",
        )

    def get_reference(self, row) -> str:
        return reference_for(row)


class StaffContactRequestListView(StaffListView):
    """GET /api/v1/staff/contact-requests/ - every public form submission, newest first."""

    serializer_class = ContactRequestRowSerializer
    search_fields = ("name", "email", "message", "phone")
    facet_field = "status"
    status_field = "status"
    queryset = ContactRequest.objects.select_related("handled_by").order_by("-created_at")

    def filter_queryset(self, queryset):
        queryset = super().filter_queryset(queryset)
        topic = self.request.query_params.get("topic", "").strip()
        return queryset.filter(topic=topic) if topic else queryset


class ContactRequestUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=ContactRequest.Status.choices, required=False)
    notes = serializers.CharField(max_length=8000, required=False, allow_blank=True)

    def validate_notes(self, value):
        return plain_text(value)


class StaffContactRequestUpdateView(APIView):
    """PATCH /api/v1/staff/contact-requests/<id>/ - staff record the status and what was done (audited)."""

    permission_classes = [IsAuthenticated, IsActiveUser, IsStaffAdmin]
    throttle_scope = "staff_moderation"

    def patch(self, request, pk):
        from audit.models import AuditEvent
        from audit.services import record_audit_event

        payload = ContactRequestUpdateSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        values = payload.validated_data
        with transaction.atomic():
            row = get_object_or_404(ContactRequest.objects.select_for_update(), pk=pk)
            before = {"status": row.status, "notes": row.notes}
            if "notes" in values:
                row.notes = values["notes"]
            if "status" in values:
                row.status = values["status"]
                row.handled_by = request.user
                row.handled_at = timezone.now() if row.status == ContactRequest.Status.HANDLED else None
            row.save()
            record_audit_event(
                actor_user=request.user,
                actor_type=AuditEvent.ActorType.USER,
                action="contactdesk.ContactRequest.updated",
                target_type="contactdesk.ContactRequest",
                target_id=str(row.pk),
                source=AuditEvent.Source.API,
                before=before,
                after={"status": row.status, "notes": row.notes},
            )
        return Response(ContactRequestRowSerializer(row).data)
