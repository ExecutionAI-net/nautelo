from django.db import transaction
from rest_framework import serializers, status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsActiveUser, IsBrokerTeamManager, IsEmailVerified

from . import org_images


class IntentSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=org_images.KINDS)
    mime_type = serializers.CharField(max_length=40)
    size = serializers.IntegerField(min_value=1)


class CompleteSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=org_images.KINDS)
    key = serializers.CharField(max_length=300)
    mime_type = serializers.CharField(max_length=40)


class _OrgImageBase(APIView):
    """Subclasses say which organization the caller may edit.

    `allowed_kinds` narrows org_images.KINDS to what this owner's model
    actually has fields for: the serializers below validate `kind` against
    every kind that exists anywhere (so one shared upload contract works for
    all of them), but writing an unsupported kind's key to the wrong owner
    model would raise deep inside replace_key() instead of a clean 400.
    """

    throttle_scope = "media_upload"
    owner_type = ""
    allowed_kinds = org_images.KINDS

    def owner(self, request, **kwargs):  # pragma: no cover - overridden
        raise NotImplementedError

    def response(self, owner):  # pragma: no cover - overridden
        raise NotImplementedError

    def _check_kind(self, kind):
        if kind not in self.allowed_kinds:
            raise ValidationError({"kind": ["invalid_kind"]})


class _Intent(_OrgImageBase):
    def post(self, request, **kwargs):
        owner = self.owner(request, **kwargs)
        data = IntentSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        self._check_kind(data.validated_data["kind"])
        payload = org_images.create_intent(owner_type=self.owner_type, owner_id=owner.pk, **data.validated_data)
        return Response(payload, status=status.HTTP_201_CREATED)


class _Complete(_OrgImageBase):
    @transaction.atomic
    def post(self, request, **kwargs):
        owner = self.owner(request, **kwargs)
        data = CompleteSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        kind = data.validated_data["kind"]
        self._check_kind(kind)
        key = org_images.finish_upload(
            owner_type=self.owner_type, owner_id=owner.pk, key=data.validated_data["key"],
            kind=kind, mime_type=data.validated_data["mime_type"],
        )
        org_images.replace_key(owner, f"{kind}_key", key)
        return Response(self.response(owner))


class BrokerImageMixin:
    owner_type = "broker"
    allowed_kinds = ("logo", "cover")
    permission_classes = [IsActiveUser, IsEmailVerified, IsBrokerTeamManager]

    def owner(self, request, broker_id):
        from brokers.models import BrokerOrganization

        try:
            return BrokerOrganization.objects.get(pk=broker_id)
        except BrokerOrganization.DoesNotExist as exc:
            raise NotFound() from exc

    def response(self, owner):
        return {"logo_url": org_images.resolve_url(owner.logo_key), "cover_url": org_images.resolve_url(owner.cover_key)}


class ProfessionalImageMixin:
    owner_type = "professional"
    allowed_kinds = ("logo", "cover")
    permission_classes = [IsActiveUser, IsEmailVerified]

    def owner(self, request):
        from professionals.access import membership_for

        seat = membership_for(request.user)
        if seat is None:
            raise NotFound("No provider profile yet.")
        if not seat.can_edit_profile:
            raise PermissionDenied("Your role cannot edit the profile.")
        return seat.profile

    def response(self, owner):
        return {"logo_url": org_images.resolve_url(owner.logo_key), "cover_url": org_images.resolve_url(owner.cover_key)}


class ProfessionalServicePhotoMixin:
    """One photo per service, owned by the same profile as the service.

    Distinct from ProfessionalImageMixin (the profile's own logo/cover):
    owner_id here is the ProfessionalService row, scoped to a service_id URL
    kwarg, and it is looked up under the caller's own profile so nobody can
    attach a photo to another provider's service by guessing its id.
    """

    owner_type = "professional-service"
    allowed_kinds = ("photo",)
    permission_classes = [IsActiveUser, IsEmailVerified]

    def owner(self, request, service_id):
        from professionals.access import membership_for
        from services_catalog.models import ProfessionalService

        seat = membership_for(request.user)
        if seat is None:
            raise NotFound("No provider profile yet.")
        if not seat.can_edit_profile:
            raise PermissionDenied("Your role cannot edit the profile.")
        try:
            return ProfessionalService.objects.get(pk=service_id, professional=seat.profile)
        except ProfessionalService.DoesNotExist as exc:
            raise NotFound() from exc

    def response(self, owner):
        return {"photo_url": org_images.resolve_url(owner.photo_key)}


class BrokerImageIntentView(BrokerImageMixin, _Intent):
    pass


class BrokerImageCompleteView(BrokerImageMixin, _Complete):
    pass


class ProfessionalImageIntentView(ProfessionalImageMixin, _Intent):
    pass


class ProfessionalImageCompleteView(ProfessionalImageMixin, _Complete):
    pass


class ProfessionalServicePhotoIntentView(ProfessionalServicePhotoMixin, _Intent):
    pass


class ProfessionalServicePhotoCompleteView(ProfessionalServicePhotoMixin, _Complete):
    pass
