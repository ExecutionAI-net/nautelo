"""Staff read view over ContactAccessGrant (spec 16: a moderator must be able
to find a grant before revoking it - StaffContactGrantRevokeView in
contact_views.py already does the revoking, but nothing lists a grant id to
revoke in the first place).

Same privacy stance as staff_grant_payload() in contact_payloads.py: safe
object IDs only. A moderator does not need the viewer's email or the target's
name to act on a grant id, and spec 33.5 keeps personal contact data out of
staff tooling - so this list, like the revoke response, never carries either.
"""

import uuid

from django.db.models import Q
from rest_framework import serializers
from rest_framework.generics import ListAPIView
from rest_framework.pagination import PageNumberPagination

from accounts.permissions import IsActiveUser, IsStaffModerator

from .contact_views import apply_no_store
from .models import ContactAccessGrant


class StaffContactGrantPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100

    def get_paginated_response(self, data):
        response = super().get_paginated_response(data)
        response.data["facets"] = getattr(self, "facets", {})
        return response


class StaffContactGrantSerializer(serializers.ModelSerializer):
    target_entity_id = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = ContactAccessGrant
        fields = (
            "id", "target_type", "target_entity_id", "viewer_id",
            "source_conversation_id", "status", "granted_at", "revoked_at",
            "first_revealed_at",
        )

    def get_target_entity_id(self, obj) -> str:
        return str(obj.broker_id or obj.professional_id)

    def get_status(self, obj) -> str:
        return "REVOKED" if obj.revoked_at else "ACTIVE"


class StaffContactGrantListView(ListAPIView):
    """GET /api/v1/staff/contact-grants/?q=&status= - every contact-access
    grant, active or revoked, so a moderator can find the id
    StaffContactGrantRevokeView needs. `q` matches a grant, viewer, broker or
    professional id exactly (UUIDs do not support a meaningful icontains)."""

    permission_classes = [IsActiveUser, IsStaffModerator]
    throttle_scope = "contact_grant_admin"
    pagination_class = StaffContactGrantPagination
    serializer_class = StaffContactGrantSerializer
    queryset = ContactAccessGrant.objects.order_by("-granted_at")

    def finalize_response(self, request, response, *args, **kwargs):
        # Per-viewer grant data has no business in any cache, same rule the
        # revoke view already enforces.
        response = super().finalize_response(request, response, *args, **kwargs)
        return apply_no_store(response)

    def filter_queryset(self, queryset):
        params = self.request.query_params
        term = params.get("q", "").strip()
        if term:
            try:
                term_id = uuid.UUID(term)
            except ValueError:
                queryset = queryset.none()
            else:
                queryset = queryset.filter(
                    Q(pk=term_id) | Q(viewer_id=term_id) | Q(broker_id=term_id) | Q(professional_id=term_id)
                )
        active_count = queryset.filter(revoked_at__isnull=True).count()
        revoked_count = queryset.filter(revoked_at__isnull=False).count()
        self.paginator.facets = {"ACTIVE": active_count, "REVOKED": revoked_count}
        status = params.get("status", "").strip()
        if status == "ACTIVE":
            queryset = queryset.filter(revoked_at__isnull=True)
        elif status == "REVOKED":
            queryset = queryset.filter(revoked_at__isnull=False)
        return queryset
