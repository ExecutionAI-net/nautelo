"""Staff taxonomy API (spec 13.3, 26.5). Moderators and admins, audited."""

from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsActiveUser, IsStaffModerator
from audit.models import AuditEvent
from audit.services import record_audit_event
from taxonomy.models import BoatBrand, BoatModel

from .drafts import InvalidWorkflowState
from .models import BoatListing
from .taxonomy_mapping import (
    create_model_and_map,
    map_listing_to_model,
    merge_models,
    merge_preview,
)


class _Base(APIView):
    permission_classes = [IsAuthenticated, IsActiveUser, IsStaffModerator]
    throttle_scope = "staff_moderation"


def _brand(b):
    return {"id": str(b.pk), "name": b.name, "slug": b.slug, "is_active": b.is_active}


def _model(m):
    return {
        "id": str(m.pk),
        "brand_id": str(m.brand_id),
        "name": m.name,
        "is_other_placeholder": m.is_other_placeholder,
        "is_active": m.is_active,
    }


def _audit(actor, action, target, after):
    record_audit_event(
        actor_user=actor,
        actor_type=AuditEvent.ActorType.USER,
        action=action,
        target_type=f"taxonomy.{type(target).__name__}",
        target_id=str(target.pk),
        source=AuditEvent.Source.API,
        before=None,
        after=after,
        metadata={},
    )


def _save_unique(instance, message):
    try:
        with transaction.atomic():
            instance.save()
    except IntegrityError:
        raise InvalidWorkflowState(message, code="duplicate_name") from None


class StaffBrandListView(_Base):
    def get(self, request):
        rows = BoatBrand.objects.order_by("normalized_name")
        return Response([_brand(b) for b in rows])

    def post(self, request):
        name = " ".join(str(request.data.get("name", "")).split())
        if not name:
            raise ValidationError({"name": "Enter the brand name."})
        brand = BoatBrand(name=name, created_by=request.user, updated_by=request.user)
        _save_unique(brand, "A brand with this name already exists.")
        _audit(request.user, "taxonomy.brand_created", brand, {"name": brand.name})
        return Response(_brand(brand), status=status.HTTP_201_CREATED)


class StaffBrandDetailView(_Base):
    def patch(self, request, brand_id):
        brand = get_object_or_404(BoatBrand, pk=brand_id)
        if "name" in request.data:
            brand.name = " ".join(str(request.data["name"]).split())
        if "is_active" in request.data:
            brand.is_active = bool(request.data["is_active"])
        brand.updated_by = request.user
        _save_unique(brand, "A brand with this name already exists.")
        _audit(
            request.user,
            "taxonomy.brand_updated",
            brand,
            {"name": brand.name, "is_active": brand.is_active},
        )
        return Response(_brand(brand))


class StaffModelListView(_Base):
    def get(self, request):
        brand_id = request.query_params.get("brand_id")
        if not brand_id:
            raise ValidationError({"brand_id": "This query parameter is required."})
        rows = BoatModel.objects.filter(brand_id=brand_id).order_by(
            "is_other_placeholder", "normalized_name"
        )
        return Response([_model(m) for m in rows])

    def post(self, request):
        brand = get_object_or_404(BoatBrand, pk=request.data.get("brand_id"))
        name = " ".join(str(request.data.get("name", "")).split())
        if not name:
            raise ValidationError({"name": "Enter the model name."})
        model = BoatModel(
            brand=brand, name=name, created_by=request.user, updated_by=request.user
        )
        _save_unique(model, "A model with this name already exists for the brand.")
        _audit(request.user, "taxonomy.model_created", model, {"name": model.name})
        return Response(_model(model), status=status.HTTP_201_CREATED)


class StaffModelDetailView(_Base):
    def patch(self, request, model_id):
        model = get_object_or_404(BoatModel, pk=model_id)
        if model.is_other_placeholder:
            raise ValidationError({"model": "The Other placeholder cannot be edited."})
        if "name" in request.data:
            model.name = " ".join(str(request.data["name"]).split())
        if "is_active" in request.data:
            model.is_active = bool(request.data["is_active"])
        model.updated_by = request.user
        _save_unique(model, "A model with this name already exists for the brand.")
        _audit(
            request.user,
            "taxonomy.model_updated",
            model,
            {"name": model.name, "is_active": model.is_active},
        )
        return Response(_model(model))


class StaffOtherQueueView(_Base):
    """GET /api/v1/staff/taxonomy/other-queue/ - listings using Other."""

    def get(self, request):
        rows = (
            BoatListing.objects.filter(model__is_other_placeholder=True)
            .select_related("brand", "owner_user", "broker")
            .order_by("created_at")
        )
        return Response(
            [
                {
                    "listing_id": str(item.pk),
                    "brand": item.brand.name,
                    "brand_id": str(item.brand_id),
                    "custom_model_name": item.custom_model_name,
                    "owner": (
                        item.broker.name
                        if item.broker_id
                        else (item.owner_user.get_full_name() if item.owner_user else "")
                    ),
                    "seller_type": item.seller_type,
                    "status": item.status,
                    "created_at": item.created_at,
                }
                for item in rows
            ]
        )


class StaffListingMapView(_Base):
    """POST /api/v1/staff/taxonomy/listings/<id>/map/
    {model_id} maps to an existing model; {new_model_name} creates and maps."""

    def post(self, request, listing_id):
        listing = get_object_or_404(BoatListing, pk=listing_id)
        note = request.data.get("note", "")
        if request.data.get("model_id"):
            model = get_object_or_404(BoatModel, pk=request.data["model_id"])
            mapped = map_listing_to_model(
                listing=listing, actor=request.user, model=model, note=note
            )
        elif request.data.get("new_model_name"):
            mapped = create_model_and_map(
                listing=listing,
                actor=request.user,
                name=request.data["new_model_name"],
                note=note,
            )
        else:
            raise ValidationError({"model_id": "Provide model_id or new_model_name."})
        return Response(
            {
                "listing_id": str(mapped.pk),
                "model_id": str(mapped.model_id),
                "custom_model_name": mapped.custom_model_name,
                "version": mapped.version,
            }
        )


class StaffModelMergeView(_Base):
    """GET preview / POST merge: /api/v1/staff/taxonomy/models/<id>/merge/?into=<id>"""

    def _pair(self, request, model_id):
        source = get_object_or_404(BoatModel, pk=model_id)
        target_id = request.query_params.get("into") or request.data.get("into")
        return source, get_object_or_404(BoatModel, pk=target_id)

    def get(self, request, model_id):
        source, target = self._pair(request, model_id)
        return Response(merge_preview(source, target))

    def post(self, request, model_id):
        source, target = self._pair(request, model_id)
        result = merge_models(
            source=source,
            target=target,
            actor=request.user,
            note=request.data.get("note", ""),
        )
        return Response(result)
