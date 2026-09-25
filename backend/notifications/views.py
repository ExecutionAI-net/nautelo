from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsActiveUser

from .models import Notification, NotificationPreference
from .serializers import NotificationSerializer


class NotificationPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class _Base(APIView):
    permission_classes = [IsAuthenticated, IsActiveUser]
    throttle_scope = "notifications"

    def mine(self, request):
        return Notification.objects.filter(recipient=request.user)


class NotificationListView(_Base):
    """GET /api/v1/notifications/?unread=true - the REST source of truth that a
    reconnecting client reads (spec 27.2)."""

    def get(self, request):
        rows = self.mine(request)
        if request.query_params.get("unread", "").lower() == "true":
            rows = rows.filter(read_at__isnull=True)
        paginator = NotificationPagination()
        page = paginator.paginate_queryset(rows, request, view=self)
        body = paginator.get_paginated_response(
            NotificationSerializer(page, many=True).data
        ).data
        body["unread_count"] = self.mine(request).filter(read_at__isnull=True).count()
        return Response(body)


class NotificationReadView(_Base):
    """POST /api/v1/notifications/<id>/read/ - idempotent."""

    def post(self, request, notification_id):
        notification = get_object_or_404(self.mine(request), pk=notification_id)
        if notification.read_at is None:
            notification.read_at = timezone.now()
            notification.save(update_fields=["read_at", "updated_at"])
        return Response(NotificationSerializer(notification).data)


class NotificationReadAllView(_Base):
    """POST /api/v1/notifications/read-all/"""

    def post(self, request):
        marked = self.mine(request).filter(read_at__isnull=True).update(
            read_at=timezone.now()
        )
        return Response({"marked_read": marked})


#: The fields PATCH accepts, each independently optional - the bell dropdown's
#: master switch sends only `email_enabled`; the dashboard settings page can
#: send one or more category fields alongside it.
_PREFERENCE_FIELDS = ("email_enabled", "messages_enabled", "listings_enabled", "billing_enabled")


class NotificationPreferenceView(_Base):
    """GET/PATCH /api/v1/notifications/preferences/ - the master email switch
    plus one switch per NotificationCategory. Absent row (never configured)
    reads as every switch on."""

    def _payload(self, request):
        preference = NotificationPreference.objects.filter(user=request.user).first()
        if preference is None:
            return {field: True for field in _PREFERENCE_FIELDS}
        return {field: getattr(preference, field) for field in _PREFERENCE_FIELDS}

    def get(self, request):
        return Response(self._payload(request))

    def patch(self, request):
        from rest_framework.exceptions import ValidationError

        updates = {}
        for field in _PREFERENCE_FIELDS:
            if field not in request.data:
                continue
            value = request.data[field]
            if not isinstance(value, bool):
                raise ValidationError({field: "Send true or false."})
            updates[field] = value
        if not updates:
            raise ValidationError("Send at least one of: " + ", ".join(_PREFERENCE_FIELDS))
        NotificationPreference.objects.update_or_create(user=request.user, defaults=updates)
        return Response(self._payload(request))
