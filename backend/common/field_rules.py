"""Small input rules shared by the organization profile serializers."""

from rest_framework import serializers


def plain_text(value: str) -> str:
    """Trimmed text that cannot smuggle markup."""
    value = value.strip()
    if "<" in value or ">" in value:
        raise serializers.ValidationError("This field cannot contain < or >.")
    return value


def phone_number(value: str) -> str:
    """Empty is allowed; otherwise at least 6 digits and only phone characters."""
    value = value.strip()
    if not value:
        return value
    digits = [c for c in value if c.isdigit()]
    if len(digits) < 6 or any(not (c.isdigit() or c in "+-() .") for c in value):
        raise serializers.ValidationError("Enter a valid phone number.")
    return value


def service_country(value: str) -> str:
    """Brokers and professionals operate in the supported markets only (settings.SUPPORTED_COUNTRIES)."""
    from django.conf import settings

    code = (value or "").strip().upper()
    allowed = list(getattr(settings, "SUPPORTED_COUNTRIES", ["ES", "IT"]))
    if code not in allowed:
        raise serializers.ValidationError(f"Choose one of the supported countries: {', '.join(allowed)}.")
    return code
