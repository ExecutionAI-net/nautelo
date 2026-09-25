"""Staff ledger operations (spec 26.3).

Staff-admin only (ruling: these compensate money-adjacent state). Every write
goes through entitlements.services, which locks, audits and requires a reason.
Nothing here edits a Stripe order.
"""

from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsActiveUser, IsStaffAdmin

from .enums import EntitlementType
from .models import UserEntitlement
from .services import grant_listing_right, restore_consumed_right, revoke_entitlement

GRANTABLE = (EntitlementType.PAID_LISTING, EntitlementType.MEDIA_UPGRADE)


def entitlement_row(e: UserEntitlement) -> dict:
    return {
        "id": str(e.pk),
        "user_id": str(e.user_id),
        "user_email": e.user.email,
        "entitlement_type": e.entitlement_type,
        "source": e.source,
        "state": e.state,
        "listing_id": str(e.listing_id) if e.listing_id else None,
        "listing_label": _listing_label(e.listing) if e.listing_id else "",
        "valid_from": e.valid_from,
        "valid_until": e.valid_until,
        "consumed_at": e.consumed_at,
        "revoked_at": e.revoked_at,
        "granted_by_id": str(e.granted_by_id) if e.granted_by_id else None,
        "reason": (e.metadata or {}).get("reason", ""),
        # Reference only: staff cannot edit the order from here (spec 26.3).
        "payment_order_id": str(e.source_payment_id) if e.source_payment_id else None,
    }


def _listing_label(listing) -> str:
    return f"{listing.manufacture_year} {listing.brand.name} {listing.custom_model_name or listing.model.name}"


class _Base(APIView):
    permission_classes = [IsAuthenticated, IsActiveUser, IsStaffAdmin]
    throttle_scope = "staff_entitlements"


class StaffEntitlementPagination(PageNumberPagination):
    page_size = 25
    max_page_size = 100
    page_size_query_param = "page_size"


class StaffEntitlementListView(_Base):
    """GET /api/v1/staff/entitlements/?user=&type=&state="""

    def get(self, request):
        rows = UserEntitlement.objects.select_related("user", "listing", "listing__brand", "listing__model")
        params = request.query_params
        if params.get("user"):
            rows = rows.filter(user_id=params["user"])
        if params.get("email"):
            rows = rows.filter(user__email__icontains=params["email"].strip())
        if params.get("type"):
            rows = rows.filter(entitlement_type=params["type"])
        if params.get("state"):
            rows = rows.filter(state=params["state"])
        paginator = StaffEntitlementPagination()
        page = paginator.paginate_queryset(rows, request, view=self)
        return paginator.get_paginated_response([entitlement_row(e) for e in page])


class StaffEntitlementGrantView(_Base):
    """POST /api/v1/staff/entitlements/grants/ {user_id | user_email, entitlement_type, reason, valid_days?}"""

    def post(self, request):
        data = request.data
        kind = data.get("entitlement_type", EntitlementType.PAID_LISTING)
        if kind not in GRANTABLE:
            raise ValidationError({"entitlement_type": "Not a grantable type."})
        if data.get("user_email"):
            user = get_object_or_404(get_user_model(), email__iexact=str(data["user_email"]).strip())
        else:
            user = get_object_or_404(get_user_model(), pk=data.get("user_id"))
        entitlement = grant_listing_right(
            user=user,
            actor=request.user,
            reason=data.get("reason", ""),
            entitlement_type=kind,
            valid_days=data.get("valid_days"),
        )
        return Response(entitlement_row(entitlement), status=status.HTTP_201_CREATED)


class StaffEntitlementRevokeView(_Base):
    def post(self, request, entitlement_id):
        entitlement = get_object_or_404(UserEntitlement, pk=entitlement_id)
        revoked = revoke_entitlement(
            entitlement=entitlement,
            actor=request.user,
            reason=request.data.get("reason", ""),
        )
        return Response(entitlement_row(revoked))


class StaffEntitlementRestoreView(_Base):
    def post(self, request, entitlement_id):
        entitlement = get_object_or_404(UserEntitlement, pk=entitlement_id)
        result = restore_consumed_right(
            entitlement=entitlement,
            actor=request.user,
            reason=request.data.get("reason", ""),
        )
        return Response(
            {
                "revoked": entitlement_row(result.revoked),
                "replacement": (
                    entitlement_row(result.replacement) if result.replacement else None
                ),
            }
        )
