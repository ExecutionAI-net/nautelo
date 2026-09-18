from django.core.exceptions import ValidationError
from django.db import transaction

from audit.models import AuditEvent
from audit.services import record_audit_event

# Spec §0: supported interface languages are exactly English, Italian and Spanish.
SUPPORTED_LOCALES = ("en", "it", "es")
DEFAULT_LOCALE = "en"

# A category slugged "professionals" would be permanently shadowed by the static
# /services/professionals/ directory route in the Next.js App Router.
RESERVED_CATEGORY_SLUGS = ("professionals",)


def resolve_locale(raw):
    """Normalize a client-supplied locale to one of SUPPORTED_LOCALES."""
    if not raw:
        return DEFAULT_LOCALE
    candidate = str(raw).strip().lower()
    return candidate if candidate in SUPPORTED_LOCALES else DEFAULT_LOCALE


def localized(instance, field_base, locale):
    """Read `<field_base>_<locale>`, falling back to English when it is blank."""
    value = getattr(instance, f"{field_base}_{resolve_locale(locale)}", "") or ""
    if value.strip():
        return value
    return getattr(instance, f"{field_base}_{DEFAULT_LOCALE}", "") or ""


def validate_category_slug(value):
    """Reject slugs that would collide with a reserved public route."""
    if value in RESERVED_CATEGORY_SLUGS:
        raise ValidationError(
            "This slug is reserved by the combined directory route.",
            code="service_category_slug_reserved",
        )


CATEGORY_AUDIT_FIELDS = (
    "name_en",
    "name_it",
    "name_es",
    "slug",
    "description_en",
    "description_it",
    "description_es",
    "icon_key",
    "display_order",
    "is_active",
    "has_seo_page",
    "seo_title_en",
    "seo_title_it",
    "seo_title_es",
    "seo_description_en",
    "seo_description_it",
    "seo_description_es",
)


def category_audit_snapshot(category) -> dict:
    """Before/after summary of a ServiceCategory for the audit trail (spec §2.4)."""
    return {field: getattr(category, field) for field in CATEGORY_AUDIT_FIELDS}


@transaction.atomic
def save_service_category(
    *,
    category,
    actor,
    actor_type: str = AuditEvent.ActorType.USER,
    source: str = AuditEvent.Source.ADMIN,
    request_id: str | None = None,
):
    """The only sanctioned way to create or change a ServiceCategory.

    Validates, persists and records one immutable audit event in a single
    transaction, so no entry point (admin today, the legacy-import management
    command in Task 10, a staff API later) can write an unaudited catalog
    change. A non-interactive caller passes actor=None with
    actor_type=AuditEvent.ActorType.SYSTEM and source=AuditEvent.Source.TASK.
    """
    # Capture before save() clears it: UUIDModel assigns a pk at instantiation,
    # so `pk is None` is not a usable "is this new?" test (same reasoning as
    # audit.models.AuditEvent.save).
    is_create = category._state.adding
    before = (
        None
        if is_create
        else category_audit_snapshot(type(category).objects.get(pk=category.pk))
    )

    category.full_clean()
    category.save()

    actor_user = actor if getattr(actor, "is_authenticated", False) else None
    record_audit_event(
        actor_user=actor_user,
        actor_type=actor_type,
        action="service_category.created" if is_create else "service_category.updated",
        target_type="services_catalog.ServiceCategory",
        target_id=str(category.pk),
        source=source,
        before=before,
        after=category_audit_snapshot(category),
        request_id=request_id,
    )
    return category


@transaction.atomic
def delete_service_category(
    *,
    category,
    actor,
    actor_type: str = AuditEvent.ActorType.USER,
    source: str = AuditEvent.Source.ADMIN,
    request_id: str | None = None,
) -> None:
    """Delete a ServiceCategory, recording what was removed.

    A category referenced by any ProfessionalService raises ProtectedError
    (Task 5 sets on_delete=PROTECT) — deactivate it instead, per the same
    "never delete a row referenced elsewhere; deactivate or merge it" rule
    the spec applies to taxonomy in §13.3.
    """
    before = category_audit_snapshot(category)
    target_id = str(category.pk)

    category.delete()

    actor_user = actor if getattr(actor, "is_authenticated", False) else None
    record_audit_event(
        actor_user=actor_user,
        actor_type=actor_type,
        action="service_category.deleted",
        target_type="services_catalog.ServiceCategory",
        target_id=target_id,
        source=source,
        before=before,
        after=None,
        request_id=request_id,
    )
