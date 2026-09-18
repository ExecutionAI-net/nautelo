from django.core.exceptions import ValidationError

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
