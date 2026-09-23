"""Shared field-level validators for accounts serializers.

Kept separate so RegistrationSerializer (private seller) and
OrganizationRegistrationSerializer (broker/professional) apply the exact
same "is this a real phone number" rule instead of two copies drifting apart.
"""

from rest_framework import serializers


def validate_phone_number(value: str) -> str:
    value = value.strip()
    digits = [c for c in value if c.isdigit()]
    if len(digits) < 6 or any(not (c.isdigit() or c in "+-() .") for c in value):
        raise serializers.ValidationError("Enter a valid phone number.")
    return value
