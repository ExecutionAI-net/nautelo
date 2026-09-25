"""Staff editor API for EmailTemplate: list every (key, locale) cell, view or
upsert one cell's content, preview it rendered with sample data, and send a
test copy to the editing staffer's own inbox - all without touching what a
real send does (render_email() in services.py, used by the Celery tasks) so
an in-progress edit can never leak into a real user's mailbox.

Admin-tier (`IsStaffAdmin`), not moderator: matches payments/staff_views.py's
product-configuration endpoints, the closest precedent for "staff configures
how the platform looks/charges", as opposed to moderation actions.
"""

from django.conf import settings
from django.core.mail import send_mail
from rest_framework.exceptions import APIException, NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsActiveUser, IsStaffAdmin

from .models import TEMPLATE_KEYS, EmailTemplate
from .services import render_preview, sample_context

LOCALES = ("EN", "IT", "ES")
_KEYS_BY_NAME = {key: (label, variables) for key, label, variables in TEMPLATE_KEYS}


def _template_meta(key: str):
    if key not in _KEYS_BY_NAME:
        raise NotFound("Unknown template key.")
    return _KEYS_BY_NAME[key]


def _check_locale(locale: str):
    if locale not in LOCALES:
        raise NotFound("Unknown locale.")


class StaffEmailTemplateListView(APIView):
    """GET /api/v1/staff/email-templates/ - the full key x locale matrix, so
    the editor can show what exists and what is still missing without one
    request per cell."""

    permission_classes = [IsAuthenticated, IsActiveUser, IsStaffAdmin]
    throttle_scope = "staff_moderation"

    def get(self, request):
        rows = {(row.key, row.locale): row for row in EmailTemplate.objects.all()}
        templates = []
        for key, label, variables in TEMPLATE_KEYS:
            locales = {}
            for locale in LOCALES:
                row = rows.get((key, locale))
                locales[locale] = (
                    {"exists": True, "subject": row.subject, "updated_at": row.updated_at.isoformat()}
                    if row is not None
                    else {"exists": False}
                )
            templates.append({"key": key, "label": label, "variables": list(variables), "locales": locales})
        return Response({"templates": templates})


class StaffEmailTemplateDetailView(APIView):
    """GET/PUT /api/v1/staff/email-templates/<key>/<locale>/ - one cell's
    content. GET on a cell that doesn't exist yet returns exists=false with
    empty content, so the editor can start a new locale from a blank form
    rather than needing a separate "create" endpoint."""

    permission_classes = [IsAuthenticated, IsActiveUser, IsStaffAdmin]
    throttle_scope = "staff_moderation"

    def get(self, request, key, locale):
        label, variables = _template_meta(key)
        _check_locale(locale)
        row = EmailTemplate.objects.filter(key=key, locale=locale).first()
        return Response(
            {
                "key": key,
                "locale": locale,
                "label": label,
                "variables": list(variables),
                "exists": row is not None,
                "subject": row.subject if row else "",
                "html_body": row.html_body if row else "",
            }
        )

    def put(self, request, key, locale):
        _template_meta(key)
        _check_locale(locale)
        subject = (request.data.get("subject") or "").strip()
        html_body = request.data.get("html_body") or ""
        if not subject or not html_body.strip():
            raise ValidationError("subject and html_body are both required.")
        EmailTemplate.objects.update_or_create(
            key=key,
            locale=locale,
            defaults={"subject": subject, "html_body": html_body, "updated_by": request.user},
        )
        return Response({"saved": True})


class StaffEmailTemplatePreviewView(APIView):
    """POST /api/v1/staff/email-templates/<key>/<locale>/preview/ - renders
    the POSTed (not yet saved) subject/html_body with sample data, so the
    editor's preview pane reflects the draft, not the last saved version."""

    permission_classes = [IsAuthenticated, IsActiveUser, IsStaffAdmin]
    throttle_scope = "staff_moderation"

    def post(self, request, key, locale):
        _, variables = _template_meta(key)
        _check_locale(locale)
        subject, html = render_preview(
            request.data.get("subject") or "", request.data.get("html_body") or "", sample_context(variables)
        )
        return Response({"subject": subject, "html": html})


class StaffEmailTemplateTestSendView(APIView):
    """POST /api/v1/staff/email-templates/<key>/<locale>/test-send/ - sends
    the draft to the requesting staffer's own address only; it can never be
    pointed at anyone else's inbox."""

    permission_classes = [IsAuthenticated, IsActiveUser, IsStaffAdmin]
    throttle_scope = "staff_moderation"

    def post(self, request, key, locale):
        _, variables = _template_meta(key)
        _check_locale(locale)
        subject, html = render_preview(
            request.data.get("subject") or "", request.data.get("html_body") or "", sample_context(variables)
        )
        try:
            send_mail(
                subject=f"[Preview] {subject}",
                message="This is a staff preview send. Open it in an HTML-capable mail client to see the design.",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[request.user.email],
                html_message=html,
            )
        except Exception as exc:  # noqa: BLE001 - surface the provider's reason to the staffer
            # A rejected send is the staffer's problem to act on (unverified
            # sender domain, bad token...), not a server fault: hand the
            # provider's explanation back instead of a blank 500.
            raise EmailDeliveryFailed(str(exc)) from exc
        return Response({"sent_to": request.user.email})


class EmailDeliveryFailed(APIException):
    # Not 502: Cloudflare replaces an origin 502/503/504 with its own error
    # page, which would hide the provider's reason from the staffer.
    status_code = 400
    default_code = "email_delivery_failed"
    default_detail = "The email provider rejected the message."
